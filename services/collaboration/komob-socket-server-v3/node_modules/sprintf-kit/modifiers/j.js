"use strict";

// eslint-disable-next-line consistent-return
var CIRCULAR_JSON_ERROR_MESSAGE = (function () {
	try {
		var a = {};
		a.a = a;
		JSON.stringify(a);
	} catch (err) {
		return err.message;
	}
}());

module.exports = function (value/*, placeholder, argIndex, args*/) {
	try {
		var result = JSON.stringify(value, null, 2);
		if (typeof result === "string") return result;
		return "<non serializable>";
	} catch (e) {
		if (e.message === CIRCULAR_JSON_ERROR_MESSAGE) {
			return "<circular>";
		}
		return "<invalid>";
	}
};
