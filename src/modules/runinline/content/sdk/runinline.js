(function() {

    const log       = require("ko/logging").getLogger("runinline")
    const {Cc, Ci, Cu}  = require("chrome");
    const prefs     = require("ko/prefs");
    const editor    = require("ko/editor");
    const views     = require("ko/views");
    const shell     = require("ko/shell");
    const ioFile    = require("ko/file");

    this.run = function()
    {
        if ( ! editor.scimoz())
        {
            var locale = "Cannot run code without a file open.";
            require("notify/notify").interact(locale, "commands", {priority: "warning"});
            return;
        }
        
        if (editor.getSelection())
            return this._runSelection();
        else
            return this._runFile();
    }
    
    this._runSelection = function(selection = null, language = null, description = null)
    {
        var system = require("sdk/system");
        
        if ( ! selection)
            selection = editor.getSelection();
        
        var tempFile = ioFile.join(system.pathFor('TmpD'), "ko-runinline.buffer");
        var stream = ioFile.open(tempFile, "w");
        if (stream.closed)
        {
            var locale = "Could not write to temp file, is your disk full?";
            require("notify").send(locale, "commands", {priority: "warning"});
            return;
        }
        
        stream.write(selection);
        stream.close();
        
        if ( ! description)
            description = "Running selection"
        
        this._runFile(tempFile, language, description);
    }
    
    this._runFile = function(filePath = null, language = null, description = null)
    {
        var view = views.current();
        
        if ( ! filePath && ( ! view.file || view.koDoc.isDirty))
        {
            return this._runSelection(editor.getValue(), language, "Running buffer (unsaved)");
        }
        
        if ( ! language)
            language = view.language;
            
        if (language == "JavaScript")
            language = "Node.js"; // Todo: Automate with prefs
            
        if ("_run" + language in this)
            return this["_run" + language](filePath);
        
        var invoker;
        if ("@activestate.com/koInvocation;1?type=" + language in Cc)
            invoker = Cc["@activestate.com/koInvocation;1?type=" + language].createInstance();
        
        if ( ! invoker)
        {
            var locale = "Cannot run code for this type of file, please select a supported language.";
            require("notify/notify").interact(locale, "commands", {priority: "warning"});
            return;
        }
        
        var exe = JSON.parse(invoker.getExecutable(true));
        var argv = exe.argv;
        var env = exe.env || {};
        var script;
        
        var _env = shell.getEnv();
        for (let k of Object.keys(_env))
        {
            if (k in env) 
                continue;
            env[k] = _env[k];
        }
        
        if (filePath)
            script = [ioFile.basename(filePath)];
        else if (exe.script.length)
        {
            filePath = exe.script[0];
            script = exe.script; // exe.script can contain some custom parameters depending on the prefs for this file
        }
        else if (view.filePath)
        {
            filePath = view.filePath;
            script = [ioFile.basename(view.filePath)];
        }
        else
        {
            log.error("Cannot detect filepath");
            return;
        }
        
        if ( ! description)
            description = "Running " + ioFile.basename(filePath);
        
        var file = argv.shift();
        shell.exec(file, {
            argv: argv.concat(script),
            env: env,
            cwd: ioFile.dirname(filePath),
            readable: description,
            runIn: "hud"
        });
    }
    
    //this._runJavaScript = function(filePath)
    //{
    //    if ( ! filePath)
    //    {
    //        var view = views.current();
    //        filePath = view.filePath;
    //    }
    //    
    //    var file = ioFile.open(filePath, "r");
    //    var contents = file.read();
    //    file.close();
    //    
    //    var listeners = {
    //        stdout: [],
    //        stderr: [],
    //        close: []
    //    }
    //    
    //    var call = function(type, data)
    //    {
    //        for (listener of listeners[type])
    //            listener(data);
    //    }
    //    
    //    var process = {
    //        stderr: { on: function(type, listener) { listeners.stderr.push(listener); } },
    //        stdout: { on: function(type, listener) { listeners.stderr.push(listener); } },
    //        on: function(type, listener) { if (type in listeners) listeners[type].push(listener); },
    //        kill: function() {}
    //    }
    //    shell._showOutputInHud(process, "js sandbox");
    //    
    //    var console = require("ko/console");
    //    var log = function(prefix, value)
    //    {
    //        if ( ! value) value = prefix;
    //        call("stdout", console._stringify(value));
    //    }
    //    
    //    var ctx = window.wrappedJSObject;
    //    ctx.console = {
    //        log: log,
    //        warn: log.bind(null, "Warning: "),
    //        info: log.bind(null, "Info: "),
    //        debug: log.bind(null, "Debug: "),
    //        error: log.bind(null, "Error: ")
    //    }
    //    
    //    var sandbox = Cu.Sandbox(ctx);
    //    sandbox.console = ctx.console;
    //    
    //    try
    //    {
    //        Cu.evalInSandbox(contents, sandbox);
    //    } catch (e)
    //    {
    //        call("stderr", e.message);
    //        log.exception(e);
    //    }
    //    call("close");
    //}
   
}).apply(module.exports);