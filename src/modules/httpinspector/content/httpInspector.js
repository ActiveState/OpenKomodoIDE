/* Copyright (c) 2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/*
 * httpInspector - HTTP proxy debugging.
 *
 * Contributers:
 *  - ToddW
 */


//----------------------------
//       globals            //
//----------------------------
xtk.include("treeview");
xtk.include("domutils");

var _httpInspector_log = ko.logging.getLogger("httpInspector");
//_httpInspector_log.setLevel(ko.logging.LOG_DEBUG);
var gHttpInspector = null;

//----------------------------
//     internal routines    //
//----------------------------

//
// Request/response tree class for displaying headers.
//
function _httpInspectorHeaderTreeView(initial_rows) {
    if (!initial_rows) {
        // Default value then
        this._rows = [];
    } else {
        this._rows = initial_rows;
    }
    this._debug = 0;
    this._atomService = Components.classes["@mozilla.org/atom-service;1"].
                            getService(Components.interfaces.nsIAtomService);
}
//// The following two lines ensure proper inheritance (see Flanagan, p. 144).
_httpInspectorHeaderTreeView.prototype = new xtk.dataTreeView();
_httpInspectorHeaderTreeView.prototype.constructor = _httpInspectorHeaderTreeView;

_httpInspectorHeaderTreeView.prototype.getCellText = function(row, column) {
    // forRow is an array [ header_name, header_value ]
    var forRow = this._rows[row];
    switch (column.id) {
        case 'httpInspector_treecol_request_header_name':
        case 'httpInspector_treecol_response_header_name':
            return forRow[0];
        case 'httpInspector_treecol_request_header_value':
        case 'httpInspector_treecol_response_header_value':
            return forRow[1];
    }
    return "(Unknown column: " + column.id + ")";
};

_httpInspectorHeaderTreeView.prototype.getHeaders = function()
{
    var headernames = [];
    var headervalues = [];
    for (var i=0; i < this._rows.length; i++) {
        headernames.push(this._rows[i][0]);
        headervalues.push(this._rows[i][1]);
    }
    return [headernames, headervalues];
}

_httpInspectorHeaderTreeView.prototype.addHeader = function(newheaderRow)
{
    this._rows.push(newheaderRow);
    this.tree.rowCountChanged(this._rows.length - 1, 1);
}

_httpInspectorHeaderTreeView.prototype.removeHeader = function(row)
{
    if ((row >= 0) && (row < this._rows.length)) {
        this._rows.splice(row, 1);
        this.tree.rowCountChanged(row, -1);
    }
}


