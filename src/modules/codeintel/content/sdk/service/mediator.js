var storage = require("ko/session-storage").get("codeintel-service-mediator").storage;
if (storage.instance)
{
  module.exports = storage.instance;
}
else
{

(function() {
    storage.instance = this;

    const {Cc, Ci}  = require("chrome");
    const log = require("ko/logging").getLogger("codeintel/service/mediator");
    const codeintel = require("codeintel/codeintel");
    const process = require("codeintel/process");
    const jsonrpc = require("ko/jsonrpc");
    const legacy = Cc["@activestate.com/codeintel/legacy;1"].getService(Ci.koICodeintelLegacy);
    const timers = require("sdk/timers");
    const KoPromise = require("ko/promise");
    const prefs = require("ko/prefs");
    const l = require("ko/locale").use();

    var cache = {};
    var age = {};
    var registered = {};
    var instanced = {};

    this.registered = registered;

    const MAXAGE = 60 * 1000;
    const DEFAULT_MEDIATOR = "codeintel/service/mediator/codeintel";
    this.DEFAULT_MEDIATOR = DEFAULT_MEDIATOR;

    var inProgress = {};
    var callbacks = {};

    //log.setLevel(10);

    /**
     * Generates an ID based on the name and args given
     * This only considers args that are numbers, booleans or strings
     *
     * @param   {string} name
     * @param   {array} args
     * @param   {object} opts
     *
     * @returns {string}
     */
    this.getId = (name, args, opts) =>
    {
        var id = name;
        for (let arg of args)
        {
            let type = typeof arg;
            if (["string", "boolean", "number"].indexOf(type) == -1)
                continue;
            if (type == "string")
                id += arg.length;
            else
                id += arg;
        }
        if ("mediator" in opts)
            id += opts.mediator;
        return id;
    };

    this.getMediatorIds = () =>
    {
        var seen = {};
        var result = [];

        for (let language in registered)
        {
            for (let id in registered[language])
            {
                if (id in seen)
                    continue;

                seen[id] = true;
                result.push(id);
            }
        }

        return result;
    };

    /**
     * Register a mediator module
     *
     * @param   {string} id       The module identifier, eg: codeintel/service/mediator/legacy
     * @param   {string} name     Human readable name
     * @param   {string} language The language this module can mediate for
     * @param   {object} [opts]   Optional dictionary of options
     */
    this.register = (id, name, language, opts) =>
    {
        if ( ! (language in registered))
            registered[language] = {};

        if (id in registered[language])
            throw new Error("mediator is already registered: " + id);

        registered[language][id] =
        {
            id: id,
            name: name,
            language: language,
            opts: opts
        };
    };

    /**
     * Unregister the given mediator for the given language
     *
     * @param   {string} id
     * @param   {string|null} language
     */
    this.unregister = (id, language) =>
    {
        if (language)
        {
            if (language in registered && id in registered[language])
            {
                var _id = id + language;
                if (_id in instanced)
                {
                    instanced[_id].stop();
                    delete instanced[_id];
                }
                delete registered[language][id];
                registered[language];
            }
        }
        else
        {
            for (let language in registered)
            {
                this.unregister(id, language);
            }
        }
    };
    
    /**
     * Get a generic mediator for the given id, this mediator is initialized
     * without a language and is used just for generic calls
     *
     * @param   {string} id
     *
     * @returns {boolean|module:codeintel/service/mediator/codeintel~Instance}
     */
    this.getMediatorById = (id) =>
    {
        if ( ! (id in instanced))
            instanced[id] = require(id).create();

        return instanced[id];
    };

    this.getMediatorsForLanguage = (language) =>
    {
        if ( ! (language in registered))
            return false;

        var m = [];
        for (let id in registered[language])
        {
            m.push(registered[language][id]);
        }

        return m;
    };

    /**
     * Get an instanced mediator for the given language (if one is registered)
     *
     * @param   {string} language
     *
     * @returns {boolean|module:codeintel/service/mediator/codeintel~Instance}
     */
    this.getMediatorByLanguage = (language, forceDefault) =>
    {
        var mediator;
        if ( ! forceDefault)
            mediator = prefs.getString("codeintel.mediator." + language);

        if (mediator)
        {
            if ( ! (language in registered) || ! (mediator in registered[language]))
                return false;
            mediator = registered[language][mediator];
        }
        else if ( ! mediator && ! language)
        {
            return this.getMediatorById(DEFAULT_MEDIATOR);
        }
        else if ( ! mediator)
        {
            if ( ! (language in registered))
                return false;

            var mediators = registered[language];
            for (let id in mediators)
            {
                if ( ! mediator || id == DEFAULT_MEDIATOR)
                    mediator = mediators[id];
            }
        }

        var id = mediator.id + language;
        if ( ! (id in instanced))
            instanced[id] = require(mediator.id).create(mediator);

        return instanced[id];
    };

    /**
     * Get an instanced mediator for the given language (if one is registered)
     *
     * @param   {string} language
     *
     * @returns {boolean|module:codeintel/service/mediator/codeintel~Instance}
     */
    this.getMediatorMetaByLanguage = (language) =>
    {
        var mediator = prefs.getString("codeintel.mediator." + language);

        if (mediator)
        {
            if ( ! (language in registered) || ! (mediator in registered[language]))
                return false;
            mediator = registered[language][mediator];
        }
        else if ( ! mediator)
        {
            if ( ! (language in registered))
                return false;
            
            var mediators = registered[language];
            for (let id in mediators)
            {
                if ( ! mediator || id == DEFAULT_MEDIATOR)
                    mediator = mediators[id];
            }
        }
        
        return mediator;
    };
    
    this.getLanguageInfo = (language) =>
    {
        var meta = this.getMediatorMetaByLanguage(language);
        return meta ? meta.opts : false;
    };

    this.getMediatorByFeature = (feature, language) =>
    {
        var mediator = this.getMediatorByLanguage(language);
        if (mediator && mediator.supports(feature))
            return mediator;
        
        mediator = this.getMediatorByLanguage(language, true);
        if (mediator && mediator.supports(feature))
            return mediator;

        return false;
    };

    this.getMediatorMenu = (view) =>
    {
        var mediators = this.getMediatorsForLanguage(view.language);
        if (mediators.length <= 1)
            return false;

        var engineMenu = require("ko/ui/menu").create(
        {
            label: l.get("engine"),
            class: "mediator-selection"
        });

        for (let m of mediators)
        {
            let selectedMediator = prefs.getString("codeintel.mediator." + view.language);
            let item = require("ko/ui/menuitem").create(
            {
                label: m.name,
                name: "mediator",
                type: "radio",
                checked: selectedMediator == m.id || ( ! selectedMediator && m.id == DEFAULT_MEDIATOR)
            });

            item.on("command", ((item, m) =>
            {
                var checked = item.attr("checked") == "true";
                if (checked)
                    prefs.setString("codeintel.mediator."+view.language, m.id);
                require("sdk/system/events").emit("codeintel-update");
            }).bind(null, item, m));

            engineMenu.addMenuItem(item, m);
        }

        return engineMenu;
    };

    /**
     * Register a mediated service
     * This takes care of all the boilerplate so the calling code only needs
     * to worry about the basics
     *
     * @param   {string} name           Endpoint
     * @param   {array} argIndex        Index of argument names (in the correct order)
     * @param   {object} optsDefault    Default options
     *
     * @returns {Function} Returns the mediated function
     */
    this.mediate = (name, argIndex, optsDefault) =>
    {
        return (args, opts = {}) =>
        {
            var _opts = Object.assign({}, optsDefault);
            _opts = Object.assign(_opts, opts);
            _opts.args = args;

            var _args = [];
            for (let k of argIndex)
            {
                let v = args && k in args ? args[k] : null;
                _args.push(v);
            }

            var language = null;
            if (args && "language" in args)
                language = args.language;

            _opts.requestId = this.getId(name, _args, _opts);

            return this.onServiceCall(name, _args, _opts, language);
        };
    };

    /**
     * Mediate a service call, this takes care of directing the request to the
     * proper request method, combining multiple requests of the same requestId,
     * caching, etc.
     * 
     * @param   {String} method   Service endpoint
     * @param   {Object} args 
     * @param   {Object} opts
     * @param   {String} language
     * 
     * @returns {KoPromise} 
     */
    this.onServiceCall = (method, args, opts = {}, language = null) =>
    {
        log.debug("Mediating request for " + method);

        // Flush old caches
        gc();

        var mediator;
        if (opts.mediator)
            mediator = this.getMediatorById(opts.mediator);
        else if (opts.feature)
            mediator = this.getMediatorByFeature(opts.feature, language);
        else
            mediator = this.getMediatorByLanguage(language);

        if ( ! mediator)
        {
            log.debug("Could not find a mediator for language: " + language);
            return;
        }

        opts.method = opts.method || false;
        opts.cache = opts.cache || false;
        opts.maxAge = opts.maxAge || false;

        if ( ! opts.requestId)
        {
            log.warn(`Request does not have a requestId: ${method}`);
        }

        var requestId = opts.requestId || method;
        if ( ! (requestId in callbacks))
            callbacks[requestId] = [];

        // return cached entry if it exist and didnt expire
        if (opts.cache && requestId in cache && ( ! opts.maxAge || (Date.now() - age[requestId]) < opts.maxAge))
        {
            log.debug("Returning cached results");
            return new KoPromise((resolve, reject) =>
            {
                resolve.apply(null, cache[requestId]);
            });
        }

        // if a request id was supplied then see if we have any requests currently
        // in progress and if so add a callback handler rather than invoke the
        // request again
        if (requestId in inProgress && opts.cache)
        {
            log.debug("Request is already in progress, adding to callback chain");
            return new KoPromise((resolve, reject, each) =>
            {
                callbacks[requestId].push({resolve: resolve, reject: reject, each: each});
            });
        }

        if ( ! mediator.isReady())
        {
            if (mediator.isFailing())
            {
                return new KoPromise((resolve, reject, each) =>
                {
                    log.warn("Cannot fulfill service request as mediator is failing");
                    reject();
                });
            }

            // If this service call doesn't support cached requests we should
            // not defer the call
            if ( ! opts.cache)
            {
                return new KoPromise((resolve, reject, each) =>
                {
                    log.warn("Cannot fulfill service request while mediator isn't ready");
                    reject();
                });
            }

            var _arguments = arguments;
            timers.setTimeout(() => this.onServiceCall.apply(this, _arguments), 1000);

            if ( ! opts.waitingForMediator)
            {
                opts.waitingForMediator = true;
                log.warn("Waiting for mediator");
                return new KoPromise((resolve, reject, each) =>
                {
                    callbacks[requestId].push({resolve: resolve, reject: reject, each: each});
                });
            }

            return;
        }

        if (opts.cache)
            inProgress[requestId] = true;

        var request = mediator.request(method, args, opts);

        // Handle callbacks for additional requests
        var callbackHandler = (type, args) =>
        {
            if (requestId in callbacks)
            {
                try
                {
                    for (let callback of callbacks[requestId])
                    {
                        log.debug("Calling callback for " + requestId);
                        callback[type].apply(null, args);
                    }
                }
                finally
                {
                    if (type != "each")
                    {
                        delete callbacks[requestId];
                    }
                }
            }

            if (opts.cache)
                delete inProgress[requestId];
        };
        
        request.each(() =>
        {
            callbackHandler("each", arguments);
        });

        request.then(() =>
        {
            if (opts.cache)
            {
                log.debug("Caching " + requestId);

                cache[requestId] = arguments;
                age[requestId] = Date.now();
            }

            log.debug("Resolving " + requestId);
            callbackHandler("resolve", arguments);
        });

        request.catch(() =>
        {
            log.debug("Rejecting " + requestId);
            callbackHandler("reject", arguments);
        });

        return request;
    };

    /**
     * Flush the cache
     *
     * @param   {String|Null} id    Only flushes cache for given id if defined
     *
     * @returns {Void}
     */
    this.flush = (id) =>
    {
        log.debug("flush " + id);
        if ( ! id)
        {
            age = {};
            cache = {};
        }
        else
        {
            if (id in cache)
                delete cache[id];
            if (id in age)
                delete age[id];
        }
    };

    /**
     * Garbage collector, flushes cache every MAXAGE ms
     * 
     * @returns {void} 
     */
    var gc = () =>
    {
        log.debug("gc");
        for (let id in age)
        {
            if (Date.now() - age[id] > (MAXAGE))
            {
                delete age[id];
                delete cache[id];
            }
        }
    };


}).apply(module.exports);

}