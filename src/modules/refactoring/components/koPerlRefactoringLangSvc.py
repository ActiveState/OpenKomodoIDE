# Copyright (c) 2000-2013 ActiveState Sofware Inc.
# See the file LICENSE.txt for licensing information.

import re
import logging
import random

from xpcom import components, COMException, ServerException, nsError
from koRefactoringLanguageServiceBase import KoRefactoringLanguageServiceBase, borderEnd, makeRefactoringVariable, RefactoringException
from koLanguageServiceBase import sci_constants

log = logging.getLogger("PerlRefactoringLangSvc")
#log.setLevel(logging.DEBUG)

#---- Constants

_SCE_PL_OPERATOR = sci_constants.SCE_PL_OPERATOR
_SCE_PL_VARIABLE_INDEXER = sci_constants.SCE_PL_VARIABLE_INDEXER
_SCE_PL_SCALAR = sci_constants.SCE_PL_SCALAR
_SCE_PL_ARRAY = sci_constants.SCE_PL_ARRAY
_SCE_PL_HASH = sci_constants.SCE_PL_HASH
_SCE_PL_WORD = sci_constants.SCE_PL_WORD
_SCE_PL_STRING_VAR = sci_constants.SCE_PL_STRING_VAR
_SCE_PL_STRING_QQ_VAR = sci_constants.SCE_PL_STRING_QQ_VAR
_SCE_PL_STRING_QX_VAR = sci_constants.SCE_PL_STRING_QX_VAR
_SCE_PL_BACKTICKS_VAR = sci_constants.SCE_PL_BACKTICKS_VAR
_SCE_PL_HERE_QQ_VAR = sci_constants.SCE_PL_HERE_QQ_VAR
_SCE_PL_HERE_QX_VAR = sci_constants.SCE_PL_HERE_QX_VAR
_SCE_PL_REGEX_VAR = sci_constants.SCE_PL_REGEX_VAR
_SCE_PL_REGSUBST_VAR = sci_constants.SCE_PL_REGSUBST_VAR
_SCE_PL_STRING_QR_VAR = sci_constants.SCE_PL_STRING_QR_VAR

_var_styles = (_SCE_PL_SCALAR, _SCE_PL_ARRAY, _SCE_PL_HASH,
               _SCE_PL_STRING_VAR, _SCE_PL_STRING_QQ_VAR, _SCE_PL_STRING_QX_VAR,
               _SCE_PL_BACKTICKS_VAR, _SCE_PL_HERE_QQ_VAR, _SCE_PL_HERE_QX_VAR,
               _SCE_PL_REGEX_VAR, _SCE_PL_REGSUBST_VAR, _SCE_PL_STRING_QR_VAR)

# Handle parallel assignments.
# False-positive strings/comments?
_re_assignment_follows = re.compile(r'(?:[,\$\@\%\w_\s]*\))?\s*=(?!=)')
_re_adjustment_follows = re.compile(r'\s*[\+\-\/\*\%\|\&\^\.]=')
_re_for_precedes = re.compile(r'for(?:each)?\s+$')

# Local Methods
def _makeVariableMap(inVars, outVars):
    """
    Map @- and %-variable names like @foo to $ref_foo or
    $refN_foo where N is a 5-digit random # to avoid collisions.
    """
    variableMap = {}
    totalVars = inVars + outVars
    for v in totalVars:
        sigil = v[0]
        baseVar = v[1:]
        if sigil != "$":
            totalVars.append("$" + baseVar)
    totalVars = [v for v in totalVars if v[0] == "$"]
    for varName in inVars:
        if varName[0] in "@%":
            baseVarName = varName[1:]
            newVarName = "$ref_" + baseVarName
            for i in range(100):
                if newVarName not in totalVars:
                    break
                newVarName = "$ref%d_%s" % (random.uniform(10000, 100000), baseVarName)
            else:
                raise RefactoringException("Code too complex: can't find a replacement name for var %s", varName)
            # Map @foo => @$ref_foo
            # Map \@foo => $ref_foo
            # Map $foo[ => $ref_foo->[
            variableMap[varName] = varName[0] + newVarName
            variableMap["\\" + varName] = newVarName
            if varName[0] == "@":
                variableMap["$" + baseVarName + "["] = newVarName + "->["
            else:
                variableMap["$" + baseVarName + "{"] = newVarName + "->{"
    return variableMap                    

