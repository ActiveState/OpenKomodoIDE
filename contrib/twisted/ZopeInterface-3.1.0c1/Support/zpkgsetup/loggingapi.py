##############################################################################
#
# Copyright (c) 2004 Zope Corporation and Contributors.
# All Rights Reserved.
#
# This software is subject to the provisions of the Zope Public License,
# Version 2.1 (ZPL).  A copy of the ZPL should accompany this distribution.
# THIS SOFTWARE IS PROVIDED "AS IS" AND ANY AND ALL EXPRESS OR IMPLIED
# WARRANTIES ARE DISCLAIMED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
# WARRANTIES OF TITLE, MERCHANTABILITY, AGAINST INFRINGEMENT, AND FITNESS
# FOR A PARTICULAR PURPOSE.
#
##############################################################################
"""Compatibility wrapper around the logging package.

If the logging package isn't available (as in Python 2.2), this
provides a limited implementation so the zpkgtools setup.py support
code doesn't fall over.

This isn't sufficient to support building packages with Python 2.2.

$Id$
"""

try:
    from logging import getLogger
    from logging import CRITICAL, FATAL, ERROR, WARNING, WARN
    from logging import INFO, DEBUG, NOTSET
    from logging import Handler, StreamHandler

except ImportError:

    CRITICAL = 50
    FATAL = CRITICAL
    ERROR = 40
    WARNING = 30
    WARN = WARNING
    INFO = 20
    DEBUG = 10
    NOTSET = 0


    _loggers = {}

    def getLogger(name=None):
        if "root" not in _loggers:
            _loggers["root"] = Logger("root")
            _loggers["root"].setLevel(WARNING)
        name = name or "root"
        if name not in _loggers:
            _loggers[name] = Logger(name, _loggers["root"])
        return _loggers[name]


    class Logger:

        def __init__(self, name, root=None):
            self.name = name
            self.level = NOTSET
            self._handler = None
            self._root = root

        def setLevel(self, level):
            self.level = level

        def addHandler(self, handler):
            self._handler = handler

        def log(self, level, msg, *args, **kwargs):
            loggers = [self]
            if self._root is not None:
                loggers.append(self._root)

            for logger in loggers:
                effective_level = logger.level
                if effective_level == NOTSET and logger._root is not None:
                    effective_level = self._root.level
                if level >= effective_level:
                    self._log(self.name, level, msg, args, kwargs)

        def _log(self, name, level, msg, args, kwargs):
            if args:
                msg = msg % args
            elif kwargs:
                msg = msg % kwargs
            msg = "%s(%s):%s" % (name, level, msg)
            print >>self._handler, msg


    class Handler:

        def __init__(self):
            pass


    def StreamHandler():
        import sys
        return sys.stderr
