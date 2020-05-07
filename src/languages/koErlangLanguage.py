from xpcom import components, ServerException

from koLanguageServiceBase import FastCharData, KoLanguageBase, \
                                  KoLexerLanguageService, sci_constants

# Erlang info at http://www.erlang.org/

class koErlangLanguage(KoLanguageBase):
    name = "Erlang"
    _reg_desc_ = "%s Language" % name
    _reg_contractid_ = "@activestate.com/koLanguage?language=%s;1" \
                       % (name)
    _reg_clsid_ = "{0153c47a-f668-41d4-8519-9ecd6b1c5ba0}"
    _reg_categories_ = [("komodo-language", name)]

    _stateMap = {
        'default': ('SCE_ERLANG_DEFAULT',),
        'comments': ('SCE_ERLANG_COMMENT',
                     'SCE_ERLANG_COMMENT_FUNCTION',
                     'SCE_ERLANG_COMMENT_MODULE',
                     'SCE_ERLANG_COMMENT_DOC',
                     'SCE_ERLANG_COMMENT_DOC_MACRO',
                     ),
        'variables': ('SCE_ERLANG_VARIABLE',),
        'numbers': ('SCE_ERLANG_NUMBER',),
        'keywords': ('SCE_ERLANG_KEYWORD',),
        'strings': ('SCE_ERLANG_STRING',
                    'SCE_ERLANG_CHARACTER',),
        'operators': ('SCE_ERLANG_OPERATOR',),
        'functions': ('SCE_ERLANG_FUNCTION_NAME',),
        'macros': ('SCE_ERLANG_MACRO',),
        'records': ('SCE_ERLANG_RECORD',),
        'atoms': ('SCE_ERLANG_ATOM',),
        'nodes': ('SCE_ERLANG_NODE_NAME',),
        'unknown': ('SCE_ERLANG_UNKNOWN',),
    }
    defaultExtension = '.erl'
    commentDelimiterInfo = {
        "line": [ "%" ],
    }
    
    sample = """-module(test).
-export([fac/1]).

fac(0) -> 1;
fac(N) -> N * fac(N-1).
"""    
    def __init__(self):
        KoLanguageBase.__init__(self)
        self._fastCharData = \
            ErlangFastCharData(trigger_char=".",
                         style_list=(sci_constants.SCE_ERLANG_OPERATOR,),
                         skippable_chars_by_style={ sci_constants.SCE_ERLANG_OPERATOR : "])",
                                                    })

    _keywords="""
        after begin case catch cond end fun if let of query receive when
        define record export import include include_lib ifdef ifndef else endif undef
        apply attribute call do in letrec module primop try""".split()

    def get_lexer(self):
        if self._lexer is None:
            self._lexer = KoLexerLanguageService()
            self._lexer.setLexer(components.interfaces.ISciMoz.SCLEX_ERLANG)
            self._lexer.setKeywords(0, self._keywords)
        return self._lexer

class ErlangFastCharData(FastCharData):
    """ Subclass FastCharData because in Erlang "." is used as
        a statement delimiter, and we need to distinguish "."
        as a decimal point from a statement delimiter.
        """
    def moveCharThroughSoftChars(self, ch, scimoz):
        """
        In Erlang "." is both a statement terminator and the usual
        decimal point.  And unfortunately when it's pressed, it's colored
        as an operator, not a number, because no number follows.

        So if the previous character is numeric, return
        False, otherwise do the superclass method.
        """
        pos = scimoz.currentPos # char to right of the "."
        prevPos = scimoz.positionBefore(pos) - 1 # char to left of the '.'
        if scimoz.getStyleAt(prevPos) == scimoz.SCE_ERLANG_NUMBER:
            return False
        return FastCharData.moveCharThroughSoftChars(self, ch, scimoz)
