#!/usr/bin/env python
# Copyright (c) 2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.
#
# Data structures and classes used by Komodo's HTTP Inspector.
#
# Contributors:
# * Todd Whiteman


import sys
import time
import datetime
import threading
import logging
import re
import gzip
import cStringIO
import random

from xpcom import components, COMException
from xpcom.client import WeakReference
from xpcom.server import UnwrapObject

from koTreeView import TreeView
from caselessDict import CaselessDict

log = logging.getLogger("koHttpInspector")
#log.setLevel(logging.DEBUG)

#
# Pseudo of whats needed
#
# ProxyRequest class / object - what the browser requests for
#   - See: http://www.w3.org/Protocols/rfc2616/rfc2616-sec5.html#sec5
#   - method (OPTIONS, GET, HEAD, POST, PUT, DELETE, TRACE, CONNECT)
#   - URL: scheme, host, port, path
#   - Http headers
#   - Content (for POST, PUT methods)
# ProxyResponse class / object
#   - See: http://www.w3.org/Protocols/rfc2616/rfc2616-sec6.html#sec6
#   - Status code / message
#   - Version
#   - Http headers
#   - Content
# ProxyPair - Request and response pair
# ProxySession - multiple ProxyPairs for one proxy connection (HTTP 1.1 keep alive)
# ProxyCache - ProxySessions handled since started (or last reset)

#
# Dev Notes:
#  - The tricky part is going to be getting data/messages/notifications between
#    the twisted proxy (a separate thread) and the koHttpInspector.
#

# Tree column names, used for determining the cell text for a particular column
# Note: Must match what is defined in the XUL treecols element.
proxyDebuggerTreeColumnNames = {
    # Id, Label
    "httpInspector_treecol_creation_id":    "Id",
    "httpInspector_treecol_flags":          "State",
    "httpInspector_treecol_name":           "Name",
    "httpInspector_treecol_time":           "Time",
    "httpInspector_treecol_request_ip":     "Client address",
    "httpInspector_treecol_duration":       "Duration",
    "httpInspector_treecol_method":         "Method",
    "httpInspector_treecol_status":         "Status",
    "httpInspector_treecol_size":           "Size",
    "httpInspector_treecol_content_type":   "Content",
    "httpInspector_treecol_url":            "Url"
}

# List location of fields in a http response
RESPONSE_VERSION_FIELD = 0
RESPONSE_STATUS_FIELD = 1

# Utility function for generating a unique session id
class rowIdGenerator:
    def __init__(self):
        self.__lock = threading.Lock()
        self.__rowId = 0
    def newId(self):
        self.__lock.acquire()
        try:
            self.__rowId += 1
            return self.__rowId
        finally:
            self.__lock.release()

################################################################
#         HTTP Inspector - request and response pair           #
################################################################

