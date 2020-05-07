/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* The new new Rx dialog.
 *
 * See:
 *  http://www.perl.com/doc/manual/html/pod/perlre.html
 *  http://www.perldoc.com/perl5.6/pod/perlre.html
 *
 * Usage:
 *  All dialog interaction is done via an object passed in and out as the first
 *  window argument: window.arguments[0].
 *      .language   The regular expression language syntax to use. Defaults to
 *                  Python (XXX for now, but will likely default to Perl).
 *      .regex      A regular expression to use. Defaults to the selection in
 *                  the current buffer (if there is one and it is not
 *                  multi-line) or the regex value when Rx was last closed.
 *      .replacement
 *                  A replacement pattern to use.
 *      .searchText Text in which to search. Defaults to the selection in
 *                  the current buffer (if there is one and it *is*
 *                  multi-line) or the search text when Rx was last closed.
 *      .mode
 *      .matchCase  Is a boolean used to set the 'I' match flag.
 *      .flagMultiline
 *                  A boolean used to set the 'M' match flag.
 *
 *  On return window.arguments[0] has:
 *      .language   The regular expression language syntax set at exit.
 *      .regex      The regular expression set at exit.
 *      .replacement  The replacement pattern at exit.
 *      .searchText
 *      .mode
 */
//---- Dev Notes:
// What modes to have?
//  - Python: match, search, findall, replace, split
//  - Perl: match (like Python's search), replace, split, ['g' modifier]
//  - Perl alternative: match, match all, replace, replace all, split
//  - PHP: (possibly grep), match, match all, replace, split
//  - Tcl: match, match all, replace, replace all, split
//  - Blue Sky for all: replace with callback
// Solution:
//    <match> <match all> <split> <replace> <replace all>
// Python (for now at least) will not have a mode for re.match(). Note that
// the "match" mode is akin to Python's re.search().
//
//---- BUGS:
//  - typing in Search Text does not update highlighting of hits
//
//---- PERF:
//  - PERF: need to do match results updating and search text styling only
//    every second or so, e.g. regex="foo|" which matches at _every_ index.
//
//---- TODO:
//  - add shortcut to "Escape the selection"
//  - drag and drop support: try to drag text around to get tracebacks
//  - icons for the match results tree view
//  - NOTE additional PHP regex modifiers:  http://ca3.php.net/manual/en/pcre.pattern.modifiers.php
//  - perlre.html describes a case where regex matches can yield Perl warnings.
//    We should trap and show those.
//  - The perl backend has to know whether to "use utf8;" and "use
//    <someotherone>;". Read perlre.html for details.
//  -- EP comment 9/23/09: [use utf8] applies only to strings in the source,
//     not the data. JSON decoding handles non-ascii characters correctly.
//  - implement extracting regex from the current
//    document (will this require heuristics for
//    Python? how to tell if a Python string is a
//    string or a regex? should Rxx take the hint
//    it cursor is on a re.compile or re.search,
//    etc. method?)
//  - implement ties to a current view, i.e. (1)
//    inserting the result back in, (2) others?
//  - implement providing a documented/verbosified version of
//    the regex
//  - mru menu (or should this be an explicit save list?)
//    Could just ask (w/ don't ask again) with a dialog on
//    exit, each time.
//  - "describe" button to pop a dialog with a verbose layout
//    of the regex, this dialog offers to replace the existing
//    one?
//  - general scintilla buffer properties?
//  - help menu could include link to Rx Cookbook on ASPN
//  - try using the INDIC_BOX indicator to mark matches instead of the
//    of background color highlighting when we upgrade to the Scintilla
//    that supports this
//  - Fix double-click (select word) in regex view to recognize lexical state
//    boundaries such that double-clicking on "foo" in the following, just
//    selected "foo":
//        \x0Ffoo
//  - Would be nice to have Ctrl+<right/left-arrow> also use lexical states
//    to effect.
//
// Blue Sky Feature Requests:
//  - Animate the hiding/showing of the replace column
//    (see _Rxx_{Show|Hide}ReplaceColumn).
//  - Vim, egrep, grep, Emacs regex syntaxes
//  - Highlighting feature: shade the background of groups and make the
//    shading darker the more deeply nested the group.
//  - Consider an outliner view of the regex structure (with a tree with
//    hierarchy), similar to what OptiPerl has.
//  - Perl tr///cds support

xtk.include("domutils");

var log = ko.logging.getLogger("rxx");
//log.setLevel(ko.logging.LOG_DEBUG);

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const SC_MOD_INSERTTEXT = Components.interfaces.ISciMoz.SC_MOD_INSERTTEXT;
const SC_MOD_DELETETEXT = Components.interfaces.ISciMoz.SC_MOD_DELETETEXT;
const PREFERRED_EOL_MODE = Components.interfaces.ISciMoz.SC_EOL_LF;

var gPrefs = null;  // access to global prefs
var gWidgets = null; // cache of widget DOM nodes
var gRegexEventist = null; // event handler for the regex SciMoz
var gReplacementEventist = null; // event handler for the replacement SciMoz
var gSearchTextEventist = null; // event handler for the search text SciMoz
var gReplacedTextEventist = null; // event handler for the replaced text SciMoz
// Boolean indicating if the regex syntax shortcuts menupopup needs to be
// (re)built.
var gNeedToRebuildRegexShortcuts = null;
var gNeedToRebuildReplacementShortcuts = null;
var gLanguage = null;
var gMode = null; // e.g. "match", "match-all", "split", "replace", ...
var gRegexOptions = null;
var gHandler = null; // koIRxxHandler instance for the current language
var gResultsManager = null; // JS-implemented XPCOM interface from Python code to JS ui.
var gBackEndResultsManager = null; // koIRxxResultsManager that talks to gResultsManager
var gInProgressOnTimer = 0;
var gInProgressOnTimerDelayTime = 300; // msecs

var gOnModifiedHandlerTimeoutId = 0;
var gOnModifiedHandlerTimer = 500; // msecs

var gStyleUpdateTimerId = 0;
var gMainWindow;

const STYLING_DELAY_TIME = 0;
const STYLING_ITERS_PER_SLICE = 1000;

const MATCHING_DONE = Components.interfaces.koIRxxResultsManager.MATCHING_DONE;
const MATCHING_DONE_ON_ERROR = Components.interfaces.koIRxxResultsManager.MATCHING_DONE_ON_ERROR;
const MATCHING_IN_PATTERN_MATCH = Components.interfaces.koIRxxResultsManager.MATCHING_IN_PATTERN_MATCH;
const MATCHING_UPDATING_RESULTS = Components.interfaces.koIRxxResultsManager.MATCHING_UPDATING_RESULTS;
var gProgressStatus = MATCHING_DONE;

var gLanguageToHandlerCID = {
    "ruby": "@activestate.com/koRxxRubyHandler;1",
    "javascript": "@activestate.com/koRxxJavaScriptHandler;1",
    "perl": "@activestate.com/koRxxPerlHandler;1",
    "php": "@activestate.com/koRxxPHPHandler;1",
    "python": "@activestate.com/koRxxPythonHandler;1",
    "tcl": "@activestate.com/koRxxTclHandler;1",
};

var gLanguageToDisplayName = {
    "javascript":   "JavaScript",
    "perl":   "Perl",
    "php":    "PHP",
    "python": "Python",
    "ruby":   "Ruby",
    "tcl":   "Tcl",
};

var byteResultsFromLanguage = {
    "javascript":false,
    "perl": false,
    "php": true,
    "python": false,
    "ruby": false,
    "tcl": false,
};

var factoryDelimitersFromLanguage = {
    "perl": ["{", "}"],
    "php": ["/", "/"]
};
var delimitersFromLanguage = null;

var gSampleRegex = { // map <language> to sample regex
    "python": "(?P<file>.+?):(?P<line>\\d+):(?P<code>.*)",
    "perl": "(.+?):(\\d+):(.*)",
    "javascript": "(.+?):(\\d+):(.*)",
    "php": "(.+?):(\\d+):(.*)",
    "ruby": "(.+?):(\\d+):(.*)",
    "tcl": "(.+?):(\\d+):(.*)",
    "*": "(.+?):(\\d+):(.*)"
}
var gSampleReplacement = { // map <language> to sample replacement pattern
    "javascript": 'file:$1, line:$2, code:"$3"',
    "python": 'file:\\g<file>, line:\\2, code:"\\g<code>"',
    "perl": 'file:$1, line:$2, code:"$3"',
    "php": 'file:\\1, line:\\2, code:"\\3"',
    "ruby": 'file:\\1, line:\\2, code:"\\3"',
    "tcl": 'file:\\1, line:\\2, code:"\\3"',
    "*": 'file:\\1, line:\\2, code:"\\3"'
}
var gGroupNumberDelimiter = {
    "javascript": '$',
    "python": '\\',
    "perl": '$',
    "php": '\\',
    "ruby": '\\',
    "tcl": '\\',
};
var gSampleSearchText = {  // map <language> to sample search text
    "*": "foo.pl:25:use strict;\n" +
         "bar.pm:42:sub bar { # womba womba womba\n" +
         "spam.py:234:seuss = ['green', 'eggs', 'ham']\n"
}

var gModeToName = {
    "match": "Match",
    "match-all": "Match All",
    "split": "Split",
    "replace": "Replace",
    "replace-all": "Replace All"
}

