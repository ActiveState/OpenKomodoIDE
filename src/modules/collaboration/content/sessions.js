if (!ko) var ko = {};
if (!ko.collaboration) ko.collaboration = {};

xtk.include("treeview");

let SessionsTreeView = function() {
    this._rows = [];
}

SessionsTreeView.prototype = new xtk.dataTreeView();
SessionsTreeView.prototype.constructor = SessionsTreeView;

SessionsTreeView.prototype.getSelectedIndices = function() {
    // Note: seltype is currently "single". A lot of the code below in
    // ko.collaboration.sessions relies on that.
    var indices = [];
    var len = this.selection.getRangeCount()
    for (let i = 0; i < len; i++) {
        let start = {};
        let end = {};
        this.selection.getRangeAt(i, start, end);
        for (let j=start.value; j <= end.value; j++)
            indices.push(j);
    }
    return indices;
};

SessionsTreeView.prototype.getCellText = function(row, column) {
    var col_index = column.index;
    return this._rows[row].getCellText(col_index);
};

SessionsTreeView.prototype.isSeparator = function(row) {
    return this._rows[row].isSeparator();
};

SessionsTreeView.prototype.isContainer = function(row) {
    return this._rows[row].isContainer();
};

SessionsTreeView.prototype.isContainerOpen = function(row) {
    return this._rows[row].isContainerOpen();
};

SessionsTreeView.prototype.isContainerEmpty = function(row) {
    return this._rows[row].isContainerEmpty();
};

SessionsTreeView.prototype.getParentIndex = function(row) {
    var rowLevel = this.getLevel(row);
    if (rowLevel == 0)
        return -1;
    for (let i = row; i >= 0; i--)
        if (this.getLevel(i) < rowLevel)
            return i;
    return -1;
};

SessionsTreeView.prototype.getLevel = function(row) {
    return this._rows[row].getLevel();
};

SessionsTreeView.prototype.hasNextSibling = function(row, after) {
    var thisLevel = this.getLevel(row);
    var l = this._rows.length;
    for (var i = after + 1; i < l; i++) {
        var nextLevel = this.getLevel(i);
        if (nextLevel == thisLevel) return true;
        if (nextLevel < thisLevel) break;
    }
    return false;
};

SessionsTreeView.prototype.toggleOpenState = function(row) {
    var node = this._rows[row];
    if (!node.isContainer())
        return;
    var oldRows = node.flatRows();
    if (node.isContainerOpen()) {
        node.isOpen = false;
    }
    else {
        node.isOpen = true;
    }
    var newRows = node.flatRows();
    var firstSlice = this._rows.slice(0, row);
    var lastSlice = this._rows.slice(row + oldRows.length);
    this._rows = firstSlice.concat(newRows).concat(lastSlice);
    this.tree.rowCountChanged(row+1, newRows.length - oldRows.length);
};

SessionsTreeView.prototype.getImageSrc = function(row, column) {
    var node = this._rows[row];
    return node.getImageSrc(column);
}

SessionsTreeView.prototype.getCellProperties = function(row, column, properties) {
    var node = this._rows[row];
    return node.getCellProperties(column, properties);
}

SessionsTreeView.prototype.getIndex = function(node) {
    for (let index = 0; index < this._rows.length; index++) {
        if (this._rows[index] == node) return index;
    }
    return -1;
}

SessionsTreeView.prototype.getRootLevelNode = function(index) {
    while(this.getLevel(index) > 0) {
        index = this.getParentIndex(index);
    }
    return this._rows[index];
}

SessionsTreeView.prototype.deleteRow = function(row) {
    return this._rows[row].deleteNode();
}


let TreeNode = function(cells, level, isOpen, parentNode) {
    this.cells = cells;
    this.level = level;
    this.isOpen = isOpen;
    this.type = "node";
    this.parent = parentNode;
};

TreeNode.prototype.isSeparator = function() {
    return false;
}

TreeNode.prototype.getCellText = function(col_idx) {
    return String(this.cells[col_idx]);
};

TreeNode.prototype.getChildren = function() {
    return null;
}

TreeNode.prototype.isContainer = function() {
    return !!this.getChildren();
};

TreeNode.prototype.isContainerOpen = function() {
    return this.isOpen;
};

