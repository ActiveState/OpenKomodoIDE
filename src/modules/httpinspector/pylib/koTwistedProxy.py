# Copyright (c) 2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.
#
# Proxy handling code using Twisted for Komodo HTTP Proxy debugging.
#
# Requirements:
#   twisted
#
# Contributors:
# * Todd Whiteman
#

import sys
import urlparse
import threading
import weakref

from twisted.web import proxy, http
from twisted.internet import reactor, defer
from twisted.python import log
from twisted.python import threadable

try:
    from xpcom import components, COMException, ServerException, nsError
    from xpcom.server import WrapObject, UnwrapObject
    have_XPCOM = 1
except ImportError:
    print "WARNING: Running without XPCOM"
    have_XPCOM = 0

from caselessDict import CaselessDict

# Init twisted threading
threadable.init()
# Twisted logging
#log.startLogging(sys.stdout)

# The koProxyDebugger object used to pass information to/from.
# This will decide how requests and responses are handled.
koProxyDebugger = None
twisted_portListener = None

# Twisted events we want to receive / intercept
# New connection
# All headers received
# Request sent on
# Response received

class dummyResponse:
    def __init__(self, father, status, headers, response_parts):
        self.father = father
        self.response_status = status
        self.response_headers = CaselessDict(headers)
        self.response_parts = response_parts
        self.data = "".join(self.response_parts)
    
# proxy.ProxyClient implements ( http.HTTPClient )
class koProxyClient(proxy.ProxyClient):
    """Used by ProxyClientFactory to implement a simple web proxy."""

    def __init__(self, command, rest, version, headers, data, father):
        proxy.ProxyClient.__init__(self, command, rest, version, headers, data, father)
        # Used to store information before being sent
        self.response_status = 0
        self.response_headers = CaselessDict()
        self.response_parts = []
        self.handledResponeEnd = False
        # father is the original request object
        #print "father: (%d)" % (id(father)), father
        #print dir(self)

    def connectionMade(self):
        # This means we have received the request and are now connected to the
        # destination host (or destination proxy)
        #print "Proxied response: Connection made"
        #print "cmd: %s" % (self.command)
        #print "Server connection made"
        proxy.ProxyClient.connectionMade(self)

    # DEBUG: XXX - Remove me: Just used for debugging
    #def sendCommand(self, command, path):
    #    proxy.ProxyClient.sendCommand(self, command, path)
    #    print '%s %s HTTP/1.0' % (command, path)
    #
    #def sendHeader(self, name, value):
    #    proxy.ProxyClient.sendHeader(self, name, value)
    #    print '%s: %s' % (name, value)
    #
    #def endHeaders(self):
    #    proxy.ProxyClient.endHeaders(self)
    #    print
    # DEBUG: End of debugging

    # handle Status back from destination server
    def handleStatus(self, version, code, message):
        #print "Proxied response: handleStatus"
        self.response_status = [ version, code, message ]

    # handle header back from destination server
    def handleHeader(self, key, value):
        #print "Proxied response: handleHeaders"
        # XXX - What about the preservation of order of the headers??
        self.response_headers[key] = value

    # Catch response headers back from the destination
    def handleEndHeaders(self):
        #print "Proxied response: handleEndHeaders"
        pass

    # Catch response data back from destination
    def handleResponsePart(self, buffer):
        #print "Proxied response: handleResponsePart"
        self.response_parts.append(buffer)

    def _finishHandleResponseEnd(self):
        # Write the response now
        # Write the status
        #log.msg("_finishHandleResponseEnd: self.response_status: %r" % self.response_status)
        proxy.ProxyClient.handleStatus(self, *self.response_status)

        # Write headers
        for key, value in self.response_headers.items():
            proxy.ProxyClient.handleHeader(self, key, value)
        proxy.ProxyClient.handleEndHeaders(self)

        # Write data
        proxy.ProxyClient.handleResponsePart(self, self.data)

        # Finalize the response
        proxy.ProxyClient.handleResponseEnd(self)

    def handleResponseEnd(self):
        #print "Proxied response: handleResponseEnd"
        # We have everything we need from response, pass it off to the debugger
        if not self.handledResponeEnd and self.response_status:
            self.handledResponeEnd = True
            self.data = ''.join(self.response_parts)

            delayPeriod = koProxyDebugger.handleServerResponse(self)
            if delayPeriod:
                if delayPeriod < 0: # Timeout
                    return
                # Place into a later call
                reactor.callLater(delayPeriod, self._finishHandleResponseEnd)
            else:
                self._finishHandleResponseEnd()

