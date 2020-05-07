(function()
{

    const {Cc, Ci}  = require("chrome");
    const menu = require("ko/menu");
    const commands = require("ko/commands");
    const log = require("ko/logging").getLogger("codeintel/feature/findreferences");
    const codeintel = require("codeintel/codeintel");
    const service = require("codeintel/service");
    const prefs = require("ko/prefs");
    const views = require("ko/views");
    const commando = require("commando/commando");
    const partSvc   = Cc["@activestate.com/koPartService;1"].getService(Ci.koIPartService);
    const w = require("ko/windows").getMain();
    const l = require("ko/locale");
    const legacy = w.ko;
    const platform = require("sdk/system").platform;
    const pathSep = platform == "winnt" ? ";" : ":";
    const koFile = require("ko/file");
    const dialogs = require("ko/dialogs");
    const notify = require("notify/notify");

    var parentPath = "";
    var invoking = false;
    var references = [];

    //log.setLevel(10);

    var onSearchCurrentSet = (query, uuid, onComplete) =>
    {
        query = query.toLowerCase();

        var results = [];
        for (let ref of references)
        {
            if (ref.name.toLowerCase().indexOf(query) != -1 ||
                ref.path.toLowerCase().indexOf(query) != -1)
            {
                results.push(getResult(ref));
            }
        }

        commando.renderResults(results, uuid);
        onComplete();
    };

    var getResult = (ref) =>
    {
        return {
            id: "ref-" + ref.name + ref.line + ref.path,
            name: koFile.basename(ref.path) + ":" + ref.line,
            description: ref.path,
            descriptionPrefix: ref.lineData.trim(),
            scope: "scope-symbol-references",
            allowMultiSelect: false,
            data: {
                path: ref.path,
                line: ref.line,
                pos: ref.pos,
            }
        };
    };

    this.onShow = () =>
    {
        invoking = true;
    };

    this.onSearch = (query, uuid, onComplete) =>
    {
        log.debug(uuid + " - Starting Find References");

        if ( ! invoking)
            return onSearchCurrentSet(query, uuid, onComplete);

        invoking = false;

        references = [];

        var view = views.current();
        var importPaths = codeintel.getImportPaths(view.prefs, view.language).join(pathSep);
        var maxResults = prefs.getLong("commando_search_max_results");

        var _onComplete = () => {
            notify.send(l.get("scanning.done"), "codeintel", { id: "codeintel_findref", duration: 1000 });
            onComplete();
        };

        service.getReferences(
        {
            buf: view.scimoz.text,
            pos: view.scimoz.currentPos,
            path: view.filePath,
            parentPath: parentPath,
            language: view.language,
            limit: maxResults
        })
        .each((result) =>
        {
            notify.send(l.get("scanning.path", result.path), "codeintel", { id: "codeintel_findref", duration: 10000 });

            if (result.results)
                references = references.concat(result.results);

            var results = [];
            for (let ref of result.results || [])
            {
                results.push(getResult(ref));
            }

            commando.renderResults(results, uuid);
        })
        .then(_onComplete)
        .catch(_onComplete);
    };
    
    this.onSelectResult = function()
    {
        var item = commando.getSelectedResult();
        var data = item.data;
        legacy.open.URIAtLine(legacy.uriparse.pathToURI(data.path), data.line || 0, undefined, undefined, () =>
        {
            if (data.pos && data.pos != -1)
                require("ko/editor").setCursor(data.pos);
        });
        commando.hide();
    };

    this.start = () =>
    {
        commando.registerScope("scope-symbol-references", {
            name: "Symbol References",
            description: "Find the current symbol's references in the current project",
            icon: "koicon://ko-svg/chrome/fontawesome/skin/code.svg?size=16",
            handler: "codeintel/feature/findreferences",
            invisible: true
        });
        
        menu.register({
            id: "editor-find-references",
            label: l.get("findreferences.findreferences"),
            context: [
                {
                    select: "#editorContextMenu",
                    after: "#sdk_menuitem_editorContextMenueditorgotodefinition"
                }
            ],
            attributes: {
                observes: "cmd_findReferences"
            }
        });
        menu.register({
            id: "menu_findReferences",
            label: l.get("findreferences.findreferences"),
            context: [
                {
                    select: "#naviation_menupopup",
                    after: "#sdk_menuitem_naviation_menupopupmenu_goToDefinition"
                }
            ],
            attributes: {
                observes: "cmd_findReferences"
            }
        });
        
        commands.register("findReferences", () => {
            var curProject = partSvc.currentProject;
            var view = views.current();
            if ( ! service.supportsFeature(codeintel.FEATURE_FINDREFERENCES, view.language))
                return;
        
            dialogs.filepicker(
                l.get("findreferences.prompt"),
                (path) => {
                    if ( ! path)
                        return;

                    parentPath = path;
                    commando.show("scope-symbol-references", true);
                    commando.search("");
                }, {type: "dir", path: view.dirname}
            );
        },
        {
            isEnabled: () =>
            {
                var view = views.current().get();
                return service.supportsFeature(codeintel.FEATURE_FINDREFERENCES, view.language);
            },
            label: l.get("findreferences.command.label")
        });
    };

    this.stop = () =>
    {
        commando.unregisterScope("scope-symbol-references");
        menu.unregister("editor-find-references");
        menu.unregister("menu_findReferences");
        commands.unregister("findReferences");
    };

}).apply(module.exports);
