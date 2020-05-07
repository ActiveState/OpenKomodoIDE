/* Copyright (c) 2000-2011 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

const HIERACHICAL_PROGRESS_NORMAL = Components.interfaces.nsITreeView.PROGRESS_NORMAL;

function _treeSortFn(compare1, compare2)
{
    var result = compare1.data - compare2.data;
    if (result == 0) {
        // Keep the sort order as uniform as possible.
        return compare1.oldindex - compare2.oldindex;
    }
    return result;
}

function _sortAttributeNameFromXtkValue(sortDir) {
    return sortDir == xtk.dataTreeView.SORT_ASCENDING ? "ascending" : "descending";
}

function _sortXtkValueFromAttributeName(sortDir) {
    return sortDir == "descending" ? xtk.dataTreeView.SORT_DESCENDING : xtk.dataTreeView.SORT_ASCENDING;
}

function _getTreeColumnFromId(treebox, id)
{
    var treecols = treebox.columns;
    var colElem;
    for (var i=0 ; i < treecols.count; i++) {
        colElem = treecols.getColumnAt(i).element;
        if (colElem.getAttribute("id") == id) {
            return colElem;
        }
    }
    return null;
}

function _setTreeSortIndicators(treebox, col, sortDirection)
{
    var treecols = treebox.columns;
    var colElem;
    for (var i=0 ; i < treecols.count; i++) {
        colElem = treecols.getColumnAt(i).element;
        if (colElem.id == col.id) {
            colElem.setAttribute("sortDirection", sortDirection);
        } else {
            colElem.removeAttribute("sortDirection");
        }
    }
    treebox.treeBody.setAttribute("sortDirection", sortDirection);
    treebox.treeBody.setAttribute("sortResource", col.id);
}

function _getSortedTreeColumnAndXtkDirection(tree)
{
    var sortColumnId = tree.treeBody.getAttribute("sortResource");
    var sortDirection = tree.treeBody.getAttribute("sortDirection");
    var treecols = tree.columns;
    if (sortColumnId) {
        var colElem = treecols.getNamedColumn(sortColumnId);
        sortDirection = _sortXtkValueFromAttributeName(sortDirection);
        return [colElem, sortDirection];
    }
    return [null, sortDirection];
}

/**
 * Custom treeview for the profile data.
 */
function ProfilerHierachicalTreeView(tree, koProfileData) {
    var count = {};
    this.total_cpu_time = koProfileData.total_cpu_time;
    var initial_rows = koProfileData.getHierachicalItems(count);

        // Convert items into profile wrapper items and sort them.
    initial_rows = initial_rows.map(function(item) { return new ProfileItemWrapper(item, 0); });
    var defaultSortPropertyName = "cumulative_cpu_time";
    var defaultSortFn = _treeSortFn;
    var defaultSortDir = xtk.dataTreeView.SORT_DESCENDING;
    initial_rows = this.sort_rows(initial_rows, defaultSortPropertyName,
                                  defaultSortFn, defaultSortDir);
        // Call the parent initializer.
    xtk.hierarchicalTreeView.apply(this, [initial_rows]);
    tree.treeBoxObject.view = this;
        // Save the sort properties.
    this._sortPropertyName = defaultSortPropertyName;
    this._sortFunction = defaultSortFn;
    this._sortDirection = defaultSortDir;
    _setTreeSortIndicators(this.tree,
                           _getTreeColumnFromId(this.tree, "profiler_hierachical_treecol_cumulative_time"),
                           _sortAttributeNameFromXtkValue(this._sortDirection));
        // Atom service is used to set the tree cell css properties.
    this._atomService = Components.classes["@mozilla.org/atom-service;1"].
                            getService(Components.interfaces.nsIAtomService);
};
ProfilerHierachicalTreeView.prototype = new xtk.hierarchicalTreeView();
ProfilerHierachicalTreeView.prototype.contructor = ProfilerHierachicalTreeView;

ProfilerHierachicalTreeView.prototype.propertyNameForTreecol = function(column)
{
    // Each row is koIProfileItem.
    if (column.id == "profiler_hierachical_treecol_name") {
        return "name";
    } else if (column.id == "profiler_hierachical_treecol_num_calls") {
        return "num_calls";
    } else if (column.id == "profiler_hierachical_treecol_total_num_calls") {
        return "total_num_calls";
    } else if (column.id == "profiler_hierachical_treecol_total_time") {
        return "own_cpu_time";
    } else if (column.id == "profiler_hierachical_treecol_cumulative_time") {
        return "cumulative_cpu_time";
    }
    return "";
};
ProfilerHierachicalTreeView.prototype.getCellText = function(row, column)
{
    // Each row is koIProfileItem.
    if (column.id == "profiler_hierachical_treecol_name") {
        return this.rows[row].name;
    } else if (column.id == "profiler_hierachical_treecol_num_calls") {
        return this.rows[row].num_calls;
    } else if (column.id == "profiler_hierachical_treecol_total_num_calls") {
        return this.rows[row].total_num_calls;
    } else if (column.id == "profiler_hierachical_treecol_total_time") {
        return this.rows[row].own_cpu_time;
    } else if (column.id == "profiler_hierachical_treecol_cumulative_time") {
        return this.rows[row].cumulative_cpu_time;
    }
    return "";
};
ProfilerHierachicalTreeView.prototype.getCellProperties = function(row, column, properties) {
    //properties.AppendElement(this._atomService.getAtom("sccLoadingIcon"));
}
ProfilerHierachicalTreeView.prototype.getProgressMode = function(row, column) {
    return HIERACHICAL_PROGRESS_NORMAL;
}
ProfilerHierachicalTreeView.prototype.getCellValue = function(row, column) {
    if (column.id == "profiler_hierachical_treecol_progressmeter") {
        return this.rows[row].cumulative_cpu_percentage;
    }
    return 0;
}

