/* Copyright (c) 2000-2012 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

xtk.include("controller");
xtk.include('domutils');
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

if (typeof(ko)=='undefined') {
    var ko = {};
}
if (typeof(ko.workspace2) == "undefined") {
    ko.workspace2 = {};
}


(function() {

var platform = require("sdk/system").platform;
var log = require("ko/logging").getLogger('workspace2');
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

const WORKSPACE_PREFS_NAME = "workspace2";

// This is ignored for now atleast until this code is made the defalt workspace code
const MOZ_PERSIST_POSITION_DOES_NOT_WORK =  platform.indexOf('linux') === 0;
                               
/**
 * Restore workspace by name or workspace set to be recovered
 * at startup.
 *
 * This is the entry point for workspace recover from komodo.js
 * It is also implicitly used to restore windows when mutliple windows exist
 * in a workspace.
 */
this.restore = function ko_workspace_restore()
{
    var workspacename = this.getNameFromWindow();
    this.restoreWorkspace(workspacename);
}

/**
 * Check the window arguments for a workspace name and return it
 * 
 * @returns {string} name of workspace found 
 */
this.getNameFromWindow = function ko_workspace_getNameFromWindow() {
    if ('arguments' in window && window.arguments && window.arguments[0]) {
        var arg = window.arguments[0];
        if ('workspaceName' in arg) {
            return arg.workspaceName; // returns undefined if doesn't exist
        }
    }
}
 
/**
 * Restore a workspace.  Called by restore and open.
 * @param {String} A workspace name to recover.  Default is default ;)
 */
this.restoreWorkspace = function ko_workspace_restoreWorkspace(workspacename) {
    
    var allWorkspaces = null;
    //workspace to be restored
    var workspace = null;
    // always restore the default workspace for now unless specified by user
    // passing a name to restore or getting it from the window
    if(typeof(workspacename) == "undefined") {
        workspacename = "default";
    }
    log.debug("Workspace name: '" + workspacename + "'.");
    try { 
        _restoreInProgress = true;

        // Retrieve all workspaces
        if (ko.prefs.hasPref(WORKSPACE_PREFS_NAME)) {
            allWorkspaces = ko.prefs.getPref(WORKSPACE_PREFS_NAME);
        } else {
            log.warn("There are no workspace prefs to restore from.");
            setTimeout(ko.uilayout.restoreWindowState, 1);
            return;
        }
                
        if (allWorkspaces.hasPref(workspacename)) {
            log.debug("Found workspace " + workspacename + ".");
            workspace = allWorkspaces.getPref(workspacename);
        }
       
        if (workspace == null) {
            log.info("Workspace was null.  Nothing to recover.  Exiting");
            setTimeout(ko.uilayout.restoreWindowState, 1);
            return;
        }
        
        // Look through window prefs for a project
        // Check if that project is already open in an existing window
        // If found, open the views for that window then mark as restored.
        let prefIds = workspace.getPrefIds();
        log.debug("Checking for already open project.");
        for ( let id of prefIds )
        {
            log.debug("Checking "+id+" prefset");
            let windowPrefSet = workspace.getPref(id);
            if(windowPrefSet.getBooleanPref("restored"))
                continue;
            if(windowPrefSet &&
               windowPrefSet.hasPref("current_project") &&
               ko.projects.manager.findOtherWindowProjectInstanceForUrl(windowPrefSet.getStringPref("current_project")))
            {
                var msg = "Project already open. Skipping: "+windowPrefSet.getStringPref("current_project");
                log.debug(msg);
                require("notify/notify").send(msg, "workspace2");
                // don't restore it
                windowPrefSet.setBooleanPref("restored", true);
                log.debug("Marking window "+id+" as restored.");
                //Open it's previous files in the window where the project is open
                if (windowPrefSet.hasPref("topview"))
                {
                    _openFilesInOtherProjectWindow(windowPrefSet.getStringPref("current_project"),
                                                   windowPrefSet);
                }
            }
        }
        // We've already got a window to restore.
        var nextIndx = this._getNextWindowIdToRestore(workspace);
        if(workspace.hasPref(nextIndx))
            var windowPrefSet = workspace.getPref(nextIndx);
        var thisWindow = window;
        if (windowPrefSet)
        {
            this.restoreWindow(thisWindow, windowPrefSet);
        }
        
        // check if there is another window to restore
        if (this._getNextWindowIdToRestore(workspace)) {
           ko.launch.newWindowFromWorkspaceName(workspacename);
        } else {
            // if it is undefined, we break out of the window generating loop
            // and we are now done restoring windows
            // Reset the restore state or else no windows will restore next time you
            // open this workspace
            this._resetWindowsRestoredState(workspace);
        }
        
        // handle window.arguments spec list
        // This stuff will get moved to recovering files function
        // It will pull from preferences, not window args which workspace
        // shouldn't need to deal with any way.
        if ('arguments' in window && window.arguments && window.arguments[0]) {
            var arg = window.arguments[0];
            // There is no workspace to restore, but init window essentials
            var urllist;
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
                thisWindow.ko.open.URI(urllist[i]);
            }
        }
        _restoreFocusToMainWindow();
    } catch(ex) {
        log.exception(ex);
    } finally {
        _restoreInProgress = false;
    }
}

