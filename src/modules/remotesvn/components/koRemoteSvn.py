#!python 
# Copyright (c) 2007 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
import sys
import re
import time
import logging

from xpcom import components, COMException
from xpcom.server import WrapObject, UnwrapObject

from URIlib import URIParser
import uriparse
import koprocessutils
from koAsyncOperationUtils import koAsyncOperationBase

# Special hack necessary to import the "pylib" directory. See bug:
# http://bugs.activestate.com/show_bug.cgi?id=74925
old_sys_path = sys.path[:]
pylib_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "..", "pylib")
sys.path.append(pylib_path)
import svnremotelib
sys.path = old_sys_path

log = logging.getLogger("koRemoteSvn")
#log.setLevel(logging.DEBUG)

_remoteConnectionService = None

def getRemoteSSHConnectionForUri(uri):
    global _remoteConnectionService
    # Must work out the remote ssh settings first
    try:
        if _remoteConnectionService is None:
            _remoteConnectionService = components.classes["@activestate.com/koRemoteConnectionService;1"].\
                getService(components.interfaces.koIRemoteConnectionService)

        log.debug("getRemoteSSHConnectionForUri:: %r", uri)
        conn = _remoteConnectionService.getConnectionUsingUri(uri)
        if conn:
            # Ensure it's a SSH connection
            conn.QueryInterface(components.interfaces.koISSHConnection)
        return conn
    except COMException:
        lastErrorSvc = components.classes["@activestate.com/koLastErrorService;1"]\
                            .getService(components.interfaces.koILastErrorService)
        raise svnremotelib.SVNLibError(lastErrorSvc.getLastError())



#---- support routines

def _unique(s):
    """Return a list of the elements in s, in arbitrary order, but without
    duplicates. (_Part_ of the Python Cookbook recipe.)
    """
    # get the special case of an empty s out of the way, very rapidly
    n = len(s)
    if n == 0:
        return []

    # Try using a dict first, as that's the fastest and will usually work.
    u = {}
    try:
        for x in s:
            u[x] = 1
    except TypeError:
        del u  # move on to the next method
    else:
        return u.keys()

def _splitall(path):
    """Split the given path into all its directory parts and return the list
    of those parts (see Python Cookbook recipe for test suite.
    """
    allparts = []
    while 1:
        parts = os.path.split(path)
        if parts[0] == path:  # sentinel for absolute paths
            allparts.insert(0, parts[0])
            break
        elif parts[1] == path: # sentinel for relative paths
            allparts.insert(0, parts[1])
            break
        else:
            path = parts[0]
            allparts.insert(0, parts[1])
    return allparts

def _commonprefix(paths):
    """An os.path.commonprefix() more suited to actual paths.
    
    It returns the common path prefix of the given paths or None, if there
    is no such common prefix.
    """
    if not paths:
        return None
    splitpaths = [_splitall(path) for path in paths]
    commonprefix = []
    for set in zip(*splitpaths):
        # This path element is part of the common prefix if it is the same
        # for every give path.
        elem = set[0]
        if sys.platform.startswith("win"):
            # Case-insensitive comparison on Windows.
            set = [p.lower() for p in set]
        if len(_unique(set)) == 1:
            commonprefix.append(elem)
        else:
            break
    if commonprefix:
        retval = os.path.join(*commonprefix)
    else:
        retval = None
    #print "_commonprefix(%r) == %r" % (paths, retval)
    return retval

# similar to listcmd.line2argv, but we keep quotes around arguments
def line2argv(line):
    line = line.strip()
    argv = []
    state = "default"
    arg = None  # the current argument being parsed
    i = -1
    WHITESPACE = '\t\n\x0b\x0c\r '  # don't use string.whitespace (bug 81316)
    while 1:
        i += 1
        if i >= len(line): break
        ch = line[i]
        
        if ch == "\\": # escaped char always added to arg, regardless of state
            if arg is None: arg = ""
            i += 1
            arg += line[i]
            continue
        
        if state == "single-quoted":
            if ch == "'":
                state = "default"
            arg += ch
        elif state == "double-quoted":
            if ch == '"':
                state = "default"
            arg += ch
        elif state == "default":
            if ch == '"':
                if arg is None: arg = ""
                state = "double-quoted"
                arg += ch
            elif ch == "'":
                if arg is None: arg = ""
                state = "single-quoted"
                arg += ch
            elif ch in WHITESPACE:
                if arg is not None:
                    argv.append(arg)
                arg = None
            else:
                if arg is None: arg = ""
                arg += ch
    if arg is not None:
        argv.append(arg)
    if state != "default":
        raise ValueError("command line is not terminated: unfinished %s "
                         "segment" % state)
    return argv

