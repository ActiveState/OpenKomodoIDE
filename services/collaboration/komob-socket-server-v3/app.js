var fs = require('fs'),
    http = require('http'),
    https = require('https'),
    Log = require('log'),
    sio = require('socket.io'),
    redis = require('redis'),
    config = require('./config');

var log = new Log(config.log_level);

// Init the redis clients:
var collabRedis = redis.createClient(config.redis_port, config.redis_host);
// Auth is done automagically after each connect since v0.5.7.
collabRedis.auth(config.redis_password);
collabRedis.on('ready', function() {
    collabRedis.select(config.redis_collab_db, function() {
        collabRedis.psubscribe('komob-push:*')
    });
});
var sessionRedis = redis.createClient(config.redis_port, config.redis_host);
sessionRedis.auth(config.redis_password);
sessionRedis.on('ready', function() {
    sessionRedis.select(config.redis_session_db)
});

// Map of socket connections that wait for push messages
var msgRecipients = {};

function runServer() {
    function httpHandler(req, res){
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write('<h1>Komodo Collaboration Push Server</h1>\n' +
                  'What are you doing here?');
        res.end();
    }
    if (!config.https) {
        var server = http.createServer(httpHandler);
    } else {
        var httpsConfig = {
            "key": fs.readFileSync(config.https.key),
            "cert": fs.readFileSync(config.https.cert)
        };
        // If there is a CA chain, read it.
        if (config.https.ca) {
            httpsConfig.ca = config.https.ca.map(
                function(certPath) { fs.readFileSync(certPath); }
            );
        }
        server = https.createServer(httpsConfig, httpHandler);
    }

    var io = sio.listen(server);

    io.configure(function() {
        for (var key in config.socket_io_settings) {
            var value = config.socket_io_settings[key];
            io.set(key, value);
        }
    });

    log.debug('Server started up');

    /**
     * Socket listener logic
     */
    io.sockets.on('connection', function(client) {
        log.debug('New client connected');

        // true if the client has sent an authentication message that got accepted
        var clientAuthenticated = false;

        client.on('komob_auth', function handleAuth(msg) {
            if (!clientAuthenticated) {
                var splits = msg.split('\n');
                if (splits && splits.length == 3) {
                    // TODO
                    var komobVersion = splits[0],
                        ssoKey = splits[1],
                        mobwriteId = splits[2];
                    if (!komobVersionIsSupported(komobVersion)) {
                        log.warning("Client with unsupported version " + komobVersion);
                        sendAuthenticationResponse("version", null);
                        return;
                    }
                    if (ssoKey && mobwriteId) {
                        authenticate(ssoKey, mobwriteId, sendAuthenticationResponse,
                                     sendError);
                        return;
                    }
                }
                sendError("invalid");
            } else {
                log.warning('Unexpected client message: ' + msg);
            }
        });

        function komobVersionIsSupported(versionNumber) {
          return config.supported_komob_versions.indexOf(versionNumber) != -1;
        };

        /**
         * Performs authentication of user and password against the
         * ActiveState.com Account API. authenticationCallback is called when
         * the authentication request is completed and gets one boolean
         * parameter indicating wether authentication was successful.
         */
        function authenticate(ssoKey, mobwriteId, authenticationCallback, errorCallback) {
            // XXX The Redis client does not "remember" the selected database
            // when it times out. So it's safer to put a .select() here.
            // See https://github.com/mranney/node_redis/issues/86
            sessionRedis.select(config.redis_session_db);
            sessionRedis.get(ssoKey, function(err, user_id) {
                var api = http.createClient(config.account_api_port,
                                            config.account_api_host);
                var uri = '/api/user/' + encodeURIComponent(user_id) + '/json/';
                var options = {'host': config.account_api_host};
                var request = api.request('GET', uri, options);
                request.end();
                request.on('response', function onApiResponse(response) {
                    if (response.statusCode == 200) {
                        var data = '';
                        response.on('data', function onApiData(chunk) {
                            data += chunk;
                        });
                        response.on('end', function onApiComplete() {
                            try {
                                var account = JSON.parse(data);
                            } catch(e) {
                                log.warning('Could not parse JSON payload ' + data);
                                errorCallback('unavailable');
                                return;
                            }
                            var success = (account && account.is_active);
                            if (success) {
                                clientAuthenticated = true;
                                authenticationCallback(null, user_id, mobwriteId);
                            } else {
                                authenticationCallback("credentials");
                            }
                        });
                    } else if (response.statusCode >= 400 &&
                               response.statusCode < 500){
                        log.warning("User not found in Account API: " + user_id);
                        authenticationCallback("credentials");
                    } else {
                        log.error("Error contacting Account API: " + response.statusCode);
                        errorCallback('unavailable');
                    }
                });
            });
        };

        /**
         * Reponds to a client's authentication request. If `error` is given,
         * or userId or mobwriteId are not given, the authentication failed
         * and we reply with the error code message in `error`. Otherwise, a
         * message signaling authentication success is sent.
         */
        function sendAuthenticationResponse(error, userId, mobwriteId) {
            if (!error && userId && mobwriteId) {
                client.user = userId;
                client.mobwriteId = mobwriteId;
                clientAuthenticated = true;
                if (!msgRecipients[userId]) {
                    msgRecipients[userId] = [];
                }
                msgRecipients[userId].push(client);
                client.emit('komob_auth', true);
                log.debug("Client authenticated " + userId + " / " +
                            mobwriteId + " / " + client.sessionId);
            } else {
                log.warning("Authentication failed for user id " + userId +
                    " Reason: " + error);
                client.emit('komob_auth', false, error);
                abortConnection();
            }
        };

        function sendError(msg) {
            if (!msg)
              msg = '';
            client.emit('komob_error', msg);
            abortConnection();
        };

        function abortConnection() {
            if (client.connection)
                client.connection.end();
        };

        client.on('disconnect', function handleDisconnect() {
            log.debug('Lost connection to a client');
            if (clientAuthenticated) {
                var clients = msgRecipients[client.user];
                if (clients) {
                    var idx = clients.indexOf(client);
                    if (idx != -1) {
                        delete clients[idx];
                    }
                }
            }
        });

        client.on('error', function(msg) {
            log.warning('A client encountered an error: ' + msg);
        });
    });

    log.warning("Server is running!");
    return server;
}


