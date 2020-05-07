/* Copyright (c) 2006-2008 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/**
 * Source Code Control history dialog.
 *
 * Usage:
 *  All dialog interaction is done via an object passed in and out as the first
 *  window argument: window.arguments[0].
 *      .urls           is the urls that have been selected by the user.
 *                      The URLs are automatically converted for display via
 *                      ko.uriparse.displayPath().
 *      .localRevisions is the revisions numbers for the given urls. The length
 *                      of the localRevisions array must match the length of
 *                      urls.
 *
 * How it works:
 *  Once the dialog is given the list of urls and has been opened, it will
 *  display the list of urls in a selectable tree. Once the user selects a
 *  url (can also happen on load), the history for that url will then be shown
 *  in the history tree. The history items can be selected and a diff can then
 *  be made on a particular revision or between two revisions.
 *  
 * Dev Notes:
 *  This dialog is similar in implementation to commit.xul (xbl me!).
 */

if (typeof(ko) == 'undefined') {
    window.ko = require("ko/windows").getMain().ko;
} else {
    ko.scc = require("ko/windows").getMain().ko.scc;
}

var alertFeedback = ko.dialogs.alert;
if ( ! window.arguments)
    alertFeedback = require("ko/windows").getMain().console.warn;

var gSCCHistoryDialog_log = ko.logging.getLogger("scc.history");
//gSCCHistoryDialog_log.setLevel(ko.logging.LOG_DEBUG);

var gSCCHistoryDialog = null;
var gSCCHistoryCache = {};
var gDiffBrowser;
var self;

var isWidget;
var isSingleFile;
var currentUrl;
var showLoader = true;

function _sccHistoryTreeView(tree_type, initial_rows) {
    // Call the parent initializer.
    xtk.dataTreeView.apply(this, [initial_rows]);
    /* tree_type: 0 - urls, 1 - history items */
    this._history_tree_type = tree_type;
    /* link url template - allow clicking on revision to bring up a web page. */
    this._linkUrlTemplate = null;
    /* visited link is set when a row link has been clicked */
    this._visitedLinkForRow = [];
    /* localRevision is used to show which is the current version the user has */
    this._localRevisionHistoryItem = null;
};

_sccHistoryTreeView.prototype = new xtk.dataTreeView();
_sccHistoryTreeView.prototype.contructor = _sccHistoryTreeView;

_sccHistoryTreeView.prototype.getCellText = function(row, column)
{
    if (this._history_tree_type == 0) {
        return ko.uriparse.displayPath(this._rows[row]);
    } else {
        var koHistoryItem = this._rows[row];
        switch (column.id) {
           case 'scc_history_items_tree_column_revision2':		
                // Mark the current revision row with a " (your copy)" text		
                if (koHistoryItem == this._localRevisionHistoryItem) {		
                    return koHistoryItem.version + " (local revision)";		
                }		
                return koHistoryItem.version;
            case 'scc_history_items_tree_column_change2':
                return koHistoryItem.change;
            case 'scc_history_items_tree_column_user2':
                return koHistoryItem.author;
            case 'scc_history_items_tree_column_date2':
                return koHistoryItem.date;
            case 'scc_history_items_tree_column_action2':
                return koHistoryItem.action;
            case 'scc_history_items_tree_column_message2':
                return koHistoryItem.message;
        }
        return "(Unknown column: " + column.id + ")";
    }
};

_sccHistoryTreeView.prototype.getCellProperties = function(row, column)
{};

_sccHistoryTreeView.prototype.SortRevisionColumn = function(compare1, compare2)
{
    // Special sorter for revision values, as CVS revisions can have the form:
    //   10.2.45.111
    // Each compare argument is an object that contains these attributes:
    //   compare1.data      ->  data (string) return by getCellText.
    //   compare1.row       ->  the real underlying row object.
    //   compare1.oldindex  ->  original row index before the sort.
    if (compare1 && compare2) {
        if (compare1.data == compare2.data) {
            // Keep the sort order as uniform as possible.
            return compare1.oldindex - compare2.oldindex;
        } else {
            //return parseInt(compare1.data) - parseInt(compare2.data);
            var value1 = compare1.row.version.split(".");
            var value2 = compare2.row.version.split(".");
            for (var i=0; i < value1.length; i++) {
                if (i >= value2.length) {
                    //dump("Comparing " + value1 + " and " + value2 + "\n");
                    return 1;
                } else if (parseInt(value1[i]) > parseInt(value2[i])) {
                    return 1;
                } else if (parseInt(value1[i]) < parseInt(value2[i])) {
                    return -1;
                }
                /* else, they are the same and we continue looping */
            }
        }
    }
    return -1;
};

