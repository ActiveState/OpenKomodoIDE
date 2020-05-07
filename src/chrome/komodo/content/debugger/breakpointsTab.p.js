/* Copyright (c) 2003-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* Komodo's "Breakpoints" tab (in the bottom pane).
 *
 * This tab works with the koIDBGPBreakpointManager service to provide a UI
 * to all relevant breakpoints.
 *
 * Dev Notes:
 * Each ko.dbg.bpManager object registers itself with the
 * koDBGPBreakpointManager service, and gets a breakpoints treeview
 * object associated with itself.
 */

//---- globals

if (typeof(ko.dbg) == 'undefined') {
    ko.dbg = {};
}

(function() { /* ko.dbg */

var log = ko.logging.getLogger('breakpointsTab');
//log.setLevel(ko.logging.LOG_DEBUG);

this.bpManager = null;

this.bpInit =
function BreakpointsTabManager_Initialize() {
    // If have not yet initialized the tab, then do so.
    try {
        this.bpManager = new BreakpointsTabManager();
        ko.main.addWillCloseHandler(this.bpManager.finalize, this.bpManager);
    } catch(ex) {
        log.exception(ex);
    }
}



//---- Breakpoints Tab Manager
// One instance per window of this class is created. This implements the
// koIBreakpointsTabManager interface for use by PyXPCOM components.

function BreakpointsTabManager() {
    try {
        this._widgets = new Object();
        this._widgets.tabpanel = window.frameElement;
        this._widgets.tree = document.getElementById("breakpoints-tree");
        this._widgets.treeBody = document.getElementById("breakpoints-body");
        this._widgets.treeColumns = {
            "state": document.getElementById("breakpoints-type-and-state")
        }
        this._widgets.buttons = {
            "delete": document.getElementById("breakpoints-delete-button"),
            "delete-all": document.getElementById("breakpoints-delete-all-button"),
            "toggle-state": document.getElementById("breakpoints-toggle-state-button"),
            "go-to-source-code": document.getElementById("breakpoints-go-to-source-code-button"),
            "properties": document.getElementById("breakpoints-properties-button")
        }

        // hook up command observers up to the parent window
        window.frameElement.hookupObservers("cmdset_breakPointsTab");

        this.breakpointSvc = Components.classes['@activestate.com/koDBGPBreakpointManager;1']
                            .getService(Components.interfaces.koIDBGPBreakpointManager);
        this.breakpointSvc.addTabMgr(this);

        // Bind the nsITreeView instance to the <tree>.
        var boxObject = this._widgets.tree.treeBoxObject
                .QueryInterface(Components.interfaces.nsITreeBoxObject);
        if (boxObject.view == null) {
            //TODO: is showing this truly necessary..., if so, have to move
            //      out to when it is first shown
            // We are in a collapsed state -- we need to force the tree to be
            // visible before we can assign the view to it.
            log.debug("manager "+this.id+" initialize(): forcing it to show");
            this.show();
        }
        this._treeView = boxObject.view = this.breakpointSvc.treeViewFromTabMgr(this);
        this.controller = new BreakpointManagerItemsController(this._treeView);

        // Fake an "onselect" so the toolbar gets initialized appropriately.
        this.onSelect();
    } catch(ex) {
        log.exception(ex);
    }
}
BreakpointsTabManager.prototype.constructor = BreakpointsTabManager;


BreakpointsTabManager.prototype.QueryInterface = function (iid) {
    if (!iid.equals(Components.interfaces.koIBreakpointsTabManager) &&
        !iid.equals(Components.interfaces.nsISupports)) {
        throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    return this;
}

// Number of breakpoints changed: disable/enable the toolbar buttons
// as appropriate.
BreakpointsTabManager.prototype.numBreakpointsChanged = function()
{
    log.debug("BreakpointsTabManager.numBreakpointsChanged()");
    try {
        // "delete-all" button: enabled when there are 1 or more breakpoints
        // "toggle-state" button: enabled when there are 1 or more breakpoints
        var names = ["delete-all", "toggle-state"];
        var i;
        if (this._treeView.rowCount == 0) {
            for (i = 0; i < names.length; ++i) {
                this._widgets.buttons[names[i]].setAttribute("disabled", "true");
            }
        } else {
            for (i = 0; i < names.length; ++i) {
                this._widgets.buttons[names[i]].removeAttribute("disabled");
            }
        }
    } catch(ex) {
        log.exception(ex);
    }
}


// Called when the "Breakpoints" tab is being given the focus.
BreakpointsTabManager.prototype.focus = function()
{
    log.debug("BreakpointsTabManager.focus()");
    try {
        // Put focus on the tree body.
        this._widgets.treeBody.focus();
    } catch(ex) {
        log.exception(ex);
    }
}


BreakpointsTabManager.prototype.show = function()
{
    log.debug("BreakpointsTabManager.show()");
    try {
        // If necessary, open output pane in komodo.xul
        ko.uilayout.ensureOutputPaneShown(window);

        // switch to proper tab
        var panel = window.frameElement;
        panel.tabbox.selectedTab = panel.tab;

        // (controversial?) give the find results tab the focus
        //XXX This does not work because the input buffer is passing focus back
        //    to the editor.
        var findResultsWidget = document.getElementById(this._idprefix+"-body");
        findResultsWidget.focus();
    } catch(ex) {
        log.exception(ex);
    }
}


BreakpointsTabManager.prototype.onKeyPress = function(event)
{
    log.debug("BreakpointsTabManager.onKeyPress(event)");
    //ko.logging.dumpEvent(event);
    try {
        var isKeyModified = (event.altKey || event.ctrlKey
                             || event.shiftKey || event.metaKey);
        if (event.keyCode == 13 /* <Enter> */) {
            // As in Explorer, any key modifier should result in opening
            // the properties page.
            if (isKeyModified) {
                this.breakpointProperties();
            } else {
                this.goToSourceCode();
            }
            event.cancelBubble = true;
            return false;
        } else if (event.charCode == 32 && !isKeyModified /* space */) {
            var row = this._treeView.selection.currentIndex;
            if (row != -1) {
                var boxObject = this._widgets.tree.treeBoxObject
                        .QueryInterface(Components.interfaces.nsITreeBoxObject);
                var col = boxObject.columns.getNamedColumn("breakpoints-type-and-state");
                this._treeView.cycleCell(row, col);
            }
            event.cancelBubble = true;
            return false;
        } else if (event.keyCode == 46 /* <Del> */) {
            this.deleteBreakpoint();
            event.cancelBubble = true;
            return false;
        }
        //XXX For many keys we get this warning:
        //   WARN: commands: Command cmd_lineNext has no controller.
        // cancel the event bubbling for keys that will be commonly used
        // in this pane so we dont get the warnings.
        if (event.keyCode == event.DOM_VK_UP ||
            event.keyCode == event.DOM_VK_DOWN ||
            event.keyCode == event.DOM_VK_LEFT ||
            event.keyCode == event.DOM_VK_RIGHT) {
            event.cancelBubble = true;
        }
        return true;
    } catch (ex) {
        log.exception(ex);
    }
    return false;
}


BreakpointsTabManager.prototype.onClick = function(event)
{
    log.debug("BreakpointsTabManager.onClick(event)");
    try {
        // c.f. mozilla/mailnews/base/resources/content/threadPane.js
        var t = event.originalTarget;

        // unmodified left single-click on a column: sort by that column
        if (event.detail == 1 && event.button == 0 &&
            t.localName == "treecol" &&
            event.shiftKey == false && event.ctrlKey == false &&
            event.altKey == false && event.metaKey == false) {
            this.breakpointSvc.sort(t.id);
            this._updateSortIndicators(t.id);
        }

        // unmodified left double-click in the tree body
        else if (event.detail == 2 && event.button == 0 &&
                 t.localName == "treechildren" &&
                 event.shiftKey == false && event.ctrlKey == false &&
                 event.altKey == false && event.metaKey == false) {
            this.goToSourceCode();
        }
    } catch (ex) {
        log.exception(ex);
    }
}


// Breakpoints tree selection change: disable/enable the toolbar buttons
// as appropriate.
BreakpointsTabManager.prototype.onSelect = function()
{
    log.debug("BreakpointsTabManager.onSelect()");
    try {
        window.updateCommands('breakpoint_selection_changed');
    } catch(ex) {
        log.exception(ex);
    }
}

BreakpointsTabManager.prototype.__defineGetter__( "currentBreakpoint",
    function() { return this.breakpointSvc.currentBreakpointFromTabMgr(this); });

BreakpointsTabManager.prototype.__defineGetter__( "currentBreakpointGuid",
    function() { return this.breakpointSvc.currentBreakpointGuidFromTabMgr(this); });

BreakpointsTabManager.prototype.__defineGetter__( "currentBreakpointName",
    function() { return this.breakpointSvc.currentBreakpointNameFromTabMgr(this); });

BreakpointsTabManager.prototype._dbgp_uri_re = new RegExp('^dbgp://([-0-9a-fA-F]{36})/');
// Jump to the location of the currently selected breakpoint.
BreakpointsTabManager.prototype.goToSourceCode = function()
{
    log.debug("BreakpointsTabManager.goToSourceCode()");
    try {
        var row = this._treeView.selection.currentIndex;
        if (row == -1) {
            return; // no current selection: abort
        }

        // Open and/or switch to the appropriate file.
        var bp = this.currentBreakpoint;
        var uri = bp.filename;

        var isRemoteURI = uri.indexOf("dbgp:")==0;
        if (ko.prefs.getBooleanPref('debuggerFindLocalFile') && isRemoteURI) {
            if (!('_dbgp_url_stripper' in this)) {
                this._dbgp_url_stripper = new RegExp('^dbgp://(?:[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})?/');
            }
            var l_uri = uri.replace(this._dbgp_url_stripper, '');
            var fileSvc = Components.classes["@activestate.com/koFileService;1"].
                            getService();
            var file = fileSvc.getFileFromURI(l_uri);
            if (file.exists) {
                uri = l_uri;
                isRemoteURI = false;
            }
        }
        if (isRemoteURI) {
            // Check to see if we can work with this UUID
            var v = ko.views.manager.getViewForURI(uri);
            if (v) {
                v.makeCurrent();
                return;
            } else if (this._dbgp_uri_re.test(uri) && ko.dbg.listener.getApplicationFromUUID(RegExp.$1)) {
                // keep going
            } else {
                ko.dialogs.alert("Unable to open remote debugger file.");
                return;
            }
        }

        try {
            //XXX Would like to have an optional argument to ko.open.URI()
            //    to NOT offer to create a file that is not found. In this
            //    use-case this should just report an error.
            var line = bp.lineno;
            if (line >= 1) {
                ko.views.manager.doFileOpenAtLineAsync(uri, line);
            } else {
                ko.views.manager.doFileOpenAsync(uri);
            }
        } catch(ex) {
            var displayPath = ko.uriparse.displayPath(uri);
            var msg = "Error opening '"+displayPath+"'.";
            ko.dialogs.alert(msg);
            log.exception(ex, msg);
            return;
        }
    } catch (ex) {
        log.exception(ex);
    }
}


BreakpointsTabManager.prototype.newBreakpoint = function()
{
    log.debug("BreakpointsTabManager.newBreakpoint()");
    try {
        ko.dbg.breakpoints.newBreakpoint();
    } catch (ex) {
        log.exception(ex);
    }
}


BreakpointsTabManager.prototype.newSpawnpoint = function()
{
    log.debug("BreakpointsTabManager.newSpawnpoint()");
    try {
        ko.dbg.breakpoints.newSpawnpoint();
    } catch (ex) {
        log.exception(ex);
    }
}


BreakpointsTabManager.prototype.deleteBreakpoint = function()
{
    log.debug("BreakpointsTabManager.deleteBreakpoint()");
    try {
        var row = this._treeView.selection.currentIndex;
        if (row == -1) {
            return; // no current selection: abort
        }

        // Ensure the user wants to delete this breakpoint.
        var question = "Are you sure you want to delete the '"+
                       this.currentBreakpointName + "' breakpoint?";
        var answer = ko.dialogs.okCancel(question, "OK", null,
                                     "Confirm Breakpoint Delete",
                                     "confirm_delete_breakpoint");
        if (answer == "OK") {
            this.breakpointSvc.removeBreakpoint(this.currentBreakpointGuid);

            // Select a reasonable row after deletion.
            if (row > this._treeView.rowCount-1) {
                row = this._treeView.rowCount-1;
            }
            if (row >= 0) {
                this._treeView.selection.select(row);
            } else {
                this._treeView.selection.clearSelection();
            }
        }
    } catch (ex) {
        log.exception(ex);
    }
}


BreakpointsTabManager.prototype.deleteAllBreakpoints = function()
{
    log.debug("BreakpointsTabManager.deleteAllBreakpoints()");
    try {
        var didit = ko.dbg.breakpoints.deleteAll();
        if (didit) {
            this._treeView.selection.clearSelection();
        }
    } catch (ex) {
        log.exception(ex);
    }
}

BreakpointsTabManager.prototype.toggleBreakpointState = function()
{
    log.debug("BreakpointsTabManager.toggleBreakpointState()");
    try {
        this.breakpointSvc.toggleBreakpointState(this.currentBreakpointGuid);
    } catch (ex) {
        log.exception(ex);
    }
}

BreakpointsTabManager.prototype.toggleAllBreakpointStates = function()
{
    log.debug("BreakpointsTabManager.toggleAllBreakpointStates()");
    try {
        this.breakpointSvc.toggleAllBreakpointStates();
    } catch (ex) {
        log.exception(ex);
    }
}


BreakpointsTabManager.prototype.breakpointProperties = function()
{
    log.debug("BreakpointsTabManager.breakpointProperties()");
    try {
        var row = this._treeView.selection.currentIndex;
        if (row == -1) {
            return; // no current selection: abort
        }

        ko.dbg.breakpoints.properties(this.currentBreakpoint);
    } catch (ex) {
        log.exception(ex);
    }
}


BreakpointsTabManager.prototype._updateSortIndicators = function(sortId)
{
    return; //XXX disable this for now (need to solve so other problems first)
    var sortedColumn = null;

    // set the sort indicator on the column we are sorted by
    if (sortId) {
        sortedColumn = document.getElementById(sortId);
        if (sortedColumn) {
            var sortDirection = sortedColumn.getAttribute("sortDirection");
            if (sortDirection && sortDirection == "ascending") {
                sortedColumn.setAttribute("sortDirection", "descending");
            } else {
                sortedColumn.setAttribute("sortDirection", "ascending");
            }
        }
    }

    // remove the sort indicator from all the columns
    // except the one we are sorted by
    var currCol = document.getElementById("breakpoints-tree").firstChild.firstChild;
    while (currCol) {
        while (currCol && currCol.localName != "treecol") {
            currCol = currCol.nextSibling;
        }
        if (currCol && (currCol != sortedColumn)) {
            currCol.removeAttribute("sortDirection");
        }
        if (currCol) {
            currCol = currCol.nextSibling;
        }
    }
}

BreakpointsTabManager.prototype.finalize = function finalize()
{
    this.breakpointSvc.removeTabMgr(this);
    if (this.controller)
        this.controller.destroy();
};

function BreakpointManagerItemsController(mgrView) {
    window.controllers.appendController(this);
    parent.controllers.appendController(this);
    this._treeView = mgrView;
}

// The following two lines ensure proper inheritance (see Flanagan, p. 144).
BreakpointManagerItemsController.prototype = new xtk.Controller();
BreakpointManagerItemsController.prototype.constructor =BreakpointManagerItemsController;

BreakpointManagerItemsController.prototype.destroy = function() {
    window.controllers.removeController(this);
    parent.controllers.removeController(this);
}

BreakpointManagerItemsController.prototype.is_cmd_breakpoint_add_enabled = function () {
    return true;
}

BreakpointManagerItemsController.prototype.do_cmd_breakpoint_add = function() {
    return ko.dbg.bpManager.newBreakpoint();
}

BreakpointManagerItemsController.prototype.is_cmd_spawnpoint_add_enabled = function () {
    return true;
}

BreakpointManagerItemsController.prototype.do_cmd_spawnpoint_add = function() {
    return ko.dbg.bpManager.newSpawnpoint();
}

BreakpointManagerItemsController.prototype.is_cmd_breakpoint_goto_enabled = function () {
    return this._treeView && this._treeView.selection.currentIndex >= 0;
}

BreakpointManagerItemsController.prototype.do_cmd_breakpoint_goto = function() {
    ko.dbg.bpManager.goToSourceCode();
    return true;
}

BreakpointManagerItemsController.prototype.is_cmd_breakpoint_toggle_enabled = function () {
    return this._treeView && this._treeView.selection.currentIndex >= 0;
}

BreakpointManagerItemsController.prototype.do_cmd_breakpoint_toggle = function() {
    ko.dbg.bpManager.toggleBreakpointState();
    return true;
}

BreakpointManagerItemsController.prototype.is_cmd_breakpoint_toggle_all_enabled = function () {
    return this._treeView && this._treeView.rowCount > 0;
}

BreakpointManagerItemsController.prototype.do_cmd_breakpoint_toggle_all = function() {
    ko.dbg.bpManager.toggleAllBreakpointStates();
    return true;
}

BreakpointManagerItemsController.prototype.is_cmd_breakpoint_delete_enabled = function () {
    return this._treeView && this._treeView.selection.currentIndex >= 0;
}

BreakpointManagerItemsController.prototype.do_cmd_breakpoint_delete = function() {
    ko.dbg.bpManager.deleteBreakpoint();
    return true;
}

BreakpointManagerItemsController.prototype.is_cmd_breakpoint_delete_all_enabled = function () {
    return this._treeView && this._treeView.rowCount > 0;
}

BreakpointManagerItemsController.prototype.do_cmd_breakpoint_delete_all = function() {
    ko.dbg.bpManager.deleteAllBreakpoints();
    return true;
}

BreakpointManagerItemsController.prototype.is_cmd_breakpoint_properties_enabled = function () {
    return this._treeView && this._treeView.selection.currentIndex >= 0;
}

BreakpointManagerItemsController.prototype.do_cmd_breakpoint_properties = function() {
    window.setTimeout(function() {
        ko.dbg.bpManager.breakpointProperties();
    }, 1);
    return true;
}


//---- interface routines

// Called when the Breakpoints tab is being selected/made visible.
//
// The first time this is called, the tab initializes itself.
this.tabSelect = 
function BreakpointsTab_Select()
{
    log.debug("BreakpointsTab_Select()");
    try {
        ko.dbg.bpManager.focus();
    } catch(ex) {
        log.exception(ex);
    }
}


}).apply(ko.dbg);
