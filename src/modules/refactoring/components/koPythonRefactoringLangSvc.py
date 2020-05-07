# Copyright (c) 2000-2013 ActiveState Sofware Inc.
# See the file LICENSE.txt for licensing information.

import re
import logging

from xpcom import components, COMException, ServerException, nsError
from koRefactoringLanguageServiceBase import KoRefactoringLanguageServiceBase, \
         makeRefactoringVariable, RefactoringException
from koLanguageServiceBase import sci_constants

log = logging.getLogger("PythonRefactoringLangSvc")
#log.setLevel(logging.DEBUG)

#---- Constants

_SCE_P_OPERATOR = sci_constants.SCE_P_OPERATOR
_SCE_P_IDENTIFIER = sci_constants.SCE_P_IDENTIFIER
_SCE_P_WORD = sci_constants.SCE_P_WORD


_re_assignment_follows = re.compile(r'\s*(?:,[,\s\w]*)?=(?!=)|\s*[\+\-\/\*\%\|\&\^]=')

#---- Private helper functions

def _getLevel(scimoz, lineNum):
    return (scimoz.getFoldLevel(lineNum) & ~(scimoz.SC_FOLDLEVELBASE
                                             |scimoz.SC_FOLDLEVELWHITEFLAG
                                             |scimoz.SC_FOLDLEVELHEADERFLAG))
_koIRefactorVariableInfo = None

