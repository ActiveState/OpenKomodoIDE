#!python
# Copyright (c) 2010 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
import sys
import time
import logging

from xpcom import components
from xpcom.server import UnwrapObject

from fileStatusUtils import KoFileCheckerBase

is_windows = sys.platform.startswith("win")

#---- component implementation

# How the publishing status checker works:
#
# There is one main dictionary used by the publishing status checker.
#   1) "_lastChecked" dict - contains the tuple (timestamp, publishingState) of
#                            a file "Uri", i.e. when it was last checked and
#                            what it's status was back then.
#
# Invaliding the publishing status:
#   When the publishing status is out of date (due to forced refresh, on focus,
#   expired, etc...), then "Uri" is dropped from the "_lastChecked" dict. The
#   publishing status will then be re-updated immediately afterwards (below).
#
# Updating the publishing status:
#   When a koFile needs to update (check) it's publishing status, the checker
#   will find the publishing settings for which "Uri" belongs to (if any). It
#   then obtains the syncInfo for "Uri" from the settings and then compares this
#   info to the koFile attributes, which gives the current publishingState. This
#   publishingState info is stored into the "_lastChecked" dict.
#
# Determing if the publishing status has changed:
#   The "koFile.publishingState" is compared against the publishingState from
#   the "_lastChecked" dict, if this information is diffent then
#   "koFile.publishingState" is updated with the latest information and then the
#   koIFileStatusService will subsequently send a notification that the file has
#   changed.
#