TreeNode.prototype.isContainerEmpty = function() {
    var children = this.getChildren();
    for (var key in children) {
        if (children.hasOwnProperty(key)) return false;
    }
    return true;
};

TreeNode.prototype.getLevel = function() {
    return this.level;
};

TreeNode.prototype.getImageSrc = function(row, column) {};

TreeNode.prototype.getCellProperties = function(column, properties) {};

TreeNode.prototype.flatRows = function() {
    var rows = [];
    rows.push(this);
    if (this.isContainer() && this.isContainerOpen() && !this.isContainerEmpty()) {
        for (let [foo, childNode] in Iterator(this.getChildren())) {
            rows = rows.concat(childNode.flatRows());
        }
    }
    return rows;
}

TreeNode.prototype.updateNodeData = function(data) {
    throw "Child class must implement updateNodeData";
}

TreeNode.prototype.invalidate = function() {
    let myIndex = this.treeView.getIndex(this);
    this.tree.invalidateRow(myIndex);
}

TreeNode.prototype.hasOwnerPrivileges = function() {
    // Returns true if the current user has Owner privileges on this resource
    return false;
}

TreeNode.prototype.canBeRenamed = function() {
    // Returns true if 'Rename' in context menu should be enabled.
    return false;
}

TreeNode.prototype.canBeDeleted = function() {
    // Returns true if 'Delete' in context menu should be enabled.
    return false;
}

TreeNode.prototype.deleteNode = function() {
    return false;
}


let SeparatorNode = function(level, parentNode) {
    TreeNode.call(this, [""], level, false, parentNode);
}

SeparatorNode.prototype = Object.create(TreeNode.prototype);

SeparatorNode.prototype.isSeparator = function() {
    return true;
}

// Privilege levels on sessions. Currently only 2 and 3 are in use.
let SESSION_PRIVILEGES = {
    0: 'NONE',
    1: 'READ',
    2: 'WRITE',
    3: 'OWNER'
};

let SessionNode = function(id, name) {
    TreeNode.call(this, [], 0, false, null);
    this.type = "session";
    this.id = id;
    this.name = name;
    this.separatorNode = new SeparatorNode(1, this);
    this.documentNodes = {};
    this.collaboratorNodes = {};
    this.userPrivilege = 'READ';
    this.collaborators = {};
};

SessionNode.prototype = Object.create(TreeNode.prototype);

SessionNode.prototype.getCellText = function(col_idx) {
    if (col_idx != 0) return null;
    return this.name;
};

SessionNode.prototype.getChildren = function() {
    var children = [];
    children.push.apply(children,
                        [node for each (node in this.documentNodes)]
                            .sort(function(a, b) a.name.localeCompare(b.name)));
    return children;
}

SessionNode.prototype.getCellProperties = function(column, properties) {
    // Mozilla 22+ does not have a properties argument.
    if (typeof(props) == "undefined") {
        return "sessionNode";
    }
    var aserv=Components.classes["@mozilla.org/atom-service;1"].
              getService(Components.interfaces.nsIAtomService);
    properties.AppendElement(aserv.getAtom("sessionNode"));
    return undefined; // shut js up
};

/**
 * Takes session data returned by the API and updates its children with it.
 * Returns true if something's changed and the tree needs to be updated and
 * false otherwise.
 */
SessionNode.prototype.updateNodeData = function(sessionData) {
    var changed = false;
    if (typeof sessionData == 'object') {
        if (sessionData.hasOwnProperty('name')) {
            if (this.name !== sessionData.name) {
                this.name = sessionData.name;
                changed = true;
            }
        }
        if (sessionData.hasOwnProperty('texts')) {
            changed |= this.updateDocuments(sessionData.texts);
        }
        if (sessionData.hasOwnProperty('privileges')) {
            changed |= this.updateCollaborators(sessionData.privileges);
        }
    }
    return changed;
};

SessionNode.prototype.updateDocuments = function(documents) {
    var changed = false;
    // Remove deleted nodes
    for each (let [id, node] in Iterator(this.documentNodes)) {
        if (!(id in documents)) {
            delete this.documentNodes[id];
            changed = true;
        }
    }
    // update existing and add new nodes
    for each (let [id, title] in Iterator(documents)) {
        if (id in this.documentNodes) {
            changed |= this.documentNodes[id].updateNodeData(title)
        } else {
            this.documentNodes[id] = new DocumentNode(id, title, this);
            changed = true;
        }
    }
    return changed;
};

