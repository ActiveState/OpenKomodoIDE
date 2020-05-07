(function()
{

    const {Cc, Ci}  = require("chrome");
    const log = require("ko/logging").getLogger("codeintel/feature/symbolscope");
    const codeintel = require("codeintel/codeintel");
    const service = require("codeintel/service");
    const prefs = require("ko/prefs");
    const views = require("ko/views");
    const commando = window.require("commando/commando");
    const partSvc   = Cc["@activestate.com/koPartService;1"].getService(Ci.koIPartService);
    const w = require("ko/windows").getMain();
    const l = require("ko/locale");
    const legacy = w.ko;

    //log.setLevel(10);

    this.onSearch = (query, uuid, onComplete) =>
    {
        log.debug(uuid + " - Starting Scoped Search");

        var view = views.current();
        var curProject = partSvc.currentProject;
        var cwd = curProject ? curProject.liveDirectory : legacy.uriparse.URIToPath(legacy.places.getDirectory());
        var maxResults = prefs.getLong("commando_search_max_results");

        service.getSymbols(
        {
            query: query,
            path: view.filePath,
            parentPath: cwd,
            language: view.language,
            limit: maxResults
        })
        .then((symbols) =>
        {
            var results = [];
            for (let symbol of symbols)
            {
                let type = l.get("symbol."+symbol.type);
                results.push({
                    id: "symbol-" + symbol.name + symbol.type + symbol.line + symbol.path,
                    name: symbol.name,
                    description: l.get("type_s_source_s", type, symbol.filename),
                    icon: "chrome://codeintel/skin/images/"+symbol.type+".svg",
                    scope: "scope-symbols",
                    allowMultiSelect: false,
                    weight: symbol.weight,
                    data: {
                        path: symbol.path,
                        line: symbol.line,
                        pos: symbol.pos,
                    }
                });
            }

            commando.renderResults(results, uuid);
            onComplete();
        })
        .catch(onComplete);
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
        commando.registerScope("scope-symbols", {
            name: "Symbols",
            description: "Navigate the code in the current project",
            icon: "koicon://ko-svg/chrome/fontawesome/skin/code.svg?size=16",
            handler: "codeintel/feature/symbolscope"
        });
    };

    this.stop = () =>
    {
        commando.unregisterScope("scope-symbols");
    };

}).apply(module.exports);
