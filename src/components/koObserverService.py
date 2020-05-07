#!/usr/bin/env python
# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""Komodo-specific nsIObserverService implementation to allow the
notify/observe mechanism to be scoped on an object.

Mozilla's nsIObserverService implementation (@mozilla.org/observer-service;1)
is a global thang. This makes it inconvenient to use to pass notifications
to a specific instance of an object if there are many of them. For example:
to notify a specific Komodo document that its encoding has changed via the
global nsIObserverService would require a global listener that would then
pass the notification onto the document instance. If, however, we have a
koObserverService instance attached to the document we can call
.notifyObservers() on it and only registered observers on that particular
document will be bothered by it.

Note: The suffix "Service" on koObserverService is a misnomer because it is
NOT to be used as a service, there must be one instance per user. I.e.
createInstance() must be used instead of getService().
"""

import threading
import logging
from weakref import ref

from xpcom import components, ServerException, COMException, nsError
from xpcom.client import WeakReference
from xpcom.server.enumerator import SimpleEnumerator
from xpcom.server import WrapObject, UnwrapObject

log = logging.getLogger('KoObserverService')
#log.setLevel(logging.DEBUG)

# a base class to implement observer services

class KoObserverService:
    _com_interfaces_ = [components.interfaces.koIObserverService,
                        components.interfaces.nsIObserverService,
                        components.interfaces.nsIObserver]
    _reg_clsid_ = "3B7D0418-1533-4F03-A759-896C058A734A"
    _reg_contractid_ = "@activestate.com/koObserverService;1"
    _reg_desc_ = "Komodo Python Observer Service"
    
    def __init__(self):
        self._topics = {}
        self.cv = threading.Condition()

    def dump(self, topics=None):
        print
        print "KoObserverService"
        if topics is None:
            topics = self._topics.keys()
        for topic in topics:
            observers = self._getLiveObservers(topic)
            print "  %r (%d observers)" % (topic, len(observers))
        print

    # Returns list of observers that are not dead. Maintains a 1-1 match for
    # the returned observers to the "self._topics[topic]" weak references.
    @components.ProxyToMainThread
    def _getLiveObservers(self, topic):
        wr_observers = self._topics.get(topic)
        if wr_observers is None:
            return None
        L = []
        if wr_observers:
            for i in range(len(wr_observers)-1, -1, -1):
                wr = wr_observers[i]
                if not callable(wr):
                    L.insert(0, wr)
                else:
                    try:
                        observer = wr()
                        if observer is not None:
                            L.insert(0, observer)
                            continue
                    except Exception:
                        # bug 72807, pyxpcom failure on trunk
                        # This is occurs when a JavaScript observer has not removed
                        # it's observer before it was cleaned up (garbage collected).
                        #log.exception("WeakReference failed for topic: %r, wr: %r", topic, wr)
                        pass
                    # It's dead, remove it.
                    log.debug("Removed a dead observer for topic: %r", topic)
                    wr_observers.pop(i)
            # There are no live observers left, remove the topic itself.
            if not wr_observers:
                self._topics.pop(topic)
        return L

    # void addObserver( in nsIObserver anObserver, in string aTopic, in boolean ownsWeak);
    def _addObserver(self, anObserver, aTopic, ownsWeak):
        wr_observers = self._topics.get(aTopic)
        if wr_observers is None:
            wr_observers = []
            self._topics[aTopic] = wr_observers

        # Ignoring the ownsWeak argument, always try to create a
        # weakreference, see comments in bug 80145.
        try:
            try:
                # We prefer a Python weak reference, as sometimes our Python
                # code will only hold a Python (non XPCOM) reference to the
                # observer, and then the XPCOM weakreference will report the
                # observer as dead, even though it's still alive in the Python
                # world - bug 88013.
                anObserver = ref(UnwrapObject(anObserver))
            except ValueError:
                # Not a Python object, use an XPCOM weakreference then.
                anObserver = WeakReference(anObserver)
        except COMException:
            pass
        wr_observers.append(anObserver)

    def addObserver(self, anObserver, aTopic, ownsWeak):
        if not anObserver:
            raise ServerException(nsError.NS_ERROR_FAILURE, "Invalid Observer")
        self.cv.acquire()
        try:
            self._addObserver(anObserver, aTopic, ownsWeak)
        finally:
            self.cv.release()
    
    # void addObserverForTopics( in nsIObserver anObserver, in array aTopics, in boolean ownsWeak);
    def addObserverForTopics(self, anObserver, aTopics, ownsWeak):
        if not anObserver:
            raise ServerException(nsError.NS_ERROR_FAILURE, "Invalid Observer")
        self.cv.acquire()
        try:
            for aTopic in aTopics:
                self._addObserver(anObserver, aTopic, ownsWeak)
        finally:
            self.cv.release()
    
    def _removeObserver(self, anObserver, aTopic):
        # Get non-weakref'd list of observers so we can compare the observer we
        # got with that list. This list (observers) will be the same size/order
        # as the original (self._topics[aTopic]). Probably need to deal with
        # thread safety here?
        observers = self._getLiveObservers(aTopic)
        if observers is None:
            # No observers are listening to this topic - but that's okay.
            log.debug("_removeObserver:: no observers listening on topic %r",
                      aTopic)
            return
        try:
            idx = observers.index(anObserver)
            wr_observers = self._topics.get(aTopic)
            wr_observers.pop(idx)
            if not wr_observers:
                # Can remove the topic as well.
                self._topics.pop(aTopic)
        except ValueError:
            # Observer is not in the topic list - but that's okay.
            log.debug("_removeObserver:: no such observer %r listening on "
                      "topic %r", anObserver, aTopic)

    # void removeObserver( in nsIObserver anObserver, in string aTopic );
    def removeObserver(self, anObserver, aTopic):
        try:
            anObserver = UnwrapObject(anObserver)
        except ValueError:
            pass
        self.cv.acquire()
        try:
            self._removeObserver(anObserver, aTopic)
        finally:
            self.cv.release()

    # void removeObserverForTopics( in nsIObserver anObserver, in array aTopics );
    def removeObserverForTopics(self, anObserver, aTopics):
        try:
            anObserver = UnwrapObject(anObserver)
        except ValueError:
            pass
        self.cv.acquire()
        try:
            for aTopic in aTopics:
                self._removeObserver(anObserver, aTopic)
        finally:
            self.cv.release()

    @components.ProxyToMainThread
    def _notifyObservers(self, observers, aSubject, aTopic, someData):
        for observer in observers:
            try:
                observer.observe(aSubject, aTopic, someData)
            except:
                log.exception("notifyObservers:: topic: %r, data: %r", aTopic, someData)

    #void notifyObservers( in nsISupports aSubject, 
    #                      in string aTopic, 
    #                      in wstring someData );
    def notifyObservers(self, aSubject, aTopic, someData):
        topic_observers = None
        catchall_observers = None

        self.cv.acquire()
        try:
            if aTopic:
                topic_observers = self._getLiveObservers(aTopic)
            # A twist, the empty topic is global and recieves all notifications!
            global_observers = self._getLiveObservers('')
            if global_observers:
                if topic_observers:
                    topic_observers += global_observers
                else:
                    topic_observers = global_observers
        finally:
            self.cv.release()

        if topic_observers:
            # Observer notifications must occur on the main thread, as we don't
            # know what the observer is, nor what it will do (i.e. JavaScript).
            self._notifyObservers(topic_observers, aSubject, aTopic, someData)

    # nsISimpleEnumerator enumerateObservers( in string aTopic );
    def enumerateObservers(self, aTopic):
        self.cv.acquire()
        try:
            vals = self._getLiveObservers(aTopic)
        finally:
            self.cv.release()
        if vals is None:
            vals = []
        return SimpleEnumerator(vals)

