#!python
# Copyright (c) 2003-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""The backend for Komodo's new new Rx windows (aka Rxx)."""
#TODO:
# - PERF: Asynchronous matching and reporting of results so that regexes with
#   thousands of matches are not too slow.
# - PERF: delayed searching (similar to linting), so that updating is not
#   attempted more than once per second.

import os
import sys
import re
import logging
import types
import pprint
import json

from xpcom import components, nsError, ServerException
from xpcom.server import UnwrapObject, WrapObject
from koTreeView import TreeView

import lexregex


#---- globals

log = logging.getLogger("koRxx")
#log.setLevel(logging.DEBUG)

#---- Rxx backend

class KoRxxMatchResultsTreeView(TreeView):
    _com_interfaces_ = [components.interfaces.koIRxxMatchResultsTreeView,
                        components.interfaces.nsITreeView]
    _reg_clsid_ = "{882803F0-A674-43EB-9F2C-D82009394719}"
    _reg_contractid_ = "@activestate.com/koRxxMatchResultsTreeView;1"
    _reg_desc_ = "Komodo Rxx Match Results Tree View"

    def __init__(self):
        TreeView.__init__(self) #, debug="rxx")
        self._tree = None
        self._sortedBy = None
        self._matches = None
        # Maps match number to a boolean indicating if the match's twisty
        # is opened. No entry for a match number means the match is _open_.
        # This is maintained across .setMatches() calls so there is no
        # jitter in the match results pane.
        self._matchIsOpen = {}
        self._rows = None

        self._ignoreNextToggleOpenState = False

    def setMatches(self, matches):
        """Set the matches for this pattern/searchText.
        
            "matches" is a list of matches. Each match is a list of dicts
                of the form:
                    {"name": <group name or None>,
                     "span": <span>, # (<start index>, <end index>)
                     "value": <value>,
                     "replacement": <replacement>}  # iff a replace result
                There should always be an implicit first group (0) that is
                the whole match.
        """
        #pprint.pprint(matches)
        self._matches = matches
        self._tree.beginUpdateBatch()
        self._updateRows()
        self._tree.invalidate()
        self._tree.endUpdateBatch()

    def _getCurrentMatchDatum(self, datumName):
        index = self.selection.currentIndex
        if index == -1:
            raise ServerException(nsError.NS_ERROR_FAILURE,
                                  "no currently selected match result")
        return self._rows[index][datumName]

    def get_currentMatchGroupName(self):
        return self._getCurrentMatchDatum("group-name")

    def get_currentMatchStart(self):
        return self._getCurrentMatchDatum("group-span")[0]

    def get_currentMatchEnd(self):
        return self._getCurrentMatchDatum("group-span")[1]

    def get_currentMatchValue(self):
        return self._getCurrentMatchDatum("match-results-tree-value")

    def _updateRows(self):
        """Update self._rows based on the current set of matches and on
        which matches are opened.
        """
        rows = []
        for i in range(len(self._matches)):
            groups = self._matches[i]
            row = {"match-results-tree-group": "Match %d (Group 0)" % i,
                   "match-results-tree-span": "%s-%s" % tuple(groups[0]["span"]),
                   "match-results-tree-value":
                        _escaped_text_from_text(groups[0]["value"]),
                   "match-results-tree-replacement":
                        _escaped_text_from_text(groups[0].get("replacement", "")),
                   "group-name": None,
                   "group-span": groups[0]["span"],
                   "is-container": len(groups) > 1,
                   "level": 0,
                   "parent-index": -1,
                   "match-index": i}
            rows.append(row)
            if self._matchIsOpen.get(i, 1):
                parentIndex = len(rows) - 1
                for j in range(1, len(groups)):
                    group = groups[j]
                    if group["value"] is None:
                        continue
                    if group["name"]:
                        name = "Group %d (%s)" % (j, group["name"])
                    else:
                        name = "Group %d" % j
                    row = {"match-results-tree-group": name,
                           "match-results-tree-span": "%s-%s" % tuple(group["span"]),
                           "match-results-tree-value":
                                _escaped_text_from_text(group["value"]),
                           "match-results-tree-replacement":
                                _escaped_text_from_text(group.get("replacement", "")),
                           "group-name": group["name"],
                           "group-span": group["span"],
                           "is-container": 0,
                           "level": 1,
                           "parent-index": parentIndex,
                           "match-index": i}
                    rows.append(row)
        #pprint.pprint(rows)
        self._rows = rows

    def ignoreNextToggleOpenState(self):
        self._ignoreNextToggleOpenState = True

    #---- nsITreeView methods
    def get_rowCount(self):
        try:
            return len(self._rows)
        except TypeError: # self._rows is None
            return 0

    def getCellText(self, row, column):
        cell = ""
        try:
            cell = self._rows[row][column.id]
        except IndexError:
            log.error("no %sth match result" % row)
        except KeyError:
            log.error("unknown match results column: '%s'" % column.id)
        if type(cell) not in types.StringTypes:
            cell = str(cell)
        return cell

    def isContainer(self, row):
        return self._rows[row]["is-container"]

    def isContainerEmpty(self, row):
        #XXX Maybe we should use this and always make a match a container
        #    even if there are no sub groups???
        return 0

    def isContainerOpen(self, row):
        matchIndex = self._rows[row]["match-index"]
        return self._matchIsOpen.get(matchIndex, 1)

    def toggleOpenState(self, row):
        # Implement the nsITreeView side of our HACK to control toggling state
        # of this node. See the 'cbtree' binding in widgets.xml.
        if self._ignoreNextToggleOpenState:
            log.debug("ignoring this toggleOpenState(row=%r)", row)
            self._ignoreNextToggleOpenState = False
            return

        matchIndex = self._rows[row]["match-index"]
        isOpen = self._matchIsOpen.get(matchIndex, 1)
        self._matchIsOpen[matchIndex] = not isOpen

        # Must recalculate the rows.
        self._tree.beginUpdateBatch()
        self._updateRows()
        self._tree.invalidate()
        self._tree.endUpdateBatch()

    def getParentIndex(self, row):
        return self._rows[row]["parent-index"]

    def getLevel(self, row):
        return self._rows[row]["level"]

    #XXX might handle this from JS side
    #def selectionChanged(self):
    #    index = self.selection.currentIndex
    #    cdict = self._data[index]
    #    self.templatesView.setData(cdict["node"].files)

    def getImageSrc(self, row, column):
        #XXX Get more appropriate icons
        if column.id != "match-results-tree-group":
            return ""
        if self._rows[row]["is-container"]:
            matchIndex = self._rows[row]["match-index"]
            isOpen = self._matchIsOpen.get(matchIndex, 1)
            if isOpen:
                return "chrome://komodo/skin/images/folder-open.png"
            else:
                return "chrome://komodo/skin/images/folder-closed.png"
        #else:
        #   XXX might want to have an icon for the simple groups
    
    def hasNextSibling(self, rowIndex, afterIndex):
        """From the nsITreeView.idl docs:
        
        HasNextSibling is used to determine if the row at rowIndex has a
        nextSibling that occurs *after* the index specified by
        afterIndex.  Code that is forced to march down the view looking
        at levels can optimize the march by starting at afterIndex+1.
        """
        if afterIndex+1 >= len(self._rows):
            return 0
        else:
            return (self._rows[rowIndex]["parent-index"]
                    == self._rows[afterIndex+1]["parent-index"])


