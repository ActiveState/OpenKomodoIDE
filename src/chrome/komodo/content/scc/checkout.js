/* Copyright (c) 2007-2008 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

    /**
     * Internal logging control used for this namespace.
     */
var log = ko.logging.getLogger('SCC Checkout');

    /**
     * Komodo prefs.
     * @type Components.interfaces.koIOrderedPreference
     */
var _prefs = Components.classes["@activestate.com/koPrefService;1"].
                    getService(Components.interfaces.koIPrefService).prefs;


var g_checkUrlTimeoutId = null;
var g_sccComponents = null;
var g_sccSvc = null;
var g_locationURI = null;
var g_repositoryData = null;
var g_checkoutArguments = "";
var g_finishLabel = null;
var g_terminalHandler = null;

/**
 * Persistant object that will remain available even after the dialog is
 * closed. It will be cleaned up when both the asynchronous callback is
 * completed and the dialog has been closed.
 */
var g_persist_object = {
        /**
         * The asynchronous scc operation that is running.
         * @type {Components.interfaces.koIAsyncOperation}
         */
    asyncOp : null,
        /**
         * The status of the wizard dialog.
         * @type {Components.interfaces.koIAsyncOperation}
         */
    wizardState : null
};

/****************************************
 *          Common functions            *
 ****************************************/

function get_scc_component_for_name(name) {
    for (var i=0; i < g_sccComponents.length; i++) {
        if (name == g_sccComponents[i].name) {
            return g_sccComponents[i].component;
        }
    }
    return null;
}

function OnLoad() {
    try {
        scintillaOverlayOnLoad();
        var terminalView = document.getElementById("output_view");
        terminalView.init();

        g_terminalHandler = Components.classes['@activestate.com/koTerminalHandler;1']
                     .createInstance(Components.interfaces.koITerminalHandler);
        terminalView.initWithTerminal(g_terminalHandler);

        if (window.arguments && window.arguments[0]) {
            var checkoutFolder = window.arguments[0].checkoutFolder;
            if (checkoutFolder) {
                checkoutFolder = ko.uriparse.URIToLocalPath(checkoutFolder);
                document.getElementById("scc_checkout_to_location").value = checkoutFolder;
            }
            
        }
    } catch(ex) {
        log.exception(ex);
    }
}

function OnUnLoad() {
    try {
        if (g_persist_object.wizardState == "done" &&
            document.getElementById("project_create_checkbox").checked)
        {
            // Create a Komodo project here.
            opener.ko.projects.manager.createNewProject(g_locationURI);
        }

        g_persist_object.wizardState = "closed";
        // endSession is used to ensure the terminal handler does not try to
        // continue to use scintilla or the view elements.
        g_terminalHandler.endSession();
        var terminalView = document.getElementById("output_view");
        if (g_persist_object.asyncOp) {
            g_persist_object.asyncOp.stop();
        }
        // This ensures the scintilla view is properly cleaned up.
        terminalView.close();
        scintillaOverlayOnUnload();
    } catch(ex) {
        log.exception(ex);
    }
}

/****************************************
 *     Page 1 specific functions        *
 ****************************************/

function page1_onPageShow() {
    try {
        if (!g_sccComponents) {
            // Load the scc menulist.
            g_sccComponents = [];
            var scc_component;
            var entry;
            var all_sccComponents = ko.scc.getAvailableSCCComponents();
            var menupopup = document.getElementById("scc_handler_menupopup");
            for (var i=0; i < all_sccComponents.length; i++) {
                scc_component = all_sccComponents[i].component;
                if (scc_component.getValue("supports_command", "checkout")) {
                    g_sccComponents.push(all_sccComponents[i]);
                    entry = document.createElement("menuitem");
                    entry.setAttribute("label", all_sccComponents[i].name);
                    menupopup.appendChild(entry);
                }
            }
        }

        // Add the current directory cwd, so relative path completions on the
        // location textbox will work.
        var locationTextbox = document.getElementById("scc_checkout_to_location");
        var searchparam = locationTextbox.getAttribute("autocompletesearchparam");
        if (searchparam.indexOf("cwd:") < 0) {
            // XXX - Need to escape the getCwd() value?
            searchparam += "; cwd: " + ko.window.getCwd();
            locationTextbox.setAttribute("autocompletesearchparam", searchparam);
        }

        // Focus on the checkout url textbox, so user can easily paste.
        var urlTextbox = document.getElementById("scc_checkout_url_textbox");
        urlTextbox.focus();
    } catch(ex) {
        log.exception(ex);
    }
}

