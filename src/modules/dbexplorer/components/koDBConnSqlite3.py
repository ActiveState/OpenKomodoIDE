#!/usr/bin/env python
# Copyright (c) 2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

""" xpcom wrapper around sqlite3 library - explore databases."""

import traceback
import os
import sys
import re
import logging

from xpcom import components, COMException, ServerException, nsError
from xpcom.server import WrapObject, UnwrapObject

log = logging.getLogger("koDBConnSqlite3")
log.setLevel(logging.INFO)

try:
    import dbxlib
except ImportError, ex:
    sys.stderr.write("Failed to load dbxlib: %s\n" % (ex,))
    raise

try:
    import dbx_sqlite3
    loaded = True
except ImportError, ex:
    sys.stderr.write("Failed to load dbx_sqlite3: %s\n" % (ex,))
    loaded = False

class KoSQLite3DBXTableConnection(dbxlib.KoTableConnector):
    """ This table is now mixed into KoSQLite_DBXTable"""
    def __init__(self):
        dbxlib.KoTableConnector.__init__(self, dbx_sqlite3)

    # Interface methods

    #---- Data manipulation

    def deleteRows(self, dataTreeView, rowNums):
        # @param dataTreeView { koIDBXTableDumpTreeView }
        #  koIDBXTableDumpTreeView: koDatabaseExplorerTreeView.koDatabaseExplorerTreeView
        # @param rowNums {array of int}
        column_names = self.getColumnNames()
        query_names = []
        dataTreeView = UnwrapObject(dataTreeView)
        schemaTreeView = UnwrapObject(dataTreeView.get_schemaTreeView())
        for i in range(len(column_names)):
            is_key = int(schemaTreeView.getCellText(i, dbxlib.Column('is_primary_key')))
            if is_key:
                query_names.append(column_names[i])
        if not query_names:
            raise dbxlib.DBXception("No attributes are keys, can't delete")
        table_name = self._table_name
        # return True if any rows are deleted
        final_res = ""
        for rowNum in rowNums:
            query_values = []
            for column_name in query_names:
                query_values.append(dataTreeView.getCellText(rowNum,
                                                             dbxlib.Column(column_name)))
            res = self._db.deleteRowByKey(self._table_name,
                                    query_names,
                                    query_values)
            if not (res or final_res):
                final_res = ("Failed to delete keys:%s, values:%s" %
                            (", ".join(query_names),
                             ", ".join([str(x) for x in query_values])))
        return final_res
    
    #---- non-xpcom methods

    def initialize(self, dbConnection, dbTable):
        # @param dbConnection {koIDBXConnection}
        # @param dbTable {koDatabaseExplorerTreeView._DBXTable}
        self._dbConnection = dbConnection
        self._path = dbConnection.dbPath
        self.db_args = {'dbpath': self._path}
        # No need to finalize this one.
        self._db = dbx_sqlite3.Database(self._path)
        self._table_name = dbTable.name
        # For koDatabaseExplorerTreeView.py#289 -- can we fix this?
        self.dbConnection = dbConnection
        self.dbTable = dbTable

#---- The connection class

class KoSQLite3DBXConnection(dbxlib.KoDBXConnection):
    _com_interfaces_ = [components.interfaces.koIDBXConnection]
    _reg_clsid_ = "{18672286-2a11-44a9-a5df-ba6f956c089c}"
    _reg_contractid_ = "@activestate.com/koDBXConnection?database=SQLite3;1"
    _reg_desc_ = "koIDBXConnection sqlite3"
    _reg_categories_ = [ ('komodo-DBX-DBConnections', _reg_contractid_), ]
    
    # Interface Methods
    def get_loaded(self):
        return loaded and dbx_sqlite3.loaded

    def getChildren(self):
        """Return an annotated list of the parts of the connection"""
        log.debug("Asked to get children from %r", self)
        path = self.dbPath
        try:
            db = dbx_sqlite3.Database(path)
            table_names = [(name, 'table', KoSQLite_DBXTable(self, name)) for name in db.listAllTableNames()]
            log.debug("names: %s", table_names)
            names = sorted(table_names, key=lambda item:item[0].lower())
            return names
        except dbx_sqlite3.OperationalError, ex:
            log.error("Failed: %r", ex)
            return [("Error: " + str(ex), 'error', None)]
        except dbx_sqlite3.DatabaseError, ex:
            log.error("Failed: %r", ex)
            return [("Error: " + str(ex), 'error', None)]

    def getDatabaseDisplayTypeName(self):
        return "SQLite3"
    
    def getDatabaseInternalName(self):
        return "SQLite3"
    
    def getURI(self):
        if not hasattr(self, '_URI'):
            self._URI = 'dbexplorer://%s/%s' % (self.getDatabaseDisplayTypeName(),
                                                self.dbPath)
        return self._URI

class KoSQLite_DBXTable(dbxlib.KoDBXConnectionChild, KoSQLite3DBXTableConnection):
    _com_interfaces_ = [components.interfaces.koIDBXTableConnector]

    isContainer = True
    def __init__(self, parent, table_name):
        self._parent = parent
        self._table_name = table_name
        KoSQLite3DBXTableConnection.__init__(self)
        
    # Interface Methods

    def get_tableViewTitle(self):
        # Walk up the parent chain to get these attributes:
        return (self.getDatabaseDisplayTypeName()
                + "://"
                + self.dbPath
                + "/"
                + self._table_name
                + " - Database Explorer")
    
    def getConnectionDisplayInfo(self):
        return self.dbPath

    def getChildren(self):
        """Return an annotated list of the parts of the connection"""
        log.debug("Asked to get children from %r", self)
        try:
            db = dbx_sqlite3.Database(self.dbPath)
            column_names = [(name, 'column', KoSQLite_DBXColumn(self, name)) for name in db.listAllColumnNames(self._table_name)]
            names = sorted(column_names, key=lambda item:item[0].lower())
            return names
        except Exception, ex:
            log.exception("Failed: KoSQLite3DBXConnection.getChildren")
            return [("Error: " + str(ex), 'error')]
        
    def getURI(self):
        return self._parent.getURI() + "/" + self._table_name

    def __getattr__(self, attr):
        if attr == "_db":
            self._db = dbx_sqlite3.Database(self.dbPath)
            return self._db
        #Hardwired parent.
        return dbxlib.KoDBXConnectionChild.__getattr__(self, attr)

class KoSQLite_DBXColumn(dbxlib.KoDBXConnectionChild):
    isContainer = False
    def __init__(self, parent, column_name):
        self._parent = parent
        self._column_name = column_name
        
    def getURI(self):
        return self._parent.getURI() + "/" + self.column_name


#---- The preference class

class KoSQLite3DBXPreferences(object): # dbxlib.KoDBXPreference):
    _com_interfaces_ = [components.interfaces.koIDBXPreference]
    _reg_clsid_ = "{696a558b-cf97-4104-addc-8905c84f7ef2}"
    _reg_contractid_ = "@activestate.com/koDBXPreference?database=SQLite3;1"
    _reg_desc_ = "koIDBXPreference SQLite3"
    _reg_categories_ = [ ('komodo-DBX-Preferences', _reg_contractid_), ]

    def is_enabled(self):
        return loaded and dbx_sqlite3.loaded

    def get_name(self):
        return "sqlite3"

    def get_displayName(self):
        return "SQLite3"

    def get_fileBased(self):
        return True
