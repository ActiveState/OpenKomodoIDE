/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

// The source code control preferences panel.

//---- globals

var dlg = new Object(); // holds refs to all the required DOM elements

var _p4Svc = Components.classes["@activestate.com/koSCC?type=p4;1"].
             getService(Components.interfaces.koISCC);
var availInterps = new Array();
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

//---- functions for pref-scc.xul

function PrefSCCPerforce_OnLoad()
{
    dlg.p4Enabled = document.getElementById("p4Enabled");
    dlg.p4Deck = document.getElementById("p4Deck");
    dlg.p4BackgroundCheck = document.getElementById("p4BackgroundCheck");
    dlg.p4BackgroundMinutes = document.getElementById("p4BackgroundMinutes");
    dlg.p4DiffOptions = document.getElementById("p4DiffOptions");
    dlg.p4Recursive = document.getElementById("p4Recursive");
    dlg.p4NotFunctional = document.getElementById("p4NotFunctional");

    dlg.executable = parent.hPrefWindow.prefset.getString('p4Executable', '');
    PrefSCCPerforce_PopulateExecutables();

    parent.hPrefWindow.onpageload();

    dlg.startup = true;
    PrefSCCPerforce_UpdateNotFunctionalUI(null);
    PrefSCCPerforce_UpdateEnabledUI();
    UpdateDiffType(parent.hPrefWindow.prefset.getStringPref('p4_diff_type'));
    dlg.startup = false;
}

// Populate the (tree) list of available CVS executables on the current
// system.
var _findingInterps = false;
function PrefSCCPerforce_PopulateExecutables()
{
    var availInterpList = document.getElementById("p4Executable");

    // remove any existing items and add a "finding..." one
    _findingInterps = true;
    availInterpList.removeAllItems();
    availInterpList.appendItem("Finding available Perforce executables...");

    // get a list of installed Perl interpreters
    var sysUtils = Components.classes['@activestate.com/koSysUtils;1'].
        getService(Components.interfaces.koISysUtils);
    availInterps = new Array();
    availInterps = sysUtils.WhichAll("p4", new Object());

    availInterpList.removeAllItems();
    availInterpList.appendItem("Find on Path",'');

    // populate the list with the executables
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

function PrefSCCPerforce_UpdateEnabledUI()
{
    //dump("PrefSCCPerforce_UpdateEnabledUI('"+type+"')\n");
    var disabled = !dlg.p4Enabled.checked;
    _setElementDisabled(dlg.p4BackgroundCheck, disabled);
    _setElementDisabled(dlg.p4DiffOptions, disabled);
    PrefSCCPerforce_UpdateBackgroundEnabledUI();
}


function PrefSCCPerforce_UpdateBackgroundEnabledUI()
{
    //dump("PrefSCCPerforce_UpdateBackgroundEnabledUI('"+type+"')\n");
    var disabled = !(dlg.p4BackgroundCheck.checked && dlg.p4Enabled.checked);
    _setElementDisabled(dlg.p4BackgroundMinutes, disabled);
    _setElementDisabled(dlg.p4Recursive, disabled);
}


function PrefSCCPerforce_UpdateNotFunctionalUI(resp)
{
    //dump("PrefSCCPerforce_UpdateNotFunctionalUI('"+type+"')\n");
    if (!resp) {
        resp = {};
        resp.isFunctional = _p4Svc.isFunctional;
        resp.reasonNotFunctional = _p4Svc.reasonNotFunctional;
    }
    var reason = null;
    if (resp.isFunctional) {
        _setElementDisabled(dlg.p4Enabled, false);
        dlg.p4Deck.setAttribute("selectedIndex", 0);
    } else {
        _setElementDisabled(dlg.p4Enabled, true);
        dlg.p4Deck.setAttribute("selectedIndex", 1);
        // Describe why Perforce is not functional.
        reason = "Perforce integration has been disabled in Komodo because " +
                    resp.reasonNotFunctional + ". Visit the following " +
                    "site for more information on Perforce.";
        while (dlg.p4NotFunctional.hasChildNodes()) {
            dlg.p4NotFunctional.removeChild(dlg.p4NotFunctional.firstChild);
        }
        dlg.p4NotFunctional.appendChild(document.createTextNode(reason));
    }
}

function PrefSCCPerforce_DetermineOk(defaultExec)
{
    // this function does not change the executable permenantly
    // that is handled by the saving of the prefs
    if (typeof(defaultExec)=='undefined' || !defaultExec) {
        defaultExec = document.getElementById('p4Executable').selectedItem.getAttribute('value');
    }
    var oldexec = _p4Svc.executable;
    _p4Svc.executable = defaultExec;
    _p4Svc.redetermineIfFunctional();
    var resp = {};
    resp.isFunctional = _p4Svc.isFunctional;
    resp.reasonNotFunctional = _p4Svc.reasonNotFunctional;
    _p4Svc.executable = oldexec;
    return resp;
}

function PrefSCCPerforce_CheckAgain()
{
    var resp = PrefSCCPerforce_DetermineOk();
    PrefSCCPerforce_UpdateNotFunctionalUI(resp);
}

function PrefSCCPerforce_getExecutable() {
    var current = document.getElementById('p4Executable').value;
    var path = ko.filepicker.browseForExeFile(null, current);
    if (path != null) {
        var resp = PrefSCCPerforce_DetermineOk(path);
        if (resp.isFunctional) {
            var availInterpList = document.getElementById("p4Executable");
            availInterpList.selectedItem = availInterpList.appendItem(path,path);
            PrefSCCPerforce_UpdateNotFunctionalUI(resp);
        } else {
            alert("The executable you choose is not a valid or usable " +
                  "Perforce executable: "+resp.reasonNotFunctional+"\n");
        }
    }
}

function UpdateDiffType(difftype) {
    var disabled, enabled;
    if (difftype == 'komododiff') {
        disabled = document.getElementById('externaldiff');
        enabled = document.getElementById('p4DiffOptions');
    } else {
        disabled = document.getElementById('p4DiffOptions');
        enabled = document.getElementById('externaldiff');
    }
    if (enabled.hasAttribute('disabled')) {
        enabled.removeAttribute('disabled');
    }
    disabled.setAttribute('disabled', 'true');
}
