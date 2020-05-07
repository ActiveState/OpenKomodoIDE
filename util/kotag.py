#!/usr/bin/env python
# Copyright (c) 2006-2008 ActiveState Software Inc.

"""Tag a Komodo release.

Example usage:
  kotag svn.as.com 4.3.0   # tag the current svn.as.com komodo trunk '4.3.0'
  kotag svn.ok.com 4.3.0   # tag the current svn.ok.com openkomodo trunk '4.3.0'

This will do the following:

1. create the tag from the trunk in:

    $APPROPRIATE_KOMODO_REPO_BASE/tags/$VERSION/

2. updates the svn:externals definition for contrib/komododoc to properly
   lock it at a revision
"""

__version_info__ = (1, 0, 0)
__version__ = '.'.join(map(str, __version_info__))

import os
from os.path import exists, join, basename, expanduser, splitext
from urlparse import urljoin
import sys
import re
from pprint import pprint
from glob import glob
import traceback
import logging
import optparse
import tempfile
import shutil



#---- exceptions

class Error(Exception):
    pass



#---- globals

log = logging.getLogger("kotag")

g_repo_base_from_nickname = {
    "svn.ok.com": "https://svn.openkomodo.com/repos/openkomodo/",
    "svn.as.com": "https://svn.activestate.com/repos/activestate/komodo/",
}



#---- main public API

def kotag(repo_nickname, tag, dry_run=False):
    log.debug("kotag(%r, %r, dry_run=%r)", repo_nickname, tag, dry_run)
    dry_run_str = dry_run and " (dry-run)" or ""

    repo_base = g_repo_base_from_nickname[repo_nickname]
    proj_name = basename(repo_base[:-1])

    # If the tag looks like a version, validate it against "src/version.txt".
    if _is_int(tag[0]):
        version_txt_url = urljoin(repo_base, "trunk/src/version.txt")
        version_txt = _capture_output("svn cat %s" % version_txt_url).strip()
        short_ver = _join_short_ver(_split_full_ver(version_txt), pad_zeros=3)
        if tag != short_ver:
            raise Error("your tag, %s, looks like a version (it starts with "
                        "a number) but it doesn't match the current version "
                        "in the Komodo tree (%s): %s" 
                        % (tag, version_txt_url, short_ver))

    # Validate with the user.
    answer = _query_yes_no("Are you sure you want to create a '%s' "
                           "Komodo tag in %s?" % (tag, repo_nickname))
    if answer != "yes":
        return False

    # Create the tag.
    assert ' ' not in tag and ' ' not in repo_base
    trunk_url = urljoin(repo_base, "trunk/")
    tag_url = urljoin(repo_base, "tags/%s/" % tag)
    cmd = 'svn cp -m "kotag: create %s komodo tag" %s %s' % (tag, trunk_url, tag_url)
    log.debug("%s%s" % (cmd, dry_run_str))
    if not dry_run:
        _run(cmd)

    # Working copy of contrib area in temp dir.
    komododoc_url = "http://svn.openkomodo.com/repos/komododoc/trunk/"
    komododoc_rev = _svn_rev_from_url(komododoc_url)
    log.info("freeze 'komododoc' external revision to r%s" % komododoc_rev)
    if not dry_run:
        tmp_dir = _create_tmp_dir()
        try:
            # Create the temporary working copy.
            contrib_url = urljoin(tag_url, "contrib/")
            nul_file = (sys.platform == "win32" and "nul" or "/dev/null")
            _run_in_dir("svn co --ignore-externals %s >%s" 
                            % (contrib_url, nul_file),
                        tmp_dir)

            # Get the current contrib svn:externals.
            contrib_dir = join(tmp_dir, "contrib")
            externals = [line.strip() for line in 
                _capture_output('svn pg svn:externals "%s"' % contrib_dir).splitlines(0)
                if line.strip()]

            # Make our svn:externals update.
            for i, external in enumerate(externals):
                external_bits = external.split()
                if external_bits[0] == "komododoc":
                    assert external_bits == ["komododoc", komododoc_url]
                    externals[i] = external.replace(
                        komododoc_url, 
                        "-r %s %s" % (komododoc_rev, komododoc_url))

            # Update and commit svn:externals.
            tmp_file = tempfile.mktemp(dir=tmp_dir)
            f = open(tmp_file, 'w')
            f.write('\n'.join(externals) + '\n')
            f.close()
            cmds = [
                'svn ps -F "%s" svn:externals "%s"' % (tmp_file, contrib_dir),
                'svn ci -m "kotag: lock contrib/komododoc external to r%s" -N "%s"'
                    % (komododoc_rev, contrib_dir),
            ]
            for cmd in cmds:
                _run(cmd)
        finally:
            shutil.rmtree(tmp_dir)





