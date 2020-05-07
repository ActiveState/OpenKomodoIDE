#!/usr/bin/env python

"""Base functionality for creating API client classes.
See `nullapi.py` for an example on how to use this.
"""

import sys
import os
import logging
from pprint import pprint, pformat
import re
import socket
import time
from urllib import urlencode
import urlparse
import httplib

from activeapis2 import utils
httplib2 = utils.httplib2
jsonlib = utils.jsonlib



#---- the main API class

class APIBase(object):
    """An base API client class."""
    # The API endpoint path under the site URL.
    # Subclasses must set this, e.g. "http://account.activestate.com/api/".
    # Must have the trailing '/'.
    DEFAULT_API_URL = None
    
    def __init__(self, api_url=None):
        """Create an API instance.
    
        @param api_url {str} The base URL of the API. Optional. Defaults
            to the canonical site location for this API.
        """
        self._name = self.__class__.__name__.lower()
        self._log = logging.getLogger(self._name)
        self._api_url = api_url or self.DEFAULT_API_URL
    
    def __repr__(self):
        return "<%s: %s>" % (self.__class__.__name__, self._api_url)
    
    # Exception hierarchy.
    class APIError(Exception):
        pass
    

class HttpAPIBase(APIBase):
    """An base API client class for HTTP-based APIs."""

    # A default dict of headers to use for HTTP requests.
    # Subclasses can define this if their API has specific requirements.
    DEFAULT_REQUEST_HEADERS = None

    def __init__(self, http_cache_dir=None, request_headers=None,
            auth_name=None, auth_password=None, auth_domain="",
            timeout=None, api_url=None):
        """Create an API instance.
    
        @param http_cache_dir {str} Path to existing base directory for HTTP
            caching. Optional. If give the HTTP library will use it for
            local caching (as per Cache-Control headers).
        @param request_headers {dict} Dict of headers to use for HTTP
            requests. Optional. Defaults to the setting for this API client
            classes (commonly this is empty).
        @param auth_name {str} Optional. If given, is used anytime an HTTP
            request requires authentication.
        @param auth_password {str} Optional.
        @param auth_domain {str} Optional. Defaults to the empty string.
        @param timeout {int} Optional. Number of seconds on which to timeout
            socket connections.
        @param api_url {str} The base URL of the API. Optional. Defaults
            to the canonical site location for this API.
        """
        super(HttpAPIBase, self).__init__(api_url)
        self._request_headers = (request_headers
            or self.DEFAULT_REQUEST_HEADERS or {})
        self._http = utils.get_http(http_cache_dir, self._name,
            timeout=timeout)
        if auth_name:
            self._http.add_credentials(auth_name, auth_password, auth_domain)

    def _request_json(self, url, method="GET", body=None, headers=None):
        """Make an HTTP request, expecting a JSON response.
        
        See `_request` docstring for param descriptions.
        
        @returns {object} The decoded JSON response.
        @raises {self.APIError} if the response is not valid JSON.
        """
        json_str = self._request(url, method, body, headers)
        try:
            return jsonlib.loads(json_str)
        except ValueError, ex:
            raise self.APIError("unexpected response from <%s>: invalid "
                "JSON:\n  url: %s\n  body: %r\n  "
                "response content: %r\n  json decoding error: %s" % (
                url, url, body, json_str, ex))
    
    def _request(self, url, method="GET", body=None, headers=None):
        """Make a request.
        
        Arguments correspond to those for `httplib2.Http.request`:
            <http://code.google.com/p/httplib2/wiki/Examples>
        
        One special case is if the given `body` is a dict, it is presumed
        that the caller wants the request configured for POSTing to a form:
        i.e. urlencoding `body` and setting the appropriate "Content-Type"
        header.
        
        @param url {str} URL to request.
        @param method {str} Default is "GET".
        @param body {str|dict} Request body, if any. See special case above
            if this is a dict.
        @param headers {dict} Special request headers, if any. If not given
            or None, `self._request_headers` will be used.
        """
        before = time.time()
        if headers is None:
            headers = self._request_headers
        
        # Must encode body to bytes, if it is a unicode string.
        # Special case handling: presume want to encode for a form if `body`
        # is a dict.
        if isinstance(body, dict):
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            body_utf8 = {}
            for k,v in body.items():
                if isinstance(k, unicode):
                    k = k.encode('utf-8')
                if isinstance(v, unicode):
                    v = v.encode('utf-8')
                body_utf8[k] = v
            body_enc = urlencode(body_utf8)
        elif isinstance(body, unicode):
            body_enc = body.encode('utf-8')
        else:
            body_enc = body
        
        try:
            resp, content = self._http.request(url, method, body_enc,
                headers=headers)
        except httplib2.ServerNotFoundError, ex:
            raise self.ServerNotFoundError(ex)
        #TODO: catch other httplib2 and httplib errors and wrap in generic APIError class
        except httplib.BadStatusLine, ex:
            raise self.APIError("Bad HTTP Status Line: %s" % ex)
        except socket.error, ex:
            self._raise_on_socket_error(ex, url)
        
        status = resp["status"]
        if self._log.isEnabledFor(logging.INFO):
            if resp.fromcache:
                dur = "cached"
            else:
                dur = "%.1fs" % (time.time() - before)
            body_summary = ""
            if body_enc:
                body_summary = (", body="
                    + utils.one_line_summary_from_text(body_enc, 50))
            self._log.info("%s %s %s (%s%s)", method, url, status,
                dur, body_summary)
        self._raise_on_http_status(status, (url, resp, content))
        return content

    # Exception hierarchy.
    class ServerNotFoundError(APIBase.APIError):
        """The API server could not be found."""
    
    class SocketError(APIBase.APIError):
        """Socket-level error."""
        def __init__(self, errno, errcode, msg, url):
            self.errno = errno
            self.errcode = errcode
            self.msg = msg
            self.url = url
            # Set `self.args` for compat with the replaced `socket.error`.
            if errno is None:
                self.args = msg
            else:
                self.args = (errno, msg)
        def __str__(self):
            if self.errno:
                return "[Errno %s] %s (%s)" % (self.errno,
                    self.msg, self.url)
            else:
                return "%s (%s)" % (self.msg, self.url)
    
    # Special per-socket-errno exception classes. (can add additional ones as
    # needed).
    class TimeoutError(SocketError):
        """Timed out talking to server."""
    class HostDownError(SocketError):
        """Server host is down."""
    
    _error_class_from_socket_errcode = {
        # The "WSA*" codes are for Windows.
        "EHOSTDOWN": HostDownError,
        "WSAEHOSTDOWN": HostDownError,
        "ETIMEDOUT": TimeoutError,
        "WSAETIMEDOUT": TimeoutError,
    }
    @classmethod
    def _raise_on_socket_error(cls, ex, url):
        import errno as errnolib
        if isinstance(ex.args, tuple) and len(ex.args) == 2:
            errno, msg = ex.args
        else:
            errno, msg = None, ex.args
        if errno:
            errcode = errnolib.errorcode[errno]
            error_class = cls._error_class_from_socket_errcode.get(errcode,
                cls.SocketError)
        else:
            errcode = None
            error_class = cls.SocketError
        raise error_class(errno, errcode, msg, url)
    
    class HTTPError(APIBase.APIError):
        """HTTP 4xx or 5xx error talking to API server."""
        def __init__(self, url, response, content):
            self.url = url
            self.response = response
            self.content = content
            # Python 2.4's `Exception` is a classic class, hence can't use
            # `super` here.
            APIBase.APIError.__init__(self, content)
        @property
        def status(self):
            return self.response["status"]
        def __repr__(self):
            return "<%s (%s): %s>" % (self.__class__.__name__,
                self.status, self)
        def __str__(self):
            if False:   # verbose, multi-line
                return self.pformat()
            else:
                # one-liner
                s = repr(self.content)
                if len(s) > 2000:  # clipped
                    s = s[:1997] + "...'"
                return "[HTTP %s] %s %s" % (self.response["status"], 
                    self.url, s)
        def pformat(self):
            """Verbose summary of the error."""
            prefix = ""
            if self.__class__ is HttpAPIBase.HTTPError:
                prefix = "[HTTP %s] " % self.response["status"]
            return "%s%s\n%s\n--\n%s" % (prefix, self.url,
                pformat(self.response), self.content)

    # Special per-status exception classes. (can add additional ones as needed).
    class BadRequestError(HTTPError):
        """HTTP 400: Bad Request"""
    class UnauthorizedError(HTTPError):
        """HTTP 401: Unauthorized"""
    class PaymentRequiredError(HTTPError):
        """HTTP 402: Payment Required"""
    class ForbiddenError(HTTPError):
        """HTTP 403: Forbidden"""
    class NotFoundError(HTTPError):
        """HTTP 404: Not Found"""
    class MethodNotAllowed(HTTPError):
        """HTTP 405: Method Not Allowed"""
    class NotAcceptableError(HTTPError):
        """HTTP 406: Not Acceptable"""
    class ProxyAuthenticationRequiredError(HTTPError):
        """HTTP 407: Proxy Authentication Required"""
    class ServiceUnavailableError(HTTPError):
        """HTTP 503: Service Unavailable"""
    
    _error_class_from_http_status = {
        "400": BadRequestError,
        "401": UnauthorizedError,
        "402": PaymentRequiredError,
        "403": ForbiddenError,
        "404": NotFoundError,
        "405": MethodNotAllowed,
        "406": NotAcceptableError,
        "407": ProxyAuthenticationRequiredError,
        "503": ServiceUnavailableError,
    }
    @classmethod
    def _raise_on_http_status(cls, status, args):
        if status[0] in ("4", "5"):
            error_class = cls._error_class_from_http_status.get(status,
                cls.HTTPError)
            raise error_class(*args)


