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
"""Tests for distutils.command.build_py."""

import os
import unittest

from zpkgsetup.dist import ZPkgDistribution

from zpkgsetup.tests import support


class BuildPyTestCase(support.TempdirManager, unittest.TestCase):

    def test_package_data(self):
        sources = self.mkdtemp()
        f = open(os.path.join(sources, "__init__.py"), "w")
        f.write("# Pretend this is a package.")
        f.close()
        f = open(os.path.join(sources, "README.txt"), "w")
        f.write("Info about this package")
        f.close()

        destination = self.mkdtemp()

        dist = ZPkgDistribution({"packages": ["pkg"],
                                 "package_dir": {"pkg": sources},
                                 "package_data": {"pkg": ["README.txt"]}})
        # script_name need not exist, it just need to be initialized
        dist.script_name = os.path.join(sources, "setup.py")
        dist.command_obj["build"] = support.DummyCommand(
            force=0,
            build_lib=destination)

        cmd = dist.get_command_obj("build_py")
        cmd.compile = 1
        cmd.ensure_finalized()
        self.assertEqual(cmd.package_data, dist.package_data)

        cmd.run()

        # This makes sure the list of outputs includes byte-compiled
        # files for Python modules but not for package data files
        # (there shouldn't *be* byte-code files for those!).
        #
        pkgdest = os.path.join(destination, "pkg")
        files = os.listdir(pkgdest)
        files.sort()
        self.assertEqual(files, ["README.txt",
                                 "__init__.py",
                                 "__init__.pyc",
                                 ])


def test_suite():
    return unittest.makeSuite(BuildPyTestCase)

if __name__ == "__main__":
    unittest.main(defaultTest="test_suite")
