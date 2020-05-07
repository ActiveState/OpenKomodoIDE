/* Copyright (c) 2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* pref-proxydebugger - ...description...
 *
 */


//---- globals

var _pref_proxydebugger_log = ko.logging.getLogger("pref-proxydebugger");
var _pref_proxydebugger_dialog = null;

//---- internal routines

function _pref_proxydebugger_() {
    
}

function _pref_proxydebugger_setElementEnabledState(elt, enabled) {
    if (enabled) {
        if (elt.hasAttribute('disabled')) {
            elt.removeAttribute('disabled');
        }
    } else {
        elt.setAttribute('disabled', true);
    }
}

//---- public routines

function pref_proxydebugger_OnLoad() {
    _pref_proxydebugger_dialog = {};
    _pref_proxydebugger_dialog.checkbox_enabledAtStartup = document.getElementById("httpInspector_enabledAtStartup");
    _pref_proxydebugger_dialog.vbox_httpInspector = document.getElementById("vbox_httpInspector");
    _pref_proxydebugger_dialog.listenPort = document.getElementById("httpInspector_listenPort");
    _pref_proxydebugger_dialog.proxyForwarding_enabled = document.getElementById("httpInspector_proxyForwardingEnabled");
    _pref_proxydebugger_dialog.vbox_httpInspector_forwarding = document.getElementById("vbox_httpInspector_forwarding");
    _pref_proxydebugger_dialog.proxyForwardingAddress = document.getElementById("httpInspector_proxyForwardingAddress");

    parent.hPrefWindow.onpageload();
    
    pref_proxydebugger_doEnabling();
}

function pref_proxydebugger_doEnabling() {
    // Proxy port field
    var enabled = _pref_proxydebugger_dialog.checkbox_enabledAtStartup.checked;
    //_pref_proxydebugger_setElementEnabledState(_pref_proxydebugger_dialog.listenPort, enabled);
    //_pref_proxydebugger_setElementEnabledState(_pref_proxydebugger_dialog.vbox_httpInspector, enabled);
    //
    //// Proxy forwarding section
    //_pref_proxydebugger_setElementEnabledState(_pref_proxydebugger_dialog.proxyForwarding_enabled, enabled);
    //_pref_proxydebugger_setElementEnabledState(_pref_proxydebugger_dialog.vbox_httpInspector_forwarding, enabled);
    // Proxy address
    enabled = _pref_proxydebugger_dialog.proxyForwarding_enabled.checked;
    _pref_proxydebugger_setElementEnabledState(_pref_proxydebugger_dialog.proxyForwardingAddress, enabled);
}
