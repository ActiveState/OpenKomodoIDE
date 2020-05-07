# Copyright (c) 2000-2013 ActiveState Sofware Inc.
# See the file LICENSE.txt for licensing information.

"""KoPHPRefactoringLangSvc - ..."""

import re
import logging

from xpcom import components, COMException, ServerException, nsError
from koRefactoringLanguageServiceBase import KoRefactoringLanguageServiceBase, \
     borderEnd, makeRefactoringVariable, RefactoringException
from koLanguageServiceBase import sci_constants

log = logging.getLogger("PHPRefactoringLangSvc")
#log.setLevel(logging.DEBUG)

_SCE_UDL_SSL_DEFAULT = sci_constants.SCE_UDL_SSL_DEFAULT
_SCE_UDL_SSL_OPERATOR = sci_constants.SCE_UDL_SSL_OPERATOR
_SCE_UDL_SSL_VARIABLE = sci_constants.SCE_UDL_SSL_VARIABLE
_SCE_UDL_SSL_WORD = sci_constants.SCE_UDL_SSL_WORD
_SCE_UDL_SSL_MIN = sci_constants.SCE_UDL_SSL_DEFAULT
_SCE_UDL_SSL_MAX = sci_constants.SCE_UDL_SSL_VARIABLE

_re_assignment_follows = re.compile(r'(?:[,\s\$\w]*\))?\s*=(?!=)')
_re_adjustment_follows = re.compile(r'\s*[\+\-\/\*\%\|\&\^\.]=')

