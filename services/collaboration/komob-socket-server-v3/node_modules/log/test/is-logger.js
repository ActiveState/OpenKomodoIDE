"use strict";

var test     = require("tape")
  , log      = require("../")
  , isLogger = require("../is-logger");

test("isLogger", function (t) {
	t.equal(isLogger(log), true, "Should return true on logger");
	t.equal(isLogger(), false, "Should return false on non-value");
	t.equal(
		isLogger(function () { return "foo"; }), false,
		"Should return false on non-logger function "
	);
	t.end();
});
