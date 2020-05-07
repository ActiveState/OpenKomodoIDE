# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.


import os
import unittest
import sys

from xpcom import components, COMException



class TestKoFileService(unittest.TestCase):
    def __init__(self, methodName):
        unittest.TestCase.__init__(self, methodName)
        self.__filesvc = components.classes["@activestate.com/koFileService;1"] \
                         .createInstance(components.interfaces.koIFileService)

    def test_service(self):
        filename = os.__file__ # returns os.pyc
        file = self.__filesvc.getFileFromURI(filename)
        assert file.exists
        files = self.__filesvc.getAllFiles()
        # XXX: There is some subtle difference between the xpcom objects
        #      returned in an array that makes the "file in files" test fail.
        #      Bug 83120.
        #assert file in files
        assert [ f for f in files if f.URI == file.URI ]
        xfile = self.__filesvc.findFileByURI(file.URI)
        assert file == xfile

    def test_weakRefFile(self):
        filename = os.__file__ # returns os.pyc
        file = self.__filesvc.getFileFromURI(filename)
        assert file.exists
        files = self.__filesvc.getAllFiles()
        num_files = len(files)
        # XXX: There is some subtle difference between the xpcom objects
        #      returned in an array that makes the "file in files" test fail.
        #      Bug 83120.
        assert [ f for f in files if f.URI == file.URI ]
        f = None
        xfile = self.__filesvc.findFileByURI(file.URI)
        assert file == xfile
        file = xfile = files = None
        files = self.__filesvc.getAllFiles()
        assert len(files) == (num_files-1)
        
    def test_filesInPath(self):
        import xpcom
        myfiles = []
        myfiles.append(self.__filesvc.getFileFromURI(os.__file__))
        myfiles.append(self.__filesvc.getFileFromURI(unittest.__file__))
        file = self.__filesvc.getFileFromURI(xpcom.__file__)
        files = self.__filesvc.getFilesInBaseURI(os.path.dirname(myfiles[0].URI))
        for f in myfiles:
            # XXX: There is some subtle difference between the xpcom objects
            #      returned in an array that makes the "f in files" test fail.
            #      Bug 83120.
            #assert f in files
            assert [ f2 for f2 in files if f.URI == f2.URI ]
        
    def test_fileNotExist(self):
        if sys.platform.startswith("win"):
            pathStart = 'c:\\'
        else:
            pathStart = '/'
        fname = pathStart + "If-You-Have-This-File-U-R-Lame-Text-1.txt"
        file = self.__filesvc.getFileFromURI(fname)
        self.assertEqual(file.path, fname)
        assert not file.exists

    def test_makeTempName(self):
        filename = self.__filesvc.makeTempName(".txt")
        assert 1
        
    def test_makeTempFile(self):
        file = self.__filesvc.makeTempFile(".txt",'w+')
        assert file.exists

    def test_makeTempFileInDir(self):
        file = self.__filesvc.makeTempFileInDir(os.getcwd(),".txt",'w+')
        assert file.exists
        self.__filesvc.deleteAllTempFiles()
        files = self.__filesvc.getFilesInBaseURI(os.getcwd())
        assert not files
        
        
#---- mainline

def suite():
    return unittest.makeSuite(TestKoFileService)

def test_main():
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(suite())

if __name__ == "__main__":
    test_main()



