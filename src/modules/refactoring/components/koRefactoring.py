# Copyright (c) 2004-2013 ActiveState Software Inc.
#   See the file LICENSE.txt for licensing information. */

from xpcom import components, COMException, ServerException, nsError

class koRefactoring:
    _com_interfaces_ = [components.interfaces.koIRefactorVariableInfo]
    _reg_clsid_ = "{841a61d3-67e2-4b70-8abe-383063158c85}"
    _reg_contractid_ = "@activestate.com/koRefactorVariableInfo;1"
    _reg_desc_ = "Common Back-end Refactoring components"

    def __init__(self):
        self._name = ""
        self._flags = -1

    def get_name(self):
        return self._name

    def get_flags(self):
        return self._flags

    def init(self, name, flags):
        self._name = name
        self._flags = flags

    def add(self, flags):
        self._flags |= flags

    def update(self, flags):
        self._flags = flags

    
