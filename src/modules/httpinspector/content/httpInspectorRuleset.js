/* Copyright (c) 2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/*
 * httpInspectorRuleset - HTTP proxy debugging.
 *
 * Contributers:
 *  - ToddW
 */


//----------------------------
//          globals         //
//----------------------------
xtk.include("treeview");

Components.utils.import("resource://gre/modules/Services.jsm");

var HIRuleset_log = ko.logging.getLogger("httpInspectorRuleset");
//_httpInspectorRuleset.setLevel(ko.logging.LOG_DEBUG);
var HIRuleset = null;
var HIRulesetModified = false;

//----------------------------
//     internal routines    //
//----------------------------

function _httpInspectorRulesetTreeView(initial_rows) {
    this._rows = initial_rows;
    this._debug = 0;
    this._atomService = Components.classes["@mozilla.org/atom-service;1"].
                            getService(Components.interfaces.nsIAtomService);

    // Mozilla 22 changed the way tree properties work.
    if ((parseInt(Services.appinfo.platformVersion)) < 22) {
        this.getCellProperties = this.getCellPropertiesMoz21AndOlder;
    }
}
//// The following two lines ensure proper inheritance (see Flanagan, p. 144).
_httpInspectorRulesetTreeView.prototype = new xtk.dataTreeView();
_httpInspectorRulesetTreeView.prototype.constructor = _httpInspectorRulesetTreeView;

var _httpInspectorRule_flag_names = [
    "Request Modified",     // 1
    "Response Modified",    // 2
    "Break on Request",     // 4
    "Break on Response",    // 8
    "Modify",               // 16
    "Add Latency",          // 32
];

_httpInspectorRulesetTreeView.prototype.getCellText = function(row, column) {
    // forRow is a koIHttpInspectorRule XPCOM object
    var forRow = this._rows[row];
    switch (column.id) {
        //case 'httpInspectorRuleset_treecol_flags':
        //    var i = 0;
        //    var flags = forRow.flags;
        //    var s = [];
        //    while (i < flags) {
        //        if (flags & (1 << i)) {
        //            s.push(_httpInspectorRule_flag_names[i]);
        //        }
        //        i += 1;
        //    }
        //    return s.join(", ");
        case 'httpInspectorRuleset_treecol_name':
            return forRow.name;
        case 'httpInspectorRuleset_treecol_type':
            switch (forRow.type) {
                case Components.interfaces.koIHttpInspectorRule.TYPE_REQUEST:
                    return "Request";
                case Components.interfaces.koIHttpInspectorRule.TYPE_RESPONSE:
                    return "Response";
                case Components.interfaces.koIHttpInspectorRule.TYPE_REQUEST_RESPONSE:
                    return "Both";
                default:
                    return "Unknown type";
            }
        case 'httpInspectorRuleset_treecol_description':
            return forRow.getRuleText();
        case 'httpInspectorRuleset_treecol_enabled':
            return forRow.enabled;
    }
    return "(Unknown column: " + column.id + ")";
};

_httpInspectorRulesetTreeView.prototype.cycleCell = function(row, column) {
    //dump("Cycle cell: row: " + row + ", column: " + column.id + "\n");
    switch (column.id) {
        case 'httpInspectorRuleset_treecol_enabled':
            this._rows[row].enabled = !this._rows[row].enabled;
            HIRulesetModified = true;
            this.tree.invalidateRow(row);
            break;
    }
};

_httpInspectorRulesetTreeView.prototype.getCellProperties = function(row, column ) {
    switch (column.id) {
        case 'httpInspectorRuleset_treecol_enabled':
            // This should be a checkbox field
            if (this._rows[row].enabled) {
                return "Enabled-true";
            }
            break;
    }
};

_httpInspectorRulesetTreeView.prototype.getCellPropertiesMoz21AndOlder = function(row, column, props) {
    switch (column.id) {
        case 'httpInspectorRuleset_treecol_enabled':
            // This should be a checkbox field
            if (this._rows[row].enabled) {
                props.AppendElement(this._atomService.getAtom("Enabled-true"));
            }
            break;
    }
};

function _HIRuleset(koHttpInspectorSvc)
{
    try {
        this.koHttpInspectorSvc = koHttpInspectorSvc;

        // Get a handle on the needed xul elements
        this.tree = document.getElementById("httpInspectorRuleset_mainTree");

        // Get the working ruleset
        var rulesetCount = new Object();
        this.ruleset = this.koHttpInspectorSvc.getRuleset(rulesetCount);
        //dump("rulesetCount: " + rulesetCount + "\n");
        //dump("Ruleset: " + this.ruleset + "\n");

        // Setup the tree
        this.treeView = new _httpInspectorRulesetTreeView(this.ruleset);
        this.tree.treeBoxObject.view = this.treeView;
    } catch (e) {
        HIRuleset_log.exception(e);
    }
}

