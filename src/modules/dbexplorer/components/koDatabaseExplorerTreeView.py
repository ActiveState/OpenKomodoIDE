#!/usr/bin/env python
# Copyright (c) 2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""koDatabaseExplorerTreeView - explore databases."""

import traceback
import os
import sys
import re
import logging
import json

from xpcom import components, COMException, ServerException, nsError
from xpcom.server import WrapObject, UnwrapObject

import koTreeView

#---- globals

log = logging.getLogger("koDatabaseExplorerTreeView")
log.setLevel(logging.INFO)
tree_log = logging.getLogger("koDatabaseExplorerTreeView.tree")
tree_log.setLevel(logging.ERROR)
dumplog = logging.getLogger("koDatabaseExplorerTreeView.dumptree")
dumplog.setLevel(logging.ERROR)

MAX_DENSE_CACHE_SIZE = 100
KO_DBEXPLORER_PREF_NAME = "ko-dbexplorer"
    
#---- Classes

class RowCache(object):
    def __init__(self, koTableConnector):
        # @param koTableConnector {koIDBXTableConnector}
        self._koTableConnector = koTableConnector
        self._numVisibleRows = 20 # Default, to adjust
        
    @property
    def numVisibleRows(self):
        return self._numVisibleRows

    @numVisibleRows.setter
    def numVisibleRows(self, val):
        self._numVisibleRows = val        

    def _calcRowUpperBound(self, rowNum):
        # Get numVisibleRows rows at a time
        numToGet = max(self._numVisibleRows, 10)
        #log.debug("_calcRowUpperBound: numToGet:%d", numToGet)
        maxEndNum = min(self._rowCount - 1, rowNum + numToGet)
        for i in range(rowNum + 1, maxEndNum + 1):
            if self._inCache(i):
                return i - 1
        return maxEndNum
        
    def getCellText(self, rowNum, col_idx):
        try:
            row = self.getRow(rowNum)
        except IndexError:
            dumplog.error("Can't get row %d from database", rowNum)
            return ""
        try:
            return row[col_idx]
        except (IndexError, TypeError):
            log.error("Can't get col %d from row %r of db", col_idx, rowNum)
        return ""
        
    def setCellText(self, rowNum, col_idx, value):
        try:
            row = self.getRow(rowNum)
        except IndexError:
            log.error("Can't get row %d from database", rowNum)
            return False
        try:
            row[col_idx] = value
        except IndexError:
            log.error("Can't get col %d from row %r of db", col_idx, rowNum)
            return False
        return True

    def addRow(self, idx, row):
        self._cachedRows[idx] = row

class EmptyTableCache():
    def initialize(self, rowCount):
        pass # not needed
    
    def getCellText(self, row, col_idx):
        if row == 0 and col_idx == 0:
            return "This table is empty"
        return ""
    
    def get_rowCount(self):
        return 1

class DenseRowCache(RowCache):
    def initialize(self, rowCount):
        self._cachedRows = [None] * rowCount
        self._rowCount = rowCount
        
    def _inCache(self, i):
        return self._cachedRows[i] is not None
        
    def getRow(self, rowNum):
        if self._cachedRows[rowNum] is None:
            endNum = self._calcRowUpperBound(rowNum)
            rows = self._koTableConnector.getRows(rowNum, endNum - rowNum + 1)
            self._cachedRows[rowNum:endNum] = rows
        return self._cachedRows[rowNum]
        
    def addEmptyTableRow(self):
        self._cachedRows[0] = "Table is empty!"

class SparseRowCache(RowCache):
    def initialize(self, rowCount):
        self._cachedRowLimit = 50 # Number of rows to store at any one time.
        # This should be a small multiple of the window size.
        self._cachedRows = {}
        self._rowCount = rowCount
        self._rowQueue = []

    @property
    def numVisibleRows(self):
        return RowCache.numVisibleRows(self)

    @numVisibleRows.setter
    def numVisibleRows(self, val):
        """
        Note: this reimplements RowCache.numVisibleRows
        because I can't find a way to access it using inheritance.
        http://www.artima.com/forums/flat.jsp?forum=122&thread=153649
          "Note to self - Python properties are non-polymorphic."
        """
        self._numVisibleRows = val
        prevCacheSize = self._cachedRowLimit
        newCacheSize = 3 * val
        # Don't bother pulling out old entries when the cache shrinks
        if self._cachedRowLimit < newCacheSize:
            self._cachedRowLimit = newCacheSize
            
    def _inCache(self, i):
        return i in self._cachedRows
        
    def getRow(self, rowNum):
        #log.debug("SparseRowCache.getRow(%d)", rowNum)
        if rowNum not in self._cachedRows:
            endNum = self._calcRowUpperBound(rowNum)
            #log.debug(" .. need to replenish _cachedRows %d:%d", rowNum, endNum)
            #log.debug("current cache:[%s]", ", ".join([str(x) for x in self._cachedRows.keys()]))
            rows = self._koTableConnector.getRows(rowNum, endNum - rowNum + 1)
            idx = rowNum
            setRowNums = []
            for row in rows:
                try:
                    self._rowQueue.remove(idx)
                except:
                    if len(self._rowQueue) > self._cachedRowLimit:
                        last = self._rowQueue.pop()
                        del self._cachedRows[last]
                self._rowQueue.insert(0, idx)
                setRowNums.append(idx)
                self._cachedRows[idx] = row
                idx += 1
            #log.debug("setting _cachedRows[%s]",   ", ".join([str(x) for x in setRowNums]))
        try:
            return self._cachedRows[rowNum]
        except KeyError:
            log.error("getRow: Can't get rowNum:%d, # rows: %d\n\n\n",
                      rowNum,
                      self._koTableConnector.getRowCount())
            raise

