#!/usr/bin/env python

from os.path import abspath, dirname, join, normpath
import sys
import unittest
from pprint import pprint

# Hackery to setup the path
sys.path.append(join(dirname(                        # src
                      dirname(                        # modules
                       dirname(                        # mercurial
                        dirname(abspath(__file__))))),  #pylib
                      "python-sitelib"))
print sys.path[-1]
import hglib

class MercurialTest(hglib.HG):
    def __init__(self, stdout='', stderr=''):
        hglib.HG.__init__(self)
        self.__stdout = stdout
        self.__stderr = stderr

    def _runCommand(self, argv, cwd=None, env=None, input=None):
        return self.__stdout, self.__stderr

class test_hglib(unittest.TestCase):
    def test_status(self):
        output = """M README
R CONTRIBUTORS
! COPYING
? file.txt
C something
C tests/test-status
"""
        hg = MercurialTest(output)
        cwd = normpath("/foo")
        result = hg.status(cwd=cwd)

        stdout = result.get('stdout')
        self.assertEqual(stdout, output, "Unpected stdout: %r" % (stdout, ))
        stderr = result.get('stderr')
        self.assertEqual(stderr, '', "Unpected stderr: %r" % (stderr, ))
        #pprint(result)
        files = result.get('files', {})
        self.assertEqual(len(files), len(output.splitlines()), "Incorrect number of files: %r" % (len(files), ))
        for path, expected_status in {
                            normpath(join(cwd, 'file.txt')): '?',
                            normpath(join(cwd, 'CONTRIBUTORS')): 'R',
                            normpath(join(cwd, 'README')): 'M',
                            normpath(join(cwd, 'COPYING')): '!',
                            normpath(join(cwd, 'something')): 'C',
                            normpath(join(cwd, 'tests/test-status')): 'C',
                    }.items():
            self.assertTrue(path in files, "File was not found: %r" % (path, ))
            status = files[path]['status']
            self.assertEqual(status, expected_status, "File %r has incorrect status: %r" % (path, status, ))

    def test_log(self):
        output = """changeset:   42:10a277e6ceae
parent:      41:31e5c82a4859
parent:      40:37e6d5d8913a
user:        Field Sample <field@sample.com>
date:        Mon Jan 14 11:21:22 2008 +0100
files:       contrib/favicon.ico contrib/image1.png doc/starter.html doc/starter.txt foo.txt foo.cgi fields/set1/item1.py
description:
Second commit message.


changeset:   39:20a277e6ceae
user:        Some Dude <dude@localhost.localdomain>
date:        Mon Jan 13 11:01:22 2008 +0100
files:       foo.txt foo.cgi
description:
First commit message.
Second line of the first commit message.

"""
        hg = MercurialTest(output)
        result = hg.log(None)

        stdout = result.get('stdout')
        self.assertEqual(stdout, output, "Unexpected stdout: %r" % (stdout, ))
        stderr = result.get('stderr')
        self.assertEqual(stderr, '', "Unexpected stderr: %r" % (stderr, ))
        #pprint(result)
        log_items = result.get('log', {})
        self.assertEqual(len(log_items), 2, "Incorrect number of files: %r" % (len(log_items), ))

        self.assertEqual(log_items[0]['revision'], "42", "Incorrect revision: %r" % (log_items[0]['revision'], ))
        self.assertEqual(log_items[0]['author'], "Field Sample <field@sample.com>", "Incorrect author: %r" % (log_items[0]['author'], ))
        self.assertEqual(log_items[0]['date'], "Mon Jan 14 11:21:22 2008 +0100", "Incorrect date: %r" % (log_items[0]['date'], ))
        self.assertEqual(log_items[0]['message'], "Second commit message.", "Incorrect message: %r" % (log_items[0]['message'], ))

        self.assertEqual(log_items[1]['revision'], "39", "Incorrect revision: %r" % (log_items[1]['revision'], ))
        self.assertEqual(log_items[1]['author'], "Some Dude <dude@localhost.localdomain>", "Incorrect author: %r" % (log_items[1]['author'], ))
        self.assertEqual(log_items[1]['date'], "Mon Jan 13 11:01:22 2008 +0100", "Incorrect date: %r" % (log_items[1]['date'], ))
        self.assertEqual(log_items[1]['message'], "First commit message.\nSecond line of the first commit message.", "Incorrect message: %r" % (log_items[1]['message'], ))

if __name__ == '__main__':
    unittest.main()
