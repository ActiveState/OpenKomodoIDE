#!/usr/bin/env python
# Copyright (c) 2006-2007 ActiveState Software Inc.
# Contributors:
#   Trent Mick (TrentM@ActiveState.com)

"""Upgrade your Komodo installation(s).

Examples (of `koup.py` behaviour):
  koup ide                  # latest Komodo IDE nightly build
  koup ide nightly          # ditto, explicitly
  koup edit                 # ditto, for Komodo Edit
  koup ide nightly-4.3.x    # latest Komodo IDE nightly from '4.3.x' branch
  koup edit nightly-4.3.x   # latest Komodo Edit nightly from '4.3.x' branch
  koup ide 4.2.0            # released Komodo IDE 4.2.0
  koup edit 4.2.0b3         # released Komodo Edit 4.2.0b3
  koup ide 4.2.0 rc         # latest Komodo IDE 4.2.0 RC
  koup ide 4.2.0 rc1        # Komodo IDE 4.2.0 RC1
  koup ide 4.2.0 devbuild   # latest Komodo IDE 4.2.0 dev build
  koup ide 4.2.0 devbuild-1 # second to latest Komodo IDE 4.2.0 dev build
  koup ide 4.2.0 devbuild-N # N-builds before latest Komodo IDE 4.2.0 dev build
"""

__version_info__ = (0, 3, 0)
__version__ = '.'.join(map(str, __version_info__))

import os
from os.path import exists, join, basename, expanduser, splitext
from posixpath import basename as ubasename
from urlparse import urljoin
import urllib2
import sys
import re
from pprint import pprint
from glob import glob
import traceback
import logging
import optparse
import urllib
import socket
import urlparse
import tempfile
from fnmatch import fnmatch
if sys.platform == "win32":
    import _winreg
from xml.dom import minidom
from xml.parsers.expat import ExpatError

import platinfo



#---- exceptions

class Error(Exception):
    pass



#---- globals

log = logging.getLogger("koup")

g_pretty_product_from_product = {
    "komodoide":  "Komodo IDE",
    "komodoedit": "Komodo Edit",
}
g_pkg_prefix_from_product = {
    "komodoide":  "Komodo-IDE",
    "komodoedit": "Komodo-Edit",
}



#---- main public API

def koup(seeker, channel=None, dry_run=False):
    """Update to the latest available build of the given Komodo flavour
    (modulo to the scheme).
    
    TODO: desc
        "channel" (optional) if specified will edit channel-prefs.js appropriately
            post-install to switch that Komodo install to the given channel name.
    """
    log.debug("koup(%r, channel=%r, dry_run=%r)", seeker, channel, dry_run)
    dry_run_str = dry_run and " (dry-run)" or ""
    
    if seeker.url is None:
        log.info("no %s (%s): aborting", seeker, seeker.platname)
        return
    log.info("upgrading to %s%s", seeker, dry_run_str)
    log.debug("url: %s", seeker.url)
    
    # If there is a current installation, abort if it is already the
    # same one, else uninstall it.
    install_info = _is_komodo_installed(seeker.ver, seeker.product,
                                        seeker.pretty_product)
    if install_info:
        log.debug("install_info: %r", install_info)
        try:
            if not _is_wanted_komodo_different(seeker.ver_info, 
                    seeker.pretty_product, install_info):
                log.info("already have %s (no need to upgrade)", seeker)
                if channel is not None:
                    install_dir = _install_dir_from_install_info(install_info,
                        seeker)
                    _set_update_channel(install_dir, channel)
                return
        except Error, ex:
            preamble = """\
-------------
There was an error determining if your currently installed Komodo is
actually older than the %s %s.
Would you like to go ahead with the upgrade anyway?"""\
% (seeker, seeker.ver_info)
            answer = _query_user(preamble, "no", prompt="[yes|NO] ",
                                 validate="yes-or-no")
            normalized = {'y': 'yes', 'ye': 'yes', 'yes': 'yes',
                          'n': 'no',  'no': 'no'}
            answer = normalized[answer.lower()]
            if answer != "yes":
                log.info("aborting upgrade")
                return
        _uninstall_komodo(seeker.ver, seeker.pretty_product,
                          install_info, dry_run=dry_run)

    _install_komodo(seeker, install_info, dry_run=dry_run,
                    channel=channel)



