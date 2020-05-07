#!python
# Copyright (c) 2000-2008 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
import sys

from xpcom import components, nsError, ServerException, COMException
from xpcom.server import WrapObject

import eollib
import uriparse
import koprocessutils
from koAsyncOperationUtils import koAsyncOperationBase

import logging
log = logging.getLogger('koSCCBase')



#---- helper functions

def splitFile(file, splitDirectories=False):
    """Split the filepath (or uri) into two parts, the directory and the
    filename. Returns a tuple of (dirName, fileName).
    """
    path = uriparse.URIToLocalPath(file);
    if path:
        path = os.path.normpath(path)
        if not splitDirectories and os.path.isdir(path):
            return path, ''
        basedir = os.path.dirname(path)
        filename = os.path.basename(path)
        return basedir, filename
    return None, None

def groupFilesByDirectory(files, splitDirectories=False):
    """Split all the files (or can be uris) into directory and filename
    components, grouping all files with the same directory into one dictionary.
    Returns a dictionary whose keys are the distinct directories, with each
    key holding the list of files with this directory.
    """
    _files = {}
    for file in files:
        basedir, filename = splitFile(file, splitDirectories)
        if basedir:
            if not basedir in _files:
                _files[basedir] = []
            if filename:
                _files[basedir].append(filename)
    return _files

class koStoppableAsyncSccOperation(koAsyncOperationBase):
    """Utility class to help creating asynchronous operations"""
    def stop(self):
        scc_handler = self.kwargs.get('scc_handler')
        if scc_handler:
            self.status = components.interfaces.koIAsyncOperation.STATUS_STOPPING
            scc_handler.abort()
        else:
            koAsyncOperationBase.stop(self)

#---- class to assist with file management calls.

class PathHelperMixin(object):

    def directoryExists(self, path):
        # Will not work for remote paths, override this if using remote paths.
        return os.path.isdir(path)
    isDir = directoryExists

    def getParentDirectory(self, path):
        # May not work for correctly for remote paths, override this if using
        # remote paths.
        return os.path.dirname(path)

    def joinPaths(self, path1, path2):
        # May not work for correctly for remote paths, override this if using
        # remote paths.
        return os.path.join(path1, path2)

    def pathExists(self, path):
        # Will not work for remote paths, override this if using remote paths.
        return os.path.exists(path)

    def normalizeFiles(self, files):
        _files = []
        for file in files:
            path = uriparse.URIToLocalPath(file)
            path = os.path.normpath(path)
            _files.append(path)
        return _files

    def getParentDirContainingDirname(self, dirName, fromDir, max_traversal=20):
        dirPath = self.joinPaths(fromDir, dirName)
        dir_count = 1
        while not self.directoryExists(dirPath):
            lastDir = fromDir
            fromDir = self.getParentDirectory(fromDir)
            if not fromDir or lastDir == fromDir or dir_count >= max_traversal:
                # We did not find a parent directory with this name.
                return None
            dirPath = self.joinPaths(fromDir, dirName)
            dir_count += 1
        return fromDir

    def getParentDirContainingName(self, dirName, fromDir, max_traversal=20):
        dirPath = self.joinPaths(fromDir, dirName)
        dir_count = 1
        while not self.pathExists(dirPath):
            lastDir = fromDir
            fromDir = self.getParentDirectory(fromDir)
            if not fromDir or lastDir == fromDir or dir_count >= max_traversal:
                # We did not find a parent directory with this name.
                return None
            dirPath = self.joinPaths(fromDir, dirName)
            dir_count += 1
        return fromDir

    def getCommonBaseAndRelativePathsFromURIs(self, uris, splitDirectories=False):
        paths = self.normalizeFiles(uris)
        relative_paths = []
        if len(paths) == 1:
            if splitDirectories or not self.isDir(paths[0]):
                basedir = os.path.dirname(paths[0])
                relative_paths.append(os.path.basename(paths[0]))
            else:
                basedir = paths[0]
        else:
            osPathSvc = components.classes["@activestate.com/koOsPath;1"].\
                            getService(components.interfaces.koIOsPath)
            basedir = osPathSvc.commonprefixlist(paths)
            for filepath in paths:
                path_split = filepath.split(basedir)
                if len(path_split) >= 2:
                    relative_paths.append(path_split[1].lstrip(os.sep))
        return basedir, relative_paths

