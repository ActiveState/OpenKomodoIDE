/* Copyright (c) 2003-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* Feature status panel dialog.
 *
 * Usage:
 *  All dialog interaction is done via an object passed in and out as the first
 *  window argument: window.arguments[0]. All these arguments are optional.
 *      none
 *  On return window.arguments[0] has:
 *      none
 */

var fcplog = null;
//log.setLevel(ko.logging.LOG_DEBUG);

var gWidgets = {};
var gObserverSvc = null;
var gFeatureStatusObserver = null;
var gFeatureStatusSvc = null;


//---- internal support stuff

// all prefs we want to observe
var gPrefsList = [
// #if WITH_SCC
        "cvsEnabled","p4Enabled","svnEnabled",
        "hgEnabled","gitEnabled","bzrEnabled",
// #endif
        "nodejsDefaultInterpreter",
        "perlDefaultInterpreter","phpDefaultInterpreter",
        "pythonDefaultInterpreter","rubyDefaultInterpreter",
        "tclshDefaultInterpreter","wishDefaultInterpreter",
        "python3DefaultInterpreter"
                 ];

function FeatureStatusObserver() {
    gObserverSvc = Components.classes["@mozilla.org/observer-service;1"].
                       getService(Components.interfaces.nsIObserverService);
    gObserverSvc.addObserver(this, "feature_status_ready", false);
    var prefs = Components.classes["@activestate.com/koPrefService;1"].
                    getService(Components.interfaces.koIPrefService).prefs;
    for (var p in gPrefsList) {
        prefs.prefObserverService.addObserver(this, gPrefsList[p], 1); 
    }
};
FeatureStatusObserver.prototype.QueryInterface = function(aIID)
{
  if (aIID.equals(Components.interfaces.nsIObserver) ||
      aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
      aIID.equals(Components.interfaces.nsISupports))
    return this;
  throw Components.results.NS_NOINTERFACE;
}
FeatureStatusObserver.prototype.destroy = function() {
    var prefs = Components.classes["@activestate.com/koPrefService;1"].
                    getService(Components.interfaces.koIPrefService).prefs;
    for (var p in gPrefsList) {
        prefs.prefObserverService.removeObserver(this, gPrefsList[p]); 
    }
    gObserverSvc.removeObserver(this, "feature_status_ready");
}
FeatureStatusObserver.prototype.observe = function(subject, topic, data)
{
    try {
        fcplog.info("observe(subject="+subject+", topic="+topic+
                 ", data="+data+")");

        // Observing (1) pref and (2) plain nsIObserver notifications.
        // Below we key on the notification "name", whose def'n
        // depends on the type of notification.
        var name;
        if (topic == "") {
            name = data;  // presumably this is a pref notification
        } else {
            name = topic; // a normal notification
        }


        switch (name) {
        case "feature_status_ready":
            var featureName = data;
            var featureStatus = subject;
            _updateFeatureControlPanel(featureName,
                                       featureStatus.status,
                                       featureStatus.reason);
            break;
// #if WITH_SCC
        case "cvsEnabled":
            _requestFeatureStatus('CVS');
            break;
        case "p4Enabled":
            _requestFeatureStatus('Perforce');
            break;
        case "svnEnabled":
            _requestFeatureStatus('Subversion');
            break;
        case "hgEnabled":
            _requestFeatureStatus('Mercurial');
            break;
        case "gitEnabled":
            _requestFeatureStatus('Git');
            break;
        case "bzrEnabled":
            _requestFeatureStatus('Bazaar');
            break;
// #endif
        case "nodejsDefaultInterpreter":
            _requestFeatureStatus('Node.js Debugging');
            _requestFeatureStatus('Node.js Syntax Checking');
            break;
        case "perlDefaultInterpreter":
            _requestFeatureStatus('Perl Debugging');
            _requestFeatureStatus('Perl Syntax Checking');
            break;
        case "phpDefaultInterpreter":
            _requestFeatureStatus('PHP Debugging');
            _requestFeatureStatus('PHP Syntax Checking');
        case "pythonDefaultInterpreter":
            _requestFeatureStatus('Python Debugging');
            _requestFeatureStatus('Python Syntax Checking');
        case "python3DefaultInterpreter":
            _requestFeatureStatus('Python3 Debugging');
            _requestFeatureStatus('Python3 Syntax Checking');
        case "rubyDefaultInterpreter":
            _requestFeatureStatus('Ruby Debugging');
            _requestFeatureStatus('Ruby Syntax Checking');
        case "tclshDefaultInterpreter":
            _requestFeatureStatus('Tcl Syntax Checking');
            // fall through
        case "wishDefaultInterpreter":
            _requestFeatureStatus('Tcl Debugging');
            break;
        }
    } catch(ex) {
        fcplog.exception(ex);
    }
}