#---- Komodo package seekers

#TODO:WARNING: @_memoized + @property == memory leak
class _memoized(object):
   """Decorator that caches a function's return value each time it is called.
   If called later with the same arguments, the cached value is returned, and
   not re-evaluated.

   http://wiki.python.org/moin/PythonDecoratorLibrary
   """
   def __init__(self, func):
      self.func = func
      self.cache = {}
   def __call__(self, *args):
      try:
         return self.cache[args]
      except KeyError:
         self.cache[args] = value = self.func(*args)
         return value
      except TypeError:
         # uncachable -- for instance, passing a list as an argument.
         # Better to not cache than to blow up entirely.
         return self.func(*args)
   def __repr__(self):
      """Return the function's docstring."""
      return self.func.__doc__

class PackageSeeker(object):
    """Knows how to find and get packages of a specific type."""
    def __init__(self, product):
        self.product = product
    @property
    def pretty_product(self):
       return g_pretty_product_from_product[self.product]
    @property
    @_memoized
    def platinfo(self):
        pi = platinfo.PlatInfo()
        if pi.os == "linux" and pi.arch == "x86_64":
            # x86_64 Linux must use 32-bit builds for now.
            pi.arch = "x86"
        return pi
    @property
    @_memoized
    def platname(self):
        return self.platinfo.name("os", "libcpp", "arch")
    def pkg_pat(self, ver_info=None):
        if ver_info:
            ver_pat = _long_ver_str_from_ver_info(ver_info) + "-*"
        else:
            ver_pat = "*"

        pkg_prefix = g_pkg_prefix_from_product[self.product]
        pi = self.platinfo
        if pi.os == "win32":
            return "%s-%s.msi" % (pkg_prefix, ver_pat)
        elif pi.os == "macosx":
            return "%s-%s-%s.dmg" % (pkg_prefix, ver_pat, self.platname)
        else:
            return "%s-%s-%s.tar.gz" % (pkg_prefix, ver_pat, self.platname)
    @property
    def pkg_ext(self):
        os = self.platinfo.os
        if os == "win32":
            return ".msi"
        elif os == "macosx":
            return ".dmg"
        else:
            return ".tar.gz"
    @property
    @_memoized
    def ver_info(self):
        pkg_prefix = g_pkg_prefix_from_product[self.product]
        v = ubasename(self.url)
        v = v[:-len(self.pkg_ext)]          # strip ext
        v = v[len(pkg_prefix)+1:]           # strip "Komodo-Edit-"
        if self.platinfo.os != "win32":
            v = v[:-(len(self.platname)+1)] # strip "-macosx-x86"
        return _split_full_ver(v)
    @property
    def ver(self):
        return '.'.join(str(i) for i in self.ver_info[:2])
    @property
    def version(self):
        return _long_ver_str_from_ver_info(self.ver_info)
    @property
    def buildnum(self):
        return self.ver_info[-1]

class KomodoReleasePackageSeeker(PackageSeeker):
    def __init__(self, product, version_cond):
        self.product = product
        self.version_cond = version_cond
        self.version_cond_info = _split_short_ver(version_cond, intify=True)
    def __str__(self):
        return "latest %s %s release" \
               % (self.pretty_product, self.version_cond)
    def __repr__(self):
        return "<%s %s release seeker>" % (self.product, self.version_cond)
    @property
    @_memoized
    def url(self):
        url_dir = "http://downloads.activestate.com/Komodo/releases/%s/" \
                  % self.version_cond
        pkg_pat = self.pkg_pat(self.version_cond_info)
        for name in _links_from_url(url_dir):
            if fnmatch(name, pkg_pat):
                return urljoin(url_dir, name)

