"use strict";

var test               = require("tape")
  , resolveFormatParts = require("../../lib/resolve-format-parts");

var normalizeParts = function (parts) {
	parts.substitutions = parts.substitutions.map(function (substitution) {
		return substitution.value;
	});
	return parts;
};

test("lib/resolveFormatParts", function (t) {
	t.test("Should return format parts", function (t) {
		t.deepEqual(normalizeParts(resolveFormatParts("foo bar %d %f", 20.2, 21.21)), {
			literals: ["foo bar ", " ", ""],
			substitutions: ["20.2", "21.21"],
			rest: null
		});
		t.end();
	});

	t.end();
});
