from xpcom import components, ServerException

from koLanguageServiceBase import *

# see http://haskell.org/
class koHaskellLanguage(KoLanguageBase):
    name = "Haskell"
    _reg_desc_ = "%s Language" % name
    _reg_contractid_ = "@activestate.com/koLanguage?language=%s;1" \
                       % (name)
    _reg_clsid_ = "{2545AA9A-53EB-11DA-BF7A-000D935D3368}"
    _reg_categories_ = [("komodo-language", name)]

    commentDelimiterInfo = {
        "line": [ "--" ]
    }

    defaultExtension = ".hs" 

    supportsSmartIndent = "brace"
    sciMozLexer = components.interfaces.ISciMoz.SCLEX_HASKELL
    searchURL = "http://www.haskell.org/"

    _stateMap = {
        'default': ('SCE_HA_DEFAULT',),
        'keywords': ('SCE_HA_KEYWORD',),
        'identifiers': ('SCE_HA_IDENTIFIER',),
        'comments': ('SCE_HA_COMMENTLINE','SCE_HA_COMMENTBLOCK',
                     'SCE_HA_COMMENTBLOCK2', 'SCE_HA_COMMENTBLOCK3',),
        'operators': ('SCE_HA_OPERATOR',),
        'numbers': ('SCE_HA_NUMBER',),
        'strings': ('SCE_HA_STRING', 'SCE_HA_CHARACTER',),
        'class': ('SCE_HA_CLASS',),
        'module': ('SCE_HA_MODULE',),
        'data': ('SCE_HA_DATA',),
        'capital': ('SCE_HA_CAPITAL',),
        'import': ('SCE_HA_IMPORT',),
        'instance': ('SCE_HA_INSTANCE',),
        }
    sample = """
import Monad
data Array = MkArray [Value]
    deriving (Show, Eq, Typeable)
deduce (Animal name _) attribs = do
  putStr ("Is the animal you're thinking of a " ++ name ++ "? [True|False] ")
  answer <- getLine
  if read answer
    then return ()
    else notFound attribs
"""

    def get_lexer(self):
        if self._lexer is None:
            self._lexer = KoLexerLanguageService()
            self._lexer.setLexer(self.sciMozLexer)
            self._lexer.setKeywords(0, self._keywords)
            self._lexer.supportsFolding = 1
        return self._lexer

    _keywords = ("""
    case class data default deriving do else if import in
    infix infixl infixr instance let module newtype of
    then type where
    """ + 
    # Extra keywords mentioned in http://www.haskell.org/haskellwiki/Keywords
    # that aren't in http://haskell.org/definition/haskell98-report.pdf
    """
    as forall foreign hiding mdo qualified 
    """).split()
    _keywords.sort()