var gRegexShortcuts = [
    {"shortcut": ".", "desc": "any character except a newline"},
    {"shortcut": "\\d", "desc": "any decimal digit",
     "tooltip": "equivalent to [0-9]"},
    {"shortcut": "\\D", "desc": "any non-digit",
     "tooltip": "equivalent to [^0-9]"},
    {"shortcut": "\\s", "desc": "any whitespace character",
     "tooltip": "equivalent to [ \\t\\n\\r\\f\\v]"},
    {"shortcut": "\\S", "desc": "any non-whitespace character",
     "tooltip": "equivalent to [^ \\t\\n\\r\\f\\v]"},
    {"shortcut": "\\w", "desc": "any alphanumeric character"},
    {"shortcut": "\\W", "desc": "any non-alphanumeric character"},
    {"shortcut": "\\number",
     "desc": "the contents of the group of the given number"},
    {"shortcut": "(?P=name)", "inserter": "(?P=<<name>>)",
     include: ["python"],
     "desc": "the contents of the group of the given name"},
    {"separator": null},
    {"shortcut": "*", "desc": "zero or more of the preceding block"},
    {"shortcut": "*?", "desc": "zero or more of the preceding block (non-greedy)"},
    {"shortcut": "+", "desc": "one or more of the preceding block"},
    {"shortcut": "+?", "desc": "one or more of the preceding block (non-greedy)"},
    {"shortcut": "?", "desc": "zero or one of the preceding block"},
    {"shortcut": "??", "desc": "zero or one of the preceding block (non-greedy)"},
    {"shortcut": "{m}", "inserter": "{<<m>>}",
     "desc": "exactly 'm' copies of the preceding block"},
    {"shortcut": "{m,n}", "desc": "'m' to 'n' copies of the preceding block"},
    {"shortcut": "{m,n}?", "desc": "'m' to 'n' copies of the preceding block (non-greedy)"},
    {"separator": null},
    {"shortcut": "^", "desc": "beginning of line"},
    {"shortcut": "$", "desc": "end of line"},
    {"shortcut": "\\b", "desc": "the beginning or end of a word",
     exclude:["tcl"]},
    {"shortcut": "\\B", "desc": "anything BUT the beginning or end of a word",
     exclude:["tcl"]},
    {"shortcut": "\\b", "desc": "match a backspace character (\\u0008)",
     include:["tcl"]},
    {"shortcut": "\\B", "desc": "match a backslash character (\\)",
     include:["tcl"]},
    {"shortcut": "\\A", "desc": "beginning of the string"},
    {"shortcut": "\\Z", "desc": "end of the string"},
    {"separator": null},
    {"shortcut": "(...)", "desc": "group"},
    {"shortcut": "(?P<name>...)",
     include: ["python", "perl"],
     "desc": "named group"},
    {"shortcut": "(?:...)", "desc": "non-grouping group",
     "tooltip": "the result of the match is NOT assigned a group number"},
    {"shortcut": "(?#...)", "desc": "a comment, the contents are ignored"},
    {"shortcut": "(?=...)",
     "desc": "matches if <...> matches next, but does not consume the string"},
    {"shortcut": "(?!...)",
     "desc": "matches if <...> does NOT match next, but does not consume the string"},
    {"shortcut": "(?<=...)", "desc": "positive lookbehind assertion",
     "tooltip": "matches if the current position is immediately "+
     "preceded by a match for <...>",
     exclude:['ruby', 'tcl']
    },
    {"shortcut": "(?<!...)", "desc": "negative lookbehind assertion",
     "tooltip": "matches if the current position is NOT immediately "+
     "preceded by a match for <...>",
     exclude:['ruby', 'tcl']
    },
    {"shortcut": "(?>...)", "desc": "non-backtracing subpattern",
     "tooltip": "no backtracking occurs on the matched part if a subsequent part fails to match",
     include:['ruby', 'perl', 'php']
    },
];


//---- the Rxx results manager
function RxxResults_Manager()
{
    this.matchResultsView = Components.classes["@activestate.com/koRxxMatchResultsTreeView;1"]
                              .createInstance();
    gWidgets.matchResultsTree.treeBoxObject.view = this.matchResultsView;
    this.splitResultsView = Components.classes["@activestate.com/koRxxSplitResultsTreeView;1"]
                              .createInstance();
    gWidgets.splitResultsTree.treeBoxObject.view = this.splitResultsView;
}

RxxResults_Manager.prototype.constructor = RxxResults_Manager;

