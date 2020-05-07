#!/usr/bin/python

# Copyright (c) 2000-2007 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

from __future__ import with_statement
import sys
import threading
import logging

from xpcom import components, COMException, ServerException, nsError
from xpcom.server import UnwrapObject

from zope.cachedescriptors.property import Lazy as LazyProperty

#---- globals
log = logging.getLogger('koAsyncOperations')
#log.setLevel(logging.DEBUG)


class koAsyncService(object):
    _com_interfaces_ = components.interfaces.koIAsyncService
    _reg_desc_ = "Asynchronous commands service"
    _reg_clsid_ = "{17f2ae57-e130-401e-8ab4-deb1234e16cd}"
    _reg_contractid_ = "@activestate.com/koAsyncService;1"

    # Make some local variables for these xpcom constants
    RESULT_SUCCESSFUL = components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL
    RESULT_STOPPED = components.interfaces.koIAsyncCallback.RESULT_STOPPED
    RESULT_ERROR = components.interfaces.koIAsyncCallback.RESULT_ERROR

    STATUS_RUNNING = components.interfaces.koIAsyncOperation.STATUS_RUNNING
    STATUS_STOPPING = components.interfaces.koIAsyncOperation.STATUS_STOPPING

    # Asynchronous icon used for displaying an "in progress" indicator.
    # This is used here instead of through css because ToddW could not get
    # the css image settings of the notification widget to work correctly.
    # http://bugs.activestate.com/show_bug.cgi?id=74329
    asynchronous_icon_url = "chrome://global/skin/icons/loading_16.png"

    def __init__(self):
        self._runningOperations = []
        self._affectedUris = {}
        self._lockedUris = {}
        self._lock = threading.Lock()

    ###
    # Non-XPCOM functions
    ###

    @LazyProperty
    def _observerSvc(self):
        return components.classes["@mozilla.org/observer-service;1"].\
                getService(components.interfaces.nsIObserverService)

    @components.ProxyToMainThreadAsync
    def notifyObservers(self, subject, topic, data):
        self._observerSvc.notifyObservers(subject, topic, data)

    @components.ProxyToMainThread
    def notifyCallback(self, aOpCallback, result, data):
        aOpCallback.callback(result, data)

    def __run(self, name, aOp, aOpCallback, affected_uris, lock_these_uris, update_status):
        # Add the operation to the list
        tracking_tuple = (name, aOp, aOpCallback, affected_uris, lock_these_uris)
        with self._lock:
            self._runningOperations.append(tracking_tuple)
            for uri in affected_uris:
                self._affectedUris[uri] = self._affectedUris.get(uri, 0) + 1
                if lock_these_uris:
                    self._lockedUris[uri] = self._lockedUris.get(uri, 0) + 1

        # Notify the observers that these uri's have changed.
        if affected_uris and update_status:
            self.notifyObservers(None, 'file_status', "\n".join(affected_uris))

        try:
            # Run the operation
            try:
                aOp.status = self.STATUS_RUNNING
                data = aOp.run()
                log.debug("operation run finished, return data: %r", data)
            except Exception, ex:
                if aOpCallback:
                    log.debug("operation: %r raised exception: %r", aOp, ex)
                    #################################
                    # TODO: Gecko17: Re-look at this!!!
                    #       The commented code causes out-of-memory errors.
                    #################################
                    if isinstance(ex, (ServerException, COMException)):
                        #e = ex
                        e = ex.msg
                    else:
                        #e = ServerException(nsError.NS_ERROR_FAILURE, repr(ex))
                        e = repr(ex)
                    self.notifyCallback(aOpCallback, self.RESULT_ERROR, e)
            else:
                if aOpCallback:
                    if data is None: data = []
                    # An empty unicode string causes an XPCOM exception when
                    # calling to the callback handler. Fix that here. It's
                    # likely this is due to the callback argument being of
                    # XPCOM type nsIVariant, see bug 81444.
                    if isinstance(data, unicode) and data == u"": data = ""
                    try:
                        #print "\n%s: making callback\n" % (name, )
                        if aOp.status == self.STATUS_STOPPING:
                            self.notifyCallback(aOpCallback, self.RESULT_STOPPED, data)
                        else:
                            self.notifyCallback(aOpCallback, self.RESULT_SUCCESSFUL, data)
                    except Exception, ex:
                        log.debug("callback for %r failed: %r", name, ex)
        finally:
            # Remove the operation from the list
            with self._lock:
                try:
                    self._runningOperations.remove(tracking_tuple)
                except ValueError:
                    log.exception("Tracking tuple was already removed")

                # Remove the associated uri's
                for uri in affected_uris:
                    num_affected = self._affectedUris.get(uri)
                    if num_affected is not None:
                        if num_affected > 1:
                            # Other operations are also locking this uri
                            self._affectedUris[uri] = num_affected - 1
                        else:
                            # Remove the uri
                            self._affectedUris.pop(uri)

                    if lock_these_uris:
                        # Unlock the uri's
                        num_locked = self._lockedUris.get(uri)
                        if num_locked is not None:
                            if num_locked > 1:
                                # Other operations are also locking this uri
                                self._lockedUris[uri] = num_locked - 1
                            else:
                                # Remove the lock on this uri
                                self._lockedUris.pop(uri)

            if affected_uris and update_status:
                # XXX - Link with file status service?
                self.notifyObservers(None, 'file_status', "\n".join(affected_uris))

    ###
    # XPCOM functions
    ###

    # Return the list of running koIAsyncOperation's
    def getRunningOperations(self):
        with self._lock:
            return [x[1] for x in self._runningOperations]

    def getAllRunningUris(self):
        return self._affectedUris.keys()

    def getAllLockedUris(self):
        return self._lockedUris.keys()

    def uriHasPendingOperation(self, uri):
        return uri in self._affectedUris

    def uriIsLocked(self, uri):
        return uri in self._lockedUris

    # The "aOp" koIAsyncOperation must be implemented in Python, otherwise this
    # call will raise an exception. If the aOpCallback is defined, this objects
    # "callback" method will automatically called when the koIAsyncOperation run
    # finishes, either through normal operation, cancellation or through an
    # unexpected error.
    def run(self, name, aOp, aOpCallback, affected_uris, lock_these_uris, update_status = False):
        # Test if we can unwrap the operation. This ensure's that aOp is a
        # Python object! If it is not, then an exception will be raised.
        aOp = UnwrapObject(aOp)
        log.debug("Running asynchronous command: %r", name)
        t = threading.Thread(name=name,
                             target=self.__run,
                             args=(name, aOp, aOpCallback, affected_uris,
                                   lock_these_uris, update_status))
        t.setDaemon(True)
        t.start()