def _argvFromString(options):
    options = line2argv(options)
    argv = {}
    last = None
    for o in options:
        if o[0]=='-':
            last = str(o.replace('-','_'))
            if last[0] == '_': last = last[1:]
            if last[0] == '_': last = last[1:]
            argv[last]=1
        elif last:
            argv[last] = o
    return argv

#---- component implementation

class KoSVNRemote:
    # Satisfy koISCC.name
    name = "svn_remote"
    _com_interfaces_ = [components.interfaces.koISCC,
                        components.interfaces.nsIObserver]
    _reg_desc_ = "Komodo Remote SVN Support"
    _reg_contractid_ = "@activestate.com/koSCC?type=" + name + ";1"
    _reg_clsid_ = "{701d3471-dd08-407c-aea9-63d9868979ca}"
    _reg_categories_ = [
         ("category-komodo-scc", name),
         ]

    def __init__(self):
        # generic cvs instance to do work with
        self.svn = svnremotelib.SVNRemote()
        self._observerSvc = components.classes["@mozilla.org/observer-service;1"].\
            getService(components.interfaces.nsIObserverService)
        self.lastErrorSvc = components.classes["@activestate.com/koLastErrorService;1"]\
                       .getService(components.interfaces.koILastErrorService)
        self.fileStatusSvc = components.classes["@activestate.com/koFileStatusService;1"].\
                getService(components.interfaces.koIFileStatusService);
        self._globalPrefs = components.classes["@activestate.com/koPrefService;1"].\
            getService(components.interfaces.koIPrefService).prefs
        self._globalPrefs.prefObserverService.addObserver(WrapObject(self,components.interfaces.nsIObserver),'svnExecutable',0)
        self._encodingSvc = components.classes['@activestate.com/koEncodingServices;1'].\
                                getService(components.interfaces.koIEncodingServices)
        self._env = koprocessutils.getUserEnv()
        self._userPath = self._env["PATH"].split(os.pathsep)
        self.fileSvc = components.classes["@activestate.com/koFileService;1"].\
                getService(components.interfaces.koIFileService);

        self.reasonNotFunctional = None
        self.isFunctional = None
        self._executable = None
        self.set_executable(None)
        self._setExecutableFromPrefs()
        self.redetermineIfFunctional()
    
    def observe(self, subject, topic, value):
        if topic == 'svnExecutable':
            self._setExecutableFromPrefs()
            
    def _setExecutableFromPrefs(self):
        executable = None
        if self._globalPrefs.hasPref('svnExecutable'):
            executable = self._globalPrefs.getStringPref('svnExecutable')
        if not executable or self._executable != executable:
            self.set_executable(executable)
            try:
                self._observerSvc.notifyObservers(self, 'subsystem_changed', 'svn')
            except COMException:
                pass # Ignore error if there is no observer.
    
    def _findExecutable(self):
        import which
        try:
            if sys.platform.startswith('win'):
                exts = ['.exe']
            else:
                exts = None
            svn = which.which('svn', exts=exts, path=self._userPath)
        except which.WhichError:
            svn = None
        return svn

    def set_executable(self, executable):
        if executable:
            self._executable = executable
        else:
            self._executable = self._findExecutable()
        if self._executable and os.path.exists(self._executable):
            self.svn.svn = self._executable
        
    def get_executable(self):
        if not self._executable:
            self._setExecutableFromPrefs()
        return self._executable
        
    def redetermineIfFunctional(self):
        if not self._executable:
            svn = self._findExecutable()
        elif os.path.exists(self._executable):
            svn = self._executable
        else:
            svn = None
        
        if svn is None:
            self.isFunctional = 0
            self.reasonNotFunctional = "no 'svn' executable could be found"
        else:
            self.isFunctional = 1
            self.reasonNotFunctional = None
        try:
            self._observerSvc.notifyObservers(self, 'subsystem_changed', 'svn')
        except COMException:
            pass # Ignore error if there is no observer.

    def _splitFile(self, file):
        # figure out what repositories files are in
        # and split them up into seperate lists
        # we also convert to local paths here
        uri_obj = URIParser(file)
        path = uri_obj.path
        if path:
            #if os.path.isdir(path):
            #    return path,''
            #path = os.path.normpath(path)
            basedir = os.path.dirname(path)
            filename = os.path.basename(path)
            return basedir, filename
        return None,None
    
    # Somewhat different to svnlib's _splitFiles, this returns a dict
    # with items matching basedir: [(file, uri), ...]
    def _splitFiles(self, files):
        # figure out what repositories files are in
        # and split them up into seperate lists
        # we also convert to local paths here
        _files = {}
        for file in files:
            basedir,filename = self._splitFile(file)
            if basedir:
                if not basedir in _files:
                    _files[basedir] = []
                _files[basedir].append((filename, file))
        return _files
    
    def _convertFiles(self, files):
        _files = []
        for file in files:
            uri_obj = URIParser(file)
            path = uri_obj.path
            _files.append(path)
        return _files
    
    # Regex used to update the "Index: xyz..." to have a full path reference
    diffUpdatePathRegex = re.compile("^Index: ", re.MULTILINE)

