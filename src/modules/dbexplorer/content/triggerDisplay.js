/* Copyright (c) 2003-2009 ActiveState Software Inc.
See the file LICENSE.txt for licensing information. */

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const HTTP_NS = "http://www.w3.org/1999/xhtml";

//---- Globals

var log = ko.logging.getLogger("dbexplorer.triggerDisplay");
log.setLevel(ko.logging.LOG_DEBUG);

var triggerName = "";
var koDBConnection = null;
var widgets = {};

// Localization.
var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                .getService(Components.interfaces.nsIStringBundleService)
                .createBundle("chrome://dbexplorer/locale/dbexplorer.properties");
                
//---- Functions

function onLoad() {
    var args = window.arguments[0];
    triggerName = args.name;
    koDBConnection = args.connection;
    var info = koDBConnection.getTriggerInfo(triggerName);
    document.getElementById('triggerName').value = triggerName;
    document.getElementById('tableName').value = info.tableName;
    var sql = info.sql;
    if (sql) {
        var descrNode = document.getElementById('dbx-triggerDisplay');
        var textUtils = Components.classes["@activestate.com/koTextUtils;1"]
                            .getService(Components.interfaces.koITextUtils);
        var fixed_sql = textUtils.break_up_words(sql, 50);
        descrNode.value = fixed_sql;
    }
    scintillaOverlayOnLoad();
}

function onUnload() {
    scintillaOverlayOnUnload();
}
