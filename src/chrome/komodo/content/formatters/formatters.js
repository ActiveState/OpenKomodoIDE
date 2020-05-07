/* Copyright (c) 2000-2008 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

if (typeof(ko) == 'undefined') {
    ko = {};
}
if (typeof(ko.formatters) == 'undefined') {
    ko.formatters = {};
}

/* Create the ko.formatters scope. */
(function() {

    /************************************************************
     *        Globals                                           *
     ************************************************************/

    var log = ko.logging.getLogger('ko.formatters');
    //log.setLevel(ko.logging.LOG_DEBUG);
    const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    const FORMAT_SELECTION = Components.interfaces.koIFormatterContext.FORMAT_SELECTION;
    const FORMAT_BLOCK = Components.interfaces.koIFormatterContext.FORMAT_BLOCK;
    const FORMAT_TEXT = Components.interfaces.koIFormatterContext.FORMAT_TEXT;
    // Variable to hold the number of highlighting events that have occurred.
    var highlight_count = 0;

    /************************************************************
     *         Controller for the formatter commands            *
     ************************************************************/

    // Hide this controller from our global namespace, we simply dont need to
    // touch anything in it from the outside world.
    function FormattersController() {
        ko.main.addWillCloseHandler(this.destructor, this);
    }

    // The following two lines ensure proper inheritance (see Flanagan, p. 144).
    FormattersController.prototype = new xtk.Controller();
    FormattersController.prototype.constructor = FormattersController;

    FormattersController.prototype.destructor = function() {
        window.controllers.removeController(this);
    }

    FormattersController.prototype._is_formatting_enabled = function(view) {
        if (!view || view.getAttribute('type') != 'editor') {
            return false;
        }
        var scimoz = view.scimoz;
        if (!scimoz) return false;
        return scimoz.selectionMode != scimoz.SC_SEL_RECTANGLE;
    };

    FormattersController.prototype._check_formatting_enabled = function(view) {
        if (!this._is_formatting_enabled(view)) {
            var msg = "Formatting of a rectangular selection isn't supported";
            require("notify/notify").send(msg, "formatting", {priority: "warning"});
            log.error(msg);
            return false;
        }
        return true;
    };

    FormattersController.prototype.is_cmd_format_enabled = function () {
        return this._is_formatting_enabled(ko.views.manager.currentView);
    };

    FormattersController.prototype.do_cmd_format = function () {
        var view = ko.views.manager.currentView;
        if (this._check_formatting_enabled(view)) {
            ko.formatters.formatView(view);
        }
    };

    FormattersController.prototype.is_cmd_formatSubLanguageBlock_enabled = function () {
        return this._is_formatting_enabled(ko.views.manager.currentView);
    };

    FormattersController.prototype.do_cmd_formatSubLanguageBlock = function () {
        var view = ko.views.manager.currentView;
        if (this._check_formatting_enabled(view)) {
            ko.formatters.formatSubLanguageBlock(view);
        }
    };

    /************************************************************
     *        Internal private functions                        *
     ************************************************************/

    /**
     * Format the supplied view with the provided formatter and context.
     
     * @param view {Components.interfaces.koIScintillaView}  The view to format.
     * @param formatter {Components.interfaces.koIFormatter}  Formatter to use.
     * @param context {Components.interfaces.koIFormatterContext}  Context to use.
     */
    function _formatViewWithFormatterAndContext(view, formatter, context) {
        try {
            // perLineWhitespace - how much whitespace needs to be added to
            //                     each formatted line.
            var perLineWhitespace = "";
            // firstLineWhitespace - how much whitespace was already in the
            //                          first line.
            var firstLineWhitespace = "";
            var preceedingSelectionWhitespace = "";
            if (context.type == FORMAT_SELECTION ||
                context.type == FORMAT_BLOCK) {
                // Remember the preceeding indentation.
                var match = context.text.match(/^(\s+)/);
                if (match) {
                    perLineWhitespace = match[1];
                    // Be careful when dealing with multiple lines, use the
                    // last line of the regex match, as that is first line that
                    // contains real text.
                    var lines = perLineWhitespace.split(/\r\n|\n|\r/g);
                    if (lines.length > 1) {
                        perLineWhitespace = lines[lines.length - 1];
                    }
                }
            }

            // Remember the original settings, so we can compare to later.
            var pretext = context.text;
            var scimoz = view.scimoz;
            var original_currentPos = scimoz.currentPos;
            var original_anchor = scimoz.anchor;
            var original_line = scimoz.lineFromPosition(original_currentPos);
            var original_linePos = scimoz.positionFromLine(original_line);
            var original_line_caretPos = original_currentPos - original_linePos;
            var original_caret_text = scimoz.getTextRange(original_linePos, scimoz.getLineEndPosition(original_line));
            var original_lineCount = scimoz.lineCount;
            var original_firstVisibleLine = scimoz.firstVisibleLine;

            try {
                formatter.format(context);
            } catch (ex) {
                require("notify/notify").send(ex, "formatting", {priority: "error"});
                log.exception(ex, "Formatting failed");
                return;
            }
            var text = context.text;
            // Formatting worked, update the text.
            if (context.type == FORMAT_SELECTION ||
                context.type == FORMAT_BLOCK) {
                if (context.type == FORMAT_SELECTION) {
                    var selPos = Math.min(original_currentPos, original_anchor);
                    var startLinePos = scimoz.positionFromLine(scimoz.lineFromPosition(selPos));
                    if (startLinePos < selPos) {
                        // Selection does not begin at the start of the line.
                        var preceedingText = scimoz.getTextRange(startLinePos, selPos);
                        var match = preceedingText.match(/^(\s+)/);
                        if (match && (match[1] == preceedingText)) {
                            // The preceeding text is just whitespace, need to
                            // maintain the indentation here as well.
                            preceedingSelectionWhitespace = preceedingText;
                            firstLineWhitespace = perLineWhitespace;
                            perLineWhitespace = preceedingText + perLineWhitespace;
                        }
                    }
                } else {
                    // Select the block of text to be replaced.
                    scimoz.selectionMode = scimoz.SC_SEL_STREAM;
                    scimoz.anchor = context.pos_start;
                    scimoz.currentPos = context.pos_end;
                }
                if (perLineWhitespace) {
                    // Update all lines to include this preceeding whitespace.
                    var lines = text.split(/\r\n|\n|\r/g);
                    for (var i=0; i < lines.length; i++) {
                        /* Only indent lines that have some text. */
                        if (lines[i]) {
                            if (i == 0 && preceedingSelectionWhitespace) {
                                // The first line already has some preceeding
                                // whitespace from outside the user's selection.
                                // Only need to add in part of the whitespace.
                                lines[i] = firstLineWhitespace + lines[i];
                            } else {
                                lines[i] = perLineWhitespace + lines[i];
                            }
                        }
                    }

                    // Re-piece together the text.
                    text = lines.join("\n");

                    // Ensure the last line EOL state does not change.
                    var pretextEndsWithNewLine = pretext[pretext.length - 1].match(/\r|\n/);
                    var textEndsWithNewLine = text[text.length - 1].match(/\r|\n/);
                    if (!pretextEndsWithNewLine && textEndsWithNewLine) {
                        // The original text did not end with a newline, so
                        // the resulting text should not either.
                        text = text.substr(0, text.length - 1);
                    } else if (pretextEndsWithNewLine && !textEndsWithNewLine) {
                        // The original text ended with a newline, so the
                        // resulting text should as well.
                        text += "\n";
                    }
                }
            } else {
                // All the text is going to get replaced by insertText().
                scimoz.selectAll();
            }
            view.insertText(text);

            // Restore the line and possiblity the position as best as possible.
            var new_lineCount = scimoz.lineCount;
            var new_currentPos;
            var line_difference = new_lineCount - original_lineCount;
            if (context.type == FORMAT_SELECTION) {
                // This will maintain the selection over the formatted area.
                if (original_currentPos <= original_anchor) {
                    scimoz.currentPos = original_currentPos;
                } else {
                    scimoz.anchor = original_anchor;
                }
            } else if (context.type == FORMAT_BLOCK) {
                // Just put it back in the original location, ensuring the
                // cursor does not leave the block if it was within the block
                // before the format operation.
                var offSet = ko.stringutils.bytelength(text) - ko.stringutils.bytelength(pretext);
                new_currentPos = original_currentPos + offSet;
                var new_anchor = original_anchor + offSet;
                if (original_currentPos >= context.pos_start &&
                    original_currentPos <= context.pos_end) {
                    new_currentPos = Math.max(new_currentPos, context.pos_start);
                    new_currentPos = Math.min(new_currentPos, context.pos_end);
                }
                if (original_anchor >= context.pos_start &&
                    original_anchor <= context.pos_end) {
                    new_anchor = Math.max(new_anchor, context.pos_start);
                    new_anchor = Math.min(new_anchor, context.pos_end);
                }
                scimoz.currentPos = new_currentPos;
                scimoz.anchor = new_anchor;
            } else if (original_currentPos === 0 || original_currentPos === pretext.length || ! original_caret_text.trim()) {
                // Just maintain the same line number, which may or may not be
                // the same line after the replacement.
                let editor = require("ko/editor").editor(view.scintilla, scimoz);
                let new_line = Math.max(0, original_line + line_difference);
                editor.setCursor(editor.getLineEndPos(new_line));
            } else {
                let editor = require("ko/editor").editor(view.scintilla, scimoz);
                var matched = false;

                // Maximum number of line iterations we should do from original_line
                var maxLines = Math.max(Math.min(original_line, scimoz.lineCount), scimoz.lineCount - original_line);
                maxLines = Math.min(maxLines, ko.prefs.getLong("formatter_context_scan_max_lines", 50));

                // Differentiate between text before and after the caret
                var original_caret_text_ltrim = original_caret_text.replace(/^\s+/, "");
                var trim_size = original_caret_text.length - original_caret_text_ltrim.length;
                var original_line_caretPos_ltrim = original_line_caretPos - trim_size;
                var baseSearch = original_caret_text.trim();
                var baseSearchAfterCaret = baseSearch.substr(original_line_caretPos_ltrim);

                // What line to start searching from
                var lineStart = original_line > maxLines ? maxLines : original_line;

                // Each loop is an attempt to search for a string which becomes
                // smaller every loop
                var tries = 5;
                for (let x=1; x<=tries; x++) {
                    // Calculate the length of the current search
                    let length = Math.ceil(original_caret_text.length / x);
                    if (length < 2 || matched)
                        break;

                    // Calculate what part of the line we're converting into a search phrase
                    let start = original_line_caretPos_ltrim;
                    start -= Math.floor(original_line_caretPos_ltrim / x);
                    let offset = original_line_caretPos_ltrim - start;

                    let end = offset + Math.ceil(baseSearchAfterCaret.length / x);

                    // Set the current search
                    let search = baseSearch.substr(start, end).trim();
                    if ( ! search)
                        continue;

                    let searchRx = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    searchRx = searchRx.replace(/\s+/g, '\\s?');
                    searchRx = new RegExp(searchRx);

                    // Prepare to iterate over lines
                    let iterations = 0;
                    let linesToIterate = maxLines;
                    let iterationStart = true; // allows iterating every other loop

                    // Update the iteration every other loop
                    var next = () =>
                    {
                        if (iterationStart)
                            iterationStart = false;
                        else
                        {
                            iterationStart = true;
                            iterations++;
                        }
                    };

                    // Iterate over lines, every other loop increases the iteration
                    while (! matched && iterations < linesToIterate)
                    {
                        let lineNo;
                        if (iterationStart)
                            lineNo = lineStart - iterations;
                        else
                            lineNo = lineStart + iterations;

                        // Don't check lines that don't exist
                        if (lineNo < 0 || lineNo > scimoz.lineCount)
                        {
                            next();
                            continue;
                        }

                        // Get the value of the given line
                        let line = editor.getLine(lineNo+1); // editor sdk lines start at 1, not 0
                        if ( ! line)
                        {
                            next();
                            continue;
                        }
                        
                        // Match line against search
                        // on the first iteration we only match the whole line
                        let matchRx = line.match(searchRx);
                        if (matchRx && (x !== 1 || line.trim().length == search.length))
                        {
                            matched = true;
                            // Todo: Account for whitespace offset
                            editor.setCursor({line: lineNo+1, ch: (matchRx.index + offset)});
                            break;
                        }

                        // Prepare for next loop
                        next();
                    }
                }
                
                if ( ! matched)
                {
                    let new_line = Math.max(0, original_line + line_difference);
                    editor.setCursor(editor.getLineEndPos(new_line));
                }
            }

            // Ensure the caret is still visible.
            scimoz.scrollCaret();
            var new_firstVisibleLine = scimoz.firstVisibleLine;
            if (original_firstVisibleLine != new_firstVisibleLine) {
                scimoz.lineScroll(0, original_firstVisibleLine - new_firstVisibleLine);
            }

        } catch (ex) {
            log.exception(ex);
        }
    };
    
    /**
     * Highlight this formatting region in the current view.
     * @param {int} pos_start - The scimoz starting position.
     * @param {int} pos_end - The scimoz end position.
     */
    this.highlightRegion = function(pos_start, pos_end) {
        //dump("highlightRegion\n");
        highlight_count += 1;
        var view = ko.views.manager.currentView;
        if (!view) {
            return;
        }
        var scimoz = view.scimoz;
        scimoz.indicatorCurrent = Components.interfaces.koILintResult.DECORATOR_TAG_MATCH_HIGHLIGHT;
        scimoz.indicatorFillRange(pos_start, pos_end - pos_start);
    }

    /**
     * Remove the formatter highlighting from the current view.
     */
    this.unhighlightRegion = function() {
        //dump("unhighlightRegion\n");
        highlight_count -= 1;
        //dump('highlight_count: ' + highlight_count + '\n');
        if (highlight_count > 0) {
            // This unhighlighting event occured after a call to re-highlight
            // the region, so we do not want to remove the highlighting now.
            return;
        }
        var view = ko.views.manager.currentView;
        if (!view) {
            return;
        }
        var scimoz = view.scimoz;
        scimoz.indicatorCurrent = Components.interfaces.koILintResult.DECORATOR_TAG_MATCH_HIGHLIGHT;
        scimoz.indicatorClearRange(0, scimoz.length);
    }

        /* Add in formatter menus/menuitems for the formatter configurations. */
    function _createMenuitems(menupopup, strbundle, formatter_configurations, region_name, lang, sublang, pos_start, pos_end, addHighlighting, parent_region)
    {
        var formatterSvc = Components.classes["@activestate.com/koFormatterService;1"].
                            getService(Components.interfaces.koIFormatterService);
        var pref;
        var name;
        var menuitem;
        var formatter;
        var formatter_name;
        var menu_label;

        var view = ko.views.manager.currentView;
        var prefset = view.prefs;

        var onSavePrefName = `format-on-save-${lang}`;
        var onSavePrefs;

        if (prefset.hasPref(onSavePrefName))
            onSavePrefs = prefset.getPref(onSavePrefName);

        for (var j=0; j < formatter_configurations.length; j++) {
            pref = formatter_configurations[j];
            name = pref.getStringPref("name");
            formatter_name = pref.getStringPref("formatter_name");
            formatter = formatterSvc.getFormatterWithName(formatter_name);
            if (formatter) {
                menuitem = document.createElementNS(XUL_NS, 'menuitem');
                menuitem.setAttribute("id", "formatter_" + name);
                menuitem.setAttribute("dynamically_added_formatter", "true");
                menuitem.setAttribute("pack", "center");
                if (region_name == "other") {
                    menu_label = name;
                } else if (region_name == "sublang") {
                    menu_label = strbundle.getFormattedString(region_name+".menu.prefix", [sublang, name]);
                } else {
                    menu_label = strbundle.getFormattedString(region_name+".menu.prefix", [name]);
                }
                menuitem.setAttribute('label', menu_label);
                menuitem.setAttribute('tooltiptext', formatter.prettyName + " (" + pref.getStringPref("lang") + ")");
                if (region_name == "auto" || parent_region == "auto") {
                    menuitem.setAttribute("type", "checkbox");
                    if (onSavePrefs && onSavePrefs.getBoolean(pref.id, false))
                        menuitem.setAttribute("checked", "true");
                    menuitem.addEventListener("command", ((menuitem, pref) =>
                    {
                        if ( ! prefset.hasPrefHere(onSavePrefName))
                        {
                            if (prefset.hasPref(onSavePrefName))
                                prefset.setPref(onSavePrefName, prefset.getPref(onSavePrefName));
                            else
                                prefset.createPref(onSavePrefName);
                            onSavePrefs = prefset.getPref(onSavePrefName);
                        }

                        if (menuitem.getAttribute("checked"))
                        {
                            onSavePrefs.setBoolean(pref.id, true);
                        }
                        else
                        {
                            onSavePrefs.setBoolean(pref.id, false);
                        }
                    }).bind(null, menuitem, pref));
                }
                else
                {
                    menuitem.setAttribute('oncommand', 'ko.formatters.formatViewUsingConfigUuid("' + pref.id + '", ' +
                                          '"' + region_name + '", ' +
                                          pos_start + ', ' +
                                          pos_end + ');');
                }
                if (addHighlighting) {
                    menuitem.setAttribute('onmouseover', 'ko.formatters.highlightRegion(' + pos_start + ', ' + pos_end + ');');
                    menuitem.setAttribute('onmouseout', 'ko.formatters.unhighlightRegion();');
                }
                menupopup.appendChild(menuitem);
            } else {
                this.log.warn("No formatter exists with the name: '" + formatter_name +
                              "', from preference '" + name + "'");
            }
        }

        if (parent_region == "auto")
        {
            var sep = document.createElement("menuseparator");
            menupopup.appendChild(sep);

            menuitem = document.createElement("menuitem");
            menuitem.setAttribute("type", "checkbox");

            if ( ! prefset.hasPrefHere(onSavePrefName))
                menuitem.setAttribute("checked", "true");

            menuitem.setAttribute("label", strbundle.getString("use_from_parent"));

            menuitem.addEventListener("command", () =>
            {
                if (prefset.hasPrefHere(onSavePrefName))
                    prefset.deletePref(onSavePrefName);
            });

            menupopup.appendChild(menuitem);

            if (prefset.hasPrefHere(onSavePrefName))
            {
                menuitem = document.createElement("menuitem");
                menuitem.setAttribute("label", strbundle.getFormattedString("use_on_all", [lang]));
                menuitem.addEventListener("command", () =>
                {
                    if (onSavePrefs)
                    {
                        require("ko/prefs").project().setPref(onSavePrefName, onSavePrefs);

                        if (prefset.hasPrefHere(onSavePrefName))
                            prefset.deletePref(onSavePrefName);
                    }
                });
                menupopup.appendChild(menuitem);
            }
        }
    };

    /**
     * Load the applicable formatter configurations into the menupopup, using
     * the currentView as the basis for determining the configuration language
     * and preferences.
     */
    function _createFormatterMenusForCurrentView(menupopup) {
        var view = ko.views.manager.currentView;
        if (!view || view.getAttribute("type") != "editor") {
            return;
        }
        /* Remove any existing formatter menuitems. */
        var node = menupopup.firstChild;
        var nextSibling;
        while (node) {
            nextSibling = node.nextSibling;
            /* Only remove the menus that were previously added by this code. */
            /* Allows an overlay to add whatever they wish to this menu. */
            if (node.getAttribute("dynamically_added_formatter") == "true") {
                menupopup.removeChild(node);
            }
            node = nextSibling;
        }
        /**
         * @type {Components.interfaces.ISciMoz}
         */
        var scimoz = view.scimoz;
        var strbundle = document.getElementById("formatter_strings");

        if (scimoz.selectionMode == scimoz.SC_SEL_RECTANGLE) {
            // Formatting of Rectangular selections not supported
            var menuitem = document.createElementNS(XUL_NS, 'menuitem');
            menuitem.setAttribute("id", "formatting_rects_not_selected_");
            menuitem.setAttribute("dynamically_added_formatter", "true");
            var menu_label = strbundle.getString("Formatting rectangular selections not supported");
            menuitem.setAttribute('label', menu_label);
            menuitem.setAttribute('disabled', true);
            menupopup.appendChild(menuitem);
            return;
        }
        var prefs = view.prefs;
        var lang = view.koDoc.language;
        var format_regions = [];

        // Work out the applicable formatter configurations.
        var all_formatter_configurations = ko.formatters.getAllFormatterConfigurationsForPrefset(prefs);
        var lang_formatter_configurations = ko.formatters.getFormatterConfigurationsForLangAndPrefset(lang, prefs);

        format_regions.unshift(["auto", lang_formatter_configurations, 0, scimoz.length]);

        // Work out if there is a selection, that will be the first menu.
        var pos_start, pos_end;
        if (scimoz.selectionMode == scimoz.SC_SEL_LINES) {
            pos_start = scimoz.positionFromLine(scimoz.lineFromPosition(pos_start));
            pos_end = scimoz.getLineEndPosition(scimoz.lineFromPosition(pos_end));
        } else if (scimoz.selectionMode == scimoz.SC_SEL_RECTANGLE) {
            // Formatting of Rectangular selections not supported
            pos_start = -1;
            pos_end = -1;
        } else {
            pos_start = scimoz.selectionStart;
            pos_end = scimoz.selectionEnd;
        }
        var sublang = view.koDoc.languageForPosition(pos_start);

        if (pos_start != pos_end) {
            // There is a selection.
            // If the selection contains multiple languages, we only show the
            // language formatter, else we show the specific language for the
            // selection language.
            var selection_formatters;
            var points = {};
            var count = {};
            view.koDoc.getLanguageTransitionPoints(pos_start, pos_end, points, count);
            points = points.value;
            if (points.length > 2) {
                // There are multi-languages in the selection
                selection_formatters = lang_formatter_configurations;
            } else {
                selection_formatters = ko.formatters.getFormatterConfigurationsForLangAndPrefset(sublang, prefs);
            }
            format_regions.push(["selection", selection_formatters, points[0], points[0]]);
        }
        
        if (sublang && sublang != lang && sublang != "XML" && pos_start != -1) {
            var points = {};
            var count = {};
            view.koDoc.getLanguageTransitionPoints(pos_start, pos_end, points, count);
            points = points.value;
            format_regions.push(["sublang", ko.formatters.getFormatterConfigurationsForLangAndPrefset(sublang, prefs), points[0], points[1]]);
        }

        format_regions.push(["document", lang_formatter_configurations, 0, scimoz.length]);

        //var other_localized_name = strbundle.getString("otherFormattersMenulistLabel");
        var other_localized_name = "";
        var other_localized_menu_label;
        var target_formatter_configurations;
        var other_formatter_configurations;
        var addBlockHighlighting;
        highlight_count = 0;
        for (var i=0; i < format_regions.length; i++) {
            addBlockHighlighting = format_regions[i][0] == 'sublang';
            if (i > 0) {
                // Add a menu separator.
                if (all_formatter_configurations.length > 0) {
                    var menusep = document.createElementNS(XUL_NS, 'menuseparator');
                    menusep.setAttribute("id", "editor_contextmenu_formatter_other_sep");
                    menusep.setAttribute("dynamically_added_formatter", "true");
                    menupopup.appendChild(menusep);
                }
            }
            target_formatter_configurations = format_regions[i][1];
            //dump("target_formatter_configurations.length: " + target_formatter_configurations.length + "\n");
            if (target_formatter_configurations) {
                _createMenuitems(menupopup, strbundle,
                                 target_formatter_configurations,
                                 format_regions[i][0], lang, sublang,
                                 format_regions[i][2], format_regions[i][3],
                                 addBlockHighlighting);
            }
    
            other_formatter_configurations = [];
            for (var j=0; j < all_formatter_configurations.length; j++) {
                if (target_formatter_configurations.indexOf(all_formatter_configurations[j]) < 0) {
                    other_formatter_configurations.push(all_formatter_configurations[j]);
                }
            }
            /* Add in other formatter menus/menuitems. */
            if (other_formatter_configurations.length > 0) {
                var other_menu = document.createElementNS(XUL_NS, 'menu');
                if (format_regions[i][0] == "sublang") {
                    other_localized_menu_label = strbundle.getFormattedString(format_regions[i][0]+".menu.prefix", [sublang, other_localized_name]);
                } else {
                    other_localized_menu_label = strbundle.getFormattedString(format_regions[i][0]+".menu.prefix", [other_localized_name]);
                }
                other_menu.setAttribute("label", other_localized_menu_label);
                other_menu.setAttribute("dynamically_added_formatter", "true");
                var other_menupopup = document.createElementNS(XUL_NS, 'menupopup');
                if (addBlockHighlighting) {
                    other_menupopup.setAttribute('onpopupshown', 'ko.formatters.highlightRegion(' + format_regions[i][2] + ', ' + format_regions[i][3] + ');');
                    other_menupopup.setAttribute('onpopuphiding', 'ko.formatters.unhighlightRegion();');
                }
                other_menu.appendChild(other_menupopup);
                _createMenuitems(other_menupopup, strbundle,
                                 other_formatter_configurations,
                                 "other", lang, sublang,
                                 format_regions[i][2], format_regions[i][3],
                                 false /* highlighting */,
                                 format_regions[i][0]);
                menupopup.appendChild(other_menu);
            }
        }
    };


    /************************************************************
     *        Exposed ko.formatters.XYZ functions               *
     ************************************************************/

    /**
     * Format this view. If there is a selection in this view or the
     * formatSelection argument is true, then the formatter will work upon the
     * view's selection, else the formatter works on the complete document.
     * The targetted text will be replaced if the formatting is successful.
     * @param view {Components.interfaces.koIScintillaView}
     *        (Optional) The view to format. Defaults to the currentview.
     * @param {int} format_type (Optional) the type of formatting context to
     *        use, one of (FORMAT_SELECTION, FORMAT_BLOCK, FORMAT_TEXT, ...)
     */
    this.formatView = function formatView(view, format_type /* everything */) {
        try {
            if (!view) {
                view = ko.views.manager.currentView;
            }
            if (!view || (view.getAttribute('type') != 'editor')) {
                return;
            }
            if ((typeof(format_type) == 'undefined') || (format_type == null)) {
                format_type = FORMAT_TEXT;
            }
            var formatterSvc = Components.classes["@activestate.com/koFormatterService;1"].
                                getService(Components.interfaces.koIFormatterService);
            var context = formatterSvc.createFormatterContextFromView(view);
            try {
                if (format_type == FORMAT_SELECTION && view.scimoz.selText) {
                    // Ensure the context is the selection.
                    context.type = FORMAT_SELECTION;
                    context.text = view.scimoz.selText;
                } else if (format_type == FORMAT_BLOCK) {
                    // Ensure it's the current sub-language block.
                    var sublang = view.koDoc.subLanguage;
                    if (sublang && sublang != view.koDoc.language && sublang != "XML") {
                        var points = {};
                        var count = {};
                        var scimoz = view.scimoz;
                        var currentPos = scimoz.currentPos;
                        view.koDoc.getLanguageTransitionPoints(currentPos, currentPos, points, count);
                        points = points.value;
                        context.type = FORMAT_BLOCK;
                        context.lang = sublang;
                        context.text = view.scimoz.getTextRange(points[0], points[1]);
                        context.pos_start = points[0];
                        context.pos_end = points[1];
                    }
                }
                var formatter = formatterSvc.getFormatterForContext(context);
                if (formatter) {
                    _formatViewWithFormatterAndContext(view, formatter, context);
                } else {
                    var msg = "No formatter configured for language: " + view.koDoc.language;
                    require("notify/notify").send(msg, "formatting", {priority: "warning"});
                }
            } finally {
                // Ensure the context is cleaned-up.
                context.text = "";
                context.scimoz = null;
                context.prefset = null;
                context.formatter_prefset = null;
            }
        } catch (ex) {
            log.exception(ex);
        }
    }

    /**
     * Format the sub-language at the current cursor position of the view.
     *
     * @param view {Components.interfaces.koIScintillaView}
     *        (Optional) The view to format. Defaults to the currentview.
     */
    this.formatSubLanguageBlock = function formatSubLanguageBlock(view) {
        this.formatView(view, FORMAT_BLOCK);
    }

    /**
     * Return a list of all formatter configuration preferences.
     * @returns {array}  List of koIPreferenceSet xpcom objects.
     */
    this.getAllFormatterConfigurationsForPrefset = function getAllFormatterConfigurationsForPrefset(prefset) {
        var configuration_prefsets = [];
        var fprefs, uuid;
        if (prefset.hasPref('configuredFormatters')) {
            var prefs = prefset.getPref('configuredFormatters');
            for (var i=0; i < prefs.length; i++) {
                uuid = prefs.getString(i);
                fprefs = null;
                try
                {
                    fprefs = prefset.getPref(uuid);
                } catch (e)
                {
                    log.warn("Formatter preference " + uuid + " doesn't exist");
                }
                if (fprefs) {
                    configuration_prefsets.push(fprefs);
                } else {
                    log.warn("Formatter preference " + uuid + " doesn't exist");
                }
            }
        }
        return configuration_prefsets;
    }

    /**
     * Return a list of formatter configuration preferences that are setup for
     * the given language.
     * @returns {array}  List of koIPreferenceSet xpcom objects.
     */
    this.getFormatterConfigurationsForLangAndPrefset = function getFormatterConfigurationsForLangAndPrefset(lang, prefset) {
        var all_configuration_prefsets = this.getAllFormatterConfigurationsForPrefset(prefset);
        var lang_configuration_prefsets = [];
        for (var i=0; i < all_configuration_prefsets.length; i++) {
            if (all_configuration_prefsets[i].getStringPref("lang") == lang) {
                lang_configuration_prefsets.push(all_configuration_prefsets[i]);
            }
        }
        return lang_configuration_prefsets;
    }

    /**
     * Return a list of formatter configuration preferences that are setup for
     * the current view's language and prefset.
     * @returns {array}  List of koIPreferenceSet xpcom objects.
     */
    this.getFormatterConfigurationsForView = function getFormatterConfigurationsForView(view) {
        if (!view) {
            view = ko.views.manager.currentView;
            if (!view) {
                return null;
            }
        }
        return this.getFormatterConfigurationsForLangAndPrefset(view.koDoc.language, view.prefs);
    }

    /**
     * Populate the provided menupopup element with the available formatters
     * for the current view.
     */
    this.loadFormatterMenusForCurrentView = function loadFormatterMenusForCurrentView(menupopup, event) {
        try {
            if (event.target && event.target.getAttribute("id") != menupopup.getAttribute("id")) {
                // Avoid loading sub-menu popups, as they are already loaded.
                return;
            }
            _createFormatterMenusForCurrentView(menupopup);
        } catch (ex) {
            log.exception(ex);
        }
    }

    /**
     * Format the given view (defaults to the current view when not supplied)
     * with the formatter configuration provided. If there is a selection in
     * this view then the formatter will work upon the view's selection, else
     * the formatter works on the complete document. The targetted text will be
     * replaced if the formatting is successful.
     * 
     * @param view {Components.interfaces.koIScintillaView}
     *        The view to format. Defaults to the current view if null.
     * @param config {Components.interfaces.koIPreferenceSet}
     *        The formatter configuration prefset to use for formatting.
     * @param {string} format_type  Must be one of ["document", "sublang", "selection"]
     * @param {int} pos_start  (Optional) The position to start the formatting.
     * @param {int} pos_end  (Optional) The position to end the formatting.
     */
    this.formatViewUsingConfig = function formatViewUsingConfig(view, config, format_type, pos_start, pos_end) {
        log.debug("formatting view using: " + config.getStringPref("name"));
        var formatterSvc = Components.classes["@activestate.com/koFormatterService;1"].
                            getService(Components.interfaces.koIFormatterService);
        var formatter = formatterSvc.getFormatterWithName(config.getStringPref("formatter_name"));
        if (formatter) {
            var context;
            var context = formatterSvc.createFormatterContextFromView(view);
            try {
                if (format_type == "selection" &&
                    (context.type != FORMAT_SELECTION)) {
                    var selText = view.scimoz.selText;
                    if (selText) {
                        context.type = FORMAT_SELECTION;
                        context.text = selText;
                    }
                } else if (format_type == "sublang") {
                    context.type = FORMAT_BLOCK;
                    context.text = view.scimoz.getTextRange(pos_start, pos_end);
                    context.pos_start = pos_start;
                    context.pos_end = pos_end;
                }

                context.formatter_prefset = config;
                _formatViewWithFormatterAndContext(view, formatter, context);
            } finally {
                // Ensure the context instance is cleaned-up.
                context.text = "";
                context.prefset = null;
                context.formatter_prefset = null;
                context.scimoz = null;
            }
        } else {
            ko.dialogs.alert("No formatter exists with the name: '" +
                             formatter_name + "', from preference '" +
                             name + "'",
                             null,
                             "Invalid Formatter Configuration");
        }
    }

    /**
     * Format the given view (defaults to the currentView when not supplied)
     * with the formatter configuration that has the supplied config name.
     * If there is a selection in this view then the formatter will work upon
     * the view's selection, else the formatter works on the complete document.
     * The targetted text will be replaced if the formatting is successful.
     
     * @param view {Components.interfaces.koIScintillaView}
     *        The view to format. Defaults to the current view if null.
     * @param {string} configName
     *        The name of the formatter configuration to use for formatting.
     */
    this.formatViewUsingConfigName = function formatViewUsingConfigName(view, configName) {
        try {
            if (!view) {
                view = ko.views.manager.currentView;
                if (!view) {
                    return;
                }
            }
            // Work out the applicable formatter configurations.
            var all_formatter_configurations = this.getAllFormatterConfigurationsForPrefset(view.prefs);
            for (var i=0; i < all_formatter_configurations.length; i++) {
                if (all_formatter_configurations[i].getStringPref("name") == configName) {
                    this.formatViewUsingConfig(view, all_formatter_configurations[i]);
                    break;
                }
            }
        } catch (ex) {
            log.exception(ex);
        }
    },

    /**
     * Format the current view with the formatter configuration that has the
     * provided UUID. This is required for the formatter menu(item)'s.
     * 
     * @param {string} uuid  The unique identifier of the configuration prefset.
     * @param {string} format_type  Must be one of ["document", "sublang", "selection"]
     * @param {int} pos_start  (Optional) The position to start the formatting.
     * @param {int} pos_end  (Optional) The position to end the formatting.
     */
    this.formatViewUsingConfigUuid = function formatViewUsingConfigUuid(uuid, format_type, pos_start, pos_end) {
        try {
            var view = ko.views.manager.currentView;
            if (!view) {
                return;
            }
            // Work out the applicable formatter configurations.
            var all_formatter_configurations = this.getAllFormatterConfigurationsForPrefset(view.prefs);
            for (var i=0; i < all_formatter_configurations.length; i++) {
                if (all_formatter_configurations[i].id == uuid) {
                    this.formatViewUsingConfig(view,
                                               all_formatter_configurations[i],
                                               format_type, pos_start, pos_end);
                    break;
                }
            }
        } catch (ex) {
            log.exception(ex);
        }
    }

    // Controller instance on the current window to handle formatter commands.
    window.controllers.appendController(new FormattersController());

    var updateMenu = () =>
    {
        var menupopup = document.createElement("menupopup");
        this.loadFormatterMenusForCurrentView(menupopup, {});
        return menupopup;
    };

    var controller = controllers.getControllerForCommand("cmd_format");

    var dynBtn = require("ko/dynamic-button");
    dynBtn.register("Format Current File/Selection", {
        icon: "paragraph-left3",
        menuitems: updateMenu,
        menuitemsInitialize: updateMenu,
        ordinal: 200,
        group: "linters",
        groupOrdinal: 100,
        events: ["current_view_changed", "current_view_language_changed", "workspace_restored"],
        isEnabled: () => controller.isCommandEnabled("cmd_format")
    });

    window.addEventListener("file_saving", () =>
    {
        if ( ! controller.isCommandEnabled("cmd_format"))
            return;

        var view = ko.views.manager.currentView;
        var language = view.koDoc.language;

        var prefset = require("ko/prefs").file();
        if ( ! prefset.hasPref(`format-on-save-${language}`))
            return;

        var onSavePrefs = prefset.getPref(`format-on-save-${language}`);
        var ids = onSavePrefs.getAllPrefIds();
        for (let id of ids)
        {
            if (onSavePrefs.getBoolean(id))
                this.formatViewUsingConfigUuid(id, "document");
        }
    });

}).apply(ko.formatters);