#    diff -- Display diff of client file with depot file
    def _do_diff(self, files, options, external, svn=None):
        #print "svn diff ",repr(files)
        _files = self._splitFiles(files)
        # convert options into a dictionary
        options = _argvFromString(options)
        if external:
            options['diff_cmd'] = external
        if 'env' not in options:
            options['env'] = self._env
        if svn is None:
            svn = self.svn

        diff = ''
        for basedir, files in _files.items():
            #print "files %r basedir %r" %(files, basedir)
            options["remote"] = None
            for f, uri in files:
                if options.get("remote") is None:
                    options["remote"] = getRemoteSSHConnectionForUri(uri)
                result, raw = self.svn.diff(f,
                                           _raw=1,
                                           cwd=basedir,
                                           **options)
                raw_stderr = raw.get('stderr')
                if raw_stderr:
                    # XXX - Should we be always raising an exception, or can some
                    #       stderr warnings trickle through on a sucessful diff?
                    raise svnremotelib.SVNLibError(raw_stderr)
                if 'stdout' in raw:
                    replaceStr = "Index: %s%s" % (os.path.abspath(basedir), os.sep)
                    # Need to escape all the backslashes (Notably on Windows). See bug:
                    # http://bugs.activestate.com/show_bug.cgi?id=65911
                    replaceStr = replaceStr.replace("\\", "\\\\")
                    diff += self.diffUpdatePathRegex.sub(replaceStr,
                                                         raw['stdout'])

        # Convert line-endings to the currently expected
        import eollib
        eolpref = self._globalPrefs.getStringPref('endOfLine')
        try:
            desiredEOL = eollib.eolPref2eol[eolpref]
        except KeyError:
            desiredEOL = eollib.EOL_PLATFORM
        diff = eollib.convertToEOLFormat(diff, desiredEOL)

        # Try encoding it with komodo's unicode encoding service
        diff, encoding, bom = self._encodingSvc.getUnicodeEncodedString(diff)

        return diff

    def diff(self, files, options, external, async_callback):
        return runSvnCommandAsynchronously("diff", self, self._do_diff,
                                           files, False, async_callback,
                                           files, options, external)

    # Diff two revisions of the given file
    def diffRevisions(self, fileuri1, rev1, fileuri2, rev2, localfilepath,
                      options, external, svn=None):
        #print "svn diffRevisions ", repr(fileuri1), rev1, rev2
        revOptions = []
        if rev1:
            if rev2:
                revOptions.append("--revision %s:%s" % (rev1, rev2))
            else:
                revOptions.append("--revision %s" % (rev1))
        elif rev2:
            revOptions.append("--revision %s" % (rev2))
        revOptions = " ".join(revOptions)
        if options:
            options += " %s" % (revOptions)
        else:
            options = revOptions
        #print "options:", options
        remoteConnection = getRemoteSSHConnectionForUri(localfilepath)
        return self.diff([fileuri1], options, external, remote=remoteConnection)

