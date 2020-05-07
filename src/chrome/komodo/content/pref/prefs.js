/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* file contains functionality needed from any window that would want
   to open the prefs dialogs. */

function prefs_doGlobalPrefs(panel, modal /* =false */, fromWindow /* =null */)  {
    if (typeof(modal) == 'undefined' || modal == null) modal = false;

    // Handle cancel from prefs window
    var resp = new Object ();
    resp.res = "";
    try {
        var features = "chrome,resizable,close=yes";
        if (modal) {
            features += ",modal=yes";
        }
        if (fromWindow) {
            // Sometimes we need to open the prefs window from another Komodo
            // modal dialog, in which case we must call the dialog's open
            // method instead of from the main Komodo window - bug 84571.
            fromWindow.openDialog(
                    "chrome://komodo/content/pref/pref.xul",
                    'komodo_prefs',
                    features, panel, resp);
        } else {
            ko.windowManager.openOrFocusDialog(
                    "chrome://komodo/content/pref/pref.xul",
                    'komodo_prefs',
                    features,
                    panel, resp);
        }
    } catch(ex) {
        ko.main.log.error(ex);
        //log.warn("error opening preferences dialog:"+ex);
        return false;
    }
    if (resp.res != "ok") {
        return false;
    }
    return true;
}
