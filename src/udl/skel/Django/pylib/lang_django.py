#!/usr/bin/env python
# Copyright (c) 2006 ActiveState Software Inc.
# See LICENSE.txt for license details.

"""Django support for codeintel"""

import logging

from codeintel2.common import *
from codeintel2.langintel import LangIntel
from codeintel2.udl import UDLLexer, UDLBuffer, UDLCILEDriver, XMLParsingBufferMixin

if _xpcom_:
    from xpcom.server import UnwrapObject

#---- globals

lang = "Django"
log = logging.getLogger("codeintel.django")


django_keywords = [
    "and",
    "as",
    "by",
    "in",
    "not",
    "or",
]

django_tags = [
    "autoescape",
    "block",
    "blocktrans",
    "comment",
    "cycle",
    "debug",
    "elif",
    "else",
    "empty",   # used with for loop
    "extends",
    "filter",
    "firstof",
    "for",
    "if",
    "ifchanged",
    "ifequal",
    "ifnotequal",
    "include",
    "load",
    "lorem",
    "now",
    "regroup",
    "reversed",
    "spaceless",
    "ssi",
    "templatetag",
    "url",
    "verbatim",
    "widthratio",
    "with",

    # end tags
    "endautoescape",
    "endblock",
    "endblocktrans",
    "endcomment",
    "endfilter",
    "endfor",
    "endif",
    "endifchanged",
    "endifequal",
    "endifnotequal",
    "endspaceless",
    "endverbatim",
    "endwith",

    # Escape keywords
    "openblock",
    "closeblock",
    "openvariable",
    "closevariable",
    "openbrace",
    "closebrace",
]

django_default_filter_names = [
    # These are default filter names in django
    "add",
    "addslashes",
    "capfirst",
    "center",
    "cut",
    "date",
    "default",
    "default_if_none",
    "dictsort",
    "dictsortreversed",
    "divisibleby",
    "escape",
    "escapejs",
    "filesizeformat",
    "first",
    "floatformat",
    "force_escape",
    "get_digit",
    "iriencode",
    "join",
    "last",
    "length",
    "length_is",
    "linebreaks",
    "linebreaksbr",
    "linenumbers",
    "ljust",
    "lower",
    "make_list",
    "phone2numeric",
    "pluralize",
    "pprint",
    "random",
    "removetags",
    "rjust",
    "safe",
    "safeseq",
    "slice",
    "slugify",
    "stringformat",
    "striptags",
    "time",
    "timesince",
    "timeuntil",
    "title",
    "truncatechars",
    "truncatechars_html",
    "truncatewords",
    "truncatewords_html",
    "unordered_list",
    "upper",
    "urlencode",
    "urlize",
    "urlizetrunc",
    "wordcount",
    "wordwrap",
    "yesno",
]


#---- language support

class DjangoLexer(UDLLexer):
    lang = lang

class DjangoBuffer(UDLBuffer, XMLParsingBufferMixin):
    lang = lang
    tpl_lang = lang
    m_lang = "HTML"
    css_lang = "CSS"
    csl_lang = "JavaScript"
    ssl_lang = "Django"

    # Characters that should close an autocomplete UI:
    # - wanted for XML completion: ">'\" "
    # - wanted for CSS completion: " ('\";},.>"
    # - wanted for JS completion:  "~`!@#%^&*()-=+{}[]|\\;:'\",.<>?/ "
    # - dropping ':' because I think that may be a problem for XML tag
    #   completion with namespaces (not sure of that though)
    # - dropping '[' because need for "<!<|>" -> "<![CDATA[" cpln
    # - dropping '-' because causes problem with CSS (bug 78312)
    # - dropping '!' because causes problem with CSS "!important" (bug 78312)
    cpln_stop_chars = "'\" (;},~`@#%^&*()=+{}]|\\;,.<>?/"


class DjangoLangIntel(LangIntel):
    lang = lang

    # Used by ProgLangTriggerIntelMixin.preceding_trg_from_pos()
    trg_chars = tuple('| ')
    calltip_trg_chars = tuple()

    def trg_from_pos(self, buf, pos, implicit=True, DEBUG=False):
        """
            CODE       CONTEXT      RESULT
            '{<|>'     anywhere     tag names, i.e. {% if %}
            'foo|<|>'  filters      filter names, i.e. {{ foo|capfirst }}
        """
        #DEBUG = True # not using 'logging' system, because want to be fast
        if DEBUG:
            print "\n----- Django trg_from_pos(pos=%r, implicit=%r) -----"\
                  % (pos, implicit)

        if pos < 2:
            return None
        accessor = buf.accessor
        last_pos = pos - 1
        last_char = accessor.char_at_pos(last_pos)
        if DEBUG:
            print "  last_pos: %s" % last_pos
            print "  last_char: %r" % last_char
            print 'accessor.text_range(last_pos-2, last_pos): %r' % (accessor.text_range(last_pos-2, last_pos), )

        if last_char == " " and \
           accessor.text_range(last_pos-2, last_pos) == "{%":
            if DEBUG:
                print "  triggered: 'complete-tags'"
            return Trigger(lang, TRG_FORM_CPLN,
                           "complete-tags", pos, implicit)

        if last_char == "|":
            if DEBUG:
                print "  triggered: 'complete-filters'"
            return Trigger(lang, TRG_FORM_CPLN,
                           "complete-filters", pos, implicit)


    _djangotag_cplns =    [ ("element", t) for t in sorted(django_tags) ]
    _djangofilter_cplns = [ ("function", t) for t in sorted(django_default_filter_names) ]

    def async_eval_at_trg(self, buf, trg, ctlr):
        if _xpcom_:
            trg = UnwrapObject(trg)
            ctlr = UnwrapObject(ctlr)

        ctlr.start(buf, trg)

        # Django tag completions
        if trg.id == (lang, TRG_FORM_CPLN, "complete-tags"):
            ctlr.set_cplns(self._djangotag_cplns)
            ctlr.done("success")
            return
        if trg.id == (lang, TRG_FORM_CPLN, "complete-filters"):
            ctlr.set_cplns(self._djangofilter_cplns)
            ctlr.done("success")
            return

        ctlr.done("success")


class DjangoCILEDriver(UDLCILEDriver):
    lang = lang
    csl_lang = "JavaScript"
    tpl_lang = "Django"
    css_lang = "CSS"



#---- registration

def register(mgr):
    """Register language support with the Manager."""
    mgr.set_lang_info(lang,
                      silvercity_lexer=DjangoLexer(),
                      buf_class=DjangoBuffer,
                      langintel_class=DjangoLangIntel,
                      import_handler_class=None,
                      cile_driver_class=DjangoCILEDriver,
                      is_cpln_lang=True)

