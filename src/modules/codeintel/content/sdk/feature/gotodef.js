(function()
{
    const {Cc, Ci}  = require("chrome");
    const menu = require("ko/menu");
    const commands = require("ko/commands");
    const l = require("ko/locale").use();
    const views = require("ko/views");
    const codeintel = require("codeintel/codeintel");
    const service = require("codeintel/service");
    const log = require("ko/logging").getLogger("codeintel/feature/gotodef");
    const partSvc   = Cc["@activestate.com/koPartService;1"].getService(Ci.koIPartService);
    const w = require("ko/windows").getMain();
    const legacy = w.ko;
    const platform = require("sdk/system").platform;
    const pathSep = platform == "winnt" ? ";" : ":";

    //log.setLevel(10);

    this.invoke = () =>
    {
        log.debug("invoke");

        var view = views.current().get();

        if ( ! service.supportsFeature(codeintel.FEATURE_GOTODEF, view.language))
        {
            view._ciGotoDef = false;
            return;
        }

        var curProject = partSvc.currentProject;
        var cwd = curProject ? curProject.liveDirectory : legacy.uriparse.URIToPath(legacy.places.getDirectory());
        var path = views.current().filePath;

        var importPaths = codeintel.getImportPaths(view.prefs, view.language).join(pathSep);

        view._ciGotoDef = true;

        service.getDefinition(
        {
            buf: view.scimoz.text,
            pos: view.scimoz.currentPos,
            path: path,
            parentPath: cwd,
            importPaths: importPaths,
            language: view.language
        })
        .then(onReceivedDefinition)
        .catch((result) =>
        {
            log.debug("getDefinition failed: " + result);
            onReceivedDefinition();
        });
    };

    var onReceivedDefinition = (definition) =>
    {
        if ( ! definition)
        {
            require("notify/notify").send(l.get("gotodef.not_found"), "codeintel");
            return;
        }

        if (definition.filename && definition.filename.indexOf(':') === 0) // catalog
        {
            if ( ! definition.symbol)
            {
                require("notify/notify").send(l.get("gotodef.not_found"), "codeintel");
                return;
            }

            if ( ! require("ko/dialogs").confirm(l.get("gotodef.definition_in_catalog")))
                return;

            require("devdocs/devdocs").open(definition.parents.join(" ") + " " + definition.symbol);
        }
        else if (definition.filename)
        {
            legacy.open.URIAtLine(legacy.uriparse.pathToURI(definition.filename), definition.line);
        }
        else if (definition.line)
        {
            require("ko/editor").gotoLine(definition.line);
        }
    };

    this.start = () =>
    {
        menu.register({
            id: "editor-go-to-definition",
            label: l.get("gotodef.gotodef"),
            context: [
                {
                    select: "#editorContextMenu",
                    after: "#editor_context_select_separator"
                }
            ],
            attributes: {
                observes: "cmd_goToDefinition"
            }
        });
        menu.register({
            id: "menu_goToDefinition",
            label: l.get("gotodef.gotodef"),
            context: [
                {
                    select: "#naviation_menupopup",
                    after: "#menu_gotoLine"
                }
            ],
            attributes: {
                observes: "cmd_goToDefinition"
            }
        });

        commands.register("goToDefinition", this.invoke,
        {
            isEnabled: () =>
            {
                var view = views.current().get();
                return !! view._ciGotoDef;
            },
            label: l.get("gotodef.command.label")
        });
    };

    this.stop = () =>
    {
        menu.unregister("editor-go-to-definition");
        menu.unregister("menu_goToDefinition");
        commands.unregister("goToDefinition");
    };

}).apply(module.exports);