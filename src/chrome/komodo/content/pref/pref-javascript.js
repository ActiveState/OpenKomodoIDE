/* Copyright (c) 2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

var log = ko.logging.getLogger("pref-javascript");
//log.setLevel(ko.logging.LOG_INFO);

function PrefJavaScript_OnLoad() {
    populateChromeExecutables();
    parent.initPanel();
}

function OnPreferencePageLoading() {
    var extraPaths = document.getElementById("javascriptExtraPaths");
    extraPaths.init(); // must happen after onpageload
    var file = getOwningFileObject();
    if (file && file.dirName) {
        extraPaths.setCwd(file.dirName);
    }
}

function OnPreferencePageSaved(prefset)
{
    var prefName = "javascriptExtraPaths";
     var extraPaths = document.getElementById(prefName);
     var paths = extraPaths.getData();
     if(paths == "")
     {
        prefset.deletePref(prefName);
        // Force the prefs to be written to file.
        Components.classes["@activestate.com/koPrefService;1"].getService(Components.interfaces.koIPrefService).saveState();
     }
}

function populateChromeExecutables()
{
    var availExeList = document.getElementById("javaScriptChromeExecutable");
    // remove any existing items and add a "finding..." one
    availExeList.removeAllItems();

    // get a list of installed Chrome executables
    var htmlAppInfoEx = Components.classes["@activestate.com/koAppInfoEx?app=HTML;1"].
                            createInstance(Components.interfaces.koIAppInfoEx);
    var numFound = new Object();
    var availExes = htmlAppInfoEx.FindExecutables(numFound);

    var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                .getService(Components.interfaces.nsIStringBundleService)
                .createBundle("chrome://komodo/locale/pref/pref-languages.properties");
    availExeList.appendItem(_bundle.GetStringFromName("findOnPath.label"),'');
    var found = false;
    // populate the tree listing them
    if (availExes.length == 0) {
        // tell the user no executable was found
        document.getElementById("no-avail-exes-message").removeAttribute("collapsed");
    } else {
        availExeList.selectedIndex = 0;
        for (var i=0; i < availExes.length; i++) {
            availExeList.appendItem(availExes[i], availExes[i]);
        }
        // First one on the list is either the preferenced executable or the
        // first one found on the path.
        availExeList.selectedIndex = 1;
    }
}

function loadChromeExecutable()
{
    if (loadExecutableIntoInterpreterList("javaScriptChromeExecutable"))
        document.getElementById("no-avail-exes-message").setAttribute("collapsed", true);
}