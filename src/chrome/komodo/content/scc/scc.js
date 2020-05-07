/* Copyright (c) 2007-2008 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/**
 * Source Code Control javascript API.
 *
 * TODO:
 *   * All of the SCC functions in ko.scc require a koISCC service to use.
 *     It would be nice if this service was not required and then determine
 *     the appropriate service from the URL itself.
 */

if (typeof(ko)=='undefined') {
    var ko = {};
}

/* Generic SCC API */
ko.scc = {};
(function() {

    /*-----------------   Internal   -----------------*/

        /**
         * Internal logging control used for this namespace.
         */
    var log = ko.logging.getLogger('SCC');

        /**
         * An array of all scc XPCOM services. Each array item contains a
         * dictionary of: { "name": component_name, "component": scc_service }
         */
    var _sccAllComponents = null;

        /**
         * Internal helper function to retrieve the SCC diff options.
         * @private
         */
    function _getDiffOptions(sccSvc) {
        var options = '';

        // p4 has a special setup for performing diff operations, all others
        // simply use the diff options preference.
        if (sccSvc.name != 'p4' || ko.prefs.getStringPref('p4_diff_type') == 'komododiff') {
            options = ko.prefs.getString(sccSvc.name+'DiffOptions', '');
        }
        return options;
    }

        /**
         * Internal helper function to run an asynchronous scc command.
         * @private
         * @param sccSvc {Components.interfaces.koISCC}  SCC service instance.
         * @param {string} cmdName  The name of the scc command being run.
         * @param {array} urls  The list of urls used.
         * @param {function} postCallback  Function to be called on completion.
         */
    function _genericAsyncSccCommand(sccSvc, cmdName, urls, postCallback) {
        var _log = log;
        var async_callback = {
            "callback": function(result, data) {
                try {
                    // data will be an array of koISCCHistoryItem,
                    // throw it into the tree view.
                    ko.scc.logger.reportSCCAction(sccSvc, cmdName, urls, data, result);
                    if (result == Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {

                        if (cmdName == "revert") {
                            ko.views.manager.revertViewsByURL(urls);
                            // handle reverting projects properly
                            for (var i in urls) {
                                if (urls[i].slice(-14).toLowerCase() == '.komodoproject') {
                                    ko.projects.manager.revertProjectByURL(urls[i]);
                                }
                            }
                        }

                    } else if (result == Components.interfaces.koIAsyncCallback.RESULT_ERROR) {
                        // data should contain the error message then.
                        var title = sccSvc.name + " " + cmdName + " failure";
                        if (!data) {
                            data = cmdName + " could not be completed.";
                        }
                        ko.dialogs.alert(title, data, title);
                    }

                } catch (e) {
                    _log.warn("update callback failed, exception: " + e);
                } finally {
                    _log = null;
                    // If supplied, trigger the callback function.
                    if (postCallback) {
                        postCallback(result, data);
                    }
                }
            }
        };

        if (cmdName == "edit") {
            sccSvc.edit(urls.length, urls, async_callback);
        } else if (cmdName == "add") {
            sccSvc.add(urls.length, urls, '', '', async_callback);
        } else if (cmdName == "remove") {
            var force = true;
            var recursive = false;
            sccSvc.remove(urls.length, urls, force, recursive, async_callback);
        } else if (cmdName == "revert") {
            sccSvc.revert(urls.length, urls, '', async_callback);
        } else if (cmdName == "push") {
            sccSvc.push(null, urls[0], async_callback);
        } else if (cmdName == "getRoot") {
            sccSvc.getRoot(urls, async_callback);
        }
    }

        /**
         * Handle output from SCC update and report the results.
         * @param {string} changes  The output from the scc update command.
         */
    function _handleChanges(changes) {
        //XXX This pattern is specific to CVS update output. What about Perforce
        //    sync output? Is this a bug or is .handleChanges only called for CVS
        //    updates? --TrentM

        // re ^(?P<status>[UPARMC\?]) (?P<file>.*)$
        RegExp.multiline = true;
        var pattern = new RegExp("^([UCDP\\?])\\s+(.*?)\\s+(.*?)$","g");
        var result;
        var conflicts = [];
        var haveConflict = false;
        var removed = [];
        var haveRemoved = false;
        var added = [];
        var haveNew = false;
        var list;
        var i;
        while ((result = pattern.exec(changes)) != null) {
            //dump('found: '+result[1]+' '+result[2]+' '+result[3]+'\n');
            switch (result[1]) {
            case 'C':
                // conflict
                haveConflict = true;
                conflicts.push(result[3]);
                break;
            case 'D':
                // removed
                haveRemoved = true;
                removed.push(result[3]);
                break;
            case 'P':
                break; // Patched file can't be a new file, even though it may not be in our project.
            case 'U':
                // either updated or new file --
                // XXX need to check to make sure that it really is new -- we add
                // all files that aren't in the project
                if (!ko.projects.hasURL(result[3])) {
                    haveNew = true;
                    added.push(result[3]);
                }
                break;
            }
        }
        // look to see if files were added, ask if they should be
        // added to the current project.
        // XXX FIXME this needs to add for each project, not just the current
        var filepart, selectedURLs;
        if (haveNew && ko.projects.manager.getCurrentProject()) {
            //XXX I think either (1) we should 'allowNone' here so the user could
            //    chose to not add new files, yet continue on to remove files, or
            //    better yet (2) we should group the added and removed files and
            //    ask the user to select which updates to carry to their project in
            //    one dialog.
            selectedURLs = ko.dialogs.selectFromList(
                    "Add New Files", // title
                    "Some new files from the repository are not in your "+
                        "project.  Select the files to add to your project.",
                    added,
                    null, // selectionCondition (null means default)
                    ko.uriparse.displayPath); // stringifier
            if (selectedURLs == null) { // user cancelled dialog
                return false;
            }

            for (i = 0; i < selectedURLs.length; i++) {
                filepart = ko.projects.manager.getCurrentProject().createPartFromType('file');
                filepart.setStringAttribute('url', selectedURLs[i]);
                ko.projects.manager.addItem(filepart);
            }
        }
        // look to see if files were removed, notify of removal,
        // ask to remove from projects.
        if (haveRemoved) {
            var aroundToRemove = [];
            for (i = 0; i < removed.length; i++) {
                list = ko.projects.findPartsByURL(removed[i]);
                if (list.length > 0 && !list[0].live) {
                    aroundToRemove.push(selectedURLs[i]);
                }
            }

            selectedURLs = ko.dialogs.selectFromList(
                    "Remove Old Files", // title
                    "Some files have been removed from the repository. "+
                        "Select the files to remove from your projects and "+
                        "toolbox.",
                    aroundToRemove,
                    null, // selectionCondition (null means default)
                    ko.uriparse.displayPath); // stringifier
            if (selectedURLs == null) { // user cancelled dialog
                return false;
            }
            ko.projects.removeItemsByURLList(selectedURLs);
        }

        // look to see if there are conflicts, notify of conflicts,
        // and ask to open the files in komodo.  also mark any
        // items with conflict status
        if (haveConflict) {
            selectedURLs = ko.dialogs.selectFromList(
                    "Merge Conflicts", // title
                    "There are conflicts in some updated file(s). "+
                        "Would you like to open those file(s)?",
                    conflicts,
                    null, // selectionCondition (null means default)
                    ko.uriparse.displayPath); // stringifier
            if (selectedURLs == null) { // user cancelled dialog
                return false;
            }
            ko.open.multipleURIs(selectedURLs);
        }

        // XXX reset the static var, is this necessary?
        RegExp.multiline = false;
        return true;
    }


    /*-----------------   External   -----------------*/

        /**
         * Get the available scc names and components.
         *
         * @param {bool} onlyEnabled  Whether to only return functional
         *                            components (the default is false)
         * @returns {Array}  list of objects containing "name" and "component"
         */
    this.getAvailableSCCComponents = function KoSccGetAvailableSCCComponents(onlyEnabled /*false */) {
        if (_sccAllComponents == null) {
            _sccAllComponents = [];
            var catman = Components.classes["@mozilla.org/categorymanager;1"].
                            getService(Components.interfaces.nsICategoryManager);
            var category = 'category-komodo-scc';
            var names = catman.enumerateCategory(category);
            var nameObj;
            var name;
            var cid;
            var scc_service;
            while (names.hasMoreElements()) {
                nameObj = names.getNext();
                nameObj.QueryInterface(Components.interfaces.nsISupportsCString);
                name = nameObj.data;
                //cid = catman.getCategoryEntry(category, name);
                cid = "@activestate.com/koSCC?type=" + name + ";1";
                try {
                    scc_service = Components.classes[cid].
                                    getService(Components.interfaces.koISCC);
                    _sccAllComponents.push({"name": name, "component": scc_service});
                } catch(ex) {
                    log.exception(ex, "Unable to get " + name + " scc component");
                }
            }
        }
        var scc_components = _sccAllComponents;
        var sccSvc;
        if (onlyEnabled) {
            scc_components = [];
            for (var i=0; i < _sccAllComponents.length; i++) {
                sccSvc = _sccAllComponents[i].component;
                if (!sccSvc.isFunctional || !sccSvc.isEnabled) {
                    continue;
                }
                scc_components.push(sccSvc);
            }
        }
        return scc_components;
    };


        /**
         * Return the SCC services that can handles the supplied koIFile.
         * If Komodo has not yet checked the supplied file for SCC support
         * then it is possible this function will return with no matching
         * service even though the file may be under a SCC system.
         * XXX - How to avoid this, force the fileStatusService to check
         *       the file?
         * @param koIFile {Components.interfaces.koIFileEx}  File needing SCC support.
         * @returns {Components.interfaces.koISCC}  SCC service instance.
         */
    this.getServiceForFile = function KoSccGetServiceForFile(koIFile) {
        try {
            var sccType = koIFile.sccType || koIFile.sccDirType;
            if (!sccType || koIFile.sccExclude) {
                return null;
            }

            var cid = "@activestate.com/koSCC?type=" + sccType + ";1";
            return Components.classes[cid].getService(Components.interfaces.koISCC);
        } catch (e) {
            log.exception(e);
        }
        return null;
    };

        /**
         * Return the SCC services that can handles the supplied koIFile.
         * If Komodo has not yet checked the supplied url/file for SCC support
         * then it is possible this function will return with no matching
         * service even though the file may be under a SCC system.
         * XXX - How to avoid this, force the fileStatusService to check
         *       the file?
         * @param {wstring} url  Url to get the handling SCC services for.
         * @returns {Components.interfaces.koISCC}  SCC service instance.
         */
    this.getServiceForUrl = function KoSccGetServiceForUrl(url) {
        try {
            // Prefer getCurrentService, as it is far more reliable
            var w = require("ko/windows").getMain();
            if (w.ko.places && w.ko.places.manager && w.ko.places.getDirectory) {
                var fileUri = w.ko.places.getDirectory();
                if (url == fileUri || url.indexOf(fileUri) !== -1) return this.getCurrentService();
            }
            
            var fileService = Components.classes["@activestate.com/koFileService;1"].
                               getService(Components.interfaces.koIFileService);
            return this.getServiceForFile(fileService.getFileFromURI(url));
        } catch (e) {
            log.exception(e);
        }
        return null;
    };
    
    this.getWebServiceCurrentFile = function (callback) {
        return this.getWebService(require("ko/views").current().url, callback);
    }
    
    this.getWebService = function (url, callback) {
        var w = require("ko/windows").getMain();
        if ( ! url)
        {
            url = w.ko.places.getDirectory();
        }
        else
        {
            if (w.ko.places && w.ko.places.manager && w.ko.places.getDirectory) {
                var fileUri = w.ko.places.getDirectory();
                if (url == fileUri || url.indexOf(fileUri) !== -1)
                    url = fileUri;
            }
        }
        
        if (url in this.getWebService.cache)
        {
            if (callback)
                callback(this.getWebService.cache[url]);
            return this.getWebService.cache[url];
        }
        
        var sccSvc = this.getServiceForUrl(url);
        if ( ! sccSvc) return;
        
        sccSvc.getValueAsync("push_default_repo", url,
            (result, data) => {
                var r = false;
                if (result == Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL && data.length) {
                    
                    // Github
                    var _data = data.replace("git@github.com:", "https://github.com/");
                    if (_data.endsWith(".git")) {
                        _data = _data.substr(0, _data.length - 4) + "/";
                    }
                    
                    if (_data.indexOf("://github.com/") !== -1) {
                        sccSvc.getValueAsync("current_branch", url, (result2, data2) =>
                        {
                            // Remove any prefix, like "ssh://"
                            _data = _data.replace(/(.*?)(https:\/\/github.com\/)/, "$2")
                            r = {};
                            r.commitTemplate = _data + "commit/%uuid%";
                            r.fileTemplate = _data + "blob/"+data2+"/%path%#L%line%";
                            r.name = "GitHub";
                            
                            this.getWebService.cache[url] = r;
                            if (callback) callback(r);

                            ko.commands.updateCommandset(document.getElementById('SCCMenuItems'));
                        });
                        
                        return;
                    }
                    
                    // Bitbucket
                    _data = data.replace("git@bitbucket.org:", "https://bitbucket.org/");
                    _data = _data.replace(/\/\/(.*?)\@/, '//');
                    if (_data.endsWith(".git")) {
                        _data = _data.substr(0, _data.length - 4) + "/";
                    }
                    if (_data.indexOf("://bitbucket.org/") !== -1) {
                        sccSvc.getValueAsync("current_branch", url, (result2, data2) =>
                        {
                            // Remove any prefix, like "ssh://"
                            _data = _data.replace(/(.*?)(https:\/\/bitbucket.com\/)/, "$2")
                            r = {};
                            r.commitTemplate = _data + "commits/%uuid%";
                            r.fileTemplate = _data + "src/"+data2+"/%path%?fileviewer=file-view-default#%filename%-%line%";
                            r.name = "BitBucket";
                            
                            this.getWebService.cache[url] = r;
                            if (callback) callback(r);
                            
                            ko.commands.updateCommandset(document.getElementById('SCCMenuItems'));
                        });
                        
                        return;
                    }
                }
            }
        );
    };
    this.getWebService.cache = {};
    
    this.getCurrentService = function () {
        sccContextFile = _getSCCContext();
        if ( ! sccContextFile ) return;
        
        var sccType = sccContextFile.sccType;
        var fileUri = sccContextFile.URI;
        
        if (fileUri in this.getCurrentService.cache)
            return this.getCurrentService.cache[fileUri];
        
        try {
            var cid = "@activestate.com/koSCC?type=" + sccType + ";1";
            var result = Components.classes[cid].getService(Components.interfaces.koISCC);
            this.getCurrentService.cache[fileUri] = result;
            window.updateCommands('SCC');
            return result;
        } catch (e) {
            log.debug('Failed retrieving current service');
            log.debug(e.message);
            return false;
        }
    };
    this.getCurrentService.cache = {};
    
    // This function decides what to use as the SCC context
    // It will choose current view over place root directory
    // @return {koFile} The koFile object of the context 
    function _getSCCContext()
    {
        var w = require("ko/windows").getMain();
        if (! w.ko.places || ! w.ko.places.manager || ! w.ko.places.getDirectory) return;
        
        var placesURI = w.ko.places.getDirectory();
        var viewUri = require("ko/views").current().url;
        
        var koFileView = _getKoiFileFromURI(viewUri);
        var koFilePlaces = _getKoiFileFromURI(placesURI);
        
        // If the current view is under SCC use it
        if(koFileView && (koFileView.sccType || koFileView.sccDirType) && ! koFileView.sccExclude)
            return koFileView;
        else if (koFilePlaces && (koFilePlaces.sccType || koFilePlaces.sccDirType) && ! koFilePlaces.sccExclude)
            return koFilePlaces; // Otherwise use places dir
        else
            return;
    }
    
    function _getKoiFileFromURI(uri)
    {
        var fileService = Components.classes["@activestate.com/koFileService;1"].
                           getService(Components.interfaces.koIFileService);
        if (uri && uri.indexOf("file://") === 0)
            return fileService.getFileFromURI(uri);
        return; //invalid or no path given
        
    }
    
    this.getRepositoryRoot = function() {
        var w = require("ko/windows").getMain();
        var svc = w.ko.scc.getCurrentService();
        
        if ( ! svc || ! w.ko.places || ! w.ko.places.manager || ! w.ko.places.getDirectory) return;
        
       var fileUri = _getSCCContext().URI;
        
        if (fileUri in this.getRepositoryRoot.cache)
            return this.getRepositoryRoot.cache[fileUri];
        
        var path = svc.getValue("repository_root", fileUri);
        if ( ! path) return;
        
        var uri = w.ko.uriparse.pathToURI(path);
        this.getRepositoryRoot.cache[fileUri] = uri;
        
        return uri;
    };
    this.getRepositoryRoot.cache = {};


        /**
         * Initialize the output pane.  This is expectly to only be called from
         * onload of the output pane.
         */
    this.initializePane = function KoSccInitializePane(w) {
        this._outputPane = w;
        var view = w.document.getElementById('scin-sccoutput');
        view.initWithBuffer('', 'reStructuredText');
        view.scimoz.setMarginWidthN(view.scimoz.MARGIN_SYMBOLS, 0);
        view.scimoz.wrapMode = 1;
    };

        /**
         * Internal diff helper. Used by both Diff and DiffRevisions.
         * @private
         *
         * @param {string} commandType  The scc command to be performed.
         * @param sccSvc {Components.interfaces.koISCC}  SCC service instance.
         * @param {string} additionalOptions  Additional diff command options.
         * @param {function} postCallback  Function to be called on completion.
         * @param {array} function_args  The list of arguments for the command.
         */
    function _DiffHandler(commandType, sccSvc, additionalOptions,
                                     postCallback, function_args) {
        // We set ko_api namespace to reference the main Window as when
        // this is called from a dialog, and the user has their
        // diff preferences set to 'tab', then the opening of the new
        // diff tab will fail because the dialog will not have a view
        // manager or be able to show tabs, it needs to work through
        // the main Komodo view manager.
        var ko_api = ko.windowManager.getMainWindow().ko;
        var dialog;
        var cwd = null;
        var options = _getDiffOptions(sccSvc);
        var external = sccSvc.getValue("external_diff", "");
        var diffDisplayStyle = ko.prefs.getStringPref('diffDisplayStyle');

        if (additionalOptions) {
            options += " " + additionalOptions;
        }

        var async_callback = {
            "callback": function(result, data) {
                if (external) {
                    // Thanks for the info, but we have nothing to do...
                    return;
                }

                // Grab the variables we need from the settings.
                try {
                    if (!data) {
                        if (diffDisplayStyle == 'diffwin') {
                            dialog.close();
                        }
                        ko_api.dialogs.alert("Files are in sync with repository.",
                                             null, "Diff");
                        return;
                    }

                    if (result == Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
                        if (diffDisplayStyle == 'diffwin') {
                            dialog.arguments[0].diff = data;
                            dialog.arguments[0].cwd = cwd;
                            dialog.arguments[0].async_op = null;
                            if (dialog._diffWindow) {
                                dialog.loadDiffResult(data, cwd);
                            } // else the dialog is not yet fully loaded, the
                              // load routines will call loadDiffResult later.

                        } else if (diffDisplayStyle == 'tab') {
                            ko_api.views.manager.doNewViewAsync('Diff', 'editor', function(view) {
                                view.koDoc.buffer = data;
                                view.koDoc.isDirty = false;
                            });
                        }

                    } else if (result == Components.interfaces.koIAsyncCallback.RESULT_STOPPED) {
                        if (diffDisplayStyle == 'diffwin') {
                            dialog.close();
                        }

                    } else if (result == Components.interfaces.koIAsyncCallback.RESULT_ERROR) {
                        // Only show errors for the internal diff tool.
                        if (diffDisplayStyle == 'diffwin') {
                            dialog.close();
                        }
                        // data should contain the error message then.
                        if (data) {
                            ko_api.dialogs.alert(data);
                        } else {
                            ko_api.dialogs.alert("Diff could not be retrieved.");
                        }
                    }
                } catch (e) {
                    log.exception(e, "could not load diff results");
                } finally {
                    // If supplied, trigger the callback function.
                    if (postCallback) {
                        postCallback(result, data);
                    }
                }
            }
        };

        var async_op;
        var title;
        var urlBasenames;

        if (commandType == 'Diff') {
            if (function_args.length == 1) {
                cwd = ko.uriparse.dirName(function_args);
            } else {
                cwd = ko.uriparse.commonURIPrefixFromURIs(function_args);
            }
            async_op = sccSvc.diff(function_args.length, function_args,
                                   options, external, async_callback);
            urlBasenames = function_args.map(ko.uriparse.baseName);
            title = sccSvc.name + " diff: " + urlBasenames.join(", ");
        } else if (commandType == 'DiffRelative') {
            var baseURI = function_args[0];
            var relpaths = function_args[1];
            cwd = baseURI;
            async_op = sccSvc.diffRelative(baseURI,
                                           relpaths.length, relpaths,
                                           options, external, async_callback);
            urlBasenames = function_args.map(ko.uriparse.baseName);
            title = sccSvc.name + " diff: " + urlBasenames.join(", ");
        } else if (commandType == 'DiffRevisions') {
            async_op = sccSvc.diffRevisions(function_args[0], function_args[1],
                                            function_args[2], function_args[3],
                                            function_args[4],
                                            options, external, async_callback);
            title = sccSvc.name + " diff: " +
                        ko.uriparse.baseName(function_args[0]) +
                        "#" + function_args[1] + ", " +
                        ko.uriparse.baseName(function_args[2]) +
                        "#" + function_args[3];
        }

        if (diffDisplayStyle == 'diffwin' && !external) {
            var obj = {
                "title": title,
                "diff": '',
                "async_op": async_op
            };
            dialog = ko.windowManager.openDialog(
                        "chrome://komodo/content/dialogs/diff.xul",
                        "_blank",
                        "chrome,all,close=yes,resizable=yes,scrollbars=yes",
                        obj);
        }
    }

        /**
         * Perform a diff revisions, and display the results.
         * @param sccSvc {Components.interfaces.koISCC}  SCC service instance.
         * @param {array} urls  The list of urls used.
         * @param {string} additionalOptions  Additional diff command options.
         * @param {function} postCallback  Function to be called on completion.
         */
    this.Diff = function KoSccDiff(sccSvc, urls, additionalOptions, postCallback) {
        // XXX - if no sccSvc, work out what service it needs.
        try {
            _DiffHandler('Diff', sccSvc, additionalOptions, postCallback, urls);
        } catch (e) {
            log.exception(e);
        }
    };

        /**
         * Perform a diff revisions on the relative paths, display the results.
         * @param sccSvc {Components.interfaces.koISCC}  SCC service instance.
         * @param {string} baseURI  The base uri to work from.
         * @param {array} relpaths  The list relative paths to diff.
         * @param {string} additionalOptions  Additional diff command options.
         * @param {function} postCallback  Function to be called on completion.
         */
    this.DiffRelative = function KoSccDiff(sccSvc, baseURI, relpaths,
                                           additionalOptions, postCallback) {
        // XXX - if no sccSvc, work out what service it needs.
        try {
            _DiffHandler('DiffRelative', sccSvc, additionalOptions,
                         postCallback, [baseURI, relpaths]);
        } catch (e) {
            log.exception(e);
        }
    }

        /**
         * Perform a diff revisions, and display the results.
         * @param sccSvc {Components.interfaces.koISCC}  SCC service instance.
         * @param {string} uri1      The first file uri to diff with.
         * @param {string} version1  Version of the first file to use.
         * @param {string} uri1      The second file uri to diff against.
         * @param {string} version2  Version of the second file to use.
         * @param {string} filepath  Local path of the file used to diff.
         * @param {string} additionalOptions  Additional diff command options.
         * @param {function} postCallback  Function to be called on completion.
         */
    this.DiffRevisions = function KoSccDiffRevisions(sccSvc,
                                                     uri1, version1,
                                                     uri2, version2,
                                                     filepath,
                                                     additionalOptions,
                                                     postCallback) {
        // XXX - if no sccSvc, work out what service it needs.
        try {
            var function_args = [arguments[1], arguments[2], arguments[3],
                                 arguments[4], arguments[5]];
            _DiffHandler('DiffRevisions', sccSvc, additionalOptions,
                         postCallback, function_args);
        } catch (e) {
            log.exception(e);
        }
    }

        /**
         * Edit the supplied urls under SCC.
         * @param sccSvc {Components.interfaces.koISCC}  SCC service instance.
         * @param {array} urls  The list of urls to be edited.
         * @param {function} postCallback  Function to be called on completion.
         */
    this.Edit = function(sccSvc, urls, postCallback) {
        _genericAsyncSccCommand(sccSvc, "edit", urls, postCallback);
    }

        /**
         * Add the supplied urls to SCC.
         * @param sccSvc {Components.interfaces.koISCC}  SCC service instance.
         * @param {array} urls  The list of urls to be added.
         * @param {function} postCallback  Function to be called on completion.
         */
    this.Add = function(sccSvc, urls, postCallback) {
        _genericAsyncSccCommand(sccSvc, "add", urls, postCallback);
    }
    
        /**
         * Remove the supplied urls from SCC.
         * @param sccSvc {Components.interfaces.koISCC}  SCC service instance.
         * @param {array} urls  The list of urls to be removed.
         * @param {function} postCallback  Function to be called on completion.
         */
    this.Remove = function(sccSvc, urls, postCallback) {
        var prompt = null;
        // XXX - This should come from the scc service.
        if (sccSvc.name == 'p4') {
            prompt = "Select the file you would like to remove from the " +
                     "repository. (The selected files will be removed from " +
                     "your disk.)";
        } else {
            prompt = "Select the file you would like to remove from the " +
                     "repository.";
        }
        var selectedURLs = ko.dialogs.selectFromList(
                "Remove Files from Source Control", // title
                prompt,
                urls,
                null, // selectionCondition (null means default)
                ko.uriparse.displayPath); // stringifier

        if (selectedURLs != null) { // null if the user cancelled the dialog
            _genericAsyncSccCommand(sccSvc, "remove", selectedURLs, postCallback);
        }
    }

        /**
         * Revert (undo changes for) the supplied urls in SCC.
         * @param sccSvc {Components.interfaces.koISCC}  SCC service instance.
         * @param {array} urls  The list of urls to be added.
         * @param {function} postCallback  Function to be called on completion.
         */
    this.Revert = function(sccSvc, urls, postCallback) {
        log.debug("doRevert...");
        var selectedURLs = ko.dialogs.selectFromList(
                "Revert Files to Repository", // title
                "Select the files to revert to the repository version. "+
                    "(Changes in opened documents will be lost).",
                urls,
                null, // selectionCondition (null means default)
                ko.uriparse.displayPath); // stringifier

        if (selectedURLs != null) { // null if the user cancelled the dialog
            _genericAsyncSccCommand(sccSvc, "revert", selectedURLs, postCallback);
        }
    }

        /**
         * Commit the changes for the supplied urls into SCC.
         * @param sccSvc {Components.interfaces.koISCC}  SCC service instance.
         * @param {array} urls  The list of urls to be commited.
         * @param {string} message  The checkin message.
         * @param {function} postCallback  Function to be called on completion.
         */
    this.Commit= function(sccSvc, urls, message, postCallback) {
        var dialog;
        
        if (typeof(urls) == 'undefined') urls = null;
        if (typeof(message) == 'undefined') message = null;

        var obj = new Object();
        obj.urls = urls;
        obj.message = message;
        obj.sccSvc = sccSvc;
        obj.type = "commit";
        obj.callback = postCallback;

        // Show the dialog.
        dialog = ko.windowManager.openDialog("chrome://komodo/content/scc/commit.xul",
                                                "_blank",
                                                "chrome,titlebar,resizable=yes",
                                                obj);
    }

        /**
         * Load the SCC history dialog for the given urls.
         * @param sccSvc {Components.interfaces.koISCC}  SCC service instance.
         * @param {array} urls  The list of urls.
         * @param {array} localRevisions  The matching list of current scc file
         *                                versions, must be one for every url.
         */
    this.History = function(sccSvc, urls, localRevisions) {
        // Show the dialog.
        var obj = new Object();
        obj.urls = urls;
        obj.localRevisions = localRevisions;
        obj.sccHandler = sccSvc;
        ko.windowManager.openDialog(
            "chrome://komodo/content/scc/history.xul",
            "_blank",
            "chrome,titlebar,resizable=yes",
            obj);
    }

        /**
         * Update the supplied urls for latest SCC contents.
         * @param sccSvc {Components.interfaces.koISCC}  SCC service instance.
         * @param {array} urls  The list of urls.
         * @param {function} postCallback  Function to be called on completion.
         */
    this.Update = function(sccSvc, urls, postCallback) {
        var _log = log;
        var async_callback = {
            "callback": function(result, data) {
                try {
                    // data will be an array of koISCCHistoryItem,
                    // throw it into the tree view.
                    ko.scc.logger.reportSCCAction(sccSvc, "update", urls, data, result);
                    if (result == Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
                        ko.views.manager.revertViewsByURL(urls);
                        /* Force a refresh here: bug 85294, to refresh all
                           url's. XXX: This could be optimized later... */
                        ko.window.checkDiskFiles();
                        if (data) {
                            _handleChanges(data);
                        }
                    } else if (result == Components.interfaces.koIAsyncCallback.RESULT_ERROR) {
                        // data should contain the error message then.
                        var title = sccSvc.name + " update failure";
                        if (!data) {
                            data = "Update could not be completed.";
                        }
                        ko.dialogs.alert(title, data, title);
                    }
                } catch (e) {
                    _log.warn("update callback failed, exception: " + e);
                } finally {
                    _log = null;
                    // If supplied, trigger the callback function.
                    if (postCallback) {
                        postCallback(result, data);
                    }
                }
            }
        }

        sccSvc.update(urls.length, urls, '', async_callback);
    }
    

        /**
         * Pull the supplied urls for latest SCC contents.
         * @param sccSvc {Components.interfaces.koISCC}  SCC service instance.
         * @param {array} urls  The list of urls.
         * @param {function} postCallback  Function to be called on completion.
         */
    this.Pull = function(sccSvc, urls, rebase, postCallback) {
        var _log = log;
        var async_callback = {
            "callback": function(result, data) {
                try {
                    // data will be an array of koISCCHistoryItem,
                    // throw it into the tree view.
                    ko.scc.logger.reportSCCAction(sccSvc, "pull", urls, data, result);
                    if (result == Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
                        ko.views.manager.revertViewsByURL(urls);
                        /* Force a refresh here: bug 85294, to refresh all
                           url's. XXX: This could be optimized later... */
                        ko.window.checkDiskFiles();
                        if (data) {
                            _handleChanges(data);
                        }
                    } else if (result == Components.interfaces.koIAsyncCallback.RESULT_ERROR) {
                        // data should contain the error message then.
                        var title = sccSvc.name + " pull failure";
                        if (!data) {
                            data = "Pull could not be completed.";
                        }
                        ko.dialogs.alert(title, data, title);
                    }
                } catch (e) {
                    _log.warn("pull callback failed, exception: " + e);
                } finally {
                    _log = null;
                    // If supplied, trigger the callback function.
                    if (postCallback) {
                        postCallback(result, data);
                    }
                }
            }
        }

        sccSvc.pull(urls.length, urls, '', async_callback);
    }    

        /**
         * Update the supplied urls for latest SCC contents.
         * @param sccSvc {Components.interfaces.koISCC}  SCC service instance.
         * @param {array} urls  The list of urls.
         * @param {function} postCallback  Function to be called on completion.
         */
    this.Cat = function(sccSvc, baseName, cwd, postCallback) {
        var _log = log;
        var async_callback = {
            "callback": function(result, data) {
                try {
                    // data will be the text of the file on disk.
                    // Try not to call this too often.
                    //ko.scc.logger.reportSCCAction(sccSvc, "cat", [baseName], data, result);
                    if (result == Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
                        // do nothing.
                    } else if (result == Components.interfaces.koIAsyncCallback.RESULT_ERROR) {
                        ko.scc.logger.reportSCCAction(sccSvc, "cat", [baseName], data, result);
                    }
                } catch (e) {
                    _log.warn("cat callback failed, exception: " + e);
                } finally {
                    _log = null;
                    // If supplied, trigger the callback function.
                    if (postCallback) {
                        postCallback(result, data);
                    }
                }
            }
        }
        sccSvc.cat(baseName, cwd, '', async_callback);
    }

        /**
         * Checkout a SCC repository.
         * @param {string} checkoutFolder (optional) Initial checkout directory.
         */
    this.Checkout = function(checkoutFolder) {
        // Show the dialog.
        var obj = new Object();
        obj.checkoutFolder = checkoutFolder;
        ko.windowManager.openDialog(
            "chrome://komodo/content/scc/checkout.xul",
            "_blank",
            "chrome,titlebar,resizable=yes",
            obj);
    }

    this.Push = function(sccSvc, files, postCallback) {
        ko.windowManager.openDialog(
            "chrome://komodo/content/scc/push.xul",
            "_blank",
            "chrome,titlebar,resizable=yes",
            {
                sccSvc: sccSvc,
                callbackFn: function() {},
                repo: files,
            });
    };

        /**
         * Warn the user about enabling CVS and SVN SSH integration.
         */
    this.warnSSHConfiguration = function SCCWarnAboutSSHIfNecessary() {
        var osSvc = Components.classes["@activestate.com/koOs;1"].getService();
        var CVS_RSH = osSvc.getenv('CVS_RSH');
        var SVN_SSH = osSvc.getenv('SVN_SSH');
        var msg, answer;
        // Only bother warning if CVS_RSH is set and CVS integration and CVS
        // background checking are enabled.
        if (CVS_RSH
            && ko.prefs.getBooleanPref("cvsEnabled")
            && ko.prefs.getBooleanPref("cvsBackgroundCheck")
            // Checking this pref (seemingly redundantly) here is necessary
            // because the pref is being used to mean:
            //  "don't ask or do anything if true"
            // rather than the usual meaning:
            //  "don't ask, just presume user wants same action as last time"
            && !ko.prefs.getBooleanPref("donotask_cvs_ssh_setup_warning")
           )
        {
            msg = "The CVS_RSH environment variable is set to '"+CVS_RSH+
                "' and CVS Background Status Checking is currently turned "+
                "on.  Failure to properly configure CVS authentication may "+
                "result in process lockups within Komodo.  Please read the "+
                "Komodo documentation regarding the use of external "+
                "protocols, such as SSH, with Komodo.  \nIf you are sure "+
                "you have properly configured CVS/SSH authentication on "+
                "your machine, click 'Keep Enabled'.  Otherwise click "+
                "'Disable' to disable Komodo's CVS integration for now. "+
                "When you are sure you have setup CVS properly you can "+
                "re-enable CVS integration in Edit|Preferences|Source Control|CVS.";
            answer = ko.dialogs.customButtons(msg,
                ["Disable", "Disable and Tell Me More", "Keep Enabled"],
                "Disable", null, "Komodo CVS Integration",
                "cvs_ssh_setup_warning");
            switch (answer) {
                case "Keep Enabled":
                    break;
                case "Disable and Tell Me More":
                    ko.help.open("scc.html#config_cvs");
                    // fall through
                case "Disable":
                case "Cancel":
                    ko.prefs.setBooleanPref("cvsEnabled", false);
            }
        }

        if (SVN_SSH
            && ko.prefs.getBooleanPref("svnEnabled")
            && ko.prefs.getBooleanPref("svnBackgroundCheck")
            // Checking this pref (seemingly redundantly) here is necessary
            // because the pref is being used to mean:
            //  "don't ask or do anything if true"
            // rather than the usual meaning:
            //  "don't ask, just presume user wants same action as last time"
            && !ko.prefs.getBooleanPref("donotask_svn_ssh_setup_warning")
           )
        {
            msg = "The SVN_SSH environment variable is set to '"+SVN_SSH+
                      "' and Subversion Background Status Checking is "+
                      "currently turned on.  Failure to properly "+
                      "configure Subversion authentication may result "+
                      "in process lockups within Komodo.  Please read "+
                      "the Komodo documentation regarding the use of "+
                      "external protocols, such as SSH, with Komodo.  \n"+
                      "If you are sure you have properly configured "+
                      "Subversion/SSH authentication on your machine, "+
                      "click 'Keep Enabled'.  Otherwise click 'Disable' "+
                      "to disable Komodo's Subversion integration for "+
                      "now. When you are sure you have setup Subversion "+
                      "properly you can re-enable Subversion integration "+
                      "in Edit|Preferences|Source Control|Subversion.";
            answer = ko.dialogs.customButtons(msg,
                ["Disable", "Disable and Tell Me More", "Keep Enabled"],
                "Disable", null, "Komodo Subversion Integration",
                "svn_ssh_setup_warning");
            switch (answer) {
                case "Keep Enabled":
                    break;
                case "Disable and Tell Me More":
                    ko.help.open("scc.html#config_svn");
                    // fall through
                case "Disable":
                case "Cancel":
                    ko.prefs.setBooleanPref("svnEnabled", false);
            }
        }
    }
    
    var checkAgain = false;
    var isEnabled = (button, checkAgain = true) =>
    {
        var service = ko.scc.getCurrentService();
        var enabled = !! service;
        if ( ! enabled)
        {
            if (checkAgain)
            {
                checkAgain = false;
                setTimeout(button.update.bind(button), 1000);
            }
            return false;
        }
        var root = ko.scc.getRepositoryRoot();
        service.status_count(1, [root], (nr, count) =>
        {
            button.setCounter(count);
        });
        return true;
    };

    this.initDynamicButtons = function () {
        var dynBtn = require("ko/dynamic-button");
        dynBtn.register("Source Code Control", {
            icon: "scc",
            events: ["scc_current_view", "SCC", "current_place_opened", "file_saved"],
            classList: "scc-menu",
            menuitems: this.updateDynamicMenu,
            menuitemsInitialize: this.getInitializeMenu,
            groupOrdinal: 300,
            isEnabled: (button) => {
                checkAgain = true;
                return isEnabled(button);
            }
        });
    };
    
    this.getInitializeMenu = function() {
        return [
            {
                label: "Checkout / Clone Repository",
                command: "cmd_SCCcheckout",
            }
        ]
    };

    this.updateDynamicMenu = function () {
        ko.commands.updateCommandset(document.getElementById('SCCMenuItems'));
        return document.getElementById('popup_file_menupopup').cloneNode(true);
    };
    
    /**
     * Load the statusbar SCC component for the given view
     * 
     * @param   {Element} view 
     */
    this.loadStatusbar = function (view) {
        var $ = require("ko/dom");
        var statuspanel = $('#sccStatusbar').clone();
        statuspanel.removeAttr("id");
        
        var $view = $(view);
        
        // Insert our statusbarpanel after the language selection
        var sibling = $view.findAnonymous("anonid", "statusbar-language");
        sibling.after(statuspanel);
        view._sccStatusPanel = statuspanel;
        
        // Now actually update it (set it to show the current branch name)
        this.updateStatuspanel(view);
        
        statuspanel.find('[anonid="sccBranchButton"]').on("popupshowing", this.updateStatuspanelMenu.bind(this, view));
    };
    
    /**
     * Update the statusbar SCC component to show the current branch name
     * 
     * @param   {Element|Undefined} view 
     */
    this.updateStatuspanel = function (view) {
        view = view || ko.views.manager.currentView;
        if ( ! ("uid" in view))
            view = ko.views.manager.currentView;
            
        var statuspanel = view._sccStatusPanel;
        
        // Validate the view
        if ( ! view.koDoc || ! view.koDoc.file) {
            statuspanel.hide();
            return;
        }
        
        // Check if file is under SCC
        var sccSvc = ko.scc.getServiceForFile(view.koDoc.file);
        if ( ! sccSvc) {
            return;
        }
        
        // Retrieve the current branch
        sccSvc.getValueAsync("current_branch", view.koDoc.file.path, function(result, data) {
            if (result != Ci.koIAsyncCallback.RESULT_SUCCESSFUL) {
                log.debug(`current_branch failed for ${view.koDoc.file.path}, result: ${result}, data: ${data}`);
                return;
            }
            
            if (data == "") {
                return;
            }
            
            statuspanel.find('[anonid="sccBranchButton"]').attr("label", data);
            statuspanel.show();
        });
    };
    
    /**
     * Update the statusbar SCC component menupopup to list all available branches
     * 
     * @param   {Element|undefined} view 
     */
    this.updateStatuspanelMenu = function (view) {
        var $ = require("ko/dom");
        
        view = view || ko.views.manager.currentView;
        if ( ! ("uid" in view))
            view = ko.views.manager.currentView;
        
        var sccSvc = ko.scc.getServiceForFile(view.koDoc.file);
        if ( ! sccSvc) {
            return;
        }
        
        // Check whether our SCC system also supports checking out a branch,
        // if not the menuitems will not be interactive (cannot change branch)
        var supportsCheckout = sccSvc.getValue("supports_command", "checkout_branch");
        
        // Prepare the menupopup
        var statuspanel = view._sccStatusPanel;
        var button = statuspanel.find('[anonid="sccBranchButton"]');
        var popup = button.find('menupopup');
        
        popup.empty();
        popup.append($("<menuitem>").attr({
                        label: "Loading ..",
                        disabled: "true"
                    }));
        
        // Get available (local) branches
        sccSvc.getValueAsync("branches", view.koDoc.file.path, function(result, data) {
            if (result != Ci.koIAsyncCallback.RESULT_SUCCESSFUL) {
                log.debug(`branches failed for ${view.koDoc.file.path}, result: ${result}, data: ${data}`);
                return;
            }
            
            popup.empty();
            
            // Iterate over available branch names
            Array.slice(data).forEach(function(branch) {
                
                // Create the menu item
                var menuitem = $("<menuitem>").attr({
                    type: "radio",
                    label: branch,
                    checked: branch == button.attr("label"),
                    disabled: ! supportsCheckout
                });
                popup.append(menuitem);
                
                // If the SCC supports checking out the branch, bind the event listener for this
                if (supportsCheckout) {
                    menuitem.on("command", function() {
                        
                        sccSvc.checkout_branch(view.koDoc.file.path, branch, function(result, data) {
                            if (result != Ci.koIAsyncCallback.RESULT_SUCCESSFUL) {
                                log.error(`checkout_branch failed, result: ${result}, data: ${data}`);
                                require("ko/dialogs").alert(`Selecting the "${branch}" branch failed.`, {text: data});
                                return;
                            }
                            ko.scc.updateStatuspanel();
                        });
                        
                    });
                }
                
            }); // end branch loop
        }); // end branches callback
    };
    
}).apply(ko.scc);

/* For the main Komodo SCC scintilla widget - logging handling. */
ko.scc.logger = {};

(function() {

    const Cc = Components.classes;
    const Ci = Components.interfaces;

    /**
     * Internal logger; note that this is shared with ko.scc
     */
    var log = ko.logging.getLogger('SCC');

    this._lastMessage = null;

        /**
         * One off initialization of the SCC output panel text.
         */
    this.init = function SCCScinInit() {
        window.addEventListener("unload", ko.scc.logger.finalize, false);
    }

    this.finalize = function SCCScinFinalize() {
    }

        /**
         * Report the SCC command results in the main Komodo SCC output panel.
         * @param {Components.interfaces.koISCC} sccSvc SCC service instance.
         *        Alternatively, a string.
         * @param {string} cmdName  The name of the scc command.
         * @param {array} urls  The list of urls used.
         * @param {string or nsIPropertyBag} text  The command output text.
         *          If this is a property bag, it should have at least a "text"
         *          property with the text to display; it may optionally have an
         *          "extra" property containing extra text for the summary.
         * @param {int} result  The result of the action (one of koIAsyncCallback::RESULT_*)
         */
    this.reportSCCAction = function SCCScinReportAction(sccSvc, cmdName, urls, text, result)
    {
        var extra = "";
        if ((text instanceof Ci.nsIPropertyBag2) && text.hasKey("text")) {
            if (text.hasKey("extra")) {
                extra = text.getPropertyAsAString("extra");
            }
            text = text.getPropertyAsAString("text");
        }
        var severity = Ci.koINotification.SEVERITY_INFO;
        var cmdDescKey = cmdName;
        var cmdDesc = cmdName;
        switch (result) {
            case Ci.koIAsyncCallback.RESULT_SUCCESSFUL:
                severity = Ci.koINotification.SEVERITY_INFO;
                cmdDescKey += "Success";
                break;
            case Ci.koIAsyncCallback.RESULT_STOPPED:
                severity = Ci.koINotification.SEVERITY_WARNING;
                cmdDescKey += "Aborted";
                cmdDesc += " aborted";
                break;
            case Ci.koIAsyncCallback.RESULT_ERROR:
                severity = Ci.koINotification.SEVERITY_ERROR;
                cmdDescKey += "Failure";
                cmdDesc += " failure";
                break;
        }

        try {
            cmdDesc = this._stringBundle.GetStringFromName(cmdDescKey);
        } catch (e) {
            /* ignore, cmdDesc is hard coded English */
        }

        var title = cmdDesc  + " on ";
        var display = ko.uriparse.displayPath(urls[0]);
        if (urls.length > 1) {
            title += display + ', ... (' + urls.length + ' files/directories)';
        } else {
            title += display;
        }
        title += extra + ".";

        var executable = sccSvc ? sccSvc.executable || sccSvc.name || sccSvc : "SCC";
        var output = executable + " " + cmdName+'\n';
        for each (var url in urls) {
            output += '    ' + url + '\n';
        }
        output += text;

        var message =  this.addMessage(sccSvc ? sccSvc.name || sccSvc : "SCC",
                                       severity, title, output);
        this.show(message);
        return message;
    }

    this.addMessage = function SCCScinAddMessage(sccName, severity, title, details) {
        if (typeof(severity) == "undefined")
            severity = Ci.koINotification.SEVERITY_INFO;
        this._lastMessage = ko.notifications.add(sccName, ["scc", sccName || ""],
                                                 "scc-message-" + Date.now(),
                                                 { severity: severity,
                                                   description: title || "",
                                                   details: details || "",
                                                   progress: 100,
                                                   maxProgress: 100});
        
        var text = details || title;
        var outputPane = require("ko/windows").getMain().ko.scc._outputPane
        if (outputPane && text)
        {
            var scin = outputPane.document.getElementById('scin-sccoutput').scimoz;
            scin.readOnly = false;
            scin.currentPos = scin.textLength-1;
            // move cursor to end of current text
            text = "\n-------------------------------------------------------------------\n" +		
                text.trim();
            scin.addText(text.length, text);
            scin.gotoLine(scin.lineFromPosition(scin.textLength));
            scin.readOnly = true;
        }
        
        return this._lastMessage;
    };

        /**
         * Show the main Komodo SCC output panel, will ask if the user wants
         * to see it.
         */
    this.show = function SCCTab_Show(message)
    {
        var show = ko.uilayout.isTabShown("notifications-widget");
        if (!show) {
            if (ko.dialogs.yesNo("Show SCC Output Messages?", // prompt
                             "Yes", // response
                             null, // text
                             null, // title
                             'show_scc_tab') == "Yes") {
                show = true;
                ko.uilayout.ensureTabShown("notifications-widget");
            }
        }
        if (show && message) {
            // got a message; try to focus it
            try {
                var widget = document.getElementById("notifications-widget");
                var win = widget.contentWindow;
                // do this on a timeout because the message may not
                // have been added yet
                setTimeout(win.focusNotification.bind(win, message), 0);
            } catch (ex) {
                log.exception(ex);
            }
        }
    }

    Object.defineProperty(this, "_stringBundle", {
        get: function() {
            if (!("__stringBundle" in this)) {
                this.__stringBundle = Cc["@mozilla.org/intl/stringbundle;1"]
                                        .getService(Ci.nsIStringBundleService)
                                        .createBundle("chrome://komodo/locale/scc.properties");
            }
            return this.__stringBundle;
        },
        configurable: true,
        enumerable: true,
    });

}).apply(ko.scc.logger);

(function() {
    function init_scc() {
        ko.scc.warnSSHConfiguration();
        ko.scc.logger.init();
        
        ko.scc.initDynamicButtons();
    }
    window.addEventListener("komodo-ui-started", init_scc, false);
    window.addEventListener("current_place_opened", function() {
        ko.scc.getCurrentService.cache = {};
        ko.scc.getRepositoryRoot.cache = {};
        ko.scc.getWebService.cache = {};
        ko.scc.getRepositoryRoot();
        ko.scc.getWebService();
    });
    
    var viewChanged = function(e)
    {
        var view = e.detail.view;
        if ( ! view && view._sccStatusInit) return;
        view._sccStatusInit = true;
        ko.scc.loadStatusbar(view);
        ko.scc.getWebServiceCurrentFile();
    };
    
    var _ = require("contrib/underscore");
    var updateStatuspanel = _.debounce(ko.scc.updateStatuspanel, 500);
    window.addEventListener('editor_view_opened', viewChanged);
    window.addEventListener('current_view_changed', updateStatuspanel);
    window.addEventListener('SCC', updateStatuspanel);
    
    var observer = {
        observe: (bogus, event, data) =>
        {
            if ( ! ko.views)
                return;

            var view = ko.views.manager.currentView;
            if ( ! view || ! view.koDoc || ! view.koDoc.file || ! view.koDoc.file.sccStatus)
                return;
            var viewUri = view.koDoc.file.URI;

            var uris = data.split("\n");
            for (let uri of uris)
            {
                if (uri == viewUri)
                {
                    var evt = new CustomEvent("scc_current_view", { bubbles: true, cancelable: true });
                    window.dispatchEvent(evt);
                }
            }
        }
    };

    var observerSvc = Components.classes["@mozilla.org/observer-service;1"]
                                    .getService(Components.interfaces.nsIObserverService);
    observerSvc.addObserver(observer, "file_status", false);

})();