class KoRxxSplitResultsTreeView(TreeView):
    _com_interfaces_ = [components.interfaces.koIRxxSplitResultsTreeView,
                        components.interfaces.nsITreeView]
    _reg_clsid_ = "{2C199F24-E11E-467C-BA96-9178605FD810}"
    _reg_contractid_ = "@activestate.com/koRxxSplitResultsTreeView;1"
    _reg_desc_ = "Komodo Rxx Split Results Tree View"

    def __init__(self):
        TreeView.__init__(self) #, debug="rxx")
        self._tree = None
        self._rows = []

    def setSplitResults(self, results, searchText):
        """Set the result of splitting the search test.
        
            "results" is a list of strings
            "searchText" is the text on which the split was made. This is
                required for determine .currentResults{Start|End} below.
        """
        change = len(results) - len(self._rows)
        self._splits = results
        self._searchText = searchText
        self._rows = [{"split-results-tree-value": s} for s in self._splits]
        self._tree.beginUpdateBatch()
        self._tree.rowCountChanged(0, change)
        self._tree.invalidate()
        self._tree.endUpdateBatch()

    def _cacheResultSpans(self, index):
        """Determine (and cache in self._rows) the span of each split result
        up to (and including) the given "index".
        
        This is determined by working up from the start of the list of split
        results. Note that it is possible that this gets it wrong because
        the results of a regex split might not include the split-tokens and
        if any of those tokens match the split results then we can get off.
        """
        start = end = 0
        for i in range(index+1):
            if "start" in self._rows[i]:
                continue # skip already determined spans
            s = self._splits[i]
            start = self._searchText.find(s, start)
            if start == -1:
                raise ServerException(nsError.NS_ERROR_UNEXPECTED,
                    "could not find %dth split result in search text" % i)
            end = start + len(s)
            self._rows[i]["start"] = start
            self._rows[i]["end"] = end
            log.debug("split result %d: '%s': span %d-%d", i, s, start, end)

    def get_currentResultStart(self):
        index = self.selection.currentIndex
        if index == -1:
            raise ServerException(nsError.NS_ERROR_FAILURE,
                                  "no currently selected split result")
        if "start" not in self._rows[index]: # lazily determine the split indices
            self._cacheResultSpans(index)
        return self._rows[index]["start"]

    def get_currentResultEnd(self):
        index = self.selection.currentIndex
        if index == -1:
            raise ServerException(nsError.NS_ERROR_FAILURE,
                                  "no currently selected split result")
        if "end" not in self._rows[index]:
            self._cacheResultSpans(index)
        return self._rows[index]["end"]


    #---- nsITreeView methods
    def get_rowCount(self):
        try:
            return len(self._rows)
        except TypeError: # self._rows is None
            return 0

    def getCellText(self, row, column):
        cell = ""
        try:
            cell = self._rows[row][column.id]
        except IndexError:
            log.error("no %sth split result" % row)
        except KeyError:
            log.error("unknown split results column: '%s'" % column.id)
        if type(cell) not in types.StringTypes:
            cell = str(cell)
        return cell

    def isContainer(self, row):
        return 0
    #XXX I don't think I have to implement these if isContainer == 0.
    #def isContainerEmpty(self, row):
    #    return 0
    #def isContainerOpen(self, row):
    #    return 0
    #def toggleOpenState(self, row):
    #    pass
    #def getParentIndex(self, row):
    #    pass
    #def getLevel(self, row):
    #    return 0

    def getImageSrc(self, row, column):
        #XXX Might be nice to have a icon for this.
        pass


