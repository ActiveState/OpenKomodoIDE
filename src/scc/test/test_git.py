import logging
import itertools
import operator
import os
import re
import stat
import subprocess
import sys
import tempfile
import time
import unittest
from distutils.version import LooseVersion
from xpcom import COMException
from xpcom.components import classes as Cc, interfaces as Ci
from xpcom.server import UnwrapObject
from testlib import TestSkipped, tag

sys.path.insert(0, os.path.dirname(__file__))
try:
    from utils import *
finally:
    sys.path.remove(os.path.dirname(__file__))

log = logging.getLogger("scc.test.git")

def git_version(*args):
    """ Decorator for test methods to skip on git version ranges """
    from functools import wraps
    conditions = []
    for expr in args:
        verstr = expr.lstrip("<>=")
        oper = expr[:-len(verstr)]
        comp = {"<":  operator.lt,
                "<=": operator.le,
                ">":  operator.gt,
                ">=": operator.ge,
                "==": operator.eq,
                "!=": operator.ne,
               }.get(oper)
        assert oper is not None, "Invalid operator %s" % (oper,)
        version = LooseVersion(verstr)
        conditions.append((comp, version, oper))
    def dec(f):
        @wraps(f)
        def wrapper(self, *args, **kwargs):
            for comp, version, oper in conditions:
                if not comp(self.gitVersion, version):
                    raise TestSkipped("Available git version %s is not %s %s" %
                                      (self.gitVersion, oper, version))
            return f(self, *args, **kwargs)
        return wrapper
    return dec

