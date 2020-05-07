// TODO This could be a global singleton (i.e. XPCOM JS module)

ko.collaboration.api = {
    get url() ko.collaboration.service.prefs.getCharPref("apiURL"),
// FIXME    log: ko.logging.getLogger("ko.collaboration.api"),
    
    createSessionAsync: function(sessionName, successCallback, errorCallback) {
        var postData = {};
        postData.session_name = sessionName;
        var req = this._makeRequest(this.url + "sessions", "POST",
                                    JSON.stringify(postData), true,
                                    successCallback, errorCallback);
    },
    
    deleteSessionAsync: function(sessionId, successCallback, errorCallback) {
        this._makeRequest(this.url + "sessions/" + sessionId, "DELETE", null,
                          true, successCallback, errorCallback);
    },
    
    /**
     * Leave a session by deleting your own access privilege. Only users that
     * are not OWNER can do this. Note that this triggers a session update
     * notification only to the remaining users of the session.
     */
    leaveSessionAsync: function(sessionId, successCallback, errorCallback) {
        this._makeRequest(this.url + "sessions/" + sessionId + "/privilege",
                          "DELETE", null, true, successCallback, errorCallback);
    },

    getSessionsAsync: function(successCallback, errorCallback) {
        var req = this._makeRequest(this.url + "sessions", "GET", null, true,
                                    successCallback, errorCallback);
    },
    
    /**
     * This creates a "text", the server representation of a shared tab, that
     * holds the unique id (aka 'filename'), authorization data, a
     * human-readable 'title', and the globally shared content of the tab.
     * After the server has created the text, the tab is passed to mobwrite to
     * initiate the session.
     */
    createTextAsync: function(sessionId, title, language, successCallback,
                              errorCallback) {
        var data = {};
        data.title = title;
        data.language = language;
        var this_ = this;
        
        var errorCallback_ = function createTextAsyncError() {
            if (typeof errorCallback == 'function') {
                errorCallback(req);
            }
        };
        var req = this._makeRequest(this.url + "sessions/" + sessionId +
                                    "/texts", "POST", JSON.stringify(data),
                                    true, successCallback, errorCallback_);
        return req;
    },
    
    /**
     * Requests document metadata for the given filename from the server.
     */
    getTextAsync: function(filename, successCallback, errorCallback) {
        var req = this._makeRequest(this.url + "texts/" + filename, "GET",
                                    null, true, successCallback, errorCallback);
        return req;
    },
    
    /**
     * Update the metadata of the text with the given id.
     */
    updateTextAsync: function(id, title, successCallback, errorCallback) {
        var data = {};
        if (title) {
            data.title = title;
        }
        var req = this._makeRequest(this.url + "texts/" + id, "PUT",
            JSON.stringify(data), title, successCallback, errorCallback);
        return req;
    },
    
    /**
     * Deletes the document with the given filename from the server.
     */
    deleteTextAsync: function(filename, successCallback, errorCallback) {
        var req = this._makeRequest(this.url + "texts/" + filename, "DELETE",
                                    null, true, successCallback, errorCallback);
        return req;
    },
    
    /**
     * Makes a request to the server, in order to give user access to the
     * document with the given filename.
     */
    grantAccessAsync: function(user, sessionId, successCallback,
                               errorCallback) {
        var privileges = {};
        privileges[user] = 2; // Write Access
        var data = {'privileges':privileges};
        var req = this.updateAccessAsync(data, sessionId, successCallback,
                                         errorCallback);
        return req;
    },
    
    /**
     * Takes a username or an Array of usernames and revokes their accessright
     * on the text with the given ID. If the action succeeds callback is
     * applied to the given scope. Note that the current user must have owner
     * rights on this document.
     */
    revokeAccessAsync: function(users, sessionId, successCallback,
                                errorCallback) {
        var privileges = {};
        if (typeof users === 'number') {
            privileges[users] = null;
        } else {
            for each (let user in users) {
                privileges[user] = null;
            }
        }
        var data = {'privileges':privileges};
        var req = this.updateAccessAsync(data, sessionId, successCallback, errorCallback);
    },
    
    updateAccessAsync: function(data, sessionId, successCallback,
                                errorCallback) {
        var req = this._makeRequest(this.url + 'sessions/' + sessionId, 'PUT',
                                   JSON.stringify(data), true, successCallback,
                                   errorCallback);
        return req;
    },
    
    /**
     * Update metadata for the session with the given sessionId.
     */
    updateSessionAsync: function(sessionId, name, successCallback, errorCallback) {
        var data = {};
        if (name)
            data.name = name;
        var req = this._makeRequest(this.url + 'sessions/' + sessionId, 'PUT',
                                    JSON.stringify(data), true, successCallback,
                                    errorCallback);
        return req;
    },
    
    getFriendsAsync: function(successCallback, errorCallback) {
        var req = this._makeRequest(this.url + 'user/friends', 'GET', null,
                                    true, successCallback, errorCallback);
        return req;
    },
    
    addFriendAsync: function(email, successCallback, errorCallback) {
        // This only creates a /user/requests resource for the other user.
        var req = this._makeRequest(this.url + 'user/friends/' +
                                    encodeURIComponent(email),
                                    'PUT', null, true, successCallback,
                                    errorCallback);
        return req;
    },

    
    deleteFriendAsync: function(username, successCallback, errorCallback) {
        var req = this._makeRequest(this.url + 'user/friends/' + username,
                                    'DELETE', true, successCallback,
                                    errorCallback);
        return req;
    },
    
    getFriendRequestsAsync: function(successCallback, errorCallback) {
        var req = this._makeRequest(this.url + 'user/requests', 'GET', null,
                                    true, successCallback, errorCallback);
        return req;
    },
    
    updateFriendRequestAsync: function(username, confirmed, successCallback, errorCallback) {
        var data = {"confirmed": !!confirmed};
        var req = this._makeRequest(this.url + 'user/requests/' + username, 'PUT',
                                    JSON.stringify(data), true,
                                    successCallback, errorCallback);
        return req;
    },
    
    getPendingRequestsAsync: function(successCallback, errorCallback) {
        var req = this._makeRequest(this.url + 'user/pending_requests', 'GET', null,
                                    true, successCallback, errorCallback);
        return req;
    },
    
    deletePendingRequestAsync: function(userId, successCallback, errorCallback) {
        var req = this._makeRequest(this.url + 'user/pending_requests/' + userId, 'DELETE', null,
                                    true, successCallback, errorCallback);
        return req;
    },
    
    _makeRequest: function(url, method, post, async, successCallback,
                                                            errorCallback) {
        var req = null;
        try {
            req = new XMLHttpRequest();
        } catch(e1) {
            req = null;
        }
        if (req) {
            var this_ = this;
            var successCallback_ = function requestSuccessCallback() {
                if (typeof successCallback == 'function') {
                    if (req.responseText) {
                        try {
                            var resp = JSON.parse(req.responseText);
                        } catch(e) {
                            // FIXME this_.log.error("Invalid response from server: " + obj);
                            dump("Invalid response from server: " + obj);
                            errorCallback_();
                            return;
                        }
                    }
                    // Empty responses are fine (e.g. on DELETE), invoke the
                    // callback even if there is no responseText
                    successCallback(resp, req);
                }
            };
            var errorCallback_ = function requestErrorCallback() {
                if (typeof errorCallback == 'function') {
                    errorCallback(req);
                }
            };
            var callback = function makeRequest_callback() {
                if (req.readyState == 4) {
                    if (req.status >= 200 && req.status <= 300) {
                        successCallback_();
                    } else if (req.status >= 400 && req.status < 404) {
                        // Authentication issue, tell SSO to renew the session
                        this_._renewSession();
                        errorCallback_();
                    } else {
                        errorCallback_();
                    }
                }
            };
            req.onreadystatechange = callback;
            req.open(method, url, async);
            let cred = this._getAuthorizationHeader();
            req.setRequestHeader('Authorization', cred);
            if (post) {
                req.setRequestHeader('Content-Type', 'application/json');
            }
            req.send(post);
        }
        return req;
    },
    
    /**
     * Returns a string that can be used for our custom auth scheme
     */
    _getAuthorizationHeader: function() {
        let cred = ko.collaboration.service.ssoKey;
        cred = "komodo-sso " + cred;
        return cred;
    },
    
    /**
     * Tells the SSO Service to verify and renew its session key.
     */
    _renewSession: function() {
        var obsSvc = Components.classes['@mozilla.org/observer-service;1']
                        .getService(Components.interfaces.nsIObserverService);
        obsSvc.notifyObservers(this, "services:sso:check-session", null);
    }
};