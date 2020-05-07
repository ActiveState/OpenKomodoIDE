"use strict";

var getPartsResolver = require("./get-parts-resolver")
  , formatParts      = require("./format-parts");

module.exports = function (modifiers) {
	var resolveParts = getPartsResolver(modifiers);

	return function (formatIgnored/*, ...params*/) {
		return formatParts(resolveParts.apply(null, arguments));
	};
};
