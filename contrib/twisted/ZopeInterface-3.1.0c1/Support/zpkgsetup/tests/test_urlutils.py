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
"""Tests for zpkgtools.urlutils."""

import sys
import unittest

from zpkgsetup import urlutils

__docformat__ = "reStructuredText"


class WindowsUrlutilsTestCase(unittest.TestCase):
    """Tests of Windows path-to-URL conversions.

    This should only be used on Windows systems.
    """

    def test_file_url_with_drive_letter(self):
        self.assertEqual(urlutils.file_url("c:\\some\\file.txt"),
                         "file:///C|/some/file.txt")
        self.assertEqual(urlutils.file_url("c:some\\file.txt"),
                         "file:///C|/some/file.txt")
        self.assertEqual(urlutils.file_url("\\some\\folder"),
                         "file:///some/folder")
        self.assertEqual(urlutils.file_url("\\some\\folder\\"),
                         "file:///some/folder")

    def test_file_url_without_drive_letter(self):
        self.assertEqual(urlutils.file_url("\\some\\file.txt"),
                         "file:///some/file.txt")
        self.assertEqual(urlutils.file_url("\\some\\folder"),
                         "file:///some/folder")
        self.assertEqual(urlutils.file_url("\\some\\folder\\"),
                         "file:///some/folder")

    def test_pathname2url_with_drive_letter(self):
        self.assertEqual(urlutils.pathname2url("c:\\some\\file.txt"),
                         "/C|/some/file.txt")
        self.assertEqual(urlutils.pathname2url("c:some\\file.txt"),
                         "/C|/some/file.txt")
        self.assertEqual(urlutils.pathname2url("\\some\\folder"),
                         "/some/folder")
        self.assertEqual(urlutils.pathname2url("\\some\\folder\\"),
                         "/some/folder")

    def test_pathname2url_without_drive_letter(self):
        self.assertEqual(urlutils.pathname2url("\\some\\file.txt"),
                         "/some/file.txt")
        self.assertEqual(urlutils.pathname2url("\\some\\folder"),
                         "/some/folder")
        self.assertEqual(urlutils.pathname2url("\\some\\folder\\"),
                         "/some/folder")


class PosixUrlutilsTestCase(unittest.TestCase):
    """Tests of POSIX path-to-URL conversions.

    This should only be used on Unix-like systems.
    """
    def test_file_url(self):
        self.assertEqual(urlutils.file_url("/some/file.txt"),
                         "file:///some/file.txt")
        self.assertEqual(urlutils.file_url("/some/folder"),
                         "file:///some/folder")
        self.assertEqual(urlutils.file_url("/some/folder/"),
                         "file:///some/folder")

    def test_pathname2url(self):
        self.assertEqual(urlutils.pathname2url("/some/file.txt"),
                         "/some/file.txt")
        self.assertEqual(urlutils.pathname2url("/some/folder"),
                         "/some/folder")
        self.assertEqual(urlutils.pathname2url("/some/folder/"),
                         "/some/folder")


def test_suite():
    if sys.platform[:3].lower().startswith("win"):
        testcls = WindowsUrlutilsTestCase
    else:
        testcls = PosixUrlutilsTestCase
    return unittest.makeSuite(testcls)
