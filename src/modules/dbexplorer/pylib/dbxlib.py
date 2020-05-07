#!/usr/bin/env python
# Copyright (c) 2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""
Common code for the DB Explorer components
"""

import os, sys, re
import logging


#---- Globals

log = logging.getLogger("dbxlib.py")
log.setLevel(logging.DEBUG)
log.setLevel(logging.INFO)


#---- Classes

class Column(object):
    """ Simple wrapper for calling nsITreeView.getCellText
    """
    def __init__(self, id):
        self.id = id

class DBXception(Exception):
    pass

class KoTableConnector(object):
    """
    DB-Specific components inherit these common methods.
    """

    def __init__(self, dbxModule):
        self.infoRows = None
        self._schemaNames = None
        self._converters = {}
        self._columnSortName = None
        self._columnSortDirection = None
        self._dbxModule = dbxModule

    #---- Common Methods
    
    #---- Schema methods

    def getColumnNames(self):
        try:
            self.infoRows = self._db.getColumnInfo(self._table_name)
            return [row.name for row in self.infoRows]
        except self._dbxModule.OperationalError, ex:
            log.error("Failed: %r", ex)
            return ["Error: %s" % (ex,)]

    #---- Data manipulation
    
    def getRowCount(self):
        return self._db.getNumRows(self._table_name)
                
    def getRows(self, startLine, numLines=1):
        rows = self._db.getRows(self._table_name,
                                startLine, numLines,
                                self._columnSortName,
                                self._columnSortDirection)
        self._convertRows(rows)
        return rows

    def getRawRow(self, key_names, key_values):
        return self._db.getRawRow(self._table_name, key_names, key_values, False)[1]

    def addRow(self, target_names, target_values):
        return self._db.addRow(self._table_name, target_names, target_values)
        
    def updateRow(self, target_names, target_values,
                  key_names, key_values):
        return self._db.updateRow(self._table_name, target_names, target_values,
                                  key_names, key_values)

    def runCustomQuery(self, resultsManager, query):
        """
        @param resultsManager {koDBXTableQueryTreeView} - stores info
        @param query {str}
        @returns # results
        @throws exceptions...
        """
        return self._db.runCustomQuery(resultsManager, query)
        
    def executeCustomAction(self, statement):
        """
        @param statement {str}
        @returns {bool} True if the action succeeded and changed something
        @throws exceptions...
        """
        return self._db.executeCustomAction(statement)
        
    #---- Non-table lookups

    def getIndexInfo(self, indexName):
        # Doing it this way because of XPCOM
        obj = dbxlib.KoDBXIndexInfo()
        self._db.getIndexInfo(indexName, obj)
        return obj

    def getTriggerInfo(self, indexName):
        # Doing it this way because of XPCOM, same data structure
        obj = dbxlib.KoDBXIndexInfo()
        self._db.getTriggerInfo(indexName, obj)
        return obj


    #---- Converters
    def setConverter(self, columnName, className, func):
        self._converters[columnName] = [func, className]

    def removeConverter(self, columnName):
        try:
            del self._converters[columnName]
        except KeyError:
            pass

    #---- non-xpcom methods

    def getColumnInfo(self):
        return self._db.getColumnInfo(self._table_name)

    def getSchemaColumnNames(self):
        # All tables have the same kind of schema
        self._schemaNames = self._dbxModule.getSchemaColumnNames()
        return self._schemaNames

    def columnTypeIsInteger(self, typeName):
        return self._dbxModule.columnTypeIsInteger(typeName)

    def columnTypeIsReal(self, typeName):
        return self._dbxModule.columnTypeIsReal(typeName)

    def columnTypeIsBlob(self, typeName):
        return self._dbxModule.columnTypeIsBlob(typeName)

    def getConverterClassName(self, columnName):
        try:
            return self._converters[columnName][1]
        except KeyError:
            return None

    def _convertRows(self, rows):
        """
        @rows {Array of array of str}
        Modifies them in place
        """
        if not (self._converters and self.infoRows):
            log.debug("_DBXTable._convertRows: no _converters on self:%r", self)
            return
        converters_by_posn = {}
        idx = 0
        for row in self.infoRows:
            column_name = row.name
            if column_name in self._converters:
                converters_by_posn[idx] = self._converters[column_name][0]
            idx += 1
        if not converters_by_posn:
            return
        for row in rows:
            for idx in converters_by_posn:
                row[idx] = converters_by_posn[idx].convert(row[idx])

    #---- Sorters
    def updateSortInfo(self, columnName, sortDirection):
        log.debug("updateSortInfo: self: %s, columnName:%s, sortDirection:%s",
                  self, columnName, sortDirection)
        self._columnSortName = columnName
        self._columnSortDirection = sortDirection

try:
    from xpcom import components
except ImportError:
    pass # Assume we're called outside xpcom
else:
    class KoDBXIndexInfo(object):
        _com_interfaces_ = [components.interfaces.koIDBXIndexInfo]
        def get_tableName(self):
            return self.tableName

        def get_sql(self):
            return self.sql

#---- The base connection class

class KoDBXConnection(object):
    # Interface Methods
    def initialize(self, prefObj):
        bool_prefs = ['hasPassword']
        for id in prefObj.getPrefIds():
            log.debug("KoDBXConnection.initialize: id:%s", id)
            if id in bool_prefs:
                val = prefObj.getBooleanPref(id)
            else:
                val = prefObj.getStringPref(id)
            setattr(self, id, val)

    def getConnectionDisplayInfo(self):
        return self.dbPath

    def getImageSrc(self, col_id):
        if col_id != "name":
            dbType = self.getDatabaseDisplayTypeName()
            log.debug("Refusing: %s: getImageSrc(%s)", dbType, col_id)
            return None
        return "chrome://dbexplorer/skin/database_connect.png"
            
    def getName(self):
        tagStart = "dbexplorer://"
        if self.connUri.startswith(tagStart):
            return self.connUri[len(tagStart):]
        return self.connUri

    def getNodeTypeName(self):
        return "connection"

    # Other methods

    def updatePassword(self, password):
        """ This is needed because the password isn't always known when
        the object is created.
        """
        self.password = password


# Common class methods for the database interface layer to DB-API
# This class shouldn't be instantiated directly
class CommonDatabase(object):

    def do_query(self, cu, query, vals=()):
        return cu.execute(query, vals)

    def get_table_info(self, table_name):
        if table_name not in self.col_info_from_table_name:
            return self._save_table_info(table_name)
        return self.col_info_from_table_name[table_name]
    
    def getColumnInfo(self, table_name):
        return self._save_table_info(table_name)

    def _qualifyTableName(self, table_name):
        if hasattr(self, '_dbname'):
            return "'%s.%s'" % (self._dbname, table_name)
        else:
            return table_name

    # Query routines
    # get info about the selected table
    def getNumRows(self, table_name):
        table_name = self._qualifyTableName(table_name)
        if ';' in table_name:
            raise Exception("Unsafe table_name: %s" % (table_name,))
        with self.connect() as cu:
            log.debug("getNumRows -- dbxlib.py: table:%s", table_name)
            self.do_query(cu, "select count(*) from %s" % (table_name, ))
            res = cu.fetchone()[0]
            log.debug("getNumRows ==> %d", res)
            return res
            return cu.fetchone()[0]
            
    def getRows(self, table_name, startLine, numLines, sort_columnName=None, sortDirection=None):
        fixed_table_name = self._qualifyTableName(table_name)
        col_info_block = self._save_table_info(table_name)
        import pprint
        log.debug("getRows: col_info_block:%s", pprint.pformat(col_info_block))
        query = "SELECT * FROM %s " %  (fixed_table_name,)
        if sortDirection:
            query += "ORDER BY %s %s " % (sort_columnName,
                                         (sortDirection < 0 and "DESC" or "ASC"))
        if self.handles_prepared_stmts:
            query += "limit ? offset ?"
        else:
            query += "limit %d offset %d"
        log.debug("getRows: query: %s", query)
        with self.connect() as cu:
            if self.handles_prepared_stmts:
                self.do_query(cu, query, (numLines, startLine))
            else:
                self.do_query(cu, query % (numLines, startLine))
            results = []
            for row in cu.fetchall():
                log.debug("got row: %s", row)
                results.append(self._convert(col_info_block, row))
        return results
        
    def _convertAndJoin(self, names, sep):
        # Return a string of form <<"name1 = ? <sep> name2 = ? ...">>
        return sep.join([("%s = ?" % name) for name in names])

    def addRow(self, table_name, target_names, target_values):
        return self.insertRowByNamesAndValues(table_name, target_names, target_values)

    # Custom query methods -- these use callbacks into the
    # methods in the loader, to cut down on slinging data
    # around too much

    # So far this one can be common for all databases.
    def runCustomQuery(self, resultsManager, query):
        with self.connect() as cu:
            self.do_query(cu, query)
            rows = cu.fetchall()
            resultsManager.initCache(len(rows))
            #TODO: How long is this going to take for large databases?
            # Make people use their own limit statements?
            idx = 0
            for row in rows:
                resultsManager.addRow(idx, self._convertQueryData(row))
                idx += 1
            column_names = [info[0] for info in cu.description]
            resultsManager.setColumnNames(column_names)

    #---- Private methods

    def _convertQueryData(self, row):
        # We don't know the types, in general, so just return
        # everything stringified.
        # The front-end will need to offer the user a choice of known
        # converters, and then call one if it's chosen.
        return [str(item) for item in row]

def params_from_connection(dbConnection):
    host = getattr(dbConnection, 'hostname', 'localhost')
    port = getattr(dbConnection, 'port', "")
    username = getattr(dbConnection, 'username', "")
    socket = getattr(dbConnection, 'socket', "")
    obj = {'host':host,
           'username':username,
           'port':port,
           'socket':socket,
           'hasPassword':getattr(dbConnection, 'hasPassword', False),
           }
    if obj['hasPassword']:
        obj['password'] = getattr(dbConnection, 'password', "")
    return obj

class KoDBXConnectionChild(object):
    def __init__(self, *args):
        pass

    def find_params_from_connection(self):
        parent = self._parent
        while parent:
            if hasattr(parent, 'hostname'):
                return params_from_connection(parent)
            parent = getattr(parent, '_parent', None)
            if parent is None:
                break
        return None

    def getConnectionRoot(self):
        parent = self._parent
        while parent:
            if hasattr(parent, 'hostname'):
                break
            parent = getattr(parent, '_parent', None)
        return parent

    def __getattr__(self, name):
        parent = self._parent
        while parent is not None:
            if hasattr(parent, name):
                return getattr(parent, name)
            parent = getattr(parent, '_parent', None)
        raise AttributeError("%r object has no attribute '%s'", self, name)
