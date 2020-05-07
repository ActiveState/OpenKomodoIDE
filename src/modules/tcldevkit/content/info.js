/* Copyright (c) 2000-2011 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

if (typeof(ko) == 'undefined') {
    var ko = {};
}

if (typeof(ko.tcldevkit)!='undefined') {
    ko.logging.getLogger('').warn("ko.tcldevkit was already loaded, re-creating it.\n");
}
ko.tcldevkit = {};

(function() {

    /* locals */
    var isWindows = navigator.platform.startsWith('Win');
    var isMac = navigator.platform.startsWith('Mac');

    function TDKInfo(primaryPrefName, primaryExeName, fallbackExeName) {
        // Create a log object for the info block
        this.log = ko.logging.getLogger("TDK");
        //this.log.setLevel(ko.logging.LOG_DEBUG);
        this.log.debug("TDKItemsController init");

        // Remember our primary data and set the memoization cache up.
        this.primaryPrefName = primaryPrefName;
        this.primaryExeName = primaryExeName;
        this.fallbackExeName = fallbackExeName;
        this._cache = {};

        try {
            ko.prefs.prefObserverService.addObserver(this, primaryPrefName, false);
        } catch(e) {
            this.log.exception(e);
        }
    }

    // Class definition for the info object.

    TDKInfo.prototype = {
        getLocation: function() {
            var location = null;
            if (typeof(this._cache['location']) != 'undefined') {
                return this._cache['location'];
            }
            try {
                location = ko.prefs.getString(this.primaryPrefName, "");
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
            if (typeof(this._cache[app])         != 'undefined' &&
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
                // given an app name (eg. tclapp), build the path
                if (isWindows) {
                    app += ".exe";
                }
                return Services.koOsPath.joinlist(3, [location, "bin", app]);
            } catch(e) {
                this.log.exception(e);
            }
            return null;
        },

        hasApp: function (app) {
            try {
                if (typeof(this._cache[app])           != 'undefined' &&
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
                return Services.koOsPath.exists(this.appPath(location,'tclapp'));
            } catch(e) {
                this.log.exception(e);
            }
            return false;
        },

        _BaseDir: function(location)
        {
            // tdk puts executables in tdkdir/bin on all platforms
            // tdkDir/bin/someapp.exe
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
                var found  = Services.koSysUtils.WhichAll(this.primaryExeName,  new Object());
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
                    var installDir    = '/usr/local/TDK';
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

        // Removed the hasLicense() function and its magic to simplify the
        // code for better initial understanding. Should we come to need
        // or really want this it can be added back later, using the
        // perldevkit code as basis.

        observe: function(subject, topic, data)
        {
            this.log.debug('observe '+topic);
            try {
                switch (topic) {
                case this.primaryPrefName:
                    this._cache = {};
                    // Needs setTimeout, otherwise the setBooleanPref will
                    // fail to take... a bug in prefs?
                    window.setTimeout(UpdateToolbarVisibility, 1);
                    window.updateCommands("tdk_prefchange");
                }
            } catch(e) {
                this.log.exception(e);
            }
        }
    }

    function UpdateToolbarVisibility() {
        var available = ko.tcldevkit.info.getLocation();
        if (available) {
            document.getElementById('tb_tdkTclMenu').removeAttribute('kohidden');
            ko.prefs.setBoolean('tdk_installed', 1);
        } else if (!available) {
            document.getElementById('tb_tdkTclMenu').setAttribute('kohidden', 'true');
            ko.prefs.setBoolean('tdk_installed', 0);
        }
    }

    // Initialize above global variable on first call. Ignore further calls.
    this.initialize = function TDKInfoInit() {
        if (!ko.tcldevkit.info) {
            ko.tcldevkit.info = new TDKInfo('tdkLocation','tclapp','tclchecker');

            // Remove the applications not available on unix from the GUI.
            var el = document.getElementById('popup_tdk');
            // The popup_tdk will only exist in the top level window.
            // When the prefs window uses tdkinfo, this will fail.
            if (!el) return;
            
            if (!isWindows) {
                document.getElementById('menu_tdkTclSvc').setAttribute('collapsed', 'true');
                document.getElementById('tb_tdkTclSvc').setAttribute('collapsed', 'true');
            }
        }
        UpdateToolbarVisibility();
    }

}).apply(ko.tcldevkit);
