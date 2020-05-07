#!/usr/bin/env python
# Copyright (c) 2008 ActiveState Software Inc.

r"""List files under a given dir that are not built universal.

Usage:
    lsnonuniversal DIR
"""

__version_info__ = (0, 1, 0)
__version__ = '.'.join(map(str, __version_info__))

import os
from os.path import join, dirname, basename, abspath, exists, normpath, expanduser
import sys
import re
from pprint import pprint, pformat
import traceback
import datetime
import types
import logging
import optparse

sys.path.insert(0, join(dirname(__file__), "../src/python-sitelib"))
from textinfo import TextInfo
import langinfo



#---- exceptions

class Error(Exception):
    pass



#---- globals

log = logging.getLogger("lsnonuniversal")



#---- main functions

def lsnonuniversal(d):
    skip_langs = set([
        "GIF", "Jar archive", "PNG", "Windows icon", "TIFF", "Mac icon",
        "Flash SWF", "MS Excel Document", "Apple Binary Property List",
        "XPM", "Windows executable", "MS Word Document",
        "Mach-O universal",
    ])

    non_universals_langs = set([
        "Mach-O",
    ])

    for path in _paths_from_path_patterns(
            [d], excludes=[".svn", ".hg", "CVS", ".bzr", ".git"]):
        ti = TextInfo.init_from_path(path, quick_determine_lang=True)
        if not ti.lang:
            continue
        if ti.lang in skip_langs:
            # Mainly this is help see if there are filetypes that I
            # should be looking at. Filter out the langs I know I can
            # ignore.
            continue
        if ti.lang in non_universals_langs:
            #print path, ti.lang, repr(ti.langinfo)
            yield path
        elif not ti.is_text:
            log.warn("need to look at this binary file? (%r, %s)", path, ti.langinfo)



#---- internal support functions


# Recipe: paths_from_path_patterns (0.5.1)
def _should_include_path(path, includes, excludes):
    """Return True iff the given path should be included."""
    from os.path import basename
    from fnmatch import fnmatch

    base = basename(path)
    if includes:
        for include in includes:
            if fnmatch(base, include):
                try:
                    log.debug("include `%s' (matches `%s')", path, include)
                except (NameError, AttributeError):
                    pass
                break
        else:
            try:
                log.debug("exclude `%s' (matches no includes)", path)
            except (NameError, AttributeError):
                pass
            return False
    for exclude in excludes:
        if fnmatch(base, exclude):
            try:
                log.debug("exclude `%s' (matches `%s')", path, exclude)
            except (NameError, AttributeError):
                pass
            return False
    return True

def _walk(top, topdown=True, onerror=None, follow_symlinks=False):
    """A version of `os.walk()` with a couple differences regarding symlinks.
    
    1. follow_symlinks=False (the default): A symlink to a dir is
       returned as a *non*-dir. In `os.walk()`, a symlink to a dir is
       returned in the *dirs* list, but it is not recursed into.
    2. follow_symlinks=True: A symlink to a dir is returned in the
       *dirs* list (as with `os.walk()`) but it *is conditionally*
       recursed into (unlike `os.walk()`).
       
       A symlinked dir is only recursed into if it is to a deeper dir
       within the same tree. This is my understanding of how `find -L
       DIR` works.

    TODO: put as a separate recipe
    """
    from os.path import join, isdir, islink, abspath

    # We may not have read permission for top, in which case we can't
    # get a list of the files the directory contains.  os.path.walk
    # always suppressed the exception then, rather than blow up for a
    # minor reason when (say) a thousand readable directories are still
    # left to visit.  That logic is copied here.
    try:
        names = os.listdir(top)
    except OSError, err:
        if onerror is not None:
            onerror(err)
        return

    dirs, nondirs = [], []
    if follow_symlinks:
        for name in names:
            if isdir(join(top, name)):
                dirs.append(name)
            else:
                nondirs.append(name)
    else:
        for name in names:
            path = join(top, name)
            if islink(path):
                nondirs.append(name)
            elif isdir(path):
                dirs.append(name)
            else:
                nondirs.append(name)

    if topdown:
        yield top, dirs, nondirs
    for name in dirs:
        path = join(top, name)
        if follow_symlinks and islink(path):
            # Only walk this path if it links deeper in the same tree.
            top_abs = abspath(top)
            link_abs = abspath(join(top, os.readlink(path)))
            if not link_abs.startswith(top_abs + os.sep):
                continue
        for x in _walk(path, topdown, onerror, follow_symlinks=follow_symlinks):
            yield x
    if not topdown:
        yield top, dirs, nondirs

