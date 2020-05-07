# Copyright (c) 2009-2010 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
import sys
import logging
import cPickle as pickle
from os.path import join, exists, isfile
from hashlib import md5

from xpcom import components
from xpcom.server import WrapObject, UnwrapObject

import mozutils
from fileutils import should_include_path
from pref_serialization import PreferenceSerializer

log = logging.getLogger('koPublishingSettings')
#log.setLevel(logging.DEBUG)

is_windows = sys.platform.startswith("win")


class LocalSyncInfo(object):
    def __init__(self, stat, md5hash=None):
        self.ino = stat.st_ino
        self.mode = stat.st_mode
        self.mtime = stat.st_mtime
        self.size = stat.st_size
        self.md5hash = md5hash
        # Required?
        #self.uid = stat.st_uid
        #self.gid = stat.st_gid

    def __repr__(self):
        return "mode: %r, size: %r, mtime: %r, ino: %r, md5: %r" % (
                    self.mode, self.size, self.mtime, self.ino, self.md5hash)

    def hasChanged(self, localpath, stat=None):
        if stat is None:
            stat = os.stat(localpath)
        changed = (self.ino != stat.st_ino or
                   self.mode != stat.st_mode or
                   self.mtime != stat.st_mtime or
                   self.size != stat.st_size)
        if changed and self.md5hash:
            return self.md5hash != md5(file(localpath, 'rb').read()).hexdigest()
        return changed

class RemoteSyncInfo(object):
    def __init__(self, rf_info):
        rf_info = UnwrapObject(rf_info)
        self.mode = rf_info.get_mode()
        self.mtime = rf_info.get_mtime()
        self.size = rf_info.get_size()
        # Required?
        #self.uid = rf_info.get_uid()
        #self.gid = rf_info.get_gid()

    def __repr__(self):
        return "mode: %r, size: %r, mtime: %r" % (self.mode, self.size, self.mtime)

    def hasChanged(self, rf_info):
        rf_info = UnwrapObject(rf_info)
        return (self.mode != rf_info.get_mode() or
                self.mtime != rf_info.get_mtime() or
                self.size != rf_info.get_size())