class koProxyReqRespPair:
    _com_interfaces_ = [components.interfaces.koIHttpInspectorReqRespPair]
    _reg_clsid_ = "{f84f5563-f844-472f-85ba-1de7545f86a7}"
    _reg_contractid_ = "@activestate.com/koHttpInspectorReqRespPair;1"
    _reg_desc_ = "Komodo HTTP Inspector request and response pair"
    _rowIdGenerator = rowIdGenerator()
    # Have to delay loading of the encoding service until after startup
    # http://bugs.activestate.com/show_bug.cgi?id=48108
    _encodingSvc = None

    def __init__(self):
        # XXX - Use twisted's objects or our own?
        #     - How does save, load work for twisted objects?
        self.creation_id = self._rowIdGenerator.newId()
        # State of the request/response
        self.flags = components.interfaces.koIHttpInspectorReqRespPair.FLAGS_NONE
        self.forcedResponseStatus = 0
        # Request
        self.client_address = ''
        self.client_port = 0
        self.request = None
        self.request_time = 0
        self.request_headers = None
        import koTwistedProxy
        self.response_codes = koTwistedProxy.http.RESPONSES
        # Response
        self.response = None
        self.response_time = 0
        self.response_headers = None
        # Load the global encoding svc if it's not already loaded
        if not self._encodingSvc:
            koProxyReqRespPair._encodingSvc = components.classes['@activestate.com/koEncodingServices;1'].\
                                                getService(components.interfaces.koIEncodingServices)

    def ruleMatchesRequest(self, koRule):
        """See if the rule is match for this request.

        koRule - is an koIHttpInspectorRule XPCOM object
        Return value: True when matches or False when not.

        """
        if not self.request or \
           not koRule.type & koHttpInspectorRule.TYPE_REQUEST:
            return False

        # If there are no match requirements, then this Rule is not a match.
        matched = False
        match_on_any = koRule.match_any

        for requirement in koRule.getRequirements()[:]:  # Copy, in case modified
            matched = False
            # requirement is a koIHttpInspectorRuleRequirement XPCOM object
            if requirement.type == koHttpInspectorRuleRequirement.RULE_ON_URL:
                matched = requirement.matches(self.get_url())
            elif requirement.type == koHttpInspectorRuleRequirement.RULE_ON_HEADER:
                if self.request_headers:
                    headerName = requirement.field.lower()
                    headerValue = self.request_headers.get(headerName, None)
                    if headerValue is not None:
                        matched = requirement.matches(headerValue)
            elif requirement.type == koHttpInspectorRuleRequirement.RULE_ON_METHOD:
                matched = requirement.matches(self.get_method())
            elif requirement.type == koHttpInspectorRuleRequirement.RULE_ON_DATA:
                matched = requirement.matches(self.get_decoded_request_data())
            elif requirement.type == koHttpInspectorRuleRequirement.RULE_ON_CLIENT_IP_ADDRESS:
                matched = requirement.matches(self.getText_request_ip())

            if match_on_any:
                if matched:
                    return True
            else:   # Match on all
                if not matched:
                    return False

        return matched

    def ruleMatchesResponse(self, koRule):
        """See if the rule is match for this response.

        koRule - is an koIHttpInspectorRule XPCOM object
        Return value: True when matches or False when not.

        """
        if not self.response or \
           not koRule.type & koHttpInspectorRule.TYPE_RESPONSE:
            return False

        # If there are no match requirements, then this Rule is not a match.
        matched = False
        match_on_any = koRule.match_any

        for requirement in koRule.getRequirements()[:]:  # Copy, in case modified
            matched = False
            # requirement is a koIHttpInspectorRuleRequirement XPCOM object
            if requirement.type == koHttpInspectorRuleRequirement.RULE_ON_URL:
                matched = requirement.matches(self.get_url())
            elif requirement.type == koHttpInspectorRuleRequirement.RULE_ON_METHOD:
                matched = requirement.matches(self.get_method())
            elif requirement.type == koHttpInspectorRuleRequirement.RULE_ON_STATUS:
                matched = requirement.matches(self.get_status())
            elif requirement.type == koHttpInspectorRuleRequirement.RULE_ON_HEADER:
                if self.response_headers:
                    headerName = requirement.field.lower()
                    headerValue = self.response_headers.get(headerName, None)
                    if headerValue is not None:
                        matched = requirement.matches(headerValue)
            elif requirement.type == koHttpInspectorRuleRequirement.RULE_ON_VERSION:
                matched = requirement.matches(self.get_version())
            elif requirement.type == koHttpInspectorRuleRequirement.RULE_ON_DATA:
                matched = requirement.matches(self.get_decoded_response_data())

            if match_on_any:
                if matched:
                    return True
            else:   # Match on all
                if not matched:
                    return False

        return matched

    def _performSharedRuleAction(self, action, headers):
        """Perform common rule action on this request or response.

        action - is a koIHttpInspectorRuleAction XPCOM object
        Return value: tuple of (matched, modified, isBreak, delayPeriod, isTimeout)

        """
        modified = False
        isBreak = False
        delayPeriod = None
        isTimeout = False

        if action.type == koHttpInspectorRuleAction.ACTION_SET_HEADER:
            if headers:
                headerName = action.value1.lower()
                headers[headerName] = action.value2
                log.debug("performRuleActions: Set header: '%s' to '%s'", headerName, action.value2)
                modified = True
        elif action.type == koHttpInspectorRuleAction.ACTION_REMOVE_HEADER:
            if headers:
                headerName = action.value1.lower()
                headers.pop(headerName, None)
                log.debug("performRuleActions: Remove header: '%s'", headerName)
                modified = True
        elif action.type == koHttpInspectorRuleAction.ACTION_BREAK:
            log.debug("performRuleActions: Break")
            isBreak = True
        elif action.type == koHttpInspectorRuleAction.ACTION_DELAY:
            try:
                if action.flags == koHttpInspectorRuleAction.ACTION_FLAG_LITERAL:
                    delayPeriod = int(action.value1)
                    log.debug("performRuleActions: Delay %r seconds", delayPeriod)
                elif action.flags == koHttpInspectorRuleAction.ACTION_FLAG_RANDOM:
                    range1 = int(action.value1)
                    range2 = int(action.value2)
                    delayPeriod = random.randint(range1, range2)
                    log.debug("performRuleActions: Delay %r seconds", delayPeriod)
            except ValueError:
                pass
        elif action.type == koHttpInspectorRuleAction.ACTION_TIMEOUT:
            log.debug("performRuleActions: Timeout")
            isTimeout = True
        if modified or isBreak or delayPeriod or isTimeout:
            return (True, modified, isBreak, delayPeriod, isTimeout)
        else:
            return (False, modified, isBreak, delayPeriod, isTimeout)

    def performRequestRuleActions(self, koRules):
        """Perform all the rule actions on this request.

        koRules - is a list of koIHttpInspectorRule XPCOM objects
        Return value: tuple of (modified, isBreak, delayPeriod, isTimeout)

        """
        if not self.request:
            return (False, False, None, False)

        modified = False
        isBreak = False
        delayPeriod = None
        isTimeout = False

        for koRule in koRules:
            if not koRule.type & koHttpInspectorRule.TYPE_REQUEST:
                continue

            for action in koRule.getActions()[:]:  # Copy, in case modified
                # action is a koIHttpInspectorRuleAction XPCOM object
                matched, m, b, d, t = self._performSharedRuleAction(action, self.request_headers)
                if matched:
                    if m: modified = m
                    elif b: isBreak = b
                    elif d: delayPeriod = d
                    elif t: isTimeout = t
                elif action.type == koHttpInspectorRuleAction.ACTION_MODIFY_FIELD:
                    if action.flags == koHttpInspectorRuleAction.ACTION_FLAG_URL:
                        self.set_url(action.value1);
                        log.debug("performRequestRuleActions: Set URL: '%s'", action.value1)
                        modified = True
                    elif action.flags == koHttpInspectorRuleAction.ACTION_FLAG_DATA:
                        self.set_decoded_request_data(action.value1);
                        log.debug("performRequestRuleActions: Set data: '%s'", action.value1)
                        modified = True
                    elif action.flags == koHttpInspectorRuleAction.ACTION_FLAG_METHOD:
                        log.debug("performRequestRuleActions: Set method: '%s'", action.value1)
                        self.set_method(action.value1);
                        modified = True
        return (modified, isBreak, delayPeriod, isTimeout)

    def performResponseRuleActions(self, koRules):
        """Perform the rule actions on this response.

        koRules - is a list of koIHttpInspectorRule XPCOM objects
        Return value: tuple of (modified, isBreak, delayPeriod, isTimeout)

        """
        if not self.response:
            return (False, False, None, False)

        modified = False
        isBreak = False
        delayPeriod = None
        isTimeout = False

        for koRule in koRules:
            if not koRule.type & koHttpInspectorRule.TYPE_RESPONSE:
                continue

            for action in koRule.getActions()[:]:  # Copy, in case modified
                # action is a koIHttpInspectorRuleAction XPCOM object
                matched, m, b, d, t = self._performSharedRuleAction(action, self.response_headers)
                if matched:
                    if m: modified = m
                    elif b: isBreak = b
                    elif d: delayPeriod = d
                    elif t: isTimeout = t
                elif action.type == koHttpInspectorRuleAction.ACTION_MODIFY_FIELD:
                    if action.flags == koHttpInspectorRuleAction.ACTION_FLAG_STATUS:
                        self.set_status(action.value1);
                        log.debug("performResponseRuleActions: Set status: '%s'", action.value1)
                        modified = True
                    elif action.flags == koHttpInspectorRuleAction.ACTION_FLAG_DATA:
                        self.set_decoded_response_data(action.value1);
                        log.debug("performResponseRuleActions: Set data: '%s'", action.value1)
                        modified = True
        return (modified, isBreak, delayPeriod, isTimeout)

    def getText(self, itemName):
        # Shorten the name if it begins with "httpInspector_treecol_"
        if itemName[:22] == "httpInspector_treecol_":
            itemName = itemName[22:]
        getTextFunction = getattr(self, "getText_%s" % (itemName), None)
        if getTextFunction:
            return getTextFunction()
        log.warn("Unknown tree column name: %s", itemName)
        return "(Error: Unknown text field name)"

    def getText_creation_id(self):
        return str(self.creation_id)

    def getText_flags(self):
        return ""

    def getText_name(self):
        return ""

    def getText_time(self):
        if self.request:
            # Be smarter about time, only include the time if it's within the
            # last 24 hours of the system time.
            tdiff = time.time() - self.request_time
            tdelta = datetime.timedelta(seconds=tdiff)
            if tdelta.days <= 0:
                # Just return the 24hour time part
                return time.strftime("%H:%M:%S", time.localtime(self.request_time))
            elif tdelta.days < 365:
                # Just return the date and time part
                return time.strftime("%b %d %H:%M:%S", time.localtime(self.request_time))
            else:
                # Return the full deal, date, time and year
                return time.strftime("%b %d %H:%M:%S %Y", time.localtime(self.request_time))
        return ""

    def getText_request_ip(self):
        return self.client_address

    def getText_duration(self):
        if self.request and self.response:
            return "%0.3f" % (self.response_time - self.request_time)
        return ""

    def getText_size(self):
        if self.response_headers and self.response_headers.has_key("content-length"):
            return self.response_headers.get("content-length", "0")
        elif self.response:
            size = 0
            for part in self.response.response_parts:
                size += len(part)
            return str(size)
        return ""

    def getText_method(self):
        if self.request:
            return self.request.method
        return ""

    def getText_status(self):
        if self.response and self.response.response_status:
            try:
                status_code = self.response.response_status[RESPONSE_STATUS_FIELD]
                code = int(status_code)
            except ValueError:
                code = 0
            return "%s (%s)" % (status_code, self.response_codes.get(code, "unknown"))
        return ""

    def getText_content_type(self):
        if self.response_headers:
            return self.response_headers.get("content-type", "")
        return ""

    def getText_url(self):
        if self.request:
            return self.request.uri
        return ""

    # Note: Set value cannot be unicode, so ensure we convert to string
    def get_method(self):
        return self.getText_method()

    def set_method(self, value):
        self.request.method = str(value)

    def get_url(self):
        return self.getText_url()

    def set_url(self, value):
        self.request.uri = str(value)

    def get_status(self):
        if self.response and self.response.response_status:
            return self.response.response_status[RESPONSE_STATUS_FIELD]
        return ""

    def set_status(self, value):
        if self.response and self.response.response_status:
            self.response.response_status[RESPONSE_STATUS_FIELD] = str(value)

    def get_version(self):
        if self.response and self.response.response_status:
            version = self.response.response_status[RESPONSE_VERSION_FIELD]
            vsplit = version.split("HTTP/")
            return vsplit[-1]
        return ""

    def set_version(self, value):
        if self.response and self.response.response_status:
            self.response.response_status[RESPONSE_VERSION_FIELD] = "HTTP/" + str(value)

    def get_content_type(self):
        return self.getText_content_type()

    def get_request_data(self):
        return self.request.data

    def set_request_data(self, value):
        #if isinstance(value, unicode):
        #    # encode it then
        #    value = value.encode()
        self.request.data = value
        # Update the content length for post messages
        if self.request.method.upper() == 'POST':
            log.debug("set_request_data: Request is a POST method, setting 'content-length' header")
            self.request_headers["content-length"] = str(len(value))

    def get_response_data(self):
        return self.response.data

    def _updateResponseContentLength(self):
        if self.response_headers:
            self.response_headers["content-length"] = str(len(self.response.data))

    def set_response_data(self, value):
        #if isinstance(value, unicode):
        #    # encode it then
        #    value = value.encode()
        self.response.data = value
        self._updateResponseContentLength()

    def _unzipData(self, encoding, data):
        # Check gzip
        if encoding.lower() == "gzip":
            try:
                gzipStream = cStringIO.StringIO(data)
                gzipFile = gzip.GzipFile(fileobj=gzipStream)
                return gzipFile.read()
            except IOError:
                log.debug("Unable to decode gzip content")
                return ''
        return ''

    def _zipData(self, encoding, data):
        # Check gzip
        if encoding.lower() == "gzip":
            try:
                gzipStream = cStringIO.StringIO()
                gzipFile = gzip.GzipFile(mode = 'wb',  fileobj = gzipStream, compresslevel = 9)
                gzipFile.write(data)
                gzipFile.close()
                return gzipStream.getvalue()
            except IOError:
                log.debug("Unable to decode gzip content")
                return ''
        # Unknown encoding, don't do anything then
        return data

    # Uncompress the data and decode the string to be unicode
    # Returns a unicode string
    def _decode_data(self, obj, zip_encoding):
        if not obj or not obj.data:
            return ''
        data = obj.data
        # Check if it's compressed
        if zip_encoding:
            data = self._unzipData(zip_encoding, data)
        # Get unicode encoding service and use it to encode the string
        data, obj.encoding, bom = self._encodingSvc.getUnicodeEncodedString(data)
        return data

    def get_decoded_request_data(self):
        if not self.request or not self.request.data:
            return ''
        zip_encoding = self.request_headers.get("content-encoding")
        return self._decode_data(self.request, zip_encoding)

    def get_decoded_response_data(self):
        if not self.response or not self.response.data:
            return ''
        zip_encoding = self.response_headers.get("content-encoding")
        return self._decode_data(self.response, zip_encoding)

    # shared function for set_decoded_request_data and set_decoded_response_data
    def _encode_data(self, data, obj, zip_encoding):
        if not obj:
            return
        # encode the unicode string
        try:
            log.debug("_encode_data: encoding: %r", obj.encoding)
            data = data.encode(obj.encoding)
        except AttributeError:
            log.debug("_encode_data: no existing encoding, working it out")
            data, obj.encoding, bom = self._encodingSvc.getUnicodeEncodedString(data)
            log.debug("_encode_data: encoding found: %r", obj.encoding)
            data = data.encode(obj.encoding)
        # Check if it needs to be compressed
        if zip_encoding:
            return self._zipData(zip_encoding, data)
        else:
            return data

    def set_decoded_request_data(self, data):
        if self.request:
            zip_encoding = self.request_headers.get("content-encoding")
            data = self._encode_data(data, self.request, zip_encoding)
            # Use set_request_data, as it will reset the content-length
            self.set_request_data(data)

    def set_decoded_response_data(self, data):
        if self.response:
            zip_encoding = self.response_headers.get("content-encoding")
            data = self._encode_data(data, self.response, zip_encoding)
            # Use set_response_data, as it will reset the content-length
            self.set_response_data(data)


    def getRequestHeaderNames(self):
        if self.request_headers:
            return self.request_headers.keys()
        return []

    def getRequestHeaderValues(self):
        if self.request_headers:
            return self.request_headers.values()
        return []

    def getResponseHeaderNames(self):
        if self.response_headers:
            return self.response_headers.keys()
        return []

    def getResponseHeaderValues(self):
        if self.response_headers:
            return self.response_headers.values()
        return []

    # Saving header modifications
    def _saveHeadersForRow(self, headerNames, headerValues, type="requestHeaders"):
        # Check input
        if headerNames is None or headerValues is None:
            return
        if len(headerNames) != len(headerValues):
            log.warn("_saveHeadersForRow: num of header names: %d, does not match num of values: %d", len(headerNames), len(headerValues))
            return
        # Update the headers
        headers = {}
        for i in range(len(headerNames)):
            # str() ensures values arn't unicode
            headers[ str(headerNames[i]) ] = str(headerValues[i])
        if type == "requestHeaders":
            self.request_headers = headers
        else:
            self.response_headers = headers

    def saveRequestHeaders(self, headerNames, headerValues):
        self._saveHeadersForRow(headerNames, headerValues, type="requestHeaders")

    def saveResponseHeaders(self, headerNames, headerValues):
        self._saveHeadersForRow(headerNames, headerValues, type="responseHeaders")


