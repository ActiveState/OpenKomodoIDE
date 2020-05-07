#!/usr/bin/env python

"""Configuration info and support routines for the cvslib.py test suite."""

import os, sys

#---- Configuration info

# The test workspace root directory.
rootDir = 'tmp'
repositoryDir = os.path.join(rootDir, 'repository')

# CVSROOT
_rootAbsDir = os.path.abspath(rootDir)
if sys.platform.startswith('win'):
    _rootAbsDir = os.path.splitdrive(_rootAbsDir)[1]
cvsroot = os.path.join(_rootAbsDir, "repository").replace('\\', '/')

# Test users.
users = {
    'andrew': {
        'home': os.path.abspath(os.path.join(rootDir, 'andrew')),
    },
    'bertha': {
        'home': os.path.abspath(os.path.join(rootDir, 'bertha')),
    },
}


#---- Support routines

def _rmtreeOnError(rmFunction, filePath, excInfo):
    if excInfo[0] == OSError:
        # presuming because file is read-only
        os.chmod(filePath, 0777)
        rmFunction(filePath)

def _rmtree(dirname):
    import shutil
    shutil.rmtree(dirname, 0, _rmtreeOnError)



