(function()
{
    
    const log   = require("ko/logging").getLogger("unittest");
    const panel = require("unittest/panel");
    const ko    = require("ko/windows").getMain().ko;
    const prefs = require("ko/prefs");
    const {Cc, Ci}  = require("chrome");
    const koFile = require("ko/file");
    
    var handlers = {};
    var parsers = {};
    var configCache = {}; // keep a reference to configs we've seen

    this.register = () =>
    {
        panel.register();
        
        this.registerHandler({
            id: "phpunit",
            namespace: "unittest/handlers/phpunit",
            label: "PHPUnit",
            language: "PHP",
            parser: "teamcity",
            command: "phpunit --teamcity"
        });
        this.registerHandler({
            id: "pytest",
            namespace: "unittest/handlers/pytest",
            label: "pytest",
            language: "Python",
            parser: "pytest",
            command: "python -m pytest --tb short --color no -vr a -o console_output_style=classic"
        });
        this.registerHandler({
            id: "pytest3",
            namespace: "unittest/handlers/pytest3",
            label: "pytest",
            language: "Python3",
            parser: "pytest",
            command: "python3 -m pytest --tb short --color no -vr a -o console_output_style=classic"
        });
        this.registerHandler({
            id: "prove",
            namespace: "unittest/handlers/prove",
            label: "prove",
            language: "Perl",
            parser: "tap",
            command: "prove -vlrfm --normalize --nocolor"
        });
        this.registerHandler({
            id: "mocha",
            namespace: "unittest/handlers/mocha",
            label: "Mocha",
            language: "Node.js",
            parser: "tap",
            command: "mocha --reporter mocha-ko-tap-reporter"
        });
        this.registerHandler({
            id: "rspec",
            namespace: "unittest/handlers/rspec",
            label: "RSpec",
            language: "Ruby",
            parser: "tap",
            command: "rspec -f RspecTap::Formatter"
        });
        this.registerHandler({
            id: "go",
            namespace: "unittest/handlers/go",
            label: "testing",
            language: "Go",
            parser: "go",
            command: "go test -v"
        });
        this.registerHandler({
            id: "custom",
            namespace: "unittest/handlers/custom",
            label: "Custom",
            parser: "tap",
            command: ""
        });
        
        this.registerParser({ id: "tap", namespace: "unittest/parsers/tap", label: "TAP (Test Anything Protocol)" });
        this.registerParser({ id: "teamcity", namespace: "unittest/parsers/teamcity", label: "TeamCity" });
        this.registerParser({ id: "go", namespace: "unittest/parsers/go", label: "Go testing" });
        this.registerParser({ id: "pytest", namespace: "unittest/parsers/pytest", label: "pytest" });
    };
    
    this.registerParser = (opts) =>
    {
        parsers[opts.id] = opts;
    };
    
    this.getParsers = () =>
    {
        return parsers;
    };
    
    this.getParser = (id) =>
    {
        if ( ! (id in parsers))
            return false;
        
        return parsers[id];
    };
    
    this.registerHandler = (opts) =>
    {
        handlers[opts.id] = opts;
    };
    
    this.getHandlers = () =>
    {
        return handlers;
    };
    
    this.getHandler = (id) =>
    {
        if ( ! (id in handlers))
            return false;
        
        return handlers[id];
    };
    
    this.addConfig = (config) =>
    {
        // This only updates the cache, real creation is done in editor.js
        
        configCache[config.id] = config;
    };
    
    this.deleteConfig = (config) =>
    {
        // This only updates the cache, real deletion is done in editor.js
        
        if (config.id in configCache)
            delete configCache[config.id];
    };
    
    this.getConfig = (id) =>
    {
        if (id in configCache)
            return configCache[id];
        
        var configs = this.getConfigs();
        for (let config of configs)
        {
            if (config.id == id)
                return config;
        }
        
        return false;
    };
    
    this.getConfigs = () =>
    {
        var prefsets = [prefs];
        var configs = [];
        
        if (ko.projects.manager.currentProject)
            prefsets.push(ko.projects.manager.currentProject.prefset);
            
        if (ko.views.manager.currentView && ko.views.manager.currentView.koDoc)
            prefsets.push(ko.views.manager.currentView.koDoc.prefs);
        
        for (let prefset of prefsets)
        {
            if ( ! prefset.hasPrefHere("unittest-configs")) // Don't use inherited prefs
                continue;
            
            prefset = prefset.getPref("unittest-configs");
            for (let id of prefset.getAllPrefIds())
            {
                let config = prefset.getPref(id);

                if ( ! config.getString("saveTo", ""))
                {
                    config.parent.deletePref(config.id);
                    continue;
                }

                configs.push(config);
                configCache[id] = prefset.getPref(id);
            }
        }
        
        return configs;
    };
    
    this.run = (config, handleResultsCb, completionCb) =>
    {
        var prefset = config;
        
        if (typeof config == "string")
            prefset = this.getConfig(config);
        
        if ( ! prefset)
            return log.error("The given unit test configuration could not be found: " + config);
        
        var handler = prefset.getString("handler");
        if ( ! (handler in handlers))
            return require("ko/dialogs").alert("The selected unit test configuration uses a framework that is not available: " + handler);
        
        handler = handlers[handler];
        
        return require(handler.namespace).run(prefset, handleResultsCb, completionCb);
    };
    
    this.getWorkingDirectory = (config) =>
    {
        var cwd = config.getString("path");
        
        var placesCwd = ko.uriparse.URIToLocalPath(ko.places.getDirectory());
        var projectCwd = ko.projects.manager.currentProject ? ko.projects.manager.currentProject.liveDirectory : false;
        
        if (cwd.indexOf(projectCwd) === 0)
            cwd = projectCwd;
        else if (cwd.indexOf(placesCwd) === 0)
            cwd = placesCwd;
            
        return cwd;
    };
    
    /**
     * Get the real file location for the given location object and config
     *
     * location { path: .., line: .., symbol: ..}
     */
    this.getLocation = (location, config, callback) =>
    {
        var path, line, symbol;
        
        cwd = this.getWorkingDirectory(config);
        
        if (location)
        {
            if (location.path)
            {
                var _path = location.path;
                var fullPath = koFile.join(config.getString("path"), _path);
                
                if (koFile.isFile(fullPath))
                    path = fullPath;
                else if (koFile.isFile(_path))
                    path = _path;
            }
            
            if (location.line)
                line = location.line;
                
            if (location.symbol)
                symbol = location.symbol;
        }
        
        if (path && line)
            return callback(path, line, cwd);
        
        if ( ! symbol)
            return callback(false, false, cwd);
        
        var sectionScope = Cc["@activestate.com/commando/koScopeSections;1"].getService(Ci.koIScopeSections);
        var uuid = require('sdk/util/uuid');
        var handler = this.getHandler(config.getString("handler"));
        var results = [];
        
        var onComplete = () =>
        {
            var result = false;
            for (let _result of results)
            {
                if ( ! result || _result.weight > result.weight)
                    result = _result;
            }
            
            if ( ! result)
            {
                return callback(false, false, cwd);
            }
            
            callback(result.data.filepath, result.data.lineno, cwd);
        };
        
        sectionScope.onSearch(symbol, uuid.uuid(), cwd, path || cwd, handler.language || "", function(status, data) {
            results = results.concat(JSON.parse(data));
        }.bind(this), onComplete);
    };
    
}).apply(module.exports);
