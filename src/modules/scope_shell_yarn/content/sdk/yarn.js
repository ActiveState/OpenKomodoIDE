(function() {
    const log       = require("ko/logging").getLogger("commando-scope-shell-yarn");
    const commando  = require("commando/commando");
    const {Cc, Ci}  = require("chrome");
    const prefs     = require("ko/prefs");
    const shell     = require("scope-shell/shell");
    const shellHelpers = require("scope-shell/helpers");
    const koFile    = require("ko/file");
    const w         = require("ko/windows").getMain();
    const legacy    = w.ko;

    //log.setLevel(require("ko/logging").LOG_DEBUG);
    
    var local = {running: false, menuItems: false};
    
    this.register = function()
    {
        // Register the "yarn" namespace
        shell.registerNamespace("yarn",
        {
            command: function() { return prefs.file().getString("yarnDefaultInterpreter", "yarn") || "yarn"; },
            description: "A package manager for JavaScript, and the default for Node.js",
            env: {},
            results: {
                add: {
                    description: "adds a package to use in your current package",
                    placeholder: "[packages ...] [flags]",
                    results: this.searchInstall,
                    weight: 10
                },
                init: {
                    command: ["init", ":ot"],
                    description: "Initializes the development of a package",
                    placeholder: "[flags]",
                    weight: 10
                },
                publish: {
                    description: "Publishes a package to a package manager",
                    placeholder: "[<tarball>|<folder>] [--tag <tag>] [--access <public|restricted>]",
                    weight: 10
                },
                remove: {
                    description: "Publishes a package to a package manager",
                    placeholder: "[packages ...] [flags]",
                    results: this.listInstalled,
                    weight: 10
                },
                access: {
                    placeholder: "[public|restricted|grant|revoke|ls-packages|ls-collaborators|edit] [flags]",
                },
                bin: {
                    description: "Displays the location of the yarn bin folder",
                },
                cache: {
                    placeholder: "[ls|dir|clean] [flags]",
                    results: {
                        ls: {
                            description: "Print out every cached package",
                            placeholder: "[flags]"
                        },
                        dir: {
                            description: "Print out the path where yarn's global cache is currently stored",
                            placeholder: "[flags]"
                        },
                        clean: {
                            description: "Clear the local cache, it will be populated again the next time yarn or yarn install is run",
                            placeholder: "[flags]"
                        }
                    }
                },
                check: {
                    description: "Verifies that versions of the package dependencies in the current project's package.json matches that of yarn's lock file",
                    placeholder: "[flags]"
                },
                clean: {
                    description: "Cleans and removes unnecessary files from package dependencies",
                    placeholder: "[flags]"
                },
                config: {
                    description: "Manages the yarn configuration files",
                    placeholder: "[set|get|delete|list] [flags]",
                    results: {
                        set: {
                            description: "Sets the config key to a certain value",
                            placeholder: "<key> <value> [-g|--global] [flags]"
                        },
                        get: {
                            description: "Echoes the value for a given key",
                            placeholder: "<key> [flags]"
                        },
                        delete: {
                            description: "Deletes a given key from the config",
                            placeholder: "<key> [flags]"
                        },
                        list: {
                            description: "Displays the current configuration",
                            placeholder: "[flags]"
                        },
                    }
                },
                "generate-lock-entry": {
                    description: "Generates a lock file entry",
                    placeholder: "[flags]"
                },
                global: {
                    description: "Install packages globally on your operating system",
                    placeholder: "[add|bin|ls|remove|upgrade] [flags]",
                    results: {
                        add: {
                            description: "adds a package to use in your current package",
                            placeholder: "[packages ...] [flags]",
                            results: this.searchInstall,
                            weight: 10
                        },
                        bin: {
                            description: "Displays the location of the yarn bin folder",
                        },
                        remove: {
                            description: "Publishes a package to a package manager",
                            placeholder: "[packages ...] [flags]",
                            results: this.listInstalled,
                            weight: 10
                        },
                        ls: {
                            description: "List installed packages",
                            placeholder: "[flags]",
                        },
                        upgrade: {
                            description: "Upgrades packages to their latest version based on the specified range",
                            placeholder: "[package[@version|@tag]] [flags]",
                        },
                    }
                },
                info: {
                    description: "Show information about a package",
                    placeholder: "<package> [<field>] [flags]"
                },
                licenses: {
                    description: "List licenses for installed packages",
                    placeholder: "[ls|generate-disclaimer] [flags]",
                    results: {
                        ls: {
                            description: "List licenses for installed packages",
                            placeholder: "[flags]"
                        },
                        "generate-disclaimer": {
                            description: "return a sorted list of licenses from all the packages you have installed",
                            placeholder: "[flags]"
                        }
                    }
                },
                link: {
                    description: "Symlink a package folder during development",
                    placeholder: "[package...] [flags]"
                },
                login: {
                    description: "Store registry username and email",
                    placeholder: "[flags]"
                },
                logout: {
                    description: "Clear registry username and email",
                    placeholder: "[flags]"
                },
                ls: {
                    description: "List installed packages",
                    placeholder: "[flags]",
                },
                outdated: {
                    description: "Checks for outdated package dependencies",
                    placeholder: "[package...] [flags]"
                },
                owner: {
                    description: "Manage package owners",
                    placeholder: "[add|rm|ls] [flags]",
                    results: {
                        ls: {
                            description: "Lists all of the owners of a <package>",
                            placeholder: "<package> [flags]"
                        },
                        add: {
                            description: "Adds the <user> as an owner of the <package>",
                            placeholder: "<user> <package> [flags]"
                        },
                        rm: {
                            description: "Removes the <user> as an owner of the <package>",
                            placeholder: "<user> <package> [flags]"
                        },
                    }
                },
                pack: {
                    description: "Creates a compressed gzip archive of package dependencies",
                    placeholder: "[flags]"
                },
                run: {
                    description: "Runs a defined package script",
                    placeholder: "[script] [-- <args>]",
                    results: this.listScripts
                },
                "self-update": {
                    description: "Update Yarn to the latest available version",
                    placeholder: "[flags]"
                },
                tag: {
                    description: "Add, remove, or list tags on a package",
                    placeholder: "[add|rm|ls] [flags]",
                    results: {
                        add: {
                            description: "Add a tag named <tag> for a specific <version> of a <package>",
                            placeholder: "<package>@<version> <tag> [flags]",
                            results: this.listInstalled
                        },
                        remove: {
                            description: "Remove a tag named <tag> from a <package> that is no longer in use",
                            placeholder: "<package> <tag> [flags]",
                            results: this.listInstalled
                        },
                        ls: {
                            description: "List all of the tags for a <package>",
                            placeholder: "<package> [flags]",
                            results: this.listInstalled
                        },
                    }
                },
                team: {
                    description: "Manage teams in organizations, and change team memberships",
                    placeholder: "[create|destroy|add|rm|ls] [flags]",
                    results: {
                        create: {
                            description: "Create a new team",
                            placeholder: "<scope:team> [flags]"
                        },
                        destroy: {
                            description: "Destroys an existing team",
                            placeholder: "<scope:team> [flags]"
                        },
                        add: {
                            description: "Add a user to an existing team",
                            placeholder: "<scope:team> <user> [flags]"
                        },
                        rm: {
                            description: "Remove a user from a team they belong to",
                            placeholder: "<scope:team> <user> [flags]"
                        },
                        ls: {
                            description: "If performed on an organization name, will return a list of existing teams under that organization. If performed on a team, it will instead return a list of all users belonging to that particular team.",
                            placeholder: "<scope>|<scope:team> [flags]"
                        },
                    }
                },
                unlink: {
                    description: "Unlink a previously created symlink for a package",
                    placeholder: "[package] [flags]",
                    results: this.listInstalled
                },
                upgrade: {
                    description: "Upgrades packages to their latest version based on the specified range",
                    placeholder: "[package[@version|@tag]] [flags]",
                    results: this.listInstalled
                },
                "upgrade-interactive": {
                    description: "Interactively upgrades packages to their latest version based on the specified range",
                    placeholder: "[package[@version|@tag]] [flags]",
                    results: this.listInstalled
                },
                version: {
                    description: "Updates the package version",
                    placeholder: "[flags]"
                },
                versions: {
                    description: "Get versions of installed packages",
                    placeholder: "[flags]"
                },
                why: {
                    description: "Show information about why a package is installed",
                    placeholder: "<query> [flags]",
                    results: this.listInstalled
                },
            }
        });
            
        // Inject pref UI
        shellHelpers.injectInterpreterPref({
            basename: 'pref-nodejs.xul',
            siblingSelector: '#defaultNodejsInterpreterGroupBox',
            prefname: 'yarnDefaultInterpreter',
            caption: 'Yarn Location'
        });
        
        var dynBtn = require("ko/dynamic-button");
        var button = dynBtn.register("Yarn Package Manager", {
            icon: "yarn",
            menuitems: this.updateMenu,
            menuitemsInitialize: this.updateMenu,
            ordinal: 100,
            group: "packageManagers",
            groupOrdinal: 400,
            isEnabled: () =>
            {
                local.menuItems = null;
                var placesPath = shell.getCwd();
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
                    button.update();
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
                label: "Initialize",
                command: this.initializePackage
            },
            {
                label: `Add Package`,
                command: function() {
                    commando.showSubscope("scope-shell", "yarn", "yarnadd");
                }
            },
            {
                label: "Run Command ..",
                command: () => {
                    commando.showSubscope("scope-shell", "yarn");
                }
            }
        ];
        
        this.listScripts(null, (scripts) =>
        {
            if ( ! scripts)
                return;
            
            local.menuItems.push(null); // separator
            var yarn = prefs.file().getString("yarnDefaultInterpreter", "yarn") || "yarn";
            
            for (let script in scripts)
            {
                local.menuItems.push({
                    label: `Script: ${script}`,
                    acceltext: scripts[script].description,
                    command: function (script) {
                        var command = [yarn, script].join(" ");
                        legacy.run.command(command, {cwd: placesPath});
                    }.bind(this, script)
                });
            }
        });
        
        return local.menuItems;
    };

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
                
                var command = [prefs.getString("npmDefaultInterpreter", "yarn") || "yarn", "init", "-y"];
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
    
    this.listScripts = function(query, callback)
    {
        var placesPath = shell.getCwd();
        var path = koFile.join(placesPath, "package.json");
        
        if ( ! koFile.exists(path))
            return callback();
        
        var contents;
        try {
            contents = JSON.parse(koFile.read(path));
        }
        catch (e)
        {
            log.warn(`Failed parsing ${path}`);
            return callback();
        }
        
        if (query)
        {
            query = query.match(/^\w+/);
            query = query ? query[0] : "";
        }
        
        var result = {};
        if ("scripts" in contents)
        {
            for (let k in contents.scripts)
            {
                if ( ! contents.scripts.hasOwnProperty(k))
                    continue;
                
                if (query && k.indexOf(query) == -1)
                    continue;
                
                result[k] = {
                    description: contents.scripts[k]
                };
            }
        }
        
        callback(result);
    };
    
    // Search through installed modules
    this.searchInstall = function(query, callback)
    {
        // We only care about the first word entered
        query = query.match(/^\w+/)
        query = query ? query[0] : "komodo";
        
        log.debug("Searching Yarn packages, startkey: " + query);
        
        // yarn search is broken and slow, we're working around this by talking
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
        var yarn = prefs.file().getString('yarnDefaultInterpreter', 'yarn') || 'yarn';
        
        var shell = require("ko/shell");
        var search = shell.run(yarn, ['ls', '--depth=0']);
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
            log.error('Error while running `yarn ls`');
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
