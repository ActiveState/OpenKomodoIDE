import logging
import os
import re
import subprocess
import stat
import sys
import tempfile
import time
import unittest
from distutils.version import LooseVersion
from xpcom.components import classes as Cc, interfaces as Ci
from testlib import TestSkipped, tag

sys.path.insert(0, os.path.dirname(__file__))
try:
    from utils import *
finally:
    sys.path.remove(os.path.dirname(__file__))

log = logging.getLogger("scc.test.hg")

class HgTestCaseBase(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        unittest.TestCase.__init__(self, *args, **kwargs)
        self._hg = None

    def _run(self, args, cwd=None, expectedError=False, stderr=""):
        """ Run the given command
            @param args {list} The arguments to run (hg executable is implied)
            @param cwd {str} The directory to run in; if not given, assume this
                    is a HgRepoTestCase and run in the default repo directory
            @param expectedError {bool} If False, check that the command succeeded
            @param stderr {str or None} If not None, check that the stderr
                    output matches the given value.
            @returns tuple(stdout, stderr) if stderr is None; otherwise only
                    stdout is returned (since stderr is known and checked)
        """
        if cwd is None:
            cwd = self._repo
        args = [self._hg, "--noninteractive"] + args
        log.debug("Running %r in %s", args, cwd)
        env = {"LANG": "C"}
        for k in ("SYSTEMROOT", "TEMP", "TMP", "TMPDIR", "PATH"):
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
            self.assertEquals(proc.returncode, 0,
                              "Calling %r failed with %r:\n%s" % (
                                    args, proc.returncode, r_stderr or r_stdout))
        if stderr is not None:
            self.assertEqual(r_stderr, stderr,
                             "Calling %r got unexpected stderr %r (expected %r)" % (
                                args, r_stderr, stderr))
            return r_stdout
        return (r_stdout, r_stderr)

    def setUp(self):
        self._svc = Cc["@activestate.com/koSCC?type=hg;1"]\
                      .getService(Ci.koISCC)
        version = "0"
        if self._hg is None:
            self._hg = self._svc.executable
            if not self._hg:
                raise TestSkipped("Hg missing")
            output = self._run(["--version"], cwd=os.getcwd())
            prefix = "Mercurial Distributed SCM (version "
            if output.startswith(prefix):
                version = output.split(")", 1)[0][len(prefix):]
        self.hgVersion = LooseVersion(version)

    def wipeRepo(self, repo):
        """ Remove a repository """
        if repo is not None and os.path.exists(repo):
            # can't use shutil.rmtree, .hg trees have read-only objects on
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

class HgTestCase(HgTestCaseBase):
    """ Test cases that do not want a default repo """
    def test_basics(self):
        self.assertEquals(self._svc.name, "hg")
        self.assertTrue(self._svc.isEnabled, "hg SCC disabled")
        self.assertFalse(self._svc.executable is None, "No executable")
        self.assertTrue(self._svc.isFunctional, "hg not functional")
        self.assertTrue(self._svc.reasonNotFunctional is None,
                        "Not functional reason given for functional hg")
        self._svc.redetermineIfFunctional() # shouldn't throw
        for cmd in ("add", "checkout", "commit", "diff", "history", "remove",
                    "revert", "status", "update"):
            self.assertEquals(self._svc.getValue("supports_command", cmd), "Yes",
                              "hg should support command '%s'" % (cmd,))
        for cmd in ("pants",):
            self.assertNotEquals(self._svc.getValue("supports_command", cmd),
                                 "Yes",
                                 "hg should not support command '%s'" % (cmd,))

    def test_update(self):
        spinner = AsyncCallbackSpinner(self)
        source, dest = None, None
        try:
            source = tempfile.mkdtemp()
            source_file = os.path.join(source, "hello.txt")
            self._run(["init"], cwd=source)
            with open(source_file, "w") as f:
                f.write("initial")
            self._run(["add", "--", "hello.txt"], cwd=source)
            self._run(["commit", "-m", "initial", "--user", "komodo-test"], cwd=source)
            dest = tempfile.mkdtemp()
            os.rmdir(dest)
            dest_file = os.path.join(dest, "hello.txt")
            with spinner:
                self._svc.checkout(source, dest, "", spinner, None)
            self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                             "Error occurred while doing scc checkout: %s" % (spinner.data,))
            with open(source_file, "w") as f:
                f.write("update")
            self._run(["commit", "-m", "update", "--user", "komodo-test"], cwd=source)
            with spinner:
                self._svc.update([dest], None, spinner)
            self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                             "Error occurred while doing scc update: %s" % (spinner.data,))
            with open(dest_file, "r") as f:
                data = f.read()
                self.assertEqual(data, "update",
                                 "File was not correctly updated:\n%s" % (data,))
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
            with open(source_file, "w") as f:
                f.write("initial")
            self._run(["add", "--", "hello.txt"], cwd=source)
            self._run(["commit", "-m", "initial", "--user", "komodo-test"], cwd=source)
            dest = tempfile.mkdtemp()
            os.rmdir(dest)
            dest_file = os.path.join(dest, "hello.txt")
            with spinner:
                self._svc.checkout(source, dest, "", spinner, None)
            self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                             "Error occurred while doing scc checkout: %s" % (spinner.data,))
            with open(dest_file, "w") as f:
                f.write("push")
            self._run(["commit", "-m", "update", "--user", "komodo-test"], cwd=dest)
            with spinner:
                self._svc.push(source, dest, spinner)
            self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                             "Error occurred while doing scc push: %s" % (spinner.data,))
            self._run(["update"], cwd=source)
            with open(source_file, "r") as f:
                data = f.read()
                self.assertEqual(data, "push",
                                 "File was not correctly pushed:\n%s" % (data,))
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
            with open(source_file, "w") as f:
                f.write("initial")
            self._run(["add", "--", "hello.txt"], cwd=source)
            self._run(["commit", "-m", "initial", "--user", "komodo-test"], cwd=source)
            dest = tempfile.mkdtemp()
            os.rmdir(dest)
            dest_file = os.path.join(dest, "hello.txt")
            with spinner:
                self._svc.checkout(source, dest, "", spinner, None)
            self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                             "Error occurred while doing scc checkout: %s" % (spinner.data,))
            with open(dest_file, "w") as f:
                f.write("push")
            self._run(["commit", "-m", "update", "--user", "komodo-test"], cwd=dest)
            with spinner:
                self._svc.push(None, dest, spinner)
            self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                             "Error occurred while doing scc push: %s" % (spinner.data,))
            self._run(["update"], cwd=source)
            with open(source_file, "r") as f:
                self.assertEqual(f.read(), "push",
                                 "File was not correctly pushed")
        finally:
            self.wipeRepo(source)
            self.wipeRepo(dest)

