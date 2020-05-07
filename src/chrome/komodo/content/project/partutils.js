/* Copyright (c) 2000-2007 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

if (typeof(ko)=='undefined') {
    var ko = {};
}
if (typeof(ko.projects)=='undefined') {
    ko.projects = {};
}

(function() {

var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                .getService(Components.interfaces.nsIStringBundleService)
                .createBundle("chrome://komodo/locale/project/partutils.properties");
var log = ko.logging.getLogger("ko.projects");

/**
 * Given a koIPart, invoke it (do it's "double-click" action) through
 * whatever code path is appropriate for that part -- i.e. snippets
 * get inserted, commands get run, etc.
 */
this.invokePart = function part_invokePart(part) {
    switch (part.type) {
        case 'URL':
            ko.browse.openUrlInDefaultBrowser(part.value);
            break;
        case 'command':
            ko.projects.runCommand(part);
            break;
        case 'snippet':
            ko.projects.snippetInsert(part);
            break;
        case 'file':
            ko.open.URI(part.url);
            break;
        case 'template':
            ko.views.manager.doFileNewFromTemplateAsync(part.value);
            break;
        case 'macro':
            ko.projects.executeMacro(part);
            break;
        case 'tutorial':
            require("tutorials/tutorials").onInvoke(part);
            break;
        default:
            ko.dialogs.alert(_bundle.formatStringFromName("dontKnowHowToLaunchItemsOfType", [part.type], 1));
            break;
    }}

/**
 * Given the ID of a part, find it and invoke it.
 */
this.invokePartById = function part_invokePartById(id) {
    try {
        var part = ko.toolbox2.findToolById(id);
        if (!part) {
            log.error("Couldn't find part with id: " + id);
            return;
        }
        ko.projects.invokePart(part);
    } catch (e) {
        log.error(e);
    }
}

/**
 * Return null if there is no part with the given ID.
 */
this.findPartById = function part_findPartById(id) {
    return ko.toolbox2.findToolById(id);
}

/**
 * Recursively removes virtual files and folders, but does not
 * remove any folders that have been added manually or parts
 * that are not files or folders (i.e. snippets, macros, etc...).
 * This function will also remove any manually added files, that
 * were not added as part of the import process, because there
 * is not way to tell manually added files and imported files
 * apart.
 */
this.removeImportedVirtualFilesAndFolders =
function part_RemoveImportedVirtualFilesAndFolders(part) {
    // Get the children
    var children = new Array();
    part.getChildren(children, new Object());
    children = children.value;
    var childpart;
    for (var i=children.length-1; i >=0; i--) {
        // Only remove non-live files and folders
        childpart = children[i];
        if (!childpart.live) {
            if (childpart.type == "folder") {
                // Folder parts without urls were added separately (manually)
                if (part.url) {
                    this.removeVirtualFilesAndFolders(childpart);
                    // Only remove the foler if it's empty
                    if (childpart.isEmpty()) {
                        part.removeChild(childpart);
                    }
                }
            } else if (childpart.type == "file") {
                // All files can be deleted (there is currently no way to
                // tell if was manually added)
                part.removeChild(childpart);
            }
        }
    }
}

