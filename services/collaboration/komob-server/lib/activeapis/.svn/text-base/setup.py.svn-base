import distribute_setup
distribute_setup.use_setuptools()

import sys
from os import path

from setuptools import setup, find_packages


pkgdir = path.abspath(path.join(path.dirname(__file__), 'lib'))
version = open(path.join(pkgdir, 'activeapis2', 'VERSION.txt')).read().strip()

# make sure that we import lib/activeapis2 (and not the system-wide one)
sys.path.insert(0, pkgdir)

# prevent attempts to register internal packages in PyPI
for cmd in ('register', 'upload'):
    if cmd in sys.argv:
        raise SystemExit, 'error: cannot "%s" internal packages in PyPI' % cmd

setup(
    name = 'activeapis2',
    version = version,
    url = 'http://www.activestate.com/',
    description='bindings for internal *.activestate.com site APIs',
    author='Trent Mick',
    author_email='trentm@activestate.com',

    package_dir = {'': 'lib'},     # tell distutils packages are under lib/
    packages=find_packages('lib'), # include all packages under lib/
    
    install_requires=['distribute',
                      'httplib2',
                      'simplejson',
                      ],
    )
