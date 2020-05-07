##############################################################################
#
# Copyright (c) 2004 Zope Corporation and Contributors.
# All Rights Reserved.
#
# This software is subject to the provisions of the Zope Public License,
# Version 2.1 (ZPL).  A copy of the ZPL should accompany this distribution.
# THIS SOFTWARE IS PROVIDED "AS IS" AND ANY AND ALL EXPRESS OR IMPLIED
# WARRANTIES ARE DISCLAIMED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
# WARRANTIES OF TITLE, MERCHANTABILITY, AGAINST INFRINGEMENT, AND FITNESS
# FOR A PARTICULAR PURPOSE.
#
##############################################################################
"""Generator for distutils setup.py files.

:Variables:
  - `EXCLUDE_NAMES`: Names of files and directories that will be
    excluded from copying.  These are generally related to source
    management systems, but don't need to be.

  - `EXCLUDE_PATTERNS`: Glob patterns used to filter the set of files
    that are copied.  Any file with a name matching these patterns
    will be ignored.

"""

import errno
import fnmatch
import os
import posixpath
import re
import sys

from distutils.cmd import Command

from zpkgsetup import package
from zpkgsetup import publication


# Names that are exluded from globbing results:
EXCLUDE_NAMES = ["{arch}", "CVS", ".cvsignore", "_darcs",
                 "RCS", "SCCS", ".svn"]
EXCLUDE_PATTERNS = ["*.py[cdo]", "*.s[ol]", ".#*", "*~"]

def filter_names(names):
    """Given a list of file names, return those names that should be copied.
    """
    names = [n for n in names
             if n not in EXCLUDE_NAMES]
    # This is needed when building a distro from a working
    # copy (likely a checkout) rather than a pristine export:
    for pattern in EXCLUDE_PATTERNS:
        names = [n for n in names
                 if not fnmatch.fnmatch(n, pattern)]
    return names


