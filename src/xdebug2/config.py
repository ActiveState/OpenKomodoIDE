#!/usr/bin/env python

from os.path import join, expanduser, abspath, dirname

pkg_cache_dir = join("tmp", "pkg_cache")
build_dir = "build"

versions = {
    #"xdebug": "git",     # latest xdebug source code from the Git repository
    "xdebug": "2.5.0",    # will only work with PHP 5.4 and above.

    # The latest xdebug requires PHP 5.2 or newer.
    "php71": "7.1.0",
    "php70": "7.0.7",
    "php56": "5.6.0",
    "php55": "5.5.15",

    # Windows PHP 5.2 build requires 'xmlXPathContextSetCache' which
    # I believe is new in libxml2 2.6.26. (unless configured
    # --without-libxml).
    "libxml2": "2.8.0",
    "libxslt": "1.1.26",
    "libiconv": "1.14",
    "zlib": "1.2.7",
}

# Base dir for installing PHP (not used on Windows).
php_install_dir = expanduser("~/install/php")


# Komodo's prebuilt base dir for xdebug bits.
prebuilt_dir = join(dirname(dirname(dirname(abspath(__file__)))),
    "prebuilt", "xdebug")