class KomodoRCPackageSeeker(PackageSeeker):
    def __init__(self, product, version_cond, rc_num=None):
        self.product = product
        self.version_cond = version_cond
        self.rc_num = rc_num
        self.version_cond_info = _split_short_ver(version_cond, intify=True)
    def __str__(self):
        if self.rc_num:
            return "%s RC %s" % (self.pretty_product, self.rc_num)
        else:
            return "latest %s RC" % self.pretty_product
    def __repr__(self):
        return "<%s %s RC %s seeker>" \
               % (self.product, self.version_cond, self.rc_num)
    @property
    @_memoized
    def url(self):
        url_dir = "http://komodo.nas1.activestate.com/builds/%s/" % self.version_cond
        if self.rc_num:
            url_dir = urljoin(url_dir, "RC%d/" % self.rc_num)
        else:
            rc_nums_and_dirs = []
            for name in _links_from_url(url_dir):
                if re.match(r"^RC\d+/$", name):
                    rc_nums_and_dirs.append( (int(name[2:-1]),  name) )
            rc_nums_and_dirs.sort()
            if rc_nums_and_dirs:
                url_dir = urljoin(url_dir, rc_nums_and_dirs[-1][1])
            else:
                raise Error("no RC dir in `%s'" % url_dir)

        pkg_pat = self.pkg_pat(self.version_cond_info)
        for name in _links_from_url(url_dir):
            if fnmatch(name, pkg_pat):
                return urljoin(url_dir, name)

class KomodoDevbuildPackageSeeker(PackageSeeker):
    def __init__(self, product, version_cond, n_builds_back=0):
        self.product = product
        self.version_cond = version_cond
        self.version_cond_info = _split_short_ver(version_cond, intify=True)
        self.n_builds_back = n_builds_back
    def __repr__(self):
        return "<%s %s devbuild%s seeker>" % (
            self.product, self.version_cond, self.n_builds_back_str)
    def __str__(self):
        return "latest%s %s %s devbuild" % (
            self.n_builds_back_str, self.pretty_product, self.version_cond)
    @property
    def n_builds_back_str(self):
        return self.n_builds_back and (" (-%d)" % self.n_builds_back) or ""
    @property
    @_memoized
    def url(self):
        url_dir = "http://komodo.nas1.activestate.com/builds/%s/DevBuilds/" % self.version_cond

        build_dir_re = {
            "komodoedit": re.compile("^oksvn-[^-]+-(\d+)/$"),
            "komodoide": re.compile("^assvn-[^-]+-(\d+)/$"),
        }[self.product]
        build_nums_and_dirs = []
        for name in _links_from_url(url_dir):
            m = build_dir_re.match(name)
            if m:
                build_nums_and_dirs.append( (int(m.group(1)), name) )

        n = self.n_builds_back
        pkg_pat = self.pkg_pat(self.version_cond_info)
        for build_num, d in sorted(build_nums_and_dirs, reverse=True):
            build_dir = urljoin(url_dir, d)
            for name in _links_from_url(build_dir):
                if fnmatch(name, pkg_pat):
                    if n == 0:    
                        return urljoin(build_dir, name)
                    else:
                        log.debug("devbuild %d: %s", n-self.n_builds_back,
                                  urljoin(build_dir, name))
                        n -= 1
        else:
            raise Error("no devbuild%s matching `%s' found under `%s%s'"
                        % (self.n_builds_back, pkg_pat, url_dir,
                           build_dir_re.pattern))

class KomodoNightlyPackageSeeker(PackageSeeker):
    def __init__(self, product, branch="trunk"):
        self.product = product
        self.branch = branch
        self.norm_branch = re.sub(r'[^\w\.]', '_', branch).lower()
    def __str__(self):
        return "latest %s nightly" % self.pretty_product
    def __repr__(self):
        return "<%s nightly seeker>" % self.product

    @property
    def url_dir(self):
        return {
            "komodoedit": "http://downloads.activestate.com/Komodo/nightly/komodoedit/latest-%s/",
            "komodoide": "http://downloads.activestate.com/Komodo/nightly/komodoide/latest-%s/",
        }[self.product] % self.norm_branch

    @property
    @_memoized
    def url(self):
        pkg_pat = self.pkg_pat()
        for name in _links_from_url(self.url_dir):
            if fnmatch(name, pkg_pat):
                return urljoin(self.url_dir, name)