class SetupContext:
    """Object representing the arguments to distutils.core.setup()."""

    def __init__(self, pkgname, version, setup_file, distclass=None):
        self._working_dir = os.path.dirname(os.path.abspath(setup_file))
        self._pkgname = pkgname
        self._distclass = distclass or "zpkgsetup.dist.ZPkgDistribution"
        self.version = version
        self.packages = []
        self.package_data = {}
        self.package_dir = {}
        self.package_headers = []
        self.ext_modules = []
        self.scripts = []
        self.platforms = None
        self.classifiers = None
        self.data_files = []
        self.headers = []

    def initialize(self):
        metadata_file = os.path.join(self._working_dir, self._pkgname,
                                     publication.PUBLICATION_CONF)
        if os.path.isfile(metadata_file):
            self.load_metadata(metadata_file)
        pkgdir = os.path.join(self._working_dir, self._pkgname)
        self.scan(self._pkgname, pkgdir, self._pkgname)
        depsdir = os.path.join(self._working_dir, "Dependencies")
        if os.path.isdir(depsdir):
            depnames = os.listdir(depsdir)
            suffix = "-%s-%s" % (self._pkgname, self.version)
            for name in depnames:
                if not name.endswith(suffix):
                    # an unexpected name; we didn't put this here!
                    print >>sys.stderr, \
                          "unexpected name in Dependencies/: %r" % name
                    continue
                depdir = os.path.join(depsdir, name)
                if not os.path.isdir(depdir):
                    # a file; we didn't put this here either!
                    print >>sys.stderr, \
                          "unexpected file in Dependencies/: %r" % name
                    continue
                depname = name[:-len(suffix)]
                pkgdir = os.path.join(depdir, depname)
                reldir = posixpath.join("Dependencies", name, depname)
                self.scan(depname, pkgdir, reldir)

    def setup(self):
        kwargs = self.__dict__.copy()
        for name in self.__dict__:
            if name[0] == "_":
                del kwargs[name]
        from distutils.core import setup
        kwargs["distclass"] = self.get_distribution_class()
        ContextDisplay.kwargs = kwargs
        kwargs["cmdclass"] = {"debugdisplay": ContextDisplay}
        setup(**kwargs)

    def get_distribution_class(self):
        i = self._distclass.rfind(".")
        if i >= 0:
            modname = self._distclass[:i]
            clsname = self._distclass[i+1:]
            __import__(modname)
            return getattr(sys.modules[modname], clsname)
        raise ValueError("distribution class name must specify a module name")

    def load_metadata(self, path):
        f = open(path, "rU")
        publication.load(f, metadata=self)
        f.close()
        if self.platforms:
            self.platforms = ", ".join(self.platforms)
        if self.version:
            m = re.match(r"\d+\.\d+(\.\d+)?(?:(?P<status>[ab])\d*)?$",
                         self.version)
            if m is not None:
                devstatus = publication.STABLE
                status = m.group("status")
                if status == "a":
                    devstatus = publication.ALPHA
                elif status == "b":
                    devstatus = publication.BETA
                publication.set_development_status(self, devstatus)

    def walk_packages(self, root):
        """Walk over a package tree and load all available packages.

        Packages are identified by checking for both and __init__.py
        and a SETUP.cfg; if present, the package is scanned.  If there
        is no __init__.py, scanning ignores that subtree.

        `root` is the top of a package hierarchy, given as a relative
        path in POSIX notation.

        """
        #
        # walk_packages() doesn't pick up packages that don't have a
        # SETUP.cfg in them, so it's not everything we want.  However,
        # picking up C extensions in leaf packages gets us an in-place
        # build, which is a good start.
        #
        # To fix this, the zpkgsetup code needs to understand the
        # right way to detect package boundaries, which is currently
        # done implicitly by the distribution construction code.
        #
        parts = root.split("/")
        local_root = os.path.join(*parts)
        self.package_dir[""] = root
        if os.path.isfile(os.path.join(local_root, package.PACKAGE_CONF)):
            # There's a SETUP.cfg at the top level; load it:
            pkginfo = package.loadCollectionInfo(
                os.path.join(self._working_dir, local_root),
                root)
            self.scan_basic(pkginfo)
        prefix_len = len(os.path.join(local_root, ""))
        for root, dirs, files in os.walk(local_root):
            for d in dirs[:]:
                # drop sub-directories that are not Python packages:
                initfn = os.path.join(root, d, "__init__.py")
                if not os.path.isfile(initfn):
                    dirs.remove(d)
            if (package.PACKAGE_CONF in files
                and "__init__.py" in files):
                # scan this directory as a package:
                pkgname = root[prefix_len:].replace(os.path.sep, ".")
                local_full_path = os.path.join(self._working_dir, root)
                relative_path = root.replace(os.path.sep, "/")
                self.scan_package(pkgname, local_full_path, relative_path)

    def scan(self, name, directory, reldir):
        init_py = os.path.join(directory, "__init__.py")
        if os.path.isfile(init_py):
            self.scan_package(name, directory, reldir)
        else:
            self.scan_collection(name, directory, reldir)

    def scan_collection(self, name, directory, reldir):
        # load the collection metadata
        pkginfo = package.loadCollectionInfo(directory, reldir)
        self.scan_basic(pkginfo)

    def scan_package(self, name, directory, reldir):
        # load the package metadata
        pkginfo = package.loadPackageInfo(name, directory, reldir)
        self.scan_basic(pkginfo)
        self.add_package_dir(name, reldir)

        # scan the files in the directory:
        files = filter_names(os.listdir(directory))
        for fn in files:
            fnbase, ext = os.path.splitext(fn)
            path = os.path.join(directory, fn)
            if os.path.isdir(path):
                init_py = os.path.join(path, "__init__.py")
                if os.path.isfile(init_py):
                    # if this package is published separately, skip it:
                    # XXX we shouldn't actually need this if we only
                    # use this class to scan in the generated
                    # distributions
                    if os.path.isfile(
                        os.path.join(path, publication.PUBLICATION_CONF)):
                        continue
                    pkgname = "%s.%s" % (name, fn)
                    self.scan_package(
                        pkgname, path, posixpath.join(reldir, fn))
                else:
                    # an ordinary directory
                    self.scan_directory(name, path, fn)
            # Only add the file as package data if it's not a Python
            # source file; Python files are copied in automatically.
            elif not fn.endswith(".py"):
                self.add_package_file(name, fn)

        # We need to check that any files that were labelled as
        # scripts or application data aren't copied in as package
        # data; they shouldn't be installed into the package itself.
        #
        # XXX I'm not sure whether documentation files should be
        # removed from package_data or not, given that there's no spec
        # for installing documentation other than for RPMs.
        #
        relbase = posixpath.join(reldir, "")
        pkgfiles = self.package_data.get(name, [])
        non_pkgdata = pkginfo.script + pkginfo.header
        for dir, files in pkginfo.data_files:
            non_pkgdata.extend(files)
        for ext in pkginfo.extensions:
            for fn in ext.sources + getattr(ext, "depends", []):
                if fn not in non_pkgdata:
                    non_pkgdata.append(fn)
        for fn in non_pkgdata:
            pkgdatapath = fn[len(relbase):]
            if pkgdatapath in pkgfiles:
                pkgfiles.remove(pkgdatapath)

    def scan_directory(self, pkgname, directory, reldir):
        """Scan a data directory, adding files to package_data."""
        files = filter_names(os.listdir(directory))
        for fn in files:
            path = os.path.join(directory, fn)
            if os.path.isdir(path):
                self.scan_directory(pkgname,
                                    os.path.join(directory, fn),
                                    posixpath.join(reldir, fn))
            else:
                self.add_package_file(pkgname, posixpath.join(reldir, fn))

    def scan_basic(self, pkginfo):
        self.package_headers.extend(pkginfo.package_headers)
        self.scripts.extend(pkginfo.script)
        if pkginfo.data_files:
            if self.data_files:
                # merge:
                d = dict(self.data_files)
                for dir, files in pkginfo.data_files:
                    L = d.setdefault(dir, [])
                    L.extend(files)
                self.data_files = d.items()
            else:
                self.data_files = pkginfo.data_files
        for fn in pkginfo.header:
            if fn not in self.headers:
                self.headers.append(fn)
        self.ext_modules.extend(pkginfo.extensions)

    def add_package_dir(self, pkgname, reldir):
        self.packages.append(pkgname)
        if pkgname.replace(".", "/") != reldir:
            self.package_dir[pkgname] = reldir

    def add_package_file(self, pkgname, relfn):
        L = self.package_data.setdefault(pkgname, [])
        L.append(relfn)


class ContextDisplay(Command):
    """Command to display the information being passed to setup()."""

    # Note: The .kwargs attribute is set on this class by the setup()
    # method above; this is a really hackish way to get the kwargs
    # dict, but it works.

    description = "dump all packaging metadata used by distutils"

    user_options = []

    def initialize_options(self):
        pass

    def finalize_options(self):
        pass

    def run(self):
        import pprint
        try:
            pprint.pprint(self.kwargs)
        except IOError, e:
            if e.errno != errno.EPIPE:
                raise
