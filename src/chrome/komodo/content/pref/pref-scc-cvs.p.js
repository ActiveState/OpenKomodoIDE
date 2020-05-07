/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

// The source code control preferences panel.

//---- globals

var dlg = new Object(); // holds refs to all the required DOM elements

var _cvsSvc = Components.classes["@activestate.com/koSCC?type=cvs;1"].
              getService(Components.interfaces.koISCC);
var availInterps = new Array();
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

//---- functions for pref-scc.xul

function PrefSCCCVS_OnLoad()
{
    //dump('PrefSCCCVS_OnLoad\n');
    dlg.cvsEnabled = document.getElementById("cvsEnabled");
    dlg.cvsDeck = document.getElementById("cvsDeck");
    dlg.cvsBackgroundCheck = document.getElementById("cvsBackgroundCheck");
    dlg.cvsBackgroundMinutes = document.getElementById("cvsBackgroundMinutes");
    dlg.cvsDiffOptions = document.getElementById("cvsDiffOptions");
    dlg.cvsRecursive = document.getElementById("cvsRecursive");
    dlg.cvsNotFunctional = document.getElementById("cvsNotFunctional");

    dlg.executable = parent.hPrefWindow.prefset.getString('cvsExecutable', '');
    PrefSCCCVS_PopulateExecutables();

    parent.hPrefWindow.onpageload();

    dlg.startup = true;
    PrefSCCCVS_UpdateNotFunctionalUI(null);
    PrefSCCCVS_UpdateEnabledUI();
    dlg.startup = false;
}

var _findingInterps = false;
function PrefSCCCVS_PopulateExecutables()
{
    var availInterpList = document.getElementById("cvsExecutable");

    // remove any existing items and add a "finding..." one
    _findingInterps = true;
    availInterpList.removeAllItems();
    availInterpList.appendItem("Finding available CVS executables...");

    // get a list of installed Perl interpreters
    var sysUtils = Components.classes['@activestate.com/koSysUtils;1'].
        getService(Components.interfaces.koISysUtils);
    availInterps = new Array();
    availInterps = sysUtils.WhichAll("cvs", new Object());

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

function PrefSCCCVS_UpdateEnabledUI()
{
    //dump("PrefSCCCVS_UpdateEnabledUI('"+type+"')\n");
    var disabled = !dlg.cvsEnabled.checked;
    _setElementDisabled(dlg.cvsBackgroundCheck, disabled);
    _setElementDisabled(dlg.cvsDiffOptions, disabled);
    if (!dlg.startup && !disabled
        && !document.getElementById('cvsBackgroundCheck').checked
        && !document.getElementById('donotask_cvs_ssh_setup_warning').checked)
    {
        doSCCWarnAboutSSH();
    }
    PrefSCCCVS_UpdateBackgroundEnabledUI();
}

function PrefSCCCVS_UpdateBackgroundEnabledUI()
{
    //dump("PrefSCCCVS_UpdateBackgroundEnabledUI('"+type+"')\n");
    var disabled = !(dlg.cvsBackgroundCheck.checked && dlg.cvsEnabled.checked);
    _setElementDisabled(dlg.cvsBackgroundMinutes, disabled);
    _setElementDisabled(dlg.cvsRecursive, disabled);
    if (!dlg.startup && !disabled
        && !document.getElementById('donotask_cvs_ssh_setup_warning').checked)
    {
        doSCCWarnAboutSSH();
    }
}


function PrefSCCCVS_UpdateNotFunctionalUI(resp)
{
    //dump("PrefSCCCVS_UpdateNotFunctionalUI('"+type+"')\n");
    if (!resp) {
        resp = {};
        resp.isFunctional = _cvsSvc.isFunctional;
        resp.reasonNotFunctional = _cvsSvc.reasonNotFunctional;
    }
    var reason = null;
    if (resp.isFunctional) {
        _setElementDisabled(dlg.cvsEnabled, false);
        dlg.cvsDeck.setAttribute("selectedIndex", 0);
    } else {
        _setElementDisabled(dlg.cvsEnabled, true);
        dlg.cvsDeck.setAttribute("selectedIndex", 1);
        // Describe why CVS is not functional.
        reason = "CVS integration has been disabled in Komodo because " +
                    resp.reasonNotFunctional + ". Visit the following " +
                    "site for more information on CVS.";
        while (dlg.cvsNotFunctional.hasChildNodes()) {
            dlg.cvsNotFunctional.removeChild(dlg.cvsNotFunctional.firstChild);
        }
        dlg.cvsNotFunctional.appendChild(document.createTextNode(reason));
    }
}

function PrefSCCCVS_CheckEntry()
{
    var availInterpList = document.getElementById("cvsExecutable");
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
        PrefSCCCVS_CheckAgain();
    }
}

function PrefSCCCVS_DetermineOk(defaultExec)
{
    // this function does not change the executable permenantly
    // that is handled by the saving of the prefs
    if (typeof(defaultExec)=='undefined' || !defaultExec) {
        defaultExec = document.getElementById('cvsExecutable').selectedItem.getAttribute('value');
    }
    var oldexec = _cvsSvc.executable;
    _cvsSvc.executable = defaultExec;
    _cvsSvc.redetermineIfFunctional();
    var resp = {};
    resp.isFunctional = _cvsSvc.isFunctional;
    resp.reasonNotFunctional = _cvsSvc.reasonNotFunctional;
    _cvsSvc.executable = oldexec;
    return resp;
}

function PrefSCCCVS_CheckAgain()
{
    var resp = PrefSCCCVS_DetermineOk();
    PrefSCCCVS_UpdateNotFunctionalUI(resp);
}

function doSCCWarnAboutSSH() {
    var os = Components.classes["@activestate.com/koOs;1"].getService(Components.interfaces.koIOs);
    var CVS_RSH = os.getenv('CVS_RSH');
    if (CVS_RSH) {
        var msg = "The CVS_RSH environment variable is set to '"+CVS_RSH+"' and CVS Background Status Checking is currently turned on.  Failure to properly configure CVS authentication may result in process lockups within Komodo.  Please make sure that you have properly configured CVS/SSH on your system. You may click 'Tell Me More' for information on how to do so.";
        var answer = ko.dialogs.customButtons(msg, ["&Close", "Tell Me &More"],
                                          "Close", null,
                                          "CVS/SSH Setup Warning");
        if (answer == "Tell Me More") {
            ko.windowManager.getMainWindow().ko.help.open("scc.html#config_cvs");
        }
    }
}

function PrefSCCCVS_getExecutable() {
    var current = document.getElementById("cvsExecutable").value;
    var path = ko.filepicker.browseForExeFile(null, current);
    if (path != null) {
        var resp = PrefSCCCVS_DetermineOk(path);
        if (resp.isFunctional) {
            var availInterpList = document.getElementById("cvsExecutable");
            availInterpList.selectedItem = availInterpList.appendItem(path,path);
            PrefSCCCVS_UpdateNotFunctionalUI(resp);
        } else {
            alert("The executable you choose is not a valid or usable CVS: " +
                  resp.reasonNotFunctional+"\n");
        }
    }
}
