
"""
Script for building/installing Komodo's language prerequisites.

Note: Currently only the Linux platform is supported.

Some of the installers (ActiveTcl) requires a GUI. If your running remotely over
SSH, use "ssh -Y" to ensure the X11 session is opened on your local machine
instead of the remote machine.
"""


import os
from os.path import join, dirname, normpath, abspath, isabs, exists, \
                    splitext, basename, expanduser
import re
import sys
import shutil
from glob import glob
import subprocess
import logging
import tempfile

#import which # get it from http://trentm.com/projects/which/


# ==== Globals ==== #

g_base_install_dir = abspath(expanduser("~/install"))
g_temp_working_dir = abspath(expanduser("~/tmp"))

g_log_level = logging.INFO
logging.basicConfig(level=g_log_level)

class InstallException(Exception):
    def __init__(self, msg, stderr=None):
        Exception.__init__(self, msg)
        self.msg = msg
        self.stderr = stderr
class InstallWarning(Exception):
    def __init__(self, msg, stderr=None):
        Exception.__init__(self, msg)
        self.msg = msg
        self.stderr = stderr

# ==== Languages ==== #

class Language(object):
    name = None
    version_str = None
    CONFIGURE_FLAGS = None
    _log = None
    @property
    def log(self):
        if self._log is None:
            self._log = logging.getLogger(self.pkg_name)
            self._log.setLevel(g_log_level)
        return self._log
    @property
    def major_ver_as_str(self):
        return self.version_str.split(".")[0]
    @property
    def major_ver_as_int(self):
        return int(self.major_ver_as_str)
    @property
    def major_dot_minor_as_str(self):
        return ".".join(self.version_str.split(".")[:2])
    @property
    def version_tuple_as_str(self):
        return tuple(self.version_str.split("."))
    @property
    def version_tuple_as_ints(self):
        return tuple(map(int, self.version_tuple_as_str))
    @property
    def pkg_name(self):
        return "%s-%s" % (self.name, self.version_str)
    @property
    def install_dir(self):
        return join(g_base_install_dir, "%s-%s" % (self.name, self.major_dot_minor_as_str))
    @property
    def install_bin_dir(self):
        return join(self.install_dir, "bin")
    def _get_archive_format(self, archive):
        if archive.endswith(".tar.gz") or archive.endswith(".tgz"):
            return "tar.gz"
        elif archive.endswith(".tar.bz2"):
            return "tar.bz2"
        elif archive.endswith(".zip"):
            return "zip"
        return splitext(archive)[1]
    @property
    def archive_format(self):
        return self._get_archive_format(self.download_url)
    @property
    def pkg_archive_filepath(self):
        return join(g_temp_working_dir, "%s.%s" % (self.pkg_name, self.archive_format))
    @property
    def working_dir(self):
        return join(g_temp_working_dir, self.pkg_name)
    @property
    def src_working_dir(self):
        return join(self.working_dir, "src")

    def _download_to(self, url, dst_path):
        self.log.info("downloading %r", url)
        import urllib2
        response = urllib2.urlopen(url)
        file(dst_path, "wb").write(response.read())

    @property
    def download_url(self):
        # Allow platform specific download urls.
        if sys.platform.startswith("linux"):
            if os.uname()[4] == "x86_64":
                if hasattr(self, "download_url_linux_x86_64"):
                    return self.download_url_linux_x86_64
            elif hasattr(self, "download_url_linux_x86"):
                return self.download_url_linux_x86
        elif sys.platform == "darwin" and hasattr(self, "download_url_darwin"):
            return self.download_url_darwin

        raise ValueError("No download_url set on class %r", self)

    def download(self):
        url = self.download_url
        if not exists(self.pkg_archive_filepath):
            self._download_to(url, self.pkg_archive_filepath)

    def _extract_to(self, pkg_path, dst_dir):
        if exists(dst_dir):
            shutil.rmtree(dst_dir)
        if not exists(self.working_dir):
            os.makedirs(self.working_dir)
        temp_dir = tempfile.mkdtemp(dir=self.working_dir)
        try:
            self.log.info("extracting %r into %r", pkg_path, temp_dir)
            archive_format = self._get_archive_format(pkg_path)
            if archive_format in ("tar.gz", "tar.bz2"):
                import tarfile
                tar = tarfile.open(pkg_path)
                tar.extractall(temp_dir)
            elif archive_format == "zip":
                unzip_file_into_dir(pkg_path, temp_dir)
            else:
                raise Exception("Unknown archive format: %r" % (archive_format))
            # The extraction will create a new directory - we want to rename this to
            # use a known directory name.
            names = os.listdir(temp_dir)
            assert len(names) == 1, "Should be just one extracted dir, got %r" % (names, )
            shutil.move(join(temp_dir, names[0]),
                        dst_dir)
        finally:
            #shutil.rmtree(temp_dir)
            pass

    def extract(self):
        assert self.archive_format, "%s: Unknown archive format, download url: %r" % (self.pkg_name, self.download_url, )
        assert self.pkg_archive_filepath, "%s: No archive filepath" % (self.pkg_name, )
        self._extract_to(self.pkg_archive_filepath, self.src_working_dir)

    def _run(self, argv, cwd=None):
        if cwd is None:
            cwd = self.src_working_dir
        self.log.info("running %r in dir %r", argv, cwd)
        p = subprocess.Popen(argv,
                              cwd=cwd,
                              stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE)
        stdout, stderr = p.communicate()
        self.log.debug("stdout: %s", stdout)
        self.log.debug("stderr: %s", stderr)
        if p.returncode != 0:
            self.log.warn("stderr: %s", stderr)
            raise InstallException("Retval: %d, cmd: %r" % (p.returncode, argv), stderr)

    def build_configure(self):
        cmd = ["./configure", "--prefix=%s" % (self.install_dir, )]
        if self.CONFIGURE_FLAGS:
            cmd = self.CONFIGURE_FLAGS + cmd
        self._run(cmd)

    def build_make(self):
        self._run(["make"])

    def build(self):
        self.build_configure()
        self.build_make()

    def install(self):
        self._run(["make", "install"])

    def modules(self):
        pass

    def checkSupported(self):
        return True

    def make(self):
        if exists(self.install_dir):
            # Already install.
            return
        self.checkSupported()
        self.download()
        self.extract()
        self.build()
        self.install()
        self.modules()


