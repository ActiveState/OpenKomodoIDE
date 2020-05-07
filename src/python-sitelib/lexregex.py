#!/usr/bin/env python
# Copyright (c) 2003-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""
    lexregex - Lex a regular expression.

    Usage (command line):
        lexregex [<options>] <regex>

    Options:
        -h, --help      print this help and exit
        -v, --verbose   verbose output
        -V, --version   print the version and exit

        -l <lang>, --language=<lang>
                        Specify the regex language syntax, e.g. "python",
                        "perl", "tcl", "php", etc. Default is "python".
        -s, --sre       Use sre_parse.parse() and dump its output.

    Usage (module):
        from lexregex import lexregex  # lexregex() is a generator
        for style, index in lexregex(<regex>, [, <language>="python"]):
            # process style...
    
    This is both a prototype for and usable Python interface for
    LexRegex.cxx in scintilla.
"""
# TODO:
# - New in Python 2.4:
#   The regular expression language accepted by the re module was extended
#   with simple conditional expressions, written as (?(group)A|B). group is
#   either a numeric group ID or a group name defined with (?P<group>...)
#   earlier in the expression. If the specified group matched, the regular
#   expression pattern A will be tested against the string; if the group
#   didn't match, the pattern B will be used instead.
# - New in Python 2.5:
#   '(?(id/name)yes-pattern|no-pattern)' syntax
# - Test suite! This regex incorrectly gets a syntax error under the '\2'
#    <!DOCTYPE
#    \s+(?P<name>[a-zA-Z_:][\w:.-]*)
#    \s+(?:
#        SYSTEM\s+(["'])(?P<system_id_a>.*?)\2
#        | PUBLIC\s+(["'])(?P<public_id_b>.*?)\4\s+(["'])(?P<system_id_b>.*?)\6
#    )
#    \s*>

from __future__ import generators

import os
import sys
import cmd
import pprint
import getopt
import re

import logging


#---- exceptions

class LexRegexError(Exception):
    def __init__(self, msg, startIndex=None, endIndex=None): 
        self.msg = msg
        self.startIndex = startIndex
        self.endIndex = endIndex
        Exception.__init__(self, msg, startIndex, endIndex)
    def __str__(self):
        if self.startIndex is None and self.endIndex is None:
            return self.msg
        elif self.endIndex is None:
            return "%d: %s" % (self.startIndex, self.msg)
        else:
            return "%d-%d: %s" % (self.startIndex, self.endIndex, self.msg)


#---- globals

_version_ = (0, 1, 0)
log = logging.getLogger("lexregex")
#log.setLevel(logging.DEBUG)

#XXX This should not be here, this is just another place where these
#    numbers have to be kept in sync. See styles.py and
#    Default.unprocessed.ksf.
#XXX Though should have some list of the known states and perhaps a mappping
#    to an english description of them.
#states = { # lexical states, these must match those in Scintilla.iface
#    "default": 0,
#    "comment": 1, # (?#...)
#    "text": 2,
#    "special": 3, # standalone (. ^ $ |), in charset (^ -)
#    "charset_operator": 4,
#    "operator": 5, # open/close paren (use operator for paren matching by scintilla)
#    "groupref": 6, 
#    "quantifier": 7,
#    "grouptag": 8,
#    "charclass": 9,
#    "charescape": 10,
#    "eol": 11, #XXX not currently used
#}

#stateNames = {
#    0: "SCE_RX_DEFAULT",
#    1: "SCE_RX_COMMENT",
#    2: "SCE_RX_TEXT",
#    3: "SCE_RX_QUANTIFIER",
#    4: "SCE_RX_ESCAPEDTEXT",
#    5: "SCE_RX_CHARSET",
#    6: "SCE_RX_GROUPTAG",
#    7: "SCE_RX_GROUPREF",
#    8: "SCE_RX_CHARCLASS",
#    9: "SCE_RX_EOL",
#    10: "SCE_RX_OPERATOR",
##XXX Need SPECIAL class
#}


#---- public module interface

def isident(char):
    return "a" <= char <= "z" or "A" <= char <= "Z" or char == "_"

def isdigit(char):
    return "0" <= char <= "9"


#_gRepQuantPattern = re.compile(r"{(\d+)?(,)?(\d+)?}")
_gRepQuantPattern = re.compile(r"{\d+(?:,\d*)?}")
def isquantifier(regex, pos):
    if regex[pos] in "+*?":
        return 1
    if regex[pos] == "{":
        closeIndex = regex.find("}", pos+1)
        if (closeIndex != -1
            and _gRepQuantPattern.match(regex, pos, closeIndex+1)):
            return 1
    return 0


def _validateRange((startState, startToken, startIndex),
                   (endState, endToken, endIndex)):
    """Raise an exception if the given range is illegal."""
    log.debug("_validateRange((%r, %r, %r), (%r, %r, %r))",
              startState, startToken, startIndex,
              endState, endToken, endIndex)
    if startState == "charclass" or endState == "charclass":
        raise LexRegexError("illegal character range: cannot use character "
                            "classes in ranges", startIndex, endIndex)
    # raise an error is startToken > endToken
    startOrd = ord(eval('"'+startToken+'"'))
    endOrd = ord(eval('"'+endToken+'"'))
    if startOrd > endOrd:
        raise LexRegexError("illegal character range: start of range cannot "
                            "precede end of range in ASCII order: '%s-%s'"
                            % (startToken, endToken), startIndex, endIndex)

def _validateGroupRef(groups, groupNumOrName, startIndex, endIndex):
    """Raise an exception if the given group ref is to a group that has not
    yet been fully parsed.
    
        "groups" is a list of fully or partially parsed groups (if a group's
            "end" key is not None, then it is fully parsed.
        "groupNumOrName" is a group name or number
        "startIndex" and "endIndex" are the indeces in the regex of the group
    """
    log.debug("_validateGroupRef(groupNumOrName=%s, groups=%s)",
              groupNumOrName, groups)
    if isinstance(groupNumOrName, int):
        try:
            # Bug 95097: count capturing groups correctly; ignore non-capturing
            # groups when trying to resolve \n in a pattern.
            qualified_groups = [g for g in groups
                                if (g.get('type',None) in ('plain', 'named',)
                                    and not g.get('non-capturing', False))]
            group = qualified_groups[groupNumOrName]
        except IndexError:
            group = None
    elif isinstance(groupNumOrName, (str, unicode)):
        for group in groups:
            if groupNumOrName == group.get("name"):
                break
        else:
            group = None
    if group is None:
        raise LexRegexError("invalid group reference: no such group: '%s'"
                            % groupNumOrName, startIndex, endIndex)
    elif group.get("end") is None:
        raise LexRegexError("invalid group reference: cannot refer to an "
                            "open group: '%s'" % groupNumOrName,
                            startIndex, endIndex)

import string
_option_letters_for_language = {
    'python': "iLmsux",
    'perl': "ipxsm",
    'php': "ixsm",
    'ruby': "ixm",
    'javascript': 'm',  # empty string means this isn't allowed
}

def _lookingAtNamedGroup(regex, pos, lengthRegex):
    if pos > lengthRegex - 4: # There isn't room for (?<x>)
        return False
    if regex[pos] == 'P':
        if regex[pos + 1] != '<':
            return False
        nameStartPos = pos + 2
    elif regex[pos] in "<'":
        nameStartPos = pos + 1
    else:
        return False
    return regex[nameStartPos] in string.ascii_letters + "_"

def lexregex(regex, language="python", verbose=0):
    """Lex the given regular expression and generate each lexical group

        "regex" is the regular expression to tokenize
        "language" is the regex language syntax to parse
        "verbose" indicates if this is a verbose regex

    Use a state-based approach to lex the given regex. This is a generator
    that yields (<style>, <index>) tuples where <style> is a string (see
    the "states" global) and <index> is the character index in the
    "regex" up to which <style> applies.
    """
    # TODO:
    # - verbose regexes
    # - other syntaxes (e.g. perl)
    #
    log.debug("lexregex(regex=%r, language=%r, verbose:%r)", regex,
              language, verbose)
    pos = 0
    lastStylePos = pos - 1
    #XXX "groupStack" is redundant and should potentially be removed
    groupStack = [] # stack of positions of unterminated group starts
    # List of fully or partially parsed groups.
    # If a group's "end" tag is non-None then it is fully parsed. The
    # "type" field is used to for context-sensitive validation using that
    # group.
    groups = [
        {"start": 0, "end": len(regex), "name": None, "type": "plain"},
    ]
    currGroup = None  # reference to element in "groups" that is being parsed
    # Number of chars in current charset (negating '^' doesn't count).
    # None if not in a charset.
    charSetChars = None
    charSetStartIndex = None # index of the start of the current charset
    # The state and bounds for the lead atom in a charset range. Used for
    # validating the range when its parsing is complete.
    rangeStartState = None
    state = "default"
    lengthRegex = len(regex)
    while 1:
        #XXX If there are lots a problems with infinite loops then we
        #    could add a sentinel (max recursions) to each loop.
        log.info(" %s       pos:%d state:%s", regex, pos, state)
        log.info(" %s^", ' '*pos)
        newState = None

        if state == "text":
            while 1:
                # Break out if the current char is not "text".
                if pos >= lengthRegex:
                    break
                elif charSetChars is not None:  # i.e. we are in a charset
                    # ']' as first charset char does not terminate charset
                    if charSetChars > 0 and regex[pos] == "]":
                        newState = "charset_operator"
                        break
                    elif regex[pos] == "\\":
                        newState = "default"
                        break
                elif regex[pos] in r"\().|^$[":
                    newState = "default"
                    break
                elif isquantifier(regex, pos):
                    newState = "quantifier"
                    break

                # The current char is "text".
                pos += 1
                if charSetChars is not None: charSetChars += 1

                # Lookahead, if necessary, to determine new state.
                if charSetChars is not None:
                    if (pos+1 < lengthRegex             # start a range
                        and regex[pos] == "-" and regex[pos+1] != "]"):
                        newState = "special"
                        rangeStartState = ("text", regex[pos-1:pos], pos-1)
                        break
                    elif rangeStartState is not None:   # end a range
                        _validateRange(rangeStartState,
                                       ("text", regex[pos-1:pos], pos))
                        rangeStartState = None

        elif state == "special": # standalone (. ^ $ |), in charset (^ -)
            assert regex[pos] in ".^$|" or (regex[pos] == "-" and charSetChars is not None)
            if regex[pos] == ".":
                pos += 1
                if pos < lengthRegex and isquantifier(regex, pos):
                    newState = "quantifier"
                else:
                    newState = "default"
            else:
                pos += 1
                newState = "default"

        elif state == "charset_operator":
            if regex[pos] == "[":
                charSetChars = 0
                charSetStartIndex = pos
            else:
                charSetChars = None
                charSetStartIndex = None
            pos += 1
            if charSetChars is not None:
                if pos < lengthRegex and regex[pos] == "^":
                    newState = "special"
                else:
                    newState = "default"
            else:
                if pos < lengthRegex and isquantifier(regex, pos):
                    newState = "quantifier"
                else:
                    newState = "default"

        elif state == "operator":  # open/close paren
            if regex[pos] == "(":
                groupStack.append(pos)
                currGroup = {"start": pos, "end": None, "name": None}
                groups.append(currGroup)
                pos += 1
                if pos+1 < lengthRegex and regex[pos:pos+2] == "?#":
                    currGroup["type"] = "comment"
                    newState = "comment" # (?#...)
                elif pos+2 < lengthRegex and regex[pos:pos+3] == "?P=":
                    currGroup["type"] = "groupref"
                    newState = "groupref" # (?P=name)
                elif pos < lengthRegex and regex[pos] == "?":
                    newState = "grouptag"
                else:
                    currGroup["type"] = "plain"
                    newState = "default"
            else:
                assert regex[pos] == ")"
                try:
                    groupStack.pop()
                except IndexError:
                    raise LexRegexError("unbalanced parenthesis", pos)
                #if currGroup is None:
                #    raise LexRegexError("unbalanced parenthesis", pos)
                currGroup["end"] = pos
                lastGroupType = currGroup.get("type")
                if lastGroupType not in ("plain", "named"):
                    groups.remove(currGroup)
                for i in range(len(groups)-1, 0, -1): # iterate in reverse
                    if groups[i]["end"] is None:
                        currGroup = groups[i]
                        break
                else:
                    currGroup = None
                pos += 1
                
                if (lastGroupType not in ("option", "comment") #XXX others?
                    and pos < lengthRegex and isquantifier(regex, pos)):
                    newState = "quantifier"
                else:
                    newState = "default"

        elif state == "comment": # (?#...)
            while 1:
                if pos >= lengthRegex:
                    break
                elif pos+1 < lengthRegex and regex[pos] == "\\":
                    pos += 2
                elif regex[pos] == ")":
                    newState = "operator"
                    break
                else:
                    pos += 1

        elif state == "groupref":
            # Valid:
            #   (?P=name)
            #   \1 - \99
            # Note that \<number> where <number> is three octal digits
            # or is one or two digits and starts with a zero is an octal
            # character escape.
            #
            # The following one is only valid in replacement strings so
            # not accepting it:
            #   \g<0>
            refFirstCharPos = pos
            if regex[pos:pos+3] == "?P=":
                pos += 3
                # Parse first char of group name.
                if regex[pos] == ")":
                    raise LexRegexError("group name cannot be empty", pos)
                elif not isident(regex[pos]):
                    raise LexRegexError("illegal character in group name", pos)
                nameFirstCharPos = pos
                pos += 1
                # Parse the rest of the group name.
                while 1:
                    if pos >= lengthRegex:
                        raise LexRegexError("group name is not terminated",
                                            nameFirstCharPos, pos)
                    elif regex[pos] == ")":
                        break
                    elif not isident(regex[pos]) and not isdigit(regex[pos]):
                        raise LexRegexError("illegal character in group name", pos)
                    pos += 1
                group = regex[nameFirstCharPos:pos]
                newState = "operator"
            elif regex[pos] == "\\":
                pos += 1
                if regex[pos] == 'k':
                    group = None
                    closeChar = (regex[pos + 1] == '<') and '>' or "'"
                    pos += 2  
                    while pos < lengthRegex:
                        if regex[pos] == closeChar:
                            pos += 1
                            newState = "groupref"
                            break
                        elif isident(regex[pos]):
                            pos += 1
                        else:
                            raise LexRegexError("unterminated groupref", pos)
                else:
                    numFirstCharPos = pos
                    if pos < lengthRegex and regex[pos] in "123456789":
                        pos += 1
                    else:
                        raise LexRegexError("unexpected end of string in groupref", pos)
                    if pos < lengthRegex and regex[pos] in "0123456789":
                        pos += 1
                    group = int(regex[numFirstCharPos:pos])
                if pos < lengthRegex and isquantifier(regex, pos):
                    newState = "quantifier"
                else:
                    newState = "default"
            else:
                raise LexRegexError("unexpected character in group ref: '%s'"
                                    % regex[pos])
            if group is not None:
                _validateGroupRef(groups, group, refFirstCharPos, pos)

        elif state == "quantifier":
            # Valid quantifiers:
            #   * + ? *? +? ?? {m} {m,n} {m,} {m,}? {m,n}?
            #   {} {,} {,n} {}? {,}? {,n}?
            if regex[pos] in "*+?":
                pos += 1
                if pos < lengthRegex and regex[pos] == "?":
                    pos += 1
            elif regex[pos] == "{":
                # We will rely on the fact that we only get into a quantifier
                # state if isquantifier() was true, therefore we do not
                # need to parse out the repetition quantifier here.
                openBracePos = pos
                pos = regex.find("}", pos+1)
                if pos == -1:
                    raise LexRegexError("unterminated repetition quantifier",
                                        openBracePos)
                pos += 1
                if pos < lengthRegex and regex[pos] == "?": pos += 1
            else:
                raise LexRegexError("illegal quantifier character: %r"
                    % regex[pos], pos)

            newState = "default"

        elif state == "grouptag":
            #TODO: redo grouptag state entry to ensure never get in if
            #      it is a null group tag, should make code more
            #      consistent, c.f. "quantifier" state
            # Valid groups (for some languages):
            #   (...)           i.e. there is no grouptag here
            #   (?iLmsux) # see 
            #   (?P<name>...)
            #   (?<name>...)
            #   (?:...)
            #   (?=...)
            #   (?!...)
            #   (?<=...)
            #   (?<!...)
            #   (?>...) non-backtracking (perl, php/pcre, ruby)
            # some of perl/ruby/php:
            #   (?-ismx) # p in perl only
            #   (?ismx-ismx) # p in perl only, first part only
            #   (?ismx:PATTERN) # perl/ruby/php in perl only
            #   (?ismx-ismx:PATTERN) # p in perl only
            #   (?|PATTERN) # "branch reset" pattern, perl 5.10 +
            #   (?'NAME'PATTERN)
            #   (?<NAME>PATTERN)
            #   (?P<NAME>PATTERN)
            #   (?PARNO) # the paren-number of the capture buffer to recurse to
            #   (?-PARNO)
            #   (?+PARNO)
            #   (?R)
            #   (?0)
            #   (?&NAME)
            #   (?P>NAME)
            #   (?(CONDITION)PATTERN|PATTERN)
            #   (?(CONDITION)PATTERN)
            #    CONDITION: (\d+), (<NAME>), ('NAME'), (R\d+), (R&\w+)
            #              (DEFINE), ignore (?{ CODE })
            #   \k<NAME>
            #   \k'NAME'
            if regex[pos] == "?":
                pos += 1
                if pos >= lengthRegex:
                    break # let group termination check catch the error here
                validOptionLetters = _option_letters_for_language.get(language, string.letters)
                if regex[pos] in validOptionLetters + '-':
                    if language == "javascript":
                        raise LexRegexError("invalid quantifier", pos)
                    allowsDashPart = language in ("perl", "php", "ruby")
                    if regex[pos] == '-' and not allowsDashPart:
                        raise LexRegexError("invalid quantifier", pos)
                    allowsColonPart = language in ("perl", "php", "ruby")
                    sawMinusSign = False
                    currGroup["type"] = "option"
                    while pos < lengthRegex:
                        if regex[pos] == ')':
                            
                            break
                        elif regex[pos] == '-' and allowsDashPart and not sawMinusSign:
                            pos += 1
                            if language == "perl":
                                sawMinusSign = True
                            # php and ruby allow multiple "-" parts
                        elif regex[pos] == ':' and allowsColonPart:
                            currGroup["non-capturing"] = 1
                            pos += 1
                            newState = "default"
                            break
                        elif (regex[pos] not in validOptionLetters
                            or (language == "perl" and regex[pos] == 'p' and sawMinusSign)):
                            raise LexRegexError("illegal flag character in "
                                                "flag group", pos)
                        pos += 1
                    else:
                        newState = "operator"
                        break # let group termination check catch the error here
                elif _lookingAtNamedGroup(regex, pos, lengthRegex):
                    if language == "javascript":
                        raise LexRegexError("%s doesn't support named-group capture" %
                                            language, pos)
                    if regex[pos] in "<'" and language == "python":
                        raise LexRegexError("missing '?' in '(?P<' for named-group capture", pos)
                    elif regex[pos] == "P" and language == "ruby":
                        raise LexRegexError("ruby uses '(?<', not '(?P<' for named-group capture", pos)
                    currGroup["type"] = "named"
                    pos += (regex[pos] in "<'" and 1) or 2
                    openAngleBracketPos = pos-1
                    if regex[openAngleBracketPos] == '<':
                        endGroupNameChar = '>'
                    elif regex[openAngleBracketPos] == "'":
                        endGroupNameChar = "'"
                    else:
                        raise LexRegexError("Unexpected open char of '%s'"
                                            % regex[openAngleBracketPos])
                    # Parse first char of group name.
                    if pos >= lengthRegex:
                        raise LexRegexError("group name is not terminated",
                                            openAngleBracketPos, pos)
                    if regex[pos] == endGroupNameChar:
                        raise LexRegexError("group name cannot be empty", pos)
                    elif not isident(regex[pos]):
                        raise LexRegexError("illegal character in group name", pos)
                    nameFirstCharPos = pos
                    pos += 1
                    # Parse the rest of the group name.
                    while 1:
                        if pos >= lengthRegex:
                            raise LexRegexError("group name is not terminated",
                                                openAngleBracketPos, pos)
                        elif regex[pos] == endGroupNameChar:
                            break
                        elif not isident(regex[pos]) and not isdigit(regex[pos]):
                            raise LexRegexError("illegal character in group name", pos)
                        pos += 1
                    currGroup["name"] = regex[nameFirstCharPos:pos]
                    pos += 1 # close group name: '>'
                    newState = "default"
                elif regex[pos] == ':':
                    currGroup["non-capturing"] = 1
                    pos += 1
                    newState = "default"
                elif regex[pos] == '=':
                    currGroup["positive-lookahead-assertion"] = 1
                    pos += 1
                    newState = "default"
                elif regex[pos] == '!':
                    currGroup["negative-lookahead-assertion"] = 1
                    pos += 1
                    newState = "default"
                elif regex[pos:pos+2] == "<=":
                    if language == "javascript":
                        raise LexRegexError("%s doesn't support look-behind" %
                                            language, pos)
                    currGroup["positive-lookbehind-assertion"] = 1
                    pos += 2
                    newState = "default"
                elif regex[pos:pos+2] == "<!":
                    if language == "javascript":
                        raise LexRegexError("%s doesn't support look-behind" %
                                            language, pos)
                    currGroup["negative-lookbehind-assertion"] = 1
                    pos += 2
                    newState = "default"
                elif regex[pos] == ">":
                    if language in ("javascript", "python"):
                        raise LexRegexError("%s doesn't support non-backtracking" %
                                            language, pos)
                    currGroup["nonbacktracking-assertion"] = 1
                    pos += 1
                    newState = "default"
                elif regex[pos] == "|":
                    if language != "perl":
                        raise LexRegexError("%s doesn't support branch-reset patterns" %
                                            language, pos)
                    currGroup["branch-reset"] = 1
                    pos += 1
                    newState = "default"
                elif (isdigit(regex[pos])
                      or (regex[pos] in "-+"
                          and pos < lengthRegex - 2
                          and isdigit(regex[pos+1]))):
                    if language not in ("perl", "php"):
                        raise LexRegexError("%s doesn't support recursing into capture-buffers" %
                                            language, pos)
                    if regex[pos] in "-+": pos += 1
                    while pos < lengthRegex and isdigit(regex[pos]):
                        pos += 1
                    if pos < lengthRegex and regex[pos] == ')':
                        newState = "operator"
                    else:
                        raise LexRegexError("illegal character in "
                                            "recurse-pattern number group", pos)
                elif regex[pos] in "R0":
                    if language not in ("perl", "php"):
                        raise LexRegexError("%s doesn't support recursing into capture-buffers" %
                                            language, pos)
                    pos += 1
                    if pos < lengthRegex and regex[pos] == ')':
                        newState = "operator"
                    else:
                        raise LexRegexError("illegal character in "
                                            "recurse-pattern number group", pos)
                elif (pos < lengthRegex - 4 # There isn't room for (?P>X)
                         and regex[pos] == 'P'
                         and regex[pos + 1] in '>&'
                         and isident(regex[pos + 2])):
                    if language not in ("perl", "php"):
                        raise LexRegexError("%s doesn't support recursing into capture-buffers" %
                                            language, pos)
                    pos += 3
                    while pos < lengthRegex and isident(regex[pos]):
                        pos += 1
                    if pos < lengthRegex and regex[pos] == ')':
                        newState = "operator"
                    else:
                        raise LexRegexError("illegal character in "
                                            "recurse-pattern number group", pos)
                elif (pos < lengthRegex - 5 # There isn't room for (?(c)p)
                         and regex[pos] == '('):
                    if language not in ("perl", "php"):
                        raise LexRegexError("%s doesn't support conditional patterns" %
                                            language, pos)
                    groupStack.append(pos)
                    currGroup = { 'start':pos, 'end':None, 'name':None}
                    groups.append(currGroup)
                    lastPos = regex.find(')', pos + 1)
                    if lastPos == -1:
                        raise LexRegexError("unterminated recursive-parsing quantifier",
                                            pos)
                    pos = lastPos
                    newState = "operator"
                else:
                    raise LexRegexError("illegal or incomplete group tag "
                                        "following '?'", pos)
            else:
                newState = "default"

        elif state == "charclass":
            # Valid: \A \b \B \d \D \s \S \w \W \Z
            #XXX Necessary to guard against overflow here? "default"
            #    state processing should have caught that case already.
            pos += 2
            if charSetChars is not None: charSetChars += 2

            newState = "default"
            if charSetChars is not None:    # in a charset
                if (pos+1 < lengthRegex             # start a range
                    and regex[pos] == "-" and regex[pos+1] != "]"):
                    newState = "special"
                    rangeStartState = ("charclass", regex[pos-2:pos], pos-2)
                elif rangeStartState is not None:   # end a range
                    _validateRange(rangeStartState,
                                   ("charclass", regex[pos-2:pos], pos))
                    rangeStartState = None
            else:                           # NOT in a charset
                if pos < lengthRegex and isquantifier(regex, pos):
                    newState = "quantifier"

        elif state == "charescape":
            # Valid:
            #   \000 to \777    # octal escape
            #   \x00 to \xFF    # hex escape
            #   \c              # where 'c' is any but the charclass chars
            # Perl/PHP:
            #   \k<NAME>
            #   \k'NAME'
            escapeStartPos = pos
            pos += 1
            if charSetChars is not None: charSetChars += 1
            try:
                if regex[pos] == "0": # one, two or three char octal escape
                    pos += 1
                    if charSetChars is not None: charSetChars += 1
                    if pos < lengthRegex and regex[pos] in "01234567":
                        pos += 1
                        if charSetChars is not None: charSetChars += 1
                        if pos < lengthRegex and regex[pos] in "01234567":
                            pos += 1
                            if charSetChars is not None: charSetChars += 1
                elif (pos+2 < lengthRegex
                      and regex[pos] in "1234567"
                      and regex[pos+1] in "01234567"
                      and regex[pos+2] in "01234567"): # three char octal escape
                    pos += 1
                    if charSetChars is not None: charSetChars += 1
                    if regex[pos] not in "01234567":
                        raise LexRegexError("unexpected end of octal char escape: '%s'"
                                            % regex[escapeStartPos:pos],
                                            escapeStartPos, pos)
                    pos += 1
                    if charSetChars is not None: charSetChars += 1
                    if regex[pos] not in "01234567":
                        raise LexRegexError("unexpected end of octal char escape: '%s'"
                                            % regex[escapeStartPos:pos],
                                            escapeStartPos, pos)
                    pos += 1
                    if charSetChars is not None: charSetChars += 1
                elif regex[pos] == "x":
                    pos += 1
                    if charSetChars is not None: charSetChars += 1
                    if regex[pos] not in "0123456789abcdefABCDEF":
                        raise LexRegexError("unexpected end of hex char escape",
                                            escapeStartPos, pos)
                    pos += 1
                    if charSetChars is not None: charSetChars += 1
                    if regex[pos] not in "0123456789abcdefABCDEF":
                        raise LexRegexError("unexpected end of hex char escape",
                                            escapeStartPos, pos)
                    pos += 1
                    if charSetChars is not None: charSetChars += 1
                else:
                    assert (charSetChars is None # 'b' is NOT a charclass in a charset
                            and regex[pos] not in "AbBdDsSwWZ"
                            or regex[pos] not in "ABdDsSwWZ") # charclass
                    pos += 1
                    if charSetChars is not None: charSetChars += 1
            except IndexError:
                raise LexRegexError("unexpected end of string in escape",
                                    escapeStartPos, pos)

            newState = "default"
            if charSetChars is not None:    # in a charset
                if (pos+1 < lengthRegex             # start a range
                    and regex[pos] == "-" and regex[pos+1] != "]"):
                    newState = "special"
                    rangeStartState = ("charescape", regex[escapeStartPos:pos],
                                       escapeStartPos)
                elif rangeStartState is not None:   # end a range
                    _validateRange(rangeStartState,
                                   ("charescape", regex[escapeStartPos:pos], pos))
                    rangeStartState = None
            else:                           # NOT in a charset
                if pos < lengthRegex and isquantifier(regex, pos):
                    newState = "quantifier"

        elif state == "default":
            if pos >= lengthRegex:
                pass
            elif charSetChars is not None:  # i.e. we are in a charset
                # Note: ']' as first charset char does not terminate charset
                if charSetChars > 0 and regex[pos] == "]":
                    newState = "charset_operator"
                elif regex[pos] == "\\":
                    if pos+1 >= lengthRegex:
                        #XXX Can do better with the error message here.
                        raise LexRegexError("unexpected end of string in escape", pos)
                    # Note: \b is a charESCAPE in a charset
                    elif regex[pos+1] in "ABdDsSwWZ":
                        newState = "charclass"
                    else:
                        newState = "charescape"
                else:
                    newState = "text"
            elif regex[pos] in "()":
                newState = "operator"
            elif regex[pos] in "[":
                newState = "charset_operator"
            elif regex[pos] in ".|^$":
                newState = "special"
            elif isquantifier(regex, pos):
                raise LexRegexError("illegal position for a quantifier", pos)
            elif regex[pos] == "\\":
                if pos+1 >= lengthRegex:
                    #XXX Can do better with the error message here.
                    raise LexRegexError("unexpected end of string in escape", pos)
                elif regex[pos+1] in "AbBdDsSwWZ":
                    newState = "charclass"
                elif (regex[pos+1] in "0" or
                      (pos+3 < lengthRegex and
                       regex[pos+1] in "1234567" and
                       regex[pos+2] in "01234567" and
                       regex[pos+3] in "01234567")):
                    newState = "charescape"
                elif regex[pos+1] in "123456789":
                    newState = "groupref"
                elif (regex[pos + 1] == "k"
                      and pos < lengthRegex - 4 #\k<x>
                      and regex[pos + 2] in "<'"
                      and isident(regex[pos + 3])
                      and language in ("perl", "php")):
                    newState = "groupref"
                else:
                    newState = "charescape"
            else:
                newState = "text"

        if pos-1 != lastStylePos:
            # We are not before the start and the style range is not
            # empty.
            yield (state, pos-1)
            lastStylePos = pos-1
        oldState = state
        state = newState
        if pos >= lengthRegex:
            break
        if newState is None:
            raise LexRegexError("internal error parsing '%s' state: no "
                                "new state was set (started in '%s' state)"
                                % (state, oldState), pos)

    if groupStack:
        raise LexRegexError("unterminated group", groupStack[-1], pos)
    if charSetStartIndex is not None:
        raise LexRegexError("unterminated character set",
                            charSetStartIndex, pos)


def lexreplacement(replacement, language="python"):
    """Lex the given regex replacement template and generate each lexical group

        "replacement" is the regular expression replacement template
        "language" is the regex language syntax to parse

    Use a state-based approach to lex the given replacement. This is a
    generator that yields (<style>, <index>) tuples where <style> is a
    string (see the "states" global) and <index> is the character index in
    the "regex" up to which <style> applies.
    """
    # TODO:
    # - other syntaxes (e.g. perl)
    #
    log.debug("lexregex(replacement=%r, language=%r)", replacement, language)
    pos = 0
    lastStylePos = pos - 1
    state = "default"
    lengthReplacement = len(replacement)
    while 1:
        log.info(" %s       pos:%d state:%s", replacement, pos, state)
        log.info(" %s^", ' '*pos)
        newState = None

        if state == "text":
            while 1:
                # Break out if the current char is not "text".
                if pos >= lengthReplacement:
                    break
                elif replacement[pos] in "\\":
                    newState = "default"
                    break
                # The current char is "text".
                pos += 1

        elif state == "groupref":
            # Valid:
            #   \g<0>
            #   \g<name>
            #   \(0)*1 - \(0)*99
            # Note: I don't know if the (0)* accepted by sre is a Python-only
            #       idiosyncracy.
            refFirstCharPos = pos
            if replacement[pos:pos+2] == "\\g":
                pos += 2
                if pos >= lengthReplacement:
                    raise LexRegexError("group reference is not terminated", pos-2, pos)
                elif replacement[pos] != "<":
                    raise LexRegexError("illegal start of group reference", pos)
                pos += 1

                # Parse first char of group name/number.
                if replacement[pos] == ">":
                    raise LexRegexError("group cannot be empty", pos)
                elif isident(replacement[pos]):
                    mode = "name"
                elif isdigit(replacement[pos]):
                    mode = "number"
                else:
                    raise LexRegexError("illegal character in group name", pos)
                nameFirstCharPos = pos
                pos += 1
                # Parse the rest of the group name/number.
                while 1:
                    if pos >= lengthReplacement:
                        raise LexRegexError("group %s is not terminated" % mode,
                                            nameFirstCharPos, pos)
                    elif replacement[pos] == ">":
                        pos += 1
                        break
                    elif (mode == "name" and not isident(replacement[pos])
                          and not isdigit(replacement[pos])):
                        raise LexRegexError("illegal character in group name", pos)
                    elif mode == "number" and not isdigit(replacement[pos]):
                        raise LexRegexError("illegal character in group number", pos)
                    pos += 1
                group = replacement[nameFirstCharPos:pos]
            elif replacement[pos] == "\\":
                pos += 1
                numFirstCharPos = pos
                # Parse first char of group number.
                if not isdigit(replacement[pos]):
                    raise LexRegexError("unexpected group number first character", pos)
                # Parse the rest of the group number.
                while 1:
                    if pos >= lengthReplacement:
                        break
                    elif not isdigit(replacement[pos]):
                        break
                    pos += 1
            else:
                raise LexRegexError("unexpected character in group ref: '%s'"
                                    % replacement[pos])
            newState = "default"
            #XXX Perhaps we should pass in the groups from the lexed (or
            #    _matched_ replacement to validate these group references).
            #_validateGroupRef(groups, group, refFirstCharPos, pos)

        elif state == "charescape":
            # Valid:
            #   \x00 to \xFF    # hex escape
            #   \c              # where 'c' is any char but 'g' or a digit
            escapeStartPos = pos
            pos += 1
            try:
                if replacement[pos] == "x":
                    pos += 1
                    if replacement[pos] not in "0123456789abcdefABCDEF":
                        raise LexRegexError("unexpected end of hex char escape",
                                            escapeStartPos, pos)
                    pos += 1
                    if replacement[pos] not in "0123456789abcdefABCDEF":
                        raise LexRegexError("unexpected end of hex char escape",
                                            escapeStartPos, pos)
                    pos += 1
                elif replacement[pos] == "g" or isdigit(replacement[pos]):
                    raise LexRegexError("unexpected character escape character", pos)
                else:
                    pos += 1
            except IndexError:
                raise LexRegexError("unexpected end of string in escape",
                                    escapeStartPos, pos)
            newState = "default"

        elif state == "default":
            if pos >= lengthReplacement:
                pass
            elif replacement[pos] == "\\":
                if pos+1 >= lengthReplacement:
                    raise LexRegexError("unexpected end of string in escape", pos)
                elif replacement[pos+1] == "g" or isdigit(replacement[pos+1]):
                    newState = "groupref"
                else:
                    newState = "charescape"
            else:
                newState = "text"

        if pos-1 != lastStylePos:
            # We are not before the start and the style range is not
            # empty.
            yield (state, pos-1)
            lastStylePos = pos-1
        oldState = state
        state = newState
        if pos >= lengthReplacement:
            break
        if newState is None:
            raise LexRegexError("internal error parsing '%s' state: no "
                                "new state was set (started in '%s' state)"
                                % (state, oldState), pos)


#---- unit test suite

import unittest
class LexRegexTestCase(unittest.TestCase):
    # TODO:
    # - add test cases for regex's ending in backslash, I think there
    #   might be bugs in my handling of that.
    # - test lexreplacement()
    def _assertRegexLexesTo(self, regex, language, expect):
        results = list(lexregex(regex, language=language))
        self.assertEqual(results, expect,
                         "failed lexing %r: expected:\n%s\ngot:\n%s"\
                         % (regex, pprint.pformat(expect),
                            pprint.pformat(results)))

    def _assertRegexLexRaises(self, regex, language, ex_class,
                              ex_startIndex=None, ex_endIndex=None,
                              strict=1):
        """Assert that lexing the given regex raises the given exception.
        
            ...
            "strict" (optional) specifies whether this assertion should be
                strict about validating the startIndex and endIndex with
                the given. The default is to be strict.
        """
        try:
            list(lexregex(regex, language=language))
        except ex_class, ex:
            if strict:
                if ex.startIndex:
                    self.assertEqual(ex.startIndex, ex_startIndex,
                                     "unexpected start index for LexRegexError "
                                     "lexing %r: expected %d, got %d"
                                     % (regex, ex_startIndex, ex.startIndex))
                if ex.endIndex:
                    self.assertEqual(ex.endIndex, ex_endIndex,
                                     "unexpected end index for LexRegexError "
                                     "lexing %r: expected %d, got %d"
                                     % (regex, ex_endIndex, ex.endIndex))
        else:
            self.fail("lexing %r did not raise %r"
                      % (regex, ex_class.__name__))

    def _assertRegexLexSucceeds(self, regex, language):
        list(lexregex(regex, language=language))

    def test_python_plain(self):
        self._assertRegexLexesTo("foo", "python", [("text", 2)])
    def test_python_non_grouping_group(self):
        self._assertRegexLexesTo("(?:foo)", "python",
            [ ("operator", 0), ("grouptag", 2), ("text", 5), ("operator", 6) ])
    def test_python_group(self):
        self._assertRegexLexesTo("(foo)", "python",
            [ ("operator", 0), ("text", 3), ("operator", 4) ])
        self._assertRegexLexesTo("abc(def)ghi", "python",
            [ ("text", 2), ("operator", 3), ("text", 6), ("operator", 7), ("text", 10)])
    def test_python_inline_flag(self):
        self._assertRegexLexesTo("(?i)", "python",
            [ ("operator", 0), ("grouptag", 2), ("operator", 3) ])
    def test_python_illegal_inline_flag(self):
        self._assertRegexLexRaises("(?w)", "python", LexRegexError, 2)
        self._assertRegexLexRaises("(?", "python", LexRegexError, 0, 2)
    def test_python_inline_flags(self):
        self._assertRegexLexesTo("(?iLmsux)", "python",
            [ ("operator", 0), ("grouptag", 7), ("operator", 8) ])
    def test_python_illegal_inline_flags(self):
        self._assertRegexLexRaises("(?iLw)", "python", LexRegexError, 4)
        self._assertRegexLexRaises("(?i", "python", LexRegexError, 0, 3)
    def test_python_named_group(self):
        self._assertRegexLexesTo("(?P<bar>foo)", "python",
            [ ("operator", 0), ("grouptag", 7), ("text", 10),
              ("operator", 11) ])
    def test_python_illegal_groups(self):
        self._assertRegexLexRaises("(?P<>foo)", "python", LexRegexError, 4)
        self._assertRegexLexRaises("(?P<2>foo)", "python", LexRegexError, 4)
        self._assertRegexLexRaises("(?P<bar%>foo)", "python", LexRegexError, 7)
        self._assertRegexLexRaises("(?P<bar", "python", LexRegexError, 3, 7)
        self._assertRegexLexRaises("(?P<bar", "python", LexRegexError, 3, 7)
        self._assertRegexLexRaises("(?P<", "python", LexRegexError, 3, 4)

        self._assertRegexLexRaises("(", "python", LexRegexError, 0, 1)
        self._assertRegexLexRaises("(foo", "python", LexRegexError, 0, 4)
        self._assertRegexLexRaises("(bar)(foo", "python", LexRegexError, 5, 9)
        self._assertRegexLexRaises("((bar)(foo", "python", LexRegexError, 6, 10)
        self._assertRegexLexRaises(")", "python", LexRegexError, 0)
        self._assertRegexLexRaises("foo)", "python", LexRegexError, 3)
        self._assertRegexLexRaises("(bar))", "python", LexRegexError, 5)
    def test_python_positive_lookahead_assertion(self):
        self._assertRegexLexesTo("(?=foo)", "python",
            [ ("operator", 0), ("grouptag", 2),
              ("text", 5), ("operator", 6) ])
    def test_python_negative_lookahead_assertion(self):
        self._assertRegexLexesTo("(?!foo)", "python",
            [ ("operator", 0), ("grouptag", 2),
              ("text", 5), ("operator", 6) ]
        )
    def test_python_positive_lookbehind_assertion(self):
        self._assertRegexLexesTo("(?<=foo)", "python",
            [ ("operator", 0), ("grouptag", 3),
              ("text", 6), ("operator", 7) ]
        )
    def test_python_negative_lookbehind_assertion(self):
        self._assertRegexLexesTo("(?<!foo)", "python",
            [ ("operator", 0), ("grouptag", 3),
              ("text", 6), ("operator", 7) ]
        )
    def test_python_dot(self):
        self._assertRegexLexesTo(".", "python", [("special", 0)])
        self._assertRegexLexesTo("foo.bar", "python",
            [("text", 2), ("special", 3), ("text", 6)])
        self._assertRegexLexesTo(".*", "python",
            [("special", 0), ("quantifier", 1)])
        self._assertRegexLexesTo("(.)*", "python",
            [("operator", 0), ("special", 1), ("operator", 2),
             ("quantifier", 3)])
    def test_python_caret(self):
        self._assertRegexLexesTo("^", "python", [("special", 0)])
        self._assertRegexLexesTo("foo^bar", "python",
            [("text", 2), ("special", 3), ("text", 6)])
        self._assertRegexLexesTo("^bar", "python",
            [("special", 0), ("text", 3)])
    def test_python_dollar(self):
        self._assertRegexLexesTo("$", "python", [("special", 0)])
        self._assertRegexLexesTo("foo$bar", "python",
            [("text", 2), ("special", 3), ("text", 6)])
        self._assertRegexLexesTo("foo$", "python",
            [("text", 2), ("special", 3)])
    def test_python_pipe(self):
        self._assertRegexLexesTo("a|b", "python",
            [("text", 0), ("special", 1), ("text", 2)])
    def test_python_star(self):
        self._assertRegexLexesTo("a*", "python",
            [("text", 0), ("quantifier", 1)])
        self._assertRegexLexesTo("a*?", "python",
            [("text", 0), ("quantifier", 2)])
        self._assertRegexLexesTo("(a*)", "python",
            [("operator", 0), ("text", 1), ("quantifier", 2),
             ("operator", 3)])
        self._assertRegexLexesTo("(a*?)", "python",
            [("operator", 0), ("text", 1), ("quantifier", 3),
             ("operator", 4)])
        self._assertRegexLexesTo("(a)*", "python",
            [("operator", 0), ("text", 1), ("operator", 2),
             ("quantifier", 3)])
        self._assertRegexLexesTo("(a)*?", "python",
            [("operator", 0), ("text", 1), ("operator", 2),
             ("quantifier", 4)])
    def test_python_plus(self):
        self._assertRegexLexesTo("a+", "python",
            [("text", 0), ("quantifier", 1)])
        self._assertRegexLexesTo("a+?", "python",
            [("text", 0), ("quantifier", 2)])
        self._assertRegexLexesTo("(a+)", "python",
            [("operator", 0), ("text", 1), ("quantifier", 2),
             ("operator", 3)])
        self._assertRegexLexesTo("(a+?)", "python",
            [("operator", 0), ("text", 1), ("quantifier", 3),
             ("operator", 4)])
        self._assertRegexLexesTo("(a)+", "python",
            [("operator", 0), ("text", 1), ("operator", 2),
             ("quantifier", 3)])
        self._assertRegexLexesTo("(a)+?", "python",
            [("operator", 0), ("text", 1), ("operator", 2),
             ("quantifier", 4)])
    def test_python_question(self):
        self._assertRegexLexesTo("a?", "python",
            [("text", 0), ("quantifier", 1)])
        self._assertRegexLexesTo("a??", "python",
            [("text", 0), ("quantifier", 2)])
        self._assertRegexLexesTo("(a?)", "python",
            [("operator", 0), ("text", 1), ("quantifier", 2),
             ("operator", 3)])
        self._assertRegexLexesTo("(a??)", "python",
            [("operator", 0), ("text", 1), ("quantifier", 3),
             ("operator", 4)])
        self._assertRegexLexesTo("(a)?", "python",
            [("operator", 0), ("text", 1), ("operator", 2),
             ("quantifier", 3)])
        self._assertRegexLexesTo("(a)??", "python",
            [("operator", 0), ("text", 1), ("operator", 2),
             ("quantifier", 4)])

    def test_python_repetitions(self):
        self._assertRegexLexesTo("a{2}", "python",
            [("text", 0), ("quantifier", 3)])
        self._assertRegexLexesTo("a{2}?", "python",
            [("text", 0), ("quantifier", 4)])
        self._assertRegexLexesTo("(a{2})", "python",
            [("operator", 0), ("text", 1), ("quantifier", 4),
             ("operator", 5)])
        self._assertRegexLexesTo("(a{2}?)", "python",
            [("operator", 0), ("text", 1), ("quantifier", 5),
             ("operator", 6)])
        self._assertRegexLexesTo("(a){2}", "python",
            [("operator", 0), ("text", 1), ("operator", 2),
             ("quantifier", 5)])
        self._assertRegexLexesTo("(a){2}?", "python",
            [("operator", 0), ("text", 1), ("operator", 2),
             ("quantifier", 6)])
        self._assertRegexLexesTo("[a]{2}", "python",
            [("charset_operator", 0), ("text", 1),
             ("charset_operator", 2), ("quantifier", 5)])
        self._assertRegexLexesTo("[a]{2}?", "python",
            [("charset_operator", 0), ("text", 1),
             ("charset_operator", 2), ("quantifier", 6)])
        self._assertRegexLexesTo("a{}", "python",
            [("text", 0), ("quantifier", 2)])
        self._assertRegexLexesTo("a{,}", "python",
            [("text", 0), ("quantifier", 3)])
        self._assertRegexLexesTo("a{2,}", "python",
            [("text", 0), ("quantifier", 4)])
        self._assertRegexLexesTo("a{,2}", "python",
            [("text", 0), ("quantifier", 4)])
        self._assertRegexLexesTo("a{2,}?", "python",
            [("text", 0), ("quantifier", 5)])
        self._assertRegexLexesTo("a{2,4}", "python",
            [("text", 0), ("quantifier", 5)])
        self._assertRegexLexesTo("a{2,4}?", "python",
            [("text", 0), ("quantifier", 6)])
        self._assertRegexLexesTo("(a{2,4})", "python",
            [("operator", 0), ("text", 1), ("quantifier", 6),
             ("operator", 7)])
        self._assertRegexLexesTo("(a{2,4}?)", "python",
            [("operator", 0), ("text", 1), ("quantifier", 7),
             ("operator", 8)])
        self._assertRegexLexesTo("(a){2,4}", "python",
            [("operator", 0), ("text", 1), ("operator", 2),
             ("quantifier", 7)])
        self._assertRegexLexesTo("(a){2,4}?", "python",
            [("operator", 0), ("text", 1), ("operator", 2),
             ("quantifier", 8)])
        self._assertRegexLexesTo("a{12345}", "python",
            [("text", 0), ("quantifier", 7)])
        self._assertRegexLexesTo("a{12345,67890}", "python",
            [("text", 0), ("quantifier", 13)])

        # I had first thought that the following regexes would be
        # illegal: "incomplete/illegal repetition quantifier". But
        # apparently the algorithm is: it is a repetition quantifier if
        # it successfully parses as one, otherwise it is just a text
        # literal.
        self._assertRegexLexesTo(r"a{", "python", [("text", 1)])
        self._assertRegexLexesTo(r"a{,", "python", [("text", 2)])
        self._assertRegexLexesTo(r"a{1,", "python", [("text", 3)])
        self._assertRegexLexesTo(r"a{1,2", "python", [("text", 4)])
        self._assertRegexLexesTo(r"a{12345,67890", "python", [("text", 12)])
        self._assertRegexLexesTo("foo{a}", "python", [("text", 5)])
        self._assertRegexLexesTo("foo{b,4}", "python", [("text", 7)])
        self._assertRegexLexesTo("foo{2,c}", "python", [("text", 7)])
        self._assertRegexLexesTo("foo{d,e}", "python", [("text", 7)])
        self._assertRegexLexesTo(r"(a)\1{b}", "python",
            [("operator", 0), ("text", 1), ("operator", 2), ("groupref", 4), ("text", 7)])
        self._assertRegexLexesTo("(?#foo){b}", "python",
            [("operator", 0), ("comment", 5), ("operator", 6), ("text", 9)])
        self._assertRegexLexesTo("^{b}", "python",
            [("special", 0), ("text", 3)])
        self._assertRegexLexesTo("\w{b}", "python",
            [("charclass", 1), ("text", 4)])
        self._assertRegexLexesTo("(a){b}", "python",
            [("operator", 0), ("text", 1),
             ("operator", 2), ("text", 5)])
        self._assertRegexLexesTo("[a]{b}", "python",
            [("charset_operator", 0), ("text", 1),
             ("charset_operator", 2), ("text", 5)])

    def test_python_illegal_quantifiers(self):
        self._assertRegexLexRaises("+", "python", LexRegexError, 0)
        self._assertRegexLexRaises("*", "python", LexRegexError, 0)
        self._assertRegexLexRaises("?", "python", LexRegexError, 0)
        self._assertRegexLexRaises("{2}", "python", LexRegexError, 0)
        self._assertRegexLexRaises("{2,4}", "python", LexRegexError, 0)

        self._assertRegexLexRaises("foo++", "python", LexRegexError, 4)
        self._assertRegexLexRaises("foo*+", "python", LexRegexError, 4)
        self._assertRegexLexRaises("foo+?+", "python", LexRegexError, 5)
        self._assertRegexLexRaises("foo*?+", "python", LexRegexError, 5)
        self._assertRegexLexRaises("foo???", "python", LexRegexError, 5)

    def test_python_comment(self):
        self._assertRegexLexesTo("(?#foo)", "python",
            [("operator", 0), ("comment", 5), ("operator", 6)])
        self._assertRegexLexesTo("(?#)", "python",
            [("operator", 0), ("comment", 2), ("operator", 3)])
        self._assertRegexLexesTo("foo(?#)bar", "python",
            [("text", 2), ("operator", 3), ("comment", 5),
             ("operator", 6), ("text", 9)])
        self._assertRegexLexesTo("(?#(foo\)bar)", "python",
            [("operator", 0), ("comment", 11), ("operator", 12)])
        self._assertRegexLexRaises("(?#foo", "python", LexRegexError, 0, 6)

    def test_python_groupref(self):
        self._assertRegexLexesTo("(?P<foo>abc)(?P=foo)", "python",
            [("operator", 0), ("grouptag", 7), ("text", 10), ("operator", 11),
             ("operator", 12), ("groupref", 18), ("operator", 19)])
        self._assertRegexLexesTo("(?P<_fo>abc)(?P=_fo)", "python",
            [("operator", 0), ("grouptag", 7), ("text", 10), ("operator", 11),
             ("operator", 12), ("groupref", 18), ("operator", 19)])
        self._assertRegexLexesTo("(?P<_42>abc)(?P=_42)", "python",
            [("operator", 0), ("grouptag", 7), ("text", 10), ("operator", 11),
             ("operator", 12), ("groupref", 18), ("operator", 19)])
        self._assertRegexLexRaises("(?P=42", "python", LexRegexError, 4)
        self._assertRegexLexRaises("(?P=foo", "python", LexRegexError, 4, 7)
        self._assertRegexLexRaises(r"\1", "python", LexRegexError, 0, 2)
        self._assertRegexLexRaises(r"(?P=foo)", "python", LexRegexError, 1, 7)
        for groupnum in (1, 2, 9, 10, 99):
            regex = r"%s\%d" % ("(a)"*groupnum, groupnum)
            expect = []
            for j in range(groupnum):
                expect += [("operator", 3*j+0), ("text", 3*j+1), ("operator", 3*j+2)]
            expect += [("groupref", len(regex)-1)]
            self._assertRegexLexesTo(regex, "python", expect)

            regex = r"%sfoo\%dbar" % ("(a)"*groupnum, groupnum)
            expect = []
            for j in range(groupnum):
                expect += [("operator", 3*j+0), ("text", 3*j+1), ("operator", 3*j+2)]
            expect += [("text", len(regex)-4-len(str(groupnum))-1),
                       ("groupref", len(regex)-3-1),
                       ("text", len(regex)-1)]
            self._assertRegexLexesTo(regex, "python", expect)

        # These are NOT grouprefs:
        self._assertRegexLexesTo(r"\100", "python", [("charescape", 3)])
        self._assertRegexLexesTo(r"\0", "python", [("charescape", 1)])
        self._assertRegexLexesTo(r"\01", "python", [("charescape", 2)])
        self._assertRegexLexesTo(r"\001", "python", [("charescape", 3)])

        regex = r"%s\999" % ("(a)"*99)
        expect = []
        for j in range(99):
            expect += [("operator", 3*j+0), ("text", 3*j+1), ("operator", 3*j+2)]
        expect += [("groupref", len(regex)-1-1),
                   ("text", len(regex)-1)]
        self._assertRegexLexesTo(regex, "python", expect)

    def test_python_charescape(self):
        for ch in r"acCz\^$|.,(){}[]":
            self._assertRegexLexesTo(r"\%s" % ch, "python",
                                     [("charescape", 1)])
            for quant in ("+", "*", "?", "{2}", "{2,5}", "+?"):
                self._assertRegexLexesTo(r"\%s%s" % (ch, quant), "python",
                    [("charescape", 1), ("quantifier", len(quant)+1)])
            self._assertRegexLexesTo(r"(\%s)" % ch, "python",
                [("operator", 0), ("charescape", 2), ("operator", 3)])
            self._assertRegexLexesTo(r"foo\%sbar" % ch, "python",
                [("text", 2), ("charescape", 4), ("text", 7)])
        # octal escapes
        self._assertRegexLexesTo(r"\0", "python", [("charescape", 1)])
        self._assertRegexLexesTo(r"\01", "python", [("charescape", 2)])
        self._assertRegexLexesTo(r"\001", "python", [("charescape", 3)])
        self._assertRegexLexesTo(r"\100", "python", [("charescape", 3)])
        self._assertRegexLexesTo(r"(\100)", "python",
            [("operator", 0), ("charescape", 4), ("operator", 5)])
        self._assertRegexLexesTo(r"foo\100bar", "python",
            [("text", 2), ("charescape", 6), ("text", 9)])
        # hex escapes
        self._assertRegexLexesTo(r"\x00", "python", [("charescape", 3)])
        self._assertRegexLexesTo(r"\x42", "python", [("charescape", 3)])
        self._assertRegexLexesTo(r"\xa3", "python", [("charescape", 3)])
        self._assertRegexLexesTo(r"\x3a", "python", [("charescape", 3)])
        self._assertRegexLexesTo(r"\xA3", "python", [("charescape", 3)])
        self._assertRegexLexesTo(r"\x3A", "python", [("charescape", 3)])
        self._assertRegexLexesTo(r"\xFF", "python", [("charescape", 3)])
        self._assertRegexLexesTo(r"(\xFF)", "python",
            [("operator", 0), ("charescape", 4), ("operator", 5)])
        self._assertRegexLexesTo(r"foo\xFFbar", "python",
            [("text", 2), ("charescape", 6), ("text", 9)])
        self._assertRegexLexRaises(r"\x4", "python", LexRegexError, 0, 3)
        self._assertRegexLexRaises(r"\x", "python", LexRegexError, 0, 2)
        self._assertRegexLexRaises(r"\xG", "python", LexRegexError, 0, 2)
        self._assertRegexLexRaises(r"\x3G", "python", LexRegexError, 0, 3)

    def test_python_charclass(self):
        for ch in r"AbBdDsSwWZ":
            self._assertRegexLexesTo(r"\%s" % ch, "python",
                                     [("charclass", 1)])
            for quant in ("+", "*", "?", "{2}", "{2,5}", "+?"):
                self._assertRegexLexesTo(r"\%s%s" % (ch, quant), "python",
                    [("charclass", 1), ("quantifier", len(quant)+1)])

    def test_python_charset(self):
        # Good:
        #  [a] []] [[] [-] [a-] [ab]] [^abc] [a^bc] [a-c] ] [a]+ [\w]
        #  [abc\x42abc]
        # Bad:
        #  [c-a]    illegal range (backwards)
        #  [] [  [abc  foo[bar  foo[      incomplete charset
        #  [a-\w]
        self._assertRegexLexesTo(r"]", "python",
            [("text", 0)])

        self._assertRegexLexesTo(r"[a]", "python",
            [("charset_operator", 0), ("text", 1), ("charset_operator", 2)])
        self._assertRegexLexesTo(r"[abc]", "python",
            [("charset_operator", 0), ("text", 3), ("charset_operator", 4)])
        self._assertRegexLexesTo(r"[abc]+", "python",
            [("charset_operator", 0), ("text", 3), ("charset_operator", 4), ("quantifier", 5)])
        self._assertRegexLexesTo(r"[a]", "python",
            [("charset_operator", 0), ("text", 1), ("charset_operator", 2)])
        self._assertRegexLexesTo(r"[ab.]", "python",
            [("charset_operator", 0), ("text", 3), ("charset_operator", 4)])
        self._assertRegexLexesTo(r"[ab]]", "python",
            [("charset_operator", 0), ("text", 2), ("charset_operator", 3), ("text", 4)])
        self._assertRegexLexesTo(r"[]]", "python",
            [("charset_operator", 0), ("text", 1), ("charset_operator", 2)])
        self._assertRegexLexesTo(r"[[]", "python",
            [("charset_operator", 0), ("text", 1), ("charset_operator", 2)])

        # negating
        self._assertRegexLexesTo(r"[^a]", "python",
            [("charset_operator", 0), ("special", 1), ("text", 2), ("charset_operator", 3)])
        self._assertRegexLexesTo(r"[^abc]", "python",
            [("charset_operator", 0), ("special", 1), ("text", 4), ("charset_operator", 5)])
        self._assertRegexLexesTo(r"[^abc]+", "python",
            [("charset_operator", 0), ("special", 1), ("text", 4), ("charset_operator", 5), ("quantifier", 6)])
        self._assertRegexLexesTo(r"[^a]", "python",
            [("charset_operator", 0), ("special", 1), ("text", 2), ("charset_operator", 3)])
        for ch in ".+$^-*|{}()":
            self._assertRegexLexesTo(r"[^ab%s]" % ch, "python",
                [("charset_operator", 0), ("special", 1), ("text", 4), ("charset_operator", 5)])
        self._assertRegexLexesTo(r"[^ab]]", "python",
            [("charset_operator", 0), ("special", 1), ("text", 3), ("charset_operator", 4), ("text", 5)])
        self._assertRegexLexesTo(r"[^]]", "python",
            [("charset_operator", 0), ("special", 1), ("text", 2), ("charset_operator", 3)])
        self._assertRegexLexesTo(r"[^[]", "python",
            [("charset_operator", 0), ("special", 1), ("text", 2), ("charset_operator", 3)])

        # char classes in charsets
        for ch in r"ABdDsSwWZ":
            self._assertRegexLexesTo(r"[\%s]" % ch, "python",
                [("charset_operator", 0), ("charclass", 2), ("charset_operator", 3)])
            self._assertRegexLexesTo(r"[^\%s]" % ch, "python",
                [("charset_operator", 0), ("special", 1), ("charclass", 3), ("charset_operator", 4)])
            for quant in ("+", "*", "?", "{2}", "{2,5}", "+?"):
                self._assertRegexLexesTo(r"[\%s%s]" % (ch, quant), "python",
                    [("charset_operator", 0), ("charclass", 2),
                     ("text", len(quant)+2), ("charset_operator", len(quant)+3)])
                self._assertRegexLexesTo(r"[^\%s%s]" % (ch, quant), "python",
                    [("charset_operator", 0), ("special", 1), ("charclass", 3),
                     ("text", len(quant)+3), ("charset_operator", len(quant)+4)])
        self._assertRegexLexesTo(r"[\b]", "python",
            [("charset_operator", 0), ("charescape", 2), ("charset_operator", 3)])

        # escapes in charsets
        for i in range(1, 10):
            self._assertRegexLexesTo(r"[\%d]" % i, "python",
                [("charset_operator", 0), ("charescape", 2), ("charset_operator", 3)])
        for i in range(10, 100):
            self._assertRegexLexesTo(r"[\%d]" % i, "python",
                [("charset_operator", 0), ("charescape", 2), ("text", 3),
                 ("charset_operator", 4)])
        self._assertRegexLexesTo(r"[ab\1cd]", "python",
            [("charset_operator", 0), ("text", 2), ("charescape", 4),
             ("text", 6), ("charset_operator", 7)])
        self._assertRegexLexesTo(r"[ab\10cd]", "python",
            [("charset_operator", 0), ("text", 2), ("charescape", 4),
             ("text", 7), ("charset_operator", 8)])
        for ch in r"acCz\^$|.,(){}[]":
            self._assertRegexLexesTo(r"[\%s]" % ch, "python",
                [("charset_operator", 0), ("charescape", 2),
                 ("charset_operator", 3)])
            self._assertRegexLexesTo(r"[foo\%sbar]" % ch, "python",
                [("charset_operator", 0), ("text", 3), ("charescape", 5),
                 ("text", 8), ("charset_operator", 9)])
        # - octal escapes
        for octesc in (r"\0", r"\01", r"\001", r"\100"):
            length = len(octesc)
            self._assertRegexLexesTo(r"[%s]" % octesc, "python",
                [("charset_operator", 0), ("charescape", length),
                 ("charset_operator", length+1)])
        # - hex escapes
        for hexesc in (r"\x00", r"\x42", r"\xa3", r"\x3a", r"\xA3", r"\x3A",
                       r"\xFF"):
            self._assertRegexLexesTo(r"[%s]" % hexesc, "python",
                [("charset_operator", 0), ("charescape", 4),
                 ("charset_operator", 5)])
        self._assertRegexLexesTo(r"[foo\xFFbar]", "python",
            [("charset_operator", 0), ("text", 3), ("charescape", 7),
             ("text", 10), ("charset_operator", 11)])
        self._assertRegexLexRaises(r"[\xG]", "python", LexRegexError, 1, 3)
        self._assertRegexLexRaises(r"[\x3G]", "python", LexRegexError, 1, 4)

        # ranges in charsets
        self._assertRegexLexesTo(r"[a-b]", "python",
            [("charset_operator", 0), ("text", 1), ("special", 2),
             ("text", 3), ("charset_operator", 4)])
        self._assertRegexLexesTo(r"[a-zA-Z0-9]", "python",
            [("charset_operator", 0),
             ("text", 1), ("special", 2), ("text", 4),
                          ("special", 5), ("text", 7),
                          ("special", 8), ("text", 9),
             ("charset_operator", 10)])
        self._assertRegexLexesTo(r"[b-b]", "python",
            [("charset_operator", 0), ("text", 1), ("special", 2),
             ("text", 3), ("charset_operator", 4)])
        self._assertRegexLexesTo(r"[\b-b]", "python",
            [("charset_operator", 0), ("charescape", 2), ("special", 3),
             ("text", 4), ("charset_operator", 5)])
        self._assertRegexLexesTo(r"[\b-\t]", "python",
            [("charset_operator", 0), ("charescape", 2), ("special", 3),
             ("charescape", 5), ("charset_operator", 6)])
        self._assertRegexLexesTo(r"[\x08-b]", "python",
            [("charset_operator", 0), ("charescape", 4), ("special", 5),
             ("text", 6), ("charset_operator", 7)])
        for octesc in (r"\0", r"\01", r"\001", r"\100"):
            length = len(octesc)
            self._assertRegexLexesTo(r"[%s-b]" % octesc, "python",
                [("charset_operator", 0), ("charescape", length), ("special", length+1),
                 ("text", length+2), ("charset_operator", length+3)])
            self._assertRegexLexRaises(r"[b-%s]" % octesc, "python",
                                       LexRegexError, 1, length+3)
        self._assertRegexLexesTo(r"[b-]", "python",
            [("charset_operator", 0), ("text", 2), ("charset_operator", 3)])
        self._assertRegexLexesTo(r"[b]-", "python",
            [("charset_operator", 0), ("text", 1), ("charset_operator", 2),
             ("text", 3)])
        self._assertRegexLexesTo(r"a-b", "python", [("text", 2)])
        self._assertRegexLexRaises(r"[b-\w]", "python", LexRegexError, 1, 5)

        # illegal charsets
        self._assertRegexLexRaises(r"[", "python", LexRegexError, 0, 1)
        self._assertRegexLexRaises(r"[]", "python", LexRegexError, 0, 2)
        self._assertRegexLexRaises(r"[abc", "python", LexRegexError, 0, 4)
        self._assertRegexLexRaises(r"foo[", "python", LexRegexError, 3, 4)
        self._assertRegexLexRaises(r"foo[bar", "python", LexRegexError, 3, 7)

    def test_core_re_tests(self):
        if sys.platform.startswith("win"):
            libDir = os.path.join(sys.prefix, "Lib")
        else:
            ver = '.'.join(sys.version_info[:2])
            libDir = os.path.join(sys.prefix, "lib", "python%s" % ver)
        coreTestDir = os.path.join(libDir, "test")
        sys.path.insert(0, coreTestDir)
        import re_tests
        del sys.path[0]
        
        # re_tests.tests is a list of regular expression tests. Some of the
        # test dictate what patterns do and do not contain syntax errors.
        # This is relevant here.
        for testInfo in re_tests.tests:
            pattern, s, result = testInfo[:3]
            try:
                if result == re_tests.SYNTAX_ERROR:
                    self._assertRegexLexRaises(pattern, "python", LexRegexError,
                                               strict=0)
                else:
                    self._assertRegexLexSucceeds(pattern, "python")
            except LexRegexError, ex:
                print "pattern: '%s'" % pattern
                raise
            #except:
            #    print "XXX exc info: %s" % sys.exc_info()

    def test_weird_ones(self):
        # Test case found while playing with Rxx. Typically these are cases
        # where sre_parse.py and lexregex.py used to disagree on what was
        # valid.
        # Bug 32731:
        self._assertRegexLexesTo(r"[\+-.]", "python",
                                 [('charset_operator', 0),
                                  ('charescape', 2),
                                  ('special', 3),
                                  ('text', 4),
                                  ('charset_operator', 5)])
        self._assertRegexLexesTo(r"[\/-.]", "python",
                                 [('charset_operator', 0),
                                  ('charescape', 2),
                                  ('special', 3),
                                  ('text', 4),
                                  ('charset_operator', 5)])

    #XXX:TODO:
    # - sre_constants.error: look-behind requires fixed-width pattern
    #       (?<!foo(bar)?)
    #   Ack! This will be a pain.


#---- command line interface

def _test():
    suite = unittest.makeSuite(LexRegexTestCase)
    runner = unittest.TextTestRunner(sys.stdout, verbosity=2)
    result = runner.run(suite)

def _sreparse(regex):
    import sre_parse
    parsed = sre_parse.parse(regex)
    #pprint.pprint(parsed)
    print "["
    for part in parsed:
        s = pprint.pformat(part)
        s = ' ' + ' '.join(s.splitlines(1)) + ','
        #sys.stdout.write(s)
        print s
    print "]"
    
def main(argv):
    logging.basicConfig()
    try:
        optlist, args = getopt.getopt(argv[1:], "hVvtsR",
            ["help", "version", "verbose", "test", "sre", "replacement"])
    except getopt.GetoptError, msg:
        log.error("%s. Your invocation was: %s", msg, argv)
        log.error("Try 'lexregex --help'.")
        return 1
    language = "python"
    mode = "lexregex"
    for opt, optarg in optlist:
        if opt in ("-h", "--help"):
            sys.stdout.write(__doc__)
            return
        elif opt in ("-V", "--version"):
            print "lexregex %s" % '.'.join([str(i) for i in _version_])
            return
        elif opt in ("-v", "--verbose"):
            log.setLevel(logging.DEBUG)
        elif opt in ("-l", "--language"):
            language = optarg
        elif opt in ("-t", "--test"):
            return _test()
        elif opt in ("-s", "--sre"):
            mode = "sreparse"
        elif opt in ("-R", "--replacement"):
            mode = "lexreplacement"

    if len(args) != 1:
        log.error("incorrect number of arguments: %s", args)
        return 1
    pattern = args[0]

    try:
        if mode == "lexregex":
            for token in lexregex(pattern, language):
                print token
        elif mode == "lexreplacement":
            for token in lexreplacement(pattern, language):
                print token
        elif mode == "sreparse":
            _sreparse(regex)
        else:
            raise LexRegexError("unknown processing mode: '%s'" % mode)
    except LexRegexError, ex:
        if log.isEnabledFor(logging.DEBUG):
            log.exception("error in lexregex()")
        else:
            log.error(str(ex))
        return 1


if __name__ == "__main__":
    __file__ = os.path.abspath(sys.argv[0])
    sys.exit( main(sys.argv) )


