# Copyright (c) 2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""koSCCHistoryItem - The history for a SCC file"""

from xpcom import components, COMException, ServerException, nsError

class koSCCHistoryItem:
    _com_interfaces_ = [components.interfaces.koISCCHistoryItem]
    _reg_clsid_ = "{425DA3EF-3910-4790-B1EC-19DA4B86EFA6}"
    _reg_contractid_ = "@activestate.com/koSCCHistoryItem;1"
    _reg_desc_ = "History for a SCC file"

    def __init__(self):
        self.version = ""
        self.change = ""
        self.author = ""
        self.date = ""
        self.action = ""
        self.message = ""
        self.uri = ""
