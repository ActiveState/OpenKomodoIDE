(function() {
    const log       = require("ko/logging").getLogger("commando-scope-shell-grunt")
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
        // Register the "grunt" namespace
        shell.registerNamespace("grunt",
        {
            command: function() { return prefs.file().getString("gruntDefaultInterpreter", "grunt") || "grunt" },
            description: "The JavaScript Task Runner",
            env: {},
            results: this.listTasks.bind(this)
        });
        
        // Inject pref UI
        shellHelpers.injectInterpreterPref({
            basename: 'pref-nodejs.xul',
            siblingSelector: '#defaultNodejsInterpreterGroupBox',
            prefname: 'gruntDefaultInterpreter',
            caption: 'Grunt Location'
        });
        
        var dynBtn = require("ko/dynamic-button");
        var button = dynBtn.register("Grunt Tasks", {
            icon: "grunt",
            menuitems: this.updateMenu.bind(this),
            ordinal: 200,
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
                var path = koFile.join(placesPath, "Gruntfile.js");
                var isEnabled = koFile.exists(path);
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
                if (koFile.basename(url) == "Gruntfile.js")
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
            var grunt = prefs.file().getString('gruntDefaultInterpreter', 'grunt') || 'grunt';
            
            for (let task in tasks) {
                if ( ! tasks.hasOwnProperty(task))
                    continue;
                
                local.menuItems.push({
                    label: `Task: ${task}`,
                    acceltext: tasks[task].description,
                    command: function(task) {
                        var cmd = [grunt, task.join(" ")].join(" ");
                        legacy.run.command(cmd, {cwd: placesPath});
                    }.bind(this, tasks[task].command)
                });
            }
            
            if (tasks.length)
                local.menuItems.push(null);
            
            local.menuItems.push({
                label: `Install Task ..`,
                command: function() {
                    commando.showSubscope("scope-shell", "npm", "npminstall", function() {
                        commando.search("grunt- ", function() {}, true);
                    });
                }
            });
            
            callback(local.menuItems);
        });
    }
    
    this.getTasks = function(query, callback)
    {
        var grunt = prefs.file().getString('gruntDefaultInterpreter', 'grunt') || 'grunt';
        
        var shell = require("ko/shell");
        var search = shell.run(grunt, ['--help', '--no-color']);
        var result = {};
        
        // Update the result object whenever we receive data
        search.on('complete', function (data)
        {
            var entries = data.match(/Available tasks\n([.\s\S]*?)\n\n/i);
            if ( ! entries || entries.length < 1)
                return;
            
            entries = entries[1].split(/\r|\n/);
            for (let entry of entries)
            {
                entry = entry.trim();
                entry = entry.split("  ");
                let task = entry.shift();
                let description = entry.join(" ");
                
                result[task] = {description: description, command: [task, '--no-color']};
            }
        });
        
        
        // Log errors, not much else we can (or should) do though
        // the result object can just return as empty, or partial
        search.stderr.on('data', function (data)
        {
            log.error('Error while running `grunt --tasks-simple`');
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
            callback(entries);
        });
    }

}).apply(module.exports);