class KoRxxRegexOptions:
    _com_interfaces_ = components.interfaces.koIRxxRegexOptions
    _reg_desc_ = "Rxx Regular Expression Options"
    _reg_clsid_ = "{2EA0D49B-EDCB-40f3-9D42-C901A3574724}"
    _reg_contractid_ = "@activestate.com/koRxxRegexOptions;1"

    def __init__(self):
        self.i = 0
        self.m = 0
        self.s = 0
        self.x = 0
        self.u = 0
        self.l = 0
        self.usesDelimiters = False
        self.openDelimiter = self.closeDelimiter = None

    def restoreFromPrefs(self):
        prefs = components.classes["@activestate.com/koPrefService;1"].\
                getService(components.interfaces.koIPrefService).prefs
        for mod in "imsxul":
            #attr = getattr(self, mod)
            prefName = "rxx_modifier_"+mod
            #print "XXX restoring %r from %r: %r" % (attr, prefName, prefs.getBooleanPref(prefName))
            setattr(self, mod, prefs.getBooleanPref(prefName))

    def saveToPrefs(self):
        prefs = components.classes["@activestate.com/koPrefService;1"].\
                getService(components.interfaces.koIPrefService).prefs
        for mod in "imsxul":
            #attr = getattr(self, mod)
            prefName = "rxx_modifier_"+mod
            #print "XXX saving %r to %r pref" % (attr, prefName)
            prefs.setBooleanPref(prefName, getattr(self, mod))

    def set_openDelimiter(self, delim):
        self.openDelimiter = delim

    def set_closeDelimiter(self, delim):
        self.closeDelimiter = delim

    def set_usesDelimiters(self, val):
        self.usesDelimiters = val

    def repr(self, language):
        if language == "python":
            repr = []
            if self.i: repr.append('re.I')
            if self.m: repr.append('re.M')
            if self.s: repr.append('re.S')
            if self.x: repr.append('re.X')
            if self.u: repr.append('re.U')
            if self.l: repr.append('re.L')
            repr = "|".join(repr)
        elif language == "perl":
            repr = ""
            if self.i: repr += 'i'
            if self.m: repr += 'm'
            if self.s: repr += 's'
            if self.x: repr += 'x'
            #XXX Are there other Perl regex options?
            #if self.u: repr += 'u'
            #if self.l: repr += 'l'
        elif language == "php":
            repr = ""
            if self.i: repr += 'i'
            if self.m: repr += 'm'
            if self.s: repr += 's'
            if self.x: repr += 'x'
            if self.u: repr += 'u'
        elif language == "ruby":
            repr = ""
            if self.i: repr += 'i'
            if self.m: repr += 'm'
            if self.x: repr += 'x'
            #TODO: Ruby's lang options -- e:EUC, s:SJIS, u:UTF-8
        elif language == "javascript":
            repr = ""
            if self.i: repr += 'i'
        elif language == "tcl":
            repr = ""
            if self.i: repr += 'i'
            if self.m: repr += 'm'
            if self.s: repr += 's'
            if self.x: repr += 'x'
        else:
            errmsg = "unknown regex option repr language: '%s'" % language
            #XXX koILastErrorService? log.error?
            raise ServerException(nsError.NS_ERROR_UNEXPECTED, errmsg)
        repr += "usesDelimiters: %r" % (self.usesDelimiters)
        if self.usesDelimiters:
            repr += "openDelimiter:%r, closeDelimiter:%r" % (self.openDelimiter, self.closeDelimiter)
        return repr