# proxy.ProxyClientFactory implements ( protocol.ClientFactory )
class koProxyClientFactory(proxy.ProxyClientFactory):
    """Used by koProxyRequest to implement a simple web proxy."""
    protocol = koProxyClient

    # Example - If I want to customize koProxyClient creation
    #def buildProtocol(self, addr):
    #    p = self.protocol()
    #    p.factory = self
    #    return p

    def clientConnectionFailed(self, connector, reason):
        log.msg("koProxyClientFactory: client connection failed: %s", reason)
        self.response_status = [ "HTTP/1.0", "501", "Gateway error" ]
        self.response_parts = ['''<H1>Could not connect</H1>\r\n''',
                               '%s\r\n' % (reason)]
        self.data = "".join(self.response_parts)
        self.response_headers = { "Content-Type": "text/html",
                                  "Content-Length": "%s" % (len(self.data)) }
        # Write out the response
        self.father.transport.write("%s %s %s\r\n" % (self.response_status[0],
                                                      self.response_status[1],
                                                      self.response_status[2]))
        for key, value in self.response_headers.items():
            self.father.transport.write("%s: %s\r\n" % (key, value))
        self.father.transport.write("\r\n")
        self.father.transport.write(self.data)

        #print dir(self)
        #print "self.headers:", self.headers
        koProxyDebugger.handleServerResponse(self)


# HTTPS handling
class koProxyHTTPSClient(koProxyClient):
    """Used by ProxyHTTPSClientFactory to implement a simple HTTPS web proxy."""

    def __init__(self, command, rest, version, headers, data, father):
        koProxyClient.__init__(self, command, rest, version, headers, data, father)

    def _finishWritingResponse(self, response):
        # Send the "Connection Successful" response back to thr browser
        #print "Sending status okay for HTTPS connection"
        self.father.transport.write("%s %s %s\r\n" % (response.response_status[0],
                                                      response.response_status[1],
                                                      response.response_status[2]))
        for key, value in response.response_headers.items():
            self.father.transport.write("%s: %s\r\n" % (key, value))
        self.father.transport.write("\r\n")
        if response.data:
            self.father.transport.write(response.data)

    def _handleServerResponse(self, response):
        delayPeriod = koProxyDebugger.handleServerResponse(response)
        if delayPeriod:
            if delayPeriod < 0: # Timeout
                return
            # Place into a later call
            reactor.callLater(delayPeriod, self._finishWritingResponse, response)
        else:
            self._finishWritingResponse(response)

    def _setRawSSLMode(self):
        self.setRawMode()
        self.father.channel.setRawMode()
        self.father._httpsClientWeakref = weakref.ref(self)

    def connectionMade(self):
        # This means we have received the request and are now connected to the
        # destination host (or destination proxy)
        #print "Proxied response: Connection made"
        #print "cmd: %s" % (self.command)
        #print "HTTPS Server connection made"
        # HTTPS work
        if koProxyDebugger.proxyForwardingEnabled:
            # We are connected to another proxy
            koProxyClient.connectionMade(self)
            return
        self._setRawSSLMode()
        response_status = ["HTTP/1.0", "200", "Connection established"]
        response_headers = {"Proxy-agent": "Komodo HTTP Inspector"}
        response = dummyResponse(self.father, response_status, response_headers, [])
        # Pass to proxy (it can modify values as needed)
        self._handleServerResponse(response)

    def _finishHandleResponseEnd(self):
        koProxyClient._finishHandleResponseEnd(self)
        self._setRawSSLMode()

    # Catch response headers back from the destination
    # Note: Only used for proxy forwarding for HTTPS connections
    def handleEndHeaders(self):
        #print "Proxied HTTPS response: handleEndHeaders"
        self._handleServerResponse(self)

    # Catch response data back from destination
    def handleResponsePart(self, buffer):
        #print "Proxied HTTPS response: handleResponsePart (%d)" % (len(buffer))
        self.father.transport.write(buffer)

    def handleResponseEnd(self):
        #print "Proxied HTTPS response: handleResponseEnd"
        # Finalize the response
        proxy.ProxyClient.handleResponseEnd(self)

    def forwardRequestData(self, data):
        self.transport.write(data)

