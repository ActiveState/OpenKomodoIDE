/**
 * The Ajax SDK, allows you to easily send HTTP requests.
 *
 * @module ko/ajax
 * @copyright (c) 2017 ActiveState Software Inc.
 * @license Mozilla Public License v. 2.0
 * @author ActiveState
 * @example
 * require("ko/ajax").get("https://api.ipify.org", (status, text) => console.log(text));
 */
(function() {

    const logging   = require("ko/logging");
    const log       = logging.getLogger("sdk-ajax");
    const {Cc, Ci, Cu, components}  = require("chrome");
    const console = require("ko/console");

    var _window = require("ko/windows").getMostRecent();

    /**
     * @callback requestCallback
     * @param {integer}         status          Status code
     * @param {string}          responseText    Body of the response
     * @param {XMLHttpRequest}  request         Instance of XMLHttpRequest, see {@link https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest}
     */

    /**
     * Query the given path/uri via a GET request
     *
     * @param   {String}                            path        The path
     * @param   {module:ko/ajax~requestCallback}    callback    Callback function
     */
    this.get = function(path, callback)
    {
        return this.request({url: path, method: 'GET'}, callback);
    }

    /**
     * Query the given path/uri via a POST request
     *
     * @param   {String}                            path        The path
     * @param   {module:ko/ajax~requestCallback}    callback    Callback function
     */
    this.post = function(path, callback)
    {
        return this.request({url: path, method: 'POST'}, callback);
    }

    /**
     * DO NOT USE THIS ONE.  USE request2.
     *
     * Manually construct a HTTP request. `params` can be just a URL or the full
     * params object.
     *
     * @param   {String|Object}                     params          url, method, headers, body, withCredentials
     * @param   {module:ko/ajax~requestCallback}    callback        Callback function
     *
     * @example
     * params = {
     *      url:"",
     *      method:"POST|GET",
     *      headers:{header:"value"},
     *      body:"",
     *      withCredentials: boolean
     *   }
     */
    this.request = function(params, callback)
    {
        if (typeof params == 'string') params = { url: params };

        var headers = params.headers || {};
        var body = params.body;

        // Todo: use common js module - the one in our current moz version is broken
        // var req = new require("sdk/net/xhr").XMLHttpRequest;
        var req = new _window.XMLHttpRequest({mozSystem: true});
        req.withCredentials = params.withCredentials || false;

        req.onreadystatechange = function() {
            if (req.readyState == 4 && callback)
                callback(req.status, req.responseText, req);
        }

        var defaultHeaders = {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': body ? body.length : 0,
            'Connection': 'close'
        }

        var _headers = {};
        for (let k in defaultHeaders)
            _headers = headers[k] || defaultHeaders[k];

        req.open(params.method || (body ? 'POST' : 'GET'), params.url, true);

        for (var field in _headers)
            req.setRequestHeader(field, _headers[field]);

        req.send(body);
    }
    
     /**
     * Manually construct a HTTP request. `params` can be just a URL or the full
     * params object.
     *
     * @param   {String|Object}                     params          url, method, headers, body, withCredentials
     * @param   {module:ko/ajax~requestCallback}    callback        Callback function
     *
     * @example
     * params = {
     *      url:"",
     *      method:"POST|GET",
     *      headers:{header:"value"},
     *      body:"",
     *      withCredentials: boolean
     *   }
     */
    this.request2 = function(params, callback)
    {
        if (typeof params == 'string') params = { url: params };

        var headers = params.headers || {};
        var body = params.body;

        var w = require("sdk/window/utils").getHiddenWindow();
        var XMLHttpRequest = w.XMLHttpRequest;
        var req = new XMLHttpRequest({mozSystem: true});
        req.mozBackgroundRequest = true;

        req.onreadystatechange = function() {
            if (req.readyState == 4 && callback)
            {
                callback(req.status, req.responseText, req);
            }
        }

        var defaultHeaders = {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': body ? body.length : 0,
            'Connection': 'close'
        }

        var _headers = {};
        for (let k in defaultHeaders)
            _headers[k] = defaultHeaders[k];
        for (let k in headers)
            _headers[k] = headers[k];

        req.open(params.method || (body ? 'POST' : 'GET'), params.url, true);

        for (var field in _headers)
            req.setRequestHeader(field, _headers[field]);

        req.send(body);
    }
    
}).apply(module.exports);
