#! /usr/bin/env python
#
# THIS IS A GENERATED FILE.  DO NOT EDIT THIS DIRECTLY.

# Add the Support/ directory to sys.path to get our support code:
#
import os
import sys

try:
    __file__
except NameError:
    # Python 2.2.x does not have __file__ for scripts.
    __file__ = sys.argv[0]

here = os.path.dirname(os.path.realpath(__file__))
support_dir = os.path.join(here, '..', '..', 'Support')
support_dir = os.path.normpath(support_dir)
if os.path.isdir(support_dir):
    sys.path.insert(0, support_dir)

import zpkgsetup.setup


context = zpkgsetup.setup.SetupContext(
    'zope.exceptions', None, __file__)

context.initialize()
context.setup()
