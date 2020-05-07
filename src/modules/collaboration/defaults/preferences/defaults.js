pref("collaboration.protocolVersion", "3");
pref("collaboration.enabled", true);
// Location of the python collaboration server
pref("collaboration.syncURL", "https://collaboration.activestate.com/collaboration/");
pref("collaboration.apiURL", "https://collaboration.activestate.com/api/");
// Location of the node.js collaboration socket server. Append :443 so the port does not default to 80
pref("collaboration.socketio.URL", "https://collaboration-push-v3.activestate.com:443");
// Timeout for collaboration remote user caret flags in ms.
pref("collaboration.caretFlags.timeout", 10000);
// Disable mobwrite protocol debug logging
pref("collaboration.mobwriteDebug", false);
