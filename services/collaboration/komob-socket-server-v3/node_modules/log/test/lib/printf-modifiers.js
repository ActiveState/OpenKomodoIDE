"use strict";

var test            = require("tape")
  , printfModifiers = require("../../lib/printf-modifiers");

test("lib/printfModifiers", function (t) {
	t.test("Should expose 'd' modifier", function (t) {
		t.equal(printfModifiers.d(12.12), "12.12");
		t.end();
	});
	t.test("Should expose 'f' modifier", function (t) {
		t.equal(printfModifiers.f(12.12), "12.12");
		t.end();
	});
	t.test("Should expose 'i' modifier", function (t) {
		t.equal(printfModifiers.i(12.12), "12");
		t.end();
	});
	t.test("Should expose 'j' modifier", function (t) {
		t.equal(printfModifiers.j({ foo: "Bar" }), "{\n  \"foo\": \"Bar\"\n}");
		t.end();
	});
	t.test("Should expose 'o' modifier", function (t) {
		t.equal(printfModifiers.o({ foo: "Bar" }), "{\n  \"foo\": \"Bar\"\n}");
		t.end();
	});
	t.test("Should expose 'O' modifier", function (t) {
		t.equal(printfModifiers.O({ foo: "Bar" }), "{\n  \"foo\": \"Bar\"\n}");
		t.end();
	});
	t.test("Should expose 's' modifier", function (t) {
		t.equal(printfModifiers.s("elo"), "elo");
		t.end();
	});
	t.test("Should expose 'rest' modifier", function (t) {
		t.equal(printfModifiers.rest(["elo", { foo: "Bar" }]), "elo {\n  \"foo\": \"Bar\"\n}");
		t.equal(printfModifiers.rest(["elo"], "test"), " elo");
		t.end();
	});
	t.end();
});
