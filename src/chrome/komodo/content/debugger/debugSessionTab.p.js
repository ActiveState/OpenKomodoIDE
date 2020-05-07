/* Copyright (c) 2003-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* Komodo's Debug Session tab handling code.
 *
 * Here is the deal: When you start a debug session in Komodo you get a new
 * Debug Session Tab in the bottom pane. This is it here. The Komodo code that
 * starts a debug session calls into here to get a new tab. A handler XPCOM
 * component (DebugSessionTabManager) is created for the tab and Komodo's
 * debugging works with the debug tab through its API.
 *
 * Usage:
 *      this.manager.getTabMgr(
 *          function onSuccessCallback(tabMgr) {
 *              tabMgr.configure(session);
 *              tabMgr.sessionInit();
 *              tabMgr.sessionStart();
 *              tabMgr.sessionEnd();
 *              ...use the koIDebugSessionTabManager interface...
 *          },
 *          function onErrorCallback() {
 *              // Failed to create a tab and manager. The user was notified via
 *              // an alert. The debug session should be aborted.
 *          }
 *      );
 *
 */

//---- globals


if (typeof(ko) == 'undefined') {
    var ko = {};
}
if (typeof(ko.dbg) == 'undefined') {
    ko.dbg = {};
}

(function() { /* ko.dbg */

const MAX_DEBUG_SESSION_TABS = 100;
var log = ko.logging.getLogger("debugSessionTab");
//log.setLevel(ko.logging.LOG_DEBUG);
const NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
const DEBUG_TAB_URL = "chrome://komodo/content/debugger/debuggerPanel.xul";
const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

// Cache of tab managers.
// - Maps a tab number/id to a DebugSessionTabManager() instance.
// - If managers[<tab-number>] does not exist then no such tab/tabpanel has
//   been created.
// - If managers[<tab-number>]==null then there is a tab/tabpanel left over
//   from a previous debug session, it is just collapsed.
// - If managers[<tab-number>]==<DebugSessionTabManager-instance> then
//   there is an existing debug session in that tab/tabpanel.
//   XXX Note that this debug session may no longer be active in which
//       case we *may* want to re-use this tab. Hmmm. How about adding a
//       "pin" icon to an inactive tab to ensure it doesn't get re-used.
//       Could do the same for the Find Results windows.


//---- the DebugSessionTab component

function DebugSessionTabManager(id) {
    this._outputTmpFile = null;

    // Number identifying this DebugSessionTabManager from others.
    this.id = id;
    this._idprefix = "debugsession"+this.id;

    this.name = null;
    this.contextNames = null;
    // Cache of useful widget references in this tab.
    this.tabPanel = null; // set in outputTabManager.getTabMgr

    this._closing = false;
    this.started = false;

    // the rest needs the panel to finish loading before we can use it; do
    // that in .initialize()
}

DebugSessionTabManager.prototype.QueryInterface =
    XPCOMUtils.generateQI([Ci.koIDebugSessionTabManager]);

Object.defineProperty(DebugSessionTabManager.prototype, "_log", {
    get: function() ({
        debug: (function(str) log.debug("DebugSessionTabManager["+this.id+"]: " + str)).bind(this),
        exception: (function(str) log.exception("DebugSessionTabManager["+this.id+"]: " + str)).bind(this),
    })
});

DebugSessionTabManager.prototype.initialize = function DebugSessionTabManager_initialize(id)
{
    this._log.debug("initialize(" + id + ")");
    try {
        this.tabPanel.contentDocument
            .addEventListener("ko-widget-move-completed", (function(event) {
                // the widget moved, update the references
                this.tabPanel = event.target.defaultView.frameElement;
            }).bind(this), false);
        this.debuggerPanel = this.tabPanel.contentDocument.getElementById("debuggerPanel");
        this.debuggerPanel.onLoad(this, true);

        this._watched = {};
        this._varState = {};
        this.currentStackFrameIndex = -1;
        this.resetTabName();
        this.clear();
        this.isInteractive = false;
        this.basedir = null;

        /**
         * {boolean} Acts as a latch for when the session is about to go from
         *      running to stopped (possibly by evaluating interactive mode).
         *      This is used for variable change highlighting.
         */
        this._sessionEnteringBreak = false;
    } catch(ex) {
        log.exception(ex);
        Components.utils.reportError(ex);
    }
}

DebugSessionTabManager.prototype.initVarTabs = function DebugSessionTabManager_initVarTabs(/* XXX arguments here? */)
{
    this._log.debug("initVarTabs(" + Array.slice(arguments) + ")");
    try {
        this.debuggerPanel.watchVariablesTree.onLoad(new variableTreeView(this, 'Watched'));

        // get the context names now
        if (!this.contextNames) {
            this.contextNames = this.session.dbg.contextNames();
        }

        // XXX for debugging only
        log.debug("  number of contexts: "+this.contextNames.length);
        if (this.contextNames.length < 0) return;

        // set up the trees
        // we do not include the watched vars tab here, as this stuff
        // needs to be dynamic
        this._varTabs = {};
        for (var i = 0; i < this.contextNames.length; i++) {
            log.debug("  context: "+this.contextNames[i].name);
            var contextNameField = this.contextNames[i];
            var contextNameValue = contextNameField.name;
            var contextTab = this.debuggerPanel.addVariablePanel(contextNameField);
            var treeView = new variableTreeView(this, contextNameValue);
            contextTab[1].onLoad(treeView);
            this._varTabs[contextNameValue] = contextTab;
            treeView.setupInitialSortDirection(this.session.dbg.languageName,
                                               contextTab[1]);
        }

    } catch(ex) {
        log.exception(ex);
    }
}

DebugSessionTabManager.prototype.configure = function(session)
{
    this._log.debug("configure(" + session + ")");
    try {
        if (typeof(session) == 'undefined')
            session = null;
        this.session = session;
    } catch(ex) {
        log.exception(ex);
    }
}

DebugSessionTabManager.prototype.show = function()
{
    this._log.debug("show()");
    try {
        ko.widgets.modifyWidget(this._idprefix, {visible: true});
    } catch(ex) {
        log.exception(ex);
    }
}

DebugSessionTabManager.prototype.focus = function()
{
    log.deprecated("DebugSessionTabManager.focus() no longer does anything");
}

DebugSessionTabManager.prototype.clear = function DebugSessionTabManager_clear()
{
    this._log.debug("clear()");
    try {
        this.debuggerPanel.terminalView.clear();
    } catch(ex) {
        log.exception(ex);
    }
}


DebugSessionTabManager.prototype.canClose = function()
{
    this._log.debug("canClose()");
    try {
        // Warn if this tab is still active, offer to stop it if so.
        if (!this.session) return true;

        var sessionType = 'debugging session';
        var doNotAskPref = 'debugger_confirm_close';
        if (this.session.isInteractive) {
            sessionType = 'interactive shell';
            doNotAskPref = 'interactiveshell_confirm_close';
        }

        var answer = ko.dialogs.customButtons(
            "This "+sessionType+" is still in progress. The session "+
            "must be stopped before the tab can be closed.",
            ["&Kill Session and Close Tab", "Cancel"],
            "Cancel",  // default button
            null, // text
            null, // title
            doNotAskPref);
        if (answer == "Kill Session and Close Tab") {
            return true;
        } else { // answer == "Cancel"
            return false;
        }
    } catch(ex) {
        log.exception(ex);
    }
    return false;
}

DebugSessionTabManager.prototype.forceClose = function DebugSessionTabManager_forceClose()
{
    this._log.debug("forceClose()");
    try {
        this._closing = true; // disable UI updates
        this.debuggerPanel.releaseTerminal();
        if (this.session) {
            this.session.terminate();
        }
        this.removeHTMLTempFile();
    } catch(ex) {
        log.exception(ex);
    }
}

DebugSessionTabManager.prototype.resetTabName = function()
{
    this._log.debug("resetTabName()");
    var name = 'Output';
    if (this.session) {
        if (this.session.invoke_type == ko.dbg.invocation.INVOKE_INTERACTIVE)
            name = this.session.dbg.languageName+' Shell';
        else if (this.session.invoke_type == ko.dbg.invocation.INVOKE_RUN)
            name = "Run Output";
        else if (this.session.invoke_type == ko.dbg.invocation.INVOKE_DEBUG)
            name = "Debug Output";
    }
    this.tabPanel.setAttribute('label', name);
}

/* sessionInit starts prior to having a debugger connection,
   sessionStart occurs after a having a debugger connection.
   This is important becuase prior to connection we need to have
   some things in place, such as the terminalHandler calling
   startSession to configure io.  At this point the session.dbg
   variable is NOT available.  Since some items may need this for
   initialization (such as the variable viewers), we now have
   these two functions.  */
DebugSessionTabManager.prototype.sessionInit = function DebugSessionTabManager_sessionInit(isInteractive)
{
    this._log.debug("sessionInit(" + isInteractive + ")");
    try {
        this.debuggerPanel.terminalView.clear();
        this.debuggerPanel.terminalView.startSession();
        this.isInteractive = isInteractive;
        this.debuggerPanel.setInteractive(isInteractive);
        this.name = null;
        this.resetTabName();
        this.sessionStartTime = new Date().valueOf();
    } catch(ex) {
        log.exception(ex);
    }
}

DebugSessionTabManager.prototype.sessionStart = function()
{
    this._log.debug("sessionStart()");
    try {
        // startup items that require access to session.dbg
        this.initVarTabs();
        this.resetTabName();
        this.loadHTMLView();
        this.basedir = null;
        
        if (this.session && this.session.filename) {
            var osPathSvc = Components.classes["@activestate.com/koOsPath;1"].
                  getService(Components.interfaces.koIOsPath);
            this.basedir = osPathSvc.dirname(this.session.filename);
        }
        this.sessionStartTime = new Date().valueOf();
    } catch(ex) {
        log.exception(ex);
    }
}

DebugSessionTabManager.prototype.sessionEnd = function DebugSessionTabManager_sessionEnd()
{
    this._log.debug("sessionEnd()");
    try {
        this.debuggerPanel.terminalView.endSession();
        this.clearThreadMenu();
        this.clearCallStackList();
        this.clearVariables();
        this.debuggerPanel.removeVariablePanels();
        this.session = null;
        ko.dbg.tabManager.releaseTabMgr(this);
        this.currentStackFrameIndex = -1;
        this.updateWatchedVars();
        if (this.isInteractive) {
            if (ko.prefs.getBooleanPref("interactiveShellCloseOnEnd")) {
                let doCloseTab = true;
                const minSessionTime = 500; //  500 msec
                if (this.sessionStartTime) {
                    let sessionEndTime = new Date().valueOf();
                    if (sessionEndTime - this.sessionStartTime < minSessionTime) {
                        // dump("Not closing the tab due to errors starting it up\n");
                        doCloseTab = false;
                    }
                    delete this.sessionStartTime;
                }
                if (doCloseTab) {
                    // Close interactive session tabs when done
                    ko.dbg.tabManager.closeTab(this);
                }
                // focus in the editor.
                if (ko.views.manager.currentView) {
                    ko.views.manager.currentView.setFocus();
                }
            }
        }
        this.isInteractive = false;
        this.contextNames = null;
    } catch(ex) {
        log.exception(ex);
    }
}

/**
 * Called when the state of the session changes (e.g. run->break, or entering
 * interactive mode).
 * 
 * @param   {Number} state The new session state, as a koIDBGPSession::STATUS_*
 *              constant.
 */
DebugSessionTabManager.prototype.sessionStateChange = function DebugSessionTabManager_sessionStateChange(state)
{
    this._log.debug("sessionStateChange(" + ko.dbg.tabManager.getStatusAsString(state) + ")");
    switch (state) {
        case ko.dbg.manager.STATE_BREAK:
        case ko.dbg.manager.STATE_INTERACTIVE:
            this._sessionEnteringBreak = true;
            break;
        default:
            this._sessionEnteringBreak = false;
    }
};

DebugSessionTabManager.prototype.clearVariables = function() {
    this._log.debug("clearVariables()");
    try {
        if (this._varTabs) {
            for (var context in this._varTabs) {
                var varTreeView = this._varTabs[context][1].view;
                varTreeView.savePreferences();
                varTreeView.clearList();
            }
        }
    } catch(ex) {
        log.exception(ex);
    }
    delete this._varTabs;
}

/**
 * Update the variables view associated with this debug session
 * 
 * @see variableTreeView.updateList()
 */
DebugSessionTabManager.prototype.updateVariables = function DSTM_updateVariables() {
    this._log.debug("updateVariables()");
    try {
        if (!this.session) return;
        var state = this.session.getState();
        if (state != ko.dbg.manager.STATE_BREAK && state != ko.dbg.manager.STATE_INTERACTIVE) {
            return;
        }
        // update information displayed about variables defined in the
        // current stack frame

        // only update variables in the currently visible tab
        var tab = this.debuggerPanel.variablesTabs.selectedItem;
        var currentContext = tab.getAttribute('label');

        if (!(currentContext in this._varTabs)) {
            this.updateWatchedVars();
            return;
        }
        var varTab = this._varTabs[currentContext][1];
        // get the current selection so we can reset that
        // after updating the variable list
        var ci = varTab.view.mSelection.currentIndex;
        
        // get the current context names
        if (!this.contextNames) {
            this.contextNames = this.session.dbg.contextNames();
        }

        // find the visible context to update
        var context = this.contextNames.filter(function(cx) cx.name == currentContext).pop();

        if (context) {
            var tmp = new Object();
            this.session.dbg.contextGet(context.id,
                                        this.currentStackFrameIndex,
                                        tmp, new Object());
            var debugProps = tmp.value;
            varTab.view.updateList(debugProps, this._sessionEnteringBreak);
            this._sessionEnteringBreak = false;
        } else {
            varTab.view.clearList();
        }

        varTab.view.selectIndex(ci);
    } catch(ex) {
        log.exception(ex);
    }
    return;
}

DebugSessionTabManager.prototype.updateWatchedVars = function DebugSessionTabManager_updateWatchedVars() {
    this._log.debug("updateWatchedVars()");
    try {
        if (!this.debuggerPanel.watchVariablesTree.view) return;
        // clear the expression variables
        var vars = [];
        var expression;
        // get them again
        if (this.session) {
            var curr_dbg_session = this.session.dbg;
            var languageName = curr_dbg_session.languageName;
            for (expression in this._watched) {
                log.debug('+++ showing expression ['+expression+']\n');
                var p = curr_dbg_session.propertyGetEx(0, this.currentStackFrameIndex,
                                                       expression, 0, 0, 0, "");
                if (ko.dbg.is_exception_property(p, languageName)) {
                    var p_alt = curr_dbg_session.evalString(expression);
                    if (!ko.dbg.is_exception_property(p_alt, languageName)) {
                        p = p_alt;
                    }
                }
                this._watched[expression] = p;
                vars.push(p);
            }
        } else {
            for (expression in this._watched) {
                log.debug('--- showing expression ['+expression+']\n');
                this._watched[expression] = null;
                vars.push(expression);
            }
        }
        // display them
        this.debuggerPanel.watchVariablesTree.view.updateList(vars, this._sessionEnteringBreak);
        this._sessionEnteringBreak = false;
    } catch(ex) {
        log.exception(ex);
    }
}

DebugSessionTabManager.prototype.addWatchedVar = function(expression, value) {
    this._log.debug("addWatchedVar(" + expression + ", " + value + ")");
    try {
        this._watched[expression] = null;
        if (this.session) {
            if (typeof(value) != 'undefined') {
                this.session.dbg.propertySet(expression, value);
            }
        }
        this.updateWatchedVars();
    } catch(ex) {
        log.exception(ex);
    }
}


DebugSessionTabManager.prototype.removeWatchedVarName = function(expression)
{
    this._log.debug("removeWatchedVarName(" + expression + ")");
    try {
        if (typeof(this._watched[expression]) != 'undefined') {
            delete this._watched[expression];
            return true;
        }
    } catch(ex) {
        log.exception(ex);
    }
    return false;
}

DebugSessionTabManager.prototype.haveWatchedVar = function(expression)
{
    this._log.debug("haveWatchedVar(" + expression + ")");
    try {
        var haveit = (typeof(this._watched[expression]) != 'undefined')
    } catch(ex) {
        log.exception(ex);
    }
    return haveit;
}

/**
 * take the text from the debugger output scintilla, put it into the
 * iframe, and switch
 */
DebugSessionTabManager.prototype.removeHTMLTempFile = function()
{
    this._log.debug("removeHTMLTempFile()");
    try {
        if (this._outputTmpName) {
            var tmpFileSvc = Components.classes["@activestate.com/koFileService;1"]
                             .getService(Components.interfaces.koIFileService)
            tmpFileSvc.deleteTempFile(this._outputTmpName, true);
            this._outputTmpName = null;
        }
    } catch(ex) {
        log.exception(ex);
    }
}

DebugSessionTabManager.prototype.loadStartMessage = function(invocation)
{
    if ("done" in this.loadStartMessage) return;
    this.loadStartMessage.done = true;
    if (invocation.name.indexOf("HTML") === 0)
    {
        // Todo: stash this somewhere less awkward
        var text = "-------------- ATTENTION --------------\n";
        text += "Chrome debugging will fail if Chrome was already started without the proper parameters. ";
        text += "Additionally due to limitations in Chrome remote debugging breakpoints inside the 'onload' do not work. ";
        text += "This is a limitation in Chrome, not Komodo.\n";
        text += "---------------------------------------\n\n";
        this.debuggerPanel.terminalHandler.proxyAddText(text.length, text, '<stdout>');
    }
}

DebugSessionTabManager.prototype.loadHTMLView = function()
{
    this._log.debug("loadHTMLView()");
    try {
        this.removeHTMLTempFile();
        var doc;
        var osPathSvc = Components.classes["@activestate.com/koOsPath;1"].
                  getService(Components.interfaces.koIOsPath);
        var docSvc = Components.classes['@activestate.com/koDocumentService;1']
                    .getService(Components.interfaces.koIDocumentService);

        // get the text from scintilla, stuff it into the iframe, and switch the deck
        var text = this.debuggerPanel.terminalView.scimoz.text;
        if (text) {
            var tmpFileSvc = Components.classes["@activestate.com/koFileService;1"]
                             .getService(Components.interfaces.koIFileService)

            if (this.basedir) {
                this._outputTmpName = tmpFileSvc.makeTempNameInDir(this.basedir,".html");
            } else {
                this._outputTmpName = tmpFileSvc.makeTempName(".html");
            }

            doc = docSvc.createDocumentFromURI(this._outputTmpName);
            doc.setBufferAndEncoding(text, this.debuggerPanel.terminalView.scintilla.encoding);
            doc.save(true);
            this.debuggerPanel.browser.initWithDocument(doc, false);
        } else {
            this.debuggerPanel.browser.open('about:blank', false);
        }
    } catch(ex) {
        log.exception(ex);
    }
}

DebugSessionTabManager.prototype.updateHTMLView = function dbgSessionTabMgr_updateHTMLView()
{
    this._log.debug("updateHTMLView()");
    try {
        if (this._outputTmpName) {
            this.removeHTMLTempFile();
        }
        this.loadHTMLView();
    } catch(ex) {
        log.exception(ex);
    }
}

/*
  called when the state of the session changes
*/
DebugSessionTabManager.prototype.updateUI = function()
{
    this._log.debug("updateUI()");
    if (this._closing) {
        this._log.debug("updateUI: ignoring on doomed tab manager");
        return;
    }
    try {
        var state = ko.dbg.manager.STATE_STOPPED;
        if (this.session) {
            state = this.session.getState();
            if (this.session.dbg) {
                this.tabPanel.setAttribute('tab_dbg_language', this.session.dbg.languageName);
            }
        }
        this._log.debug("updateUI(): state=" + state + "(" + ko.dbg.tabManager.getStatusAsString(state) + ")" +
                        " session=" + this.session);
        this.tabPanel.setAttribute('tab_dbg_status', ko.dbg.tabManager.getStatusAsString(state));

        if (this.session && ko.dbg.manager.currentSession === this.session) {
            this.tabPanel.setAttribute("tab_current-session", true);
        } else {
            this.tabPanel.removeAttribute("tab_current-session");
        }

        // always update our thread and call stack.  We'll only refill the callstack
        // if the current session is in break mode.  There is the potential that a thread
        // will change a value on us, but not much we can do about that without a lot
        // more overhead
        if (!this.isInteractive)
            this.buildThreadMenu();

        this.clearCallStackList();

        switch(state) {
        case ko.dbg.manager.STATE_STOPPED:
            this.debuggerPanel.infoText.value = "Debugging session has ended.";
            break;

        case ko.dbg.manager.STATE_STARTING:
            this.debuggerPanel.infoText.value = "Debugger is starting...";
            break;

        case ko.dbg.manager.STATE_RUNNING:
            this.debuggerPanel.infoText.value = "Debugger is running...";
            break;

        case ko.dbg.manager.STATE_INTERACTIVE:
            if (this.isInteractive) {
                if (!this.debuggerPanel.getElement('vbox','varViewers').getAttribute('collapsed'))
                    this.updateVariables();
                break;
            }
        case ko.dbg.manager.STATE_BREAK:
            this.buildCallStackList();

            var frame, haveFrame = false;
            if (this.stackFrames) {
                frame = this.stackFrames[0];
                if (frame)
                    haveFrame = true;
            }
            if (haveFrame)
                this.debuggerPanel.infoText.value =  "Break at " +
                                ko.uriparse.displayPath(frame.filename)
                                + ", line " + frame.lineno + ".";
            else
                this.debuggerPanel.infoText.value =  "";
            break;

        case ko.dbg.manager.STATE_STOPPING:
            this.debuggerPanel.infoText.value = "Debugger is stopping...";
            break;

        } // end switch(new_state)
    } catch(ex) {
        log.exception(ex);
    }
}

DebugSessionTabManager.prototype.clearThreadMenu = function DebugSessionTabManager_clearThreadMenu()
{
    this._log.debug("clearThreadMenu()");
    try {
        /* clear the thread list */
        this.threads = null;
        while (this.debuggerPanel.threadsMenuPopup.childNodes.length > 0) {
            this.debuggerPanel.threadsMenuPopup.removeChild(this.debuggerPanel.threadsMenuPopup.lastChild);
        }
        this.debuggerPanel.threadsBox.setAttribute('collapsed',true);
        this.debuggerPanel.threadsMenuList.value = null;
    } catch(ex) {
        log.exception(ex);
    }
}

/* reset the threads list */
DebugSessionTabManager.prototype.buildThreadMenu = function()
{
    this._log.debug("buildThreadMenu()");
    try {
        this.clearThreadMenu();
        if (!this.session || !this.session.application)
            return;

        var tmp = new Object();
        this.session.application.getSessionList(tmp, new Object());
        this.threads = tmp.value;
        if (this.threads.length < 2)
            return;

        this.debuggerPanel.threadsBox.removeAttribute('collapsed');
        var item, thread;
        for (var i = 0; i < this.threads.length; ++i) {
            thread = this.threads[i];
            item = document.createElementNS(NS_XUL, 'menuitem');
            item.setAttribute('class','menuitem-iconic dbg_status_icon');
            item.setAttribute('label', thread.threadId);
            item.setAttribute('dbg_status', ko.dbg.tabManager.getStatusAsString(thread.status));
            item.setAttribute('dbg_language', thread.languageName);
            item.setAttribute('oncommand','this.value.selectSessionThread('+i+');');
            item.setAttribute('flex','1');
            item.value = this;
            this.debuggerPanel.threadsMenuPopup.appendChild(item);
            if (thread == this.session.dbg) {
                this.debuggerPanel.threadsMenuList.selectedIndex = i;
            }
        }
        if (this.debuggerPanel.threadsMenuList.selectedIndex < 0)
            this.debuggerPanel.threadsMenuList.selectedIndex = 0;
        this.currentThreadIndex = this.debuggerPanel.threadsMenuList.selectedIndex;
    } catch(ex) {
        log.exception(ex);
    }
}

DebugSessionTabManager.prototype.selectSessionThread = function(index)
{
    this._log.debug("selectSessionThread(" + index + ")");
    /* this is to allow the thread dropdown menu to release, since selecting
        a different thread can result in rebuilding the menu also */
    this._timeout = new ko.objectTimer(this,this._selectSessionThread,[index]);
    this._timeout.startTimeout(1);
}

DebugSessionTabManager.prototype._selectSessionThread = function(index)
{
    this._log.debug("_selectSessionThread(" + index + ")");
    try {
        if (index == this.currentThreadIndex) {
            log.debug("  already selected: "+index);
            return;
        }
        this.currentThreadIndex = index;
        this.session.application.currentSession = this.threads[index];
        if (this.session.getState() == ko.dbg.manager.STATE_RUNNING) {
            // cannot do stack for running threads
            this.clearCallStackList();
            return;
        }
        // reset the UI for the new thread selection
        this.session.updateUI();
    } catch(ex) {
        log.exception(ex);
    }
}

DebugSessionTabManager.prototype.clearCallStackList = function DebugSessionTabManager_clearCallStackList()
{
    this._log.debug("clearCallStackList()");
    try {
        /* clear the thread list */
        this.stackFrames = null;

        while (this.debuggerPanel.callstackListbox.childNodes.length > 1) {
            this.debuggerPanel.callstackListbox.removeChild(this.debuggerPanel.callstackListbox.childNodes[1]);
        }
    } catch(ex) {
        log.exception(ex);
    }
}

/**
 * Build and populate the call stack UI.
 *
 * Note: clearCallStackList should be called prior to this method.
 */
DebugSessionTabManager.prototype.buildCallStackList = function()
{
    this._log.debug("buildCallStackList()");
    try {
        var state = this.session.getState();
        if (state != ko.dbg.manager.STATE_BREAK && state != ko.dbg.manager.STATE_INTERACTIVE) {
            return;
        }
        var tmp = new Object();
        this.session.dbg.stackFramesGet(tmp, new Object());
        this.stackFrames = tmp.value;
        if (this.stackFrames.length < 1) {
            if (state == ko.dbg.manager.STATE_INTERACTIVE) {
                this.tabPanel.setAttribute('label', this.session.dbg.languageName+' Shell');
            }
            return;
        }
        if (state == ko.dbg.manager.STATE_INTERACTIVE) {
            this.tabPanel.setAttribute('label', this.session.dbg.languageName+' Shell');
        } else {
            this.name = ko.uriparse.baseName(this.stackFrames[0].filename);
            this.tabPanel.setAttribute('label', 'Debug: '+this.name);
        }

        var item, frame;
        for (var i = 0; i < this.stackFrames.length; ++i) {
            frame = this.stackFrames[i];
            var frameName = ko.uriparse.baseName(frame.filename) +
                        ', line ' + frame.lineno +
                        ', in ' + frame.where;
            item = this.debuggerPanel.callstackListbox.appendItem(frameName, this)
            item.setAttribute('style', 'margin: 0px; border:none');
            item.setAttribute('class','listitem-iconic');
            item.value = this;
        }
        this.debuggerPanel.callstackListbox.selectedIndex = 0;
        this.currentStackFrameIndex = 0;
        this.doStackFrame();

        this.debuggerPanel.callstackListbox.selectedItem.setAttribute('currentview','true');
    } catch(ex) {
        log.exception(ex);
    }
}

DebugSessionTabManager.prototype.selectStackFrame = function(index)
{
    this._log.debug("selectStackFrame(" + index + ")");
    try {
        if (index == this.currentStackFrameIndex) {
            log.debug("  already selected: "+index);
            return;
        }
        if (this.session.getState() == ko.dbg.manager.STATE_RUNNING) {
            // cannot do stack for running threads
            return;
        }
        var old = this.debuggerPanel.callstackListbox.getItemAtIndex(this.currentStackFrameIndex);
        old.removeAttribute('currentview');

        this.currentStackFrameIndex = index;
        this.doStackFrame();

        this.debuggerPanel.callstackListbox.selectedItem.setAttribute('currentview','true');
    } catch(ex) {
        log.exception(ex);
    }
}

DebugSessionTabManager.prototype.doStackFrame = function DSTM_doStackFrame()
{
    this._log.debug("doStackFrame(" + this.currentStackFrameIndex + ")");
    try {
        // rebuild the variable lists
        this.updateVariables();
        this.session.showStackPosition(this.stackFrames[this.currentStackFrameIndex],
                                       this.currentStackFrameIndex);
    } catch(ex) {
        log.exception(ex);
    }
}

/* these functions provide state for variable viewers between stack
   changes and sessions in the same tab.  Currently they only store
   whether the variable is opened or not in the viewers. */
DebugSessionTabManager.prototype.getVarState = function(expression)
{
    this._log.debug("getVarState(" + expression + ")");
    try {
        if (typeof(this._varState[expression]) != 'undefined')
            return this._varState[expression];
    } catch(ex) {
        log.exception(ex);
    }
    return 0;
}

DebugSessionTabManager.prototype.contractVar = function(expression)
{
    this._log.debug("contractVar(" + expression + ")");
    try {
        this._varState[expression] = 0
    } catch(ex) {
        log.exception(ex);
    }
}

DebugSessionTabManager.prototype.expandVar = function(expression)
{
    this._log.debug("expandVar(" + expression + ")");
    try {
        this._varState[expression] = 1
    } catch(ex) {
        log.exception(ex);
    }
}

// Method template:
//DebugSessionTabManager.prototype.foobar = function()
//{
//    this._log.debug("foobar()");
//    try {
//    } catch(ex) {
//        log.exception(ex);
//    }
//}


//---- module (i.e. not tab-specific) interface routines

/**
 * The per-komodo-window instance of outputTabManager
 */
this.tabManager = null;

this.tabInit =
function DebugSessionTab_OnLoad()
{
    log.debug("DebugSessionTab_OnLoad()");
    try {
        ko.dbg.tabManager = new outputTabManager();
    } catch(ex) {
        log.exception(ex);
    }
}

function outputTabManager() {
}
outputTabManager.prototype = {
    tabManagers: {},

    // Return the current debug state in string format.
    getStatusAsString: function(state)
    {
        switch(state) {
        case ko.dbg.manager.STATE_STARTING:
            return "starting";
        case ko.dbg.manager.STATE_RUNNING:
            return "running";
        case ko.dbg.manager.STATE_BREAK:
            return "break";
        case ko.dbg.manager.STATE_INTERACTIVE:
            return "interactive";
        case ko.dbg.manager.STATE_STOPPING:
            return "stopping";
        case ko.dbg.manager.STATE_STOPPED:
            return "stopped";
        }
        return '';
    },

    // Uncollapsed an existing debug session tab and tabpanel for use.
    //
    //  "id" is the unique id (it is a number) for the tab.
    //
    uncollapse: function(id)
    {
        log.debug("outputTabManager.uncollapse("+id+")");
        try {
            let widgetId = "debugsession" + id;
            ko.widgets.modifyWidget(widgetId, {visible: true});
        } catch(ex) {
            log.exception(ex);
        }
    },

    /**
     * Create a new debug session tab
     * @param id {Number} The unique id for the tab
     * @param callback {Function} A callback to be invoked after the tab
     *        has been created; it takes a single argument, the created
     *        widget.
     */
    createTab: function outputTabManager_createTab(id, callback)
    {
        let idstr = "debugsession" + id; // see DebugSessionTabManager._idprefix
        log.debug("outputTabManager.createTab(" + idstr + ")");

        try {
            /**
             * Listener for when a tab is selected
             */
            let tabSelectListener = (function ko_dbg_createTab_tabSelectListener(event) {
                this.tabSwitch(id);
            }).bind(this);

            ko.widgets.registerWidget(idstr, "Output", DEBUG_TAB_URL, {
                    defaultPane: "workspace_bottom_area",
                    persist: false,
                    show: true,
                    iconURL: 'chrome://fugue/skin/icons/game.png',
                });
            ko.widgets.getWidgetAsync(idstr, (function(widget) {
                    widget.contentDocument.addEventListener("ko-widget-showing",
                                                            tabSelectListener, false);
                    widget.setAttribute('dbg_session', id);
                    widget.setAttribute('tab_dbg_status',
                                        this.getStatusAsString(ko.dbg.manager.STATE_STOPPED));
                    widget.setAttribute('tab_class','dbg_status_icon');
                    
                    var panel = widget.parentNode;
                    var tab = panel.tab;
                    
                    tab.addEventListener("close-tab", function(e) {
                        this.closeTab(widget.contentWindow);
                        e.preventDefault();
                        return false;
                    }.bind(this));
                    
                    callback(widget);
                }).bind(this));

        } catch(ex) {
            log.exception(ex);
        }
    },

    /* Give me the next tabMgr created for a particular language (in interactive
      mode) that is still active (start looking after the currently selected
      tab if the tab group has focus).*/
    getInteractiveShell: function(language)
    {
        try {
            for (var id = 0; id < MAX_DEBUG_SESSION_TABS; ++id) {
                // Skip over free tabs, tabs w/ no sessions, or non-interactive
                // tabs.
                if (typeof(this.tabManagers[id]) == "undefined" ||
                    this.tabManagers[id].session == null ||
                    ! this.tabManagers[id].isInteractive ||
                    this.tabManagers[id].session.language != language) {
                    continue;
                }
                return this.tabManagers[id];
            }
        } catch (e) {
            log.exception(e);
        }
        return null;
    },

    /**
     * Get a usable (not busy, cleared) Debug Session Tab manager
     * @param onSuccessCallback [optional] callback on success; takes one
     *      parameter, the tab manager.
     * @param onErrorCallback [optional]
     */
    getTabMgr: function outputTabManager_getTabMgr(onSuccessCallback, onErrorCallback)
    {
        log.debug("outputTabManager.getTabMgr()");
        if (!onSuccessCallback) onSuccessCallback = function() {};
        if (!onErrorCallback) onErrorCallback = function() {};

        try {
            // Find a free tab id.
            for (var id = 0; id < MAX_DEBUG_SESSION_TABS; ++id) {
                if (typeof(this.tabManagers[id]) == "undefined") {
                    // This is a free tab id, we will dynamically create the
                    // tab and tabpanel and use that.
                    break;
                } else if (!("session" in this.tabManagers[id])) {
                    // This tab is still half-way through initializing. Don't
                    // reuse this tab, that's a bad idea
                    // -- no op --
                } else if (this.tabManagers[id].session === null) {
                    // Manager slot is null, there is a collapsed debug session
                    // tab and tabpanel that can be used.
                    this.uncollapse(id);
                    onSuccessCallback(this.tabManagers[id]);
                    return;
                } else {
                    // Manager slot is non-null (presumably a
                    // DebugSessionTabManager): leave it alone.
                }
            }
            if (id >= MAX_DEBUG_SESSION_TABS) {
                ko.dialogs.alert("Too many debug session tabs are in use. You must "+
                             "close one or more debug session tabs and restart "+
                             "this debug session.");
                onErrorCallback(null);
                return;
            }

            // If we get here, we are in the free tab id case above
            this.createTab(id, (function(widget) {
                // Create a manager for this tab and return it.
                var manager = new DebugSessionTabManager(id);
                this.tabManagers[id] = manager;
                manager.tabPanel = widget;
                manager.initialize(id);
                onSuccessCallback(manager);
            }).bind(this));

        } catch(ex) {
            log.exception(ex);
            onErrorCallback(ex);
        }
    },

    /* we just want to create a new tab, but not attach a
       manager to it */
    /**
     * Create a new tab, without attaching a manager to it
     * @param tabMgr [optional] the tab manager
     * @param onSuccessCallback [optional] the callback on success
     * @param onErrorCallback [optional]
     */
    showNewTab: function outputTabManager_showNewTab(tabMgr, onSuccessCallback, onErrorCallback)
    {
        log.debug("outputTabManager.showNewTab()");
        if (!onSuccessCallback) onSuccessCallback = function() {};
        if (!onErrorCallback) onErrorCallback = function() {};

        try {
            if (!tabMgr) {
                this.getTabMgr(onTabMgrReady.bind(this),
                               onErrorCallback);
            } else {
                onTabMgrReady.call(this, tabMgr);
            }
        } catch(ex) {
            log.exception(ex);
            onErrorCallback(ex);
        }

        function onTabMgrReady(tabMgr) {
            try {
                tabMgr.configure();
                tabMgr.show();
                ko.dbg.manager.setCurrentSession(null);
                this.releaseTabMgr(tabMgr);
            } catch (ex) {
                log.exception(ex);
                onErrorCallback(ex);
                return;
            }
            onSuccessCallback();
        }
    },

    releaseTabMgr: function(tabMgr)
    {
        // nothing to do now
    },

    /**
     * Return the active DebugSessionTabManager
     * 
     * @returns {DebugSessionTabManager} The active tab
     */
    getCurrentTab: function()
    {
        //log.debug("outputTabManager.getCurrentTab()");
        try {
            let session = ko.dbg.manager.currentSession;
            return session ? session.panel : null;
        } catch(ex) {
            log.exception(ex);
        }
        return null;
    },

    /**
     * Close a given tab
     * @param tabMgr {DebugSessionTabManager or Window} The tab to close, or
     *               its associated content window (for the widget).
     */
    closeTab: function outputTabManager_closeTab(tabMgr) {
        if (!tabMgr) {
            log.exception("closeTab called without a tabMgr!");
            throw "closeTab called without a tabMgr";
        }
        if (tabMgr.frameElement && tabMgr.frameElement.hasAttribute("dbg_session")) {
            let id = tabMgr.frameElement.getAttribute("dbg_session");
            tabMgr = this.tabManagers[id];
        }
        try {
            let id = tabMgr.id;

            // XXX we could call a canclose function here, and validate
            // that the user wants to shut down the debug session,
            // for now, the easy way out.
            if (!tabMgr.canClose()) {
                return;
            }
            let widget = tabMgr.tabPanel;

            delete this.tabManagers[id];
            tabMgr.forceClose();
            ko.widgets.unregisterWidget(widget);

            // Find a session to switch to so we don't break our UI
            // Doesn't really matter which one
            for each (let tabMgr in this.tabManagers) {
                if (!("session" in tabMgr)) {
                    // not completely initialized yet
                    continue;
                }
                if (!tabMgr.session) {
                    // no attached session?
                    continue;
                }
                ko.widgets.modifyWidget(tabMgr.tabPanel, {visible: true});
                this.tabSwitch(tabMgr.id);
                break;
            }
        } catch(ex) {
            log.exception(ex);
        }
        
    },

    closeCurrent: function()
    {
        log.debug("outputTabManager.closeCurrent()");
        try {
            var tab = this.getCurrentTab();
            if (tab) {
                this.closeTab(tab);
            }
        } catch(ex) {
            log.exception(ex);
        }
    },

    /**
     * Switch to the given debug session
     * @param debugSessionId {Number} The debug session to switch to
     */
    tabSwitch: function(debugSessionId)
    {
        log.debug("outputTabManager.tabSwitch(" + debugSessionId + ")");
        try {
            // if this is not a managed tab (eg. command output)
            // then it will not have a tabid attribute
            if ((!debugSessionId && debugSessionId !== 0) || !(debugSessionId in this.tabManagers)) {
                log.debug("Invalid debug session id " + debugSessionId);
                return;
            }
            let tabMgr = this.tabManagers[debugSessionId];
            for each (var manager in this.tabManagers) {
                if (manager != tabMgr) {
                    manager.tabPanel.removeAttribute("tab_current-session");
                }
            }
            tabMgr.tabPanel.setAttribute("tab_current-session", true);
            ko.dbg.manager.setCurrentSession(tabMgr.session);
            log.debug("Session is now " + ko.dbg.manager.currentSession.panel.id +
                      " (expecting " + tabMgr.id + ")");
        } catch(ex) {
            log.exception(ex);
        }
    }

}

}).apply(ko.dbg);
