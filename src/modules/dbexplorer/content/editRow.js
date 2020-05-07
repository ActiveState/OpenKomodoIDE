/* Copyright (c) 2003-2009 ActiveState Software Inc.
See the file LICENSE.txt for licensing information. */

var mainObj;
var origCells;
var isEditWindow;
function onLoad() {
    isEditWindow = window.name == 'row_edit';
    mainObj = window.arguments[0];
    initialize();
}

// Localization.
var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                .getService(Components.interfaces.nsIStringBundleService)
                .createBundle("chrome://dbexplorer/locale/dbexplorer.properties");

/**
 * Type of a cell:
 * type
 * nullable
 * is_primary_key
 * name
 * value
 */
function initialize() {
    var titleBundleName = isEditWindow ? "editingTable.template" : "addTable.template";
    window.document.title = _bundle.formatStringFromName(titleBundleName,
                                                         [mainObj.tableName], 1);
    var grid = document.getElementById("edit-row-rows");
    var cells = mainObj.cells;
    origCells = cells.concat(); // JS for 'clone'
    var cell; // {}
    for (var i in cells) {
        cell = cells[i];
        var newRow = document.createElement('row');
        var label = document.createElement('label');
        label.setAttribute('value', cell.name + " (" + cell.type + "):");
        label.setAttribute('flex', 1);
        newRow.appendChild(label);
        var textbox = document.createElement('textbox');
        textbox.setAttribute('name', cell.name);
        var value = cell.value;
        textbox.setAttribute('value', value);
        if (isStringType(cell.type)) {
            textbox.setAttribute('multiline', true);
            textbox.setAttribute('wrap', true);
            var numRows;
            if (value.indexOf("\n") == -1) {
                numRows = 4;
            } else {
                numRows = value.split(/\n/);
                if (numRows > 4) {
                    numRows = 4;
                }
            }
            textbox.setAttribute('rows', numRows);
        }
        textbox.setAttribute('flex', 4);
        if (isEditWindow && cell.is_primary_key) {
            textbox.setAttribute('disabled', true);
        } else if (mainObj.dbSchemaTreeView.columnTypeIsBlob(i)) {
            textbox.setAttribute('disabled', true);
        }
        newRow.appendChild(textbox);
        grid.appendChild(newRow);
    }
}

var stringTypeNames_lc = ['text', 'string'];
function isStringType(typeName) {
    var typeName_lc = typeName.toLowerCase();
    if (stringTypeNames_lc.indexOf(typeName_lc) >= 0) {
        return true;
    } else if (stringTypeNames_lc.indexOf('varchar') == 0) {
        return true;
    }
    return false;
}

function convertNameValuePair(item) {
    var q = isStringType(item.type) ? "'" : '';
    return (item.name
            + " = "
            + q
            + item.value
            + q);
}

function convertAndJoin(list, separator) {
    var newItems = [];
    for (var i = 0; i < list.length; i++) {
        newItems.push(convertNameValuePair(list[i]));
    }
    return newItems.join(separator);
}

function quoteNamesAndJoin(list, separator) {
    var newItems = [];
    var isName = /^\w+$/;
    for (var i = 0; i < list.length; i++) {
        var name = list[i].name;
        var q = isName.test(name) ? "" : "'";
        newItems.push(q + name + q);
    }
    return newItems.join(separator);
}

function quoteValuesAndJoin(list, separator) {
    var newItems = [];
    for (var i = 0; i < list.length; i++) {
        var item = list[i];
        var value = item.value.toString();
        var q = (isStringType(item.type) || value.length == 0) ? "'" : '';
        newItems.push(q + list[i].value + q);
    }
    return newItems.join(separator);
}

function OK() {
    if (isEditWindow) {
        return OK_edit();
    } else {
        return OK_add();
    }
}

