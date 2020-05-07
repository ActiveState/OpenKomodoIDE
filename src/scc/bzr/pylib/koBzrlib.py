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

log = logging.getLogger('bzrlib')
#log.setLevel(logging.DEBUG)

#---- exceptions

class BzrLibError(Exception):
    pass

class Bzr(object):
    """A proxy to the Bzr command line app."""
    def __init__(self, executable='bzr', **options):
        # Use the setter to set this field.
        # XXX Todd: Can I remove the executable arg -- it's not used currently.
        self._executable = None
        self.optd = options
        # Abortable process handle.
        self._processHelper = process.AbortableProcessHelper()
    
    @property
    def executable(self):
        return self._executable
    
    @executable.setter
    def executable(self, value):
        if value and sys.platform.startswith("win"):
            lastPart = os.path.split(value)[1]
            if "." not in lastPart and os.path.exists(value + ".bat"):
                value += ".bat"
        self._executable = value

    def _runCommand(self, argv, cwd=None, env=None, input=None,
                    allowed_exit_codes=None, terminalHandler=None):
        """Prepare and run the given arg vector, 'argv', and return the
        results.  Returns (<stdout>, <stderr>).
        """
        if type(argv) not in (types.ListType, types.TupleType):
            raise BzrLibError("_runCommand:: argv is not a list: %r" % (argv, ))
        # Remove any empty options from the cmd list.
        argv = [ x for x in argv if x ]
        log.debug("Running %r in cwd %r", argv, cwd)
        output = None
        if env is None:
            import koprocessutils
            env = koprocessutils.getUserEnv()

        # Komodo can only handle svn messages in english.
        # http://bugs.activestate.com/show_bug.cgi?id=45677
        env['LC_MESSAGES'] = 'C'
        # Set LANGUAGE too, otherwise it may still come back in another lang
        # http://bugs.activestate.com/show_bug.cgi?id=68615
        env['LANGUAGE'] = 'C'

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
            if not allowed_exit_codes or retval not in allowed_exit_codes:
                raise BzrLibError("Error code %r running %r:\n%s"
                                  % (retval, argv, ''.join(error)))
        return output, error

    def abort(self):
        self._processHelper.ProcessAbort()

    def getrepobase(self, cwd, env=None):
        """ Get the root of the working tree from a subdirectory """
        if not os.path.isdir(cwd):
            cwd = os.path.dirname(cwd)
        log.debug("getrepobase: cwd=%s", cwd)
        output, stderr = self._runCommand([self.executable, "root"],
                                          cwd=cwd, env=env)
        return os.path.abspath(output.strip()) # needed to normalize on win32
    
    def getheadref(self, cwd, env=None):
        """ Get a reference to the current state of the repository HEAD """
        if not os.path.isdir(cwd):
            cwd = os.path.dirname(cwd)
        log.debug("getrepobase: cwd=%s", cwd)
        output, stderr = self._runCommand([self.executable, "revno"],
                                          cwd=cwd, env=env)
        return output.strip()

    def getremotes(self, cwd, env=None):
        """ Get the known remote repositories
        @returns {list of dict} Remote repositories; the dict contains two items,
            "name": {str} The name of the remote repo (e.g. "origin")
            "url": {str} The URL of the remote
        """
        result = {"items": {}}
        stdout, stderr = self._runCommand([self.executable, "info"],
                                          cwd=cwd, env=env)
        result['stdout'] = stdout
        result['stderr'] = stderr
        in_section = False
        for line in stdout.splitlines():
            if line.startswith(" "):
                if not in_section:
                    continue
                key, value = line.split(": ", 1)
                if not key.endswith("branch"):
                    continue
                name = key.rsplit(" ", 1)[0].strip()
                if name in ("parent", "submit", "public", "bound", "push", "this"):
                    result["items"][":%s" % (name,)] = value.strip()
            else:
                in_section = line == "Related branches:"
        return result

    def getdefaultremote(self, cwd, branch=None, env=None):
        """ Get the default remote to push to
        @returns {str} The name of the remote, or possibly a remote URL.
        """
        remotes = self.getremotes(cwd, env=env).get("items", {})
        return remotes.get(":push", None)

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

    def branch(self, urls, path=None, command_options="",
               terminalHandler=None, env=None):
        if type(urls) in types.StringTypes:
            urls = [urls]
        argv = [self.executable, 'branch'] + urls
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

    def cat(self, baseNameAsArray, cwd=None, options=None,
            terminalHandler=None, env=None):
        if len(baseNameAsArray) != 1:
            raise BzrLibError("cat takes exactly one argument")
        argv = [self.executable, "cat"] + baseNameAsArray
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
            argv += [ "--file", msgpath ]
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
        output, error = self._runCommand(argv, cwd=cwd, env=env,
                                         allowed_exit_codes=(1, 2))
        result['stdout'] = output
        result['stderr'] = error
        return result

    def _logItemFrom(self, data):
        logItem = {}
        lines = data.rstrip().splitlines(0)
        lineno = 0
        mode = "parsing"
        file_action = ""
        message = []
        modified_files = []
        added_files = []
        removed_files = []
        for lineno in range(len(lines)):
            line = lines[lineno]
            split = line.split(":", 1)
            if len(split) == 2:
                item_type = split[0]
                if item_type == "revno":
                    logItem['revision'] = split[1].strip()
                elif item_type == "committer":
                    logItem['author'] = split[1].strip()
                elif item_type == "timestamp":
                    logItem['date'] = split[1].strip()
                elif item_type in ("modified", "added", "removed"):
                    mode = "files"
                    file_action = item_type
                    continue
                elif item_type == "message":
                    mode = "message"
                    continue
                elif item_type[0][0] not in " \t":
                    mode = "parsing"
                    continue
            if mode == "message":
                message.append(line[2:])
            elif mode == "files":
                if file_action == "modified":
                    modified_files.append(line.strip())
                elif file_action == "added":
                    added_files.append(line.strip())
                elif file_action == "removed":
                    removed_files.append(line.strip())

        logItem['message'] = "\n".join(message) + "\n"
        logItem['added_files'] = added_files
        logItem['modified_files'] = modified_files
        logItem['removed_files'] = removed_files
        return logItem

    log_splitter_re = re.compile(r'^%s$' % ('-'*60, ), flags=re.MULTILINE)

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

            logItem = self._logItemFrom(message)
            # Ignore log entries that don't have a revision - bug 87618.
            if "revision" in logItem:
                log_items.append(logItem)
            match = matchNext

        result['log'] = log_items
        return result

    def ls(self, cwd=None, options=None, env=None):
        """Returned files are *always* relative paths from the cwd path."""
        result = {}
        output, error = self._runCommand([self.executable, "ls", options],
                                         cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error

        files = {}
        result['files'] = files
        for line in output.splitlines(0):
            relpath = line.strip()
            files[relpath] = { 'status': 'H',
                               'status_flags': ' '}
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

    def revert(self, filepaths, cwd=None, options=None, env=None):
        # bzr revert has odd corner cases; deal with them here

        files = set() # files we want to revert, relative to repo root, using
                      # forward-slash as separator (as bzr always does)
        for path in filepaths:
            if os.path.isabs(path):
                path = os.path.relpath(path, cwd)
            files.add("/".join(path.split(os.sep)))

        if not files:
            # Revert the given cwd then (not the whole repo) - bug 94425.
            files.add(".")

        # figure out the current state of the repo
        argv = [self.executable, "status", "--short"] + list(files)
        output, error = self._runCommand(argv, cwd=cwd, env=env)

        added_dirs = set() # directories that are added
        repo_changes = set() # file changes that we don't want to revert
        for line in output.splitlines():
            relpath = line[4:]
            if line.endswith("/"):
                if line.startswith("+"):
                    added_dirs.add(relpath)
            else:
                # not a directory
                repo_changes.add(relpath)
            if line.startswith("?"):
                # bzr revert will fail if we attempt to revert untracked files;
                # ignore those in the set of things we want to revert
                files.discard(relpath)
        repo_changes.difference_update(files)

        # bzr < 2.4 will not automatically revert directories that have no more
        # changes in them (but > 2.4 will); do that manually here
        for dir in added_dirs:
            for change in repo_changes:
                if change.startswith(dir):
                    break
            else:
                files.add(dir)

        result = {}
        argv = [self.executable, "revert"]
        if options:
            argv += options.split(" ")
        argv += files
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error
        return result

    status_re = re.compile(r"^(?P<status_flags>.)(?P<status>.)\s+(?P<path>.*)$")
    def status(self, files=None, cwd=None, options=None, env=None):
        """Returned files are *always* relative paths from the base repo path."""
        result = {}
        argv = [self.executable, "status", "-S"]
        if options:
            argv += options.split(" ")
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
                relpath = hit['path']
                files[relpath] = { 'status': hit['status'],
                                   'status_flags': hit['status_flags'] }
        result['files'] = files
        return result

    def update(self, files, cwd=None, options=None, env=None):
        result = {}
        argv = [self.executable, "pull"]
        if options:
            argv += options.split(" ")
        argv += files
        output, error = self._runCommand(argv, cwd=cwd, env=env)
        result['stdout'] = output
        result['stderr'] = error
        return result

    def push(self, remoterepo, localrepo, localrevs=None,
             options=None, dryRun=False, env=None):

        if localrevs and len(localrevs) > 1:
            raise BzrLibError("Bazaar cannot push multiple revs")

        argv = [self.executable, "push"]
        if options:
            argv += options.split(" ")
        if localrevs:
            argv += ["--revision", localrevs[0]]
        if remoterepo:
            argv += ["--", remoterepo]
        if dryRun:
            return {"stdout": " ".join(argv)}
        output, error = self._runCommand(argv, cwd=localrepo, env=env)
        return {"stdout": output, "stderr": error}