class koPublishingSettings(PreferenceSerializer):
    _com_interfaces_ = [components.interfaces.koIPublishingSettings,
                        components.interfaces.koIPreferenceSerializer]
    _reg_desc_ = "Komodo Publishing Settings"
    _reg_contractid_ = "@activestate.com/koPublishingSettings;1"
    _reg_clsid_ = "{42ead6d1-78e0-45b3-a837-49b4f1b62147}"

    # Preference map for PreferenceSerializer.
    pref_serialize_items = [
        ("id",              "string"),
        ("name",            "string"),
        ("local_uri",       "string"),
        ("remote_uri",      "string"),
        ("includes",        "string"),
        ("excludes",        "string"),
        ("autopush_on_save","boolean"),
    ]

    _id = None
    _sync_data = None
    _sync_data_filepath = None

    def __init__(self, name="", local_uri="", remote_uri="", includes="",
                 excludes="", autopush_on_save=False):
        PreferenceSerializer.__init__(self, self.pref_serialize_items, ignore_missing_fields=True)
        self.name = name
        self.local_uri = local_uri
        self.remote_uri = remote_uri
        # TODO: Have our own prefs for these?
        globalPrefs = components.classes["@activestate.com/koPrefService;1"]. \
                            getService(components.interfaces.koIPrefService).prefs
        if not includes:
            includes = globalPrefs.getStringPref("import_include_matches")
        if not excludes:
            excludes = globalPrefs.getStringPref("import_exclude_matches")
        self.includes = includes
        self.excludes = excludes
        self.autopush_on_save = autopush_on_save

    @property
    def id(self):
        # Lazily generate the id as required.
        if self._id is None:
            self._id = mozutils.generateUUID()
        return self._id

    @id.setter
    def id(self, val):
        self._id = val
        # Invalidate the sync data filepath as well.
        self._sync_data_filepath = None

    @property
    def syncDataFilepath(self):
        # Lazily generate the filepath as required.
        if self._sync_data_filepath is None:
            koDirSvc = components.classes["@activestate.com/koDirs;1"].\
                        getService(components.interfaces.koIDirs)
            # All sync data is stored under the Komodo user data dir.
            publishing_data_dir = join(koDirSvc.userDataDir, "publishing")
            if not exists(publishing_data_dir):
                os.mkdir(publishing_data_dir, 0700)
            self._sync_data_filepath = join(publishing_data_dir, self.id)
        return self._sync_data_filepath

    @property
    def sync_data(self):
        # Lazily generate the sync data as required.
        if self._sync_data is None:
            if exists(self.syncDataFilepath):
                try:
                    pickle_file = file(self.syncDataFilepath, "rb")
                except Exception, ex:
                    log.warn("Could not open publishing data file %r. Error: %r",
                             self.syncDataFilepath, str(ex))
                else:
                    try:
                        self._sync_data = pickle.load(pickle_file)
                    except pickle.PickleError:
                        log.warn("Failed to load publishing data for %r. Error: %r",
                                 self.syncDataFilepath, str(ex))
                    finally:
                        pickle_file.close()

            if self._sync_data is None:
                self._sync_data = {
                    # The version will be used to upgrade sync data if the
                    # format changes in the future.
                    #   v1: Initial
                    #   v2: All 'local' LocalSyncInfo objects now have a md5hash
                    #       attribute - the last md5 hash of the file contents.
                    'version': 2,
                    'local': {},
                    'remote': {},
                }
            elif self._sync_data.get('version', 1) == 1:
                # Updgrade to version 2 format.
                newLocal = {}
                fake_stat = os.stat(__file__)
                for localpath, oldLocalSync in self._sync_data.get('local').items():
                    if oldLocalSync is None:
                        newLocal[localpath] = None
                        continue
                    newLocalSync = LocalSyncInfo(fake_stat)
                    # Copy across the old stat values.
                    newLocalSync.ino = oldLocalSync.ino
                    newLocalSync.mode = oldLocalSync.mode
                    newLocalSync.mtime = oldLocalSync.mtime
                    newLocalSync.size = oldLocalSync.size
                    # Try to make the md5 hash now.
                    try:
                        if isfile(localpath) and not newLocalSync.hasChanged(localpath):
                            newLocalSync.md5hash = md5(file(localpath, 'rb').read()).hexdigest()
                    except OSError:
                        pass
                    newLocal[localpath] = newLocalSync
                self._sync_data['local'] = newLocal
                self._sync_data['version'] = 2
                self._store_sync_data()
        return self._sync_data

    @sync_data.setter
    def sync_data(self, val):
        self._sync_data = val
        self._store_sync_data()

    def _store_sync_data(self):
        try:
            pickle_file = file(self.syncDataFilepath, "wb")
        except Exception, ex:
            log.warn("Could not write to publishing data file %r. Error: %r",
                     self.syncDataFilepath, str(ex))
        else:
            try:
                pickle.dump(self.sync_data, pickle_file)
            finally:
                pickle_file.close()

    def _updateSyncDataFromTransferOp(self, transferOp):
        # The download operation stores some private data that we need to get
        # our hands on, so we unwrap the transferOp and grab what we need.
        unwrappedOp = UnwrapObject(transferOp)
        localpaths = unwrappedOp._localpaths
        remotepaths = unwrappedOp._remotepaths
        removed_localpaths = unwrappedOp._removed_localpaths
        removed_remotepaths = unwrappedOp._removed_remotepaths

        # On Windows, which is a case insensitive filesystem, we must lowercase
        # all local paths in order to get an accurate comparison.
        if is_windows:
            localpaths = [x.lower() for x in localpaths]
            removed_localpaths = [x.lower() for x in removed_localpaths]

        localSyncInfos = [x and LocalSyncInfo(x, y) or None for x, y in zip(unwrappedOp._local_stats,
                                                                            unwrappedOp._local_md5hashes)]
        remoteSyncInfos = map(RemoteSyncInfo, unwrappedOp._rf_infos)

        # We have what we need - now update the stored sync data with this new
        # info.
        sync_data = self.sync_data

        local_sync_data = sync_data.get("local")
        new_data = dict(zip(localpaths, localSyncInfos))
        local_sync_data.update(new_data)
        for lpath in removed_localpaths:
            local_sync_data.pop(lpath, None)

        remote_sync_data = sync_data.get("remote")
        new_data = dict(zip(remotepaths, remoteSyncInfos))
        remote_sync_data.update(new_data)
        for rpath in removed_remotepaths:
            remote_sync_data.pop(rpath, None)

        # Save and store the data.
        self.sync_data = sync_data

    def updateDownloadSyncData(self, transferDownloadOp):
        self._updateSyncDataFromTransferOp(transferDownloadOp)

    def updateUploadSyncData(self, transferUploadOp):
        self._updateSyncDataFromTransferOp(transferUploadOp)

    def addLocalSyncData(self, localpath, md5hash):
        stat = os.stat(localpath)
        sync_data = self.sync_data
        local_sync_data = sync_data.get("local")
        local_sync_data[localpath] = LocalSyncInfo(stat, md5hash)

    def addRemoteSyncData(self, remotepath, rf_info):
        sync_data = self.sync_data
        remote_sync_data = sync_data.get("remote")
        remote_sync_data[remotepath] = RemoteSyncInfo(rf_info)

    def saveSyncData(self):
        self._store_sync_data()

    def matchesUri(self, uri):
        # Check against the local_uri and remote_uri# proper URIs for publishing
        orig_uri = uri
        local_uri = self.local_uri
        # https://github.com/Komodo/KomodoEdit/issues/40
        from urllib import unquote
        local_uri = unquote(local_uri)
        uri = unquote(uri)
        if is_windows:
            uri = uri.lower()
            local_uri = local_uri.lower()

        # Check against the local_uri and remote_uri.
        # Appending "/" to local_uri and remote_uri for edgecase in bug #104283
        if uri == local_uri or uri.startswith(local_uri + "/"):
            matched_uri = local_uri
        elif  orig_uri == self.remote_uri or orig_uri.startswith(self.remote_uri + "/"):
            matched_uri = orig_uri
        else:
            # Did not match either uri patterns.
            return False

        # Check against includes/excludes.
        # Note: Includes only work on the basename, whilst exludes work on the
        #       parent directories as well as on the basename.
        includes_list = self.includes and self.includes.split(";") or None
        excludes_list = self.excludes and self.excludes.split(";") or None
        if not includes_list and not excludes_list:
            return True

        rel_uri_path = uri[len(matched_uri):].lstrip("/")
        rel_path_split = rel_uri_path.split("/")
        if len(rel_path_split) > 0:
            if excludes_list:
                # Note: To guarentee that the path will match, we must also make
                #       sure that all of the parent paths match as well!
                for name in rel_path_split[:-1]:
                    if not should_include_path(name, None, excludes_list):
                        # Was filtered out.
                        return False
            basename = rel_path_split[-1]
            if not should_include_path(basename, includes_list, excludes_list):
                # Was filtered out.
                return False
        return True

    def matchingRemoteUriFromLocalUri(self, uri):
        orig_uri = uri
        local_uri = self.local_uri
        if is_windows:
            uri = uri.lower()
            local_uri = local_uri.lower()

        # Check against the local_uri and remote_uri.
        if not uri.startswith(local_uri):
            raise Exception("Given uri %r is outside of base %r" % (uri, local_uri))

        rel_path = orig_uri[len(local_uri):]
        return self.remote_uri + rel_path

    def matchingLocalUriFromRemoteUri(self, uri):
        orig_uri = uri
        remote_uri = self.remote_uri

        # Check against the local_uri and remote_uri.
        if not uri.startswith(remote_uri):
            raise Exception("Given uri %r is outside of base %r" % (uri, remote_uri))

        rel_path = orig_uri[len(remote_uri):]
        return self.local_uri + rel_path
