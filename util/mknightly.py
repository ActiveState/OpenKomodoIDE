#!/usr/bin/env python
#
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
# 
# The contents of this file are subject to the Mozilla Public License
# Version 1.1 (the "License"); you may not use this file except in
# compliance with the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
# 
# Software distributed under the License is distributed on an "AS IS"
# basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
# License for the specific language governing rights and limitations
# under the License.
# 
# The Original Code is Komodo code.
# 
# The Initial Developer of the Original Code is ActiveState Software Inc.
# Portions created by ActiveState Software Inc are Copyright (C) 2000-2007
# ActiveState Software Inc. All Rights Reserved.
# 
# Contributor(s):
#   ActiveState Software Inc
# 
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
# 
# ***** END LICENSE BLOCK *****

r"""Make the latest Komodo build a nightly.

Being a "nightly" means that it shows up on the nightly channel of
the Komodo update service.

Yes the script name is "mk" and this just uploads stuff. Get over it.
By default this will grab the latest dev build of Komodo and plop
it properly into the nightly downloads staging area. There is a cron
job to move it from there to the live downloads.activestate.com.

Supported project names:
    komodoide
    komodoedit
"""

__version_info__ = (0, 2, 0)
__version__ = '.'.join(map(str, __version_info__))

    
import os
import sys
import re
from pprint import pprint
from glob import glob
import time
import traceback
import logging
import tempfile
import optparse
import datetime

import buildutils



#---- exceptions

class Error(Exception):
    pass



#---- globals

log = logging.getLogger("mknightly")
# log.setLevel(logging.DEBUG)

#TODO: get from or keep in sync with kopkglib.py
#      `KomodoReleasesGuru.nightly_base_dir_from_project`.
upload_base_dir_from_project = {
    "komodoedit": "komodo@mule.activestate.com:/data/komodo/builds/nightly-stage",
    "komodoide": "komodo@mule.activestate.com:/data/komodo/builds/nightly-stage",
}
pkg_pats_from_project = {
    "komodoedit": ["Komodo-Edit-*"],
    "komodoide": ["Komodo-IDE-*", "Komodo-*RemoteDebugging*"],
}

devbuilds_base_dir_from_project = {
    "komodoide": "komodo@mule.activestate.com:/data/komodo/builds",
    "komodoedit": "komodo@mule.activestate.com:/data/komodo/builds",
}
scc_repo_name_from_project = {
    "komodoide": "assvn",  # ActiveState SVN
    "komodoedit": "oksvn", # svn.openkomodo.com
}



#---- module API

def trim_old_nightlies(project, upload_base_dir=None, dry_run=True):
    """Trim old nightly builds in the upload area.
    
    Deletes anything from two months or more ago.    
    """
    if upload_base_dir is None:
        upload_base_dir = upload_base_dir_from_project[project]
    log.debug("trim_old_nightlies(%r, upload_base_dir=%r, dry_run=%r)",
              project, upload_base_dir, dry_run)
    assert buildutils.is_remote_path(upload_base_dir)
    
    today = datetime.date.today()
    last_month = subtract_one_month(today)
    keeper_year_months = [
        (today.year, today.month),
        (last_month.year, last_month.month),
    ]
    
    existing_month_dirs = buildutils.remote_glob(
        "%s/%s/????/??" % (upload_base_dir, project))
    for d in existing_month_dirs:
        year_month = tuple(map(int, d[-len("????/??"):].split('/')))
        if year_month not in keeper_year_months:
            if dry_run:
                log.info("rm -rf %s  # old nightly dir (dry-run)", d)
            else:
                buildutils.remote_rm_recursive(d, log=log.info)

def generate_local_md5(project, branch="trunk", ver=None, build_num=None):
    """Make the latest Komodo IDE/Edit devbuild a nightly.

    @param project {str} is the name for the project for which to
        make a nightly.
    @param branch {str} is the source tree branch whose builds to use
        (is "trunk" be default).
    @param ver {str} is a short-form Komodo version to consider (e.g.,
        "4.4.0b1". This determines from which version-dir on the file
        share devbuilds are sought. Default is the latest such version-dir
        on the file share.
    """
    from posixpath import join, basename, dirname
    norm_branch = norm_branch_from_branch(branch)

    # Get the source packages dir.
    devbuilds_dir = _get_devbuilds_dir(project, norm_branch, ver=ver, build_num=build_num)
    log.info("generate_local_md5 %s", devbuilds_dir)

    # MD5SUMs info file in the 'updates' subdir.
    _mk_mar_md5sums(join(devbuilds_dir, "updates"))

