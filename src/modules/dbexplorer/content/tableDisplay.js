/* Copyright (c) 2003-2009 ActiveState Software Inc.
See the file LICENSE.txt for licensing information. */

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
// pref names
const MAIN_PREF_NAME = "ko-dbexplorer";
const WINDOW_PREF_NAME = "window_ids";
const ALLOW_ROW_DELETION = "allow-row-deletion";
const COLUMN_CONVERTERS = "column-converters"; 
const HIDDEN_COLUMNS = "hidden-columns";
const TIMESTAMP = "timestamp";

const TABLE_DUMP_INDEX = 0;
const TABLE_QUERY_INDEX = 1;
const TABLE_SCHEMA_INDEX = 2;

//---- Globals

var log = ko.logging.getLogger("dbexplorer.tableDisplay");
log.setLevel(ko.logging.LOG_DEBUG);

var tableName = "";
var koDBConnection = null;
var widgets = {};
var eol = (navigator.platform.indexOf("Win32") == 0 ? "\r\n" : "\n");
var converters = [];
var gCurrentSortedColumnId = ""; // Name of the column we're sorting on.
var gAllowRowDeletion;

var gMainPrefs;
var gWindowSpecificPrefs;
var g_queryTreeNeedsBoxObject = true;

// Localization.
var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                .getService(Components.interfaces.nsIStringBundleService)
                .createBundle("chrome://dbexplorer/locale/dbexplorer.properties");
                

//---- Functions

function onLoad() {
    var args = window.arguments[0];
    tableName = args.name;
    koDBConnection = args.connection;
    xtk.include('clipboard');
    initializeGlobals();
    return initialize();
}

function onUnload() {
    saveHiddenColumnPrefs();
    saveColumnConverterPrefs();
    gWindowSpecificPrefs.setBooleanPref(ALLOW_ROW_DELETION, gAllowRowDeletion);
    gWindowSpecificPrefs.setLongPref(TIMESTAMP, (new Date).valueOf());
}

function onTreecolClick(event) {
    var t = event.target;
    if (t.localName == "treecol" && event.button == 0) {
        var sort_id = updateSortIndicators(t.parentNode, t.id);
        koDBConnection.updateSortInfo(gCurrentSortedColumnId, sort_id);
        refreshTable();
    }
}

function saveHiddenColumnPrefs() {
    var treecols = document.getElementById("dbx-tableDisplay-dataTreeCols");
    var children = treecols.childNodes;
    var hiddenColumns = [];
    for (var treecol, i = 0; treecol = children[i]; ++i) {
        if (treecol.getAttribute("hidden") == "true") {
            hiddenColumns.push(treecol.getAttribute("id"));
        }
    }
    gWindowSpecificPrefs.setStringPref(HIDDEN_COLUMNS, JSON.stringify(hiddenColumns));
}

function saveColumnConverterPrefs() {
    var names = koDBConnection.getColumnNames({});
    var className, converterClassNamesFromColumn = {};
    for (var name, i = 0; name = names[i]; ++i) {
        className = koDBConnection.getConverterClassName(name);
        if (className) {
            converterClassNamesFromColumn[name] = className;
        }
    }
    gWindowSpecificPrefs.setStringPref(COLUMN_CONVERTERS,
                                 JSON.stringify(converterClassNamesFromColumn));
}


/**
 * onResize -- change the size of the cache the back-end uses to hold
 * on to rows from the database.
 */
function onResize() {
    if (widgets.dataDumpTree) {
        // This might be called before onLoad
        updateTreeSize(widgets.dataDumpTree);
    }
}

function _sweepOldPrefs(windowIdPrefs) {
    var ids = windowIdPrefs.getPrefIds();
    var limit = 100;
    if (ids.length <= limit) {
        // Nothing to do
        return;
    }
    var entries = [];
    for (var key, i = 0; key = ids[i]; ++i) {
        entries.push([windowIdPrefs.getPref(key).getLongPref("timestamp"), key]);
    }
    entries.sort(function(a, b) { return b[0] - a[0] });
    // Cull oldest pref sets
    while (entries.length > limit) {
        windowIdPrefs.deletePref(entries.pop()[1])
    }
}