#---- internal support functions

def _svn_rev_from_url(url):
    content = _capture_output("svn info %s" % url)
    for line in content.splitlines(0):
        if line.startswith("Revision"):
            revision = int(line.split(':', 1)[1].strip())
            return revision
    raise Error("couldn't determine revision for `%s'" % url)

def _is_int(s):
    return re.match("^\d+$", s) is not None


# Recipe: run (0.7.1)
_RUN_DEFAULT_LOGSTREAM = ("RUN", "DEFAULT", "LOGSTREAM")
def __run_log(logstream, msg, *args, **kwargs):
    if logstream is None:
        pass
    elif logstream is _RUN_DEFAULT_LOGSTREAM:
        try:
            log
        except NameError:
            pass
        else:
            if hasattr(log, "debug"):
                log.debug(msg, *args, **kwargs)
    else:
        logstream(msg, *args, **kwargs)

def _run(cmd, logstream=_RUN_DEFAULT_LOGSTREAM, dry_run=False):
    """Run the given command.

        "cmd" is the command to run
        "logstream" is an optional logging stream on which to log the 
            command. If None, no logging is done. If unspecifed, this 
            looks for a Logger instance named 'log' and logs the command 
            on log.debug().

    Raises OSError is the command returns a non-zero exit status.
    """
    __run_log(logstream, "running '%s'", cmd)
    if dry_run:
        return
    fixed_cmd = cmd
    if sys.platform == "win32" and cmd.count('"') > 2:
        fixed_cmd = '"' + cmd + '"'
    retval = os.system(fixed_cmd)
    if hasattr(os, "WEXITSTATUS"):
        status = os.WEXITSTATUS(retval)
    else:
        status = retval
    if status:
        raise OSError(status, "error running '%s'" % cmd)

def _run_in_dir(cmd, cwd, logstream=_RUN_DEFAULT_LOGSTREAM, dry_run=False):
    """Run the given command in the given working directory.

        "cmd" is the command to run
        "cwd" is the directory in which the commmand is run.
        "logstream" is an optional logging stream on which to log the 
            command. If None, no logging is done. If unspecifed, this 
            looks for a Logger instance named 'log' and logs the command 
            on log.debug().

    Raises OSError is the command returns a non-zero exit status.
    """
    old_dir = os.getcwd()
    try:
        if not dry_run:
            os.chdir(cwd)
        __run_log(logstream, "running '%s' in '%s'", cmd, cwd)
        if dry_run:
            return
        _run(cmd, logstream=None)
    finally:
        if not dry_run:
            os.chdir(old_dir)

# Recipe: ver (1.0.1-)
def _split_full_ver(ver_str):
    """Split a full version string to component bits.

    >>> _split_full_ver('4.0.0-alpha3-12345')
    (4, 0, 0, 'a', 3, 12345)
    >>> _split_full_ver('4.1.0-beta-12345')
    (4, 1, 0, 'b', None, 12345)
    >>> _split_full_ver('4.1.0-12345')
    (4, 1, 0, None, None, 12345)
    >>> _split_full_ver('4.1-12345')
    (4, 1, 0, None, None, 12345)
    """
    def _isalpha(ch):
        return 'a' <= ch <= 'z' or 'A' <= ch <= 'Z'
    def _isdigit(ch):
        return '0' <= ch <= '9'
    def split_quality(s):
        for i in reversed(range(1, len(s)+1)):
            if not _isdigit(s[i-1]):
                break
        if i == len(s):
            quality, quality_num = s, None
        else:
            quality, quality_num = s[:i], int(s[i:])
        return quality[0], quality_num

    bits = []
    for i, undashed in enumerate(ver_str.split('-')):
        for undotted in undashed.split('.'):
            if len(bits) == 3:
                # This is the "quality" section: 2 bits
                if _isalpha(undotted[0]):
                    bits += list(split_quality(undotted))
                    continue
                else:
                    bits += [None, None]
            try:
                bits.append(int(undotted))
            except ValueError:
                bits.append(undotted)
        # After first undashed segment should have: (major, minor, patch)
        if i == 0:
            while len(bits) < 3:
                bits.append(0)
    return tuple(bits)

