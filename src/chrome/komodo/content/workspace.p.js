/* Copyright (c) 2000-2012 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

xtk.include('domutils');
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

if (typeof(ko)=='undefined') {
    var ko = {};
}
if (typeof(ko.workspace) == "undefined") {
    ko.workspace = {};
}
(function() {

var log = ko.logging.getLogger('workspace');
//log.setLevel(ko.logging.LOG_DEBUG);
var _saveInProgress = false;
var _restoreInProgress = false;
var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
    .getService(Components.interfaces.nsIStringBundleService)
    .createBundle("chrome://komodo/locale/views.properties");

this.saveInProgress = function() {
    return _saveInProgress;
}

this.restoreInProgress = function() {
    return _restoreInProgress;
}

const _ = require("contrib/underscore");
const ACTIVE_WORKSPACES_PREF_NAME = "windowWorkspace";
const MRU_WORKSPACES_PREF_NAME = "MRUWorkspace"
const MAX_MRU_ENTRIES_PREF_NAME = "maxMRUWorkspaceEntries"
const prefs = require("ko/prefs");
if ( ! prefs.hasPref(MAX_MRU_ENTRIES_PREF_NAME))
    prefs.setLongPref(MAX_MRU_ENTRIES_PREF_NAME, 10);
const _mozPersistPositionDoesNotWork =
// #if PLATFORM == 'win' or PLATFORM == 'darwin'
false;
// #else
true;
// #endif

/**
 * Restore all workspaces, panes and widgets from the last session.
 */
this.restore = function ko_workspace_restore()
{

    _restoreInProgress = true;
    try {
        // the offer to restore the workspace needs to be after the
        // commandments system is initialized because the commandments mechanism
        // is how the determination of 'running in non-interactive mode' happens,
        // which the restoration step needs to know about.
    
        // Eventually restoreWorkspace will be rewritten to restore
        // a set of windows, and restore will be done at app-startup
        // time, not when each window starts up.  This means that the code can't
        // live in chrome/komodo.  Needs to be called from as a service at startup
        //
        // Checks to see if this is the first/only window, if it's not, jump to
        // window args section to open workspace from a index greater than 1
        var restoreWorkspace = true;
        
        // Check if the workspace2 arg is on the window, if it is invoke workspace2
        // code instead. Will be removed when workspace2 becomes the default workspace
        // restore code
        var workspace2 = false;
        if ('arguments' in window && window.arguments && window.arguments[0]) {
            var arg = window.arguments[0];
            if ('workspace2' in arg) {
                var workspace2 = true;
                // work around to allow workspace legacy code to run through
                // it's paces but at the fast possible speed, by skipping most
                // restore steps
                var restoreWorkspace = false;
            }
        }
        
        try {
            if (!ko.windowManager.lastWindow()) {
                restoreWorkspace = false;
            }
        } catch(ex) {
            // Restore the workspace on error
            log.exception(ex);
        }
    
        if (restoreWorkspace) {
            // This is the first pass through workspace restoring so assumes it's
            // window 1
            // Performs all intial workspace checks like did Komodo crash, does the
            // use actually want to recover ect.
            if( ! ko.workspace.restoreWorkspace())
            {
                // Restore the default layout
                ko.widgets.restoreLayout(ko.prefs, []);
            }
        } else {
            // Restore the default layout
            ko.widgets.restoreLayout(ko.prefs, []);
        }
    
        // handle window.arguments spec list
        if ('arguments' in window && window.arguments && window.arguments[0]) {
            var arg = window.arguments[0];
            if ('workspaceIndex' in arg) {
                var thisIndexOnly = ('thisIndexOnly' in arg && arg.thisIndexOnly);
                ko.workspace.restoreWorkspaceByIndex(window, arg.workspaceIndex,
                                                     thisIndexOnly);
            } else {
                // There is no workspace to restore, but init window essentials
                ko.workspace.initializeEssentials(window);
                var urllist;
                // Wait for places to full load bofore loading files
                // or possibly projects.
                this.waitForProjectManager(function(){
                    if ('uris' in arg) {
                        urllist = arg.uris; // Called from ko.launch.newWindow(uri)
                    } else if (arg instanceof Components.interfaces.nsIDialogParamBlock) {
                        var paramBlock = arg.QueryInterface(Components.interfaces.nsIDialogParamBlock);
                        urllist = paramBlock ? paramBlock.GetString(0).split('|') : [];
                    } else if (typeof(arg) == 'string') {
                        urllist = arg.split('|'); //see asCommandLineHandler.js
                    } else {
                        // arg is most likely an empty object
                        urllist = [];
                    }
                    for (var i in urllist) {
                        ko.open.URI(urllist[i]);
                    }
                     ko.workspace.saveWorkspaceWindowByNumber(window._koNum, true);
                });
            }
        }
    } finally {
        // Some paths through the above block might not have called this,
        // so call it now to be sure.  See bug 87856.
        ko.workspace.initializeEssentials(window);
        //XXX remove when workspace 2 becomes core
        if(workspace2)
            ko.workspace2.restore();
        ko.workspace.saveWorkspaceWindowByNumber(window._koNum, true);
        _restoreInProgress = false;
    }
}

