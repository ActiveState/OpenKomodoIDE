/* Copyright (c) 2009-2010 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* Publishing window.
 *
 * Usage:
 *  All dialog interaction is done via an object passed in and out as the first
 *  window argument: window.arguments[0].
 *      .settings       The koIPublishingSettings.
 *      .callbackFn     Callback handler for when the window is closed.
 *      .title          (optional) the title to be set on the window.
 *
 *  On return window.arguments[0] has:
 *      .retval         "OK" or "Cancel"
 *
 * Dev Notes: How this dialog works.
 *
 * The dialog will initially display the settings and then will asynchronously
 * check the remote files to the local files to see what has changed.
 * 
 */

var log = ko.logging.getLogger("publishing.dialog");
//log.setLevel(ko.logging.LOG_DEBUG);
var $ = require("ko/dom").window(require("ko/windows").getMostRecent());
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
const {Services} = Components.utils.import("resource://gre/modules/Services.jsm", {});

var _is_windows_os = navigator.platform.toLowerCase().substr(0, 3) == "win";

    // Localization.
var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                .getService(Components.interfaces.nsIStringBundleService)
                .createBundle("chrome://publishing/locale/publish.properties");
    // The list of available publishing settings.
var gPublishSettingsList = [];
    // The selected publishing settings.
var gPublishSettings = null;
    // Type of publishing dialog - controls layout and actions performed.
var gDialogType = "push";
    // Common base uri for all files in the gSyncTreeView.
var gBaseUri = null;
    /**
     * The running synchronization operation.
     * @type Components.interfaces.koIPublishingOperation
     */
var gPublishingOp = null;
    // Tree view instance (SyncTreeView).
var gSyncTreeView = null;
    // Temporary directory path where remote files will be downloaded to.
var gTempDir = null;
    // Object to access dialog elements so they are only ever loaded once
var elems = {};

    // Progress state.
const STATE_INITIAL = 0;
const STATE_FETCHING_CHANGES = 1;
const STATE_DISPLAYING_CHANGES = 2;
const STATE_DIFF_DOWNLOADING = 3;SYNC_CONFLICT_REMOVED_LOCALLY_MODIFIED_REMOTELY
const STATE_DOWNLOADING = 4;
const STATE_UPLOADING = 5;
const STATE_FINISHED = 6;
var gState = STATE_INITIAL;

// Upload States ie. require a change from the server to be made locally
const SYNC_REMOTE_DIR_ADDED = Components.interfaces.koISynchronizationCallback.SYNC_REMOTE_DIR_ADDED;
const SYNC_REMOTE_DIR_REMOVED = Components.interfaces.koISynchronizationCallback.SYNC_REMOTE_DIR_REMOVED;
const SYNC_REMOTE_FILE_ADDED = Components.interfaces.koISynchronizationCallback.SYNC_REMOTE_FILE_ADDED;
const SYNC_REMOTE_FILE_MODIFIED = Components.interfaces.koISynchronizationCallback.SYNC_REMOTE_FILE_MODIFIED;
const SYNC_REMOTE_FILE_REMOVED = Components.interfaces.koISynchronizationCallback.SYNC_REMOTE_FILE_REMOVED;
const SYNC_CONFLICT_RESOLVED_DOWNLOAD = Components.interfaces.koISynchronizationCallback.SYNC_CONFLICT_RESOLVED_DOWNLOAD;
// Download States
const SYNC_LOCAL_DIR_ADDED = Components.interfaces.koISynchronizationCallback.SYNC_LOCAL_DIR_ADDED;
const SYNC_LOCAL_DIR_REMOVED = Components.interfaces.koISynchronizationCallback.SYNC_LOCAL_DIR_REMOVED;
const SYNC_LOCAL_FILE_ADDED = Components.interfaces.koISynchronizationCallback.SYNC_LOCAL_FILE_ADDED;
const SYNC_LOCAL_FILE_MODIFIED = Components.interfaces.koISynchronizationCallback.SYNC_LOCAL_FILE_MODIFIED;
const SYNC_LOCAL_FILE_REMOVED = Components.interfaces.koISynchronizationCallback.SYNC_LOCAL_FILE_REMOVED;
const SYNC_CONFLICT_RESOLVED_UPLOAD = Components.interfaces.koISynchronizationCallback.SYNC_CONFLICT_RESOLVED_UPLOAD;

const SYNC_CONFLICT_BOTH_MODIFIED = Components.interfaces.koISynchronizationCallback.SYNC_CONFLICT_BOTH_MODIFIED;
const SYNC_CONFLICT_REMOVED_REMOTELY_MODIFIED_LOCALLY = Components.interfaces.koISynchronizationCallback.SYNC_CONFLICT_REMOVED_REMOTELY_MODIFIED_LOCALLY;
const SYNC_CONFLICT_REMOVED_LOCALLY_MODIFIED_REMOTELY = Components.interfaces.koISynchronizationCallback.SYNC_CONFLICT_REMOVED_LOCALLY_MODIFIED_REMOTELY;

const DOWNLOAD_STATES =
[
    SYNC_REMOTE_DIR_ADDED,
    SYNC_REMOTE_DIR_REMOVED,
    SYNC_REMOTE_FILE_ADDED,
    SYNC_REMOTE_FILE_MODIFIED,
    SYNC_REMOTE_FILE_REMOVED,
    SYNC_CONFLICT_RESOLVED_DOWNLOAD,
]

const UPLOAD_STATES =
[
    SYNC_LOCAL_DIR_ADDED,
    SYNC_LOCAL_DIR_REMOVED,
    SYNC_LOCAL_FILE_ADDED,
    SYNC_LOCAL_FILE_MODIFIED,
    SYNC_LOCAL_FILE_REMOVED,
    SYNC_CONFLICT_RESOLVED_UPLOAD,
]

    // File transfer states
const TRANSFER_STATE_PENDING   = 0;
const TRANSFER_STATE_RUNNING   = 1;
const TRANSFER_STATE_DOWNLOADED = 2;
const TRANSFER_STATE_COMPLETED = 3;
const TRANSFER_STATE_FAILED    = 4;
    
/**
 * Custom koSyncxxxItem classes, used to populate the tree view.
 */
function koSyncBaseItem(status, relPath, checked) {
    this.status = status;
    this.relativePath = relPath;
    this.isChecked = checked;
    this.transferStatus = TRANSFER_STATE_PENDING;
};
koSyncBaseItem.prototype.getStatusAsString = function() {
    switch (this.status) {
        case SYNC_REMOTE_DIR_ADDED:
            return "Remote directory was added";
        case SYNC_REMOTE_FILE_ADDED:
            return "Remote file was added";
    }
    return "";
}


// Changed files between remote and local.
function koSyncFileItem(syncType, relpath) {
    koSyncBaseItem.apply(this, [this.getStatusAsString(syncType), relpath, true]);
    this.syncType = syncType;
    this.hadConflictType = 0;
};
koSyncFileItem.prototype = new koSyncBaseItem();
koSyncFileItem.prototype.contructor = koSyncFileItem;
koSyncFileItem.prototype.hasConflict = function() {
    return (this.syncType >= SYNC_CONFLICT_BOTH_MODIFIED &&
            this.syncType <= SYNC_CONFLICT_REMOVED_LOCALLY_MODIFIED_REMOTELY);
}
koSyncFileItem.prototype.hadConflict = function() {
    return this.hadConflictType;
}
koSyncFileItem.prototype.markFileTransferStarting = function() {
    this.transferStatus = TRANSFER_STATE_RUNNING;
}
koSyncFileItem.prototype.markFileTransferCompleted = function(newState) {
    if (!newState) {
        this.transferStatus = TRANSFER_STATE_COMPLETED;
    } else {
        this.transferStatus = newState;
    }
}
koSyncFileItem.prototype.markFileTransferFailed = function(message) {
    this.transferStatus = TRANSFER_STATE_FAILED;
    this.status = message;
}
koSyncFileItem.prototype.resolveConflict = function(resolution) {
    if (resolution == "local wins") {
        this.hadConflictType = this.syncType;
        this.syncType = SYNC_LOCAL_FILE_MODIFIED;
    } else {
        this.syncType = SYNC_REMOTE_FILE_MODIFIED;
    }
}

koSyncFileItem.prototype.forceUpload = function() {
    // This just seems like it should be done
    // Not sure why yet
    if(this.hasConflict())
    {
        this.resolveConflict("local wins");
    }
    this.syncType = SYNC_CONFLICT_RESOLVED_UPLOAD;
}

koSyncFileItem.prototype.forceDownload = function() {
    if(this.hasConflict())
    {
        this.resolveConflict("remote wins");
    }
    this.syncType = SYNC_CONFLICT_RESOLVED_DOWNLOAD;
}



// Item to show that the sync status is being asynchronously loaded.

function koSyncLoadingItem(asyncOp) {
    var message = _bundle.GetStringFromName("loadingMessage");
    koSyncBaseItem.apply(this, ["", message, false]);
    this.asyncOp = asyncOp;
    this.aborted = false;
};
koSyncLoadingItem.prototype = new koSyncBaseItem();
koSyncLoadingItem.prototype.contructor = koSyncLoadingItem;
koSyncLoadingItem.prototype.wasAborted = function() {
    return this.aborted;
}
koSyncLoadingItem.prototype.abort = function() {
    if (!this.aborted) {
        this.aborted = true;
        if (this.asyncOp) {
            this.asyncOp.stop();
        }
    }
}

