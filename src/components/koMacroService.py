#!/usr/bin/env python
# Copyright (c) 2003-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

from xpcom import components



#---- component implementation

class KoMacroService:
    _com_interfaces_ = [components.interfaces.koIMacroService]
    _reg_clsid_ = "D6126643-84DC-4DDE-9101-C4BF9B40F588"
    _reg_contractid_ = "@activestate.com/koMacroService;1"
    _reg_desc_ = "Service for running Macros"

    def __init__(self):
        # ensure that the koPartService is listening
        koPartSvc = components.classes["@activestate.com/koPartService;1"]\
            .getService(components.interfaces.koIPartService)
        self._observerSvc = components.classes["@mozilla.org/observer-service;1"]\
            .getService(components.interfaces.nsIObserverService)

    @components.ProxyToMainThreadAsync
    def runString(self, language, code):
        self._observerSvc.notifyObservers(self, language + '_macro', code)

    def runFile(self, language, filename):
        code = open(filename).read()
        self.runString(language, code)

