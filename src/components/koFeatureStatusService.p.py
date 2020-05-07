#!/usr/bin/env python
# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
import sys
import re
import types
import threading
import Queue
import logging
import which
from xpcom import components, nsError, ServerException, COMException
import koprocessutils
import invocationutils


log = logging.getLogger('koFeatureStatusService')
##log.setLevel(logging.DEBUG)


#---- component implementation

class KoFeatureStatus:
    _com_interfaces_ = [components.interfaces.koIFeatureStatus]
    _reg_clsid_ = "{62DA2673-1653-4CC6-9A06-8FDBFE39F025}"
    _reg_contractid_ = "@activestate.com/koFeatureStatus;1"
    _reg_desc_ = "The status of a particular Komodo feature."

    def __init__(self, featureName, status, reason=None):
        self.featureName = featureName
        self.status = status
        self.reason = reason


class KoFeatureStatusService:
    """Listen for a "feature_status_request" notifications to initiate
    status retrieval in a separate thread and then return the result in
    a "feature_status_result".
    
    Implementation Notes:
        This service currently will startup a background thread only when
        necessary to avoid having a thread always sitting there to
        gather data that is very infrequently gathered. This thread is
        smart enough to keep going if requests for status on multiple
        features come in in quick succession.
        
        This setup makes the code a little bit more complex than it would
        be with just a single long running thread.
    """
    _com_interfaces_ = [components.interfaces.koIFeatureStatusService,
                        components.interfaces.nsIObserver]
    _reg_clsid_ = "{46A0BD16-D67C-4DCD-AE19-5C9CECB6A669}"
    _reg_contractid_ = "@activestate.com/koFeatureStatusService;1"
    _reg_desc_ = "Give functional status info for features in Komodo."

    _hgSvc = None
    _gitSvc = None
    _bzrSvc = None

    def __init__(self):
        self._fsLock = threading.Lock()
        # A queue of feature names for which the status has been requested.
        self._fsQueue = Queue.Queue()
        # A thread to gather the status of the features named in the Queue.
        self._fsThread = None
        self._fsThreadExiting = threading.Event()

        # Get a schwack of services and components and proxy them all.
        self._observerSvc = components.classes["@mozilla.org/observer-service;1"].\
            getService(components.interfaces.nsIObserverService)

        self._lastErrorSvc = components.classes["@activestate.com/koLastErrorService;1"].\
            getService(components.interfaces.koILastErrorService)

        self._prefs = components.classes["@activestate.com/koPrefService;1"]\
                        .getService(components.interfaces.koIPrefService)\
                        .prefs

# #if WITH_SCC
        # TODO: These services need to be dynamically generated.
        self._cvsSvc = components.classes["@activestate.com/koSCC?type=cvs;1"].\
            getService(components.interfaces.koISCC)

        self._p4Svc = components.classes["@activestate.com/koSCC?type=p4;1"].\
            getService(components.interfaces.koISCC)

        self._svnSvc = components.classes["@activestate.com/koSCC?type=svn;1"].\
            getService(components.interfaces.koISCC)

        try:
            self._hgSvc = components.classes["@activestate.com/koSCC?type=hg;1"].\
                getService(components.interfaces.koISCC)
        except:
            # Likely not available (i.e. user uninstalled the add-on)
            pass

        try:
            self._gitSvc = components.classes["@activestate.com/koSCC?type=git;1"].\
                getService(components.interfaces.koISCC)
        except:
            # Likely not available (i.e. user uninstalled the add-on)
            pass

        try:
            self._bzrSvc = components.classes["@activestate.com/koSCC?type=bzr;1"].\
                getService(components.interfaces.koISCC)
        except:
            # Likely not available (i.e. user uninstalled the add-on)
            pass
