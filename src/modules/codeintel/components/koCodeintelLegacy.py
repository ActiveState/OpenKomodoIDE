#!python
# Copyright (c) 2017 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

from xpcom.components import interfaces as Ci
from xpcom.components import classes as Cc
from xpcom import components
from xpcom.server import UnwrapObject
from zope.cachedescriptors.property import Lazy as LazyProperty
from zope.cachedescriptors.property import LazyClassAttribute
from findlib2 import find_all_matches
import logging
import threading
import langinfo
import json
import re

prefs = Cc["@activestate.com/koPrefService;1"].getService(Ci.koIPrefService).prefs
log = logging.getLogger("koCodeintelLegacy")
#log.setLevel(10)

FEATURE_COMPLETIONS = "completions"
FEATURE_SYMBOLBROWSER = "symbolbrowser"
FEATURE_SYMBOLLIST = "symbollist"
FEATURE_SYMBOLSCOPE = "symbolscope"
FEATURE_GOTODEF = "gotodef"

SYMBOLMAP = {
    "class": "CLS",
    "function": "FUN",
    "method": "MTH",
    "interface": "IFC",
    "object": "STRU"
}

class koCodeintelLegacy:

    _com_interfaces_ = [Ci.koICodeintelLegacy]
    _reg_desc_ = "CodeIntel - Legacy Service"
    _reg_clsid_ = "{0a2b6060-5366-4976-947c-2ffbd7a3676f}"
    _reg_contractid_ = "@activestate.com/codeintel/legacy;1"

    @LazyClassAttribute
    def lidb(self):
        return langinfo.get_default_database()

    @property
    def langinfo(self, language):
        return self.lidb.langinfo_from_komodo_lang(language)

    def _defer(self, name, args):
        log.debug("Deferring %s" % name)
        method = getattr(self, name)
        t = threading.Thread(target=method, args=args, name=name)
        t.start()

    @components.ProxyToMainThreadAsync
    def _callback(self, callback, value):
        callback.callback(0, json.dumps(value))

    def getCompletions(self, *args):
        self._defer("_getCompletions", args=args)

    def _getCompletions(self, buf, pos, path, parentPath, importPaths, language, limit, callback):
        langInfo = self.lidb.langinfo_from_komodo_lang(language)

        if not langInfo or getattr(langInfo, "legacy_codeintel", None) is None:
            return self._callback(callback, None)

        ci = langInfo.legacy_codeintel
        completions = ci.getCompletions(buf, pos, path, parentPath, importPaths)

        if completions:
            completions["entries"] = completions["entries"][:limit]

        return self._callback(callback, completions)


    def getDefinition(self, *args):
        self._defer("_getDefinition", args=args)

    def _getDefinition(self, buf, pos, path, parentPath, importPaths, language, callback):
        langInfo = self.lidb.langinfo_from_komodo_lang(language)

        if not langInfo or getattr(langInfo, "legacy_codeintel", None) is None:
            return self._callback(callback, None)

        ci = langInfo.legacy_codeintel
        definition = ci.getDefinition(buf, pos, path, parentPath, importPaths)

        return self._callback(callback, definition)

    def getLanguages(self, callback):
        self._defer("_getLanguages", args=(callback,))

    def _getLanguages(self, callback):
        languages = {}
        for langInfo in self.lidb.langinfos():
            supports = []

            if langInfo.section_regexes is not None:
                supports.append(FEATURE_SYMBOLBROWSER)
                supports.append(FEATURE_SYMBOLLIST)
                supports.append(FEATURE_SYMBOLSCOPE)

            if getattr(langInfo, "legacy_codeintel", None) is not None and \
               hasattr(langInfo.legacy_codeintel, "getCompletions"):
                supports.append(FEATURE_COMPLETIONS)
            if getattr(langInfo, "legacy_codeintel", None) is not None and \
               hasattr(langInfo.legacy_codeintel, "getDefinition"):
                supports.append(FEATURE_GOTODEF)

            if len(supports) == 0:
                continue

            languages[langInfo.name] = {
                "supports": supports,
                "api": "codeintel",
            }

        self._callback(callback, languages)
    
    def getSymbolsInBuffer(self, *args):
        self._defer("_getSymbolsInBuffer", args=args)
        
    def _getSymbolsInBuffer(self, buf, caretLine, caretPos, indentString, languageName, sortType, callback):
        result = self.__getSymbolsInBuffer(buf, caretLine, caretPos, indentString, languageName, sortType)
        return self._callback(callback, result)

    def getCaretScope(self, *args):
        self._defer("_getCaretScope", args=args)

    def _getCaretScope(self, buf, caretLine, caretPos, languageName, callback):
        symbol = self.__getSymbolsInBuffer(buf, caretLine, caretPos, "-1", languageName, "organic", True)
        return self._callback(callback, symbol)

    def __getSymbolsInBuffer(self, buf, caretLine, caretPos, indentString, languageName, sortType, returnActive = False):
        langInfo = self.lidb.langinfo_from_komodo_lang(languageName)
        
        if not langInfo or langInfo.section_regexes is None:
            return None
        
        section_hit_title_processor = langInfo.conformant_attr("section_hit_title_processor")

        symbols = []
        length = 0
        lowest_level = -1

        whitespace_re = re.compile(r"\s+")
        whitespace_start_re = re.compile(r"^\s+")

        for section_regex in langInfo.section_regexes:
            typ, regex = section_regex[:2]

            level = 0
            if len(section_regex) == 3:
                # Specifies the level as well.
                level = section_regex[2]
                
            end = len(buf)
            for match in find_all_matches(regex, buf):
                line = 0
                startPos = match.start()

                gd = match.groupdict()
                gn = match.groups()
                title = (gd.get("name")
                         or gn and gn[0].strip()
                         or match.group(0).strip())
                title = whitespace_re.sub(' ', title)

                if section_hit_title_processor is not None:
                    title = section_hit_title_processor(typ, match, title)
                    if type(title) is tuple:
                        typ, title = title

                if not title:
                    continue

                pos = match.start()

                if len(section_regex) == 2:
                    whitespace = whitespace_start_re.match(match.group(0))
                    if whitespace:
                        whitespace_len = len(whitespace.group(0))
                        pos = pos + whitespace_len
                        level = whitespace.group(0).count(indentString)
                        
                if lowest_level == -1 or level < lowest_level:
                    lowest_level = level

                _typ = typ
                if typ in SYMBOLMAP:
                    _typ = SYMBOLMAP[typ]
                    
                symbols.append({
                    "name": title,
                    "typehint": None,
                    "type": _typ,
                    "filename": None,
                    "line": -1,
                    "pos": pos,
                    "active": False,
                    "isScope": True,
                    "level": level,
                    "members": [],
                    "api": "legacy"
                })
        
        symbols = sorted(symbols, key=lambda k: k['pos'])

        result = []
        previous = None
        markedActive = False
        levelMap = {0: result}
        for symbol in symbols:
            symbol["level"] = symbol["level"] - lowest_level

            if previous and symbol["level"] > previous["level"]:
                levelMap[symbol["level"]] = previous["members"]

            if previous and symbol["level"] < previous["level"]:
                if sortType == "alpha":
                    parent[:] = sorted(parent, key=lambda k: k['name'])

            if not symbol["level"] in levelMap:
                symbol["level"] = 0

            parent = levelMap[symbol["level"]]
            parent.append(symbol)

            if symbol["pos"] > caretPos and previous and not markedActive:
                previous["active"] = True
                if returnActive:
                    return previous
                markedActive = True

            previous = symbol

        if sortType == "alpha":
            result = sorted(result, key=lambda k: k['name'])
            
        if returnActive:
            return None

        return result

class CodeIntelLegacyException(Exception):
    pass