_HIRuleset.prototype._saveRuleset = function ()
{
    try {
        this.koHttpInspectorSvc.setRuleset(this.ruleset.length, this.ruleset);
        HIRulesetModified = false;
        this.treeView.setTreeRows(this.ruleset);
        this.tree.treeBoxObject.beginUpdateBatch();
        this.tree.treeBoxObject.invalidate();
        this.tree.treeBoxObject.endUpdateBatch();
    } catch (e) {
        HIRuleset_log.exception(e);
    }
}

_HIRuleset.prototype.newRule = function ()
{
    try {
        // Create an empty rule
        var koRule = Components.classes["@activestate.com/koHttpInspectorRule;1"].
                        createInstance(Components.interfaces.koIHttpInspectorRule);
        koRule.enabled = true;
        var args = new Object();
        args.rule = koRule;
        args.returnValue = Components.interfaces.nsIFilePicker.returnCancel;
        // Pass in arguments
        window.openDialog("chrome://httpinspector/content/httpInspectorRuleDialog.xul",
                          "Komodo:HTTPInspectorRule",
                          "chrome,resizable=yes,accept=yes,close=yes,dependent=yes,modal=yes",
                          args);
        if (args.returnValue == Components.interfaces.nsIFilePicker.returnOK) {
            this.ruleset.push(args.rule);
            this._saveRuleset();
        }
    } catch (e) {
        HIRuleset_log.exception(e);
    }
}

_HIRuleset.prototype.editRule = function ()
{
    try {
        // Get the selected tree row and grab the selected rule
        if (this.tree.currentIndex >= 0 && this.tree.currentIndex < this.ruleset.length) {
            var args = new Object();
            args.rule = this.ruleset[this.tree.currentIndex];
            // Pass in arguments
            window.openDialog("chrome://httpinspector/content/httpInspectorRuleDialog.xul",
                              "Komodo:HTTPInspectorRule",
                              "chrome,resizable=yes,dialog=yes,accept=yes,close=yes,dependent=yes,modal=yes",
                              args);
            this.koHttpInspectorSvc.setRuleset(this.ruleset.length, this.ruleset);
            this._saveRuleset();
        }
    } catch (e) {
        HIRuleset_log.exception(e);
    }
}

_HIRuleset.prototype.deleteRule = function ()
{
    try {
        // Get the selected tree row and grab the selected rule
        if (this.tree.currentIndex >= 0 && this.tree.currentIndex < this.ruleset.length) {
            this.ruleset.splice(this.tree.currentIndex, 1);
            this._saveRuleset();
        }
    } catch (e) {
        HIRuleset_log.exception(e);
    }
}

_HIRuleset.prototype.moveRuleUp = function ()
{
    try {
        // Get the selected tree row and grab the selected rule
        var rowNumber = this.tree.currentIndex;
        if (rowNumber > 0 && rowNumber < this.ruleset.length) {
            var rule = this.ruleset[rowNumber];
            this.ruleset.splice(rowNumber, 1);           // Remove rule
            this.ruleset.splice(rowNumber - 1, 0, rule); // Add before
            this._saveRuleset();
            this.treeView.selection.select(rowNumber - 1);
        }
    } catch (e) {
        HIRuleset_log.exception(e);
    }
}

_HIRuleset.prototype.moveRuleDown = function ()
{
    try {
        // Get the selected tree row and grab the selected rule
        var rowNumber = this.tree.currentIndex;
        if (rowNumber >= 0 && rowNumber < (this.ruleset.length - 1)) {
            var rule = this.ruleset[rowNumber];
            this.ruleset.splice(rowNumber, 1);         // Remove rule
            this.ruleset.splice(rowNumber+1, 0, rule); // Add afterwards
            this._saveRuleset();
            this.treeView.selection.select(rowNumber + 1);
        }
    } catch (e) {
        HIRuleset_log.exception(e);
    }
}


//----------------------------
//      public routines     //
//----------------------------

function httpInspectorRuleset_onLoad() {
    try {
        // .koHttpInspectorSvc
        if (!window.arguments[0].koHttpInspectorSvc) {
            ko.dialogs.alert("httpInspectorRuleset window not initialized properly");
            window.close();
            return;
        }
        HIRuleset = new _HIRuleset(window.arguments[0].koHttpInspectorSvc);
    } catch (e) {
        HIRuleset_log.exception(e);
    }
}

function httpInspectorRuleset_onUnload() {
    try {
        if (HIRulesetModified) {
            HIRuleset._saveRuleset();
        }
    } catch (e) {
        HIRuleset_log.exception(e);
    }
}

function httpInspectorRuleset_newRule() {
    HIRuleset.newRule();
}

function httpInspectorRuleset_editRule() {
    HIRuleset.editRule();
}

function httpInspectorRuleset_deleteRule() {
    HIRuleset.deleteRule();
}

function httpInspectorRuleset_moveRuleUp() {
    HIRuleset.moveRuleUp();
}

function httpInspectorRuleset_moveRuleDown() {
    HIRuleset.moveRuleDown();
}
