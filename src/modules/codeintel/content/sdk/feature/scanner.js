(function()
{

    const {Cc, Ci}  = require("chrome");
    const log = require("ko/logging").getLogger("codeintel/feature/scanner");
    const codeintel = require("codeintel/codeintel");
    const service = require("codeintel/service");
    const prefs = require("ko/prefs");
    const views = require("ko/views");
    const w = require("ko/windows").getMain();
    const l = require("ko/locale");
    const notify = require("notify/notify");
    const legacy = w.ko;
    const _ = require("contrib/underscore");
    const isWindows = require("sdk/system").platform.toLowerCase() == "winnt";
    const pathSep = isWindows ? ";" : ":";
    const koFile = require("ko/file");
    const system = require('sdk/system');
    const timers = require("sdk/timers");
    const koResolve = Cc["@activestate.com/koResolve;1"].getService(Ci.koIResolve);

    //log.setLevel(10);

    const partSvc   = Cc["@activestate.com/koPartService;1"].getService(Ci.koIPartService);

    var scanning = false;
    var customScanProgress;
    var queue = [];
    var preventNextFolderTouch = false;

    /**
     * Called each time an item (path) is scanned
     *
     * @param   {Array} item [path, language]
     */
    var onScanEach = (item) =>
    {
        if (customScanProgress)
            return;

        notify.send(l.get("scanning.path", item.path), "codeintel", { id: "codeintel_scan", duration: 10000, spinner: true });
    };

    /**
     * Called when a scan has finished, calls the next scan in queue if any
     */
    var onScanEnd = () =>
    {
        customScanProgress = null;

        scanning = false;
        if (queue.length > 0)
        {
            // Process queue
            this.scanPaths.apply(this, queue.shift());
        }
        else
        {
            // Basically resets the timer to 1 second
            notify.send(l.get("scanning.done"), "codeintel", { id: "codeintel_scan", duration: 1000 });

            log.debug("Reached end of scan queue");
        }
    };
    
    var onViewSaved = () =>
    {
        preventNextFolderTouch = true;
        this.scanCurrentView();
    };

    /**
     * Called when a folder is touched (files within it were modified)
     */
    var onFolderTouched = (e) =>
    {
        _.defer(() =>
        {
            if (preventNextFolderTouch)
            {
                preventNextFolderTouch = false;
                return;
            }

            var _prefs = prefs;
            var view = views.current();
            if (view.get() && view.file)
                _prefs = view.prefs;

            this.scanPaths([e.detail.path], _prefs, false);
        });
    };

    /**
     * Prompt the user to scan a directory
     * This only gets called if service.scanSummary found more than
     * {prefs.codeintel.scanner.max_implicit} files
     *
     * @param   {object} scanSummary    result from service.scanSummary
     * @param   {array} scanPaths       the paths to scan
     * @param   {boolean} recursive     the paths to scan
     * @param   {Preferences} prefset   prefset associated with the scan
     */
    var promptForScan = (scanSummary, scanPaths, recursive, prefset) =>
    {
        var scanPathsStr = scanPaths.join(", ");
        log.debug(`Prompting to scan ${scanPathsStr}`);

        var paths = scanSummary.paths;
        var pathCount = scanSummary.count;

        var _paths = [];
        for (let entry of paths)
            _paths.push(entry[0]);

        var depth = prefset.getLong("codeintel.scanner.max_depth");
        var excludes = prefset.getString("import_exclude_matches");

        var count = 0;
        var maxImplicit = prefs.getLong("codeintel.scanner.max_implicit");

        var pathFieldValue = l.get("codeintel.scanner.paths_to_scan") + "\n";
        pathFieldValue += "--------------------------------\n";
        pathFieldValue += scanPaths.join("/*\n");
        pathFieldValue += "/*\n\n";

        // Show list of paths to be scanned
        pathFieldValue += l.get("codeintel.scanner.files_to_scan") + "\n";
        pathFieldValue += "--------------------------------\n";
        pathFieldValue += _paths.join("\n");
        if (_paths.length === (maxImplicit * 10))
        {
            // Append truncated message if we reached the limit, we don't want
            // to show too many paths as it will make Komodo hang/slow
            pathFieldValue += "\n" + l.get("scanning.truncated_message");
        }

        var groupFiles  = l.get("scanning.group_files");
        var groupFilters  = l.get("scanning.group_filters");

        // Open modal dialog with the prompt to scan the given path
        require("ko/modal").open(
        {
            title: l.get("scanning.prompt", pathCount, scanPathsStr),
            fields:
            {
                prompt: {
                    group: groupFiles,
                    type: "description",
                    value: l.get("scanning.prompt_n_s", pathCount, scanPaths.length),
                    attributes: { width: 450 },
                    fullwidth: true,
                },
                files: {
                    group: groupFiles,
                    type: "textbox",
                    value: pathFieldValue,
                    fullwidth: true,
                    attributes: {
                        multiline: true,
                        readonly: true,
                        rows: 10,
                        wrap: "off"
                    }
                },
                exclude: {
                    group: groupFilters,
                    label: l.get("scanning.exclude"),
                    value: excludes
                },
                depth: {
                    group: groupFilters,
                    label: l.get("scanning.max_depth"),
                    value: depth,
                    attributes: {
                        type: "number"
                    }
                },
                rescan: {
                    type: "button",
                    group: groupFilters,
                    value: l.get("scanning.rescan"),
                    centered: true
                }
            },
            onReady: (dialog, mapping) =>
            {
                mapping.rescan.on("command", () =>
                {
                    prefset.setLong("codeintel.scanner.max_depth", mapping.depth.value());
                    prefset.setString("import_exclude_matches", mapping.exclude.value());

                    dialog.close();
                    this.scanPaths(scanPaths, prefset, recursive, true);
                });
            },
            onComplete: (result) =>
            {
                if ( ! result)
                {
                    scanning = false;
                    return;
                }

                customScanProgress = true;

                prefset.setLong("codeintel.scanner.max_depth", result.depth);
                prefset.setString("import_exclude_matches", result.exclude);

                // Start the scan for real
                this.scanPathsForced(scanPaths, result.depth, result.exclude.split(";"))
                .each((item) =>
                {
                    // We update the progress indicator for each path
                    count++;
                    var perc = Math.floor((count / pathCount) * 100);
                    notify.send(
                        l.get("scanning.percentage_path", perc, item.path),
                        "codeintel",
                        { id: "codeintel_scan", duration: 10000, spinner: true }
                    );
                });
            },
            okLabel: l.get("scanning.confirm"),
            cancelLabel: l.get("scanning.cancel")
        });
    };
    
    /**
     * loadCatalogs loads the active catalogs into codeintel
     */
    var loadCatalogs = () =>
    {
        if ( ! prefs.hasPref("codeintel.catalogs.loaded")) 
            return

        var catalogs = prefs.getPref("codeintel.catalogs");
        var loaded = prefs.getPref("codeintel.catalogs.loaded");
        
        for (let load of loaded.getAllPrefIds())
        {
            if ( ! catalogs.hasPref(load)) {
                log.warn("Catalog does not exist: " + load);
                continue;
            }
            let prefset = catalogs.getPref(load);
            require("codeintel/service").loadCatalog({language: prefset.getStringPref("lang"), catalog: prefset.getString("path")});
        }
    };

    /**
     * Scan the given path
     * 
     * @param   {array} paths  
     * @param   {Preferences} prefset   prefset associated with the scan
     * @param   {boolean} recursive
     * @param   {boolean} forcePrompt   Always prompt
     */
    this.scanPaths = (paths, prefset, recursive = true, forcePrompt = false) =>
    {
        var pathsStr = paths.join(", ");
        log.debug("Starting scan for " + pathsStr);

        // If a scan is already in progress add this scan to the queue
        if (scanning)
        {
            if (_.isEqual(scanning, paths))
                return;

            log.debug("Scan already in progress, queueing new scan");
            queue.push(arguments);
            return;
        }
        
        scanning = paths;

        if (koFile.isDir(paths[0]))
            notify.send(l.get("scanning.analyzing_s", paths.length), "codeintel", { id: "codeintel_scan", spinner: true });

        var depth = prefset.getLong("codeintel.scanner.max_depth");
        var excludes = prefset.getString("import_exclude_matches").split(";");

        depth = recursive ? depth : 1;

        // max_implicit defines the maximum number of files that Komodo will
        // scan without requiring explicit approval from the user
        var maxImplicit = prefset.getLong("codeintel.scanner.max_implicit");
        var prompt = prefset.getBoolean("codeintel.scanner.prompt");

        service.scanSummary(
        {
            paths: paths,
            maxDepth: depth,
            excludes: excludes,
            limit: maxImplicit * 10
        })
        .then((result) =>
        {
            if ( ! result)
            {
                log.debug("Found no files");
                scanning = false;
                return;
            }

            log.debug(`Found ${result.count} files`);

            // if we're under max_implicit forward the call to scanPathsForced
            if ( ! prompt || ( ! forcePrompt && result.count <= maxImplicit))
                return this.scanPathsForced(paths, depth, excludes);

            scanning = false;

            promptForScan(result, paths, recursive, prefset);
        })
        .catch((data) =>
        {
            log.error("Scan summary failed: " + require("ko/logging").getObjectTree(data));
            scanning = false;
        });
    };

    /**
     * Scan the given paths, regardless of codeintel.scanner.max_implicit
     * 
     * @param   {array} paths    
     * @param   {int} depth    
     * @param   {array} excludes 
     */
    this.scanPathsForced = (paths, depth = 10, excludes = []) =>
    {
        var pathsStr = paths.join(", ");
        log.debug(`Starting forced scan of ${pathsStr}`);

        notify.send(l.get("scanning.starting"), "codeintel", { id: "codeintel_scan", duration: 10000, spinner: true });

        return service.scan(
        {
            paths: paths,
            maxDepth: depth,
            excludes: excludes
        })
        .each(_.throttle(onScanEach, 100))
        .then(_.debounce(onScanEnd, 200))
        .catch((message) =>
        {
            log.error("Scan failed: " + message);
            scanning = false;
        });
    };

    /**
     * Scan files in the current working directory.  Includes respective
     * language Extra Path prefs from the Preferences > Languages > [language] >
     * [language] Directories.
     */
    this.scanCurrentWorkingDirectory = () =>
    {
        var prefset = prefs;
        var project = partSvc.currentProject;
        var placesPath = legacy.places.getDirectory();
        var cwd = null;

        if (placesPath)
            cwd = legacy.uriparse.URIToLocalPath(placesPath);

        if (project)
        {
            prefset = project.prefset;
            cwd = project.liveDirectory;
        }
        
        if ( ! cwd)
            return;
        
        if (cwd == system.pathFor('Home'))
        {
            log.debug("Skipping scan of home directory");
            return;
        }

        service.getLanguages().then((languages) =>
        {
            try
            {
                var paths = [cwd];
                for (let language in languages)
                {
                    var importPaths = codeintel.getImportPaths(prefset, language);
                    if (importPaths.length)
                        paths = paths.concat(importPaths);
                }

                this.scanPaths(paths, prefset);
            }
            catch (e)
            {
                log.exception(e, "scanCurrentWorkingDirectory Failed");
            }
        });
    };

    /**
     * Scan the file belonging to the current view (if any)
     */
    this.scanCurrentView = () =>
    {
        var view = views.current();
        if ( ! view.get() || ! view.file)
            return;

        this.scanPaths([view.filePath], view.prefs);
    };

    this.start = () =>
    {
        w.addEventListener('file_saved', onViewSaved);
        w.addEventListener('folder_touched', onFolderTouched);

        prefs.onChange("codeintel.catalogs.loaded", loadCatalogs);

        // Give codeintel plenty of time to fully start
        // todo: implement event for when syspath detection has finished
        timers.setTimeout(() =>
        {
            // prevent triggering these on startup
            w.addEventListener('project_opened', this.scanCurrentWorkingDirectory);
            w.addEventListener('current_place_opened', this.scanCurrentWorkingDirectory);
            w.addEventListener('workspace_restored', this.scanCurrentWorkingDirectory);
            
            this.scanCurrentWorkingDirectory();
            loadCatalogs();
        }, 5000);
    };

    this.stop = () =>
    {
        w.removeEventListener('project_opened', this.scanCurrentWorkingDirectory);
        w.removeEventListener('current_place_opened', this.scanCurrentWorkingDirectory);
        w.removeEventListener('workspace_restored', this.scanCurrentWorkingDirectory);
        w.removeEventListener('file_saved', this.scanCurrentView);
        w.removeEventListener('folder_touched', onFolderTouched);

        prefs.removeOnChange("codeintel.catalogs.loaded", loadCatalogs);
    };

}).apply(module.exports);
