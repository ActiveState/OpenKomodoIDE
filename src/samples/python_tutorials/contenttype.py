#!/usr/bin/env python

"""Determine the content-type of a file.

Module usage:
    from contenttype import getContentType
    ct = getContentType("foo.py")

This module exports the single getContentType() method to determine the
content type of a file. Currently it only uses the filename to determine
the content type -- i.e. the file content is not read. The actual content
type information is encoded in the content.types file in the same directory
and this module.
"""

import os
import re
import sys
import logging


#---- globals

log = logging.getLogger("contenttype")


#---- internal support stuff

def _getContentTypesFile():
    dname = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(dname, "content.types")

def _getContentTypesRegistry(filename=None):
    """Return the registry for the given content.types file.
   
    "filename" can optionally be used to specify a content.types file.
        Otherwise the default content.types file is used.
   
    The registry is three mappings:
        <suffix> -> <content type>
        <regex> -> <content type>
        <filename> -> <content type>
    """
    if filename is None:
        filename = _getContentTypesFile()

    suffixMap = {}
    regexMap = {}
    filenameMap = {}
    log.debug('load content types file: %r' % filename)
    try:
        fin = open(filename)
    except IOError:
        return
    while 1:
        line = fin.readline()
        if not line: break
        words = line.split()
        for i in range(len(words)):
            if words[i][0] == '#':
                del words[i:]
                break
        if not words: continue
        contentType, patterns = words[0], words[1:]
        if not patterns:
            if line[-1] == '\n': line = line[:-1]
            raise PreprocessError("bogus content.types line, there must "\
                                  "be one or more patterns: '%s'" % line)
        for pattern in patterns:
            if pattern.startswith('.'):
                if sys.platform.startswith("win"):
                    # Suffix patterns are case-insensitive on Windows.
                    pattern = pattern.lower()
                suffixMap[pattern] = contentType
            elif pattern.startswith('/') and pattern.endswith('/'):
                regexMap[re.compile(pattern[1:-1])] = contentType
            else:
                filenameMap[pattern] = contentType
    fin.close()
    return suffixMap, regexMap, filenameMap


#---- public interface

def getContentType(filename):
    """Return a content type for the given filename.

    'check' maintains its own registry of content types similar to
    mime.types registries. See "check.types".  Returns None is no
    content type can be determined.
    """
    suffixMap, regexMap, filenameMap = _getContentTypesRegistry()
    basename = os.path.basename(filename)
    contentType = None
    # Try to determine from the filename.
    if not contentType and filenameMap.has_key(basename):
        contentType = filenameMap[basename]
        log.debug("Content type of '%s' is '%s' (determined from full "\
                  "filename).", filename, contentType)
    # Try to determine from the suffix.
    if not contentType and '.' in basename:
        suffix = "." + basename.split(".")[-1]
        if sys.platform.startswith("win"):
            # Suffix patterns are case-insensitive on Windows.
            suffix = suffix.lower()
        if suffixMap.has_key(suffix):
            contentType = suffixMap[suffix]
            log.debug("Content type of '%s' is '%s' (determined from "\
                      "suffix '%s').", filename, contentType, suffix)
    # Try to determine from the registered set of regex patterns.
    if not contentType:
        for regex, ctype in regexMap.items():
            if regex.search(basename):
                contentType = ctype
                log.debug("Content type of '%s' is '%s' (matches regex '%s')",
                          filename, contentType, regex.pattern)
                break
    return contentType


