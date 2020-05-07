(function()
{
    const {Cc, Ci}  = require("chrome");
    const menu = require("ko/menu");
    const commands = require("ko/commands");
    const l = require("ko/locale").use();
    const views = require("ko/views");
    const codeintel = require("codeintel/codeintel");
    const service = require("codeintel/service");
    const log = require("ko/logging").getLogger("codeintel/feature/jumpsections");
    const partSvc   = Cc["@activestate.com/koPartService;1"].getService(Ci.koIPartService);
    const w = require("ko/windows").getMain();
    const legacy = w.ko;
    const platform = require("sdk/system").platform;
    const pathSep = platform == "winnt" ? ";" : ":";

    //log.setLevel(10);

    this.jumpToNextSection = () =>
    {
        log.debug("invoke");

        var view = views.current().get();

        if ( ! service.supportsFeature(codeintel.FEATURE_JUMPSECTIONS, view.language))
            return;

        service.getNextScope(
        {
            buf: view.scimoz.text,
            line: view.scimoz.lineFromPosition(view.scimoz.currentPos) + 1,
            language: view.language
        })
        .then(onReceivedScope)
        .catch((result) =>
        {
            log.debug("getNextScope failed: " + result);
            onReceivedScope();
        });
    };

    this.jumpToPrevSection = () =>
    {
        log.debug("invoke");

        var view = views.current().get();

        if ( ! service.supportsFeature(codeintel.FEATURE_JUMPSECTIONS, view.language))
            return;

        service.getPrevScope(
        {
            buf: view.scimoz.text,
            line: view.scimoz.lineFromPosition(view.scimoz.currentPos) + 1,
            language: view.language
        })
        .then(onReceivedScope)
        .catch((result) =>
        {
            log.debug("getPrevScope failed: " + result);
            onReceivedScope();
        });
    };

    var onReceivedScope = (scope) =>
    {
        if ( ! scope || ! scope.line )
        {
            return;
        }

        require("ko/editor").gotoLine(scope.line);
    };

    this.start = () =>
    {
        menu.register({
            id: "menu_jumpToNextScope",
            label: l.get("sections.jumpnext.label"),
            context: [
                {
                    select: "#naviation_menupopup",
                    before: "#naviation_menupopup_bookmarks_separator"
                }
            ],
            attributes: {
                observes: "cmd_jumpToNextSection"
            }
        });
        menu.register({
            id: "menu_jumpToPrevScope",
            label: l.get("sections.jumpprev.label"),
            context: [
                {
                    select: "#naviation_menupopup",
                    before: "#naviation_menupopup_bookmarks_separator"
                }
            ],
            attributes: {
                observes: "cmd_jumpToPrevSection"
            }
        });
        
        commands.register("jumpToNextSection", this.jumpToNextSection,
        {
            isEnabled: () =>
            {
                var view = views.current().get();
                return service.supportsFeature(codeintel.FEATURE_JUMPSECTIONS, view.language);
            },
            label: l.get("sections.jumpnext.command_label")
        });
        commands.register("jumpToPrevSection", this.jumpToPrevSection,
        {
            isEnabled: () =>
            {
                var view = views.current().get();
                return service.supportsFeature(codeintel.FEATURE_JUMPSECTIONS, view.language);
            },
            label: l.get("sections.jumpprev.command_label")
        });
    };

    this.stop = () =>
    {
        menu.unregister("menu_jumpToNextScope");
        menu.unregister("menu_jumpToPrevScope");
        commands.unregister("jumpToNextSection");
        commands.unregister("jumpToPrevSection");
    };

}).apply(module.exports);