class _KoPythonCommonRefactoringLangSvc(KoRefactoringLanguageServiceBase):
    
    attributeDelimiters = ((".", _SCE_P_OPERATOR),)
    supportsRefactoring = True
    def __init__(self):
        global _koIRefactorVariableInfo
        KoRefactoringLanguageServiceBase.__init__(self)
        _koIRefactorVariableInfo = components.interfaces.koIRefactorVariableInfo

    def checkStructure(self, scimoz, selectionStart, selectionEnd):
        """
        Structure Checks:
        #1: No -- Text to left of selectionStart on same line
        #2: No -- Text to right of selectionEnd on same line
        #3: No -- selection starts with last part of child
           A
        ...
        B1

        #4: No -- child is cut off
        H:
           B1
        -------
           B2

        #4b: Variation on #2
        H:
           B
        -------
              C



        If the selected block contains a return, return false, unless
        the return is in a fully contained def.
        
        If the selected block contains a break or continue but not the
        fully containing while block, return false.
        """
        self.lineStart = scimoz.lineFromPosition(selectionStart)
        self.lineEnd = scimoz.lineFromPosition(selectionEnd)
        if self.lineStart == self.lineEnd:
            # No structural check needed
            return True
        
        # Just pull it all down
        lines = self.bytes.splitlines(True)
        first_word_re = re.compile(r'^\s*(\w+)')

        def isEmptyLine(lineNum):
            if not lineNum in lines:
                return False
            return self.is_empty_re.match(lines[lineNum])

        # Check #1: text to left of selection
        leftOfSelection = lines[self.lineStart][:selectionStart - scimoz.positionFromLine(self.lineStart)]
        if not self.is_empty_re.match(leftOfSelection):
            raise RefactoringException("significant text to left of selection")
        
        # Check #2: text to right of selection
        rightOfSelection = lines[self.lineEnd][selectionEnd - scimoz.positionFromLine(self.lineEnd):]
        if not self.is_empty_re.match(rightOfSelection):
            raise RefactoringException("significant text to right of selection")
        # The Python lexer sets SC_FOLDLEVELWHITEFLAG only for foldCompact
        # so we need to analyze the info
        for i in range(self.lineStart, self.lineEnd + 1):
            if not isEmptyLine(i):
                lineStartActual = i
                break
        else:
            raise RefactoringException("no code lines in this block")

        headerLineStartLevel = _getLevel(scimoz, lineStartActual)

        numLines = scimoz.lineCount
        if headerLineStartLevel > 0:
            # Check #3: selection starts with child, continues with parent
            for i in range(lineStartActual + 1, self.lineEnd + 1):
                if isEmptyLine(i):
                    continue
                if _getLevel(scimoz, i) < headerLineStartLevel:
                    raise RefactoringException("Block starts with a child of a later parent line")
    
            # Check #4: make sure there are no lines after the selection
            # that are a child of the header
            for i in range(self.lineEnd + 1, numLines):
                if isEmptyLine(i):
                    continue
                level = _getLevel(scimoz, i)
                if level <= headerLineStartLevel:
                    break
                if level > headerLineStartLevel:
                    raise RefactoringException("Block does not contain all children of line %d" % (lineStartActual + 1,))

        # That's it for the structural parts.  Now look at the text
        
        reducedBytes = self.bytes[selectionStart:selectionEnd]
        reducedStyles = self.styles[selectionStart:selectionEnd]

        # Make sure any return is contained in a def,
        # and break/continue is contained in a while
        # If we have a def or class, there's obviously no method to extract
        for m in re.finditer(r'\b(?:def|class|return|break|continue)\b',
                             reducedBytes):
            startPos, endPos = m.span()
            matchedWord = reducedBytes[startPos:endPos]
            if not self.isKeyword(scimoz, reducedStyles, startPos, endPos,
                                  _SCE_P_WORD):
                log.debug("Skip word#1 %s at pos %d:%d -- styles:%s",
                          matchedWord, startPos, endPos,
                          reducedStyles[startPos:endPos])
                continue
            if matchedWord in ('def', 'class'):
                #XXX: Allow the 'def' if it's a child of the first actual line
                # Because we allow these things to nest.
                raise RefactoringException("Can't extract lines containing %s" % matchedWord)
                
            if matchedWord == "return":
                containingKeyword = 'def'
            else:
                containingKeyword = 'while'
            targetPtn = r'\b' + containingKeyword + r'\b'
            # Make sure it's inside a def
            for m2 in re.finditer(targetPtn, reducedBytes[:startPos]):
                startPos, endPos = m2.span()
                if self.isKeyword(scimoz, reducedStyles, startPos, endPos,
                                  _SCE_P_WORD):
                    # Found it (most of the time)
                    #XXX: Check line levels to make sure it's earlier
                    break
            else:
                raise RefactoringException("Found a %s not contained in a %s" %
                                           (matchedWord, containingKeyword))

        # Check for try/except/finally  cut off
        # or even something with else split in two
        topLines = []
        topKeywords = ('try', 'for', 'while', 'if')
        continuationKeywords = ('except', 'finally', 'else', 'elif')
        for m in re.finditer('\\b(?:'
                             + "|".join(topKeywords + continuationKeywords)
                             + ')\\b', reducedBytes):
            startPos, endPos = m.span()
            matchedWord = reducedBytes[startPos:endPos]
            if not self.isKeyword(scimoz, reducedStyles, startPos, endPos,
                                  _SCE_P_WORD):
                matchedStyles = reducedStyles[startPos:endPos]
                log.debug("Skip word#2 '%s' at pos %d:%d -- styles:%s",
                          matchedWord, startPos, endPos, matchedStyles)
                continue
            lineNum = scimoz.lineFromPosition(selectionStart + startPos)
            level = _getLevel(scimoz, lineNum)
            topLines.append((lineNum, level, matchedWord))
        if topLines:
            if topLines[0][2] not in topKeywords:
                raise RefactoringException("multi-part block cut off at top")
            lastLineNum, lastLevel, lastWord = topLines[-1]
            if lastWord == "try":
                raise RefactoringException("try/except/finally block cut off at bottom")
            # Look for something following the except
            # Keep looking after the last line for a continuation keyword
            # in a line with the same level as lastLevel
            # Ignore lines with higher levels
            # Stop when we get to a line with a lower level,
            # or same level starting with a different keyword.
            for lineNum in range(lastLineNum + 1, numLines):
                if isEmptyLine(lineNum):
                    continue
                level = _getLevel(scimoz, lineNum)
                if level < lastLevel:
                    break
                if level > lastLevel:
                    continue
                line = lines[lineNum]
                m = first_word_re.match(line)
                word = m.group(1)
                if word in continuationKeywords:
                    raise RefactoringException("%s-block continued with %s after the selection" % (lastWord, word))
                break

    def findAllHits(self, words, section_start_line, section_end_line, scimoz):
        sec_start_pos = scimoz.positionFromLine(section_start_line)
        sec_end_pos = scimoz.positionFromLine(section_end_line)
        section_bytes = self.bytes[sec_start_pos:sec_end_pos]
        section_styles = self.styles[sec_start_pos:sec_end_pos]
        adjusted_selection_start = self.selectionStart - sec_start_pos
        adjusted_selection_end = self.selectionEnd - sec_start_pos
        last_dot_pos = -1
        paren_nesting = 0
        word_usage = {}
        
        # First look at the params
        m = re.compile(r'\s*(def\s+\w+\s*\()(.*?)\):', re.DOTALL).match(section_bytes)
        if m:
            params = m.group(2)
            paren_count = 0
            in_expn = False
            def_offset = len(m.group(1))
            for m2 in re.finditer(r'(?:[\(\)\[\]\{\},=]|\w+)', params):
                mw = m2.group(0)
                if mw in "([{":
                    paren_count += 1
                elif mw == "}])":
                    if paren_count > 0:
                        paren_count -= 1
                elif mw == "=":
                    if paren_count == 0:
                        in_expn = True
                elif mw == ",":
                    if paren_count == 0:
                        in_expn = False
                else:
                    if paren_count == 0 and not in_expn:
                        if mw in words:
                            startPos, endPos = m2.span()
                            matchedWord = section_bytes[startPos:endPos]
                            posPart = ((def_offset + sec_start_pos + m2.start()) <<
                                       _koIRefactorVariableInfo.NUM_USAGE_BITS);
                            word_usage[mw] = posPart | _koIRefactorVariableInfo.DEFINED_BEFORE_SELECTION
            delta = m.end()
            sec_start_pos += delta
            section_bytes = section_bytes[delta:]
            section_styles = section_styles[delta:]
            adjusted_selection_start -= delta
            adjusted_selection_end -= delta

        ptn = (r'\b(?:'
               + "|".join([re.escape(word) for word in words])
               + r')\b|[\.\(\)]')
        for m in re.finditer(ptn, section_bytes):
            startPos, endPos = m.span()
            matchedWord = section_bytes[startPos:endPos]
            if matchedWord == ".":
                if section_styles[startPos] == _SCE_P_OPERATOR:
                    last_dot_pos = startPos
                continue
            if matchedWord == "(":
                if section_styles[startPos] == _SCE_P_OPERATOR:
                    paren_nesting += 1
                continue
            if matchedWord == ")":
                if section_styles[startPos] == _SCE_P_OPERATOR:
                    if paren_nesting > 0:
                        paren_nesting -= 1
                continue
            if matchedWord not in word_usage:
                word_usage[matchedWord] = ((sec_start_pos + startPos) <<
                                       _koIRefactorVariableInfo.NUM_USAGE_BITS);
            if startPos == last_dot_pos + 1:
                # Skip attributes, no need to update last_dot_pos
                continue
            if not self.isTokenType(_SCE_P_IDENTIFIER,
                                    section_styles[startPos:endPos]):
                # Skip this, it's not an identifier
                continue
            # We have a top-level identifier w -- now what are we doing to it?
            flag = 0
            if _re_assignment_follows.match(section_bytes, endPos):
                if paren_nesting > 0:
                    flag = _koIRefactorVariableInfo.USED_AS_PARAMETER_NAME
                elif startPos < adjusted_selection_start:
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
        # And check for loops...
        ptn = r'^\s+\bfor\s+\(?([\w,\s\\]+)\)?\s*in\b'
        for m in re.finditer(ptn, section_bytes, re.MULTILINE):
            startPos, endPos = m.span()
            theseWords = [w for w in re.compile(r'[,\s]+').split(m.group(1))
                          if w]
            for w in theseWords:
                log.debug("theseWords: %s", theseWords)
                if w in words:
                    log.debug("w %s in theWords", w)
                    if startPos < adjusted_selection_start:
                        flag = _koIRefactorVariableInfo.DEFINED_BEFORE_SELECTION
                    elif startPos < adjusted_selection_end:
                        flag = _koIRefactorVariableInfo.DEFINED_IN_SELECTION
                    else:
                        flag = _koIRefactorVariableInfo.DEFINED_AFTER_SELECTION
                    word_usage[w] |= flag
        
        return [makeRefactoringVariable(word, flags)
                for (word, flags) in sorted(word_usage.items())]


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
            self.checkStructure(scimoz, selectionStart, selectionEnd)
            selBytes = self.bytes[selectionStart:selectionEnd]
            selStyles = self.styles[selectionStart:selectionEnd]
            bytes2 = [b if s == _SCE_P_IDENTIFIER or (s == _SCE_P_OPERATOR and b == '.')
                      else ' '
                  for (b, s) in zip(selBytes, selStyles)]
            # Now remove all the post-period things
            bytes2 = "".join(bytes2)
            bytes3 = re.compile(r'\.\w+').sub("", bytes2)
            words = set([x for x in re.split(re.compile('\\s+'), bytes3) if x])
            if not words:
                log.warn("categorize variables: no words matched")
            self.determineWordUsage(words, scimoz, koDoc,
                                    selectionStart, selectionEnd, callback_wrapper)
        except RefactoringException as ex:
            log.exception("categorizeVariables failed")
            lastErrorSvc = (components.classes["@activestate.com/koLastErrorService;1"]
                            .getService(components.interfaces.koILastErrorService));
            lastErrorSvc.setLastError(nsError.NS_ERROR_INVALID_ARG, str(ex))
            raise ServerException(nsError.NS_ERROR_INVALID_ARG, str(ex))

    _has_self_re = re.compile(r'^(\s*)def\s+\w+\s*\(\s*(\w*)')
    _starts_with_spaces_re = re.compile(r'\A[\r\n]*[ \t]')
    def extractMethodAux(self, scimoz, selectionStart, selectionEnd,
                         sectionLineStart, targetName,
                         inVars, outVars, firstUseOutVars=None):
        lineStart = scimoz.lineFromPosition(selectionStart)
        lineEnd = scimoz.lineFromPosition(selectionEnd)
        lineStartPos = scimoz.positionFromLine(lineStart)
        lineEndPos = scimoz.positionFromLine(lineEnd + 1)
        blockToMove = scimoz.getTextRange(lineStartPos, lineEndPos)
        
        currentHeader = scimoz.getLine(sectionLineStart)[1]
        section_start_func_header_match = self._has_self_re.match(currentHeader)
        if not section_start_func_header_match:
            # Since we don't have a 'def part', we're either looking
            # at a 'class' thing, or we're at the top-level.  Let's
            # just keep going
            leadingWhiteSpaceTarget = self._leading_ws_re.match(blockToMove).group(1)
            inClassMethod = False
            atTopLevel = True
        else:
            leadingWhiteSpaceTarget = section_start_func_header_match.group(1)
            inClassMethod = section_start_func_header_match.group(2) == "self"
            atTopLevel = False
            
        targetLines = blockToMove.splitlines(True)
        eol = self._eol_re.search(currentHeader).group(1)
        if inClassMethod:
            selfArg = "self"
            recipientObject = "self."
            if inVars:
                inVarsComma = ", "
            else:
                inVarsComma = ""
        else:
            selfArg = inVarsComma = recipientObject = ""
        targetHeader = "%sdef %s(%s%s%s):%s" % (
            leadingWhiteSpaceTarget,
            targetName,
            selfArg,
            inVarsComma,
            ", ".join(inVars),
            eol
        )
        
        leading_ws_re = re.compile(r'(\s*)(\S)')
        leadingWhiteSpaceOrig = None
        for line in targetLines:
            m = leading_ws_re.match(line)
            if m:
                leadingWhiteSpaceOrig = m.group(1)
                if m.group(2) != "#":
                    break
        if leadingWhiteSpaceOrig is None:
            log.error("Failed to find leading white-space in %r", blockToMove)
            raise RefactoringException("Failed to find leading white-space in %r" % blockToMove)
        
        # Still have to be able to pick up and move comment lines without
        # worrying about them.
        extraIndent = " " * 4
        innerWhiteSpaceTarget = leadingWhiteSpaceTarget + extraIndent
        postLWSPosn = len(leadingWhiteSpaceOrig)
        
        if atTopLevel:
            choppedTargetLines = [extraIndent + lineText for lineText in targetLines]
        else:
            choppedTargetLines = []
            for lineText in targetLines:
                if (not lineText.startswith(leadingWhiteSpaceOrig)
                    and not self.is_empty_re.match(lineText)):
                    choppedTargetLines.append(lineText)
                else:
                    # Bug 100101: don't chop off parts of leading comments
                    # with insufficient (but not invalid) leading white space.
                    choppedTargetLines.append(innerWhiteSpaceTarget
                                              + lineText[:postLWSPosn].lstrip()
                                              + lineText[postLWSPosn:])
            
        methodCall = "%s%s(%s)" % (recipientObject,
                                   targetName,
                                   ", ".join(inVars))
        if outVars:
            trailingLine = "%sreturn %s%s" % (innerWhiteSpaceTarget,
                                              ", ".join(outVars),
                                              eol)
            callingLine = ", ".join(outVars) + " = " + methodCall
        else:
            trailingLine = ""
            callingLine = methodCall
        callingLine = leadingWhiteSpaceOrig + callingLine + eol
        
        newBlock = targetHeader + "".join(choppedTargetLines) + trailingLine + eol
        if sectionLineStart == 0 and atTopLevel:
            # Walk back from lineStart looking for a line that has no
            # leading white-space
            for candidateLineNum in range(lineStart, 0, -1):
                if not self._leading_required_ws_re.match(scimoz.getLine(candidateLineNum)[1]):
                    sectionLineStart = candidateLineNum
                    break
        
        newBlockTargetPos = scimoz.positionFromLine(sectionLineStart)
        scimoz.beginUndoAction()
        try:
            scimoz.targetStart = lineStartPos
            scimoz.targetEnd = lineEndPos
            scimoz.replaceTarget(len(callingLine), callingLine)
            scimoz.insertText(newBlockTargetPos, newBlock)
        finally:
            scimoz.endUndoAction
        newBlockLen = len(newBlock)
        return [newBlockTargetPos, newBlockTargetPos + newBlockLen,
                lineStartPos + newBlockLen,
                lineStartPos + newBlockLen + len(callingLine)]
                

    def acceptHit(self, targetName, context, columnNo, path, lineNo, symbolType,
                  inDefinitionContext):
        # For now look for a \w\. before context[columnNo]
        beforeText = context[:columnNo]
        afterText = context[columnNo:]
        if (re.compile(r'\w\.$').search(beforeText)
                and re.compile(r'%s\b' % targetName).match(afterText)):
            return True
        # Look for other possibilities:
        # 1: It's a method, and we see def\s+<targetName>\b
        # 2: It's a variable:
        #    Look for [WS](.*,\s*)<targetName>(,\s*.*+)\s*=[^=]
        #    Where a previous line contains [WS]class\b
        # 3: Less likely: look for <targetName>=<value>{,<param>}*)
        
        if symbolType and inDefinitionContext:
            # Find the leading-whitespace *inside* the class
            try:
                f = open(path)
                lines = f.readlines(lineNo + 1)
                openWSClassDefn = openWSInClass = None
                    
                for i in range(lineNo - 1, -1, -1):
                    m = re.compile(r'(\s*)class\b').match(lines[i])
                    if m:
                        classLineNo = i
                        openWSClassDefn = m.group(1)
                        for j in range(classLineNo + 1,lineNo + 1):
                            m = re.compile(r'(\s*)[^\s#]').match(lines[j])
                            if m:
                                openWSInClass = m.group(1)
                                break
                        break
                else:
                    openWSClassDefn = ""
                if openWSInClass is not None:
                    if symbolType == "function":
                        if re.compile(r'%s%s\b' % (openWSInClass, targetName)).match(context):
                            return True
                    elif symbolType == "variable":
                        # Look for a definition
                        m = re.compile(r'(\s+)(?:.*?,\s*)$').match(beforeText)
                        if m and m.group(1) == openWSInClass:
                            if re.compile(r'%s\b(?:,.*)*\s*=[^=]').match(afterText):
                                return True

            except:
                log.exception

        # Failed to find a definition, so look for a parameter.
        # But just go with '='
        if (re.compile(r'(?:^|\(|,)[ \t]*$').search(beforeText)
                    and re.compile(r'%s\b\s*=' % targetName).match(afterText)):
            return True

        log.debug("Not sure if %s in %s|%s in %s/%d is a true hit", targetName, beforeText, afterText, path, lineNo)
        return False

class KoPythonRefactoringLanguageService(_KoPythonCommonRefactoringLangSvc):
    language_name = "Python"
    _com_interfaces_ = [components.interfaces.koIRefactoringLanguageService]
    _reg_clsid_ = "{54a73397-7d4d-46e7-879b-58f446fa9c01}"
    _reg_contractid_ = "@activestate.com/koRefactoringLanguageService;1?language=Python"
    _reg_desc_ = "Komodo %s Refactoring Language Service" % (language_name,)

class KoPython3RefactoringLanguageService(_KoPythonCommonRefactoringLangSvc):
    language_name = "Python3"
    _com_interfaces_ = [components.interfaces.koIRefactoringLanguageService]
    _reg_clsid_ = "{7ea670af-099c-4ad7-849a-442cea385c32}"
    _reg_contractid_ = "@activestate.com/koRefactoringLanguageService;1?language=Python3"
    _reg_desc_ = "Komodo %s Refactoring Language Service" % (language_name,)
