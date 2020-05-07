/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

var log = ko.logging.getLogger("project-debugging-properties");

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

var gInvocation = null;  // instance of koInvocation;1?type=Project
var gInvokeType = Components.interfaces.koIInvocation.INVOKE_DEBUG;
var gInvocationPrefs = null; // working copy of project.prefset["Invocations"]
var def_invocation_name = 'Project';
var allowedLanguages = null;
var g_prefset;              // cache project.prefset -- do not update this
var dialog = {};


//      called prior to any pref widgets getting initialized
function OnPreferencePageInitalize(prefset)
{
    try {
    g_prefset = prefset;
    dialog.language = document.getElementById('language');
    dialog.executableParams = document.getElementById('executable-params');
    dialog.filename = document.getElementById('filename');
    dialog.params = document.getElementById('params');
    dialog.cwd = document.getElementById('cwd');
    dialog.debuggerRunInConsole = document.getElementById('debuggerRunInConsole');
    dialog.deleteButton = document.getElementById('deleteButton');
    dialog.invocationConfiguration = document.getElementById('invocation-configuration');
    if (prefset.hasStringPref('lastInvocation')) {
        def_invocation_name = prefset.getStringPref('lastInvocation');
    }
    
    // either get the existing invocation prefs, or create them
    gInvocationPrefs = Components.classes["@activestate.com/koPreferenceSet;1"].createInstance();
    if (prefset.hasPref("Invocations")) {
        // we only add this new prefset in onOK handler to avoid dirtying the
        // project with an empty prefset
        gInvocationPrefs.update(prefset.getPref("Invocations"));
    }
    createInitialInvocationSet(prefset);
    } catch(e) {
        log.exception(e);
    }
}
    
function createInitialInvocationSet(project_prefset) {
    try {
    // create a project invocation so we can use this to set/get prefs
    gInvocation = Components.classes["@activestate.com/koInvocation;1?type=Project"].createInstance();
    // create a default prefset to use
    var catOb = {};
    var instOb = {};
    gInvocation.getDefaultPreferences(catOb, instOb);
    var categoryPrefs = catOb.value;
    categoryPrefs.parent = project_prefset;
    gInvocation.currentCategoryPreferences = categoryPrefs;
    var instPrefs = gInvocation.currentInstancePreferences = instOb.value;

    if (gInvocationPrefs.hasPref(def_invocation_name)) {
        // get the existing prefs, and update the invocation with them
        // Doing this maintains the parent pointer to the category prefs.
        instPrefs.update(gInvocationPrefs.getPref(def_invocation_name));
    } else {
        // fresh, no prefs, create them and set them on our prefset
        gInvocationPrefs.setPref(def_invocation_name, instPrefs);
        instPrefs.setStringPref("language", getProjectLanguage(project_prefset));
        if (parent.file) {
            instPrefs.setStringPref("cwd", parent.file.dirName);
        }
    }
    instPrefs.id = def_invocation_name;
    } catch(e) {
        log.exception(e);
    }
}

function OnPreferencePageLoading(prefset)
{
    try {
        FillInvocationPopup();
        UpdateInvocation();
    } catch(e) {
        log.exception(e);
    }
}

