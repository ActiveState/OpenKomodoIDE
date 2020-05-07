/* Copyright (c) 2000-2008 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

// The source code control preferences panel.

//---- globals

var dlg = new Object(); // holds refs to all the required DOM elements

var _bzrSvc = Components.classes["@activestate.com/koSCC?type=bzr;1"].
              getService(Components.interfaces.koISCC);
var availInterps = new Array();
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

//---- functions for pref-scc.xul

function PrefSCCBzr_OnLoad()
{
    //dump('PrefSCCBzr_OnLoad\n');
    dlg.bzrEnabled = document.getElementById("bzrEnabled");
    dlg.bzrDeck = document.getElementById("bzrDeck");
    dlg.bzrBackgroundCheck = document.getElementById("bzrBackgroundCheck");
    dlg.bzrBackgroundMinutes = document.getElementById("bzrBackgroundMinutes");
    dlg.bzrDiffOptions = document.getElementById("bzrDiffOptions");
    dlg.bzrNotFunctional = document.getElementById("bzrNotFunctional");

    dlg.executable = parent.hPrefWindow.prefset.getString('bzrExecutable', '');
    PrefSCCBzr_PopulateExecutables();

    parent.hPrefWindow.onpageload();

    dlg.startup = true;
    PrefSCCBzr_UpdateNotFunctionalUI(null);
    PrefSCCBzr_UpdateEnabledUI();
    dlg.startup = false;
}

var _findingInterps = false;
function PrefSCCBzr_PopulateExecutables()
{
    var availInterpList = document.getElementById("bzrExecutable");

    // remove any existing items and add a "finding..." one
    _findingInterps = true;
    availInterpList.removeAllItems();
    availInterpList.appendItem("Finding available Bzr executables...");

    // get a list of installed Bazaar executables
    var sysUtils = Components.classes['@activestate.com/koSysUtils;1'].
        getService(Components.interfaces.koISysUtils);
    availInterps = new Array();
    availInterps = sysUtils.WhichAll("bzr", new Object());
    if (navigator.platform.toLowerCase().substr(0, 3) == "win") {
        // Try to find Bazaar from the registry
        let reg = Components.classes["@mozilla.org/windows-registry-key;1"]
                            .createInstance(Components.interfaces.nsIWindowsRegKey);
        try {
            reg.open(reg.ROOT_KEY_LOCAL_MACHINE, "Software\\Bazaar",
                     reg.ACCESS_QUERY_VALUE);
            let file = Components.classes["@mozilla.org/file/local;1"]
                                 .createInstance(Components.interfaces.nsILocalFile);
            file.initWithPath(reg.readStringValue("InstallPath"));
            file.append("bzr.exe");
            if (file.exists() && file.isExecutable()) {
                let found = false;
                for each (let path in availInterps) {
                    let interp = Components.classes["@mozilla.org/file/local;1"]
                                 .createInstance(Components.interfaces.nsILocalFile);
                    interp.initWithPath(path);
                    if (interp.equals(file)) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    availInterps.push(file.path);
                }
            }
        } catch (ex) {
            /* ignore; we don't care */
        } finally {
            reg.close();
        }
        // Work around bug 84467: We can't pass ...\bzr to CreateProcess
        var usePaths = {};
        var len = availInterps.length;
        var fixedInterps = [];
        for (var i = 0; i < len; i++) {
            usePaths[availInterps[i].toLowerCase()] = true;
        }
        for (var path in usePaths) {
            var idx = path.indexOf(".bat");
            if (idx == path.length - 4) {
                var subPath = path.substr(0, idx);
                usePaths[subPath] = false;
            }
        }
        for (var i = 0; i < len; i++) {
            if (usePaths[availInterps[i].toLowerCase()]) {
                fixedInterps.push(availInterps[i]);
            }
        }
        availInterps = fixedInterps;
    }

    availInterpList.removeAllItems();
    availInterpList.appendItem("Find on Path",'');
    // populate the tree listing them
    var found = false;
    if (availInterps.length != 0) {
        for (var i = 0; i < availInterps.length; i++) {
            availInterpList.appendItem(availInterps[i],availInterps[i]);
            if (availInterps[i] == dlg.executable) found = true;
        }
    }
    if (!found && dlg.executable)
        availInterpList.appendItem(dlg.executable,dlg.executable);

    _findingInterps = false;
}