// Item to show that an event in the tree.
function koSyncLogItem(level, message) {
    koSyncBaseItem.apply(this, ["", message, false]);
    this.level = level;
};
koSyncLogItem.prototype = new koSyncBaseItem();
koSyncLogItem.prototype.contructor = koSyncLogItem;
koSyncLogItem.INFO = ko.logging.LOG_INFO;
koSyncLogItem.WARN = ko.logging.LOG_WARN;
koSyncLogItem.ERROR = ko.logging.LOG_ERROR;



/**
 * TreeView for the commit dialog.
 */
function SyncTreeView(initial_rows) {
        // Call the parent initializer.
    xtk.dataTreeView.apply(this, [initial_rows]);
        // Only show the items marked as "checked" in the tree.
    this.onlyShowCheckedItems = false;
        // Callback handler for on modify notifications.
    this.onModifiedCallback = null;
        // Atom service is used to set the tree cell css properties.
    this._atomService = Components.classes["@mozilla.org/atom-service;1"].
                            getService(Components.interfaces.nsIAtomService);

    // Mozilla 22 changed the way tree properties work.
    if ((parseInt(Services.appinfo.platformVersion)) < 22) {
        this.getCellProperties = this.getCellPropertiesMoz21AndOlder;
    }
};
SyncTreeView.prototype = new xtk.dataTreeView();
SyncTreeView.prototype.contructor = SyncTreeView;
SyncTreeView.prototype.getCellText = function(row, column)
{
    if (column.id == "urls-column-name") {
        return this.rows[row].relativePath;
    }
    if (column.id == "urls-column-action-text") {
        var syncItem = this.rows[row];
        if (!(syncItem instanceof koSyncFileItem)) {
            return "";
        }
        switch (syncItem.syncType) {
            case SYNC_REMOTE_DIR_ADDED:
                return "Remote folder was added, so will copy it locally";
            case SYNC_REMOTE_DIR_REMOVED:
                return "Remote folder was removed, so local folder will be removed";
            case SYNC_REMOTE_FILE_ADDED:
                return "Remote file added, so will copy it locally";
            case SYNC_REMOTE_FILE_MODIFIED:
                return "Remote file modified, so will copy it locally";
            case SYNC_REMOTE_FILE_REMOVED:
                return "Remote file was removed, so local file will be removed";

            case SYNC_LOCAL_DIR_ADDED:
                return "Local folder was added, so will copy to remote location";
            case SYNC_LOCAL_DIR_REMOVED:
                return "Local folder was removed, so remote folder will be removed";
            case SYNC_LOCAL_FILE_ADDED:
                return "Local file was added, so will copy it remotely";
            case SYNC_LOCAL_FILE_MODIFIED:
                return "Local file was modified, so will copy to remote location";
            case SYNC_LOCAL_FILE_REMOVED:
                return "Local file was removed, so remote file will be removed";
            
            case SYNC_CONFLICT_BOTH_MODIFIED:
                return "Remote and Local are modified.  Resolve conflict.";
            case SYNC_CONFLICT_REMOVED_LOCALLY_MODIFIED_REMOTELY:
                return "Local was deleted.  Remote was modified.  Resolve conflict.";
            case SYNC_CONFLICT_REMOVED_REMOTELY_MODIFIED_LOCALLY:
                return "Remote was deleted.  Local was modified.  Resolve conflict.";
            
            case SYNC_CONFLICT_RESOLVED_UPLOAD:
                return "Forcing Upload";
            case SYNC_CONFLICT_RESOLVED_DOWNLOAD:
                return "Forcing Download";
        }
    }
    return "";
};
SyncTreeView.prototype.isEditable = function(row, column)

{
    return column.id == "urls-column-checkbox";
};
SyncTreeView.prototype.getCellValue = function(row, column)
{
    if (column.id == "urls-column-checkbox") {
        return this.rows[row].isChecked;
    }
    return null;
};
SyncTreeView.prototype.setCellValue = function(row, column, value)
{
    if (column.id == "urls-column-checkbox") {
        if (value.toLowerCase() == "false") {
            this.rows[row].isChecked = false;
        } else {
            this.rows[row].isChecked = true;
        }
        this.tree.invalidateRow(row);
        if (this.onModifiedCallback) {
            this.onModifiedCallback();
        }
    }
    //Use this to allow icons to be clickable to swap state rather than context menu
};

