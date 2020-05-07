"use strict";

var ensureString     = require("type/string/ensure")
  , toShortString    = require("type/lib/to-short-string")
  , isNamespaceToken = require("./is-namespace-token");

module.exports = function (namespaceToken) {
	namespaceToken = ensureString(namespaceToken);
	if (isNamespaceToken(namespaceToken)) return namespaceToken;
	throw new TypeError(
		toShortString(namespaceToken) +
			" is not a valid namespace token (only 'a-z0-9-' chars are allowed)"
	);
};
