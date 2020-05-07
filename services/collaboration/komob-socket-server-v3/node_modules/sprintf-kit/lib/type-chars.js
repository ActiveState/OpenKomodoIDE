// Allowed placeholder type chars

"use strict";

var aFrom        = require("es5-ext/array/from")
  , primitiveSet = require("es5-ext/object/primitive-set");

module.exports = primitiveSet.apply(
	null, aFrom("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")
);
