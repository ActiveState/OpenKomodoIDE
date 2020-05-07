/* Copyright (c) 2000-2011 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

//---- globals
var _findingInterps = false;
var prefExecutable = null;
var prefGuiExecutable = null;
var pdklog = ko.logging.getLogger("PDK");
//pdklog.setLevel(ko.logging.LOG_DEBUG);

//---- functions

function OnPreferencePageOK(prefset)
{
    var ok = true;
    try {

        // ensure that the default pdk installation is valid
        var pdk = document.getElementById("pdkLocation").value;
        if (pdk) {
            var perldevkit = parent.opener.ko.perldevkit;
            if (!perldevkit.info.exists(pdk)) {
                alert("No PDK installation could be found at '" + perldevkit.info.PAIPath(pdk) +
                      "'. You must make another selection for the default " +
                      "PDK installation.\n");
                ok = false;
                document.getElementById("pdkLocation").focus();
            }
        }
    } catch(e) {
        pdklog.exception(e);
    }
    return ok;
}

// Populate the (tree) list of available pdk installations on the current
// system.
function PrefPDK_PopulateInstallations(prefName, executable)
{
    try {
        var availInterpList = document.getElementById(prefName);

        // remove any existing items and add a "finding..." one
        _findingInterps = true;
        availInterpList.removeAllItems();
        availInterpList.appendItem("Finding available PDK installations...");

        // get a list of installed pdk installations
        var perldevkit = parent.opener.ko.perldevkit;
        var availInterps = perldevkit.info.installationPaths(true /* refresh */);

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
        pdklog.exception(e);
    }
}


function PrefPDK_OnLoad()
{
    try {
        if (parent.hPrefWindow.prefset.hasStringPref('pdkLocation')) {
            prefExecutable = parent.hPrefWindow.prefset.getStringPref('pdkLocation');
        } else {
            // create the preference since it doesn't exist
            parent.hPrefWindow.prefset.setStringPref('pdkLocation','')
            prefExecutable = '';
        }
        if (parent.hPrefWindow.prefset.hasStringPref('pdkGuiLocation')) {
            prefGuiExecutable = parent.hPrefWindow.prefset.getStringPref('pdkGuiLocation');
        } else {
            // create the preference since it doesn't exist
            parent.hPrefWindow.prefset.setStringPref('pdkGuiLocation','')
            prefGuiExecutable = '';
        }
        PrefPDK_PopulateInstallations("pdkLocation", prefExecutable);
        PrefPDK_PopulateInstallations("pdkGuiLocation", prefGuiExecutable);

        parent.hPrefWindow.onpageload();
    } catch(e) {
        pdklog.exception(e);
    }
}

function locatePDK(prefName)
{
    try {
        var pdkDir = ko.filepicker.getFolder(document.getElementById(prefName).value,
                                          "PDK Install Directory");
        if (pdkDir != null) {
            var perldevkit = parent.opener.ko.perldevkit;
            if (!perldevkit.info.exists(pdkDir)) {
                var validPdkDir = false;
                if (pdkDir.substr(-3) == "bin") {
                    // Don't want the bin dir, we want the parent dir.
                    var osPathSvc = Components.classes["@activestate.com/koOsPath;1"].
                                        getService(Components.interfaces.koIOsPath);
                    var tryPdkDir = osPathSvc.dirname(pdkDir);
                    if (perldevkit.info.exists(tryPdkDir)) {
                        validPdkDir = true;
                        pdkDir = tryPdkDir;
                        document.getElementById(prefName).value = pdkDir;
                    }
                }
                if (!validPdkDir) {
                    ko.dialogs.alert("Komodo could not find PAI in ["+pdkDir+"].");
                    return;
                }
            }

            var availInterpList = document.getElementById(prefName);
            availInterpList.selectedItem = availInterpList.appendItem(pdkDir, pdkDir);
        }
    } catch(e) {
        pdklog.exception(e);
    }
}
