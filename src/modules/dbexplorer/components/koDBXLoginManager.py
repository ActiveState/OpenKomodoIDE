#!python
# Copyright (c) 2000-2010 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

# Manage preference/login-manager interface

# Force update.

import traceback
import os
import sys
import re
import logging

log = logging.getLogger("koDBXLoginManager")
# log.setLevel(logging.DEBUG)

from xpcom import components, ServerException, COMException, nsError
from xpcom.client import WeakReference

class LoginInfo(object):
    def __init__(self, db_type, hostname, port, username):
        self.db_type = db_type
        self.hostname = hostname
        self.port = port
        self.username = username

    def __repr__(self):
        return ("%r: db_type:%s, hostname:%s, port:%r, username:%s" %
                (self.db_type, self.hostname, self.port, self.username))

class KoDBXLoginInfo(object):
    _com_interfaces_ = [components.interfaces.koIDBXLoginInfo]
    _reg_desc_ = "DBX Login Info Block"
    _reg_clsid_ = "{91765929-2D83-4419-A780-694AD0491683}"
    _reg_contractid_ = "@activestate.com/KoDBXLoginInfo;1"
    def init(self, db_type, hostname, port, username, password):
        self.db_type = db_type
        self.hostname = hostname
        self.port = port
        self.username = username
        self.password = password

    def __repr__(self):
        return ("%r: db_type:%s, hostname:%s, port:%r, username:%s" %
                (self.db_type, self.hostname, self.port, self.username))

class KoDBXLoginManager(object):
    _com_interfaces_ = [components.interfaces.koIDBXLoginManager]
    _reg_desc_ = "DBX Login Manager Interface"
    _reg_clsid_ = "{3e1741fc-3a0e-4970-b31e-8c175c59358a}"
    _reg_contractid_ = "@activestate.com/KoDBXLoginManager;1"

    EMPTY_PASSWORD_SENTINEL = '\vKOMODO_EMPTY_PASSWORD\v'

    def addLoginConnectionInfo(self, koDBXLoginInfo):
        loginManager = components.classes["@mozilla.org/login-manager;1"].\
                            getService(components.interfaces.nsILoginManager)
        existingLoginInfo = self.getLoginInfoWithUsername(koDBXLoginInfo)
        if existingLoginInfo:
            log.debug("Removing previous login info for %r",
                      koDBXLoginInfo)
            loginManager.removeLogin(existingLoginInfo)
        loginInfo = self._nsILoginInfo_from_DBXLoginInfo(koDBXLoginInfo)
        loginManager.addLogin(loginInfo)

    def getLoginInfo(self, koDBXLoginInfo):
        # hostname, port, db_type):
        loginManager = components.classes["@mozilla.org/login-manager;1"].\
                            getService(components.interfaces.nsILoginManager)
        hostname_field = self._get_hostname_field(koDBXLoginInfo)
        httpRealm = self._get_httpRealm_field(koDBXLoginInfo)
        logins = loginManager.findLogins(hostname_field, None, httpRealm)
        if not logins:
            # loginManager.findLogins returns None
            # when there's no match.  Grrrr
            return []
        return [login.QueryInterface(components.interfaces.nsILoginInfo)
                for login
                in loginManager.findLogins(hostname_field, None, httpRealm)]

    def getLoginInfoWithUsername(self, koDBXLoginInfo):
        logins = self.getLoginInfo(koDBXLoginInfo)
        for login in logins:
            if login.username == koDBXLoginInfo.username:
                return login
        else:
            return None

    def getPasswordField(self, koDBXLoginInfo):
        try:
            login = self.getLoginInfoWithUsername(koDBXLoginInfo)
            if login is None:
                return ""
            elif login.password == self.EMPTY_PASSWORD_SENTINEL:
                return ""
            return login.password
        except AttributeError, ex:
            raise ServerException(nsError.NS_ERROR_FAILURE, ex)


    def updatePasswordField(self, koDBXLoginInfo):
        if not koDBXLoginInfo.username:
            return False
        login = self.getLoginInfoWithUsername(koDBXLoginInfo)
        if not login:
            self.addLoginConnectionInfo(koDBXLoginInfo)
        else:
            newLoginInfo = login.clone()
            if len(koDBXLoginInfo.password) == 0:
                newLoginInfo.password = self.EMPTY_PASSWORD_SENTINEL
            else:
                newLoginInfo.password = koDBXLoginInfo.password
            loginManager = components.classes["@mozilla.org/login-manager;1"].\
                           getService(components.interfaces.nsILoginManager)
            loginManager.modifyLogin(login, newLoginInfo)
                    
    def removeLoginConnectionInfo(self, koDBXLoginInfo):
        loginManager = components.classes["@mozilla.org/login-manager;1"].\
                            getService(components.interfaces.nsILoginManager)
        loginInfo = self.getLoginInfoWithUsername(koDBXLoginInfo)
        if loginInfo:
            loginManager.removeLogin(loginInfo)
      
    def _get_hostname_field(self, koDBXLoginInfo):
        return "dbexplore:%s:%s" % (koDBXLoginInfo.hostname,
                                    koDBXLoginInfo.port)

    def _get_httpRealm_field(self, koDBXLoginInfo):
        return "%s" % (koDBXLoginInfo.db_type,)

    def _nsILoginInfo_from_DBXLoginInfo(self, koDBXLoginInfo):
        loginInfo = components.classes["@mozilla.org/login-manager/loginInfo;1"]\
                            .createInstance(components.interfaces.nsILoginInfo)
        if len(koDBXLoginInfo.password) == 0:
            password = self.EMPTY_PASSWORD_SENTINEL
        else:
            password = koDBXLoginInfo.password
        loginInfo.init(self._get_hostname_field(koDBXLoginInfo),
                       None, # aFormSubmitURL
                       self._get_httpRealm_field(koDBXLoginInfo),
                       koDBXLoginInfo.username, password,
                       # aUsernameField and aPasswordField not used
                       "", "")
        return loginInfo
