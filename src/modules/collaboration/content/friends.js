ko.collaboration.friends = {};

(function() {
    this.update = function() {
        this.updateFriendsList();
    };

    this.log = ko.logging.getLogger("ko.collaboration.friends");

    /**
     * List of all available friends. Gets initialized by updateFriendsList()
     * once friends are fetched from the server for the first time.
     */
    this.allFriends = null;

    /**
     * Prompts the user to supply a username and makes an API call to create a
     * friend request for that user.
     */
    this.sendFriendRequest = function sendFriendRequest() {
        var username = ko.dialogs.prompt("Please enter the email address of the contact you would like to add", "Email address",
                                         null, "Collaboration");
        if (username) {
            let successCallback = function(req) {
                ko.dialogs.alert("A request has been sent. Your contact has to confirm the request before you can share documents.",
                                 null, "Contact request sent");
            }.bind(this);
            let errorCallback = function(req) {
                if (req.status == 404) {
                    ko.dialogs.alert("The email address you supplied does not belong to a known Komodo Collaboration user.",
                                     null, "User not found");
                } else {
                    this._displayError();
                }
            }.bind(this);
            ko.collaboration.api.addFriendAsync(username, successCallback, errorCallback);
        }
    };

    /**
     * Fetches usernames of all friends and updates the friends list. When that
     * is done, continue with friend requests.
     */
    this.updateFriendsList = function updateFriendsList() {
        ko.collaboration.api.getFriendsAsync(
            this._handleFriendsListResponse.bind(this),
            this._displayError.bind(this));
    };

    this._handleFriendsListResponse = function _handleFriendsListResponse(response) {
        if (!response.hasOwnProperty('friends')) {
            this.log.error("Invalid response data from server: " +
                      JSON.stringify(response));
            this._displayError();
        }
        this._clearFriendsLists();
        this.allFriends = {};
        for each (let [userId, userName] in Iterator(response.friends)) {
            this.allFriends[userId] = userName;
        }
        for each (let [userId, userName] in this.getAllFriendsSorted()) {
            this._addFriend(userId, userName);
        }
        this._updatePendingRequests(
            // Pass as a callback and call after the HTTP response has arrived,
            // to make sure friend requests are at the bottom of the list.
            this._updateFriendRequests()
        );
    };

    /**
     * Converts the unsorted object structure `allFriends` into an array of
     * arrays sorted by username in ascending order, and returns it.
     */
    this.getAllFriendsSorted = function getAllFriendsSorted() {
        var sorted = [];
        for each (let [userId, userName] in Iterator(this.allFriends)) {
            sorted.push([userId, userName]);
        }
        sorted.sort(function(a, b) {
            return a[1] < b[1] ? -1 : 1; // Sort by userName
        });
        return sorted;
    };

    this._clearFriendsLists = function _clearFriendsLists() {
        document.getElementById('remove_contact').innerHTML = '';
    };

    this.friendRequests = {};

    /**
     * Get all friend requests from the server, and add those to the contacts
     * list. Should only be called from updateFriends() to make sure that the
     * list is in a clean state.
     */
    this._updateFriendRequests = function _updateFriendRequests() {
        let successCallback = ko.collaboration.utils.bind(function(response) {
            if (!response.hasOwnProperty('requests')) {
                this.log.error("Invalid response data from server: " +
                          JSON.stringify(response));
                this._displayError();
            }
            for each (let [userId, userName] in Iterator(response.requests)) {
                this._addFriendRequest(userId, userName);
            }
        }, this);
        let errorCallback = ko.collaboration.utils.bind(this._displayError, this);

        ko.collaboration.api.getFriendRequestsAsync(successCallback,
                                                    errorCallback);
    };
    
    /**
     * Get all pending requests from the server, and add those to the contacts
     * list. Should only be called from updateFriends() to make sure that the
     * list is in a clean state.
     */
    this._updatePendingRequests = function _updatePendingRequests(cb) {
        let successCallback = ko.collaboration.utils.bind(function(response) {
            if (!response.hasOwnProperty('pending_requests')) {
                this.log.error("Invalid response data from server: " +
                          JSON.stringify(response));
                this._displayError();
            }
            for each (let [userId, userName] in Iterator(response.pending_requests)) {
                this._addPendingRequest(userId, userName);
            }
            if (cb) {
                cb();
            }
        }, this);
        let errorCallback = ko.collaboration.utils.bind(this._displayError, this);

        ko.collaboration.api.getPendingRequestsAsync(successCallback,
                                                     errorCallback);
    };

    /**
     * Adds a contact to the contact list.
     */
    this._addFriend = function _addFriend(userId, userName) {
        var removePopup = document.getElementById('remove_contact');
        var item = document.createElement('menuitem');
        item.setAttribute('id', userId);
        item.setAttribute('label', userName);
        item.setAttribute('oncommand',
                          "ko.collaboration.friends.deleteFriend('"+userName+"','"+userId+"')")
        removePopup.appendChild(item);
    };
    
    this.deleteFriend = function deleteFriend(userName, userId) {
        let successCallback = function() {
            ko.collaboration.friends.update();
        };
        let errorCallback = function() {
            ko.collaboration.friends._displayError();
        };
        if (ko.dialogs.yesNo("Do you really want to remove " +
            userName + " from your contact list?", null, null,
            "Collaboration") == "Yes") {
            ko.collaboration.api.deleteFriendAsync(userId, true,
                successCallback, errorCallback)
        }
    }

    /**
     * Adds a friend request, which can be confirmed or denied, to the contacts list.
     */
    this._addFriendRequest = function _addFriendRequest(userid, username) {
        var _window = require("ko/windows").getMain();
        var nb = _window.document.getElementById("komodo-notificationbox");
        nb.appendNotification(username + " would like to add you as a contact",
                              "contact-request-"+username, null, nb.PRIORITY_INFO_HIGH,
        [
            {
                accessKey: "a",
                callback: function() { ko.collaboration.api.updateFriendRequestAsync(userid, true); },
                label: "Accept"
            },
            {
                accessKey: "r",
                callback: function() { ko.collaboration.api.updateFriendRequestAsync(userid, false); },
                label: "Reject"
            },
        ]);
    };
    
    /**
     * Adds a pending request, which can be cancelled, to the contacts list.
     */
    this._addPendingRequest = this._addFriendRequest;

    this._displayError = function _displayError() {
        var message = 'An error occured while trying to ' +
                        'get your friends list. Please press reload ' +
                        '(under the cog menu) to try again.'
        require("notify").send(message, "collab", {priority: "warning"});
    };
}).apply(ko.collaboration.friends);