_sccHistoryTreeView.prototype.SortDateColumn = function(compare1, compare2)
{
    // Special sorter for date values, examle date formats:
    //   Wed Jun 30 21:49:08 1993 +0200
    //   2006/12/20 12:34:01
    //   2008-10-14 12:23:26 -0700 (Tue, 14 Otc 2008)
    // Each compare argument is an object that contains these attributes:
    //   compare1.data      ->  data (string) return by getCellText.
    //   compare1.row       ->  the real underlying row object.
    //   compare1.oldindex  ->  original row index before the sort.
    if (compare1 && compare2) {
        if (compare1.data == compare2.data) {
            // Keep the sort order as uniform as possible.
            return compare1.oldindex - compare2.oldindex;
        } else {
            return Date.parse(compare1.data) - Date.parse(compare2.data);
        }
    }
    return -1;
};

_sccHistoryTreeView.prototype.markRevisionAsLocal = function(revision) {
    //dump("Looking for revision: " + revision + "\n");
    this._localRevisionHistoryItem = null;
    // Find and select the row with this revision
    for (var i=0; i < this._rows.length; i++) {
        if (this._rows[i].version == revision) {
            this.selection.select(i);
            this._localRevisionHistoryItem = this._rows[i];
            //dump("Found local revision at row: " + i + "\n");
            break;
        }
    }
};


//---- interface routines for XUL

function scc_history_reload()
{
    gSCCHistoryCache = {};
    scc_history_OnLoad();
}

function scc_history_OnLoad(retry = true)
{
    try {
        self = this;
        document.title = "SCC History";

        // .urls
        var urls;
        if (window.arguments && window.arguments[0].urls)
            urls = window.arguments[0].urls;
        else
            urls = [ko.scc.getRepositoryRoot()];
            
        if (typeof urls == "undefined" || urls == null || urls.length < 1) {
            //XXX Is this the kind of error handling we want to do in onload
            //    handlers?
            var msg = "Internal Error: illegal 'urls' value for "
                      +"SCC History dialog: '"+urls+"'.";
            gSCCHistoryDialog_log.error(msg);
            alertFeedback(msg);
            window.close();
        }
        
        // .sccHandler
        var scc_handler
        if (window.arguments)
        {
            scc_handler = window.arguments[0].sccHandler;
            document.getElementById('view-all').setAttribute("collapsed", "true");
        }
        else {
            isWidget = true;
            
            if (window.location && window.location.hash == "#file") {
                isSingleFile = true;
                var file = require("ko/views").current().file;
                currentUrl = require("ko/views").current().url;
                if (file) {
                    scc_handler = ko.scc.getServiceForFile(file);
                }
                if ( ! file || ! scc_handler) {
                    document.getElementById('deck').selectedIndex = 0;
                    document.getElementById('spinner').classList.remove("enabled");
                    return;
                }
                urls = [file.URI];
            } else {
                scc_handler = ko.scc.getCurrentService();
                currentUrl = ko.scc.getRepositoryRoot();
            }
        }
        
        if ( ! window.arguments && ! scc_handler)
        {
            // Retry grabbing SCC info after 2 seconds
            // This is to deal with our flaky async SCC
            if (retry)
                setTimeout(scc_history_OnLoad.bind(null, false), 2000);
            return;
        }
        
        if (showLoader) {
            document.getElementById('deck').selectedIndex = 1;
            document.getElementById('spinner').classList.add("enabled");
        }
        
        if (typeof scc_handler == "undefined" || scc_handler == null) {
            //XXX Is this the kind of error handling we want to do in onload
            //    handlers?
            var msg = "Internal Error: illegal 'sccHandler' value for "
                      +"SCC History dialog: '" + scc_handler + "'.";
            gSCCHistoryDialog_log.error(msg);
            alertFeedback(msg);
            window.close();
        }

        var localRevisions;
        if (window.arguments)
        {
            localRevisions = window.arguments[0].localRevisions;
            if (typeof localRevisions == "undefined" || localRevisions == null ||
                localRevisions.length != urls.length) {
                var msg = "Internal Error: illegal 'localRevisions' value for "
                          +"SCC History dialog: '"+localRevisions+"'.";
                gSCCHistoryDialog_log.error(msg);
                alertFeedback(msg);
                window.close();
            }
        }
        else
        {
            localRevisions = ["?"];
        }

        gSCCHistoryDialog = new _scc_history_dialog(scc_handler, urls,
                                                    localRevisions);

        // Select the first url in the given list
        if (urls && urls.length > 0) {
            try {
                gSCCHistoryDialog.urlsTreeView.selection.select(0);
            } catch (e) {}
        }

        // Listen for keypress events (on capture)
        try {
            window.removeEventListener("keypress", _scc_history_keypressHandler, true);
        } catch(e) {}
        window.addEventListener("keypress", _scc_history_keypressHandler, true);
        
        gDiffBrowser = document.getElementById('diff');
        if (gDiffBrowser.contentWindow.loadDiffResult) // may not be ready
            gDiffBrowser.contentWindow.loadDiffResult("Make a selection to view the diff");
        
        if (window.arguments)
            window.sizeToContent();
    } catch (e) {
        gSCCHistoryDialog_log.exception(e);
        alertFeedback(e);
        window.close();
    }
}

