
var gLoggerNames;
var gLoggingService;
var _loggingObserver;

function loggingControl_OnLoad() {
    gLoggingService = Components.classes["@activestate.com/koLoggingService;1"].
                        getService(Components.interfaces.koILoggingService);

    document.getElementById('loggers').treeBoxObject.view = gLoggerView;

    gLoggerView.loggernames= gLoggingService.getLoggerNames(new Object());
    gLoggerView.setRowCount(gLoggerView.loggernames.length);

    _loggingObserver = new loggingObserver();
    var observerSvc = Components.classes["@mozilla.org/observer-service;1"].
                            getService(Components.interfaces.nsIObserverService);
    observerSvc.addObserver(_loggingObserver, 'add_logger',false);
}

function loggingControl_OnUnload()
{
    var observerSvc = Components.classes["@mozilla.org/observer-service;1"].
                            getService(Components.interfaces.nsIObserverService);
    observerSvc.removeObserver(_loggingObserver, 'add_logger');

}
function loggingObserver() {
}

loggingObserver.prototype.constructor = ko.logging.Logger;

loggingObserver.prototype.observe = function(subject, topic, data) {
    switch (topic) {
        case 'add_logger':
            gLoggerView.loggernames.push(data);
            gLoggerView.setRowCount(gLoggerView.loggernames.length);
            break;
    }
}

var gLoggerView = ({
    // nsITreeView
    rowCount : 0,
    getRowProperties : function(i, prop) {},
    getColumnProperties : function(index, prop) {},
    getCellProperties : function(index, prop) {},
    isContainer : function(index) {return false;},
    isSeparator : function(index) {return false;},
    setTree : function(out) { this.tree = out; },
    getCellText : function(i, column) {
        switch(column.id){
        case "logger":
            var name = this.loggernames[i];
            if (name == '') { return '<root>' };
            return name;
            break;
        case "effectivelevel":
            var level = ko.logging.getLogger(this.loggernames[i]).getEffectiveLevel();
            if (level == ko.logging.LOG_DEBUG) { return "DEBUG (10)"; }
            if (level == ko.logging.LOG_INFO) { return "INFO (20)"; }
            if (level == ko.logging.LOG_WARN) { return "WARN (30)"; }
            if (level == ko.logging.LOG_ERROR) { return "ERROR (40)"; }
            if (level == ko.logging.LOG_CRITICAL) { return "CRITICAL (50)"; }
            return String(level);
            break;
        case "level":
            var level = ko.logging.getLogger(this.loggernames[i]).level;
            if (level == ko.logging.LOG_NOTSET) { return "<unset>"; }
            if (level == ko.logging.LOG_DEBUG) { return "DEBUG (10)"; }
            if (level == ko.logging.LOG_INFO) { return "INFO (20)"; }
            if (level == ko.logging.LOG_WARN) { return "WARN (30)"; }
            if (level == ko.logging.LOG_ERROR) { return "ERROR (40)"; }
            if (level == ko.logging.LOG_CRITICAL) { return "CRITICAL (50)"; }
            return String(level);
            break;
        default:
            return "XXX in " + column.id + " and " + i;
        }
        return "";
    },
    getImageSrc : function() {return null;},
    isSorted : function() {return true;},
    performAction : function(action) {},
    cycleHeader : function(index) {},
    selectionChanged : function() {},
    getSelectedItem : function() {
        var i = this.selection.currentIndex;
        return this.loggernames[i];
    },

    // Private stuff
    loggernames : [],
    setRowCount : function(rowCount) {
        this.rowCount = rowCount;
        this.tree.beginUpdateBatch();
        this.tree.rowCountChanged(0, this.rowCount);
        this.tree.invalidate();
        this.tree.endUpdateBatch();
    }
});

function setLevel(thing, level) {
    var i, f;
    f = gLoggerView.getSelectedItem();
    ko.logging.getLogger(f).setLevel(Number(level));
    gLoggerView.selectionChanged();
}

