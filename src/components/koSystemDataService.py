#!/usr/bin/env python
# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import sys
import os
import logging
from xpcom import components, nsError, ServerException, COMException


log = logging.getLogger("koSystemDataService")


#---- component implementation

class KoSystemDataService:
    # This is just a very light wrapper around the sysdata.py module.
    _com_interfaces_ = [components.interfaces.koISystemDataService]
    _reg_clsid_ = "{6BFADA7E-7032-4128-842C-E49C1F8808DA}"
    _reg_contractid_ = "@activestate.com/koSystemDataService;1"
    _reg_desc_ = "Service for managing named, cache-able system data"

    def __init__(self):
        self._lastErrorSvc = components.classes["@activestate.com/koLastErrorService;1"]\
                             .getService(components.interfaces.koILastErrorService)
    
    def _get(self, name):
        import sysdata
        try:
            return sysdata.get(name)
        except sysdata.SysDataError, ex:
            errmsg = str(ex)
            log.error(errmsg)
            self.lastErrorSvc.setLastError(0, errmsg)
            raise ServerException(nsError.NS_ERROR_UNEXPECTED, errmsg)

    getBoolean = _get
    getLong = _get
    getDouble = _get
    getString = _get
    getStringList = _get

    def _set(self, name, value):
        import sysdata
        try:
            return sysdata.set(name, value)
        except sysdata.SysDataError, ex:
            errmsg = str(ex)
            log.error(errmsg)
            self.lastErrorSvc.setLastError(0, errmsg)
            raise ServerException(nsError.NS_ERROR_UNEXPECTED, errmsg)

    setString = _set

    def flush(self, name):
        import sysdata
        try:
            return sysdata.flush(name)
        except sysdata.SysDataError, ex:
            errmsg = str(ex)
            log.error(errmsg)
            self.lastErrorSvc.setLastError(0, errmsg)
            raise ServerException(nsError.NS_ERROR_UNEXPECTED, errmsg)

