/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* Spawnpoint Properties dialog: edit a koIDBGPSpawnpoint component.
 *
 * Usage:
 *  All dialog interaction is done via an object passed in and out as the
 *  first window argument: window.arguments[0].
 *      .spawnpoint     a koIDBGPSpawnpoint instance, the spawnpoint the edit
 *  On return window.arguments[0] has:
 *      .response       "OK" or "Cancel"
 *      .spawnpoint     iff .response is "OK", then this is a _clone_ of the
 *                      passed in spawnpoint with the user's modifications.
 *                      It is up to the caller to then call
 *                      koIDBGPBreakpointManager.breakpointUpdate() to
 *                      actually update the spawnpoint.
 *
 */

var log = ko.logging.getLogger("spawnpointProperties");
//log.setLevel(ko.logging.LOG_DEBUG);

var gWidgets = null;
var gSpawnpoint = null; // koIDBGPSpawnpoint instance to work with



//---- interface routines for XUL

function OnLoad()
{
    log.info("OnLoad()");
    try {
        gWidgets = new Object();
        gWidgets.dialog = document.getElementById("dialog-spawnpointproperties")
        gWidgets.okButton = gWidgets.dialog.getButton("accept");
        gWidgets.cancelButton = gWidgets.dialog.getButton("cancel");
        gWidgets.filename = document.getElementById("filename");
        gWidgets.lineno = document.getElementById("lineno");
        gWidgets.state = document.getElementById("state");

        gWidgets.okButton.setAttribute("accesskey", "o");
        gWidgets.cancelButton.setAttribute("accesskey", "c");

        // .spawnpoint
        if (typeof(window.arguments[0].spawnpoint) == "undefined" ||
            window.arguments[0].spawnpoint == null)
        {
            var err = "no spawnpoint was passed to the 'Spawnpoint Properties' dialog";
            ko.dialogs.alert(err);
            throw(err);
            window.close();
        } else {
            gSpawnpoint = window.arguments[0].spawnpoint.clone();
        }

        UpdateUIFromSpawnpoint();
        gWidgets.filename.focus();
    } catch(ex) {
        log.exception(ex)
    }
}


function UpdateUIFromSpawnpoint()
{
    log.info("UpdateUIFromSpawnpoint()");
    try {
        gWidgets.filename.value = ko.uriparse.displayPath(gSpawnpoint.filename);
        gWidgets.lineno.value = gSpawnpoint.lineno > 0 ? gSpawnpoint.lineno: "";
        if (gSpawnpoint.state == "enabled") {
            gWidgets.state.checked = true;
        } else {
            gWidgets.state.checked = false;
        }

        UpdateOK();
    } catch(ex) {
        log.exception(ex)
    }
}


function UpdateAttribute(attribute)
{
    log.info("UpdateAttribute(attribute="+attribute+")");
    try {
        // Update the working data store (gSpawnpoint) with the data.
        var element = gWidgets[attribute];
        var value;
        switch(attribute) {
        case "filename":
            if (element.value.length > 1) {
                // uriparse will raise an IndexError for zero- and one-length
                // strings.
                value = ko.uriparse.pathToURI(element.value);
            } else {
                value = "";
            }
            log.debug("update filename to '"+value+"'");
            gSpawnpoint.filename = value;
            break;
        case "lineno":
            value = Number(element.value);
            log.debug("update lineno to '"+value+"'");
            gSpawnpoint.lineno = value;
            break;
        case "state":
            if (element.checked) {
                gSpawnpoint.state = "enabled";
            } else {
                gSpawnpoint.state = "disabled";
            }
            break;
        default:
            log.error("unknown attribute '"+attribute+"'");
        }

        UpdateOK();
    } catch(ex) {
        log.exception(ex)
    }
}


// Update the OK button's enabled/disabled status as appropriate.
function UpdateOK()
{
    log.info("UpdateOK()");
    try {
        var enable = true;
        if (!gSpawnpoint.filename || gSpawnpoint.lineno <= 0) {
            enable = false;
        }
        if (enable) {
            if (gWidgets.okButton.hasAttribute("disabled")) {
                gWidgets.okButton.removeAttribute("disabled");
            }
        } else {
            gWidgets.okButton.setAttribute("disabled", "true");
        }
    } catch(ex) {
        log.exception(ex)
    }
}


function BrowseForFile()
{
    log.info("BrowseForFile()");
    try {
        var filename = gWidgets.filename.value;
        filename = ko.filepicker.browseForFile(null, filename, "Select File",
                                       "Tcl", ["Tcl", "All"]);
        if (filename) {
            gWidgets.filename.value = filename;
            UpdateAttribute("filename");
        }
    } catch(ex) {
        log.exception(ex)
    }
}


function OK()
{
    window.arguments[0].response = "OK";
    window.arguments[0].spawnpoint = gSpawnpoint;
    return true;
}

function Cancel()
{
    window.arguments[0].response = "Cancel";
    return true;
}