function initializeGlobals() {
    g_queryTreeNeedsBoxObject = true;
    
    widgets.tabs = document.getElementById("dbxtd-tabbox");
    widgets.dataDumpTree = document.getElementById("dbx-tableDisplay-dataTree");
    widgets.queryTree = document.getElementById("dbx-tableDisplay-queryDataTree");
    widgets.queryTreeCols = document.getElementById("dbx-tableDisplay-queryDataTreeCols");
    widgets.schemaTree = document.getElementById("dbx-tableSchema-dataTree");
    widgets.tableDisplay_rowCountLabel = document.getElementById("dbx-tableDisplay-rowCountInfo");
    
    var typeTextbox = document.getElementById("dbx-dbtype-textbox");
    var typeName = koDBConnection.getDatabaseDisplayTypeName();
    typeTextbox.value = typeName;
    var connLabel = document.getElementById("dbx-connection-info-label");
    //XXX: Unhardwire this
    connLabel.value = (typeName.indexOf("SQLite") === 0 ?
                       "Path:" : "Database:");
    var connTextbox  = document.getElementById("dbx-connection-info-textbox");
    var connInfo = koDBConnection.getConnectionDisplayInfo();
    connTextbox.value = connInfo;
    var tableNameTextbox = document.getElementById("dbx-current-table");
    tableNameTextbox.value = tableName;
    window.document.title = koDBConnection.tableViewTitle;
}

function initialize() {
    initPrefSets();
    initFullDataTree();
    // Init the schema after the data-tree because the data-tree init
    // creates the dataTreeView, and the schemaTreeView comes off the
    // dataTreeView.  Yes, this thing needs refactoring.
    initSchemaTree();
    initQueryDataTree();
    try {
        initFullDataTreeConverters();
    }catch(ex) {
        alert("initFullDataTreeConverters failed: " + ex)
    }
}

function initPrefSets() {
    // init the pref sets before we do anything else.
    var prefs = Components.classes["@activestate.com/koPrefService;1"].
            getService(Components.interfaces.koIPrefService).prefs;
    if (!prefs.hasPref(MAIN_PREF_NAME)) {
        gMainPrefs = Components.classes["@activestate.com/koPreferenceSet;1"].createInstance();
        prefs.setPref(MAIN_PREF_NAME, gMainPrefs);
    } else {
        gMainPrefs = prefs.getPref(MAIN_PREF_NAME);
    }
    var windowIdPrefs;
    if (!gMainPrefs.hasPref(WINDOW_PREF_NAME)) {
        windowIdPrefs = Components.classes["@activestate.com/koPreferenceSet;1"].createInstance();
        gMainPrefs.setPref(WINDOW_PREF_NAME, windowIdPrefs);
    } else {
        windowIdPrefs = gMainPrefs.getPref(WINDOW_PREF_NAME);
    }
    var window_id = window.document.title;
    if (!windowIdPrefs.hasPref(window_id)) {
        _sweepOldPrefs(windowIdPrefs);
        gWindowSpecificPrefs = Components.classes["@activestate.com/koPreferenceSet;1"].createInstance();
        windowIdPrefs.setPref(window_id, gWindowSpecificPrefs);
    } else {
        gWindowSpecificPrefs = windowIdPrefs.getPref(window_id);
    }

    // Set this now in case there's no reason to set it later.
    gWindowSpecificPrefs.setLongPref(TIMESTAMP, (new Date).valueOf());
    gAllowRowDeletion = false;   
    if (gWindowSpecificPrefs.hasPref(ALLOW_ROW_DELETION)) {
        gAllowRowDeletion = gWindowSpecificPrefs.getBooleanPref(ALLOW_ROW_DELETION);
    }
    document.getElementById("dbx-tableDisplay-allowDeletions").checked = gAllowRowDeletion;
}

function initFullDataTreeConverters() {
    // Find the converters
    const CATEGORY_TO_ENUMERATE = 'komodo-DBX-DataConverters';
    var classes = [];
    var categoryManager = Components.classes["@mozilla.org/categorymanager;1"].getService(Components.interfaces.nsICategoryManager);
    var enumerator = categoryManager.enumerateCategory(CATEGORY_TO_ENUMERATE);
    while (enumerator.hasMoreElements()) {
        var item = enumerator.getNext();
        var entry = item.QueryInterface(Components.interfaces.nsISupportsCString).data;
        classes.push(categoryManager.getCategoryEntry(CATEGORY_TO_ENUMERATE, entry));
    }
    for (var i = 0; i < classes.length; i++) {
        var clsName = classes[i];
        var obj;
        try {
            obj = Components.classes[clsName].createInstance(Components.interfaces.koIDBXCellDataConverter);
            converters.push([clsName, obj]);
        } catch(ex) {
            dump("Error trying to create class " + clsName + ": " + ex + "\n");
        }
    }
    converters.sort(function(a, b) { return a.label < b.label ? -1 : a.label > b.label ? 1 : 0});

    // And now update any converters
    var preferredConverters = _getColumnConverterPrefs();
    for (var columnName in preferredConverters) {
        var converterClassName = preferredConverters[columnName];
        for (var i = 0; i < converters.length; i++) {
            if (converters[i][0] == converterClassName) {
                koDBConnection.setConverter(columnName,
                                            converterClassName,
                                            converters[i][1]);
                break;
            }
        }
    }
}

