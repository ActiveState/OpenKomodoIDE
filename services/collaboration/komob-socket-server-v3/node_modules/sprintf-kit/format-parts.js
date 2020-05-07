// For given resolver returns

"use strict";

var ensureArray  = require("es5-ext/array/valid-array")
  , isValue      = require("es5-ext/object/is-value")
  , ensureObject = require("es5-ext/object/valid-object")
  , ensureString = require("es5-ext/object/validate-stringifiable-value");

module.exports = function (parts) {
	var literals = ensureArray(ensureObject(parts).literals);
	var substitutions = ensureArray(parts.substitutions);
	var resolvedString = literals.length
		? literals.reduce(function (resolved, literal, index) {
				return resolved + substitutions[index - 1].value + literal;
		  })
		: "";
	if (isValue(parts.rest)) resolvedString += ensureString(parts.rest);
	return resolvedString;
};