#    log -- List revision history of file
#
    def _do_history(self, fileuri, options, svn=None):
        #print "svn log ", options, repr(fileuri)
        # ,cwd=basedir
        basedir, filename = self._splitFile(fileuri)

        options = _argvFromString(options)
        if 'env' not in options:
            options['env'] = self._env
        if svn is None:
            svn = self.svn
        options["remote"] = getRemoteSSHConnectionForUri(fileuri)

        result, raw = self.svn.log(filename,
                                   _raw=1,
                                   cwd=basedir,
                                   **options)

        if result is None:
            raise svnremotelib.SVNLibError("No history results were found.")

        rawerror = raw.get('stderr', "")
        if rawerror:
            # There was some type of error
            raise svnremotelib.SVNLibError(rawerror)

        # result:
        # Returns a list of hits. Each hit is a dict with the following:
        # keys: 'revision', 'date', 'author', 'message'.
        # Now, split up the history rows

        koHistoryList = []
        #print result
        for revision in result:
            koHistory = components.classes["@activestate.com/koSCCHistoryItem;1"].\
                            createInstance(components.interfaces.koISCCHistoryItem);
            koHistory.version = str(revision['revision'])
            koHistory.author  = revision['author']
            koHistory.date    = revision['date']
            koHistory.action  = ''  # No action given
            koHistory.message = revision['message']
            koHistory.uri     = fileuri
            koHistoryList.append(koHistory)
        return koHistoryList

    def history(self, fileuri, options, async_callback):
        # Don't need to lock the files
        return runSvnCommandAsynchronously("history", self, self._do_history,
                                           [fileuri], False, async_callback,
                                           fileuri, options)

#    add -- Open a new file to add it to the depot
    def _do_add(self, files, mode, message, svn=None):
        #add(self, files, mode=None, msg=None, cwd=None)
        # first we figure out what repositories files are in
        # and split them up into seperate lists
        # we init the cvs object with the root we retreived
        _files = self._splitFiles(files)
        output = ''
        for basedir, file_items in _files.items():
            # , filetype=mode, msg=message, cwd=basedir
            remoteConnection = getRemoteSSHConnectionForUri(file_items[0][1])
            result, raw = self.svn.add(files=[f[0] for f in file_items],
                                       _raw=1, cwd=basedir,
                                       env=self._env,
                                       remote=remoteConnection)
            if 'stderr' in raw:
                output += raw['stderr']
            if 'stdout' in raw:
                output += raw['stdout']
            
        # do notification that status may have changed
        # we have to use the original urls passed in since
        # they are modified to local paths in _splitFiles
        for file in files:
            if file: self._observerSvc.notifyObservers(self, 'file_status_now', file)
        return output

    def add(self, files, mode, message, async_callback=None):
        return runSvnCommandAsynchronously("add", self, self._do_add,
                                           files, False, async_callback, files,
                                           mode, message)

#    submit -- Submit open files to the depot
    def _do_commit(self, files, message, options, svn=None):
        #print "cvs commit ",repr(files)
        # svnremotelib saves message to a message for file

        # XXX - This file needs to be on the remote server!
        msgfile = self.fileSvc.makeTempFile('.svn','w')
        msgfile.puts(message)
        msgfile.flush()
        msgfile.close()
        msgpath = msgfile.path
        try:
            _split = self._splitFiles(files)
            _files = self._convertFiles(files)
            basedir = _commonprefix(_split.keys())
            if svn is None:
                svn = self.svn
            output = ''
            remoteConnection = getRemoteSSHConnectionForUri(files[0])
            result, raw = self.svn.commit(_files,
                                         file=msgpath,
                                         _raw=1,
                                         cwd=basedir,
                                         env=self._env,
                                         remote=remoteConnection)
    
            raw_stderr = raw.get('stderr')
            if raw_stderr:
                # XXX - Should we be always raising an exception, or can some
                #       stderr warnings trickle through on a sucessful commit?
                raise svnremotelib.SVNLibError(raw_stderr)
            if 'stdout' in raw:
                output += raw['stdout']
            
            for file in files:
                self._observerSvc.notifyObservers(self, 'file_status_now', file)
            return output
        finally:
            del msgfile

    def commit(self, files, message, options, async_callback=None):
        return runSvnCommandAsynchronously("commit", self, self._do_commit,
                                           files, True, async_callback, files,
                                           message, options)
    
