#! /usr/bin/env python
##############################################################################
#
# Copyright (c) 2002, 2003 Zope Corporation and Contributors.
# All Rights Reserved.
#
# This software is subject to the provisions of the Zope Public License,
# Version 2.1 (ZPL).  A copy of the ZPL should accompany this distribution.
# THIS SOFTWARE IS PROVIDED "AS IS" AND ANY AND ALL EXPRESS OR IMPLIED
# WARRANTIES ARE DISCLAIMED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
# WARRANTIES OF TITLE, MERCHANTABILITY, AGAINST INFRINGEMENT, AND FITNESS
# FOR A PARTICULAR PURPOSE.
#
##############################################################################
"""Script to run all the regression tests for zpkgtools."""

import os
import sys
import unittest

if __name__ == "__main__":
    __file__ = sys.argv[0]

TESTDIR = os.path.dirname(os.path.abspath(__file__))

PKGDIR = os.path.dirname(TESTDIR) # the package directory
TOPDIR = os.path.dirname(PKGDIR)


def load_tests(name):
    __import__(name)
    mod = sys.modules[name]
    return mod.test_suite()


def make_directory_suite(pkgname, testdir):
    L = []
    for fn in os.listdir(testdir):
        name, ext = os.path.splitext(fn)
        if name[:4] == "test" and ext == ".py":
            L.append(load_tests("%s.%s" % (pkgname, name)))
    suite = L.pop()
    for t in L:
        suite.addTest(t)
    return suite


def test_suite():
    return make_directory_suite("zpkgsetup.tests", TESTDIR)


class MyTestProgram(unittest.TestProgram):
    """Test runner program that doesn't use docstrings as descriptions."""

    def runTests(self):
        if self.testRunner is None:
            self.testRunner = unittest.TextTestRunner(descriptions=False,
                                                      verbosity=self.verbosity)
        unittest.TestProgram.runTests(self)


if __name__ == "__main__":
    if TOPDIR not in sys.path:
        sys.path.insert(0, TOPDIR)
    MyTestProgram(defaultTest="test_suite")