function scc_openDialog()
{
    if (window.arguments)
        return;
    
    if (window.location && window.location.hash == "#file")
        require("ko/windows").getMain().ko.commands.doCommand('cmd_SCChistory_File');
    else
        require("ko/windows").getMain().ko.commands.doCommand('cmd_SCChistory');
}

function scc_history_OnUnload()
{
    window.removeEventListener("keypress", _scc_history_keypressHandler, true);
    if (gSCCHistoryDialog && gSCCHistoryDialog.async_op) {
        // Try and stop the asynchronous command from running.
        gSCCHistoryDialog.async_op.stop();
    }
}


function _scc_history_keypressHandler(event)
{
    gSCCHistoryDialog.handleKeypress(event);
}


function _scc_history_dialog(sccHandler, urls, localRevisions)
{
    try {
        // koISCC xpcom object
        this.sccHandler = sccHandler;
        // Array of strings
        this.urls = urls;
        // Array of strings, one for each url in urls
        this.localRevisions = localRevisions;
        // The local revision for the url currently selected
        this.localRevisionForUrl = "";
        /**
         * Asynchronous scc history operation running in the background.
         * @type Components.interfaces.koIAsyncOperation
         */
        this.async_op = null;
        // Last error service
        this._lastErrorSvc = Components.classes["@activestate.com/koLastErrorService;1"]
                                .getService(Components.interfaces.koILastErrorService);
        // Prefs
        var prefsSvc = Components.classes["@activestate.com/koPrefService;1"].
                            getService(Components.interfaces.koIPrefService);
        this._prefs = prefsSvc.prefs;

        // Find some xul elements
        this.dialog = document.getElementById("dialog-scc-history");
        this.messageField = document.getElementById("scc_history_message");
        this.authorField = document.getElementById("scc_history_author");
        this.uuidField = document.getElementById("scc_history_uuid");
        this.urlsVbox = document.getElementById("scc_history_urls_vbox");
        this.urlsTree = document.getElementById("scc_history_urls_tree2");
        this.historyTree = document.getElementById("scc_history_items_tree2");
        this.history_revision_column = document.getElementById("scc_history_items_tree_column_revision2");
        this.history_change_column = document.getElementById("scc_history_items_tree_column_change2");
        this.history_action_column = document.getElementById("scc_history_items_tree_column_action2");
        this.history_date_column = document.getElementById("scc_history_items_tree_column_date2");
        this.cmd_diffSelectedRevision = document.getElementById("cmd_sccHistory_diffSelectedRevision");
        this.cmd_diffToLocalVersion   = document.getElementById("cmd_sccHistory_diffToLocalVersion");
        this.cmd_diffToCurrentVersion = document.getElementById("cmd_sccHistory_diffToCurrentVersion");
        this.cmd_diffBetweenVersions  = document.getElementById("cmd_sccHistory_diffBetweenVersions");
        this.cmd_copySelectedRevision = document.getElementById("scc_history_diff_copy_revision");

        // show url section tree if there is more than one url
        if (this.urls.length > 1) {
            this.urlsVbox.setAttribute("collapsed", false);
            // get taller if there are a lot of urls
            if (this.urls.length > 20) {
                this.urlsTree.style.setProperty("min-height", "400px", "");
            }
        } else {
            this.urlsVbox.setAttribute("collapsed", true);
        }

        // Action is only applicable for perforce
        // XXX - This should come from the scc service object!
        if (this.sccHandler.name != "p4") {
            this.history_action_column.setAttribute("hidden", "true");
            this.history_change_column.setAttribute("hidden", "true");
        }

        // Setup the tree views
        this.urlsTreeView = new _sccHistoryTreeView(0, this.urls);
        this.urlsTree.treeBoxObject.view = this.urlsTreeView;

        this.historyTreeView = new _sccHistoryTreeView(1, []);
        this.historyTree.treeBoxObject.view = this.historyTreeView;

        this.check_hyperlink_support();
        
        // Remote listeners
        // removing bindings is weird due to JS prototype?
        var oldField = this.uuidField;
        this.uuidField = this.uuidField.cloneNode(true);
        oldField.parentNode.replaceChild(this.uuidField, oldField);

        this.uuidField.addEventListener("click", this.on_click_uuid.bind(this));

    } catch (e) {
        gSCCHistoryDialog_log.exception(e);
    }
}

