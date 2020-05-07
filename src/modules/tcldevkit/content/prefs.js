/* Copyright (c) 2000-2009 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

//---- globals
var _findingInterps = false;
var prefExecutable = null;
var tdklog = ko.logging.getLogger("TDK");
//tdklog.setLevel(ko.logging.LOG_DEBUG);

//---- functions

// Called when Ok is clicked in the preferences dialog.
// See src/chrome/komodo/content/pref/koPrefWindow.js
// for an explanation of how Komodo uses callbacks in prefs providers.
function OnPreferencePageOK(prefset)
{
    var ok = true;
    try {

        // ensure that the default tdk installation is valid
        var tdk = document.getElementById("tdkLocation").value;
        if (tdk) {
            var tcldevkit = parent.opener.ko.tcldevkit;
            if (!tcldevkit.info.exists(tdk)) {
                alert("No TDK installation could be found at '" + tcldevkit.info.appPath(tdk,'tclapp') +
                      "'. You must make another selection for the default " +
                      "TDK installation.\n");
                ok = false;
                document.getElementById("tdkLocation").focus();
            }
        }
    } catch(e) {
        tdklog.exception(e);
    }
    return ok;
}

// Populate the (tree) list of available tdk installations on the current
// system. Called on load (see below).
function PrefTDK_PopulateInstallations(prefName, executable)
{
    try {
        var availInterpList = document.getElementById(prefName);

        // remove any existing items and add a "finding..." one
        _findingInterps = true;
        availInterpList.removeAllItems();
        availInterpList.appendItem("Finding available TDK installations...");

        // get a list of installed tdk installations
        var tcldevkit = parent.opener.ko.tcldevkit;
        var availInterps = tcldevkit.info.installationPaths(true /* refresh */);

        availInterpList.removeAllItems();
        availInterpList.appendItem("Find on Path",'');

        var found = false;
        // populate the tree listing them
        if (availInterps.length == 0) {
            // tell the user no interpreter was found and direct them to
            // ActiveState to get one
            document.getElementById("no-avail-interps-message").removeAttribute("collapsed");
        } else {
            for (var i = 0; i < availInterps.length; i++) {
                availInterpList.appendItem(availInterps[i],availInterps[i]);
                if (availInterps[i] == executable) found = true;
            }
        }
        if (!found && executable)
            availInterpList.appendItem(executable,executable);
        _findingInterps = false;
    } catch(e) {
        tdklog.exception(e);
    }
}

// Called from within prefs.xul (onload callback for preferences window)
function PrefTDK_OnLoad()
{
    try {
        if (parent.hPrefWindow.prefset.hasStringPref('tdkLocation')) {
            prefExecutable = parent.hPrefWindow.prefset.getStringPref('tdkLocation');
        } else {
            // create the preference since it doesn't exist
            parent.hPrefWindow.prefset.setStringPref('tdkLocation','')
            prefExecutable = '';
        }
        PrefTDK_PopulateInstallations("tdkLocation", prefExecutable);

        parent.hPrefWindow.onpageload();
    } catch(e) {
        tdklog.exception(e);
    }
}

// Called from within prefs.xul (menulist tdkLocation)
function locateTDK(prefName)
{
    try {
        var tdkDir = ko.filepicker.getFolder(document.getElementById(prefName).value,
                                          "TDK Install Directory");
        if (tdkDir != null) {
            var tcldevkit = parent.opener.ko.tcldevkit;
            if (!tcldevkit.info.exists(tdkDir)) {
                ko.dialogs.alert("Komodo could not find tclapp in ["+tdkDir+"].");
                return;
            }
            var availInterpList = document.getElementById(prefName);
            availInterpList.selectedItem = availInterpList.appendItem(tdkDir, tdkDir);
        }
    } catch(e) {
        tdklog.exception(e);
    }
}
