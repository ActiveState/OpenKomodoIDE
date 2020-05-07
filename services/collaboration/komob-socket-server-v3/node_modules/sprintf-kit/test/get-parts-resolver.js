"use strict";

var test        = require("tape")
  , modifierD   = require("../modifiers/d")
  , modifierS   = require("../modifiers/s")
  , getResolver = require("../get-parts-resolver");

var normalizeParts = function (parts) {
	parts.substitutions = parts.substitutions.map(function (substitution) {
		return substitution.value;
	});
	return parts;
};

test("getPartsResolver", function (t) {
	t.test("Should resolve", function (t) {
		// eslint-disable-next-line id-length
		var resolve = getResolver({ d: modifierD, s: modifierS });
		t.deepEqual(
			normalizeParts(normalizeParts(resolve("foo raz", "marko"))),
			{ literals: ["foo raz"], substitutions: [], rest: null }, "No placeholders"
		);
		t.deepEqual(
			normalizeParts(resolve("foo %s", "marko")),
			{ literals: ["foo ", ""], substitutions: ["marko"], rest: null }, "Single placeholder"
		);
		t.deepEqual(
			normalizeParts(resolve("foo %s %d", "marko", 12)),
			{ literals: ["foo ", " ", ""], substitutions: ["marko", "12"], rest: null },
			"Two placeholders"
		);
		t.deepEqual(
			normalizeParts(resolve("foo %s %d", "marko", 12, "elo")),
			{ literals: ["foo ", " ", ""], substitutions: ["marko", "12"], rest: null },
			"Two placeholders with arguments overflow and no rest handling defined"
		);
		t.deepEqual(
			normalizeParts(resolve("foo %s %d", "marko")),
			{ literals: ["foo ", " ", ""], substitutions: ["marko", "%d"], rest: null },
			"foo marko %d", "Two placeholders with argument missing"
		);
		t.deepEqual(
			normalizeParts(resolve("foo %2$s %1$d", 12, "bar")),
			{ literals: ["foo ", " ", ""], substitutions: ["bar", "12"], rest: null },
			"Parameters swap"
		);
		t.deepEqual(
			normalizeParts(resolve("foo %*d", 10, 12)),
			{ literals: ["foo ", ""], substitutions: ["12"], rest: null }, "Dynamic width"
		);
		t.deepEqual(
			normalizeParts(resolve("foo %.*d", 10, 12)),
			{ literals: ["foo ", ""], substitutions: ["12"], rest: null }, "Dynamic precision"
		);
		t.deepEqual(
			normalizeParts(resolve("foo %2$s %2$d", 12, "bar")),
			{
				literals: ["foo ", " ", ""],
				substitutions: [
					"[invalid placeholder parameters]", "[invalid placeholder parameters]"
				],
				rest: null
			},

			"Invalid parameters setup"
		);
		t.deepEqual(
			normalizeParts(resolve(12, 13)), { literals: [], substitutions: [], rest: null },
			"Non-string first argument without rest"
		);

		resolve = getResolver({
			d: modifierD,
			// eslint-disable-next-line id-length
			s: modifierS,
			rest: function (args, data) { return (data ? " " : "") + args.join("-"); }
		});

		t.deepEqual(
			normalizeParts(resolve("foo %s", "marko", 12, "elo")),
			{ literals: ["foo ", ""], substitutions: ["marko"], rest: " 12-elo" },
			"Arguments overflow with rest handling"
		);
		t.deepEqual(
			normalizeParts(resolve("foo %*s", 10, "marko", 12, "elo")),
			{ literals: ["foo ", ""], substitutions: ["marko"], rest: " 12-elo" },
			"Arguments overflow with rest handling and width shift"
		);
		t.deepEqual(
			normalizeParts(resolve("foo %x", "elo")),
			{ literals: ["foo ", ""], substitutions: ["%x"], rest: null },
			"Placeholder content on unknown type"
		);
		t.deepEqual(
			normalizeParts(resolve(12, 13)), { literals: [], substitutions: [], rest: "12-13" },
			"Non-string first argument with rest"
		);
		t.end();
	});

	t.throws(
		function () { getResolver({ foo: modifierD }); }, TypeError, "Reject invalid modifiers map"
	);

	t.end();
});