/**
 * restore all workspace preferences and state, open files and projects
 * Is only run for the first window.
 */
this.restoreWorkspace = function view_restoreWorkspace(currentWindow)
{
    if (typeof(currentWindow) == "undefined") {
        // Get the window that's executing, and use that.
        currentWindow = ko.windowManager.getMainWindow();
    }
    var infoSvc = Components.classes["@activestate.com/koInfoService;1"].getService();
    if (infoSvc.nonInteractiveMode) return;

    var was_normal_shutdown = ko.prefs.getBooleanPref('komodo_normal_shutdown');
    if (was_normal_shutdown) {
        ko.prefs.setBooleanPref('komodo_normal_shutdown', false);
        // Force flushing of prefs to file.
        var prefSvc = Components.classes["@activestate.com/koPrefService;1"].getService(Components.interfaces.koIPrefService);
        prefSvc.saveState();
    }

    // Always restore the generic window state (separate from workspace prefs).
    // Must be called after the Mozilla persist state (onload) is done.
    setTimeout(ko.uilayout.restoreWindowState, 1);

    // If there is a workspace to restore - prompt the user to see if they wish
    // to restore it.
    if (!this._workspacePrefsExist(ACTIVE_WORKSPACES_PREF_NAME)) {
        return;
    } else if (!was_normal_shutdown) {   // Komodo crashed
        if (ko.prefs.getBooleanPref("donotask_restore_workspace") &&
            ko.prefs.getStringPref("donotask_action_restore_workspace") == "No") {
            if(this._workspacePrefsExist(ACTIVE_WORKSPACES_PREF_NAME))
            {
                prefs.deletePref(ACTIVE_WORKSPACES_PREF_NAME);
            }
            // The user has explicitly asked never to restore the workspace.
            return false;
        }
        var prompt = _bundle.GetStringFromName("restoreWorkspaceAfterCrash.prompt");
        var title = _bundle.GetStringFromName("restoreWorkspaceAfterCrash.title");
        if (ko.dialogs.yesNo(prompt, null, null, title) == "No") {
            if(this._workspacePrefsExist(ACTIVE_WORKSPACES_PREF_NAME))
            {
                prefs.deletePref(ACTIVE_WORKSPACES_PREF_NAME);
            }
            return false;
        }
    } else if (ko.dialogs.yesNo(_bundle.GetStringFromName("doYouWantToOpenRecentFilesAndProjects.prompt"),
                                null, null, null, "restore_workspace") == "No") {
        return false;
    }

    var windowWorkspacePref = this._getActiveWorkspacesPrefs();
    var checkWindowBounds = _mozPersistPositionDoesNotWork || windowWorkspacePref.hasPref(1);
    // Restore the first workspace directly, and restore other
    // workspaces indirectly each new window's init routine in ko.main
    var nextIdx = this._getNextWorkspaceIndexToRestore(Number.NEGATIVE_INFINITY);
    if (nextIdx !== undefined) {
        let workspace = windowWorkspacePref.getPref(nextIdx);
        this._restoreWindowWorkspace(workspace,
                                     currentWindow,
                                     checkWindowBounds,
                                     [ACTIVE_WORKSPACES_PREF_NAME, nextIdx]);
        nextIdx = this._getNextWorkspaceIndexToRestore(nextIdx);
        if (nextIdx !== undefined)
        {
            ko.launch.newWindowFromWorkspace(nextIdx);
        }
    }
    return true;
};