class koDBXSchemaTreeView(koTreeView.TreeView):
    _com_interfaces_ = [components.interfaces.koIDBXSchemaTreeView,
                        components.interfaces.nsITreeView]
    _reg_clsid_ = "{fff4fe2e-4d5a-49b9-9a41-d819d8080bcf}"
    _reg_contractid_ = "@activestate.com/koDBXSchemaTreeView;1"
    _reg_desc_ = "Database Explorer: Schema Table TreeView"

    def setupTableConnector(self, koTableConnector):
        """
        @param koDBExplorerTable {KoDBXTableConnector}
        """
        self._koTableConnector = UnwrapObject(koTableConnector)
        self._columnInfo = self._koTableConnector.getColumnInfo()
        self._columnNames = self._koTableConnector.getSchemaColumnNames()

    def getTableColumnNames(self):
        return [row.name for row in self._columnInfo]

    def getSchemaColumnNames(self):
        return self._columnNames

    def getSchemaColumnIds(self):
        sampleRow = self._columnInfo[0]
        return [sampleRow.id_from_name(name) for name in self._columnNames]

    def columnTypeIsInteger(self, nameIdx):
        currentType = self._columnInfo[nameIdx].type
        return self._koTableConnector.columnTypeIsInteger(currentType)

    def columnTypeIsReal(self, nameIdx):
        currentType = self._columnInfo[nameIdx].type
        return self._koTableConnector.columnTypeIsReal(currentType)

    def columnTypeIsBlob(self, nameIdx):
        currentType = self._columnInfo[nameIdx].type
        return self._koTableConnector.columnTypeIsBlob(currentType)

    # Implement necessary methods off
    # nsITreeView
    def get_rowCount(self):
        return len(self._columnInfo)
    
    def getCellText(self, rowNum, column):
        dumplog.debug(">> koDBXSchemaTreeView.getCellText:%d, %s", rowNum, column.id)
        res = getattr(self._columnInfo[rowNum], column.id)
        if res is None:
            return ""
        return str(res)
    
# This class wraps access to the table's values via
# the nsITreeView interface, caching data cleverly.
class koDBXTableDumpTreeView(koTreeView.TreeView):
    _com_interfaces_ = [components.interfaces.koIDBXTableDumpTreeView,
                        components.interfaces.nsIObserver,
                        components.interfaces.nsITreeView]
    _reg_clsid_ = "{cb83adfd-bfa4-48de-a0e9-b6fd8c8361cb}"
    _reg_contractid_ = "@activestate.com/koDBXTableDumpTreeView;1"
    _reg_desc_ = "Database Explorer: Table Dump TreeView"
    
    def __init__(self):
        #log.debug(">> __init__")
        koTreeView.TreeView.__init__(self, debug=0)
        self._tree = None
        self._rowCount = None
        self._initialized = False
        self._rowCache = None
        self._numVisibleRows = None
        self._schemaTreeView = None

    def initialize(self, koDBExplorerTable):
        """
        @param koDBExplorerTable {KoDBXTableConnector}
        From koDBExplorerTable we can get the dbConnection and dbTable
        objects.
        """
        self._koTableConnector = UnwrapObject(koDBExplorerTable)

    def get_schemaTreeView(self):
        return self._schemaTreeView

    def set_schemaTreeView(self, schemaTreeView):
        self._schemaTreeView = schemaTreeView
 
    def refreshTable(self):
        log.debug(">> koDBXTableDumpTreeView.refreshTable")
        # Rebuild the cache.
        self._finishInitialize()
        
    def get_numVisibleRows(self):
        return self._numVisibleRows

    def set_numVisibleRows(self, val):
        log.debug("Setting # visible rows to %d", val)
        if self._rowCache is not None:
            self._rowCache.numVisibleRows = val
        self._numVisibleRows = val

    def _mapNamesToPosn(self):
        names = self._koTableConnector.getColumnNames()
        res = {}
        i = 0
        for n in names:
            res[n] = i
            i += 1
        return res

    def _finishInitialize(self):
        log.debug(">> koDBXTableDumpTreeView._finishInitialize")
        self._initialized = True
        try:
            self._rowCount = self._koTableConnector.getRowCount()
            self._columnNameMap = self._mapNamesToPosn()
            #TODO: If self._rowCount is 0, create a designated single
            # row with properties explaining that the table is empty.
            if self._rowCount == 0:
                self._rowCount = 1
                #TODO: Allow for locked tables/databases.
                self._rowCache = EmptyTableCache()
            else:
                cls = ((self._rowCount <= MAX_DENSE_CACHE_SIZE and DenseRowCache)
                       or SparseRowCache)
                self._rowCache = cls(self._koTableConnector)
            self._rowCache.initialize(self._rowCount)
            if self._numVisibleRows is not None:
                self._rowCache.numVisibleRows = self._numVisibleRows
            
        except:
            log.exception("Failed to get row count")
            if self._rowCount is None:
                self._rowCount = 0
        log.debug("koDBXTableDumpTreeView.rowCount: %d", self._rowCount)

    # Implement a bare-bones thing
    # nsITreeView
    def get_rowCount(self):
        if not self._initialized:
            log.debug(">> koDBXTableDumpTreeView.get_rowCount")
            self._finishInitialize()
        dumplog.debug(">> get_rowCount => %d", self._rowCount)
        return self._rowCount
    
    def getCellText(self, row, column):
        col_id = column.id
        col_idx = self._columnNameMap[col_id]
        res = self._rowCache.getCellText(row, col_idx)
        dumplog.debug(">> getCellText(%d,%s(%d)) ==> %r", row, col_id, col_idx, res)
        return res

    def setCellText(self, row, column, value):
        col_id = column.id
        col_idx = self._columnNameMap[col_id]
        # Read in the row if we don't have it.
        res = self._rowCache.getCellText(row, col_idx)
        return self._rowCache.setCellText(row, col_idx, value)
    
    def setTree(self, tree):
        dumplog.debug(">> setTree")
        self._tree = tree
        if not self._initialized:
            self._finishInitialize()

