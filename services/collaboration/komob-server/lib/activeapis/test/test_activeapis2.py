#!/usr/bin/env python

"""Test the activeapis2 Python package."""

import os
import sys
from os.path import join, dirname, abspath, exists, splitext, basename
import re
from glob import glob
from pprint import pprint
import unittest
import codecs
import difflib
import doctest

from testlib import TestError, TestSkipped, tag



class DocTestsTestCase(unittest.TestCase):
    def _runDocFileTest(self, path):
        test = doctest.DocFileTest(path)
        test.runTest()
    
    def generate_tests(cls):
        """Add test methods to this class for each `*.doctests` file.
        """
        pat = join(dirname(__file__), "*.doctests")
        for path in glob(pat):
            test_func = lambda self, p=path: \
                self._runDocFileTest(p)

            name = splitext(basename(path))[0]
            name = name.replace(' - ', '_')
            name = name.replace(' ', '_')
            name = re.sub("[(),]", "", name)
            test_name = "test_%s" % name
            setattr(cls, test_name, test_func)
    generate_tests = classmethod(generate_tests)


#---- hook for testlib

def test_cases():
    """This is called by test.py to build up the test cases."""
    DocTestsTestCase.generate_tests()
    yield DocTestsTestCase