SyncTreeView.prototype.getCellProperties = function(row, column)
{
    var properties = [];
    if (this.rows[row] instanceof koSyncLoadingItem) {
        if (column.id == "urls-column-status") {
            return "syncLoadingIcon";
        } else {
            return "syncLoading";
        }
    }

    if (this.rows[row] instanceof koSyncLogItem) {
        let level = this.rows[row].level;
        if (column.id == "urls-column-checkbox") {
            return "nocheckbox";
        } else if (column.id == "urls-column-status") {
            if (level == koSyncLogItem.ERROR) {
                return "syncErrorIcon";
            } else if (level == koSyncLogItem.WARN) {
                return "syncWarnIcon";
            } else {
                return "syncInfoIcon";
            }
        } else {
            if (level == koSyncLogItem.ERROR) {
                return "syncError";
            }
        }
        return "";
    }

   
    // Text field styling for the row
    var syncType = this.rows[row].syncType;
    if (this.rows[row].hasConflict()) {
        properties.push("syncConflict");
    } else if (syncType == SYNC_REMOTE_DIR_ADDED ||
               syncType == SYNC_REMOTE_FILE_ADDED ||
               syncType == SYNC_LOCAL_DIR_ADDED ||
               syncType == SYNC_LOCAL_FILE_ADDED) {
        properties.push("syncAdded");
    } else if (syncType == SYNC_REMOTE_DIR_REMOVED ||
               syncType == SYNC_LOCAL_DIR_REMOVED ||
               syncType == SYNC_REMOTE_FILE_REMOVED ||
               syncType == SYNC_LOCAL_FILE_REMOVED) {
        properties.push("syncRemove");
    } else if (syncType == SYNC_REMOTE_FILE_MODIFIED ||
               syncType == SYNC_LOCAL_FILE_MODIFIED) {
        properties.push("syncModified");
    } else {
        properties.push("syncUnknown");
    }

    
    // State icon styling
    if (column.id == "urls-column-status") {
        if (this.rows[row].hasConflict()) {
            properties.push("syncConflictIcon");
            
        } else if (syncType == SYNC_REMOTE_FILE_ADDED ||
                   syncType == SYNC_LOCAL_FILE_ADDED) {
            properties.push("syncAddFile");
            
        } else if (syncType == SYNC_REMOTE_FILE_MODIFIED ||
                   syncType == SYNC_LOCAL_FILE_MODIFIED) {
            properties.push("syncModifyFile");
            
        } else if (syncType == SYNC_REMOTE_FILE_REMOVED ||
                   syncType == SYNC_LOCAL_FILE_REMOVED) {
            properties.push("syncRemoveFile");
            
        } else if (syncType == SYNC_REMOTE_DIR_ADDED ||
                   syncType == SYNC_LOCAL_DIR_ADDED) {
            properties.push("syncAddFolder");
            
        }  else if (syncType == SYNC_REMOTE_DIR_REMOVED ||
                   syncType == SYNC_LOCAL_DIR_REMOVED) {
            properties.push("syncRemoveFolder");
        } else {
            properties.push("syncUnknown");
        }


        // Add any out of sync details.
        if (this.rows[row].isOutOfSync) {
            properties.push("syncSync");
        }

    } else if (column.id == "urls-column-type") {
        var syncType = this.rows[row].syncType;
        switch (syncType) {
            case SYNC_REMOTE_DIR_ADDED:
            case SYNC_REMOTE_DIR_REMOVED:
                properties.push("syncRemoteFolder");
                break;

            case SYNC_REMOTE_FILE_ADDED:
            case SYNC_REMOTE_FILE_MODIFIED:
            case SYNC_REMOTE_FILE_REMOVED:
            case SYNC_CONFLICT_RESOLVED_DOWNLOAD:
                properties.push("syncRemoteFile");
                break;

            case SYNC_LOCAL_DIR_ADDED:
            case SYNC_LOCAL_DIR_REMOVED:
                properties.push("syncLocalFolder");
                break;

            case SYNC_LOCAL_FILE_ADDED:
            case SYNC_LOCAL_FILE_MODIFIED:
            case SYNC_LOCAL_FILE_REMOVED:
            case SYNC_CONFLICT_BOTH_MODIFIED:
            case SYNC_CONFLICT_REMOVED_LOCALLY_MODIFIED_REMOTELY:
            case SYNC_CONFLICT_REMOVED_REMOTELY_MODIFIED_LOCALLY:
            case SYNC_CONFLICT_RESOLVED_UPLOAD:
                properties.push("syncLocalFile");
                break;

            default:
                properties.push("syncUnknown");
                break;
        }

    } else if (column.id == "urls-column-transfer-state") {
        var transferStatus = this.rows[row].transferStatus;
        if (transferStatus == TRANSFER_STATE_RUNNING) {
            properties.push("syncTransferInProgress");
        } else if (transferStatus == TRANSFER_STATE_DOWNLOADED) {
            // properties.push("syncTransferDownloaded");
        } else if (transferStatus == TRANSFER_STATE_COMPLETED) {
            properties.push("syncTransferCompleted");
        } else if (transferStatus == TRANSFER_STATE_FAILED) {
            properties.push("syncError");
        }
    }
    return properties.join(" ");
};
SyncTreeView.prototype.getCellPropertiesMoz21AndOlder = function(row, column, properties)
{
    if (this.rows[row] instanceof koSyncLoadingItem) {
        if (column.id == "urls-column-status") {
            properties.AppendElement(this._atomService.getAtom("syncLoadingIcon"));
        } else {
            properties.AppendElement(this._atomService.getAtom("syncLoading"));
        }
        return;

    }

    if (this.rows[row] instanceof koSyncLogItem) {
        let level = this.rows[row].level;
        if (column.id == "urls-column-checkbox") {
            properties.AppendElement(this._atomService.getAtom("nocheckbox"));
        } else if (column.id == "urls-column-status") {
            if (level == koSyncLogItem.ERROR) {
                properties.AppendElement(this._atomService.getAtom("syncErrorIcon"));
            } else if (level == koSyncLogItem.WARN) {
                properties.AppendElement(this._atomService.getAtom("syncWarnIcon"));
            } else {
                properties.AppendElement(this._atomService.getAtom("syncInfoIcon"));
            }
        } else {
            if (level == koSyncLogItem.ERROR) {
                properties.AppendElement(this._atomService.getAtom("syncError"));
            }
        }
        return;
    }

    if (this.rows[row].hasConflict()) {
        properties.AppendElement(this._atomService.getAtom("syncConflict"));
    }

    if (column.id == "urls-column-status") {
        // Set the sync icon for the status column.
        var syncType = this.rows[row].syncType;
        if (this.rows[row].hasConflict()) {
            properties.AppendElement(this._atomService.getAtom("syncConflictIcon"));
        } else if (syncType == SYNC_REMOTE_DIR_ADDED) {
            properties.AppendElement(this._atomService.getAtom("syncRemoteAddFolder"));
        } else if (syncType == SYNC_REMOTE_DIR_REMOVED) {
            properties.AppendElement(this._atomService.getAtom("syncRemoteRemoveFolder"));

        } else if (syncType == SYNC_REMOTE_FILE_ADDED) {
            properties.AppendElement(this._atomService.getAtom("syncRemoteAddFile"));
        } else if (syncType == SYNC_REMOTE_FILE_MODIFIED) {
            properties.AppendElement(this._atomService.getAtom("syncRemoteModifyFile"));
        } else if (syncType == SYNC_REMOTE_FILE_REMOVED) {
            properties.AppendElement(this._atomService.getAtom("syncRemoteRemoveFile"));

        } else if (syncType == SYNC_LOCAL_DIR_ADDED) {
            properties.AppendElement(this._atomService.getAtom("syncLocalAddFolder"));
        } else if (syncType == SYNC_LOCAL_DIR_REMOVED) {
            properties.AppendElement(this._atomService.getAtom("syncLocalRemoveFolder"));

        } else if (syncType == SYNC_LOCAL_FILE_ADDED) {
            properties.AppendElement(this._atomService.getAtom("syncLocalAddFile"));
        } else if (syncType == SYNC_LOCAL_FILE_MODIFIED) {
            properties.AppendElement(this._atomService.getAtom("syncLocalModifyFile"));
        } else if (syncType == SYNC_LOCAL_FILE_REMOVED) {
            properties.AppendElement(this._atomService.getAtom("syncLocalRemoveFile"));

        } else {
            properties.AppendElement(this._atomService.getAtom("syncUnknown"));
        }

        // Add any out of sync details.
        if (this.rows[row].isOutOfSync) {
            properties.AppendElement(this._atomService.getAtom("syncSync"));
        }

    } else if (column.id == "urls-column-type") {
        var syncType = this.rows[row].syncType;
        switch (syncType) {
            case SYNC_REMOTE_DIR_ADDED:
            case SYNC_REMOTE_DIR_REMOVED:
                properties.AppendElement(this._atomService.getAtom("syncRemoteFolder"));
                break;

            case SYNC_REMOTE_FILE_ADDED:
            case SYNC_REMOTE_FILE_MODIFIED:
            case SYNC_REMOTE_FILE_REMOVED:
                properties.AppendElement(this._atomService.getAtom("syncRemoteFile"));
                break;

            case SYNC_LOCAL_DIR_ADDED:
            case SYNC_LOCAL_DIR_REMOVED:
                properties.AppendElement(this._atomService.getAtom("syncLocalFolder"));
                break;

            case SYNC_LOCAL_FILE_ADDED:
            case SYNC_LOCAL_FILE_MODIFIED:
            case SYNC_LOCAL_FILE_REMOVED:
            case SYNC_CONFLICT_BOTH_MODIFIED:
            case SYNC_CONFLICT_REMOVED_LOCALLY_MODIFIED_REMOTELY:
            case SYNC_CONFLICT_REMOVED_REMOTELY_MODIFIED_LOCALLY:
                properties.AppendElement(this._atomService.getAtom("syncLocalFile"));
                break;

            default:
                properties.AppendElement(this._atomService.getAtom("syncUnknown"));
                break;
        }

    } else if (column.id == "urls-column-transfer-state") {
        var transferStatus = this.rows[row].transferStatus;
        if (transferStatus == TRANSFER_STATE_RUNNING) {
            properties.AppendElement(this._atomService.getAtom("syncTransferInProgress"));
        } else if (transferStatus == TRANSFER_STATE_DOWNLOADED) {
            // properties.AppendElement(this._atomService.getAtom("syncTransferDownloaded"));
        } else if (transferStatus == TRANSFER_STATE_COMPLETED) {
            properties.AppendElement(this._atomService.getAtom("syncTransferCompleted"));
        } else if (transferStatus == TRANSFER_STATE_FAILED) {
            properties.AppendElement(this._atomService.getAtom("syncError"));
        }
    }
};

SyncTreeView.prototype.setTreeItems = function(syncItems)
{
    // Make a copy of the list.
    this.rows = syncItems.concat();
    this.clearSortIndicators();
};

SyncTreeView.prototype.ensureItemVisible = function(item)
{
    var idx = this._rows.indexOf(item);
    if (idx >= 0) {
        this.tree.treeBoxObject.ensureRowIsVisible(idx);
    }
};

SyncTreeView.prototype.invalidateSyncItem = function(syncItem, ensureRowVisible)
{
    // Make a copy of the list.
    var idx = this.rows.indexOf(syncItem);
    if (idx >= 0) {
        this.tree.invalidateRow(idx);
        if (ensureRowVisible) {
            this.tree.ensureRowIsVisible(idx);
        }
    }
};

SyncTreeView.prototype.appendRowItems = function(items)
{
    // Make a copy of the list.
    var prevRowCount = this.rowCount;
    this._rows = this._rows.concat(items);
    this.tree.rowCountChanged(prevRowCount, items.length);
};

SyncTreeView.prototype.appendRowItem = function(item, ensureRowVisible)
{
    // Make a copy of the list.
    var prevRowCount = this.rowCount;
    this._rows.push(item);
    this.tree.rowCountChanged(prevRowCount, 1);
    if (ensureRowVisible) {
        this.tree.ensureRowIsVisible(prevRowCount);
    }
};

SyncTreeView.prototype.removeRowItem = function(item)
{
    // Make a copy of the list.
    var idx = this._rows.indexOf(item);
    if (idx >= 0) {
        this._rows.splice(idx, 1);
        this.tree.rowCountChanged(idx, -1);
    }
};

SyncTreeView.prototype.forceItemUpload = function(item)
{
    // Don't do anything if an upload action is already set
    // Also you can't "upload" if the change is an added remote.
    // Nothing is tracked locally so there is nothing to upload
    if ( UPLOAD_STATES.indexOf(item.syncType) >= 0 ||
        item.syncType == SYNC_REMOTE_DIR_ADDED ||
        item.syncType == SYNC_REMOTE_FILE_ADDED) {
        // XXX This should warn the user nothing happened and why.
        // Currently doc'd to clarify this
        return;
    }
    item.forceUpload();
    this.invalidateSyncItem(item);
};

SyncTreeView.prototype.forceItemDownload = function(item)
{
    // Don't do anything if download action is already set
    if (DOWNLOAD_STATES.indexOf(item.syncType) >= 0 ||
        item.syncType == SYNC_LOCAL_DIR_ADDED ||
        item.syncType == SYNC_LOCAL_FILE_ADDED) {
        // XXX This should warn the user nothing happened and why.
        // Currenlty doc'd to clarify this
        return;
    }
    item.forceDownload();
    this.invalidateSyncItem(item);
};

SyncTreeView.prototype.resolveConflictForItem = function(item, resolution)
{
    item.resolveConflict(resolution);
    this.invalidateSyncItem(item);
};

SyncTreeView.prototype.markFileTransferStarting = function(item)
{
    item.markFileTransferStarting();
    // TODO: If the user has moved the scroll position - we should not use
    //       ensure visible.
    this.invalidateSyncItem(item, true /* ensure visible */);
};

