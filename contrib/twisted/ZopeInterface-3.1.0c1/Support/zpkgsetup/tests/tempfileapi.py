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
"""Python 2.2 compatibility code.

$Id$
"""
import os
import tempfile


try:
    from tempfile import mkdtemp
except ImportError:
    def mkdtemp(prefix=None):
        # This doesn't have the security promises of
        # tempfile.mkdtemp(), but we don't really care about those for
        # the tests.
        old_template = tempfile.template
        if prefix is not None:
            tempfile.template = prefix
        try:
            tmpdir = tempfile.mktemp()
        finally:
            tempfile.template = old_template
        os.mkdir(tmpdir)
        return tmpdir


try:
    from template import gettempdir
except ImportError:
    def gettempdir():
        return tempfile.tempdir