ProfilerHierachicalTreeView.prototype.cycleHeader = function(col) {
    // The user clicked on the tree header - change the sorting behaviour.
    //this._sortColumn = col;
    var [currentSortColumn, currentSortDir] = _getSortedTreeColumnAndXtkDirection(this.tree);
    if (currentSortColumn == col) {
        // Same sort column - change the sort direction.
        this._sortDirection = (this._sortDirection == xtk.dataTreeView.SORT_ASCENDING ? xtk.dataTreeView.SORT_DESCENDING : xtk.dataTreeView.SORT_ASCENDING);
    }
    this._sortPropertyName = this.propertyNameForTreecol(col);
    this._rows = this.sort_rows(this._rows, this._sortPropertyName,
                                this._sortFunction, this._sortDirection);
    // Store the settings on the tree.
    _setTreeSortIndicators(this.tree, col, _sortAttributeNameFromXtkValue(this._sortDirection));
    this.tree.invalidate();
}

ProfilerHierachicalTreeView.prototype._sort_rows_of_same_depth = function(original_rows, sortPropertyName, sortFunction, sortDir) {
    var unsorted_row_data = original_rows.map(function(orig_row, i) {
                                return { "oldindex": i,
                                         "data": orig_row[sortPropertyName]
                                       };
                            });
    var sorted_row_data = unsorted_row_data.sort(sortFunction);
    var result_rows = sorted_row_data.map(function(row_data) { return original_rows[row_data.oldindex]; });
    if (sortDir == xtk.dataTreeView.SORT_DESCENDING) {
        result_rows = result_rows.reverse();
    }
    return result_rows;
}

ProfilerHierachicalTreeView.prototype._expand_and_sort_child_rows = function(rowItem, sortPropertyName, sortFunction, sortDir) {
    var child_rows = xtk.hierarchicalTreeView.prototype._expand_and_sort_child_rows.apply(this, [rowItem, sortPropertyName, sortFunction, sortDir]);
    // Prevent recursion - we don't want to show the same items over and over.
    for (var i=0; i < child_rows.length; i++) {
        child_rows[i].parent = rowItem; // manually set the child's parent node
        if (child_rows[i].isRecursive()) {
            // The child is the same as any of the parents - this means we have
            // recursion, which we break by setting hasChildren to false.
            child_rows[i]._hasChildren = false;
            child_rows[i]._children = [];
            /* Note: \u21b0 is the Upwards Arrow With Tip Leftwards unicode symbol. */
            child_rows[i]._name =  "\u21b0 " + child_rows[i].name + " (recursion)";
        }
    }
    return child_rows;
}

ProfilerHierachicalTreeView.prototype.sort_rows = function(original_rows, sortPropertyName, sortFunction, sortDir) {
    // Get the highest level items and sort those, then individually sort their children.
    var top_level_rows = original_rows.filter(function(orig_row) { return orig_row.level == 0; });
    top_level_rows = this._sort_rows_of_same_depth(top_level_rows, sortPropertyName, sortFunction, sortDir);
    var result_rows = [];
    for (var i=0; i < top_level_rows.length; i++) {
        var row_item = top_level_rows[i];
        result_rows.push(row_item);
        if (row_item.state == xtk.hierarchicalTreeView.STATE_OPENED) {
            var sorted_children = this._expand_and_sort_child_rows(row_item, sortPropertyName, sortFunction, sortDir);
            result_rows = result_rows.concat(sorted_children);
        }
    }
    return result_rows;
}

/**
 * 
 * @param koProfileItem Type - Description
 * @param  Type - Description
 * @param  Type - Description
 */
ProfilerHierachicalTreeView.prototype._expand_to_show_hotspots = function(koProfileItem, rowNum, minCpuTime, maxDepth) {
    if (koProfileItem.state == 0) {
        // Collapsed - expand child items.
        this.toggleOpenState(rowNum);
        var count = {};
        var item;
        var childRowNum;
        var children = koProfileItem.getChildren(count);
        for (var i=children.length - 1; i >= 0; i--) {
            childRowNum = rowNum + i + 1;
            item = this._rows[childRowNum]; // Use this._rows - as it's already sorted.
            if (item.cumulative_cpu_time >= minCpuTime && item.level < maxDepth) {
                this._expand_to_show_hotspots(item, childRowNum, minCpuTime, maxDepth);
            }
        }
    }
}

// TODO: Implement argument handling - for the column to sort by.
ProfilerHierachicalTreeView.prototype.show_hotspots = function() {
    // Expand the tree to show the most performance intensive functions.
    var minCpuTime = this.total_cpu_time / 10; // 10 % of cpu time
    var maxDepth = 10; // Don't go deeper than 10 levels.
    var item;
    var current_rows = this._rows.slice(); // A copy
    for (var i=current_rows.length - 1; i >= 0; i--) {
        item = current_rows[i];
        if (item.level == 0 && item.cumulative_cpu_time >= minCpuTime) {
            this._expand_to_show_hotspots(item, i, minCpuTime, maxDepth);
        }
    }

    // Select the first (expanded) item in the tree.
    var rows = this.rows;
    if (rows.length > 0) {
        var rownum = 0;
        var level = rows[rownum].level;
        while ((rownum+1 < rows.length) && (rows[rownum+1].level > level)) {
            rownum += 1;
            level = rows[rownum].level;
        }
        this.selection.select(rownum);
    }
}
