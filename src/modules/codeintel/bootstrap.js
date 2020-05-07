const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
Cu.import('resource://gre/modules/Services.jsm');

var startupData;

function loadIntoWindow(window) {
    var require = window.require;
    require.setRequirePath("codeintel/", "chrome://codeintel/content/sdk/");

    var registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    if ( ! ("@activestate.com/codeintel/legacy;1" in Components.classes)) {
        try {
            var component = startupData.installPath.clone();
            component.append("components");
            component.append("component.manifest");

            registrar.autoRegister(component);
        } catch (e) {
            Cu.reportError("CodeIntel: Exception while registering legacy component");
            Cu.reportError(e);
        }
    }
    if ( ! ("@activestate.com/koCodeintel;1" in Components.classes)) {
        try {
            
            var component = startupData.installPath.clone();
            component.append("components");
            component.append("koCodeintel.manifest");

            registrar.autoRegister(component);
        } catch (e) {
            Cu.reportError("CodeIntel: Exception while registering codeintel component");
            Cu.reportError(e);
        }
    }
    
    try
    {
        require("codeintel"); // start the codeintel module
    }
    catch (e)
    {
        Cu.reportError("CodeIntel: Exception while starting");
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
