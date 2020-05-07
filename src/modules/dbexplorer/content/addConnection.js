/* Copyright (c) 2009 - 2010 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

var prefDBExplorerLog = ko.logging.getLogger('prefs.dbexplorer');

var dialog = {};
var g_classInfoByName;
var g_dbNameByTypeIdx;
var g_isEnabledByName, g_LoadFailureReason;
var prefset;

var ko;
var mainObj;
var g_rowNum;
var g_operation;
var g_origHasPassword;
var prefObj = {};
var _bundle = null;

if (typeof XUL_NS == "undefined") {
    const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
}

const MAIN_PREF_NAME = "ko-dbexplorer";

const update_label = "Update";
const add_label = "Add";

function onLoad() {
    mainObj = window.arguments[0];
    ko = mainObj.ko;
    g_rowNum = mainObj.rowNum;
    g_operation = mainObj.operation; // 'add' or 'modify'
    prefset = Components.classes["@activestate.com/koPrefService;1"].
                       getService(Components.interfaces.koIPrefService).prefs;
    dialog.top = document.getElementById("addDatabaseConnection");
    dialog.okButton = dialog.top.getButton("accept");
    dialog.cancelButton = dialog.top.getButton("cancel");
    dialog.dbPath = document.getElementById('dbPath');
    dialog.hostname = document.getElementById('hostname');
    dialog.port = document.getElementById('port');
    dialog.username = document.getElementById('username');
    dialog.socket = document.getElementById('socket');
    dialog.password = document.getElementById('password');
    dialog.showPassword = document.getElementById('showPassword');
    dialog.hasPassword = document.getElementById('hasPassword');
    if (g_operation == "add") {
        dialog.top.setAttribute("title", "Add a Database Connection");
        dialog.okButton.label = "Add";
    } else {
        dialog.top.setAttribute("title", "Modify a Database Connection");
        dialog.okButton.label = "Update";
    }
    dialog.dbInfoDeck = document.getElementById('dbInfoDeck');
    dialog.db_types = document.getElementById('db_types');

    if (!prefset.hasPref(MAIN_PREF_NAME)) {
        prefset.setPref(MAIN_PREF_NAME, Components.classes["@activestate.com/koPreferenceSet;1"].createInstance());
    }
    prefset = prefset.getPref(MAIN_PREF_NAME);
    
    getSupportedDBNames();

    var dbTypeName, dbTypeIdx, dbTypeObj = null, deckIdx;
    if (g_operation == 'modify') {
        var prefIds = {}, prefVals = {};
        mainObj.view.getConnectionInfo(g_rowNum, {}, prefIds, {}, prefVals);
        prefIds = prefIds.value;
        prefVals = prefVals.value;
        for (var i = 0; i < prefIds.length; i++) {
            prefObj[prefIds[i]] = prefVals[i];
        }
        dbTypeName = prefObj.db_type;
        dbTypeObj = g_classInfoByName[dbTypeName];
        if (!dbTypeObj) {
            dbTypeObj = g_classInfoByName["SQLite3"]; //always supported
            if (!('dbPath' in prefObj)) {
                prefObj.dbPath = ("Can't find a database adaptor for "
                                  + dbTypeName
                                  + ", switching to SQLite3");
            }
        }
        dbTypeIdx = dbTypeObj.index;
        dialog.db_types.selectedIndex = dbTypeIdx;
        dialog.dbInfoDeck.selectedIndex = dbTypeObj.koIDBXPreference.fileBased ? 0 : 1;
        if (dbTypeObj.koIDBXPreference.fileBased) {
            // Add useful defaults
            prefObj.fileBased = true;
            dialog.dbPath.value = prefObj.dbPath;
        } else {
            prefObj.fileBased = false;
            dialog.hostname.value = prefObj.hostname;
            dialog.port.value = prefObj.port;
            dialog.username.value = prefObj.username;
            // Make it boolean
            g_origHasPassword = prefObj.hasPassword = !!prefObj.hasPassword;
            dialog.hasPassword.checked = prefObj.hasPassword;
            dialog.showPassword.checked = false;
            if (prefObj.hasPassword) {
                var password = null;
                try {
                    var dbxLoginInfo = _createDbxLoginInfo();
                    var dbxLoginManager = Components.classes['@activestate.com/KoDBXLoginManager;1'].
                        createInstance(Components.interfaces.koIDBXLoginManager);
                    password = dbxLoginManager.getPasswordField(dbxLoginInfo);
                    dialog.password.value = password;
                    dialog.showPassword.checked = prefObj.showPassword;
                } catch(ex) {
                    if (ex.toString().indexOf("'NoneType' object has no attribute 'password'")
                        >= 0) {
                        prefDBExplorerLog.error("dbxLoginManager.getPasswordField(prefObj): " + ex + "\n");
                    }
                    dialog.hasPassword.checked = false;
                }
                prefObj.password = password;
            }
        }
    } else {
        if (mainObj.fields) {
            var fields = mainObj.fields;
            dialog.hostname.value = fields.hostname;
            dialog.port.value = fields.port;
            dialog.username.value = fields.username;
            g_origHasPassword = dialog.hasPassword.checked = fields.hasPassword;
            if (g_origHasPassword) {
                dialog.password.value = fields.password;
            }
            dialog.showPassword.checked = fields.showPassword;
            handleShowPassword(dialog.showPassword);
            // Find the spot where this database lives...
            var idx = -1;
            var i = 0;
            dialog.db_types.selectedIndex = 0;
            for each (var node in Array.slice(dialog.db_types.childNodes[0].childNodes)) {
                    var name = node.getAttribute("label");
                    if (name == fields.dbTypeName) {
                        dialog.db_types.selectedIndex = i;
                        break;
                    }
                    i += 1;
                }
            dialog.dbInfoDeck.selectedIndex = 1;
        } else {
            if (prefset.hasPref("addConnection-last-dbtype")) {
                try {
                    dbTypeName = prefset.getStringPref("addConnection-last-dbtype");
                    dbTypeObj = g_classInfoByName[dbTypeName];
                } catch(ex) { }
            }
            if (!dbTypeObj) {
                dbTypeObj = g_classInfoByName["SQLite3"]; //always supported
            }
            dbTypeIdx = dbTypeObj.index;
            dialog.db_types.selectedIndex = dbTypeIdx;
            dialog.dbInfoDeck.selectedIndex = dbTypeObj.koIDBXPreference.fileBased ? 0 : 1;
            // Add useful defaults
            dialog.hostname.value = "localhost";
            var username = null;
            var userEnvSvc = (Components.classes["@activestate.com/koUserEnviron;1"]
                              .getService(Components.interfaces.koIUserEnviron));
            try {
                if (userEnvSvc.has("USER")) username = userEnvSvc.get("USER");
                else if (userEnvSvc.has("USERNAME")) username = userEnvSvc.get("USERNAME");
            } catch(ex) {}
            if (username) {
                dialog.username.value = username;
            }
            g_origHasPassword = dialog.hasPassword.checked = true;
        }
    }
    if (dialog.dbInfoDeck.selectedIndex == 1) {
        dialog.hostname.select();
        var supportSocket = false;
        try {
            if (dialog.db_types.selectedItem.getAttribute('label')
                == "MySQL") {
                supportSocket = true;
            }
        } catch(ex) {
            dump(ex + "\n");
        }
        disableItem(dialog.socket, !supportSocket);
    }
    checkAddButtonStatus();
    updateOnPassword();
}

function onUnload() {
    if (g_operation == 'add') {
        var currDBTypeIdx = dialog.db_types.selectedIndex;
        var currDBName = g_dbNameByTypeIdx[currDBTypeIdx];
        if (currDBName) {
            prefset.setStringPref("addConnection-last-dbtype", currDBName);
        } else {
            prefDBExplorerLog.error("Not a recognized name for idx: " + currDBTypeIdx + "\n");
            if (prefset.hasPref("addConnection-last-dbtype")) {
                prefset.deletePref("addConnection-last-dbtype");
            }
        }
    }
}

function doCancel() {
    mainObj.result = false;
}

function doOK() {
    var res;
    try {
        if (g_operation == 'modify') {
            res = saveChangedConnectionsToPrefs();
        } else {
            res = saveDBConnectionsToPrefs();
        }
    } catch(ex) {
        prefDBExplorerLog.exception("doOK - " + ex + "\n");
        res = false;
    }
    if (res) {
        mainObj.result = true;
    }
    return res;
}

function disableItem(item, condition) {
    if (condition) {
        item.setAttribute('disabled', 'true');
    } else {
        item.removeAttribute('disabled');
    }
}

function checkAddButtonStatus() {
    var condition;
    if (dialog.dbInfoDeck.selectedIndex == 0) {
        condition = !!dialog.dbPath.value;
    } else {
        condition = (dialog.hostname.value && dialog.username.value);
    }
    disableItem(dialog.okButton, !condition);
}

function handleHasPasswordClick(checkbox) {
    disableItem(dialog.password, !checkbox.checked);
    g_origHasPassword = checkbox.checked;
}

function handleShowPassword(checkbox) {
    if (checkbox.checked) {
        dialog.password.removeAttribute('type');
    } else {
        dialog.password.setAttribute('type', 'password');
    }
}

function updateOnPassword() {
    disableItem(dialog.showPassword, dialog.password.value.length == 0);
    if (dialog.password.value.length > 0) {
        dialog.hasPassword.setAttribute('disabled', 'true');
        dialog.hasPassword.checked = true;
    } else {
        dialog.hasPassword.removeAttribute('disabled');
        dialog.hasPassword.checked = g_origHasPassword;
    }
}


function popupMenuFromDBName(dbName) {
    return g_classInfoByName[dbName].index;
}

function getSupportedDBNames() {
    //dump(">> getSupportedDBNames\n");
    const CATEGORY_TO_ENUMERATE = 'komodo-DBX-Preferences'
    var classes = [];
    var categoryManager = Components.classes["@mozilla.org/categorymanager;1"].getService(Components.interfaces.nsICategoryManager);
    var enumerator = categoryManager.enumerateCategory(CATEGORY_TO_ENUMERATE);
    while (enumerator.hasMoreElements()) {
        var item = enumerator.getNext();
        var entry = item.QueryInterface(Components.interfaces.nsISupportsCString).data;
        classes.push(categoryManager.getCategoryEntry(CATEGORY_TO_ENUMERATE, entry));
    };
    var classNames = [];
    g_classInfoByName = {};
    g_dbNameByTypeIdx = [];
    g_isEnabledByName = {};
    g_LoadFailureReason = {};
    var obj;
    for (var i = 0; i < classes.length; i++) {
        try {
            obj = Components.classes[classes[i]].createInstance(Components.interfaces.koIDBXPreference);
        } catch(ex) {
            dump("Failed to load " + classes[i] + ": " + ex + "\n");
            continue;
        }
        classNames.push([obj.displayName.toLowerCase(), obj]);
        g_classInfoByName[obj.displayName] = {koIDBXPreference:obj};
        if (!(g_isEnabledByName[obj.displayName] = obj.is_enabled())) {
            g_LoadFailureReason[obj.displayName] = obj.disabled_reason;
        }
    }
    classNames.sort();
    for (var i = 0; i < classNames.length; i++) {
        g_classInfoByName[classNames[i][1].displayName].index = i;
        g_dbNameByTypeIdx[i] = classNames[i][1].displayName;
    }
    var menupopup = document.getElementById("db_typesPopup");
    while (menupopup.firstChild) {
        menupopup.removeChild(menupopup.firstChild);
    }
    menupopup.addEventListener('select', on_db_typesPopup_click, true);
    menupopup.addEventListener('click', on_db_typesPopup_click, true);
    menupopup.addEventListener('command', on_db_typesPopup_click, true);
    for (var i = 0; i < classNames.length; i++) {
        var menuitem = document.createElement('menuitem');
        var displayName = classNames[i][1].displayName;
        menuitem.setAttribute('label', displayName);
        menuitem.setAttribute('value', displayName); // Move to name
        if (!g_isEnabledByName[displayName]) {
            menuitem.setAttribute('style', "color: red;"); // Move to name
            menuitem.setAttribute('_ko_disabled', 'true');
        }
        menupopup.appendChild(menuitem);
    }
    //dump("<< getSupportedDBNames\n");
}

function on_db_typesPopup_click(event) {
    //dump("on_db_typesPopup_click fired: event: " + event.type + "\n");
    var menuitem = event.originalTarget;
    if (menuitem.nodeName != 'menuitem') {
        /*
        dump("Didn't click on menuitem, clicked on "
             + menuitem.nodeName
             + "\n");
        */
        return;
    }
    if (menuitem.disabled) {
        // We already gave this message.
        return;
    }
    var dbName = menuitem.getAttribute('label');
    if (!g_isEnabledByName[dbName]) {
        //dump("**************** database " + dbName + " is disabled\n");
        if (event.type == 'click') {
            menuitem.setAttribute('disabled', 'true');
            var selItem = dialog.db_types.selectedItem;
            //dump("current selected item: " + selItem.getAttribute('label') + "\n");
            setTimeout(function() {
                    /*
                    dump("About to restore dialog.db_types.selectedItem from "
                         + dialog.db_types.selectedItem.getAttribute('label')
                         + " to "
                         + selItem.getAttribute('label')
                         + "\n");
                    */
                    dialog.db_types.selectedItem = selItem;
                    //dump("... done\n");
                    if (!_bundle) {
                        _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                            .getService(Components.interfaces.nsIStringBundleService)
                            .createBundle("chrome://dbexplorer/locale/dbexplorer.properties");
                    }
                    var msg = _bundle.formatStringFromName("databaseAdapterNotAvail.format",
                           [dbName, g_LoadFailureReason[dbName]], 2);
                    ko.dialogs.alert(msg);
                }, 0);
        }
        event.cancelBubble = true;
        event.stopPropagation();
        event.preventDefault();
    }
    gEvents.push(event);
}

