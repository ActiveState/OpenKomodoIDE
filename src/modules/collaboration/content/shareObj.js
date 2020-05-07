// Implementation of mobwrite's shareObj for Komodo Editor tabs.

var PREF_ALWAYS_SHOW_USER_FLAGS = "collaboration_always_show_user_flags";

ko.collaboration.shareObj = function(view, id, opensExistingCollabDoc) {
    mobwrite.shareObj.call(this, id);
    this.log = ko.logging.getLogger("ko.collaboration.shareObj");
    //this.log.setLevel(ko.logging.LOG_WARN);
    
    // Refuse to sync if local text exceeds this length.
    this.MAX_LOCAL_TEXT_LENGTH = 1000000;
    
    this.users = {}; // Maps ids of connected users to user metadata
    this.view = view;
    // If this instance was created to open an existing document, we fetch its
    // content once mobwrite has run.
    this.initialSync = !opensExistingCollabDoc;
    
    this._convertViewDocForCollab();
    
    // If the editor contains the original document, set the revert buffer.
    // Otherwise the revert buffer will be set once we have received and applied
    // the initial patch from the server.
    if (this.initialSync) {
        this.setDocumentRevertBuffer();
        view.koDoc.enableIsDirty();
        if ('changeTracker' in view && view.changeTracker.enabled) {
            view.changeTracker.collabStoreState();
        }
    }
    
    // This property indicates that a editor view is currently shared. Be sure
    // to release this reference when it's not shared anymore!
    this.view.mobwriteShareObj = this;
    
    this.lastSelection = null;
    
    this.addViewClosedHandler();
    
    this.cursorController = new CursorController(this);
    
    this.addCurrentViewChangedHandler();
    
    this.addSaveHandler();
    
    this._addObserver();
    
    // This indicates if a server change is currently being applied, so we know
    // if a scintilla notification is coming from a user action or us.
    this._isApplyingServerChange = false;
    this.addViewModifiedHandler();
    this.addSelectionModifiedHandler();
    
    this._setTabHeaderIconOk();
}