class KoPublishingStatus(KoFileCheckerBase):

    name = "publishing"

    _reg_clsid_ = "{28733150-b465-42f2-ad09-123696403273}"
    _reg_contractid_ = "@activestate.com/koFileStatusChecker?type="+name+";1"
    _reg_desc_ = "Komodo Publishing Status Checker"
    # Used to register with the file status service.
    _reg_categories_ = [
         ("category-komodo-file-status", name),
    ]

    ranking_weight = 20
    _publishingConfigs = None

    SYNC_LOCAL_FILE_IN_SYNC = components.interfaces.koISynchronizationCallback.SYNC_LOCAL_FILE_IN_SYNC
    SYNC_LOCAL_DIR_ADDED = components.interfaces.koISynchronizationCallback.SYNC_LOCAL_DIR_ADDED
    SYNC_LOCAL_FILE_ADDED = components.interfaces.koISynchronizationCallback.SYNC_LOCAL_FILE_ADDED
    SYNC_LOCAL_FILE_MODIFIED = components.interfaces.koISynchronizationCallback.SYNC_LOCAL_FILE_MODIFIED

    def __init__(self):
        KoFileCheckerBase.__init__(self, self.name)
        #self.log.setLevel(logging.DEBUG)

        self.enabledPrefName = 'publishingStatusEnabled'
        self.backgroundEnabledPrefName = 'publishingBackgroundCheck'
        self.backgroundDurationPrefName = 'publishingBackgroundMinutes'

        # Ensure the necessary prefs exist.
        if not self._globalPrefs.hasBooleanPref(self.enabledPrefName):
            # Default is enabled.
            self._globalPrefs.setBooleanPref(self.enabledPrefName, True)
        if not self._globalPrefs.hasBooleanPref(self.backgroundEnabledPrefName):
            # Default background status checking enabled.
            self._globalPrefs.setBooleanPref(self.backgroundEnabledPrefName, True)
        if not self._globalPrefs.hasLongPref(self.backgroundDurationPrefName):
            # Default is to re-check every 1 minute.
            self._globalPrefs.setLongPref(self.backgroundDurationPrefName, 1)

        # Publihsing configuration for a given uri.
        self._settings_from_uri = {}

        # Listen for publishing config changes.
        self._observerSvc.addObserver(self, 'publishing_configurations_changed', False)

    ##
    # Helper function to ensure the cache is completely cleared.
    def _invalidateAllCaches(self):
        KoFileCheckerBase._invalidateAllCaches(self)
        self._publishingConfigs = None
        self._settings_from_uri = {}

    ##
    # Check if background checking is enabled.
    #
    # @return boolean - True when it is enabled.
    #
    def isBackgroundCheckingEnabled(self):
        return self.enabled

    @property
    def publishingConfigs(self):
        if self._publishingConfigs is None:
            publishingSvc = components.classes["@activestate.com/koPublishingService;1"]. \
                                   getService(components.interfaces.koIPublishingService)
            # Unwrap the configs.
            self._publishingConfigs = map(UnwrapObject, publishingSvc.getPublishingSettings())
        return self._publishingConfigs
        
    def _getPublishingSettingsForUri(self, uri_cache_key):
        configs = self.publishingConfigs
        for config in configs:
            if config.matchesUri(uri_cache_key):
                return config
        return None

    ##
    # Check if this is a supported publishing file.
    #
    # @param koFile {koIFileEx} - an unwrapped koIFileEx XPCOM object
    #
    # @return boolean - True if it's supported by publishing.
    #
    def isSupportedFile(self, koFile, uri_cache_key=None):
        if not koFile.isLocal:
            return False
        if uri_cache_key is None:
            uri_cache_key = self._norm_uri_cache_key(koFile.URI)
        # Check if there is a publishing config that this file belongs to.
        if uri_cache_key not in self._settings_from_uri:
            # Have to check the configurations to see if this file is supported.
            pubSettings = self._getPublishingSettingsForUri(uri_cache_key)
            # Remember if it was supported.
            self._settings_from_uri[uri_cache_key] = pubSettings
            self.log.debug("isSupportedFile:: %r for %r",
                           pubSettings is not None, uri_cache_key)
        else:
            pubSettings = self._settings_from_uri.get(uri_cache_key)
        if pubSettings is None:
            return False
        return True

    ##
    # Remove any known information for this path if:
    #  1) it's time to re-check this because of age
    #  2) the provided reason indicates we need fresh information
    #
    # Note: On Windows, all path names must be lowered, because it's a case
    #       insensitive filesystem and we never can be sure which case styling
    #       will be used.
    #
    # @param koFile {koIFileEx} - an unwrapped koIFileEx XPCOM object
    # @param reason {boolean}   - why the check is being made on this file
    #
    # @return boolean - True if the path was invalidated and needs to be checked
    #
    def needsToReCheckFileStatus(self, koFile, reason):
        #koFile = UnwrapObject(koFile)
        uri_cache_key = self._norm_uri_cache_key(koFile.URI)
        if not self.isSupportedFile(koFile, uri_cache_key):
            return 0

        if reason == self.REASON_BACKGROUND_CHECK:
            lastChecked = self._lastChecked.get(uri_cache_key)
            if lastChecked is not None:
                lastCheckedTime = lastChecked[0]
                if (time.time() - lastCheckedTime) < self.backgroundDuration:
                    self.log.debug("needsToReCheckFileStatus (reason=%r) uri: "
                                   "%r => No, not expired yet",
                                   reason, uri_cache_key)
                    return 0
        self.log.debug("needsToReCheckFileStatus (reason=%r) uri: "
                       "%r => Yes", reason, uri_cache_key)
        return 1

    ##
    # Check the publishing status for the given file.
    # Returns true if the path was under publishing control and was successfully
    # updated (i.e. returns True when the status has changed).
    #
    # @param koFile {koIFileEx} - an unwrapped koIFileEx XPCOM object
    # @param reason {boolean}   - why the check is being made on this file
    #
    # @return boolean - True if the status has changed.
    #
    def updateFileStatus(self, koFile, reason):
        uri_cache_key = self._norm_uri_cache_key(koFile.URI)
        pubSettings = self._settings_from_uri.get(uri_cache_key)
        if pubSettings is None:
            self._lastChecked[uri_cache_key] = (time.time(), None)
            self.log.info("updateFileStatus: no settings found for uri: %r",
                           uri_cache_key)
            return 0

        # Sync data stores using local paths.
        localpath = koFile.path
        if is_windows:
            localpath = localpath.lower()
        localSyncInfo = pubSettings.sync_data['local'].get(localpath)
        newPublishingStatus = 0
        if localSyncInfo is None:
            # Local file has been added.
            self._lastChecked[uri_cache_key] = (time.time(), 1)
            if koFile.isFile:
                newPublishingStatus = self.SYNC_LOCAL_FILE_ADDED
            elif koFile.isDirectory:
                newPublishingStatus = self.SYNC_LOCAL_DIR_ADDED
        elif koFile.isFile:
            try:
                if localSyncInfo.hasChanged(localpath):
                    newPublishingStatus = self.SYNC_LOCAL_FILE_MODIFIED
                else:
                    newPublishingStatus = self.SYNC_LOCAL_FILE_IN_SYNC
            except OSError:
                pass

        self._lastChecked[uri_cache_key] = (time.time(), newPublishingStatus)

        if newPublishingStatus != koFile.publishingStatus:
            self.log.info("updateFileStatus: status changed: added %r",
                          uri_cache_key)
            koFile.publishingStatus = newPublishingStatus
            return 1

        self.log.info("updateFileStatus: status unchanged %r",
                      uri_cache_key)
        return 0

    ##
    # nsIObserver interface: listens for publishing config changes.
    # @private
    def observe(self, subject, topic, data):
        if topic == "publishing_configurations_changed":
            self.log.info("publishing configs have changed")
            self._invalidateAllCaches()
        else:
            # Pass it up to the base class.
            KoFileCheckerBase.observe(self, subject, topic, data)

