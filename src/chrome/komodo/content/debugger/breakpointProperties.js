/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* Breakpoint Properties dialog: edit a koIDBGPBreakpoint component.
 *
 * Usage:
 *  All dialog interaction is done via an object passed in and out as the
 *  first window argument: window.arguments[0].
 *      .breakpoint     a koIDBGPBreakpoint instance, the breakpoint to edit
 *  On return window.arguments[0] has:
 *      .response       "OK" or "Cancel"
 *      .breakpoint     iff .response is "OK", then this is a _clone_ of the
 *                      passed in breakpoint with the user's modifications.
 *                      It is up to the caller to then call
 *                      koIDBGPBreakpointManager.breakpointUpdate() to
 *                      actually update the breakpoint.
 *
 */

var log = ko.logging.getLogger("breakpointProperties");
//log.setLevel(ko.logging.LOG_DEBUG);

var gWidgets = null;
var gBreakpoint = null; // koIDBGPBreakpoint instance to work with



//---- interface routines for XUL

function OnLoad()
{
    log.info("OnLoad()");
    try {
        gWidgets = new Object();
        gWidgets.dialog = document.getElementById("dialog-breakpointproperties")
        gWidgets.okButton = gWidgets.dialog.getButton("accept");
        gWidgets.cancelButton = gWidgets.dialog.getButton("cancel");
        gWidgets.typeTabbox = document.getElementById("type-tabbox");
        gWidgets.panels = {
            "line": document.getElementById("line-tabpanel"),
            "conditional": document.getElementById("conditional-tabpanel"),
            "watch": document.getElementById("watch-tabpanel"),
            "call": document.getElementById("call-tabpanel"),
            "return": document.getElementById("return-tabpanel"),
            "exception": document.getElementById("exception-tabpanel")
        };

        gWidgets.okButton.setAttribute("accesskey", "o");
        gWidgets.cancelButton.setAttribute("accesskey", "c");
        var err;
        // .breakpoint
        if (typeof(window.arguments[0].breakpoint) == "undefined" ||
            window.arguments[0].breakpoint == null)
        {
            err = "no breakpoint was passed to the 'Breakpoint Properties' dialog";
            ko.dialogs.alert(err);
            throw(err);
            window.close();
        } else {
            gBreakpoint = window.arguments[0].breakpoint.clone();
        }

        // Switch to the proper tab.
        var panel = gWidgets.panels[gBreakpoint.type];
        if (panel == null) {
            err = "unknown breakpoint type: '"+gBreakpoint.type+"'";
            ko.dialogs.alert(err);
            throw(err);
            window.close();
        }
        gWidgets.typeTabbox.selectedTab = document.getElementById(gBreakpoint.type+"-tab");
        SwitchedToPanel(gBreakpoint.type);

        UpdateOK();
    } catch(ex) {
        log.exception(ex)
    }
}


function SwitchedToPanel(panelName)
{
    log.info("SwitchedToPanel(panelName="+panelName+")");
    try {
        var lastPanelName = gBreakpoint.type;
        gBreakpoint.type = panelName;

        // Apply settings to the new panel.
        // Settings are written through to globals for each breakpoint
        // attribute whenever a corresponding widget is changed, so we
        // just need to write those settings to any appropriate widgets
        // on this panel.
        var element;
        element = document.getElementById(gBreakpoint.type+"-language");
        if (element) element.value = gBreakpoint.language;
        element = document.getElementById(gBreakpoint.type+"-filename");
        if (element) element.value = ko.uriparse.displayPath(gBreakpoint.filename);
        element = document.getElementById(gBreakpoint.type+"-lineno");
        if (element) element.value = gBreakpoint.lineno;
        element = document.getElementById(gBreakpoint.type+"-condition");
        if (element) element.value = gBreakpoint.expression;
        element = document.getElementById(gBreakpoint.type+"-function");
        if (element) element.value = gBreakpoint.functionName;
        element = document.getElementById(gBreakpoint.type+"-exception");
        if (element) element.value = gBreakpoint.exceptionName;
        element = document.getElementById(gBreakpoint.type+"-hit-value");
        if (element) element.value = Number(gBreakpoint.hitValue);
        element = document.getElementById(gBreakpoint.type+"-hit-condition");
        if (element) element.value = gBreakpoint.hitCondition || ">=";
        if (gBreakpoint.hitValue) {
            if (element.hasAttribute("disabled"))
                element.removeAttribute("disabled");
        } else {
            element.setAttribute("disabled", "true");
        }

        element = document.getElementById("state");
        if (gBreakpoint.state == "disabled") {
            element.checked = false;
        } else {
            element.checked = true;
            gBreakpoint.state = "enabled";
        }

        // Reset accesskeys.
        // Accesskey attributes on the "from" tab are removed and are added on the
        // new tab. The working set is defined by elements that have a
        // uses-accesskey="true" attribute. The data is in that element's
        // _accesskey attribute.
        var i, elements, accesskey;
        if (lastPanelName) {
            elements = gWidgets.panels[lastPanelName].getElementsByAttribute(
                "uses-accesskey", "true");
            for (i = 0; i < elements.length; ++i) {
                if (elements[i].hasAttribute("accesskey")) {
                    log.debug("remove accesskey '"+
                              elements[i].getAttribute("accesskey")+
                              "' from element in '"+lastPanelName+"' panel");
                    elements[i].removeAttribute("accesskey");
                }
            }
        }
        elements = gWidgets.panels[gBreakpoint.type].getElementsByAttribute(
            "uses-accesskey", "true");
        for (i = 0; i < elements.length; ++i) {
            accesskey = elements[i].getAttribute("_accesskey");
            log.debug("adding accesskey '"+accesskey+"' to element in '"+
                      gBreakpoint.type+"' panel");
            elements[i].setAttribute("accesskey", accesskey);
        }

        UpdateOK();
    } catch(ex) {
        log.exception(ex)
    }
}