ko.collaboration.shareObj.prototype = {
    __proto__: mobwrite.shareObj.prototype,
    _remoteChangeIndicator:
        Components.interfaces.koILintResult.INDICATOR_COLLAB_REMOTE_CHANGE,
    _localChangeIndicator:
        Components.interfaces.koILintResult.INDICATOR_COLLAB_LOCAL_CHANGE,
        
    _convertViewDocForCollab: function() {
        var collabDoc = Components.classes["@activestate.com/koCollabDocument;1"]
            .createInstance(Components.interfaces.koICollabDocument);
        collabDoc.initFromBaseDocument(this.view.koDoc);
        this.view.koDoc = collabDoc;
    },
    
    setDocumentRevertBuffer: function() {
        // Sets the buffer that will be restored when a user reverts the file
        this.view.koDoc.setRevertBuffer(this.getClientText());
    },
    
    syncText: function() {
        if (!this.checkLocalTextLength()) {
            var msg = "This document is too large to be shared in Collaboration.";
            alert(msg);
            this.unshare();
            return null;
        }
        var data = mobwrite.shareObj.prototype.syncText.apply(this, arguments);
        // Fill in the 'm:' metadata line right after the 'f:' line.
        var fileRe = /^F:.*$/m;
        var reResult = fileRe.exec(data);
        if (reResult && typeof reResult.index === 'number') {
            data =
                data.substring(0, reResult.index + reResult[0].length + 1) +
                'm:' + JSON.stringify(this.getMetadata()) + '\n' +
                data.substring(reResult.index + reResult[0].length + 1);
        }
        return data;
    },
    
    checkLocalTextLength: function() {
        return this.getClientText().length <= this.MAX_LOCAL_TEXT_LENGTH;
    },
    
    getMetadata: function() {
        var metadata = {};
        var newSelection = this._getCurrentSelection();
        if (!this.lastSelection ||
            this.lastSelection.start != newSelection.start ||
            this.lastSelection.end != newSelection.end) {
            this.lastSelection = newSelection;
            metadata.cursor = this.lastSelection;
            metadata.displayName = ko.collaboration.service.displayName;
        }
        return metadata;
    },
    
    // Taken from http://code.google.com/p/google-mobwrite/source/browse/trunk/html/mobwrite_form.js
    patchClientText: function(patches) {
        var oldClientText = this.getClientText();
        let [mods, text, results] = this._patch_apply(patches, oldClientText);
        try {
            this._isApplyingServerChange = true;
            this.modifyClientText(mods);
            this.view.scimoz.emptyUndoBuffer();
        } finally {
            this._isApplyingServerChange = false;
        }
    },
    
    /**
     * Merge a set of patches onto the text.
     * @param {Array.<patch_obj>} patches Array of patch objects.
     * @param {string} text Old text.
     * @return {Array.<Array.<object>|string|Array.<boolean>>} Three element
     *      Array, containing a set of operations for modifyClientText, the
     *      new text and an array of boolean values.
     */
    _patch_apply: function(patches, text) {
      if (patches.length == 0) {
        return [text, []];
      }
    
      // Deep copy the patches so that no changes are made to originals.
      patches = this.dmp.patch_deepCopy(patches);
      
      var ops = []; // xxx
    
      var nullPadding = this.dmp.patch_addPadding(patches);
      text = nullPadding + text + nullPadding;
    
      this.dmp.patch_splitMax(patches);
      // delta keeps track of the offset between the expected and actual location
      // of the previous patch.  If there are patches expected at positions 10 and
      // 20, but the first patch was found at 12, delta is 2 and the second patch
      // has an effective expected position of 22.
      var delta = 0;
      var results = [];
      for (var x = 0; x < patches.length; x++) {
        var expected_loc = patches[x].start2 + delta;
        var text1 = this.dmp.diff_text1(patches[x].diffs);
        var start_loc;
        var end_loc = -1;
        if (text1.length > this.dmp.Match_MaxBits) {
          // patch_splitMax will only provide an oversized pattern in the case of
          // a monster delete.
          start_loc = this.dmp.match_main(text, text1.substring(0, this.dmp.Match_MaxBits),
                                      expected_loc);
          if (start_loc != -1) {
            end_loc = this.dmp.match_main(text,
                text1.substring(text1.length - this.dmp.Match_MaxBits),
                expected_loc + text1.length - this.dmp.Match_MaxBits);
            if (end_loc == -1 || start_loc >= end_loc) {
              // Can't find valid trailing context.  Drop this patch.
              start_loc = -1;
            }
          }
        } else {
          start_loc = this.dmp.match_main(text, text1, expected_loc);
        }
        if (start_loc == -1) {
          // No match found.  :(
          results[x] = false;
          // Subtract the delta for this failed patch from subsequent patches.
          delta -= patches[x].length2 - patches[x].length1;
        } else {
          // Found a match.  :)
          results[x] = true;
          delta = start_loc - expected_loc;
          var text2;
          if (end_loc == -1) {
            text2 = text.substring(start_loc, start_loc + text1.length);
          } else {
            text2 = text.substring(start_loc, end_loc + this.dmp.Match_MaxBits);
          }
          /* FIXME I stripped the code that performs an atomic replacement.
           Probably a bad idea, because it screws up undo.*/
          var diffs = this.dmp.diff_main(text1, text2, false);
          if (text1.length > this.dmp.Match_MaxBits &&
              this.dmp.diff_levenshtein(diffs) / text1.length >
              this.dmp.Patch_DeleteThreshold) {
            // The end points match, but the content is unacceptably bad.
            results[x] = false;
          } else {
            this.dmp.diff_cleanupSemanticLossless(diffs);
            var index1 = 0;
            var index2;
            for (var y = 0; y < patches[x].diffs.length; y++) {
              var mod = patches[x].diffs[y];
              let op = null;
              if (mod[0] !== DIFF_EQUAL) {
                index2 = this.dmp.diff_xIndex(diffs, index1);
              }
              if (mod[0] === DIFF_INSERT) {  // Insertion
                text = text.substring(0, start_loc + index2) + mod[1] +
                       text.substring(start_loc + index2);
                op = [DIFF_INSERT, start_loc + index2, mod[1]]
              } else if (mod[0] === DIFF_DELETE) {  // Deletion
                let delStart = start_loc + index2;
                let delEnd = start_loc + this.dmp.diff_xIndex(diffs,
                                                  index1 + mod[1].length);
                text = text.substring(0, delStart) +
                       text.substring(delEnd);
                op = [DIFF_DELETE, delStart, delEnd]
              }
              if (mod[0] !== DIFF_DELETE) {
                index1 += mod[1].length;
              }
              if (op) ops.push(op);
            }
          }
        }
      }
      // Strip the padding off.
      text = text.substring(nullPadding.length, text.length - nullPadding.length);
      for each (let op in ops) {
        // Substract padding length from start and end positions
        op[1] -= nullPadding.length;
        if (op[0] == DIFF_DELETE)
            op[2] -= nullPadding.length;
      }
      return [ops, text, results];
    },

    getClientText: function() {
        return this.view.scimoz.text;
    },
    
    /**
     * This replaces the editor content with text. Because it also destroys
     * folding, moves the cursor to the beginning and resets the scroll
     * position, this method is not called from patchClientText anymore. But if
     * we receive an "R:" protocol message, we still have to use this method.
     */
    setClientText: function(text) {
        this.log.warn("setClientText called. 'R:' command received?");
        return this.view.scimoz.text = text;
    },
    
    /**
     * Takes an array of [(DIFF_INSERT|DIFF_DELETE), start_pos, (text|end_pos)]
     * and performs that operation on scimoz.
     */
    modifyClientText: function(mods) {
        for each (let mod in mods) {
            if (mod[0] == DIFF_INSERT) {
                let charPos = mod[1];
                let bytePos = this.view.scimoz.positionAtChar(0, charPos);
                let text = mod[2];
                let textByteLength = ko.stringutils.bytelength(text);
                // Since insertText does not preserve the current selection,
                // but only the cursor position we have to save and restore
                // it ourselves.
                let currentSelection = this._getCurrentSelection();
                this.view.scimoz.insertText(bytePos, text);
                this._adjustSelectionAfterInsert(currentSelection, bytePos,
                                                 textByteLength);
                this._adjustSelectionAfterInsert(this.lastSelection, bytePos,
                                                 textByteLength);
                this._setCurrentSelection(currentSelection);
            }
            // FIXME selection adjustion for deletes (at least for this.lastSelection)
            if (mod[0] == DIFF_DELETE) {
                let beginChar = mod[1];
                let endChar = mod[2];
                let beginByte = this.view.scimoz.positionAtChar(0, beginChar);
                let endByte = this.view.scimoz.positionAtChar(beginByte,
                                                        endChar - beginChar);
                this.view.scimoz.targetStart = beginByte;
                this.view.scimoz.targetEnd = endByte;
                this.view.scimoz.replaceTarget(-1, "");
                this._adjustSelectionAfterDelete(this.lastSelection,
                                                 beginByte, endByte)
            }
        }
        
        if (!this.initialSync) {
            // Set the revert buffer, if we just applied the initial patch.
            this.initialSync = true;
            this.setDocumentRevertBuffer();
            if ('changeTracker' in this.view && this.view.changeTracker.enabled) {
                this.view.changeTracker.collabStoreState();
            }
        }
    },
    
    _getCurrentSelection: function() {
        var selection = {};
        selection.start = this.view.scimoz.selectionStart;
        selection.end = this.view.scimoz.selectionEnd;
        return selection;
    },
    
    _setCurrentSelection: function(selection) {
        if (selection && selection.start && selection.end) {
            this.view.scimoz.selectionStart = selection.start;
            this.view.scimoz.selectionEnd = selection.end;
        }
        return selection;
    },
    
    _adjustSelectionAfterInsert: function(selection, pos, length) {
        if (pos <= selection.start) {
            selection.start += length;
        }
        if (pos <= selection.end) {
            selection.end += length;
        }
        return selection;
    },
    
    _adjustSelectionAfterDelete: function(selection, begin, end) {
        var length = end - begin;
        if (begin < selection.start) {
            if (end < selection.start) {
                selection.start -= length;
            } else {
                selection.begin = begin;
            }
        }
        if (begin < selection.end) {
            if (end < selection.end) {
                selection.end -= length;
            } else {
                selection.end = begin;
            }
        }
        return selection;
    },
    
    addViewModifiedHandler: function() {
        if (typeof this._viewModifiedHandler !== 'function') {
            this._viewModifiedHandler =
                ko.collaboration.utils.bind(this._handleViewModified, this);
            let modMask = Components.interfaces.ISciMoz.SC_MOD_INSERTTEXT |
                          Components.interfaces.ISciMoz.SC_MOD_DELETETEXT;
            this.view.addModifiedHandler(this._viewModifiedHandler, this, 1000,
                                         modMask);
        }
    },
    
    removeViewModifiedHandler: function() {
        if (typeof this._viewModifiedHandler === 'function') {
            this.view.removeModifiedHandler(this._viewModifiedHandler);
            delete this._viewModifiedHandler;
        } else {
            this.log.warn("this._viewModifiedHandler is not a function.");
        }
    },
    
    _handleViewModified: function(position, modificationType, text,
                                                               byteLength, linesAdded, line,
                                                               foldLevelNow, foldLevelPrev) {
        // Highlight all insert operations with local/remoteChangeIndicator
        let insType = Components.interfaces.ISciMoz.SC_MOD_INSERTTEXT;
        let delType = Components.interfaces.ISciMoz.SC_MOD_DELETETEXT;
        if (modificationType & insType) {
            if (this._isApplyingServerChange) {
                // Don't color the text that's added when a user joins a session
                if (this.clientVersion > 1) {
                    this._clearIndicator(this._localChangeIndicator, position, byteLength);
                    this._setIndicator(this._remoteChangeIndicator, position, byteLength);
                }
            } else {
                this._clearIndicator(this._remoteChangeIndicator, position, byteLength);
                this._setIndicator(this._localChangeIndicator, position, byteLength);
            }
        }
    
        // Do cursor preservation for remote cursors on delete and insert ops
        if (modificationType & insType) {
            this.cursorController.correctForIns(position, byteLength);
        } else if (modificationType & delType) {
            this.cursorController.correctForDel(position, position+byteLength);
        }
    },
    
    addSelectionModifiedHandler: function() {
        this.view.addEventListener('current_view_linecol_changed', 
                                this._handleSelectionModified,
                                false);
    },
    
    removeSelectionModifiedHandler: function() {
        this.view.removeEventListener('current_view_linecol_changed', 
                                   this._handleSelectionModified,
                                   false);
    },
    
    _handleSelectionModified: function() {
        /* FIXME This is not working. `_isApplyingServerChange` is set to `true`
        in `patchClientText`, so that scimoz callbacks can distinguish server
        changes from local changes. However, this callback is obviously executed
        after `patchClientText` has completed, so it has no effect.
        `_isApplyingServerChange` should probably be set back to false inside
        one of the callbacks.*/
        
        if (!this._isApplyingServerChange)
            // Local user pressed a key, schedule a sync *now*.
            mobwrite.syncNow();
    },
    
    handleMetadata: function(metadata) {
        var newMetadata = {};
        var userChanged = false; // true if a user joined or left the editing session
        for (let [username, obj] in Iterator(metadata)) {
            try {
                // Is this a new user?
                if (!(username in this.users)) {
                    userChanged = true;
                    this.cursorController.addUser(username, obj);
                }
                // FIXME this is a bit stupid...
                newMetadata[username] = {};
                newMetadata[username].username = obj.username;
                newMetadata[username].user_id = obj.user_id;
                this.cursorController.updateCursor(username, obj.cursor.start, 
                    obj.cursor.end);
            } catch(e) {
                this.log.error("Invalid userdata object for " + username +
                              ": " + e);
            }
        }
        // Find out if a user has left the session.
        for (let username in this.users) {
            if (!(username in newMetadata)) {
                userChanged = true;
                this.cursorController.removeUser(username);
            }
        }
        this.users = newMetadata;
        if (userChanged)
            this._handleUserChange();
    },
    
    _clearIndicator: function(indicator, start, byteLength) {
        if (typeof indicator !== 'number') return;
        this.view.scimoz.indicatorCurrent = indicator;
        if (typeof start !== 'number')
            start = 0;
        if (typeof byteLength !== 'number')
            byteLength = this.view.scimoz.textLength - start;
        this.view.scimoz.indicatorClearRange(start, byteLength);
    },
    
    _setIndicator: function(indicator, start,
                                                     length) {
        if (typeof indicator !== 'number') return;
        this.view.scimoz.indicatorCurrent = indicator;
        this.view.scimoz.indicatorValue = 1;
        this.view.scimoz.indicatorFillRange(start, length);
    },
    
    /**
     * This should be called whenever a user joins or leaves the current
     * editing session.
     */
    _handleUserChange: function() {
        // Previously, a list of all users that are editing this document, was
        // displayed here. But we don't have such a list at the moment.
    },
    
    addViewClosedHandler: function() {
        if (typeof this._viewClosedHandler !== 'function') {
            this._viewClosedHandler = ko.collaboration.utils.bind(
                function viewClosedHandler(evt) {
                    if (evt.originalTarget == this.view) {
                        this.unshare();
                    }
                }, this);
            this.view.addEventListener("view_closed", this._viewClosedHandler,
                                       false);
        }
    },
    
    removeViewClosedHandler: function() {
        if (typeof this._viewClosedHandler === 'function') {
            this.view.removeEventListener("view_closed",
                                          this._viewClosedHandler, false);
            delete this._viewClosedHandler;
        }
    },
    
    addCurrentViewChangedHandler: function() {
        if (typeof this._currentViewChangedHandler !== 'function') {
            this._currentViewChangedHandler = ko.collaboration.utils.bind(
              this.handleCurrentViewChanged, this);
            // We cannot add this listener to window because this script is 
            // loaded inside collab-pane.xul, not komodo.xul.
            this.view.parentView.addEventListener("current_view_changed",
              this._currentViewChangedHandler, false);
        }
    },
    
    removeCurrentViewChangedHandler: function() {
        if (typeof this._currentViewChangedHandler === 'function') {
            this.view.parentView.removeEventListener("current_view_changed",
              this._currentViewChangedHandler);
        }
    },
    
    handleCurrentViewChanged: function(event) {
        if (event.originalTarget == this.view) {
            this.cursorController && this.cursorController.enable();
        } else {
            this.cursorController && this.cursorController.disable();
        }
    },
    
    /**
     * Adds a handler function that clears all margin change markers on file
     * save.
     */
    addSaveHandler: function() {
        if (typeof this._collabFileSaveHandler !== 'function') {
            this._collabFileSaveHandler = ko.collaboration.utils.bind(this.onCollabFileSave, this);
            this.view.addEventListener('collab_file_save', this._collabFileSaveHandler, false);
        }
    },
    
    /** Removes the save handler. */
    removeSaveHandler: function() {
        if (typeof this._collabFileSaveHandler === 'function') {
            this.view.removeEventListener('collab_file_save', this._collabFileSaveHandler);
        }
    },
    
    /**
     * Clears all margin change markers on file save.
     * Since there are multiple shareObjs (and thus multiple handlers), only
     * handle save for the view specified in the `event` parameter.
     * @param event The collab file save event which contains the view to save
     *   in the `event.detail.view` field.
     */
    onCollabFileSave: function(event) {
        if (event.detail.view == this.view) {
            if ('changeTracker' in this.view && this.view.changeTracker.enabled) {
                this.view.changeTracker.collabStoreState();
            }
        }
    },
    
    /**
     * Tell the server to release resources for this connections and tell the
     * mobwrite client to stop sharing this tab.
     */
    unshare: function() {
        this.log.debug("unsharing " + this.file);
        this.markClosed();
        this._removeObserver();
        this.removeViewClosedHandler();
        this.removeCurrentViewChangedHandler();
        this.removeViewModifiedHandler();
        this.removeSelectionModifiedHandler();
        this.removeSaveHandler();
        this._removeTabHeaderIcon();
        this.cursorController._removeAllCaretFlags();
        // Convert the document to an instance of koDocumentBase in case
        // the view will not be closed right away.
        if (this.view.koDoc) {
            this.view.koDoc = this.view.koDoc.toBaseDocument();
        }
        delete this.view.mobwriteShareObj;
        mobwrite.syncNow();
    },
    
    /**
     * Takes a mobwrite user id and jumps to the cursor position of that user
     * and returns true. If cursor information for that user is not available
     * it returns false.
     */
    gotoUserPos: function(username) {
        var cursorPos = this.cursorController.getCursorPos(username);
        if (cursorPos) {
            this.view.scimoz.gotoPos(cursorPos.begin);
            return true;
        }
        return false;
    },
    
    /**
     * Returns a dict of "<username> (<connection number>)" <>
     * "<mobwrite syncUsername>" that can be used as a online user list.
     */
    getOnlineUsers: function() {
        var users = {};
        var count = {};
        users[Weave.Service.username + " (You)"] = mobwrite.syncUserName;
        count[Weave.Service.username] = 1;
        for (let [id, user] in Iterator(this.users)) {
            if (!count.hasOwnProperty(user.username)) {
                count[user.username] = 0
            }
            count[user.username] += 1;
            let userLabel = user.username;
            if (count[user.username] > 1)
                userLabel += " (" + count[user.username] + ")";
            users[userLabel] = id;
        }
        return users;
    },
    
    observe: function(subject, topic, data) {
        switch(topic) {
            case "collaboration:connection-status-changed":
                if (ko.collaboration.service.connected)
                    this._setTabHeaderIconOk();
                else
                    this._setTabHeaderIconError();
                break;
            case PREF_ALWAYS_SHOW_USER_FLAGS:
                if (ko.prefs.getBoolean(PREF_ALWAYS_SHOW_USER_FLAGS)) {
                    this.cursorController && this.cursorController.showAllCaretFlags();
                } else {
                    this.cursorController && this.cursorController.hideAllCaretFlags();
                }
                break;
        }
    },
    
    _setTabHeaderIconOk: function() {
        var headerEl = this.view.parentNode._tab;
        if (headerEl) {
            headerEl.setAttribute('collab_status', "collaboration_online");
        }
    },
    
    _setTabHeaderIconError: function() {
        var headerEl = this.view.parentNode._tab;
        if (headerEl) {
            headerEl.setAttribute('collab_status', "collaboration_offline");
        }
    },
    
    _removeTabHeaderIcon: function() {
        var headerEl = this.view.parentNode._tab;
        if (headerEl) {
            headerEl.removeAttribute('collab_status');
        }
    },
    
    _addObserver: function() {
        var obsSvc = Components.classes['@mozilla.org/observer-service;1'].
                        getService(Components.interfaces.nsIObserverService);
        obsSvc.addObserver(this, "collaboration:connection-status-changed", false);
        // Listen for collab preferences.
        ko.prefs.prefObserverService.addObserver(this, PREF_ALWAYS_SHOW_USER_FLAGS, false);
    },
    
    _removeObserver: function() {
        var obsSvc = Components.classes['@mozilla.org/observer-service;1'].
                        getService(Components.interfaces.nsIObserverService);
        obsSvc.removeObserver(this, "collaboration:connection-status-changed");
        ko.prefs.prefObserverService.removeObserver(this, PREF_ALWAYS_SHOW_USER_FLAGS);
    }
}


