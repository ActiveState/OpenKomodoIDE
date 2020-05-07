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

log = logging.getLogger("scc.test.bzr")

class BzrTestCaseBase(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        unittest.TestCase.__init__(self, *args, **kwargs)
        self._bzr = None

    def _run(self, args, cwd=None, expectedError=False, stderr=""):
        """ Run the given command
            @param args {list} The arguments to run (bzr executable is implied)
            @param cwd {str} The directory to run in; if not given, assume this
                    is a BzrRepoTestCase and run in the default repo directory
            @param expectedError {bool} If False, check that the command succeeded
            @param stderr {str or None} If not None, check that the stderr
                    output matches the given value.
            @returns tuple(stdout, stderr) if stderr is None; otherwise only
                    stdout is returned (since stderr is known and checked)
        """
        if cwd is None:
            cwd = self._repo
        args = [self._bzr] + args
        log.debug("Running %r in %s", args, cwd)
        env = {"LANG": "C"}
        for k in ("SYSTEMROOT", "TEMP", "TMP", "TMPDIR"):
            if k in os.environ:
                env[k] = os.environ[k]
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
                message = "<no output from bzr>"
            self.assertEquals(proc.returncode, 0,
                              "Calling %r failed with %r:\n%s" % (
                                    args, proc.returncode, message))
        if stderr is not None:
            self.assertEqual(r_stderr, stderr,
                             "Calling %r got unexpected stderr %r (expected %r)" % (
                                args, r_stderr, stderr))
            return r_stdout
        return (r_stdout, r_stderr)

    def setUp(self):
        self._svc = Cc["@activestate.com/koSCC?type=bzr;1"]\
                      .getService(Ci.koISCC)
        if self._bzr is None:
            self._bzr = self._svc.executable
            if not self._bzr:
                raise TestSkipped("Bzr missing")

    def wipeRepo(self, repo):
        """ Remove a repository """
        if repo is not None and os.path.exists(repo):
            # Windows gets confused by shutil.rmtree, so do things manually.
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
                        # bzr seems to do something out-of-process on Windows
                        # that's extra slow? Wait a bit for it to finish
                        time.sleep(0.25)
                    else:
                        raise

class BzrTestCase(BzrTestCaseBase):
    """ Test cases that do not want a default repo """
    def test_basics(self):
        self.assertEquals(self._svc.name, "bzr")
        self.assertTrue(self._svc.isEnabled, "bzr SCC disabled")
        self.assertFalse(self._svc.executable is None, "No executable")
        self.assertTrue(self._svc.isFunctional, "bzr not functional")
        self.assertTrue(self._svc.reasonNotFunctional is None,
                        "Not functional reason given for functional bzr")
        self._svc.redetermineIfFunctional() # shouldn't throw
        for cmd in ("add", "checkout", "commit", "diff", "history", "remove",
                    "revert", "status", "update"):
            self.assertEquals(self._svc.getValue("supports_command", cmd), "Yes",
                              "bzr should support command '%s'" % (cmd,))
        for cmd in ("pants",):
            self.assertNotEquals(self._svc.getValue("supports_command", cmd),
                                 "Yes",
                                 "bzr should not support command '%s'" % (cmd,))
        for protocol in ("bzr", "https"):
            self.assertEquals(self._svc.getValue("supports_checkout_url",
                                                 "%s://localhost/hello.bzr" % (protocol,)),
                              "Yes",
                              "bzr should support protocol '%s'" % (protocol,))
        for protocol in ("pserver", "svn"):
            self.assertNotEquals(self._svc.getValue("supports_checkout_url",
                                                    "%s://localhost/hello" % (protocol,)),
                                 "Yes",
                                 "bzr should not support protocol '%s'" % (protocol,))

    def test_update(self):
        spinner = AsyncCallbackSpinner(self)
        source, dest = None, None
        try:
            source = tempfile.mkdtemp()
            source_file = os.path.join(source, "hello.txt")
            self._run(["init"], cwd=source)
            self._run(["whoami", "--branch", "Komodo Tester <komodo-tester@example.com>"], cwd=source)

            with open(source_file, "w") as f:
                f.write("initial")
            self._run(["add", "--", "hello.txt"], cwd=source)
            self._run(["commit", "-m", "initial"], cwd=source, stderr=None)
            dest = tempfile.mkdtemp()
            os.rmdir(dest)
            dest_file = os.path.join(dest, "hello.txt")
            with spinner:
                self._svc.checkout(source, dest, "", spinner, None)
            self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                             "Error occurred while doing scc checkout: %s" % (spinner.data,))
            self._run(["whoami", "--branch", "Komodo Tester <komodo-tester@example.com>"], cwd=dest)
            with open(source_file, "w") as f:
                f.write("update")
            self._run(["add", "--", "hello.txt"], cwd=source)
            self._run(["commit", "-m", "update"], cwd=source, stderr=None)
            with spinner:
                self._svc.update([dest], None, spinner)
            self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                             "Error occurred while doing scc update: %s" % (spinner.data,))
            with open(dest_file, "r") as f:
                self.assertEqual(f.read(), "update",
                                 "File was not correctly updated")
        finally:
            print "source=%s dest=%s" % (source, dest)
            self.wipeRepo(source)
            self.wipeRepo(dest)

    def test_push(self):
        spinner = AsyncCallbackSpinner(self)
        source, dest = None, None
        try:
            source = tempfile.mkdtemp()
            source_file = os.path.join(source, "hello.txt")
            self._run(["init"], cwd=source)
            self._run(["whoami", "--branch", "Komodo Tester <komodo-tester@example.com>"], cwd=source)
            with open(source_file, "w") as f:
                f.write("initial")
            self._run(["add", "--", "hello.txt"], cwd=source)
            self._run(["commit", "-m", "initial"], cwd=source, stderr=None)
            dest = tempfile.mkdtemp()
            os.rmdir(dest)
            dest_file = os.path.join(dest, "hello.txt")
            with spinner:
                self._svc.checkout(source, dest, "", spinner, None)
            self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                             "Error occurred while doing scc checkout: %s" % (spinner.data,))
            self._run(["whoami", "--branch", "Komodo Tester <komodo-tester@example.com>"], cwd=dest)
            with open(dest_file, "w") as f:
                f.write("push")
            self._run(["add", "--", "hello.txt"], cwd=dest)
            self._run(["commit", "-m", "push"], cwd=dest, stderr=None)
            with spinner:
                self._svc.push(source, dest, spinner)
            self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                             "Error occurred while doing scc push: %s" % (spinner.data,))
            log.debug("output:\n%s", spinner.data)
            with open(source_file, "r") as f:
                self.assertEqual(f.read(), "push",
                                 "File was not correctly pushed")
        finally:
            self.wipeRepo(source)
            self.wipeRepo(dest)