SessionNode.prototype.updateCollaborators = function(collaborators) {
    var changed = false;
    var myUserId = ko.collaboration.service.ssoUserId || '';
    this.collaborators = collaborators;
    // Remove deleted nodes
    for each (let [userId, node] in Iterator(this.collaboratorNodes)) {
        if (!(userId in collaborators)) {
            delete this.collaboratorNodes[userId];
            changed = true;
        }
    }
    // update existing and add new nodes
    for each (let [userId, userData] in Iterator(collaborators)) {
        // If this is the local user, update userPrivilege of the SessionNode
        if (userId == myUserId) {
            var myPrivilege = userData[1];
            myPrivilege = SESSION_PRIVILEGES[myPrivilege];
            if (myPrivilege)
                this.userPrivilege = myPrivilege;
        }
        // Update the collaborator Node
        if (userId in this.collaboratorNodes) {
            // A single collaborator node shouldn't change.
        } else {
            let userName = userData[0];
            let privilege = userData[1];
            this.collaboratorNodes[userId] = new CollaboratorNode(userId, userName, privilege, this);
            changed = true;
        }
    }
    return changed;
};

SessionNode.prototype.hasOwnerPrivileges = function() {
    return this.userPrivilege == 'OWNER';
};

SessionNode.prototype.canBeRenamed = function() {
    return this.hasOwnerPrivileges();
};

SessionNode.prototype.canBeDeleted = function() {
    return this.hasOwnerPrivileges();
};

SessionNode.prototype.deleteNode = function() {
    ko.collaboration.api.deleteSessionAsync(this.id, function() {
        ko.collaboration.sessions.refresh();
    }, null);
    return true;
};

SessionNode.prototype.leaveSession = function () {
    if (this.hasOwnerPrivileges()) {
        ko.dialogs.alert("Cannot leave a session with owner privileges!");
        return false;
    }
    ko.collaboration.api.leaveSessionAsync(this.id, function () {
        ko.collaboration.sessions.refresh();
    }, null);
    return true;
}


let DocumentNode = function(id, name, session) {
    TreeNode.call(this, null, 2, false, false);
    this.type = "document";
    this.id = id;
    this.name = name;
    this.parent = session;
};

DocumentNode.prototype = Object.create(TreeNode.prototype);

DocumentNode.prototype.getCellText = function(colIdx) {
    if (colIdx != 0)
        return undefined;
    return this.name;
}

DocumentNode.prototype.getImageSrc = function(row, column) {
    var filename = this.name;
    // At least on OS X filenames without an extension don't get an icon.
    // Suffix those with a fake file extension.
    var extRe = /^.*\..+$/;
    if (!extRe.test(filename)) {
        filename += ".txt";
    }
    return "koicon://" + filename + "?size=14";
}

DocumentNode.prototype.getCellProperties = function(column, properties) {
    // Mozilla 22+ does not have a properties argument.
    if (typeof(props) == "undefined") {
        return "documentNode";
    }
    var aserv=Components.classes["@mozilla.org/atom-service;1"].
              getService(Components.interfaces.nsIAtomService);
    properties.AppendElement(aserv.getAtom("documentNode"));
    return undefined; // shut js up
};

DocumentNode.prototype.hasOwnerPrivileges = function() {
    // Returns true if the current user has Owner privileges on this resource
    return this.parent.hasOwnerPrivileges();
}

DocumentNode.prototype.canBeRenamed = function() {
    return true;
};

DocumentNode.prototype.canBeDeleted = function() {
    return true;
};

DocumentNode.prototype.deleteNode = function() {
    ko.collaboration.api.deleteTextAsync(this.id, function() {
        ko.collaboration.sessions.refresh();
    }, null);
    return true;
};

DocumentNode.prototype.updateNodeData = function(name) {
    if (this.name != name) {
        this.name = name;
        return true;
    }
    return false;
}