#---- internal support functions

_a_pat = re.compile(r'<a href="(.*?)">.*?</a>')
def _links_from_url(url):
    try:
        html = urllib2.urlopen(url).read()
    except urllib2.HTTPError, ex:
        if ex.code == 404:
            raise Error("`%s' not found (HTTP 404)" % url)
        raise
    except urllib2.URLError, ex:
        if ex.args and ex.args[0] and ex.args[0][0] == 7:
            # socket error: No address associated with nodename
            raise Error("can't resolve %s" % urlparse.urlparse(url)[1])
        raise
    links = set(href for href in _a_pat.findall(html))
    return links

def _capture_status(argv):
    import subprocess
    p = subprocess.Popen(argv,
                         stdout=subprocess.PIPE,
                         stderr=subprocess.STDOUT)
    output = p.stdout.read()
    retval = p.wait()
    return retval


# Recipe: query_user (0.2+) in /home/trentm/tm/recipes/cookbook
def _query_user(preamble, default=None, prompt="> ", validate=None):
    """Ask the user a question using raw_input() and looking something
    like this:

        <preamble>
        <prompt>
        ...validate...

    Arguments:
        "preamble" is a string to display before the user is prompted
            (i.e. this is the question).
        "default" (optional) is a default value.
        "prompt" (optional) is the prompt string.
        "validate" (optional) is either a string naming a stock validator:\

                notempty        Ensure the user's answer is not empty.
                                (This is the default.)
                yes-or-no       Ensure the user's answer is 'yes' or 'no'.
                                ('y', 'n' and any capitalization are
                                also accepted)

            or a callback function with this signature:
                validate(answer) -> errmsg
            It should return None to indicate a valid answer.
            
            If not specified the default validator is used -- which just
            ensures that a non-empty value is entered.
    """
    if isinstance(validate, (str, unicode)):
        if validate == "notempty":
            def validate_notempty(answer):
                if not answer:
                    return "You must enter some non-empty value."
            validate = validate_notempty
        elif validate == "yes-or-no":
            def validate_yes_or_no(answer):
                normalized = {'y': 'yes', 'ye': 'yes', 'yes': 'yes',
                              'n': 'no',  'no': 'no'}
                if answer.lower() not in normalized.keys():
                    return "Please enter 'yes' or 'no'."
            validate = validate_yes_or_no
        else:
            raise Error("unknown stock validator: '%s'" % validate)
    
    def indented(text, indent=' '*4):
        lines = text.splitlines(1)
        return indent + indent.join(lines)

    sys.stdout.write(preamble+'\n')
##    if default is not None:
##        sys.stdout.write("""\
##Default:
##%s
##Type <Enter> to use the default.
##""" % indented(default or "<empty>"))
    while True:
        if True:
            answer = raw_input(prompt)
        else:
            sys.stdout.write(prompt)
            sys.stdout.flush()
            answer = sys.stdout.readline()
        if not answer and default:
            answer = default
            #sys.stdout.write("using default: %s\n" % default)
        if validate is not None:
            errmsg = validate(answer)
            if errmsg:
                sys.stdout.write(errmsg+'\n')
                continue
        break
    return answer


def _create_tmp_dir():
    """Create a temporary directory and return the path to it."""
    if hasattr(tempfile, "mkdtemp"): # use the newer mkdtemp is available
        path = tempfile.mkdtemp()
    else:
        path = tempfile.mktemp()
        os.makedirs(path)
    return path


