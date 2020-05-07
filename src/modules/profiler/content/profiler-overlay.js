/* Copyright (c) 2000-2009 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

if (typeof(ko) == 'undefined') {
    ko = {};
}
if (typeof(ko.profiler) == 'undefined') {
    ko.profiler = {};
}

/* Create the ko.profiler scope. */
(function() {

    /************************************************************
     *         Local (hidden) variables and functions           *
     ************************************************************/

    var INVOKE_PROFILE = Components.interfaces.koIInvocation.INVOKE_PROFILE;

    /**
     * Open the profiler dialog with the given profile file.
     * @param {string} profile_fileuri - (Optional) The URI of the file to open.
     * @param {string} profile_data - (Optional) The profiling data to open with.
     * @param {string} base64format - (Optional) If the data is in base64 format.
     */
    var open_profiler_dialog = function(profile_fileuri, profile_data, base64format) {
        var args = {};
        if (profile_fileuri) {
            args.profile_fileuri = profile_fileuri;
        }
        if (profile_data) {
            args.profile_data = profile_data;
        }
        if (base64format) {
            args.base64format = base64format;
        }
        ko.windowManager.openDialog(
            "chrome://profiler/content/profiler.xul",
            "",
            "chrome,resizable=yes,close=yes",
            args);
    }

    /**
     * Add/remove observer for watching debugger invocations.
     */
    var notification_observer = {
        /**
         * @param subject {Components.interfaces.koIInvocation}
         */
        observe: function profiler_notification_observer(subject, topic, data) {
            if (ko.windowManager.getMainWindow() != window) {
                // This check is needed to avoid opening a new profiler dialog
                // for every Window.
                //dump("observe -- not in current window\n");
                return;
            }
            if (topic == 'debugger_code_profiling_data' ||
                topic == 'debugger_code_profiling_data_base64') {
                // We get this from remote code profiling - when the app finishes.
                var session = subject.QueryInterface(Components.interfaces.koIDBGPSession);
                // If a session.cookie exists - it's using local code profiling,
                // and we just accept it without prompting.
                if (!session.cookie) {
                    if (ko.dialogs.yesNo("A remote application has requested to show " +
                                         "a code profiling result, would you like to " +
                                         "open it?", // prompt
                                         "Yes", // response
                                         null, // text
                                         "Remote Profiling Request", // title
                                         'allow_remote_profiling') != "Yes") {
                        return;
                    }
                }
                open_profiler_dialog(null, data, topic == 'debugger_code_profiling_data_base64');
            }
        }
    };

    /************************************************************
     *         Controller for the profiler commands             *
     ************************************************************/

    function ProfilerController() {
    }
    ProfilerController.prototype = new xtk.Controller();
    ProfilerController.prototype.constructor = ProfilerController;

    ProfilerController.prototype.is_cmd_openProfiler_enabled = function () {
        return true;
    };
    ProfilerController.prototype.do_cmd_openProfiler = function () {
        ko.profiler.openProfiler();
    };

    ProfilerController.prototype.is_cmd_startProfiling_enabled = function () {
        var v = ko.views.manager.currentView;
        return (!ko.dbg.manager.currentSession || ko.dbg.manager.currentSession.isInteractive) &&
                v && v.getAttribute('type') == 'editor' &&
                v.koDoc && v.koDoc.file && v.koDoc.file.isLocal;
    };
    ProfilerController.prototype.do_cmd_startProfiling = function () {
        ko.profiler.startProfiling();
    };

    /************************************************************
     *        Exposed public functions                          *
     ************************************************************/

    this.openProfiler = function koprofiler_openProfiler() {
        open_profiler_dialog();
    }

    this.startProfiling = function koprofiler_startProfiling() {
        open_profiler_dialog();
    }
    
    this.openSavedProfile = function koprofiler_openSaveProfile(){
        var prefName = "profiler.openFile";
        var default_dir = ko.filepicker.internDefaultDir(prefName);
        var filepath = ko.filepicker.browseForFile();
        open_profiler_dialog(filepath);
    }

    this.initialize = function koprofiler_initialize() {
        var observerSvc = Components.classes['@mozilla.org/observer-service;1'].
                   getService(Components.interfaces.nsIObserverService);
        observerSvc.addObserver(notification_observer, "debugger_code_profiling_data", false);
        observerSvc.addObserver(notification_observer, "debugger_code_profiling_data_base64", false);

        var profiler_window_unload = function profiler_window_unload() {
            observerSvc.removeObserver(notification_observer, "debugger_code_profiling_data", false);
            observerSvc.removeObserver(notification_observer, "debugger_code_profiling_data_base64", false);
        };
        ko.main.addWillCloseHandler(profiler_window_unload);

        // Controller instance on the current window to handle profiler commands.
        window.controllers.appendController(new ProfilerController());
    }

}).apply(ko.profiler);

window.addEventListener("komodo-ui-started", ko.profiler.initialize);
