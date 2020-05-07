# Copyright (c) 2000-2008 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

from xpcom import components
from xpcom.client import WeakReference

import logging
log = logging.getLogger('koFormatterContext')
#log.setLevel(logging.DEBUG)


class koFormatterContext(object):
    _com_interfaces_ = [components.interfaces.koIFormatterContext]
    _reg_desc_ = "Komodo Formatter Context"
    _reg_contractid_ = "@activestate.com/koFormatterContext;1"
    _reg_clsid_ = "{60252ba9-0842-4005-9c54-c9dee71bda27}"

    lang = None
    text = ""
    encoding = None
    uri = None
    prefset = None

    def __init__(self):
        pass


class koFormatterScimozContext(koFormatterContext):
    _com_interfaces_ = [components.interfaces.koIFormatterContext,
                        components.interfaces.koIFormatterScimozContext]
    _reg_desc_ = "Komodo Formatter SciMoz Context"
    _reg_contractid_ = "@activestate.com/koFormatterScimozContext;1"
    _reg_clsid_ = "{b6e454dd-f5ea-44c5-97e4-9594cd8b6409}"

    _scimoz_weak_ref = None

    def __init__(self):
        koFormatterContext.__init__(self)

    # Could provide wrappers for the text attribute... but this does not work
    # so well for a selection, or per line formatting.
    #def _getText(self):
    #    if self.scimoz:
    #        return self.scimoz.text
    #    return ""
    #def _setText(self, text):
    #    if self.scimoz:
    #        self.scimoz.text = text
    #text = property(_getText, _setText)

    # Wrappers for the scimoz attribute, ensures we are using a weakreference.
    def _getScimoz(self):
        if self._scimoz_weak_ref:
            return self._scimoz_weak_ref()
        return None
    def _setScimoz(self, scimoz):
        if scimoz:
            self._scimoz_weak_ref = WeakReference(scimoz)
        else:
            self._scimoz_weak_ref = None
    scimoz = property(_getScimoz, _setScimoz)