# #endif

        self._nodejsInfoEx = components.classes["@activestate.com/koAppInfoEx?app=NodeJS;1"].\
            createInstance(components.interfaces.koIAppInfoEx)
        self._perlInfoEx = components.classes["@activestate.com/koAppInfoEx?app=Perl;1"].\
            createInstance(components.interfaces.koIAppInfoEx)
        self._phpInfoEx = components.classes["@activestate.com/koAppInfoEx?app=PHP;1"].\
            createInstance(components.interfaces.koIAppInfoEx)
        self._pythonInfoEx = components.classes["@activestate.com/koAppInfoEx?app=Python;1"].\
            getService(components.interfaces.koIAppInfoEx)
        self._python3InfoEx = components.classes["@activestate.com/koAppInfoEx?app=Python3;1"].\
            getService(components.interfaces.koIAppInfoEx)
        self._rubyInfoEx = components.classes["@activestate.com/koAppInfoEx?app=Ruby;1"].\
            createInstance(components.interfaces.koIAppInfoEx)
        self._tclInfoEx = components.classes["@activestate.com/koAppInfoEx?app=Tcl;1"].\
            createInstance(components.interfaces.koITclInfoEx)
        
        try:
            self._userPath = koprocessutils.getUserEnv()["PATH"].split(os.pathsep)
        except Exception:
            self._userPath = []

        self._observerSvc.addObserver(self, 'xpcom-shutdown', 0)
        self._observerSvc.addObserver(self, "feature_status_request",0)
        self._ignoreExceptions = 0

    def finalize(self):
        log.info("finalize")
        try:
            self._observerSvc.removeObserver(self, "feature_status_request")
            self._observerSvc.removeObserver(self, 'xpcom-shutdown')
        except:
            log.error("Unable to remove observer feature_status_request")
        # Would like to .join() on the acquirer thread but that results
        # in deadlock because while the main thread is waiting on the
        # join the proxied services being used in the acquirer thread
        # are trying to use the main thread. Sol'n: just let the
        # acquirer thread run its course but tell it to ignore
        # exceptions.
        self._ignoreExceptions = 1
        # XXX Would like to make self._fsQueue a priority Queue and
        #     insert a high priority __exit__ directive on finalize.
        #     No need to process remaining requests.

    def observe(self, dummy, topic, featureName):
        if topic == "feature_status_request":
            log.info("request status of feature '%s'", featureName)
            # Queue up that feature name.
            self._fsQueue.put(featureName)
            # Start up the background thread if there is not already one
            # running.
            self._fsLock.acquire()
            if self._fsThread is None:
                self._fsThread = threading.Thread(target=self._fsAcquirer)
                self._fsThreadExiting.clear()
                self._fsThread.start()
            elif self._fsThreadExiting.isSet():
                self._fsThread.join()
                self._fsThread = threading.Thread(target=self._fsAcquirer)
                self._fsThreadExiting.clear()
                self._fsThread.start()
            self._fsLock.release()
        elif topic == "xpcom-shutdown":
            self.finalize()
        else:
            errmsg = "Unexpected nsIObserver topic: '%s'" % topic
            log.error(errmsg)
            raise ServerException(nsError.NS_ERROR_UNEXPECTED)

    @components.ProxyToMainThreadAsync
    def notifyObservers(self, subject, topic, data):
        self._observerSvc.notifyObservers(subject, topic, data)

    def _fsAcquirer(self):
        """Acquire status for all the features named in self._fsQueue and
        send notifications with the results until the queue is empty.
        """
        log.info("start feature status acquirer thread")
        while 1:
            self._fsLock.acquire()
            try:
                try:
                    featureName = self._fsQueue.get_nowait()
                except Queue.Empty:
                    log.info("status acquirer thread exiting")
                    self._fsThreadExiting.set()
                    break
            finally:
                self._fsLock.release()
                
            try:
                status = "Status Unknown"
                reason = None
                if featureName == "Perl Debugging":
# #if WITH_DEBUGGING
                    if self._haveSufficientPerl(minVersion="5.6.0"):
                        status = "Ready"
                    else:
                        status = "Not Functional"
                        reason = self._lastErrorSvc.getLastErrorMessage()
# #elif PRODUCT_TYPE == "edit"
                        status = "Komodo IDE only"
                        reason = "Debugging is only available in Komodo IDE"
# #else
                        status = "Not Functional"
                        reason = "Debugging is not available"
# #endif
                elif featureName == "Perl Syntax Checking":
                    if self._haveSufficientPerl():
                        status = "Ready"
                    else:
                        status = "Not Functional"
                        reason = self._lastErrorSvc.getLastErrorMessage()
                        
                elif featureName == "Node.js Debugging":
# #if WITH_DEBUGGING
                    if self._haveSufficientNodeJS():
                        status = "Ready"
                    else:
                        status = "Not Functional"
                        reason = self._lastErrorSvc.getLastErrorMessage()
# #elif PRODUCT_TYPE == "edit"
                        status = "Komodo IDE only"
                        reason = "Debugging is only available in Komodo IDE"
# #else
                        status = "Not Functional"
                        reason = "Debugging is not available"
# #endif
                elif featureName == "Node.js Syntax Checking":
                    if self._haveSufficientNodeJS():
                        status = "Ready"
                    else:
                        status = "Not Functional"
                        reason = self._lastErrorSvc.getLastErrorMessage()
                        
                elif featureName == "PHP Debugging":
# #if WITH_DEBUGGING
                    if self._haveSufficientPHP(feature="Debugging",
                                                minVersion="4.3.10"):
                        status = "Ready"
                    else:
                        status = "Not Functional"
                        reason = self._lastErrorSvc.getLastErrorMessage()