class koRxxResponseHandler:
    """
    This class is a singleton. It processes all the responses from the
    koRunService, and feeds the results back to the UI.
    """
    _com_interfaces_ = [components.interfaces.nsIObserver,
                        components.interfaces.koIRxxResultsManager]
    _reg_desc_ = "Rxx Response Handler"
    _reg_clsid_ = "{55eeeb4c-df0e-495a-9bfd-3dd9c30aa78d}"
    _reg_contractid_ = "@activestate.com/koRxxResponseHandler;1"
    def __init__(self):
        # A cache of information on the last regex match. These should be
        # updated as appropriate after each regex match/compile.
        self._lastNumGroups = 0
        self._lastGroupNames = []
        
        # Mapping of style name to "style num tuples". See styles.py.
        # I don't know what it means for the tuple to have more than one
        # value. For the "Regex" language they are all 1-element tuples
        # with a style _number_.
        from styles import StateMap
        self.styleMap = StateMap["Regex"]

        obsSvc = components.classes["@mozilla.org/observer-service;1"].\
                       getService(components.interfaces.nsIObserverService)
        self.wrappedSelf = WrapObject(self, components.interfaces.nsIObserver)
        obsSvc.addObserver(self.wrappedSelf, "run_terminated", 1)
        self.MATCHING_DONE = components.interfaces.koIRxxResultsManager.MATCHING_DONE
        self.MATCHING_DONE_ON_ERROR = components.interfaces.koIRxxResultsManager.MATCHING_DONE_ON_ERROR
        self.MATCHING_IN_PATTERN_MATCH = components.interfaces.koIRxxResultsManager.MATCHING_IN_PATTERN_MATCH
        self.MATCHING_UPDATING_RESULTS = components.interfaces.koIRxxResultsManager.MATCHING_UPDATING_RESULTS
        self._terminated = False
        self.mostRecentUuid = None
        self.mostRecentUuids = {}

    def initialize(self, manager, searchScimoz, replaceScimoz):
        self._manager = manager
        self.scimoz = searchScimoz
        self.replacedTextSciMoz = replaceScimoz
        
    def getLastNumGroups(self):
        return self._lastNumGroups

    def setLastNumGroups(self, val):
        self._lastNumGroups = val

    def getLastGroupNames(self):
        return self._lastGroupNames

    def setLastGroupNames(self, val):
        self._lastGroupNames = val

    def _style(self, target, scimoz, resultsManager):
        #XXX If lexregex.py can be made to handle it, we could start styling
        #    from scimoz.endStyled (usually >0).
        scimoz.startStyling(0, 0x1f) # styling with std 5 bits
        try:
            if target == "regex":
                tokengen = lexregex.lexregex(scimoz.text.encode('utf-8'),
                                             language=self.language)
            elif target == "replacement":
                tokengen = lexregex.lexreplacement(scimoz.text.encode('utf-8'),
                                                   language=self.language)
            else:
                raise ValueError("unexpected style target: '%s'" % target)
            for style, index in tokengen:
                styleNum = self.styleMap[style][0]
                if not isinstance(styleNum, int):
                    styleNum = getattr(components.interfaces.ISciMoz, styleNum)
                endStyled = scimoz.endStyled
                #log.debug("style %d-%d: %r (%d)", endStyled, index,
                #          style, styleNum)
                scimoz.setStyling(index - endStyled + 1, styleNum)
        except lexregex.LexRegexError, ex:
            # There was an error in the regex -- some of the regex will
            # not have been styled. Oh well. Mark the error area if the
            # indeces of the error are noted.
            # Clear previous syntax errors.
            scimoz.startStyling(0, scimoz.INDICS_MASK)
            scimoz.setStyling(scimoz.textLength, 0)
            if ex.startIndex is not None:
                scimoz.startStyling(ex.startIndex, scimoz.INDICS_MASK)
                endIndex = ex.endIndex
                if endIndex is None:
                    endIndex = ex.startIndex
                scimoz.setStyling(endIndex - ex.startIndex + 1,
                                  scimoz.INDIC0_MASK)
            resultsManager.lexError(ex.msg)
        else:
            # Clear previous syntax errors.
            scimoz.startStyling(0, scimoz.INDICS_MASK)
            scimoz.setStyling(scimoz.textLength, 0)
            resultsManager.lexSuccess()

        # This code is called by a timer, not as the text is styled for
        # painting so if we restyled anything currently on screen, we
        # need to repaint. No "clean" way to do this (that I know of)!
        scimoz.tabWidth = scimoz.tabWidth # this forces a repaint.

    def styleRegex(self, scimoz, options, resultsManager):
        #XXX If this full styling everytime becomes a perf problem, then
        #    figure out if getting onStyleNeeded to actually work would help.
        #    This would require more of lexregex.py.
        #XXX TODO: use 'options'.
        log.debug("koRxxResponseHandler.styleRegex(scimoz, options, resultsManager)")
        self._style("regex", scimoz, resultsManager)

    def styleReplacement(self, scimoz, resultsManager):
        log.debug("koRxxResponseHandler.styleReplacment(scimoz, resultsManager)")
        self._style("replacement", scimoz, resultsManager)

    def _setResults(self, manager, matches, substitutions=None):
        """Set match (and possibly replacement-) results on the Rxx
        results manager.
        
            "manager" is a koIRxxResultsManager instance
            "matches" is a list of language-agnostic pseudo-MatchObject's
            "substitutions" is a list of replacement strings (or None if
                not setting replacement results).
        """
        resultsView = UnwrapObject(manager.matchResultsView)
        manager.matchSuccess(len(matches))
        resultsView.setMatches(matches)

    def shutdown(self):
        obsSvc = components.classes["@mozilla.org/observer-service;1"].\
                       getService(components.interfaces.nsIObserverService)
        obsSvc.removeObserver(self.wrappedSelf, "run_terminated")

    def observe(self, subject, topic, data):
        if topic != "run_terminated":
            return
        if self._terminated:
            # Nothing to do
            return
        koRunProcessHandle = subject
        if koRunProcessHandle.uuid != self.mostRecentUuid:
            log.debug("Stale process ID %r (waiting for %r)", koRunProcessHandle.uuid, self.mostRecentUuid)
        if koRunProcessHandle.uuid in self.mostRecentUuids:
            # Use it anyway
            del self.mostRecentUuids[koRunProcessHandle.uuid]
        else:
            #log.debug("Don't recognize process %s", koRunProcessHandle.uuid)
            return
        
        self._manager.updateInProgressUI(self.MATCHING_UPDATING_RESULTS)
        self._koRunProcess = None
        errors = koRunProcessHandle.getStderr()
        if errors:
            log.error(errors)
            self._manager.matchError(errors)
            self._manager.updateInProgressUI(self.MATCHING_DONE_ON_ERROR)
            return
        responseString = koRunProcessHandle.getStdout()
        #log.debug("**** responseString: %s", responseString)
        try:
            responsePacket = json.loads(responseString)
        except ValueError, ex:
            log.debug("  Can't json.decode %s: %s", responseString, ex)
            # Some languages, like PHP, return error messages in the output
            # We need to provide some output, or the user will see the last
            # match's output.
            ptn = re.compile(r'^(.*){"status":', re.DOTALL)
            m = ptn.match(responseString)
            if m:
                self._manager.matchError(m.group(1))
            else:
                self._manager.matchError("Internal error: unexpected output: "
                                         + responseString)
            self._manager.updateInProgressUI(self.MATCHING_DONE_ON_ERROR)
            return

        status = responsePacket['status']
        if status == 'matchError':
            self._manager.matchError(responsePacket['exception'])
        elif status == 'error':
            exception = responsePacket['exception']
            if exception:
                self._manager.matchError(exception)
        elif status == 'matchFailure':
            self._manager.matchFailure(None)
        elif status in ('ok', 'hybrid'):
            self.setLastNumGroups(int(responsePacket.get('lastNumGroups', 0)))
            self.setLastGroupNames(responsePacket.get('lastGroupNames', []))
            funcName = "_do_" + responsePacket['operation']
            func = getattr(self, funcName)
            if func:
                func(responsePacket)
                funcName += '_style'
                func = getattr(self, funcName)
                if func:
                    func(responseString)
                    return
                else:
                    self._manager.updateInProgressUI(self.MATCHING_DONE_ON_ERROR)
                    raise RuntimeError("No style func: " + responseString)
            else:
                self._manager.updateInProgressUI(self.MATCHING_DONE_ON_ERROR)
                raise RuntimeError(responseString)
        self._manager.updateInProgressUI(self.MATCHING_DONE_ON_ERROR)

    def _do_match(self, responsePacket):
        universalMatchObjs = responsePacket['result']
        if universalMatchObjs:
            self._manager.matchSuccess(len(universalMatchObjs))
            self._setResults(self._manager, universalMatchObjs)
        else:
            self._manager.matchFailure(None)

    def _do_match_style(self, responseString):
        highlightStyleNum = self.styleMap["match_highlight"][0]
        self._manager.styleSearchText(responseString, self.scimoz,
                                      highlightStyleNum)

    _do_matchAll_style = _do_match_style

    def _do_matchAll(self, responsePacket):
        # This does the same thing on return
        return self._do_match(responsePacket)

    def _do_split(self, responsePacket):
        results = responsePacket['result']
        self._manager.matchSuccess(len(results))
        self._manager.splitResultsView.setSplitResults(results, self.scimoz.text)
        self._manager.matchSuccess(len(results))
        
    def _do_split_style(self, responseString):
        self._manager.updateInProgressUI(self.MATCHING_DONE)

    def _do_replace(self, responsePacket):
        status = responsePacket['status']
        substitutions = responsePacket['substitutions']
        if status == 'hybrid':
            groupObjs = []
            if responsePacket['subStatus'] == 'replaceError':
                self._manager.replaceError(responsePacket['exception'])
            elif responsePacket['subStatus'] == 'matchFailure':
                self._manager.matchFailure(None)
        else:
            groupObjs = responsePacket['result']
            self._setResults(self._manager, groupObjs, substitutions)
        self.replacedTextSciMoz.readOnly = 0
        self.replacedTextSciMoz.text = responsePacket['replacedText']
        self.replacedTextSciMoz.readOnly = 1
        
    def _do_replace_style(self, responseString):
        highlightStyleNum = self.styleMap["match_highlight"][0]
        self._manager.styleSearchAndReplacedText(responseString,
                                                 self.scimoz,
                                                 self.replacedTextSciMoz,
                                                 highlightStyleNum)

    def _do_replaceAll(self, responsePacket):
        # These do the same thing after the match.
        return self._do_replace(responsePacket)

    _do_replaceAll_style = _do_replace_style

    # Routines used by the handler objects

    def updateInProgressUI_MatchingDone(self):
        self._manager.updateInProgressUI(self.MATCHING_DONE)

    def updateInProgressUI_MatchingInPatternMatch(self):
        self._manager.updateInProgressUI(self.MATCHING_IN_PATTERN_MATCH)
        