def _is_wanted_komodo_different(ver_info, pretty_product, install_info):
    if sys.platform == "win32":
        product_code = install_info
        # Just presume it is installed in default location.
        ver = '.'.join(str(i) for i in ver_info[:2])
        komodo_exe_path = r"C:\Program Files\ActiveState %s %s\ko.exe"\
                           % (pretty_product, ver)
        if not exists(komodo_exe_path):
            # "ko.exe" was added in Komodo 3.5.3b1 and is the only good
            # way to get the Komodo version from the command line. If
            # "ko.exe" isn't there, then just presume the latest *is*
            # new than this version.
            return True
    elif sys.platform == "darwin":
        install_dir = install_info
        komodo_exe_path = join(install_dir, "Contents", "MacOS", "komodo")
    else:
        install_dir = install_info
        komodo_exe_path = join(install_dir, "bin", "komodo")

    # Get the version of the currently installed Komodo.
    cmd = '"%s" --xml-version' % komodo_exe_path
    o = os.popen(cmd)
    ver_xml = o.read()
    retval = o.close()
    if retval:
        raise Error("error running '%s'" % cmd)
    try:
        dom = minidom.parseString(ver_xml)
    except ExpatError, ex:
        raise Error("could not determine version from `komodo --xml-version` "
                    "output: %r (%s)" % (ver_xml, ex))
    version_node = dom.getElementsByTagName("version")[0]
    curr_version = ''.join(c.nodeValue for c in version_node.childNodes
                           if c.nodeType == c.TEXT_NODE)
    buildnum_node = dom.getElementsByTagName("build-number")[0]
    curr_buildnum = ''.join(c.nodeValue
                            for c in buildnum_node.childNodes
                            if c.nodeType == c.TEXT_NODE)
    curr_version += "-" + curr_buildnum
    curr_ver_info = _split_full_ver(curr_version)
    
    log.info("current Komodo installation: %s", curr_ver_info)
    log.info("wanted Komodo installation: %s", ver_info)
    return (curr_ver_info != ver_info)

def _device_volumepath_from_hdiutil_attach(output):
    """
    Example output from an "hdiutil attach path/to/DMG" command:
        ...
        Finishing...
        Finishing...
        /dev/disk1              Apple_partition_scheme         
        /dev/disk1s1            Apple_partition_map            
        /dev/disk1s2            Apple_HFS                       /Volumes/Komodo-Professional-4.0
    """
    pat = re.compile(r"^(/dev/\w+)\s+Apple_HFS\s+(.+?)$", re.M)
    match = pat.search(output)
    return match.group(1), match.group(2)

