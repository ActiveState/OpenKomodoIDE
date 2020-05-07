
#TODO:
# - redirect RemoteDebugging/
#   - latest symlink
#   - http://aspn.activestate.com/ASPN/Downloads/Komodo/RemoteDebugging
#     drop 1.2.x and 2.x section
#   - uncomment and put up .htaccess
#     *test* these redirects with .htaccess up before removing
# - shouldn't this use [R=permanent,L]?
#  http://httpd.apache.org/docs/1.3/mod/mod_rewrite.html#RewriteRule

import os
from os.path import *
import sys
from pprint import pprint
from posixpath import join as ujoin
import urllib2
from urlparse import urlparse
import httplib

#redirects_htaccess_path = "crimper:/home/trentm/tmp/komodo_downloads/.htaccess"


class Error(Exception):
    pass


def check_htaccess_rules():
    for rule in rules_from_htaccess(g_htaccess):
        print
        print "--- check redirect"
        print "  from: ", rule[0]
        length_from = _content_length_from_url(rule[0])
        print "    to: ", rule[1]
        length_to = _content_length_from_url(rule[0])
        if length_to == length_from == None:
            print "skip (no content-length info, probably a dir)"
        elif length_to != length_from:
            raise Error("content lengths don't match: %s != %s"
                        % (length_from, length_to))
        #print rule

def expected_redirs_from_htaccess_rules():
    for rule in rules_from_htaccess(g_htaccess):
        print '    "%s":' % rule[0]
        print '      "%s",' % rule[1]
        continue
        print
        print "--- check redirect"
        print "  from: ", rule[0]
        length_from = _content_length_from_url(rule[0])
        print "    to: ", rule[1]
        length_to = _content_length_from_url(rule[0])
        if length_to == length_from == None:
            print "skip (no content-length info, probably a dir)"
        elif length_to != length_from:
            raise Error("content lengths don't match: %s != %s"
                        % (length_from, length_to))
        #print rule

def check_redirects():
    #conn = httplib.HTTPConnection("www.activestate.com")
    conn = None
    try:
        for url, redir in g_expected_redirs.items():
            print
            print "--- check redirect"
            print "     from: ", url
            print "       to: ", redir
            scheme, netloc, path, params, query, fragment = urlparse(url)
            print "     path: ", path
            assert scheme == "http"
            assert "activestate.com" in netloc
            if conn is None:
                conn = httplib.HTTPConnection(netloc)
            elif netloc != conn.host:
                conn.close()
                conn = httplib.HTTPConnection(netloc)

            conn.request("GET", path)
            r = conn.getresponse()
            print "   status: ", r.status
            assert r.status == 302
            location = r.getheader("location")
            print " location: ", location
            assert location == redir
    finally:
        if conn:
            conn.close()