let CollaboratorNode = function(id, name, privilege, session) {
    let cellText = name;
    if (privilege == 3) cellText += " (Owner)";
    TreeNode.call(this, [cellText], 2, false, session);
    this.type = "collaborator";
    this.id = id;
    this.name = name;
    this.privilege = privilege;
};

CollaboratorNode.prototype = Object.create(TreeNode.prototype);

CollaboratorNode.prototype.getCellProperties = function(column, properties) {
    // Mozilla 22+ does not have a properties argument.
    if (typeof(properties) == "undefined") {
        return "collaboratorNode";
    }
    var aserv=Components.classes["@mozilla.org/atom-service;1"].
              getService(Components.interfaces.nsIAtomService);
    properties.AppendElement(aserv.getAtom("collaboratorNode"));
    return undefined; // shut js up
};

CollaboratorNode.prototype.hasOwnerPrivileges = function() {
    return this.parent.hasOwnerPrivileges();
};

CollaboratorNode.prototype.canBeRenamed = function() {
    return false;
};

CollaboratorNode.prototype.canBeDeleted = function() {
    return this.hasOwnerPrivileges();
};

CollaboratorNode.prototype.deleteNode = function() {
    let sessionNode = this.parent;
    if (sessionNode instanceof SessionNode) {
        ko.collaboration.api.revokeAccessAsync(this.id, sessionNode.id, function() {
            ko.collaboration.sessions.refresh();
        }, null);
        return true;
    }
    return false;
};


/**
 * Collaboration Session Tree
 */
