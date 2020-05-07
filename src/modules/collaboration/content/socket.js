ko.collaboration.socket = {};

(function() {
    var obsSvc = Components.classes['@mozilla.org/observer-service;1']
                           .getService(Components.interfaces.nsIObserverService);
    var log = ko.collaboration.log;
    // Reference to `this` for callback functions.
    var this_ = this;
    var socketUrl = ko.collaboration.service.prefs.getCharPref("socketio.URL");
    io.transports = ['websocket'];
    var socket = io.connect(socketUrl, {
        // Even if we have only one transport enabled,
        // set this to true so connect_failed is fired.
        'try multiple transports': true,
        // Don't auto connect. Wait until we have SSO credentials.
        'auto connect': false,
        'connect timeout': 5000,
        'max reconnection attempts': 100,
        'reconnection delay': 500
    });

    // Disable socket.io's XDomain magic.
    socket.socket.isXDomain = function() false;


    // Socket handler functions:

    socket.on('connect', function() {
        this_.authenticate();
    });

    socket.on('komob_auth' , function(successful, err_reason) {
        if (successful) {
            this_.authenticated = true;
            obsSvc.notifyObservers(this_, 'collaboration:socket-connected', null);
        } else {
            if (err_reason == 'credentials') {
                obsSvc.notifyObservers(this_, 'services:sso:check-session', null);
                this_.disconnect();
            } else if (err_reason == 'version') {
                // Collaboration protocol version is out of date. Tell the user
                alert("Collaboration is out of date. Please update Komodo or disable Collaboration.");
                this_.disconnect();
            } else {
                // Unknown error
                // FIXME !!!
                alert("Unknown Collaboration authentication failure.");
            }
        }
    });

    socket.on('komob_error' , function(msg) {
        log.warn('Socket got a komob_error protocol message: ' + msg);
    });

    socket.on('komob_friends' , function(msg) {
        ko.collaboration.friends.update();
    });

    socket.on('komob_sessions' , function(msg) {
        ko.collaboration.sessions.refresh();
    });

    socket.on('komob_mobwrite' , function(msg) {
        // Server has updates- sync asap.
        mobwrite.syncNow();
    });

    socket.on('disconnect', function() {
        this_.authenticated = false;
        obsSvc.notifyObservers(this_, 'collaboration:socket-disconnected', null);
    });

    socket.on('connect_failed', function() {
        obsSvc.notifyObservers(this_, 'collaboration:socket-connect-failed', null);
    });

    this._socket = socket;

    this._events = ["services:sso:login-successful",
                    "services:sso:logout-successful",
                    "collaboration:force-reconnect"];

    this._addObserver = function() {
        for each (let event in this._events)
            obsSvc.addObserver(this, event, false);
    };

    this._removeObserver = function() {
        for each (let event in this._events)
            obsSvc.removeObserver(this, event);
    };

    this._unloadSocket = function() {
        this._removeObserver();
        // We don't want to notify a lost connection to the service when the
        // window is unloaded.
        this._socket.on('disconnect', function() {});
        this._socket.on('connect_failed', function() {});
        this._socket.disconnect();
        // FIXME socketio still throws an exception in `Transport._setTimeout`
        // during unload. Can't figure out why.
    };

    // Public methods:

    this.init = function() {
        this._addObserver();
        let this_ = this;
        window.addEventListener('beforeunload', function() {
            this_._unloadSocket();
        }, false);

        if (ko.collaboration.service.loggedIn)
            this.connect();
    };

    this.authenticated = false;

    this.observe = function(subject, topic, data) {
        switch(topic) {
            case "services:sso:login-successful":
                this.connect();
                break;
            case "services:sso:logout-successful":
                this.disconnect();
                break;
            case "collaboration:force-reconnect":
                this.connect();
                break;
        }
    };

    this.connect = function() {
        if (ko.collaboration.service.loggedIn)
            socket.socket.connect();
    };

    this.disconnect = function() {
        socket.disconnect();
    };

    this.authenticate = function authenticate() {
        let authStr = ko.collaboration.service.protocolVersion + "\n"
                      + ko.collaboration.service.ssoKey + "\n"
                      + mobwrite.syncUsername;
        socket.emit('komob_auth', authStr);
    };

    this.__defineGetter__('connected', function() {
        return socket.socket.connected;
    });
}).apply(ko.collaboration.socket);
ko.collaboration.socket.init();
