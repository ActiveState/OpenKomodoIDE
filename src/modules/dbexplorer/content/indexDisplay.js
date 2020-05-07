/* Copyright (c) 2003-2009 ActiveState Software Inc.
See the file LICENSE.txt for licensing information. */

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";


//---- Globals

var log = ko.logging.getLogger("dbexplorer.indexDisplay");
log.setLevel(ko.logging.LOG_DEBUG);

var indexName = "";
var koDBConnection = null;
var widgets = {};

// Localization.
var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                .getService(Components.interfaces.nsIStringBundleService)
                .createBundle("chrome://dbexplorer/locale/dbexplorer.properties");
                
//---- Functions

function onLoad() {
    var args = window.arguments[0];
    indexName = args.name;
    koDBConnection = args.connection;
    var info = koDBConnection.getIndexInfo(indexName);
    document.getElementById('indexName').value = indexName;
    document.getElementById('tableName').value = info.tableName;
    var sql = info.sql;
    if (sql) {
        document.getElementById('dbx-indexDisplay').value = sql;
    }
}
