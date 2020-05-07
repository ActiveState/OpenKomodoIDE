# Copyright (c) 2000-2013 ActiveState Sofware Inc.
# See the file LICENSE.txt for licensing information.

import logging

from xpcom import components, COMException, ServerException, nsError
from koRefactoringLanguageServiceBase import KoRefactoringLanguageServiceBase

from koLanguageServiceBase import sci_constants

log = logging.getLogger("PerlRefactoringLangSvc")
#log.setLevel(logging.DEBUG)

class KoTclRefactoringLanguageService(KoRefactoringLanguageServiceBase):
    language_name = "Tcl"
    _com_interfaces_ = [components.interfaces.koIRefactoringLanguageService]
    _reg_clsid_ = "{e9529ffd-217e-4900-95a7-1dc747f477bd}"
    _reg_contractid_ = "@activestate.com/koRefactoringLanguageService;1?language=Tcl"
    _reg_desc_ = "Komodo %s Refactoring Language Service" % (language_name,)
    
    attributeDelimiters = (("::", sci_constants.SCE_TCL_OPERATOR),)
    supportsRefactoring = True
    
    def __init__(self):
        global _koIRefactorVariableInfo
        KoRefactoringLanguageServiceBase.__init__(self)
        _koIRefactorVariableInfo = components.interfaces.koIRefactorVariableInfo

    def getSearchTermForVariable(self, searchText, _):
        # Bug 95389: Tcl is one of the few non-shell langs that
        # defines vars without a '$', but refers to them with one.
        if searchText[0] == '$':
            searchTextBody = searchText[1:]
        else:
            searchTextBody = searchText
        compareText = searchTextBody
        adjustedSearchText = r'(?:\$|\b)' + searchTextBody + '\\b'
        return adjustedSearchText, compareText