/**
 * Open files from a workspace of a project that is already open
 *
 * @param {String} projectURL  The project to find in another window
 * @param {Prefset} windowPrefs  Pref set to retrieve views prefs from
 */
var _openFilesInOtherProjectWindow = (projectURL,windowPrefs) =>
{
    let koWindowList = ko.windowManager.getWindows();
    for (let  i=0; i < koWindowList.length; i++) {
        let w = koWindowList[i];
        if (w.ko && w.ko.projects)
        {
            otherProject = w.ko.projects.manager.getProjectByURL(projectURL);
            if (otherProject)
            {
                _restoreViews(w, windowPrefs);
            }
        }
    }
}

/**
 * Resets all windows in the workspace to a restore: false state when restore is
 * done
 */
this._resetWindowsRestoredState = (workspace) =>
{
    var prefIds = workspace.getPrefIds();
    log.debug("Reseting all window prefs restored state to false.");
    var lim = prefIds.length;
    for (var i = 0; i < lim; i++) {
        var id = prefIds[i];
        var window = workspace.getPref(id);
        if (window.hasBooleanPref("restored")) {
            window.setBooleanPref("restored", false);
        }
    }
};

this._getNextWindowIdToRestore = (workspace) =>
{
    let prefIds = workspace.getPrefIds();
    for (let i in prefIds)
    {
        var id = prefIds[i];
        var window = workspace.getPref(id);
        if(window.hasBooleanPref("restored"))
        if (window.hasBooleanPref("restored") && window.getBooleanPref("restored") == false)
        {
            return id;
        }
    }
    return undefined;
};
 
/**
 * restore all workspace preferences and state, open files and projects
 * @param {window} currentWindow, the window to perform restoration on
 * @param {preference set} the preferences to apply to the window
 * @param {string} workspacename, the workspace being restored.
 */
this.restoreWindow = function ko_workspace_restoreWindow(currentWindow,
                                                         windowPrefs)
{
    log.debug("Using window number " + currentWindow._koNum + " to restore.");
    // Always restore the generic window state (separate from workspace prefs).
    // Must be called after the Mozilla persist state (onload) is done.
    var wko = currentWindow.ko;
    // Restore the first workspace directly, and restore other
    // workspaces indirectly each new window's init routine in ko.main
    try {
        setTimeout(wko.uilayout.restoreWindowState, 1);
        if (windowPrefs.hasPref('coordinates')) {
            var coordinates = windowPrefs.getPref('coordinates');
            // Must be in a setTimeout, after the window has been loaded,
            // otherwise the window manager may resize or reposition it.
            setTimeout(_restoreWindowPosition, 1, currentWindow, coordinates);
        }
        
        _restoreViews(currentWindow, windowPrefs);
        
        try {
            log.debug("Restoring window layout");
            ko.widgets.restoreLayout(windowPrefs,
                                     [WORKSPACE_PREFS_NAME,
            /*ie. workspace name*/    windowPrefs.parent.id, 
                                      windowPrefs.id],
                                     true);
        } catch(e) {
            log.exception("Failed to restore window layout.  " +
                          "Restoring default.");
            ko.widgets.restoreLayout(ko.prefs, []);
        }
        
        
        if (wko.history) {
            log.debug("Restoring window history");
            wko.history.restore_prefs(windowPrefs);
        }
        // Projects depends on places, so open it after Places is initialized.
        if (windowPrefs.hasPref('opened_projects_v7')) {
            log.debug("Restoring Projects");
            let pref = windowPrefs.getPref('opened_projects_v7');
            var currentProjectURI;
            if (windowPrefs.hasPref('current_project')) {
                currentProjectURI = windowPrefs.getStringPref('current_project');
            } else {
                currentProjectURI = null;
            }
            
            // Make sure this project isn't already open
            // Don't load it if it is.
            if( ! ko.projects.manager.findOtherWindowProjectInstanceForUrl(currentProjectURI))
            {
                // Don't load projects until places has initialized the projects view
                this.waitForProjectManager(function() {
                    log.debug("Restoring project: " + currentProjectURI);
                    wko.projects.manager.setState(pref);
                    if (currentProjectURI) {
                        // If a project with that url is loaded, make it current
                        var proj = wko.projects.manager.getProjectByURL(currentProjectURI);
                        if (proj) {
                            wko.projects.manager.currentProject = proj;
                        }
                    }
                });
            }
            
        }
        wko._hasFocus = windowPrefs.getBoolean('hasFocus', false);
    } catch(ex) {
        log.exception(ex, "Error restoring workspace:");
    } finally {
        windowPrefs.setBooleanPref("restored", true);
    }
};


