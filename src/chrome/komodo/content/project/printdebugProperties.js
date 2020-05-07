/* Copyright (c) 2003-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/*
 *
 * Komodo's Snippet Properties and "Add Snippet" dialog.
 *
 */

xtk.include("domutils");

var legacy = require("ko/windows").getMain().ko;
var log = require('ko/logging').getLogger("printdebugProperties");

var elems = {};
var theTool;
var encodingSvc = Components.classes["@activestate.com/koEncodingServices;1"].
                    getService(Components.interfaces.koIEncodingServices);
var gChromeWindowView = null;

var $ = require("ko/dom").window(window);

var getUiElements = () =>
{
    var dialog = $('#dialog-printdebugproperties').element();
    elems.keybinding = $('#keybindings').element();
    
    elems.applyButton = dialog.getButton("extra1");
    elems.OKButton = dialog.getButton("accept");
    
    elems.$nameText = $('#nameText');
    elems.$languageMenu = $("#languageList");
    elems.$set_as_activeCheckbox = $("#set_as_active");
    elems.$nameLabel = $('#nameLabel');
    elems.$printstatementText = $('#printstatementText');
    elems.logicView = $('#logicView').element();
    elems.$sampleTextDesc = $("#sampleText");
};

var loadFieldValues = () =>
{
    elems.keybinding.gKeybindingMgr = opener.ko.keybindings.manager;
    elems.keybinding.part = theTool;
    elems.keybinding.commandParam = theTool.id;
    elems.keybinding.init();
    elems.keybinding.updateCurrentKey();
    
    elems.applyButton.setAttribute('label', 'Apply');
    elems.applyButton.setAttribute('accesskey', 'A');
    
    elems.$nameText.value(theTool.getStringAttribute('name')||"New Print Statement");
    elems.logicView.initWithBuffer(theTool.getStringAttribute('logic') || "", "JavaScript");
    
    elems.$set_as_activeCheckbox.element().setAttribute('checked', theTool.getBooleanAttribute('active'));
    
    // Assigning the scimoz object had to wait until it was instantiated.
    elems.logicScimoz = elems.logicView.scimoz;
    var lang = theTool.getStringAttribute("language");
    if(lang)
        elems.$languageMenu.element().selection = lang;
    elems.$printstatementText.value(theTool.value);
    // Validation
    elems.$nameText.on('keyup', UpdateField.bind(this, "name", false));
    elems.$languageMenu.on("select", updateOK);
    elems.$printstatementText.on('keyup', updateOK);
};

function onLoad(event)
{
    scintillaOverlayOnLoad();
    theTool = window.arguments[0].item;
    getUiElements();
    loadFieldValues();
    // The tool
    if (window.arguments[0].task == 'new') {
        document.title = "Create New Debug Statement";
        elems.applyButton.setAttribute('collapsed', 'true');
    } else {
        document.title = "Debug Statement Properties";
    }
    gChromeWindowView = event.view;
    // On Mac OSX, ensure the Scintilla view is visible by forcing a repaint.
    // TODO: investigate why this happens and come up with a better solution.
    // NOTE: repainting a Scintilla view by itself is not sufficient;
    // Mozilla needs to repaint the entire window.
    if (navigator.platform.match(/^Mac/)) {
        window.setTimeout(function() {
            window.resizeBy(1, 0);
            window.resizeBy(-1, 0);
        }, 10);
    }
    update_icon(theTool.iconurl);

    elems.$nameText.focus();
    elems.logicScimoz.isFocused = true; // show the caret
    elems.logicScimoz.caretPeriod = 0;

    UpdateField('name', true);
    updateOK();
}

function onUnload(event) {
    try {
        // The "close" method ensures the scintilla view is properly cleaned up.
        elems.logicView.close();
        scintillaOverlayOnUnload();
    } catch (e) {
        log.exception(e);
    }
}

function OK()  {
    if (Apply()) {
        window.arguments[0].res = true;
        if (window.arguments[0].task == 'new') {
            var parentitem = window.arguments[0].parentitem;
            var item = window.arguments[0].item;
            opener.ko.toolbox2.addNewItemToParent(item, parentitem);
            //XXX: NewTools @@@@ Can item.active be dropped in peSnippet.js ?
        }
        return true;
    }
    return false;
}

// Apply the current changes and return true iff successful. Otherwise return
// false.
function Apply() {
    // Apply the keybinding.
    try {
        var retval = elems.keybinding.apply(); // This may return false if a keybinding is partially entered
        if (!retval) return retval;
    } catch (e) {
        log.error(e);
        return false;
    }
    var language = elems.$languageMenu.element().selection;
    var currentDefault = legacy.toolbox2.getDefaultPrintStateForLanguage(language);
    if (elems.$set_as_activeCheckbox.element().checked && currentDefault)
    {
        currentDefault.setStringAttribute("active", "false");
        currentDefault.save();
    }
    theTool.setStringAttribute('name', elems.$nameText.value());
    theTool.setBooleanAttribute('active', elems.$set_as_activeCheckbox.element().getAttribute('checked'));
    theTool.setStringAttribute('language', language);
    theTool.setStringAttribute('logic', elems.logicScimoz.text);
    theTool.value = elems.$printstatementText.value();
    opener.ko.projects.invalidateItem(theTool);
    theTool.iconurl = "koicon://ko-svg/chrome/icomoon/skin/bug.svg?color=orange";
    if (window.arguments[0].task != 'new') {
        theTool.save();
    }
    elems.applyButton.setAttribute('disabled', 'true');
    return true;
}


