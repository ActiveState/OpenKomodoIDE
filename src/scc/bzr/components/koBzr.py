#!python

# Copyright (c) 2008 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
import sys
import re
import time
from pprint import pprint
import logging

from xpcom import components, nsError, ServerException
from xpcom.server import UnwrapObject

import uriparse
import koprocessutils
from koSCCBase import KoSCCBase, PathHelperMixin, splitFile, groupFilesByDirectory
from koAsyncOperationUtils import koAsyncOperationBase
from fileStatusUtils import KoSCCChecker

from koSCCHistoryItem import koSCCHistoryItem
from koSCCFileStatus import koSCCFileStatusItem
from xpcom.server import UnwrapObject


# Special hack necessary to import the "pylib" directory. See bug:
# http://bugs.activestate.com/show_bug.cgi?id=74925
old_sys_path = sys.path[:]
pylib_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "..", "pylib")
sys.path.append(pylib_path)
import koBzrlib
sys.path = old_sys_path


log = logging.getLogger('koBzr')
#log.setLevel(logging.DEBUG)


#---- Bzr component implementation.

class KoBzr(KoSCCBase):
    # Satisfy koISCC.name
    name = "bzr"

    # XPCOM component registration settings.
    _com_interfaces_ = [components.interfaces.koISCC,
                        components.interfaces.koISCCDVCS,
                        components.interfaces.nsIObserver]
    _reg_desc_ = "Komodo Bzr Support"
    _reg_contractid_ = "@activestate.com/koSCC?type=" + name + ";1"
    _reg_clsid_ = "{88488d69-3316-4ced-a059-6312f70d2877}"
    _reg_categories_ = [
         ("category-komodo-scc", name),
         ]

    # Override base class settings.
    executableBaseName = "bzr"
    executablePrefName = "bzrExecutable"
    supports_stoppable_commands = True

    # Directory name that contains the bzr repository information.
    _bzrDirName = ".bzr"

    def __init__(self):
        KoSCCBase.__init__(self)
        # Make a generic bzr instance to do work with.
        self.bzr = koBzrlib.Bzr()
        # Ensure the instance is using the appropriate executable.
        self.bzr.executable = self.get_executable()

    def set_executable(self, executable):
        if not executable:
            executable = self._findExecutable(self.executableBaseName)
        if not executable and sys.platform.startswith("win"):
            # on Windows only, attempt to find bzr via the registry
            # (assuming the user installed via the official installer)
            path = None
            try:
                import _winreg
                with _winreg.OpenKey(_winreg.HKEY_LOCAL_MACHINE,
                                     r"Software\Bazaar", 0,
                                     _winreg.KEY_QUERY_VALUE) as key:
                    path, regtype = _winreg.QueryValueEx(key, "InstallPath")
                if regtype != _winreg.REG_SZ:
                    path = None
            except:
                pass
            if path is not None:
                path = os.path.join(path, "bzr.exe")
                if os.path.exists(path):
                    executable = path
        KoSCCBase.set_executable(self, executable)

    def create_new_scc_handler(self):
        scc_handler = koBzrlib.Bzr()
        # Ensure the instance uses the same executable as the git service.
        scc_handler.executable = self.get_executable()
        return scc_handler

    def __generic_command(self, scc_function, files, env=None, want_stderr=False,
                          **kwargs):
        env = koprocessutils.getUserEnv()
        basedir, relpaths = self.getCommonBaseAndRelativePathsFromURIs(files)
        result = scc_function(relpaths, cwd=basedir, env=env, **kwargs)
        # TODO: Do something with stderr?
        #raw_stderr = result.get('stderr')
        #if raw_stderr:
        #    errors.append(raw_stderr)

        # do notification that status may have changed
        # we have to use the original urls passed in since
        # they are modified to local paths in _splitFiles
        forceRefresh = False
        self._fileStatusSvc.updateStatusForUris(files, forceRefresh)
        if want_stderr:
            return result.get('stdout', ''), result.get('stderr', '')
        return result.get('stdout', '')

    def getValue(self, name, data, scc_handler=None):
        if not scc_handler:
            scc_handler = self.create_new_scc_handler()
            
        if name == "supports_command":
            if data in ("add", "checkout", "commit", "diff", "history",
                        "remove", "revert", "status", "update", "push"):
                return "Yes"
            return ""
        elif name == "external_diff":
            if self._globalPrefs.getBoolean('bzr_uses_externaldiff', False):
                return "1"
            return ""
        elif name == "cmdline_arg_for_diff_revision":
            return "-r %s" % (data, )
        elif name == "supports_checkout_url":
            return data.find(self.name) >= 0 and "Yes" or ""
        elif name == "get_checkout_command_line":
            import json
            try:
                json_dict = json.loads(data)
            except:
                return ""
            else:
                options = json_dict.get("options", "")
                repo_url = json_dict.get("repositoryURL")
                location_url = json_dict.get("locationURL", "")
                cwd, name = splitFile(location_url)
                return "%s branch %s %s %s" % (self.get_executable(),
                                               options,
                                               repo_url,
                                               name)
        elif name == "push_options":
            return [["--overwrite", "bool", "options.bzr.overwrite.label"]]
        elif name == "push_default_repo":
            env = koprocessutils.getUserEnv()
            repodir = self._do_getRoot(data, scc_handler=scc_handler, env=env)
            return scc_handler.getdefaultremote(repodir, env=env)
        elif name == "repository_root":
            env = koprocessutils.getUserEnv()
            repodir = self._do_getRoot(data, scc_handler=scc_handler, env=env)
            return repodir
        return ""

    def _do_getRoot(self, fileuri, scc_handler=None, env=None):
        if env is None:
            env = koprocessutils.getUserEnv()
        filepath = self.normalizeFiles([fileuri])[0]
        return scc_handler.getrepobase(cwd=filepath, env=env)

    def _do_getKnownRemotes(self, fileuri, scc_handler=None):
        env = koprocessutils.getUserEnv()
        cwd = self.normalizeFiles([fileuri])[0]
        result = []
        for name, url in scc_handler.getremotes(cwd=cwd, env=env)["items"].items():
            result.append([url, name])
        return result


    # Regex used to update the "Index: xyz..." to have a full path reference
    diffUpdatePathRegex = re.compile(r"^===\s.*?\'(.*)\'", re.MULTILINE)

    def _do_diff(self, files, options, external, scc_handler=None):
        """Display diff of the client file with the repository file."""
        basedir, relpaths = self.getCommonBaseAndRelativePathsFromURIs(files)

        #print "files %r basedir %r" %(files, basedir)
        if not relpaths:
            # Diff is on the folder itself.
            relpaths.append(".")

        return self._do_diff_relative(basedir, relpaths, options,
                                      external, scc_handler=scc_handler)

    def _do_diff_relative(self, baseURI, relpaths, options, external, scc_handler=None):
        """Display diff of the client files relative to the base directory."""

        basedir = uriparse.URIToLocalPath(baseURI)

        repodir = self.getParentDirContainingDirname(self._bzrDirName, basedir)
        if not repodir:
            raise koBzrlib.BzrLibError("No %r base repository could be found." % (
                                        self._bzrDirName))

        env = koprocessutils.getUserEnv()
        errors = []
        diff = ''

        result = scc_handler.diff(relpaths,
                                  cwd=basedir,
                                  options=options,
                                  env=env)
        raw_stdout = result.get('stdout')
        raw_stderr = result.get('stderr')
        if raw_stderr:
            errors.append(raw_stderr)
        if raw_stdout:
            # We update all file names so the "Reveal in Editor"
            # functionality still works. The path given by bzr's diff output
            # is the relative path from the base repository directory.
            replaceStr = "Index: %s%s" % (os.path.abspath(repodir), os.sep)
            # Need to escape all the backslashes (Notably on Windows). See bug:
            # http://bugs.activestate.com/show_bug.cgi?id=65911
            if sys.platform.startswith("win"):
                # Bzr on Windows uses "/" as path separator, Komodo wants
                # the path in the Windows format, using the "\" separator.
                # http://bugs.activestate.com/show_bug.cgi?id=80288
                def replaceFn(match):
                    return "%s%s" % (replaceStr, match.group(1).replace("/", "\\"))
                diff = self.diffUpdatePathRegex.sub(replaceFn, raw_stdout)
            else:
                replaceStr = replaceStr.replace("\\", "\\\\") + r"\1"
                diff = self.diffUpdatePathRegex.sub(replaceStr, raw_stdout)

        # XXX - Do something with errors?

        return self.convertDiffResult(diff)


    # TODO: Implement these functions to do the actual work!

    def _do_diff_revisions(self, fileuri1, rev1, fileuri2, rev2, localfilepath,
                           options, external, scc_handler=None):
        """Display diff between two revisions of the one file."""
        basedir, filename = splitFile(localfilepath)
        env = koprocessutils.getUserEnv()
        errors = []
        output = ''

        # Deal with merged revisions, as "bzr log" can output revisions
        # in the form of: "15 [merge]" - bug 87618.
        rev1_split = rev1.split(" ", 1)
        if len(rev1_split) > 1:
            rev1 = rev1_split[0]
        rev2_split = rev2.split(" ", 1)
        if len(rev2_split) > 1:
            rev2 = rev2_split[0]

        result = scc_handler.diff(["-r", "%s..%s" % (rev1, rev2), filename], cwd=basedir, env=env)
        if result is None:
            raise koBzrlib.BzrLibError("No diff results were returned.")
        rawerror = result.get('stderr', "")
        if rawerror:
            # There was some type of error
            raise koBzrlib.BzrLibError(rawerror)
        return result.get('stdout', '')

    def _do_history(self, fileuri, options, limit, scc_handler=None):
        """List revision history for this file."""
        basedir, filename = splitFile(fileuri)
        env = koprocessutils.getUserEnv()
        errors = []
        output = ''

        result = scc_handler.log(filename, cwd=basedir, env=env, limit=limit)
        if result is None:
            raise koBzrlib.BzrLibError("No history results were found.")

        rawerror = result.get('stderr', "")
        if rawerror:
            # There was some type of error
            raise koBzrlib.BzrLibError(rawerror)

        # result:
        # Returns a list of hits. Each hit is a dict with the following:
        # keys: 'revision', 'date', 'author', 'message'.
        # Now, split up the history rows

        koHistoryList = []
        encodingSvc = UnwrapObject(self._encodingSvc)
        #print result
        for revision in result['log']:
            koHistory = koSCCHistoryItem()
            koHistory.version = revision['revision']
            author, encoding, bom = encodingSvc.getUnicodeEncodedStringUsingOSDefault(revision['author'])
            koHistory.author  = author
            koHistory.date    = revision['date']
            koHistory.action  = ''  # No action given
            message, encoding, bom = encodingSvc.getUnicodeEncodedStringUsingOSDefault(revision['message'])
            koHistory.message = message
            koHistory.uri     = fileuri
            koHistoryList.append(koHistory)
        return koHistoryList

    def _do_add(self, files, mode, message, scc_handler=None):
        """Open a new file to add it to the repository."""
        return self.__generic_command(scc_handler.add, files)

    def _do_cat(self, baseNameAsArray, cwd, options, scc_handler=None):
        result = scc_handler.cat(baseNameAsArray,
                                 cwd=cwd,
                                 options=options,
                                 env=self._env)
        return result['stdout']

    def _do_commit(self, files, message, options, scc_handler=None):
        """Submit open files to the repository."""
        #return self.__generic_command(scc_handler.commit, files, message)
        # svnlib saves message to a message for file
        msgfile = self._fileSvc.makeTempFile('.svn','w')
        # Ensure the message is encoded to utf-8 and that we also tell the svn
        # command line client that it's encoded as utf-8.
        msgfile.puts(message.encode("utf-8"))
        msgfile.flush()
        msgfile.close()
        msgpath = msgfile.path
        try:
            stdout, stderr = self.__generic_command(scc_handler.commit, files,
                                                    msgpath=msgpath,
                                                    want_stderr=True)

            if stderr:
                rev = re.match(r"Committed revision (\d+).",
                               stderr.splitlines()[-1])
            else:
                rev = None

            if rev:
                bag = components.classes["@mozilla.org/hash-property-bag;1"].\
                        createInstance(components.interfaces.nsIWritablePropertyBag2)
                bag.setPropertyAsAString("text", stderr + stdout)
                bag.setPropertyAsAString("extra",
                                         " as revision %s" % (rev.group(1),))
                return bag

            return stderr + stdout
        finally:
            del msgfile

    def _do_remove(self, files, force, recursive, scc_handler=None):
        """Mark existing scc files to be deleted from the repository."""
        return self.__generic_command(scc_handler.remove, files)

    def _do_update(self, files, options, scc_handler=None):
        """Synchronize the client with the repository."""
        return self.__generic_command(scc_handler.update, files)

    def _do_revert(self, files, options, scc_handler=None):
        """Discard changes from these opened files."""
        return self.__generic_command(scc_handler.revert, files)

    def _do_edit(self, files, scc_handler=None):
        """Prepare the file for scc modification."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)

    def _do_status(self, files, recursive, options, scc_handler=None):
        """Retrieve file scc information for these files."""
        basedir, relpaths = self.getCommonBaseAndRelativePathsFromURIs(files)
        repodir = self.getParentDirContainingDirname(self._bzrDirName, basedir)
        if not relpaths:
            relpaths = ["."]
        env = koprocessutils.getUserEnv()
        #print "relpaths %r basedir %r" %(relpaths, basedir)
        result = scc_handler.status(relpaths, cwd=basedir, env=env)

        # TODO: Do something with the errors.
        #raw_stderr = result.get('stderr')
        #if raw_stderr:
        #    errors.append(raw_stderr)
        bzr_stats = result.get('files', {})

        result = []
        for relpath, stat_info in bzr_stats.items():
            # stat_info will be a dict with the following keys:
            #    History, Locked, Modified, Path, Status, Switched
            status_string = stat_info.get('status')
            status_flags = stat_info.get('status_flags')
            #print "filepath: %r, status_string: %r" % (filepath, status_string, )
            #print ""
            if (status_string and status_string in "DHKMN") or \
               (status_flags and status_flags in "+-R?CP"):
                status = components.interfaces.koISCC.STATUS_UNKNOWN
                if status_flags == 'C':
                    status = components.interfaces.koISCC.STATUS_CONFLICT
                elif status_flags == '?':
                    status = components.interfaces.koISCC.STATUS_UNKNOWN
                elif status_string in "MK" or status_flags == 'R':
                    status = components.interfaces.koISCC.STATUS_MODIFIED
                elif status_string == 'N' or status_flags == '+':
                    status = components.interfaces.koISCC.STATUS_ADDED
                elif status_string == 'D' or status_flags == '-':
                    status = components.interfaces.koISCC.STATUS_DELETED
                elif status_string == 'H':
                    status = components.interfaces.koISCC.STATUS_OK
                fileStatusItem = koSCCFileStatusItem()
                fileStatusItem.relativePath = relpath
                fileStatusItem.uriSpec = uriparse.localPathToURI(self.joinPaths(repodir, relpath));
                fileStatusItem.status = status
                if stat_info.get('Sync') == '*':
                    fileStatusItem.isOutOfSync = True
                result.append(fileStatusItem)
        return result

    def _do_checkout(self, repositoryURL, locationURL, options, async_callback,
                     terminalHandler=None, scc_handler=None):
        path = uriparse.URIToLocalPath(locationURL)
        if terminalHandler:
            terminalHandler=UnwrapObject(terminalHandler)
        result = scc_handler.branch(repositoryURL,
                                    path,
                                    command_options=options,
                                    terminalHandler=terminalHandler,
                                    env=self._env)
        return result.get('stderr', '') + result.get('stdout', '')

    def _do_push(self, remoteRepoURL, localRepoURI, localRevs=None,
                 localTags=None, options=None, dryRun=False, scc_handler=None):
        localdir = uriparse.URIToLocalPath(localRepoURI)
        result = scc_handler.push(remoteRepoURL, localdir, localrevs=localRevs,
                                  options=options, dryRun=dryRun, env=self._env)
        return result.get('stderr', '') + result.get('stdout', '')

#---- Bzr file status checker. Used to continously keep Komodo up-to-date about
#---- the status of bzr source code manged files.

class KoBzrFileChecker(KoSCCChecker, PathHelperMixin):
    name = "bzr"
    _reg_clsid_ = "{60cff019-709b-44ff-b707-2db0b9fe82f6}"
    _reg_contractid_ = "@activestate.com/koFileStatusChecker?type=" + name + ";1"
    _reg_desc_ = "Komodo Bzr File Status Checker"
    _reg_categories_ = [
         ("category-komodo-file-status",      name),
         ]

    ranking_weight = 35

    def __init__(self):
        KoSCCChecker.__init__(self)
        PathHelperMixin.__init__(self)
        #self.log.setLevel(logging.DEBUG)
        self.bzr = koBzrlib.Bzr()
        # Ensure the instance is using the appropriate executable.
        self.bzr.executable = self.svc.executable
        self.enabledPrefName = 'bzrEnabled'
        self.executablePrefName = 'bzrExecutable'
        self.backgroundEnabledPrefName = 'bzrBackgroundCheck'
        self.backgroundDurationPrefName = 'bzrBackgroundMinutes'
        self.recursivePrefName = 'bzrRecursive'
        self._bzrDirName = ".bzr"
        # This file status cache is used to store a full bzr repo status check.
        # The cache is wiped and updated as necessary. When checking for the
        # status of a particular directory, it's checked/compared against this
        # cache and only updates the status for the files that reside directly
        # in this directory. This is used to aviod creating a bunch of scc
        # information on files that are not being checked (memory and perf).
        self._bzr_file_status_cache_for_repo = None

    def setExecutable(self, executable):
        KoSCCChecker.setExecutable(self, executable)
        self.bzr.executable = self.executable

    def _cacheSCCInfo(self, cache, cache_key, path, sccInfo):
        # It's important that the cached scc info contains exactly the same
        # keys as the 'koIFileEx.scc' object.
        koSccInfo = self.baseFileSCCInfo.copy()

        koSccInfo['sccType'] = self.name
        koSccInfo['sccDirType'] = self.name
        koSccInfo['sccLocalRevision'] = '?'
        koSccInfo['sccRevdate'] = '?'
        koSccInfo['sccDepotRevision'] = '?'
        koSccInfo['sccNeedSync'] = '0'
        koSccInfo['sccSync'] = koSccInfo['sccNeedSync']
        koSccInfo['sccOk'] = '1'
        koSccInfo['sccConflict'] = 0
        koSccInfo['sccAction'] = ''
        koSccInfo['sccStatus'] = 'ok'
        koSccInfo['sccChange'] = ''

        status = sccInfo.get('status')
        status_flags = sccInfo.get('status_flags')
        if status_flags == '?': # non-revisioned file
            koSccInfo['sccType'] = ''
        elif status in ('M', 'K'):
            koSccInfo['sccAction'] = 'edit'
        elif status == 'N':
            koSccInfo['sccAction'] = 'add'
        elif status == 'D':
            koSccInfo['sccAction'] = 'delete'
        elif status == 'H':    # normal unmodified file status
            koSccInfo['sccAction'] = ''

        if status_flags == 'C':    # conflict
            koSccInfo['sccConflict'] = 1
        #print "fpath: %r, sccAction: %r" % (path, koSccInfo['sccAction'])

        cache[cache_key] = koSccInfo

    def needsToReCheckFileStatus(self, koIFile, reason):
        if KoSCCChecker.needsToReCheckFileStatus(self, koIFile, reason):
            if self._bzr_file_status_cache_for_repo is not None:
                self._bzr_file_status_cache_for_repo = None
            return 1
        return 0

    def _createFileStatusCacheForRepo(self, repo_path):
        # Get the status (which works recursively over the whole repo).
        # This is then cached (so we don't need to run multiple status
        # commands per diretory).
        env = koprocessutils.getUserEnv()
        try:
            result = self.bzr.status(cwd=repo_path, env=env)
        except koBzrlib.BzrLibError, e:
            # we get an exception here if the bzr library call errors out
            self.notifyError('Bzr status error, click for details', e)
            return False

        # The out parameter of bzr status call is a tuple containing the output
        # from the info command and also the output from the status command.
        # out == (info_output, status_output)
        _errors = result.get('stderr')

        file_status_cache = result['files']
        self._bzr_file_status_cache_for_repo[repo_path] = file_status_cache
        return file_status_cache

    def updateSCCInfo(self, cache, dir_nsUri, reason):
        self.log.debug("updateSCCInfo: %r", dir_nsUri.path)
        # Obtain the path from the nsURI instance.
        path = uriparse.URIToLocalPath(dir_nsUri.spec)

        repo_path = self._cached_repodir_from_path.get(path)
        if repo_path is None:
            # Walk up the directory chain until we find a ".bzr" directory.
            repo_path = self.getParentDirContainingDirname(self._bzrDirName, path)
            # Cache it so we don't need to do this check again.
            self._cached_repodir_from_path[path] = repo_path
        if not repo_path:
            return False

        if self._bzr_file_status_cache_for_repo is None:
            # Recreate the cache object.
            self._bzr_file_status_cache_for_repo = {}

        file_status_cache = self._bzr_file_status_cache_for_repo.get(repo_path)
        if file_status_cache is None:
            file_status_cache = self._createFileStatusCacheForRepo(repo_path)

        if file_status_cache:
            # Convert/Cache scc status information for these files.
            for repo_relpath, fileinfo in file_status_cache.items():
                fullpath = self.joinPaths(repo_path, repo_relpath)
                cache_key = uriparse.localPathToURI(fullpath)
                cache_key = self._norm_uri_cache_key(cache_key)
                # Don't need to add it when it's already there.
                if cache_key not in cache:
                    self._cacheSCCInfo(cache, cache_key, fullpath, fileinfo)

        # Now we need to find the other files that are under bzr
        # control, but are not modified.
        env = koprocessutils.getUserEnv()
        try:
            result = self.bzr.ls(cwd=path, options="--versioned", env=env)
        except koBzrlib.BzrLibError, e:
            # we get an exception here if the bzr library call errors out
            self.notifyError('Bzr status error, click for details', e)
            return False
        except Exception, e:
            # On Windows, this falls over sometimes when the file is missing
            if not os.path.exists(path):
                return False
            raise

        errors = result.get('stderr')
        files = result.get('files')
        if files:
            time_now = time.time()
            dir_cache_key = self._norm_uri_cache_key(dir_nsUri.spec)
            # Cache all the file scc information
            for relpath, fileinfo in files.items():
                fullpath = self.joinPaths(path, relpath)
                cache_key = uriparse.localPathToURI(fullpath)
                cache_key = self._norm_uri_cache_key(cache_key)
                # If the cache_key is already in the cache, then there
                # is already an cached status information from the "bzr
                # status" command - which is more important than
                # knowning it's versioned.
                if cache_key not in cache:
                    self._cacheSCCInfo(cache, cache_key, fullpath, fileinfo)
        elif errors:
            self.notifyError('Bzr status error, click for details',
                             errors)
            return False

        return True
