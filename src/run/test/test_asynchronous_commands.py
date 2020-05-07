# Copyright (c) 2000-2007 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.


import os
import sys
import time
import unittest
import threading

from xpcom import components, COMException


class AsyncOpTest(object):

    _com_interfaces_ = components.interfaces.koIAsyncOperation

    def __init__(self, runperiod=10):
        self.status = components.interfaces.koIAsyncOperation.STATUS_RUNNING
        self.running = False
        self.runperiod = runperiod

    def stop(self):
        self.status = components.interfaces.koIAsyncOperation.STATUS_STOPPING
        self.running = False

    def run(self):
        self.running = True
        while self.running and self.runperiod > 0:
            time.sleep(0.1)
            self.runperiod -= 0.1

class AsyncOpWithException(AsyncOpTest):
    def run(self):
        AsyncOpTest.run(self)
        raise Exception("Some exception")

class AsyncOpReturnsListOfStrings(AsyncOpTest):
    def run(self):
        AsyncOpTest.run(self)
        return ["my list"]

class AsyncCallbackTestclass(object):

    _com_interfaces_ = components.interfaces.koIAsyncCallback

    def __init__(self):
        self.result = -1
        self.data = None
        self.ev_callback = threading.Event()

    def callback(self, result, data):
        self.result = result
        self.data = data
        self.ev_callback.set()

class TestAsynchronousCommands(unittest.TestCase):
    def setUp(self):
        self.async_svc = components.classes["@activestate.com/koAsyncService;1"].\
                            getService(components.interfaces.koIAsyncService)

    def test_basic(self):
        op = AsyncOpTest(runperiod=2.0)
        locked_uris = []
        self.async_svc.run("TestAsynchronousCommands.test_basic",
                           op,
                           None,  # callback
                           locked_uris, # uri's locked
                           False, # don't lock
                          )
        time.sleep(1.0)
        self.assertTrue(op.status == components.interfaces.koIAsyncOperation.STATUS_RUNNING)
        # XXX - Assert that the runCommandList is *not* empty
        time.sleep(1.5)
        self.assertTrue(op.status == components.interfaces.koIAsyncOperation.STATUS_RUNNING)
        self.assertTrue(op.runperiod <= 0)
        # XXX - Assert that the runCommandList is now empty

    def test_stop(self):
        op = AsyncOpTest(2.0)
        locked_uris = []
        self.async_svc.run("TestAsynchronousCommands.test_stop",
                           op,
                           None,  # callback
                           locked_uris, # uri's locked
                           False, # don't lock
                          )
        time.sleep(1.0)
        self.assertTrue(op.status == components.interfaces.koIAsyncOperation.STATUS_RUNNING)
        op.stop()
        time.sleep(0.3)
        self.assertTrue(op.status == components.interfaces.koIAsyncOperation.STATUS_STOPPING)
        time.sleep(1.0)
        self.assertTrue(op.runperiod > 0)

    def test_callback(self):
        op = AsyncOpTest(2.0)
        opCallback = AsyncCallbackTestclass()
        locked_uris = []
        self.async_svc.run("TestAsynchronousCommands.test_callback",
                           op,
                           opCallback,  # callback
                           locked_uris, # uri's locked
                           False, # don't lock
                          )
        time.sleep(1.0)
        self.assertTrue(op.status == components.interfaces.koIAsyncOperation.STATUS_RUNNING)
        opCallback.ev_callback.wait(2.0)
        self.assertTrue(op.status == components.interfaces.koIAsyncOperation.STATUS_RUNNING)
        self.assertTrue(op.runperiod <= 0)
        # XXX - Callback does not work when testing outside of Komodo (i.e. bk start)
        #self.assertTrue(opCallback.result == components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL)

    def test_callback_with_stop(self):
        op = AsyncOpTest(2.0)
        opCallback = AsyncCallbackTestclass()
        locked_uris = []
        self.async_svc.run("TestAsynchronousCommands.test_callback_with_stop",
                           op,
                           opCallback,  # callback
                           locked_uris, # uri's locked
                           False, # don't lock
                          )
        time.sleep(1.0)
        self.assertTrue(op.status == components.interfaces.koIAsyncOperation.STATUS_RUNNING)
        op.stop()
        time.sleep(0.3)
        self.assertTrue(op.status == components.interfaces.koIAsyncOperation.STATUS_STOPPING)
        opCallback.ev_callback.wait(5.0)
        self.assertTrue(op.runperiod > 0)
        # XXX - Callback does not work when testing outside of Komodo (i.e. bk start)
        #self.assertTrue(opCallback.result == components.interfaces.koIAsyncCallback.RESULT_STOPPED)


    def test_callback_with_exception(self):
        op = AsyncOpWithException(2.0)
        opCallback = AsyncCallbackTestclass()
        locked_uris = []
        self.async_svc.run("TestAsynchronousCommands.test_callback_with_exception",
                           op,
                           opCallback,  # callback
                           locked_uris, # uri's locked
                           False, # don't lock
                          )
        time.sleep(1.0)
        self.assertTrue(op.status == components.interfaces.koIAsyncOperation.STATUS_RUNNING)
        opCallback.ev_callback.wait(2.0)
        self.assertTrue(op.status == components.interfaces.koIAsyncOperation.STATUS_RUNNING)
        self.assertTrue(op.runperiod <= 0)
        # XXX - Callback does not work when testing outside of Komodo (i.e. bk start)
        #self.assertTrue(opCallback.result == components.interfaces.koIAsyncCallback.RESULT_ERROR)

    def test_run_returns_list_of_strings(self):
        op = AsyncOpReturnsListOfStrings(1.0)
        opCallback = AsyncCallbackTestclass()
        locked_uris = []
        self.async_svc.run("TestAsynchronousCommands.test_run_returns_list_of_strings",
                           op,
                           opCallback,  # callback
                           locked_uris, # uri's locked
                           False, # don't lock
                          )
        opCallback.ev_callback.wait(1.5)
        self.assertTrue(op.status == components.interfaces.koIAsyncOperation.STATUS_RUNNING)
        self.assertTrue(op.runperiod <= 0)
        # XXX - Callback does not work when testing outside of Komodo (i.e. bk start)
        #self.assertTrue(opCallback.result == components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL)

#---- mainline

def suite():
    return unittest.makeSuite(TestAsynchronousCommands)

def test_main():
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(suite())

if __name__ == "__main__":
    test_main()
