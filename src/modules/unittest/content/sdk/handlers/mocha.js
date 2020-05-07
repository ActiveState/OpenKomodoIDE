(function() {
    
    const customHandler = require("unittest/handlers/custom");
    const prefs     = require("ko/prefs");
    
    this.handler = require("unittest/unittest").getHandler("mocha");
    
    this.run = customHandler.run.bind(this);
    
    this.onStderr = (data, opts) =>
    {
        if (data.indexOf('"mocha-ko-tap-reporter" reporter not found') !== -1)
        {
            this.installRequirements(opts);
        }
    };
    
    this.installRequirements = (opts) =>
    {
        var message = "" +
            "To run Mocha unit tests in Komodo you need to install the 'mocha-ko-tap-reporter' module.\n" +
            "Would you like Komodo to install this module for you?\n\n" +
            "The following command will be executed:\n\n" +
            " > npm install mocha-ko-tap-reporter\n\n" +
            "This command will be executed in: " + opts.config.getString("path");
            
        if (require("ko/dialogs").confirm(message))
        {
            var npm = prefs.getString("npmDefaultInterpreter", "npm") || "npm";
            
            require("ko/shell").exec(npm + " install mocha-ko-tap-reporter",
            {
                cwd: opts.config.getString("path"),
                runIn: "hud"
            }).on("close", (code) =>
            {
                if (code === 0)
                {
                    var w = require("ko/windows").getMain();
                    $(".shell-output", w).remove();
                    
                    require("unittest/unittest").run(opts.config, opts.callback, opts.completionCallback);
                }
            });
            
        }
    };
    
}).apply(module.exports);
