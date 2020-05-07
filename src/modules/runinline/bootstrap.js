const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
Cu.import('resource://gre/modules/Services.jsm');

var startupData;

function loadIntoWindow(window) {
    try {
        var require = window.require;
        
        require.setRequirePath("runinline/", "chrome://runinline/content/sdk/");
        
        var isEnabled = function()
        {
            var editor = require("ko/editor");
            var view = require("ko/views").current();
            if ( !view || ! editor.scimoz())
                return false;
            
            var language = view.language;
            
            var invoker;
            if ("@activestate.com/koInvocation;1?type=" + language in Cc)
                invoker = Cc["@activestate.com/koInvocation;1?type=" + language].createInstance();
            
            return !! invoker;
        };
        
        var dynBtn = require("ko/dynamic-button");
        dynBtn.register("Run File/Selection In-line", {
            icon: "power2",
            events: ["current_view_changed", "current_view_language_changed", "workspace_restored"],
            isEnabled: isEnabled,
            command: "cmd_runInLine",
            ordinal: 300,
            group: "preview",
            groupOrdinal: 200,
        });
        
        require("ko/commands").register("runInLine", function() { require("runinline").run() },
        {
            label: "Run File/Selection In-line",
            isEnabled: isEnabled
        });
        
    } catch (e) {
        Cu.reportError("Commando: Exception while registering 'runinline'");
        Cu.reportError(e);
    }
}

function unloadFromWindow(window) {
    if (!window) return;
}

var windowListener = {
    onOpenWindow: function(aWindow) {
        // Wait for the window to finish loading
        let domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
        domWindow.addEventListener("komodo-ui-started", function onLoad() {
            domWindow.removeEventListener("komodo-ui-started", onLoad, false);
            loadIntoWindow(domWindow);
        }, false);
    },

    onCloseWindow: function(aWindow) {},
    onWindowTitleChange: function(aWindow, aTitle) {}
};

function startup(data, reason) {
    startupData = data;

    // Load into any existing windows
    let windows = Services.wm.getEnumerator("Komodo");
    while (windows.hasMoreElements()) {
        let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
        loadIntoWindow(domWindow);
    }

    // Load into any new windows
    Services.wm.addListener(windowListener);
}

function shutdown(data, reason) {
    // When the application is shutting down we normally don't have to clean
    // up any UI changes made
    if (reason == APP_SHUTDOWN) return;

    // Stop listening for new windows
    Services.wm.removeListener(windowListener);

    // Unload from any existing windows
    let windows = Services.wm.getEnumerator("Komodo");
    while (windows.hasMoreElements()) {
        let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
        unloadFromWindow(domWindow);
    }
}

function install(data, reason) {}

function uninstall(data, reason) {}
