/* Copyright (c) 2000-2008 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

// The source code control preferences panel.

//---- globals

var dlg = new Object(); // holds refs to all the required DOM elements

var _hgSvc = Components.classes["@activestate.com/koSCC?type=hg;1"].
              getService(Components.interfaces.koISCC);
var availInterps = new Array();
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

//---- functions for pref-scc.xul

function PrefSCCMercurial_OnLoad()
{
    //dump('PrefSCCMercurial_OnLoad\n');
    dlg.hgEnabled = document.getElementById("hgEnabled");
    dlg.hgDeck = document.getElementById("hgDeck");
    dlg.hgBackgroundCheck = document.getElementById("hgBackgroundCheck");
    dlg.hgBackgroundMinutes = document.getElementById("hgBackgroundMinutes");
    dlg.hgDiffOptions = document.getElementById("hgDiffOptions");
    dlg.hgNotFunctional = document.getElementById("hgNotFunctional");

    dlg.executable = parent.hPrefWindow.prefset.getString('hgExecutable', '');
    PrefSCCMercurial_PopulateExecutables();

    parent.hPrefWindow.onpageload();

    dlg.startup = true;
    PrefSCCMercurial_UpdateNotFunctionalUI(null);
    PrefSCCMercurial_UpdateEnabledUI();
    dlg.startup = false;
}

var _findingInterps = false;
function PrefSCCMercurial_PopulateExecutables()
{
    var availInterpList = document.getElementById("hgExecutable");

    // remove any existing items and add a "finding..." one
    _findingInterps = true;
    availInterpList.removeAllItems();
    availInterpList.appendItem("Finding available Mercurial executables...");

    // get a list of installed Perl interpreters
    var sysUtils = Components.classes['@activestate.com/koSysUtils;1'].
        getService(Components.interfaces.koISysUtils);
    availInterps = new Array();
    availInterps = sysUtils.WhichAll("hg", new Object());

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

function PrefSCCMercurial_UpdateEnabledUI()
{
    //dump("PrefSCCMercurial_UpdateEnabledUI('"+type+"')\n");
    var disabled = !dlg.hgEnabled.checked;
    _setElementDisabled(dlg.hgBackgroundCheck, disabled);
    _setElementDisabled(dlg.hgDiffOptions, disabled);
    PrefSCCMercurial_UpdateBackgroundEnabledUI();
}

function PrefSCCMercurial_UpdateBackgroundEnabledUI()
{
    //dump("PrefSCCMercurial_UpdateBackgroundEnabledUI('"+type+"')\n");
    var disabled = !(dlg.hgBackgroundCheck.checked && dlg.hgEnabled.checked);
    _setElementDisabled(dlg.hgBackgroundMinutes, disabled);
}


function PrefSCCMercurial_UpdateNotFunctionalUI(resp)
{
    //dump("PrefSCCMercurial_UpdateNotFunctionalUI('"+type+"')\n");
    if (!resp) {
        resp = {};
        resp.isFunctional = _hgSvc.isFunctional;
        resp.reasonNotFunctional = _hgSvc.reasonNotFunctional;
    }
    var reason = null;
    if (resp.isFunctional) {
        _setElementDisabled(dlg.hgEnabled, false);
        dlg.hgDeck.setAttribute("selectedIndex", 0);
    } else {
        _setElementDisabled(dlg.hgEnabled, true);
        dlg.hgDeck.setAttribute("selectedIndex", 1);
        // Describe why Mercurial is not functional.
        reason = "Mercurial integration has been disabled in Komodo because " +
                    resp.reasonNotFunctional + ". Visit the following " +
                    "site for more information on Mercurial.";
        while (dlg.hgNotFunctional.hasChildNodes()) {
            dlg.hgNotFunctional.removeChild(dlg.hgNotFunctional.firstChild);
        }
        dlg.hgNotFunctional.appendChild(document.createTextNode(reason));
    }
}

function PrefSCCMercurial_CheckEntry()
{
    var availInterpList = document.getElementById("hgExecutable");
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
        PrefSCCMercurial_CheckAgain();
    }
}

function PrefSCCMercurial_DetermineOk(defaultExec)
{
    // this function does not change the executable permenantly
    // that is handled by the saving of the prefs
    if (typeof(defaultExec)=='undefined' || !defaultExec) {
        defaultExec = document.getElementById('hgExecutable').selectedItem.getAttribute('value');
    }
    var oldexec = _hgSvc.executable;
    _hgSvc.executable = defaultExec;
    _hgSvc.redetermineIfFunctional();
    var resp = {};
    resp.isFunctional = _hgSvc.isFunctional;
    resp.reasonNotFunctional = _hgSvc.reasonNotFunctional;
    _hgSvc.executable = oldexec;
    return resp;
}

function PrefSCCMercurial_CheckAgain()
{
    var resp = PrefSCCMercurial_DetermineOk();
    PrefSCCMercurial_UpdateNotFunctionalUI(resp);
}

function PrefSCCMercurial_getExecutable() {
    var current = document.getElementById("hgExecutable").value;
    var path = ko.filepicker.browseForExeFile(null, current);
    if (path != null) {
        var resp = PrefSCCMercurial_DetermineOk(path);
        if (resp.isFunctional) {
            var availInterpList = document.getElementById("hgExecutable");
            availInterpList.selectedItem = availInterpList.appendItem(path,path);
            PrefSCCMercurial_UpdateNotFunctionalUI(resp);
        } else {
            alert("The executable you choose is not a valid or usable Mercurial: " +
                  resp.reasonNotFunctional+"\n");
        }
    }
}