def mknightly(project, branch="trunk", ver=None, upload_base_dir=None,
              dry_run=True, can_link=False, build_num=None):
    """Make the latest Komodo IDE/Edit devbuild a nightly.
    
    @param project {str} is the name for the project for which to
        make a nightly.
    @param branch {str} is the source tree branch whose builds to use
        (is "trunk" be default).
    @param ver {str} is a short-form Komodo version to consider (e.g.,
        "4.4.0b1". This determines from which version-dir on the file
        share devbuilds are sought. Default is the latest such version-dir
        on the file share.
    @param upload_base_dir {str} an override for the default hardcoded
        base dir for the given project name.
    @param dry_run {boolean} can be used to just go through the motions.
    @param can_link {boolean} indicates if hard-linking files is allowed
        if the devbuilds dir and downloads dir are on the same server.
    """
    from posixpath import join, basename, dirname
    norm_branch = norm_branch_from_branch(branch)
    
    if upload_base_dir is None:
        upload_base_dir = upload_base_dir_from_project[project]
    log.debug("mknightly(%r, upload_base_dir=%r, dry_run=%r)",
              project, upload_base_dir, dry_run)
    assert buildutils.is_remote_path(upload_base_dir)

    # Get the source packages dir.
    devbuilds_dir = _get_devbuilds_dir(project, norm_branch, ver=ver, build_num=build_num)
    log.info("\nmknightly source: %s\n dest: %s", devbuilds_dir, upload_base_dir)

    # Sanity guard: the project dir on the upload site must exist
    # already.
    upload_base_dir = join(upload_base_dir, project)
    if not buildutils.remote_exists(upload_base_dir):
        raise Error("`%s' does not exist: as a sanity check you must "
                    "make the project dir manually" % upload_base_dir)
    # Sanity guard: if the current "latest", if any, is the same build
    # id as the current one, then don't bother.
    # Unless a build number has been passed in.  Then just do what you're told.
    if build_num is None:
        latest_dir = join(upload_base_dir, "latest-" + norm_branch)
        komodo_pkg_re = re.compile("([\w-]+)-(\d+\.\d+\.\d+(-\w+\d)?-\d+).*")
        for p in buildutils.remote_glob(join(latest_dir, "Komodo-*.*")):
            m = komodo_pkg_re.match(basename(p))
            if p and m:
                latest_ver_str = m.group(2)
                latest_ver_info = _split_full_ver(latest_ver_str)
                
                for p in buildutils.remote_glob(join(devbuilds_dir, "Komodo-*.*")):
                    m = komodo_pkg_re.match(basename(p))
                    if p and m:
                        new_ver_str = m.group(2)
                        new_ver_info = _split_full_ver(new_ver_str)
                        if latest_ver_info == new_ver_info:
                            log.info("latest nightly is already the latest: "
                                     "%s (skipping)", latest_ver_str)
                            return
                        break
                else:
                    raise Error("couldn't determine new ver: `%s'" % devbuilds_dir)
                break

    # Figure out what serial number to use (to avoid collisions
    # for multiple builds for same day).
    year, month, day = time.localtime()[:3]
    upload_dir_pat = join(upload_base_dir, str(year), "%02d" % month,
        "%04d-%02d-%02d-*-%s" % (year, month, day, norm_branch))
    used_serials = []
    for d in buildutils.remote_glob(upload_dir_pat):
        try:
            used_serials.append(int(basename(d).split('-')[3]))
        except ValueError:
            pass
    used_serials.sort()
    if not used_serials:
        serial = 0
    else:
        serial = used_serials[-1] + 1
    if serial > 99:
        raise Error("too many nightly builds for today: serial=%r"
                    % serial)
    
    # Do the upload.
    upload_dir = join(upload_base_dir, str(year), "%02d" % month,
        "%04d-%02d-%02d-%02d-%s" % (year, month, day, serial, norm_branch))
    excludes = ["internal"]
    includes = pkg_pats_from_project[project]
    _upload(devbuilds_dir, upload_dir,
            includes=includes, excludes=excludes,
            dry_run=dry_run, can_link=can_link)
    
    # MD5SUMs info file in the 'updates' subdir.
    _mk_mar_md5sums(join(upload_dir, "updates"))
    
    # Symlinks.
    # latest-$norm_branch -> $upload_dir
    dst = join(upload_base_dir, "latest-" + norm_branch)
    if not dry_run and buildutils.remote_exists(dst):
        buildutils.remote_rm(dst, log=log.debug)
    src_relpath = buildutils.remote_relpath(upload_dir, dirname(dst))
    log.info("ln -s %s %s", src_relpath, dst)
    if not dry_run:
        buildutils.remote_symlink(src_relpath, dst, log.debug)

    # Make generic shortcuts (symlinks) to the installers.
    link_rdir = join(upload_dir, "link")
    if not dry_run:
        buildutils.remote_mkdir(link_rdir)
    dnames, fnames = buildutils.remote_listdir(upload_dir)
    installer_names = []
    link_names = []
    for fname in fnames:
        short_name = "-".join(fname.split("-", 3)[:2])
        if fname.endswith(".tar.gz"):
            # Linux
            if "x86_64" in fname:
                dstname = short_name + "-linux-x86_64.tar.gz"
            else:
                dstname = short_name + "-linux-x86.tar.gz"
        elif fname.endswith(".msi"):
            dstname = short_name + "-windows.msi"
        elif fname.endswith(".dmg"):
            dstname = short_name + "-macosx.dmg"
        else:
            continue
        installer_names.append(fname)
        link_names.append(dstname)
        src = join("..", fname)
        dst_symlink = join(link_rdir, dstname)
        log.info("ln -s %s %s", src, dst_symlink)
        if not dry_run:
            buildutils.remote_symlink(src, dst_symlink)
    # Generate SHA1SUM files.
    if installer_names:
        login, installer_dir = upload_dir.split(":", 1)
        log.info("cd %s && sha1sum %s > SHA1SUM", installer_dir, " ".join(installer_names))
        if not dry_run:
            buildutils.remote_run(login, "cd %s && sha1sum %s > SHA1SUM" % (installer_dir, " ".join(installer_names)))
    if link_names:
        login, link_dir = link_rdir.split(":", 1)
        log.info("cd %s && sha1sum %s > SHA1SUM", link_dir, " ".join(link_names))
        if not dry_run:
            buildutils.remote_run(login, "cd %s && sha1sum %s > SHA1SUM" % (link_dir, " ".join(link_names)))

    # latest -> $upload_dir
    # ... but only for official releases
    if norm_branch != "trunk":
        dst = join(upload_base_dir, "latest")
        if not dry_run and buildutils.remote_exists(dst):
            buildutils.remote_rm(dst, log=log.debug)
        log.info("ln -s %s %s", src_relpath, dst)
        if not dry_run:
            buildutils.remote_symlink(src_relpath, dst, log.debug)

