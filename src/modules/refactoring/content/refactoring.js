// Copyright (c) 2000-2013 ActiveState Software Inc.
// See the file LICENSE.txt for licensing information.

/* Refactoring
 *
 * Defines the "ko.refactoring" namespace.
 */
if (typeof(ko) == 'undefined') {
    var ko = {};
}
if (!('refactoring' in ko)) {
    ko.refactoring = {};
}

(function() {

const { classes: Cc, interfaces: Ci } = Components;
const platform = require("sdk/system").platform;
const pathSep = platform == "winnt" ? ";" : ":";

var log = ko.logging.getLogger("refactoring_js");
//log.setLevel(ko.logging.LOG_DEBUG);

var lazy = {};
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyGetter(lazy, "bundle", function()
    Components.classes["@mozilla.org/intl/stringbundle;1"]
    .getService(Components.interfaces.nsIStringBundleService)
    .createBundle("chrome://refactoring/locale/refactoring.properties"));

var codeintel, languages;

window.addEventListener("codeintel-ready", () =>
{
    codeintel = require("codeintel/service");
    codeintel.getLanguages().then((_languages) =>
    {
        languages = _languages;
    });
});

this.showPopupMenu = function(event, menupopup) {
    ko.commands.updateCommandset(document.getElementById("cmdset_refactoring"));
};

var showDocumentChangedMessage = function showDocumentChangedMessage(opCode) {
    var message = lazy.bundle.formatStringFromName("Document changed not finishing X",
                              [lazy.bundle.GetStringFromName(opCode)], 1);
    require("notify/notify").send(message, "refactoring");
};

 var showErrorInStatus = function(code, msg, extra) {
    if (typeof(code) == "undefined") code = "Refactoring ExtractMethod";
    if (typeof(msg) == "undefined" || !msg) {
        msg = Cc["@activestate.com/koLastErrorService;1"]
        .getService(Ci.koILastErrorService)
        .getLastErrorMessage();
    }
    if (typeof(extra) == "undefined") extra = null;
    if (extra) {
        msg += " " + extra;
    }
    require("notify/notify").send(lazy.bundle.GetStringFromName(code) + msg, "refactoring");
};

// languageName => refactoringLanguageObj
this._refactoringLanguageObjs = {};
this.getRefactoringLanguageObj = function getRefactoringLanguageObj(koDoc) {
    var languageName = koDoc.language;
    if (languageName in this._refactoringLanguageObjs) {
        return this._refactoringLanguageObjs[languageName];
    }
    var refactoringLanguageObj =
         (Components.classes["@activestate.com/koRefactoringLangSvcFactory;1"].
          getService(Components.interfaces.koIRefactoringLangSvcFactory).
          getRefactoringLangSvcForLanguage(languageName));
    this._refactoringLanguageObjs[languageName] = refactoringLanguageObj;
    refactoringLanguageObj.languageObj = koDoc.languageObj;
    return refactoringLanguageObj;
};

function getDefnsAsync(koDoc, pos, onResult, onDone, searchText) {
    let buf = koDoc.buffer;
    let language = koDoc.language;

    var partSvc = Cc["@activestate.com/koPartService;1"].getService(Ci.koIPartService);
    var curProject = partSvc.currentProject;
    var cwd = curProject ? curProject.liveDirectory : ko.uriparse.URIToPath(ko.places.getDirectory());
    var path = koDoc.file ? koDoc.file.path : "";

    var importPaths = require("codeintel/codeintel").getImportPaths(koDoc.prefs, koDoc.language, languages).join(pathSep);
    log.debug("pos: "+pos);
    log.debug("path: "+path);
    log.debug("cwd: "+cwd);
    log.debug("importPaths: "+importPaths);
    log.debug("language: "+language);

    codeintel.getDefinition(
    {
        buf: buf,
        pos: pos,
        path: path,
        parentPath: cwd,
        importPaths: importPaths,
        language: language
    })
    .then((defn)=>{onResult(defn);onDone();})
    .catch(log.error);
 }

this.goExtractMethod = function(view, scimoz, selectionStart, selectionEnd) {
    var koDoc = view.koDoc;
    if (!koDoc) {
        return;
    }
    var prevEditMd5Hash = koDoc.md5Hash();
    scimoz.colourise(scimoz.endStyled, -1);
    var buf = koDoc.buffer;
    var pos = scimoz.currentPos;
    var language = koDoc.language;
    var currentPos = scimoz.currentPos;
    let refactoringLanguageObj = this.getRefactoringLanguageObj(koDoc);
    /**
     * Show an error message in the status bar
     * @param msg {String} (Optional) The message to show; defaults to fetching
     *      from the last error service
     */

    var finalGlobals = [];
    var possibleGlobalIndex = 0;
    var currentSearchText;
    var currentCompareText_RE;
    var resolvedName;
    var inVars = [], outVars = [], possibleGlobals = [];
    // firstUseOutVars: subset of outVars that are defined only in the selection
    var firstUseOutVars = [];
    var pos_by_name = {}
    var variables = null;

    var gda_onGetVariables = function(aVariables) {
        if (!aVariables) {
            // We have an exception
            showErrorInStatus();
            return;
        }
        // 'variables' will be used by later callbacks, so save it
        variables = aVariables;
        const koIRefactorVariableInfo =
            Components.interfaces.koIRefactorVariableInfo;
        const usedSomewhere = (koIRefactorVariableInfo.USED_BEFORE_SELECTION
                               |koIRefactorVariableInfo.USED_IN_SELECTION
                               |koIRefactorVariableInfo.USED_AFTER_SELECTION);
        const definedSomewhere = (koIRefactorVariableInfo.DEFINED_BEFORE_SELECTION
                                  |koIRefactorVariableInfo.DEFINED_IN_SELECTION
                                  |koIRefactorVariableInfo.DEFINED_AFTER_SELECTION);
        for (let vInfo of variables) {
            let name = vInfo.name;
            let flags = vInfo.flags;
            let pos = (flags >> koIRefactorVariableInfo.NUM_USAGE_BITS);
            flags = (flags & (koIRefactorVariableInfo.USAGE_BITS
                              & ~koIRefactorVariableInfo.USED_AS_PARAMETER_NAME));
            if (flags == 0) {
                //dump("No need to handle \n");
                continue;
            }
            if (!(flags & definedSomewhere)) {
                //dump("possible global\n");
                possibleGlobals.push(name);
                pos_by_name[name] = pos;
                continue;
            }
            if (!(flags & usedSomewhere)) {
                //dump("not used anywhere - so don't bother doing anything with it\n");
                continue;
            }
            // All of these are both defined somewhere and used somewhere
            const DEFINED_BEFORE__USED_IN =
                 (koIRefactorVariableInfo.USED_IN_SELECTION|
                  koIRefactorVariableInfo.DEFINED_BEFORE_SELECTION);
            if ((flags & DEFINED_BEFORE__USED_IN) == DEFINED_BEFORE__USED_IN) {
                // Defined outside the selection, passed in
                inVars.push(name);
            }
            if ((flags & koIRefactorVariableInfo.DEFINED_IN_SELECTION)
                && (flags & (koIRefactorVariableInfo.USED_BEFORE_SELECTION
                             |koIRefactorVariableInfo.USED_AFTER_SELECTION))) {
                outVars.push(name);
                if ((flags & (koIRefactorVariableInfo.DEFINED_BEFORE_SELECTION
                              |koIRefactorVariableInfo.DEFINED_IN_SELECTION
                              |koIRefactorVariableInfo.DEFINED_AFTER_SELECTION
                              |koIRefactorVariableInfo.USED_AFTER_SELECTION))
                    == (koIRefactorVariableInfo.DEFINED_IN_SELECTION
                        |koIRefactorVariableInfo.USED_AFTER_SELECTION)) {
                    firstUseOutVars.push(name);
                }
            }
        }
        // Resolve each of the possibleGlobals, and keep only
        // those that are defined in this module
        filterPossibleGlobals();
    }.bind(this);

    // There will be Perl problems here with the sigils.
    var defn;
    var gda_onResult = function(defn) {
        if (gda_fallback_id) {
            clearTimeout(gda_fallback_id);
            gda_fallback_id = 0;
        }

        if ( ! defn) {
            return;
        }
        resolvedName = true;
        if (defn.path != koDoc.displayPath) {
            finalGlobals.push(currentSearchText);
            return;
        }
        if (defn.name != currentSearchText) {
            return;
        }
        // Is it defined in the current section?
        let pos = pos_by_name[currentSearchText];
        codeintel.getCaretScope({buf:buf, line:line, pos:pos, language:language})
            .then(gda_onBufSectionForResult)
            .catch(log.error);
    };
    var gda_onBufSectionForResult = function(ciBufSection) {
        if (!ciBufSection) {
            log.error("ciBufProblem #1: Can't get a section from line "
                      + scimoz.lineFromPosition(pos)
                      + "\n");
            return;
        }
        let curr_section_start_line_for_pos = ciBufSection.line;
        if (!defn) {
            finalGlobals.push(currentSearchText);
        } else if (defn.line == curr_section_start_line_for_pos) {
            gda_knowIfInSection(true);
        } else {
            codeintel.getCaretScope({buf:bug, line:defn.line, pos:pos, language:language})
                .then(function(ciBufSection)
                {
                    let curr_section_start_line_for_defn;
                    if (ciBufSection) {
                        curr_section_start_line_for_defn =  ciBufSection.line;
                    } else {
                        // It's a global var.
                        log.warn("ciBufProblem #2: Can't get a section from line " +
                                 defn.line + "\n");
                        curr_section_start_line_for_defn = defn.line;
                    }
                    if (curr_section_start_line_for_defn == curr_section_start_line_for_pos) {
                        gda_knowIfInSection(true);
                    } else {
                        finalGlobals.push(currentSearchText);
                        gda_knowIfInSection(false);
                    }
                })
                .catch(log.error);
        }
    };
    var gda_knowIfInSection = function(inSection) {
        if (inSection && currentSearchText in variables) {
            let flags = variables[currentSearchText].flags;
            if (flags & koIRefactorVariableInfo.USED_IN_SELECTION) {
                inVars.push(currentSearchText);
            }
            if ((flags & koIRefactorVariableInfo.DEFINED_IN_SELECTION)
                && (flags & (koIRefactorVariableInfo.USED_BEFORE_SELECTION
                             |koIRefactorVariableInfo.USED_AFTER_SELECTION))) {
                outVars.push(currentSearchText);
                if ((flags & (koIRefactorVariableInfo.DEFINED_BEFORE_SELECTION
                              |koIRefactorVariableInfo.DEFINED_IN_SELECTION
                              |koIRefactorVariableInfo.DEFINED_AFTER_SELECTION
                              |koIRefactorVariableInfo.USED_AFTER_SELECTION))
                    == (koIRefactorVariableInfo.DEFINED_IN_SELECTION
                        |koIRefactorVariableInfo.USED_AFTER_SELECTION)) {
                    firstUseOutVars.push(name);
                }
            }
        }
    };
    var gda_fallback_id = 0;
    var gda_onDone = function gda_onDone() {
        clearTimeout(gda_fallback_id);
        if (!resolvedName) {
            //dump("Couldn't resolve " + currentSearchText + "\n");
            finalGlobals.push(currentSearchText);
        }
        possibleGlobalIndex++;
        filterPossibleGlobals();
    };
    var gda_fallback = function() {
        // See bug 99301: sometimes the controller.done callback isn't invoked.
        possibleGlobalIndex++;
        filterPossibleGlobals();
    };
    var docChanged = function docChanged() {
        var currEditMd5Hash = koDoc.md5Hash();
        if (prevEditMd5Hash != currEditMd5Hash) {
            showDocumentChangedMessage("Extract-Method");
            return true;
        }
        return false;
    };
    var lineStart;
    var continueExtractingMethod = function continueExtractingMethod() {
        var title = "New method name";
        var prompt = ("Input vars: " + inVars
                      + ", output vars: " + outVars);
        if (docChanged()) {
            return;
        }
        var methodName = ko.dialogs.prompt("New method name:");
        if (!methodName) {
            return;
        }
        //XXX: Make sure we just get the current section's start line once
        try {
            lineStart = scimoz.lineFromPosition(selectionStart);
            // Sections use a 1-based line# API
            codeintel.getCaretScope({buf:buf, line:lineStart + 1, pos:pos, language:language})
                .then(doExtractMethod.bind(null, methodName))
                .catch(log.error);
        } catch(ex) {
            log.exception(ex, "Error in extractMethod");
        }
    };
    var doExtractMethod = function(methodName, ciBufSection) {
        var sectionLineStart = (ciBufSection
                                ? ciBufSection.line - 1
                                : 0);
        if (docChanged()) {
            return;
        }
        try {
            var selPoints = refactoringLanguageObj.
                extractMethod(scimoz,
                              selectionStart, selectionEnd,
                              sectionLineStart,
                              methodName,
                              inVars.length, inVars,
                              outVars.length, outVars,
                              firstUseOutVars.length, firstUseOutVars,
                              {});
        } catch(ex) {
            showErrorInStatus();
            return;
        }
        
        if (selPoints.length) {
            // We'll need this if we want to stop flashing the new code
            // if the user makes an edit right away.
            // prevEditMd5Hash = koDoc.md5Hash();
            var selStart = selPoints[0];
            var selEnd = selPoints[1];
            scimoz.gotoPos(selStart);
            scimoz.scrollCaret();
            scimoz.selectionStart = selStart;
            scimoz.selectionEnd = selEnd;
            // Highlight the changed code
            var timeIntervals = [ {on: 150, off:75},
                                {on: 150, off:75},
                                {on: 150, off:75},
                                {on: 150, off:75},
                                {on:100, off:50}];
            scimoz.indicatorCurrent = Ci.koILintResult.DECORATOR_FIND_HIGHLIGHT;
            var newSelPoints;
            if (selPoints.length == 2) {
                newSelPoints = [selPoints];
            } else if (selPoints.length >= 4) {
                newSelPoints = [[selPoints[0], selPoints[1]], [selPoints[2], selPoints[3]]];
            } else {
                return;
            }
            highlightIntervalsOn(0, newSelPoints, timeIntervals);
        }
    };
    
    var highlightIntervalsOn = function(index, ranges, timeIntervals) {
        if (index >= timeIntervals.length) {
            return;
        }
        // Do we want this?
        //if (docChanged()) {
        //    return;
        //}
        scimoz.indicatorCurrent = Ci.koILintResult.DECORATOR_FIND_HIGHLIGHT;
        for each ([selStart, selEnd] in ranges) {
                scimoz.indicatorFillRange(selStart, selEnd - selStart);
            }
        setTimeout(highlightIntervalsOff,
                timeIntervals[index].on,
                index, ranges, timeIntervals);
    };
    var highlightIntervalsOff = function(index, ranges, timeIntervals) {
        scimoz.indicatorCurrent = Ci.koILintResult.DECORATOR_FIND_HIGHLIGHT;
        for each ([selStart, selEnd] in ranges) {
                scimoz.indicatorClearRange(selStart, selEnd - selStart);
            }
        setTimeout(highlightIntervalsOn,
                timeIntervals[index].off,
                index + 1, ranges, timeIntervals);
    };
        
    var filterPossibleGlobals = function filterPossibleGlobals() {
        if (possibleGlobalIndex >= possibleGlobals.length) {
            log.debug("filterPossibleGlobals: all done");
            continueExtractingMethod();
            return;
        }
        currentSearchText = possibleGlobals[possibleGlobalIndex];
         
        if (!(currentSearchText in pos_by_name)) {
            possibleGlobalIndex++;
            filterPossibleGlobals();
            return;
        }
        currentCompareText_RE = new RegExp(currentSearchText);
        resolvedName = false;
        gda_fallback_id = setTimeout(gda_fallback, 1000);
        defn = null; // gets set in gda_onResult
        getDefnsAsync(koDoc, pos_by_name[currentSearchText],
                      gda_onResult, gda_onDone, currentSearchText);
    }

    try {
        selectionStart = refactoringLanguageObj.adjustStartPosition(scimoz,
                                                                    selectionStart);
        selectionEnd = refactoringLanguageObj.adjustEndPosition(scimoz,
                                                                selectionEnd);
        refactoringLanguageObj.categorizeVariables(scimoz, koDoc,
                                                   selectionStart, selectionEnd,
                                                   gda_onGetVariables);
    } catch(ex) {
        showErrorInStatus();
        return;
    }
    // Code continues after categorizing variables and filtering possibleGlobals
    // into finalGlobals in continueExtractingMethod();
};

this._getRanges = function _getRanges(scimoz, currentPos) {
    var rangeStart = scimoz.wordStartPosition(currentPos, true),
        rangeEnd = scimoz.wordEndPosition(currentPos, true);
    if (scimoz.selectionStart != scimoz.selectionEnd
        && (scimoz.selectionStart != rangeStart
            || scimoz.selectionEnd != rangeEnd)) {
        // Most of the time the term resolver will behave unexpectedly
        // when part of a word is selected.
        var message = lazy.bundle.GetStringFromName("Current Selection Not a Full Variable Name");
        require("notify/notify").send(message, "refactoring");
        rangeStart = scimoz.selectionStart;
        rangeEnd = scimoz.selectionEnd;
    }
    return [rangeStart, rangeEnd];
};
    

this.inRenameVariable = false;
this.goRenameVariable = function(view, scimoz, styles) {
    /*
     * Find where the current variable is defined.
     * If not found, return.
     * Otherwise get the scope at the definition point, and then
     * use multiple-scintilla points to change every instance
     * interactively.
     */
    // This code borrows from
    // codeintel/codeintel.p.js::ko.codeintel.highlightVariable

    // Note that we do this thing asynchronously through the
    // codeintel system.  By making this object an instance of
    // koICodeIntelCompletionUIHandler we can use 'this' to
    // continue the search.

    // If there's a non-empty selection, treat that as the word.
    // Otherwise, just use wordStart and wordEnd
    var currentPos = scimoz.selectionStart;
    [rangeStart, rangeEnd] = this._getRanges(scimoz, currentPos);
    var koDoc = view.koDoc;
    var prevEditMd5Hash = koDoc.md5Hash();
    var refactoringLanguageObj = this.getRefactoringLanguageObj(koDoc);
    var searchText = scimoz.getTextRange(rangeStart, rangeEnd);
    var searchTextForFindAll = {};
    var compareText = {};
    
    var lineEndPos = scimoz.getLineEndPosition(scimoz.lineFromPosition(rangeEnd));
    var nextChar = " ";
    for (var nextPos = rangeEnd; nextPos < lineEndPos; nextPos = scimoz.positionAfter(nextPos)) {
        nextChar = scimoz.getWCharAt(nextPos);
        if (" \t".indexOf(nextChar) === -1) {
            break;
        }
    }
    refactoringLanguageObj.getSearchTermForVariable(searchText, nextChar,
                                         searchTextForFindAll, compareText);
    searchTextForFindAll = searchTextForFindAll.value;
    compareText = compareText.value;
    var compareText_RE = new RegExp(compareText);
    log.debug("**************** searchText: " + searchText);
    log.debug("**************** compareText: " + compareText);
    var do_next_range;
    var ranges = [];
    if (this._last_highlight_async) {
        this._last_highlight_async.cancel(Cr.NS_ERROR_ABORT);
    }
    this._last_highlight_async = null;

    var scopeStart = 0;
    var scopeEnd = scimoz.length;
    
    var checkOtherScopes;

    var hitMatches = function hitMatches(hitText) {
        if (compareText_RE) {
            return compareText_RE.test(hitText);
        }
        return searchText == hitText
    };
    var findHitCallback = {
        rawRanges: [],
        pending: 0,
        done: false,
        onHit: function(hit) {
            // Accept all hits that match the same style as the
            // variable that we wanted to match, possibly also
            // strings & comments.
            // Later on we need to run the rawRanges through a
            // separate scope check to eliminate items at inner scopes.
            let start = hit.start_pos;
            if (start < 0) {
                //log.debug("Hit as start posn of " + hit.start_pos + "\n");
                return;
            }
            let end = hit.end_pos;
            log.debug("findHitCallback.onHit: start:" + start
                      + ", end: " + end);
            if (end < scopeStart) {
                log.debug("ignore hit at posn "
                          + start +":" + end
                          + ": scope starts at "
                          + scopeStart);
                return;
            } else if (start >= scopeEnd) {
                log.debug("ignore hit at posn "
                          + start +":" + end+
                          + ": scope ends at "
                          + scopeEnd);
                return;
            }
            // Now there are three different ways to interpret start and end
            // 1: raw
            var hitText = scimoz.getTextRange(start, end);
            var candidateHitTexts = null;
            var foundHitText = false;
            if (hitMatches(hitText)) {
                foundHitText = true;
                this.rawRanges.push([start, end]);
                log.debug("this.rawRanges now: " + this.rawRanges);
            } else {
                candidateHitTexts = [hitText];
                // 2: offsets from the beginning of the document
                start = scimoz.positionAtChar(0, hit.start_pos);
                end = scimoz.positionAtChar(0, hit.end_pos);
                if (start > hit.start_pos && end > hit.end_pos) {
                    hitText = scimoz.getTextRange(start, end);
                    if (hitMatches(hitText)) {
                        foundHitText = true;
                        this.rawRanges.push([start, end]);
                    } else {
                        candidateHitTexts.push(hitText);
                        // 3: adjusted offsets
                        let scopeStartAdj = scimoz.positionAtChar(0, scopeStart);
                        let scopeDelta = scopeStartAdj - scopeStart;
                        if (scopeDelta > 0) {
                            start -= scopeDelta;
                            end -= scopeDelta;
                            hitText = scimoz.getTextRange(start, end);
                            if (hitMatches(hitText)) {
                                foundHitText = true;
                                this.rawRanges.push([start, end]);
                            } else {
                                candidateHitTexts.push(hitText);
                            }
                        }
                    }
                }
            }
            if (!foundHitText) {
                log.debug("Rejected various hitTexts " + candidateHitTexts
                          + ",searchText: " + searchText +
                          + "\n");
            }
            // Ignore if it's an attribute
            if (refactoringLanguageObj.wordIsAttribute(scimoz, start)) {
                log.debug("!!!!!!!!!!!!!!!! Ignore "
                          + scimoz.getTextRange(start, end)
                          + " start: "
                          + start
                          + ", end: "
                          + end
                          + " .... it's an attribute\n");
                return;
            }
                
            let leadStyle = scimoz.getStyleAt(start);
            if (styles.indexOf(leadStyle) === -1) {
                log.debug("ignore style "
                          + leadStyle
                          + " at "
                          + start
                          + ":"
                          + end
                          + ", valid styles are: "
                          + styles);
                return;
            }
        },
        onDone: function() {
            log.debug("findHitCallback.onDone: rawRange: "
                      + this.rawRanges);
            checkOtherScopes.start(this.rawRanges);
        }
    };
    var pivotScopeStart, pivotScopeEnd;
    var getResults = function () {
        log.debug("refac: getResults: get nextscope from pivotstart");
        // Get the area we are going to search in, either global or some sub scope.
        var getPivots = function() {
            log.debug("getResults: getPivots");
            // Build the search range based the scope that we will build
            // from the definition found using getDefinition.
            // When we have a range to search in call havePivot() which does the
            // search...I didn't name these things...
            // Later, CheckOtherScopes will look at each potential variable and
            // confirm they are defined by the original definition found.
            // NOTE: codeintel returns line numbers starting from 1
            //       scimoz takes line number starting from 0
            let rangeStartLine = sourceVarDefn.line;
            codeintel.getCaretScope({buf:koDoc.buffer,
                                         line:rangeStartLine,
                                         pos:scimoz.positionFromLine(rangeStartLine-1),
                                         language:koDoc.language})
                .then(function(section)
                {
                    // Skip nextScope if we're looking in global
                    if ( ! section)
                    {
                        pivotScopeStart = 1;
                        pivotScopeEnd = scimoz.lineCount;
                        havePivots();
                        return;
                    }
                    pivotScopeStart = section.line;
                    codeintel.getNextScope({buf:koDoc.buffer,
                                        line:pivotScopeStart,
                                        language:koDoc.language})
                        .then(function(section) {
                            pivotScopeEnd = section ? section.line : scimoz.lineCount;
                            if (typeof(pivotScopeStart) != "undefined") {
                                if (pivotScopeEnd < pivotScopeStart) {
                                    pivotScopeEnd = scimoz.lineCount;
                                }
                            }
                            log.debug("pivotScopeStart: "+pivotScopeStart);
                            log.debug("pivotScopeEnd: "+pivotScopeEnd);
                            havePivots();
                        }).catch(log.error)
                }).catch(log.error);
            
        };
        var havePivots = function() {
            log.debug("getResults: havePivot");
            log.debug("pivotScopeStart: " +pivotScopeStart);
            log.debug("pivotScopeEnd: " +pivotScopeEnd);
            scopeStart = scimoz.positionFromLine(pivotScopeStart - 1);
            scopeEnd = -1;
            if (pivotScopeEnd != 0) {
                scopeEnd = scimoz.positionFromLine(pivotScopeEnd);
            }
            if (scopeEnd <= 0) {
                scopeEnd = scimoz.length; // if it's at the last line
            }
            log.debug("Using scopeStart:"
                      + scopeStart
                      + ":" + scopeEnd);
            let firstLine = scimoz.firstVisibleLine;
            let lastLine = firstLine + scimoz.linesOnScreen + 1; // last may be partial
            let endPos = scimoz.positionFromLine(lastLine);
            // endPos == -1 means we can see the lastLine on the screen,
            // no need to colourise
            if (endPos >= 0 && endPos < scopeEnd) {
                // Colourise the rest of the file.
                scimoz.colourise(endPos, scopeEnd);
            }

            let text = scimoz.getTextRange(scopeStart, scopeEnd);
            var opts = Cc["@activestate.com/koFindOptions;1"].createInstance();
            opts.matchWord = false;
            opts.searchBackward = false;
            opts.caseSensitivity = Ci.koIFindOptions.FOC_SENSITIVE;
            opts.preferredContextType = Ci.koIFindContext.FCT_CURRENT_DOC;
            opts.showReplaceAllResults = false;
            opts.displayInFindResults2 = false;
            opts.multiline = false;
            opts.patternType = Ci.koIFindOptions.FOT_REGEX_PYTHON;
            this._last_highlight_async = (Cc["@activestate.com/koFindService;1"]
                                          .getService(Ci.koIFindService)
                                          .findallasync(searchTextForFindAll, text, findHitCallback,
                                                        scopeStart, opts));
            log.debug("getResults: havePivot : DONE");
        }.bind(this);
        getPivots();
    };
    var sourceVarDefn;
    var gda_onResult = function(defn) {
        if ( ! defn )
            return;
        log.debug("gda_onResult: defn: "
                  + defn);
        log.debug("searchText: " + searchText);
        if (hitMatches(defn.symbol))
            sourceVarDefn = defn;
    };
    getDefnsAsync(koDoc, currentPos, gda_onResult, getResults, searchText);
    var workWithHits = function workWithHits(ranges) {
        if (ranges.length === 0) {
            log.debug("No ranges to work with");
            return;
        }
        log.debug("workWithHits: ranges: " + ranges);
        var message;
        if (ranges.length == 1) {
            message = lazy.bundle.formatStringFromName("Changing only one hit at line X",
                                                  [scimoz.lineFromPosition(ranges[0][0]) + 1],
                                                  1);
        } else {
            message = lazy.bundle.formatStringFromName("Changing X hits from line Y through Z",
                                                  [ranges.length,
                                                   scimoz.lineFromPosition(ranges[0][0]) + 1,
                                                   scimoz.lineFromPosition(ranges[ranges.length - 1][0]) + 1],
                                                  3);
        }
        message = lazy.bundle.GetStringFromName("Refactoring") + ": " + message;
        require("notify/notify").send(message, "refactoring");
        // Set the fields used by the multi-caret session-end callback.
        // When we end, we want to be at the same relative spot in the
        // new word where we were in the old word
        let rangeStart = scimoz.wordStartPosition(currentPos, true);
        let rangeEnd = scimoz.wordEndPosition(currentPos, true);
        let currentLine = scimoz.lineFromPosition(currentPos);
        let lineStartPos = scimoz.positionFromLine(currentLine);
        let currentLineStartText = scimoz.getTextRange(lineStartPos, rangeEnd);
        this.changeStartColumn = rangeStart - lineStartPos;
        let currentWord = currentLineStartText.substr(this.changeStartColumn);
        let currentLineBeforeWord = currentLineStartText.substr(0,
                                                    this.changeStartColumn);

        let partEscape = function(ptn)
            ptn.replace(/([\$\^\*\(\)\[\]\{\}\.\?\\])/g, "\\$1");

        let regexEscape = function(subject, targetWord) {
            if (subject.indexOf(targetWord) == -1) {
                return partEscape(subject);
            }
            return subject.split(targetWord).map(function(s) partEscape(s)).join(".*?");
        };
        let searchPattern = "(" + regexEscape(currentLineBeforeWord, currentWord) + ")";
        this.changeStartLine = currentLine;
        this.changeSearchPattern = searchPattern;
        this.wordStartOffset = currentPos - rangeStart;

        // Add multiple selections for the ranges determined.
        var startPos = ranges[0][0];
        var endPos = ranges[0][1];
        scimoz.setSelection(endPos, startPos);
        for (var i = 1; i < ranges.length; i++) {
            [startPos, endPos] = ranges[i];
            scimoz.addSelection(endPos, startPos);
        }
        scimoz.mainSelection = 0;
    }.bind(this);
    
    var sourceVarOtherDefn;
    var gda_onResult_onOtherScopes = function(defn) {
        if ( ! defn )
            return;
        log.debug("gda_onResult_onOtherScopes: defn: ")
        log.debug(defn);
        if (hitMatches(defn.symbol))
            sourceVarOtherDefn = defn;
    };
    var getResults_checkOtherScopes;
    checkOtherScopes = {
        start: function(ranges) {
            this.ranges = ranges;
            this.finalRanges = [];
            this.lim = ranges.length;
            this.idx = 0;
            log.debug("checkOtherScopes.start: this.lim: " + this.lim)
            this.checkNextRange();
        },
        checkNextRange: function() {
            log.debug("checkOtherScopes.checkNextRange: this.idx: " + this.idx)
            if (this.idx >= this.lim) {
                var currEditMd5Hash = koDoc.md5Hash();
                if (prevEditMd5Hash != currEditMd5Hash) {
                    showDocumentChangedMessage("Rename-Variable");
                    return;
                }
                workWithHits(this.finalRanges);
                return;
            }
            var range = this.ranges[this.idx];
            log.debug("   range: " + range);
            // We already looked up the scope for the original var, so don't relook
            if (range[0] == rangeStart) {
                this.finalRanges.push(range);
                ++this.idx;
                this.checkNextRange();
                return;
            }
            gda_fallback_id = setTimeout(function() {
                    gda_fallback_id = 0;
                    // If all characters are comments, add it anyway.
                    var style = scimoz.getStyleAt(range[0]);
                    if (koDoc.languageObj.getCommentStyles().indexOf(style) !== -1
                        || koDoc.languageObj.getNamedStyles("default").indexOf(style) !== -1) {
                        // Add the current string anyway
                        this.finalRanges.push(range);
                    }
                    this.idx += 1;
                    this.checkNextRange();
                }.bind(this), 1000);
            getDefnsAsync(koDoc, range[0], gda_onResult_onOtherScopes,
                          getResults_checkOtherScopes,
                          searchText);
        },
        getResults: function() {
            if (!sourceVarOtherDefn) {
                log.debug("getResults: idx:"
                          + this.idx
                          + ", no defn");
            } else {
                var defn = sourceVarOtherDefn;
                log.debug("range " + this.ranges[this.idx] + " has scope " + pivotScopeStart + ":" + pivotScopeEnd);
                if (sourceVarOtherDefn.line == sourceVarDefn.line) {
                    log.debug("Include range " + this.ranges[this.idx]);
                    this.finalRanges.push(this.ranges[this.idx]);
                } else {
                    log.debug("**** Exclude range " + this.ranges[this.idx]);
                }
            }
            ++this.idx;
            this.checkNextRange();
        },
        __END__: null
    };
    getResults_checkOtherScopes = function() {
        if (gda_fallback_id) {
            clearTimeout(gda_fallback_id);
            gda_fallback_id = 0;
        }
        checkOtherScopes.getResults();
    }
    
};

this.goRenameClassMember = function(view, scimoz, styles) {
    /**
     *
     * This is slippier than renameVariable.
     *
     * Find the scope the current name belongs to, walk up looking
     * for a fully-qualified class or module (depends on language),
     * and then look for all instances of that FQ class, and find
     * hits for FQ/attributeName, offering to change attributeName
     * to something else.
     *
     */
    var dirty = [];
    var dirtyPaths = [];
    var views = ko.views.manager.getAllViews();
    for (let view of views)
    {
        if (view.koDoc.file && view.isDirty)
        {
            dirty.push(view);
            dirtyPaths.push(view.koDoc.file.path);
        }
    }

    if (dirty.length)
    {
        var cont = require("ko/dialogs").confirm(
            "The following files need to be saved before we can refactor your files:",
            {
                text: dirtyPaths.join("\n"),
                yes: "Save and Continue",
                no: "Cancel"
            }
        );
        if ( ! cont) return;

        for (let view of dirty)
        {
            view.save();
        }
    }

    var currentPos = scimoz.currentPos, rangeStart, rangeEnd;
    [rangeStart, rangeEnd] = this._getRanges(scimoz, currentPos);
    var searchText = scimoz.getTextRange(rangeStart, rangeEnd);
    
    // Close the confirm-changes window if it's open
    var wins = (ko.windowManager.getWindows("komodo_refactoring_confirm_repl").
                concat(ko.windowManager.getWindows("komodo_renameClassMember")));
    if (wins.length) {
        var prompt = lazy.bundle.GetStringFromName("Close the current Rename Class Member window");
        var defaultResponse = "No";
        var text = null;
        var title = lazy.bundle.GetStringFromName("Rename Class Member in Progress");
        var response = ko.dialogs.yesNo(prompt, defaultResponse, text, title);
        if (response == "No") {
            return;
        }
        wins.forEach(function(win) win.close());
    }    
    // Look for the definition of the current name
    var defn = null;
    //var findHits, findHits_aux; // will be first cplnHandler
    //var fqHandler; // will be a second cplnHandler, when we have more info
    var koDoc = view.koDoc;
    var fallbackHandlerID = 0;
    var getRenameParameters = function getRenameParameters() {
        // 3 ways to invoke this method.  See below.
        if (fallbackHandlerID) {
            clearTimeout(fallbackHandlerID);
            fallbackHandlerID = 0;
        } else {
            return;
        }
        // This is like the find/replace window, with some
        // hardwired behaviors, and a different backend
        //XXX: Rename the XUL file
        ko.windowManager.openDialog(
            "chrome://refactoring/content/renameAttribute.xul",
            "komodo_refactoring_renameClassMember",
            "chrome,close=yes,centerscreen",
            { pattern: searchText,
                    defn: defn,
                    view: view,
                    refactoringLanguageObj: this.getRefactoringLanguageObj(koDoc)
            });
    }.bind(this);
    
    //fallbackHandlerID = setTimeout(getRenameParameters, 3000); // #2: if all-else fails fallback
    fallbackHandlerID = setTimeout(getRenameParameters, 3000);
    // #2: if all-else fails fallback
    codeintel.getCompletions({buf:koDoc.buffer,
                             pos:scimoz.currentPos,
                             language:koDoc.language})
        .then(getRenameParameters)
        .catch((error)=>
               {
                    log.exception(error);
                    getRenameParameters();
                });
};

this.onLoad = function() {
    window.removeEventListener('komodo-ui-started', ko.refactoring.onLoad, false);
    var prefs = ko.prefs;
    this.prefs = {};
    const prefDefaults = [
                          ["refactoring.renameVariable_in_strings", false],
                          ["refactoring.renameVariable_in_comments", true],
                          ];
    prefDefaults.forEach(function(a1) {
            var prefName, prefVal;
            [prefName, prefVal] = a1;
            if (!prefs.hasPref(prefName)) {
                prefs.setBooleanPref(prefName, prefVal);
            }
            prefs.prefObserverService.addObserver(this, prefName, false);
            this.prefs[prefName] = prefs.getBoolean(prefName);
        }.bind(this));
    this.copySubMenu();
}.bind(this);

this.copySubMenu = function() {
    var srcNodes = document.getElementById("refactoring-sub-menu").childNodes;
    var dest = document.getElementById("refactoring-sub-menu-2");
    var newNode;
    Array.slice(srcNodes).forEach(function(node) {
            newNode = node.cloneNode(true);
            newNode.id = node.id + "-2";
            dest.appendChild(newNode);
        });
};
    

this.observe = function(subject, topic, data) {
    switch(topic) {
      case "refactoring.renameVariable_in_strings":
      case "refactoring.renameVariable_in_comments":
        this.prefs[topic] = ko.prefs.getBoolean(topic);
        break;
      default:
        dump("Ignore unknown topic: " + topic + "\n");
    }
};

}).apply(ko.refactoring);

window.addEventListener('komodo-ui-started', ko.refactoring.onLoad, false);