// Fix up the stored window numbers
this._fixStoredWindowNumbers = (windowWorkspacePref) =>
{
    let prefIds = windowWorkspacePref.getPrefIds();
    prefIds = prefIds.map(function(n) parseInt(n, 10)).sort(function(a, b) a - b);
    if (prefIds[0] < 1) {
        // Invalid ids; shift everything over :|
        let prefs = prefIds.map(function(n) windowWorkspacePref.getPref(n));
        prefIds.map(function(n) windowWorkspacePref.deletePref(n));
        for (let i = 1; prefs.length; ++i) {
            windowWorkspacePref.setPref(i, prefs.shift());
        }
        prefIds = windowWorkspacePref.getPrefIds();
    }
    for each (let prefId in prefIds) {
        let pref = windowWorkspacePref.getPref(prefId);
        if (pref.hasLongPref("windowNum")) {
            pref.setLongPref("windowNum", prefId);
        }
    }
    return windowWorkspacePref;
}

this._getNextWorkspaceIndexToRestore = function _getNextWorkspaceIndexToRestore(currIdx) {
    var windowWorkspacePref = this._getActiveWorkspacesPrefs();
    windowWorkspacePref = this._fixStoredWindowNumbers(windowWorkspacePref);
    var prefIds = windowWorkspacePref.getPrefIds();
    prefIds = prefIds.filter(function(i) i > currIdx);
    prefIds.sort(function(a, b) { return a - b ;});
    var lim = prefIds.length;
    for (var i = 0; i < lim; i++) {
        var newIdx = prefIds[i];
        if (!windowWorkspacePref.hasPref(newIdx)) {
            continue;
        }
        return newIdx;
    }
    return undefined;
};

/**
 * Restore a workspace from saved preferences.
 * thisIndexOnly==true means it will look in "MRUWorkspace"
 * else it will look at "windowWorkspace"
 *
 * Workspace is deleted from prefs once restored.
 */
this.restoreWorkspaceByIndex = function(currentWindow, idx, thisIndexOnly)
{
    idx = parseInt(idx);
    // thisIndexOnly means it's using the file > Recent Windows and taking from
    // mruWorkspaces, else use the saved workspaces as this is a startup/restore
    // scenario.
    var workspace;
    if(thisIndexOnly)
        workspace = this._getMRUWorkspacePrefs();
    else
        workspace = this._getActiveWorkspacesPrefs();
    try {
        this._restoreWindowWorkspace(workspace.getPref(idx),
                                     currentWindow,
                                     idx > 0 || _mozPersistPositionDoesNotWork,
                                     [workspace.id, idx]);
    } catch(ex) {
        log.exception("Can't restore workspace for window " + idx + ", exception: " + ex);
    }
    if ( ! thisIndexOnly)
    {
        var nextIdx = this._getNextWorkspaceIndexToRestore(idx);
        if (nextIdx !== undefined) {
            ko.launch.newWindowFromWorkspace(nextIdx);
        } else {
            // All windows have been opened.
            // Remove now stale workspace prefs
            require("ko/prefs").deletePref(ACTIVE_WORKSPACES_PREF_NAME);
            _restoreFocusToMainWindow();
        }
    }
    // If we're opening a recent window then remove the index
    // otherwise we are cycling through multiple windows and
    // they will all get deleted at once when they are all restored in
    // restore
    if(thisIndexOnly)
        workspace.deletePref(idx);
};


