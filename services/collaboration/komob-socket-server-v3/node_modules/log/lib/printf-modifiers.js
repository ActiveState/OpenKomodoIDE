"use strict";

var isObject        = require("type/object/is")
  , stringModifier  = require("sprintf-kit/modifiers/s")
  , decimalModifier = require("sprintf-kit/modifiers/d")
  , floatModifier   = require("sprintf-kit/modifiers/f")
  , integerModifier = require("sprintf-kit/modifiers/i")
  , jsonModifier    = require("sprintf-kit/modifiers/j");

module.exports = {
	d: decimalModifier,
	f: floatModifier,
	i: integerModifier,
	j: jsonModifier,
	o: jsonModifier,
	O: jsonModifier,
	s: stringModifier,
	rest: function (args, formatStringData) {
		var str = formatStringData ? " " : "";
		str += args
			.map(function (arg) { return isObject(arg) ? jsonModifier(arg) : stringModifier(arg); })
			.join(" ");
		return str;
	}
};
