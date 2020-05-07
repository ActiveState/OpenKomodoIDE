/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */


const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

var myPrefWindow = null;
var startBox;

var gInvocation = null;
var gInvokeType = 0; // what kind of invocation are we displaying?

var gDocInvocationPrefs = null;
var gProjectInvocationPrefs = null;
var gCurrentPrefIsDocument = true;

var gDocumentPrefs = null;
var gProjectPrefs = null;
var gMainWindow= null;
var gInitialDocInvocationNames = [];

var dialog = document.getElementById('dialog-debugging-properties');
dialog.log = ko.logging.getLogger("debugging-properties");

function SetupDialog() {
    try {
        gMainWindow = ko.windowManager.getMainWindow();
        myPrefWindow = new koPrefWindow(null);

        gInvocation = window.arguments[0].invocation;
        gInvokeType = window.arguments[0].invoke_type;
        gDocumentPrefs = window.arguments[0].documentPrefs;
        if (gDocumentPrefs.hasPrefHere('Invocations')) {
            gInitialDocInvocationNames = gDocumentPrefs.getPref('Invocations').getPrefIds();
        }
        gProjectPrefs = window.arguments[0].projectPrefs;

        gDocInvocationPrefs = Components.classes["@activestate.com/koPreferenceSet;1"].createInstance();
        gDocInvocationPrefs.id = "Invocations";
        if (gProjectPrefs && gProjectPrefs.hasPrefHere("Invocations")) {
            gProjectInvocationPrefs = gProjectPrefs.getPref("Invocations");
        }        
        if (gDocumentPrefs.hasPrefHere("Invocations")) {
            gDocInvocationPrefs.update(gDocumentPrefs.getPref('Invocations'));
        } else if (!gProjectInvocationPrefs) {
            // no preexisting invocation prefs, set the ones we have now
            gDocInvocationPrefs.setPref(gInvocation.persistableInstancePreferences.id,
                                     gInvocation.persistableInstancePreferences);
        }
        
        UpdateLabelsForInvokeType();
        FillInvocationPopup();
        UpdateInvocation();

        gMainWindow.gOpeningDialog = false;
    } catch(e) {
        dialog.log.exception(e);
    }
}

function getCurrInvocationPrefset() {
    return gCurrentPrefIsDocument ? gDocInvocationPrefs : gProjectInvocationPrefs;
}

function UpdateLabelsForInvokeType() {
    try {
        var bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                .getService(Components.interfaces.nsIStringBundleService)
                .createBundle("chrome://komodo/locale/debugger.properties");

        switch (gInvokeType) {
            case Components.interfaces.koIInvocation.INVOKE_RUN:
                document.title = bundle.GetStringFromName("invokeRun.title");
                break;
            case Components.interfaces.koIInvocation.INVOKE_PROFILE:
                document.title = bundle.GetStringFromName("invokeProfile.title");
                break;
            default:
                // Just leave it as it already is.
                break;
        }
    } catch(e) {
        dialog.log.exception(e);
    }
}

function getInvocationLanguage() {
    var prefs = gInvocation.currentInstancePreferences;
    var language = prefs.getString("language", "");
    return language || gInvocation.name;
}

