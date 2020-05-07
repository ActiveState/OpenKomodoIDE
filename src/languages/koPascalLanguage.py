#!python
# Copyright (c) 2001-2012 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

from xpcom import components, ServerException

from koLanguageKeywordBase import KoLanguageKeywordBase
from koLanguageServiceBase import KoLexerLanguageService, FastCharData

sci_constants = components.interfaces.ISciMoz

class koPascalLanguage(KoLanguageKeywordBase):
    name = "Pascal"
    _reg_desc_ = "%s Language" % name
    _reg_contractid_ = "@activestate.com/koLanguage?language=%s;1" \
                       % (name)
    _reg_clsid_ = "{8AE35E4C-0EC9-49f2-A534-8FEAB91D261D}"
    _reg_categories_ = [("komodo-language", name)]

    defaultExtension = ".pas"
    commentDelimiterInfo = {
        # See the following for info on Pascal comments:
        #  http://www.math.uni-hamburg.de/it/software/fpk/ref/node7.html
        #XXX The line Pascal comment is a Delphi only thing, so I am leaving
        #    it out for now.
        #"line": [ "//" ],
        "block": [ ("{",  "}"),
                   ("(*", "*)") ],
        "markup": "*",
    }
    supportsSmartIndent = "keyword"
    _indenting_statements = ['begin', 'record', 'repeat', 'case', ]
    _dedenting_statements = ['goto', 'halt', ]
    _keyword_dedenting_keywords = ['end', 'until', ]

    _stateMap = {
        'default': ('SCE_PAS_DEFAULT',),
        'keywords': ('SCE_PAS_WORD', 'SCE_PAS_ASM'),
        'comments': ('SCE_PAS_COMMENT', 'SCE_PAS_COMMENT2', 'SCE_PAS_COMMENTLINE',),
        'identifiers': ('SCE_PAS_IDENTIFIER',),
        'preprocessor': ('SCE_PAS_PREPROCESSOR', 'SCE_PAS_PREPROCESSOR2'),
        'numbers': ('SCE_PAS_NUMBER', 'SCE_PAS_HEXNUMBER',),
        'strings': ('SCE_PAS_STRING', 'SCE_PAS_STRINGEOL', 'SCE_PAS_CHARACTER',),
        }

    sample = """
program MyProg(input, output)
(* Warning: this program might not compile. *)
  begin
    { that's because there's no
      Pascal compiler on this machine.
    }
    var myVar:integer;
    myVar := 5;
    if (myVar > 3) begin
      writeln("Pascal is fun!!!!")
    end
  end
end.
"""    
    def __init__(self):
        KoLanguageKeywordBase.__init__(self)
        self._style_info.update(
            _block_comment_styles = [sci_constants.SCE_PAS_COMMENT,
                                     sci_constants.SCE_PAS_COMMENT2,
                                     sci_constants.SCE_PAS_COMMENTLINE],
            _indent_styles = [sci_constants.SCE_PAS_OPERATOR],
            _variable_styles = [sci_constants.SCE_PAS_IDENTIFIER],
            _lineup_close_styles = [sci_constants.SCE_PAS_OPERATOR],
            _lineup_styles = [sci_constants.SCE_PAS_OPERATOR],
            _keyword_styles = [sci_constants.SCE_PAS_WORD],
            _default_styles = [sci_constants.SCE_PAS_DEFAULT],
            _ignorable_styles = [sci_constants.SCE_PAS_COMMENT,
                                 sci_constants.SCE_PAS_COMMENT2,
                                 sci_constants.SCE_PAS_COMMENTLINE,
                                 sci_constants.SCE_PAS_NUMBER],
            )
        self._fastCharData = \
            FastCharData(trigger_char=";",
                         style_list=(sci_constants.SCE_PAS_OPERATOR, ),
                         skippable_chars_by_style={ sci_constants.SCE_PAS_OPERATOR : "])" },
                         for_check=True)

    def get_lexer(self):
        if self._lexer is None:
            self._lexer = KoLexerLanguageService()
            self._lexer.setLexer(components.interfaces.ISciMoz.SCLEX_PASCAL)
            self._lexer.setKeywords(0, self._keywords)
            self._lexer.setKeywords(1, self._keywords2)
            self._lexer.supportsFolding = 1
        return self._lexer

    _keywords = """and array asm begin case cdecl class const constructor default 
destructor div do downto else end end. except exit exports external far file 
finalization finally for function goto if implementation in index inherited 
initialization inline interface label library message mod near nil not 
object of on or out overload override packed pascal private procedure program 
property protected public published raise read record register repeat resourcestring 
safecall set shl shr stdcall stored string then threadvar to try type unit 
until uses var virtual while with write writeln xor""".split()

    _keywords2 = """write read default public protected private property
            published stored""".split()

