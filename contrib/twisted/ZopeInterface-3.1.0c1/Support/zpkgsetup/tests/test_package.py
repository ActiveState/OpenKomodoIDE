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
"""Tests for zpkgtools.package."""

import doctest
import os.path
import shutil
import unittest

from distutils.core import Extension
from StringIO import StringIO

from zpkgsetup import cfgparser
from zpkgsetup import package
from zpkgsetup.tests import tempfileapi as tempfile


class PackageInfoTestCase(unittest.TestCase):

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="test_package_")

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def write_config(self, text):
        self.write_file(package.PACKAGE_CONF, text)

    def write_file(self, name, text):
        f = open(os.path.join(self.tmpdir, name), "w")
        f.write(text)
        f.close()

    def test_empty_pkginfo(self):
        self.write_config("# empty configuration file\n")
        pkginfo = package.loadPackageInfo("foo", self.tmpdir, "bar")
        eq = self.assertEqual
        eq(pkginfo.extensions, [])
        eq(pkginfo.documentation, [])
        eq(pkginfo.script, [])

    def test_missing_pkginfo(self):
        pkginfo = package.loadPackageInfo("foo", self.tmpdir, "bar")
        eq = self.assertEqual
        eq(pkginfo.extensions, [])
        eq(pkginfo.documentation, [])
        eq(pkginfo.script, [])

    def test_nonempty_pkginfo(self):
        self.write_config("documentation  doc/README.txt\n"
                          "script         bin/runme.py\n"
                          "<extension cricket>\n"
                          "  source     jiminy.c\n"
                          "  define     FOO\n"
                          "  define     BAR = splat\n"
                          "  undefine   CRUNCHY NUGGET\n"
                          "  depends-on cricket.h\n"
                          "  depends-on innerds.c\n"
                          "  language   C\n"
                          "</extension>\n")
        os.mkdir(os.path.join(self.tmpdir, "doc"))
        self.write_file(os.path.join("doc", "README.txt"),
                        "docs go here")
        os.mkdir(os.path.join(self.tmpdir, "bin"))
        self.write_file(os.path.join("bin", "runme.py"),
                        "#!/bin/sh\nexit\n")
        pkginfo = package.loadPackageInfo("foo", self.tmpdir, "bar")
        eq = self.assertEqual
        eq(len(pkginfo.extensions), 1)
        eq(pkginfo.documentation, ["bar/doc/README.txt"])
        eq(pkginfo.script, ["bar/bin/runme.py"])

        ext = pkginfo.extensions[0]
        self.assert_(isinstance(ext, Extension))
        eq(ext.name, "foo.cricket")
        eq(ext.sources, ["bar/jiminy.c"])
        eq(ext.depends, ["bar/cricket.h", "bar/innerds.c"])
        eq(ext.define_macros, [("FOO", None), ("BAR", "splat")])
        eq(ext.undef_macros, ["CRUNCHY", "NUGGET"])
        eq(ext.language, "C")

    def test_broken_extension_too_many_languages(self):
        self.write_config("<extension cricket>\n"
                          "  source     jiminy.c\n"
                          "  language   C\n"
                          "  language   C++\n"
                          "</extension>\n")
        self.assertRaises(cfgparser.ConfigurationError,
                          package.loadPackageInfo, "foo", self.tmpdir, "bar")

    def test_broken_extension_without_name(self):
        self.write_config("<extension>\n"
                          "  source  jiminy.c\n"
                          "</extension>\n")
        self.assertRaises(cfgparser.ConfigurationError,
                          package.loadPackageInfo, "foo", self.tmpdir, "bar")

    def test_broken_extension_no_source(self):
        self.write_config("<extension cricket/>")
        self.assertRaises(cfgparser.ConfigurationError,
                          package.loadPackageInfo, "foo", self.tmpdir, "bar")

    def test_collection_empty_pkginfo(self):
        self.write_config("# empty configuration file\n")
        pkginfo = package.loadCollectionInfo(self.tmpdir, None)
        eq = self.assertEqual
        eq(pkginfo.extensions, [])
        eq(pkginfo.documentation, [])
        eq(pkginfo.script, [])

    def test_collection_missing_pkginfo(self):
        pkginfo = package.loadCollectionInfo(self.tmpdir, None)
        eq = self.assertEqual
        eq(pkginfo.extensions, [])
        eq(pkginfo.documentation, [])
        eq(pkginfo.script, [])

    def test_collection_pkginfo(self):
        self.write_config("documentation  doc/*\n"
                          "script         bin/*.py\n")
        os.mkdir(os.path.join(self.tmpdir, "doc"))
        self.write_file(os.path.join("doc", "README.txt"),
                        "docs go here")
        os.mkdir(os.path.join(self.tmpdir, "bin"))
        self.write_file(os.path.join("bin", "runme.py"),
                        "#!/bin/sh\nexit\n")
        pkginfo = package.loadCollectionInfo(self.tmpdir, None)
        eq = self.assertEqual
        eq(len(pkginfo.extensions), 0)
        eq(pkginfo.documentation, ["doc/README.txt"])
        eq(pkginfo.script, ["bin/runme.py"])

    def test_collection_pkginfo_allows_extensions(self):
        self.write_config("<extension foo>\n"
                          "  source  foo.c\n"
                          "</extension>\n")
        pkginfo = package.loadCollectionInfo(self.tmpdir, ".")
        self.assertEqual(len(pkginfo.extensions), 1)
        self.assertEqual(pkginfo.extensions[0].name, "foo")

    def test_data_files_1(self):
        self.write_config("<data-files etc>\n"
                          "  foo*\n"
                          "</data-files>\n")
        self.write_file("foo1.conf", "config goes here")
        self.write_file("foo2.conf", "config goes here")
        pkginfo = package.loadCollectionInfo(self.tmpdir, None)
        pkginfo.data_files[0][1].sort()
        self.assertEqual(pkginfo.data_files,
                         [("etc", ["foo1.conf", "foo2.conf"])])

    def test_data_files_2(self):
        self.write_config("<data-files var>\n"
                          "  foo2.conf\n"
                          "</data-files>\n"
                          "<data-files etc>\n"
                          "  foo1.conf\n"
                          "</data-files>\n")
        self.write_file("foo1.conf", "config goes here")
        self.write_file("foo2.conf", "config goes here")
        pkginfo = package.loadCollectionInfo(self.tmpdir, None)
        pkginfo.data_files.sort()
        self.assertEqual(pkginfo.data_files,
                         [("etc", ["foo1.conf"]),
                           ("var", ["foo2.conf"])])

    def test_data_files_error_has_value(self):
        self.write_config("<data-files etc>\n"
                          "  foo bar\n"
                          "</data-files>\n")
        self.assertRaises(cfgparser.ConfigurationError,
                          package.loadCollectionInfo, self.tmpdir, None)

    def test_data_files_error_has_nested_section(self):
        self.write_config("<data-files etc>\n"
                          "  <extension foo>\n"
                          "  </extension>\n"
                          "</data-files>\n")
        self.assertRaises(cfgparser.ConfigurationError,
                          package.loadCollectionInfo, self.tmpdir, None)

    def test_data_files_error_section_without_name(self):
        self.write_config("<data-files>\n"
                          "</data-files>\n")
        self.assertRaises(cfgparser.ConfigurationError,
                          package.loadCollectionInfo, self.tmpdir, None)

    def test_data_files_error_sections_with_same_name(self):
        self.write_config("<data-files etc>\n"
                          "</data-files>\n"
                          "<data-files etc/>\n"
                          "</data-files>\n")
        self.assertRaises(cfgparser.ConfigurationError,
                          package.loadCollectionInfo, self.tmpdir, None)


def test_suite():
    suite = unittest.TestSuite()
    if hasattr(doctest, "DocTestSuite"):
        # Python 2.2.x has no DocTestSuite
        suite.addTest(doctest.DocTestSuite("zpkgsetup.package"))
    suite.addTest(unittest.makeSuite(PackageInfoTestCase))
    return suite

if __name__ == "__main__":
    unittest.main(defaultTest="test_suite")