#---- PHP

class PHPLanguage(Language):
    name = "php"
    @property
    def archive_format(self):
       return "tar.bz2"
    @property
    def download_url(self):
        return "http://ca.php.net/get/php-%s.tar.bz2/from/ca.php.net/mirror" % (self.version_str, )
    def checkSupported(self):
        if sys.platform == "darwin" and os.uname()[2] >= "11" and \
           self.version_str <= "5.1.99":
            # <= PHP 5.1 is not supported on Lion
            raise InstallWarning("Not supported on this platform")

class PHP71(PHPLanguage):
    version_str = "7.1.0"
class PHP70(PHPLanguage):
    version_str = "7.0.7"
class PHP56(PHPLanguage):
    version_str = "5.6.2"
class PHP55(PHPLanguage):
    version_str = "5.5.19"

#---- Python

class PythonLanguage(Language):
    name = "python"
    @property
    def download_url(self):
        return "http://www.python.org/ftp/python/%s/Python-%s.tgz" % (self.version_str, self.version_str)

class Python34(PythonLanguage):
    version_str = "3.4.1"
class Python33(PythonLanguage):
    version_str = "3.3.6"
class Python32(PythonLanguage):
    version_str = "3.2.4"
class Python31(PythonLanguage):
    version_str = "3.1.5"
class Python30(PythonLanguage):
    version_str = "3.0.1"
class Python27(PythonLanguage):
    version_str = "2.7.8"
class Python26(PythonLanguage):
    version_str = "2.6.8"
class Python25(PythonLanguage):
    version_str = "2.5.6"
    if sys.platform == "darwin":
        CONFIGURE_FLAGS = ["MACOSX_DEPLOYMENT_TARGET=10.6", "CC=gcc -arch i386"]
class Python24(PythonLanguage):
    version_str = "2.4.6"
    if sys.platform == "darwin":
        CONFIGURE_FLAGS = ["MACOSX_DEPLOYMENT_TARGET=10.6", "CC=gcc -arch i386", "LDFLAGS=-arch i386"]

