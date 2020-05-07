"use strict";

var test            = require("tape")
  , requireUncached = require("ncjsm/require-uncached");

test(
	"(main): Should provide enable/disable functionality on level/name configuration",
	function (t) {
		var log;

		requireUncached(
			[require.resolve("../../"), require.resolve("../../lib/private/logger-prototype")],
			function () { log = require("../.."); }
		);

		t.equal(log.get("enabletest").isEnabled, true, "Should be enabled by default");

		var restore = log.get("enabletest").disable().restore;
		t.equal(
			typeof restore, "function", "disable() should return object with `restore` function"
		);
		t.equal(
			log.get("enabletest").isEnabled, false, "Should be disabled after `disable()` call"
		);

		t.equal(
			log.get("enabletest").get("foo").isEnabled, false,
			"New nested names should inherit setting"
		);
		restore();
		t.equal(log.get("enabletest").isEnabled, true, "`restore` should bring previous state");

		restore = log.get("enabletest").enable().restore;
		t.equal(
			typeof restore, "function", "enable() should return object with `restore` function"
		);
		t.equal(
			log.get("enabletest").isEnabled, true, "Should remain enabled after `enable()` call"
		);
		log.get("enabletest").enable();
		t.equal(
			log.get("enabletest").isEnabled, true,
			"Trying to set same state again should have no effect"
		);
		restore();
		log.get("enabletest").isEnabled = false;
		t.equal(
			log.get("enabletest").isEnabled, false,
			"It should be possible to change state by direct setting of isEnabled"
		);
		delete log.get("enabletest").isEnabled;

		t.equal(
			log.get("enabletest").get("foo").isEnabled, true,
			"Existing nested names should inherit setting"
		);

		restore = log.get("enabletest").get("foo").disable().restore;
		t.equal(log.get("enabletest").get("foo").isEnabled, false, "Should work on nested names");
		t.equal(
			log.get("enabletest").isEnabled, true,
			"Settings on nested names should not leak to parent loggers"
		);

		var restore2 = log.get("enabletest").enable().restore;
		t.equal(
			log.get("enabletest").get("foo").isEnabled, true,
			"Calling `enable` on parent should affect all children unconditionally"
		);
		restore2();
		restore();
		t.end();
	}
);
