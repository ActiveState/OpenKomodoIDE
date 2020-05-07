"use strict";

var d                  = require("d")
  , formatParts        = require("sprintf-kit/format-parts")
  , resolveFormatParts = require("../../resolve-format-parts");

module.exports = {
	resolveMessageTimestamp: d(function (event) {
		if (!this.timestampResolver) return;
		event.messageTimestamp = this.timestampResolver();
	}),
	resolveMessageContent: d(function (event) {
		event.messageContent = formatParts(resolveFormatParts.apply(null, event.messageTokens));
	}),
	resolveMessageTokens: d(function (event) {
		this.resolveMessageTimestamp(event);
		this.resolveMessageContent(event);
	}),
	resolveMessage: d(function (event) {
		var logger = event.logger;
		event.message = [
			event.messageTimestamp, logger.levelMessagePrefix, logger.namespaceMessagePrefix,
			event.messageContent
		]
			.filter(Boolean)
			.join(" ");
	}),
	writeMessage: d(function (eventIgnored) { throw new Error("Not implemented!"); })
};
