(function() {
    
    const customHandler = require("unittest/handlers/custom");
    
    this.handler = require("unittest/unittest").getHandler("prove");
    
    this.run = customHandler.run.bind(this);
    
}).apply(module.exports);