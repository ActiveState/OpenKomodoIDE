(function() {
    const log       = require("ko/logging").getLogger("commando-scope-shell-phonegap");
    const prefs     = require("ko/prefs");
    const commando  = require("commando/commando");
    const shell     = require("scope-shell/shell");
    const shellHelpers = require("scope-shell/helpers");
    const koFile    = require("ko/file");
    const w         = require("ko/windows").getMain();
    const legacy    = w.ko;

    //log.setLevel(require("ko/logging").LOG_DEBUG);
    
    var local = {menuItems: false, usingPhoneGap: null};
    
    this.register = function()
    {
        // Register the "phonegap" namespace
        shell.registerNamespace("phonegap",
        {
            command: function() { return prefs.getString("phonegapInterpreter", "phonegap") || "phonegap"; },
            description: "Mobile apps with HTML, CSS & JS",
            env: {},
            results: {
                create: {
                    description: 'Create a project',
                    placeholder: '[options] <path> [id [name [config]]]',
                    results: {}
                },
                help: {
                    description: 'Get help for a command',
                    placeholder: '[command]',
                    results: {}
                },
                build: {
                    description: 'phonegap prepare && phonegap compile',
                    placeholder: '[<platforms>] [options] [-- [platform options]]',
                    results: this.listPlatforms.bind(null, "installed")
                },
                emulate: {
                    description: 'phonegap run --emulator',
                    placeholder: '[<platforms>] [options] [-- [platform options]]',
                    results: this.listPlatforms.bind(null, "installed")
                },
                info: {
                    description: 'Generate project information',
                    placeholder: '',
                    results: {}
                },
                platform: {
                    description: 'Manage project platforms',
                    placeholder: '[command] [options]',
                    results: {
                        add: {
                            description: "add specified platforms",
                            placeholder: "<platforms>",
                            results: this.listPlatforms.bind(null, "available")
                        },
                        remove: {
                            description: "remove specified platforms",
                            placeholder: "<platforms>",
                            results: this.listPlatforms.bind(null, "installed")
                        },
                        list: {
                            description: "list all installed and available platforms"
                        },
                        update: {
                            description: "update the version of PhoneGap used for a specific platform",
                            placeholder: "<platform>",
                            results: this.listPlatforms.bind(null, "installed")
                        },
                        check: {
                            description: "list platforms which can be updated by `phonegap platform update`"
                        }
                    }
                },
                plugin: {
                    description: 'Manage project plugins',
                    placeholder: '<command>',
                    results: {
                        add: {
                            description: "add specified plugins",
                            placeholder: "<id>"
                        },
                        remove: {
                            description: "remove plugins with the given IDs",
                            placeholder: "<id>",
                            results: this.listPlugins
                        },
                        list: {
                            description: "list currently installed plugins"
                        }
                    }
                },
                prepare: {
                    description: 'Copy files into platform(s) for building',
                    placeholder: '[<platforms>] [options]',
                    results: this.listPlatforms.bind(null, "installed")
                },
                compile: {
                    description: 'Build platform(s)',
                    placeholder: '[<platforms>] [options] [-- [platform options]]',
                    results: this.listPlatforms.bind(null, "installed")
                },
                run: {
                    description: 'Run project (including prepare && compile)',
                    placeholder: '[<platforms>] [options] [-- [platform options]]',
                    results: this.listPlatforms.bind(null, "installed")
                },
                serve: {
                    description: 'Run project with a local webserver (including prepare)',
                    placeholder: '[options]'
                },
                version: {
                    description: 'output version number'
                },
                template: {
                    description: 'Create a new project from an existing template and list the templates available',
                    results: {
                        list: {
                            description: "list recommended app templates"
                        },
                        search: {
                            description: "open npmjs.com to show all templates available",
                        }
                    }
                },
                remote: {
                    description: 'Executes the command remotely using the cloud-based PhoneGap/Build service',
                    placeholder: '[command]',
                    results: {
                        login: {
                            description: "login to PhoneGap/Build",
                            command: ["login", ":ot"]
                        },
                        logout: {
                            description: "logout of PhoneGap/Build",
                        },
                        build: {
                            description: "build a specific platform",
                            placeholder: "<platform>",
                            results: this.listPlatforms.bind(null, "installed")
                        },
                        install: {
                            description: "install a specific platform",
                            placeholder: "<platform>",
                            results: this.listPlatforms.bind(null, "installed")
                        },
                        run: {
                            description: "build and install a specific platform",
                            placeholder: "<platform>",
                            results: this.listPlatforms.bind(null, "installed")
                        }
                    }
                }
            }
        });
        
        // Inject pref UI
        shellHelpers.injectInterpreterPref({
            basename: 'pref-environ.xul',
            siblingSelector: '#environ-prefs-groupbox',
            prefname: 'phonegapInterpreter',
            caption: 'PhoneGap Location'
        });
        
        var dynBtn = require("ko/dynamic-button");
        var button = dynBtn.register("PhoneGap CLI", {
            icon: "phonegap",
            menuitems: this.updateMenu.bind(this),
            menuitemsInitialize: this.updateMenuInit.bind(this),
            ordinal: 400,
            group: "buildSystems",
            groupOrdinal: 400,
            isEnabled: () =>
            {
                if (local.usingPhoneGap !== null)
                    return local.usingPhoneGap;
                
                local.usingPhoneGap = false;
                let placesPath;
                try
                {
                    placesPath = legacy.uriparse.URIToLocalPath(legacy.places.getDirectory());
                } catch(e)
                {
                    // means it's a remote dir
                    return false;
                }
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
                
                if (contents.indexOf('phonegap.com/ns/1.0') != -1)
                {
                    local.usingPhoneGap = true;
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
        local.usingPhoneGap = null;
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
                    commando.showSubscope("scope-shell", "phonegap");
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
                    commando.showSubscope("scope-shell", "phonegap");
                }
            }
        ];
        
        var placesPath = legacy.uriparse.URIToLocalPath(legacy.places.getDirectory());
        var phonegap = prefs.getString('phonegapInterpreter', 'phonegap') || 'phonegap';
        
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
                            var command = [phonegap, "emulate", platform].join(" ");
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
                            var command = [phonegap, "run", platform].join(" ");
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
                            var command = [phonegap, "build", platform].join(" ");
                            legacy.run.command(command, {cwd: placesPath});
                        }.bind(null, platform)
                    });
                }
            }
            
            callback(local.menuItems);
        });
        
    };
    
    this.listPlatforms = (type, query, callback) =>
    {
        // We only care about the first word entered
        query = query.match(/^\w+/);
        query = query ? query[0] : "";
        
        log.debug("Listing PhoneGap platforms, startkey: " + query);

        var phonegap = prefs.getString('phonegapInterpreter', 'phonegap') || 'phonegap';
        var search = require("ko/shell").run(phonegap, ["platform", "list"]);
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
        
        log.debug("Listing PhoneGap plugins, startkey: " + query);

        var phonegap = prefs.getString('phonegapInterpreter', 'phonegap') || 'phonegap';
        var search = require("ko/shell").run(phonegap, ["plugin", "list"]);
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
            "Initializing PhoneGap workspace",
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
                
                var command = [prefs.getString("phonegapInterpreter", "phonegap") || "phonegap", "create"];
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
