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
"""Tests for zpkgtools.publication

$Id$
"""
import unittest

from zpkgsetup import publication


class DevelopmentStatusTestCase(unittest.TestCase):

    def test_set_development_status_replace_1(self):
        metadata = publication.loads(
            "Name: foo\n"
            "Classifier: Development Status:: 3 - Alpha\n")
        publication.set_development_status(metadata, publication.BETA)
        self.assertEqual(metadata.classifiers, [publication.BETA])

    def test_set_development_status_replace_2(self):
        metadata = publication.loads(
            "Name: foo\n"
            "Classifier: Environment :: Console\n"
            "Classifier: Development Status:: 3 - Alpha\n"
            "Classifier: Intended Audience :: Developers\n")
        publication.set_development_status(metadata, publication.BETA)
        self.assertEqual(metadata.classifiers, [
            "Environment :: Console",
            publication.BETA,
            "Intended Audience :: Developers",
            ])

    def test_set_development_status_append(self):
        metadata = publication.loads(
            "Name: foo\n"
            "Classifier: Environment :: Console\n"
            "Classifier: Intended Audience :: Developers\n")
        publication.set_development_status(metadata, publication.BETA)
        self.assertEqual(metadata.classifiers, [
            "Environment :: Console",
            "Intended Audience :: Developers",
            publication.BETA,
            ])


def test_suite():
    return unittest.makeSuite(DevelopmentStatusTestCase)
