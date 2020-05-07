# Copyright (c) 2000-2013 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import re
import logging

from xpcom import components, COMException, ServerException, nsError
from koRefactoringLanguageServiceBase import KoRefactoringLanguageServiceBase, \
     makeRefactoringVariable, RefactoringException
from koLanguageServiceBase import sci_constants

log = logging.getLogger("JSRefactoringLangSvc")
#log.setLevel(logging.DEBUG)

#---- Constants

_SCE_C_OPERATOR = sci_constants.SCE_C_OPERATOR
_SCE_C_IDENTIFIER = sci_constants.SCE_C_IDENTIFIER
_SCE_C_WORD = sci_constants.SCE_C_WORD

_re_assignment_follows = re.compile(r'(?:[,\s\w]*\])?\s*=(?!=)')
_re_adjustment_follows = re.compile(r'\s*[\+\-\/\*\%\|\&\^\.]=')

class _KoJavaScriptCommonRefactoringLangSvc(KoRefactoringLanguageServiceBase):
    attributeDelimiters = ((".", sci_constants.SCE_C_OPERATOR),)
    supportsRefactoring = True
    
    def __init__(self):
        global _koIRefactorVariableInfo
        KoRefactoringLanguageServiceBase.__init__(self)
        _koIRefactorVariableInfo = components.interfaces.koIRefactorVariableInfo

    _kwds_of_interest = ['function', 'while', 'for', 'do', 'return',
                         'switch', 'break', 'continue']
    _open_brace_re = re.compile(r'(.*?)\{', re.DOTALL)
    _kwds_re = re.compile(r'\b(?:' + "|".join(_kwds_of_interest) + r'\b)')
    def _brace_follows_re(self, reducedBytes, endPos):
        m = self._open_brace_re.match(reducedBytes, endPos)
        if not m:
            return False
        return not self._kwds_re.search(m.group(1))

    def checkStructure(self, scimoz, selBytes, selStyles,
                       selectionStart, selectionEnd):
        """
        Structure Checks:
        
        The requirements

        1. Code to left or right of selection is OK
        
        2. No net change in brace count, and the count never goes negative
 
        3. JS syntax can get so wonky, don't impose any restrictions like
           no breaks/continues outside loops, or no returns.  Let anything
           go, and let the linter show any problems after refactoring

        4. JS in standalone files only (for now).
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
            if matchedStyle == _SCE_C_OPERATOR:
                if matchedWord == "{":
                    lsTop['count'] += 1
                elif matchedWord == "}":
                    lsTop['count'] -= 1
                    if lsTop['count'] < 0:
                        raise RefactoringException("Selection not fully contained within a block")
                    elif lsTop['count'] == 0 and lsTop['type'] not in ('do', 'none'):
                        looper_stack.pop()
            elif self.isTokenType(_SCE_C_WORD, matchedStyles):
                if matchedWord == 'while':
                    if lsTop['type'] == 'do' and lsTop['count'] == 0:
                        looper_stack.pop()
                    elif self._brace_follows_re(reducedBytes, endPos):
                        looper_stack.append({'type': matchedWord, 'count': 0})
                elif (matchedWord in ('function', 'for', 'do', 'switch')
                    and self._brace_follows_re(reducedBytes, endPos)):
                    looper_stack.append({'type': matchedWord, 'count': 0})
                elif matchedWord in ('break', 'continue'):
                    if lsTop['type'] == 'switch' and matchedWord == 'break':
                        pass # ok
                    elif lsTop['type'] in ('while', 'for', 'do'):
                        pass # ok
                    else:
                        raise RefactoringException("%s in selection not contained in a loop" % matchedWord)
                elif matchedWord == 'return':
                    if lsTop['type'] != 'function':
                        raise RefactoringException("return in selection not contained in a function")
        #end loop
        # should.(looper_stack == [{'type':'none', 'count':0}]
        if len(looper_stack) > 1 or looper_stack[0]['count'] > 0:
            raise RefactoringException("block ends in middle of brace block")
            
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
                log.exception("categorizeVariables failed")
                lastErrorSvc = (components.classes["@activestate.com/koLastErrorService;1"]
                                .getService(components.interfaces.koILastErrorService));
                lastErrorSvc.setLastError(nsError.NS_ERROR_INVALID_ARG, str(results))
                callback.onGetVariables(None)
            else:
                callback.onGetVariables(results)

        try:
            selBytes = self.bytes[selectionStart:selectionEnd]
            selStyles = self.styles[selectionStart:selectionEnd]
            self.checkStructure(scimoz, selBytes, selStyles, selectionStart, selectionEnd)
            bytes2 = [b if s == _SCE_C_IDENTIFIER or (s == _SCE_C_OPERATOR and b == '.')
                      else ' '
                  for (b, s) in zip(selBytes, selStyles)]
            # Now remove all the post-period things
            bytes2 = "".join(bytes2)
            bytes3 = re.compile(r'\.[\$\w]+').sub("", bytes2)
            words = set([x for x in re.split(re.compile('\\s+'), bytes3) if x])
            if not words:
                raise RefactoringException("categorize variables: no words matched")
            self.determineWordUsage(words, scimoz, koDoc,
                                    selectionStart, selectionEnd, callback_wrapper)
        except RefactoringException as ex:
            log.exception("categorizeVariables failed")
            lastErrorSvc = (components.classes["@activestate.com/koLastErrorService;1"]
                            .getService(components.interfaces.koILastErrorService));
            lastErrorSvc.setLastError(nsError.NS_ERROR_INVALID_ARG, str(ex))
            raise ServerException(nsError.NS_ERROR_INVALID_ARG, str(ex))

    _fn_start_re = re.compile((r'(\s*)'
                             + r'((?:.*?[\$\w]\s*[:=]\s*)?)'
                             + r'function(\s*(?:[\$\w]+\s*)?\()'
                               ))
    def extractMethodAux(self, scimoz, selectionStart, selectionEnd,
                         sectionLineStart, targetName,
                         inVars, outVars, firstUseOutVars=None):
        leadingWhiteSpace = self._getLeadingWhiteSpace(scimoz, selectionStart)
        blockToMove = scimoz.getTextRange(selectionStart, selectionEnd)
        
        currentHeader = scimoz.getLine(sectionLineStart)[1]
        section_start_func_header_match = self._fn_start_re.match(currentHeader)
        if not section_start_func_header_match:
            atTopLevel = True
            leadingWhiteSpaceTarget = self._leading_ws_re.match(blockToMove).group(1)
            middlePart = ""
            trailingPart = ""
        else:
            atTopLevel = False
            leadingWhiteSpaceTarget = section_start_func_header_match.group(1)
            middlePart = section_start_func_header_match.group(2)
            trailingPart = section_start_func_header_match.group(3)
            
        targetLines = blockToMove.splitlines(True)
        eol = self._eol_re.search(currentHeader).group(1)
        # Should use ciBuf to determine if this code's method is in a class.

        targetParts = [leadingWhiteSpaceTarget]
        recipient = ""
        operatorPart = None
        if not middlePart:
            targetParts += ["function ",
                            targetName]
        else:
            prePart, operatorPart, postPart = \
                     re.compile(r'(.*?)([:=])(.*)').match(middlePart).groups()
            m = re.compile(r'(.+?)((?:\.[\$\w]+)?)(\s*)\Z').match(prePart)
            if not m:
                raise RefactoringException("Couldn't match header start in " + prePart)
            # Replace the dotted part
            if m.group(2):
                recipient = "this."
                targetParts.append(m.group(1))
                targetParts.append('.')
            elif operatorPart == ":":
                 recipient = "this."
            targetParts.append(targetName)
            targetParts.append(m.group(3))
            targetParts.append(operatorPart)
            targetParts.append(postPart)
            targetParts.append("function")
            m = re.compile(r'(\s*)([\$\w]+)(\s*)\(').match(trailingPart)
            if m:
                targetParts.append(m.group(1))
                if m.group(2):
                    targetParts.append(targetName)
                targetParts.append(m.group(3))
                    
        targetParts += ["(",
                        ", ".join(inVars),
                        ") {",
                        eol]
        targetHeader = "".join(targetParts)
        targetFooter = leadingWhiteSpaceTarget + "}" + eol
        
        indent = scimoz.indent
        if not indent:
            indent = scimoz.tabWidth # if 0, Scintilla uses tabWidth
        innerWhiteSpaceTarget = leadingWhiteSpaceTarget + " " * indent
        choppedTargetLines = []
        postLWSPosn = len(leadingWhiteSpace)
        #TODO: Allow the first line to start in the middle of text.
        for lineNo, lineText in enumerate(targetLines):
            if (leadingWhiteSpace
                and not lineText.startswith(leadingWhiteSpace)
                and not self.is_empty_re.match(lineText)):
                log.error("can't find %r at start of line %d %r",
                          leadingWhiteSpace, lineNo, lineText)
                raise RefactoringException("can't find %r at start of line %d %r" %
                        (leadingWhiteSpace, lineNo, lineText))
            choppedTargetLines.append(innerWhiteSpaceTarget + lineText[postLWSPosn:])
            
        methodCall = "%s%s(%s)" % (recipient, targetName,
                                   ", ".join(inVars))
        if outVars:
            #TODO: Need to declare any vars that are not defined before the
            # selection.  Add varsToDeclare to the function params
            if len(outVars) == 1:
                trailingLineParts = [innerWhiteSpaceTarget,
                                     "return ",
                                     outVars[0],
                                     ";",
                                     eol
                                     ]
                callingLine = "%s = %s;" % (outVars[0], methodCall)
            else:
                trailingLineParts = [innerWhiteSpaceTarget,
                                     "return [",
                                     ", ".join(outVars),
                                     "];",
                                     eol
                                     ]
                callingLine = "[%s] = %s;" % (", ".join(outVars),
                                                  methodCall)
            # Heuristic: find any of the outVars that are defined in
            # blockToMove.  If they're declared with either a var or a let,
            # redeclare them here.
            varsToRedeclare = { "let":[], "var":[] }
            for outVar in outVars:
                # Lazy way: allow for comma-separated multiple declarations,
                # but assume ';' is outside a string or comment
                declPtn = re.compile(r'\b(let|var)\s*[^;]*[^\w\$;]'
                                     # js vars can contain '$'
                                     + re.escape(outVar) 
                                     + r'(?![\w\$])')
                m = declPtn.search(blockToMove)
                if m:
                    varsToRedeclare[m.group(1)].append(outVar)
            callingLines = []
            if varsToRedeclare["let"]:
                callingLines.append("let " + ", ".join(varsToRedeclare["let"])
                                    + ";")
            if varsToRedeclare["var"]:
                callingLines.append("var " + ", ".join(varsToRedeclare["var"])
                                    + ";")
            if callingLines:
                callingLines.append(callingLine)
                callingLine = (leadingWhiteSpace
                               + (eol + leadingWhiteSpace).join(callingLines))
            else:
                callingLine = leadingWhiteSpace + callingLine
        else:
            trailingLineParts = []
            callingLine = leadingWhiteSpace + methodCall + ";"
        trailingLineParts += [leadingWhiteSpaceTarget, "}"]
        if operatorPart == ":":
            trailingLineParts.append(",")
        trailingLineParts.append(eol)
        if re.compile(r'\n\s*\Z').search(blockToMove):
            callingLine += eol
        
        newBlock = targetHeader + "".join(choppedTargetLines) + eol + "".join(trailingLineParts) + eol
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
        m = re.compile(r'(.*?function\s*(?:[\$\w]+\s*)?\()(.*?)\)\s*\{', re.DOTALL).search(section_bytes)
        if m:
            param_bytes = m.group(2)
            def_offset = len(m.group(1))
            for m2 in re.finditer(r'([\$\w]+)', param_bytes):
                startPos, endPos = m2.span()
                matchedWord = param_bytes[startPos:endPos]
                if matchedWord in words:
                    posPart = ((def_offset + sec_start_pos + startPos) <<
                               _koIRefactorVariableInfo.NUM_USAGE_BITS);
                    word_usage[m2.group(0)] = posPart | _koIRefactorVariableInfo.DEFINED_BEFORE_SELECTION

            full_def_offset = len(m.group(0))
            section_bytes = section_bytes[full_def_offset:]
            section_styles = section_styles[full_def_offset:]
            adjusted_selection_start -= full_def_offset
            adjusted_selection_end -= full_def_offset
            sec_start_pos += full_def_offset
            
        ptn = (r'(?<![\w\$])(?:'
               + "|".join([re.escape(word) for word in words])
               + ")(?:$|(?=[^\w\$]))")
        for m in re.finditer(ptn, section_bytes):
            startPos, endPos = m.span()
            matchedWord = section_bytes[startPos:endPos]
            if not self.isTokenType(_SCE_C_IDENTIFIER,
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
            del word_usage["this"]
        except KeyError:
            pass
        return [makeRefactoringVariable(word, flags)
                for (word, flags) in sorted(word_usage.items())]

    def getSearchTermForVariable(self, searchText, _):
        # '$' is a valid identifier char in JS, means nothing
        searchTextSubDollar = searchText.replace('$', '\\$')
        adjustedSearchText = ('(?:^|(?<=[^\\w\\$]))'
                              + searchTextSubDollar
                              + '(?=$|[^\\w\\$])')
        return adjustedSearchText, searchTextSubDollar

    def acceptHit(self, targetName, context, columnNo, path, lineNo, symobleType,
                  inDefinitionContext):
        '''
        About all we can do in JS is either look for a '.', or assume we\'re
        in definition context.
        '''
        beforeText = context[:columnNo]
        afterText = context[columnNo:]
        if (re.compile(r'%s(?:\b|$|[^\w\$])' % re.escape(targetName)).match(afterText)
                 and (inDefinitionContext or beforeText.endswith('.'))):
            # No need to check for further qualification, just accept it.
            return True
        log.debug("Not sure if %s in %s|%s in %s/%d is a true hit", targetName, beforeText, afterText, path, lineNo)
        return False

class KoJavaScriptRefactoringLanguageService(_KoJavaScriptCommonRefactoringLangSvc):
    language_name = "JavaScript"
    _com_interfaces_ = [components.interfaces.koIRefactoringLanguageService]
    _reg_clsid_ = "{326cac86-2cf0-401d-b225-09eb2c6a20aa}"
    _reg_contractid_ = "@activestate.com/koRefactoringLanguageService;1?language=JavaScript"
    _reg_desc_ = "Komodo %s Refactoring Language Service" % (language_name,)

class KoNodeJSRefactoringLanguageService(_KoJavaScriptCommonRefactoringLangSvc):
    language_name = "Node.js"
    _com_interfaces_ = [components.interfaces.koIRefactoringLanguageService]
    _reg_clsid_ = "{28bb9c50-ba9f-468e-a25e-356bdb118797}"
    _reg_contractid_ = "@activestate.com/koRefactoringLanguageService;1?language=Node.js"
    _reg_desc_ = "Komodo %s Refactoring Language Service" % (language_name,)
    
