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
"""Tests of zpkgtools.setup."""

import os
import unittest

from zpkgsetup import publication
from zpkgsetup import setup


here = os.path.dirname(os.path.abspath(__file__))


class SetupContextTestCase(unittest.TestCase):

    def test_python_files_as_data(self):
        packagedir = os.path.join(here, "input", "package")
        publicationcfg = os.path.join(packagedir, publication.PUBLICATION_CONF)
        setupfile = os.path.join(here, "input", "setup.py")
        f = open(publicationcfg, "w")
        f.write("Metadata-version: 1.0\n"
                "Name: foo\n")
        f.close()
        try:
            context = setup.SetupContext("package", "0.1.234", setupfile)
            context.initialize()
            context.package_data["package"].sort()
            self.assertEqual(context.package_data,
                             {"package": ["PUBLICATION.cfg",
                                          "datadir/justdata.py"]})
        finally:
            os.unlink(publicationcfg)

    def test_extension_sources_are_not_package_data(self):
        packagedir = os.path.join(here, "input", "package2")
        setupfile = os.path.join(here, "input", "setup.py")
        context = setup.SetupContext("package2", "0.1.234", setupfile)
        context.initialize()
        context.package_data["package2"].sort()
        self.assertEqual(context.package_data,
                         {"package2": ["PUBLICATION.cfg", "SETUP.cfg"]})

    def test_walk_packages(self):
        import zpkgsetup
        top = os.path.dirname(os.path.dirname(zpkgsetup.__file__))
        context = setup.SetupContext("collection", "0.1.2",
                                     os.path.join(top, "setup.py"))
        context.walk_packages("zpkgsetup/tests/input")
        exts = [ext.name for ext in context.ext_modules]
        exts.sort()
        self.assertEqual(exts, ["foo", "package2.Sample"])
        #
        # See the comments in the walk_packages() function for an
        # explanation of the limitations of the method.  The following
        # check is commented out due to the limitation, but should be
        # enabled with a proper implementation.
        #
        #context.packages.sort()
        #self.assertEqual(context.packages, ["package", "package2"])
        


def test_suite():
    return unittest.makeSuite(SetupContextTestCase)