# #elif PRODUCT_TYPE == "edit"
                        status = "Komodo IDE only"
                        reason = "Debugging is only available in Komodo IDE"
# #else
                        status = "Not Functional"
                        reason = "Debugging is not available"
# #endif
                elif featureName == "PHP Syntax Checking":
                    if self._haveSufficientPHP(feature="Syntax Checking",
                                                minVersion="4.0.5"):
                        status = "Ready"
                    else:
                        status = "Not Functional"
                        reason = self._lastErrorSvc.getLastErrorMessage()
                elif featureName == "Python Debugging":
# #if WITH_DEBUGGING
                    if self._haveSufficientPython(minVersion="1.5.2"):
                        status = "Ready"
                    else:
                        status = "Not Functional"
                        reason = self._lastErrorSvc.getLastErrorMessage()
# #elif PRODUCT_TYPE == "edit"
                        status = "Komodo IDE only"
                        reason = "Debugging is only available in Komodo IDE"
# #else
                        status = "Not Functional"
                        reason = "Debugging is not available"
# #endif
                elif featureName == "Python Syntax Checking":
                    if self._haveSufficientPython():
                        status = "Ready"
                    else:
                        status = "Not Functional"
                        reason = self._lastErrorSvc.getLastErrorMessage()
                elif featureName == "Python3 Debugging":
# #if WITH_DEBUGGING
                    if self._haveSufficientPython3(minVersion="3.0.0"):
                        status = "Ready"
                    else:
                        status = "Not Functional"
                        reason = self._lastErrorSvc.getLastErrorMessage()
# #elif PRODUCT_TYPE == "edit"
                        status = "Komodo IDE only"
                        reason = "Debugging is only available in Komodo IDE"
# #else
                        status = "Not Functional"
                        reason = "Debugging is not available"
# #endif
                elif featureName == "Python3 Syntax Checking":
                    if self._haveSufficientPython3():
                        status = "Ready"
                    else:
                        status = "Not Functional"
                        reason = self._lastErrorSvc.getLastErrorMessage()
                elif featureName == "Ruby Debugging":
# #if WITH_DEBUGGING
                    if self._haveSufficientRuby(minVersion="1.8.4"):
                        status = "Ready"
                    else:
                        status = "Not Functional"
                        reason = self._lastErrorSvc.getLastErrorMessage()
# #elif PRODUCT_TYPE == "edit"
                        status = "Komodo IDE only"
                        reason = "Debugging is only available in Komodo IDE"
# #else
                        status = "Not Functional"
                        reason = "Debugging is not available"
# #endif
                elif featureName == "Ruby Syntax Checking":
                    if self._haveSufficientRuby():
                        status = "Ready"
                    else:
                        status = "Not Functional"
                        reason = self._lastErrorSvc.getLastErrorMessage()
                elif featureName == "Tcl Debugging":
# #if WITH_DEBUGGING
                    if self._haveSufficientTcl():
                        status = "Ready"
                    else:
                        status = "Not Functional"
                        reason = self._lastErrorSvc.getLastErrorMessage()
# #elif PRODUCT_TYPE == "edit"
                        status = "Komodo IDE only"
                        reason = "Debugging is only available in Komodo IDE"
# #else
                        status = "Not Functional"
                        reason = "Debugging is not available"
# #endif
                elif featureName == "Tcl Syntax Checking":
                    if self._haveSufficientTcl():
                        status = "Ready"
                    else:
                        status = "Not Functional"
                        reason = self._lastErrorSvc.getLastErrorMessage()