/**
 * Redis message handling bits
 */

collabRedis.on('pmessage', function(pattern, channel, message) {
    // Strip pattern from channel to get username
    var splits = channel.split(':');
    var type = splits[1],
        userId = splits[2];
    if (!type || !userId) {
        log.error('Invalid message on channel ' + channel + ': ' + message);
        return;
    }
    log.debug('Received ' + type + ' message for user id ' + userId);
    var handlerFunc = null;
    switch(type) {
        case 'friends':
            handlerFunc = handleFriendsMessage;
            break;
        case 'sessions':
            handlerFunc = handleSessionsMessage;
            break;
        case 'mobwrite':
            handlerFunc = handleMobwriteMessage;
            break;
        default:
            log.error('Invalid message type ' + type);
            return;
    }
    var clients = msgRecipients[userId];
    if (clients) {
        clients.forEach(function(client) {
            log.debug('Handling ' + type + ' message for ' + userId);
            handlerFunc(client, message);
        });
    }
});

// Currently, push notifications simply tell the client to pull a certain
// resource. Thus, those message contain no real data except for an identifier
// of the resource that the client should pull.

function handleFriendsMessage(client, message) {
    client.emit('komob_friends');
};

function handleSessionsMessage(client, message) {
    client.emit('komob_sessions');
};

function handleMobwriteMessage(client, message) {
    // Only notify clients with the correct client id:
    log.debug('Mobwrite message for ' + message);
    if (client.mobwriteId && client.mobwriteId == message) {
        log.info('Found matching client');
        client.emit('komob_mobwrite');
    }
};


/**
 * Helper functions
 */

function splitStrLeft(str, delimiter) {
    if (typeof(delimiter) !== 'string')
        delimiter = ':';
    var idx = str.indexOf(delimiter);
    if (idx == -1)
        return null;
    return [str.slice(0, idx), str.slice(idx + 1, str.length)];
}

module.exports = runServer();
