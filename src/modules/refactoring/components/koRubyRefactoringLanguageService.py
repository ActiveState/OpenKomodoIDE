# Copyright (c) 2000-2013 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import re
import logging

from xpcom import components, COMException, ServerException, nsError
from koRefactoringLanguageServiceBase import KoRefactoringLanguageServiceBase, \
     borderStart, borderEnd, makeRefactoringVariable, RefactoringException

from koLanguageServiceBase import sci_constants

log = logging.getLogger("RubyRefactoringLangSvc")
#log.setLevel(logging.DEBUG)

#---- Constants

_SCE_RB_OPERATOR = sci_constants.SCE_RB_OPERATOR
_SCE_RB_IDENTIFIER = sci_constants.SCE_RB_IDENTIFIER
_SCE_RB_WORD = sci_constants.SCE_RB_WORD

_re_assignment_follows = re.compile(r'(?:\s*,[\s\w,]*)?\s*=(?!=)')
_re_adjustment_follows = re.compile(r'\s*[^=\w\s]=')

class KoRubyRefactoringLanguageService(KoRefactoringLanguageServiceBase):
    language_name = "Ruby"
    _com_interfaces_ = [components.interfaces.koIRefactoringLanguageService]
    _reg_clsid_ = "{ac254571-491b-42fc-bb11-ef76a8d2e3e4}"
    _reg_contractid_ = "@activestate.com/koRefactoringLanguageService;1?language=Ruby"
    _reg_desc_ = "Komodo %s Refactoring Language Service" % (language_name,)
    
    attributeDelimiters = ((".", sci_constants.SCE_RB_OPERATOR),
                           ("::", sci_constants.SCE_RB_OPERATOR))
    supportsRefactoring = True
    
    def __init__(self):
        global _koIRefactorVariableInfo
        KoRefactoringLanguageServiceBase.__init__(self)
        _koIRefactorVariableInfo = components.interfaces.koIRefactorVariableInfo
    
    _looper_starts = ['while', 'for', 'until']
    _other_starters = ['def', 'unless', 'begin', 'until',
                       'module', 'begin', 'class', 'if', 'do']
    _end_starters = _looper_starts + _other_starters
    _matchers = {
        'ensure': ['begin'],
        'when': ['case'],
        'else': ['if', 'case'],
        'elsif': ['if'],
        'rescue': ['begin', 'def'],
        }
    def checkStructure(self, scimoz, selBytes, selStyles,
                       selectionStart, selectionEnd):

        # Other code expects these to be set here, so do it.
        self.lineStart = scimoz.lineFromPosition(selectionStart)
        self.lineEnd = scimoz.lineFromPosition(selectionEnd)
        if self.lineStart == self.lineEnd:
            # No structural check needed
            return True
        reducedBytes = self.bytes[selectionStart:selectionEnd]
        reducedStyles = self.styles[selectionStart:selectionEnd]
        # Returns are allowed in lambda's and methods, so don't complain about
        # them.
        # Same with break's and next's, but we might be able to check them as well.
        
        looper_stack = []
        for m in re.finditer(r'\b(?:def|end|unless|begin|ensure|module|until'
                             +   r'|begin|break|do|next|rescue|case|else|for'
                             +   r'|while|class|elsif|if|when|[\{\}])\b',
                             reducedBytes):
            startPos, endPos = m.span()
            matchedWord = reducedBytes[startPos:endPos]
            if matchedWord == "{":
                if reducedStyles[startPos] == _SCE_RB_OPERATOR:
                    looper_stack.append(matchedWord)
            elif matchedWord == "}":
                if reducedStyles[startPos] == _SCE_RB_OPERATOR:
                    if not looper_stack or looper_stack.pop() != "{":
                        raise RefactoringException("Selection not fully contained within a block")
            elif not self.isKeyword(scimoz, reducedStyles, startPos, endPos,
                                    _SCE_RB_WORD):
                pass # do nothing
            elif matchedWord == 'end':
                if not looper_stack or looper_stack.pop() not in self._end_starters:
                    raise RefactoringException("Selection not fully contained within a block")
            elif matchedWord in self._end_starters:
                looper_stack.append(matchedWord)
            elif matchedWord in self._matchers:
                if not looper_stack or looper_stack[-1] not in self._matchers[matchedWord]:
                    raise RefactoringException("Selection contains %s with no matching %s" %
                                               (matchedWord,
                                                "|".join(self._matchers[matchedWord])))
            elif matchedWord in ('break', 'next'):
                if not looper_stack or looper_stack[-1] not in self._looper_starts:
                    raise RefactoringException("Selection contains %s outside loop" % matchedWord)
        if looper_stack:
            raise RefactoringException("selection ends in middle of block")
        
    def categorizeVariables(self, scimoz, koDoc, selectionStart, selectionEnd,
                            callback):
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
            bytes2 = [b if s == _SCE_RB_IDENTIFIER or (s == _SCE_RB_OPERATOR and b in '.:')
                      else ' '
                  for (b, s) in zip(selBytes, selStyles)]
            # Now remove all the post-period things
            bytes2 = "".join(bytes2)
            bytes3 = re.compile(r'(?:\.|::)[\$\w]+').sub("", bytes2)
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

        
    _fn_start_re = re.compile(r'(\s*)(def\s+(?:.*?\.)?)(\w+)\s*(?:$|#|\(|\\)')
    def extractMethodAux(self, scimoz, selectionStart, selectionEnd,
                         sectionLineStart, targetName,
                         inVars, outVars, firstUseOutVars=None):
        lineStart = scimoz.lineFromPosition(selectionStart)
        lineEnd = scimoz.lineFromPosition(selectionEnd)
        lineStartPos = scimoz.positionFromLine(lineStart)
        lineEndPos = scimoz.positionFromLine(lineEnd + 1)
        blockToMove = scimoz.getTextRange(lineStartPos, lineEndPos)
        
        currentHeader = scimoz.getLine(sectionLineStart)[1]
        section_start_func_header_match = self._fn_start_re.match(currentHeader)
        if not section_start_func_header_match:
            # We're probably extracting top-level code
            atTopLevel = True
            leadingWhiteSpaceTarget = self._leading_ws_re.match(blockToMove).group(1)
            preMethodNamePart = "def "
        else:
            atTopLevel = False
            leadingWhiteSpaceTarget = section_start_func_header_match.group(1)
            preMethodNamePart = section_start_func_header_match.group(2)
        
        targetLines = blockToMove.splitlines(True)
        eol = self._eol_re.search(currentHeader).group(1)
        targetHeader = "%s%s%s(%s)%s" % (
            leadingWhiteSpaceTarget,
            preMethodNamePart,
            targetName,
            ", ".join(inVars),
            eol
        )
        
        leading_ws_re = re.compile(r'(\s+)(\S)')
        for line in targetLines:
            m = leading_ws_re.match(line)
            if m and m.group(2) != "#":
                leadingWhiteSpaceOrig = m.group(1)
                break
        else:
            leadingWhiteSpaceOrig = ""
        
        indent = scimoz.indent
        if not indent:
            indent = scimoz.tabWidth # if 0, Scintilla uses tabWidth
        extraIndent = " " * indent
        if atTopLevel:
            choppedTargetLines = [extraIndent + lineText for lineText in targetLines]
            innerWhiteSpaceTarget = extraIndent
        else:
            choppedTargetLines = []
            innerWhiteSpaceTarget = leadingWhiteSpaceTarget + extraIndent
            postLWSPosn = len(leadingWhiteSpaceOrig)
            for lineText in targetLines:
                if (leadingWhiteSpaceOrig
                    and not lineText.startswith(leadingWhiteSpaceOrig)
                    and not self.is_empty_re.match(lineText)):
                    choppedTargetLines.append(lineText)
                else:
                    choppedTargetLines.append(innerWhiteSpaceTarget + lineText[postLWSPosn:])
            
        methodCall = "%s(%s)" % (targetName, ", ".join(inVars))
        if outVars:
            returnParts = [innerWhiteSpaceTarget, "return "]
            if len(outVars) > 1:
                returnParts += ["[", ", ".join(outVars), "]"]
            else:
                returnParts.append(outVars[0])
            returnParts.append(eol)
            trailingLine = "".join(returnParts)
            callingLine = ", ".join(outVars) + " = " + methodCall
        else:
            trailingLine = ""
            callingLine = methodCall
        callingLine = leadingWhiteSpaceOrig + callingLine
        newBlock = (targetHeader
                    + "".join(choppedTargetLines)
                    + trailingLine
                    + leadingWhiteSpaceTarget + "end" + eol
                    + eol)
        if sectionLineStart == 0 and atTopLevel:
            # Walk back from lineStart looking for a line that has no
            # leading white-space
            for candidateLineNum in range(lineStart, 0, -1):
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
        # Parsing method headers is incomplete:
        # * Stops at first paren
        # * Fooled by comments
        # * Fooled by default values in strings
        # Don't worry about this -- using a parser like ripper
        # will solve this problem.
        
        m = re.compile(r'''(\s*def\s+)          # group1: def offset
                           ((?:.*?\.)?)         # group2: receiver name
                           (\w+\s*\()           # group3: pre-open-paren
                           (\w+)                # group4: first param
                           (.*?)                # group5: remaining params
                           \)''', re.DOTALL|re.VERBOSE).match(section_bytes)
        method_name_receiver = None
        if m:
            def_offset = (len(m.group(1)) + len(m.group(2)) + len(m.group(3)))
            if m.group(2):
                method_name_receiver = m.group(1)
            startPos, endPos = def_offset, def_offset + len(m.group(4))
            matchedWord = section_bytes[startPos:endPos]
            if matchedWord in words:
                posPart = ((def_offset + sec_start_pos + startPos) <<
                           _koIRefactorVariableInfo.NUM_USAGE_BITS);
                word_usage[matchedWord] = posPart | _koIRefactorVariableInfo.DEFINED_BEFORE_SELECTION
            def_offset += (endPos - startPos)   # len(m.group(4))
            for m2 in re.finditer(r'(,\s*)(\w+)', m.group(5)):
                startPos = m2.start() + len(m2.group(1))
                matchedWord = m2.group(2)
                if matchedWord in words:
                    posPart = ((def_offset + sec_start_pos + startPos) <<
                               _koIRefactorVariableInfo.NUM_USAGE_BITS);
                    word_usage[matchedWord] = posPart | _koIRefactorVariableInfo.DEFINED_BEFORE_SELECTION

            full_def_offset = len(m.group(0))
            section_bytes = section_bytes[full_def_offset:]
            section_styles = section_styles[full_def_offset:]
            adjusted_selection_start -= full_def_offset
            adjusted_selection_end -= full_def_offset
            sec_start_pos += full_def_offset
            
        # Again, this would be more easily done with ripper in pure ruby
        # For now, go heuristic, and don't forget vars can be defined in
        # |..| and for loops
        ptn = (r'\b(?:'
               + "|".join(words)
               + r')\b')
        preceded_by_op_re = re.compile(r'(?:\.|::)\s*$')
        follows_bar_re = re.compile(r'(?:\bdo|\{)\s*\|[\w,\s]*$', re.DOTALL)
        precedes_bar_re = re.compile(r'[\w,\s]*\|')
        in_for_loop_re = re.compile(r'\bfor\b[\s\w,]*$', re.DOTALL)
        for m in re.finditer(ptn, section_bytes):
            startPos, endPos = m.span()
            if not self.isTokenType(_SCE_RB_IDENTIFIER,
                                    section_styles[startPos:endPos]):
                # Skip this, it's not an identifier
                continue
            # If we're preceded by a "::" or "." don't
            m1 = preceded_by_op_re.search(section_bytes, 0, startPos)
            if m1:
                continue
            matchedWord = section_bytes[startPos:endPos]
            if matchedWord not in word_usage:
                word_usage[matchedWord] = ((sec_start_pos + startPos) <<
                                       _koIRefactorVariableInfo.NUM_USAGE_BITS)
            # We have a top-level identifier w -- now what are we doing to it?
            flag = 0
            # Assignments in Ruby: after =, in |...|, or in a for loop
            #
            # Still to do (and not going to happen -- named parameters
            # in Ruby 2, like in Python.
            if (_re_assignment_follows.match(section_bytes, endPos)
                or (follows_bar_re.search(section_bytes, 0, startPos)
                    and precedes_bar_re.match(section_bytes, endPos))
                or in_for_loop_re.search(section_bytes, 0, startPos)
                or _re_adjustment_follows.match(section_bytes, endPos)):
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
            del word_usage["self"]
        except KeyError:
            pass
        return [makeRefactoringVariable(word, flags)
                for (word, flags) in sorted(word_usage.items())]

    def getSearchTermForVariable(self, searchText, _):
        # Allow for Ruby $, @, and @@ things
        compareText = searchText
        if searchText[0] in ('$', '@'):
            if searchText[0] == '$':
                prefix = '\\'
            else:
                prefix = ''
            adjustedSearchText = '(?:^|(?=<[^\\w]))' + prefix + searchText
        else:
            adjustedSearchText = borderStart(searchText)
        return borderEnd(adjustedSearchText), compareText

    def acceptHit(self, targetName, context, columnNo, path, lineNo, symbolType,
                  inDefinitionContext):
        '''
        If we\'re inside a module or class, assume an @-free name is a hit.
        Allow for '@' before a name inside a class that defines the
        target name.
        '''
        beforeText = context[:columnNo]
        afterText = context[columnNo:]
        if re.compile(r'%s\b' % targetName).match(afterText):
            if inDefinitionContext:
                # No need to check for further qualification, just accept it.
                return True
            if afterText.startswith("@") and not beforeText.strip():
                return True
            if beforeText.endswith(('.', '::', '@')):
                return True
            if re.compile(r'(?:module|class|def)\s+$').search(beforeText):
                return True
        log.debug("Not sure if %s in %s|%s in %s/%d is a true hit", targetName, beforeText, afterText, path, lineNo)
        return False
