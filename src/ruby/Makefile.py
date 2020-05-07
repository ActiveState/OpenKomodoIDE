#!/usr/bin/env python

"""Makefile for building Rubies needed for Komodo's Ruby debugger bits."""

import os
from os.path import join, dirname, basename, isdir, isfile, abspath,\
                    splitext, exists, expanduser
import sys
from glob import glob
import logging
import shutil

sys.path.insert(0, join(dirname(dirname(dirname(abspath(__file__)))), "util"))
import which

from makelib import output, dep, default, MakeError, Target
from makelib.runner import main


#---- globals

log = logging.getLogger("make")

EXE = (sys.platform == "win32" and ".exe" or "")
LIB = (sys.platform == "win32" and ".lib" or ".a")
def STATIC_LIB_NAME(name):
    if sys.platform == "win32":
        return name+LIB
    else:
        return "lib"+name+LIB


########################### Configuration ################################
#XXX Should put this in config.py.
class Config:
    _packages_dir_cache = None

    @property
    def packages_dir(self):
        if self._packages_dir_cache is None:
            if sys.platform == "win32":
                packages_dir = r"\\crimper\apps\Komodo\support\ruby"
            else:
                candidates = ["/nfs/crimper/home/apps/Komodo",
                              "/mnt/crimper.home/apps/Komodo",
                              "/mnt/crimper/apps/Komodo",
                              "/mnt/crimper/home/apps/Komodo",
                              "/mnt/crimper/Komodo",
                              "/Volumes/crimper.activestate.com/Komodo"]
                for candidate in candidates:
                    if exists(candidate):
                        packages_dir = join(candidate, "support", "ruby")
                        break
                else:
                    curr_dir = dirname(__file__) or '.'
                    log.warn(r"""
Couldn't find a mount point for crimper.  You'll need to copy the
necessary source packages from '\\crimper\apps\Komodo\support\ruby' to
'%s/pkg_cache' manually. Running the following should do it:

    cd %s
    mkdir -p pkg_cache
    scp trentm@crimper:/home/apps/Komodo/support/ruby/*.gz pkg_cache
""" % (curr_dir, curr_dir))
                    packages_dir = 'pkg_cache'
            self._packages_dir_cache = packages_dir
        return self._packages_dir_cache

cfg = Config()
######################## End of Configuration ############################



#---- primary make targets

class all(Target):
    default = True
    def deps(self):
        yield "install_ruby184"

class distclean(Target):
    def deps(self):
        yield "distclean_ruby184"


#---- secondary and internal targets

class distclean_ruby184(Target):
    def make(self, maker, log):
        _rm("ruby-1.8.4")
        _rm("ruby-1.8.4.tar.gz")

class src_ruby184(Target):
    outputs = ["ruby-1.8.4/ruby.c"]
    def make(self, maker, log):
        package_file = "ruby-1.8.4.tar.gz"
        if not exists(package_file):
            _cp(join(cfg.packages_dir, package_file), package_file,
                log.info)
        _extract(package_file, log.info)
        self.patch(maker, log)

    def patch(self, maker, log):
        # c.f. http://blade.nagaokaut.ac.jp/cgi-bin/scat.rb/ruby/ruby-core/7139
        for patchfile in sorted(glob("patches/ruby-*.patch")):
            _run_in_dir("patch -p0 < %s" % abspath(patchfile),
                        "ruby-1.8.4", logstream=log.info)


class install_ruby184(Target):
    deps = ["ruby184"]

    def outputs(self):
        if sys.platform == "win32":
            raise NotImplementedError("install_ruby184 on "+sys.platform)
        inst_dir = expanduser("~/opt/ruby-1.8.4")
        yield inst_dir+"/bin/ruby"

    def make(self, maker, log):
        _run_in_dir("make install", "ruby-1.8.4", log.info)


class ruby184(Target):
    outputs = ["ruby-1.8.4/ruby"+EXE]
    deps = ["src_ruby184"]

    def make(self, maker, log):
        # c.f. http://blade.nagaokaut.ac.jp/cgi-bin/scat.rb/ruby/ruby-core/7139
        src_dir = "ruby-1.8.4"

        if sys.platform == "win32":
            raise "boom"

        if exists(join(src_dir, "Makefile")):
            _run_in_dir("make distclean", src_dir, log.info)

        configure_env = []
        configure_opts = [
            "--prefix=%s " % expanduser("~/opt/ruby-1.8.4"),
        ]
        if sys.platform.startswith("darwin"):
            configure_env = [
                'CC="cc -isysroot /Developer/SDKs/MacOSX10.4u.sdk"',
                'LD="ld -syslibroot /Developer/SDKs/MacOSX10.4u.sdk"',
            ]
            configure_opts.append("--enable-fat-binary=ppc,i386")

        _run_in_dir("%s ./configure %s"
                    % (' '.join(configure_env),
                       ' '.join(configure_opts)),
                    src_dir,
                    log.info)
        _run_in_dir("make", src_dir, log.info)





