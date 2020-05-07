#!/usr/bin/env python

"""
    Convert a Komodo toolbox into a file-system hierarchy

    Command Line Usage:
        expand_toolbox [<options>...] <.kpf-file>

    Options:
        -h, --help      Print this help and exit.
        -V, --version   Print the version info and exit.
        -v, --verbose   Give verbose output for errors.
        -f, --force     Overwrite existing files
        -n, --dry-run   Dry run

        -o <outdir>     Write output to the given directory. By default
                        output goes to ./.koToolbox/
                        
    Sample usage:
    
    Expand the standard toolbox into directory foo:
    
    expand_toolbox.py --force -o ./foo ~/.komodoide/5.20/toolbox.kpf
    
    Some common commands:
    python C:\Users\ericp\svn\apps\komodo\util\expand_toolbox.py -v -o C:\Users\ericp\trash\sharedToolbox C:\Users\ericp\lab\komodo\toolbox.kpf
    python C:\Users\ericp\svn\apps\komodo\util\expand_toolbox.py -v -o C:\Users\ericp\trash\stdToolbox C:\Users\ericp/AppData/Roaming/ActiveState/KomodoIDE/5.2/toolbox.kpf
"""

import os
import sys
import getopt
import json
import re
import logging

from os.path import join, dirname
sys.path.insert(0, join(os.getcwd(), dirname(dirname(__file__)), 'src', 'toolbox'))
print sys.path[0]
import koToolbox2
import koMigrateV5Toolboxes

log = logging.getLogger("expand_toolbox")
log.setLevel(logging.DEBUG)
#---- mainline

def main(argv):
    global nowrite
    logging.basicConfig()
    log.setLevel(logging.INFO)

    # Process options.
    try:
        optlist, args = getopt.getopt(argv[1:], "hVvo:fn",
            ["help", "version", "verbose", "force", "dry-run"])
    except getopt.GetoptError, msg:
        log.error("%s. Your invocation was: %s\n"\
                         % (msg, argv))
        log.error("See 'expand_toolbox --help'.\n")
        return 1
    opts = [opt for opt, optarg in optlist]
    force = 0
    outdir = koToolbox2.DEFAULT_TARGET_DIRECTORY
    for opt, optarg in optlist:
        if opt in ("-h", "--help"):
            sys.stdout.write(__doc__)
            return 0
        elif opt in ("-V", "--version"):
            ver = '.'.join([str(i) for i in _version_])
            sys.stderr.write("expand_toolbox %s\n" % ver)
            return 0
        elif opt in ("-v", "--verbose"):
            log.setLevel(logging.DEBUG)
            verbose = 1
        elif opt in ("-f", "--force"):
            force = 1
        elif opt == "-o":
            outdir = optarg
        elif opt in ("-n", "--dry-run"):
            nowrite = True

    # Process arguments.
    if len(args) != 1:
        log.error("incorrect number of arguments: argv=%r\n" % argv)
        return 1
    toolboxFile = args[0]
    try:
        return koMigrateV5Toolboxes.expand_toolbox(toolboxFile, outdir, toolboxDirName=None, force=force)
    except koMigrateV5Toolboxes.ExpandToolboxException:
        log.exception("problemo...")
        return 2

if __name__ == "__main__":
    __file__ = sys.argv[0]
    rc = main(sys.argv)
    print("done")
    sys.exit(rc)