################################################################
#    HTTP Inspector - http session (requests and responses)    #
################################################################

class koProxySession:
    def __init__(self, koProxyInst):
        self.koProxyInst = koProxyInst
        if koProxyInst:
            self.addr = koProxyInst.transport.client
        else:
            self.addr = ('', 0)
        # Addr is a tuple (ip, port)
        self.proxyPairs = []
        #self.proxyPairMap = {}

    # Add a koIHttpInspectorReqRespPair object to the list of proxyPairs
    def addPair(self, pair):
        #self.proxyPairMap[pair.request] = pair
        self.proxyPairs.append(pair)


################################################################
#          HTTP Inspector XPCOM service - main object          #
################################################################

class koHttpInspector:
    """An xpcom service for debugging http requests and their responses."""

    _com_interfaces_ = [components.interfaces.koIHttpInspector,
                        components.interfaces.nsIObserver]
    _reg_clsid_ = "{b70451db-d5b4-4a9f-a70a-c9c971d2bcf4}"
    _reg_contractid_ = "@activestate.com/koHttpInspector;1"
    _reg_desc_ = "HTTP Inspector"

    def __init__(self):
        self._globalPrefs = components.classes["@activestate.com/koPrefService;1"].\
            getService(components.interfaces.koIPrefService).prefs

        # Get some (all) of these settings from prefs
        self.enabledAtStartup = self._globalPrefs.getBooleanPref('httpInspector_enabledAtStartup')
        # lastError is used for showing/alerting the user why something did not work
        self.lastError = ""
        self.isRunning = False
        self.isListening = False
        self.port = self._globalPrefs.getLongPref('httpInspector_listenPort')
        if self.port <= 0:
            # default to 8080
            self.port = 8080
        self.acceptLocalConnectionsOnly = self._globalPrefs.getBooleanPref('httpInspector_acceptLocalConnectionsOnly')
        # we may need to proxy the requests to yet another proxy
        self.proxyForwardingEnabled = False
        self.proxy_to_host = ""
        self.proxy_to_port = 0
        self._set_proxyForwardingFromPrefs()
        self._set_proxyBreakFromPrefs()

        self.breakOnIncomingRequest = self._globalPrefs.getBooleanPref('httpInspector_breakOnRequest')
        self.breakOnOutgoingResponse = self._globalPrefs.getBooleanPref('httpInspector_breakOnResponse')

        # Proxy sessions (requests and responses)
        self.sessions = []
        # Current session is used to keep track of the latest connection received
        self._currentSession = None
        # Ruleset is used for setting rules on when to break/timeout/modify
        # the request and response messages.
        self._ruleset = []
        self._loadRuleset()

        # continueRunningEvent used by UI to notify the proxy to continue.
        # Main reason for this is when UI breaks on request/response to allow
        # the user to modify the data before submitting.
        self._continueRunningCondition = threading.Condition()
        self._proxyThread = None
        # The UI window that wants to be notified when a break occurs
        # Also sends notifications that the treeview should be rebuilt
        self._windowObserver = None
        # Lock for managing the sending of updates to the UI
        self._uiNotifyLock = threading.Lock()

        # Listen for pref changes
        prefObserverService = self._globalPrefs.prefObserverService
        self._prefTopics = [
            'httpInspector_enabledAtStartup',
            'httpInspector_listenPort',
            'httpInspector_acceptLocalConnectionsOnly',
            'httpInspector_breakOnRequest',
            'httpInspector_breakOnResponse',
            'httpInspector_proxyForwardingEnabled',
            'httpInspector_proxyForwardingAddress',
        ]
        prefObserverService.addObserverForTopics(self, self._prefTopics, False)
        obsSvc = components.classes["@mozilla.org/observer-service;1"].\
                       getService(components.interfaces.nsIObserverService)
        obsSvc.addObserver(self, 'xpcom-shutdown', False)

        # Kick off our proxy thread
        if self.enabledAtStartup:
            self.startListener()

    def observe(self, topic, subject, data):
        #print "Pref observe."
        #print "  Topic:", topic
        #print "  Subject:", subject
        #print "  Data:", data
        #print
        if subject == "xpcom-shutdown":
            self.stopProxyService()

        elif subject == 'httpInspector_enabledAtStartup':
            enabled = self._globalPrefs.getBooleanPref('httpInspector_enabledAtStartup')
            if self.isListening != enabled:
                # Value changed, start or stop the listener
                if not enabled:
                    self.stopListener()
                else:
                    self.startListener()
        elif subject == 'httpInspector_listenPort':
            newListenPort = self._globalPrefs.getLongPref('httpInspector_listenPort')
            if newListenPort <= 0:
                newListenPort = 8080
            if newListenPort != self.port:
                if self.isListening:
                    # It's running, restart the service
                    self.stopListener()
                    self.port = newListenPort
                    self.startListener()
                else:
                    self.port = newListenPort
        elif subject == 'httpInspector_acceptLocalConnectionsOnly':
            acceptLocal = self._globalPrefs.getBooleanPref('httpInspector_acceptLocalConnectionsOnly')
            if self.acceptLocalConnectionsOnly != acceptLocal:
                self.acceptLocalConnectionsOnly = acceptLocal
                if self.isListening:
                    # It's running, restart the service
                    self.stopListener()
                    self.startListener()
        elif subject == 'httpInspector_proxyForwardingEnabled' or \
             subject == 'httpInspector_proxyForwardingAddress':
            self._set_proxyForwardingFromPrefs()
        elif subject == 'httpInspector_breakOnRequest' or \
             subject == 'httpInspector_breakOnResponse':
            self._set_proxyBreakFromPrefs()

    def _set_proxyForwardingFromPrefs(self):
        self.proxyForwardingEnabled = self._globalPrefs.getBooleanPref('httpInspector_proxyForwardingEnabled')
        forwardedToAddress = self._globalPrefs.getStringPref('httpInspector_proxyForwardingAddress')
        if forwardedToAddress:
            try:
                sp = forwardedToAddress.rsplit(":", 1)
                if len(sp) == 1:
                    p_host, p_port = (sp[0], "8080")
                else:
                    p_host, p_port = sp
                self.proxy_to_host = p_host
                self.proxy_to_port = int(p_port)
                if self.proxy_to_port <= 0:
                    self.proxy_to_port = 8080
            except ValueError:
                log.error("'Proxy Forwarding Address' preference is invalid: '%s'", forwardedToAddress)
                log.warn("Proxy forwarding has been turning off")
                self.proxyForwardingEnabled = False

    def _set_proxyBreakFromPrefs(self):
        self.breakOnIncomingRequest = self._globalPrefs.getBooleanPref('httpInspector_breakOnRequest')
        self.breakOnOutgoingResponse = self._globalPrefs.getBooleanPref('httpInspector_breakOnResponse')

    def pref_observer(self, topic, subject, data):
        pass

    def startProxyService(self):
        import koTwistedProxy
        # Stop the proxy thread
        if self.isRunning:
            self.stopProxyService()
        # Make a thread to run the proxy in
        # koTwistedProxy.startProxyReactor will set readyEvent when it's ok to continue
        readyEvent = threading.Event()
        self._proxyThread = threading.Thread( target=koTwistedProxy.startProxyReactor,
                                              name="Http Inspector",
                                              args=(self, readyEvent) )
        self._proxyThread.setDaemon(1)
        self._proxyThread.start()
        readyEvent.wait(10)
        if not readyEvent.isSet():
            log.info("HTTP Inspector could not start")
        else:
            self.isRunning = True
            log.info("HTTP Inspector has started")

    def stopProxyService(self):
        # Stop the proxy thread
        if self.isRunning and self._proxyThread:
            import koTwistedProxy
            koTwistedProxy.stopProxyReactor()
            self._proxyThread = None
            log.info("HTTP Inspector has stopped")
        self.isRunning = False

    def startListener(self):
        if not self.isRunning:
            self.startProxyService()
        errorMessage = ""
        if self.isRunning:
            import koTwistedProxy
            errorMessage = koTwistedProxy.startListener(self.port, self.acceptLocalConnectionsOnly)
            # isListening is set by the koProxy during startListener() call
            if self.isListening:
                log.info("HTTP Inspector now listening on port: %d", self.port)
            else:
                log.warning(self.lastError)
        return self.isListening, errorMessage

    def stopListener(self):
        # Stop the proxy thread
        if self.isRunning:
            import koTwistedProxy
            koTwistedProxy.stopListener(self.port)
            log.info("HTTP Inspector finished listening on port: %d", self.port)

    # XXX - Later to add WeakReference support
    def addUIObserver(self, observer):
        log.debug("addUIObserver")
        #log.debug("addUIObserver: %r", observer)
        #self._windowObserver = WeakReference(observer)
        class UIObserverProxy:
            def __init__(self, obj):
                self.obj = obj
            @components.ProxyToMainThreadAsync
            def notifyRowsChanged(self, *args):
                return self.obj.notifyRowsChanged(*args)
            @components.ProxyToMainThreadAsync
            def notifyProxyPairHasChanged(self, *args):
                return self.obj.notifyProxyPairHasChanged(*args)
            @components.ProxyToMainThreadAsync
            def notifyBreakRequest(self, *args):
                return self.obj.notifyBreakRequest(*args)
            @components.ProxyToMainThreadAsync
            def notifyBreakResponse(self, *args):
                return self.obj.notifyBreakResponse(*args)
        self._windowObserver = UIObserverProxy(observer)
    def removeUIObserver(self):
        log.debug("removeUIObserver")
        self._windowObserver = None
    def _getUIObserver(self):
        return self._windowObserver
        #if self._windowObserver:
        #    # Ensure the reference still holds
        #    observer = self._windowObserver()
        #    if not observer:
        #        self.removeUIObserver()
        #    else:
        #        return observer
        #return None
    # Sent from the UI
    def notifyUIModificationFinished(self):
        log.debug("notifyUIModificationFinished")
        self._continueRunningCondition.acquire()
        try:
            # Notify the thread can continue now
            self._continueRunningCondition.notify()
            log.debug("notifyUIModificationFinished: event notification done")
        finally:
            self._continueRunningCondition.release()
        #self.notifyProxyHasChanged()

    def clear(self):
        """Clears the proxy cache"""
        log.debug("clear")
        self.sessions = []
        self._uiNotifyLock.acquire()
        try:
            self._notifyRowsChanged()
        finally:
            self._uiNotifyLock.release()

    def getCacheSize(self):
        """Returns the size of the proxy cache"""
        return 0

    def getRuleset(self):
        """Returns the breaks/timeout/modify rules"""
        return self._ruleset

    def _loadRuleset(self):
        self._ruleset = []
        rules = self._globalPrefs.getPref("httpInspector_ruleset")
        for i in range(rules.length):
            rule = rules.getPref(i).QueryInterface(components.interfaces.koIPreferenceSet)
            koRule = components.classes["@activestate.com/koHttpInspectorRule;1"].\
                        createInstance(components.interfaces.koIHttpInspectorRule)
            if koRule.loadFromPreference(rule):
                self._ruleset.append(koRule)

    def _saveRuleset(self):
        rulesetPref = components.classes[
                    '@activestate.com/koOrderedPreference;1'].createInstance()
        rulesetPref.id = "httpInspector_ruleset"
        # Add the rules
        for rule in self._ruleset:
            rulesetPref.appendPref(rule.convertToPreference())
        # Save the pref
        self._globalPrefs.setPref("httpInspector_ruleset", rulesetPref)

    def setRuleset(self, ruleset):
        """Sets the breaks/timeout/modify rules"""
        self._ruleset = ruleset
        self._saveRuleset()

    # Non xpcom components

    # Already has a acquired the _uiNotifyLock
    def _notifyRowsChanged(self):
        log.debug("notifyRowsChanged")
        uiObserver = self._getUIObserver()
        if uiObserver:
            try:
                uiObserver.notifyRowsChanged()
                log.debug("notifyRowsChanged: sent proxyChangedNotification")
            except Exception, e:
                log.warn("notifyRowsChanged: Proxy observer raised an exception")
                log.exception(e)
        log.debug("notifyRowsChanged: done")

    # Return (UnwrapObject(koProxySession)) for the given koProxy connection
    def _findSessionForKoProxy(self, koProxyInst):
        if self._currentSession is not None and \
           self._currentSession.koProxyInst == koProxyInst:
            return self._currentSession
        sessions = self.sessions[:]
        for i in range(len(sessions) - 1, -1, -1):
            kps = sessions[i]
            if kps.koProxyInst == koProxyInst:
                return kps
        # Could not find a match in all known sessions
        return None

    # Return (koProxySession, koProxyPair, UnwrapObject(koProxyPair)) for the
    # given request
    # Note: Multiple requests can occur before any response is received.
    def _findSessionAndProxyPairForRequest(self, request):
        kps = kpp = kppUnwrapped = None
        sessions = self.sessions[:]
        for i in range(len(sessions) - 1, -1, -1):
            kps = sessions[i]
            for kpp in kps.proxyPairs:
                kppUnwrapped = UnwrapObject(kpp)
                if kppUnwrapped.request == request:
                    return kps, kpp, kppUnwrapped
        # Could not find a match in all known sessions
        return None, None, None

    def handleClientConnectionMade(self, koproxy):
        try:
            log.debug("handleClientConnectionMade: %s", koproxy.transport.client)
            kps = koProxySession(koproxy)
            self._currentSession = kps
            self.sessions.append(kps)
        except Exception, e:
            log.exception(e)

    # Go through list of rules and perform any actions, returned matched rule
    def getMatchingRequestRules(self, reqRespUnwrapped):
        matchedRules = []
        for koRule in self._ruleset[:]:   # Copy, in case it's modified by UI
            if koRule.enabled and reqRespUnwrapped.ruleMatchesRequest(koRule):
                #print "Rule matched request: '%s'" % (koRule.name)
                log.debug("getMatchingRequestRules: Rule '%s' matched", koRule.name)
                matchedRules.append(koRule)
        return matchedRules

    # Go through list of rules and perform any actions, returned matched rule
    def getMatchingResponseRules(self, reqRespUnwrapped):
        matchedRules = []
        for koRule in self._ruleset[:]:   # Copy, in case it's modified by UI
            if koRule.enabled and reqRespUnwrapped.ruleMatchesResponse(koRule):
                #print "Rule matched response: '%s'" % (koRule.name)
                log.debug("getMatchingResponseRules: Rule '%s' matched", koRule.name)
                matchedRules.append(koRule)
        return matchedRules

    # handle an incoming request (i.e. coming from the browser)
    #
    # @param koProxyReq
    # @param headers
    # @return (delayPeriod, forcedResponseStatus)
    def handleClientRequest(self, koProxyReq, headers):
        try:
            timeSinceEpoch = time.time()
            log.debug("handleClientRequest: %s %s", koProxyReq.method, koProxyReq.uri)
            #for name in dir(koProxyReq):
            #    attr = getattr(koProxyReq, name)
            #    print name
            #    print type(attr)
            #    print attr
            #    print
            # koProxyReq.channel is a koProxy object
            kps = self._findSessionForKoProxy(koProxyReq.channel)
            if kps is None:
                log.debug("handleClientRequest: Could not find matching session for connection")
                return None, None
            kpp = components.classes["@activestate.com/koHttpInspectorReqRespPair;1"].\
                                        createInstance(components.interfaces.koIHttpInspectorReqRespPair);
            kppUnwrapped = UnwrapObject(kpp)
            kppUnwrapped.client_address = kps.addr[0]
            kppUnwrapped.client_port = kps.addr[1]
            kppUnwrapped.request = koProxyReq
            kppUnwrapped.request_time = timeSinceEpoch
            kppUnwrapped.request_headers = CaselessDict(headers)

            # Now see if any rules match this request
            koRules = self.getMatchingRequestRules(kppUnwrapped)
            modified = False
            isBreak = False
            delayPeriod = None
            isTimeout = False
            if koRules:
                modified, isBreak, delayPeriod, isTimeout = kppUnwrapped.performRequestRuleActions(koRules)
            #print "modified: %r, isBreak: %r, delayPeriod: %r, isTimeout: %r" % (modified, isBreak, delayPeriod, isTimeout)
            if isTimeout:
                delayPeriod = -1    # Special meaning for a timeout
            if self.breakOnIncomingRequest:
                isBreak = True

            kps.addPair(kpp)

            uiObserver = self._getUIObserver()
            if uiObserver:
                self._uiNotifyLock.acquire()
                try:
                    if isBreak:
                        log.debug("handleClientRequest: breakOnIncomingRequest is set")
                        kppUnwrapped.flags |= components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_REQUEST
                    self._notifyRowsChanged()
                    if isBreak:
                        # We must wait for the UI to modify the request
                        try:
                            uiObserver.notifyBreakRequest(kpp)
                        except Exception, e:
                            log.warn("handleClientRequest: Proxy observer raised an exception")
                            log.exception(e)
                            return None, None
                        self._continueRunningCondition.acquire()
                        try:
                            self._continueRunningCondition.wait()
                            modified = True
                        finally:
                            self._continueRunningCondition.release()
                            if kppUnwrapped.flags & components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_REQUEST:
                                kppUnwrapped.flags ^= components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_REQUEST
                        log.debug("handleClientRequest: continuing now")
                    else:
                        log.debug("handleClientRequest: breakOnIncomingRequest is not set")
                finally:
                    self._uiNotifyLock.release()
            log.debug("handleClientRequest: done")
            # XXX - This modified flag is ugly
            if modified:
                headers.clear()
                headers.update(kppUnwrapped.request_headers)
            return delayPeriod, kppUnwrapped.forcedResponseStatus
        except Exception, e:
            log.exception(e)
        return None, None

    #def _getRowCountForReqResp(self, kpp):
    #    rowCount = 0
    #    for session in self.sessions:
    #        for reqRespPair in session.proxyPairs:
    #            if kpp.creation_id == reqRespPair.creation_id:
    #                return rowCount
    #            rowCount += 1
    #    # Could not find the row
    #    return -1

    # handle a response (i.e. coming from the server)
    def handleServerResponse(self, koProxyResp):
        try:
            timeSinceEpoch = time.time()
            #print "koProxyResp.response_status:", koProxyResp.response_status
            log.debug("handleServerResponse: v:%s s:%s m:%s", *koProxyResp.response_status)
            log.debug("handleServerResponse: uri:%s", koProxyResp.father.uri)
            # Find the koProxySession that contains the request for this response
            # Note: Multiple requests can occur before any response is received.
            (kps, kpp, kppUnwrapped) = self._findSessionAndProxyPairForRequest(koProxyResp.father)
            if kps is None or kpp is None:
                log.debug("handleServerResponse: Could not find matching request for response")
                return None
            kppUnwrapped.response = koProxyResp
            kppUnwrapped.response_time = timeSinceEpoch
            kppUnwrapped.response_headers = koProxyResp.response_headers
            #print "response_data"
            #print kppUnwrapped.response_data

            # Now see if any rules match this request
            koRules = self.getMatchingResponseRules(kppUnwrapped)
            modified = False
            isBreak = False
            delayPeriod = None
            isTimeout = False
            if koRules:
                modified, isBreak, delayPeriod, isTimeout = kppUnwrapped.performResponseRuleActions(koRules)
            #print "modified: %r, isBreak: %r, delayPeriod: %r, isTimeout: %r" % (modified, isBreak, delayPeriod, isTimeout)
            if isTimeout:
                delayPeriod = -1    # Special meaning for a timeout
            if self.breakOnOutgoingResponse:
                isBreak = True

            uiObserver = self._getUIObserver()
            if uiObserver:
                self._uiNotifyLock.acquire()
                try:
                    if isBreak:
                        kppUnwrapped.flags |= components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_RESPONSE
                    try:
                        log.debug("handleServerResponse: notifyProxyPairHasChanged")
                        uiObserver.notifyProxyPairHasChanged(kpp)
                    except Exception, e:
                        log.warn("handleServerResponse: Proxy observer raised an exception")
                        log.exception(e)
                        return None
                    if isBreak:
                        log.debug("handleServerResponse: breakOnOutgoingResponse is set")
                        # We must wait for the UI to modify the request
                        try:
                            log.debug("handleServerResponse: notifyBreakResponse")
                            uiObserver.notifyBreakResponse(kpp)
                        except Exception, e:
                            log.warn("handleServerResponse: Proxy observer raised an exception")
                            log.exception(e)
                            return None
                        log.debug("handleServerResponse: Acquiring _continueRunningCondition lock")
                        self._continueRunningCondition.acquire()
                        try:
                            self._continueRunningCondition.wait()
                        finally:
                            self._continueRunningCondition.release()
                            if kppUnwrapped.flags & components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_RESPONSE:
                                kppUnwrapped.flags ^= components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_RESPONSE
                        log.debug("handleServerResponse: continuing now")
                finally:
                    self._uiNotifyLock.release()
            log.debug("handleServerResponse: done")
            #print "delayPeriod:", delayPeriod
            return delayPeriod
        except Exception, e:
            log.exception(e)
        return None

    def handleClientConnectionLost(self, koProxyInst):
        try:
            log.debug("handleClientConnectionLost:")
            # Find the koProxySession that contains the request for this response
            # Note: Multiple requests can occur before any response is received.
            kps = self._findSessionForKoProxy(koProxyInst)
            if kps is None:
                log.debug("handleClientConnectionLost: Could not find matching session for connection")
                return
            if len(kps.proxyPairs) == 0:
                # Nothing happened on connection, no use keeping it around
                self.sessions.remove(kps)
            log.debug("handleClientConnectionLost: done")
        except Exception, e:
            log.exception(e)