_rxx_evaluator_by_language = {
    "javascript": "rxx_js.js",
    "python": "rxx_python.py",
    "perl": "rxx_perl.pl",
    "php": "rxx_php.php",
    "ruby": "rxx_ruby.rb",
    "tcl": "rxx_tcl.tcl",
}

class KoRxxLanguageRequester(object):
    _quotableCharacterRE = re.compile(r'[^\w\d_=.\-]')
    def __init__(self):
        self.koRunService = components.classes["@activestate.com/koRunService;1"].\
                    getService(components.interfaces.koIRunService)
        self._koRunProcess = None

    def set_manager(self, val):
        self.manager = UnwrapObject(val)
        
    def _optionsToReFlags(self, options):
        """
        Map the options to their underlying letters.  The back end will
        do whatever's appropriate.
        """
        reFlags = ""
        for c in self._supportedOptions:
            if getattr(options, c):
                reFlags += c
        return reFlags

    def _quoteIfNecessary(self, s):
        if self._quotableCharacterRE.search(s):
            if '"' in s:
                if "'" in s:
                    log.error("Path containing both kinds of quotes!")
                    return s
                return "'" + s + "'"
            else:
                return '"' + s + '"'
        return s
        
    def addDelimiters(self, requestPacket, options):
        if options.usesDelimiters:
            requestPacket['openDelimiter'] = options.openDelimiter
            requestPacket['closeDelimiter'] = options.closeDelimiter
            
    def _runRequest(self, requestPacket):
        if self._koRunProcess:
            # Stop any pending requests.
            self.stop()
        requestString = json.dumps(requestPacket)
        self._terminated = False
        self._koRunProcess = self.koRunService.RunAndNotify(self._evalCommand,
                                                            '', '', requestString)
        self.manager.mostRecentUuids[self._koRunProcess.uuid] = 1
        self.manager.mostRecentUuid = self._koRunProcess.uuid
        self.manager.updateInProgressUI_MatchingInPatternMatch()
        return

    def stop(self):
        if self._koRunProcess:
            try:
                del self.manager.mostRecentUuids[self._koRunProcess.uuid]
            except KeyError:
                pass
            except AttributeError:
                pass
            
            self.manager.mostRecentUuid = None
            self._terminated = True
            self._koRunProcess.kill(1)
            self._koRunProcess = None
        self.manager.updateInProgressUI_MatchingDone()

    _json_at_map = { '@':'@', '\\':'b', '[':'c', ']':'d',  
                     '{':'e',  '}':'f', '$':'g', '"':'q', }
    _json_escape_chars_re = re.compile(r'([@\\\[\]\{\}\$\"])')
    def _escapeForJSON(self, m):
        return '@' + self._json_at_map[m.group(1)]
    def _wrapRequest(self, requestPacket, options):
        self.addDelimiters(requestPacket, options)
        if self.language == "tcl":
            # Bug 102789: Tcl's JSON parser chokes on special
            # characters in strings, so hide them using @-escape sequences,
            # which are meaningless in Tcl.
            fields = ['pattern', 'text', 'replacement']
            for f in fields:
                if f in requestPacket:
                    escaped = self._json_escape_chars_re.sub(self._escapeForJSON, requestPacket[f])
                    if escaped != requestPacket[f]:
                        requestPacket[f] = escaped
                        requestPacket['atEscaped'] = True
        self._runRequest(requestPacket)
        self.manager.language = self.language
        
    def match(self, pattern, options, scimoz):
        log.debug("KoRxxPythonHandler.match(pattern=%r, options='%s', "
                  "scimoz, manager)", pattern,
                  options and options.repr(self.language))
        requestPacket = {
            'operation': 'match',
            'pattern': pattern,
            'options': self._optionsToReFlags(options),
            'text': scimoz.text
        }
        self._wrapRequest(requestPacket, options)

    def matchAll(self, pattern, options, scimoz):
        log.debug("KoRxxPythonHandler.matchAll(pattern=%r, options='%s', "
                  "scimoz, manager)", pattern,
                  options and options.repr(self.language))
        requestPacket = {
            'operation': 'matchAll',
            'pattern': pattern,
            'options': self._optionsToReFlags(options),
            'text': scimoz.text
        }
        self._wrapRequest(requestPacket, options)

    def split(self, pattern, options, scimoz):
        log.debug("KoRxxPythonHandler.split(pattern=%r, options='%s', "
                  "scimoz, manager)", pattern,
                  options and options.repr(self.language))
        self._searchText = scimoz.text
        requestPacket = {
            'operation': 'split',
            'pattern': pattern,
            'options': self._optionsToReFlags(options),
            'text': self._searchText
        }
        self._wrapRequest(requestPacket, options)

    def replace(self, pattern, replacement, options, searchTextSciMoz):
        log.debug("KoRxxPythonHandler.replace(pattern=%r, replacement=%r, "
                  "options='%s', scimoz, scimoz, manager)", pattern,
                  replacement, options and options.repr(self.language))
        requestPacket = {
            'operation': 'replace',
            'pattern': pattern,
            'replacement': replacement,
            'options': self._optionsToReFlags(options),
            'text': searchTextSciMoz.text,
            'regexOptional': True,
        }
        self._wrapRequest(requestPacket, options)

    def replaceAll(self, pattern, replacement, options, searchTextSciMoz):
        log.debug("KoRxxPythonHandler.replaceAll(pattern=%r, replacement=%r, "
                  "options='%s', scimoz, scimoz, manager)", pattern,
                  replacement, options and options.repr(self.language))
        requestPacket = {
            'operation': 'replaceAll',
            'pattern': pattern,
            'replacement': replacement,
            'options': self._optionsToReFlags(options),
            'text': searchTextSciMoz.text,
            'regexOptional': True,
        }
        self._wrapRequest(requestPacket, options)