function scc_handler_menulist_onchange(menulist, event) {
    try {
        // XXX - Hard-coded name, alternative way of doing this?
        var url_label = document.getElementById("scc_checkout_url_label");
        if (menulist.getAttribute("label") == "cvs") {
            url_label.setAttribute("value", "CVSROOT:");
        } else {
            url_label.setAttribute("value", "Checkout URL:");
        }
    } catch(ex) {
        log.exception(ex);
    }
}

function check_can_handle_url(textbox) {
    g_checkUrlTimeoutId = null;
    //dump("check_can_handle_url:: textbox value: " + textbox.value + "\n");
    var menulist = document.getElementById("scc_handler_menulist");
    var text = textbox.value;
    if (text) {
        var scc_component;
        for (var i=0; i < g_sccComponents.length; i++) {
            scc_component = g_sccComponents[i].component;
            // Check if this component supports this URL.
            if (scc_component.getValue("supports_checkout_url", text)) {
                var menupopup = document.getElementById("scc_handler_menupopup");
                for (var j=0; j < menupopup.childNodes.length; j++) {
                    if (menupopup.childNodes.item(j).getAttribute("label") == g_sccComponents[i].name) {
                        menulist.selectedIndex = j;
                        break;
                    }
                }
                return;
            }
        }
    }
    // Don't reset the menu.
    //menulist.selectedIndex = -1;
    //menulist.setAttribute("label", "-");
}

function checkout_url_oninput(event) {
    var textbox = document.getElementById("scc_checkout_url_textbox");
    if (g_checkUrlTimeoutId) {
        window.clearTimeout(g_checkUrlTimeoutId);
        g_checkUrlTimeoutId = null;
    }
    g_checkUrlTimeoutId = window.setTimeout(check_can_handle_url, 500, textbox);
}

function location_OnBrowse() {
    ko.filepicker.browseForDir(document.getElementById("scc_checkout_to_location"));
}

function validate_page1() {
    // The strbundle: used for localized error messages.
    var strbundle = document.getElementById("scc_checkout_strings");

    // Checkout URL
    var urlTextbox = document.getElementById("scc_checkout_url_textbox");
    if (!urlTextbox.value) {
        ko.dialogs.alert(strbundle.getString("alertCheckoutUrlNotSupplied"));
        return 0;
    }

    // SCC Component
    var menulist = document.getElementById("scc_handler_menulist");
    if (menulist.selectedIndex < 0) {
        ko.dialogs.alert(strbundle.getString("alertCheckoutComponentNotSupplied"));
        return 0;
    }

    // Checkout location
    var locationTextbox = document.getElementById("scc_checkout_to_location");
    if (!locationTextbox.value) {
        ko.dialogs.alert(strbundle.getString("alertCheckoutLocationNotSupplied"));
        return 0;
    }

    g_sccSvc = get_scc_component_for_name(menulist.getAttribute("label"));
    g_locationURI = ko.uriparse.pathToURI(Services.koOsPath.expanduser(ko.stringutils.strip(locationTextbox.value)));
    g_repositoryData = ko.stringutils.strip(urlTextbox.value);

    // Save the textbox MRU's.
    ko.mru.addFromACTextbox(locationTextbox);
    ko.mru.addFromACTextbox(urlTextbox);

    return 1;
}



/****************************************
 *     Page 2 specific functions        *
 ****************************************/

function page2_onPageShow() {
    try {
        var scc_checkout_element = document.getElementById("scc_checkout_element");
        scc_checkout_element.setAttribute("type", g_sccSvc.name);
    } catch(ex) {
        log.exception(ex);
    }
}

function validate_page2() {
    try {
        var scc_checkout_element = document.getElementById("scc_checkout_element");
        if (scc_checkout_element.validate && !scc_checkout_element.validate()) {
            return false;
        }
        if (scc_checkout_element.getCheckoutArguments) {
            g_checkoutArguments = scc_checkout_element.getCheckoutArguments();
        } else {
            g_checkoutArguments = "";
        }
    } catch(ex) {
        log.exception(ex);
    }
    return 1;
}



/****************************************
 *     Page 3 specific functions        *
 ****************************************/

function update_command_line_textbox() {
    try {
        var cwd_textbox = document.getElementById("scc_command_cwd_value_label");
        cwd_textbox.value = ko.uriparse.dirName(g_locationURI);
        var command_textbox = document.getElementById("scc_command_textbox");
        var obj = {
            "repositoryURL": g_repositoryData,
            "locationURL": g_locationURI,
            "options": g_checkoutArguments
        };
        command_textbox.value = g_sccSvc.getValue("get_checkout_command_line",
                                                  JSON.stringify(obj));
    } catch(ex) {
        log.exception(ex);
    }
}