/**
 * Get the list of synchronizable files/folders.
 */
SyncTreeView.prototype.GetSyncStatus = function() {
    try {
        this.setTreeItems([]);
        var loadingItem = null;
        var async_callback = {
            "callback": function(result, data) {
                gState = STATE_DISPLAYING_CHANGES;
                log.info("GetSyncStatus:: callback result: " + result);
                gSyncTreeView.removeRowItem(loadingItem);
                if (loadingItem.wasAborted()) {
                    log.debug("GetSyncStatus:: loading item was aborted");
                    // Put an information line in the tree.
                    gSyncTreeView.appendRowItem(new koSyncLogItem(koSyncLogItem.WARN,
                                                      "Status check aborted"),
                                                true);
                    updateUIState();
                    return;
                }
                try {
                    if (result == Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
                        if (gSyncTreeView.rowCount == 0) {
                            setNothingToSynchronize();
                        }
                        // nothing.
                    } else if (result == Components.interfaces.koIAsyncCallback.RESULT_ERROR) {
                        // data should contain the error message then.
                        if (!data) {
                            data = "Asynchronous GetSyncStatus() failed.";
                        }
                        gSyncTreeView.appendRowItem(new koSyncLogItem(koSyncLogItem.ERROR,
                                                                      String(data)),
                                                    true /* to ensure visible */);
                        log.info("GetSyncStatus:: error returned: " + data);
                    }

                    updateUIState();

                } catch (e) {
                    //dump("Exception: " + e + "\n");
                    gSyncTreeView.appendRowItem(new koSyncLogItem(koSyncLogItem.ERROR, e),
                                                true /* to ensure visible */);
                    log.exception(e, "GetSyncStatus:: async callback failed");
                }
            },
            "onProgress": function(label, value) {
                elems.$progressmeter.message(label);
                elems.$progressmeter.percentage(value);
            },
            "notifySyncItem": function(syncType, relpath) {
                // Add a new sync item.
                gSyncTreeView.appendRowItem(new koSyncFileItem(syncType, relpath),
                                            false /* to ensure visible */);
                log.debug("New sync item, syncType: " + syncType + ", relpath: " + relpath);
            },
            "batchNotifySyncItems": function(count_syncTypes, syncTypes,
                                             count_relpaths, relpaths) {
                // Add a new sync item.
                let items = [];
                for (var i=0; i < syncTypes.length; i++) {
                    items.push(new koSyncFileItem(syncTypes[i], relpaths[i]));
                    //log.debug("New sync item, syncType: " + syncTypes[i]  + ", relpath: " + relpaths[i]);
                }
                gSyncTreeView.appendRowItems(items, false /* to ensure visible */);
            }
        };

        var publishingSvc = Components.classes["@activestate.com/koPublishingService;1"].
                        getService(Components.interfaces.koIPublishingService);
        gPublishingOp = publishingSvc.synchronize(gPublishSettings, async_callback);

        loadingItem = new koSyncLoadingItem(gPublishingOp);
        gSyncTreeView.appendRowItem(loadingItem, true /* to ensure visible */);

    } catch(ex) {
        log.exception(ex, "Could not synchronize");
    }
};


function PublishingTreeViewController() {
}
// The following two lines ensure proper inheritance (see Flanagan, p. 144).
PublishingTreeViewController.prototype = new xtk.Controller();
PublishingTreeViewController.prototype.constructor = PublishingTreeViewController;

PublishingTreeViewController.prototype.is_cmd_selectAll_enabled = true;
PublishingTreeViewController.prototype.do_cmd_selectAll = function() {
    gSyncTreeView.selection.selectAll();
}



function OnLoad()
{
    try {
        var dialog = document.getElementById("publish_window");
        loadElems();
        // Have to initialize these services before we launch publishing -
        // otherwise there will be errors and/or a crash when trying to get
        // these services from inside the publishing code (likely related to
        // threading).
        var rfSvc = Components.classes["@activestate.com/koRemoteConnectionService;1"].
                    getService(Components.interfaces.koIRemoteConnectionService);
        var loginmanager = Components.classes["@mozilla.org/login-manager;1"].
                            getService(Components.interfaces.nsILoginManager);
        var logins = {};
        loginmanager.getAllLogins(logins)

        var settings = null;
        var title = null;
        var cbFn = null;
        if ("arguments" in window) {
            settings = window.arguments[0].settings;
            gDialogType = window.arguments[0].type;
            cbFn = window.arguments[0].callbackFn;
            // .title
            if (typeof window.arguments[0].title != "undefined" &&
                window.arguments[0].title != null) {
                document.title = window.arguments[0].title;
            }
        }

        // .settings
        if (typeof(settings) == "undefined" || settings == null) {
            settings = Components.classes["@activestate.com/koPublishingSettings;1"]
                           .createInstance(Components.interfaces.koIPublishingSettings);
        }

        // .type
        if (typeof(gDialogType) == "undefined" || gDialogType == null) {
            gDialogType = "push";
        }

        var syncTree = document.getElementById("sync-tree");
        gSyncTreeView = new SyncTreeView([]);
        gSyncTreeView.onModifiedCallback = updateUIState;

        syncTree.treeBoxObject.view = gSyncTreeView;

        // Controller used to handle "selectAll" in the tree view.
        syncTree.controllers.insertControllerAt(0, new PublishingTreeViewController());

        // Set the dialog to work from the current settings.
        setSyncSettings(settings);

        // Set the deck according to what settings we have.
        if (gDialogType == "new") {
            edit_current_settings();
        } else {
            document.getElementById("publishing_deck").selectedIndex = 1;
        }

        // Load the list of publishing settings into the menulist dropdown.
        reloadSettingsMenulist();
    } catch(ex) {
        log.exception(ex);
    }
}

function loadElems()
{
    elems.nameText = document.getElementById("publishing_name_textbox");
    elems.localPathText = document.getElementById("publishing_localpath_textbox");
    elems.remotePathText = document.getElementById("publishing_remotepath_textbox");
    elems.includePathsText = document.getElementById("publishing_includes_textbox");
    elems.excludePathsText = document.getElementById("publishing_excludes_textbox");
    elems.pushOnSaveCheck = document.getElementById("publishing_autopush_on_save_checkbox");
    elems.validationBox = document.getElementById("validation_errors_groupbox");
    elems.invalidRmtPthText = require("ko/ui/description").create({attributes:{id:"missing_remote_path",style:"color:red;",value:"Missing remote path."}});
    elems.invalidLclPthText = require("ko/ui/description").create({attributes:{id:"missing_local_path",style:"color:red;",value:"Missing local path."}});
    elems.invalidNameText = require("ko/ui/description").create({attributes:{id:"missing_name",style:"color:red;",value:"Missing project name."}});
    elems.validationBox.appendChild(elems.invalidRmtPthText.element);
    elems.validationBox.appendChild(elems.invalidLclPthText.element);
    elems.validationBox.appendChild(elems.invalidNameText.element);
    elems.invalidRmtPthText.$element.hide();
    elems.invalidLclPthText.$element.hide();
    elems.invalidNameText.$element.hide();
    elems.$progressmeter = require("ko/progress").get(true);
    $("#progress_box").append(elems.$progressmeter.element);
    $(elems.validationBox).hide();
}

function fetchChanges() {
    try {
        gState = STATE_FETCHING_CHANGES;
        updateUIState();
        gSyncTreeView.GetSyncStatus();
    } catch(ex) {
        log.exception(ex);
    }
}

function syncRemovedRemoteItems(removedItems,
                                base_local_uri, base_remote_uri) {
    // Remove these items locally.
    var syncItem = null;
    for (var i=0; i < removedItems.length; i++) {
        syncItem = removedItems[i];
        syncItem.markFileTransferStarting();
        gSyncTreeView.invalidateSyncItem(syncItem);
        gPublishingOp.remove_locally(base_local_uri + "/" + syncItem.relativePath,
                                     base_remote_uri + "/" + syncItem.relativePath);
        syncItem.markFileTransferCompleted();
        gSyncTreeView.invalidateSyncItem(syncItem);
    }
}

