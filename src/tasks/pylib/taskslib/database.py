#!/usr/bin/env python
# Copyright (c) 2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""Taskslib database classes."""

from __future__ import with_statement

import os
from os.path import exists, expanduser, join, dirname, isdir
import logging
from contextlib import contextmanager
import sqlite3
from pprint import pprint, pformat
import json
import socket

from taskslib import utils
from taskslib import core
from taskslib import errors



#---- globals

log = logging.getLogger("taskslib")



#---- database classes

class _Database(object):
    """Wrapper API for the sqlite databases used by this module."""
    # Database version.
    # VERSION is the version of this Database code. The property
    # "version" is the version of the database on disk. The patch-level
    # version number should be used for small upgrades to the database.
    #VERSION = "1.0.0"          # must be set on base classes
    schema = None               # must be set on base classes
    path = None
    
    def __init__(self, path):
        self.path = path
        if not exists(self.path):
            self.create()

    def __repr__(self):
        return "<_Database %s>" % self.path

    @contextmanager
    def connect(self, commit=False, cu=None):
        """A context manager for a database connection/cursor. It will automatically
        close the connection and cursor.

        Usage:
            with self.connect() as cu:
                # Use `cu` (a database cursor) ...

        @param commit {bool} Whether to explicitly commit before closing.
            Default false. Often SQLite's autocommit mode will
            automatically commit for you. However, not always. One case
            where it doesn't is with a SELECT after a data modification
            language (DML) statement (i.e.  INSERT/UPDATE/DELETE/REPLACE).
            The SELECT won't see the modifications. If you will be
            making modifications, probably safer to use `self.connect(True)`.
            See "Controlling Transations" in Python's sqlite3 docs for
            details.
        @param cu {sqlite3.Cursor} An existing cursor to use. This allows
            callers to avoid the overhead of another db connection when
            already have one, while keeping the same "with"-statement
            call structure.
        """
        if cu is not None:
            yield cu
        else:
            cx = sqlite3.connect(self.path)
            cu = cx.cursor()
            try:
                yield cu
            finally:
                if commit:
                    cx.commit()
                cu.close()
                cx.close()

    def create(self):
        """Create the database file."""
        #TODO: error handling?
        with self.connect(True) as cu:
            cu.executescript(self.schema)
            cu.execute("INSERT INTO tasks_meta(key, value) VALUES (?, ?)", 
                ("version", self.VERSION))

    @property
    def version(self):
        """Return the version of the db on disk (or None if cannot
        determine).
        """
        return self.get_meta("version")

    def get_meta(self, key, default=None, cu=None):
        """Get a value from the meta table.
        
        @param key {str} The meta key.
        @param default {str} Default value if the key is not found in the db.
        @param cu {sqlite3.Cursor} An existing cursor to use.
        @returns {str} The value in the database for this key, or `default`.
        """
        with self.connect(cu=cu) as cu:
            cu.execute("SELECT value FROM tasks_meta WHERE key=?", (key,))
            row = cu.fetchone()
            if row is None:
                return default
            return row[0]
    
    def set_meta(self, key, value, cu=None):
        """Set a value into the meta table.
        
        @param key {str} The meta key.
        @param default {str} Default value if the key is not found in the db.
        @param cu {sqlite3.Cursor} An existing cursor to use.
        @returns {str} The value in the database for this key, or `default`.
        """
        with self.connect(True, cu=cu) as cu:
            cu.execute("INSERT INTO tasks_meta(key, value) VALUES (?, ?)", 
                (key, value))

    def del_meta(self, key):
        """Delete a key/value pair from the meta table.
        
        @param key {str} The meta key.
        """
        with self.connect(True) as cu:
            cu.execute("DELETE FROM tasks_meta WHERE key=?", (key,))

