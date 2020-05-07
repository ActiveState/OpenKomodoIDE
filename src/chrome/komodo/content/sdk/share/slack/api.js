/**
 * @copyright (c) ActiveState Software Inc.
 * @license Mozilla Public License v. 2.0
 * @author ActiveState
 */

/**
 * api methods for ko/share/slack
 *
 * @module ko/share/slack/api
 */
(function()
{
    const ajax = require("ko/ajax");
    const log = require("ko/logging").getLogger("slack/api");

    const _window = require("ko/windows").getMain();
    const ko = _window.ko;
    const prefs = require("ko/prefs");
    // Slack variables
    const realm = "Slack Integration User Key"; // Used while saving key
    const querystring = require("sdk/querystring");
    var time = Date.now();
    var key = null;
    var errMessage = "Could not process response from Slack.  Please try again: ";

    var channelCache;

    /**
     * Post your file to Slack
     *
     * @param    {Object}    params  params to push a file
     * @param    {function}  callback    function run when post is complete
     */
    this.post = function(params, callback)
    {
        if( ! key )
        {
            useKey(this.post.bind(this, params, callback));
            return;
        }

        let body = {content: params.content};

        params.token = key;

        makeAPIcall("files.upload", params, body, callback);
    };
    
    /**
     * Make an API call and process the result
     *
     * @param {String}   method  The API method to be called
     * @param {Object}   params  An object of API call parameters
     * @param {function} callback    To process response
     *    Callback takes req.status and req.responseTextText, req.
     *    This function uses ko/ajax.post
     */
    function makeAPIcall(method, params, body, callback)
    {
        var _params = querystring.stringify(params);
        var reqUrl =  "https://slack.com/api/"+method+"?"+_params;

        var _body = body;
        if (body && typeof body == "object")
        {
            _body = new _window.FormData();
            for (let k in body)
                _body.append(k, body[k]);
        }

        var request = {
            url: reqUrl,
            body: _body,
            method: "POST",
            headers: {'Content-Type': 'multipart/form-data'}
        };

        ajax.request(request, (code, response) =>
        {
            if (params.token)
            {
                var needsAuth = false;
                try
                {
                    var _response = JSON.parse(response);
                    if ( !_response.ok && _response.error == "not_authed")
                    {
                        needsAuth = true;
                    }
                    else if(!_response.ok)
                    {
                        require("notify/notify").interact(errMessage +
                                                                e, "share", {priority: "info"});
                    }
                } catch (e)
                {
                    require("notify/notify").interact(errMessage +
                                                                _response.error, "share", {priority: "info"});
                }

                if (needsAuth)
                {
                    this.deleteKey();
                    useKey(this.makeAPIcall.bind(this,method, params, body, callback));
                }
            }

            callback(code, response);
        });
    }

    /**
     * Authenticate the user trying to post to Slack
     *
     * This need to be async as well so it can call whatever function was trying
     * to run when it was asked to authenticate.
     *
     * @param    {function}  callback  function to be run with the key
     */
    var authenticate = function(callback)
    {
        // ### If I cancel in the dialog this gets stuck in a loop.
        // Also server fails to handle and sends back garbage.
        ko.windowManager.openDialog("chrome://komodo/content/dialogs/slackauth.xul",
                                    "Slack Auth",
                                    "chrome,modal,titlebar,centerscreen");
        // Confirm a key was saved then run the callback if it was passed in

        setTimeout(() =>
        {
            require("sdk/passwords").search(
            {
                username: "slack",
                url: "https://slack.com/api",
                onComplete: function (credentials)
                {

                    if( credentials.length )
                    {
                        if( callback ) useKey(callback.bind(this));
                    }
                    else
                    {
                        var locale = "Authentication cancelled or failed.";
                        require("notify/notify").interact(locale, "share", {priority: "info"});
                        log.warn(locale);
                    }

                }.bind(this)
            });
        }, 500);
    };
    
    /**
     * Delete the currently saved key.  Just incase.
     * May be used later if we need to handle invalid keys.
     */
    this.deleteKey = function()
    {
        require("sdk/passwords").search({
            username: "slack",
            url: "https://slack.com/api",
            onComplete: function (credentials) {
                credentials.forEach(require("sdk/passwords").remove);
            }
        });
        key = null;
    };

    /**
     * Save the API key
     * Only saves one key.  Deletes the previously saved key if it exists.
     */
    this.saveKey = function(APIkey)
    {
        // delete any saved keys
        if( ! APIkey)
        {
            log.warn("No key to save.");
            return;
        }
        require("sdk/passwords").search({
            username: "slack",
            url: "https://slack.com/api",
            onComplete: function (credentials) {
                credentials.forEach(require("sdk/passwords").remove);
                // Safest place to save the key is inside the search callback
                // where the deletion might happen as it will run regardless of
                // anything being found and I wouldn't want to save the key only
                // to have this callback delete it later.
                //
                // Save the new key
                require("sdk/passwords").store({
                    url: "https://slack.com/api",
                    username: "slack",
                    password: APIkey,
                    realm: realm
                });
                key = APIkey;
            }
        });
    };

    /**
     * Get the saved Slack API key
     *
     * @param {function} callback    The function to run once key is set.
     *
     * This function ensures that global key var is set when the user tries to
     * post something.  It goes through the following workflow:
     *  - The function that retrieves keys from storage is async so we can't just
     * return it if it's not set yet.
     *  - If not authenticated then the callback is passed to
     * authenticate(callback) to, you know, authenticate, then passed to
     * useKey(callback) again.
     *
     */
    function useKey(callback)
    {
        // Check if key has been set or this is the second time this has run.
        // If not, grab it, save key globally, then check again.
        if ( ! key ) {
            // Once you're in this `if` you won't get a return from the function
            // I feel like this is terrible UX.
            require("sdk/passwords").search(
            {
                username: "slack",
                url: "https://slack.com/api",
                onComplete: function (credentials)
                {
                    if( ! credentials.length )
                    {
                        log.debug("Authenticating");
                        authenticate(callback);
                        return;
                    }
                    // Otherwise, save the key globally
                    credentials.forEach
                    (
                        function(element)
                        {
                            key = element.password;
                            if( callback )
                            {
                                callback();
                            }
                            return; // we only expect one
                        }
                    );
                }.bind(this)
            });
        }
        else
        {
            callback();
        }
    } 
    
    function processResponse(code, respText)
    {
        var respJSON;
        channelCache = channelCache || {};
        try
        {
            respJSON = JSON.parse(respText);
        } catch(e) {
            log.error(errMessage+e);
            require("notify/notify").interact(errMessage+e, "share", {priority: "info"});
            return;
        }
        if ( true === respJSON.ok )
        {
            if (respJSON.channels)
            {
                var channelsJSON = respJSON.channels;
                channelCache.Channels = [];
                for ( let channel of channelsJSON )
                {
                    channelCache.Channels.push({name:channel.name, id:channel.id});
                }
            }
            else if (respJSON.groups)
            {
                var groupsJSON = respJSON.groups;
                channelCache.Groups = [];
                for ( let group of groupsJSON )
                {
                    if ( !group.is_archived)
                    {
                        if (group.name.indexOf("mpdm") >= 0)
                        {
                            group.name = group.purpose.value;
                        }
                        channelCache.Groups.push({name:group.name, id:group.id});
                    }
                }
            }
            else if (respJSON.members)
            {
                var membersJSON = respJSON.members;
                channelCache.Users = [];
                for ( let user of membersJSON )
                {
                    if ( !user.deleted && !user.is_bot && !user.is_app_user)
                        channelCache.Users.push({name:user.name, id:user.id});
                }
            }
        }
        else
        {
            require("notify/notify").interact(errMessage+respJSON.error, "share", {priority: "info"});
        }
    }
    
    /**
     * retrieve available groups for this user.
     */
    var getGroups = (callback) =>
    {
        var params = require("sdk/querystring").stringify(
        {
            token: key,
            exclude_archived:1,
            exclude_members:1
        });
        makeAPIcall("groups.list", params, null, callback);
    };
    
    /**
     * retrieve available people to msg for this user.
     */
    var getPeople = (callback) =>
    {
        var params = require("sdk/querystring").stringify(
        {
            token: key,
            presence: 0
        });
        makeAPIcall("users.list", params, null, callback);
    };
    
    /**
     * retrieve available channels for this user.
     */
    var getChannels = (callback) =>
    {
        var params = require("sdk/querystring").stringify(
        {
            token: key,
            exclude_archived:1,
            exclude_members:1
        });
        makeAPIcall("channels.list", params, null, callback);
    };
    
    /**
     * Retrieve the list of available channels for the authenticated user and
     * save it to the prefs.  Just pull them from the prefs if they are already
     * there.
     *
     * @param {function} callback  function to do something with the return
     *                                channels.  This callback gets passed a
     *                                array of channel objects
     *
     *  channels =
     *  {
     *      Groups:
     *      [
     *          {
     *              name:"bestgroup",
     *              id:"G01982739"
     *          }
     *       ],
     *      Channels:
     *      [
     *          {
     *              name:"BestChannel",
     *              id:"C01982730"
     *          }
     *      ]
     *      Users:
     *      [
     *          {
     *              name:"Carey",
     *              id:"W01982730"
     *          }
     *      ]
     *  }
     *
     */
    this.getChannels = function(callback)
    {
        // Reset channel cache every 5 mins
        if( (Date.now() - time) > 300000)
        {
            channelCache = null;
            time = Date.now();
        }
        // If there is no key then we'll have to reload the channels anyway.
        if (channelCache && key)
        {
            callback(channelCache);
            return;
        }
        else
        {
            channelCache = null;
        }

        if( ! key )
        {
            useKey(this.getChannels.bind(this, callback));
            return;
        }
        
        var watcher = (code, respText) =>
        {
            processResponse(code, respText);
            --callsleft;  
            if( ! callsleft)
            {
                callback(channelCache);
            }
        };
        var callsleft = 3;
        getPeople(watcher);
        getGroups(watcher);
        getChannels(watcher);
    };

}).apply(module.exports);