function dbIsFile(dbName) {
    return g_classInfoByName[dbName].koIDBXPreference.fileBased;
}

function browseToFile(textFieldID) {
    var field = document.getElementById(textFieldID);
    var currentFileName = field.value;
    var osPath = Components.classes["@activestate.com/koOsPath;1"].getService(Components.interfaces.koIOsPath);
    var currentDir =  currentFileName ? osPath.dirname(currentFileName) : null;
    //XXX add a prompt, and register its string
    var path = ko.filepicker.browseForFile(currentDir);
    if (path) {
        field.value = path;
    }
    checkAddButtonStatus();
}

function expanduser(path) {
    var osSvc = Components.classes["@activestate.com/koOsPath;1"].
        getService(Components.interfaces.koIOsPath);
    return osSvc.expanduser(path);
}

function _connectionURIFromDialog() {
    var db_type = dialog.db_types.value;
    var uri = "dbexplorer://" + db_type;
    if (dbIsFile(db_type)) {
        uri += "/" + expanduser(dialog.dbPath.value);
    } else {
        uri += "/" + dialog.hostname.value;
        if (dialog.port.value.length > 0) {
            uri += ":" + dialog.port.value;
        }
        uri += "/" + dialog.username.value;
    }
    return uri;
}

function _connectionURIFromPrefObj() {
    var db_type = prefObj.db_type;
    var uri = "dbexplorer://" + db_type;
    if (dbIsFile(db_type)) {
        uri += "/" + prefObj.dbPath;
    } else {
        uri += "/" + prefObj.hostname;
        if (prefObj.port.length != 0) {
            uri += ":" + prefObj.port;
        }
        uri += "/" + prefObj.username;
    }
    return uri;
}

