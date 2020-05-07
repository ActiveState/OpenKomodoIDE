// ---- define ko.collaboration namespace

var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
    .getService(Components.interfaces.nsIStringBundleService)
    .createBundle("chrome://komob/locale/komob.properties");

ko.collaboration = {
    get log() {
        delete ko.collaboration.log;
        return ko.collaboration.log = ko.logging.getLogger("ko.collaboration");
    },
    
    // lazily import CollaborationSvc to Chrome land
    get service() {
        delete ko.collaboration.service;
        Components.utils.import("resource://komob/service.js");
        return ko.collaboration.service = CollaborationSvc;
    },
    
    init: function() {
        this._addObserver();
        let this_ = this;
        window.addEventListener("unload", function() this_._removeObserver(), false);
        
        this.onCollaborationEnabledChanged();
        ko.collaboration.ui.init();
    },
    
    _addObserver: function() {
        ko.collaboration.service.prefs.addObserver("enabled", this, false);
    },

    _removeObserver: function() {
        ko.collaboration.service.prefs.removeObserver("enabled", this);
    },

    observe: function(subject, topic, data) {
        if (topic != "nsPref:changed") {
            this.log.error("observed unknown topic");
            return;
        }
        
        switch (data) {
            case "enabled":
                this.onCollaborationEnabledChanged();
                break;
        }
    },
    
    onCollaborationEnabledChanged: function() {
        let enabled = ko.collaboration.service.enabled;
        if (enabled) {
            this._importMobwrite();
            this._importSocket();
        }
    },
    
    _importMobwrite: function() {
        // xtk.load is blocking.
        xtk.load("chrome://komob/content/diff_match_patch_uncompressed.js", window);
        xtk.load("chrome://komob/content/mobwrite_core.js", window);
        xtk.load("chrome://komob/content/shareObj.js", window);
    },
    
    _importSocket: function() {
        xtk.load("chrome://komob/content/socketio.js", window);
        xtk.load("chrome://komob/content/socket.js", window);
    }
}


// ---- external API

/**
 * Opens a collab document that already exists on the server either in optView
 * or in a new editor view if optView is null. Optionally sets the content of
 * the editor view to optInitialContent if given.
 */
ko.collaboration.openExistingDocument = function(documentId, optTitle, optLanguage, optView, optInitialContent) {
    var view, opensInNewView;
    if (optView) {
        view = optView;
        opensInNewView = false;
        if (view.getAttribute('type') != 'editor') {
           ko.collaboration.log.warn("Tried to share unsupported view type.");
           return null;
        }
    } else {
        view = ko.views.manager._doNewView(optLanguage, "editor");
        opensInNewView = true;
        // Set the tab title
        view.koDoc.baseName = optTitle;
        view.updateLeafName();
    }
    
    // Ask for UNIX line endings if necessary
    if (!ko.collaboration.utils.eOLDetect(view)) {
        return null;
    }

    if (typeof optInitialContent == 'string')
        view.scimoz.text = optInitialContent;
    mobwrite.share({
        view: view,
        id: documentId,
        opensExistingCollabDoc: opensInNewView // 
    });
    if (!view.hasOwnProperty('mobwriteShareObj')) {
        // Internal error, sharing failed.
        view.close(true);
        view = null;
    }
    return view;
};

/**
 * Creates a new collaboration document and calls `openExistingDocument` for
 * that document.
 */
ko.collaboration.openNewDocument = function(sessionId, optTitle, optLanguage,
                                            optView, optInitialContent,
                                            successCallback, errorCallback) {
    // If we create a document based on an existing view, use the existing
    // title and language.
    if (optView) {
        optTitle = optView.title || "untitled";
        optLanguage = optView.languageObj.name || "Text";
    }
    var successCallback_ = function(resp) {
        var documentId = resp.filename;
        var view = ko.collaboration.openExistingDocument(documentId,
            optTitle, optLanguage, optView, optInitialContent);
        if (!view && typeof errorCallback == 'function') {
            errorCallback();
        } else if (typeof successCallback == 'function') {
            successCallback(view);
        }
    };
    ko.collaboration.api.createTextAsync(sessionId, optTitle, optLanguage,
                                         successCallback_, errorCallback);
};

