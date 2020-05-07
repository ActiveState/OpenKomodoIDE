/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

var gDialog = {};

var osPathService = Components.classes["@activestate.com/koOsPath;1"]
            .getService(Components.interfaces.koIOsPath);

var gBaseDir;
var gPerlAppFileAddLog = ko.logging.getLogger('perlapp-fileadd');

function onPerlAppFileAddLoad() {
    try {
        // set up UI elements
        gDialog.sourceFile = document.getElementById('sourceFile');
        gDialog.destinationFile = document.getElementById('destinationFile');

        gDialog.sourceFile.value = window.arguments[0].sourceFile;
        gDialog.destinationFile.value = window.arguments[0].destinationFile;
        gBaseDir = window.arguments[0].baseDirectory;

        window.sizeToContent();
        dialog = document.getElementById('dialog-perlapp-fileadd');
        dialog.moveToAlertPosition();
    } catch (e) {
        dump(e);
        gPerlAppFileAddLog.exception(e);
    }
}

function browse() {
    var path = ko.filepicker.browseForFile(gBaseDir, // default dir
                                   null, // default filename
                                   "Add File" // title
                                  );
    if (!path) return;
    if (osPathService.commonprefix(path, gBaseDir) == gBaseDir) {
        // We relativize
        gDialog.sourceFile.value = osPathService.relpath(path, gBaseDir);
    } else {
        gDialog.sourceFile.value = path;
    }
    gDialog.destinationFile.value = ko.uriparse.baseName(path);
}

function changeSourceFile() {
}

function changeDestinationFile() {

}

function onOk() {
    if (gDialog.sourceFile.value == '' ||
        gDialog.destinationFile.value == '') {
        return 0
    }

    window.arguments[0].sourceFile = gDialog.sourceFile.value;
    window.arguments[0].destinationFile = gDialog.destinationFile.value;
    return 1
}

function onCancel() {
    window.arguments[0].sourceFile = "";
    window.arguments[0].destinationFile = "";
    return 1
}
