"use strict";

var isValue              = require("type/value/is")
  , ensureNamespaceToken = require("./private/ensure-namespace-token")
  , d                    = require("d");

var defaultNamespace = null;

module.exports = Object.defineProperty(
	function () { return defaultNamespace; }, "set",
	d(function (namespace) {
		defaultNamespace = isValue(namespace) ? ensureNamespaceToken(namespace) : null;
	})
);
