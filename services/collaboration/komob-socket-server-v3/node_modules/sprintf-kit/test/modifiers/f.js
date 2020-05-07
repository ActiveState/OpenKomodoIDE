"use strict";

var test     = require("tape")
  , modifier = require("../../modifiers/f");

test("modifiers.f", function (t) {
	t.equal(
		modifier({ valueOf: function () { return "32.23"; } }), "32.23",
		"Should resolve float representation for non-number value"
	);
	t.equal(modifier(32.34), "32.34", "Should resolve float representation for number directly");
	t.equal(
		modifier("32.14hg"), "32.14", "Should resolve float representation for string numeric value"
	);
	t.equal(modifier(Infinity), "Infinity", "IShould resolve Inifity for Infinity");
	t.equal(
		modifier(Object.create(null))[0], "<",
		"Should resolve meaningful error string for non-corcible value"
	);
	t.end();
});
