"""
    Test cvslib.py's interface to the 'cvs log' command.
"""

import os, sys, unittest, pprint
import testsupport
import cvslib


class LogTestCase(unittest.TestCase):
    pass
##    def test_simple_log(self):
##        andrew = testsupport.users['andrew']
##        top = os.getcwd()
##        try:
##            os.chdir(andrew['home'])
##            cvs = cvslib.CVS(cvsroot=testsupport.cvsroot)
##            result = cvs.log(...)
##            # XXX Validate 'result'...
##        finally:
##            os.chdir(top)


def suite():
    """Return a unittest.TestSuite to be used by test.py."""
    return unittest.makeSuite(LogTestCase)

