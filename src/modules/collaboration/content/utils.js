ko.collaboration.utils = {};

/**
 * File picker that allows passing in a callback that fires when one of the
 * selected files has been opened.
 */
ko.collaboration.utils.filePickerWithCallback = function(callback, viewType) {
    var defaultDir = null;
    var v = ko.views.manager.currentView;
    if (v && v.getAttribute("type") == "editor" && v.koDoc && !v.koDoc.isUntitled && v.koDoc.file.isLocal) {
        defaultDir = ko.views.manager.currentView.koDoc.file.dirName;
    }
    var paths = ko.filepicker.browseForFiles(defaultDir);
    if (paths == null) {
        return;
    }
    ko.collaboration.utils.openMultipleURIsWithCallback(paths, viewType, callback);
    if (ko.views.manager.currentView) {
        window.setTimeout("ko.views.manager.currentView.setFocus();", 1);
    }
}

ko.collaboration.utils.openMultipleURIsWithCallback = function(urls, viewType, callback) {
    var i, j;
    if (urls.length) {
        var prefSvc = Components.classes["@activestate.com/koPrefService;1"].getService(Components.interfaces.koIPrefService);
        var viewStateMRU = prefSvc.getPrefs("viewStateMRU");
        var projectFiles = [];
        var projectViewState, file_url;
        for (i = 0; i < urls.length; i++) {
            if (viewStateMRU.hasPref(urls[i])) {
                projectViewState = viewStateMRU.getPref(urls[i]);
                if (projectViewState.hasPref("opened_files")) {
                    var opened_files = projectViewState.getPref("opened_files");
                    if (opened_files.length > 0) {
                        for (j = 0; j < opened_files.length; j++) {
                            file_url = opened_files.getStringPref(j);
                            projectFiles.push(file_url);
                        }
                    }
                }
            }
        }
        var action;
        if (projectFiles.length > 0) {
            action = ko.dialogs.yesNoCancel(_viewsBundle.GetStringFromName("reopenProjectFilesPrompt"), "Yes", null, null, "open_recent_files_on_project_open");
            if (action == "Cancel") {
                return;
            }
            if (action == "Yes") {
                urls = urls.concat(projectFiles);
            }
        }
        if (urls.length > 1) {
            ko.views.manager.batchMode = true;
        }
        for (i = 0; i < urls.length; i++) {
            if (i == urls.length - 1) {
                ko.views.manager.batchMode = false;
            }
            ko.open.URI(urls[i], viewType, true, callback);
        }
    }
};

ko.collaboration.utils.eOLDetect = function(view) {
    var eol = view.scimoz.eOLMode
    if (view.scimoz.eOLMode != view.scimoz.SC_EOL_LF) {
        let eolModeStr = (eol == view.scimoz.SC_EOL_CRLF) ?
                         "Windows line endings ('\\r\\n')" :
                         "Mac classic line endings ('\\r')"
        let prompt = "Collaboration requires UNIX line endings ('\\n'). " +
                     "This file uses " + eolModeStr + ". Komodo  needs to " +
                     "convert this file to UNIX line endings. Proceed?"
        let title = "Collaboration"
        let doNotAskPref = "Collaboration.lineEndingsWarning";
        let bPref = "donotask_" + doNotAskPref;
        if (!ko.prefs.hasBooleanPref(bPref))
            ko.prefs.setBooleanPref(bPref, false);
        let response = ko.dialogs.okCancel(prompt, null, null, title, doNotAskPref);
        if (response === "OK") {
            ko.collaboration.utils.eOLConvert(view);
            return true;
        } else {
            return false;
        }
    }
    return true;
};

ko.collaboration.utils.eOLConvert = function(view) {
    // This will change the file preferences to use LF for new line endings.
    // It also converts all existing line endings to LF.
    view.koDoc.new_line_endings = view.koDoc.EOL_LF;
    view.prefs.setStringPref('endOfLine', 'LF');
    view.koDoc.existing_line_endings = view.koDoc.EOL_LF;
};

ko.collaboration.utils.bind = function(method, scope) {
    return function() {
        return method.apply(scope, arguments);
    }
};