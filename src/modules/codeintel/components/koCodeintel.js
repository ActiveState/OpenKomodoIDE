Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function koCodeintel(){}

(function()
{
    const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
    const { Services }  =   Cu.import("resource://gre/modules/Services.jsm", {});
    var windows = Services.wm.getEnumerator("Komodo");
    var window = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    var console = window.console;
    var require = window.require;
    var loggingSvc, log;
    var uuid = require('sdk/util/uuid');
    var cache = {};

    loggingSvc = Cc["@activestate.com/koLoggingService;1"].
                    getService(Ci.koILoggingService);
    log = loggingSvc.getLogger('koCodeintel');
    //log.setLevel(10);
    log.debug("Intializing Codeintel component");

    koCodeintel.prototype =
    {
        classDescription:   "koCodeintel",
        classID:            Components.ID("{F29AD95E-C88A-4DDB-AB20-BA0C4E393869}"),
        contractID:         "@activestate.com/koCodeintel;1",
        QueryInterface:     XPCOMUtils.generateQI([Ci.koICodeintel]),

        getResultFor: function(id)
        {
            var result = "";
            if (id in cache)
            {
                result = cache[id];
                delete cache[id];
            }
            return result;
        },

        /**
         * Get the next scope relative to the caret position
         *
         * @param {String} buf  Source code to be scanned
         * @param {Int} line    Line context
         * @param {String} language  Language name
         * @param {koIAsyncCallback} callback   callback to handle Scope object (AbstractScope)
         *
         */
        getNextScopeLine: function(buf, line, language, callback)
        {
            var id = uuid.uuid();
            require("codeintel/service").getNextScope({buf:buf, line:line, language:language})
            .then((data)=>
            {
                if (data && data.line && parseInt(data.line))
                    cache[id] = parseInt(data.line);
                callback.callback();
            })
            .catch(log.warn);

            return id;
        },

        /**
         * Get the current scope relative to the caret position
         *
         * @param {String} buf  Source code to be scanned
         * @param {Int} line    Line context
         * @param {Int} pos    Caret position
         * @param {String} language  Language name
         * @param {koIAsyncCallback} callback   callback to handle Scope object (AbstractScope)
         *
         */
        getCaretScopeLine: function(buf, line, pos, language, callback)
        {
            var id = uuid.uuid();
            require("codeintel/service").getCaretScope({buf:buf, line:line, pos:pos, language:language})
            .then((data)=>
            {
                if (data && data.line)
                    cache[id] = parseInt(data.line);
                callback.callback();
            })
            .catch(log.warn);

            return id;
        }
    };
}.call());

var NSGetFactory = XPCOMUtils.generateNSGetFactory([koCodeintel]);
