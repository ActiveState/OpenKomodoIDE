# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import sys, os
import unittest
import tempfile

import svnlib

# this repository must already exist if the repository location is not provided
# as an argument to this script
test_repository = 'file:///srv/svn/repositories/svntest/'
test_repository = 'svn+ssh://127.0.0.1/srv/svn/repositories/svntest'
test_repository = 'http://localhost/svn/svntest/'
test_repository = "http://svn.tl.activestate.com/svn/docs/trunk"
test1_filename = 'test1/asdf.txt'
test2_filename = 'test2/asdf.txt'
test_filename = test1_filename
subversionClient = 'svn'

class testOptV(unittest.TestCase):
    def test_makeOptv_boolean(self):
        svnoptions = {'force': 1}
        svnoptv = svnlib.makeOptv(**svnoptions)
        assert svnoptv == ['--force']
        
class testOutputParser(unittest.TestCase):
    def test_infoParse(self):
        # $ svn info foo.c
        output = """Path: foo.c
Name: foo.c
URL: http://svn.red-bean.com/repos/test/foo.c
Revision: 4417
Node Kind: file
Schedule: normal
Last Changed Author: sally
Last Changed Rev: 20
Last Changed Date: 2003-01-13 16:43:13 -0600 (Mon, 13 Jan 2003)
Text Last Updated: 2003-01-16 21:18:16 -0600 (Thu, 16 Jan 2003)
Properties Last Updated: 2003-01-13 21:50:19 -0600 (Mon, 13 Jan 2003)
Checksum: /3L38YwzhT93BWvgpdF6Zw==""".split("\n")
        
        hits = {'Name': 'foo.c', 'Schedule': 'normal', 'URL': 'http',
                'Last Changed Date': '2003-01-13 16', 'Node Kind': 'file',
                'Last Changed Author': 'sally', 'Properties Last Updated': '2003-01-13 21',
                'Text Last Updated': '2003-01-16 21', 'Checksum': '/3L38YwzhT93BWvgpdF6Zw==',
                'Path': 'foo.c', 'Last Changed Rev': '20', 'Revision': '4417'}
        parsedhits, res = svnlib._parseKeyList(output, _raw=1)
        assert hits == parsedhits

    def test_error_result(self):
        output="""svn: The log message file is under version control
svn: Log message file is a versioned file; use '--force-log' to override
""".split("\n")
        hits, res = svnlib._parseHits(output, _raw=1, _exp='^(?P<action>\w)\s+(?P<path>.*)$')
        assert hits==[]
        
    def test_commitParse(self):
        output="""Sending        foo.c
Transmitting file data .
Committed revision 5.
""".split("\n")
        hits, res = svnlib._parseHits(output, _raw=1, _exp='(?P<action>\w+)\s+(?P<path>.*)')
        hitexpect = [{'action': 'Sending', 'path': 'foo.c'}, {'action': 'Transmitting', 'path': 'file data .'}, {'action': 'Committed', 'path': 'revision 5.'}]
        assert hits==hitexpect

    def test_addParse(self):
        output="""A         testdir
A         testdir/a
A         testdir/b
A         testdir/c
A         testdir/d
""".split('\n')
        hits, res = svnlib._parseHits(output, _raw=1)
        hitsexpect = [{'path': 'testdir', 'result': 'A'}, {'path': 'testdir/a', 'result': 'A'}, {'path': 'testdir/b', 'result': 'A'}, {'path': 'testdir/c', 'result': 'A'}, {'path': 'testdir/d', 'result': 'A'}]
        assert hits==hitsexpect

class testCheckout(unittest.TestCase):
    def test_checkout(self):
        svn = svnlib.SVN(subversionClient)
        # we checkout two copies so we can later test conflicts, etc.
        svn.checkout(test_repository, 'test1', _raw=1)
        svn.checkout(test_repository, 'test2', _raw=1)

class testAddNewFile(unittest.TestCase):
    def _createTestFile(self, fn, content):
        f = file(fn,'w')
        f.write(content)
        f.close()

    def test_add(self):
        # create a small file
        fn = test_filename
        self._createTestFile(fn, 'this is a test file')
        svn = svnlib.SVN(subversionClient)
        add, out = svn.add(fn, _raw=1)
        info, out = svn.info(fn, _raw=1)

        assert add[0]['result']=='A'
        assert info[fn]['Schedule']=='add'

