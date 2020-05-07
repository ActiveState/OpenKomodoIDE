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


# Special hack necessary to import the "pylib" directory. See bug:
# http://bugs.activestate.com/show_bug.cgi?id=74925
old_sys_path = sys.path[:]
pylib_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "..", "pylib")
sys.path.append(pylib_path)
import hglib
sys.path = old_sys_path


log = logging.getLogger('koHg')
#log.setLevel(logging.DEBUG)


#---- Hg component implementation.

class KoHG(KoSCCBase):
    # Satisfy koISCC.name
    name = "hg"

    # XPCOM component registration settings.
    _com_interfaces_ = [components.interfaces.koISCC,
                        components.interfaces.koISCCDVCS,
                        components.interfaces.nsIObserver]
    _reg_desc_ = "Komodo Hg Support"
    _reg_contractid_ = "@activestate.com/koSCC?type=" + name + ";1"
    _reg_clsid_ = "{62a562af-4c03-4b2d-83c0-6be411b76726}"
    _reg_categories_ = [
         ("category-komodo-scc", name),
         ]

    # Override base class settings.
    executableBaseName = "hg"
    executablePrefName = "hgExecutable"
    supports_stoppable_commands = True

    _hgDirName = ".hg"

    def __init__(self):
        KoSCCBase.__init__(self)
        # Make a generic hg instance to do work with.
        self.hg = hglib.HG()
        # Ensure the instance is using the appropriate executable.
        self.hg.executable = self.get_executable()

    def create_new_scc_handler(self):
        scc_handler = hglib.HG()
        # Ensure the instance uses the same executable as the git service.
        scc_handler.executable = self.get_executable()
        return scc_handler

    _re_checkout_data = re.compile(r"^(%s\s+)?(clone\s+|co\s+|checkout\s+)?(.*?)(\s+.*)?$" % (name, ));

    def getValue(self, name, data, scc_handler=None):
        if not scc_handler:
            scc_handler = self.create_new_scc_handler()
            
        if name == "supports_command":
            if data in ("checkout", "commit", "diff", "history", "checkout_branch",
                        "revert", "status", "update", "push", "init"):
                return "Yes"
            return ""
        elif name == "external_diff":
            if self._globalPrefs.getBoolean('hg_uses_externaldiff', False):
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
                return "%s clone %s %s %s" % (self.get_executable(),
                                              options,
                                              repo_url,
                                              name)
        elif name == "supports_push_feature":
            if data in ("branches", "multiple_branches"):
                return "Yes"
        elif name == "push_options":
            return [["--force", "bool", "options.hg.force.label"]]
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
        elif name == "repository_root":
            env = koprocessutils.getUserEnv()
            repodir = self._do_getRoot(data, scc_handler=scc_handler, env=env)
            return repodir
        return ""

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

    def _do_cat(self, baseNameAsArray, cwd, options, scc_handler=None):
        result = scc_handler.cat(baseNameAsArray, cwd=cwd, env=self._env)
        return result['stdout']

    # Regex used to update the "Index: xyz..." to have a full path reference
    # For the default hg diff formats:
    #   diff -r 92ee960a928d Makefile
    #   diff -r 92ee960a928d -r ee960a928d92 Makefile
    diffUpdateRevPathRegex = re.compile(r"^diff(\s-r\s\w+)*\s(.*?)$", re.MULTILINE)
    # For the the hg/git diff format:
    #   diff --git a/Makefile b/Makefile
    diffUpdateGitPathRegex = re.compile(r"^diff --git a\/(.*)\sb\/(.*)$", re.MULTILINE)

    def _fixDiffPaths(self, repodir, diff):
        # We update all file names so the "Reveal in Editor"
        # functionality still works. The path given by hg's diff output
        # is the relative path from the base repository directory.
        replaceStr = "Index: %s%s" % (os.path.abspath(repodir),
                                      os.sep)
        # Need to escape all the backslashes (Notably on Windows). See bug:
        # http://bugs.activestate.com/show_bug.cgi?id=65911
        filepath_regex = self.diffUpdateGitPathRegex
        if not filepath_regex.match(diff):
            # Try the revisions version
            filepath_regex = self.diffUpdateRevPathRegex
        if sys.platform.startswith("win"):
            # Git on Windows uses "/" as path separator, Komodo wants
            # the path in the Windows format, using the "\" separator.
            # http://bugs.activestate.com/show_bug.cgi?id=80288
            def replaceFn(match):
                return "%s%s" % (replaceStr, match.group(2).replace("/", "\\"))
            diff = filepath_regex.sub(replaceFn, diff)
        else:
            replaceStr = replaceStr.replace("\\", "\\\\") + r"\2"
            diff = filepath_regex.sub(replaceStr, diff)
        return diff

    def _do_diff(self, files, options, external, scc_handler=None):
        """Display diff of the client file with the repository file."""
        basedir, relpaths = self.getCommonBaseAndRelativePathsFromURIs(files)
        #print "relpaths %r basedir %r" %(relpaths, basedir)
        if not relpaths:
            # Diff is on the folder itself.
            relpaths.append(".")

        return self._do_diff_relative(basedir, relpaths, options,
                                      external, scc_handler=scc_handler)

    def _do_diff_relative(self, baseURI, relpaths, options, external, scc_handler=None):
        """Display diff of the client files relative to the base directory."""

        basedir = uriparse.URIToLocalPath(baseURI)

        repodir = self.getParentDirContainingDirname(self._hgDirName, basedir)
        if not repodir:
            raise hglib.HGLibError("No %r base repository could be found." % (
                                      self._hgDirName))

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
            diff = self._fixDiffPaths(repodir, raw_stdout)

        # XXX - Do something with errors?
        return self.convertDiffResult(diff)


    # TODO: Implement these functions to do the actual work!


    def _do_diff_revisions(self, fileuri1, rev1, fileuri2, rev2, localfilepath,
                           options, external, scc_handler=None):
        """Display diff between two revisions of the one file."""
        basedir, filename = splitFile(localfilepath)
        repodir = self.getParentDirContainingDirname(self._hgDirName, basedir)
        if not repodir:
            raise hglib.HGLibError("No %r base repository could be found." % (
                                      self._hgDirName))

        env = koprocessutils.getUserEnv()
        errors = []
        output = ''

        result = scc_handler.diff(["-r", rev1, "-r", rev2, filename],
                                  cwd=basedir, options=options, env=env)
        if result is None:
            raise hglib.HGLibError("No diff results were returned.")
        rawerror = result.get('stderr', "")
        if rawerror:
            # There was some type of error
            raise hglib.HGLibError(rawerror)

        diff = result.get('stdout', '')
        if diff:
            diff = self._fixDiffPaths(repodir, diff)
        return self.convertDiffResult(diff)

    def _do_history(self, fileuri, options, limit, scc_handler=None):
        """List revision history for this file."""
        basedir, filename = splitFile(fileuri)
        env = koprocessutils.getUserEnv()
        errors = []
        output = ''

        result = scc_handler.log(filename, cwd=basedir, env=env, limit=limit)
        if result is None:
            raise hglib.HGLibError("No history results were found.")

        rawerror = result.get('stderr', "")
        if rawerror:
            # There was some type of error
            raise hglib.HGLibError(rawerror)

        # result:
        # Returns a list of hits. Each hit is a dict with the following:
        # keys: 'revision', 'date', 'author', 'message'.
        # Now, split up the history rows

        koHistoryList = []
        encodingSvc = UnwrapObject(self._encodingSvc)
        #print result
        for revision in result['log']:
            koHistory = koSCCHistoryItem()
            koHistory.version = revision.get('revision', '')
            author, encoding, bom = encodingSvc.getUnicodeEncodedStringUsingOSDefault(revision.get('author', ''))
            koHistory.author  = author
            koHistory.date    = revision.get('date', '')
            koHistory.action  = ''  # No action given
            message, encoding, bom = encodingSvc.getUnicodeEncodedStringUsingOSDefault(revision.get('message', ''))
            koHistory.message = message
            koHistory.uri     = fileuri
            koHistoryList.append(koHistory)
        return koHistoryList

    def _do_add(self, files, mode, message, scc_handler=None):
        """Open a new file to add it to the repository."""
        return self.__generic_command(scc_handler.add, files)
    
    def _do_init(self, locationURL, options, async_callback=None, terminalHandler=None, scc_handler=None):
        """Initialize a local repo at the given URL."""
        cwd, name = splitFile(locationURL)
        if terminalHandler:
            terminalHandler=UnwrapObject(terminalHandler)
        result = scc_handler.initRepo(cwd=cwd,
                                   command_options=options,
                                   terminalHandler=terminalHandler,
                                   env=self._env)
        return result.get('stderr', '') + result.get('stdout', '')
    

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
            stdout = self.__generic_command(scc_handler.commit, files,
                                            options="-v", msgpath=msgpath)
            if stdout:
                lastline = stdout.splitlines()[-1]
                rev = re.match(r"committed changeset \d+:([0-9a-f]{12})", lastline)
                if rev:
                    bag = components.classes["@mozilla.org/hash-property-bag;1"].\
                            createInstance(components.interfaces.nsIWritablePropertyBag2)
                    bag.setPropertyAsAString("text", stdout)
                    bag.setPropertyAsAString("extra",
                                             " as revision %s" % (rev.group(1),))
                    return bag
            return stdout
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
        if not relpaths:
            relpaths = ["."]
        env = koprocessutils.getUserEnv()
        #print "relpaths %r basedir %r" %(relpaths, basedir)
        # Only want to show the modified files:
        #   -m --modified   show only modified files
        #   -a --added      show only added files
        #   -r --removed    show only removed files
        #   -d --deleted    show only deleted (but tracked) files
        options = "-m -a -r -d"
        result = scc_handler.status(relpaths, cwd=basedir, env=env,
                                    options=options,
                                    recursive=recursive)
        # TODO: Do something with the errors.
        #raw_stderr = result.get('stderr')
        #if raw_stderr:
        #    errors.append(raw_stderr)
        hg_stats = result.get('files', {})

        result = []
        for filepath, stat_info in hg_stats.items():
            # stat_info will be a dict with the following keys:
            #    History, Locked, Modified, Path, Status, Switched
            status_string = stat_info.get('status')
            #print "status_string: %r" % (status_string, )
            #print ""
            if (status_string and status_string in "CARMI!?"):
                status = components.interfaces.koISCC.STATUS_UNKNOWN
                if status_string == 'M':
                    status = components.interfaces.koISCC.STATUS_MODIFIED
                elif status_string == 'A':
                    status = components.interfaces.koISCC.STATUS_ADDED
                elif status_string == 'R':
                    status = components.interfaces.koISCC.STATUS_DELETED
                elif status_string == 'C':
                    status = components.interfaces.koISCC.STATUS_OK
                elif status_string == '!':
                    status = components.interfaces.koISCC.STATUS_CONFLICT
                fileStatusItem = koSCCFileStatusItem()
                relpath = stat_info['relpath']
                fileStatusItem.relativePath = relpath
                fileStatusItem.uriSpec = uriparse.localPathToURI(filepath);
                fileStatusItem.status = status
                if stat_info.get('Sync') == '*':
                    fileStatusItem.isOutOfSync = True
                result.append(fileStatusItem)
        return result
    
    def _do_checkout_branch(self, path, branch, scc_handler=None):
        """Checkout a branch"""
        basedir, relpaths = self.getCommonBaseAndRelativePathsFromURIs([path])
        env = koprocessutils.getUserEnv()
        rootdir = self._do_getRoot(path, scc_handler, env)
        result = scc_handler.checkout_branch(rootdir, branch, env=env)
        return result.get('stderr', '') + result.get('stdout', '')

    def _do_checkout(self, repositoryURL, locationURL, options, async_callback,
                     terminalHandler=None, scc_handler=None):
        path = uriparse.URIToLocalPath(locationURL)
        if terminalHandler:
            terminalHandler=UnwrapObject(terminalHandler)
        result = scc_handler.clone(repositoryURL,
                                   path,
                                   command_options=options,
                                   terminalHandler=terminalHandler,
                                   env=self._env)
        return result.get('stderr', '') + result.get('stdout', '')

    def _do_push(self, remoteRepoURL, localRepoURI, localRevs=None,
                 localTags=None, options=None, dryRun=False, scc_handler=None):
        localdir = uriparse.URIToLocalPath(localRepoURI)
        result = scc_handler.push(remoteRepoURL, localdir, localrevs=localRevs,
                                  localtags=localTags, options=options,
                                  dryRun=dryRun, env=self._env)
        return result.get('stderr', '') + result.get('stdout', '')

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

