/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

//---- globals
var _findingInterps = false;
var availInterps = [];
var programmingLanguage="PHP";
//---- functions
var phpAppInfoEx = null;
var prefExecutable = null;
var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
            .getService(Components.interfaces.nsIStringBundleService)
            .createBundle("chrome://komodo/locale/pref/pref-languages.properties");

/* Functions Related to pref-php.xul */
function PrefPhp_OnLoad()  {
    phpAppInfoEx = Components.classes["@activestate.com/koPHPInfoInstance;1"].
            createInstance(Components.interfaces.koIPHPInfoEx);

    prefExecutable = parent.hPrefWindow.prefset.getString('phpDefaultInterpreter', '');
    PrefPhp_PopulatePHPInterps();

    parent.hPrefWindow.onpageload();
// #if WITH_DEBUGGING
    // find the available PHP interps
    PrefPhp_DebuggerConfiguredMessage();
// #endif
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

function OnPreferencePageLoading() {
    var extraPaths = document.getElementById("phpExtraPaths");
    extraPaths.init() // must happen after onpageload
    var file = getOwningFileObject();
    if (file && file.dirName) {
        extraPaths.setCwd(file.dirName);
    }
}

function PrefPhp_DebuggerConfiguredMessage()
{
// #if WITH_DEBUGGING
    var startTime = new Date();
    var txt = document.getElementById('debugger-configured-msg');
    var statusImage = document.getElementById('php_debugger_config_status_image');
    statusImage.setAttribute("checking", "true");
    statusImage.removeAttribute("configured");
    if (txt.childNodes.length > 0) {
        txt.removeChild(txt.childNodes[0]);
    }
    txt.appendChild(document.createTextNode("Checking..."));
    // Do a setTimeout to update the UI thread, so the user can
    // see that Komodo is checking the configuration.
    setTimeout(PrefPhp_DebuggerConfiguredMessage_Finish, 0,
               startTime, txt, statusImage);
}

function PrefPhp_DebuggerConfiguredMessage_Finish(startTime, txt, statusImage)
{
    var ini = document.getElementById('phpConfigFile').value;
    var availInterpList = document.getElementById('phpDefaultInterpreter');
    var interpreter = availInterpList.value;
    if (availInterpList.selectedItem && typeof(availInterpList.selectedItem.value) != 'undefined') {
        interpreter = availInterpList.selectedItem.value;
    }
    if (!interpreter && availInterps.length > 1) {
        interpreter = availInterps[1];
    }

    phpAppInfoEx.executablePath = interpreter;
    var text = '';
    var configured = false;
    statusImage.setAttribute("configured", "false");
    if (!phpAppInfoEx.valid_version) {
        if (phpAppInfoEx.version == '') { // Bug #73485
            text = "Error determining PHP version; your PHP install may "
                   + "be broken, please check the Komodo Error log for "
                   + "more details.";
        } else {
            text = "WARNING!  PHP Version "+phpAppInfoEx.version+" will not work with the XDebug "+
                   "extension.  You will need to upgrade your version of PHP.";
        }
    } else {
        phpAppInfoEx.cfg_file_path = ini;
        try {
            phpAppInfoEx.autoConfigureDebugger();
            configured = phpAppInfoEx.isDebuggerExtensionLoadable;
        } catch(e) {
            log.exception(e);
        }
        if (configured) {
            text = "Successfully configured for local PHP debugging.";
        } else {
            text = "WARNING!  Failed to configure for local PHP debugging. See Komodo's PHP Debugging documentation for trouble shooting.";
        }
    }
    var endTime = new Date();
    var delayTime = 1000 - (endTime - startTime);
    var doRest = function() {
        txt.removeChild(txt.childNodes[0]); // remove the "checking..." text
        txt.appendChild(document.createTextNode(text));
        statusImage.removeAttribute("checking");
        statusImage.setAttribute("configured", configured);
    };
    if (delayTime > 0) {
        setTimeout(doRest, delayTime);
    } else {
        doRest();
    }
// #endif
}

function OnPreferencePageOK(prefset)
{
    return checkValidInterpreterSetting(prefset,
                                        "phpDefaultInterpreter",
                                        programmingLanguage);
}

// Populate the (tree) list of available PHP interpreters on the current
// system.
function PrefPhp_PopulatePHPInterps()
{
    var availInterpList = document.getElementById("phpDefaultInterpreter");

    // remove any existing items and add a "finding..." one
    _findingInterps = true;
    availInterpList.removeAllItems();
    availInterpList.appendItem(_bundle.formatStringFromName("findingInterpreters.label", [programmingLanguage], 1));

    // get a list of installed PHP interpreters
    var numFound = new Object();
    availInterps = phpAppInfoEx.FindExecutables(numFound);

    availInterpList.removeAllItems();
    availInterpList.appendItem(_bundle.GetStringFromName("findOnPath.label"),'');
    var found = false;
    var item = null;
    // populate the tree listing them
    if (availInterps.length == 0) {
        // tell the user no interpreter was found and direct them to
        // ActiveState to get one
        document.getElementById("no-avail-interps-message").removeAttribute("collapsed");
    } else {
        for (var i = 0; i < availInterps.length; i++) {
            item = availInterpList.appendItem(availInterps[i],availInterps[i]);
            if (availInterps[i] == prefExecutable) {
                availInterpList.selectedItem = item;
                found = true;
            }
        }
    }
    if (!found && prefExecutable) {
        availInterpList.selectedItem =
            availInterpList.appendItem(prefExecutable,prefExecutable);
    }
    _findingInterps = false;
}

function PrefPhp_SelectIni() {
// #if WITH_DEBUGGING
    PrefPhp_DebuggerConfiguredMessage();
// #endif
}

function loadIniFile() {
    var current = document.getElementById("phpConfigFile").value;
    if (!current) {
        current = getDirectoryFromTextObject(document.getElementById("phpDefaultInterpreter"));
    }
    var prefName = "php.iniLocation";
    if (!current) {
        current = ko.filepicker.internDefaultDir(prefName);
    }
    var path = ko.filepicker.browseForFile(null, current, null, "INI", ["INI", "All"]);
    if (path != null) {
        document.getElementById("phpConfigFile").value = path;
        ko.filepicker.updateDefaultDirFromPath(prefName, path);
    }
// #if WITH_DEBUGGING
    PrefPhp_DebuggerConfiguredMessage();
// #endif
}

function loadPHPExecutable() {
    if (loadExecutableIntoInterpreterList("phpDefaultInterpreter")) {
// #if WITH_DEBUGGING
        PrefPhp_DebuggerConfiguredMessage();
// #endif
    }
}
