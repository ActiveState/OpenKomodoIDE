#!/usr/bin/env python
# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import sys, os, re, string, stat
import tempfile
from xpcom import components, ServerException, COMException, nsError
from xpcom.server import UnwrapObject
import process
import koprocessutils
import logging

log = logging.getLogger('koPHPConfigurator')
#log.setLevel(logging.DEBUG)
#---- components
                   
class _PHPConfigException(Exception):
    pass

class koPHPConfigurator:
    _com_interfaces_ = [components.interfaces.koIPHPConfigurator]
    _reg_clsid_ = "2C8CD9F6-DDF4-44e8-89E7-D8B26F42BE26"
    _reg_contractid_ = "@activestate.com/koPHPConfigurator;1"
    _reg_desc_ = "PHP Debugger Configurator"

    def _make_full_version(self,version):
        return '.'.join(version.split('.',2)[:2])

    def _configureDebugger(self, phpInfoEx, inipath, extensiondir=None):
        log.debug('_configureDebugger:: inipath: %r', inipath)
        log.debug('_configureDebugger:: extensiondir: %r', extensiondir)
        executable = phpInfoEx.executablePath
        log.debug('_configureDebugger:: php executable: %r', executable)
        if not executable:
            msg = 'Could not locate any PHP binaries'
            log.warn(msg)
            return msg
        oldini = phpInfoEx.cfg_file_path
        log.debug('_configureDebugger:: oldini: %r', oldini)
        import shutil
        if not os.path.exists(executable):
            msg = 'Executable path %s does not exist' % executable
            log.warn(msg)
            return msg
        if oldini and not os.path.isfile(oldini):
            # we have a directory, check for php.ini inside it
            oldini = os.path.join(oldini, "php.ini")
            if not os.path.isfile(oldini):
                log.warn('INI path %s does not exist' % oldini)
                oldini = None

        # get the version so we can figure out
        # which extension to install
        versionText = phpInfoEx.version
        log.debug('_configureDebugger:: versionText: %r', versionText)
        if not versionText:
            msg = 'Unable to retrieve PHP version'
            log.warn(msg)
            return msg
        version = self._make_full_version(versionText)
        log.debug('_configureDebugger:: version: %r', version)
        if not version:
            msg = 'Unable to retrieve PHP version [',versionText,'].'
            log.warn(msg)
            return msg
        
        # build the path to the extension in komodo/php
        koDirSvc = components.classes["@activestate.com/koDirs;1"]\
                         .getService(components.interfaces.koIDirs)
        koSupportDir = koDirSvc.supportDir
        phpDebuggingDir = os.path.join(koSupportDir, 'php', 'debugging')
        # XXX only windows and linux supported here!
        phpBuildInfo = source_extension = None
        version_parts = []
        for part_name in re.compile(r'[\D]+').split(versionText):
            try:
                version_parts.append(int(part_name))
            except ValueError:
                log.exception("Couldn't convert part_name:%s to an int",
                              part_name)
                break
        is5_3_0_or_newer = tuple(version_parts) >= (5, 3, 0)
        if sys.platform.startswith('win'):
            extensionname = 'php_xdebug.dll'
            is5_2_0_or_newer = tuple(version_parts) >= (5, 2, 0)
            if is5_2_0_or_newer:
                # Get build info to look for the correct build of xdebug
                # No need to convert to json, then unconvert
                phpBuildInfo = UnwrapObject(phpInfoEx).get_phpBuildInfo(nojson=True)
                compiler = phpBuildInfo.get('compiler')
                sub_dir = None
                try:
                    # Normalize the output from phpBuildInfo
                    if compiler is None and tuple(version_parts[:2]) == (5, 2):
                        # PHP 5.2 doesn't have a compiler or architecture
                        # sections, so we add them in now with the defaults.
                        phpBuildInfo['compiler'] = 'vc6'
                        if phpBuildInfo.get('architecture') is None:
                            phpBuildInfo['architecture'] = 'x86'
                    elif compiler.startswith("MSVC"):
                        # Example: "MSVC11 "
                        phpBuildInfo['compiler'] = 'vc' + compiler.split()[0][4:]
                    else:
                        raise _PHPConfigException("Unexpected compiler: %s" %
                                                  compiler)
                    if phpBuildInfo.get('threadSafety'):
                        phpBuildInfo['threadSafety'] = "ts"
                    else:
                        phpBuildInfo['threadSafety'] = "nts"
                    arch = phpBuildInfo['architecture'] = phpBuildInfo['architecture'].lower()
                    if arch not in ('x86', 'x64'):
                        raise _PHPConfigException("Unexpected architecture: %s" %
                                                  arch)
                    sub_dir = "%(threadSafety)s-%(compiler)s-%(architecture)s" % phpBuildInfo
                    source_extension = os.path.join(phpDebuggingDir,
                                                    version,
                                                    sub_dir,
                                                    extensionname)
                    if not os.path.exists(source_extension):
                        raise _PHPConfigException("No such file: %s" %
                                                  (source_extension,))
                except _PHPConfigException, ex:
                    log.error(ex.message)
                    # Go do the pre-ko-5.2 method of finding ver/php_xdebug.dll
        else:
            extensionname = 'xdebug.so'

        if not source_extension:
            source_extension = os.path.join(phpDebuggingDir,
                                            version,
                                            extensionname)
            if not os.path.exists(source_extension):
                msg = 'Debugger extension for PHP version %s (path %s) is not available.' % (versionText, source_extension)
                log.warn(msg)
                return msg
        log.debug('_configureDebugger:: source_extension: %r', source_extension)

        # copy the old ini to the debug location
        try:
            if not os.path.isdir(inipath):
                os.makedirs(inipath)
        except:
            msg = 'Unable to make directory [%s]' %inipath
            log.warn(msg)
            return msg
        if len(inipath) < 7 or inipath[-7:] != 'php.ini':
            ininame = os.path.join(inipath,'php.ini')
        else:
            ininame = inipath
        log.debug('_configureDebugger:: ininame: %r', ininame)
        contents = ""
        if oldini:
            log.debug('_configureDebugger:: basing ini on contents from oldini')
            try:
                ini = open(oldini)
                contents = ini.read()
                ini.close()
            except:
                msg = 'Unable to read ini at [%s]' % oldini
                log.warn(msg)
                return msg

        # modify the ini file contents
        # remove previous configurations of xdebug
        # disable any other zend extensions, they tend to interfere with debuggers
        # these are not normal php extensions
        # remove old activedebug stuff
        contents=re.compile(r'^\s*(xdebug|zend_extension|extension=activedebug|activedebug|cgi.force_redirect)',
                            flags=re.MULTILINE) \
                   .sub(r';\1', contents)
        if not extensiondir:
            extensiondir = phpDebuggingDir
            extensionFilePath = source_extension
        else:
            extensionFilePath = os.path.join(extensiondir, extensionname)

        # As of 5.3, the _ts variant is no longer used.
        # For older versions, PHP doesn't say whether it's threaded or not,
        # so write both in.  PHP will ignore the "wrong" one.
        # http://uk3.php.net/manual/en/migration53.ini.php
        zend_extension_lines = """; xdebug config added by Komodo
zend_extension="%s"
""" % extensionFilePath
        if not is5_3_0_or_newer:
            zend_extension_lines += """zend_extension_ts="%s"
""" % extensionFilePath
        newcontents = (zend_extension_lines
                       +
"""xdebug.remote_enable=1
xdebug.remote_handler=dbgp
xdebug.remote_mode=req
xdebug.remote_port=9000
cgi.force_redirect = 0
"""
                       + contents)
        
        try:
            ini = open(ininame,'w+')
            ini.write(newcontents)
            ini.close()
            if sys.platform[:3] != 'win':
                os.chmod(ininame,0644)
        except:
            msg = 'Unable to write ini at [%s]' % inipath
            log.warn(msg)
            return msg
        log.debug('_configureDebugger:: new ini written: %r', ininame)

        # copy the debugger extension to the extension dir
        if extensiondir != phpDebuggingDir:
            try:
                if not os.path.isdir(extensiondir):
                    os.makedirs(extensiondir)
            except:
                msg = 'Unable to create directory [%s]' % extensiondir
                log.warn(msg)
                return msg
            dest = os.path.join(extensiondir,extensionname)
            try:
                shutil.copyfile(source_extension,dest)
                if sys.platform[:3] != 'win':
                    os.chmod(dest,0755)
            except:
                msg = 'Unable to copy [%s] to [%s]'%(source_extension,dest)
                log.warn(msg)
                return msg
        
        phpInfoEx.cfg_file_path = inipath
        # validate that this all worked!
        if phpInfoEx.isDebuggerExtensionLoadable:
            return ''
        # This message assumed by wizard_php.p.js::_installing_Install
        msg = 'PHP is configured, but was unable to load the debugger extension at [%s]' % extensionFilePath
        log.warn(msg)
        return msg

    def configureDebugger(self, executable, oldini, inipath, extensiondir):
        # I want a seperate instance of infoex, since we'll be doing some
        # extra special stuff.
        phpInfoEx = components.classes['@activestate.com/koPHPInfoInstance;1'].\
                    createInstance(components.interfaces.koIPHPInfoEx);
        phpInfoEx.executablePath = executable
        phpInfoEx.cfg_file_path = oldini
        return self._configureDebugger(phpInfoEx, inipath, extensiondir)

    def configureDebuggerEx(self, phpInfoEx, inipath, extensiondir):
        if phpInfoEx.isDebuggerExtensionLoadable:
            return ''
        return self._configureDebugger(phpInfoEx, inipath, extensiondir)

    def autoConfigure(self, phpInfoEx):
        if phpInfoEx.isDebuggerExtensionLoadable:
            log.debug("...autoConfigure already configured")
            return ''
        # build the path to the extension in komodo/php
        koDirSvc = components.classes["@activestate.com/koDirs;1"]\
                         .getService(components.interfaces.koIDirs)
        try:
            phpVersion = phpInfoEx.version
        except:
            log.error("koPHPConfigurator.autoConfigure: failed to get php version\n   (possibly no PHP interpreter has been specified)")
            return
        inipath = os.path.join(koDirSvc.userDataDir, "php", phpVersion)
        log.debug("PHP autoConfigure try configure with inipath %s", inipath)
        err = self._configureDebugger(phpInfoEx, inipath)
        if not err:
            phpInfoEx.cfg_file_path = inipath
        return err