class KoRxxPythonHandler(KoRxxLanguageRequester):
    _com_interfaces_ = [components.interfaces.koIRxxHandler,
                        components.interfaces.nsIObserver]
    _reg_desc_ = "Rxx Python Handler"
    _reg_clsid_ = "{BA5DA728-DA03-4a86-8F3A-2A81791C33C9}"
    _reg_contractid_ = "@activestate.com/koRxxPythonHandler;1"
    language = "python"

    def __init__(self):
        KoRxxLanguageRequester.__init__(self)
        koDirSvc = components.classes["@activestate.com/koDirs;1"].\
                    getService(components.interfaces.koIDirs)
        koPythonAppInfo = components.classes["@activestate.com/koAppInfoEx?app=Python;1"].\
                     getService(components.interfaces.koIAppInfoEx)
        pythonPath = koPythonAppInfo.executablePath
        if not (pythonPath
                and os.path.exists(pythonPath)
                and koPythonAppInfo.haveModules(['json'])):
            #XXX Note changes to koIAppInfo/koAppInfo
            pythonPath = None
                
        if not pythonPath:
            # Fallback to using Komodo's Python
            pythonPath = koDirSvc.pythonExe
        rxxEvaluator = os.path.join(koDirSvc.supportDir, 'rxx',
                                    _rxx_evaluator_by_language[self.language.lower()])
        self._evalCommand = " ".join([self._quoteIfNecessary(pythonPath),
                                      self._quoteIfNecessary(rxxEvaluator)])
        self._supportedOptions = "imsxul"
        
