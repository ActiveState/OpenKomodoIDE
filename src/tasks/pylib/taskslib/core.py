#!/usr/bin/env python
# Copyright (c) 2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""Core classes of taskslib."""

import os
from os.path import exists, join, dirname, isdir, abspath, splitext
import sys
import logging
from pprint import pprint, pformat
import json

try:
    from xpcom import components
    from xpcom.server import UnwrapObject
    _xpcom_ = True
except ImportError:
    _xpcom_ = False

from taskslib import utils
from taskslib import errors



#---- globals

log = logging.getLogger("taskslib")



#---- core taskslib objects

class TaskField(object):
    """A task field -- used for knowing what data to gather for adding
    a new task.
    
    A list of these is returned by the `Repository.task_fields()` API.
    
    @param name {str} the code name of the field
    @param label {str} An en-US label appropriate for UI for the field
    @param is_required {bool} Whether this field is required for adding a
        new task.
    @param type {str} The type of the field. One of the following (currently
        using Trac's fields):
            text            A free-form text field
            textarea        A long free-form text field
            radio           One of a group of options (as given in `options`)
            select          Ditto. (Note: Trac distinguishes this from
                            `radio` as a hint for UI display.)
            checkbox        A boolean field. If no `default` is given this
                            presumes false, i.e. unchecked.
    @param options {list} If `type` is radio or select, then this is a list
        of the valid options.
    @param default {str} A default value. None to indicates there is no
        default value. The *empty string* is slightly different: it indicates
        an empty default value. The difference is significant for handling
        required fields. An "empty string" default value may, depending on
        the repository type, be filled in with a default value on the server.
        One example is the default owner for a Trac ticket. If the empty
        string is given, it will be filled in with the default owner for
        that ticket's component.
    """
    def __init__(self, name, label, is_required, type,
            options=None, default=None):
        self.name = name
        self.label = label
        self.is_required = is_required
        self.type = type
        self.default = default
        self.options = options

    def __repr__(self):
        is_require_str = self.is_required and " (required)" or ""
        extras = [self.type]
        if self.default is not None:
            extras.append("default=%r" % self.default)
        if self.options is not None:
            extras.append("options=%r" % self.options)
        return "<TaskField %s%s: %s>" % (self.name, is_require_str,
            ', '.join(extras))

    def __str__(self):
        extras = []
        if self.is_required:
            extras.append("required")
        extras.append("type=%s" % self.type)
        if self.default is not None:
            extras.append("default=%r" % self.default)
        if self.options is not None:
            extras.append("options=%r" % self.options)
        return "task field %s (%s)" % (self.name, ', '.join(extras))

class Task(object):
    #if _xpcom_:
    #    _com_interfaces_ = [components.interfaces.koITask]

    id = None
    summary = None
    description = None

    def __init__(self, id, summary, description, attributes=None):
        self.id = id
        self.summary = summary
        self.description = description
        self.attributes = attributes or {}

    def __repr__(self):
        extras = []
        extra = extras and (" (%s)" % ", ".join(extras)) or ""
        summary_str = utils.one_line_summary_from_text(self.summary, 30)
        return "<Task %d: %s%s>" % (self.id, summary_str, extra)

    def __str__(self):
        summary_str = utils.one_line_summary_from_text(self.summary, 30)
        return "task %d (%s)" % (self.id, summary_str)


#TODO:XXX Make this a base class and move Trac-specific func to tasks_trac.py::TracQuery.
class Query(object):
    """A query on a task repository.
        
    @param name {str} A name for the query. Used for reference/display
        only.
    @param repo {Repository} The repository being queried.
    @param conds {list} A list of strings defining the query. The
        syntax is repository-type-specific.
    @param conds_json {str} A JSON list of conds. Either this or the
        `conds` argument must be given.

    # Trac
    
    For Trac, `conds` is a list of strings of the following form. See
    `trac/ticket/query.py::Query.from_string()` for the actual details.
        
        field=values    # is
        field=!values   # is not
        field=~values   # contains
        field=!~values  # doesn't contain
        field=^values   # startswith
        field=$values   # endswith
    
    Multiple "values" are separated by '|'. Some details on the fields:
    
        col         Columns to show. Use multiple times. Not relevant
                    for `ticket.query` because the `id` of matching tickets
                    is only ever returned
        order       'time' (aka 'created'), 'changetime' (aka 'modified'),
                    or 'priority' (the default).
        summary     The bug summary.
        group       TODO
        page        Which page of results. TODO: nice handling for paging
        max         For paging. `0` means all items in one page, else a page
                    size.
        rows        Multi-value. TODO
        desc        Boolean. TODO
        groupdesc   Boolean. TODO
        verbose     Boolean. Looks like just for compat. Modern way is
                    to include "description" in "rows", i.e.
                    "rows=description|..."
        report      If given, it is the id of a saved query. TODO: not sure
                    if this overrides all the others.
        *           Other values are put in the "constraints" list.
                    TODO: How is this used? See `trac.tickets.query`.
    
    Considerations:
    - Escaping: '=' in values, '|' in values (used to separate multiple values),
      '&' in the everything.
    - UTF-8 encoded. TODO: Need to pass that to xmlrpclib? TODO: test case
      with unicode query.
    - TODO: can "$USER" be literally used for the auth'd user?
    """
    id = None   # set when added to db (see `RepositoryDatabase.add_query`)
    def __init__(self, repo, conds=None, conds_json=None, title=None,
            nickname=None, id=None):
        self.repo = repo
        assert (conds is not None and conds_json is None
                or conds is None and conds_json is not None)
        if conds is not None:
            self.conds = conds
        else:
            self.conds = json.loads(conds_json)
        self.title = title
        self.nickname = nickname
        self.id = id

    @property
    def conds_json(self):
        return json.dumps(self.conds)

    def __repr__(self):
        # <Query 42 (nickname): conds... (extras)>
        id_str = (" %d" % self.id) if self.id else " (no id)"
        nickname_str = (" (%s)" % self.nickname) if self.nickname else ""
        extras = []
        if self.title: extras.append("title=%r" % self.title)
        extra = extras and (" (%s)" % ", ".join(extras)) or ""
        return "<Query%s%s: %s%s>" % (id_str, nickname_str, ' '.join(self.conds), extra)

    def __str__(self):
        id_str = (" %d" % self.id) if self.id else " (no id)"
        nickname_str = (" (%s)" % self.nickname) if self.nickname else ""
        return "query%s%s" % (id_str, nickname_str)

    @property
    def tasks(self):
        for task in self.repo.tasks_from_query(self):
            yield task