function UpdateInvocation() {
    try {
        var language = getInvocationLanguage();
        var disableIfProject = !gCurrentPrefIsDocument;
        if (language) {
            var elem = document.getElementById('language');
            if (elem) elem.value = language;
            if (gCurrentPrefIsDocument) {
                // add the debugger component to the ui
                var interpparams = document.getElementById('interpparams');
                if (interpparams.lastChild.nodeName == 'debugOptions')
                    interpparams.removeChild(interpparams.lastChild)
                        var el = document.createElementNS(XUL_NS, 'debugOptions');
                el.setAttribute('type', language.toLowerCase())
                    interpparams.appendChild(el);
            }

            var propPanel = document.getElementById('generalProperties');
            if (propPanel.lastChild.nodeName == 'debugProperties')
                propPanel.removeChild(propPanel.lastChild)
            el = document.createElementNS(XUL_NS, 'debugProperties');
            el.setAttribute('type', language.toLowerCase())
            el.setAttribute('prefwidgetauto', 'true');
            propPanel.appendChild(el);
            try {
                el.init();
            } catch(e) {
                // do nothing
            }
        }

        myPrefWindow.init(gInvocation.currentInstancePreferences);
        myPrefWindow.onpageload();
        if (!gCurrentPrefIsDocument) {
            // Check for defaults for project configurations
            var field = document.getElementById('filename');
            var currentFile = getKoObject('views').manager.currentView.koDoc.file;
            if (!field.value) {
                field.value = currentFile.path;
            }
            field = document.getElementById('cwd');
            if (!field.value) {
                field.value = currentFile.dirName;
            }
        }
        var fieldNames = {
            "disabled": ["executable-params", "browseForFilename", "params",
                         "browseForCwd", "debuggerRunAsCGI", "debuggerRunInConsole",
                         "tab-systemEnvironment", "tab-cgiEnvironment",
                         "tab-cgiInput", "deleteButton"],
            "readonly": ["filename", "cwd"]};
        for (var property in fieldNames) {
            var idList = fieldNames[property];
            idList.map(function(id) {
                    try {
                        document.getElementById(id)[property] = disableIfProject;
                    } catch(ex) {
                        dialog.log.error("Error setting " + id + "."
                                         + property + " to " + disableIfProject);
                    }
                });
        }
        document.getElementById("projectConfigNotice").
            setAttribute("collapsed", gCurrentPrefIsDocument ? "true" : "false");
        var usecgi;
        if (getInvocationLanguage() == "PHP"
            && !!(usecgi = document.getElementById("debuggerRunAsCGI"))) {
            // When starting up a PHP debugging session,
            // keep the CGI/CLI interpreter and "Simulate CGI Environment"
            // settings in sync.
            var generalProperties = document.getElementById(
                "generalProperties");
            var debugProperties = generalProperties.getElementsByTagName(
                "debugProperties")[0];
            var phpGroup = document.getAnonymousElementByAttribute(
                debugProperties, "id", "interpreterType-group");
            var phpCGIRadioButton = phpGroup.getElementsByAttribute(
                "id", "php-cgi")[0];
            var phpCLIRadioButton = phpGroup.getElementsByAttribute(
                "id", "php-cli")[0];
            if (phpGroup.selectedItem == phpCLIRadioButton) {
                // Disable Simulate-CGI Environment button
                usecgi.setAttribute("checked", "false");
                usecgi.disabled = true;
            } else {
                usecgi.setAttribute("checked", "true");
                usecgi.disabled = false;
            }
        }
        toggleCGITabs();
        // for convenience, focus the params field.  "tabindex=" will make this redundant when it works!
        document.getElementById("params").focus();
    } catch(e) {
        dialog.log.exception(e);
    }
}

