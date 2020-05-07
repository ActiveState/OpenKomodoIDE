/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* -*- Mode: JavaScript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * variable editor dialog.
 *
 * This dialog allows you to ask the user for a single string input.  Normally
 * this dialog is called indirectly via dialogs.js::prompt_dialog().
 * See the usage documentation there first.
 *
 * Features:
 *  - OK and Cancel buttons.
 *  - Optional leading prompt.
 *  - Configurable dialog title and textbox label.
 *  - Dialog is resizable and it remembers its dimensions.
 *  - Can have an MRU for the textbox.
 *  - Can specify a validator for the value.
 *
 * Usage:
 *  All dialog interaction is done via an object passed in and out as the first
 *  window argument: window.arguments[0]. All these arguments are optional.
 *      .prompt         a leading <description/> to the textbox.
 *                      XXX Note that newlines are not handled nicely. I
 *                      suppose it would be nice to treat these like paragraph
 *                      separators and create separate <description/> blocks
 *                      for them.
 *      .label          the textbox's label
 *      .value          default value for textbox
 *      .title          the dialog title
 *      .mruName        if set this will be used to identify an MRU preference
 *                      set and an MRU will be provided
 *      .validator      A callable object to validate the current value.  It
 *                      will be called with the current value and should return
 *                      true iff the value is acceptable.
 *      .multiline      if true, makes the input box a multiline edit box.
 *                      Multiline and autocomplete (i.e. usage of 'mruName')
 *                      are mutually exclusive.
 *      .screenX, .screenY allow one to specify a dialog position other than
 *                      the alert position.
 *
 *  On return window.arguments[0] has:
 *      .retval         "OK" or "Cancel" indicating how the dialog was exitted
 *  and iff .retval == "OK":
 *      .value          is the content of the textbox on exit.
 *
 */

//---- globals

var _gValidator = null; // Function to validate entered value.
var _gUsingMRU = false;
var log = ko.logging.getLogger('DBG_VariableEditor');
//log.setLevel(ko.logging.LOG_DEBUG);


//---- internal support routines

function _safeMoveTo(newX, newY) {
    if (newX == null) newX = opener.screenX;
    if (newY == null) newY = opener.screenY;

    // Ensure the new position is on screen.
    if (newX < screen.availLeft)
        newX = screen.availLeft + 20;
    if ((newX + window.outerWidth) > (screen.availLeft + screen.availWidth))
        newX = (screen.availLeft + screen.availWidth)
               - window.outerWidth - 20;
    if (newY < screen.availTop)
        newY = screen.availTop + 20;
    if ((newY + window.outerHeight) > (screen.availTop + screen.availHeight))
        newY = (screen.availTop + screen.availHeight)
               - window.outerHeight - 60;

    window.moveTo(newX, newY);
}


//---- interface routines for prompt.xul

