#!/usr/bin/env python

import os
import sys
import time
import types
import re
import logging
import copy
from urllib import unquote as unescapeURL

from xpcom import components, COMException
from xpcom.server import UnwrapObject

# Pref names each checker should have, will be monitored when the checker
# is first added and gets automatically updated through a pref observer.
monitoredPrefNames = { "enabledPrefName": { 'type': types.BooleanType,
                                            'default': True },
                       "executablePrefName": { 'type': types.StringType,
                                               'default': None },
                       "backgroundEnabledPrefName": { 'type': types.BooleanType,
                                                      'default': True },
                       "backgroundDurationPrefName": { 'type': types.LongType,
                                                       'default': 15 },
                       "recursivePrefName": { 'type': types.BooleanType,
                                              'default': False },
}

class KoFileCheckerBase(object):

    name = 'unknown'
    _com_interfaces_ = [components.interfaces.nsIObserver,
                        components.interfaces.koIFileStatusChecker,
                        components.interfaces.koIPythonMemoryReporter]

    # Save have to look this up all over the status checker code.
    _is_windows = sys.platform.startswith("win")

    def __init__(self, type):
        self.type = type

        # Dictionary of when a URI was last checked.
        # Note: On Windows, the URI must be lowered, because it's a case
        #       insensitive filesystem and we never can be sure which case
        #       styling will be used. You should use the "_norm_uri_cache_key"
        #       method for this (below).
        #       http://bugs.activestate.com/show_bug.cgi?id=74339
        self._lastChecked = {}

        # How prefName and matching attribute values work:
        #  When a checker is initialized, the prefName(s) are checked and the
        #  pref value is stored into the correctponding attribute name. A pref
        #  observer is added on the preference and when/if this preference ever
        #  changes, then the checker's value will be automatically updated.
        # Example for CVS:
        #    backgroundDurationPrefName = "cvsBackgroundMinutes"
        #    backgroundDuration = 10

        self.enabled = True
        self.enabledPrefName = None
        self.backgroundEnabled = False
        self.backgroundEnabledPrefName = None
        # We store the duration in seconds.
        self.backgroundDuration = 15 * 60   # 15 minutes
        self.backgroundDurationPrefName = None
        self.recursive = 0
        self.recursivePrefName = None
        self.executable = None
        self.executablePrefName = None

        self.log = logging.getLogger('Ko%sChecker.%s' % (self.type.capitalize(), self.name))
        self._globalPrefs = components.classes["@activestate.com/koPrefService;1"].\
            getService(components.interfaces.koIPrefService).prefs
        # Global observer service.
        self._observerSvc = components.classes["@mozilla.org/observer-service;1"].\
            getService(components.interfaces.nsIObserverService)

        # Copy across names from the interface in to the local instance.
        self.REASON_BACKGROUND_CHECK = components.interfaces.koIFileStatusChecker.REASON_BACKGROUND_CHECK
        self.REASON_ONFOCUS_CHECK = components.interfaces.koIFileStatusChecker.REASON_ONFOCUS_CHECK
        self.REASON_FILE_CHANGED = components.interfaces.koIFileStatusChecker.REASON_FILE_CHANGED
        self.REASON_FORCED_CHECK = components.interfaces.koIFileStatusChecker.REASON_FORCED_CHECK

    def reportMemory(self, reportHandler, closure):
        self.log.info("reportMemory")

        process = ""
        kind_other = components.interfaces.nsIMemoryReporter.KIND_OTHER
        units_count = components.interfaces.nsIMemoryReporter.UNITS_COUNT

        amount = len(self._lastChecked)
        if amount > 0:
            reportHandler.callback(process,
                                   "komodo scc-%s-checked-directories" % (self.name, ),
                                   kind_other,
                                   units_count,
                                   amount, # amount
                                   "The number of directories this checker was asked to check.", # tooltip description
                                   closure)
        return 0

    ##
    # Helper function to ensure the cache key "uri" is consistently the same,
    # no matter how the platform handles filename case sensitivity or
    # whether the uri has been escaped.
    def _norm_uri_cache_key(self, uri):
        uri = unescapeURL(uri).strip("/")
        if self._is_windows:
            return uri.lower()
        return uri

    ##
    # Helper function to check if the nsIURI object has a UNC path.
    def _is_nsURI_UNC(self, nsUri):
        return (self._is_windows and nsUri.scheme == 'file' and nsUri.host)

    ##
    # Helper function to ensure the cache is completely cleared.
    def _invalidateAllCaches(self):
        self._lastChecked = {}

    #  Interface method
    def initialize(self):
        prefObserverSvc = self._globalPrefs.prefObserverService
        for prefSetting, prefData in monitoredPrefNames.items():
            prefType = prefData['type']
            prefDefault = prefData['default']
            prefName = getattr(self, prefSetting)
            if prefName:
                variableName = prefSetting.replace("PrefName", "")
                # Update from the preference
                if prefType == types.BooleanType:
                    setattr(self, variableName,
                            self._globalPrefs.getBoolean(prefName, prefDefault))
                elif prefType == types.SliceType:
                    setattr(self, variableName,
                            self._globalPrefs.getString(prefName, prefDefault))
                elif prefType == types.LongType:
                    value = self._globalPrefs.getLong(prefName, prefDefault)
                    if variableName == "backgroundDuration":
                        # Convert from minutes to seconds.
                        value *= 60
                    setattr(self, variableName, value)

                # Listen for pref changes
                prefObserverSvc.addObserver(self, prefName, 0)
        # Register for a shutdown notification.
        self._observerSvc.addObserver(self, 'xpcom-shutdown', False)

    def _xpcom_shutdown(self):
        prefObserverSvc = self._globalPrefs.prefObserverService
        for prefSetting in monitoredPrefNames:
            prefName = getattr(self, prefSetting)
            if prefName:
                prefObserverSvc.removeObserver(self, prefName)
        self._observerSvc.removeObserver(self, 'xpcom-shutdown')

    ##
    # nsIObserver interface: listens for preference changes
    # @private
    def observe(self, subject, topic, data):
        self.log.debug("observing event %s:%s" % (topic, data))
        if not topic:
            return

        if topic == 'xpcom-shutdown':
            self._xpcom_shutdown()
        elif topic == self.executablePrefName:
            # data is actually the pref name that was changed.
            executable = self._globalPrefs.getStringPref(topic)
            if executable != self.executable:
                self.setExecutable(executable)
                self._invalidateAllCaches()
                fileStatusSvc = components.classes["@activestate.com/koFileStatusService;1"].\
                                    getService(components.interfaces.koIFileStatusService)
                fileStatusSvc.updateStatusForAllFiles(self.REASON_ONFOCUS_CHECK)
        elif topic == self.enabledPrefName:
            enabled = self._globalPrefs.getBoolean(self.enabledPrefName, True)
            if enabled != self.enabled:
                self.enabled = enabled
                self._invalidateAllCaches()
                fileStatusSvc = components.classes["@activestate.com/koFileStatusService;1"].\
                                    getService(components.interfaces.koIFileStatusService)
                fileStatusSvc.updateStatusForAllFiles(self.REASON_ONFOCUS_CHECK)
        elif topic == self.backgroundEnabledPrefName:
            backgroundEnabled = self._globalPrefs.getBoolean(topic, True)
            if backgroundEnabled != self.backgroundEnabled:
                self.backgroundEnabled = backgroundEnabled
        elif topic == self.backgroundDurationPrefName:
            backgroundDuration = self._globalPrefs.getLong(topic, 15) * 60
            if backgroundDuration != self.backgroundDuration:
                self.backgroundDuration = backgroundDuration
        elif topic == self.recursivePrefName:
            self.recursive =  self._globalPrefs.getBoolean(topic, False)

    #  Interface method
    def shutdown(self):
        # Remove pref listeners
        prefObserverSvc = self._globalPrefs.prefObserverService
        for prefSetting in monitoredPrefNames:
            prefName = getattr(self, prefSetting)
            if prefName:
                try:
                    prefObserverSvc.removeObserver(self, prefName, 0)
                except:
                    # prefs shutdown already?
                    self.log.debug("Unable to remove prefs observers")

    #  Interface method
    def isActive(self):
        return self.enabled

    #  Interface method
    def isBackgroundCheckingEnabled(self):
        return False

    #  Interface method
    def needsToReCheckFileStatus(self, koIFile, reason):
        return True

    #  Interface method
    def updateFileStatus(self, koIFile, reason):
        return None

    def setExecutable(self, executable):
        self.executable = executable