#---- internal support stuff

## {{{ http://code.activestate.com/recipes/577274/ (r1)
def add_one_month(t):
    """Return a `datetime.date` or `datetime.datetime` (as given) that is
    one month earlier.
    
    Note that the resultant day of the month might change if the following
    month has fewer days:
    
        >>> add_one_month(datetime.date(2010, 1, 31))
        datetime.date(2010, 2, 28)
    """
    import datetime
    one_day = datetime.timedelta(days=1)
    one_month_later = t + one_day
    while one_month_later.month == t.month:  # advance to start of next month
        one_month_later += one_day
    target_month = one_month_later.month
    while one_month_later.day < t.day:  # advance to appropriate day
        one_month_later += one_day
        if one_month_later.month != target_month:  # gone too far
            one_month_later -= one_day
            break
    return one_month_later

def subtract_one_month(t):
    """Return a `datetime.date` or `datetime.datetime` (as given) that is
    one month later.
    
    Note that the resultant day of the month might change if the following
    month has fewer days:
    
        >>> subtract_one_month(datetime.date(2010, 3, 31))
        datetime.date(2010, 2, 28)
    """
    import datetime
    one_day = datetime.timedelta(days=1)
    one_month_earlier = t - one_day
    while one_month_earlier.month == t.month or one_month_earlier.day > t.day:
        one_month_earlier -= one_day
    return one_month_earlier
## end of http://code.activestate.com/recipes/577274/ }}}


def _mk_mar_md5sums(rdir):
    """Create a (slightly non-standard) MD5SUMs file in the given
    dir. The format of the file is:
    
        <md5sum> <size> <filename>
    
    One line for each .mar file in that dir. This file is used by the
    "nightly" channel of the update server to be able to get size and md5
    info without resorting the ssh (just HTTP).
    """
    from posixpath import join, basename

    if not buildutils.remote_exists(rdir):
        return
    
    path = join(rdir, "MD5SUMs")
    log.info("create %s", path)
    
    info = []
    for rpath in buildutils.remote_glob(join(rdir, "*.mar"), log.debug):
        size = buildutils.remote_size(rpath, log.debug)
        md5sum = buildutils.remote_md5sum(rpath, log.debug)
        info.append((md5sum, size, basename(rpath)))
    
    tmppath = tempfile.mktemp()
    f = open(tmppath, 'w')
    f.write('\n'.join("%s %s %s" % i for i in info) + '\n')
    f.close()
    buildutils.remote_cp(tmppath, path)
    os.remove(tmppath)