function page3_onPageShow() {
    try {
        var strbundle = document.getElementById("scc_checkout_strings");
        g_persist_object.wizardState = null;
        // Reset the button labels and images.
        var image_elem = document.getElementById("status_image");
        var status_elem = document.getElementById("current_status_label");
        image_elem.removeAttribute("src");
        status_elem.setAttribute("value", strbundle.getString("checkoutStatusNotRunning"));

        // Set the button label to be "Checkout"
        var wizard = document.getElementById("komodo-scc-checkout");
        var button = wizard.getButton("finish");
        if (g_finishLabel == null) {
            // Remember the original "Finish" label, so we can eventually set it
            // back.
            g_finishLabel = button.getAttribute("label");
        }
        button.setAttribute("label", strbundle.getString("buttonCheckoutLabel"));

        update_command_line_textbox();

        // Clear the scintilla output text.
        var terminalView = document.getElementById("output_view");
        terminalView.startSession();
        terminalView.clear();
    } catch(ex) {
        log.exception(ex);
    }
}

function onWizardFinish() {
    if (g_persist_object.wizardState == "done") {
        return true;
    }
    try {
        var _log = log;
        var sccSvc = g_sccSvc;
        var wizard = document.getElementById("komodo-scc-checkout");
        wizard.getButton('finish').setAttribute('disabled', 'true');
        var image_elem = document.getElementById("status_image");
        var status_elem = document.getElementById("current_status_label");
        var button_finish_label = g_finishLabel;
        var terminalView = document.getElementById("output_view");
        var persist_object = g_persist_object;
        var strbundle = document.getElementById("scc_checkout_strings");

        var async_callback = {
            "callback": function(result, data) {
                if (persist_object.wizardState == "closed") {
                    // Nothing to do...
                    return;
                }
                persist_object.asyncOp = null;
                image_elem.removeAttribute("src");
                status_elem.removeAttribute("value");
                //var wizard = document.getElementById("komodo-scc-checkout");
                var button = wizard.getButton("finish");
                wizard.getButton('finish').removeAttribute('disabled');

                try {
                    // data will be an array of koISCCHistoryItem,
                    // throw it into the tree view.
                    if (result == Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {

                        persist_object.wizardState = "done";
                        image_elem.setAttribute("src", "chrome://komodo/skin/images/accept_hover.png");
                        status_elem.setAttribute("value", strbundle.getString("checkoutStatusSuccessful"));
                        wizard.getButton('cancel').setAttribute('collapsed','true');
                        wizard.getButton('back').setAttribute('collapsed','true');
                        wizard.getButton('finish').setAttribute('label', button_finish_label);

                    } else if (result == Components.interfaces.koIAsyncCallback.RESULT_ERROR) {

                        // data should contain the error message then.
                        image_elem.setAttribute("src", "chrome://komodo/skin/global/images/warning_small.png");
                        status_elem.setAttribute("value", strbundle.getString("checkoutStatusFailed"));
                        var title = strbundle.getFormattedString("checkoutFailureWindowTitle", [sccSvc.name]);
                        if (!data) {
                            data = strbundle.getString("checkoutStatusFailedMessage");
                        }
                        ko.dialogs.alert(title, data, title);

                    } else {

                        image_elem.setAttribute("src", "chrome://komodo/skin/global/images/warning_small.png");
                        status_elem.setAttribute("value", strbundle.getString("checkoutStatusAborted"));
                    }

                } catch (e) {
                    _log.warn("update callback failed, exception: " + e);
                } finally {
                    _log = null;
                    sccSvc = null;
                    //terminalView.endSession();
                }
            }
        };

        var asyncSvc = Components.classes['@activestate.com/koAsyncService;1'].
                            getService(Components.interfaces.koIAsyncService);
        image_elem.setAttribute("src", asyncSvc.asynchronous_icon_url);
        status_elem.setAttribute("value", strbundle.getString("checkoutStatusInProgress"));
        g_persist_object.asyncOp = g_sccSvc.checkout(g_repositoryData,
                                                     g_locationURI,
                                                     g_checkoutArguments,
                                                     async_callback,
                                                     g_terminalHandler);
    } catch(ex) {
        log.exception(ex);
    }
    return false;
}
