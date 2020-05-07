(function() {

    if (typeof Cc == "undefined") {
        var {Cc, Ci, Cu} = require("chrome");
    }
     
    const prefs = require("ko/prefs");
    const ajax = require("ko/ajax");
    const log = require("ko/logging").getLogger("Platform Auth");
    const legacy = require("ko/windows").getMain().ko;
    log.setLevel(require("ko/logging").LOG_INFO);
    //log.setLevel(require("ko/logging").LOG_DEBUG);

    var pwManager = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

    this.apiKeyUrlForPWM = "apikey.login.tld";
    this.userUrlForPWM = "user.login.tld";
    this.privkeyUrlForPWM = "privkey.login.tld";
    this.totpUrlForPWM = "totp.login.tld";

    var apiUrl = prefs.getStringPref("platform.api.url");

    log.info("Using API URL: " + apiUrl);

    /* Callback should take a bool, True for success and False for failed authentication */
    this.authenticated = (callback) =>
    {
        log.debug("authenticated");
        let credentials = this.getCredentials(this.apiKeyUrlForPWM);
        if (credentials && this.getCredentials(this.userUrlForPWM)) {
            this.loginWithKey(credentials.password, (code) => {
                // 0 means not connected to the internet
                if (code == "200" || code == "0") {
                    log.debug("Authenticated: "+true);
                    callback(true);
                } else {
                    log.debug("Authenticated: "+false);
                    this.removeSavedKeys();
                    callback(false);
                }
            });
        } else {
            log.debug("Authenticated: "+false);
            callback(false);
        }
    };

    this.getCredentials = (url) =>
    {
        log.debug("getCredentials");
        let pws = pwManager.findLogins({}, url, url, null);
        if (pws.length == 1)
        {
            return pws[0];
        } else
        {
            return;
        }
    };

    let getLoginDefaults = (url) =>
    {
        let loginInfo = Cc["@mozilla.org/login-manager/loginInfo;1"]
            .createInstance(Ci.nsILoginInfo);
        loginInfo.formSubmitURL = url;
        loginInfo.hostname = url;
        loginInfo.httpRealm = null;
        loginInfo.username = ""; // can't be null
        loginInfo.usernameField = ""; // can't be null
        loginInfo.passwordField = "";// can't be null
        return loginInfo;
    };

    this.saveUser = (username, password, totp = "") => 
    {
        log.debug("saveUser");
        let loginInfo = getLoginDefaults(this.userUrlForPWM);
        let existing = this.getCredentials(this.userUrlForPWM);
        let totpLoginInfo = getLoginDefaults(this.totpUrlForPWM);
        let totpExisting = this.getCredentials(this.totpUrlForPWM);

        loginInfo.username = username;
        loginInfo.password = password;
        totpLoginInfo.password = totp;

        if(existing)
            pwManager.modifyLogin(existing, loginInfo);
        else
            pwManager.addLogin(loginInfo);

        if(totp){
            if(totpExisting)
                pwManager.modifyLogin(totpExisting, totpLoginInfo);
            else
                pwManager.addLogin(totpLoginInfo);
        }
    };

    // This can be called to just
    this.saveSecret = (url, value) =>
    {
        log.debug("saveSecret");
        let loginInfo = getLoginDefaults(url);
        
        loginInfo.password = value;
        let pw = this.getCredentials(url);
        
        if(pw) {
            pwManager.modifyLogin(pw, loginInfo);
        } else {
            pwManager.addLogin(loginInfo);
        }
    };

    this.removeSavedKeys = () =>
    {
        log.debug("removeSavedKeys");
        var urls = [this.apiKeyUrlForPWM, this.userUrlForPWM, this.privkeyUrlForPWM];
        for (let url of urls) 
        {
            let pws = pwManager.findLogins({}, url, url, null);
            if(pws)
            {
                log.debug("Removing keys");
                for (var i = 0; i < pws.length; i++)
                {
                   pwManager.removeLogin(pws[i]);
                }
            }
        }
    };
    
    this.logout = () =>
    {
        log.debug("logout");
        this.loginAgain();
    };
    
    this.loginAgain = () =>
    {
        log.debug("loginAgain");
        this.removeSavedKeys();
        this.loginDialog();
    };
   
    this.loginWithKey = (apikey, callerCallback) =>
    {
        log.debug("loginWithKey");
        this.login(JSON.stringify({"token":apikey}), callerCallback);
    };
   
    this.loginWithUser= (username, password, callerCallback, totp="") =>
    {
        log.debug("loginWithUser");
        this.login(JSON.stringify({password:password,username:username,totp:totp}), callerCallback);
    };
    
    this.loginDialog = () =>
    {
        log.debug("loginDialog");
        var winOptions = 
        // #if PLATFORM == "darwin"
                "chrome,resizable=no,menubar,toolbar,status,all,dialog=no,centerscreen=yes,modal";
        // #else
                "chrome,resizable=no,menubar,toolbar,status,all,centerscreen=yes,modal";
        // #endif
        let returnObj = {}
        legacy.windowManager.openWindow(
            "chrome://komodo/content/login/login.xul",
            "_blank", winOptions, returnObj);
        return returnObj.OK;
    }

    // login and get the JWT token to perform the komodo auth step and API key step
    this.login = (body, callerCallback) =>
    {
        log.debug("login");
        let callback = (code, response) =>
        {
            let jsonResp;
            try {
                jsonResp = JSON.parse(response);
            } catch (e) {
                log.error("Login failed with: " + e.message);
                log.error("Response: " + response, true);
            }

            if(code == "200" && jsonResp)
            {
                if( ! this.getCredentials(this.apiKeyUrlForPWM))
                {
                     this.getAPIKey(jsonResp.token, callerCallback);
                } else
                {
                    callerCallback(code);
                }
            }
            else if (jsonResp)
            {
                callerCallback(code, "Login failed with message: " + jsonResp.message + "  Please try again.");
            } 
            else if (code == "0")
            {
                callerCallback(code, "Login failed, it appears you are offline.");
                log.error("Response: "+ response);
            }
            else 
            {
                callerCallback(code, "Login failed due to an unknown reason. Please try again or contact support.");
                log.error("Response: "+response);
            }
        };

        let params =
        {
            url : apiUrl+"/login",
            method : "POST",
            body : body,
            headers : {"Content-Type": "application/json"}
        };
        send(params, callback);
    };
   
   // get API token to save and use for subsequent logins
    this.getAPIKey = (jToken, callerCallback) =>
    {
        log.debug("getAPIKey");
        let callback = (code, response) =>
        {
            let jsonResp;
            try {
                jsonResp = JSON.parse(response);
            } catch (e) {
                log.error("apikeys request failed with: " + e.message);
                log.error("Response: " + response, true);
            }
            if(code == "200" && jsonResp)
            {
                this.saveSecret(this.apiKeyUrlForPWM, jsonResp.token);
                callerCallback(code);
            }
            else if (jsonResp)
            {
                callerCallback(code, "Cannot complete login: " + jsonResp.message + ".  Please try again.");
            } 
            else 
            {
                callerCallback(code, "Login failed due to an unknown reason.  Please try again or contact support.");
                log.error("Response: "+response);
            }
        };
        var params =
        {
            url : apiUrl+"/apikeys",
            method : "POST",
            body : JSON.stringify({name:"Komodo IDE Usage Token"}),
            headers :
            {
                "Content-Type": "application/json",
                'Authorization': "Bearer "+jToken
            }
        };
        send(params, callback);
   };

    var send = (params, callback) =>
    {
        log.debug("send");
        ajax.request2(params, callback);
    };
    
}).apply(module.exports);