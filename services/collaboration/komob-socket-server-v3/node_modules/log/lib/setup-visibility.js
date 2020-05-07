"use strict";

var ensureArray  = require("type/array/ensure")
  , isValue      = require("type/value/is")
  , ensureString = require("type/string/ensure")
  , includes     = require("es5-ext/array/#/contains")
  , endsWith     = require("es5-ext/string/#/ends-with")
  , logger       = require("./private/logger-prototype")
  , emitter      = require("./emitter")
  , levels       = require("../levels");

var resolveDebugNamespaces = function (debugNamespacesTokens, debugNamespacesSettings) {
	ensureArray(debugNamespacesTokens).forEach(function (ns) {
		ns = ensureString(ns).trim();
		if (!ns) return;
		var isEnabled = ns[0] !== "-";
		if (!isEnabled) ns = ns.slice(1);
		if (endsWith.call(ns, ":*")) ns = ns.slice(0, -2);
		ns = ns.split(":").filter(Boolean).join(":");
		debugNamespacesSettings[ns] = isEnabled;
	});
};

module.exports = function (thresholdLevelName, debugNamespacesTokens) {
	// Resolve intended logging level configuration
	// On this level and above all logs will be exposed
	if (!thresholdLevelName || !includes.call(levels, thresholdLevelName)) {
		thresholdLevelName = "notice";
	}
	var thresholdLevelIndex = levels.indexOf(thresholdLevelName);

	// Resolve namespace based debug logging configuration
	// Applies only to logs below level threshold (will expose logs just for chosen namespaces)
	var debugNamespacesSettings = Object.create(null);
	resolveDebugNamespaces(debugNamespacesTokens, debugNamespacesSettings);
	var debugNamespacesList = Object.keys(debugNamespacesSettings);

	// Apply resolved settings on existing loggers
	levels.forEach(function (levelName, levelIndex) {
		// If logger for given level not initialized yet, skip
		if (!logger.isLevelInitialized(levelName)) return;
		// If logs of given level are meant to be exposed, skip (default is to expose)
		if (levelIndex <= thresholdLevelIndex) return;

		// Hide logs for given level
		var levelLogger = logger[levelName];
		levelLogger.isEnabled = false;

		// Eventually expose logs for some namespaces according to passed configuration
		debugNamespacesList.forEach(function (ns) {
			if (ns === "*") {
				levelLogger.isEnabled = debugNamespacesSettings[ns];
			} else if (levelLogger.isNamespaceInitialized(ns)) {
				levelLogger.get(ns).isEnabled = debugNamespacesSettings[ns];
			}
		});
	});

	// Ensure settings are applied on any new logger
	emitter.on("init", function (event) {
		var newLogger = event.logger;
		if (!newLogger.namespace && newLogger.levelIndex > thresholdLevelIndex) {
			// Root level logger, apply threshold level settings
			newLogger.isEnabled = false;
		}

		// Apply eventual debug namespace visibility
		var isEnabled = debugNamespacesSettings[newLogger.namespace || "*"];
		if (isValue(isEnabled)) newLogger.isEnabled = isEnabled;
	});
};