class KoRxxPerlHandler(KoRxxLanguageRequester):
    _com_interfaces_ = [components.interfaces.koIRxxHandler,
                        components.interfaces.nsIObserver]
    _reg_desc_ = "Rxx Perl Handler"
    _reg_clsid_ = "{85302CD4-E090-4269-975F-0597C5D444BB}"
    _reg_contractid_ = "@activestate.com/koRxxPerlHandler;1"
    language = "perl"

    def __init__(self):
        KoRxxLanguageRequester.__init__(self)
        koDirSvc = components.classes["@activestate.com/koDirs;1"].\
                    getService(components.interfaces.koIDirs)
        perlAppInfo = components.classes["@activestate.com/koAppInfoEx?app=Perl;1"].\
                   getService(components.interfaces.koIPerlInfoEx)
        perlPath = perlAppInfo.executablePath
        if not perlAppInfo.haveModules(["JSON"]):
            perlInterpreterArgs = ["-I ",
                    self._quoteIfNecessary(os.path.join(koDirSvc.supportDir,
                                                        'rxx', 'perl', 'lib'))]
        else:
            perlInterpreterArgs = []
        rxxEvaluator = os.path.join(koDirSvc.supportDir, 'rxx',
                                    _rxx_evaluator_by_language[self.language.lower()])
        self._evalCommand = " ".join([self._quoteIfNecessary(perlPath)]
                                     + perlInterpreterArgs
                                     + [self._quoteIfNecessary(rxxEvaluator)])
        self._supportedOptions = "imsx"

class KoRxxPHPHandler(KoRxxLanguageRequester):
    _com_interfaces_ = [components.interfaces.koIRxxHandler,
                        components.interfaces.nsIObserver]
    _reg_desc_ = "Rxx PHP Handler"
    _reg_clsid_ = "{f97bf054-3690-4087-be95-186a3b862170}"
    _reg_contractid_ = "@activestate.com/koRxxPHPHandler;1"
    language = "php"

    def __init__(self):
        KoRxxLanguageRequester.__init__(self)
        koDirSvc = components.classes["@activestate.com/koDirs;1"].\
                    getService(components.interfaces.koIDirs)
        phpPath = components.classes["@activestate.com/koAppInfoEx?app=PHP;1"].\
                   getService(components.interfaces.koIPHPInfoEx).cliExecutable
        if not phpPath:
            raise RuntimeError("There is no PHP installed")
            
        rxxEvaluator = os.path.join(koDirSvc.supportDir, 'rxx',
                                    _rxx_evaluator_by_language[self.language.lower()])
        self._evalCommand = " ".join([self._quoteIfNecessary(phpPath),
                                      self._quoteIfNecessary(rxxEvaluator)])
        self._supportedOptions = "imsxu"

