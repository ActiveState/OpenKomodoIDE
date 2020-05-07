#!/usr/bin/env python

# Copyright (c) 2008 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
from os.path import abspath, dirname, join, normpath, split, exists
from pprint import pprint
import shutil
import sys
import tempfile
import unittest

# Hackery to setup the path
srcroot = dirname(                            # (komodo tree root)
           dirname(                           # src
            dirname(                          # modules
             dirname(                         # git
              dirname(abspath(__file__))))))  #pylib
if sys.platform.startswith("win"):
    # needed for winprocess.py
    sys.path.append(join(srcroot, "contrib", "smallstuff"))
sys.path.append(join(srcroot, "src", "python-sitelib"))
print sys.path[-1]
import gitlib

class GITTest(gitlib.GIT):
    def __init__(self, stdout='', stderr=''):
        gitlib.GIT.__init__(self)
        self.__stdout = stdout
        self.__stderr = stderr

    def _runCommand(self, argv, cwd=None, env=None, input=None):
        return self.__stdout, self.__stderr

class test_gitlib(unittest.TestCase):
    def test_status(self):
        data = {"test.py":             "??",
                ".gitignore":          None,
                "COPYING":             None,
                "Makefile.am":         None,
                "NEWS":                None,
                "python/__init__.py":  None,
                "python/config.py.in": None,
                "src/Makefile.am":     None,
                "tests/test-dom.py":   None,
                "maint-helper.py":     " M",
                "python/webview.py":   " M",
               }
        repobase = tempfile.mkdtemp()
        try:
            for name in data.keys():
                abspath = join(repobase, *name.split("/"))
                parent = split(abspath)[0]
                if not exists(parent):
                    os.makedirs(parent)
                with open(abspath, "w") as f:
                    f.write(".")

            output = "\n".join("%s %s" % (v, k) for k,v in data.items() if v is not None)
            git = GITTest(output)
            result = git.status(repobasedir=repobase, cwd=repobase, recursive=True)

            stdout = result.get('stdout')
            self.assertEqual(stdout, output, "Unexpected stdout: %r" % (stdout, ))
            stderr = result.get('stderr')
            self.assertEqual(stderr, '', "Unexpected stderr: %r" % (stderr, ))
            pprint(result)
            files = result.get('files', {})
            self.assertEqual(len(files), len(data), "Incorrect number of files: %r" % (len(files), ))
            for path, expected_status in {
                                normpath(join(repobase, 'test.py')): '?',
                                normpath(join(repobase, 'COPYING')): 'H',
                                normpath(join(repobase, 'python/webview.py')): 'C',
                        }.items():
                self.assertTrue(path in files, "File was not found: %r" % (path, ))
                status = files[path]['status']
                self.assertEqual(status, expected_status, "File %r has incorrect status: %r" % (path, status, ))
        finally:
            shutil.rmtree(repobase)

    def test_log(self):
        output = """commit 56d544008f774f9b9f2f7cd859f0ff42eeddccbb
Author: Field Sample <field@sample.com>
Date:   Wed Aug 22 14:16:36 2007 +0200

    Second commit message.


commit 56d544008f774f9b9f2f7cd859f0ff42eeddccaa
Author: Some Dude <dude@localhost.localdomain>
Date:   Sat Jun 2 23:46:25 2007 +0200

    First commit message.
    Second line of the first commit message.
"""
        git = GITTest(output)
        result = git.log(None)

        stdout = result.get('stdout')
        self.assertEqual(stdout, output, "Unexpected stdout: %r" % (stdout, ))
        stderr = result.get('stderr')
        self.assertEqual(stderr, '', "Unexpected stderr: %r" % (stderr, ))
        #pprint(result)
        log_items = result.get('log', {})
        self.assertEqual(len(log_items), 2, "Incorrect number of files: %r" % (len(log_items), ))

        self.assertEqual(log_items[0]['revision'], "56d544008f774f9b9f2f7cd859f0ff42eeddccbb", "Incorrect revision: %r" % (log_items[0]['revision'], ))
        self.assertEqual(log_items[0]['author'], "Field Sample <field@sample.com>", "Incorrect author: %r" % (log_items[0]['author'], ))
        self.assertEqual(log_items[0]['date'], "Wed Aug 22 14:16:36 2007 +0200", "Incorrect date: %r" % (log_items[0]['date'], ))
        self.assertEqual(log_items[0]['message'], "Second commit message.\n", "Incorrect message: %r" % (log_items[0]['message'], ))

        self.assertEqual(log_items[1]['revision'], "56d544008f774f9b9f2f7cd859f0ff42eeddccaa", "Incorrect revision: %r" % (log_items[1]['revision'], ))
        self.assertEqual(log_items[1]['author'], "Some Dude <dude@localhost.localdomain>", "Incorrect author: %r" % (log_items[1]['author'], ))
        self.assertEqual(log_items[1]['date'], "Sat Jun 2 23:46:25 2007 +0200", "Incorrect date: %r" % (log_items[1]['date'], ))
        self.assertEqual(log_items[1]['message'], "First commit message.\nSecond line of the first commit message.\n", "Incorrect message: %r" % (log_items[1]['message'], ))

if __name__ == '__main__':
    import logging
    logging.basicConfig()
    unittest.main()
