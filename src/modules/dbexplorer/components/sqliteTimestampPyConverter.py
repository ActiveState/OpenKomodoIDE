#!/usr/bin/env python
# Copyright (c) 2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""koSqliteTimestampPyConverter - ..."""

from xpcom import components, COMException, ServerException, nsError
import logging
log = logging.getLogger("sqliteTimestampPyConverter.py")
#log.setLevel(logging.DEBUG)

class SqliteBaseTimestampConverter(object):
    def get_label(self):
        return self._reg_desc_
    
    def get_supportedType(self):
        return 'float'
    
    def convert(self, rawValue):
        try:
            import sqlite3
        except LoadError:
            return rawValue
        try:
            conn = sqlite3.connect(":memory:")
            cu = conn.cursor()
            cu.execute("select %s(?)" % self._converterName, (rawValue,))
            newValue = cu.fetchone()[0]
            cu.close()
            conn.close()
            return newValue
        except:
            log.exception("Can't convert %s into a date" % rawValue);
            return rawValue;

class koSqliteTimestampAsDateTime(SqliteBaseTimestampConverter):
    _com_interfaces_ = [components.interfaces.koIDBXCellDataConverter]
    _reg_clsid_ = "{846236c0-ad6e-440a-b830-5f9d4230cb32}"
    _reg_contractid_ = "@activestate.com/koSqliteTimestampAsDateTime;1"
    _reg_desc_ = "as sqlite datetime"
    _reg_categories_ = [ ('komodo-DBX-DataConverters', _reg_contractid_), ]
    _converterName = "datetime"
    
class koSqliteTimestampAsDate(SqliteBaseTimestampConverter):
    _com_interfaces_ = [components.interfaces.koIDBXCellDataConverter]
    _reg_clsid_ = "{ac9ea7f0-1f21-4471-9eeb-17aa68b6b2a2}"
    _reg_contractid_ = "@activestate.com/koSqliteTimestampAsDate;1"
    _reg_desc_ = "as sqlite date"
    _reg_categories_ = [ ('komodo-DBX-DataConverters', _reg_contractid_), ]
    _converterName = "date"
    
class koSqliteTimestampAsTime(SqliteBaseTimestampConverter):
    _com_interfaces_ = [components.interfaces.koIDBXCellDataConverter]
    _reg_clsid_ = "{8a7d4704-37e8-4f0f-961c-d6784a5de1f7}"
    _reg_contractid_ = "@activestate.com/koSqliteTimestampAsTime;1"
    _reg_desc_ = "as sqlite time"
    _reg_categories_ = [ ('komodo-DBX-DataConverters', _reg_contractid_), ]
    _converterName = "time"
    
