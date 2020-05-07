/* Copyright (c) 2000-2006 ActiveState Software Inc.

   See the file LICENSE.txt for licensing information. */
var bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
        .getService(Components.interfaces.nsIStringBundleService)
        .createBundle("chrome://komodo/locale/project/macro.properties");

var $ = require("ko/dom").window(window);
var prefs = require("ko/prefs");

/**
 * various properties and elements of the Tutorial Dialog
 * 
 * @property dialog : The entire dialog ko/dom
 * @property stepsContent : Steps content view ko/dom
 * @property logicContent : Logic content view ko/dom
 * @property tutorialname : name textbox ko/dom
 * @property okButton : ko/dom object
 * @property applyButton : ko/dom object 
 * @property sciSteps : scimoz object of steps view
 * @property sciLogic : scimoz object of logic view
 * @property toolBoxItem : ToolBox backend object
 *
 * This needs the caching used in commando.  Shouldn't be necessary right now
 */
var elems = {
    dialog : function() { return  $('#dialog-tutorialtool'); },
    stepsContent : function() { return  $('#tutorialsteps'); },
    logicContent : function() { return $('#tutoriallogic'); },
    tutorialname : function() { return $('#tutorialname'); },
    okButton : function() { return $(this.dialog().element().getButton('accept')); },
    applyButton :  function() { return $(this.dialog().element().getButton('extra1')); },
    // the scimoz objects for each editor view in the dialog
    sciSteps : function() { return this.stepsContent().element().scimoz; },
    sciLogic : function() { return this.logicContent().element().scimoz; },
    toolBoxItem : function() { return window.arguments[0].item; },
    errorWrapper: function() { return $("#error-wrapper"); },
    errorMessage: function() { return $("#error-message"); }
}

var log = require('ko/logging').getLogger("tutorial-properties");
//log.setLevel(require("ko/logging").LOG_DEBUG);

function onLoad(){
    scintillaOverlayOnLoad();
    
    // Setup the apply button as it would be blank
    elems.applyButton().attr('label', bundle.GetStringFromName("apply"));
    elems.applyButton().attr('accesskey', bundle.GetStringFromName("applyAccessKey"));
    
    
    if (window.arguments[0].task == 'new') {
        // If it's a new tutorial then set the name
        elems.tutorialname().element().focus();
    } else {
        elems.tutorialname().attr("value", elems.toolBoxItem().getStringAttribute('name'));
    }
    UpdateTitle();
        
    if (window.arguments[0].task == 'new') {
        var sdkUrl = require("sdk/net/url");
        var uri = "chrome://komodo/content/project/tutorialMetaTemplate.yaml";
        sdkUrl.readURI(uri, {sync: true}).then(function(data) {
            loadEditor("stepsContent", "YAML", data);
        });
        
        uri = "chrome://komodo/content/project/tutorialLogicTemplate.js";
        sdkUrl.readURI(uri, {sync: true}).then(function(data) {
            loadEditor("logicContent", "JavaScript", data);
        });
    } else
    {
        loadEditor("stepsContent", "YAML", elems.toolBoxItem().value);
        loadEditor("logicContent", "JavaScript", elems.toolBoxItem().getStringAttribute("logic"));
        elems.stepsContent().focus();
    }
}

function loadEditor(elem, language, value) {
    var content = elems[elem]().element();
    content.scintilla.symbolMargin = false;
    content.scimoz.useTabs = prefs.getBooleanPref("useTabs");
    content.scimoz.indent = prefs.getLongPref('indentWidth');
    content.scimoz.tabWidth = prefs.getLongPref('indentWidth');
    content.initWithBuffer(value, language);
    var foldStyle = prefs.getStringPref("editFoldStyle");
    if (foldStyle && foldStyle != "none")
        content.setFoldStyle(prefs.getStringPref("editFoldStyle"));
}

