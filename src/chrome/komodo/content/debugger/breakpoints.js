/* Copyright (c) 2003-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* Breakpoints handling in Komodo.
 *
 * This module includes utilities for JavaScript-side stuff to interact
 * with Komodo's breakpoints system. The "Breakpoints" tab is handled in
 * "breakpointsTab.js". The actually main manager of the breakpoints is
 * the PyXPCOM component koIDBGPBreakpointManager.
 */
// TODO:
// - if breakpoint tab is visible then select make the added one visible
// - toggle breakpoint state button in "Breakpoints" toolbar
//
// Feature Requests:
// - Could add tooltips on hover over breakpoints in the gutter, showing the
//   name as per the breakpoints tab "Name" column

//---- globals


if (typeof(ko) == 'undefined') {
    var ko = {};
}
if (typeof(ko.dbg) == 'undefined') {
    ko.dbg = {};
}
ko.dbg.breakpoints = {};

(function() { /* ko.dbg.breakpoints */

var log = ko.logging.getLogger('breakpoints');
//log.setLevel(ko.logging.LOG_DEBUG);

this.manager = null;

//---- public interface
this.init =
function Breakpoints_Initialize()
{
    log.debug("Breakpoints_Initialize()");
    try {
        this.manager = Components.classes["@activestate.com/koDBGPBreakpointManager;1"].
                             getService(Components.interfaces.koIDBGPBreakpointManager);
        this.manager.addTopView(ko.views.manager.topView);

        ko.main.addWillCloseHandler(Breakpoints_Finalize);
    } catch (ex) {
        log.exception(ex);
    }
}

function Breakpoints_Finalize()
{
    log.debug("Breakpoints_Finalize()");
    try {
        ko.dbg.breakpoints.manager.removeTopView(ko.views.manager.topView);
    } catch (ex) {
        log.exception(ex);
    }
}


// Confirm action with user and then delete all breakpoints. Returns
// true if all breakpoints were deleted, false if the user cancelled.
this.deleteAll = 
function Breakpoints_DeleteAllBreakpoints()
{
    log.debug("Breakpoints_DeleteAllBreakpoints()");
    try {
        // Ensure the user wants to do this.
        var question = "Are you sure you want to delete all breakpoints "+
                       "in all files?";
        var answer = ko.dialogs.okCancel(question, "OK", null,
                                     "Confirm Breakpoint Delete");
        if (answer == "OK") {
            ko.dbg.breakpoints.manager.removeAllBreakpoints();
            return true;
        }
    } catch (ex) {
        log.exception(ex);
    }
    return false;
}

// Confirm action with user and then delete all breakpoints for the given
// URI. Returns true if all breakpoints were deleted, false if the user
// cancelled.
this.deleteAllInURI = 
function Breakpoints_DeleteAllBreakpointsInURI(uri)
{
    log.debug("Breakpoints_DeleteAllBreakpointsInURI(uri='"+
                         uri+"')");
    try {
        // Ensure the user wants to do this.
        var baseName = ko.uriparse.baseName(uri);
        var question = "Are you sure you want to delete all breakpoints "+
                       "in "+baseName+"?";
        var answer = ko.dialogs.okCancel(question, "OK", null,
                                     "Confirm Breakpoint Delete");
        if (answer == "OK") {
            ko.dbg.breakpoints.manager.removeAllBreakpointsInURI(uri);
            return true;
        }
    } catch (ex) {
        log.exception(ex);
    }
    return false;
}

// Toggle the state of the breakpoint at the current view and line.
//
//  "view" is the koIView being clicked in. This is only expected to be
//      called on 'editor' views (and possibly 'buffer' views).
//  "line" is a 1-based line number.
//
// The toggle states are (as discussed with Hemang from Cisco online):
//
//        Start State                     Result
//        -----------                     ------
//        no current bp or sp             add a new bp
//        enabled bp                      disable it
//        disabled bp                     delete it
//        enabled sp                      disable it
//        disabled sp                     delete it
//        both sp and bp on same line     operate on breakpoint first
//
this.toggleState =
function Breakpoints_ToggleBreakpointState(view, line)
{
    log.debug("Breakpoints_ToggleBreakpointState(view='"+
                         view.koDoc.baseName+"', line="+line+")");
    try {
        if (view.koDoc.isUntitled) {
            var msg =  "Cannot add breakpoints to an unsaved buffer. You must "
                        +"first save '"+view.koDoc.baseName+"' to a file.";
            require("notify/notify").interact(msg, "debugger", {priority: "warning"});
            return;
        }
        var bpMgr = ko.dbg.breakpoints.manager;
        // XXX - Should check to see if view.koDoc and view.koDoc.file
        //       exist? As this gets called from views-buffer which may not
        //       have a document.
        var uri = view.koDoc.file.URI;
        var bp = bpMgr.getBreakpointAtFileAndLine(uri, line);
        if (bp == null) { // Perhaps there is a spawnpoint at this line.
            bp = bpMgr.getSpawnpointAtFileAndLine(uri, line);
        }
        var name = view.koDoc.baseName+", line "+line;
        if (bp == null) {
            // Create a line breakpoint here.
            if (this._symbolicLinkCheck(view, line)) {
                return;
            }
            bpMgr.addBreakpointLine(view.koDoc.languageObj.name,
                                    uri,
                                    line,
                                    "enabled",
                                    0, // temporary
                                    0, null); // hitValue, hitCondition
        } else if (bp.state == "enabled") {
            // Disable the breakpoint.
            bpMgr.toggleBreakpointState(bp.getGuid());
        } else {
            // Remove the breakpoint.
            //XXX Note: we are ignoring state=="deleted". When is that
            //    possible?
            bpMgr.removeBreakpoint(bp.getGuid());
        }
    } catch (ex) {
        log.exception(ex);
    }
}

this.addOnLine =
function Breakpoints_AddBreakpointState(view, line)
{
    log.debug("Breakpoints_AddBreakpointState(view='"+
                         view.koDoc.baseName+"', line="+line+")");
    try {
        if (view.koDoc.isUntitled) {
            var msg =  "Cannot add breakpoints to an unsaved buffer. You must "
                        +"first save '"+view.koDoc.baseName+"' to a file.";
            require("notify/notify").interact(msg, "debugger", {priority: "warning"});
            return;
        }
        var bpMgr = ko.dbg.breakpoints.manager;
        // XXX - Should check to see if view.koDoc and view.koDoc.file
        //       exist? As this gets called from views-buffer which may not
        //       have a document.
        var uri = view.koDoc.file.URI;
        var bp = bpMgr.getBreakpointAtFileAndLine(uri, line);
        if (bp == null) { // Perhaps there is a spawnpoint at this line.
            bp = bpMgr.getSpawnpointAtFileAndLine(uri, line);
        }
        var name = view.koDoc.baseName+", line "+line;
        if (bp == null) {
            // Create a line breakpoint here.
            if (this._symbolicLinkCheck(view, line)) {
                return;
            }
            bpMgr.addBreakpointLine(view.koDoc.languageObj.name,
                                    uri,
                                    line,
                                    "enabled",
                                    0, // temporary
                                    0, null); // hitValue, hitCondition
        } else if (bp.state != "enabled") {
            // Disable the breakpoint.
            bpMgr.toggleBreakpointState(bp.getGuid());
        } 
    } catch (ex) {
        log.exception(ex);
    }
}


var bundle = (Components.classes["@mozilla.org/intl/stringbundle;1"]
              .getService(Components.interfaces.nsIStringBundleService)
              .createBundle("chrome://komodo/locale/debugger.properties"));

/* This routine returns false if debugging should proceed as is,
 * true if it should stop,
 * and another view object to use when possible.
 */
this._symbolicLinkCheck = function(view, lineno) {
    var koFile = view.koDoc.file;
    if (koFile.isRemoteFile || koFile.scheme != "file") {
        return false;
    }
    var languageName = view.koDoc.languageObj.name;
    if (languageName == "Ruby" || languageName == "Perl") {
        // No problems with these languages
        return false;
    }
    var uri = koFile.URI;
    var path = koFile.path;
    var realpath = (Components.classes["@activestate.com/koOsPath;1"].
                    getService(Components.interfaces.koIOsPath).realpath(path));
    if (path == realpath) {
        return false;
    }
    var prompt = bundle.GetStringFromName("symlinkBreakpointSet.prompt");
    const yesPosn = 0;
    const noPosn = 1;
    const loadPosn = 2;
    var buttons = [bundle.GetStringFromName("yes.button"),
                   bundle.GetStringFromName("no.button"),
                   bundle.GetStringFromName("loadTargetFile.button")];
    var response = buttons[noPosn];
    var text = bundle.formatStringFromName("symlinkReason.template",
                                           [languageName], 1);
    var title = bundle.GetStringFromName("symlinkWarning.prompt");
    var res = ko.dialogs.customButtons(prompt, buttons, response, text, title);
    if (res == buttons[yesPosn]) {
        return false;
    } else if (!res || res == buttons[noPosn]) {
        return true;
    } else if (res == buttons[loadPosn]) {
        var koFileTarget = Components.classes["@activestate.com/koFileEx;1"].
                            createInstance(Components.interfaces.koIFileEx);
        koFileTarget.path = realpath;
        var vTarget = ko.views.manager.getViewForURI(koFileTarget.URI, "editor");
        if (vTarget) {
            vTarget.makeCurrent();
            return true;
        }
        // Trying to close the old view in a callback often crashes on linux
        ko.views.manager.
            doFileOpenAtLineAsync(koFileTarget.URI, lineno, "editor", null, -1);
    }
    return true;
};

// Create a new breakpoint, edit it in the properties dialog, add it to
// the breakpoint manager and return it. This returns null if the user
// cancelled the dialog.
this.newBreakpoint = 
function Breakpoints_NewBreakpoint()
{
    log.debug("Breakpoints_NewBreakpoint()");
    try {
        var bp = Components.classes["@activestate.com/koDBGPBreakpoint;1"]
                 .createInstance(Components.interfaces.koIDBGPBreakpoint);

        bp.type = "line";
        var view = ko.views.manager.currentView;
        if (view && view.getAttribute("type") == "editor" &&
            view.koDoc && view.koDoc.languageObj) {
            //XXX Would like to make this block dependent on the current language
            //    being of the set of those for which breakpoints make sense.
            //    However, Komodo's current lang registry (koILanguage*) has
            //    no such mechanism. It looks like there almost was a
            //    koILanguage.debuggable but not because breakpoints should be
            //    settable in XML files for XSLT debugging. The language system
            //    should grow an attribute saying for which debugging language
            //    engine names setting a breakpoint in the filetype of that
            //    language makes sense.
            bp.language = view.koDoc.languageObj.name;
            bp.filename = view.koDoc.file.URI;
            bp.lineno = view.scimoz.lineFromPosition(view.scimoz.currentPos) + 1;
            if (this._symbolicLinkCheck(view, bp.lineno)) {
                return;
            }
        }

        var obj = new Object();
        obj.breakpoint = bp;
        window.openDialog("chrome://komodo/content/debugger/breakpointProperties.xul",
                          "_blank",
                          "chrome,modal,titlebar,resizable=yes",
                          obj);
        if (obj.response == "OK") {
            ko.dbg.breakpoints.manager.addBreakpoint(obj.breakpoint);
        }
    } catch (ex) {
        log.exception(ex);
    }
}


// Create a new spawnpoint, edit it in the properties dialog, add it to
// the breakpoint manager and return it. This returns null if the user
// cancelled the dialog.
this.newSpawnpoint = 
function Breakpoints_NewSpawnpoint()
{
    log.debug("Breakpoints_NewSpawnpoint()");
    try {
        var sp = Components.classes["@activestate.com/koDBGPSpawnpoint;1"]
                 .createInstance(Components.interfaces.koIDBGPSpawnpoint);

        sp.type = "spawn";
        sp.language = "Tcl";
        var view = ko.views.manager.currentView;
        if (view && view.getAttribute("type") == "editor" &&
            view.koDoc && view.koDoc.languageObj &&
            view.koDoc.languageObj.name == "Tcl")
        {
            sp.filename = view.koDoc.file.URI;
            sp.lineno = view.scimoz.lineFromPosition(view.scimoz.currentPos) + 1;
        }

        var obj = new Object();
        obj.spawnpoint = sp;
        window.openDialog("chrome://komodo/content/debugger/spawnpointProperties.xul",
                          "_blank",
                          "chrome,modal,titlebar,resizable=yes",
                          obj);
        if (obj.response == "OK") {
            ko.dbg.breakpoints.manager.addBreakpoint(obj.spawnpoint);
        }
    } catch (ex) {
        log.exception(ex);
    }
}


// Edit the given breakpoint in the "Breakpoint Properties" dialog.
this.properties =
function Breakpoints_BreakpointProperties(bp)
{
    log.debug("Breakpoints_BreakpointProperties(bp)");
    var obj;
    try {
        if (bp.type == "spawn") {
            obj = new Object();
            obj.spawnpoint = bp;
            window.openDialog("chrome://komodo/content/debugger/spawnpointProperties.xul",
                              "_blank",
                              "chrome,modal,titlebar,resizable=yes",
                              obj);
            if (obj.response == "OK") {
                ko.dbg.breakpoints.manager.updateBreakpoint(bp.getGuid(),
                                                    obj.spawnpoint);
            }
        } else {
            obj = new Object();
            obj.breakpoint = bp;
            window.openDialog("chrome://komodo/content/debugger/breakpointProperties.xul",
                              "_blank",
                              "chrome,modal,titlebar,resizable=yes",
                              obj);
            if (obj.response == "OK") {
                ko.dbg.breakpoints.manager.updateBreakpoint(bp.getGuid(),
                                                    obj.breakpoint);
            }
        }
    } catch (ex) {
        log.exception(ex);
    }
}

}).apply(ko.dbg.breakpoints);

