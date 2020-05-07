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
"""Hacked install_lib command to deal with package_data for Python before 2.4.

$Id$
"""
import os

from distutils.command.install_lib import install_lib as _install_lib


# Extension for Python source files.
PYTHON_SOURCE_EXTENSION = os.extsep + "py"


class install_lib(_install_lib):
    """install_lib variant with package_data support.

    This overrides the _bytecode_filenames() helper method to
    accomodate the fact that it can now be called with names other
    than Python source files due to the package_data support.
    
    This is only needed when the zpkgsetup.build_py implementation is
    used; this is ensured by the `zpkgsetup.dist.ZPkgDistribution`
    class.

    """

    def _bytecode_filenames (self, py_filenames):
        bytecode_files = []
        for py_file in py_filenames:
            # Since build_py handles package data installation, the
            # list of outputs can contain more than just .py files.
            # Make sure we only report bytecode for the .py files.
            ext = os.path.splitext(os.path.normcase(py_file))[1]
            if ext != PYTHON_SOURCE_EXTENSION:
                continue
            if self.compile:
                bytecode_files.append(py_file + "c")
            if self.optimize > 0:
                bytecode_files.append(py_file + "o")

        return bytecode_files
