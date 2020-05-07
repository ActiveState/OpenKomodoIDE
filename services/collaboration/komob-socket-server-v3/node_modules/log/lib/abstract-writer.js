"use strict";

var isObject                 = require("type/object/is")
  , ensureObject             = require("type/object/ensure")
  , assign                   = require("es5-ext/object/assign")
  , d                        = require("d")
  , rootLogger               = require("../")
  , emitter                  = require("./emitter")
  , getTimestampResolver     = require("./get-timestamp-resolver")
  , registerMasterWriter     = require("./get-master-writer").register
  , setupVisibility          = require("./setup-visibility")
  , getDefaultNamespace      = require("./get-default-namespace")
  , levelSymbols             = require("./level-symbols")
  , resolveMessageProperties = require("./private/abstract-writer/resolve-message-properties");

var setDefaultNamespace = getDefaultNamespace.set;

var LogWriter = function (env/*, options */) {
	if (!(this instanceof LogWriter)) throw new Error("LogWriter cannot be invoked without new");
	ensureObject(env);
	var options = arguments[1];
	if (!isObject(options)) options = {};

	registerMasterWriter(this);

	if (options.defaultNamespace) setDefaultNamespace(options.defaultNamespace);

	setupVisibility(env.LOG_LEVEL, (env.LOG_DEBUG || env.DEBUG || "").split(","));

	if (env.LOG_TIME) this.timestampResolver = getTimestampResolver(env.LOG_TIME);

	rootLogger.getAllInitializedLevels().forEach(this.setupLevelLogger, this);
	emitter.on(
		"init",
		function (event) { if (!event.logger.namespace) this.setupLevelLogger(event.logger); }.bind(
			this
		)
	);

	emitter.on(
		"log",
		function (event) {
			if (!event.logger.isEnabled) return;
			if (!event.message) {
				this.resolveMessageTokens(event);
				this.resolveMessage(event);
			}
			this.writeMessage(event);
		}.bind(this)
	);
};

LogWriter.levelPrefixes = levelSymbols;
LogWriter.resolveNamespaceMessagePrefix = function (logger) {
	if (!logger.namespace) return null;
	var rootNamespace = logger.namespaceTokens[0];
	if (getDefaultNamespace() === rootNamespace) {
		if (logger.namespace === rootNamespace) return null;
		return logger.namespace.slice(rootNamespace.length);
	}
	return logger.namespace;
};

Object.defineProperties(
	LogWriter.prototype,
	assign(
		{
			constructor: d(LogWriter),
			setupLevelLogger: d(function (logger) {
				this.setupLevelMessagePrefix(logger);
				var resolveNamespaceMessagePrefix = this.constructor.resolveNamespaceMessagePrefix;
				Object.defineProperty(
					logger, "namespaceMessagePrefix",
					d.gs(function () { return resolveNamespaceMessagePrefix(this); })
				);
			}),
			setupLevelMessagePrefix: d(function (logger) {
				logger.levelMessagePrefix = this.constructor.levelPrefixes[logger.level];
			})
		},
		resolveMessageProperties
	)
);

module.exports = LogWriter;