#---- component implementation

class KoSCCBase(PathHelperMixin):

    # Satisfy some of koISCC
    name = "xxx"
    reasonNotFunctional = ""
    isFunctional = False
    # Whether the handler supports commands/processes that can be stopped.
    supports_stoppable_commands = False

        # executablePrefName is the preference name used to store the scc
        # command that gets used by the scc library calls.
    executablePrefName = "xxxExecutable"
        # executableBaseName is the fallback command that is used to set the
        # location of _executable and determine if the service is
        # functional. Example: "svn"
    executableBaseName = "xxx"
        # Whether the service is enabled through Komodo's preferences.
    isEnabled = False
        # enabledPrefName is the preference name used to store whether the scc
        # component is enabled through Komodo's preferences.
        # Example: "svnEnabled"
    enabledPrefName = None

        # Cache used by the _findExecutable method.
    _find_executable_cache = {}

    def __init__(self):
        PathHelperMixin.__init__(self)

            # _executable is the command that will be executed by the scc
            # library.
        self._executable = None

        # Setup some common services the scc component will need to use.

            # Komodo preferences service.
        self._globalPrefs = components.classes["@activestate.com/koPrefService;1"].\
            getService(components.interfaces.koIPrefService).prefs
        self.upgradePrefs()
            # Notification/Observer service.
        self._observerSvc = components.classes["@mozilla.org/observer-service;1"].\
            getService(components.interfaces.nsIObserverService)
            # File Status service used for notifying of scc changes.
        self._fileStatusSvc = components.classes["@activestate.com/koFileStatusService;1"].\
                getService(components.interfaces.koIFileStatusService);
            # File service used for the commit command.
        self._fileSvc = components.classes["@activestate.com/koFileService;1"].\
                getService(components.interfaces.koIFileService)
            # OS helper service.
        self._osPathSvc = components.classes["@activestate.com/koOsPath;1"].\
                getService(components.interfaces.koIOsPath)
            # Unicode encoding/decoding service.
        self._encodingSvc = components.classes['@activestate.com/koEncodingServices;1'].\
                                getService(components.interfaces.koIEncodingServices)
            # Create a base environment to work with.
        self._env = koprocessutils.getUserEnv()

        # Set the scc executable and determine if it's functional.
        if self.enabledPrefName is None:
            self.enabledPrefName = "%sEnabled" % (self.name, )

        self.isEnabled = self._globalPrefs.getBoolean(self.enabledPrefName, True)
        self._setExecutableFromPrefs()
        self.redetermineIfFunctional()

            # Watch for changes to the prefs. Needs to use a wrapped XPCOM
            # instance otherwise the notification is never received!
        self._wrapped = WrapObject(self,components.interfaces.nsIObserver)
        self._globalPrefs.prefObserverService.addObserverForTopics(
                                self._wrapped,
                                [self.executablePrefName, self.enabledPrefName],
                                0)

    def upgradePrefs(self):
        pass

    def observe(self, subject, topic, value):
        if topic == self.executablePrefName:
            # Preference for scc executable was changed.
            self._setExecutableFromPrefs()
        elif topic == self.enabledPrefName:
            # Was enabled or disabled.
            self.isEnabled = self._globalPrefs.getBoolean(self.enabledPrefName, True)
            self._observerSvc.notifyObservers(self, 'subsystem_changed', self.name)

    def _findExecutable(self, command):
        """Find the absolute path for the given executable.

        Returns None when not found.

        Note: Results are cached per application lifetime, according to the
              command and user path.
        """
        env = koprocessutils.getUserEnv()
        userPath = env.get("PATH", "").split(os.pathsep)
        cache_key = repr([command, userPath])
        if cache_key in self._find_executable_cache:
            return self._find_executable_cache.get(cache_key)

        if sys.platform.startswith('win'):
            exts = ['.exe', '.com', '.bat', '.cmd']
        else:
            exts = None

        import which
        try:
            executable = which.which(command, exts=exts, path=userPath)
        except which.WhichError:
            executable = None

        # Cache the result
        self._find_executable_cache[cache_key] = executable

        return executable

    def set_executable(self, executable):
        if not executable:
            executable = self._findExecutable(self.executableBaseName)
        if executable != self._executable:
            self._executable = executable
            try:
                self._observerSvc.notifyObservers(self, 'subsystem_changed', self.name)
            except COMException:
                pass # Ignore error if there is no observer.

    def _setExecutableFromPrefs(self, prefName=None):
        if prefName is None:
            prefName = self.executablePrefName
        executable = self._globalPrefs.getString(prefName, "") or None
        self.set_executable(executable)

    def get_executable(self):
        if not self._executable:
            self._setExecutableFromPrefs()
        return self._executable

    def redetermineIfFunctional(self):
        executable = None
        wasFunctional = self.isFunctional
        if not self._executable:
            self.set_executable(None)  # Looks again for an executable.
        if self._executable and os.path.exists(self._executable):
            self.isFunctional = True
            self.reasonNotFunctional = None
        else:
            self.isFunctional = False
            self.reasonNotFunctional = "no %s executable could be found" % (self.name, )

        if wasFunctional != self.isFunctional:
            try:
                self._observerSvc.notifyObservers(self, 'subsystem_changed', self.name)
            except COMException:
                pass # Ignore error if there is no observer.

    def convertDiffResult(self, diff):
        # Convert line-endings to the currently expected
        eolpref = self._globalPrefs.getString('endOfLine', '')
        try:
            desiredEOL = eollib.eolPref2eol[eolpref]
        except KeyError:
            desiredEOL = eollib.EOL_PLATFORM
        diff = eollib.convertToEOLFormat(diff, desiredEOL)
        # Try encoding it with komodo's unicode encoding service
        diff, encoding, bom = self._encodingSvc.getUnicodeEncodedStringUsingOSDefault(diff)
        return diff

