"use strict";

var requireUncached = require("ncjsm/require-uncached");

module.exports = function () {
	return requireUncached(
		[
			require.resolve("../../../"), require.resolve("../../../lib/abstract-writer"),
			require.resolve("../../../lib/private/logger-prototype"),
			require.resolve("../../../lib/private/logger-prototype/namespace-props"),
			require.resolve("../../../lib/emitter"),
			require.resolve("../../../lib/get-master-writer"),
			require.resolve("../../../lib/setup-visibility")
		],
		function () {
			return {
				log: require("../../../"),
				LogWriter: require("../../../lib/abstract-writer"),
				emitter: require("../../../lib/emitter")
			};
		}
	);
};