# #if WITH_SCC
                elif featureName == "CVS":
                    if self._prefs.getBooleanPref("cvsEnabled"):
                        if self._cvsSvc.isFunctional:
                            status = "Ready"
                        else:
                            status = "Not Functional"
                            reason = self._cvsSvc.reasonNotFunctional
                    else:
                        status = "Disabled"
                elif featureName == "Perforce":
                    if self._prefs.getBooleanPref("p4Enabled"):
                        if self._p4Svc.isFunctional:
                            status = "Ready"
                        else:
                            status = "Not Functional"
                            reason = self._p4Svc.reasonNotFunctional
                    else:
                        status = "Disabled"
                elif featureName == "Subversion":
                    if self._prefs.getBooleanPref("svnEnabled"):
                        if self._svnSvc.isFunctional:
                            status = "Ready"
                        else:
                            status = "Not Functional"
                            reason = self._svnSvc.reasonNotFunctional
                    else:
                        status = "Disabled"

                elif featureName == "Mercurial":
                    if not self._hgSvc:
                        status = "Disabled"
                        reason = "Mercurial add-on is disabled"
                    elif self._prefs.getBoolean("hgEnabled", True):
                        if self._hgSvc.isFunctional:
                            status = "Ready"
                        else:
                            status = "Not Functional"
                            reason = self._hgSvc.reasonNotFunctional
                    else:
                        status = "Disabled"

                elif featureName == "Git":
                    if not self._gitSvc:
                        status = "Disabled"
                        reason = "Git add-on is disabled"
                    elif self._prefs.getBoolean("gitEnabled", True):
                        if self._gitSvc.isFunctional:
                            status = "Ready"
                        else:
                            status = "Not Functional"
                            reason = self._gitSvc.reasonNotFunctional
                    else:
                        status = "Disabled"

                elif featureName == "Bazaar":
                    if not self._bzrSvc:
                        status = "Disabled"
                        reason = "Bazaar add-on is disabled"
                    elif self._prefs.getBoolean("bzrEnabled", True):
                        if self._bzrSvc.isFunctional:
                            status = "Ready"
                        else:
                            status = "Not Functional"
                            reason = self._bzrSvc.reasonNotFunctional
                    else:
                        status = "Disabled"
