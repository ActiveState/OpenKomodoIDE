const EXPORTED_SYMBOLS = ['CollaborationSvc'];

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/notifications.js");
Components.utils.import("resource://services/sso.js");


var CollaborationSvc = {
    onStartup: function CollaborationSvc_onStartup() {
        let logging = Components.classes["@activestate.com/koLoggingService;1"].
                        getService(Components.interfaces.koILoggingService);
        this._log =  logging.getLogger('collaboration-service');
        this._log.setLevel(logging.DEBUG);

        this._notificationSvc = Components.classes["@activestate.com/koNotification/manager;1"]
                                .getService(Components.interfaces.koINotificationManager);
        this._obsSvc = Components.classes["@mozilla.org/observer-service;1"].
                        getService(Components.interfaces.nsIObserverService);
        for each (let event in this._events)
            this._obsSvc.addObserver(this, event, false);
        this.prefs.addObserver("enabled", this, false);
    },

    _events: [
        "network:offline-status-changed",
        "collaboration:sync-connection-ok",
        "collaboration:sync-connection-error",
        "collaboration:socket-connected",
        "collaboration:socket-disconnected",
        "services:sso:account-changed"
    ],

    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver]),

    prefs: Components.classes["@mozilla.org/preferences-service;1"]
                     .getService(Components.interfaces.nsIPrefService)
                     .getBranch("collaboration.")
                     .QueryInterface(Components.interfaces.nsIPrefBranch2),

    get protocolVersion() this.prefs.getCharPref("protocolVersion"),

    get enabled() this.prefs.getBoolPref("enabled"),
    set enabled(value) this.prefs.setBoolPref("enabled", value),

    get ssoUserId() SSOSvc.userId,
    get ssoKey() SSOSvc.sessionKey,
    get loggedIn() this.enabled && SSOSvc.loggedIn,
    get displayName() SSOSvc.email,

    get connected()
        this.mobwriteConnected && this.socketsConnected,

    // false after the first mobwrite roundtrip has failed
    _mobwriteConnected: true,
    get mobwriteConnected() this._mobwriteConnected,
    set mobwriteConnected(value)
        this._updateConnStatus(function() this._mobwriteConnected = value),

    _socketsConnected: false,
    get socketsConnected() this._socketsConnected,
    set socketsConnected(value)
        this._updateConnStatus(function() this._socketsConnected = value),

    _updateConnStatus: function(func) {
        // Decorate func, so a notification is thrown, if func changes the
        // value of `this.connected`.
        let oldConnStatus = this.connected;
        let ret = func.apply(this);
        let newConnStatus = this.connected;
        if (oldConnStatus != newConnStatus)
            this._notifyConnStatusChange();
        return ret;
    },

    _notifyConnStatusChange: function() {
        this._obsSvc.notifyObservers(this,
                "collaboration:connection-status-changed", null);
    },

    /**
     * Connect by user intervention instead of careful observation of events.
     * In an ideal version of this plugin, this shouldn't be neccessary.
     */
    forceReconnect: function() {
        this._log.debug("User requested reconnect.")
        if (!this.enabled)
            throw "Collaboration is not enabled!"
        if (this.loggedIn && this.connected) {
            this._log.warn("Reconnect requested, but connection status looks" +
                           " okay? Notifying connection status change.");
            this._notifyConnStatusChange();
            return;
        }
        if (!this.ssoKey || !this.loggedIn) {
            this._log.debug("Asking SSO to do a login...");
            this._obsSvc.notifyObservers(this, "services:sso:check-session", null);
        } else {
            // this.connected is false
            this._log.debug("SSO connection status okay, asking sockets and " +
                            "mobwrite for reconnect.");
            this._obsSvc.notifyObservers(this, "collaboration:force-reconnect",
                                         null);
        }
    },

    observe: function CollaborationSvc_observe(subject, topic, data) {
        switch(topic) {
            case "network:offline-status-changed":
                // Note: The data value for this notification 'offline' or
                // 'online' to indicate the new state.
                // TODO
                break;
            case "collaboration:sync-connection-ok":
                this.mobwriteConnected = true;
                this._updateErrorNotification();
                break;
            case "collaboration:sync-connection-error":
                this.mobwriteConnected = false;
                this._updateErrorNotification();
                break;
            case "collaboration:socket-connected":
                this.socketsConnected = true;
                this._updateErrorNotification();
                break;
            case "collaboration:socket-disconnected":
                this.socketsConnected = false;
                this._updateErrorNotification();
                break;
            case "services:sso:account-changed":
                // Disable Collaboration if SSO has been reset
                if (!SSOSvc.email)
                    this.enabled = false;
                break;
            case "nsPref:changed": // == NS_PREFBRANCH_PREFCHANGE_TOPIC_ID
                this.observePrefs(subject, data);
        }
    },

    observePrefs: function CollaborationSvc_observePrefs(branch, pref) {
        switch(pref) {
            case "enabled":
                // Do we have to take action on this? Socket, mobwrite and UI
                // are probably all observing this anyway.
                break;
        }
    },

    _updateErrorNotification: function CollaborationSvc__updateErrorNotification() {
        this._removeErrorNotification();
        // When SSO is not logged in, it's not a problem with collaboration
        // per se. Don't spam the user with an extra warning in this case.
        if (this.loggedIn && !this.connected) {
            this._showErrorNotification();
        }
    },

    _showErrorNotification: function CollaborationSvc__showConnectionErrorNotification() {
        this._notificationSvc.addNotification(this.errorNotification);
    },

    _removeErrorNotification: function CollaborationSvc__hideSyncErrorNotification() {
        if (this._errorNotification) {
            this._notificationSvc.removeNotification(this._errorNotification);
            this._errorNotification = null;
        }
    },

    get errorNotification() {
        if (!this._errorNotification) {
            this._errorNotification = this._createNotification(
                "Connection error (Collaboration)",
                "Komodo could not contact the collaboration server. Collaboration features are currently unavailable." +
                "Komodo will automatically try again to reach the server.",
                Components.interfaces.koINotification.SEVERITY_WARNING
            );
        }
        return this._errorNotification;
    },

    _createNotification: function CollaborationSvc__createNotification(title, text, priority) {
        let Ci = Components.interfaces;
        let Cc = Components.classes;
        var notification = this._notificationSvc.createNotification("collab-notification",
                                  ["collab"], 1,   // tags
                                  null,            // context
                                  Ci.koINotificationManager.TYPE_TEXT |
                                    Ci.koINotificationManager.TYPE_STATUS)
        notification.QueryInterface(Ci.koINotification)
        notification.QueryInterface(Ci.koINotificationText)
        notification.category = "collab";
        notification.summary = title;
        notification.details = text;
        notification.highlight = true;
        notification.severity = priority;
        notification.log = true;
        return notification;
    }
};

CollaborationSvc.onStartup();
