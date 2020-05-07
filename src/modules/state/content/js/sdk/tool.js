/**
 * The ActiveState state tool SDK
 *
 * @module state/tool
 * @copyright (c) 2017 ActiveState Software Inc.
 * @license Mozilla Public License v. 2.0
 * @author ActiveState
 * @example
 * if (require("state/tool").isProject(pathToActiveStateProjectMaybe)) {
 *     require("state/tool").activate(pathToActiveStateProjectMaybe);
 * }
 *
 * callbacks passed into to any of the functions should have the following:
 * {
 *      onSuccess: myOnSuccessFnc, // If state cmd succeeded, returned 0
 *      onError: myOnErrorFnc, // If errors are output to stderr
 *      onFail: myOnFailFnc, // If the state cmd failed, returned 1
 * }
 *
 */
(function () {
    const {Cc, Ci} = require("chrome");
    const log = require("ko/logging").getLogger("tool.js");
    //log.setLevel(log.DEBUG);
    // For additional logging, have the user set the boolean pref `state.verbose.unsafe` to `true`
    // ko.prefs.setBoolean("state.verbose.unsafe", true)
    // THIS COULD PRINT PASSWORDS AND SECRET API KEYS. DO NOT HAVE THE USER SHARE THIS LOG PUBLICALLY.
    const w = require('ko/windows').getMain();
    const $ = require("ko/dom");
    const legacy = w.ko;
    const locale = require("ko/locale").use("chrome://state/locale/state.properties");
    const sh = require("ko/shell");
    const ajax = require("ko/ajax");
    const _ = require("contrib/underscore");
    const koFile = require("ko/file");
    const notify = require("notify/notify");
    const platformAuth = require("ko/auth");
    const sys = require("sdk/system");

    const profileDir = sys.pathFor("ProfD");
    const isUnix = sys.platform != "winnt";
    const envPrefId = "userEnvironmentStartupOverride";
    const configFile = "activestate";
    const confignames = ["activestate.yaml", "activestate.yml"];
    const prefs = require("ko/prefs");
    const getStateBin = () => { return prefs.getStringPref("statetoolDefaultbinary") || "state"; };
    this.VERBOSE = prefs.getBoolean("state.verbose", false);

    var local = {
        activeProject: null,
        activating: false,
        prompting: false,
    };
    
    var install = (callback) => {
        log.debug("installing");
        let installURL = prefs.getString("state.install.url");
        let installName = require("sdk/url").URL(installURL).path.split("/").pop();

        ajax.get(prefs.getString("state.install.url"), (status, response) => {
            if (status != 200) {
                log.error("Could not download state tool installer, response code: " + status + ", response: " + response);
                return;
            }

            log.debug("Received response: " + response);
            let [file, path] = koFile.openTempFile(installName, "w", false);
            file.write(response);
            file.close();

            var process;
            let installPath;
            if (isUnix) {
                log.debug("Installing on Unix")
                require("sdk/io/fs").chmodSync(path, parseInt("0755", 8)); // ensure file is executable
                process = sh.run(path, ["-n", "-f", "-t", koFile.join(profileDir, "state")]);
                installPath = koFile.join(profileDir, "state", "state");
            } else {
                log.debug("Installing on Windows")
                let env = getEnv();
                env["NOPROMPT_INSTALL"] = true;
                var binary = "C:\\WINDOWS\\SysNative\\WindowsPowerShell\\v1.0\\powershell.exe"; // have to force 64bit
                process = sh.run(binary, ["-ExecutionPolicy", "ByPass", "-File", path], { env: env });
                installPath = koFile.join(sh.lookupVar("APPDATA"), "ActiveState", "bin", "state.exe");
            }

            process.stdout.on('data', function (data)
            {
                log.debug('Stdout while running state tool installer: ' + data);
            });

            process.stderr.on('data', function (data)
            {
                log.warn('Stderr while running state tool installer: ' + data);
            });

            process.on('close', (code) => {
                log.debug("Install done: code: "+ code);
                log.debug("Installed location: " + installPath);
                if (koFile.exists(installPath)) {
                    log.debug("Install succeeded");
                    legacy.prefs.setString("statetoolDefaultbinary", installPath);
                    if (callback) {
                        callback();
                    }
                } else {
                    notify.send("State tool install failed.", "state", 
                    { 
                        duration: 10000,
                        priority: "now",
                        classlist: "state-error",
                        spinner: false,
                        panelMessage: "State tool install failed.  Please contact ActiveState support or review your logs.",
                    });
                }
            });
        });
    };

    this.installBackground = install;
    
    let exportPrivKey = (callerCallbacks) => {
        let callbacks = addDefaultCallbacks(callerCallbacks);
        let cmdArray = ["export", "private-key", "--output=editor.v0"];
        runSh(cmdArray, callbacks, { withCredentials: false });
    };

    this.exportPrivKey = (callerCallbacks) => {
        log.debug("authenticate");
        let credentials = platformAuth.getCredentials(platformAuth.userUrlForPWM);
        let totpCredentials = platformAuth.getCredentials(platformAuth.totpUrlForPWM);
        if ( ! credentials) {
            callerCallbacks.onFail(0, "You are not authenticated. Please restart Komodo if this problem persists.");
            return;
        }

        let authCallbacks = addDefaultCallbacks({
            onSuccess: () => exportPrivKey(callerCallbacks),
            onFail: callerCallbacks.onFail
        });

        // Need to authenticate with password in order for us to get a private key
        let cmdArray = ["auth", "--username", credentials.username, "--password", credentials.password, "--output=editor.v0"];
        if (totpCredentials && totpCredentials.password)
            cmdArray.push("--totp", totpCredentials.password);
        runSh(cmdArray, authCallbacks, { withCredentials: false });
    };

    var loadStatePrefs = () => {
        const stylesheet = require("ko/stylesheet");
        stylesheet.loadGlobal("less://state/skin/style/state.less");
        const locale = require("ko/locale");
        prefs.registerCategory(
            locale.get("prefs_title"),
            "chrome://state/content/prefs.xul",
            "uiSettingsItem"
        );
    };

    var loadJson = (string) => {
        if(prefs.getBoolean("state.verbose.unsafe", false))
            log.debug("Json String: "+string);
        try {
            return JSON.parse(string);
        } catch (e) {
            log.error(e);
            return;
        }
    };

    var getDefaultCallbacks = () => {
        return {
            onSuccess: () => { }, // Completion `msg`
            onStdout: () => { }, // `data` from stdout
            onError: log.warn, // `data` string from stderr
            onFail: (code, msg) => { log.error("Process exited with code '" + code + "'.  Error: " + msg); }, // Error `msg`
            procHandler: () => { }, // proc: The process started,  only supported by runSh
        };
    };

    // addDefaultCallbacks ensures we have the callbacks we're expecting
    var addDefaultCallbacks = (callerCallbacks) => {
        return _.extend(getDefaultCallbacks(), callerCallbacks);
    };

    /**
     * getConfigFile looks up the directory tree looking for
     * an activestate.yaml and returns the directory path it's found in
     */
    this.getConfigFile = (path) => {
        if (path == null || path == "" || ! koFile.exists(path))
            return null;
        // uriparse.URIToPath just incase it's a URI, which koFile can't handle
        path = legacy.uriparse.URIToPath(path);
        if (koFile.isFile(path))
            path = koFile.dirname(path);

        // not root ("/") of Unix of a Windows drive letter ("C:", "z:")
        let notRoot = isUnix ? () => path != "" : () => path.search(/[a-zA-Z]:$/) == -1;
        while (notRoot()) {
            let files = koFile.list(path);
            for (let f of files) {
                if (confignames.indexOf(f) != -1) {
                    return koFile.join(path, configFile + "." + (f.split(".")[1]));
                }
            }
            path = koFile.dirname(path);
        }

        return null;
    };

    this.getProjectDir = () => {
        if ( ! legacy.projects.manager.currentProject)
            return;
        
        let dir = legacy.uriparse.dirName(legacy.projects.manager.currentProject.url);

        if ( ! this.getConfigFile(dir)) 
            return;

        return dir;
    };

    this.isProject = (path) => {
        return !!this.getConfigFile(path);
    };

    this.deactivate = () => {
        local.activeProject = null;
    };

    var saveEnv = (env) => {
        let projectPrefs = prefs.project();
        if (projectPrefs.id != "project") {
            notify.send("Could not save activated state. Are you using a project?", "state", { priority: "error" });
            return;
        }

        let envCombined = getProjectEnv();

        envCombined = _.extend(envCombined, env);

        let envString = "";
        for (let k in envCombined) {
            if ( ! envCombined.hasOwnProperty(k))
                continue;
            if ( ! k || k == "" || k == "undefined" || k.indexOf("ACTIVESTATE_ACTIVATED") != -1)
                continue;
            envString += k + "=" + env[k] + "\n";
        }

        projectPrefs.setStringPref(envPrefId, envString);
        if (legacy.projects.manager.currentProject)
            legacy.projects.manager.currentProject.save();
    };

    var filterANSI = (data) => {
        if (data) {
            data = data.replace(/\u001B\[[0-9;]*m/g, "");
            data = data.replace(/\[\dA\[J/g, "");
        }
        return data;
    };

    var getPlacesOrProjectDir = () => {
        let path = sys.pathFor("Home");
        if (legacy.places && legacy.places.manager && legacy.places.manager.currentPlace)
            path = legacy.uriparse.URIToLocalPath(legacy.places.manager.currentPlace);
        if (legacy.projects.manager && legacy.projects.manager.currentProject)
            path = legacy.uriparse.dirName(legacy.projects.manager.currentProject.url);

        return path;
    };
    
    let envDictToStr = envDict => {
        let s = "";
        for (let key in envDict) {
            if ( ! envDict.hasOwnProperty(key))
                continue;
            s += key+"="+(envDict[key]+"").replace(/\n/g, "\\n") + "\n";
        }
        return s.trim();
    };

    // Run in ko/shell with option to run in Hud dialog
    // NON interactive
    // see ko/sdk/shell.sh.run docs for more details on `options`
    var runSh = (cmdArray, callbacks, options = {}) => {
        log.debug("runSh");
        // THIS CAN PRINT PASSWORD, APIKEYS, and other sensitive information to the users logs
        // Do NOT have them share these logs publically.
        if(prefs.getBoolean("state.verbose.unsafe", false))
        {
            log.debug("cmdArray: "+cmdArray);
            console.log("options");
            console.log(options);
            console.log("callbacks");
            console.log(callbacks);
        }

        let opts = _.extend(
            {
                cwd: getPlacesOrProjectDir(),
                env: getEnv(options.withCredentials === undefined ? true : false)
            }, options);

        callbacks = addDefaultCallbacks(callbacks);

        let proc = sh.run(getStateBin(),
            cmdArray,
            opts
        );

        let results = "";
        proc.stdout.on('data', (data) => {
            data = filterANSI(data);
            callbacks.onStdout(filterANSI(data));
            results = results + data;
        });

        let badResults = "";
        proc.stderr.on('data', (data) => {
            data = filterANSI(data);
            callbacks.onError(filterANSI(data));
            badResults = badResults + data;
        });

        // proc.kill() returns a `null` for `code` so if you manually kill
        // you're proc, we return success.
        proc.on('close', (code) => {
            log.debug("Cmd completed: "+cmdArray);
            if (!code) {
                callbacks.onSuccess(results);
            } else {
                callbacks.onFail(code, badResults, results);
            }
        });
        callbacks.procHandler(proc);
    };

    var getProjectEnv = () => {
        let projectPrefs = prefs.project();
        let envString = projectPrefs.getStringPref(envPrefId);
        let env = {};
        for (let line of envString.split("\n")) {
            let k, v = line.split("=");
            if ( !k || k == "" || k == "undefined")
                continue;
            env[k] = v;
        }
        return env;
    };

    var getEnv = (withCredentials = true) => {
        log.debug("getEnv");
        let env = sh.getEnv();
        env["ACTIVESTATE_CLI_CONFIGDIR"] = koFile.join(profileDir, "state");
        env["_DO_NOT_MERGE_ENV"] = true; // Hack to prevent koRun from merging in the parent env
        if (this.VERBOSE)
            env["VERBOSE"] = true;

        if (withCredentials) {
            let apiCredentials = platformAuth.getCredentials(platformAuth.apiKeyUrlForPWM);
            if (apiCredentials) 
                env["ACTIVESTATE_API_KEY"] = apiCredentials.password;
            else
                log.warn("Could not retrieve api key credentials");
            let privkeyCredentials = platformAuth.getCredentials(platformAuth.privkeyUrlForPWM);
            if (privkeyCredentials) 
                env["ACTIVESTATE_PRIVATE_KEY"] = privkeyCredentials.password;
            else 
                log.warn("Could not retrieve private key credentials");
        }

        // We don't ever want the state tool to error out thinking we're already in an activated state
        delete env["ACTIVESTATE_ACTIVATED"];
        delete env["ACTIVESTATE_ACTIVATED_ID"];

        return env;
    };

    // Run in the Komodo output pane
    // NON interactive
    var runTermPane = (cmdArray, callbacks, options = {}) => {
        log.debug("runTermPane");
        let opts = _.extend(
            {
                cwd: getPlacesOrProjectDir(),
                terminationCallback: (retval) => {
                    if (retval == 1) {
                        callbacks.onFail();
                    } else {
                        callbacks.onSuccess();
                    }
                    legacy.run.output.getTerminal().setAddTextCallback(null);
                },
                env: getEnv(options.withCredentials === undefined ? true : false)
            }, options);
        
        opts.env = envDictToStr(opts.env);
        
        if (this.VERBOSE)
            opts.env.VERBOSE = true;
        
        if(prefs.getBoolean("state.verbose.unsafe", false))
        {
            log.debug("cmdArray: "+cmdArray);
            console.log("options");
            console.log(options);
            console.log("opts.env");
            console.log(opts.env);
            console.log("callbacks");
            console.log(callbacks);
        }

        // Legacy terminal is used as ko/shell
        // has no way of injecting commands into the running process
        // which some state tool commands will require
        let terminal = legacy.run.output.getTerminal();

        //  This callback MUST implement koIAsyncCallback...
        //  so that complicates things a bit.
        terminal.setAddTextCallback(callbacks.onStdout);
        //terminal.active = true; // I just want a record of this to remind me
        // of the research i did into making the terminal pane interactive
        // Apparently koRunService just hucks the parts of the command in to a proess
        // as is and doesn't handle spaces in paths...fails 127 or file not found when
        // there is a space in the state bin path
        let bin = '"'+getStateBin()+'"';
        cmdArray.unshift(bin);
        let pid = legacy.run.command(cmdArray.join(" "), opts);
        callbacks.procHandler(pid);
    };

    // Run in an external terminal
    // For interactive processes
    // `options` are the same as the options taken by run_functions.js.command()
    // Check there for what all is possible.
    var runExternal = (cmdArray, callbacks, options = {}) => {
        log.debug("runExternal");
        let opts = _.extend({
            cwd: getPlacesOrProjectDir(),
            env: getEnv(options.withCredentials === undefined ? true : false),
            runIn: "new-console",
        }, options);

        // ko.run.command takes `env` as a string of key=value\nkey=value rather
        // than a dict
        opts.env = envDictToStr(opts.env);
        callbacks = addDefaultCallbacks(callbacks);
        if(prefs.getBoolean("state.verbose.unsafe", false))
        {
            log.debug("cmdArray: "+cmdArray);
            console.log("options");
            console.log(options);
            console.log("opts.env");
            console.log(opts.env);
            console.log("callbacks");
            console.log(callbacks);
        }

        // Apparently koRunService just hucks the parts of the command in to a proess
        // as is and doesn't handle spaces in paths...fails 127 or file not found when
        // there is a space in the state bin path
        let bin = '"'+getStateBin()+'"';
        cmdArray.unshift(bin);
        let pid = legacy.run.command(cmdArray.join(" "), opts);
        if (!success)
            callbacks.onFail("Command failed");
        else
            callbacks.onSuccess();
    };

    this.runScript = (name, callerCallbacks, args) => {
        log.debug("runScript");

        let cmdArray = ["run", name];
        if (args) {
            cmdArray = cmdArray.concat(args);
        }
        runExternal(cmdArray, callerCallbacks);
    };

    this.scripts = (callerCallbacks) => {
        log.debug("internal scripts");
        let cmdArray = ["scripts", "--output=editor.v0"];

        let callbacks = addDefaultCallbacks(callerCallbacks);
        callbacks.onSuccess = (results) => {
            let res = loadJson(results);
            if (typeof res == "undefined")
                callbacks.onFail("Could not load data from state tool.  Please see logs for details.");
            else
                callerCallbacks.onSuccess(res);
        };

        runSh(cmdArray, callbacks);
    };

    this.secrets = (callerCallbacks) => {
        log.debug("internal secrets");
        let cmdArray = ["secrets", "--output=editor.v0"];

        let callbacks = addDefaultCallbacks(callerCallbacks);
        callbacks.onSuccess = (results) => {
            let res = loadJson(results);
            if (typeof res == "undefined")
                callbacks.onFail("Could not load data from state tool.  Please see logs for details.");
            else
                callerCallbacks.onSuccess(res);
        };

        runSh(cmdArray, callbacks);
    };

    this.getSecret = (callerCallbacks, namespace) => {
        log.debug("internal getSecret");
        let cmdArray = ["secrets", "get", namespace, "--output=editor.v0"];

        let callbacks = addDefaultCallbacks(callerCallbacks);
        callbacks.onSuccess = (results) => {
            let res = loadJson(results);
            if (typeof res == "undefined")
                callbacks.onFail("Could not load data from state tool.  Please see logs for details.");
            else
                callerCallbacks.onSuccess(res);
        };

        runSh(cmdArray, callbacks);
    };

    this.organizations = (callerCallbacks) => {
        log.debug("internal organizations");
        let cmdArray = ["organizations", "--output=editor.v0"];

        let callbacks = addDefaultCallbacks(callerCallbacks);
        callbacks.onSuccess = (results) => {
            let res = loadJson(results);
            if (typeof res == "undefined")
                callbacks.onFail("Could not load data from state tool.  Please see logs for details.");
            else
                callerCallbacks.onSuccess(res);
        };

        runSh(cmdArray, callbacks);
    };

    this.getUser = (callerCallbacks) => {
        log.debug("internal getUser");
        let cmdArray = ["auth", "--output=editor.v0"];
        let callbacks = getDefaultCallbacks(callerCallbacks);

        callbacks.onSuccess = (results) => {
            let res = loadJson(results);
            if (typeof res == "undefined")
                callbacks.onFail("Could not load data from state tool.  Please see logs for details.");
            else
                callerCallbacks.onSuccess(res);
        };

        runSh(cmdArray, callbacks);
    };

    this.getJWT = (callerCallbacks) => {
        log.debug("internal getJWT");
        let cmdArray = ["export", "jwt", "--output=editor.v0"];
        runSh(cmdArray, callerCallbacks);
    };

    var focusNotification = (id) => {
        legacy.uilayout.toggleTab('notifications-widget', false);
        let nw = require("ko/windows").getWindowByUrl("chrome://komodo/content/notifications/notificationsWidget.xul");
        nw.focusNotificationByID(id);
    };

    var activateID = 0;
    // Runs 'state activate' and extract any envvars that get set and
    // save them in the Komodo Project Prefs
    var activate = (path, callerCallbacks) => {
        log.debug("activate 2");
        let cbs = addDefaultCallbacks(callerCallbacks);
        let id = "state-activate" + (activateID++);

        var notifyActivating = (stdout) => {
            notify.send("Downloading and Activating Runtime Environment ..", "state", 
            { 
                id: id, 
                duration: 100000, 
                priority: "now", 
                classlist: "state-info enabled", 
                spinner: true,
                command: () => focusNotification(id),
                details: filterANSI(stdout)
            });
        };

        var notifyFailure = (details) => {
            notify.send("Activation Failed! Click here for more info.", "state", 
            { 
                id: id, 
                priority: "error", 
                classlist: "state-error", 
                command: () => focusNotification(id),
                panelMessage: "Activation Failed!",
                details: details
            });
        };

        let onStdout = (stdout) => {
            notifyActivating(stdout);
            cbs.onStdout(stdout);
        };

        let processOutput = (stdout) => {
            if(prefs.getBoolean("state.verbose.unsafe", false))
                log.debug("Output to be processed: " + stdout);

            stdout = stdout.split('[activated-JSON]')[1];
            let env;
            try {
                env = JSON.parse(stdout);
            } catch (err) {
                notifyFailure(err + ". Output: " + stdout);
                return false;
            }
            return env;
        };

        let callbacks = {
            onStdout: onStdout,
            onSuccess: (stdout) => {
                local.activating = false;
                notify.send("Runtime Environment Ready!", "state", 
                { 
                    id: id, 
                    duration: 5000,
                    priority: "now", 
                    classlist: "state-info", 
                    command: () => focusNotification(id),
                    details: "" 
                });
                
                let env = processOutput(stdout);
                if ( ! env) 
                    return;
                
                saveEnv(env);
                local.activeProject = this.getProjectDir();
                cbs.onSuccess(stdout);
                $(w.document).trigger("state_activate_ok");
            },
            onFail: (code, stderr) => {
                notifyFailure(filterANSI(stderr));
                local.activating = false;
                cbs.onFail(code, stderr);
                $(w.document).trigger("state_activate_fail");
            },
        };

        notifyActivating("");

        let cmdArray = ["activate", "--path="+path, "--output=editor.v0"];
        runSh(cmdArray, callbacks);
    };

    // Try to detect a language to populate the dialog with
    // then open the add platform project wizard.  This will create a Komodo
    // Project at the same time
    this.createProject = (path) => {
        log.debug("createProject");
        log.debug("path: " + path);

        let lang = this.detectLanguage(path);
        openWizard({language: lang, path: path});
    };

    this.fork = (namespace, name=null, org=null, privateProject=false, callerCallbacks={}) => {
        log.debug("internal fork");
        let cmdArray = ["fork", namespace, "--output=editor.v0"];

        if (name != null)
            cmdArray.push("--name="+name);
        if (org != null)
            cmdArray.push("--org="+org);
        if (privateProject)
            cmdArray.push("--private");

        let callbacks = addDefaultCallbacks(callerCallbacks);

        runSh(cmdArray, callbacks);
    };

    // If namespace is null we'll move to the `path` and run `state activate`
    this.getRuntime = (namespace, path, callerCallbacks, options = {}) => {
        log.debug("internal getRuntime");
        let cmdArray = ["activate", "--output=editor.v0"];
        if (! namespace && path) {
            options.cwd = path;
        } else {
            cmdArray = cmdArray.concat([namespace, "--path="+path]);
        }
        let callbacks = addDefaultCallbacks(callerCallbacks);
        runSh(cmdArray, callbacks, options);
    };

    this.activate = (path, callbacks) => {
        log.debug("activate");

        if (local.activating || this.activated()) {
            log.debug("Already active");
            return;
        } else {
            local.activating = true;
        }

        activate(path, callbacks);
    };

    this.activated = () => {
        return local.activeProject == this.getProjectDir();
    };

    this.setSecret = (name, scope, description, value, callbacks) => {
        log.debug("internal setSecret");
        runSh(["secrets", "set", scope + "." + name, value], callbacks);
    };

    this.init = (organization, projectName, language, path, callbacks) => {
        log.debug("init");
        runSh(["init", organization+"/"+projectName,
               "--language", language,
               "--path", path,
               "--skeleton", "editor"],
              callbacks);
    };

    var statePullID = 0;
    this.pull = (callerCallbacks, dir=null, options={}) => {
        log.debug("pull");
        let id = "state-pull-" + (statePullID++);
        if (dir)
            options.cwd = dir;
            
        var notifySuccess = (msg) => {
            notify.send(msg, "state", 
            { 
                id: id, 
                duration: 10000, 
                priority: "info", 
                classlist: "state-info", 
                command: () => focusNotification(id),
                details: msg
            });
        };

        var notifyFailure = (details) => {
            notify.send("Runtime update Failed! Click here for more info.", "state", 
            { 
                id: id, 
                duration: 10000, 
                priority: "error", 
                classlist: "state-error", 
                command: () => focusNotification(id),
                panelMessage: "Runtime update Failed!",
                details: details
            });
        };
        
        let callbacks = addDefaultCallbacks(callerCallbacks);
        
        callbacks.onSuccess = result => {
            let data = loadJson(result);
            
            let msg = "No updates available for your project.";
            if (data && data.result && data.result.changed) 
                msg = "Project runtime updated to latest version.";
                
            notifySuccess(msg);    
            callerCallbacks.onSuccess(data);
        };
        
        callbacks.onFail = (code, err) => {
            notifyFailure(err);
        };
        
        runSh(["pull", "--output=editor.v0"], callbacks, options);
    };

    this.push = (callerCallbacks, dir=null) => {
        log.debug("push");
        let opts = {};
        if (dir)
            opts.cwd = dir;
        runSh(["push"], callerCallbacks, opts);
    };

    this.editScript = (scriptName, callerCallbacks) => {
        log.debug("editScript");
        let env = getEnv();
        let ext = isUnix ? "" : ".exe";
        env.EDITOR = koFile.join(Cc['@activestate.com/koDirs;1'].getService(Ci.koIDirs).mozBinDir, "komodo" + ext);
        env.ACTIVESTATE_NONINTERACTIVE = "true";
        runTermPane(["scripts", "edit", scriptName], addDefaultCallbacks(callerCallbacks), { env: env, runIn: "no-console" });

        // Gotta run on a slight timeout so the file can open before the dialog shows
        setTimeout(() => 
        {
            require("ko/dialogs").confirm(
                "Opening script '"+scriptName+"' in a temporary file. Any changes saved to this file  will be inserted into your activestate.yaml. Close the file when you are done editing.", 
                {doNotAskPref: "state.editscript.donotask", doNotAskLabel: "Don't prompt me again", yes: "OK", no: "Close"}
            );
        }, 1000);
    };

    var getProjectURL = () => {
        let file = koFile.read(this.getConfigFile(this.getProjectDir()));
        let url = file.match(/project:\s*(.*)\?commitID=.*/);
        if (url[1])
            return url[1];
    };

    this.manageProjectURL = () => {
        this.getJWT({ 
            onSuccess: (jwt) => {
                let projectURL = getProjectURL();
                if ( ! projectURL) { 
                    notify.warn("Could not retrieve platform URL from project.  'activestate.yaml' may be corrupt");
                    return;
                }
                let apiURL = prefs.getStringPref("platform.api.url");
                legacy.browse.openUrlInDefaultBrowser(apiURL + "/login/jwt/" + jwt +
                    "?redirectURL=" + encodeURIComponent(projectURL+"/customize"));
            },
            onFail: (code, err) => {
                log.error("getJWT failed: " + err);
                notify.warn("Could not retrieve authentication information. Please restart Komodo if this problem persists.");
            }
        });
    };

    this.version = (callerCallbacks, oneliner = true) => {
        log.debug("version");

        let callbacks = addDefaultCallbacks(callerCallbacks);
        callbacks.onSuccess = (results) => {
            if (oneliner)
                results = results.split("\n")[0];

            callerCallbacks.onSuccess(results);
        };

        runSh(["--version"], callbacks);
    };

    this.installed = () => {
        let stateBin = getStateBin();
        log.debug('stateBin: '+stateBin);
        log.debug('koFile.exists(stateBin): '+koFile.exists(stateBin));
        log.debug('koFile.isExecutable(stateBin): '+koFile.isExecutable(stateBin));
        log.debug('koFile.onPath(stateBin): '+koFile.onPath(stateBin));

        return (koFile.exists(stateBin) && koFile.isExecutable(stateBin)) || koFile.onPath(stateBin);
    };

    var activationHandler = () => {
        log.debug("activationHandler");
        this.reactivate(); // Always re-activate if someone reopens a project
    };
    
    this.reactivate = () => {
        local.activeProject = null; 
        let projectUrl = this.getProjectDir();
        if (projectUrl) {
            this.activate(projectUrl);
        }
    };

    let totalcap = 1000; // Cap the number of items to search
    let depth = 0;
    let maxDepth = 10;
    let pyStandardFiles = ["setup.py",
                        "requirements.txt",
                        "pyproject.toml",
                        "tox.ini",
                        "Pipfile",
                        "pytest.ini",
                        "pylintrc",];
    let perlStandardFiles = ["Makefile.pl",
                          "Build.pl",
                          "Construct",
                          "Conscript"];
    const Python = locale.get("python3");
    const Perl = locale.get("perl");

    var pythonExts = ["pyo", "pyc"]; // Don't want these types in the file
                                     // association pref as they are compiled
    var allExts = JSON.parse(prefs.getStringPref("factoryFileAssociations").replace(/'/g, "\""));

    var allValidExts = {Python3:[], Perl:[]};
    for (let k in allExts) {
        if (allExts[k] == "Perl" || allExts[k] == "Python3")
            allValidExts[allExts[k]].push(k.split(".")[1]);
    }
    for (let ext of pythonExts) {
        if (allValidExts.Python3.indexOf(ext) == -1){
            allValidExts.Python3.push(ext);
        }
    }

    // Descend to 'depth' in the given 'parent' and find files up to
    // 'maxfiles', return the resulting list
    let filepaths = [];
    var walk = (parent) => {
        let dirContents = koFile.list(parent);
        for (let thing of dirContents) {
            // Bail as soon as we can
            if (filepaths.length >= totalcap)
            {
                break;
            }

            let path = koFile.join(parent, thing);
            // If we find a dir, descend
            if (koFile.isDir(path) && depth <= maxDepth) {
                depth++;
                walk(path);
                continue;
            }
            // Skip non perl or python files
            if (allValidExts.Python3.indexOf(thing.split(".").pop()) == -1 &&
                allValidExts.Perl.indexOf(thing.split(".").pop()) == -1 &&
                pyStandardFiles.indexOf(thing) == -1 &&
                perlStandardFiles.indexOf(thing) == -1){

                continue; // Don't care about non python or perl files
            }
            //Add the path
            if (koFile.isFile(path)){
                filepaths.push(path);
            }
        }
        depth--;
        return filepaths;
    };
    // Make a guess based on files in a dur
    let guessByMarker = (dir) =>{
        let contents = koFile.list(dir);
        for (let thing of contents) {
            // faster to iterate over list rather than confirming it's not
            // another dir
            if (pyStandardFiles.indexOf(thing) != -1){
                return Python;
            }
            if (perlStandardFiles.indexOf(thing) != -1){
                return Perl;
            }
        }
    };

    this.detectProjectLanguage = () => {
        if (legacy.projects.manager && legacy.projects.manager.currentProject)
            return this.detectLanguage(legacy.uriparse.dirName(legacy.projects.manager.currentProject.url));
    };

    // First guess based on marker files that indicate what a project is.
    // Then scan the project up to a threshold for Perl or Python files and
    //  guess based on which one occurs the most.
    this.detectLanguage = dir => {
        if ( ! dir )
            return;

        filepaths = [];
        let language = guessByMarker(dir);
        if (language)
            return language;

        walk(dir);
        let pythonCount = 0;
        let perlCount = 0;
        for(let path of filepaths) {
            let ext = koFile.basename(path).split(".")[1];
            if (allValidExts.Python3.indexOf(ext) != -1)
                pythonCount++;
            if (allValidExts.Perl.indexOf(ext) != -1)
                perlCount++;
        }

        if(pythonCount == 0 && perlCount == 0)
            return;

        if (pythonCount > perlCount)
            language = Python;
        else
            language = Perl;
        return language;
    };

    var promptAddPlatform = () =>
    {
        let title = locale.get("project_add_platform_title");
        return require("ko/dialogs").confirm(
            locale.get("project_add_platform_msg"),
            {
                title: title,
                doNotAskPref:"add_platform",
                yes:"Add",
                no:"Cancel",
                pin:true,
                helpTopic:"http://docs.activestate.com/komodo/12/state-integration/",
            });
    };

    // Takes an object with the following props
    // - language
    // - name
    // - path
    var openWizard = (opts) => {
        legacy.windowManager.openDialog(
            "chrome://state/content/platformWizard.xul",
            locale.get("add_platform_title"),
            "chrome,all,close=yes,resizable,scrollbars,centerscreen",
            opts);
    };

    var onProjectOpenedHandler_promptCreate = () => {
        // I know there's a project because we only run this on project open
        // events
        let yamlPath = koFile.join(legacy.uriparse.dirName(
            legacy.projects.manager.currentProject.url),"activestate.yaml");
        if( ! koFile.exists(yamlPath)){
            let language = this.detectProjectLanguage();
            if (language) {
                if(promptAddPlatform(language)) {
                    openWizard({
                        language: language,
                        name: legacy.uriparse.baseName(
                            legacy.projects.manager.currentProject.url).split(".")[0],
                        path: legacy.uriparse.dirName(
                            legacy.projects.manager.currentProject.url)});
                }
            }
        }
    };

    this.getEnv = getEnv;

    this.load = () => {
        let savePrivKey = () => {
            this.exportPrivKey({
                onSuccess: (result) => {
                    platformAuth.saveSecret(platformAuth.privkeyUrlForPWM, result);
                },
                onFail: (code, err) => {
                    log.error("Could not save private key, code: " + code + "\nerror: " + err);
                    notify.send("Saving private key failed with: " + err, "state",
                    {
                        id: "save-state-private-key",
                        duration: 10000,
                        priority: "error",
                        command: () => focusNotification("save-state-private-key"),
                    });
                }
            });
        };
        if ( ! this.installed()) {
            install(savePrivKey);
        } else if ( ! platformAuth.getCredentials(platformAuth.privkeyUrlForPWM)) {
            savePrivKey();
        }
        loadStatePrefs();
        w.addEventListener("project_opened", activationHandler);
        w.addEventListener('project_opened', onProjectOpenedHandler_promptCreate, false);
        w.addEventListener('current_place_opened', activationHandler);
    };
    
    this.unload = () => {
        w.removeEventListener("project_opened", activationHandler);
        w.removeEventListener("project_opened", onProjectOpenedHandler_promptCreate);
        w.removeEventListener('current_place_opened', activationHandler);
    };

}).apply(module.exports);
