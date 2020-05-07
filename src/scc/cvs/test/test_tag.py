"""
    Test cvslib.py's interface to the 'cvs tag' command.
"""

import os, sys, unittest, pprint
import testsupport
import cvslib


class TagTestCase(unittest.TestCase):
    pass
##    def test_simple_tag(self):
##        andrew = testsupport.users['andrew']
##        top = os.getcwd()
##        try:
##            os.chdir(andrew['home'])
##            cvs = cvslib.CVS(cvsroot=testsupport.cvsroot)
##            result = cvs.tag(...)
##            # XXX Validate 'result'...
##        finally:
##            os.chdir(top)


def suite():
    """Return a unittest.TestSuite to be used by test.py."""
    return unittest.makeSuite(TagTestCase)