_scc_history_dialog.prototype.on_click_uuid = function () 
{
    var rowNum = this.historyTreeView.selection.currentIndex;
    if ( ! this.historyTreeView._linkUrlTemplate)
        return;
    var url = this.historyTreeView._linkUrlTemplate.replace('%uuid%', this.historyTreeView._rows[rowNum].version);
    require("ko/windows").getMain().ko.browse.openUrlInDefaultBrowser(url);
}

_scc_history_dialog.prototype.check_hyperlink_support = function ()
{
    var url = this.urls[0];
    ko.scc.getWebService(url, function(data) {
        if (data)
        {
            this.historyTreeView._linkUrlTemplate = data.commitTemplate;
        }
    }.bind(this));
}

_scc_history_dialog.prototype.onClick = function (event)
{
    if (event.button != 0) {
        return;
    }
    if (!this.historyTreeView._linkUrlTemplate) {
        return;
    }
    var row = {}, col = {};
    this.historyTree.treeBoxObject.getCellAt(event.pageX, event.pageY, row, col, {});
}

// Load history info for a url
_scc_history_dialog.prototype.load_history_for_url = require("contrib/underscore").throttle(function (url, callback)
{
    if (showLoader) {
        document.getElementById('deck').selectedIndex = 1;
        document.getElementById('spinner').classList.add("enabled");
    }
    
    try {
        var options = "";
        // XXX - These options should come from the scc service!
        switch (this.sccHandler.name) {
            case 'p4':
                // XXX - Move these to a user controlled widget.
                //       These options should to be retrieved through the
                //       sccHandler.
                options = "L";    /* longFormat */
                options += "i";   /* follow branches */
                break;
        }
        var self = this;
        var log = gSCCHistoryDialog_log;
        var async_callback = {
            "callback": function(result, data) {
                try {
                    // Op is not longer running, don't need the reference to it.
                    self.async_op = null;
                    // data will be an array of koISCCHistoryItem,
                    // throw it into the tree view.
                    if (result == Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
                        if (window.arguments)
                            gSCCHistoryCache[url] = data;
                        self.historyTreeView.setTreeRows(data);
                        self.historyTreeView.selection.select(0);
                        // Select the first history item (most recent) in the list
                        if (data.length > 0) {
                            // Initially, sort the columns in descending
                            // revision order. For perforce, when listing
                            // branch info, the revision number gets restarted,
                            // so we sort perforce changes by the change number.
                            self.historyTreeView.markRevisionAsLocal(self.localRevisionForUrl);
                            self.original_sorted_rows = self.historyTreeView.rows.concat() /* a copy */;
                            //this.historyTreeView.selection.select(0);
                        }
                        
                        if (gSCCHistoryDialog.historyTree.currentIndex == -1)
                        {
                            gSCCHistoryDialog.historyTree.currentIndex = 0;
                            gSCCHistoryDialog.historyTreeView.selection.select(0);
                        }
                        
                        // Title: "filename : revision xyz"
                        if (self.localRevisionForUrl == "?")
                            document.title = "History for " + ko.uriparse.baseName(url);
                        else
                            document.title = ko.uriparse.baseName(url) + " : local revision is " + self.localRevisionForUrl;
                            
                        document.getElementById('deck').selectedIndex = 2;
                        document.getElementById('spinner').classList.remove("enabled");
                        
                        if (callback)
                            callback();
                    } else if (result == Components.interfaces.koIAsyncCallback.RESULT_STOPPED) {
                        if (window)
                            window.close();
                    } else if (result == Components.interfaces.koIAsyncCallback.RESULT_ERROR) {
                        // data should contain the error message then.
                        if (data) {
                            alertFeedback("SCC History: " + data);
                        } else {
                            alertFeedback("History could not be retrieved.");
                        }
                        if (window)
                            window.close();
                    }
                } catch (e) {
                    log.warn("could not load history results, exception: " + e);
                }
                self = null;
                log = null;
            }
        };
        
        var searchElem = document.getElementById('scc_history_items_search_textbox');

        var limit = 0;
        if ( ! window.arguments && ! searchElem.value)
        {
            var prefs = Components.classes["@activestate.com/koPrefService;1"].
                                getService(Components.interfaces.koIPrefService).prefs;
            limit = prefs.getLong("scc_history_widget_limit", 25);
        }
        
        if (url in gSCCHistoryCache)
        {
            async_callback.callback(Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL, gSCCHistoryCache[url]);
        }
        else
        {
            this.async_op = this.sccHandler.history(url,  /* scc file   */
                                                    options,
                                                    limit,
                                                    async_callback);
        }
    } catch (e) {
        gSCCHistoryDialog_log.exception(e);
    }
}, 1000);

