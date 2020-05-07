/* Copyright (c) 2000-2011 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

(function() {
    var _tdkController = null;

    function TDKItemsController() {
        this.log = ko.logging.getLogger("TDK");
        //this.log.setLevel(ko.logging.LOG_DEBUG);
        this.log.debug("TDKItemsController init");
        ko.tcldevkit.initialize();
        try {
            window.controllers.appendController(this);

            ko.main.addWillCloseHandler(this.destroy.bind(this));
        } catch(e) {
            this.log.exception(e);
        }
    }

    // The following two lines ensure proper inheritance (see Flanagan, p. 144).
    TDKItemsController.prototype = new xtk.Controller();
    TDKItemsController.prototype.constructor = TDKItemsController;

    // ================================================================================
    // Controller helper functions.

    TDKItemsController.prototype.destroy = function() {
        window.controllers.removeController(this);
    }

    TDKItemsController.prototype._canrun = function(tdkinfo, app) {
        // For this iteration of the toolbar an application can be invoked
        // if it exists.
        return tdkinfo.hasApp(app);

    // can invoke app if we have a current buffer, and it is for language Tcl, and the app exists.
    //   return ko.views.manager.currentView &&
    //            typeof(ko.views.manager.currentView.koDoc.file) != 'undefined' &&
    //            ko.views.manager.currentView.koDoc.language == "Tcl" &&
    //            tdkinfo.hasApp(app);
    }

    function __quote_arg(arg) {
        if (arg.indexOf(' ') != -1) {
            arg = arg.replace('"', '\\"', "g");
            arg = '"'+arg+'"';
        }
        return arg;
    }

    TDKItemsController.prototype._runAppDirect = function(tdkinfo, app, options, filename, cwd, env, project)
    {
        // Invoke the specified application with the given options, and
        // in the specified working directory.

        // If a 'project' file was specified it is added as last
        // argument. Otherwise, if a file was specified it is the last
        // argument. If neither is specified the application is called as
        // is, just wih the options.

        this.log.debug("_runAppDirect("+app+", "+options+", "+filename+", "+cwd+", "+env+", "+project+")");
        try {

            // Locate the application, and bail if it doesn't exist.
            var appPath = tdkinfo.getAppPath(app);
            if (!appPath) {
                ko.dialogs.alert("Unable to locate "+app);
                return false;
            }

            // Put focus on the current buffer
            if (ko.views.manager.currentView) { ko.views.manager.currentView.setFocus() };

            // Add the options to the command, if there are any.
            var cmd = __quote_arg(appPath)+' ';
            if (typeof(options) != 'undefined' && options) {
                var opt;
                for (var k in options) {
                    cmd += (k
                            + " "
                            + __quote_arg(options[k])
                            + " ");
                }
            }

            // Make project file last argument if defined and exists,
            // or file, if defined,
            // or nothing.

            if (typeof(project) != 'undefined' && project && Services.koOsPath.exists(project)) {
                cmd += __quote_arg(project);
            } else if (typeof(filename) != 'undefined' && filename) {
                cmd += __quote_arg(filename);
            }

            // Compute a working directory based on the file to work on,
            // if none was defined, and we have a file to base it on.
            if (typeof(cwd) == 'undefined')
                cwd = null;
            if (!cwd && typeof(filename) != 'undefined' && filename) {
                cwd = Services.koOsPath.dirname(filename)
            }

            this.log.debug(cmd);
            return ko.run.runCommand(window, cmd, cwd, env,
                                  false, false, true, 'no-console', false, false, false);
        } catch(e) {
            this.log.exception(e);
        }
        return false;
    }

    TDKItemsController.prototype._runAppEx = function(tdkinfo, app, options, filename, cwd, env, project)
    {
        // This function is essentially the same as _runAppDirect, except
        // it checks first if we have a license for the TDK. This is done
        // only so that Komodo can pop up a nice 'no license' dialog
        // instead of having it done by the TDK application itself.

        // NOTE: does this handle trial licenses properly ?

        // Here we add the hasLicense() call, when we come to want/need it again.
        return this._runAppDirect(tdkinfo, app, options, filename, cwd, env, project);
    }

    TDKItemsController.prototype._runApp = function(tdkinfo, app)
    {
        // Main function to invoke a TDK application.
        // Uses the file behind the current buffer as file to use.
        // Derives a 'project file' from the file behind the current buffer.
        // No options are computed or defined for the app.

        var filename = ko.views.manager.currentView.koDoc.file.path;
        var env = null;
        var options = null;
        var cwd = null;

        return this._runAppEx(tdkinfo, app,
                            options,     // No options
                            filename,    // current buffer
                            cwd,         // no working directory, derive from filename
                            env,         // no environment
                            this._getProjectName(filename, app));
    }

    TDKItemsController.prototype._getSibling = function(filename, thesibling)
    {
        // Derive a 'project file' name from the file, as sibling of FOO.

        var dir = Services.koOsPath.dirname(filename);
        return Services.koOsPath.joinlist(2, [dir, thesibling]);
    }

    TDKItemsController.prototype._getProjectName = function(filename, app)
    {
        // Derive a 'project file' name from the file. For a file FOO.EXT
        // and application A the project file is FOO.A

        // If A is not specified (null) the standard extension .tpj is assumed.

        var fn = null;
        if (app) {
            fn  = Services.koOsPath.withoutExtension(Services.koOsPath.basename(filename))+"."+app;
        } else {
            fn  = Services.koOsPath.withoutExtension(Services.koOsPath.basename(filename))+".tpj";
        }

        var dir = Services.koOsPath.dirname(filename);
        return Services.koOsPath.joinlist(2, [dir, fn]);
    }

    TDKItemsController.prototype._getPkgEditorOptions = function()
    {
        if (ko.views.manager.currentView &&
            typeof(ko.views.manager.currentView.koDoc.file) != 'undefined' &&
            ko.views.manager.currentView.koDoc.language == "Tcl" &&
            ko.views.manager.currentView.getAttribute('type') == 'editor') {

            // We have a current buffer, this buffer is for the language
            // Tcl, and it is editable.

            // We look for the following things, in the given order.
            // sibling .tclpe file (to be consistent with tclapp, tclcompiler)
            // sibling .tap file
            // sibling teapot.txt file
            // use current file if extension in (.tcl, .tm, .zip, .exe, .kit)

            var project = null;
            var current = ko.views.manager.currentView.koDoc.file.path;

            project = this._getProjectName (current, 'tclpe');
            if (Services.koOsPath.exists(project)) {
                return { '-gui' : project };
            }

            project = this._getProjectName (current, 'tap');
            if (Services.koOsPath.exists(project)) {
                return { '-gui' : project };
            }

            project = this._getSibling (current, 'teapot.txt');
            if (Services.koOsPath.exists(project)) {
                return { '-gui' : project };
            }

            if ((Services.koOsPath.getExtension(current) == '.tm')  ||
                (Services.koOsPath.getExtension(current) == '.tcl') ||
                (Services.koOsPath.getExtension(current) == '.zip') ||
                (Services.koOsPath.getExtension(current) == '.exe') ||
                (Services.koOsPath.getExtension(current) == '.kit')) {
                return { '-gui' : current };
            }
        }

        // Default: Invoke without options, file, project, or other.
        return null;
    }

    TDKItemsController.prototype._getGUIOptions = function(app)
    {
        if (ko.views.manager.currentView &&
            typeof(ko.views.manager.currentView.koDoc.file) != 'undefined' &&
            ko.views.manager.currentView.koDoc.language == "Tcl" &&
            ko.views.manager.currentView.getAttribute('type') == 'editor') {

            // We have a current buffer, this buffer is for the language
            // Tcl, and it is editable.
            //
            // We now look for a sibling file ending in either .<app>, or
            // .tpj, and invoke <app> with this sibling as project file.

            var project = null;
            var current = ko.views.manager.currentView.koDoc.file.path;

            project = this._getProjectName (current, app);
            if (Services.koOsPath.exists(project)) {
                return { '-gui' : project };
            }

            project = this._getProjectName (current, null);
            if (Services.koOsPath.exists(project)) {
                return { '-gui' : project };
            }
        }

        // Default: Invoke without options, file, project, or other.
        return null;
    }

    // ================================================================================
    // Controller functions for launching the various TDK applications.

    // --------------------------------------------------------------------------------
    // TclApp - Basic and advanced invokation (.tclapp/.tpj sibling project file)

    TDKItemsController.prototype.is_cmd_tdkLaunchTclApp_enabled = function () {
        return ko.tcldevkit.info.hasApp('tclapp');
    }
    TDKItemsController.prototype.do_cmd_tdkLaunchTclApp = function() {
        return this._runAppEx(ko.tcldevkit.info,'tclapp',
                              this._getGUIOptions('tclapp'),
                              null, null, null, null);
    }

    // --------------------------------------------------------------------------------
    // TclCompiler - See TclApp

    TDKItemsController.prototype.is_cmd_tdkLaunchTclCompiler_enabled = function () {
        return ko.tcldevkit.info.hasApp('tclcompiler');
    }
    TDKItemsController.prototype.do_cmd_tdkLaunchTclCompiler = function() {
        return this._runAppEx(ko.tcldevkit.info,'tclcompiler',
                              this._getGUIOptions('tclcompiler'),
                              null, null, null, null);
    }

    // --------------------------------------------------------------------------------
    // TclSvc - Basic invokation, no further command line

    TDKItemsController.prototype.is_cmd_tdkLaunchTclSvc_enabled = function () {
        return ko.tcldevkit.info.hasApp('tclsvc');
    }
    TDKItemsController.prototype.do_cmd_tdkLaunchTclSvc = function() {
        // Invoke without options, file, project, or other.
        return this._runAppEx(ko.tcldevkit.info,'tclsvc', null, null, null, null, null);
    }

    // --------------------------------------------------------------------------------
    // TclXref

    TDKItemsController.prototype.is_cmd_tdkLaunchTclXref_enabled = function () {
        return ko.tcldevkit.info.hasApp('tclxref');
    }
    TDKItemsController.prototype.do_cmd_tdkLaunchTclXref = function() {
        // Invoke without options, file, project, or other.
        return this._runAppEx(ko.tcldevkit.info,'tclxref', null, null, null, null, null);
    }

    // --------------------------------------------------------------------------------
    // TclVFSE - Basic invokation. Has command line, but not useful for
    // calling by Komodo; from a toolbar at least.

    TDKItemsController.prototype.is_cmd_tdkLaunchTclVFSE_enabled = function () {
        return ko.tcldevkit.info.hasApp('tclvfse');
    }
    TDKItemsController.prototype.do_cmd_tdkLaunchTclVFSE = function() {
        // Invoke without options, file, project, or other.
        return this._runAppEx(ko.tcldevkit.info,'tclvfse', null, null, null, null, null);
    }

    // --------------------------------------------------------------------------------
    // TclInspector - Basic invokation. No command line.

    TDKItemsController.prototype.is_cmd_tdkLaunchTclInspector_enabled = function () {
        return ko.tcldevkit.info.hasApp('tclinspector');
    }
    TDKItemsController.prototype.do_cmd_tdkLaunchTclInspector = function() {
        // Invoke without options, file, project, or other.
        return this._runAppEx(ko.tcldevkit.info,'tclinspector', null, null, null, null, null);
    }

    // --------------------------------------------------------------------------------
    // TclPE (Package Editor) - Basic and advanced (sibling .tap, .tclpe, teapot.txt, .tcl, .tm (embedded))

    TDKItemsController.prototype.is_cmd_tdkLaunchTclPE_enabled = function () {
        return ko.tcldevkit.info.hasApp('tclpe');
    }
    TDKItemsController.prototype.do_cmd_tdkLaunchTclPE = function() {
        // Invoke without options, file, project, or other.
        return this._runAppEx(ko.tcldevkit.info,'tclpe',
                              this._getPkgEditorOptions(),
                              null, null, null, null);
    }

    // --------------------------------------------------------------------------------
    // TDK Resources

    TDKItemsController.prototype.do_cmd_tdkBugs        = function() {
        ko.browse.openUrlInDefaultBrowser("http://bugs.activestate.com/query.cgi?format=specific&product=TclDevKit")
    }
    TDKItemsController.prototype.do_cmd_tdkCommunity   = function() {
        ko.browse.openUrlInDefaultBrowser("http://community.activestate.com/products/TclDevKit")
    }
    TDKItemsController.prototype.do_cmd_tdkMailinglist = function() {
        ko.browse.openUrlInDefaultBrowser("http://code.activestate.com/lists/tdk/")
    }

    // ================================================================================
    // Initialization of the whole controller

    var _TDKControllerSetup = {
        init: function() {
            var obSvc = Components.classes["@mozilla.org/observer-service;1"].
                    getService(Components.interfaces.nsIObserverService);
            obSvc.addObserver(this, "komodo-ui-started", false);
        },
        observe: function(subject, topic, data) {
            switch (topic) {
                case 'komodo-ui-started':
                    var obSvc = Components.classes["@mozilla.org/observer-service;1"].
                            getService(Components.interfaces.nsIObserverService);
                    obSvc.removeObserver(this, "komodo-ui-started");
                    _tdkController = new TDKItemsController();
                    break;
            }
        }
    };

    _TDKControllerSetup.init();
    _TDKControllerSetup = null;

})() /* executed anonymous function */;