function _getHiddenColumns() {
    if (!gWindowSpecificPrefs.hasPref(HIDDEN_COLUMNS)) {
        return [];
    }
    try {
        return JSON.parse(gWindowSpecificPrefs.getStringPref(HIDDEN_COLUMNS));
    } catch(ex) {
        dump("_getHiddenColumns: " + ex + "\n");
    }
    return [];    
}

function _getColumnConverterPrefs() {
    var defaultValue = {};
    if (!gWindowSpecificPrefs.hasPref(COLUMN_CONVERTERS)) {
        return defaultValue;
    }
    try {
        return JSON.parse(gWindowSpecificPrefs.getStringPref(COLUMN_CONVERTERS));
    } catch(ex) {
        dump("_getColumnConverterPrefs: " + ex + "\n");
    }
    return defaultValue;    
}

function _setTreeColumnLabels(treeRoot, columnNames, columnIds, hiddenColumnNames) {
    if (!columnIds || columnIds.length == 0) {
        columnIds = columnNames;
    }
    var treecols_elt = treeRoot.childNodes[0];
    while (treecols_elt.firstChild) {
        treecols_elt.removeChild(treecols_elt.firstChild);
    }
    var node, id;
    for (var name, i = 0; name = columnNames[i]; i++) {
        if (i > 0) {
            node = document.createElementNS(XUL_NS, "splitter");
            node.setAttribute("class", "tree-splitter");
            // Grow allows resizing of just the one treecol.
            node.setAttribute("resizeafter", "grow");
            treecols_elt.appendChild(node);
        }
        id = columnIds[i];
        node = document.createElementNS(XUL_NS, "treecol");
        //dump("Setting label:["
        //     + name
        //     + "], id:["
        //     + id
        //     + "]\n")
        node.setAttribute("id", id);
        node.setAttribute("label", name); //name
        // Default width, don't set a flex as the horizontal scrolling will be
        // lost.
        node.setAttribute("width", "100px");
        if (hiddenColumnNames.indexOf(id) >= 0) {
            node.setAttribute('hidden', 'true');
        }
        treecols_elt.appendChild(node);
    }
    // Allow resizing of the last column too.
    node = document.createElementNS(XUL_NS, "splitter");
    node.setAttribute("class", "tree-splitter");
    node.setAttribute("resizeafter", "grow");
    treecols_elt.appendChild(node);
}

// Force an update?
function initSchemaTree() {
    var schemaTreeView = widgets.schemaTreeView = 
        Components.classes["@activestate.com/koDBXSchemaTreeView;1"].
        createInstance(Components.interfaces.koIDBXSchemaTreeView);
    schemaTreeView.setupTableConnector(koDBConnection);
    widgets.dataDumpTreeView.schemaTreeView = schemaTreeView;
    var schemaColumnNames = schemaTreeView.getSchemaColumnNames({});
    var schemaColumnIds = schemaTreeView.getSchemaColumnIds({});
    var tree = widgets.schemaTree;
    var hiddenColumnNames = []; // XXX: todo: _getHiddenSchemaColumns() on schema
    _setTreeColumnLabels(tree, schemaColumnNames, schemaColumnIds, hiddenColumnNames);
    tree.treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject).view =
        schemaTreeView;
}

function initFullDataTree() {
    var tree = widgets.dataDumpTree;
    var names = koDBConnection.getColumnNames({});
    var hiddenColumnNames = _getHiddenColumns();
    _setTreeColumnLabels(tree, names, null, hiddenColumnNames);
    widgets.dataDumpTreeView = Components.classes["@activestate.com/koDBXTableDumpTreeView;1"]
      .createInstance(Components.interfaces.koIDBXTableDumpTreeView);
    if (!widgets.dataDumpTreeView) {
        throw("couldn't create a koDatabaseExplorerTreeView");
    }
    widgets.dataDumpTreeView.initialize(koDBConnection);
    var boxObject = 
        tree.treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    boxObject.view = widgets.dataDumpTreeView;
    updateTreeSize(tree);
    updateRowCountLabel();
}