class testRevertFile(unittest.TestCase):
    def test_revert(self):
        # create a small file
        fn = test_filename
        svn = svnlib.SVN(subversionClient)
        revert, out = svn.revert(fn, _raw=1)
        assert revert[0]['result']=='Reverted'

class testDeleteFile(unittest.TestCase):
    def test_delete(self):
        # create a small file
        fn = test_filename
        svn = svnlib.SVN(subversionClient)
        delete, out = svn.delete(fn, _raw=1)
        info, out = svn.info(fn, _raw=1)
        assert delete[0]['result']=='D'
        assert info[fn]['Schedule']=='delete'

class testCommitFile(unittest.TestCase):
    def test_commit(self):
        # create a small file
        fn = test_filename
        svn = svnlib.SVN(subversionClient)
        info, out = svn.info(fn, _raw=1)
        adding = info and info[fn]['Schedule']=='add'
        deleting = info and info[fn]['Schedule']=='delete'
        if adding:
            message = "test add"
        elif deleting:
            message = "test delete"
        else:
            raise Exception("Nothing to commit")
        commit, out = svn.commit(fn, _raw=1, message=message)
        info, out = svn.info(fn, _raw=1)
        if adding:
            assert commit[0]['result']=='Adding'
            assert commit[2]['result']=='Committed'
            assert info[fn]['Schedule']=='normal'
        elif deleting:
            assert commit[0]['result']=='Deleting'
            assert commit[1]['result']=='Committed'
            assert not info
        else:
            raise Exception("Nothing to commit, but commited something")

class testDiffFile(unittest.TestCase):
    def test_diff(self):
        expect = ''.join("""@@ -1 +1,3 @@
-this is a test file
\ No newline at end of file
+this is a test file
+
+another line
\ No newline at end of file
""".splitlines())
        # create a small file
        fn = test_filename
        f = file(fn,'a')
        f.write('\n\nanother line')
        f.close()
        svn = svnlib.SVN(subversionClient)
        diff, out = svn.diff(fn, _raw=1)
        
        # massage this a bit, removing lines that will change with revision numbers
        diff = diff.splitlines()
        diff = ''.join(diff[4:])
        assert diff == expect

class testStatusFile(unittest.TestCase):
    def _createTempFile(self):
        import tempfile
        oldtmp = tempfile.tempdir
        tempfile.tempdir = os.path.dirname(test_filename)
        try:
            name = tempfile.mktemp("test")
            f = file(name,'w')
            f.write("a temporary file")
            f.close()
            return name
        finally:
            tempfile.tempdir = oldtmp

    def test_status(self):
        fn = test_filename
        svn = svnlib.SVN(subversionClient)
        info, out = svn.status(fn, _raw=1)
        assert info[0]['Path']==fn

    def test_statusUpdates(self):
        fn = test_filename
        svn = svnlib.SVN(subversionClient)
        info, out = svn.status(fn, _raw=1, show_updates=1)
        assert info[0]['Path']==fn

    def test_statusVerbose(self):
        fn = test_filename
        svn = svnlib.SVN(subversionClient)
        info, out = svn.status(fn, _raw=1, verbose=1)
        assert info[0]['Path']==fn
        
    def test_statusEx(self):
        fn = test_filename
        svn = svnlib.SVN(subversionClient)
        info, out = svn.statusEx(fn, _raw=1)
        assert fn in info

    def test_statusExVerbose(self):
        fn = test_filename
        svn = svnlib.SVN(subversionClient)
        info, out = svn.statusEx(fn, _raw=1, non_recursive=1,verbose=1, show_updates=1)
        assert fn in info

    def test_statusEx_BadFile(self):
        # test for failure when a file is not in svn repository
        # create a small file
        test_fn = self._createTempFile()
        try:
            fn = test_filename
            svn = svnlib.SVN(subversionClient)
            info, out = svn.statusEx([fn, test_fn], _raw=1)
            assert fn in info
            assert test_fn not in info
        finally:
            try:
                os.unlink(test_fn)
            except OSError, e:
                pass

