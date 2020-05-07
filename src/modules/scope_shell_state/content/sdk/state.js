
(function () {
    const log = require("ko/logging").getLogger("commando-scope-shell-state");
    const prefs = require("ko/prefs");
    const shell = require("scope-shell/shell");
    const state = require("state/tool");
    const _     = require("contrib/underscore");

    //log.setLevel(require("ko/logging").LOG_DEBUG);


    this.register = function () {
        // Register the "state" namespace
        shell.registerNamespace("state",
        {
            command: function () { return "\"" + require("ko/prefs").project().getString("statetoolDefaultbinary", "state") + "\""; },
            description: "A command line tool to interact with the ActiveState Platform and manage your runtime environment",
            env: state.getEnv(),
            results: [{
                command: ["activate", ":ot"],
                placeholder: "[flags] [<ORG/PROJECT>] [--path]=/path/to/activestate.yaml",
                description: "Activate a project in a new terminal"
            }, {
                command: ["init"],
                placeholder: "[flags] <ORG/PROJECT> --language=python --path=/path/to/activestate.yaml",
                description: "Initialize a new project"
            }, {
                command: ["push"],
                placeholder: "[flags]",
                description: "Push your latest changes to the platform",
            }, {
                command: ["fork"],
                placeholder: "[flags] <ORG/PROJECT> --name=myProject --org=myOrg [--private]",
                description: "Fork an existing platform project",
            }, {
                command: "update",
                placeholder: "[--lock]",
                description: "Updates the state tool to the latest available version",
            }, {
                command: "invite",
                placeholder: "[flags] <<email1>,[<email2>,..]> --organization=orgname --role=member",
                description: "Invite new members to an organization",
            }, {
                command: "events",
                placeholder: "[flags]",
                description: "List project events",
            }, {
                command: "organizations",
                placeholder: "[flags]",
                description: "List member organizations on the ActiveState platform",
            }, {
                command: "projects",
                placeholder: "[flags]",
                description: "List your projects",
            }, {
                command: "show",
                placeholder: " [flags] [<remote>]",
                description: "Shows information about the current project",
            }, {
                command: "pull" ,
                placeholder: " [flags]",
                description: "Pull in the latest version of your project from the ActiveState Platform",
            }, {
                command: ["auth", ":ot"],
                placeholder: "[flags] [command]",
                description: "Authenticate against the ActiveState platform",
                results: [{
                    command: "logout",
                    placeholder: "[flags]",
                    description: "Logout",
                }, {
                    command: "signup",
                    placeholder: "[flags]",
                    description: "Sign up for a new account",
                }]
            }, {
                command: ["package"],
                placeholder: "[flags] [command]",
                description: "Manage packages used in your project",
                results: [{
                    command: "add",
                    placeholder: "[flags] <name[@version]>",
                    description: "Add a new package to your project",
                }, {
                    command: "remove",
                    placeholder: "[flags] packageName",
                    description: "Remove a package from your project",
                }, {
                    command: "update ",
                    placeholder: "[flags] <name[@version]>",
                    description: "Update a package in your project to the latest available version",
                }]
            }, {
                command: ["run", ":ot"],
                placeholder: "<script name> [args [args]]",
                description: "Run your project Scripts",
                results: getScripts,
                weight: 1,
            },
            {
                command: "secrets",
                description: "Manage your secrets",
                placeholder: "[flags] [command]",
                results: [
                {
                    command: "set",
                    description: "Set the value of a secret",
                    results: getSecrets,
                }, {
                    command: "get",
                    description: "Get the value of a secret",
                    results: getSecrets,
                }, {
                    command: "sync",
                    description: "Synchronize your shareable secrets to everyone in the organization for the current project",
                    placeholder: "[flags]",
                }],
                weight: 2,
            },]
        });
    };

    var getSecrets = _.debounce((query, callback) => {
        getStuff(state.secrets, callback);
    }, 1000);

    var getScripts = _.debounce((query, callback) => {
        getStuff(state.scripts, callback);
    }, 1000);

    var getStuff = (stateCmd, callback) => {
        let onFail = () => {
            log.warn("Could not load `activestate.yaml`");
        };

        let onSuccess = (results) => {
            let items = []
            results.map(result =>
            {
                let item = result.name;
                if (result.scope)
                    item = result.scope + "." + result.name;
                items.push(item)
            });
            items = items.filter((x) => !!x);

            callback(items);
        }

        var callbacks = { onFail: onFail, onSuccess: onSuccess };
        stateCmd(callbacks);
    }

}).apply(module.exports);
