"use strict";

var test     = require("tape")
  , modifier = require("../../modifiers/i");

test("modifier.i", function (t) {
	t.equal(
		modifier({ valueOf: function () { return "32.23"; } }), "32",
		"Should resolve integer representation for non-number value"
	);
	t.equal(modifier(32.34), "32", "Should resolve integer representation for number value");
	t.equal(
		modifier("32.14hg"), "32", "Should resolve integer representation for string numeric value"
	);
	t.equal(modifier(Infinity), "Infinity", "Should resolve Infinity for infinity");
	t.equal(
		modifier(Object.create(null))[0], "<",
		"Should resolve meaningful error string for non-corcible value"
	);
	t.end();
});
