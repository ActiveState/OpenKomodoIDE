(function() {
    
    const customHandler = require("unittest/handlers/custom");
    const prefs     = require("ko/prefs");
    
    this.handler = require("unittest/unittest").getHandler("rspec");
    
    this.run = customHandler.run.bind(this);
    
    this.onStderr = (data, opts) =>
    {
        if (data.indexOf('cannot load such file -- rspec_tap/formatter') !== -1)
        {
            this.installRequirements(opts);
        }
    };
    
    this.installRequirements = (opts) =>
    {
        var message = "" +
            "To run rspec tests in Komodo you need to install the 'rspec_tap' gem.\n" +
            "Would you like Komodo to install this gem for you?\n\n" +
            "The following command will be executed:\n\n" +
            " > gem install rspec_tap\n\n" +
            "This command will be executed in: " + opts.config.getString("path");
            
        if (require("ko/dialogs").confirm(message))
        {
            var gem = prefs.getString("gemDefaultInterpreter", "gem") || "gem";
            
            require("ko/shell").exec(gem + " install rspec_tap",
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
