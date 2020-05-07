(function() {
    const log       = require("ko/logging").getLogger("commando-scope-shell-cpanm")
    const commando  = require("commando/commando");
    const {Cc, Ci}  = require("chrome");
    const prefs     = require("ko/prefs");
    const shell     = require("scope-shell/shell");
    const shellHelpers = require("scope-shell/helpers");
    const w         = require("ko/windows").getMain();
    const legacy    = w.ko;
    const koFile = require("ko/file");

    //log.setLevel(require("ko/logging").LOG_DEBUG);
    var local = {running: false, menuItems: null};

    this.register = function()
    {
        // Register the "cpanm" namespace
        shell.registerNamespace("cpanm",
        {
            command: function() { return prefs.file().getString("cpanmDefaultInterpreter", "cpanm") || "cpanm" },
            description: "Get, unpack build and install modules from CPAN (Perl)",
            env: {},
            results: {
                install: {
                    command: "",
                    results: this.searchInstall
                },
                uninstall: {
                    command: "--uninstall",
                    results: this.listInstalled
                }
            }
        });
        
        // Inject pref UI
        shellHelpers.injectInterpreterPref({
            basename: 'pref-perl.xul',
            siblingSelector: '#defaultPerlInterpreterGroupBox',
            prefname: 'cpanmDefaultInterpreter',
            caption: 'cpanm Location'
        });
        
        shellHelpers.injectInterpreterPref({
            basename: 'pref-perl.xul',
            siblingSelector: '#defaultPerlInterpreterGroupBox',
            prefname: 'cpanDefaultInterpreter',
            caption: 'cpan Location'
        });
        
        
        var dynBtn = require("ko/dynamic-button");
        local.button = dynBtn.register("Cpanm", {
            icon: "perl",
            menuitems: this.updateMenu,
            menuitemsInitialize: this.updateMenu,
            ordinal: 100,
            group: "packageManagers",
            groupOrdinal: 400,
            events: ["current_place_opened", "project_opened", "workspace_restored", "process_close"],
            isEnabled: () =>
            {
                local.menuItems = null;
                let placesPath;
                try
                {
                    placesPath = legacy.uriparse.URIToLocalPath(legacy.places.getDirectory());
                } catch(e)
                {
                    // means it's a remote dir
                    return false;
                }

                var path = koFile.join(placesPath, "cpanfile");
                return koFile.exists(path);
            }
        });

    };
    
    this.updateMenu = () =>
    {
        if (local.menuItems)
            return local.menuItems;
        
        local.menuItems = [
            {
                label: `Initialize`,
                command: this.initializePackage
            },
            {
                label: `Install Package`,
                command: function() {
                    commando.showSubscope("scope-shell", "cpanm", "install");
                }
            },
            {
                label: "Run Command ..",
                command: () => {
                    commando.showSubscope("scope-shell", "cpanm");
                }
            }
        ];
        
        return local.menuItems;
    };
    
    this.initializePackage = () =>
    {
        var koShell = require("scope-shell/shell");

        var shell = koShell.getShell(false);

        var options = shell.options;
        var path;

        try
        {
            path = legacy.uriparse.URIToLocalPath(legacy.places.getDirectory());
        } catch(e)
        {
            path = koShell.getCwd();
        }

        require("ko/modal").open(
            "Where do you want to initialize a new `cpanfile` file?",
            {
                path: {
                    label: "Path",
                    type: "filepath",
                    options: { filetype: "dir" },
                    value: path
                }
            },
            (data) =>
            {
                if ( ! data)
                    return;

                options.cwd = data.path;
                filePath = koFile.join(data.path, "cpanfile");
                if( ! koFile.exists(filePath))
                    koFile.create(data.path,"cpanfile");
                legacy.open.URI(legacy.uriparse.pathToURI(filePath));
                w.dispatchEvent(new w.CustomEvent("update_dynamic_buttons"));
            }
        );
    };
    
    // Search through installed modules
    this.searchInstall = function(query, callback)
    {
        // We only care about the first word entered
        query = query.match(/^\w+/);
        query = query ? query[0] : "perl";
        
        log.debug("Searching CPAN packages, startkey: " + query);
        
        // CPAN doesnt have a CLI search method, and cpanmeta is horribly convoluted
        // so I'm using the old search.cpan.org xml interface, which is said to
        // not be supported, so this is not an ideal solution but will have to do
        // until more time can be spend on this
        // TODO: Spend more time on this!
        var ajax = require("ko/ajax");
        var url = "http://search.cpan.org/search?mode=module&format=xml&query=" + encodeURIComponent(query);
        ajax.get(url, function(code, responseText)
        {
            if (code != 200)
            {
                log.error("cpan search responded with code " + code, false);
                return callback();
            }
            
            var parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);;
            var dom = parser.parseFromString(responseText, "text/xml");
            if (dom.documentElement.nodeName == "parsererror")
            {
                log.error("Failed to parse cpan search XML response", false);
                return callback()
            }
            
            var result = {};
            var modules = dom.querySelectorAll("module");
            for (let module of modules)
            {
                let name = module.querySelector("name").textContent;
                let description = module.querySelector("description");
                result[name] = {description: description ? description.textContent : null};
            }
            callback(result);
        });
    }
    
    // List installed modules
    this.listInstalled = function(query, callback)
    {
        var cpan = prefs.file().getString('cpanDefaultInterpreter', 'cpan') || 'cpan';
        
        var shell = require("ko/shell");
        var search = shell.run(cpan, ['-l']);
        var result = {};
        
        // Update the result object whenever we receive data
        search.stdout.on('data', function (data)
        {
            var entries = data.split(/\r|\n/);
            for (let entry of entries)
            {
                entry = entry.match(/^([0-9a-zA-Z-_.:]+)\s+([0-9a-zA-Z-_.]+)$/)
                if ( ! entry) continue;
                result[entry[1]] = {description: entry[2]};
            }
        });
        
        // Log errors, not much else we can (or should) do though
        // the result object can just return as empty, or partial
        search.stderr.on('data', function (data)
        {
            log.debug('Error while running `cpan -l`');
            log.debug(data);
        });
        
        // Process finished, time to return results
        search.on('close', function (code)
        {
            log.debug('child process exited with code ' + code);
            
            callback(result);
        });
    }

}).apply(module.exports);
