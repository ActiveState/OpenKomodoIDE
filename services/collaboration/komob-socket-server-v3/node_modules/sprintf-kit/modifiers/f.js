"use strict";

module.exports = function (value/*, placeholder, argIndex, args*/) {
	try { return String(isNaN(value) ? parseFloat(value) : Number(value)); }
	catch (e) { return "<invalid>"; }
};
