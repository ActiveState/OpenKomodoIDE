(function() {
    const log       = require("ko/logging").getLogger("commando-scope-shell-gem")
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
        $(w).on("scope_after_command", (e) =>
        {
            var gemfile = getGemFilePath();
            if ( ! gemfile)
                return;

            var command = e.detail;
            var gem = prefs.file().getString('gemDefaultInterpreter', 'gem') || 'gem';
            var [cmd, arg, value] = command;
            if (cmd == gem && arg == "install" && value && value.substr(0,1) != '-')
            {
                var res = require("ko/dialogs").confirm(`Would you like to add ${value} to your Gemfile?`, { doNotAskPref: "scope-shell-ruby-add-to-gemfile" });
                if ( ! res) return;

                var contents = koFile.read(gemfile);
                var f = koFile.open(gemfile, "w");
                f.write(contents);
                f.write("\n");
                f.write(`gem "${value}"`);
                f.close();
            }
        });
        // Register the "gem" namespace
        shell.registerNamespace("gem",
        {
            command: function() { return prefs.file().getString("gemDefaultInterpreter", "gem") || "gem" },
            description: "A sophisticated package manager for Ruby",
            env: {},
            results: {
                install: {
                    description: "Install a gem into the local repository",
                    results: this.searchInstall,
                    weight: 10
                },
                uninstall: {
                    description: "Uninstall gems from the local repository",
                    results: this.listInstalled,
                    weight: 10
                },
                build: { description: "Build a gem from a gemspec" },
                cert: { description: "Manage RubyGems certificates and signing settings" },
                check: { description: "Check a gem repository for added or missing files" },
                cleanup: { description: "Clean up old versions of installed gems" },
                contents: { description: "Display the contents of the installed gems" },
                dependency: { description: "Show the dependencies of an installed gem" },
                environment: { description: "Display information about the RubyGems environment" },
                fetch: { description: "Download a gem and place it in the current directory" },
                generate_index: { description: "Generates the index files for a gem server directory" },
                git_install: { description: "Allows you to install an 'edge' gem straight from its github repository or from a web site" },
                help: { description: "Provide help on the 'gem' command" },
                list: { description: "Display local gems whose name starts with STRING" },
                lock: { description: "Generate a lockdown list of gems" },
                mirror: { description: "Mirror all gem files (requires rubygems-mirror)" },
                outdated: { description: "Display all gems that need updates" },
                owner: { description: "Manage gem owners of a gem on the push server" },
                pristine: { description: "Restores installed gems to pristine condition from files located in the gem cache" },
                push: { description: "Push a gem up to the gem server" },
                query: { description: "Query gem information in local or remote repositories" },
                rdoc: { description: "Generates RDoc for pre-installed gems" },
                regenerate_binstubs: { description: "Re run generation of executable wrappers for gems." },
                search: { description: "Display remote gems whose name contains STRING" },
                server: { description: "Documentation and gem repository HTTP server" },
                sources: { description: "Manage the sources and cache file RubyGems uses to search for gems" },
                specific_install: { description: "Allows you to install an 'edge' gem straight from its github repository or from a web site" },
                specification: { description: "Display gem specification (in yaml)" },
                stale: { description: "List gems along with access times" },
                unpack: { description: "Unpack an installed gem to the current directory" },
                update: { description: "Update installed gems to the latest version" },
                which: { description: "Find the location of a library file you can require" },
                wrappers: { description: "Re run generation of environment wrappers for gems." },
                yank: { description: "Remove a pushed gem from the index" },
            }
        });
        
        // Inject pref UI
        shellHelpers.injectInterpreterPref({
            basename: 'pref-ruby.xul',
            siblingSelector: '#defaultRubyInterpreterGroupBox',
            prefname: 'bundleDefaultInterpreter',
            caption: 'Bundle Location'
        });
        shellHelpers.injectInterpreterPref({
            basename: 'pref-ruby.xul',
            siblingSelector: '#defaultRubyInterpreterGroupBox',
            prefname: 'gemDefaultInterpreter',
            caption: 'Gem Location'
        });

        var dynBtn = require("ko/dynamic-button");
        local.button = dynBtn.register("Gem", {
            icon: "trophy4",
            menuitems: this.updateMenu,
            menuitemsInitialize: this.updateMenu,
            ordinal: 100,
            group: "packageManagers",
            groupOrdinal: 400,
            events: ["current_place_opened", "project_opened", "workspace_restored", "process_close"],
            isEnabled: () =>
            {
                return !! getGemFilePath();
            }
        });
    }

    this.updateMenu = () =>
    {
        return [
            {
                label: `Initialize`,
                command: this.initializePackage
            },
            {
                label: `Install Package`,
                command: function() {
                    commando.showSubscope("scope-shell", "gem", "geminstall");
                }
            },
            {
                label: "Run Command ..",
                command: () => {
                    commando.showSubscope("scope-shell", "gem");
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
            "Where do you want to initialize a new Gemfile?",
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

                options.cwd = data.path;

                var bundle = prefs.file().getString('bundleDefaultInterpreter', 'bundle') || 'bundle';
                var command = [bundle, "init"];
                var process = require("ko/shell").exec(command.join(" "), options);

                process.on('close', function (code, signal)
                {
                    if (code !== 0)
                        return;

                    require("ko/dom")("panel.shell-output").element().hidePopup();

                    var path = require("ko/file").join(data.path, "Gemfile");
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
        query = query ? query[0] : "ruby";
        
        log.debug("Searching Gem packages, startkey: " + query);
        
        var gem = prefs.file().getString('gemDefaultInterpreter', 'gem') || 'gem';
        
        var shell = require("ko/shell");
        var search = shell.run(gem, ['search', query]);
        var result = {};
        
        // Update the result object whenever we receive data
        search.stdout.on('data', function (data)
        {
            var entry, rx = /([0-9a-zA-Z-_.]+)\s+\(([0-9a-zA-Z-_., ]+)\)/g;
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
            log.debug('Error while running `gem search`');
            log.debug(data);
        });
        
        // Process finished, time to return results
        search.on('close', function (code)
        {
            log.debug('child process exited with code ' + code);
            
            callback(result);
        });
    }
    
    // List installed modules
    this.listInstalled = function(query, callback)
    {
        // We only care about the first word entered
        query = query.match(/^\w+/)
        query = query ? query[0] : "perl";
        
        log.debug("Searching Gem packages, startkey: " + query);
        
        var gem = prefs.file().getString('gemDefaultInterpreter', 'gem') || 'gem';
        
        var shell = require("ko/shell");
        var search = shell.run(gem, ['list']);
        var result = {};
        
        // Update the result object whenever we receive data
        search.stdout.on('data', function (data)
        {
            var entry, rx = /([0-9a-zA-Z-_.]+)\s+\(([0-9a-zA-Z-_., ]+)\)/g;
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
            log.debug('Error while running `gem list`');
            log.debug(data);
        });
        
        // Process finished, time to return results
        search.on('close', function (code)
        {
            log.debug('child process exited with code ' + code);
            
            callback(result);
        });
    }
    
    var getGemFilePath = () =>
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

        var path = koFile.join(placesPath, "Gemfile");
        return koFile.exists(path) ? path : false;
    }

}).apply(module.exports);
