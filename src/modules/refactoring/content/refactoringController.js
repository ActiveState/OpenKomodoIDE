// Copyright (c) 2000-2011 ActiveState Software Inc.
// See the file LICENSE.txt for licensing information.

// The Refactoring controller.

if (typeof(ko) == 'undefined') {
    var ko = {};
}
if (!('refactoring' in ko)) {
    ko.refactoring = {};
}

(function(){

var lazy = {};

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyGetter(lazy, "log", function()
    ko.logging.getLogger("RefactoringController"));
//log.setLevel(ko.logging.LOG_DEBUG);

XPCOMUtils.defineLazyGetter(lazy, "bundle", function()
    Components.classes["@mozilla.org/intl/stringbundle;1"]
    .getService(Components.interfaces.nsIStringBundleService)
    .createBundle("chrome://refactoring/locale/refactoring.properties"));

function RefactoringController() {
}

RefactoringController.prototype.is_common_cmd_enabled_aux =
         function is_common_cmd_enabled_aux(cmdName, unsupportedLanguages, spew, allowRemote) {
    var isEnabled;
    var view = ko.views.manager.currentView;
    var cmd = document.getElementById(cmdName);
    cmd.removeAttribute("tooltiptext");
    if (!view || view.getAttribute('type') != 'editor' || !view.koDoc) {
        cmd.setAttribute("tooltiptext", "No editor view");
        return false;
    }
    var koDoc = view.koDoc;
    if (!koDoc) {
        cmd.setAttribute("tooltiptext", "No Komodo document");
        return false;
    }
    if (!allowRemote && koDoc.file && !koDoc.file.isLocal) {
        // remote files aren't ok, but untitled local docs (no koIFileEx) are ok
        let msg = lazy.bundle.formatStringFromName("Cant refactor remote files",
                                          [koDoc.displayPath], 1);
        cmd.setAttribute("tooltiptext", msg);
        if (spew) {
            require("notify/notify").interact(msg, "refactoring");
        }
        return false;
    }
    if (!ko.refactoring.getRefactoringLanguageObj(koDoc).supportsRefactoring
        || unsupportedLanguages.indexOf(koDoc.language) >= 0) {
        let msg = lazy.bundle.formatStringFromName("Language X doesnt support refactoring",
                                              [koDoc.language], 1);
        cmd.setAttribute("tooltiptext", msg);
        if (spew) {
            require("notify/notify").interact(msg, "refactoring");
        }
        return false;
    }
    let scimoz = view.scimoz;
    if (!scimoz) {
        cmd.setAttribute("tooltiptext", "No scimoz");
        return false;
    }
    return [true, view, scimoz, cmd];
};

RefactoringController.prototype.is_cmd_refactoring_extractMethod_enabled_aux = function(spew) {
    var parts, isEnabled, view, scimoz, cmd;
    parts = this.is_common_cmd_enabled_aux("cmd_refactoring_extractMethod",
                                           ["Tcl"], spew, /*allowRemote*/true);
    if (!parts[0]) {
        return false;
    }
    [isEnabled, view, scimoz, cmd] = parts;
    // last character of a word.
    let selectionStart = scimoz.selectionStart;
    let selectionEnd   = scimoz.selectionEnd;
    if (selectionStart == selectionEnd) {
        // No selection
        cmd.setAttribute("tooltiptext", "No selection");
        return false;
    }
    // There are other things we could check for, but have
    // the post-command-selection check for them.
    return [view, scimoz, selectionStart, selectionEnd];
};
 
RefactoringController.prototype.is_cmd_refactoring_extractMethod_enabled = function() {
    lazy.log.debug(">> is_cmd_refactoring_extractMethod_enabled");
    return !!this.is_cmd_refactoring_extractMethod_enabled_aux(/*spew=*/false);
}

RefactoringController.prototype.do_cmd_refactoring_extractMethod = function() {
    var view, scimoz, selectionStart, selectionEnd;
    [view, scimoz, selectionStart, selectionEnd] = this.is_cmd_refactoring_extractMethod_enabled_aux(/*spew=*/true);
    if (!view) {
        return;
    }
    ko.refactoring.goExtractMethod(view, scimoz, selectionStart, selectionEnd);
}          

RefactoringController.prototype.onRecognizedStyle =
    function onRecognizedStyle(styles, style, scimoz, currentPos) {
    if (styles.indexOf(style) >= 0) {
        return true;
    }
    if (currentPos == 0) {
        return false;
    }
    var prevPos = scimoz.positionBefore(currentPos);
    var prevStyle = scimoz.getStyleAt(prevPos);
    return styles.indexOf(prevStyle) >= 0;
};

RefactoringController.prototype.is_cmd_refactoring_renameClassMember_enabled_aux = function(spew) {
    var parts, isEnabled, view, scimoz, cmd;
    parts = this.is_common_cmd_enabled_aux("cmd_refactoring_renameClassMember",
                                           ["Tcl"], spew);
    if (!parts[0]) {
        return false;
    }
    [isEnabled, view, scimoz, cmd] = parts;
    // This needs to be more permissive than rename-variable, except
    // we don't rename Perl things that start with a sigil -- with other
    // languages, rename is ok (Ruby @ and @@, PHP $).
    // 
    //XXX This returns false when the caret is to the right of the
    // last character of a word.
    // Enabled only if the cursor is on an identifier (not a keyword).
    var currentPos = scimoz.currentPos;
    var style = scimoz.getStyleAt(currentPos);
    var languageObj = view.koDoc.languageObj;
    var styles = (languageObj.getNamedStyles("identifiers").
                  concat(languageObj.getNamedStyles('classes')).
                  concat(languageObj.getNamedStyles('modules')).
                  concat(languageObj.getNamedStyles('functions')));
    if (languageObj.name != "Perl") {
        styles = styles.concat(languageObj.getVariableStyles());
    }                  
    lazy.log.debug("valid styles: " + styles);
    // Look at the previous style if the current one is no good.
    if (!this.onRecognizedStyle(styles, style, scimoz, currentPos)) {
        var currentWord = ko.interpolate.getWordUnderCursor(scimoz);
        let msg = lazy.bundle.formatStringFromName("Refactoring X is not a valid variable name",
                                              [currentWord], 1);
        if (spew) {
            require("notify/notify").interact(msg, "refactoring");
        }
        cmd.setAttribute("tooltiptext", msg);
        return false;
    }
    var selStart = scimoz.selectionStart;
    var selEnd = scimoz.selectionEnd;
    if (selStart < selEnd) {
        var selText = scimoz.selText;
        var ptn = new RegExp("^[" + languageObj.variableIndicators + "\\w]+$");
        if (!ptn.test(selText)) {
            let selTextFixed = selText.replace("\r", "\\r").
                replace("\n", "\\n").replace("\t", "\\t");
            let msg = lazy.bundle.formatStringFromName("Refactoring X is not a valid variable name",
                                                  [selTextFixed], 1);
            if (spew) {
                require("notify/notify").interact(msg, "refactoring");
            }
            cmd.setAttribute("tooltiptext", msg);
            return false;
        }
    }
    return [view, scimoz, styles];
};
 
RefactoringController.prototype.is_cmd_refactoring_renameClassMember_enabled = function() {
    lazy.log.debug(">> is_cmd_refactoring_renameClassMember_enabled");
    return !!this.is_cmd_refactoring_renameClassMember_enabled_aux(/*spew=*/false);
};

RefactoringController.prototype.do_cmd_refactoring_renameClassMember = function() {
    var view, scimoz, styles;
    [view, scimoz, styles] = this.is_cmd_refactoring_renameClassMember_enabled_aux(/*spew=*/true);
    if (view) {
        ko.refactoring.goRenameClassMember(view, scimoz, styles);
    }
};

RefactoringController.prototype.is_cmd_refactoring_renameVariable_enabled_aux = function(spew) {
    var parts, isEnabled, view, scimoz, cmd;
    parts = this.is_common_cmd_enabled_aux("cmd_refactoring_renameVariable",
                                           ["Tcl"], spew, /*allowRemote*/true);
    if (!parts[0]) {
        return false;
    }
    [isEnabled, view, scimoz, cmd] = parts;
    //XXX This returns false when the caret is to the right of the
    // last character of a word.
    // Enabled only if the cursor is on an identifier (not a keyword).
    var currentPos = scimoz.currentPos;
    var style = scimoz.getStyleAt(currentPos);
    var languageObj = view.koDoc.languageObj;
    var styles = (languageObj.getVariableStyles().
                  concat(languageObj.getNamedStyles("identifiers")).
                  concat(languageObj.getNamedStyles('classes')).
                  concat(languageObj.getNamedStyles('modules')).
                  concat(languageObj.getNamedStyles('functions')));
    if (ko.refactoring.prefs["refactoring.renameVariable_in_strings"]) {
        styles = styles.concat(languageObj.getStringStyles());
    }
    if (ko.refactoring.prefs["refactoring.renameVariable_in_comments"]) {
        styles = styles.concat(languageObj.getCommentStyles());
    }
    // Look at the previous style if the current one is no good.
    if (!this.onRecognizedStyle(styles, style, scimoz, currentPos)) {
        var currentWord = ko.interpolate.getWordUnderCursor(scimoz);
        let msg = lazy.bundle.formatStringFromName("Refactoring X is not a valid variable name",
                                              [currentWord], 1);
        if (spew) {
            require("notify/notify").interact(msg, "refactoring");
        }
        cmd.setAttribute("tooltiptext", msg);
        return false;
    }
    var selStart = scimoz.selectionStart;
    var selEnd = scimoz.selectionEnd;
    if (selStart < selEnd) {
        var selText = scimoz.selText;
        var ptn = new RegExp("^[" + languageObj.variableIndicators + "\\w]+$");
        if (!ptn.test(selText)) {
            let selTextFixed = selText.replace("\r", "\\r").
                replace("\n", "\\n").replace("\t", "\\t");
            let msg = lazy.bundle.formatStringFromName("Refactoring X is not a valid variable name",
                                                  [selTextFixed], 1);
            if (spew) {
                require("notify/notify").interact(msg, "refactoring");
            }
            cmd.setAttribute("tooltiptext", msg);
            return false;
        }
    }
    return [view, scimoz, styles];
};
 
RefactoringController.prototype.is_cmd_refactoring_renameVariable_enabled = function() {
    lazy.log.debug(">> is_cmd_refactoring_renameVariable_enabled");
    return !!this.is_cmd_refactoring_renameVariable_enabled_aux(/*spew=*/false);
}

RefactoringController.prototype.do_cmd_refactoring_renameVariable = function() {
    var view, scimoz, styles;
    [view, scimoz, styles] = this.is_cmd_refactoring_renameVariable_enabled_aux(/*spew=*/true);
    if (view) {
        ko.refactoring.goRenameVariable(view, scimoz, styles);
    }
}          

RefactoringController.prototype.supportsCommand = function(command) {
    return ("is_" + command + "_enabled") in this;
};
          
RefactoringController.prototype.isCommandEnabled = function(command) {
    return this["is_" + command + "_enabled"]();
};
    
RefactoringController.prototype.doCommand = function(command) {
    return this["do_" + command]();
};
    

/*
  The refactoring controller is given a higher priority in order to override common
  commands like 'cmd_copy' and 'cmd_paste', when focus is on the refactoring tree.
 */
window.addEventListener("komodo-ui-started", function() {
    try {
        this.controller = new RefactoringController();
        window.controllers.insertControllerAt(0, this.controller);
    } catch(ex) {
        lazy.log.error("Failed to set a refactoring controller: " + ex + "\n");
    }
}.bind(this), true);

}).apply(ko.refactoring);