function settingsAreDifferent() {
    if (g_classInfoByName[prefObj.db_type].index !=
        dialog.db_types.selectedIndex) {
            return true;
    }
    if (prefObj.fileBased) {
        if (dialog.dbInfoDeck.selectedIndex == 1) return true;
        return expanduser(dialog.dbPath.value) != prefObj.dbPath;
    }
    var attrs = ['hostname', 'port', 'username'];
    for (var attr, i = 0; attr = attrs[i]; i++) {
        if (dialog[attr].value != prefObj[attr]) {
            return true;
        }
    }
    if (prefObj.hasPassword) {
        if (!dialog.hasPassword.checked) {
            return true;
        }
        if (prefObj.password != dialog.password.value) {
            return true;
        }
    } else {
        if (dialog.hasPassword.checked) {
            return true;
        }
    }
    return false;
}

function saveChangedConnectionsToPrefs() {
    var origConnectionURI = _connectionURIFromPrefObj(prefObj);
    var newConnectionURI = _connectionURIFromDialog();

    if (origConnectionURI != newConnectionURI) {
        // delete the old, add the new
        try {
            mainObj.view.removeConnection(g_rowNum);
            saveDBConnectionsToPrefs();
        } catch(ex) {
            prefDBExplorerLog.error("saveChangedConnectionsToPrefs: exception: " + ex + "\n");
        }
        return true;
    }
    
    if (!settingsAreDifferent()) {
        return true;
    }

    var cdcPrefList;
    if (prefset.hasPref('currentDatabaseConnections')) {
        cdcPrefList = prefset.getPref('currentDatabaseConnections');
    } else {
        cdcPrefList = Components.classes['@activestate.com/koPreferenceSet;1'].
                                     createInstance(Components.interfaces.koIPreferenceSet);
        prefset.setPref('currentDatabaseConnections', cdcPrefList);
    }
    var currentPrefObj = cdcPrefList.getPref(origConnectionURI);
    if (!dbIsFile(dialog.db_types.value)) {
        // Save the password in the login manager, not a plain-text file.
        var hasPassword = dialog.hasPassword.checked;
        currentPrefObj.setBooleanPref('hasPassword', hasPassword);
        if (hasPassword) {
            var dbxLoginInfo = _createDbxLoginInfo();
            var dbxLoginManager = Components.classes['@activestate.com/KoDBXLoginManager;1'].
                createInstance(Components.interfaces.koIDBXLoginManager);
            try {
                dbxLoginManager.updatePasswordField(dbxLoginInfo);
            } catch(ex) {
                prefDBExplorerLog.exception("addLoginConnectionInfo: " + ex + "\n");
            }
            mainObj.view.updatePassword(g_rowNum, dialog.password.value);
        }
    }
    return true;
}

