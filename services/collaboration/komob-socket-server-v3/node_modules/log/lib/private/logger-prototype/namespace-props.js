"use strict";

var ensureString     = require("type/string/ensure")
  , toShortString    = require("type/lib/to-short-string")
  , identity         = require("es5-ext/function/identity")
  , assign           = require("es5-ext/object/assign")
  , objToArray       = require("es5-ext/object/to-array")
  , d                = require("d")
  , lazy             = require("d/lazy")
  , emitter          = require("../../emitter")
  , isNamespaceToken = require("../is-namespace-token");

module.exports = assign(
	{
		// Initializes and returns namespaced logger
		get: d(function (namespace) {
			namespace = ensureString(namespace);
			var namespaceTokens = namespace.split(":");
			namespaceTokens.forEach(function (namespaceToken) {
				if (!isNamespaceToken(namespaceToken)) {
					throw new TypeError(
						toShortString(namespace) +
							" is not a valid namespace string " +
							"(only 'a-z0-9-' chars are allowed and ':' as delimiter)"
					);
				}
			});
			return namespaceTokens.reduce(function (currentLogger, token) {
				return currentLogger._createNamespace(token);
			}, this);
		}),
		isNamespaceInitialized: d("e", function (namespace) {
			var namespaceTokens = ensureString(namespace).split(":");
			var currentLogger = this;
			return namespaceTokens.every(function (nsToken) {
				return (currentLogger = currentLogger._childNamespaceLoggers[nsToken]);
			});
		}),

		getAllInitializedNamespaces: d("e", function () {
			return objToArray(this._childNamespaceLoggers, identity);
		}),

		_createNamespace: d(function (namespaceToken) {
			if (this._childNamespaceLoggers[namespaceToken]) {
				return this._childNamespaceLoggers[namespaceToken];
			}
			var logger = Object.defineProperties(this._createLogger(), {
				_namespaceToken: d("", namespaceToken)
			});
			this._childNamespaceLoggers[namespaceToken] = logger;
			emitter.emit("init", { logger: logger });
			return logger;
		}),

		_namespaceToken: d("", null)
	},
	lazy({
		// Full namespace string e.g. foo:bar:elo
		namespace: d("e", function () { return this.namespaceTokens.join(":") || null; }, {
			cacheName: "_namespace"
		}),

		// All namespace tokens e.g. ["foo", "bar", "elo"]
		namespaceTokens: d(
			"e",
			function () {
				return this._namespaceToken
					? Object.getPrototypeOf(this).namespaceTokens.concat(this._namespaceToken)
					: [];
			},
			{ cacheName: "_namespaceTokens" }
		),

		// Internal: Map of children namespace loggers
		_childNamespaceLoggers: d("", function () { return Object.create(null); }, {
			cacheName: "__childNamespaceLoggers"
		})
	})
);