//
// Main HTTP Inspector class
//
function _httpInspector(koHttpInspectorSvcSvc) {
    try {
        this.log = _httpInspector_log;
        this.koHttpInspectorSvc = koHttpInspectorSvcSvc;
        // Prefs
        var prefsSvc = Components.classes["@activestate.com/koPrefService;1"].
                                getService(Components.interfaces.koIPrefService);
        this._prefs = prefsSvc.prefs;
        // Currently used/selected koReqResp
        this.currentReqResp = null;
        // Get handle on needed xul elements
        this.mainTree = document.getElementById('httpInspector_mainTree');
        this.requestHeadersTree = document.getElementById('httpInspector_requestHeadersTree');
        this.requestHeadersTreeColumn_name = document.getElementById('httpInspector_treecol_request_header_name');
        this.requestHeadersTreeColumn_value = document.getElementById('httpInspector_treecol_request_header_value');
        this.responseHeadersTree = document.getElementById('httpInspector_responseHeadersTree');
        this.responseHeadersTreeColumn_name = document.getElementById('httpInspector_treecol_response_header_name');
        this.responseHeadersTreeColumn_value = document.getElementById('httpInspector_treecol_response_header_value');
        this.cmdDebuggerStart = document.getElementById('cmd_httpInspector_startDebugger');
        this.cmdToggleButtonText = document.getElementById('cmd_httpInspector_toggleButtonText');
        this.toolbar = document.getElementById('httpInspector_toolbar');
        this.toolbarButtonStartStop = document.getElementById('httpInspector_toolbar_start_stop');
        this.menuItemStart = document.getElementById('httpInspector_menu_debugger_start');
        this.menuItemStop = document.getElementById('httpInspector_menu_debugger_stop');
        this.cmdBreakOnRequest = document.getElementById('cmd_httpInspector_breakRequest');
        this.cmdBreakOnResponse = document.getElementById('cmd_httpInspector_breakResponse');

        if (!this.mainTree || !this.requestHeadersTree ||
            !this.responseHeadersTree || !this.cmdDebuggerStart) {
            this.log.error("Couldn't find all required xul elements for the proxy debugger.");
            alert("httpInspector load failed");
            return;
        }

        if (!this.toolbar.hasAttribute("buttonstyle")) {
            this.cmdToggleButtonText.setAttribute("checked", "true");
        }
        this.hboxRequestHeaderButtons    = document.getElementById('httpInspector_hboxRequestHeaderButtons');
        this.hboxResponseHeaderButtons   = document.getElementById('httpInspector_hboxResponseHeaderButtons');
        this.buttonRequestSave    = document.getElementById('httpInspector_buttonRequestSave');
        this.buttonRequestRevert  = document.getElementById('httpInspector_buttonRequestRevert');
        this.buttonRequestRespondWith = document.getElementById('httpInspector_buttonRequestRespondWith');
        this.buttonResponseSave   = document.getElementById('httpInspector_buttonResponseSave');
        this.buttonResponseRevert = document.getElementById('httpInspector_buttonResponseRevert');
        this.labelRequestStatus   = document.getElementById('httpInspector_labelRequestStatus');
        this.labelResponseStatus  = document.getElementById('httpInspector_labelResponseStatus');
        this.popupRequestHeaderMenu  = document.getElementById("httpInspector_popupsetForRequestHeaders");
        this.popupResponseHeaderMenu = document.getElementById("httpInspector_popupsetForResponseHeaders");

        // For display of request/response data
        this.responseIFrame              = document.getElementById('httpInspector_responseIFrame');
        this.hboxViewBody                = document.getElementById('httpInspector_hboxViewBody');

        this.commandListbox = document.getElementById('httpInspector_requestCommandMenulist');
        this.urlTextbox = document.getElementById('httpInspector_requestUrlTextbox');
        this.responseVersionMenulist = document.getElementById('httpInspector_responseVersionMenulist');
        this.responseStatusTextbox = document.getElementById('httpInspector_responseStatusTextbox');

        this.requestTab = document.getElementById('httpInspector_tabRequest');
        this.responseTab = document.getElementById('httpInspector_tabResponse');
        this.responseDeck = document.getElementById('httpInspector_responseDeck');
        this.viewRequestData  = document.getElementById('httpInspector_viewRequestData');
        this.viewResponseData = document.getElementById('httpInspector_viewResponseData');
        // Initialize the scintilla buffers
        this.setupScintillaBuffers();

        // register our command handlers
        //this.registerCommands();

        // Load the main tree view
        var koHPDTreeView = Components.classes["@activestate.com/koHttpInspectorTreeView;1"].
                            createInstance(Components.interfaces.koIHttpInspectorTreeView);
        this.mainTreeView = koHPDTreeView;
        this.mainTree.treeBoxObject.view = this.mainTreeView;

        // Add ourself as an observer for break requests
        this.koHttpInspectorSvc.addUIObserver(this);

        // Load the request and responde header tree views
        this.requestHeadersTreeView = new _httpInspectorHeaderTreeView();
        this.requestHeadersTree.treeBoxObject.view = this.requestHeadersTreeView;
        this.responseHeadersTreeView = new _httpInspectorHeaderTreeView();
        this.responseHeadersTree.treeBoxObject.view = this.responseHeadersTreeView;

        this.onSelect(null, null);
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

// XXX - No inheritance needed yet
//// The following two lines ensure proper inheritance (see Flanagan, p. 144).
//_httpInspector.prototype = new _httpInspector();
//_httpInspector.prototype.constructor = projectManager;

_httpInspector.prototype.NAME = 'httpInspector';

_httpInspector.prototype.setupScintillaBuffers = function()
{
    try {
        this.requestDocument = this.viewRequestData.docSvc.createUntitledDocument("Text");
        this.responseDocument = this.viewResponseData.docSvc.createUntitledDocument("Text");

        // Init the scintilla request and response buffer
        var views = [ this.viewRequestData, this.viewResponseData ];
        var docs  = [ this.requestDocument, this.responseDocument ];
        var view, doc, scimoz;
        for (var i in views) {
            view = views[i];
            doc = docs[i];
            try {
                doc.addView(view);
                doc.buffer = "";
                scimoz = view.scimoz;
                view.scintilla.symbolMargin = false; // we don't have breakpoints
                scimoz.setMarginWidthN(scimoz.MARGIN_LINENUMBERS, 0);
                view.initWithBuffer("");
                // Enable listening to scintilla buffer changes
                view.koDoc = doc;
                doc.observerService.addObserver(this, 'buffer_dirty', 0);
            } catch(e) {
                _httpInspector_log.exception(e);
            }
        }
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype.unloadScintillaBuffers = function()
{
    try {
        if (this.requestDocument) {
            this.requestDocument.observerService.removeObserver(this, 'buffer_dirty', 0);
            this.requestDocument.releaseView(this.viewRequestData);
            this.requestDocument = null;
        }
        if (this.responseDocument) {
            this.responseDocument.observerService.removeObserver(this, 'buffer_dirty', 0);
            this.responseDocument.releaseView(this.viewResponseData);
            this.responseDocument = null;
        }
        if (this.viewRequestData) {
            this.viewRequestData.koDoc = null;
            // The "close" method ensures the scintilla view is properly cleaned
            // up.
            this.viewRequestData.close();
        }
        if (this.viewResponseData) {
            this.viewResponseData.koDoc = null;
            // The "close" method ensures the scintilla view is properly cleaned
            // up.
            this.viewResponseData.close();
        }
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype.observe = function(doc, topic, data)
{
    try {
        //dump("observe:\n");
        //dump("  doc: " + doc + "\n");
        //dump("  topic: " + topic+ "\n");
        //dump("  data: " + data + "\n");
        if (topic == 'buffer_dirty') {
            if (!this.currentReqResp) {
                return;
            }

            if (doc == this.requestDocument) {
                this._updateRequestModifyUI(this.currentReqResp);
            } else if (doc == this.responseDocument) {
                this._updateResponseModifyUI(this.currentReqResp);
            }
        }
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype._removeAnyBreakStates = function()
{
    try {
        var reqResp = this.currentReqResp;
        if (reqResp) {
            // Check which state the inspector is in
            if (reqResp.flags & Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK) {
                //if (reqResp.flags & Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_REQUEST) {
                //    reqResp.forcedResponseStatus = -1;  // Timeout
                    //reqResp.forcedResponseStatus = 503;  // Service Unavailable
                //}
                this.koHttpInspectorSvc.notifyUIModificationFinished();
            }
        }
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype.startStopDebugger = function()
{
    try {
        if (this.koHttpInspectorSvc.isListening) {
            this._removeAnyBreakStates();
            this.koHttpInspectorSvc.stopListener();
        } else {
            var errorMessage = new Object();
            if (!this.koHttpInspectorSvc.startListener(errorMessage)) {
                ko.dialogs.alert("Could not start listening" /* prompt */,
                             errorMessage.value /* text */,
                             "HTTP Inspector Error" /* title */);
            }
        }
        this.doElementEnabling();
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype.clearHistory = function()
{
    try {
        this._removeAnyBreakStates();
        this.koHttpInspectorSvc.clear();
        this.onSelect(null, null);
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype.help = function()
{
    try {
        opener.ko.help.open("http-insp.html");
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}


_httpInspector.prototype.setEnabledState = function(elt, enabled)
{
    try {
        if (enabled) {
            if (elt.hasAttribute('disabled')) {
                elt.removeAttribute('disabled');
            }
        } else {
            elt.setAttribute('disabled', true);
        }
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype.setCheckedState = function(elt, checked)
{
    try {
        elt.setAttribute('checked', checked);
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype.setCollapsedState = function(elt, enabled)
{
    try {
        if (enabled) {
            elt.setAttribute('collapsed', true);
        } else {
            if (elt.hasAttribute('collapsed')) {
                elt.removeAttribute('collapsed');
            }
        }
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype.doElementEnabling = function()
{
    try {
        var isListening = this.koHttpInspectorSvc.isListening;
        //dump("isListening " + isListening  + "\n");
        this.setCheckedState(this.cmdBreakOnRequest, this.koHttpInspectorSvc.breakOnIncomingRequest);
        this.setCheckedState(this.cmdBreakOnResponse, this.koHttpInspectorSvc.breakOnOutgoingResponse);
        // isListening attribute on the start/stop toolbar button defines
        // which image is used on the toolbar.
        this.toolbarButtonStartStop.setAttribute("isListening", isListening);
        if (isListening) {
            this.toolbarButtonStartStop.setAttribute("label", "Stop Proxy");
            this.toolbarButtonStartStop.classList.remove("box-state-ok");
            this.toolbarButtonStartStop.classList.add("box-state-error");
            this.toolbarButtonStartStop.setAttribute("tooltiptext", "Stop the HTTP Inspector Proxy");
            document.title = "HTTP Inspector: Listening on localhost:" +
                                this.koHttpInspectorSvc.port;
        } else {
            this.toolbarButtonStartStop.setAttribute("label", "Start Proxy");
            this.toolbarButtonStartStop.classList.add("box-state-ok");
            this.toolbarButtonStartStop.classList.remove("box-state-error");
            this.toolbarButtonStartStop.setAttribute("tooltiptext", "Start the HTTP Inspector Proxy");
            document.title = "HTTP Inspector: Stopped";
        }
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype._updateUIRequestResponse = function(reqResp)
{
    try {
        this._updateRequestUI(reqResp);
        this._updateResponseUI(reqResp);
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype.onSelect = function(event, reqResp)
{
    try {
        var row = this.mainTree.currentIndex;
        if (typeof(reqResp) == 'undefined') {
            reqResp = this.mainTreeView.getReqRespPairForRow(row);
        }
        this.currentReqResp = reqResp;
        if (!this.currentReqResp) {
            this.requestHeadersTree.removeAttribute("context");
            this.responseHeadersTree.removeAttribute("context");
        } else {
            this.requestHeadersTree.setAttribute("context", "httpInspector_popupsetForRequestHeaders");
            this.responseHeadersTree.setAttribute("context", "httpInspector_popupsetForResponseHeaders");
        }
        this._updateUIRequestResponse(this.currentReqResp);
        if (event) {
            this.mainTreeView.ensureRowIsVisible(row);
        }
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype.onDoubleClick = function(event)
{
    try {
        var row = this.mainTree.currentIndex;
        this.currentReqResp = this.mainTreeView.getReqRespPairForRow(row);
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype.onKeyPress = function(event)
{
    try {
        // Only capture ENTER key
        if (event.keyCode != event.DOM_VK_RETURN) {
            return;
        }

        // Only continue if we have a request or response
        var reqResp = this.currentReqResp;
        if (!reqResp) {
            return;
        }

        // Check which state the inspector is in
        if (reqResp.flags & Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_REQUEST) {
            this.saveRequest();
        } else if (reqResp.flags & Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_RESPONSE) {
            this.saveResponse();
        }
        event.preventDefault();
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype.breakOnRequest = function(menuitem)
{
    //var enable = menuitem.getAttribute("checked");
    try {
        this.koHttpInspectorSvc.breakOnIncomingRequest = !this.koHttpInspectorSvc.breakOnIncomingRequest;
        this.doElementEnabling();
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype.breakOnResponse = function(menuitem)
{
    //var enable = menuitem.getAttribute("checked");
    try {
        this.koHttpInspectorSvc.breakOnOutgoingResponse = !this.koHttpInspectorSvc.breakOnOutgoingResponse;
        this.doElementEnabling();
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype.showRuleset = function(menuitem)
{
    try {
        var args = new Object();
        args.koHttpInspectorSvc = this.koHttpInspectorSvc;
        ko.windowManager.openDialog("chrome://httpinspector/content/httpInspectorRuleset.xul",
                          "Komodo:HTTPInspectorRuleset",
                          "chrome,resizable=yes,close=yes,modal=no",
                          args);
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}


_httpInspector.prototype.toolbarShowHideButtonText = function()
{
    try {
        var isChecked = document.getElementById('httpInspector_toolbox_context_toggleButtonText').getAttribute("checked");
        this.toolbar.setAttribute("mode", isChecked ? 'full' : 'icons');
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

// Received from the proxy
//_httpInspector.prototype.notifyChanged = function(row, reqResp)
//{
//    try {
//        _httpInspector_log.debug("notifyChanged");
//        if (this.mainTreeView.currentIndex == row) {
//            _httpInspector_log.debug("notifyChanged: reselecting row");
//            this.onSelect(null);
//            _httpInspector_log.debug("notifyChanged: ensuring visible");
//        }
//        this.mainTree.boxObject.ensureRowIsVisible(row);
//        _httpInspector_log.debug("notifyChanged: done");
//    } catch (e) {
//        _httpInspector_log.exception(e);
//    }
//}

// Select the row supplied
_httpInspector.prototype._selectRowForReqResp = function(reqResp)
{
    try {
        var row = this.mainTreeView.getRowForReqRespPair(reqResp);
        if (row < 0) {
            // Row was not found
            _httpInspector_log.debug("_selectRow: Could not find correstponding koReqResp in treeView");
            return;
        }
        this.mainTreeView.selection.select(row);
        this.currentReqResp = this.mainTreeView.getReqRespPairForRow(row);
        this.mainTreeView.ensureRowIsVisible(row);
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

// Received from the proxy
_httpInspector.prototype.notifyBreakRequest = function(reqResp)
{
    try {
        this._selectRowForReqResp(reqResp);
        this._updateRequestUI(reqResp);
        window.focus();
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

// Received from the proxy
_httpInspector.prototype.notifyBreakResponse = function(reqResp)
{
    try {
        this._selectRowForReqResp(reqResp);
        this._updateUIRequestResponse(reqResp);
        window.focus();
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

// Event is received from the proxy when the koReqResp has changed
_httpInspector.prototype.notifyProxyPairHasChanged = function(reqResp)
{
    try {
        // XXX - Invalidate the correstponding tree row for this reqResp
        //     - If selected, update all info on it
        var row = this.mainTreeView.getRowForReqRespPair(reqResp);
        if (row < 0) {
            // Row was not found
            _httpInspector_log.debug("notifyProxyPairHasChanged: Could not find correstponding koReqResp in treeView");
            return;
        }
        this.mainTreeView.invalidateRow(row);
        if (this.mainTree.currentIndex == row) {
            _httpInspector_log.debug("notifyProxyPairHasChanged: reselecting row");
            this.onSelect(null);
            _httpInspector_log.debug("notifyProxyPairHasChanged: ensuring visible");
        }
        this.mainTreeView.ensureRowIsVisible(row);
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

// Event is received from the proxy when the rows have changed
_httpInspector.prototype.notifyRowsChanged = function()
{
    try {
        this.mainTreeView.rebuild();
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

//////////////////////////////////////////////////////////
//                      Headers                         //
//////////////////////////////////////////////////////////

_httpInspector.prototype._updateReqRespUI = function(reqResp, inBreak, modified,
                                                     label, submitBtn, revertBtn,
                                                     respondBtn, box)
{
    try {
        //dump("_updateReqRespUI: inBreak: " + inBreak + ", modified: " + modified + "\n");
        if (inBreak) {
            submitBtn.setAttribute("label", "Submit");
            if (modified) {
                label.value = "Status: Modified, waiting to submit...";
            } else {
                label.value = "Status: Waiting to submit...";
            }
            if (respondBtn)
                this.setCollapsedState(respondBtn, false);
        } else {
            submitBtn.setAttribute("label", "Save");
            if (modified) {
                label.value = "Status: Modified...";
            } else {
                label.value = "";
            }
            if (respondBtn)
                this.setCollapsedState(respondBtn, true);
        }

        // Enable or disable the revert button
        this.setEnabledState(revertBtn, modified);

        // Show the box
        if (inBreak || modified) {
            box.setAttribute("collapsed", "false");
        } else {
            box.setAttribute("collapsed", "true");
        }
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype._updateRequestModifyUI = function(reqResp)
{
    try {
        var inBreak = false;
        var modified = false;
        if (reqResp) {
            inBreak = reqResp.flags & Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_REQUEST;
            modified = (reqResp.flags & Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_REQUEST_MODIFIED) ||
                       this.viewRequestData.scimoz.modify;
        }
        this._updateReqRespUI(reqResp, inBreak, modified,
                              this.labelRequestStatus,
                              this.buttonRequestSave,
                              this.buttonRequestRevert,
                              this.buttonRequestRespondWith,
                              this.hboxRequestHeaderButtons);
        //if (this.viewRequestData.scimoz.modify) {
        //    this.requestTab.label = "Request data *";
        //} else {
        //    this.requestTab.label = "Request data";
        //}
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype._updateRequestUI = function(reqResp)
{
    try {
        var command = "";
        var url = "";
        var request_data = "";
        var reqHeaderNames = [];

        if (reqResp) {
            command = reqResp.method;
            url = reqResp.url;

            var countField = new Object();
            reqHeaderNames  = reqResp.getRequestHeaderNames(countField);
            var reqHeaderValues = reqResp.getRequestHeaderValues(countField);
            for (var i=0; i < reqHeaderNames.length; i++) {
                reqHeaderNames[i] = [ reqHeaderNames[i], reqHeaderValues[i] ];
            }

            request_data = reqResp.decoded_request_data;
        }
        this.commandListbox.value = command;
        this.urlTextbox.value = url;
        this.requestHeadersTreeView.setTreeRows(reqHeaderNames, true);
        // Update text for request and response body
        // XXX - Don't know what type of language it will be, use text.
        //this.viewRequestData.language = "Text";
        this.viewRequestData.setBufferText(request_data);

        this.setEnabledState(this.commandListbox, (reqResp != null));
        this.setEnabledState(this.urlTextbox, (reqResp != null));
        this.setEnabledState(this.viewRequestData, (reqResp != null));

        this._updateRequestModifyUI(reqResp);
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype._updateResponseModifyUI = function(reqResp)
{
    try {
        var inBreak = false;
        var modified = false;
        if (reqResp) {
            inBreak = reqResp.flags & Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_RESPONSE;
            modified = (reqResp.flags & Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_RESPONSE_MODIFIED) ||
                       this.viewResponseData.scimoz.modify;
        }
        this._updateReqRespUI(reqResp, inBreak, modified,
                              this.labelResponseStatus,
                              this.buttonResponseSave,
                              this.buttonResponseRevert,
                              null,
                              this.hboxResponseHeaderButtons);
        //if (this.viewResponseData.scimoz.modify) {
        //    this.responseTab.label = "Response data *";
        //} else {
        //    this.responseTab.label = "Response data";
        //}
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype._updateResponseUI = function(reqResp)
{
    try {
        var version = "";
        var status = "";
        var response_data = "";
        var response_language = "";
        var respHeaderNames = [];

        if (reqResp) {
            version = reqResp.version;
            status = reqResp.status;

            var countField = new Object();
            respHeaderNames  = reqResp.getResponseHeaderNames(countField);
            var respHeaderValues = reqResp.getResponseHeaderValues(countField);
            for (var i=0; i < respHeaderNames.length; i++) {
                respHeaderNames[i] = [ respHeaderNames[i], respHeaderValues[i] ];
            }
    
            var contentType = reqResp.content_type.toLowerCase();
            // Show image or text for response
            if (contentType.substr(0, 6) == "image/") {
                // Yub, it's an image
                this.responseIFrame.setAttribute("src", reqResp.url);
                this.responseDeck.setAttribute("selectedIndex", "1");
            } else {
                this.responseDeck.setAttribute("selectedIndex", "0");
            }
    
            // Only show text/... or javascript content types
            var subtype = null;
            if (contentType.substr(0, 5) == "text/") {
                // Default to text, then try to work out a better form below.
                response_language = "Text";
                subtype = contentType.substr(5);
            } else if (contentType.substr(0, 12) == "application/") {
                subtype = contentType.substr(12);
            }
            if (subtype) {
                if ((subtype.substr(0, 4) == "html") ||
                    (subtype.substr(0, 5) == "xhtml")) {
                    response_language = "HTML";
                } else if ((subtype.substr(0, 3) == "xml") ||
                           (subtype.substr(0, 7) == "rdf+xml")) {
                    response_language = "XML";
                } else if (subtype.substr(0, 3) == "text") {
                    response_language = "Text";
                } else if (subtype.substr(0, 3) == "css") {
                    response_language = "CSS";
                } else if ((subtype.substr(0, 12) == "x-javascript") ||
                           (subtype.substr(0, 10) == "javascript") ||
                           (subtype.substr(0, 6) == "x-json") ||
                           (subtype.substr(0, 4) == "json")) {
                    response_language = "JavaScript";
                }
            }
            if (response_language.length > 0) {
                response_data = reqResp.decoded_response_data;
            }
        } else {
            // Don't display an image
            this.responseDeck.setAttribute("selectedIndex", "0");
        }

        this.responseVersionMenulist.value = version;
        this.responseStatusTextbox.value = status;
        this.responseHeadersTreeView.setTreeRows(respHeaderNames, true);
        this.viewResponseData.setBufferText(response_data);
        if (response_language.length > 0) {
            this.viewResponseData.language = response_language;
        }

        this.setEnabledState(this.responseVersionMenulist, (reqResp != null));
        this.setEnabledState(this.responseStatusTextbox, (reqResp != null));
        this.setEnabledState(this.viewResponseData, (reqResp != null));

        this._updateResponseModifyUI(reqResp);
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype.requestChanged = function(event)
{
    try {
        if (!this.currentReqResp)
            return;
        this.currentReqResp.flags |= Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_REQUEST_MODIFIED;
        // Set save/submit button name
        this._updateRequestModifyUI(this.currentReqResp);
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype.responseChanged = function(event)
{
    try {
        if (!this.currentReqResp)
            return;
        this.currentReqResp.flags |= Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_RESPONSE_MODIFIED;
        // Set save/submit button name
        this._updateResponseModifyUI(this.currentReqResp);
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

// Used to save or submit the modified request headers
_httpInspector.prototype.saveRequest = function(event)
{
    var inBreakState = false;
    try {
        //alert("saveRequest");
        // Save the headers
        var reqResp = this.currentReqResp;
        if (!reqResp) {
            return;
        }
        if (reqResp.flags & Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_REQUEST_MODIFIED)
            reqResp.flags ^= Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_REQUEST_MODIFIED;
        if (reqResp.flags & Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_REQUEST) {
            reqResp.flags ^= Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_REQUEST;
            inBreakState = true;
        }
        reqResp.method = this.commandListbox.value;
        reqResp.url = this.urlTextbox.value;
        var headers = this.requestHeadersTreeView.getHeaders();
        reqResp.saveRequestHeaders(headers[0].length, headers[0],
                                   headers[1].length, headers[1]);
        if (this.viewRequestData.scimoz.modify) {
            //dump("Dirty request data!\n");
            reqResp.decoded_request_data = this.viewRequestData.scimoz.text;
        }
        // Hide the box again
        this._updateRequestUI(reqResp);
    } catch (e) {
        _httpInspector_log.exception(e);
    }
    // Notify proxy thread we are done, allows it to continue on
    if (inBreakState) {
        this.koHttpInspectorSvc.notifyUIModificationFinished();
    }
}

// Used to set the modified request headers back to their original state
_httpInspector.prototype.revertRequest = function(event)
{
    try {
        // Revert the headers
        var reqResp = this.currentReqResp;
        if (!reqResp) {
            return;
        }
        if (reqResp.flags & Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_REQUEST_MODIFIED)
            reqResp.flags ^= Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_REQUEST_MODIFIED;
        var countField = new Object();
        var reqHeaderNames  = reqResp.getRequestHeaderNames(countField);
        var reqHeaderValues = reqResp.getRequestHeaderValues(countField);
        for (var i=0; i < reqHeaderNames.length; i++) {
            reqHeaderNames[i] = [ reqHeaderNames[i], reqHeaderValues[i] ];
        }
        this.requestHeadersTreeView.setTreeRows(reqHeaderNames, true);
        // Hide the box again
        this._updateRequestUI(reqResp);
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

// Used to save or submit the modified response headers
_httpInspector.prototype.saveResponse = function(event)
{
    var inBreakState = false;
    try {
        // Save the headers
        var reqResp = this.currentReqResp;
        if (!reqResp) {
            return;
        }
        if (reqResp.flags & Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_RESPONSE_MODIFIED)
            reqResp.flags ^= Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_RESPONSE_MODIFIED;
        if (reqResp.flags & Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_RESPONSE) {
            reqResp.flags ^= Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_RESPONSE;
            inBreakState = true;
        }
        reqResp.status = this.responseStatusTextbox.value;
        reqResp.version = this.responseVersionMenulist.value;
        var headers = this.responseHeadersTreeView.getHeaders();
        reqResp.saveResponseHeaders(headers[0].length, headers[0],
                                   headers[1].length, headers[1]);
        if (this.viewResponseData.scimoz.modify) {
            //dump("Dirty response data!\n");
            reqResp.decoded_response_data = this.viewResponseData.scimoz.text;
        }
        // Hide the box again
        this._updateResponseUI(reqResp);
    } catch (e) {
        _httpInspector_log.exception(e);
    }
    // Notify proxy thread we are done, allows it to continue on
    if (inBreakState) {
        this.koHttpInspectorSvc.notifyUIModificationFinished();
    }
}

// Used to set the modified response headers back to their original state
_httpInspector.prototype.revertResponse = function(event)
{
    try {
        // Revert the headers
        var reqResp = this.currentReqResp;
        if (!reqResp) {
            return;
        }
        if (reqResp.flags & Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_RESPONSE_MODIFIED)
            reqResp.flags ^= Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_RESPONSE_MODIFIED;
        var countField = new Object();

        var respHeaderNames  = reqResp.getResponseHeaderNames(countField);
        var respHeaderValues = reqResp.getResponseHeaderValues(countField);
        for (var i=0; i < respHeaderNames.length; i++) {
            respHeaderNames[i] = [ respHeaderNames[i], respHeaderValues[i] ];
        }
        this.requestHeadersTreeView.setTreeRows(respHeaderNames, true);
        // Hide the box again
        this._updateResponseUI(reqResp);
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

// Used to respond in the specified way
_httpInspector.prototype.respondWithStatus = function(statusCode)
{
    try {
        var reqResp = this.currentReqResp;
        if (!reqResp) {
            return;
        }
        if (reqResp.flags & Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK) {
            // Set the force status code
            reqResp.forcedResponseStatus = statusCode;
            if (reqResp.flags & Components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_REQUEST) {
                this._updateRequestUI(reqResp);
            } else {
                this._updateResponseUI(reqResp);
            }
            // Notify proxy thread we are done, allows it to continue on
            this.koHttpInspectorSvc.notifyUIModificationFinished();
            // Hide the box again
        }
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

// Edit a header
_httpInspector.prototype.editHeader = function(headerRow, x, y)
{
    var newvalue = ko.dialogs.prompt2(
                        null,                   // prompt
                        "Header name:",         // label1
                        headerRow[0],           // textbox1
                        "Header value:",        // label2
                        headerRow[1],           // textbox2
                        "Modify header value",  // title
                        "http_inspector_header_name", // mruName1
                        "http_inspector_header_" + headerRow[0], // mruName2
                        null,                   // validator
                        null,                   // multiline1
                        null,                   // multiline2
                        x,                      // screenX
                        y);                     // screenY
    return newvalue;
}

// Edit the request header
_httpInspector.prototype.editRequestHeader = function(event)
{
    var x = null;
    var y = null;
    var tree = this.requestHeadersTree;
    var treeview = this.requestHeadersTreeView;
    var row = tree.currentIndex;
    if (row >= 0 && row < treeview._rows.length) {
        // Work out where we want to position the prompt dialog.
        //if (event) {
        //    if (!event.clientX) {
        //        // Likely it's a popup menu, lets use that
        //        x = this.popupRequestHeaderMenu.boxObject.x - 100;
        //        y = this.popupRequestHeaderMenu.boxObject.y - 50;
        //    } else {
        //        x = event.clientX - 100;
        //        y = event.clientY - 50;
        //    }
        //} else {
        //    // Work out from where the tree row is
        //    
        //}
        var outx = {}, outy = {}, outwidth = {}, outheight = {};
        var col = tree.columns.getColumnFor(this.requestHeadersTreeColumn_name);
        tree.boxObject.getCoordsForCellItem(row,
                                            col,
                                            "text",
                                            outx, outy,
                                            outwidth, outheight);
        x = tree.boxObject.screenX + outx.value;
        y = tree.boxObject.screenY + outy.value;
        x = Math.max(0, x - 100);
        y = Math.max(0, y - 50);

        var headerRow = treeview._rows[row];
        var newheaderRow = this.editHeader(headerRow, x, y);
        if (newheaderRow) {
            treeview._rows[row] = newheaderRow;
            this.requestChanged();
        }
    }
}

// Edit the response header
_httpInspector.prototype.editResponseHeader = function(event)
{
    var x = null;
    var y = null;
    var tree = this.responseHeadersTree;
    var treeview = this.responseHeadersTreeView;
    var row = tree.currentIndex;
    if (row >= 0 && row < treeview._rows.length) {
        // Work out where we want to position the prompt dialog.
        //if (event) {
        //    if (!event.clientX) {
        //        // Likely it's a popup menu, lets use that
        //        x = this.popupResponseHeaderMenu.boxObject.x - 100;
        //        y = this.popupResponseHeaderMenu.boxObject.y - 50;
        //    } else {
        //        x = event.clientX - 100;
        //        y = event.clientY - 50;
        //    }
        //} else {
        //    // Work out from where the tree row is
        //    
        //}
        var outx = {}, outy = {}, outwidth = {}, outheight = {};
        var col = tree.columns.getColumnFor(this.responseHeadersTreeColumn_name);
        tree.boxObject.getCoordsForCellItem(row,
                                            col,
                                            "text",
                                            outx, outy,
                                            outwidth, outheight);
        x = tree.boxObject.screenX + outx.value;
        y = tree.boxObject.screenY + outy.value;
        x = Math.max(0, x - 100);
        y = Math.max(0, y - 50);

        var headerRow = treeview._rows[row];
        var newheaderRow = this.editHeader(headerRow, x, y);
        if (newheaderRow) {
            treeview._rows[row] = newheaderRow;
            this.responseChanged();
        }
    }
}

_httpInspector.prototype.addRequestHeaderWithName = function(event, headername)
{
    var newheaderRow = this.editHeader([ headername, "" ]);
    if (newheaderRow) {
        //var tree = this.requestHeadersTree;
        var treeview = this.requestHeadersTreeView;
        treeview._rows.push(newheaderRow);
        this.requestChanged();
    }
}

_httpInspector.prototype.addResponseHeaderWithName = function(event, headername)
{
    var newheaderRow = this.editHeader([ headername, "" ]);
    if (newheaderRow) {
        this.responseHeadersTreeView.addHeader(newheaderRow);
        this.responseChanged();
    }
}

_httpInspector.prototype.removeRequestHeader = function()
{
    var row = this.requestHeadersTree.currentIndex;
    if (row >= 0) {
        this.requestHeadersTreeView.removeHeader(row);
        this.requestChanged();
    }
}

_httpInspector.prototype.removeResponseHeader = function(treecol)
{
    var row = this.responseHeadersTree.currentIndex;
    if (row >= 0) {
        this.responseHeadersTreeView.removeHeader(row);
        this.responseChanged();
    }
}

_httpInspector.prototype.onRequestHeadersKeyPress = function(event)
{
    try {
        // Only capture VK_DELETE keys
        if (event.keyCode != event.DOM_VK_DELETE) {
            return;
        }

        this.removeRequestHeader();
        event.preventDefault();
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

_httpInspector.prototype.onResponseHeadersKeyPress = function(event)
{
    try {
        // Only capture VK_DELETE keys
        if (event.keyCode != event.DOM_VK_DELETE) {
            return;
        }

        this.removeResponseHeader();
        event.preventDefault();
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}


// Menu's not currently in use
//
//// Edit the request details
//_httpInspector.prototype.editRequest = function(event)
//{
//    this.currentReqResp = this.mainTreeView.getReqRespPairForRow(this.mainTreeView.currentIndex);
//    // This will update the listbox for any changes made
//    this.onSelect(null);
//}
//
//// Edit the response details
//_httpInspector.prototype.editResponse = function(event)
//{
//    this.currentReqResp = this.mainTreeView.getReqRespPairForRow(this.mainTreeView.currentIndex);
//    // This will update the listbox for any changes made
//    this.onSelect(null);
//}
//
//// Rename the request and response details
//_httpInspector.prototype.renameRequestResponse = function(event)
//{
//    try {
//        // Get the selected row
//        alert("To be done");
//    } catch (e) {
//        _httpInspector_log.exception(e);
//    }
//}
//
//// Remove the request and response line
//_httpInspector.prototype.removeRequestResponse = function(event)
//{
//    try {
//        // Get the selected row
//        alert("To be done");
//    } catch (e) {
//        _httpInspector_log.exception(e);
//    }
//}


//----------------------------
//    public routines       //
//----------------------------

function httpInspector_onLoad() {
    try {
        // Init scintilla
        scintillaOverlayOnLoad();

        // Init the http inspector
        if (!gHttpInspector) {
            var koHttpInspectorSvcSvc = Components.classes["@activestate.com/koHttpInspector;1"].
                    getService(Components.interfaces.koIHttpInspector);
            gHttpInspector = new _httpInspector(koHttpInspectorSvcSvc);
        }

        gHttpInspector.doElementEnabling();
    } catch (e) {
        _httpInspector_log.exception(e);
    }
}

function httpInspector_onUnload() {
    if (gHttpInspector) {
        gHttpInspector.koHttpInspectorSvc.removeUIObserver();
        // Clear any scintilla buffers
        gHttpInspector.unloadScintillaBuffers();
        gHttpInspector = null;
    }
    scintillaOverlayOnUnload();
}

function httpInspector_mainTree_OnSelect(event)
{
    gHttpInspector.onSelect(event);
}

function httpInspector_handleResponseOnModified(event)
{
    alert("Response modified");
}
