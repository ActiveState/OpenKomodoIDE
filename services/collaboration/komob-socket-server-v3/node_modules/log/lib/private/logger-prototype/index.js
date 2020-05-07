"use strict";

var ensureString       = require("type/string/ensure")
  , aFrom              = require("es5-ext/array/from")
  , assign             = require("es5-ext/object/assign")
  , setPrototypeOf     = require("es5-ext/object/set-prototype-of")
  , d                  = require("d")
  , lazy               = require("d/lazy")
  , levelNames         = require("../../../levels")
  , emitter            = require("../../emitter")
  , enableDisableProps = require("./enable-disable-props")
  , namespaceProps     = require("./namespace-props");

// Map of initialized top level loggers
var levelLoggers = Object.create(null);

var loggerPrototype = Object.create(
	Function.prototype,
	assign(
		{
			isLevelInitialized: d("e", function (level) {
				level = ensureString(level);
				if (this.level === level) return true;
				var logger = levelLoggers[level];
				if (!logger) return false;
				if (!this.namespace) return true;
				return logger.isNamespaceInitialized(this.namespace);
			}),
			getAllInitializedLevels: d("e", function () {
				return Object.keys(levelLoggers)
					.filter(function (level) { return this.isLevelInitialized(level); }, this)
					.map(function (level) { return this._getLevelLogger(level); }, this);
			}),

			_createLogger: d(function () {
				return setPrototypeOf(function self(msgItemIgnored/*, ...msgItemn*/) {
					emitter.emit("log", { logger: self, messageTokens: aFrom(arguments) });
				}, this);
			}),
			_createLevel: d(function (levelName) {
				if (levelLoggers[levelName]) return levelLoggers[levelName];
				var logger = loggerPrototype._createLogger();
				Object.defineProperties(logger, {
					level: d("e", levelName),
					levelIndex: d("e", levelNames.indexOf(levelName)),
					levelRoot: d("e", logger)
				});
				levelLoggers[levelName] = logger;
				emitter.emit("init", { logger: logger });
				return logger;
			}),

			_getLevelLogger: d(function (newLevel) {
				if (this.level === newLevel) return this;
				var levelLogger = this._createLevel(newLevel);
				return this.namespaceTokens.reduce(function (currentLogger, token) {
					return currentLogger._createNamespace(token);
				}, levelLogger);
			})
		},
		lazy(
			assign(
				// Loggers for all levels
				levelNames.reduce(function (descriptors, level) {
					descriptors[level] = d(
						"e",
						function () { return this._getLevelLogger(level); },
						{ cacheName: "_" + level }
					);
					return descriptors;
				}, {}),
				{
					// Alias `warn` to `warning`
					warn: d(function () { return this._getLevelLogger("warning"); }, {
						cacheName: "_warning"
					})
				}
			)
		),

		namespaceProps,
		enableDisableProps
	)
);

module.exports = loggerPrototype;