class koProxyHTTPSClientFactory(koProxyClientFactory):
    """Used by koProxyRequest to implement a simple HTTPS web proxy."""
    protocol = koProxyHTTPSClient

# proxy.ProxyRequest implements ( http.Request )
class koProxyRequest(proxy.ProxyRequest):
    """Used by koProxy to implement a simple web proxy."""
    protocols = { 'http': koProxyClientFactory,
                  'https': koProxyHTTPSClientFactory }
    ports = {'http': 80,
             'https': 443 }

    def __init__(self, channel, queued):
        proxy.ProxyRequest.__init__(self, channel, queued)
        self._isConnectMethod = False
        self._httpsClientWeakref = None

    def _sendResponse(self, response):
        # Pass to proxy (it can modify values as needed)
        koProxyDebugger.handleServerResponse(response)
        # Send the response
        self.channel.transport.write("%s %s %s\r\n" % (response.response_status[0],
                                                       response.response_status[1],
                                                       response.response_status[2]))
        for key, value in response.response_headers.items():
            self.channel.transport.write("%s: %s\r\n" % (key, value))
        self.channel.transport.write("\r\n")
        self.channel.transport.write(response.data)
        self.channel.transport.loseConnection()

    def _sendResponseWithStatus(self, status, additionalMessage=None):
        statusStr = "%d" % (status)
        statusMessage = http.RESPONSES.get(status, "")
        if not additionalMessage:
            if statusMessage:
                additionalMessage = "<p>%s</p>\n" % (statusMessage)
            else:
                additionalMessage = ""
        else:
            additionalMessage = "<p>%s</p>\n" % (additionalMessage)
        response_status = ["HTTP/1.0", statusStr, statusMessage]
        response_headers = {"Content-Type": "text/html"}
        response_parts = ['''<h1>%s</h1>\n''' % (statusStr),
                          additionalMessage,
                          '''<hr>\n'''
                          '''<address>Komodo Http Inspector, Port %d</address>\n''' % (koProxyDebugger.port)]
        response = dummyResponse(self, response_status, response_headers,
                                 response_parts)
        self._sendResponse(response)

    def _finishProcessCall(self, headers):
        try:
            parsed = urlparse.urlparse(self.uri)
            if self.method == "CONNECT":
                protocol = "https"
                host = parsed[0]
                self.uri = "https://" + self.uri
                self._isConnectMethod = True
                rest = "/"
            else:
                protocol = parsed[0]
                host = parsed[1]
                self._isConnectMethod = False
                rest = urlparse.urlunparse(('','')+parsed[2:])
            if not rest:
                rest = rest+'/'
            port = self.ports[protocol]
            if ':' in host:
                host, port = host.split(':')
                port = int(port)
            if not headers.has_key('host'):
                headers['host'] = host
            #print "Content-Length: %d" % (len(self.data))
            #print "process method: %s, rest: %s\n" % (self.method, rest)
            #print "self.clientproto", self.clientproto
            reqPath = rest
            if koProxyDebugger.proxyForwardingEnabled:
                # Need to rewrite the path for the upstream proxy
                if self._isConnectMethod:
                    reqPath = "%s:%d" % (host, port)
                    #class_ = self.protocols["https"]
                else:
                    reqPath = "%s://%s:%d%s" % (protocol, host, port, rest)
                    #class_ = self.protocols["http"]
            class_ = self.protocols[protocol]
            clientFactory = class_(self.method, reqPath, self.clientproto,
                                   headers, self.data, self)
            # Make the host connection
            if koProxyDebugger.proxyForwardingEnabled:
                # Host is another proxy
                reactor.connectTCP(koProxyDebugger.proxy_to_host,
                                   koProxyDebugger.proxy_to_port,
                                   clientFactory)
            else:
                reactor.connectTCP(host, port, clientFactory)

        except Exception, e:
            log.msg("Exception: _finishProcessCall: %s", e)
            import traceback
            traceback.print_exc()
            self._sendResponseWithStatus(http.BAD_REQUEST, "koHttpInspector: Could not understand the query: '%s'" % (self.uri))

    # Mostly this code is directly from twisted's ProxyRequest.process()
    def process(self):
        # This means we have received all of the request. We now connect to the
        # destination (or real proxy) to pass on this request.
        try:
            # Request event 3
            #print "self.method: %s" % (self.method)
            #print "self.uri: %s" % (self.uri)
            headers = self.getAllHeaders().copy()
            self.content.seek(0, 0)
            self.data = self.content.read()

            delayPeriod, forcedResponseStatus = koProxyDebugger.handleClientRequest(self, headers)
            # forcedResponseStatus < 0 means (timeout) same as delayPeriod < 0
            if forcedResponseStatus and forcedResponseStatus < 0:
                delayPeriod = forcedResponseStatus
            if delayPeriod:
                if delayPeriod < 0: # Timeout
                    return
                # Place into a later call
                reactor.callLater(delayPeriod, self._finishProcessCall, headers)
            elif forcedResponseStatus:
                self._sendResponseWithStatus(forcedResponseStatus)
            else:
                self._finishProcessCall(headers)
        except Exception, e:
            log.msg("Exception: process: %s", e)
            import traceback
            traceback.print_exc()
            self._sendResponseWithStatus(http.BAD_REQUEST, "koHttpInspector: Could not understand the query: '%s'" % (self.uri))

    def connectionLost(self, reason):
        #print "koProxyRequest::connectionLost"
        #print "self._isConnectMethod: %r" % (self._isConnectMethod)
        if self._httpsClientWeakref:
            #print "self._httpsClientWeakref(): %r" % (self._httpsClientWeakref())
            httpsClient = self._httpsClientWeakref()
            if httpsClient:
                httpsClient.connectionLost(reason)

    def forwardHTTPSData(self, data):
        if self._httpsClientWeakref:
            httpsClient = self._httpsClientWeakref()
            if httpsClient:
                httpsClient.forwardRequestData(data)