function OK_edit() {
    var grid = document.getElementById("edit-row-rows");
    var rows = grid.childNodes;
    var newCells = [];
    var idCells = [];
    var row, textbox, origCell, haveAChange = false;
    for (var i = 0; i < rows.length; i++) {
        textbox = rows[i].childNodes[1];
        origCell = origCells[i];
        var newValue = textbox.value; // textbox.getAttribute('value') returns the old value!
        if (newValue != origCell.value) {
            newCells.push({name: origCell.name, value:newValue, type:origCell.type});
            haveAChange = true;
        } else if (origCell.is_primary_key) {
            idCells.push({name: origCell.name, value:origCell.value, type:origCell.type})
        }
    }
    if (!haveAChange) {
        mainObj.res = false;
        return true;
    }
    var prompt = _bundle.GetStringFromName("editingTableConfirmChanges.prompt");
    var no_str = _bundle.GetStringFromName("No");
    var yes_str = _bundle.GetStringFromName("Yes");
    var response = no_str;
    // No localization needed for this string -- it's SQL
    var text = ("UPDATE '"
               + mainObj.tableName
               + "' SET "
               + convertAndJoin(newCells, ", ")
               + " WHERE "
               + convertAndJoin(idCells, " AND "));
    var title = _bundle.GetStringFromName("editingTableConfirmChanges.title");
    var res = ko.dialogs.yesNoCancel(prompt, response, text, title);
    if (res == yes_str) {
        mainObj.res = updateRow(newCells, idCells);
        return true;
    } else if (res == no_str) {
        return false;
    } else {
        mainObj.res = false;
        return true;
    }
}

function OK_add() {
    var grid = document.getElementById("edit-row-rows");
    var rows = grid.childNodes;
    var newCells = [];
    var row, textbox, origCell, haveAChange = false;
    for (var i = 0; i < rows.length; i++) {
        textbox = rows[i].childNodes[1];
        origCell = origCells[i];
        // textbox.getAttribute('value') returns the old value!
        var value = textbox.value;
        if (value.length == 0 && origCell.value.length == 0) {
            // Ignore empty cells
        } else if (mainObj.dbSchemaTreeView.columnTypeIsBlob(i)) {
            // Skip
        } else {
            newCells.push({name: origCell.name, value:textbox.value, type:origCell.type});
        }
    }
    var prompt = _bundle.GetStringFromName("addTableConfirmChanges.prompt");
    var no_str = _bundle.GetStringFromName("No");
    var yes_str = _bundle.GetStringFromName("Yes");
    var response = no_str;
    // No localization needed for this string -- it's SQL
    var text = ("INSERT INTO '"
               + mainObj.tableName
               + "' ("
               + quoteNamesAndJoin(newCells, ", ")
               + ") VALUES ("
               + quoteValuesAndJoin(newCells, ", ")
               + ")");
    var title = _bundle.GetStringFromName("addTableConfirmChanges.title");
    var res = ko.dialogs.yesNoCancel(prompt, response, text, title);
    if (res == yes_str) {
        mainObj.res = addRow(newCells);
        return true;
    } else if (res == no_str) {
        return false;
    } else {
        mainObj.res = false;
        return true;
    }
}

function updateRow(newCells, idCells) {
    var targetNames = [];
    var targetValues = [];
    var keyNames = [];
    var keyValues = [];
    var cell;
    var i;
    for (i = 0; i < newCells.length; i++) {
        cell = newCells[i];
        targetNames.push(cell.name);
        targetValues.push(cell.value);
    }
    for (i = 0; i < idCells.length; i++) {
        cell = idCells[i];
        keyNames.push(cell.name);
        keyValues.push(cell.value);
    }
    var res;
    try {
        res = mainObj.dbConnection.updateRow(targetNames.length, targetNames,
                                             targetValues.length, targetValues,
                                             keyNames.length,  keyNames,
                                             keyValues.length, keyValues);
    } catch(ex) {
        alert("Update row failed: " + ex);
        res = false;
    }
    return res;
}

function addRow(newCells) {
    var targetNames = [];
    var targetValues = [];
    var cell;
    var i;
    for (i = 0; i < newCells.length; i++) {
        cell = newCells[i];
        targetNames.push(cell.name);
        targetValues.push(cell.value);
    }
    var res;
    try {
        res = mainObj.dbConnection.addRow(targetNames.length, targetNames,
                                          targetValues.length, targetValues);
    } catch(ex) {
        alert("Update row failed: " + ex);
        res = false;
    }
    return res;
}

function Cancel() {
    return true;
}