################################################################
#           Tree view for the HTTP Inspector window            #
################################################################

# Note: This uses the UI thread, the proxy has it's own thread.
class koHttpInspectorTreeView(TreeView):
    _com_interfaces_ = [ components.interfaces.koIHttpInspectorTreeView,
                         components.interfaces.nsITreeView ]
    _reg_clsid_ = "{4cf96eb2-c124-4eab-8351-592157ed8a1d}"
    _reg_contractid_ = "@activestate.com/koHttpInspectorTreeView;1"
    _reg_desc_ = "Komodo HTTP Inspector Tree View"
        
    def __init__(self, debug=None):
        TreeView.__init__(self, debug=0)
        self._rows = []
        self._filterString = ''
        self._sortedBy = None
        self._sortDir = 0
        #self.log = log

        self._tree = None
        self._dataLock = threading.RLock()

        # XPCOM Services
        # global prefs
        self._prefsSvc = components.classes["@activestate.com/koPrefService;1"].\
                         getService(components.interfaces.koIPrefService).prefs
        self._atomService = components.classes["@mozilla.org/atom-service;1"].\
                                getService(components.interfaces.nsIAtomService)
        self._koProxyDebuggerSvc = components.classes["@activestate.com/koHttpInspector;1"].\
                                    getService(components.interfaces.koIHttpInspector);
        self._koProxyDebugger = UnwrapObject(self._koProxyDebuggerSvc)
        self.rebuild()

    def proxyChangedNotification(self):
        #print "Got proxy changed notification "
        self.rebuild()

    def get_rowCount( self ):
        # Result: int32
        #if self.log:
        #    self.log.debug("get_rowCount(): %d", len(self._rows))
        return len(self._rows)

    def invalidateRow( self, row ):
        log.debug("invalidateRow: %d", row)
        self._tree.invalidateRow(row)

    def ensureRowIsVisible( self, row ):
        self._tree.ensureRowIsVisible(row)

    def rebuild(self):
        # Rebuild the tree
        log.debug("rebuild: Rebuilding the tree")
        self._dataLock.acquire()
        try:
            self._rows = []
            for session in self._koProxyDebugger.sessions[:]:
                for reqRespPair in session.proxyPairs[:]:
                    self._rows.append(reqRespPair)
            #log.debug("rebuild: num of rows now: %d", len(self._rows))
        finally:
            self._dataLock.release()

        log.debug("rebuild: Rebuilt the rows, now invalidating")
        if self._tree:
            self._tree.beginUpdateBatch()
            self._tree.invalidate()
            self._tree.endUpdateBatch()
        log.debug("rebuild: Done")

    def getRowForReqRespPair(self, koReqResp):
        self._dataLock.acquire()
        try:
            log.debug("getRowForReqRespPair: num rows is: %d", len(self._rows))
            #log.debug("getRowForReqRespPair: koReqResp.creation_id: %s", koReqResp.creation_id)
            for i in range(len(self._rows) -1, -1, -1):
                #log.debug("getRowForReqRespPair: row[%d].creation_id:%s", i, self._rows[i].creation_id)
                if self._rows[i].creation_id == koReqResp.creation_id:
                    return i
        finally:
            self._dataLock.release()
        log.debug("getRowForReqRespPair: not found")
        return -1

    def getReqRespPairForRow(self, row):
        self._dataLock.acquire()
        try:
            log.debug("getReqRespPairForRow: row is: %d, num rows is: %d", row, len(self._rows))
            if row >=0 and row < len(self._rows):
                return self._rows[row]
        finally:
            self._dataLock.release()
        log.debug("getReqRespPairForRow: not found")
        return None

    def restorePrefs(self):
        if self._prefsSvc.hasStringPref("http_proxy_debugger_enabled"):
            pass
        if self._prefsSvc.hasStringPref("http_proxy_debugger_proxy_to_host"):
            pass

    def savePrefs(self):
        prefSvc.setStringPref("http_proxy_debugger_enabled", "true")

    def refresh(self):
        """ Unused """
        pass

    def sortBy(self, key, direction):
        self._dataLock.acquire()
        try:
            name = key.lower()
        finally:
            self._dataLock.release()
        #if self._tree and changed:
        #    self._tree.beginUpdateBatch()
        #    self._tree.invalidate()
        #    self._tree.endUpdateBatch()

    def setFilter(self, filterString):
        self._filterString = filterString
        self._dataLock.acquire()
        try:
            pass
        finally:
            self._dataLock.release()
        if self._tree:
            self._tree.beginUpdateBatch()
            self._tree.invalidate()
            self._tree.endUpdateBatch()
            self._tree.view.selection.select(self._tree.view.selection.currentIndex)


    def getRowProperties( self, index, properties=None):
        pass

    def getCellText(self, row, column):
        col = column.id
        if col not in proxyDebuggerTreeColumnNames:
            return "(Error: Unknown column)"
        # Result: wstring
        # In: param0: int32
        # In: param1: wstring
        if self.log:
            self.log.debug("getCellText(row=%s, col=%s)", row, col)
        self._dataLock.acquire()
        try:
            return self._rows[row].getText(col)
        finally:
            self._dataLock.release()

    def _buildCellProperties(self, flags):
        prop = []
        if flags & components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_REQUEST:
            prop.append("breakOnRequest")
        if flags & components.interfaces.koIHttpInspectorReqRespPair.FLAGS_BREAK_RESPONSE:
            prop.append("breakOnResponse")
        return prop

    def getCellProperties(self, row, column, properties=None):
        # here we build a list of properties that are used to get the icon
        # for the tree item, text style, etc.  *If getImageSrc returns
        # a url to an icon, the icon matched by properties here will be
        # ignored.  That is convenient since it allows custom icons to work*
        # XXX fixme, optimize
        self._dataLock.acquire()
        try:
            if column.id != 'httpInspector_treecol_flags' or row >= len(self._rows):
                return
            #print "row %d %s : %r"% (row, column.id, self._rows[row]['properties'])
            cellprops = self._buildCellProperties(self._rows[row].flags)
            # Mozilla 22+ does not have a properties argument.
            if properties is None:
                return " ".join(cellprops)
            else:
                for p in cellprops:
                    properties.AppendElement(self._atomService.getAtom(p))
        finally:
            self._dataLock.release()

    # in nsITreeColumn col, in nsISupportsArray properties
    def getColumnProperties(self, 
                            column,
                            properties=None):
        # Result: void - None
        # In: param0: wstring
        # In: param1: nsIDOMElement
        # In: param2: nsISupportsArray
        return
        if self.log:
            self.log.debug("getColumnProperties(column=%s, props=%r)",
                           column, properties)

    def isSorted( self ):
        # Result: boolean
        return 1

    def getImageSrc(self, row, column):
        # see comment in getCellProperties regarding images
        #if row >= len(self._rows): return ""
        #if column.id.lower() == "name":
        #    node = self._rows[row]['node']
        #    if node._attributes.has_key('icon'):
        #        #print "getImageSrc row %d [%s]"%(row,node._attributes['icon'])
        #        return node._attributes['icon']
        return ""