#
# proxy.Proxy implements ( http.HTTPChannel )
# http.HTTPChannel implements ( basic.LineReceiver, policies.TimeoutMixin )
class koProxy(proxy.Proxy): 
    requestFactory = koProxyRequest

    #def makeConnection(self):
    #    result = koProxyDebugger.handleConnectionMade()

    # A new connection received from cleint (i.e. from the browser)
    def connectionMade(self):
        result = koProxyDebugger.handleClientConnectionMade(self)
        proxy.Proxy.connectionMade(self)
        #twisted_portListener.pauseProducing()
        #print "len(self.requests): %d" % (len(self.requests))
        #print "koProxy: Connection made from: %s:%d" % (self.transport.client[0], self.transport.client[1])

    def connectionLost(self, reason):
        #print "koProxy: Connection lost because: %s" % (reason)
        result = koProxyDebugger.handleClientConnectionLost(self)
        proxy.Proxy.connectionLost(self, reason)

    def rawDataReceived(self, data):
        req = self.requests[-1]
        if req and req.method == "CONNECT":
            req.forwardHTTPSData(data)
        else:
            proxy.Proxy.rawDataReceived(self, data)

class koProxyFactory(http.HTTPFactory):
    protocol = koProxy
    #def buildProtocol(self, addr):
    #    pass

#
# Manage the proxy state
#
def _startListener(port, acceptLocalConnectionsOnly, doneEvent):
    global twisted_portListener
    log.msg("INFO: Starting proxy listener on port: ", port)
    try:
        if acceptLocalConnectionsOnly:
            # Use the localhost interface
            twisted_portListener = reactor.listenTCP( port, koProxyFactory(), interface="127.0.0.1" )
        else:
            twisted_portListener = reactor.listenTCP( port, koProxyFactory() )
        koProxyDebugger.isListening = True
        log.msg("INFO: Proxy is now listening.")
    except Exception, e:
        koProxyDebugger.lastError = "Listener Error: %s" % (e, )
    doneEvent.set()
    #twisted_portListener = reactor.callFromThread( reactor.listenTCP, port, koProxyFactory() )
    #print twisted_portListener
    #print dir( twisted_portListener )