_NOT_SPECIFIED = ("NOT", "SPECIFIED")
def _paths_from_path_patterns(path_patterns, files=True, dirs="never",
                              recursive=True, includes=[], excludes=[],
                              skip_dupe_dirs=False,
                              follow_symlinks=False,
                              on_error=_NOT_SPECIFIED):
    """_paths_from_path_patterns([<path-patterns>, ...]) -> file paths

    Generate a list of paths (files and/or dirs) represented by the given path
    patterns.

        "path_patterns" is a list of paths optionally using the '*', '?' and
            '[seq]' glob patterns.
        "files" is boolean (default True) indicating if file paths
            should be yielded
        "dirs" is string indicating under what conditions dirs are
            yielded. It must be one of:
              never             (default) never yield dirs
              always            yield all dirs matching given patterns
              if-not-recursive  only yield dirs for invocations when
                                recursive=False
            See use cases below for more details.
        "recursive" is boolean (default True) indicating if paths should
            be recursively yielded under given dirs.
        "includes" is a list of file patterns to include in recursive
            searches.
        "excludes" is a list of file and dir patterns to exclude.
            (Note: This is slightly different than GNU grep's --exclude
            option which only excludes *files*.  I.e. you cannot exclude
            a ".svn" dir.)
        "skip_dupe_dirs" can be set True to watch for and skip
            descending into a dir that has already been yielded. Note
            that this currently does not dereference symlinks.
        "follow_symlinks" is a boolean indicating whether to follow
            symlinks (default False). To guard against infinite loops
            with circular dir symlinks, only dir symlinks to *deeper*
            dirs are followed.
        "on_error" is an error callback called when a given path pattern
            matches nothing:
                on_error(PATH_PATTERN)
            If not specified, the default is look for a "log" global and
            call:
                log.error("`%s': No such file or directory")
            Specify None to do nothing.

    Typically this is useful for a command-line tool that takes a list
    of paths as arguments. (For Unix-heads: the shell on Windows does
    NOT expand glob chars, that is left to the app.)

    Use case #1: like `grep -r`
      {files=True, dirs='never', recursive=(if '-r' in opts)}
        script FILE     # yield FILE, else call on_error(FILE)
        script DIR      # yield nothing
        script PATH*    # yield all files matching PATH*; if none,
                        # call on_error(PATH*) callback
        script -r DIR   # yield files (not dirs) recursively under DIR
        script -r PATH* # yield files matching PATH* and files recursively
                        # under dirs matching PATH*; if none, call
                        # on_error(PATH*) callback

    Use case #2: like `file -r` (if it had a recursive option)
      {files=True, dirs='if-not-recursive', recursive=(if '-r' in opts)}
        script FILE     # yield FILE, else call on_error(FILE)
        script DIR      # yield DIR, else call on_error(DIR)
        script PATH*    # yield all files and dirs matching PATH*; if none,
                        # call on_error(PATH*) callback
        script -r DIR   # yield files (not dirs) recursively under DIR
        script -r PATH* # yield files matching PATH* and files recursively
                        # under dirs matching PATH*; if none, call
                        # on_error(PATH*) callback

    Use case #3: kind of like `find .`
      {files=True, dirs='always', recursive=(if '-r' in opts)}
        script FILE     # yield FILE, else call on_error(FILE)
        script DIR      # yield DIR, else call on_error(DIR)
        script PATH*    # yield all files and dirs matching PATH*; if none,
                        # call on_error(PATH*) callback
        script -r DIR   # yield files and dirs recursively under DIR
                        # (including DIR)
        script -r PATH* # yield files and dirs matching PATH* and recursively
                        # under dirs; if none, call on_error(PATH*)
                        # callback

    TODO: perf improvements (profile, stat just once)
    """
    from os.path import basename, exists, isdir, join, normpath, abspath, \
                        lexists, islink, realpath
    from glob import glob

    assert not isinstance(path_patterns, basestring), \
        "'path_patterns' must be a sequence, not a string: %r" % path_patterns
    GLOB_CHARS = '*?['

    if skip_dupe_dirs:
        searched_dirs = set()

    for path_pattern in path_patterns:
        # Determine the set of paths matching this path_pattern.
        for glob_char in GLOB_CHARS:
            if glob_char in path_pattern:
                paths = glob(path_pattern)
                break
        else:
            if follow_symlinks:
                paths = exists(path_pattern) and [path_pattern] or []
            else:
                paths = lexists(path_pattern) and [path_pattern] or []
        if not paths:
            if on_error is None:
                pass
            elif on_error is _NOT_SPECIFIED:
                try:
                    log.error("`%s': No such file or directory", path_pattern)
                except (NameError, AttributeError):
                    pass
            else:
                on_error(path_pattern)

        for path in paths:
            if (follow_symlinks or not islink(path)) and isdir(path):
                if skip_dupe_dirs:
                    canon_path = normpath(abspath(path))
                    if follow_symlinks:
                        canon_path = realpath(canon_path)
                    if canon_path in searched_dirs:
                        continue
                    else:
                        searched_dirs.add(canon_path)

                # 'includes' SHOULD affect whether a dir is yielded.
                if (dirs == "always"
                    or (dirs == "if-not-recursive" and not recursive)
                   ) and _should_include_path(path, includes, excludes):
                    yield path

                # However, if recursive, 'includes' should NOT affect
                # whether a dir is recursed into. Otherwise you could
                # not:
                #   script -r --include="*.py" DIR
                if recursive and _should_include_path(path, [], excludes):
                    for dirpath, dirnames, filenames in _walk(path, 
                            follow_symlinks=follow_symlinks):
                        dir_indeces_to_remove = []
                        for i, dirname in enumerate(dirnames):
                            d = join(dirpath, dirname)
                            if skip_dupe_dirs:
                                canon_d = normpath(abspath(d))
                                if follow_symlinks:
                                    canon_d = realpath(canon_d)
                                if canon_d in searched_dirs:
                                    dir_indeces_to_remove.append(i)
                                    continue
                                else:
                                    searched_dirs.add(canon_d)
                            if dirs == "always" \
                               and _should_include_path(d, includes, excludes):
                                yield d
                            if not _should_include_path(d, [], excludes):
                                dir_indeces_to_remove.append(i)
                        for i in reversed(dir_indeces_to_remove):
                            del dirnames[i]
                        if files:
                            for filename in sorted(filenames):
                                f = join(dirpath, filename)
                                if _should_include_path(f, includes, excludes):
                                    yield f

            elif files and _should_include_path(path, includes, excludes):
                yield path



