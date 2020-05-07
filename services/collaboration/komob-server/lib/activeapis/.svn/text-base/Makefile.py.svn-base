
"""Makefile for the activeapis project.

${common_task_list}

See `mk -h' for options.
"""

import sys
import os
from os.path import join, dirname, normpath, abspath, exists, basename
import re
import webbrowser
from pprint import pprint, pformat
import datetime

from mklib.common import MkError
from mklib import Task
from mklib import sh


class play(Task):
    def make(self):
        self._firefly()
    
    def _firefly(self):
        import xmlrpclib
        server = xmlrpclib.ServerProxy(
            "http://webops_firefly:t0m4t0@wst.activestate.com/login/xmlrpc",
            verbose=True,
            )
        print server.system.listMethods()
    
    def _urlparse(self):
        import urlparse
        url = "http://fred@wst.activestate.com:80/login/xmlrpc"
        user = "bob"
        password = "sekrit"
        parts = list(urlparse.urlsplit(url))
        netloc = parts[1]
        if "@" in netloc:
            netloc = netloc.split("@", 1)[1]
        parts[1] = "%s:%s@%s" % (user, password, netloc)
        print urlparse.urlunsplit(parts)
        
    
    def _http_head(self):
        sys.path.insert(0, join(self.dir, "externals", "lib"))
        import httplib2
        http = httplib2.Http(timeout=1)
        url = "http://mower.local:8001/api/"
        response, content = http.request(url, "HEAD")
        print response
        print
        print content

class release_sdist(Task):
    """Release an sdist package to ActiveState's python package repo."""
    def make(self):
        dist_dir = join(self.dir, "dist")
        if exists(dist_dir):
            sh.rm(dist_dir, log=self.log)
        sh.run_in_dir('python setup.py egg_info -RDb "" sdist', self.dir)
        sh.run_in_dir('cp -i dist/activeapis2-* /net/nas/data/languages/python/packages/activeapis2',
            self.dir, logstream=self.log.info)

class usedevsites(Task):
    """Set env vars to use local dev servers of some of the sites (if they
    are available).
    
    Typically "some" here is the Django sites that Trent's written
    because he knows how to easily run a local dev copy.
    """
    def make(self):
        import socket
        hostname = socket.gethostname()
        to_set = {
            "ACCOUNT_API_URL": "http://%s:8006/api/" % hostname,
            "NOTIFICATIONS_API_URL": "http://%s:8004/api/" % hostname,
            "CODE_API_URL": "http://%s:8002/api/" % hostname,
        }
        for envvar, url in to_set.items():
            if _server_exists(url):
                self.log.debug("set %s=%s", envvar, url)
                os.environ[envvar] = url


class usestagingsites(Task):
    """Set env vars to use dev/staging sites (typically on *.as-beta.com)."""
    def make(self):
        to_set = {
            "ACCOUNT_API_URL": "https://account.as-beta.com/api/",
            "NOTIFICATIONS_API_URL": "http://notifications.as-beta.com/api/",
            "STORE_API_URL": "http://store.as-beta.com/as/api/",
            "LIME_API_URL": "http://lime.as-beta.com/",
            "CODE_API_URL": "http://code.as-beta.com/api/",
            "FIREFLY_API_URL": "http://wst.activestate.com/login/xmlrpc",
        }
        for envvar, url in to_set.items():
            if _server_exists(url):
                self.log.debug("set %s=%s", envvar, url)
                os.environ[envvar] = url

class test(Task):
    """Run all tests (except known failures)."""
    test_tags = []
    
    def make(self):
        for ver, python in self._gen_pythons():
            if ver <= (2,3):
                # Don't support Python <= 2.3.
                continue
            elif ver >= (3, 0):
                # Don't yet support Python 3.
                continue
            ver_str = "%s.%s" % ver
            print "-- test with Python %s (%s)" % (ver_str, python)
            assert ' ' not in python
            sh.run_in_dir("%s test.py %s" % (python, ' '.join(self.test_tags)),
                       join(self.dir, "test"))

    def _python_ver_from_python(self, python):
        assert ' ' not in python
        o = os.popen('''%s -c "import sys; print(sys.version)"''' % python)
        ver_str = o.read().strip()
        ver_bits = re.split("\.|[^\d]", ver_str, 2)[:2]
        ver = tuple(map(int, ver_bits))
        return ver

    def _gen_pythons(self):
        sys.path.insert(0, join(self.dir, "externals", "which"))
        import which
        python_from_ver = {}
        for python in which.whichall("python"):
            ver = self._python_ver_from_python(python)
            if ver not in python_from_ver:
                python_from_ver[ver] = python
        for ver, python in sorted(python_from_ver.items()):
            yield ver, python

class testbasic(test):
    test_tags = ["basic"]
class testaccountapi(test):
    test_tags = ["accountapi"]
class testcodeapi(test):
    test_tags = ["codeapi"]
class testlimeapi(test):
    test_tags = ["limeapi"]
class teststoreapi(test):
    test_tags = ["storeapi"]
class testfireflyapi(test):
    test_tags = ["fireflyapi"]



#---- internal support stuff

def _server_exists(url):
    import socket
    try:
        import httplib2
    except ImportError:
        sys.path.insert(0, join(dirname(__file__), "externals", "lib"))
        import httplib2
    http = httplib2.Http(timeout=1)
    try:
        response, content = http.request(url, "HEAD")
    except socket.error:
        return False
    else:
        return True