def startListener(port, acceptLocalConnectionsOnly=True):
    # Use twisted's own thread for calling this. Using callLater ensures that
    # twisted is properly initialized before the listener is created.
    doneEvent = threading.Event()
    koProxyDebugger.lastError = ""
    reactor.callFromThread(reactor.callLater, 0, _startListener, port, acceptLocalConnectionsOnly, doneEvent)
    doneEvent.wait(10)
    if not doneEvent.isSet():
        # Still has not started
        koProxyDebugger.lastError = "Listener Error: Did not start within an acceptable time"
        stopListener(port)
    return koProxyDebugger.lastError

def stopListener(port):
    global twisted_portListener
    if twisted_portListener is not None:
        log.msg("INFO: Stopping proxy listener on port: ", port)
        # Use twisted's own thread for calling this
        reactor.callFromThread(twisted_portListener.stopListening)
        log.msg("INFO: Proxy listener has now stopped")
        twisted_portListener = None
    else:
        log.msg("INFO: No proxy listener was running")
    koProxyDebugger.isListening = False


def startProxyReactor(koProxyDebuggerSvc, readyEvent):
    global koProxyDebugger
    # Shutdown if it was already running
    stopProxyReactor()
    if have_XPCOM:
        # Unwrap the xpcom proxy service
        koProxyDebugger = UnwrapObject(koProxyDebuggerSvc)
    else:
        koProxyDebugger = koProxyDebuggerSvc
    readyEvent.set()

    # Start twisted
    # Do not install signal handlers, Komodo will handle that
    reactor.run(installSignalHandlers=0)

def stopProxyReactor():
    # Shutdown if it was already running
    if reactor.running:
        log.msg("INFO: Shutting down proxy reactor")
        _reactorShutdownEvent = threading.Event()
        reactor.callFromThread(reactor.addSystemEventTrigger, 'after', 'shutdown', _reactorShutdownEvent.set)
        reactor.callFromThread(reactor.stop)
        _reactorShutdownEvent.wait()
        log.msg("INFO: Proxy reactor is now shutdown")

###
# Test classes
###

class dummyProxyDebugger:
    """An dummy service for debugging http requests and their responses."""
    def __init__(self):
        # Get some of these settings from prefs
        self.lastError = ""
        self.enabled = True
        self.isListening = False
        self.port = 8080
        self.proxy_to_host = ""  # we may need to proxy to another proxy
        self.proxy_to_port = 0   # we may need to proxy to another proxy
        self.proxyForwardingEnabled = 0
        # Proxy sessions (requests and responses)
        self.sessions = None

    def startProxyService(self):
        pass
    def stopProxyService(self):
        pass
    def addProxyObserver(self, observer):
        pass
    def removeProxyObserver(self):
        pass
    def clear(self):
        pass
    def getCacheSize(self):
        return 0

    # Non xpcom components
    def handleClientRequest(self, koproxyReq, headers):
        # return with the tuple (delayPeriod, forcedResponseStatus)
        #print koproxyReq
        return (0, False)
    def handleServerResponse(self, koproxyResp):
        pass
    def handleClientConnectionMade(self, koproxy):
        pass
    def handleClientConnectionLost(self, koproxy):
        pass

def _testShutdown():
    try:
        import time
        time.sleep(5)
        stopProxyReactor()
    except Exception, e:
        print "EXCEPTION:", e

def _test():
    import time
    #t = threading.Thread( target=_testShutdown )
    #t.setDaemon(1)
    #t.start()
    readyEvent = threading.Event()
    debugger = dummyProxyDebugger()
    proxyThread = threading.Thread( target=startProxyReactor,
                                    args=(debugger, readyEvent) )
    proxyThread.setDaemon(0)
    proxyThread.start()

    readyEvent.wait(10)
    if not readyEvent.isSet():
        raise Exception("HTTP Inspector could not start")

    port = 8082
    startListener(port)
    if koProxyDebugger.isListening:
        while 1:
            try:
                time.sleep(1)
            except KeyboardInterrupt:
                print "KeyboardInterrupt received... shutting down"
                break
            except:
                import traceback
                traceback.print_exc()
        stopListener(port)
    else:
        # Could not listen, print out why
        print koProxyDebugger.lastError
    stopProxyReactor()

if __name__ == '__main__':
    _test()
