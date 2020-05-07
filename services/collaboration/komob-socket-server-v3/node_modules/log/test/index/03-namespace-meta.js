"use strict";

var test            = require("tape")
  , requireUncached = require("ncjsm/require-uncached");

test("(main): Namespace meta", function (t) {
	var log;

	requireUncached(
		[require.resolve("../../"), require.resolve("../../lib/private/logger-prototype")],
		function () { log = require("../.."); }
	);

	t.test("Should expose .isNamespaceInitialized(ns) method that", function (t) {
		log.get("marko:barko");
		t.equal(log.isNamespaceInitialized("fbafaafa"), false, "returns false for non setup ns");
		t.equal(log.isNamespaceInitialized("marko"), true, "returns true for setup ns");
		t.equal(
			log.isNamespaceInitialized("marko:barko"), true, "returns true for setup nested ns"
		);
		t.equal(
			log.get("marko").isNamespaceInitialized("barko"), true,
			"returns true on nested logger for setup ns"
		);
		t.end();
	});

	t.test("Should expose .getAllInitializedNamespaces() method that expose", function (t) {
		t.deepEqual(log.getAllInitializedNamespaces(), [log.get("marko")], "All child namespaces");
		t.end();
	});

	t.end();
});
