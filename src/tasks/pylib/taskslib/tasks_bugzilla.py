#!/usr/bin/env python
# Copyright (c) 2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""Bugzilla support for taskslib."""

import sys
import xmlrpclib
from posixpath import join as urljoin
from urlparse import urlsplit, urlunsplit
from urllib import splituser, urlencode
from urllib import quote as urlquote
import socket
from pprint import pprint
import logging

try:
    import httplib2
except ImportError:
    # See if we are in source tree layout. If so, make it work.
    from os.path import join, abspath, dirname, exists
    _externals_lib_dir = join(dirname(dirname(dirname(abspath(__file__)))),
        "externals", "lib")
    if exists(_externals_lib_dir):
        sys.path.insert(0, _externals_lib_dir)
    import httplib2

from taskslib import repository, errors, core, utils



log = logging.getLogger("tasks")



class BugzillaRepository(repository.Repository):
    """A Bugzilla task repository."""
    type = "bugzilla"
    
    def verify(self):
        #TODO: will probably just want `mgr.get_http` instead.
        #    Yes. Also use the FileCache fix that I have in activesso.
        http = httplib2.Http(self.mgr.get_cache_dir("http"))
        
        # First do a HEAD check on the base URL.
        #TODO: proxy settings
        log.info("Attempting to connect to `%s'...", self.base_url)
        try:
            response, content = http.request(self.base_url, method="HEAD")
        except socket.error, ex:
            if ex.errno == 61: # Connection refused
                raise errors.TasksSocketError(ex, self.base_url)
            raise
        if response["status"] != "200":   #TODO: allow others status codes?
            raise errors.RepositoryVerifyError(
                "couldn't connect to `%s': HTTP HEAD status %s" % (
                self.base_url, response["status"]))

        XXX  # differences for Bugzilla here
        # Try base XML-RPC url.
        log.info("Verifying login and XML-RPC plugin...")
        url = urljoin(self.base_url, "login/xmlrpc")
        http.add_credentials(self.username, self.password)
        response, content = http.request(url)
        status = response["status"]
        if status == "401":
            raise errors.RepositoryVerifyError(
                "couldn't connect to `%s' (HTTP %s): Authorization failed" % (
                url, status))
        elif status == "403":
            raise errors.RepositoryVerifyError(
                "couldn't connect to `%s' (HTTP %s Forbidden): This "
                "generally means that your user does not have the "
                "necessary 'XML_RPC' privileges. Please request the "
                "administrator of `%s' give you (username `%s') "
                "`XML_RPC' privileges." % (
                url, status, self.base_url, self.username))
        elif status == "404":
            raise errors.RepositoryVerifyError(
                "couldn't connect to `%s' (HTTP %s): This generally "
                "means that this Trac installation is not running the "
                "XML-RPC plugin (http://trac-hacks.org/wiki/XmlRpcPlugin). "
                "This Trac connector requires the XML-RPC API to work with "
                "the Trac installation. Please request the administrator "
                "of `%s' add the XML-RPC plugin." % (
                url, status, self.base_url))
        elif status != "200":
            raise errors.RepositoryVerifyError(
                "couldn't connect to `%s' (HTTP %s)" % (url, status))
        
        # Ensure the Trac XML-RPC API version is one we know we support.
        log.info("Verifying sufficient Trac XML-RPC plugin API version...")
        try:
            api_version = self.xmlrpc_server.system.getAPIVersion()
        except socket.error, ex:
            if ex.errno == 61: # Connection refused
                raise errors.TasksSocketError(ex, self.base_url)
            raise
        if api_version < [1,0,0]:
            try:
                s = '.'.join(str(d) for d in api_version)
            except:
                s = api_version
            raise errors.RepositoryVerifyError(
                "Trac XML-RPC plugin version for `%s' is < 1.0.0: %s. "
                "This Trac connector isn't verified to work with Trac "
                "XML-RPC plugin API version < 1.0.0." % (
                self.base_url, s))

    #See i.as.com/thesite/apps/iactivestate/bugzillalib.py
    @property
    def xmlrpc_server(self):
        return xmlrpclib.ServerProxy(
            self.xmlrpc_url,
            use_datetime=True,
            #verbose=True
        )

    _xmlrpc_url_cache = None
    @property
    def xmlrpc_url(self):
        if self._xmlrpc_url_cache is None:
            scheme, netloc, path, query, _ = urlsplit(self.base_url)
            _, netloc = splituser(netloc)
            netloc = "%s:%s@%s" % (urlquote(self.username),
                                   urlquote(self.password),
                                   netloc)
            path = urljoin(path, "xmlrpc.cgi")
            self._xmlrpc_url_cache = urlunsplit((scheme, netloc, path, query, ""))
        return self._xmlrpc_url_cache

    def hook_task_ids_from_query(self, query):
        XXX
    def hook_tasks_from_ids(self, ids):
        XXX
        fetched_tasks = []
        server = self.xmlrpc_server
        multicall = xmlrpclib.MultiCall(server)
        for id in ids:
            multicall.ticket.get(id)
        for t in multicall():
            (id, time_created, time_changed, data) = t
            summary = data["summary"]
            del data["summary"]
            description = data["description"]
            del data["description"]
            task = core.Task(id, summary, description, data)
            fetched_tasks.append(task)
        return fetched_tasks

    def hook_task_fields(self):
        XXX

    def hook_add_task(self, data):
        XXX

    def hook_query_help_text(self):
        """Return help text for specifying query conditions for this repo."""
        return utils.dedent("""
        XXX
        """)

def register(mgr):
    """Register this taskslib module.
    
    @param mgr {taskslib.core.Manager}
    """
    mgr.register_repo_class(BugzillaRepository)