def _applyVariableMap(codeBlock, variableMap):
    # There are no collisions, so we can apply the changes serially
    for oldName, newName in variableMap.items():
        codeBlock = codeBlock.replace(oldName, newName)
    return codeBlock

class KoPerlRefactoringLanguageService(KoRefactoringLanguageServiceBase):
    language_name = "Perl"
    _com_interfaces_ = [components.interfaces.koIRefactoringLanguageService]
    _reg_clsid_ = "{46746f95-ce88-450c-8a92-a3c59f03149f}"
    _reg_contractid_ = "@activestate.com/koRefactoringLanguageService;1?language=Perl"
    _reg_desc_ = "Komodo %s Refactoring Language Service" % (language_name,)
    
    attributeDelimiters = (("::", sci_constants.SCE_PL_OPERATOR),
                           ("->{", sci_constants.SCE_PL_OPERATOR),
                           ("->", sci_constants.SCE_PL_OPERATOR))
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
        cells = scimoz.getStyledText(0, scimoz.length)
        self.bytes = cells[0::2]
        self.styles = [ord(s) for s in cells[1::2]]
        self.selectionStart = selectionStart
        self.selectionEnd = selectionEnd

        def callback_wrapper(results):
            if isinstance(results, RefactoringException):
                log.exception("categorizeVariables failed (in callback wrapper)")
                lastErrorSvc = (components.classes["@activestate.com/koLastErrorService;1"]
                                .getService(components.interfaces.koILastErrorService));
                lastErrorSvc.setLastError(nsError.NS_ERROR_INVALID_ARG, str(results))
                callback.onGetVariables(None)
            else:
                callback.onGetVariables(results)

        try:
            self.checkStructure(scimoz, selectionStart, selectionEnd)
            selBytes = self.bytes[selectionStart:selectionEnd]
            selStyles = self.styles[selectionStart:selectionEnd]
            self.wordPtns = {}
            words = set()
            # Since Perl variables's sigils change, we need to look at context.
            for m in re.finditer(r'([\$\@\%]\#?)((?:[\w_]+::)?)([\w_]+)', selBytes):
                startPos, endPos = m.span()
                matchedWord = selBytes[startPos:endPos]
                if selStyles[startPos] not in _var_styles:
                    continue
                if m.group(2):
                    # Don't include any variables that contain "::"
                    continue
                varName = m.group(3)
                if not re.compile(r'[a-z]').search(varName):
                    # Don't include special variables
                    continue
                if not self.isTokenType(selStyles[startPos],
                                        selStyles[startPos:endPos]):
                    # Not a variable
                    continue
                varSigil = m.group(1)
                if varSigil == "$#":
                    actualVarName = "@" + varName
                    nextChar = ""
                elif varSigil in "@%":
                    actualVarName = matchedWord
                    nextChar = ""
                else:
                    actualVarName = varSigil + varName
                    nextChar = selBytes[endPos: endPos + 1]
                    if nextChar == '[':
                        actualVarName = '@' + varName
                    elif nextChar == '{':
                        actualVarName = '%' + varName
                    else:
                        actualVarName = matchedWord
                        
                if actualVarName not in words:
                    words.add(actualVarName)
                    self.wordPtns[actualVarName] =  self.getFullSearchTermForVariable(actualVarName, nextChar)
                               
            words = list(words)
            self.determineWordUsage(words, scimoz, koDoc,
                                    selectionStart, selectionEnd, callback_wrapper)
        except RefactoringException as ex:
            log.exception("categorizeVariables failed (in main excception)")
            lastErrorSvc = (components.classes["@activestate.com/koLastErrorService;1"]
                            .getService(components.interfaces.koILastErrorService));
            lastErrorSvc.setLastError(nsError.NS_ERROR_INVALID_ARG, str(ex))
            raise ServerException(nsError.NS_ERROR_INVALID_ARG, str(ex))

    _looper_starts = ('while', 'for', 'until')
    _kwds_of_interest = ('sub', 'while', 'for', 'until', 'return',
                         'last', 'next')
    _open_brace_re = re.compile(r'(.*?)\{', re.DOTALL)
    _kwds_re = re.compile(r'\b(?:' + "|".join(_kwds_of_interest) + r'\b)')
    def _brace_follows_re(self, reducedBytes, endPos):
        # Still a heuristic -- I want a true parser.
        m = self._open_brace_re.match(reducedBytes, endPos)
        if not m:
            return False
        return not self._kwds_re.match(m.group(1))

    def checkStructure(self, scimoz, selectionStart, selectionEnd):
        """        
        The requirements

        1. Code to left or right of selection is OK
        
        2. No net change in brace count, and the count never goes negative
 
        3. No returns, and no break's or continue's outside loops
        """
        # The lineStart and lineEnd attributes aren't used here,
        # but are used in the parent class.
        self.lineStart = scimoz.lineFromPosition(selectionStart)
        self.lineEnd = scimoz.lineFromPosition(selectionEnd)
        if self.lineStart == self.lineEnd:
            # No structural check needed
            return True
        reducedBytes = self.bytes[selectionStart:selectionEnd]
        reducedStyles = self.styles[selectionStart:selectionEnd]
        looper_stack = [{'type':'none', 'count':0}]
        # Watch out for braceless statements
        for m in re.finditer(r'(?:\b(?:'
                             + "|".join(self._kwds_of_interest)
                             + r')\b|[\{\}])',
                             reducedBytes):
            startPos, endPos = m.span()
            matchedWord = reducedBytes[startPos:endPos]
            matchedStyles = reducedStyles[startPos:endPos]
            matchedStyle = reducedStyles[startPos]
            lsTop = looper_stack[-1]
            if matchedStyle == _SCE_PL_OPERATOR:
                if matchedWord == "{":
                    lsTop['count'] += 1
                elif matchedWord == "}":
                    lsTop['count'] -= 1
                    if lsTop['count'] < 0:
                        raise RefactoringException("Selection not fully contained within a block")
                    elif lsTop['count'] == 0 and lsTop['type'] != 'do':
                        looper_stack.pop()
            elif self.isTokenType(_SCE_PL_WORD, matchedStyles):
                if (matchedWord in ('function', 'for', 'while', 'until')
                    and self._brace_follows_re(reducedBytes, endPos)):
                    looper_stack.append({'type': matchedWord, 'count': 0})
                elif matchedWord in ('next', 'last'):
                    if lsTop['type'] not in self._looper_starts:
                        raise RefactoringException("%s in selection not contained in a loop" % matchedWord)
                elif matchedWord == 'return':
                    if lsTop['type'] != 'sub':
                        raise RefactoringException("return in selection not contained in a function")
        #end loop
        # should.(looper_stack == [{'type':'none', 'count':0}]
        if len(looper_stack) > 1 or looper_stack[0]['count'] > 0:
            raise RefactoringException("block ends in middle of brace block")

    _fn_start_re = re.compile(r'(\s*)\bsub\b')
    def extractMethodAux(self, scimoz, selectionStart, selectionEnd,
                         sectionLineStart, targetName,
                         inVars, outVars, firstUseOutVars):
        # For Perl, remove any non-scalar outVars that are also in inVars,
        # As these are passed by reference.
        nonScalarOutvars = [x for x in outVars if x[0] in "@%"]
        if nonScalarOutvars:
            #TODO: These need to be handled as references in the created module.
            raise RefactoringException("ExtractMethod for Perl doesn't yet support handling reinitialized arrays and scalars (for variables %s)" % ([str(x) for x in nonScalarOutvars],))
        # We're mapping all non-scalar vars @foo to $ref_foo or $refN_foo
        # where N is a 5 digit random # if there's already a var in use
        # named $ref_foo
        variableMap = _makeVariableMap(inVars, outVars)
        
        firstLine = scimoz.lineFromPosition(selectionStart)
        leadingWhiteSpace = self._getLeadingWhiteSpace(scimoz, selectionStart)
        blockToMove = scimoz.getTextRange(selectionStart, selectionEnd)
        
        currentHeader = scimoz.getLine(sectionLineStart)[1]
        section_start_func_header_match = self._fn_start_re.match(currentHeader)
        if not section_start_func_header_match:
            # We're probably extracting top-level code
            leadingWhiteSpaceTarget = self._leading_ws_re.match(blockToMove).group(1)
            atTopLevel = True
        else:
            leadingWhiteSpaceTarget = section_start_func_header_match.group(1)
            atTopLevel = False
            
        targetLines = blockToMove.splitlines(True)
        eol = self._eol_re.search(currentHeader).group(1)
        indent = scimoz.indent
        if not indent:
            indent = scimoz.tabWidth # if 0, Scintilla uses tabWidth
        extraIndent = " " * indent
        innerWhiteSpaceTarget = leadingWhiteSpaceTarget + extraIndent

        # In Perl '$self' is conventional, but the object reference
        # can be called anything.
        if re.compile(r'\$self\s*->').search(blockToMove):
            recipient = "$self->"
        else:
            recipient = ""
        def formatInVar(index, inVar, variableMap):
            if inVar[0] == "$":
                return "my %s = $_[%d];" % (inVar, index)
            if inVar[0] not in "%@":
                raise RefactoringException("Unexpected Perl variable %s doesn't start with $, %, or @")
            return "my %s = $_[%d];" % (variableMap["\\" + inVar], index)
                
        
        targetHeader = "%ssub %s {%s" % (
            leadingWhiteSpaceTarget,
            targetName,
            eol,
        )
        targetInVars = [formatInVar(index, inVar, variableMap)
                        for index, inVar in enumerate(inVars)]
        targetInVarsFormatted = "".join(["%s%s%s" % (innerWhiteSpaceTarget,
                                                     formattedInVar, eol)
                                         for formattedInVar in targetInVars])
        
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
                ", ".join([re.sub(r'^[%@]', lambda(m): '\\' + m.group(0), inVar)
                           for inVar in inVars]))
        
        self._checkFirstUseOutVars(outVars, firstUseOutVars, blockToMove)
        if len(outVars) == 0:
            callingLine = "%s;" % (methodCall,)
            trailingLine = ""
        elif len(outVars) == 1:
            trailingLine = "%sreturn %s;%s" % (innerWhiteSpaceTarget,
                                               outVars[0],
                                               eol)
            if firstUseOutVars == outVars:
                callingPrefix = "my "
            else:
                callingPrefix = ""
            callingLine = "%s%s = %s;" % (callingPrefix, outVars[0], methodCall)
        else:
            trailingLine = ("%sreturn (%s);%s" %
                            (innerWhiteSpaceTarget,
                             ", ".join(outVars), eol))
            if firstUseOutVars:
                if sorted(firstUseOutVars) != sorted(outVars):
                    callingPrefix = "my (%s);%s%s" % (", ".join(firstUseOutVars),
                                                      eol,
                                                      leadingWhiteSpace)
                else:
                    callingPrefix = "my "
            else:
                callingPrefix = ""
            callingLine = "%s(%s) = %s;" % (callingPrefix,
                                            ", ".join(outVars),
                                            methodCall)
        
        trailingLine += leadingWhiteSpaceTarget + "}" + eol
        callingLine = leadingWhiteSpace + callingLine
        if re.compile(r'\n\s*\Z').search(blockToMove):
            callingLine += eol
        codeBlock = _applyVariableMap("".join(choppedTargetLines),
                                      variableMap)
        newBlock = (targetHeader
                    + targetInVarsFormatted
                    + codeBlock
                    + eol
                    + trailingLine
                    + eol)
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

    def _checkFirstUseOutVars(self, outVars, firstUseOutVars, blockToMove):
        """
        The var classification scheme doesn't always find which variables we
        need to redeclare, so do that here.
        """
        
        # Check for any vars that are declared in blockToMove
        # that aren't in firstUseOutVars, and add them to be safe.
        for outVar in set(outVars) - set(firstUseOutVars):
            if re.compile(r'\bmy[\$\@\%\s\w,\(]*'
                          + re.escape(outVar)
                          + r'(?![\w\$@%])').search(blockToMove):
                firstUseOutVars.append(outVar)
        if len(firstUseOutVars) == 1:
            if firstUseOutVars[0] != outVars[0]:
                raise RefactoringException("Internal error: outVars[0]: %s, firstUseOutVars[0]:%s", outVars[0], firstUseOutVars[0])

    def findAllHits(self, words, section_start_line, section_end_line, scimoz):
        sec_start_pos = scimoz.positionFromLine(section_start_line)
        sec_end_pos = scimoz.positionFromLine(section_end_line)
        section_bytes = self.bytes[sec_start_pos:sec_end_pos]
        section_styles = self.styles[sec_start_pos:sec_end_pos]
        adjusted_selection_start = self.selectionStart - sec_start_pos
        adjusted_selection_end = self.selectionEnd - sec_start_pos
        word_usage = {}
        
        ptn = ( r'(?:'
               + '|'.join(self.wordPtns.values())
               + ')')
        for m in re.finditer(ptn, section_bytes):
            startPos, endPos = m.span()
            matchedWord = section_bytes[startPos:endPos]
            style = section_styles[startPos]
            if (style not in _var_styles
                or not self.isTokenType(style,
                                        section_styles[startPos:endPos])):
                continue
            if matchedWord[0] == '$':
                if matchedWord[1] == '#':
                    matchedWord = '@' + matchedWord[2:]
                else:
                    nextChar = section_bytes[endPos: endPos+1]
                    if nextChar == '[':
                        matchedWord = '@' + matchedWord[1:]
                    elif nextChar == '{':
                        matchedWord = '%' + matchedWord[1:]
            if matchedWord not in word_usage:
                word_usage[matchedWord] = ((sec_start_pos + startPos) <<
                                       _koIRefactorVariableInfo.NUM_USAGE_BITS);
            # We have a top-level identifier w -- now what are we doing to it?
            flag = 0
            if _re_adjustment_follows.match(section_bytes, endPos):
                if startPos < adjusted_selection_start:
                    flag = (_koIRefactorVariableInfo.DEFINED_BEFORE_SELECTION
                            |_koIRefactorVariableInfo.USED_BEFORE_SELECTION)
                elif startPos < adjusted_selection_end:
                    flag = (_koIRefactorVariableInfo.DEFINED_IN_SELECTION
                            |_koIRefactorVariableInfo.USED_IN_SELECTION)
                else:
                    flag = (_koIRefactorVariableInfo.DEFINED_AFTER_SELECTION
                            |_koIRefactorVariableInfo.USED_AFTER_SELECTION)
            elif (_re_assignment_follows.match(section_bytes, endPos)
                or _re_for_precedes.search(section_bytes, 0, startPos)):
                if startPos < adjusted_selection_start:
                    flag = _koIRefactorVariableInfo.DEFINED_BEFORE_SELECTION
                elif startPos < adjusted_selection_end:
                    flag = _koIRefactorVariableInfo.DEFINED_IN_SELECTION
                else:
                    flag = _koIRefactorVariableInfo.DEFINED_AFTER_SELECTION
            else:
                if startPos < adjusted_selection_start:
                    flag = _koIRefactorVariableInfo.USED_BEFORE_SELECTION
                elif startPos < adjusted_selection_end:
                    flag = _koIRefactorVariableInfo.USED_IN_SELECTION
                else:
                    flag = _koIRefactorVariableInfo.USED_AFTER_SELECTION
            word_usage[matchedWord] |= flag
        try:
            del word_usage["this"]
        except KeyError:
            pass
        for name, val in word_usage.items():
            flag = val & 0xff
            pos = val >> 8
        return [makeRefactoringVariable(word, flags)
                for (word, flags) in sorted(word_usage.items())]
    
    def getFullSearchTermForVariable(self, searchText, nextChar):
        # Similar to getSearchTermForVariable, but here we always want
        # to match the sigil as well as the variable part.
        sigil = searchText[0]
        searchText1 = searchText[1:]
        if (sigil == '$' and nextChar == '[') or sigil == '@':
            adjustedSearchText = ('(?:\\$' + searchText1 + '(?=\\[)'
                                  + '|@' + searchText1
                                  + '\\b|\\$#' + searchText1
                                  + '\\b)')
        elif (sigil == '$' and nextChar == '{') or sigil == '%':
            adjustedSearchText = ('(?:\\$' + searchText1 + '(?=\\{)'
                                  + '|%' + searchText1 + '\\b)')
        elif sigil == '$':
            # Here we let the user change the '$' as well, although this
            # isn't orthogonal to the others.  But if you have an array
            # or hash, you're stuck with the sigils.
            adjustedSearchText = '\\' + searchText + '\\b'
        else:
            raise RefactoringException("internal error: unexpected searchText:%s/nextChar:%s in getFullSearchTermForVariable" % (searchText, nextChar))
        return adjustedSearchText

    
    def getSearchTermForVariable(self, searchText, nextChar):
        # Allow for Perl $/%/@ shenanigans.
        sigil = searchText[0]
        searchText1 = searchText[1:]
        compareText = searchText1
        if (sigil == '$' and nextChar == '[') or sigil == '@':
            adjustedSearchText = ('(?:(?<=\\$)' + searchText1 + '(?=\\[))'
                                  + '|(?<=@)' + searchText1)
        elif (sigil == '$' and nextChar == '{') or sigil == '%':
            adjustedSearchText = ('(?:(?<=\\$)' + searchText1 + '(?=\\{))'
                                  + '|(?<=%)' + searchText1)
        elif sigil == '$':
            # Here we let the user change the '$' as well, although this
            # isn't orthogonal to the others.  But if you have an array
            # or hash, you're stuck with the sigils.
            adjustedSearchText = '\\' + searchText
            compareText = adjustedSearchText
        elif sigil == '*':
            adjustedSearchText = "(?<=[\\$@%\\*])" + searchText1
        elif sigil == '&':
            adjustedSearchText = "(?:\b|(?<=\\&))" + searchText1
        else:
            # It's more like a function name, so don't bother with sigils.
            adjustedSearchText = '(?:^|(?<=[^\\$\\*@%\\w]))' + searchText1
            compareText = searchText
        return borderEnd(adjustedSearchText), compareText

    def acceptHit(self, targetName, context, columnNo, path, lineNo, symbolType,
                  inDefinitionContext):
        '''
        Perl isnt that straightforward for determining
        when a name is an attribute.  Could look for "::" anywhere,
        or "->{" in a method.  No sigils anywhere here.
        '''
               
        beforeText = context[:columnNo]
        afterText = context[columnNo:]
        if ((beforeText.endswith('::')
             or re.compile(r'->\s*(?:\{\s*(?:[\'"]\s*)?)?$').search(beforeText)
             or re.compile(r'\b(?:sub|use|package)\s+$').search(beforeText)
             or re.compile(r'\@ISA\b.*=').search(beforeText))
                and re.compile(r'%s(?=$|\b|[^\w])' % targetName).match(afterText)):
            return True
        log.debug("Not sure if %s in %s|%s in %s/%d is a true hit", targetName, beforeText, afterText, path, lineNo)
        return False
