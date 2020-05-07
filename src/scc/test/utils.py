__all__ = ["dedent", "AsyncCallbackSpinner"]

import time
from xpcom.components import classes as Cc, interfaces as Ci

def dedent(text, skipLeadingEmpty=True):
    """ Dedent a piece of text, for comparision purposes """
    lines = text.splitlines()
    if skipLeadingEmpty and len(lines) > 0 and lines[0] == "":
        lines = lines[1:] # skip empty line
    prefix = None
    for line in lines:
        remaining = line.lstrip()
        indent = line[:-len(remaining)] if len(remaining) else line
        if prefix is None:
            prefix = indent
            continue
        common = ""
        for i, x in enumerate(prefix[:len(indent)]):
            if indent[i] != x: break
            common += x
        prefix = common
    return "\n".join([line[len(prefix):] for line in lines])

class AsyncCallbackSpinner(object):
    """ Class implementing koIAsyncCallback that acts as a context manager to
        spin the event loop until the callback completes
    """
    _com_interfaces_ = [Ci.koIAsyncCallback]
    def __init__(self, testcase, timeout=30):
        self.timeout = timeout
        self.testcase = testcase
    def __enter__(self):
        self._done = False
    def __exit__(self, *args):
        if any(args):
            return # existing exception
        t = Cc["@mozilla.org/thread-manager;1"].getService().currentThread
        end = time.time() + self.timeout
        while not self._done:
            try:
                # check if we have active dbgp client connections; if we do,
                # somebody is attempting to debug the unit test, and we should
                # disable any timeouts (since that interrupts debugging).
                import dbgp.client
                if len(dbgp.client._clientInstances) > 0:
                    end = time.time() + self.timeout
            except ImportError:
                pass
            if time.time() > end:
                self.testcase.fail("Timed out waiting for async callback")
            # Give some time for things to happen - this reduces the likelihood
            # of a crash occurring... but not sure why!?
            time.sleep(0.1)
            while t.hasPendingEvents():
                t.processNextEvent(True)
    def callback(self, result, data):
        self.result = result
        self.data = data
        self._done = True
