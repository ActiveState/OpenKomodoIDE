#!/usr/bin/python

# Copyright (c) 2000-2007 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

from xpcom import components, nsError, ServerException

class koAsyncOperationBase(object):
    """Utility class to help creating asynchronous operations"""

    _com_interfaces_ = components.interfaces.koIAsyncOperation

    STATUS_RUNNING = components.interfaces.koIAsyncOperation.STATUS_RUNNING
    STATUS_STOPPING = components.interfaces.koIAsyncOperation.STATUS_STOPPING

    def __init__(self, run_function, *args, **kwargs):
        # status can only be one of: running, stopping
        self.status = self.STATUS_RUNNING
        self.data = None
        self.func = run_function
        self.args = args
        self.kwargs = kwargs

    # stop the asynchronous command. Does not have to be implemented,
    # which by default will raise an exception "Cannot be stopped"
    def stop(self):
        raise ServerException(nsError.NS_ERROR_FAILURE, "Cannot be stopped")

    # Private method: called by the koIAsyncService
    def run(self):
        return self.func(*self.args, **self.kwargs)

class koAsyncCallbackWrapper(object):
    """Utility class to help creating asynchronous callback handlers"""

    _com_interfaces_  = components.interfaces.koIAsyncCallback
    RESULT_SUCCESSFUL = components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL
    RESULT_STOPPED    = components.interfaces.koIAsyncCallback.RESULT_STOPPED
    RESULT_ERROR      = components.interfaces.koIAsyncCallback.RESULT_ERROR

    def __init__(self, real_callback):
        self.real_callback = real_callback
        self.success_fn = None
        self.stop_fn = None
        self.failure_fn = None

    def onSuccess(self, fn, *args, **kwargs):
        self.success_fn = fn
        self.success_args = args
        self.success_kwargs = kwargs

    def onStop(self, fn, *args, **kwargs):
        self.stop_fn = fn
        self.stop_args = args
        self.stop_kwargs = kwargs

    def onFailure(self, fn, *args, **kwargs):
        self.failure_fn = fn
        self.failure_args = args
        self.failure_kwargs = kwargs

    def callback(self, result, data):
        try:
            if result == self.RESULT_SUCCESSFUL:
                if self.success_fn:
                    self.success_fn(*self.success_args, **self.success_kwargs)
            elif result == self.RESULT_STOPPED:
                if self.stop_fn:
                    self.stop_fn(*self.stop_args, **self.stop_kwargs)
            else:
                if self.failure_fn:
                    self.failure_fn(*self.failure_args, **self.failure_kwargs)
        finally:
            self.real_callback.callback(result, data)

class koAsyncCallbackWithProgressWrapper(koAsyncCallbackWrapper):
    """Utility class to help creating asynchronous callback handlers"""

    _com_interfaces_ = components.interfaces.koIAsyncCallbackWithProgress

    def onProgress(self, label, value):
        self.real_callback.onProgress(label, value)
