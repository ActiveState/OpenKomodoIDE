(function()
{
    
    const {Cc, Ci}  = require("chrome");
    const log = require("ko/logging").getLogger("codeintel");
    const process = require("codeintel/process");
    const service = require("codeintel/service");
    const mediator = require("codeintel/service/mediator");
    const stylesheet = require("ko/stylesheet");
    const legacy = require("ko/windows").getMain().ko;
    const timers = require("sdk/timers");
    const prefs = require("ko/prefs");
    const observerSvc = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
    const isWindows = require("sdk/system").platform.toLowerCase() == "winnt";
    const pathSep = isWindows ? ";" : ":";
    const langReg = Cc['@activestate.com/koLanguageRegistryService;1'].getService(Ci.koILanguageRegistryService);
    const koEnviron = Cc["@activestate.com/koUserEnviron;1"].getService();
    const l = require("ko/locale").use();

    this.FEATURE_COMPLETIONS = "completions";
    this.FEATURE_CALLTIPS = "calltips";
    this.FEATURE_SYMBOLBROWSER = "symbolbrowser";
    this.FEATURE_SYMBOLLIST = "symbollist";
    this.FEATURE_SYMBOLSCOPE = "symbolscope";
    this.FEATURE_SCANNER = "scanner";
    this.FEATURE_GOTODEF = "gotodef";
    this.FEATURE_JUMPSECTIONS = "jumpsections";
    this.FEATURE_FINDREFERENCES = "findreferences";

    var features = [
        this.FEATURE_COMPLETIONS,
        this.FEATURE_CALLTIPS,
        this.FEATURE_SYMBOLBROWSER,
        this.FEATURE_SYMBOLLIST,
        this.FEATURE_SYMBOLSCOPE,
        this.FEATURE_SCANNER,
        this.FEATURE_GOTODEF,
        this.FEATURE_JUMPSECTIONS,
        this.FEATURE_FINDREFERENCES,
    ];

    //log.setLevel(10);

    
    var storage = require("ko/session-storage").get("codeintel").storage;

    var socket = storage.socket || null;
    var client = storage.client || null;

    var keepaliveTimer;
    var featuresLoaded = false;
    var getLangDirList = () =>
    {
        let languageDirs = [];
        let langs = [
            "JavaScript",
            "PHP",
            "Python",
            "Python3",
            "Tcl",
            "Ruby",
            "Perl",
            "Node.js"
        ];
        for (let lang of langs)
        {
            languageDirs.push(langReg.getLanguage(lang).importPref);
        }
        return languageDirs;
    };
    var languageDirs = getLangDirList();

    this.getClient = () =>
    {
        return client;
    };

    var init = () =>
    {
        if (storage.running)
        {
            loadFeatures();
        }
        else
        {
            storage.running = true;
            this.start();
        }
        stylesheet.loadGlobal("less://codeintel/skin/style/codeintel.less");
        require("ko/prefs").registerCategory(
            l.get("code_intelligence"),
            "chrome://codeintel/content/prefs.xul",
            "uiSettingsItem"
         );
    };
    
    var pathIncludePrefHandler = (event, prefname, triggerPref) =>
    {
        if(languageDirs.indexOf(triggerPref) >= 0 )
        {
            require("codeintel/feature/scanner").scanCurrentWorkingDirectory();
        }
    };
    
    this.start = () =>
    {
        process.start();
        process.on("started", onServerReady);
        observerSvc.addObserver(stopObserver, "quit-application", false);

        // Remove just in case Codeintel was stopped but Komodo didn't
        // restart.
        require("ko/prefs").removeOnChange("__all__", pathIncludePrefHandler);
        require("ko/prefs").onChange("__all__", pathIncludePrefHandler.bind(this));
        keepalive();
    };

    var stopObserver = { observe: this.stop };

    this.stop = () =>
    {
        log.info("Stop called");

        unloadFeatures();

        this.stopSocket();
        process.stop();

        observerSvc.removeObserver(stopObserver, "quit-application");
        
        timers.clearTimeout(keepaliveTimer);

        mediator.unregister("codeintel/service/mediator/codeintel");
    };

    this.stopSocket = () =>
    {
        if (socket)
            socket.close();

        socket = storage.socket = null;
        client = storage.client = null;
    };
    
    this.isFeatureEnabled = (feature) =>
    {
        return prefs.getBoolean(`codeintel.${feature}.enabled`);
    };
    
    this.getImportPaths = (prefset, language) =>
    {
        var languageObj = langReg.getLanguage(language);
        if ( ! languageObj)
            return [];
        
        var languageInfo = service._getLanguageInfo(language);

        var importPaths = [];
        if (languageInfo)
        {
            var key = languageInfo.extrapaths;
            importPaths = koEnviron.getEnvVar(key, prefset).split(pathSep);
        }

        // Append additional import paths, if any
        if (languageObj.importPref)
        {
            var importPref = prefset.getString(languageObj.importPref, "");
            if (importPref)
            {
                importPaths = importPaths.concat(importPref.split(pathSep));
            }
        }

        importPaths = importPaths.filter((p) => !!p);

        return importPaths;
    };
    
    var keepalive = () =>
    {
        // This function is not responsible for restarting the process,
        // just for sending the keepalive requests

        if (process.get("status") == process.STATUS_STARTED)
        {
            service.keepalive();
        }
        
        keepaliveTimer = timers.setTimeout(keepalive, prefs.getLong("codeintel.keepalive.interval"));
    };

    var loadFeatures = () =>
    {
        for (let feature of features)
        {
            if ( ! this.isFeatureEnabled(feature))
            {
                log.debug("Not loading disabled feature: " + feature);
                continue;
            }
            
            try
            {
                log.debug("Loading feature: " + feature);
                require("codeintel/feature/" + feature).start();
            } catch (e)
            {
                log.exception(e, "Exception while loading feature: " + feature);
            }
        }
    };
    
    var unloadFeatures = () =>
    {
        for (let feature of features)
        {
            try
            {
                log.debug("Unloading feature: " + feature);
                require("codeintel/feature/" + feature).stop();
            } catch (e)
            {
                log.exception(e, "Exception while unloading feature: " + feature);
            }
        }
    };
    
    var onServerReady = () =>
    {
        socket = storage.socket = require("ko/socket/tcp").open("127.0.0.1", process.get("port"));
        client = storage.client = require("ko/jsonrpc").create(socket);
        
        if (featuresLoaded)
            return;
        
        var mediators = [
            ["codeintel/service/mediator/codeintel", l.get("engine.codeintel")],
            ["codeintel/service/mediator/legacy", l.get("engine.legacy")],
        ];
        var c = 0;
        var onDone = () =>
        {
            if (++c == mediators.length)
                onServiceReady();
        };

        for (let m of mediators)
        {
            let [namespace, name] = m;
            service.getLanguages({}, { mediator:  namespace })
            .then((languages) =>
            {
                for (let lang in languages)
                {
                    try
                    {
                        let language = languages[lang];
                        mediator.register(namespace, name + ": " + lang, lang, language);
                    }
                    catch (e)
                    {
                        log.exception(e, "Failed registering mediator: " + name + ", language: " + language);
                    }
                }
                onDone();
            }).catch(onDone);
        }
    };

    var onServiceReady = () =>
    {
        loadFeatures();

        require("ko/dom")(require("ko/windows").getMain()).trigger("codeintel-ready");

        featuresLoaded = true;
    };
    
    init();
    
}).apply(module.exports);