#---- mainline

# Recipe: pretty_logging (0.1) in C:\trentm\tm\recipes\cookbook
class _PerLevelFormatter(logging.Formatter):
    """Allow multiple format string -- depending on the log level.
    
    A "fmtFromLevel" optional arg is added to the constructor. It can be
    a dictionary mapping a log record level to a format string. The
    usual "fmt" argument acts as the default.
    """
    def __init__(self, fmt=None, datefmt=None, fmtFromLevel=None):
        logging.Formatter.__init__(self, fmt, datefmt)
        if fmtFromLevel is None:
            self.fmtFromLevel = {}
        else:
            self.fmtFromLevel = fmtFromLevel
    def format(self, record):
        record.levelname = record.levelname.lower()
        if record.levelno in self.fmtFromLevel:
            #XXX This is a non-threadsafe HACK. Really the base Formatter
            #    class should provide a hook accessor for the _fmt
            #    attribute. *Could* add a lock guard here (overkill?).
            _saved_fmt = self._fmt
            self._fmt = self.fmtFromLevel[record.levelno]
            try:
                return logging.Formatter.format(self, record)
            finally:
                self._fmt = _saved_fmt
        else:
            return logging.Formatter.format(self, record)

def _setup_logging():
    hdlr = logging.StreamHandler()
    defaultFmt = "%(name)s: %(levelname)s: %(message)s"
    infoFmt = "%(name)s: %(message)s"
    fmtr = _PerLevelFormatter(fmt=defaultFmt,
                              fmtFromLevel={logging.INFO: infoFmt})
    hdlr.setFormatter(fmtr)
    logging.root.addHandler(hdlr)
    log.setLevel(logging.INFO)


def main(argv):
    usage = "usage: %prog"
    version = "%prog "+__version__
    parser = optparse.OptionParser(usage=usage, version=version,
                                   description=__doc__)
    parser.add_option("-v", "--verbose", dest="log_level",
                      action="store_const", const=logging.DEBUG,
                      help="more verbose output")
    parser.add_option("-q", "--quiet", dest="log_level",
                      action="store_const", const=logging.WARNING,
                      help="quieter output")
    parser.set_defaults(log_level=logging.INFO)
    opts, args = parser.parse_args()
    log.setLevel(opts.log_level)

    for dir in args:
        for path in lsnonuniversal(dir):
            print path


if __name__ == "__main__":
    if sys.version_info[:2] <= (2,2): __file__ = sys.argv[0]
    _setup_logging()
    try:
        retval = main(sys.argv)
    except SystemExit:
        pass
    except KeyboardInterrupt:
        sys.exit(1)
    except:
        exc_info = sys.exc_info()
        if log.isEnabledFor(logging.DEBUG):
            print
            traceback.print_exception(*exc_info)
        else:
            if hasattr(exc_info[0], "__name__"):
                #log.error("%s: %s", exc_info[0].__name__, exc_info[1])
                log.error(exc_info[1])
            else:  # string exception
                log.error(exc_info[0])
        sys.exit(1)
    else:
        sys.exit(retval)


