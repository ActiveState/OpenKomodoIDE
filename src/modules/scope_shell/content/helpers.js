(function() {
    
    const log = require("ko/logging").getLogger("commando-scope-shell-helpers")
    const {Cc, Ci} = require("chrome");

    var storage = require("ko/session-storage").get("shell-helpers").storage;


    if ( ! ("injections" in storage))
    {
        storage.injectObserver = false;
        storage.injections = [];
        storage.injectionIds = {};
    }
    
    this.injectInterpreterPref = function(o)
    {
        var id = o.basename + o.prefname;
        if (id in storage.injectionIds)
            return;

        try
        {
            storage.injections.push({
                basename: o.basename,
                siblingSelector: o.siblingSelector,
                prefname: o.prefname,
                caption: o.caption
            });
            storage.injectionIds[id] = true;
        }
        catch (e)
        {
            log.exception("Invalid arguments given", e);
        }
        
        // Register our observer
        if ( ! storage.injectObserver)
        {
            storage.injectObserver = true;
            
            var observerSvc = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
            observerSvc.addObserver(prefWindowObserver, "pref_page_loaded", false);
        }
    }
    
    var prefWindowObserver = {
        observe: function(subject, topic, data)
        {
            for (let o of storage.injections)
            {
                let basename =  o.basename,
                    siblingSelector =  o.siblingSelector,
                    prefname = o.prefname,
                    caption = o.caption;
            
                if (data.indexOf(basename) == -1)
                    continue;
                
                // Find the main pref window
                var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
                var windows = wm.getEnumerator("komodo_prefs");
                var contentWindow;
                try
                {
                    contentWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
                }
                catch (e)
                {
                    if (e.name ==="TypeError")
                    {
                        // Must be a project prefs window rather than global
                        windows = wm.getEnumerator("komodo_projectprefs");
                        contentWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
                    }
                    else
                    {
                        log.debug("Cannot find pref window, skipping injection");
                        throw e;
                    }
                    
                }
                if ( ! contentWindow)
                {
                    log.debug("Cannot find pref window, skipping injection");
                    continue;
                }
                
                // Find the nodejs pref frame
                var frameWindow;
                for (let x=0;x<contentWindow.frames.length;x++)
                {
                    if (contentWindow.frames[x].location.href.indexOf(basename) !== -1)
                    {
                        frameWindow = contentWindow.frames[x];
                        break;
                    }
                }
                if ( ! frameWindow)
                {
                    log.debug("Cannot find frame window, skipping injection");
                    continue;
                }
                
                if ( ! frameWindow.loadExecutableIntoTextField)
                {
                    frameWindow.loadExecutableIntoTextField = function (fieldId)
                    {
                        var field = frameWindow.document.getElementById(fieldId);
                        
                        var currentPath = null;
                        var currentFileName = field.value;
                        if (currentFileName)
                        {
                            let osPath = Cc["@activestate.com/koOsPath;1"].getService(Ci.koIOsPath);
                            let path = osPath.dirname(currentFileName);
                            currentPath = path && osPath.exists(path) ? path : null;
                        }
                        
                        var path = ko.filepicker.browseForExeFile(currentPath);
                        if (path) {
                            field.value = path;
                            return true;
                        }
                        return false;
                    };
                }
                
                // Add our DOM structure
                var $ = require("ko/dom");
                var sibling = $(siblingSelector, frameWindow.document);
                var options = $.create("groupbox",
                    $.create
                    ('caption', {label: caption})
                    ('text', {value: "Use this executable"})
                    ('hbox align="center"',
                        $.create
                        ('textbox', {id:            prefname,
                                     flex:          "1",
                                     pref:          "true",
                                     prefstring:    prefname,
                                     preftype:      "string",
                                     placeholder:   "Find on Path"})
                        ('button', { label:         "Browse",
                                     oncommand:     'loadExecutableIntoTextField("'+prefname+'")'})
                    )
                );
                
                sibling.after(options.toString());
            }
        }
    };
    
}).apply(module.exports);