function doDownload() {
    gState = STATE_DOWNLOADING;
    // Get the list of files/actions and then pass to the worker to do the
    // actual synchronization.
    var remoteSyncItems = _getCheckedItems();
    remoteSyncItems = remoteSyncItems.filter(function(item, index, array) {
                                    return (item instanceof koSyncFileItem) &&
                                           (item.syncType < SYNC_LOCAL_DIR_ADDED) ||
                                           (item.syncType == SYNC_CONFLICT_RESOLVED_DOWNLOAD);
                                 });
    if (!remoteSyncItems.length) {
        doUpload();
        return;
    }

    var downloadItems = remoteSyncItems.filter(function(item, index, array) {
                                    return (item.syncType != SYNC_REMOTE_DIR_REMOVED &&
                                            item.syncType != SYNC_REMOTE_FILE_REMOVED);
                                 });
    var removedItems = remoteSyncItems.filter(function(item, index, array) {
                                    return (item.syncType == SYNC_REMOTE_DIR_REMOVED ||
                                            item.syncType == SYNC_REMOTE_FILE_REMOVED);
                                 });

    // Make a temporary directory to store the remote files and have a
    // worker thread download these files.
    var koFileSvc = Components.classes["@activestate.com/koFileService;1"].
                        getService(Components.interfaces.koIFileService);
    var tempdir = koFileSvc.makeTempDir("", "publishing_");
    var koRemoteTransSvc = Components.classes["@activestate.com/koRemoteTransferService;1"].
                        getService(Components.interfaces.koIRemoteTransferService);
    /**
     * @type {koSyncFileItem}
     */
    var syncItem;
    var remote_uris = [];
    var local_tmp_uris = [];
    var base_remote_uri = gPublishSettings.remote_uri;
    var base_local_uri = gPublishSettings.local_uri;
    var base_local_tmp_uri = ko.uriparse.localPathToURI(tempdir);
    var syncItem_from_remote_uri = {};
    var ruri;
    for (var i=0; i < downloadItems.length; i++) {
        syncItem = downloadItems[i];
        if (!syncItem.relativePath) {
            ruri = base_remote_uri;
            local_tmp_uris.push(base_local_tmp_uri);
        } else {
            ruri = base_remote_uri + "/" + syncItem.relativePath;
            local_tmp_uris.push(base_local_tmp_uri + "/" + syncItem.relativePath);
        }
        remote_uris.push(ruri);
        syncItem_from_remote_uri[ruri] = syncItem;
    }

    elems.$progressmeter.percentage(0);

    var callback = {
        "callback": function(result, data) {
            log.info("doDownload:: callback result: " + result);
            try {
                if (result == Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
                    // Download was successful, now perform the deletions.
                    if (removedItems.length) {
                        syncRemovedRemoteItems(removedItems, base_local_uri, base_remote_uri);
                    }

                    // Update the sync data stored on the settings object.
                    gPublishSettings.updateDownloadSyncData(gPublishingOp);

                    // Now do the uploading part.
                    doUpload();
                } else if (result == Components.interfaces.koIAsyncCallback.RESULT_ERROR) {
                    // data should contain the error message.
                    if (!data) {
                        data = "Asynchronous doDownload() failed.";
                    }
                    gSyncTreeView.appendRowItem(new koSyncLogItem(koSyncLogItem.ERROR,
                                                                  String(data)),
                                                true /* ensure visible */);
                    log.info("doDownload:: error returned: " + data);
                }

            } catch (e) {
                //dump("Exception: " + e + "\n");
                gSyncTreeView.appendRowItem(new koSyncLogItem(koSyncLogItem.ERROR, e),
                                            true /* ensure visible */);
                log.exception(e, "doDownload:: async callback failed");
            } finally {
                updateUIState();
                // Cleanup the temporary directory now.
                koFileSvc.deleteTempDir(tempdir);
            }
        },
        "onProgress": function(msg, value) {
           elems.$progressmeter.message(msg);
            elems.$progressmeter.percentage(value);
        },
        "notifyFileTransferStarting": function(local_uri, remote_uri) {
            let syncItem = syncItem_from_remote_uri[remote_uri];
            if (syncItem) {
                gSyncTreeView.markFileTransferStarting(syncItem);
            }
            //dump("progress: " + value + "\n");
        },
        "notifyFileTransferCompleted": function(local_uri, remote_uri) {
            let syncItem = syncItem_from_remote_uri[remote_uri];
            if (syncItem) {
                // Copy the locally download tmp file to the real location.
                let real_local_uri = base_local_uri + "/" + syncItem.relativePath;
                gPublishingOp.rename_locally(local_uri, real_local_uri);
                syncItem.markFileTransferCompleted();
                gSyncTreeView.invalidateSyncItem(syncItem);
            }
        }
    }

    // Start the asynchronous download worker.
    gPublishingOp = koRemoteTransSvc.download(remote_uris.length, remote_uris,
                                              local_tmp_uris.length, local_tmp_uris,
                                              callback);
    updateUIState();
}

function syncRemovedLocalItems(removedItems,
                               base_local_uri, base_remote_uri) {
    // Remove these items remotely.
    var syncItem = null;
    for (var i=0; i < removedItems.length; i++) {
        syncItem = removedItems[i];
        syncItem.markFileTransferStarting();
        gSyncTreeView.invalidateSyncItem(syncItem);
        gPublishingOp.remove_remotely(base_local_uri + "/" + syncItem.relativePath,
                                      base_remote_uri + "/" + syncItem.relativePath);
        syncItem.markFileTransferCompleted();
        gSyncTreeView.invalidateSyncItem(syncItem);
    }
}

function doUpload() {
    gState = STATE_UPLOADING;
    // Get the list of files/actions and then pass to the worker to do the
    // actual synchronization.
    var localSyncItems = _getCheckedItems().filter(function(item, index, array) {
                                    return (item instanceof koSyncFileItem) &&
                                           (item.syncType >= SYNC_LOCAL_DIR_ADDED) ||
                                           (item.syncType == SYNC_CONFLICT_RESOLVED_UPLOAD);
                                 });
    if (!localSyncItems.length) {
        gState = STATE_FINISHED;
        updateUIState();
        return;
    }

    var uploadItems = localSyncItems.filter(function(item, index, array) {
                                    return (item.syncType != SYNC_LOCAL_DIR_REMOVED &&
                                            item.syncType != SYNC_LOCAL_FILE_REMOVED);
                                 });
    var removedItems = localSyncItems.filter(function(item, index, array) {
                                    return (item.syncType == SYNC_LOCAL_DIR_REMOVED ||
                                            item.syncType == SYNC_LOCAL_FILE_REMOVED);
                                 });

    var koRemoteTransSvc = Components.classes["@activestate.com/koRemoteTransferService;1"].
                        getService(Components.interfaces.koIRemoteTransferService);
    /**
     * @type {koSyncFileItem}
     */
    var syncItem;
    var local_uris = [];
    var remote_uris = [];
    var base_local_uri = gPublishSettings.local_uri;
    var base_remote_uri = gPublishSettings.remote_uri;
    var syncItem_from_local_uri = {};
    var luri;
    for (var i=0; i < uploadItems.length; i++) {
        syncItem = uploadItems[i];
        if (!syncItem.relativePath) {
            luri = base_local_uri;
            remote_uris.push(base_remote_uri);
        } else  {
            luri = base_local_uri + "/" + syncItem.relativePath;
            remote_uris.push(base_remote_uri + "/" + syncItem.relativePath);
        }
        local_uris.push(luri);
        syncItem_from_local_uri[luri] = syncItem;
    }

    elems.$progressmeter.percentage("0");

    var callback = {
        "callback": function(result, data) {
            log.info("doUpload:: callback result: " + result);
            gState = STATE_FINISHED;
            try {
                if (result == Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
                    // Upload was successful, now perform the deletions.
                    if (removedItems.length) {
                        syncRemovedLocalItems(removedItems, base_local_uri, base_remote_uri);
                    }

                    // Update the sync data stored on the settings object.
                    gPublishSettings.updateUploadSyncData(gPublishingOp);
                } else if (result == Components.interfaces.koIAsyncCallback.RESULT_ERROR) {
                    // data should contain the error message.
                    if (!data) {
                        data = "Asynchronous doUpload() failed.";
                    }
                    gSyncTreeView.appendRowItem(new koSyncLogItem(koSyncLogItem.ERROR,
                                                                  String(data)),
                                                true /* ensure visible */);
                    log.info("doUpload:: error returned: " + data);
                }

            } catch (e) {
                //dump("Exception: " + e + "\n");
                gSyncTreeView.appendRowItem(new koSyncLogItem(koSyncLogItem.ERROR, e),
                                            true /* ensure visible */);
                log.exception(e, "doUpload:: async callback failed");
            } finally {
                updateUIState();
            }
        },
        "onProgress": function(msg, value) {
            elems.$progressmeter.message(msg);
            elems.$progressmeter.percentage(value);
        },
        "notifyFileTransferStarting": function(local_uri, remote_uri) {
            let syncItem = syncItem_from_local_uri[local_uri];
            if (syncItem) {
                gSyncTreeView.markFileTransferStarting(syncItem);
            }
        },
        "notifyFileTransferCompleted": function(local_uri, remote_uri) {
            let syncItem = syncItem_from_local_uri[local_uri];
            if (syncItem) {
                syncItem.markFileTransferCompleted();
                gSyncTreeView.invalidateSyncItem(syncItem);
            }
        },
        "notifyFileTransferFailed": function(local_uri, remote_uri, message) {
            let syncItem = syncItem_from_local_uri[local_uri];
            if (syncItem) {
                syncItem.markFileTransferFailed(message);
                gSyncTreeView.invalidateSyncItem(syncItem);
            }
        }
    }

    // Start the asynchronous download worker.
    gPublishingOp = koRemoteTransSvc.upload(local_uris.length, local_uris,
                                            remote_uris.length, remote_uris,
                                            callback);
    updateUIState();
}

function doSynchronize() {
    try {
        var syncItems = _getCheckedItems();
        for (var i=0; i < syncItems.length; i++) {
            if (syncItems[i].hasConflict()) {
                gSyncTreeView.tree.ensureRowIsVisible(i);
                ko.dialogs.alert("Cannot synchronize while there are unresolved conflicts.",
                                 null, "Conflict Detected");
                return;
            }
        }
        doDownload();
    } catch(ex) {
        log.exception(ex);
    }
}

