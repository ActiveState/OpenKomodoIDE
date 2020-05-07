"use strict";

var test  = require("tape")
  , parse = require("../parse");

test("parse", function (t) {
	t.test("Should parse text with", function (t) {
		t.deepEqual(
			parse("foo %s"),
			{
				literals: ["foo ", ""],
				placeholders: [{ type: "s", content: "%s" }],
				isParameterIndexingValid: true
			},
			"Single simple placeholder at the end"
		);

		t.deepEqual(
			parse("%s foo"),
			{
				literals: ["", " foo"],
				placeholders: [{ type: "s", content: "%s" }],
				isParameterIndexingValid: true
			},
			"Single simple placeholder at the beginning"
		);

		t.deepEqual(
			parse("foo %s bar"),
			{
				literals: ["foo ", " bar"],
				placeholders: [{ type: "s", content: "%s" }],
				isParameterIndexingValid: true
			},
			"Single simple placeholder in a middle"
		);

		t.deepEqual(
			parse("foo bar"),
			{ literals: ["foo bar"], placeholders: [], isParameterIndexingValid: true },
			"No placeholder"
		);

		t.deepEqual(
			parse("%s"),
			{
				literals: ["", ""],
				placeholders: [{ type: "s", content: "%s" }],
				isParameterIndexingValid: true
			},
			"Just placeholder"
		);

		t.deepEqual(
			parse("foo %%"),
			{
				literals: ["foo ", ""],
				placeholders: [{ type: "%", content: "%%" }],
				isParameterIndexingValid: true
			},
			"Escape at the end"
		);

		t.deepEqual(
			parse("%% foo"),
			{
				literals: ["", " foo"],
				placeholders: [{ type: "%", content: "%%" }],
				isParameterIndexingValid: true
			},
			"Escape at the beginning"
		);

		t.deepEqual(
			parse("foo %% bar"),
			{
				literals: ["foo ", " bar"],
				placeholders: [{ type: "%", content: "%%" }],
				isParameterIndexingValid: true
			},
			"Escape in a middle"
		);

		t.deepEqual(
			parse("%%"),
			{
				literals: ["", ""],
				placeholders: [{ type: "%", content: "%%" }],
				isParameterIndexingValid: true
			},
			"Just escape"
		);

		t.deepEqual(
			parse("%s foo %d"),
			{
				literals: ["", " foo ", ""],
				placeholders: [{ type: "s", content: "%s" }, { type: "d", content: "%d" }],
				isParameterIndexingValid: true
			},
			"Multiple simple placeholders at the edge"
		);

		t.deepEqual(
			parse("foo %s bar %d zed"),
			{
				literals: ["foo ", " bar ", " zed"],
				placeholders: [{ type: "s", content: "%s" }, { type: "d", content: "%d" }],
				isParameterIndexingValid: true
			},
			"Multiple simple placeholders in a middle"
		);

		t.deepEqual(
			parse("foo %_ marko"),
			{ literals: ["foo %_ marko"], placeholders: [], isParameterIndexingValid: true },
			"Invalid placeholder"
		);

		t.deepEqual(
			parse("foo %1$d"),
			{
				literals: ["foo ", ""],
				placeholders: [{ parameter: 1, type: "d", content: "%1$d" }],
				isParameterIndexingValid: true
			},
			"Parameter in placeholder"
		);

		t.deepEqual(
			parse("foo %1$d %s"),
			{
				literals: ["foo ", " ", ""],
				placeholders: [
					{ parameter: 1, type: "d", content: "%1$d" }, { type: "s", content: "%s" }
				],
				isParameterIndexingValid: false
			},
			"Inconsistent parameters in placeholders"
		);

		t.deepEqual(
			parse("foo %+d"),
			{
				literals: ["foo ", ""],
				placeholders: [{ flags: "+", type: "d", content: "%+d" }],
				isParameterIndexingValid: true
			},
			"Single flag in placeholder"
		);

		t.deepEqual(
			parse("foo %0d"),
			{
				literals: ["foo ", ""],
				placeholders: [{ flags: "0", type: "d", content: "%0d" }],
				isParameterIndexingValid: true
			},
			"Single 0 flag in placeholder"
		);

		t.deepEqual(
			parse("foo %0+d"),
			{
				literals: ["foo ", ""],
				placeholders: [{ flags: "0+", type: "d", content: "%0+d" }],
				isParameterIndexingValid: true
			},
			"Multiple flags in placeholder"
		);

		t.deepEqual(
			parse("foo %20d"),
			{
				literals: ["foo ", ""],
				placeholders: [{ width: 20, type: "d", content: "%20d" }],
				isParameterIndexingValid: true
			},
			"Width in placeholder"
		);
		t.deepEqual(
			parse("foo %*d"),
			{
				literals: ["foo ", ""],
				placeholders: [{ width: "*", type: "d", content: "%*d" }],
				isParameterIndexingValid: true
			},
			"Dynamic width in placeholder"
		);
		t.deepEqual(
			parse("foo %1$*d"),
			{ literals: ["foo %1$*d"], placeholders: [], isParameterIndexingValid: true },
			"Dynamic width with parameter mix up (invalid)"
		);

		t.deepEqual(
			parse("foo %.20d"),
			{
				literals: ["foo ", ""],
				placeholders: [{ precision: 20, type: "d", content: "%.20d" }],
				isParameterIndexingValid: true
			},
			"Precision in placeholder"
		);
		t.deepEqual(
			parse("foo %.*d"),
			{
				literals: ["foo ", ""],
				placeholders: [{ precision: "*", type: "d", content: "%.*d" }],
				isParameterIndexingValid: true
			},
			"Dynamic precision in placeholder"
		);
		t.deepEqual(
			parse("foo %1$.*d"),
			{ literals: ["foo %1$.*d"], placeholders: [], isParameterIndexingValid: true },
			"Dynamic precision with parameter mix up (invalid)"
		);

		t.deepEqual(
			parse("foo %.xd"),
			{ literals: ["foo %.xd"], placeholders: [], isParameterIndexingValid: true },
			"Invalid precision in placeholder"
		);

		t.deepEqual(
			parse("foo %ld"),
			{
				literals: ["foo ", ""],
				placeholders: [{ length: "l", type: "d", content: "%ld" }],
				isParameterIndexingValid: true
			},
			"Single length in placeholder"
		);
		t.deepEqual(
			parse("foo %ll"),
			{
				literals: ["foo ", ""],
				placeholders: [{ length: "l", type: "l", content: "%ll" }],
				isParameterIndexingValid: true
			},
			"Single length with confusing type in placeholder"
		);
		t.deepEqual(
			parse("foo %lld"),
			{
				literals: ["foo ", ""],
				placeholders: [{ length: "ll", type: "d", content: "%lld" }],
				isParameterIndexingValid: true
			},
			"Double length in placeholder"
		);

		t.deepEqual(
			parse("foo %23$+ 30.30hhhmarko"),
			{
				literals: ["foo ", "marko"],
				placeholders: [
					{
						parameter: 23,
						flags: "+ ",
						width: 30,
						precision: 30,
						length: "hh",
						type: "h",
						content: "%23$+ 30.30hhh"
					}
				],
				isParameterIndexingValid: false
			},
			"Full characteristics placeholder (double chars case)"
		);

		t.deepEqual(
			parse("foo %1$ 3.3hh marko"),
			{
				literals: ["foo ", " marko"],
				placeholders: [
					{
						parameter: 1,
						flags: " ",
						width: 3,
						precision: 3,
						length: "h",
						type: "h",
						content: "%1$ 3.3hh"
					}
				],
				isParameterIndexingValid: true
			},
			"Full characteristics placeholder (single chars case)"
		);
		t.end();
	});
});
