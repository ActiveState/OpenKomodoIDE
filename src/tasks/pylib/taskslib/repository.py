#!/usr/bin/env python
# Copyright (c) 2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""Repository base functionality in taskslib."""

import logging
import os
from os.path import exists, join, dirname, isdir, abspath, splitext
from collections import deque

from taskslib import core, utils, errors, database


log = logging.getLogger("taskslib")



class Repository(object):
    """A task repository."""
    db = None       # Loaded when `id` is set.
    type = None     # Must be set to a short string in base classes.
    def __init__(self, mgr, base_url, username, password, nickname=None, id=None):
        self.mgr = mgr
        self.base_url = base_url
        self.username = username
        self.password = password
        self.nickname = nickname
        self.id = id
    
    def __repr__(self):
        nickname_str = (" (%s)" % self.nickname) if self.nickname else ""
        return "<Repository %s%s: %s (type %s, username %s)>" % (
            self.id, nickname_str, self.base_url, self.type or "???", self.username)

    def __str__(self):
        nickname_str = (" (%s)" % self.nickname) if self.nickname else ""
        return "repository %s%s" % (self.id, nickname_str)
    
    _id = None
    def _get_id(self):
        return self._id
    def _set_id(self, id):
        self._id = id
        if id is not None:
            self._load_db()
    id = property(_get_id, _set_id, doc="unique id for this repository")
    
    def _get_db_path(self):
        assert self._id is not None
        return join(self.mgr.db_dir, "repo-%d.sqlite" % self._id)
    
    def _load_db(self):
        """Load the repository's database, creating an empty one
        if necessary.
        """
        self.db = database.RepositoryDatabase(self._get_db_path())

    def delete(self):
        """Delete the repository's database."""
        db_path = self._get_db_path()
        if exists(db_path):
            try:
                os.remove(db_path)
            except EnvironmentError, ex:
                log.warn("error removing repo database `%s': %s", db_path, ex)
    
    def add_task(self, data):
        """Add a task to the repository.
        
        @param data {dict} The new task data. The keys should map to field
            names provided by `repo.task_fields()`.
        @returns {Task} The added task.
        """
        task = self.hook_add_task(data)
        self.db.add_task(task)
        return task
    
    def create_query(self, conds, nickname=None, title=None):
        return core.Query(self, conds, nickname=nickname, title=title)

    def add_query(self, query):
        """Add the given query.
        
        @param query {core.Query}
        """
        self.db.add_query(query)

    def remove_query(self, query_id):
        self.db.remove_query(query_id)

    def gen_queries(self):
        """Generate the stored queries for this repository."""
        with self.db.connect() as cu:
            for q in self.db.gen_queries(cu):
                yield q
    
    def query_from_id(self, query_id):
        return self.db.query_from_id(query_id, self)
    
    def query_from_nickname(self, query_nickname):
        return self.db.query_from_nickname(query_nickname, self)
    
    def tasks_from_query(self, query):
        """Execute the given query and yield the set of matching tasks.
        
        @param query {Query}
        @raises {QueryError} if there is an error.
        """
        ids = self.task_ids_from_query(query)
        for task in self.tasks_from_ids(ids):
            yield task
    
    def task_ids_from_query(self, query):
        """Return the task ids for the given repo query.
        
        If the query results (from a previous fetch) are in the db, then
        those results are returned. Otherwise, a first fetch is done. It
        is the responsibility of a separate caller to update every so
        often.
        
        @param query {Query}
        @returns A sequence of task ids.
        """
        with self.db.connect() as cu:
            try:
                ids = self.db.task_ids_from_query(query, cu=cu)
                for id in ids:
                    yield id
            except errors.NotInDatabaseError:
                # Need to fetch from the server (and store the results).
                ids = self.hook_task_ids_from_query(query)
                query_id = query.id
                if query_id is not None:
                    cu.execute("""
                        UPDATE tasks_query SET fetched_time = julianday('now')
                        WHERE id=?""",
                        (query_id,))
                    for id in ids:
                        cu.execute("INSERT INTO tasks_query_tasks(query_id, task_id) VALUES (?, ?)",
                            (query_id, id))
                    cu.connection.commit()
                for id in ids:
                    yield id
    
    def verify(self):
        """Verify whether can connect to, authenticate, and use this repository.
        
        @raises {RepositoryVerifyError} if cannot use this repository.
        """
        raise NotImplementedError("'verify' must be implemented in subclasses")

    def tasks_from_ids(self, ids):
        """Generate a Task instance for each given task id, loading the local
        tasks cache db, if necessary.
        
        Note that if that task is already cached locally then that data is
        returned: fast (good) and possibly out of date (bad). Update methods
        -- typically handled by a background process/thread -- are
        responsible for updating the local cache.
        
        @param ids {list} A list of int task ids.
        
        Dev Notes:
        - The reason this is plural is to allow for batch operations, which
          can significantly help performance talking to the remote server.
        """
        with self.db.connect() as cu:
            # Work in blocks of 100. Grouping can allow significant reduction
            # in overhead when working with a remote tasks server.
            for chunk in utils.batch(ids, 100):
                ids_to_fetch = []
                tasks = deque()

                # Determine which tasks we already have locally cached,
                # and which we need to fetch.
                for id in chunk:
                    try:
                        task = self.db.task_from_id(id, cu=cu)
                    except errors.NotInDatabaseError:
                        ids_to_fetch.append(id)
                        task = None
                    tasks.append(task)

                # Fetch the latter (updating the database).
                if ids_to_fetch:
                    fetched_tasks = self.hook_tasks_from_ids(ids_to_fetch)
                    for t in fetched_tasks:
                        self.db.add_task(t)
                    cu.connection.commit()

                # Yield the tasks.
                i = 0
                for t in tasks:
                    if t is None:
                        yield fetched_tasks[i]
                        i += 1
                    else:
                        yield t

    def task_fields(self):
        """Return a list fields representing the data supported for
        a new task by this repo.
        
        The order of the fields should indicate a reasonable ordering in
        which a user could be presented the fields for adding a new task.
        However, the user is not required to present them in this order.

        TODO: might add valid values
        TODO: some normalization for a base set of common fields, if possible
        
        @returns {list of core.TaskField}
        """
        #TODO: add 5 minute cache or something to this (perhaps also then
        #   add a cache=False option to this method).
        return self.hook_task_fields()

    
    #---- repository subclass hook methods
    
    def hook_add_task(self, data):
        """Add a new task to the repo.
        
        @param data {dict} The new task data. The keys should map to field
            names provided by `repo.task_fields()`.
        @returns {core.Task}
        """
        raise NotImplementedError("'hook_add_task' must be implemented in subclasses")
    
    def hook_task_fields(self):
        """Fetch task fields. This is a repository-subclass hook to
        support the `.task_fields()` method.

        @returns {list of core.TaskField}
        """
        raise NotImplementedError("'hook_task_fields' must be implemented in subclasses")

    def hook_tasks_from_ids(self, ids):
        """Fetch task info for each of the given task ids from the tasks
        repository and return a `Task` for each.
        
        This is, of course, repository-specific so must be overriden in
        base classes.
        
        @param ids {list} A list of int task ids.
        @returns {list} List of `Task` instances.
        """
        raise NotImplementedError("'hook_tasks_from_ids' must be implemented in subclasses")

    def hook_task_ids_from_query(self, query):
        """Fetch the tasks ids returned for the given query from the
        task repository server.
        
        This is, of course, repository-specific so must be overriden in
        base classes.
        
        @param query {Query}
        @returns A sequence of task ids.
        """
        raise NotImplementedError("'hook_task_ids_from_query' must be implemented in subclasses")

    def hook_query_help_text(self):
        """Return help text for specifying query conditions for this repo."""
        return "(no help provided by this repository)"

