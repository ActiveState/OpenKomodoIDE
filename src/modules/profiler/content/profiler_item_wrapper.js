/* Copyright (c) 2000-2009 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/**
 * Wrapper class around a koIProfileItem. We can do this easily because the
 * profile item never changes.
 *
 * @param koProfileItem {Components.interfaces.koIProfileItem}
 */
function ProfileItemWrapper(koProfileItem, level, parent=null) {
    this._item = koProfileItem;
    this.state = 0;
    this.level = level;
    this.parent = parent;
}
ProfileItemWrapper.prototype = {
    get name() {
        if (!this._name)
            this._name = this._item.name;
        return this._name;
    },
    get path() {
        if (!this._path)
            this._path = this._item.path;
        return this._path;
    },
    get line() {
        if (!this._line)
            this._line = this._item.line;
        return this._line;
    },
    get num_calls() {
        if (!this._num_calls)
            this._num_calls = this._item.num_calls;
        return this._num_calls;
    },
    get total_num_calls() {
        if (!this._total_num_calls)
            this._total_num_calls = this._item.total_num_calls;
        return this._total_num_calls;
    },
    _niceFloatingPoint: function(value) {
        if (value > 1000) {
            // Round to nearest integer.
            return parseInt(value);
        } else if (value > 50) {
            // Use 2 decimal places.
            return Math.round(value * 100) / 100;
        } else {
            // Use 5 decimal places.
            return Math.round(value * 100000) / 100000;
        }
    },
    get own_cpu_time() {
        if (!this._own_cpu_time)
            this._own_cpu_time = this._niceFloatingPoint(this._item.own_cpu_time);
        return this._own_cpu_time;
    },
    get own_cpu_percentage() {
        if (!this._own_cpu_percentage)
            this._own_cpu_percentage = this._item.own_cpu_percentage;
        return this._own_cpu_percentage;
    },
    get cumulative_cpu_time() {
        if (!this._cumulative_cpu_time)
            this._cumulative_cpu_time = this._niceFloatingPoint(this._item.cumulative_cpu_time);
        return this._cumulative_cpu_time;
    },
    get cumulative_cpu_percentage() {
        if (!this._cumulative_cpu_percentage)
            this._cumulative_cpu_percentage = this._item.cumulative_cpu_percentage;
        return this._cumulative_cpu_percentage;
    },
    isContainer: true,
    get hasChildren() {
        if (typeof(this._hasChildren) == "undefined")
            this._hasChildren = this._item.hasChildren;
        return this._hasChildren;
    },
    getChildren: function(countObj) {
        if (!this._children) {
            if (typeof(countObj) == 'undefined') {
                countObj = {};
            }
            var children = this._item.getChildren(countObj);
            var child_level = this.level + 1;
            this._children = children.map(function(item) { return new ProfileItemWrapper(item, child_level); });
        }
        return this._children;
    },
    getAllCallers: function(countObj) {
        if (!this._allCallers) {
            if (typeof(countObj) == 'undefined') {
                countObj = {};
            }
            var callers = this._item.getAllCallers(countObj);
            var child_level = this.level - 1;
            this._allCallers = callers.map(function(item) { return new ProfileItemWrapper(item, child_level); });
        }
        return this._allCallers;
    },
    getAllCallees: function(countObj) {
        if (!this._allCallees) {
            if (typeof(countObj) == 'undefined') {
                countObj = {};
            }
            var callees = this._item.getAllCallees(countObj);
            var child_level = this.level - 1;
            this._allCallees = callees.map(function(item) { return new ProfileItemWrapper(item, child_level); });
        }
        return this._allCallees;
    },
    isRecursive: function() {
        var parent = this.parent;
        while (parent) {
            if (this.isEqual(parent)) {
                return true;
            }
            parent = parent.parent;
        }
        return false;
    },
    isEqual: function(other) {
        return (other &&
                this.name == other.name &&
                this.path == other.path &&
                this.line == other.line);
    }
};
