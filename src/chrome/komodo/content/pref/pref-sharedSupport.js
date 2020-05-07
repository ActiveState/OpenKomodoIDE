/* Copyright (c) 2003-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

//---- globals

var log = ko.logging.getLogger("pref-sharedSupport");
//log.setLevel(ko.logging.LOG_INFO);

var gWidgets = new Object();
var gOsSvc = Components.classes["@activestate.com/koOs;1"].getService();
var gKoDirs = Components.classes["@activestate.com/koDirs;1"].
              getService(Components.interfaces.koIDirs);
var gData = null; // persisted pref panel data


//---- internal support functions

function _setElementDisabled(elt, disabled) {
    if (disabled) {
        elt.setAttribute('disabled', true);
    } else {
        if (elt.hasAttribute('disabled')) {
            elt.removeAttribute('disabled');
        }
    }
}

function _PrefSharedSupport_GetCommonDataDir() {
    var cdd = null;
    if (gWidgets.commonDataDirMethod.value == "default") {
        cdd = gWidgets.defaultCDDTextbox.value;
    } else {
        cdd = gWidgets.customCDDTextbox.value;
    }
    return cdd;
}


//---- functions for XUL

function PrefSharedSupport_OnLoad()
{
    log.info("PrefSharedSupport_OnLoad");
    try {
        gWidgets.commonDataDirMethod = document.getElementById("commonDataDirMethod");
        gWidgets.defaultCDDRadio = document.getElementById("defaultCDDRadio");
        gWidgets.defaultCDDTextbox = document.getElementById("defaultCDDTextbox");
        gWidgets.customCDDRadio = document.getElementById("customCDDRadio");
        gWidgets.customCDDTextbox = document.getElementById("customCDDTextbox");
        gWidgets.pickCustomCDDButton = document.getElementById("pickCustomCDDButton");

        gWidgets.useST = document.getElementById("useST");

        parent.hPrefWindow.onpageload();

        gWidgets.defaultCDDTextbox.value = gKoDirs.factoryCommonDataDir;
        PrefSharedSupport_UpdateCDDUI();
    } catch(ex) {
        log.exception(ex);
    }
}


// Update the Common Data Dir (CDD) UI as appropriate for the current state.
function PrefSharedSupport_UpdateCDDUI()
{
    try {
        var usingDefaultCDD = (gWidgets.commonDataDirMethod.value == "default");
        _setElementDisabled(gWidgets.customCDDTextbox, usingDefaultCDD);
        _setElementDisabled(gWidgets.pickCustomCDDButton, usingDefaultCDD);
    } catch(ex) {
        log.exception(ex);
    }
}

function PrefSharedSupport_ChooseCustomCDD()
{
    try {
        var defaultDir = gWidgets.customCDDTextbox.value;
        if (!defaultDir) defaultDir = null;
        var customDir = ko.filepicker.getFolder(defaultDir,
                                             "Choose Custom Common Data Dir");
        if (customDir) {
            gWidgets.customCDDTextbox.value = customDir;
        }
    } catch(ex) {
        log.exception(ex);
    }
}

function PrefSharedSupport_UpdateSTUI()
{
    try {
        //gWidgets.defaultSTTextbox.value =
        //    gOsSvc.path.join(_PrefSharedSupport_GetCommonDataDir(),
        //                     "toolbox.kpf");

        _setElementDisabled(gWidgets.useST,
            gWidgets.commonDataDirMethod.value == gWidgets.defaultCDDRadio.value);
    } catch(ex) {
        log.exception(ex);
    }
}

function OnPreferencePageOK(prefset)
{
    log.info("PrefSharedSupport_OkCallback(prefset)")
    try {
        var osSvc = Components.classes["@activestate.com/koOs;1"].getService();
        if (typeof(ko.dialogs.alert) == "undefined") ko.dialogs.alert = getKoObject('dialogs').alert;
        if (typeof(ko.dialogs.yesNo) == "undefined") ko.dialogs.yesNo = getKoObject('dialogs').yesNo;

        // Ensure "Common Data Dir" settings are valid
        if (prefset.getStringPref("commonDataDirMethod") == "custom") {
            var customCDD = prefset.getStringPref("customCommonDataDir");
            if (!customCDD) {
                ko.dialogs.alert("The 'Custom Common Data Dir' is empty. "+
                             "You must specify a value.",
                             null, // text
                             "Shared Support Preferences"); // title
                return false;
            } else if (!osSvc.path.isabs(customCDD)) {
                ko.dialogs.alert("The 'Custom Common Data Dir' is not an absolute path. "+
                             "You must specify an absolute path.",
                             null, // text
                             "Shared Support Preferences"); // title
                return false;
            } else if (!osSvc.path.exists(customCDD)) {
                var query = "The chosen custom Common Data Dir, '"+customCDD+
                            "', does not exist. Are you sure that you want "+
                            "to use this directory?";
                var answer = ko.dialogs.yesNo(query, "No", null,
                                          "Shared Support Preferences");
                if (answer != "Yes") {
                    return false;
                }
            }
        }

        // If we got here then everything is valid.
        return true;
    } catch (ex) {
        log.exception(ex);
        var bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
            .getService(Components.interfaces.nsIStringBundleService)
            .createBundle("chrome://komodo/locale/pref/pref-languages.properties");
        return ignorePrefPageOKFailure(prefset,
                bundle.GetStringFromName("AttemptSaveSharedServerInfoFailed"),
                                       e.toString());
    }
}