function OnPreferencePageOK(prefset)
{
    try {
        // persistableInstancePreferences: making this a property is too cute.
        // it returns an edited copy of the currentInstancePreferences
        
        var configurations = gInvocationPrefs.getPrefIds();
        if (configurations.length > 0) {
            savePrefs(gInvocation.persistableInstancePreferences);
        }
        if (prefset.hasPrefHere("Invocations")) {
            prefset.deletePref("Invocations");
        }
        // remove any unset prefs
        for (var i = 0; i < configurations.length; i++) {
            var configurationName = configurations[i];
            if (!configurationName) {
                // This is the initial dummy prefset created when
                // we enter the preference panel.
                gInvocationPrefs.deletePref(configurationName);
                continue;
            }
        }
        
        // if there are any configurations left, save them
        configurations = gInvocationPrefs.getPrefIds();
        if (configurations.length > 0) {
            prefset.setPref("Invocations", gInvocationPrefs);
            prefset.setStringPref('lastInvocation',
                                  gInvocation.currentInstancePreferences.id);
        } else {
            // Clear it out.
            prefset.setStringPref('lastInvocation', '');
        }
        var finalLanguage = gInvocation.currentInstancePreferences.getStringPref("language");
        prefset.setStringPref("language", finalLanguage);
        prefset.setStringPref("currentInvocationLanguage", finalLanguage);
        Components.classes["@activestate.com/koPrefService;1"].
            getService(Components.interfaces.koIPrefService).
            prefs.setStringPref("defaultInvocationLanguage", finalLanguage);
    } catch(e) {
        log.exception(e);
    }
    return true;
}

// OnPreferencePageClosing(prefset, ok)

// OnPreferencePageCancel(prefset)
//      called when the user clicks cancel
//


function changeLanguage() {
    try {
        var newLanguage = dialog.language.selectedItem.label;
        gInvocation.currentInstancePreferences.setStringPref("language", newLanguage);
        // savePrefs(gInvocation.currentInstancePreferences);
        UpdateLanguage(newLanguage);
    } catch(e) {
        log.exception(e);
    }
}

function getProjectLanguage(project_prefset) {
    if (allowedLanguages == null) {
        allowedLanguages = [];
        var languageNodes = dialog.language.childNodes[0].childNodes;
        for (var i = languageNodes.length - 1; i >= 0; i--) {
            allowedLanguages.push(languageNodes[i].getAttribute("label"));
        }
    }
    var language;
    if (project_prefset.hasPrefHere("currentInvocationLanguage")) {
        language = project_prefset.getStringPref("currentInvocationLanguage");
        if (language && allowedLanguages.indexOf(language) != -1) {
            return language;
        }
    }
    if (project_prefset.hasStringPref("defaultInvocationLanguage")) {
        language = project_prefset.getStringPref("defaultInvocationLanguage");
        if (language && allowedLanguages.indexOf(language) != -1) {
            return language;
        }
    }
    try {
        language = getKoObject('views').manager.currentView.koDoc.language;
        if (language && allowedLanguages.indexOf(language) != -1) {
            return language;
        }
    } catch(ex) {
    }
    return "PHP"; // A better fallback than "Perl"
}

function UpdateLanguage(language) {
    try {
        if (language) {
            gInvocation.currentInstancePreferences.setStringPref("language", language);
            // set the menu item
            dialog.language.setAttribute('label', language);

            // add the debugger component to the ui
            var interpparams = document.getElementById('interpparams');
            if (interpparams.lastChild.nodeName == 'debugOptions')
                interpparams.removeChild(interpparams.lastChild)
            var el = document.createElementNS(XUL_NS, 'debugOptions');
            el.setAttribute('type', language.toLowerCase())
            interpparams.appendChild(el);

        /* XXX for now, we don't want to do this
            var propPanel = document.getElementById('generalProperties');
            if (propPanel.lastChild.nodeName == 'debugProperties')
                propPanel.removeChild(propPanel.lastChild)
            el = document.createElementNS(XUL_NS, 'debugProperties');
            el.setAttribute('type', language.toLowerCase())
            propPanel.appendChild(el);
        */
        } else {
            log.error("UpdateLanguage called with no language\n");
        }
    } catch(e) {
        log.exception(e);
    }
}

function UpdateInvocation() {
    try {
        // this is where we actually insert our prefs into the panel
        var prefs = gInvocation.currentInstancePreferences;
        var language = null;
        if (prefs.hasPrefHere('language')) {
            language = prefs.getStringPref('language');
            if (!language) {
                log.warn("pref-project-debugging-properties.js::UpdateInvocation: language off pref [" + prefs.id + "] is null\n");
            }
        }
        if (!language) {
            language = getProjectLanguage(g_prefset);
            prefs.setStringPref('language', language);
        }
        UpdateLanguage(language);
        dialog.executableParams.value =prefs.getStringPref("executable-params");
        dialog.filename.value =        prefs.getStringPref("filename");
        dialog.params.value =          prefs.getStringPref("params");
        dialog.cwd.value =             prefs.getStringPref("cwd");
        dialog.debuggerRunInConsole.checked = prefs.getBooleanPref("use-console");
    } catch(e) {
        log.exception(e);
    }
}

