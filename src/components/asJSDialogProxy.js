// Copyright (c) 2000-2006 ActiveState Software Inc.
// See the file LICENSE.txt for licensing information.

const DEBUG = false; /* set to true to enable debug messages */

const APPSHELL_SERV_CONTRACTID  = "@mozilla.org/appshell/appShellService;1";

const nsIAppShellService    = Components.interfaces.nsIAppShellService;
const nsISupports           = Components.interfaces.nsISupports;
const nsIFactory            = Components.interfaces.nsIFactory;
const asIDialogProxy         = Components.interfaces.asIDialogProxy;
const nsIInterfaceRequestor = Components.interfaces.nsIInterfaceRequestor
const nsIDOMWindow          = Components.interfaces.nsIDOMWindow;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function asDialogProxy()
{
    this.loggingSvc = Components.classes["@activestate.com/koLoggingService;1"].
                    getService(Components.interfaces.koILoggingService);
    this.log = this.loggingSvc.getLogger('asdialogproxy');
    this.lastErrorSvc = Components.classes["@activestate.com/koLastErrorService;1"].
                        getService(Components.interfaces.koILastErrorService);
}

asDialogProxy.prototype = {
  classID: Components.ID("{57002286-C22C-4e42-BCFC-DE91AF24B5CA}"),
  contractID: "@activestate.com/asDialogProxy;1",
  classDescription: "asDialogProxy",
  QueryInterface: XPCOMUtils.generateQI([asIDialogProxy]),

  _getParentWindow: function() {
    /* if we can get the window from the window mediator, just use that,
       otherwise, fallback to the old behaviour, which always got the
       main komodo window (not exactly what we would want)
    */
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                    .getService(Components.interfaces.nsIWindowMediator);
    return wm.getMostRecentWindow(null);
  },

  alert: function(prompt) {
      return this.alertEx(prompt, true, true, "OK", "Cancel");
  },
  
  alertEx: function(prompt, okIsDefault, hideCancel, okLabel, cancelLabel) {
    var parent = this._getParentWindow();
    var bundle = (Components.classes["@mozilla.org/intl/stringbundle;1"]
                       .getService(Components.interfaces.nsIStringBundleService)
                       .createBundle("chrome://komodo/locale/views.properties")
                       .GetStringFromName("OK.prompt"));
    try {
        if (typeof(prompt) == 'undefined') prompt = null;
        if (typeof(okIsDefault) == 'undefined') okIsDefault = true;
        if (typeof(hideCancel) == 'undefined') hideCancel = true;
        if (typeof(okLabel) == 'undefined') {
            okLabel = bundle.GetStringFromName("OK.prompt");
        }
        if (typeof(cancelLabel) == 'undefined') {
            cancelLabel = bundle.GetStringFromName("cancel.prompt");
        }
        if (hideCancel && !okIsDefault) {
            okIsDefault = true;
        }
        // Show the dialog.
        var obj = new Object();
        obj.prompt = prompt;
        obj.response = okIsDefault ? okLabel : cancelLabel;
        obj.buttons = [okLabel];
        if (!hideCancel) {
            obj.buttons.push(cancelLabel);
        }
        obj.doNotAskUI = false;
        parent.openDialog("chrome://komodo/content/dialogs/customButtons.xul",
                          "_blank",
                          "chrome,modal,titlebar",
                          obj);
        return obj.response;      
    } catch(ex) { dump("unable to open customButtons dialog\n" + ex + "\n"); }

    return "";
  },

  authenticate: function(title, server, prompt, loginname, allowAnonymous, allowPersist) {
    /* NOTE: if you change this usage, also change it in window_functions.js */
    var parent = this._getParentWindow();
    try {
        var obj = new Object();
        obj.title = title;
        obj.server = server;
        obj.prompt = prompt;
        obj.username = loginname;
        obj.allowAnonymous = allowAnonymous;
        obj.allowPersist = allowPersist;
        parent.openDialog("chrome://komodo/content/dialogs/authenticate.xul",
                      "_blank",
                      "chrome,modal,titlebar",
                      obj);
        if (obj.retval == "Login") {
            return obj.username + ":" + obj.password;
        }
    } catch(ex) { dump("unable to open auth dialog\n" + ex + "\n"); }

    return "";
  },

  prompt: function(prompt, value, okLabel, cancelLabel) {
    var parent = this._getParentWindow();
    try {
        if (typeof(prompt) == 'undefined') prompt = null;
        if (typeof(label) == 'undefined') label = null;
        if (typeof(value) == 'undefined') value = null;
        if (typeof(title) == 'undefined') title = null;
        if (typeof(mruName) == 'undefined') mruName = null;
        if (typeof(validator) == 'undefined') validator = null;
        if (typeof(multiline) == 'undefined') multiline = null;
        if (typeof(screenX) == 'undefined') screenX = null;
        if (typeof(screenY) == 'undefined') screenY = null;
        if (mruName && multiline) {
            log.warn("Cannot use both 'mruName' and 'multiline' on prompt "+
                     "dialogs. 'mruName' will be ignored.");
            mruName = null;
        }
    
        var obj = new Object();
        obj.prompt = prompt;
        obj.label = label;
        obj.value = value;
        obj.title = title;
        obj.mruName = mruName;
        obj.validator = validator;
        obj.multiline = multiline;
        obj.screenX = screenX;
        obj.screenY = screenY;
        parent.openDialog("chrome://komodo/content/dialogs/prompt.xul",
                          "_blank",
                          "chrome,modal,titlebar",
                          obj);
        if (obj.retval == "OK") {
            return obj.value;
        } else {
            return null;
        }
    } catch(ex) { dump("unable to open prompt dialog\n" + ex + "\n"); }

    return "";
  },
  
  open: function(url, name, flags, obj) {
      var parent = this._getParentWindow();
      try {
          return parent.open(url, name, flags, obj);
      } catch (e) {
          this.log.error(e);
          this.lastErrorSvc.setLastError(Components.results.NS_ERROR_FAILURE, e);
          //XXX Should we re-raise, as in eval_()?
      }
      return null;
  },
  
  openDialog: function(url, name, flags, obj) {
      var parent = this._getParentWindow();
      try {
          return parent.openDialog(url, name, flags, obj);
      } catch (e) {
          this.log.error(e);
          this.lastErrorSvc.setLastError(Components.results.NS_ERROR_FAILURE, e);
          //XXX Should we re-raise, as in eval_()?
      }
      return null;
  },

  eval_: function(window, code) {
      try {
          return window.eval(code);
      } catch (e) {
          this.log.error("THROWING" + e);
          this.lastErrorSvc.setLastError(Components.results.NS_ERROR_FAILURE, e);
          throw Components.results.NS_ERROR_FAILURE;
      }
      return null;
  }
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([asDialogProxy]);
