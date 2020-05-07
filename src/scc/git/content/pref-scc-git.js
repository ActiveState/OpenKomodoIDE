/* Copyright (c) 2000-2008 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

// The source code control preferences panel.

//---- globals

var dlg = new Object(); // holds refs to all the required DOM elements

var _gitSvc = Components.classes["@activestate.com/koSCC?type=git;1"].
              getService(Components.interfaces.koISCC);
var availInterps = new Array();
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

//---- functions for pref-scc.xul

function PrefSCCGit_OnLoad()
{
    //dump('PrefSCCGit_OnLoad\n');
    dlg.gitEnabled = document.getElementById("gitEnabled");
    dlg.gitDeck = document.getElementById("gitDeck");
    dlg.gitBackgroundCheck = document.getElementById("gitBackgroundCheck");
    dlg.gitBackgroundMinutes = document.getElementById("gitBackgroundMinutes");
    dlg.gitDiffOptions = document.getElementById("gitDiffOptions");
    dlg.gitNotFunctional = document.getElementById("gitNotFunctional");

    dlg.executable = parent.hPrefWindow.prefset.getString('gitExecutable', '');
    PrefSCCGit_PopulateExecutables();

    parent.hPrefWindow.onpageload();

    dlg.startup = true;
    PrefSCCGit_UpdateNotFunctionalUI(null);
    PrefSCCGit_UpdateEnabledUI();
    dlg.startup = false;
}

var _findingInterps = false;
function PrefSCCGit_PopulateExecutables()
{
    var availInterpList = document.getElementById("gitExecutable");

    // remove any existing items and add a "finding..." one
    _findingInterps = true;
    availInterpList.removeAllItems();
    availInterpList.appendItem("Finding available Git executables...");

    // get a list of installed Perl interpreters
    var sysUtils = Components.classes['@activestate.com/koSysUtils;1'].
        getService(Components.interfaces.koISysUtils);
    availInterps = new Array();
    availInterps = sysUtils.WhichAll("git", new Object());

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

function PrefSCCGit_UpdateEnabledUI()
{
    //dump("PrefSCCGit_UpdateEnabledUI('"+type+"')\n");
    var disabled = !dlg.gitEnabled.checked;
    _setElementDisabled(dlg.gitBackgroundCheck, disabled);
    _setElementDisabled(dlg.gitDiffOptions, disabled);
    PrefSCCGit_UpdateBackgroundEnabledUI();
}

function PrefSCCGit_UpdateBackgroundEnabledUI()
{
    //dump("PrefSCCGit_UpdateBackgroundEnabledUI('"+type+"')\n");
    var disabled = !(dlg.gitBackgroundCheck.checked && dlg.gitEnabled.checked);
    _setElementDisabled(dlg.gitBackgroundMinutes, disabled);
}


function PrefSCCGit_UpdateNotFunctionalUI(resp)
{
    //dump("PrefSCCGit_UpdateNotFunctionalUI('"+type+"')\n");
    if (!resp) {
        resp = {};
        resp.isFunctional = _gitSvc.isFunctional;
        resp.reasonNotFunctional = _gitSvc.reasonNotFunctional;
    }
    var reason = null;
    if (resp.isFunctional) {
        _setElementDisabled(dlg.gitEnabled, false);
        dlg.gitDeck.setAttribute("selectedIndex", 0);
    } else {
        _setElementDisabled(dlg.gitEnabled, true);
        dlg.gitDeck.setAttribute("selectedIndex", 1);
        // Describe why Git is not functional.
        reason = "Git integration has been disabled in Komodo because " +
                    resp.reasonNotFunctional + ". Visit the following " +
                    "site for more information on Git.";
        while (dlg.gitNotFunctional.hasChildNodes()) {
            dlg.gitNotFunctional.removeChild(dlg.gitNotFunctional.firstChild);
        }
        dlg.gitNotFunctional.appendChild(document.createTextNode(reason));
    }
}

function PrefSCCGit_CheckEntry()
{
    var availInterpList = document.getElementById("gitExecutable");
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
        PrefSCCGit_CheckAgain();
    }
}

function PrefSCCGit_DetermineOk(defaultExec)
{
    // this function does not change the executable permenantly
    // that is handled by the saving of the prefs
    if (typeof(defaultExec)=='undefined' || !defaultExec) {
        defaultExec = document.getElementById('gitExecutable').selectedItem.getAttribute('value');
    }
    var oldexec = _gitSvc.executable;
    _gitSvc.executable = defaultExec;
    _gitSvc.redetermineIfFunctional();
    var resp = {};
    resp.isFunctional = _gitSvc.isFunctional;
    resp.reasonNotFunctional = _gitSvc.reasonNotFunctional;
    _gitSvc.executable = oldexec;
    return resp;
}

function PrefSCCGit_CheckAgain()
{
    var resp = PrefSCCGit_DetermineOk();
    PrefSCCGit_UpdateNotFunctionalUI(resp);
}

function PrefSCCGit_getExecutable() {
    var current = document.getElementById("gitExecutable").value;
    var path = ko.filepicker.browseForExeFile(null, current);
    if (path != null) {
        var resp = PrefSCCGit_DetermineOk(path);
        if (resp.isFunctional) {
            var availInterpList = document.getElementById("gitExecutable");
            availInterpList.selectedItem = availInterpList.appendItem(path,path);
            PrefSCCGit_UpdateNotFunctionalUI(resp);
        } else {
            alert("The executable you choose is not a valid or usable Git: " +
                  resp.reasonNotFunctional+"\n");
        }
    }
}