class testConflictFile(unittest.TestCase):
    def __init__(self, methodName='runTest'):
        self.svn = svnlib.SVN(subversionClient)
        unittest.TestCase.__init__(self, methodName)
        
    def _createTestFile(self, fn, content):
        f = file(fn,'w')
        f.write(content)
        f.close()

    def _appendTestFile(self, fn, content):
        f = file(fn,'a')
        f.write(content)
        f.close()
        
    def _add(self, fn):
        # create a small file
        if os.path.exists(fn):
            print "file already exists"
            return
        self._createTestFile(fn, 'this is a test file')
        add, out = self.svn.add(fn, _raw=1)
        info, out = self.svn.info(fn, _raw=1)
        assert add[0]['result']=='A'
        assert info[fn]['Schedule']=='add'
        return self.svn.commit(fn, _raw=1, message="add test file")
    
    def _append(self, fn, content):
        self._appendTestFile(fn, content)
        return self.svn.commit(fn, _raw=1, message="append some text")

    def test_conflict(self):
        # create a small file
        try:
            self._add(test1_filename)
            self.svn.update('test2')
            r1, out1 = self._append(test1_filename, "\nsome extra text")
            try:
                r2, out2 = self._append(test2_filename, "\nsome different text")
            except svnlib.SVNLibError, e:
                if 'out of date' not in str(e).lower():
                    raise
            # we know were out of date, lets update and see the status
            self.svn.update('test2')
            info, out = self.svn.status(test2_filename, _raw=1)
            assert info[0]['Status'] == 'C'

            # just resolve it so we can delete it
            self.svn.resolved(test2_filename, _raw=1)
        finally:
            # just cleanup, make sure these files are deleted.
            try:
                if os.path.exists(test1_filename):
                    self.svn.delete(test1_filename, force=1)
                    self.svn.commit(test1_filename, message="force delete")
            except svnlib.SVNLibError:
                print "unable to delete %s"%test1_filename
            try:
                if os.path.exists(test2_filename):
                    self.svn.delete(test2_filename, force=1)
                    self.svn.commit(test2_filename, message="force delete")
            except svnlib.SVNLibError:
                print "unable to delete %s"%test2_filename
        

#---- mainline

def suite():
    suites = []
    # some simple output parser tests
    suites.append( unittest.makeSuite(testOptV))
    suites.append( unittest.makeSuite(testOutputParser) )
    
    # checkout repository into two test directories
    if not os.path.exists('test1') or not os.path.exists('test2'):
        suites.append( unittest.makeSuite(testCheckout) )

    # add then revert a file before commit
    suites.append( unittest.makeSuite(testAddNewFile) )
    suites.append( unittest.makeSuite(testRevertFile) )

    # add and commit a file
    suites.append( unittest.makeSuite(testAddNewFile) )
    suites.append( unittest.makeSuite(testCommitFile) )

    # delete but revert before commit
    suites.append( unittest.makeSuite(testDeleteFile) )
    suites.append( unittest.makeSuite(testRevertFile) )

    # edit, diff then revert a file
    suites.append( unittest.makeSuite(testDiffFile) )
    suites.append( unittest.makeSuite(testStatusFile) )
    suites.append( unittest.makeSuite(testRevertFile) )

    # delete the file from the repository
    suites.append( unittest.makeSuite(testDeleteFile) )
    suites.append( unittest.makeSuite(testCommitFile) )

    suites.append( unittest.makeSuite(testConflictFile) )
    return unittest.TestSuite(suites)


def rmdir(top):
    # Delete everything reachable from the directory named in 'top',
    # assuming there are no symbolic links.
    # CAUTION:  This is dangerous!  For example, if top == '/', it
    # could delete all your disk files.
    import os
    for root, dirs, files in os.walk(top, topdown=False):
        for name in files:
            os.remove(os.path.join(root, name))
        for name in dirs:
            os.rmdir(os.path.join(root, name))
    os.rmdir(top)

def clean():
    # remove the checked out dirs
    cwd = os.getcwd()
    try:
        rmdir(os.path.join(cwd,'test1'))
        rmdir(os.path.join(cwd,'test2'))
    except Exception, e:
        pass

def test_main(cleanup=1):
    if cleanup: clean()
    
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(suite())
    
    if cleanup: clean()

if __name__ == "__main__":
    __file__ = sys.argv[0] # won't be necessary in Python 2.3
    
    # a little something to help set a test repository
    try:
        import getopt
        optlist, args = getopt.getopt(sys.argv[1:], 'r:c:s:',
            ['repository','cleanup','subversion'])
    except getopt.GetoptError, msg:
        sys.stderr.write("test_svnlib: error: %s\n", str(msg))
        sys.exit(1)
    
    cleanup = 1
    for opt, optarg in optlist:
        if opt in ('-r', '--repository'):
            test_repository = optarg
        elif opt in ('-c', '--cleanup'):
            cleanup = int(optarg)
        elif opt in ('-s', '--subversion'):
            subversionClient = optarg
    
    test_main(cleanup)



