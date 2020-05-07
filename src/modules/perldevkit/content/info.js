/* Copyright (c) 2000-2011 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

if (typeof(ko) == 'undefined') {
    var ko = {};
}

if (typeof(ko.perldevkit)!='undefined') {
    ko.logging.getLogger('').warn("ko.perldevkit was already loaded, re-creating it.\n");
}
ko.perldevkit = {};

(function() {

    /* locals */
    var isWindows = navigator.platform.startsWith('Win');
    var isMac = navigator.platform.startsWith('Mac');

    function PDKInfo(primaryPrefName, fallbackPrefName, primaryExeName, fallbackExeName) {
        this.log = ko.logging.getLogger("PDK");
        //this.log.setLevel(ko.logging.LOG_DEBUG);
        this.log.debug("PDKItemsController init");
        this.primaryPrefName = primaryPrefName;
        this.primaryExeName = primaryExeName;
        this.fallbackPrefName = fallbackPrefName;
        this.fallbackExeName = fallbackExeName;
        this._cache = {};
        try {
            ko.prefs.prefObserverService.addObserver(this, primaryPrefName, false);
        } catch(e) {
            this.log.exception(e);
        }
    }

    PDKInfo.prototype = {
        getLocation: function() {
            var location = null;
            if (typeof(this._cache['location']) != 'undefined') {
                return this._cache['location'];
            }
            try {
                location = ko.prefs.getString(this.primaryPrefName, "") ||
                           ko.prefs.getString(this.fallbackPrefName, "");
                if (!location) {
                    var availInstalls = this.installationPaths();
                    if (availInstalls.length > 0)
                        location = availInstalls[0];
                }
                if (!location) return null;
            } catch(e) {
                this.log.exception(e);
            }
            this._cache['location'] = location;
            return location;
        },

        getAppPath: function(app) {
            if (typeof(this._cache[app]) != 'undefined' &&
                typeof(this._cache[app]['path']) != 'undefined') {
                return this._cache[app]['path'];
            }
            try {
                this._cache[app] = {};
                this._cache[app]['path'] = this.appPath(this.getLocation(), app);
                return this._cache[app]['path'];
            } catch(e) {
                this.log.exception(e);
            }
            return null;
        },

        appPath: function(location, app) {
            if (!location) return null;
            try {
                // given an app name (eg. perlapp), build the path
                if (isWindows) {
                    app += ".exe";
                }
                return Services.koOsPath.joinlist(3, [location, "bin", app]);
            } catch(e) {
                this.log.exception(e);
            }
            return null;
        },

        getPAIPath: function()
        {
            try {
                return this.PAIPath(this.getLocation());
            } catch(e) {
                this.log.exception(e);
            }
            return null;
        },

        PAIPath: function(location)
        {
            if (!location) return null;
            try {
                if (isWindows) {
                    return Services.koOsPath.joinlist(4, [location, "bin", "lib", "pai.exe"]);
                }
                return Services.koOsPath.joinlist(3, [location, "lib", "pai"]);
            } catch(e) {
                this.log.exception(e);
            }
            return null;
        },

        hasApp: function (app) {
            try {
                if (typeof(this._cache[app]) != 'undefined' &&
                    typeof(this._cache[app]['exists']) != 'undefined' &&
                    this._cache[app]['exists']) {
                    return true;
                }
                var app_path = this.getAppPath(app);
                if (!app_path) return false;
                this._cache[app]['exists'] =  Services.koOsPath.exists(app_path);
                return this._cache[app]['exists'];
            } catch(e) {
                this.log.exception(e);
            }
            return false;
        },

        exists: function (location) {
            try {
                return Services.koOsPath.exists(this.PAIPath(location));
            } catch(e) {
                this.log.exception(e);
            }
            return false;
        },

        _BaseDir: function(location)
        {
            // pdk puts executables in pdkdir/bin on all platforms
            // pdkDir/bin/someapp.exe
            try {
                return Services.koOsPath.dirname(Services.koOsPath.dirname(location));
            } catch(e) {
                this.log.exception(e);
            }
            return null;
        },

        _cached_installationPaths: null,

        installationPaths: function(refresh /* false */)
        {
            if (!refresh && this._cached_installationPaths !== null) {
                return this._cached_installationPaths;
            }

            var availInterps = new Array();
            try {
                var found = Services.koSysUtils.WhichAll(this.primaryExeName, new Object());
                var found2 = Services.koSysUtils.WhichAll(this.fallbackExeName, new Object());
                found = found.concat(found2);
                var dir = null;
                for (var i=0; i < found.length; i++) {
                    if (found[i]) {
                        availInterps.push(this._BaseDir(found[i]));
                    }
                }
                if (isMac) {
                    // bug 80816: hardwire these because they're hard to find
                    var installDir = '/usr/local/PDK';
                    var installDirBin = installDir + "/bin";
                    if ((Services.koOsPath.exists(Services.koOsPath.join(installDirBin, this.primaryExeName))
                         || Services.koOsPath.exists(Services.koOsPath.join(installDirBin, this.fallbackExeName)))
                        && availInterps.indexOf(installDir) == -1) {
                        availInterps.push(installDir);
                    }
                }
            } catch(ex) {
                log.exception(ex);
            }
            this._cached_installationPaths = availInterps;
            return availInterps;
        },

        hasLicense: function() {
            try {
                if (typeof(this._cache['license']) != 'undefined' &&
                    this._cache['license']) return true;

                var interp = ko.prefs.getString("perlDefaultInterpreter", "");
                if (interp == '') {
                    interp = 'perl';
                    interp = Services.koSysUtils.Which(interp);
                    if (!interp) {
                        ko.dialogs.alert("This feature requires that you have " +
                              "Perl on your PATH or that the Perl default " +
                              "interpreter preference be correctly " +
                              "set, and that a licensed copy of Perl " +
                              "Dev Kit 6.0 or later be installed in " +
                              "the same directory.");
                    }
                }
                var perlInfoEx = Components.classes["@activestate.com/koAppInfoEx?app=Perl;1"].createInstance(Components.interfaces.koIPerlInfoEx);
                perlInfoEx.installationPath = perlInfoEx.getInstallationPathFromBinary(interp);
                var sysDataSvc = Components.classes["@activestate.com/koSystemDataService;1"]
                                 .getService(Components.interfaces.koISystemDataService);

                // hack in the pdkLocation for the old pdk dialog, this enables
                // support of different installations in the old dialog
                var perlBinDir = ko.prefs.getString(this.primaryPrefName, "");
                if (perlBinDir) {
                    perlBinDir = Services.koOsPath.join(perlBinDir, 'bin');
                }
                if (!perlBinDir) {
                    // is pdk 6 on the path?
                    var paths = this.installationPaths();
                    if (paths.length) {
                        perlBinDir = Services.koOsPath.join(paths[0],'bin');
                    } else {
                        perlBinDir = Services.koOsPath.dirname(interp);
                    }
                }
                sysDataSvc.setString("pdk.perlbinpath", perlBinDir);

                if (! sysDataSvc.getString('pdk.perlapp')) {
                    ko.dialogs.alert("Komodo could not find an installation of Perl Dev Kit in: '" + perlBinDir + "'.");
                    return false;
                }
                if (! sysDataSvc.getBoolean("pdk.haveLicense")) {
                    ko.dialogs.alert("This feature requires that you have " +
                          "a license for the Perl Dev Kit installed.");
                    return false;
                }
                var version = parseFloat(sysDataSvc.getString("pdk.version"));
                if (!version) {
                    ko.dialogs.alert("Komodo could not determine the version number for Perl Dev Kit at ["+perlBinDir+"].");
                    return false;
                }
                if (version < 6) {
                    ko.dialogs.alert("Komodo requires Perl Dev Kit version 6 or later.");
                    return false;
                }
                this._cache['license'] = true;
                return true;
            } catch (e) {
                log.error(e);
            }
            return false;
        },

        observe: function(subject, topic, data)
        {
            this.log.debug('observe '+topic);
            try {
                switch (topic) {
                case this.primaryPrefName:
                    this._cache = {};
                    if (topic == "pdkLocation") {
                        // Needs setTimeout, otherwise the setBooleanPref will
                        // fail to take... a bug in prefs?
                        window.setTimeout(UpdateToolbarVisibility, 1);
                    }
                    window.updateCommands("pdk_prefchange");
                }
            } catch(e) {
                this.log.exception(e);
            }
        }

    }

    function UpdateToolbarVisibility() {
        var available = ko.perldevkit.info.getLocation();
        if (available) {
            document.getElementById('tb_pdkPerlMenu').removeAttribute('kohidden');
            ko.prefs.setBoolean('pdk_installed', 1);
        } else if (!available) {
            document.getElementById('tb_pdkPerlMenu').setAttribute('kohidden', 'true');
            ko.prefs.setBoolean('pdk_installed', 0);
        }
    }

    this.initialize = function PDKInfoInit() {
        if (!ko.perldevkit.info) {
            ko.perldevkit.info = new PDKInfo('pdkLocation','pdkGuiLocation','perlapp','perlfb');
            ko.perldevkit.guiInfo = new PDKInfo('pdkGuiLocation','pdkLocation','perlfb','perlapp');
            
            var el = document.getElementById('popup_pdk');
            // popup_pdk will only exist in the top level window.  When the
            // prefs window uses pdkinfo, this will fail.
            if (!el) return
            
            // Hide apps not on unix.
            if (!isWindows) {
                document.getElementById('menu_pdkPerlSvc').setAttribute('collapsed', 'true');
                document.getElementById('menu_pdkPerlCtrl').setAttribute('collapsed', 'true');
                document.getElementById('menu_pdkPerlNET').setAttribute('collapsed', 'true');
                document.getElementById('menu_pdkPerlTray').setAttribute('collapsed', 'true');
                document.getElementById('menu_pdkPerlVBConverter').setAttribute('collapsed', 'true');
                document.getElementById('tb_pdkPerlSvc').setAttribute('collapsed', 'true');
                document.getElementById('tb_pdkPerlCtrl').setAttribute('collapsed', 'true');
                document.getElementById('tb_pdkPerlNET').setAttribute('collapsed', 'true');
                document.getElementById('tb_pdkPerlTray').setAttribute('collapsed', 'true');
                document.getElementById('tb_pdkPerlVBConverter').setAttribute('collapsed', 'true');
            }
            UpdateToolbarVisibility();
        }
    }

}).apply(ko.perldevkit);
