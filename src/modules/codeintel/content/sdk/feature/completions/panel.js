(function()
{
    const {Cc, Ci}  = require("chrome");
    const log = require("ko/logging").getLogger("codeintel/feature/completions/panel");
    const koEditor = require("ko/editor");
    const service = require("codeintel/service");
    const prefs = require("ko/prefs");
    const codeintel = require("codeintel/codeintel");
    const calltips = require("codeintel/feature/calltips");
    const cpl = require("codeintel/feature/completions");
    const l = require("ko/locale").use();
    const timers = require("sdk/timers");
    const w = require("ko/windows").getMain();

    var ignoreNextEvent = false;

    var banned = {
        NMSP: [ "CSS", "HTML", "JavaScript" ]
    };

    var Panel = function(view, completions, startPos, uuid)
    {
        var panel;
        var listbox, editor, query, signature;
        var destroyed = false;
        var onDestroyCallbacks= [];
        var wordRx, queryRx;
        var language;

        this.view = view;
        this.symbol = completions.symbol;
        this.startPos = startPos;
        this.invoking = false;
        this.uuid = uuid;
            
        var maxResults = prefs.getLong("codeintel.completions.max_results");
        var maxResultsHard = prefs.getLong("codeintel.completions.max_results_hard");
        var autoShowCalltips = prefs.getBoolean("codeintel.calltips.while_typing");

        var init = () =>
        {
            editor = koEditor.editor(view.scintilla, view.scimoz);
            var pos = editor.getCursorPosition("absolute");
            
            language = service._getLanguageInfo(view.language);

            wordRx = new RegExp(`[${language.completion_word_characters || "\\w_\\-"}]`);
            queryRx = new RegExp(`[${language.completion_query_characters || language.completion_word_characters}]`);
            query = editor.getWord(pos, queryRx);

            panel = view.ownerDocument.getElementById('completions-panel');
            if (panel)
            {
                panel = panel._panelWrapper;
            }
            else
            {
                panel = require("ko/ui/panel").create({ attributes:
                {
                    id: "completions-panel",
                    level: "floating",
                    noautofocus: true,
                    class: "dialog"
                } });
                panel.element._panelWrapper = panel;
            }
            
            panel.$element.empty();

            signature = require("ko/ui/description").create({ class: "calltip-signature" });
            if (completions.docblock && ! autoShowCalltips)
            {
                var row = require("ko/ui/row").create({ class: "signature-wrapper" });
                row.addElement(signature);
                row.addElement(require("ko/ui/spacer").create({ flex: 1 }));

                var info = require("ko/ui/button").create({
                    label: "i",
                    accesskey: "i"
                });
                row.addElement(info);
                info.on("command", onPressInfo);
                panel.addElement(row);
            }

            listbox = require("ko/ui/richlistbox").create({ attributes: { class: "bg_transparent" } });
            listbox.on("select", onSelectItem);

            renderEntries(completions);

            if (listbox.$element.childCount() === 0)
            {
                this.destroy();
                return;
            }

            panel.addElement(listbox);

            var cursorPos = editor.getCursorWindowPosition();
            var lh = editor.defaultTextHeight();
            panel.open({ anchor: view.ownerDocument.documentElement, x: cursorPos.x, y: cursorPos.y + lh });

            panel.element.addEventListener("popuphiding", onHide);
            view.addEventListener("keydown", onKeyPress);
            panel.element.addEventListener("dblclick", invokeSelection);

            onSelectItem();
            this.updatePosition();

            w.addEventListener("after_command", this.onCommand);
        };

        this.update = (newCompletions, startPos) =>
        {
            if (newCompletions)
                completions = newCompletions;

            if (startPos)
                this.startPos = startPos;

            query = editor.getWord(this.startPos, queryRx);

            // Replace with temp listbox so we're not updating the DOM for every listitem
            var tmpListbox = listbox.element.cloneNode();

            ignoreNextEvent = true;
            listbox.$element.replaceWith(tmpListbox);
            ignoreNextEvent = false;

            renderEntries(completions);

            ignoreNextEvent = true;
            tmpListbox.parentNode.replaceChild(listbox.element, tmpListbox);
            ignoreNextEvent = false;

            onSelectItem();
            this.updatePosition();

            if (listbox.$element.childCount() === 0 && completions.entries.length == maxResultsHard)
            {
                cpl.checkForCompletions(view);
                return;
            }

            if (listbox.$element.childCount() === 0 && ! completions.signature)
            {
                this.destroy();
                return;
            }
        };

        this.updatePosition = () =>
        {
            var pos = editor.getCursorWindowPosition(true);
            var lh = editor.defaultTextHeight();
            panel.element.moveTo(pos.x, pos.y + lh);
            panel.$element.removeAttr("height");
        };

        var renderEntries = (completions, cont=false) =>
        {
            if ( ! cont)
            {
                listbox.removeAllItems();
                signature.hide();

                if (completions.signature && codeintel.isFeatureEnabled(codeintel.FEATURE_CALLTIPS))
                {
                    signature.show();
                    signature.empty();
                    signature.addElement(calltips.getFormattedSignature(completions.signature, editor));
                }
            }
            else
            {
                listbox.$element.find(".completion-show-all").remove();
            }
            
            var firstEntry = true;
            query = editor.getWord(editor.getCursorPosition("absolute"), queryRx).toLowerCase();
            
            var count = 0;
            var added = 0;

            var showMatches = prefs.getBoolean("codeintel.completions.show_matches");

            for (let symbol of completions.entries)
            {
                count++;

                if (query && (( ! showMatches && query == symbol.name) || symbol.name.toLowerCase().indexOf(query) !== 0))
                    continue;

                if (cont && count <= maxResults)
                    continue;

                if (symbol.type in banned && banned[symbol.type].indexOf(symbol.name) != -1)
                    continue;
                
                if (( ! cont && added === maxResults) || added === maxResultsHard)
                {
                    if (completions.entries.length > maxResults)
                    {
                        let listitem = require("ko/ui/richlistitem").create({ class: "completion-show-all" });
                        listitem.addElement(require("ko/ui/label").create(l.get("completions.show_all")));
                        listbox.addListItem(listitem);
                    }
                    break;
                }

                let listitem = require("ko/ui/richlistitem").create( { attributes:
                {
                    selected: firstEntry,
                    value: symbol.name
                } } );
                listitem.element._symbol = symbol;

                var column = require("ko/ui/column").create({ flex: 1 });
                listitem.addElement(column);

                var row = require("ko/ui/row").create();
                column.addElement(row);

                let img = require("ko/ui/container").create({ attributes: { class: "codeintel_image", type: symbol.type } });
                let sourceImg = require("ko/ui/container").create({ attributes: { class: "codeintel_source_image", source: symbol.source } });
                let label = require("ko/ui/label").create(symbol.name);

                let symbolLabel = l.get(`symbol.${symbol.type}`).replace(/^symbol\./, '');
                symbolLabel = require("ko/ui/label").create(symbolLabel, { disabled: true });

                row.addElement(sourceImg);
                row.addElement(img);
                row.addElement(label);
                row.addElement(require("ko/ui/spacer").create({ flex: 1 }));
                row.addElement(symbolLabel);

                firstEntry = false;

                listbox.addListItem(listitem);
                added++;
            }
        };

        this.isOpen = () =>
        {
            return panel.element.state == "open";
        };

        var onKeyPress = (e) =>
        {
            if (listbox.$element.childCount() === 0)
                return;
            if (e.shiftKey || e.altKey)
                return;
            if ( (e.ctrlKey || e.metaKey) && ([38, 40].indexOf(e.keyCode) == -1) )
                return;

            switch (e.keyCode)
            {
                case 13: /* enter */
                case 9:  /* tab */
                    invokeSelection();
                    break;
                case 38: /* up */
                    if (e.ctrlKey || e.metaKey)
                        listbox.element.moveByOffset(-(listbox.element.currentIndex+1), true, false);
                    else
                        listbox.moveSelectionUp();
                    break;
                case 40: /* down */
                    if (e.ctrlKey || e.metaKey)
                    {
                        listbox.element.moveByOffset(listbox.element.itemCount-(listbox.element.currentIndex - 1), true, false);
                        timers.setTimeout(()=>
                            {
                                listbox.element.moveByOffset(listbox.element.itemCount-(listbox.element.currentIndex - 1), true, false);
                            }, 50);
                    }
                    else
                        listbox.moveSelectionDown();
                    break;
                case 33: /* pgup */
                    listbox.element.selectedIndex = 0;
                    break;
                case 34: /* pgdn */
                    listbox.element.selectedIndex = listbox.element.childNodes.length-1;
                    timers.setTimeout(() =>
                    {
                        // Repeat to invoke after "show all" is triggered
                        listbox.element.selectedIndex = listbox.element.childNodes.length-1;
                    }, 50);
                    break;
                default:
                    return;
            }

            e.preventDefault();
            e.stopPropagation();
            return false;
        };
        
        var onSelectItem = () =>
        {
            if (ignoreNextEvent)
            {
                ignoreNextEvent = false;
                return;
            }

            var item = listbox.$element.find("richlistitem[selected=\"true\"]").element();
            if ( ! item || item.firstChild.childNodes.length > 1)
            {
                return;
            }
            
            var symbol = item._symbol;
            
            if ( ! symbol)
            {
                // If this isn't a symbol entry we can assume it's the "show all" entry
                renderEntries(completions, true);
                timers.setTimeout(() =>
                {
                    // Work around stupid XUL bug where it has a hissy fit
                    // when items in an existing listbox get the selected attribute
                    // written to them
                    listbox.$element.find("[selected]").removeAttr("selected");
                    listbox.setSelectedIndex(maxResults);
                    onSelectItem(); // trigger again but this time for the newly selected item
                }, 0);
                return;
            }

            var column = item.firstChild._sdk;
            var row = require("ko/ui/row").create({ class: "completion-info", disabled: true });
            
            /* Show the source of the symbol */
            var source;
            if (source == "external" && symbol.filename)
                source = symbol.filename;
            else
                source = l.get("source_" + symbol.source);
                
            var label;
            if ( ! symbol.line)
                label = l.get("source_s", source);
            else
                label = l.get("source_s_line_n", source, symbol.line);

            row.addElement(require("ko/ui/label").create(label));

            /* Show how many properties the symbol has */
            if (symbol.isScope)
            {
                var members = symbol.members.length;
                label = l.get("properties_n", members);
                row.addElement(require("ko/ui/spacer").create({ flex: 1 }));
                row.addElement(require("ko/ui/label").create(label));
            }

            column.addElement(row);
        };

        var onPressInfo = () =>
        {
            calltips.checkForCalltip(view);
            editor.focus();
        };

        var invokeSelection = () =>
        {
            var listitem = listbox.getSelectedItem();
            if ( ! listitem)
                return;

            var word = editor.getWord(wordRx);
            var pos = editor.getCursorPosition("absolute");
            var wordLeft = editor.getWord(pos, wordRx);

            if (word)
            {
                editor.deleteRange(pos - wordLeft.length, word.length);
                editor.setCursor(pos - wordLeft.length);
            }

            var symbol = listitem._symbol;
            var value = listitem.getAttribute("value");

            if (language.completion_prefixes && symbol.type in language.completion_prefixes)
            {
                var prefix = language.completion_prefixes[symbol.type];
                if (value.substr(0, prefix.length) !== prefix)
                    value = prefix + value;
            }

            var suffix;
            if (language.completion_suffixes && symbol.type in language.completion_suffixes)
            {
                suffix = language.completion_suffixes[symbol.type];
                if (value.substr(0-suffix.length) !== suffix)
                    value = value + suffix;
            }
            else
            {
                this.invoking = true;
            }

            editor.insert(value);

            timers.setTimeout(() =>
            {
                view.languageObj.keyPressed(value.substr(-1), view.scimoz);
                pos = editor.getCursorPosition("absolute");
                view.finish_autocomplete(pos);
            }, 0);

            this.destroy();

            if (suffix)
            {
                cpl.checkForCompletions(view);
            }
        };

        var onHide = () =>
        {
            this.destroy();
        };
        
        this.destroy = () =>
        {
            view.removeEventListener("keydown", onKeyPress);
            panel.element.removeEventListener("dblclick", invokeSelection);

            if (panel.element.state == "open" || panel.element.state == "showing")
                panel.element.hidePopup();
                
            for (let callback of onDestroyCallbacks)
                callback();
                
            destroyed = true;
            w.removeEventListener("after_command", this.onCommand);
        };

        this.onDestroy = (callback) =>
        {
            onDestroyCallbacks.push(callback);
            
            if (destroyed)
                callback(); // already destroyed
        };
        
        this.onCommand = (e) =>
        {
            if (e.detail == "cmd_cancel")
                this.destroy();
        };

        init();
    };

    module.exports = Panel;

})();