function _getSelectedTreeItems()
{
    var selected_items = [];
    var selection = gSyncTreeView.selection;
    var num_ranges = selection.getRangeCount();
    for (var i = 0; i < num_ranges; ++i) {
        var min = {}, max = {};
        selection.getRangeAt(i, min, max);
        for (var j = min.value; j <= max.value; ++j) {
            selected_items.push(gSyncTreeView.rows[j]);
        }
    }
    return selected_items;
}

function on_keypress(event)
{
    try {
        var syncTree = document.getElementById("sync-tree");
        // We only want to perform an action if there are some selected items in
        // the tree.
        if (syncTree.currentIndex >= 0) {
            if (event.charCode == event.DOM_VK_SPACE) {
                var selection = gSyncTreeView.selection;
                var num_ranges = selection.getRangeCount();
                for (var i = 0; i < num_ranges; ++i) {
                    var min = {}, max = {};
                    selection.getRangeAt(i, min, max);
                    for (var j = min.value; j <= max.value; ++j) {
                        gSyncTreeView.rows[j].isChecked = !gSyncTreeView.rows[j].isChecked;
                    }
                    gSyncTreeView.tree.invalidateRange(min.value, max.value);
                }
                return false;
            }
        }
    } catch(ex) {
        log.exception(ex);
    }
    return true;
}

function _getCheckedItems() {
    return gSyncTreeView.rows.filter(function(item, index, array) {
                            return item.isChecked;
                          });
}

function _getRelativePathsFromItems(items) {
    return items.map(function(item) {
                        return item.relativePath;
                     });
}

function _getCheckedRelativePaths() {
    return _getRelativePathsFromItems(_getCheckedItems());
}

function updateUIState()
{
    var localPathLabel = document.getElementById("localpath");
    var remotePathLabel = document.getElementById("remotepath");
    var abortButton = document.getElementById("abort_synchronizations_button");
    var reloadButton = document.getElementById("reload_sync_status_button");
    var cancelButton = document.getElementById("button_cancel");
    var okButton = document.getElementById("button_publish");

    if (gPublishSettings && gPublishSettings.local_uri) {
        localPathLabel.value = ko.uriparse.URIToLocalPath(gPublishSettings.local_uri);
    } else {
        localPathLabel.value = "";
    }

    if (gPublishSettings && gPublishSettings.remote_uri) {
        remotePathLabel.value = gPublishSettings.remote_uri;
    } else {
        remotePathLabel.value = "";
    }

    if (gState == STATE_INITIAL) {
        
       elems.$progressmeter.message("");
        elems.$progressmeter.percentage(0);
        gSyncTreeView.setTreeRows([]);
        if (gTempDir) {
            // Cleanup the temporary directory now.
            koFileSvc.deleteTempDir(gTempDir);
            gTempDir = null;
        }
        abortButton.setAttribute("disabled", "true");
        cancelButton.setAttribute("disabled", "true");
        reloadButton.setAttribute("disabled", "true");
        okButton.removeAttribute("disabled");
        okButton.label = "Close";

    } else if (gState == STATE_FETCHING_CHANGES) {
        abortButton.removeAttribute("disabled");
        cancelButton.removeAttribute("disabled");
        reloadButton.setAttribute("disabled", "true");
        okButton.label = "Synchronize";
        okButton.setAttribute("disabled", "true");

    } else if (gState == STATE_DISPLAYING_CHANGES) {
        abortButton.setAttribute("disabled", "true");
        cancelButton.removeAttribute("disabled");
        reloadButton.removeAttribute("disabled");
        okButton.label = "Synchronize";
        if (!gSyncTreeView.rows.some(function(elem) { return elem.isChecked })) {
            okButton.setAttribute("disabled", "true");
        } else {
            okButton.removeAttribute("disabled");
        }

    } else if (gState == STATE_DIFF_DOWNLOADING ||
               gState == STATE_DOWNLOADING ||
               gState == STATE_UPLOADING) {
        reloadButton.setAttribute("disabled", "true");
        abortButton.removeAttribute("disabled");
        cancelButton.removeAttribute("disabled");
        okButton.label = "Synchronize";
        okButton.setAttribute("disabled", "true");

    } else if (gState == STATE_FINISHED) {
        var syncItems = _getCheckedItems();
        syncItems = syncItems.filter(function(item, index, array) {
                                        return (item instanceof koSyncFileItem);
                                     });
        if (syncItems.length) {
            // Sync'd something, cause the file status service to refresh.
            var fileStatusSvc = Components.classes["@activestate.com/koFileStatusService;1"].
                                getService(Components.interfaces.koIFileStatusService);
            fileStatusSvc.updateStatusForAllFiles(Components.interfaces.koIFileStatusChecker.REASON_FORCED_CHECK);
        }

        abortButton.setAttribute("disabled", "true");
        cancelButton.setAttribute("disabled", "true");
        reloadButton.removeAttribute("disabled");
        okButton.removeAttribute("disabled");
        okButton.label = "Close";
    }
}

// --- Context menu handlers.

function DiffSelectedItems()
{
    var selectedSyncItems = _getSelectedTreeItems();
    if (selectedSyncItems.length > 0) {
        diffSyncItems(selectedSyncItems);
    }
}

function RemoveSyncItems(items)
{
    for (var i=0; i < items.length; i++) {
        gSyncTreeView.removeRowItem(items[i]);
    }
}

function CheckSelectedItems()
{
    _getSelectedTreeItems().forEach(function(elem) { elem.isChecked = true; });
    updateUIState();
    gSyncTreeView.tree.invalidate();
}

function UncheckSelectedItems()
{
    _getSelectedTreeItems().forEach(function(elem) { elem.isChecked = false; });
    updateUIState();
    gSyncTreeView.tree.invalidate();
}

function StopSelectedItems()
{
    var items = _getSelectedTreeItems();
    for (var i=0; i < items.length; i++) {
        if (items[i] instanceof koSyncLoadingItem) {
            items[i].abort();
        }
    }
    RemoveSyncItems(items);
}

function ContextPopupShowing(popupElement)
{
    var items = _getSelectedTreeItems();
    var stopMenu = document.getElementById("context_menu_stop");
    if (items.some(function(elem) { return (elem instanceof koSyncLoadingItem); })) {
        if (items.every(function(elem) { return (elem instanceof koSyncLoadingItem); })) {
            // All are loading items, display the stop menu as enabled.
            stopMenu.setAttribute("enabled", "true");
        } else {
            // Some items are loading items, display stop as grayed out.
            stopMenu.setAttribute("enabled", "false");
        }
        stopMenu.setAttribute("collapsed", "false");
    } else {
        // No loading items, hide the stop menu.
        stopMenu.setAttribute("collapsed", "true");
    }

    var conflictMenu = document.getElementById("context_menu_conflict_resolve");
    if (items.some(function(elem) { return (elem instanceof koSyncFileItem &&
                                            (elem.hasConflict() || elem.hadConflict()));
                                  }))
    {
        conflictMenu.removeAttribute("disabled");
    } else {
        // No loading items, hide the stop menu.
        conflictMenu.setAttribute("disabled", "true");
    }
    
    // If one item is selected and it's the same action the menu item will
    // force then disable it otherwise let the function call handle not
    // swapping Sync Action if it's not necessary.
    var forcePushMenu = document.getElementById("context_menu_upload");
    if (items.length == 1 &&
        UPLOAD_STATES.indexOf(items[0].syncType) >= 0 ||
        items[0].syncType == SYNC_REMOTE_DIR_ADDED ||
        items[0].syncType == SYNC_REMOTE_FILE_ADDED)
    {
        forcePushMenu.setAttribute("disabled", "true");
        forcePushMenu.setAttribute("tooltiptext",
                                   _bundle.GetStringFromName("context_menu_force_up_disabled.tooltip"));
    } else {
        forcePushMenu.removeAttribute("disabled");
        forcePushMenu.setAttribute("tooltiptext",
                                   _bundle.GetStringFromName("context_menu_force_up.tooltip"));
    }
    var forceDownMenu = document.getElementById("context_menu_download");
    if (items.length == 1 &&
        DOWNLOAD_STATES.indexOf(items[0].syncType) >= 0 ||
        items[0].syncType == SYNC_LOCAL_DIR_ADDED ||
        items[0].syncType == SYNC_LOCAL_FILE_ADDED)
    {
        forceDownMenu.setAttribute("disabled", "true");
        forceDownMenu.setAttribute("tooltiptext",
                                   _bundle.GetStringFromName("context_menu_force_down_disabled.tooltip"));
    } else {
        forceDownMenu.removeAttribute("disabled");
        forceDownMenu.setAttribute("tooltiptext",
                                   _bundle.GetStringFromName("context_menu_force_down.tooltip"));
    }
}

// --- Button handlers.

function CheckAll()
{
    gSyncTreeView.rows.forEach(function(elem) { elem.isChecked = true; });
    updateUIState();
    gSyncTreeView.tree.invalidate();
}


function UncheckAll()
{
    gSyncTreeView.rows.forEach(function(elem) { elem.isChecked = false; });
    updateUIState();
    gSyncTreeView.tree.invalidate();
}