g_expected_redirs = {
    # Sanity check
    "http://www.activestate.com/Products/komodo_edit/":
        "http://www.activestate.com/Products/komodo_ide/komodo_edit.mhtml",

    "http://downloads.activestate.com/Komodo/releases/latest/":
        "http://downloads.activestate.com/Komodo/releases/4.3.0/",

    "http://downloads.activestate.com/Komodo/Linux/4.3/Komodo-Edit-4.3.0-beta2-993-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b2/Komodo-Edit-4.3.0-beta2-993-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.3/Komodo-Edit-4.3.0-beta2-993-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b2/Komodo-Edit-4.3.0-beta2-993-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.3/Komodo-Edit-4.3.0-beta2-993-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b2/Komodo-Edit-4.3.0-beta2-993-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.3/Komodo-Edit-4.3.0-beta2-993.msi":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b2/Komodo-Edit-4.3.0-beta2-993.msi",
    "http://downloads.activestate.com/Komodo/Linux/4.3/Komodo-IDE-4.3.0-beta2-15465-linux-libcpp5-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b2/Komodo-IDE-4.3.0-beta2-15465-linux-libcpp5-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/Linux/4.3/Komodo-IDE-4.3.0-beta2-15465-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b2/Komodo-IDE-4.3.0-beta2-15465-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.3/Komodo-IDE-4.3.0-beta2-15465-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b2/Komodo-IDE-4.3.0-beta2-15465-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.3/Komodo-IDE-4.3.0-beta2-15465-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b2/Komodo-IDE-4.3.0-beta2-15465-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.3/Komodo-IDE-4.3.0-beta2-15465.msi":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b2/Komodo-IDE-4.3.0-beta2-15465.msi",
    "http://downloads.activestate.com/Komodo/Linux/4.3/Komodo-Edit-4.3.0-beta1-962-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b1/Komodo-Edit-4.3.0-beta1-962-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.3/Komodo-Edit-4.3.0-beta1-962-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b1/Komodo-Edit-4.3.0-beta1-962-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.3/Komodo-Edit-4.3.0-beta1-962-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b1/Komodo-Edit-4.3.0-beta1-962-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.3/Komodo-Edit-4.3.0-beta1-962.msi":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b1/Komodo-Edit-4.3.0-beta1-962.msi",
    "http://downloads.activestate.com/Komodo/Linux/4.3/Komodo-IDE-4.3.0-beta1-15255-linux-libcpp5-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b1/Komodo-IDE-4.3.0-beta1-15255-linux-libcpp5-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/Linux/4.3/Komodo-IDE-4.3.0-beta1-15255-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b1/Komodo-IDE-4.3.0-beta1-15255-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.3/Komodo-IDE-4.3.0-beta1-15255-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b1/Komodo-IDE-4.3.0-beta1-15255-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.3/Komodo-IDE-4.3.0-beta1-15255-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b1/Komodo-IDE-4.3.0-beta1-15255-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.3/Komodo-IDE-4.3.0-beta1-15255.msi":
      "http://downloads.activestate.com/Komodo/releases/4.3.0b1/Komodo-IDE-4.3.0-beta1-15255.msi",
    "http://downloads.activestate.com/Komodo/Linux/4.3/Komodo-Edit-4.3.0-alpha2-889-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a2/Komodo-Edit-4.3.0-alpha2-889-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.3/Komodo-Edit-4.3.0-alpha2-889-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a2/Komodo-Edit-4.3.0-alpha2-889-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.3/Komodo-Edit-4.3.0-alpha2-889-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a2/Komodo-Edit-4.3.0-alpha2-889-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.3/Komodo-Edit-4.3.0-alpha2-889.msi":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a2/Komodo-Edit-4.3.0-alpha2-889.msi",
    "http://downloads.activestate.com/Komodo/Linux/4.3/Komodo-IDE-4.3.0-alpha2-15053-linux-libcpp5-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a2/Komodo-IDE-4.3.0-alpha2-15053-linux-libcpp5-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/Linux/4.3/Komodo-IDE-4.3.0-alpha2-15053-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a2/Komodo-IDE-4.3.0-alpha2-15053-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.3/Komodo-IDE-4.3.0-alpha2-15053-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a2/Komodo-IDE-4.3.0-alpha2-15053-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.3/Komodo-IDE-4.3.0-alpha2-15053-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a2/Komodo-IDE-4.3.0-alpha2-15053-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.3/Komodo-IDE-4.3.0-alpha2-15053.msi":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a2/Komodo-IDE-4.3.0-alpha2-15053.msi",
    "http://downloads.activestate.com/Komodo/Linux/4.3/Komodo-Edit-4.3.0-alpha1-794-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a1/Komodo-Edit-4.3.0-alpha1-794-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.3/Komodo-Edit-4.3.0-alpha1-794-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a1/Komodo-Edit-4.3.0-alpha1-794-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.3/Komodo-Edit-4.3.0-alpha1-794-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a1/Komodo-Edit-4.3.0-alpha1-794-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.3/Komodo-Edit-4.3.0-alpha1-794.msi":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a1/Komodo-Edit-4.3.0-alpha1-794.msi",
    "http://downloads.activestate.com/Komodo/Linux/4.3/Komodo-IDE-4.3.0-alpha1-14562-linux-libcpp5-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a1/Komodo-IDE-4.3.0-alpha1-14562-linux-libcpp5-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/Linux/4.3/Komodo-IDE-4.3.0-alpha1-14562-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a1/Komodo-IDE-4.3.0-alpha1-14562-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.3/Komodo-IDE-4.3.0-alpha1-14562-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a1/Komodo-IDE-4.3.0-alpha1-14562-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.3/Komodo-IDE-4.3.0-alpha1-14562-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a1/Komodo-IDE-4.3.0-alpha1-14562-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.3/Komodo-IDE-4.3.0-alpha1-14562.msi":
      "http://downloads.activestate.com/Komodo/releases/4.3.0a1/Komodo-IDE-4.3.0-alpha1-14562.msi",

    "http://downloads.activestate.com/Komodo/Linux/4.2/Komodo-Edit-4.2.1-283000-linux-libcpp5-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.2.1/Komodo-Edit-4.2.1-283000-linux-libcpp5-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/Linux/4.2/Komodo-Edit-4.2.1-283000-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.2.1/Komodo-Edit-4.2.1-283000-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.2/Komodo-Edit-4.2.1-283000-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.2.1/Komodo-Edit-4.2.1-283000-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.2/Komodo-Edit-4.2.1-283000-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.2.1/Komodo-Edit-4.2.1-283000-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.2/Komodo-Edit-4.2.1-283000.msi":
      "http://downloads.activestate.com/Komodo/releases/4.2.1/Komodo-Edit-4.2.1-283000.msi",
    "http://downloads.activestate.com/Komodo/Linux/4.2/Komodo-IDE-4.2.1-283000-linux-libcpp5-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.2.1/Komodo-IDE-4.2.1-283000-linux-libcpp5-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/Linux/4.2/Komodo-IDE-4.2.1-283000-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.2.1/Komodo-IDE-4.2.1-283000-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.2/Komodo-IDE-4.2.1-283000-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.2.1/Komodo-IDE-4.2.1-283000-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.2/Komodo-IDE-4.2.1-283000-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.2.1/Komodo-IDE-4.2.1-283000-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.2/Komodo-IDE-4.2.1-283000.msi":
      "http://downloads.activestate.com/Komodo/releases/4.2.1/Komodo-IDE-4.2.1-283000.msi",
    "http://downloads.activestate.com/Komodo/Linux/4.2/Komodo-Edit-4.2.0-281898-linux-libcpp5-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.2.0/Komodo-Edit-4.2.0-281898-linux-libcpp5-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/Linux/4.2/Komodo-Edit-4.2.0-281898-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.2.0/Komodo-Edit-4.2.0-281898-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.2/Komodo-Edit-4.2.0-281898-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.2.0/Komodo-Edit-4.2.0-281898-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.2/Komodo-Edit-4.2.0-281898-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.2.0/Komodo-Edit-4.2.0-281898-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.2/Komodo-Edit-4.2.0-281898.msi":
      "http://downloads.activestate.com/Komodo/releases/4.2.0/Komodo-Edit-4.2.0-281898.msi",
    "http://downloads.activestate.com/Komodo/Linux/4.2/Komodo-IDE-4.2.0-281898-linux-libcpp5-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.2.0/Komodo-IDE-4.2.0-281898-linux-libcpp5-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/Linux/4.2/Komodo-IDE-4.2.0-281898-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/4.2.0/Komodo-IDE-4.2.0-281898-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.2/Komodo-IDE-4.2.0-281898-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.2.0/Komodo-IDE-4.2.0-281898-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.2/Komodo-IDE-4.2.0-281898-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/4.2.0/Komodo-IDE-4.2.0-281898-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.2/Komodo-IDE-4.2.0-281898.msi":
      "http://downloads.activestate.com/Komodo/releases/4.2.0/Komodo-IDE-4.2.0-281898.msi",

    "http://downloads.activestate.com/Komodo/Linux/4.1/Komodo-Edit-4.1.1-279677-linux-libcpp5-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/Komodo-Edit-4.1.1-279677-linux-libcpp5-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/Linux/4.1/Komodo-Edit-4.1.1-279677-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/Komodo-Edit-4.1.1-279677-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.1/Komodo-Edit-4.1.1-279677-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/Komodo-Edit-4.1.1-279677-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.1/Komodo-Edit-4.1.1-279677-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/Komodo-Edit-4.1.1-279677-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.1/Komodo-Edit-4.1.1-279677.msi":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/Komodo-Edit-4.1.1-279677.msi",
    "http://downloads.activestate.com/Komodo/Linux/4.1/Komodo-IDE-4.1.1-279677-linux-libcpp5-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/Komodo-IDE-4.1.1-279677-linux-libcpp5-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/Linux/4.1/Komodo-IDE-4.1.1-279677-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/Komodo-IDE-4.1.1-279677-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.1/Komodo-IDE-4.1.1-279677-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/Komodo-IDE-4.1.1-279677-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.1/Komodo-IDE-4.1.1-279677-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/Komodo-IDE-4.1.1-279677-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.1/Komodo-IDE-4.1.1-279677.msi":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/Komodo-IDE-4.1.1-279677.msi",

    "http://downloads.activestate.com/Komodo/Linux/4.0/Komodo-Edit-4.0.3-278227-linux-libcpp5-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/Komodo-Edit-4.0.3-278227-linux-libcpp5-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/Linux/4.0/Komodo-Edit-4.0.3-278227-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/Komodo-Edit-4.0.3-278227-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.0/Komodo-Edit-4.0.3-278227-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/Komodo-Edit-4.0.3-278227-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.0/Komodo-Edit-4.0.3-278227-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/Komodo-Edit-4.0.3-278227-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.0/Komodo-Edit-4.0.3-278227.msi":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/Komodo-Edit-4.0.3-278227.msi",
    "http://downloads.activestate.com/Komodo/Linux/4.0/Komodo-IDE-4.0.3-278227-linux-libcpp5-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/Komodo-IDE-4.0.3-278227-linux-libcpp5-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/Linux/4.0/Komodo-IDE-4.0.3-278227-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/Komodo-IDE-4.0.3-278227-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.0/Komodo-IDE-4.0.3-278227-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/Komodo-IDE-4.0.3-278227-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.0/Komodo-IDE-4.0.3-278227-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/Komodo-IDE-4.0.3-278227-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.0/Komodo-IDE-4.0.3-278227.msi":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/Komodo-IDE-4.0.3-278227.msi",
    "http://downloads.activestate.com/Komodo/Linux/4.0/Komodo-Edit-4.0.2-275451-linux-libcpp5-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.2/Komodo-Edit-4.0.2-275451-linux-libcpp5-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/Linux/4.0/Komodo-Edit-4.0.2-275451-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.2/Komodo-Edit-4.0.2-275451-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.0/Komodo-Edit-4.0.2-275451-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.2/Komodo-Edit-4.0.2-275451-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.0/Komodo-Edit-4.0.2-275451-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.2/Komodo-Edit-4.0.2-275451-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.0/Komodo-Edit-4.0.2-275451.msi":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.2/Komodo-Edit-4.0.2-275451.msi",
    "http://downloads.activestate.com/Komodo/Linux/4.0/Komodo-IDE-4.0.2-275451-linux-libcpp5-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.2/Komodo-IDE-4.0.2-275451-linux-libcpp5-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/Linux/4.0/Komodo-IDE-4.0.2-275451-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.2/Komodo-IDE-4.0.2-275451-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.0/Komodo-IDE-4.0.2-275451-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.2/Komodo-IDE-4.0.2-275451-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.0/Komodo-IDE-4.0.2-275451-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.2/Komodo-IDE-4.0.2-275451-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.0/Komodo-IDE-4.0.2-275451.msi":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.2/Komodo-IDE-4.0.2-275451.msi",
    "http://downloads.activestate.com/Komodo/Linux/4.0/Komodo-IDE-4.0.1-274919-linux-libcpp5-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.1/Komodo-IDE-4.0.1-274919-linux-libcpp5-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/Linux/4.0/Komodo-IDE-4.0.1-274919-linux-libcpp6-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.1/Komodo-IDE-4.0.1-274919-linux-libcpp6-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/4.0/Komodo-IDE-4.0.1-274919-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.1/Komodo-IDE-4.0.1-274919-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/4.0/Komodo-IDE-4.0.1-274919-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.1/Komodo-IDE-4.0.1-274919-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/4.0/Komodo-IDE-4.0.1-274919.msi":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.1/Komodo-IDE-4.0.1-274919.msi",
    #"http://downloads.activestate.com/Komodo/Linux/4.0/Komodo-IDE-4.0.0-274646-linux-libcpp5-x86.tar.gz":
    #  "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.0/Komodo-IDE-4.0.0-274646-linux-libcpp5-x86.tar.gz",
    #"http://downloads.activestate.com/Komodo/Linux/4.0/Komodo-IDE-4.0.0-274646-linux-libcpp6-x86.tar.gz":
    #  "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.0/Komodo-IDE-4.0.0-274646-linux-libcpp6-x86.tar.gz",
    #"http://downloads.activestate.com/Komodo/MacOSX/4.0/Komodo-IDE-4.0.0-274646-macosx-powerpc.dmg":
    #  "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.0/Komodo-IDE-4.0.0-274646-macosx-powerpc.dmg",
    #"http://downloads.activestate.com/Komodo/MacOSX/4.0/Komodo-IDE-4.0.0-274646-macosx-x86.dmg":
    #  "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.0/Komodo-IDE-4.0.0-274646-macosx-x86.dmg",
    #"http://downloads.activestate.com/Komodo/Windows/4.0/Komodo-IDE-4.0.0-274646.msi":
    #  "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.0/Komodo-IDE-4.0.0-274646.msi",

    "http://downloads.activestate.com/Komodo/Linux/3.5/Komodo-Personal-3.5.3-262321-linux-libcpp5-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/Komodo-Personal-3.5.3-262321-linux-libcpp5-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/3.5/Komodo-Personal-3.5.3-262321-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/Komodo-Personal-3.5.3-262321-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/3.5/Komodo-Personal-3.5.3-262321-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/Komodo-Personal-3.5.3-262321-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/3.5/Komodo-Personal-3.5.3-262321.msi":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/Komodo-Personal-3.5.3-262321.msi",
    "http://downloads.activestate.com/Komodo/Linux/3.5/Komodo-Professional-3.5.3-262321-linux-libcpp5-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/Komodo-Professional-3.5.3-262321-linux-libcpp5-x86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/3.5/Komodo-Professional-3.5.3-262321-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/Komodo-Professional-3.5.3-262321-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/3.5/Komodo-Professional-3.5.3-262321-macosx-x86.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/Komodo-Professional-3.5.3-262321-macosx-x86.dmg",
    "http://downloads.activestate.com/Komodo/Windows/3.5/Komodo-Professional-3.5.3-262321.msi":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/Komodo-Professional-3.5.3-262321.msi",
    "http://downloads.activestate.com/Komodo/Solaris/3.5/Komodo-Professional-3.5.3-262321-solaris8-sparc.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/Komodo-Professional-3.5.3-262321-solaris8-sparc.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/3.5/Komodo-Personal-3.5.2-227158-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.2/Komodo-Personal-3.5.2-227158-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/Windows/3.5/Komodo-Personal-3.5.2-227162.msi":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.2/Komodo-Personal-3.5.2-227162.msi",
    "http://downloads.activestate.com/Komodo/Linux/3.5/Komodo-Personal-3.5.2-227956-linux-libcpp5-ix86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.2/Komodo-Personal-3.5.2-227956-linux-libcpp5-ix86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/3.5/Komodo-Professional-3.5.2-227158-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.2/Komodo-Professional-3.5.2-227158-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/Windows/3.5/Komodo-Professional-3.5.2-227158.msi":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.2/Komodo-Professional-3.5.2-227158.msi",
    "http://downloads.activestate.com/Komodo/Linux/3.5/Komodo-Professional-3.5.2-227956-linux-libcpp5-ix86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.2/Komodo-Professional-3.5.2-227956-linux-libcpp5-ix86.tar.gz",
    "http://downloads.activestate.com/Komodo/Linux/3.5/Komodo-Personal-3.5.1-223842-linux-libcpp5-ix86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.1/Komodo-Personal-3.5.1-223842-linux-libcpp5-ix86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/3.5/Komodo-Personal-3.5.1-223842-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.1/Komodo-Personal-3.5.1-223842-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/Windows/3.5/Komodo-Personal-3.5.1-223842.msi":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.1/Komodo-Personal-3.5.1-223842.msi",
    "http://downloads.activestate.com/Komodo/Linux/3.5/Komodo-Professional-3.5.1-223842-linux-libcpp5-ix86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.1/Komodo-Professional-3.5.1-223842-linux-libcpp5-ix86.tar.gz",
    "http://downloads.activestate.com/Komodo/MacOSX/3.5/Komodo-Professional-3.5.1-223842-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.1/Komodo-Professional-3.5.1-223842-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/Windows/3.5/Komodo-Professional-3.5.1-223842.msi":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.1/Komodo-Professional-3.5.1-223842.msi",
    "http://downloads.activestate.com/Komodo/MacOSX/3.5/Komodo-Personal-3.5.0-212064-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.0/Komodo-Personal-3.5.0-212064-macosx-powerpc.dmg",
    "http://downloads.activestate.com/Komodo/MacOSX/3.5/Komodo-Professional-3.5.0-212064-macosx-powerpc.dmg":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.0/Komodo-Professional-3.5.0-212064-macosx-powerpc.dmg",

    "http://downloads.activestate.com/Komodo/Windows/":
      "http://downloads.activestate.com/Komodo/releases/latest/",
    "http://downloads.activestate.com/Komodo/Linux/":
      "http://downloads.activestate.com/Komodo/releases/latest/",
    "http://downloads.activestate.com/Komodo/MacOSX/":
      "http://downloads.activestate.com/Komodo/releases/latest/",
    "http://downloads.activestate.com/Komodo/Solaris/":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/",
    "http://downloads.activestate.com/Komodo/MozillaPatches/":
      "http://downloads.activestate.com/Komodo/releases/latest/",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/":
      "http://downloads.activestate.com/Komodo/releases/4.3.0/remotedebugging/",

    "http://downloads.activestate.com/Komodo/Windows/1.0/":
      "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.0.0/",
    "http://downloads.activestate.com/Komodo/Linux/1.0/":
      "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.0.0/",
    "http://downloads.activestate.com/Komodo/Solaris/1.0/":
      "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.0.0/",
    "http://downloads.activestate.com/Komodo/MacOSX/1.0/":
      "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.0.0/",

    "http://downloads.activestate.com/Komodo/Windows/1.1/":
      "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.1.5/",
    "http://downloads.activestate.com/Komodo/Linux/1.1/":
      "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.1.5/",
    "http://downloads.activestate.com/Komodo/Solaris/1.1/":
      "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.1.5/",
    "http://downloads.activestate.com/Komodo/MacOSX/1.1/":
      "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.1.5/",

    #"http://downloads.activestate.com/Komodo/(Windows|Linux|Solaris|MacOSX)/1.2/":
    #  "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.2.9/",
    #TODO
    #"http://downloads.activestate.com/Komodo/(Windows|Linux|Solaris|MacOSX)/2.0/":
    #  "http://downloads.activestate.com/Komodo/releases/archive/2.x/2.0.1/",
    #TODO
    #"http://downloads.activestate.com/Komodo/(Windows|Linux|Solaris|MacOSX)/2.3/":
    #  "http://downloads.activestate.com/Komodo/releases/archive/2.x/2.3.0/",
    #TODO
    #"http://downloads.activestate.com/Komodo/(Windows|Linux|Solaris|MacOSX)/2.5/":
    #  "http://downloads.activestate.com/Komodo/releases/archive/2.x/2.5.2/",
    #TODO

    "http://downloads.activestate.com/Komodo/Windows/3.0/":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.0.1/",
    "http://downloads.activestate.com/Komodo/Linux/3.0/":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.0.1/",
    "http://downloads.activestate.com/Komodo/Solaris/3.0/":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.0.1/",
    "http://downloads.activestate.com/Komodo/MacOSX/3.0/":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.0.1/",

    #"http://downloads.activestate.com/Komodo/(Windows|Linux|Solaris|MacOSX)/3.1/":
    #  "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.1.0/",
    #TODO
    #"http://downloads.activestate.com/Komodo/(Windows|Linux|Solaris|MacOSX)/3.5/":
    #  "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/",
    #TODO

    "http://downloads.activestate.com/Komodo/Windows/4.0/":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/",
    "http://downloads.activestate.com/Komodo/Linux/4.0/":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/",
    "http://downloads.activestate.com/Komodo/Solaris/4.0/":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/",
    "http://downloads.activestate.com/Komodo/MacOSX/4.0/":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/",

    "http://downloads.activestate.com/Komodo/Windows/4.1/":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/",
    "http://downloads.activestate.com/Komodo/Linux/4.1/":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/",
    "http://downloads.activestate.com/Komodo/Solaris/4.1/":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/",
    "http://downloads.activestate.com/Komodo/MacOSX/4.1/":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/",

    "http://downloads.activestate.com/Komodo/Windows/4.2/":
      "http://downloads.activestate.com/Komodo/releases/4.2.1/",
    "http://downloads.activestate.com/Komodo/Linux/4.2/":
      "http://downloads.activestate.com/Komodo/releases/4.2.1/",
    "http://downloads.activestate.com/Komodo/Solaris/4.2/":
      "http://downloads.activestate.com/Komodo/releases/4.2.1/",
    "http://downloads.activestate.com/Komodo/MacOSX/4.2/":
      "http://downloads.activestate.com/Komodo/releases/4.2.1/",

    "http://downloads.activestate.com/Komodo/Windows/4.3/":
      "http://downloads.activestate.com/Komodo/releases/4.3.0/",
    "http://downloads.activestate.com/Komodo/Linux/4.3/":
      "http://downloads.activestate.com/Komodo/releases/4.3.0/",
    "http://downloads.activestate.com/Komodo/Solaris/4.3/":
      "http://downloads.activestate.com/Komodo/releases/4.3.0/",
    "http://downloads.activestate.com/Komodo/MacOSX/4.3/":
      "http://downloads.activestate.com/Komodo/releases/4.3.0/",

    "http://downloads.activestate.com/Komodo/MozillaPatches/komodo-1.0-patches-to-mozilla.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.0.0/Komodo-1.0-mozilla-patches.tar.gz",
    "http://downloads.activestate.com/Komodo/MozillaPatches/Komodo-1.1.2-mozilla-patches.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.1.2/Komodo-1.1.2-mozilla-patches.tar.gz",
    "http://downloads.activestate.com/Komodo/MozillaPatches/Komodo-1.1.5-RC4-mozilla-patches.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.1.5/Komodo-1.1.5-RC4-mozilla-patches.tar.gz",
    "http://downloads.activestate.com/Komodo/MozillaPatches/Komodo-1.2.3-beta-mozilla-patches.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.2.3b/Komodo-1.2.3-beta-mozilla-patches.tar.gz",
    "http://downloads.activestate.com/Komodo/MozillaPatches/Komodo-1.2.4-beta-mozilla-patches.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.2.4b/Komodo-1.2.4-beta-mozilla-patches.tar.gz",
    "http://downloads.activestate.com/Komodo/MozillaPatches/Komodo-1.2.6-mozilla-patches.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.2.6/Komodo-1.2.6-mozilla-patches.tar.gz",
    "http://downloads.activestate.com/Komodo/MozillaPatches/Komodo-1.2.9-win32-mozilla-patched.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.2.9/Komodo-1.2.9-win32-mozilla-patched.tar.gz",
    "http://downloads.activestate.com/Komodo/MozillaPatches/Komodo-2.3.0-mozilla-patches.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/2.x/2.3.0/Komodo-2.3.0-mozilla-patches.tar.gz",
    "http://downloads.activestate.com/Komodo/MozillaPatches/mozilla-patches-ko23.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/2.x/2.3.0/Komodo-2.3.0-mozilla-patches.tar.gz",
    "http://downloads.activestate.com/Komodo/MozillaPatches/mozilla-patches-ko25.zip":
      "http://downloads.activestate.com/Komodo/releases/archive/2.x/2.5.2/Komodo-2.5-mozilla-patches.zip",
    "http://downloads.activestate.com/Komodo/MozillaPatches/mozilla-patches-ko30.zip":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.0.1/Komodo-3.0-mozilla-patches.zip",
    "http://downloads.activestate.com/Komodo/MozillaPatches/mozilla-patches-ko31.zip":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.1.0/Komodo-3.1-mozilla-patches.zip",
    "http://downloads.activestate.com/Komodo/MozillaPatches/mozilla-patches-ko35.zip":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/Komodo-3.5-mozilla-patches.zip",
    "http://downloads.activestate.com/Komodo/MozillaPatches/Komodo-4.0-mozilla-patches.zip":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/Komodo-4.0-mozilla-patches.zip",
    "http://downloads.activestate.com/Komodo/MozillaPatches/Komodo-4.1-mozilla-patches.zip":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/Komodo-4.1-mozilla-patches.zip",
    "http://downloads.activestate.com/Komodo/MozillaPatches/Komodo-4.2-mozilla-patches.zip":
      "http://downloads.activestate.com/Komodo/releases/4.2.1/Komodo-4.2-mozilla-patches.zip",
    "http://downloads.activestate.com/Komodo/MozillaPatches/Komodo-4.3-mozilla-patches.zip":
      "http://downloads.activestate.com/Komodo/releases/4.3.0/Komodo-4.3-mozilla-patches.zip",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/komodo_javascript_debugger.xpi":
      "http://downloads.activestate.com/Komodo/releases/latest/remotedebugging/komodo_javascript_debugger.xpi",

    "http://downloads.activestate.com/Komodo/RemoteDebugging/1.2/foo":
      "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.2.9/remotedebugging/",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/1.2/perl5db.pl":
      "http://downloads.activestate.com/Komodo/releases/archive/1.x/1.2.9/remotedebugging/",

    "http://downloads.activestate.com/Komodo/RemoteDebugging/2.0/foo":
      "http://downloads.activestate.com/Komodo/releases/archive/2.x/2.0.1/remotedebugging/",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/2.0/Linux/activedebug.430.rh73.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/2.x/2.0.1/remotedebugging/",

    #"http://downloads.activestate.com/Komodo/RemoteDebugging/3.0/[^/]+/(.*3\.0\.0.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.0.0/remotedebugging/$1",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/3.0/Windows/Komodo-PerlRemoteDebugging-3.0.0-108615-win32.zip":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.0.0/remotedebugging/Komodo-PerlRemoteDebugging-3.0.0-108615-win32.zip",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/3.0/Linux/Komodo-TclRemoteDebugging-3.0.0-108615-linux-ix86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.0.0/remotedebugging/Komodo-TclRemoteDebugging-3.0.0-108615-linux-ix86.tar.gz",

    #"http://downloads.activestate.com/Komodo/RemoteDebugging/3.0/[^/]+/(.*3\.0\.1.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.0.1/remotedebugging/$1",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/3.0/Windows/Komodo-PHPRemoteDebugging-3.0.1-110687-win32-ix86.zip":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.0.1/remotedebugging/Komodo-PHPRemoteDebugging-3.0.1-110687-win32-ix86.zip",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/3.0/Linux/Komodo-PythonRemoteDebugging-3.0.1-110687-linux.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.0.1/remotedebugging/Komodo-PythonRemoteDebugging-3.0.1-110687-linux.tar.gz",

    #"http://downloads.activestate.com/Komodo/RemoteDebugging/3.1/[^/]+/(.*3\.1\.0.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.1.0/remotedebugging/$1",
    #TODO
    #"http://downloads.activestate.com/Komodo/RemoteDebugging/3.1/(.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.1.0/remotedebugging/",
    #TODO
    #"http://downloads.activestate.com/Komodo/RemoteDebugging/3.5/[^/]+/(.*3\.5\.1.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.1/remotedebugging/$1",
    #TODO
    #"http://downloads.activestate.com/Komodo/RemoteDebugging/3.5/[^/]+/(.*3\.5\.2.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.2/remotedebugging/$1",
    #TODO

    #"http://downloads.activestate.com/Komodo/RemoteDebugging/3.5/[^/]+/(.*3\.5\.3.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/remotedebugging/$1",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/3.5/Windows/Komodo-PythonRemoteDebugging-3.5.3-262321-win32-x86.zip":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/remotedebugging/Komodo-PythonRemoteDebugging-3.5.3-262321-win32-x86.zip",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/3.5/MacOSX/Komodo-PHPRemoteDebugging-3.5.3-262321-macosx-x86.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/remotedebugging/Komodo-PHPRemoteDebugging-3.5.3-262321-macosx-x86.tar.gz",

    #"http://downloads.activestate.com/Komodo/RemoteDebugging/3.5/(.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/remotedebugging/",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/3.5/foo":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/remotedebugging/",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/3.5/MD5SUM":
      "http://downloads.activestate.com/Komodo/releases/archive/3.x/3.5.3/remotedebugging/",

    "http://downloads.activestate.com/Komodo/RemoteDebugging/4.0/komodo_javascript_debugger.xpi":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/remotedebugging/komodo_javascript_debugger.xpi",

    #"http://downloads.activestate.com/Komodo/RemoteDebugging/4.0/[^/]+/(.*4\.0\.0.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.0/remotedebugging/$1",
    #TODO
    #"http://downloads.activestate.com/Komodo/RemoteDebugging/4.0/[^/]+/(.*4\.0\.1.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.1/remotedebugging/$1",
    #TODO
    #"http://downloads.activestate.com/Komodo/RemoteDebugging/4.0/[^/]+/(.*4\.0\.2.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.2/remotedebugging/$1",
    #TODO

    #"http://downloads.activestate.com/Komodo/RemoteDebugging/4.0/[^/]+/(.*4\.0\.3.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/remotedebugging/$1",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/4.0/Windows/Komodo-PerlRemoteDebugging-4.0.3-278227-win32-x86.zip":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/remotedebugging/Komodo-PerlRemoteDebugging-4.0.3-278227-win32-x86.zip",

    #"http://downloads.activestate.com/Komodo/RemoteDebugging/4.0/(.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/remotedebugging/",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/4.0/foo/bar":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.0.3/remotedebugging/",

    "http://downloads.activestate.com/Komodo/RemoteDebugging/4.1/komodo_javascript_debugger.xpi":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/remotedebugging/komodo_javascript_debugger.xpi",

    #"http://downloads.activestate.com/Komodo/RemoteDebugging/4.1/[^/]+/(.*4\.0\.0.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.0/remotedebugging/$1",
    #TODO

    #"http://downloads.activestate.com/Komodo/RemoteDebugging/4.1/[^/]+/(.*4\.0\.1.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/remotedebugging/$1",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/4.1/Windows/Komodo-TclRemoteDebugging-4.1.1-279677-win32-x86.zip":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/remotedebugging/Komodo-TclRemoteDebugging-4.1.1-279677-win32-x86.zip",

    #"http://downloads.activestate.com/Komodo/RemoteDebugging/4.1/(.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/remotedebugging/",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/4.1/blah":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.1.1/remotedebugging/",

    "http://downloads.activestate.com/Komodo/RemoteDebugging/4.2/komodo_javascript_debugger.xpi":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.2.1/remotedebugging/komodo_javascript_debugger.xpi",

    #"http://downloads.activestate.com/Komodo/RemoteDebugging/4.2/[^/]+/(.*4\.2\.0.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.2.0/remotedebugging/$1",
    #TODO

    #"http://downloads.activestate.com/Komodo/RemoteDebugging/4.2/[^/]+/(.*4\.2\.1.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.2.1/remotedebugging/$1",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/4.2/MacOSX/Komodo-PHPRemoteDebugging-4.2.1-283000-macosx-powerpc.tar.gz":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.2.1/remotedebugging/Komodo-PHPRemoteDebugging-4.2.1-283000-macosx-powerpc.tar.gz",

    #"http://downloads.activestate.com/Komodo/RemoteDebugging/4.2/(.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.2.1/remotedebugging/",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/4.2/asdf":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.2.1/remotedebugging/",

    "http://downloads.activestate.com/Komodo/RemoteDebugging/4.3/komodo_javascript_debugger.xpi":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.3.0/remotedebugging/komodo_javascript_debugger.xpi",
    #"http://downloads.activestate.com/Komodo/RemoteDebugging/4.3/(.*)":
    #  "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.3.0/remotedebugging/",
    "http://downloads.activestate.com/Komodo/RemoteDebugging/4.3/zazing":
      "http://downloads.activestate.com/Komodo/releases/archive/4.x/4.3.0/remotedebugging/",
}



