"use strict";

var test            = require("tape")
  , requireUncached = require("ncjsm/require-uncached");

test("lib/getMasterWriter", function (t) {
	var data = requireUncached(
		[
			require.resolve("../../"), require.resolve("../../lib/abstract-writer"),
			require.resolve("../../lib/private/logger-prototype"),
			require.resolve("../../lib/private/logger-prototype/namespace-props"),
			require.resolve("../../lib/emitter"), require.resolve("../../lib/get-master-writer"),
			require.resolve("../../lib/setup-visibility")
		],
		function () {
			return {
				getMasterWriter: require("../../lib/get-master-writer"),
				Writer: require("../../lib/abstract-writer")
			};
		}
	);

	var getMasterWriter = data.getMasterWriter, Writer = data.Writer;

	t.test("Should return null if no writer registered", function (t) {
		t.equal(getMasterWriter(), null);
		t.end();
	});

	t.test("Should reject registration of non writer instance", function (t) {
		t.throws(function () { getMasterWriter.register({}); }, "is not a LogWriter");
		t.end();
	});

	t.test("Should return registered writer after it's registered", function (t) {
		var writer = new Writer({});
		t.equal(getMasterWriter(), writer);
		t.end();
	});

	t.test("Should crash on following registration", function (t) {
		t.throws(function () { getMasterWriter.register({}); }, "Cannot register");
		t.end();
	});
	t.end();
});
