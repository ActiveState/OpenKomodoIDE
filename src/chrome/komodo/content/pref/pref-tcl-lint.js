/* Copyright (c) 2004-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

//---- globals
var dialog;
var log = ko.logging.getLogger('prefs.tcl.lint');

//---- functions

function PrefTclLint_OnLoad()
{
    try {
        dialog = {};

        parent.hPrefWindow.onpageload();
        PrefTcl_UpdateUI();
    } catch (e) {
        log.exception(e);
    }
}

function PrefTcl_UpdateUI() {
    try {
        var forcetclversion = document.getElementById('force_tcllint_version');
        var popup = document.getElementById('tcllint_version');
        if (forcetclversion.hasAttribute('checked') &&
            forcetclversion.getAttribute('checked') == 'true') {
            popup.removeAttribute('disabled');
        } else {
            popup.setAttribute('disabled', 'true');
        }
    } catch (e) {
        log.exception(e);
    }
}