function OnLoad()
{
    try {
        var dialog = document.getElementById("dialog-variableeditor")
        var okButton = dialog.getButton("accept");
        var cancelButton = dialog.getButton("cancel");
        okButton.setAttribute("accesskey", "o");
        cancelButton.setAttribute("accesskey", "c");

        // .prompt
        var descWidget = document.getElementById("prompt");
        var desc = window.arguments[0].prompt;
        if (typeof desc != "undefined" && desc != null) {
            var textNode = document.createTextNode(desc);
            descWidget.appendChild(textNode);
        } else {
            descWidget.setAttribute("collapsed", "true");
        }

        // .label
        var label = window.arguments[0].label;
        if (typeof label == "undefined" || label == null) {
            var labelBoxWidget = document.getElementById("label-box");
            labelBoxWidget.setAttribute("collapsed", "true");
        } else {
            var labelWidget = document.getElementById("label");
            labelWidget.setAttribute("value", label);
        }

        // .value
        var value = window.arguments[0].value;
        if (typeof value == "undefined" || value == null) {
            value = "";
        }
        var textboxWidget = document.getElementById("textbox");
        textboxWidget.setAttribute("value", value);

        var radioWidget = document.getElementById("datatype");
        var isString = false;
        var dbgpProperty = window.arguments[0].dbgpProperty;
        if (typeof dbgpProperty == "undefined") {
            dbgpProperty = null;
            radioWidget.setAttribute('collapsed','true');
        } else if (dbgpProperty) {
            isString = dbgpProperty.typeName == 'string';
        }
        radioWidget.selectedItem = document.getElementById(isString?'radioString':'radioExpression');

        // .title
        if (typeof window.arguments[0].title != "undefined" &&
            window.arguments[0].title != null) {
            document.title = window.arguments[0].title;
        } else {
            document.title = "Komodo";
        }

        // .mruName
        var mruName = window.arguments[0].mruName;
        if (typeof mruName != "undefined" && mruName != null) {
            textboxWidget.setAttribute("autocompletesearchparam", mruName+"_mru");
            textboxWidget.removeAttribute("disableautocomplete");
            textboxWidget.setAttribute("enablehistory", "true");
            _gUsingMRU = true;
        }

        // .validator
        var validator = window.arguments[0].validator;
        if (typeof validator != "undefined" && validator != null) {
            _gValidator = validator;
        }

        // .multiline
        if (window.arguments[0].action == 'edit' ||
            (typeof(window.arguments[0].multiline) != 'undefined' &&
            window.arguments[0].multiline)) {
            textboxWidget.setAttribute("multiline", "true");
            // Autocomplete interferes with multiline (warning about this
            // is done by dialogs.js::ko.dialogs.prompt()).
            textboxWidget.removeAttribute("type");
        } else if (window.arguments[0].action != 'edit') {
            document.getElementById("datatype").setAttribute('collapsed','true');
        }

        // Size to content before moving so calculations are correct.
        window.sizeToContent();
        var screenX = window.arguments[0].screenX;
        if (typeof(screenX) == "undefined") screenX = null;
        var screenY = window.arguments[0].screenY;
        if (typeof(screenY) == "undefined") screenY = null;
        if (screenX || screenY) {
            _safeMoveTo(screenX, screenY);
        } else {
            if (opener.innerHeight == 0) { // indicator that opener hasn't loaded yet
                dialog.centerWindowOnScreen();
            } else {
                dialog.moveToAlertPosition(); // requires a loaded opener
            }
        }

        document.getElementById("textbox").focus();
    } catch(ex) {
        log.exception(ex, "Error loading prompt dialog.");
    }
}

function doPropertySet()
{
    var value = document.getElementById("textbox").value;
    var radioWidget = document.getElementById("datatype");
    var view = window.arguments[0].view;
    var dbgpProperty = window.arguments[0].dbgpProperty;
    var currentIndex = view.mSelection.currentIndex;
    var isString = radioWidget.value=="1";

    try {
        switch(window.arguments[0].action) {
        case 'replace':
            view.removeVariable(currentIndex);
        case 'add':
            if (view.haveVariable(value)) {
                break;
            }
            return view.addVariable(value);
            break;
        case 'edit':
            var type = null;
            var dbgpSession = view.dbgTabManager.session.dbg;
            if (isString)
                type = dbgpSession.getDataType('string').languageType;
            return view.setVariable(currentIndex, dbgpProperty.fullname, value, type);
            break;
        }
    } catch(e) {
        // XXX TODO get the dbgperror exception
    }
    return false;
}

function OnUnload()
{
    if (typeof window.arguments[0].retval == "undefined") {
        // This happens when "X" window close button is pressed.
        window.arguments[0].retval = "Cancel";
    } else if (window.arguments[0].retval == "OK") {
        if (_gUsingMRU) {
            ko.mru.addFromACTextbox(textboxWidget);
        }
    }
}


function OK()
{
    window.arguments[0].retval = "OK";
    var textboxWidget = document.getElementById("textbox");
    textboxWidget.focus();
    if (!_gValidator || _gValidator(textboxWidget.value)) {
        try {
            return doPropertySet();
        } catch(e) {
            log.exception(e);
        }
    }
    return false;
}


function Cancel()
{
    window.arguments[0].retval = "Cancel";
    return true;
}


