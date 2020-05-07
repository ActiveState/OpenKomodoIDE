(function() {
    const log       = require("ko/logging").getLogger("commando-scope-shell-bower")
    const commando  = require("commando/commando");
    const {Cc, Ci}  = require("chrome");
    const prefs     = require("ko/prefs");
    const shell     = require("scope-shell/shell");
    const shellHelpers = require("scope-shell/helpers");

    //log.setLevel(require("ko/logging").LOG_DEBUG);
    
    this.register = function()
    {
        // Register the "bower" namespace
        shell.registerNamespace("bower",
        {
            command: function() { return prefs.file().getString("bowerDefaultInterpreter", "bower") || "bower" },
            description: "Package management for client-side programming on the web",
            env: {},
            results: {
                install: {
                    description: "Install a package locally",
                    results: this.searchInstall,
                    weight: 10
                },
                uninstall: {
                    description: "Remove a local package",
                    results: this.listInstalled,
                    weight: 10
                },
                cache: {
                    description: "Manage bower cache",
                    results: ["clean", "list"]
                },
                help: { description: "Display help information about Bower" },
                home: { description: "Opens a package homepage into your favorite browser" },
                info: { description: "Info of a particular package" },
                init: { command: ["init", ":ot"], description: "Interactively create a bower.json file" },
                link: { description: "Symlink a package folder" },
                list: { description: "List local packages" },
                lookup: { description: "Look up a package URL by name" },
                prune: { description: "Removes local extraneous packages" },
                register: { description: "Register a package" },
                search: { description: "Search for a package by name" },
                update: { description: "Update a local package" },
                version: { description: "Bump a package version" }
            }
        });
        
        // Inject pref UI
        shellHelpers.injectInterpreterPref({
            basename: 'pref-javascript.xul',
            siblingSelector: '#chromeDebuggingGroupbox',
            prefname: 'bowerDefaultInterpreter',
            caption: 'Bower Location'
        });
    }
    
    // Search through installed modules
    this.searchInstall = function(query, callback)
    {
        // We only care about the first word entered
        query = query.match(/^\w+/)
        query = query ? query[0] : "jquery";
        
        log.debug("Searching Bower packages, startkey: " + query);
        
        var bower = prefs.file().getString('bowerDefaultInterpreter', 'bower') || 'bower';
        var shell = require("ko/shell");
        var search = shell.run(bower, ['search', query, '--json']);
        var result = "";
        
        // Update the result string whenever we receive data
        search.stdout.on('data', function (data)
        {
            result += data;
        });
        
        // Log errors, not much else we can (or should) do though
        // the result object can just return as empty, or partial
        search.stderr.on('data', function (data)
        {
            // Log stderr under debug because bower likes to spit out status messages to stderr
            log.debug('Error while running `bower search`', true);
            log.debug(data, true);
        });
        
        // Process finished, time to return results
        search.on('close', function (code)
        {
            log.debug('child process exited with code ' + code);
            
            try
            {
                var entries = JSON.parse(result);
            }
            catch (e)
            {
                log.exception(e, "Failed to parse bower results");
                return callback();
            }
            
            result = {};
            for (let entry of entries)
                result[entry.name] = {};
            
            callback(result);
        });
    }
    
    // List installed modules
    this.listInstalled = function(query, callback)
    {
        // We only care about the first word entered
        query = query.match(/^\w+/)
        query = query ? query[0] : "komodo";
        
        log.debug("Searching Installed Bower packages, startkey: " + query);
        
        var bower = prefs.file().getString('bowerDefaultInterpreter', 'bower') || 'bower';
        var shell = require("ko/shell");
        var search = shell.run(bower, ['list', '--json']);
        var result = "";
        
        // Update the result string whenever we receive data
        search.stdout.on('data', function (data)
        {
            result += data;
        });
        
        // Log errors, not much else we can (or should) do though
        // the result object can just return as empty, or partial
        search.stderr.on('data', function (data)
        {
            // Log stderr under debug because bower likes to spit out status messages to stderr
            log.debug('Error while running `bower list`');
            log.debug(data);
        });
        
        // Process finished, time to return results
        search.on('close', function (code)
        {
            log.debug('child process exited with code ' + code);
            
            try
            {
                var response = JSON.parse(result);
            }
            catch (e)
            {
                log.exception(e, "Failed to parse bower results");
                return callback();
            }
            
            result = {};
            
            // Parse dependencies
            var deps = response.pkgMeta.dependencies;
            for (let name in deps)
                result[name] = {description: deps[name]};
                
            // Parse development dependencies
            deps = response.pkgMeta.devDependencies;
            for (let name in deps)
                result[name] = {description: deps[name]};
            
            callback(result);
        });
    }

}).apply(module.exports);