################################################################
#         Rules for filtering and predefined actions           #
################################################################

class koHttpInspectorRuleRequirement:
    _com_interfaces_ = [components.interfaces.koIHttpInspectorRuleRequirement]
    _reg_clsid_ = "{c6155626-33d8-4425-9f79-deae2a37c116}"
    _reg_contractid_ = "@activestate.com/koHttpInspectorRuleRequirement;1"
    _reg_desc_ = "Komodo HTTP Inspector Rule Requirement"

    # Shortcuts to the interface values
    RULE_ON_FLAGS                = components.interfaces.koIHttpInspectorRuleRequirement.RULE_ON_FLAGS
    RULE_ON_METHOD               = components.interfaces.koIHttpInspectorRuleRequirement.RULE_ON_METHOD
    RULE_ON_URL                  = components.interfaces.koIHttpInspectorRuleRequirement.RULE_ON_URL
    RULE_ON_CLIENT_IP_ADDRESS    = components.interfaces.koIHttpInspectorRuleRequirement.RULE_ON_CLIENT_IP_ADDRESS
    RULE_ON_STATUS               = components.interfaces.koIHttpInspectorRuleRequirement.RULE_ON_STATUS
    RULE_ON_VERSION              = components.interfaces.koIHttpInspectorRuleRequirement.RULE_ON_VERSION
    RULE_ON_DATA                 = components.interfaces.koIHttpInspectorRuleRequirement.RULE_ON_DATA
    RULE_ON_HEADER               = components.interfaces.koIHttpInspectorRuleRequirement.RULE_ON_HEADER
    MATCH_USING_STRING           = components.interfaces.koIHttpInspectorRuleRequirement.MATCH_USING_STRING
    MATCH_USING_REGEX            = components.interfaces.koIHttpInspectorRuleRequirement.MATCH_USING_REGEX

    _type_to_text = [
        "(Unset)",
        "Flags",
        "Method",
        "URL",
        "Client IP Address",
        "Status",
        "Version",
        "Data",
        "Header",
    ]

    def __init__(self):
        # type - koIHttpInspectorRuleRequirement.RULE_ON_*
        self.type = 0
        # match_type - koIHttpInspectorRuleRequirement.MATCH_USING_*
        self.match_type = 0
        self.field = ""
        self.value = ""

    def getRequirementText(self):
        """Return text describing what this rule matches on"""

        if self.type == components.interfaces.koIHttpInspectorRuleRequirement.RULE_ON_HEADER:
            return "Require '%s' matches '%s'" % (self._type_to_text[self.type],
                                                  self.value)
        else:
            return "Require '%s' '%s' matches '%s'" % (self._type_to_text[self.type],
                                                       self.field,
                                                       self.value)

    def matches(self, val):
        """Check if the requirement matches the given value"""

        #print "matches: '%s' to '%s'" % (self.value, val)
        if self.match_type == self.MATCH_USING_REGEX:
            try:
                r = re.compile(self.value)
                if r.match(val):
                    return True
            except re.error:
                log.warn("Rule requirement: Invalid RE expression: '%s'", self.value)
        else:
            # String match (case insensitive)
            # XXX - Should be saved case insensitive, so we don't have to keep
            #       doing lower() calls for the self.value part!
            return val.lower().find(self.value.lower()) >= 0
        return False

    def copy(self, requirement):
        """Copy the requirement"""

        self.type = requirement.type
        self.match_type = requirement.match_type
        self.field = requirement.field
        self.value = requirement.value

    def loadFromPreference(self, pref):
        try:
            self.type = pref.getLongPref("type")
            self.match_type = pref.getLongPref("match_type")
            self.field = pref.getStringPref("field")
            self.value = pref.getStringPref("value")
        except COMException:
            # Pref did not exist
            return False
        return True

    def convertToPreference(self):
        pref = components.classes[
                    '@activestate.com/koPreferenceSet;1'].createInstance()
        pref.setLongPref("type", self.type)
        pref.setLongPref("match_type", self.match_type)
        pref.setStringPref("field", self.field)
        pref.setStringPref("value", self.value)
        return pref

    def __str__(self):
        s = ["type: %r" % self.type]
        s += ["match_type: %r" % self.match_type]
        s += ["field: %r" % self.field]
        s += ["value: %r" % self.value]
        return "  koRuleRequirement:\n    " + "\n    ".join(s)