#---- Hg file status checker. Used to continously keep Komodo up-to-date about
#---- the status of hg source code manged files.

class KoHGFileChecker(KoSCCChecker, PathHelperMixin):
    name = "hg"
    _reg_clsid_ = "{c0727f00-0d19-4c89-8e2d-fa758185f19a}"
    _reg_contractid_ = "@activestate.com/koFileStatusChecker?type=" + name + ";1"
    _reg_desc_ = "Komodo Hg File Status Checker"
    _reg_categories_ = [
         ("category-komodo-file-status",      name),
         ]

    ranking_weight = 35

    def __init__(self):
        KoSCCChecker.__init__(self)
        PathHelperMixin.__init__(self)
        #self.log.setLevel(logging.DEBUG)
        self.hg = hglib.HG()
        # Ensure the instance is using the appropriate executable.
        self.hg.executable = self.svc.executable
        self.enabledPrefName = 'hgEnabled'
        self.executablePrefName = 'hgExecutable'
        self.backgroundEnabledPrefName = 'hgBackgroundCheck'
        self.backgroundDurationPrefName = 'hgBackgroundMinutes'
        self.recursivePrefName = 'hgRecursive'
        self._hgDirName = ".hg"

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
        if status == 'M':
            koSccInfo['sccAction'] = 'edit'
        elif status == 'A':
            koSccInfo['sccAction'] = 'add'
        elif status == 'R':
            koSccInfo['sccAction'] = 'delete'
        elif status == 'C':    # clean - unmodified file status
            koSccInfo['sccAction'] = ''
        elif (status == '?' or     # file is not in repo
              status == 'I'):      # file is ignored (.hgignore)
            koSccInfo['sccStatus'] = ''
            koSccInfo['sccOk'] = '0'
            koSccInfo['sccType'] = ''
        elif status == '!':    # deleted, but still tracked
            koSccInfo['sccConflict'] = 1
        elif status == ' ':    # previous added file was copied here
            koSccInfo['sccConflict'] = 0
        #print "fpath: %r, sccAction: %r" % (path, koSccInfo['sccAction'])

        cache[cache_key] = koSccInfo

    def setExecutable(self, executable):
        KoSCCChecker.setExecutable(self, executable)
        self.hg.executable = self.executable

    def getHgStatus(self, path, reason):
        env = koprocessutils.getUserEnv()
        # Execute hg in the directory provided.
        return self.hg.status(".", cwd=path, env=env)

    def updateSCCInfo(self, cache, dir_nsUri, reason):
        self.log.debug("updateSCCInfo: %r", dir_nsUri.path)
        # Obtain the path from the nsURI instance.
        dir_spec = dir_nsUri.spec
        if dir_spec.endswith("/.hg") or "/.hg/" in dir_spec:
            # Don't check paths that contain ".hg"
            return False
        path = uriparse.URIToLocalPath(dir_spec)

        repo_path = self._cached_repodir_from_path.get(path)
        if repo_path is None:
            # Walk up the directory chain until we find a ".hg" directory.
            repo_path = self.getParentDirContainingDirname(self._hgDirName, path)
            # Cache it so we don't need to do this check again.
            self._cached_repodir_from_path[path] = repo_path
        if not repo_path:
            return False

        # We don't have any cached info and we haven't check this path yet,
        # so we do that now
        try:
            result = self.getHgStatus(path, reason)
        except hglib.HGLibError, e:
            # we get an exception here if the hg library call errors out
            self.notifyError('Hg status error, click for details', e)
            return False

        # The out parameter of hg status call is a tuple containing the output
        # from the info command and also the output from the status command.
        # out == (info_output, status_output)
        _errors = result.get('stderr')

        files = result['files']
        #pprint(files)
        #print "got %d files" % (len(files))

        if files:
            time_now = time.time()
            # Ensure the nsURI is from the directory containing ".hg".
            uri = uriparse.localPathToURI(path)
            if not uri.endswith("/"):
                uri += "/"
            dir_nsUri = self.iosvc.newURI(uri, None, None)
            lenPrePath = len(dir_nsUri.prePath)
            # Cache all the file scc information
            for filepath, fileinfo in files.items():
                # Path is given as the relative local file path from
                # the directory where the command was executed.
                #   path\\file.txt
                #   path/file.txt
                relpath = fileinfo.get("relpath")
                if self._is_windows:
                    relpath = relpath.replace("\\", "/")
                cache_key = dir_nsUri.resolve(relpath.encode("utf-8")).rstrip("/")
                cache_key = self._norm_uri_cache_key(cache_key)
                fpath = cache_key[lenPrePath:]
                #print "cache_key: %r" % (cache_key, )
                #print "fpath: %r" % (fpath, )
                self._cacheSCCInfo(cache, cache_key, fpath, fileinfo)
        elif _errors:
            self.notifyError('Hg status error, click for details',
                             _errors)
            return False

        return True
