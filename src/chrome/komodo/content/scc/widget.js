(function() {
    
    var $ = require("ko/dom");
    var _ = require("contrib/underscore");
    var w = require("ko/windows").getMain();
    var ko = w.ko;
    var currentRoot;
    
    ko.scc.widget = this;
    
    var widgetTab;
    var tabs;
    var browsers;
    
    this.enabled = false;
    
    this.init = () =>
    {
        // scc is slow, we want to get a head start
        ko.scc.getRepositoryRoot();
        
        widgetTab = $(ko.widgets.getWidget("scc-widget").tab);
        
        browsers = {
            commit: document.getElementById('scc-browser-commit'),
            history: document.getElementById('scc-browser-history'),
            historyFile: document.getElementById('scc-browser-history-file'),
            log: document.getElementById('scc-browser-log')
        };
        
        tabs = {
            commit: document.getElementById('scc-tab-commit'),
            history: document.getElementById('scc-tab-history'),
            historyFile: document.getElementById('scc-tab-history-file'),
            log: document.getElementById('scc-tab-log')
        };
        
        // Don't load these modals too soon
        ko.workspace2.waitForProjectManager(() => {
            browsers.commit.setAttribute("src", browsers.commit.getAttribute("_src"));
            browsers.history.setAttribute("src", browsers.history.getAttribute("_src"));
            browsers.historyFile.setAttribute("src", browsers.historyFile.getAttribute("_src"));
            browsers.log.setAttribute("src", browsers.log.getAttribute("_src"));
            
            this.reload();
        });
        
        var reload = _.debounce(this.reload.bind(this, true), 100);
        
        widgetTab.on("command", reload);
        //widgetTab.on("command", function() { console.log('reload'); });
        
        w.addEventListener("current_place_opened", reload);
        w.addEventListener("SCC", reload);
        
        var observerSvc = Components.classes["@mozilla.org/observer-service;1"]
                                        .getService(Components.interfaces.nsIObserverService);
        observerSvc.addObserver(this.observer, "file_status", false);
    };
    
    this.reload = (retry = true, e = null) =>
    {
        this.enabled = false;
        
        if ( ! ko.uilayout.isTabShown('scc-widget'))
        {
            return;
        }
        
        var root = ko.scc.getRepositoryRoot();
        if (root == currentRoot)
        {
            return;
        }
        
        currentRoot = root;
        
        this.enabled = !! ko.scc.getCurrentService();
        document.getElementById("deck").setAttribute("selectedIndex", this.enabled ? 0 : 1);
        
        // Retry grabbing SCC info after 2 seconds
        // This is to deal with our flaky async SCC
        if ( ! this.enabled && retry)
            setTimeout(this.reload.bind(null, false), 2000);
        else
        {
            $("tab[selected='true']", window).trigger("command");
        }
    };
    
    window.reload = this.reload;
    
    this.getTab = (name) =>
    {
        return tabs[name];
    };
    
    this.shouldReload = (name) =>
    {
        this.reload();
        
        if ( ! this.enabled)
            return;
        
        if ( ! ko.uilayout.isTabShown('scc-widget'))
            return;
        
        return tabs[name].selected;
    };
    
    this.observer = {
        observe: function (subject, topic, data)
        {
            var url = ko.scc.getRepositoryRoot();
            
            var reload = false;
            var urllist = data.split('\n');
            for (let u of urllist) {
                if (u.indexOf(url) === 0)
                {
                    reload = true;
                    break;
                }
            }
            
            if (reload)
            {
                this.reload(false);
            }
        }.bind(this)
    };
    
    window.addEventListener("load", this.init);
    if (document.readyState == "complete")
        this.init();
    
})();