class XmlrpcTransport(object):
    """xmlrpclib Transport that uses httplib2 for HTTP."""
    def __init__(self, api, use_datetime):
        self._api = api
        self._api_url = api._api_url
        self._parser_kwargs = {}
        if sys.version_info[:2] >= (2,5):
            self._parser_kwargs["use_datetime"] = use_datetime
    def request(self, host, handler, body, verbose=False):
        import xmlrpclib
        content = self._api._request(self._api_url, "POST", body)
        parser, unmarshaller = xmlrpclib.getparser(*self._parser_kwargs)
        parser.feed(content)
        parser.close()
        return unmarshaller.close()
    

#TODO: Consider an update to __getattr__ to make XML-RPC method calls via
#  an wrapper that morphs xmlrpclib.ProtocolError's (and other errors)
#  to `APIBase.APIError` instances. Otherwise the xmlrpc underpinnings are
#  being leaked.
#    Fault -> Fault
#    * -> APIError
class XmlrpcAPIBase(HttpAPIBase):
    """An base API client class for XML-RPC-based APIs."""

    DEFAULT_REQUEST_HEADERS = {
        "Content-Type": "text/xml",
        "User-Agent": "activeapis2 xmlrpclib.py",
    }

    def __init__(self, http_cache_dir=None, request_headers=None,
            auth_name=None, auth_password=None, auth_domain="",
            timeout=None, api_url=None,
            verbose=False, use_datetime=False):
        """
        
        @see {HttpAPIBase.__init__}
        @param verbose {bool} Whether to set the XML-RPC server proxy class
            to verbose: will print debugging info to stdout. Default False.
        @param use_datetime {bool} Whether to set the XML-RPC server proxy
            class to convert datetime attributes to Python datetime objects.
            This is only available if using Python >=2.5.
        """
        import xmlrpclib
        super(XmlrpcAPIBase, self).__init__(http_cache_dir=http_cache_dir,
            request_headers=request_headers, auth_name=auth_name,
            auth_password=auth_password, auth_domain=auth_domain,
            timeout=timeout, api_url=api_url)
        transport = XmlrpcTransport(self, use_datetime)
        self._server = xmlrpclib.ServerProxy(self._api_url,
            verbose=verbose, transport=transport)

    _handler_from_name_cache = None
    _non_ident_chars_re = re.compile(r"[^a-zA-Z_0-9]")
    def __getattr__(self, name):
        """Dispatch the requested method to the appropriate handler. If
        the class doesn't provide an override handler, then the attribute
        (presumably an XML-RPC method call) is passed directly to
        `self._server` (the server proxy).
        
        The "XML-RPC method name -> class handler method name" mapping is:
        
        1. prefix with "_override_": Marks it private so there is only
           one preferred way to call the methods.
        2. replace non-Python-identifier chars with "_".
        
        Note: Subclasses that don't want this extra handling can just set
        their own dispatch as follows:

            def __getattr__(self, name):
                '''Forward XML-RPC method calls to the server proxy.'''
                return getattr(self._server, name)
        """
        if name.startswith("_override_"):
            # Break infinite `getattr` loop.
            return super(XmlrpcAPIBase, self).__getattr__(name)
        if self._handler_from_name_cache is None:
            self._handler_from_name_cache = {}
        if name not in self._handler_from_name_cache:
            handler_name = "_override_" + self._non_ident_chars_re.sub(
                '_', name)
            self._handler_from_name_cache[name] = getattr(self,
                handler_name, None)
        handler = self._handler_from_name_cache[name]
        return handler or getattr(self._server, name)