// Load history items for the given url
_scc_history_dialog.prototype.urls_onSelectionChange = function ()
{
    try {
        // Update the history items tree
        var uri = this.urls[this.urlsTree.currentIndex];
        this.localRevisionForUrl = this.localRevisions[this.urlsTree.currentIndex];
        this.load_history_for_url(uri);
    } catch (e) {
        gSCCHistoryDialog_log.exception(e);
    }
}

// Load history details for the given history item
_scc_history_dialog.prototype.history_onSelectionChange = function ()
{
    try {
        //dump("history_onSelectionChange\n");
        // Update the history message box
        if (this.historyTreeView.rows.length && this.historyTree.currentIndex >= 0 && this.historyTreeView.rows[this.historyTree.currentIndex]) {
            //dump("this.historyTree.currentIndex: "  + this.historyTree.currentIndex + "\n");
            var message = this.historyTreeView.rows[this.historyTree.currentIndex].message;
            var author = this.historyTreeView.rows[this.historyTree.currentIndex].author;
            var uuid = this.historyTreeView.rows[this.historyTree.currentIndex].version;
            this.messageField.textContent = message;
            this.authorField.textContent = author;
            this.uuidField.textContent = uuid;
            this.diffSelectedRevision(); 
        }

        this.cmd_diffSelectedRevision.setAttribute("disabled",
                                                   (this.historyTreeView.selection.count != 1));
        this.cmd_diffToLocalVersion.setAttribute("disabled",
                                                   (this.historyTreeView.selection.count != 1));
        this.cmd_diffToCurrentVersion.setAttribute("disabled",
                                                   (this.historyTreeView.selection.count != 1));
        this.cmd_diffBetweenVersions.setAttribute("disabled",
                                                   (this.historyTreeView.selection.count != 2));
        this.cmd_copySelectedRevision.setAttribute("disabled",
                                                   (this.historyTreeView.selection.count != 1));
    } catch (e) {
        gSCCHistoryDialog_log.exception(e);
    }
}