#    delete -- Open an existing file to delete it from the depot
    def _do_remove(self, files, force, recursive, svn=None):
        _files = self._splitFiles(files)
        output = ''
        for basedir, file_items in _files.items():
            # , force, recursive,cwd=basedir
            remoteConnection = getRemoteSSHConnectionForUri(file_items[0][1])
            result, raw = self.svn.delete([f[0] for f in file_items],
                                          _raw=1, cwd=basedir,
                                          env=self._env,
                                          remote=remoteConnection)
            if raw_stderr:
                raise svnlib.SVNLibError(raw_stderr)
            if 'stdout' in raw:
                output += raw['stdout']
            
        for file in files:
            self._observerSvc.notifyObservers(self, 'file_status_now', file)
        return output

    def remove(self, files, force, recursive, async_callback):
        return runSvnCommandAsynchronously("remove", self, self._do_remove,
                                           files, True, async_callback, files,
                                           force, recursive)

#    sync -- Synchronize the client with its view of the depot
    def _do_update(self, files, options, svn=None):
        _files = self._splitFiles(files)
        output = ''
        for basedir, file_items in _files.items():
            # ,cwd=basedir
            remoteConnection = getRemoteSSHConnectionForUri(file_items[0][1])
            result, raw = self.svn.update([f[0] for f in file_items],
                                          _raw=1,
                                          cwd=basedir,
                                          env=self._env,
                                          remote=remoteConnection)
            if 'stderr' in raw:
                # XXX - Raise exception?
                output += raw['stderr']
            if 'stdout' in raw:
                output += raw['stdout']
            
        for file in files:
            self._observerSvc.notifyObservers(self, 'file_status_now', file)
        
        return output

    def update(self, files, options, async_callback):
        return runSvnCommandAsynchronously("update", self, self._do_update,
                                           files, False, async_callback, files,
                                           options)

#    revert -- Discard changes from an opened file
    def _do_revert(self, files, options, svn=None):
        # XXX unfortunately this function requires knowledge of
        # item properties
        _files = self._splitFiles(files)
        output = ''
        for basedir, file_items in _files.items():
            remoteConnection = getRemoteSSHConnectionForUri(file_items[0][1])
            result, raw = self.svn.revert([f[0] for f in file_items],
                                          _raw=1,
                                          cwd=basedir,
                                          env=self._env,
                                          remote=remoteConnection)
            if 'stderr' in raw:
                self.lastErrorSvc.setLastError(0, str(raw['stderr']))
                output += raw['stderr']
            if 'stdout' in raw:
                output += raw['stdout']
            
        for file in files:
            self._observerSvc.notifyObservers(self, 'file_status_now', file)
        return output
    
    def revert(self, files, options, async_callback):
        return runSvnCommandAsynchronously("revert", self, self._do_revert,
                                           files, True, async_callback, files,
                                           options)

    def _do_edit(self, files, svn=None):
        return None

    def edit(self, files, async_callback):
        return runSvnCommandAsynchronously("edit", self, self._do_edit,
                                           files, False, async_callback, files)


class SvnAsyncOp(koAsyncOperationBase):

    def stop(self):
        # svn is a svnremotelib.SVN instance
        svn = self.kwargs.get('svn')
        if svn:
            self.status = components.interfaces.koIAsyncOperation.STATUS_STOPPING
            # XXX - need to implement svn.stop() to stop the process(es)
        else:
            koAsyncOperationBase.stop(self)

