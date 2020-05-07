"use strict";

var toShortString = require("type/lib/to-short-string")
  , isLogger      = require("./is-logger");

module.exports = function (logger) {
	if (isLogger(logger)) return logger;
	throw new TypeError(toShortString(logger) + " is not a logger");
};
