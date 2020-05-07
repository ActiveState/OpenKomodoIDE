# Copyright (c) 2003-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""
    Command-line interface to sysdata package.

    Usage:
        from sysdata.main import main
        main(sys.argv)
"""

import os
import sys
import pprint
import getopt
import cmd
import logging

import sysdata
from sysdata.errors import SysDataError


#---- globals

log = logging.getLogger("sysdata.main")



#---- internal support stuff

class _ListCmd(cmd.Cmd):
    """Pass arglists instead of command strings to commands.

    Modify the std Cmd class to pass arg lists instead of command lines.
    This seems more appropriate for integration with sys.argv which handles
    the proper parsing of the command line arguments (particularly handling
    of quoting of args with spaces).
    """
    name = "_ListCmd"
    
    def cmdloop(self, intro=None):
        raise NotImplementedError

    def onecmd(self, argv):
        # Differences from Cmd
        #   - use an argv, rather than a command string
        #   - don't specially handle the '?' redirect to 'help'
        #   - don't allow the '!' shell out
        if not argv:
            return self.emptyline()
        self.lastcmd = argv
        cmdName = argv[0]
        try:
            func = getattr(self, 'do_' + cmdName)
        except AttributeError:
            return self.default(argv)
        try:
            return func(argv)
        except TypeError, ex:
            log.error("%s: %s", cmdName, ex)
            log.error("try '%s help %s'", self.name, cmdName)
            if 1:   # for debugging
                print
                import traceback
                traceback.print_exception(*sys.exc_info())

    def default(self, args):
        log.error("unknown syntax: '%s'", " ".join(args))
        return 1

    def _do_one_help(self, arg):
        try:
            # If help_<arg1>() exists, then call it.
            func = getattr(self, 'help_' + arg)
        except AttributeError:
            try:
                doc = getattr(self, 'do_' + arg).__doc__
            except AttributeError:
                doc = None
            if doc: # *do* have help, print that
                sys.stdout.write(doc + '\n')
                sys.stdout.flush()
            else:
                log.error("no help for '%s'", arg)
        else:
            return func()

    # Technically this improved do_help() does not fit into _ListCmd, and
    # something like this would be more appropriate:
    #    def do_help(self, argv):
    #        cmd.Cmd.do_help(self, ' '.join(argv[1:]))
    # but I don't want to make another class for it.
    def do_help(self, argv):
        if argv[1:]:
            for arg in argv[1:]:
                retval = self._do_one_help(arg)
                if retval:
                    return retval
        else:
            doc = self.__class__.__doc__  # try class docstring
            if doc:
                sys.stdout.write(doc + '\n')
                sys.stdout.flush()
            elif __doc__:  # else try module docstring
                sys.stdout.write(__doc__)
                sys.stdout.flush()

    def emptyline(self):
        # Differences from Cmd
        #   - Don't repeat the last command for an emptyline.
        pass



#---- command line interface

class SysDataShell(_ListCmd):
    """
    sysdata - a command-line interface for debugging the sysdata module

    Usage:
        sysdata [<options>...] <command> [<args>...]

    Options:
        -h, --help              Print this help and exit.
        -V, --version           Print the version info and exit.
        -v, --verbose           More verbose output.

    Sysdata's usage is intended to feel like p4's command line
    interface.

    Getting Started:
        sysdata help            Print this help.
        sysdata help <command>  Help on a specific command.

    Commands:
        get <name>              Get the named datum.
        flush <name>            Flush the named datum (or data).
        getters                 Dump the set of getters.
        cache                   Dump the current data cache.
    """
    name = "sysdata"

    def emptyline(self):
        self.do_help(["help"])

    def help_usage(self):
        sys.stdout.write(__doc__)
        sys.stdout.flush()

    def do_get(self, argv):
        """
    get -- Get the named datum.

    sysdata get [<names>...]

        <names> is a list of system data names to get

        Return the named datum. If the datum does not exist in the cache
        it will be calculated and cached first. It is an error if the
        name is unknown.
        """
        try:
            optlist, args = getopt.getopt(argv[1:], "")
        except getopt.GetoptError, ex:
            log.error("get: %s", ex)
            log.error("get: try 'sysdata help get'")
            return 1

        names = args

        for name in names:
            try:
                datum = sysdata.get(name)
                print "%s: %r" % (name, datum)
            except SysDataError, ex:
                log.error(str(ex))
                if log.isEnabledFor(logging.DEBUG):
                    import traceback
                    traceback.print_exception(*sys.exc_info())
                return 1

    def do_flush(self, argv):
        """
    flush -- Flush the named datum (or data) from the cache.

    sysdata flush [<names>...]

        <names> is a list of name "specs" of system data to flush.

        You may specify a simple name of a "name spec", for example,
            perl.*
        to flush the whole "perl..." tree. The asterisk is only legal at
        the end of the name and following a ".".
    """
        try:
            optlist, args = getopt.getopt(argv[1:], "")
        except getopt.GetoptError, ex:
            log.error("flush: %s", ex)
            log.error("flush: try 'sysdata help flush'")
            return 1

        names = args

        for name in names:
            try:
                sysdata.flush(name)
            except SysDataError, ex:
                log.error(str(ex))
                if log.isEnabledFor(logging.DEBUG):
                    import traceback
                    traceback.print_exception(*sys.exc_info())
                return 1

    def do_cache(self, argv):
        """
    cache -- Dump the current system data cache

    sysdata cache
    """
        try:
            optlist, args = getopt.getopt(argv[1:], "")
        except getopt.GetoptError, ex:
            log.error("cache: %s", ex)
            log.error("cache: try 'sysdata help cache'")
            return 1

        pprint.pprint(sysdata.cache)

    def do_getters(self, argv):
        """
    getters -- Dump the set of system data getters

    sysdata getters
    """
        try:
            optlist, args = getopt.getopt(argv[1:], "")
        except getopt.GetoptError, ex:
            log.error("getters: %s", ex)
            log.error("getters: try 'sysdata help getters'")
            return 1

        pprint.pprint(sysdata.getters)



def main(argv):
    # Setup logging.
    logging.basicConfig()

    try:
        optlist, args = getopt.getopt(argv[1:], "hVv",
            ["help", "version", "verbose"])
    except getopt.GetoptError, msg:
        log.error("%s. Your invocation was: %s", msg, argv)
        log.error("Try 'sysdata --help'.")
        return 1
    for opt, optarg in optlist:
        if opt in ("-h", "--help"):
            sys.stdout.write(SysDataShell.__doc__)
            return 0
        elif opt in ("-V", "--version"):
            ver = [str(i) for i in sysdata._version_]
            print "sysdata %s" % '.'.join(ver)
            return 0
        elif opt in ("-v", "--verbose"):
            log.setLevel(logging.DEBUG)

    shell = SysDataShell()
    return shell.onecmd(args)