/**
 * Same as `openNewDocument`, but create a new session first and add the
 * document to that.
 */
ko.collaboration.createSessionAndOpenNewDocument = function(sessionTitle,
    documentTitle, language, optView, initialContent, successCallback, errorCallback) {
    ko.collaboration.api.createSessionAsync(sessionTitle, function(sessionData) {
            var successCallback_ = function() {
                ko.collaboration.sessions.addSession(sessionId, sessionData, true);
                successCallback();
            }
            let sessionId = sessionData["id"];
            ko.collaboration.openNewDocument(sessionId, documentTitle, language,
                                             optView, initialContent,
                                             successCallback_, errorCallback);
        }, errorCallback);
};

ko.collaboration.shareCurrentTabInNewSession = function() {
    var view = ko.views.manager.currentView;
    var successCallback = function() {
        ko.collaboration.sessions.refresh();
    };
    var errorCallback = function() {
        alert(_bundle.formatStringFromName('Sharing document X failed. Try again later.',
                                           [view.koDoc.displayPath], 1));
    };
    var createSessionSuccessCB = function(sessionData) {
        if (sessionData && ('id' in sessionData)) {
            ko.collaboration.sessions.addSession(sessionData.id, sessionData, true);
            ko.collaboration.openNewDocument(sessionData.id,
                                             null, // optTitle: use view.title
                                             null, // optLang: use view.language
                                             view,
                                             null, // optInitialContent: ??
                                             successCallback, errorCallback);
        } else {
            errorCallback();
        }
    }.bind(this);
    var prompt = _bundle.formatStringFromName("Enter a session name to share document X",
                                              [view.koDoc.displayPath], 1);
    var sessionName = ko.dialogs.prompt(prompt, null, null,
                                        _bundle.GetStringFromName('Collaboration'));
    if (sessionName) {
        let errorCallback = function() {
            alert(_bundle.GetStringFromName("Failed to create session X", [sessionName], 1));
        };
        // If sessionName exists just use it.
        let sessions = ko.collaboration.sessions.sessions;
        for (let [, sessionNode] in Iterator(sessions)) {
            if (sessionNode.name == sessionName) {
                createSessionSuccessCB(sessionNode);
                return;
            }
        }
        ko.collaboration.api.createSessionAsync(sessionName,
                                                createSessionSuccessCB,
                                                errorCallback);
    }
};

/**
 * Enables Komodo Collaboration. If a Komodo Services Account has not been set
 * up, this opens the Komodo Services Account Setup dialog.
 */
ko.collaboration.enableService = function() {
    ko.collaboration.service.enabled = true;
    if (!ko.services.sso.checkSetup())
        ko.services.sso.openSetup();
};

/**
 * Disables Komodo Collaboration.
 */
ko.collaboration.disableService = function() {
    ko.collaboration.service.enabled = false;
};


// xxx perhaps move this:

/**
 * UI Controller for the Collaboration tab. Content of the tab's UI elements
 * is controlled separately.
 */
