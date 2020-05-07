/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

//---- globals
var dialog;
var log = ko.logging.getLogger('prefs.tcl');

//---- functions

function PrefTcl_OnLoad()
{
    try {
        dialog = {};

        var origWindow = ko.windowManager.getMainWindow();
        var cwd = origWindow.ko.window.getCwd();
        parent.hPrefWindow.onpageload();
        var instrumentlist = document.getElementById("tclInstrument");
        instrumentlist.init() // must happen after onpageload
    } catch (e) {
        log.exception(e);
    }
}

function loadTclLogpath()
{
    var prefName = "tclDebug.defaultDir";
    var textbox = document.getElementById("tcl_debuggerlogpath");
    var defaultDir = ko.filepicker.getExistingDirFromPathOrPref(textbox.value, prefName);
    var tclLog = ko.filepicker.getFolder(defaultDir);
    if (tclLog != null) {
        textbox.value = tclLog;
        ko.filepicker.internDefaultDir(prefName, tclLog);
    }
}
