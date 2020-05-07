"use strict";

var test            = require("tape")
  , requireUncached = require("ncjsm/require-uncached");

test("lib/setupVisibility: Global '*' enables all debug logs", function (t) {
	var log, setupEnv;

	requireUncached(
		[
			require.resolve("../../.."), require.resolve("../../../lib/emitter"),
			require.resolve("../../../lib/setup-visibility"),
			require.resolve("../../../lib/private/logger-prototype"),
			require.resolve("../../../lib/private/logger-prototype/namespace-props")
		],
		function () {
			log = require("../../..");
			setupEnv = require("../../../lib/setup-visibility");
		}
	);

	setupEnv("error", ["*"]);

	t.test("Affects already created loggers", function (t) {
		t.equal(log.debug.isEnabled, true, "Disables level logger deep below level threshold");
		t.end();
	});

	t.test("Affects loggers created later:", function (t) {
		t.equal(log.info.isEnabled, true, "Disables level logger deep below level threshold");
		t.end();
	});

	t.end();
});
