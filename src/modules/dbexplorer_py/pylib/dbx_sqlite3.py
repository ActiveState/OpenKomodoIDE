#!/usr/bin/env python

"""
Code to work with sqlite & sqlite3 databases.

Each connection encapsulates working with a sqlite file,
which can contain one or more databases.

Note that the API does sanity-checking on values, but not
other parts of sql statements, like table names.
"""

import os, sys, re
import logging
import sqlite3
from contextlib import contextmanager

import dbxlib

import logging
log = logging.getLogger("dbx_sqlite3.py")
log.setLevel(logging.DEBUG)
log.setLevel(logging.INFO)

# This is the same for all databases and tables:
def getSchemaColumnNames():
    return ['id', 'name', 'type', 'nullable?', 'default value', 'primary key?']

def columnTypeIsInteger(typeName):
    return typeName in ("INTEGER", "LONG")

def columnTypeIsReal(typeName):
    return typeName == "REAL"

def columnTypeIsBlob(typeName):
    return typeName == "BLOB"

class Connection(object):
    def __init__(self, path):
        self.path = path
        self.isDatabase = True
        
class ColumnInfo(object):
    def __init__(self, position, name, type, nullable, default_value, is_primary_key):
        self.position = position
        self.name = name
        self.type = type
        self.nullable = nullable
        self.has_default_value = default_value != None
        self.default_value = default_value
        self.is_primary_key = is_primary_key

        self.prettyName_to_attrName = {
            'id': 'position',
            'nullable?': 'nullable',
            'default value': 'default_value',
            'primary key?': 'is_primary_key',
            }
        
    def __repr__(self):
        return ("<ColumnInfo: position:%r, name:%r, type:%r, nullable:%r, \n"
                + "has_default_value:%r default_value:%r, is_pri_key:%r>") % (
        self.position,
        self.name,
        self.type,
        self.nullable,
        self.has_default_value ,
        self.default_value,
        self.is_primary_key
        )

    def id_from_name(self, prettyName):
        return self.prettyName_to_attrName.get(prettyName, prettyName)

class OperationalError(sqlite3.OperationalError):
    pass

class DatabaseError(sqlite3.DatabaseError):
    pass

