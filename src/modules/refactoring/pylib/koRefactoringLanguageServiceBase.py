# Copyright (c) 2000-2013 ActiveState Sofware Inc.
# See the file LICENSE.txt for licensing information.

# CITODO: Replace ciBuf functionality in this file

import re
import logging
from xpcom import components, ServerException, nsError
from xpcom.server import UnwrapObject

log = logging.getLogger("RefactoringLanguageServiceBase")
#log.setLevel(logging.DEBUG)

class RefactoringException(Exception):
    pass

class KoRefactoringLanguageServiceBase:
    _com_interfaces_ = [components.interfaces.koIRefactoringLanguageService]
    
    attributeDelimiters = ()
    
    supportsRefactoring = False

    _eol_re = re.compile(r'(\n|\r\n?)') # protected
    _leading_ws_re = re.compile(r'(\s*)')
    _leading_required_ws_re = re.compile(r'(\s+)')

    def __init__(self):
        if self.language_name:
            self.languageObj = (components.classes["@activestate.com/koLanguageRegistryService;1"]
                                .getService(components.interfaces.koILanguageRegistryService)
                                .getLanguage(self.language_name))
        else:
            self.languageObj = None

    _line_matcher_re = re.compile(r'(\s*)(.*?)(\s*)\Z')
    def adjustStartPosition(self, scimoz, pos):
        lineNum = scimoz.lineFromPosition(pos)
        lineStartPos = scimoz.positionFromLine(lineNum)
        selectionColumn = pos - lineStartPos
        if selectionColumn == 0:
            # Don't adjust it, even if it's on an empty line.
            return pos
            
        lineText = scimoz.getLine(lineNum)[1]
        lineMatcher = self._line_matcher_re.match(lineText)
        if not lineMatcher:
            log.debug("Failed to match %r", lineText)
            return pos
        
        if not lineText[:selectionColumn].strip():
            # In leading white-space, move to col 0
            return lineStartPos

        if (lineNum < scimoz.lineCount - 1
            # Do we have a next line to move to?
            and selectionColumn >= (len(lineMatcher.group(1))
                                    + len(lineMatcher.group(2)))):
            # In trailing white-space, move to start of next line
            return scimoz.positionFromLine(lineNum + 1)

        return pos
    
    def adjustEndPosition(self, scimoz, pos):
        lineNum = scimoz.lineFromPosition(pos)
        lineStartPos = scimoz.positionFromLine(lineNum)
        selectionColumn = pos - lineStartPos
        if selectionColumn == 0:
            if lineNum == 0:
                return 0
            # End the selection at the end of the previous line
            return scimoz.getLineEndPosition(lineNum - 1)
        lineText = scimoz.getLine(lineNum)[1]
        lineMatcher = self._line_matcher_re.match(lineText)
        if not lineText[:selectionColumn].strip():
            if lineNum == 0:
                return 0
            # In leading white-space,
            # end the selection at the end of the previous line
            return scimoz.getLineEndPosition(lineNum - 1)

        if selectionColumn >= (len(lineMatcher.group(1))
                               + len(lineMatcher.group(2))):
            # Move to end of the line
            return scimoz.getLineEndPosition(lineNum)

        return pos
            
    def determineWordUsage(self, words, scimoz, koDoc, selectionStart,
                           selectionEnd, callback):
        if not words:
            callback([])
            return
        buf = koDoc.buffer
        language = koDoc.language
        koCodeintel = (components.classes["@activestate.com/koCodeintel;1"]
                                .getService(components.interfaces.koICodeintel))
        # Assert the selection sits completely in a single section
        # Otherwise we would have found a header keyword
        # (like 'def' or 'class' in Python), or other
        # child/parent violations, and would have thrown an exception.

        start_lines = {}
        request = {"id": 0};
        
        def errorCallback(msg):
            callback(RefactoringException(msg))

        def on_get_curr_section():
        # def on_get_curr_section(*args):
        #     log.debug(args)
            line = koCodeintel.getResultFor(request["id"])
            if not line:
                start_lines["curr"] = 1
            else:
                try:
                    start_lines["curr"] = line
                except e:
                    log.warn("Could not convert scope line to `int`: %s", e)
                finally:
                    start_lines["curr"] = 1
            request["id"] = koCodeintel.getNextScopeLine(
                buf,
                self.lineStart,
                language,
                on_get_next_section
            )

        def on_get_next_section():
            line = koCodeintel.getResultFor(request["id"])
            if not line:
                next_section_start_line = scimoz.lineCount
            else:
                next_section_start_line = line
                if next_section_start_line <= start_lines["curr"]:
                    next_section_start_line = scimoz.lineCount
            # Just look at the buffer to find all occurrences of each term
            hits = self.findAllHits(words, start_lines["curr"] - 1,
                                    next_section_start_line, scimoz)
            callback(hits)

        request["id"] = koCodeintel.getCaretScopeLine(
            buf,
            self.lineStart,
            scimoz.currentPos,
            language,
            on_get_curr_section
        )
    
    is_empty_re = re.compile(r'^\s*(?:#.*)?$')
    def extractMethod(self, scimoz, selectionStart, selectionEnd,
                      sectionLineStart, targetName,
                      inVars, outVars, firstUseOutVars):
        """
        Most of the work is done in the language-specific extractMethodAux
        method.  This method handles exceptions.
        """
        try:
            return self.extractMethodAux(scimoz, selectionStart, selectionEnd,
                                         sectionLineStart, targetName,
                                         inVars, outVars, firstUseOutVars)
        except RefactoringException as ex:
            log.exception("extractMethod failed")
            lastErrorSvc = (components.classes["@activestate.com/koLastErrorService;1"]
                            .getService(components.interfaces.koILastErrorService));
            lastErrorSvc.setLastError(nsError.NS_ERROR_INVALID_ARG, str(ex))
            raise ServerException(nsError.NS_ERROR_INVALID_ARG, str(ex))
    
    #protected
    def isKeyword(self, scimoz, styles, startPos, endPos, style):
        return not [x for x in styles[startPos:endPos] if x != style]


    def isTokenType(self, targetStyle, matchedStyles):
        return all([s == targetStyle for s in matchedStyles])
    
    def wordIsAttribute(self, scimoz, pos):
        """
        This needs to be overridden by language-specific language services.
        """
        if not self.attributeDelimiters:
            return False
        # Move to the start of the word
        style = scimoz.getStyleAt(pos)
        while pos > 0:
            prevPos = scimoz.positionBefore(pos)
            if scimoz.getStyleAt(prevPos) != style:
                break
            pos = prevPos
        if pos == 0:
            return False
        # Move to the start of white-space
        defaultStyles = self.languageObj.getNamedStyles("default")
        # Initially, prevPos points at the end of the lexeme
        # before the name, so use it.
        while pos > 0:
            if scimoz.getStyleAt(prevPos) not in defaultStyles:
                break
            prevPos = scimoz.positionBefore(pos)
            pos = prevPos
        if pos == 0:
            return False
        # Return true if we're looking at one of the attribute delimiters
        delimStyle = scimoz.getStyleAt(prevPos)
        for tokenText, tokenStyle in self.attributeDelimiters:
            #XXX Not ready for unicode delimiters
            if (delimStyle == tokenStyle
                and pos >= len(tokenText)
                and scimoz.getTextRange(pos - len(tokenText), pos) == tokenText):
                return True
        return False

    def getSearchTermForVariable(self, searchText, _):
        return '\\b' + searchText + '\\b', searchText

    def categorizeVariables(self, scimoz, koDoc, selectionStart, selectionEnd, callback):
        raise NotImplementedError("categorizeVariables not implemented for "
                                  + self.name)

    def finishExtractingMethod(self, scimoz, selectionStart, selectionEnd,
                               newBlock, callingLine, newBlockTargetPos):
        scimoz.beginUndoAction()
        try:
            scimoz.targetStart = selectionStart
            scimoz.targetEnd = selectionEnd
            scimoz.replaceTarget(len(callingLine), callingLine)
            scimoz.insertText(newBlockTargetPos, newBlock)
        finally:
            scimoz.endUndoAction()
        newBlockLen = len(newBlock)
        return [newBlockTargetPos, newBlockTargetPos + newBlockLen,
                selectionStart + newBlockLen,
                selectionStart + newBlockLen + len(callingLine)]

    _lineMatcher = re.compile(r'(\s*)(.*?)(\s*)$')
    def _getLeadingWhiteSpace(self, scimoz, pos): #protected
        lineNum = scimoz.lineFromPosition(pos)
        lineStartPos = scimoz.positionFromLine(lineNum)
        selectionColumn = pos - lineStartPos
        lineText = scimoz.getLine(lineNum)[1]
        lineMatcher = re.compile(r'(\s*)(.*?)(\s*)$').match(lineText)
        if selectionColumn <= len(lineMatcher.group(1)):
            return lineMatcher.group(1)
        return ""

