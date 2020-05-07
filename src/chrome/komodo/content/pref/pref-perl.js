/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

//---- globals
var prefExecutable = null;
var programmingLanguage = "Perl";
var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
            .getService(Components.interfaces.nsIStringBundleService)
            .createBundle("chrome://komodo/locale/pref/pref-languages.properties");
//---- functions

function OnPreferencePageOK(prefset)
{
    // ensure that the default perl interpreter is valid
    return checkValidInterpreterSetting(prefset,
                                        "perlDefaultInterpreter",
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
// Populate the (tree) list of available Perl interpreters on the current
// system.
function PrefPerl_PopulatePerlInterps()
{
    var availInterpList = document.getElementById("perlDefaultInterpreter");

    // remove any existing items and add a "finding..." one
    availInterpList.removeAllItems();
    availInterpList.appendItem(_bundle.formatStringFromName("findingInterpreters.label", [programmingLanguage], 1));

    // get a list of installed Perl interpreters
    var sysUtils = Components.classes['@activestate.com/koSysUtils;1'].
        getService(Components.interfaces.koISysUtils);
    var availInterps = new Array();
    availInterps = sysUtils.WhichAll("perl", new Object());

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
    if (!found && prefExecutable)
        availInterpList.appendItem(prefExecutable,prefExecutable);
}


function PrefPerl_OnLoad()
{
    prefExecutable = parent.hPrefWindow.prefset.getString('perlDefaultInterpreter', '');
    PrefPerl_PopulatePerlInterps();

    parent.hPrefWindow.onpageload();
    var extraPaths = document.getElementById("perlExtraPaths");
    extraPaths.init(); // must happen after onpageload
    var file = getOwningFileObject();
    if (file && file.dirName) {
        extraPaths.setCwd(file.dirName);
    }
}

function loadPerlExecutable()
{
    loadExecutableIntoInterpreterList("perlDefaultInterpreter");
}

function loadPerlLogpath()
{
    var prefName = "perlDebug.defaultDir";
    var textbox = document.getElementById("perl_debuggerlogpath");
    var defaultDir = ko.filepicker.getExistingDirFromPathOrPref(textbox.value, prefName);
    var perlLog = ko.filepicker.getFolder(defaultDir);
    if (perlLog != null) {
        textbox.value = perlLog;
        ko.filepicker.internDefaultDir(prefName, perlLog);
    }
}