function _restoreViews(_window, windowPrefs) {
    // restore the views
    log.debug("Restore views (files and their position/layout)");
    var id = "topview";
    if (windowPrefs.hasPref(id)) {
        var pref = windowPrefs.getPref(id);
        _window.document.getElementById(id).setState(pref);
    } else {
        log.debug("No previous view state saved.  Skipping.");
    }
}

/**
 * Is Komodo in interactive mode?
 */
function _isNonInteractiveMode() {
    var infoSvc = Cc["@activestate.com/koInfoService;1"].getService();
    if (infoSvc.nonInteractiveMode) {
        return true;
    }
    return false;
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
    log.debug("Restoring window position.");
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
            }
            
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
        };
        setTimeout(delayFunc, delay, 0);
    });
};

// write the current state of preferences to disk
this._flushPreferences = function ko_workspace__dumpPreferences(saveNow){
    var prefSvc = Cc["@activestate.com/koPrefService;1"].getService(Ci.koIPrefService);
    try{
        if (saveNow) {
            prefSvc.saveState();
        } else {
            prefSvc.saveWhenIdle();
        }
    } catch(e) {
        log.exception(e,"Error writing preferences to disk: ");
    }
}

/**
 * Save in an MRU for user restoring operation.
 */
this.addToWorkspaceMRU = function ko_workspace_addToWorkspaceMRU(workspaceName) {
    
    if (!ko.prefs.hasPref("mruWorkspaceSize")) {
        ko.prefs.setLong("mruWorkspaceSize", 10);
    }
    ko.mru.add("mruWorkspaceList", workspaceName);
}

/**
 * Get prefs set if it exists.  Returns set if it exists otherwise create it an return it
 * @param {prefs object} all workspace preferences
 * @param {String} name of set
 */
this.getExistingWorkspaceSet = (allWorkspaces, name) =>
{
    if (allWorkspaces.hasPref(name)) {
        log.debug('Found existing workspace prefs for ' + name);
        return allWorkspaces.getPref(name);
    }
    log.debug('No existing workspace prefs for ' + name+".  Creating it.");
    var workspacePrefs = Components.classes['@activestate.com/koPreferenceSet;1'].createInstance();
    allWorkspaces.setPref(name, workspacePrefs);
    return workspacePrefs;
}

/**
 * Delete the entire Workspace pref namespace and anything in it
 * NOTE currently only for testing.  This function shouldn't be necessary in
 * the wild.
 */
this.deleteAllWorkspacePrefs = function ko_workspace_deleteAllPrefs() {
    ko.pref.deletePref(WORKSPACE_PREFS_NAME);
}

/**
 * Save the current workspace (All open windows, each windows state, all open 
 * files in each window).  If a pref set exists with the same name, it is over
 * written with the new set. eg. 'default' is over written everytime this is run
 * with no argument.
 *
 * This function also automatically populates an MRU for workspaces
 * 
 * @public
 * @param {String} name of the space to save
 */