class KoRxxRubyHandler(KoRxxLanguageRequester):
    _com_interfaces_ = [components.interfaces.koIRxxHandler,
                        components.interfaces.nsIObserver]
    _reg_desc_ = "Rxx Ruby Handler"
    _reg_clsid_ = "{b275fdea-7078-4092-a8bd-e46411d9939a}"
    _reg_contractid_ = "@activestate.com/koRxxRubyHandler;1"
    language = "ruby"

    def __init__(self):
        KoRxxLanguageRequester.__init__(self)
        koDirSvc = components.classes["@activestate.com/koDirs;1"].\
                    getService(components.interfaces.koIDirs)
        rubyAppInfo = components.classes["@activestate.com/koAppInfoEx?app=Ruby;1"].\
                   getService(components.interfaces.koIAppInfoEx)
        rubyPath = rubyAppInfo.executablePath
        if (not rubyAppInfo.haveModules(["JSON"])
            and not rubyAppInfo.haveModules(["rubygems", "JSON"])):
            rubyInterpreterArgs = ["-I ",
                    self._quoteIfNecessary(os.path.join(koDirSvc.supportDir,
                                                        'rxx', 'ruby', 'lib'))]
        else:
            rubyInterpreterArgs = []
        rxxEvaluator = os.path.join(koDirSvc.supportDir, 'rxx',
                                    _rxx_evaluator_by_language[self.language.lower()])
        self._evalCommand = " ".join([self._quoteIfNecessary(rubyPath)]
                                     + rubyInterpreterArgs
                                     + [self._quoteIfNecessary(rxxEvaluator)])
        self._supportedOptions = "isxu"

class KoRxxTclHandler(KoRxxLanguageRequester):
    _com_interfaces_ = [components.interfaces.koIRxxHandler,
                        components.interfaces.nsIObserver]
    _reg_desc_ = "Rxx Tcl Handler"
    _reg_clsid_ = "{a02dbf2f-488d-408d-803e-4615e3e1c4f1}"
    _reg_contractid_ = "@activestate.com/koRxxTclHandler;1"
    language = "tcl"

    def __init__(self):
        KoRxxLanguageRequester.__init__(self)
        koDirSvc = components.classes["@activestate.com/koDirs;1"].\
                    getService(components.interfaces.koIDirs)
        tclAppInfo = components.classes["@activestate.com/koAppInfoEx?app=Tcl;1"].\
                   getService(components.interfaces.koITclInfoEx)
        tclPath = tclAppInfo.tclsh_path
        rxxEvaluator = os.path.join(koDirSvc.supportDir, 'rxx',
                                    _rxx_evaluator_by_language[self.language.lower()])
        self._evalCommand = (self._quoteIfNecessary(tclPath)
                             + " "
                             + self._quoteIfNecessary(rxxEvaluator))
        self._supportedOptions = "isx"

class KoRxxJavaScriptHandler(KoRxxLanguageRequester):
    _com_interfaces_ = [components.interfaces.koIRxxHandler,
                        components.interfaces.nsIObserver]
    _reg_desc_ = "Rxx JavaScript Handler"
    _reg_clsid_ = "{9b2b9b58-dfaa-4393-a4fd-48451cdf7056}"
    _reg_contractid_ = "@activestate.com/koRxxJavaScriptHandler;1"
    language = "javascript"

    def __init__(self):
        KoRxxLanguageRequester.__init__(self)
        koDirSvc = components.classes["@activestate.com/koDirs;1"].\
                    getService(components.interfaces.koIDirs)
        if sys.platform.startswith("win"):
            jsPath = os.path.join(koDirSvc.mozBinDir, "js.exe")
        else:
            jsPath = os.path.join(koDirSvc.mozBinDir, "js")
        rxxEvaluator = os.path.join(koDirSvc.supportDir, 'rxx',
                                    _rxx_evaluator_by_language[self.language.lower()])
        self._evalCommand = " ".join([self._quoteIfNecessary(jsPath),
                                      self._quoteIfNecessary(rxxEvaluator)])
        self._supportedOptions = "im"

#---- internal support stuff

def _escaped_text_from_text(text, escapes=None):
    r"""Return escaped version of text.

        "text" is the text to escape.
        "escapes" is a mapping of chars in the source text to
            replacement text for each such char. By default this escapes EOL
            chars and tabs to the C-escape equivalents.
    """
    #TODO:
    # - Optionally allow escapes to be a string that identifies some
    #   well-known/popular escape types like: c-string-escapes,
    #   eol-escapes, etc.
    if escapes is None:
        escapes = {'\n':"\\n", '\r':"\\r", '\t':"\\t"}
    if text is None:
        # Bug 88291
        # Can happen on PHP sometimes, with non-ascii input, and no
        # Unicode flag.  For example, utf-8("\xe9") => ["\xc3", "\xa9"].
        # The first char matches \w, but the second doesn't, so a match
        # of \w on \xe9 (e with accent acute) in non-unicode mode will
        # return a split value, which can cause confusion in the Rx UI.
        # Which hopefully will alert eh user that something is wrong, and
        # they'll add the 'u' flag.
        return ""
    escaped = text
    for ch, escape in escapes.items():
        escaped = escaped.replace(ch, escape)
    return escaped
