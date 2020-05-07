(function()
{

    const {Cc, Ci}  = require("chrome");
    const log = require("ko/logging").getLogger("codeintel/feature/calltips");
    const obsvc = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
    const codeintel = require("codeintel/codeintel");
    const service = require("codeintel/service");
    const koEditor = require("ko/editor");
    const prefs = require("ko/prefs");
    const Panel = require("./calltips/panel");
    const w = require("ko/windows").getMain();
    const uuidGen = require('sdk/util/uuid');
    const _ = require("contrib/underscore");
    const partSvc   = Cc["@activestate.com/koPartService;1"].getService(Ci.koIPartService);
    const legacy = w.ko;
    const platform = require("sdk/system").platform;
    const pathSep = platform == "winnt" ? ";" : ":";
    const commands = require("ko/commands");
    const l = require("ko/locale").use();

    var activePanel,
        activeView;

    var uuid;
    
    var debounceDelay = prefs.getLong("codeintel.calltips.debounce_delay");

    var onPosChanged = (e) =>
    {
        if ( ! activePanel)
            return;

        var data = e.detail;
        if (data.char)
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
        uuid = null;
        
        var autoShow = prefs.getBoolean("codeintel.calltips.while_typing");
        if ( ! autoShow)
            return;

        var data = e.detail;
        var view = e.originalTarget;

        if (activePanel)
        {
            // Update current panel if our position didn't fall below the start pos
            // and we're still typing alphanumeric characters
            if (activePanel.isOpen() && activePanel.view == view && ((data && data.match(/[\w\$-]/)) || ! data))
            {
                var pos = view.scimoz.currentPos;
                if (pos >= activePanel.startPos)
                {
                    activePanel.updatePosition();
                    return;
                }
            }

            // update can cause the panel to get destroyed
            if (activePanel)
                activePanel.destroy();
        }

        activeView = view;

        uuid = uuidGen.uuid().toString();
        var requestUuid = uuid;

        this.checkForCalltip(view, requestUuid);
    };

    var isPanelNeeded = (completions) =>
    {
        if ( ! completions || ( ! completions.docblock && ! completions.signature))
        {
            return false;
        }

        if ( ! completions.docblock && completions.signature &&
             codeintel.isFeatureEnabled(codeintel.FEATURE_COMPLETIONS))
        {
            // Completion panel will show the signature
            return false;
        }

        return true;
    };

    this.checkForCalltip = (view, requestUuid) => _checkForCalltip(view, requestUuid);
    
    var _checkForCalltip = _.debounce((view, requestUuid) =>
    {
        if ( ! view)
            view = require("ko/views").current().get();

        if ( ! service.supportsFeature(codeintel.FEATURE_COMPLETIONS, view.language) ||
             ! service.supportsFeature(codeintel.FEATURE_CALLTIPS, view.language))
        {
            return;
        }

        var curProject = partSvc.currentProject;
        var cwd = curProject ? curProject.liveDirectory : legacy.uriparse.URIToPath(legacy.places.getDirectory());
        var path = require("ko/views").current().filePath;

        var importPaths = codeintel.getImportPaths(view.prefs, view.language).join(pathSep);

        // We're using getCompletions here because the request and processing
        // is largely the same as for completions, and this way we can reduce
        // the number of queries being sent to the server
        service.getCompletions(
        {
            buf: view.scimoz.text,
            pos: view.scimoz.currentPos,
            path: path,
            parentPath: cwd,
            importPaths: importPaths,
            language: view.language,
            env: view.prefs.getString("userEnvironmentStartupOverride", ""),
            limit: 1
        })
        .then(onReceivedCompletions.bind(this, view, requestUuid))
        .catch(onReceivedCompletions.bind(this, view, requestUuid, false));
    }, debounceDelay);

    var onReceivedCompletions = (view, requestUuid, completions) =>
    {
        if (requestUuid != uuid)
        {
            log.debug("Cancelling calltip, uuid is no longer active");
            return;
        }
        
        if ( ! isPanelNeeded(completions))
        {
            if (activePanel && activePanel.isOpen())
            {
                activePanel.destroy();
                activePanel = null;
            }
            return;
        }
        
        if (activePanel && activePanel.view == view)
        {
            try
            {
                activePanel.update(completions);
            }
            catch (e)
            {
                log.exception(e, "Failed updating calltip panel");
            }
        }
        else
        {
            try
            {
                activePanel = new Panel(view, completions);
                activePanel.onDestroy(() => activePanel = null);
            }
            catch (e)
            {
                log.exception(e, "Failed creating calltip panel");
            }
        }
    };
    
    this.getFormattedSignature = (signature, editor) =>
    {
        // Get the argument number we're positioned on
        var line = editor.getRange({line: editor.getLineNumber(), ch: 0}, editor.getCursorPosition());
        var argNo = (line.match(/,/g) || []).length;

        var fragment = document.createDocumentFragment();

        // Find where the arguments start in the signature
        var argStart = signature.match(/\s|\(/);
        if ( ! argStart)
        {
            fragment.appendChild(document.createTextNode(signature));
            return fragment;
        }

        // Separate the signature prefix from the arguments
        argStart = argStart.index + 1;
        var prefix = signature.substr(0, argStart);
        var args = signature.substr(argStart).split(",");

        // Check if we have arguments before the one the caret is on and add them
        // to the prefix
        if (argNo > 0)
        {
            prefix += args.slice(0, argNo).join(",");
            prefix += ", ";
        }
        args = args.slice(argNo);

        // Add the prefix to our fragment
        fragment.appendChild(document.createTextNode(prefix));

        // Now we're looking at the active arg
        var arg = args.shift();

        // Check if we're at the end of the signature
        var renderClosingBracket = false;
        var endIndex = arg ? arg.match(/\)\s*(?:$|\-)/): 0;
        if ( ! args.length && endIndex)
        {
            arg = arg.substr(0, endIndex.index);
            renderClosingBracket = true;
        }

        // Render the active arg
        var strong = document.createElementNS("http://www.w3.org/1999/xhtml", "strong");
        strong.textContent = arg;
        fragment.appendChild(strong);
        
        if (args.length)
        {
            // Render the rest of the arguments
            args = ", " + args.join(",");
            fragment.appendChild(document.createTextNode(args));
        }
        else if (renderClosingBracket)
        {
            // We were already at the end, so add a closing bracket if required
            fragment.appendChild(document.createTextNode(')'));
        }

        return fragment;
    };

    this.start = () =>
    {
        w.addEventListener("buffer_char_modified", onCharModified);
        w.addEventListener("buffer_pos_changed", onPosChanged);

        commands.register("triggerPrecedingCalltip", this.checkForCalltip,
        {
            isEnabled: () => true,
            label: l.get("calltip.command.label")
        });
    };


    this.stop = () =>
    {
        w.removeEventListener("buffer_char_modified", onCharModified);
        w.removeEventListener("buffer_pos_changed", onPosChanged);
        commands.unregister("triggerPrecedingCalltip");
    };

}).apply(module.exports);