#---- Ruby

class RubyLanguage(Language):
    name = "ruby"
    @property
    def download_url(self):
        return "http://ftp.ruby-lang.org/pub/ruby/%s/ruby-%s.tar.bz2" % (
                    self.version_str[:3], self.version_str)

class Ruby21(RubyLanguage):
    version_str = "2.1.5"
class Ruby20(RubyLanguage):
    version_str = "2.0.0-p598"
class Ruby19(RubyLanguage):
    version_str = "1.9.3-p392"
class Ruby18(RubyLanguage):
    version_str = "1.8.7-p330"
    def module_rubygems(self):
        url = "http://rubyforge.org/frs/download.php/74445/rubygems-1.6.2.tgz"
        archive_path = join(self.working_dir, basename(url))
        extract_dir = join(self.working_dir, "rubygems")
        self._download_to(url, archive_path)
        self._extract_to(archive_path, extract_dir)
        self._run([join(self.install_bin_dir, "ruby"), "setup.rb", "install"],
                  cwd=extract_dir)
    def module_json(self):
        self._run([join(self.install_bin_dir, "gem"), "install", "json"])
    def modules(self):
        self.module_rubygems()
        self.module_json()
    def checkSupported(self):
        if sys.platform == "darwin" and os.uname()[2] >= "11":
            # Ruby 1.8 is not supported on Lion
            raise InstallWarning("Not supported on this platform")

#---- ActivePerl

class ActivePerlLanguage(Language):
    name = "activeperl"
    @property
    def install_dir(self):
        if sys.platform == "darwin":
            # Global install.
            return "/usr/local/ActivePerl-%s" % (self.major_dot_minor_as_str, )
        return super(ActivePerlLanguage, self).install_dir
    def extract(self):
        if sys.platform == "darwin":
            return # Already built as .dmg files
        return Language.extract(self)
    def build(self):
        pass # Already built
    def install(self):
        if sys.platform == "darwin":
            self._run(["/usr/bin/hdiutil", "attach", self.pkg_archive_filepath], cwd=os.curdir)
            import time
            time.sleep(5)
            self._run(["/usr/bin/open", "/Volumes/ActivePerl-%s" % (self.major_dot_minor_as_str)], cwd=os.curdir)
            time.sleep(5)
        else:
            self._run(["./install.sh", "--license-accepted", "--prefix=%s" % (self.install_dir, )])
    def modules(self):
        self._run([join(self.install_bin_dir, "ppm"), "install", "json"], cwd=os.curdir)
    def checkSupported(self):
        if sys.platform == "darwin" and self.version_tuple_as_ints <= (5, 6):
            # Perl 5.6 is not supported on Mac.
            raise InstallWarning("Not supported on this platform")

class ActivePerl516(ActivePerlLanguage):
    version_str = "5.16.1.1601"
    download_url_linux_x86 = "http://lang.nas.activestate.com/ActivePerl/goldbits/5.16.1.1601/ActivePerl-5.16.1.1601-i686-linux-glibc-2.3.6-296175.tar.gz"
    download_url_linux_x86_64 = "http://lang.nas.activestate.com/ActivePerl/goldbits/5.16.1.1601/ActivePerl-5.16.1.1601-x86_64-linux-glibc-2.3.5-296175.tar.gz"
    download_url_darwin = "http://lang.nas.activestate.com/ActivePerl/goldbits/5.16.1.1601/ActivePerl-5.16.1.1601-darwin-10.8.0-296175.dmg"
class ActivePerl514(ActivePerlLanguage):
    version_str = "5.14.2.1402"
    download_url_linux_x86 = "http://lang.nas.activestate.com/ActivePerl/goldbits/5.14.2.1402/ActivePerl-5.14.2.1402-i686-linux-glibc-2.3.6-295342.tar.gz"
    download_url_linux_x86_64 = "http://lang.nas.activestate.com/ActivePerl/goldbits/5.14.2.1402/ActivePerl-5.14.2.1402-x86_64-linux-glibc-2.3.5-295342.tar.gz"
    download_url_darwin = "http://lang.nas.activestate.com/ActivePerl/goldbits/5.14.2.1402/ActivePerl-5.14.2.1402-darwin-9.8.0-295342.dmg"
