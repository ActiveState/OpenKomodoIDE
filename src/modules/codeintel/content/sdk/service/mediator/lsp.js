(function() {

    const logging = require("ko/logging");
    const log = logging.getLogger("typescript/mediator");
    const {Cc, Ci}  = require("chrome");
    const koPromise = require("ko/promise");
    const rpc = require("contrib/vscode-jsonrpc/main");
    const child_process = require("sdk/system/child_process");
    const koShell = require("ko/shell");
    const { emit } = require('sdk/event/core');
    const appinfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
    const koEditor = require("ko/editor");
    const views = require("ko/views");
    const w = require("ko/windows").getMain();
    const legacy = w.ko;

    //log.setLevel(10);

    var process, connection;
    var ready = false;
    var failing = false;
    
    module.exports = {};

    (function ()
    {
        var meta;

        this.capabilities = {
            applyEdit: false,
            workspaceEdit: {
                documentChanges: false
            },
            didChangeConfiguration: {
                dynamicRegistration: false
            },
            didChangeWatchedFiles: {
                dynamicRegistration: false
            },
            symbol: {
                dynamicRegistration: false
            },
            executeCommand: {
                dynamicRegistration: false
            },
            xcontentProvider: false,
            xfilesProvider: false,
        };

        this.completionKindMap = {
            1: "KW", // Text
            2: "MTH", // Method
            3: "FUN", // Function
            4: "CNST", // Constructor
            5: "ARG", // Field
            6: "VAR", // Variable
            7: "CLS", // Class
            8: "IFC", // Interface
            9: "MOD", // Module
            10: "PROP", // Property
            11: "KW", // Unit
            12: "KW", // Value
            13: "STRU", // Enum
            14: "KW", // Keyword
            15: "KW", // Snippet
            16: "KW", // Color
            17: "MOD", // File
            18: "IFC", // Reference
            19: "NMSP", // Folder
            20: "STRU", // EnumMember
            21: "CNST", // Constant
            22: "STRU", // Struct
            23: "EVNT", // Event
            24: "BI", // Operator
            25: "ARG" // TypeParameter
        };

        this.symbolKindMap = {
            1: "KW", // File
            2: "MOD", // Module
            3: "NMSP", // Namespace
            4: "MOD", // Package
            5: "CLS", // Class
            6: "MTH", // Method
            7: "PROP", // Property
            8: "IFC", // Field
            9: "CTOR", // Constructor
            10: "STRU", // Enum
            11: "IFC", // Interface
            12: "FUN", // Function
            13: "VAR", // Variable
            14: "CNST", // Constant
            15: "STR", // String
            16: "NUM", // Number
            17: "BOOL", // Boolean
            18: "ARR", // Array
            19: "OBJ", // Object
            20: "ATTR", // Key
            21: "CNST", // Null
            22: "STRU", // EnumMember
            23: "STRU", // Struct
            24: "EVNT", // Event
            25: "BI", // Operator
            26: "ARG" // TypeParameter
        };

        this.symbolKindScopes = [3,5,8,9,10,11,12,22,23];

        this.create = function (_meta)
        {
            meta = _meta;
        };

        this.spawn = function (binary, args)
        {
            process = child_process.spawn(binary, args);
            process.stdin.write = (data) =>
            {
                data = unescape(encodeURIComponent(data));
                log.debug("Writing: " + data);
                emit(process.stdin, 'data', data);
            };

            process.stderr.on("data", reportError.bind(null, "stderr"));
            process.on("error", reportError.bind(null, "error"));
            process.on("close", (d) =>
            {
                if ( ! ready)
                {
                    this.onClosePremature();
                    failing = true;
                }

                log.debug("close: " + d);
            });

            connection = rpc.createMessageConnection(
                new rpc.StreamMessageReader(process.stdout),
                new rpc.StreamMessageWriter(process.stdin),
                {
                    error: reportError.bind(null, "connection error")
                }
            );

            connection.trace(true, { log: (data) => { log.debug(data); } });
            connection.listen();

            var path;
            try
            {
                path = legacy.uriparse.URIToLocalPath(legacy.places.getDirectory());
            } catch(e)
            {
                path = koShell.getCwd();
            }

            connection.sendRequest("initialize", {
                processId: appinfo.processID,
                rootPath: path,
                rootUri: legacy.uriparse.pathToURI(path),
                initializationOptions: {},
                capabilities: this.capabilities,
                trace: "verbose"
            })
            .then(() => ready = true)
            .catch(reportError.bind(null, "initialize caught"));
        };

        var reportError = function (description, data) 
        {
            if (data instanceof Error || (typeof data == "object" && "fileName" in data && "lineNumber" in data && "message" in data))
            {
                log.exception(data, description);
            }
            else
            {
                log.error(description + ": " + logging.getObjectTree(data), true);
            }
        };

        this.onClosePremature = function () {};
        
        this.isFailing = function ()
        {
            return failing === true;
        };

        this.isReady = function () 
        {
            return process && process.pid && ready;
        };

        this.supports = function (feature) 
        {
            return meta && meta.opts.supports.indexOf(feature) != -1;
        };

        this.request = function (method, args, opts) 
        {
            log.debug("request called: " + method);

            method = "mediate_" + method;

            return new koPromise((resolve, reject) =>
            {
                if ( ! (method in this))
                    return reject("Method not supported: " + method);

                this[method](opts, resolve, reject);
            });
        };


        this.getCaretScope = function (opts, resolve, reject) 
        {
            reject();
        };

        this.mediate_getSymbolsInBuffer = function (opts, resolve, reject) 
        {
            log.debug("getSymbolsInBuffer called");

            var uri = "file://unsaved";
            var view = opts.view || views.current().get();
            if (view.koDoc && view.koDoc.file)
                uri = view.koDoc.file.URI;

            var args = opts.args;

            var textDocument = {
                uri: uri,
                languageId: meta.language,
                version: 0,
                text: args.buf
            };
            var notification = new rpc.NotificationType('textDocument/didOpen');
            connection.sendNotification(notification, { textDocument: textDocument });

            var close = () =>
            {
                var notification = new rpc.NotificationType('textDocument/didClose');
                connection.sendNotification(notification, { textDocument: legacy.uriparse.pathToURI(args.path) });
            };

            connection.sendRequest("textDocument/documentSymbol", {
                textDocument: { uri: uri }
            })
            .then((items) =>
            {
                this.parseSymbolTree(items, opts)
                .then(resolve)
                .catch(reject);
            })
            .then(close)
            .catch(reportError.bind(null, "getSymbolsInBuffer caught"))
            .catch(close)
            .catch(reject);
        };

        this.parseSymbolTree = function (items, opts) 
        {
            return new koPromise((resolve, reject) =>
            {
                var symbols = [];
                var containers = { global: [{ members: symbols }]};

                for (let item of items)
                {
                    if ( ! ("_"+item.name in containers))
                        containers["_"+item.name] = [];

                    let symbol = {
                        "name": item.name,
                        "typehint": null,
                        "type": this.symbolKindMap[item.kind] || "KW",
                        "filename": item.location.uri,
                        "line": item.location.range.start.line + 1,
                        "pos": -1,
                        "active": false,
                        "isScope": this.symbolKindScopes.indexOf(item.kind) != -1,
                        "source": "buffer",
                        "members": [],
                        "api": "lsp"
                    };

                    symbol = this.normalizeSymbol(symbol);

                    containers["_"+item.name].push(symbol);

                    let container = symbols;
                    if (item.containerName && "_"+item.containerName in containers)
                    {
                        container = containers["_"+item.containerName].slice(-1)[0];
                        container.isScope = true;
                        container = container.members;
                    }
    
                    container.push(symbol);
                }
                
                var activeSymbol;
                var line = opts.args.line-1;
                for (let k in containers)
                {
                    for (let container of containers[k])
                    {
                        if (opts.args.sortType == "alpha")
                            container.members = container.members.sort((a,b) => a.name.localeCompare(b.name));
                        else
                            container.members = container.members.sort((a,b) => a.line - b.line);
                            
                        if (container.isScope &&
                            container.line && container.line <= line && ( ! activeSymbol || container.line > activeSymbol.line))
                        {
                            activeSymbol = container;
                        }
                    }
                }

                if (activeSymbol)
                    activeSymbol.active = true;

                resolve(symbols);
            });
        };
        
        this.normalizeSymbol = function (symbol) { return symbol; };

        this.mediate_getCaretScope = function (opts, resolve, reject)
        {
            log.debug("getCaretScope called");

            var uri = "file://unsaved";
            var view = opts.view || views.current().get();
            if (view.koDoc && view.koDoc.file)
                uri = view.koDoc.file.URI;

            var args = opts.args;

            var textDocument = {
                uri: uri,
                languageId: meta.language,
                version: 0,
                text: args.buf
            };
            var notification = new rpc.NotificationType('textDocument/didOpen');
            connection.sendNotification(notification, { textDocument: textDocument });

            var close = () =>
            {
                var notification = new rpc.NotificationType('textDocument/didClose');
                connection.sendNotification(notification, { textDocument: legacy.uriparse.pathToURI(args.path) });
            };

            connection.sendRequest("textDocument/documentSymbol", {
                textDocument: { uri: uri }
            })
            .then((items) =>
            {
                var activeItem;
                var line = opts.args.line-1;
                for (let item of items)
                {
                    var curLine = item.location.range.start.line;
                    if (this.symbolKindScopes.indexOf(item.kind) != -1 &&
                        curLine <= line && ( ! activeItem || curLine > activeItem.location.range.start.line))
                    {
                        activeItem = item;
                    }
                }

                if ( ! activeItem)
                    return resolve();

                resolve(this.normalizeSymbol({
                    "name": activeItem.name,
                    "typehint": null,
                    "type": this.symbolKindMap[activeItem.kind] || "KW",
                    "filename": activeItem.location.uri,
                    "line": activeItem.location.range.start.line + 1,
                    "pos": -1,
                    "active": true,
                    "isScope": this.symbolKindScopes.indexOf(activeItem.kind) != -1,
                    "source": "buffer",
                    "members": [],
                    "api": "lsp"
                }));
            })
            .then(close)
            .catch(reportError.bind(null, "getSymbolsInBuffer caught"))
            .catch(close)
            .catch(reject);
        };

        this.mediate_getCompletions = function (opts, resolve, reject) 
        {
            log.debug("getCompletions called");

            var view = opts.view || views.current().get();
            editor = koEditor.editor(view.scintilla, view.scimoz);
            queryRx = new RegExp(`[${meta.opts.completion_query_characters || meta.opts.completion_word_characters}]`);
            var query = editor.getWord(opts.args.pos, queryRx) || "";
            query = query.toLowerCase();

            var args = opts.args;
            var viewUri = require("ko/views").current().url;
            var uri = legacy.uriparse.pathToURI(args.path);

            var pos;
            if (viewUri == uri)
                pos = require("ko/editor").getCursorPosition();
            else
            {
                var buf = args.buf.substr(args.pos).split(/\n|\r/);
                pos = {
                    line: buf.length,
                    ch: buf.slice(-1)[0].length
                };
            }

            var textDocument = {
                uri: legacy.uriparse.pathToURI(args.path),
                languageId: meta.language,
                version: 0,
                text: args.buf
            };
            var notification = new rpc.NotificationType('textDocument/didOpen');
            connection.sendNotification(notification, { textDocument: textDocument });

            var close = () =>
            {
                var notification = new rpc.NotificationType('textDocument/didClose');
                connection.sendNotification(notification, { textDocument: legacy.uriparse.pathToURI(args.path) });
            };

            connection.sendRequest("textDocument/completion", {
                textDocument: { uri: legacy.uriparse.pathToURI(args.path) },
                position: { line: pos.line - 1, character: pos.ch }
            })
            .then((data) =>
            {
                var items = data.items;
                items = items.filter((v) => v.label.toLowerCase().indexOf(query) != -1);

                this.parseCompletions(items, opts)
                .then((symbols) => {
                    resolve({
                        "symbol": "",
                        "query": query,
                        "docblock": "",
                        "signature": "",
                        "entries": symbols,
                        "language": meta.language
                    });
                })
                .catch(reject);
            })
            .then(close)
            .catch(reportError.bind(null, "getCompletions caught"))
            .catch(close)
            .catch(reject);
        };

        this.parseCompletions = function (items, opts) 
        {
            return new koPromise((resolve, reject) =>
            {
                var symbols = [];
                for (let item of items)
                {
                    symbols.push(this.normalizeCompletionSymbol({
                        "name": item.label,
                        "typehint": null,
                        "type": this.completionKindMap[item.kind] || "KW",
                        "filename": item.data && item.data.uri ? item.data.uri : null,
                        "line": -1,
                        "pos": item.data && item.data.offset ? item.data.offset : null,
                        "active": false,
                        "isScope": this.symbolKindScopes.indexOf(item.kind) != -1,
                        "source": "buffer",
                        "members": [],
                        "api": "lsp"
                    }));
                }
                
                resolve(symbols);
            });
        };
        
        this.normalizeCompletionSymbol = function (symbol) { return symbol; };

        this.stop = function () 
        {};

    }).apply(module.exports);
    
}).apply(module.exports);