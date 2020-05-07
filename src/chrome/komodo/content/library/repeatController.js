/* Copyright (c) 2000-2011 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* -*- Mode: JavaScript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

xtk.include("controller");

(function() {

const Cc = Components.classes;
const Ci = Components.interfaces;

var _bundle = Cc["@mozilla.org/intl/stringbundle;1"]
                .getService(Ci.nsIStringBundleService)
                .createBundle("chrome://komodo/locale/library.properties");
var _log = ko.logging.getLogger("repeatController");

/**
 * repeatController
 * handles cmd_repeatNextCommandBy (i.e. repeat commands)
 */
function repeatController() {
    // we're not using an XPCOM interface, let API users access relevant methods
    this.wrappedJSObject = this;

    // bind the method to this
    this.cancelMultiHandler = this._cancelMultiHandler.bind(this);

    ko.main.addWillCloseHandler(this._destructor, this);

    this.repeatCounter = 0;
    this.defaultRepeatCounter = 0;

    const prefName = "defaultRepeatFactor";
    var default_defaultRepeatFactor = 4; // Like in Emacs
    this[prefName] = default_defaultRepeatFactor;

    try {
        var prefsSvc = Cc["@activestate.com/koPrefService;1"]
                         .getService(Ci.koIPrefService);
        var prefs = prefsSvc.prefs;
        if (prefs.hasLongPref(prefName)) {
            var candidate = prefs.getLongPref(prefName);
            // Sanity-check it
            if (!candidate || candidate <= 0) {
                // The ! part includes NaN as well as 0
                // Undefined prefs should throw an exception
                dump("new ISController: repeatController pref " + prefName + " setting of " + candidate + "\n");
            } else {
                this[prefName] = candidate;
            }
        }
    } catch(ex) {
        _log.error(ex + "\n");
    }
    
}

// The following two lines ensure proper inheritance (see Flanagan, p. 144).
repeatController.prototype = new xtk.Controller();
repeatController.prototype.constructor = repeatController;

repeatController.prototype._destructor = function() {
    window.controllers.removeController(this);
}

repeatController.prototype.do_cmd_repeatNextCommandBy = function() {
    try {
        var view = ko.views.manager.currentView;
        if (view && view.scintilla) {
            var scintilla = view.scintilla;
            this._scintilla = scintilla;
            scintilla.key_handler = this._multiHandler.bind(this);
            scintilla.addEventListener('blur', this.cancelMultiHandler, false);
            scintilla.scimoz.isFocused = true;
        } else {
            // no tabs open
            this._scintilla = null;
        }
        this.inRepeatCounterAccumulation = true;
        this.repeatCounter = 0;
        this.defaultRepeatCounter = this.defaultRepeatFactor;
        
        var msg = _bundle.formatStringFromName("numberOfRepeats",
                                     [this.defaultRepeatCounter], 1);
        require("notify/notify").send(msg, "editor");
    } catch (e) {
        _log.exception(e);
    }
};

repeatController.prototype.getCount = function() {
    var count;
    if (this.defaultRepeatCounter > 0) {
        count = this.defaultRepeatCounter;
    } else {
        count = this.repeatCounter;
    }
    return count;
}

/**
 * cancelMultiHandler
 * Cancel the "repeat next command N times" handler
 * @note This is an exposed API
 */
repeatController.prototype._cancelMultiHandler = function cancelMultiHandler(event) {
    if (!this.inRepeatCounterAccumulation) {
        _log.warn("trying to cancel handler without installing it first");
        return;
    }
    this.inRepeatCounterAccumulation = false;
    if (this._scintilla) {
        this._scintilla.removeEventListener('blur', this.cancelMultiHandler, false);
        this._scintilla.key_handler = null;
    }
};

/* _lookingAtRepeatCommand -
 * @param {Object} event - the keypress event object
 *
 * The single-key variant implement emacs-style Ctrl-U universal-argument
 * key.  This avoids ambiguity of what Ctrl-U means in the
 * sequence Ctrl-K, Ctrl-U, Ctrl-U
 *
 * Emacs documentation:
 *
 ** Begin a numeric argument for the following command.
 ** Digits or minus sign following C-u make up the numeric argument.
 ** C-u following the digits or minus sign ends the argument.
 ** C-u without digits or minus sign provides 4 as argument.
 ** (Note that "4" is configurable via the unexposed pref defaultRepeatFactor)
 ** Repeating C-u without digits or minus sign
 **  multiplies the argument by 4 each time.
 ** For some commands, just C-u by itself serves as a flag
 ** which is different in effect from any particular numeric argument.
 ** These commands include C-@ and C-x (.
 *
 * Negative arguments don't make sense yet -- see bug
 * http://bugs.activestate.com/show_bug.cgi?id=72910
 */

repeatController.prototype._lookingAtRepeatCommand = function(event) {
    var actual_key = ko.keybindings.manager.event2keylabel(event);
    var expected_key_sequences = ko.keybindings.manager.command2key['cmd_repeatNextCommandBy'];
    for (var i in expected_key_sequences) {
        // Reject multi-character keylabels like Ctrl-K, Ctrl-Home
        // to eliminate any ambiguity.
        // to distinguish it from keys that *use* the comma
        var acceptable_key_seq = expected_key_sequences[i].split(/,[\s]+/);
        if (acceptable_key_seq.length == 1
            && acceptable_key_seq[0] == actual_key) {
            return true;
        }
    }
    return false;
}

repeatController.prototype._multiHandler = function(event) {
    var msg;
    try {
        if (event.type != 'keypress') return;
        if (event.charCode >= 48 && event.charCode <= 57) {
            this.defaultRepeatCounter = 0;
            this.repeatCounter = this.repeatCounter * 10 + (event.charCode - 48);
            msg = _bundle.formatStringFromName("numberOfRepeats",
                                         [this.repeatCounter], 1);
            require("notify/notify").send(msg, "editor");
            return;
        } else if (this._lookingAtRepeatCommand(event)) {
            event.cancelBubble = true;
            event.preventDefault();
            this.defaultRepeatCounter *= this.defaultRepeatFactor;
            msg = _bundle.formatStringFromName("numberOfRepeats",
                                         [this.defaultRepeatCounter], 1);
            require("notify/notify").send(msg, "editor");
            return;
        }
        var key = ko.keybindings.manager.event2keylabel(event);
        // If the key corresponds to the cmd_cancel command, cancel.
        if (ko.keybindings.manager.command2key['cmd_cancel'] == key) {
            event.cancelBubble = true;
            this.cancelMultiHandler();
            return;
        }
        if (event.charCode && !event.ctrlKey && !event.altKey && !event.metaKey) {
            this.cancelMultiHandler();
            // it's just a simple keystroke, do that.
            key = String.fromCharCode(event.charCode);
            var txt = '';
            var count = this.getCount();
            for (var i = 0; i < count; i++) {
                txt += key;
            }
            if (this._scintilla) {
                this._scintilla.scimoz.replaceSel(txt);
            }
        }
    } catch (e) {
        _log.error(e);
    }
}

window.controllers.appendController(new repeatController());

}).apply();
