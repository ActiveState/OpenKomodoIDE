var express = require('express')
var url = require('url');
var fs = require('fs');
var winston = require('winston');

var DocumentHandler = require('./lib/document_handler');

// Load the configuration and set some defaults
var config = JSON.parse(fs.readFileSync('./config.js', 'utf8'));
config.port = process.env.PORT || process.env.VCAP_APP_PORT || config.port;
config.host = process.env.HOST || config.host || '0.0.0.0';

if (process.env.VCAP_SERVICES)
{
    var envConf = JSON.parse(process.env.VCAP_SERVICES);
    config.storage.type = "redis";
    config.storage.host = envConf['redis'][0].credentials.host;
    config.storage.port = envConf['redis'][0].credentials.port;
    config.storage.password = envConf['redis'][0].credentials.password;
}

// Set up the logger
if (config.logging)
{
    try
    {
        winston.remove(winston.transports.Console);
    }
    catch (er)
    {}
    var detail, type;
    for (var i = 0; i < config.logging.length; i++)
    {
        detail = config.logging[i];
        type = detail.type;
        delete detail.type;
        winston.add(winston.transports[type], detail);
    }
}

// build the store from the config on-demand - so that we don't load it
// for statics
if (!config.storage)
{
    config.storage = {
        type: 'file'
    };
}
if (!config.storage.type)
{
    config.storage.type = 'file';
}

var Store, preferredStore;

if (process.env.REDISTOGO_URL && config.storage.type === 'redis')
{
    var redisClient = require('redis-url').connect(process.env.REDISTOGO_URL);
    Store = require('./lib/document_stores/redis');
    preferredStore = new Store(config.storage, redisClient);
}
else
{
    Store = require('./lib/document_stores/' + config.storage.type);
    preferredStore = new Store(config.storage);
}

// Send the static documents into the preferred store, skipping expirations
var path, data;
for (var name in config.documents)
{
    path = config.documents[name];
    data = fs.readFileSync(path, 'utf8');
    winston.info('loading static document',
    {
        name: name,
        path: path
    });
    if (data)
    {
        preferredStore.set(name, JSON.stringify({data: data}), function(cb)
        {
            winston.debug('loaded static document',
            {
                success: cb
            });
        }, true);
    }
    else
    {
        winston.warn('failed to load static document',
        {
            name: name,
            path: path
        });
    }
}

// Pick up a key generator
var pwOptions = config.keyGenerator ||
{};
pwOptions.type = pwOptions.type || 'random';
var gen = require('./lib/key_generators/' + pwOptions.type);
var keyGenerator = new gen(pwOptions);

// Configure the document handler
var documentHandler = new DocumentHandler(
{
    store: preferredStore,
    maxLength: config.maxLength,
    keyLength: config.keyLength,
    keyGenerator: keyGenerator
});


/* Initiate web server */
var app = express();
var router = express.Router();

var controller = function(app, router)
{
    router.get('/:id', function(request, response, next)
    {
        //request.url = request.originalUrl = "/"
        //next();
        response.sendFile(__dirname + "/static/index.html");
    });
    
    // get raw documents - support getting with extension
    router.get('/raw/:id', function(request, response)
    {
        var skipExpire = !!config.documents[request.params.id];
        var key = request.params.id.split('.')[0];
        return documentHandler.handleRawGet(key, response, skipExpire);
    });
    
    // add documents
    router.post('/documents', function(request, response)
    {
        return documentHandler.handlePost(request, response);
    });
    
    // get documents
    router.get('/documents/:id', function(request, response)
    {
        var skipExpire = !!config.documents[request.params.id];
        return documentHandler.handleGet(
            request.params.id,
            response,
            skipExpire
        );
    });
    
}

new controller(app, router)

app.use(express.static('static',
{
    dotfiles: 'ignore', index: ['index.html']
}));
app.use(router);

app.listen(config.port);

winston.info('listening on ' + config.host + ':' + config.port);
