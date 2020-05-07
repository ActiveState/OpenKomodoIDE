/* Copyright (c) 2000-2011 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* -*- Mode: JavaScript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * Prompt for the open-delimiter, and put a suggested close-delimiter in its
 * place (which the user can override, but that assumes they know what they're
 * doing.
 */

var log = ko.logging.getLogger("dialogs.prompt");
var gOpenDelimiter = null;
var gCloseDelimiter = null;
var gDialog = {};

var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
    .getService(Components.interfaces.nsIStringBundleService)
    .createBundle("chrome://komodo/locale/rxx.properties");

function OnLoad()
{
    gDialog.open_delimiter = document.getElementById("open_delimiter");
    gDialog.close_delimiter = document.getElementById("close_delimiter");
    var args = window.arguments[0];
    gDialog.open_delimiter.value = args.open_delimiter;
    gDialog.open_delimiter.select();
    gDialog.close_delimiter.value = args.close_delimiter;
}

function OK()
{
    window.arguments[0].retval = "OK";
    window.arguments[0].open_delimiter = gDialog.open_delimiter.value;
    window.arguments[0].close_delimiter = gDialog.close_delimiter.value;
    return true;
}

function Cancel()
{
    window.arguments[0].retval = "Cancel";
    return true;
}

var matchers = "{}[]<>()";

function onTextChanged(sender) {
    var textTyped = sender.value;
    if (/[\w\s]/.test(textTyped)) {
        reportProblem(_bundle.GetStringFromName("Delimiters should be a punctuation character"));
    }
    var isOpeningBox = sender.id.indexOf("open") == 0;
    var idx = matchers.indexOf(textTyped);
    if (isOpeningBox) {
        if (idx % 2 == 0) {
            gDialog.close_delimiter.value = matchers[idx + 1];
        } else {
            gDialog.close_delimiter.value = textTyped;
        }
    } else if (idx % 2 == 0) {
        reportProblem(_bundle.GetStringFromName("You cant use a reserved opening delimiter to end a pattern"));
    }
}

function reportProblem(problem) {
    opener.opener.ko.dialogs.alert(_bundle.formatStringFromName("Pattern match might fail X", [problem], 1));
    window.focus();
}

function resetDelimiters() {
    var args = window.arguments[0];
    gDialog.open_delimiter.value = args.factory_delimiters[0];
    gDialog.close_delimiter.value = args.factory_delimiters[1];
}
