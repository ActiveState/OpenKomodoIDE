"use strict";

var test     = require("tape")
  , modifier = require("../../modifiers/s");

test("modifier.s", function (t) {
	t.equal(
		modifier({ toString: function () { return "marko"; } }), "marko",
		"Should resolve string representation for non-string value"
	);
	t.equal(modifier("barko"), "barko", "Should resolve string representation for string");
	t.equal(
		modifier(Object.create(null))[0], "<",
		"Should resolve meaningful error string for non-corcible value"
	);
	t.end();
});
