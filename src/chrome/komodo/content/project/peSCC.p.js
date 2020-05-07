/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

// A project extension to manage source code control operations in Komodo.

if (typeof(ko)=='undefined') {
    var ko = {};
}
if (typeof(ko.projects)=='undefined') {
    ko.projects = {};
}

(function() {

const {interfaces: Ci, classes: Cc} = Components;
var log = ko.logging.getLogger('peSCC');
var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
      .getService(Components.interfaces.nsIStringBundleService)
      .createBundle("chrome://komodo/locale/project/peSCC.properties");
var _prefs = Components.classes["@activestate.com/koPrefService;1"].
                    getService(Components.interfaces.koIPrefService).prefs;
var _obSvc = Components.classes["@mozilla.org/observer-service;1"].
             getService(Components.interfaces.nsIObserverService);

//---- SCC project extension implementation.

function peSCC() {
    this.name = 'SCC';
    //log.setLevel(ko.logging.LOG_DEBUG);
}

// The following two lines ensure proper inheritance (see Flanagan, p. 144).
peSCC.prototype.constructor = peSCC;

peSCC.prototype.init = function() {
    // register our command handlers
    this.registerCommands();

    // this adds columns to the project/toolbox tree's
    var em = ko.projects.extensionManager;
    em.setDatapoint(_bundle.GetStringFromName("sccStatusTreeColLabel"), 'sccStatus');
    em.setDatapoint(_bundle.GetStringFromName("sccLocalRevisionTreeColLabel"), 'sccLocalRevision');
    em.setDatapoint(_bundle.GetStringFromName("sccDepotRevisionTreeColLabel"), 'sccDepotRevision');
    em.setDatapoint(_bundle.GetStringFromName("sccActionTreeColLabel"), 'sccAction');
}

peSCC.prototype.registerCommands = function() {
    var em = ko.projects.extensionManager;
    em.registerCommand('cmd_SCCedit', this);
    em.registerCommand('cmd_SCCadd_File', this);
    em.registerCommand('cmd_SCCremove_File', this);
    em.registerCommand('cmd_SCCupdate', this);
    em.registerCommand('cmd_SCCcommit', this);
    em.registerCommand('cmd_SCCdiff', this);
    em.registerCommand('cmd_SCChistory', this);
    em.registerCommand('cmd_SCCrevert', this);
    em.registerCommand('cmd_SCC_openWebService_File', this);
    em.registerCommand('cmd_SCCdiff_File', this);
    em.registerCommand('cmd_SCChistory_File', this);
    em.registerCommand('cmd_SCCrevert_File', this);
    em.registerCommand('cmd_SCCcheckout', this);
    em.registerCommand('cmd_SCCpush', this);
    em.registerCommand('cmd_SCCpull', this);
    em.registerCommand('cmd_SCCpullRebase', this);
    em.registerCommand('cmd_SCCclone', this);
}

peSCC.prototype.registerEventHandlers = function() {
}

peSCC.prototype.registerMenus = function() {
}

/* This takes an item, and determines what type of scc
   flags we are dealing with. returns true if we can do anything, or
   false if we cannot do anything */
peSCC.prototype.determineItemSCCSupport = function(/* koIPart */item, sccObj) {
    // prevent non-cvs directories from having to go through this torture
    var file = item.getFile();
    if (file && file.sccExclude) {
        return false;
    }
    // assume the worst =)
    sccObj.isscc_file = false;
    sccObj.isscc_directory = false;
    sccObj.isscc_container = false;
    sccObj.isscc_collection = false;

    var ok;
    try {
        ok = item.QueryInterface(Components.interfaces.koIPart_SCC_file) != null;
        if (ok) {
            sccObj.isscc_file = true;
        }
    } catch(e) {}
    try {
        ok = item.QueryInterface(Components.interfaces.koIPart_SCC_collection) != null;
        if (ok) {
            sccObj.isscc_collection = true;
        }
    } catch(e) {}
    try {
        ok = item.QueryInterface(Components.interfaces.koIPart_SCC_directory) != null;
        if (ok) {
            sccObj.isscc_directory = true;
        }
    } catch(e) {}
    sccObj.isscc_container = sccObj.isscc_directory || sccObj.isscc_collection;
    sccObj.isscc_file = sccObj.isscc_file || !sccObj.isscc_container;
    sccObj.has_scc = file && file.sccType != '';
    sccObj.is_scc = sccObj.isscc_file || sccObj.isscc_container;
    if (!sccObj.is_scc) {
        return false;
    }

    sccObj.can_scc = sccObj.is_scc || sccObj.has_scc || (file && file.sccDirType != '');
    sccObj.missing = file && !file.exists;

    var in_repository = null;
    if (item.url && !sccObj.can_scc && !sccObj.missing) {
        sccObj.can_scc = sccObj.has_scc || (file && file.sccDirType);
    }

    if (file && file.sccExclude) return false;
    return true;
}

peSCC.prototype._makeItemFromKoFileEx = function(koFileEx) {
    return { getFile: function() { return koFileEx },
             QueryInterface: function(itf) { return false },
             url: koFileEx.URI,
             _EOD_ : null
    };
}

peSCC.prototype._getSCCSvcForFile = function peSCC__getSCCSvcForFile(file) {
    if (!("_sccSvcCache" in this)) {
        this._sccSvcCache = { _dummy: { getValue: function() undefined, } };
    }
    if (!file) {
        return this._sccSvcCache._dummy;
    }
    let sccType = file.sccType || file.sccDirType || "_dummy";
    if (sccType in this._sccSvcCache) {
        return this._sccSvcCache[sccType];
    }
    let contractID = "@activestate.com/koSCC?type=" + sccType + ";1";
    if (contractID in Components.classes) {
        this._sccSvcCache[sccType] =
            Components.classes[contractID]
                      .getService(Components.interfaces.koISCC);
    } else {
        return this._sccSvcCache._dummy;
    }
    return this._sccSvcCache[sccType];

};

peSCC.prototype.supportsCommand = function(command, item) {
    // do we have either cvs or scc?
    
    if (command.indexOf('cmd_SCC') !== 0) {
        return false;
    }
    
    if (command == 'cmd_SCC_openWebService_File') {
        return !! ko.scc.getWebServiceCurrentFile();
    }
    
    var enabled_scc_components = ko.scc.getAvailableSCCComponents(true);
    if (!enabled_scc_components.length) {
        // No scc components are enabled for functional.
        return false;
    }
    
    if (command.substr(-5) == "_File") {
        command = command.replace(/_File$/, '');
    }
    
    // Checkout / clone is always enabled
    if (command == 'cmd_SCCclone' || command == 'cmd_SCCcheckout') {
        return true;
    }
    
    // If our SCC service does not support the command there is no point in showing it
    var sccCommand = command.replace(/^cmd_SCC/, '');
    var service = ko.scc.getCurrentService();
    if ( ! service || ! service.getValue("supports_command", sccCommand)) {
        return false;
    }
    
    return true;
};

peSCC.prototype.isCommandEnabled = peSCC.prototype.supportsCommand;

/* recursivly build a list of items that are being used in
   this scc operation */
peSCC.prototype._addVirtualFolderChildren = function(item)
{
    var items = [];
    try {
        var children = new Array();
        item.getChildren(children, new Object());
        children = children.value;
    } catch(e) {
        return items;
    }
    if (children.length < 1) return items;

    var child;
    for (var i = 0; i < children.length; i++) {
        child = children[i];
        if (child.url) {
            items.push(child);
        } else {
            var c = this._addVirtualFolderChildren(child);
            if (c.length > 0) {
                items = items.concat(c);
            }
        }
    }
    return items;
}

peSCC.prototype.doCommand = function(command, scc_items) {
    if (command.indexOf('cmd_SCCcheckout') === 0 || command.indexOf('cmd_SCCclone') === 0) {
        window.setTimeout(function (self, cmd, items) { self._doSccCheckout(cmd, items); }, 1, this, command, scc_items);
    } else {
        window.setTimeout(function (self, cmd, items) { self._doCommand(cmd, items); }, 1, this, command, scc_items);
    }
}

function _perform_scc_command_on_urls(command, sccType, collection, urls,
                                      localFileVersions, callback) {

    log.debug('sccType: '+sccType +', urls:\n  ' + urls.join('\n  '));

        // Get the koISCC service object
    var cid = "@activestate.com/koSCC?type=" + sccType + ";1";
    var sccSvc = Components.classes[cid].getService(Components.interfaces.koISCC);
    if (!sccSvc || !sccSvc.isFunctional) {
        return;
    }
    var isfoldercmd = command.indexOf('_folder')>1;
    try {
        switch (command) {
        case 'cmd_SCCedit':
            ko.scc.Edit(sccSvc, urls, callback);
            break;
        case 'cmd_SCCadd_folder':
            if (!isfoldercmd) return;
            // else fall through
        case 'cmd_SCCadd':
            ko.scc.Add(sccSvc, urls, callback);
            break;
        case 'cmd_SCCremove':
            ko.scc.Remove(sccSvc, urls, callback);
            break;
        case 'cmd_SCCrevert_folder':
            if (!isfoldercmd) return;
            // else fall through
        case 'cmd_SCCrevert':
            ko.scc.Revert(sccSvc, urls, callback);
            break;
        case 'cmd_SCCupdate_folder':
            if (!isfoldercmd) return;
            // else fall through
        case 'cmd_SCCupdate':
            ko.scc.Update(sccSvc, urls, callback);
            break;
        case 'cmd_SCCpull':
            ko.scc.Pull(sccSvc, urls, false, callback);
            break;
        case 'cmd_SCCpullRebase':
            ko.scc.Pull(sccSvc, urls, true, callback);
            break;
        case 'cmd_SCCdiff_folder':
            if (!isfoldercmd) return;
            // else fall through
        case 'cmd_SCCdiff':
            ko.scc.Diff(sccSvc, urls, callback);
            break;
        case 'cmd_SCCcommit_folder':
            if (!isfoldercmd) return;
            // else fall through
        case 'cmd_SCCcommit':
            if (!callback && collection != null) {
                callback = function (result, data) {
                    if (result != Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) return;
                    // remove scc urls now
                    for (i=0; i < urls.length; i++) {
                        var c = collection.getChildByAttributeValue('url', urls[i], true);
                        if (c) {
                            c.parent.removeChild(c);
                        }
                    }
                    var collection_parent = collection.parent;
                    if (collection.isEmpty()) {
                        collection_parent.removeChild(collection);
                    }
                }
            }
            var commit_message = '';
            if (collection && collection.prefset.hasStringPref("changelist_description")) {
                commit_message = collection.prefset.getStringPref("changelist_description");
            }
            ko.scc.Commit(sccSvc, urls, commit_message, callback);
            break;
        case 'cmd_SCChistory':
            ko.scc.History(sccSvc, urls, localFileVersions);
            break;
        case 'cmd_SCCpush':
        case 'cmd_SCCpush_folder':
            ko.scc.Push(sccSvc, urls, callback);
        default:
            break;
        }
    } catch (e) {
        alert(_bundle.formatStringFromName("sccError.alert", [e], 1));
        log.error(e);
    }
}

/**
 * Check if the parent folder of the targeted item(s) are under
 * SCC, we can then prompt to add the directory first and then
 * add the targeted item(s) afterwards.
 * @note This is only expected to be called peSCC._doCommand on add/add folder
 */
function _scc_add_parent_directories(urls, depth, callback, message) {
    // Check if the parent folder of the targeted item(s) are under
    // SCC, we can then prompt to add the directory first and then
    // add the targeted item(s) afterwards.
    log.debug("_scc_add_parent_directories: depth: " + depth + ", urls: " + urls +
              ", message: " + message);
    var fileSvc = Components.classes["@activestate.com/koFileService;1"].
                        getService(Components.interfaces.koIFileService);
    var dir_url;
    var parent_dir_url;
    var dir_urls = [];
    var koFile;
    var dir_koFile;
    var parent_dir_koFile;
    var dir_koFiles = [];
    var unknownSccType = false;
    var sccType = "";
    for (var i=0; i < urls.length; i++) {
        koFile = fileSvc.getFileFromURI(urls[i]);
        dir_url = ko.uriparse.dirName(urls[i]);
        dir_urls.push(dir_url);
        dir_koFile = fileSvc.getFileFromURI(dir_url);
        parent_dir_url = ko.uriparse.dirName(dir_url);
        parent_dir_koFile = fileSvc.getFileFromURI(parent_dir_url);
        if (sccType && parent_dir_koFile.sccDirType && (parent_dir_koFile.sccDirType != sccType)) {
            var msg = "Mixed SCC types are not supported: '" + parent_dir_koFile.sccDirType + "', and '" + sccType + "'";
            require("notify/notify").send(msg, "scc", {priority: "warning"});
            return;
        } else if (!sccType && parent_dir_koFile.sccDirType) {
            sccType = parent_dir_koFile.sccDirType;
        } else {
            // There is no f.sccDirType on this file.
            unknownSccType = true;
        }
        if (dir_koFiles.indexOf(dir_koFile) < 0) {
            dir_koFiles.push(dir_koFile);
            //dump("dir_koFile: " + dir_koFile.path + "\n");
        }
    }
    log.debug("_scc_add_parent_directories: depth: " + depth +
              ", sccType: " + sccType);
    if (!unknownSccType) {
        // Perform the scc add directory operations then. We know which SCC
        // handler we need to use.
        var add_dir_callback = function (result, data) {
            if (result != Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
                callback(result, null, "Failed: could not add parent directory");
                return;
            }
            callback(result, sccType, null);
        }
        if (sccType == 'p4') {
            window.setTimeout(add_dir_callback, 1,
                              Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL,
                              "");
        } else {
            _perform_scc_command_on_urls("cmd_SCCadd_folder", sccType, null,
                                         dir_urls, null, add_dir_callback);
        }
        return;
    }

    // Need to find out if the parent directory is under SCC control. Launch
    // the asynchronous update then, which will call back later to check.
    var fileStatusSvc = Components.classes["@activestate.com/koFileStatusService;1"].
                        getService(Components.interfaces.koIFileStatusService);
    var filesvc_callback = (function(koFiles, parent_urls) {
        log.debug("_scc_add_parent_directories: depth: " + depth +
                  ", performing file status check");
        return {
            "notifyDone": function() {
                log.debug("_scc_add_parent_directories: depth: " + depth +
                          ", notifyDone");
                // The scc status has been checked.
                var scc_type;
                var f;
                for (var i=0; i < koFiles.length; i++) {
                    f = koFiles[i];
                    if (!f.sccDirType) {
                        log.debug("_scc_add_parent_directories: depth: " +
                                  depth + ", parent is not under scc");
                        if (depth < 3) {
                            var cb = function(result, scc_type, message) {
                                log.debug("_scc_add_parent_directories: depth: " +
                                          (depth+1) + ", cb: scc_type: " + scc_type);
                                var add_dir_callback = function (result, data) {
                                    if (result != Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
                                        callback(result, null, "Failed: could not add parent directory");
                                        return;
                                    }
                                    callback(result, scc_type, null);
                                }
                                // Call the scc handler to do the work on the given urls.
                                if (result == Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
                                    if (scc_type == 'p4') {
                                        callback(result, scc_type, null);
                                        return;
                                    } else {
                                        _perform_scc_command_on_urls("cmd_SCCadd_folder", scc_type, null, parent_urls, null, add_dir_callback);
                                    }
                                } else {
                                    callback(Components.interfaces.koIAsyncCallback.RESULT_ERROR,
                                             null,
                                             "Failed: No parent directory is under SCC control");
                                }
                            }
                            _scc_add_parent_directories(parent_urls, depth+1, cb, message);
                        } else {
                            callback(Components.interfaces.koIAsyncCallback.RESULT_ERROR,
                                     null,
                                     "Failed: No parent directory is under SCC control");
                        }
                        return;
                    } else if (scc_type && (f.sccDirType != scc_type)) {
                        log.debug("_scc_add_parent_directories: depth: " +
                                  depth + ", mixed types found: " + scc_type);
                        callback(Components.interfaces.koIAsyncCallback.RESULT_ERROR,
                                 null,
                                 "Failed: Mixed SCC types found: '" +
                                 f.sccDirType + "', and '" + scc_type + "'");
                        return;
                    } else if (!scc_type && f.sccDirType) {
                        scc_type = f.sccDirType;
                    }
                }
                callback(Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL,
                         scc_type, null);
            }
        }
    })(dir_koFiles, dir_urls);
    var msg = "Target directory not under SCC, checking the parent...";
    require("notify/notify").send(msg, "scc");
    ko.scc.logger.addMessage("Checking SCC status of parents:\n  " + dir_urls.join("\n  "));
    fileStatusSvc.updateStatusForFiles(dir_koFiles.length,
                                       dir_koFiles,
                                       false, filesvc_callback);
}

peSCC.prototype._doCommand = function(command, scc_items /* null */) {
    var cmd = null;
    var error = null;
    var urls=[];
    var _sccUrls = {};
    var _sccLocalVersions = {}; /* Only used for scc history */
    var _allURLS = [];
    var file;
    var item = null;
    var items = [];
    var i;
    var sccType;
    var sccLocalRevision;
    var lastMessage = null;
    var msg;

    log.debug("doCommand "+command);

    // Iterate over all the targeted items (project items, files, ...) and
    // gather the urls we are going to perform SCC actions upon

    // XXX FIXME this is an issue since projects do not necessarily have focus
    // on a context menu operation
    var inPlaces;
    if (!scc_items) {
        if (ko.places && ko.places.projects.getFocusedProjectView()) {
            // Get the items from the focused project
            items = ko.places.projects.manager.getSelectedItems();
            inPlaces = false;
        } else if (command == "cmd_SCC_openWebService_File") {
            ko.scc.getWebServiceCurrentFile((service) => {
                if ( ! service) return;
                
                var repoPath = ko.uriparse.URIToPath(ko.scc.getRepositoryRoot());
                var filePath = require("ko/views").current().filePath;
                if (filePath.indexOf(repoPath) == -1) return;
                
                filePath = filePath.substr(repoPath.length);
                var lineNo = require("ko/editor").getCursorPosition().line;
                
                var url = service.fileTemplate;
                url = url.replace('%path%', filePath);
                url = url.replace('%filename%', require("ko/file").basename(filePath));
                url = url.replace('%line%', lineNo);
                url = url.replace(/\/\//g, '/');
                
                ko.browse.openUrlInDefaultBrowser(url);
            });
        } else if (command.substr(-5) == "_File") {
            var currentFile = require("ko/views").current().file;
            if (! currentFile)
                return false;
            command = command.replace(/_File$/, '');
            items = [this._makeItemFromKoFileEx(currentFile)];
            inPlaces = false;
        } else {
            var root = ko.scc.getRepositoryRoot();
            if (root) {
                var fileService = Components.classes["@activestate.com/koFileService;1"].
                                   getService(Components.interfaces.koIFileService);
                items = [this._makeItemFromKoFileEx(fileService.getFileFromURI(root))];
            }
            inPlaces = false;
        }
    
        if (items.length < 1) return;

    } else {
        items = scc_items;
    }
    
    var collection = null;
    for (i=0; i<items.length; i++) {
        item = items[i];
        if (inPlaces) {
            // container support
            // check for scc containers, add the children of the container
            // to our items array.
            try {
                collection = item.QueryInterface(Components.interfaces.koIPart_SCC_collection);
            } catch(e) {}
            if (collection != null) {
                var c = this._addVirtualFolderChildren(item);
                if (c.length > 0) {
                    items = items.concat(c);
                }
            }
        }
    }

    // We have items, now work out the urls for the scc handlers
    var isfoldercmd = command.indexOf('_folder')>1;
    var found_supported_item = false;
    var unsupported_items = [];
    for (i=0; i<items.length; i++) {
        item = items[i];
        file = item.getFile();
        sccType = file && (file.sccType || file.sccDirType);
        sccLocalRevision = file.sccLocalRevision || '?';
        if ((file.isFile && !sccType) || file.sccExclude) {
            log.debug("doCommand unable to determineItemSCCSupport "+item.url);
            unsupported_items.push(item);
            continue;
        } else if (file.isDirectory && !sccType) {
            // SCC folder updates can be behind, but folders we always want
            // to continue anyway
            var service = ko.scc.getCurrentService();
            sccType = service.name;
        }

        found_supported_item = true;

        if (typeof(_sccUrls[sccType]) == 'undefined') {
            _sccUrls[sccType] = [];
            _sccLocalVersions[sccType] = [];
        }
        if (isfoldercmd && item.type == 'project') {
            var url = ko.uriparse.dirName(item.url);
            _sccUrls[sccType].push(url);
            _sccLocalVersions[sccType].push(""); /* No version, it's a collection */
            _allURLS.push(url);
            // add the dialogs children
            //items = items.concat(this._addVirtualFolderChildren(item));
        } else {
            _sccUrls[sccType].push(item.url);
            _sccLocalVersions[sccType].push(sccLocalRevision);
            _allURLS.push(item.url);
        }
    }

    if (found_supported_item) {
        if (unsupported_items.length > 0) {
            msg = "No SCC handler found for: \n" +
                      unsupported_items.map(function(item) "    " + item.url)
                                       .join("\n");
            ko.scc.logger.addMessage(sccType || "SCC",
                                     Ci.koINotification.SEVERITY_WARNING,
                                     "No SCC handler found", msg);
        }
    } else {
        if ((sccType != "p4") && (command == "cmd_SCCadd" || command == "cmd_SCCadd_folder")) {
            msg = "Checking SCC status of the parent folder...";
            require("notify/notify").send(msg, "scc");
            var urls = [item.url for each (item in items)];
            let message = ["   " + url for each (url in urls)].join("\n");
            var notif = ko.scc.logger.addMessage("scc",
                                                 Ci.koINotification.SEVERITY_INFO,
                                                 "Checking SCC status of the parent folder...",
                                                 "Attempting to add items:\n" + message + "\n");
            var callback = function(result, scc_type, message) {
                // Call the scc handler to do the work on the given urls.
                if (result == Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
                    log.debug("Added parent " + scc_type + " directories to " +
                              "scc, now adding: " + urls);
                    var sccurls = _sccUrls[scc_type];
                    _perform_scc_command_on_urls(command, scc_type, null, urls);
                    msg = "Added parent folders to " + scc_type,
                    require("notify/notify").send(msg, "scc");
                    ko.notifications.update(notif, {
                        description: "Added parent folders to " + scc_type,
                        details: notif.details +
                                 "\nAdded parent folders to " + scc_type
                    });
                } else {
                    //ko.scc.logger.reportSCCAction(scc_type, "add", urls, message, result);
                    require("notify/notify").send(message, "scc");
                    ko.notifications.update(notif, {
                        description: message,
                        severity: result == Ci.koIAsyncCallback.RESULT_STOPPED ?
                                      Ci.koINotification.SEVERITY_WARNING :
                                      Ci.koINotification.SEVERITY_ERROR,
                        details: notif.details +
                                 Array(68).join("-") + "\n" +
                                 message + "\n",
                    });
                }
            }
            // The below setTimeout used in order to allow the above statusbar
            // message to be displayed.
            window.setTimeout(function(urls_, callback_) {
                    _scc_add_parent_directories(urls_, 0, callback_, notif);
                }, 1, urls, callback);
            return;
        }
    }

    if ((command != 'cmd_SCCrevert') &&
        (command != 'cmd_SCChistory') &&
	!ko.views.manager.offerToSave(_allURLS, /* urls */
                      'Save Modified Files?', /* title */
                      'Save Modified Files Before Source Code Control Action', /* prompt */
                      "save_on_scc", /* pref */
                      false, /* skip projects */
                      false /* about to close */
                      )) {
        return;
    }
    
    // We've found all the SCC urls, now perform the scc actions for these urls.

    var output = '';
    var title;
    var sccType;

    log.debug('selected for scc operation '+_sccUrls);
    for (sccType in _sccUrls) {
        urls = _sccUrls[sccType];
        if (urls.length <= 0)
            continue;
        // Call the scc handler to do the work on the given urls.
        _perform_scc_command_on_urls(command, sccType, collection, urls, _sccLocalVersions[sccType]);
    }
    // Ensure the cached information gets updated, so the SCC toolbars and menu
    // are properly set.
    // Fixes bug: http://bugs.activestate.com/show_bug.cgi?id=48417
    ko.views.manager.resetLastViewCache();
}

peSCC.prototype._doSccCheckout = function(command, items) {
    var checkoutLocation = null;
    if (items) {
        if (items.length <= 0) {
            return;
        }
        if (items.length != 1) {
            ko.dialogs.alert(_bundle.GetStringFromName("sccCheckoutMultipleFoldersError.alert"));
            return;
        }
        checkoutLocation = items[0].url;
    }
    ko.scc.Checkout(checkoutLocation);
}

// This object is now used by the places extension.
this.SCC = new peSCC();
ko.projects.registerExtension(this.SCC);

}).apply(ko.projects);