function _createDbxLoginInfo() {
    var dbxLoginInfo = Components.classes['@activestate.com/KoDBXLoginInfo;1'].
        createInstance(Components.interfaces.koIDBXLoginInfo);
    dbxLoginInfo.init(dialog.db_types.value,
                      dialog.hostname.value,
                      dialog.port.value,
                      dialog.username.value,
                      dialog.password.value);
    return dbxLoginInfo;
}

function saveDBConnectionsToPrefs() {
    var cdcPrefList;
    if (prefset.hasPref('currentDatabaseConnections')) {
        cdcPrefList = prefset.getPref('currentDatabaseConnections');
    } else {
        cdcPrefList = Components.classes['@activestate.com/koPreferenceSet;1'].
                                     createInstance(Components.interfaces.koIPreferenceSet);
        prefset.setPref('currentDatabaseConnections', cdcPrefList);
    }
    var connectionURI = _connectionURIFromDialog();
    if (cdcPrefList.hasPref(connectionURI)) {
        showError("This connection is already in the preferences");
        return false;
    }
    var prefObj = Components.classes['@activestate.com/koPreferenceSet;1'].
                                 createInstance(Components.interfaces.koIPreferenceSet);
    prefObj.setStringPref('db_type', dialog.db_types.value);
    if (dbIsFile(dialog.db_types.value)) {
        prefObj.setStringPref("dbPath", expanduser(dialog.dbPath.value));
    } else {
        var fieldName, val, fields = ["hostname", "port", "username"];
        if (!dialog.socket.hasAttribute("disabled")) {
            fields.push("socket");
        }
        for (var i = 0; i < fields.length; i++) {
            fieldName = fields[i];
            val = dialog[fieldName].value
            prefObj.setStringPref(fieldName, val);
        }
        // Save the password in the login manager, not a plain-text file.
        var hasPassword = dialog.hasPassword.checked;
        prefObj.setBooleanPref('hasPassword', hasPassword);
        if (hasPassword) {
            // Use the login manager
            var dbxLoginInfo = _createDbxLoginInfo();
            var dbxLoginManager = Components.classes['@activestate.com/KoDBXLoginManager;1'].
                createInstance(Components.interfaces.koIDBXLoginManager);
            try {
                dbxLoginManager.addLoginConnectionInfo(dbxLoginInfo);
            } catch(ex) {
                dump("addLoginConnectionInfo: " + ex + "\n");
            }
        }
    }
    cdcPrefList.setPref(connectionURI, prefObj);
    // We have to do this because of bug 83916
    prefset.setPref('currentDatabaseConnections', cdcPrefList);
    var dbTreeView = mainObj.view;
    var status = {}, testMessage = {};
    try {
        dbTreeView.testConnection(connectionURI, status, testMessage);
        status = status.value;
        testMessage = testMessage.value;
    } catch(ex) {
        prefDBExplorerLog.exception("testConnection: " + ex);
        status = dbTreeView.TARGET_DATABASE_HAS_ERROR;
        testMessage = ex.toString();
    }
    if (status != dbTreeView.TARGET_DATABASE_OK) {
        var msg;
        if (!_bundle) {
            _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                .getService(Components.interfaces.nsIStringBundleService)
                .createBundle("chrome://dbexplorer/locale/dbexplorer.properties");
        }
        if (status == dbTreeView.TARGET_DATABASE_IS_EMPTY) {
            msg = _bundle.GetStringFromName("The specified database is empty");
        } else {
            msg = _bundle.formatStringFromName("Komodo hit an error condition when trying to connect to this database", [testMessage], 1);
        }
        msg += ". ";
        msg += _bundle.GetStringFromName("Create the entry anyway");
        var res = ko.dialogs.yesNo(msg);
        if (res != "Yes") {
            // Remove the connectionURI from the prefs now
            cdcPrefList.deletePref(connectionURI);
            prefset.setPref('currentDatabaseConnections', cdcPrefList);
            return false;
        }
    }
    mainObj.view.addConnection(connectionURI);
    return true;
}


