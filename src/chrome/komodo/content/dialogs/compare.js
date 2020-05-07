/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* Ask the user for two file to compare. */

var log = ko.logging.getLogger("dialogs.compare");
//log.setLevel(ko.logging.LOG_DEBUG);
var gCWD = null;
var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
    .getService(Components.interfaces.nsIStringBundleService)
    .createBundle("chrome://komodo/locale/dialogs/compare.properties");

//---- interface routines for XUL

function OnLoad()
{
    try {
        var dialog = document.getElementById("dialog-compare");
        var okButton = dialog.getButton("accept");
        okButton.setAttribute("accesskey", _bundle.GetStringFromName("compareFunction.accesskey"));
        okButton.setAttribute("label", _bundle.GetStringFromName("compareFiles.label"));
        okButton.setAttribute("disabled", "true");
        var first = document.getElementById('first')
        var second = document.getElementById('second');
        document.title = _bundle.GetStringFromName("compareTwoFiles.title");

        if (opener.ko.views.manager &&
            opener.ko.views.manager.currentView &&
            opener.ko.views.manager.currentView.getAttribute('type') == 'editor' &&
            ! opener.ko.views.manager.currentView.koDoc.isUntitled) {
            first.value = opener.ko.views.manager.currentView.koDoc.displayPath;

            let otherView = opener.ko.views.manager.currentView.alternateViewList.currentView;
            if (otherView && otherView.getAttribute('type') === 'editor' && ! otherView.koDoc.isUntitled) {
                let otherFile = otherView.koDoc.displayPath;
                if (otherFile !== first.value) {
                    second.value = otherFile;
                }
            }

            gCWD = opener.ko.window.getCwd();
            first.searchParam = ko.stringutils.updateSubAttr(
                first.searchParam, "cwd", gCWD);
            second.searchParam = ko.stringutils.updateSubAttr(
                second.searchParam, "cwd", gCWD);
            second.focus();
        } else {
            // Prefill the two entries with the last used ones.
            var prefName = ko.stringutils.getSubAttr(first.searchParam, "mru");
            first.value = ko.mru.get(prefName);
            prefName = ko.stringutils.getSubAttr(second.searchParam, "mru");
            second.value = ko.mru.get(prefName);
            first.focus();
        }
        updateOK();

        window.sizeToContent();
        if (opener.innerHeight == 0) { // indicator that opener hasn't loaded yet
            dialog.centerWindowOnScreen();
        } else {
            dialog.moveToAlertPosition(); // requires a loaded opener
        }
    } catch (e) {
        log.exception(e);
    }
}

function choose(which)
{
    var textbox = document.getElementById(which);
    var prefName = "compare.choose." + which;
    var default_dir = textbox.value;
    if (default_dir) {
        var osPathSvc = Components.classes["@activestate.com/koOsPath;1"].
            getService(Components.interfaces.koIOsPath);
        default_dir = osPathSvc.dirname(default_dir);
        if (!osPathSvc.isdir(default_dir) || !osPathSvc.exists(default_dir)) {
            default_dir = null;
        }
    }
    if (!default_dir) {
        default_dir = ko.filepicker.internDefaultDir(prefName);
    }
    var file = ko.filepicker.browseForFile(default_dir, null, _bundle.formatStringFromName("pleaseSelectFile.message", [which], 1));
    if (!file) return;
    ko.filepicker.updateDefaultDirFromPath(prefName, file);
    document.getElementById(which).value = file;
    updateOK();
}

function updateOK()
{
    var ok = document.getElementById('first').value && document.getElementById('second').value;
    var dialog = document.getElementById("dialog-compare");
    var okButton = dialog.getButton("accept");
    if (ok) {
        if (okButton.hasAttribute('disabled')) {
            okButton.removeAttribute('disabled')
        }
    } else {
        okButton.setAttribute('disabled', 'true');
    }
}

function OK()
{
    try {
        var first = document.getElementById('first');
        var second = document.getElementById('second');
        var firstPath = first.value; 
        var secondPath = second.value;

        // If one or both of the files are remote, we need to open the files to
        // get the correct status for the files. Also, ensure that local file
        // paths are absolute (using gCWD if necessary).
        var fileSvc = Components.classes["@activestate.com/koFileService;1"]
            .getService(Components.interfaces.koIFileService)
        var osPathSvc = Components.classes["@activestate.com/koOsPath;1"]
            .getService(Components.interfaces.koIOsPath)
        var file1 = fileSvc.getFileFromURI(firstPath)
        if (!file1.isLocal) {
            file1.open('rb');
        } else if (!osPathSvc.isabs(firstPath)) {
            firstPath = osPathSvc.join(gCWD, firstPath);
            file1 = fileSvc.getFileFromURI(firstPath);
        }
        var file2 = fileSvc.getFileFromURI(secondPath)
        if (!file2.isLocal) {
            file2.open('rb');
        } else if (!osPathSvc.isabs(secondPath)) {
            secondPath = osPathSvc.join(gCWD, secondPath);
            file2 = fileSvc.getFileFromURI(secondPath);
        }

        // Ensure the files exist.
        if (!file1.exists) {
            alert(_bundle.formatStringFromName("thereIsNoFileAt.alert", [firstPath], 1));
            first.focus();
            return false
        }
        if (!file2.exists) {
            alert(_bundle.formatStringFromName("thereIsNoFileAt.alert", [secondPath], 1));
            second.focus();
            return false
        }

        ko.mru.addFromACTextbox(first);
        ko.mru.addFromACTextbox(second);
        window.setCursor('wait');
        opener.ko.fileutils.showDiffs(firstPath, secondPath);
        window.setCursor('auto');
    } catch (e) {
        log.exception(e);
    } finally {
        if (file1 && !file1.isLocal)
            file1.close();
        if (file2 && !file2.isLocal)
            file2.close();
    }
    return true;
}

function Cancel()
{
    return true;
}

