#!/usr/bin/env python
# Copyright (c) 2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""Test taskslib.py, and perhaps other parts of Komodo's Tasks feature."""

import sys
import os
import time
from os.path import dirname, join, abspath, basename, splitext, exists, expanduser
import unittest
from pprint import pprint, pformat
import shutil

sys.path.insert(0, join(dirname(dirname(abspath(__file__))), "pylib"))
from taskslib import manager, database
import testlib



#---- test cases

class _TasksTestCase(unittest.TestCase):
    _db_basedir_ = join(dirname(__file__), "tmp")

    def setUp(self):
        frame = sys._getframe(1)
        meth = frame.f_locals["testMethod"]
        name = meth.__name__
        self._db_dir_ = join(self._db_basedir_, name)
        
        if exists(self._db_dir_):
            shutil.rmtree(self._db_dir_)
        os.makedirs(self._db_dir_)
        self.mgr = manager.Manager(self._db_dir_)

class _DatabaseTestCase(_TasksTestCase):
    def _get_db(self):
        raise NotImplementedError("to be set by subclass")
    
    def test_version(self):
        db = self._get_db()
        version = db.version
        self.assert_(version)
        self.assertEqual(version, db.VERSION)

    def test_meta(self):
        db = self._get_db()
        db.set_meta("foo", "bar")
        self.assertEqual(db.get_meta("foo"), "bar")
        db.del_meta("foo")
        self.assertEqual(db.get_meta("foo", "not defined"), "not defined")

        # Check for uniqueness (key only used once).
        db.set_meta("mykey", "one")
        db.set_meta("mykey", "two")
        self.assertEqual(db.get_meta("mykey"), "two")
        db.del_meta("mykey")
        self.assertEqual(db.get_meta("mykey", "not defined"), "not defined")

class RepositoriesDatabaseTestCase(_DatabaseTestCase):
    def _get_db(self):
        return self.mgr.repos_db
class RepositoryDatabaseTestCase(_DatabaseTestCase):
    def _get_db(self):
        return database.RepositoryDatabase(     # Just hack a for-play one.
            join(self._db_dir_, "repo-1.sqlite"))

class TasksTestCase(_TasksTestCase):
    def test_simple(self):
        pass



#---- mainline

if __name__ == "__main__":
    import logging
    logging.basicConfig()
    unittest.main()