/**
 * Get the MRU workspaces that are saved each time you close a window
 *
 * @returns {Array} an array of recently closed workspace prefs
 */
this.getRecentClosedWindowList = function() {
    if (!this._workspacePrefsExist(MRU_WORKSPACES_PREF_NAME)) {
        return [];
    }
    var MRUWorkspace = this._getMRUWorkspacePrefs();
    var prefIds = MRUWorkspace.getPrefIds();
    prefIds = prefIds.map(function(x) parseInt(x));
    var loadedWindows = ko.windowManager.getWindows();
    var loadedIDs = loadedWindows.map(function(w) parseInt(w._koNum));
    var mruList = [];
    for (var i = 0; i < prefIds.length; i++) {
        try {
            let idx  = prefIds[i];
            if (loadedIDs.indexOf(idx) != -1) {
                //dump("Skip window " + idx + " -- it's already loaded\n");
                continue;
            }
            var workspace = MRUWorkspace.getPref(idx);
            if (!workspace.hasPref("topview")) {
                //Observation: this can happen for windows that have no loaded views.
                // Encountered while working on bug 91751 and bug 91744
                log.debug("getRecentClosedWindowList: !workspace.hasPref(topview)\n");
                continue;
            }
            var topview = workspace.getPref("topview");
            var childState = topview.getPref("childState");
            var current_view_index = childState.getPref(0).getLongPref("current_view_index");
            var view_prefs = childState.getPref(0).getPref('view_prefs');
            if (view_prefs.length <= current_view_index) {
                // Oops, this view doesn't actually exist?
                current_view_index = view_prefs.length - 1;
            }
            var currentFile = view_prefs.getPref(current_view_index).getStringPref("URI");
            var mru = {
              windowNum: idx,
              currentFile: currentFile
            };
            if (workspace.hasPref("current_project")) {
                var current_project = workspace.getStringPref("current_project");
                if (current_project) {
                    mru.current_project = current_project;
                }
            }
            mruList.push(mru);
        } catch(ex) {
            log.error("getRecentClosedWindowList error in workspace " + ACTIVE_WORKSPACES_PREF_NAME + ": " + ex);
        }
    }
    return mruList;
}

function _restoreFocusToMainWindow() {
    var windows = ko.windowManager.getWindows();
    for (var i = 0; i < windows.length; i++) {
        var w = windows[i];
        if (w.ko._hasFocus) {
            w.focus();
        }
        delete w.ko._hasFocus;
    }
}

// Bug 80604 -- screenX and screenY values like -32000 can occur.
// Generalize it: if we fall behind or in front of some threshold,
// return the acceptable min/max value.
function _checkWindowCoordinateBounds(candidateValue,
                            minAcceptableThreshold, minAcceptable,
                            maxAcceptableThreshold, maxAcceptable) {
    if (candidateValue < minAcceptableThreshold) {
        return Math.round(minAcceptable);
    }
    if (candidateValue > maxAcceptableThreshold) {
        return Math.round(maxAcceptable);
    }
    return candidateValue;
}