function _setElementDisabled(elt, disabled) {
    if (disabled) {
        elt.setAttribute('disabled', true);
    } else {
        if (elt.hasAttribute('disabled')) {
            elt.removeAttribute('disabled');
        }
    }
}

function PrefSCCBzr_UpdateEnabledUI()
{
    //dump("PrefSCCBzr_UpdateEnabledUI('"+type+"')\n");
    var disabled = !dlg.bzrEnabled.checked;
    _setElementDisabled(dlg.bzrBackgroundCheck, disabled);
    _setElementDisabled(dlg.bzrDiffOptions, disabled);
    PrefSCCBzr_UpdateBackgroundEnabledUI();
}

function PrefSCCBzr_UpdateBackgroundEnabledUI()
{
    //dump("PrefSCCBzr_UpdateBackgroundEnabledUI('"+type+"')\n");
    var disabled = !(dlg.bzrBackgroundCheck.checked && dlg.bzrEnabled.checked);
    _setElementDisabled(dlg.bzrBackgroundMinutes, disabled);
}


function PrefSCCBzr_UpdateNotFunctionalUI(resp)
{
    //dump("PrefSCCBzr_UpdateNotFunctionalUI('"+type+"')\n");
    if (!resp) {
        resp = {};
        resp.isFunctional = _bzrSvc.isFunctional;
        resp.reasonNotFunctional = _bzrSvc.reasonNotFunctional;
    }
    var reason = null;
    if (resp.isFunctional) {
        _setElementDisabled(dlg.bzrEnabled, false);
        dlg.bzrDeck.setAttribute("selectedIndex", 0);
    } else {
        _setElementDisabled(dlg.bzrEnabled, true);
        dlg.bzrDeck.setAttribute("selectedIndex", 1);
        // Describe why Bzr is not functional.
        reason = "Bzr integration has been disabled in Komodo because " +
                    resp.reasonNotFunctional + ". Visit the following " +
                    "site for more information on Bzr.";
        while (dlg.bzrNotFunctional.hasChildNodes()) {
            dlg.bzrNotFunctional.removeChild(dlg.bzrNotFunctional.firstChild);
        }
        dlg.bzrNotFunctional.appendChild(document.createTextNode(reason));
    }
}

function PrefSCCBzr_CheckEntry()
{
    var availInterpList = document.getElementById("bzrExecutable");
    var exec = availInterpList.inputField.value;
    if (!exec) return;
    var found = false;
    if (availInterps.length != 0) {
        for (var i = 0; i < availInterps.length; i++) {
            if (availInterps[i] == exec) {
                found = true;
                break;
            }
        }
    }
    if (!found) {
        availInterps[availInterps.length] = exec;
        availInterpList.selectedItem = availInterpList.appendItem(exec,exec);
        PrefSCCBzr_CheckAgain();
    }
}

function PrefSCCBzr_DetermineOk(defaultExec)
{
    // this function does not change the executable permenantly
    // that is handled by the saving of the prefs
    if (typeof(defaultExec)=='undefined' || !defaultExec) {
        defaultExec = document.getElementById('bzrExecutable').selectedItem.getAttribute('value');
    }
    var oldexec = _bzrSvc.executable;
    _bzrSvc.executable = defaultExec;
    _bzrSvc.redetermineIfFunctional();
    var resp = {};
    resp.isFunctional = _bzrSvc.isFunctional;
    resp.reasonNotFunctional = _bzrSvc.reasonNotFunctional;
    _bzrSvc.executable = oldexec;
    return resp;
}

function PrefSCCBzr_CheckAgain()
{
    var resp = PrefSCCBzr_DetermineOk();
    PrefSCCBzr_UpdateNotFunctionalUI(resp);
}

function PrefSCCBzr_getExecutable() {
    var current = document.getElementById("bzrExecutable").value;
    var path = ko.filepicker.browseForExeFile(null, current);
    if (path != null) {
        var resp = PrefSCCBzr_DetermineOk(path);
        if (resp.isFunctional) {
            var availInterpList = document.getElementById("bzrExecutable");
            availInterpList.selectedItem = availInterpList.appendItem(path,path);
            PrefSCCBzr_UpdateNotFunctionalUI(resp);
        } else {
            alert("The executable you choose is not a valid or usable Bzr: " +
                  resp.reasonNotFunctional+"\n");
        }
    }
}
