"use strict";

var noop       = require("es5-ext/function/noop")
  , objForEach = require("es5-ext/object/for-each")
  , d          = require("d");

module.exports = {
	// Should logger logs be exposed?
	isEnabled: d("ew", true),

	// Enables logger and all its namespaced children
	enable: d(function () { return this._setEnabledState(true); }),

	// Disables logger and all its namespaced children
	disable: d(function () { return this._setEnabledState(false); }),

	_setEnabledState: d(function (state) {
		var cache = [];
		this._setEnabledStateRecursively(state, cache);
		var result = {
			restore: function () {
				cache.forEach(function (data) {
					if (data.hasDirectSetting) data.logger.isEnabled = !state;
					else delete data.logger.isEnabled;
				});
				result.restore = noop;
			}
		};
		return result;
	}),
	_setEnabledStateRecursively: d(function (newState, cache) {
		if (this.isEnabled !== newState) {
			cache.push({ logger: this, hasDirectSetting: hasOwnProperty.call(this, "isEnabled") });
			this.isEnabled = newState;
		}
		objForEach(this._childNamespaceLoggers, function (namespacedLogger) {
			namespacedLogger._setEnabledStateRecursively(newState, cache);
		});
	})
};
