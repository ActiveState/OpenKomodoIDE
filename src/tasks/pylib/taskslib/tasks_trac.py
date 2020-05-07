#!/usr/bin/env python
# Copyright (c) 2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""Trac support for taskslib."""
#TODO:XXX Factor TracQuery out of core.py::Query

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



class TracRepository(repository.Repository):
    """A Trac task repository."""
    type = "trac"
    
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
            path = urljoin(path, "login/xmlrpc")
            self._xmlrpc_url_cache = urlunsplit((scheme, netloc, path, query, ""))
        return self._xmlrpc_url_cache

    def hook_task_ids_from_query(self, query):
        conds = []

        # Paging.
        # Currently we'll just get all results in one page (max=0).
        # If huge data sets are a problem we can come back and add paging
        # later.
        for c in query.conds:
            if c.startswith("page=") or c.startswith("max="):
                continue
            conds.append(c)
        conds.append("max=0")

        #TODO: quoting correct. Try test with '=', '|' and '&' in query values
        #     conds = ['summary=~%3D']
        q = '&'.join(conds)
        try:
            return self.xmlrpc_server.ticket.query(q)
        except socket.error, ex:
            if ex.errno == 61: # Connection refused
                raise errors.TasksSocketError(ex, self.base_url)
            raise

    def hook_tasks_from_ids(self, ids):
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
        #TODO: the "notify" boolean option for creating a Trac ticket:
        #   add a task field for this?
        fields = []
        for d in self.xmlrpc_server.ticket.getTicketFields():
            name = d["name"]
            default = d.get("value", None)
            is_required = not d.get("optional", False)
            options = d.get("options", None)
            
            # Overrides, i.e. translate what Trac says about these fields
            # into data meaningful to how we'll use it for displaying a
            # UI to create new tasks.
            if name == "owner":
                # Though Trac says the "owner" field is required, excluding
                # it results in a new ticket being owned by the default
                # component owner (a good thing).
                is_required = False
            if name == "reporter":
                # Skip reporter. It defaults to the auth'd user adding a
                # ticket, which is what we always want.
                continue
            if name == "status":
                # Skip status. It defaults to "new", which is what we
                # always want. Might *possibly* want the ability to set
                # other status values (e.g. "accepted") as an advanced
                # feature, but not necessary now.
                continue
            if name == "resolution":
                # Skip resolution. We're not allowing a "status" other than
                # new, so choosing a resolution is unnecessary.
                continue
            if name in ("keywords", "cc"):
                # Empty values for "keywords" and "cc" is just fine. I don't
                # know why the Trac API says otherwise.
                is_required = False
            if name == "component" and default == "":
                # An empty-string default here results in tickets with no
                # component value set. Don't want that.
                default = None
            if default is not None and options and default not in options:
                # This is the case for "milestone" and "version": an empty
                # string default is given, but that isn't one of the
                # allowed values.
                default = None
            
            field = core.TaskField(
                name=name,
                label=d["label"],
                is_required=is_required,
                type=d["type"],
                options=options,
                default=default)
            fields.append(field)
        return fields

    def hook_add_task(self, data):
        fields = self.task_fields()
        template = dict((f.name, f.default) for f in fields if f.default)
        
        # Gather and validate the data.
        if "reporter" in data:
            # We disallow this because it defaults to the auth'd API user
            # and that is what we always want.
            raise errors.TasksError("cannot specify 'reporter' when creating a Trac ticket")
        if "notify" in data:
            notify = data["notify"]
            del attributes["notify"]
        else:
            notify = True
        attributes = template.copy()
        attributes.update(data)
        missing_fields = [f.name for f in fields if f.is_required
            and f.name not in attributes]
        if missing_fields:
            raise errors.TasksError("error adding task: missing fields: '%s'"
                % "', '".join(missing_fields))
        for field in fields:
            if (field.name in attributes and field.options
                    and attributes[field.name] not in field.options):
                raise errors.TasksError("error adding task: '%s' value is "
                    "invalid: %r (must be one of '%s')" % (field.name,
                    attributes[field.name], "', '".join(field.options)))
        summary = attributes["summary"]
        del attributes["summary"]
        description = attributes["description"]
        del attributes["description"]

        id = self.xmlrpc_server.ticket.create(summary, description,
            attributes, notify)
        return core.Task(id, summary, description, attributes)

    def hook_query_help_text(self):
        """Return help text for specifying query conditions for this repo.
        
        Note: There are deeper details in the Query/TracQuery docstring. Some
        of that might fit in here once it is better understood.
        """
        return utils.dedent("""
        A query condition is of the following form:
            
            field=values    # is
            field=!values   # is not
            field=~values   # contains
            field=!~values  # doesn't contain
            field=^values   # startswith
            field=$values   # endswith
        
        where multiple "values" are separated by '|'. For example:
        
            summary=~foo            # "foo" is in the task summary
            component=compa|compb   # tasks in either component "compa" or "compb"
            owner=$USER             # "$USER" is a special string that expands
                                    # to your username
        
        Fields are: 'summary', 'description', 'component', 'type',
        'priority', 'owner', 'reporter', 'status', 'milestone', 'version',
        'keywords' and 'cc'.
        """)

def register(mgr):
    """Register this taskslib module.
    
    @param mgr {taskslib.core.Manager}
    """
    mgr.register_repo_class(TracRepository)
