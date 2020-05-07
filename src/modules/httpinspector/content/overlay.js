if (typeof(ko) == 'undefined') {
    var ko = {};
}

ko.httpinspector = {};

/**
 * Open the HTTPInspector window.
 */
ko.httpinspector.open = function() {
    return ko.windowManager.openOrFocusDialog("chrome://httpinspector/content/httpInspector.xul",
                      "komodo_httpinspector",
                      "chrome,all,close=yes,resizable,dependent=no");
};

window.addEventListener("komodo-ui-started",
    function() {
        if (ko.prefs.getBoolean('httpInspector_enabledAtStartup', false)) {
            // Create the HTTP Inspector service, which is will start itself up.
            Components.classes["@activestate.com/koHttpInspector;1"].
                getService(Components.interfaces.koIHttpInspector);
        }
    }
);
