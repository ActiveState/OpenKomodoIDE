#! /usr/bin/env python

import os.path
import zpkgsetup.publication
import zpkgsetup.setup

try:
    __file__
except NameError:
    # Python 2.2.x does not have __file__ for scripts.
    __file__ = sys.argv[0]

here = os.path.dirname(__file__)


context = zpkgsetup.setup.SetupContext('zpkgsetup', None, __file__)

pkgdir = os.path.join(here, 'zpkgsetup')
context.load_metadata(os.path.join(pkgdir,
                                   zpkgsetup.publication.PUBLICATION_CONF))
context.scan('zpkgsetup', pkgdir, 'zpkgsetup')
context.setup()