ko.collaboration.sessions = {
    
    activeSession: null,
    
    init: function() {
        this.tree = document.getElementById('collab-sessions-tree');
        this.treeView = new SessionsTreeView();
        this.tree.treeBoxObject.view = this.treeView;
        this.sessions = {};
    },

    /**
     * Takes a hash of session ids and session data, usually the returned data
     * of a server request, compares it to the stored session data, and
     * updates the tree accordingly.
     */
    _updateSessions: function(newSessions) {
        var sessionPopup = document.getElementById('sessionSelect');
        sessionPopup.innerHTML = "";
        
        //var sessionList = document.getElementById('collab-sessions-listbox');
        //sessionList.innerHTML = "";
        
        var prefs = require("ko/prefs");
        
        for each (let [sessionId, sessionData] in Iterator(newSessions)) {
            if (sessionId in this.sessions) {
                // existing session node, update
                this._updateSession(sessionId, sessionData);
            } if (!this.activeSession || !(this.activeSession in newSessions) ||
                  sessionId == prefs.getString("collab_preferred_session", "")) {
                // New session, that has not been created by this user, but
                // this user has been added _to_ that session by someone else
                this.addSession(sessionId, sessionData, false);
            }
            if (!(sessionId in this.sessions)) {
                this.sessions[sessionId] = sessionData; // ensure it is there
            }
            
            let item = document.createElement('menuitem');
            item.setAttribute('id', "menu-" + sessionId);
            item.setAttribute('label', sessionData['name']);
            item.addEventListener("command", function(_sessionId, _sessionData) {
                prefs.setString("collab_preferred_session", _sessionId);
                this.addSession(_sessionId, _sessionData, false)
            }.bind(this, sessionId, sessionData));
            sessionPopup.appendChild(item);
            
            //item = document.createElement('richlistitem');
            //item.setAttribute('id', "list-" + sessionId);
            //item.textContent = sessionData['name'];
            //item.addEventListener("command", function(_sessionId, _sessionData) {
            //    this.addSession(_sessionId, _sessionData, false)
            //}.bind(this, sessionId, sessionData));
            //sessionList.appendChild(item);
            //
            //if (sessionId == this.activeSession)
            //    sessionList.selectedItem = item;
        }

        for each (let [sessionId, sessionNode] in Iterator(this.sessions)) {
            if (!(sessionId in newSessions)) {
                this.removeSession(sessionId);
            }
        }
        
        document.getElementById('sessionRootButton')
                    .setAttribute("label", this.sessions[this.activeSession].name);
    },

    _updateSession: function(sessionId, sessionData) {
        if (sessionId in this.sessions) {
            var sessionNode = this.sessions[sessionId];
            var oldRows = sessionNode.getChildren();
            var nodeChanged = sessionNode.updateNodeData(sessionData);
            if (nodeChanged) {
                var newRows = sessionNode.getChildren();
                var rowIndex = 0;

                var firstSlice = this.treeView._rows.slice(0, rowIndex);
                var lastSlice = this.treeView._rows.slice(rowIndex + oldRows.length);
                this.treeView._rows = firstSlice.concat(newRows).concat(lastSlice);
                // FIXME This is not really how you should use rowCountChanged,
                // so beware of strange side-effects w/ multiple selections
                this.treeView.tree.rowCountChanged(rowIndex + 1,
                                            newRows.length - oldRows.length);
                this.treeView.tree.invalidateRange(rowIndex,
                                                   rowIndex + newRows.length)
            }
        }
    },

    addSession: function(sessionId, sessionData, nodeOpen) {
        if (this.activeSession)
            this.removeSession(this.activeSession);
            
        this.activeSession = sessionId;
        
        document.getElementById('sessionRootButton')
                    .setAttribute("label", sessionData["name"]);
        
        var sessionNode = new SessionNode(sessionId, sessionData["name"]);
        sessionNode.isOpen = !!nodeOpen;
        sessionNode.updateNodeData(sessionData);
        var nodeRows = sessionNode.getChildren();
        var index = this.treeView._rows.length;
        this.treeView._rows = this.treeView._rows.concat(nodeRows);
        this.treeView.tree.rowCountChanged(index, nodeRows.length);
        this.sessions[sessionId] = sessionNode;
        
        var elems = {
            addUser: document.getElementById('collab-sessions-context-add-user-menu'),
            removeUser: document.getElementById('collab-sessions-context-remove-user-menu'),
            rename: document.getElementById('collab-sessions-context-rename'),
            leave: document.getElementById('collab-sessions-context-leave-session'),
            remove: document.getElementById('collab-sessions-context-delete-session')
        }
        for (let name in elems)
        {
            if (elems.hasOwnProperty(name))
                elems[name].removeAttribute("collapsed");
        }
        
        if (sessionNode.hasOwnerPrivileges()) 
            elems.leave.setAttribute("collapsed", "true");
        else {
            elems.addUser.setAttribute("collapsed", "true");
            elems.removeUser.setAttribute("collapsed", "true");
            elems.rename.setAttribute("collapsed", "true");
            elems.remove.setAttribute("collapsed", "true");
        }
        
    },

    removeSession: function(sessionId) {
        if (sessionId in this.sessions) {
            let sessionNode = this.sessions[sessionId];
            let rows = sessionNode.getChildren();
            this.treeView._rows.splice(0, rows.length);
            this.treeView.tree.rowCountChanged(0, -rows.length);
            delete this.sessions[sessionId];
        }
    },

    refresh: function() {
        let successCallback =
            ko.collaboration.utils.bind(this._updateSessions, this);
        let errorCallback = function() {};
        ko.collaboration.api.getSessionsAsync(successCallback, errorCallback)
    },

    createSession: function() {
        var sessionName = ko.dialogs.prompt("Enter a session name", null, null,
                                            'Collaboration');
        if (sessionName) {
            let this_ = this;
            let errorCallback = function() {
                // FIXME
                alert("Failed to create session");
            }
            ko.collaboration.api.createSessionAsync(sessionName, function(sessionData) {
                if (sessionData && sessionData.hasOwnProperty("id")) {
                    this_.addSession(sessionData["id"], sessionData, true);
                } else {
                    errorCallback();
                }
            }, errorCallback);
        }
    },

    openSelectedDocument: function() {
        // FIXME disable on multi-select
        var index = this.treeView.getSelectedIndices()[0];
        if (typeof index === 'number') {
            let node = this.treeView._rows[index];
            if (node instanceof DocumentNode) {
                let filename = node.id;
                if (filename in mobwrite.shared) {
                    try {
                        mobwrite.shared[filename].view.makeCurrent();
                    } catch(e) {
                        ko.collaboration.log.error("Switching to "
                                                   + filename
                                                   + " failed: "
                                                   + e.message);
                    }
                } else {
                    ko.collaboration.api.getTextAsync(filename, function(text) {
                        ko.collaboration.openExistingDocument(filename,
                            text.title, text.language, null);
                    }, function() {});
                }
            }
        }
    },

    addUserToSelectedSession: function(userId) {
        let successCallback =  this.refresh.bind(this);
        let errorCallback = function (resp) {
            ko.dialogs.alert("Failed to add user. Please try again.", null,
                             "Komodo Collaboration");
            ko.collaboration.log.error("Failed to grant session access. " +
                "HTTP status " + resp.status +
                " body: " + resp.responseText);
        }.bind(this);
        if (userId) {
            ko.collaboration.api.grantAccessAsync(userId, this.activeSession,
                successCallback, errorCallback);
        }
    },
    
    removeUserFromSelectedSession: function(userId) {
        let successCallback =  this.refresh.bind(this);
        let errorCallback = function (resp) {
            ko.dialogs.alert("Failed to remove user. Please try again.", null,
                             "Komodo Collaboration");
            ko.collaboration.log.error("Failed to revoke session access. " +
                "HTTP status " + resp.status +
                " body: " + resp.responseText);
        }.bind(this);
        if (userId) {
            ko.collaboration.api.revokeAccessAsync(userId, this.activeSession,
                successCallback, errorCallback);
        }
    },

    addNewTabToSelectedSession: function() {
        let title = ko.dialogs.prompt("Enter a name for this document", null, null, 'Collaboration');
        if (title) {
            let this_ = this;
            ko.collaboration.openNewDocument(this.activeSession, title, null,
                null, function() { this_.refresh(); } , function() {});
        }
    },

    addExistingFileToSession: function() {
        let this_ = this;
        let successCallback = function() {
            this_.refresh();
        };
        let errorCallback = function() {
            // TODO implement
        };
        let viewOpenedListener = function() {
            var view = ko.views.manager.currentView;
            ko.collaboration.openNewDocument(this_.activeSession, null, null,
                view, successCallback, errorCallback);
        };
        ko.collaboration.utils.filePickerWithCallback(viewOpenedListener);
    },

    deleteSelectedItems: function() {
        var selection = this.treeView.getSelectedIndices();
        for each (let row in selection) {
            // FIXME Should be able to pass in callback, that calls removeRow
            // (cp. removeSession) on success
            this.treeView.deleteRow(row);
        }
    },

    renameSelectedItem: function(useSession) {
        var selection = this.treeView.getSelectedIndices();
        // single selection only
        var selectedNode = this.treeView._rows[selection[0]];
        if (useSession && this.activeSession) {
            var title = ko.dialogs.prompt("Enter a new title for this session",
                null, this.sessions[this.activeSession].name, 'Collaboration');
            if (title)
                ko.collaboration.api.updateSessionAsync(this.activeSession, title,
                    successCallback, errorCallback);
        } else if (selectedNode instanceof DocumentNode) {
            var title = ko.dialogs.prompt("Enter a new title for this document",
                null, selectedNode.name, 'Collaboration');
            if (title) {
                ko.collaboration.api.updateTextAsync(selectedNode.id, title,
                    successCallback, errorCallback);
            }
        }
        function successCallback() {
            // Do nothing. Push notification should update the tree.
        }
        function errorCallback() {
            alert("Renaming failed");
        }
    },
    
    leaveSelectedSession: function () {
        if (!this.activeSession) {
            ko.collaboration.log.error("Cannot leave session: No session node selected");
            return;
        }
        
        this.sessions[this.activeSession].leaveSession();
    },
    
    deleteSelectedSession: function () {
        if (!this.activeSession) {
            ko.collaboration.log.error("Cannot leave session: No session node selected");
            return;
        }
        
        var name = this.sessions[this.activeSession].name;
        var yes = require("ko/dialogs").confirm("Are you sure you wish to leave the session '"+name+"'? This action cannot be undone.");
        if (!yes) return;
        
        this.sessions[this.activeSession].deleteNode();
    },

    contextPopupHandler: function(evt) {
        // No guarantee that handling the click event is already finished and
        // selection has been corrected.
        if (evt.target == evt.currentTarget) {
            this.handleTreeClick(evt);
        }
        var selection = this.treeView.getSelectedIndices();
        // Note that we don't allow multiple selections. Empty selections are
        // possible though.
        var singleSelection = selection.length == 1;
        if (singleSelection) {
            var selectedNode = this.treeView._rows[selection[0]];
        }

        let elements = {
            "collab-sessions-context-open-document": {
                "hidden": !(singleSelection && selectedNode instanceof
                    DocumentNode)
            },
            "collab-sessions-context-add": {
                "disabled": !singleSelection    
            },
            "collab-sessions-context-create-session": {},
            "collab-sessions-context-rename": {
                "disabled": !singleSelection || !selectedNode.canBeRenamed()
            },
            "collab-sessions-context-delete": {
                "disabled" : !singleSelection || !selectedNode.canBeDeleted(),
                // Hide iff "collab-sessions-context-leave-session" is shown
                "hidden": singleSelection &&
                          selectedNode instanceof SessionNode &&
                          !selectedNode.canBeDeleted()
            },
            "collab-sessions-context-leave-session": {
                // Show iff the node is a session and cannot be deleted (i.e.
                // user is *not* OWNER).
                "hidden": !singleSelection ||
                          !(selectedNode instanceof SessionNode) ||
                          selectedNode.canBeDeleted()
            }
        };
        for (let [id, att] in Iterator(elements)) {
            let element = document.getElementById(id);
            if (element) {
                for (let [k, v] in Iterator(att)) {
                    element.setAttribute(k, v);
                }
            }
        }
        return true;
    },
    
    addPopupHandler: function() {
        // Popup handler for the "Add..." popup in the context menu
        // Regular users can add documents, but adding users requires owner privileges.
        let element = document.getElementById("collab-sessions-context-add-user-menu");
        var selection = this.treeView.getSelectedIndices();
        var selectedNode = this.treeView._rows[selection[0]];
        let disabled = !selectedNode.hasOwnerPrivileges();
        element.setAttribute("disabled", disabled);
        return true;
    },

    userPopupHandler: function(remove) {
        if (remove) {
            var menu = document.getElementById('collab-sessions-context-remove-user-menu');
            var popup = document.getElementById('collab-sessions-context-remove-user-popup');
        } else {
            var menu = document.getElementById('collab-sessions-context-add-user-menu');
            var popup = document.getElementById('collab-sessions-context-add-user-popup');
        }
        menu.innerHTML = "";
        if (!ko.collaboration.friends.allFriends ) {
            // List of friends unavailable
            let item = menu.appendItem("List of friends unavailable.");
            item.setAttribute('disabled', true);
        } else {
            // Display friends
            let noFriends = true;
            for each (let [userId, userName] in ko.collaboration.friends.getAllFriendsSorted()) {
                var collaborators = this.sessions[this.activeSession].collaborators;
                
                if (remove && ! (userId in collaborators)) continue;
                if ( ! remove && (userId in collaborators)) continue;
                
                let item = menu.appendItem(userName, userId);
                let addUser = function(userId) {
                    ko.collaboration.sessions.addUserToSelectedSession(userId);
                };
                let removeUser = function(userId) {
                    ko.collaboration.sessions.removeUserFromSelectedSession(userId);
                };
                let action = remove ? removeUser : addUser;
                if (remove)
                    item.addEventListener('click', action.bind(this, userId), false);
                else
                    item.addEventListener('click', action.bind(this, userId), false);
                noFriends = false;
            }
            if (noFriends) {
                // Empty friends list
                let item = menu.appendItem("You need to add contacts to your friends list first.");
                item.setAttribute('disabled', true);
            }
        }
    },

    handleTreeClick: function(evt) {
        var row = this.tree.treeBoxObject.getRowAt(evt.pageX, evt.pageY);
        if (row >= 0)
            this.treeView.selection.select(row);
        else
            this.treeView.selection.clearSelection();
    },

    handleTreeDblClick: function(evt) {
        if (!evt || evt.which != 1) {
            // Disallow left-right double clicks on OS X (evt.which==3)
            return;
        }
        var rowIdx = this.tree.treeBoxObject.getRowAt(evt.pageX, evt.pageY);
        var row =  this.treeView._rows[rowIdx];
        if (row instanceof DocumentNode) {
            // This row should be selected, but just to be sure...
            this.treeView.selection.select(rowIdx);
            this.openSelectedDocument();
        }
    }
}

window.addEventListener("load", function() { ko.collaboration.sessions.init() }, false);
