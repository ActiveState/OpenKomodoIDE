var winston = require('winston');
var QueryString = require('querystring');
var path = require('path');
var fs = require('fs');

// For handling serving stored documents

var DocumentHandler = function(options)
{
    if (!options)
    {
        options = {};
    }
    this.keyLength = options.keyLength || DocumentHandler.defaultKeyLength;
    this.maxLength = options.maxLength; // none by default
    this.store = options.store;
    this.keyGenerator = options.keyGenerator;
};

DocumentHandler.defaultKeyLength = 10;

// Handle retrieving a document
DocumentHandler.prototype.handleGet = function(key, response, skipExpire)
{
    this.store.get(key, function(ret)
    {
        if (ret)
        {
            ret = JSON.parse(ret);

            winston.verbose('retrieved document',
            {
                key: key
            });
            
            response.json(ret);
        }
        else
        {
            winston.warn('document not found',
            {
                key: key
            });
            response.status(404);
            response.json(
            {
                message: 'Document not found.'
            });
        }
    }, skipExpire);
};

// Handle retrieving the raw version of a document
DocumentHandler.prototype.handleRawGet = function(key, response, skipExpire)
{
    this.store.get(key, function(ret)
    {
        if (ret)
        {
            ret = JSON.parse(ret);
            ret = ret.data || ret;

            winston.verbose('retrieved raw document',
            {
                key: key
            });
            response.send(ret);
        }
        else
        {
            winston.warn('raw document not found',
            {
                key: key
            });
            response.status(404);
            response.json(
            {
                message: 'Document not found.'
            });
        }
    }, skipExpire);
};

// Handle adding a new Document
DocumentHandler.prototype.handlePost = function(request, response)
{
    var _this = this;
    var buffer = '';
    var cancelled = false;

    // What to do when done
    var onSuccess = function()
    {
        var expiration = null, postData;
        if (buffer.indexOf("raw:")===0)
        {
            postData = {data: buffer.substr(4)};
        }
        else
        {
            postData = QueryString.parse(buffer);

            if (postData.keep)
            {
                expiration = parseInt(postData.keep);

                if (expiration > 2592000) expiration = 2592000;
                if (expiration < 600) expiration = 600;
            }
        }

        if (postData.scheme)
        {
            var scheme = path.basename(postData.scheme);
            if ( ! fs.existsSync(path.join(__dirname, "../static/css/schemes/", scheme) + ".css"))
                delete postData.scheme;
        }

        if (postData.font)
        {
            var font = path.basename(postData.font);
            if ( ! fs.existsSync(path.join(__dirname, "../static/css/fonts/", font.replace(/\s\+/g,"")) + ".css"))
                delete postData.font;
        }

        // Check length
        if (_this.maxLength && buffer.length > _this.maxLength)
        {
            cancelled = true;
            winston.warn('document >maxLength',
            {
                maxLength: _this.maxLength
            });
            response.status(400);
            response.send(
            {
                message: 'Document exceeds maximum length.'
            });
            return;
        }
        // And then save if we should
        _this.chooseKey(function(key)
        {
            postData.key = key;
            var bufferStr = JSON.stringify(postData);
            _this.store.set(key, bufferStr, function(res)
            {
                if (res)
                {
                    winston.verbose('added document',
                    {
                        key: key
                    });
                    response.json({key: key});
                }
                else
                {
                    winston.verbose('error adding document');
                    response.status(500);
                    response.json(
                    {
                        message: 'Error adding document.'
                    });
                }
            }, false, expiration);
        });
    };

    request.on('data', function(data)
    {
        buffer += data.toString();
    });
    request.on('end', function()
    {
        if (cancelled)
        {
            return;
        }
        onSuccess();
    });
    request.on('error', function(error)
    {
        winston.error('connection error: ' + error.message);
        response.status(500);
        response.json(
        {
            message: 'Connection error.'
        });
        cancelled = true;
    });
};

// Keep choosing keys until one isn't taken
DocumentHandler.prototype.chooseKey = function(callback, plusLength)
{
    if ( ! plusLength) plusLength = 0;

    var key = this.acceptableKey(plusLength);
    var _this = this;
    this.store.get(key, function(ret)
    {
        if (ret)
        {
            _this.chooseKey(callback, ++plusLength);
        }
        else
        {
            callback(key);
        }
    });
};

DocumentHandler.prototype.acceptableKey = function(plusLength)
{
    if ( ! plusLength) plusLength = 0;

    return this.keyGenerator.createKey(this.keyLength + plusLength);
};

module.exports = DocumentHandler;
