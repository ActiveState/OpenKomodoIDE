window.creator = function(elems, onComplete, onFail, addPlatform, noKoProjectFile)
{
    const $ = require("ko/dom").window(window);
    const prefs = require("ko/prefs");
    const log = require('ko/logging').getLogger("projectCreator");
    const koFile = require("ko/file");
    const mainWindow = require("ko/windows").getMain();
    const ko = mainWindow.ko;
    const locale = require("ko/locale").use("chrome://komodo/locale/dialogs/projectWizard.properties");
    let state = require("state/tool");

    var actions = {};
    var errorOccurred = false;
    var sccComponents = ko.scc.getAvailableSCCComponents();
    var sccComponent;
    elems.progress = elems.progress || require("ko/progress").get();
    var ignoreProgressMessages = false;
    var project = ko.projects.manager.currentProject;

    var projectName;

    var init = () =>
    {
        elems.retryBtn.hide();
        $(elems.$wizard.element().getButton("finish")).attr({disabled: true, label: "Open Project"});
        $(elems.$wizard.element().getButton("back")).attr("disabled", "true");
        $(elems.$wizard.element().getButton("cancel")).attr("disabled", "true");
        elems.error.hide();

        elems.progress.$element.attr("flex", 1);
        elems.output.$element.after(elems.progress.element);
        elems.output.$element.after(require("ko/ui/spacer").create().element);

        elems.progress.on("message", (message) =>
        {
            if (ignoreProgressMessages)
                return;

            if (message == "Done") // redundant
                return;

            printOutput(message, true, true);
        });

        // This means the user has clicked 'retry' so run through what's left of
        // the _actions.
        if ( ! elems._actions)
            elems._actions = getActions();

        projectName = "komodo-" + sanitizeProjectName(elems.name.value());

        runActions(elems._actions);
    };

    var getActions = () =>
    {
        let _actions = [
            {
                action: "createDir",
                //help: "Could not create directory.  Click 'Back' to address the issue."
            }];
        var scc = elems.SCC ? elems.SCC.value() : null;

        if (scc)
        {
            for (let i=0; i < sccComponents.length; i++)
            {
                if (scc == sccComponents[i].name)
                {
                    sccComponent = sccComponents[i].component;
                    break;
                }
            }

            if ( ! sccComponent)
            {
                printError("Source Code Control component could not be accessed");
                finalize();
                return;
            }
        }

        var initNewRepo = elems.newRepo ? elems.newRepo.checked() : false;
        if (scc && initNewRepo)
        {
            _actions.push(
            {
                action: "initRepo",
                //help: "Click 'Back' to address the issue."
            });
        }

        if (scc && elems.repoUrl && ! elems.repoUrl.disabled() && elems.repoUrl.value().trim())
        {
            _actions.push(
            {
                action: "checkout",
                //help: "Click 'Back' to address the issue."
            });
        }

        if ( elems.bootstrap && ! elems.bootstrap.disabled() && elems.bootstrap.value().trim())
        {
            _actions.push(
            {
                action: "useTemplate",
                //help: "Click 'Back' to address the issue."
            });
        }
    
        if( (elems.addRuntimeCheckbox && ! elems.addRuntimeCheckbox.disabled() && elems.addRuntimeCheckbox.value()) ||
            addPlatform)// or now we're coming from the Add platform path
        {
            _actions.push(
            {
                action: "fork",
                //help: "Try clicking 'Back' to change project name if there was a naming conflict."
            });
            _actions.push(
            {
                action: "init",
                //help: "Try clicking 'Back' to change project name if there was a naming conflict."
            });
        }
    
        if ( elems.runCommand && ! elems.runCommand.disabled() && elems.runCommand.value().trim())
        {
            _actions.push(
            {
                action: "runCommand",
                //help: "Click 'Retry' to attempt downloading runtime again."
            });
        }
        
        if ( ! noKoProjectFile)
        {
            _actions.push(
            {
                action: "createProject",
                //help: "Click 'Retry' to attempt downloading runtime again."
            });
        }

        return _actions;
    }

    var runActions = (_actions) =>
    {
        if (errorOccurred)
        {
            finalize();
            onFail();
            return;
        }

        if ( ! _actions.length)
        {
            finalize();
            onComplete(project);
            return;
        }

        let action =_actions[0];
        actions[action.action](() => {
            // If no error occurred we can continue through the actions
            // If it did, stop and let user potentially go back and fix
            // the issue then restart
            if (! errorOccurred)
                _actions.shift();
            runActions(_actions)
        }, action);
    };

    var printStep = (data, appendLineEnding=true) =>
    {
        ignoreProgressMessages = true;
        elems.progress.message(data);
        ignoreProgressMessages = false;
        printOutput(data, appendLineEnding, false);
    };

    var printOutput = (data, appendLineEnding=true, indent=false) =>
    {
        var elem = elems.output.element;
        var isAtBottom = elem.inputField.scrollTop == elem.inputField.scrollTopMax;

        data = data.trim();
        if (indent)
        {
            data = " .. " + data.replace(/\n/g, "\n .. ");
        }

        var lineEnd = " ";
        if (appendLineEnding)
            lineEnd = "\n";

        elems.output.value(elems.output.value() + data + lineEnd);

        if (isAtBottom)
            elem.inputField.scrollTop = elem.inputField.scrollTopMax;
    };

    var printError = (error, help) =>
    {
        log.error("printError: " + error);

        elems.error.value(`Error occurred: ${error}`);
        elems.error.show();
        if(help) {
            elems.help.value(`Help: ${help}`);
            elems.help.show();
        }

        errorOccurred = true;
    };

    var finalize = () =>
    {
        let msg = "All done!";
        if (errorOccurred)
        {
            $(elems.$wizard.element().getButton("back")).removeAttr("disabled");
            $(elems.$wizard.element().getButton("cancel")).removeAttr("disabled", "true");
            msg = "";
        }
        else
        {
            $(elems.$wizard.element().getButton("finish")).removeAttr("disabled", "true");
            elems._actions = null;
        }
        
        printStep("");
        printStep(msg);

        elems.progress.close();
    };

    actions.createDir = (callback, action) =>
    {
        var sccPath = elems.dir.value().trim();
        
        if (koFile.isDir(sccPath))
        {
            callback();
            return;
        }
        
        printStep(`Creating directory ${sccPath} .. `, false);
        koFile.mkpath(sccPath.trim());
        printOutput(`Done`);

        callback();
        return;
    };

    actions.initRepo = (callback, action) =>
    {
        printStep("Initializing Repository ..");

        var scc = elems.SCC.value();
        var sccPath = elems.dir.value();
        var executable;

        if (scc == "git")
            executable = prefs.getString('gitExecutable', 'git') || 'git';
        else if (scc == "hg")
            executable = prefs.getString('hgExecutable', 'hg') || 'hg';
        else
            log.error("Invalid SCC selected for initRepo: " + scc);

        var opts = {
            env: {
                GIT_TERMINAL_PROMPT: 0,
            },
            cwd: sccPath
        };

        var args = ["init"];
        if (scc == "hg")
            args.push("-y");

        require("ko/shell").run(executable, args, opts)
            .on("stdout", (data) => printOutput(data, true, true))
            .on("stderr", (data) => printOutput(data, true, true))
            .on("error", (e) => printError(e.message, action.help))
            .on("complete", () =>
            {
                printOutput("Done", true, true);
                callback();
            });
    };

    actions.checkout = (callback, action) =>
    {
        var sccURL = elems.repoUrl.value();
        var targetPath = elems.dir.value();

        printStep(`Checking out ${sccURL} to ${targetPath}..`);

        var asyncCallback = { "callback": (code, data) =>
        {
            if (code !== 0)
            {
                printError(`Checkout failed with code ${code} ${data}`, action.help);
            }
            else
            {
                printOutput(data, true, true);
            }

            printOutput("Done", true, true);
            callback();
        } };

        try
        {
            sccComponent.checkout(sccURL, targetPath, [], asyncCallback, null);
        }
        catch (e)
        {
            printError(e.message, action.help);
            log.exception(e, "Checkout failed");
        }
    };
    
    actions.useTemplate = (callback, action) =>
    {
        var toolId = elems.bootstrap.value();
        var tool = ko.toolbox2.manager.toolsMgr.getToolById(toolId);
        var targetPath = elems.dir.value();
        
        printStep(`Using template: ${tool.name}`);
        
        var cb = () =>
        {
            printOutput("Done", true, true);
            elems.progress.off("close", cb);
            callback();
            
            return false; // don't close the elems.progress yet
        };

        elems.progress.on("close", cb);
        
        ko.projects.useFolderTemplate(tool, targetPath, false, elems.progress);
    };
    
    var sanitizeProjectName = name => {
         return name.replace(/[^.A-Za-z0-9]+/g, "-").replace(/-$/g, "").replace(/^-/g, "");
    }

    actions.fork= (callback, action) =>
    {
        const platformPrefs = prefs.getPref("KomodoPlatformProjects");
        let originalNamespace = platformPrefs.getPref(elems.languages.value()).getStringPref("project");
        
        let org = elems.organizationList.value();
        let privateProjs = elems.visibilityRadio.value() == locale.get("checkbox_label_private").toLowerCase();

        if (! projectName)
        {
            printError("Bad Project name: "+projectName, action.help);
            return
        }
        if (! org)
        {
            printError("Bad Project organization: "+org, action.help);
            callback()
            return
        }
        
        printStep("Creating Platform project '" + org+ "/" + projectName + "'...");
        fork(originalNamespace, projectName, org, privateProjs, action, callback);
    };

    var fork = (originalNamespace, name, org, privateProjs, action, callback, i=0) => {
        // Append name suffix
        let _name = name;
        if (i) 
            _name += "-" + i;

        state.fork(originalNamespace, _name, org, privateProjs, {
            onSuccess: (result) => {
                projectName = _name;
                printOutput("Done", true, true); 
                callback();
            },
            onFail: (code, stderr, stdout) => {
                let result
                try {
                    result = JSON.parse(stdout);
                } catch (err) {
                    log.warn("Could not parse JSON: " + err);
                    printError(stdout + stderr, action.help);
                    callback();
                    return;
                }

                if (result.error.code == -16) {
                    fork(originalNamespace, name, org, privateProjs, action, callback, i+1);
                    return
                }
                
                printError(stdout + stderr, action.help); 
                callback();
            },
        });
    }
    
    actions.init= (callback, action) =>
    {
        let org = elems.organizationList.value();
        let dir = elems.dir.value();
        let lang = elems.languages.value();
        if ( lang == "Python")
            lang = lang+"2";

        if (! projectName)
        {
            printError("Please enter a project name", action.help);
            return
        }
        if (! org)
        {
            printError("Bad Project organization: "+org, action.help);
            callback()
            return
        }

        let callbacks =  {
            onFail: (code, msg) => {printError(msg, action.help); callback();},
        }

        callbacks.onSuccess = () => {
            callbacks.onSuccess = () => { printOutput("Done", true, true); callback();};
            state.pull(callbacks, dir);
        }
        printStep("Initializing project '" +  org+ "/" + projectName + "'...");
        state.init(org, projectName, lang, dir, callbacks);
    };
    
    actions.runCommand = (callback, action) =>
    {
        var command = elems.runCommand.value();
        var targetPath = elems.dir.value();

        printStep(`Running Command "${command}" ..`);
        var shell = require("ko/shell");
        var newEnv = shell.getEnv();
        newEnv.GIT_TERMINAL_PROMPT = 0;
        var opts = {
            env: newEnv,
            cwd: targetPath
        };

        shell.exec(command, opts)
            .on("stdout", (data) => printOutput(data, true, true))
            .on("stderr", (data) => printOutput(data, true, true))
            .on("error", (e) => printError(e.message, action.help))
            .on("complete", () =>
            {
                printOutput("Done", true, true);
                callback();
            });
    };

    actions.createProject = (callback, action) =>
    {
        printStep(`Creating Project file ..`, false);

        var path = elems.dir.value();
        var name = sanitizeProjectName(elems.name.value()) + ".komodoproject";

        var projectURI = ko.uriparse.pathToURI(koFile.join(path, name));
        project = ko.projects.manager.newProject(projectURI, false);

        if (elems.languages.value())
            project.prefset.setString("projectLanguage", elems.languages.value());

        if (elems.frameworks && elems.frameworks.value())
            project.prefset.setString("projectFramework", elems.frameworks.value());

        if (sccComponent)
            project.prefset.setString("projectSccComponent", sccComponent.name);

        printOutput("Done", true);
        callback();
    };

    init();

};