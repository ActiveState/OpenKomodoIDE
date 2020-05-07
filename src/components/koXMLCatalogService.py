#!/usr/bin/env python
# Copyright (c) 2006 activestate.com
# See the file LICENSE.txt for licensing information.

"""XMLCatalogService - ..."""

from xpcom.components import classes as Cc, interfaces as Ci
from xpcom.server import UnwrapObject

class XMLCatalogService:
    _com_interfaces_ = [Ci.koIXMLCatalogService]
    _reg_clsid_ = "{86d67309-70fe-11db-9e86-000d935d3368}"
    _reg_contractid_ = "@activestate.com/koXMLCatalogService;1"
    _reg_desc_ = "Service to help list available XML catalogs"

    def _get(self, kind, callback):
        def on_have_catalogs(request, response):
            try:
                cb = callback.callback
            except AttributeError:
                cb = callback # not XPCOM?
            items = response.get(kind)
            if items is None or not response.get("success"):
                cb(Ci.koIAsyncCallback.RESULT_ERROR, [])
            else:
                cb(Ci.koIAsyncCallback.RESULT_SUCCESSFUL, items)

        # CITODO: Dump?
        cisvc = UnwrapObject(Cc["@activestate.com/koCodeIntelService;1"]
                               .getService())
        cisvc.send(command="get-xml-catalogs", callback=on_have_catalogs)

    def getPublicIDList(self, callback):
        self._get("public", callback)
    
    def getSystemIDList(self, callback):
        self._get("system", callback)
    
    def getNamespaceList(self, callback):
        self._get("namespaces", callback)