function _restoreWindowPosition(currentWindow, coordinates) {
    const _nsIDOMChromeWindow = Components.interfaces.nsIDOMChromeWindow;
    var windowState = (coordinates.hasPrefHere('windowState')
                       ? coordinates.getLongPref('windowState')
                       : _nsIDOMChromeWindow.STATE_NORMAL);
    // If it's minimized or maximized we still need to set the
    // window's coords for when it's restored.
    var screenHeight = window.screen.availHeight;
    var screenWidth = window.screen.availWidth;
    var screenX = coordinates.getLongPref('screenX');
    var screenY = coordinates.getLongPref('screenY');
    var outerHeight = coordinates.getLongPref('outerHeight');
    var outerWidth = coordinates.getLongPref('outerWidth');
    if (Math.abs(screenX) > 3 * screenWidth || Math.abs(screenY) > 3 * screenHeight) {
        screenX = screenY = 0;
    }
    if (currentWindow.screenX != screenX || currentWindow.screenY != screenY) {
        currentWindow.moveTo(screenX, screenY);
    }
    if (currentWindow.outerHeight != outerHeight || currentWindow.outerWidth != outerWidth) {
        var newHeight = _checkWindowCoordinateBounds(outerHeight, 0,
                                                     0.2 * screenHeight,
                                                     screenHeight,
                                                     0.9 * screenHeight);
        var newWidth = _checkWindowCoordinateBounds(outerWidth, 0,
                                                    0.2 * screenWidth,
                                                    screenWidth,
                                                    0.9 * screenWidth);
        currentWindow.resizeTo(newWidth, newHeight);
    }
    if (windowState == _nsIDOMChromeWindow.STATE_MINIMIZED) {
        currentWindow.minimize();
    } else if (windowState == _nsIDOMChromeWindow.STATE_MAXIMIZED) {
        currentWindow.maximize();
    }
}

this._restoreWindowWorkspace =
    function(workspace, currentWindow, checkWindowBounds, prefPath)
{
    try {
        var wko = currentWindow.ko;
        if (checkWindowBounds && workspace.hasPref('coordinates')) {
            var coordinates = workspace.getPref('coordinates');
            // Must be in a setTimeout, after the window has been loaded,
            // otherwise the window manager may resize or reposition it.
            setTimeout(_restoreWindowPosition, 1, currentWindow, coordinates);
        }

        if (workspace.hasPref('windowNum')) {
            let windowNum = workspace.getLongPref('windowNum');
            let infoService = Components.classes["@activestate.com/koInfoService;1"].
                                         getService(Components.interfaces.koIInfoService);
            currentWindow._koNum = windowNum;
            try {
                infoService.setUsedWindowNum(windowNum);
            } catch(ex) {
                // It turns out that the window # saved in the old workspace
                // has already been assigned.
                currentWindow._koNum = infoService.nextWindowNum();
            }
        }

        var ids = workspace.getPrefIds();
        for (var i = 0; i < ids.length; i++) {
            id = ids[i];
            elt = currentWindow.document.getElementById(id);
            if (elt) {
                pref = workspace.getPref(id);
                elt.setState(pref);
            }
        }
        ko.widgets.restoreLayout(workspace, prefPath, true);
        if (wko.history) {
            wko.history.restore_prefs(workspace);
        }

        // Projects depends on places, so open it after Places is initialized.
        if (workspace.hasPref('opened_projects_v7')) {
            
            pref = workspace.getPref('opened_projects_v7');
            var currentProjectURI;
            if (workspace.hasPref('current_project')) {
                currentProjectURI = workspace.getStringPref('current_project');
            } else {
                currentProjectURI = null;
            }
            // Don't load projects until places has initialized the projects view
            
            this.waitForProjectManager(function() {
                wko.projects.manager.setState(pref);
                if (currentProjectURI) {
                    // If a project with that url is loaded, make it current
                    var proj = wko.projects.manager.getProjectByURL(currentProjectURI);
                    if (proj) {
                        wko.projects.manager.currentProject = proj;
                        wko.workspace._saveWorkspaceForIdx_aux(currentWindow._koNum, currentWindow, require("ko/windows").getMain(), workspace, false);
                    }
                }
            });
        }
        wko._hasFocus = workspace.getBoolean('hasFocus', false);
    } catch(ex) {
        log.exception(ex, "Error restoring workspace:");
    }
};

