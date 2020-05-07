/* Copyright (c) 2000-2011 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

(function() {

    /* locals */
    var isWindows = navigator.platform.startsWith('Win');
    var _pdkController = null;

    function PDKItemsController() {
        this.log = ko.logging.getLogger("PDK");
        //this.log.setLevel(ko.logging.LOG_DEBUG);
        this.log.debug("PDKItemsController init");
        ko.perldevkit.initialize();
        try {
            window.controllers.appendController(this);

            XPCOMUtils.defineLazyGetter(this, "perlInfo", () =>
                        Cc["@activestate.com/koAppInfoEx?app=Perl;1"].
                            getService(Ci.koIPerlInfoEx));

            ko.main.addWillCloseHandler(this.destroy.bind(this));
        } catch(e) {
            this.log.exception(e);
        }
    }

    // The following two lines ensure proper inheritance (see Flanagan, p. 144).
    PDKItemsController.prototype = new xtk.Controller();
    PDKItemsController.prototype.constructor = PDKItemsController;

    PDKItemsController.prototype.destroy = function() {
        window.controllers.removeController(this);
    }

    PDKItemsController.prototype._canrun = function(pdkinfo, app) {
        return ko.views.manager.currentView &&
                typeof(ko.views.manager.currentView.koDoc.file) != 'undefined' &&
                ko.views.manager.currentView.koDoc.language == "Perl" &&
                pdkinfo.hasApp(app);
    }

    PDKItemsController.prototype._runPAI = function(pdkinfo, packer, debug)
    {
        var pai = pdkinfo.getPAIPath();
        if (!pai) return false;

        if (ko.views.manager.currentView) { ko.views.manager.currentView.setFocus() };
        var filename = ko.views.manager.currentView.koDoc.file.path;
        var execname = Services.koOsPath.withoutExtension(Services.koOsPath.basename(filename));
        if (isWindows) {
            execname += '.exe';
            packer = "../"+packer;
        } else {
            packer = "../bin/"+packer;
        }

        var cmd = __quote_arg(pai)+' --packer '+packer;
                  //' --perl "'+this.perlInfo.executablePath+'"';
                  //' --script "'+filename+'"'+
                  //' --executable "'+execname+'"';
        if (debug) {
            try {
            var dbgManager = ko.dbg.listener;
            var port = dbgManager.port;
            if (dbgManager.proxyClientPort)
                port = dbgManager.proxyClientPort;
            var host = dbgManager.address;
            if (dbgManager.proxyClientAddress)
                host = dbgManager.proxyClientAddress;
            if (!host)
                host = '127.0.0.1';
            cmd +=' --debug '+host+':'+port;
                  //' --lib "'+Services.koDirs.perlDBGPDir+'"';
            } catch(e) {
                // pass, debugging not available
            }
        }
        cmd += " "+filename;
        this.log.debug(cmd);
        ko.run.runEncodedCommand(window, cmd + ' {\'doNotOpenOutputWindow\': 1, \'runIn\': \'no-console\'}');
        return true
    }

    function __quote_arg(arg) {
        //arg = arg.replace('\\', '\\\\', "g");
        //arg = arg.replace("'", "\\'", "g");
        // quote the arguments
        if (arg.indexOf(' ') != -1) {
            arg = arg.replace('"', '\\"', "g");
            arg = '"'+arg+'"';
        }
        return arg;
    }

    PDKItemsController.prototype._runAppDirect = function(pdkinfo, app, options, filename, cwd, env, project)
    {

        //export PAI_OPT=--debug "Komodo:localhost:8800:/opt/Komodo/lib/"
        //perlapp --interactive <file>
        this.log.debug("_runAppDirect("+app+", "+options+", "+filename+", "+cwd+", "+env+", "+project+")");
        try {
            var appPath = pdkinfo.getAppPath(app);
            if (!appPath) {
                ko.dialogs.alert("Unable to locate "+app);
                return false;
            }

            if (ko.views.manager.currentView) { ko.views.manager.currentView.setFocus() };
            var cmd = __quote_arg(appPath)+' ';
            if (typeof(options) != 'undefined' && options) {
                var opt;
                for (var k in options) {
                    cmd += k+" "+__quote_arg(options[k])+" ";
                }
            }
            if (typeof(cwd) == 'undefined')
                cwd = null;

            if (typeof(project) != 'undefined' && project && Services.koOsPath.exists(project)) {
                cmd += __quote_arg(project);
            } else if (typeof(filename) != 'undefined' && filename) {
                cmd += __quote_arg(filename);
            }
            if (!cwd && typeof(filename) != 'undefined' && filename) {
                cwd = Services.koOsPath.dirname(filename)
            }
            var enc = " {'doNotOpenOutputWindow': 1, 'runIn': 'no-console'";
            if (cwd) {
                enc += ", 'cwd': '"+cwd+"'";
            }
            if (typeof(env) != 'undefined' && env) {
                enc += ", 'env': '"+env+"'";
            }
            enc += "}";
            this.log.debug(cmd);
            this.log.debug(enc);

            var callback = function(command, returncode, stdout, stderr) {
                if (returncode != 0 && stderr) {
                    var msg = "Command: " + cmd + "\n\n" + "Stderr:\n" + stderr;
                    ko.dialogs.alert("Unable to run perldevkit command", msg);
                }
            }

            Services.koRun.RunAsync(cmd, callback, cwd, env);
        } catch(e) {
            this.log.exception(e);
        }
        return false;
    }

    PDKItemsController.prototype._runAppEx = function(pdkinfo, app, options, filename, cwd, env, project)
    {
        return pdkinfo.hasLicense() && this._runAppDirect(pdkinfo, app, options, filename, cwd, env, project);
    }

    PDKItemsController.prototype._runApp = function(pdkinfo, app, debug)
    {
        var filename = ko.views.manager.currentView.koDoc.file.path;
        var env = null;
        try {
        if (typeof(debug) != 'undefined' && debug) {
            env = 'PAI_OPT=--debug "'+this._getDebugArg(true)+'"';
        }
        } catch(e) {
            // pass, debugging not available
        }
        return this._runAppEx(pdkinfo, app,
                            this._getOptions(filename, true),
                            filename,
                            null,
                            env,
                            this._getProjectName(filename, app));
    }

    PDKItemsController.prototype._getDebugArg = function(use_pai_opt)
    {
        var dbgManager = ko.dbg.listener;
        var port = dbgManager.port;
        if (dbgManager.proxyClientPort)
            port = dbgManager.proxyClientPort;
        var host = dbgManager.address;
        if (dbgManager.proxyClientAddress)
            host = dbgManager.proxyClientAddress;
        if (!host)
            host = '127.0.0.1';
        if (typeof(use_pai_opt) != 'undefined' && use_pai_opt) {
            var dir = Services.koDirs.perlDBGPDir.replace(/(\\)/g, '/');
            dir = dir.replace(/(:)/g, '|');
            return 'Komodo:'+host+':'+port+':'+dir;
        }
        return host+':'+port;
    }

    PDKItemsController.prototype._getOptions = function(filename, use_pai_opt)
    {
        var args = {'--interactive':'',
                '--perl': this.perlInfo.executablePath,
                '--exe': this._getExecutableName(filename)
                };
        try {
        if (typeof(use_pai_opt) == 'undefined' || !use_pai_opt) {
            args['--debug'] = this._getDebugArg();
            args['--lib'] = Services.koDirs.perlDBGPDir;
        }
        } catch(e) {
            // pass, debugging not available
        }
        return args;
    }

    PDKItemsController.prototype._getExecutableName = function(filename)
    {
        var execname = Services.koOsPath.withoutExtension(Services.koOsPath.basename(filename));
        if (isWindows) {
            execname += ".exe";
        }
        return execname;
    }

    PDKItemsController.prototype._getProjectName = function(filename, app)
    {
        var fn = Services.koOsPath.withoutExtension(Services.koOsPath.basename(filename))+"."+app;
        var dir = Services.koOsPath.dirname(filename);
        return Services.koOsPath.joinlist(2, [dir, fn]);
    }

    PDKItemsController.prototype.is_cmd_pdkLaunchPerlApp_enabled = function () {
        return this._canrun(ko.perldevkit.info,'perlapp');
    }
    PDKItemsController.prototype.do_cmd_pdkLaunchPerlApp = function() {
        return this._runApp(ko.perldevkit.info,"perlapp", true);
    }

    PDKItemsController.prototype.is_cmd_pdkLaunchPerlCov_enabled = function () {
        return ko.perldevkit.info.hasApp('perlcov');
    }
    PDKItemsController.prototype.do_cmd_pdkLaunchPerlCov = function() {
        var options = null;
        if (ko.views.manager.currentView && ko.views.manager.currentView.koDoc &&
            ko.views.manager.currentView.getAttribute('type') == 'editor') {
            options = {'gui': ko.views.manager.currentView.koDoc.file.path};
        }
        return this._runAppDirect(ko.perldevkit.guiInfo,"perlcov", options);
    }

    PDKItemsController.prototype.is_cmd_pdkLaunchPerlSvc_enabled = function () {
        return this._canrun(ko.perldevkit.info,'perlsvc');
    }
    PDKItemsController.prototype.do_cmd_pdkLaunchPerlSvc = function() {
        return this._runApp(ko.perldevkit.info,"perlsvc", true);
    }

    PDKItemsController.prototype.is_cmd_pdkLaunchPerlCtrl_enabled = function () {
        return this._canrun(ko.perldevkit.info,'perlctrl');
    }
    PDKItemsController.prototype.do_cmd_pdkLaunchPerlCtrl = function() {
        return this._runApp(ko.perldevkit.info,"perlctrl", true);
    }

    PDKItemsController.prototype.is_cmd_pdkLaunchPerlTray_enabled = function () {
        return this._canrun(ko.perldevkit.info,'perltray');
    }
    PDKItemsController.prototype.do_cmd_pdkLaunchPerlTray = function() {
        return this._runApp(ko.perldevkit.info,"perltray", true);
    }

    PDKItemsController.prototype.is_cmd_pdkLaunchVBScriptConverter_enabled = function () {
        return ko.perldevkit.guiInfo.hasApp('vbsperl');
    }
    PDKItemsController.prototype.do_cmd_pdkLaunchVBScriptConverter = function() {
        return this._runAppDirect(ko.perldevkit.guiInfo,'vbsperl');
    }

    PDKItemsController.prototype.is_cmd_pdkLaunchFilterBuilder_enabled = function () {
        return ko.perldevkit.guiInfo.hasApp('perlfb');
    }
    PDKItemsController.prototype.do_cmd_pdkLaunchFilterBuilder = function() {
        var options = null;
        if (ko.views.manager.currentView && ko.views.manager.currentView.koDoc &&
            ko.views.manager.currentView.getAttribute('type') == 'editor') {
            options = {'--input': ko.views.manager.currentView.koDoc.file.path};
        }
        return this._runAppDirect(ko.perldevkit.guiInfo,"perlfb", options);
    }

    PDKItemsController.prototype.is_cmd_pdkLaunchPerlNET_enabled = function () {
        return this._canrun(ko.perldevkit.info,'plc');
    }
    PDKItemsController.prototype.do_cmd_pdkLaunchPerlNET = function() {
        return this._runApp(ko.perldevkit.info,"plc", true);
    }

    var _PDKControllerSetup = {
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
                    _pdkController = new PDKItemsController();
                    break;
            }
        }
    };

    _PDKControllerSetup.init();
    _PDKControllerSetup = null;

})() /* executed anonymous function */;
