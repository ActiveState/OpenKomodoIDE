(function() {
    // Common definitions.
    const log = require("ko/logging").getLogger("komodospellchecker");
    const {Cc, Ci} = require("chrome");
    const prefs = require("ko/prefs");
    const menu = require("ko/menu");
    const commands = require("ko/commands");
    const editor = require("ko/editor");
    const $ = require("ko/dom");
    const w = require("ko/windows").getMain();
    const document = w.document;
    const legacy = w.ko;
    
    /** Locale bundle. */
    const bundle = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService).
        createBundle("chrome://komodospellchecker/locale/spellcheck.properties");
    
    /** The preference that enables/disables spell checking. */
    const PREF_ENABLE_SPELL_CHECKING = "editUseSpellChecking";
    /** The preference that specifies which dictionary to use. */
    const PREF_DICTIONARY = "spellCheckDictionary";
    /** The preference that specifies words to ignore checking. */
    const PREF_IGNORED_WORDS = "spellCheckIgnoredWords";
    /**
     * The preference that specifies whether or not to check spelling within
     * strings.
    */
    const PREF_SPELL_CHECK_WITHIN_STRINGS = "spellCheckWithinStrings";
    
    /** The Mozilla spell checking engine. */
    const spellCheckEngine = Cc["@mozilla.org/spellchecker/engine;1"].getService(Ci.mozISpellCheckingEngine);
    /** A user's personal dictionary for the Mozilla spell checking engine. */
    const personalDictionary = Cc["@mozilla.org/spellchecker/personaldictionary;1"].getService(Ci.mozIPersonalDictionary);
    
    /** Styles that are eligible for spell checking in. */
    var textStyles = {};
    /** Scintilla pattern that matches potentially spell-check-able words. */
    var wordPattern = "[a-zA-Z\\x80-\\xff_][a-zA-Z\\x80-\\xff0-9.'_\-]*[a-zA-Z\\x80-\\xff_]";
    /** The length of the above pattern pre-computed for use with Scintilla's API. */
    var wordPatternLength = wordPattern.length;
    /** JS patterns for rejecting words matched by `wordPattern`. */
    var wordSkipPatterns = [/[\._]/, /[a-z].*[A-Z]/, /[\d]/, /'.*'/];
    
    /**
     * The location in the right-click context menu to place the spelling
     * suggestions menu separator.
     */
    var beforeCutMenu = [{select: menu.context.editorContext, before: "#editor-context-cut"}];
    /**
     * The location in the right-click context menu to place spelling
     * suggestions.
     * Menu SDK prepends "sdk_menuitem_" + context.uniqueId() to IDs.
     */
    var spellCheckMenu = [{select: menu.context.editorContext, before: "#sdk_menuitem_editorContextMenuspellcheck_separator"}];
    
    /**
     * Spelling suggestions currently in the context menu.
     * These are tracked so they can be easily removed when necessary.
     */
    var spellCheckMenuItemIDs = [];
    
    /** Loads the spell checker. */
    this.load = function() {
        // Load the preferred dictionary.
        var dictionaries = {};
        spellCheckEngine.getDictionaryList(dictionaries, {});
        var dictionary = prefs.getString(PREF_DICTIONARY, dictionaries.value[0]);
        if (dictionary == "None")
            dictionary = dictionaries.value[0];
            
        spellCheckEngine.dictionary = dictionary;
        
        // Since spelling suggestions are to be shown in the right-click context
        // menu, get notified when the menu is being shown.
        var contextMenu = document.getElementById("editorContextMenu");
        contextMenu.addEventListener("popupshowing", this.populateContextMenu.bind(this));
        // Register the command to perform spell checking.
        commands.register("checkSpelling", this.checkSpelling.bind(this), {
            label: "Spell Check: Check Spelling"
        });
        
        // Listen for enable/disable spell checking preference.
        prefs.prefObserverService.addObserver(this, PREF_ENABLE_SPELL_CHECKING, false);
        prefs.prefObserverService.addObserver(this, PREF_DICTIONARY, false);
        prefs.prefObserverService.addObserver(this, PREF_IGNORED_WORDS, false);
        prefs.prefObserverService.addObserver(this, PREF_SPELL_CHECK_WITHIN_STRINGS, false);
        
        // Register a command to popup the context menu in order to access any
        // spelling suggestions in a mouse-less way.
        commands.register("popupContextMenu",
                          this.popupContextMenu.bind(this),
                          {label: "Context Menu: Show"});
        commands.register("jumpToNextMisspelling",
                          this.jumpToNextMisspelling.bind(this),
                          {label: "Spell Check: Jump to Next Misspelled Word"});
        commands.register("ignoreMisspelledWord",
                          this.ignoreMisspelledWord.bind(this),
                          {label: "Spell Check: Ignore Misspelled Word"});
        
        // Listen for tooltip requests over misspelled words.
        window.addEventListener("editor_get_tooltiptext", this.showMisspellingTooltip.bind(this), true);
        
        log.setLevel(legacy.logging.LOG_INFO);
        log.info("Spell checker loaded.");
        log.info("Using dictionary " + spellCheckEngine.dictionary);
    }
    
    /** Unloads the spell checker. */
    this.unload = function() {
        contextMenu.removeEventListener(this.populateContextMenu);
        prefs.prefObserverService.removeObserver(this, PREF_ENABLE_SPELL_CHECKING);
        prefs.prefObserverService.removeObserver(this, PREF_DICTIONARY);
        prefs.prefObserverService.removeObserver(this, PREF_IGNORED_WORDS);
        prefs.prefObserverService.removeObserver(this, PREF_SPELL_CHECK_WITHIN_STRINGS);
        window.removeEventListener("editor_get_tooltiptext", this.showMisspellingTooltip, false);
        log.info("Spell checker unloaded.");
    }
    
    /**
     * Checks for spelling errors and marks them.
     * @param scimoz Optional Scintilla object to spell check. The default value
     *   is the current Scintilla object.
     * @param jump Optional flag indicating whether or not to jump to the first
     *   misspelled word and stop checking after it.
     * @param startPos Optional position to start spell checking at. Only
     *   applies when `jump` is true. The default value is the beginning of the
     *   first line in the view, or the current position if `jump` is true.
     * @param endPos Optional position to stop spell checking at. Only applies
     *   when `jump` is true. The default value is the end of the last line in
     *   the view, or the last position in the document if `jump` is true.
     */
    this.checkSpelling = function(scimoz, jump, startPos, endPos) {
        // Verify that spell checking can be performed.
        if (!scimoz) {
            scimoz = editor.scimoz();
        }
        if (!scimoz) {
            return;
        }
        log.debug("Spell checking started.");
        log.debug("Looking for words matching the pattern " + wordPattern);
        log.debug("The length of the pattern is " + wordPatternLength);
        
        // Retrieve the current lexing language's spell-check-able styles.
        var styles = this._getSpellCheckableStyles();
        // Retrieve the set of words to ignore.
        var ignoredWords = this._getIgnoredWords();
        
        // Determine the Scintilla view's text extent.
        var firstLine = scimoz.docLineFromVisible(scimoz.firstVisibleLine);
        var lastLine = firstLine + scimoz.linesOnScreen;
        if (lastLine >= scimoz.lineCount) {
            lastLine = scimoz.lineCount - 1;
        }
        var lineWrapping = scimoz.wrapMode != 0;
        if (lineWrapping) {
            // Line wrapping is on. The last line now depends on how many
            // wrapped lines are visible.
            for (let i = firstLine; i < lastLine; i++) {
                lastLine -= scimoz.wrapCount(i) - 1;
            }
            if (lastLine <= firstLine) {
                lastLine = firstLine + 1; // check at least one line
            }
        }
        if (!jump) {
            log.debug("Spell checking lines " + firstLine + " to " + lastLine);
            startPos = scimoz.positionFromLine(firstLine);
            endPos = scimoz.getLineEndPosition(lastLine);
        } else {
            if (startPos === undefined) {
                startPos = scimoz.currentPos;
                if (scimoz.selectionStart != scimoz.selectionEnd) {
                    // Assume the selected word was selected by this function as
                    // misspelled; start looking at the next word.
                    startPos = scimoz.wordEndPosition(scimoz.selectionEnd, true);
                }
            }
            if (endPos === undefined) {
                endPos = scimoz.length;
            }
            log.debug("Spell checking positions " + startPos + " to " + endPos);
        }
        
        // Clear spelling error indicators in the view.
        var INDICATOR_SPELLING_ERROR = Ci.koILintResult.INDICATOR_SPELLING_ERROR;
        scimoz.indicatorCurrent = INDICATOR_SPELLING_ERROR;
        scimoz.indicatorClearRange(startPos, endPos);

        // Check the spelling of text in the view.
        scimoz.searchFlags = scimoz.SCFIND_REGEXP;
        for (let i = startPos; i < endPos; i = scimoz.positionAfter(i)) {
            if (jump && i > scimoz.endStyled) {
                // The next misspelled word may be on a subsequent page, which
                // may not be styled yet. Ensure the next chunk of text is
                // styled since spell checking relies on knowing which styles
                // are checkable.
                let nextPage = lastLine + scimoz.linesOnScreen;
                // Note: `nextPage` can stretch beyond the end of the document
                // since `scimoz.positionFromLine()` will return -1, which is
                // acceptable to `scimoz.colourise()`.
                scimoz.colourise(scimoz.endStyled,
                                 scimoz.positionFromLine(nextPage));
            }
            if (!styles[scimoz.getStyleAt(i)]) continue;
            log.debug("Found beginning of spell-check-able text range: " + i +
                      " style=" + scimoz.getStyleAt(i));
            let j = scimoz.positionAfter(i);
            for (; j < endPos; j = scimoz.positionAfter(j)) {
                if (!styles[scimoz.getStyleAt(j)]) break;
            }
            log.debug("Found end of spell-check-able text range: " + j);
            scimoz.targetStart = i;
            scimoz.targetEnd = j;
            while (scimoz.searchInTarget(wordPatternLength, wordPattern) != -1) {
                // Ensure the word is valid for spell checking.
                let word = scimoz.getTextRange(scimoz.targetStart, scimoz.targetEnd);
                log.debug("Checking spelling for: " + word);
                let reject = false;
                if (ignoredWords[word]) {
                    reject = true;
                    log.debug("Ignoring word " + word);
                } else {
                    for (let patt of wordSkipPatterns) {
                        if (patt.exec(word)) {
                            reject = true;
                            log.debug("Skipping invalid word.");
                            break;
                        }
                    }
                }
                // Check the word.
                if (!reject) {
                    if (spellCheckEngine.check(word)) {
                        // The word is spelled correctly.
                    } else if (personalDictionary && personalDictionary.check(word, spellCheckEngine.dictionary)) {
                        // The word is spelled correctly.
                    } else {
                        // The word is misspelled; mark it.
                        scimoz.indicatorFillRange(scimoz.targetStart, scimoz.targetEnd - scimoz.targetStart);
                        if (jump) {
                            scimoz.setSel(scimoz.targetEnd, scimoz.targetStart);
                            return true; // only need the first misspelling
                        }
                        log.debug("Word is misspelled.");
                    }
                }
                // Advance the search.
                scimoz.targetStart = scimoz.targetEnd;
                scimoz.targetEnd = j;
                if (scimoz.targetStart >= scimoz.targetEnd) {
                    break;
                }
            }
            i = j; // look for the next string of valid text
            log.debug("Finished checking range; continuing.");
        }
        log.debug("Spell checking finished.");
    }
    
    /**
     * Either populates the right-click context menu with spelling suggestions
     * or removes any existing suggestions based on the word under the caret.
     * When the user is performing a right-click, the caret is placed at the
     * click position before this method is called, so there is no need to
     * compute a position from [x, y] coordinates.
     */
    this.populateContextMenu = function() {
        log.debug("Called to handle spelling suggestions in the context menu.");
        this._clearSpellingSuggestions();
        
        // Determine the misspelled word and retrieve its suggestions.
        var word = this._getMisspelledWordUnderCaret();
        if (!word) {
            return;
        }
        var suggestions = this._getSuggestionsFor(word);
        
        // Insert the suggestions into the context menu.
        if (suggestions.length > 0) {
            log.debug("There are " + suggestions.length + " spelling suggestions.");
            for (let suggestion of suggestions) {
                this._insertSpellingSuggestion(suggestion);
            }
        } else {
            log.debug("There are no spelling suggestions.");
            this._insertSpellingSuggestion(null);
        }
        this._insertSpellingOptions(); // ignore, etc.
    }
    
    /** Returns a dictionary of ignored words for quick lookup. */
    this._getIgnoredWords = function() {
        var ignoredWords = {}
        for (let word of prefs.getString(PREF_IGNORED_WORDS).split(/\s+/)) {
            ignoredWords[word] = true;
        }
        return ignoredWords;
    }
    
    /**
     * Clears all spelling suggestions from the context menu.
     */
    this._clearSpellingSuggestions = function() {
        if (spellCheckMenuItemIDs.length == 0) {
            return;
        }
        log.debug("Clearing any existing spelling suggestions.");
        // menu.unregister is buggy so use the DOM to remove menu items for now.
        var menuSDKIdPrefix = "#sdk_menuitem_editorContextMenu";
        for (let i = spellCheckMenuItemIDs.length - 1; i > 0; i--) {
            log.debug("Removing " + spellCheckMenuItemIDs[i]);
            $(menuSDKIdPrefix + spellCheckMenuItemIDs[i]).element().remove();
            //menu.unregister(spellCheckMenuItemIDs[i], {context: spellCheckMenu});
        }
        log.debug("Removing separator (" + spellCheckMenuItemIDs[0] + ")");
        $(menuSDKIdPrefix + spellCheckMenuItemIDs[0]).element().remove();
        //menu.unregister(spellCheckMenuItemIDs[0], {context: beforeCutMenu});
        spellCheckMenuItemIDs = [];
    }
    
    /**
     * Returns the misspelled word under the caret, or `null` if there isn't
     * one.
     * If there is a misspelled word under the caret, the target range is also
     * set to the word.
     */
    this._getMisspelledWordUnderCaret = function() {
        // Verify the word under the caret is misspelled.
        var scimoz = editor.scimoz();
        var pos = scimoz.currentPos;
        log.debug("The caret is at buffer position " + pos);
        var indic_mask = scimoz.indicatorAllOnFor(pos);
        if (indic_mask < 0) {
            // The signed 32-bit integer Scintilla uses had the sign bit set.
            // Invert it.
            indic_mask = -indic_mask;
        }
        var INDICATOR_SPELLING_ERROR = Ci.koILintResult.INDICATOR_SPELLING_ERROR;
        if (!(indic_mask & Math.pow(2, INDICATOR_SPELLING_ERROR))) {
            log.debug("There is no misspelled word under the mouse cursor (indic mask=" + indic_mask + ").");
            return null;
        }
        
        // Determine the misspelled word and retrieve its suggestions.
        var s = scimoz.indicatorStart(INDICATOR_SPELLING_ERROR, pos);
        var e = scimoz.indicatorEnd(INDICATOR_SPELLING_ERROR, pos);
        if (e <= s) {
            log.debug("Unable to determine the misspelled word under the mouse cursor.");
            return null;
        }
        // Prepare for replacement.
        scimoz.targetStart = s;
        scimoz.targetEnd = e;
        return scimoz.getTextRange(s, e);
    }
    
    /** Returns a list of spelling suggestions for the given misspelled word. */
    this._getSuggestionsFor = function(word) {
        log.debug("Retrieving suggestions for " + word);
        var suggestionList = [];
        var suggestions = {};
        spellCheckEngine.suggest(word, suggestions, {});
        if (suggestions.value) {
            for (let suggestion of suggestions.value) {
                suggestionList.push(suggestion);
            }
        }
        return suggestionList;
    }
    
    /**
     * Inserts the given word in the spelling suggestions section of the context
     * menu.
     */
    this._insertSpellingSuggestion = function(suggestion) {
        // Ensure the spellcheck menu options and separator exist.
        if (spellCheckMenuItemIDs.length == 0) {
            // Insert the separator between spell check menu items and the
            // default context menu.
            log.debug("Inserting spellcheck menu separator");
            menu.register({
                id: "spellcheck_separator",
                separator: true,
                context: beforeCutMenu
            });
            spellCheckMenuItemIDs.push("spellcheck_separator");
        }
        // Insert the suggestion menu item.
        log.debug("Inserting suggestion " + suggestion);
        var id = "spelling_suggestion_" + spellCheckMenuItemIDs.length
        menu.register({
            id: id,
            label: suggestion || bundle.GetStringFromName("noSuggestedWords"),
            context: spellCheckMenu,
            command: function() {
                var word = this._getMisspelledWordUnderCaret();
                if (word) {
                    // The target range was set previously.
                    editor.scimoz().replaceTarget(-1, suggestion);
                }
            }.bind(this),
            disabled: !suggestion
        });
        spellCheckMenuItemIDs.push(id);
    }
    
    /**
     * Inserts the spell checking options into the context menu below any
     * suggestions.
     */
    this._insertSpellingOptions = function() {
        log.debug("Inserting spellcheck menu options");
        // Insert a separator between spelling suggestions and spell check
        // options.
        menu.register({
            id: "spellcheck_options_separator",
            separator: true,
            context: spellCheckMenu
        });
        spellCheckMenuItemIDs.push("spellcheck_options_separator");
        // Insert the spell check menu options.
        menu.register({
            id: "spellcheck_ignore",
            label: bundle.GetStringFromName("Ignore"),
            context: spellCheckMenu,
            command: function() {
                log.debug("Adding word to the list of ignored words.");
                // The target range was set previously.
                var scimoz = editor.scimoz();
                var word = scimoz.getTextRange(scimoz.targetStart, scimoz.targetEnd);
                this._addWordToIgnore(word);
            }.bind(this)
        });
        spellCheckMenuItemIDs.push("spellcheck_ignore");
    }
    
    /**
     * Adds the given word to the ignore list and re-checks spelling.
     * @param word The word to ignore.
     */
    this._addWordToIgnore = function(word) {
        var ignoredWords = prefs.getString(PREF_IGNORED_WORDS);
        ignoredWords = (ignoredWords + ' ' + word).trim();
        prefs.setString(PREF_IGNORED_WORDS, ignoredWords);
        // Clear all spelling indicators.
        var INDICATOR_SPELLING_ERROR = Ci.koILintResult.INDICATOR_SPELLING_ERROR;
        var scimoz = editor.scimoz();
        scimoz.indicatorCurrent = INDICATOR_SPELLING_ERROR;
        scimoz.indicatorClearRange(0, scimoz.length);
        // Re-check.
        this.checkSpelling();
    }
    
    /**
     * Retrieves the list of spell-check-able styles for the current language.
     * By default, in koLanguageServiceBase.py, spell-check-able styles are
     * comments, strings, data, and sections styles.
     * These styles can be configured per-language in "src/schemas/styles.py" or
     * in individual KoLanguageBase instances (Python classes) in
     * "src/languages/" via the "_stateMap" dictionary.
     */
    this._getSpellCheckableStyles = function() {
        var languageObj = legacy.views.manager.currentView.languageObj;
        var language = languageObj.name;
        if (!textStyles[language]) {
            log.debug("Determining text styles for " + language);
            textStyles[language] = {0: true};
            for (let style of languageObj.getSpellCheckableStyles()) {
                if (!prefs.getBoolean(PREF_SPELL_CHECK_WITHIN_STRINGS)) {
                    let skip = false;
                    for (let string_style of languageObj.getStringStyles()) {
                        if (string_style == style) {
                            log.debug("Style " + style + " is a string style; ignoring.");
                            skip = true;
                            break;
                        }
                    }
                    if (skip) {
                        continue;
                    }
                }
                log.debug("Identified " + style);
                textStyles[language][style] = true;
            }
        }
        return textStyles[language];
    }
    
    /** Jumps to the next misspelled word starting from the caret. */
    this.jumpToNextMisspelling = function() {
        var scimoz = editor.scimoz();
        if (!scimoz) {
            return;
        }
        if (this.checkSpelling(scimoz, true) ||
            this.checkSpelling(scimoz, true, 0, scimoz.currentPos)) {
            this.popupContextMenu();
        }
    }
    
    /** Ignores the misspelled word under the caret. */
    this.ignoreMisspelledWord = function() {
        if (!editor.scimoz()) {
            return;
        }
        var word = this._getMisspelledWordUnderCaret();
        if (word) {
            this._addWordToIgnore(word);
        }
    }
    
    /**
     * Pops up the context menu at the current position.
     * This is usually called when the caret is over a misspelled word in order
     * to show spelling suggestions.
     */
    this.popupContextMenu = function() {
        var view = legacy.views.manager.currentView;
        var scimoz = editor.scimoz();
        var x = scimoz.pointXFromPosition(scimoz.currentPos);
        var y = scimoz.pointYFromPosition(scimoz.currentPos);
        document.getElementById("editorContextMenu").openPopup(view, 'after_start', x, y, true);
    }
    
    /** Observes spell check preferences and acts accordingly. */
    this.observe = function(subject, topic, data) {
        if (topic != PREF_ENABLE_SPELL_CHECKING && topic != PREF_IGNORED_WORDS &&
            topic != PREF_DICTIONARY && topic != PREF_SPELL_CHECK_WITHIN_STRINGS) {
            return;
        }
        if (topic == PREF_DICTIONARY) {
            // Change the dictionary.
            spellCheckEngine.dictionary = prefs.getString(PREF_DICTIONARY);
            log.debug("Dictionary changed to " + spellCheckEngine.dictionary);
        }
        if (topic == PREF_SPELL_CHECK_WITHIN_STRINGS) {
            textStyles = {}; // clear and repopulate later
        }
        var INDICATOR_SPELLING_ERROR = Ci.koILintResult.INDICATOR_SPELLING_ERROR;
        for (let view of legacy.views.manager.getAllViews()) {
            if (prefs.getBoolean(PREF_ENABLE_SPELL_CHECKING)) {
                this.checkSpelling(view.scimoz);
            } else if (topic == PREF_ENABLE_SPELL_CHECKING) {
                view.scimoz.indicatorCurrent = INDICATOR_SPELLING_ERROR;
                view.scimoz.indicatorClearRange(0, view.scimoz.length);
            }
        }
    }
    
    /** Shows a tooltip for the misspelled word under the mouse. */
    this.showMisspellingTooltip = function(event) {
        var scimoz = event.detail.view.scimoz;
        var indic_mask = scimoz.indicatorAllOnFor(event.detail.pos);
        if (indic_mask < 0) {
            // The signed 32-bit integer Scintilla uses had the sign bit set.
            // Invert it.
            indic_mask = -indic_mask;
        }
        var INDICATOR_SPELLING_ERROR = Ci.koILintResult.INDICATOR_SPELLING_ERROR;
        if (indic_mask & Math.pow(2, INDICATOR_SPELLING_ERROR)) {
            var s = scimoz.indicatorStart(INDICATOR_SPELLING_ERROR, event.detail.pos);
            var e = scimoz.indicatorEnd(INDICATOR_SPELLING_ERROR, event.detail.pos);
            if (s < e) {
                event.detail.text = bundle.GetStringFromName("Misspelled word. Right-click to resolve.");
                event.preventDefault();
            }
        }
    }
}).apply(module.exports)