(function() {
    const log       = require("ko/logging").getLogger("commando-scope-shell-gulp")
    const commando  = require("commando/commando");
    const {Cc, Ci}  = require("chrome");
    const prefs     = require("ko/prefs");
    const shell     = require("scope-shell/shell");
    const shellHelpers = require("scope-shell/helpers");
    const koFile    = require("ko/file");
    const w         = require("ko/windows").getMain();
    const legacy    = w.ko;

    //log.setLevel(require("ko/logging").LOG_DEBUG);
    
    var local = {menuItems: false};
    
    this.register = function()
    {
        // Register the "gulp" namespace
        shell.registerNamespace("gulp",
        {
            command: function() { return prefs.file().getString("gulpDefaultInterpreter", "gulp") || "gulp" },
            description: "The streaming build system",
            env: {},
            results: this.listTasks.bind(this)
        });
        
        // Inject pref UI
        shellHelpers.injectInterpreterPref({
            basename: 'pref-nodejs.xul',
            siblingSelector: '#defaultNodejsInterpreterGroupBox',
            prefname: 'gulpDefaultInterpreter',
            caption: 'Gulp Location'
        });
        
        var dynBtn = require("ko/dynamic-button");
        var button = dynBtn.register("Gulp Tasks", {
            icon: "gulp",
            menuitems: this.updateMenu.bind(this),
            ordinal: 300,
            group: "buildSystems",
            groupOrdinal: 400,
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
                var paths = [koFile.join(placesPath, "gulpfile.js"), koFile.join(placesPath, "gulpfile.babel.js")];
                var isEnabled = false;
                for (let path of paths)
                {
                    isEnabled = koFile.exists(path);
                    if (isEnabled)
                        break;
                }
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
                let baseName = koFile.basename(url);
                if (baseName == "gulpfile.js" || koFile.basename(url) == "gulpfile.babel.js")
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
    
    this.updateMenu = function (callback)
    {
        if (local.menuItems)
            return local.menuItems;
        
        this.getTasks("", (tasks) =>
        {
            local.menuItems = [];
            var placesPath = legacy.uriparse.URIToLocalPath(legacy.places.getDirectory());
            var gulp = prefs.file().getString('gulpDefaultInterpreter', 'gulp') || 'gulp';
            
            for (let task of tasks) {
                local.menuItems.push({
                    label: `Task: ${task}`,
                    command: function(task) {
                        var cmd = [gulp, task].join(" ");
                        legacy.run.command(cmd, {cwd: placesPath});
                    }.bind(this, task)
                });
            }
            
            if (tasks.length)
                local.menuItems.push(null);
            
            local.menuItems.push({
                label: `Install Task ..`,
                command: function() {
                    commando.showSubscope("scope-shell", "npm", "npminstall", function() {
                        commando.search("gulp- ", function() {}, true);
                    });
                }
            });
            
            callback(local.menuItems);
        })
    }
    
    this.getTasks = function(query, callback)
    {
        var gulp = prefs.file().getString('gulpDefaultInterpreter', 'gulp') || 'gulp';
        
        var shell = require("ko/shell");
        var search = shell.run(gulp, ['--tasks-simple']);
        var result = [];
        
        // Update the result object whenever we receive data
        search.on('complete', function (data)
        {
            var entries = data.split(/(?:\n|\r)/g);
            for (let entry of entries)
            {
                entry = entry.trim();
                if ( ! entry.length) continue;
                result.push(entry);
            }
        });
        
        
        // Log errors, not much else we can (or should) do though
        // the result object can just return as empty, or partial
        search.stderr.on('data', function (data)
        {
            log.error('Error while running `gulp --tasks-simple`');
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
    
    // List installed modules
    this.listTasks = function(query, callback)
    {
        this.getTasks(query, (entries) =>
        {
            var results = {};
            for (let entry of entries) {
                results[entry] = {command: entry};
            }
            
            callback(results);
        });
    }

}).apply(module.exports);