ko.collaboration.ui = {
    init: function init() {
        this.obsSvc = Components.classes['@mozilla.org/observer-service;1']
            .getService(Components.interfaces.nsIObserverService);
        this._addObservers();
        var this_ = this;
        window.addEventListener('unload', function() this_._removeObservers(), false);
        this.updateTab();
    },
    
    _events: ['collaboration:connection-status-changed'],
    
    _addObservers: function() {
        for each (let event in this._events)
            this.obsSvc.addObserver(this, event, false);
        ko.collaboration.service.prefs.addObserver('enabled', this, false);
    },
    
    _removeObservers: function() {
        for each (let event in this._events)
            this.obsSvc.removeObserver(this, event);
        ko.collaboration.service.prefs.removeObserver('enabled', this);
    },
    
    observe: function(subject, topic, data) {
        switch(topic) {
            case "collaboration:connection-status-changed":
                this.updateTab();
                break;
            case "nsPref:changed":
                if (data == "enabled")
                    this.updateTab();
        }
    },
    
    updateTab: function() {
        if (ko.collaboration.service.enabled && ko.services.sso.checkSetup()) {
            if (ko.collaboration.service.connected)
                this._setTabOnline();
            else
                this._setTabOffline();
        } else {
            this._setTabDisabled();
        }
    },
    
    /**
     * Display the Collaboration Session & Friends UI.
     */
    _setTabOnline: function() {
        document.getElementById("collab-panel-container").selectedPanel =
            document.getElementById("collab-panel-content-online");
        ko.collaboration.sessions.refresh();
        ko.collaboration.friends.update();
    },
    
    /**
     * Tell the user that collaboration is currently offline (in case Socket,
     * Mobwrite or SSO get disconnected), and the Service will recover
     * automatically.
     */
    _setTabOffline: function() {
        document.getElementById("collab-panel-container").selectedPanel =
            document.getElementById("collab-panel-content-offline");
    },
    
    /**
     * Tell the user that collaboration is disabled, but they can enable it.
     */
    _setTabDisabled: function() {
        document.getElementById("collab-panel-container").selectedPanel =
            document.getElementById("collab-panel-content-disabled");
    },
    
    /**
     * `onpopupshowing` event handler for menupopup in Services menu.
     */
    menuPopupHandler: function() {
        let enable = parent.document.getElementById('komodo-collaboration-menuitem-enable');
        let disable = parent.document.getElementById('komodo-collaboration-menuitem-disable');
        
        if (ko.collaboration.service.enabled) {
            enable.hidden = true;
            disable.hidden = false;
        } else {
            enable.hidden = false;
            disable.hidden = true;
        }
    },
    
    /**
     * `onpopupshowing` event handler for menupopup in *editor tab* button
     * context menu.
     */
    tabContextPopupHandler: function() {
        var currentView = ko.views.manager.currentView;
        var menuItems = {
            "collab-tabContext-new-session": false,
            "collab-tabContext-existing-session": false,
            "collab-tabContext-disabled": true
        };
        if (currentView.hasOwnProperty('mobwriteShareObj')) {
            for (let [id, visible] in Iterator(menuItems)) {
                parent.document.getElementById(id).setAttribute("hidden", !visible);
            }
        } else {
            for (let [id, hidden] in Iterator(menuItems)) {
                parent.document.getElementById(id).setAttribute("hidden", hidden);
            }
            var menuExisting = parent.document.getElementById('collab-tabContext-existing-session');
            // Remove all menuitems
            while (menuExisting.itemCount > 0) {
                menuExisting.removeItemAt(0);
            }
            // Create an item for each session
            let sessionsIt = Iterator(ko.collaboration.sessions.sessions);
            for (let [sessionId, sessionNode] in sessionsIt) {
                let menuItem = menuExisting.appendItem(sessionNode.name);
                let clickHandler = (function(sessionId) { return function(evt) {
                    if (evt.currentTarget == evt.originalTarget) {
                        var successCallback = function() {
                            ko.collaboration.sessions.refresh();
                        }
                        var errorCallback = function() {
                            alert(_bundle.GetStringFromName('Sharing this tab failed. Try again later.'));
                        }
                        ko.collaboration.openNewDocument(sessionId, null, null,
                            currentView, null, successCallback, errorCallback);
                     }
                }})(sessionId);
                menuItem.addEventListener('click', clickHandler, false);
            }
        }
    }
};

window.addEventListener('load', function() { ko.collaboration.init(); }, false);