_scc_history_dialog.prototype.performDiff = function (uri1, version1,
                                                      uri2, version2,
                                                      filepath, diffToLocal)
{
    try {
        // Get diff revision options
        // XXX - Should come from the scc service!
        var options = '';
        switch (this.sccHandler.name) {
            case 'p4':
                if (diffToLocal) {
                    if (this.historyTreeView._localRevisionHistoryItem &&
                        (this.historyTreeView._localRevisionHistoryItem.uri !=
                         uri1)) {
                        alertFeedback("Cannot perform diff between client file and a depot file on a different branch");
                        return;
                    }
                    uri1 = filepath + "#" + version1
                }
                break;
            default:
                if (diffToLocal) {
                    options = this.sccHandler.getValue("cmdline_arg_for_diff_revision",
                                                       version1);
                }
                break;
        }
        if (diffToLocal) {
            var service = ko.scc.getServiceForUrl(uri1);
            if ( ! service) return;
            service.diff(1, [uri1], options, '', (_, diff) => {
                gDiffBrowser.contentWindow.loadDiffResult(diff);
            });
        } else {
            var service = ko.scc.getServiceForUrl(uri1);
            if ( ! service) return;
            service.diffRevisions(uri1, version1, uri2, version2, filepath,
                                  options, '', (_, diff) => {
                gDiffBrowser.contentWindow.loadDiffResult(diff);
            });
        }

    } catch (e) {
        gSCCHistoryDialog_log.exception(e);
    }
}

_scc_history_dialog.prototype.diffSelectedRevision = function ()
{
    try {
        window.setCursor("wait");
        // Get the uri
        var filepath = this.urls[this.urlsTree.currentIndex];
        // Get the version number of the selected row
        var rowNum = this.historyTreeView.selection.currentIndex;
        var selectedRow = this.historyTreeView.rows[rowNum];
        if (! selectedRow || ! this.original_sorted_rows) return;
        var uri1 = selectedRow.uri;
        var version1 = selectedRow.version;

        var sortedRowIndex = this.original_sorted_rows.indexOf(selectedRow);
        if (sortedRowIndex < (this.original_sorted_rows.length - 1)) {
            var version2 = this.original_sorted_rows[sortedRowIndex + 1].version;
        } else {
            gDiffBrowser = document.getElementById('diff');
            gDiffBrowser.contentWindow.loadDiffResult("There are no previous versions to this one.");
            return;
        }

        this.performDiff(uri1, version2, '', version1, filepath, false);
    } catch (e) {
        gSCCHistoryDialog_log.exception(e);
    } finally {
        window.setCursor("auto");
    }
}

_scc_history_dialog.prototype.diffToLocalVersion = function ()
{
    try {
        window.setCursor("wait");
        // Get the uri
        var filepath = this.urls[this.urlsTree.currentIndex];
        // Get the version number of the selected row
        var rowNum = this.historyTreeView.selection.currentIndex;
        var uri1 = this.historyTreeView.rows[rowNum].uri;
        var version1 = this.historyTreeView.rows[rowNum].version;

        this.performDiff(uri1, version1, '', '', filepath, true);
    } catch (e) {
        gSCCHistoryDialog_log.exception(e);
    } finally {
        window.setCursor("auto");
    }
}

_scc_history_dialog.prototype.diffToCurrentVersion = function ()
{
    try {
        window.setCursor("wait");
        // Get the uri
        var filepath = this.urls[this.urlsTree.currentIndex];
        // Get the version number of the selected row
        var rowNum = this.historyTreeView.selection.currentIndex;
        var uri1 = this.historyTreeView.rows[rowNum].uri;
        var version1 = this.historyTreeView.rows[rowNum].version;

        this.performDiff(uri1, version1, filepath, '', filepath, false);
    } catch (e) {
        gSCCHistoryDialog_log.exception(e);
    } finally {
        window.setCursor("auto");
    }
}

_scc_history_dialog.prototype.diffBetweenVersions = function ()
{
    try {
        // Get the uri
        window.setCursor("wait");

        // Get the selected tree rows
        var selected = [];
        var start = new Object();
        var end = new Object();
        var numRanges = this.historyTreeView.selection.getRangeCount();
        for (var t=0; t<numRanges; t++) {
            this.historyTreeView.selection.getRangeAt(t, start, end);
            for (var v = start.value; v <= end.value; v++){
                selected.push(v);
            }
        }
        //alert("Selected: " + selected);
        // Get the version numbers of the selected rows
        // XXX - For perforce, we need to take into account branches, as this
        //       means they may be a different filenames.
        var uri1 = this.historyTreeView.rows[selected[1]].uri;
        var version1 = this.historyTreeView.rows[selected[1]].version;
        var uri2 = this.historyTreeView.rows[selected[0]].uri;
        var version2 = this.historyTreeView.rows[selected[0]].version;
        var filepath = this.urls[this.urlsTree.currentIndex];

        this.performDiff(uri1, version1, uri2, version2, filepath, false);
    } catch (e) {
        gSCCHistoryDialog_log.exception(e);
    } finally {
        window.setCursor("auto");
    }
}