class HgRepoTestCase(HgTestCaseBase):
    """ Test cases that require a hg repo to run"""
    def __init__(self, *args, **kwargs):
        HgTestCaseBase.__init__(self, *args, **kwargs)
        self._repo = None

    def setUp(self):
        HgTestCaseBase.setUp(self)
        self._repo = tempfile.mkdtemp()
        self._run(["init"])

    def tearDown(self):
        if self._repo is not None:
            self.wipeRepo(self._repo)
        self._repo = None

    def test_init(self):
        stdout = self._run(["status", "--all"])
        self.assertEqual(stdout, "",
                         "Unexpected stdout on empty repo:\n%s" % (stdout,))
        stdout = self._run(["identify"])
        self.assertEqual(stdout, "000000000000 tip\n",
                         "Unexpected stdout decribing empty repo:\n%s" % (stdout,))

    def test_status(self):
        spinner = AsyncCallbackSpinner(self)
        for filename in "modified", "removed", "missing", "clean":
            with open(os.path.join(self._repo, filename), "w") as f:
                f.write("!")
            self._run(["add", filename])
        self._run(["commit", "-m", "initial commit", "-u", "komodo-test"])
        for filename in "modified", "added", "new":
            with open(os.path.join(self._repo, filename), "w") as f:
                f.write("@@")
        self._run(["add", "added"])
        self._run(["remove", "removed"])
        os.unlink(os.path.join(self._repo, "missing"))
        stdout = self._run(["status", "--all"])
        expected = {"added":    "A",
                    "modified": "M",
                    "removed":  "R",
                    "new":      "?",
                    "missing":  "!",
                    "clean":    "C"}
        actual = dict([(line[2:], line[0]) for line in stdout.splitlines() if line])
        self.assertEqual(expected, actual, "Unexpected status:\n%r" % (actual,))
        files = [os.path.join(self._repo, filename) for filename in expected.keys()]
        with spinner:
            self._svc.status(files, False, "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revert: %s" % (spinner.data,))
        expected = {"added":    Ci.koISCC.STATUS_ADDED,
                    "modified": Ci.koISCC.STATUS_MODIFIED,
                    "removed":  Ci.koISCC.STATUS_DELETED,
                    "missing":  Ci.koISCC.STATUS_CONFLICT}
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
        stdout = self._run(["status", "--all"])
        self.assertEqual(stdout, "? hello.txt\n",
                         "Unexpected stdout on unknown file:\n%s" % (stdout,))
        with spinner:
            op = self._svc.add([fileName], "0644", "(unused)", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc add")
        stdout = self._run(["status", "--all"])
        self.assertEqual(stdout, "A hello.txt\n",
                         "Unexpected stdout after file add:\n%s" % (stdout,))
        with spinner:
            op = self._svc.commit([fileName], "Testing add", "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc commit")
        stdout = self._run(["status", "--all"])
        self.assertEqual(stdout, "C hello.txt\n",
                         "Unexpected stdout on clean repo:\n%s" % (stdout,))

    def test_revert(self):
        spinner = AsyncCallbackSpinner(self)
        for filename in "modified", "removed", "missing", "clean":
            with open(os.path.join(self._repo, filename), "w") as f:
                f.write("!")
            self._run(["add", filename])
        self._run(["commit", "-m", "initial commit", "-u", "komodo-test"])
        for filename in "modified", "added", "new":
            with open(os.path.join(self._repo, filename), "w") as f:
                f.write("@@")
        self._run(["add", "added"])
        self._run(["remove", "removed"])
        os.unlink(os.path.join(self._repo, "missing"))
        stdout = self._run(["status", "--all"])
        expected = {"added":    "A",
                    "modified": "M",
                    "removed":  "R",
                    "new":      "?",
                    "missing":  "!",
                    "clean":    "C"}
        actual = dict([(line[2:], line[0]) for line in stdout.splitlines() if line])
        self.assertEqual(expected, actual, "Unexpected status:\n%r" % (actual,))
        files = [os.path.join(self._repo, filename) for filename in expected.keys()]
        with spinner:
            self._svc.revert(files, "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revert: %s" % (spinner.data,))

        stdout = self._run(["status", "--all"] + expected.keys())
        expected = {"added":    "?",
                    "modified": "C",
                    "removed":  "C",
                    "new":      "?",
                    "missing":  "C",
                    "clean":    "C"}
        actual = dict([(line[2:], line[0]) for line in stdout.splitlines() if line])
        self.assertEqual(expected, actual, "Unexpected status:\n%r" % (actual,))
        for filename in [name for name, status in expected.items() if status == "C"]:
            with open(os.path.join(self._repo, filename), "r") as f:
                self.assertEquals(f.read(), "!",
                                  "Unexpected contents in %s" % (filename,))
        for filename in [name for name, status in expected.items() if status == "?"]:
            with open(os.path.join(self._repo, filename), "r") as f:
                self.assertEquals(f.read(), "@@",
                                  "Unexpected contents in %s" % (filename,))

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
        stdout = self._run(["status", "--all"])
        self.assertEqual(stdout, "C hello.txt\n",
                         "Unexpected stdout on clean repo:\n%s" % (stdout,))
        with spinner:
            op = self._svc.remove([fileName], False, False, spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc remove")
        stdout = self._run(["status", "--all"])
        self.assertEqual(stdout, "R hello.txt\n",
                         "Unexpected stdout on modified repo:\n%s" % (stdout,))
        self.assertFalse(os.path.exists(fileName),
                         "Removing file did not delete it")
        with spinner:
            op = self._svc.revert([fileName], "", spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revert: %s" % (spinner.data,))
        stdout = self._run(["status", "--all"])
        self.assertEqual(stdout, "C hello.txt\n",
                         "Unexpected stdout on clean repo:\n%s" % (stdout,))
        self.assertTrue(os.path.exists(fileName),
                        "reverting a remove did not bring the file back")

    def test_edit(self):
        spinner = AsyncCallbackSpinner(self)
        with spinner:
            fileName = os.path.join(self._repo, "hello.txt")
            self._svc.edit([fileName], spinner)
        # hg should not support an "edit" command, this isn't visual source safe
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_ERROR,
                         "Unexpected pass: running hg edit")

    def test_diff(self):
        spinner = AsyncCallbackSpinner(self)
        fileName = os.path.join(self._repo, "hello.txt")
        with open(fileName, "w") as f:
            f.write("0000")
        self._run(["add", "hello.txt"])
        self._run(["commit", "-m", "initial commit", "--user", "komodo-test"])
        with open(fileName, "w") as f:
            f.write("1111")
        with spinner:
            self._svc.diff([fileName], "--git", None, spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc diff: %s" % (spinner.data,))
        expected = dedent("""
            Index: %s
            --- a/hello.txt
            +++ b/hello.txt
            @@ -1,1 +1,1 @@
            -0000
            \ No newline at end of file
            +1111
            \ No newline at end of file
            """ % (fileName,))
        self.assertEqual(expected, spinner.data.replace("\r", ""),
                         "Unexpected lines:\n%s" % (spinner.data))

    def test_diffRelative(self):
        spinner = AsyncCallbackSpinner(self)
        fileName = "hello.txt"
        with open(os.path.join(self._repo, fileName), "w") as f:
            f.write("0000")
        self._run(["add", "hello.txt"])
        self._run(["commit", "-m", "initial commit", "--user", "komood-test"])
        with open(os.path.join(self._repo, fileName), "w") as f:
            f.write("1111")
        with spinner:
            self._svc.diffRelative(self._repo, [fileName], "--git", None, spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc diff: %s" % (spinner.data,))
        expected = dedent("""
            Index: %s
            --- a/hello.txt
            +++ b/hello.txt
            @@ -1,1 +1,1 @@
            -0000
            \ No newline at end of file
            +1111
            \ No newline at end of file
            """ % (os.path.join(self._repo, fileName),))
        self.assertEqual(expected, spinner.data.replace("\r", ""),
                         "Unexpected lines:\n%s" % (spinner.data,))

    def test_history(self):
        spinner = AsyncCallbackSpinner(self)
        fileName = os.path.join(self._repo, "hello.txt")
        for i in range(0, 10):
            with open(fileName, "w") as f:
                f.write(("%s" % (i,)) * 10)
            if i == 0:
                self._run(["add", "hello.txt"])
            self._run(["commit", "-m", "commit %s" % (i,), "--user", "komodo-test"])
        with spinner:
            self._svc.history(fileName, "", -1, spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc history: %s" % (spinner.data,))
        self.assertEqual(10, len(spinner.data), # one is initial commit
                         "Expected 10 items, got %s:\n%s" %
                         (len(spinner.data), spinner.data))
        items = list(reversed(spinner.data))
        for index, item in enumerate(items):
            self.assertEquals(item.version, str(index),
                              "Unexpected version %s" % (item.version,))
            self.assertEquals("", item.change,
                              "Unexpected change %s" % (item.change,))
            self.assertEquals("", item.action,
                              "Unexpected action %s" % (item.action,))
            self.assertEquals("commit %s" % (index,), item.message,
                              "Unexpected message %s" % (item.message,))

        with spinner:
            self._svc.diffRevisions(fileName, items[4].version,
                                    fileName, items[6].version,
                                    fileName, "--git", None, spinner)
        self.assertEqual(spinner.result, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                         "Error occurred while doing scc revision diff: %s" % (spinner.data,))
        expected = dedent("""
            Index: %s
            --- a/hello.txt
            +++ b/hello.txt
            @@ -1,1 +1,1 @@
            -4444444444
            \ No newline at end of file
            +6666666666
            \ No newline at end of file
            """ % (os.path.join(self._repo, "hello.txt"),))
        self.assertEqual(expected, spinner.data.replace("\r", ""),
                         "Unexpected revision diff:\n%s" % (spinner.data,))
