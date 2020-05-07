#!python

# Copyright (c) 2008 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
import sys
import re
import time
from pprint import pprint
import logging
import threading

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
import gitlib
sys.path = old_sys_path


log = logging.getLogger('koGit')
#log.setLevel(logging.DEBUG)


#---- Git component implementation.

class KoGIT(KoSCCBase):
    # Satisfy koISCC.name
    name = "git"

    # XPCOM component registration settings.
    _com_interfaces_ = [components.interfaces.koISCC,
                        components.interfaces.koISCCDVCS,
                        components.interfaces.nsIObserver]
    _reg_desc_ = "Komodo Git Support"
    _reg_contractid_ = "@activestate.com/koSCC?type=" + name + ";1"
    _reg_clsid_ = "{5653ba47-8552-424d-b93b-6b74a7c4e37a}"
    _reg_categories_ = [
         ("category-komodo-scc", name),
         ]

    # Override base class settings.
    executableBaseName = "git"
    executablePrefName = "gitExecutable"
    supports_stoppable_commands = True

    # Internal attributes.
    _gitDirName = ".git"

    def __init__(self):
        KoSCCBase.__init__(self)
        # Make a generic git instance to do work with.
        self.git = gitlib.GIT()
        # Ensure the instance is using the appropriate executable.
        self.git.executable = self.get_executable()

    def create_new_scc_handler(self):
        scc_handler = gitlib.GIT()
        # Ensure the instance uses the same executable as the git service.
        scc_handler.executable = self.get_executable()
        # Copy the version cache over - mainly for unit testing support
        if hasattr(self.git, "_git_version_cache"):
            setattr(scc_handler, "_git_version_cache",
                    getattr(self.git, "_git_version_cache"))
        return scc_handler

    def __generic_command(self, scc_function, files, env=None, **kwargs):
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
        return result.get('stdout', '')

    def getValue(self, name, data, scc_handler=None):
        if not scc_handler:
            scc_handler = self.create_new_scc_handler()
            
        if name == "supports_command":
            if data in ("commit", "diff", "history", "stage", "checkout", "checkout_branch",
                        "revert", "status", "push", "pull", "pullRebase", "clone", "init"):
                return "Yes"
            return ""
        elif name == "external_diff":
            if self._globalPrefs.getBoolean('git_uses_externaldiff', False):
                return "1"
            return ""
        elif name == "cmdline_arg_for_diff_revision":
            return "%s" % (data, )
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
                return "%s clone %s %s %s" % (self.get_executable(),
                                              options,
                                              repo_url,
                                              name)
        elif name == "push_options":
            return [["--force", "bool", "options.git.force.label"],
                    ["--no-thin", "bool", "options.git.no-thin.label"],
                   ]
        elif name == "supports_push_feature":
            if data in ("branches", "multiple_branches", "tags", "multiple_tags"):
                return "Yes"
        elif name == "push_default_repo":
            env = koprocessutils.getUserEnv()
            repodir = self._do_getRoot(data, scc_handler=scc_handler, env=env)
            return scc_handler.getdefaultremote(repodir, env=env)
        elif name == "branches":
            env = koprocessutils.getUserEnv()
            repodir = self._do_getRoot(data, scc_handler=scc_handler, env=env)
            return scc_handler.getbranches(repodir, env=env)
        elif name == "current_branch":
            env = koprocessutils.getUserEnv()
            repodir = self._do_getRoot(data, scc_handler=scc_handler, env=env)
            return scc_handler.getcurrentbranch(repodir, env=env)
        elif name == "tags":
            env = koprocessutils.getUserEnv()
            repodir = self._do_getRoot(data, scc_handler=scc_handler, env=env)
            return scc_handler.gettags(repodir, env=env)
        elif name == "repository_root":
            env = koprocessutils.getUserEnv()
            repodir = self._do_getRoot(data, scc_handler=scc_handler, env=env)
            return repodir
        return ""

    # Regex used to update the "Index: ..." path to be full path reference.
    # Git has the form:
    #  diff --git a/web/xo.js b/web/xo.js
    diffUpdatePathRegex = re.compile(r"^diff --git a\/(.*)\sb\/(.*)$", re.MULTILINE)

    def _do_cat(self, baseNameAsArray, cwd, options, scc_handler=None):
        result = scc_handler.cat(baseNameAsArray, cwd, options=options,
                                 env=self._env)
        return result['stdout']

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

        repodir = self.getParentDirContainingName(self._gitDirName, basedir)
        if not repodir:
            raise gitlib.GITLibError("No %r base repository could be found." % (
                                      self._gitDirName),
                                     cwd=basedir)

        env = koprocessutils.getUserEnv()
        errors = []
        diff = ''

        result = scc_handler.diff(relpaths,
                                  cwd=basedir,
                                  options=options,
                                  external=external,
                                  env=env)
        raw_stdout = result.get('stdout')
        raw_stderr = result.get('stderr')
        if raw_stderr:
            errors.append(raw_stderr)
        if raw_stdout:
            # We update all file names so the "Reveal in Editor"
            # functionality still works. The path given by git's diff output
            # is the relative path from the base repository directory.
            replaceStr = "Index: %s%s" % (os.path.abspath(repodir),
                                          os.sep)
            # Need to escape all the backslashes (Notably on Windows). See bug:
            # http://bugs.activestate.com/show_bug.cgi?id=65911
            if sys.platform.startswith("win"):
                # Git on Windows uses "/" as path separator, Komodo wants
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

    def _do_diff_revisions(self, fileuri1, rev1, fileuri2, rev2, localfilepath,
                           options, external, scc_handler=None):
        """Display diff between two revisions of the one file."""
        basedir, filename = splitFile(localfilepath)
        env = koprocessutils.getUserEnv()
        errors = []
        output = ''

        result = scc_handler.diff([rev1, rev2, filename], cwd=basedir,
                                  options=options, external=external, env=env)
        if result is None:
            raise gitlib.GITLibError("No diff results were returned.",
                                     cwd=basedir)
        rawerror = result.get('stderr', "")
        if rawerror:
            # There was some type of error
            raise gitlib.GITLibError(rawerror,
                                     cwd=basedir)
        return result.get('stdout', '')

    def _do_history(self, fileuri, options, limit, scc_handler=None):
        """List revision history for this file."""
        basedir, filename = splitFile(fileuri)
        env = koprocessutils.getUserEnv()
        errors = []
        output = ''

        result = scc_handler.log(filename, cwd=basedir, env=env, limit=limit)
        if result is None:
            raise gitlib.GITLibError("No history results were found.",
                                     cwd=basedir)

        rawerror = result.get('stderr', "")
        if rawerror:
            # There was some type of error
            raise gitlib.GITLibError(rawerror,
                                     cwd=basedir)

        # result:
        # Returns a list of hits. Each hit is a dict with the following:
        # keys: 'revision', 'date', 'author', 'message'.
        # Now, split up the history rows

        koHistoryList = []
        #print result
        
        encodingSvc = UnwrapObject(self._encodingSvc)
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


    def _do_getRoot(self, fileuri, scc_handler=None, env=None):
        if env is None:
            env = koprocessutils.getUserEnv()
        basedir, relpaths = self.getCommonBaseAndRelativePathsFromURIs([fileuri])
        # no need to do any notifications or anything
        return scc_handler.getrepobase(cwd=basedir, env=env)

    def _do_getKnownRemotes(self, fileuri, scc_handler=None):
        env = koprocessutils.getUserEnv()
        basedir, relpaths = self.getCommonBaseAndRelativePathsFromURIs([fileuri])
        data = scc_handler.getremotes(cwd=basedir, env=env)
        result = []
        for name, url in data["items"].items():
            result.append([url, name])
        return result
    
    def _do_add(self, files, mode, message, scc_handler=None):
        """Open a new file to add it to the repository."""
        return self.__generic_command(scc_handler.add, files)
    
    def _do_init(self, locationURL, options, async_callback=None,
                 terminalHandler=None, scc_handler=None):
        """Initialize a local repo at the given URL."""
        cwd, name = splitFile(locationURL)
        if terminalHandler:
            terminalHandler=UnwrapObject(terminalHandler)
        result = scc_handler.initRepo(cwd=cwd,
                                   command_options=options,
                                   terminalHandler=terminalHandler,
                                   env=self._env)
        return result.get('stderr', '') + result.get('stdout', '')
    
    def _do_stage(self, files, scc_handler=None):
        log.warn("Staging")
        log.warn(files)
        return self.__generic_command(scc_handler.add, files)
        pass
    
    def _do_unstage(self, files, scc_handler=None):
        return self.__generic_command(scc_handler.reset, files)
        pass

    @components.ProxyToMainThreadAsync
    def _do_commit(self, files, message, options, scc_handler=None):
        """Submit open files to the repository."""
        msgfile = self._fileSvc.makeTempFile('.git','w')
        # Ensure the message is encoded to utf-8
        msgfile.puts(message.encode("utf-8"))
        msgfile.flush()
        msgfile.close()
        msgpath = msgfile.path
        try:
            stdout = self.__generic_command(scc_handler.commit, files,
                                            msgpath=msgpath)
            if stdout.startswith("[") and "]" in stdout.splitlines()[0]:
                # we have a plausible revision
                branch, rev = stdout.splitlines()[0][1:].split("]", 1)[0].rsplit(None, 1)
                bag = components.classes["@mozilla.org/hash-property-bag;1"].\
                        createInstance(components.interfaces.nsIWritablePropertyBag2)
                bag.setPropertyAsAString("text", stdout)
                bag.setPropertyAsAString("extra",
                                         " on branch %s as revision %s" % (branch, rev))
                return bag
            return stdout

        finally:
            del msgfile

    def _do_remove(self, files, force, recursive, scc_handler=None):
        """Mark existing scc files to be deleted from the repository."""
        return self.__generic_command(scc_handler.remove, files)
    
    def _do_update(self, files, options, scc_handler=None):
        """Synchronize the client with the repository."""
        return self.__generic_command(scc_handler.pull, files)
    
    def _do_pull(self, files, options, scc_handler=None):
        """Synchronize the client with the repository."""
        return self.__generic_command(scc_handler.pull, files)
    
    def _do_pullRebase(self, files, options, scc_handler=None):
        """Synchronize the client with the repository."""
        return self.__generic_command(scc_handler.pullRebase, files)

    def _do_revert(self, files, options, scc_handler=None):
        """Discard changes from these opened files."""
        return self.__generic_command(scc_handler.revert, files)

    def _do_edit(self, files, scc_handler=None):
        """Prepare the file for scc modification."""
        raise ServerException(nsError.NS_ERROR_NOT_IMPLEMENTED)
    
    def _do_status_count(self, files, scc_handler=None):
        """Retrieve file scc information for these files."""
        basedir, relpaths = self.getCommonBaseAndRelativePathsFromURIs(files)
        if not relpaths:
            relpaths = ["."]
        repo_path = self.getParentDirContainingName(self._gitDirName, basedir)
        env = koprocessutils.getUserEnv()
        return scc_handler.status_count(repo_path, basedir, relpaths, env=env)

    def _do_status(self, files, recursive, options, scc_handler=None):
        """Retrieve file scc information for these files."""
        basedir, relpaths = self.getCommonBaseAndRelativePathsFromURIs(files)
        if not relpaths:
            relpaths = ["."]
        repo_path = self.getParentDirContainingName(self._gitDirName, basedir)
        env = koprocessutils.getUserEnv()
        #print "files %r basedir %r" %(files, basedir)
        # Only want to know about what is modified/added/deleted.
        result = scc_handler.status(repo_path, basedir, relpaths, env=env,
                                    options=options, recursive=recursive,
                                    onlywantmodified=True)

        # TODO: Do something with the errors.
        #raw_stderr = result.get('stderr')
        #if raw_stderr:
        #    errors.append(raw_stderr)

        git_stats = result.get('files', {})

        result = []
        for filepath, stat_info in git_stats.items():
            # stat_info will be a dict with the following keys:
            #    History, Locked, Modified, Path, Status, Switched
            status_string = stat_info.get('status')
            #print "filepath: %r, status_string: %r" % (filepath, status_string, )
            #print ""
            if (status_string and status_string in "CADH?"):
                status = components.interfaces.koISCC.STATUS_UNKNOWN
                if status_string == 'C':
                    status = components.interfaces.koISCC.STATUS_MODIFIED
                elif status_string == 'A':
                    status = components.interfaces.koISCC.STATUS_ADDED
                elif status_string == 'D':
                    status = components.interfaces.koISCC.STATUS_DELETED
                elif status_string == 'H':
                    status = components.interfaces.koISCC.STATUS_OK
                else:
                    status = components.interfaces.koISCC.STATUS_UNKNOWN
                
                fileStatusItem = koSCCFileStatusItem()
                relpath = stat_info['relpath']
                fileStatusItem.relativePath = relpath
                fileStatusItem.uriSpec = uriparse.localPathToURI(filepath);
                fileStatusItem.status = status
                if stat_info.get('Sync') == '*':
                    fileStatusItem.isOutOfSync = True
                result.append(fileStatusItem)
        return result

    def _do_checkout(self, repositoryURL, locationURL, options, async_callback,
                     terminalHandler=None, scc_handler=None):
        cwd, name = splitFile(locationURL, True)
        if terminalHandler:
            terminalHandler=UnwrapObject(terminalHandler)
        result = scc_handler.clone(repositoryURL,
                                   cwd=cwd,
                                   altdirname=name,
                                   command_options=options,
                                   terminalHandler=terminalHandler,
                                   env=self._env)
        return result.get('stderr', '') + result.get('stdout', '')
    
    def _do_checkout_branch(self, path, branch, scc_handler=None):
        """Checkout a branch"""
        basedir, relpaths = self.getCommonBaseAndRelativePathsFromURIs([path])
        repo_path = self.getParentDirContainingName(self._gitDirName, basedir)
        env = koprocessutils.getUserEnv()
        result = scc_handler.checkout_branch(repo_path, branch, env=env)
        return result.get('stderr', '') + result.get('stdout', '')

    def _do_push(self, remoteRepoURL, localRepoURI, localRevs=None,
                 localTags=None, options=None, scc_handler=None, dryRun=False):
        localdir = uriparse.URIToLocalPath(localRepoURI)
        result = scc_handler.push(remoteRepoURL, localdir, localrevs=localRevs,
                                  localtags=localTags, options=options,
                                  dryRun=dryRun, env=self._env)
        return result.get('stderr', '') + result.get('stdout', '')

