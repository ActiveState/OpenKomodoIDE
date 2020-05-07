(function() {

    const log = require("ko/logging").getLogger("codeintel/service/mediator/legacy");
    const {Cc, Ci}  = require("chrome");
    const legacy = Cc["@activestate.com/codeintel/legacy;1"].getService(Ci.koICodeintelLegacy);
    const KoPromise = require("ko/promise");

    var master;

    var Mediator = function (meta)
    {
        var init = () =>
        {
            if ( ! meta)
                master = this;
        };

        this.isReady = () =>
        {
            return true;
        };

        this.isFailing = function ()
        {
            return false;
        };

        this.supports = (feature) =>
        {
            return meta && meta.opts.supports.indexOf(feature) != -1;
        };

        /**
         * Makes a request to the codeintel server
         *
         * @param   {string}                method
         * @param   {Arguments} ...args     rest of arguments (variable)
         *
         * @returns {KoPromise}
         */
        this.request = (method, args) =>
        {
            log.debug("request called");

            return new KoPromise((resolve, reject) =>
            {
                if ( ! (method in legacy))
                {
                    log.error("method does not exist in koCodeintelLegacy: " + method);
                    reject("Method does not exist");
                    return;
                }

                var callback = (code, result) =>
                {
                    if (code === 0)
                        resolve(JSON.parse(result));
                    else
                        reject(result);
                };
    
                args.push(callback);
    
                try
                {
                    legacy[method].apply(legacy, args);
                }
                catch (e)
                {
                    log.exception(e, "Legacy request failed");
                    reject();
                }
            });
        };

        this.stop = () =>
        {};

        init();

    };

    this.create = (meta) =>
    {
        return new Mediator(meta);
    };

}).apply(module.exports);