class ActivePerl512(ActivePerlLanguage):
    version_str = "5.12.3.1204"
    download_url_linux_x86 = "http://lang.nas.activestate.com/ActivePerl/goldbits/5.12.4.1205/ActivePerl-5.12.4.1205-i686-linux-glibc-2.3.6-294981.tar.gz"
    download_url_linux_x86_64 = "http://lang.nas.activestate.com/ActivePerl/goldbits/5.12.4.1205/ActivePerl-5.12.4.1205-x86_64-linux-glibc-2.3.5-294981.tar.gz"
    download_url_darwin = "http://lang.nas.activestate.com/ActivePerl/goldbits/5.12.3.1204/ActivePerl-5.12.3.1204-darwin-9.8.0-294330.dmg"
class ActivePerl510(ActivePerlLanguage):
    version_str = "5.10.1.1008"
    download_url_linux_x86 = "http://lang.nas.activestate.com/ActivePerl/goldbits/5.10.1.1008/ActivePerl-5.10.1.1008-i686-linux-glibc-2.3.6-294165.tar.gz"
    download_url_linux_x86_64 = "http://lang.nas.activestate.com/ActivePerl/goldbits/5.10.1.1008/ActivePerl-5.10.1.1008-x86_64-linux-glibc-2.3.5-294165.tar.gz"
    download_url_darwin = "http://lang.nas.activestate.com/ActivePerl/goldbits/5.10.1.1008/ActivePerl-5.10.1.1008-darwin-9.8.0-294165.dmg"
class ActivePerl58(ActivePerlLanguage):
    version_str = "5.8.9.829"
    download_url_linux_x86 = "http://lang.nas.activestate.com/ActivePerl/goldbits/5.8.9.829/ActivePerl-5.8.9.829-i686-linux-glibc-2.3.6-294280.tar.gz"
    download_url_linux_x86_64 = "http://lang.nas.activestate.com/ActivePerl/goldbits/5.8.9.829/ActivePerl-5.8.9.829-x86_64-linux-glibc-2.3.5-294280.tar.gz"
    download_url_darwin = "http://lang.nas.activestate.com/ActivePerl/goldbits/5.8.9.829/ActivePerl-5.8.9.829-darwin-9.8.0-294280.dmg"
class ActivePerl56(ActivePerlLanguage):
    version_str = "5.6"
    # Internal URL.
    download_url = "http://lang.nas.activestate.com/ActivePerl/goldbits/5.6.1.638/ActivePerl-5.6.1.638-i686-linux.tar.gz"
    def checkSupported(self):
        if sys.platform.startswith("linux") and os.uname()[4] == "x86_64":
            # Perl 5.6 only supports x86.
            raise InstallWarning("Not supported for x86_64 architectures")

#---- ActiveTcl

class ActiveTclLanguage(Language):
    name = "activetcl"
    @property
    def install_dir(self):
        if sys.platform == "darwin":
            # Global install.
            return "/System/Library/Frameworks/Tcl.framework/Versions/%s" % (self.major_dot_minor_as_str, )
        return super(ActiveTclLanguage, self).install_dir
    @property
    def install_bin_dir(self):
        if sys.platform == "darwin":
            return self.install_dir
        return super(ActiveTclLanguage, self).install_bin_dir
    def extract(self):
        if sys.platform == "darwin":
            return # Already built as .dmg files
        return Language.extract(self)
    def build(self):
        pass # Already built
    def install(self):
        if sys.platform == "darwin":
            self._run(["/usr/bin/hdiutil", "attach", self.pkg_archive_filepath], cwd=os.curdir)
            import time
            time.sleep(5)
            self._run(["/usr/bin/open", "/Volumes/ActiveTcl-%s" % (self.major_dot_minor_as_str)], cwd=os.curdir)
            time.sleep(5)
        else:
            # Ack - a GUI installer!
            self._run(["./install.sh", "--directory", self.install_dir])
    def modules(self):
        self._run([join(self.install_bin_dir, "teacup"), "install", "base64"], cwd=os.curdir)
        self._run([join(self.install_bin_dir, "teacup"), "install", "uri"], cwd=os.curdir)

