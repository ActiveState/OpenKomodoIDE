#!/usr/bin/env python
# Copyright (c) 2009-2010 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""
Code to work with Oracle databases using the
Oracledb library
"""

import os, sys, re
import logging
import sqlite3
from contextlib import contextmanager

log = logging.getLogger("dbx_oracledb")
log.setLevel(logging.INFO)

import dbxlib
try:
    import cx_Oracle
    loaded = True
    disabled_reason = None
except ImportError, ex:
    sys.stderr.write("**************** Couldn't load cx_Oracle: %s\n" % (ex,))
    import missingAdaptor
    cx_Oracle = missingAdaptor.MissingAdaptor()
    loaded = False
    cx_Oracle.adaptorName = 'cx_Oracle'
    disabled_reason = "Couldn't load database adapter cx_Oracle: %s." % (ex,)
    if sys.platform.startswith("win"):
        env_var = 'LIB'
        instant_client_version = '11.2'
    elif sys.platform == "darwin":
        env_var = 'DYLD_LIBRARY_PATH'
        instant_client_version = '10.2'
    else:
        env_var = 'LD_LIBRARY_PATH'
        instant_client_version = '11.2'
    disabled_reason += "  \nPlease set %s environment variable to the " \
                       "Oracle Instant Client %s directory, and restart " \
                       "Komodo." % (env_var, instant_client_version)


#TODO: Lots of this is in common with postgres, so fold it

# This is the same for all databases and tables:
_int_type_names = ('smallint', 'integer', 'bigint', 'serial', 'bigserial')
_float_type_names = ('decimal', 'numeric', 'real', 'double precision')
_currency_type_names = ('money')


def getSchemaColumnNames():
    return ['column_name', 'data_type', 'is_nullable', 'column_default',
            'character_maximum_length', 'is_primary_key']

def columnTypeIsInteger(typeName):
    return typeName in _int_type_names

def columnTypeIsReal(typeName):
    return typeName in _float_type_names

def columnTypeIsBlob(typeName):
    return typeName == "BLOB"

class Connection(object):
    partNames = {'dbname':'db',
                 'host':'host',
                 'user':'user',
                 'password':'passwd',
                 'port':'port'}
    def __init__(self, args):
        #log.debug("Connection: dbname:%r, host:%r, port:%r, user:%r, password:%r",
        #          dbname, host, port, username, password)
        # See koDBConnOracle.py::_params_from_connection
        # self.dbname = args.get('db') -- Not used in Oracle
        self.host = args['host']
        self.port = args.get('port')
        self.user = args['username']
        self.password = args.get('password')

    def getConnectionString(self):
        """
        Format: username/password@host[:port]
        """
        res = self.user
        if self.password:
            res += "/" + self.password
        res += "@" + self.host
        if self.port:
            res += str(self.port)
        return res

    def getConnectionDisplayValues(self):
        return "%s:%s" % (self.host, self.dbname)
        
class ColumnInfo(object):
    def __init__(self, name, type, nullable, default_value,
                 max_length, is_primary_key):
        self.column_name = name
        self.name = name   #Synonym, need a better way to manage this
        self.data_type = type
        self.type = type   #Synonym...
        self.is_nullable = nullable
        self.nullable = nullable   #Synonym...
        self.has_default_value = default_value != None
        self.column_default = default_value
        self.default_value = default_value #Synonym...
        if is_primary_key or (is_primary_key == "True"):
            self.is_primary_key = 1
        else:
            self.is_primary_key = 0
        self.character_maximum_length = max_length

        self.prettyName_to_attrName = {
            'nullable?': 'nullable',
            'default value': 'default_value',
            'primary key?': 'is_primary_key',
            }

    def isNumeric(self):
        return self.type == "NUMBER"
        
    def __repr__(self):
        return ("<ColumnInfo: name:%r, "
                + "type:%r, "
                + "nullable:%r, \n"
                + "has_default_value:%r "
                + "default_value:%r, "
                + "is_pri_key:%r, "
                + "max_length:%r>") % (
        self.name,
        self.type,
        self.nullable,
        self.has_default_value ,
        self.default_value,
        self.is_primary_key,
        self.character_maximum_length
        )

    def id_from_name(self, prettyName):
        return self.prettyName_to_attrName.get(prettyName, prettyName)

class OperationalError(cx_Oracle.OperationalError):
    pass

class DatabaseError(cx_Oracle.DatabaseError):
    pass

class IntegrityError(cx_Oracle.DatabaseError):
    pass


class Database(dbxlib.CommonDatabase):
    # args should be: host, username=None, password=None, port=None
    handles_prepared_stmts = False
    def __init__(self, args):  
        self.connection = Connection(args)
        self._init_db()

    def _init_db(self):
        self.col_info_from_table_name = {}

    def do_query(self, cu, query, vals=()):
        # Oracle wants the query to be str, not unicode
        return cu.execute(str(query), vals)

    def getConnectionDisplayInfo(self):
        return self.connection.getConnectionDisplayValues()
        
    @contextmanager
    def connect(self, commit=False, cu=None):
        """ See dbx_sqlite3.py::connect docstring for full story
        @param commit {bool} 
        @param cu {sqlite3.Cursor}
        """
        if cu is not None:
            yield cu
        else:
            connStr = str(self.connection.getConnectionString())
            conn = cx_Oracle.connect(connStr)
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
            query = """select table_name
                       from all_all_tables
                       where owner = '%s' """ % (self.connection.user.upper())
            with self.connect() as cu:
                self.do_query(cu, query)
                items = cu.fetchall()
                names = [row[0] for row in items]
                return names
        except NotImplementedError, ex:
            raise OperationalError(ex.message)
        except Exception, ex:
            log.exception("listAllTablePartsByType(typeName:%s)", typeName)
            raise OperationalError(ex.message)
        
    def listAllTableNames(self):
        return self.listAllTablePartsByType('BASE TABLE')
                
    def listAllIndexNames(self):
        return self.listAllTablePartsByType('INDEX') #TODO: Verify this
    
    def listAllTriggerNames(self):
        return self.listAllTablePartsByType('TRIGGER') # TODO: Verify this
    
    def listAllColumnNames(self, dbname, table_name):
        col_info_block = self._save_table_info(table_name)
        return [col_info.name for col_info in col_info_block]

    #TODO: Add views
    
    def _save_table_info(self, table_name):
        if ';' in table_name:
            raise Exception("Unsafe table_name: %s" % (table_name,))
        if table_name in self.col_info_from_table_name:
            return self.col_info_from_table_name[table_name]
        # First determine which columns are indexed
        indexed_columns = {}
        table_name = str(table_name.upper())
        user_name = str(self.connection.user.upper())
        index_query = ("select c.column_name"
                       + " from all_cons_columns c, all_constraints t"
                       + " WHERE c.table_name = '%s'"
                       + "   AND c.owner = '%s'"
                       + "   AND c.constraint_name = t.constraint_name"
                       + "   AND t.constraint_type = 'P'")  % (table_name, user_name)
        main_query = ("select column_name, data_type, nullable, "
                      + " data_default, char_length "
                      + "from all_tab_columns "
                      + "where table_name='%s' and owner = '%s' "
                          ) % (table_name, user_name)
        with self.connect() as cu:
            self.do_query(cu, index_query)
            for row in cu.fetchall():
                indexed_columns[row[0]] = True
            
            self.do_query(cu, main_query)
            col_info = []
            for row in cu.fetchall():
                lrow = list(row)
                lrow.append(indexed_columns.get(row[0], False))
                col_info.append(ColumnInfo(*lrow))
        self.col_info_from_table_name[table_name] = col_info
        return col_info

    def _typeForOracle(self, typeName):
        return typeName in ('DATE', 'DATETIME')
    
    def _convert(self, col_info_block, row_data):
        """ Convert each item into a string.  Then return an array of items.
        """
        new_row_data = []
        idx = 0
        for value in row_data:
            col_info = col_info_block[idx]
            type = col_info.type
            if type == u'NUMBER':
                if value is None:
                    new_row_data.append("")
                else:
                    try:
                        new_row_data.append("%g" % value)
                    except TypeError:
                        log.error("Can't append value as int: %r", value)
                        new_row_data.append("%r" % value)
            elif type == u'float':
                new_row_data.append("%g" % value)
            elif (type in ('CHAR')
                  or 'VARCHAR' in type
                  or type.startswith('character')):
                new_row_data.append(value)
            elif self._typeForOracle(type):
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
                log.debug("  unrecognized type: %s", type)
                new_row_data.append('%r' % value)
            idx += 1
        return new_row_data

    def _convertAndJoin(self, names, sep):
        # Return a string of form <<"name1 = ? <sep> name2 = ? ...">>
        return sep.join([("%s = %%s" % name) for name in names])

    def _conditionFromNamesAndValues(self, key_names, key_values):
        parts = []
        for idx in range(len(key_names)):
            parts.append(self._nameQuotedValueForCondition(key_names[idx],
                                                           key_values[idx]))
        return " and ".join(parts)

    def getRawRow(self, table_name, key_names, key_values, convert_blob_values=True):
        self._setupColInfo(table_name)
        condition = self._conditionFromNamesAndValues(key_names, key_values)
        query = "select * from %s where %s" % (table_name, condition)
        with self.connect() as cu:
            self.do_query(cu, query)
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

    def getRows(self, table_name, startLine, numLines, sort_columnName=None, sortDirection=None):
        # We have to override this for Oracle because it doesn't
        # directly support offset/limit
        col_info_block = self._save_table_info(table_name)
        column_names = [col.column_name for col in col_info_block]
        col_list = ", ".join(column_names)
        inner_query = "SELECT ROWNUM ko$rnum, %s FROM %s" % (col_list,
                                                             table_name)
        if sortDirection:
            inner_query += " ORDER BY %s %s " % (sort_columnName,
                                                (sortDirection < 0 and "DESC" or "ASC"))
        # ROWNUM is 1-based, so add 1 to the coordinates.
        query = ("SELECT %s FROM (%s) WHERE ko$rnum between %d and %d"
                 % (col_list, inner_query,
                    startLine + 1, startLine + numLines))
        log.debug("getRows(startLine=%d, numLines=%d): query: %r", startLine, numLines, query)
        with self.connect() as cu:
            self.do_query(cu, query)
            results = []
            for row in cu.fetchall():
                log.debug("got row: %s", row)
                results.append(self._convert(col_info_block, row))
        return results

    #TODO: Generic?
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

    def deleteRowByKey(self, table_name, key_names, key_values):
        self._setupColInfo(table_name)
        condition = self._conditionFromNamesAndValues(key_names, key_values)
        with self.connect(commit=True) as cu:
            try:
                cmd = "delete from %s where %s" % (table_name, condition)
                log.debug("deleteRowByKey: cmd:%s", cmd)
                self.do_query(cu, cmd)
            except:
                log.exception("oracle deleteRowByKey failed")
                res = False
            else:
                res = True
        return res

    def _figure_to_date_func(self, date_value):
        m = re.compile(r'(\d{4}-\d{2}-\d{2})(\s*)(\d{2}:\d{2}:\d{2})?$').match(date_value)
        if m:
            if m.group(2):
                fmt = 'YYYY-MM-DD%sHH24:MI:SS' % (m.group(2),)
                return "to_timestamp('%s', '%s')" % (date_value, fmt)
            else:
                fmt = 'YYYY-MM-DD'
                return "to_date('%s', '%s')" % (m.group(1), fmt)
        else:
            return "'%s'" % (date_value,) # Probably will fail

    def _setupColInfo(self, table_name):
        col_info_block = self.get_table_info(table_name)
        self._col_info_by_name = {}
        for item in col_info_block:
            self._col_info_by_name[item.name] = item

    def _quoteValueByType(self, name, value):
        col_info = self._col_info_by_name.get(name, None)
        if col_info is None:
            log.debug("insertRowByNamesAndValues: couldn't get col_info for %s", name)
            return "'%s'" % value
        else:
            tp = col_info.type
            if tp == 'NUMBER':
                if len(value):
                    return value
                else:
                    return "''" # "NULL"?
            elif 'CHAR' in tp:
                return "'%s'" % value
            elif 'DATE' in tp:
                return self._figure_to_date_func(value)
            else:
                return "'%s'" % value

    def _nameQuotedValueForCondition(self, name, value):
        col_info = self._col_info_by_name.get(name, None)
        if col_info is None:
            log.debug("insertRowByNamesAndValues: couldn't get col_info for %s", name)
            return "%s='%s'" % (name, value)
        else:
            tp = col_info.type
            if tp == 'NUMBER':
                if len(value):
                    return "%s=%s" % (name, value)
                else:
                    return "%s IS NULL" % (name)
            elif 'CHAR' in tp:
                if value:
                    return "%s='%s'" % (name, value)
                else:
                    return "(%s='' or %s IS NULL)" % (name, name)
            elif 'DATE' in tp:
                return "%s=%s" % (name, self._figure_to_date_func(value))
            else:
                return "%s='%s'" % (name, value)

    def insertRowByNamesAndValues(self, table_name, target_names, target_values):
        quoted_target_values = []
        self._setupColInfo(table_name)
        for idx in range(len(target_names)):
            quoted_target_values.append(self._quoteValueByType(target_names[idx],
                                                           target_values[idx]))
        cmd = "insert into %s (%s) values (%s)" % (table_name,
                                                   ", ".join(target_names),
                                                   ", ".join(quoted_target_values))
        with self.connect(commit=True) as cu:
            try:
                log.debug("insertRowByNamesAndValues: %r", cmd)
                self.do_query(cu, cmd)
                res = True
            except DatabaseError, ex:
                log.exception("dbx_oracledb::insertRowByNamesAndValues: DatabaseError: failed")
                raise
            except Exception, ex:
                log.exception("dbx_oracledb::insertRowByNamesAndValues failed")
                raise
        return res

    def updateRow(self, table_name, target_names, target_values,
                                      key_names, key_values):
        self._setupColInfo(table_name)
        condition = self._conditionFromNamesAndValues(key_names, key_values)
        fixed_values = []
        for idx in range(len(target_names)):
            fixed_values.append(self._quoteValueByType(target_names[idx],
                                                       target_values[idx]))
        assign_part = ", ".join(["%s = %s" % (name, val) for (name, val)
                                 in zip(target_names, fixed_values)])
        cmd = 'update %s set %s where %s' % (table_name, assign_part,
                                             condition)
        log.debug("updateRow: %s", cmd)
        with self.connect(commit=True) as cu:
            try:
                self.do_query(cu, cmd)
                res = True
            except Exception, ex:
                log.exception("dbx_oracledb::updateRow failed")
                res = False
        return res

    # Custom query methods -- these use callbacks into the
    # methods in the loader, to cut down on slinging data
    # around too much

    # runCustomQuery is in the parent class.

    def executeCustomAction(self, action):
        with self.connect(commit=True) as cu:
            try:
                self.do_query(cu, action)
                res = True
            except Exception, ex:
                log.exception("dbx_oracledb::executeCustomAction failed")
                res = False
        return res

    def getIndexInfo(self, indexName, res):
        XXX # Implement!
        
    def getTriggerInfo(self, triggerName, res):
        XXX # Implement!


