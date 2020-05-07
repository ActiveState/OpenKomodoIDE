
"""Makefile for build PHP and xdebug for a number of versions. """

# C.f.
# http://ca3.php.net/manual/en/install.windows.building.php
#

import os
from os.path import join, dirname, normpath, abspath, isabs, exists, \
                    splitext, basename, expanduser
import re
import sys
from pprint import pprint
from glob import glob
import shutil
import subprocess
import logging

sys.path.append(join(dirname(abspath(__file__)), "..", "..", "util"))

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("build")


#---- config settings

g_pkg_cache_dir = abspath(join("tmp", "pkg_cache"))
g_build_dir = abspath("build")
# Komodo's prebuilt base dir for xdebug bits.
prebuilt_dir = join(dirname(dirname(dirname(abspath(__file__)))),
    "prebuilt", "xdebug")

isWin = sys.platform.startswith("win")
isLin = sys.platform.startswith("linux")
isMac = sys.platform.startswith("darwin")


#---- utilities

def run(cmd, cwd=None, shell=True, env=None):
    log.info("running: %s in %s" % (cmd, cwd))
    subprocess.check_call(cmd, cwd=cwd, shell=shell, env=env,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

def unzip_file_into_dir(filepath, dirpath):
    import zipfile
    dirpath = abspath(dirpath)
    if not exists(dirpath):
        os.mkdir(dirpath, 0777)
    zfobj = zipfile.ZipFile(filepath)
    for name in zfobj.namelist():
        path = join(dirpath, name)
        # Check the parent directory exists - make it when it doesn't.
        parent_path = dirname(path)
        mkdir_paths = []
        while not exists(parent_path):
            mkdir_paths.append(parent_path)
            parent_path = dirname(parent_path)
        for parent_path in reversed(mkdir_paths):
            os.mkdir(parent_path, 0777)

        if path.endswith('/'):
            if not exists(path):
                os.mkdir(path)
        else:
            file(path, 'wb').write(zfobj.read(name))

def DownloadAndExtractPackage(url, dst_dir, alternativeUrls=None):
    import tempfile
    import urllib2
    all_urls = [url]
    if alternativeUrls:
        all_urls += alternativeUrls
    for url in all_urls:
        try:
            print "Downloading: %s" % (url, )
            response = urllib2.urlopen(url)
            break
        except:
            print "  FAILED to download: %s" % (url, )
            pass
    else:
        print "\nERROR: Unable to download %s" % (", ".join(all_urls), )
        sys.exit(2)
    fd, filename = tempfile.mkstemp()
    bname = basename(url)
    try:
        os.write(fd, response.read())
        os.close(fd)
        if ".zip" in bname:
            unzip_file_into_dir(filename, dst_dir)
        else:
            import tarfile
            tar = tarfile.open(filename)
            tar.extractall(dst_dir)
    finally:
        if exists(filename):
            try:
                os.remove(filename)
            except:
                pass

#---- shared base task

class XdebugBuild:
    dll_suffix = ".dll" if isWin else ".so"

    def __init__(self, phpversion, xdebugversion,
                 threadsafe=True, architecture="x86", compiler_version=9):
        assert phpversion and isinstance(phpversion, str)
        assert phpversion.count(".") >= 1
        self.phpversion = phpversion
        self.xdebugversion = xdebugversion
        self.threadsafe = threadsafe
        self.architecture = architecture
        self.compiler_version = compiler_version

    @property
    def pkg_name(self):
        return "php-%s%s-Win32-VC%d-%s" % (
                self.phpversion,
                not self.threadsafe and "-nts" or "",
                self.compiler_version,
                self.architecture)
    @property
    def src_name(self):
        return "php-%s-src" % (self.phpversion)
    @property
    def safe_xdebug_version(self):
        return self.xdebugversion.replace(":", "_").replace(' ', '_')
    @property
    def xdebug_ext_dir(self):
        return join(self.php_build_dir, "ext", "xdebug")
    @property
    def xdebug_package_name(self):
        return "xdebug-%s.tgz" % (self.xdebugversion, )
    @property
    def php_major_ver(self):
        return int(self.phpversion.split(".")[0])
    @property
    def php_minor_ver(self):
        return int(self.phpversion.split(".")[1])
    @property
    def php_build_dir(self):
        return join(g_build_dir, self.pkg_name)
    @property
    def php_src_dir(self):
        return join(g_pkg_cache_dir, self.src_name)
    @property
    def obj_dir(self):
        if self.architecture == "amd64":
            return join(self.php_build_dir, "x64", "Release%s" % (self.threadsafe and "_TS" or ""))
        else:
            return join(self.php_build_dir, "Release%s" % (self.threadsafe and "_TS" or ""))
    @property
    def xdebug_library(self):
        return join(self.obj_dir, "%sxdebug%s" % ("php_" if isWin else "", self.dll_suffix))
    @property
    def komodo_prebuilt_dir(self):
        ko_dir = dirname(dirname(dirname(abspath(__file__))))
        ver = ".".join(self.phpversion.split(".")[:2])
        if isWin:
            arch_name = "%s-vc%d-%s" % (self.threadsafe and "ts" or "nts",
                                        self.compiler_version,
                                        self.architecture.replace("amd64", "x64"))
            return join(ko_dir, "prebuilt", "xdebug", "win32-x86", ver, arch_name)
        elif isMac:
            return join(ko_dir, "prebuilt", "xdebug", "macosx", ver)
        else:
            arch_name = os.uname()[4].replace("i686", "x86")
            return join(ko_dir, "prebuilt", "xdebug", "linux-%s" % (arch_name), ver)

    def xdebug_clean(self):
        """Download xdebug source/repo files."""
        for dirpath in [self.xdebug_ext_dir,
                        join(self.obj_dir, "ext", "xdebug")]:
            if exists(dirpath):
                try:
                    shutil.rmtree(dirpath)
                except WindowsError:
                    subprocess.check_call(["rd", "/s", "/q", dirpath], shell=True)
        import glob
        for filepath in glob.glob(join(self.obj_dir, "php_xdebug.*")):
            os.remove(filepath)

    def xdebug_src_from_git(self):
        log.info("Cloning xdebug source")
        cmd = ["git", "clone", "git://github.com/derickr/xdebug.git"]
        run(cmd, cwd=g_pkg_cache_dir)

    def xdebug_src_from_package(self):
        log.info("Downloading xdebug source")
        url = "http://komodo.nas1.activestate.com/extras/build-dependencies/php/%s" % self.xdebug_package_name
        url2 = "http://xdebug.org/files/%s" % self.xdebug_package_name
        DownloadAndExtractPackage(url, g_pkg_cache_dir, alternativeUrls=[url2])
        # Rename the extracted directory.
        xdebug_src_dir = join(g_pkg_cache_dir, "xdebug")
        os.rename(join(g_pkg_cache_dir, splitext(self.xdebug_package_name)[0]),
                  xdebug_src_dir)

    def xdebug_src(self):
        """Download xdebug source/repo files."""
        if not exists(self.xdebug_ext_dir):
            xdebug_src_dir = join(g_pkg_cache_dir, "xdebug")
            if not exists(xdebug_src_dir):
                if self.xdebugversion.startswith("git"):
                    self.xdebug_src_from_git()
                else:
                    self.xdebug_src_from_package()
            else:
                log.info("Using xdebug source at %s", xdebug_src_dir)

            # Copy across to the PHP build area.
            shutil.copytree(xdebug_src_dir, self.xdebug_ext_dir)

            # Patch it.
            patchesDir = join(dirname(abspath(__file__)), "patches")
            if exists(patchesDir):
                import patchtree
                patchesLogDir = self.xdebug_ext_dir + ".patches"
                patchtree.patch([patchesDir], self.xdebug_ext_dir, config=self,
                                logDir=patchesLogDir)

    def php_src(self):
        if not exists(self.php_src_dir):
            url = "http://komodo.nas1.activestate.com/extras/build-dependencies/php/%s.zip" % self.src_name
            phpnetBaseUrl = "http://windows.php.net/downloads/releases/"
            phpSrcName = "%s.zip" % (self.src_name, )
            alt_urls = [phpnetBaseUrl+"archives/"+phpSrcName,
                        phpnetBaseUrl+phpSrcName ]
            DownloadAndExtractPackage(url, g_pkg_cache_dir, alternativeUrls=alt_urls)
            # Rename the extracted directory.
            if self.phpversion < "5.3.1":
                os.rename(join(g_pkg_cache_dir, "php-%s" % (self.phpversion)), self.php_src_dir)
        if isWin:
            # PHP 7.1 added a bunch testing files with unicode names which breaks
            # shutil.copytree on Windows.  Converting to a Unicode object fixes it.
            self.php_src_dir = unicode(self.php_src_dir)
        if not exists(self.php_build_dir):
            shutil.copytree(self.php_src_dir, self.php_build_dir)

    def php_sdk(self):
        phpsdk_dir = join(g_pkg_cache_dir, "phpsdk")
        if not exists(phpsdk_dir):
            url = "http://windows.php.net/downloads/php-sdk/php-sdk-binary-tools-20110915.zip"
            DownloadAndExtractPackage(url, phpsdk_dir)
        if self.compiler_version == 6 and self.phpversion[:4] == "5.2.":
            winbuild_sdk_dir = join(g_pkg_cache_dir, "win32build")
            if not exists(winbuild_sdk_dir):
                url = "http://www.php.net/extra/win32build.zip"
                DownloadAndExtractPackage(url, g_pkg_cache_dir)

    def make(self):
        self.php_build()

    def update_prebuilt(self):
        src_path = self.xdebug_library
        dst_path = join(self.komodo_prebuilt_dir, basename(self.xdebug_library))
        assert exists(src_path), "No xdebug library at: %s" % (src_path, )
        print "Copying %s to %s" % (src_path, dst_path)
        if not exists(dirname(dst_path)):
            os.makedirs(dirname(dst_path))
        shutil.copy(src_path, dst_path)



class WindowsXdebugBuild(XdebugBuild):
    def php_build(self):
        if not exists(join(self.obj_dir, "php.exe")) or \
           not exists(join(self.obj_dir, "php_xdebug.dll")):
            print "Building %s" % (self.pkg_name)
            self.php_src()
            self.xdebug_clean()
            self.xdebug_src()
            self.php_sdk()
            configure_filepath = join(self.php_build_dir, "ko_configure.bat")
            phpsdk_dir = join(g_pkg_cache_dir, "phpsdk")
            options = "--disable-all --enable-cli --with-xdebug=shared"
            if not self.threadsafe:
                options += " --disable-zts"
            if self.compiler_version == 6 and self.phpversion[:4] == "5.2.":
                options += " --enable-object-out-dir=. --with-php-build=%s" % (
                           join(g_pkg_cache_dir, "win32build"), )
            configure_contents = r"""
call %s\msvc%d.bat %s
call %s\bin\phpsdk_setvars.bat
call buildconf
call configure %s
nmake
    """ % (dirname(abspath(__file__)),
           self.compiler_version,
           self.architecture == "amd64" and "amd64" or "x86",
           phpsdk_dir,
           options)
            file(configure_filepath, "w").write(configure_contents)
            subprocess.check_call(r".\ko_configure", cwd=self.php_build_dir, shell=True)


class UnixXdebugBuild(XdebugBuild):
    def __init__(self, phpversion, xdebugversion):
        XdebugBuild.__init__(self, phpversion, xdebugversion)

    @property
    def xdebug_ext_dir(self):
        return join(g_build_dir, "php-%s-xdebug-%s" % (self.phpversion, self.xdebugversion))
    @property
    def obj_dir(self):
        return join(self.xdebug_ext_dir, "modules")
    @property
    def php_config_path(self):
        assert self.prereq_inst is not None
        return join(self.prereq_inst.install_bin_dir, "php-config")
    @property
    def phpize_path(self):
        assert self.prereq_inst is not None
        return join(self.prereq_inst.install_bin_dir, "phpize")

    def php_src(self):
        if not exists(self.php_src_dir):
            url = "http://komodo.nas1.activestate.com/extras/build-dependencies/php/%s.tar.bz2" % self.src_name
            alt_urls = ["http://ca1.php.net/get/%s.tar.bz2/from/this/mirror/" % (self.src_name, )]
            #alt_urls = ["http://ca2.php.net/distributions/%s.tar.bz2" % (self.src_name, )]
            DownloadAndExtractPackage(url, g_pkg_cache_dir, alternativeUrls=alt_urls)
            # Rename the extracted directory.
            #if self.phpversion < "5.3.1":
            #    os.rename(join(g_pkg_cache_dir, "php-%s" % (self.phpversion)), self.php_src_dir)
        if not exists(self.php_build_dir):
            shutil.copytree(self.php_src_dir, self.php_build_dir)

    def php_build(self):
        import install_prerequisites
        prereq_name = "PHP%d%d" % (self.php_major_ver, self.php_minor_ver,)
        self.prereq_inst = getattr(install_prerequisites, prereq_name)()
        install_prerequisites.install_languages([self.prereq_inst])

    def _make_mac(self):
        """Build a universal xdebug.so. Currently just for i386, ppc and
        x86_64.
        """
        build_dir = self.xdebug_ext_dir
        tmp_dir = join(build_dir, "tmp")
        if exists(tmp_dir):
            shutil.rmtree(tmp_dir)
        os.mkdir(tmp_dir)
        
        if exists(join(build_dir, "Makefile")):
            run("make distclean", cwd=build_dir)
        try:
            run(self.phpize_path, cwd=build_dir)
        except subprocess.CalledProcessError:
            # Sometimes it's due to missing "autoheader" exe.
            env = os.environ.copy()
            env['PHP_AUTOCONF'] = 'autoconf264'
            env['PHP_AUTOHEADER'] = 'autoheader264'
            run(self.phpize_path, cwd=build_dir, env=env)
        if not exists(join(build_dir, "configure")):
            run("autoconf", cwd=build_dir)
        
        for arch in ["i386", "x86_64"]:
            if exists(join(build_dir, "Makefile")):
                run("make clean", cwd=build_dir)
            os.environ["CFLAGS"] = "-arch %s" % arch
            extra_flags = ""
            if arch in ["i386", "x86_64"]:
                # For x86, make sure the resulting binaries will be able
                # to run on OSX 10.5 machines.  Bug 92814.
                extra_flags += " EXTRA_LDFLAGS=-mmacosx-version-min=10.6"
            run("./configure --enable-xdebug --with-php-config=%s %s" %
                    (self.php_config_path, extra_flags),
                cwd=build_dir)
            del os.environ["CFLAGS"]
            run("make", cwd=build_dir)
            os.rename(join(build_dir, "modules", "xdebug.so"),
                      join(tmp_dir, "xdebug-%s.sof" % arch))
        run("lipo -create xdebug-*.sof -output ../modules/xdebug.so",
            cwd=tmp_dir)

    def _make_linux(self):
        build_dir = self.xdebug_ext_dir

        if exists(join(build_dir, "Makefile")):
            run("make distclean", cwd=build_dir)
        run(self.phpize_path, cwd=build_dir)
        if not exists(join(build_dir, "configure")):
            run("autoconf", cwd=build_dir)
        # Need to run have autoconf >=2.50, for PHP 4.3.0 at least.
        # Grrr. PHP 4.3.0's phpize complains but does not return an
        # error code. If you don't have an appropriate autoconf
        # version then you end up with modules/xdebug (i.e. no
        # ".so").
        run("./configure --enable-xdebug --with-php-config=%s" % self.php_config_path,
            cwd=build_dir)
        run("make", cwd=build_dir)
        xdebug_bit = join(build_dir, "modules", "xdebug.so")
        if not exists(xdebug_bit):
            raise RuntimeError("""something went wrong: `%s' does not exist

If you have `%s' then it is likely that you don't have an
appropriate enough autoconf version. PHP 4.3.0's phpize complains about
needing autoconf >= 2.50 but does not actually return an error code.
Super. 

Please add autoconf >=2.50 to your PATH and re-run this command.
""" % (xdebug_bit, splitext(xdebug_bit)[0]))

    def xdebug_build(self):
        if sys.platform.startswith("linux"):
            self._make_linux()
        else:
            self._make_mac()

    def make(self):
        if not exists(self.xdebug_library):
            self.php_build()
            self.xdebug_clean()
            self.xdebug_src()
            self.xdebug_build()
        else:
            log.info("PHP %s xdebug %s already built", self.phpversion, self.xdebugversion)



#######################
## The builds

import config

xdebug_version = config.versions.get("xdebug")

if sys.platform.startswith("win"):
    g_builds = [
        # PHP 7.1
        WindowsXdebugBuild(config.versions.get("php71"), xdebug_version, threadsafe=True, compiler_version=14),
        WindowsXdebugBuild(config.versions.get("php71"), xdebug_version, threadsafe=False, compiler_version=14),
        WindowsXdebugBuild(config.versions.get("php71"), xdebug_version, threadsafe=True, compiler_version=14, architecture="amd64"),
        WindowsXdebugBuild(config.versions.get("php71"), xdebug_version, threadsafe=False, compiler_version=14, architecture="amd64"),
        # PHP 7.0
        WindowsXdebugBuild(config.versions.get("php70"), xdebug_version, threadsafe=True, compiler_version=14),
        WindowsXdebugBuild(config.versions.get("php70"), xdebug_version, threadsafe=False, compiler_version=14),
        WindowsXdebugBuild(config.versions.get("php70"), xdebug_version, threadsafe=True, compiler_version=14, architecture="amd64"),
        WindowsXdebugBuild(config.versions.get("php70"), xdebug_version, threadsafe=False, compiler_version=14, architecture="amd64"),
        # PHP 5.6
        WindowsXdebugBuild(config.versions.get("php56"), xdebug_version, threadsafe=True, compiler_version=11),
        WindowsXdebugBuild(config.versions.get("php56"), xdebug_version, threadsafe=False, compiler_version=11),
        WindowsXdebugBuild(config.versions.get("php56"), xdebug_version, threadsafe=True, compiler_version=11, architecture="amd64"),
        WindowsXdebugBuild(config.versions.get("php56"), xdebug_version, threadsafe=False, compiler_version=11, architecture="amd64"),
        # PHP 5.5
        WindowsXdebugBuild(config.versions.get("php55"), xdebug_version, threadsafe=True, compiler_version=11),
        WindowsXdebugBuild(config.versions.get("php55"), xdebug_version, threadsafe=False, compiler_version=11),
        WindowsXdebugBuild(config.versions.get("php55"), xdebug_version, threadsafe=True, compiler_version=11, architecture="amd64"),
        WindowsXdebugBuild(config.versions.get("php55"), xdebug_version, threadsafe=False, compiler_version=11, architecture="amd64"),
    ]
else:
    g_builds = [
        # PHP 7.1
        UnixXdebugBuild(config.versions.get("php71"), xdebug_version),
        # PHP 7.0
        UnixXdebugBuild(config.versions.get("php70"), xdebug_version),
        # PHP 5.6
        UnixXdebugBuild(config.versions.get("php56"), xdebug_version),
        # PHP 5.5
        UnixXdebugBuild(config.versions.get("php55"), xdebug_version),
        # PHP 5.4
    ]

def build():
    if not exists(g_pkg_cache_dir):
        os.makedirs(g_pkg_cache_dir)
    for build in g_builds:
        build.make()

def clean():
    for build in g_builds:
        build.xdebug_clean()

def update_prebuilt():
    for build in g_builds:
        build.update_prebuilt()

def usage():
    print 'Usage: %s [options]\n' % (basename(__file__))
    print '  where options can be any of:'
    print '    "build"  - build the PHP/Xdebug binaries'
    print '    "update" - copy across to Komodo\'s prebuilt directory'
    print '    "clean" - remove all xdebug related files'
    return 1

def main():
    opts = sys.argv[1:] or ["build"]
    for opt in opts:
        if opt in ("build", "make", "all"):
            build()
        elif opt in ("clean"):
            clean()
        elif opt in ("update_prebuilt", "update"):
            update_prebuilt()
        else:
            return usage()

if __name__ == '__main__':
    sys.exit(main())
