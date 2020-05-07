#!/usr/bin/env python
# Copyright (c) 2009-2010 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

# Stub module that is loaded when a database adaptor
# can't be loaded


class MissingAdaptor(object):
    def __init__(self):
        self.adaptorName = None
        self.loaded = False

    class OperationalError(Exception):
        pass

    class DatabaseError(Exception):
        pass

    class IntegrityError(Exception):
        pass

    def connect(self, *args, **kwargs):
        if self.adaptorName:
            raise NotImplementedError("Database adaptor '%s' not loaded" % self.adaptorName)
        else:
            raise NotImplementedError("Database adaptor not loaded")

    
