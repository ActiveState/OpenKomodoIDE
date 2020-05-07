"use strict";

var isPlainFunction = require("type/plain-function/is");

module.exports = function (logger) {
	if (!isPlainFunction(logger)) return false;
	if (typeof logger.level !== "string") return false;
	return typeof logger.isNamespaceInitialized === "function";
};