def _install_komodo(seeker, install_info=None, dry_run=False, channel=None):
    if not dry_run:
        tmp_dir = _create_tmp_dir()
        log.debug("created working dir: '%s'" % tmp_dir)
    try:
        if not dry_run:
            tmp_pkg_path = join(tmp_dir, ubasename(seeker.url))
            log.info("downloading %s", seeker.url)
            #urllib.urlretrieve(seeker.url, tmp_pkg_path)
            _download_url(seeker.url, tmp_pkg_path)
        if sys.platform == "win32":
            install_dir = join(os.environ["ProgramFiles"],
                "ActiveState %s %s" % (seeker.pretty_product, seeker.ver))
            log.info("install %s %s %s to `%s'", seeker.pretty_product,
                     seeker.version, seeker.buildnum, install_dir)
            if not dry_run:
                msiexec_exe = _get_msiexec_exe_path()
                log_path = join(tempfile.gettempdir(), "install.log")
                _run('%s /norestart /q /i %s /L*v "%s" INSTALLDIR="%s"'
                     % (msiexec_exe, tmp_pkg_path, log_path, install_dir),
                     log.debug)

                if channel is not None:
                    _set_update_channel(install_dir, channel)

        elif sys.platform == "darwin":
            install_dir = "/Applications/%s %s.app"\
                          % (seeker.pretty_product, seeker.ver)
            if exists(install_dir):
                raise Error("cannot install Komodo %s: `%s' exists"
                            % (seeker.version, install_dir))
            log.info("install %s %s %s to `%s'", seeker.pretty_product,
                     seeker.version, seeker.buildnum, install_dir)
            if not dry_run:
                output = _capture_output('hdiutil attach "%s"'
                                         % tmp_pkg_path)
                device, volumepath \
                    = _device_volumepath_from_hdiutil_attach(output)
                src_path = glob(join(volumepath, "Komodo*.app"))[0]
                try:
                    _run('cp -R "%s" "%s"' % (src_path, install_dir),
                         log.debug)
                finally:
                    _run('hdiutil unmount "%s"' % volumepath)
                    _run('hdiutil detach "%s"' % device)
            
            if channel is not None:
                _set_update_channel(install_dir, channel)

        else:
            install_dir = expanduser(
                "~/opt/%s-%s" % (seeker.pretty_product.replace(' ', '-'), seeker.ver))
            if not dry_run and exists(install_dir):
                raise Error("cannot install Komodo %s: `%s' exists"
                            % (seeker.version, install_dir))
            log.info("install %s %s %s to `%s'", seeker.pretty_product, 
                     seeker.version, seeker.buildnum, install_dir)
            if not dry_run:
                _run_in_dir("tar xzf %s" % basename(tmp_pkg_path),
                            tmp_dir, log.debug)
                install_sh_path \
                    = join(basename(tmp_pkg_path)[:-len(".tar.gz")],
                           "install.sh")
                _run_in_dir("sh %s -I %s" % (install_sh_path, install_dir),
                            tmp_dir, log.debug)

            if channel is not None:
                _set_update_channel(install_dir, channel)
    finally:
        if not dry_run:
            log.debug("removing temporary working dir '%s'", tmp_dir)
            try:
                if sys.platform == "win32":
                    _run('rd /s/q "%s"' % tmp_dir, log.debug)
                else:
                    _run('rm -rf "%s"' % tmp_dir, log.debug)
            except EnvironmentError, ex:
                log.warn("could not remove temp working dir '%s': %s",
                         tmp_dir, ex)


def _set_update_channel(install_dir, channel):
    log.info("setting '%s' update channel to '%s'", install_dir, channel)
    if sys.platform == "darwin":
        channel_prefs_path = join(install_dir, "Contents", "MacOS", "defaults", 
                                  "pref", "channel-prefs.js")    
    else:
        channel_prefs_path = join(install_dir, "lib", "mozilla", "defaults", 
                                  "pref", "channel-prefs.js")    

    content = open(channel_prefs_path, 'r').read()
    content = re.sub(r'(pref\("app.update.channel",\s+")\w+("\))',
                     r'\1%s\2' % channel,
                     content)
    open(channel_prefs_path, 'w').write(content)


def _get_msiexec_exe_path():
    return join(os.environ["windir"], "system32", "msiexec.exe")


def _uninstall_komodo(ver, pretty_product, install_info,
                      dry_run=False):
    if sys.platform == "win32":
        product_code = install_info
        log.info("uninstalling %s %s (ProductCode: %s)",
                 pretty_product, ver, product_code)
        if not dry_run:
            msiexec_exe = _get_msiexec_exe_path()
            _run("%s /norestart /q /x %s" % (msiexec_exe, product_code), log.debug)

    else:
        install_dir = install_info
        log.info("uninstalling %s at `%s'", pretty_product, install_dir)
        if not dry_run:
            _run('rm -rf "%s"' % install_dir, log.debug)

def _reporthook(numblocks, blocksize, filesize, url=None):
    #print "reporthook(%s, %s, %s)" % (numblocks, blocksize, filesize)
    base = os.path.basename(url)
    #XXX Should handle possible filesize=-1.
    try:
        percent = min((numblocks*blocksize*100)/filesize, 100)
    except:
        percent = 100
    if numblocks != 0:
        sys.stdout.write("\b"*70)
    sys.stdout.write("%-66s%3d%%" % (base, percent))

def _download_url(url, dst):
    if sys.stdout.isatty():
        urllib.urlretrieve(url, dst,
                           lambda nb, bs, fs, url=url: _reporthook(nb,bs,fs,url))
        sys.stdout.write('\n')
    else:
        urllib.urlretrieve(url, dst)

