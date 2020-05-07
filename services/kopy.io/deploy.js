(function() {

    var logger = console;

    this.init = function(customLogger)
    {
        logger = customLogger;
    }

    this.run = function(params, done)
    {
        logger.info("======================================================================");
        logger.info("Running job " + __dirname);
        logger.info("======================================================================");
        logger.debug(params);

        var exec = require('child_process').exec;
        var commands = [
            "npm prune",
            "npm install",
            "bower install"
        ];

        var environment = process.env;
        environment.PATH = environment.PATH + ":/usr/local/bin:/usr/bin:~/.nvm/v0.10.25/bin/";

        var envVars = require(__dirname + "/../kopy-" + params.branch + ".env.js");
        for (var env in envVars)
        {
            environment[env] = envVars[env];
        }

        var runCommand = function(index)
        {
            if ( ! (index in commands)) return done();

            var command = commands[index];
            logger.info("Executing " + command);
            exec(command, {
                maxBuffer: 1000*1024,
                env: environment,
                cwd: __dirname
            },
            function(err, stdo, stde)
            {
                if (err) return done(err);
                logger.debug("Result: " + stdo + stde + "\n");
                runCommand(++index);
            });
        }

        runCommand(0);
    };

    this.schedule = function(branch, cron, deploy)
    {
        logger.info("Running deployment for " + __dirname + " : " + branch);

        deploy({
            name: 'kopy-' + branch,
            path: __dirname,
            repository: 'kopy.io',
            branch: branch
        });
    };

}).apply(module.exports);
