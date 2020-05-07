"use strict";

var test            = require("tape")
  , requireUncached = require("ncjsm/require-uncached");

test("lib/setupVisibility: Defaults", function (t) {
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

	setupEnv("bla", [""]);

	t.equal(log.info.isEnabled, false);
	t.equal(log.notice.isEnabled, true);

	t.end();
});