def _capture_output(cmd):
    o = os.popen(cmd)
    output = o.read()
    retval = o.close()
    if retval:
        raise Error("error capturing output of `%s': %r" % (cmd, retval))
    return output

def _find_installed_komodo_registry_id(ver, product):
    """Return the Windows registry id for the given Komodo, if it
    is installed. Otherwise, returns None.
    """
    short_product = {"komodoide": "ide", "komodoedit": "edit"}[product]
    candidate_registry_ids = [ver, "%s-%s" % (ver, short_product)]
    for registry_id in candidate_registry_ids:
        keyName = r"Software\ActiveState\Komodo\%s" % registry_id
        for base in (_winreg.HKEY_LOCAL_MACHINE, _winreg.HKEY_CURRENT_USER):
            try:
                key = _winreg.OpenKey(base, keyName)
                return registry_id
            except EnvironmentError:
                pass
    else:
        return None

def _is_komodo_installed(ver, product, pretty_product):
    """If Komodo is installed return install info sufficient for
    uninstalling it. Otherwise, return None.
    """
    if sys.platform == "win32":
        # The right answer is to ask the MSI system, but (1) I can't
        # remember how to do that (answer is somewhere on WiX discuss
        # mailing list) and (2) that would likely imply dependencies.
        #
        # Instead we'll check Komodo's typical key in the registry.
        registry_id = _find_installed_komodo_registry_id(ver, product)
        if registry_id is None:
            return None

        # Return the MSI ProductCode for this version of Komodo.
        product_code_from_registry_id = {
            "3.1": "{7238E62D-8657-4223-BBEC-BFCB43472267}",
            "3.5": "{DDB043A6-85F1-4B6D-85BE-D83DFB12F5C1}",
            "4.0": "{DAC6D1FF-A741-4F0D-AF57-FB4A08B417E9}",
            "4.0-ide": "{DAC6D1FF-A741-4F0D-AF57-FB4A08B417E9}",
            "4.0-edit": "{B34983C3-7BB8-4DA5-AF3C-F1F1C0ED6896}",
            "4.1-ide": "{e9067379-029a-480b-b89c-c9c5856d4aca}",
            "4.1-edit": "{8ec5e250-7b61-4e6f-88cb-eee0519f39ef}",
            "4.2-ide": "{f2fca603-6c72-447d-b79f-2eeb0a548d6a}",
            "4.2-edit": "{50e54ee6-75f5-4483-b73e-137b4207ca08}",
            "4.3-ide": "{9b539f9d-bf09-4b50-ad6b-b5abd74efc25}",
            "4.3-edit": "{2f60dd96-aceb-4ace-a85e-bdbfcad0c958}",
            "4.4-ide": "{88bed00e-232e-42ea-9b20-472f0df0e8cb}",
            "4.4-edit": "{a8ea45a5-b551-42f0-9199-ba661cf58b8c}",
            "5.0-ide": "{5e63fdf8-59a1-4276-bb26-3783a59cece2}",
            "5.0-edit": "{3c197539-fec1-4cbb-8dc4-fcc3e9441e2a}",
            "5.1-ide": "{4c95ed29-871b-4d7e-b773-1235acc63792}",
            "5.1-edit": "{be8d6bfc-fe20-44b2-abd4-c1c0cbc001dc}",
            "5.2-ide": "{f683c853-390f-4acf-b190-c9f42d935aa5}",
            "5.2-edit": "{34a86a48-1225-419b-94b2-3a0548786ecd}",
        }
        try:
            return product_code_from_registry_id[registry_id]
        except KeyError, ex:
            raise Error("don't know MSI ProductCode for %s %s: "
                        "you'll need to manually uninstall your Komodo "
                        "and then re-run this script"
                        % (pretty_product, ver))

    elif sys.platform == "darwin":
        candidates = [
            "/Applications/%s %s.app" % (pretty_product, ver),
            "/Applications/%s.app" % pretty_product,
            "/Applications/Komodo.app",
        ]
        for install_dir in candidates:
            if exists(install_dir):
                komodo = join(install_dir, "Contents", "MacOS", "komodo")
                installed_fullver = _capture_output('"%s" --version' % komodo)
                installed_ver = re.search(r"(\d+\.\d+)\.\d+",
                                          installed_fullver).group(1)
                if installed_ver == ver:
                    return install_dir

    else:
        candidates = [
            "~/opt/%s-%s" % (pretty_product.replace(' ', '-'), ver),
        ]
        for pattern in candidates:
            for install_dir in glob(expanduser(pattern)):
                if exists(install_dir):
                    return install_dir
        else:
            return None


