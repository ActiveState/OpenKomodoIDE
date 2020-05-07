#!/usr/bin/env python

"""An interface to Trac's XMLRPC API.

Usage:
XXX

Trac's XML-RPC interface is an *optional* part of a Trac installation.

    http://trac-hacks.org/wiki/XmlRpcPlugin

As well there are a couple patches to it floating around: one required for
Mylyn integration in Eclipse and another one required for NetBeans trac
integration. TODO: provide pointers to and details on those.
"""
# Dev Notes:
# - API method list here: http://vm-ubuntu80-trentm.activestate.com/login/xmlrpc

__version_info__ = (1, 0, 0)
__version__ = '.'.join(map(str, __version_info__))

import os
from os.path import expanduser
import sys
from urlparse import urljoin
import xmlrpclib
import logging
import getpass
import urlparse
from pprint import pprint

#import httplib2



#---- globals

log = logging.getLogger("traclib")



#---- exceptions

class TracError(Exception):
    pass



#---- public iface

class RawTrac(xmlrpclib.ServerProxy):
    def __init__(self, base_url, username=None, password=None):
        self.base_url = base_url
        self.username = username
        self.password = password
        
        url = self.url = urljoin(base_url, "xmlrpc")
        #scheme, netloc, path, params, query, fragment = urlparse(url)
        parts = urlparse.urlsplit(url)
        XXX # Put in username/password
        
        
        kwargs = {}
        if sys.version_info[:2] >= (2,5):
            kwargs["use_datetime"] = True
        xmlrpclib.ServerProxy.__init__(self, self.url, **kwargs)

    #XXX Want to do any of this in the raw interface?
    #def bugzilla_version(self):
    #    return self.rpc.Bugzilla.version()
    #def bugzilla_extensions(self):
    #    return self.rpc.Bugzilla.extensions()
    #def bugzilla_timezone(self):
    #    return self.rpc.Bugzilla.timezone()

#TODO: ActiveStateTrac: uses httplib2, cookies, and http*s*://login.as.com to
# have more secure login (don't put password in the clear).



#---- internal support stuff



#---- mainline

def _test():
    username = getpass.getuser() + "@activestate.com"
    password = getpass.getpass("%s's ActiveState password:" % username)
    t = RawTrac("http://vm-ubuntu80-trentm.activestate.com/",
                username, password)
    print t.server.getAPIVersion()
    





if __name__ == "__main__":
    _test()
