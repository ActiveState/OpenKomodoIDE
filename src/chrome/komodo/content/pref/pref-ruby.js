/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

//---- globals
var _findingInterps = false;
var prefExecutable = null;
var appInfoEx = null;
var programmingLanguage = "Ruby";
var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
            .getService(Components.interfaces.nsIStringBundleService)
            .createBundle("chrome://komodo/locale/pref/pref-languages.properties");
//---- functions

function OnPreferencePageOK(prefset)
{
    return checkValidInterpreterSetting(prefset,
                                        "rubyDefaultInterpreter",
                                        programmingLanguage);
}

function OnPreferencePageSaved(prefset)
{
    var prefName = programmingLanguage.toLowerCase()+"ExtraPaths";
     var extraPaths = document.getElementById(prefName);
     var paths = extraPaths.getData();
     if(paths == "")
     {
        prefset.deletePref(prefName);
        // Force the prefs to be written to file.
        Components.classes["@activestate.com/koPrefService;1"].getService(Components.interfaces.koIPrefService).saveState();
     }
}

// Populate the (tree) list of available Ruby interpreters on the current
// system.
function PrefRuby_PopulateRubyInterps()
{
    var availInterpList = document.getElementById("rubyDefaultInterpreter");

    // remove any existing items and add a "finding..." one
    _findingInterps = true;
    availInterpList.removeAllItems();
    availInterpList.appendItem(_bundle.formatStringFromName("findingInterpreters.label", [programmingLanguage], 1));

    // get a list of installed Ruby interpreters
    var numFound = new Object();
    var availInterps = appInfoEx.FindExecutables(numFound);
    availInterpList.removeAllItems();
    availInterpList.appendItem(_bundle.GetStringFromName("findOnPath.label"),'');

    var found = false;
    // populate the tree listing them
    if (availInterps.length == 0) {
        // tell the user no interpreter was found and direct them to
        // ActiveState to get one
        document.getElementById("no-avail-interps-message").removeAttribute("collapsed");
    } else {
        for (var i = 0; i < availInterps.length; i++) {
            availInterpList.appendItem(availInterps[i],availInterps[i]);
            if (availInterps[i] == prefExecutable) found = true;
        }
    }
    if (!found && prefExecutable) {
        availInterpList.appendItem(prefExecutable,prefExecutable);
        appInfoEx.executablePath = prefExecutable;
    }
    PrefRuby_checkVersion();
    document.getElementById("no-avail-interps-message").setAttribute("collapsed", "true");
    _findingInterps = false;
}

function PrefRuby_checkVersion()
{
    var availInterpList = document.getElementById('rubyDefaultInterpreter');
    var interpreter = availInterpList.value;
    var numFound = new Object();
    var availInterps = appInfoEx.FindExecutables(numFound);
    if (availInterpList.selectedItem && typeof(availInterpList.selectedItem.value) != 'undefined') {
        interpreter = availInterpList.selectedItem.value;
    }
    if (!interpreter && availInterps.length > 1) {
        interpreter = availInterps[1];
    }
    appInfoEx.executablePath = interpreter;
    //dump("check version interpreter "+interpreter+" ver "+appInfoEx.version+" valid? "+appInfoEx.valid_version+"\n");
    if (!appInfoEx.valid_version) {
        document.getElementById("invalid-version-message").removeAttribute("collapsed");
    } else {
        document.getElementById("invalid-version-message").setAttribute("collapsed", "true");
    }
}

function PrefRuby_OnLoad()
{
    appInfoEx = Components.classes["@activestate.com/koAppInfoEx?app=Ruby;1"].
            createInstance(Components.interfaces.koIAppInfoEx);
    prefExecutable = parent.hPrefWindow.prefset.getString('rubyDefaultInterpreter', '');
    PrefRuby_PopulateRubyInterps();

    var origWindow = ko.windowManager.getMainWindow();
    var cwd = origWindow.ko.window.getCwd();
    parent.hPrefWindow.onpageload();
    var extraPaths = document.getElementById("rubyExtraPaths");
    extraPaths.setCwd(cwd)
    extraPaths.init() // must happen after onpageload
    var file = getOwningFileObject();
    if (file && file.dirName) {
        extraPaths.setCwd(file.dirName);
    }
}

function loadRubyExecutable()
{
    if (loadExecutableIntoInterpreterList("rubyDefaultInterpreter")) {
        PrefRuby_checkVersion();
    }
}

function loadRubyLogpath()
{
    var prefName = "rubyDebug.defaultDir";
    var textbox = document.getElementById("ruby_debuggerlogpath");
    var defaultDir = ko.filepicker.getExistingDirFromPathOrPref(textbox.value, prefName);
    var rubyLog = ko.filepicker.getFolder(defaultDir);
    if (rubyLog != null) {
        textbox.value = rubyLog;
        ko.filepicker.internDefaultDir(prefName, rubyLog);
    }
}