this.reimportFromFileSystem = function part_ReImportFromFS(part) {
    try {
        if (!part) {
            // Need a part to work on at the least
            return false;
        }

        var imp = new Object();
        imp.include = part.prefset.getStringPref("import_include_matches");
        imp.exclude = part.prefset.getStringPref("import_exclude_matches");
        imp.recursive= part.prefset.getBooleanPref("import_recursive");
        imp.importType= part.prefset.getStringPref("import_type");
        imp.part = part;
        imp.global = window;

        //part.dump(2);
        if (part.prefset.hasPrefHere("import_dirname")) {
            imp.dirname = part.prefset.getStringPref("import_dirname");
        } else {
            imp.dirname = _getPartURL(part);
            if (!imp.dirname) {
                return false;
            }
        }

        // See if this is a remote url
        var RCService = Components.classes["@activestate.com/koRemoteConnectionService;1"].
                        getService(Components.interfaces.koIRemoteConnectionService);
        var remoteImport = RCService.isSupportedRemoteUrl(imp.dirname);
        if (!remoteImport) {
            var osPathSvc = Components.classes["@activestate.com/koOsPath;1"].getService(Components.interfaces.koIOsPath);
            if (!osPathSvc.isdir(imp.dirname)) {
                alert(_bundle.formatStringFromName("thePathDoesNotExistOrIsNotDirectory", [imp.dirname], 1));
                window.focus();
                return false;
            }
        }

        // Now get the files to import (may be slow for remote systems)
        window.setCursor("wait");

        var filenames = new Array();
        try {
            // Remove all the old entries, not doing this as it may
            // inadvertently remove manually added files!
            //this.removeVirtualFilesAndFolders(part);

            // Find importable files
            var importService = Components.classes["@activestate.com/koFileImportingService;1"].
                            getService(Components.interfaces.koIFileImportingService);
            if (part.project == part) {
                // don't import the kpf
                imp.exclude += ";" + part.name;
            }
            if (remoteImport) {
                importService.findCandidateFilesRemotely(part, imp.dirname,
                                                 imp.include, imp.exclude,
                                                 imp.recursive, filenames,
                                                 new Object());
            } else {
                importService.findCandidateFiles(part, imp.dirname,
                                                 imp.include, imp.exclude,
                                                 imp.recursive, filenames,
                                                 new Object());
            }
            filenames = filenames.value;
            //dump("reimportFromFileSystem:: Filenames\n");
            //for (var i=0; i < filenames.length; i++) {
            //    dump("    " + filenames[i] + "\n");
            //}
            if (filenames.length == 0) {
                // No changes are needed
                return false;
            }

            // Add the importable files
            importService.addSelectedFiles(part, imp.importType, imp.dirname,
                                           filenames, filenames.length);
        } finally {
            window.setCursor("auto");
        }
        return true;

    } catch(e) {
        log.exception(e);
    }
    return true;
}

/**
 * Import a Komodo package (filename) into the given part.
 *
 * @param {Object} viewMgr - The project view manager.
 * @param part {Components.interfaces.koIPart} - The part to import into.
 * @param {string} uri - The URI of the package to import.
 */
this.importFromPackage = function part_ImportFromPackage(viewMgr, part, uri) {
    if (!uri) {
        var filename = ko.filepicker.browseForFile(
            null, null, // default dir and filename
            _bundle.GetStringFromName("selectPackageToImport"), // title
            "Komodo Package", // default filter
            ["Komodo Package", "All"]); // filters
        if (!filename) return;
        uri = ko.uriparse.localPathToURI(filename);
    }

    var koDirs = Components.classes["@activestate.com/koDirs;1"].
            getService(Components.interfaces.koIDirs);
    var os = Components.classes["@activestate.com/koOs;1"].
            getService(Components.interfaces.koIOs);
    var userDataDir = koDirs.userDataDir;
    var kpzExtractFolder = os.path.join(userDataDir, 'extracted-kpz');
    if (!os.path.exists(kpzExtractFolder)) {
        os.mkdir(kpzExtractFolder);
    }

    var fileSvc = Components.classes["@activestate.com/koFileService;1"].
                        getService(Components.interfaces.koIFileService);
    var koFileEx = fileSvc.getFileFromURI(uri);

    try {
        if (koFileEx.isLocal && koFileEx.isFile) {
            this._importFromPackage(viewMgr, part, koFileEx.path, kpzExtractFolder);
        } else if (koFileEx.scheme.substr(0, 4) == "http") {
            this._importPackageViaHttp(viewMgr, part, uri, kpzExtractFolder);
        } else {
            ko.dialogs.alert(_bundle.formatStringFromName("cantLoadKpzUri.alert", [uri], 1),
                             _bundle.formatStringFromName("unhandledKpzScheme.alert", [koFileEx.scheme], 1));
        }
    } catch (ex) {
        ko.dialogs.alert(_bundle.formatStringFromName("cantLoadKpzUri.alert", [uri], 1),
                         ex);
    }
}