class koHttpInspectorRuleAction:
    _com_interfaces_ = [components.interfaces.koIHttpInspectorRuleAction]
    _reg_clsid_ = "{5022d744-d68d-43dc-8069-ebc1ca6b8506}"
    _reg_contractid_ = "@activestate.com/koHttpInspectorRuleAction;1"
    _reg_desc_ = "Komodo HTTP Inspector Rule Action"

    # Shortcuts to the interface values
    ACTION_BREAK         = components.interfaces.koIHttpInspectorRuleAction.ACTION_BREAK
    ACTION_DELAY         = components.interfaces.koIHttpInspectorRuleAction.ACTION_DELAY
    ACTION_TIMEOUT       = components.interfaces.koIHttpInspectorRuleAction.ACTION_TIMEOUT
    ACTION_MODIFY_FIELD  = components.interfaces.koIHttpInspectorRuleAction.ACTION_MODIFY_FIELD
    ACTION_SET_HEADER    = components.interfaces.koIHttpInspectorRuleAction.ACTION_SET_HEADER
    ACTION_REMOVE_HEADER = components.interfaces.koIHttpInspectorRuleAction.ACTION_REMOVE_HEADER

    ACTION_FLAG_LITERAL   = components.interfaces.koIHttpInspectorRuleAction.ACTION_FLAG_LITERAL
    ACTION_FLAG_RANDOM    = components.interfaces.koIHttpInspectorRuleAction.ACTION_FLAG_RANDOM
    ACTION_FLAG_METHOD    = components.interfaces.koIHttpInspectorRuleAction.ACTION_FLAG_METHOD
    ACTION_FLAG_URL       = components.interfaces.koIHttpInspectorRuleAction.ACTION_FLAG_URL
    ACTION_FLAG_CLIENT_IP = components.interfaces.koIHttpInspectorRuleAction.ACTION_FLAG_CLIENT_IP
    ACTION_FLAG_STATUS    = components.interfaces.koIHttpInspectorRuleAction.ACTION_FLAG_STATUS
    ACTION_FLAG_DATA      = components.interfaces.koIHttpInspectorRuleAction.ACTION_FLAG_DATA

    _type_to_text = [
        "(Unset)",
        "Break",
        "Delay",
        "Timeout",
        "Modify field",
        "Set Header",
        "Remove Header",
    ]

    _flag_modify_field_to_text = [
        "(Unset)",
        "(Unset)",
        "(Unset)",
        "(Unset)",
        "Method",
        "URL",
        "Client IP",
        "Status",
        "Data",
    ]

    def __init__(self):
        # type - koIHttpInspectorRuleAction.ACTION_XXX
        self.type = 0
        self.flags = 0
        self.value1 = ""
        self.value2= ""

    def getActionText(self):
        """Return text describing what this rule does"""

        if self.type in (components.interfaces.koIHttpInspectorRuleAction.ACTION_BREAK,
                         components.interfaces.koIHttpInspectorRuleAction.ACTION_TIMEOUT):
            return "%s" % (self._type_to_text[self.type])
        if self.type == components.interfaces.koIHttpInspectorRuleAction.ACTION_DELAY:
            if self.flags == components.interfaces.koIHttpInspectorRuleAction.ACTION_FLAG_LITERAL:
                return "%s by %sms" % (self._type_to_text[self.type], self.value1)
            elif self.flags == components.interfaces.koIHttpInspectorRuleAction.ACTION_FLAG_RANDOM:
                return "%s between %s - %sms" % (self._type_to_text[self.type],
                                                 self.value1, self.value2)
        elif self.type == components.interfaces.koIHttpInspectorRuleAction.ACTION_MODIFY_FIELD:
            return "%s '%s' to '%s'" % (self._type_to_text[self.type],
                                self._flag_modify_field_to_text[self.flags],
                                self.value1)
        elif self.type == components.interfaces.koIHttpInspectorRuleAction.ACTION_SET_HEADER:
            return "%s '%s' to '%s'" % (self._type_to_text[self.type],
                                        self.value1, self.value2)
        elif self.type == components.interfaces.koIHttpInspectorRuleAction.ACTION_REMOVE_HEADER:
            return "%s '%s'" % (self._type_to_text[self.type],
                                self.value1)
        else:
            return "UNKNOWN Rule Action"

    def copy(self, action):
        """Copy the action"""

        self.type = action.type
        self.flags = action.flags
        self.value1 = action.value1
        self.value2 = action.value2

    def loadFromPreference(self, pref):
        try:
            self.type = pref.getLongPref("type")
            self.flags = pref.getLongPref("flags")
            self.value1 = pref.getStringPref("value1")
            self.value2 = pref.getStringPref("value2")
        except COMException:
            # Pref did not exist
            return False
        return True

    def convertToPreference(self):
        pref = components.classes[
                    '@activestate.com/koPreferenceSet;1'].createInstance()
        pref.setLongPref("type", self.type)
        pref.setLongPref("flags", self.flags)
        pref.setStringPref("value1", self.value1)
        pref.setStringPref("value2", self.value2)
        return pref

    def __str__(self):
        s = ["type: %r" % self.type]
        s += ["flags: %r" % self.flags]
        s += ["value1: %r" % self.value1]
        s += ["value2: %r" % self.value2]
        return "  koRuleAction:\n    " + "\n    ".join(s)

