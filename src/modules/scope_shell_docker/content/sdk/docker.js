(function() {
    const log       = require("ko/logging").getLogger("commando-scope-shell-docker");
    const commando  = require("commando/commando");
    const {Cc, Ci}  = require("chrome");
    const prefs     = require("ko/prefs");
    const shell     = require("scope-shell/shell");
    const shellHelpers = require("scope-shell/helpers");

    this.register = function()
    {
        // Register the "bower" namespace
        shell.registerNamespace("docker",
        {
            command: function() { return prefs.getString("dockerBinary", "docker") || "docker" },
            description: "Create and Manage Docker images and containers",
            env: {},
            results: {
                attach: {
                    command: ["attach", ":ot"],
                    description: "Attach to a running container",
                    placeholder: "[OPTIONS] CONTAINER",
                    results: this.listContainers },
                build: {
                    description: "Build an image from a Dockerfile",
                    placeholder: "[OPTIONS] PATH | URL | - " },
                commit: {
                    description: "Create a new image from a container's changes",
                    placeholder: "[OPTIONS] CONTAINER [REPOSITORY[:TAG]] ",
                    results: this.listContainers },
                cp: {
                    description: "Copy files/folders from a container's filesystem to the host path",
                    placeholder: "[OPTIONS] CONTAINER:PATH HOSTDIR|-",
                    parser: function(shell) {
                        shell.command = shell.command.replace(/(docker cp [a-z0-9]+\:)\s/i, "$1");
                        return shell;
                    }
                },
                create: {
                    description: "Create a new container",
                    placeholder: "[OPTIONS] IMAGE [COMMAND] [ARG...]",
                    results: this.listImages },
                diff: {
                    description: "Inspect changes on a container's filesystem",
                    placeholder: "[OPTIONS] CONTAINER",
                    results: this.listContainers },
                events: {
                    description: "Get real time events from the server",
                    placeholder: "[OPTIONS]",},
                exec: {
                    description: "Run a command in a running container",
                    placeholder: "[OPTIONS] CONTAINER COMMAND [ARG...]",
                    results: this.listContainers },
                export: {
                    description: "Stream the contents of a container as a tar archive",
                    placeholder: "[OPTIONS] CONTAINER",
                    results: this.listContainers },
                help: {
                    description: "Show help for a command",
                    results: [
                        'attach','build','commit','cp','create','diff','events',
                        'exec','export','help','history','images','import',
                        'info','inspect','kill','load','login','logout','logs',
                        'pause','port','ps','pull','push','rename','restart',
                        'rm','rmi','run','save','search','start','stats','stop',
                        'tag','top','unpause','version','wait'
                    ] },
                history: {
                    description: "Show the history of an image",
                    placeholder: "[OPTIONS] IMAGE",
                    results: this.listImages },
                images: {
                    description: "List images",
                    placeholder: "[OPTIONS] [REPOSITORY]" },
                import: {
                    description: "Create a new filesystem image from the contents of a tarball",
                    placeholder: "[OPTIONS] URL|- [REPOSITORY[:TAG]]" },
                info: {
                    description: "Display system-wide information" },
                inspect: {
                    description: "Return low-level information on a container or image",
                    placeholder: "[OPTIONS] CONTAINER|IMAGE [CONTAINER|IMAGE...]",
                    results: this.listContainers },
                kill: {
                    description: "Kill a running container",
                    placeholder: "[OPTIONS] CONTAINER [CONTAINER...]",
                    results: this.listContainers },
                load: {
                    description: "Load an image from a tar archive",
                    placeholder: "[OPTIONS]" },
                login: {
                    command: ["login", ":ot"],
                    description: "Register or log in to a Docker registry server",
                    placeholder: "[OPTIONS] [SERVER]" },
                logout: {
                    command: ["logout", ":ot"],
                    description: "Log out from a Docker registry server",
                    placeholder: "[SERVER]" },
                logs: {
                    description: "Fetch the logs of a container",
                    placeholder: "[OPTIONS] CONTAINER",
                    results: this.listContainers },
                pause: {
                    description: "Pause all processes within a container",
                    placeholder: "CONTAINER [CONTAINER...]",
                    results: this.listContainers },
                port: {
                    description: "Lookup the public-facing port that is NAT-ed to PRIVATE_PORT",
                    placeholder: "[OPTIONS] CONTAINER [PRIVATE_PORT[/PROTO]]", 
                    results: this.listContainers },
                ps: {
                    description: "List containers",
                    placeholder: "[OPTIONS]" },
                pull: {
                    description: "Pull an image or a repository from a Docker registry server",
                    placeholder: "[OPTIONS] NAME[:TAG|@DIGEST]" },
                push: {
                    description: "Push an image or a repository to a Docker registry server",
                    placeholder: "[OPTIONS] NAME[:TAG]" },
                rename: {
                    description: "Rename an existing container",
                    placeholder: "OLD_NAME NEW_NAME" },
                restart: {
                    description: "Restart a running container",
                    placeholder: "[OPTIONS] CONTAINER [CONTAINER...]", 
                    results: this.listContainers },
                rm: {
                    description: "Remove one or more containers",
                    placeholder: "[OPTIONS] CONTAINER [CONTAINER...]", 
                    results: this.listContainers },
                rmi: {
                    description: "Remove one or more images",
                    placeholder: "[OPTIONS] IMAGE [IMAGE...]",
                    results: this.listImages },
                run: {
                    description: "Run a command in a new container",
                    placeholder: "IMAGE [COMMAND] [ARG...]",
                    results: this.listImages },
                save: {
                    description: "Save an image to a tar archive",
                    placeholder: "[OPTIONS] IMAGE [IMAGE...]",
                    results: this.listImages },
                search: {
                    description: "Search for an image on the Docker Hub",
                    placeholder: "[OPTIONS] TERM" },
                start: {
                    description: "Start a stopped container",
                    placeholder: "[OPTIONS] CONTAINER [CONTAINER...]", 
                    results: this.listContainers },
                stats: {
                    description: "Display a stream of a containers' resource usage statistics",
                    placeholder: "[OPTIONS] CONTAINER [CONTAINER...]", 
                    results: this.listContainers },
                stop: {
                    description: "Stop a running container",
                    placeholder: "[OPTIONS] CONTAINER [CONTAINER...]", 
                    results: this.listContainers },
                tag: {
                    description: "Tag an image into a repository",
                    placeholder: "[OPTIONS] IMAGE[:TAG] [REGISTRYHOST/][USERNAME/]NAME[:TAG]", 
                    results: this.listImages
                    },
                top: {
                    description: "Lookup the running processes of a container",
                    placeholder: "[OPTIONS] CONTAINER [ps OPTIONS]", 
                    results: this.listContainers },
                unpause: {
                    description: "Unpause a paused container",
                    placeholder: "CONTAINER [CONTAINER...]", 
                    results: this.listContainers },
                version: {
                    description: "Show the Docker version information",
                    placeholder: "" },
                wait: {
                    command: ["wait", ":ot"],
                    description: "Block until a container stops, then print its exit code",
                    placeholder: "[OPTIONS] CONTAINER [CONTAINER...]", 
                    results: this.listContainers }
            }
        });
        
        
        // Inject pref UI
        shellHelpers.injectInterpreterPref({
            basename: 'pref-environ.xul',
            siblingSelector: '#environ-prefs-groupbox',
            prefname: 'dockerBinary',
            caption: 'Docker Location'
        });
    };
    
    // Search through containers
    this.listContainers = function(query, callback)
    {
        // We only care about the first word entered
        query = query.match(/^\w+/);
        query = query ? query[0] : "";
        
        log.debug("Listing Docker containers, startkey: " + query);

        var koShell = require("ko/shell");
        var docker = prefs.getString('dockerBinary', 'docker') || 'docker';
        var search = koShell.run(docker, ['ps', '-a', '-n=-1']);
        search.on('complete', function (stdout)
        {
            var result = {};
            var entries = koShell.parseTable(stdout);
            
            for (let entry of entries)
            {
                try
                {
                    let name = entry["NAMES"].split(/\s+/).pop() + " (" + entry["IMAGE"] + ")";
                    result[name] = {
                        command: entry["CONTAINER ID"],
                        description: entry["CONTAINER ID"],
                        icon: "chrome://famfamfamsilk/skin/icons/bullet_" + (entry["STATUS"].indexOf("Up") === 0 ? "green" : "red") + ".png"
                    }
                }
                catch (e)
                {
                    log.exception(e, JSON.stringify(entry));
                }
            }
            
            callback(result);
        });
    };
    
    // Search through images
    this.listImages = function(query, callback)
    {
        // We only care about the first word entered
        query = query.match(/^\w+/);
        query = query ? query[0] : "";
        
        log.debug("Listing Docker images, startkey: " + query);

        var koShell = require("ko/shell");
        var docker = prefs.getString('dockerBinary', 'docker') || 'docker';
        var search = koShell.run(docker, ['images']);
        search.on('complete', function (stdout, foo)
        {
            var result = {};
            var entries = koShell.parseTable(stdout);

            for (let entry of entries)
            {
                try
                {
                    let name = entry["REPOSITORY"] + ":" + entry["TAG"];
                    result[name] = {
                        command: entry["IMAGE ID"],
                        description: entry["IMAGE ID"]
                    }
                }
                catch (e)
                {
                    log.exception(e, JSON.stringify(entry));
                }
            }
            
            callback(result);
        });
    };

}).apply(module.exports);
