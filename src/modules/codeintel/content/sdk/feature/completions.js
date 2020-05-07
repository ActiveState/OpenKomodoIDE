(function()
{

    const {Cc, Ci}  = require("chrome");
    const log = require("ko/logging").getLogger("codeintel/feature/completions");
    const obsvc = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
    const codeintel = require("codeintel/codeintel");
    const service = require("codeintel/service");
    const koEditor = require("ko/editor");
    const prefs = require("ko/prefs");
    const Panel = require("./completions/panel");
    const w = require("ko/windows").getMain();
    const uuidGen = require('sdk/util/uuid');
    const _ = require("contrib/underscore");
    const partSvc   = Cc["@activestate.com/koPartService;1"].getService(Ci.koIPartService);
    const legacy = w.ko;
    const commands = require("ko/commands");
    const process = require("codeintel/process");
    const views = require("ko/views");
    const l = require("ko/locale").use();
    const platform = require("sdk/system").platform;
    const pathSep = platform == "winnt" ? ";" : ":";

    log.setLevel(10);

    var activePanel,
        activeView,
        activeLine,
        activeUuid,
        activeCompletions;

    var activeQueries = 0;
    var activeData = "";

    var languages;

    var uuid;
    var maxResultsHard = prefs.getLong("codeintel.completions.max_results_hard");
    var invoking = false;

    var onPosChanged = (e) =>
    {
        if ( ! activePanel)
            return;

        var data = e.detail;
        if (data.char)
            return;

        if (data.offset === -1)
            return;

        if (activePanel.isOpen())
            activePanel.destroy();
    };

    /**
     * onCharModified fires whenever a single char was added or deleted
     * if a char was added data will hold the character, if a char was deleted
     * data will be empty
     */
    var onCharModified = (e) =>
    {
        var showWhileTyping = prefs.getBoolean("codeintel.completions.while_typing");

        if ( ! activePanel && ! showWhileTyping)
            return;

        // don't trigger when a completion is invoked
        if (invoking)
        {
            invoking = false;
            return;
        }

        // why another check for invoking in a slightly different way?
        // because race conditions
        if (activePanel && activePanel.invoking)
            return;

        var data = e.detail;
        var view = e.originalTarget;
        var lineNo = koEditor.getLineNumber();
        
        if ("_ciCompletions" in view && ! view._ciCompletions)
            return;

        if ( ! service.supportsFeature(codeintel.FEATURE_COMPLETIONS, view.language))
        {
            view._ciCompletions = false;
            return;
        }
        
        var language = service._getLanguageInfo(view.language);

        var wordRx = new RegExp(`[${language.completion_word_characters || "\\w_\\-"}]`);
        var startPos = koEditor.getCursorPosition("absolute");
        var query = koEditor.getRange(startPos-1, startPos);
        var lineStartPos = koEditor.getLineStartPos();
        var endPos = koEditor.getCursorPosition();
        var line = !! koEditor.getRange(lineStartPos, endPos).trim();
        var dataIsWord = data && data.match(wordRx);

        if (activePanel)
        {
            // Update current panel if our position didn't fall below the start pos
            // and we're still typing alphanumeric characters
            if (line && activePanel.isOpen() && activePanel.view == view && (dataIsWord || ! data))
            {
                var pos = startPos;
                if (pos > activePanel.startPos)
                {
                    activePanel.update();
                    return;
                }
            }

            // update can cause the panel to get destroyed
            if (activePanel)
                activePanel.destroy();
        }

        if ( ! showWhileTyping)
            return;
        
        if ( ! line && ! language.completion_trigger_empty_lines)
            return;

        if (activeView == view && lineNo == activeLine && dataIsWord && data.indexOf(activeData) === 0)
            return; // a request is already in progress

        if (query && language.completion_trigger_blacklist &&
            ( ! activeCompletions || ! activeCompletions.docblock || prefs.getBoolean("codeintel.calltips.while_typing")))
        {
            var rx = new RegExp(`[${language.completion_trigger_blacklist}]`);
            if (query.match(rx))
                return;
        }

        activeView = view;
        activeLine = lineNo;
        activeData = data || "";
        activeUuid = ++uuid;

        this.checkForCompletions(view, startPos, activeUuid);
    };

    this.checkForCompletions = _.throttle((view, startPos, uuid) => _checkForCompletions(view, startPos, uuid), prefs.getLong("codeintel.completions.debounce_delay"));

    var _checkForCompletions = (view, startPos, uuid) =>
    {
        if ( ! view)
            view = require("ko/views").current().get();

        if ( ! service.supportsFeature(codeintel.FEATURE_COMPLETIONS, view.language))
        {
            view._ciCompletions = false;
            return;
        }

        view._ciCompletions = true;

        var curProject = partSvc.currentProject;
        var cwd = curProject ? curProject.liveDirectory : legacy.uriparse.URIToPath(legacy.places.getDirectory());
        var path = views.current().filePath;

        var importPaths = codeintel.getImportPaths(view.prefs, view.language).join(pathSep);
        activeQueries++;

        service.getCompletions(
        {
            buf: view.scimoz.text,
            pos: startPos || view.scimoz.currentPos,
            path: path,
            parentPath: cwd,
            importPaths: importPaths,
            language: view.language,
            limit: maxResultsHard
        }, { view: view })
        .then(onReceivedCompletions.bind(this, view, startPos, uuid))
        .catch(onReceivedCompletions.bind(this, view, startPos, uuid, false));
    };

    var onReceivedCompletions = (view, startPos, uuid, completions) =>
    {
        var _uuid = uuid;
        uuid = null;

        activeData = "";
        if (--activeQueries === 0)
            activePanel = activeView = activeLine = activeUuid = null;

        if ( ! completions || (completions.entries.length === 0 && ! completions.signature &&
            ( ! completions.docblock || prefs.getBoolean("codeintel.calltips.while_typing"))))
        {
            if (activePanel && activePanel.isOpen())
            {
                activePanel.destroy();
                activePanel = null;
            }
            return;
        }
        
        if (activePanel && activePanel.uuid > uuid)
            return;

        if (view.scimoz.currentPos < startPos)
            return;

        if (view.scimoz.currentPos - startPos > prefs.getLong("codeintel.completions.max_distance"))
            return;

        if (view.scimoz.currentPos != startPos)
        {
            var language = service._getLanguageInfo(view.language);
            var wordRx = new RegExp(`[${language.completion_word_characters}]`);
            var written = koEditor.getRange(startPos, view.scimoz.currentPos);
            if ( ! written || ! written.match(wordRx)) {
                return;
            }
        }
        
        activeCompletions = completions;

        if (activePanel &&
            activePanel.symbol == completions.symbol &&
            activePanel.view == view)
        {
            try
            {
                activePanel.update(completions, startPos);
            }
            catch (e)
            {
                log.exception(e, "Failed updating completion panel");
            }
        }
        else
        {
            try
            {
                activePanel = new Panel(view, completions, startPos, uuid);
                activePanel.onDestroy(() =>
                {
                    if (activePanel)
                        invoking = activePanel.invoking;
                    activePanel = null;
                    activeCompletions = null;
                });
            }
            catch (e)
            {
                log.exception(e, "Failed creating completion panel");
            }
        }
    };
    
    this.start = () =>
    {
        w.addEventListener("buffer_char_modified", onCharModified);
        w.addEventListener("buffer_pos_changed", onPosChanged);

        commands.register("triggerPrecedingCompletion", this.checkForCompletions,
        {
            isEnabled: () => true,
            label: l.get("completions.command.label")
        });
    };

    this.stop = () =>
    {
        w.removeEventListener("buffer_char_modified", onCharModified);
        w.removeEventListener("buffer_pos_changed", onPosChanged);
        commands.unregister("triggerPrecedingCompletion");
    };

}).apply(module.exports);