this.saveWorkspace = function ko_workspace_saveWorkspace(name /*=default*/) {
    _saveInProgress = true;
    if(name == "undefined")
    {
        require("notify/notify").warn("Workspace name is `undefined`.  Cannot save workspace.","workspace2");
        return;
    }
    log.debug('Start workspace save for workspace "' + name + '".');
    // Global workspace prefs, eg.  all of them
    var allWorkspaces = this._getBaseWorkspacePrefSet();
    var workspacePrefs = this.getExistingWorkspaceSet(allWorkspaces, name);
    // Grab all the windows to loop through
    var openWindows = ko.windowManager.getWindows();
    // Pref set to save windows under
    try {
        for(let i in openWindows){
            let thisWindow = openWindows[i];
            this.saveWindowsState(thisWindow, workspacePrefs, name);
        }  
        // Add the new workspace pref set to the gsaveWindowsStatelobal set
        this.addToWorkspaceMRU(name);
        //cleanse workspace prefs and MRU
        //this.cleanseWorkspacePrefsMRU();
        // Save prefs state to disk
        this._flushPreferences();
        log.debug("Workspace '" + name + "' has been saved.  Enjoy!");
    } catch(e) {
        log.exception(e,"Error saving workspace: ");
    } finally {
        _saveInProgress = false;
    }
}

/**
 * Returns a preference object with the windows state.
 * Saves window location, size, current project, open files, etc.
 *
 * @param {Window} _window  The window to be saved
 * @param {prefset} windowPrefs  The named prefset to save the Windows State to
 * @param {String} Takes a Komodo window object
 */
this.saveWindowsState = function ko_workspace_saveWindowsState(_window,
                                                               namedWorspace,
                                                               workspacename) {
    log.debug('Saving Window' + _window._koNum + ' State.');
   //Create a pref object to save the window state in
    var windowWorkspace =
        Components.classes['@activestate.com/koPreferenceSet;1'].createInstance();
    namedWorspace.setPref(_window._koNum, windowWorkspace);

    // State collecting and appending state information to the window state pref
    log.debug('\tSaving Window coordinates.');
    var coordinates = this.getWindowCoordinateState(_window);
    windowWorkspace.setPref('coordinates', coordinates);
    
    log.debug('\tSaving project state.');
    this.getWindowProjectState(_window, windowWorkspace);
    
    log.debug('\tSaving view state.');
    var viewPrefs = this.getWindowViewState(_window);
    if (viewPrefs) {
        windowWorkspace.setPref(viewPrefs.id, viewPrefs);
    }
    
    // Save the window widget layout state
    _window.ko.widgets.unload([WORKSPACE_PREFS_NAME,
                                  namedWorspace.id,
                                  _window._koNum]);
    
    windowWorkspace.setLongPref('windowNum', _window._koNum);
    // Save the current windows ko.history to the window workspace
    if (_window.history) {
        log.debug('\tSaving window history.');
        _window.ko.history.save_prefs(windowWorkspace);
    }
    
    // Set restored state for restoration process
    windowWorkspace.setBooleanPref("restored", false);
    log.debug('Window ' + _window._koNum + '  state save:  COMPLETE');
};

/**
 * Return a preference object with the views state in it
 * @param {Window} A Komodo Window
 */
this.getWindowViewState = function ko_workspace_getWindowViewState(thisWindow) {
    var id = 'topview';
    var elt = thisWindow.document.getElementById(id);
    if (!elt) {
        log.info(_bundle.formatStringFromName("couldNotFind.alert", [id], 1));
        return;
    }
    var pref = elt.getState();
    if (pref) {
        pref.id = id;
    }
    return pref;
}

/**
 * Return a preference object with the Projects state in it
 * @param {Window} A Komodo Window
 * @param {prefset} the window prefs set being saved
 */
this.getWindowProjectState = function ko_workspace_getWindowOpenProject(thisWindow, prefs) {
    var wko = thisWindow.ko;
    var pref = wko.projects.manager.getState();
    if (pref) {
        prefs.setPref(pref.id, pref);
        var currentProject = wko.projects.manager.currentProject;
        log.debug("\tCurrent project: " + currentProject);
        if (currentProject) {
            prefs.setStringPref('current_project', currentProject.url);
        }
    }
}

/**
 * Returns a preferences object with the windows coordinates 
 * @param {Window} A Komodo Window
 */
