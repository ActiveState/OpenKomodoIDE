(function () {
    const locale = require("ko/locale");
    const state = require("state/tool");
    const $ = require("ko/dom").window(window);
    const okClass = "state-ok";
    const errClass = "state-error";
    const warnClass = "state-warning";
    const okIcon = "icon-ok";
    const errIcon = "icon-error";
    const warnIcon = "icon-warn";
    const textboxClass = "secret_textbox";
    const errorBoxClass = "error-box";
    const log = require("ko/logging").getLogger("secretsDialog.js");
    //log.setLevel(log.DEBUG);
    
    var elems = {
        msgField: null,
        saveBtn: null,
        cancelBtn: null,
        statusSymbol: null,
        spinner: null,
        nameField: null,
        valueField: null,
    };
    
    var local = {secretsDict: {}};

    var init = () => {
        $("window").append(getContent());
        elems.nameField.$element.focus();
        getSecrets();
    };

    var row = (sdkElems) => {
        return require("ko/ui/row").create(sdkElems);
    };

    var getContent = () => {
        let container = require("ko/ui/column").create();

        let groupbox = require("ko/ui/groupbox").create({ caption: "Manage Secret" });
        container.add(groupbox);

        groupbox.add(secretsList());
        groupbox.add(nameField());
        groupbox.add(scopeField());
        groupbox.add(valueField());

        let statusbox = require("ko/ui/groupbox").create({ caption: "Status", id: "status" });
        container.add(statusbox);
        statusbox.add([msgField(), symbolIndicator(), spinner()]);

        let buttonRow = row({ class: "buttons-ui" });
        container.add(buttonRow);
        buttonRow.add([saveButton(), cancelButton()]);

        return container.element;
    };
    
    // We're starting a `secret set` call
    var startActionUI = (msg) => {
        log.debug("_startActionUI");
        elems.saveBtn.disable();
        elems.nameField.disable();
        elems.secretsMenu.disable();
        elems.scopeField.disable();
        elems.valueField.disable();
        elems.statusSymbol.hide();
        okMsg(msg);
        elems.spinner.show();
    };

    var endActionUI = (succeeded, msg) => {
        log.debug("_endActionUI");
        if (succeeded) {
            elems.saveBtn.enable();
            elems.nameField.enable();
            elems.secretsMenu.enable();
            elems.scopeField.enable();
            elems.valueField.enable();
            elems.statusSymbol.$element.removeClass(errIcon);
            elems.statusSymbol.$element.removeClass(warnIcon);
            elems.statusSymbol.$element.addClass(okIcon);
            elems.spinner.hide();
            okMsg(msg);
            elems.statusSymbol.show();
        } else {
            if (!msg)
                msg = "Could not set secret.  Please check the logs.";
            error(msg);
        }
    };
    
    var startSecretsListActionUI = (msg) => {
        log.debug("_startSecretsListActionUI");
        log.debug("msg: "+msg);
        updateSecretMenuDefault(msg);
        startActionUI(msg);
    };
    var endSecretsListActionUI = (succeeded, msg, defaultMenuItem) => {
        log.debug("_endSecretsListActionUI");
        log.debug("msg: "+msg);
        endActionUI(succeeded, msg);
        
        if(succeeded)
            enableMenuWithMsg(defaultMenuItem);
        else
            disableMenuWithMsg(defaultMenuItem);
    };
    
    var disableMenuWithMsg = (msg) => {
        log.debug("_disableMenuWithMsg");
        log.debug("msg: "+msg);
        updateSecretMenuDefault(msg);
        elems.secretsMenu.disable();
    };
    
    var enableMenuWithMsg = (msg) => {
        log.debug("_enableMenuWithMsg");
        log.debug("msg: "+msg);
        updateSecretMenuDefault(msg);
        elems.secretsMenu.enable();
    };
    
    var updateSecretMenuDefault = (msg) => {
        log.debug("_updateSecretMenuDefault");

        if (elems.secretsMenu.menupopup) {
            elems.secretsMenu.menupopup.empty();
        }
        
        let menuitem = require("ko/ui/menuitem").create(
        {
            value: msg,
            label: msg,
            disabled: true,
        });
        elems.secretsMenu.addMenuItem(menuitem);
        elems.secretsMenu.value(msg);
        getSelectedSecret();
    };
    
    var updateFieldsWithSecret = (secret) => {
        log.debug("_updateFieldsWithSecret");
        elems.nameField.value(secret.name || "");
        
        elems.scopeField.value(secret.scope || "user");
        
        elems.valueField.value(secret.value || "");
        
        updateCachedSecrets(secret);
    };
    
    var saveButton = () => {
        let btn = elems.saveBtn = require("ko/ui/button").create("Save");
        
        btn.on("command", () => {
            let secret = {
                name : elems.nameField.value(),
                scope : elems.scopeField.value(),
                value : elems.valueField.value(),
            };
            if (!valid())
                return;

            startActionUI(locale.get("secret_dialog_setting_secret"));

            var onComplete = () => {
                endActionUI(true, locale.get("secret_dialog_secret_set"));
                updateCachedSecrets(secret);
                updateSecretMenuDefault(secret.scope+"."+secret.name);
            };

            var onFail = (code, msg) => {
                endActionUI(false, msg);
            };

            var callbacks = {
                onSuccess: onComplete,
                onFail: onFail,
            };
            state.setSecret(secret.name, secret.scope, "", secret.value, callbacks);
        });
        return btn;
    };

    var cancelButton = () => {
        let btn = elems.cancelBtn = require("ko/ui/button").create("Cancel");
        btn.on("command", () => {
            window.close();
        });
        return btn;
    };
    
    // Because changing either of these fields means you're working on a different
    // we update to either change selected menu item to `select secret` to disassociate
    // the fields from the selected secret or update the fields and list if the 
    // new combination already exists
    var onScopeOrNameChange = () => {
        let secretNamespace = elems.scopeField.value()+"."+elems.nameField.value();
        
        let secret = getCachedSecret(secretNamespace, false);
        if (secret){
            updateFieldsWithSecret(secret);
            enableMenuWithMsg(secretNamespace);
            return;
        } else {
            if (Object.keys(local.secretsDict).length >= 1)
                enableMenuWithMsg(locale.get("secret_dialog_select_secrets"));
            else
                disableMenuWithMsg(locale.get("secret_dialog_no_secrets"));
        }
    };

    var nameField = () => {
        let label = require("ko/ui/label").create(
            locale.get("secret_dialog_name"));

        let txt = elems.nameField = require("ko/ui/textbox").create({ class: textboxClass });
        // Remove validation warning styling
        txt.onChange(() => {
            onScopeOrNameChange();
            // remove error styling
            txt.$element.removeClass(errorBoxClass);
        });

        return row([label, txt]);
    };

    var scopeField = () => {
        let items =
        [
            {
                attributes: {
                    label: locale.get("secret_dialog_radio_user"),
                    value: locale.get("secret_dialog_radio_user").toLowerCase()
                }
            },
            {
                attributes: {
                    label: locale.get("secret_dialog_radio_project"),
                    value: locale.get("secret_dialog_radio_project").toLowerCase()
                }
            }
        ];
        let scopeField = elems.scopeField = require("ko/ui/radiogroup").create(locale.get("secret_dialog_scope"), items);
        // scopeField.value(locale.get("secret_dialog_radio_user").toLowerCase());
        scopeField.attr("id", "scope");
        scopeField.value(locale.get("secret_dialog_radio_user").toLowerCase());
        
        scopeField.onChange(onScopeOrNameChange);

        return row([scopeField]);
    };

    var valueField = () => {
        let label = require("ko/ui/label").create(
            locale.get("secret_dialog_value"));

        let txt = elems.valueField = require("ko/ui/textbox").create({ id: "value_field" });
        // Remove validation warning styling
        txt.on("keydown", () => txt.$element.removeClass(errorBoxClass));

        return row([label, row([txt, secretValueHelper()])]);
    };
    
    var secretsList = () => {
        log.debug("_secretsList");
        let label = require("ko/ui/label").create(locale.get("secret_dialog_menu_secrets"));
        let menu = elems.secretsMenu = require("ko/ui/menulist").create({ id: "secrets_menu"});
        
        disableMenuWithMsg(locale.get("secret_dialog_no_secrets"));
        
        menu.on("popupshowing", populateSecretsMenu);
        menu.onChange(getSelectedSecret);
        
        return row([label,menu]);
    };
    
    var populateSecretsMenu = () => {
        log.debug("_populateSecretsMenu");
        elems.secretsMenu.menupopup.empty();
        if (Object.keys(local.secretsDict).length >= 1) {
            for (let k in local.secretsDict) {
                let s = local.secretsDict[k];
                elems.secretsMenu.addMenuItem(s.scope+"."+s.name);
            }
        } else {
            disableMenuWithMsg(locale.get("secret_dialog_no_secrets"));
        }
    };
    
    var processSecrets = (secrets) => {
        log.debug("_processSecrets");
        for (let s of secrets) {
            updateCachedSecrets(s);
        }
    };
    
    var getSecrets = () => {
        log.debug("_getSecrets");
        let msg = locale.get("secret_dialog_loading_secrets");
        startSecretsListActionUI(msg);
        
        state.secrets({
            onSuccess: (secrets) => {
                let secretMsg = locale.get("secret_dialog_secrets_loaded");
                
                if (secrets && secrets.length >= 1) {
                    processSecrets(secrets);
                    endSecretsListActionUI(true, secretMsg, locale.get("secret_dialog_select_secrets"));
                } else {
                    endActionUI(true, secretMsg);
                    disableMenuWithMsg(locale.get("secret_dialog_no_secrets"));
                }

            },
            onFail: (code, msg) => {
                endSecretsListActionUI(false, msg, locale.get("secret_dialog_no_secrets"));
            },
        });
    };
    
    var getSelectedSecret = () => {
        log.debug("_getSecret");
        let secretNamespace = elems.secretsMenu.value();
        // If it's not there at all then bail out
        if (! getCachedSecret(secretNamespace, false)) {
            return;
        }
        
        let secret = getCachedSecret(secretNamespace, true);
        if (secret){
            updateFieldsWithSecret(secret);
            return;
        }
        
        let msg = locale.get("secret_dialog_loading_a_secrets");
        startActionUI(msg);
        
        state.getSecret({
            onSuccess: (secret) => {
                updateFieldsWithSecret(secret);
                endActionUI(true, locale.get("secret_dialog_secret_loaded"));
            },
            onFail: (code, msg) => {
                endActionUI(false, msg);
            },
        }, secretNamespace);
    };
    
    var getCachedSecret = (secretNamespace, mustHaveValue) => {
        log.debug("_getCachedSecret");
        log.debug("secretNamespace: "+secretNamespace);
        let strippedName = stripPeriod(secretNamespace);

        // use cache if it's been updated with a value
        if (local.secretsDict && local.secretsDict[strippedName]){
            if (mustHaveValue && ! local.secretsDict[strippedName].value)
            {
                return;
            }
            return local.secretsDict[strippedName];
        }
    };
    
    var updateCachedSecrets = (secret) => {
        local.secretsDict[secret.scope+secret.name] = secret;
    };
    
    var stripPeriod = (value) => {
        return value.substring(0,value.indexOf(".")) + value.substring(value.indexOf(".") +1);
    };

    var secretValueHelper = () => {
        let msg = "Secrets values are client-side encrypted and stored on the ActiveState Platform.";
        let secretValueHelper = elems.secretValueHelper = require("ko/ui/toolbarbutton").create({ class: "help-icon", id: "help_icon", tooltiptext: msg });

        return secretValueHelper;
    };

    var okMsg = (msg) => {
        elems.msgField.$element.removeClass(errClass);
        elems.msgField.$element.removeClass(warnClass);
        elems.msgField.$element.addClass(okClass);

        updateMsg(msg);
    };

    var error = (msg) => {
        log.error("msg: "+ msg);
        if (!msg)
            return;
        elems.spinner.hide();
        elems.msgField.$element.removeClass(okClass);
        elems.msgField.$element.removeClass(warnClass);
        elems.msgField.$element.addClass(errClass);

        elems.statusSymbol.$element.removeClass(okIcon);
        elems.statusSymbol.$element.removeClass(warnIcon);
        elems.statusSymbol.$element.addClass(errIcon);
        elems.statusSymbol.show();

        updateMsg(msg);
    };

    var warn = (msg) => {
        log.warn("msg: "+ msg);
        if (!msg)
            return;
        elems.spinner.hide();
        elems.msgField.$element.removeClass(okClass);
        elems.msgField.$element.removeClass(errClass);
        elems.msgField.$element.addClass(warnClass);

        elems.statusSymbol.$element.removeClass(okIcon);
        elems.statusSymbol.$element.removeClass(errIcon);
        elems.statusSymbol.$element.addClass(warnIcon);
        elems.statusSymbol.show();

        updateMsg(msg);
    };

    var updateMsg = (msg = "") => {
        // This is a hack because I can't for the life of me
        // figure out WHY the window expands to the width
        // that the description field WOULD have been with the long
        // msg, EVEN IF you've set a max-width and the desc wrap
        // on it's own to the necessary multiple lines
        let shortmsg = msg.substring(0, 60);
        if (msg.length > 60)
            shortmsg = shortmsg + "...";

        elems.msgField.element.textContent = shortmsg;
        elems.statusSymbol.$element.attr("tooltiptext", msg);
    };

    var msgField = () => {
        elems.msgField = require("ko/ui/description").create(
            "", { class: "state-ok", id: "secret_msg_field" }
        );

        elems.msgField.show();
        return elems.msgField;
    };

    var symbolIndicator = () => {
        let statusSymbol = elems.statusSymbol = require("ko/ui/toolbarbutton").create({ class: "indicator" });
        statusSymbol.hide();
        return statusSymbol;
    };

    var spinner = () => {
        let spinner = elems.spinner = require("ko/ui/spinner").create({ class: "indicator" });
        spinner.hide();
        return spinner;
    };

    var valid = () => {
        log.debug("valid");

        let msg = "";
        let valid = true;
        if (elems.valueField.value() == "" || elems.valueField.value() == null) {
            elems.valueField.$element.addClass(errorBoxClass);
            elems.valueField.$element.focus();
            msg = "'value' field";
            valid = false;
        }
        if (elems.nameField.value() == "" || elems.nameField.value() == null) {
            elems.nameField.$element.addClass(errorBoxClass);
            elems.nameField.$element.focus();
            if (msg)
                msg = msg + " and 'name' field";
            else
                msg = "'name' field";
            valid = false;
        }
        if (!valid) {
            msg = msg + " must be filled in";
            warn(msg);
            return valid;
        }
        return valid;
    };

    window.addEventListener("load", init);

})();