function FillInvocationPopup() {
    try {
        var menupopup = document.getElementById('invocation-configuration-popup');
        while (menupopup.childNodes.length) {
            menupopup.removeChild(menupopup.childNodes[0]);
        }
        menupopup.value = null;
        
        var configurations = gInvocationPrefs.getPrefIds();
        //dump('got '+configurations.length+' invocations for this file\n');
        if (configurations.length < 1) {
            dialog.deleteButton.setAttribute('disabled','true');
        } else {
            document.getElementById('deleteButton').removeAttribute('disabled');
        }
        //dump("current invocation name "+currentInvocation.currentInstancePreferences.id+"\n");
        //currentInvocation.currentInstancePreferences.dump(4);
        //gInvocationPrefs.dump(0);
        var currentInstPrefsId = gInvocation.currentInstancePreferences.id;
        if (configurations.length == 0) {
            dialog.invocationConfiguration.setAttribute('label', "");
        } else {
            for (var i=0; i < configurations.length; i++) {
                var invocation_pref = gInvocationPrefs.getPref(configurations[i]);
                 
                var menuitem = document.createElementNS(XUL_NS, 'menuitem');
                menuitem.setAttribute('label', configurations[i]);
                menupopup.appendChild(menuitem);
                //dump("Adding config "+configurations[i]+"\n");
                //dump("       config "+invocation_pref.id+"\n");
                //invocation_pref.dump(4)
                if (invocation_pref.id == currentInstPrefsId) {
                    dialog.invocationConfiguration.setAttribute('label', configurations[i]);
                }
            }
        }
    } catch(e) {
        log.exception(e);
    }
}

function savePrefs(prefs) {
    if (!prefs.id) {
        //dump("savePrefs has a prefset with no id!\n");
        log.error("savePrefs has a prefset with no id!");
        return;
    }
    prefs.setStringPref("language", dialog.language.label);
    prefs.setStringPref("executable-params", dialog.executableParams.value);
    prefs.setStringPref("filename", dialog.filename.value);
    prefs.setStringPref("params", dialog.params.value);
    prefs.setStringPref("cwd", dialog.cwd.value);
    prefs.setBooleanPref("use-console",dialog.debuggerRunInConsole.checked);
    gInvocationPrefs.setPref(prefs.id,prefs);
    //gInvocationPrefs.dump(1);
}

function newPrefset()
{
    // save any settings in the current prefs
    var oldPrefs = gInvocation.currentInstancePreferences;
    if (oldPrefs.id) {
        savePrefs(oldPrefs);
    } else {
        //log.info("newPrefset: oldPrefs.id is null, prob an ignorable prefset");
    }

    // create a new default set
    var catOb = {};
    var instOb = {};
    gInvocation.getDefaultPreferences(catOb, instOb);
    gInvocation.currentInstancePreferences = instOb.value;

    // save the prefs we want to carry over
    gInvocation.currentInstancePreferences.update(oldPrefs);
}

function setCurrentPrefs(prefs)
{
    // create a new default set, but use the prefs
    // passed in as the new current instance prefs
    var catOb = {};
    var instOb = {};
    gInvocation.getDefaultPreferences(catOb, instOb);
    gInvocation.currentCategoryPreferences = catOb.value;
    gInvocation.currentInstancePreferences = instOb.value;
    gInvocation.currentInstancePreferences.update(prefs);
    gInvocation.currentInstancePreferences.id = prefs.id
}

