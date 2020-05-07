(function() {
    const log       = require("ko/logging").getLogger("commando-scope-shell-cordova");
    const prefs     = require("ko/prefs");
    const commando  = require("commando/commando");
    const shell     = require("scope-shell/shell");
    const shellHelpers = require("scope-shell/helpers");
    const url       = require("sdk/url");
    const koFile    = require("ko/file");
    const w         = require("ko/windows").getMain();
    const legacy    = w.ko;

    //log.setLevel(require("ko/logging").LOG_DEBUG);
    
    var local = {menuItems: false, usingCordova: null};
    
    this.register = function()
    {
        // Register the "cordova" namespace
        shell.registerNamespace("cordova",
        {
            command: function() { return prefs.getString("cordovaInterpreter", "cordova") || "cordova"; },
            description: "Mobile apps with HTML, CSS & JS",
            env: {},
            results: {
                create: {
                    description: 'Create a project',
                    placeholder: '<PATH> [ID [NAME [CONFIG]]] [options] [PLATFORM...]',
                    results: {}
                },
                help: {
                    description: 'Get help for a command',
                    placeholder: '[command]',
                    results: {}
                },
                build: {
                    description: 'cordova prepare && cordova compile',
                    placeholder: '[PROD] [TARGET] [EXP] [PLATS] [BUILDCONFIG] [-- POPTS]',
                    results: this.listPlatforms.bind(null, "installed")
                },
                emulate: {
                    description: 'cordova run --emulator',
                    placeholder: '[PLATFORM...] [-- [platformopts]]',
                    results: this.listPlatforms.bind(null, "installed")
                },
                info: {
                    description: 'Generate project information',
                    placeholder: '',
                    results: {}
                },
                requirements: {
                    description: 'Checks and print out all the requirements for platforms specified',
                    placeholder: '[PLATFORM ...]',
                    results: this.listPlatforms.bind(null, "installed")
                },
                platform: {
                    description: 'Manage project platforms',
                    placeholder: '<command> [options]',
                    results: {
                        add: {
                            description: "add specified platforms",
                            placeholder: "<plat-spec> [...]",
                            results: this.listPlatforms.bind(null, "available")
                        },
                        remove: {
                            description: "remove specified platforms",
                            placeholder: "<platform> [...]",
                            results: this.listPlatforms.bind(null, "installed")
                        },
                        list: {
                            description: "list all installed and available platforms"
                        },
                        update: {
                            description: "update the version of Cordova used for a specific platform",
                            placeholder: "<plat-spec>",
                            results: this.listPlatforms.bind(null, "installed")
                        },
                        check: {
                            description: "list platforms which can be updated by `cordova platform update`"
                        }
                    }
                },
                plugin: {
                    description: 'Manage project plugins',
                    placeholder: '<command> [options]',
                    results: {
                        add: {
                            description: "add specified plugins",
                            placeholder: "<pluginid>|<directory>|<giturl> [...]"
                        },
                        remove: {
                            description: "remove plugins with the given IDs",
                            placeholder: "<pluginid> [...]",
                            results: this.listPlugins
                        },
                        list: {
                            description: "list currently installed plugins"
                        },
                        search: {
                            description: "search the plugin registry for plugins matching the keywords",
                            placeholder: "[<keyword>] [...]"
                        }
                    }
                },
                prepare: {
                    description: 'Copy files into platform(s) for building',
                    placeholder: '[PLATFORM..]',
                    results: this.listPlatforms.bind(null, "installed")
                },
                compile: {
                    description: 'Build platform(s)',
                    placeholder: '[PROD] [TARGET] [EXP] [PLATS] [BUILDCONFIG] [-- POPTS]',
                    results: this.listTargets
                },
                clean: {
                    description: 'Cleanup project from build artifacts',
                    placeholder: '[PLATFORM..]',
                    results: this.listPlatforms.bind(null, "installed")
                },
                run: {
                    description: 'Run project (including prepare && compile)',
                    placeholder: '[MODE] [PROD] [TARGET] [EXP] [PLATS] [BUILDCONFIG] [-- POPTS]',
                    results: this.listTargets
                },
                serve: {
                    description: 'Run project with a local webserver (including prepare)',
                    placeholder: '[PORT]'
                }
            }
        });
        
        // Inject pref UI
        shellHelpers.injectInterpreterPref({
            basename: 'pref-environ.xul',
            siblingSelector: '#environ-prefs-groupbox',
            prefname: 'cordovaInterpreter',
            caption: 'Cordova Location'
        });
        
        var dynBtn = require("ko/dynamic-button");
        var button = dynBtn.register("Cordova CLI", {
            icon: "cordova",
            menuitems: this.updateMenu.bind(this),
            menuitemsInitialize: this.updateMenuInit.bind(this),
            ordinal: 500,
            group: "buildSystems",
            groupOrdinal: 400,
            isEnabled: () =>
            {
                if (local.usingCordova !== null)
                    return local.usingCordova;
                
                local.usingCordova = false;
                var placesPath = url.URL(legacy.places.getDirectory()).path;
                var path = koFile.join(placesPath, "config.xml");
                if ( ! koFile.exists(path))
                    return false;
                
                var contents;
                try {
                    contents = koFile.read(path);
                }
                catch (e)
                {
                    log.warn(`Failed opening ${path}`);
                    return false;
                }
                
                if (contents.indexOf('cordova.apache.org') != -1)
                {
                    local.menuItems = null;
                    local.usingCordova = true;
                    return true;
                }
                
                return false;
            }
        });
        
        w.addEventListener('workspace_restored', this.reload.bind(this));
        w.addEventListener('project_opened', this.reload.bind(this));
        w.addEventListener('current_place_opened', this.reload.bind(this));
        
        // Check for changes when source file is modified
        require("ko/filestatus").monitor((urllist) =>
        {
            var koFile = require("ko/file");
            for (let url of urllist)
            {
                if (koFile.basename(url) == "config.xml")
                {
                    this.reload();
                    button.update();
                    return; // no need to check the rest
                }
            }
        });
    };
    
    this.reload = function ()
    {
        local.usingCordova = null;
        local.menuItems = false;
    };
    
    this.updateMenuInit = function()
    {
        return [
            {
                label: "Create",
                command: this.createProject
            },
            {
                label: "Run Command ..",
                command: () => {
                    commando.showSubscope("scope-shell", "cordova");
                }
            }
        ];
    };
    
    this.updateMenu = function (callback)
    {
        if (local.menuItems)
            return local.menuItems;
        
        local.menuItems = [
            {
                label: "Run Command ..",
                command: () => {
                    commando.showSubscope("scope-shell", "cordova");
                }
            }
        ];
        
        var placesPath = url.URL(legacy.places.getDirectory()).path;
        var cordova = prefs.getString('cordovaInterpreter', 'cordova') || 'cordova';
        
        this.listPlatforms("installed", "", (entries) =>
        {
            if (Object.keys(entries).length)
            {
                local.menuItems.push(null);
                for (let platform of Object.keys(entries))
                {
                    local.menuItems.push({
                        label: "Emulate " + platform,
                        command: function(platform) {
                            var command = [cordova, "emulate", platform].join(" ");
                            legacy.run.command(command, {cwd: placesPath});
                        }.bind(null, platform)
                    });
                }
                
                local.menuItems.push(null);
                for (let platform of Object.keys(entries))
                {
                    local.menuItems.push({
                        label: "Run " + platform,
                        command: function(platform) {
                            var command = [cordova, "run", platform].join(" ");
                            legacy.run.command(command, {cwd: placesPath});
                        }.bind(null, platform)
                    });
                }
                
                local.menuItems.push(null);
                for (let platform of Object.keys(entries))
                {
                    local.menuItems.push({
                        label: "Build " + platform,
                        command: function(platform) {
                            var command = [cordova, "build", platform].join(" ");
                            legacy.run.command(command, {cwd: placesPath});
                        }.bind(null, platform)
                    });
                }
            }
            
            callback(local.menuItems);
        });
        
    };
    
    this.listTargets = (query, callback) =>
    {
        // We only care about the first word entered
        query = query.match(/^\w+/);
        query = query ? query[0] : "";
        
        log.debug("Listing Cordova targets, startkey: " + query);

        var cordova = prefs.getString('cordovaInterpreter', 'cordova') || 'cordova';
        var search = require("ko/shell").run(cordova, ["run", "--list"]);
        search.on('complete', function (stdout)
        {
            var result = {};
            var entries = stdout.trim().split(/\r|\n/);
            var category = "";
            
            for (let entry of entries)
            {
                entry = entry.trim();
                let _category = entry.match(/available\s+(.*?):/i);
                if (_category)
                    category = _category[1].substr(0, _category[1].length-1);
                if (entry.match(/\s/))
                    continue;
                
                result[entry] = { description: category, command: `--target=${entry}`};
            }
            callback(result);
        });
    };
    
    this.listPlatforms = (type, query, callback) =>
    {
        // We only care about the first word entered
        query = query.match(/^\w+/);
        query = query ? query[0] : "";
        
        log.debug("Listing Cordova platforms, startkey: " + query);

        var cordova = prefs.getString('cordovaInterpreter', 'cordova') || 'cordova';
        var search = require("ko/shell").run(cordova, ["platform", "list"]);
        search.on('complete', function (stdout)
        {
            var result = {};
            var entries = stdout.trim().split(/\r|\n/);
            
            for (let entry of entries)
            {
                entry = entry.trim();
                
                if (entry.toLowerCase().indexOf(type) !== 0)
                    continue;
                
                let platforms = entry.split(":").pop().split(",");
                for (let platform of platforms)
                {
                    let [name, version] = platform.trim().split(" ");
                    version = version || "";
                    result[name.trim()] = { description: version.trim() };
                }
                
                break;
            }
            callback(result);
        });
    };
    
    this.listPlugins = (query, callback) =>
    {
        // We only care about the first word entered
        query = query.match(/^\w+/);
        query = query ? query[0] : "";
        
        log.debug("Listing Cordova plugins, startkey: " + query);

        var cordova = prefs.getString('cordovaInterpreter', 'cordova') || 'cordova';
        var search = require("ko/shell").run(cordova, ["plugin", "list"]);
        search.on('complete', function (stdout)
        {
            var result = {};
            var entries = stdout.trim().split(/\r|\n/);
            
            for (let entry of entries)
            {
                entry = entry.trim().split(/\s+/);
                if (entry.length != 3)
                    continue;
                
                let [id, version, name] = entry;
                result[name.replace(/"/g,'')] = { description: `${id} ${version}`, command: id };
            }
            
            callback(result);
        });
    };
    
    this.createProject = () =>
    {
        var koShell = require("scope-shell/shell");

        var shell = koShell.getShell(false);

        var env     = shell.env;
        var options = shell.options;

        require("ko/modal").open(
            "Initializing Cordova workspace",
            {
                id: {
                    label: "ID"
                },
                name: {
                    label: "Name"
                },
                path: {
                    label: "Path",
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
                
                var command = [prefs.getString("cordovaInterpreter", "cordova") || "cordova", "create"];
                command = command.concat([data.path, data.id, `"${data.name}"`]);
                var process = require("ko/shell").exec(command.join(" "), options);

                process.on('close', (code, signal) =>
                {
                    if (code !== 0)
                        return;

                    require("ko/dom")("panel.shell-output").element().hidePopup();

                    var path = require("ko/file").join(data.path, "config.xml");
                    legacy.open.URI(legacy.uriparse.pathToURI(path));
                    
                    this.reload();
                    w.dispatchEvent(new w.CustomEvent("update_dynamic_buttons"));
                });
            }
        );
    };
    

}).apply(module.exports);
