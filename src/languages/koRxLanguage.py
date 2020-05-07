from xpcom import components, ServerException

from koLanguageServiceBase import *

class koRxLanguage(KoLanguageBase):
    name = "Rx"
    _reg_desc_ = "%s Language" % name
    _reg_contractid_ = "@activestate.com/koLanguage?language=%s;1" \
                       % (name)
    _reg_clsid_ = "{4F13B454-43E9-41E7-AE72-F8EED38119B6}"
    _reg_categories_ = [("komodo-language", name)]
    
    internal = 1
    internalLanguage = 1
    def get_lexer(self):
        if self._lexer is None:
            self._lexer = KoLexerLanguageService()
            self._lexer.setLexer(components.interfaces.ISciMoz.SCLEX_NULL)
            self._lexer.supportsFolding = 0
        return self._lexer