class DBXception(Exception):
    pass

class _FakeDBTable(object):
    def getRows(self, offset, limit):
        raise DBXception("query views shouldn't need to go back to the database for more rows")

    def getRowCount(self, dbConn):
        raise DBXception("query views shouldn't need to go back to the database to get the row-count")
        
    
class koDBXTableQueryTreeView(koTreeView.TreeView):
    _com_interfaces_ = [components.interfaces.koIDBXTableQueryTreeView,
                        components.interfaces.nsIObserver,
                        components.interfaces.nsITreeView]
    _reg_clsid_ = "{de11200d-f138-4113-bf0a-eb7be38b8d9d}"
    _reg_contractid_ = "@activestate.com/koDBXTableQueryTreeView;1"
    _reg_desc_ = "Database Explorer: Table Query TreeView"
    
    def __init__(self):
        koTreeView.TreeView.__init__(self, debug=0)
        self._query = None
        self._action = None
        self._last_query = None
        self._last_action = None
        self._clearQueryView()
        
    #---- Interface Methods

    def initialize(self, koDBExplorerTable):
        """
        @param koDBExplorerTable {KoDBXTableConnector}
        From koDBExplorerTable we can get the dbConnection and dbTable
        objects.
        """
        self._koTableConnector = UnwrapObject(koDBExplorerTable)
        
    def getTableColumnNames(self):
        return self._column_names
        
    def runCustomQuery(self, query):
        self._koTableConnector.runCustomQuery(self, query)
        self._query = self._last_query = query
            
    def refreshView(self):
        if self._query:
            self._koTableConnector.runCustomQuery(self, self._query)
            
    def clearQuery(self):
        self._query = None

    def executeCustomAction(self, action):
        res = self._koTableConnector.executeCustomAction(action)
        if res and self._query:
            # Trigger a refresh
            self._action = self._last_action = action
            self._koTableConnector.runCustomQuery(self, self._query)
        return res
    
    #---- Callback Methods used by the DB driver
            
    def initCache(self, row_count):
        self._rowCount = row_count
        self._rowCache = self.getCacheBySize(row_count)
        self._rowCache.initialize(row_count)
    
    def setColumnNames(self, column_names):
        self._column_names = column_names
        idx = 0
        for name in column_names:
            self._idx_from_column_name[name] = idx
            idx += 1
        
    def addRow(self, idx, row):
        if idx > self._rowCount:
            log.error("Supposed to have %d rows, trying to set row %d",
                       self._rowCount, idx)
        return self._rowCache.addRow(idx, row)
    
    #---- Internal Methods

    def _clearQueryView(self):
        self._rowCount = 0
        self._rowCache = EmptyTableCache()
        self._column_names = []
        self._idx_from_column_name = {}
        
    def getCacheBySize(self, row_count):
        if row_count == 0:
            return EmptyTableCache()
        elif row_count <= MAX_DENSE_CACHE_SIZE:
            return DenseRowCache(_FakeDBTable())
        else:
            return SparseRowCache(_FakeDBTable())
        
    # Implement a bare-bones nsITreeView
    def get_rowCount(self):
        return self._rowCount
    
    def getCellText(self, row, column):
        col_id = column.id
        col_idx = self._idx_from_column_name[column.id]
        res = self._rowCache.getCellText(row, col_idx)
        log.debug(">> getCellText(%d,%s(%d)) ==> %r", row, col_id, col_idx, res)
        return res
    
    def setTree(self, tree):
        log.debug("koDBXTableQueryTreeView.setTree to %r", tree)
        self._tree = tree


#---- Classes for handling the project-side pane

class _DBXBase(object):
    pass

class _DBXConnectionPart(_DBXBase):
    def __init__(self, name):
        self.name = name
        self.original_image_icon = self.image_icon

    def restore_icon(self):
        self.image_icon = self.original_image_icon

    def show_busy(self):
        self.image_icon = "dbx_busy"

    def initialize(self):
        pass

    def getName(self):
        return self.name
    
    def getCellPropertyNames(self, col_id):
        if col_id == 'name':
            return [self.image_icon]
        return []

class _DBXDatabaseConnection(_DBXConnectionPart):
    image_icon = "dbx_database_connect"
    isContainer = True
    def getNodeTypeName(self):
        return "connection"

class _DBXDatabase(_DBXConnectionPart):
    image_icon = "dbx_database"
    isContainer = True
    def getNodeTypeName(self):
        return "database"

class _DBXColumn(_DBXConnectionPart):
    image_icon = "dbx_text_columns"
    isContainer = False
    def getNodeTypeName(self):
        return "column"

class _DBXIndex(_DBXConnectionPart):
    image_icon = "dbx_table_gear"
    def getNodeTypeName(self):
        return "index"

class _DBXTrigger(_DBXConnectionPart):
    image_icon = "dbx_table_lightning"
    def getNodeTypeName(self):
        return "trigger"

class _DBXTable(_DBXConnectionPart):
    image_icon = "dbx_database_table"

    def getNodeTypeName(self):
        return "table"

class _DBXError(_DBXConnectionPart):
    image_icon = "dbx_exclamation"
    def getNodeTypeName(self):
        return "error"

_dbxConnectionParts = { 'table' : _DBXTable,
                        'database' : _DBXDatabase,
                        'column' : _DBXColumn,
                        'index' : _DBXIndex,
                        'trigger' : _DBXTrigger,
                        'error' : _DBXError,  #Not really a db type, but...
               }

def createDBConnector(prefObj):
    clsName = ("@activestate.com/koDBXConnection?database=%s;1"
               % prefObj.getStringPref('db_type'))
    dbConnection = components.classes[clsName].\
                  createInstance(components.interfaces.koIDBXConnection)
    dbConnection_uw = UnwrapObject(dbConnection)
    dbConnection_uw.initialize(prefObj)
    return dbConnection_uw

