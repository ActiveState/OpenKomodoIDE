/* Copyright (c) 2009 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* DB Explorer functionality.
 *
 * Defines the "ko.dbexplorer" namespace.
 */

ko.dbexplorer = {};
(function() {

//---- globals

var XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                .getService(Components.interfaces.nsIStringBundleService)
                .createBundle("chrome://dbexplorer/locale/dbexplorer.properties");
var log = ko.logging.getLogger("dbexplorer");

this.viewManager = null;
this.viewObserver = null;

function dbxObserver() {
    // Watch prefs here
}

dbxObserver.prototype.finalize = function() {
}

//---- the UI Manager for the DBExplorer View

function dbxManager(treeId) {
    try {
        this.tree = document.getElementById('dbexplorer-tree');
        this.filter = document.getElementById('dbexplorer-filter-textbox');
        this.filterString = "";
        this._resetTimeout = null;
    } catch (e) {
        _gDOMView_log.exception(e);
    }
}
dbxManager.prototype.constructor = dbxManager;

//dbxManager.prototype.__defineGetter__("view",
//function()
//{
//    if (!this.tree) return null;
//    return this.tree.view;
//});

dbxManager.prototype.initialize = function() {
    this.view = Components.classes["@activestate.com/koDatabaseExplorerTreeView;1"]
        .createInstance(Components.interfaces.koIDatabaseExplorerTreeView);
    if (!this.view) {
        throw("couldn't create a koDatabaseExplorerTreeView");
    }
    this.tree.treeBoxObject
                    .QueryInterface(Components.interfaces.nsITreeBoxObject)
                    .view = this.view;
    this.view.initialize();
};

dbxManager.prototype.addDatabase = function() {
    var uri = "chrome://dbexplorer/content/addConnection.xul";
    var windowType = "kodbexplorer:addConnection";
    var features = [
        "menubar=no",
        "toolbar=no",
        "location=no",
        "status=yes",
        "scrollbars=yes",
        "resizable=yes",
        "minimizable=yes",
        "chrome=yes",
        "modal=yes"
    ].join(",");
    var win = window.openDialog(uri, windowType, features,
                                {ko:ko,
                                 view:this.view,
                                 rowNum:-1, // Not used when adding a connection
                                 operation:'add'
                                });
};

const MAIN_PREF_NAME = "ko-dbexplorer";

dbxManager.prototype.addSqliteDatabaseFromURI = function(uri, callingWindow) {
    var cdcPrefList;
    var prefset = Components.classes["@activestate.com/koPrefService;1"].
                       getService(Components.interfaces.koIPrefService).prefs;
    if (!prefset.hasPref(MAIN_PREF_NAME)) {
        prefset.setPref(MAIN_PREF_NAME, Components.classes["@activestate.com/koPreferenceSet;1"].createInstance());
    }
    prefset = prefset.getPref(MAIN_PREF_NAME);
    if (prefset.hasPref('currentDatabaseConnections')) {
        cdcPrefList = prefset.getPref('currentDatabaseConnections');
    } else {
        cdcPrefList = Components.classes['@activestate.com/koPreferenceSet;1'].
                                     createInstance(Components.interfaces.koIPreferenceSet);
        prefset.setPref('currentDatabaseConnections', cdcPrefList);
    }
    var koFileEx = Components.classes["@activestate.com/koFileEx;1"]
                             .createInstance(Components.interfaces.koIFileEx);
    koFileEx.URI = uri;
    if (!koFileEx.isLocal) {
        return false;
    }
    koFileEx.open('rb');
    var leadingBytes = [];
    try {
        leadingBytes = koFileEx.read(30, {});
        var zeroPt = leadingBytes.indexOf(0);
        if (zeroPt > 0) {
            leadingBytes = leadingBytes.slice(0, zeroPt);
        }
        leadingBytes = leadingBytes.map(function(d) String.fromCharCode(d)).join("");
    } finally {
        koFileEx.close();
    }
    var m = /^SQLite format (\d+)/.exec(leadingBytes);
    if (!m) {
        ko.dialogs.alert("Not a sqlite database: " + path);
        return false;
    }
    var path = koFileEx.path;
    var db_type = "SQLite" + m[1];
    var connectionName = db_type + ":" + path;
    var connectionURI = "dbexplorer://" + db_type + "/" + path;
    var dbview = this.view;
    var targetRow = null;
    for (var i = 0; i < dbview.rowCount; i++) {
        if (dbview.getNodeType(i) == "connection"
            && dbview.getNodeName(i) == connectionName) {
            targetRow = i;
            break;
        }
    }
    if (targetRow === null) {
        if (cdcPrefList.hasPref(connectionURI)) {
            ko.dialogs.alert("This sqlite file should already be loaded, but it wasn't found in the explorer: " + path);
            return false;
        }
        var prefObj = Components.classes['@activestate.com/koPreferenceSet;1'].
                       createInstance(Components.interfaces.koIPreferenceSet);
        prefObj.setStringPref('db_type', db_type);
        prefObj.setStringPref("dbPath", path);
        cdcPrefList.setPref(connectionURI, prefObj);
        // We have to do this because of bug 83916
        prefset.setPref('currentDatabaseConnections', cdcPrefList);
        targetRow = dbview.rowCount;
        dbview.addConnection(connectionURI);
    }
    // Show the tab, highlight the row, and get out of here.
    callingWindow.focus();
    callingWindow.ko.uilayout.toggleTab("dbexplorer_viewbox", false);
    dbview.selection.currentIndex = targetRow;
    if (dbview.isContainer(targetRow)
        && !dbview.isContainerOpen(targetRow)
        && !dbview.isContainerEmpty(targetRow)) {
        dbview.toggleOpenState(targetRow);
    }
    return true;
};

dbxManager.prototype.refreshDatabases = function() {
    var img_url = this.tree.getAttribute('src');
    dump("refreshDatabases ..., img_url=" + img_url + "\n");
    this.tree.setAttribute('src', "chrome://global/skin/icons/loading_16.png");
    this.view.refreshDatabases();
    this.tree.treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject).invalidate();
    if (img_url) {
        this.tree.setAttribute('src', img_url);
    } else {
        this.tree.removeAttribute('src');
    }
    dump("refreshDatabases ...done\n");
};

dbxManager.prototype.finalize = function() {
    this.view.finalize();
    this.view = null;
};

dbxManager.prototype.focus = function() {
    log.debug("dbxManager.focus()");
    try {
        // See domview.js:: DOMViewManager.prototype.focus for an explanation.
        this.tree.focus();
    } catch(ex) {
        log.exception(ex);
    }
}

dbxManager.prototype.updateFilter = function() {
    log.debug("dbxManager.updateFilter()");
    try {
        this.filterString = this.filter.value;
    } catch(ex) {
        log.exception(ex);
    }
}

// ENTER / RETURN => should be like a double-click
dbxManager.prototype.onTreeKeyPress = function(event) {
    if (event.keyCode == event.DOM_VK_RETURN) {
        this._processTreeNodeEventForViewing(event);
    }
}

dbxManager.prototype.focusFilterBox = function(event) {
    this.filter.focus();
}

dbxManager.prototype.onFilterKeypress = function(event) {
    log.debug("dbxManager.onTreeKeyPress(event)");
    try {
        if (event.keyCode == event.DOM_VK_TAB && !event.ctrlKey)
        {
            this.tree.focus();
        }
        if (event.keyCode == event.DOM_VK_ESCAPE)
        {
            dump("dbx - filter - ESC - now what? \n");
            event.cancelBubble = true;
            event.stopPropagation();
            event.preventDefault();
            this.filter.value = '';
            this.updateFilter();
            this.tree.focus();
            return;
        }
    } catch(ex) {
        log.exception(ex);
    }
}

dbxManager.prototype.onDblClick = function(event) {
    this._processTreeNodeEventForViewing(event, true);
}

dbxManager.prototype._processTreeNodeEventForViewing = function(event, isClicked) {
    try {
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
            return;
        } else {
            if (typeof(isClicked) == "undefined") isClicked = false;
            var idx;
            if (isClicked) {
                idx = this.tree.treeBoxObject.getRowAt(event.clientX, event.clientY);
            }
            if (!isClicked || (idx == null || typeof(idx) == "undefined")) {
                // Look at the tree index
                var target = event.originalTarget;
                if (target.nodeName == "treechildren") {
                    target = target.parentNode;
                }
                var idx = target.currentIndex;
            }
            if (idx == null || typeof(idx) == "undefined") {
                dump("Current index not found off node "
                     + event.originalTarget.nodeName
                     + "\n");
                return;
            }
            var nodeType = this.view.getNodeType(idx);
            //dump("got type: [" + nodeType + "]");
            if (this.view.isContainer(idx) && nodeType != "table") {
                // do default
                this.view.toggleOpenState(idx);
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            event.cancelBubble = true;
            ko.dbexplorer.displayLeaf(nodeType, idx);
        }
    } catch(ex) {
        log.exception(ex);
    }
}

//---- public routines

// In these two functions "this" is window, because they're
// event handlers.
 var this_ = ko.dbexplorer;
this.initialize = function()
{
    log.setLevel(ko.logging.LOG_DEBUG);
    try {
        ko.dbexplorer.viewManager = new dbxManager();
        ko.dbexplorer.viewManager.initialize();
        ko.dbexplorer.viewObserver = new dbxObserver();
        ko.main.addWillCloseHandler(this.finalize);
    } catch(ex) {
        log.exception(ex);
    }
}

this.finalize = function()
{
    try {
        ko.dbexplorer.viewObserver.finalize();
        ko.dbexplorer.viewManager.finalize();
    } catch(ex) {
        log.exception(ex);
    }
};

this.initContextMenu = function(event) {
    var menupopup = document.getElementById("dbexplorer_popup");
    while (menupopup.firstChild) {
        menupopup.removeChild(menupopup.firstChild);
    }
    var view = ko.dbexplorer.viewManager.view;
    var row = view.selection.currentIndex;
    var nodeType = view.getNodeType(row);
    switch (nodeType) {
    case "connection":
        var dbName = view.getNodeName(row);
        var menuitem = document.createElementNS(XUL_NS, 'menuitem');
        var label;
        menuitem.setAttribute("id", "menu_refresh_" + dbName);
        menuitem.setAttribute('label',
                              _bundle.GetStringFromName("refresh.label"));
        menuitem.setAttribute("accesskey", dbName[0]);
        menuitem.setAttribute("oncommand",
                              "ko.dbexplorer.refreshConnection(" + row + ")");
        menupopup.appendChild(menuitem);

        menuitem = document.createElementNS(XUL_NS, 'menuitem');
        menuitem.setAttribute("id", "modify_" + dbName);
        label = _bundle.GetStringFromName("modify.label");
        menuitem.setAttribute('label', label);
        menuitem.setAttribute("accesskey", label[0]);
        menuitem.setAttribute("oncommand",
                              "ko.dbexplorer.modifyConnection(" + row + ")");
        menupopup.appendChild(menuitem);

        menuitem = document.createElementNS(XUL_NS, 'menuitem');
        menuitem.setAttribute("id", "remove_" + dbName);
        label = _bundle.GetStringFromName("remove.label");
        menuitem.setAttribute('label', label);
        menuitem.setAttribute("accesskey", label[0]);
        menuitem.setAttribute("oncommand",
                              "ko.dbexplorer.removeConnection(" + row + ")");
        menupopup.appendChild(menuitem);
        break;
    case "table":
    case "index":
    case "trigger":
        var name = view.getNodeName(row);
        var menuitem = document.createElementNS(XUL_NS, 'menuitem');
        menuitem.setAttribute("id", "menu_table_display_" + name);
        menuitem.setAttribute('label',
                              "view " + nodeType + " " + name);
        menuitem.setAttribute("accesskey", name[0]);
        menuitem.setAttribute("oncommand",
                              "ko.dbexplorer.displayLeaf('" + (nodeType
                                                              + "', "
                                                              + row
                                                              + ")"));
        menupopup.appendChild(menuitem);
        break;
    default:
        var menuitem = document.createElementNS(XUL_NS, 'menuitem');
        menuitem.setAttribute('label', "no menu items yet");
        menuitem.setAttribute("disabled", true);
        menupopup.appendChild(menuitem);
    }
};

this.modifyConnection =  function modifyConnection(rowNum) {
    var uri = "chrome://dbexplorer/content/addConnection.xul";
    var windowType = "kodbexplorer:addConnection";
    var features = [
        "menubar=no",
        "toolbar=no",
        "location=no",
        "status=yes",
        "scrollbars=yes",
        "resizable=yes",
        "minimizable=yes",
        "chrome=yes",
        "modal=yes"
    ].join(",");
    var win = window.openDialog(uri, windowType, features,
                                {ko:ko,
                                 view:this.viewManager.view,
                                 rowNum:rowNum,
                                 operation:'modify'
                                });
}

this.refreshConnection = function(rowNum) {
    // this is ko.dbexplorer
    this.viewManager.view.refreshChildrenInfo(rowNum);
}

this.removeConnection =  function(rowNum) {
    this.viewManager.view.removeConnection(rowNum);
}

this.displayLeaf = function(nodeTypeName, rowNum) {
    //TODO: Verify that we can handle nodeTypeName
    var acceptedTypes = ['table', 'index', 'trigger'];
    if (acceptedTypes.indexOf(nodeTypeName) == -1) {
        if (0) {
            alert("Accepted database part types are "
                  + acceptedTypes.join(", ")
                  + ", don't know what to do with type ["
                  + nodeTypeName
                  + "]\n");
        }
        return;
    }
    var view = ko.dbexplorer.viewManager.view;
    var name = view.getNodeName(rowNum);
    //XXX For now assume sqlite3
    var uri = "chrome://dbexplorer/content/" + nodeTypeName + "Display.xul";
    var koDBConnection = view.getDBConnectionForTable(rowNum);
    var titleToFind = koDBConnection.tableViewTitle;
    var windowType = "kodbexplorer:" + titleToFind;
    var features = [
        "menubar=no",
        "toolbar=no",
        "location=no",
        "status=yes",
        "scrollbars=yes",
        "resizable=yes",
        "minimizable=yes",
        "chrome=yes"
    ].join(",");
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                        .getService(Components.interfaces.nsIWindowMediator);
                        
    try {
        var openWindows = wm.getEnumerator(null);
        var count = 0;
        while (openWindows.hasMoreElements()) {
            var openWindow = openWindows.getNext();
            if (!openWindow) {
                break;
            }
            if (openWindow && openWindow.document.title == titleToFind) {
                openWindow.restore();
                openWindow.focus();
                return;
            }
            count += 1;
        }
        if (count == 0) {
            dump("Couldn't find a window of type : " + "kodbexplorer" + "\n");
        }
    } catch(ex) {
        dump("enumerating: " + ex + "\n");
    }
    var win = window.openDialog(uri, windowType, features,
                        {'name':name,
                         connection:koDBConnection});
}

}).apply(ko.dbexplorer);

