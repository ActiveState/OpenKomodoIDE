#!/usr/bin/env python

import os
import sys
import time
import types
from optparse import OptionParser
import p4

verbose = 0

def printP4Exception(p4c, e):
    if p4c.errors:
        for e in p4c.errors:
            print e
    else:
        print "P4Exception:", e


def submitFile(p4c, fileinfoList, message):
    #print "Submitting files:", fileinfoList
    change = p4c.fetch_change()
    change["Description"] = message
    Files = []
    for p4file in fileinfoList:
        if p4file['depotFile'] in change["Files"]:
            Files.append(p4file['depotFile'])
    if not Files:
        print "No open files to submit"
        return
    change["Files"] = Files
    if verbose:
        print change
    result = p4c.save_submit(change)
    if verbose:
        print result
    return result

def deleteFile(p4c, path):
    if verbose:
        print "Deleting file:", path
    result = p4c.run_delete(path)
    if verbose:
        print result
    return result

def getChangeSpec(p4c):
    if verbose:
        print "Getting change spec"
    result = p4c.fetch_change()
    if verbose:
        print result
    return result

def addFile(p4c, path):
    if verbose:
        print "Adding file:", path
    result = p4c.run_add(path)
    if verbose:
        print result
    return result

def diffFile(p4c, path):
    if verbose:
        print "Diffing file:", path
    result = p4c.run_diff(path)
    if verbose:
        print result
    return result

def revertFile(p4c, path):
    if verbose:
        print "Reverting file:", path
    result = p4c.run_revert(path)
    if verbose:
        print result
    return result

def openForEdit(p4c, path):
    if verbose:
        print "Opening for edit:", path
    result = p4c.run_edit(path)
    if verbose:
        print result
    return result

def getFileInfo(p4c, path):
    if verbose:
        print "Getting file info:", path
    result = p4c.run_fstat(path)
    if verbose:
        print result
    return result

def sync(p4c, path):
    if verbose:
        print "Syncing client for path:", path
    updates = p4c.run_sync(path)
    if updates:
        for update in updates:
            print update
    else:
        print "All files up to date."

def help(p4c):
    help = p4c.run_help("commands")
    print '\n'.join(help)

def info(p4c):
    print "P4 host:", p4c.host
    print "P4 port:", p4c.port
    print "P4 user:", p4c.user
    print "P4 client:", p4c.client
    print "P4 cwd:", p4c.cwd


def testp4python(opts, args):
    if opts.verbose:
        global verbose
        verbose = 1
    p4c = p4.P4()
    p4c.parse_forms()
    p4c.connect()
    try:
        if opts.verbose:
            info(p4c)
            #getChangeSpec(p4c)
            #return
        if not args:
            help(p4c)
            return

        command = args[0]
        if command not in [ 'add', 'edit', 'sync', 'diff', 'revert', 'delete', 'submit', "fstat" ]:
            print "Command '%s' not supported in this simple p4python test" % (command)
            return

        if command == 'add':
            for arg in args[1:]:
                addFile(p4c, arg)
        elif command == 'edit':
            for arg in args[1:]:
                openForEdit(p4c, arg)
        elif command == 'sync':
            for arg in args[1:]:
                sync(p4c, arg)
        elif command == 'diff':
            for arg in args[1:]:
                print diffFile(p4c, arg)
        elif command == 'revert':
            for arg in args[1:]:
                revertFile(p4c, arg)
        elif command == 'delete':
            for arg in args[1:]:
                deleteFile(p4c, arg)
        elif command == 'submit':
            allfiles = []
            for arg in args[1:]:
                fileinfo = getFileInfo(p4c, arg)
                if not fileinfo:
                    print "Unknown file path '%s'" % (arg)
                    return
                allfiles += fileinfo
            if not allfiles:
                print "No files to submit"
                return
            message = raw_input("Commit message: ")
            submitFile(p4c, allfiles, message)
        elif command == 'fstat':
            for arg in args[1:]:
                print getFileInfo(p4c, arg)
    finally:
        p4c.disconnect()

def main():
    parser = OptionParser()
    parser.add_option("-v", "--verbose", dest="verbose",
                      action="store_true", help="Verbose messages")
    (opts, args) = parser.parse_args()
    return testp4python(opts, args)

# Run from the command line
if __name__ == "__main__":
    sys.exit(main())