class _HierarchyNode(object):
    #  nodes { type, isOpen, object, childNodes }
    def __init__(self, level, infoObject, connectorObject=None, isContainer=False):
        self.level = level
        self.infoObject = infoObject
        self.connectorObject = connectorObject
        self.isContainer = connectorObject and isContainer or getattr(connectorObject, 'isContainer', False)
        self.isOpen = (self.isContainer
                       and self._nodeOpenStatusFromName.get(connectorObject.getURI(),
                                                            False))
        if self.isOpen:
            if connectorObject:
                prefs = (components.classes["@activestate.com/koDBXPreference?database=%s;1" % (connectorObject.getDatabaseInternalName(),)].
                         createInstance(components.interfaces.koIDBXPreference))
                if not prefs.is_enabled:
                    self.isOpen = False
                
        if self.isContainer:
            self.childNodes = [_HierarchyNode(level + 1,
                                              _DBXTable("<no tables yet>"))]

    def getCellText(self, col_id):
        methodName = "get" + col_id.capitalize()
        return getattr(self.infoObject, methodName)()

    def getCellPropertyNames(self, col_id):
        return self.infoObject.getCellPropertyNames(col_id)

    def refreshChildrenInfoOffNode(self):
        table_items = self.connectorObject.getChildren()
        
        newLevel = self.level + 1
        self.childNodes = []
        for item in table_items:
            name, connectionType, connectorObject = item
            clsItem = _dbxConnectionParts[connectionType](name)
            newNode = _HierarchyNode(newLevel, clsItem, connectorObject)
            if newNode.isOpen:
                newNode.refreshChildrenInfoOffNode()
            self.childNodes.append(newNode)
        

#---- PyXPCOM implementations

import threading
from Queue import Queue