def _upload(src_dir, dst_dir, includes=None, excludes=[],
            dry_run=False, can_link=False):
    from posixpath import join, normpath, dirname
    from fnmatch import fnmatch
    
    log.debug("upload %s %s", src_dir, dst_dir)
    if not dry_run and not buildutils.remote_exists(dst_dir, log.debug):
        buildutils.remote_makedirs(dst_dir, log.debug)

    for dirpath, dnames, fnames in buildutils.remote_walk(src_dir):
        rel_rdir = buildutils.remote_relpath(dirpath, src_dir)
        reldir = rel_rdir.split(':', 1)[1]

        for dname in dnames[:]:
            matches = [x for x in excludes if fnmatch(dname, x)]
            if matches:
                log.debug("skipping `%s' (matches exclusion pattern)", dname)
                dnames.remove(dname)
            
        for fname in fnames:
            if includes:
                for include in includes:
                    if fnmatch(fname, include):
                        break
                else:
                    log.debug("skipping `%s' (doesn't match any includes)", fname)
                    continue
            matches = [x for x in excludes if fnmatch(fname, x)]
            if matches:
                log.debug("skipping `%s' (matches exclusion pattern)", fname)
                continue
            src = join(dirpath, fname)
            dst = normpath(join(dst_dir, reldir, fname))
            log.debug("cp %s %s", src, dst)
            if not dry_run:
                if not buildutils.remote_exists(dirname(dst), log.debug):
                    buildutils.remote_makedirs(dirname(dst), log.debug)
                buildutils.remote_cp(src, dst, log.debug,
                                     hard_link_if_can=can_link)

def _get_devbuilds_dir(project, norm_branch, ver=None, build_num=None):
    from posixpath import join, basename
    
    base_dir = devbuilds_base_dir_from_project[project]

    # Find the appropriate version dir.
    if ver:
        ver_dir = join(base_dir, ver)
        assert buildutils.remote_exists(ver_dir), \
            "'%s' does not exist" % ver_dir
    else:
        vers = []
        for d in buildutils.remote_glob(join(base_dir, "*"), log=log.debug):
            try:
                vers.append((_split_short_ver(basename(d), intify=True,
                                              sortable=True),
                             d))
            except ValueError:
                pass
        assert vers, "no devbuilds in '%s'" % base_dir
        vers.sort()
        ver_dir = vers[-1][1]

    # Find the appropriate build dir.
    # Individual build dirs are of the form: SCCNAME-BRANCH-BUILDNUM
    scc_repo_name = scc_repo_name_from_project[project]
    if build_num:
        build_dir = join(ver_dir, "DevBuilds",
                         "%s-%s-%s-nightly" % (scc_repo_name, norm_branch, build_num))
        assert buildutils.remote_exists(ver_dir), \
            "'%s' does not exist" % ver_dir
    else:
        builds = []
        pat = join(ver_dir, "DevBuilds", "%s-%s-*" % (scc_repo_name, norm_branch))
        for d in buildutils.remote_glob(pat):
            log.debug("XXX basename: %r", basename(d))
            try:
                build_num = int(basename(d).split('-')[2])
            except ValueError:
                pass
            else:
                builds.append( (build_num, d) )
        assert builds, "no devbuilds matching '%s'" % pat
        builds.sort()
        build_dir = builds[-1][1]
    return build_dir


def norm_branch_from_branch(branch):
    # Should match the logic for `bklocal.py::NormSCCBranch`.
    return re.sub(r'[^\w\.]', '_', branch).lower()

def _intify(s):
    try:
        return int(s)
    except ValueError:
        return s
    
