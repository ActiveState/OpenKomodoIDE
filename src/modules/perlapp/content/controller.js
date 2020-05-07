/* Copyright (c) 2000-2011 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

if (typeof(ko) == 'undefined') {
    var ko = {};
}

if (typeof(ko.perlapp)!='undefined') {
    ko.logging.getLogger('').warn("ko.perlapp was already loaded, re-creating it.\n");
}
ko.perlapp = {};

(function() {

    /* locals */
    var _perlApp = null;

    function _PerlApp() {
        this.log = ko.logging.getLogger("perlapp");
        //this.log.setLevel(ko.logging.LOG_DEBUG);
        this.log.debug("_PerlApp init");
        try {
            window.controllers.appendController(this);
        } catch(e) {
            this.log.exception(e);
        }
    }

    // The following two lines ensure proper inheritance (see Flanagan, p. 144).
    _PerlApp.prototype = new xtk.Controller();
    _PerlApp.prototype.constructor = _PerlApp;

    _PerlApp.prototype.destroy = function() {
        window.controllers.removeController(this);
    }

    _PerlApp.prototype.openWindow = function() {
        var sysDataSvc = Components.classes["@activestate.com/koSystemDataService;1"]
                         .getService(Components.interfaces.koISystemDataService);

        var versionStr = parseFloat(sysDataSvc.getString("pdk.version"));
        ko.windowManager.openOrFocusDialog("chrome://perlapp/content/perlapp.xul",
                    "komodo_perlapp",
                    "chrome,resizable",
                    versionStr);
    }

    _PerlApp.prototype.is_cmd_toolsBuildPerlAppCommand_enabled = function() {
        var view = ko.views.manager.currentView;
        if (view == null ||
            view.koDoc.language != "Perl" ||
            view.koDoc.isUntitled ||
            ! view.koDoc.file.isLocal) {
            return false;
        }
        return true;
    }

    _PerlApp.prototype.do_cmd_toolsBuildPerlAppCommand = function() {
        try {
            var sysUtilsSvc = Components.classes["@activestate.com/koSysUtils;1"].
                              getService(Components.interfaces.koISysUtils);
            var infoSvc = Components.classes["@activestate.com/koInfoService;1"].
                          getService(Components.interfaces.koIInfoService);
            var ospath = Components.classes["@activestate.com/koOsPath;1"].getService();
            var prefSvc = Components.classes["@activestate.com/koPrefService;1"].
                        getService(Components.interfaces.koIPrefService);
            //pdk: use the global Perl interpreter only
            var interp = prefSvc.prefs.getStringPref("perlDefaultInterpreter");
            if (interp == '') {
                interp = 'perl';
                interp = sysUtilsSvc.Which(interp);
                if (!interp) {
                    ko.dialogs.alert("This feature requires that you have " +
                          "Perl on your PATH or that the Perl default " +
                          "interpreter preference be correctly " +
                          "set, and that a licensed copy of Perl " +
                          "Dev Kit 3.0 or later be installed in " +
                          "the same directory.");
                }
            }
            var perlInfoEx = Components.classes["@activestate.com/koAppInfoEx?app=Perl;1"].createInstance(Components.interfaces.koIPerlInfoEx);
            perlInfoEx.installationPath = perlInfoEx.getInstallationPathFromBinary(interp);
            var sysDataSvc = Components.classes["@activestate.com/koSystemDataService;1"]
                             .getService(Components.interfaces.koISystemDataService);

            var perlBinDir = null;
            if (prefSvc.prefs.hasStringPref("pdkLocation") &&
                prefSvc.prefs.getStringPref("pdkLocation")) {
                // hack in the pdkLocation for the old pdk dialog, this enables
                // support of different installations in the old dialog
                perlBinDir = prefSvc.prefs.getStringPref("pdkLocation");
                sysDataSvc.setString("pdk.perlbinpath", ospath.join(perlBinDir,'bin'));
            } else {
                perlBinDir = ospath.dirname(interp)
                sysDataSvc.setString("pdk.perlbinpath", perlBinDir);
                // if it is not installed in the perl directory, let it be found on
                // the path (to support PDK 6.0)
                if (!sysDataSvc.getString('pdk.perlapp')) {
                    sysDataSvc.setString("pdk.perlbinpath", null);
                }
            }

            if (! sysDataSvc.getString('pdk.perlapp')) {
                ko.dialogs.alert("Komodo could not find an installation of Perl Dev Kit in: '" + perlBinDir + "'.");
                return;
            }
            if (! sysDataSvc.getBoolean("pdk.haveLicense")) {
                ko.dialogs.alert("This feature requires that you have " +
                      "a license for the Perl Dev Kit installed.");
                return;
            }
            var version = parseFloat(sysDataSvc.getString("pdk.version"));
            if (!version) {
                ko.dialogs.alert("Komodo could not determine the version number for Perl Dev Kit.");
                return;
            }
            if (version < 3) {
                ko.dialogs.alert("Komodo requires Perl Dev Kit version 3 or later.");
                return;
            }
            if (version >= 6) {
                ko.dialogs.alert("Perl Dev Kit version 6 and later includes GUI "+
                             "interfaces to its tools that is available under "+
                             "the 'Tools->Perl Dev Kit' menu. "+
                             "The built in interface, which was designed for "+
                             "earlier versions of the PDK, will still work with "+
                             "the PDK 6, but may not support new features in the "+
                             "PDK.",
                             null,
                             "Perl Dev Kit",
                             "pdk_xpi_update");
            }
        } catch (e) {
            this.log.error(e);
            return;
        }
        this.openWindow();
    }

    function perlapp_onload() {
        _perlApp = new _PerlApp();
    }

    function perlapp_onunload() {
        _perlApp.destroy();
        _perlApp = null;
    }

    window.addEventListener("load", perlapp_onload, false);
    window.addEventListener("unload", perlapp_onunload, false);

}).apply(ko.perlapp);
