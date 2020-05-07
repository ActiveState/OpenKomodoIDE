/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

// Note that we can never use the "current file's extension" or other
// simple rules to determine "can we debug".  *ANY* file may have a
// valid invocation setup.  So for now, this code assumes that
// ALL files are debuggable - this will mean that ALL files prompt
// for an invocation, which the user may cancel if they made
// an error.

if (typeof(ko) == 'undefined') {
    var ko = {};
}
if (typeof(ko.dbg) == 'undefined') {
    ko.dbg = {};
}

(function() { /* ko.dbg */


// Execute a "start debugger" command -
// the "Control" key switches whether to show the dialog
// or not, with the default being set by the dbgShowDialog pref
this.doCommand = function debugger_doCommand(command, event)
{
    try {
        if (typeof(event) != 'undefined' && event)
            ko.dbg.controller.skipDialog = event.ctrlKey;
        else
            ko.dbg.controller.skipDialog = null;
        return ko.commands.doCommand(command)
    } catch(e) {
        ko.dbg.manager.log.exception(e);
        window.updateCommands('debug_state');
    }
    return false;
}

function DebuggerItemsController() {
    this.skipDialog = 0;
    this.wrappedJSObject = this;
    window.controllers.appendController(this);
}

// The following two lines ensure proper inheritance (see Flanagan, p. 144).
DebuggerItemsController.prototype = new xtk.Controller();
DebuggerItemsController.prototype.constructor = DebuggerItemsController;

DebuggerItemsController.prototype.destroy = function() {
    window.controllers.removeController(this);
}

DebuggerItemsController.prototype._debuggerCanStart = function() {
    var v = ko.views.manager.currentView;
    return (!ko.dbg.manager.currentSession || ko.dbg.manager.currentSession.isInteractive) &&
            v && v.getAttribute('type') == 'editor' &&
            v.koDoc && v.koDoc.file && v.koDoc.file.isLocal;
}

DebuggerItemsController.prototype._debuggerSessionCanStep = function() {
    return ko.dbg.manager.currentSession &&
           !ko.dbg.manager.currentSession.isInteractive &&
           ko.dbg.manager.currentSession.canStep();
}

DebuggerItemsController.prototype._debuggerCanStepOrStart = function() {
    return this._debuggerCanStart() ||
           this._debuggerSessionCanStep();
}

DebuggerItemsController.prototype._debuggerCanRun = function() {
    return this._debuggerCanStart() ||
            (ko.dbg.manager.currentSession && !ko.dbg.manager.currentSession.isInteractive &&
             ko.dbg.manager.currentSession.canRun());
}

DebuggerItemsController.prototype._debuggerSessionStateIs = function (state) {
    return ko.dbg.manager.currentSession &&
           !ko.dbg.manager.currentSession.isInteractive &&
           ko.dbg.manager.currentSession.getState() == state;
}

DebuggerItemsController.prototype._debuggerSessionStateIsNot = function (state) {
    return ko.dbg.manager.currentSession &&
           !ko.dbg.manager.currentSession.isInteractive &&
           ko.dbg.manager.currentSession.getState() != state;
}

DebuggerItemsController.prototype.is_cmd_dbgNewSession_enabled = function () {
    return ko.dbg.manager.currentSession;
}

DebuggerItemsController.prototype.do_cmd_dbgNewSession = function() {
    /* setup a new debugger tab, then step into the current buffer */
    ko.dbg.tabManager.showNewTab(null, function onNewTabReady() {
        ko.dbg.manager.doStep(Components.interfaces.koIDBGPSession.RESUME_STEP_IN);
    });
}

DebuggerItemsController.prototype.is_cmd_dbgStepIn_enabled = function () {
    return this._debuggerCanStepOrStart();
}

DebuggerItemsController.prototype.do_cmd_dbgStepIn = function() {
    function doStepIn() {
        ko.dbg.manager.doStep(Components.interfaces.koIDBGPSession.RESUME_STEP_IN);
    }
    // if the current session is interactive, start a new debugger tab
    if (ko.dbg.manager.currentSession && ko.dbg.manager.currentSession.isInteractive) {
        ko.dbg.tabManager.showNewTab(null, doStepIn);
    } else {
        doStepIn();
    }
}

DebuggerItemsController.prototype.is_cmd_dbgStepOver_enabled = function () {
    return this._debuggerSessionCanStep();
}

DebuggerItemsController.prototype.do_cmd_dbgStepOver = function() {
    ko.dbg.manager.doStep(Components.interfaces.koIDBGPSession.RESUME_STEP_OVER);
}

DebuggerItemsController.prototype.is_cmd_dbgStepCursor_enabled = function () {
    return this._debuggerCanStepOrStart();
}

DebuggerItemsController.prototype.do_cmd_dbgStepCursor = function() {
    ko.dbg.manager.doStep(Components.interfaces.koIDBGPSession.RESUME_GO, true);
}

DebuggerItemsController.prototype.is_cmd_dbgStepOut_enabled = function () {
    return this._debuggerSessionCanStep();
}
DebuggerItemsController.prototype.do_cmd_dbgStepOut = function() {
    ko.dbg.manager.doStep(Components.interfaces.koIDBGPSession.RESUME_STEP_OUT);
}

DebuggerItemsController.prototype.is_cmd_dbgDetach_enabled = function () {
    return this._debuggerSessionStateIsNot(ko.dbg.manager.STATE_STOPPED) &&
           ko.dbg.manager.currentSession.dbg &&
           ko.dbg.manager.currentSession.dbg.supportsDetach;
}
DebuggerItemsController.prototype.do_cmd_dbgDetach = function() {
    ko.dbg.manager.currentSession.detach();
}

DebuggerItemsController.prototype.is_cmd_dbgBreakNow_enabled = function () {
    try {
        // Better than testing each of currentSession and dbg individually
        return ko.dbg.manager.currentSession.dbg.supportsAsync &&
               this._debuggerSessionStateIs(ko.dbg.manager.STATE_RUNNING);
    } catch(ex) {
        return false;
    }
}
DebuggerItemsController.prototype.do_cmd_dbgBreakNow = function() {
    ko.dbg.manager.currentSession.breaknow();
}

DebuggerItemsController.prototype.is_cmd_dbgStop_enabled = function () {
    return this._debuggerSessionStateIsNot(ko.dbg.manager.STATE_STOPPED);
}
DebuggerItemsController.prototype.do_cmd_dbgStop = function() {
    // user forcing a stop, dont reset the view on shutdown.  this is done here
    // since the terminate function is used in other cases as well, and we only
    // want to do this if the user asked for it
    if (this._debuggerSessionStateIsNot(ko.dbg.manager.STATE_STOPPED)) {
        ko.dbg.manager.currentSession.viewAtDebuggerStart = null;
        ko.dbg.manager.currentSession.terminate();
    }
}

DebuggerItemsController.prototype.is_cmd_dbgInteractiveStop_enabled = function () {
    if (!ko.dbg.manager.currentSession) {
        return false;
    }
    return ko.dbg.manager.currentSession.getState() == ko.dbg.manager.STATE_INTERACTIVE;
}
DebuggerItemsController.prototype.do_cmd_dbgInteractiveStop = function(event) {
    if (event) {
        // we got an event, try to close the right tab
        ko.dbg.tabManager.closeTab(event.target.ownerDocument.defaultView);
    } else {
        // no event, we're left with closing whatever is current
        ko.dbg.tabManager.closeCurrent();
    }
}

DebuggerItemsController.prototype.is_cmd_dbgGo_enabled = function () {
    return this._debuggerCanStepOrStart();
}
DebuggerItemsController.prototype.do_cmd_dbgGo = function() {
    function doGo() {
        ko.dbg.manager.doStep(Components.interfaces.koIDBGPSession.RESUME_GO);
    }
    // if the current session is interactive, start a new debugger tab
    if (ko.dbg.manager.currentSession && ko.dbg.manager.currentSession.isInteractive) {
        ko.dbg.tabManager.showNewTab(null, doGo);
    } else {
        doGo();
    }
}

DebuggerItemsController.prototype.is_cmd_dbgGoSkipDialog_enabled = function () {
    return this._debuggerCanStepOrStart();
}
DebuggerItemsController.prototype.do_cmd_dbgGoSkipDialog = function() {
    function doGoSkipDialog() {
        ko.dbg.controller.skipDialog = 1;
        ko.dbg.manager.doStep(Components.interfaces.koIDBGPSession.RESUME_GO);
    }
    // if the current session is interactive, start a new debugger tab
    if (ko.dbg.manager.currentSession && ko.dbg.manager.currentSession.isInteractive) {
        ko.dbg.tabManager.showNewTab(null, doGoSkipDialog);
    } else {
        doGoSkipDialog();
    }
}

DebuggerItemsController.prototype.is_cmd_dbgRun_enabled = function () {
    return this._debuggerCanRun();
}
DebuggerItemsController.prototype.do_cmd_dbgRun = function() {
    function doRun() {
        ko.dbg.invocation.runScript();
    }
    // if the current session is interactive, start a new debugger tab
    if (ko.dbg.manager.currentSession && ko.dbg.manager.currentSession.isInteractive) {
        ko.dbg.tabManager.showNewTab(null, doRun);
    } else {
        doRun();
    }
}

DebuggerItemsController.prototype.is_cmd_dbgProfile_enabled = function () {
    return this._debuggerCanRun();
}
DebuggerItemsController.prototype.do_cmd_dbgProfile = function() {
    function doProfile() {
        ko.dbg.invocation.profileScript();
    }
    // if the current session is interactive, start a new debugger tab
    if (ko.dbg.manager.currentSession && ko.dbg.manager.currentSession.isInteractive) {
        ko.dbg.tabManager.showNewTab(null, doProfile);
    } else {
        doProfile();
    }
}

DebuggerItemsController.prototype.is_cmd_dbgShowCurrentStatement_enabled = function () {
    return this._debuggerSessionStateIs(ko.dbg.manager.STATE_BREAK) ||
           this._debuggerSessionStateIs(ko.dbg.manager.STATE_INTERACTIVE);
}
DebuggerItemsController.prototype.do_cmd_dbgShowCurrentStatement = function() {
    ko.dbg.manager.currentSession.showCurrentStatement();
}
DebuggerItemsController.prototype.is_cmd_dbgBreakpointToggle_enabled = function () {
    return (ko.views.manager.currentView &&
            ko.views.manager.currentView.getAttribute('type') == 'editor' &&
            ko.views.manager.currentView.koDoc &&
            ko.views.manager.currentView.koDoc.file);
            // XXX we need to allow breakpoints to be set in XML files
            //&& ko.views.manager.currentView.koDoc.languageObj.debuggable);
}
DebuggerItemsController.prototype.do_cmd_dbgBreakpointToggle = function() {
    var view = ko.views.manager.currentView;
    var line = view.scimoz.lineFromPosition(view.scimoz.currentPos) + 1;
    ko.dbg.breakpoints.toggleState(view, line);
};
 
DebuggerItemsController.prototype.is_cmd_dbgAddSelectedVariableToWatchTable_enabled = function () {
    if (!ko.dbg.manager.currentSession
        || this._debuggerSessionStateIs(ko.dbg.manager.STATE_RUNNING)) {
        return false;
    }
    var view = ko.views.manager.currentView;
    if (!view || view.getAttribute('type') != 'editor') {
        return false;
    }
    var scimoz = view.scimoz;
    var text = scimoz.selText || ko.interpolate.getWordUnderCursor(scimoz);
    return text.length && /\S/.test(text) && text.indexOf("\n") === -1;
};

DebuggerItemsController.prototype.do_cmd_dbgAddSelectedVariableToWatchTable = function() {
    try {
        ko.dbg.manager.addSelectedVariableToWatchTable();
    } catch (ex) {
        ko.dbg.manager.log.exception(ex);
    }
}

DebuggerItemsController.prototype .is_cmd_dbgBreakpointAddOrEdit_enabled = function () {
    return (ko.views.manager.currentView &&
            ko.views.manager.currentView.getAttribute('type') == 'editor' &&
            ko.views.manager.currentView.koDoc &&
            ko.views.manager.currentView.koDoc.file);
            // XXX we need to allow breakpoints to be set in XML files
            //&& ko.views.manager.currentView.koDoc.languageObj.debuggable);
}
DebuggerItemsController.prototype.do_cmd_dbgBreakpointAddOrEdit = function() {
    try {
        var view = ko.views.manager.currentView;
        var uri = view.koDoc.file.URI;
        var line = view.scimoz.lineFromPosition(view.scimoz.currentPos) + 1;
        var bp = ko.dbg.breakpoints.manager.getBreakpointAtFileAndLine(uri, line);
        if (bp == null) {
            ko.dbg.breakpoints.newBreakpoint();
        } else {
            ko.dbg.breakpoints.properties(bp);
        }
    } catch (ex) {
        ko.dbg.manager.log.exception(ex);
    }
}
DebuggerItemsController.prototype.is_cmd_dbgSpawnpointAddOrEdit_enabled = function () {
    return (ko.views.manager.currentView &&
            ko.views.manager.currentView.getAttribute('type') == 'editor' &&
            ko.views.manager.currentView.koDoc &&
            ko.views.manager.currentView.koDoc.file &&
            ko.views.manager.currentView.koDoc.languageObj.name == "Tcl");
}
DebuggerItemsController.prototype.do_cmd_dbgSpawnpointAddOrEdit = function() {
    try {
        var view = ko.views.manager.currentView;
        var uri = view.koDoc.file.URI;
        var line = view.scimoz.lineFromPosition(view.scimoz.currentPos) + 1;
        var sp = ko.dbg.breakpoints.manager.getSpawnpointAtFileAndLine(uri, line);
        if (sp == null) {
            ko.dbg.breakpoints.newSpawnpoint();
        } else {
            ko.dbg.breakpoints.properties(sp);
        }
    } catch (ex) {
        ko.dbg.manager.log.exception(ex);
    }
}
DebuggerItemsController.prototype .is_cmd_dbgBreakpointClearAllInURI_enabled = function () {
    return (ko.views.manager.currentView &&
            ko.views.manager.currentView.getAttribute('type') == 'editor' &&  // skip browser views
            ko.views.manager.currentView.koDoc &&
            ko.views.manager.currentView.koDoc.file);
            // XXX we need to allow breakpoints to be set in XML files
            //&& ko.views.manager.currentView.koDoc.languageObj.debuggable);
}
DebuggerItemsController.prototype.do_cmd_dbgBreakpointClearAllInURI = function() {
    var uri = ko.views.manager.currentView.koDoc.file.URI;
    ko.dbg.breakpoints.deleteAllInURI(uri);
}

// supported handles the greyed out of the menu item
DebuggerItemsController.prototype.is_cmd_debuggerListener_supported = function() {
    return true;
}
// enabled is the checkmark
DebuggerItemsController.prototype.is_cmd_debuggerListener_enabled = function() {
    // pref listenForDebugger
    return ko.dbg.listener.isListening();
}

// called on changing the state of the menu checkmark
DebuggerItemsController.prototype.do_cmd_debuggerListener = function() {
    // listenfordebugger pref is for starting listening when komodo starts
    if (ko.dbg.listener.isListening()) {
        ko.dbg.listener.stop();
        ko.dbg.listener.stopOnConnect = true;
    } else {
        try {
            ko.dbg.listener.start();
            ko.dbg.listener.stopOnConnect = false;
        } catch(ex) {
            var lastErrorSvc = Components.classes["@activestate.com/koLastErrorService;1"].
                getService(Components.interfaces.koILastErrorService);
            var errmsg = lastErrorSvc.getLastErrorMessage();
            var _bundle = (Components.classes["@mozilla.org/intl/stringbundle;1"]
                           .getService(Components.interfaces.nsIStringBundleService)
                           .createBundle("chrome://komodo/locale/debugger.properties"));
            ko.dialogs.alert(_bundle.formatStringFromName("debuggerFailedToStartListener.message",
                                                          [errmsg], 1));
        }
    }
}

// supported handles the greyed out of the menu item
DebuggerItemsController.prototype.is_cmd_dbgInspect_supported = function() {
    return ko.dbg.manager.currentSession && ko.dbg.manager.currentSession.dbg &&
            ko.dbg.manager.currentSession.dbg.supportsInteract;
}
DebuggerItemsController.prototype.is_cmd_dbgInspect_enabled = function () {
    return ko.dbg.manager.currentSession && ko.dbg.manager.currentSession.dbg.supportsInteract
              && ko.dbg.manager.currentSession.getState() == ko.dbg.manager.STATE_INTERACTIVE;
}
DebuggerItemsController.prototype.do_cmd_dbgInspect = function() {
    /* setup a new debugger tab, then step into the current buffer */
    try {
        if (ko.dbg.manager.currentSession.getState() != ko.dbg.manager.STATE_INTERACTIVE) {
            window.setTimeout('ko.dbg.manager.currentSession.enterInteractiveMode();',0);
        } else {
            window.setTimeout('ko.dbg.manager.currentSession.leaveInteractiveMode();',0);
        }
    } catch(e) {
        ko.dbg.manager.log.exception(e);
    }
}

DebuggerItemsController.prototype.is_cmd_dbgInteractiveClearBuffer_supported = function() {
    return ko.dbg.manager.currentSession && ko.dbg.manager.currentSession.dbg && ko.dbg.manager.currentSession.dbg.supportsInteract &&
            (ko.dbg.manager.currentSession.getState() == ko.dbg.manager.STATE_INTERACTIVE ||
            ko.dbg.manager.currentSession.getState() == ko.dbg.manager.STATE_BREAK);
}
DebuggerItemsController.prototype.is_cmd_dbgInteractiveClearBuffer_enabled = function () {
    return ko.dbg.manager.currentSession && ko.dbg.manager.currentSession.dbg.supportsInteract
              && ko.dbg.manager.currentSession.getState() == ko.dbg.manager.STATE_INTERACTIVE;
}
DebuggerItemsController.prototype.do_cmd_dbgInteractiveClearBuffer = function() {
    /* setup a new debugger tab, then step into the current buffer */
    try {
        ko.dbg.manager.currentSession.panel.debuggerPanel.terminalView.clearBuffer();
    } catch(e) {
        ko.dbg.manager.log.exception(e);
    }
}

// supported handles the greyed out of the menu item
DebuggerItemsController.prototype.is_cmd_dbgPrettyPrint_supported = function() {
    return ko.dbg.manager.currentSession && ko.dbg.manager.currentSession.supportsPrettyPrint;
}
DebuggerItemsController.prototype.is_cmd_dbgPrettyPrint_enabled = function() {
    return ko.dbg.manager.currentSession && ko.dbg.manager.currentSession.prettyPrint;
}
// called on changing the state of the menu checkmark
DebuggerItemsController.prototype.do_cmd_dbgPrettyPrint = function() {
    if (ko.dbg.manager.currentSession) {
        ko.dbg.manager.currentSession.prettyPrint = !ko.dbg.manager.currentSession.prettyPrint;
    }
}

DebuggerItemsController.prototype.is_cmd_dbgShowHiddenVars_supported = function() {
    return ko.dbg.manager.currentSession && ko.dbg.manager.currentSession.dbg && ko.dbg.manager.currentSession.dbg.supportsHiddenVars &&
            (ko.dbg.manager.currentSession.getState() == ko.dbg.manager.STATE_INTERACTIVE ||
            ko.dbg.manager.currentSession.getState() == ko.dbg.manager.STATE_BREAK);
}
DebuggerItemsController.prototype.is_cmd_dbgShowHiddenVars_enabled = function () {
    return ko.dbg.manager.currentSession && ko.dbg.manager.currentSession.showHiddenVars;
}
DebuggerItemsController.prototype.do_cmd_dbgShowHiddenVars = function() {
    /* setup a new debugger tab, then step into the current buffer */
    try {
        if (ko.dbg.manager.currentSession.showHiddenVars) {
            ko.dbg.manager.currentSession.showHiddenVars = false;
        } else {
            ko.dbg.manager.currentSession.showHiddenVars = true;
        }
        ko.dbg.manager.currentSession.panel.debuggerPanel.updateVariables();
    } catch(e) {
        ko.dbg.manager.log.exception(e);
    }
}

DebuggerItemsController.prototype._getSelectionCount= function(tree) {
    var selection = tree.view.selection;
    var count = 0, min = {}, max = {};
    for (var i = 0; i < selection.getRangeCount(); ++i) {
        selection.getRangeAt(i, min, max);
        count += (max.value - min.value) + 1;
    }
    return count;
};

DebuggerItemsController.prototype._get_debugger_panel = function () {
    if (!ko.dbg.tabManager) return null;
    var panel = ko.dbg.tabManager.getCurrentTab();
    return (!panel || !panel.debuggerPanel) ? null : panel;
}

// XXX these may need their own controller, as they should update when var tabs are switched
DebuggerItemsController.prototype.is_cmd_dbgAddVariable_enabled = function () {
    // only add to the watch panel
    var panel = this._get_debugger_panel();
    return panel &&
           panel.debuggerPanel.variablesTabpanels.selectedPanel ==
                panel.debuggerPanel.watchVariablesTab.panel;
}

DebuggerItemsController.prototype.do_cmd_dbgAddVariable = function() {
    try {
        var panel = this._get_debugger_panel();
        if (!panel) return;
        panel.debuggerPanel.watchVariablesTab.panel.firstChild.newVar();
    } catch (e) {
        ko.dbg.manager.log.exception(e);
    }
}

DebuggerItemsController.prototype.is_cmd_dbgEditVariable_enabled = function () {
    try {
        var panel = this._get_debugger_panel();
        if (!panel) return false;
        var tree = panel.debuggerPanel.variablesTabpanels.selectedPanel.firstChild.tree;
        return this._getSelectionCount(tree) == 1;
    } catch(e) {
        //ko.dbg.manager.log.exception(e);
    }
    return false;
}

DebuggerItemsController.prototype.do_cmd_dbgEditVariable = function() {
    var panel = this._get_debugger_panel();
    if (!panel) {
        ko.dbg.manager.log.error("do_cmd_dbgEditVariable: there is no current tab/panel");
        return;
    }
    panel.debuggerPanel.variablesTabpanels.selectedPanel.firstChild.editVar(null, 'value');
}

DebuggerItemsController.prototype.is_cmd_dbgWatchedVariable_enabled = function () {
    try {
        var panel = this._get_debugger_panel();
        if (!panel) return false;
        if (panel.debuggerPanel.variablesTabpanels.selectedPanel !=
            panel.debuggerPanel.watchVariablesTab.panel)
        {
            return false;
        }
        var tree = panel.debuggerPanel.watchVariablesTab.panel.firstChild.tree;
        return this._getSelectionCount(tree) == 1;
    } catch(e) {
        //ko.dbg.manager.log.exception(e);
    }
    return false;
}

DebuggerItemsController.prototype.do_cmd_dbgWatchedVariable = function() {
    var panel = this._get_debugger_panel();
    if (!panel) return;
    panel.debuggerPanel.variablesTabpanels.selectedPanel.firstChild.editVar(null, 'name');
}

DebuggerItemsController.prototype.is_cmd_dbgMakeWatchedVariable_enabled = function () {
    try {
        var panel = this._get_debugger_panel();
        if (!panel) return false;
        if (panel.debuggerPanel.variablesTabpanels.selectedPanel ==
            panel.debuggerPanel.watchVariablesTab.panel)
        {
            return false;
        }
        var tree = panel.debuggerPanel.variablesTabpanels.selectedPanel.firstChild.tree;
        return this._getSelectionCount(tree) > 0;
    } catch(e) {
        //ko.dbg.manager.log.exception(e);
    }
    return false;
}

DebuggerItemsController.prototype.do_cmd_dbgMakeWatchedVariable = function() {
    /* setup a new debugger tab, then step into the current buffer */
    try {
        var panel = this._get_debugger_panel();
        if (!panel) return;
        var names = panel.debuggerPanel.variablesTabpanels.selectedPanel.firstChild.getSelectedVariables();
        // make the watched tab selected
        panel.debuggerPanel.variablesTabs.selectedItem = panel.debuggerPanel.watchVariablesTab;
        for (var i=0; i < names.length; i++) {
            panel.debuggerPanel.watchVariablesTab.panel.firstChild.newVar(names[i]);
        }
        return;
    } catch(e) {
        //ko.dbg.manager.log.exception(e);
    }
}

DebuggerItemsController.prototype.is_cmd_dbgDeleteVariable_enabled = function () {
    // only delete from the watch panel
    try {
        var panel = this._get_debugger_panel();
        if (!panel) return false;
        if (panel.debuggerPanel.variablesTabpanels.selectedPanel !=
            panel.debuggerPanel.watchVariablesTab.panel)
        {
            return false;
        }
        var tree = panel.debuggerPanel.variablesTabpanels.selectedPanel.firstChild.tree;
        return this._getSelectionCount(tree) > 0;
    } catch(e) {
        ko.dbg.manager.log.exception(e);
    }
    return false;
}

DebuggerItemsController.prototype.do_cmd_dbgDeleteVariable = function() {
    var panel = this._get_debugger_panel();
    if (!panel) return;
    panel.debuggerPanel.watchVariablesTab.panel.firstChild.deleteVar();
}

DebuggerItemsController.prototype.is_cmd_dbgCopyVariableValues_enabled = function () {
    try {
        var panel = this._get_debugger_panel();
        if (!panel) return false;
        var tree = panel.debuggerPanel.variablesTabpanels.selectedPanel.firstChild.tree;
        return this._getSelectionCount(tree) >= 1;
    } catch(e) {
        //ko.dbg.manager.log.exception(e);
    }
    return false;
}

DebuggerItemsController.prototype.do_cmd_dbgCopyVariableValues = function() {
    var panel = this._get_debugger_panel();
    if (!panel) {
        ko.dbg.manager.log.error("do_cmd_dbgCopyVariableValues: there is no current tab/panel");
        return;
    }
    panel.debuggerPanel.variablesTabpanels.selectedPanel.firstChild.copyVariableValues();
}

DebuggerItemsController.prototype.is_cmd_dbgViewAsHex_enabled = function () {
    try {
        return !!this._get_debugger_panel();
    } catch(e) {
        ko.dbg.manager.log.exception(e);
    }
    return false;
}

DebuggerItemsController.prototype.do_cmd_dbgViewAsHex = function(event, commandElement) {
    if (!this._get_debugger_panel()) {
        return;
    }
    // Need to get the right context_viewAsHex menuitem, and set the other.
    var prefValue;
    if (event.target.hasAttribute("checked")) {
        commandElement.setAttribute("checked", "true");
        prefValue = true;
    } else {
        commandElement.removeAttribute("checked");
        prefValue = false;
    }
    ko.prefs.setBooleanPref("debuggerPreferHex", prefValue);
}

/**
 * Object to store whether a particular interactive shell item is enabled.
 * This gets updated asynchronously after updateInteractiveShellCommands().
 */
var _interactiveShellEnabled_data = {
    "Perl": true,
    "Python": true,
    "Python3": true,
    "Ruby": true,
    "Tcl": true,
};
var _defaultInteractiveShellLanguage = "";

function CheckInteractiveShellEnabled(lang, callback) {
    var appInfo = Components.classes["@activestate.com/koAppInfoEx?app="+lang+";1"].
                getService(Components.interfaces.koIAppInfoEx);
    var find_executables_callback = function(result, executables) {
        _interactiveShellEnabled_data[lang] = executables && executables.length >= 1;
        ko.commands.updateCommand("cmd_start"+lang+"InteractiveShell");
        callback(lang);
    }
    appInfo.FindExecutablesAsync(find_executables_callback);
}

DebuggerItemsController.prototype.updateInteractiveShellCommands = function () {
    // Update all languages, and then at the end of that, update the generic
    // commands.
    var _outstanding_langs = Object.keys(_interactiveShellEnabled_data);
    var callback = function(lang) {
        var idx = _outstanding_langs.indexOf(lang);
        if (idx >= 0) {
            _outstanding_langs.splice(idx, 1);
        }
        if (_outstanding_langs.length == 0) {
            var default_lang_callback = function(language) {
                _defaultInteractiveShellLanguage = language;
                ko.commands.updateCommand("cmd_toggleInteractiveShell");
                ko.commands.updateCommand("cmd_startInteractiveShell");
            }
            _defaultInteractiveShellLanguage = ko.dbg.getDefaultInteractiveShellLanguageAsync(default_lang_callback);
        }
    }
    for (var lang of Object.keys(_interactiveShellEnabled_data)) {
        CheckInteractiveShellEnabled(lang, callback);
    }
}

DebuggerItemsController.prototype.is_cmd_toggleInteractiveShell_enabled = function () {
    var language = _defaultInteractiveShellLanguage;
    var tabMgr = ko.dbg.tabManager.getInteractiveShell(language);
    if (!tabMgr) {
        return _interactiveShellEnabled_data[language];
    }
    return true;
}

DebuggerItemsController.prototype.do_cmd_toggleInteractiveShell = function() {
    ko.dbg.invocation.toggleInteractiveShell();
}


DebuggerItemsController.prototype.is_cmd_startInteractiveShell_enabled = function () {
    /* XXX we should do this, but it disables the button menu
    var language = ko.prefs.getStringPref('interactiveShellDefaultLanguage');
    switch (language) {
    case 'Python':
        return this.is_cmd_startPythonInteractiveShell_enabled();
    case 'Perl':
        return this.is_cmd_startPerlInteractiveShell_enabled();
    case 'Ruby':
        return this.is_cmd_startRubyInteractiveShell_enabled();
    case 'Tcl':
        return this.is_cmd_startTclInteractiveShell_enabled();
    }
    return false;
    */
    return true;
}
DebuggerItemsController.prototype.do_cmd_startInteractiveShell = function() {
    ko.dbg.invocation.interactiveShell();
}

// language specific commands for built in menu items
// These all use the global pref to find the interpreter,
// not a view- or project-specific pref
DebuggerItemsController.prototype.is_cmd_startPythonInteractiveShell_enabled = function () {
    return _interactiveShellEnabled_data['Python'];
}
DebuggerItemsController.prototype.do_cmd_startPythonInteractiveShell = function() {
    ko.dbg.invocation.interactiveShell('Python');
}

// language specific commands for built in menu items
DebuggerItemsController.prototype.is_cmd_startPython3InteractiveShell_enabled = function () {
    return _interactiveShellEnabled_data['Python3'];
}
DebuggerItemsController.prototype.do_cmd_startPython3InteractiveShell = function() {
    ko.dbg.invocation.interactiveShell('Python3');
}

// language specific commands for built in menu items
DebuggerItemsController.prototype.is_cmd_startPerlInteractiveShell_enabled = function () {
    return _interactiveShellEnabled_data['Perl'];
}
DebuggerItemsController.prototype.do_cmd_startPerlInteractiveShell = function() {
    ko.dbg.invocation.interactiveShell('Perl');
}

// language specific commands for built in menu items
DebuggerItemsController.prototype.is_cmd_startRubyInteractiveShell_enabled = function () {
    return _interactiveShellEnabled_data['Ruby'];
}
DebuggerItemsController.prototype.do_cmd_startRubyInteractiveShell = function() {
    ko.dbg.invocation.interactiveShell('Ruby');
}

// language specific commands for built in menu items
DebuggerItemsController.prototype.is_cmd_startTclInteractiveShell_enabled = function () {
    return _interactiveShellEnabled_data['Tcl'];
}
DebuggerItemsController.prototype.do_cmd_startTclInteractiveShell = function() {
    ko.dbg.invocation.interactiveShell('Tcl');
}

// language specific commands for built in menu items
/* JS Shell
DebuggerItemsController.prototype.is_cmd_startJavaScriptInteractiveShell_enabled = function () {
    return true;
}
DebuggerItemsController.prototype.do_cmd_startJavaScriptInteractiveShell = function() {
    ko.dbg.invocation.interactiveShell('JavaScript');
}
*/


this.controller = new DebuggerItemsController();

}).apply(ko.dbg);