def getRefactoringLanguageService(languageName):
    try:
        return components.classes["@activestate.com/koRefactoringLanguageService;1?language="
                                 + languageName].\
              getService(components.interfaces.koIRefactoringLanguageService)
    except:
        log.warn("Can't find a refactoring service for %s", languageName)
        return components.classes["@activestate.com/koBaseRefactoringLanguageService;1"].\
              getService(components.interfaces.koIRefactoringLanguageService)


def makeRefactoringVariable(name, flags):
    koIRefactorVariableInfo = components.interfaces.koIRefactorVariableInfo
    rv = components.classes["@activestate.com/koRefactorVariableInfo;1"]\
                .createInstance(koIRefactorVariableInfo)
    UnwrapObject(rv).init(name, flags)
    return rv

def borderStart(ptn):
    c = ptn[0]
    log.debug("borderStart(ptn:%r)", ptn)
    if c.isalnum() or c == "_":
        log.debug("It's alnum|_c")
        return "\\b" + ptn
    else:
        log.debug("It's not alnum|_c")
        return r'(?:^|(?<=\W))' + ptn
    
def borderEnd(ptn):
    c = ptn[-1]
    if c.isalnum() or c == "_":
        return ptn + "\\b"
    else:
        return ptn + r'(?=$|\W)'