function showError(msg) {
    var errorMessageNode = document.getElementById('errorMessage');
    while (errorMessageNode.hasChildNodes()) {
        errorMessageNode.removeChild(errorMessageNode.firstChild);
    }
    var textNode = document.createTextNode(msg);
    errorMessageNode.appendChild(textNode);
    document.getElementById('errorMessageBox').collapsed = false;
}

function onSelectDatabaseType(menulist) {
    updateDeckFromDBType(menulist);
    checkAddButtonStatus();
}

function updateDeckFromDBType(menulist) {
    var idx;
    var selItem = menulist.selectedItem;
    var dbName = selItem.getAttribute('label');
    if (!g_isEnabledByName[dbName]) {
        selItem.setAttribute('disabled', 'true');
        // Need to capture this earlier.
        return;
    }
    if (!selItem) {
        idx = 2;
    } else {
        idx = dbIsFile(selItem.value) ? 0 : 1;
    }
    dialog.dbInfoDeck.selectedIndex  = idx;
    if (idx == 1) {
        disableItem(dialog.socket, dbName != "MySQL");
    }
}

function loadDBPath() {
    var currentDir = getDirectoryFromTextObject(dialog.dbPath);
    var dbPath = ko.filepicker.getFolder(currentDir);
    if (dbPath != null) {
        dialog.dbPath.value = dbPath;
    }
}
