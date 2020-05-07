Components.utils.import('resource://services/sso.js');

function openUILinkIn(url) {
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                    .getService(Components.interfaces.nsIWindowMediator);
    var win = wm.getMostRecentWindow('Komodo');
    win.ko.browse.openUrlInDefaultBrowser(url);
}

var setupWindow = {
    obsSvc: Components.classes['@mozilla.org/observer-service;1']
                      .getService(Components.interfaces.nsIObserverService),
    
    // Events to subscribe to
    _events: ['services:sso:login-successful',
              'services:sso:login-failed',
              'services:sso:login-error',
              'services:sso:logout-successful',
              'services:sso:logout-error'],
    
    get loginButton() document.getElementById('button-login'),
    get resetButton() document.getElementById('button-reset'),
    get emailField()  document.getElementById('email-field'),
    get passwordField() document.getElementById('password-field'),
    
    _updateFields: function _updateFields() {
        // Fill the user/password fields
        this.emailField.value = SSOSvc.email;
        this.passwordField.value = SSOSvc.password;
    },
    
    onLoad: function onLoad() {
        this._updateFields();
        if (SSOSvc.loggedIn)
            this.onLogin();
        else
            this.onLogout();
        for each (let event in this._events)
            this.obsSvc.addObserver(this, event, false);
    },
    
    onLogin: function onLogin() {
        this.loginButton.setAttribute('hidden', true);
        this.loginButton.setAttribute('disabled', true);
        this.resetButton.setAttribute('hidden', false);
        this.setThrobberVisible(false);
        this.setStatusLabel('You\'re logged in to Komodo Services', 'success');
        this.emailField.readOnly = true;
        this.passwordField.readOnly = true;
    },
    
    onLogout: function onLogout() {
        this.loginButton.setAttribute('hidden', false);
        this.loginButton.setAttribute('disabled', false);
        this.resetButton.setAttribute('hidden', true);
        this.setThrobberVisible(false);
        this.setStatusLabel('');
        this.emailField.readOnly = false;
        this.passwordField.readOnly = false;
    },
    
    onLoginFailed: function onLoginFailed() {
        this.loginButton.setAttribute('hidden', false);
        this.loginButton.setAttribute('disabled', false);
        this.resetButton.setAttribute('hidden', true);
        this.setThrobberVisible(false);
        this.setStatusLabel('Login failed. Check your username and password.',
                            'error');
    },
    
    onError: function onError() {
        this.loginButton.setAttribute('hidden', false);
        this.resetButton.setAttribute('hidden', true);
        this.setThrobberVisible(false);
        this.setStatusLabel('An error occurred. Try again later.', 'error');
    },
    
    onUnload: function onUnload() {
        for each (let event in this._events)
            this.obsSvc.removeObserver(this, event, false);
    },
    
    observe: function observe(subject, topic, data) {
        switch(topic) {
            case 'services:sso:login-successful':
                this.onLogin();
                break;
            case 'services:sso:login-failed':
                this.onLoginFailed()
                break;
            case 'services:sso:logout-successful':
                this.onLogout();
                break;
            case 'services:sso:login-error':
            case 'services:sso:logout-error':
                this.onError();
                break;
        }
    },
    
    setStatusLabel: function setStatusLabel(value, className) {
        var statusLabel = document.getElementById('label-login-status');
        statusLabel.setAttribute('value', value);
        if (className)
            statusLabel.setAttribute('class', className);
        else
            statusLabel.removeAttribute('class');
    },
    
    setThrobberVisible: function setThrobberVisible(visible) {
        var throbber = document.getElementById('throbber-login-status');
        throbber.setAttribute('hidden', !visible);
    },
    
    doLogin: function doLogin() {
        var email = this.emailField.value;
        var password = this.passwordField.value;
        if (!email || !password) {
            this.setStatusLabel('Please enter your account data.');
            return;
        }
        this.setStatusLabel('Logging in')
        this.setThrobberVisible(true);
        // Pass in email and password to have them persisted if this is successful.
        SSOSvc.login(email, password);
    },
    
    doResetSSO: function doResetSSO() {
        SSOSvc.reset();
        this._updateFields();
    }
};

window.addEventListener('load', function() { setupWindow.onLoad(); }, false);
window.addEventListener('unload', function() { setupWindow.onUnload(); }, false);