/**
 * Import a Komodo package (filename) into the given part.
 *
 * @private
 * @param {Object} viewMgr - The project view manager.
 * @param part {Components.interfaces.koIPart} - The part to import into.
 * @param {string} filename - The local path of the package file to import.
 * @param {string} kpzExtractFolder - Where the kpz-extraction takes place.
 */
this._importFromPackage = function part__ImportFromPackage(viewMgr, part, filename, kpzExtractFolder) {
    // Use the default toolbox package extraction folder. The importPackage
    // call will automaticaly create a sub-folder underneath this directory:
    // .../extracted-kpz/${basename}/

    var os = Components.classes["@activestate.com/koOs;1"].
            getService(Components.interfaces.koIOs);
    var basename = os.path.withoutExtension(os.path.basename(filename));
    var extractedPart = part.project.createPartFromType('folder');
    extractedPart.setStringAttribute('name', basename);
    part.addChild(extractedPart);

    var packager = Components.classes["@activestate.com/koProjectPackageService;1"]
                      .getService(Components.interfaces.koIProjectPackageService);
    packager.importPackage(filename, kpzExtractFolder, extractedPart);

    // Remove the extracted kpz folder if it is empty.
    var nsFolder = Components.classes["@mozilla.org/file/local;1"].
                 createInstance(Components.interfaces.nsILocalFile);
    nsFolder.initWithPath(os.path.join(kpzExtractFolder, basename));
    if (nsFolder.exists()) {
        try {
            nsFolder.remove(false);
        } catch (ex) {
            // Not empty, leave the folder there.
        }
    }

    viewMgr.refreshParentShowChild(part, extractedPart);
    // Expand the extracted folder part and then select it.
}


/**
 * Import a Komodo package from the given HTTP URL. Once the kpz data is
 * successfully downloaded, it will be saved to a local file and then passed
 * to the package extraction service to unpack.
 *
 * @private
 * @param {Object} viewMgr - The project view manager.
 * @param part {Components.interfaces.koIPart} - The part to import into.
 * @param {string} uri - The URI of the package to import.
 * @param {string} kpzExtractFolder - Where the kpz-extraction takes place.
 */
this._importPackageViaHttp = function part__ImportPackageViaHttp(viewMgr, part, uri, kpzExtractFolder) {
    // Download the binary kpz data to save into a local filename.
    // https://developer.mozilla.org/En/Using_XMLHttpRequest#Handling_binary_data
    var req = new XMLHttpRequest();
    req.open('GET', uri, false);
    req.overrideMimeType('text/plain; charset=x-user-defined');
    req.send(null);
    if (req.status != 200) {
        ko.dialogs.alert(_bundle.formatStringFromName("cantLoadKpzUri.alert", [uri], 1),
                         _bundle.formatStringFromName("httpDownloadError", [req.status, req.statusText], 2));
    } else {
        var kpzFile = Components.classes["@mozilla.org/file/local;1"].
             createInstance(Components.interfaces.nsILocalFile);
        kpzFile.initWithPath(kpzExtractFolder);
        kpzFile.append(ko.uriparse.baseName(uri));
        var data = req.responseText;
        var stream = Components.classes["@mozilla.org/network/safe-file-output-stream;1"].
                        createInstance(Components.interfaces.nsIFileOutputStream);
        stream.init(kpzFile, 0x04 | 0x08 | 0x20, /*0600*/384, 0); // write, create, truncate
        stream.write(data, data.length);
        this._importFromPackage(viewMgr, part, kpzFile.path, kpzExtractFolder);
        // This close method will remove/delete the file.
        stream.close();
    }
}

this.toolPathShortName = function(tool) {
    var pieces = [tool.name];
    var parent = tool;
    var name;
    while (parent.parent) {
        parent = parent.parent;
        name = parent.name;
        pieces.push(name);
    }
    pieces.reverse();
    return pieces.join("/");
};

}).apply(ko.projects);