#---- internal support stuff

def rules_from_htaccess(htaccess):
    reading_rule = False
    redirect = None
    for line in htaccess.splitlines(0):
        bits = line.split()
        if not reading_rule:
            if bits and bits[0] == "RewriteRule":
                reading_rule = True
                redirect = ["http://downloads.activestate.com/Komodo/" + bits[1]]
        else:
            redirect.append("http://downloads.activestate.com" + bits[0])
            yield redirect
            reading_rule = False
            redirect = None

_cl_from_url_cache = {}
_times_and_urls_cl_cache = []  # sorted list of (<time>, <url>)
def _content_length_from_url(url, cache=False):
    """Return a set of links (hrefs) in the given URL.

    If "cache" is True (the default), then a one minute cache per URL
    is maintained.
    """
    DEBUG = False
    global _cl_from_url_cache, _times_and_urls_cl_cache

    if cache:
        CACHE_TIMEOUT = 60 # 1 minute timeout
        now = int(time.time())

        # Remove out-of-date cache entries.
        out_of_date_index = bisect.bisect(_times_and_urls_cl_cache,
                                          (now-CACHE_TIMEOUT, None))
        if out_of_date_index:
            for i in range(out_of_date_index):
                del _cl_from_url_cache[_times_and_urls_cl_cache[i][1]]
            del _times_and_urls_cl_cache[:out_of_date_index]

        # Use the cache if we have something there.
        if url in _cl_from_url_cache:
            return _cl_from_url_cache[url]

    if DEBUG:
        print "opening `%s'" % url
    f = urllib2.urlopen(url)
    try:
        headers = f.info()
    finally:
        f.close()
    try:
        content_length = headers["Content-Length"]
    except KeyError:
        return None # probably a *dir*
    if cache:
        _cl_from_url_cache[url] = content_length
        _times_and_urls_cl_cache.append((now, url))
    return content_length




