"use strict";

var test            = require("tape")
  , requireUncached = require("ncjsm/require-uncached");

test("(main): Events", function (t) {
	var testArgs = ["foo", 12, null, {}];

	var log, emitter;

	requireUncached(
		[
			require.resolve("../../"), require.resolve("../../lib/private/logger-prototype"),
			require.resolve("../../lib/emitter"),
			require.resolve("../../lib/private/logger-prototype/namespace-props")
		],
		function () {
			log = require("../..");
			emitter = require("../../lib/emitter");
		}
	);

	t.test(
		"When invoked should emit 'log' events on log.emitter, where event should expose",
		function (t) {
			emitter.once("log", function (event) {
				t.equal(event.logger, log, "target logger at 'event.logger' property");
				t.deepEqual(event.messageTokens, testArgs, "message tokens");
				t.end();
			});
			log.apply(null, testArgs);
		}
	);

	t.test("Should emit 'log' events for nested loggers", function (t) {
		var currentLog = log.get("foo").error;
		emitter.once("log", function (event) {
			t.equal(event.logger, currentLog, "target logger");
			t.deepEqual(event.messageTokens, testArgs, "message tokens");
			t.end();
		});
		currentLog.apply(null, testArgs);
	});

	t.test("Should emit 'log' events when disabled", function (t) {
		var restore = log.get("enabletest").get("foo").disable().restore;

		var isEnabled = true, passes = 0;
		emitter.on("log", function self(event) {
			t.equal(isEnabled, isEnabled);
			t.equal(event.logger, log);
			t.deepEqual(event.messageTokens, testArgs);
			if (++passes === 2) {
				emitter.off("log", self);
			}
		});
		t.equal(log.isEnabled, true);
		log.apply(null, testArgs);

		log.disable();
		isEnabled = false;
		t.equal(log.isEnabled, false);
		log.apply(null, testArgs);

		log.enable();
		isEnabled = true;
		restore();
		t.end();
	});

	t.test("Should emit 'init' events when", function (t) {
		t.test("new level logger instance is created", function (t) {
			var currentLog, caughtEvent;
			emitter.once("init", function (event) { caughtEvent = event; });
			currentLog = log.warn;
			t.equal(caughtEvent.logger, currentLog, "Event should expose initialized logger");
			t.end();
		});
		t.test("new name logger instance is created", function (t) {
			var currentLog, caughtEvent;
			emitter.once("init", function (event) { caughtEvent = event; });
			currentLog = log.get("othername4");
			t.equal(caughtEvent.logger, currentLog, "Event should expose initialized logger");
			t.end();
		});
		t.end();
	});

	t.end();
});
