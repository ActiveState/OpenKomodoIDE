(function() {
    
    const {Cc, Ci}  = require("chrome");
    const shell     = require("ko/shell");
    const runSvc    = Cc["@activestate.com/koRunService;1"].getService(Ci.koIRunService);
    const unittest  = require("unittest/unittest");
    const prefs     = require("ko/prefs");
    const timers    = require("sdk/timers");
    const w         = require("ko/windows").getMain();
    const _         = require("contrib/underscore");
    const ko        = w.ko;
    
    this.handler = unittest.getHandler("custom");
    
    // Not all interpreter prefs use the same name pattern, so we have to hard-code some
    const executablePrefs =
    {
        "go": "golangDefaultLocation",
        "python": "pythonDefaultInterpreter",
        "python3": "python3DefaultInterpreter"
    };

    this.run = function (config, callback, completionCb)
    {
        var handler = this.handler;
        var opts = {
            config: config,
            callback: callback,
            completionCallback: completionCb
        };

        var env = {
            cwd: config.getString("path")
        };

        var command = config.getString("command", handler.command);
        if ( ! command || !! handler.command)
            command = handler.command;
            
        command = ko.interpolate.interpolateString(command);
        
        var argv = runSvc.argvSplit(command);
        var exe = argv.shift();
        
        var prefName = exe + "InterpreterPath";
        if (exe in executablePrefs)
            prefName = executablePrefs[exe];

        exe = prefs.getString(prefName, exe) || exe;
        
        // Start our phpunit process
        var process = shell.run(exe, argv, env);
        
        // Prepare worker
        var parser = unittest.getParser(config.getString("parser", handler.parser));
        var profilerUri = require.resolve(parser.namespace);
        var worker = new w.Worker(profilerUri);

        var pending =
        {
            results: null,
            errors: null,
            stdout: null
        };
        var isComplete = false;
        var stopPending = false;

        var processPending = _.throttle(() =>
        {
            var results = null;
            var hasResults = !! pending.results;
            var hasMoreResults = false;
            var volume = prefs.getLong("unittest_throttle_volume", 100);

            if (hasResults)
            {
                results = _.pick(pending.results, Object.keys(pending.results).slice(0,volume));
                pending.results = _.pick(pending.results, Object.keys(pending.results).slice(volume));
                hasMoreResults = !! Object.keys(pending.results).length;
            }

            var state = ! hasMoreResults && isComplete ? "done" : "running";
            if (stopPending)
                state = "done";

            callback({results: results, errors: pending.errors, stdout: pending.stdout, state: state});

            if (results && "onResults" in this)
                this.onResults(results, opts);

            if (pending.stdout && "onStdout" in this)
                this.onStdout(pending.stdout, opts);
            pending.stdout = null;

            if (pending.errors && "onStderr" in this)
                this.onStderr(pending.errors, opts);
            pending.errors = null;
            
            if ( ! hasMoreResults || stopPending)
                pending.results = null;
            else
                processPending();

            if (state == "done")
            {
                worker.terminate();

                if ("onComplete" in this)
                    this.onComplete(opts);

                completionCb();
            }
        }, prefs.getLong("unittest_throttle_time", 250));
        
        worker.addEventListener("message", (e) =>
        {
            var results = e.data;
            
            pending.results = pending.results || {};
            for (let k in results)
            {
                if ( ! results.hasOwnProperty(k))
                    continue;

                pending.results[k] = results[k];
            }
            
            processPending();
        });

        // Received partial data
        process.on('stdout', (data) =>
        {
            worker.postMessage(data);
            
            pending.stdout = pending.stdout || "";
            pending.stdout += data;
            processPending();
        });

        // Received error message
        process.on('stderr', (data) =>
        {
            pending.errors = pending.errors || "";
            pending.errors += data;
            processPending();
        });
        
        process.on('error', (e) =>
        {
            if (e.message.indexOf("NS_ERROR_FILE_UNRECOGNIZED_PATH"))
            {
                var message = "" +
                    `The executable "${exe}" could not be found, please make sure it is properly installed.`;
                    
                require("ko/dialogs").alert(message);
            }
        });
        
        // Process closed (finished)
        process.on('close', _.debounce(() =>
        {
            isComplete = true;
            processPending();
        }, 250));
        
        return {
            stop: () =>
            {
                try
                {
                    process.kill("SIGTERM");
                } catch (e) {}

                stopPending = true;
                isComplete = true;

                processPending();
            }
        };
    };
    
}).apply(module.exports);
