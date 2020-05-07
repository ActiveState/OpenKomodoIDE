this.EXPORTED_SYMBOLS = ['SSOSvc'];

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

let SSOSvc = {
    init: function SSOSvc_init() {
        this._obsSvc.addObserver(this, "network:offline-status-changed", false);
        this._obsSvc.addObserver(this, "services:sso:check-session", false);
        this._obsSvc.addObserver(this, "quit-application-granted", false);
        if (this.checkSetup())
            this.login();
    },

    shutdown: function SSOSvc_shutdown() {
        this._obsSvc.removeObserver(this, "network:offline-status-changed");
        this._obsSvc.removeObserver(this, "services:sso:check-session");
        this._obsSvc.removeObserver(this, "quit-application-granted");
    },

    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver]),
    
    get log() {
        if (!this._log)
            this._log = Components.classes["@activestate.com/koLoggingService;1"]
                .getService(Components.interfaces.koILoggingService)
                .getLogger("SSOSvc");
        return this._log;
    },

    get _obsSvc() {
        if (!this.__obsSvc)
            this.__obsSvc = Components.classes['@mozilla.org/observer-service;1']
                                .getService(Components.interfaces.nsIObserverService);
        return this.__obsSvc;
    },
    
    get prefs() {
        if (!this._prefs)
            this._prefs = Components.classes["@mozilla.org/preferences-service;1"]
                                    .getService(Components.interfaces.nsIPrefService)
                                    .getBranch("services.sso.");
        return this._prefs;
    },
    
    get ssoHost()  this.prefs.getCharPref('ssoHost'),
    
    set ssoHost(value) {
        if (value)
            this.prefs.setCharPref('ssoHost', value);
        else
            this.prefs.clearUserPref('ssoHost');
        return value;
    },
    
    get ssoUrl() this.ssoHost + '/komodo/',
    get ssoLoginUrl() this.ssoUrl + 'signin/',
    get ssoLogoutUrl() this.ssoUrl + 'signout/',
    get ssoPingUrl() this.ssoUrl + 'ping/',
    get ssoRealm() 'Komodo Services SSO',
    
    get email()  {
        return Credentials.id.username;
    },
    
    set email(value) {
        if (typeof value !== 'string')
            throw 'email must be a string';
        value = value.toLowerCase();
        if (value !== Credentials.id.username){
            Credentials.id.username = value;
             this._obsSvc.notifyObservers(this, "services:sso:account-changed",
                                          this.email);
        }
        return value;
    },
    
    get password() {
        return Credentials.id.password;
    },
    
    set password(value) {
        if (typeof value !== 'string')
            throw 'password must be a string';
        return Credentials.id.password = value;
    },
    
    // Persists `SSOSvc.email` and `SSOSvc.password` to nsILoginManager
    persistId: function SSOSvc_persistId() {
        return Credentials.persistId();
    },
    
    // User id and session key are provided by the server once we have logged
    // in successfully.
    get userId() {
        let userId = null;
        try { userId = this.prefs.getCharPref('userId'); } catch(e) {};
        return userId;
    },
    
    set userId(value) {
        if (value)
            this.prefs.setCharPref('userId', value.toString());
        else
            try { this.prefs.clearUserPref('userId'); } catch(e) {}
        return value;
    },
    
    get sessionKey() {
        let sessionKey = null;
        try { sessionKey = this.prefs.getCharPref('sessionKey'); } catch(e) {};
        return sessionKey;
    },
    
    set sessionKey(value) {
        if (value)
            this.prefs.setCharPref('sessionKey', value);
        else
            try { this.prefs.clearUserPref('sessionKey'); } catch(e) {}
        return value;
    },
    
    get offline() {
        if (!this._ioSvc)
            this._ioSvc = Components.classes['@mozilla.org/network/io-service;1']
                .getService(Components.interfaces.nsIIOService);
        return this._ioSvc.offline;
    },
    
    _loggedIn: false,
    get loggedIn()  this._loggedIn,
    set loggedIn(value) {
        if (typeof value !== 'boolean')
            throw 'loggedIn must be boolean';
        
        if (value != this._loggedIn) {
            // Assign and check for truth
            this._loggedIn = value;
            if (value)
                var topic = "services:sso:login-successful";
            else
                topic = "services:sso:logout-successful";
            this._obsSvc.notifyObservers(this, topic, null);
            this._hideLoginErrorNotification();
        }
        return this._loggedIn;
    },
    
    checkSetup: function SSOSvc_checkSetup() {
        return !!(this.email && this.password);
    },
    
    /**
     *  Does whatever is necessary to log in. Note that this is asynchronous
     *  and observers will be notified about the results.
     */
    login: function SSOSvc_login(email, password) {
        try {
            // Don't send multiple XHR simultaneously
            if (this.loggingIn) {
                this.log.debug("SSO is already logging in")
                return;
            }
            this.loggingIn = true;
            
            // If we are already logged in or still have an old session key
            // cached in prefs, check if we can still authenticate.
            // `verifySession` will automatically call `_login` if not.
            if ((this.sessionKey && this.userId) && !(email || password)) {
                this._verifySession();
            } else {
                if (email)
                    this.email = email;
                if (password)
                    this.password = password;
                if (!this.email || !this.password)
                    throw "email and password required to log in!";
                
                this._login();
            }
        } catch(e) {
            this.log.error("-----\nError in SSOSvc.login()");
            this.log.error(e);
            this.log.error(e.stack);
            this.log.error("-----")
            this.loggingIn = false;
        }
    },

    /**
     * Performs an XHR to account.as.com retrieve a user id and session key
     * in exchange for a valid email and password combination. Called by `login`.
     */
    _login: function SSOSvc__login() {
        try {
            var onLoginSuccess = function() {
                let resp;
                try {
                    resp = JSON.parse(req.responseText);
                } catch(e) {
                    this.log.warn('Error parsing login response');
                    this.log.error(e);
                    onLoginError(req).call(this);
                    return;
                }
                this.loggingIn = false;
                if (!(resp.hasOwnProperty('sessionKey')
                      && resp.hasOwnProperty('userId'))) {
                    this.log.error('Invalid server response during SSO login!');
                    onLoginError(req).call(this);
                    return;
                }
                this.userId = resp.userId.toString(); // server sends an int
                this.sessionKey = resp.sessionKey;
                this.persistId();
                this.loggedIn = true;
            }
            
            var onLoginError = function() {
                // TODO check response code to distinguish server error from
                // failed authentication.
                this.loggingIn = false;
                this.loggedIn = false;
                this._showLoginErrorNotification();
                this._obsSvc.notifyObservers(this,
                                             'services:sso:login-failed',
                                             null);
            }

            var credentials = 'email=' + encodeURIComponent(this.email) +
                              '&password=' + encodeURIComponent(this.password);
            var req = this._makeRequest(this.ssoLoginUrl, 'POST', credentials,
                                        onLoginSuccess.bind(this),
                                        onLoginError.bind(this));
            
        } catch(e) {
            this.loggingIn = false;
            this.loggedIn = false;
            this.log.warn("Error during SSO login.");
            this.log.error(e);
            this._showLoginErrorNotification();
            this._obsSvc.notifyObservers(this,
                                         'services:sso:login-error',
                                         null);
            throw e;
        }
    },
    
    /**
     * Send a request to the server to check if the session key is still valid.
     */
    _verifySession: function SSOSvc__verifySession() {
        if (!this.userId || !this.sessionKey)
            throw "User id and session key required.";
        
        var onSuccess = function() {
            // We have a valid session.
            this.loggingIn = false;
            if (!this.loggedIn)
                this.loggedIn = true;
        }
        var onError = function() {
            // Can be a communication error or an invalid key. Call `_login`
            // to find out.
            this.loggingIn = false;
            if (this.loggedIn)
                this.loggedIn = false;
            this.sessionKey = null;
            this._login();
        }

        var url = this.ssoPingUrl + encodeURIComponent(this.userId) + '/';
        var credentials = 'sessionKey=' + encodeURIComponent(this.sessionKey);
        var req = this._makeRequest(url, 'POST', credentials,
                                    onSuccess.bind(this),
                                    onError.bind(this));
    },
    
    logout: function SSOSvc_logout() {
        // TODO delete?
        if (!this.loggedIn)
            return;
        if (!this.sessionKey) {
            this.loggedIn = false;
            return;
        }
        try {
            var credentials = 'sessionKey=' + encodeURIComponent(this.sessionKey);
            var req = this._makeRequest(this.ssoLogoutUrl, 'POST', credentials,
                                        this._onLogoutSuccess.bind(this),
                                        this._onLogoutError.bind(this));
        } catch(e) {
            this.log.warn("Error during SSO logout.");
            this.log.error(e);
            this._obsSvc.notifyObservers(this,
                                         'services:sso:logout-error',
                                         null);
            throw e;
        }
    },
    
    _onLogoutSuccess: function SSOSvc__onLogoutSuccess() {
        this.userId = null;
        this.sessionKey = null;
        this.loggedIn = false;
    },
    
    _onLogoutError: function SSOSvc__onLogoutError() {
        this.log.warn("Error during SSO logout.");
        // Stop using the current user id/session key.
        this._onLogoutSuccess();
    },
    
    reset: function SSOSvc_reset() {
        Credentials.removeId();
        this.logout();
        this.userId  = null;
        this.sessionKey = null;
        this._obsSvc.notifyObservers(this, 'services:sso:account-changed', null);
    },
    
    observe: function SSOSvc_observe(subject, topic, data) {
        switch(topic) {
            case "network:offline-status-changed":
                // TODO
                break;
            case "services:sso:check-session":
                // One of the services asks us to request a new session key.
                this.login();
            case "quit-application-granted":
                this.shutdown();
        }
    },
    
    _makeRequest: function(url, method, post, successCallback, errorCallback) {
        var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
                            .createInstance(Components.interfaces.nsIXMLHttpRequest);
        if (req) {
            var callback = function makeRequest_callback() {
                if (req.readyState == 4) {
                    if (req.status >= 200 && req.status < 300)
                        successCallback();
                    else
                        errorCallback();
                }
            };
            req.onreadystatechange = callback;
            req.open(method, url, true);
            if (post) {
                req.setRequestHeader("Content-type",
                                     "application/x-www-form-urlencoded");
                req.setRequestHeader("Content-length", post.length);
            }
            req.send(post);
        }
        return req;
    },

    get _notifications() {
        delete this._notifications;
        var {KoNotificationManagerWrapper} =
            Cu.import("resource://gre/modules/notifications.js", {});
        this._notifications = new KoNotificationManagerWrapper(null);
        return this._notifications;
    },
    
    _showLoginErrorNotification: function SSOSvc__showLoginErrorNotification() {
        if (!this._loginErrorNotification) {
            this._loginErrorNotification = this._notifications.add(
                this._getString("notification.loginError.title"), // summary
                ["signon"], // tags
                "sso-login-error-" + Date.now() + "-" + Math.random(), // id
                {
                    actions: [{
                        identifier: "open-preferences",
                        label: this._getString("notification.openPreferences"),
                        handler: (notification, id) => this.openSetup(),
                    }],
                    description: this._getString("notification.loginError.description"),
                    severity: Ci.koINotification.SEVERITY_WARNING,
                });
        }
    },

    _hideLoginErrorNotification: function SSOSvc__hideLoginErrorNotification() {
        if (this._loginErrorNotification)
            this._notifications.remove(this._loginErrorNotification);
    },

    openSetup: function() {
        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                    .getService(Components.interfaces.nsIWindowMediator);
        var win = wm.getMostRecentWindow("KomodoServices:Setup");
        if (win)
          win.focus();
        else {
            var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                               .getService(Components.interfaces.nsIWindowWatcher);
            win = ww.openWindow(null, "chrome://services/content/setup.xul",
                                "komodo-services-setup-window",
                                "chrome=yes,centerscreen=yes,resizable=yes,modal=no", null);
        }
    },
    
    get _strBundle() {
        if (!this.__strBundle)
            this.__strBundle = Components.
                classes["@mozilla.org/intl/stringbundle;1"].
                getService(Components.interfaces.nsIStringBundleService).
                createBundle("chrome://services/locale/sso.properties");
        return this.__strBundle;
    },
    
    _getString: function SSOSvc__getString(name) {
        try {
            return this._strBundle.GetStringFromName(name);
        } catch(e) {
            // Obscure, undocumented interface. `name` probably doesn't exist.
            this.log.warn('Could not get String ' + name);
            return name;
        }
    }
};