function doDiffDownload(syncItems, tempdir, onCompleteCallback) {
    gState = STATE_DIFF_DOWNLOADING;

    // Get the list of files/actions and then pass to the worker to do the
    // actual downloading.
    var downloadItems = syncItems.filter(function(item, index, array) {
                                    return (item.transferStatus == TRANSFER_STATE_PENDING &&
                                            item.syncType != SYNC_REMOTE_DIR_REMOVED &&
                                            item.syncType != SYNC_REMOTE_FILE_REMOVED &&
                                            item.syncType != SYNC_LOCAL_DIR_ADDED &&
                                            item.syncType != SYNC_LOCAL_FILE_ADDED);
                                 });
    if (!downloadItems) {
        onCompleteCallback();
        return;
    }

    var koRemoteTransSvc = Components.classes["@activestate.com/koRemoteTransferService;1"].
                        getService(Components.interfaces.koIRemoteTransferService);
    /**
     * @type {koSyncFileItem}
     */
    var syncItem;
    var remote_uris = [];
    var local_tmp_uris = [];
    var base_remote_uri = gPublishSettings.remote_uri;
    var base_local_uri = gPublishSettings.local_uri;
    var base_local_tmp_uri = ko.uriparse.localPathToURI(tempdir);
    var syncItem_from_remote_uri = {};
    var ruri;
    var luri;
    var osPathSvc = Components.classes["@activestate.com/koOsPath;1"].
                        getService(Components.interfaces.koIOsPath);
    for (var i=0; i < downloadItems.length; i++) {
        syncItem = downloadItems[i];
        if (!syncItem.relativePath) {
            ruri = base_remote_uri;
            luri = base_local_tmp_uri;
        } else {
            ruri = base_remote_uri + "/" + syncItem.relativePath;
            luri = base_local_tmp_uri + "/" + syncItem.relativePath;
        }
        // Only download it if it doesn't already exist.
        if (osPathSvc.exists(ko.uriparse.URIToLocalPath(luri))) {
            continue;
        }
        local_tmp_uris.push(luri);
        remote_uris.push(ruri);
        syncItem_from_remote_uri[ruri] = syncItem;
    }

    elems.$progressmeter.percentage("0");

    var callback = {
        "callback": function(result, data) {
            log.info("doDiffDownload:: callback result: " + result);
            try {
                if (result == Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
                    // Download was successful, now perform the diff.
                    onCompleteCallback();
                } else if (result == Components.interfaces.koIAsyncCallback.RESULT_ERROR) {
                    // data should contain the error message.
                    if (!data) {
                        data = "Asynchronous doDiffDownload() failed.";
                    }
                    gSyncTreeView.appendRowItem(new koSyncLogItem(koSyncLogItem.ERROR,
                                                                  String(data)),
                                                true /* ensure visible */);
                    log.info("doDiffDownload:: error returned: " + data);
                }

            } catch (e) {
                //dump("Exception: " + e + "\n");
                gSyncTreeView.appendRowItem(new koSyncLogItem(koSyncLogItem.ERROR, e),
                                            true /* ensure visible */);
                log.exception(e, "doDiffDownload:: async callback failed");
            } finally {
                updateUIState();
            }
        },
        "onProgress": function(msg, value) {
            elems.$progressmeter.message(msg);
            elems.$progressmeter.percentage(value);
        },
        "notifyFileTransferStarting": function(local_uri, remote_uri) {
            let syncItem = syncItem_from_remote_uri[remote_uri];
            if (syncItem) {
                gSyncTreeView.markFileTransferStarting(syncItem);
            }
            //dump("progress: " + value + "\n");
        },
        "notifyFileTransferCompleted": function(local_uri, remote_uri) {
            let syncItem = syncItem_from_remote_uri[remote_uri];
            if (syncItem) {
                // Copy the locally download tmp file to the real location.
                let real_local_uri = base_local_uri + "/" + syncItem.relativePath;
                syncItem.markFileTransferCompleted(TRANSFER_STATE_DOWNLOADED);
                gSyncTreeView.invalidateSyncItem(syncItem);
            }
        }
    }

    // Start the asynchronous download worker.
    gPublishingOp = koRemoteTransSvc.download(remote_uris.length, remote_uris,
                                              local_tmp_uris.length, local_tmp_uris,
                                              callback);
    updateUIState();
}

function diffSyncItems(syncItems) {
    var return_state = gState;

    if (!gTempDir) {
        // Make a temporary directory to store the remote files and have a
        // worker thread download these files.
        var koFileSvc = Components.classes["@activestate.com/koFileService;1"].
                            getService(Components.interfaces.koIFileService);
        gTempDir = koFileSvc.makeTempDir("", "publishing_");
    }

    var callbackFn = function() {
        try {
            /**
             * @type {koSyncFileItem}
             */
            var syncItem;
            // The original paths are the files that haven't been changed.
            var original_paths = [];
            // The modified paths are the files that have changed.
            var modified_paths = [];
            var original_display_paths = [];
            var modified_display_paths = [];
            var base_local_uri = gPublishSettings.local_uri;
            var base_local_tmp_uri = ko.uriparse.localPathToURI(gTempDir);
            var base_remote_uri = gPublishSettings.remote_uri;
            var uri;
            var localpath;
            var tmpuri;
            for (var i=0; i < syncItems.length; i++) {
                syncItem = syncItems[i];
                if (syncItem.relativePath) {
                    uri = base_local_uri + "/" + syncItem.relativePath;
                    localpath = ko.uriparse.URIToLocalPath(uri);
                    tmpuri = base_local_tmp_uri + "/" + syncItem.relativePath;
                    if (syncItem.syncType >= SYNC_LOCAL_DIR_ADDED) {
                        // Locally modified file.
                        modified_paths.push(localpath);
                        modified_display_paths.push(localpath);
                        original_paths.push(ko.uriparse.URIToLocalPath(tmpuri));
                        original_display_paths.push(base_remote_uri + "/" + syncItem.relativePath);
                    } else {
                        // Remotely modified file.
                        modified_paths.push(ko.uriparse.URIToLocalPath(tmpuri));
                        modified_display_paths.push(base_remote_uri + "/" + syncItem.relativePath);
                        original_paths.push(localpath);
                        original_display_paths.push(localpath);
                    }
                }
            }
            // We have the paths, perform the diff.
            var diffSvc = Components.classes["@activestate.com/koDiffService;1"].
                                getService(Components.interfaces.koIDiffService);
            var diff = diffSvc.diffMultipleFilepathsOverridingDisplayPaths(original_paths, original_paths.length,
                                                                           modified_paths, modified_paths.length,
                                                                           original_display_paths, original_display_paths.length,
                                                                           modified_display_paths, modified_display_paths.length);
            ko.launch.diff(diff, gPublishSettings.name + " Publishing Changes");
        } finally {
            gState = return_state;
            updateUIState();
        }
    }

    doDiffDownload(syncItems, gTempDir, callbackFn);
}

function PushAll() {
    var message = "Force push selected files will overwrite the remote files " +
        "content even if the remote file has changed.  Loss of data is possible.  " +
        "Are you sure you want to proceed?";
        
    if (require("ko/dialogs").confirm(message))
    {
        gSyncTreeView.selection.selectAll()
        ForceUploadSelectedItems();
        //doSynchronize();
    }
    window.focus();
}

function PullAll() {
     var message = "Force pull selected files will overwrite the local files " +
        "content even if the local file has changed.  Loss of data is possible.  " +
        "Are you sure you want to proceed?";
        
    if (require("ko/dialogs").confirm(message))
    {
        gSyncTreeView.selection.selectAll()
        ForceDownloadSelectedItems();
        //doSynchronize();
    }
    window.focus();
}

function ShowDiff()
{
    var checkedSyncItems = _getCheckedItems();
    if (checkedSyncItems.length > 0) {
        for(let item of checkedSyncItems)
        {
            if(item.syncType === SYNC_CONFLICT_REMOVED_REMOTELY_MODIFIED_LOCALLY ||
               item.syncType === SYNC_CONFLICT_REMOVED_LOCALLY_MODIFIED_REMOTELY )
            {
                ko.dialogs.alert("Remote or Local file remove.  No file available to `diff`.");
                return;
            }
        }
        diffSyncItems(checkedSyncItems);
    }
}

function Refresh()
{
    fetchChanges();
}

function _abortAllSyncingItems()
{
    var rows = gSyncTreeView.rows;
    for (var i=0; i < rows.length; i++) {
        if (rows[i] instanceof koSyncLoadingItem) {
            rows[i].abort();
        }
    }
    if (gPublishingOp) {
        gPublishingOp.stop();
    }
}

function abort_synchronizations() {
    try {
        _abortAllSyncingItems();
    } catch(ex) {
        log.exception(ex);
    }
}

function ConfirmCloseWindow()
{
    // If there is a synchronization in progress, then prompt to confirm the
    // close action.
    
    var prompt = _bundle.GetStringFromName("publishing.confirm.close.message");
    var answer = ko.dialogs.yesNo(prompt, "Yes", null, null,
                                  "publishing_no_confirm_close");
    if (answer != "Yes") {
        return;
    }
    // Close the window.
    Cancel();
}

function Cancel()
{
    if ("arguments" in window) {
        window.arguments[0].retval = "Cancel";
    }
    window.close();
}

function OnUnload()
{
    _abortAllSyncingItems();
}

