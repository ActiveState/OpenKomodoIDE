/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */
xtk.include("treeview");

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var variableTreeViewLog = ko.logging.getLogger("variableTreeView");
//variableTreeViewLog.setLevel(ko.logging.LOG_DEBUG);
var vtvSortLog = ko.logging.getLogger("variableTreeView.sort");
//vtvSortLog.setLevel(ko.logging.LOG_DEBUG);

const NextPageLabel = "...Next Page...";
const NextPageLabel_LC = NextPageLabel.toLowerCase();

// Globals
function variableTreeView(dbgTabManager, context) {
    xtk.baseTreeView.apply(this, []);
    this.mSingleSelect = true;
    this.mVariableList = []; // see makeVariable for properties
    this.context = context;
    this.debug=0;
    this.dbgTabManager = dbgTabManager;
    this._escapableWhiteSpaceRegex = /[\r\n\t]/;
    this.updateAskedForHex();
    var prefObserverService = ko.prefs.prefObserverService;
    prefObserverService.addObserverForTopics(this, 1,
                                             ["debuggerPreferHex"], false);

    // Mozilla 22 changed the way tree properties work.
    if ((parseInt(Services.appinfo.platformVersion)) < 22) {
        this.getCellProperties = this.getCellPropertiesMoz21AndOlder;
    }
}

// The following two lines ensure proper inheritance (see Flanagan, p. 144).
variableTreeView.prototype = new xtk.baseTreeView();
variableTreeView.prototype.constructor = variableTreeView;

variableTreeView.prototype.setContext = function(context) {
    this.context = context;
}

/* void selectionChanged(); */
variableTreeView.prototype.selectionChanged = function() {
    window.setTimeout("window.updateCommands('debugvartab_selection_changed');",1);
}

