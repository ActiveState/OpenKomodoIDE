"use strict";

var test            = require("tape")
  , requireUncached = require("ncjsm/require-uncached");

test("lib/setupVisibility: Affects loggers created later", function (t) {
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

	log.debug.get("e1:d");
	log.warning.get("e2:e");
	log.error.get("foo");
	log.warning.get("e1");

	setupEnv("error", ["e1", "-e1:d", "n1:d", "-n1:d:foo:*"]);

	t.equal(log.info.isEnabled, false, "Disables level logger deep below level threshold");

	t.test("Applies debug namespace map for level loggers below threshold", function (t) {
		t.equal(log.info.get("e1").isEnabled, true, "Enables directly mentioned namespace");
		t.equal(
			log.info.get("e1:foo").isEnabled, true,
			"Enables children of directly mentioned namespace"
		);
		t.equal(
			log.info.get("e1:d").isEnabled, false,
			"Disables mentioned directly but negated namespace"
		);
		t.equal(
			log.info.get("e1:d:foo").isEnabled, false,
			"Disables children of mentioned directly but negated namespace"
		);
		t.equal(
			log.info.get("n1").isEnabled, false, "Parent remains disabled when child is enabled"
		);
		t.equal(log.info.get("n1:d").isEnabled, true, "Enables directly mentioned deep namespace");
		t.equal(
			log.info.get("n1:d:foo").isEnabled, false,
			"Handles trailing asterisk as an instruction to be applied on parent"
		);
		t.equal(log.info.get("e2").isEnabled, false, "Not mentioned namespaces remain disabled");
		t.end();
	});

	t.end();
});
