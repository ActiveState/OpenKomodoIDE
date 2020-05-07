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
"""Tests for zpkgsetup.dist.

$Id$
"""
import unittest

from zpkgsetup import dist


class ZPkgDistributionTestCase(unittest.TestCase):

    def test_package_data_recognized(self):
        # Make sure the package_data keyword isn't dropped:
        package_data = {"pkg": ["foo.h"]}
        d = dist.ZPkgDistribution({"package_data": package_data,
                                   "packages": ["pkg"]})
        self.assertEqual(d.package_data, package_data)
        # Make sure the build_py command object sees it:
        cmd = d.get_command_obj("build_py")
        cmd.ensure_finalized()
        self.assertEqual(cmd.package_data, package_data)

    def test_classifiers_recognized(self):
        # Make sure the classifiers keyword isn't dropped:
        classifiers = ["foo", "bar"]
        d = dist.ZPkgDistribution({"classifiers": classifiers})
        self.assertEqual(d.metadata.classifiers, classifiers)


def test_suite():
    return unittest.makeSuite(ZPkgDistributionTestCase)