function FillInvocationPopup() {
    try {
        var menupopup = document.getElementById('invocation-configuration-popup');
        while (menupopup.childNodes.length) {
            menupopup.removeChild(menupopup.childNodes[0]);
        }
        var configItems = []; // array of (configurationID, bool:isDocument)
        var items = [[gDocInvocationPrefs, true], [gProjectInvocationPrefs, false]];
        for (var i = 0; i < items.length; i++) {
            var configurations = {};
            var prefs = items[i][0];
            if (prefs) {
                var isDocumentInvocation = items[i][1];
                configurations = prefs.getPrefIds();
                configurations.map(function(config) {
                        configItems.push([config, isDocumentInvocation]);
                    });
            }
        }
        if (configItems.length == 0) {
            document.getElementById('deleteButton').setAttribute('disabled','true');
        }
        if (typeof(gInvocation) != "undefined" && gInvocation) {
            //dump("current invocation name "+gInvocation.currentInstancePreferences.id+"\n");
            //gInvocation.currentInstancePreferences.dump(4);
            //getCurrInvocationPrefset().dump(0);
        }
        for (i = 0; i < configItems.length; i++) {
            var configItem = configItems[i];
            var invocation_pref = null;
            var configName = configItem[0];
            isDocumentInvocation = configItem[1];
            if (isDocumentInvocation) {
                if (gDocInvocationPrefs.hasPrefHere(configName)) {
                    invocation_pref = gDocInvocationPrefs.getPref(configName);
                }
            } else if (gProjectInvocationPrefs
                       && gProjectInvocationPrefs.hasPrefHere(configName)) {
                invocation_pref = gProjectInvocationPrefs.getPref(configName);
            }
            if (!invocation_pref) {
                dialog.log.warn("Can't find an invocation pref for "
                                + configName + " on "
                                + (isDocumentInvocation ? "doc" : "project"));
                continue;
            }
            var menuitem = document.createElementNS(XUL_NS, 'menuitem');
            var label = configName;
            if (!isDocumentInvocation) {
                label += " [project]";
            }
            menuitem.setAttribute('label', label);
            menuitem.setAttribute('configName', configName);
            menuitem.setAttribute('isDocumentInvocation', isDocumentInvocation ? "1" : "0");
            menupopup.appendChild(menuitem);
            //dump("Adding config "+configurations[i]+"\n");
            //dump("       config "+invocation_pref.id+"\n");
            //invocation_pref.dump(4)
            if (invocation_pref.id == gInvocation.currentInstancePreferences.id) {
                var menulist = document.getElementById('invocation-configuration');
                
                menulist.setAttribute('label', label);
                menulist.setAttribute('configName', configName);
                menulist.setAttribute('isDocumentInvocation', isDocumentInvocation);
                gCurrentPrefIsDocument = isDocumentInvocation;
                //dialog.log.debug("FillInvocationPopup: set menulist to configName ["
                //                 + configName + "], isDocumentInvocation: ["
                //                 + isDocumentInvocation + "]");
            }
        }
    } catch(e) {
        dialog.log.exception(e);
    }
}

function newPrefset()
{
    // save any settings in the current prefs
    var oldPrefs = gInvocation.currentInstancePreferences;

    // create a new default set
    gInvocation = Components.classes["@activestate.com/koInvocation;1?type="+gInvocation.name].createInstance();
    var catOb = new Object();
    var instOb = new Object();
    gInvocation.getDefaultPreferences(catOb, instOb);
    gInvocation.currentCategoryPreferences = catOb.value;
    gInvocation.currentInstancePreferences = instOb.value;
    gInvocation.currentInstancePreferences.update(oldPrefs);
}

function setCurrentPrefs(prefs, currentPrefIsDocument)
{
    // create a new default set, but use the prefs
    // passed in as the new current instance prefs
    var catOb = new Object();
    var instOb = new Object();
    var langName = gInvocation.name;
    //if (prefs.hasStringPref("language")) {
    //    var new_langName = prefs.getStringPref("language");
    //    if (langName && !new_langName) {
    //        dump("debugging-properties.js :: setCurrentPrefs :: "
    //             + ", gInvocation.name:"
    //             + gInvocation.name
    //             + ', but prefs.getStringPref("language") => null\n');
    //    }
    //}
    if (langName != gInvocation.name) {
        gInvocation = Components.classes["@activestate.com/koInvocation;1?type="+langName].createInstance();
        //dump("debugging-properties.js :: setCurrentPrefs :: langName:"
        //     + langName
        //     + ", gInvocation.name:"
        //     + gInvocation.name
        //     + "\n");
    }
    gInvocation.getDefaultPreferences(catOb, instOb);
    gInvocation.currentCategoryPreferences = catOb.value;
    gInvocation.currentInstancePreferences = instOb.value;
    gInvocation.currentInstancePreferences.update(prefs);
    gInvocation.currentInstancePreferences.id = prefs.id
    gInvocation.currentInstancePreferences.setStringPref("language", langName);
    gCurrentPrefIsDocument = currentPrefIsDocument;
}

