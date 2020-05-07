# Copyright (c) 2000-2008 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.
"""
Utilities for invocations used only by Komodo IDE.
See run/runutils.py for routines also used in OpenKomodo.
"""

import os, sys
import re
import logging


log = logging.getLogger("invocationutils")
#log.setLevel(logging.DEBUG)

class PrefException(Exception):
    def __init__(self, prefid, msg):
        self.prefid = prefid
        self.msg = msg
        Exception.__init__(self)

def checkFileExists(prefset, pref, msg_if_empty = None):
    fname = prefset.getStringPref(pref)
    if msg_if_empty and not fname:
        raise PrefException(pref, msg_if_empty)
    if not os.path.isfile(fname):
        # Bug 98751: Patch basename-only filenames
        if pref != 'cwd':
            try:
                cwd = prefset.getString("cwd", None)
                if cwd:
                    path = os.path.realpath(os.path.join(cwd, fname))
                    if os.path.isfile(path):
                        return
            except:
                log.exception("Problem joining with cwd")
        message = "File '%s' does not exist" % fname
        raise PrefException(pref, message)

def environmentStringsToDict(existing):
    ret = {}
    for i in range(len(existing)):
        try:
            key, value = existing[i].split("=", 1)
            ret[key] = value;
        except ValueError:
            log.debug("error on value " + repr(existing[i]))
            pass
    return ret

def environmentDictToStrings(env_dict):
    return ["%s=%s"  % (item[0], item[1]) for item in env_dict.items()]

_short_ver_re = re.compile("(\d+)(\.\d+)*([a-z](\d+)?)?")
def split_short_ver(ver_str, intify=False, pad_zeros=None):
    """Parse the given version into a tuple of "significant" parts.

    @param intify {bool} indicates if numeric parts should be converted
        to integers.
    @param pad_zeros {int} is a number of numeric parts before any
        "quality" letter (e.g. 'a' for alpha).
   
    >>> split_short_ver("4.1.0")
    ('4', '1', '0')
    >>> split_short_ver("1.3a2")
    ('1', '3', 'a', '2')
    >>> split_short_ver("1.3a2", intify=True)
    (1, 3, 'a', 2)
    >>> split_short_ver("1.3a2", intify=True, pad_zeros=3)
    (1, 3, 0, 'a', 2)
    >>> split_short_ver("1.3x", intify=True)
    (1, 3, 'x')
    >>> split_short_ver("1.3x", intify=True, pad_zeros=3)
    (1, 3, 0, 'x')
    >>> split_short_ver("1.3", intify=True, pad_zeros=3)
    (1, 3, 0)
    >>> split_short_ver("1", pad_zeros=3)
    ('1', '0', '0')
    """
    def isint(s):
        try:
            int(s)
        except ValueError:
            return False
        else:
            return True
    def do_intify(s):
        try:
            return int(s)
        except ValueError:
            return s

    if not _short_ver_re.match(ver_str):
        raise ValueError("%r is not a valid short version string" % ver_str)

    hit_quality_bit = False
    bits = []
    for bit in re.split("(\.|[a-z])", ver_str):
        if len(bit) == 0 or bit == '.':
            continue
        if intify:
            bit = do_intify(bit)
        if pad_zeros and not hit_quality_bit and not isint(bit):
            hit_quality_bit = True
            while len(bits) < pad_zeros:
                bits.append(not intify and "0" or 0)
        bits.append(bit)
    if pad_zeros and not hit_quality_bit:
        while len(bits) < pad_zeros:
            bits.append(not intify and "0" or 0)
    return tuple(bits)

def join_short_ver(ver_tuple, pad_zeros=None):
    """Join the given version-tuple, inserting '.' as appropriate.

    @param pad_zeros {int} is a number of numeric parts before any
        "quality" letter (e.g. 'a' for alpha).
    
    >>> join_short_ver( ('4', '1', '0') )
    '4.1.0'
    >>> join_short_ver( ('1', '3', 'a', '2') )
    '1.3a2'
    >>> join_short_ver(('1', '3', 'a', '2'), pad_zeros=3)
    '1.3.0a2'
    >>> join_short_ver(('1', '3'), pad_zeros=3)
    '1.3.0'
    """
    def isint(s):
        try:
            int(s)
        except ValueError:
            return False
        else:
            return True

    if pad_zeros:
        bits = []
        hit_quality_bit = False
        for bit in ver_tuple:
            if not hit_quality_bit and not isint(bit):
                hit_quality_bit = True
                while len(bits) < pad_zeros:
                    bits.append(0)
            bits.append(bit)
        if not hit_quality_bit:
            while len(bits) < pad_zeros:
                bits.append(0)
    else:
        bits = ver_tuple

    dotted = []
    for bit in bits:
        if dotted and isint(dotted[-1]) and isint(bit):
            dotted.append('.')
        dotted.append(str(bit))
    return ''.join(dotted)

_digits_re = re.compile(r'(\d+)')
def get_version_num_parts(ver):
    """Allow experimental versions like '1.8.8a'.
    Assume that every version has exactly three parts.
    """
    parts = ver.split('.')
    if len(parts) != 3:
        raise AttributeError("Version %r doesn't have exactly 3 parts" % (ver,))
    return [int(_digits_re.match(part).group(1)) for part in parts]

def _test():
    import doctest
    doctest.testmod()

if __name__ == "__main__":
    _test()
    # print split_short_ver("5.10.0b1", intify=True)
