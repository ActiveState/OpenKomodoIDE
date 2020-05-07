#!/usr/bin/env python
# Copyright (c) 2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""Exception classes in taskslib."""


class TasksError(Exception):
    pass

class TasksSocketError(TasksError):
    """Wrap socket.error to give a little more info
    when printed.
    """
    def __init__(self, socket_error, url):
        self.socket_error = socket_error
        self.url = url
    def __str__(self):
        return "%s: %s" % (self.socket_error, self.url)

class RepositoryVerifyError(TasksError):
    pass

class QueryError(TasksError):
    pass

class NotInDatabaseError(TasksError):
    pass