_short_ver_re = re.compile("(\d+)(\.\d+)*([a-z](\d+)?)?")
def _split_short_ver(ver_str, intify=False, pad_zeros=None):
    """Parse the given version into a tuple of "significant" parts.

    @param intify {bool} indicates if numeric parts should be converted
        to integers.
    @param pad_zeros {int} is a number of numeric parts before any
        "quality" letter (e.g. 'a' for alpha).
   
    >>> _split_short_ver("4.1.0")
    ('4', '1', '0')
    >>> _split_short_ver("1.3a2")
    ('1', '3', 'a', '2')
    >>> _split_short_ver("1.3a2", intify=True)
    (1, 3, 'a', 2)
    >>> _split_short_ver("1.3a2", intify=True, pad_zeros=3)
    (1, 3, 0, 'a', 2)
    >>> _split_short_ver("1.3", intify=True, pad_zeros=3)
    (1, 3, 0)
    >>> _split_short_ver("1", pad_zeros=3)
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
        if bit == '.':
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

def _join_short_ver(ver_tuple, pad_zeros=None):
    """Join the given version-tuple, inserting '.' as appropriate.

    @param pad_zeros {int} is a number of numeric parts before any
        "quality" letter (e.g. 'a' for alpha).
    
    >>> _join_short_ver( ('4', '1', '0') )
    '4.1.0'
    >>> _join_short_ver( ('1', '3', 'a', '2') )
    '1.3a2'
    >>> _join_short_ver(('1', '3', 'a', '2'), pad_zeros=3)
    '1.3.0a2'
    >>> _join_short_ver(('1', '3'), pad_zeros=3)
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


# Recipe: query_yes_no (1.0)
def _query_yes_no(question, default="yes"):
    """Ask a yes/no question via raw_input() and return their answer.
    
    "question" is a string that is presented to the user.
    "default" is the presumed answer if the user just hits <Enter>.
        It must be "yes" (the default), "no" or None (meaning
        an answer is required of the user).

    The "answer" return value is one of "yes" or "no".
    """
    valid = {"yes":"yes",   "y":"yes",  "ye":"yes",
             "no":"no",     "n":"no"}
    if default == None:
        prompt = " [y/n] "
    elif default == "yes":
        prompt = " [Y/n] "
    elif default == "no":
        prompt = " [y/N] "
    else:
        raise ValueError("invalid default answer: '%s'" % default)

    while 1:
        sys.stdout.write(question + prompt)
        choice = raw_input().lower()
        if default is not None and choice == '':
            return default
        elif choice in valid.keys():
            return valid[choice]
        else:
            sys.stdout.write("Please respond with 'yes' or 'no' "\
                             "(or 'y' or 'n').\n")

def _create_tmp_dir():
    """Create a temporary directory and return the path to it."""
    if hasattr(tempfile, "mkdtemp"): # use the newer mkdtemp is available
        path = tempfile.mkdtemp()
    else:
        path = tempfile.mktemp()
        os.makedirs(path)
    return path

def _capture_output(cmd):
    o = os.popen(cmd)
    output = o.read()
    retval = o.close()
    if retval:
        raise Error("error capturing output of `%s': %r" % (cmd, retval))
    return output



class _NoReflowFormatter(optparse.IndentedHelpFormatter):
    """An optparse formatter that does NOT reflow the description."""
    def format_description(self, description):
        return description or ""

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



#---- mainline

def main(argv):
    usage = "usage: %prog REPO TAGNAME ..."
    version = "%prog "+__version__
    parser = optparse.OptionParser(usage=usage,
        version=version, description=__doc__,
        formatter=_NoReflowFormatter())
    parser.add_option("-v", "--verbose", dest="log_level",
                      action="store_const", const=logging.DEBUG,
                      help="more verbose output")
    parser.add_option("-q", "--quiet", dest="log_level",
                      action="store_const", const=logging.WARNING,
                      help="quieter output")
    parser.add_option("-n", "--dry-run", action="store_true",
                      help="Don't upgrade, just describe what would be done")
    parser.set_defaults(log_level=logging.INFO, dry_run=False)
    opts, args = parser.parse_args()
    log.setLevel(opts.log_level)

    if len(args) != 2:
        log.error("incorrect number of arguments (see `kotag.py -h')")
        return 1

    repo_nickname, tag = args
    return kotag(repo_nickname, tag, dry_run=opts.dry_run)


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


