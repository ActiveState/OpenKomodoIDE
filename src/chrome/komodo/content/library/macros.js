/* Copyright (c) 2000-2007 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

if (typeof(ko)=='undefined') {
    var ko = {};
}
if (typeof(ko.macros)=='undefined') {
    ko.macros = {};
}

(function() {

var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                .getService(Components.interfaces.nsIStringBundleService)
                .createBundle("chrome://komodo/locale/library.properties");

this.CURRENT_MACRO_VERSION = 3;

function MacroRecorder() {
    this.mode = 'stopped';
    this._currentMacro = new Array();
    this._currentMacroText = '';
    this._currentMacroPasteSentinels = 0; // only used in Linux
    this.log = ko.logging.getLogger('ko.macros.recorder');
}

MacroRecorder.prototype = new Object();
MacroRecorder.prototype.constructor = MacroRecorder;

MacroRecorder.prototype.__defineGetter__("currentMacro",
function()
{
    return this._currentMacro;
});

MacroRecorder.prototype.startRecording = function() {
    if (this.mode != 'paused') {
        if (this._currentMacro) {
            delete this._currentMacro;
        }
        this._currentMacro = new Array();
        this._currentMacro.push(_bundle.formatStringFromName("macroRecordedOnComment", [Date()], 1) + '\n');
        this._currentMacro.push('komodo.assertMacroVersion(' + ko.macros.CURRENT_MACRO_VERSION + ');\n');
        this._currentMacro.push("if (komodo.view) { komodo.view.setFocus(); }\n");
        this._currentMacroText = new Array();
    }
    this.mode = 'recording';
    var record = document.getElementById("macroRecord");
    window.updateCommands("macro");
    var msg = _bundle.GetStringFromName("recordingMacro");
    require("notify/notify").send(msg, "macros", {id: "macroRecording"});
}

MacroRecorder.prototype.stopRecording = function(quiet /* false */) {
    this.mode = 'stopped';
    this._finishTextMacro();
    for (let i = 0; i < this._currentMacroPasteSentinels; i++) {
      // cmd_paste on Linux is asynchronous, so subsequent commands need to be
      // run in a 'setTimeout()' function. Finish the call here at the end.
      this._currentMacro.push("}, 100); // cmd_paste is async\n")
    }
    if (typeof(quiet) == 'undefined') {
        quiet = false;
    }
    window.updateCommands("macro");
    if (!quiet) {
        var msg = _bundle.GetStringFromName("macroRecorded");
        require("notify/notify").send(msg, "macros", {id: "macroRecording"});
    }
}

MacroRecorder.prototype.pauseRecording = function() {
    this.stopRecording();  // but...
    this.mode = 'paused'; // set the mode to paused
}

MacroRecorder.prototype.suspendRecording = function() {
    // This is used to temporarily suspend recording when
    // recording a macro that executes another macro -- we don't
    // want what that macro does (i.e. launching of commands) to
    // be recorded in _this_ macro.  This must be paired with
    // a call to resumeRecording (below)
    if (this.mode == 'recording') {
        this.stopRecording(true); // but ...
        this.mode = 'suspended'; // set the mode to paused
    }
}

MacroRecorder.prototype.resumeRecording = function() {
    if (this.mode == 'suspended') {
        this.mode = 'paused';
        this.startRecording();
    }
}


MacroRecorder.prototype._finishTextMacro = function() {
    if (this._currentMacroText != '') {
        this._currentMacro.push("komodo.view.selection = '" +
                                this._currentMacroText.replace('\\', '\\\\', 'g').replace("\'", "\\'", 'g') +
                                "';\n");
        this._currentMacroText = '';
    }
}

MacroRecorder.prototype.appendCommand = function(command) {
    try {
        if (! this._currentMacro) {
            this.log.warn("Trying to append a command while not in a macro!!!");
            return;
        }
        this._finishTextMacro();
        this._currentMacro.push("ko.commands.doCommand('" + command +"')\n");
        if (command == "cmd_paste" && Components.classes["@activestate.com/koInfoService;1"].
            getService(Components.interfaces.koIInfoService).platform.indexOf("linux") === 0) {
          // cmd_paste on Linux is asynchronous, so subsequent commands need to 
          // be run in a 'setTimeout()' function. Start the call here. It will
          // be finished when the macro is finished recording.
          this._currentMacro.push("setTimeout(function() {\n");
          this._currentMacroPasteSentinels++;
        }
    } catch (e) {
        log.exception(e);
    }
}

MacroRecorder.prototype.recordKeyPress = function(c) {
    if (! this._currentMacro) {
        this.log.warn("Trying to record keypresses while not in a macro!!!");
        return;
    }
    this._currentMacroText += c;
}

MacroRecorder.prototype.undo = function() {
    if (this._currentMacroText != '') {
        this._currentMacroText = this._currentMacroText.slice(0, this._currentMacroText.length-1);
    } else {
        this._currentMacro.pop();
    }
}

MacroRecorder.prototype.appendCode = function(code) {
    if (! this._currentMacro) {
        this.log.warn("Trying to append code while not in a macro!!!");
        return;
    }
    this._finishTextMacro();
    this._currentMacro.push(code);
}

MacroRecorder.prototype.executeMacro = function(macro) {
    var view = ko.views.manager.currentView;
    var scin = null;

    if (view && view.getAttribute('type') == 'editor') {
        scin = view.scimoz;
        scin.beginUndoAction();
    }

    try {
        try {
            if (macro == null) {
                macro = this._currentMacro;
            }
            if (macro == null) return;
            if (this.mode == 'recording') {
                this.mode = 'stopped'; // avoid recursion!
            }
            if (scin) {
                // XXX weird stuff.
                // For some reason, Scintilla always thinks the lines are folded, which results in selection of
                // folded lines, which is typically not what we want So we unfold all the lines in the buffer.
                for (var lineno=0;lineno < scin.lineCount;lineno++)
                    if ((scin.getFoldLevel(lineno) & scin.SC_FOLDLEVELHEADERFLAG) &&
                        !scin.getFoldExpanded(lineno))
                            scin.toggleFold(lineno)
            }
            var code = (macro.join(''));
            ko.macros.evalAsJavaScript(code);
        } catch (e) {
            this.log.error(e);
        }
    } finally {
        if (scin) {
            scin.endUndoAction();
        }
    }
}

MacroRecorder.prototype.executeLastMacro = function(macro) {
    this.executeMacro(this._currentMacro);
}

MacroRecorder.prototype.saveToToolbox = function(macro) {
    var name = ko.dialogs.prompt(_bundle.GetStringFromName("macroName"),
                                 _bundle.GetStringFromName("enterNameForNewMacro"));
    if (!name) return;
    var part = ko.toolbox2.createPartFromType('macro');
    part.setStringAttribute('name', name);
    part.setStringAttribute('language', 'JavaScript');
    part.setBooleanAttribute('async', false);
    part.setBooleanAttribute('trigger_enabled', false);
    part.setStringAttribute('trigger', "trigger_postopen");  // just to have something
    part.value = this._currentMacro.join('');
    ko.toolbox2.addItem(part);
    ko.uilayout.ensureTabShown('toolbox2viewbox');
}

this.recorder = new MacroRecorder();


}).apply(ko.macros);
