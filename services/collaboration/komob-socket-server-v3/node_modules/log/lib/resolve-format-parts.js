"use strict";

var getPartsResolver = require("sprintf-kit/get-parts-resolver")
  , modifiers        = require("./printf-modifiers");

module.exports = getPartsResolver(modifiers);
