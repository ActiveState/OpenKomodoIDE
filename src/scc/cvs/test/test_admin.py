"""
    Test cvslib.py's interface to the 'cvs admin' command.
"""

import os, sys, unittest, pprint
import testsupport
import cvslib


class AdminTestCase(unittest.TestCase):
    def test_simple_admin(self):
        andrew = testsupport.users['andrew']
        top = os.getcwd()
        cvs = cvslib.CVS(cvsroot=testsupport.cvsroot)
        try:
            os.chdir(andrew['home'])
            # Get a working copy.
            cvs.checkout('supper')

            try:
                os.chdir('supper')
                # Add a file to muck with.
                newfile = 'test_simple_admin.txt'
                fout = open(newfile, 'w')
                fout.write("hello there\n")
                fout.close()
                cvs.add(newfile, msg="test_simple_admin play file")
                cvs.commit(newfile, msg="add a file for test_simple_admin")

                # Use 'cvs admin' to change the keyword substitution mode. 
                result = cvs.admin(newfile, mode='b')
                self.failIf(result['retval'],
                            "A simple 'cvs admin' failed. result=%s" % result)
                #XXX Add test, when .status() returns results, to ensure the
                #    -kb "took".
            finally:
                os.chdir(andrew['home'])

            testsupport._rmtree('supper')
        finally:
            os.chdir(top)


def suite():
    """Return a unittest.TestSuite to be used by test.py."""
    return unittest.makeSuite(AdminTestCase)