def _install_dir_from_install_info(install_info, seeker):
    if sys.platform == "win32":
        # `install_info` is the product GUID. Don't currently know if a quick
        # way to get the install dir from that.
        product_code = install_info
        # Just presume it is installed in koup's default install location.
        install_dir = join(os.environ["ProgramFiles"],
            "ActiveState %s %s" % (seeker.pretty_product, seeker.ver))
    else:
        # `install_info` *is* the install dir.
        install_dir = install_info
    return install_dir

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

class _NoReflowFormatter(optparse.IndentedHelpFormatter):
    """An optparse formatter that does NOT reflow the description."""
    def format_description(self, description):
        return description or ""

def _long_ver_str_from_ver_info(ver_info):
    quality_from_q = {"a": "alpha", "alpha": "alpha",
                      "b": "beta",  "beta": "beta"}
    bits = ['.'.join(str(i) for i in ver_info[:3])]
    if len(ver_info) > 3 and ver_info[3]:
        bits.append(quality_from_q[ver_info[3]])
    if len(ver_info) > 4 and ver_info[4]:
        bits[-1] += str(ver_info[4])
    return '-'.join(bits)

# Recipe: ver (1.0.1)
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

#TODO: add '-1' support for next to last build
def main(argv):
    usage = "usage: %prog PRODUCT ..."
    version = "%prog "+__version__
    parser = optparse.OptionParser(prog="koup", usage=usage,
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
    parser.add_option("-c", "--channel",
                      help="Tweak update channel post-install to the given value.")
    parser.set_defaults(log_level=logging.INFO, dry_run=False)
    opts, args = parser.parse_args()
    log.setLevel(opts.log_level)

    if len(args) < 1:
        log.error("incorrect number of arguments (see `koup.py -h')")
        return 1

    product, args = args[0], args[1:]
    canon_product = {
        "ide": "komodoide",
        "edit": "komodoedit",
        "komodoide": "komodoide",
        "komodoedit": "komodoedit",
    }[product]

    if not args:
        seeker = KomodoNightlyPackageSeeker(canon_product)
    elif len(args) == 1:
        if args[0] == "nightly":
            seeker = KomodoNightlyPackageSeeker(canon_product)
        elif args[0].startswith("nightly-"):
            branch = args[0].split("-", 1)[1]
            seeker = KomodoNightlyPackageSeeker(canon_product, branch)
        else:
            seeker = KomodoReleasePackageSeeker(canon_product, args[0])
    elif len(args) != 2:
        log.error("incorrect number of arguments (see `koup.py -h')")
        return 1
    else:
        version = args[0]
        if args[1].startswith("devbuild"):
            n_str = args[1][len("devbuild"):]
            if n_str:
                n = int(n_str[1:])
            else:
                n = 0
            seeker = KomodoDevbuildPackageSeeker(canon_product, version, n)
        elif args[1] == "release":
            seeker = KomodoReleasePackageSeeker(canon_product, version)
        elif args[1].lower().startswith("rc"):
            assert re.match("rc\d*", args[1].lower()), \
                "invalid 'rc[N]' designator: %r" % args[1]
            if len(args[1]) > 2:
                rc_num = int(args[1][2:])
            else:
                rc_num = None
            seeker = KomodoRCPackageSeeker(canon_product, version, rc_num)
        else:
            log.error("unknown package type: %r", args[1])
            return 1

    return koup(seeker, channel=opts.channel,
                dry_run=opts.dry_run)


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


