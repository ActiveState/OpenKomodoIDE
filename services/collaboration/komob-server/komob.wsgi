import os
import sys
import site
import logging

_CURDIR = os.path.dirname(os.path.abspath(__file__))
_PY_VER = sys.version.split()[0][:3]

# detecting if virtualenv was used in this dir
_SITE_PKG = os.path.join(_CURDIR, 'lib', 'python' + _PY_VER, 'site-packages')
if os.path.exists(_SITE_PKG):
    # adding virtualenv's site-package and ordering paths
    saved = sys.path[:]
    site.addsitedir(_SITE_PKG)
    for path in sys.path:
        if path not in saved:
            saved.insert(0, path)
    sys.path[:] = saved

# setting up the egg cache to a place where apache can write
os.environ['PYTHON_EGG_CACHE'] = '/tmp/python-eggs'

# Set up logging
logging.basicConfig(level=logging.WARN)

# Set up app
if not 'KOMOB_SETTINGS' in os.environ:
    os.environ['KOMOB_SETTINGS'] = os.path.join(_CURDIR, 'settings.py')

from komob import app
application = app
