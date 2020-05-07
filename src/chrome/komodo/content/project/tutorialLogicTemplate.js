// Sample content, edit, delete, do whatever you like
(function() {
    
    /**
     * Called when the tutorial starts, right after the tutorial panel
     * is initialized but before the first step is rendered
     */
    this.start = function() {}
    
    /**
     * Called before the step is changed, you can get the current step
     * with require("tutorials")._getActive().step.
     *
     * Steps are always incremental. To go back a step the active step
     * counter is decreased and then this function gets called.
     * 
     * @returns {Boolean} Returning false stops execution
     */
    this.preStep = function() {}
    
    /**
     * Called after a step has changed.
     *
     * See this.preStep() for further details
     */
    this.step = function() {}
    
    /**
     * Called before the tutorial is closed and the tutorial ends.
     * 
     * @returns {Boolean} Returning false stops execution
     */
    this.preClose = function() {}
    
    /**
     * Called after the tutorial is closed.
     *
     * See this.preClose() for further details.
     */
    this.close = function() {}
    
    /**
     * A custom validation function that can be hooked up in
     * your tutorial meta information.
     * 
     * @returns {Boolean|String} Return true to pass, anything else to fail
     *
     * If you return a string it will be used as the error message.
     */
    // this.myValidationFunction = function() {}
    
    /**
     * Custom callback function, can be used in markdown
     */
    this.myCallback = function() { window.alert("My callback!"); }
    
}).apply(module.exports);