function updateOK() {
    if (elems.$nameText.value() == '' ||
        elems.$printstatementText.value() == '' ||
        elems.$languageMenu.element().selection == '') {
        elems.OKButton.setAttribute('disabled', 'true');
        elems.applyButton.setAttribute('disabled', 'true');
    } else {
        if (elems.OKButton.hasAttribute('disabled')) {
            elems.OKButton.removeAttribute('disabled');
        }
        if (elems.applyButton.hasAttribute('disabled')) {
            elems.applyButton.removeAttribute('disabled');
        }
    }
}

// Do the proper UI updates for a user change.
//  "field" (string) indicates the field to update.
//  "initializing" (boolean, optional) indicates that the dialog is still
//      initializing so some updates, e.g. enabling the <Apply> button, should
//      not be done.
function UpdateField(field, initializing /* =false */)
{
    try {
        if (typeof(initializing) == "undefined" || initializing == null) initializing = false;

        // Only take action if there was an actual change. Otherwise things like
        // the <Alt-A> shortcut when in a textbox will cause a cycle in reenabling
        // the apply button.
        var name = elems.$nameText.value();
        if (name) {
            document.title = "'"+name+"' Properties";
        } else {
            document.title = "Unnamed " + theTool.prettytype + " Properties";
        }
        elems.$nameLabel.value(name);
        if (!initializing) {
            updateOK();
        }
    } catch (e) {
        log.exception(e);
    }
}

function Cancel()  {
    if (elems.logicScimoz.modify) {
        var resp = legacy.dialogs.yesNoCancel("Do you wish to save your changes?",
                               "No", // default response
                               null, // text
                               "Snippet was modified" //title
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

function scintillaBlur() {
    elems.logicScimoz.isFocused = true;  /* continue to show the caret */
    elems.logicScimoz.caretPeriod = 0;
}


function scintillaFocus() {
    elems.logicScimoz.caretPeriod = 500;
    elems.logicView.setFocus(); // needed to fix bug 87311
}

function InsertShortcutScintilla(shortcutWidget) {
    // Get the shortcut string from the menuitem widget and insert it into
    // the current snippet text. Also, if the menuitem has a "select"
    // attribute select the identified part of the inserted snippet.
    var shortcut = shortcutWidget.getAttribute("shortcut");
    var select = shortcutWidget.getAttribute("select");
    elems.logicScimoz.replaceSel(shortcut);
    if (select && shortcut.indexOf(select) != -1) {
        // Current position will be at the end of the inserted shortcut.
        var offset = shortcut.indexOf(select);
        elems.logicScimoz.anchor = elems.logicScimoz.currentPos - shortcut.length + offset;
        elems.logicScimoz.currentPos = elems.logicScimoz.anchor + select.length;
    }
    updateOK();
    elems.logicView.setFocus();
}

function InsertShortcutPrintStatement(shortcutWidget) {
    // Get the shortcut string from the menuitem widget and insert it into
    // the current snippet text. Also, if the menuitem has a "select"
    // attribute select the identified part of the inserted snippet.
    var shortcut = shortcutWidget.getAttribute("shortcut");
    var select = shortcutWidget.getAttribute("select");
    var textElem = elems.$printstatementText.element();
    var value = elems.$printstatementText.value();
    var prefix = value.substring(0,textElem.selectionStart);
    var suffix = value.substring(textElem.selectionEnd);
    elems.$printstatementText.value(prefix+shortcut+suffix);
    if (select && shortcut.indexOf(select) != -1) {
        // Current position will be at the end of the inserted shortcut.
        var offset = shortcut.indexOf(select);
        textElem.selectionStart = textElem.selectionEnd - shortcut.length + offset;
        textElem.selectionEnd = textElem.selectionStart + select.length;
    }
    updateOK();
    textElem.focus();
}

function update_icon(URI)
{
    try {
        document.getElementById('keybindingtab_icon').setAttribute('src', URI);
        //document.getElementById('snippettab_icon').setAttribute('src', URI);
        //if (URI.indexOf('_missing.png') != -1) {
        //    document.getElementById('snippettab_icon').setAttribute('tooltiptext', "The custom icon specified for this snippet is missing. Please choose another.");
        //} else {
        //    document.getElementById('snippettab_icon').removeAttribute('tooltiptext');
        //}
    } catch (e) {
        log.exception(e);
    }
}