class ActiveTcl86(ActiveTclLanguage):
    version_str = "8.6.0"
    download_url_linux_x86 = "http://lang.nas/ActiveTcl/GoldBits/2013-10-03-8.6.1.0_RC1/ActiveTcl8.6.1.0.297577-linux-ix86-threaded.tar.gz"
    download_url_linux_x86_64 = "http://lang.nas/ActiveTcl/GoldBits/2013-10-03-8.6.1.0_RC1/ActiveTcl8.6.1.0.297577-linux-x86_64-threaded.tar.gz"
    download_url_darwin = "http://lang.nas/ActiveTcl/GoldBits/2013-10-03-8.6.1.0_RC1/ActiveTcl8.6.1.1.297588-macosx10.5-i386-x86_64-threaded.dmg"
class ActiveTcl85(ActiveTclLanguage):
    version_str = "8.5.13.0"
    download_url_linux_x86 = "http://lang.nas/ActiveTcl/GoldBits/2013-10-03-8.5.15.0_RC2/ActiveTcl8.5.15.0.297577-linux-ix86-threaded.tar.gz"
    download_url_linux_x86_64 = "http://lang.nas/ActiveTcl/GoldBits/2013-10-03-8.5.15.0_RC2/ActiveTcl8.5.15.0.297577-linux-x86_64-threaded.tar.gz"
    download_url_darwin = "http://lang.nas/ActiveTcl/GoldBits/2013-10-03-8.5.15.0_RC2/ActiveTcl8.5.15.1.297588-macosx10.5-i386-x86_64-threaded.dmg"
class ActiveTcl84(ActiveTclLanguage):
    version_str = "8.4.19.6"
    download_url_linux_x86 = "http://downloads.activestate.com/ActiveTcl/releases/8.4.19.6/ActiveTcl8.4.19.6.295590-linux-ix86.tar.gz"
    download_url_linux_x86_64 = "http://downloads.activestate.com/ActiveTcl/releases/8.4.19.6/ActiveTcl8.4.19.6.295590-linux-x86_64.tar.gz"
    download_url_darwin = "http://downloads.activestate.com/ActiveTcl/releases/8.4.19.6/ActiveTcl8.4.19.6.295590-macosx-universal-threaded.dmg"

#---- Node.js

class NodejsLanguage(Language):
    name = "nodejs"
    @property
    def download_url_darwin(self):
        return "http://nodejs.org/dist/v%s/node-v%s-darwin-x64.tar.gz" % \
               (self.version_str, self.version_str)
    @property
    def download_url_linux_x86_64(self):
        return "http://nodejs.org/dist/v%s/node-v%s-linux-x64.tar.gz" % \
               (self.version_str, self.version_str)
    @property
    def download_url_linux_x86(self):
        return "http://nodejs.org/dist/v%s/node-v%s-linux-x86.tar.gz" % \
               (self.version_str, self.version_str)
    def build(self):
        pass # Already built
    def install(self):
        shutil.move(self.src_working_dir, self.install_dir)

class Nodejs010(NodejsLanguage):
    version_str = "0.10.5"
class Nodejs08(NodejsLanguage):
    version_str = "0.8.23"
class Nodejs06(NodejsLanguage):
    version_str = "0.6.21"

class NodejsLanguageFromSource(Language):
    name = "nodejs"
    @property
    def download_url(self):
        return "http://nodejs.org/dist/v%s/node-v%s.tar.gz" % (self.version_str, self.version_str)

class Nodejs010FromSource(NodejsLanguageFromSource):
    version_str = "0.10.5"
class Nodejs08FromSource(NodejsLanguageFromSource):
    version_str = "0.8.23"
class Nodejs06FromSource(NodejsLanguageFromSource):
    version_str = "0.6.21"

# ==== Helper Methods ==== #

