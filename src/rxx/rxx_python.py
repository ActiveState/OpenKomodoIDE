#!python
# Copyright (c) 2003-2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""
Use this module to evaluate Rxx expressions out-of-proc.

Reads a request packet as a JSON string from stdin.

Writes output as a JSON'ized dict to stdout.

Format of request packets:
{ operation: [match|matchAll|split|replace|replaceAll]
  pattern: string: a Python regex,
  options: a string consisting of the letters ismxl (l for locale)
  text: string: text to match
}

Format of response packets:
{
  status: [ok|error|matchError|matchFailure]
  exception: text of exception
  operation: [match|matchAll|split|replace|replaceAll]  -- should be same as input
  -- the following items are used so the launcher can build the
  lastGroupNames: array of group names
  lastNumGroups: # of named groups in the regex
  result: array of [:
     groups: array of [:
       group: dict:{
         span: [start,end]
         name: string|None
         value: string
         [replacement: string]
        }
      ]
    ]
    ### Note: for split: result: array of [string] (split results)
"""

import os, sys, re

# sys.path.insert(0, "c:/Program Files/ActiveState Komodo IDE 5.1/lib/python/Lib");
import json
import operator
import traceback

def _letter_options_to_numeric_options(optionString):
    letter_to_re_options = {
    'i' : re.I,
    'm' : re.M,
    's' : re.S,
    'x' : re.X,
    'l' : re.L,
    'u' : re.U,
    }
    options = [letter_to_re_options.get(x.lower(), 0) for
                   x in list(optionString)]
    return reduce(operator.or_, options, 0)

class Evaluator(object):
    def __init__(self, requestString):
        self.requestPacket = requestPacket = json.loads(requestString)
        self.op = requestPacket['operation']
        self.pattern = requestPacket['pattern']
        self.reFlags = _letter_options_to_numeric_options(requestPacket['options'])
        self.subjectText = requestPacket['text']
        self.regex = self._compile()

    def _compile(self):
        regex = re.compile(self.pattern, self.reFlags)
        if regex:
            self._lastNumGroups = regex.groups
            groupindex = [(num, name) for (name, num) in regex.groupindex.items()]
            groupindex.sort()
            self._lastGroupNames = [name for (num, name) in groupindex]
            return regex
        else:
            self._lastNumGroups = 0
            self._lastGroupNames = []
            return None

    def _groups_from_match_obj(self, match_obj, substitution=None):
        # Need to manually match up group name to group number.
        groupdict = match_obj.groupdict()
        span2name = {}
        if groupdict:
            for name in groupdict:
                span2name[match_obj.span(name)] = name

        group = {"name": None,
                 "span": match_obj.span(0),
                 "value": match_obj.group(0)}
        if substitution is not None:
            group["replacement"] = substitution
        groups = [group]
        for i in range(len(match_obj.groups())):
            value = match_obj.group(i+1)
            span = match_obj.span(i+1)
            group = {"name": span2name.get(span),
                     "span": span,
                     "value": value}
            if substitution is not None:
                group["replacement"] = ""
            groups.append(group)
        return groups

    def do_match(self):
        match_obj = self.regex.search(self.subjectText)
        if not match_obj:
            return { 'status': 'matchFailure' }
        groups = self._groups_from_match_obj(match_obj)
        return { 'status': 'ok',
                 'result': [groups] }

    def do_matchAll(self):
        searchText = self.subjectText
        lenSearchText = len(searchText)
        groupObjs = []

        #XXX When there are many many hits (say thousands), this is
        #    disturbingly slow. This is now asynchronous, but still
        #    doesn't produce results until it's finished.
        start = 0
        while start <= lenSearchText:
            match_obj = self.regex.search(searchText, start)
            if match_obj:
                groupObjs.append(self._groups_from_match_obj(match_obj))
                if match_obj.end() - match_obj.start():
                    start = match_obj.end()
                else: # match is zero length, advance at least one
                    start = match_obj.end() + 1
            else:
                break
        if groupObjs:
            return { 'status': 'ok', 'result': groupObjs }
        else:
            return { 'status': 'matchFailure' }

    def do_split(self):
        return { 'status': 'ok',
                 'result': self.regex.split(self.subjectText) }

    def do_replace(self):
        searchText = self.subjectText
        lenSearchText = len(searchText)
        groupObjs = []
        replacement = self.requestPacket['replacement']
        substitutions = []
        replacedText = searchText
        if self.regex:
            match_obj = self.regex.search(searchText)
            if match_obj:
                groupObjs.append(self._groups_from_match_obj(match_obj))
                try:
                    substitution = match_obj.expand(replacement)
                    replacedText = self.regex.sub(replacement, searchText, 1)
                except (re.error, IndexError, ValueError), ex:
                    # e.g.:
                    #   sre_constants.error: unterminated group name
                    #   IndexError: unknown group name
                    #   ValueError: invalid literal for int(): 9
                    pass
                else:
                    substitutions.append(substitution)
        if groupObjs and substitutions:
            retVal = { 'status': 'ok', 'result': groupObjs }
        elif groupObjs:
            retVal = { 'status': 'hybrid', 'subStatus': 'replaceError',
                       'exception':unicode(ex) }
        else:
            retVal = { 'status': 'hybrid', 'subStatus': 'matchFailure'}
        retVal['replacedText'] = replacedText
        retVal['substitutions'] = substitutions
        return retVal

    def do_replaceAll(self):
        searchText = self.subjectText
        lenSearchText = len(searchText)
        groupObjs = []
        replacement = self.requestPacket['replacement']
        substitutions = []
        replacedText = searchText
        if self.regex:
            # Again it would be better if we processed items as they
            # were returned.
            start = 0
            while start <= lenSearchText:
                match_obj = self.regex.search(searchText, start)
                if match_obj:
                    groupObjs.append(self._groups_from_match_obj(match_obj))
                    try:
                        substitution = match_obj.expand(replacement)
                        substitutions.append(substitution)
                    except (re.error, IndexError, ValueError), ex:
                        pass
                    if match_obj.end() - match_obj.start():
                        start = match_obj.end()
                    else: # match is zero length, advance at least one
                        start = match_obj.end() + 1
                else:
                    break
            try:
                replacedText = self.regex.sub(replacement, searchText)
            except (re.error, IndexError, ValueError), ex:
                pass

        if groupObjs and substitutions:
            retVal = { 'status': 'ok', 'result': groupObjs }
        elif groupObjs:
            retVal = { 'status': 'hybrid', 'subStatus': 'replaceError',
                       'exception':unicode(ex) }
        else:
            retVal = { 'status': 'hybrid', 'subStatus': 'matchFailure'}
        retVal['replacedText'] = replacedText
        retVal['substitutions'] = substitutions
        return retVal

    def run(self):
        res = getattr(self, 'do_' + self.op)()
        res['operation'] = self.op
        res['lastGroupNames'] = self._lastGroupNames
        res['lastNumGroups'] = self._lastNumGroups
        return res

def main():
    requestString = sys.stdin.read()
    retVal = evaluator = None
    try:
        evaluator = Evaluator(requestString)
    except re.error, ex:
        retVal = {'status': 'matchError', 'exception': unicode(ex)}
    except IndexError, ex:
        # Trap some bugs in sre_parse.py. For example:
        #   (?P<>asdf)
        # We will rely on the lexing to report a meaningful error message.
        retVal = {'status': 'error',
                   'exceptionClass': 'IndexError',
                   'exception': None}
    except Exception, ex:
        retVal = {'status': 'error',
                   'exception': unicode(ex) }
    if retVal is not None:
        if evaluator and evaluator.requestObject.get('regexOptional'):
            exitStatus = 0
            retVal = {'status': 'ok', 'result': None}
        else:
            exitStatus = 1
        json.dump(retVal, sys.stdout)
        sys.exit(exitStatus)

    try:
        json.dump(evaluator.run(), sys.stdout)
        sys.exit(0)
    except Exception, ex:
        json.dump({'status': 'error',
                   'exception': unicode(ex)}, sys.stdout)
    sys.exit(1)

if __name__ == "__main__":
    main()