class RepositoriesDatabase(_Database):
    """A database of the registered task repositories, plus some other
    general data.
    
    There is one of these (per profile) and it is the main top-level
    datastore for the tasks system. The queries and tasks for a particular
    repo are stored in separate database files (see `RepositoryDatabase`).
    """
    # Changelog:
    # - 1.0.0: initial version
    VERSION = "1.0.0"
    
    schema = """
        CREATE TABLE tasks_meta (
            key TEXT UNIQUE ON CONFLICT REPLACE,
            value TEXT
        );
    
        CREATE TABLE tasks_repo (
            id INTEGER NOT NULL PRIMARY KEY,
            nickname TEXT UNIQUE DEFAULT NULL,
            type TEXT,
            base_url TEXT,
            username TEXT,
            password TEXT -- XXX privacy issues here. Store in moz pass manager?
        );
    """
    
    def __init__(self, dir):
        path = join(dir, "repos.sqlite")
        _Database.__init__(self, path)
    
    def __repr__(self):
        return "<RepositoriesDatabase %s>" % self.path

    def add_repo(self, repo, cu=None):
        """Add a repository to the db.
        
        @param repo {Repository} The repository to add.
        @param cu {sqlite3.Cursor} An existing cursor to use.
        @returns {Repository} The updated `repo` (see Side-effects below).
        
        **Side-effects:** The following fields on `repo` are set:
            `id`            The db id for this visit.
        """
        assert repo.id is None, "adding existing repo: %r" % repo
        with self.connect(True, cu=cu) as cu:
            cu.execute("""
                INSERT INTO tasks_repo(nickname, type, base_url, username, password)
                VALUES (?, ?, ?, ?, ?)
                """, 
                (repo.nickname, repo.type, repo.base_url, repo.username, repo.password))
            repo.id = cu.lastrowid
        return repo

    def remove_repo(self, repo_id, cu=None):
        """Remove a repository from the db.
        
        @param repo_id {int} The row id of the repo to remove.
        @param cu {sqlite3.Cursor} An existing cursor to use.
        """
        with self.connect(True, cu=cu) as cu:
            cu.execute("DELETE FROM tasks_repo WHERE id=?", (repo_id,))

    def gen_repos(self, mgr):
        """Generate the repos in the db.
        
        @param mgr {Manager} Needed for repo_type -> repo class mapping.
        """
        with self.connect() as cu:
            cu.execute("SELECT * FROM tasks_repo")
            for row in cu:
                id, nickname, type, base_url, username, password = row
                repo_class = mgr.repo_class_from_type(type)
                yield repo_class(mgr, base_url, username, password,
                                 nickname=nickname, id=id)