this.waitForProjectManager = function(callback) {
    // First make sure the places widget exists ,and then verify
    // the project manager has been hooked up, so the tree is loaded.
    ko.widgets.getWidgetAsync('placesViewbox', function() {
        var delayFunc;
        var limit = 100; // iterations
        var delay = 100;  // time in msec
        delayFunc = function(tryNum) {
            var success = false;
            try {
                if (ko.toolbox2 && ko.toolbox2.manager &&
                    ko.projects.manager.viewMgr.owner.projectsTreeView) {
                    success = true;
                }
            } catch(ex) {
                log.info("waitForProjectManager: Failure: " + tryNum + ": "  + ex);
            };
            
            // This should not be in the try/catch as it would cause a loop if the
            // callback has an exception
            if (success) {
                callback();
                return;
            }
            
            if (tryNum < limit) {
                setTimeout(delayFunc, delay, tryNum + 1);
            } else {
                log.error("waitForProjectManager: Gave up trying to restore the projects workspace");
            }
        }
        setTimeout(delayFunc, delay, 0);
    });
};

this._calledInitializeEssentials = false;
this.initializeEssentials = function(currentWindow) {
    if (this._calledInitializeEssentials) {
        return;
    }
    var infoService = Components.classes["@activestate.com/koInfoService;1"].
                                 getService(Components.interfaces.koIInfoService);
    if ( ! ("__koNum" in currentWindow.ko.main))
    {
        currentWindow._koNum = infoService.nextWindowNum();
    }
    xtk.domutils.fireEvent(window, 'workspace_restored');
    this._calledInitializeEssentials = true;
}

/*XXX: At some point remove these prefs from the global prefset:
 * uilayout_bottomTabBoxSelectedTabId
 * uilayout_leftTabBoxSelectedTabId
 * uilayout_rightTabBoxSelectedTabId
 */

this._saveWorkspaceForIdx_aux =
    function _saveWorkspaceForIdx_aux(idx, thisWindow, mainWindow,
                                      workspaces, saveCoordinates) {
   
    // Check if the window has been properly instantiated.
    // This is necessary due to ko.workspace.saveWorkspace() being
    // triggered on view creation from workspace2 restore.
    // If workspace2 is in the middle
    // of a restore (i also check for workspace2 InProgree params),
    // Saveworkspace loops through alle
    // open windows which ends up being the newly created, not properly
    // initialized window (eg. initializeEssntials() hasn't run) so things
    // get WEIRD
    if(!ko in thisWindow){
        // synopsis of above comment: if ko doesn't exist there is no
        // point in saving this window as it's not ready to save.
        return;
    }
    
    if( ! thisWindow._koNum )
        return; // Should never be in this state but if it is, don't save it.
    
    var wko = thisWindow.ko;
    var workspace = Components.classes['@activestate.com/koPreferenceSet;1'].createInstance();
    
    workspaces.setPref(thisWindow._koNum, workspace);
    //XXX refactor new function here.  Return pref object to do the ABOVE step
    // with, eg. append it to the thisWindow workspace
    if (saveCoordinates) {
        var coordinates = Components.classes['@activestate.com/koPreferenceSet;1'].createInstance();
        workspace.setPref('coordinates', coordinates);
        coordinates.setLongPref('windowState', thisWindow.windowState);
        var docElement = thisWindow.document.documentElement;
        coordinates.setLongPref('screenX', docElement.getAttribute('screenX'));
        coordinates.setLongPref('screenY', docElement.getAttribute('screenY'));
        coordinates.setLongPref('outerHeight', docElement.height);
        coordinates.setLongPref('outerWidth', docElement.width);
    }
    if (thisWindow == mainWindow) {
        workspace.setBooleanPref('hasFocus', true);
    }
    var pref = wko.projects.manager.getState();
    if (pref) {
        workspace.setPref(pref.id, pref);
        var currentProject = wko.projects.manager.currentProject;
        if (currentProject) {
            workspace.setStringPref('current_project', currentProject.url);
        }
    }
    var ids = ['topview'];
    var i, elt, id;
    for (i = 0; i < ids.length; i++) {
        id = ids[i];
        elt = thisWindow.document.getElementById(id);
        if (!elt) {
            continue;
        }
        pref = elt.getState();
        if (pref) {
            pref.id = id;
            workspace.setPref(id, pref);
        }
    }
    workspace.setLongPref('windowNum', thisWindow._koNum);
    // Divide the # of millisec by 1000, or we'll overflow on the setLongPref
    // conversion to an int.
    workspace.setLongPref('timestamp', (new Date()).valueOf() / 1000);
    if (wko.history) {
        wko.history.save_prefs(workspace);
    }
    // Save current project settings
    if (wko.projects.manager && wko.projects.manager.currentProject)
        wko.projects.manager.saveProjectViewState(wko.projects.manager.currentProject);
};