class KoDiskFileChecker(KoFileCheckerBase):

    name = 'disk'
    _reg_clsid_ = "{4871ae1f-edb2-4e2b-b35f-85109aea68ef}"
    _reg_contractid_ = "@activestate.com/koFileStatusChecker?type=disk;1"
    _reg_desc_ = "Komodo Disk Status Checker"
    #_reg_categories_ = [
    #     ("category-komodo-file-status",      "disk"),
    #     ]

    ranking_weight = 5

    def __init__(self):
        KoFileCheckerBase.__init__(self, 'disk')
        self.enabledPrefName = 'diskStatusEnabled'
        self.backgroundEnabledPrefName = 'diskBackgroundCheck'
        self.backgroundDurationPrefName = 'diskBackgroundMinutes'

    def isBackgroundCheckingEnabled(self):
        return True

    def updateFileStatus(self, koIFile, reason):
        if koIFile.isLocal and not koIFile.isNetworkFile:
            time_now = time.time()
            cache_key = self._norm_uri_cache_key(koIFile.URI)
            if reason == self.REASON_BACKGROUND_CHECK and \
               (self._lastChecked.get(cache_key, 0) >=
                (time_now - self.backgroundDuration)):
                return 0
            self._lastChecked[cache_key] = time_now
            return koIFile.updateStats()
        elif reason == self.REASON_FORCED_CHECK:
            # Forced, updateStats() will cause a refresh from the remote server.
            return koIFile.updateStats()
        return 0