def runSvnCommandAsynchronously(cmd_name, svnSvc, run_function, affected_uris,
                                lock_the_uris, async_callback, *args, **kwargs):
    # Run asynchronously
    async_svc = components.classes["@activestate.com/koAsyncService;1"].\
                    getService(components.interfaces.koIAsyncService)
    # Create a new svn instance to ensure we don't have multiple scc
    # operations running on the same instance.
    svnlib_instance = svnremotelib.SVN()
    # Ensure the svnlib instance uses the same executable as the svn service.
    svnlib_instance.svn = svnSvc.svn.svn
    kwargs['svn'] = svnlib_instance
    async_op = SvnAsyncOp(run_function, *args, **kwargs)
    async_svc.run("SCC svn " + cmd_name, async_op, async_callback,
                  affected_uris, lock_the_uris)
    return async_op



from fileStatusUtils import KoSCCChecker

class koSvnRemoteFileChecker(KoSCCChecker):
    _com_interfaces_ = [components.interfaces.koIFileStatusChecker]
    _reg_clsid_ = "{e6f1041f-312e-4d96-a634-fa846cfe6d68}"
    _reg_contractid_ = "@activestate.com/koFileStatusChecker?type=svn-remote;1"
    _reg_desc_ = "Komodo Remote Subversion File Status Checker"
    _reg_categories_ = [
         ("category-komodo-file-status",      "svn-remote"),
         ]

    ranking_weight = 90

    def __init__(self, name="svn_remote"):
        KoSCCChecker.__init__(self, name)
        #self.log.setLevel(logging.DEBUG)
        self.svn = svnremotelib.SVNRemote()
        self.executablePrefName = ""
        self.enabledPrefName = 'svnremoteEnabled'
        self.executablePrefName = 'svnremoteExecutable'
        self.backgroundEnabledPrefName = 'svnremoteBackgroundCheck'
        self.backgroundDurationPrefName = 'svnremoteBackgroundMinutes'
        self.recursivePrefName = 'svnremoteRecursive'
        self._svnDirName = ".svn"
        self._sccRemote = 1
        self.enabled = 1
        self.setExecutable("svn")
        self._ensurePrefsExist()

    def _ensurePrefsExist(self):
        prefs = components.classes["@activestate.com/koPrefService;1"].\
            getService(components.interfaces.koIPrefService).prefs
        if not prefs.hasBooleanPref("svnremoteEnabled"):
            prefs.setBooleanPref("svnremoteEnabled", True)
        if not prefs.hasStringPref("svnremoteExecutable"):
            prefs.setStringPref("svnremoteExecutable", "svn")
        if not prefs.hasBooleanPref("svnremoteBackgroundCheck"):
            prefs.setBooleanPref("svnremoteBackgroundCheck", True)
        if not prefs.hasLongPref("svnremoteBackgroundMinutes"):
            prefs.setLongPref("svnremoteBackgroundMinutes", 15)
        if not prefs.hasBooleanPref("svnremoteRecursive"):
            prefs.setBooleanPref("svnremoteRecursive", False)

    def setExecutable(self, executable):
        if executable:
            self.executable = executable
        else:
            self.executable = self.svc.executable
        self.svn.svn = self.executable

    def _stripEmptyLines(self, message):
        _result = []
        for line in message.splitlines(0):
            if line:
                _result.append(line)
        return '\n'.join(_result) + "\n"

    def isSupportedFile(self, koIFile):
        self.log.debug("isSupportedFile: %r", koIFile.URI)
        if koIFile.isRemoteFile and koIFile.scheme in ("sftp", "scp"):
            return True
        return False

    # Remove any known SCC information for this path if:
    #  1) it's time to re-check this because of age
    #  2) the provided reason indicates we need fresh information
    # Returns true if the path was invalidated and thus should be checked
    #   koIFile - unwrapped koIFile XPCOM object
    # Note: On Windows, all path names must be lowered, because it's a case
    #       insensitive filesystem and we never can be sure which case styling
    #       will be used.
    def needsToReCheckFileStatus(self, koIFile, reason):
        # XXX - Need better test for this
        #if isinstance(koIFile, components.interfaces.koIFile):
        koIFile = UnwrapObject(koIFile)

        if not self.isSupportedFile(koIFile):
            return 0

        # If this file is already marked with a scc type,
        # we only need to re-check with the same checker.
        if ((koIFile.sccType and self.name != koIFile.sccType) or
            (koIFile.sccDirType and self.name != koIFile.sccDirType)):
            self.log.debug("Checker already set to another")
            return 0

        uri_cache_key = self._norm_uri_cache_key(koIFile.URI)
        self.log.debug("%s needsToReCheckFileStatus (reason=%r) uri: %r",
                       self.name, reason, uri_cache_key)

        if reason in (self.REASON_FORCED_CHECK,
                      self.REASON_FILE_CHANGED):
            force = True
        else:
            force = False

        diruri_cache_key = uri_cache_key
        if koIFile.isFile:
            diruri_cache_key = os.path.dirname(uri_cache_key)
        if not diruri_cache_key.endswith("/"):
            # Ensure it's compatible with nsURI.
            diruri_cache_key += "/"
        lastChecked = self._lastChecked.get(diruri_cache_key)
        if lastChecked is not None:
            if force or lastChecked < time.time() - self.backgroundDuration:
                self.log.debug("%s: removing cached info", self.name)
                # Remove the cache information, it's no longer valid
                self._lastChecked[diruri_cache_key] = 0
                self._cached_info.pop(uri_cache_key, None)
                return 1
            self.log.debug("%s: cached has not yet expired", self.name)
            return 0
        else:
            self.log.debug("%s: no cached info found", self.name)
        return 1

    def _cacheSCCInfo(self, cache, cache_key, path, sccInfo):
        self.log.debug("_cacheSCCInfo:: key: %r", cache_key)

        # It's important that the cached scc info contains exactly the same
        # keys as the 'koIFileEx.scc' object.
        koSccInfo = self.baseFileSCCInfo.copy()

        # XXX - Fix for remote paths.
        #onDisk = os.path.exists(path)
        onDisk = 1

        #{'History': ' ',
        # 'Last_Changed_Rev': '350',
        # 'Locked': ' ',
        # 'Name': 'asdf.txt',
        # 'URL': 'file',
        # 'Last Changed Date': '2004-12-07 14',
        # 'Switched': ' ',
        # 'Modified': ' ',
        # 'Repository UUID': 'a66e1112-37ea-0310-b8af-fdbad1884ccd',
        # 'reserved1': ' ',
        # 'Revision': '350',
        # 'Status': 'M',
        # 'reserved2': ' ',
        # 'Last_Changed_Author': 'shanec',
        # 'Schedule': 'normal',
        # 'Node Kind': 'file',
        # 'Sync': ' ',
        # 'Last Changed Author': 'shanec',
        # 'Checksum': 'a5890ace30a3e84d9118196c161aeec2',
        # 'Path': 'test1/asdf.txt',
        # 'Last Changed Rev': '350',
        # 'Text Last Updated': '2004-12-07 14'}
        
        koSccInfo['sccType'] = self.name
        koSccInfo['sccDirType'] = self.name
        koSccInfo['sccHaveOnDisk']= int(onDisk)
        koSccInfo['sccLocalRevision'] = '?'
        if 'Revision' in sccInfo:
            koSccInfo['sccLocalRevision'] = sccInfo['Revision']
            
        koSccInfo['sccRevdate'] = '?'
        if 'Last Changed Date' in sccInfo:
            koSccInfo['sccRevdate'] = sccInfo['Last Changed Date']
            
        koSccInfo['sccDepotRevision'] = '?'
        if 'Last Changed Rev' in sccInfo:
            koSccInfo['sccDepotRevision'] = sccInfo['Last Changed Rev']
        
        needSync = ('Sync' in sccInfo and sccInfo['Sync'] == '*')
        koSccInfo['sccNeedSync'] = '%d' % needSync
        koSccInfo['sccSync'] = koSccInfo['sccNeedSync']
        koSccInfo['sccOk'] = '%d' % (not needSync)
        koSccInfo['sccConflict'] = 0
        koSccInfo['sccAction'] = ''
        koSccInfo['sccStatus'] = 'ok'
        koSccInfo['sccChange'] = ''

        if 'Status' in sccInfo:
            koSccInfo['sccAction'] = koSccInfo['sccStatus'] = svnremotelib.actionNames[sccInfo['Status']]
            koSccInfo['sccConflict'] = int(koSccInfo['sccAction'] == 'conflict')
        # handle add/delete of a sccInfo so it can be commited
        if 'Schedule' in sccInfo and sccInfo['Schedule'] != 'normal':
            koSccInfo['sccAction'] = sccInfo['Schedule']

        cache[cache_key] = koSccInfo

    def directoryExists(self, path):
        # XXX - Update for remote files
        #return os.path.isdir(path)
        return True

    def getSvnStatus(self, dir_nsUri, reason):
        path = dir_nsUri.path
        self.log.debug("getSvnStatus: path: %r, reason: %r", path,
                  reason)
        env = koprocessutils.getUserEnv()
        # execute subversion remotely on the given path
        #remoteCmd = getRemoteCommandForUri(koIFile.URI)
        remoteConnection = getRemoteSSHConnectionForUri(dir_nsUri.spec)
        show_updates = (reason == self.REASON_FORCED_CHECK)
        if show_updates:
            self.log.debug("%s: Contacting server for update-to-date info",
                           self.name)
        return self.svn.statusEx("", # On the directory itself
                                 cwd=path,
                                 non_recursive=not self.recursive,
                                 recursive=self.recursive,
                                 verbose=1,
                                 show_updates=show_updates,
                                 _raw=1,
                                 env=env,
                                 remote=remoteConnection)
                                 #remote=remoteCmd)

    def updateSCCInfo(self, cache, dir_nsUri, reason):
        path = dir_nsUri.path
        dir_spec = dir_nsUri.spec
        self.log.debug("updateSCCInfo:: dir_spec: %r", dir_spec, )

        # XXX - Update this to work
        #svnRepositoryFile = os.path.join(path, self._svnDirName)
        #if not self.directoryExists(svnRepositoryFile):
        #    return False

        # Svn can generate errors as well as results in the one call, we grab
        # all errors and put them in here.
        _errors = []

        # We don't have any cached info and we haven't check this path yet,
        # so we do that now
        self.svn._svn = self.executable
        try:
            result, out = self.getSvnStatus(dir_nsUri, reason)
        except svnremotelib.SVNLibError, e:
            # we get an exception here if the svn library call errors out
            self.notifyError('SVN Status Error, see SCC Output pane for details', e)
            return False

        #print "\nresult: %r\n" % (result, )
        # The out parameter of svn statusEx is a tuple containing the output
        # from the info command and also the output from the status command.
        # out == (info_output, status_output)
        for out_type in out:
            if out_type and 'stderr' in out_type and out_type['stderr']:
                _errors.append(self._stripEmptyLines(out_type['stderr']))

        #print repr(result)
        #print "got %d files" % (len(result))

        if result:
            # Cache all the file scc information
            dir_uri = dir_nsUri.spec
            lenPrePath = len(dir_nsUri.prePath)
            for fname, fileinfo in result.items():
                try:
                    # Path is given as the relative local file path from
                    # the directory where the command was executed.
                    #   path\\file.txt
                    #   path/file.txt
                    cache_key = dir_nsUri.resolve(fileinfo['Path'])
                    cache_key = self._norm_uri_cache_key(cache_key)
                    fpath = cache_key[lenPrePath:]
                    if self.recursive:
                        # Check the paths, we may need to update for a different dir
                        parent_cache_key = os.path.dirname(cache_key)
                        if parent_cache_key != dir_uri:
                            self._lastChecked[parent_cache_key] = time.time()
                    self._cacheSCCInfo(cache, cache_key, fpath, fileinfo)
                except KeyError, e:
                    self.log.info("Can't find fileinfo['Path'] in file %r", fname)
                    pass
        elif _errors:
            self.notifyError('SVN Status Error, see SCC Output pane for details',
                             "".join(_errors))
            return False

        return True