function initQueryDataTree() {
    widgets.queryTreeView = Components.classes["@activestate.com/koDBXTableQueryTreeView;1"]
      .createInstance(Components.interfaces.koIDBXTableQueryTreeView);
    if (!widgets.queryTreeView) {
        throw("couldn't create a koDatabaseExplorerTreeView:queryTreeView");
    }
    widgets.queryTreeView.initialize(koDBConnection);
    g_queryTreeNeedsBoxObject = true;
    return;
    // Set up the boxObject - view connection once we have a query.
    var boxObject = 
        widgets.queryTree.treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    boxObject.view = widgets.queryTreeView;
}

function updateQueryDataTree() {
    var boxObject = 
        widgets.queryTree.treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    boxObject.view = widgets.queryTreeView;
    g_queryTreeNeedsBoxObject = false;
}

function refreshTable() {
    var boxObject = 
        widgets.dataDumpTree.treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    var firstVisibleLine = boxObject.getFirstVisibleRow();
    widgets.dataDumpTreeView.refreshTable();
    updateTreeSize(widgets.dataDumpTree);
    var newRowCount = widgets.dataDumpTreeView.numVisibleRows;
    var pageSize = boxObject.getPageLength();
    if (firstVisibleLine < newRowCount < pageSize) {
        boxObject.scrollToRow(firstVisibleLine);
    } else {
        boxObject.scrollToRow(newRowCount - pageSize);
    }
    updateRowCountLabel();
}

function updateTreeSize(tree) {
    var boxObject = 
        tree.treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    widgets.dataDumpTreeView.numVisibleRows = boxObject.getPageLength();
    boxObject.beginUpdateBatch();
    boxObject.invalidate();
    boxObject.endUpdateBatch();
}

function copyCellContents(selectedTreeViewName, row, col_id) {
    xtk.clipboard.setText(widgets[selectedTreeViewName].getCellText(row, {id:col_id}));
}

function _getRowIds(treecolsId) {
    var treecols_elt = document.getElementById(treecolsId);
    var children = treecols_elt.getElementsByTagName("treecol");
    var ids = [];
    var lim = children.length;
    var i;
    for (i = 0; i < lim; ++i) {
        ids.push(children[i].getAttribute("id"));
    }
    return ids;
}

function _getRowContents(selectedTreeViewName, row, ids) {
    var values = [];
    var lim = ids.length;
    for (var i = 0; i < lim; ++i) {
        values.push(widgets[selectedTreeViewName].getCellText(row, {id:ids[i]}));
    }
    var finalValue = values.join("\t");
    return finalValue;
}

function copyRowContents(selectedTreeViewName, treeColsId, row) {
    var ids = _getRowIds(treeColsId);
    var finalValue = _getRowContents(selectedTreeViewName, row, ids);
    xtk.clipboard.setText(finalValue);
}

function copySelectedRows(selectedTreeViewName, treeColsId, rowString) {
    var ids = _getRowIds(treeColsId);
    var rowStrings = [];
    var rowParts = rowString.split(',');
    for (var i = 0; i < rowParts.length; ++i) {
        var thisRowParts = rowParts[i].split("-");
        for (var rowNum = thisRowParts[0]; rowNum <= thisRowParts[1]; rowNum++) {
            rowStrings.push(_getRowContents(selectedTreeViewName, rowNum, ids));
        }
    }
    xtk.clipboard.setText(rowStrings.join(eol));
}

function setupAddEditWindow(windowName, cells) {
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
    var obj = {
        cells:cells,
        tableName: tableName,
        res:false,
        dbConnection:koDBConnection,
        dbTreeView:widgets.dataDumpTreeView,
        dbSchemaTreeView:widgets.schemaTreeView,
        __EOD__: null
    };
    window.openDialog('chrome://dbexplorer/content/editRow.xul',
                                windowName,
                                features,
                                obj);
    if (obj.res) {
        _repaintCurrentView();
    }
}

function addRow(idx) {
    var cells = [];
    var schemaTreeView = widgets.schemaTreeView;
    var colNames = widgets.schemaTreeView.getTableColumnNames({});
    var idNames = [];
    var attrs = {'type':0, 'nullable':1, 'is_primary_key':1};
    for (var i = 0; i < colNames.length; i++) {
        var cell = {};
        var colName = cell.name = colNames[i];
        for (var attr in attrs) {
            cell[attr] = schemaTreeView.getCellText(i, {id:attr});
            if (attrs[attr] && cell[attr].length > 0) {
                cell[attr] = parseInt(cell[attr]);
            }
            cell.value = '';
        }
        if (cell.is_primary_key) {
            idNames.push(colName);
        }
        cells.push(cell);
    }
    setupAddEditWindow('row_add', cells);
}

