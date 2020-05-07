# Copyright (c) 2000-2008 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

from collections import defaultdict

from xpcom import components, nsError, ServerException, COMException

import logging
log = logging.getLogger('koFormatterService')
#log.setLevel(logging.DEBUG)


class koFormatterService(object):
    _com_interfaces_ = [components.interfaces.koIFormatterService]
    _reg_desc_ = "Komodo Formatter Service"
    _reg_contractid_ = "@activestate.com/koFormatterService;1"
    _reg_clsid_ = "{fdff202a-5340-4e74-8aca-7f62aa0a50a6}"
    
    # Rules:
    #  1. There should always be at least one default formatter, no
    #     matter what formatters get installed/uninstalled. This is called the
    #     _generic_formatter in this class.
    #  2. The user preferenced formatter depends upon Komodo's preferences,
    #     which may depending upon the project/file that it is used upon.

    def __init__(self):
        self._all_formatters = None
        self._formatters_from_language = defaultdict(list)
        self._ensureFormattersAreLoaded()

    def _ensureFormattersAreLoaded(self):
        if self._all_formatters is not None:
            return

        # Get the registered formatter XPCOM components.
        formatters = []
        catman = components.classes["@mozilla.org/categorymanager;1"].\
                        getService(components.interfaces.nsICategoryManager)
        category = 'category-komodo-formatter'
        names = catman.enumerateCategory(category)
        while names.hasMoreElements():
            nameObj = names.getNext()
            nameObj.QueryInterface(components.interfaces.nsISupportsCString)
            name = nameObj.data
            cid = catman.getCategoryEntry(category, name)
            log.info("Adding %r formatter, cid: %r", name, cid)
            try:
                formatter = components.classes[cid].\
                                getService(components.interfaces.koIFormatter)
                formatters.append(formatter)
            except Exception, e:
                log.exception("Unable to load %r formatter, cid: %r",
                              name, cid)
            else:
                try:
                    languagues = formatter.getSupportedLanguages()
                    for lang in languagues:
                        self._formatters_from_language[lang].append(formatter)
                except Exception, e:
                    log.exception("Unable to get supported languages for "
                                  "%r formatter, cid: %r", name, cid)
        self._all_formatters = formatters

    def getAllFormatters(self):
        return self._all_formatters

    def getAllFormattersForLanguage(self, lang):
        return self._formatters_from_language[lang] + \
                self._formatters_from_language["all"]

    def getFormatterWithName(self, name):
        for formatter in self.getAllFormatters():
            if formatter.name == name:
                return formatter
        return None

    def getFormatterWithPrettyName(self, prettyName):
        for formatter in self.getAllFormatters():
            if formatter.prettyName == prettyName:
                return formatter
        return None

    def getFormatterForContext(self, context):
        # Return the first formatter matching the context's lang.
        formatter = None
        lang = context.lang
        if (context.prefset.hasPref('configuredFormatters')):
            prefs = context.prefset.getPref('configuredFormatters')
            for i in range(prefs.length):
                uuid = prefs.getString(i)
                fpref = context.prefset.getPref(uuid)
                if not fpref or fpref.getString("lang", "") not in (lang, "*"):
                    continue
                formatter = self.getFormatterWithName(fpref.getString("formatter_name", ""))
                if formatter:
                    # Update the context prefset for the specific formatter
                    # configuration.
                    context.formatter_prefset = fpref
                    # This is the one we want.
                    break
        return formatter

    def createFormatterContextFromView(self, view):
        context = components.classes["@activestate.com/koFormatterScimozContext;1"].\
                    createInstance(components.interfaces.koIFormatterScimozContext)
        # XXX: What to do for UDL?
        context.lang = view.koDoc.language
        scimoz = view.scimoz
        operateOnSelection = False
        selectedText = scimoz.selText
        if selectedText:
            # If the selected text has newline characters in it or *is* an
            # entire line (without the end-of-line) then "operate on
            # selection".
            anchorPos = scimoz.anchor
            currentPos = scimoz.currentPos
            if currentPos < anchorPos:
                # Swap them around.
                anchorPos, currentPos = currentPos, anchorPos
            startLineNo = scimoz.lineFromPosition(anchorPos)
            endLineNo = scimoz.lineFromPosition(currentPos)
            if ((endLineNo > startLineNo) or
                (anchorPos == scimoz.positionFromLine(startLineNo) and
                currentPos == scimoz.getLineEndPosition(startLineNo))):
                operateOnSelection = True
        if operateOnSelection:
            context.type = components.interfaces.koIFormatterContext.FORMAT_SELECTION
            context.text = selectedText
        else:
            context.type = components.interfaces.koIFormatterContext.FORMAT_TEXT
            context.text = scimoz.text
        if view.koDoc.isUntitled:
            context.uri = ""
        else:
            context.uri = view.koDoc.file.URI
        context.encoding = view.encoding
        context.prefset = view.prefs
        context.scimoz = scimoz
        return context

    def getFormatterAndContextFromView(self, view):
        formatter = None
        context = self.createFormatterContextFromView(view)
        if context:
            formatter = self.getFormatterForContext(context)
        return formatter, context