class koDatabaseExplorerTreeView(koTreeView.TreeView):
    _com_interfaces_ = [components.interfaces.koIDatabaseExplorerTreeView,
                        components.interfaces.nsIObserver,
                        components.interfaces.nsITreeView]
    _reg_clsid_ = "{bd16341b-f5c2-4940-86a4-33824bbaceda}"
    _reg_contractid_ = "@activestate.com/koDatabaseExplorerTreeView;1"
    _reg_desc_ = "Database Explorer TreeView"
    
    def __init__(self):
        #log.debug(">> __init__")
        koTreeView.TreeView.__init__(self, debug=0)
        self._tree = None
        self._nodes = [] # tree of HierarchyNode
        self._rows  = [] # flat view of _nodes
        self._nodesByTypeAndName = {}
        self._nodeOpenStatusFromName = {}
        # Share this var
        _HierarchyNode._nodeOpenStatusFromName = self._nodeOpenStatusFromName
        self.lock = threading.RLock()
        self._workerThread = None
        atomSvc = components.classes["@mozilla.org/atom-service;1"].\
                  getService(components.interfaces.nsIAtomService)
        self._atomsFromName = {}
        for name in ["dbx_busy",
                     "dbx_database_connect",
                     "dbx_database",
                     "dbx_text_columns",
                     "dbx_table_gear",
                     "dbx_table_lightning",
                     "dbx_database_table",
                     "dbx_exclamation",
                     ]:
            self._atomsFromName[name] = atomSvc.getAtom(name)

    @property
    def workerThread(self):
        if self._workerThread is None:
            self._workerThread = _WorkerThread(target=_WorkerThread.run,
                                               name="DBX TreeView")
            self._workerThread.start()
        return self._workerThread

    #---- Other XPCOM interface
    
    def initialize(self):
        #log.debug(">> initialize")
        self._cachedRowLimit = 100
        self._rowCache = None
        # Get the current db connections from the prefs, and set up an observer.
        prefs = components.classes["@activestate.com/koPrefService;1"].\
            getService(components.interfaces.koIPrefService).prefs
        prefs.prefObserverService.addObserver(self, KO_DBEXPLORER_PREF_NAME, 0)
        if not prefs.hasPref(KO_DBEXPLORER_PREF_NAME):
            dbexplorerPrefs = components.classes["@activestate.com/koPreferenceSet;1"].createInstance()
            prefs.setPref(KO_DBEXPLORER_PREF_NAME, dbexplorerPrefs)
            prefs = dbexplorerPrefs
        else:
            prefs = prefs.getPref(KO_DBEXPLORER_PREF_NAME)
        if prefs.hasPref("dbexplorer-open-nodes"):
            try:
                savedHash = json.loads(prefs.getStringPref("dbexplorer-open-nodes"))
            except:
                log.exception('Error loading "dbexplorer-open-nodes" pref')
                pass
            else:
                try:
                    self._nodeOpenStatusFromName.update(savedHash)
                except:
                    log.exception('Error updating "dbexplorer-open-nodes" pref')
            
        self._updateDBConnList()
        
    def finalize(self):
        #log.debug(">> finalize")
        prefs = components.classes["@activestate.com/koPrefService;1"].\
            getService(components.interfaces.koIPrefService).prefs
        prefs.prefObserverService.removeObserver(self, KO_DBEXPLORER_PREF_NAME)
        prefs = prefs.getPref(KO_DBEXPLORER_PREF_NAME)
        prefs.setStringPref("dbexplorer-open-nodes", json.dumps(self._nodeOpenStatusFromName))
        if self._workerThread:
            self.workerThread.put((None, None, None))
            self.workerThread.join(3)
            self._workerThread = None

    _dbexplorer_prefix_re = r'dbexplorer://(.*?)/(.*)'
    def nodeNameFromURI(self, connectionURI):
        m = re.compile(self._dbexplorer_prefix_re).match(connectionURI)
        if m:
            nodeName = "%s:%s" % (m.group(1), m.group(2))
        else:
            nodeName = connectionURI
        return nodeName

    def addConnection(self, connectionURI):
        """ Format of a connection URI lib:
        dbexplorer://<db_type>/path
        dbexplorer://<db_type>/host[:port]/username
        """
        prefs = components.classes["@activestate.com/koPrefService;1"].\
            getService(components.interfaces.koIPrefService).prefs.getPref(KO_DBEXPLORER_PREF_NAME)
        try:
            prefObj = prefs.getPref('currentDatabaseConnections').getPref(connectionURI)
        except Exception, ex:
            log.exception("addConnection: no pref found")
            return
        #XXX See _updateDBConnList for handling duplicates
        infoObject = createDBConnector(prefObj)
        if not infoObject.get_loaded():
            log.info("Can't load database connection %s", connectionURI)
            return
        infoObject.connUri = connectionURI
        if (getattr(infoObject, "username", None) is not None
            and getattr(infoObject, "hasPassword", True)):
            dbxLoginManager = components.classes["@activestate.com/KoDBXLoginManager;1"].\
                              createInstance(components.interfaces.koIDBXLoginManager)
            try:
                dbxLoginInfo = self._dbxLoginInfo_from_infoObject(infoObject)
                infoObject.updatePassword(dbxLoginManager.getPasswordField(dbxLoginInfo))
            except Exception, ex:
                log.exception("addConnection: no pref found")
        nodeName = self.nodeNameFromURI(connectionURI)
        thisNode = _HierarchyNode(0,  # level
                                  _DBXDatabaseConnection(nodeName),
                                  infoObject,
                                  isContainer=True)
        self._nodesByTypeAndName[connectionURI] = thisNode
        self._nodes.append(thisNode)
        self._rows.append(thisNode)
        newCount = len(self._rows)
        newIndex = newCount - 1
        self._tree.rowCountChanged(newIndex, 1)
        if thisNode.isOpen:
            # Get the children, asynchronously
            thisNode.infoObject.show_busy()
            self._tree.invalidateRow(newIndex)
            self.workerThread.put(('getChildren', {'index':newIndex,
                                                   'node': thisNode,
                                                   'requester':self},
                                   'postAddConnection'))

    def testConnection(self, connectionURI):
        """ Format of a connection URI lib:
        dbexplorer://<db_type>/path
        dbexplorer://<db_type>/host[:port]/username
        @Returns: True if the connection can be made, False if not
        """
        prefs = components.classes["@activestate.com/koPrefService;1"].\
            getService(components.interfaces.koIPrefService).prefs.getPref(KO_DBEXPLORER_PREF_NAME)
        try:
            prefObj = prefs.getPref('currentDatabaseConnections').getPref(connectionURI)
        except Exception, ex:
            log.exception("addConnection: no pref found")
            return False
        #XXX See _updateDBConnList for handling duplicates
        infoObject = createDBConnector(prefObj)
        if not infoObject.get_loaded():
            log.error("Can't load database connection %s", connectionURI)
            return components.interfaces.koIDatabaseExplorerTreeView.TARGET_DATABASE_HAS_ERROR
        infoObject.connUri = connectionURI
        if (getattr(infoObject, "username", None) is not None
            and getattr(infoObject, "hasPassword", True)):
            dbxLoginManager = components.classes["@activestate.com/KoDBXLoginManager;1"].\
                              createInstance(components.interfaces.koIDBXLoginManager)
            try:
                dbxLoginInfo = self._dbxLoginInfo_from_infoObject(infoObject)
                infoObject.updatePassword(dbxLoginManager.getPasswordField(dbxLoginInfo))
            except Exception, ex:
                log.exception("addConnection: no pref found")
        res = infoObject.getChildren()
        # If there are no children, assume that the database is still
        # empty
        if not res:
            return (components.interfaces.koIDatabaseExplorerTreeView.TARGET_DATABASE_IS_EMPTY, "")
        elif res[0][0].startswith("Error:"):
            return (components.interfaces.koIDatabaseExplorerTreeView.TARGET_DATABASE_HAS_ERROR,
                    res[0][0])
        return (components.interfaces.koIDatabaseExplorerTreeView.TARGET_DATABASE_OK, None)
    
    def postAddConnection(self, rv, newIndex, count):
        oldCount = len(self._rows)
        self.lock.acquire()
        try:
            node = self._rows[newIndex]
            self._regenerateTreeFromNodes(node.childNodes)
        finally:
            self.lock.release()
        newCount = len(self._rows)
        if newCount != oldCount:
            self._tree.rowCountChanged(newIndex, newCount - oldCount)

    def getConnectionInfo(self, index):
        prefs = components.classes["@activestate.com/koPrefService;1"].\
            getService(components.interfaces.koIPrefService).prefs.getPref(KO_DBEXPLORER_PREF_NAME)
        prefList = prefs.getPref('currentDatabaseConnections')

        prefId = self._rows[index].connectorObject.connUri
        try:
            prefObj = prefList.getPref(prefId)
            prefIds = prefObj.getPrefIds()
        except:
            log.exception("Can't find pref %s", prefId)
            prefIds = []
        prefVals = []
        for id in prefIds:
            if id == "hasPassword":
                if prefObj.getBooleanPref(id):
                    prefVals.append("1")
                else:
                    prefVals.append("")
            else:
                prefVals.append(prefObj.getStringPref(id))
        return prefIds, prefVals

    @components.ProxyToMainThread
    def handleCallback(self, callback, rc, rv, rowIndex, numAffectedRows):
        #log.debug("handleCallback: callback:%s, rc:%r, rv:%s, rowIndex:%d, numAffectedRows:%d", callback, rc, rv, rowIndex, numAffectedRows)
        if not rc:
            raise DBXception("Internal error: " + rv)
        try:
            getattr(self, callback)(rv, rowIndex, numAffectedRows)
        except:
            log.exception("handleCallback: callback %s", callback)

    def getNodeName(self, index):
        return self._rows[index].infoObject.getName()
        
    def getNodeType(self, index):
        """ @param index {int} -- which row
            @returns a name of the type of node
        """
        if not index in range(len(self._rows)):
            log.error("index %r not in %r" % (index, self._rows))
            return ""
        return self._rows[index].infoObject.getNodeTypeName()

    def removeConnection(self, index):
        # There might be pending requests that will modify the tree,
        # so do this after.
        rowNode = self._rows[index]
        rowNode.infoObject.show_busy()
        self._tree.invalidateRow(index)
        self.workerThread.put(('echo',
                               {'index':index,
                                'node': rowNode,
                                'requester':self},
                               'postRemoveConnection'))

    def _connectionURI_from_connectorObject(self, connectorObject):
        db_type = connectorObject.db_type
        uri = "dbexplorer://" + db_type
        if getattr(connectorObject, 'hostname', None) is None:
            uri += "/" + connectorObject.dbPath
        else:
            uri += "/" + connectorObject.hostname
            if len(connectorObject.port) > 0:
                uri += ":" + connectorObject.port
            uri += "/" + connectorObject.username
        return uri

    def postRemoveConnection(self, rv, index, count):
        node = self._rows[index]
        connectorObject = node.connectorObject

        prefURI = self._connectionURI_from_connectorObject(connectorObject)
        # Remove the pref, and then the password entry if needed
        prefset = components.classes["@activestate.com/koPrefService;1"].\
                       getService(components.interfaces.koIPrefService).prefs
        prefset = prefset.getPref("ko-dbexplorer")
        connectionPrefs = prefset.getPref('currentDatabaseConnections')
        try:
            connectionPrefs.deletePref(prefURI)
        except Exception:
            log.exception("Failed to delete pref %s", prefURI)
            return
        else:
            if getattr(connectorObject, 'hasPassword', False):
                dbxLoginManager = components.classes["@activestate.com/KoDBXLoginManager;1"].\
                                  createInstance(components.interfaces.koIDBXLoginManager)
                dbxLoginInfo = self._dbxLoginInfo_from_infoObject(connectorObject)
                try:
                    dbxLoginManager.removeLoginConnectionInfo(dbxLoginInfo)
                except Exception, ex:
                    log.exception("Couldn't remove login")
            
        # Now remove this from the tree, and rebuild the tree
        # This can be done synchronously -- no db connections here.
            
        self.lock.acquire()
        try:
            if self.isContainerOpen(index):
                self.postToggleOpenState_Close("", index, self.getLastChild(index))
            del self._rows[index]
            self._tree.rowCountChanged(index, -1)
            self._tree.invalidateRow(index)
        finally:
            self.lock.release()
        
    def getLastChild(self, index):
        node = self._rows[index]
        level = node.level
        oldRowCount = len(self._rows)
        i = index + 1
        while i < oldRowCount and self._rows[i].level > level:
            i = i + 1
        return i

    def getDBConnectionForTable(self, tableIndex):
        return self._rows[tableIndex].connectorObject

    def refreshChildrenInfo(self, index):
        # This is called from the JS side
        rowNode = self._rows[index]
        rowNode.infoObject.show_busy()
        self._tree.invalidateRow(index)
        self.workerThread.put(('getChildrenReturnOldChildNodeCount',
                               {'index':index,
                                'node': rowNode,
                                'requester':self},
                               'postRefreshChildrenInfo'))

    def postRefreshChildrenInfo(self, rv, index, oldChildNodeCount):
        rowNode = self._rows[index]
        rowNode.infoObject.restore_icon()
        self._tree.invalidateRow(index)
        if rowNode.isOpen:
            newChildNodesCount = len(rowNode.childNodes)
            # Need to rebuild
            self._rows = (self._rows[:index + 1]
                          + rowNode.childNodes
                          + self._rows[index + 1 + oldChildNodeCount:])
            diff = newChildNodesCount - oldChildNodeCount
            self._tree.rowCountChanged(index + 1 + diff,
                                       diff)
            self._tree.beginUpdateBatch()
            self._tree.invalidateRange(index + 1, index + 1 + newChildNodesCount);
            self._tree.endUpdateBatch()

        rowNode = self._rows[index]
        oldNodesCount = len(rowNode.childNodes)

    #---- Other external-facing functions

    def observe(self, obj, topic, data):
        #log.debug(">> observe topic:%s", topic)
        if topic == KO_DBEXPLORER_PREF_NAME:
            self._updateDBConnList()

    def refreshDatabases(self):
        self._updateDBConnList()

    def _updateDBConnList(self):
        #log.debug(">> _updateDBConnList")
        dbxLoginManager = components.classes["@activestate.com/KoDBXLoginManager;1"].\
            createInstance(components.interfaces.koIDBXLoginManager)
        prefs = components.classes["@activestate.com/koPrefService;1"].\
            getService(components.interfaces.koIPrefService).prefs.getPref(KO_DBEXPLORER_PREF_NAME)
        self._nodes = []
        knownNames = dict([(x, 1) for x in self._nodesByTypeAndName.keys()])
        nodesToRefresh = []
        if prefs.hasPref('currentDatabaseConnections'):
            prefList = prefs.getPref('currentDatabaseConnections')
            prefIds = prefList.getPrefIds()
            for prefId in prefIds:
                prefObj = prefList.getPref(prefId)
                #log.debug("add conn %s", prefId)
                if self._nodesByTypeAndName.has_key(prefId):
                    thisNode = self._nodesByTypeAndName[prefId]
                    #log.debug("reuse node %s", thisNode)
                    del knownNames[prefId]
                else:
                    #log.debug("create new one ...")
                    try:
                        infoObject = createDBConnector(prefObj)
                    except COMException, ex:
                        if (re.compile(r'No such component.*koDBXConnection\?database=%s;\d' % (prefObj.getString('db_type', '<unknown>'),))
                            .search(str(ex.message))):
                            log.error("The database %s currently isn't installed",
                                      prefObj.getStringPref('db_type'))
                            log.exception("  why: ")
                        else:
                            log.exception("Can't create database %s", self.display_prefObj(prefObj))
                        continue
                    except:
                        log.exception("Error trying to create a database")
                        continue
                    if not infoObject.get_loaded():
                        log.info("Can't load database connection %s", prefId)
                        continue
                    infoObject.connUri = prefId
                    #TODO: Find a better way to determine if this db is file-based
                    if getattr(infoObject, "username", None) is not None:
                        dbxLoginInfo = self._dbxLoginInfo_from_infoObject(infoObject)
                        infoObject.updatePassword(dbxLoginManager.getPasswordField(dbxLoginInfo))
                    nodeName = self.nodeNameFromURI(prefId)
                    thisNode = _HierarchyNode(0,  # level
                                              _DBXDatabaseConnection(nodeName),
                                              infoObject,
                                              isContainer=True)
                    self._nodesByTypeAndName[prefId] = thisNode
                    #TODO: Get the top-level nodes to appear, and have them start
                    # waiting
                    if thisNode.isOpen:
                        nodesToRefresh.append(thisNode)
                self._nodes.append(thisNode)
            # Cull the names that are no longer used.
            for oldName in knownNames.keys():
                del self._nodesByTypeAndName[oldName]
        else:
            log.debug("No currentDatabaseConnections in prefs!")
        if nodesToRefresh:
            self.workerThread.put(('refreshNodes', {'index':-1,
                                                    'requester':self,
                                                    'nodes':nodesToRefresh},
                                   'postRefreshNodes'))
            if self._tree:
                self._rows = self._nodes
                self._tree.rowCountChanged(0,
                                           len(self._nodes))
                self._tree.beginUpdateBatch()
                self._tree.invalidate()
                self._tree.endUpdateBatch()
        else:
            self.postRefreshNodes(None, 0, -1)

    def display_prefObj(self, prefObj):
        ids = prefObj.getPrefIds()
        parts = []
        for pref_id in ids:
            pref_type = prefObj.getPrefType(pref_id)
            if pref_type == "string":
                val = prefObj.getStringPref(pref_id)
            elif pref_type == "long":
                val = prefObj.getLongPref(pref_id)
            elif pref_type == "boolean":
                val = prefObj.getBooleanPref(pref_id)
            else:
                val = '?'
            parts.append("%s:%r" % (pref_id, val))
        return ", ".join(parts)

    def _dbxLoginInfo_from_infoObject(self, infoObject, password=""):
        dbxLoginInfo = components.classes["@activestate.com/KoDBXLoginInfo;1"].\
                       createInstance(components.interfaces.koIDBXLoginInfo)
        dbxLoginInfo.init(infoObject.db_type,
                          infoObject.hostname,
                          infoObject.port,
                          infoObject.username,
                          password)
        return dbxLoginInfo

    def postRefreshNodes(self, rv, offset, count):
        self._regenerateTree()
        if self._tree:
            self._tree.beginUpdateBatch()
            self._tree.invalidate()
            self._tree.endUpdateBatch()

    def _regenerateTree(self):
        self._rows = []
        self._regenerateTreeFromNodes(self._nodes)
        
    def _regenerateTreeFromNodes(self, nodes):
        for node in nodes:
            #log.debug("_regenerateTreeFromNodes: adding node %s", node.infoObject.getName())
            self._rows.append(node)
            if node.isOpen:
                self._regenerateTreeFromNodes(node.childNodes)

    def updatePassword(self, index, password):
        self._rows[index].connectorObject.updatePassword(password)

    def dump_rows(self, rows):
        i = 0
        for r in rows:
            log.debug("%slevel %d: node %r: isContainer:%d, isOpen:%d, #children:%d, node:%r",
                      " " * r.level, i, r, r.isContainer, r.isOpen,
                      (r.isContainer and len(r.childNodes)) or -1,
                      r.infoObject)
            i += 1
        
    # nsITreeView
    def get_rowCount(self):
        #log.debug(">> get_rowCount:%d", len(self._rows))
        return len(self._rows)
    
    def getCellText(self, row, column):
        col_id = column.id
        #log.debug(">> getCellText:%d, %s", row, col_id)
        try:
            return self._rows[row].getCellText(col_id)
        except AttributeError:
            log.debug("getCellText: No id %s at row %d", col_id, row)
            return "%r+%r" % (row, col_id)

    def getCellProperties(self, row_idx, column, properties=None):
        #assert col.id == "name"
        col_id = column.id
        try:
            props = self._rows[row_idx].getCellPropertyNames(col_id)
            # Mozilla 22+ does not have a properties argument.
            if properties is None:
                return " ".join(props)
            for propName in props:
                try:
                    properties.AppendElement(self._atomsFromName[propName])
                except KeyError:
                    log.debug("getCellProperties: no property for %s",
                               propName)
        except AttributeError:
            log.exception("getCellProperties(row_idx:%d, col_id:%r",
                          row_idx, col_id)

    # Nested tree functions
    def isContainer(self, index):
        #log.debug(">> isContainer[%d] => %r", index, self._rows[index].isContainer)
        return self._rows[index].isContainer
    
    def isContainerOpen(self, index):
        #log.debug(">> isContainerOpen[%d] => %r", index, self._rows[index].isOpen)
        return self._rows[index].isOpen
        
    def isContainerEmpty(self, index):
        #log.debug(">> isContainerEmpty[%d] => %r", index, len(self._rows[index].childNodes) == 0)
        try:
            return self.isContainer(index) and len(self._rows[index].childNodes) == 0
        except AttributeError, ex:
            node = self._rows[index]
            log.exception("level: %d, infoObject:%r, connectorObject:%r, isContainer:%r",
                           node.level,
                           node.infoObject,
                           node.connectorObject,
                           node.isContainer)
            return False

    def getParentIndex(self, index):
        if index >= len(self._rows) or index < 0: return -1
        try:
            i = index - 1
            level = self._rows[index].level
            while i > 0 and self._rows[i].level >= level:
                i -= 1
        except IndexError, e:
            i = -1
        return i

    def hasNextSibling(self, index, afterIndex):
        if index >= len(self._rows) or index < 0: return 0
        try:
            current_level = self._rows[index].level
            for next_row in self._rows[afterIndex + 1:]:
                next_row_level = next_row.level
                if next_row_level < current_level:
                    return 0
                elif next_row_level == current_level:
                    return 1
        except IndexError, e:
            pass
        return 0
    
    def getLevel(self, index):
        if index >= len(self._rows) or index < 0: return -1
        return self._rows[index].level

    def toggleOpenState(self, index):
        rowNode = self._rows[index]
        rowNode.infoObject.show_busy()
        self._tree.invalidateRow(index)
        if rowNode.isOpen:
            # Remove the children from the rows
            self.workerThread.put(('removeChildren', {'index':index,
                                                    'requester':self,
                                                    'node':rowNode},
                                   'postToggleOpenState_Close'))
        else:
            self.workerThread.put(('getChildren', {'index':index,
                                                    'requester':self,
                                                    'node':rowNode},
                                   'postToggleOpenState_Open'))
            
    def postToggleOpenState_Open(self, rv, index, count):
        rowNode = self._rows[index]
        #log.debug("Toggle: currRow: %r", rowNode)
        self.lock.acquire()
        try:
            if rowNode.isOpen:
                return
            self._nodeOpenStatusFromName[rowNode.connectorObject.getURI()] = True
            newNodes = []
            self.expandChildNodes(rowNode, newNodes)
            self._rows = self._rows[:index + 1] + newNodes + self._rows[index + 1:]
            self._tree.rowCountChanged(index + 1, len(newNodes))
            tree_log.debug("Telling tree box row count changed at idx %d by %d rows",
                           index + 1, len(newNodes))
            rowNode.isOpen = True
            if tree_log.level <= logging.DEBUG:
                self.dump_rows(self._rows)
            rowNode.infoObject.restore_icon()
            self._tree.invalidateRow(index)
        finally:
            self.lock.release()

    def expandChildNodes(self, node, newNodes):
        for child in node.childNodes:
            newNodes.append(child)
            if child.isOpen:
                self.expandChildNodes(child, newNodes)

    def postToggleOpenState_Close(self, rv, index, lastChild):
        # lastChild points one past the end of the node's children.
        self.lock.acquire()
        try:
            rowNode = self._rows[index]
            if not rowNode.isOpen:
                # It's already been closed.
                return
            try:
                del self._nodeOpenStatusFromName[rowNode.connectorObject.getURI()]
            except KeyError:
                pass
            rowNode.isOpen = False
            self._rows = self._rows[:index + 1] + self._rows[lastChild:]
            diff = index + 1 - lastChild
            self._tree.rowCountChanged(index + 1, diff)
            rowNode.infoObject.restore_icon()
            self._tree.invalidateRow(index)
        finally:
            self.lock.release()

    def setTree(self, tree):
        #log.debug(">> setTree")
        self._tree = tree

    def isEditable(self, row, column):
        #XXX id columns shouldn't be editable
        col_id = column.id
        log.info("isEditable(%d, %r)", row, col_id)
        return True

    def setCellText(self, row, column, value):
        col_id = column.id
        log.info("setCellText(%d, %r) to %r", row, col_id, value)
        return True

    # Asych part of the module
