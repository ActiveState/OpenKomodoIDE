"""
    Test cvslib.py's interface to the 'cvs add' command.
"""

import os, sys, unittest, pprint
import testsupport
import cvslib


class AddTestCase(unittest.TestCase):
    def test_simple_add(self):
        andrew = testsupport.users['andrew']
        top = os.getcwd()
        try:
            os.chdir(andrew['home'])
            cvs = cvslib.CVS(cvsroot=testsupport.cvsroot)
            cvs.checkout('supper')

            try:
                os.chdir('supper')
                newfile = 'test_simple_add.txt'
                fout = open(newfile, 'w')
                fout.write("hello there\n")
                fout.close()
                result = cvs.add(newfile)
                self.failIf(result['retval'],
                            "A simple 'cvs add' failed. result=%s" % result)
            finally:
                os.chdir(andrew['home'])

            testsupport._rmtree('supper')
        finally:
            os.chdir(top)


def suite():
    """Return a unittest.TestSuite to be used by test.py."""
    return unittest.makeSuite(AddTestCase)

