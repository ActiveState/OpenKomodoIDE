##############################################################################
#
# Copyright (c) 2005 Zope Corporation and Contributors.
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
"""Miscellaneous utilities."""

__all__ = ["rmtree_force",
          ]

def rmtree_force(path):
    """Like shutil.rmtree(path), but deletes read-only files too.

    This is an important distinction on Windows, where a file marked
    read-only cannot be deleted by os.remove().
    """

    import shutil
    import os

    if not os.path.exists(path):
        return

    # Python 2.4's rmtree has a sufficient error hook, but 2.3's does not.
    # So, make everything readable first by walking the tree.
    for root, dirs, files in os.walk(path):
        for fname in files:
            os.chmod(os.path.join(root, fname), 0666)

    shutil.rmtree(path)