# #endif

                else:
                    errmsg = "Unexpected feature name: %s" % featureName
                    log.error(errmsg)
                    raise ServerException(nsError.NS_ERROR_UNEXPECTED)
                
                log.info("status of %r feature: %s (%s)", featureName, status,
                         reason)
                st = KoFeatureStatus(featureName, status, reason)
                try:
                    self.notifyObservers(st, "feature_status_ready", featureName)
                except COMException, ex:
                    # do nothing: Notify sometimes raises an exception if
                    # receivers are not registered?
                    log.warn("exception notifying 'feature_status_ready': %s", ex)
                    pass
            except:
                if not self._ignoreExceptions:
                    raise

    def _isSufficientPerl(self, perlInfoEx, minVersion=None,
                          isActivePerl=None, minActivePerlBuild=None,
                          haveModules=[]):
        """Return true iff the given perl installation meets the given
        criteria.
            "perlInfoEx" is a koPerlInfoEx instance loaded with the perl
                installation to check.

        If false is returned, then the last error (see koILastErrorService)
        is set with a reason why.
        """
        installDir = perlInfoEx.installationPath
        exePath = perlInfoEx.executablePath
        log.info("%s: is sufficient perl?", installDir)

        if not exePath or not os.path.exists(exePath):
            log.info("%s: does not exist", exePath)
            self._lastErrorSvc.setLastError(0,
                "Perl installation does not exist: \"%s\"" % exePath)
            return 0
        else:
            log.info("%s: exists", exePath)

        if minVersion is not None:
            try:
                version = perlInfoEx.version
            except COMException:
                log.info("%s: couldn't get version", installDir)
                self._lastErrorSvc.setLastError(0,
                    "Could not determine Perl version: %s. " % installDir)
                return 0
            else:
                if (invocationutils.split_short_ver(version, intify=True)
                    < invocationutils.split_short_ver(minVersion, intify=True)):
                    log.info("%s: %s < %s", installDir, version, minVersion)
                    self._lastErrorSvc.setLastError(0,
                        "Insufficient Perl version (\"%s\" is version %s). "\
                        "Require at least version %s."\
                        % (installDir, version, minVersion))
                    return 0
                else:
                    log.info("%s: %s >= %s", installDir, version, minVersion)
        
        buildNumber = None
        if isActivePerl is not None or minActivePerlBuild is not None:
            try:
                buildNumber = perlInfoEx.buildNumber
            except COMException, ex:
                log.info("%s: not ActivePerl", installDir)
                self._lastErrorSvc.setLastError(0,
                    "Perl installation is not ActivePerl: %s" % installDir)
                return 0
            else:
                log.info("%s: is ActivePerl", installDir)

        if minActivePerlBuild is not None:
            if buildNumber is None:
                log.info("%s: couldn't determine ActivePerl build number",
                         installDir)
                self._lastErrorSvc.setLastError(0,
                    "Could not determine ActivePerl build number: %s"\
                    % installDir)
                return 0
            elif buildNumber < minActivePerlBuild:
                log.info("%s: build %s < build %s", installDir, buildNumber,
                         minActivePerlBuild)
                self._lastErrorSvc.setLastError(0,
                    "Insufficient ActivePerl build (\"%s\" is build %s). "\
                    "Require at least version %s."\
                    % (installDir, buildNumber, minActivePerlBuild))
                return 0
            else:
                log.info("%s: build %s >= build %s", installDir, buildNumber,
                         minActivePerlBuild)

        if haveModules:
            if not perlInfoEx.haveModules(haveModules):
                log.info("%s: does not have all of the following modules: %r",
                         installDir, haveModules)
                self._lastErrorSvc.setLastError(0,
                    "Perl installation at '%s' does not have all of the "\
                    "following modules: %s"\
                    % (installDir, ','.join(haveModules)))
                return 0
            else:
                log.info("%s: has required modules: %r", installDir,
                         haveModules)

        return 1

    def _haveSufficientPerl(self, stopOnFirst=1, minVersion=None,
                            isActivePerl=None, minActivePerlBuild=None,
                            haveModules=[]):
        """Return true iff a Perl installation meeting the above conditions
        can be found.
            "stopOnFirst" is a boolean indicating if the search should stop
                on the "first" found interpreter. This is because things like
                debugging and syntax checking are just going to use this
                one anyway. Default is true.

        If false is returned, then the last error (see koILastErrorService)
        is set with a reason why.
        """
        # Try the user's selected perl interpreter.
        perlDefaultInterp = self._prefs.getStringPref("perlDefaultInterpreter")
        if perlDefaultInterp:
            log.debug("perlDefaultInterp")
            self._perlInfoEx.installationPath =\
                self._perlInfoEx.getInstallationPathFromBinary(perlDefaultInterp)
            log.debug("self._perlInfoEx.installationPath=%r",
                      self._perlInfoEx.installationPath)
            if self._isSufficientPerl(self._perlInfoEx, minVersion,
                                      isActivePerl, minActivePerlBuild,
                                      haveModules):
                log.debug("self._isSufficientPerl: 1")
                return 1
            elif stopOnFirst:
                log.debug("self._isSufficientPerl: 0, stopOnFirst")
                return 0
            else:
                log.debug("self._isSufficientPerl: 0")
        else:
            log.debug("no perlDefaultInterp")
            
        # Look on PATH.
        if sys.platform.startswith('win'):
            exts = ['.exe']
        else:
            exts = None
        perls = which.whichall('perl', exts=exts, path=self._userPath)
        log.debug("no perlDefaultInterp")
        for perl in perls:
            self._perlInfoEx.installationPath =\
                self._perlInfoEx.getInstallationPathFromBinary(perl)
            log.debug("self._perlInfoEx.installationPath=%r",
                      self._perlInfoEx.installationPath)
            if self._isSufficientPerl(self._perlInfoEx, minVersion,
                                      isActivePerl, minActivePerlBuild,
                                      haveModules):
                return 1
            elif stopOnFirst:
                return 0
        
        errmsg = "Could not find a suitable Perl installation."
        self._lastErrorSvc.setLastError(0, errmsg)
        return 0

    def _isSufficientNodeJS(self, nodejsInfoEx, minVersion=None):
        """Return true iff the given nodejs installation meets the given
        criteria.
            "nodejsInfoEx" is a koNodeJSInfoEx instance loaded with the nodejs
                installation to check.

        If false is returned, then the last error (see koILastErrorService)
        is set with a reason why.
        """
        installDir = nodejsInfoEx.installationPath
        exePath = nodejsInfoEx.executablePath
        log.info("%s: is sufficient nodejs?", installDir)

        if not exePath or not os.path.exists(exePath):
            log.info("%s: does not exist", exePath)
            self._lastErrorSvc.setLastError(0,
                "NodeJS installation does not exist: \"%s\"" % exePath)
            return 0
        else:
            log.info("%s: exists", exePath)

        if minVersion is not None:
            try:
                version = nodejsInfoEx.version
            except COMException:
                log.info("%s: couldn't get version", installDir)
                self._lastErrorSvc.setLastError(0,
                    "Could not determine NodeJS version: %s. " % installDir)
                return 0
            else:
                if (invocationutils.split_short_ver(version, intify=True)
                    < invocationutils.split_short_ver(minVersion, intify=True)):
                    log.info("%s: %s < %s", installDir, version, minVersion)
                    self._lastErrorSvc.setLastError(0,
                        "Insufficient NodeJS version (\"%s\" is version %s). "\
                        "Require at least version %s."\
                        % (installDir, version, minVersion))
                    return 0
                else:
                    log.info("%s: %s >= %s", installDir, version, minVersion)
        return 1

    def _haveSufficientNodeJS(self, stopOnFirst=1, minVersion=None):
        """Return true iff a NodeJS installation meeting the above conditions
        can be found.
            "stopOnFirst" is a boolean indicating if the search should stop
                on the "first" found interpreter. This is because things like
                debugging and syntax checking are just going to use this
                one anyway. Default is true.

        If false is returned, then the last error (see koILastErrorService)
        is set with a reason why.
        """
        # Try the user's selected nodejs interpreter.
        nodejsDefaultInterp = self._prefs.getStringPref("nodejsDefaultInterpreter")
        if nodejsDefaultInterp:
            log.debug("nodejsDefaultInterp")
            self._nodejsInfoEx.installationPath =\
                self._nodejsInfoEx.getInstallationPathFromBinary(nodejsDefaultInterp)
            log.debug("self._nodejsInfoEx.installationPath=%r",
                      self._nodejsInfoEx.installationPath)
            if self._isSufficientNodeJS(self._nodejsInfoEx, minVersion):
                log.debug("self._isSufficientNodeJS: 1")
                return 1
            elif stopOnFirst:
                log.debug("self._isSufficientNodeJS: 0, stopOnFirst")
                return 0
            else:
                log.debug("self._isSufficientNodeJS: 0")
        else:
            log.debug("no nodejsDefaultInterp")
            
        # Look on PATH.
        if sys.platform.startswith('win'):
            exts = ['.exe']
        else:
            exts = None
        nodejses = which.whichall('node', exts=exts, path=self._userPath)
        log.debug("no nodejsDefaultInterp")
        for nodejs in nodejses:
            self._nodejsInfoEx.installationPath =\
                self._nodejsInfoEx.getInstallationPathFromBinary(nodejs)
            log.debug("self._nodejsInfoEx.installationPath=%r",
                      self._nodejsInfoEx.installationPath)
            if self._isSufficientNodeJS(self._nodejsInfoEx, minVersion):
                return 1
            elif stopOnFirst:
                return 0
        
        errmsg = "Could not find a suitable NodeJS installation."
        self._lastErrorSvc.setLastError(0, errmsg)
        return 0

    def _isSufficientPHP(self, phpInfoEx, feature="Debugging",
                         minVersion=None):
        """Return true iff the given php installation meets the given
        criteria.
            "phpInfoEx" is a koPHPInfoEx instance loaded with the
                php installation to check.

        If false is returned, then the last error (see koILastErrorService)
        is set with a reason why.
        """
        installDir = phpInfoEx.installationPath
        exePath = phpInfoEx.executablePath
        log.info("%s: is sufficient php?", installDir)
        
        if not exePath or not os.path.exists(exePath):
            log.info("%s: does not exist", exePath)
            self._lastErrorSvc.setLastError(0,
                "PHP installation does not exist: \"%s\"" % exePath)
            return 0
        else:
            log.info("%s: exists", exePath)

        if minVersion is not None:
            version = phpInfoEx.version
            if version < minVersion:
                log.info("%s: %s < %s", installDir, version, minVersion)
                self._lastErrorSvc.setLastError(0,
                    "Insufficient PHP version (\"%s\" is version %s). "\
                    "Require at least version %s."\
                    % (installDir, version, minVersion))
                return 0
            else:
                log.info("%s: %s >= %s", installDir, version, minVersion)
        
        if feature == "Debugging":
