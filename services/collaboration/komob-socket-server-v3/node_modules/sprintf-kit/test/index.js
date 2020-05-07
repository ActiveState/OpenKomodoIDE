"use strict";

var test        = require("tape")
  , modifierD   = require("../modifiers/d")
  , modifierS   = require("../modifiers/s")
  , getResolver = require("../");

test("(main)", function (t) {
	t.test("Should resolve", function (t) {
		// eslint-disable-next-line id-length
		var resolve = getResolver({ d: modifierD, s: modifierS });
		t.equal(resolve("foo raz", "marko"), "foo raz", "No placeholders");
		t.equal(resolve("foo %s %d", "marko", 12), "foo marko 12", "Placeholders");
		t.equal(resolve(12, 13), "", "Non-string first argument without rest");

		resolve = getResolver({
			d: modifierD,
			// eslint-disable-next-line id-length
			s: modifierS,
			rest: function (args, data) { return (data ? " " : "") + args.join("-"); }
		});

		t.equal(
			resolve("foo %s", "marko", 12, "elo"), "foo marko 12-elo",
			"Arguments overflow with rest handling"
		);
		t.equal(resolve(12, 13), "12-13", "Non-string first argument with rest");
		t.end();
	});
	var resolve = getResolver({ d: modifierD, literal: function (str) { return str + "foo"; } });
	t.equal(resolve("mar %d ko", 12), "mar foo12 kofoo", "Shouold support 'literal' modifier");
	t.equal(resolve("marlo"), "marlofoo", "Shoud support 'literal' modifier with no placeholder");

	t.throws(
		function () { getResolver({ foo: modifierD }); }, TypeError, "Reject invalid modifiers map"
	);

	t.end();
});
