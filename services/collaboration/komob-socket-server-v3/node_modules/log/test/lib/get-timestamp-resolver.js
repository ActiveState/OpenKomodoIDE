"use strict";

var test                 = require("tape")
  , getTimestampResolver = require("../../lib/get-timestamp-resolver");

var isRelativeTimestamp = RegExp.prototype.test.bind(/(?:\d{1,2})?\.\d{1,3}$/)
  , isAbsoluteTimestamp = RegExp.prototype.test.bind(
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
	);

test("lib/getTimestampResolver", function (t) {
	t.test("Resolve relative by default", function (t) {
		t.equal(isRelativeTimestamp(getTimestampResolver()()), true);
		t.end();
	});

	t.test("Resolve absolute for 'abs' setting", function (t) {
		t.equal(isAbsoluteTimestamp(getTimestampResolver("abs")()), true);
		t.end();
	});

	t.test("Ignore invalid mode setting", function (t) {
		t.equal(isRelativeTimestamp(getTimestampResolver("foo")()), true);
		t.end();
	});

	t.end();
});