class _WorkerThread(threading.Thread, Queue):
    def __init__(self, **kwargs):
        threading.Thread.__init__(self, **kwargs)
        self.setDaemon(True)
        Queue.__init__(self)

    def run(self):
        while 1:
            request, args, callback = self.get()
            if not request:
                break
            treeView = args['requester']
            rv = None
            offset = 0
            numAffectedRows = -1
            rc = False
            treeView.lock.acquire()
            try:
                oldIndex = args['index']
                if oldIndex < 0:
                    # index isn't used, so we don't need to refind the node
                    newIndex = oldIndex
                else:
                    node = args['node']
                    if len(treeView._rows) > oldIndex and treeView._rows[oldIndex] is node:
                        newIndex = oldIndex
                    else:
                        # Get the true index, in case the tree changed between
                        # the time the request was made, and now
                        try:
                            newIndex = treeView._rows.index(node)
                        except ValueError:
                            rv = "Can't find node %r (was at %d)" % (node, args['index'])
                            newIndex = None
                        else:
                            if newIndex != args['index']:
                                log.debug("At time of request, index was %d, now it's %d", args['index'], newIndex)
                                args['index'] = newIndex
                if newIndex is not None:
                    rv, offset, numAffectedRows = getattr(self, request)(args)
                    rc = True
            finally:
                treeView.lock.release()
            treeView.handleCallback(callback, rc, rv, offset, numAffectedRows)

    def refreshNodes(self, args):
        index = args['index']
        nodesToRefresh = args['nodes']
        for node in nodesToRefresh:
            node.infoObject.show_busy()
            try:
                node.refreshChildrenInfoOffNode()
            finally:
                node.infoObject.restore_icon()
            # Invalidation has to be done in the UI thread.
        return "", index, -1

    def getChildren(self, args):
        newIndex = args['index']
        treeView = args['requester']
        node = treeView._rows[newIndex]
        node.refreshChildrenInfoOffNode()
        return "", newIndex, 1

    def getChildrenReturnOldChildNodeCount(self, args):
        treeView = args['requester']
        index = args['index']
        node = treeView._rows[index]
        oldChildNodeCount = len(node.childNodes)
        try:
            node.refreshChildrenInfoOffNode()
            rval = ""
        except NameError, ex:
            log.exception("getChildrenReturnOldChildNodeCount: failed")
            rval = ex.message
        return "", index, oldChildNodeCount

    def removeChildren(self, args):
        index = args['index']
        treeView = args['requester']
        return "", index, treeView.getLastChild(index)

    def echo(self, args):
        return "", args['index'], -1
