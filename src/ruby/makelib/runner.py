#!/usr/bin/env python
# Copyright (c) 2005-2006 ActiveState Software Inc.
# Author:
#   Trent Mick (TrentM@ActiveState.com)

"""A Python interpretation of GNU make."""

import os
import sys
import re
from pprint import pprint
import glob
import logging
import optparse
import time
import traceback

import makelib


log = logging.getLogger("make")



#---- internal support functions

# Based on Recipe: pretty_logging (0.1) in C:\trentm\tm\recipes\cookbook
class _MakeLogFormatter(logging.Formatter):
    """make-specific logging output.

    - lowercase logging level names
    - no "info" for normal info level
    - when logging from a target include the target name in the message:
      set the "target" attribute to the current target name.

    XXX The "target" stuff won't work for -j: multiple sync target
        building. Solution: could isolate via thread ID.
    """
    def get_fmt(self, record):
        fmt = "%(name)s: "
        target = getattr(record, "target", None)
        if target:
            fmt += "[%(target)s] "
        if record.levelno != logging.INFO:
            fmt += "%(levelname)s: " 
        fmt += "%(message)s"
        return fmt
    def format(self, record):
        record.levelname = record.levelname.lower() # uppercase is ugly
        #XXX This is a non-threadsafe HACK. Really the base Formatter
        #    class should provide a hook accessor for the _fmt
        #    attribute. *Could* add a lock guard here (overkill?).
        _saved_fmt = self._fmt
        self._fmt = self.get_fmt(record)
        try:
            return logging.Formatter.format(self, record)
        finally:
            self._fmt = _saved_fmt

class _MakeLogger(logging.Logger):
    """A Logger that passes on its "target" attr to created LogRecord's
    for the benefit of the handling Formatter. 
    """
    target = None
    def makeRecord(self, *args):
        record = logging.Logger.makeRecord(self, *args)
        record.target = self.target
        return record

def _setup_logging():
    logging.setLoggerClass(_MakeLogger)
    hdlr = logging.StreamHandler()
    fmtr = _MakeLogFormatter()
    hdlr.setFormatter(fmtr)
    logging.root.addHandler(hdlr)
    global log
    log = logging.getLogger("make")
    log.setLevel(logging.INFO)
    #log.setLevel(logging.DEBUG) #XXX


#XXX Make this a recipe.
def _optparse_zero_or_one_arg(option, opt_str, value, parser):
    """Add optparse option callback that will accept one or zero args.

    An arg is only consumed if (1) one is available and (2) it doesn't
    look like an option. Use this callback as follows:

        parser.add_option("-x", ..., action="callback",
            callback=_optparse_zero_or_one_arg, dest="blah")

    Specifying "dest" is necessary (getting auto-gleaning from the
    option strings is messy).

    After parsing, 'options.blah' will be:
        None        option was not specified
        True        option was specified, no argument
        <string>    option was specified, the value is the argument string

    TODO:
    - add to Python cookbook? and personal cookbook
    """
    value = True
    rargs = parser.rargs
    if parser.rargs:
        arg = parser.rargs[0]
        # Stop if we hit an arg like "--foo", "-a", "-fx", "--file=f",
        # etc.  Note that this also stops on "-3" or "-3.0", so if
        # your option takes numeric values, you will need to handle
        # this.
        if ((arg[:2] == "--" and len(arg) >= 2) or
            (arg[:1] == "-" and len(arg) > 1 and arg[1] != "-")):
            pass
        else:
            value = arg
            del parser.rargs[0]
    setattr(parser.values, option.dest, value)



#---- mainline

def _do_main(argv):
    _setup_logging()

    usage = "usage: %prog [TARGETS...]"
    version = "%prog "+makelib.__version__
    parser = optparse.OptionParser(prog="make", usage=usage, version=version,
                                   description=__doc__)
    parser.add_option("-v", "--verbose", dest="log_level",
        action="store_const", const=logging.DEBUG,
        help="more verbose output")
    parser.add_option("-q", "--quiet", dest="log_level",
        action="store_const", const=logging.WARNING,
        help="quieter output")
    parser.add_option("-f", dest="makefile_path",
        help="specify the makefile (defaults to Makefile.py in the "
             "current directory)")
    parser.add_option("-t", "--list-targets", action="callback",
        callback=_optparse_zero_or_one_arg,  dest="list_targets",
        help="list the available targets")
    parser.add_option("-k", "--keep-going", action="store_true",
        help="keep going as far as possible after an error")
    parser.add_option("-n", "--dry-run", action="store_true",
        help="dry-run, don't execute any target bodies (use with -v to "
             "trace how targets are executed)")
##    parser.add_option("-G", "--generate-makefile", action="store_true",
##        help="generate a GNU Makefile from the given Makefile.py")
    parser.set_defaults(log_level=logging.INFO)
    options, targets = parser.parse_args()
    logging.getLogger("make").setLevel(options.log_level)

    makefile_path = makelib.find_makefile_path(options.makefile_path)
    maker = makelib.Maker(options, makefile_path)
    if options.list_targets is not None:
        maker.list_targets()
    else:
        before = time.time()
        maker.make(*targets)
        after = time.time()
        ##XXX Should use the state object to keep running total of *all*
        ##    targets re-made. The top-level number here is useless.
        #log.info("%d targets made in %.2fs.", maker.num_targets_made, 
        #         after-before)

def main(argv=sys.argv):
    try:
        retval = _do_main(argv)
    except KeyboardInterrupt:
        sys.exit(1)
    except SystemExit:
        raise
    except:
        exc_info = sys.exc_info()
        if hasattr(exc_info[0], "__name__"):
            exc_class, exc, tb = exc_info
            tb_path, tb_lineno, tb_func = traceback.extract_tb(tb)[-1][:3]
            target = hasattr(exc, "make_target") and exc.make_target or None
            prefix = target and ("[%s] " % target.name) or ""
            #XXX Should, I think, only include the path/lineno/func info
            #    if (1) not isEnabledFor(DEBUG) and (2) we are erroring
            #    in the *user's* code. I.e. stop when we cross the
            #    make.py/_makelib boundary.
            log.error("%s%s (%s:%s in %s)", prefix, exc_info[1], tb_path,
                      tb_lineno, tb_func)
        else:  # string exception
            log.error(exc_info[0])
        if log.isEnabledFor(logging.DEBUG):
            print
            traceback.print_exception(*exc_info)
        sys.exit(1)
    else:
        sys.exit(retval)

if __name__ == "__main__":
    main()

