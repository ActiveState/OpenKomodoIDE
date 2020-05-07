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

log = logging.getLogger('hglib')
#log.setLevel(logging.DEBUG)

#---- exceptions

class HGLibError(Exception):
    pass

class HG:
    """A proxy to the Git command line app."""
    def __init__(self, executable='hg', **options):
        self.executable = executable
        self.optd = options
        # Abortable process handle.
        self._processHelper = process.AbortableProcessHelper()

    def _runCommand(self, argv, cwd=None, env=None, input=None,
                    terminalHandler=None):
        """Prepare and run the given arg vector, 'argv', and return the
        results.  Returns (<stdout>, <stderr>).
        """
        if type(argv) not in (types.ListType, types.TupleType):
            raise HGLibError("_runCommand:: argv is not a list: %r" % (argv, ))
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

        #print 'argv: %r' % (argv, )
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
        if retval != 0:
            raise HGLibError("Error %s running '%s': \n%s"\
                             % (retval, ' '.join(argv), ''.join(error)))

        return output, error

    def _supportsBookmarks(self, cwd, env=None):
        """ Checks if hg bookmarks are enabled
        @returns {boolean} True if bookmarks are enabled
        @note This doesn't mean the user is using bookmarks in this repo
        """
        stdout, stderr = self._runCommand([self.executable, "debugcommands"],
                                          cwd=cwd, env=env)
        for line in stdout.splitlines():
            if line.startswith("bookmarks:"):
                return True
        return False

    def getrepobase(self, cwd, env=None):
        """ Get the root of the working tree from a subdirectory """
        if not os.path.isdir(cwd):
            cwd = os.path.dirname(cwd)
        output, stderr = self._runCommand([self.executable, "root"],
                                          cwd=cwd, env=env)
        return os.path.abspath(output.strip())
    
    def getheadref(self, cwd, env=None):
        """ Get a reference to the current state of the repository HEAD """
        if not os.path.isdir(cwd):
            cwd = os.path.dirname(cwd)
        output, stderr = self._runCommand([self.executable, "id", "-i"],
                                          cwd=cwd, env=env)
        return output.strip()

    def getremotes(self, cwd, env=None):
        """ Get the known remote repositories
        @returns {list of dict} Remote repositories; the dict contains two items,
            "name": {str} The name of the remote repo (e.g. "origin")
            "url": {str} The URL of the remote
        """
        result = {"items": {}}
        stdout, stderr = self._runCommand([self.executable, "paths"],
                                          cwd=cwd, env=env)
        result['stdout'] = stdout
        result['stderr'] = stderr
        for line in stdout.splitlines():
            name, url = line.split("=", 1)
            result["items"][name.strip()] = url.strip()
        return result

    def getdefaultremote(self, cwd, branch=None, env=None):
        """ Get the default remote to push to
        @returns {str} The name of the remote, or possibly a remote URL.
        """
        remotes = self.getremotes(cwd, env=env).get("items", {})
        if "default-push" in remotes:
            return remotes["default-push"]
        if "default" in remotes:
            return remotes["default"]
        return "default"

    def getbranches(self, cwd, env=None):
        """ Get the branches available for a given repository
        @param cwd {str} The path to th repo
        @param env {dict} environment
        @returns {list of str} The known branch names
        """
        argv = [self.executable, "branches"]
        stdout, stderr = self._runCommand(argv, cwd=cwd, env=env)
        branches = set()
        for line in stdout.splitlines():
            branches.add(line.split(" ", 1)[0])
        if self._supportsBookmarks(cwd, env=env):
            stdout, stderr = self._runCommand([self.executable, "bookmarks"],
                                              cwd=cwd, env=env)
            if stdout.strip() != "no bookmarks set":
                for line in stdout.splitlines():
                    bookmark = line[3:].split(" ", 1)[0].strip()
                    branches.add(bookmark)
        return list(sorted(branches))

    def getcurrentbranch(self, cwd, env=None):
        """ Get the currently checked out branch
        @param cwd {str} The path to th repo
        @param env {dict} environment
        @returns {str or None} The checked out branch, or None if a detached
            HEAD is checked out (i.e. no named branches)
        """
        if self._supportsBookmarks(cwd, env=env):
            stdout, stderr = self._runCommand([self.executable, "bookmarks"],
                                              cwd=cwd, env=env)
            for line in stdout.splitlines():
                if line.startswith(" * "):
                    bookmark = line[3:].split(" ", 1)[0].strip()
                    return "bookmark:%s" % (bookmark,)
        argv = [self.executable, "branch"]
        stdout, stderr = self._runCommand(argv, cwd=cwd, env=env)
        return stdout.strip() or None

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

    def cat(self, baseNameAsArray, cwd=None, options=None, env=None):
        if len(baseNameAsArray) != 1:
            raise HGLibError("cat takes exactly one argument")
        argv = [self.executable, 'cat'] + baseNameAsArray
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result = {}
        result['stdout'] = output
        result['stderr'] = error
        return result

    def clone(self, urls, path=None, command_options="",
              terminalHandler=None, env=None):
        if type(urls) in types.StringTypes:
            urls = [urls]
        argv = [self.executable, 'clone'] + urls
        cwd = None
        if path:
            cwd, path = os.path.split(path)
            argv += [path]
        if command_options:
            # Example: "--rev 103 --clean"
            argv += command_options.split(" ")
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
            argv += [ "-l", msgpath ]
        argv += files
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error
        return result

    def diff(self, files, cwd=None, options=None, env=None):
        result = {}
        argv = [self.executable, "diff"]
        if options:
            argv += options.split(" ")
        if files:
            argv += files
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error
        return result

    log_splitter_re = re.compile(r'changeset:\s+(?P<changeset>.*?)\n')

    def _logItemFrom(self, revision, message):
        logItem = {'revision': revision.split(":", 1)[0]}
        lines = message.rstrip().splitlines(0)
        lineno = 0
        for lineno in range(len(lines)):
            line = lines[lineno]
            split = line.split(":", 1)
            if len(split) < 2:
                continue
            item_type = split[0]
            if item_type == "user":
                logItem['author'] = split[1].strip()
            elif item_type == "date":
                logItem['date'] = split[1].strip()
            elif item_type == "files":
                logItem['files'] = split[1].strip()
            elif item_type == "parent":
                logItem['parent'] = split[1].strip()
            elif item_type == "description":
                logItem['message'] = "\n".join(lines[lineno+1:])
                break
        return logItem

    def log(self, path, cwd=None, options=None, env=None, limit=-1):
        result = {}
        argv = [self.executable, "log", "-v"]
        if options:
            argv += options.split(" ")
        argv.append(path)
        if limit > 0:
            argv += ["--limit", str(limit)]
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error

        log_items = []
        matchIterator = self.log_splitter_re.finditer(output)
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

            log_items.append(self._logItemFrom(match.group('changeset'), message))
            match = matchNext

        result['log'] = log_items
        return result

    def remove(self, files, cwd=None, options=None, env=None):
        result = {}
        argv = [self.executable, "remove"]
        if options:
            argv += options.split(" ")
        argv += files
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error
        return result

    def revert(self, files, cwd=None, options=None, env=None):
        result = {}
        argv = [self.executable, "revert"]
        if options:
            argv += options.split(" ")
        argv += files
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error
        return result

    status_re = re.compile(r"^(?P<status>.)\s+(?P<path>.*)$")
    def status(self, files=None, cwd=None, options=None, env=None,
               recursive=False):
        result = {}
        if options is None:
            # Hg options mean:
            #  -A --all        show status of all files
            #  -X --exclude    exclude names matching the given patterns

            # We want information on everything "-A".
            options = '-A'
        if not recursive:
            # Don't want it to go recursive '-X "*/**"'.
            # Warning: Do not change the quoting, otherwise it will not work
            #          recursively on Windows.
            if options:
                options += " "  # need to keep a space between the options.
            options += '-X */**'
        argv = [self.executable, "status"] + options.split(" ")
        if files:
            argv += files
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error

        files = {}
        for line in output.splitlines(0):
            match = self.status_re.match(line)
            if match:
                hit = match.groupdict()
                path = hit['path']
                fullpath = os.path.normpath(os.path.join(cwd, path))
                files[fullpath] = { 'status': hit['status'],
                                    'relpath': path }
        result['files'] = files
        return result
    
    def checkout_branch(self, cwd=None, branch="master", env=None):
        result = {}
        argv = [self.executable, "update", branch]
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error
        return result

    def update(self, files, cwd=None, options=None, env=None):
        result = {}
        argv = [self.executable, "pull", "-u"]
        if options:
            argv += options.split(" ")
        #argv += files # Update command won't accept list of files - bug 90477.
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error
        return result

    def push(self, remoterepo, localrepo, localrevs=[], localtags=[],
             options=None, dryRun=False, env=None):

        if localtags:
            raise HGLibError("HG can't push specific tags")

        # look at what bookmarks exist
        bookmarks = set()
        if self._supportsBookmarks(localrepo, env=env):
            stdout, stderr = self._runCommand([self.executable, "bookmarks"],
                                              cwd=localrepo, env=env)
            if stdout.strip() != "no bookmarks set":
                for line in stdout.splitlines():
                    bookmark = line[3:].split(" ", 1)[0].strip()
                    bookmarks.add(bookmark)

        argv = [self.executable, "push"]
        if options:
            argv += options.split(" ")
        for rev in localrevs or []:
            if rev.startswith("bookmark:") and rev.split(":", 1)[1] in bookmarks:
                argv += ["--bookmark", rev.split(":", 1)[1]]
            else:
                argv += ["--rev", rev]
        if remoterepo:
            argv += ["--", remoterepo]
        if dryRun:
            return {"stdout": " ".join(argv)}
        output, error = self._runCommand(argv, cwd=localrepo, env=env)
        return {"stdout": output, "stderr": error}