this.getWindowCoordinateState = function ko_workspace_getWindowCoordinateState(thisWindow) {
    var coordinates =
        Components.classes['@activestate.com/koPreferenceSet;1'].createInstance();
    
    coordinates.setLongPref('windowState', thisWindow.windowState);
    var docElement = thisWindow.document.documentElement;
    coordinates.setLongPref('screenX', docElement.getAttribute('screenX'));
    coordinates.setLongPref('screenY', docElement.getAttribute('screenY'));
    coordinates.setLongPref('outerHeight', docElement.height);
    coordinates.setLongPref('outerWidth', docElement.width);
    
    return coordinates;
}

/**
 * Creates/returns the base workspace pref object that will contain all
 * saved workspaces
 */
this._getBaseWorkspacePrefSet = function() {
    if (ko.prefs.hasPref(WORKSPACE_PREFS_NAME)) {
        return ko.prefs.getPref(WORKSPACE_PREFS_NAME);
    }
    var workspacePrefs = Components.classes['@activestate.com/koPreferenceSet;1'].createInstance();
    ko.prefs.setPref(WORKSPACE_PREFS_NAME, workspacePrefs);
    return workspacePrefs;
}

function hasSavedWorkspaces() {
    var numOfSpaces = ko.prefs.getPref("workspace2").getPrefIds().length;
    return  numOfSpaces >= 1;
}

/*******************************************************************************
 *  Workspace Controller interface  START
 ******************************************************************************/

function workspace2_Controller() {
    ko.main.addWillCloseHandler(this.destructor, this);
}

// The following two lines ensure proper inheritance (see Flanagan, p. 144).
workspace2_Controller.prototype = new xtk.Controller();
workspace2_Controller.prototype.constructor = workspace2_Controller;
workspace2_Controller.prototype.destructor = function() {
    window.controllers.removeController(this);
}

workspace2_Controller.prototype.is_cmd_saveWorkspace_enabled = function(){
    return true;
}
workspace2_Controller.prototype.do_cmd_saveWorkspace = function(){
    ko.workspace2.save();
}
workspace2_Controller.prototype._is_cmd_saveWorkspace_supported = function(){
    return true;
}
    
workspace2_Controller.prototype.is_cmd_openWorkspace_enabled = function(){
    return hasSavedWorkspaces();
}
workspace2_Controller.prototype.do_cmd_openWorkspace = function(){
    ko.workspace2.open();
}
workspace2_Controller.prototype._is_cmd_openWorkspace_supported = function(){
    return hasSavedWorkspaces();
}

workspace2_Controller.prototype.is_cmd_manageWorkspaces_enabled = function(){
    return hasSavedWorkspaces();
} 
workspace2_Controller.prototype.do_cmd_manageWorkspaces = function(){
    ko.workspace2.manage();
}
workspace2_Controller.prototype._is_cmd_manageWorkspaces_supported = function(){
    return hasSavedWorkspaces();
}


// Add the new controller to the Window so it's known and accessible.
var workController = new workspace2_Controller();
window.controllers.appendController(workController);

/*******************************************************************************
 *  Workspace Controller interface  END
 ******************************************************************************/

