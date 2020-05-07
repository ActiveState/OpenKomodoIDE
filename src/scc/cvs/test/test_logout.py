"""
    Test cvslib.py's interface to the 'cvs logout' command.
"""

import os, sys, unittest, pprint
import testsupport
import cvslib


class LogoutTestCase(unittest.TestCase):
    pass
##    def test_simple_logout(self):
##        andrew = testsupport.users['andrew']
##        top = os.getcwd()
##        try:
##            os.chdir(andrew['home'])
##            cvs = cvslib.CVS(cvsroot=testsupport.cvsroot)
##            result = cvs.logout(...)
##            # XXX Validate 'result'...
##        finally:
##            os.chdir(top)


def suite():
    """Return a unittest.TestSuite to be used by test.py."""
    return unittest.makeSuite(LogoutTestCase)

