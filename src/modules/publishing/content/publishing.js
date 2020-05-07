/* Copyright (c) 2010 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* Publishing API.
 *
 * Provides useful methods and functions relating to publishing.
 */

ko.publishing = {};

(function() {

    XPCOMUtils.defineLazyGetter(Services, "koPublishingSvc", () =>
        Cc["@activestate.com/koPublishingService;1"].
        getService(Ci.koIPublishingService));

    var _publishing_configs = null;
    
    this.getConfigurations = function ko_pub_getConfigurations()
    {
        if (!_publishing_configs) {
            var settingsObj = {};
            Services.koPublishingSvc.getPublishingSettings({}, settingsObj);
            _publishing_configs = settingsObj.value;
        }
        return _publishing_configs;
    };

    this.saveConfigurations = function ko_pub_saveConfigurations(configs)
    {
        Services.koPublishingSvc.savePublishingSettings(configs.length, configs);
        // Drop the local publishing configs, as we need to re-fetch from
        // publishing service in order to have them properly sorted.
        _publishing_configs = null;
    };

    this.newConfiguration = function ko_pub_newConfiguration()
    {
        var args = {
            "type": "new"
        };
        ko.windowManager.openDialog('chrome://publishing/content/publish-dialog.xul',
                                    '_blank',
                                    'chrome,titlebar,resizable=yes',
                                    args);
    };

    this.synchronize = function ko_pub_synchronize(id)
    {
        var settings = null;
        var configs = ko.publishing.getConfigurations();
        for (var i=0; i < configs.length; i++) {
            if (configs[i].id == id) {
                settings = configs[i];
                break;
            }
        }
        var args = {
            "type": "synchronize",
            "settings": settings
        };
        ko.windowManager.openDialog('chrome://publishing/content/publish-dialog.xul',
                                    '_blank',
                                    'chrome,titlebar,resizable=yes',
                                    args);
    };

    this.onMenuPopupShowing = function ko_pub_onMenuPopupShowing()
    {
        var menupopup = document.getElementById("tools_publishing_menupopup");
            
        var separator = menupopup.getElementsByAttribute("id", "tools_publishing_newconfig_separator")[0];
        var nextSibling;
        var menuitem = separator.nextSibling;
        // Remove any existing menu items added previously.
        while (menuitem) {
            nextSibling = menuitem.nextSibling;
            if (menuitem.hasAttribute("dynamically_added_menuitem")) {
                menupopup.removeChild(menuitem);
            }
            menuitem = nextSibling;
        }
        var attributes;
        var configs = this.getConfigurations();
        for (var i=0; i < configs.length; i++) {
            attributes = {
                "label": "Publish " + configs[i].name,
                "oncommand": "ko.publishing.synchronize('" + configs[i].id + "')",
                "dynamically_added_menuitem": "true"
            }
            menuitem = xtk.domutils.newElement("menuitem", attributes);
            menupopup.appendChild(menuitem);
        }
    };

    this.onPlacesPopupShowing = function ko_pub_onPlacesPopupShowing(menupopup)
    {
        var enableMenus = false;
        var koFileExes = ko.places.manager.getSelectedFiles();
        for (var i=0; i < koFileExes.length; i++) {
            if (koFileExes[i].publishingStatus) {
                enableMenus = true;
                break;
            }
        }
        for (var i=0; i < menupopup.childNodes.length; i++) {
            if (enableMenus) {
                menupopup.childNodes[i].removeAttribute("disabled");
            } else {
                menupopup.childNodes[i].setAttribute("disabled", "true");
            }
        }
    };

        /**
         * Return the first publishing settings that match the given URI.
         * 
         * @param {string} uri - The file uri to match.
         * @returns {Components.interfaces.koIPublishingSettings}
         */
    this.getSettingsForUri = function ko_pub_getSettingsForUri(uri) {
        var configs = ko.publishing.getConfigurations();
        for (var i=0; i < configs.length; i++) {
            if (configs[i].matchesUri(uri)) {
                return configs[i];
            }
        }
        return null;
    };

        /**
         * Launches the diff dialog showing the file changes between the uris
         * and their corresponding local/remote publishing uris.
         *
         * @param {array} uris - The list of local or remote publishing uris.
         */
    this.diffURIs = function ko_pub_diffCurrentFile(uris) {
        var diffSvc = Components.classes["@activestate.com/koDiffService;1"].
                        getService(Components.interfaces.koIDiffService);
        var uri;
        var left_uris = [];
        var right_uris = [];

        for (var i=0; i < uris.length; i++) {
            uri = uris[i];
            var config = ko.publishing.getSettingsForUri(uri);
            if (!config) {
                continue;
            }
    
            var leftURI;
            var rightURI = uri;
    
            if (rightURI.substr(0, 5) == "file:") {
                // It's the local URI, work out the remote uri.
                leftURI = config.remote_uri + rightURI.substr(config.local_uri.length);
            } else {
                leftURI = config.local_uri + rightURI.substr(config.remote_uri.length);
            }
            left_uris.push(leftURI);
            right_uris.push(rightURI);
        }
        if (!left_uris) {
            var message = "No publishing configs found for any of: " + uris;
            require("notify/notify").send(msg, "publishing");
            return;
        }

        var diffContent = diffSvc.diffMultipleURIs(left_uris, left_uris.length,
                                                   right_uris, right_uris.length);
        var title = "Publishing Diff";
        ko.launch.diff(diffContent, title);
    }

    /**
     * Push the given uri.
     *
     * @param {String} uri
     */
    this.push = function publishing_push(uri) {
        // Implement the koIRemoteTransferCallback interface.
        var asyncHandler = {
            "callback": function(result, message) {
                if (result != Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
                    //Moved all of the below to the Python code in koPublishin which is where state should be
                    //maintained, ie. the controller.
                    /*if (message.substr(0, 9) == "Conflict:") {
                        var fileSvc = Components.classes["@activestate.com/koFileService;1"].
                                        getService(Components.interfaces.koIFileService);
                        var koFileEx = fileSvc.getFileFromURI(uri);
                        koFileEx.publishingStatus = Components.interfaces.koISynchronizationCallback.SYNC_CONFLICT_BOTH_MODIFIED;
                        Services.obs.notifyObservers(null, "file_status", koFileEx.URI);
                        
                         
                    }*/
                    require("notify/notify").send(message, "publishing", {priority: "warning"});
                } else {
                    if (message)
                        require("notify/notify").send(message, "publishing");
                }
            },
            "onProgress": this.onProgress,
            "notifyFileTransferStarting": this.transferUpStarting,
            "notifyFileTransferCompleted": this.transferUpComplete,
            "notifyFileTransferFailed": this.transferUpFailed,
        };
        Services.koPublishingSvc.pushLocalUri(uri, asyncHandler);
    };
    
    /**
     * Force Push the given uri.  Will overwrite changed remote
     *
     * @param {String} uri
     */
    this.forcePush = function publishing_forcePush(uri){
         // Implement the koIRemoteTransferCallback interface.
        var asyncHandler = {
            "callback": function(result, message) {
                if (result != Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
                    if ( ! message)
                        message = "Force push failed";
                    require("notify/notify").send(message, "publishing", {priority: "warning"});
                } else {
                    if (message)
                        require("notify/notify").send(message + " " + uri, "publishing");
                }
            },
            "onProgress": this.onProgress,
            "notifyFileTransferStarting": this.transferUpStarting,
            "notifyFileTransferCompleted": this.transferUpComplete,
            "notifyFileTransferFailed": this.transferUpFailed,
        };
        Services.koPublishingSvc.pushLocalUri(uri, asyncHandler, true);
    };
    
    /**
     * Pull the given uri.
     *
     * @param {String} uri
     */
    this.pullFile = function publishing_pullFile(uri) {
        // Implement the koIRemoteTransferCallback interface.
        var asyncHandler = {
            "callback": function(result, message) {
                if (result != Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
                    // XXX this should be checking CallBack result number
                    if (message.substr(0, 9) == "Conflict:") {
                        var fileSvc = Components.classes["@activestate.com/koFileService;1"].
                                        getService(Components.interfaces.koIFileService);
                        var koFileEx = fileSvc.getFileFromURI(uri);
                        koFileEx.publishingStatus = Components.interfaces.koISynchronizationCallback.SYNC_CONFLICT_BOTH_MODIFIED;
                        Services.obs.notifyObservers(null, "file_status", koFileEx.URI);
                    }
                    require("notify/notify").send(message, "publishing", {priority: "warning"});
                } else {
                    if (message)
                        require("notify/notify").send(message, "publishing");
                }
                
                ko.window.checkDiskFiles();
            },
            "onProgress": this.onProgress,
            "notifyFileTransferStarting": this.transferDownStarting,
            "notifyFileTransferCompleted": this.transferDownComplete,
            "notifyFileTransferFailed": this.transferDownFailed,
        }
        Services.koPublishingSvc.pullUri(uri, asyncHandler);
    }
    
    /**
     * Force Pull the given uri.  Will overwrite changed local
     *
     * @param {String} uri
     */
    this.forcePullFile = function publishing_forcePullFile(uri){
         // Implement the koIRemoteTransferCallback interface.
        var asyncHandler = {
            "callback": function(result, message) {
                if (result != Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
                    if ( ! message)
                        message = "Force pull failed";
                    require("notify/notify").send(message, "publishing", {priority: "warning"});
                } else {
                    if (message)
                        require("notify/notify").send(message, "publishing");
                }
                
                ko.window.checkDiskFiles();
            },
            "onProgress": this.onProgress,
            "notifyFileTransferStarting": this.transferDownStarting,
            "notifyFileTransferCompleted": this.transferDownComplete,
            "notifyFileTransferFailed": this.transferDownFailed,
        };
        Services.koPublishingSvc.pullUri(uri, asyncHandler, true);
    };

     this.onProgress = (message, value) =>
    {
        console.log("message: "+message);
        console.log("value: "+value);
    };
    
    var relativePath = (from, to) =>
    {
        return ko.uriparse.relativePath(ko.uriparse.URIToPath(from), ko.uriparse.URIToPath(to));
    };
    // Upload progress callbacks
    this.transferUpStarting = (local_uri, remote_uri) => {require("notify/notify").send("Starting upload of '"+relativePath(ko.places.getDirectory(), local_uri)+"'","Publishing");};
    this.transferUpComplete = (local_uri, remote_uri) => { require("notify/notify").send("Upload of '"+relativePath(ko.places.getDirectory(), local_uri)+"' completed","Publishing");};
    this.transferUpFailed = (local_uri, remote_uri, message) => { require("notify/notify").send("Upload of '"+relativePath(ko.places.getDirectory(), local_uri)+"' failed: "+message,"Publishing", {"priority":"error"}); };
    // Download progress callbacks
    this.transferDownStarting = (local_uri, remote_uri) => {require("notify/notify").send("Starting download of '"+remote_uri+"'","Publishing");};
    this.transferDownComplete = (local_uri, remote_uri) => { require("notify/notify").send("Download of '"+remote_uri+"' completed","Publishing"); };
    this.transferDownFailed = (local_uri, remote_uri, message) => { require("notify/notify").send("Download of '"+remote_uri+"' failed: "+message,"Publishing", {"priority":"error"}); };


    /************************************************************
     *         Controller for the publishing commands           *
     ************************************************************/

    function PublishingController() {
        ko.main.addWillCloseHandler((function() {
            window.controllers.removeController(this);
        }).bind(this));
    }
    PublishingController.prototype = new xtk.Controller();
    PublishingController.prototype.constructor = PublishingController;

    // Diff the current file.
    PublishingController.prototype.is_cmd_publishingDiffCurrentFile_enabled = function () {
        var view = ko.views.manager.currentView;
        var file = (view && view.koDoc && view.koDoc.file) || null;
        return file && file.publishingStatus;
    };
    PublishingController.prototype.do_cmd_publishingDiffCurrentFile = function () {
        var view = ko.views.manager.currentView;
        var file = (view && view.koDoc && view.koDoc.file) || null;
        if (!file) {
            var msg = "The current view does not reference a file";
            require("notify/notify").interact(msg, "publishing");
            return;
        }
        ko.publishing.diffURIs([file.URI]);
    };

    // Open Dialog
    PublishingController.prototype.is_cmd_publishingOpenDialog_enabled = function () {
        var view = ko.views.manager.currentView;
        var file = (view && view.koDoc && view.koDoc.file) || null;
        var settings;
        if (file && ko.publishing.getSettingsForUri(file.URI))
            return true;
        
        // Places is not ready
        if ( ! ko.places || ! ko.places.getDirectory)
            return false;
        
        return !! ko.publishing.getSettingsForUri(ko.places.getDirectory());
    };
    PublishingController.prototype.do_cmd_publishingOpenDialog = function () {
        var view = ko.views.manager.currentView;
        var file = (view && view.koDoc && view.koDoc.file) || null;
        var settings;
        if (file) 
            settings = ko.publishing.getSettingsForUri(file.URI);
        
        if ( ! settings)
            settings = ko.publishing.getSettingsForUri(ko.places.getDirectory());
            
        if ( ! settings) return;
        
        ko.publishing.synchronize(settings.id);
    };
    
/****PUSH CURRENT FILE*****/
    // Push the current file.
    PublishingController.prototype.is_cmd_publishingPushCurrentFile_enabled = function () {
        var view = ko.views.manager.currentView;
        var file = (view && view.koDoc && view.koDoc.file) || null;
        return file && file.publishingStatus;
    };
    PublishingController.prototype.do_cmd_publishingPushCurrentFile = function () {
        var view = ko.views.manager.currentView;
        /** @type {Components.interfaces.koIFileEx} */
        var file = (view && view.koDoc && view.koDoc.file) || null;
        ko.publishing.push(file.URI);
    };
    
        // Force Push the current file.
    PublishingController.prototype.is_cmd_publishingForcePushCurrentFile_enabled = function () {
        var view = ko.views.manager.currentView;
        var file = (view && view.koDoc && view.koDoc.file) || null;
        return file && file.publishingStatus;
    };
    PublishingController.prototype.do_cmd_publishingForcePushCurrentFile = function () {
         var message = "Force push current file will overwrite the remote files " +
        "content even if the remote file has changed.  Loss of data is possible.  " +
        "Are you sure you want to proceed?";
        
        if (require("ko/dialogs").confirm(message, {"doNotAskPref":"publishin_confirmedForce"}))
        {
            var view = ko.views.manager.currentView;
            /** @type {Components.interfaces.koIFileEx} */
            var file = (view && view.koDoc && view.koDoc.file) || null;
            ko.publishing.forcePush(file.URI);
        }
    };
/*****END CURRENT FILE PUSH******/

/*****PULL CURRENT FILE*******/
        // Push the current file.
    PublishingController.prototype.is_cmd_publishingPullCurrentFile_enabled = function () {
        var view = ko.views.manager.currentView;
        var file = (view && view.koDoc && view.koDoc.file) || null;
        return file && file.publishingStatus;
    };
    PublishingController.prototype.do_cmd_publishingPullCurrentFile = function () {
        var view = ko.views.manager.currentView;
        /** @type {Components.interfaces.koIFileEx} */
        var file = (view && view.koDoc && view.koDoc.file) || null;
        ko.publishing.pullFile(file.URI);
    };
    
        // Force Push the current file.
    PublishingController.prototype.is_cmd_publishingForcePullCurrentFile_enabled = function () {
        var view = ko.views.manager.currentView;
        var file = (view && view.koDoc && view.koDoc.file) || null;
        return file && file.publishingStatus;
    };
    PublishingController.prototype.do_cmd_publishingForcePullCurrentFile = function () {
        var message = "Force pull current file will overwrite the local files " +
            "content even if the local file has changed.  " +
            "Are you sure you want to proceed?";
        
        if (require("ko/dialogs").confirm(message, {"doNotAskPref":"publishin_confirmedForce"}))
        {
            var view = ko.views.manager.currentView;
            /** @type {Components.interfaces.koIFileEx} */
            var file = (view && view.koDoc && view.koDoc.file) || null;
            ko.publishing.forcePullFile(file.URI);
        }
    };
/*****END CURRENT FILE PULL*****/


    // Create new configuration.
    PublishingController.prototype.is_cmd_publishingNewConfiguration_enabled = function () {
        return true;
    };
    PublishingController.prototype.do_cmd_publishingNewConfiguration = function () {
        ko.publishing.newConfiguration();
    };

    // Diff the places file(s).
    PublishingController.prototype.is_cmd_publishingPlacesDiffFile_enabled = function () {
        return true;
    };
    PublishingController.prototype.do_cmd_publishingPlacesDiffFile = function () {
        var uris = ko.places.manager.getSelectedUris();
        if (!uris.length) {
            return;
        }
        ko.publishing.diffURIs(uris);
    };

    /**
     * Force Push file no matter what.  This will overwrite a changed remote.
     *
     */
    PublishingController.prototype.is_cmd_publishingPlacesForcePushFile_enabled = function () {
        const fileChanged = Ci.koISynchronizationCallback.SYNC_LOCAL_FILE_MODIFIED;
        const fileAdded = Ci.koISynchronizationCallback.SYNC_LOCAL_FILE_ADDED;
        var selectedFiles = ko.places.manage.getSelectedFiles();
        for (let i in selectedFiles)
        {
            if(selectedFiles[i].publishingStatus == fileChanged ||
               selectedFiles[i].publishingStatus == fileAdded)
            {
                return true;
            }
        }
        return false;
    };
    PublishingController.prototype.do_cmd_publishingPlacesForcePushFile = function () {
        const fileChanged = Ci.koISynchronizationCallback.SYNC_LOCAL_FILE_MODIFIED;
        const fileAdded = Ci.koISynchronizationCallback.SYNC_LOCAL_FILE_ADDED;
        
        var message = "Force pushing all selected files. This will overwrite " +
        "all associated remote files.  This could result in lost data on the " +
        "remote machine.  Are you sure you want to proceed?";
        
        if (require("ko/dialogs").confirm(message, {"doNotAskPref":"publishin_confirmedForce"}))
        {
            var files = ko.places.manager.getSelectedFiles();
            if (!files.length) {
                return;
            }
            // Only push files that need to be pushed.  No sense in pushing
            // unchanged files.
            for (var i=0; i < files.length; i++) {
                if(files[i].publishingStatus == fileChanged ||
                   files[i].publishingStatus == fileAdded )
                {
                     ko.publishing.forcePush(files[i].URI);
                }
            }
        }
    };

    // Push the places file(s).
    PublishingController.prototype.is_cmd_publishingPlacesPushFile_enabled = function () {
        return true;
    };
    PublishingController.prototype.do_cmd_publishingPlacesPushFile = function () {
        var uris = ko.places.manager.getSelectedUris();
        if (!uris.length) {
            return;
        }
        for (var i=0; i < uris.length; i++) {
            ko.publishing.push(uris[i]);
        }
    };
    
    // Pull the places file(s).
    PublishingController.prototype.is_cmd_publishingPlacesPullFile_enabled = function () {
        return true;
    };
    PublishingController.prototype.do_cmd_publishingPlacesPullFile = function () {
        var uris = ko.places.manager.getSelectedUris();
        if (!uris.length) {
            return;
        }
        for (var i=0; i < uris.length; i++) {
            ko.publishing.pullFile(uris[i]);
        }
    };

    /**
     * Force Pull file no matter what.  This will overwrite the local with the
     * remote file
     *
     */
    PublishingController.prototype.is_cmd_publishingPlacesForcePullFile_enabled = function () {
        // Not going to bother disabling this as it would require creating a
        // remote connect.  The backend will just notify that nothing happened.
        return true;
    };
    PublishingController.prototype.do_cmd_publishingPlacesForcePullFile = function () {
        var message = "Force pulling all selected files. This will overwrite " +
        "all local files with the remote if the remote has changed.  This could " +
        "result in lost local data.  Are you sure you want to proceed?";
        
        if (require("ko/dialogs").confirm(message, {"doNotAskPref":"publishin_confirmedForce"}))
        {
            var uris = ko.places.manager.getSelectedUris();
            if (!uris.length) {
                return;
            }
            for (var i=0; i < uris.length; i++) {
                ko.publishing.forcePullFile(uris[i]);
            }
        }
    };

    /************************************************************
     *         Observer for catching configuration changes      *
     ************************************************************/

    this.observe = function ko_pub_observer(subject, topic, data) {
        if (topic == "publishing_configurations_changed") {
            _publishing_configs = null;
        }
    };

    this.initialize = function ko_pub_initialize() {
        // Controller instance on the current window to handle profiler commands.
        var pubController = new PublishingController();
        window.controllers.appendController(pubController);
        // Listen for pref changes.
        Services.obs.addObserver(ko.publishing, "publishing_configurations_changed", false);
    }

}).apply(ko.publishing);

window.addEventListener("komodo-ui-started", ko.publishing.initialize);