class RepositoryDatabase(_Database):
    """A database of queries and cached task info for a given task
    repository.
    """
    # Changelog:
    # - 1.0.0: initial version
    VERSION = "1.0.0"
    
    # See http://eusqlite.wikispaces.com/dates+and+times for info on using
    # julian days with sqlite.
    schema = """
        CREATE TABLE tasks_meta (
            key TEXT UNIQUE ON CONFLICT REPLACE,
            value TEXT
        );
    
        CREATE TABLE tasks_query (
            id INTEGER NOT NULL PRIMARY KEY,
            nickname TEXT UNIQUE DEFAULT NULL,
            title TEXT DEFAULT NULL,
            conds_json TEXT,    -- repo-type-specific query conditions (JSON)
            created_time REAL,                  -- Julian time (UTC)
            fetched_time REAL DEFAULT NULL      -- Julian time (UTC)
        );
        CREATE TRIGGER tasks_query_set_created_time AFTER INSERT ON tasks_query
        BEGIN
            UPDATE tasks_query SET created_time = julianday('now') WHERE rowid = new.rowid;
        END;

        CREATE TABLE tasks_task (
            id INTEGER NOT NULL PRIMARY KEY,
            summary TEXT,
            description TEXT
            --XXX:TODO fetched_time REAL (triggers to handle these?)
            --XXX:TODO: fields here for common queries (e.g. is_open, created_time)
        );
        -- XXX:TODO a tasks_task_attributes table with extra fields

        CREATE TABLE tasks_query_tasks (
            id integer NOT NULL PRIMARY KEY,
            query_id integer NOT NULL REFERENCES tasks_query (id),
            task_id integer NOT NULL REFERENCES tasks_task (id),
            UNIQUE (query_id, task_id)
        );
        
        -- TODO: indeces?
    """
    
    def __repr__(self):
        return "<RepositoryDatabase %s>" % self.path

    def add_query(self, query, cu=None):
        """Add a query to the db.
        
        @param query {core.Query} The query to add.
        @param cu {sqlite3.Cursor} An existing cursor to use.
        @returns {core.Query} The updated `query` (see Side-effects below).
        
        **Side-effects:** The following fields on `loc` are set:
            `id`            The db id for this visit.
            `created_time`  The (julian day) creation time of the query.
        """
        assert query.id is None, "adding existing query: %r" % query
        with self.connect(True, cu=cu) as cu:
            cu.execute("""
                INSERT INTO tasks_query(nickname, title, conds_json)
                VALUES (?, ?, ?)
                """, 
                (query.nickname, query.title, query.conds_json))
            query.id = cu.lastrowid
        return query

    def remove_query(self, query_id, cu=None):
        """Remove a query from the db.
        
        @param query_id {int} The row id of the query to remove.
        @param cu {sqlite3.Cursor} An existing cursor to use.
        """
        with self.connect(True, cu=cu) as cu:
            cu.execute("DELETE FROM tasks_query WHERE id=?", (query_id,))

    def gen_queries(self, cu=None):
        """Generate the stored queries for this repo.
        
        @param cu {sqlite3.Cursor} An existing cursor to use.
        """
        with self.connect(cu=cu) as cu:
            #TODO: Query created_time. How to un-julian the time?
            cu.execute("SELECT id, nickname, title, conds_json FROM tasks_query")
            for row in cu:
                id, nickname, title, conds_json = row
                yield core.Query(self, conds_json=conds_json,
                    nickname=nickname, title=title, id=id)

    def query_from_id(self, id, repo, cu=None):
        """Return a query instance for the given query id.
        
        @param id {int} The id of the query to return.
        @param repo {Repository} The repository for this database.
        @param cu {sqlite3.Cursor} An existing cursor to use.
        @returns {core.Query}
        @raises {errors.NotInDatabaseError} if no such query is stored.
        """
        with self.connect(cu=cu) as cu:
            cu.execute("""
                SELECT id, nickname, title, conds_json
                FROM tasks_query
                WHERE id=?
                """, (id,))
            row = cu.fetchone()
            if row is None:
                raise errors.NotInDatabaseError(
                    "no query %r for %r" % (id, repo))
            id, nickname, title, conds_json = row
            return core.Query(repo, conds_json=conds_json,
                nickname=nickname, title=title, id=id)

    def query_from_nickname(self, nickname, repo, cu=None):
        """Return a query instance for the given query nickname.
        
        @param nickname {str} The nickname of the query to return.
        @param repo {Repository} The repository for this database.
        @param cu {sqlite3.Cursor} An existing cursor to use.
        @returns {core.Query}
        @raises {errors.NotInDatabaseError} if no such query is stored.
        """
        with self.connect(cu=cu) as cu:
            cu.execute("""
                SELECT id, nickname, title, conds_json
                FROM tasks_query
                WHERE nickname=?
                """, (nickname,))
            row = cu.fetchone()
            if row is None:
                raise errors.NotInDatabaseError(
                    "no query %r for %s" % (nickname, repo))
            id, nickname, title, conds_json = row
            return core.Query(repo, conds_json=conds_json,
                nickname=nickname, title=title, id=id)

    def add_task(self, task, cu=None):
        """Add a task to the database.

        @param task {core.Task} The task to add.
        @param cu {sqlite3.Cursor} An existing cursor to use.
        @returns {core.Task} The added `task`.
        """
        with self.connect(True, cu=cu) as cu:
            cu.execute("""
                INSERT INTO tasks_task(id, summary, description)
                VALUES (?, ?, ?)
                """, 
                (task.id, task.summary, task.description))
            #assert cu.lastrowid == task.id
            #XXX:TODO add the attributes
        return task
    
    def task_ids_from_query(self, query, cu=None):
        """Return the task ids for the given repo query.
        
        @param query {core.Query}
        @param cu {sqlite3.Cursor} An existing cursor to use.
        @raises {errors.NotInDatabaseError} if results for this query are
            not stored.
        """
        if query.id is None:
            # This is possible if just testing a query before inserting
            # into the db.
            raise errors.NotInDatabaseError(
                "query not in database: %r" % query)
        with self.connect(cu=cu) as cu:
            # Need to distinguish btwn this query matching no tasks and the
            # results of the query not being stored in the db. Therefore
            # it is insufficient to rely on a SELECT of `tasks_query_tasks`.
            cu.execute("SELECT fetched_time FROM tasks_query WHERE id=?",
                (query.id,))
            fetched_time = cu.fetchone()[0]
            if fetched_time is None:
                raise errors.NotInDatabaseError(
                    "query has not been fetched: %r" % query)
            cu.execute("SELECT task_id FROM tasks_query_tasks WHERE query_id=?",
                (query.id,))
            for row in cu.fetchall():
                yield row[0]

    def task_from_id(self, id, cu=None):
        """Return a Task instance for the given task id.
        
        @param id {int} The id of the task to return.
        @param cu {sqlite3.Cursor} An existing cursor to use.
        @returns {core.Task}
        @raises {errors.NotInDatabaseError} if results for this task
            are not stored.
        """
        with self.connect(cu=cu) as cu:
            cu.execute("""
                SELECT id, summary, description
                FROM tasks_task
                WHERE id=?
                """, (id,))
            row = cu.fetchone()
            if row is None:
                raise errors.NotInDatabaseError(
                    "task %r not in database" % id)
            #TODO:XXX pull out the other attributes
            return core.Task(
                id=id,
                summary=row[1],
                description=row[2],
            )