class GitTestCaseBase(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        unittest.TestCase.__init__(self, *args, **kwargs)
        self._git = None

    def _run(self, args, cwd=None, expectedError=False, stderr=""):
        """ Run the given command
            @param args {list} The arguments to run (git executable is implied)
            @param cwd {str} The directory to run in; if not given, assume this
                    is a GitRepoTestCase and run in the default repo directory
            @param expectedError {bool} If False, check that the command succeeded
            @param stderr {str or None} If not None, check that the stderr
                    output matches the given value.
            @returns tuple(stdout, stderr) if stderr is None; otherwise only
                    stdout is returned (since stderr is known and checked)
        """
        if cwd is None:
            cwd = self._repo
        args = [self._git] + args
        log.debug("Running %r in %s", args, cwd)
        env = {"LANG": "C"}
        for k in ("COMSPEC", "SYSTEMROOT", "TEMP", "TMP", "TMPDIR"):
            if k in os.environ:
                env[k] = os.environ[k]
        if sys.platform.startswith("win"):
            # on Windows, need to set $PATH correctly for git to run
            env["PATH"] = os.pathsep.join([r"%s\System32" % (os.environ["SYSTEMROOT"]),
                                           os.environ["WINDIR"],
                                           r"%s\System32\Wbem" % (os.environ["SYSTEMROOT"],)])
        proc = subprocess.Popen(args, bufsize=-1, cwd=cwd, universal_newlines=True,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                env=env)
        (r_stdout, r_stderr) = proc.communicate()
        if expectedError:
            self.assertNotEqual(proc.returncode, 0,
                                "Calling %r expected to fail" % (args,))
        else:
            message = r_stderr.strip() or r_stdout.strip()
            if not message:
                message = "<no output from git>"
            self.assertEquals(proc.returncode, 0,
                              "Calling %r failed with %r:\n%s" % (
                                    args, proc.returncode, message))
        if stderr is not None:
            self.assertEqual(r_stderr, stderr,
                             "Calling %r got unexpected stderr %r (expected %r)" % (
                                args, r_stderr, stderr))
            return r_stdout
        return (r_stdout, r_stderr)

    @property
    def gitVersion(self):
        return LooseVersion(self._git_version)

    def setUp(self):
        self._svc = Cc["@activestate.com/koSCC?type=git;1"]\
                      .getService(Ci.koISCC)
        if self._git is None:
            self._git = self._svc.executable
            if not self._git:
                raise TestSkipped("Git missing")
            output = self._run(["--version"], cwd=os.getcwd())
            if output.startswith("git version "):
                self._git_version = output.strip().split(" ", 2)[2]
            else:
                self._git_version = "0"

    def wipeRepo(self, repo):
        """ Remove a repository """
        if repo is not None and os.path.exists(repo):
            # can't use shutil.rmtree, .git trees have read-only objects on
            # Windows, which it barfs on. (We need to chmod first.)
            total_tries = 5
            for try_num in range(total_tries):
                # try multiple times because files can get locked on Windows :(
                # (it's probably Komodo's file status service...)
                try:
                    for root, dirs, files in os.walk(repo, topdown=False):
                        for f in files:
                            f = os.path.join(root, f)
                            os.chmod(f, stat.S_IRWXU)
                            os.unlink(f)
                        for d in dirs:
                            d = os.path.join(root, d)
                            os.chmod(d, stat.S_IRWXU)
                            os.rmdir(d)
                    os.rmdir(repo)
                    break
                except Exception, ex:
                    if try_num < total_tries - 1:
                        log.warn("Failed deleting, retrying: %s", ex)
                        t = Cc["@mozilla.org/thread-manager;1"].getService().currentThread
                        end = time.time() + 1
                        while time.time() < end:
                            t.processNextEvent(False)
                    else:
                        raise

class GitTestCase(GitTestCaseBase):
    """ Test cases that do not want a default repo """
    def test_basics(self):
        self.assertEquals(self._svc.name, "git")
        self.assertTrue(self._svc.isEnabled, "git SCC disabled")
        self.assertFalse(self._svc.executable is None, "No executable")
        self.assertTrue(self._svc.isFunctional, "git not functional")
        self.assertTrue(self._svc.reasonNotFunctional is None,
                        "Not functional reason given for functional git")
        self._svc.redetermineIfFunctional() # shouldn't throw
        for cmd in ("add", "checkout", "commit", "diff", "history", "remove",
                    "revert", "status", "update", "push"):
            self.assertEquals(self._svc.getValue("supports_command", cmd), "Yes",
                              "git should support command '%s'" % (cmd,))
        for cmd in ("pants",):
            self.assertNotEquals(self._svc.getValue("supports_command", cmd),
                                 "Yes",
                                 "git should not support command '%s'" % (cmd,))
        for protocol in ("git", "ssh"):
            self.assertEquals(self._svc.getValue("supports_checkout_url",
                                                 "%s://localhost/hello.git" % (protocol,)),
                              "Yes",
                              "git should support protocol '%s'" % (protocol,))
        for protocol in ("pserver", "svn"):
            self.assertNotEquals(self._svc.getValue("supports_checkout_url",
                                                    "%s://localhost/hello" % (protocol,)),
                                 "Yes",
                                 "git should not support protocol '%s'" % (protocol,))

    def test_update(self):
        spinner = AsyncCallbackSpinner(self)
        source, dest = None, None
        try:
            source = tempfile.mkdtemp()
            source_file = os.path.join(source, "hello.txt")
            self._run(["init"], cwd=source)
            # Set the Git user name, to avoid git complaining.
            self._run(["config", "user.name", "Komodo Build"], cwd=source)
            self._run(["config", "user.email", "komodo-build@activestate.com"], cwd=source)

            with open(source_file, "w") as f:
                f.write("initial")
            self._run(["add", "--", "hello.txt"], cwd=source)
            self._run(["commit", "-m", "initial"], cwd=source)
            dest = tempfile.mkdtemp()
            os.rmdir(dest)
            dest_file = os.path.join(dest, "hello.txt")
            with spinner:
                self._svc.checkout(source, dest, "", spinner, None)
            self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                             "Error occurred while doing scc checkout: %s" % (spinner.data,))
            self._run(["config", "user.name", "Komodo Build"], cwd=dest)
            self._run(["config", "user.email", "komodo-build@activestate.com"], cwd=dest)
            with open(source_file, "w") as f:
                f.write("update")
            self._run(["add", "--", "hello.txt"], cwd=source)
            self._run(["commit", "-m", "update"], cwd=source)
            with spinner:
                self._svc.update([dest], None, spinner)
            self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                             "Error occurred while doing scc update: %s" % (spinner.data,))
            with open(dest_file, "r") as f:
                self.assertEqual(f.read(), "update",
                                 "File was not correctly updated")
        finally:
            self.wipeRepo(source)
            self.wipeRepo(dest)

    def test_push(self):
        spinner = AsyncCallbackSpinner(self)
        source, dest = None, None
        try:
            source = tempfile.mkdtemp()
            source_file = os.path.join(source, "hello.txt")
            self._run(["init"], cwd=source)
            # Set the Git user name, to avoid git complaining.
            self._run(["config", "user.name", "Komodo Build"], cwd=source)
            self._run(["config", "user.email", "komodo-build@activestate.com"], cwd=source)
            with open(source_file, "w") as f:
                f.write("initial")
            self._run(["add", "--", "hello.txt"], cwd=source)
            self._run(["commit", "-m", "initial"], cwd=source)
            self._run(["config", "--replace-all", "receive.denyCurrentBranch", "ignore"],
                      cwd=source)
            dest = tempfile.mkdtemp()
            os.rmdir(dest)
            dest_file = os.path.join(dest, "hello.txt")
            with spinner:
                self._svc.checkout(source, dest, "", spinner, None)
            self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                             "Error occurred while doing scc checkout: %s" % (spinner.data,))
            self._run(["config", "user.name", "Komodo Build"], cwd=dest)
            self._run(["config", "user.email", "komodo-build@activestate.com"], cwd=dest)
            with open(dest_file, "w") as f:
                f.write("push")
            self._run(["add", "--", "hello.txt"], cwd=dest)
            self._run(["commit", "-m", "push"], cwd=dest)
            with spinner:
                self._svc.push(source, dest, spinner)
            self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                             "Error occurred while doing scc push: %s" % (spinner.data,))
            log.debug("output:\n%s", spinner.data)
            self._run(["reset", "--hard"], cwd=source)
            with open(source_file, "r") as f:
                self.assertEqual(f.read(), "push",
                                 "File was not correctly pushed")
        finally:
            self.wipeRepo(source)
            self.wipeRepo(dest)

    def test_push_no_remote_repo(self):
        spinner = AsyncCallbackSpinner(self)
        source, dest = None, None
        try:
            source = tempfile.mkdtemp()
            source_file = os.path.join(source, "hello.txt")
            self._run(["init"], cwd=source)
            self._run(["config", "user.name", "Komodo Build"], cwd=source)
            self._run(["config", "user.email", "komodo-build@activestate.com"], cwd=source)
            with open(source_file, "w") as f:
                f.write("initial")
            self._run(["add", "--", "hello.txt"], cwd=source)
            self._run(["commit", "-m", "initial"], cwd=source)
            self._run(["config", "--replace-all", "receive.denyCurrentBranch", "ignore"],
                      cwd=source)
            dest = tempfile.mkdtemp()
            os.rmdir(dest)
            dest_file = os.path.join(dest, "hello.txt")
            with spinner:
                self._svc.checkout(source, dest, "", spinner, None)
            self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                             "Error occurred while doing scc checkout: %s" % (spinner.data,))
            self._run(["config", "user.name", "Komodo Build"], cwd=dest)
            self._run(["config", "user.email", "komodo-build@activestate.com"], cwd=dest)
            with open(dest_file, "w") as f:
                f.write("push")
            self._run(["add", "--", "hello.txt"], cwd=dest)
            self._run(["commit", "-m", "push"], cwd=dest)
            with spinner:
                self._svc.push(None, dest, spinner)
            self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                             "Error occurred while doing scc push: %s" % (spinner.data,))
            log.debug("output:\n%s", spinner.data)
            self._run(["reset", "--hard"], cwd=source)
            with open(source_file, "r") as f:
                self.assertEqual(f.read(), "push",
                                 "File was not correctly pushed")
        finally:
            self.wipeRepo(source)
            self.wipeRepo(dest)