_scc_history_dialog.prototype.doDefaultDiff = function ()
{
    try {
        if (this.historyTreeView.selection.count == 1) {
            this.diffToLocalVersion();
        } else if (this.historyTreeView.selection.count == 2) {
            this.diffBetweenVersions();
        }
    } catch (e) {
        gSCCHistoryDialog_log.exception(e);
    }
}

_scc_history_dialog.prototype.copySelectedRevision = function ()
{
    try {
        var rowNum = this.historyTreeView.selection.currentIndex;
        var selectedRow = this.historyTreeView.rows[rowNum];
        opener.xtk.clipboard.setText(selectedRow.version);
    } catch (e) {
        gSCCHistoryDialog_log.exception(e);
    }
}

_scc_history_dialog.prototype.handleKeypress = function (event)
{
    try {
        if (event.keyCode == event.DOM_VK_RETURN) {
            // We only want to fire this when we are not already focused on a
            // button, else it gets fired automatically by the button handler
            if (event.target.id != 'scc_history_diff_to_local_version_button' &&
                event.target.id != 'scc_history_diff_between_versions_button') {
                event.stopPropagation();
                event.preventDefault();
                event.cancelBubble = true;
                gSCCHistoryDialog.doDefaultDiff();
            }
        }
    } catch (e) {
        gSCCHistoryDialog_log.exception(e);
    }
}


_scc_history_dialog.prototype.filter = function (text)
{
    showLoader = false;
    this.historyTree.setAttribute("disabled", true);
    var doFilter = () => {
        try {
            this.historyTreeView.filter(text);
        } catch (e) {
            gSCCHistoryDialog_log.exception(e);
        }

        showLoader = true;
        this.historyTree.removeAttribute("disabled");
    };

    if ( ! window.arguments) {
        this.load_history_for_url(currentUrl, doFilter);
    }
    else {
        doFilter();
    }
}

// Global init

window.addEventListener("load", function() { setTimeout(function() {
    
    var w = require("ko/windows").getMain();
    var observer = {
        observe: function (subject, topic, data)
        {
            var url;
            if (window.location && window.location.hash == "#file")
            {
                url = require("ko/views").current().file;
                if ( ! url) return;
                url = url.URI;
            }
            else
            {
                url = ko.scc.getRepositoryRoot();
            }
            
            var reload = false;
            var urllist = data.split('\n');
            for (let u of urllist) {
                if (u in gSCCHistoryCache)
                    delete gSCCHistoryCache[u];
                if (u == url)
                    reload = true;
            }
            
            if (reload)
            {
                scc_history_OnLoad();
            }
        }
    };

    var observerSvc = Components.classes["@mozilla.org/observer-service;1"]
                                    .getService(Components.interfaces.nsIObserverService);
    observerSvc.addObserver(observer, "file_status", false);
    
    // Widget should change content based on current file
    if (isWidget)
    {
        document.documentElement.classList.add("embedded");
        
        var tab = isSingleFile ? 'historyFile' : 'history';
        
        // Force reload when our tab is accessed
        ko.scc.widget.getTab(tab).addEventListener("command", scc_history_OnLoad);
        
        var reloadWidget = function()
        {
            if (isWidget && ! ko.scc.widget.shouldReload(tab))
                return;
            
            if (isSingleFile)
            {
                return scc_history_OnLoad();
            }
            else
            {
                return scc_history_OnLoad();
            }
        }.bind(this);
        
        var clearCache = function()
        {
            gSCCHistoryCache = {};
            reloadWidget();
        }.bind(this);
        
        w.addEventListener("current_place_opened", reloadWidget);
        w.addEventListener("project_opened", reloadWidget);
        w.addEventListener("workspace_restored", reloadWidget);
        w.addEventListener("current_view_changed", reloadWidget);
        w.addEventListener("SCC", clearCache);
    }
}, 10)});
