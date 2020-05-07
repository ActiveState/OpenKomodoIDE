// format string parser

"use strict";

var aFrom        = require("es5-ext/array/from")
  , ensureString = require("es5-ext/object/validate-stringifiable-value")
  , primitiveSet = require("es5-ext/object/primitive-set")
  , typeChars    = require("./lib/type-chars");

var digitChars = primitiveSet.apply(null, aFrom("0123456789"))
  , flagChars = primitiveSet.apply(null, aFrom("#0-+ 'I"))
  , lengthChars = primitiveSet.apply(null, aFrom("hlLzjt"));

var formatString, char, index, state, literalStart, literals, placeholders;
var literalEnd, placeholder, currentTokenStart;

var states = {
	literal: function () {
		if (char === "%") {
			literalEnd = index;
			placeholder = {};
			state = "parameterStart";
		}
		++index;
	},

	parameterStart: function () {
		if (hasOwnProperty.call(digitChars, char)) {
			if (char === "0") {
				state = "flagsStart";
			} else {
				currentTokenStart = index;
				++index;
				state = "parameter";
			}
		} else if (char === "%") {
			placeholder.type = "%";
			literals.push(formatString.slice(literalStart, literalEnd));
			literalStart = ++index;
			placeholder.content = formatString.slice(literalEnd, index);
			placeholders.push(placeholder);
			state = "literal";
		} else {
			state = "flagsStart";
		}
	},

	parameter: function () {
		if (hasOwnProperty.call(digitChars, char)) {
			++index;
		} else if (char === "$") {
			placeholder.parameter = Number(formatString.slice(currentTokenStart, index));
			++index;
			state = "flagsStart";
		} else {
			index = currentTokenStart;
			state = "widthStart";
		}
	},

	flagsStart: function () {
		if (hasOwnProperty.call(flagChars, char)) {
			currentTokenStart = index;
			++index;
			state = "flags";
		} else {
			state = "widthStart";
		}
	},

	flags: function () {
		if (hasOwnProperty.call(flagChars, char)) {
			++index;
		} else {
			placeholder.flags = formatString.slice(currentTokenStart, index);
			state = "widthStart";
		}
	},

	widthStart: function () {
		if (char === "*") {
			++index;
			if (placeholder.parameter) {
				// Invalid configuration
				state = "literal";
			} else {
				placeholder.width = char;
				state = "precisionStart";
			}
		} else if (hasOwnProperty.call(digitChars, char)) {
			currentTokenStart = index;
			++index;
			state = "width";
		} else {
			state = "precisionStart";
		}
	},

	width: function () {
		if (hasOwnProperty.call(digitChars, char)) {
			++index;
		} else {
			placeholder.width = Number(formatString.slice(currentTokenStart, index));
			state = "precisionStart";
		}
	},

	precisionStart: function () {
		if (char === ".") {
			++index;
			state = "precisionValueStart";
		} else {
			state = "lengthStart";
		}
	},

	precisionValueStart: function () {
		if (char === "*") {
			++index;
			if (placeholder.parameter) {
				// Invalid configuration
				state = "literal";
			} else {
				placeholder.precision = char;
				state = "lengthStart";
			}
		} else if (hasOwnProperty.call(digitChars, char)) {
			currentTokenStart = index;
			++index;
			state = "precision";
		} else {
			state = "literal";
		}
	},

	precision: function () {
		if (hasOwnProperty.call(digitChars, char)) {
			++index;
		} else {
			placeholder.precision = Number(formatString.slice(currentTokenStart, index));
			state = "lengthStart";
		}
	},

	lengthStart: function () {
		if (
			hasOwnProperty.call(lengthChars, char) &&
			hasOwnProperty.call(typeChars, formatString[index + 1])
		) {
			++index;
			placeholder.length = char;
			state = "length";
		} else {
			state = "type";
		}
	},

	length: function () {
		if (
			((placeholder.length === "h" && char === "h") ||
				(placeholder.length === "l" && char === "l")) &&
			hasOwnProperty.call(typeChars, formatString[index + 1])
		) {
			++index;
			placeholder.length += char;
		}
		state = "type";
	},

	type: function () {
		if (hasOwnProperty.call(typeChars, char)) {
			placeholder.type = char;
			literals.push(formatString.slice(literalStart, literalEnd));
			literalStart = ++index;
			placeholder.content = formatString.slice(literalEnd, index);
			placeholders.push(placeholder);
		}
		state = "literal";
	}
};

var checkParameterIndexing = function () {
	var placeholderParameters = [];
	placeholders.forEach(function (placeholderItem) {
		if (placeholderItem.parameter) placeholderParameters.push(placeholderItem.parameter);
	});
	if (!placeholderParameters.length) return true;
	if (placeholderParameters.length !== placeholders.length) return false;
	var currentParameter = 0;
	return placeholderParameters
		.sort(function (parameter1, parameter2) { return parameter1 - parameter2; })
		.every(function (parameter) {
			if (parameter !== currentParameter && parameter !== currentParameter + 1) return false;
			currentParameter = parameter;
			return true;
		});
};

module.exports = function (input) {
	formatString = ensureString(input);
	state = "literal";
	index = 0;
	literalStart = 0;
	literals = [];
	placeholders = [];
	var length = input.length;

	// eslint-disable-next-line no-unmodified-loop-condition
	while (index < length) {
		char = input[index];
		states[state]();
	}
	literals.push(formatString.slice(literalStart, length));

	return {
		literals: literals,
		placeholders: placeholders,
		isParameterIndexingValid: checkParameterIndexing(placeholders)
	};
};
