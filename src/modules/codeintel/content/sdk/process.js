var storage = require("ko/session-storage").get("codeintel-process").storage;
if (storage.instance)
{
    module.exports = storage.instance;
}
else
{

(function()
{
    storage.instance = this;
    
    const {Cc, Ci}  = require("chrome");
    const log = require("ko/logging").getLogger("codeintel/process");
    const shell = require("ko/shell");
    const koFile = require("ko/file");
    const koDirSvc = Cc["@activestate.com/koDirs;1"].getService();
    const koResolve = Cc["@activestate.com/koResolve;1"].getService(Ci.koIResolve);
    const system = require("sdk/system");
    const codeintel = require("codeintel/codeintel");

    var pathsep = system.platform.indexOf('win') == -1 ? ":" : ";";
    var firstStart = true;
    
    log.setLevel(10);
    
    this.STATUS_STOPPED = "stopped";
    this.STATUS_STARTING = "starting";
    this.STATUS_STARTED = "started";
    this.STATUS_RESTARTING = "restarting";
    
    var callbacks = { started: [], stopped: [] };
    var locals = {
        status: this.STATUS_STOPPED,
        process: null,
        port: null,
        pid: null
    };
    log.setLevel(10);
    
    this.get = (key) =>
    {
        return locals[key];
    };
    
    this.start = () =>
    {
        if (locals.status != this.STATUS_STOPPED && locals.status != this.STATUS_RESTARTING)
            return;
        
        locals.status = this.STATUS_STARTING;
        
        log.info("Starting CodeIntel");
        
        var pythonExe = koDirSvc.pythonExe;
        var pythonLib = koFile.join(koFile.dirname(pythonExe), "..", "lib", "python2.7");
        var addonPath = koResolve.uriToPath("chrome://codeintel/content/codeintel.js");
        addonPath = koFile.join(koFile.dirname(addonPath), '..');
        var logPath = koFile.join(system.pathFor("ProfD"), "..", "codeintel3.log");
        var dbPath = koFile.join(system.pathFor("ProfD"), "..", "codeintel3.db");

        var libDir = koFile.join(addonPath, 'pylib', 'codeintel', 'lib');
        
        var envLibDir = 'lib';
        if (system.platform.indexOf('win') != -1)
            envLibDir = koFile.join("Lib", "site-packages");
        envLibDir = koFile.join(addonPath, 'pylib', 'codeintel', 'env', envLibDir);
    
        var env = shell.getEnv();
        env.PYTHONPATH = [pythonLib, koDirSvc.pythonDBGPDir, libDir, envLibDir].join(pathsep);
        
        log.debug("PYTHONPATH: " +  env.PYTHONPATH);
        
        var args = [koFile.join(libDir, 'server.py'), '-l', logPath, '-f', dbPath];

        if (firstStart)
            args = args.concat(['-t', 'true']);
            
        firstStart = false;

        locals.process = shell.run(pythonExe, args, {cwd: libDir, env: env});
        
        locals.process.on('stdout', onStdout);
        locals.process.on('stderr', onStderr);
        locals.process.on('close', onClose);
    };
    
    this.stop = () =>
    {
        log.info("Stopping CodeIntel Process");

        locals.status = this.STATUS_STOPPING;

        if (locals.process)
        {
            if (system.platform.indexOf('win') == -1)
            {
                // process.kill will NOT work, possibly mozilla SDK bug?
                if (locals.pid != locals.process.pid)
                {
                    log.debug("Killing parent process " + locals.process.pid);
                    var killproc = shell.run("kill", ["-s", "SIGTERM", ""+locals.process.pid]);
                    killproc.stderr.on('data', log.error);
                }

                log.debug("Killing process " + locals.pid);
                var killproc2 = shell.run("kill", ["-s", "SIGTERM", ""+locals.pid]);
                killproc2.stderr.on('data', log.error);
            }

            log.debug("Sending SIGTERM");
            locals.process.kill('SIGTERM');
        }
    };
    
    this.restart = () =>
    {
        log.info("Restarting CodeIntel");

        locals.status = this.STATUS_RESTARTING;
        codeintel.stopSocket();
        this.start();
    };

    this.on = (action, callback) =>
    {
        if ( ! (action in callbacks))
            return false;
        
        callbacks[action].push(callback);
    };
    
    var onStdout = (data) =>
    {
        log.debug(`stdout: ` + data);
        var match;
        
        if ( ! locals.port)
        {
            match = data.trim().match(/(?:\s|^)port:(\d+)(?:\s|$)/);
            if (match)
            {
                locals.port = match[1];
            }
        }

        if ( ! locals.pid)
        {
            match = data.trim().match(/(?:\s|^)pid:(\d+)(?:\s|$)/);
            if (match)
            {
                locals.pid = match[1];
                onStarted(); // pid comes last
            }
        }
    };
    
    var onStderr = (data) =>
    {
        log.warn(`stderr: ` + data);
    };
    
    var onStarted = () =>
    {
        locals.status = this.STATUS_STARTED;
        log.info(`CodeIntel started on port ${locals.port}`);
        
        callback("started");
    };
    
    var onClose = (code) =>
    {
        log.info(`onClose called, code: ` + code);
        
        locals.pid = null;
        locals.port = null;

        if (locals.status == this.STATUS_STARTED)
        {
            log.info("Process stopped without a request to stop it, restarting ..");
            this.restart();
        }
        else
        {
            locals.status = this.STATUS_STOPPED;
            callback("stopped", code);
        }
    };
    
    var callback = (action, value) =>
    {
        log.debug(`Calling callbacks for: ${action}, number: ${callbacks[action].length}`);
        for (let cb of callbacks[action])
        {
            cb(value);
        }
    };
    
}).apply(module.exports);

}