function editSelectedRow(idx) {
    var cells = [];
    var schemaTreeView = widgets.schemaTreeView;
    var colNames = widgets.schemaTreeView.getTableColumnNames({});
    var idNames = [];
    var idValues = [];
    var attrs = {'type':0, 'nullable':1, 'is_primary_key':1};
    for (var i = 0; i < colNames.length; i++) {
        var cell = {};
        var colName = cell.name = colNames[i];
        for (var attr in attrs) {
            cell[attr] = schemaTreeView.getCellText(i, {id:attr});
            if (attrs[attr] && cell[attr].length > 0) {
                var res = parseInt(cell[attr]);
                if (!isNaN(res)) {
                    cell[attr] = res;
                }
            }
        }
        if (cell.is_primary_key) {
            idNames.push(colName);
            idValues.push(widgets.dataDumpTreeView.getCellText(idx, {id:colName}));
        }
        cells.push(cell);
    }
    if (idNames.length > 0) {
        var results = {};
        koDBConnection.getRawRow(idNames.length, idNames,
                                 idValues.length, idValues,
                                 {}, results);
        results = results.value;
        for (var i = 0; i < results.length; i++) {
            var cell = cells[i];
            cell.value = results[i];
        }
        setupAddEditWindow('row_edit', cells);
    } else {
        ko.dialogs.alert(_bundle.GetStringFromName("editRowNoKeysFound.message"));
    }
}

function addNewRowBasedOnSelectedRow(idx) {
    var cells = [];
    var schemaTreeView = widgets.schemaTreeView;
    var colNames = widgets.schemaTreeView.getTableColumnNames({});
    var idNames = [];
    var idValues = [];
    var attrs = {'type':0, 'nullable':1, 'is_primary_key':1};
    for (var i = 0; i < colNames.length; i++) {
        var cell = {};
        var colName = cell.name = colNames[i];
        for (var attr in attrs) {
            cell[attr] = schemaTreeView.getCellText(i, {id:attr});
            if (attrs[attr] && cell[attr].length > 0) {
                cell[attr] = parseInt(cell[attr]);
            }
        }
        if (cell.is_primary_key) {
            idNames.push(colName);
            idValues.push(widgets.dataDumpTreeView.getCellText(idx, {id:colName}));
        }
        cells.push(cell);
    }
    var results = {};
    koDBConnection.getRawRow(idNames.length, idNames,
                             idValues.length, idValues,
                             {}, results);
    results = results.value;
    for (var i = 0; i < results.length; i++) {
        var cell = cells[i];
        if (cell.is_primary_key) {
            cell.value = "";
        } else {
            cell.value = results[i];
        }
    }
    setupAddEditWindow('row_add', cells);
}

function deleteSelectedRows(treeColsId, rowString) {
    var ids = _getRowIds(treeColsId);
    var rowNums = [];
    var rowParts = rowString.split(',');
    for (var i = 0; i < rowParts.length; ++i) {
        var thisRowParts = rowParts[i].split("-");
        for (var rowNum = thisRowParts[0]; rowNum <= thisRowParts[1]; rowNum++) {
            rowNums.push(parseInt(rowNum));
        }
    }
    if (rowNums.length == 0) {
        ko.dialogs.alert("Internal error -- can't parse [" + rowString + "]");
        return;
    }
    var prefs = Components.classes["@activestate.com/koPrefService;1"].
                getService(Components.interfaces.koIPrefService).prefs;
    if (!prefs.hasPref("dbexplorer_confirm_deletions")
         || prefs.getBooleanPref("dbexplorer_confirm_deletions")) {
        var prompt = (rowNums.length == 1
                      ? "Are you sure you want to delete this row?"
                      : ("Are you sure you want to delete these "
                         + rowNums.length
                         + " rows?"));
        var res = ko.dialogs.yesNo(prompt,
                                   "No", // response
                                   "Deleting data can't be undone", // text
                                   "Last chance before deletion", // title
                                   undefined);
        //TODO: Add a pref dbexplorer_delete_yes_no, set to "No"
        //TODO: Add a pref to manage pref "dbexplorer_delete_yes_no"
        if (res != "Yes") {
            return;
        }
    }
    var errorString;
    try {
        errorString = koDBConnection.deleteRows(widgets.dataDumpTreeView, rowNums.length, rowNums);
    } catch(ex) {
        errorString = ex.message;
    }
    if (errorString) {
        ko.dialogs.alert("Error trying to delete row(s) " + rowString,
                         errorString,
                         "Row deletion failed");
    } else {
        _repaintCurrentView();
    }
}

