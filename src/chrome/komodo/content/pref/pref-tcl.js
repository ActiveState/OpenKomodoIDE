/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

//---- globals
var dialog;
var wishExecutable = null;
var tclExecutable = null;
var log = ko.logging.getLogger('prefs.tcl');

//---- functions

function PrefTcl_OnLoad()
{
    try {
        dialog = {};

        if (parent.hPrefWindow.prefset.hasStringPref('tclshDefaultInterpreter') &&
            parent.hPrefWindow.prefset.getStringPref('tclshDefaultInterpreter')) {
            tclExecutable = parent.hPrefWindow.prefset.getStringPref('tclshDefaultInterpreter');
        } else {
            tclExecutable = '';
            parent.hPrefWindow.prefset.setStringPref('tclshDefaultInterpreter', '');
        }

        if (parent.hPrefWindow.prefset.hasStringPref('wishDefaultInterpreter') &&
            parent.hPrefWindow.prefset.getStringPref('wishDefaultInterpreter')) {
            wishExecutable = parent.hPrefWindow.prefset.getStringPref('wishDefaultInterpreter');
        } else {
            wishExecutable = '';
            parent.hPrefWindow.prefset.setStringPref('wishDefaultInterpreter', '');
        }

        if (!parent.hPrefWindow.prefset.hasStringPref('tclExtraPaths')) {
            parent.hPrefWindow.prefset.setStringPref('tclExtraPaths', '');
        }

        PrefTcl_InsertFindingMessage(document.getElementById("wishDefaultInterpreter"));
        PrefTcl_InsertFindingMessage(document.getElementById("tclshDefaultInterpreter"));
        PrefTcl_PopulateTclInterps();

        parent.hPrefWindow.onpageload();
    } catch (e) {
        log.exception(e);
    }
}

function OnPreferencePageSaved(prefset)
{
    var prefName = "tclExtraPaths";
     var extraPaths = document.getElementById(prefName);
     var paths = extraPaths.getData();
     if(paths == "")
     {
        prefset.deletePref(prefName);
        // Force the prefs to be written to file.
        Components.classes["@activestate.com/koPrefService;1"].getService(Components.interfaces.koIPrefService).saveState();
     }
}

function OnPreferencePageLoading() {
    var file = getOwningFileObject();
    if (file && file.dirName) {
        var extraPaths = document.getElementById("tclExtraPaths");
        extraPaths.init();
        extraPaths.setCwd(file.dirName)
    }
}


function OnPreferencePageOK(prefset)
{
    var ok = true;

    // ensure that the default tcl interpreters are valid
    var prefNames = {"tclshDefaultInterpreter": "Tcl",
                     "wishDefaultInterpreter": "Tcl Wish"};
    for (var interpreterPrefName in prefNames) {
        if (!checkValidInterpreterSetting(prefset,
                                          interpreterPrefName,
                                          prefNames[interpreterPrefName],
                                          "tclItem")) {
            return false;
        }
    }
    return true;
}

function PrefTcl_PopulateTclInterps()
{
    // Populate the (tree) list of available Tcl interpreters on the current
    // system.

    var tclInfoEx = Components.classes["@activestate.com/koAppInfoEx?app=Tcl;1"]
                     .createInstance(Components.interfaces.koITclInfoEx);

    var os = Components.classes["@activestate.com/koOs;1"]
                     .createInstance(Components.interfaces.koIOs);

    var numFound = new Object();
    var availInterps = tclInfoEx.FindInstallationPaths(numFound);
    var licensedTclsh = Array();
    var licensedWish = Array();
    var unlicensedInstalls = Array();

    for (var i = 0; i < availInterps.length; ++i){
        tclInfoEx.installationPath = availInterps[i];
        var tclsh_path = tclInfoEx.tclsh_path;
        if (os.path.exists(tclsh_path) && licensedTclsh.indexOf(tclsh_path) == -1) {
            licensedTclsh.push(tclsh_path)
        }
        var wish_path = tclInfoEx.wish_path;
        if (os.path.exists(wish_path) && licensedWish.indexOf(wish_path) == -1) {
            licensedWish.push(wish_path)
        }
    }

    PrefTcl_PopulateTclshInterps(licensedTclsh);
    PrefTcl_PopulateWishInterps(licensedWish);
}

function PrefTcl_InsertFindingMessage(availInterpList)
{
    // remove any existing items and add a "finding..." one
    availInterpList.removeAllItems();
    availInterpList.appendItem("Finding available Tcl interpreters...");
}

function PrefTcl_PopulateTclshInterps(availInterps)
{
    var availInterpList = document.getElementById("tclshDefaultInterpreter");

    availInterpList.removeAllItems();
    availInterpList.appendItem("Find on Path",'');

    var found = false;
    // populate the tree listing them
    if (availInterps.length == 0) {
        // tell the user no interpreter was found and direct them to
        // ActiveState to get one
        document.getElementById("no-avail-tclsh-interps-message").removeAttribute("collapsed");
    } else {
        for (var i = 0; i < availInterps.length; i++) {
            availInterpList.appendItem(availInterps[i],availInterps[i]);
            if (availInterps[i] == tclExecutable) found = true;
        }
    }
    if (!found && tclExecutable)
        availInterpList.appendItem(tclExecutable,tclExecutable);
}

// Populate the (tree) list of available Tcl wish interpreters on the current
// system.
function PrefTcl_PopulateWishInterps(availInterps)
{
    var availInterpList = document.getElementById("wishDefaultInterpreter");

    availInterpList.removeAllItems();
    availInterpList.appendItem("Find on Path",'');

    var found = false;
    // populate the tree listing them
    if (availInterps.length == 0) {
        // tell the user no interpreter was found and direct them to
        // ActiveState to get one
        document.getElementById("no-avail-wish-interps-message").removeAttribute("collapsed");
    } else {
        for (var i = 0; i < availInterps.length; i++) {
            availInterpList.appendItem(availInterps[i],availInterps[i]);
            if (availInterps[i] == wishExecutable) found = true;
        }
    }
    if (!found && wishExecutable)
        availInterpList.appendItem(wishExecutable,wishExecutable);
}

function loadTclExecutable()
{
    loadExecutableIntoInterpreterList("tclshDefaultInterpreter");
}

function loadWishExecutable()
{
    loadExecutableIntoInterpreterList("wishDefaultInterpreter");
}