#---- .htaccess copy

"""
RewriteEngine On

# A "latest" redirect for latest release.
RewriteRule latest/(.*?)$ /Komodo/releases/4.3.0/$1 [R,L]
"""

g_htaccess = """
RewriteEngine On

# 4.3.0b2 redirects
RewriteRule Linux/4.3/Komodo-Edit-4.3.0-beta2-993-linux-libcpp6-x86.tar.gz /Komodo/releases/4.3.0b2/Komodo-Edit-4.3.0-beta2-993-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.3/Komodo-Edit-4.3.0-beta2-993-macosx-powerpc.dmg /Komodo/releases/4.3.0b2/Komodo-Edit-4.3.0-beta2-993-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.3/Komodo-Edit-4.3.0-beta2-993-macosx-x86.dmg /Komodo/releases/4.3.0b2/Komodo-Edit-4.3.0-beta2-993-macosx-x86.dmg [R,L]
RewriteRule Windows/4.3/Komodo-Edit-4.3.0-beta2-993.msi /Komodo/releases/4.3.0b2/Komodo-Edit-4.3.0-beta2-993.msi [R,L]
RewriteRule Linux/4.3/Komodo-IDE-4.3.0-beta2-15465-linux-libcpp5-x86.tar.gz /Komodo/releases/4.3.0b2/Komodo-IDE-4.3.0-beta2-15465-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule Linux/4.3/Komodo-IDE-4.3.0-beta2-15465-linux-libcpp6-x86.tar.gz /Komodo/releases/4.3.0b2/Komodo-IDE-4.3.0-beta2-15465-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.3/Komodo-IDE-4.3.0-beta2-15465-macosx-powerpc.dmg /Komodo/releases/4.3.0b2/Komodo-IDE-4.3.0-beta2-15465-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.3/Komodo-IDE-4.3.0-beta2-15465-macosx-x86.dmg /Komodo/releases/4.3.0b2/Komodo-IDE-4.3.0-beta2-15465-macosx-x86.dmg [R,L]
RewriteRule Windows/4.3/Komodo-IDE-4.3.0-beta2-15465.msi /Komodo/releases/4.3.0b2/Komodo-IDE-4.3.0-beta2-15465.msi [R,L]

# 4.3.0b1 redirects
RewriteRule Linux/4.3/Komodo-Edit-4.3.0-beta1-962-linux-libcpp6-x86.tar.gz /Komodo/releases/4.3.0b1/Komodo-Edit-4.3.0-beta1-962-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.3/Komodo-Edit-4.3.0-beta1-962-macosx-powerpc.dmg /Komodo/releases/4.3.0b1/Komodo-Edit-4.3.0-beta1-962-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.3/Komodo-Edit-4.3.0-beta1-962-macosx-x86.dmg /Komodo/releases/4.3.0b1/Komodo-Edit-4.3.0-beta1-962-macosx-x86.dmg [R,L]
RewriteRule Windows/4.3/Komodo-Edit-4.3.0-beta1-962.msi /Komodo/releases/4.3.0b1/Komodo-Edit-4.3.0-beta1-962.msi [R,L]
RewriteRule Linux/4.3/Komodo-IDE-4.3.0-beta1-15255-linux-libcpp5-x86.tar.gz /Komodo/releases/4.3.0b1/Komodo-IDE-4.3.0-beta1-15255-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule Linux/4.3/Komodo-IDE-4.3.0-beta1-15255-linux-libcpp6-x86.tar.gz /Komodo/releases/4.3.0b1/Komodo-IDE-4.3.0-beta1-15255-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.3/Komodo-IDE-4.3.0-beta1-15255-macosx-powerpc.dmg /Komodo/releases/4.3.0b1/Komodo-IDE-4.3.0-beta1-15255-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.3/Komodo-IDE-4.3.0-beta1-15255-macosx-x86.dmg /Komodo/releases/4.3.0b1/Komodo-IDE-4.3.0-beta1-15255-macosx-x86.dmg [R,L]
RewriteRule Windows/4.3/Komodo-IDE-4.3.0-beta1-15255.msi /Komodo/releases/4.3.0b1/Komodo-IDE-4.3.0-beta1-15255.msi [R,L]

# 4.3.0a2 redirects
RewriteRule Linux/4.3/Komodo-Edit-4.3.0-alpha2-889-linux-libcpp6-x86.tar.gz /Komodo/releases/4.3.0a2/Komodo-Edit-4.3.0-alpha2-889-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.3/Komodo-Edit-4.3.0-alpha2-889-macosx-powerpc.dmg /Komodo/releases/4.3.0a2/Komodo-Edit-4.3.0-alpha2-889-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.3/Komodo-Edit-4.3.0-alpha2-889-macosx-x86.dmg /Komodo/releases/4.3.0a2/Komodo-Edit-4.3.0-alpha2-889-macosx-x86.dmg [R,L]
RewriteRule Windows/4.3/Komodo-Edit-4.3.0-alpha2-889.msi /Komodo/releases/4.3.0a2/Komodo-Edit-4.3.0-alpha2-889.msi [R,L]
RewriteRule Linux/4.3/Komodo-IDE-4.3.0-alpha2-15053-linux-libcpp5-x86.tar.gz /Komodo/releases/4.3.0a2/Komodo-IDE-4.3.0-alpha2-15053-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule Linux/4.3/Komodo-IDE-4.3.0-alpha2-15053-linux-libcpp6-x86.tar.gz /Komodo/releases/4.3.0a2/Komodo-IDE-4.3.0-alpha2-15053-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.3/Komodo-IDE-4.3.0-alpha2-15053-macosx-powerpc.dmg /Komodo/releases/4.3.0a2/Komodo-IDE-4.3.0-alpha2-15053-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.3/Komodo-IDE-4.3.0-alpha2-15053-macosx-x86.dmg /Komodo/releases/4.3.0a2/Komodo-IDE-4.3.0-alpha2-15053-macosx-x86.dmg [R,L]
RewriteRule Windows/4.3/Komodo-IDE-4.3.0-alpha2-15053.msi /Komodo/releases/4.3.0a2/Komodo-IDE-4.3.0-alpha2-15053.msi [R,L]

# 4.3.0a1 redirects
RewriteRule Linux/4.3/Komodo-Edit-4.3.0-alpha1-794-linux-libcpp6-x86.tar.gz /Komodo/releases/4.3.0a1/Komodo-Edit-4.3.0-alpha1-794-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.3/Komodo-Edit-4.3.0-alpha1-794-macosx-powerpc.dmg /Komodo/releases/4.3.0a1/Komodo-Edit-4.3.0-alpha1-794-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.3/Komodo-Edit-4.3.0-alpha1-794-macosx-x86.dmg /Komodo/releases/4.3.0a1/Komodo-Edit-4.3.0-alpha1-794-macosx-x86.dmg [R,L]
RewriteRule Windows/4.3/Komodo-Edit-4.3.0-alpha1-794.msi /Komodo/releases/4.3.0a1/Komodo-Edit-4.3.0-alpha1-794.msi [R,L]
RewriteRule Linux/4.3/Komodo-IDE-4.3.0-alpha1-14562-linux-libcpp5-x86.tar.gz /Komodo/releases/4.3.0a1/Komodo-IDE-4.3.0-alpha1-14562-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule Linux/4.3/Komodo-IDE-4.3.0-alpha1-14562-linux-libcpp6-x86.tar.gz /Komodo/releases/4.3.0a1/Komodo-IDE-4.3.0-alpha1-14562-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.3/Komodo-IDE-4.3.0-alpha1-14562-macosx-powerpc.dmg /Komodo/releases/4.3.0a1/Komodo-IDE-4.3.0-alpha1-14562-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.3/Komodo-IDE-4.3.0-alpha1-14562-macosx-x86.dmg /Komodo/releases/4.3.0a1/Komodo-IDE-4.3.0-alpha1-14562-macosx-x86.dmg [R,L]
RewriteRule Windows/4.3/Komodo-IDE-4.3.0-alpha1-14562.msi /Komodo/releases/4.3.0a1/Komodo-IDE-4.3.0-alpha1-14562.msi [R,L]

# 4.2.1 redirects 
RewriteRule Linux/4.2/Komodo-Edit-4.2.1-283000-linux-libcpp5-x86.tar.gz /Komodo/releases/4.2.1/Komodo-Edit-4.2.1-283000-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule Linux/4.2/Komodo-Edit-4.2.1-283000-linux-libcpp6-x86.tar.gz /Komodo/releases/4.2.1/Komodo-Edit-4.2.1-283000-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.2/Komodo-Edit-4.2.1-283000-macosx-powerpc.dmg /Komodo/releases/4.2.1/Komodo-Edit-4.2.1-283000-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.2/Komodo-Edit-4.2.1-283000-macosx-x86.dmg /Komodo/releases/4.2.1/Komodo-Edit-4.2.1-283000-macosx-x86.dmg [R,L]
RewriteRule Windows/4.2/Komodo-Edit-4.2.1-283000.msi /Komodo/releases/4.2.1/Komodo-Edit-4.2.1-283000.msi [R,L]
RewriteRule Linux/4.2/Komodo-IDE-4.2.1-283000-linux-libcpp5-x86.tar.gz /Komodo/releases/4.2.1/Komodo-IDE-4.2.1-283000-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule Linux/4.2/Komodo-IDE-4.2.1-283000-linux-libcpp6-x86.tar.gz /Komodo/releases/4.2.1/Komodo-IDE-4.2.1-283000-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.2/Komodo-IDE-4.2.1-283000-macosx-powerpc.dmg /Komodo/releases/4.2.1/Komodo-IDE-4.2.1-283000-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.2/Komodo-IDE-4.2.1-283000-macosx-x86.dmg /Komodo/releases/4.2.1/Komodo-IDE-4.2.1-283000-macosx-x86.dmg [R,L]
RewriteRule Windows/4.2/Komodo-IDE-4.2.1-283000.msi /Komodo/releases/4.2.1/Komodo-IDE-4.2.1-283000.msi [R,L]

# 4.2.0 redirects 
RewriteRule Linux/4.2/Komodo-Edit-4.2.0-281898-linux-libcpp5-x86.tar.gz /Komodo/releases/4.2.0/Komodo-Edit-4.2.0-281898-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule Linux/4.2/Komodo-Edit-4.2.0-281898-linux-libcpp6-x86.tar.gz /Komodo/releases/4.2.0/Komodo-Edit-4.2.0-281898-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.2/Komodo-Edit-4.2.0-281898-macosx-powerpc.dmg /Komodo/releases/4.2.0/Komodo-Edit-4.2.0-281898-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.2/Komodo-Edit-4.2.0-281898-macosx-x86.dmg /Komodo/releases/4.2.0/Komodo-Edit-4.2.0-281898-macosx-x86.dmg [R,L]
RewriteRule Windows/4.2/Komodo-Edit-4.2.0-281898.msi /Komodo/releases/4.2.0/Komodo-Edit-4.2.0-281898.msi [R,L]
RewriteRule Linux/4.2/Komodo-IDE-4.2.0-281898-linux-libcpp5-x86.tar.gz /Komodo/releases/4.2.0/Komodo-IDE-4.2.0-281898-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule Linux/4.2/Komodo-IDE-4.2.0-281898-linux-libcpp6-x86.tar.gz /Komodo/releases/4.2.0/Komodo-IDE-4.2.0-281898-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.2/Komodo-IDE-4.2.0-281898-macosx-powerpc.dmg /Komodo/releases/4.2.0/Komodo-IDE-4.2.0-281898-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.2/Komodo-IDE-4.2.0-281898-macosx-x86.dmg /Komodo/releases/4.2.0/Komodo-IDE-4.2.0-281898-macosx-x86.dmg [R,L]
RewriteRule Windows/4.2/Komodo-IDE-4.2.0-281898.msi /Komodo/releases/4.2.0/Komodo-IDE-4.2.0-281898.msi [R,L]

# 4.1.1 redirects 
RewriteRule Linux/4.1/Komodo-Edit-4.1.1-279677-linux-libcpp5-x86.tar.gz /Komodo/releases/archive/4.x/4.1.1/Komodo-Edit-4.1.1-279677-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule Linux/4.1/Komodo-Edit-4.1.1-279677-linux-libcpp6-x86.tar.gz /Komodo/releases/archive/4.x/4.1.1/Komodo-Edit-4.1.1-279677-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.1/Komodo-Edit-4.1.1-279677-macosx-powerpc.dmg /Komodo/releases/archive/4.x/4.1.1/Komodo-Edit-4.1.1-279677-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.1/Komodo-Edit-4.1.1-279677-macosx-x86.dmg /Komodo/releases/archive/4.x/4.1.1/Komodo-Edit-4.1.1-279677-macosx-x86.dmg [R,L]
RewriteRule Windows/4.1/Komodo-Edit-4.1.1-279677.msi /Komodo/releases/archive/4.x/4.1.1/Komodo-Edit-4.1.1-279677.msi [R,L]
RewriteRule Linux/4.1/Komodo-IDE-4.1.1-279677-linux-libcpp5-x86.tar.gz /Komodo/releases/archive/4.x/4.1.1/Komodo-IDE-4.1.1-279677-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule Linux/4.1/Komodo-IDE-4.1.1-279677-linux-libcpp6-x86.tar.gz /Komodo/releases/archive/4.x/4.1.1/Komodo-IDE-4.1.1-279677-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.1/Komodo-IDE-4.1.1-279677-macosx-powerpc.dmg /Komodo/releases/archive/4.x/4.1.1/Komodo-IDE-4.1.1-279677-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.1/Komodo-IDE-4.1.1-279677-macosx-x86.dmg /Komodo/releases/archive/4.x/4.1.1/Komodo-IDE-4.1.1-279677-macosx-x86.dmg [R,L]
RewriteRule Windows/4.1/Komodo-IDE-4.1.1-279677.msi /Komodo/releases/archive/4.x/4.1.1/Komodo-IDE-4.1.1-279677.msi [R,L]

# 4.0.3 redirects 
RewriteRule Linux/4.0/Komodo-Edit-4.0.3-278227-linux-libcpp5-x86.tar.gz /Komodo/releases/archive/4.x/4.0.3/Komodo-Edit-4.0.3-278227-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule Linux/4.0/Komodo-Edit-4.0.3-278227-linux-libcpp6-x86.tar.gz /Komodo/releases/archive/4.x/4.0.3/Komodo-Edit-4.0.3-278227-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.0/Komodo-Edit-4.0.3-278227-macosx-powerpc.dmg /Komodo/releases/archive/4.x/4.0.3/Komodo-Edit-4.0.3-278227-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.0/Komodo-Edit-4.0.3-278227-macosx-x86.dmg /Komodo/releases/archive/4.x/4.0.3/Komodo-Edit-4.0.3-278227-macosx-x86.dmg [R,L]
RewriteRule Windows/4.0/Komodo-Edit-4.0.3-278227.msi /Komodo/releases/archive/4.x/4.0.3/Komodo-Edit-4.0.3-278227.msi [R,L]
RewriteRule Linux/4.0/Komodo-IDE-4.0.3-278227-linux-libcpp5-x86.tar.gz /Komodo/releases/archive/4.x/4.0.3/Komodo-IDE-4.0.3-278227-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule Linux/4.0/Komodo-IDE-4.0.3-278227-linux-libcpp6-x86.tar.gz /Komodo/releases/archive/4.x/4.0.3/Komodo-IDE-4.0.3-278227-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.0/Komodo-IDE-4.0.3-278227-macosx-powerpc.dmg /Komodo/releases/archive/4.x/4.0.3/Komodo-IDE-4.0.3-278227-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.0/Komodo-IDE-4.0.3-278227-macosx-x86.dmg /Komodo/releases/archive/4.x/4.0.3/Komodo-IDE-4.0.3-278227-macosx-x86.dmg [R,L]
RewriteRule Windows/4.0/Komodo-IDE-4.0.3-278227.msi /Komodo/releases/archive/4.x/4.0.3/Komodo-IDE-4.0.3-278227.msi [R,L]

# 4.0.2 redirects 
RewriteRule Linux/4.0/Komodo-Edit-4.0.2-275451-linux-libcpp5-x86.tar.gz /Komodo/releases/archive/4.x/4.0.2/Komodo-Edit-4.0.2-275451-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule Linux/4.0/Komodo-Edit-4.0.2-275451-linux-libcpp6-x86.tar.gz /Komodo/releases/archive/4.x/4.0.2/Komodo-Edit-4.0.2-275451-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.0/Komodo-Edit-4.0.2-275451-macosx-powerpc.dmg /Komodo/releases/archive/4.x/4.0.2/Komodo-Edit-4.0.2-275451-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.0/Komodo-Edit-4.0.2-275451-macosx-x86.dmg /Komodo/releases/archive/4.x/4.0.2/Komodo-Edit-4.0.2-275451-macosx-x86.dmg [R,L]
RewriteRule Windows/4.0/Komodo-Edit-4.0.2-275451.msi /Komodo/releases/archive/4.x/4.0.2/Komodo-Edit-4.0.2-275451.msi [R,L]
RewriteRule Linux/4.0/Komodo-IDE-4.0.2-275451-linux-libcpp5-x86.tar.gz /Komodo/releases/archive/4.x/4.0.2/Komodo-IDE-4.0.2-275451-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule Linux/4.0/Komodo-IDE-4.0.2-275451-linux-libcpp6-x86.tar.gz /Komodo/releases/archive/4.x/4.0.2/Komodo-IDE-4.0.2-275451-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.0/Komodo-IDE-4.0.2-275451-macosx-powerpc.dmg /Komodo/releases/archive/4.x/4.0.2/Komodo-IDE-4.0.2-275451-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.0/Komodo-IDE-4.0.2-275451-macosx-x86.dmg /Komodo/releases/archive/4.x/4.0.2/Komodo-IDE-4.0.2-275451-macosx-x86.dmg [R,L]
RewriteRule Windows/4.0/Komodo-IDE-4.0.2-275451.msi /Komodo/releases/archive/4.x/4.0.2/Komodo-IDE-4.0.2-275451.msi [R,L]

# 4.0.1 redirects 
RewriteRule Linux/4.0/Komodo-IDE-4.0.1-274919-linux-libcpp5-x86.tar.gz /Komodo/releases/archive/4.x/4.0.1/Komodo-IDE-4.0.1-274919-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule Linux/4.0/Komodo-IDE-4.0.1-274919-linux-libcpp6-x86.tar.gz /Komodo/releases/archive/4.x/4.0.1/Komodo-IDE-4.0.1-274919-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.0/Komodo-IDE-4.0.1-274919-macosx-powerpc.dmg /Komodo/releases/archive/4.x/4.0.1/Komodo-IDE-4.0.1-274919-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.0/Komodo-IDE-4.0.1-274919-macosx-x86.dmg /Komodo/releases/archive/4.x/4.0.1/Komodo-IDE-4.0.1-274919-macosx-x86.dmg [R,L]
RewriteRule Windows/4.0/Komodo-IDE-4.0.1-274919.msi /Komodo/releases/archive/4.x/4.0.1/Komodo-IDE-4.0.1-274919.msi [R,L]

# 4.0.0 redirects 
RewriteRule Linux/4.0/Komodo-IDE-4.0.0-274646-linux-libcpp5-x86.tar.gz /Komodo/releases/archive/4.x/4.0.0/Komodo-IDE-4.0.0-274646-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule Linux/4.0/Komodo-IDE-4.0.0-274646-linux-libcpp6-x86.tar.gz /Komodo/releases/archive/4.x/4.0.0/Komodo-IDE-4.0.0-274646-linux-libcpp6-x86.tar.gz [R,L]
RewriteRule MacOSX/4.0/Komodo-IDE-4.0.0-274646-macosx-powerpc.dmg /Komodo/releases/archive/4.x/4.0.0/Komodo-IDE-4.0.0-274646-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/4.0/Komodo-IDE-4.0.0-274646-macosx-x86.dmg /Komodo/releases/archive/4.x/4.0.0/Komodo-IDE-4.0.0-274646-macosx-x86.dmg [R,L]
RewriteRule Windows/4.0/Komodo-IDE-4.0.0-274646.msi /Komodo/releases/archive/4.x/4.0.0/Komodo-IDE-4.0.0-274646.msi [R,L]

# 3.5.3 redirects 
RewriteRule Linux/3.5/Komodo-Personal-3.5.3-262321-linux-libcpp5-x86.tar.gz /Komodo/releases/archive/3.x/3.5.3/Komodo-Personal-3.5.3-262321-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule MacOSX/3.5/Komodo-Personal-3.5.3-262321-macosx-powerpc.dmg /Komodo/releases/archive/3.x/3.5.3/Komodo-Personal-3.5.3-262321-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/3.5/Komodo-Personal-3.5.3-262321-macosx-x86.dmg /Komodo/releases/archive/3.x/3.5.3/Komodo-Personal-3.5.3-262321-macosx-x86.dmg [R,L]
RewriteRule Windows/3.5/Komodo-Personal-3.5.3-262321.msi /Komodo/releases/archive/3.x/3.5.3/Komodo-Personal-3.5.3-262321.msi [R,L]
RewriteRule Linux/3.5/Komodo-Professional-3.5.3-262321-linux-libcpp5-x86.tar.gz /Komodo/releases/archive/3.x/3.5.3/Komodo-Professional-3.5.3-262321-linux-libcpp5-x86.tar.gz [R,L]
RewriteRule MacOSX/3.5/Komodo-Professional-3.5.3-262321-macosx-powerpc.dmg /Komodo/releases/archive/3.x/3.5.3/Komodo-Professional-3.5.3-262321-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/3.5/Komodo-Professional-3.5.3-262321-macosx-x86.dmg /Komodo/releases/archive/3.x/3.5.3/Komodo-Professional-3.5.3-262321-macosx-x86.dmg [R,L]
RewriteRule Windows/3.5/Komodo-Professional-3.5.3-262321.msi /Komodo/releases/archive/3.x/3.5.3/Komodo-Professional-3.5.3-262321.msi [R,L]
RewriteRule Solaris/3.5/Komodo-Professional-3.5.3-262321-solaris8-sparc.tar.gz /Komodo/releases/archive/3.x/3.5.3/Komodo-Professional-3.5.3-262321-solaris8-sparc.tar.gz [R,L]

# 3.5.2 redirects 
RewriteRule MacOSX/3.5/Komodo-Personal-3.5.2-227158-macosx-powerpc.dmg /Komodo/releases/archive/3.x/3.5.2/Komodo-Personal-3.5.2-227158-macosx-powerpc.dmg [R,L]
RewriteRule Windows/3.5/Komodo-Personal-3.5.2-227162.msi /Komodo/releases/archive/3.x/3.5.2/Komodo-Personal-3.5.2-227162.msi [R,L]
RewriteRule Linux/3.5/Komodo-Personal-3.5.2-227956-linux-libcpp5-ix86.tar.gz /Komodo/releases/archive/3.x/3.5.2/Komodo-Personal-3.5.2-227956-linux-libcpp5-ix86.tar.gz [R,L]
RewriteRule MacOSX/3.5/Komodo-Professional-3.5.2-227158-macosx-powerpc.dmg /Komodo/releases/archive/3.x/3.5.2/Komodo-Professional-3.5.2-227158-macosx-powerpc.dmg [R,L]
RewriteRule Windows/3.5/Komodo-Professional-3.5.2-227158.msi /Komodo/releases/archive/3.x/3.5.2/Komodo-Professional-3.5.2-227158.msi [R,L]
RewriteRule Linux/3.5/Komodo-Professional-3.5.2-227956-linux-libcpp5-ix86.tar.gz /Komodo/releases/archive/3.x/3.5.2/Komodo-Professional-3.5.2-227956-linux-libcpp5-ix86.tar.gz [R,L]

# 3.5.1 redirects 
RewriteRule Linux/3.5/Komodo-Personal-3.5.1-223842-linux-libcpp5-ix86.tar.gz /Komodo/releases/archive/3.x/3.5.1/Komodo-Personal-3.5.1-223842-linux-libcpp5-ix86.tar.gz [R,L]
RewriteRule MacOSX/3.5/Komodo-Personal-3.5.1-223842-macosx-powerpc.dmg /Komodo/releases/archive/3.x/3.5.1/Komodo-Personal-3.5.1-223842-macosx-powerpc.dmg [R,L]
RewriteRule Windows/3.5/Komodo-Personal-3.5.1-223842.msi /Komodo/releases/archive/3.x/3.5.1/Komodo-Personal-3.5.1-223842.msi [R,L]
RewriteRule Linux/3.5/Komodo-Professional-3.5.1-223842-linux-libcpp5-ix86.tar.gz /Komodo/releases/archive/3.x/3.5.1/Komodo-Professional-3.5.1-223842-linux-libcpp5-ix86.tar.gz [R,L]
RewriteRule MacOSX/3.5/Komodo-Professional-3.5.1-223842-macosx-powerpc.dmg /Komodo/releases/archive/3.x/3.5.1/Komodo-Professional-3.5.1-223842-macosx-powerpc.dmg [R,L]
RewriteRule Windows/3.5/Komodo-Professional-3.5.1-223842.msi /Komodo/releases/archive/3.x/3.5.1/Komodo-Professional-3.5.1-223842.msi [R,L]

# 3.5.0 redirects 
RewriteRule MacOSX/3.5/Komodo-Personal-3.5.0-212064-macosx-powerpc.dmg /Komodo/releases/archive/3.x/3.5.0/Komodo-Personal-3.5.0-212064-macosx-powerpc.dmg [R,L]
RewriteRule MacOSX/3.5/Komodo-Professional-3.5.0-212064-macosx-powerpc.dmg /Komodo/releases/archive/3.x/3.5.0/Komodo-Professional-3.5.0-212064-macosx-powerpc.dmg [R,L]


# Basic dir redirects 
RewriteRule Windows/ /Komodo/releases/latest/ [R,L]
RewriteRule Linux/ /Komodo/releases/latest/ [R,L]
RewriteRule MacOSX/ /Komodo/releases/latest/ [R,L]
RewriteRule Solaris/ /Komodo/releases/archive/3.x/3.5.3/ [R,L]
RewriteRule MozillaPatches/ /Komodo/releases/latest/ [R,L]
RewriteRule RemoteDebugging/ /Komodo/releases/latest/remotedebugging/ 
RewriteRule (Windows|Linux|Solaris|MacOSX)/1.0/ /Komodo/releases/archive/1.x/1.0.0/ [R,L]
RewriteRule (Windows|Linux|Solaris|MacOSX)/1.1/ /Komodo/releases/archive/1.x/1.1.5/ [R,L]
RewriteRule (Windows|Linux|Solaris|MacOSX)/1.2/ /Komodo/releases/archive/1.x/1.2.9/ [R,L]
RewriteRule (Windows|Linux|Solaris|MacOSX)/2.0/ /Komodo/releases/archive/2.x/2.0.1/ [R,L]
RewriteRule (Windows|Linux|Solaris|MacOSX)/2.3/ /Komodo/releases/archive/2.x/2.3.0/ [R,L]
RewriteRule (Windows|Linux|Solaris|MacOSX)/2.5/ /Komodo/releases/archive/2.x/2.5.2/ [R,L]
RewriteRule (Windows|Linux|Solaris|MacOSX)/3.0/ /Komodo/releases/archive/3.x/3.0.1/ [R,L]
RewriteRule (Windows|Linux|Solaris|MacOSX)/3.1/ /Komodo/releases/archive/3.x/3.1.0/ [R,L]
RewriteRule (Windows|Linux|Solaris|MacOSX)/3.5/ /Komodo/releases/archive/3.x/3.5.3/ [R,L]
RewriteRule (Windows|Linux|Solaris|MacOSX)/4.0/ /Komodo/releases/archive/4.x/4.0.3/ [R,L]
RewriteRule (Windows|Linux|Solaris|MacOSX)/4.1/ /Komodo/releases/archive/4.x/4.1.1/ [R,L]
RewriteRule (Windows|Linux|Solaris|MacOSX)/4.2/ /Komodo/releases/4.2.1/ [R,L]
RewriteRule (Windows|Linux|Solaris|MacOSX)/4.3/ /Komodo/releases/4.3.0/ [R,L]

# Mozilla Patches redirects 
RewriteRule MozillaPatches/komodo-1.0-patches-to-mozilla.tar.gz /Komodo/releases/archive/1.x/1.0.0/Komodo-1.0-mozilla-patches.tar.gz [R,L]
RewriteRule MozillaPatches/Komodo-1.1.2-mozilla-patches.tar.gz /Komodo/releases/archive/1.x/1.1.2/Komodo-1.1.2-mozilla-patches.tar.gz [R,L]
RewriteRule MozillaPatches/Komodo-1.1.5-RC4-mozilla-patches.tar.gz /Komodo/releases/archive/1.x/1.1.5/Komodo-1.1.5-RC4-mozilla-patches.tar.gz [R,L]
RewriteRule MozillaPatches/Komodo-1.2.3-beta-mozilla-patches.tar.gz /Komodo/releases/archive/1.x/1.2.3b/Komodo-1.2.3-beta-mozilla-patches.tar.gz [R,L]
RewriteRule MozillaPatches/Komodo-1.2.4-beta-mozilla-patches.tar.gz /Komodo/releases/archive/1.x/1.2.4b/Komodo-1.2.4-beta-mozilla-patches.tar.gz [R,L]
RewriteRule MozillaPatches/Komodo-1.2.6-mozilla-patches.tar.gz /Komodo/releases/archive/1.x/1.2.6/Komodo-1.2.6-mozilla-patches.tar.gz [R,L]
RewriteRule MozillaPatches/Komodo-1.2.9-win32-mozilla-patched.tar.gz /Komodo/releases/archive/1.x/1.2.9/Komodo-1.2.9-win32-mozilla-patched.tar.gz [R,L]
RewriteRule MozillaPatches/Komodo-2.3.0-mozilla-patches.tar.gz /Komodo/releases/archive/2.x/2.3.0/Komodo-2.3.0-mozilla-patches.tar.gz [R,L]
RewriteRule MozillaPatches/mozilla-patches-ko23.tar.gz /Komodo/releases/archive/2.x/2.3.0/Komodo-2.3.0-mozilla-patches.tar.gz [R,L]
RewriteRule MozillaPatches/mozilla-patches-ko25.zip /Komodo/releases/archive/2.x/2.5.2/Komodo-2.5-mozilla-patches.zip [R,L]
RewriteRule MozillaPatches/mozilla-patches-ko30.zip /Komodo/releases/archive/3.x/3.0.1/Komodo-3.0-mozilla-patches.zip [R,L]
RewriteRule MozillaPatches/mozilla-patches-ko31.zip /Komodo/releases/archive/3.x/3.1.0/Komodo-3.1-mozilla-patches.zip [R,L]
RewriteRule MozillaPatches/mozilla-patches-ko35.zip /Komodo/releases/archive/3.x/3.5.3/Komodo-3.5-mozilla-patches.zip [R,L]
RewriteRule MozillaPatches/Komodo-4.0-mozilla-patches.zip /Komodo/releases/archive/4.x/4.0.3/Komodo-4.0-mozilla-patches.zip [R,L]
RewriteRule MozillaPatches/Komodo-4.1-mozilla-patches.zip /Komodo/releases/archive/4.x/4.1.1/Komodo-4.1-mozilla-patches.zip [R,L]
RewriteRule MozillaPatches/Komodo-4.2-mozilla-patches.zip /Komodo/releases/4.2.1/Komodo-4.2-mozilla-patches.zip [R,L]
RewriteRule MozillaPatches/Komodo-4.3-mozilla-patches.zip /Komodo/releases/4.3.0/Komodo-4.3-mozilla-patches.zip [R,L]


# RemoteDebugging redirects 
RewriteRule RemoteDebugging/komodo_javascript_debugger.xpi /Komodo/releases/latest/remotedebugging/komodo_javascript_debugger.xpi [R,L]

RewriteRule RemoteDebugging/1.2/(.*) /Komodo/releases/archive/1.x/1.2.9/remotedebugging/ [R,L]

RewriteRule RemoteDebugging/2.0/(.*) /Komodo/releases/archive/2.x/2.0.1/remotedebugging/ [R,L]

RewriteRule RemoteDebugging/3.0/[^/]+/(.*3\.0\.0.*) /Komodo/releases/archive/3.x/3.0.0/remotedebugging/$1 [R,L]
RewriteRule RemoteDebugging/3.0/[^/]+/(.*3\.0\.1.*) /Komodo/releases/archive/3.x/3.0.1/remotedebugging/$1 [R,L]

RewriteRule RemoteDebugging/3.1/[^/]+/(.*3\.1\.0.*) /Komodo/releases/archive/3.x/3.1.0/remotedebugging/$1 [R,L]
RewriteRule RemoteDebugging/3.1/(.*) /Komodo/releases/archive/3.x/3.1.0/remotedebugging/ [R,L]

RewriteRule RemoteDebugging/3.5/[^/]+/(.*3\.5\.1.*) /Komodo/releases/archive/3.x/3.5.1/remotedebugging/$1 [R,L]
RewriteRule RemoteDebugging/3.5/[^/]+/(.*3\.5\.2.*) /Komodo/releases/archive/3.x/3.5.2/remotedebugging/$1 [R,L]
RewriteRule RemoteDebugging/3.5/[^/]+/(.*3\.5\.3.*) /Komodo/releases/archive/3.x/3.5.3/remotedebugging/$1 [R,L]
RewriteRule RemoteDebugging/3.5/(.*) /Komodo/releases/archive/3.x/3.5.3/remotedebugging/ [R,L]

RewriteRule RemoteDebugging/4.0/komodo_javascript_debugger.xpi /Komodo/releases/archive/4.x/4.0.3/remotedebugging/komodo_javascript_debugger.xpi [R,L]
RewriteRule RemoteDebugging/4.0/[^/]+/(.*4\.0\.0.*) /Komodo/releases/archive/4.x/4.0.0/remotedebugging/$1 [R,L]
RewriteRule RemoteDebugging/4.0/[^/]+/(.*4\.0\.1.*) /Komodo/releases/archive/4.x/4.0.1/remotedebugging/$1 [R,L]
RewriteRule RemoteDebugging/4.0/[^/]+/(.*4\.0\.2.*) /Komodo/releases/archive/4.x/4.0.2/remotedebugging/$1 [R,L]
RewriteRule RemoteDebugging/4.0/[^/]+/(.*4\.0\.3.*) /Komodo/releases/archive/4.x/4.0.3/remotedebugging/$1 [R,L]
RewriteRule RemoteDebugging/4.0/(.*) /Komodo/releases/archive/4.x/4.0.3/remotedebugging/ [R,L]

RewriteRule RemoteDebugging/4.1/komodo_javascript_debugger.xpi /Komodo/releases/archive/4.x/4.1.1/remotedebugging/komodo_javascript_debugger.xpi [R,L]
RewriteRule RemoteDebugging/4.1/[^/]+/(.*4\.1\.0.*) /Komodo/releases/archive/4.x/4.1.0/remotedebugging/$1 [R,L]
RewriteRule RemoteDebugging/4.1/[^/]+/(.*4\.1\.1.*) /Komodo/releases/archive/4.x/4.1.1/remotedebugging/$1 [R,L]
RewriteRule RemoteDebugging/4.1/(.*) /Komodo/releases/archive/4.x/4.1.1/remotedebugging/ [R,L]

RewriteRule RemoteDebugging/4.2/komodo_javascript_debugger.xpi /Komodo/releases/archive/4.x/4.2.1/remotedebugging/komodo_javascript_debugger.xpi [R,L]
RewriteRule RemoteDebugging/4.2/[^/]+/(.*4\.2\.0.*) /Komodo/releases/archive/4.x/4.2.0/remotedebugging/$1 [R,L]
RewriteRule RemoteDebugging/4.2/[^/]+/(.*4\.2\.1.*) /Komodo/releases/archive/4.x/4.2.1/remotedebugging/$1 [R,L]
RewriteRule RemoteDebugging/4.2/(.*) /Komodo/releases/archive/4.x/4.2.1/remotedebugging/ [R,L]

RewriteRule RemoteDebugging/4.3/komodo_javascript_debugger.xpi /Komodo/releases/archive/4.x/4.3.0/remotedebugging/komodo_javascript_debugger.xpi [R,L]
RewriteRule RemoteDebugging/4.3/(.*) /Komodo/releases/archive/4.x/4.3.0/remotedebugging/ [R,L]
"""



#---- mainline

if __name__ == '__main__':
    #expected_redirs_from_htaccess_rules()
    check_redirects()