class Database(dbxlib.CommonDatabase):
    handles_prepared_stmts = True
    def __init__(self, path):
        self.path = path
        self._init_db()
        
    def createFromConnection(self, conn):
        self.path = conn.path
        self._init_db()

    def _init_db(self):
        self.col_info_from_table_name = {}
                
        
    @contextmanager
    def connect(self, commit=False, cu=None):
        """A context manager for a database connection/cursor. It will automatically
        close the connection and cursor.  See history/editorhistory.py for
        further notes.

        @param commit {bool} Whether to explicitly commit before closing.
        @param cu {sqlite3.Cursor} An existing cursor to use. This allows
            callers to avoid the overhead of another db connection when
            already have one, while keeping the same "with"-statement
            call structure.
        """
        if cu is not None:
            yield cu
        else:
            conn = sqlite3.connect(self.path)
            # Return str if all ASCII, unicode objects otherwise
            conn.text_factory = sqlite3.OptimizedUnicode
            cu = conn.cursor()
            try:
                yield cu
            finally:
                if commit:
                    conn.commit()
                cu.close()
                conn.close()
                
    # get metadata about the database and tables
                
    def listAllTablePartsByType(self, typeName):
        try:
            with self.connect() as cu:
                cu.execute("select name from sqlite_master where type = '%s'" % (typeName,))
                names = [row[0] for row in cu.fetchall()]
                return names
        except sqlite3.OperationalError, ex:
            raise OperationalError(ex)
        except sqlite3.DatabaseError, ex:
            raise DatabaseError(ex)
        
    def listAllTableNames(self):
        return self.listAllTablePartsByType('table')
                
    def listAllIndexNames(self):
        return self.listAllTablePartsByType('index')
    
    def listAllTriggerNames(self):
        return self.listAllTablePartsByType('trigger')

    def listAllColumnNames(self, table_name):
        with self.connect() as cu:
            cu.execute("pragma table_info('%s')" % (table_name, ))
            column_names = []
            for row in cu.fetchall():
                column_names.append(row[1])
        return column_names
    
    def _save_table_info(self, table_name):
        if ';' in table_name:
            raise Exception("Unsafe table_name: %s" % (table_name,))
        if table_name in self.col_info_from_table_name:
            return self.col_info_from_table_name[table_name]
        with self.connect() as cu:
            cu.execute("pragma table_info('%s')" % (table_name, ))
            col_info = []
            for row in cu.fetchall():
                col_info.append(ColumnInfo(*row))
            # col_info = [ColumnInfo(*row) for row in cu.fetchall()]
        self.col_info_from_table_name[table_name] = col_info
        return col_info
            
    def getColumnInfo(self, table_name):
        return self._save_table_info(table_name)  # OK??
        self._save_table_info(table_name)
        with self.connect() as cu:
            cu.execute("pragma table_info('%s')" % (table_name, ))
            col_info = [ColumnInfo(*row) for row in cu.fetchall()]
        return col_info
    
    def _convert(self, col_info_block, row_data):
        """ Convert each item into a string.  Then return an array of items.
        """
        new_row_data = []
        idx = 0
        for value in row_data:
            col_info = col_info_block[idx]
            type = col_info.type
            if type == u'INTEGER':
                if value is None:
                    new_row_data.append("")
                else:
                    try:
                        new_row_data.append("%d" % value)
                    except TypeError:
                        log.error("Can't append value as int: %r", value)
                        new_row_data.append("%r" % value)
            elif type == u'REAL':
                new_row_data.append("%r" % value)
            elif type in (u'STRING', u'TEXT') or 'VARCHAR' in type:
                new_row_data.append(value)
            elif type in (u'date', u'datetime'):
                # Default adapters in sqlite3
                new_row_data.append(str(value))
            elif type == 'BLOB':
                # To get the data of a blob:
                # len(value) => size, str(value) => str repr,
                # but how would we know how to represent it?
                if value is None:
                    log.info("blob data is: None")
                    value = ""
                new_row_data.append("<BLOB: %d chars>" % (len(value),))
            else:
                new_row_data.append('%r' % value)
            idx += 1
        return new_row_data
                    
    def getRawRow(self, table_name, key_names, key_values, convert_blob_values=True):
        key_names_str = self._convertAndJoin(key_names, " AND ")
        query = "select * from %s where %s" %  (table_name, key_names_str)
        with self.connect() as cu:
            cu.execute(query, key_values)
            row = cu.fetchone()
        str_items = []
        if convert_blob_values:
            col_info_block = self._save_table_info(table_name)
        idx = 0
        for item in row:
            if item is None:
                str_items.append("")
            elif convert_blob_values and columnTypeIsBlob(col_info_block[idx].type):
                str_items.append("<BLOB: %d chars>" % (len(item),))
            else:
                str_items.append(str(item))
            idx += 1
        return len(str_items), str_items
    
    def _getRowIdentifier(self, table_name, row_to_delete):
        col_info_block = self.get_table_info(table_name)
        key_names = []
        key_values = []
        idx = 0
        for col_info in col_info_block:
            if col_info.is_primary_key:
                key_names.append(col_info.name)
                key_values.append(row_to_delete[idx])
            idx += 1
        if key_names:
            condition = " and ".join(["%s = ?" % (k,) for k in key_names])
        else:
            for col_info in col_info_block:
                if col_info.type != "BLOB":
                    key_names.append(col_info.name)
                    key_values.append(row_to_delete[idx])
                idx += 1
            condition = " and ".join(["%s = ?" % (k,) for k in key_names])
        return condition, key_values
    
    def _setCountChanges(self, cu):
        self._need_to_restore_count_pragma = False
        with self.connect(commit=True, cu=cu) as cu:
            cu.execute("pragma count_changes")
            self._restore_count_changes = cu.fetchone()[0]
            if not self._restore_count_changes:
                cu.execute("pragma count_changes=1")
                self._need_to_restore_count_pragma = True
                
    def _restoreCountChanges(self, cu):
        if self._need_to_restore_count_pragma:
            with self.connect(commit=True, cu=cu) as cu:
                cu.execute("pragma count_changes=%d" % (self._restore_count_changes,))

    def deleteRowByKey(self, table_name, key_names, key_values):
        condition = " and ".join(["%s = ?" % kname for kname in key_names])
        with self.connect(commit=True) as cu:
            self._setCountChanges(cu)
            try:
                cu.execute("delete from %s where %s" % (table_name, condition), key_values)
                res = cu.fetchone()[0]
            finally:
                self._restoreCountChanges(cu)
            return res

    #NOT USED    
    def deleteRowByRowNumber(self, table_name, row_num):
        row_to_delete = self.getRows(table_name, row_num)[0]
        condition, key_values = self._getRowIdentifier(table_name, row_to_delete)
        with self.connect(commit=True) as cu:
            self._setCountChanges(cu)
            try:
                cu.execute("delete from %s where %s" % (table_name, condition), key_values)
                res = cu.fetchone()[0]
            finally:
                self._restoreCountChanges(cu)
        return res

    def updateRow(self, table_name, target_names, target_values,
                                      key_names, key_values):
        target_names_str = self._convertAndJoin(target_names, ",")
        key_names_str = self._convertAndJoin(key_names, " AND ")
        cmd = 'update %s set %s where %s' % (table_name, target_names_str,
                                             key_names_str)
        args = tuple(target_values + key_values)
        with self.connect(commit=True) as cu:
            self._setCountChanges(cu)
            try:
                cu.execute(cmd, args)
                res = cu.fetchone()[0]
            finally:
                self._restoreCountChanges(cu)
        return res
        
    #NOT USED
    def updateCellInRowByCellNo(self, table_name, row_to_modify, cell_no, cell_value):
        condition, key_values = self._getRowIdentifier(table_name, row_to_modify)
        col_info_block = self.get_table_info(table_name)
        args = [cell_value] + key_values
        with self.connect(commit=True) as cu:
            self._setCountChanges(cu)
            try:
                cu.execute("update %s set %s=? where %s" % (table_name, col_info_block[cell_no].name, condition), args)
                res = cu.fetchone()[0]
            finally:
                self._restoreCountChanges(cu)
        return res
    
    #NOT USED
    def updateCellInRowByColumnName(self, table_name, row_to_modify, column_name, cell_value):
        condition, key_values = self._getRowIdentifier(table_name, row_to_modify)
        args = [cell_value] + key_values
        with self.connect(commit=True) as cu:
            self._setCountChanges(cu)
            try:
                cmd = "update %s set %s=? where %s" % (table_name, column_name, condition)
                cu.execute(cmd, args)
                res = cu.fetchone()[0]
            finally:
                self._restoreCountChanges(cu)
        return res

    # Probably the above two routines are obsolete.    

    #NOT USED
    def updateCellsByColumnNameUsingKeyValues(self, table_name, target_column_names, target_column_values, key_column_names, key_values):
        condition, key_values = self._getRowIdentifier(table_name, row_to_modify)
        args = [cell_value] + key_values
        with self.connect(commit=True) as cu:
            self._setCountChanges(cu)
            try:
                cmd = "update %s set %s=? where %s" % (table_name, column_name, condition)
                cu.execute(cmd, args)
                res = cu.fetchone()[0]
            finally:
                self._restoreCountChanges(cu)
        return res

    def insertRowByNamesAndValues(self, table_name, target_names, target_values):
        cmd = "insert into %s (%s) values (%s)" % (table_name,
                                                   ", ".join(target_names),
                                                   ", ".join(['?'] * len(target_names)))
        with self.connect(commit=True) as cu:
            self._setCountChanges(cu)
            try:
                cu.execute(cmd, target_values)
                res = cu.fetchone()[0]
            finally:
                self._restoreCountChanges(cu)
        return res
        
    #NOT USED
    def insertRow(self, table_name, row_to_add):
        col_info_block = self.get_table_info(table_name)
        key_names = []
        key_values = []
        idx = 0
        for col_info in col_info_block:
            key_names.append(col_info.name)
            if col_info.type == "BLOB":
                key_values.append("")
            else:
                key_values.append(row_to_add[idx])
            idx += 1
        if not key_names:
            raise Exception("No keys for table %s" % (table_name,))
        placeholder_list = "(" + ", ".join(['?'] * len(key_names)) + ")"
        with self.connect(commit=True) as cu:
            self._setCountChanges(cu)
            try:
                cu.execute("insert into %s values %s" % (table_name, placeholder_list), key_values)
                res = cu.fetchone()[0]
            finally:
                self._restoreCountChanges(cu)
        return res

    # Custom query methods -- these use callbacks into the
    # methods in the loader, to cut down on slinging data
    # around too much

    # runCustomQuery is in the parent class.

    def executeCustomAction(self, action):
        with self.connect(commit=True) as cu:
            self._setCountChanges(cu)
            try:
                cu.execute(action)
                res = cu.fetchone()[0]
            finally:
                self._restoreCountChanges(cu)
        return res

    def getIndexInfo(self, indexName, res):
        with self.connect(commit=True) as cu:
            cu.execute("select tbl_name, sql from sqlite_master where type = 'index' and name = ?", (indexName,))
            res.tableName, res.sql = cu.fetchone()

    def getTriggerInfo(self, triggerName, res):
        with self.connect(commit=True) as cu:
            cu.execute("select tbl_name, sql from sqlite_master where type = 'trigger' and name = ?", (triggerName,))
            res.tableName, res.sql = cu.fetchone()
        
PERCENT = '%'
PERCENT_ESCAPE = '%25'
SEPARATOR = '\x05'
SEPARATOR_ESCAPE = '%05'
          