function selectAllRows(selectedTreeViewName) {
    widgets[selectedTreeViewName].selection.selectAll();
}

////////////////////////////////////////////////////////////////
// Methods for handling the query tab

function doSelectTab(event) {
    if (!('tabs' in widgets)) {
        //dump("widgets.tabs not set yet\n");
        return;
    }
    if (widgets.tabs.selectedIndex == TABLE_DUMP_INDEX) {
        _refreshTableDump();
    } else if (widgets.tabs.selectedIndex == TABLE_QUERY_INDEX) {
        //TODO: refresh if they did a delete/insert/update in dump mode.
        _refreshCustomView();
    } else if (widgets.tabs.selectedIndex == TABLE_SCHEMA_INDEX) {
        // Nothing to do.
    } else {
        dump("tableDisplay.js:doSelectTab - unexpected index of "
             + widgets.tabs.selectedIndex
             + "\n");
    }
}

function _refreshTableDump() {
    _repaintCurrentView();
}

function _refreshCustomView() {
    var boxObject = 
        widgets.queryTree.treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    var firstRow = boxObject.getFirstVisibleRow();
    var lastRow = boxObject.getLastVisibleRow();
    boxObject.beginUpdateBatch();
    boxObject.invalidateRange(firstRow, lastRow);
    boxObject.endUpdateBatch();
}

var tableName_ptn = new RegExp('\\bfrom\\s+' + tableName + '\\b', 'i');
var where_ptn = new RegExp('^(.+\\s+)(where\\s+.+)$', 'i');

function runCustomAction() {
    var query = document.getElementById("panelQueryText").value;
    try {
        if (/^\s*select\b/i.test(query)) {
            if (!tableName_ptn.test(query)) {
                var from_part = " FROM " + tableName + " ";
                var res = where_ptn.exec(query);
                if (res) {
                    query = res[1] + from_part + res[2];
                } else {
                    query += from_part;
                }
            }
            widgets.queryTreeView.runCustomQuery(query);
            var column_names = widgets.queryTreeView.getTableColumnNames({});
            _setTreeColumnLabels(widgets.queryTree, column_names, [], []);
            if (g_queryTreeNeedsBoxObject) {
                updateQueryDataTree();
            }
            _refreshCustomView();
        } else {
            var oldRowCount = widgets.queryTreeView.rowCount;
            var res = widgets.queryTreeView.executeCustomAction(query);
            if (res) {
                var boxObject = 
                    widgets.queryTree.treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
                var newRowCount = widgets.queryTreeView.rowCount;
                boxObject.beginUpdateBatch();
                if (oldRowCount != newRowCount) {
                    boxObject.rowCountChanged(0, newRowCount - oldRowCount);
                }
                boxObject.invalidate();
                boxObject.endUpdateBatch();
            }
        }
    } catch(ex) {
        alert("Problems running custom action: " + ex);
    }
}

function refreshQueryTable() {
    try {
        widgets.queryTreeView.refreshView();
    } catch(ex) {
        alert("Problems in refreshQueryTable: " + ex);
    }
}

/**
 * initDataTreeColumnPopupMenu - Allow ints to be displayed as a JS date,
 * allow real's to be displayed as a sqlite timestamp
 */
function initDataTreeColumnPopupMenu(event) {
    var menupopup = event.target;
    var treecol = event.explicitOriginalTarget;
    var id = treecol.getAttribute('id');
    while (menupopup.firstChild) {
        menupopup.removeChild(menupopup.firstChild);
    }
    var colNames = widgets.schemaTreeView.getTableColumnNames({});
    var idx = colNames.indexOf(id);
    var menuitem;
    var className, converter;
    var currentConverterClassName = koDBConnection.getConverterClassName(id);
    //TODO: Store which items are checked in a pref.
    if (idx == -1) {
        menuitem = document.createElement('menuitem');
        menuitem.setAttribute('label', "id: " + id + ", Not found");
        menupopup.appendChild(menuitem);
    } else {
        var haveSomething = false;
        for (var i = 0; i < converters.length; i++) {
            [className, converter] = converters[i];
            if ((converter.supportedType == 'integer'
                 && widgets.schemaTreeView.columnTypeIsInteger(idx))
                || (converter.supportedType == 'float'
                    && widgets.schemaTreeView.columnTypeIsReal(idx))) {
                menuitem = document.createElement('menuitem');
                menuitem.setAttribute('type', 'radio');
                menuitem.setAttribute('name', 'converter');
                menuitem.setAttribute('class', 'menuitem-iconic');
                menuitem.setAttribute('label',
                                      "View " + id + " " + converter.label);
                if (currentConverterClassName == className) {
                    menuitem.setAttribute('checked', 'true');
                }
                menuitem.setAttribute("oncommand",
                                      "setConverter('" + id + "', " + i + ")");
                menupopup.appendChild(menuitem);
                haveSomething = true;
            }
        }
        if (haveSomething) {
            menuitem = document.createElement('menuitem');
            menuitem.setAttribute('type', 'radio');
            menuitem.setAttribute('name', 'converter');
            menuitem.setAttribute('class', 'menuitem-iconic');
            if (!currentConverterClassName) {
                menuitem.setAttribute('checked', 'true');
            }
            menuitem.setAttribute('label',
                                  "No conversion");
            menuitem.setAttribute("oncommand",
                                  "removeConverter('" + id + "')");
            menupopup.appendChild(menuitem);
        } else {
            menuitem = document.createElement('menuitem');
            menuitem.setAttribute('type', 'radio');
            menuitem.setAttribute('name', 'converter');
            menuitem.setAttribute('class', 'menuitem-iconic');
            menuitem.setAttribute('disabled', 'true');
            menuitem.setAttribute('label',
                                  "Nothing applicable");
            menupopup.appendChild(menuitem);
        }
    }
    event.stopPropagation();
}

