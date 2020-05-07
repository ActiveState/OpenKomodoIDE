"use strict";

var test            = require("tape")
  , requireUncached = require("ncjsm/require-uncached");

test("(main): Namespace", function (t) {
	var log;

	requireUncached(
		[require.resolve("../../"), require.resolve("../../lib/private/logger-prototype")],
		function () { log = require("../.."); }
	);

	t.test("Should by default", function (t) {
		t.equal(log.namespace, null, "point no namespace");
		t.deepEqual(log.namespaceTokens, [], "have empty namespace tokens list");
		t.end();
	});

	t.test(
		"Should allow to create namespaced loggers (debug library style) via .get(name)",
		function (t) {
			var currentLog = log.get("marko");
			t.test("which expose", function (t) {
				t.equal(currentLog.namespace, "marko", "expected namespace");
				t.deepEqual(
					currentLog.namespaceTokens, ["marko"], "expected namespace tokens list"
				);
				t.end();
			});

			t.end();
		}
	);

	t.throws(
		function () { log.get("marko elo"); }, TypeError, "Should throw on invalid namespace names"
	);

	t.test("Should allow to nest namespaced loggers", function (t) {
		t.test("via colon separated tokens passed to .get(name)", function (t) {
			var currentLog = log.get("marko:barko");

			t.test("which expose", function (t) {
				t.equal(currentLog.level, "info", "expected level");
				t.equal(currentLog.namespace, "marko:barko", "expected namespace");
				t.deepEqual(
					currentLog.namespaceTokens, ["marko", "barko"], "expected namespace tokens list"
				);
				t.end();
			});

			t.end();
		});

		t.test("via nested calls to .get(name)", function (t) {
			var currentLog = log.get("marko").get("barko");

			t.test("which expose", function (t) {
				t.equal(currentLog.level, "info", "expected level");
				t.equal(currentLog.namespace, "marko:barko", "expected namespace");
				t.deepEqual(
					currentLog.namespaceTokens, ["marko", "barko"], "expected namespace tokens list"
				);
				t.end();
			});

			t.end();
		});
		t.end();
	});

	t.test(
		"Should create single (reusable) logger instances per namespace configuration",
		function (t) {
			t.equal(log.get("foo"), log.get("foo"));
			t.notEqual(log.get("foo"), log.get("bar"));
			t.notEqual(log.get("foo"), log.get("foo").get("foo"));
			t.end();
		}
	);

	t.end();
});