# --- The asynchronous wrappers of the scc commands.


    def diff(self, files, options, external, async_callback):
        async_files = files
        if external:
            # We don't want to display the files as being in an asynchronous
            # operation (i.e. no throbber is necessary).
            async_files = []
        return self.runCommandAsynchronously("diff", self, self._do_diff,
                                             async_files, False, False, async_callback,
                                             files, options, external)

    def diffRelative(self, baseURI, relpaths, options, external, async_callback):
        files = [ "\\".join([baseURI, x.replace("/", "\\")]) for x in relpaths ]
        return self.runCommandAsynchronously("diffRelative", self,
                                             self._do_diff_relative,
                                             files, False, False, async_callback,
                                             baseURI, relpaths, options, external)

    # Diff two revisions of the given file
    def diffRevisions(self, fileuri1, rev1, fileuri2, rev2, localfilepath,
                      options, external, async_callback):
        return self.runCommandAsynchronously("diffRevisions", self,
                                             self._do_diff_revisions,
                                             [fileuri1, fileuri2], False, False,
                                             async_callback,
                                             fileuri1, rev1, fileuri2, rev2,
                                             localfilepath, options, external)

    def history(self, fileuri, options, limit, async_callback):
        # Don't need to lock the files
        return self.runCommandAsynchronously("history", self, self._do_history,
                                             [fileuri], False, False, async_callback,
                                             fileuri, options, limit)

    def getRoot(self, fileuri, async_callback):
        return self.runCommandAsynchronously("getRoot", self, self._do_getRoot,
                                             [fileuri], False, False, async_callback,
                                             fileuri)

    def add(self, files, mode, message, async_callback=None):
        return self.runCommandAsynchronously("add", self, self._do_add,
                                             files, False, True, async_callback,
                                             files, mode, message)
    
    def initRepo(self, url, options, async_callback=None, terminalHandler=None):
        return self.runCommandAsynchronously("init", self, self._do_init,
                                             [], False, True, async_callback,
                                             url, options, terminalHandler)
    
    def stage(self, files, async_callback=None):
        return self.runCommandAsynchronously("stage", self, self._do_add,
                                             files, False, True, async_callback,
                                             files)
    
    def unstage(self, files, async_callback=None):
        return self.runCommandAsynchronously("unstage", self, self._do_add,
                                             files, False, True, async_callback,
                                             files)

    def commit(self, files, message, options, async_callback=None):
        return self.runCommandAsynchronously("commit", self, self._do_commit,
                                             files, True, True, async_callback,
                                             files, message, options)

    def remove(self, files, force, recursive, async_callback):
        return self.runCommandAsynchronously("remove", self, self._do_remove,
                                             files, True, True, async_callback,
                                             files, force, recursive)
    
    def update(self, files, options, async_callback):
        return self.runCommandAsynchronously("update", self, self._do_update,
                                             files, False, True, async_callback,
                                             files, options)

    def pull(self, files, options, async_callback):
        return self.runCommandAsynchronously("pull", self, self._do_update,
                                             files, False, True, async_callback,
                                             files, options)

    def pullRebase(self, files, options, async_callback):
        return self.runCommandAsynchronously("pullRebase", self, self._do_update,
                                             files, False, True, async_callback,
                                             files, options)

    def revert(self, files, options, async_callback):
        return self.runCommandAsynchronously("revert", self, self._do_revert,
                                             files, True, True, async_callback,
                                             files, options)
    
    def edit(self, files, async_callback):
        return self.runCommandAsynchronously("edit", self, self._do_edit,
                                             files, False, True, async_callback,
                                             files)
    
    def status_count(self, files, async_callback):
        return self.runCommandAsynchronously("status", self, self._do_status_count,
                                             files, False, False, async_callback,
                                             files)

    def status(self, files, recursive, options, async_callback):
        return self.runCommandAsynchronously("status", self, self._do_status,
                                             files, False, False, async_callback,
                                             files, recursive, options)
    
    def checkout_branch(self, path, branch, async_callback):
        return self.runCommandAsynchronously("checkout", self, self._do_checkout_branch,
                                            [], False, False, async_callback,
                                            path, branch)

    def checkout(self, repositoryURL, locationURL, options, async_callback,
                 terminalHandler):
        return self.runCommandAsynchronously("checkout", self, self._do_checkout,
                                            [], False, True, async_callback,
                                            repositoryURL, locationURL, options,
                                            terminalHandler)

    def cat(self, baseName, cwd, options, async_callback):
        # We don't want to display the files as being in an asynchronous
        # operation (i.e. no throbber is necessary).
        # options is currenty unused
        async_files = []
        return self.runCommandAsynchronously("cat", self, self._do_cat,
                                             async_files, False, False, async_callback,
                                             [baseName], cwd, options)

    def getValueAsync(self, name, data, async_callback):
        return self.runCommandAsynchronously("getValueAsync", self,
                                             self._do_getValueAsync, [], False, False,
                                             async_callback, name, data)

    # koISCCDVCS

    def push(self, remoteRepoURL, localRepoURI, async_callback,
             localRevs=None, localTags=None, options=None, dryRun=False):
        return self.runCommandAsynchronously("push", self, self._do_push,
                                             [], False, False, async_callback,
                                             remoteRepoURL, localRepoURI,
                                             localRevs=localRevs,
                                             localTags=localTags,
                                             options=options,
                                             dryRun=dryRun)

    def getKnownRemotes(self, localRepoURI, async_callback):
        return self.runCommandAsynchronously("getKnownRemotes", self, self._do_getKnownRemotes,
                                             [], False, False, async_callback,
                                             localRepoURI)

    def create_new_scc_handler(self):
        raise Exception("Must be implemented by the inheriting class")

    def runCommandAsynchronously(self, cmd_name, sccSvc, run_function,
                                 affected_uris, lock_the_uris, update_status, async_callback,
                                 *args, **kwargs):
        # Run asynchronously
        async_svc = components.classes["@activestate.com/koAsyncService;1"].\
                        getService(components.interfaces.koIAsyncService)

        # Create a new instance to ensure we don't have multiple scc
        # operations running on the same instance.
        kwargs['scc_handler'] = self.create_new_scc_handler()

        #print "%r: supports_stoppable_commands: %r" % (self.name, self.supports_stoppable_commands)
        if self.supports_stoppable_commands:
            async_op = koStoppableAsyncSccOperation(run_function, *args, **kwargs)
        else:
            async_op = koAsyncOperationBase(run_function, *args, **kwargs)
        async_svc.run("SCC %s %s" % (self.name, cmd_name),
                      async_op, async_callback, affected_uris, lock_the_uris, update_status)
        return async_op


