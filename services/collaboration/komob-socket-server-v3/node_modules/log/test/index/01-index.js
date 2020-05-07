"use strict";

var test = require("tape")
  , log  = require("../../index");

test("(main)", function (t) {
	t.test("Should by default", function (t) {
		t.equal(log.level, "info", "be at 'info' level");
		t.end();
	});

	t.equal(log.info, log, "Should expose default 'debug' level at 'debug' property");

	t.test("Should allow to create loggers of other levels", function (t) {
		var currentLog = log.get("foo").error;

		t.test("which expose", function (t) {
			t.equal(currentLog.level, "error", "expected level");
			t.equal(currentLog.namespace, "foo", "expected namespace");
			t.deepEqual(currentLog.namespaceTokens, ["foo"], "expected namespace tokens list");
			t.equal(currentLog.info, log.get("foo"), "Other levels in same namespace");
			t.equal(currentLog.error, currentLog, "Current level at it's name property");
			t.end();
		});

		t.end();
	});

	t.test("Should expose .isLevelInitialized(level) method that", function (t) {
		t.equal(
			log.isLevelInitialized("foo"), false, "returns false on non setup  not predefined level"
		);
		t.equal(
			log.isLevelInitialized("critical"), false, "returns false on non setup predefined level"
		);
		t.equal(log.isLevelInitialized("error"), true, "returns true on setup predefined level");
		t.equal(log.isLevelInitialized("info"), true, "return true on self level");
		t.equal(
			log.get("foorkot").isLevelInitialized("error"), false,
			"returns false if there's no setup level logger for given namespace"
		);
		t.end();
	});

	t.test("Should expose .getAllInitializedLevels() method that expose", function (t) {
		t.deepEqual(
			log.getAllInitializedLevels(), [log, log.warning, log.error],
			"All setup levels on top level logger"
		);
		t.deepEqual(
			log.get("getlevel-test").getAllInitializedLevels(), [log.get("getlevel-test")],
			"Only levels setup within given ns scope"
		);
		t.end();
	});

	t.test(
		"Should create single (reusable) logger instances per level/name configuration",
		function (t) {
			t.equal(log, log.info);
			t.notEqual(log, log.debug);
			t.equal(log.info, log.info);
			t.equal(log.info, log.info.info);
			t.end();
		}
	);

	t.equal(log.warn, log.warning, "Should alias 'warn' level to 'warning'");

	t.test("Should expose known (syslog) levels", function (t) {
		t.equal(typeof log.info, "function");
		t.equal(typeof log.notice, "function");
		t.equal(typeof log.warning, "function");
		t.equal(typeof log.error, "function");
		t.end();
	});

	t.test("Should expose level index", function (t) {
		t.equal(log.notice.levelIndex, 2);
		t.equal(log.error.levelIndex, 0);
		t.end();
	});

	t.test("Should expose level root", function (t) {
		t.equal(log.notice.get("foo:bar").levelRoot, log.notice);
		t.equal(log.error.levelRoot, log.error);
		t.equal(log.warning.get("elo").levelRoot, log.warning);
		t.end();
	});

	t.end();
});