class GitRepoTestCase(GitTestCaseBase):
    """ Test cases that require a git repo to run"""
    def __init__(self, *args, **kwargs):
        GitTestCaseBase.__init__(self, *args, **kwargs)
        self._repo = None

    def setUp(self):
        GitTestCaseBase.setUp(self)
        self._repo = tempfile.mkdtemp()
        self._run(["init"])
        # Set the Git user name, to avoid git complaining.
        self._run(["config", "user.name", "Komodo Build"])
        self._run(["config", "user.email", "komodo-build@activestate.com"])

    def tearDown(self):
        if self._repo is not None:
            self.wipeRepo(self._repo)
        self._repo = None

    @git_version(">=1.7")
    def test_init(self):
        stdout = self._run(["status", "--porcelain"])
        self.assertEqual(stdout, "",
                         "Unexpected stdout on empty repo:\n%s" % (stdout,))
        stdout = self._run(["describe", "--all"], expectedError=True,
                           stderr="fatal: No names found, cannot describe anything.\n")
        self.assertEqual(stdout, "",
                         "Unexpected stdout decribing empty repo:\n%s" % (stdout,))

    @git_version("<1.7")
    def test_init_1_6(self):
        stdout = self._run(["diff"])
        self.assertEqual(stdout, "",
                         "Unexpected stdout on empty repo:\n%s" % (stdout,))
        stdout = self._run(["describe", "--all"], expectedError=True,
                           stderr="fatal: Not a valid object name HEAD\n")
        self.assertEqual(stdout, "",
                         "Unexpected stdout decribing empty repo:\n%s" % (stdout,))

    @git_version(">=1.7")
    def test_status(self):
        spinner = AsyncCallbackSpinner(self)
        for prefix in "staged", "unstaged":
            for suffix in "modified", "removed":
                filename = "%s %s" % (prefix, suffix)
                with open(os.path.join(self._repo, filename), "w") as f:
                    f.write("!")
                self._run(["add", filename])
        self._run(["commit", "-m", "initial commit"])
        for prefix in "staged", "unstaged":
            for suffix in "modified", "added":
                filename = "%s %s" % (prefix, suffix)
                with open(os.path.join(self._repo, filename), "w") as f:
                    f.write("@@")
                if prefix == "staged":
                    self._run(["add", filename])
        self._run(["rm", "staged removed"])
        os.unlink(os.path.join(self._repo, "unstaged removed"))
        stdout = self._run(["status", "--porcelain", "-z"])
        expected = {"staged added":      "A ",
                    "staged modified":   "M ",
                    "staged removed":    "D ",
                    "unstaged added":    "??",
                    "unstaged modified": " M",
                    "unstaged removed":  " D"}
        for line in stdout.split("\0"):
            if not line:
                continue # empty line
            data, name = line[:2], line[3:]
            self.assertEquals(data, expected.get(name),
                              'Unexpected status "%s" for "%s"' % (data, name))
            del expected[name]
        self.assertEqual(len(expected), 0,
                         "Unexpected remaining items: %s" % (expected.keys()))
        files = [os.path.join(self._repo, "%s %s" % (prefix, suffix)) for prefix, suffix in
                    itertools.product(["staged", "unstaged"], ["added", "modified", "removed"])]
        with spinner:
            self._svc.status(files, False, "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revert: %s" % (spinner.data,))
        expected = {"staged added":      Ci.koISCC.STATUS_ADDED,
                    "staged modified":   Ci.koISCC.STATUS_OK,
                    "staged removed":    Ci.koISCC.STATUS_DELETED,
                    "unstaged added":    None,
                    "unstaged modified": Ci.koISCC.STATUS_MODIFIED,
                    "unstaged removed":  None}
        for item in spinner.data:
            item.QueryInterface(Ci.koISCCFileStatusItem)
            self.assertEqual(expected.get(item.relativePath, -1), item.status,
                             "item '%s' has unexpected status %r" % (item.relativePath, item.status))
            expected[item.relativePath] = None
        bad = [k for k, v in expected.items() if v is not None]
        self.assertEqual(len(bad), 0, "Missing status for %s" % (bad,))

    @git_version(">=1.7")
    def test_add(self):
        spinner = AsyncCallbackSpinner(self)
        fileName = os.path.join(self._repo, "hello.txt")
        with open(fileName, "w") as f:
            f.write("!")
        stdout = self._run(["status", "--porcelain"])
        self.assertEqual(stdout, "?? hello.txt\n",
                         "Unexpected stdout on unknown file:\n%s" % (stdout,))
        with spinner:
            op = self._svc.add([fileName], "0644", "(unused)", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc add")
        stdout = self._run(["status", "--porcelain"])
        self.assertEqual(stdout, "A  hello.txt\n",
                         "Unexpected stdout after file add:\n%s" % (stdout,))
        with spinner:
            op = self._svc.commit([fileName], "Testing add", "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc commit")
        stdout = self._run(["status", "--porcelain"])
        self.assertEqual(stdout, "",
                         "Unexpected stdout on clean repo:\n%s" % (stdout,))

    @git_version("<1.7")
    def test_add_1_6(self):
        # note that old versions of git report an "error" on git status of clean tree !?
        spinner = AsyncCallbackSpinner(self)
        fileName = os.path.join(self._repo, "hello.txt")
        with open(fileName, "w") as f:
            f.write("!")
        stdout = self._run(["status"], expectedError=True)
        expected = dedent("""
                          # On branch master
                          #
                          # Initial commit
                          #
                          # Untracked files:
                          #   (use "git add <file>..." to include in what will be committed)
                          #
                          #\thello.txt
                          nothing added to commit but untracked files present (use "git add" to track)
                          """)
        self.assertEqual(stdout, expected,
                         "Unexpected stdout on unknown file:\n%s" % (stdout,))
        with spinner:
            op = self._svc.add([fileName], "0644", "(unused)", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc add")
        stdout = self._run(["status"])
        expected = dedent("""
                          # On branch master
                          #
                          # Initial commit
                          #
                          # Changes to be committed:
                          #   (use "git rm --cached <file>..." to unstage)
                          #
                          #\tnew file: hello.txt
                          #
                          """)
        if self.gitVersion >= "1.6.1":
            # git 1.6.1 introduced two extra spaces before the file name :(
            expected = expected.replace("hello.txt", "  hello.txt")
        self.assertEqual(stdout, expected,
                         "Unexpected stdout after file add:\n%s" % (stdout,))
        with spinner:
            op = self._svc.commit([fileName], "Testing add", "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc commit")
        stdout = self._run(["status"], expectedError=True)
        expected = dedent("""
                          # On branch master
                          nothing to commit (working directory clean)
                          """)
        self.assertEqual(stdout, expected,
                         "Unexpected stdout on clean repo:\n%s" % (stdout,))

    @git_version(">=1.7")
    def test_revert(self):
        spinner = AsyncCallbackSpinner(self)
        for prefix in "staged", "unstaged":
            for suffix in "modified", "removed":
                filename = "%s_%s" % (prefix, suffix)
                with open(os.path.join(self._repo, filename), "w") as f:
                    f.write("!")
                self._run(["add", filename])
        self._run(["commit", "-m", "initial commit"])
        for prefix in "staged", "unstaged":
            for suffix in "modified", "added":
                filename = "%s_%s" % (prefix, suffix)
                with open(os.path.join(self._repo, filename), "w") as f:
                    f.write("@@")
                if prefix == "staged":
                    self._run(["add", filename])
        self._run(["rm", "staged_removed"])
        os.unlink(os.path.join(self._repo, "unstaged_removed"))
        stdout = self._run(["status", "--porcelain"])
        expected = {"staged_added":      "A ",
                    "staged_modified":   "M ",
                    "staged_removed":    "D ",
                    "unstaged_added":    "??",
                    "unstaged_modified": " M",
                    "unstaged_removed":  " D"}
        for line in stdout.splitlines():
            data, name = line[:2], line[3:]
            self.assertEquals(data, expected.get(name),
                              'Unexpected status "%s" for "%s"' % (data, name))
            del expected[name]
        self.assertEqual(len(expected), 0,
                         "Unexpected remaining items: %s" % (expected.keys()))
        files = [os.path.join(self._repo, "%s_%s" % (prefix, suffix)) for prefix, suffix in
                    itertools.product(["staged", "unstaged"], ["added", "modified", "removed"])]
        with spinner:
            self._svc.revert(files, "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revert: %s" % (spinner.data,))

        stdout = self._run(["status", "--porcelain"])
        self.assertEqual(set(stdout.splitlines()),
                         set(["?? staged_added", "?? unstaged_added"]),
                         "Unexpected stdout on clean repo:\n%s" % (stdout,))

    @git_version(">=1.7")
    def test_revert_directories(self):
        spinner = AsyncCallbackSpinner(self)
        for prefix in "staged", "unstaged":
            for suffix in "modified", "removed":
                dirname = "%s_%s" % (prefix, suffix)
                os.mkdir(os.path.join(self._repo, dirname))
                filename = os.path.join(dirname, "file.txt")
                with open(os.path.join(self._repo, filename), "w") as f:
                    f.write("!")
                self._run(["add", filename])
        self._run(["commit", "-m", "initial commit"])
        for prefix in "staged", "unstaged":
            for suffix in "modified", "added":
                dirname = "%s_%s" % (prefix, suffix)
                if suffix == "added":
                    os.mkdir(os.path.join(self._repo, dirname))
                filename = os.path.join(dirname, "file.txt")
                with open(os.path.join(self._repo, filename), "w") as f:
                    f.write("@@")
                if prefix == "staged":
                    self._run(["add", filename])
        self._run(["rm", os.path.join("staged_removed", "file.txt")])
        os.unlink(os.path.join(self._repo, "unstaged_removed", "file.txt"))
        for prefix in "staged", "unstaged":
            dirname = os.path.join(self._repo, "%s_removed" % (prefix,))
            if os.path.isdir(dirname):
                os.rmdir(dirname)

        stdout = self._run(["status", "--porcelain", "--untracked-files=all"])
        expected = {"staged_added/file.txt":      "A ",
                    "staged_modified/file.txt":   "M ",
                    "staged_removed/file.txt":    "D ",
                    "unstaged_added/file.txt":    "??",
                    "unstaged_modified/file.txt": " M",
                    "unstaged_removed/file.txt":  " D"}
        for line in stdout.splitlines():
            data, name = line[:2], line[3:]
            self.assertEquals(data, expected.get(name),
                              'Unexpected status "%s" for "%s"' % (data, name))
            del expected[name]
        self.assertEqual(len(expected), 0,
                         "Unexpected remaining items: %s" % (expected.keys()))
        files = [os.path.join(self._repo, "%s_%s" % (prefix, suffix)) for prefix, suffix in
                    itertools.product(["staged", "unstaged"], ["added", "modified", "removed"])]
        with spinner:
            self._svc.revert(files, "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revert: %s" % (spinner.data,))

        stdout = self._run(["status", "--porcelain", "--untracked-files=all"])
        self.assertEqual(set(stdout.splitlines()),
                         set(["?? staged_added/file.txt", "?? unstaged_added/file.txt"]),
                         "Unexpected stdout on clean repo:\n%s" % (stdout,))

        files = [os.path.join(self._repo, "%s_%s/file.txt" % (prefix, suffix)) for prefix, suffix in
                    itertools.product(["staged", "unstaged"], ["modified", "removed"])]
        for filename in files:
            with open(filename, "r") as f:
                self.assertEquals(f.read(), "!",
                                  "Unexpected content in %s" % (filename,))
        for filename in [os.path.join(self._repo, "%s_added/file.txt" % (prefix,))
                         for prefix in ("staged", "unstaged")]:
            with open(filename, "r") as f:
                self.assertEquals(f.read(), "@@",
                                  "Unexpected content in %s" % (filename,))

    @git_version(">=1.7")
    def test_revert_all(self):
        spinner = AsyncCallbackSpinner(self)
        filename = os.path.join(self._repo, "hello.txt")
        with open(filename, "w") as f:
            f.write("!")
        self._run(["add", "hello.txt"])
        self._run(["commit", "-m", "initial commit"])
        with open(filename, "w") as f:
            f.write("@@")
        output = self._run(["status", "--porcelain"])
        self.assertEqual(" M hello.txt\n", output,
                         "Unexpected output on dirty repo:\n%s" % (output,))
        with spinner:
            self._svc.revert([self._repo], "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revert: %s" % (spinner.data,))
        output = self._run(["status", "--porcelain"])
        self.assertEqual("", output,
                         "Unexpected output on clean repo:\n%s" % (output,))
        with open(filename, "r") as f:
            self.assertEqual(f.read(), "!",
                             "Revert did not correctly restore file contents")

    @git_version("<1.7")
    def test_revert_1_6(self):
        spinner = AsyncCallbackSpinner(self)
        for prefix in "staged", "unstaged":
            for suffix in "modified", "removed":
                filename = "%s_%s" % (prefix, suffix)
                with open(os.path.join(self._repo, filename), "w") as f:
                    f.write("!")
                self._run(["add", filename])
        self._run(["commit", "-m", "initial commit"])
        for prefix in "staged", "unstaged":
            for suffix in "modified", "added":
                filename = "%s_%s" % (prefix, suffix)
                with open(os.path.join(self._repo, filename), "w") as f:
                    f.write("@@")
                if prefix == "staged":
                    self._run(["add", filename])
        self._run(["rm", "staged_removed"])
        os.unlink(os.path.join(self._repo, "unstaged_removed"))
        stdout = self._run(["status"])
        expected = dedent("""
                          # On branch master
                          # Changes to be committed:
                          #   (use "git reset HEAD <file>..." to unstage)
                          #
                          #\tnew file:   staged_added
                          #\tmodified:   staged_modified
                          #\tdeleted:    staged_removed
                          #
                          # Changed but not updated:
                          #   (use "git add/rm <file>..." to update what will be committed)
                          #   (use "git checkout -- <file>..." to discard changes in working directory)
                          #
                          #\tmodified:   unstaged_modified
                          #\tdeleted:    unstaged_removed
                          #
                          # Untracked files:
                          #   (use "git add <file>..." to include in what will be committed)
                          #
                          #\tunstaged_added
                          """)
        if self.gitVersion < "1.6.1":
            # git 1.6.1 added the line about git checkout
            expected_lines = expected.splitlines(True) # keep ends
            discard_line = '#   (use "git checkout -- <file>..." to discard changes in working directory)\n'
            expected = "".join(line for line in expected_lines if line != discard_line)
        self.assertEqual(stdout, expected,
                         "Unexpected status on dirty repo:\n%s" % (stdout,))
        files = [os.path.join(self._repo, "%s_%s" % (prefix, suffix)) for prefix, suffix in
                    itertools.product(["staged", "unstaged"], ["added", "modified", "removed"])]
        with spinner:
            self._svc.revert(files, "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revert: %s" % (spinner.data,))

        stdout = self._run(["status"], expectedError=True)
        expected = dedent("""
                          # On branch master
                          # Untracked files:
                          #   (use "git add <file>..." to include in what will be committed)
                          #
                          #\tstaged_added
                          #\tunstaged_added
                          nothing added to commit but untracked files present (use "git add" to track)
                          """)
        self.assertEqual(stdout, expected,
                         "Unexpected stdout on clean repo:\n%s" % (stdout,))
        files = [os.path.join(self._repo, "%s_%s" % (prefix, suffix)) for prefix, suffix in
                    itertools.product(["staged", "unstaged"], ["modified", "removed"])]
        for filename in files:
            with open(filename, "r") as f:
                self.assertEquals(f.read(), "!",
                                  "Unexpected content in %s" % (filename,))
        for filename in [os.path.join(self._repo, "%s_added" % (prefix,))
                         for prefix in ("staged", "unstaged")]:
            with open(filename, "r") as f:
                self.assertEquals(f.read(), "@@",
                                  "Unexpected content in %s" % (filename,))

    @git_version("<1.7")
    def test_revert_all_1_6(self):
        spinner = AsyncCallbackSpinner(self)
        filename = os.path.join(self._repo, "hello.txt")
        with open(filename, "w") as f:
            f.write("!")
        self._run(["add", "hello.txt"])
        self._run(["commit", "-m", "initial commit"])
        with open(filename, "w") as f:
            f.write("@@")
        output = self._run(["status"], expectedError=True)
        expected = dedent("""
            # On branch master
            # Changed but not updated:
            #   (use "git add <file>..." to update what will be committed)
            #   (use "git checkout -- <file>..." to discard changes in working directory)
            #
            #\tmodified:   hello.txt
            #
            no changes added to commit (use "git add" and/or "git commit -a")
            """)
        if self.gitVersion < "1.6.1":
            # git 1.6.1 added the line about git checkout
            expected_lines = expected.splitlines(True) # keep ends
            discard_line = '#   (use "git checkout -- <file>..." to discard changes in working directory)\n'
            expected = "".join(line for line in expected_lines if line != discard_line)
        self.assertEqual(output, expected,
                         "Unexpected output on dirty repo:\n%s" % (output,))
        with spinner:
            self._svc.revert([self._repo], "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revert: %s" % (spinner.data,))
        output = self._run(["status"], expectedError=True)
        expected = dedent("""
            # On branch master
            nothing to commit (working directory clean)
            """)
        self.assertEqual(output, expected,
                         "Unexpected output on clean repo:\n%s" % (output,))
        with open(filename, "r") as f:
            self.assertEqual(f.read(), "!",
                             "Revert did not correctly restore file contents")

    @git_version(">=1.7")
    def test_remove(self):
        spinner = AsyncCallbackSpinner(self)
        fileName = os.path.join(self._repo, "hello.txt")
        with open(fileName, "w") as f:
            f.write("!")
        with spinner:
            op = self._svc.add([fileName], "0644", "(unused)", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc add")
        with spinner:
            op = self._svc.commit([fileName], "About to test remove", "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc commit")
        stdout = self._run(["status", "--porcelain"])
        self.assertEqual(stdout, "",
                         "Unexpected stdout on clean repo:\n%s" % (stdout,))
        with spinner:
            op = self._svc.remove([fileName], False, False, spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc remove")
        stdout = self._run(["status", "--porcelain"])
        self.assertEqual(stdout, "D  hello.txt\n",
                         "Unexpected stdout on modified repo:\n%s" % (stdout,))
        self.assertFalse(os.path.exists(fileName),
                         "Removing file did not delete it")
        with spinner:
            op = self._svc.revert([fileName], "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revert: %s" % (spinner.data,))
        stdout = self._run(["status", "--porcelain"])
        self.assertEqual(stdout, "",
                         "Unexpected stdout on clean repo:\n%s" % (stdout,))
        self.assertTrue(os.path.exists(fileName),
                        "reverting a remove did not bring the file back")

    @git_version("<1.7")
    def test_remove_1_6(self):
        spinner = AsyncCallbackSpinner(self)
        fileName = os.path.join(self._repo, "hello.txt")
        with open(fileName, "w") as f:
            f.write("!")
        with spinner:
            op = self._svc.add([fileName], "0644", "(unused)", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc add")
        with spinner:
            op = self._svc.commit([fileName], "About to test remove", "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc commit")
        stdout = self._run(["status"], expectedError=True)
        expected = dedent("""
                          # On branch master
                          nothing to commit (working directory clean)
                          """)
        self.assertEqual(stdout, expected,
                         "Unexpected stdout on clean repo:\n%s" % (stdout,))
        with spinner:
            op = self._svc.remove([fileName], False, False, spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc remove")
        expected = dedent("""
                          # On branch master
                          nothing to commit (working directory clean)
                          """) # it's staged
        self.assertEqual(stdout, expected,
                         "Unexpected stdout on modified repo:\n%s" % (stdout,))
        self.assertFalse(os.path.exists(fileName),
                         "Removing file did not delete it")
        with spinner:
            op = self._svc.revert([fileName], "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revert: %s" % (spinner.data,))
        stdout = self._run(["status"], expectedError=True)
        expected = dedent("""
                          # On branch master
                          nothing to commit (working directory clean)
                          """)
        self.assertEqual(stdout, expected,
                         "Unexpected stdout on clean repo:\n%s" % (stdout,))
        self.assertTrue(os.path.exists(fileName),
                        "reverting a remove did not bring the file back")
        with open(fileName, "r") as f:
            self.assertEqual(f.read(), "!", "Reverting a removed file had wrong contents")

    def test_edit(self):
        spinner = AsyncCallbackSpinner(self)
        with spinner:
            fileName = os.path.join(self._repo, "hello.txt")
            self._svc.edit([fileName], spinner)
        # git should not support an "edit" command, this isn't visual source safe
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_ERROR,
                         "Unexpected pass: running git edit")

    def test_diff(self):
        spinner = AsyncCallbackSpinner(self)
        fileName = os.path.join(self._repo, "hello.txt")
        with open(fileName, "w") as f:
            f.write("0000")
        self._run(["add", "hello.txt"])
        self._run(["commit", "-m", "initial commit"])
        with open(fileName, "w") as f:
            f.write("1111")
        with spinner:
            self._svc.diff([fileName], None, None, spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc diff: %s" % (spinner.data,))
        lines = spinner.data.splitlines()
        line = lines.pop(0)
        self.assertEqual(line, "Index: %s" % (fileName,), "Unexpected index line")
        line = lines.pop(0)
        match = re.match("""index [0-9a-f]{7}\.\.[0-9a-f]{7} 100644$""", line)
        self.assertTrue(match is not None, "Unexpected hash line %r" % (line,))
        expected = [
            r"--- a/hello.txt",
            r"+++ b/hello.txt",
            r"@@ -1 +1 @@",
            r"-0000",
            r"\ No newline at end of file",
            r"+1111",
            r"\ No newline at end of file",
            ]
        self.assertEquals(expected, lines,
                          "Unexpected lines:\n%s" % ("\n".join(lines),))

    def test_diffRelative(self):
        spinner = AsyncCallbackSpinner(self)
        fileName = "hello.txt"
        with open(os.path.join(self._repo, fileName), "w") as f:
            f.write("0000")
        self._run(["add", "hello.txt"])
        self._run(["commit", "-m", "initial commit"])
        with open(os.path.join(self._repo, fileName), "w") as f:
            f.write("1111")
        with spinner:
            self._svc.diffRelative(self._repo, [fileName], None, None, spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc diff: %s" % (spinner.data,))
        lines = spinner.data.splitlines()
        line = lines.pop(0)
        self.assertEqual(line, "Index: %s" % (os.path.join(self._repo, fileName),),
                         "Unexpected index line:\n%s" % (line,))
        line = lines.pop(0)
        match = re.match("""index [0-9a-f]{7}\.\.[0-9a-f]{7} 100644$""", line)
        self.assertTrue(match is not None, "Unexpected hash line %r" % (line,))
        expected = [
            r"--- a/hello.txt",
            r"+++ b/hello.txt",
            r"@@ -1 +1 @@",
            r"-0000",
            r"\ No newline at end of file",
            r"+1111",
            r"\ No newline at end of file",
            ]
        self.assertEquals(expected, lines,
                          "Unexpected lines:\n%s" % ("\n".join(lines),))

    def test_history(self):
        spinner = AsyncCallbackSpinner(self)
        fileName = os.path.join(self._repo, "hello.txt")
        for i in range(0, 10):
            with open(fileName, "w") as f:
                f.write(("%s" % (i,)) * 10)
            self._run(["add", "hello.txt"])
            self._run(["commit", "-m", "commit %s" % (i,)])
        with spinner:
            self._svc.history(fileName, "", -1, spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc history: %s" % (spinner.data,))
        self.assertEqual(10, len(spinner.data), # one is initial commit
                         "Expected 10 items, got %s:\n%s" %
                         (len(spinner.data), spinner.data))
        items = list(reversed(spinner.data))
        for index, item in enumerate(items):
            self.assertEquals(len(item.version), 40,
                              "Unexpected hash %s" % (item.version,))
            self.assertEquals("", item.change,
                              "Unexpected change %s" % (item.change,))
            self.assertEquals("", item.action,
                              "Unexpected action %s" % (item.action,))
            self.assertEquals("commit %s\n" % (index,), item.message,
                              "Unexpected message %s" % (item.message,))

        with spinner:
            self._svc.diffRevisions(fileName, items[4].version,
                                    fileName, items[6].version,
                                    fileName, None, None, spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revision diff: %s" % (spinner.data,))
        lines = spinner.data.splitlines()
        line = lines.pop(0)
        self.assertEqual(line, "diff --git a/hello.txt b/hello.txt",
                         "Unexpected index line:\n%s" % (line,))
        line = lines.pop(0)
        match = re.match("""index [0-9a-f]{7}\.\.[0-9a-f]{7} 100644$""", line)
        self.assertTrue(match is not None, "Unexpected hash line %r" % (line,))
        expected = [
            r"--- a/hello.txt",
            r"+++ b/hello.txt",
            r"@@ -1 +1 @@",
            r"-4444444444",
            r"\ No newline at end of file",
            r"+6666666666",
            r"\ No newline at end of file",
            ]
        self.assertEquals(expected, lines,
                          "Unexpected lines:\n%s" % ("\n".join(lines),))
