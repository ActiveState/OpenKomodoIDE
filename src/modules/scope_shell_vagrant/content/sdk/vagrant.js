(function() {
    const log       = require("ko/logging").getLogger("commando-scope-shell-vagrant");
    const commando  = require("commando/commando");
    const {Cc, Ci}  = require("chrome");
    const prefs     = require("ko/prefs");
    const shell     = require("scope-shell/shell");
    const shellHelpers = require("scope-shell/helpers");

    this.register = function()
    {
        // Register the "vagrant" namespace
        shell.registerNamespace("vagrant",
        {
            command: function() { return prefs.getString("vagrantBinary", "vagrant") || "vagrant" },
            description: "Create and Manage Vagrant boxes",
            env: {},
            results: {
                box: {
                    description: "manages boxes: installation, removal, etc.",
                    placeholder: "<subcommand> [<args>]",
                    results: {
                        add: {
                            description: "adds a box with the given address",
                            placeholder: "[options] <name, url, or path>",
                            results: this.listAvailableBoxes },
                        list: {
                            description: "lists all the boxes that are installed",
                            placeholder: "[options]" },
                        outdated: {
                            description: "whether the box in your current environment is outdated",
                            placeholder: "[options]" },
                        remove: {
                            description: " removes a box that matches the given name",
                            placeholder: "<name>",
                            results: this.list.bind(this, "box") },
                        repackage: {
                            description: "repackages the given box and puts it in the current directory",
                            placeholder: "<name> <provider> <version>",
                            results: this.list.bind(this, "box") },
                        update: {
                            description: "updates box for current environment",
                            placeholder: "[options]" },
                    }},
                destroy: {
                    description: "stops and deletes all traces of the vagrant machine",
                    placeholder: "[options] [name]",
                        results: this.listEnvironments },
                "global-status": {
                    description: "outputs status Vagrant environments for this user",
                    placeholder: "" },
                halt: {
                    description: "stops the vagrant machine",
                    placeholder: "[options] [name]",
                        results: this.listEnvironments },
                help: {
                    description: "shows the help for a subcommand",
                    placeholder: "[options] <command> [<args>]" },
                init: {
                    description: "initializes a new Vagrant environment by creating a Vagrantfile",
                    placeholder: "[options] [name [url]]",
                    results: this.listAvailableBoxes },
                login: {
                    command: ["login", ":ot"],
                    description: "log in to HashiCorp's Atlas",
                    placeholder: "" },
                package: {
                    description: "packages a running vagrant environment into a box",
                    placeholder: "[options] [name]",
                    results: this.listEnvironments },
                plugin: {
                    description: "manages plugins: install, uninstall, update, etc.",
                    placeholder: "<command> [<args>]",
                    results: {
                        install: {
                            description: " installs a plugin with the given name or file path",
                            placeholder: "<name>... [-h]",
                            results: this.listAvailablePlugins },
                        license: {
                            description: "installs a license for a proprietary Vagrant plugin",
                            placeholder: "<name> <license-file> [-h]",
                            results: this.list.bind(this, "plugin") },
                        list: {
                            description: "lists all installed plugins and their respective installed versions",
                            placeholder: "[-h]" },
                        uninstall: {
                            description: "uninstalls the plugin with the given name",
                            placeholder: " <name> [<name2> <name3> ...] [-h]",
                            results: this.list.bind(this, "plugin") },
                        update: {
                            description: "updates the plugins that are installed within Vagrant",
                            placeholder: "[names...] [-h]",
                            results: this.list.bind(this, "plugin") },
                        }},
                provision: {
                    description: "provisions the vagrant machine",
                    placeholder: "[name] [--provision-with x,y,z]",
                    results: this.listEnvironments },
                push: {
                    description: "deploys code in this environment to a configured destination",
                    placeholder: "[strategy] [options]" },
                rdp: {
                    command: ["rdp", ":ot"],
                    description: "connects to machine via RDP",
                    placeholder: "[options] [name] [-- extra args]",
                    results: this.listEnvironments },
                reload: {
                    description: "restarts vagrant machine, loads new Vagrantfile configuration",
                    placeholder: "[name]",
                    results: this.listEnvironments },
                resume: {
                    description: "resume a suspended vagrant machine",
                    placeholder: "[name]",
                    results: this.listEnvironments },
                ssh: {
                    command: ["ssh", ":ot"],
                    description: "connects to machine via SSH",
                    placeholder: "[options] [name] [-- extra ssh args]",
                    results: this.listEnvironments },
                "ssh-config": {
                    description: "outputs OpenSSH valid configuration to connect to the machine",
                    placeholder: "[options] [name]",
                    results: this.listEnvironments },
                status: {
                    description: "outputs status of the vagrant machine",
                    placeholder: "[name]",
                    results: this.listEnvironments },
                suspend: {
                    description: "suspends the machine",
                    placeholder: "[name]",
                    results: this.listEnvironments },
                up: {
                    description: "starts and provisions the vagrant environment",
                    placeholder: "[options] [name]",
                    results: this.listEnvironments },
                version: {
                    description: "prints current and latest Vagrant version",
                    placeholder: "" }
            }
        });
        
        // Inject pref UI
        shellHelpers.injectInterpreterPref({
            basename: 'pref-environ.xul',
            siblingSelector: '#environ-prefs-groupbox',
            prefname: 'vagrantBinary',
            caption: 'Vagrant Location'
        });
    };
    
    // Search through boxes
    this.list = function(type, query, callback)
    {
        // We only care about the first word entered
        query = query.match(/^\w+/);
        query = query ? query[0] : "";
        
        log.debug("Listing Vagrant boxes, startkey: " + query);

        var vagrant = prefs.getString('vagrantBinary', 'vagrant') || 'vagrant';
        var search = require("ko/shell").run(vagrant, [type, 'list']);
        search.on('complete', function (stdout, foo)
        {
            var result = {};
            var entries = stdout.split(/\r|\n/);
            entries.shift();
            
            for (let entry of entries)
            {
                entry = entry.split(/\s+/);
                let name = entry.shift();
                let description = entry.join(" ");
                if ( ! name || ! description) continue;
                
                result[name] = { description: description};
            }
            callback(result);
        });
    };
    
    // Search through boxes
    this.listEnvironments = function(query, callback)
    {
        // We only care about the first word entered
        query = query.match(/^\w+/);
        query = query ? query[0] : "";
        
        log.debug("Listing Vagrant environments, startkey: " + query);

        var vagrant = prefs.getString('vagrantBinary', 'vagrant') || 'vagrant';
        var search = require("ko/shell").run(vagrant, ['global-status']);
        search.on('complete', function (stdout, foo)
        {
            var result = {};
            var entries = stdout.split(/\r|\n/);
            entries.shift();
            entries.shift();
            
            for (let entry of entries)
            {
                if (entry.match(/^\s*$/))
                    break
                
                let _entry = entry.split(/\s+/);
                
                if (_entry.length < 5)
                {
                    log.warn("Unhandled `vagrant global-status` format: " + entry);
                    continue;
                }
                
                let [id, name, description, state, directory] = _entry;
                
                name = name == "default" ? id : id + " ("+name+")";
                
                result[name] = {
                    command: id,
                    description: directory
                };
                
                if (state == "running")
                    result[name].icon = "chrome://famfamfamsilk/skin/icons/bullet_green.png";
                else
                    result[name].icon = "chrome://famfamfamsilk/skin/icons/bullet_red.png";
            }
            callback(result);
        });
    };
    
    var boxCache;
    this.listAvailableBoxes = function(query, callback)
    {
        // We only care about the first word entered
        query = query.match(/^\w+/);
        query = query ? query[0] : "";
        
        log.debug("Listing Vagrant boxes, startkey: " + query);

        if (boxCache) return callback(boxCache);
    
        var ajax = require("ko/ajax");
        var url = "http://vagrant-lists.github.io/api/v1/boxes.json";
        ajax.get(url, function(code, responseText)
        {
            if (code != 200) return callback();
            
            // Fix invalid JSON, luckily they only seem to have messed up
            // the template, not the actual JSON data
            responseText = responseText.replace(/\{\s+([a-zA-Z]+)\:/, '{ "$1":');
            responseText = responseText.replace(/,\s+(\]|\})/, '$1')
            
            var data = JSON.parse(responseText);
            if ( ! ("vagrantboxes" in data)) return callback();
            boxCache = {};
            
            for (let row of data.vagrantboxes)
            {
                boxCache[row.name] = {
                    command: row.link,
                    description: row.description
                };
            }
            
            callback(boxCache);
        }.bind(this));
    };
    
    var pluginCache;
    this.listAvailablePlugins = function(query, callback)
    {
        // We only care about the first word entered
        query = query.match(/^\w+/);
        query = query ? query[0] : "";
        
        log.debug("Listing Vagrant plugins, startkey: " + query);

        if (pluginCache) return callback(pluginCache);
    
        var ajax = require("ko/ajax");
        var url = "http://vagrant-lists.github.io/api/v1/plugins.json";
        ajax.get(url, function(code, responseText)
        {
            if (code != 200) return callback();
            
            // Fix invalid JSON, luckily they only seem to have messed up
            // the template, not the actual JSON data
            responseText = responseText.replace(/\{\s+([a-zA-Z]+)\:/, '{ "$1":');
            responseText = responseText.replace(/,\s+(\]|\})/, '$1')
            
            var data = JSON.parse(responseText);
            if ( ! ("vagrantplugins" in data)) return callback();
            pluginCache = {};
            
            for (let row of data.vagrantplugins)
            {
                pluginCache[row.name] = {
                    description: row.description
                };
            }
            
            callback(pluginCache);
        }.bind(this));
    };

}).apply(module.exports);
