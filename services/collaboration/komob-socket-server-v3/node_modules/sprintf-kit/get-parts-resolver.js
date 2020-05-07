// For given modifiers returns parts resolver for given format arguments

"use strict";

var ensureObject        = require("es5-ext/object/valid-object")
  , objForEach          = require("es5-ext/object/for-each")
  , ensurePlainFunction = require("es5-ext/object/ensure-plain-function")
  , primitiveSet        = require("es5-ext/object/primitive-set")
  , typeChars           = require("./lib/type-chars")
  , parse               = require("./parse");

var slice = Array.prototype.slice;

var customTypes = primitiveSet("literal", "rest");

var validateModifiers = function (modifiers) {
	objForEach(ensureObject(modifiers), function (value, type) {
		if (!hasOwnProperty.call(typeChars, type) && !customTypes[type]) {
			throw new TypeError("Invalid modifier type: " + type);
		}
		ensurePlainFunction(value);
	});
};

var resolveRest = function (modifier, data, args, placeholderArgsLength) {
	if (!modifier || args.length <= placeholderArgsLength) return null;
	return modifier(slice.call(args, placeholderArgsLength), data);
};

var resolveResultWithPlaceholders = function (modifiers, data, args, result) {
	var extraPlaceholderArgsLength = 0;
	var isParameterIndexingValid = data.isParameterIndexingValid;
	result.substitutions = data.placeholders.map(function (placeholder, index) {
		var parameter = index + 1;
		if (placeholder.width === "*") ++extraPlaceholderArgsLength;
		if (placeholder.precision === "*") ++extraPlaceholderArgsLength;
		if (!isParameterIndexingValid) {
			return { value: "[invalid placeholder parameters]", placeholder: placeholder };
		}
		if (!modifiers[placeholder.type]) {
			return { value: placeholder.content, placeholder: placeholder };
		}
		if (placeholder.parameter) parameter = placeholder.parameter;
		if (parameter > args.length) {
			return { value: placeholder.content, placeholder: placeholder };
		}
		var placeholderIndex = parameter + extraPlaceholderArgsLength - 1;
		var arg = args[placeholderIndex];
		return {
			value: modifiers[placeholder.type](arg, placeholder, placeholderIndex, args),
			placeholder: placeholder
		};
	});
	result.rest = resolveRest(
		modifiers.rest, data, args, data.placeholders.length + extraPlaceholderArgsLength
	);
	return result;
};

module.exports = function (modifiers) {
	validateModifiers(modifiers);

	return function (format/*, ...params*/) {
		var result;
		if (typeof format !== "string") {
			return {
				literals: [],
				substitutions: [],
				rest: resolveRest(modifiers.rest, null, arguments, 0)
			};
		}
		var data = parse(format);
		var args = slice.call(arguments, 1);

		var literals = data.literals;
		if (modifiers.literal) {
			literals = literals.map(function (literal) { return modifiers.literal(literal); });
		}
		result = { literals: literals };
		if (literals.length <= 1) {
			result.substitutions = [];
			result.rest = resolveRest(modifiers.rest, data, args, 0);
			return result;
		}
		return resolveResultWithPlaceholders(modifiers, data, args, result);
	};
};