/**
* UI API entry to save workspace
*/
this.save = function ko_workspace_save(workspacename){
    if (typeof(workspacename) ==  "undefined") {
        let yesNoMsg = _bundle.GetStringFromName("saveWorkspaceSaveNew.YesNoCancel");
        var saveNewWorkspace = ko.dialogs.yesNoCancel(yesNoMsg);
        var workSpaceMRUList = ko.mru.getAll("mruWorkspaceList");

        if (saveNewWorkspace == "Yes")
        {
            var message = _bundle.GetStringFromName("saveWorkspaceSaveNew.message");  
            var opts =
            {
                label: _bundle.GetStringFromName("saveWorkspaceSaveNew.label"),
                value: _bundle.GetStringFromName("saveWorkspaceSaveNew.value"),
                title: _bundle.GetStringFromName("saveWorkspaceSaveNew.title"),
                mruName: _bundle.GetStringFromName("saveWorkspaceSaveNew.mruname")
            };
            workspacename = require("ko/dialogs").prompt(message,opts);
            // Check if the name exists and prompt user to re-enter name
            // Keep promping if they put in another existing name
            var sameName = true;
            while (sameName) {
                if (workSpaceMRUList.indexOf(workspacename) != -1) {
                    let nameExistsMsg = _bundle.GetStringFromName("saveWorkspaceSaveNewExists.YesNoCancel");
                    var nameExistsCont = ko.dialogs.yesNoCancel(nameExistsMsg);
                    if (nameExistsCont == "Yes") {
                        sameName = false;
                    } else if (nameExistsCont == "No") {
                        workspacename = require("ko/dialogs").prompt(message,opts);
                    } else {
                        // this means they cancelled
                        workspacename = null;
                        sameName = false;
                    }
                } else {
                    sameName = false;
                }
            }
            
        } else {
            let title = _bundle.GetStringFromName("saveWorkspaceSaveExisting.title");
            let prompt = _bundle.GetStringFromName("saveWorkspaceSaveExisting.prompt");
            let save = _bundle.GetStringFromName("saveWorkspaceSaveExisting.save");
            let cancel = _bundle.GetStringFromName("saveWorkspaceSaveExisting.cancel");

            workspacename = ko.dialogs.selectFromList(title,
                                             prompt,
                                             workSpaceMRUList,
                                             "one", /*selectionCondition*/
                                             null, /*stringifier*/
                                             null, /*doNotAskPref*/
                                             false, /*yesNoCancel*/
                                             [save,cancel], /*buttons*/
                                             0);   /*selectedIndex*/
        }
    }
    // null is returned from both dialogs if cancel is clicked.  Better not save
    if (!workspacename) {
        return;
    }
    log.debug("Saving workspace with name: " + workspacename  );
    try {
        this.saveWorkspace(workspacename);
    } catch(e) {
        log.exception("An error occurred while saving workspace. ERROR: " + e);
    }
}

/**
* Take a named workspace and load it's into Komodo.
* @params {String} name of workspace to restore
*/
this.open = function(workspacename) {
    if (typeof(workspacename) ==  "undefined") {
        var workSpaceMRUList = ko.mru.getAll("mruWorkspaceList");
        let title = _bundle.GetStringFromName("restorWorkspaceOpen.title");
        let prompt = _bundle.GetStringFromName("restorWorkspaceOpen.prompt");
        let open = _bundle.GetStringFromName("restorWorkspaceOpen.open");
        let cancel = _bundle.GetStringFromName("restorWorkspaceOpen.cancel");

        workspacename = ko.dialogs.selectFromList(title,
                                         prompt,
                                         workSpaceMRUList,
                                         "one", /*selectionCondition*/
                                         null, /*stringifier*/
                                         null, /*doNotAskPref*/
                                         false, /*yesNoCancel*/
                                         [open,cancel], /*buttons*/
                                         0);   /*selectedIndex*/
    }
    
    if (!workspacename) {
        // Must have cancelled.  Fine...i'll just do nothing then!
        return;
    }    
    try {
        this.restoreWorkspace(workspacename);
    } catch(e) {
        log.exception("Failed to load workspace:  ERROR: " + e);
    }
}

this.manage = function ko_workspace2_manageWorkspace(){
    var workSpaceMRUList = ko.mru.getAll("mruWorkspaceList");
    
    var title = _bundle.GetStringFromName("manWorkspace.title");
    var message = _bundle.GetStringFromName("manWorkspace.message");
    var remove = _bundle.GetStringFromName("manWorkspace.remove");
    var cancel = _bundle.GetStringFromName("manWorkspace.cancel");
    
    workspaceName = ko.dialogs.selectFromList(title,
                                         message,
                                         workSpaceMRUList,
                                         "one", /*selectionCondition*/
                                         null, /*stringifier*/
                                         null, /*doNotAskPref*/
                                         false, /*yesNoCancel*/
                                         [remove,cancel], /*buttons*/
                                         0);   /*selectedIndex*/
    if (workspaceName) {
        _deleteWorkspace(workspaceName);
    }
}

var _deleteWorkspace = function ko_workspace2_deleteWorkspace(workspaceName){
    //Get all workspace prefs
    workspacePrefs = ko.prefs.getPref("workspace2");
    // Delete the specific workspace pref set
    workspacePrefs.deletePref(workspaceName);
    // delete the mru entry
    ko.mru.deleteValue("mruWorkspaceList",workspaceName);
}

}).apply(ko.workspace2);