function ChangeInvocation(target) {
    // be sure the set we're leaving is saved,
    // but only if it's a document pref.
    var invocation_pref;
    if (gCurrentPrefIsDocument) {
        invocation_pref = getCurrInvocationPrefset();
        if (invocation_pref
            && invocation_pref.hasPref(gInvocation.persistableInstancePreferences.id))
            invocation_pref.setPref(gInvocation.persistableInstancePreferences.id,
                                    gInvocation.persistableInstancePreferences);
    }

    var menulist = document.getElementById('invocation-configuration');
    var menuitem = target.selectedItem;
    var name = menuitem.getAttribute("configName");
    var isDocumentInvocation = menuitem.getAttribute("isDocumentInvocation") != "0";
    //dialog.log.debug("ChangeInvocation: Changed to label "
    //                 + menulist.getAttribute("label")
    //                 + ", configName [" + name + "], isDocumentInvocation: ["
    //                 + isDocumentInvocation + "]");
    invocation_pref = null;

    if (isDocumentInvocation) {
        if (gDocInvocationPrefs.hasPrefHere(name)) {
            invocation_pref = gDocInvocationPrefs.getPref(name);
        }
    } else if (gProjectInvocationPrefs &&
               gProjectInvocationPrefs.hasPref(name)) {
        invocation_pref = gProjectInvocationPrefs.getPref(name);
    }
    if (!invocation_pref) {
        dialog.log.warn("Can't find invocation_pref");
        return;
    }

    invocation_pref.id = name;
    setCurrentPrefs(invocation_pref, isDocumentInvocation);
    UpdateInvocation();
}

function doSaveNewInvocation() {
    // first, get a name for the new invocation
    try {
        var name = ko.dialogs.prompt("Enter a new configuration name.  The new "+
                                 "configuration will be based on the currently "+
                                 "selected '"+gInvocation.currentInstancePreferences.id+"' configuration.",
                                 "Configuration Name", "",
                                 "Configuration Name");
        if (!name) return;
        // New invocations are always saved on the document, not the project.
        if (gDocInvocationPrefs.hasPrefHere(name)) {
            ko.dialogs.alert("A debugging configuration with the name '"+name+"' already exists.\n");
            return;
        }
        // be sure the set we're leaving is saved,
        // but only if it's a document pref
        if (gCurrentPrefIsDocument) {
            var currPrefSet = gDocInvocationPrefs;
            var pips = gInvocation.persistableInstancePreferences;
            if (currPrefSet.hasPref(pips.id)) {
                currPrefSet.setPref(pips.id, pips);
            }
        }

        // create a new debug data set
        newPrefset();
        gCurrentPrefIsDocument = true;
        gInvocation.currentInstancePreferences.id = name;
        gDocInvocationPrefs.setPref(gInvocation.persistableInstancePreferences.id,
                                    gInvocation.persistableInstancePreferences);

        //gInvocation.currentInstancePreferences.dump(0)

        FillInvocationPopup();
        UpdateInvocation();
        document.getElementById('deleteButton').removeAttribute('disabled');
    } catch(e) {
        dialog.log.exception(e);
    }
}

function doDeleteInvocation() {
    try {
        var name = document.getElementById('invocation-configuration').getAttribute('configName');
        if ((gCurrentPrefIsDocument && name == "default")
                || (!gCurrentPrefIsDocument && name == "Project")) {
            ko.dialogs.alert("Default debugger configurations can't be deleted.\n");
            return;
        }
            
        var prefset = null;
        if (gCurrentPrefIsDocument
            && gDocInvocationPrefs.hasPrefHere(name)) {
            prefset = gDocInvocationPrefs;
        }
        if (!prefset && gProjectInvocationPrefs.hasPrefHere(name)) {
            prefset = gProjectInvocationPrefs;
        }
        if (prefset) {
            if (ko.dialogs.yesNo("Are you sure you want to delete the "+name+" configuration?") == "Yes") {
                prefset.deletePref(name);
            }
        } else {
            dialog.log.warn("couldn't find pref " + name + " in "
                            + (gCurrentPrefIsDocument ? "document" : "project")
                            + " prefs");
        }
        // Choose the first set in either the project or the doc
        var invocation_prefs = null;
        var firstDocPref, firstProjectPref;
        var currentPrefIsDocument;
        var configurations = gDocInvocationPrefs.getPrefIds();
        firstDocPref = (gDocInvocationPrefs && configurations.length
                        ? gDocInvocationPrefs.getPref(configurations[0])
                        : null);
        configurations = gProjectInvocationPrefs.getPrefIds();
        firstProjectPref = (gProjectInvocationPrefs && configurations.length
                            ? gProjectInvocationPrefs.getPref(configurations[0])
                            : null);
        if (gCurrentPrefIsDocument) {
            invocation_prefs = firstDocPref || firstProjectPref;
            currentPrefIsDocument = !!firstDocPref;
        } else {
            invocation_prefs = firstProjectPref || firstDocPref;
            currentPrefIsDocument = !firstProjectPref;
        }
        setCurrentPrefs(invocation_prefs, currentPrefIsDocument);

        FillInvocationPopup();
        UpdateInvocation();
    } catch(e) {
        dialog.log.exception(e);
    }
}

