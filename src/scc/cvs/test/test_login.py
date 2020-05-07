"""
    Test cvslib.py's interface to the 'cvs login' command.
"""

import os, sys, unittest, pprint
import testsupport
import cvslib


class LoginTestCase(unittest.TestCase):
    pass
##    def test_simple_login(self):
##        andrew = testsupport.users['andrew']
##        top = os.getcwd()
##        try:
##            os.chdir(andrew['home'])
##            cvs = cvslib.CVS(cvsroot=testsupport.cvsroot)
##            result = cvs.login(...)
##            # XXX Validate 'result'...
##        finally:
##            os.chdir(top)


def suite():
    """Return a unittest.TestSuite to be used by test.py."""
    return unittest.makeSuite(LoginTestCase)

