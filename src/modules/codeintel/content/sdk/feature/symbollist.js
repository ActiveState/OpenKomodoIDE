(function()
{

    const {Cc, Ci}  = require("chrome");
    const log = require("ko/logging").getLogger("codeintel/feature/symbollist");
    const obsvc = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
    const codeintel = require("codeintel/codeintel");
    const service = require("codeintel/service");
    const mediator = require("codeintel/service/mediator");
    const koEditor = require("ko/editor");
    const prefs = require("ko/prefs");
    const w = require("ko/windows").getMain();
    const l = require("ko/locale");
    const $ = require("ko/dom");
    const views = require("ko/views");
    const _ = require("contrib/underscore");
    const timers = require("sdk/timers");
    const sysEvents = require("sdk/system/events");
    const menu = require("ko/menu");


    const maxSize = prefs.getLong("codeintel.symbollist.max_filesize");

    //log.setLevel(10);

    var SymbolList = function(view)
    {
        var button,
            menupopup,
            textbox,
            editor,
            $view;

        var init = () =>
        {
            log.debug("Activating SymbolList");

            editor = koEditor.editor(view.scintilla, view.scimoz);
            $view = $(view);

            button = require("ko/ui/toolbarbutton").create({ attributes:
            {
                anonid: "symbollist",
                label: l.get("symbollist.empty_scope"),
                flex: 1
            } });
            button.on("command", onActivateButton);
            
            $view.on("buffer_pos_changed", onPosChange);

            var parent = $view.findAnonymous("anonid", "statusbar-message-deck-default");
            parent.append(button.$element);

            sysEvents.on("codeintel-update", this.updateLabel);

            this.updateLabel();
        };

        var onActivateButton = () =>
        {
            this.openMenu();
        };

        var onPosChange = (e) =>
        {
            this.updateLabel();
        };

        var onSelectSymbol = (e) =>
        {
            var menuitem = e.target;
            var line = menuitem.getAttribute("symbol-line");
            menupopup.hide();
            editor.gotoLine(line);
        };

        var onHideMenu = (e) =>
        {
            menupopup = null;
            editor.focus();
        };

        var onFilter = () =>
        {
            this.filter(textbox.value());
        };

        var onKeyDown = (e) =>
        {
            if (this.openMenu.inProgress)
                return;

            switch (e.keyCode)
            {
                case 13: /* ENTER */
                    e.preventDefault();
                    e.stopPropagation();

                    var menuitem = menupopup.$element.find("[_moz-menuactive]");
                    if (menuitem.length)
                        menuitem.trigger("command");

                    break;

                case 27: /* ESCAPE */
                    e.preventDefault();
                    e.stopPropagation();
                    menupopup.hide();
                    break;

                // Up / Down arrow
                case 38:
                case 40:
                    onNavY(e);
                    break;
            }
        };

        var onNavY = (e) =>
        {
            e.preventDefault();
            e.stopPropagation();

            var menuitem = menupopup.$element.find("[_moz-menuactive]");
            var menuitemNext = null;
            var atTailEnd = false;

            if (menuitem.length)
            {
                var children = menupopup.$element.find("menuitem.entry:not([collapsed])");
                for (let i=0; i < children.length; i++)
                {
                    let child = children.element(i);
                    if (child == menuitem.element())
                    {
                        let idx = e.keyCode == 38 /* up */ ? i-1 : i+1;
                        if (idx < 0 || idx == children.length)
                            atTailEnd = true;
                        else
                            menuitemNext = $(children.element(idx));

                        break;
                    }
                }
            }

            var tailEnd = null;
            if ( ! menuitem.length || atTailEnd)
            {
                tailEnd = e.keyCode == 38 /* up */ ? -1 : 0;
                menuitemNext = $(menupopup.$element.find("menuitem.entry:not([collapsed])").element(tailEnd));
            }

            selectMenuItem(menuitemNext);
            menuitemNext.element().scrollIntoView();

            // workaround XUL bug where it doesnt scroll into view the tail / start menu item
            var method = "next";
            if (e.keyCode == 38 /* up */)
                method = "prev";

            var sibling = menuitem[method]()[method]()[method]();
            if (sibling.length > 0)
            {
                sibling.element().scrollIntoView();
                menuitemNext.element().scrollIntoView();
            }
        };

        var selectMenuItem = (menuitem) =>
        {
            menupopup.$element.find("[_moz-menuactive]").removeAttr("_moz-menuactive");
            menuitem.attr("_moz-menuactive", "true");
        };

        this.updateLabel = _.debounce(() =>
        {
            log.debug("Updating Label");

            if (editor.getLength() > maxSize)
            {
                log.debug("Buffer is too big");
                button.attr("label", l.get("symbollist.empty_scope"));
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
                if ( ! scope)
                {
                    log.debug("Outside of any scope");

                    button.attr("label", l.get("symbollist.empty_scope"));
                    button.removeAttr("symbol");
                    return;
                }

                log.debug("Using scope: " + scope.name);
                button.attr("label", scope.name);
                button.attr("symbol", scope.type);
                button.trigger("symbollist_updated");
            });
        }, prefs.getLong("codeintel.symbollist.scope_update_delay"));

        this.openMenu = () =>
        {
            // prevent repeat calls
            if (this.openMenu.inProgress)
                return;

            log.debug("Opening Menu");

            if (menupopup)
            {
                menupopup.hide();
                menupopup.remove();
                menupopup = null;
            }

            $("#symbollist-menupopup").remove(); // failsafe

            menupopup = require("ko/ui/menupopup").create({ attributes:
            {
                id: "symbollist-menupopup",
                ignorekeys: true
            } });
            menupopup.addMenuItem(l.get("loading"));
            $("#komodoMainPopupSet").append(menupopup.element);

            menupopup.on("command", onSelectSymbol);
            menupopup.on("popuphidden", onHideMenu);
            menupopup.on("keydown", onKeyDown);

            this.openMenu.inProgress = true;

            var position = "after_start";
            var appendMethod = "prepend";
            if (prefs.getBoolean("ui.classic.statusbar"))
            {
                position = "before_start";
                appendMethod = "append";
            }

            var showAll = prefs.getBoolean("codeintel.symbollist.showall");

            var indentString = "\t";
            var useTabs = view.prefs.getBoolean("useTabs");
            if ( ! useTabs)
            {
                var width = view.prefs.getLong("indentWidth");
                indentString = Array(width+1).join(" ");
            }

            service.getSymbolsInBuffer(
            {
                buf: editor.getValue(),
                line: editor.getLineNumber(),
                pos: view.scimoz.currentPos,
                indentString: indentString,
                language: view.language,
                sortType: "organic"
            })
            .then((members) =>
            {
                if ( ! members)
                {
                    log.debug("No symbols detected");
                    return;
                }

                log.debug(`Received results, ${members.length} root scopes`);

                menupopup.empty();

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

                    let symbolLabel = l.get(`symbol.${symbol.type}`);
                    let level = parents.length - 1;

                    menupopup.addMenuItem({ attributes:
                    {
                        label: symbol.name,
                        acceltext: symbolLabel,
                        symbol: symbol.type,
                        'symbol-label': symbolLabel,
                        'symbol-line': symbol.line,
                        style: `padding-left: calc(6px + ${level}rem)`,
                        class: "entry"
                    } });

                    if (symbol.members.length)
                    {
                        parents.push(symbol.members);
                    }
                }

                var separator = require("ko/ui/menuseparator").create();
                menupopup.$element[appendMethod](separator.element);

                // Engine selection
                var engineMenu = mediator.getMediatorMenu(view);
                if (engineMenu)
                {
                    menupopup.$element[appendMethod](engineMenu.element);
                    separator = require("ko/ui/menuseparator").create();
                    menupopup.$element[appendMethod](separator.element);
                }

                var showAllItem = require("ko/ui/menuitem").create({ attributes:
                {
                    label: l.get("symbollist.showAll"),
                    type: "checkbox",
                    checked: showAll
                }});
                showAllItem.on("command", (e) =>
                {
                    prefs.setBoolean("codeintel.symbollist.showall", ! showAll);

                    e.preventDefault();
                    e.stopPropagation();

                    menupopup.hide();
                    this.openMenu();
                });
                menupopup.$element[appendMethod](showAllItem.element);

                textbox = require("ko/ui/textbox").create({ attributes: { flex: 1 } });
                var textboxmenuitem = require("ko/ui/menuitem").create();
                textboxmenuitem.addElement(textbox);
                menupopup.$element[appendMethod](textboxmenuitem.element);

                textbox.onChange(onFilter);
                textbox.focus();

                this.openMenu.inProgress = false;
            })
            .catch((data) =>
            {
                menupopup.empty();
                this.openMenu.inProgress = false;
                log.error(data.message);
            });

            menupopup.open(button.element, position);
        };
        this.openMenu.inProgress = false;
            
        this.filter = (filter) =>
        {
            filter = filter.trim().toLowerCase();
            var words = filter.split(/\s+/g);
            var shortest = -1;
            var shortestMatchesStart = false;
            var shortestElem = null;

            menupopup.$element.find("menuitem.entry").each(function()
            {
                let menuitem = $(this);

                let label = menuitem.attr("label").toLowerCase();
                let itemValue = label + menuitem.attr("symbol-label");
                itemValue = itemValue.toLowerCase();

                for (let word of words)
                {
                    if (itemValue.indexOf(word) == -1)
                    {
                        menuitem.attr("collapsed", "true");
                        return;
                    }
                }
                
                let matchesStart = label.indexOf(filter) === 0;
                if (shortest == -1 ||
                    ((label.length < shortest && matchesStart == shortestMatchesStart) || (matchesStart && ! shortestMatchesStart)))
                {
                    shortest = label.length;
                    shortestElem = menuitem;
                    shortestMatchesStart = matchesStart;
                }

                menuitem.removeAttr("collapsed");
            });

            if (shortestElem)
            {
                selectMenuItem(shortestElem);
            }
        };

        this.close = () =>
        {
            $view.off("buffer_pos_changed", onPosChange);
            button.remove();
            sysEvents.off("codeintel-update", this.updateLabel);
        };

        init();

    };

    var onViewAttached = (view) =>
    {
        this.loadForView(view);
    };

    var onViewLangChange = (view) =>
    {
        if ( ! view) return;
        this.loadForView(view, true);
    };
    
    var onInvoke = () =>
    {
        this.invoke(views.current().get());
    };

    this.loadForView = (view, reload = false) =>
    {
        if ( ! view)
            view = views.current().get();

        if (view && view._symbollist === true)
        {
            // Wait for the current symbol list to finish loading before we load another
            timers.setTimeout(this.loadForView.bind(null, view, reload), 100);
            return;
        }

        if (reload && view && view._symbollist)
        {
            view._symbollist.close();
            delete view._symbollist;
        }

        if ( ! view || view._symbollist)
            return;

        view._symbollist = true;

        if ( ! service.supportsFeature(codeintel.FEATURE_SYMBOLLIST, view.language))
        {
            view._symbollist = false;
            return;
        }

        view._symbollist = new SymbolList(view);
    };
    
    this.invoke = (view) =>
    {
        if ( ! view._symbollist)
            return;
        
        view._symbollist.openMenu();
    };

    var onViewOpened = (e) => onViewAttached(e.detail.view);
    var onViewChanged = (e) => onViewAttached(e.originalTarget);
    var onViewLangChanged = (e) => onViewLangChange(e.originalTarget);

    this.start = () =>
    {
        w.addEventListener('editor_view_opened', onViewOpened);
        w.addEventListener('current_view_changed', onViewChanged);
        w.addEventListener('view_document_attached', onViewChanged);
        w.addEventListener('current_view_language_changed', onViewLangChanged);
        require("ko/commands").register("showSymbolList", onInvoke, { label: l.get("symbollist.command_label") });

        // Add it to the Navigation menu
        menu.register({
            id: "menu_showSectionList",
            label: l.get("symbollist.menu_label"),
            context: [
                {
                    select: "#naviation_menupopup",
                    before: "#naviation_menupopup_bookmarks_separator"
                }
            ],
            attributes: {
                observes: "cmd_showSymbolList"
            }
        });
            
        this.loadForView();
    };

    this.stop = () =>
    {
        w.removeEventListener('editor_view_opened', onViewOpened);
        w.removeEventListener('current_view_changed', onViewChanged);
        w.removeEventListener('view_document_attached', onViewChanged);
        w.removeEventListener('current_view_language_changed', onViewLangChanged);
    };

}).apply(module.exports);
