#!/usr/bin/env python

# Copyright (c) 2008 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
import sys
import re
import types
import pprint
import logging

# Komodo modules.
import process
try:
    from xpcom import ServerException, nsError
except ImportError:
    ServerException = Exception

log = logging.getLogger('gitlib')
#log.setLevel(logging.DEBUG)

#---- exceptions

class GITLibError(ServerException):
    def __init__(self, *args, **kwargs):
        for key in ("error", "cwd"):
            if kwargs.get(key, None) is not None:
                setattr(self, key, kwargs[key])
                del kwargs[key]
        log.debug(kwargs.items())
        if ServerException is Exception:
            ServerException.__init__(self, *args) # no XPCOM
        else:
            ServerException.__init__(self, nsError.NS_ERROR_FAILURE, *args)
    def __getitem__(self, key):
        return getattr(self, key)
    def __contains__(self, key):
        return hasattr(self, key)
    def get(self, key, default=None):
        if key in self:
            return self[key]
        return default

class GIT:
    """A proxy to the Git command line app."""
    def __init__(self, executable='git', **options):
        self.executable = executable
        self.optd = options
        # Abortable process handle.
        self._processHelper = process.AbortableProcessHelper()

    def _runCommand(self, argv, cwd=None, env=None, input=None,
                    ignore_exit_status=False, terminalHandler=None, includeErrorCode=False):
        """Prepare and run the given arg vector, 'argv', and return the
        results.  Returns (<stdout>, <stderr>).
        """
        if type(argv) not in (types.ListType, types.TupleType):
            raise GITLibError("_runCommand:: argv is not a list: %r" % (argv, ),
                              cwd=cwd)
        # Remove any empty options from the cmd list.
        argv = [ x for x in argv if x ]
        log.debug("Running %r in cwd %r", argv, cwd)
        output = None
        if env is None:
            import koprocessutils
            env = koprocessutils.getUserEnv()

        # Komodo can only handle svn messages in english.
        # http://bugs.activestate.com/show_bug.cgi?id=45677
        env['LC_MESSAGES'] = 'en_US'
        # Set LANGUAGE too, otherwise it may still come back in another lang
        # http://bugs.activestate.com/show_bug.cgi?id=68615
        env['LANGUAGE'] = 'en_US'

        # A light wrapper around process.ProcessOpen.
        p = self._processHelper.ProcessOpen(cmd=argv, cwd=cwd, env=env,
                                            universal_newlines=True)
        try:
            if input:
                input = input.encode("utf-8")
            if terminalHandler:
                terminalHandler.hookIO(p.stdin, p.stdout, p.stderr, " ".join(argv))
                p.wait()
                # Output and errors have gone to the terminal.
                output = ''
                error = ''
            else:
                output, error = p.communicate(input)
            retval = p.returncode
            p.close()
        finally:
            self._processHelper.ProcessDone()

        if retval != 0 and not ignore_exit_status:
            # If the error message _looks_ like a fatal error, use it. Otherwise
            # prefer having no details over being possibly wrong.
            shorterror = ''.join(error)
            if not shorterror.startswith("fatal:"):
                shorterror = None
            raise GITLibError("Error %s running '%s'\n  in '%s': \n%s"\
                              % (retval, ' '.join(argv), cwd, ''.join(error)),
                              error=shorterror,
                              cwd=cwd)

        if includeErrorCode:
            return output, error, retval
        else:
            return output, error

    def abort(self):
        self._processHelper.ProcessAbort()

    def add(self, files, cwd=None, options=None, env=None):
        result = {}
        argv = [self.executable, "add"]
        if options:
            argv += options.split(" ")
        argv += files
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error
        return result
    
    def initRepo(self, cwd=None, command_options=None, terminalHandler=None, env=None):
        result = {}
        argv = [self.executable, "init"]
        if command_options:
            argv += command_options.split(" ")
        output, error = self._runCommand(argv,
                                         cwd=cwd,
                                         env=env,
                                         terminalHandler=terminalHandler)
        result['stdout'] = output
        result['stderr'] = error
        return result
    
    def reset(self, files, cwd=None, options=None, env=None):
        result = {}
        argv = [self.executable, "reset"]
        if options:
            argv += options.split(" ")
        argv += files
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error
        return result

    def cat(self, baseNameAsArray, cwd, options=None, env=None):
        if len(baseNameAsArray) != 1:
            raise GitLibError("cat takes exactly one argument")
        argv = [self.executable, "show", "HEAD:./" + baseNameAsArray[0]]
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        return { 'stdout':output, 'stderr':error }
    
    def checkout_branch(self, cwd=None, branch="master", env=None):
        result = {}
        argv = [self.executable, "checkout", branch]
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error
        return result

    def clone(self, urls, cwd=None, altdirname=None, command_options="",
              terminalHandler=None, env=None):
        if type(urls) in types.StringTypes:
            urls = [urls]
        argv = [self.executable, 'clone']
        if command_options:
            # Example: "--rev 103 --clean"
            argv += command_options.split(" ")
        argv += urls
        if altdirname:
            argv.append(altdirname)
        output, error = self._runCommand(argv,
                                         cwd=cwd,
                                         env=env,
                                         terminalHandler=terminalHandler)
        result = {}
        result['stdout'] = output
        result['stderr'] = error
        return result

    def commit(self, files, cwd=None, options=None, env=None, msgpath=None):
        result = {}
        argv = [self.executable, "commit"]
        if options:
            argv += options.split(" ")
        if msgpath is not None:
            argv += [ "-F", msgpath ]
        argv += files
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error
        return result

    def diff(self, files, cwd=None, options=None, external=False, env=None):
        result = {}
        if external:
            argv = [self.executable, "difftool"]
        else:
            argv = [self.executable, "diff"]
        # Separates `options` from `args` in git. #2031.  Fails when file
        # has been deleted
        argv += ["--"]
        if options:
            argv += options.split(" ")
        if files:
            argv += files
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error
        return result

    log_revisions_re = re.compile(
        r'''commit\s+(?P<revision>\w*?)\n''' \
         '''Author:\s+(?P<author>.*?)\n''' \
         '''Date:\s+(?P<date>.*?)\n''' \
         '''\n'''
    )

    def _formatLogMessage(self, message):
        result = []
        for line in message.rstrip().splitlines(0):
            if line.startswith("    "):
                result.append(line[4:])
            else:
                result.append(line)
        return "\n".join(result) + "\n"

    def getrepobase(self, cwd, env=None):
        """ Get the root of the working tree from a subdirectory """
        if not os.path.isdir(cwd):
            cwd = os.path.dirname(cwd)
        if self._versionInRange(minVersion="1.7.0"):
            output, stderr = self._runCommand([self.executable, "rev-parse",
                                               "--show-toplevel"],
                                              cwd=cwd, env=env)
            return os.path.abspath(output.strip()) # needed to normalize on win32
        # git < 1.7.0, no --show-toplevel, try using --show-cdup
        output, stderr = self._runCommand([self.executable, "rev-parse",
                                           "--show-cdup"],
                                          cwd=cwd, env=env)
        return os.path.abspath(os.path.join(cwd, output.strip()))
    
    def getheadref(self, cwd, env=None):
        """ Get a reference to the current state of the repository HEAD """
        if not os.path.isdir(cwd):
            cwd = os.path.dirname(cwd)
        output, stderr = self._runCommand([self.executable, "rev-parse", "HEAD"],
                                          cwd=cwd, env=env)
        return output.strip()
    

    def getremotes(self, cwd, env=None):
        """ Get the known remote repositories
        @returns {dict} Remote repositories; the key is the name of the repo
            (e.g. "origin"), and the value {str} is the URL of the remote.
        """
        result = {"items": {}}
        # using git remote instead of git config remote.*.url in case there's
        # overrides (url.*.insteadOf / url.*.pushInsteadOf)
        argv = [self.executable, "remote", "-v"]
        stdout, stderr = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = stdout
        result['stderr'] = stderr
        for line in stdout.splitlines():
            if not line.endswith(" (push)"):
                continue
            name, url = line[:-len(" (push)")].rsplit(None, 1)
            result["items"][name] = url
        return result

    def getdefaultremote(self, cwd, branch=None, env=None):
        """ Get the default remote to push to
        @returns {str} The name of the remote, or possibly a remote URL.
        """
        if branch is None:
            argv = [self.executable, "describe", "--all", "--candidates=0",
                    "HEAD"]
            stdout, stderr = self._runCommand(argv, cwd=cwd, env=env)
            branch = stdout.strip()
            if branch.startswith("heads/"):
                branch = branch[len("heads/"):]

        if not branch:
            raise GITLibError("Failed to find current branch")

        argv = [self.executable, "config", "--get",
                "branch.%s.remote" % (branch,)]
        stdout, stderr = self._runCommand(argv, cwd=cwd, env=env,
                                          ignore_exit_status=True)
        remote = stdout.strip() or "origin"
        return self.getremotes(cwd, env=env)["items"].get(remote, remote)

    def getbranches(self, cwd, env=None):
        """ Get the branches available for a given repository
        @param cwd {str} The path to th repo
        @param env {dict} environment
        @returns {list of str} The known branch names
        """
        argv = [self.executable, "for-each-ref", "--format=%(refname)",
                "refs/heads/"]
        stdout, stderr = self._runCommand(argv, cwd=cwd, env=env)
        branches = set()
        for line in stdout.splitlines():
            if line.startswith("refs/heads/"):
                line = line[len("refs/heads/"):]
            branches.add(line.strip())
        return list(sorted(branches))

    def getcurrentbranch(self, cwd, env=None):
        """ Get the currently checked out branch
        @param cwd {str} The path to th repo
        @param env {dict} environment
        @returns {str or None} The checked out branch, or None if a detached
            HEAD is checked out (i.e. no named branches)
        """
        argv = [self.executable, "branch", "--no-color"]
        stdout, stderr = self._runCommand(argv, cwd=cwd, env=env)
        for line in stdout.splitlines():
            if line.startswith("* "):
                return line[2:].strip()
        return None

    def gettags(self, cwd, env=None):
        """ Get the tags available for a given repository
        @param cwd {str} The path to th repo
        @param env {dict} environment
        @returns {list of str} The known tag names
        """
        stdout, stderr = self._runCommand([self.executable, "tag", "-l"],
                                          cwd=cwd, env=env)
        tags = set()
        for line in stdout.splitlines():
            tags.add(line.strip())
        return list(sorted(tags))

    def log(self, path, cwd=None, options=None, env=None, limit=-1):
        result = {}
        argv = [self.executable, "log", "--pretty=medium"]
        if self._versionInRange(minVersion="1.7.2"):
            # git version 1.7.2 added --no-decorate, as well as the ability to
            # specify log.decorate in the config.  Add --no-decorate so that if
            # the user has set log.decorate, we don't get extra junk in the log
            # output, causing the decorated entries to be skipped.
            argv += ["--no-decorate"]
        if options:
            argv += options.split(" ")
        if limit > 0:
            argv += ["--max-count=%d" % limit]
        argv.append(path)
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error

        log_items = []
        matchIterator = self.log_revisions_re.finditer(output)
        try:
            match = matchIterator.next()
        except StopIteration:
            match = None
        while match:
            text_start = match.end()
            try:
                matchNext = matchIterator.next()
            except StopIteration:
                matchNext = None
            if matchNext:
                message = output[text_start:matchNext.start()]
            else:
                message = output[text_start:]

            log_items.append( {
                'revision': match.group('revision'),
                'author': match.group('author'),
                'date': match.group('date'),
                'message': self._formatLogMessage(message)
                } )
            match = matchNext

        result['log'] = log_items
        return result

    def pull(self, files, cwd=None, options=None, env=None):
        result = {}
        argv = [self.executable, "pull"]
        if options:
            argv += options.split(" ")
        # Files doesn't make sense for git pull.
        #argv += files
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error
        return result
    
    def pullRebase(self, files, cwd=None, options=None, env=None):
        result = {}
        argv = [self.executable, "pull", "--rebase"]
        if options:
            argv += options.split(" ")
        # Files doesn't make sense for git pull.
        #argv += files
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error
        return result

    def remove(self, files, cwd=None, options=None, env=None):
        result = {}
        argv = [self.executable, "rm"]
        if options:
            argv += options.split(" ")
        argv += files
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error
        return result

    def revert(self, files, cwd=None, options=None, env=None):
        if self._versionInRange(maxVersion="1.6.99"):
            # git < 1.7.0 does not have status --porcelain; use the old way,
            # which is 1) deprecated, 2) slower
            log.debug("git revert: version %r too old, using deprecated codepath",
                      self._version)
            return self._revert_1_6(files, cwd=cwd, options=options, env=env)

        log.debug("revert: %s in %s", files, cwd)
        if options is not None:
            raise GITLibError("options= Not supported")
        if not files:
            files = ["."]
        argv = [self.executable, "status", "--porcelain",
                "--untracked-files=normal", "--"] + files
        output, error = self._runCommand(argv, cwd=cwd, env=env)

        to_reset, to_checkout = set(), set()
        for line in output.splitlines():
            if len(line) < 3:
                continue # invalid line
            status, name = line[:2], line[3:]
            if status[0] in "AMD":
                to_reset.add(name)
            if status.strip() in "MD": # M or D, staged or not
                to_checkout.add(name)

        # git status always outputs relative to the root of the repo
        repobasedir = self.getrepobase(cwd, env=env)

        result = {}
        if len(to_reset) > 0:
            argv = [self.executable, "reset", "-q", "--"] + list(to_reset)
            stdout, stderr = self._runCommand(argv, cwd=repobasedir, env=env)
        else:
            stdout, stderr = "", ""
        if len(to_checkout) > 0:
            argv = [self.executable, "checkout", "--"] + list(to_checkout)
            output, error = self._runCommand(argv, cwd=repobasedir, env=env)
        else:
            output, error = "", ""
        result["stdout"] = "\n".join(filter(bool, (stdout, output))) or ""
        result["stderr"] = "\n".join(filter(bool, (stderr, error))) or ""
        return result

    def _revert_1_6(self, files, cwd=None, options=None, env=None):
        log.debug("revert: %s in %s", files, cwd)
        if options is not None:
            raise GITLibError("options= Not supported")
        if not files:
            files = ["."]

        result = {}

        # the two git diff --name-status commands output relative to the repo base
        repobasedir = self.getrepobase(cwd, env=env)

        # `git reset` files in the cache
        argv = [self.executable, "diff", "--name-status", "--cached", "-z", "--"] + files
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        to_reset = set()
        data = output.split("\x00")
        for name, status in zip(data[1::2], data[::2]):
            if status in "AMD":
                to_reset.add(name)
        if len(to_reset) > 0:
            argv = [self.executable, "reset", "--mixed", "--"] + list(to_reset)
            stdout, stderr = self._runCommand(argv, cwd=repobasedir, env=env, ignore_exit_status=True)
        else:
            stdout, stderr = "", ""

        # `git checkout` files that are dirty
        argv = [self.executable, "diff", "--name-status", "-z", "--"] + files
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        to_checkout = set()
        data = output.split("\x00")
        for name, status in zip(data[1::2], data[::2]):
            if status in "MD":
                to_checkout.add(name)
        if len(to_checkout) > 0:
            argv = [self.executable, "checkout", "--"] + list(to_checkout)
            output, error = self._runCommand(argv, cwd=repobasedir, env=env)
        else:
            output, error = "", ""

        result["stdout"] = "\n".join(filter(bool, (stdout, output))) or ""
        result["stderr"] = "\n".join(filter(bool, (stderr, error))) or ""
        return result
    
    def status_count(self, repobasedir, cwd, relpaths=None, env=None):
        """Check the status of files in the repository, return number of results
        @param repobasedir {str} Base directory for the repository.
        @param cwd {str} The base directory for the given relpaths.
        @param relpaths {list} Optional - The relative file paths from cwd that
                               are to be checked.
        @param env {dict} Optional - Environment variables.
        """
        # sometimes it's inconvenient to have the repo base dir...
        if repobasedir is None:
            repobasedir = self.getrepobase(cwd, env=env)

        # Unfortunately, status by itself does not give us enough information,
        # so we get git to tell us the files that are different, and we assume
        # all other files are under git control as unmodified.

        argv = [self.executable, "status", "--porcelain", "-z"]

        if not relpaths:
            relpaths = ["."]
            
        argv += ["--"] + relpaths
        output, error = self._runCommand(argv, cwd=cwd, env=env)

        # Parse and overwrite the files that are different.
        found_results = False
        count = 0
        for line in output.split("\0"):
            if len(line) < 4:
                # Not enough info in this line.
                continue
            count = count + 1
                
        return count

    def status(self, repobasedir, cwd, relpaths=None, options=None, env=None,
               recursive=False, onlywantmodified=False):
        """Check the status of files in the repository
        @param repobasedir {str} Base directory for the repository.
        @param cwd {str} The base directory for the given relpaths.
        @param relpaths {list} Optional - The relative file paths from cwd that
                               are to be checked.
        @param options {str} Optional - Options to add to status command.
        @param env {dict} Optional - Environment variables.
        @param recursive {bool} Optional - whether to recurse into subdirs.
        @param onlywantmodified {bool} Optional - when true, only returns with
                                   files that have been changed.
        """
        files = {}
        result = {
            'cwd': cwd,
            'files': files
        }

        if self._versionInRange(maxVersion="1.6.99"):
            # git < 1.7.0 does not have status --porcelain; use the old way,
            # which is 1) deprecated, 2) slower
            log.debug("git status: version %r too old, using deprecated codepath",
                      self._version)
            return self._status_1_6(repobasedir, cwd, relpaths=relpaths,
                                    options=options, env=env, recursive=recursive,
                                    onlywantmodified=onlywantmodified)

        # sometimes it's inconvenient to have the repo base dir...
        if repobasedir is None:
            repobasedir = self.getrepobase(cwd, env=env)

        # Unfortunately, status by itself does not give us enough information,
        # so we get git to tell us the files that are different, and we assume
        # all other files are under git control as unmodified.

        argv = [self.executable, "status", "--porcelain", "-z"]

        if recursive:
            argv.append("--untracked-files=all")
        else:
            argv.append("--untracked-files=normal")

        if options:
            argv += options.split(" ")
        if not relpaths:
            relpaths = ["."]
        argv += ["--"] + relpaths
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error
        result['argv'] = argv

        from os.path import join, exists, isdir, isfile
        is_windows = sys.platform.startswith("win")
        
        # Parse and overwrite the files that are different.
        found_results = False
        for line in output.split("\0"):
            if len(line) < 4:
                # Not enough info in this line.
                continue
            found_results = True
            repo_relpath = line[3:]
            if is_windows:
                # Convert to the Windows path format.
                repo_relpath = repo_relpath.replace("/", "\\")
            repo_relpath = repo_relpath.rstrip(os.sep)
            fullpath = join(repobasedir, repo_relpath)
            cwd_relpath = fullpath[len(cwd):].lstrip(os.sep)
            assert fullpath.lower().startswith(cwd.lower()), \
                "Full path %s does not start with cwd %s" % (fullpath, cwd)
            if not recursive and os.sep in cwd_relpath:
                # This file resides in another directory.
                continue
            x, y = line[0:2]
            if x == 'A':
                files[fullpath] = { 'status': 'A',  # Added
                                    'relpath': cwd_relpath }
            elif x == 'D' or y == 'D':
                files[fullpath] = { 'status': 'D',  # Deleted
                                    'relpath': cwd_relpath }
            elif x == 'M' or y == 'M':
                files[fullpath] = { 'status': 'C',  # Changed
                                    'relpath': cwd_relpath }
            elif x in '?!' or y in '?!':
                files[fullpath] = { 'status': '?',  # Unknown 
                                    'relpath': cwd_relpath }
                
        if not found_results:
            # We found no results; this can mean no changes in this directory,
            # _or_ this directory is being ignored.  Ask about the cwd.
            parent, leaf = os.path.split(cwd)
            if parent.startswith(repobasedir): # check that we didn't go outside
                argv = [self.executable, "check-ignore", leaf]
                output, error, code = self._runCommand(argv, cwd=parent, env=env, ignore_exit_status=True, includeErrorCode=True)
                if code != 1: # 0 means ignored, 1 means not ignored, 128 means fatal exception
                    # Yep, this directory is being ignored; mark this whole
                    # subtree as ignored and return.  This prevents us from
                    # marking it all as unmodified instead (below).
                    files[cwd] = { 'status': '?',
                                   'relpath': '.' }
                    return result

        # Assume all other files are under scc control and are unmodified. Uses
        # os.listdir, or os.walk to discover the unmodified files.
        for relpath in relpaths:
            path = join(cwd, relpath)
            if path in files:
                # Already have status for this file.
                continue
            if isdir(path):
                if onlywantmodified:
                    # Don't recurse into directories, as we already have
                    # all the changed file information from the status
                    # command.
                    continue
                # Just collect the files in the current working directory.
                for f in os.listdir(cwd):
                    fullpath = join(cwd, f)
                    if fullpath in files:
                        # Already have status for this file.
                        continue
                    if isfile(fullpath):
                        cwd_relpath = fullpath[len(cwd):].lstrip(os.sep)
                        files[fullpath] = { 'status': 'H', # Under scc control.
                                            'relpath': cwd_relpath }
            elif exists(path):
                # Files.
                files[path] = { 'status': 'H', # Under scc control.
                                'relpath': relpath }
        return result

    def _status_1_6(self, repobasedir, cwd, relpaths=None, options=None,
                    env=None, recursive=False, onlywantmodified=False):
        """Git status compatiblity for git >= 1.6 < 1.7.0
        The parameters are the same as status().
        """
        files = {}
        result = {
            'cwd': cwd,
            'files': files
        }

        argv = [self.executable, "ls-files", "-t", "--directory"]
        if options is None:
            argv += ["--modified", "--deleted", "--cached", "--others", "--killed"]
        else:
            argv += options.split(" ")
        argv += ["--"] + (relpaths or ["."]) # given paths, or cwd
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error

        for line in output.splitlines():
            try:
                status, relpath = line.split(" ", 1)
            except ValueError:
                continue # no space in line (unpack error)
            if len(status) == 1 and status in "HSMRCK?":
                if not recursive and "/" in relpath:
                    # filter out sub-directories - git doesn't have a
                    # non-recursive mode
                    continue
                fullpath = os.path.join(cwd, relpath)
                log.debug("status: ls-files says %r is %r",
                          fullpath, status)
                files[fullpath] = { 'status': status,
                                    'relpath': relpath }

        # unfortunately, ls-files by itself does not give us enough information,
        # as it does not distinguish between added files and modified files.  We
        # use a second call to the status command to obtain the extra details.
        argv = [self.executable, "status", "--untracked-files=normal"]
        argv += ["--"] + (relpaths or ["."])
        # old versions of git will return an error if nothing needs to be
        # committed (wtf?), so ignore the exit status here
        output, error = self._runCommand(argv, cwd=cwd, env=env,
                                         ignore_exit_status=True)
        result['stdout'] += output
        result['stderr'] += error

        # cheapo enum for stages
        STAGED, UNSTAGED, UNTRACKED = ("staged",), ("unstaged",), ("untracked",)

        section = None
        for line in output.splitlines():
            if not line.startswith("#"):
                continue
            if line.startswith("# Changes to be committed:"):
                section = STAGED
            elif line.startswith("# Changed but not updated:"):
                section = UNSTAGED
            elif line.startswith("# Changes not staged for commit:"):
                section = UNSTAGED # actually newer git (for unit testing)
            elif line.startswith("# Untracked files:"):
                section = UNTRACKED

            if not line.startswith("#\t"):
                continue # not a file

            relpath = line.split("\t", 1)[1] # path relative to cwd
            if relpath.startswith("new file:   ") and section is STAGED:
                relpath = relpath.split(None, 2)[2]
                status = 'A' # added
            elif relpath.startswith("deleted:    ") and section is STAGED:
                relpath = relpath.split(None, 1)[1]
                status = 'D' # deleted
            elif relpath.startswith("deleted:    ") and section is UNSTAGED:
                relpath = relpath.split(None, 1)[1]
                status = None
            elif relpath.startswith("modified:   ") and section is UNSTAGED:
                relpath = relpath.split(None, 1)[1]
                status = 'C' # changed
            elif section is UNTRACKED:
                status = '?' # unknown
            else:
                log.debug("relpath %s ignored in section %s", relpath, section[0])
                continue # not interested in this file

            if not recursive and "/" in relpath:
                continue # this file is in another directory; skip it
            if relpath.startswith("../"):
                continue # this file is outside the working directory

            fullpath = os.path.join(cwd, relpath.replace("/", os.sep))
            log.debug("status: status says %r is %r", fullpath, status)
            if status is None:
                # the other status() method doesn't see these files; pretend we
                # didn't either so we get matching output
                files.pop(fullpath, None)
            else:
                files[fullpath] = { 'status': status,
                                    'relpath': relpath }

        return result

    def push(self, remoterepo, localrepo, localrevs=[], localtags=[],
             options=None, dryRun=False, env=None):
        if not remoterepo and localrevs:
            raise GITLibError("Cannot push specific local revisions "
                              "without specifying remote repository")

        argv = [self.executable, "push"]
        if options:
            argv += options.split(" ")
        refs = localrevs + ["tags/%s" % (tag,) for tag in localtags]
        if remoterepo:
            # If the remote repo has a name, use that instead; this makes sure
            # we end up refreshing the local refs to that remote repo's branches
            # too (bug 99920)
            remotes = self.getremotes(localrepo, env=env)["items"]
            for name, url in remotes.items():
                if url == remoterepo:
                    remoterepo = name
                    break
            else:
                log.debug("Failed to find remote for [%s]: %r",
                          remoterepo, remotes)
            argv += [remoterepo]
            if not refs:
                argv += [self.getcurrentbranch(localrepo, env) or "HEAD"]
            else:
                argv += refs
        elif refs:
            raise GITLibError("revs or tags given without remoterepo")
        if dryRun:
            return {"stdout": " ".join(argv)}
        output, error = self._runCommand(argv, cwd=localrepo, env=env)
        return {"stdout": output, "stderr": error}

    @property
    def _version(self):
        """Get the version string of the git binary
        @note This will cache the result"""

        try:
            mtime = os.stat(self.executable).st_mtime
        except:
            # failed to stat() the executable; not usable
            return None

        if hasattr(self, "_git_version_cache"):
            cached_executable, cached_mtime, version = self._git_version_cache
        else:
            cached_executable, cached_mtime, version = None, None, None

        if self.executable == cached_executable and mtime == cached_mtime:
            # we have a good cached value
            return version

        output, error = self._runCommand([self.executable, "--version"])
        if output.startswith("git version "):
            version = output.strip().split(" ", 2)[2]
        else:
            log.warn("Unable to obtain version from git executable %r, "
                     "output: %r", self.executable, output)
            version = None

        # update the cache
        setattr(self, "_git_version_cache", (self.executable, mtime, version))
        return version
    
    def _versionInRange(self, minVersion=None, maxVersion=None):
        """Check that the git executable is within some version range
        @param minVersion {str} The minimum git version; None means no minimum
        @param maxVersion {str} The maximum git version; None means no maximum
        @returns {bool} True if the git executable is within the specified
            version range (inclusive), False if not.
        """
        from distutils.version import LooseVersion
        version = self._version
        if version is None:
            # no version available
            return False
        version = LooseVersion(version)
        if minVersion is not None and version < LooseVersion(minVersion):
            return False
        if maxVersion is not None and version > LooseVersion(maxVersion):
            return False
        return True
