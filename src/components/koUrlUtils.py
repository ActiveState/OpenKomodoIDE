#!/usr/bin/env python
# Copyright (c) 2001-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
import sys
import urlparse
from xpcom import components
import logging


log = logging.getLogger("koUrlUtils")


# 2009-02-03: No Komodo core code is currently using this class.
class koUrlUtils:
    _com_interfaces_ = [components.interfaces.koIUrlUtils]
    _reg_clsid_ = "{0f5df15b-88fd-4b3e-b8cc-e8f001d845fd}"
    _reg_contractid_ = "@activestate.com/koUrlUtils;1"
    _reg_desc_ = "Dumping ground for URL-related utility functions"
            
    if sys.platform == "win32":
        def _fixPath(self, url):
            path = urlparse.urlparse(url)[2]
            # URLs come from different sources, and sometimes use "|" instead of ":"
            # Also Python's urlparse.urlparse puts a '/' at the start of paths,
            # for URIs that start with the correct "file:///C:...",
            # and behave correctly for two-slashes ("file://C:...")
            if len(path) > 3 and path[0] == '/' and path[2] in ":|":
                # e.g. map "/C|" to "C:"
                # Assume path[1] is a letter
                path = path[1] + ":" + path[3:]
            return os.path.normpath(os.path.normcase(path))
    else:
        def _fixPath(self, url):
            # No need to normcase OSX paths,
            # because os.path.samefile will correctly ignore case.
            return os.path.normpath(urlparse.urlparse(url)[2])

    def sameURL(self, url1, url2):
        if url1 and url2 and url1.startswith('file:///') and url2.startswith('file:///'):
            path1 = self._fixPath(url1)
            path2 = self._fixPath(url2)
            
            if sys.platform.startswith("win"):
                return path1 == path2            
            else:
                try:
                    return os.path.samefile(path1, path2)
                except Exception, e:
                    log.debug("Could not compare files: %r [%r]", e, e.args)
                    return path1 == path2
        else:
            return url1 == url2