variableTreeView.prototype.haveVariable = function(expression) {
    variableTreeViewLog.debug('haveVariable '+expression);
    try {
        return this.dbgTabManager.haveWatchedVar(expression);
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    return false;
}

variableTreeView.prototype.addVariable = function(expression, value) {
    variableTreeViewLog.debug('addVariable '+expression+' = '+value);
    // unable to set the value, so we add a new value
    try {
        this.dbgTabManager.addWatchedVar(expression, value);
        return true;
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    return false;
}

variableTreeView.prototype.setVariable = function(index, expression, value, dataType) {
    variableTreeViewLog.debug('setVariable '+expression+' = '+value);
    if (!this.dbgTabManager.session) return false;
    var state = this.dbgTabManager.session.getState();
    if (state != ko.dbg.manager.STATE_BREAK && state != ko.dbg.manager.STATE_INTERACTIVE) return false;

    var ret = false;
    try {
        //this.dbgTabManager.valueChanged(this.context, expression, value);
        var variable = this.mVariableList[index];
        if (!variable) return ret;
        if (variable.fullname != expression) {
            // they've changed the name on us, add a new variable
            this.addVariable(expression,value);
        }

        var exceptionText = null;
        try {
            if (typeof(dataType) == 'undefined') {
                dataType = null;
            }
            variable.debugprop.setValue(value, dataType);//, got_error);
        } catch (e) {
            var lastErrorSvc = Components.classes["@activestate.com/koLastErrorService;1"].
                                getService(Components.interfaces.koILastErrorService);
            exceptionText = lastErrorSvc.getLastErrorMessage();
            if (!exceptionText)
                exceptionText = "unexpected error setting value";
        }
        // force the outliner to get new values
        delete variable.value;
        delete variable.type;
        this.mTree.invalidateRow(index);
        if (exceptionText) {
            ko.dialogs.alert("Error setting value: " + exceptionText);
        } else {
            ret = true;
        }
        this.dbgTabManager.updateWatchedVars();
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    return ret;
}

variableTreeView.prototype.getSelectedVariables = function() {
    variableTreeViewLog.debug('getSelectedVariables');
    var selected = [];
    try {
        var i, min = {}, max = {};
        for (var i = 0; i < this.selection.getRangeCount(); ++i) {
            this.selection.getRangeAt(i, min, max);
            if (min.value < 0 && max.value < 0) {
                // invalid selection?
                continue;
            }
            for (var index = min.value; index <= max.value; ++index) {
                selected.push(this.mVariableList[index]);
            }
        }
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    return selected;
}

variableTreeView.prototype.removeSelectedVariables = function() {
    variableTreeViewLog.debug('removeSelectedVariables');
    try {
        var variables = this.getSelectedVariables();
        for (var index = 0; index < variables.length; ++index) {
            var variable = variables[index];
            if (variable.level == 0) {
                if (!this.dbgTabManager.removeWatchedVarName(variable.fullname)) {
                    this.dbgTabManager.removeWatchedVarName(variable.name)
                }
            }
        }
        this.dbgTabManager.updateWatchedVars();
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
}

variableTreeView.prototype.removeVariable = function(index) {
    variableTreeViewLog.debug('removeVariable');
    try {
        // we can only remove watched variables, so assume that is what we want to do
        if (this.mVariableList[index].level == 0) {
            this.dbgTabManager.removeWatchedVarName(this.mVariableList[index].fullname);
        }
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
}

variableTreeView.prototype.getName = function(index) {
    if (index < 0) return null;
    variableTreeViewLog.debug('getName '+index);
    try {
        if (index < this.mVariableList.length) {
            var variable = this.mVariableList[index];
            if (!variable.fullname) {
                variable.fullname = variable.debugprop.fullname;
            }
            return variable.fullname;
        }
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    return null;
}

variableTreeView.prototype.getVariable = function(index) {
    if (index < 0) return null;
    variableTreeViewLog.debug('getVariable '+index);
    try {
        if (index < this.mVariableList.length) {
            var variable = this.mVariableList[index];
            if (!variable.value && variable.debugprop) {
                variable.value = variable.debugprop.value;
            }
            return variable;
        }
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    return null;
}

variableTreeView.prototype.getValue = function(index) {
    if (index < 0) return null;
    variableTreeViewLog.debug('getValue '+index);
    try {
        if (index < this.mVariableList.length) {
            var variable = this.mVariableList[index];
            if (!variable.value && variable.debugprop) {
                variable.value = variable.debugprop.value;
            }
            return variable.value;
        }
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    return null;
}

variableTreeView.prototype.rowCountChanged = function(start, newsize) {
    if (this.mTree) {
        this.mTree.beginUpdateBatch();
        this.mTree.rowCountChanged(start, newsize);
        this.mTree.endUpdateBatch();
        this.mTree.invalidate();
    }
}
/*
 * Store sort prefs
 * as debuggerSortDirections|languageName|contextName
 *
 * since sorting is more important for some languages (i.e. PHP)
 */

variableTreeView.prototype.setupInitialSortDirection =
                 function(languageName, contextTab) {
    this.languageName = languageName;
    if (!ko.prefs.hasPref("debuggerSortDirections")) {
        return;
    }
    var debuggerSortPrefs = ko.prefs.getPref("debuggerSortDirections");
    if (!debuggerSortPrefs.hasPref(languageName)) {
        return;
    }
    var thisLangSortPrefs = debuggerSortPrefs.getPref(languageName);
    if (!thisLangSortPrefs.hasPref(this.context)) {
        return;
    }
    var contextSortPrefs = thisLangSortPrefs.getPref(this.context);
    this._currSortedColumnName = contextSortPrefs.getStringPref("ColumnName");
    this._currSortedDir = contextSortPrefs.getLongPref("Direction");
    if (this._currSortedDir != null) {
        contextTab.updateSortIndicatorsFromState(this._currSortedColumnName,
                                                 this._currSortedDir);
    }
}

variableTreeView.prototype._getOrCreatePref =
        function(parentPrefs, prefSetName) {
    if (parentPrefs.hasPref(prefSetName)) {
        // Don't bother checking to see if this is a prefSet
        return parentPrefs.getPref(prefSetName);
    }
    var newPrefs = Components.classes["@activestate.com/koPreferenceSet;1"].createInstance();
    parentPrefs.setPref(prefSetName, newPrefs);
    return newPrefs;
}

variableTreeView.prototype.savePreferences = function() {
    if (this._currSortedColumnName == null || this._currSortedDir == null) {
        return;
    }
    var debuggerSortPrefs = this._getOrCreatePref(ko.prefs, "debuggerSortDirections");
    var thisLangSortPrefs = this._getOrCreatePref(debuggerSortPrefs, this.languageName);
    var contextSortPrefs = this._getOrCreatePref(thisLangSortPrefs, this.context);
    contextSortPrefs.setStringPref("ColumnName", this._currSortedColumnName);
    contextSortPrefs.setLongPref("Direction", this._currSortedDir);
}

variableTreeView.prototype.clearList = function() {
    variableTreeViewLog.debug('clearList');
    try {
        var rowCount = this.rowCount;
        this.mVariableList = [];
        this.mTotalRows = 0;
        this.rowCountChanged(0, -rowCount);
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
}

variableTreeView.prototype._setNaturalOrder = function(variables) {
    var len = variables.length;
    for (var i = 0; i < len; i++) {
        variables[i].naturalPosition = i;
    }
}

/**
 * returns array of koIDBGPProperty
 */
variableTreeView.prototype._getChildren = function (variable) {
    variableTreeViewLog.debug('_getChildren for '+variable.debugprop.fullname);
    if (!this.dbgTabManager.session) return null;
    var state = this.dbgTabManager.session.getState();
    if (state != ko.dbg.manager.STATE_BREAK && state != ko.dbg.manager.STATE_INTERACTIVE) return null;

    if (typeof(variable.debugprop) == 'undefined') {
        // String items do not have the 'debugprop' attribute, there is
        // nothing to retrieve for these items. See makeVariable().
        return null;
    }

    try {
        var children = new Object();
        // force a request for the next page of children, then grab all
        // available children. If no children have been retrieved, the first page
        // is retrieved.
        variable.debugprop.getChildrenNextPage(children, new Object());
        variable.debugprop.getAvailableChildren(children, new Object());
        if (variable.debugprop.numchildren > children.value.length) {
            //dump("child length is "+variable.debugprop.numchildren+" we have "+children.value.length+"\n");
            // append a special var that will be used to retreive additional
            // pages of children
            children.value[children.value.length] = NextPageLabel;
        }
        return children.value;
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    return null;
}

variableTreeView.prototype.dumpVariable = function(v,i) {
    variableTreeViewLog.debug('dumpVariable');
    try {
        if (!v.debugprop)
            dump("var: i: "+i+" pindex: "+v.parent+" level: "+v.level+" havechild: "+v.isContainer+"\n");
        else
            dump("var: i: "+i+" pindex: "+v.parent+" level: "+v.level+" havechild: "+v.isContainer+" name: "+v.debugprop.fullname+"\n");
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
}

variableTreeView.prototype.makeVariable = function(debugprop, parent, level) {
    //variableTreeViewLog.debug('makeVariable');
    var variable = new Object();
    try {
        var children = null;
        var placeholder = 0;
        variable.isEmpty = false;
        variable.parent = parent;
        variable.level = level;
        variable.isContainerOpen = false;
        // if children is non-null, it's an array of
        // jsWrapped debugprop's (koIDBGPProperty)
        variable.children = null;
        variable.fullname = null;
        variable.name = null;
        if (typeof(debugprop) == 'string') {
            variable.fullname = debugprop;
            variable.name = debugprop;
            variable.value = "";
            variable.type = "";
        } else {
            variable.debugprop = debugprop;
            variable.isContainer = variable.debugprop.children;
            if (variable.isContainer) {
                variable.fullname = variable.debugprop.fullname;
                variable.isContainerOpen = this.dbgTabManager.getVarState(variable.fullname);
            }
        }
        /**
         * The variable value the user last saw; we use this to track change states
         * @see variableTreeView.prototype.updateList()
         */
        variable.lastValue = undefined;
        /**
         * The variable value the variable turned into that the user hasn't yet
         * seen.  This is necessary for PHP &c where we notice the value change
         * during the running state (as opposed to the break state).
         * @see variableTreeView.prototype.updateList()
         */
        variable.stagedValue = undefined;
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    return variable;
}

variableTreeView.prototype.getVariableChildren = function(variable, varIndex) {
    var children = this._getChildren(variable);
    if (!children) return;
    variable.children = this.getJSWrappedVariables(children, varIndex, variable.level+1);
}

/*
 * Wraps an array of koIDBGPProperty in JS objects.
 * @param debugpropArray {array of koIDBGPProperty}  List of variables to wrap
 * @param {Integer} parent The index of debugpropArray's parent variable
 * @param {Integer} level The level of this array
 * 
 * @returns array of JS objects that wrap each koIDBGPProperty, possibly sorted
 */
variableTreeView.prototype.getJSWrappedVariables = function(debugpropArray, parent, level) {
    if (!debugpropArray)
        return [];
    var newArray = [];
    variableTreeViewLog.debug('getJSWrappedVariables');
    try {
        var children, variable;
        for (var i =0; i < debugpropArray.length; i++) {
            // dump('var type '+typeof(debugpropArray[i])+'\n');
            variable = this.makeVariable(debugpropArray[i], parent, level);
            //dump("getJSWrappedVariables:: make variable for " + (variable.name || variable.debugprop.name) + "\n");
            newArray[newArray.length] = variable;
            if (variable.isContainerOpen) {
                this.getVariableChildren(variable, newArray.length - 1);
            }
        }
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    //dump("newArray:: length: " + newArray.length + "\n");
    this._setNaturalOrder(newArray);
    return newArray;
}

/**
 * Internal function used to recursively retrieve the flat variable list to be
 * used by the nsITreeView.
 * @private
 */
variableTreeView.prototype._getFlatVariableList = function(variableList) {
    //dump("_getFlatVariableList: " + variableList + "\n");
    var flatVariableList = [];
    var variable;
    for (var i=0; i < variableList.length; i++) {
        variable = variableList[i];
        flatVariableList.push(variable);
        if (variable.children)
            flatVariableList = flatVariableList.concat(this._getFlatVariableList(variable.children));
    }
    this._currentFlatVariableList = flatVariableList;
    return flatVariableList;
}

/**
 * Function used to create the flat variable list, which will be used by
 * the nsITreeView. Translates the debugpropArray list from being a n-level
 * deep array/matrix into a single flattened variable list.
 *
 * @param {array of koIDBGPProperty} debugpropArray List of variables to wrap
 * @param {Integer} parent The index of debugpropArray's parent variable
 * @param {Integer} level The level of this array
 */
variableTreeView.prototype.getFlatVariableList = function(debugpropArray, parent, level) {
    var variables_this_level = this.getJSWrappedVariables(debugpropArray, parent, level);
    return this._getFlatVariableList(variables_this_level);
}

variableTreeView.prototype.buildList = function(debugpropArray) {
    window.setCursor("wait");
    variableTreeViewLog.debug('buildList');
    try {
        this.mVariableList = this.getFlatVariableList(debugpropArray, -1, 0);
        this.mTotalRows = this.mVariableList.length;

        //dump("variableTreeView.buildList length "+this.mVariableList.length+", got "+debugpropArray.length+"\n");
        this.checkUpdateSort();
        this.rowCountChanged(0,this.mVariableList.length);
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    window.setCursor("auto");
}

/**
 * Update the variable list being displayed
 * 
 * @param {Array of koIDBGPProperty} debugpropArray The new properties
 * @param {Boolean} isChangeSignificant If true, the change is significant and
 *      should be highlighted if possible.
 */
variableTreeView.prototype.updateList = function(debugpropArray, isChangeSignificant) {
    window.setCursor("wait");
    try {
        var oldRowCount = this.rowCount;
        var oldVars = {}; // fullname -> {value, lastValue, stagedValue}
        this.mVariableList.forEach(function(variable) {
            oldVars[variable.fullname] = {value: variable.value,
                                          lastValue: variable.lastValue,
                                          stagedValue: variable.stagedValue};
        });
        this.mVariableList = this.getFlatVariableList(debugpropArray, -1, 0);

        for each (var variable in this.mVariableList) {
            var fullname = variable.debugprop ? variable.debugprop.fullname : variable.fullname;
            var value = variable.debugprop ? variable.debugprop.value : variable.value;
            if (fullname in oldVars) {
                var old = oldVars[fullname];
                if (!isChangeSignificant) {
                    // This is not significant; keep the previous last value
                    variable.lastValue = old.lastValue;
                    variable.stagedValue = old.stagedValue;
                } else {
                    // This is significant; use the previously staged value as
                    // the last value.
                    variable.lastValue = old.stagedValue;
                    variable.stagedValue = value;
                }
            } else {
                variable.lastValue = value;
                variable.stagedValue = value;
            }
            variableTreeViewLog.debug("var " + fullname + " => old [" +
                                      variable.lastValue + "] new [" + value +
                                      "] " + isChangeSignificant);
        }
        this.mTotalRows = this.mVariableList.length;

        this.checkUpdateSort();
        this.rowCountChanged(0, this.rowCount - oldRowCount);
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    window.setCursor("auto");
}

variableTreeView.prototype.getCellText = function(row, column) {
    var res = "";
    //variableTreeViewLog.debug('getCellText');
    var colID = column.id;
    try {
        if (row >= this.mVariableList.length)
            return '';

        var variable = this.mVariableList[row];
        if (!variable) return '';

        if (colID == "name") {
            if (!variable.name) {
                variable.name = variable.debugprop.name;
            }
            // yes, we still want to retreive fullname here
            if (!variable.fullname) {
                variable.fullname = variable.debugprop.fullname;
            }
            res = variable.name;
        } else if (colID == "value") {
            if (typeof(variable.value) == "undefined") {
                variable.value = variable.debugprop.value;
            }
            res = variable.value;
            // Escape only if we need to. - bug 84876:
            // These characters aren't displayed correctly in a tree cell.
            if (res.match(this._escapableWhiteSpaceRegex)) {
                res = res.replace(/\\/g, "\\\\").
                    replace(/\r/g, "\\r").
                    replace(/\n/g, "\\n").
                    replace(/\t/g, "\\t");
            }
            if (this.askedForHex) {
                var resHex = this.hexifyNumericVariable(variable, res);
                if (resHex !== null) {
                    res = resHex;
                }
            }
        } else if (colID == "type") {
            if (typeof(variable.type) == "undefined") {
                variable.type = variable.debugprop.classname || variable.debugprop.type;
            }
            res = variable.type;
        }
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    return res;
}

variableTreeView.prototype.getCellProperties = function(row, col) {
    var variable = this.mVariableList[row];
    if (!variable)
        return "";
    var value = variable.debugprop ? variable.debugprop.value : variable.value;
    if (variable.lastValue != value) {
        return "changed";
    }
    return "";
};

variableTreeView.prototype.getCellPropertiesMoz21AndOlder = function(row, col, properties) {
    var variable = this.mVariableList[row];
    if (!variable)
        return;
    var value = variable.debugprop ? variable.debugprop.value : variable.value;
    if (variable.lastValue != value) {
        var atomSvc = Components.classes["@mozilla.org/atom-service;1"]
                                .getService(Components.interfaces.nsIAtomService);
        properties.AppendElement(this.getCellPropertiesMoz21AndOlder._changed_atom);
    }
};

XPCOMUtils.defineLazyGetter(
    variableTreeView.prototype.getCellPropertiesMoz21AndOlder,
    "_changed_atom",
    function() Components.classes["@mozilla.org/atom-service;1"]
                         .getService(Components.interfaces.nsIAtomService)
                         .getAtom("changed"));

variableTreeView.prototype.isEditable = function(row, column) {
    if (column.id == "value") return true;
    return false;
}

variableTreeView.prototype.isContainer = function(index) {
    var res = 0;
    //variableTreeViewLog.debug('isContainer');
    try {
        if (index < this.mVariableList.length && typeof(this.mVariableList[index]) != 'undefined') {
            res = this.mVariableList[index].isContainer;
        }
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    return res;
}

variableTreeView.prototype.isContainerOpen = function(index) {
    var res = false;
    //variableTreeViewLog.debug('isContainerOpen');
    try {
        if (index < this.mVariableList.length && typeof(this.mVariableList[index]) != 'undefined') {
            var variable = this.mVariableList[index];
            res = variable.isContainerOpen;
            if (res && ! variable.children) {
                this._addChildren(index, variable);
            }
        }
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    return res;
}

  /* long getLevel(in long index); */
variableTreeView.prototype.getLevel = function(index) {
    //variableTreeViewLog.debug('getLevel');
    try {
        if (index < this.mVariableList.length && typeof(this.mVariableList[index]) != 'undefined') {
            return this.mVariableList[index].level;
        }
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    return 0;
}

  /* boolean hasNextSibling(in long rowIndex, in long afterIndex); */
variableTreeView.prototype.hasNextSibling = function(rowIndex, afterIndex) {
    //variableTreeViewLog.debug('hasNextSibling');
    try {
        if (afterIndex < (this.mTotalRows - 1) && typeof(this.mVariableList[rowIndex]) != 'undefined') {
            var variable = this.mVariableList[rowIndex];
            for (var i = rowIndex + 1; i < this.mTotalRows && variable.level <= this.mVariableList[i].level; i++) {
                if (variable.level == this.mVariableList[i].level) return true;
            }
        }
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    return false;
}

/* long getParentIndex(in long rowIndex); */
variableTreeView.prototype.getParentIndex = function(index) {
    var parent = -1;
    //variableTreeViewLog.debug('getParentIndex');
    try {
        if (index < this.mVariableList.length && index > 0 && this.mVariableList[index].level > 0) {
            // parent is not going to be correct most of the time, go up the list and compare levels
            var level = this.mVariableList[index].level;
            for (var i = index - 1; i >= 0; i--) {
                if (level > this.mVariableList[i].level) {
                    parent = i;
                    break;
                }
            }
        }
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    return parent;
}

variableTreeView.prototype._addChildren = function(index, variable) {
    window.setCursor("wait");
    variableTreeViewLog.debug('_addChildren');
    try {
        this.getVariableChildren(variable, index);
        if (!variable.children) return;

        var fa = this.mVariableList.slice(0,index+1);
        var fe = this.mVariableList.slice(index+1);
        this.mVariableList = fa;
        this.mVariableList = this.mVariableList.concat(variable.children);
        this.mVariableList = this.mVariableList.concat(fe);
        this.mTotalRows = this.mVariableList.length;

        // keep ourselves displaying correctly after adding children.
        var firstVisibleRow = this.mTree.getFirstVisibleRow();
        var currentIndex = this.mSelection.currentIndex;
        this.checkUpdateSort();
        this.rowCountChanged(0,this.mVariableList.length);
        this.mSelection.currentIndex = currentIndex;
        this.mSelection.select(currentIndex);
        this.mTree.ensureRowIsVisible(firstVisibleRow);
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    window.setCursor("auto");
}

/* this function is *slower than it should be* if dealing with *deeply* nested structues
    where a lot of them are toggled open because we're splitting the array and recreating
    it on every recursion. */
variableTreeView.prototype._toggleAddChildren = function(index) {
    var variable = this.mVariableList[index];
    variableTreeViewLog.debug('_toggleAddChildren');
    try {
        if (!variable.children) {
            // children have not been retreived, get them now
            var children = this._getChildren(variable);
            if (!children) return;
            variable.children = this.getJSWrappedVariables(children, index, variable.level+1);
        }

        // open the container
        var fa = this.mVariableList.slice(0,index+1);
        var fe = this.mVariableList.slice(index+1);

        this.mVariableList = fa;

        // insert the children into the array
        // variable.children are already JS-wrapped.
        var flattenedChildren = this._getFlatVariableList(variable.children, index, variable.level + 1);
        for each (var child in flattenedChildren) {
            // mark everything we're adding as not changed
            child.lastValue = child.stagedValue = (child.debugprop? child.debugprop.value : child.value);
        }
        this.mVariableList = this.mVariableList.concat(flattenedChildren);
        if (fe.length > 0) this.mVariableList = this.mVariableList.concat(fe);

        // now we have a new index, check if any of the new children are open
        for (var i = index + 1; i < this.mVariableList.length && variable.level < this.mVariableList[i].level; i++) {
            if (this.mVariableList[i].level == variable.level + 1 &&
                this.mVariableList[i].isContainerOpen &&
                (this.mVariableList.length > i+1 &&
                 this.mVariableList[i+1].level == this.mVariableList[i].level)) {
                this._toggleAddChildren(i);
            }
        }
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
}

variableTreeView.prototype.addChildPage = function(index) {
    if (index >= this.mVariableList.length) return;
    var variable = this.mVariableList[index];
    if (!variable.isContainer) return;
    window.setCursor("wait");
    try {
        var firstVisibleRow = this.mTree.getFirstVisibleRow();
        this.mTree.beginUpdateBatch();
        if (variable.isContainerOpen) {
            // remove container children
            var level = variable.level;
            var i;
            for (i = index + 1; i < this.mVariableList.length && level < this.mVariableList[i].level; i++) { }
            this.mVariableList.splice(index+1,i-(index+1));
            variable.children = null;
            // add the children back, this forces a fetch of the next page as
            // well
            this._toggleAddChildren(index);
        }
        this.mTotalRows = this.mVariableList.length;
        this.checkUpdateSort();
        this.mTree.rowCountChanged(0, this.mVariableList.length);
        this.mTree.invalidate();
        this.mTree.endUpdateBatch();
        this.mSelection.currentIndex = index;
        this.mSelection.select(index);
        this.mTree.ensureRowIsVisible(firstVisibleRow);
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    window.setCursor("auto");
}

  /* void toggleOpenState(in long index); */
variableTreeView.prototype.toggleOpenState = function(index) {
    if (index >= this.mVariableList.length) return;
    var variable = this.mVariableList[index];
    if (!variable.isContainer) return;
    window.setCursor("wait");
    variableTreeViewLog.debug('toggleOpenState');
    try {
        var firstVisibleRow = this.mTree.getFirstVisibleRow();
        this.mTree.beginUpdateBatch();
        if (variable.isContainerOpen) {
            // close the container
            this.dbgTabManager.contractVar(variable.fullname);
            variable.isContainerOpen = false;
            var level = variable.level;
            var i;
            for (i = index + 1; i < this.mVariableList.length && level < this.mVariableList[i].level; i++) { }
            this.mVariableList.splice(index+1,i-(index+1));
        } else {
            this.dbgTabManager.expandVar(variable.fullname);
            variable.isContainerOpen = true;
            this._toggleAddChildren(index);
        }
        this.mTotalRows = this.mVariableList.length;
        this.checkUpdateSort();
        this.mTree.rowCountChanged(0, this.mVariableList.length);
        this.mTree.invalidate();
        this.mTree.endUpdateBatch();
        this.mSelection.currentIndex = index;
        this.mSelection.select(index);
        this.mTree.ensureRowIsVisible(firstVisibleRow);
    } catch (ex) {
        variableTreeViewLog.exception(ex);
    }
    window.setCursor("auto");
}

/*
 * Call this whenever the list of vars has possibly changed,
 * so we can maintain the current sort view.
 */
variableTreeView.prototype.checkUpdateSort = function() {
    if (this._currSortedColumnName != null
        && this._currSortedDir != null) {
        this.Sort(this._currSortedColumnName, this._currSortedDir);
    }
}

/**
 * Sort either by natural order, ascending, or descending.
 *
 * Sorting by natural order: preserve the order returned by
 * the debug engine, meaning that we do an ascending within
 * each set of nodes by their .naturalPosition field.
 *
 * Otherwise use the names
 *
 * Sorting ascending: consider (parent, index, name):
 *
 */
variableTreeView.prototype.Sort = function(column, sortDirection) {
    var _debug = false;
    function convertListToTree(rawVarList, startIdx, endIdx, idxObj) {
        // @param endIdx : points 1 past the last index
        if (startIdx >= endIdx) {
            return [];
        }
        var thisLevel, startLevel = rawVarList[startIdx].level;
        var newItems = [rawVarList[startIdx]];
        var i = startIdx + 1;
        var j;
        var variableCurr, variableNext;
        while (i < endIdx) {
            variableCurr = rawVarList[i];
            thisLevel = variableCurr.level;
            if (thisLevel < startLevel) {
                break;
            } else if (thisLevel == startLevel) {
                newItems.push(variableCurr);
                i += 1;
            } else {
                // assert thisLevel = startLevel + 1
                var newIdx = {};
                var childItems = convertListToTree(rawVarList, i, endIdx, newIdx);
                if (rawVarList[i - 1].isContainerOpen) {
                    rawVarList[i - 1]._treeChildren = childItems;
                }
                i = newIdx.value;
            }
        }
        if (typeof(idxObj) != "undefined") {
            idxObj.value = i;
        }
        return newItems;
    }
    function rebuildVarListFromTreeList(treeList, outliner) {
        var len = treeList.length;
        for (var i = 0; i < len; i++) {
            var currItem = treeList[i];
            outliner.mVariableList.push(currItem);
            if (currItem._treeChildren) {
                rebuildVarListFromTreeList(currItem._treeChildren, outliner);
                currItem._treeChildren = null;
            }
        }
    }
    function dumpFixedTree(fixedList, indent) {
        if (typeof(indent) == "undefined") indent = "";
        var len = fixedList.length;
        for (var i = 0; i < len; i++) {
            var variable = fixedList[i];
            vtvSortLog.debug(indent + variable.name
                             + ": level: " + variable.level
                             + ": naturalPosition: " + variable.naturalPosition
                             + " # kids: " + (variable._treeChildren || []).length
                             + "\n");
            if (variable._treeChildren) {
                dumpFixedTree(variable._treeChildren, indent + "  ");
            }
        }
        
    }
    function pickSortFunc(allAreNumeric, direction) {
        if (direction == 0) {
            return function(a, b) {
                return a._candidateValue - b._candidateValue;
            }
        } else if (allAreNumeric) {
            return function(a, b) {
                // They can be the same when we sort by value, for example.
                if (a._candidateValue == b._candidateValue) return direction * (a.naturalPosition - b.naturalPosition);
                else return (a._candidateValue - b._candidateValue) * direction;
            }
        } else {
            return function(a, b) {
                if (a._candidateValue == b._candidateValue) return direction * (a.naturalPosition - b.naturalPosition);
                else return a._candidateValue > b._candidateValue ? direction : -1 * direction;
            }
        }
    }
    function sortConvertedTree(treeVarList, direction, attrFields) {
        var allAreNumeric = true;
        var endIdx = treeVarList.length;
        var nextPageItem = null;
        if (endIdx > 0 && treeVarList[endIdx - 1].name == NextPageLabel) {
            nextPageItem = treeVarList.pop();
            endIdx -= 1;
        }
        for (var i = 0; i < endIdx; i++) {
            var variableCurr = treeVarList[i];
            var candidateValue = null;
            if (direction == 0) {
                candidateValue = variableCurr.naturalPosition;
            } else {
                for (var attrField, i2 = 0; attrField = attrFields[i2]; i2++) {
                    if (attrField in variableCurr) {
                        candidateValue = variableCurr[attrField];
                        if (attrField == "name" || attrField == "fullname") {
                            candidateValue = candidateValue.replace(/^[\$\%\*\@]+/, "");
                        }
                        break;
                    }
                }
                if (candidateValue == null) {
                    allAreNumeric = false;
                    candidateValue = "";
                } else if (allAreNumeric) {
                    if (isNaN(candidateValue)) {
                        var m = /^\W*(\d+)\W*$/.test(candidateValue);
                        if (m) {
                            candidateValue = m[1];
                        } else {
                            allAreNumeric = false;
                            candidateValue = candidateValue.toLowerCase();
                        }
                    }
                } else {
                    candidateValue = candidateValue.toLowerCase();
                }
            }
            variableCurr._candidateValue = candidateValue;
            if (variableCurr._treeChildren) {
                sortConvertedTree(variableCurr._treeChildren, direction, attrFields);
            }
        }
        treeVarList.sort(pickSortFunc(allAreNumeric, direction));
        if (nextPageItem) {
            treeVarList.push(nextPageItem);
        }
    }

    if (typeof(column) != "string") {
        column = column.id;
    }
    this._currSortedColumnName = column;
    this._currSortedDir = sortDirection;
    var len = this.mVariableList.length;
    var variable;
    vtvSortLog.debug("'Sort': look at " + len + " vars,"
                     + "direction:"
                     + sortDirection);

    if (sortDirection) {
        // The advantage of sorting by natural order is that
        // we can defer getting the variables' underlying
        // values until the tree widget needs to display them.
        for (var i = 0; i < len; i++) {
            variable = this.mVariableList[i];
            if (variable.name == null) {
                variable.fullname = variable.debugprop.fullname;
                variable.name = variable.debugprop.name;
            }
            if (variable.value == null) {
                variable.value = variable.debugprop.value;
            }
            if (variable.type == null) {
                variable.type = variable.debugprop.classname || variable.debugprop.type;
            }
            vtvSortLog.debug("name: "
                             + variable.name
                             + ", isContainerOpen:"
                             + variable.isContainerOpen
                             + ", level:"
                             + variable.level);
        }
    }

    var selectedVariables = this.getSelectedVariables();
        
    var newItems = convertListToTree(this.mVariableList, 0, len);
    var currentIndex = this.mSelection.currentIndex;
    var currentVariable = this.mVariableList[currentIndex];
    if (_debug) {
        dumpFixedTree(newItems);
    }
    var colIdToVarAttr = {
        name: ['name', 'fullname'],
        type: ['type'],
        value: ['value']
    };
    var attrFields = colIdToVarAttr[column]
    sortConvertedTree(newItems, sortDirection, attrFields);
    if (_debug) {
        vtvSortLog.debug("tree after sorting:...");
        dumpFixedTree(newItems);
    }
    this.mVariableList = [];
    this.mTree.beginUpdateBatch();
    rebuildVarListFromTreeList(newItems, this);
    this.mSelection.clearSelection();
    for (var index = 0;
         selectedVariables.length > 0 && index < this.mTotalRows;
         index++) {
        var v = this.mVariableList[index];
        var svIndex = selectedVariables.indexOf(v);
        if (svIndex != -1) {
            // this.mSelection.select(index);
            this.mSelection.rangedSelect(index, index, true); // augment
            delete selectedVariables[svIndex];
        }
    }
    if (currentIndex >= 0 && currentVariable) {
        var newCurrentVarIndex = this.mVariableList.indexOf(currentVariable);
        if (newCurrentVarIndex != -1) {
            this.mSelection.currentIndex = newCurrentVarIndex;
            this.mTree.ensureRowIsVisible(newCurrentVarIndex);
        }
    }
    this.mTree.endUpdateBatch();
    this.mTree.invalidate();
}

/**
 * Select the tree row at the given index
 * 
 * @param {Number} index The row index to select
 */
variableTreeView.prototype.selectIndex = function(index) {
    if (index >= this.mTotalRows) {
        // Invalid index, cannot select the item - bug 83094.
        variableTreeViewLog.info("Tried to select an invalid index: " +
                                 index + ", total rows: " + this.mTotalRows);
        if (this.mTotalRows == 0) {
            this.mSelection.currentIndex = -1;
            return;
        }
        index = 0;
    }
    if (index < 0) {
        this.mSelection.currentIndex = -1;
        this.mSelection.clearSelection();
    } else {
        this.mSelection.select(index);
    }
}

variableTreeView.prototype.knownNumericTypeNames =
    ["int", "float", "long", // Python & PHP
     "number", // JS
     "Fixnum", "Float", "Bignum", "Numeric", "Integer"  // Ruby
     ];
variableTreeView.prototype.hexifyNumericVariable = function(variable, res) {
    if (typeof(variable.type) == "undefined") {
        variable.type = variable.debugprop.classname || variable.debugprop.type;
    }
    if (!this.knownNumericTypeNames.indexOf(variable.type)
        && !/^[\-\+]?(?:\d+\.\d*|\.\d+)(?:[Ee][\-+]?\d+)?$/.test(res)) {
        // Look for at least one digit before the end or an optional
        // exponent part, and allow at most one decimal point in that range
        return null;
    }
    var val = parseFloat(res);
    if (isNaN(val)) {
        return null;
    }
    val = val.toString(16).toUpperCase();
    if (val.length == 1) {
        val = "0" + val;
    }
    return "0x" + val;
};

variableTreeView.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsIWeakReference)) {
        return this;
    }
    return xtk.baseTreeView.prototype.QueryInterface.call(this, iid);
}

variableTreeView.prototype.observe = function(subject, topic, data) {
    if (topic == "debuggerPreferHex") {
        this.updateAskedForHex();
    }
};
variableTreeView.prototype.updateAskedForHex = function() {
    this.askedForHex = ko.prefs.getBoolean("debuggerPreferHex", false);
    if (this.mTree) {
        this.mTree.invalidate();
    }
};