RxxResults_Manager.prototype.QueryInterface = function (iid) {
    if (!iid.equals(Components.interfaces.koIRxxResultsManager) &&
        !iid.equals(Components.interfaces.nsISupports)) {
        throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    return this;
}

RxxResults_Manager.prototype.matchSuccess = function(numResults)
{
    log.debug("RxxResults_Manager.matchSuccess(numResults='"+numResults+"')");
    try {
        gWidgets.resultsArea.setAttribute("rxx_status", "successful");
        var label = "";
        if (gMode == "split") {
            label = "Split Results";
        } else if (gMode.slice(0, 5) == "match") {
            label = "Match Results";
        } else {
            label = "Replace Results";
        }
        if (gMode == "match") {
            label += " (match found)";
        } else {
            if (numResults == 1) {
                label += " (1 match found)";
            } else {
                label += " ("+numResults+" matches found)";
            }
        }
        gWidgets.resultsLabel.setAttribute("label", label);
        if (gMode == "split") {
            gWidgets.resultsDeck.selectedIndex = 2;
        } else {
            gWidgets.resultsDeck.selectedIndex = 1;
            if (gMode.slice(0, 5) == "match") {
                gWidgets.resultsReplacementColumn.setAttribute("collapsed", "true");
            } else {
                if (gWidgets.resultsReplacementColumn.hasAttribute("collapsed"))
                    gWidgets.resultsReplacementColumn.removeAttribute("collapsed");
            }
        }
    } catch(ex) {
        log.exception(ex);
    }
}

RxxResults_Manager.prototype.setResultsMessage = function(message, status)
{
    if (typeof(status) == "undefined") status = "";
    gWidgets.resultsLabel.setAttribute("label",
                                       gModeToName[gMode]+" Results");
    gWidgets.resultsArea.setAttribute("rxx_status", status);
    gWidgets.resultsDeck.selectedIndex = 0;
    gWidgets.resultsMessage.textContent = message;
}

RxxResults_Manager.prototype.matchFailure = function(message)
{
    log.debug("RxxResults_Manager.matchFailure(message='"+message+"')");
    var msg = "Your regular expression does not match the search text";
    if (message) {
        msg += ": "+message;
    } else {
        msg += ".";
    }
    this.setResultsMessage(msg);
}

RxxResults_Manager.prototype._showInProgressButtons = function(msg) {
    gWidgets.patternMatcherThrobber.removeAttribute("collapsed");
    gWidgets.patternMatcherThrobber.removeAttribute("hidden");
    gWidgets.stopButton.disabled = false;
    if (msg) {
        this.setResultsMessage(msg, "running");
    }
}

RxxResults_Manager.prototype._hideInProgressButtons = function() {
    gWidgets.stopButton.disabled = true;
    gWidgets.patternMatcherThrobber.setAttribute("collapsed", "true");
    gWidgets.patternMatcherThrobber.setAttribute("hidden", "true");
}

RxxResults_Manager.prototype.updateInProgressUI = function(matchingStatus) {
    function _clearViewFields() {
        gInProgressOnTimer = 0;
        var fields = [gWidgets.searchTextView];
        // if (gWidgets.regexView.scimoz.text.indexOf("replace") == 0) {
        if (gMode.indexOf('replace') == 0) {
            fields.push(gWidgets.replacedTextView);
            scimoz = gWidgets.replacedTextView.scimoz;
            scimoz.readOnly = 0;
            scimoz.clearAll();
            scimoz.readOnly = 1;
        }
        for (var field, i = 0; field = fields[i]; ++i) {
            var scimoz = field.scimoz;
            scimoz.startStyling(0, 0x1f);
            scimoz.setStyling(scimoz.textLength, 0);
            scimoz.tabWidth = scimoz.tabWidth; // this forces a repaint.
        }
    }
    if (gInProgressOnTimer) {
        clearTimeout(gInProgressOnTimer);
    }
    gProgressStatus = matchingStatus;
    if (matchingStatus == MATCHING_IN_PATTERN_MATCH) {
        gInProgressOnTimer = setTimeout(function(this_) {
            _clearViewFields();
            this_._showInProgressButtons("Pattern-match in progress....");
        }, gInProgressOnTimerDelayTime, this);
    } else if (matchingStatus == MATCHING_UPDATING_RESULTS) {
        gInProgressOnTimer = setTimeout(function(this_) {
                this_._showInProgressButtons(null);
        }, gInProgressOnTimerDelayTime, this);
    } else if (matchingStatus == MATCHING_DONE) {
        this._hideInProgressButtons();
        if (gStyleUpdateTimerId) {
            clearTimeout(gStyleUpdateTimerId);
        }
    } else if (matchingStatus == MATCHING_DONE_ON_ERROR) {
        this._hideInProgressButtons();
        _clearViewFields();
    }
}

RxxResults_Manager.prototype.matchError = function(message)
{
    log.debug("RxxResults_Manager.matchError(message='"+message+"')");
    try {
        gWidgets.resultsArea.setAttribute("rxx_status", "failure");
        gWidgets.resultsLabel.setAttribute("label",
                                           gModeToName[gMode]+" Results");
        gWidgets.resultsDeck.selectedIndex = 0;
        var msg;
        msg = "There is an error in your regular expression";
        if (message) {
            msg += ": "+message;
        } else {
            msg += ".";
        }
        gWidgets.resultsMessage.textContent = msg;
        RxxRegex_Restyle();
    } catch(ex) {
        log.exception(ex);
    }
}

RxxResults_Manager.prototype.replaceError = function(message)
{
    log.debug("RxxResults_Manager.replaceError(message='"+message+"')");
    try {
        gWidgets.resultsArea.setAttribute("rxx_status", "failure");
        gWidgets.resultsLabel.setAttribute("label",
                                           gModeToName[gMode]+" Results");
        gWidgets.resultsDeck.selectedIndex = 0;
        var msg = "There is an error in your replacement template";
        if (message) {
            msg += ": "+message;
        } else {
            msg += ".";
        }
        gWidgets.resultsMessage.textContent = msg;
    } catch(ex) {
        log.exception(ex);
    }
}

RxxResults_Manager.prototype.lexError = function(message)
{
    log.debug("RxxResults_Manager.lexError(message='"+message+"')");
    try {
        if (gWidgets.resultsLexErrorMessage.hasAttribute("collapsed"))
            gWidgets.resultsLexErrorMessage.removeAttribute("collapsed");
        // gWidgets.resultsLexErrorMessage.setAttribute("value", "("+message+")");
        gWidgets.resultsLexErrorMessage.textContent = "("+message+")";
    } catch(ex) {
        log.exception(ex);
    }
}

RxxResults_Manager.prototype.lexSuccess = function()
{
    log.debug("RxxResults_Manager.lexSuccess()");
    try {
        gWidgets.resultsLexErrorMessage.setAttribute("collapsed", "true");
        // gWidgets.resultsLexErrorMessage.setAttribute("value", "");
        gWidgets.resultsLexErrorMessage.textContent = "";
    } catch(ex) {
        log.exception(ex);
    }
}

function RxxSearchColorizer(scimoz, groupObjs, highlightStyleNum, nextFunc) {
    if (typeof(nextFunc) == "undefined") nextFunc = null;
    this.scimoz = scimoz;
    if (typeof(groupObjs) == "undefined") {
        groupObjs = [];
    }
    this.groupObjs = groupObjs;
    this.lim = groupObjs ? groupObjs.length : 0;
    this.lastCharPos = 0;
    this.lastBytePos = 0;
    this.highlightStyleNum = highlightStyleNum;
    
    this.nextFunc = nextFunc;
        
    this.scimoz.startStyling(0, 0x1f);
    this.scimoz.setStyling(scimoz.textLength, 0)
}

RxxSearchColorizer.prototype.update = function(i) {
    gStyleUpdateTimerId = 0;
    if (i >= this.lim) {
        this.scimoz.tabWidth = this.scimoz.tabWidth; // Force a repaint.
        if (this.nextFunc) {
            // We're done with the current 'this' object.
            setTimeout(this.nextFunc, 0);
        } else {
            gResultsManager.updateInProgressUI(MATCHING_DONE);
        }
        return;
    } else if (gProgressStatus == MATCHING_DONE) {
        return;
    }
    var lim = i + STYLING_ITERS_PER_SLICE;
    if (lim > this.lim) lim = this.lim;
    for (; i < lim; ++i) {
        var groupObj = this.groupObjs[i];
        var startCharPos, endCharPos, start, end;
        [startCharPos, endCharPos] = groupObj[0]['span'];
        if (byteResultsFromLanguage[gLanguage]) {
            start = startCharPos;
            end = endCharPos;
        } else {
            start = this.scimoz.positionAtChar(this.lastBytePos, startCharPos - this.lastCharPos);
            end = this.scimoz.positionAtChar(start, endCharPos - startCharPos);
            this.lastCharPos = endCharPos;
            this.lastBytePos = end;
        }
        if (start != end) { // perf: don't bother styling zero length match
            this.scimoz.startStyling(start, 0x1f); // styling with std 5 bits
            this.scimoz.setStyling(end - start, this.highlightStyleNum);
        }
    }
    setTimeout(function(this_) {
        gStyleUpdateTimerId = this_.update(i + 1);
        }, STYLING_DELAY_TIME, this);
}

RxxResults_Manager.prototype.styleSearchText = function(responseString, scimoz, highlightStyleNum) {
    var patternMatchResults = JSON.parse(responseString);
    var updater = new RxxSearchColorizer(scimoz,
                                         patternMatchResults['result'],
                                         highlightStyleNum);
    updater.update(0);
};

function RxxReplaceColorizer(scimoz, responsePacket, highlightStyleNum) {
    this.scimoz = scimoz;
    this.groupObjs = responsePacket['result'] || [];
    this.lim = this.groupObjs.length;
    this.lastCharPos = 0;
    this.lastBytePos = 0;
    this.highlightStyleNum = highlightStyleNum;
    
    this.substitutions = responsePacket['substitutions'] || [];
    this.offset = 0;
        
    scimoz.startStyling(0, 0x1f);
    scimoz.setStyling(scimoz.textLength, 0)
}

RxxReplaceColorizer.prototype.update = function(i) {
    gStyleUpdateTimerId = 0;
    if (gProgressStatus == MATCHING_DONE) {
        return;
    } else if (i >= this.lim) {
        this.scimoz.tabWidth = this.scimoz.tabWidth; // Force a repaint.
        gResultsManager.updateInProgressUI(MATCHING_DONE);
        return;
    }
    var lim = i + STYLING_ITERS_PER_SLICE;
    if (lim > this.lim) lim = this.lim;
    if (lim > this.substitutions.length) {
        if (this.substitutions.length != 0) {
            log.error("lim: (based on groupObj's)"
                 + lim
                 + ", but this.substitutions.length:"
                 + this.substitutions.length
                 + "\n");
        }
        // Otherwise the back-end doesn't do substitutions.
        lim = this.substitutions.length;
    }
    for (; i < lim; ++i) {
        var groupObj = this.groupObjs[i];
        var substitution = this.substitutions[i];
        var startCharPos, endCharPos, start, end;
        [startCharPos, endCharPos] = groupObj[0]['span'];
        var lenMatch = endCharPos - startCharPos;
        startCharPos += this.offset;
        this.offset += substitution.length - lenMatch;
        endCharPos += this.offset;
        if (false && byteResultsFromLanguage[gLanguage]) {
            start = startCharPos;
            end = endCharPos;
        } else {
            start = this.scimoz.positionAtChar(this.lastBytePos, startCharPos - this.lastCharPos);
            end = this.scimoz.positionAtChar(start, endCharPos - startCharPos);
            this.lastCharPos = endCharPos;
            this.lastBytePos = end;
        }
    
        if (start != end) { // perf: don't bother styling zero length match
            this.scimoz.startStyling(start, 0x1f); // styling with std 5 bits
            this.scimoz.setStyling(end - start, this.highlightStyleNum);
        }
    }
    setTimeout(function(this_) {
        gStyleUpdateTimerId = this_.update(i + 1);
    }, STYLING_DELAY_TIME, this);
}

RxxResults_Manager.prototype.styleSearchText =
        function(responseString, scimoz, highlightStyleNum) {
    var patternMatchResults = JSON.parse(responseString);
    var updater = new RxxSearchColorizer(scimoz,
                                         patternMatchResults['result'],
                                         highlightStyleNum, null);
    updater.update(0);
};

RxxResults_Manager.prototype.styleSearchAndReplacedText =
        function(responseString, searchScimoz, replaceScimoz, highlightStyleNum) {
    var patternMatchResults = JSON.parse(responseString);
    var updater;
    var doReplaceFunc = function() {
        updater = new RxxReplaceColorizer(replaceScimoz,
                                         patternMatchResults,
                                         highlightStyleNum);
        updater.update(0);
    };
    updater = new RxxSearchColorizer(searchScimoz,
                                     patternMatchResults['result'],
                                     highlightStyleNum, doReplaceFunc);
    updater.update(0);
    
};


function scheduleDelayedUpdate() {
    if (gOnModifiedHandlerTimeoutId) {
        clearTimeout(gOnModifiedHandlerTimeoutId);
    }
    gOnModifiedHandlerTimeoutId = window.setTimeout(function() {
        gOnModifiedHandlerTimeoutId = 0;
        RxxResults_Update();
    }, gOnModifiedHandlerTimer);
}


//---- the scintilla/SciMoz eventists (aka event handlers)

function RxxRegex_SciMozEventist() {}
RxxRegex_SciMozEventist.prototype = {
    onStyleNeeded: function(position) { return false; },
    onCharAdded: function(ch) { return false; },
    onSavePointReached: function() { return false; },
    onSavePointLeft: function() { return false; },
    onModifyAttemptRO: function() { return false; },
    onKey: function(ch, modifiers) { return false; },
    onDoubleClick: function() { return false; },
    onUpdateUI: function() { return false; },
    onModified: function(position, modificationType, text, length, linesAdded,
                         line, foldLevelNow, foldLevelPrev)
    {
        try {
            if (modificationType & (SC_MOD_INSERTTEXT | SC_MOD_DELETETEXT)) {
                // Have to call in a timeout to avoid recusively calling
                // into scintilla (in which case the recursive calls are
                // silently ignored and no styling happens.)
                window.setTimeout(RxxRegex_Restyle, 0);
                scheduleDelayedUpdate();
                gNeedToRebuildReplacementShortcuts = true;
                return true;
            }
        } catch(ex) {
            log.exception(ex);
        }
        return false;
    },
    onMacroRecord: function(message, wParam, lparam) {  return false; },
    onMarginClick: function(modifiers, position, margin) { return false; },
    onNeedShown: function(position, length) { return false; },
    onDwellStart: function(position, x, y) {},
    onDwellEnd: function(position, x, y) {},
    onCommandUpdate: function(commandset) { window.updateCommands(commandset); },
    // nsISupports interface
    QueryInterface: function(iid) {
        if (!iid.equals(Components.interfaces.nsISupports) &&
            !iid.equals(Components.interfaces.ISciMozEvents))
        throw Components.results.NS_ERROR_NO_INTERFACE;
        return this;
    }
}

function RxxReplacement_SciMozEventist() {}
RxxReplacement_SciMozEventist.prototype = {
    onStyleNeeded: function(position) { return false; },
    onCharAdded: function(ch) { return false; },
    onSavePointReached: function() { return false; },
    onSavePointLeft: function() { return false; },
    onModifyAttemptRO: function() { return false; },
    onKey: function(ch, modifiers) { return false; },
    onDoubleClick: function() { return false; },
    onUpdateUI: function() { return false; },
    onModified: function(position, modificationType, text, length, linesAdded,
                         line, foldLevelNow, foldLevelPrev)
    {
        try {
            if (modificationType & (SC_MOD_INSERTTEXT | SC_MOD_DELETETEXT)) {
                // Have to call in a timeout to avoid recusively calling
                // into scintilla (in which case the recursive calls are
                // silently ignored and no styling happens.)

                window.setTimeout(RxxReplacement_Restyle, 0);
                scheduleDelayedUpdate();
                return true;
            }
        } catch(ex) {
            log.exception(ex);
        }
        return false;
    },
    onMacroRecord: function(message, wParam, lparam) {  return false; },
    onMarginClick: function(modifiers, position, margin) { return false; },
    onNeedShown: function(position, length) { return false; },
    // nsISupports interface
    onDwellStart: function(position, x, y) {},
    onDwellEnd: function(position, x, y) {},
    onCommandUpdate: function(commandset) { window.updateCommands(commandset); },
    QueryInterface: function(iid) {
        if (!iid.equals(Components.interfaces.nsISupports) &&
            !iid.equals(Components.interfaces.ISciMozEvents))
        throw Components.results.NS_ERROR_NO_INTERFACE;
        return this;
    }
}

function RxxSearchText_SciMozEventist() {}
RxxSearchText_SciMozEventist.prototype = {
    onStyleNeeded: function(position) { return false; },
    onCharAdded: function(ch) { return false; },
    onSavePointReached: function() { return false; },
    onSavePointLeft: function() { return false; },
    onModifyAttemptRO: function() { return false; },
    onKey: function(ch, modifiers) { return false; },
    onDoubleClick: function() { return false; },
    onUpdateUI: function() { return false; },
    onModified: function(position, modificationType, text, length, linesAdded,
                         line, foldLevelNow, foldLevelPrev)
    {
        try {
            if (modificationType & (SC_MOD_INSERTTEXT | SC_MOD_DELETETEXT)) {
                // Have to call in a timeout to avoid recusively calling
                // into scintilla (in which case the recursive calls are
                // silently ignored and no styling happens.)
                scheduleDelayedUpdate();
                return true;
            }
        } catch(ex) {
            log.exception(ex);
        }
        return false;
    },
    onMacroRecord: function(message, wParam, lparam) {  return false; },
    onMarginClick: function(modifiers, position, margin) { return false; },
    onNeedShown: function(position, length) { return false; },
    // nsISupports interface
    onDwellStart: function(position, x, y) {},
    onDwellEnd: function(position, x, y) {},
    onCommandUpdate: function(commandset) { window.updateCommands(commandset); },
    QueryInterface: function(iid) {
        if (!iid.equals(Components.interfaces.nsISupports) &&
            !iid.equals(Components.interfaces.ISciMozEvents))
        throw Components.results.NS_ERROR_NO_INTERFACE;
        return this;
    }
}

//---- interface routines for XUL

function OnLoad()
{
    log.debug("OnLoad()");
    try {
        gMainWindow = ko.windowManager.getMainWindow();
        scintillaOverlayOnLoad();

        gPrefs = Components.classes["@activestate.com/koPrefService;1"].
                 getService(Components.interfaces.koIPrefService).prefs;

        gWidgets = new Object();
        gWidgets.window = document.getElementById("komodo_rxx");
        gWidgets.buttonBox = document.getElementById("button-box");
        gWidgets.contentBox = document.getElementById("content-box");
        gWidgets.inputGrid = document.getElementById("input-grid");
        //XXX No mode explanation while we only support one language.
        //gWidgets.modeExplanation = document.getElementById("mode-explanation");
        gWidgets.modeButtons = {
            "match": document.getElementById("match-mode-button"),
            "match-all": document.getElementById("match-all-mode-button"),
            "split": document.getElementById("split-mode-button"),
            "replace": document.getElementById("replace-mode-button"),
            "replace-all": document.getElementById("replace-all-mode-button")
        };
        gWidgets.searchColumn = document.getElementById("search-column");
        gWidgets.columnSplitterPattern = document.getElementById("column-splitter-pattern");
        gWidgets.columnSplitterText = document.getElementById("column-splitter-text");
        gWidgets.replaceColumn = document.getElementById("replace-column");
        gWidgets.patternRow = document.getElementById("pattern-row");
        gWidgets.rowSplitter = document.getElementById("row-splitter");
        gWidgets.textRow = document.getElementById("text-row");
        gWidgets.regexView = document.getElementById("regex-view");
        gWidgets.replacementView = document.getElementById("replacement-view");
        gWidgets.searchTextView = document.getElementById("search-text-view");
        gWidgets.replacedTextView = document.getElementById("replaced-text-view");
        gWidgets.regexArea = document.getElementById("regex-area");
        gWidgets.replacementArea = document.getElementById("replacement-area");
        gWidgets.searchTextArea = document.getElementById("search-text-area");
        gWidgets.replacedTextArea = document.getElementById("replaced-text-area");
        gWidgets.resultsTitlebar = document.getElementById("results-titlebar");
        gWidgets.resultsArea = document.getElementById("results-area");
        gWidgets.resultsLabel = document.getElementById("results-label");
        gWidgets.resultsDeck = document.getElementById("results-deck");
        gWidgets.resultsMessage = document.getElementById("results-message");
        gWidgets.resultsReplacementColumn = document.getElementById("match-results-tree-replacement");
        gWidgets.resultsLexErrorMessage = document.getElementById("results-lex-error-message");
        gWidgets.matchResultsTree = document.getElementById("match-results-tree");
        gWidgets.splitResultsTree = document.getElementById("split-results-tree");
        gWidgets.regexOptionICheckbox = document.getElementById("regex-option-i-checkbox");
        gWidgets.regexOptionMCheckbox = document.getElementById("regex-option-m-checkbox");
        gWidgets.regexOptionSCheckbox = document.getElementById("regex-option-s-checkbox");
        gWidgets.regexOptionXCheckbox = document.getElementById("regex-option-x-checkbox");
        gWidgets.regexOptionUCheckbox = document.getElementById("regex-option-u-checkbox");
        gWidgets.regexOptionLCheckbox = document.getElementById("regex-option-l-checkbox");
        gWidgets.stopButton = document.getElementById("rxx-stop-button");
        gWidgets.patternMatcherThrobber = document.getElementById("rxx-eval-in-progress-image");

        gWidgets.regexView.initWithBuffer("", "Regex");
        var scimoz = gWidgets.regexView.scimoz;
        scimoz.viewWS = 1;
        scimoz.visible = 1;
        scimoz.caretLineVisible = 0;
        scimoz.eOLMode = PREFERRED_EOL_MODE;
        gRegexEventist = new RxxRegex_SciMozEventist();
        scimoz.hookEvents(gRegexEventist);
        scimoz.lexer = scimoz.SCLEX_CONTAINER;
        // Use the first indicator to mark regex syntax errors.
        scimoz.indicSetStyle(0, scimoz.INDIC_SQUIGGLE);
        scimoz.indicSetFore(0, 0x0000ff);
        scimoz.setMarginWidthN(scimoz.MARGIN_SYMBOLS, 0);

        gWidgets.replacementView.initWithBuffer("", "Regex");
        scimoz = gWidgets.replacementView.scimoz;
        scimoz.viewWS = 1;
        scimoz.visible = 1;
        scimoz.caretLineVisible = 0; // gets in the way of highlighted results
        scimoz.eOLMode = PREFERRED_EOL_MODE;
        gReplacementEventist = new RxxReplacement_SciMozEventist();
        scimoz.hookEvents(gReplacementEventist);
        scimoz.lexer = scimoz.SCLEX_CONTAINER;
        // Use the first indicator to mark replacement syntax errors.
        scimoz.indicSetStyle(0, scimoz.INDIC_SQUIGGLE);
        scimoz.indicSetFore(0, 0x0000ff);
        scimoz.setMarginWidthN(scimoz.MARGIN_SYMBOLS, 0);

        gWidgets.searchTextView.initWithBuffer("", "Regex");
        scimoz = gWidgets.searchTextView.scimoz;
        scimoz.viewWS = 1;
        scimoz.visible = 1;
        scimoz.caretLineVisible = 0; // gets in the way of highlighted results
        scimoz.eOLMode = PREFERRED_EOL_MODE;
        gSearchTextEventist = new RxxSearchText_SciMozEventist();
        scimoz.hookEvents(gSearchTextEventist);
        scimoz.lexer = scimoz.SCLEX_CONTAINER;
        scimoz.setMarginWidthN(scimoz.MARGIN_SYMBOLS, 0);

        gWidgets.replacedTextView.initWithBuffer("", "Regex");
        scimoz = gWidgets.replacedTextView.scimoz;
        scimoz.readOnly = 1;
        scimoz.viewWS = 1;
        scimoz.visible = 1;
        scimoz.caretLineVisible = 0;
        scimoz.eOLMode = PREFERRED_EOL_MODE;
        // Don't care about events in this scimoz, so don't bother with
        // an eventist.
        //gReplacedTextEventist = new RxxReplacedText_SciMozEventist();
        // XXX: Todd: What about onCommandUpdate? Do we need that?
        //scimoz.hookEvents(gReplacedTextEventist);
        scimoz.lexer = scimoz.SCLEX_CONTAINER;
        scimoz.setMarginWidthN(scimoz.MARGIN_SYMBOLS, 0);

        // Setup the match results pane.
        gResultsManager = new RxxResults_Manager();

        // .language
        var language = null;
        if (typeof(window.arguments[0].language) == "undefined"
            || window.arguments[0].language == null) {
            language = gPrefs.getStringPref("rxx_language");
        } else {
            language = window.arguments[0].language;
        }

        gWidgets.regexDelimitersButton = document.getElementById("regex_delimiters_launch");
        if (gPrefs.hasPrefHere("rxx_delimiters")) {
            try {
                delimitersFromLanguage = JSON.parse(gPrefs.getStringPref("rxx_delimiters"));
            } catch(ex) {
                log.error("Failed to json-load rxx_delimiters pref");
            }
        }
        if (delimitersFromLanguage == null) {
            delimitersFromLanguage = {};
            // Make a deep copy of the factory set.
            for (var p in factoryDelimitersFromLanguage) {
                delimitersFromLanguage[p] = [].concat(factoryDelimitersFromLanguage[p]);
            }
        }
        // .<some attribute(s) for regex options>
        //XXX Do we need window input arguments for the regex options?
        gRegexOptions = Components.classes["@activestate.com/koRxxRegexOptions;1"]
                        .createInstance(Components.interfaces.koIRxxRegexOptions);
        gBackEndResultsManager = Components.classes["@activestate.com/koRxxResponseHandler;1"]
                        .createInstance(Components.interfaces.koIRxxResponseHandler);
        gBackEndResultsManager.initialize(gResultsManager,
                                          gWidgets.searchTextView.scimoz,
                                          gWidgets.replacedTextView.scimoz);
        Rxx_ChangeLanguage(language, true);
        gRegexOptions.restoreFromPrefs();
        gWidgets.regexOptionICheckbox.checked = gRegexOptions.i;
        gWidgets.regexOptionMCheckbox.checked = gRegexOptions.m;
        gWidgets.regexOptionSCheckbox.checked = gRegexOptions.s;
        gWidgets.regexOptionXCheckbox.checked = gRegexOptions.x;
        gWidgets.regexOptionUCheckbox.checked = gRegexOptions.u;
        gWidgets.regexOptionLCheckbox.checked = gRegexOptions.l;

        // .matchCase
        if (typeof(window.arguments[0].matchCase) != "undefined"
            && window.arguments[0].matchCase != null) {
            gWidgets.regexOptionICheckbox.checked
                = ! window.arguments[0].matchCase;
            RxxRegex_UpdateOption('i');
        }
        
        // .flagMultiline
        if (typeof(window.arguments[0].flagMultiline) != "undefined"
            && window.arguments[0].flagMultiline != null) {
            gWidgets.regexOptionMCheckbox.checked
                = window.arguments[0].flagMultiline;
            RxxRegex_UpdateOption('m');
        }

        // .mode
        var mode = null;
        if (typeof(window.arguments[0].mode) == "undefined"
            || window.arguments[0].mode == null) {
            mode = gPrefs.getStringPref("rxx_mode");
        } else {
            mode = window.arguments[0].mode;
        }
        if (!mode) mode = "match-all";
        Rxx_SetMode(mode, true);
        gWidgets.modeButtons[gMode].setAttribute("checked", "true");

        // .regex
        var regex = null;
        var currSelection = _Rxx_GetEditorSelection();
        var currSelectionIsMultiline = (currSelection.indexOf('\n') != -1);
        if (typeof(window.arguments[0].regex) == "undefined"
            || window.arguments[0].regex == null)
        {
            // Use the current selection, if there is one, for the regex.
            //XXX Longer run should attempt to parse out a "regex under
            //    cursor if the style looks right.
            if (currSelection && !currSelectionIsMultiline) {
                regex = currSelection;
            } else if (gPrefs.hasStringPref("rxx_regex")) {
                regex = gPrefs.getStringPref("rxx_regex");
            } else if (typeof(gSampleRegex[gLanguage]) != "undefined") {
                regex = gSampleRegex[gLanguage];
            } else {
                regex = gSampleRegex["*"];
            }
        } else {
            regex = window.arguments[0].regex;
        }
        gWidgets.regexView.setBufferText(regex);
        gWidgets.regexView.scimoz.convertEOLs(PREFERRED_EOL_MODE);
        // Do NOT select the regex on start up because (1) when clicking
        // around in the UI the selection of the regex string is just a
        // little bit more confusion and (2) on Linux, clicking in the
        // selection area gets HALF way to getting full cursor focus to that
        // scintilla. Without a selection, clicking in works better.
        gWidgets.regexView.scimoz.anchor = regex.length;
        gWidgets.regexView.scimoz.currentPos = regex.length;

        // .replacement
        var replacement = null;
        if (typeof(window.arguments[0].replacement) == "undefined"
            || window.arguments[0].replacement == null)
        {
            if (gPrefs.hasStringPref("rxx_replacement")) {
                replacement = gPrefs.getStringPref("rxx_replacement");
            } else if (typeof(gSampleReplacement[gLanguage]) != "undefined") {
                replacement = gSampleReplacement[gLanguage];
            } else {
                replacement = gSampleReplacement["*"];
            }
        } else {
            replacement = window.arguments[0].replacement;
        }
        gWidgets.replacementView.setBufferText(replacement);
        gWidgets.replacementView.scimoz.convertEOLs(PREFERRED_EOL_MODE);
        //gWidgets.replacementView.scimoz.anchor = 0;
        //gWidgets.replacementView.scimoz.currentPos = replacement.length;

        // .searchText
        var searchText = null;
        if (typeof(window.arguments[0].searchText) == "undefined"
            || window.arguments[0].searchText == null)
        {
            if (currSelection && currSelectionIsMultiline) {
                searchText = currSelection;
            } else if (gPrefs.hasStringPref("rxx_search_text")) {
                searchText = gPrefs.getStringPref("rxx_search_text");
            } else if (typeof(gSampleSearchText[gLanguage]) != "undefined") {
                searchText = gSampleSearchText[gLanguage];
            } else {
                searchText = gSampleSearchText["*"];
            }
        } else {
            searchText = window.arguments[0].searchText;
        }
        gWidgets.searchTextView.setBufferText(searchText);
        gWidgets.searchTextView.scimoz.convertEOLs(PREFERRED_EOL_MODE);

        RxxResults_Update();

        // Restore the window dimensions.
        var height, width;
        height = gPrefs.getLong("rxx_pattern_row_height", 0);
        if (height) {
            gWidgets.patternRow.setAttribute("height", height);
        }
        height = gPrefs.getLong("rxx_text_row_height", 0);
        if (height) {
            gWidgets.textRow.setAttribute("height", height);
        }
        /* Since the switch to moz1.9 and the different placement of the
         * vertical splitters for the grid, restoring the column widths
         * *locks* them such that the vertical splitter can't be used.
         * So, we'll disable restoring this dimension for the time being.
         * See bug 80060 for details.
         *
            width = gPrefs.getLong("rxx_search_column_width", 0);
            if (width) {
                gWidgets.searchColumn.setAttribute("width", width);
            }
            width = gPrefs.getLong("rxx_replace_column_width", 0);
            if (width) {
                gWidgets.replaceColumn.setAttribute("width", width);
            }
        */
        height = gPrefs.getLong("rxx_match_results_area_height", 0);
        if (height) {
            gWidgets.resultsArea.setAttribute("height", height);
        }
        setupSupportedLanguagesMenu();

        // Focus the regex view.
        //XXX If I do not put this in a timeout the window gets drawn at
        //    0,0 and then is quickly moved to the persisted position. The
        //    flashing from this is very annoying.
        window.setTimeout("gWidgets.regexView.setFocus();", 0);
        
        // On Mac OSX, ensure the Scintilla views are visible by forcing a repaint.
        // TODO: investigate why this happens and come up with a better solution.
        // NOTE: repainting Scintilla views by themselves is not sufficient;
        // Mozilla needs to repaint the entire window.
        if (navigator.platform.match(/^Mac/)) {
            window.setTimeout(function() {
                window.resizeBy(1, 0);
                window.resizeBy(-1, 0);
            }, 10);
        }
    } catch(ex) {
        log.exception(ex);
    }
}


function OnUnload()
{
    log.debug("OnUnload()");
    try {
        Rxx_Stop();
        gPrefs.setLongPref("rxx_pattern_row_height",
            gWidgets.patternRow.boxObject.height);
        gPrefs.setLongPref("rxx_text_row_height",
            gWidgets.textRow.boxObject.height);
        gPrefs.setLongPref("rxx_search_column_width",
            gWidgets.searchColumn.boxObject.width);
        gPrefs.setLongPref("rxx_replace_column_width",
            gWidgets.replaceColumn.boxObject.width);
        gPrefs.setLongPref("rxx_match_results_area_height",
            gWidgets.resultsArea.boxObject.height);
        gPrefs.setStringPref("rxx_mode", gMode);
        gPrefs.setStringPref("rxx_language", gLanguage);
        gPrefs.setStringPref("rxx_regex", gWidgets.regexView.scimoz.text);
        gPrefs.setStringPref("rxx_replacement", gWidgets.replacementView.scimoz.text);
        gPrefs.setStringPref("rxx_search_text", gWidgets.searchTextView.scimoz.text);
        gPrefs.setStringPref("rxx_delimiters",
                             JSON.stringify(delimitersFromLanguage));
        gRegexOptions.saveToPrefs();

        var retval = window.arguments[0];
        retval.language = gLanguage;
        retval.regex = gWidgets.regexView.scimoz.text;
        retval.replacement = gWidgets.replacementView.scimoz.text;
        retval.searchText = gWidgets.searchTextView.scimoz.text;
        retval.matchCase = ! gWidgets.regexOptionICheckbox.checked;

        gWidgets.regexView.scimoz.unhookEvents(gRegexEventist);
        gRegexEventist = null;
        gWidgets.replacementView.scimoz.unhookEvents(gReplacementEventist);
        gReplacementEventist = null;
        gWidgets.searchTextView.scimoz.unhookEvents(gSearchTextEventist);
        gSearchTextEventist = null;
        // The "close" method ensures the scintilla view is properly cleaned up.
        gWidgets.regexView.close();
        gWidgets.replacementView.close();
        gWidgets.searchTextView.close();
        gWidgets.replacedTextView.close();
        scintillaOverlayOnUnload();
        gBackEndResultsManager.shutdown();
    } catch(ex) {
        log.exception(ex);
    }
}


function Rxx_DumpDimensions() // for debugging
{
    try {
        dump("----------------- Rxx Window Dimensions ----------------\n");
        dump("window height: "+window.height+" (inner height:"+
             window.innerHeight+", outer height:"+window.outerHeight+")\n");
        dump("    buttonBox height:"+
             gWidgets.buttonBox.getAttribute("height")+
             " ("+gWidgets.buttonBox.boxObject.height+")\n");
        dump("    contentBox height:"+
             gWidgets.contentBox.getAttribute("height")+
             " ("+gWidgets.contentBox.boxObject.height+")\n");
        dump("        inputGrid height:"+
             gWidgets.inputGrid.getAttribute("height")+
             " ("+gWidgets.inputGrid.boxObject.height+")\n");
        dump("            patternRow height:"+
             gWidgets.patternRow.getAttribute("height")+
             " ("+gWidgets.patternRow.boxObject.height+")\n");
        dump("            textRow height:"+
             gWidgets.textRow.getAttribute("height")+
             " ("+gWidgets.textRow.boxObject.height+")\n");
        dump("        resultsArea height:"+
             gWidgets.resultsArea.getAttribute("height")+
             " ("+gWidgets.resultsArea.boxObject.height+")\n");
        dump("--------------------------------------------------------\n");
    } catch(ex) {
        log.exception(ex);
    }
}


function _Rxx_GetEditorSelection() {
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                       .getService(Components.interfaces.nsIWindowMediator);
    var w = wm.getMostRecentWindow("Komodo").require("ko/windows").getMain();
    if (w == opener) {
        var v = opener.ko.views.manager.currentView;
        if (v && v.scimoz) {
            return v.scimoz.selText;
        }
    }
    return "";
}


function _Rxx_UpdateModeExplanation(language, mode)
{
    var explanation = "";

    var langMode = gLanguage+"-"+mode;
    switch(langMode) {
    case "python-match":
        explanation = "re.search(...)";
        break;
    case "python-match-all":
        explanation = "re.findall(...)";
        break;
    case "python-split":
        explanation = "re.split(...)";
        break;
    case "python-replace":
        explanation = "re.sub(..., 1)";
        break;
    case "python-replace-all":
        explanation = "re.sub(...)";
        break;
    case "perl-match":
        explanation = "m/.../";
        break;
    case "perl-match-all":
        explanation = "m/.../g";
        break;
    case "perl-split":
        explanation = "split /.../";
        break;
    case "perl-replace":
        explanation = "s/.../";
        break;
    case "perl-replace-all":
        explanation = "s/.../g";
        break;
    case "php-match":
        explanation = "preg_match(string $pattern, string $subject,...)";
        break;
    case "php-match-all":
        explanation = "preg_match_all(string $pattern, string $subject,...)";
        break;
    case "php-split":
        explanation = "preg_split(string $pattern, string $subject, ...)";
        break;
    case "php-replace":
        explanation = "preg_replace(mixed $pattern, mixed $replacement, mixed $subject, limit=1, ...)";
        break;
    case "php-replace-all":
        explanation = "preg_replace(mixed $pattern, mixed $replacement, mixed $subject, ...)";
        break;
    case "ruby-match":
        explanation = "regexp.match(str) or str.match(regexp)";
        break;
    case "ruby-match-all":
        explanation = "str.scan(regexp)";
        break;
    case "ruby-split":
        explanation = "str.split(regexp)";
        break;
    case "ruby-replace":
        explanation = "str.sub(regexp, repl)";
        break;
    case "ruby-replace-all":
        explanation = "str.gsub(regexp, repl)";
        break;
    case "javascript-match":
        explanation = "RegExp.test(string)";
        break;
    case "javascript-match-all":
        explanation = "RegExp.test(string)";
        break;
    case "javascript-split":
        explanation = "str.split(regexp)";
        break;
    case "javascript-replace":
        explanation = "string.replace(regexp, repl)";
        break;
    case "javascript-replace-all":
        explanation = "string.replace(regexp, repl)";
        break;
    case "tcl-match":
        explanation = "regexp ?switches? exp string ?matchVar? ?subMatchVar subMatchVar ...?";
        break;
    case "tcl-match-all":
        explanation = "regexp -all ?switches? exp string ?matchVar? ?subMatchVar subMatchVar ...?";
        break;
    case "tcl-split":
        explanation = "split string ?splitChars?";
        break;
    case "tcl-replace":
        explanation = "regsub ?switches? exp string subSpec ?varName?";
        break;
    case "tcl-replace-all":
        explanation = "regsub -all ?switches? exp string subSpec ?varName?";
        break;
    default:
        var msg = "Unexpected language and mode: '"+langMode+"'.";
        ko.dialogs.internalError(msg, msg);
    }
    //XXX No mode explanation while we only have one language.
    //gWidgets.modeExplanation.setAttribute("value", explanation);
}

// Showing/Hiding the "replace column".
// For now we just (un)collapse this column. Later we may want to do fancy
// animation of the column showing/hiding and possibly having it
// expand/contract the window width as necessary to keep the search column
// width constanct.
function _Rxx_ShowReplaceColumn()
{
    if (gWidgets.columnSplitterPattern.hasAttribute("collapsed"))
        gWidgets.columnSplitterPattern.removeAttribute("collapsed");
    if (gWidgets.columnSplitterText.hasAttribute("collapsed"))
        gWidgets.columnSplitterText.removeAttribute("collapsed");
    if (gWidgets.replaceColumn.hasAttribute("collapsed"))
        gWidgets.replaceColumn.removeAttribute("collapsed");
    if (gWidgets.replacementArea.hasAttribute("collapsed"))
        gWidgets.replacementArea.removeAttribute("collapsed");
    if (gWidgets.replacedTextArea.hasAttribute("collapsed"))
        gWidgets.replacedTextArea.removeAttribute("collapsed");
}

function _Rxx_HideReplaceColumn()
{
    gWidgets.columnSplitterPattern.setAttribute("collapsed", "true");
    gWidgets.columnSplitterText.setAttribute("collapsed", "true");
    gWidgets.replaceColumn.setAttribute("collapsed", "true");
    gWidgets.replacementArea.setAttribute("collapsed", "true");
    gWidgets.replacedTextArea.setAttribute("collapsed", "true");
}


function Rxx_Stop() {
    gHandler.stop();
    var msg = "Pattern-match halted.";
    // gWidgets.resultsMessage.setAttribute("value", msg);
    gWidgets.resultsMessage.textContent = msg;
    gWidgets.resultsArea.setAttribute("rxx_status", "");
    //TODO: Clear the results views
}

function Rxx_SetMode(mode, initializing /* = false */) {
    if (typeof(initializing) == "undefined" || initializing == null) initializing = false;
    log.debug("Rxx_SetMode(mode='"+mode+"', initializing="+initializing+")");

    try {
        gMode = mode;
        _Rxx_UpdateModeExplanation(gLanguage, gMode);
        if (gMode.slice(0, 7) == "replace") {
            _Rxx_ShowReplaceColumn();
        } else {
            _Rxx_HideReplaceColumn();
        }
        if (!initializing) {
            RxxResults_Update();
        }
    } catch(ex) {
        log.exception(ex);
    }
}


function Rxx_LoadSample() {
    log.debug("Rxx_LoadSample()");
    try {
        var regex;
        if (typeof(gSampleRegex[gLanguage]) != "undefined") {
            regex = gSampleRegex[gLanguage];
        } else {
            regex = gSampleRegex["*"];
        }
        var searchText;
        if (typeof(gSampleSearchText[gLanguage]) != "undefined") {
            searchText = gSampleSearchText[gLanguage];
        } else {
            searchText = gSampleSearchText["*"];
        }
        var replacement;
        if (typeof(gSampleReplacement[gLanguage]) != "undefined") {
            replacement = gSampleReplacement[gLanguage];
        } else {
            replacement = gSampleReplacement["*"];
        }

        gWidgets.regexView.setBufferText(regex);
        gWidgets.searchTextView.setBufferText(searchText);
        gWidgets.replacementView.setBufferText(replacement);
    } catch(ex) {
        log.exception(ex);
    }
}


function RxxRegex_Restyle() {
    log.debug("RxxRegex_Restyle()");
    try {
        if (gWidgets.regexView.scimoz.text) {
            gBackEndResultsManager.styleRegex(gWidgets.regexView.scimoz,
                                              gRegexOptions,
                                              gResultsManager);
        }
    } catch(ex) {
        log.exception(ex);
    }
}

function RxxReplacement_Restyle() {
    log.debug("RxxReplacement_Restyle()");
    try {
        gBackEndResultsManager.styleReplacement(gWidgets.replacementView.scimoz,
                                                gResultsManager);
    } catch(ex) {
        log.exception(ex);
    }
}


// Open the given help category.
function Rxx_MainHelp(page)
{
    log.debug("Rxx_MainHelp(page='"+page+"')");
    try {
        gMainWindow.ko.help.open(page);
    } catch (ex) {
        log.exception(ex);
    }
}
function Rxx_WebHelp(url)
{
    log.debug("Rxx_WebHelp(url='"+url+"')");
    try {
        gMainWindow.ko.browse.openUrlInDefaultBrowser(url);
    } catch (ex) {
        log.exception(ex);
    }
}

var moduleDependenciesFromLanguage = {
    'perl' : ['JSON'],
    'ruby' : ['json'],
    '__NONE__' : []
};

function _disable_menu_entry_part2(language) {
    var menuitem = document.getElementById("Rxx_ChangeLanguage_" + language);
    var style = menuitem.getAttribute('style');
    var fixedStyle = style.replace(/color\s*:\s*red\s*;?/, '');
    if (fixedStyle.length == 0) {
        menuitem.removeAttribute('style');
    } else {
        menuitem.setAttribute('style', fixedStyle);
    }
    menuitem.setAttribute('disabled', true);
}

function _Rxx_languageIsntInstalled(language) {
    gMainWindow.ko.dialogs.alert("The Rx Toolkit will support the language '"
                                 + language
                                 + "' once it's installed, or Komodo is told where to find it");
    _disable_menu_entry_part2(language);
}

function _Rxx_showWhyThisLanguageIsntSupported(language) {
    var dependencies = moduleDependenciesFromLanguage[language];
    if (!dependencies) {
        gMainWindow.ko.dialogs.alert("The Rx Toolkit currently does not work with "
                                     + language
                                     + ".  There is nothing you can do to change this");
        window.focus();
    } else {
        var plural = dependencies.length == 1 ? "" : "s";
        var verb = dependencies.length == 1 ? "is" : "are";
        gMainWindow.ko.dialogs.alert("The Rx Toolkit will support the language '"
                                     + language
                                     + "' once the module"
                                     + plural
                                     + " ["
                                     + dependencies.join("', ")
                                     + "] "
                                     + verb
                                     + " installed.");
        window.focus();
    }
    _disable_menu_entry_part2(language);
}

function setupSupportedLanguagesMenu() {
    var menulist = document.getElementById("languages_list");
    var command;
    for (var language in gLanguageToDisplayName) {
        var displayName = gLanguageToDisplayName[language];
        var menuitem = document.createElement('menuitem');
        menuitem.setAttribute('label', displayName);
        menuitem.setAttribute('id', "Rxx_ChangeLanguage_" + language);
        menuitem.setAttribute('value', language);
        menuitem.setAttribute('image', "koicon://ko-language/" + escape(language));
        menuitem.setAttribute('class', 'menuitem-iconic');
        menuitem.setAttribute('type', 'foot');
        var languageIsInstalled = true;
        var koAppInfoEx = null;
        try {
            var cid = "@activestate.com/koAppInfoEx?app=" + displayName + ";1";
            if (cid in Components.classes) {
                koAppInfoEx = Components.classes[cid].getService(Components.interfaces.koIAppInfoEx);
            }
        } catch(ex) {
            log.exception("Can't create koAppInfoEx("
                          + displayName
                          + " -- lang: "
                          + language);
            continue;
        }
        try {
            if (koAppInfoEx) {
                if (language == "tcl" && (!koAppInfoEx.tclsh_path || !koAppInfoEx.version)) {
                    languageIsInstalled = false;
                }
            } else if (language == "php") {
                // PHP needs more work
                var handlerCID = gLanguageToHandlerCID[language];
                // We don't need the result, but if we can't instantiate
                // this handler, it means that PHP/CLI can't be found.
                Components.classes[handlerCID]
                    .createInstance(Components.interfaces.koIRxxHandler);
            }
        } catch(ex) {
            log.debug("Language not installed: " + language + ", " + ex.message);
            languageIsInstalled = false;
        }
        if (!languageIsInstalled) {
            command = ("_Rxx_languageIsntInstalled('"
                       + language
                       + "');");
            menuitem.setAttribute('style', 'color: red;');
        } else {
	   command = ("Rxx_ChangeLanguage('"
		      + language
		      + "', false);");
        }
        menuitem.setAttribute('oncommand', command);
        menulist.appendChild(menuitem);
    }
    menulist.value = gLanguage;
}

function RxxRegex_updateLanguageList() {
    var menulist = document.getElementById("languages_list");
    var menuitems = menulist.childNodes;
    for (var menuitem, i = 0; menuitem = menuitems[i]; ++i) {
        if (menuitem.getAttribute('value') == gLanguage) {
            menuitem.setAttribute('class', 'primary_menu_item menuitem-iconic');
        } else {
            menuitem.removeAttribute('checked');
            var cls = menuitem.getAttribute('class').replace(/\s?primary_menu_item\s?/, " ");
            menuitem.setAttribute('class', cls + ' menuitem-iconic');
        }
    }
}

function RxxRegex_launchDelimiterPicker() {
    if (!(gLanguage in factoryDelimitersFromLanguage)) {
        log.error("RxxRegex_launchDelimiterPicker called for lang "
                  + gLanguage
                  + ", no delimiters defined");
        return;
    }
    var delims = delimitersFromLanguage[gLanguage];
    var obj = {
      open_delimiter: delims[0],
      close_delimiter: delims[1],
      factory_delimiters: factoryDelimitersFromLanguage[gLanguage],
      __EOD__: null
    }
    window.openDialog("chrome://komodo/content/rxx/setDelimiters.xul",
                      "_blank",
                      "chrome,dialog,modal,titlebar,resizable=yes",
                      obj);
    if (obj.retval == "OK"
        && obj.open_delimiter
        && obj.close_delimiter
        && (obj.open_delimiter != delims[0]
            || obj.close_delimiter != delims[1])) {
        delims[0] = obj.open_delimiter;
        delims[1] = obj.close_delimiter;
        gRegexOptions.openDelimiter = obj.open_delimiter;
        gRegexOptions.closeDelimiter = obj.close_delimiter;
        scheduleDelayedUpdate();
    }
}

function Rxx_ChangeLanguage(language, initializing /* = false */)
{
    log.debug("Rxx_ChangeLanguage(language='"+language+"')");
    try {
        if (typeof(initializing) == "undefined" || initializing == null) initializing = false;
        var languageDisplayName;
        if (! (languageDisplayName = gLanguageToDisplayName[language])) {
            log.warn("bogus regex language '"+language+
                     "', falling back to 'python'");
            language = "python";
            languageDisplayName = gLanguageToDisplayName[language];
        }
        gLanguage = language;
        var languages_menulist = document.getElementById("languages_list_tbbutton");
        languages_menulist.setAttribute('image', "koicon://ko-language/" + escape(language));
        
        if (gHandler == null || gHandler.language != gLanguage) {
            var handlerCID = gLanguageToHandlerCID[gLanguage];
            if (handlerCID == null) {
                var err = "There is no Rxx handler for the '"+
                          gLanguage+"' regex language!";
                ko.dialogs.internalError(err, err);
                gHandler = null;
            } else {
                try {
                    gHandler = Components.classes[handlerCID]
                        .createInstance(Components.interfaces.koIRxxHandler);
                    gHandler.manager = gBackEndResultsManager;
                } catch(ex) {
                    log.exception("Can't instantiate a handler for "
                                  + language
                                  + ": "
                                  + ex);
                    if (language != "python") {
                        Rxx_ChangeLanguage("python", initializing);
                        return;
                    }
                }
            }
        }
        gNeedToRebuildRegexShortcuts = true;
        if (language in delimitersFromLanguage) {
            gWidgets.regexDelimitersButton.removeAttribute("disabled");
            gRegexOptions.usesDelimiters = true;
            gRegexOptions.openDelimiter = delimitersFromLanguage[language][0];
            gRegexOptions.closeDelimiter = delimitersFromLanguage[language][1];
        } else {
            gWidgets.regexDelimitersButton.setAttribute("disabled", "true");
            gRegexOptions.usesDelimiters = false;
        }
        window.setTimeout(RxxRegex_Restyle, 0);
        scheduleDelayedUpdate();
        gNeedToRebuildReplacementShortcuts = true;

        if (!initializing) {
            _Rxx_UpdateModeExplanation(gLanguage, gMode);
            RxxResults_Update();
        }
        RxxRegex_UpdateWidgetsStatus(gLanguage);
    } catch (ex) {
        log.exception(ex);
    }
}

function RxxRegex_UpdateWidgetsStatus(language) {
    // All buttons are ok
    // These are usually enabled
    gWidgets.regexOptionSCheckbox.disabled = false;
    gWidgets.regexOptionXCheckbox.disabled = false;
    if (language == "python") {
        gWidgets.regexOptionUCheckbox.disabled = false;
        gWidgets.regexOptionLCheckbox.disabled = false;
        gWidgets.regexOptionMCheckbox.disabled = false;
    } else if (language == "perl") {
        gWidgets.regexOptionUCheckbox.disabled = true;
        gWidgets.regexOptionLCheckbox.disabled = true;
        gWidgets.regexOptionMCheckbox.disabled = false;
    } else if (language == "php") {
        gWidgets.regexOptionUCheckbox.disabled = false;
        gWidgets.regexOptionLCheckbox.disabled = true;
        gWidgets.regexOptionMCheckbox.disabled = false;
    } else if (language == "ruby") {
        gWidgets.regexOptionUCheckbox.disabled = false; // utf8 mode
        gWidgets.regexOptionLCheckbox.disabled = true;
        gWidgets.regexOptionMCheckbox.disabled = true;
    } else if (language == "javascript") {
        gWidgets.regexOptionUCheckbox.disabled = true;
        gWidgets.regexOptionLCheckbox.disabled = true;
        gWidgets.regexOptionMCheckbox.disabled = false;
        gWidgets.regexOptionSCheckbox.disabled = true;
        gWidgets.regexOptionXCheckbox.disabled = true;
    } else if (language == "tcl") {
        gWidgets.regexOptionUCheckbox.disabled = true;
        gWidgets.regexOptionLCheckbox.disabled = true;
        gWidgets.regexOptionMCheckbox.disabled = false;
        gWidgets.regexOptionSCheckbox.disabled = false;
        gWidgets.regexOptionXCheckbox.disabled = false;
    } else {
        log.error("? RxxRegex_UpdateWidgetsStatus: Unrecognized lang of " + language + "\n");
    }
}

function RxxRegex_UpdateOption(option)
{
    log.debug("RxxRegex_UpdateOption()");
    try {
        switch (option) {
        case 'i':
            gRegexOptions.i = gWidgets.regexOptionICheckbox.checked;
            break;
        case 'm':
            gRegexOptions.m = gWidgets.regexOptionMCheckbox.checked;
            break;
        case 's':
            gRegexOptions.s = gWidgets.regexOptionSCheckbox.checked;
            break;
        case 'x':
            gRegexOptions.x = gWidgets.regexOptionXCheckbox.checked;
            break;
        case 'u':
            gRegexOptions.u = gWidgets.regexOptionUCheckbox.checked;
            break;
        case 'l':
            gRegexOptions.l = gWidgets.regexOptionLCheckbox.checked;
            break;
        default:
            throw new Error("unexpected regex option: '"+option+"'\n");
        }
        RxxResults_Update();
    } catch (ex) {
        log.exception(ex);
    }
}


// Build the regex syntax shortcuts menupopup, if necessary.
function RxxRegex_ShortcutsShowing(menupopup)
{
    log.debug("RxxRegex_ShortcutsShowing()");
    try {
        if (gNeedToRebuildRegexShortcuts) {
            var shortcuts = gRegexShortcuts;

            // Remove existing menuitems.
            while (menupopup.firstChild) {
                menupopup.removeChild(menupopup.firstChild);
            }

            var shortcut, mi, label;
            for (var i = 0; i < shortcuts.length; i++) {
                // Build a menuitem like this:
                //  <menuitem label="^ : beginning of line"
                //            shortcut="^"
                //            oncommand="RxxRegex_InsertShortcut(this);"/>
                // or this:
                //  <menuseparator/>
                shortcut = shortcuts[i];
                if (typeof(shortcut["separator"]) != "undefined") {
                    mi = document.createElementNS(XUL_NS, "menuseparator");
                } else {
                    if ('include' in shortcut
                        && shortcut.include.indexOf(gLanguage) == -1) {
                        continue;
                    } else if ('exclude' in shortcut
                        && shortcut.exclude.indexOf(gLanguage) != -1) {
                        continue;
                    }
                    mi = document.createElementNS(XUL_NS, "menuitem");
                    label = shortcut["shortcut"] + " : " + shortcut["desc"];
                    mi.setAttribute("label", label);
                    mi.setAttribute("shortcut", shortcut["shortcut"]);
                    mi.setAttribute("crop", "center");
                    mi.setAttribute("oncommand", "RxxRegex_InsertShortcut(this);");
                    if (typeof(shortcut["tooltip"]) != "undefined") {
                        mi.setAttribute("tooltiptext", shortcut["tooltip"]);
                    }
                }
                menupopup.appendChild(mi);
            }
            gNeedToRebuildRegexShortcuts = false;
        }
    } catch (ex) {
        log.exception(ex);
    }
}


// Build the replacement syntax shortcuts menupopup, if necessary.
function RxxReplacement_ShortcutsShowing(menupopup)
{
    log.debug("RxxReplacement_ShortcutsShowing()");
    try {
        if (gNeedToRebuildReplacementShortcuts) {
            // Get group information for the current regex.
            var numGroups = gBackEndResultsManager.getLastNumGroups();
            var groupNamesObj = new Object();
            var countObj = new Object();
            gBackEndResultsManager.getLastGroupNames(countObj, groupNamesObj);
            var groupNames = groupNamesObj.value;

            // Remove existing menuitems.
            while (menupopup.firstChild) {
                menupopup.removeChild(menupopup.firstChild);
            }

            var mi;
            if (numGroups == 0) {
                // Build a menuitem like this:
                //  <menuitem label="(no groups in regex)"
                //            disabled="true"/>
                mi = document.createElementNS(XUL_NS, "menuitem");
                mi.setAttribute("label", "(no groups in regex)");
                mi.setAttribute("disabled", "true");
                menupopup.appendChild(mi);
            } else {
                var i, label, name;
                var delim = gGroupNumberDelimiter[gLanguage];
                if (!delim) delim = '\\';
                for (i = 1; i < numGroups+1; i++) {
                    // Build a menuitem like this:
                    //  <menuitem label="group 0: \0"
                    //            shortcut="\0"
                    //            oncommand="RxxReplacement_InsertShortcut(this);"/>
                    mi = document.createElementNS(XUL_NS, "menuitem");
                    label = ("group "
                             + i
                             + ": "
                             + delim
                             + i);
                    mi.setAttribute("label", label);
                    mi.setAttribute("shortcut", delim + i);
                    mi.setAttribute("oncommand", "RxxReplacement_InsertShortcut(this);");
                    menupopup.appendChild(mi);
                }
                if (groupNames.length > 0) {
                    mi = document.createElementNS(XUL_NS, "menuseparator");
                    menupopup.appendChild(mi);
                }
                for (i = 0; i < groupNames.length; i++) {
                    // Build a menuitem like this:
                    //  <menuitem label="group 'name': \g<name>"
                    //            shortcut="\g<name>"
                    //            oncommand="RxxReplacement_InsertShortcut(this);"/>
                    name = groupNames[i];
                    mi = document.createElementNS(XUL_NS, "menuitem");
                    label = "group '"+name+"': \\g<"+name+">";
                    mi.setAttribute("label", label);
                    mi.setAttribute("shortcut", "\\g<"+name+">");
                    mi.setAttribute("oncommand", "RxxReplacement_InsertShortcut(this);");
                    menupopup.appendChild(mi);
                }
            }
            gNeedToRebuildReplacementShortcuts = false;
        }
    } catch (ex) {
        log.exception(ex);
    }
}


// Insert the given "shortcut" into the given "scimoz" and select the
// inserted text.
function _insert(scimoz, shortcut)
{
    if (scimoz.anchor <= scimoz.currentPos) {
        scimoz.targetStart = scimoz.anchor;
        scimoz.targetEnd = scimoz.currentPos;
        scimoz.replaceTarget(shortcut.length, shortcut);
        scimoz.currentPos = scimoz.targetStart +
                            ko.stringutils.bytelength(shortcut);
        if (scimoz.anchor == scimoz.currentPos) {
            scimoz.anchor = scimoz.targetStart +
                            ko.stringutils.bytelength(shortcut);
        } else {
            scimoz.anchor = scimoz.targetStart;
        }
    } else {
        scimoz.targetStart = scimoz.currentPos;
        scimoz.targetEnd = scimoz.anchor;
        scimoz.replaceTarget(shortcut.length, shortcut);
        scimoz.currentPos = scimoz.targetStart;
        scimoz.anchor = scimoz.targetStart +
                        ko.stringutils.bytelength(shortcut);
    }
}

function _Rxx_InsertShortcut(scimoz, shortcutWidget)
{
    //XXX:TODO: look at using snippets for inserting shortcuts, then can
    //          control selection bndries and cursor position and can use
    //          interpolation mechanisms. Would need to factor out the
    //          actual snippet insertion smarts from
    //          peSnippet.js::_insertSnippet() into a separate
    //          snippet_functions.js module.
    var shortcut = shortcutWidget.getAttribute("shortcut");
    var ellipsisIndex = shortcut.indexOf("...");

    // For bounding shortcuts (e.g., '(...)' is a bounding shortcut):
    // if there is a selection put it in as the '...' part, otherwise
    // insert and select the '...'.
    if (ellipsisIndex != -1) {
        var selection = scimoz.selText;
        if (selection) {
            shortcut = shortcut.replace(/\.\.\./, selection);
            _insert(scimoz, shortcut);
        } else {
            _insert(scimoz, shortcut);
            if (scimoz.anchor <= scimoz.currentPos) {
                scimoz.anchor += ellipsisIndex;
                scimoz.currentPos = scimoz.anchor + 3;
            } else {
                scimoz.anchor = scimoz.currentPos + ellipsisIndex;
                scimoz.currentPos = scimoz.anchor + 3;
            }
        }
    }
    // For non-bounding shortcuts (e.g., '^' is a non-bounding shortcut)
    // replace the selection if there is one or just insert at the
    // current pos.
    else {
        _insert(scimoz, shortcut);
    }
}

function RxxRegex_InsertShortcut(shortcutWidget)
{
    log.debug("RxxRegex_InsertShortcut()");
    try {
        _Rxx_InsertShortcut(gWidgets.regexView.scimoz, shortcutWidget);
        gWidgets.regexView.setFocus();
    } catch (ex) {
        log.exception(ex);
    }
}

function RxxReplacement_InsertShortcut(shortcutWidget)
{
    log.debug("RxxReplacement_InsertShortcut()");
    try {
        _Rxx_InsertShortcut(gWidgets.replacementView.scimoz, shortcutWidget);
        gWidgets.replacementView.setFocus();
    } catch (ex) {
        log.exception(ex);
    }
}


function RxxRegex_OnClick(event)
{
    log.debug("RxxRegex_OnClick(event)");
    //ko.logging.dumpEvent(event);
    try {
        // This seems to be the signature resulting (strangely) from
        // invoking the accesskey for this view.
        if (event.detail == 0 && event.originalTarget.nodeName == "view") {
            gWidgets.regexView.setFocus();
            return false;
        }
    } catch (ex) {
        log.exception(ex);
    }
    return true;
}


function RxxReplacement_OnClick(event)
{
    log.debug("RxxReplacement_OnClick(event)");
    //ko.logging.dumpEvent(event);
    try {
        // This seems to be the signature resulting (strangely) from
        // invoking the accesskey for this view.
        if (event.detail == 0 && event.originalTarget.nodeName == "view") {
            gWidgets.replacementView.setFocus();
            return false;
        }
    } catch (ex) {
        log.exception(ex);
    }
    return true;
}


function RxxSearchText_Open()
{
    log.debug("RxxSearchText_Open()");
    try {
        //XXX Should perhaps default to the directory of document of the view
        //    to which this "Rx" instance is attached.
        var filename = ko.filepicker.browseForFile();
        if (filename != null) {
            var docSvc = Components.classes['@activestate.com/koDocumentService;1']
                        .getService(Components.interfaces.koIDocumentService);
            //XXX uriparse, docSvc, creating a koIDocument instance... it all
            //    seems overkill to just get the files contents.
            var uri = ko.uriparse.pathToURI(filename);
            var doc = docSvc.createDocumentFromURI(uri);
            doc.load();
            gWidgets.searchTextView.setBufferText(doc.buffer);
            gWidgets.searchTextView.scimoz.convertEOLs(PREFERRED_EOL_MODE);

            RxxResults_Update();
        }
    } catch (ex) {
        log.exception(ex);
    }
}


function RxxSearchText_JumpToCurrentMatchResult()
{
    log.debug("RxxSearchText_JumpToCurrentMatchResult()");
    try {
        var startCharPos = gResultsManager.matchResultsView.currentMatchStart;
        var endCharPos = gResultsManager.matchResultsView.currentMatchEnd;
        var scimoz = gWidgets.searchTextView.scimoz;
        var startBytePos = scimoz.positionAtChar(0, startCharPos);
        var endBytePos = scimoz.positionAtChar(startBytePos, endCharPos - startCharPos);
        scimoz.setSel(startBytePos, endBytePos); // set selection and make it visible
        scimoz.chooseCaretX();
        gWidgets.searchTextView.setFocus();
    } catch (ex) {
        log.exception(ex);
    }
}


//XXX Could merge this with above and have the caller get the start/end.
function RxxSearchText_JumpToCurrentSplitResult()
{
    log.debug("RxxSearchText_JumpToCurrentSplitResult()");
    try {
        var start = gResultsManager.splitResultsView.currentResultStart;
        var end = gResultsManager.splitResultsView.currentResultEnd;
        var scimoz = gWidgets.searchTextView.scimoz;
        scimoz.setSel(start, end); // set selection and make it visible
        scimoz.chooseCaretX();
        gWidgets.searchTextView.setFocus();
    } catch (ex) {
        log.exception(ex);
    }
}


function RxxSearchText_OnClick(event)
{
    log.debug("RxxSearchText_OnClick(event)");
    //ko.logging.dumpEvent(event);
    try {
        // This seems to be the signature resulting (strangely) from
        // invoking the accesskey for this view.
        if (event.detail == 0 && event.originalTarget.nodeName == "view") {
            gWidgets.searchTextView.setFocus();
            return false;
        }
    } catch (ex) {
        log.exception(ex);
    }
    return true;
}


function RxxReplacedText_OnClick(event)
{
    log.debug("RxxReplacedText_OnClick(event)");
    //ko.logging.dumpEvent(event);
    try {
        // This seems to be the signature resulting (strangely) from
        // invoking the accesskey for this view.
        if (event.detail == 0 && event.originalTarget.nodeName == "view") {
            gWidgets.replacedTextView.setFocus();
            return false;
        }
    } catch (ex) {
        log.exception(ex);
    }
    return true;
}


// Attempt to match the regex to the search text and display any results.
function RxxResults_Update()
{
    log.debug("RxxResults_Update()");
    gResultsManager.updateInProgressUI(MATCHING_DONE);
    try {
        var pattern = gWidgets.regexView.scimoz.text;
        var replacement;
        if (pattern) {
            switch (gMode) {
            case "match":
                gHandler.match(pattern, gRegexOptions,
                               gWidgets.searchTextView.scimoz);
                break;
            case "match-all":
                gHandler.matchAll(pattern, gRegexOptions,
                                  gWidgets.searchTextView.scimoz);
                break;
            case "split":
                gHandler.split(pattern, gRegexOptions,
                               gWidgets.searchTextView.scimoz);
                break;
            case "replace":
                replacement = gWidgets.replacementView.scimoz.text;
                gHandler.replace(pattern, replacement, gRegexOptions,
                                 gWidgets.searchTextView.scimoz);
                break;
            case "replace-all":
                replacement = gWidgets.replacementView.scimoz.text;
                gHandler.replaceAll(pattern, replacement, gRegexOptions,
                                    gWidgets.searchTextView.scimoz);
                break;
            }
            gResultsManager.matchResultsView.selection.clearSelection();
            RxxRegex_Restyle();
        } else {
            gWidgets.resultsLabel.setAttribute("label", "Match Results");
            gWidgets.resultsArea.setAttribute("rxx_status", "");
            gWidgets.resultsDeck.selectedIndex = 0;
            var msg = "The regular expression is empty.";
            gWidgets.resultsMessage.textContent = msg;
        }
    } catch (ex) {
        log.exception(ex);
    }
}


function RxxResults_OnDblClick(event)
{
    log.debug("RxxResults_OnDblClick(event)");
    //ko.logging.dumpEvent(event);
    try {
        // c.f. mozilla/mailnews/base/resources/content/threadPane.js
        var t = event.originalTarget;

        // single-click on a column
        if (t.localName == "treecol") {
            //XXX Ignore column clicks for now, ordering with hierarchy
            //    is awkward.
            // t.id is the id of the clicked column
        }

        // unmodified left double-click in the tree body
        else if (event.detail == 2 && event.button == 0 &&
                 t.localName == "treechildren" &&
                 event.shiftKey == false && event.ctrlKey == false &&
                 event.altKey == false && event.metaKey == false) {
            if (gMode == "split") {
                RxxSearchText_JumpToCurrentSplitResult();
            } else {
                RxxSearchText_JumpToCurrentMatchResult();
            }
            //XXX The following aren't working. Grrr. Is that because this
            //    fires on the wrong phase?
            event.cancelBubble = true;
            return false;
        }
    } catch (ex) {
        log.exception(ex);
    }
    return true;
}


function RxxResults_OnClick(event)
{
    log.debug("RxxResults_OnClick(event)");
    //ko.logging.dumpEvent(event);
    try {
        // c.f. mozilla/mailnews/base/resources/content/threadPane.js
        var t = event.originalTarget;

        // single-click on a column
        if (t.localName == "treecol") {
            //XXX Ignore column clicks for now, ordering with hierarchy
            //    is awkward.
            // t.id is the id of the clicked column
        }

        // unmodified left double-click in the tree body
        else if (event.detail == 2 && event.button == 0 &&
                 t.localName == "treechildren" &&
                 event.shiftKey == false && event.ctrlKey == false &&
                 event.altKey == false && event.metaKey == false) {
            if (gMode == "split") {
                RxxSearchText_JumpToCurrentSplitResult();
            } else {
                RxxSearchText_JumpToCurrentMatchResult();
            }
            //XXX The following aren't working. Grrr. Is that because this
            //    fires on the wrong phase?
            event.cancelBubble = true;
            return false;
        }

        // This seems to be the signature resulting (strangely) from
        // invoking the accesskey for the treechildren widget. Make sure
        // the fact that the Match Results are focussed is visible.
        else if (event.detail == 0 && t.localName == "deck") {
            var view = null;
            var tree = null;
            if (gMode == "split") {
                view = gResultsManager.splitResultsView;
                tree = gWidgets.splitResultsTree;
            } else {
                view = gResultsManager.matchResultsView;
                tree = gWidgets.matchResultsTree;
            }
            var currentIndex = view.selection.currentIndex;
            if (currentIndex == -1) {
                currentIndex = 0;
            } else if (currentIndex >= view.rowCount) {
                currentIndex = view.rowCount - 1;
            }
            view.selection.select(currentIndex);
            tree.focus();
        }
    } catch (ex) {
        log.exception(ex);
    }
    return true;
}


function RxxResults_OnKeyPress(event)
{
    log.debug("RxxResults_OnKeyPress(event)");
    //ko.logging.dumpEvent(event);
    try {
        if (event.keyCode == 13 /* <Enter> */ && gMode != "split") {
            RxxSearchText_JumpToCurrentMatchResult();
            //XXX The following aren't working. Grrr. Is that because this
            //    fires on the wrong phase?
            event.cancelBubble = true;
            return false;
        }
    } catch (ex) {
        log.exception(ex);
    }
    return true;
}
