(function() {

    let { Cc, Ci } = require('chrome');

    const log = require("ko/logging").getLogger("Platform Login");
    //log.setLevel(require("ko/logging").LOG_DEBUG);
    const $ = require("ko/dom").window(window);
    const prefs = require("ko/prefs");
    const _window = require("ko/windows").getMain();
    const legacy = _window.ko;
    const auth = require("ko/auth");
    const state = require("state/tool");
    const notify = require("notify/notify");

    var platformURL = prefs.getStringPref("platform.url");
    var returnObj = window.arguments[0];

    var elems =
    {
        $main : null, // ko/dom object
        explBody : null, // ko/ui object
        loginContent : null, // ko/ui object
        loadingContent : null, // ko/ui object
        username : null, // ko/ui object
        password : null, // ko/ui object
        twoStepAuthCode : null, // ko/ui object
        statusText : null, // ko/ui object
        statusIcon : null, // ko/ui object
        notifications : null, // ko/ui object
    };

    this.init = () =>
    {
        elems.$main = $("#login-box");
        createFields();
        elems.loadingContent.hide();
        elems.loginContent.show();
        setTimeout(() => window.sizeToContent(), 1000);
    };
    
    var createFields = () =>
    {
        elems.$main.append(
            require("ko/ui/label").create(
                "Sign in to your ActiveState Platform account",
                {"class":"title"}
            ).$element
        );
        elems.$main.append(getLoadingFields().$element);
        let explainField = getExplanationField();
        
        elems.$main.append(explainField.$element);
        elems.notifications = require("ko/ui/container").create({"class": "error"});
        elems.$main.append(elems.notifications.$element);
        hideNotifications();

        let loginFields = getLoginFields();
        loginFields.hide(); // Don't want to see them right now.
        elems.$main.append(loginFields.$element);
    };
    
    var showExplanation = () =>
    {
        hideNotifications();
        elems.loginContent.hide();
        elems.explBody.show();
        window.sizeToContent();
    };
    
    var hideExplanation = () =>
    {
        elems.explBody.hide();
        elems.loginContent.show();
        window.sizeToContent();
    };
    
    var getExplanationField = () =>
    {
        let explLinkContent = require("ko/ui/column").create({"class": "header"});
        let whyBtn = require("ko/ui/button").create("Why do I have to Sign In?",{"class":"link"});
        whyBtn.on("click", openBrowser.bind(this,prefs.getStringPref("doc_site")+"/11/komodo-platform-login/"));
        explLinkContent.addRow(whyBtn);        
        
        elems.explainContent = require("ko/ui/column").create({"class":"explanation-wrapper"});
        elems.explainContent.addElement(explLinkContent);
        return elems.explainContent;
    };
    
    var getLoadingFields = () =>
    {
        elems.loadingContent = require("ko/ui/container").create();
        elems.statusText = require("ko/ui/description").create("Checking license...");
        elems.statusIcon = require("ko/ui/spinner").create();
        elems.loadingContent.addRow([elems.statusText, elems.statusIcon]);
        return elems.loadingContent;
    };
    
    var openBrowser = (link) =>
    {
        legacy.browse.openUrlInDefaultBrowser(link);
    };
        
    var getLoginFields = () =>
    {
        let pw = auth.getCredentials(auth.apiKeyUrlForPWM);
        elems.loginContent = require("ko/ui/column").create({"class":"form-wrapper"});
        elems.username = require("ko/ui/textbox").create({value: pw ? pw.username : ""});
        elems.password = require("ko/ui/textbox").create({type:"password",id:"password"});
        elems.twoStepAuthCode = require("ko/ui/textbox").create({id:"stepauth", label:"Two-factor authentication code", placeholder:"eg. 123456"});
        elems.twoStepAuthCodeCont = require("ko/ui/column").create(
            [require("ko/ui/label").create("Two-Factor Code",{for:"stepauth"}),elems.twoStepAuthCode]
        )
        elems.twoStepAuthCodeCont.hide();

        // Submit form with enter
        var keydownHandler = (e) => {
            if (e.keyCode == 13) // ENTER
            {
                e.preventDefault();
                e.stopPropagation();
                login();
            }
        }
        elems.username.on('keydown', keydownHandler);
        elems.password.on('keydown', keydownHandler);
        elems.twoStepAuthCode.on('keydown', keydownHandler);
        
        let loginButton = require("ko/ui/button").create({label:"Sign In", "class":"sign-in"});
        loginButton.on("click", login);
        
        let cancelButton = require("ko/ui/button").create({label:"Cancel", "class":"cancel secondary"});
        cancelButton.on("click", onCancel);
        
        let forgotBtn = require("ko/ui/button").create("Forgot Password", {"class":"link"});
        forgotBtn.on("click", openBrowser.bind(this, platformURL+"forgot-password"));
        
        let createBtn = require("ko/ui/button").create("Create Account", {"class":"link"});
        createBtn.on("click", openBrowser.bind(this, platformURL+"create-account"+prefs.getStringPref("platform.createAccountstr")));
        
        elems.loginContent.addElement([
            require("ko/ui/column").create(
                [require("ko/ui/label").create("Username or Email",{for:"user"}),elems.username]
            ),
            require("ko/ui/column").create(
                [require("ko/ui/label").create("Password",{for:"password"}),elems.password]
            ),
            elems.twoStepAuthCodeCont,
            require("ko/ui/row").create([loginButton,cancelButton]),
            require("ko/ui/row").create(
            [
                forgotBtn,
                require("ko/ui/description").create("."),
                require("ko/ui/description").create("Don't have an account?"),
                createBtn
            ], {"class":"help"})
        ]);
        return elems.loginContent;
    };

    var loadNotification = (msg, code) =>
    {
        elems.notifications.empty();
        elems.notifications.show();
        if (code == "401")
        {
            elems.notifications.addRow(require("ko/ui/span").create(msg || "Password or Username incorrect.  Please try again."));
        } else if (code == "498")
        {
            elems.notifications.addRow(require("ko/ui/span").create(msg || "Token expired.  Please login again."));
        } else if(code =="449")
        {
            elems.notifications.addRow(require("ko/ui/span").create(msg || "Two Step Authentication enabled.  Please enter Two Step Token."));
            elems.twoStepAuthCodeCont.show();
        }else
        {
            elems.notifications.addRow(require("ko/ui/span").create(msg));
        }
        window.sizeToContent();
    };

    var showLoading = () => 
    {
        elems.username.disable();
        elems.password.disable();
        elems.username.attr("style", "opacity: 0.4");
        elems.password.attr("style", "opacity: 0.4");
    };

    var hideLoading = () => 
    {
        elems.username.enable();
        elems.password.enable();
        elems.username.removeAttr("style");
        elems.password.removeAttr("style");
    };
  
    var login = () => 
    {
        hideNotifications();
        if( ! validFields())
        {
            return;
        }
        
        let username = elems.username.value();
        let password = elems.password.value();
        let totp = elems.twoStepAuthCode.value();

        showLoading();

        auth.loginWithUser(username, password, (code, message) => 
        {
            hideLoading();
            if (code == "200") 
            {
                auth.saveUser(username, password, totp);
                onSuccess();
            }
            else 
            {
                loadNotification(message, code);
            }
        }, elems.twoStepAuthCode.value());
    };
    
    var hideNotifications = () =>
    {
        elems.notifications.hide();
    };
    
    var validFields = () =>
    {
        if ((elems.username && elems.username.value() == "" ) ||
            (elems.password && elems.password.value() == "" ))
        {
            loadNotification("Please fill out all fields");
            return false;
        }
        return true;
    };
    
    var onCancel = () =>
    {
        returnObj["OK"] = false;
        window.close();
    };
    
    var onSuccess = () =>
    {
        let savePrivKey = () => {
            state.exportPrivKey({
                onSuccess: (result) => {
                    auth.saveSecret(auth.privkeyUrlForPWM, result);
                },
                onFail: (code, err) => {
                    log.error("Could not save private key, code: " + code + "\nerror: " + err);
                    notify.send("Saving private key failed with: " + err, "state",
                    {
                        duration: 10000,
                        priority: "error",
                    });
                }
            });
        };
        
        setTimeout(() => {
            if (state.installed()) {
                savePrivKey();
            } else {
                state.installBackground(savePrivKey);
            }
        }, 0);
        
        returnObj["OK"] = true;
        window.close();
    };
    
    window.addEventListener("load", this.init);

})();