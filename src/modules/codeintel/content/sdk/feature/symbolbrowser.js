(function()
{

    const {Cc, Ci}  = require("chrome");
    const log = require("ko/logging").getLogger("codeintel/feature/symbolbrowser");
    //log.setLevel(require("ko/logging").DEBUG);
    const codeintel = require("codeintel/codeintel");
    const service = require("codeintel/service");
    const mediator = require("codeintel/service/mediator");
    const koEditor = require("ko/editor");
    const l = require("ko/locale").use();
    const w = require("ko/windows").getMain();
    const legacy = w.ko;
    const commands = require("ko/commands");
    const _ = require("contrib/underscore");
    const views = require("ko/views");
    const prefs = require("ko/prefs");
    const $ = require("ko/dom");
    const timers = require("sdk/timers");
    const sysEvents = require("sdk/system/events");

    const id = "symbolbrowser-widget";
    const maxSize = prefs.getLong("codeintel.symbolbrowser.max_filesize");

    const DECK_LIST = 0;
    const DECK_LIMIT_REACHED = 1;
    const DECK_NOT_SUPPORTED = 2;
    const DECK_LOADING = 3;
    const DECK_ERROR = 4;
    const DECK_EMPTY = 5;

    var widget,
        widgetDocument,
        listbox,
        wrapper,
        editor,
        textbox,
        cog,
        deck,
        spinner;
    
    var gFilters = {}; // {} Stores filters per file


    var locateScope = prefs.getBoolean("codeintel.symbolbrowser.locate_scope");
    var sortType = prefs.getString("codeintel.symbolbrowser.sort");

    var onLoadWidget = () =>
    {
        log.debug("Widget loaded, initializing document");

        wrapper = require("ko/ui/column").create({ attributes: { flex: 1 } });

        var toolbar = require("ko/ui/row").create({ attributes: { class: "status-toolbar" } });

        var placeholder = l.get("symbolbrowser.filter_placeholder");
        textbox = require("ko/ui/textbox").create({ attributes: { flex: 1, placeholder: placeholder } });
        toolbar.addElement(textbox);

        cog = require("ko/ui/toolbarbutton").create({ attributes: { type: "menu", class: "cog-icon" } });
        toolbar.addElement(cog);

        var menupopup = require("ko/ui/menupopup").create({ position: "after_end" });
        cog.addElement(menupopup);

        // Locate current scope
        var locateScopeEl = require("ko/ui/menuitem").create(
        {
            label: l.get("symbolbrowser.locate_scope"),
            type: "checkbox",
            checked: prefs.getBoolean("codeintel.symbolbrowser.locate_scope")
        });
        locateScopeEl.on("command", _.debounce(() =>
        {
            var checked = locateScopeEl.attr("checked") == "true";
            prefs.setBoolean("codeintel.symbolbrowser.locate_scope", checked);
            locateScope = checked;
            this.updateActiveScope();
        }, 0));
        menupopup.addMenuItem(locateScopeEl);

        // Show all
        var showAllEl = require("ko/ui/menuitem").create(
        {
            label: l.get("symbolbrowser.showAll"),
            type: "checkbox",
            checked: prefs.getBoolean("codeintel.symbolbrowser.showall")
        });
        showAllEl.on("command", _.debounce(() =>
        {
            var checked = showAllEl.attr("checked") == "true";
            prefs.setBoolean("codeintel.symbolbrowser.showall", checked);
            this.update();
        }, 0));
        menupopup.addMenuItem(showAllEl);

        menupopup.addSeparator();

        // Sort alphabetically
        var sortAlpha = require("ko/ui/menuitem").create(
        {
            label: l.get("symbolbrowser.sort_alphabetically"),
            type: "radio",
            name: "sort",
            checked: sortType == "alpha"
        });
        sortAlpha.on("command", () =>
        {
            var checked = sortAlpha.attr("checked") == "true";
            var value = checked ? "alpha" : "organic";
            prefs.setString("codeintel.symbolbrowser.sort", value);
            sortType = value;
            sortOrganic.attr("checked", checked ? "false" : "true");
            this.update();
        });
        menupopup.addMenuItem(sortAlpha);

        // Sort by file order
        var sortOrganic = require("ko/ui/menuitem").create(
        {
            label: l.get("symbolbrowser.sort_file_order"),
            type: "radio",
            name: "sort",
            checked: sortType == "organic"
        });
        sortOrganic.on("command", () =>
        {
            var checked = sortOrganic.attr("checked") == "true";
            var value = checked ? "organic" : "alpha";
            prefs.setString("codeintel.symbolbrowser.sort", value);
            sortType = value;
            sortAlpha.attr("checked", checked ? "false" : "true");
            this.update();
        });
        menupopup.addMenuItem(sortOrganic);

        menupopup.on("popupshowing", (e) =>
        {
            if (e.target != menupopup.element)
                return;

            // Engine selection
            var view = views.current().get();
            var engineMenu = mediator.getMediatorMenu(view);
            if (engineMenu)
            {
                menupopup.$element.find(".mediator-selection").remove();
                menupopup.addSeparator({ class: "mediator-selection" });
                menupopup.addMenuItem(engineMenu);
            }
        });

        /* Deck */
        deck = require("ko/ui/deck").create({ flex: 1 });

        listbox = require("ko/ui/richlistbox").create({ attributes: { flex: 1, class: "bg_transparent" } });
        deck.addElement(listbox);

        /* Limit Box */
        var column = require("ko/ui/column").create({ align: "center", pack: "center", flex: 1 });
        column.addElement(require("ko/ui/description").create(l.get("symbolbrowser.limit_message")));
        deck.addElement(column);

        var overrideLimitBtn = require("ko/ui/button").create(l.get("symbolbrowser.override_limit"));
        overrideLimitBtn.on("command", () =>
        {
            var view = views.current().get();
            view._symbolbrowserByPassLimits = true;
            listbox.empty();
            this.update();
        });
        column.addElement(overrideLimitBtn);

        /* Not Supported Box */
        column = require("ko/ui/column").create({ align: "center", pack: "center", flex: 1 });
        column.addElement(require("ko/ui/description").create(l.get("symbolbrowser.not_supported")));
        deck.addElement(column);

        /* Spinner Box */
        column = require("ko/ui/column").create({ align: "center", pack: "center", flex: 1 });
        spinner = require("ko/ui/spinner").create();
        column.addElement(spinner);
        deck.addElement(column);
        
        /* Error Box */
        column = require("ko/ui/column").create({ align: "center", pack: "center", flex: 1 });
        column.addElement(require("ko/ui/description").create(l.get("symbolbrowser.error_loading")));
        overrideLimitBtn = overrideLimitBtn.$element.clone();
        overrideLimitBtn.attr("label", l.get("symbolbrowser.retry"));
        column.addElement(overrideLimitBtn);
        deck.addElement(column);
        
        /* Empty Box */
        column = require("ko/ui/column").create({ align: "center", pack: "center", flex: 1 });
        column.addElement(require("ko/ui/description").create(l.get("symbolbrowser.empty")));
        deck.addElement(column);

        wrapper.addElement(toolbar);
        wrapper.addElement(deck);

        widgetDocument = widget.contentWindow.document;
        widgetDocument.documentElement.appendChild(wrapper.element);
        widgetDocument.documentElement.classList.add("embedded");
        widgetDocument.documentElement.classList.remove("dialog");
        widgetDocument.documentElement.setAttribute("id", "symbolbrowser");

        listbox.on("click", onSelectSymbol);
        listbox.on("command", onSelectSymbol);
        textbox.on("input", onFilter);

        var widgetTab = $(legacy.widgets.getWidget(id).tab);
        widgetTab.on("command", onViewUpdated);

        this.loadForView();

        w.addEventListener('editor_view_opened', onViewChange);
        w.addEventListener('current_view_changed', onViewChange);
        w.addEventListener('view_document_attached', onViewUpdated);
        w.addEventListener('current_view_language_changed', onViewUpdated);
        
        sysEvents.on("codeintel-update", this.update);

        var codeDelay = prefs.getLong("codeintel.symbolbrowser.code_update_delay");
        w.addEventListener("buffer_char_modified", _.debounce(onCharModified, codeDelay));
    };

    var onSelectSymbol = (e) =>
    {
        var listitem = listbox.getSelectedItem();
        if ( ! listitem)
            return;

        var line = parseInt(listitem.getAttribute("symbol-line"));
        var pos = parseInt(listitem.getAttribute("symbol-pos"));

        if (line > -1)
            editor.gotoLine(line);
        else if (pos > -1)
            editor.gotoLine(editor._posToRelative(pos).line);

        // defer editor focus so it doesnt conflict with the select event
        timers.setTimeout(() => editor.focus(), 0);
    };
    
    var onViewUpdated = () =>
    {
        onViewChange(true);
    };

    var onViewChange = (force = false) =>
    {
        var view = views.current().get();
        if ( ! view )
            return;
        if ( ! force && onViewChange.lastUid == view.uid)
        {
            textbox.value(view._symbolBrowserFilter || "");
            this.filter(textbox.value());
            return;
        }
        onViewChange.lastUid = view.uid;
        updateDeck(DECK_LOADING);

        this.loadForView(view);
        this.update();
    };
    onViewChange.lastUid = null;
    
    var onCharModified = () =>
    {
        this.update();
    };

    var onPosChange = () =>
    {
        this.updateActiveScope();
    };

    var onFilter = () =>
    {
        let _filter = textbox.value();
        require("ko/views").current().get()._symbolBrowserFilter = _filter;
        this.filter(_filter);
    };

    var updateDeck = (idx) =>
    {
        spinner.hide();
        if (idx == DECK_LOADING)
            spinner.show();
        deck.index(idx);
    };

    this.loadForView = (view, reload = false) =>
    {
        if ( ! view)
            view = views.current().get();
            
        textbox.value(view._symbolBrowserFilter || "");

        if (reload && view && view._symbolbrowser)
        {
            view._symbolbrowser.close();
            delete view._symbolbrowser;
        }

        if ( ! view || view._symbolbrowser)
        {
            listbox.empty();
            return;
        }

        view.addEventListener("buffer_pos_changed", onPosChange);

        log.debug("Loading for current view");
        
        if ( ! service.supportsFeature(codeintel.FEATURE_SYMBOLBROWSER, view.language))
        {
            view._symbolbrowser = false;
            return;
        }

        view._symbolbrowser = true;
        this.update();
    };

    this.update = () =>
    {
        var view = views.current().get();
        if (deck.index() != DECK_LIST)
        {
            updateDeck(DECK_LOADING);
        }
        _update();
    };

    var _update = _.debounce(() =>
    {
        // Todo: symbollist causes very similar API calls, rather than having
        // both bug codeintel we should try and combine them somehow (without caching)

        log.debug("Updating for current view");

        if ( ! legacy.uilayout.isTabShown(id))
        {
            log.debug("Skipping, widget is not visible");
            return;
        }

        var view = views.current().get();

        if ( ! view.prefs)
        {
            log.debug("Cancelling, view.prefs is not defined (probably shutting down)");
            return;
        }

        var indentString = "\t";
        var useTabs = view.prefs.getBoolean("useTabs");
        if ( ! useTabs)
        {
            var width = view.prefs.getLong("indentWidth");
            indentString = Array(width+1).join(" ");
        }

        if ( ! view._symbolbrowser)
        {
            log.debug("Not supported, cancelling update");
            listbox.empty();
            updateDeck(DECK_NOT_SUPPORTED);
            return;
        }

        var uuid = require('sdk/util/uuid').uuid();
        _update.uuid = uuid;

        editor = koEditor.editor(view.scintilla, view.scimoz);

        if ( ! view._symbolbrowserByPassLimits && editor.getLength() > maxSize)
        {
            updateDeck(DECK_LIMIT_REACHED);
            return;
        }

        service.getSymbolsInBuffer(
        {
            buf: editor.getValue(),
            line: editor.getLineNumber(),
            pos: view.scimoz.currentPos,
            indentString: indentString,
            language: view.language,
            sortType: sortType
        })
        .then((members) =>
        {
            // Stop if we're in a race condition
            if (uuid != _update.uuid)
            {
                log.debug("Active uuid changed, cancelling this update");
                return;
            }

            if ( ! members || ! members.length)
            {
                updateDeck(DECK_EMPTY);
                log.debug("No symbols detected");
                return;
            }

            log.debug(`Received results, ${members.length} root scopes`);

            var fragment = $(widgetDocument.createDocumentFragment());
            var showAll = prefs.getBoolean("codeintel.symbolbrowser.showall");
            var activeSymbol = null;

            var parents = [members];
            while (parents.length) // use while loop to avoid recursion
            {
                let parent = parents[parents.length-1];
                if ( ! parent.length)
                {
                    parents.pop();
                    continue;
                }

                let symbol = parent.shift();

                if ( ! showAll && ! symbol.isScope)
                    continue;

                if ( ! showAll && symbol.type == "STRU" && ! symbol.members.length)
                    continue;
                    
                if ( ! symbol.line && ! symbol.members.length )
                    continue; // ignore empty language namespaces

                let symbolLabel = l.get(`symbol.${symbol.type}`).replace(/^symbol\./, '');
                let level = parents.length - 1;

                // We're not using UI/DOM SDK's here as this loop can have a ton
                // of elements and those SDK's will be costly.

                let item = w.document.createElement("richlistitem");
                item.setAttribute("symbol", symbol.type);
                item.setAttribute("symbol-name", symbol.name);
                item.setAttribute("symbol-label", symbolLabel);
                item.setAttribute("symbol-line", symbol.line);
                item.setAttribute("symbol-pos", symbol.pos);
                item.setAttribute("active", symbol.active);

                let indentation = w.document.createElement("vbox");
                indentation.setAttribute("class", "indentation");
                indentation.style.width = `${(level) * 16}px`;
                item.appendChild(indentation);

                let image = w.document.createElement("vbox");
                image.setAttribute("class", "codeintel_image");
                image.setAttribute("type", symbol.type);
                item.appendChild(image);

                let label = w.document.createElement("label");
                label.setAttribute("value", symbol.name);
                item.appendChild(label);

                let separator = w.document.createElement("separator");
                separator.setAttribute("flex", 1);
                item.appendChild(separator);

                let desc = w.document.createElement("label");
                desc.setAttribute("value", symbolLabel);
                desc.setAttribute("disabled", true);
                item.appendChild(desc);

                fragment.append(item);

                if (symbol.active)
                    activeSymbol = symbol;

                if (symbol.members.length)
                {
                    parents.push(symbol.members);
                }
            }
            
            if (fragment.childCount() === 0)
            {
                updateDeck(DECK_EMPTY);
                log.debug("No symbols detected");
                return;
            }

            log.debug("Processed results");

            updateDeck(DECK_LIST);
            listbox.empty();
            listbox.$element.append(fragment);

            log.debug("Rendered results");

            this.selectSymbol(activeSymbol);
            this.filter(textbox.value());
        })
        .catch((data) =>
        {
            updateDeck(DECK_ERROR);
            log.error(data.message);
        });
    }, prefs.getLong("codeintel.symbolbrowser.debounce_delay"));
    _update.uuid = null;

    this.filter = (filter) =>
    {
        filter = filter.trim().toLowerCase();
        var words = filter.split(/\s+/g);
        var shortest = -1;
        var shortestMatchesStart = false;
        var shortestElem = null;

        listbox.$element.find("richlistitem").each(function()
        {
            let item = $(this);

            let label = item.attr("symbol-name").toLowerCase();
            let itemValue = label + item.attr("symbol-label");
            itemValue = itemValue.toLowerCase();

            for (let word of words)
            {
                if (itemValue.indexOf(word) == -1)
                {
                    item.hide();
                    return;
                }
            }

            let matchesStart = label.indexOf(filter) === 0;
            if (shortest == -1 ||
                ((label.length < shortest && matchesStart == shortestMatchesStart) || (matchesStart && ! shortestMatchesStart)))
            {
                shortest = label.length;
                shortestElem = item;
                shortestMatchesStart = matchesStart;
            }

            item.show();
        });

        if (shortestElem)
        {
            listbox.element.selectedItem = shortestElem.element();
        }
    };

    this.updateActiveScope = _.debounce(() =>
    {
        if ( ! locateScope)
            return;

        log.debug("Updating Scope");

        if ( ! legacy.uilayout.isTabShown(id))
        {
            log.debug("Skipping, widget is not visible");
            return;
        }

        var view = views.current().get();

        if ( ! view._symbolbrowser)
        {
            log.debug("Not supported, cancelling updateActiveScope");
            return;
        }

        editor = koEditor.editor(view.scintilla, view.scimoz);

        if ( ! view._symbolbrowserByPassLimits && editor.getLength() > maxSize)
        {
            return;
        }

        service.getCaretScope(
        {
            buf: editor.getValue(),
            line: editor.getLineNumber(),
            pos: view.scimoz.currentPos,
            language: view.language
        })
        .then((scope) =>
        {
            this.selectSymbol(scope);
        });
    }, prefs.getLong("codeintel.symbolbrowser.scope_update_delay"));

    this.selectSymbol = (symbol) =>
    {
        listbox.element.clearSelection();

        if ( ! symbol)
        {
            return;
        }

        log.debug("Selecting symbol: " + symbol.name);

        var item = listbox.$element.find(`richlistitem[symbol-name="${symbol.name}"][symbol-line="${symbol.line}"]`);
        listbox.element.selectedItem = item.length ? item.element() : null;
        let currentIndex = listbox.element.currentIndex;
        let buffer = 5;
        try
        {
            buffer = require("ko/prefs").getLong("codeintel.symbolbrowser.buffer");
        } catch(e)
        {/*nothing to do*/}
        let i = currentIndex - buffer;
        // make sure there is a buffer of space above && below the current scope
        // Makes things easier to read for the user.
        for(; i <= currentIndex + buffer; i++)
        {
            // Chose not to optimize this for cleaner code.
            listbox.element.ensureIndexIsVisible(i);
        }
    };

    this.start = () =>
    {
        commands.register("viewSymbolBrowser", () => {require("ko/windows").getMain().ko.uilayout.toggleTab("symbolbrowser-widget");},
        {
            isEnabled: () => {},
            label: l.get("symbolbrowser.command_label")
        });
        
        widget = legacy.widgets.getWidget(id);

        if ( ! widget)
        {
            log.debug("Registering widget");

            legacy.widgets.registerWidget(id, l.get("symbolbrowser.label"), "chrome://komodo/content/empty_widget.xul", {
                defaultPane: "workspace_right_area",
                attrs: {
                    id: id,
                },
                forceLoad: true,
                persist: true,
                show: true,
                iconURL: "koicon://ko-svg/chrome/icomoon/skin/ko_code2.svg"
            });

            widget = legacy.widgets.getWidget(id);
            widget.contentWindow.addEventListener("load", onLoadWidget);
        }
    };
    
    this.stop = () =>
    {
        widget.contentWindow.removeEventListener("load", onLoadWidget);

        w.removeEventListener('editor_view_opened', onViewChange);
        w.removeEventListener('current_view_changed', onViewChange);
        w.removeEventListener('view_document_attached', onViewUpdated);
        w.removeEventListener('current_view_language_changed', onViewUpdated);

        sysEvents.off("codeintel-update", this.update);
    };
    
}).apply(module.exports);
