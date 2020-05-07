#!python
# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""Provide general (read-only) information about a Komodo
build/installation.
"""

# #ifndef PP_VERSION
# #error Cannot build koInfoService.p.py with 'bk build quick'.
# #endif

import sys
import os
import re
import time
import logging
import operator

from xpcom import components, nsError, ServerException, COMException



log = logging.getLogger("koInfoService")



class KoInfoService(object):
    _com_interfaces_ = [components.interfaces.koIInfoService,
                        components.interfaces.nsITimerCallback]
    _reg_clsid_ = "{EB22F329-1D99-427a-B0E1-19DFF13AFBF7}"
    _reg_contractid_ = "@activestate.com/koInfoService;1"
    _reg_desc_ = "Komodo Information Service"

    version = "PP_VERSION"
    buildNumber = "PP_BUILD_NUMBER"
    buildASCTime = "PP_BUILD_ASC_TIME"
    buildPlatform = "PP_BUILD_PLAT"
    #TODO: Drop mozBinDir here, only used as a "stamp" (?) in
    #      koFileLoggingService.py. koIDirs has the authoritative mozBinDir.
    mozBinDir = "PP_MOZ_BIN_DIR"
    buildType = "PP_BUILD_TYPE"
    buildFlavour = "PP_BUILD_FLAV"
    productType = "PP_PROD_TYPE"
    prettyProductType = "PP_PRETTY_PROD_TYPE"

    def __init__(self):
        self.platform = sys.platform
        
        #TODO: Drop all these. They aren't necessary.
        self.isWindows = sys.platform.startswith("win")
        # XXX bug 33823
        # when building with gtk2, platform.py functions fail preventing
        # komodo startup.  os.uname should work fine on *nix platforms.
        if sys.platform.startswith("win"):
            import platform
            self.osSystem = platform.system()
            self.osRelease = platform.release()
            self.osVersion = platform.version()
        else:
            self.osSystem,node,self.osRelease,self.osVersion,machine = os.uname()
        # We are in non-interactive mode if KOMODO_NONINTERACTIVE is set
        # and non-zero.
        KOMODO_NONINTERACTIVE = os.environ.get("KOMODO_NONINTERACTIVE")
        self.nonInteractiveMode = 0
        if KOMODO_NONINTERACTIVE:
            try:
                KOMODO_NONINTERACTIVE = int(KOMODO_NONINTERACTIVE)
            except ValueError:
                pass
            if KOMODO_NONINTERACTIVE:
                self.nonInteractiveMode = 1

        self._usedWindowNums = set()
        self._nextAvailWindowNum = 1

        startupLog = logging.getLogger("Startup")
        oldLevel = startupLog.level
        startupLog.setLevel(logging.INFO)
        try:
            startupLog.info("Welcome to Komodo %s %s build %s "
                     "(platform %s, running on %s %s version %s)",
                     self.prettyProductType, self.version,
                     self.buildNumber, self.buildPlatform,
                     self.osSystem, self.osRelease, self.osVersion)
            startupLog.info("%s built on %s", sys.executable, self.buildASCTime)
        finally:
            startupLog.setLevel(oldLevel)
    
    def nextWindowNum(self):
        loadedWindowNums = []
        prefs = components.classes["@activestate.com/koPrefService;1"].\
                        getService(components.interfaces.koIPrefService).prefs
        if prefs.hasPref("windowWorkspace"):
            windowWorkspacePrefs = prefs.getPref("windowWorkspace")
            # Get only numbered members of the windowWorkspace pref (bug 97717)
            prefIds = [x for x in windowWorkspacePrefs.getPrefIds() if
                       all([y.isdigit() for y in x])]
            for prefId in prefIds:
                try:
                    pref = windowWorkspacePrefs.getPref(prefId)
                    if pref.hasLongPref('windowNum'):
                        try:
                            windowNum = pref.getLongPref('windowNum')
                            loadedWindowNums.append(windowNum)
                        except:
                            log.exception("nextWindowNum: can't get window # for workspace %r",
                                          prefId)
                except:
                    log.exception("nextWindowNum: can't get pref windowWorkspace/%s", prefId)
        retVal = self._nextAvailWindowNum
        if retVal in self._usedWindowNums:
            while True:
                retVal += 1
                if retVal not in self._usedWindowNums:
                    break
                elif retVal not in loadedWindowNums:
                    break
        self._usedWindowNums.add(retVal)
        self._nextAvailWindowNum = retVal + 1
        return retVal
        
    def setUsedWindowNum(self, val):
        if val in self._usedWindowNums:
            raise ServerException(nsError.NS_ERROR_FAILURE,
                                  "setUsedWindowNum: %d already in use" % val)
        self._usedWindowNums.add(val)

if __name__ == "__main__":
    info = components.classes['@activestate.com/koInfoService;1'].\
        getService(components.interfaces.koIInfoService)
    print "platform: %r" % info.platform
    print "osSystem: %r" % info.osSystem
    print "osRelease: %r" % info.osRelease
    print "osVersion: %r" % info.osVersion
    print "version: %r" % info.version
    print "buildNumber: %r" % info.buildNumber
    print "buildASCTime: %r" % info.buildASCTime
    print "buildType: %r" % info.buildType
    print "buildFlavour: %r" % info.buildFlavour
    print "productType: %r" % info.productType
    print "nonInteractiveMode: %r" % info.nonInteractiveMode