function onUnload() {
    try {
        // The "close" method ensures the scintilla view is properly cleaned up.
        elems.stepsContent().element().close();
        elems.logicContent().element().close();
        scintillaOverlayOnUnload();
    } catch (e) {
        log.exception(e);
    }
}


/**
 * saveTool, saves the current tool state to the database and to disk
 * @returns true if successful, false if something goes wrong.
 */

function saveTool() {
    var yaml = require("contrib/yaml");
    
    elems.errorWrapper().attr("collapsed", "true");
    
    try {
        yaml.load(elems["sciSteps"]().text);
    }
    catch (e) {
        elems.errorWrapper().attr("collapsed", "false");
        elems.errorMessage().text(e.message);
        return false;
    }
    
    var toolBoxItem = elems["toolBoxItem"]();
    toolBoxItem.value = elems["sciSteps"]().text;
    toolBoxItem.setStringAttribute("logic", elems.sciLogic().text);
    toolBoxItem.setStringAttribute("name", elems["tutorialname"]().value());
    
    log.debug("Turorial name: " + elems["tutorialname"]().value());
    // If it's not new then just save
    if (window.arguments[0].task != 'new') {
        elems.toolBoxItem().save();
    }
    
     // This section checks to see if this is a new Tutorial then adds it to the
    // toolbox.
    // toolbox2.addNewItemToParent(elems.toolBoxItem, parent); is what actually puts a file
    // on disk
    if (window.arguments[0].task == 'new') {
        var parent = window.arguments[0].parent;
        var toolbox2 = opener.ko.toolbox2;
        if (typeof(parent)=='undefined' || !parent) {
            var parent;
            try {
                parent = toolbox2.manager.getSelectedItem();
            } catch(ex) {
                log.exception("macroProperties::OK - can't get a selected item, use the standard toolbox:\n" + ex);
                parent = null;
            }
            if (!parent) {
                parent = toolbox2.getStandardToolbox();
            }
        }
        toolbox2.addNewItemToParent(elems["toolBoxItem"](), parent);
    }
    window.arguments[0].res = true;
    
    return true;
}

/**
 * Apply
 * Save the state of the tool
 */
function Apply(){
    if (saveTool()) {
        log.debug("Tutorial " + elems["tutorialname"]().value() + "saved.");
        return true;
    }
    return false;
}

/**
 * OK 
 * @param event
 */

function OK(event) {
    if(!Apply()){
        return false;
    }
    
    return true;
}


/**
 * Cancel
 * 
 */

function Cancel() {
   if (elems.sciSteps().modify || elems.sciLogic().modify) {
        var resp = ko.dialogs.yesNoCancel("Do you wish to save your changes",
                               "No", // default response
                               null, // text
                              "Tutotial was modified"//title
                               );
        if (resp == "Cancel") {
            return false;
        }
        if (resp == "Yes") {
            return OK();
        }
    }
    window.arguments[0].res= false;
    return true;
}

/**
 * Update the title when the user changes the name of the tutorial
 * so that it reflects the current name in the window
 */
function UpdateTitle()
{
    try {
        var name = elems["tutorialname"]().value();
        if (name) {
            document.title = bundle.formatStringFromName("namedProperties", [name], 1);
        } else {
            document.title = bundle.formatStringFromName("unnamedProperties", [elems["toolBoxItem"]().prettytype], 1);
        }
    } catch (e) {
        log.exception(e);
    }
}

/**
 * Update the disabled state of the apply and ok buttons
 */
function updateButtonsEnabled() {
    var okButton = elems.okButton();
    var applyButton = elems.applyButton();
    try {
        if (elems.tutorialname().value() == '') {
            okButton.attr('disabled', 'true');
            applyButton.attr('disabled', 'true');
        } else {
            if (okButton.attr('disabled') != "") {
                okButton.removeAttribute('disabled');
            }
            if (applyButton.attr('disabled') != "") {
                applyButton.removeAttribute('disabled');
            }
        }
    } catch (e) {
        log.exception(e);
    }
}