class KoPHPRefactoringLanguageService(KoRefactoringLanguageServiceBase):
    language_name = "PHP"
    _com_interfaces_ = [components.interfaces.koIRefactoringLanguageService]
    _reg_clsid_ = "{e6f03075-123e-4152-bee9-f932fe82371a}"
    _reg_contractid_ = "@activestate.com/koRefactoringLanguageService;1?language=PHP"
    _reg_desc_ = "Komodo %s Refactoring Language Service" % (language_name,)
    
    attributeDelimiters = (("::", sci_constants.SCE_UDL_SSL_OPERATOR),
                           ("->", sci_constants.SCE_UDL_SSL_OPERATOR),
                           ("\\", sci_constants.SCE_UDL_SSL_OPERATOR))
    supportsRefactoring = True
    
    def __init__(self):
        global _koIRefactorVariableInfo
        KoRefactoringLanguageServiceBase.__init__(self)
        _koIRefactorVariableInfo = components.interfaces.koIRefactorVariableInfo

    def categorizeVariables(self, scimoz, koDoc, selectionStart, selectionEnd,
                            callback):
        """
        This is expensive code, as it gets the styled text of the
        full buffer to figure out what to do.

        The structural check part has to do the same thing as well, so
        we'll just do it in one shot.
        """

        def callback_wrapper(results):
            if isinstance(results, RefactoringException):
                log.exception("categorizeVariables failed")
                lastErrorSvc = (components.classes["@activestate.com/koLastErrorService;1"]
                                .getService(components.interfaces.koILastErrorService));
                lastErrorSvc.setLastError(nsError.NS_ERROR_INVALID_ARG, str(results))
                callback.onGetVariables(None)
            else:
                callback.onGetVariables(results)

        cells = scimoz.getStyledText(0, scimoz.length)
        self.bytes = cells[0::2]
        self.styles = [ord(s) for s in cells[1::2]]
        self.selectionStart = selectionStart
        self.selectionEnd = selectionEnd
        try:
            self.checkStructure(scimoz, selectionStart, selectionEnd)
        except RefactoringException as ex:
            log.debug("categorize variables: failed: %s", ex)
            lastErrorSvc = (components.classes["@activestate.com/koLastErrorService;1"]
                            .getService(components.interfaces.koILastErrorService));
            lastErrorSvc.setLastError(nsError.NS_ERROR_INVALID_ARG, str(ex))
            raise ServerException(nsError.NS_ERROR_INVALID_ARG, str(ex))
        
        words = self._getSelectedWords()
        self.determineWordUsage(words, scimoz, koDoc,
                                selectionStart, selectionEnd, callback_wrapper)

    _alt_start_keywords = ['if', 'while', 'for', 'foreach', 'switch']
    _alt_end_keywords = ['endif', 'endwhile', 'endfor', 'endforeach', 'endswitch']
    _looper_starts = ['while', 'for', 'foreach', 'do']
    def checkStructure(self, scimoz, selectionStart, selectionEnd):
        """
        Structure Checks:

        * One challenge in PHP is that it has an alternative syntax
        * for control structures:
        * e.g. if (test):
        *      # ...
        *      endif;
        * instead of braces.
        *
        
        The requirements

        1. Code to left or right of selection is OK
        
        2. No net change in brace count, and the count never goes negative

        3. No net change in alt-keyword change, and the count never goes -

        4. All selected code is PHP -- no other languages.
 
        5. No returns, and no break's or continue's outside loops
        """
        
        # The lineStart and lineEnd attributes aren't used here,
        # but are used in the parent class.
        self.lineStart = scimoz.lineFromPosition(selectionStart)
        self.lineEnd = scimoz.lineFromPosition(selectionEnd)
        self.tokens = self._getTokens(self.selectionStart, self.selectionEnd)
        parenCount = 0
        braceCount = 0
        altKeywordCount = 0
        pendingAltKeyword = False
        looperKeywordValue = 0
        looper_stack = []
        looper_count = 0
        for style, text in self.tokens:
            if style < _SCE_UDL_SSL_MIN or style > _SCE_UDL_SSL_MAX:
                raise RefactoringException("non-PHP code in selection")
            if style == _SCE_UDL_SSL_OPERATOR:
                if text == "{":
                    braceCount += 1
                    pendingAltKeyword = False
                    looper_stack.append(looperKeywordValue)
                    looper_count += looperKeywordValue
                    looperKeywordValue = 0
                elif text == "}":
                    if braceCount <= 0:
                        raise RefactoringException("Selection not fully contained within a block")
                    braceCount -= 1
                    if looper_stack.pop():
                        looper_count -= 1
                elif text == ":":
                    if pendingAltKeyword:
                        altKeywordCount += 1
                        pendingAltKeyword = False
                        looper_stack.append(looperKeywordValue)
                        looperKeywordValue = 0
                elif text == "(":
                    if pendingAltKeyword:
                        parenCount += 1
                elif text == ")":
                    if pendingAltKeyword:
                        if parenCount <= 0:
                            raise RefactoringException("block starts with too many close-parens")
                        parenCount -= 1
                elif parenCount == 0:
                    pendingAltKeyword = False
            elif style == _SCE_UDL_SSL_WORD:
                textLower = text.lower()
                if textLower in self._alt_start_keywords:
                    pendingAltKeyword = True
                elif textLower in self._alt_end_keywords:
                    if altKeywordCount <= 0:
                        raise RefactoringException("block starts before selection (alt control structure syntax)")
                    altKeywordCount -= 1
                if textLower in self._looper_starts:
                    looperKeywordValue = 1
                if textLower in ('function', 'class'):
                    raise RefactoringException("Only statements can be extracted")
                elif textLower == 'return':
                    raise RefactoringException("Can't extract return statements")
                elif textLower in ('break', 'continue') and looperKeywordValue == 0:
                    raise RefactoringException("Can't extract %s statements outside a loop" % text)
            elif (style == _SCE_UDL_SSL_DEFAULT and '\n' in text
                  and parenCount == 0):
                pendingAltKeyword = False
        if braceCount > 0:
            raise RefactoringException("block ends in middle of brace block")
        elif parenCount > 0:
            raise RefactoringException("block ends in middle of parentheses")
        elif altKeywordCount > 0:
            raise RefactoringException("block ends in middle of alt-syntax block")
                
        #log.debug("tokens: %s", self.tokens)


    _fn_start_re = re.compile(r'(\s*)(?:(?:public|private|protected|final)\s+)?(?:static\s+)?function\b')
    def extractMethodAux(self, scimoz, selectionStart, selectionEnd,
                         sectionLineStart, targetName,
                         inVars, outVars, firstUseOutVars=None):
        firstLine = scimoz.lineFromPosition(selectionStart)
        leadingWhiteSpace = self._getLeadingWhiteSpace(scimoz, selectionStart)
        blockToMove = scimoz.getTextRange(selectionStart, selectionEnd)
        
        currentHeader = scimoz.getLine(sectionLineStart)[1]
        section_start_func_header_match = self._fn_start_re.match(currentHeader)
        if not section_start_func_header_match:
            atTopLevel = True
            leadingWhiteSpaceTarget = self._leading_ws_re.match(blockToMove).group(1)
        else:
            atTopLevel = False
            leadingWhiteSpaceTarget = section_start_func_header_match.group(1)
        targetLines = blockToMove.splitlines(True)
        eol = self._eol_re.search(currentHeader).group(1)
        # Should use ciBuf to determine if this code's method is in a class.
        if re.compile(r'\$this\s*->').search(blockToMove):
            recipient = "$this->"
            scopeQualifier = "private "
        else:
            recipient = ""
            scopeQualifier = ""
        targetHeader = "%s%sfunction %s(%s) {%s" % (
            leadingWhiteSpaceTarget,
            scopeQualifier,
            targetName,
            ", ".join(inVars),
            eol
        )
        targetFooter = leadingWhiteSpaceTarget + "}" + eol
        indent = scimoz.indent
        if not indent:
            indent = scimoz.tabWidth # if 0, Scintilla uses tabWidth
        extraIndent = " " * indent
        innerWhiteSpaceTarget = leadingWhiteSpaceTarget + extraIndent
        #TODO: Allow the first line to start in the middle of text.
        if atTopLevel:
            choppedTargetLines = [extraIndent + lineText for lineText in targetLines]
        else:
            choppedTargetLines = []
            postLWSPosn = len(leadingWhiteSpace)
            for lineText in targetLines:
                if (leadingWhiteSpace
                    and not lineText.startswith(leadingWhiteSpace)
                    and not self.is_empty_re.match(lineText)):
                    choppedTargetLines.append(lineText)
                else:
                    choppedTargetLines.append(innerWhiteSpaceTarget + lineText[postLWSPosn:])
            
        methodCall = "%s%s(%s)" % (recipient, targetName,
                                   ", ".join(inVars))
        if outVars:
            if len(outVars) == 1:
                trailingLine = "%sreturn %s;%s" % (innerWhiteSpaceTarget,
                                                  outVars[0],
                                                  eol)
                callingLine = "%s = %s;" % (outVars[0], methodCall)
            else:
                trailingLine = ("%sreturn array(%s);%s" %
                                (innerWhiteSpaceTarget,
                                 ", ".join(outVars), eol))
                callingLine = "list(%s) = %s;" % (", ".join(outVars),
                                                  methodCall)
        else:
            trailingLine = ""
            callingLine = methodCall + ";"
        trailingLine += leadingWhiteSpaceTarget + "}" + eol
        callingLine = leadingWhiteSpace + callingLine
        if re.compile(r'\n\s*\Z').search(blockToMove):
            callingLine += eol
        
        newBlock = targetHeader + "".join(choppedTargetLines) + eol + trailingLine + eol
        if sectionLineStart == 0 and atTopLevel:
            # Walk back from lineStart looking for a line that has no
            # leading white-space
            for candidateLineNum in range(firstLine, 0, -1):
                if not self._leading_required_ws_re.match(scimoz.getLine(candidateLineNum)[1]):
                    sectionLineStart = candidateLineNum
                    break
        newBlockTargetPos = scimoz.positionFromLine(sectionLineStart)
        return self.finishExtractingMethod(scimoz, selectionStart, selectionEnd,
                                           newBlock, callingLine,
                                           newBlockTargetPos)

    def findAllHits(self, words, section_start_line, section_end_line, scimoz):
        sec_start_pos = scimoz.positionFromLine(section_start_line)
        sec_end_pos = scimoz.positionFromLine(section_end_line)
        section_bytes = self.bytes[sec_start_pos:sec_end_pos]
        section_styles = self.styles[sec_start_pos:sec_end_pos]
        adjusted_selection_start = self.selectionStart - sec_start_pos
        adjusted_selection_end = self.selectionEnd - sec_start_pos
        word_usage = {}
        
        # First look at the params
        # Ignore comments for now
        m = re.compile(r'([\s\w]*?function\s+\w+\s*\()(.*?)\)\s*\{', re.DOTALL).match(section_bytes)
        if m:
            def_offset = len(m.group(1))
            for m2 in re.finditer(r'\$\w+', m.group(2)):
                startPos, endPos = m2.span()
                posPart = ((def_offset + sec_start_pos + startPos) <<
                           _koIRefactorVariableInfo.NUM_USAGE_BITS);
                word_usage[m2.group(0)] = posPart | _koIRefactorVariableInfo.DEFINED_BEFORE_SELECTION

            full_def_offset = len(m.group(0))
            section_bytes = section_bytes[full_def_offset:]
            section_styles = section_styles[full_def_offset:]
            adjusted_selection_start -= full_def_offset
            adjusted_selection_end -= full_def_offset
            sec_start_pos += full_def_offset
            
        ptn = (r'(?:'
               + "|".join([re.escape(word) for word in words])
               + ")")
        for m in re.finditer(ptn, section_bytes):
            startPos, endPos = m.span()
            matchedWord = section_bytes[startPos:endPos]
            if not self.isTokenType(_SCE_UDL_SSL_VARIABLE,
                                    section_styles[startPos:endPos]):
                continue
            if matchedWord not in word_usage:
                word_usage[matchedWord] = ((sec_start_pos + startPos) <<
                                       _koIRefactorVariableInfo.NUM_USAGE_BITS);
            # We have a top-level identifier w -- now what are we doing to it?
            flag = 0
            if _re_assignment_follows.match(section_bytes, endPos):
                if startPos < adjusted_selection_start:
                    flag = _koIRefactorVariableInfo.DEFINED_BEFORE_SELECTION
                elif startPos < adjusted_selection_end:
                    flag = _koIRefactorVariableInfo.DEFINED_IN_SELECTION
                else:
                    flag = _koIRefactorVariableInfo.DEFINED_AFTER_SELECTION
            elif _re_adjustment_follows.match(section_bytes, endPos):
                if startPos < adjusted_selection_start:
                    flag = (_koIRefactorVariableInfo.DEFINED_BEFORE_SELECTION
                            |_koIRefactorVariableInfo.USED_BEFORE_SELECTION)
                elif startPos < adjusted_selection_end:
                    flag = (_koIRefactorVariableInfo.DEFINED_IN_SELECTION
                            |_koIRefactorVariableInfo.USED_IN_SELECTION)
                else:
                    flag = (_koIRefactorVariableInfo.DEFINED_AFTER_SELECTION
                            |_koIRefactorVariableInfo.USED_AFTER_SELECTION)
            else:
                if startPos < adjusted_selection_start:
                    flag = _koIRefactorVariableInfo.USED_BEFORE_SELECTION
                elif startPos < adjusted_selection_end:
                    flag = _koIRefactorVariableInfo.USED_IN_SELECTION
                else:
                    flag = _koIRefactorVariableInfo.USED_AFTER_SELECTION
            word_usage[matchedWord] |= flag

        try:
            del word_usage["$this"]
        except KeyError:
            pass
        return [makeRefactoringVariable(word, flags)
                for (word, flags) in sorted(word_usage.items())]

    def getSearchTermForVariable(self, searchText, _):
        if searchText[0] == '$':
            baseSearchText = searchText[1:]
        else:
            baseSearchText = searchText
        adjustedSearchText = '(?:^|\\$|(?=<\\W))' + baseSearchText
        # Sometimes PHP get-defn drops the '$'
        compareText = '\\$?' + baseSearchText
        return borderEnd(adjustedSearchText), compareText
    
    def _getSelectedWords(self):
        words = set()
        for style, text in self.tokens:
            if style == _SCE_UDL_SSL_VARIABLE:
                words.add(text)
        return list(words)

    def _getTokens(self, selectionStart, selectionEnd):
        tokens = []
        if selectionStart == selectionEnd:
            return tokens
        reducedBytes = self.bytes[selectionStart:selectionEnd]
        reducedStyles = self.styles[selectionStart:selectionEnd]
        lim = len(reducedBytes)
        # Don't do compound operator tokens.  If we need to know about
        # things like '+=' we'll have to parse lists of tokens.
        style = reducedStyles[0]
        c = reducedBytes[0]
        if style == _SCE_UDL_SSL_OPERATOR:
            tokens.append((style, c))
            style = -1
        else:
            s = [c]
        for idx in range(1, lim):
            newStyle = reducedStyles[idx]
            c = reducedBytes[idx]
            if newStyle == style:
                s.append(c)
            else:
                if style != -1:
                    tokens.append((style, "".join(s)))
                if newStyle == _SCE_UDL_SSL_OPERATOR:
                    tokens.append((newStyle, c))
                    style = -1
                else:
                    s = [c]
                    style = newStyle
        if style != -1:
            tokens.append((style, "".join(s)))
        return tokens

    def acceptHit(self, targetName, context, columnNo, path, lineNo, symbolType,
                  inDefinitionContext):
        '''
        For PHP, allow -> before the name, or a definition context
        '''
               
        beforeText = context[:columnNo]
        afterText = context[columnNo:]
        if (re.compile(r'%s\b' % targetName).match(afterText)
            and (inDefinitionContext
                 or beforeText.endswith("$")
                 or re.compile(r'->\s*$').search(beforeText))):
            return True
        log.debug("Not sure if %s in %s|%s in %s/%d is a true hit", targetName, beforeText, afterText, path, lineNo)
        return False
