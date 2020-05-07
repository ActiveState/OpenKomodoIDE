/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

// The source code control preferences panel.

//---- globals

var dlg = new Object(); // holds refs to all the required DOM elements

var _svnSvc = Components.classes["@activestate.com/koSCC?type=svn;1"].
              getService(Components.interfaces.koISCC);
var availInterps = new Array();
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

//---- functions for pref-scc.xul

function PrefSCCSVN_OnLoad()
{
    //dump('PrefSCCSVN_OnLoad\n');
    dlg.svnEnabled = document.getElementById("svnEnabled");
    dlg.svnDeck = document.getElementById("svnDeck");
    dlg.svnBackgroundCheck = document.getElementById("svnBackgroundCheck");
    dlg.svnBackgroundMinutes = document.getElementById("svnBackgroundMinutes");
    dlg.svnDiffOptions = document.getElementById("svnDiffOptions");
    dlg.svnNotFunctional = document.getElementById("svnNotFunctional");

    dlg.executable = parent.hPrefWindow.prefset.getString('svnExecutable', '');
    PrefSCCSVN_PopulateExecutables();

    parent.hPrefWindow.onpageload();

    dlg.startup = true;
    PrefSCCSVN_UpdateNotFunctionalUI(null);
    PrefSCCSVN_UpdateEnabledUI();
    dlg.startup = false;
}

var _findingInterps = false;
function PrefSCCSVN_PopulateExecutables()
{
    var availInterpList = document.getElementById("svnExecutable");

    // remove any existing items and add a "finding..." one
    _findingInterps = true;
    availInterpList.removeAllItems();
    availInterpList.appendItem("Finding available SVN executables...");

    // get a list of installed Perl interpreters
    var sysUtils = Components.classes['@activestate.com/koSysUtils;1'].
        getService(Components.interfaces.koISysUtils);
    availInterps = new Array();
    availInterps = sysUtils.WhichAll("svn", new Object());

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

function PrefSCCSVN_UpdateEnabledUI()
{
    //dump("PrefSCCSVN_UpdateEnabledUI('"+type+"')\n");
    var disabled = !dlg.svnEnabled.checked;
    _setElementDisabled(dlg.svnBackgroundCheck, disabled);
    _setElementDisabled(dlg.svnDiffOptions, disabled);
    if (!dlg.startup && !disabled
        && !document.getElementById('svnBackgroundCheck').checked
        && !document.getElementById('donotask_svn_ssh_setup_warning').checked)
    {
        doSCCWarnAboutSSH();
    }
    PrefSCCSVN_UpdateBackgroundEnabledUI();
}

function PrefSCCSVN_UpdateBackgroundEnabledUI()
{
    //dump("PrefSCCSVN_UpdateBackgroundEnabledUI('"+type+"')\n");
    var disabled = !(dlg.svnBackgroundCheck.checked && dlg.svnEnabled.checked);
    _setElementDisabled(dlg.svnBackgroundMinutes, disabled);
    if (!dlg.startup && !disabled
        && !document.getElementById('donotask_svn_ssh_setup_warning').checked)
    {
        doSCCWarnAboutSSH();
    }
}


function PrefSCCSVN_UpdateNotFunctionalUI(resp)
{
    //dump("PrefSCCSVN_UpdateNotFunctionalUI('"+type+"')\n");
    if (!resp) {
        resp = {};
        resp.isFunctional = _svnSvc.isFunctional;
        resp.reasonNotFunctional = _svnSvc.reasonNotFunctional;
    }
    var reason = null;
    if (resp.isFunctional) {
        _setElementDisabled(dlg.svnEnabled, false);
        dlg.svnDeck.setAttribute("selectedIndex", 0);
    } else {
        _setElementDisabled(dlg.svnEnabled, true);
        dlg.svnDeck.setAttribute("selectedIndex", 1);
        // Describe why SVN is not functional.
        reason = "SVN integration has been disabled in Komodo because " +
                    resp.reasonNotFunctional + ". Visit the following " +
                    "site for more information on SVN.";
        while (dlg.svnNotFunctional.hasChildNodes()) {
            dlg.svnNotFunctional.removeChild(dlg.svnNotFunctional.firstChild);
        }
        dlg.svnNotFunctional.appendChild(document.createTextNode(reason));
    }
}

function PrefSCCSVN_CheckEntry()
{
    var availInterpList = document.getElementById("svnExecutable");
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
        PrefSCCSVN_CheckAgain();
    }
}

function PrefSCCSVN_DetermineOk(defaultExec)
{
    // this function does not change the executable permenantly
    // that is handled by the saving of the prefs
    if (typeof(defaultExec)=='undefined' || !defaultExec) {
        defaultExec = document.getElementById('svnExecutable').selectedItem.getAttribute('value');
    }
    var oldexec = _svnSvc.executable;
    _svnSvc.executable = defaultExec;
    _svnSvc.redetermineIfFunctional();
    var resp = {};
    resp.isFunctional = _svnSvc.isFunctional;
    resp.reasonNotFunctional = _svnSvc.reasonNotFunctional;
    _svnSvc.executable = oldexec;
    return resp;
}

function PrefSCCSVN_CheckAgain()
{
    var resp = PrefSCCSVN_DetermineOk();
    PrefSCCSVN_UpdateNotFunctionalUI(resp);
}

function doSCCWarnAboutSSH() {
    var os = Components.classes["@activestate.com/koOs;1"].getService(Components.interfaces.koIOs);
    var SVN_RSH = os.getenv('SVN_RSH');
    if (SVN_RSH) {
        var msg = "The SVN_RSH environment variable is set to '"+SVN_RSH+"' and SVN Background Status Checking is currently turned on.  Failure to properly configure SVN authentication may result in process lockups within Komodo.  Please make sure that you have properly configured SVN/SSH on your system. You may click 'Tell Me More' for information on how to do so.";
        var answer = ko.dialogs.customButtons(msg, ["&Close", "Tell Me &More"],
                                          "Close", null,
                                          "SVN/SSH Setup Warning");
        if (answer == "Tell Me More") {
            ko.windowManager.getMainWindow().ko.help.open("scc.html#config_svn");
        }
    }
}

function PrefSCCSVN_getExecutable() {
    var current = document.getElementById("svnExecutable").value;
    var path = ko.filepicker.browseForExeFile(null, current);
    if (path != null) {
        var resp = PrefSCCSVN_DetermineOk(path);
        if (resp.isFunctional) {
            var availInterpList = document.getElementById("svnExecutable");
            availInterpList.selectedItem = availInterpList.appendItem(path,path);
            PrefSCCSVN_UpdateNotFunctionalUI(resp);
        } else {
            alert("The executable you choose is not a valid or usable SVN: " +
                  resp.reasonNotFunctional+"\n");
        }
    }
}