function UpdateAttribute(attribute)
{
    log.info("UpdateAttribute(attribute="+attribute+")");
    try {
        // Update the working data store (gBreakpoint) with the data.
        var id = gBreakpoint.type+"-"+attribute;
        var element = document.getElementById(id);
        var value;
        switch(attribute) {
        case "language":
            value = element.value;
            log.debug("update language to '"+value+"'");
            gBreakpoint.language = value;
            break;
        case "filename":
            if (element.value.length > 1) {
                // uriparse will raise an IndexError for zero- and one-length
                // strings.
                value = ko.uriparse.pathToURI(element.value);
            } else {
                value = "";
            }
            log.debug("update filename to '"+value+"'");
            gBreakpoint.filename = value;
            break;
        case "lineno":
            value = Number(element.value);
            log.debug("update lineno to '"+value+"'");
            gBreakpoint.lineno = value;
            break;
        case "condition":
            value = element.value;
            log.debug("update expression to '"+value+"'");
            gBreakpoint.expression = value;
            break;
        case "function":
            value = element.value;
            log.debug("update function to '"+value+"'");
            gBreakpoint.functionName = value;
            break;
        case "exception":
            value = element.value;
            log.debug("update exception to '"+value+"'");
            gBreakpoint.exceptionName = value;
            break;
        case "hit-condition":
            value = element.value || null;
            log.debug("update hit-condition to '"+value+"'");
            gBreakpoint.hitCondition = value;
            var hitValue = document.getElementById(gBreakpoint.type+"-hit-value");
            if (value) {
                if (hitValue.hasAttribute("disabled"))
                    hitValue.removeAttribute("disabled");
            } else {
                hitValue.setAttribute("disabled", "true");
            }
            break;
        case "hit-value":
            value = element.value.length ? Number(element.value) : 0;
            log.debug("update hit-value to '"+value+"'");
            gBreakpoint.hitValue = value;
            var hitCondWidget = document.getElementById(gBreakpoint.type+"-hit-condition");
            if (gBreakpoint.hitValue) {
                if (hitCondWidget.hasAttribute("disabled"))
                    hitCondWidget.removeAttribute("disabled");
            } else {
                hitCondWidget.setAttribute("disabled", "true");
            }
            break;
        case "state":
            element = document.getElementById("state");
            if (element.checked) {
                gBreakpoint.state = "enabled";
            } else {
                gBreakpoint.state = "disabled";
            }
            break;
        default:
            log.error("unknown attribute '"+attribute+"'");
        }

        UpdateOK();
    } catch(ex) {
        log.exception(ex)
    }
}


// Update the OK button's enabled/disabled status as appropriate.
function UpdateOK()
{
    log.info("UpdateOK()");
    try {
        var enable = true;
        switch(gBreakpoint.type) {
        case "line":
            if (!gBreakpoint.filename || gBreakpoint.lineno <= 0) {
                enable = false;
            }
            break;
        case "watch":
            /* watch and condition both use expression */
        case "conditional":
            if (!gBreakpoint.expression) {
                enable = false;
            }
            break;
        case "call":
            /* call and return both use functionName */
        case "return":
            if (!gBreakpoint.functionName) {
                enable = false;
            }
            break;
        case "exception":
            if (!gBreakpoint.exceptionName) {
                enable = false;
            }
            break;
        default:
            log.error("unknown breakpoint type '"+gBreakpoint.type+"'");
            enable = false;
        }
        if (enable && !(gBreakpoint.hitValue >= 0)) {
            enable = false;
        }
        if (enable) {
            if (gWidgets.okButton.hasAttribute("disabled")) {
                gWidgets.okButton.removeAttribute("disabled");
            }
        } else {
            gWidgets.okButton.setAttribute("disabled", "true");
        }
    } catch(ex) {
        log.exception(ex)
    }
}


function BrowseForFile()
{
    log.info("BrowseForFile()");
    try {
        var element = document.getElementById(gBreakpoint.type+"-language");
        var language = null;
        var filters = null;
        if (element) {
            language = element.value;
            if (language == "XSLT") {
                filters = [language, "XML", "All"];
            } else {
                filters = [language, "All"];
            }
        }
        element = document.getElementById(gBreakpoint.type+"-filename");
        var filename = null;
        if (element) {
            filename = element.value;
        }
        filename = ko.filepicker.browseForFile(null, filename, "Select File",
                                       language, filters);
        if (filename) {
            element.value = filename;
            UpdateAttribute("filename");
        }
    } catch(ex) {
        log.exception(ex)
    }
}




function OK()
{
    if (gBreakpoint.type == 'call' ||
        gBreakpoint.type == 'return' ||
        gBreakpoint.type == 'exception') {
        /* no sense in having a line number for these,
           they are never used */
        gBreakpoint.lineno = 0;
    }

    window.arguments[0].response = "OK";
    window.arguments[0].breakpoint = gBreakpoint;
    return true;
}

function Cancel()
{
    window.arguments[0].response = "Cancel";
    return true;
}

