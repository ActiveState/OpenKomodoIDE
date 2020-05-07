/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* -*- Mode: JavaScript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * editor-debugger.js
 * Set up the buffer- and window-manager components.
 */

//---- globals

if (typeof(ko) == 'undefined') {
    var ko = {};
}
if (typeof(ko.dbg) == 'undefined') {
    ko.dbg = {};
}

(function() { /* ko.dbg */

const Ci = Components.interfaces;

this.manager = null; // global debugger manager for js side of life
var _listener = null;
var _stringBundle = (Components.classes["@mozilla.org/intl/stringbundle;1"]
               .getService(Components.interfaces.nsIStringBundleService)
               .createBundle("chrome://komodo/locale/debugger.properties"));

this.__defineGetter__("listener",
function()
{
    if (!_listener) {
        _listener = Components.classes["@activestate.com/koDBGPManager;1"].
               getService(Components.interfaces.koIDBGPManager);
    }
    return _listener;
});
this.__defineSetter__("listener",
function(value)
{
    this._listener = value;
});

/**
 * Return boolean indicating lang is a debuggable language.
 *
 * @param lang {string} The language name to check.
 * @returns boolean
 */
this.isDebuggableLanguage = function(lang)
{
    return (("@activestate.com/koInvocation;1?type=" + lang) in Components.classes);
}

this.onload = function debugger_onLoad()
{
    ko.main.addWillCloseHandler(debugger_onUnLoad);
    ko.main.addCanCloseHandler(debugger_canClose);
    this.manager = new DBG_Manager();
    DBG_UpdateIShellToolbarButton();
    var hexObserver = document.getElementById("cmd_dbgViewAsHex");
    if (ko.prefs.getBoolean("debuggerPreferHex")) {
        hexObserver.setAttribute("checked", "true");
    } else {
        hexObserver.removeAttribute("checked");
    }

    // Prepare the output tab manager.
    ko.dbg.tabInit();

    // Initialize breakpoints.
    ko.dbg.breakpoints.init();
    ko.widgets.getWidgetAsync("breakpoints-tabpanel",
                              function() ko.dbg.bpInit());
}

function debugger_startError(errmsg)
{
    ko.dialogs.alert('Unable to initialize the debugging system because '+
                 errmsg+'  '+
                 'Debugging will be unavailable until '+
                 'you change the debugger port in your preferences.  '+
                 'You can try allowing the system to provide a free port.',
                 "Debugger Initialization Error");
}

this.status = 
function debugger_status()
{
    // popup a window with debugger manager status
    // such as how many connected applications/sessions, the
    // address/port being listened on, the proxy into, etc.
    ko.windowManager.openOrFocusDialog(
        "chrome://komodo/content/debugger/listener.xul",
        "Komodo:Listener",
        "chrome,resizable=yes",
        ko.dbg.listener);
}

function debugger_onUnLoad()
{
    ko.dbg.controller.destroy();
    ko.dbg.controller = null;

    ko.dbg.manager.shutdown();
    ko.dbg.manager = null;
    
    ko.dbg.listener = null;
}

function debugger_canClose()
{
    if (!ko.dbg.manager) {
        dump("XXX multi-window work: no more debugger?\n");
        return true; // Don't stop the shutdown process.
    }
    if (ko.dbg.manager.sessionList.length < 1) {
        return true;
    }

    var dbgsessions = [];
    var shellsessions = [];
    var i;
    var answer;

    for (i=0; i < ko.dbg.manager.sessionList.length; i++) {
        if (ko.dbg.manager.sessionList[i].isInteractive) {
            shellsessions[shellsessions.length] = ko.dbg.manager.sessionList[i];
        } else {
            dbgsessions[dbgsessions.length] = ko.dbg.manager.sessionList[i];
        }
    }

    if (dbgsessions.length > 0) {
        answer = ko.dialogs.customButtons(
            "There are Debugging sessions still in "+
            "progress. Would you like Komodo to close these sessions?",
            ["&Kill Session and Close Tab", "Cancel"],
            "Cancel",  // default button
            null, // text
            null, // title
            'debugger_confirm_close');
        if (answer == "Kill Session and Close Tab") {
            for (i = 0; i < dbgsessions.length; ++i) {
                dbgsessions[i].terminate();
            }
        } else {
            return false;
        }
    }

    if (shellsessions.length > 0) {
        answer = ko.dialogs.customButtons(
            "There are Interactive Shells still running. "+
            "Would you like Komodo to close these sessions?",
            ["Kill Session and Close Tab", "Cancel"],
            "Cancel",  // default button
            null, // text
            null, // title
            'interactiveshell_confirm_close');
        if (answer == "Kill Session and Close Tab") {
            for (i = 0; i < shellsessions.length; ++i) {
                shellsessions[i].terminate();
            }
        } else {
            return false;
        }
    }
    return true;
}


/**
 * @deprecated since Komodo 8.5.0 - use getDefaultInteractiveShellLanguageAsync.
 */
this.haveInteractiveShellExecutable =
function DBG_haveInteractiveShellExecutable(language) {
    this.manager.log.deprecated("haveInteractiveShellExecutable is deprecated.");

    var appInfo = Components.classes["@activestate.com/koAppInfoEx?app="+lang+";1"].
                getService(Components.interfaces.koIAppInfoEx);
    return appInfo.executablePath != null;
}

/**
 * @deprecated since Komodo 8.5.0 - use getDefaultInteractiveShellLanguageAsync.
 */
this.getDefaultInteractiveShellLanguage = 
function DBG_getDefaultInteractiveShellLanguage() {
    this.manager.log.deprecated("getDefaultInteractiveShellLanguage is deprecated, use getDefaultInteractiveShellLanguageAsync instead.");

    var language = ko.prefs.getStringPref('interactiveShellDefaultLanguage');
    if (ko.dbg.haveInteractiveShellExecutable(language)) return language;
    var ishells = ['Perl','Python','Python3','Tcl','Ruby'];
    for (var i = 0; i < ishells.length; i++) {
        if (ko.dbg.haveInteractiveShellExecutable(ishells[i])) return ishells[i];
    }
    // name gets put into the toolbar button menu for default interactive shell
    return 'Unavailable';
}

// XXX need to abstract interactive shell support
this.getDefaultInteractiveShellLanguageAsync =
function DBG_getDefaultInteractiveShellLanguageAsync(callback) {
    var pref_lang = ko.prefs.getStringPref('interactiveShellDefaultLanguage');
    // Note: pref_lang may be in there twice... but that won't matter.
    var ishellLanguages = [pref_lang, 'Python','Python3','Perl','Ruby','Tcl'];
    var langIdx = 0;
    var getNextIShellLanguage = function() {
        if (langIdx >= ishellLanguages.length) {
            return null;
        }
        let lang = ishellLanguages[langIdx];
        langIdx += 1;
        return lang;
    }

    var check_lang_availability = function(language) {
        if (!language) {
            // name gets put into the toolbar/menu for default interactive shell
            callback('Unavailable');
            return;
        }
        var find_functions_callback = function(result, executables) {
            if (result == Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL && executables.length > 0) {
                callback(language);
            } else {
                check_lang_availability(getNextIShellLanguage());
            }
        }
        let appInfoEx = Components.classes["@activestate.com/koAppInfoEx?app="+language+";1"].
                    getService(Components.interfaces.koIAppInfoEx);
        appInfoEx.FindExecutablesAsync(find_functions_callback);
    }

    check_lang_availability(getNextIShellLanguage());
}

function DBG_UpdateIShellToolbarButton()
{
    var callback = function DBG_UpdateIShellToolbarButton_callback(language) {
        try {
            for (var id of ["buttonInteractiveShell",
                            "menu_toggleInteractiveShell",
                            "tbmenu_toggleInteractiveShell"]) {
                let elem = document.getElementById(id);
                if (elem) {
                    elem.setAttribute("language", language);
                } else {
                    ko.logging.getLogger('DBG_Manager').warn("Unable to find element with id " + id);
                }
                if (id.indexOf("button") == -1) {
                    elem.setAttribute("label",
                                      "Start/Find/Toggle Default Interactive Shell (" + language + ")");
                }
            }
        } catch (e) {
            ko.logging.getLogger('DBG_Manager').exception(e);
        }
    }
    // Update the toolbar/menus asynchronously.
    try {
        ko.dbg.getDefaultInteractiveShellLanguageAsync(callback);
    } catch (e) {
        ko.logging.getLogger('DBG_Manager').exception(e);
    }
}

/**
  * DBG_Manager
  *
  * The debugger manager maintains a list of connected applications, and handles
  * debug session starting and stopping.
  *
  */

function DBG_Manager() {
    this.log = ko.logging.getLogger('DBG_Manager');
    //this.log.setLevel(ko.logging.LOG_DEBUG);

    // These global notifications don't come from koDBGP.unprocessed.py
    // and koDBGPProtocolHandler.py, so we need to stick with notifications.
    this._gObserverSvc = Components.classes["@mozilla.org/observer-service;1"].
                   getService(Components.interfaces.nsIObserverService);
    this._gObserverSvc.addObserver(this, "invocation_terminated", false);
    this._gObserverSvc.addObserver(this, "debugger_listener", false);
    this._gObserverSvc.addObserver(this, 'debugger_init', false);

    var prefObserverService = ko.prefs.prefObserverService;
    this._pref_observer_topics = [
        'interactiveShellDefaultLanguage',
        'perlDefaultInterpreter',
        'pythonDefaultInterpreter',
        'python3DefaultInterpreter',
        'tclshDefaultInterpreter',
    ];
    prefObserverService.addObserverForTopics(this,
                                             this._pref_observer_topics.length,
                                             this._pref_observer_topics,
                                             false);
}

DBG_Manager.prototype = {
    /* the following items are available for translating between a
       readable status name and the status flags */
    STATE_AVAILABLE: -1,
    STATE_STOPPED: Ci.koIDBGPSession.STATUS_STOPPED,
    STATE_STARTING: Ci.koIDBGPSession.STATUS_STARTING,
    STATE_BREAK: Ci.koIDBGPSession.STATUS_BREAK,
    STATE_RUNNING: Ci.koIDBGPSession.STATUS_RUNNING,
    STATE_STOPPING: Ci.koIDBGPSession.STATUS_STOPPING,
    STATE_INTERACTIVE: Ci.koIDBGPSession.STATUS_INTERACTIVE,

    stateNames: [
        // this use used for log file output only, and matches
        // the enumeration of these constants found in koIDBGPSession
        'STATE_STARTING',
        'STATE_STOPPING',
        'STATE_STOPPED',
        'STATE_RUNNING',
        'STATE_BREAK',
        'STATE_INTERACTIVE',
    ],
    stateValues: null,
    getStateFromName: function(stateName)
    {
        if (!this.stateValues) {
            this.stateValues = {
                'starting'    : this.STATE_STARTING,
                'stopping'    : this.STATE_STOPPING,
                'stopped'     : this.STATE_STOPPED,
                'running'     : this.STATE_RUNNING,
                'break'       : this.STATE_BREAK,
                'interactive' : this.STATE_INTERACTIVE
            }
        }
        return this.stateValues[stateName];
    },

    log: null,

    // Debugger Session Data
    sessionList: [],
    /**
     * @type DBG_Session
     */
    currentSession: null,
    manager: null,

    shutdown: function()
    {
        var prefObserverService = ko.prefs.prefObserverService;
        prefObserverService.removeObserverForTopics(this,
                                                    this._pref_observer_topics.length,
                                                    this._pref_observer_topics);

        this._gObserverSvc.removeObserver(this, "invocation_terminated");
        this._gObserverSvc.removeObserver(this, 'debugger_init', false);
        this._gObserverSvc.removeObserver(this, "debugger_listener");
        this._gObserverSvc = null;

    },

    /**
     * Create a new DBG_Session
     * @param isInteractive [optional] whether the session is interactive
     * @param onSuccessCallback [optional] callback on success; it will be
     *      passed a single argument, the resulting DBG_Session
     * @param onErrorCallback [optional] callback on error; it will be passed a
     *      single argument, the exception describing the error, or null if no
     *      error information is available
     * @return None
     */
    newSession: function DBG_Manager_newSession(isInteractive, onSuccessCallback, onErrorCallback)
    {
        this.log.debug('newSession');
        if (!onSuccessCallback) onSuccessCallback = function() {}
        if (!onErrorCallback) onErrorCallback = function() {}

        var onTabMgrReady = function(tabMgr) {
            var sess = new DBG_Session(tabMgr, isInteractive);
            this.sessionList.push(sess);
            onSuccessCallback(sess);
        }

        try {
            if (typeof(isInteractive) == 'undefined')
                isInteractive = false;
            ko.dbg.tabManager.getTabMgr(onTabMgrReady.bind(this),
                                        onErrorCallback);
        } catch(e) {
            this.log.exception(e);
            onErrorCallback(e);
        }
    },

    /* only a session should ever call this, otherwise a session may not be
        properly shutdown yet.  Call session.shutdown instead of this */
    removeSession: function(sess)
    {
        this.log.debug('removeSession');
        try {
            for (var i=0; i < this.sessionList.length; ++i) {
                var session = this.sessionList[i];
                if (session && session == sess) {
                    this.sessionList.splice(i,1);
                    if (session == this.currentSession) {
                        this.currentSession = null;
                    }
                    return;
                }
            }
        } catch(e) {
            this.log.exception(e);
        }
        window.updateCommands("debug_state");
    },

    setCurrentSession: function (session)
    {
        this.log.debug('setCurrentSession');
        this.currentSession = session;
        window.updateCommands("debug_state");
        if (session) {
            session.updateUI();
        } else {
            // XXX TODO clear the ui state?
        }
    },

    /* XXX array searching functions, optimize? */
    findSessionByCookie: function(cookie)
    {
        for (var i=0; i < this.sessionList.length; ++i) {
            var session = this.sessionList[i];
            if (session && session.invocation &&
                session.invocation.cookie == cookie)
                return session;
        }
        return null;
    },

    findSessionByApplication: function(application)
    {
        for (var i=0; i < this.sessionList.length; ++i) {
            var session = this.sessionList[i];
            if (session && session.application == application)
                return session;
        }
        return null;
    },


    findSessionByApplicationID: function(appid)
    {
        for (var i=0; i < this.sessionList.length; ++i) {
            var session = this.sessionList[i];
            if (session && session.dbg && session.dbg.applicationId == appid)
                return session;
        }
        return null;
    },

    findSessionByInvocation: function(invocation)
    {
        for (var i=0; i < this.sessionList.length; ++i) {
            var session = this.sessionList[i];
            if (session && session.invocation == invocation)
                return session;
        }
        return null;
    },

    /* koIDBGPUIManager implementation */
    notifyDebuggerSessionStateChange: function(origSession, statusName)    
    {
        /*
          we get this notification whenever a break or some state
          change in the debugger engine occurs.  At that point we
          call the sessions updateUI function.  If the session
          is the current session, it will call the DBG_Managers
          updateUI also.
        */
        // this.log.debug('observe: debugger_session_state_change received: '+statusName);
        var session = this.findSessionByApplication(origSession.application);
        if (!session) {
            this.log.debug('observe: No UI session for state change!');
            try {
                origSession.application.shutdown();
            } catch(e) {
                this.log.exception(e);
            }
            return;
        }
        try {
            // if the subject of this notification is not the current thread for a
            // session, then call updateThread instead
            if (session.application.currentSession == origSession) {
                // this.log.debug('observe: updating UI for thread '+session.dbg.threadId);
                session.notifyStateChange(this.getStateFromName(statusName));
                session.updateUI();
            } else {
                // this.log.debug('observe: updating thread '+session.dbg.threadId);
                session.updateThread(origSession);
            }
        } catch(e) {
            this.log.exception(e);
        }
    },

    notifyDebuggerSessionNotify: function DBG_Manager_notifyDebuggerSessionNotify(subject, data)
    {
        // subject is koIDBGPNotification
        session = this.findSessionByApplication(subject.session.application);
        //this.log.debug('observe: debugger_session_notify received: '+data+' content: '+subject.value);
        switch(data) {
          case 'stdin':
           // get the last line in the buffer, and add a marker for it
           session.panel.debuggerPanel.terminalView.setPromptMarker(ko.markers.MARKNUM_STDIN_PROMPT);
           if (session == this.currentSession) {
               session.panel.debuggerPanel.terminalView.setFocus();
           }
           break;
          case 'pretty_print':
           session._prettyPrint =  subject.value != '0';
           session.updateUI();
           break;
          case 'script_destroyed':
           // close any open buffer with the filename
           ko.views.manager.closeViewsByURL([subject.value]);
           break;
        }
    },

    /*
       When we receive a debugger_init notification, we call
       onDebugStart.  This will either find a pre-existing session
       (in the case of local debugging) or create a new session,
       hook up the terminal, and start debugging.
    */
    onDebugStart: function(application)
    {
        /**
         * This gets run as a callback once we have a session
         */
        var onSessionCreated = function(session) {
            if (!session.application)
                session.application = application;
            this.currentSession = session;
            session.startDebugging(isRemote);
        }

        this.log.debug('onDebugStart entered')
        /* if we started a local debug session, the application
           should have a session cookie, which will match one
           of the sesions in our sessionList.  Use that, otherwise,
           start a new session */
        var session = null;
        var isRemote = false;
        if (application.currentSession.cookie) {
            var cookie = application.currentSession.cookie;
            session = this.findSessionByCookie(cookie);
            if (!session) {
                ko.dialogs.alert('Debugger attempt with invalid cookie: '+cookie+'\n');
                application.shutdown();
                return;
            }
            this.log.debug('onDebugStart session matched cookie ' + cookie);
            onSessionCreated.call(this, session);
        } else {
            // ask the user if they want to debug this new session.
            if (ko.dialogs.yesNo("A remote application has requested a " +
                             "debugger session, would you like to " +
                             "debug now?", // prompt
                             "Yes", // response
                             null, // text
                             "New Remote Debugger Connection", // title
                             'allow_remote_debug') != "Yes") {
                application.currentSession.stop();
                application.shutdown();
                return;
            }
            this.log.debug('onDebugStart remote debug session initated');

            isRemote = true;
            this.newSession(false, onSessionCreated.bind(this));
        }
    },

    /*
      used by uilayout to add text to the status bar
    */
    getDebugTitle: function()
    {
        var msg = '';
        if (!this.currentSession)
            return msg;
        var state = this.currentSession.getState();
        if (state == ko.dbg.manager.STATE_BREAK) {
            msg = " - Debugger is in Break Mode"
        } else if (state == ko.dbg.manager.STATE_RUNNING) {
            msg = " - Debugger is Running";
        }
        return msg;
    },

    /*
       if we have a current session, pass the command on to that,
       otherwise, we start a new session.  This allows, for
       example, the toolbar debugger buttons to initiate a local
       debugger session.  The debugger controller calls this
       function for every step command.
    */
    doStep: function(step_type, runToCursor)
    {
        this.log.debug('doStep '+step_type);
        if (typeof(runToCursor) == 'undefined') runToCursor = false;
        try {
            if (this.currentSession) {
                this.currentSession.doStep(step_type, runToCursor);
                return;
            }

            // no currentSession, start local debugging
            // first, make sure the current file has no lint errors
            if (ko.views.manager.currentView && ko.views.manager.currentView.lintBuffer &&
                ko.views.manager.currentView.lintBuffer.lintResults) {
                var numerr = ko.views.manager.currentView.lintBuffer.lintResults.getNumErrors();
                if (numerr > 0) {
                    if (ko.dialogs.yesNo("The current buffer contains syntax errors. "+
                                     "Are you sure you want to continue debugging?",
                                     "No", null, "Syntax Errors Found",
                                     "syntax_errors_on_debug" /* doNotAsk */) == "No") {
                        var msg = 'Not debugging, as buffer contains syntax errors.';
                        require("notify/notify").send(msg, "debugger", {priority: "warning"});
                        ko.uilayout.ensureTabShown("klint_tabpanel", false);
                        return;
                    }
                }
            }
            var onSuccess = function dbg_doStep_onSuccess(session) {
                session.doStep(step_type, runToCursor);
            }
            var onError = function dbg_doStep_onError(exception) {
                this.log.debug("doStep: Invocation doStart failed, either because user cancelled dialog or because something is wrong w/ debugger engine registration\n");
            }
            ko.dbg.invocation.doStart(step_type,
                                      ko.dbg.invocation.INVOKE_DEBUG,
                                      null, // session
                                      onSuccess.bind(this),
                                      onError.bind(this));
        } catch(e) {
            this.log.exception(e);
        }
    },

    /**
     * Asynchronously opens the given URI in the Komodo editor. This function
     * will try to find files on the local file system, or files that are
     * mapped to a real editable file and open that file rather than getting
     * the source from the debugger engine and opening as a virtual readonly
     * buffer.
     *
     * If the URI cannot be found and is ont currently mapped, then the user
     * will be offered to created a new URI mapping.
     *
     * @param {string} uri   The URI to open.
     * @param {int} linenum  The line number to open the file at.
     * @param {string} viewType optional, type of buffer, defaults to "editor"
     * @param viewList {Components.interfaces.koIViewList}
     *        Optional, what pane to open the buffer in.
     * @param {function} callback Optional, to be called when the asynchronous
     *        load is complete. The view will be passed as an argument to the
     *        function.
     */
    doFileOpenAtLine: function(uri, linenum, type, viewlist, callback)
    {
        //dump("doFileOpenAtLine: start with uri: " + uri + "\n");
        // if we're local debugging, or we have choosen to look for local files
        // in remote debugging sessions, then lets see if it exists
        var tryLocalFile = this.currentSession.invocation ||
                           ko.prefs.getBooleanPref('debuggerFindLocalFile');
        var koFileEx = Components.classes["@activestate.com/koFileEx;1"]
                             .createInstance(Components.interfaces.koIFileEx);
        koFileEx.URI = uri;
        var muri = uri;
        var havemap = false;

        // dbgp URI (eval) frames get their content from the debugger engine,
        // and never map to any local path, so don't try getting a
        // mapped URI
        if (koFileEx.scheme != "dbgp") {
            while (1) {
                // find out if we have a mapping
                if (koFileEx.scheme == "file" && !koFileEx.server) {
                    if (this.currentSession.invocation ||
                        this.currentSession.dbg.address == "127.0.0.1")
                    {
                        // Note that the localhost check above is wrong, there
                        // may be a proxy (e.g. port forwarding via ssh) in play;
                        // unfortunately, we can't do better at the moment.
                        if (koFileEx.exists && !koFileEx.isDirectory) {
                            // This is a local file session, just open it - bug 90471
                            ko.views.manager.doFileOpenAtLineAsync(koFileEx.URI, linenum,
                                                                   type, viewlist, -1, callback);
                            return;
                        }
                    }
                    // This is a file:///foo, but we were invoked externally;
                    // since we can't tell where the remote machine actually is
                    // (it could be localhost for all we know), make the user
                    // set up a mapping instead.
                    koFileEx.server = this.currentSession.dbg.hostname;
                }
                muri = ko.uriparse.getMappedURI(koFileEx.URI);
                havemap = muri != koFileEx.URI;
                if (!havemap) muri = uri;

                // XXX TODO fix https access in this area
                if (havemap || (tryLocalFile && uri.match(/^(file|ftp|ftps|sftp|scp):/))) {
                    var fileSvc = Components.classes["@activestate.com/koFileService;1"].
                      getService();
                    var file = fileSvc.getFileFromURI(muri);
                    if (file.exists && !file.isDirectory) {
                        ko.views.manager.doFileOpenAtLineAsync(muri, linenum, type, viewlist, -1, callback);
                        return;
                    }
                }

                // Ask the user if they want to add a uri mapping then.
                if (!this.currentSession._have_asked_to_map_uris) {
                    if (this.currentSession._is_currently_asking_to_map_uris) {
                        /* Work around problem that Komodo is currently already
                           asking for a mapped URI on this session, we don't
                           want to create another prompt dialog. See bug 80125.
                        */
                        return;
                    }
                    this.currentSession._is_currently_asking_to_map_uris = true;
                    try {
                        var mapUriMsg = _stringBundle.formatStringFromName(
                                                "debuggerAskToMapURI",
                                                [koFileEx.URI], 1);
                        if (ko.dialogs.yesNo(mapUriMsg,
                                         "Yes", null, null,
                                         "remotedebug_mapped_uri", 'mapped_uris') == "Yes") {
                            // We hold a URI to a file, we actually want to use the
                            // file's directory location, but ko.uriparse.dirName
                            // will converts the URI to a path, not what we want, so
                            // we use a regex to make this happen.
                            var parentUri = koFileEx.URI.match(/^(.*)\/.*?/)[1];
                            if (ko.uriparse.addMappedURI(parentUri))
                              // allow another loop in the while
                              continue;
                        }
                    } finally {
                        this.currentSession._is_currently_asking_to_map_uris = false;
                    }
                    this.currentSession._have_asked_to_map_uris = true;
                }
                break; // End the while loop
            }
            // try to retrieve the file from the debugger engine if it doesn't
            // exist.  The dbgp handler will remove the scheme we add here if
            // the uri is using a file scheme, otherwise the engine must deal
            // with it.  If the URI we recieved was already a dbgp uri, then
            // file.exists above will be true, so we should never enter this
            // code path in that case.

            if (!uri.match(/^dbgp:\/\//)) {
                uri = ('dbgp://' + this.currentSession.application.uuid
                       + "/" + uri);
                //dump("  full uri:" + uri + "\n");
            }
        }

        //dump("doFileOpenAtLine: end with uri: " + uri + "\n");
        ko.views.manager.doFileOpenAtLineAsync(uri, linenum, type, viewlist, -1, callback);
    },

    observe: function(subject, topic, data)
    {
        var session = null;
        switch (topic) {
        case "interactiveShellDefaultLanguage":
            DBG_UpdateIShellToolbarButton();
            // fallthrough
        case "perlDefaultInterpreter":
        case "pythonDefaultInterpreter":
        case "python3DefaultInterpreter":
        case "tclshDefaultInterpreter":
            window.updateCommands("interactiveshell");
            break;
        case 'invocation_terminated':
            this.log.debug('observe: invocation_terminated received');
            // XXX "data" is null for now.
            //var exitCode = data;  // XXX can "data" be an int here???
            session = this.findSessionByInvocation(subject)
            // if no session, we've already detached so don't try to
            // release the session
            if (!session) {
                this.log.debug('observe: invocation_terminated cannot locate session');
                window.updateCommands("debug_state");
                return;
            }
            // still have a session, likely the app crashed on us or was otherwise killed
            window.getAttention();
            session.updateUI(ko.dbg.manager.STATE_STOPPED);
            break;
        case 'debugger_init':
            /*
               we get this when a new APPLICATION starts debugging.
               we should not receive this for threads within an
               application, but maybe we will want to.
            */
            /* Multi-window work:
               var session = subject;
               if (session is not in the current list of sessions
                   and we're the main window)
                   accept;
                   session.setUIManager(this);
            */
            this.log.debug('observe: New debugger connection received');
            if (!this.findSessionByApplication(subject.application)) {
                // Either we have a new debugger session, or it's in another window.
                if (ko.windowManager.getMainWindow() != window) {
                    // This check is needed.
                    //dump("observe -- not in current window\n");
                    break;
                }
                this.log.debug('observe: New debugger session initiated');
                try {
                    // Call this after manager.initHandler
                    subject.application.setUIManager(this);
                    this.onDebugStart(subject.application);
                } catch (e) {
                    this.log.exception(e);
                    try {
                        session = this.findSessionByApplication(subject.application);
                        if (session) {
                            session.terminate();
                        }
                    } catch(e) {
                        this.log.debug("unable to terminate failed session during session startup");
                    }
                }
            } else {
                this.log.debug('observe: New application thread connection received');
            }
            // This is the code that used to be in DBG_Listener
            if (ko.dbg.listener.stopOnConnect) {
                ko.dbg.listener.stop();
            }
            break;
        case 'debugger_listener':
            window.updateCommands("debuggability_changed");
            break;
        }
    },
    
    handlePopupDebugShowing: function(menupopup) {
        var menudbg_listen = menupopup.getElementsByAttribute('id', 'menu_dbgListen')[0];
        menudbg_listen.setAttribute('checked', ko.dbg.listener.isListening());
        return true;
    },

    addSelectedVariableToWatchTable: function() {
        var debuggerPanel = ko.dbg.manager.currentSession.panel.debuggerPanel;
        if (!debuggerPanel) {
            this.log.error("Can't get debugger panel");
            return;
        }
        var dview = debuggerPanel.watchVariablesTree.view;
        if (!dview) {
            this.log.error("Can't get watchVariablesTree");
            return;
        }
        var scimoz = ko.views.manager.currentView.scimoz;
        var expression = scimoz.selText || ko.interpolate.getWordUnderCursor(scimoz);
        if (expression.length === 0) {
            return;
        }
        var msg = null;
        if (!/\S/.test(expression)) {
            msg = _stringBundle.GetStringFromName("Expression contains only whitespace");
        } else if (expression.indexOf("\n") !== -1) {
            msg = _stringBundle.GetStringFromName("Expression contains a newline");
        } else if (dview.haveVariable(expression)) {
            msg = _stringBundle.formatStringFromName("Already watching variable X",
                                                         [expression], 1);
        }
        if (msg) {
            require("notify/notify").send(msg, "debugger", {priority: "warning"});
            return;
        }
        dview.addVariable(expression);
        debuggerPanel.variablesTabs.selectedIndex = 0;
    },

    QueryInterface: function (iid) {
        if (!iid.equals(Components.interfaces.nsIObserver) ||
            !iid.equals(Components.interfaces.nsISupports) ||
            !iid.equals(Components.interfaces.koIDBGPUIManager)) {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }
        return this;
    }
};


/**
  * DBG_CurrentMarker
  *
  * the marker class keeps track of where the debugger is currently at in the buffer.
  * it highlights lines for a view depending on the stack it is given.
  *
  */
function DBG_CurrentMarker() {
    this.have_setup_markers = false;
}

DBG_CurrentMarker.prototype = {
    view: null,

    clear: function()
    {
        try {
        if (this.view && typeof(this.view.markerNext) != 'undefined') {
            this.view.markerDeleteAll(ko.markers.MARKNUM_DEBUG_CURRENT_LINE);
            this.view.markerDeleteAll(ko.markers.MARKNUM_CURRENT_LINE_BACKGROUND);
        }
        } catch(e) {
            // buffer was closed
        }
    },

    set: function(view, stackFrame, top)
    {
        this.clear();
        this.view = view;
        if (!this.view || typeof(this.view.markerNext) == 'undefined')
            return;

        if (!this.have_setup_markers) {
            this.have_setup_markers = true;
            var color = require("ko/color");
            var scheme = view.scheme;
            this.linecolor = color.hexToLong(scheme.getColor('callingLineColor'));
            this.linecolorlight = color.hexToLong(scheme.getColor('currentLineColor'));
        }

        var scimoz = view.scimoz;

        //XXX Might be easier to just define separate markers for this,
        //    rather than continually updating its color.
        if (!top) {
            scimoz.markerSetBack(ko.markers.MARKNUM_CURRENT_LINE_BACKGROUND, this.linecolor);
        } else {
            scimoz.markerSetBack(ko.markers.MARKNUM_CURRENT_LINE_BACKGROUND, this.linecolorlight);
        }
        var lineno = stackFrame.lineno - 1;
        view.markerAdd(lineno, ko.markers.MARKNUM_DEBUG_CURRENT_LINE);
        view.markerAdd(lineno, ko.markers.MARKNUM_CURRENT_LINE_BACKGROUND);

        if (begin || length) {
            var begin = scimoz.positionFromLine(stackFrame.beginLine - 1) + stackFrame.beginOffset;
            var end = scimoz.positionFromLine(stackFrame.endLine - 1) + stackFrame.endOffset;
            if (end < begin)
                end = begin;
            // set the selection to the begin/length
            scimoz.selectionStart = begin;
            scimoz.selectionEnd = end;
            scimoz.anchor = begin;
        }
    }
};




/**
 * This is the UI version of a session.  DBG_Session is one to one with
 * a debugger panel.  It contains an koIDBGPApplication, and handles
 * sending commands to it for stepping, etc.  It also calls on the
 * panel when it needs to updateUI it's own information.
 **/
function DBG_Session(panel, isInteractive) {
    if (typeof(isInteractive) == 'undefined')
        isInteractive = false;
    this.isInteractive = isInteractive;
    this.log = ko.logging.getLogger('DBG_Session');
    this.log.setLevel(ko.dbg.manager.log.getEffectiveLevel()); // keep the log level the same
    this.currentmarker = new DBG_CurrentMarker();
    this.inputmarker = new DBG_CurrentMarker();
    this.panel = panel;
    this.panel.configure(this);
    this.panel.show();
    this.panel.sessionInit(isInteractive);
}
DBG_Session.prototype = {
    invoke_type: Components.interfaces.koIInvocation.INVOKE_DEBUG,
    panel: null,
    _currentState: -1, //ko.dbg.manager.STATE_AVAILABLE XXX cannot use class vars during script load
    initial_step_type: Components.interfaces.koIDBGPSession.RESUME_STEP_IN,
    cookie: null,
    start_in_progress: false,
    invocation: null,
    lastCommand: null,
    filename: "",
    input_filename: "",
    currentmarker: null,
    inputmarker: null,
    language: null,
    _dbg: null,
    _dbgApplication: null,
    log: null,
    _show_hidden_vars: -1,
    _lastPromptChar: null,
    _cursorBreak: null, // for run to cursor
    _supportsPrettyPrint: -1,
    _prettyPrint: false,
    // Have we asked the uri to perform a uri mapping this session?
    _have_asked_to_map_uris: false,
    // Are we asking the user to perform a uri mapping?
    _is_currently_asking_to_map_uris: false,

    // state information to use at debugger end
    viewAtDebuggerStart: null,
    lineAtDebuggerStart: -1,
    currentColumnAtDebuggerStart: -1,
    anchorAtDebuggerStart: -1,

    // Get the koIDebugger interface, creating and initializing if necessary.
    get dbg() {
        if (this._dbgApplication)
            return this._dbgApplication.currentSession;
        return null;
    },

    get application() {
        return this._dbgApplication;
    },

    set application(value) {
        this._dbgApplication = value;
    },

    get supportsPrettyPrint() {
        if (this._supportsPrettyPrint == -1 &&
            this.dbg) {
            try {
                this.dbg.featureGet('pretty_print');
                this._supportsPrettyPrint =  true;
            } catch(e) {
                this._supportsPrettyPrint = false;
            }
        } else if (!this.dbg || this._currentState == ko.dbg.manager.STATE_STOPPED) {
            this._supportsPrettyPrint = false;
        }

        return this._supportsPrettyPrint;
    },

    get prettyPrint() {
        if (this.supportsPrettyPrint && 
            this.dbg) {
            try {
                this._prettyPrint =  this.dbg.featureGet('pretty_print') != '0';
            } catch(e) {
                this._prettyPrint = false;
            }
        } else if (!this.dbg || this._currentState == ko.dbg.manager.STATE_STOPPED) {
            this._prettyPrint = false;
        }

        return this._prettyPrint;
    },

    set prettyPrint(value) {
        if (this._prettyPrint != value &&
            this.dbg && this.supportsPrettyPrint &&
            (this._currentState == ko.dbg.manager.STATE_BREAK ||
             this._currentState == ko.dbg.manager.STATE_INTERACTIVE)) {
            this._prettyPrint = -1;
            try {
                this.dbg.featureSet('pretty_print', value?'1':'0');
                this.updateUI();
            } catch(e) {
                this._prettyPrint = false;
            }
        }
    },
    
    get showHiddenVars() {
        if (this._show_hidden_vars == -1 &&
            this.dbg && this.dbg.supportsHiddenVars &&
            (this._currentState == ko.dbg.manager.STATE_BREAK ||
             this._currentState == ko.dbg.manager.STATE_INTERACTIVE)) {
            try {
                this._show_hidden_vars =  this.dbg.featureGet('show_hidden') != '0';
            } catch(e) {
                this._show_hidden_vars = false;
            }
        } else if (!this.dbg || this._currentState == ko.dbg.manager.STATE_STOPPED) {
            this._show_hidden_vars = false;
        }

        return this._show_hidden_vars;
    },

    set showHiddenVars(value) {
        if (this._show_hidden_vars != value &&
            this.dbg && this.dbg.supportsHiddenVars &&
            (this._currentState == ko.dbg.manager.STATE_BREAK ||
             this._currentState == ko.dbg.manager.STATE_INTERACTIVE)) {
            this._show_hidden_vars = -1;
            try {
                this.dbg.featureSet('show_hidden', value?'1':'0');
            } catch(e) {
                this._show_hidden_vars = false;
            }
        }
    },

    release: function() {
        /* only shutdown if there are no more sessions in the application */
        this.log.debug('release application');
        try {
            if (this._dbgApplication) {
                this._dbgApplication.shutdown();
                this._dbgApplication = null;
            }
        } catch(e) {
            this.log.exception(e);
        }
    },

    breaknow: function() {
        this.log.debug('breaknow into debugger session');
        try {
            if (this.dbg)
                this.dbg.breakNow();
        } catch(e) {
            this.log.exception(e, "XXX Caught exception on this.dbg.breaknow\n");
        }
    },

    stop: function() {
        this.log.debug('stop debugger session');
        try {
            if (this.dbg)
                this.dbg.stop();
        } catch(e) {
            this.log.exception(e, "XXX Caught exception on this.dbg.stop\n");
            // likely the socket has been disconnected by the client already
            this.setState(ko.dbg.manager.STATE_STOPPED);
            this.shutdown();
        }
    },

    detach: function() {
        this.log.debug('detaching UI session');
        try {
            // if we invoked a session localy, and it never connected
            // back to us, we wont have dbg to stop it, but want
            // to release
            if (this.dbg)
                this.dbg.detach();
        } catch(e) {
            this.log.exception(e, "XXX Caught exception on this.dbg.detach\n");
        }

        this.updateUI(ko.dbg.manager.STATE_STOPPED);
    },

    terminate: function() {
        this.log.debug('terminating UI session');
        this.stop();

        if (this.invocation) {
            // local debugging, we have an invocation, and we
            // can kill that ourselves, better than calling kill
            // due to language deficencies (ie. python threads will
            // not kill).
            try {
                this.invocation.terminate(99,1);
            } catch(e) {
                this.log.exception(e); // already dead
            }
        }

        this.updateUI(ko.dbg.manager.STATE_STOPPED);
    },

    switchToFirstBreakThread: function() {
        if (!this.application || !this.dbg)
            return false;

        var tmp = new Object();
        this.application.getSessionList(tmp, new Object());
        var threads = tmp.value;
        for (var i=0; i < threads.length; i++) {
            if (threads[i].status == ko.dbg.manager.STATE_BREAK) {
                return this.switchThread(threads[i]);
            }
        }
        return true;
    },
    
    switchThread: function(toThread)
    {
        // switch the application to another thread, doesn't really matter
        // which one, just not the current thread
        if (!this.application || !this.dbg)
            return false;

        // this.log.debug("application has ["+threads.length+"] threads")
        if (typeof(toThread) != 'undefined' && toThread) {
            this.application.currentSession = toThread;
            this._timeout = new ko.objectTimer(this,this.updateUI,[]);
            this._timeout.startTimeout(1);
            return true;
        } else {
            // switch threads
            var tmp = new Object();
            this.application.getSessionList(tmp, new Object());
            var threads = tmp.value;
            if (threads.length > 1) {
    
                if (this.dbg == threads[0])
                    this.application.currentSession = threads[1];
                else
                    this.application.currentSession = threads[0];
    
                // this.log.debug("setting current thread to "+this.dbg.threadId)
                this._timeout = new ko.objectTimer(this,this.updateUI,[]);
                this._timeout.startTimeout(1);
                return true;
            }
        }
        this.log.debug("did not switch thread");
        return false;
    },

    showParentTab: function()
    {
        // attempt to switch to the parent tab if we have a parentid
        if (!this.dbg || !this.dbg.parentId)
            return false;

        var parentSession = ko.dbg.manager.findSessionByApplicationID(this.dbg.parentId);
        if (parentSession) {
            ko.dbg.manager.setCurrentSession(parentSession);
            parentSession.panel.show();
            return true;
        }
        return false;
    },

    shutdown: function()
    {
        try {
            this.showParentTab();

            // clean ourselves up now
            this.release();
            this.invocation = null;
            this.panel.sessionEnd();

            // clear the current marker
            this.currentmarker.clear();
            this.inputmarker.clear();
        } catch (e) {
            this.log.exception(e);
        }

        // we want to do this even if we get an exception above
        try {
            ko.dbg.manager.removeSession(this);

            // Bug 80610: Don't restore start position for "Run without
            // debugging". Also check a pref whether to do so for interactive
            // debug sessions.
            if (this.invoke_type != ko.dbg.invocation.INVOKE_RUN
                && ko.prefs.getBooleanPref(
                    "debuggerRestoreStartPosAtEndOfSession")) {
                this._restoreViewState();
            }
        } catch (e) {
            this.log.exception(e);
        }
    },

    setState: function(value)
    {
        this._currentState = value;
    },

    getState: function()
    {
        try {
            if (this.dbg) {
                this._currentState = this.dbg.status
            }
        } catch(e) {
            this.log.exception(e);
        }
        return this._currentState;
    },

    showCurrentStatement: function()
    {
        try {
            var frame = this.dbg.stackGet(0);
            if (frame) {
                this.log.debug("showCurrentStatement: file is " + frame.filename + ", line " + frame.lineno);
                this.showStackPosition(frame, 0);
            }
        } catch(e) {
            this.log.exception(e);
        }
    },

    saveViewState: function(view)
    {
        this.log.debug("_saveViewState");
        this.viewAtDebuggerStart = view;
        this.lineAtDebuggerStart = view.currentLine;
        this.anchorAtDebuggerStart = view.anchor;
        this.currentColumnAtDebuggerStart = view.currentColumn;
    },

    _restoreViewState: function()
    {
        this.log.debug("_restoreViewState");
        try {
            if (!this.viewAtDebuggerStart ||
                this.isInteractive) {
                // make the current view focused, otherwise debugger controllers
                // get lost
                if (ko.views.manager.currentView) {
                    ko.views.manager.currentView.makeCurrent();
                }
                return;
            }

            // If the view that we started with still exists (wasn't closed), get back to it.
            this.viewAtDebuggerStart.makeCurrent();
            this.viewAtDebuggerStart.currentLine = this.lineAtDebuggerStart;
            this.viewAtDebuggerStart.anchor = this.anchorAtDebuggerStart;
            this.viewAtDebuggerStart.currentColumn = this.currentColumnAtDebuggerStart;
        } catch (e) {
            // none of the above really matters.
            this.log.exception(e);
        }
    },

    /*
      redefine the prompt marker if necessary
    */
    definePromptMarker: function(prompt, markerNum)
    {
        // XXX PYTHON HACK for >>>/... prompts.  other languages will juse
        // use the first char of the prompt string we get
        if (prompt != this._lastPromptChar) {
            if (prompt == ">>> ") {
                this.panel.debuggerPanel.terminalView.scimoz.
                        markerDefinePixmap(ko.markers.MARKNUM_INTERACTIVE_PROMPT,
                                           ko.markers.getPixmap("chrome://komodo/skin/images/prompt.xpm"));
            } else if (prompt == "... ") {
                var scimoz = this.panel.debuggerPanel.terminalView.scimoz;
                scimoz.markerDefine(
                        ko.markers.MARKNUM_INTERACTIVE_PROMPT_MORE, scimoz.SC_MARK_DOTDOTDOT);
            } else {
                var promptChar = prompt.charCodeAt(0);
                if (!promptChar)
                    promptChar = '%'.charCodeAt(0);

                this.panel.debuggerPanel.terminalView.scimoz.
                        markerDefine(markerNum, Components.interfaces.ISciMoz.SC_MARK_CHARACTER+promptChar);
            }
            this._lastPromptChar = prompt;
        }
    },

    /*
       make necessary changes in the UI, such as the current debugger line in scintilla,
       status of the debugger buttons in the toolbar, etc.
    */
    updateUI: function(state /*=NULL*/)
    {
        try {
            if (typeof(state) == 'undefined' || !state)
                state = this.getState();
            else
                this.setState(state);

            // this.log.debug('updateUI: '+ko.dbg.manager.stateNames[state]);
            if (!ko.dbg.manager.currentSession) {
                // this happens if we had multiple debug sessions, and the
                // current session ended
                ko.dbg.manager.setCurrentSession(this);
                this.panel.show();
            }

            switch(state) {
            case ko.dbg.manager.STATE_BREAK:
                if (ko.dbg.manager.currentSession == this) {
                    var editorTooltipHandler = xtk.domutils.tooltips.getHandler('editorTooltip');
                    this.showCurrentStatement();
                    window.getAttention();
                    var view = ko.views.manager.currentView;
                    // Note that changing statements could have caused the
                    // tooltip to be closed.
                    if (view && editorTooltipHandler.isOpen()) {
                        view.updateTooltipText();
                    }
                } else if (ko.dbg.manager.currentSession.getState() != ko.dbg.manager.STATE_BREAK) {
                    this.switchThread(this.dbg);
                }
                break;
            case ko.dbg.manager.STATE_INTERACTIVE:
                // get the cursor prompt and set it into the terminal
                var prompt = this.dbg.interactivePrompt;

                var markerNum = ko.markers.MARKNUM_INTERACTIVE_PROMPT
                if (this.dbg.interactiveState > 0) {
                    markerNum = ko.markers.MARKNUM_INTERACTIVE_PROMPT_MORE
                }
                this.definePromptMarker(prompt, markerNum);
                this.panel.debuggerPanel.terminalView.setPromptMarker(markerNum);
                window.getAttention();
                break;
            case ko.dbg.manager.STATE_STOPPING:
                // if we're multithreaded, switch to another thread before we
                // stop this thread.  We only call STOP on the last thread of
                // the application
                if (this.application.sessionCount() == 1) {
                    // XXX in the future we don't want to end debugging here,
                    // as we will want to allow for introspecting profileing or
                    // code coverage information
                    if (this.dbg.reason == Components.interfaces.koIDBGPSession.REASON_OK
                        || !this.dbg.supportsPostmorem) {
                        this.stop();
                    }
                } else {
                    // never allow a thread to be the main thread when we reach
                    // state stopped.  This is an issue due to the way async
                    // notifications work, and the fact that we have to use async
                    // notifications from dbgpServerAPI.  First save the current
                    // thread session, then switch to another, then detach the thread
                    // dont use stop here, that will kill the application.
                    var thread = this.dbg;
                    this.switchThread();
                    thread.detach();
                }
                break;

            case ko.dbg.manager.STATE_STOPPED:
                // only the last thread alive should ever make it here.  all threads issuing
                // a state stopped will end up calling updateThread below, because we do
                // a switchThread call in the state stopping above if there is more than one
                // thread in the application.
                this.shutdown();
                break;
            case ko.dbg.manager.STATE_RUNNING:
                this.switchToFirstBreakThread();
                break;
            }

            // update ui specific to this session
            this.panel.updateUI();
        } catch (e) {
            this.log.exception(e);
        }
        xtk.domutils.fireEvent(window, 'debugger_state_changed');
        window.updateCommands("debug_state");
    },

    updateThread: function(thread)
    {
        // if we're here it is because we are not the current thread selected in
        // the UI, and so we do not want to update the primary UI, but doing tweaks
        // on the panel is fine.
        switch(thread.status) {
        case ko.dbg.manager.STATE_STOPPING:
            this.log.debug('updateThread: detaching a thread');
            // we don't want to call STOP as that ends the debugger session, we just
            // want to detach the thread that is stopping so we dont have a bunch
            // of threads hanging around waiting for the debugger to finish.
            thread.detach();
            break;
        case ko.dbg.manager.STATE_BREAK:
            if (ko.dbg.manager.currentSession.getState() != ko.dbg.manager.STATE_BREAK) {
                this.switchThread(this.dbg);
            }
            break;
        }
        // make sure we update the ui at this point, to avoid having non-existent
        // threads in the ui
        this.panel.updateUI();
    },

    canStep: function()
    {
        try {
            if (!this.dbg)
                return true;
            if (this._currentState == ko.dbg.manager.STATE_BREAK)
                return true;
            if (!ko.views.manager.currentView ||
                ko.views.manager.currentView.getAttribute('type') != 'editor' ||
                !ko.views.manager.currentView.koDoc ||
                !ko.views.manager.currentView.koDoc.file
                // XXX || !ko.views.manager.currentView.koDoc.languageObj.debuggable
                )
                return false;
            return (this._currentState == ko.dbg.manager.STATE_STOPPED || this._currentState == ko.dbg.manager.STATE_AVAILABLE);
        } catch(e) {
            this.log.error(e);
        }
        return false;
    },

    doStep: function(step_type, runToCursor)
    {
        this.log.debug('doStep '+step_type);
        if (typeof(runToCursor) == 'undefined') runToCursor = false;

        this.lastCommand = step_type;
        if (runToCursor) {
            var v = ko.views.manager.currentView;
            if (v)
                this._cursorBreak = [v.koDoc.language,
                                     v.koDoc.file.URI,
                                     v.currentLine];
        }

        if (!this.dbg) {
            /* we're being invoked, we cannot resume yet.  reset
               the initial step type so this works on startup */

            this.initial_step_type = step_type;
            return;
        }
        if (this._cursorBreak) {
            this.setTemporaryBreakpoint(this._cursorBreak[0],
                                        this._cursorBreak[1],
                                        this._cursorBreak[2]);
            this._cursorBreak = null;
        }

        var state = this.getState();
        if (state == ko.dbg.manager.STATE_BREAK || state == ko.dbg.manager.STATE_STARTING) {
            this.log.debug('session in break state, resuming: '+step_type);
            try {
                this.currentmarker.clear();
                this.inputmarker.clear();
                this.dbg.resume(step_type);
            } catch(e) {
                this.log.exception(e, "XXX Caught exception on this.dbg.resume\n");
            }
        } else if (state == ko.dbg.manager.STATE_INTERACTIVE) {
            // initiate an interactive session
            try {
                this.dbg.interact('');
            } catch(e) {
                this.log.exception(e, "XXX Caught exception on this.dbg.interact\n");
            }
        } else {
            this.log.debug('session not in break state, cannot step: '+state);
        }
    },

    /*
        this handles 'run-to-cursor' capabilitiy.  this should only be called if
        we know that a run to cursor has been requested.
    */
    setTemporaryBreakpoint: function(language, filename, lineno)
    {
        this.log.debug('add temporary breakpoint for run to line');
        // we dont use the breakpoint manager, since it likes to persist breakpoints,
        // update ui, lots of stuff, this is easier
        var bp = Components.classes["@activestate.com/koDBGPBreakpoint;1"].
                    createInstance(Components.interfaces.koIDBGPBreakpoint);
        bp.language = language;
        bp.filename = filename;
        bp.lineno   = lineno;
        bp.type     = 'line';
        bp.state    = 'enabled';
        bp.temporary = true;
        bp.hitValue = 0;
        bp.hitCondition = null;
        this.dbg.breakpointSet(bp);
    },

    canRun: function()
    {
        try {
            // debuggable only means that the invocation is loadable
            // but it will at least prevent a run on anything that
            // does not have an invocation or debugger support in some way
            if (!ko.views.manager.currentView ||
                ko.views.manager.currentView.getAttribute('type') != 'editor' ||
                !ko.views.manager.currentView.koDoc ||
                !ko.views.manager.currentView.koDoc.file
                // XXX || !ko.views.manager.currentView.koDoc.languageObj.debuggable
                )
                return false;
            return (this._currentState == ko.dbg.manager.STATE_STOPPED || this._currentState == ko.dbg.manager.STATE_AVAILABLE);
        } catch(e) {
            this.log.error(e);
        }
        return false;
    },

    isLocalHost: function(host)
    {
        // XXX need to do better here
        return host == "localhost" || host == "127.0.0.1";
    },

    startDebugging: function(isRemote)
    {
        if (typeof(isRemote)=='undefined') isRemote = false;
        var threads = this.application.sessionCount();
        this.log.debug('session startDebugging thread '+threads);

        if (threads == 1) {
            // XXX - move to caller - pass the prefset
            // Create a preference set for the debugger.
            this.prefset = Components.classes["@activestate.com/koPreferenceSet;1"].createInstance();
            this.prefset.setStringPref("debugger.language", this.dbg.languageName);
            this.prefset.setStringPref("debugger.listener-reponse.host", this.dbg.address);
            this.prefset.setLongPref("debugger.listener-reponse.port", this.dbg.port);

            var emulate_cgi = false;
            var debugger_redirect = true; // not via invocation - treat as remote.

            // local connection - if we have an invocation, then use
            // the "use-console" preference - otherwise treat as
            // remote debug.
            if (this.invocation) {
                // hook up invocation preferences, and use them for debug session.
                this.invocation.currentCategoryPreferences.parent = this.prefset;
                this.prefset = this.invocation.currentInstancePreferences;
                debugger_redirect = (this.prefset.getBoolean("use-console", false) && this.dbg.languageName != "Tcl") ||
                                    this.dbg.languageName == "JavaScript"; // Chrome remote debugging needs this
                emulate_cgi = this.prefset.getBoolean("sim-cgi", false);
            }

            this.panel.sessionStart();
            if (this.isInteractive) {
                // only turn on syntax coloring for interactive shells
                this.panel.debuggerPanel.terminalView.language = this.dbg.languageName;
            }
            // hook up the terminal with the invocation handles
            if (debugger_redirect) {
                this.panel.debuggerPanel.terminalHandler.setupDebuggerRedirectIOHandles();
                try {
                    if (!emulate_cgi && this.panel.debuggerPanel.terminalHandler.stdin)
                        this.application.setStdinHandler(this.panel.debuggerPanel.terminalHandler.stdin);
                } catch(e) {
                    // we tried, failed, don't care.  either the debug
                    // session is cgi, or the engine doesn't support this
                }
                if (this.panel.debuggerPanel.terminalHandler.stdout)
                    this.application.setStdoutHandler(this.panel.debuggerPanel.terminalHandler.stdout, 1/*copy*/);
                if (this.panel.debuggerPanel.terminalHandler.stderr)
                    this.application.setStderrHandler(this.panel.debuggerPanel.terminalHandler.stderr, 1/*copy*/);
            }
            this.panel.debuggerPanel.terminalHandler.stdinHandler = this.application.interactiveHandler;
        }

        // XXX TODO implement property and data paging, for now,
        // wimp out and set a very high value for max_data and
        // max_children

        // Bug 93337 - the prefs widget guards against these values,
        // but in case an API call set an invalid value, give a message
        // and set any invalid values back to their default.
        var tmpValue = ko.prefs.getLongPref('debuggerMaxDepth');
        var msg;
        if (tmpValue <= 0) {
            msg = _stringBundle.formatStringFromName("Invalid debuggerMaxDepth of X resetting to Y",
                                                     [tmpValue, 1], 2);
            ko.dialogs.alert(msg);
            ko.prefs.setLongPref('debuggerMaxDepth', tmpValue = 1);
        }
        this.dbg.maxDepth = tmpValue;
        tmpValue = ko.prefs.getLongPref('debuggerMaxData');
        if (tmpValue <= 0) {
            msg = _stringBundle.formatStringFromName("Invalid debuggerMaxData of X resetting to Y",
                                                     [tmpValue, 10240], 2);
            ko.dialogs.alert(msg);
            ko.prefs.setLongPref('debuggerMaxData', tmpValue = 10240);
        }
        this.dbg.maxData = tmpValue;
        tmpValue = ko.prefs.getLongPref('debuggerMaxChildren');
        if (tmpValue <= 0) {
            msg = _stringBundle.formatStringFromName("Invalid debuggerMaxChildren of X, resetting to Y",
                                                     [tmpValue, 25], 2);
            ko.dialogs.alert(msg);
            ko.prefs.setLongPref('debuggerMaxChildren', tmpValue = 25);
        }
        this.dbg.maxChildren = tmpValue;

        this.dbg.updateStatus();
        var state = this.getState();
        if (isRemote && state != ko.dbg.manager.STATE_STARTING && state != ko.dbg.manager.STATE_INTERACTIVE) {
            // bug 44629
            // this state happens if debugging was started in a remote
            // process via a break statement (eg. dbgp.client.brk())
            // the process is already in a break state so we do not want to
            // do a step, just refresh the UI to show the current line, etc.
            // correctly.
            // *BUT* bug 100884: For the languages named here, we'll need to 
            // continue until we hit a breakpoint (or $DB::single = 1 stmt)
            // at the start.  This is because these languages initialize the
            // debugger later than PHP or Python, so they always stop at the 
            // first executable line.

            if (!ko.prefs.getBooleanPref('debug_break_on_remote_connect')
                && ["Perl", "Ruby", "Tcl"].indexOf(this.dbg.languageName) >= 0) {
                this.doStep(Components.interfaces.koIDBGPSession.RESUME_GO);
            } else {
                this.updateUI();
            }
        } else {
            if (isRemote) {
                if (state == ko.dbg.manager.STATE_INTERACTIVE) {
                    this.initial_step_type = Components.interfaces.koIDBGPSession.RESUME_INTERACTIVE;
                } else
                if (!ko.prefs.getBooleanPref('debug_break_on_remote_connect')) {
                    this.initial_step_type = Components.interfaces.koIDBGPSession.RESUME_GO;
                } else {
                    this.initial_step_type = Components.interfaces.koIDBGPSession.RESUME_STEP_IN;
                }
            }
            this.doStep(this.initial_step_type);
        }
    },

    enterInteractiveMode: function DBG_Session_enterInteractiveMode()
    {
        this.panel.debuggerPanel.terminalView.scimoz.readOnly = 0;
        this.dbg.interact("");
        this.panel.debuggerPanel.outputTabs.selectedIndex = 0;
        this.panel.debuggerPanel.terminalView.setFocus();
        this.panel.debuggerPanel.terminalView.language = this.dbg.languageName;
        this.panel.debuggerPanel._infoText = this.panel.debuggerPanel.infoText.value;
        setTimeout(() =>
        {
            this.panel.debuggerPanel.infoText.value =  "Stepping disabled while inspecting";
        }, 50);
    },

    leaveInteractiveMode: function DBG_Session_leaveInteractiveMode()
    {
        this.dbg.interact(null);
        // always add a last newline when leaving interactive mode, since we're
        // currently at a prompt and we want to advance the buffer
        this.panel.debuggerPanel.terminalView.scimoz.newLine();
        this.panel.debuggerPanel.terminalView.scimoz.readOnly = 1;
        this.panel.debuggerPanel.infoText.value = this.panel.debuggerPanel._infoText;
    },

    showStackPosition: function(stackFrame, frameNumber)
    {
        try {
            // XXX Fixme : need to do smarter koResource stuff here.
            // Just attempt to open the URI.  If it is already open, then fine!
            this.log.info('StackFrame URI: '+stackFrame.filename+' Line: '+stackFrame.lineno);
  
            // certain stack types will not have files associated with them, such as a console.
            // dont try to open the file for it.
            if (!stackFrame.filename || stackFrame.type == 'console') {
                return;
            }

            var self = this;
            // Record a location only if we're in a different section change,
            // regardless of the location given by the stackframe.
            // Asynchronously open the file.
            ko.dbg.manager.doFileOpenAtLine(stackFrame.filename,
                                            stackFrame.lineno,
                                            'editor',
                                            null,
                                            function(v) {
                if (!v) {
                    // File was not opened. Nothing to do then.
                    return;
                }
                self.currentmarker.set(v, stackFrame, frameNumber != 0);

                // Attempt to open input file, only used for XSLT debugging.
                if (typeof(stackFrame.inputFrame) != 'undefined' &&
                    stackFrame.inputFrame) {

                    self.log.info("INPUT FILE: "+stackFrame.inputFrame.filename+" LINE: "+stackFrame.inputFrame.lineno+"\n");
                    try {
                        if (v.alternateViewList) {
                            var views = v.alternateViewList.findViewsForURI(stackFrame.inputFrame.filename);
                            var iv = null;
                            if (!views.length) {
                                // if it's in the same view list as the primary file, then
                                // split it into the alternate window
                                views = v.parentView.findViewsForURI(stackFrame.inputFrame.filename);
                                if (views.length) {
                                    iv = views[0];
                                    if (iv) {
                                        ko.views.manager.topView.splitView(iv);
                                    }
                                }
                            }
                            if (views.length) {
                                iv = views[0];
                                if (iv != v.alternateViewList.currentView)
                                    iv.makeCurrent(true); // dont grab focus
                                iv.currentLine = stackFrame.inputFrame.lineno;
                                self.inputmarker.set(iv,
                                                     stackFrame.inputFrame,
                                                     frameNumber != 0);
                            } else {
                                // This file open does not need to be Async, as
                                // it's already being called in a setTimeout.
                                ko.dbg.manager.doFileOpenAtLine(
                                    stackFrame.inputFrame.filename,
                                    stackFrame.inputFrame.lineno,
                                    null,
                                    v.alternateViewList,
                                    function(iv_) {
                                        v.setFocus();
                                        self.inputmarker.set(iv_,
                                                             stackFrame.inputFrame,
                                                             frameNumber != 0);
                                    });
                            }
                        }
                    } catch(e) { self.log.exception(e); }
                }
                // reset the focus if we're in interactive mode
                if (self.getState() == ko.dbg.manager.STATE_INTERACTIVE) {
                    self.panel.debuggerPanel.terminalView.setFocus();
                }
                self = null;
            });
        } catch (e) {
            this.log.exception(e);
        }
    },

    resetStackPosition: function(view)
    {
        //debugger_reset_stack_position
        var fv = ko.views.manager.currentView;
        if (fv && !view != fv && fv.alternateViewList) {
            if (view == fv.alternateViewList.currentView) {
                /* when we reset the parent pane, this pane
                   will get reset also */
                return;
            }
        }
        this.currentmarker.clear();
        this.inputmarker.clear();
    },

    /**
     * Called from DBG_Manager::notifyDebuggerSessionStateChange on state change
     * (e.g. run->break, or entering interactive mode).
     * 
     * @param   {Number} newState The new state as a koIDBGPSession::STATUS_*
     *              constant.
     */
    notifyStateChange: function DBG_Session_notifyStateChange(newState) {
        // For now, just tell the panel about it
        this.panel.sessionStateChange(newState);
    },

    QueryInterface: function (iid) {
        if (!iid.equals(Components.interfaces.nsISupports)) {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }
        return this;
    }
};


var gOpeningDialog = false;

// OLD COMMENTS
// Get the "current" invocation to use, creating an appropriate one of
// necessary.
// Need some smarts here:
// A "project" and a "view" optionally have invocation data
// If the current view has a set, we use them.
// If not, look if the project has one, and use them.

// Depending on requirements, each project/file may have multiple
// invocations stored - so may need to pass multiple invocations to the
// dialog.
this.invocation = {
    INVOKE_RUN: Components.interfaces.koIInvocation.INVOKE_RUN,
    INVOKE_DEBUG: Components.interfaces.koIInvocation.INVOKE_DEBUG,
    INVOKE_BUILD: Components.interfaces.koIInvocation.INVOKE_BUILD,
    INVOKE_INTERACTIVE: Components.interfaces.koIInvocation.INVOKE_INTERACTIVE,
    INVOKE_PROFILE: Components.interfaces.koIInvocation.INVOKE_PROFILE,
    _log: null,

    get log() {
        if (!this._log) {
            this._log = ko.logging.getLogger('ko.dbg.invocation');
            this._log.setLevel(ko.dbg.manager.log.getEffectiveLevel());
        }
        return this._log;
    },

    getInteractiveInvocation: function ko_dbg_invocation_getInteractiveInvocation(session, onSuccessCallback, onErrorCallback)
    {
        this.log.debug('ko.dbg.invocation.getInteractiveInvocation')
        if (!onSuccessCallback) onSuccessCallback = function() {};
        if (!onErrorCallback) onErrorCallback = function() {};

        var invocation = null;
        try {
            invocation = Components.classes["@activestate.com/koInvocation;1?type="+session.language].createInstance();
        } catch (e) {
            this.log.error("Failed to create invocation '" + session.language + "' - " + e + "\n");
        }
        if (invocation) {
            var catOb = new Object();
            var instOb = new Object();
            invocation.getDefaultPreferences(catOb, instOb);
            invocation.currentCategoryPreferences = catOb.value;
            invocation.currentInstancePreferences = instOb.value;
            if (!this.isValidInterpreter(invocation, session)) {
                onErrorCallback(null);
                return;
            }
            // figure out what the cwd for the ishell should be
            var cwd_policy = ko.prefs.getStringPref('ishell_cwd_type');
            var cwd = '';
            if (cwd_policy == 'specific') {
                cwd = ko.prefs.getStringPref('ishell_cwd_specific');
            } else if (cwd_policy == 'project') {
                var projectPath = ko.interpolate.activeProjectPath();
                if (projectPath == '') {
                    cwd = ko.window.getCwd();
                } else {
                    cwd = ko.uriparse.dirName(projectPath);
                }
            } else if (cwd_policy == 'file') {
                cwd = ko.window.getCwd();
            }
            if (!cwd) {

            }
            if (cwd) {
                invocation.currentInstancePreferences.setStringPref('cwd', cwd);
            }
        }

        var supports_interactive = invocation &&
                          (invocation.supportedInvokeTypes &
                            ko.dbg.invocation.INVOKE_INTERACTIVE) != 0;

        if (session.invoke_type == ko.dbg.invocation.INVOKE_INTERACTIVE && !supports_interactive) {
            var ishellPrefsURL = "chrome://komodo/content/pref/pref-ishell.xul";
            const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
            var req = new XMLHttpRequest();
            var onDocLoaded = function(docObject) {
                var menulist = docObject.getElementById("prefered_language");  //[sic]
                var menuitems = menulist.getElementsByTagNameNS(XUL_NS, "menuitem");
                var supportedLanguages = Array.slice(menuitems).map(function(elt) elt.getAttribute("data"));
                var prompt;
                if (supportedLanguages.indexOf(session.language) == -1) {
                    prompt = _stringBundle.formatStringFromName("There is no interactive shell for X", [session.language], 1);
                } else {
                    prompt = _stringBundle.formatStringFromName("The current setting for X doesnt support an interactive shell", [session.language], 1);
                }
                var title = _stringBundle.GetStringFromName("Interactive Shell Error");
                ko.dialogs.alert(prompt, null, title);
                session.shutdown();
                onErrorCallback(null);
            };
                    
            req.onreadystatechange = function() {
                if (req.readyState == 4 && (req.status == 200 || req.status == 0)) { // 0? it happens...
                    try {
                        onDocLoaded(req.responseXML);
                    } catch(ex) {
                        this.log.exception(ex);
                    }
                }
            };
            req.open("GET", ishellPrefsURL, true);
            req.overrideMimeType('text/xml; charset=utf-8');
            req.send(null);
            return;
        }
        var prefset = Components.classes["@activestate.com/koPreferenceSet;1"]
            .createInstance(Components.interfaces.koIPreferenceSet);
        prefset.parent = ko.prefs;
        invocation = this.showInvocationDialog(invocation, session, prefset, null);
        onSuccessCallback(invocation);
    },

    makeDefaultInvocation: function(prefs, scriptData)
    {
        scriptData.invocationName = 'default';
        var invocationPrefs = null;
        if (!prefs.hasPrefHere("Invocations")) {
            invocationPrefs = Components.classes["@activestate.com/koPreferenceSet;1"].createInstance();
            invocationPrefs.id = "Invocations";
            prefs.setPref( invocationPrefs.id, invocationPrefs);
        } else {
            invocationPrefs = prefs.getPref("Invocations");
        }
        
        // make a default invocation prefset for this script
        var invocation = Components.classes["@activestate.com/koInvocation;1?type="+scriptData.language].createInstance();
        var catOb = new Object();
        var instOb = new Object();
        invocation.getDefaultPreferences(catOb, instOb);
        invocation.currentCategoryPreferences = catOb.value;
        invocation.currentInstancePreferences = instOb.value;

        var iprefs = invocation.currentInstancePreferences;
        iprefs.id = scriptData.invocationName;
        iprefs.setStringPref("filename", scriptData.session.filename);
        if (scriptData.session.input_filename) {
            iprefs.setStringPref("inputfile", scriptData.session.input_filename);
        }
        var instance_prefs = invocation.persistableInstancePreferences;
        instance_prefs.parent = invocationPrefs;
        prefs.setStringPref('lastInvocation', scriptData.invocationName);
        invocationPrefs.setPref(instance_prefs.id, instance_prefs);
        return [invocation, instance_prefs];
    },
    
    getStoredInvocation: function(prefs, scriptData)
    {
        // this will always prefer the project preferences over the file
        // preferences if no previous debug session has occured, and the file
        // is in a project with project invocations available
        
        // get the stored prefs we want to use
        var root = null;
        var defaultInvocation = null;
        var invocationName = scriptData.invocationName;
        if (prefs.hasPrefHere("Invocations")) {
            root = prefs.getPref("Invocations");
            if (root.hasPref(invocationName)) {
                return [null, root.getPref(invocationName)];
            }
            if (root.hasPref("default")) {
                defaultInvocation = [null, root.getPref("default")];
                scriptData.invocationName = "default";
            }
        } else {
            try {
                // make the default prefs if we've never debugged this script
                defaultInvocation = this.makeDefaultInvocation(prefs, scriptData);
            } catch(e) {
                // that failed, because we do not have an invocation class for
                // the language.  We'll default to project prefs if they exist.
                // DO NOTHING HERE
            }
        }
        if (prefs.parent.hasPref("Invocations")) {
            root = prefs.parent.getPref("Invocations");
            if (root.hasPref(invocationName)) {
                return [null, root.getPref(invocationName)];
            }
            // try default project prefs
            if (root.hasPref("Project")) {
                defaultInvocation = [null, root.getPref("Project")];
                scriptData.invocationName = "Project";
            }
        }
        if (defaultInvocation && defaultInvocation[1]) {
            return defaultInvocation;
        }
        return [null, null]
    },
    
    makeInvocation: function(prefs, scriptData)
    {
        var invocationData = this.getStoredInvocation(prefs, scriptData);
        if (invocationData[0]) return invocationData[0];
        var storedPrefs = invocationData[1];
        var langName = scriptData.language;
        if (!langName && storedPrefs) {
            langName = storedPrefs.getString("language", "");
        }
        // Create a default invocation for this view.
        if (langName && scriptData.invocationName) {
            try {
                var invocation = Components.classes["@activestate.com/koInvocation;1?type="+langName].createInstance();
            } catch (e) {
                this.log.error("Failed to create invocation '" + langName + "' - " + e + "\n");
                return null;
            }

            var catOb = new Object();
            var instOb = new Object();
            invocation.getDefaultPreferences(catOb, instOb);
            invocation.currentCategoryPreferences = catOb.value;
            invocation.currentInstancePreferences = instOb.value;

            var iprefs = invocation.currentInstancePreferences;
            // Update the invocation preferences from the global preference set.
            if (storedPrefs) {
                iprefs.update( storedPrefs );
            }
            iprefs.id = scriptData.invocationName;

            // Setup other default values.
            if (scriptData.session.filename && !iprefs.getString("filename", '')) {
                iprefs.setStringPref("filename", scriptData.session.filename);
            }
            if (scriptData.session.input_filename && !iprefs.getString("inputfile", '')) {
                iprefs.setStringPref("inputfile", scriptData.session.input_filename);
            }
        }
        return invocation;
    },
    
    getInvocation: function ko_dbg_invocation_getInvocation(session, onSuccessCallback, onErrorCallback)
    {
        this.log.debug('ko.dbg.invocation.getInvocation')
        //  _debugger_do_get_invocation
        // MUST get the MAIN viewManagers current view for debugging
        var koDoc, curView =  ko.views.manager.currentView;
        if (curView == null || !(koDoc = curView.koDoc) || !koDoc.file) {
            onErrorCallback(null);
            return;
        }
        var partSvc = Components.classes["@activestate.com/koPartService;1"]
                        .getService(Components.interfaces.koIPartService);
        var projectPrefs = partSvc.getEffectivePrefsForURL(koDoc.file.URI);
        // prefs could be off the project.  But if no invocations are defined
        // on the project, use the document's prefs instead.
        var documentPrefs = koDoc.prefs;
        var langName = koDoc.language;
        var scriptData = {
            language: langName,
            invocationName: 'default',
            session: session
        };

        var onSessionReady = function(sesssion) {
            session.saveViewState(curView);
            session.filename = "";
            session.input_filename = "";
            try {
                session.filename = koDoc.file.path;
                // XXX a better way to handle input views is necessary!
                if (langName == "XSLT" && curView.alternateViewList) {
                    var iv = curView.alternateViewList.currentView;
                    if (iv) session.input_filename = iv.koDoc.file.displayPath;
                }
            } catch (e) {
                // Invalid URL - Quite likely a "kodebugger" URL!
                // that is fine - we still allow them to invoke something, just don't
                // default the filename.
            }
    
            // Locate an invocation to use.
            // Favor the file prefset over the project prefset, for the
            // last invocation.  But fallback to the file if there is no
            // last invocation.
            var invocation;
            var isDocumentInvocation = documentPrefs.getBoolean('lastInvocationIsDocument', true);
            var hasDocumentInvocation = documentPrefs.hasStringPref('lastInvocation');
            var hasProjectInvocation = projectPrefs && projectPrefs.hasStringPref('lastInvocation');
            var _targetPrefs;
            // Bug 98751: Prefer project prefs to the doc prefs.
            if (hasProjectInvocation) {
                _targetPrefs = projectPrefs;
            } else if (hasDocumentInvocation) {
                _targetPrefs = documentPrefs;
            } else {
                _targetPrefs = null;
            }
            if (_targetPrefs) {
                scriptData.invocationName = _targetPrefs.getStringPref('lastInvocation');
                // If we're using project prefs, we might need to fix the language
                if (projectPrefs) {
                    try {
                        scriptData.language =
                            (projectPrefs.getPref("Invocations")
                             .getPref(scriptData.invocationName)
                             .getStringPref("language"));
                    } catch(ex) {
                        // bug 100340: ignore errors if some prefs are missing
                    }
                }
                invocation = this.makeInvocation(_targetPrefs, scriptData);
            } else {
                invocation = this.makeInvocation(documentPrefs, scriptData);
            }
            if (!invocation) {
                var msg;
                if (("@activestate.com/koInvocation;1?type=" + langName)
                    in Components.classes) {
                    msg = _stringBundle.
                            formatStringFromName("Komodo failed to set up the debugger for language X",
                                                 [langName], 1);
                } else {
                    msg = _stringBundle.
                            formatStringFromName("Komodo does not support execution of X files",
                                                 [langName], 1);
                }
                ko.dialogs.alert(msg, null, 'Debugger Error');
                session.shutdown();
                onErrorCallback(null);
                return;
            }
            if (!this.isValidInterpreter(invocation, session)) {
                onErrorCallback(null);
                return;
            }
            invocation = this.showInvocationDialog(invocation, session,
                                                   documentPrefs, projectPrefs,
                                                   scriptData,
                                                   true /* alreadyValidated */);
            onSuccessCallback(invocation);
        }

        if (session) {
            onSessionReady.call(this, session);
        } else {
            ko.dbg.manager.newSession(false, /* not interactive */
                                      onSessionReady.bind(this),
                                      onErrorCallback);
        }
    },
    
    _showInvalidInterpreterAlert: function(invocation, session, error_text)
    {
        var result = ko.dialogs.customButtons(error_text.value,
                                          ['OK','&Help','&Preferences'],
                                          'OK', null, 'Debugger Error');
        if (result == 'Help') {
            if (invocation.name.toLowerCase().indexOf("python") >= 0)
            {
                ko.help.open("debugpython.html");
            }
            if (invocation.name.toLowerCase().indexOf("javascript") >= 0 ||
                invocation.name.toLowerCase().indexOf("nodejs") >= 0)
            {
                ko.help.open("debugchrome.html");
            }
            else
            {
                ko.help.open("debug"+invocation.name.toLowerCase()+".html");
            }
        } else if (result == 'Preferences') {
            prefs_doGlobalPrefs(invocation.name.toLowerCase() + "Item");
        }
        session.shutdown();
    },

    isValidInterpreter: function(invocation, session) {
        var error_text = new Object();
        if (!invocation.validInterpreter(session.invoke_type, new Object(), error_text)) {
            this._showInvalidInterpreterAlert(invocation, session, error_text);
            return false;
        }
        return true;
    },

    showInvocationDialog: function(invocation, session, documentPrefs,
                                   projectPrefs/*=null*/, scriptData/*=null*/,
                                   alreadyValidated/*false*/)
    {
        /**
         * When asked to skip the dialog, we skip it, unless the debugSkipDialog
         * preference is set, which for that case we reverse the skipDialog
         * behaviour.
         */
        var skipDialog = ko.dbg.controller.skipDialog;
        if (ko.prefs.getBoolean('debugSkipDialog', false) == true) {
            skipDialog = !skipDialog;
        }

        if (typeof(projectPrefs) == "undefined") projectPrefs = null;
        if (typeof(scriptData) == "undefined") scriptData = null;
        if (typeof(alreadyValidated) == "undefined") alreadyValidated = false;

        if (session.invoke_type == this.INVOKE_INTERACTIVE) {
            skipDialog = true;
        }

        if (!alreadyValidated
            && skipDialog
            && session.invoke_type != this.INVOKE_INTERACTIVE) {
            if (invocation && invocation.validate(session.invoke_type, {}, {})) {
                skipDialog = true;
                alreadyValidated = true;
            } else {
                skipDialog = false;
            }
        }

        if (!skipDialog) {
            var resp = new Object ();
            resp.documentPrefs = documentPrefs;
            resp.projectPrefs = projectPrefs;
            resp.invocation = invocation;
            resp.invoke_type = session.invoke_type;
            resp.scriptData = scriptData;
            resp.res = "";
            // Check to see if there's a debugger dialog being opened
            // Not quite sure why this happens only for this dialog, but without
            // this guard, hitting F10 and F11 simultaneously results in a crash.
            if (gOpeningDialog) {
                return null;
            }
            gOpeningDialog = true;
            window.openDialog
                     ("chrome://komodo/content/pref/invocations/debugging-properties.xul",
                      "Komodo:DebuggingProperties",
                      "chrome,close=yes,dependent=yes,modal=yes,resizable=yes",
                      resp);
            gOpeningDialog = false;
            if (resp.res != "ok" || resp.invocation==null) {
                //this.log.debug("User cancelled debugging args dialog");
                session.shutdown();
                return null;
            }
            invocation = resp.invocation;
            var isDocumentInvocation = resp.isDocumentInvocation;
            //XXX: Project prefs should be considered readonly for this
            // dialog, but check update anyway.
            //invocation.currentInstancePreferences.dump(0);
            // And save the invocation properties back.
            var prefs = isDocumentInvocation ? documentPrefs : projectPrefs;
            documentPrefs.setBooleanPref('lastInvocationIsDocument',
                                         isDocumentInvocation);
            if (!prefs.hasPrefHere("Invocations")) {
                var newPrefs = Components.classes["@activestate.com/koPreferenceSet;1"].createInstance();
                newPrefs.id = "Invocations";
                prefs.setPref( newPrefs.id, newPrefs);
            }
            var prefRoot = prefs.getPref("Invocations");
            prefRoot.parent = prefs;
            // XXX - this is really a workaround for bug 18218, and should probably die,
            // using invocation.instancePreferences
            var invocation_prefs = invocation.persistableInstancePreferences;
            invocation_prefs.parent = prefRoot;
            prefs.setStringPref('lastInvocation', invocation_prefs.id);
            if (isDocumentInvocation) {
                if (prefRoot.hasPref(invocation_prefs.id)) {
                    invocation_prefs = prefRoot.getPref(invocation_prefs.id);
                    invocation_prefs.update(invocation.persistableInstancePreferences);
                } else {
                    prefRoot.setPref(invocation_prefs.id, invocation_prefs);
                }
            }
            //invocation.currentInstancePreferences.dump(0);
        }
        if (!invocation) {
            this.log.error("Shouldn't have managed to get this far without an invocation or the dialog being cancelled");
            return null;
        }
        if (!alreadyValidated) {
            var error_text = new Object();
            if (!invocation.validate(session.invoke_type, new Object(), error_text)) {
                this._showInvalidInterpreterAlert(invocation, session, error_text);
                return null;
            }
        }
        return invocation;
    },

    doExecute: function(session, invoke_type, new_debugger_state)
    {
        this.log.debug('doExecute')
        //  _debugger_do_execute_invocation
        var invocation = session.invocation;
        var use_console = invocation.currentInstancePreferences.getBooleanPref("use-console");
        var emulate_cgi =
            invocation.currentInstancePreferences.hasPref("sim-cgi") ?
            invocation.currentInstancePreferences.getBooleanPref("sim-cgi") :
            false;

        // and fire off the process.
        var rc;
        try {
            invocation.invoke(invoke_type);
            if (!use_console) {
                this.log.debug('doExecute: hooking io streams');
                // Link the debugger io with that of the terminal.
                invocation.hookIOForTerminal(session.panel.debuggerPanel.terminalHandler);
            }
            rc = true;
        } catch (e) {
            rc = false;
            this.log.error("There was an unexpected error starting the invocation:" + e);
            let lastErrorSvc = Components.classes["@activestate.com/koLastErrorService;1"].
                        getService(Components.interfaces.koILastErrorService);
            let errmsg = lastErrorSvc.getLastErrorMessage();
            debugger_startError(errmsg);
        }
        return rc;
    },

    doStart: function ko_dbg_invocation_doStart(initial_step_type, invoke_type, aSession, onSuccessCallback, onErrorCallback)
    {
        var session = aSession;
        if (!onSuccessCallback) onSuccessCallback = function(){}
        if (!onErrorCallback) onErrorCallback = function() {}

        var onSessionReady = function(aSession) {
            session = aSession; // expose to onError
            // start the listener if it is not already started
            if (!ko.dbg.listener.isListening()) {
                try {
                    ko.dbg.listener.start();
                } catch(e) {
                    var lastErrorSvc = Components.classes["@activestate.com/koLastErrorService;1"].
                        getService(Components.interfaces.koILastErrorService);
                    var errmsg = lastErrorSvc.getLastErrorMessage();
                    debugger_startError(errmsg);
                    document.getElementById('menu_dbgListen').setAttribute('checked', 'false');
                    //log.exception(e);
                }
                if (!ko.dbg.listener.isListening()) {
                    onError(null);
                    return;
                }
                ko.dbg.listener.stopOnConnect = true;
            }

            session.invoke_type = invoke_type;
            var invocation = null;
            if (invoke_type == ko.dbg.invocation.INVOKE_INTERACTIVE) {
                this.getInteractiveInvocation(session,
                                              onInvocationReady.bind(this),
                                              onError.bind(this));
            } else {
                this.getInvocation(session,
                                   onInvocationReady.bind(this),
                                   (function(e) {
                                        this.log.debug('getInvocation returned null');
                                        onError(e);
                                   }).bind(this));
            }
        }

        var onInvocationReady = function(invocation) {
            session.invocation = invocation;
            session.initial_step_type = initial_step_type;
            // XXX - maybe we should abort here, telling the user
            var supports_debug = (invocation.supportedInvokeTypes & ko.dbg.invocation.INVOKE_DEBUG) != 0;
            var supports_interactive = (invocation.supportedInvokeTypes & ko.dbg.invocation.INVOKE_INTERACTIVE) != 0;
            var supports_run = (invocation.supportedInvokeTypes & ko.dbg.invocation.INVOKE_RUN) != 0;
            var supports_profiling = (invocation.supportedInvokeTypes & ko.dbg.invocation.INVOKE_PROFILE) != 0;
            if (invoke_type == ko.dbg.invocation.INVOKE_DEBUG && !supports_debug) {
                ko.dialogs.alert('We do not support debugging for this file. '+
                             'If you feel this is in error, you may change your file '+
                             'associations in your preferences.', null, 'Debugger Error');
                onError(null);
                return;
            } else
            if (invoke_type == ko.dbg.invocation.INVOKE_INTERACTIVE && !supports_interactive) {
                ko.dialogs.alert('We do not support an interactive shell for this language. ',
                             null, 'Interactive Shell Error');
                onError(null);
                return;
            } else
            if (invoke_type == ko.dbg.invocation.INVOKE_RUN && !supports_run) {
                ko.dialogs.alert('Komodo does not support execution for this language '+
                             'from the debugger subsystem.  You can use a run '+
                             'command in the toolbox to execute this file. ',
                             null, 'Run without Debug Error');
                onError(null);
                return;
            } else if (invoke_type == ko.dbg.invocation.INVOKE_PROFILE && !supports_profiling) {
                ko.dialogs.alert('Komodo does not support profiling for this language.',
                                 null, 'Profiling Error');
                onError(null);
                return;
            }
            session.setState(ko.dbg.manager.STATE_STARTING);

            var new_state = invoke_type == ko.dbg.invocation.INVOKE_DEBUG ? ko.dbg.manager.STATE_RUNNING : null;
            if (invoke_type == ko.dbg.invocation.INVOKE_RUN) {
                session.panel.resetTabName();
                session.setState(ko.dbg.manager.STATE_RUNNING);
            }
            // and fire off the process.
            if (invoke_type == ko.dbg.invocation.INVOKE_INTERACTIVE) {
                // only turn on syntax coloring for interactive shells
                session.panel.debuggerPanel.terminalView.language = session.language;
            }
            session.panel.loadStartMessage(invocation);
            session.panel.updateUI();
            var ok =  this.doExecute(session, invoke_type, new_state)

            if (!ok) {
                ko.dialogs.alert("There was an unexpected error starting the debugger.");
                onError(null);
                return;
            }
            this.log.debug('doStart returning session');
            onSuccessCallback(session);
        }

        var onError = function(exception) {
            if (session) {
                try {
                    session.shutdown();
                } catch (e) {}
            }
            onErrorCallback(exception);
        }

        this.log.debug('doStart')
        try {
            // debugger_check_start
            if (typeof(invoke_type) == 'undefined' || !invoke_type) {
                invoke_type = ko.dbg.invocation.INVOKE_DEBUG;
            }

            // _debugger_do_start_debugger
            if (invoke_type != ko.dbg.invocation.INVOKE_INTERACTIVE) {
                var curView = ko.views.manager.currentView;
                if (!ko.views.manager.offerToSave(null, /* urls */
                                  'Save Modified Files?', /* title */
                                  'Save Modified Files Before Debugging', /* prompt */
                                  "save_on_debug", /* pref */
                                  true, /* skip projects */
                                  false /* about to close */
                                  )) {
                    // user canceled
                    onErrorCallback(null);
                    return;
                }
                if (curView) {
                    curView.makeCurrent();
                }
            }

            if (session) {
                onSessionReady.call(this, session);
            } else {
                ko.dbg.manager.newSession(false, /*not interactive */
                                          onSessionReady.bind(this),
                                          onError);
            }

        } catch (e) {
            try {
                session.shutdown();
            } catch(e) {}
            this.log.exception(e);
            onErrorCallback(e);
            return;
        }
    },

    toggleInteractiveShell: function ko_dbg_invocation_toggleInteractiveShell()
    {
        try {
            var language = ko.prefs.getStringPref('interactiveShellDefaultLanguage');
            var tabMgr = ko.dbg.tabManager.getInteractiveShell(language);
            if (tabMgr) {
                var debuggerPanel = tabMgr.debuggerPanel;
                var visible = xtk.domutils.elementInFocus(debuggerPanel);
                if (visible) {
                    if (ko.views.manager.currentView) {
                        // Re-focus the editor
                        ko.views.manager.currentView.setFocus();
                    }
                } else {
                    debuggerPanel.terminalView.scintilla.focus();
                }
            } else {
                this.interactiveShell(language, function() {
                    // Focus the new interactive view, but it's only available
                    // from a timeout.
                    setTimeout(function() {
                        var tabMgr = ko.dbg.tabManager.getInteractiveShell(language);
                        var debuggerPanel = tabMgr.debuggerPanel;
                        debuggerPanel.terminalView.scintilla.focus();
                    }, 1);
                });
            }
        } catch (e) {
            this.log.exception(e);
        }
    },
    
    interactiveShell: function ko_dbg_invocation_interactiveShell(language, onSuccessCallback, onErrorCallback)
    {
        if (!onSuccessCallback) onSuccessCallback = function() {};
        if (!onErrorCallback) onErrorCallback = function() {};

        ko.dbg.manager.newSession(true, (function onSuccess(session) {
                if (!language)
                    language = ko.prefs.getStringPref('interactiveShellDefaultLanguage');
                session.language = language;
                this.doStart(Components.interfaces.koIDBGPSession.RESUME_GO,
                             ko.dbg.invocation.INVOKE_INTERACTIVE,
                             session,
                             onSuccessCallback,
                             onErrorCallback);
            }).bind(this),
            onErrorCallback);
    },

    runScript: function()
    {
        // debugger_run_script
        this.doStart(Components.interfaces.koIDBGPSession.RESUME_STEP_IN,
                     ko.dbg.invocation.INVOKE_RUN)
    },

    profileScript: function()
    {
        this.doStart(Components.interfaces.koIDBGPSession.RESUME_STEP_IN,
                     ko.dbg.invocation.INVOKE_PROFILE);
    },

    // Test code
    test: function()
    {
        // debugger_test_invocation
        var obj = new Object ();
        var response = window.openDialog
             ("chrome://komodo/content/test/test_standalone_invocation.xul",
              "Komodo:TestInvocation",
              "chrome,close=yes,dependent=yes,modal=yes",
              obj)

        var command = obj.command;
        var params = obj.params;

        if (!command)
           return;
        var invocation = Components.classes["@activestate.com/koInvocation;1?type=Perl"].createInstance();
        var catOb = new Object();
        var instOb = new Object();
        invocation.getDefaultPreferences(catOb, instOb);
        invocation.currentCategoryPreferences = catOb.value;
        invocation.currentInstancePreferences = instOb.value;
        var iprefs = invocation.currentInstancePreferences;
        iprefs.setStringPref("filename", command);
        iprefs.setStringPref("params",  params);
        iprefs.setBooleanPref("use-console", false);

        var error_pref = new Object();
        var error_text = new Object()
        if (!invocation.validate(ko.dbg.invocation.INVOKE_RUN, error_pref, error_text)) {
            ko.dialogs.alert("The invocation is not valid - " + error_text.value);
            return;
        }
        ko.dbg.manager.newSession(false, /* not interactive */
                                  (function onSuccess(session) {
                                    session.invocation = invocation;
                                    this.doExecute(session,
                                                   ko.dbg.invocation.INVOKE_RUN,
                                                   ko.dbg.manager.STATE_RUNNING);
                                  }).bind(this));
    }
};

// This code here because PHP doesn't do eval in property_get/value

var _property_get_exception_type = { 
                                     PHP:'exception',
                                     'Node.js':'exception'
};
var _property_get_exception_value = {PHP:'0',
                                     'Node.js':'0'
};

this.is_exception_property = function(prop, languageName) {
    return (prop
            && prop.type == _property_get_exception_type[languageName]
            && prop.value == _property_get_exception_value[languageName]);
}
}).apply(ko.dbg);

window.addEventListener("komodo-ui-started", ko.dbg.onload.bind(ko.dbg));
