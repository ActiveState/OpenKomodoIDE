(function() {
    const log       = require("ko/logging").getLogger("commando-scope-shell-npm")
    const commando  = require("commando/commando");
    const {Cc, Ci}  = require("chrome");
    const prefs     = require("ko/prefs");
    const shell     = require("scope-shell/shell");
    const shellHelpers = require("scope-shell/helpers");
    const koFile    = require("ko/file");
    const w         = require("ko/windows").getMain();
    const legacy    = w.ko;
    
    const fileWatcher = Cc["@activestate.com/koFileNotificationService;1"].getService(Ci.koIFileNotificationService);

    //log.setLevel(require("ko/logging").LOG_DEBUG);
    
    var local = {running: false, menuItems: false};
    
    this.register = function()
    {
        // Register the "npm" namespace
        shell.registerNamespace("npm",
        {
            command: function() { return "\""+prefs.file().getString("npmDefaultInterpreter", "npm")+"\"" || "npm"; },
            description: "A package manager for JavaScript, and the default for Node.js",
            env: {},
            results: [
                {
                    command: "install",
                    results: this.searchInstall,
                    weight: 10
                },
                {
                    command: "uninstall",
                    results: this.listInstalled,
                    weight: 10
                },
                {
                    command: ["init", ":ot"],
                },
                "adduser","bin","bugs","completion","dedupe","deprecate","docs","faq","get",
                "help","help-search","link","ls","outdated","pack","prefix","prune",
                "publish","rebuild","repo","restart","root","run-script","search",
                "set","shrinkwrap","star","unstar ","stars","start","stop","submodule",
                "tag","test","unpublish","update","version","view","whoami","npm",
                {
                    command: "cache",
                    results: [
                        "add",
                        "ls",
                        "clean"
                    ]
                },
                {
                    command: "config",
                    results: [
                        "set",
                        "get",
                        "delete",
                        "list",
                        "edit"
                    ]
                },
                {
                    command: "owner",
                    results: [
                        "add",
                        "rm",
                        "ls"
                    ]
                }
            ]
        });
        
        // Inject pref UI
        shellHelpers.injectInterpreterPref({
            basename: 'pref-nodejs.xul',
            siblingSelector: '#defaultNodejsInterpreterGroupBox',
            prefname: 'npmDefaultInterpreter',
            caption: 'NPM Location'
        });
        
        var dynBtn = require("ko/dynamic-button");
        local.button = dynBtn.register("Node Package Manager", {
            icon: "npm",
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
                var path = koFile.join(placesPath, "node_modules");
                var isEnabled = koFile.exists(path);
                if (isEnabled)
                    return true;
                
                path = koFile.join(placesPath, "package.json");
                isEnabled = koFile.exists(path);
                return isEnabled;
            }
        });
        
        w.addEventListener('workspace_restored', this.reload.bind(this));
        w.addEventListener('project_opened', this.reload.bind(this));
        
        // Check for changes when source file is modified
        require("ko/filestatus").monitor(function(urllist)
        {
            var koFile = require("ko/file");
            for (let url of urllist)
            {
                if (koFile.basename(url) == "package.json")
                {
                    local.button.update();
                    return; // no need to check the rest
                }
            }
        });
    }
    
    this.reload = function ()
    {
        local.menuItems = false;
    }
    
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
                    commando.showSubscope("scope-shell", "npm", "npminstall");
                }
            },
            {
                label: "Run Command ..",
                command: () => {
                    commando.showSubscope("scope-shell", "npm");
                }
            }
        ];
        
        var placesPath = legacy.uriparse.URIToLocalPath(legacy.places.getDirectory());
        var path = koFile.join(placesPath, "package.json");
        
        if ( ! koFile.exists(path))
            return local.menuItems;
        
        try {
            var contents = JSON.parse(koFile.read(path));
        }
        catch (e)
        {
            log.warn(`Failed parsing ${path}`);
            return local.menuItems;
        }
        
        if ("scripts" in contents)
        {
            local.menuItems.push(null); // separator
            var npm = "\""+prefs.file().getString("npmDefaultInterpreter", "npm")+"\"";
            
            for (let k in contents.scripts)
            {
                if ( ! contents.scripts.hasOwnProperty(k))
                    continue;
                
                local.menuItems.push({
                    label: `Script: ${k}`,
                    acceltext: contents.scripts[k],
                    command: function (script) {
                        var command = [npm, script].join(" ");
                        legacy.run.command(command, {cwd: placesPath});
                    }.bind(this, k)
                });
            }
        }
        
        return local.menuItems;
    }
    
    this.initializePackage = () =>
    {
        var koShell = require("scope-shell/shell");

        var shell = koShell.getShell(false);

        var env     = shell.env;
        var options = shell.options;

        require("ko/modal").open(
            "Where do you want to initialize a new package.json?",
            {
                path: {
                    type: "filepath",
                    options: { filetype: "dir" },
                    value: koShell.getCwd()
                }
            },
            (data) =>
            {
                if ( ! data)
                    return;

                options.cwd = data.path;
                
                var command = [prefs.getString("npmDefaultInterpreter", "npm") || "npm", "init", "-f"];
                var process = require("ko/shell").exec(command.join(" "), options);

                process.on('close', function (code, signal)
                {
                    if (code !== 0)
                        return;

                    require("ko/dom")("panel.shell-output").element().hidePopup();

                    var path = require("ko/file").join(data.path, "package.json");
                    legacy.open.URI(legacy.uriparse.pathToURI(path));
                    
                    w.dispatchEvent(new w.CustomEvent("update_dynamic_buttons"));
                });
            }
        );
    };
    
    // Search through installed modules
    this.searchInstall = function(query, callback)
    {
        // We only care about the first word entered
        query = query.match(/^\w+/)
        query = query ? query[0] : "komodo";
        
        log.debug("Searching NPM packages, startkey: " + query);
        
        // npm search is broken and slow, we're working around this by talking
        // straight to their database endpoint
        var ajax = require("ko/ajax");
        var url = "https://skimdb.npmjs.com/registry/_all_docs?limit=100&startkey=%22"+encodeURIComponent(query)+"%22";
        ajax.get(url, function(code, responseText)
        {
            if (code != 200) return;
            
            var result = {};
            var entries = JSON.parse(responseText);
            for (let row of entries.rows)
            {
                result[row.key] = {};
            }
            
            callback(result);
        });
    }
    
    // List installed modules
    this.listInstalled = function(query, callback)
    {
        var npm = prefs.file().getString('npmDefaultInterpreter', 'npm') || 'npm';
        
        var shell = require("ko/shell");
        var search = shell.run(npm, ['ls', '--depth=0']);
        var result = {};
        
        // Update the result object whenever we receive data
        search.stdout.on('data', function (data)
        {
            var entries = data.match(/─ .+(?:\r|\n|$)/g);
            if ( ! entries)
                return;
            
            for (let x=0;x<entries.length;x++)
            {
                let entry = entries[x].substr(1).trim(); 
                let [name, version] = entry.split('@');
                result[entry] = {command: name};
            }
        });
        
        
        // Log errors, not much else we can (or should) do though
        // the result object can just return as empty, or partial
        search.stderr.on('data', function (data)
        {
            log.error('Error while running `npm ls`');
            log.error(data);
        });
        
        // Process finished, time to return results
        search.on('close', function (code)
        {
            local.running = false;
            log.debug('child process exited with code ' + code);
            
            callback(result);
        });
    }

}).apply(module.exports);
