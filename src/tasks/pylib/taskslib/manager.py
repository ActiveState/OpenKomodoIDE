#!/usr/bin/env python
# Copyright (c) 2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
from os.path import exists, join, dirname, isdir, abspath, splitext
from glob import glob
import imp
import logging

from taskslib import database, errors
from taskslib import utils


log = logging.getLogger("taskslib")



class Manager(object):
    """Singleton manager for working with tasks.
    
    @param db_dir {str} A path to a directory in which the tasks
        databases will be kept.
    @param cache_dir {str} A path to a directory that tasks will use as
        a cache.
    @param extra_module_dirs {list} Optional. A list of extra directories in
        which to look for and load "tasks_*.py" modules for registering
        taskslib plugins/extensions.
    """
    def __init__(self, db_dir, cache_dir=None, extra_module_dirs=None):
        self._ensure_dir(db_dir)
        self.db_dir = db_dir
        if cache_dir is None:
            self.cache_dir = join(db_dir, "cache")
        else:
            self.cache_dir = cache_dir
        self._ensure_dir(self.cache_dir)
        self.repos_db = database.RepositoriesDatabase(db_dir)
        #TODO: make this internal
        self.repo_from_id_cache = {}   # a cache of the repos database
        
        # Module registry bits.
        self._registered_module_canon_paths = set()
        self._repo_class_from_type = {}
        self.module_dirs = [abspath(dirname(__file__))]
        if extra_module_dirs:
            self.module_dirs += extra_module_dirs
        self._register_modules(self.module_dirs)
        
        self._load()

    def _ensure_dir(self, dir):
        if not exists(dir):
            log.debug("mkdir -p %s", dir)
            os.makedirs(dir)
        assert isdir(dir)
    
    def _register_modules(self, module_dirs):
        """Register "tasks_*.py" modules.
        
        @param module_dirs {list} List of dirs in which to look for and
            use "tasks_*.py" support modules.
        """
        for dir in module_dirs:
            for module_path in glob(join(dir, "tasks_*.py")):
                self._register_module(module_path)

    def _register_module(self, module_path):
        """Register the given tasks support module.
        
        @param module_path {str} is the path to the support module.
        @exception ImportError, TasksError

        This will import the given module path and call its top-level
        `register` function passing it the Manager instance. That is
        expected to callback to one or more of the `mgr.register_*()`
        methods.
        """
        module_canon_path = utils.canon_path_from_path(module_path)
        if module_canon_path in self._registered_module_canon_paths:
            return

        module_dir, module_name = os.path.split(module_path)
        module_name = splitext(module_name)[0]
        iinfo = imp.find_module(module_name, [module_dir])
        module = imp.load_module(module_name, *iinfo)
        if hasattr(module, "register"):
            log.debug("register `%s' taskslib support module", module_path)
            try:
                module.register(self)
            except errors.TasksError, ex:
                log.warn("error registering `%s' taskslib support "
                    "module: %s", module_path, ex)
            except:
                log.exception("unexpected error registering `%s' "
                    "taskslib support module", module_path)

        self._registered_module_canon_paths.add(module_canon_path)

    def register_repo_class(self, repo_class):
        """Called by a "tasks_*.py" module to register a repository
        class.
        """
        self._repo_class_from_type[repo_class.type] = repo_class

    def _load(self):
        for repo in self.repos_db.gen_repos(self):
            self.repo_from_id_cache[repo.id] = repo

    def repo_from_id(self, repo_id):
        try:
            return self.repo_from_id_cache[repo_id]
        except KeyError:
            raise errors.NotInDatabaseError(
                "no such repository id: %r" % repo_id)

    def repo_from_nickname(self, repo_nickname):
        for repo in self.repo_from_id_cache.values():
            if repo.nickname == repo_nickname:
                return repo
        else:
            raise errors.NotInDatabaseError(
                "no such repository nickname: %r" % repo_nickname)

    def get_cache_dir(self, key):
        return join(self.cache_dir, key)
        
    def repo_class_from_type(self, type):
        try:
            return self._repo_class_from_type[type]
        except KeyError:
            raise TasksError("unknown repository type: %r" % repo_type)

    def repo_types(self):
        return self._repo_class_from_type.keys()

    def add_repo(self, repo_type, repo_url, username=None, password=None,
                 nickname=None, skip_verify=False):
        """Add a tasks repository.
        
        @param repo_type {str} is the repository type. Currently just "trac"
            is supported.
        @param repo_url {str} is the base URL for the tasks repository.
        @param username {str} Username for authorizing with the task repo.
        @param password {str} Password for authorizing with the task repo.
        @param nickname {str} Optional short nickname for repo.
        @param skip_verify {bool} Can be set True to skip verification of the
            repo data before adding. By default some repo-specific checks
            are done to verify that the repo data is good and that the
            tasks repo can be used.
        @returns {Repository} The added repository object (that was added
            to the database).
        @raises {RepositoryVerifyError} If there was a problem connecting to,
            authenticating with, or using the repository.
        @raises {TasksError} For other failures.
        """
        repo_class = self.repo_class_from_type(repo_type)
        repo = repo_class(self, repo_url, username=username, password=password,
                          nickname=nickname)
        if not skip_verify:
            repo.verify()
        self.repos_db.add_repo(repo)
        self.repo_from_id_cache[repo.id] = repo
        return repo

    def remove_repo(self, repo_id):
        """Remove the repository with the given id."""
        repo = self.repo_from_id(repo_id)
        repo.delete()
        self.repos_db.remove_repo(repo_id)
        del self.repo_from_id_cache[repo_id]

    def gen_repos(self):
        """Generate the current task repositories."""
        for id, repo in sorted(self.repo_from_id_cache.items()):
            yield repo

    def query_from_qid(self, qid):
        """Return the identified query.
        
        @param qid {str} A query id of the form:
            '<repo-nickname-or-id>:<query-nickname-or-id>'.
            Examples: '1:1', 'myproject:mine', 'myproject:2'.
        @returns {Query}
        @raises {errors.NotInDatabaseError} if cannot be found.
        """
        try:
            repo_nickname_or_id, query_nickname_or_id = qid.split(':', 1)
        except ValueError:
            raise ValueError("invalid qid: %r (must be of the form "
                "`<repo-nickname-or-id>:<query-nickname-or-id>')" % qid)
        
        try:
            repo_id = int(repo_nickname_or_id)
        except ValueError:
            repo = self.repo_from_nickname(repo_nickname_or_id)
        else:
            repo = self.repo_from_id(repo_id)
        
        try:
            query_id = int(query_nickname_or_id)
        except ValueError:
            query = repo.query_from_nickname(query_nickname_or_id)
        else:
            query = repo.query_from_id(query_id)
        return query

    def update_repos(self):
        for repo in self.gen_repos():
            repo.update()

    def update_repo(self, rid):
        """Update the identified repository.

        @param rid {str} A repo id or nickname.
        """
        try:
            repo_id = int(rid)
        except ValueError:
            repo = self.repo_from_nickname(rid)
        else:
            repo = self.repo_from_id(repo_id)
        repo.update()

    def update_query(self, qid):
        XXX
    def update_task(self, tid):
        XXX


