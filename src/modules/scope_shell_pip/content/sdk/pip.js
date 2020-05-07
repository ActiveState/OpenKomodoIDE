(function() {
    const log       = require("ko/logging").getLogger("commando-scope-shell-pip")
    const commando  = require("commando/commando");
    const {Cc, Ci}  = require("chrome");
    const prefs     = require("ko/prefs");
    const shell     = require("scope-shell/shell");
    const shellHelpers = require("scope-shell/helpers");
    const w         = require("ko/windows").getMain();
    const legacy    = w.ko;
    const $         = require("ko/dom");
    const koFile    = require("ko/file");

    //log.setLevel(require("ko/logging").LOG_DEBUG);
    var local = {};

    this.register = function()
    {
        // Register the "pip" namespace
        shell.registerNamespace("pip",
        {
            command: function() { return prefs.file().getString("pipDefaultInterpreter", "pip") || "pip" },
            description: "The PyPA recommended tool for installing Python packages (Python 2)",
            env: {},
            results: {
                install: {
                    description: "Install packages",
                    results: this.searchInstall.bind(this, "pip"),
                    weight: 10
                },
                uninstall: {
                    description: "Uninstall packages",
                    command: "uninstall -y",
                    results: this.listInstalled.bind(this, "pip"),
                    weight: 10
                },
                freeze: { description: "Output installed packages in requirements format" },
                list: { description: "List installed packages" },
                show: { description: "Show information about installed packages" },
                search: { description: "Search PyPI for packages" },
                wheel: { description: "Build wheels from your requirements" },
                help: { description: "Show help for commands" }
            }
        });

        shell.registerNamespace("pip3",
        {
            command: function() { return prefs.file().getString("pip3DefaultInterpreter", "pip3") || "pip3" },
            description: "The PyPA recommended tool for installing Python packages (Python 3)",
            env: {},
            results: {
                install: {
                    description: "Install packages",
                    results: this.searchInstall.bind(this, "pip3"),
                    weight: 10
                },
                uninstall: {
                    description: "Uninstall packages",
                    command: "uninstall -y",
                    results: this.listInstalled.bind(this, "pip3"),
                    weight: 10
                },
                freeze: { description: "Output installed packages in requirements format" },
                list: { description: "List installed packages" },
                show: { description: "Show information about installed packages" },
                search: { description: "Search PyPI for packages" },
                wheel: { description: "Build wheels from your requirements" },
                help: { description: "Show help for commands" }
            }
        });

        // Inject pref UI
        shellHelpers.injectInterpreterPref({
            basename: 'pref-python.xul',
            siblingSelector: '#defaultPythonInterpreterGroupBox',
            prefname: 'pipDefaultInterpreter',
            caption: 'Pip Location'
        });

        shellHelpers.injectInterpreterPref({
            basename: 'pref-python3.xul',
            siblingSelector: '#defaultPython3InterpreterGroupBox',
            prefname: 'pip3DefaultInterpreter',
            caption: 'Pip Location'
        });

        var dynBtn = require("ko/dynamic-button");
        local.button = dynBtn.register("Pip", {
            icon: "python",
            menuitems: this.updateMenu,
            menuitemsInitialize: this.updateMenu,
            ordinal: 100,
            group: "packageManagers",
            groupOrdinal: 400,
            events: ["current_place_opened", "project_opened", "workspace_restored", "process_close"],
            isEnabled: () =>
            {
                let placesPath;
                try
                {
                    placesPath = legacy.uriparse.URIToLocalPath(legacy.places.getDirectory());
                } catch(e)
                {
                    // means it's a remote dir
                    return false;
                }

                var path = koFile.join(placesPath, "requirements.txt");
                if (koFile.exists(path))
                    return true;

                path = koFile.join(placesPath, "setup.py");
                if (koFile.exists(path))
                    return true;

                return false;
            }
        });
    }

    this.updateMenu = () =>
    {
        var suffix = getPipSuffix();
        return [
            {
                label: `Initialize`,
                command: this.initializePackage
            },
            {
                label: `Install Package`,
                command: function() {
                    commando.showSubscope("scope-shell", "pip"+suffix, `pip${suffix}install`);
                }
            },
            {
                label: "Run Command ..",
                command: () => {
                    commando.showSubscope("scope-shell", "pip"+suffix);
                }
            }
        ];
    }

    this.initializePackage = () =>
    {
        var koShell = require("scope-shell/shell");

        var shell = koShell.getShell(false);

        var env     = shell.env;
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
            "Where do you want to initialize a new requirements.txt?",
            {
                path: {
                    type: "filepath",
                    options: { filetype: "dir" },
                    value: path
                }
            },
            (data) =>
            {
                if ( ! data)
                    return;

                var path = koFile.join(data.path, "requirements.txt");

                if (koFile.exists(path))
                {
                    require("ko/dialogs").alert("requirements.txt already exists at " + data.path);
                    return;
                }
                koFile.create(path);
                legacy.open.URI(legacy.uriparse.pathToURI(path));

                w.dispatchEvent(new w.CustomEvent("update_dynamic_buttons"));
            }
        );
    };
    
    // Search through installed modules
    this.searchInstall = function(pip, query, callback)
    {
        // We only care about the first word entered
        query = query.match(/^\w+/)
        query = query ? query[0] : "komodo";
        
        log.debug("Searching Pip packages, startkey: " + query);
        
        pip = prefs.file().getString(pip + 'DefaultInterpreter', pip) || pip;
        var shell = require("ko/shell");
        var search = shell.run(pip, ['search', query]);
        var result = {};
        
        // Update the result object whenever we receive data
        search.stdout.on('data', function (data)
        {
            var entry, rx = /([0-9a-zA-Z-_.]+)\s+-\s(.*)/g;
            while (entry = rx.exec(data))
            {
                result[entry[1]] = {
                    description: entry[2]
                };
            }
        });
        
        // Log errors, not much else we can (or should) do though
        // the result object can just return as empty, or partial
        search.stderr.on('data', function (data)
        {
            log.error('Error while running `pip search`', true);
            log.error(data, true);
        });
        
        // Process finished, time to return results
        search.on('close', function (code)
        {
            log.debug('child process exited with code ' + code);
            
            callback(result);
        });
    }
    
    // List installed modules
    this.listInstalled = function(pip, query, callback)
    {
        // We only care about the first word entered
        query = query.match(/^\w+/)
        query = query ? query[0] : null;
        
        log.debug("Searching Installed Pip packages, startkey: " + query);
        
        pip = prefs.file().getString(pip + 'DefaultInterpreter', pip) || pip;
        
        var shell = require("ko/shell");
        var search = shell.run(pip, ['list']);
        var result = {};
        
        // Update the result object whenever we receive data
        search.stdout.on('data', function (data)
        {
            var entry, rx = /([0-9a-zA-Z-_.]+)\s+\(([0-9a-zA-Z-_.]+)\)/g;
            while (entry = rx.exec(data))
            {
                result[entry[1]] = {
                    description: entry[2]
                };
            }
        });
        
        // Log errors, not much else we can (or should) do though
        // the result object can just return as empty, or partial
        search.stderr.on('data', function (data)
        {
            log.error('Error while running `pip show`', true);
            log.error(data, true);
        });
        
        // Process finished, time to return results
        search.on('close', function (code)
        {
            log.debug('child process exited with code ' + code);
            
            callback(result);
        });
    }
    
    var getPipSuffix = () =>
    {
        var suffix;
        var language = prefs.project().getString("projectLanguage");
        if (language == "Python")
            suffix = "2";
        else if (language == "Python3")
            suffix = "3";

        return suffix || "";
    }

    var getPipInterpreter = () =>
    {
        var interpreter = "pip";
        var suffix = getPipSuffix();
        interpreter += suffix;

        return prefs.file().getString(interpreter + "DefaultInterpreter", interpreter) || interpreter;
    };
    

}).apply(module.exports);