class BzrRepoTestCase(BzrTestCaseBase):
    """ Test cases that require a bzr repo to run"""
    def __init__(self, *args, **kwargs):
        BzrTestCaseBase.__init__(self, *args, **kwargs)
        self._repo = None

    def setUp(self):
        BzrTestCaseBase.setUp(self)
        self._repo = tempfile.mkdtemp()
        self._run(["init"])
        self._run(["whoami", "--branch", "Komodo Tester <komodo-tester@example.com>"])

    def tearDown(self):
        if self._repo is not None:
            self.wipeRepo(self._repo)
        self._repo = None

    def test_init(self):
        stdout = self._run(["status", "--short"])
        self.assertEqual(stdout, "",
                         "Unexpected stdout on empty repo:\n%s" % (stdout,))

    def test_status(self):
        spinner = AsyncCallbackSpinner(self)
        for filename in "modified", "removed", "missing", "clean":
            with open(os.path.join(self._repo, filename), "w") as f:
                f.write("!")
            self._run(["add", filename])
        self._run(["commit", "-m", "initial commit"], stderr=None)
        for filename in "modified", "added", "new":
            with open(os.path.join(self._repo, filename), "w") as f:
                f.write("@@")
        self._run(["add", "added"])
        self._run(["remove", "removed"], stderr=None)
        os.unlink(os.path.join(self._repo, "missing"))
        stdout = self._run(["status", "--short"])
        expected = {"added":    "+N",
                    "modified": " M",
                    "removed":  "-D",
                    "new":      "? ",
                    "missing":  " D"}
        actual = dict([(line[4:], line[0:2]) for line in stdout.splitlines() if line])
        self.assertEqual(expected, actual, "Unexpected status:\n%r" % (actual,))
        filenames = expected.keys() + ["clean"]
        files = [os.path.join(self._repo, filename) for filename in filenames]
        with spinner:
            self._svc.status(files, False, "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc status: %s" % (spinner.data,))
        expected = {"added":    Ci.koISCC.STATUS_ADDED,
                    "modified": Ci.koISCC.STATUS_MODIFIED,
                    "removed":  Ci.koISCC.STATUS_DELETED,
                    "missing":  Ci.koISCC.STATUS_DELETED}
        for item in spinner.data:
            item.QueryInterface(Ci.koISCCFileStatusItem)
            self.assertEqual(expected.get(item.relativePath, -1), item.status,
                             "item '%s' has unexpected status %r" % (item.relativePath, item.status))
            expected[item.relativePath] = None
        bad = [k for k, v in expected.items() if v is not None]
        self.assertEqual(len(bad), 0, "Missing status for %s" % (bad,))

    def test_add(self):
        spinner = AsyncCallbackSpinner(self)
        fileName = os.path.join(self._repo, "hello.txt")
        with open(fileName, "w") as f:
            f.write("!")
        stdout = self._run(["status", "--short"])
        self.assertEqual(stdout, "?   hello.txt\n",
                         "Unexpected stdout on unknown file:\n%s" % (stdout,))
        log.debug("file name: %s", fileName)
        with spinner:
            op = self._svc.add([fileName], "0644", "(unused)", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc add")
        stdout = self._run(["status", "--short"])
        self.assertEqual(stdout, "+N  hello.txt\n",
                         "Unexpected stdout after file add:\n%s" % (stdout,))
        with spinner:
            op = self._svc.commit([fileName], "Testing add", "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc commit")
        stdout = self._run(["status", "--short"])
        self.assertEqual(stdout, "",
                         "Unexpected stdout on clean repo:\n%s" % (stdout,))

    def test_revert(self):
        spinner = AsyncCallbackSpinner(self)
        for filename in "modified", "removed", "missing", "clean":
            with open(os.path.join(self._repo, filename), "w") as f:
                f.write("!")
            self._run(["add", filename])
        self._run(["commit", "-m", "initial commit"], stderr=None)
        for filename in "modified", "added", "new":
            with open(os.path.join(self._repo, filename), "w") as f:
                f.write("@@")
        self._run(["add", "added"])
        self._run(["remove", "removed"], stderr="deleted removed\n")
        os.unlink(os.path.join(self._repo, "missing"))
        stdout = self._run(["status", "--short"])
        expected = {"added":    "+N",
                    "modified": " M",
                    "removed":  "-D",
                    "new":      "? ",
                    "missing":  " D"}
        actual = dict([(line[4:], line[0:2]) for line in stdout.splitlines() if line])
        self.assertEqual(expected, actual, "Unexpected status:\n%r" % (actual,))
        files = [os.path.join(self._repo, filename) for filename in expected.keys() + ["clean"]]
        with spinner:
            self._svc.revert(files, "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revert: %s" % (spinner.data,))

        stdout = self._run(["status", "--short"] + expected.keys())
        expected = {"added": "? ",
                    "new":   "? "}
        actual = dict([(line[4:], line[0:2]) for line in stdout.splitlines() if line])
        self.assertEqual(expected, actual, "Unexpected status:\n%r" % (actual,))
        for filename in ["modified", "removed", "missing", "clean"]:
            with open(os.path.join(self._repo, filename), "r") as f:
                self.assertEquals(f.read(), "!",
                                  "Unexpected contents in %s" % (filename,))
        for filename in ["added", "new"]:
            with open(os.path.join(self._repo, filename), "r") as f:
                self.assertEquals(f.read(), "@@",
                                  "Unexpected contents in %s" % (filename,))

    @tag("bug94425")
    def test_revert_one_directory(self):
        spinner = AsyncCallbackSpinner(self)
        dirnames = ("modified1", "modified2")
        for dirname in dirnames:
            os.mkdir(os.path.join(self._repo, dirname))
            with open(os.path.join(self._repo, dirname, "file.txt"), "w") as f:
                f.write("!")
            self._run(["add", dirname])
        self._run(["commit", "-m", "initial commit"], stderr=None)
        for dirname in dirnames:
            with open(os.path.join(self._repo, dirname, "file.txt"), "w") as f:
                f.write("@@")
        stdout = self._run(["status", "--short"])
        expected = {"modified1/file.txt": " M",
                    "modified2/file.txt": " M"}
        actual = dict([(line[4:], line[0:2]) for line in stdout.splitlines() if line])
        for entry in set(actual.keys() + expected.keys()):
            if actual.get(entry) != expected.get(entry):
                self.assertEqual(expected, actual,
                                 "Unexpected initial status:\n%r" % (actual,))

        paths = [os.path.join(self._repo, "modified1")]
        with spinner:
            self._svc.revert(paths, "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revert: %s" % (spinner.data,))

        stdout = self._run(["status", "--short"])
        expected = {"modified2/file.txt": " M"}
        actual = dict([(line[4:], line[0:2]) for line in stdout.splitlines() if line])
        for entry in set(actual.keys() + expected.keys()):
            if actual.get(entry) != expected.get(entry):
                self.assertEqual(expected, actual,
                                 "Unexpected status after revert:\n%r" % (actual,))

        with open(os.path.join(self._repo, "modified1", "file.txt"), "r") as f:
            self.assertEquals(f.read(), "!",
                              "Unexpected contents in modified1/file.txt")
        with open(os.path.join(self._repo, "modified2", "file.txt"), "r") as f:
            self.assertEquals(f.read(), "@@",
                              "Unexpected contents in modified2/file.txt")

    def test_revert_directories(self):
        spinner = AsyncCallbackSpinner(self)
        for filename in "modified", "removed", "missing", "clean":
            os.mkdir(os.path.join(self._repo, filename))
            with open(os.path.join(self._repo, filename, "file.txt"), "w") as f:
                f.write("!")
            self._run(["add", filename])
        self._run(["commit", "-m", "initial commit"], stderr=None)
        for filename in "modified", "added", "new":
            if not os.path.isdir(os.path.join(self._repo, filename)):
                os.mkdir(os.path.join(self._repo, filename))
            with open(os.path.join(self._repo, filename, "file.txt"), "w") as f:
                f.write("@@")
        self._run(["add", "added/file.txt"])
        self._run(["remove", "removed/file.txt"], stderr="deleted removed/file.txt\n")
        os.unlink(os.path.join(self._repo, "missing", "file.txt"))
        os.rmdir(os.path.join(self._repo, "missing"))
        stdout = self._run(["status", "--short"])
        expected = {"added/":            "+N",
                    "added/file.txt":    "+N",
                    "modified/file.txt": " M",
                    "removed/file.txt":  "-D",
                    "new/":              "? ",
                    "missing/":          " D",
                    "missing/file.txt":  " D"}
        actual = dict([(line[4:], line[0:2]) for line in stdout.splitlines() if line])
        self.assertEqual(expected, actual, "Unexpected status:\n%r" % (actual,))

        files = [os.path.join(self._repo, dirname, "file.txt") for dirname in
                    ["added", "modified", "removed", "new", "missing"]]
        with spinner:
            self._svc.revert(files, "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revert: %s" % (spinner.data,))

        stdout = self._run(["status", "--short"])
        self.assertEqual(set(stdout.splitlines()),
                         set(["?   added/", "?   new/"]),
                         "Unexpected stdout on clean repo:\n%s" % (stdout,))

        for filename in ["modified", "removed", "missing", "clean"]:
            with open(os.path.join(self._repo, filename, "file.txt"), "r") as f:
                self.assertEquals(f.read(), "!",
                                  "Unexpected contents in %s" % (filename,))
        for filename in ["added", "new"]:
            with open(os.path.join(self._repo, filename, "file.txt"), "r") as f:
                self.assertEquals(f.read(), "@@",
                                  "Unexpected contents in %s" % (filename,))

    def test_revert_all(self):
        spinner = AsyncCallbackSpinner(self)
        filename = os.path.join(self._repo, "hello.txt")
        with open(filename, "w") as f:
            f.write("!")
        self._run(["add", "hello.txt"])
        self._run(["commit", "-m", "initial commit"], stderr=None)
        with open(filename, "w") as f:
            f.write("@@")
        output = self._run(["status", "--short"])
        self.assertEqual(" M  hello.txt\n", output,
                         "Unexpected output on dirty repo:\n%s" % (output,))
        with spinner:
            self._svc.revert([self._repo], "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revert: %s" % (spinner.data,))
        output = self._run(["status", "--short"])
        self.assertEqual("", output,
                         "Unexpected output on clean repo:\n%s" % (output,))
        with open(filename, "r") as f:
            self.assertEqual(f.read(), "!",
                             "Revert did not correctly restore file contents")

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
        stdout = self._run(["status", "--short"])
        self.assertEqual(stdout, "",
                         "Unexpected stdout on clean repo:\n%s" % (stdout,))
        with spinner:
            op = self._svc.remove([fileName], False, False, spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc remove")
        stdout = self._run(["status", "--short"])
        self.assertEqual(stdout, "-D  hello.txt\n",
                         "Unexpected stdout on modified repo:\n%s" % (stdout,))
        self.assertFalse(os.path.exists(fileName),
                         "Removing file did not delete it")
        with spinner:
            op = self._svc.revert([fileName], "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revert: %s" % (spinner.data,))
        stdout = self._run(["status", "--short"])
        self.assertEqual(stdout, "",
                         "Unexpected stdout on clean repo:\n%s" % (stdout,))
        self.assertTrue(os.path.exists(fileName),
                        "reverting a remove did not bring the file back")

    def test_edit(self):
        spinner = AsyncCallbackSpinner(self)
        with spinner:
            fileName = os.path.join(self._repo, "hello.txt")
            self._svc.edit([fileName], spinner)
        # bzr should not support an "edit" command, this isn't visual source safe
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_ERROR,
                         "Unexpected pass: running bzr edit")

    def test_diff(self):
        spinner = AsyncCallbackSpinner(self)
        fileName = os.path.join(self._repo, "hello.txt")
        with open(fileName, "w") as f:
            f.write("0000")
        self._run(["add", "hello.txt"])
        self._run(["commit", "-m", "initial commit"], stderr=None)
        with open(fileName, "w") as f:
            f.write("1111")
        with spinner:
            self._svc.diff([fileName], None, None, spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc diff: %s" % (spinner.data,))
        lines = spinner.data.splitlines()
        line = lines.pop(0)
        self.assertEqual(line, "Index: %s" % (fileName,), "Unexpected index line")
        # bzr diff prints out timestamps, too
        line = lines.pop(0)
        self.assertTrue(line.startswith("--- hello.txt\t"),
                        "Unexpected old file heading: %r" % (line,))
        line = lines.pop(0)
        self.assertTrue(line.startswith("+++ hello.txt\t"),
                        "Unexpected new file heading: %r" % (line,))
        expected = [
            r"@@ -1,1 +1,1 @@",
            r"-0000",
            r"\ No newline at end of file",
            r"+1111",
            r"\ No newline at end of file",
            r""]
        self.assertEquals(expected, lines,
                          "Unexpected lines:\n%s" % ("\n".join(lines),))

    def test_diffRelative(self):
        spinner = AsyncCallbackSpinner(self)
        fileName = "hello.txt"
        with open(os.path.join(self._repo, fileName), "w") as f:
            f.write("0000")
        self._run(["add", "hello.txt"])
        self._run(["commit", "-m", "initial commit"], stderr=None)
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
        self.assertTrue(line.startswith("--- hello.txt\t"),
                        "Unexpected old file heading: %r" % (line,))
        line = lines.pop(0)
        self.assertTrue(line.startswith("+++ hello.txt\t"),
                        "Unexpected new file heading: %r" % (line,))
        expected = [
            r"@@ -1,1 +1,1 @@",
            r"-0000",
            r"\ No newline at end of file",
            r"+1111",
            r"\ No newline at end of file",
            r""]
        self.assertEquals(expected, lines,
                          "Unexpected lines:\n%s" % ("\n".join(lines),))

    def test_history(self):
        spinner = AsyncCallbackSpinner(self)
        fileName = os.path.join(self._repo, "hello.txt")
        for i in range(0, 10):
            with open(fileName, "w") as f:
                f.write(("%s" % (i,)) * 10)
            self._run(["add", "hello.txt"])
            self._run(["commit", "-m", "commit %s" % (i,)], stderr=None)
        with spinner:
            self._svc.history(fileName, "", -1, spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc history: %s" % (spinner.data,))
        self.assertEqual(10, len(spinner.data), # one is initial commit
                         "Expected 10 items, got %s:\n%s" %
                         (len(spinner.data), spinner.data))
        items = list(reversed(spinner.data))
        for index, item in enumerate(items):
            self.assertEquals(item.version, str(index + 1),
                              "Unexpected version %s" % (item.version,))
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
        self.assertEqual(line, "=== modified file 'hello.txt'",
                         "Unexpected summary line:\n%s" % (line,))
        line = lines.pop(0)
        self.assertTrue(line.startswith("--- hello.txt\t"),
                        "Unexpected old file heading: %r" % (line,))
        line = lines.pop(0)
        self.assertTrue(line.startswith("+++ hello.txt\t"),
                        "Unexpected new file heading: %r" % (line,))
        expected = [
            r"@@ -1,1 +1,1 @@",
            r"-4444444444",
            r"\ No newline at end of file",
            r"+6666666666",
            r"\ No newline at end of file",
            r""]
        self.assertEquals(expected, lines,
                          "Unexpected lines:\n%s" % ("\n".join(lines),))
