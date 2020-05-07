(function() {
    const log       = require("ko/logging").getLogger("commando-scope-shell-ppm")
    const commando  = require("commando/commando");
    const {Cc, Ci}  = require("chrome");
    const prefs     = require("ko/prefs");
    const shell     = require("scope-shell/shell");
    const shellHelpers = require("scope-shell/helpers");
    
    var activeSearch = null;

    //log.setLevel(require("ko/logging").LOG_DEBUG);
    
    this.register = function()
    {
        // Register the "ppm" namespace
        shell.registerNamespace("ppm",
        {
            command: function() { return prefs.file().getString("ppmDefaultInterpreter", "ppm") || "ppm" },
            description: "The package management utility for ActivePerl",
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
                    command: "area",
                    results: ["list","sync"]
                },
                {
                    command: "repo",
                    results: ["list","sync","on","off","describe","add","rename","location","sugges"]
                },
                "upgrade","remove","list","files","verify","search","describe","tree","version",
            ]
        });
        
        // Inject pref UI
        shellHelpers.injectInterpreterPref({
            basename: 'pref-perl.xul',
            siblingSelector: '#defaultPerlInterpreterGroupBox',
            prefname: 'ppmDefaultInterpreter',
            caption: 'PPM Location'
        });
    }
    
    // Search through installed modules
    this.searchInstall = function(query, callback)
    {
        // We only care about the first word entered
        query = query.match(/^\w+/)
        query = query ? query[0] : "perl";
        
        log.debug("Searching PPM packages, startkey: " + query);
        
        if (activeSearch)
        {
            log.debug("Stopping previous child process");
            activeSearch.kill();
            activeSearch = null;
        }
        
        var ppm = prefs.file().getString('ppmDefaultInterpreter', "ppm") || "ppm";
        var uuid = commando.getActiveSearchUuid(),
            maxResults = ko.prefs.getLong("commando_search_max_results"),
            shell = require("ko/shell"),
            search = shell.run(ppm, ['search', query]),
            result = {},
            results = 0;
            
        // Update the result object whenever we receive data
        search.stdout.on('data', function (data)
        {
            if (++results == maxResults || uuid != commando.getActiveSearchUuid())
            {
                if (uuid)
                {
                    log.debug("Stopping old/redundant child process");
                    search.kill();
                    uuid = null;
                }
                return;
            }
            
            var entry, rx = /\s?\d+:\s([0-9a-zA-Z-_.]+)\s+([0-9a-zA-Z-_.]+)(?:\n|\r|$)/g;
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
            log.error('Error while running `ppm search`', true);
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
    this.listInstalled = function(query, callback)
    {
        // We only care about the first word entered
        query = query.match(/^\w+/)
        query = query ? query[0] : null;
        
        log.debug("Searching Installed PPM packages, startkey: " + query);
        
        var ppm = prefs.file().getString('ppmDefaultInterpreter', "ppm") || "ppm";
        var shell = require("ko/shell");
        var search = shell.run(ppm, ['list']);
        var result = {};
        
        // Update the result object whenever we receive data
        search.stdout.on('data', function (data)
        {
            var entry, rx = /\|\s([0-9a-zA-Z-_.]+)\s+\|\s(\d[0-9a-zA-Z-_.]+)/g;
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
            log.error('Error while running `ppm show`', true);
            log.error(data, true);
        });
        
        // Process finished, time to return results
        search.on('close', function (code)
        {
            log.debug('child process exited with code ' + code);
            
            callback(result);
        });
    }

}).apply(module.exports);
