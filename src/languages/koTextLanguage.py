from xpcom import components, ServerException
from koLanguageServiceBase import *

class koTextLanguage(KoLanguageBase):
    name = "Text"
    _reg_desc_ = "%s Language" % name
    _reg_contractid_ = "@activestate.com/koLanguage?language=%s;1" \
                       % (name)
    _reg_clsid_ = "{CDFF6BC6-C21B-420c-9796-C90C37377FE6}"
    _reg_categories_ = [("komodo-language", name)]

    accessKey = 'e'
    primary = 1
    defaultExtension = ".txt"
    commentDelimiterInfo = { }
    sample = "Text files only have one style."

    def __init__(self):
        """In plain text we can't tell when a quote starts a sentence and
        when it means something else, so we simply never provide a close-quote.
        """
        KoLanguageBase.__init__(self)
        del self.matchingSoftChars["'"]
        del self.matchingSoftChars['"']

    def getEncodingWarning(self, encoding):
            return ''
        
    def get_commenter(self):
        if self._commenter is None:
            self._commenter = KoTextCommenterLanguageService()
        return self._commenter

class KoTextCommenterLanguageService(KoCommenterLanguageService):
    # Bug 90001 - make sure auto-comment on text files does nothing.
    def __init__(self):
        # Don't call the superclass
        pass

    def comment(self, scimoz):
        # Do nothing
        return
    
    def uncomment(self, scimoz):
        # Do nothing
        return