#---- Git file status checker. Used to continously keep Komodo up-to-date about
#---- the status of git source code manged files.

class KoGITFileChecker(KoSCCChecker, PathHelperMixin):
    name = "git"
    _reg_clsid_ = "{ee4672de-377e-4dd0-912b-65002aeaab77}"
    _reg_contractid_ = "@activestate.com/koFileStatusChecker?type=" + name + ";1"
    _reg_desc_ = "Komodo Git File Status Checker"
    _reg_categories_ = [
         ("category-komodo-file-status",      name),
         ]

    ranking_weight = 35

    def __init__(self):
        KoSCCChecker.__init__(self)
        PathHelperMixin.__init__(self)
        #self.log.setLevel(logging.DEBUG)
        self.git = gitlib.GIT()
        # Ensure the instance is using the appropriate executable.
        self.git.executable = self.svc.executable
        self.enabledPrefName = 'gitEnabled'
        self.executablePrefName = 'gitExecutable'
        self.backgroundEnabledPrefName = 'gitBackgroundCheck'
        self.backgroundDurationPrefName = 'gitBackgroundMinutes'
        self.recursivePrefName = 'gitRecursive'
        self._gitDirName = ".git"

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
        if status == 'C':
            koSccInfo['sccAction'] = 'edit'
        elif status == 'A':
            koSccInfo['sccAction'] = 'add'
        elif status == 'D':
            koSccInfo['sccAction'] = 'delete'
        elif status == 'H':    # normal unmodified file status
            koSccInfo['sccAction'] = ''
        elif status == '?':
            koSccInfo['sccStatus'] = ''
            koSccInfo['sccType'] = ''
            koSccInfo['sccOk'] = '0'
        #print "fpath: %r, sccAction: %r" % (path, koSccInfo['sccAction'])

        cache[cache_key] = koSccInfo

    def setExecutable(self, executable):
        KoSCCChecker.setExecutable(self, executable)
        self.git.executable = self.executable

    def getGitStatus(self, path, reason, repobasedir):
        env = koprocessutils.getUserEnv()
        # execute git on the provided path
        return self.git.status(repobasedir, path, env=env, recursive=False)

    def updateSCCInfo(self, cache, dir_nsUri, reason):
        self.log.debug("updateSCCInfo: %r", dir_nsUri.path)
        # Obtain the path from the nsURI instance.
        path = uriparse.URIToLocalPath(dir_nsUri.spec)

        repo_path = self._cached_repodir_from_path.get(path)
        if repo_path is None:
            # Walk up the directory chain until we find a ".git" file or
            # directory.
            repo_path = self.getParentDirContainingName(self._gitDirName, path)
            # Cache it so we don't need to do this check again.
            self._cached_repodir_from_path[path] = repo_path
        if not repo_path:
            return False

        if path.startswith(repo_path):
            rel_path = path[len(repo_path) + 1:] # strip repo_path and dir separator
            if ".git" in (rel_path, os.path.split(rel_path)[0]):
                # this is inside the git control directory; don't do anything,
                # git will error out instead
                return True

        def reportError(_errors):
            """Report an error
            @param _errors Either a git.GITLibError or a dict with details about
                the error
            """

            if "argv" in _errors:
                cmdline = u"while running \"%s\"" % (u" ".join(_errors["argv"]),)
            else:
                cmdline = u""

            if "cwd" in _errors:
                cwd = u"in %s" % (_errors.get("cwd"),)
            else:
                cwd = u""

            error = _errors.get("error")
            if error is None:
                error = _errors.get("stderr")

            detail = " ".join(filter(bool, [cmdline, cwd]))
            if detail:
                detail = detail[0].upper() + detail[1:]

            if error is not None:
                desc = u"Git status error: %s" % (error, )
                error = u"%s:\n%s" % (detail, error)
            else:
                desc = u"Git status error"
                error = detail

            self.notifyError(desc, error)

        # We don't have any cached info and we haven't check this path yet,
        # so we do that now
        try:
            result = self.getGitStatus(path, reason, repo_path)
        except gitlib.GITLibError, _errors:
            # we get an exception here if the git library call errors out
            reportError(_errors)
            return False

        # The out parameter of git status call is a tuple containing the output
        # from the info command and also the output from the status command.
        # out == (info_output, status_output)
        _errors = result.get('stderr')

        files = result['files']
        #pprint(files)
        #print "got %d files" % (len(files))


        if files:
            
            # The repo base dir won't be returned by status but is technically under
            # version control also
            if path == repo_path:
                files[repo_path] = { 'status': 'H', # Under scc control.
                                     'relpath': '' }
            
            # Cache all the file scc information
            for filepath, fileinfo in files.items():
                uri = uriparse.localPathToURI(filepath)
                nsUri = self.iosvc.newURI(uri, None, None)
                cache_key = nsUri.spec
                cache_key = self._norm_uri_cache_key(cache_key)
                self._cacheSCCInfo(cache, cache_key, filepath, fileinfo)
        elif _errors:
            reportError(result)
            return False

        return True