// Make a request to determine the status of the given feature.
//
//    "featureName" identifies the feature to get the status for. It
//        defaults to all features.
//
function _requestFeatureStatus(featureName)
{
    try {
        if (typeof(featureName) == "undefined" || !featureName) featureName = "*";
        fcplog.info("_requestFeatureStatus(featureName='"+featureName+"')");

        var dummy = new Object();
        if (featureName == "*") {
            var allFeatureNames = ["Node.js Debugging", "Node.js Syntax Checking",
                                   "Perl Debugging", "Perl Syntax Checking",
                                   "PHP Debugging", "PHP Syntax Checking",
                                   "Python Debugging", "Python Syntax Checking",
                                   "Python3 Debugging", "Python3 Syntax Checking",
                                   "Ruby Debugging", "Ruby Syntax Checking",
                                   "Tcl Debugging", "Tcl Syntax Checking",
// #if WITH_SCC
                                   "CVS", "Perforce", "Subversion",
                                   "Mercurial", "Git", "Bazaar",
// #endif
                                   ];
            for (var i = 0; i < allFeatureNames.length; i++) {
                try {
                    gObserverSvc.notifyObservers(dummy,
                        "feature_status_request", allFeatureNames[i]);
                } catch(ex) {
                    fcplog.exception(ex, "Error requesting status for '"+
                                      allFeatureNames[i]+"' feature");
                }
            }
        } else {
            try {
                gObserverSvc.notifyObservers(dummy, "feature_status_request",
                                             featureName);
            } catch(ex) {
                fcplog.exception(ex, "Error requesting status for '"+
                                  featureName+"' feature");
            }
        }
    } catch (ex) {
        fcplog.exception(ex, "_requestFeatureStatus error");
    }
}


// Update status in the feature control panel.
//
//    "featureName" names the feature.
//    "status" is a string describing the feature's status.
//    "reason" (optional) is a reason describing why the feature is not
//        functional.
//
function _updateFeatureControlPanel(featureName, status, reason)
{
    fcplog.info("_updateFeatureControlPanel");
    try {
        if (typeof(reason) == "undefined") {
            reason = null;
        }

        var widget = null;
        switch (featureName) {
        case "Node.js Debugging":
            status = "Debugging: " + status;
            widget = gWidgets.nodejsDebuggingStatus;
            break;
        case "Node.js Syntax Checking":
            status = "Syntax Checking: " + status;
            widget = gWidgets.nodejsSyntaxCheckingStatus;
            break;
        case "Perl Debugging":
            status = "Debugging: " + status;
            widget = gWidgets.perlDebuggingStatus;
            break;
        case "Perl Syntax Checking":
            status = "Syntax Checking: " + status;
            widget = gWidgets.perlSyntaxCheckingStatus;
            break;
        case "PHP Debugging":
            status = "Debugging: " + status;
            widget = gWidgets.phpDebuggingStatus;
            break;
        case "PHP Syntax Checking":
            status = "Syntax Checking: " + status;
            widget = gWidgets.phpSyntaxCheckingStatus;
            break;
        case "Python Debugging":
            status = "Debugging: " + status;
            widget = gWidgets.pythonDebuggingStatus;
            break;
        case "Python Syntax Checking":
            status = "Syntax Checking: " + status;
            widget = gWidgets.pythonSyntaxCheckingStatus;
            break;
        case "Python3 Debugging":
            status = "Debugging: " + status;
            widget = gWidgets.python3DebuggingStatus;
            break;
        case "Python3 Syntax Checking":
            status = "Syntax Checking: " + status;
            widget = gWidgets.python3SyntaxCheckingStatus;
            break;
        case "Ruby Debugging":
            status = "Debugging: " + status;
            widget = gWidgets.rubyDebuggingStatus;
            break;
        case "Ruby Syntax Checking":
            status = "Syntax Checking: " + status;
            widget = gWidgets.rubySyntaxCheckingStatus;
            break;
        case "Tcl Debugging":
            status = "Debugging: " + status;
            widget = gWidgets.tclDebuggingStatus;
            break;
        case "Tcl Syntax Checking":
            status = "Syntax Checking: " + status;
            widget = gWidgets.tclSyntaxCheckingStatus;
            break;
// #if WITH_SCC
        case "CVS":
            status = "CVS: " + status;
            widget = gWidgets.cvsStatus;
            break;
        case "Perforce":
            status = "Perforce: " + status;
            widget = gWidgets.perforceStatus;
            break;
        case "Subversion":
            status = "Subversion: " + status;
            widget = gWidgets.subversionStatus;
            break;
        case "Mercurial":
            status = "Mercurial: " + status;
            widget = gWidgets.hgStatus;
            break;
        case "Git":
            status = "Git: " + status;
            widget = gWidgets.gitStatus;
            break;
        case "Bazaar":
            status = "Bazaar: " + status;
            widget = gWidgets.bzrStatus;
            break;
// #endif
        }

        if (widget) {
            widget.setAttribute("value", status);
            if (reason) {
                widget.setAttribute("tooltip", "aTooltip");
                widget.setAttribute("tooltiptext", reason);
            } else {
                widget.removeAttribute("tooltip");
                widget.removeAttribute("tooltiptext");
            }
            var imageWidget = document.getElementById(widget.getAttribute('id') + '-image');
            if (imageWidget) {
                if (status.indexOf(': Ready') >= 0) {
                    imageWidget.setAttribute('class', 'status-ready');
                    imageWidget.removeAttribute("tooltiptext");
                } else {
                    imageWidget.setAttribute('class', 'status-error');
                    if (reason) {
                        imageWidget.setAttribute("tooltiptext", reason);
                    }
                }
            }
        }
    } catch (ex) {
        fcplog.exception(ex, "_updateFeatureControlPanel error");
    }
}