/**
 * Really the CaretController. Controls indicators for remote users that 
 * represent their selection and flags that represent their caret position in 
 * the document.
 */
let CursorController = function(shareObj) {
    this.enabled = true;
    this.shareObj = shareObj;
    this.cursors = {};
    this._indicators = [
        Components.interfaces.koILintResult.INDICATOR_COLLAB_CURSOR_1,
        Components.interfaces.koILintResult.INDICATOR_COLLAB_CURSOR_2,
        Components.interfaces.koILintResult.INDICATOR_COLLAB_CURSOR_3,
        Components.interfaces.koILintResult.INDICATOR_COLLAB_CURSOR_4,
        Components.interfaces.koILintResult.INDICATOR_COLLAB_CURSOR_5
    ];
    
    var self = this;
    var onMozScroll = {
        onUpdateUI: function(updated)
        {
            var ISciMoz = Components.interfaces.ISciMoz;
            if ((updated & ISciMoz.SC_UPDATE_H_SCROLL) || (updated & ISciMoz.SC_UPDATE_V_SCROLL))
            {
                self.updateAllCaretFlags();
            }
        }
    }
    
    this._view.scimoz.hookEvents(onMozScroll, Components.interfaces.ISciMozEvents.SME_UPDATEUI);
}

CursorController.prototype = {
    /**
     * Assigns a cursor indicator for the given user.
     */
    addUser: function(userId, meta) {
        if (!(userId in this.cursors)) {
            if (!meta.displayName || typeof meta.displayName != 'string')
                meta.displayName = 'Unknown user';
                
            if (meta.user_id) {
                var friends = ko.collaboration.friends.allFriends;
                if (meta.user_id in friends)
                    meta.displayName = friends[meta.user_id];
            }
            var cursor = this._newCursorObj(userId, meta.displayName);
            this.cursors[userId] = cursor;
            return cursor;
        } else {
            return null;
        }
    },
    
    /**
     * Removes a users cursor.
     */
    removeUser: function(userId) {
        if (userId in this.cursors) {
            this.removeCursor(userId);
            this._clearCaretFlag(userId);
            delete this.cursors[userId];
            return true;
        } else {
            return false;
        }
    },
    
    /**
     * Updates the user's stored cursor position. If the cursor has actually
     * moved, the corresponding indicator is re-drawn.
     */
    updateCursor: function(userId, cursorBegin, cursorEnd) {
        if (userId in this.cursors) {
            var cursor = this.cursors[userId];
            var cursorPos = { 'begin': cursorBegin, 'end': cursorEnd };
            var isFirstUpdate = this._posEqual(cursor.storedPos, 
                {'begin': -1, 'end': -1});
            if (!this._posEqual(cursor.storedPos, cursorPos)) {
                this.removeCursor(userId);
                cursor.storedPos = { 'begin': cursorBegin, 'end': cursorEnd };
                let [begin, end] = this._setCursor(cursor.indicator, cursorPos);
                cursor.actualPos = { 'begin': begin, 'end': end };
                // Only draw a caret flag if a user actually moved their caret.
                // I.e. don't flash all the caret flags as we open the document.
                if (!isFirstUpdate)
                    this._drawCaretFlag(userId);
            }
        }
    },
    
    /**
     * Removes the given user's cursor from the editor. Since other users might
     * use the same indicator, it sets the cursors of all users with the same
     * indicator.
     */
    removeCursor: function(userId) {
        if (userId in this.cursors) {
            var cursor = this.cursors[userId];
            this._clearCursor(cursor.indicator, cursor.actualPos.begin,
                              cursor.actualPos.end);
            
            // Since this might have cleared other cursors w/ the same
            // indicator, we have to reset those manually:
            for (let [otherUserId, otherCursor] in Iterator(this.cursors)) {
                if (otherCursor != cursor &&
                    otherCursor.indicator == cursor.indicator) {
                    this._setCursor(otherCursor.indicator,
                                    otherCursor.actualPos);
                }
            }
        }
    },
    
    /**
     * Returns the real position of the given users cursor indicator.
     */
    getCursorPos: function(userId) {
        if (userId in this.cursors) {
            return this.cursors[userId].actualPos;
        }
        return null;
    },
    
    /**
     * Corrects the internally stored cursor positions, so we can keep track
     * of all users' cursor indicator positions.
     */
    correctForIns: function(bytePos, byteLength) {
        for (let [userId, cursor] in Iterator(this.cursors)) {
            // Perform absolute referencing on the known real positions of the
            // cursor indicator.
            let cursorPos = cursor.actualPos;
            if (bytePos <= cursorPos.begin) {
                cursorPos.begin += byteLength;
            }
            if (bytePos <= cursorPos.end) {
                cursorPos.end += byteLength;
            }
        }
    },
    
    /**
     * Corrects the internally stored cursor positions, so we can keep track
     * of all users' cursor indicator positions.
     */
    correctForDel: function(delBegin, delEnd) {
        for (let [userId, cursor] in Iterator(this.cursors)) {
            // Perform absolute referencing on the known real positions of the
            // cursor indicator.
            let cursorPos = cursor.actualPos;
            let delLength = delEnd - delBegin;

            // If a deletion is made before a point, decrement it by the length
            // of the deleted text. If a deletion encompasses a point, set that
            // point to the beginning of the deletion.
            if (delBegin < cursorPos.begin) {
                if (delEnd < cursorPos.begin) {
                    cursorPos.begin -= delLength;;
                } else {
                    cursorPos.begin = delBegin;
                }
            }
            if (delBegin < cursorPos.end) {
                if (delEnd < cursorPos.end) {
                    cursorPos.end -= delLength;
                } else {
                    cursorPos.end = delBegin;
                }
            }
        }
    },
    
    enable: function() {
        this.enabled = true;
        this.showAllCaretFlags();
    },
    
    disable: function() {
        this.enabled = false;
        this.hideAllCaretFlags();
    },
    
    get _view() {
        return this.shareObj.view;
    },
    
    _newCursorObj: function(userId, displayName) {
        var indicator = this._nextIndicator();
        var caretFlag = this._createCaretFlag(userId, displayName, indicator);
        return {
            'userId': userId,
            'caretFlag': caretFlag,
            'caretTimeout': null,
            'indicator': indicator,
            'storedPos': {'begin': -1, 'end': -1},
            'actualPos': {'begin': -1, 'end': -1}
        };
    },

    _cursorObjIsNew: function(cursor) {
        return this._posEqual(cursor.storedPos, {'begin': -1, 'end': -1});
    },
    
    /**
     * Returns one of the available indicator numbers round-robin.
     */
    _nextIndicator: function() {
        if (!this._currentIndicator)
            this._currentIndicator = 0;
        else
            this._currentIndicator %= this._indicators.length;
        return this._indicators[this._currentIndicator++];
    },
    
    get _caretFlagTimeout()
        ko.collaboration.service.prefs.getIntPref("caretFlags.timeout"),
    
    _createCaretFlag: function(userId, displayName, indicator) {
        var color = this._view.scimoz.indicGetFore(indicator);
        var popupId = "collaboration_cursor_ " + userId + " _popup_" + color;
        var popup = document.getElementById(popupId);
        if (!popup) {
            popup = document.createElement('tooltip');
            popup.setAttribute("level", "parent");
            popup.addEventListener("mouseover", function() {
                popup.style.setProperty("opacity", "0.1");
            });
            popup.addEventListener("mouseout", function() {
                popup.style.removeProperty("opacity");
            });
        }
        popup.setAttribute('id', popupId);
        popup.setAttribute('level', 'floating');
        popup.setAttribute('class', 'collaboration_cursor_panel');
        var label = document.createElement('label');
        label.setAttribute("value", displayName);
        label.setAttribute("class", "collaboration_cursor_panel_label");
        
        var koColor = require("ko/color");
        var colorString = koColor.longToHex(koColor.BGRToRGB(color));
        if (colorString == '#000000') colorString = '#FFFFFF';
        label.style.backgroundColor = colorString;
        
        var editor = require("ko/editor");
        var lineHeight = editor.defaultTextHeight();
        popup.setAttribute('style', 'border-color: ' + colorString + ' !important; ' +
                                    'padding-bottom: ' + lineHeight + "px;");
        
        popup.appendChild(label);
        document.documentElement.appendChild(popup);
        return popup;
    },
    
    _drawCaretFlag: function(userId, onlyIfOpen = false) {
        // If this is not the current view, don't draw anything
        if (!this.enabled) return;
        
        if (!this._view) return;
        var cursorObj = this.cursors[userId];
        if (!cursorObj) return;
        
        var _window = require("ko/windows").getMain();
        if (!_window.document.hasFocus()) return;
        
        if (cursorObj.caretTimeout)
            clearTimeout(cursorObj.caretTimeout);
            
        var end = cursorObj.actualPos.end;
        var sm = this._view.scimoz;
        
        var editor = require("ko/editor");
        
        var x = sm.pointXFromPosition(end);
        var y = sm.pointYFromPosition(end);
        y += editor.defaultTextHeight();
        
        var sbo = this._view.scintilla.boxObject;
        var popup = cursorObj.caretFlag;
        
        // Todo: Calculate the scrollbar and margin size rather than
        // using a static value
        if (y < editor.defaultTextHeight() || y > sbo.height ||
            x < 50 || x > (sbo.width + 100))
        {
            if (popup.state == "open") {
                popup.hidePopup();
            }
            return;
        }
        
        var self = this;
        var updatePos = function()
        {
            var pbo = popup.boxObject;
            popup.moveTo(x + sbo.screenX, (y + sbo.screenY) - pbo.height);
            popup.removeEventListener("popupshown", updatePos);
        }

        if (popup.state != "open" && ! onlyIfOpen) {
            popup.openPopup(this._view.scintilla, "after_start", x, y, false, false);
            popup.addEventListener("popupshown", updatePos);
        }
        else
        {
            updatePos();
        }
        
        if (!ko.prefs.getBoolean(PREF_ALWAYS_SHOW_USER_FLAGS)) {
            cursorObj.caretTimeout = setTimeout(function() {
                this._clearCaretFlag(userId);
            }.bind(this), this._caretFlagTimeout);
        }
        
        var hideOnBlur = function ()
        {
            _window.removeEventListener("blur", hideOnBlur);
            this._clearCaretFlag(userId);
        }
        
        _window.addEventListener("blur", hideOnBlur.bind(this));
    },
    
    _clearCaretFlag: function(userId) {
        if (!this._view) return;
        var cursorObj = this.cursors[userId];
        if (!cursorObj) return;
        
        if (cursorObj.caretTimeout)
            clearTimeout(cursorObj.caretTimeout);

        cursorObj.caretFlag.hidePopup();
    },
    
    _removeAllCaretFlags: function() {
        for (let [userId, cursor] in Iterator(this.cursors)) {
            this._clearCaretFlag(userId);
            var popup = cursor.caretFlag;
            try {
                popup.parentElement.removeChild(popup);
            } catch(e) {}
        }
    },
    
    hideAllCaretFlags: function() {
        for (let [userId, cursor] in Iterator(this.cursors)) {
            this._clearCaretFlag(userId);
        }        
    },

    /**
     * Re-displays all caret flags only if they should be permanently shown, as
     * they were hidden by `hideAllCaretFlags()` earlier.
     */
    showAllCaretFlags: function() {
        if (ko.prefs.getBoolean(PREF_ALWAYS_SHOW_USER_FLAGS)) {
            for (let [userId, cursor] in Iterator(this.cursors)) {
                this._drawCaretFlag(userId);
            }
        }
    },
    
    /**
     * Updates all caret flags
     */
    updateAllCaretFlags: function() {
        for (let [userId, cursor] in Iterator(this.cursors)) {
            this._drawCaretFlag(userId, true);
        }
    },

    _setCursor: function(indicator, cursorPos) {
        if (!this._view) return null;
        
        let begin = cursorPos.begin;
        let end = Math.max(cursorPos.end, begin);
        
        if (begin != end)
        {
            this.shareObj._setIndicator(indicator, begin, end-begin);
        }

        return [begin, end];
    },
    
    /**
     * Clears a given indicator between begin and end. Note that this might
     * clear other cursors using the same indicator as well.
     */
    _clearCursor: function(indicator, begin, end) {
        if (this._view) {        
            this._view.scimoz.indicatorCurrent = indicator;
            let length = end - begin;
            this._view.scimoz.indicatorClearRange(begin, length);
        }
    },
    
    _posEqual: function(pos1, pos2) {
        return (pos1.begin == pos2.begin && pos1.end == pos2.end)
    }
}

ko.collaboration.shareHandler = function(obj) {
    if (!(obj.view.getAttribute("type") == "editor"
            && obj.hasOwnProperty('id')
            && obj.hasOwnProperty('opensExistingCollabDoc')
            && obj.hasOwnProperty('view')
            && obj.view.scimoz.eOLMode == obj.view.scimoz.SC_EOL_LF)) {
        return null
    }
    
    try {
        return new ko.collaboration.shareObj(obj.view, obj.id, obj.opensExistingCollabDoc);
    } catch(e) {
        e.message = "Creating ko.collaboration.shareObj failed: " + e.message;
        throw e;
    }
    return null;
}
mobwrite.shareHandlers.push(ko.collaboration.shareHandler);
