# Copyright (c) 2003-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

r"""
    A Python module to manage a dictionary of named, cache-able system
    data.

    Here is the problem. Komodo needs to know stuff about the system on
    which it is running. E.g. the version of the currently configured
    PDK; whether the current Perl is ActivePerl, etc. This info
    is sometimes expensive the determine each time it is needed.
    Therefore a system of caching this data would be helpful.

    When you start caching data you need to know when to flush the
    cache. For example, if the user selects a new "current" perl then
    all info about the current perl (and likely the current PDK must be
    flushed from the cache).
    
    This module provides a simple interface for all of this:
        get(<name>)
        flush(<name>)
    At the pure Python level, the data can be of any type.  There is a
    koISystemDataService to wrap this interface to XPCOM (with the
    expected limitations on return types).

    Any piece of system data is assigned a <name>. For convenience (XXX
    this may end up being for more than convenience, i.e. required) a
    name hierarchy is implied by using dotted names. For example:
        perl                C:\Perl\bin\perl.exe
        perl.version        5.8.0
        perl.installDir     C:\Perl
        perl.buildNum       804
    Then, when a .flush("perl") is called on this module to indicate
    that a new "current" perl installation has been selected, this
    module can know that all "perl.*" data must be flushed from the
    cache.

    XXX The flushing interface may still need to be fleshed out. This
        basically boils down to deciding who manages the knowledge that
        when "perl" is flushed, "perl.version" must also be flushed.
        ...and how.
"""

import os
import sys
import pprint
import getopt
import cmd
import logging

from sysdata.errors import SysDataError
from sysdata import pdk


#---- globals

_version_ = (0, 2, 0)
log = logging.getLogger("sysdata")


# Registry of known datum names to there "getter".
#
# A "getter" can be a raw value, a callable getter, or an exception.
# If a callable the value is expected to be the result of calling the
# getter with one argument: the datum name.
getters = {
    # <name>: <getter>
    "pdk.perlapp": pdk.perlapp,
    "pdk.perlctrl": pdk.perlctrl,
    "pdk.perlsvc": pdk.perlsvc,
    "pdk.perlnet": pdk.perlnet,
    "pdk.perltray": pdk.perltray,
    "pdk.installed": pdk.installed,
    "pdk.haveLicense": pdk.haveLicense,
    "pdk.version": pdk.version,
    "pdk.localHelpFile": pdk.localHelpFile,
    "pdk.webHelpFile": pdk.webHelpFile,
}

setters = {
    "pdk.perlbinpath": pdk.perlbinpath,
}

# The system data cache.
cache = {
    # <name>: <cached-value>
}



#---- public module interface

def set(name, value):
    """Get the named datum.

    <name> is the name of the system datum to set.
    <value> is the value to set it to.
    """
    from sysdata import cache, setters
    log.debug("get(name=%r)", name)
    setters[name](name, value)

def get(name):
    """Get the named datum.

    <name> is the name of the system datum to get.

    Return the named datum. If the datum does not exist in the cache it
    will be calculated and cached first. If the name is unknown a
    SysDataError will be raised.
    """
    from sysdata import cache, getters
    log.debug("get(name=%r)", name)

    if name in cache:
        log.info("get(): getting '%s' from cache", name)
        return cache[name]
    elif name not in getters:
        raise SysDataError("unknown system data name: '%s'" % name)
    else:
        # The "getter" in the getters dictionary can be a raw value, a
        # callable getter, or an exception.
        log.info("get(): determining '%s'", name)
        getter = getters[name]
        if callable(getter):
            value = getter(name)
        elif isinstance(getter, Exception):
            raise getter
        else:
            value = getter
        cache[name] = value
        return value


def flush(name):
    """Flush the named datum (or data) from the cache.

    <name> is a "name spec" for a system datum or data.

    A "name spec" is a just a simple name or a something of the for
    "<name>.*" to indicate a whole data tree.

    This does not return anything. A SysDataError is raised if the name
    is illegal or if the name is unknown. It is not an error to flush a
    known name that does not happen to be in the cache.
    """
    from sysdata import cache, getters
    log.debug("flush(name=%r)", name)
    if name.endswith(".*"):
        prefix = name[:-1]
        names = [n for n in cache.keys() if n.startswith(prefix)]
        for n in names:
            log.info("flushing '%s' from cache", n)
            del cache[n]
    elif "*" in name:
        raise SysDataError("illegal name for flush(): '%s'" % name)
    elif name not in getters:
        raise SysDataError("unknown system data name: '%s'" % name)
    else:
        if name in cache:
            log.info("flushing '%s' from cache", name)
            del cache[name]



if __name__ == "__main__":
    __file__ = os.path.abspath(sys.argv[0])
    from sysdata.main import main
    sys.exit( main(sys.argv) )