function _repaintCurrentView() {
    widgets.dataDumpTreeView.refreshTable();
    var boxObject = 
        widgets.dataDumpTree.treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    var firstRow = boxObject.getFirstVisibleRow();
    var lastRow = boxObject.getLastVisibleRow();
    boxObject.beginUpdateBatch();
    boxObject.invalidateRange(firstRow, lastRow);
    boxObject.endUpdateBatch();
    updateRowCountLabel();
}

function removeConverter(id) {
    koDBConnection.removeConverter(id);
    _repaintCurrentView();
}

function setConverter(id, converterIdx) {
    koDBConnection.setConverter(id, converters[converterIdx][0], converters[converterIdx][1]);
    _repaintCurrentView();
}

function initContextMenu(event) {
    var menupopup = document.getElementById("dbx-tableDisplay-popup");
    while (menupopup.firstChild) {
        menupopup.removeChild(menupopup.firstChild);
    }
    var isQuery = event.explicitOriginalTarget.id == "dbx-tableDisplay-query-treechildren";
    var row = {}, col = {}, childElt = {};
    var selectedTreeName;
    var selectedTreeViewName;
    var treeColsId;
    if (isQuery) {
        selectedTreeName = "queryTree";
        selectedTreeViewName = "queryTreeView";
        treeColsId = "dbx-tableDisplay-queryDataTreeCols";
    } else {
        selectedTreeName = "dataDumpTree";
        selectedTreeViewName = "dataDumpTreeView";
        treeColsId = "dbx-tableDisplay-dataTreeCols";
    }
    widgets[selectedTreeName].treeBoxObject.getCellAt(event.clientX, event.clientY,
                                             row, col, childElt);
    var menuitem;
    
    menuitem = document.createElement('menuitem');
    menuitem.setAttribute('label', _bundle.GetStringFromName("copyCell.menuLabel"));
    menuitem.setAttribute("accesskey", _bundle.GetStringFromName("copyCell.accessKey"));
    menuitem.setAttribute("oncommand",
                          ("copyCellContents('"
                           + selectedTreeViewName
                           + "', "
                           + row.value
                           + ", '"
                           + col.value.id
                           + "')"));
    menupopup.appendChild(menuitem);
    
    menuitem = document.createElement('menuitem');
    menuitem.setAttribute('label', _bundle.GetStringFromName("copyRow.menuLabel"));
    menuitem.setAttribute("accesskey", _bundle.GetStringFromName("copyRow.accessKey"));
    menuitem.setAttribute("oncommand",
                          ("copyRowContents('"
                           + selectedTreeViewName
                           + "', '"
                           + treeColsId
                           + "', '"
                           + row.value
                           + "')"));
    menupopup.appendChild(menuitem);
    
    // Is there a multi-row selection?
    var sel = widgets[selectedTreeViewName].selection;
    if (!sel.single) {
        var numRanges = sel.getRangeCount();
        var ranges = [];
        var min = {}, max = {};
        for (var i = 0; i < numRanges; i++) {
            sel.getRangeAt(i, min, max);
            ranges.push(min.value + "-" + max.value);
        }
        var disabled = (numRanges == 1 && min.value == max.value);
        var rangeStr = ranges.join(",");
        menuitem = document.createElement('menuitem');
        menuitem.setAttribute('label', _bundle.GetStringFromName("copySelectedRows.menuLabel"));
        menuitem.setAttribute("accesskey", _bundle.GetStringFromName("copySelectedRows.accessKey"));
        if (disabled) {
            menuitem.setAttribute('disabled', 'true');
        } else {
            menuitem.setAttribute("oncommand",
                                  ("copySelectedRows('"
                                   + selectedTreeViewName
                                   + "', '"
                                   + treeColsId
                                   + "', '"
                                   + rangeStr
                                   + "')"));
        }
        menupopup.appendChild(menuitem);
    }
    
    menuitem = document.createElement('menuseparator');
    menupopup.appendChild(menuitem);

    menuitem = document.createElement('menuitem');
    menuitem.setAttribute('label', _bundle.GetStringFromName("editSelectedRow.menuLabel"));
    menuitem.setAttribute("accesskey", menuitem.getAttribute("label")[0]);
    if (isQuery || sel.count != 1) {
        menuitem.setAttribute('disabled', 'true');
    } else {
        // Most of the time a query view doesn't have enough fields
        // to allow for a meaningful edit.
        menuitem.setAttribute("oncommand",
                              "editSelectedRow('" + sel.currentIndex + "')");
    }
    menupopup.appendChild(menuitem);
    
    menuitem = document.createElement('menuitem');
    menuitem.setAttribute('label', "Copy and add as new row"); //_bundle.GetStringFromName("editSelectedRow.menuLabel"));
    menuitem.setAttribute("accesskey", menuitem.getAttribute("label")[0]);
    if (isQuery || sel.count != 1) {
        // Most of the time a query view doesn't have enough fields
        // to allow for a meaningful edit.
        menuitem.setAttribute('disabled', 'true');
    } else {
        menuitem.setAttribute("oncommand",
                              "addNewRowBasedOnSelectedRow('" + sel.currentIndex + "')");
    }
    menupopup.appendChild(menuitem);

    menuitem = document.createElement('menuseparator');
    menupopup.appendChild(menuitem);
    
    menuitem = document.createElement('menuitem');
    menuitem.setAttribute('label', _bundle.GetStringFromName("deleteSelectedRows.menuLabel"));
    menuitem.setAttribute("accesskey", menuitem.getAttribute("label")[0]);
    if (!gAllowRowDeletion || isQuery) {
        menuitem.setAttribute('disabled', 'true');
    } else {
        menuitem.setAttribute("oncommand",
                              "deleteSelectedRows('" + treeColsId + "', '" + rangeStr + "')");
    }
    menupopup.appendChild(menuitem);

    menuitem = document.createElement('menuitem');
    menuitem.setAttribute('label', _bundle.GetStringFromName("selectAll.menuLabel"));
    menuitem.setAttribute("accesskey", menuitem.getAttribute("label")[0]);
    menuitem.setAttribute("oncommand",
                          "selectAllRows('" + selectedTreeViewName + "');");
    menupopup.appendChild(menuitem);
}

