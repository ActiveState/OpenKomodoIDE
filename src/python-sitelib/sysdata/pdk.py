# Copyright (c) 2003-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

r"""
    Gather system data about PDK (the Perl Dev Kit).

    This is part of the "sysdata" package.

    Data:
        "pdk.perlapp": pdk.perlapp
        "pdk.perlctrl": pdk.perlctrl
        "pdk.perlsvc": pdk.perlsvc
        "pdk.perlnet": pdk.perlnet
        "pdk.perltray": pdk.perltray
        "pdk.installed": pdk.installed
        "pdk.haveLicense": pdk.haveLicense
        "pdk.version": pdk.version
        "pdk.localHelpFile": pdk.localHelpFile
        "pdk.webHelpFile": pdk.webHelpFile

    XXX Currently the "current" PDK is just the first one on the PATH.
        It might be preferable to have the "current" PDK be indicated by
        the currently selected Perl installation.
"""

import os
import sys
import re

import which
import process

from sysdata.errors import SysDataError


#---- internal support stuff

def _getLicenseAndVersionInfo():
    """Return a tuple (<haveLicense>, <version>)."""
    from sysdata import get

    perlapp = get("pdk.perlapp")
    if perlapp is None:
        return (0, None)
    argv = [perlapp, "--version"]
    p = process.ProcessOpen(argv, stdin=None)
    output, error = p.communicate()
    
    # Annoyingly, perlapp 4.x put the invalid lic warning on stdout.
    licWarnings = ["You don't seem to have a valid license.",
              "Your license does not cover this version of the product."]
    noLicense = 0
    for licWarn in licWarnings:
        if error and error.splitlines()[0].find(licWarn) != -1 or \
           output and output.splitlines()[0].find(licWarn) != -1:
            noLicense = 1
            version = None
    if noLicense:
        return (0, None)
    # Parse out the version.
    # Example version line output:
    #   (PerlApp version: 3.0.1 ...
    #   PerlApp 4.0.0 build 401 ...
    #   PerlApp 5.0.3 build 503 ...
    patterns = [
        "PerlApp (?P<version>[0-9.]+)",
        "\(PerlApp version: (?P<version>[0-9.]+)\)",
    ]
    for pattern in patterns:
        match = re.search(pattern, output)
        if match:
            version = match.group("version")
            break
    else:
        version = None

    return (1, version)



#---- module interface

gPerlBinPath = None # by default use regular path

def perlbinpath(name, value):
    global gPerlBinPath
    if value:
        gPerlBinPath = [value]
    else:
        gPerlBinPath = None
    import sysdata
    sysdata.flush("pdk.*");

def perlapp(name):
    try:
        if sys.platform.startswith('win'):
            exts = ['.exe']
        else:
            exts = None
        return which.which("perlapp", path=gPerlBinPath, exts=exts)
    except which.WhichError:
        return None

def perlctrl(name):
    try:
        if sys.platform.startswith('win'):
            exts = ['.exe']
        else:
            exts = None
        return which.which("perlctrl", path=gPerlBinPath, exts=exts)
    except which.WhichError:
        return None

def perlsvc(name):
    try:
        if sys.platform.startswith('win'):
            exts = ['.exe']
        else:
            exts = None
        return which.which("perlsvc", path=gPerlBinPath, exts=exts)
    except which.WhichError:
        return None

def perlnet(name):
    try:
        if sys.platform.startswith('win'):
            exts = ['.exe']
        else:
            exts = None
        return which.which("plc", path=gPerlBinPath, exts=exts)
    except which.WhichError:
        return None

def perltray(name):
    try:
        if sys.platform.startswith('win'):
            exts = ['.exe']
        else:
            exts = None
        return which.which("perltray", path=gPerlBinPath, exts=exts)
    except which.WhichError:
        return None

def installed(name):
    from sysdata import get
    perlapp = get("pdk.perlapp")
    return perlapp is not None


def haveLicense(name):
    from sysdata import cache
    haveLicense, version = _getLicenseAndVersionInfo()
    cache["pdk.version"] = version
    return haveLicense


def version(name):
    from sysdata import cache
    haveLicense, version = _getLicenseAndVersionInfo()
    cache["pdk.haveLicense"] = haveLicense
    return version


def localHelpFile(name):
    from sysdata import get
    perlapp = get("pdk.perlapp")
    if perlapp is None:
        return None
    installPath = os.path.dirname(os.path.dirname(perlapp))

    candidates = []
    if sys.platform.startswith("win"):
        candidates.append( os.path.join(installPath, "Docs", "PDK",
                                        "PDKUserGuide.chm") )
    candidates.append( os.path.join(installPath, "Docs", "PDK", "HTML",
                                    "index.html") )

    for candidate in candidates:
        if os.path.isfile(candidate):
            return candidate
    else:
        return None


def webHelpFile(name):
    return "http://docs.activestate.com/pdk/"