#---- internal support stuff


def _extract(package_file, logstream=log.debug):
    if package_file.endswith(".tar.gz"):
        method = "tar.gz"
    elif package_file.endswith(".tar.bz2"):
        method = "tar.bz2"
    else:
        raise MakeError("unknown compressed filetype: '%s'" % package_file)
    if method == "tar.gz":
        if sys.platform == "win32":
            _run("tar xzf %s" % package_file, logstream)
        else:
            _run("gunzip < %s | tar xf -" % package_file, logstream)
    elif method == "tar.bz2":
        if sys.platform == "win32":
            _run("tar xjf %s" % package_file, logstream)
        else:
            _run("bunzip2 < %s | tar xf -" % package_file, logstream)

def _rm(path, logstream=None):
    """My little lame cross-platform 'rm -rf'"""
    assert ' ' not in path,\
        "_rm: can't handle paths in spaces: '%s'" % path
    if sys.platform == "win32":
        path = path.replace("/", "\\")
        assert "*" not in path and "?" not in path,\
            "_rm on win32: can't yet handle wildcards: '%s'" % path
        if not exists(path):
            pass
        elif isdir(path):
            _run("rd /s/q %s" % path, logstream=logstream)
        else:
            if not os.access(path, os.W_OK):
                _run("attrib -R %s" % path, logstream=logstream)
            _run("del /q %s" % path, logstream=logstream)
    else:
        _run("rm -rf %s" % path, logstream=logstream)

def _mv(src, dest, logstream=None):
    """My little lame cross-platform 'mv'"""
    assert ' ' not in src and ' ' not in dest,\
        "_mv: can't handle paths in spaces: src=%r, dest=%r" % (src, dest)
    if sys.platform == "win32":
        _run("move %s %s" % (src, dest), logstream=logstream)
    else:
        _run("mv %s %s" % (src, dest), logstream=logstream)

def _cp(src, dest, logstream=None):
    """My little lame cross-platform 'cp'"""
    assert ' ' not in src and ' ' not in dest,\
        "_cp: can't handle paths in spaces: src=%r, dest=%r" % (src, dest)
    if sys.platform == "win32":
        src = src.replace("/", "\\")
        dest = dest.replace("/", "\\")
        if isdir(src):
            _run("xcopy /e/i/y/q %s %s" % (src, dest), logstream=logstream)
        else:
            _run("copy /y %s %s" % (src, dest), logstream=logstream)
    else:
        if isdir(src):
            _run("cp -R %s %s" % (src, dest), logstream=logstream)
        else:
            _run("cp %s %s" % (src, dest), logstream=logstream)



# Recipe: run (0.5.3) in C:\trentm\tm\recipes\cookbook
_RUN_DEFAULT_LOGSTREAM = ("RUN", "DEFAULT", "LOGSTREAM")
def __run_log(logstream, msg, *args, **kwargs):
    if not logstream:
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

def _run(cmd, logstream=_RUN_DEFAULT_LOGSTREAM):
    """Run the given command.

        "cmd" is the command to run
        "logstream" is an optional logging stream on which to log the 
            command. If None, no logging is done. If unspecifed, this 
            looks for a Logger instance named 'log' and logs the command 
            on log.debug().

    Raises OSError is the command returns a non-zero exit status.
    """
    __run_log(logstream, "running '%s'", cmd)
    retval = os.system(cmd)
    if hasattr(os, "WEXITSTATUS"):
        status = os.WEXITSTATUS(retval)
    else:
        status = retval
    if status:
        #TODO: add std OSError attributes or pick more approp. exception
        raise OSError("error running '%s': %r" % (cmd, status))

def _run_in_dir(cmd, cwd, logstream=_RUN_DEFAULT_LOGSTREAM):
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
        os.chdir(cwd)
        __run_log(logstream, "running '%s' in '%s'", cmd, cwd)
        _run(cmd, logstream=None)
    finally:
        os.chdir(old_dir)


#---- mainline

if __name__ == "__main__":
    if sys.platform == "win32":
        raise MakeError("this Makefile doesn't yet support Windows")
    main()