function updateRowCountLabel() {
    var rc = widgets.dataDumpTreeView.rowCount;
    var templateName = rc != 1 ? "numRowsPlural" : "numRowsSingular";
    widgets.tableDisplay_rowCountLabel.value =  _bundle.formatStringFromName(templateName, [rc], 1);
}

function updateRowDeletionStatus(allowDeletionButton) {
    gAllowRowDeletion = allowDeletionButton.checked;
}

function updateSortIndicators(treecols, col_id) {
    var sortDir, newTreecol = treecols.getElementsByAttribute("id", col_id);
    if (!newTreecol.length) {
        log.error("Hey! Can't get a treecol for ID " + col_id);
        return 0;
    }
    newTreecol = newTreecol[0];
    if (gCurrentSortedColumnId != col_id) {
        var oldTreecol = treecols.getElementsByAttribute("id", gCurrentSortedColumnId);
        if (oldTreecol.length && oldTreecol[0]) {
            oldTreecol[0].removeAttribute("sortDirection");
        }
        newTreecol.setAttribute("sortDirection", "ascending");
        gCurrentSortedColumnId = col_id;
        sortDir = 1;
    } else {
        var sortDirection = newTreecol.getAttribute("sortDirection");
        if (!sortDirection) {
            sortDir = 1;
            newTreecol.setAttribute("sortDirection", "ascending");
        } else if (sortDirection == "ascending") {
            sortDir = -1;
            newTreecol.setAttribute("sortDirection", "descending");
        } else {
            sortDir = 0;
            newTreecol.removeAttribute("sortDirection");
        }
    }
    return sortDir;
}
