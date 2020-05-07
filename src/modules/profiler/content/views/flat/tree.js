/* Copyright (c) 2000-2011 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

const FLATTREE_PROGRESS_NORMAL = Components.interfaces.nsITreeView.PROGRESS_NORMAL;

/**
 * Custom flat treeview for the profile data.
 */
function ProfilerFlatTreeView(tree, koProfileData) {
    this.total_cpu_time = koProfileData.total_cpu_time;
    var count = {};
    var initial_rows = koProfileData.getAllItems(count);

        // Convert items into profile wrapper items and sort them.
    initial_rows = initial_rows.map(function(item) { return new ProfileItemWrapper(item, 0); });
        // Call the parent initializer.
    xtk.flatTreeView.apply(this, [initial_rows]);
    tree.treeBoxObject.view = this;
        // Atom service is used to set the tree cell css properties.
    //this._atomService = Components.classes["@mozilla.org/atom-service;1"].
    //                        getService(Components.interfaces.nsIAtomService);
};
ProfilerFlatTreeView.prototype = new xtk.flatTreeView();
ProfilerFlatTreeView.prototype.contructor = ProfilerFlatTreeView;

ProfilerFlatTreeView.prototype.propertyNameForTreecol = function(column)
{
    // Each row is koIProfileItem.
    if (column.id == "profiler_flat_treecol_name") {
        return "name";
    } else if (column.id == "profiler_flat_treecol_num_calls") {
        return "total_num_calls";
    } else if (column.id == "profiler_flat_treecol_total_time") {
        return "own_cpu_time";
    } else if (column.id == "profiler_flat_treecol_cumulative_time") {
        return "cumulative_cpu_time";
    }
    return "";
};
ProfilerFlatTreeView.prototype.getCellText = function(row, column)
{
    // Each row is koIProfileItem.
    if (column.id == "profiler_flat_treecol_name") {
        return this.rows[row].name;
    } else if (column.id == "profiler_flat_treecol_num_calls") {
        return this.rows[row].total_num_calls.toString();
    } else if (column.id == "profiler_flat_treecol_total_time") {
        return this.rows[row].own_cpu_time.toString();
    } else if (column.id == "profiler_flat_treecol_cumulative_time") {
        return this.rows[row].cumulative_cpu_time.toString();
    }
    return "";
};
ProfilerFlatTreeView.prototype.getCellProperties = function(row, column, properties) {
    //properties.AppendElement(this._atomService.getAtom("sccLoadingIcon"));
}
ProfilerFlatTreeView.prototype.getProgressMode = function(row, column) {
    return FLATTREE_PROGRESS_NORMAL;
}
ProfilerFlatTreeView.prototype.getCellValue = function(row, column) {
    if (column.id == "profiler_flat_treecol_progressmeter") {
        return this.rows[row].own_cpu_percentage;
    }
    return 0;
}
ProfilerFlatTreeView.prototype.cycleHeader = function(col) {
    if (col.id == "profiler_flat_treecol_progressmeter") {
        // Sort by cumulative time instead (go find the right column).
        var treecols = this.tree.columns;
        var colElem;
        for (var i=0 ; i < treecols.count; i++) {
            colElem = treecols.getColumnAt(i).element;
            if (colElem.getAttribute("id") == "profiler_flat_treecol_cumulative_time") {
                col = treecols.getColumnAt(i);
                break;
            }
        }
    }
    xtk.flatTreeView.prototype.cycleHeader.apply(this, [col]);
}

// TODO: Implement argument handling - for the column to sort by.
ProfilerFlatTreeView.prototype.show_hotspots = function() {
    // Select the first item in the tree.
    if (this.rows.length > 0) {
        this.selection.select(0);
    }
}




function CallerTreeView(tree)
{
    xtk.flatTreeView.apply(this);
    tree.treeBoxObject.view = this;
}
CallerTreeView.prototype = new xtk.flatTreeView();
CallerTreeView.prototype.contructor = CallerTreeView;
CallerTreeView.prototype.getCellText = function(row, column)
{
    // Each row is koIProfileItem.
    if (column.id == "profiler_callers_flat_treecol_name") {
        return this.rows[row].name;
    } else if (column.id == "profiler_callers_flat_treecol_num_calls") {
        return this.rows[row].total_num_calls.toString();
    } else if (column.id == "profiler_callers_flat_treecol_cpu_time") {
        return this.rows[row].own_cpu_time.toString();
    }
    return "";
}
CallerTreeView.prototype.setProfilerItem = function(item) {
    this.rows = item.getAllCallers();
    this.tree.invalidate();
}



function CalleeTreeView(tree)
{
    xtk.flatTreeView.apply(this);
    tree.treeBoxObject.view = this;
}
CalleeTreeView.prototype = new xtk.flatTreeView();
CalleeTreeView.prototype.contructor = CalleeTreeView;
CalleeTreeView.prototype.getCellText = function(row, column)
{
    // Each row is koIProfileItem.
    if (column.id == "profiler_callees_flat_treecol_name") {
        return this.rows[row].name;
    } else if (column.id == "profiler_callees_flat_treecol_num_calls") {
        return this.rows[row].total_num_calls.toString();
    } else if (column.id == "profiler_callees_flat_treecol_total_time") {
        return this.rows[row].own_cpu_time.toString();
    }
    return "";
}
CalleeTreeView.prototype.setProfilerItem = function(item) {
    this.rows = item.getAllCallees();
    this.tree.invalidate();
}

