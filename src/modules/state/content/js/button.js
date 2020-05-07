(function () {
    const locale = require("ko/locale");
    const w = require('ko/windows').getMain();
    const $ = require("ko/dom");
    const legacy = w.ko;
    const state = require("state/tool");
    const notify = require("notify/notify");
    const prefs = require("ko/prefs");
    const commando  = require("commando/commando");

    const scriptYamlString = "scripts:";
    const constantYamlString = "constants:";
    const btnSeenPrefID = "state.dynbtn.seen";
    const isUnix = require("sdk/system").platform != "winnt";

    const log = require("ko/logging").getLogger("state-button");
    // log.setLevel(log.DEBUG);

    var local = { scripts: [], button: null, failing: false };

    this.load = () => {

        local.button = require("ko/dynamic-button").register("State Tool",
        {
            tooltip: "State Tool",
            icon: "state",
            isEnabled: () => (! prefs.getBoolean(btnSeenPrefID)) || !! state.getProjectDir(),
            menuitems: updateMenu,
            menuitemsInitialize: initMenu,
            events: ["current_place_opened", "project_opened", "current_view_changed"],
        });
        
        //  Add the little blue dot if the user's never seen this
        if (! prefs.getBoolean(btnSeenPrefID)) 
            local.button.setCounter("*");
        
        w.addEventListener("current_place_opened", getScripts);
        w.addEventListener("project_opened", getScripts);

        $(w.document).on("state_activate_fail", () => {
            if (prefs.getBoolean(btnSeenPrefID)) 
                local.button.setCounter("!");
            local.failing = true;
        });

        $(w.document).on("state_activate_ok", () => {
            if (prefs.getBoolean(btnSeenPrefID)) 
                local.button.setCounter();
            local.failing = false;
        });

        // Check for changes when source file is modified
        require("ko/filestatus").monitor((urllist) => {
            for (let url of urllist) {
                if (legacy.uriparse.baseName(url).toLowerCase() == "activestate.yaml") {
                    getScripts();
                    return; // no need to check the rest
                }
            }
        });
    };

    var updateMenu = () => {
        let menuitems = [];
        
        if (! prefs.getBoolean(btnSeenPrefID)) {
            menuitems.push({
                label: locale.get("btn_what_IS_this"),
                classList: "state-info",
                command: () => {
                    openBrowser(prefs.getStringPref("platform.doc.site")+prefs.getStringPref("state.doc.site.path"));
                    prefs.setBoolean(btnSeenPrefID, true);
                    local.button.update(true);
                    // Remove the blue dot now that the user has seen this
                    local.button.setCounter();
                }
            }, null);
        }

        if (local.failing) {
            menuitems.push({
                label: "Reactivate Runtime",
                classList: "state-info",
                command: () => {
                    state.reactivate();
                }
            },
            {
                label: "Why did Activation fail?",
                command: () => {
                    legacy.uilayout.toggleTab('notifications-widget', false);
                }
            },
             null);
        }
        
        menuitems.push({
            label: locale.get("btn_run_cmd_menu"),
            command: () => {
                    commando.showSubscope("scope-shell", "state");
                }
        }, null);
        
        if ( ! state.installed()){
            menuitems.push({
                label: locale.get("btn_install_state"),
                command: state.install,
            });
        }
        
        if ( ! state.getProjectDir()){
            // Project file is gone and not detected in a way Komodo knows about,
            // so clear any scripts menu items
            local.scripts = [];
            menuitems = menuitems.concat(initMenu());
        } else{
            menuitems = menuitems.concat(projectMenu());
        }

        return menuitems;
    };
    
    var initMenu = () => {
       return [{
            label: legacy.projects.manager.currentProject ? locale.get("btn_add_project") : locale.get("btn_create_project"),
            command: () => {
                // use timeout so we don't block the UI when clicked
                setTimeout(() => {
                    if (legacy.projects.manager.currentProject)
                        state.createProject(
                            legacy.uriparse.URIToLocalPath(legacy.places.manager.currentPlace)
                        );
                    else
                        legacy.commands.doCommandAsync('cmd_openProjectwizard');
                }, 0);
            }
        }];
    };
    
    var projectMenu = () => {
        let menuitems = [];

        menuitems.push({
            label: locale.get("btn_manage_packages_menu"),
            command: () => state.manageProjectURL(),
        });

        menuitems.push({
            label: locale.get("btn_update_runtime_menu"),
            command: updateRuntime,
        });

        menuitems.push(null);

        menuitems.push({
            label: locale.get("btn_add_constant_menu"),
            command: addConstant,
        });

        menuitems.push({
            label: locale.get("btn_add_script_menu"),
            command: addScript,
        });

        menuitems.push(null);

        if(local.scripts.length > 0)
            menuitems.push(editScriptsMenu());

        menuitems.push({
            label: locale.get("btn_set_secret_menu"),
            command: secretsDialog,
        });
        
        if(local.scripts.length > 0)
            menuitems = menuitems.concat(runScriptsMenu());
            
        return menuitems;
    };
    
    var editScriptsMenu = () => {
        if ( ! local.scripts) 
            return;

        let generateProcHandler = (scriptName) => {
            return (pid) => {
                let _view = null;
                let killProc = () => {
                    if (!isUnix){
                        require("ko/shell").run("taskkill", ["/PID", pid, "/F", "/T"])
                            .stderr.on("data", log.error);
                    }
                    else{
                        require("ko/shell").run("kill", ["-s", "TERM", ""+pid])
                            .stderr.on("data", log.error);
                    }
                };

                let handleFileClose = (e) =>{
                    if(e.originalTarget === _view){
                        w.removeEventListener("view_closed", handleFileClose);
                        killProc();
                    }
                };
            
                let handleFileOpen = (e) => {
                    if (e.originalTarget.koDoc.baseName.indexOf(scriptName) != -1) {
                        _view = e.originalTarget;
                        w.addEventListener("view_closed", handleFileClose);
                        w.removeEventListener("view_opened", handleFileOpen);
                    }
                };
                w.addEventListener('view_opened', handleFileOpen);
            };
        };

        let subMenu = [];
        for (let s of local.scripts) {
            let b = s;
            let callbacks = scriptActionCallbacks(locale.get("btn_edit_fail", b.name));
            callbacks.procHandler = generateProcHandler(b.name);
            subMenu.push({
                label: s.name,
                command: () => state.editScript(b.name, callbacks),
            });
        }
        
        return {
            label: locale.get("btn_edit_script_menu"),
            menuitems: subMenu,
        };
    };

    var runScriptsMenu = () => {
        let menuitems = [];
        if (!local.scripts)
            return;

        menuitems.push(null);

        for (let s of local.scripts) {
            let b = s;
            menuitems.push({
                label: locale.get("btn_run_script") + " " + s.name,
                command: () => state.runScript(b.name, scriptActionCallbacks(locale.get("btn_run_fail", b.name))),
            });
        }
        menuitems.push(null);
        return menuitems;
    };
    
    var scriptActionCallbacks = (failMsg) => {
        var onFail = (code, msg) => {
            if (code != null) {
                failMsg = failMsg + ": " + msg;
            }
            notify.interact(
                failMsg,
                "statetool",
                { priority: "error", panel: true });
        };

        var onError = (msg) => {
            log.warn("state scripts: " + msg);
        };
        return {
            onError: onError,
            onFail: onFail,
        };
    };
    
    var getScripts = () => {
        var onFail = () => {
            notify.interact(
                "Could not load scripts from `activestate.yaml`.",
                "statetool",
                { priority: "error", panel: true });
        };

        var callbacks = { onSuccess: (scripts) => {local.scripts = scripts;} , onFail: onFail };
        if (!! state.getProjectDir())
            state.scripts(callbacks);
    };

    var secretsDialog = () => {
        legacy.windowManager.openDialog("chrome://state/content/secretsDialog.xul");
    };

    var addConstant = () => {
        openASYaml(insertSnippet.bind(this, constantYamlString));
    };

    var addScript = () => {
        openASYaml(insertSnippet.bind(this, scriptYamlString));
    };

    var openASYaml = (callback) => {
        let asFile = state.getConfigFile(state.getProjectDir());
        if (asFile) {
            legacy.open.URI([asFile], "editor", false, (view) => { setTimeout(() => callback(view), 500); });
        }
    };
    
    // This is being called as a callback in ko.open.URI, which when called,
    // is passed the now open view...that's where the view is coming from :)
    var insertSnippet = (searchStr, view) => {
        // Trim the ':' off the yaml field search string to get
        // the snippet field name
        let snippetname = searchStr.substr(0, searchStr.length - 1);

        let editor = require("ko/editor").editor(view.scintilla, view.scimoz);
        let docLength = editor.getLength();
        let possibles = editor.findString(searchStr);
        let trimPrefix = false;

        let pos = getCorrectPos(possibles, searchStr);
        if (!pos) {
            pos = editor._posToRelative(docLength);
        } else {
            // Trim the 's' off the snippet name as we only need an entry now
            snippetname = snippetname.substr(0, snippetname.length - 1);
            trimPrefix = true;
        }

        editor.setCursor(pos);
        editor.goLineEnd();
        editor.insertLineBreak();
        let snippet = legacy.abbrev.findAbbrevSnippet(snippetname, null, null, true);
        legacy.projects.snippetInsert(snippet);
        let newLength = editor.getLength();
        let startPos = pos.absolute;
        if (trimPrefix) 
            startPos += searchStr.length;
        editor.flashRange(startPos, newLength - docLength, 3);
    };
    
    // Confirm the scintilla search didn't find mutliple and if it did
    // narrow it down to the only possible one based on a regex
    var getCorrectPos = (possibles, srchStr) => {
        var editor = require("ko/editor");
        for (var p of possibles) {
            let line = editor.getLine(p.line);
            if (line.search('^' + srchStr + '\\s*$') != -1) {
                return p;
            }
        }
    };

    var updateRuntime = () => {
        let dir = state.getProjectDir();
        
        let callbacks = {
            onSuccess: (data) => {
                if (data && data.result && data.result.changed) {
                    state.deactivate();
                    state.activate(dir);
                }
            },
        };
        state.pull(callbacks, dir);
    };

    var openBrowser = legacy.browse.openUrlInDefaultBrowser;
}).apply(module.exports);