function ChangeInvocation() {
    // save any settings in the current prefs
    savePrefs(gInvocation.currentInstancePreferences);

    var name = dialog.invocationConfiguration.getAttribute("label");
    if (!name) {
        //dump("No name for invocation to change to!\n");
        throw new Error("No name for invocation to change to!");
    }
    var invocation_prefs = gInvocationPrefs.getPref(name);
    invocation_prefs.id = name;
    setCurrentPrefs(invocation_prefs);
    UpdateInvocation();
}

function doCreateNewInvocation() {
    // first, get a name for the new invocation
    try {
        var name = ko.dialogs.prompt("Enter a new configuration name.  The new "+
                                 "configuration will be based on the currently "+
                                 "selected '"+gInvocation.currentInstancePreferences.id+"' configuration.",
                                 "Configuration Name", "",
                                 "Configuration Name");
        if (!name) return;
        if (gInvocationPrefs.hasPref(name)) {
            ko.dialogs.alert("A debugging configuration with the name '"+name+"' already exists.\n");
            return;
        }
        newPrefset();
        gInvocation.currentInstancePreferences.id = name;
        gInvocationPrefs.setPref(gInvocation.currentInstancePreferences.id,
                                 gInvocation.currentInstancePreferences);

        //gInvocation.currentInstancePreferences.dump(0)

        FillInvocationPopup();
        UpdateInvocation();
        dialog.deleteButton.removeAttribute('disabled');
    } catch(e) {
        log.exception(e);
    }
}

function doDeleteInvocation() {
    try {
        var name = dialog.invocationConfiguration.getAttribute('label');
        var configurations = gInvocationPrefs.getPrefIds();
        if (configurations.length < 1) {
            return;
        } else {
            if (ko.dialogs.yesNo("Are you sure you want to delete the "+name+" configuration?") != "Yes") return;
        }
        gInvocationPrefs.deletePref(name);
        configurations = gInvocationPrefs.getPrefIds();
        var invocation_prefs;
        if (configurations.length < 1) {
            gInvocationPrefs.reset();
        } else {
            invocation_prefs = gInvocationPrefs.getPref(configurations[0]);
            setCurrentPrefs(invocation_prefs)
        }
        FillInvocationPopup();
        if (configurations.length >= 1) {
            UpdateInvocation();
        }
    } catch(e) {
        log.exception(e);
    }
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
    if (typeof(language) == 'undefine') {
        var prefs = gInvocation.currentInstancePreferences;
        language = prefs.getStringPref("language");
    }
    var textField = document.getElementById(widget_id);
    var dir = textField.value;
    if (!dir)
        dir = parent.file.path;
    var path = ko.filepicker.browseForFile(null, dir,
                                   null, // title
                                   language); // default filter name
    if (path != null) {
        textField.value = path;
    }
}

function doBrowseForXMLInputFile(widget_id) {
    if (!widget_id) return;
    var textField = document.getElementById(widget_id);
    var dir = textField.value;
    if (!dir)
        dir = parent.file.path;
    var path = ko.filepicker.browseForFile(null, dir,
                                   null, // title
                                   "XML", // default filter name
                                   ["XML", "XSLT", "HTML", "All"]);
    if (path != null) {
        textField.value = path;
    }
}

function doBrowseForCommandFile(widget_id) {
    if (!widget_id) return;
    var textField = document.getElementById(widget_id);
    var dir = textField.value;
    if (!dir)
        dir = parent.file.path;
    var path = ko.filepicker.browseForExeFile(dir);
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
        log.exception(e);
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
        var params = dialog.executableParams;
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
        dialog.executableParams.focus();
    } catch (e) {
        log.exception(e);
    }
}

function updateInterpreterArguments(menuitem) {
    try {
        var val = menuitem.getAttribute('value');
        var params = dialog.executableParams;
        if (params.value) {
            params.value += ' '+val;
        } else {
            params.value = val;
        }
        dialog.executableParams.focus();
    } catch (e) {
        log.exception(e);
    }
}
