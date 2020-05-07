/* Copyright (c) 2007 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

function shortprojecttabnamesLoadPreferences() {
    var elMaxNameLen = document.getElementById("extensions.shortprojecttabnames.maxnamelength");
    var prefs = Components.classes["@activestate.com/koPrefService;1"].
                 getService(Components.interfaces.koIPrefService).prefs;
    var maxNameLen = "1";
    // Ensure it's actually there, if it is not and we try to get it we would
    // get an exception.
    if (prefs.hasStringPref("extensions.shortprojecttabnames.maxnamelength")) {
        maxNameLen = prefs.getStringPref("extensions.shortprojecttabnames.maxnamelength");
    }
    elMaxNameLen.value = maxNameLen;
}

function shortprojecttabnamesSavePreferences() {
    var elMaxNameLen = document.getElementById("extensions.shortprojecttabnames.maxnamelength");
    var prefs = Components.classes["@activestate.com/koPrefService;1"].
                 getService(Components.interfaces.koIPrefService).prefs;
    prefs.setStringPref("extensions.shortprojecttabnames.maxnamelength", elMaxNameLen.value);
}
