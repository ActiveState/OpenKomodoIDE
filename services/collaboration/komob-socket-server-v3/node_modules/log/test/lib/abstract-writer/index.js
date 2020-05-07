"use strict";

var test            = require("tape")
  , resolveUncached = require("./_resolve-uncached");

test("lib/abstract-writer", function (t) {
	t.test(function (t) {
		var data = resolveUncached();
		var log = data.log;
		var LogWriter = data.LogWriter;
		var logWriter = new LogWriter({ LOG_TIME: "1" });
		var isInvoked = false;
		log("not enabled");
		t.equal(isInvoked, false, "Should not write logs of disabled loggers");
		try {
			log.error.get("elo")("foo bar");
			throw new Error("Unexpected");
		} catch (error) {
			t.equal(
				error.message, "Not implemented!", "Should crash on not implemented writeMessage"
			);
		}

		logWriter.writeMessage = function (event) {
			var timePrefix = event.message.slice(0, 5);
			t.equal(/^\.\d{3} $/.test(timePrefix), true, "Should expose timestamp on LOG_TIME");
			t.equal(
				event.message.slice(5),
				log.error.get("elo").levelMessagePrefix +
					" " +
					log.error.get("elo").namespaceMessagePrefix +
					" foo bar",
				"Should write logs for enabled loggers"
			);
			isInvoked = true;
		};
		log.error.get("elo")("foo bar");
		t.equal(isInvoked, true, "Should write logs immediately");
		t.end();
	});
	t.test(function (t) {
		t.plan(6);
		var data = resolveUncached();
		var log = data.log;
		var LogWriter = data.LogWriter;
		var emitter = data.emitter;
		t.throws(
			function () { LogWriter(); }, "cannot be invoked without new",
			"Shold enforce new invocation"
		);
		var logWriter = new LogWriter({}, { defaultNamespace: "elo" });
		var isInvoked = false;
		logWriter.writeMessage = function (event) {
			t.equal(
				event.message, log.error.get("elo").levelMessagePrefix + " foo bar",
				"Should not write default namespace"
			);
			isInvoked = true;
		};
		log.error.get("elo")("foo bar");
		t.equal(isInvoked, true, "Should write logs immediately");
		logWriter.writeMessage = function (event) {
			t.equal(
				event.message, log.warning.levelMessagePrefix + " miszka",
				"Should handle no namespace case"
			);
		};
		log.warning("miszka");
		logWriter.writeMessage = function (event) {
			t.equal(
				event.message, log.error.levelMessagePrefix + " :bar miszka2",
				"Should handle nested namespace with default namesapce"
			);
		};
		log.error.get("elo:bar")("miszka2");
		logWriter.writeMessage = function (event) {
			t.equal(event.message, "overriden", "Should not regenerate message");
		};
		emitter.emit("log", { logger: log.error, message: "overriden" });
	});
	t.end();
});
