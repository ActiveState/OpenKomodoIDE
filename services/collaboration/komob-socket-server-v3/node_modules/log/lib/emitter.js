"use strict";

var ee = require("event-emitter");

// Emitter of log events on which log writers depend
module.exports = ee();
