"use strict";

var toShortString = require("type/lib/to-short-string");

var masterWriter = null;

module.exports = function () { return masterWriter; };
module.exports.register = function (writer) {
	if (masterWriter) throw new Error("Cannot register: Master log writer already registered");
	if (!writer || typeof writer.writeMessage !== "function") {
		throw new Error(toShortString(writer) + "is not a LogWriter instance");
	}
	return (masterWriter = writer);
};
