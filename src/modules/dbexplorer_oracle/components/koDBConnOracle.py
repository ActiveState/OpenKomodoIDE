#!/usr/bin/env python
# Copyright (c) 2009-2010 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

""" xpcom wrapper around the cx_Oracle python library - explore databases."""


import traceback
import os
from os.path import dirname, join
import sys
import re
import logging

from xpcom import components, COMException, ServerException, nsError
from xpcom.server import WrapObject, UnwrapObject

log = logging.getLogger("koDBConnOracle")
log.setLevel(logging.INFO)

try:
    import dbxlib
except ImportError, ex:
    sys.stderr.write("Failed to load dbxlib: %s\n" % (ex,))
    raise

try:
    import dbx_oracledb
    loaded = True
except ImportError, ex:
    sys.stderr.write("Failed to load dbx_oracledb: %s\n" % (ex,))
    loaded = False

#TODO: Common with PG
def _params_from_connection(dbConnection):
    host = getattr(dbConnection, 'hostname', 'localhost')
    port = getattr(dbConnection, 'port', "")
    username = getattr(dbConnection, 'username', "")
    password = getattr(dbConnection, 'password', "")
    return {'host':host, 'username':username,
            'password':password, 'port':port}

class KoOracleDBXTableConnection(dbxlib.KoTableConnector):
    """ This table is now mixed into KoOracle_DBXTable"""
    def __init__(self):
        dbxlib.KoTableConnector.__init__(self, dbx_oracledb)

    #---- Data manipulation

    #TODO: Common with PG
    def deleteRows(self, dataTreeView, rowNums):
        # @param dataTreeView { koIDBXTableDumpTreeView }
        #  koIDBXTableDumpTreeView: koDatabaseExplorerTreeView.koDatabaseExplorerTreeView
        # @param rowNums {array of int}
        column_names = self.getColumnNames()
        query_names = []
        dataTreeView = UnwrapObject(dataTreeView)
        schemaTreeView = UnwrapObject(dataTreeView.get_schemaTreeView())
        for i in range(len(column_names)):
            is_key = (schemaTreeView.getCellText(i, dbxlib.Column('is_primary_key'))
                      == '1')
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

#---- The connection class

class KoOracleDBXConnection(dbxlib.KoDBXConnection):
    _com_interfaces_ = [components.interfaces.koIDBXConnection]
    _reg_clsid_ = "{d1f785e9-ad18-43af-910d-f59107171948}"
    _reg_contractid_ = "@activestate.com/koDBXConnection?database=Oracle;1"
    _reg_desc_ = "koIDBXConnection Oracle"
    _reg_categories_ = [ ('komodo-DBX-DBConnections', _reg_contractid_), ]
    
    # Interface Methods
    def get_loaded(self):
        return loaded and dbx_oracledb.loaded

    def getChildren(self):
        """Return an annotated list of the parts of the connection"""
        db_args = _params_from_connection(self)
        try:
            db = dbx_oracledb.Database(db_args)
            #TODO: Add tablespaces support.
            return [(db_args['username'], 'database',
                     KoOracle_DBXDatabase(self, db_args['username']))]
            table_names = [(name, 'table') for name in db.listAllTableNames()]
            names = sorted(table_names,
                           key=lambda item:item[0].lower())
            return names
        except Exception, ex:
            log.exception("Failed: KoOracleDBXConnection.getChildren")
            return [("Error: " + str(ex), 'error', None)]

    def getDatabaseDisplayTypeName(self):
        return "Oracle"
    
    def getDatabaseInternalName(self):
        return "Oracle"  # Should be "oracle"?
    
    def getURI(self):
        if not hasattr(self, '_URI'):
            db_args = _params_from_connection(self)
            self._URI = 'dbexplorer://%s%s/%s' % (db_args['host'],
                                                  db_args['port'] and (":" + db_args['port']) or '',
                                                  db_args['username'])
        return self._URI

class KoOracle_DBXDatabase(dbxlib.KoDBXConnectionChild):
    isContainer = True
    # Interface Methods
    def __init__(self, parent, dbname):
        #XXX Check: is this going to create circular refs?
        self._parent = parent
        self._dbname = dbname

    def getChildren(self):
        """Return an annotated list of the parts of the connection"""
        db_args = self.find_params_from_connection()
        try:
            db = dbx_oracledb.Database(db_args)
            items = db.listAllTableNames()
            table_names = [(name, 'table', KoOracle_DBXTable(self, name)) for name in db.listAllTableNames()]
            names = sorted(table_names, key=lambda item:item[0].lower())
            return names
        except Exception, ex:
            log.exception("Failed: KoOracle_DBXDatabase.getChildren")
            return [("Error: " + str(ex), 'error', None)]
        
    def getURI(self):
        return self._parent.getURI() + "/" + self._dbname

class KoOracle_DBXTable(dbxlib.KoDBXConnectionChild,KoOracleDBXTableConnection):
    _com_interfaces_ = [components.interfaces.koIDBXTableConnector]

    isContainer = True
    def __init__(self, parent, table_name):
        self._parent = parent
        self._table_name = table_name
        KoOracleDBXTableConnection.__init__(self)
        
    # Interface Methods

    def get_tableViewTitle(self):
        # Walk up the parent chain to get these attributes:
        return (self.getDatabaseDisplayTypeName()
                + "://"
                + self._dbname
                + "/"
                + self._table_name
                + " - Database Explorer")
    
    def getConnectionDisplayInfo(self):
        return self._dbname

    def getChildren(self):
        """Return an annotated list of the parts of the connection"""
        db_args = self.find_params_from_connection()
        try:
            db = dbx_oracledb.Database(db_args)
            column_names = [(name, 'column', KoOracle_DBXColumn(self, name)) for name in db.listAllColumnNames(self._dbname, self._table_name)]
            names = sorted(column_names, key=lambda item:item[0].lower())
            return names
        except Exception, ex:
            log.exception("Failed: KoOracleDBXConnection.getChildren")
            return [("Error: " + str(ex), 'error')]

    def getURI(self):
        return self._parent.getURI() + "/" + self._table_name

    def __getattr__(self, attr):
        if attr == "_db":
            db_args = self.find_params_from_connection()
            self._db = dbx_oracledb.Database(db_args)
            return self._db
        #Hardwired parent.
        return dbxlib.KoDBXConnectionChild.__getattr__(self, attr)

class KoOracle_DBXColumn(dbxlib.KoDBXConnectionChild):
    isContainer = False
    def __init__(self, parent, column_name):
        self._parent = parent
        self._column_name = column_name


#---- The preference class

class KoOracleDBXPreferences(object): # dbxlib.KoDBXPreference):
    _com_interfaces_ = [components.interfaces.koIDBXPreference]
    _reg_clsid_ = "{052182dd-338a-4e9d-a9c5-453821577ca6}"
    _reg_contractid_ = "@activestate.com/koDBXPreference?database=Oracle;1"
    _reg_desc_ = "koIDBXPreference Oracle"
    _reg_categories_ = [ ('komodo-DBX-Preferences', _reg_contractid_), ]

    def is_enabled(self):
        return dbx_oracledb.loaded

    def get_disabled_reason(self):
        return dbx_oracledb.disabled_reason

    def get_name(self):
        return "oracle"

    def get_displayName(self):
        return "Oracle"

    def get_fileBased(self):
        return False



