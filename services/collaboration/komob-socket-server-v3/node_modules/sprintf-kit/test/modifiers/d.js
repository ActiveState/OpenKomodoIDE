"use strict";

var test     = require("tape")
  , modifier = require("../../modifiers/d");

test("modifiers.d", function (t) {
	t.equal(
		modifier({ valueOf: function () { return "32.23"; } }), "32.23",
		"Should resolve numeric representation for non-number value"
	);
	t.equal(modifier(32.34), "32.34", "Should resolve numeric representation for non-number value");
	t.equal(modifier(Infinity), "Infinity", "Should resolve Inifity for Infinity");
	t.equal(
		modifier(Object.create(null))[0], "<",
		"Should resolve meaningful error string for non-corcible value"
	);
	t.end();
});
