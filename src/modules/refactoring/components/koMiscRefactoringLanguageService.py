# Copyright (c) 2000-2013 ActiveState Sofware Inc.
# See the file LICENSE.txt for licensing information.

import logging

from xpcom import components, COMException, ServerException, nsError
from koRefactoringLanguageServiceBase import KoRefactoringLanguageServiceBase, getRefactoringLanguageService
from koLanguageServiceBase import sci_constants

log = logging.getLogger("MiscRefactoringLangSvc")
log.setLevel(logging.DEBUG)

class koNullRefactoringLanguageService(KoRefactoringLanguageServiceBase):
    _com_interfaces_ = [components.interfaces.koIRefactoringLanguageService]
    language_name = "None"
    _reg_clsid_ = "{036b51b5-0202-4a19-ad1a-c0b1cce4842a}"
    _reg_contractid_ = "@activestate.com/koBaseRefactoringLanguageService;1"
    _reg_desc_ = "Komodo Null Refactoring Language Service"

class koCPPRefactoringLanguageService(KoRefactoringLanguageServiceBase):
    _com_interfaces_ = [components.interfaces.koIRefactoringLanguageService]
    language_name = "C++"
    _reg_clsid_ = "{ba2f837c-6ee6-430b-9de8-7a83869afe58}"
    _reg_contractid_ = "@activestate.com/koRefactoringLanguageService;1?language=%s" % (language_name,)
    _reg_desc_ = "Komodo %s Refactoring Language Service" % (language_name,)
    
    attributeDelimiters = (("::", sci_constants.SCE_C_OPERATOR),
                           ("->", sci_constants.SCE_C_OPERATOR),)

class koErlangRefactoringLanguageService(KoRefactoringLanguageServiceBase):
    _com_interfaces_ = [components.interfaces.koIRefactoringLanguageService]
    language_name = "Erlang"
    _reg_clsid_ = "{84822357-da62-482d-9063-3f282d3d2447}"
    _reg_contractid_ = "@activestate.com/koRefactoringLanguageService;1?language=%s" % (language_name,)
    _reg_desc_ = "Komodo %s Refactoring Language Service" % (language_name,)
    
    attributeDelimiters = ((".", sci_constants.SCE_ERLANG_OPERATOR),)


class koEScriptRefactoringLanguageService(KoRefactoringLanguageServiceBase):
    _com_interfaces_ = [components.interfaces.koIRefactoringLanguageService]
    language_name = "EScript"
    _reg_clsid_ = "{588d835c-1b31-496b-9a52-06143a7c81b6}"
    _reg_contractid_ = "@activestate.com/koRefactoringLanguageService;1?language=%s" % (language_name,)
    _reg_desc_ = "Komodo %s Refactoring Language Service" % (language_name,)
    
    attributeDelimiters = ((".", sci_constants.SCE_ERLANG_OPERATOR),)

class koJavaRefactoringLanguageService(KoRefactoringLanguageServiceBase):
    _com_interfaces_ = [components.interfaces.koIRefactoringLanguageService]
    language_name = "Java"
    _reg_clsid_ = "{3a2788b7-cd3f-42e9-834d-5f32c853343c}"
    _reg_contractid_ = "@activestate.com/koRefactoringLanguageService;1?language=%s" % (language_name,)
    _reg_desc_ = "Komodo %s Refactoring Language Service" % (language_name,)
    
    attributeDelimiters = (("::", sci_constants.SCE_C_OPERATOR),
                           (".", sci_constants.SCE_C_OPERATOR),)
    
class koCSharpRefactoringLanguageService(KoRefactoringLanguageServiceBase):
    _com_interfaces_ = [components.interfaces.koIRefactoringLanguageService]
    language_name = "CSharp"
    _reg_clsid_ = "{266c1f45-ba0d-4c57-b869-6aab3cd92557}"
    _reg_contractid_ = "@activestate.com/koRefactoringLanguageService;1?language=%s" % (language_name,)
    _reg_desc_ = "Komodo %s Refactoring Language Service" % (language_name,)
    
    attributeDelimiters = (("::", sci_constants.SCE_C_OPERATOR),
                           (".", sci_constants.SCE_C_OPERATOR),)
    
# A factory component for getting the actual language's refactoring lang svc
# Do this to avoid having to create a service for every single language

class KoRefactoringLangSvcFactory:
    _com_interfaces_ = [components.interfaces.koIRefactoringLangSvcFactory]
    _reg_clsid_ = "{ab00c79f-c4dc-4e1a-a7bd-f90f52fb936b}"
    _reg_contractid_ = "@activestate.com/koRefactoringLangSvcFactory;1"
    _reg_desc_ = "Refactoring LangSvc Factory"

    def getRefactoringLangSvcForLanguage(self, languageName):
        return getRefactoringLanguageService(languageName)
