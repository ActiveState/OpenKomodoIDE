#!/usr/bin/env python

"""The activeapis test suite entry point."""

import os
from os.path import exists, join, abspath, dirname, normpath, expanduser
import sys
import logging

import testlib

log = logging.getLogger("test")
testdir_from_ns = {
    None: os.curdir,
}

def setup():
    top_dir = dirname(dirname(abspath(__file__)))
    sys.path.insert(0, join(top_dir, "lib"))
    sys.path.insert(0, join(top_dir, "externals", "lib"))

if __name__ == "__main__":
    logging.basicConfig()
    setup()
    retval = testlib.harness(testdir_from_ns=testdir_from_ns)
    sys.exit(retval)

