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
"""Zope packaging utilities runtime support.

:organization: Zope Corporation
:license: `Zope Public License, Version 2.1 (ZPL)`__
:status: Prototype implementation

This package contains the build/install support for distributions
built using the **zpkg** tool.

.. __: http://www.zope.org/Resources/ZPL/ZPL-2.1

"""


class Error(Exception):
    """Base class for exceptions raised by zpkgsetup."""
