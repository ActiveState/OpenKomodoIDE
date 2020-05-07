#!/usr/bin/env python

# Copyright (c) 2008 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

from os.path import abspath, dirname, join, normpath
import sys
import unittest
from pprint import pprint

# Hackery to setup the path
sys.path.append(join(dirname(                        # src
                      dirname(                        # modules
                       dirname(                        # bzr
                        dirname(abspath(__file__))))),  #pylib
                      "python-sitelib"))
print sys.path[-1]
import koBzrlib

class BzrTest(koBzrlib.Bzr):
    def __init__(self, stdout_commands=None, stderr=''):
        koBzrlib.Bzr.__init__(self)
        if stdout_commands is None:
            stdout_commands = {}
        self.__stdout_cmds = stdout_commands
        self.__stderr = stderr

    def _runCommand(self, argv, cwd=None, env=None, input=None):
        stdout = self.__stdout_cmds.get(argv[1], '')
        return stdout, self.__stderr

class test_koBzrlib(unittest.TestCase):
    def test_status(self):
        output = {"status": """ D  COPYING.txt
 M  README
-D  TODO
+N  added.txt
?   newfile.txt
""",
        }
        cwd = '/Foo'
        bzr = BzrTest(output)
        result = bzr.status(cwd=cwd)

        stdout = result.get('stdout')
        self.assertEqual(stdout, output.get('status'), "Unpected stdout: %r" % (stdout, ))
        stderr = result.get('stderr')
        self.assertEqual(stderr, '', "Unpected stderr: %r" % (stderr, ))
        #pprint(result)
        files = result.get('files', {})
        self.assertEqual(len(files), len(output['status'].splitlines()), "Incorrect number of files: %r" % (len(files), ))
        for path, (expected_status_flags, expected_status) in {
                            normpath(join(cwd, 'COPYING.txt')): (' ', 'D'),
                            normpath(join(cwd, 'README')): (' ', 'M'),
                            normpath(join(cwd, 'TODO')): ('-', 'D'),
                            normpath(join(cwd, 'added.txt')): ('+', 'N'),
                            normpath(join(cwd, 'newfile.txt')): ('?', ' '),
                    }.items():
            self.assertTrue(path in files, "File was not found: %r" % (path, ))
            status = files[path]['status']
            self.assertEqual(status, expected_status, "File %r has incorrect status: %r" % (path, status, ))

    def test_statusEx(self):
        output = {"status": """ D  COPYING.txt
 M  README
-D  TODO
+N  added.txt
?   newfile.txt
""",
                  "ls": "",
        }
        bzr = BzrTest(output)
        cwd = '/Foo'
        result = bzr.statusEx(cwd=cwd)

        stdout = result.get('stdout')
        self.assertEqual(stdout, output.get('status'), "Unpected stdout: %r" % (stdout, ))
        stderr = result.get('stderr')
        self.assertEqual(stderr, '', "Unpected stderr: %r" % (stderr, ))
        #pprint(result)
        files = result.get('files', {})
        self.assertEqual(len(files), len(output.get('status').splitlines()), "Incorrect number of files: %r" % (len(files), ))
        for path, (expected_status_flags, expected_status) in {
                            normpath(join(cwd, 'COPYING.txt')): (' ', 'D'),
                            normpath(join(cwd, 'README')): (' ', 'M'),
                            normpath(join(cwd, 'TODO')): ('-', 'D'),
                            normpath(join(cwd, 'added.txt')): ('+', 'N'),
                            normpath(join(cwd, 'newfile.txt')): ('?', ' '),
                    }.items():
            self.assertTrue(path in files, "File was not found: %r" % (path, ))
            status = files[path]['status']
            self.assertEqual(status, expected_status, "File %r has incorrect status: %r" % (path, status, ))

    def test_log(self):
        output = """------------------------------------------------------------
revno: 487
committer: Field Sample <field@sample.com>
branch nick: testing
timestamp: Wed Aug 22 14:16:36 2007 +0200
message:
  Second commit message.
modified:
  Makefile
  NEWS
  README
  test.py
added:
  newfile.txt
------------------------------------------------------------
revno: 463
committer: Some Dude <dude@localhost.localdomain>
branch nick: testing
timestamp: Sat Jun 2 23:46:25 2007 +0200
message:
  First commit message.
  Second line of the first commit message.
modified:
  Makefile
"""
        bzr = BzrTest({'log': output})
        result = bzr.log(None)

        stdout = result.get('stdout')
        self.assertEqual(stdout, output, "Unexpected stdout: %r" % (stdout, ))
        stderr = result.get('stderr')
        self.assertEqual(stderr, '', "Unexpected stderr: %r" % (stderr, ))
        pprint(result)
        log_items = result.get('log', {})
        self.assertEqual(len(log_items), 2, "Incorrect number of files: %r" % (len(log_items), ))

        self.assertEqual(log_items[0]['revision'], "487", "Incorrect revision: %r" % (log_items[0]['revision'], ))
        self.assertEqual(log_items[0]['author'], "Field Sample <field@sample.com>", "Incorrect author: %r" % (log_items[0]['author'], ))
        self.assertEqual(log_items[0]['date'], "Wed Aug 22 14:16:36 2007 +0200", "Incorrect date: %r" % (log_items[0]['date'], ))
        self.assertEqual(log_items[0]['message'], "Second commit message.\n", "Incorrect message: %r" % (log_items[0]['message'], ))

        self.assertEqual(log_items[1]['revision'], "463", "Incorrect revision: %r" % (log_items[1]['revision'], ))
        self.assertEqual(log_items[1]['author'], "Some Dude <dude@localhost.localdomain>", "Incorrect author: %r" % (log_items[1]['author'], ))
        self.assertEqual(log_items[1]['date'], "Sat Jun 2 23:46:25 2007 +0200", "Incorrect date: %r" % (log_items[1]['date'], ))
        self.assertEqual(log_items[1]['message'], "First commit message.\nSecond line of the first commit message.\n", "Incorrect message: %r" % (log_items[1]['message'], ))

if __name__ == '__main__':
    unittest.main()