//---- interface routines for XUL

function OnLoad()
{
    fcplog = ko.logging.getLogger("dialogs.featureControlPanel");
    try {
        gWidgets.dialog = document.getElementById("dialog-featurecontrolpanel");
        gWidgets.cancelButton = gWidgets.dialog.getButton("cancel");
        gWidgets.nodejsDebuggingStatus = document.getElementById("nodejs-debugging-status");
        gWidgets.nodejsSyntaxCheckingStatus = document.getElementById("nodejs-syntax-checking-status");
        gWidgets.perlDebuggingStatus = document.getElementById("perl-debugging-status");
        gWidgets.perlSyntaxCheckingStatus = document.getElementById("perl-syntax-checking-status");
        gWidgets.phpDebuggingStatus = document.getElementById("php-debugging-status");
        gWidgets.phpSyntaxCheckingStatus = document.getElementById("php-syntax-checking-status");
        gWidgets.pythonDebuggingStatus = document.getElementById("python-debugging-status");
        gWidgets.pythonSyntaxCheckingStatus = document.getElementById("python-syntax-checking-status");
        gWidgets.python3DebuggingStatus = document.getElementById("python3-debugging-status");
        gWidgets.python3SyntaxCheckingStatus = document.getElementById("python3-syntax-checking-status");
        gWidgets.rubyDebuggingStatus = document.getElementById("ruby-debugging-status");
        gWidgets.rubySyntaxCheckingStatus = document.getElementById("ruby-syntax-checking-status");
        gWidgets.tclDebuggingStatus = document.getElementById("tcl-debugging-status");
        gWidgets.tclSyntaxCheckingStatus = document.getElementById("tcl-syntax-checking-status");
// #if WITH_SCC
        gWidgets.cvsStatus = document.getElementById("cvs-status");
        gWidgets.perforceStatus = document.getElementById("perforce-status");
        gWidgets.subversionStatus = document.getElementById("svn-status");
        gWidgets.hgStatus = document.getElementById("hg-status");
        gWidgets.gitStatus = document.getElementById("git-status");
        gWidgets.bzrStatus = document.getElementById("bzr-status");
// #endif

        gWidgets.cancelButton.setAttribute("label", "Close");
        gWidgets.cancelButton.setAttribute("accesskey", "C");

        gFeatureStatusObserver = new FeatureStatusObserver();

        // we merely get a handle on the service to make sure it's been started
        gFeatureStatusSvc = Components.classes["@activestate.com/koFeatureStatusService;1"].
            getService(Components.interfaces.koIFeatureStatusService);

        _requestFeatureStatus("*");

        window.sizeToContent();
    } catch(ex) {
        fcplog.exception(ex, "Error loading feature status panel dialog.");
    }
}


function OnUnload()
{
    try {
        gFeatureStatusObserver.destroy();
        gFeatureStatusObserver = null;
    } catch(ex) {
        fcplog.exception(ex);
    }
}


function LaunchHelp(page)
{
    try {
        opener.ko.help.open(page);
    } catch(ex) {
        fcplog.exception(ex);
    }
}


function LaunchPrefs(panel)
{
    try {
        opener.prefs_doGlobalPrefs(panel);
    } catch(ex) {
        fcplog.exception(ex);
    }
}


function Cancel()
{
    try {
        return true;
    } catch(ex) {
        fcplog.exception(ex);
    }
    return false;
}