# #if WITH_DEBUGGING
            try:
                phpInfoEx.autoConfigureDebugger()
            except Exception, e:
                log.exception(e)
            if not phpInfoEx.isDebuggerExtensionLoadable or not phpInfoEx.valid_version:
                log.info("%s: debugger extension is NOT loadable", installDir)
                self._lastErrorSvc.setLastError(0,
                    "ActiveState's PHP debugger extension is not loadable.")
                return 0
            else:
                log.info("%s: debugger extension IS loadable", installDir)
# #else
            self._lastErrorSvc.setLastError(0,
                "Debugging is not available.")
            return 0
# #endif
        return 1

    def _haveSufficientPHP(self, stopOnFirst=1, feature="Debugging",
                           minVersion=None):
        """Return true iff a PHP installation meeting the above conditions
        can be found.
            "stopOnFirst" is a boolean indicating if the search should stop
                on the "first" found interpreter. This is because things like
                debugging and syntax checking are just going to use this
                one anyway. Default is true.
            "feature" is either "Debugging" (default) or "Syntax Checking".
                This is necessary because syntax checking has slightly
                different requirements.

        If false is returned, then the last error (see koILastErrorService)
        is set with a reason why.
        """
        # Try the user's selected php interpreter.
        phpDefaultInterp = self._prefs.getStringPref("phpDefaultInterpreter")
        if phpDefaultInterp:
            self._phpInfoEx.installationPath =\
                self._phpInfoEx.getInstallationPathFromBinary(phpDefaultInterp)
            if self._isSufficientPHP(self._phpInfoEx, feature,
                                     minVersion):
                return 1
            elif stopOnFirst:
                return 0
            
        # Look on PATH.
        if sys.platform.startswith('win'):
            exts = ['.exe']
        else:
            exts = None
        phps = which.whichall('php', exts=exts, path=self._userPath) + \
               which.whichall('php-cgi', exts=exts, path=self._userPath) + \
               which.whichall('php4', exts=exts, path=self._userPath) + \
               which.whichall('php-cli', exts=exts, path=self._userPath)
        for php in phps:
            self._phpInfoEx.installationPath =\
                self._phpInfoEx.getInstallationPathFromBinary(php)
            if self._isSufficientPHP(self._phpInfoEx, feature,
                                     minVersion):
                return 1
            elif stopOnFirst:
                return 0
        
        errmsg = "Could not find a suitable PHP installation."
        self._lastErrorSvc.setLastError(0, errmsg)
        return 0

    def _getVersionForAppInfo(self, appInfo):
        # We don't care about actual version numbers for these executables,
        # only that we can get the version from them using methods expected
        # by the appropriate appInfo class.
        try:
            if appInfo.executablePath and appInfo.version:
                return 1
        except:
            pass
        return 0

    def _haveSufficientPython(self, stopOnFirst=1, minVersion=None):
        """Return true iff a Python installation meeting the above conditions
        can be found.
            "stopOnFirst" is a boolean indicating if the search should stop
                on the "first" found interpreter. This is because things like
                debugging and syntax checking are just going to use this
                one anyway. Default is true.

        If false is returned, then the last error (see koILastErrorService)
        is set with a reason why.
        """
        # Try the user's selected python interpreter.
        if self._getVersionForAppInfo(self._pythonInfoEx):
            return 1
        errmsg = "Could not find a suitable Python installation."
        self._lastErrorSvc.setLastError(0, errmsg)
        return 0

    def _haveSufficientPython3(self, stopOnFirst=1, minVersion=None):
        """Return true iff a Python3 installation meeting the above conditions
        can be found.

        If false is returned, then the last error (see koILastErrorService)
        is set with a reason why.
        """
        # Try the user's selected python3 interpreter.
        if self._getVersionForAppInfo(self._python3InfoEx):
            return 1
        errmsg = "Could not find a suitable Python3 installation."
        self._lastErrorSvc.setLastError(0, errmsg)
        return 0

    def _isSufficientRuby(self, rubyInfoEx, minVersion=None):
        """Return true iff the given ruby installation meets the given
        criteria.
            "rubyInfoEx" is a koRubyInfoEx instance loaded with the
                ruby installation to check.

        If false is returned, then the last error (see koILastErrorService)
        is set with a reason why.
        """
        installDir = rubyInfoEx.installationPath
        exePath = rubyInfoEx.executablePath
        log.info("%s: is sufficient ruby?", installDir)
        
        if not exePath or not os.path.exists(exePath):
            log.info("%s: does not exist", exePath)
            self._lastErrorSvc.setLastError(0,
                "Ruby installation does not exist: \"%s\"" % exePath)
            return 0
        else:
            log.info("%s: exists", exePath)

        if minVersion is not None:
            version = rubyInfoEx.version
            try:
                # At some point Ruby started using a "p" to separate subversion
                # from patch value, instead of a "."
                versionToCompare = map(int,
                                       re.sub("p.*$", "", version).split('.'))
                minVersionToCompare = map(int, minVersion.split('.'))
            except ValueError:
                log.warn("couldn't process Ruby version as expected for "
                         "comparison: version check may be inaccurate: "
                         "version=%r, minVersion=%r", version, minVersion)
                versionToCompare = version
                minVersionToCompare = minVersion
            if versionToCompare < minVersionToCompare:
                log.info("%s: %s < %s", exePath, version, minVersion)
                self._lastErrorSvc.setLastError(0,
                    "Insufficient Ruby version: require version >=%s, "
                    "'%s' is %s" % (minVersion, exePath, version))
                return 0
            else:
                log.info("%s: %s >= %s", installDir, version, minVersion)
        
        return 1

    def _haveSufficientRuby(self, stopOnFirst=1, minVersion=None):
        """Return true iff a Ruby installation meeting the above conditions
        can be found.
            "stopOnFirst" is a boolean indicating if the search should stop
                on the "first" found interpreter. This is because things like
                debugging and syntax checking are just going to use this
                one anyway. Default is true.

        If false is returned, then the last error (see koILastErrorService)
        is set with a reason why.
        """
        # Try the user's selected ruby interpreter.
        rubyDefaultInterp = self._prefs.getStringPref("rubyDefaultInterpreter")
        if rubyDefaultInterp:
            self._rubyInfoEx.installationPath =\
                self._rubyInfoEx.getInstallationPathFromBinary(rubyDefaultInterp)
            if self._isSufficientRuby(self._rubyInfoEx, minVersion):
                return 1
            elif stopOnFirst:
                return 0
            
        # Look on PATH.
        if sys.platform.startswith('win'):
            exts = ['.exe']
        else:
            exts = None
        rubys = which.whichall('ruby', exts=exts, path=self._userPath)
        for ruby in rubys:
            self._rubyInfoEx.installationPath =\
                self._rubyInfoEx.getInstallationPathFromBinary(ruby)
            if self._isSufficientRuby(self._rubyInfoEx, minVersion):
                return 1
            elif stopOnFirst:
                return 0
        
        errmsg = "Could not find a suitable Ruby installation."
        self._lastErrorSvc.setLastError(0, errmsg)
        return 0

    def _isSufficientTcl(self, tclInfoEx):
        """Return true iff the given Tcl installation meets the given
        criteria.
            "tclInfoEx" is a koTclInfoEx instance loaded with the
                Tcl installation to check.

        If false is returned, then the last error (see koILastErrorService)
        is set with a reason why.
        """
        installDir = tclInfoEx.installationPath
        exePath = tclInfoEx.tclsh_path
        log.info("%s: is sufficient tcl?", installDir)
        
        if not exePath:
            log.info("Tcl does not appear to be installed")
            self._lastErrorSvc.setLastError(0,
                "Tcl does not appear to be installed")
            return 0
        if not exePath or not os.path.exists(exePath):
            log.info("%s: does not exist", exePath)
            self._lastErrorSvc.setLastError(0,
                "Tcl installation does not exist: \"%s\"" % exePath)
            return 0
        else:
            log.info("%s: exists", exePath)

        return 1

    def _haveSufficientTcl(self, stopOnFirst=0, requireWish=0):
        """Return true iff a Tcl installation meeting the above
        conditions can be found.
            "stopOnFirst" is a boolean indicating if the search should stop
                on the "first" found interpreter. This is useful if the actual
                systems (i.e. debugging and syntax checking) will just pick the
                first one anyway without checking suitability. Apparently they
                currently *do* check for suitability so this defaults to false.

        If false is returned, then the last error (see koILastErrorService)
        is set with a reason why.
        """
        sufficient = []
        tclshs = []
        if sys.platform.startswith('win'):
            exts = ['.exe']
        else:
            exts = None
        
        # Try the user's selected tclsh interpreter.
        tclshDefaultInterp = self._prefs.getStringPref("tclshDefaultInterpreter")
        if tclshDefaultInterp:
            self._tclInfoEx.installationPath =\
                self._tclInfoEx.getInstallationPathFromBinary(tclshDefaultInterp)
            if self._isSufficientTcl(self._tclInfoEx):
                sufficient.append("tclsh")
            elif stopOnFirst:
                return 0

        # Look on PATH unless already found a sufficient one.
        if "tclsh" not in sufficient:
            tclshs = which.whichall('tclsh', exts=exts, path=self._userPath)
            for tclsh in tclshs:
                installdir = os.path.dirname(os.path.dirname(tclsh))
                self._tclInfoEx.installationPath = installdir
                if self._isSufficientTcl(self._tclInfoEx):
                    sufficient.append("tclsh")
                elif stopOnFirst:
                    return 0
            
        # Try the user's selected tclsh interpreter.
        wishDefaultInterp = self._prefs.getStringPref("wishDefaultInterpreter")
        if wishDefaultInterp:
            self._tclInfoEx.installationPath =\
                self._tclInfoEx.getInstallationPathFromBinary(wishDefaultInterp)
            if self._isSufficientTcl(self._tclInfoEx):
                sufficient.append("wish")
            elif stopOnFirst:
                return 0

        # Look on PATH unless already found a sufficient one.
        if "wish" not in sufficient:
            wishs = which.whichall('wish', exts=exts, path=self._userPath)
            # Must also consider 'wish' executables in the same dir as
            # 'tclsh' executables registered in some way other than the PATH
            # (because that is just the way the Tcl installer is).
            for tclsh in tclshs:
                base, ext = os.path.splitext(tclsh)
                wish = os.path.join(os.path.dirname(base), 'wish') + ext
                if os.path.exists(wish) and wish not in wishs:
                    wishs.insert(0, wish)
            for wish in wishs:
                installdir = os.path.dirname(os.path.dirname(wish))
                self._tclInfoEx.installationPath = installdir
                if self._isSufficientTcl(self._tclInfoEx):
                    sufficient.append("wish")
                elif stopOnFirst:
                    return 0

        haveWish = "wish" in sufficient
        haveTclsh = "tclsh" in sufficient
        if haveTclsh and (haveWish or not requireWish):
            return 1
        else:
            errmsg = "Could not find a suitable Tcl installation."
            self._lastErrorSvc.setLastError(0, errmsg)
            return 0
    