/**
 * Return the saved workspaces of windows that have been closed while Komodo
 * is still running.
 *
 * @returns {Prefset} returns a preferences set of previously open Windows.
 */
this._getMRUWorkspacePrefs = () =>
{
    return this._getWorkspacePrefs_aux(MRU_WORKSPACES_PREF_NAME);
}

/**
 * Return the current workspace prefset of all open windows or the windows that
 * were open when Komodo had an Application Quit or Crashed.
 *
 * @returns {Prefset} returns a preferences set of workspaces
 */
this._getActiveWorkspacesPrefs = () =>
{
    return this._getWorkspacePrefs_aux(ACTIVE_WORKSPACES_PREF_NAME);
}

/**
 * Get a workspace specific prefset whether it exists or not
 *
 * @param {String} prefName The name of the prefset you want
 */
this._getWorkspacePrefs_aux = function(prefName) {
    if(prefName == "undefined")
    {
        log.error("Must include `prefName` when calling `_getWorkspacePrefs_aux`");
        return;
    }
    if (ko.prefs.hasPref(prefName)) {
        return ko.prefs.getPref(prefName);
    }
    var prefset = Components.classes['@activestate.com/koPreferenceSet;1'].createInstance();
    ko.prefs.setPref(prefName, prefset);
    return prefset;
};

/**
 * Check if a prefset already exists.  It creates an empty set of prefs if
 * it didn't exist already.
 * 
 * @param {String} prefName  The pref to check for
 */
this._workspacePrefsExist = (prefName) =>
{
    return ko.prefs.hasPref(prefName) && 
        ko.prefs.getPref(prefName).getPrefIds().length;
};


/**
 * Save a window to an MRU lists used in File > Recent Windows.
 * ko.uilayout._updateMRUClosedWindowMenu() loads this list to create the menu
 *
 * @param {Number} index  The index of the window being closed and saved.
 */
this.saveMRUWindow = (index) =>
{
    var mainWindow = ko.windowManager.getMainWindow();
    var windows = ko.windowManager.getWindows();
    var mruWorkspaces = this._getMRUWorkspacePrefs();
    var saveCoordinates = _mozPersistPositionDoesNotWork || windows.length > 1;
    try {
        _saveInProgress = true;
        var thisWindow = window; // the current window
        // save mru workspace
        this._saveWorkspaceForIdx_aux(index,
                                      thisWindow, mainWindow,
                                      mruWorkspaces, saveCoordinates);
        // Delete from the current workspaces
        this._getActiveWorkspacesPrefs().deletePref(index);
    } catch (e) {
        log.exception(e,"Error saving workspace: ");
    } finally {
        var prefSvc = Components.classes["@activestate.com/koPrefService;1"].getService(Components.interfaces.koIPrefService);
        prefSvc.saveState();
        this._truncatePrefs();
        _saveInProgress = false;
    }
};

/**
 * Shorten pref set if needed
 * Shrunk to `require('ko/prefs').getLongPref(maxMRUWorkspaceEntries);`
 */
this._truncatePrefs = () =>
{
    var maxEntries = prefs.getLongPref(MAX_MRU_ENTRIES_PREF_NAME);
    var MRUWorkspaces = this._getMRUWorkspacePrefs();
    var prefIds = MRUWorkspaces.getPrefIds();
    if (prefIds.length > maxEntries)
    {
        prefs.deletePref(prefIds.pop());
    }
}

