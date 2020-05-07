#!/usr/bin/env python
# Copyright (c) 2004-2006 ActiveState Software Inc.
#
# Contributors:
#   Trent Mick (TrentM@ActiveState.com)

import sys, webbrowser

def _url_from_local_path(local_path):
    # HACKy: This isn't super-robust.
    from os.path import abspath, normpath
    url = normpath(abspath(local_path))
    if sys.platform == "win32":
        url = "file:///" + url.replace('\\', '/')
    else:
        url = "file://" + url
    return url


def main(argv):
    htmlfile = argv[1]
    url = _url_from_local_path(htmlfile)
    webbrowser.open_new(url)
    

if __name__ == "__main__":
    sys.exit( main(sys.argv) )
