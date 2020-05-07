"use strict";

var toInteger = require("es5-ext/number/to-integer");

module.exports = function (value/*, placeholder, argIndex, args*/) {
	try { return String(isNaN(value) ? parseInt(value, 10) : toInteger(value)); }
	catch (e) { return "<invalid>"; }
};