this.saveWorkspaceDeferred = function view_saveWorkspaceDeferred(func)
{
    if (ko.workspace.saveWorkspaceDeferred.timer !== null)
        return;
    clearTimeout(ko.workspace.saveWorkspaceDeferred.timer);
    // For deferred calls we only want to save the workspace at most once every X seconds
    ko.workspace.saveWorkspaceDeferred.timer = setTimeout(ko.workspace.saveWorkspace, ko.prefs.getLong('workspace_deferred_save_delay', 5000));
};
this.saveWorkspaceDeferred.timer = null;

/**
 * Check if window coordinates should be saved.
 */
var saveCoordinates = () =>
{
    return _mozPersistPositionDoesNotWork || require("ko/windows").getAll().length > 1;
}

this.saveWorkspaceWindowByNumber = (windowNumber, saveNow) =>
{
    if(ko.workspace.saveInProgress() || ko.workspace.restoreInProgress())
    {
        _.defer(ko.workspace.saveWorkspaceWindowByNumber, windowNumber, saveNow);
    }
    else
    {
        ko.workspace._saveWorkspaceWindowByNumber(windowNumber, saveNow);
    }
};

/**
 * Save a single windows state
 */
this._saveWorkspaceWindowByNumber = (windowNumber, saveNow) =>
{
    _saveInProgress = true;
    // Ask each major component to serialize itself to a pref.
    try {
        let mainWindow = require("ko/windows").getMain();
        let windows = ko.windowManager.getWindows();
        let windowWorkspace = this._getActiveWorkspacesPrefs();
        for (var thisWindow, idx = 0; thisWindow = windows[idx]; idx++) {
            if(thisWindow._koNum == windowNumber)
            {
                this._saveWorkspaceForIdx_aux(windowNumber,
                                          thisWindow, mainWindow,
                                          windowWorkspace, saveCoordinates());
                break;
            }
        }
        let prefSvc = Components.classes["@activestate.com/koPrefService;1"].getService(Components.interfaces.koIPrefService);
        if (saveNow) {
            prefSvc.saveState();
        } else {
            prefSvc.saveWhenIdle();
        }
    } catch (e) {
        log.exception(e,"Error saving workspace: ");
    } finally {
        _saveInProgress = false;
    }
};

/**
 * `saveNow` causes Komodo to write to the Prefs file now rather than waiting
 * `shuttingDown` skips debounce and just calls _saveWorkspace without waiting
 *    wince we're shutting down and don't need to wait.
 */
this.saveWorkspace = (saveNow, shuttingDown) =>
{
    if(shuttingDown)
    {
        ko.workspace._saveWorkspace(saveNow);
    }
    else
    {
        ko.workspace._saveWorkspaceDebounce(saveNow);
    }
};

/**
 * save all workspace preferences and state
 */
this._saveWorkspaceDebounce = _.debounce(ko.workspace._saveWorkspace,3000);

this._saveWorkspace = (saveNow) =>
{
    _saveInProgress = true;
    // Ask each major component to serialize itself to a pref.
    try {
        let mainWindow = ko.windowManager.getMainWindow();
        let windows = ko.windowManager.getWindows();
        let windowWorkspace = ko.workspace._getActiveWorkspacesPrefs();
        for (var thisWindow, idx = 0; thisWindow = windows[idx]; idx++)
        {
             ko.workspace._saveWorkspaceForIdx_aux(idx, thisWindow, mainWindow,
                                         windowWorkspace, saveCoordinates());
        }
        let prefSvc = Components.classes["@activestate.com/koPrefService;1"].getService(Components.interfaces.koIPrefService);
        if (saveNow) {
            prefSvc.saveState();
        } else {
            prefSvc.saveWhenIdle();
        }
    } catch (e) {
        log.exception(e,"Error saving workspace: ");
    } finally {
        _saveInProgress = false;
    }
};

}).apply(ko.workspace);