function _setReturnVar(name, val) {
  if (window.arguments && window.arguments[0])
    window.arguments[0][name]=val;
  return true;
}

function _setResult(res) {
    return _setReturnVar("res", res)
}

function Ok() {
    try {
        // get the invocation to validate the preference set.
        if (!myPrefWindow._onOK()) {
            UpdateInvocation();
            return false;
        }
        var bad_pref_id = new Object();
        var message = new Object();
        var clearFields = {};
        var cips;
        try {
            var currentFile = getKoObject('views').manager.currentView.koDoc.file;
            if (currentFile) {
                if (currentFile.isRemoteFile) {
                    var errmsg = "Cannot debug a remote file locally.\n" +
                                 "Please use remote debugging instead.";
                    var result = ko.dialogs.customButtons(errmsg,
                                                          ['OK', '&Help'], 'OK',
                                                          null,
                                                          'Debugger Error');
                    if (result == 'Help') {
                        ko.windowManager.getMainWindow().
                            ko.help.open("debugger.html");
                    }
                    return false;
                }
                cips = gInvocation.currentInstancePreferences;
                if (!cips.getStringPref("filename")) {
                    // Empty file => current file
                    cips.setStringPref("filename", currentFile.path);
                    clearFields["filename"] = true;
                }
                if (!cips.getStringPref("cwd")) {
                    // Empty file => current file
                    cips.setStringPref("cwd", currentFile.dirName);
                    clearFields["cwd"] = true;
                }
            }
        } catch(ex) {
            dialog.log.exception("Failed to get default file info: " + ex);
        }
        var ok = gInvocation.validate(gInvokeType, bad_pref_id, message)
        if (!ok) {
            var badWidget = myPrefWindow.findElementWithPreferenceId(bad_pref_id.value);
            if (badWidget)
                badWidget.focus();
            ////XXX Refactor: Copy of dialog invocation sequence in debugger.js::_showInvalidInterpreterMessageBox
            var result = ko.dialogs.customButtons(message.value,
                                              ['OK','&Help','&Preferences'],
                                              'OK', null, 'Debugger Error');
            if (result == 'Help') {
                if (gInvocation.name.toLowerCase().indexOf("python") >= 0)
                {
                    ko.help.open("debugpython.html");
                }
                if (gInvocation.name.toLowerCase().indexOf("javascript") >= 0 || gInvocation.name.toLowerCase().indexOf("nodejs") >= 0)
                {
                    ko.help.open("debugchrome.html");
                }
                else
                {
                    ko.help.open("debug"+gInvocation.name.toLowerCase()+".html");
                }
            } else if (result == 'Preferences') {
                ko.windowManager.getMainWindow().
                    prefs_doGlobalPrefs(gInvocation.name.toLowerCase() + "Item");
            }
            UpdateInvocation();
            return false;
        }
        for (var prefName in clearFields) {
            // We only set defaults for invoke.validate -- clear the prefs,
            // and then figure out what to do later.
            cips.setStringPref(prefName, "");
        }

        // save our prefs back into the files prefs now
        var ids = gDocInvocationPrefs.getPrefIds();
        if (!gDocumentPrefs.hasPrefHere("Invocations") && ids.length) {
            gDocumentPrefs.setPref('Invocations', gDocInvocationPrefs);
        } else {
            // first, delete any prefs that are in gDocumentPrefs but not in
            // gDocInvocationPrefs
            var debugInvocations = gDocumentPrefs.getPref('Invocations');
            var newConfig = gDocInvocationPrefs.getPrefIds();
            gInitialDocInvocationNames.forEach(function(oldInvocationName) {
                  if (newConfig.indexOf(oldInvocationName) < 0) {
                      debugInvocations.deletePref(oldInvocationName);
                  }
              });
            debugInvocations.update(gDocInvocationPrefs);
        }
        window.arguments[0].invocation=gInvocation;
        window.arguments[0].isDocumentInvocation = gCurrentPrefIsDocument;
        window.arguments[0].res="ok";
    } catch(e) {
        dialog.log.exception(e);
    }
    return true;
}