# Recipe: ver (1.0.1+)
def _split_full_ver(ver_str):
    """Split a full version string to component bits.

    >>> _split_full_ver('4.0.0-alpha3-12345')
    (4, 0, 0, 'alpha', 3, 12345)
    >>> _split_full_ver('4.1.0-beta-12345')
    (4, 1, 0, 'beta', None, 12345)
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
        return quality, quality_num

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
def _split_short_ver(ver_str, intify=False, pad_zeros=None,
                     sortable=False):
    """Parse the given version into a tuple of "significant" parts.

    @param intify {bool} indicates if numeric parts should be converted
        to integers.
    @param pad_zeros {int} is a number of numeric parts before any
        "quality" letter (e.g. 'a' for alpha).
    @param sortable {bool} indicates that the "quality" bit should be
        set to 'f' for a final build (i.e. one that doesn't include a
        quality letter). This is useful for sorting a list of split
        short vers *if and only if* 'a', 'b' or 'c' are the only quality
        monikers used. Default false.

        Note for "ver" recipe: Don't include this. A better solution is
        a "VersionInfo" class that deals with the sorting more naturally.
   
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
    >>> _split_short_ver("1", intify=3, sortable=True)
    (1, 0, 0, 'f')
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
    if sortable and not hit_quality_bit:
        bits.append('f')
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


class _NoReflowFormatter(optparse.IndentedHelpFormatter):
    """An optparse formatter that does NOT reflow the description."""
    def format_description(self, description):
        return description or ""

# Recipe: pretty_logging (0.1)
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
        record.lowerlevelname = record.levelname.lower()
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

def _setup_logging(stream=None):
    """Do logging setup:

    We want a prettier default format:
         do: level: ...
    Spacing. Lower case. Skip " level:" if INFO-level. 
    """
    hdlr = logging.StreamHandler(stream)
    defaultFmt = "%(name)s: %(levelname)s: %(message)s"
    infoFmt = "%(name)s: %(message)s"
    fmtr = _PerLevelFormatter(fmt=defaultFmt,
                              fmtFromLevel={logging.INFO: infoFmt})
    hdlr.setFormatter(fmtr)
    logging.root.addHandler(hdlr)
    log.setLevel(logging.INFO)

def checkBuildExists(project, branch, ver, build_num):
    from posixpath import join
    """Check the given path for Komodo installers.  This is only run if a explicit
    build number is passed in.  remote_glob returns an empty array if nothing found."""
    norm_branch = norm_branch_from_branch(branch)
    devbuilds_dir = _get_devbuilds_dir(project, norm_branch, ver=ver, build_num=build_num)
    if not buildutils.remote_glob(join(devbuilds_dir, "Komodo-*.*")):
        log.error("""There are no installers in %s.
You likely included the wrong number for the --edit-build or --ide-build option.
If the path is correct, check your internet connection or if you're on Windows,
confirm pageant is running and your key is added.""", devbuilds_dir)
        return False
    else:
        return True

#---- mainline

def main(argv):
    usage = "usage: %prog [OPTIONS...] [PROJECTS]"
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
                      help="do a dry-run")
    parser.add_option("-b", "--branch",
        help="Komodo source tree branch builds to use (default is 'trunk')")
    parser.add_option("-V", dest="ver",
        help="Komodo (short-form) version for which to get dev builds, e.g. "
             "5.0.0a1. By default the latest version for which there are "
             "dev builds is used.")
    parser.add_option("-l", "--local-md5", action="store_true",
        help="Generate local md5s, for internal updates")
    parser.add_option("-i", "--ide-build",
        help="Use specific IDE build number, eg. '89515' in installer called Komodo-IDE-10.1.4-89515.msi.")
    parser.add_option("-e", "--edit-build",
        help="Same idea as --ide-build above.  If you specified --ide-build, you don't necessarily have to specifiy --edit-build and vice versa")
    parser.set_defaults(log_level=logging.INFO, dry_run=False,
                        branch="trunk", ver=None,
                        edit_build=None, ide_build=None)
    opts, projects = parser.parse_args()
    log.setLevel(opts.log_level)
    if not projects:
        projects = ['komodoedit', 'komodoide']
        log.info("Defaulting projects to %r", projects)
    for project in projects:
        if project is "komodoedit":
            build_num = opts.edit_build
        else:
            build_num = opts.ide_build
        if not checkBuildExists(project, opts.branch, opts.ver, build_num):
                return
        if opts.local_md5:
            generate_local_md5(project, branch=opts.branch, ver=opts.ver, build_num=build_num)
        else:
            trim_old_nightlies(project, dry_run=opts.dry_run)
            mknightly(project,
                      branch=opts.branch,
                      ver=opts.ver,
                      dry_run=opts.dry_run,
                      build_num=build_num)


if __name__ == "__main__":
    _setup_logging()
    try:
        retval = main(sys.argv)
    except SystemExit:
        pass
    except KeyboardInterrupt:
        sys.exit(1)
    except:
        exc_info = sys.exc_info()
        if log.level <= logging.DEBUG:
            import traceback
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