# --- The actual implementations of the scc commands. Implement these for your
# --- individual scc component.


    def _do_diff(self, files, options, external, scc_handler=None):
        """Display diff of the client file with the repository file."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)

    def _do_diff_relative(self, baseURI, relpaths, options, external,
                          scc_handler=None):
        """Display diff of the relative files with the repository files."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)

    def _do_diff_revisions(self, fileuri1, rev1, fileuri2, rev2, localfilepath,
                           options, external, scc_handler=None):
        """Display diff between two revisions of the one file."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)

    def _do_history(self, fileuri, options, limit, scc_handler=None):
        """List revision history for this file."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)

    def _do_getRoot(self, file, scc_handler=None):
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)

    def _do_add(self, files, mode, message, scc_handler=None):
        """Open a new file to add it to the repository."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)
    
    def _do_stage(self, files, scc_handler=None):
        """Open a new file to add it to the repository."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)
    
    def _do_unstage(self, files, scc_handler=None):
        """Open a new file to add it to the repository."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)

    def _do_commit(self, files, message, options, scc_handler=None):
        """Submit open files to the repository."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)

    def _do_cat(self, files, message, options, scc_handler=None):
        """Get the repository contents of the current file."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)

    def _do_remove(self, files, force, recursive, scc_handler=None):
        """Mark existing scc files to be deleted from the repository."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)

    def _do_update(self, files, options, scc_handler=None):
        """Synchronize the client with the repository."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)
    
    def _do_pull(self, files, options, scc_handler=None):
        """Synchronize the client with the repository."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)
    
    def _do_pullRebase(self, files, options, scc_handler=None):
        """Synchronize the client with the repository."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)

    def _do_revert(self, files, options, scc_handler=None):
        """Discard changes from these opened files."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)

    def _do_edit(self, files, scc_handler=None):
        """Prepare the file for scc modification."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)
    
    def _do_status_count(self, files, scc_handler=None):
        result = self._do_status(files, True, '', scc_handler)
        return len(result)

    def _do_status(self, files, recursive, options, scc_handler=None):
        """Retrieve file scc information for these files."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)

    def _do_checkout(self, path, branch, scc_handler=None):
        """Checkout a branch"""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)

    def _do_push(self, remoteRepoURL, localRepoURI, localRevs=None,
                 localTags=None, options=None, scc_handler=None):
        """Push to a remote repository."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)

    def _do_getValueAsync(self, name, data, scc_handler=None):
        return self.getValue(name, data, scc_handler=scc_handler)