def unzip_file_into_dir(pkg_path, dst_dir):
    dst_dir = os.path.abspath(dst_dir)
    if not os.path.exists(dst_dir):
        os.mkdir(dst_dir, 0777)
    zfobj = zipfile.ZipFile(pkg_path)
    for name in zfobj.namelist():
        path = os.path.join(dst_dir, name)
        # Check the parent directory exists - make it when it doesn't.
        parent_path = os.path.dirname(path)
        mkdir_paths = []
        while not os.path.exists(parent_path):
            mkdir_paths.append(parent_path)
            parent_path = os.path.dirname(parent_path)
        for parent_path in reversed(mkdir_paths):
            os.mkdir(parent_path, 0777)

        if path.endswith('/'):
            os.mkdir(path)
        else:
            file(path, 'wb').write(zfobj.read(name))


def install_languages(languages):
    results = []
    # Install.
    for lang in languages:
        try:
            lang.make()
            results.append((lang, None))
        except Exception, ex:
            lang.log.exception(ex)
            results.append((lang, ex))
        except KeyboardInterrupt:
            results.append((lang, "Interrupted"))
            break

    # Ansi color settings.
    bold_on = sys.platform.startswith("win") and "" or "\x1B[1m"
    bold_off = sys.platform.startswith("win") and "" or "\x1B[22m"
    color_green = sys.platform.startswith("win") and "" or "\x1B[32m"
    color_red = sys.platform.startswith("win") and "" or "\x1B[31m"
    color_cyan = sys.platform.startswith("win") and "" or "\x1B[36m"
    color_off = sys.platform.startswith("win") and "" or "\x1B[39m"

    # Print the paths.
    print ""
    for lang, exception in results:
        if exception is None:
            assert exists(lang.install_bin_dir), "Bin dir does not exist: %r" % (lang.install_bin_dir, )
            print "export PATH=$PATH:%s" % (lang.install_bin_dir, )
    print ""

    # Print the installation results.
    print "Results:"
    for lang, exception in results:
        if exception is None:
            print "  %s%-12s %sOK%s%s" % (bold_on, lang.pkg_name, color_green, 
                                       color_off, bold_off)
        elif isinstance(exception, InstallWarning):
            print "  %s%-12s %sWarning%s%s - %s" % (bold_on, lang.pkg_name,
                                       color_cyan, color_off, bold_off, exception.msg)
        elif isinstance(exception, InstallException):
            print "  %s%-12s %sError%s%s - %s" % (bold_on, lang.pkg_name,
                                       color_red, color_off, bold_off, exception.msg)
            if exception.stderr:
                stderr = "    " + "\n    ".join(exception.stderr.split("\n"))
                print stderr
        else:
            print "  %s%-12s %sError%s%s - %s" % (bold_on, lang.pkg_name,
                                       color_red, color_off, bold_off, exception)

# ==== Main ==== #

def main():
    if not exists(g_temp_working_dir):
        os.makedirs(g_temp_working_dir)

    install_languages([
        # PHP
        PHP56(),
        PHP55(),
        PHP54(),
        PHP53(),
        PHP52(),
        PHP51(),
        PHP50(),
        PHP44(),
        # Python
        Python34(),
        Python33(),
        Python32(),
        Python31(),
        Python27(),
        Python26(),
        Python25(),
        Python24(),
        # Ruby
        Ruby21(),
        Ruby20(),
        Ruby19(),
        Ruby18(),
        # Perl
        ActivePerl516(),
        ActivePerl514(),
        ActivePerl512(),
        ActivePerl510(),
        ActivePerl58(),
        ActivePerl56(),
        # Tcl
        ActiveTcl85(),
        ActiveTcl84(),
        # Node.js
        Nodejs010(),
        Nodejs08(),
        #Nodejs06(),
        # Some older platforms don't support the precompiled node versions, so
        # you can also use the from source versions.
        #Nodejs010FromSource(),
        #Nodejs08FromSource(),
        Nodejs06FromSource(),
       ])

if __name__ == '__main__':
    if len(sys.argv) > 1:
        # Install a given language.
        symbols = globals()
        languages = []
        for name in sys.argv[1:]:
            if name in symbols:
                # Instantiate an instance of the given class.
                languages.append(symbols[name]())
            else:
                raise RuntimeError("Unknown class name %r" % (name, ))
        install_languages(languages)
    else:
        main()