let Credentials = {
    loginManager: Components.classes["@mozilla.org/login-manager;1"]
                            .getService(Components.interfaces.nsILoginManager),
    
    _findId: function _findId() {
        var id = null;
        var logins = this.loginManager.findLogins({}, SSOSvc.ssoHost, null, SSOSvc.ssoRealm);
        if (logins.length > 0)
            id = logins[0];
        return id;
    },
    
    _newId: function _newId() {
        var newId = Components.classes["@mozilla.org/login-manager/loginInfo;1"]
                           .createInstance(Components.interfaces.nsILoginInfo);
        newId.hostname = SSOSvc.ssoHost;
        newId.httpRealm = SSOSvc.ssoRealm;
        newId.formSubmitURL = null;
        newId.usernameField = '';
        newId.passwordField = '';
        return newId;
    },
    
    /**
     * Returns the nsILoginInfo record that stores SSO login data. If there is
     * no such record, an unsaved record is returned.
     */
    get id() {
        if (!this._id)
            this._id = this._findId();
        if (!this._id)
            this._id = this._newId();
        return this._id;
    },
    
    /**
     * Persists the current state of `this.id` with `nsILoginManager`.
     */
    persistId: function persistId() {
        var oldId = this._findId()
        var newId = this.id;
        if (oldId)
            this.loginManager.modifyLogin(oldId, newId);
        else
            this.loginManager.addLogin(newId);
        return newId;
    },
    
    /**
     * Removes the stored id from nsILoginManager.
     */
    removeId: function() {
        // Ignore what's in `this.id`- it could have unsaved changes, that
        // should be discarded. Use the real record to call `removeLogin`.
        this._id = null;
        var id = this._findId();
        if (id) {
            try {
                this.loginManager.removeLogin(id);
            } catch(e) {
                SSOSvc._log("Could not remove SSO login: " + e);
            }
        }
    }
};

SSOSvc.init();