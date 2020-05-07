
"""Makefile for the working on Komodo's tasks feature.

${common_task_list}

See `mk -h' for options.
"""

import sys
import os
from os.path import join, dirname, normpath, abspath, exists, basename
import re
import datetime

from mklib.common import MkError
from mklib import Task
from mklib.configuration import Configuration
from mklib import sh
import mklib.utils


#---- globals and config


class cfg(Configuration):
    prefix = "tasks"


#---- tasks


class trac_start(Task):
    """Start test trac server."""
    def make(self):
        projdir = self.cfg.trac_projdir
        projname = basename(projdir)
        if sys.platform == "darwin":
            # This is where `Subversion-.dmg` for Collabnet installs
            # svn python bindings.
            os.environ["PYTHONPATH"] = "/opt/subversion/lib/svn-python"
        sh.run("tracd -r -p %s --basic-auth=%s,%s/.htpasswd,%s %s"
                % (self.cfg.trac_port, projname, projdir, projdir, projdir),
            self.log.info)

class tsk(Task):
    """Put tsk.py through its paces."""
    def tsk(self, cmd):
        tsk_py = join(self.dir, "bin", "tsk.py")
        sh.run_in_dir("python2.6 %s %s" % (tsk_py, cmd), self.dir)
    def make(self):
        #TODO:XXX doesn't this hang asking for passwd?
        self.tsk("addrepo trac http://127.0.0.1:%s/%s -u activetest"
            % (self.cfg.trac_port, basename(self.cfg.trac_projdir)))

class trac_play(Task):
    """Play with the XML-RPC interface to the test trac server."""
    def make(self):
        import xmlrpclib
        server = xmlrpclib.ServerProxy(
            "http://activetest:activetest@localhost:8001/myproject/login/xmlrpc",
            use_datetime=True,
            #verbose=True
        )
        
        #TODO: learn multicall stuff: http://trac-hacks.org/wiki/XmlRpcPlugin 

        #since = datetime.datetime(2009, 1, 1)
        #self.recent_changes(server, since)

        multicall = xmlrpclib.MultiCall(server) 
        for method in server.system.listMethods(): 
            multicall.system.methodHelp(method) 
                 
        for help in multicall(): 
            lines = help.splitlines() 
            print lines[0] 
            #print '\n'.join(['  ' + x for x in lines[2:]]) 
            #print 

        #print server.search.getSearchFilters()
        ids = server.ticket.query("status=!closed")
        # get: id, time_created, time_changed, values
        #print server.ticket.get(id)
        multicall = xmlrpclib.MultiCall(server)
        for id in ids:
            multicall.ticket.get(id)
        for t in multicall():
            print t

    def recent_changes(self, server, since):
        for id in server.ticket.getRecentChanges(since):
            print "-- ticket %d" % id
            id_, time_created, time_changed, attributes = server.ticket.get(id)
            print "  time_created: %s" % time_created
            print "  time_changed: %s" % time_changed
            print "    attributes: %r" % attributes

    def list_methods(self, server):
        for method in server.system.listMethods(): 
            print '--', method 
            print '\n'.join(['  ' + x for x in server.system.methodHelp(method).split('\n')]) 
            print

class test(Task):
    """Run all tests (except known failures)."""
    def make(self):
        for ver, python in self._gen_pythons():
            if ver < (2,6):
                # Don't support Python < 2.6.
                continue
            elif ver >= (3,0):
                # Don't (yet) support Python 3.
                continue
            ver_str = "%s.%s" % ver
            print "-- test with Python %s (%s)" % (ver_str, python)
            assert ' ' not in python
            sh.run_in_dir("%s test.py" % python, join(self.dir, "test"))
            break #XXX just test with one Python ver for now

    def _python_ver_from_python(self, python):
        assert ' ' not in python
        o = os.popen('''%s -c "import sys; print(sys.version)"''' % python)
        ver_str = o.read().strip()
        ver_bits = re.split("\.|[^\d]", ver_str, 2)[:2]
        ver = tuple(map(int, ver_bits))
        return ver

    def _gen_python_names(self):
        yield "python"
        for ver in [(2,3), (2,4), (2,5), (2,6), (2,7), (3,0), (3,1)]:
            yield "python%d.%d" % ver

    def _gen_pythons(self):
        import which  # get it from http://trentm.com/projects/which
        python_from_ver = {}
        for name in self._gen_python_names():
            for python in which.whichall(name):
                ver = self._python_ver_from_python(python)
                if ver not in python_from_ver:
                    python_from_ver[ver] = python
        for ver, python in sorted(python_from_ver.items()):
            yield ver, python

class todo(Task):
    """Print out todo's and xxx's in the docs area."""
    def make(self):
        for path in mklib.utils.paths_from_path_patterns(['.'],
                excludes=[".svn", "*.pyc", "TO""DO.txt", "Makefile.py",
                          "*.png", "*.gif", "*.pprint", "*.prof",
                          "tmp-*"]):
            self._dump_pattern_in_path("TO\DO\\|XX\X", path)

        path = join(self.dir, "TO""DO.txt")
        if exists(path):
            todos = re.compile("^- ", re.M).findall(open(path, 'r').read())
            print "(plus %d TODOs from TO""DO.txt)" % len(todos)

    def _dump_pattern_in_path(self, pattern, path):
        os.system("grep -nH '%s' '%s'" % (pattern, path))




#---- internal support stuff