function Cancel() {
    window.arguments[0].invocation=null;
    window.arguments[0].res="cancel";
    return true;
}

function doClose() {
    Cancel();
    window.close();
}

// Utility functions for the various panels.
function doBrowseForDir(widget_id) {
    if (!widget_id)
        widget_id = "cwd";
    var textField = document.getElementById(widget_id);
    var dir = ko.filepicker.getFolder(textField.value);
    if (dir) textField.value = dir;
}

function doBrowseForLanguageFile(widget_id, language) {
    if (typeof(language) == 'undefined') language = gInvocation.name;
    var textField = document.getElementById(widget_id);
    var path = ko.filepicker.browseForFile(null, textField.value,
                                   null, // title
                                   language); // default filter name
    if (path != null) {
        textField.value = path;
    }
}

function doBrowseForXMLInputFile(widget_id) {
    if (!widget_id) return;
    var textField = document.getElementById(widget_id)
    var path = ko.filepicker.browseForFile(null, textField.value,
                                   null, // title
                                   "XML", // default filter name
                                   ["XML", "XSLT", "HTML", "All"]);
    if (path != null) {
        textField.value = path;
    }
}

function doBrowseForCommandFile(widget_id) {
    if (!widget_id) return;
    var textField = document.getElementById(widget_id)
    var path = ko.filepicker.browseForExeFile(null, textField.value);
    if (path != null) {
        textField.value = path;
    }
}


function toggleCGITabs() {
    try {
        var usecgi = document.getElementById("debuggerRunAsCGI");
        if (!usecgi) return;
        var checked = usecgi.getAttribute("checked");
        var t1 = document.getElementById("tab-cgiEnvironment");
        var t2 = document.getElementById("tab-cgiInput");
        if (checked=="true") {
            t1.removeAttribute('hidden');
            t2.removeAttribute('hidden');
        } else {
            t1.setAttribute('hidden','true');
            t2.setAttribute('hidden','true');
        }
    } catch (e) {
        dialog.log.exception(e);
    }
}

function updateInterpreterArgumentsWithDir(menuitem) {
    try {
        var prefName = ("debuggingDir."
                        + (menuitem.id
                           || menuitem.getAttribute("id")
                           || menuitem.getAttribute("label")
                           || menuitem.getAttribute("value")
                           || "unknownName"));
        var val = menuitem.getAttribute('value');
        var params = document.getElementById('executable-params');
        var default_dir = null;
        var optionPart = val + ' ';
        if (params.value) {
            var idx = params.value.indexOf(optionPart);
            if (idx >= 0) {
                default_dir = params.value.substr(idx);
            }
        }
        if (!default_dir) {
            default_dir = ko.filepicker.internDefaultDir(prefName);
        }
        var dir = ko.filepicker.getFolder(default_dir);
        if (!dir) return;
        ko.filepicker.internDefaultDir(prefName, dir);
        if (params.value) {
            params.value += ' ' + optionPart + dir;
        } else {
            params.value = optionPart + dir;
        }
        document.getElementById('executable-params').focus();
    } catch (e) {
        dialog.log.exception(e);
    }
}

function updateInterpreterArguments(menuitem) {
    try {
        var val = menuitem.getAttribute('value');
        var params = document.getElementById('executable-params');
        if (params.value) {
            params.value += ' '+val;
        } else {
            params.value = val;
        }
        document.getElementById('executable-params').focus();
    } catch (e) {
        dialog.log.exception(e);
    }
}
