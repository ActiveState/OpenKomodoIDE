# Copyright (c) 2008 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""sccFileStatus - Class for storing file status information"""

from xpcom import components

class koSCCFileStatusItem:
    _reg_clsid_ = "{6f54bfd8-25d8-4d78-84fa-0f9fa12cf90c}"
    _com_interfaces_ = [components.interfaces.koISCCFileStatusItem]
    _reg_contractid_ = "@activestate.com/koSCCFileStatusItem;1"
    _reg_desc_ = "Status of a SCC file"

    def __init__(self):
        self.uriSpec = ""
        self.relativePath = ""
        self.status = 0
        self.isOutOfSync = False