function OK()
{
    if (gState == STATE_FINISHED || gSyncTreeView.rowCount == 0) {
        if ("arguments" in window) {
            window.arguments[0].retval = "OK";
        }
        window.close();
        return true;
    }

    doSynchronize();

    /* TODO: Add pref on whether to close the dialog now. */
    return false;
}

function create_new_settings() {
    gPublishSettings = Components.classes["@activestate.com/koPublishingSettings;1"]
                   .createInstance(Components.interfaces.koIPublishingSettings);
    edit_current_settings();
}

function edit_current_settings() {
    if (!gPublishSettings) {
        create_new_settings();
        return;
    }
    loadPublishSettings(gPublishSettings);

    document.getElementById("publishing_deck").selectedIndex = 0;
}

function delete_current_settings() {
    try {
        if(!gPublishSettings)
            return;
        var answer = ko.dialogs.yesNo("Are you sure you wish to delete '" + gPublishSettings.name + "'",
                                      "No", null, "Confirm deletion");
        if (answer == "Yes") {
            for (var i=0; i < gPublishSettingsList.length; i++) {
                if (gPublishSettingsList[i] == gPublishSettings) {
                    gPublishSettingsList.splice(i, 1);
                    opener.ko.publishing.saveConfigurations(gPublishSettingsList);
                    break;
                }
            }
            gState = STATE_INITIAL;
            gPublishSettings = null;
            reloadSettingsMenulist();
            updateUIState();
        }
    } catch(ex) {
        log.exception(ex);
    }
}

function settings_cancel() {
    if (gDialogType == "new") {
        // Close the window.
        Cancel();
        return;
    }
    document.getElementById("publishing_deck").selectedIndex = 1;
    gState = STATE_INITIAL;
    gPublishSettings = null;
    reloadSettingsMenulist();
    updateUIState();
}

function loadPublishSettings(pubSettings)
{
    elems.nameText.value = pubSettings.name;
    if (pubSettings.local_uri) {
        elems.localPathText.value = ko.uriparse.URIToLocalPath(pubSettings.local_uri);
    } else {
        elems.localPathText.value = "";
    }
    elems.remotePathText.value = pubSettings.remote_uri;
    elems.includePathsText.valule = pubSettings.includes;
    elems.excludePathsText.value = pubSettings.excludes;
    elems.pushOnSaveCheck.checked = pubSettings.autopush_on_save;
}

function storePublishSettings(pubSettings)
{
    try {
        pubSettings.name = elems.nameText.value;
    
        if (elems.localPathText.value) {
            pubSettings.local_uri = ko.uriparse.localPathToURI(elems.localPathText.value);
        } else {
            pubSettings.local_uri = "";
        }
    
        if (elems.remotePathText.value) {
            // this should save the remote URI properly like local
            // above: ko.uriparse.pathToURI
            pubSettings.remote_uri = elems.remotePathText.value;
        } else {
            pubSettings.remote_uri = "";
        }
    
        pubSettings.includes = elems.includePathsText.value;
        pubSettings.excludes = elems.excludePathsText.value;
        pubSettings.autopush_on_save = elems.pushOnSaveCheck.checked;
    } catch (e) {
        log.exception(e);
    }
}

function browseLocal()
{
    ko.filepicker.browseForDir(elems.localPathText);
}

function browseRemote()
{
    ko.filepicker.browseForRemoteDir(elems.remotePathText);
}

function validate(field)
{
    var isValid = true;
    switch(field)
    {
        case "name":
            isValid = validateName();
            break;
        case "localpath":
            isValid = validateLocalPath();
            break;
        case "remotepath":
            isValid = validateRemotePath();
            break;
        default:
            if ( ! validateName() )
                isValid = false;
            if ( ! validateLocalPath() )
                isValid = false;
            if ( ! validateRemotePath() )
                isValid = false;
    }
    if (isValid)
        require("ko/dom")(elems.validationBox).hide();
    return isValid;
}

function toggleValidationField()
{
    if ( nameValid && localValid && remoteValid)
    {
        require("ko/dom")(elems.validationBox).hide();
    }
    else
    {
        require("ko/dom")(elems.validationBox).show();
    }
}

var nameValid = true;
function validateName()
{
    var isValid = true;
    if ( ! elems.nameText.value ) {
        nameValid = false;
        isValid = false;
        elems.nameText.setAttribute("invalid", "true");
        elems.invalidNameText.$element.show();
        toggleValidationField();
    } else {
        nameValid = true;
        elems.invalidNameText.$element.hide();
        elems.nameText.removeAttribute("invalid");
        toggleValidationField();
    }
    return isValid;
}

var localValid = true;
function validateLocalPath()
{
    var isValid = true;
    if ( ! elems.localPathText.value ) {
        localValid = false;
        isValid = false;
        elems.localPathText.setAttribute("invalid", "true");
        elems.invalidLclPthText.$element.show();
        toggleValidationField();
    } else {
        localValid = true;
        elems.invalidLclPthText.$element.hide();
        elems.localPathText.removeAttribute("invalid");
        toggleValidationField();
    }
    return isValid;
}

var remoteValid = true;
function validateRemotePath()
{
    var isValid = true;
    if ( ! elems.remotePathText.value) {
        remoteValid = false;
        isValid = false;
        elems.remotePathText.setAttribute("invalid", "true");
        elems.invalidRmtPthText.$element.show()
        toggleValidationField();
    } else {
        remoteValid = true;
        elems.invalidRmtPthText.$element.hide()
        elems.remotePathText.removeAttribute("invalid");
        toggleValidationField();
    }
    return isValid;
}

function settings_save() {
    try {
        if (!validate()) {
            return;
        }
        storePublishSettings(gPublishSettings);
        var found = false;
        for (var i=0; i < gPublishSettingsList.length; i++) {
            if (gPublishSettingsList[i] == gPublishSettings) {
                found = true;
                break;
            }
        }
        if (!found) {
            gPublishSettingsList.push(gPublishSettings);
        }
        opener.ko.publishing.saveConfigurations(gPublishSettingsList);
    
        if (gDialogType == "new") {
            // So next edit then cancel does not close the dialog.
            gDialogType = "push";
        }
        document.getElementById("publishing_deck").selectedIndex = 1;
        gState = STATE_INITIAL;
        reloadSettingsMenulist();
        setSyncSettings(gPublishSettings);
    } catch(ex) {
        log.exception(ex);
    }
}

function reloadSettingsMenulist() {
    var menulist = document.getElementById("settings_menulist");
    var menupopup = document.getElementById("settings_menupopup");
    // Remove any existing child menuitems.
    var children = menupopup.childNodes;
    while (menupopup.hasChildNodes()) {
        menupopup.removeChild(menupopup.firstChild);
    }

    gPublishSettingsList = opener.ko.publishing.getConfigurations();

    // Create new child menuitems.
    var menuitem;
    var selectedIndex = -1;
    for (var i=0; i < gPublishSettingsList.length; i++) {
        menuitem = xtk.domutils.newElement("menuitem",
                        {
                          'label': gPublishSettingsList[i].name,
                          'uuid' : gPublishSettingsList[i].id,
                          'oncommand': 'loadSyncPreferenceWithId("' +
                                        gPublishSettingsList[i].id + '");'
                        });
        menupopup.appendChild(menuitem)
        if (gPublishSettingsList[i] == gPublishSettings) {
            selectedIndex = i;
        }
    }
    if (selectedIndex >= 0) {
        menulist.selectedIndex = selectedIndex;
    } else {
        menulist.value = "";
    }
}

function setSyncSettings(settings) {
    gPublishSettings = settings;
    // Set the local path.
    if (settings.local_uri) {
        // Start fetching the changes.
        // TODO: Respect the dialog type?
        if (settings.remote_uri) {
            fetchChanges();
        }
    }
    updateUIState();
}

function loadSyncPreferenceWithId(id) {
    for (var i=0; i < gPublishSettingsList.length; i++) {
        if (gPublishSettingsList[i].id == id) {
            setSyncSettings(gPublishSettingsList[i]);
            break;
        }
    }
}

function setNothingToSynchronize() {
    gState = STATE_FINISHED;
    
    // Put an information line in the tree.
    gSyncTreeView.appendRowItem(new koSyncLogItem(koSyncLogItem.INFO,
                                      "Nothing requires synchronization"),
                                true);
}

// Force change the Sync Action of the selected items to be uploaded
function ForceUploadSelectedItems() {
    try {
        var items = _getSelectedTreeItems();
        for (var i=0; i < items.length; i++) {
            gSyncTreeView.forceItemUpload(items[i]);
        }
    } catch(ex) {
        log.exception(ex);
    }
}

// Force change the Sync Action of the selected items to be downloaded
function ForceDownloadSelectedItems() {
    try {
        var items = _getSelectedTreeItems();
        for (var i=0; i < items.length; i++) {
            gSyncTreeView.forceItemDownload(items[i]);
        }
    } catch(ex) {
        log.exception(ex);
    }
}

function ConflictResolveSelectedItems(resolution) {
    try {
        var items = _getSelectedTreeItems();
        for (var i=0; i < items.length; i++) {
            if (items[i].hasConflict()) {
                gSyncTreeView.resolveConflictForItem(items[i], resolution);
            }
        }
    } catch(ex) {
        log.exception(ex);
    }
}