class koHttpInspectorRule:
    _com_interfaces_ = [components.interfaces.koIHttpInspectorRule]
    _reg_clsid_ = "{0e8e1680-a843-4857-975c-1a8e782e6a21}"
    _reg_contractid_ = "@activestate.com/koHttpInspectorRule;1"
    _reg_desc_ = "Komodo HTTP Inspector Rule"

    # Namespace shortcuts
    TYPE_REQUEST          = components.interfaces.koIHttpInspectorRule.TYPE_REQUEST
    TYPE_RESPONSE         = components.interfaces.koIHttpInspectorRule.TYPE_RESPONSE
    TYPE_REQUEST_RESPONSE = components.interfaces.koIHttpInspectorRule.TYPE_REQUEST_RESPONSE

    def __init__(self):
        self.name = ""
        self.type = self.TYPE_REQUEST
        self.match_any = False
        self.enabled = False
        self.requirements = []
        self.actions = []

    def getRuleText(self):
        """Return the text describing the details of the rule"""

        msgList = [ "Matches on:" ]
        if len(self.requirements) > 0:
            for req in self.requirements:
                msgList.append("    %s" % (req.getRequirementText()))
        else:
            msgList.append("    None")

        msgList = [ "Action:" ]
        if len(self.actions) > 0:
            for action in self.actions:
                msgList.append("    %s" % (action.getActionText()))
        else:
            msgList.append("    None")

        return "".join(msgList)

    def getRequirements(self):
        return self.requirements

    def setRequirements(self, newRequirements):
        self.requirements = newRequirements

    def getActions(self):
        return self.actions

    def setActions(self, newActions):
        self.actions = newActions

    def loadFromPreference(self, pref):
        try:
            self.name = pref.getStringPref("name")
            self.type = pref.getLongPref("type")
            self.match_any = pref.getBooleanPref("match_any")
            self.enabled = pref.getBooleanPref("enabled")
    
            requirements = pref.getPref("requirements")
            actions = pref.getPref("actions")
        except COMException:
            # Pref did not exist
            return False

        for i in range(requirements.length):
            requirementPref = requirements.getPref(i).QueryInterface(components.interfaces.koIPreferenceSet)
            koRuleRequirement = components.classes["@activestate.com/koHttpInspectorRuleRequirement;1"].\
                        createInstance(components.interfaces.koIHttpInspectorRuleRequirement)
            if koRuleRequirement.loadFromPreference(requirementPref):
                self.requirements.append(koRuleRequirement)

        for i in range(actions.length):
            actionPref = actions.getPref(i).QueryInterface(components.interfaces.koIPreferenceSet)
            koRuleAction = components.classes["@activestate.com/koHttpInspectorRuleAction;1"].\
                        createInstance(components.interfaces.koIHttpInspectorRuleAction)
            if koRuleAction.loadFromPreference(actionPref):
                self.actions.append(koRuleAction)

        return True

    def convertToPreference(self):
        pref = components.classes[
                    '@activestate.com/koPreferenceSet;1'].createInstance()
        # Create the pref list for rule requirements
        requirementsPref = components.classes[
                    '@activestate.com/koOrderedPreference;1'].createInstance()
        requirementsPref.id = "requirements"
        for requirement in self.requirements:
            requirementsPref.appendPref(requirement.convertToPreference())

        # Create the pref list for rule actions
        actionsPref = components.classes[
                    '@activestate.com/koOrderedPreference;1'].createInstance()
        actionsPref.id = "actions"
        for action in self.actions:
            actionsPref.appendPref(action.convertToPreference())

        pref.setStringPref("name", self.name)
        pref.setLongPref("type", self.type)
        pref.setBooleanPref("match_any", self.match_any)
        pref.setBooleanPref("enabled", self.enabled)

        pref.setPref("requirements", requirementsPref)
        pref.setPref("actions", actionsPref)
        return pref

    def __str__(self):
        s = ["type: %r" % self.type]
        s += ["name: %r" % self.name]
        s += ["match_any: %r" % self.match_any]
        s += ["enabled: %r" % self.enabled]
        s += ["\n"]
        s += [str(r) for r in self.requirements]
        s += ["\n"]
        s += [str(a) for a in self.actions]
        s += ["\n"]
        return "koRule:\n" + "".join(s)
