(function() {

    const log = require("ko/logging").getLogger("codeintel/service/mediator/codeintel");
    const codeintel = require("codeintel/codeintel");
    const process = require("codeintel/process");
    const jsonrpc = require("ko/jsonrpc");
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
            return process.get("status") == process.STATUS_STARTED;
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

            args = [method, args];

            var client = codeintel.getClient();
            return client
                .request.apply(client.request, args)
                .catch((error) => { log.error(`Request failed with message: ${error.message} (${error.code})`, true /* no traceback */); });
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