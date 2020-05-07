(function() {
    const log       = require("ko/logging").getLogger("commando-scope-shell-composer")
    const commando  = require("commando/commando");
    const {Cc, Ci}  = require("chrome");
    const prefs     = require("ko/prefs");
    const shell     = require("scope-shell/shell");
    const shellHelpers = require("scope-shell/helpers");
    const w         = require("ko/windows").getMain();
    const legacy    = w.ko;
    const koFile    = require("ko/file");

    log.setLevel(require("ko/logging").LOG_DEBUG);
    
    var local = {running: false, menuItems: null};
    
    this.register = function()
    {
        // Register the "composer" namespace
        shell.registerNamespace("composer",
        {
            command: function() { return prefs.file().getString("composerDefaultInterpreter", "composer") || "composer" },
            description: "Dependency Manager for PHP",
            env: {},
            results: {
                require: {
                    description: "Adds required packages to your composer.json and installs them",
                    results: this.searchInstall,
                    weight: 10
                },
                remove: {
                    description: "Removes a package from the require or require-dev",
                    results: this.listInstalled,
                    weight: 10
                },
                about: { description: "Short information about Composer" },
                archive: { description: "Create an archive of this composer package" },
                browse: { description: "Opens the package's repository URL or homepage in your browser."},
                "clear-cache": { description: "Clears composer's internal package cache." },
                clearcache: { description: "Clears composer's internal package cache." },
                config: { description: "Set config options" },
                "create-project": { description: "Create new project from a package into given directory." },
                depends: { description: "Shows which packages depend on the given package" },
                diagnose: { description: "Diagnoses the system to identify common errors." },
                "dump-autoload": { description: "Dumps the autoloader" },
                dumpautoload: { description: "Dumps the autoloader" },
                global: { description: "Allows running commands in the global composer dir ($COMPOSER_HOME)." },
                help: { description: "Displays help for a command" },
                home: { description: "Opens the package's repository URL or homepage in your browser." },
                info: { description: "Show information about packages" },
                init: { description: "Creates a basic composer.json file in current directory." },
                install: { description: "Installs the project dependencies from the composer.lock file if present, or falls back on the composer.json." },
                licenses: { description: "Show information about licenses of dependencies" },
                list: { description: "Lists commands" },
                "run-script": { description: "Run the scripts defined in composer.json." },
                search: { description: "Search for packages" },
                "self-update": { description: "Updates composer.phar to the latest version." },
                selfupdate: { description: "Updates composer.phar to the latest version." },
                show: { description: "Show information about packages" },
                status: { description: "Show a list of locally modified packages" },
                update: { description: "Updates your dependencies to the latest version according to composer.json, and updates the composer.lock file." },
                validate: { description: "Validates a composer.json" }
            }
        });

        // Inject pref UI
        shellHelpers.injectInterpreterPref({
            basename: 'pref-php.xul',
            siblingSelector: '#defaultPHPInterpreterGroupBox',
            prefname: 'composerDefaultInterpreter',
            caption: 'Composer Location'
        });

        var dynBtn = require("ko/dynamic-button");
        local.button = dynBtn.register("Composer", {
            icon: "php",
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

                var path = koFile.join(placesPath, "composer.json");
                return koFile.exists(path);
            }
        });

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
                    commando.showSubscope("scope-shell", "composer", "composerrequire");
                }
            },
            {
                label: "Run Command ..",
                command: () => {
                    commando.showSubscope("scope-shell", "composer");
                }
            }
        ];
        
        return local.menuItems;
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
            "Where do you want to initialize a new composer.json?",
            {
                name: {
                   label: "Name"
                },
                desc: {
                    type: "description",
                    value: "Must be in the format: namespace/name-name"
                },
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

                var composer = prefs.file().getString('composerDefaultInterpreter', 'composer') || 'composer';
                var command = [composer, "init", "-n", "--name", `"${data.name}"`];
                var process = require("ko/shell").exec(command.join(" "), options);

                process.on('close', function (code, signal)
                {
                    if (code !== 0)
                        return;

                    require("ko/dom")("panel.shell-output").element().hidePopup();

                    var path = require("ko/file").join(data.path, "composer.json");
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
        query = query ? query[0] : null;
        
        log.debug("Searching Composer packages, startkey: " + query);
        
        // composer search laravel --no-ansi --no-interaction
        var composer = prefs.file().getString('composerDefaultInterpreter', 'composer') || 'composer';
        
        var shell = require("ko/shell");
        var args = ['search', query, '--no-ansi', '--no-interaction'];

        var search = shell.run(composer, args);
        var result = {};
        var numEntries = 0;
        var maxResults = prefs.getLong("commando_search_max_results");
        
        // Update the result object whenever we receive data
        search.stdout.on('data', function (data)
        {
            if (numEntries >= maxResults)
                return;

            var entries = data.split(/(?:\r\n|\r|\n)/);
            for (let entry of entries)
            {
                if (numEntries >= maxResults)
                    return;

                let description = entry.split(/\s|$/);
                let name = description.shift();
                description = description.join(" ");
                if (description.length == 0) description = false;
                
                if ( ! name || name.indexOf("/") == -1) continue;
                result[name] = {
                    command: name,
                    description: description
                };
                numEntries++;
            }
        });
        
        // Log errors, not much else we can (or should) do though
        // the result object can just return as empty, or partial
        search.stderr.on('data', function (data)
        {
            log.error('Error while running `composer search`', true);
            log.error(data, true);
        });
        
        // Process finished, time to return results
        search.on('close', function (code)
        {
            local.running = false;
            log.debug('child process exited with code ' + code);
            
            callback(result);
        });
    }
    
    // List installed modules
    this.listInstalled = function(query, callback)
    {
        // We only care about the first word entered
        query = query.match(/^\w+/)
        query = query ? query[0] : "komodo";
        
        log.debug("Searching Composer packages, startkey: " + query);
        
        // composer search laravel --no-ansi --no-interaction
        var composer = prefs.file().getString('composerDefaultInterpreter', 'composer') || 'composer';
        
        var shell = require("ko/shell");
        var search = shell.run(composer, ['show', '--self', '--no-ansi', '--no-interaction']);
        var result = {};
        
        // Update the result object whenever we receive data
        search.stdout.on('data', function (data)
        {
            var entry, rx = /([0-9a-zA-Z-_]+\/[0-9a-zA-Z-_]+)\s([0-9a-zA-Z-_.*]+)/g;
            while (entry = rx.exec(data))
            {
                let name = entry[1];
                let description = entry[2];
                
                if (name.indexOf("/") == -1) continue;
                result[name] = {
                    command: name,
                    description: description
                };
            }
        });
        
        // Log errors, not much else we can (or should) do though
        // the result object can just return as empty, or partial
        search.stderr.on('data', function (data)
        {
            log.error('Error while running `composer show`', true);
            log.error(data, true);
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