# #if WITH_SCC
class KoSCCChecker(KoFileCheckerBase):

    # This is the dictionary structure for "koIFileEx.scc", it should be kept
    # in sync with what URIlib::set_scc and URIlib::clearscc do.
    baseFileSCCInfo = {
        'sccType':'',
        'sccDirType': '',
        'sccExclude':0,
        'sccHaveOnDisk':0,   # deprecated since Komodo 8.1
        'sccLocalRevision':'',
        'sccRevDate':'',
        'sccDepotRevision':'',
        'sccNeedSync':0,
        'sccSync':0,
        'sccOk':0,
        'sccConflict':0,
        'sccAction':'',
        'sccStatus':'',
        'sccChange':''
    }

    def __init__(self):
        KoFileCheckerBase.__init__(self, 'scc')
        #self.log.setLevel(logging.DEBUG)

        # Dictionary of cached scc information for a given URI.
        # Note: On Windows, the URI must be lowered, because it's a case
        #       insensitive filesystem and we never can be sure which case
        #       styling will be used.
        #       http://bugs.activestate.com/show_bug.cgi?id=74339
        self._cached_info = {}
        # A map of known repo directories for a given path - used for SCC types
        # that use one repository directory per checkout (i.e. git, hg, ...)
        self._cached_repodir_from_path = {}

        # Error details.
        self.error = None
        self.last_error_msg = None
        # Special marker for remote scc.
        self._sccRemote = 0
        # Prefs used for checking customizable settings
        self.executablePrefName = ''
        self.enabledPrefName = ''
        self.backgroundEnabledPrefName = ''
        self.backgroundDurationPrefName = ''
        self.recursivePrefName = ''
        self.svc = components.classes["@activestate.com/koSCC?type=%s;1" % (self.name)].\
            getService(components.interfaces.koISCC)
        self.iosvc = components.classes["@mozilla.org/network/io-service;1"].\
            getService(components.interfaces.nsIIOService)

    def initialize(self):
        KoFileCheckerBase.initialize(self)
        # Executable is better coming from the service, as it knows better.
        self.setExecutable(self.svc.executable)

    # How a SCC status checker works:
    #
    # There are two main dictionaries used for scc status checking.
    #   1) "_lastChecked" dict - contains the timestamp when a directory
    #                            "dirURI" was last checked for scc status.
    #   2) "_cached_info" dict - contains dictionaries with the cached scc
    #                            information per directory. Holds the
    #                            info necessary for "koIFile.scc"
    #
    # Updating the SCC status:
    #   Given a file URI "uri", we obtain the directory for this file "dirURI".
    #   Store all retrieved scc information for "dirURI" in dictionary "dict",
    #   this "dict" will be added into "_cached_info" using the key "dirURI". If
    #   "uri" is a directory already, then "dirUri" is the same as "uri" and the
    #   scc information is still stored into the "dict" under the "uri" key.
    #
    # Invaliding the SCC status:
    #   If the scc status is out of date (due to forced refresh, on focus,
    #   expired, etc...), then "dirUri" is dropped from the "_cached_info" dict.
    #   The "_lastChecked" dict is used to check if the currently cached
    #   information has expired.
    #
    # Determing if SCC status has changed:
    #   The "koIFile.scc" is compared against the known scc info from the
    #   "_cached_info" folder, if this information is diffent then "koIFile.scc"
    #   is updated with the latest information and then koIFileStatusService
    #   will subsequently send a notification that the file has changed.
    #
    
    def sccInfoDiffers(self, oldscc, koSccInfo):
        return  oldscc["sccStatus"] != koSccInfo["sccStatus"] or \
                oldscc["sccNeedSync"] != koSccInfo["sccNeedSync"] or \
                oldscc["sccAction"] != koSccInfo["sccAction"] or \
                oldscc["sccType"] != koSccInfo["sccType"] or \
                oldscc["sccDirType"] != koSccInfo["sccDirType"]

    def reportMemory(self, reportHandler, closure):
        if not self.isActive():
            return 0
        total = KoFileCheckerBase.reportMemory(self, reportHandler, closure)

        process = ""
        kind_other = components.interfaces.nsIMemoryReporter.KIND_OTHER
        units_count = components.interfaces.nsIMemoryReporter.UNITS_COUNT

        amount = sum(len(x) for x in self._cached_info.values())
        if amount > 0:
            reportHandler.callback(process,
                                   "komodo scc-%s-known-files" % (self.name, ),
                                   kind_other,
                                   units_count,
                                   amount, # amount
                                   "The number of files this checker has information on.", # tooltip description
                                   closure)

            import memutils
            amount = memutils.memusage(self._cached_info)
            amount += memutils.memusage(self._lastChecked)
            reportHandler.callback(process,
                                   "explicit/python/scc/%s/known-files" % (self.name,),
                                   components.interfaces.nsIMemoryReporter.KIND_HEAP,
                                   components.interfaces.nsIMemoryReporter.UNITS_BYTES,
                                   amount,
                                   "The number of bytes %s is holding for file status." % (self.name,),
                                   closure)
            total += amount
        return total

    ##
    # Helper function to ensure the cache is completely cleared.
    def _invalidateAllCaches(self):
        KoFileCheckerBase._invalidateAllCaches(self)
        self._cached_info = {}
        self._cached_repodir_from_path = {}

    # Same as base class
    #def setExecutable(self, executable):
    #    self.executable = executable

    ##
    # Notify an error has occured. The error and detail will be displayed in
    # the generic notifications panel.
    # @private
    # @param error {string} The error that occured.
    # @param detail {string} Additional information about the error.
    @components.ProxyToMainThread
    def notifyError(self, error, detail=''):
        koINotificationManager = components.interfaces.koINotificationManager
        notifMgr = components.classes["@activestate.com/koNotification/manager;1"]\
                             .getService(koINotificationManager)
        notif = notifMgr.createNotification("scc-error-" + error,
                                            ["scc"],
                                            None,
                                            koINotificationManager.TYPE_STATUS |
                                              koINotificationManager.TYPE_TEXT)
        notif.queryInterface(components.interfaces.koIStatusMessage)
        notif.queryInterface(components.interfaces.koINotificationText)
        notif.category = "scc_error_message"
        notif.msg = unicode(error)
        notif.timeout = 5000
        notif.highlight = True
        notif.details = unicode(detail)
        notif.log = True
        notif.severity = components.interfaces.koINotification.SEVERITY_ERROR
        self.error = notif

    def clearErrors(self):
        self.error = None

    def setExecutable(self, executable):
        KoFileCheckerBase.setExecutable(self, executable or self.svc.executable)

    # Overriding parent isActive
    def isActive(self):
        return self.enabled and self.svc.isFunctional

    # Overriding parent isBackgroundCheckingEnabled
    def isBackgroundCheckingEnabled(self):
        return True

    def isSupportedFile(self, koIFile):
        return koIFile.isLocal and (koIFile.isFile or koIFile.isDirectory)

    # Remove any known SCC information for this path if:
    #  1) it's time to re-check this because of age
    #  2) the provided reason indicates we need fresh information
    # Returns true if the path was invalidated and thus should be checked
    #   koIFile - unwrapped koIFile XPCOM object
    # Note: On Windows, all path names must be lowered, because it's a case
    #       insensitive filesystem and we never can be sure which case styling
    #       will be used.
    def needsToReCheckFileStatus(self, koIFile, reason):
        # XXX - Need better test for this
        #if isinstance(koIFile, components.interfaces.koIFile):
        koIFile = UnwrapObject(koIFile)

        if not self.isSupportedFile(koIFile):
            return 0

        # If this file is already marked with a scc type,
        # we only need to re-check with the same checker.
        if koIFile.sccType and self.name != koIFile.sccType:
            self.log.debug("Checker already set to another: %r",
                           koIFile.sccType)
            return 0
        elif koIFile.sccDirType and self.name != koIFile.sccDirType:
            self.log.debug("Checker dir already set to another: %r",
                           koIFile.sccDirType)
            return 0

        uri_cache_key = self._norm_uri_cache_key(koIFile.URI)
        self.log.debug("needsToReCheckFileStatus (reason=%r) uri: %r",
                       reason, uri_cache_key)

        if reason in (self.REASON_ONFOCUS_CHECK,
                      self.REASON_FORCED_CHECK,
                      self.REASON_FILE_CHANGED):
            force = True
        else:
            force = False

        diruri_cache_key = uri_cache_key
        if koIFile.isFile:
            diruri_cache_key = os.path.dirname(uri_cache_key)
        dirLastChecked = self._lastChecked.get(diruri_cache_key)
        if dirLastChecked is not None:
            previousCheck = time.time() - self.backgroundDuration
            if force or dirLastChecked < previousCheck:
                self.log.debug("removing cached info for dir: %r",
                               diruri_cache_key)
                # Remove the cache information, it's no longer valid
                self._lastChecked.pop(diruri_cache_key, None)
                self._cached_info.pop(diruri_cache_key, None)
                return 1
            else:
                dircache = self._cached_info.get(diruri_cache_key)
                if dircache is None:
                    # Directory has not been checked - needs updating.
                    return 1
                elif dircache.get(uri_cache_key) != koIFile.scc:
                    # It's scc status has changed.
                    return 1
            self.log.debug("cached has not yet expired")
            return 0
        else:
            self.log.debug("no cached info found")
        return 1

    # Check the SCC status for the given file
    # Returns true if the path was under scc and was successfully updated
    #   koIFile   - unwrapped koIFile XPCOM object
    #   reason    - why the check is being made on this file.
    # Note: SCC subclasses must implement updateSCCInfo() in order
    #       to update their known scc information.
    def updateFileStatus(self, koIFile, reason):
        # XXX - Need better test for this
        #if isinstance(koIFile, components.interfaces.koIFile):
        koIFile = UnwrapObject(koIFile)

        oldscc = copy.deepcopy(koIFile.scc)
        if not self.isActive():
            # Empty the koISCC fields and return.
            koIFile.scc = {}
            return koIFile.scc != oldscc

        uri = koIFile.URI
        uri_cache_key = self._norm_uri_cache_key(uri)

        # The nsUri (and dir_nsUri) for a directory should always have a
        # spec/path that ends with a slash "/" - otherwise the .resolve() method
        # will fail to resolve to the correct directory.
        #
        # Komodo's never uses a trailing "/" for directories - so we must be
        # careful when mixing these two cases and ensure we are maintaining
        # these rules.

        nsUri = self.iosvc.newURI(uri + "/" if koIFile.isDirectory else uri, None, None)
        self.log.debug("Checking %r", uri)

        # If it's a file, get the parent directory, we'll use that mostly
        if not koIFile.isDirectory:
            dir_nsUri = self.iosvc.newURI("./",
                                          nsUri.originCharset,
                                          nsUri)
            dir_uri = dir_nsUri.spec.rstrip("/")
        else:
            dir_nsUri = nsUri
            dir_uri = uri

        # If we've already checked this path, then we don't need to do
        # it again
        diruri_cache_key = self._norm_uri_cache_key(dir_uri)
        isUpToDate = self._lastChecked.get(diruri_cache_key, 0) # Invalidated in needsToRecheckFileStatus
        if isUpToDate:
            dircache = self._cached_info.get(diruri_cache_key)
            if dircache is None:
                # Recreate the directory cache.
                dircache = {}
                self._cached_info[diruri_cache_key] = dircache
            if uri_cache_key not in dircache:
                self.log.debug("Already checked uri: not under SCC (%r)", uri_cache_key)
                return 0
            # Else, we know this directory "dir_uri" is under SCC, set the
            # file scc information from the cache then.
            koSccInfo = dircache.get(uri_cache_key)
            if not koSccInfo:
                self.log.debug("File not under SCC, but can be added.")
                # Reset scc info and then update the "sccDirType" attribute.
                koSccInfo = self.baseFileSCCInfo.copy()
                koSccInfo['sccDirType'] = self.name
                dircache[uri_cache_key] = koSccInfo
            else:
                self.log.debug("File is under SCC (cached)")

            sccInfoHasChanged = self.sccInfoDiffers(oldscc, koSccInfo)
            if sccInfoHasChanged:
                koIFile.scc = koSccInfo
            self.log.debug("Has changed status: %r", sccInfoHasChanged)

            return sccInfoHasChanged

        # We're checking this path now, so update the checked time
        now = time.time()
        self._lastChecked[diruri_cache_key] = now
        koSccInfo = None
        dircache = {}

        self.log.debug("No cached info, running scc update now")
        if not self.updateSCCInfo(dircache, dir_nsUri, reason):
            # Failed to update SCC information
            sccInfoHasChanged = oldscc.get('sccType') == self.name
            self.log.debug("No scc information found, has it changed: %r",
                           sccInfoHasChanged)
            if sccInfoHasChanged:
                # Reset the scc information - it's no longer under scc.
                koIFile.scc = self.baseFileSCCInfo.copy()
            return sccInfoHasChanged

        # The cache may contain information for multiple directories 
        # where it gets info for the whole repository at once); split it out
        # TODO: This needs to disappear. Only SVN seems to depend on this horrible
        # redundancy
        cache = {} # directory -> { path: scc_info }
        for dirpath, scc_info_from_path in dircache.items():
            dirpath = dirpath.rstrip("/")
            directory = dirpath.rsplit("/", 1)[0]
            if not directory in cache:
                cache[directory] = self._cached_info.get(dirpath, {}) # Parent
            cache[directory][dirpath] = scc_info_from_path
            
        if diruri_cache_key in dircache and diruri_cache_key not in cache:
            cache[diruri_cache_key] = dircache.get(diruri_cache_key, {})
            
        # update the cache
        for directory, dircache in cache.items():
            # key is already normalized
            self._cached_info[directory] = dircache
            # update the time too
            self._lastChecked[directory] = now
            # This ensures that the directory itself is marked as a SCC folder
            dir_sccinfo = None
            # The parent directory may already hold information for this
            # directory (e.g. svn) - so re-use that if it's already there, as it
            # contains more accurate details (like the revision number).
            parent_directory = directory.rsplit("/", 1)[0]
            parent_sccinfo = cache.get(parent_directory)
            if parent_sccinfo:
                dir_sccinfo = parent_sccinfo.get(directory)
            if dir_sccinfo is None:
                dir_sccinfo = self.baseFileSCCInfo.copy()
            dir_sccinfo['sccType'] = self.name
            dir_sccinfo['sccDirType'] = self.name
            dircache[directory] = dir_sccinfo
        dircache = self._cached_info.get(diruri_cache_key)
        if not dircache:
            # SCC didn't return anything about the directory we asked for
            sccInfoHasChanged = oldscc.get('sccType') == self.name
            self.log.debug("SCC returned no results, has it changed: %r",
                           sccInfoHasChanged)
            return sccInfoHasChanged

        koSccInfo = dircache.get(uri_cache_key)
        if not koSccInfo:
            # It's in a SCC directory, but it's not added yet
            self.log.debug("File not under SCC, but can be added.")
            # We record the dirType so that it can be added later.
            # Will reset scc and then update this one attribute.
            koSccInfo = self.baseFileSCCInfo.copy()
            koSccInfo['sccDirType'] = self.name
            dircache[uri_cache_key] = koSccInfo
            koIFile.scc = koSccInfo
            return oldscc != koSccInfo

        # Updated successfully, we place in the updated scc info now
        sccInfoHasChanged = oldscc["sccStatus"] != koSccInfo["sccStatus"] or \
                            oldscc["sccNeedSync"] != koSccInfo["sccNeedSync"] or \
                            oldscc["sccAction"] != koSccInfo["sccAction"] or \
                            oldscc["sccType"] != koSccInfo["sccType"] or \
                            oldscc["sccDirType"] != koSccInfo["sccDirType"]
        if sccInfoHasChanged:
            koIFile.scc = koSccInfo
        self.log.debug("Is under SCC, has it changed: %r", sccInfoHasChanged)
        return sccInfoHasChanged

    # Update the known SCC information for the given path.
    # Virtual method, must be implemented by the inheriting SCC class.
    def updateSCCInfo(self, dircache, dir_nsUri, reason):
        """Update the known SCC information for the given path.
        Virtual method, must be implemented by the inheriting SCC class.
        @param cache {dict} place to cache information; the key should be a
                    normalized cache key (from _norm_uri_cache_key), and the
                    value is the information for that item
        @param dir_nsUri {nsIURI} The directory to examine
        @param reason {int} The reason for the update,
                    one of the koIFileStatusChecker::REASON_* values
        @return True if successful, False on failure
        @see KoSCCChecker::updateFileStatus
        """
        raise NotImplementedError("Function must be implemented by a subclass")

    def printCache(self):
        from pprint import pprint
        print
        print "Last checked:"
        for path, time in self._lastChecked.items():
            print "  %r: %r" % (path, time)
        print
        print "Cache:"
        for path, d in self._cached_info.items():
            print "  %r:" % (path, )
            for childpath, sccdata in d.items():
                print "        %r:" % (childpath, )
                for scckey, sccvalue in sccdata.items():
                    print "            %r: %r" % (scckey, sccvalue)
        print
# #endif
