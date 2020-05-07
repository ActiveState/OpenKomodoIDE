// Copyright (c) 2000-2010 ActiveState Software Inc.
// See the file LICENSE.txt for licensing information.

// The Places controller.

if (typeof(ko) == 'undefined') {
    var ko = {};
}
if (!('places' in ko)) {
    ko.places = {};
}

xtk.include("clipboard");

(function(){
function PlacesController() {
    this.log = ko.logging.getLogger("PlacesController");
    this.log.setLevel(ko.logging.LOG_DEBUG);
}

PlacesController.prototype.is_cmd_viewPlaces_enabled = function() {
    return true;
}

PlacesController.prototype.do_cmd_viewPlaces = function() {
    ko.uilayout.toggleTab('placesViewbox');
}

PlacesController.prototype.is_cmd_openDirectory_enabled = function() {
    //this.log.debug("PlacesController.prototype.is_cmd_openDirectory_enabled\n");
    return true;
}

PlacesController.prototype.do_cmd_openDirectory = function() {
    //this.log.debug("PlacesController.prototype.do_cmd_openDirectory\n");
    ko.places.manager.doOpenDirectory();
}

PlacesController.prototype.is_cmd_openRemoteDirectory_enabled = function() {
    //this.log.debug("PlacesController.prototype.is_cmd_openRemoteDirectory_enabled\n");
    return true;
}

PlacesController.prototype.do_cmd_openRemoteDirectory = function() {
    //this.log.debug("PlacesController.prototype.do_cmd_openRemoteDirectory\n");
    ko.places.manager.doOpenRemoteDirectory();
}

// cmdset_place_contextMenu controller

// PlacesController.prototype.is_cmd_bufferClose_supported -- always.

PlacesController.prototype._places_can_take_keycommands = function() {
    return true;
};

PlacesController.prototype.is_cmd_cut_enabled = function() {
    return this._places_can_take_keycommands();
}
PlacesController.prototype.do_cmd_cut = function() {
    ko.places.manager.doCutPlaceItem();
}

PlacesController.prototype.is_cmd_copy_enabled = function() {
    return this._places_can_take_keycommands();
},

PlacesController.prototype.do_cmd_copy = function() {
    if (!this.is_cmd_copy_enabled()) {
        this.log.debug("do_cmd_copy: invoked, but not enabled")
        return;
    }
    ko.places.manager.doCopyPlaceItem();
}

PlacesController.prototype.is_cmd_paste_enabled = function() {
    return (this._places_can_take_keycommands()
            && xtk.clipboard.containsFlavors(["x-application/komodo-places",
                                              "text/uri-list"]));
}

PlacesController.prototype.do_cmd_paste = function() {
    if (!this.is_cmd_paste_enabled()) {
        this.log.debug("do_cmd_paste: invoked, but not enabled");
        return;
    }
    ko.places.manager.doPastePlaceItem();
}

PlacesController.prototype.is_cmd_findInPlace_enabled = function() {
    return ko.places.manager.currentPlaceIsLocal;
}

PlacesController.prototype.do_cmd_findInPlace = function() {
    if (!this.is_cmd_findInPlace_enabled()) {
        this.log.debug("do_cmd_findInPlace: invoked, but not enabled");
        return;
    }
    ko.places.manager.doFindInPlace();
}

PlacesController.prototype.is_cmd_replaceInPlace_enabled = function() {
    return ko.places.manager.currentPlaceIsLocal;
}

PlacesController.prototype.do_cmd_replaceInPlace = function() {
    if (!this.is_cmd_replaceInPlace_enabled()) {
        this.log.debug("do_cmd_replaceInPlace: invoked, but not enabled");
        return;
    }
    ko.places.manager.doReplaceInPlace();
}

PlacesController.prototype.is_cmd_places_showInFinder_enabled = function() {
    return ko.places.manager.currentPlaceIsLocal;
}

PlacesController.prototype.do_cmd_places_showInFinder = function() {
    if (!this.is_cmd_places_showInFinder_enabled()) {
        return;
    }
    ko.places.manager.doShowInFinder();
}

PlacesController.prototype.is_cmd_renamePlace_File_enabled = function() {
    return true;
}

PlacesController.prototype.do_cmd_renamePlace_File = function() {
    if (!this.is_cmd_renamePlace_File_enabled()) {
        return;
    }
    ko.places.manager.doRenameItem();
}

PlacesController.prototype.is_cmd_deletePlaceItem_enabled = function() {
    return true;
}

PlacesController.prototype.do_cmd_deletePlaceItem = function() {
    if (!this.is_cmd_deletePlaceItem_enabled()) {
        this.log.debug("do_cmd_deletePlaceItem: invoked, but not enabled");
        return;
    }
    ko.places.manager.doDeletePlace();
}

PlacesController.prototype.is_cmd_placeView_defaultView_enabled = function() {
    return true;
}

PlacesController.prototype.do_cmd_placeView_defaultView = function() {
    if (!this.is_cmd_placeView_defaultView_enabled()) {
        this.log.debug("do_cmd_placeView_defaultView: invoked, but not enabled");
        return;
    }
    ko.places.viewMgr.placeView_defaultView();
}

PlacesController.prototype.is_cmd_placeView_currentProject_enabled = function() {
    return !!ko.projects.manager.currentProject;
}

PlacesController.prototype.do_cmd_placeView_currentProject = function() {
    if (!this.is_cmd_placeView_currentProject_enabled()) {
        this.log.debug("do_cmd_placeView_currentProject: invoked, but not enabled");
        return;
    }
    ko.places.viewMgr.placeView_currentProject();
}

PlacesController.prototype.is_cmd_placeView_viewAll_enabled = function() {
    return true;
}

PlacesController.prototype.do_cmd_placeView_viewAll = function() {
    if (!this.is_cmd_placeView_viewAll_enabled()) {
        this.log.debug("do_cmd_placeView_viewAll: invoked, but not enabled");
        return;
    }
    ko.places.viewMgr.placeView_viewAll();
}

PlacesController.prototype.is_cmd_placeView_customView_enabled = function() {
    return true;
}

PlacesController.prototype.do_cmd_placeView_customView = function() {
    if (!this.is_cmd_placeView_customView_enabled()) {
        this.log.debug("do_cmd_placeView_customView: invoked, but not enabled");
        return;
    }
    ko.places.viewMgr.placeView_customView();
}

PlacesController.prototype.is_cmd_places_goUpOneFolder_enabled = function() {
    var uri = ko.places.manager.currentPlace;
    var fileObj = Components.classes["@activestate.com/koFileEx;1"].
                  createInstance(Components.interfaces.koIFileEx);
    fileObj.URI = uri;
    return fileObj.dirName != fileObj.path;
}

PlacesController.prototype.do_cmd_places_goUpOneFolder = function() {
    if (!this.is_cmd_places_goUpOneFolder_enabled()) {
        this.log.debug("do_cmd_places_goUpOneFolder: invoked, but not enabled");
        return;
    }
    ko.places.manager.goUpOneFolder();
}

PlacesController.prototype.is_cmd_goPreviousPlace_enabled = function() {
    return ko.places.manager.can_goPreviousPlace();
}

PlacesController.prototype.do_cmd_goPreviousPlace = function() {
    if (!this.is_cmd_goPreviousPlace_enabled()) {
        this.log.debug("do_cmd_goPreviousPlace: invoked, but not enabled");
        return;
    }
    ko.places.manager.goPreviousPlace();
}

PlacesController.prototype.is_cmd_goNextPlace_enabled = function() {
    return ko.places.manager.can_goNextPlace();
}

PlacesController.prototype.do_cmd_goNextPlace = function() {
    if (!this.is_cmd_goNextPlace_enabled()) {
        this.log.debug("do_cmd_goNextPlace: invoked, but not enabled");
        return;
    }
    ko.places.manager.goNextPlace();
}

PlacesController.prototype.is_cmd_places_showFileIcons_enabled = function() {
    if ( ! ko.prefs.getBoolean('pref_places_showFileIcons', true)) {
        document.getElementById('places_showFileIcons').removeAttribute('checked');
    }

    return true;
}

PlacesController.prototype.do_cmd_places_showFileIcons = function() {
    var value = ko.prefs.getBoolean('pref_places_showFileIcons', true);
    var tree = document.getElementById("places-files-tree");

    if (value) {
        ko.prefs.setBooleanPref('pref_places_showFileIcons', false);
        tree.classList.add("hideIcons");
    }
    else
    {
        ko.prefs.setBooleanPref('pref_places_showFileIcons', true);
        tree.classList.remove("hideIcons");
    }

    var boxOb = tree.boxObject.QueryInterface(Components.interfaces.nsITreeBoxObject)
    boxOb.clearStyleAndImageCaches();
    boxOb.invalidate();
}

PlacesController.prototype.is_cmd_places_singleClickExpand_enabled = function() {
    if (ko.prefs.getBoolean('pref_places_singleClickExpand', false)) {
        document.getElementById('places_singleClickExpand').setAttribute('checked', 'true');
    }

    return true;
}

PlacesController.prototype.do_cmd_places_singleClickExpand = function() {
    var value = ko.prefs.getBoolean('pref_places_singleClickExpand', false);

    if (value) {
        ko.prefs.setBooleanPref('pref_places_singleClickExpand', false);
    }
    else
    {
        ko.prefs.setBooleanPref('pref_places_singleClickExpand', true);
    }
}

// Add SCC controller items

PlacesController.prototype.is_cmd_placeView_undoTreeOperation_enabled = function() {
    return ko.places.manager.can_undoTreeOperation();
}

PlacesController.prototype.do_cmd_placeView_undoTreeOperation = function() {
    if (!this.is_cmd_placeView_undoTreeOperation_enabled()) {
        this.log.debug("do_cmd_placeView_undoTreeOperation: invoked, but not enabled");
        return;
    }
    ko.places.manager.undoTreeOperation();
}

PlacesController.prototype.is_cmd_placeView_sortNatural_enabled = function() {
    return true;
}

PlacesController.prototype.do_cmd_placeView_sortNatural = function() {
    ko.places.manager.sortNatural();
}

PlacesController.prototype.is_cmd_placeView_sortAscending_enabled = function() {
    return true;
}

PlacesController.prototype.do_cmd_placeView_sortAscending = function() {
    ko.places.manager.sortAscending();
}

PlacesController.prototype.is_cmd_placeView_sortDescending_enabled = function() {
    return true;
}

PlacesController.prototype.do_cmd_placeView_sortDescending = function() {
    ko.places.manager.sortDescending();
}

PlacesController.prototype.is_cmd_placeView_showCurrent_TabInPlaces_enabled = function() {
    var view = ko.views.manager.currentView;
    return (view
            && view.getAttribute('type') == 'editor'
            && view.koDoc
            && view.koDoc.file);
}

PlacesController.prototype.do_cmd_placeView_showCurrent_TabInPlaces = function() {
    ko.places.manager.showCurrentEditorTab(/*forceNewPlaceDir=*/ true);
}

PlacesController.prototype._haveProjects = function() {
    try {
        var obj = ko.places;
        if (!obj) return False;
        obj = obj.projects;
        if (!obj) return False;
        obj = obj.projectsTreeView;
        if (!obj) return False;
        return obj.rowCount > 0;
    } catch(ex) {
        // ko.places.projects.projectsTreeView might not be defined yet.
        return false;
    }
};

PlacesController.prototype.is_cmd_sortProjectsDescending_enabled = function() {
    return this._haveProjects();
}

PlacesController.prototype.do_cmd_sortProjectsDescending = function() {
    if (this._haveProjects()) {
        var mgr = ko.places.projects.manager;
        mgr.sortProjects(mgr.sortDescending);
    }
}

PlacesController.prototype.is_cmd_sortProjectsAscending_enabled = function() {
    return this._haveProjects();
}

PlacesController.prototype.do_cmd_sortProjectsAscending = function() {
    if (this._haveProjects()) {
        var mgr = ko.places.projects.manager;
        mgr.sortProjects(mgr.sortAscending);
    }
}
          
PlacesController.prototype.supportsCommand = function(command) {
    return ("is_" + command + "_enabled") in this;
};
          
PlacesController.prototype.isCommandEnabled = function(command) {
    return this["is_" + command + "_enabled"]();
};
    
PlacesController.prototype.doCommand = function(command) {
    return this["do_" + command]();
};
    

this.PlacesController = PlacesController;  // expose thru this namespace.

var controller = new PlacesController();

function PlacesSCC_Controller() {
    this.log = ko.logging.getLogger("PlacesSCCController");
    this.log.setLevel(ko.logging.LOG_DEBUG);
    this.commands = ['cmd_SCCedit', 'cmd_SCCadd', 'cmd_SCCremove', 'cmd_SCCupdate', 'cmd_SCCcommit', 'cmd_SCCdiff', 'cmd_SCChistory', 'cmd_SCCrevert', 'cmd_SCCcheckout', 'cmd_SCCpull', 'cmd_SCCpullRebase', 'cmd_SCCclone'];
    var this_ = this;
    var em = ko.projects.extensionManager;
    this.commands.forEach(function(cmd) { 
            em.registerCommand(cmd, this_);
        });
};

PlacesSCC_Controller.prototype.supportsCommand = function(command) {
    return (this.commands.indexOf(command) != -1
            && ko.projects.SCC.supportsCommand(command));
};

PlacesSCC_Controller.prototype.isCommandEnabled = function(command) {
    return this.supportsCommand(command);
};

PlacesSCC_Controller.prototype.doCommand = function(command) {
    return ko.projects.SCC.doCommand(command);
};
var placesController = new PlacesController();
var places_SCC_Controller = new PlacesSCC_Controller();

/*
  The places controller is given a higher priority in order to override common
  commands like 'cmd_copy' and 'cmd_paste', when focus is on the places tree.
 */
 window.addEventListener("load", function() {
 try {
document.getElementById("places-files-tree").controllers.insertControllerAt(0, controller);
document.getElementById("placesSubpanelProjects_MPV").controllers.insertControllerAt(0, places_SCC_Controller);
document.getElementById("placesSubpanelProjects_SPV").controllers.insertControllerAt(0, places_SCC_Controller);
 } catch(ex) {
     this.log.error("Failed to set a places controller: " + ex + "\n");
 }
     }, true);

}).apply(ko.places);
