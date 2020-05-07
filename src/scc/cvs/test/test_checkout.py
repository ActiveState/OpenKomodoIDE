"""
    Test cvslib.py's interface to the 'cvs checkout' command.
"""

import os, sys, unittest, pprint
import testsupport
import cvslib


class CheckoutTestCase(unittest.TestCase):
    def test_simple_checkout(self):
        andrew = testsupport.users['andrew']
        top = os.getcwd()
        try:
            os.chdir(andrew['home'])
            cvs = cvslib.CVS(cvsroot=testsupport.cvsroot)
            result = cvs.checkout('supper')
            updates = [f['file'] for f in result['files']\
                       if f['status'] == 'U']
            self.failUnless(updates,
                            "No files were updated when checking out "\
                            "module 'supper'. result=%s" % result)
            testsupport._rmtree('supper')
        finally:
            os.chdir(top)

    def test_checkout_nonexistant_module(self):
        andrew = testsupport.users['andrew']
        top = os.getcwd()
        try:
            os.chdir(andrew['home'])
            cvs = cvslib.CVS(cvsroot=testsupport.cvsroot, quiet="somewhat")
            result = cvs.checkout('nonexistant_module')
            self.failUnless(result['retval'],
                            "Checking out a non-existant module "\
                            "*succeeded. result=%s" % result)
        finally:
            os.chdir(top)

    #TODO:
    #   - checking out multiple projects at once
    #   - checking out a project for which there is already a working copy
    #   - exercise each of the options


def suite():
    """Return a unittest.TestSuite to be used by test.py."""
    return unittest.makeSuite(CheckoutTestCase)

