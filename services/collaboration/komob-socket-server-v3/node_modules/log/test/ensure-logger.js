"use strict";

var test         = require("tape")
  , log          = require("../")
  , ensureLogger = require("../ensure-logger");

test("ensureLogger", function (t) {
	t.equal(ensureLogger(log), log, "Should return logger when logger is an argument");
	t.throws(
		function () {
			ensureLogger(function () { return "foo"; });
		},
		TypeError,
		"Should throw on non logger values"
	);
	t.end();
});
