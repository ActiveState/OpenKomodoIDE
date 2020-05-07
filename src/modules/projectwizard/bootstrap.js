const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
Cu.import('resource://gre/modules/Services.jsm');

var startupData;

function loadIntoWindow(window) {
    try {
        var require = window.require;
        
        require("ko/commands").register(
            "openProjectwizard",
            () =>
            {
                window.ko.windowManager.openDialog("chrome://projectwizard/content/dialog/projectWizard.xul");
            },
            {
                label:"Start New Project Wizard",
                isEnabled: true
            });
        var $ = require("ko/dom").window(require("ko/windows").getMain());
        var $menuitem = require("ko/ui/menuitem").create({label: "New Project...", id:"menu_projectNewProject", observes:"cmd_openProjectwizard"}).$element;
        $("#menu_project_separator_1").after($menuitem);
        
        // Normally this would go under the install controller, but since we
        // package this module with Komodo this would never get called
        var prefs = require("ko/prefs");
        if ( ! prefs.getString("projects-dir", ""))
        {
            var sys = require("sdk/system");
            var file = require("ko/file");
            var prefPath = file.join(sys.pathFor("Home"), "Workspace");
            require("ko/prefs").setStringPref("projects-dir", prefPath);
        }
        
    } catch (e) {
        Cu.reportError("Commando: Exception while registering 'projectwizard'");
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
