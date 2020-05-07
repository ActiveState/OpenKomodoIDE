"""
    Test cvslib.py's interface to the 'cvs rtag' command.
"""

import os, sys, unittest, pprint
import testsupport
import cvslib


class RtagTestCase(unittest.TestCase):
    pass
##    def test_simple_rtag(self):
##        andrew = testsupport.users['andrew']
##        top = os.getcwd()
##        try:
##            os.chdir(andrew['home'])
##            cvs = cvslib.CVS(cvsroot=testsupport.cvsroot)
##            result = cvs.rtag(...)
##            # XXX Validate 'result'...
##        finally:
##            os.chdir(top)


def suite():
    """Return a unittest.TestSuite to be used by test.py."""
    return unittest.makeSuite(RtagTestCase)

