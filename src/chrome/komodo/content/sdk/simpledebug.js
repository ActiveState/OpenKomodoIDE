/**
 * @copyright (c) 2017 ActiveState Software Inc.
 * @license Mozilla Public License v. 2.0
 * @author ActiveState
 */

/**
 * **IDE ONLY**
 *
 * Interface for simple debugging. Easily add new sharing tool to the Komodo command set and UI
 * 
 * This is the internal name for the print debugging feature
 *
 * @module ko/simpledebug
 */
(function() {
    const {Cc, Ci}  = require("chrome");
    const w = require("ko/windows").getMain();
    const legacy = w.ko;
    const timers = require("sdk/timers");
    const prefs = require("ko/prefs");
    const editor = require("ko/editor");
    const log = require("ko/logging").getLogger("simpledebug");

    const langRegistry = Cc["@activestate.com/koLanguageRegistryService;1"].getService(Ci.koILanguageRegistryService);
    const observerSvc = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

    var snippetCache = {};
    var activeTimers = {};

    var maxFileSize = prefs.getLong("simpledebug_max_filesize");

    var observer = { observe: (subject, topic, data) =>
    {
        if (data != 'snippet')
            return;

        snippetCache = {};
        this.updateView(null, true);

    }};

    var onCurrentViewUpdated = () =>
    {
        this.updateView(null, true);
    };

    var onViewChanged = (e) =>
    {
        this.updateView(e.originalTarget);
    };

    var onViewCreated = (e) =>
    {
        this.updateView(e.originalTarget, true);
    };

    this.load = () =>
    {
        w.addEventListener('view_document_attached', onViewCreated);
        w.addEventListener('current_view_changed', onViewChanged);
        w.addEventListener('current_view_language_changed', onCurrentViewUpdated);
        w.addEventListener('workspace_restored', onCurrentViewUpdated);
        w.addEventListener('project_opened', onCurrentViewUpdated);

        observerSvc.addObserver(observer, "part_changed", false);
        observerSvc.addObserver(observer, "part_renamed", false);
    };

    this.unload = () =>
    {
        w.removeEventListener('view_document_attached', onViewCreated);
        w.removeEventListener('current_view_changed', onViewChanged);
        w.removeEventListener('current_view_language_changed', onCurrentViewUpdated);
        w.removeEventListener('workspace_restored', onCurrentViewUpdated);
        w.removeEventListener('project_opened', onCurrentViewUpdated);

        observerSvc.removeObserver(observer, "part_changed");
        observerSvc.removeObserver(observer, "part_renamed");
    };

    this.updateView = (view, reload = false) =>
    {
        if ( ! view)
            view = require("ko/views").current().get();

        if ( ! view.koDoc || ! view.scimoz)
            return;

        if (view.scimoz.textLength > maxFileSize)
        {
            log.debug("Buffer exceeds max file size");
            return;
        }

        if (view.uid in activeTimers)
            timers.clearTimeout(activeTimers[view.uid]);

        var delay = prefs.getLong("simpledebug_scan_delay", 500);
        activeTimers[view.uid] = timers.setTimeout(this.doUpdateView.bind(null, view, reload), delay);
    };

    this.doUpdateView = (view, reload = false) =>
    {
        if ( ! view.uid)
            return;

        if (reload)
            this.clearMarkers();

        if (view.uid in activeTimers)
        {
            timers.clearTimeout(activeTimers[view.uid]);
            delete activeTimers[view.uid];
        }

        var snippetInfo = this.getSnippetInfo(view);
        if ( ! snippetInfo)
            return;

        view.koDoc.getLinesMatching(
            JSON.stringify([snippetInfo.search]),
            (code, result) => this.setViewLines(view, "enable", result)
        );

        if (snippetInfo.searchDisabled)
        {
            view.koDoc.getLinesMatching(
                JSON.stringify(snippetInfo.searchDisabled),
                (code, result) => this.setViewLines(view, "disable", result)
            );
        }
    };

    this.clearMarkers = (view) =>
    {
        if ( ! view)
            view = require("ko/views").current().get();

        if ( ! view.koDoc || ! view.scimoz)
            return;

        snippetCache = {};

        view.scimoz.markerDeleteAll(legacy.markers.MARKNUM_SIMPLEDEBUG_ENABLED);
        view.scimoz.markerDeleteAll(legacy.markers.MARKNUM_SIMPLEDEBUG_DISABLED);
    };

    this.setViewLines = (view, action, lines) =>
    {
        var marker = legacy.markers.MARKNUM_SIMPLEDEBUG_ENABLED;
        if (action == "disable")
            marker = legacy.markers.MARKNUM_SIMPLEDEBUG_DISABLED;

        var linesAdded = {}; // faster to check an object when we delete lines in the next loop
        for (let line of lines)
        {
            linesAdded[line] = true;
            if ((view.scimoz.markerGet(line) & (1 << marker)) === 0)
            {
                view.scimoz.markerAdd(line, marker);
            }
        }

        var line = view.scimoz.markerNext(0, 1 << marker);
        while (line != -1)
        {
            if ( ! (line in linesAdded))
            {
                view.scimoz.markerDelete(line, marker);
            }

            line = view.scimoz.markerNext(line+1, 1 << marker);
        }
    };

    this.getSnippetInfo = (view) =>
    {
        if (view.uid.toString() in snippetCache)
            return snippetCache[view.uid.toString()];

        if ( ! view.koDoc)
            return;

        var language = view.koDoc.language;
        var snippet = legacy.toolbox2.getDefaultPrintStateForLanguage(language);

        if ( ! snippet)
            return;

        var result =
        {
            snippet: snippet,
            search: snippet.value,
            searchDisabled: null,
        };
        //Look for the first interpolation string if there is one
        var index = result.search.indexOf("[[%");
        // Look for the first EJS string if there is one
        var index2 = result.search.indexOf("<%");
        if (index == -1 || (index2 > -1 && index2 < index))
        {
            index = index2;
        }

        if (index != -1)
        {
            result.search = result.search.substr(0, index);
        }

        var langInfo = langRegistry.getLanguage(language);
        var lineComments = null;

        try
        {
            lineComments = JSON.parse(langInfo.getCommentDelimiters("line"));
        } catch (e) {}

        if ( ! Array.isArray(lineComments))
            lineComments = null;

        if (lineComments)
        {
            result.searchDisabled = [];
            for (let comment of lineComments)
            {
                result.searchDisabled.push(`${comment}${result.search}`);
                result.searchDisabled.push(`${comment} ${result.search}`);
            }
        }

        snippetCache[view.uid.toString()] = result;

        return result;
    };

    /**
     * Toggle a simple debugging statement on the given line
     *
     * @param   {view} view
     * @param   {long} line     scintilla line number (starts at 0)
     */
    this.toggle = (view, line) =>
    {
        var markerState = view.scimoz.markerGet(line);
        if (markerState & (1 << legacy.markers.MARKNUM_SIMPLEDEBUG_ENABLED))
        {
            this.disable(view, line);
        }
        else
        {
            this.enable(view, line);
        }
    };

    /**
     * Enable a simple debugging statement on the given line
     *
     * @param   {view} view
     * @param   {long} line     scintilla line number (starts at 0)
     */
    // XXX change this to not use regex, just check prefix
    this.enable = (view, line) =>
    {
        var ed = editor.editor(view.scintilla, view.scimoz);

        if (ed.getLineNumber() != (line+1))
            ed.setCursor({line: line+1});

        var snippetInfo = this.getSnippetInfo(view);
        var contents = ed.getLine(line+1);

        if ( ! snippetInfo)
            return;

        var matched = false;
        var searches = snippetInfo.searchDisabled;
        if(searches)
        {
            for (let search of searches)
            {
                search = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                search = search.replace(/\s+/g, '\\s+');
    
                var rx = new RegExp(search);
                matched = !! contents.match(rx);
                if (matched)
                    break;
            }
        }
        if ( ! matched)
        {
            legacy.projects.printdebugInsert(snippetInfo.snippet, view, true);
            line = line+1;
        }
        else
        {
            legacy.commands.doCommand("cmd_uncomment");
        }

        view.scimoz.markerAdd(line, legacy.markers.MARKNUM_SIMPLEDEBUG_ENABLED);
        view.scimoz.markerDelete(line, legacy.markers.MARKNUM_SIMPLEDEBUG_DISABLED);
    };

    /**
     * Disable a simple debugging statement on the given line
     *
     * @param   {view} view
     * @param   {long} line     scintilla line number (starts at 0)
     */
    this.disable = (view, line) =>
    {
        var ed = editor.editor(view.scintilla, view.scimoz);

        ed.setCursor({line: line+1});
        legacy.commands.doCommand("cmd_comment");

        view.scimoz.markerAdd(line, legacy.markers.MARKNUM_SIMPLEDEBUG_DISABLED);
        view.scimoz.markerDelete(line, legacy.markers.MARKNUM_SIMPLEDEBUG_ENABLED);
    };

}).apply(module.exports);
