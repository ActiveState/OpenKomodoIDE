(function() {
    const log       = require("ko/logging").getLogger("commando-scope-shell");
    const commando  = require("commando/commando");
    const timers    = require("sdk/timers");
    const {Cc, Ci}  = require("chrome");
    const prefs     = require("ko/prefs");
    const w         = require("ko/windows").getMain();
    const legacy    = w.ko;
    const $         = require("ko/dom");

    var local = {
        namespaces: {}
    };

    //log.setLevel(require("ko/logging").LOG_DEBUG);

    this.registerNamespace = function(namespace, options)
    {
        log.debug("Registering namespace: " + namespace);
        
        local.namespaces[namespace] = options;
        local.namespaces[namespace].name = namespace;
        local.namespaces[namespace].isNamespace = true;

        if ( ! ("description" in local.namespaces[namespace]))
            local.namespaces[namespace].description = "";
    };
    
    this.unregisterNamespace = function(namespace)
    {
        log.debug("Un-Registering namespace: " + namespace);
        delete local.namespaces[namespace];
    };

    this.onSearch = function(query, uuid, onComplete)
    {
        log.debug(uuid + " - Starting Scoped Search");
        
        local.implicit = false;
        delete local.queryArgs;
        delete local.queryDepth;
        delete local.command;
        delete local.label;
        
        local.hasTrailingSpace = query.substr(-1) == " ";
        local.query = query.trim().toLowerCase();
        
        var subset = local.namespaces;
        var subscope = commando.getSubscope();
        
        var scope = commando.getScope();
        if ( ! subscope && scope.id != 'scope-shell')
        {
            local.implicit = true;
            local.queryArgs = local.query.split(/\s+/g);
            local.query = local.queryArgs.slice(-1)[0];
            local.queryDepth = 0;
            local.command = [];
            local.label = [];
        }
        
        if (subscope)
            subset = subscope.data.subset || {};
        
        if ((scope.id == 'scope-shell' && (query !== "" || subscope)) ||
            (scope.id != 'scope-shell' && query !== "" && ! subscope) ||
            (subscope && subscope.scope == "scope-shell"))
        {
            var weight = -1; // show at bottom
            
            if ( ! local.implicit && query === "")
                weight = 200;
            
            commando.renderResults([{
                id: "scope-shell-run-cmd",
                name: "run command",
                scope: "scope-shell",
                data: {},
                icon: "koicon://ko-svg/chrome/fontawesome/skin/terminal.svg?size=16",
                allowMultiSelect: false,
                weight: weight
            }], uuid);
        }
        
        this.searchSubset(subset, local.query, uuid, onComplete);
    };

    this.searchSubset = function(subset, query, uuid, callback)
    {
        if (typeof subset == 'function')
        {
            if (local.implicit)
                return callback();
            
            try
            {
                subset = subset(query, function(_subset)
                {
                    this.searchSubset(_subset, query, uuid, callback);
                }.bind(this));
            }
            catch (e)
            {
                log.exception(e, "Exception while searching subset");
            }
            return;
        }
            
        var id = this.getShell(false).command;
        
        // Search within subset
        var results = [];
        var _ = require("contrib/underscore");
        
        for (let key in subset)
        {
            let data = subset[key];
            
            if ( ! isNaN(key))
            {
                if (typeof data == "object")
                {
                    key = data.command;
                    if (Array.isArray(key))
                        key = key[0];
                }
                else
                {
                    key = data;
                    data = {};
                }
            }
            
            if (local.implicit && local.queryDepth+1 < local.queryArgs.length)
            {
                if (local.queryArgs[local.queryDepth] == key)
                {
                    local.queryDepth++;
                    let command = data.command || key;
                    command = typeof command == 'function' ? command() : command;
                    local.command.push(command || key);
                    local.label.push(key);
                    this.searchSubset(data.results || {}, query, uuid, callback);
                    return;
                }
                
                continue;
            }
            
            let indexOf = key.toLowerCase().indexOf(query);
            if (( ! local.implicit && query === "") || indexOf !== -1)
            {
                let command = key;
                if ("command" in data)
                    command = data.command;
                command = typeof command == 'function' ? command() : command;
                
                if (local.command)
                    command = local.command.concat(command).join(" ");
                    
                let weight = indexOf === 0 ? 75 : 55;
                if (query == key)
                    weight = 100;
                
                if ("weight" in data)
                    weight = weight + data.weight;
                
                let label = key;
                if (local.label)
                    label = local.label.concat(key).join(" ");
                
                let entry = _.extend({
                    id: (id + key).replace(/\W/g, ''),
                    name: label,
                    scope: "scope-shell",
                    isScope: true,
                    weight: weight,
                    icon: "koicon://ko-svg/chrome/fontawesome/skin/terminal.svg?size=16",
                    data: _.extend({
                        subset: data.results || {},
                        command: command
                    }, data.data || {}),
                    allowMultiSelect: false
                }, data);
                
                entry.weight = weight; // don't allow override
                
                if ( ! local.implicit && local.hasTrailingSpace && key == query)
                {
                    commando.setSubscope(entry);
                    return;
                }
                
                results.push(entry);
            }
        }
        
        commando.renderResults(results, uuid);
        
        callback();
    };
    
    this.getShell = function(includeQuery = true)
    {
        var history = commando.getHistory();
        
        var subscope = commando.getSubscope();
        if (subscope) history.push(subscope);
        
        var parsers = [];
        var shell = {env: {}, command: [], options: {}}
        for (let x=0;x<history.length;x++)
        {
            let item = history[x];
            item = (("subscope" in item) && ! ("id" in item)) ? item.subscope : item;

            if ("env" in item.data)
                shell.env = item.data.env;
            else if ("env" in item)
                shell.env = item.env;
                
            let command = item.data.command;
            if (typeof command == "function") command = command();
            if ((typeof command == "object") && "parser" in command)
            {
                parsers.push(command.parser);
            }
            
            shell.command = shell.command.concat(command);
        }
        
        if (includeQuery)
        {
            var item = commando.getSelectedResult();
            if ("command" in item.data)
            {
                var command = item.data.command;
                if (typeof command == "function") command = command();
                
                shell.command = shell.command.concat(command);
            }
            else
            {
                shell.command = shell.command.concat(commando.getSearchValue().split(/\s+/));
            }
        }
        
        shell = parseOptions(shell);
        shell.commandArray = shell.command;
        shell.command = shell.command.join(" ");
        
        if (shell.command)
        {
            shell.command = shell.command.replace(/(--[\w-_]+=)\s/gi, "$1");
        }
        
        if (parsers.length)
        {
            for (let x=0;x<parsers.length;x++)
            {
                shell = parsers[x](shell);
            }
        }

        return shell;
    };
    
    this.getCwd = function()
    {
        var cwd;
        
        var partSvc = Cc["@activestate.com/koPartService;1"].getService(Ci.koIPartService);
        cwd = legacy.uriparse.URIToPath(legacy.places.getDirectory());
        if (partSvc.currentProject)
            cwd = partSvc.currentProject.liveDirectory;
            
        return cwd;
    };

    this.onSelectResult = function(selectedItems)
    {
        var shell = this.getShell();
        
        var env     = shell.env;
        var command = shell.command;
        var options = shell.options;
        options.env = options.env || env;
        
        options.cwd = options.cwd || this.getCwd();
        
        if (options.runIn == "hud")
        {
            var process = require("ko/shell").exec(command, options);
            process.on('close', (code, signal) =>
            {
                if (code === 0)
                {
                    $(w).trigger("scope_after_command", shell.commandArray);
                }
            });
        }
        else
        {
            // Convert env to string of key=value\nkey=value
            if ( typeof options.env !== "string" && typeof options.env === 'object' && options.env !== null ) {
                let env = [];
                for (let k in options.env) {
                    env.push(k+"="+(options.env[k]+"").replace(/\n/g, "\\n"));
                }
                options.env = env.join("\n");
            }

            log.debug("Running command: " + command + " ("+options.env+"), cwd:" + options.cwd);
            
            legacy.run.command(command, options);
            $(w).trigger("scope_after_command", shell.commandArray);
        }
        
        commando.hide();
    };
    
    var parseOptions = function(shell)
    {
        shell.options.runIn = prefs.getString('commando_shell_output');
        
        shell.command = shell.command.filter(function(cmdlet)
        {
            switch (cmdlet)
            {
                case ':ok':
                    shell.options.runIn = "command-output-window";
                    return false;
                case ':ot':
                    shell.options.runIn = "new-console";
                    return false;
                case ':oi':
                    shell.options.runIn = "no-console";
                    shell.options.insertOutput = true;
                    return false;
                case ':on':
                    shell.options.runIn = "no-console";
                    return false;
                case ':os':
                    shell.options.runIn = "hud";
                    return false;
            }
            
            return true;
        });
        
        return shell;
    };
    
    this.sort = function(current, previous)
    {
        return previous.name.localeCompare(current.name) > 0 ? 1 : -1;
    };
    
}).apply(module.exports);
