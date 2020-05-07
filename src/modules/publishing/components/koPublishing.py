# Copyright (c) 2009-2010 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
import sys
import time
import stat
import logging
import threading
import Queue
from hashlib import md5
from os.path import join, exists, isdir, isfile, basename, dirname
from posixpath import join as rjoin

from xpcom import components, nsError, COMException
from xpcom.server import UnwrapObject

import uriparse
import URIlib
from koAsyncOperationUtils import koAsyncOperationBase, koAsyncCallbackWithProgressWrapper
from fileutils import walk_avoiding_cycles, should_include_path

log = logging.getLogger('koPublishing')
#log.setLevel(logging.DEBUG)
#log.setLevel(logging.INFO)

is_windows = sys.platform.startswith("win")


class remoteFileGenerator(threading.Thread):
    def __init__(self, connection, remote_uri, remote_dir, includes, excludes):
        threading.Thread.__init__(self)
        self.setDaemon(True)
        self.connection = connection
        self.remote_uri = remote_uri
        self.remote_dir = remote_dir
        self.includes = includes
        self.excludes = excludes
        self._isrunning = False
        self.queue = Queue.Queue()

    def reconnect(self):
        rfSvc = components.classes["@activestate.com/koRemoteConnectionService;1"].\
                    getService(components.interfaces.koIRemoteConnectionService)
        self.connection = rfSvc.getConnectionUsingUriNoCache(self.remote_uri)

    def _gen_remote_items(self, remote_dir, includes, excludes):
        if not self._isrunning:
            return
        try:
            dir_rfinfo = self.connection.list(remote_dir, 1)  # refresh
        except Exception, ex:
            # Try reconnecting - the connection may have timed out, bug 92563.
            log.info("remoteFileGenerator:: reconnecting")
            self.reconnect()
            dir_rfinfo = self.connection.list(remote_dir, 1)  # refresh
        if dir_rfinfo is None:
            # Path didn't exist.
            return
        dirs = []
        files = []
        for child_rfinfo in dir_rfinfo.getChildren():
            if child_rfinfo.isDirectory():
                dirs.append(child_rfinfo)
            elif child_rfinfo.isFile():
                files.append(child_rfinfo)
        if not self._isrunning:
            return
        if includes or excludes:
            dirs = [rfInfo for rfInfo in dirs if should_include_path(rfInfo.getFilename(),
                                                                     None, excludes,
                                                                     isRemotePath=True)]
            files = [rfInfo for rfInfo in files if should_include_path(rfInfo.getFilename(),
                                                                       includes, excludes,
                                                                       isRemotePath=True)]
        self.queue.put((dir_rfinfo, dirs, files))
        for childEntry in dirs:
            self._gen_remote_items(childEntry.getFilepath(), includes, excludes)

    def run(self):
        try:
            log.info("remoteFileGenerator:: starting")
            self._isrunning = True
            self._gen_remote_items(self.remote_dir, self.includes, self.excludes)
        except Exception, ex:
            self.queue.put(ex)
        finally:
            self._isrunning = False
            log.info("remoteFileGenerator:: finished")
            self.queue.put(None)

    def stop(self):
        log.info("remoteFileGenerator:: stopping")
        self._isrunning = False




class koPublishingOperation(koAsyncOperationBase):
    def __init__(self, publish_settings, callback):
        koAsyncOperationBase.__init__(self, None)
        self.publish_settings = publish_settings
        self.callback = callback
        self._connection = None
        self._aborted = False

    def stop(self):
        log.info("koPublishingOperation:: stopping")
        self._aborted = True

    def setup_connection(self):
        self.callback.onProgress("Initializing the remote connection...", 0)
        rfSvc = components.classes["@activestate.com/koRemoteConnectionService;1"].\
                    getService(components.interfaces.koIRemoteConnectionService)
        try:
            self._connection = rfSvc.getConnectionUsingUri(self.publish_settings.remote_uri)
        except:
            lastErrorSvc = components.classes["@activestate.com/koLastErrorService;1"].getService(components.interfaces.koILastErrorService);
            errmsg = lastErrorSvc.getLastErrorMessage();
            self.callback.onProgress("Connection failed: KoPublishing "+errmsg, 0)
            return
        self.callback.onProgress("Remote connection opened", 0)

    # Private method: called by the koIAsyncService
    def run(self):
        log.info("koPublishingOperation:: starting")
        try:
            return self.func(*self.args, **self.kwargs)
        finally:
            log.info("koPublishingOperation:: finished")


class koPublishingPushOperation(koPublishingOperation):
    def _push_directory(self, local_dir, dir_rfinfo):
        has_changed = False
        local_entries = os.listdir(local_dir)
        remote_dir = dir_rfinfo.getFilepath()
        remote_rf_entries = dir_rfinfo.getChildren()
        remote_entries = {}
        for child_rfinfo in remote_rf_entries:
            remote_entries[child_rfinfo.getFilename()] = child_rfinfo

        base_remote_path = dir_rfinfo.getFilepath()
        base_len = len(base_remote_path)
        for local_filename in local_entries:
            local_path = join(local_dir, local_filename)
            remote_path = rjoin(remote_dir, local_filename)
            child_rfinfo = remote_entries.get(local_filename)
            #print child_rfinfo
            local_stat = os.stat(local_path)
            st_mode = local_stat.st_mode
            if stat.S_ISDIR(st_mode):
                if child_rfinfo is None:
                    # Create the remote directory.
                    #print "  Creating remote directory: %r" % (remote_path)
                    self._connection.createDirectory(remote_path, 0700)
                    has_changed = True
                child_rfinfo = self._connection.list(remote_path, 1)# Refresh
                # XXX: what to do if it exists and is not a directory?
                assert child_rfinfo is not None, "Remote directory does not exist: %r" % (remote_path)
                assert child_rfinfo.isDirectory(), "Remote path already exists, but is not a directory: %r" % (remote_path)
                has_changed |= self._push_directory(local_path, child_rfinfo)
            elif stat.S_ISREG(st_mode): # Regular file.
                local_file_data = file(local_path, "rb").read()
                if not child_rfinfo:
                    #print "  Creating synced file: %r" % (remote_path)
                    self._connection.writeFile(remote_path, local_file_data)
                    file(local_path, "wb").write(local_file_data)
                    has_changed = True
                else:
                    # XXX: what to do if it exists locally, but is not a file?
                    assert child_rfinfo.isFile(), "Remote path already exists, but is not a file: %r" % (remote_path)
                    remote_file_data = self._connection.readFile(remote_path)
                    # Check if the file has changed.
                    if local_file_data != remote_file_data:
                        #print "  Updating synced file: %r" % (remote_path)
                        self._connection.writeFile(remote_path, local_file_data)
                        has_changed = True
        return has_changed

    def push_directory(self, local_dir, remote_dir):
        """Push local directory entries to a remote location"""
        try:
            #print "\n\nChecking for push changes..."
            #print 'local_dir: %r' % (local_dir, )
            #print 'remote_dir: %r' % (remote_dir, )
            if not exists(local_dir):
                raise COMException(nsError.NS_ERROR_INVALID_ARG,
                                   "Local directory does not exist: %r" % (local_dir))
            if not isdir(local_dir):
                raise COMException(nsError.NS_ERROR_INVALID_ARG,
                                   "Local path is not a directory: %r" % (local_dir))

            dir_rfinfo = self._connection.list(remote_dir, 1)# Refresh
            if not dir_rfinfo:
                # Create remote parent directories.
                # XXX: Move this into the koIFTPConnection.makedirs().
                create_paths = [remote_dir]
                parent_path = dirname(remote_dir)
                last_parent_path = None
                while dir_rfinfo is None and parent_path != last_parent_path:
                    #print 'parent_path: %r' % (parent_path, )
                    dir_rfinfo = self._connection.list(parent_path, 1)# Refresh
                    if not dir_rfinfo:
                        create_paths.append(parent_path)
                    last_parent_path = parent_path
                    parent_path = dirname(parent_path)
                for parent_path in create_paths:
                    self._connection.createDirectory(parent_path, 0700)
                dir_rfinfo = self._connection.list(remote_dir, 1)# Refresh
                assert dir_rfinfo, "Remote directory still does not exist: %r" % (remote_dir)
            return self._push_directory(local_dir, dir_rfinfo)
        except:
            import traceback
            traceback.print_exc()
            raise

    def run(self):
        log.debug("setting up connection")
        self.setup_connection()
        if not self._connection:
            return
        try:
            log.debug("pushing directory contents")
            local_path = uriparse.URIToLocalPath(self.publish_settings.local_uri)
            parsedURI = URIlib.URIParser(self.publish_settings.remote_uri)
            self.push_directory(local_path, parsedURI.path)
        finally:
            if self._connection:
                try:
                    self._connection.close()
                except Exception, ex:
                    log.warn("Error closing the connection: %r", ex)


class koPublishingPullOperation(koPublishingOperation):
    # Private method: called by the koIAsyncService
    def run(self):
        pass


class koPublishingSyncOperation(koPublishingOperation):
    def __init__(self, publish_settings, callback):
        koPublishingOperation.__init__(self, publish_settings, callback)
        self._changes = []

    def _get_local_relpaths(self, local_dir, includes, excludes):
        """Returns a dictionary of local file paths.

        Key:   Relative directory path (in unix format, so uses "/" separators)
        Value: A tuple of the contained basenames - (dirs, files).
        """
        sep = os.sep
        l = len(local_dir)
        items = {}
        for root, dirs, files in walk_avoiding_cycles(local_dir,
                                                      followlinks=True,
                                                      includes=includes,
                                                      excludes=excludes):
            if self._aborted:
                raise COMException(nsError.NS_ERROR_ABORT, "Aborted")
            relpath = root[l:].lstrip(sep)
            if is_windows:
                relpath = relpath.replace("\\", "/")
            items[relpath] = (dirs, files)
        return items

    def _gen_remote_relpaths(self, remote_dir, dir_rfinfo, includes, excludes):
        if dir_rfinfo is None:
            return
        # Start the remote file generator thread.
        rfg = remoteFileGenerator(self._connection, self.publish_settings.remote_uri, remote_dir, includes, excludes)
        rfg.start()
        l = len(remote_dir)
        sep = "/"
        while 1:
            try:
                # Try to get an item from the queue, but also keep ensuring the
                # operation hasn't been aborted.
                hit = rfg.queue.get(timeout=2)
            except Queue.Empty:
                continue
            finally:
                if self._aborted:
                    rfg.stop()
                    break
            if hit is None:
                # Generation is finished.
                break
            elif isinstance(hit, Exception):
                # Generated an exception.
                raise hit
            rfInfo, childDirRFInfos, childFileRFInfos = hit
            relpath = rfInfo.getFilepath()[l:].lstrip(sep)
            yield (relpath, rfInfo, childFileRFInfos)

    def gen_changes(self, local_dir, remote_dir, includes, excludes):
        """Check for changes between the local and remote directory.
        
        This function will generate all available local files and directories,
        then generate all available remote files and directories. With these two
        sets of file information, a comparison is made to see if the two file
        sets differ - with any differences being notified back to the callback.
        """

        try:
            log.debug("local_dir: %r", local_dir)
            log.debug("remote_dir: %r", remote_dir)
            log.debug("includes: %r", includes)
            log.debug("excludes: %r", excludes)

            sync_data = UnwrapObject(self.publish_settings).sync_data
            # Get the last known sync information, these are dict's with the
            # key being the full path (not uri).
            localSyncInfo = sync_data.get("local")
            remoteSyncInfo = sync_data.get("remote")

            # Ensure that at least one of the directories exist.
            local_dir_exists = True
            if not exists(local_dir):
                local_dir_exists = False
            elif not isdir(local_dir):
                raise COMException(nsError.NS_ERROR_INVALID_ARG,
                                   "Local path is not a directory: %r" % (local_dir))
            dir_rfinfo = self._connection.list(remote_dir, 1)  # Refresh
            if not dir_rfinfo:
                # The remote directory does not exist.
                if not local_dir_exists:
                    raise COMException(nsError.NS_ERROR_INVALID_ARG,
                                       "The local path and remote path do not exist")

            # Local connection object for diffing the file contents (see below).
            filecheck_connection = None

            # Walk the local directories, building up a list of files. This way
            # we get an idea on the number of files that will be checked,
            # allowing relatively accurate progress notifications.
            local_relpaths = self._get_local_relpaths(local_dir, includes, excludes)

            SYNC_REMOTE_DIR_ADDED = components.interfaces.koISynchronizationCallback.SYNC_REMOTE_DIR_ADDED
            SYNC_REMOTE_DIR_REMOVED = components.interfaces.koISynchronizationCallback.SYNC_REMOTE_DIR_REMOVED
            SYNC_REMOTE_FILE_ADDED = components.interfaces.koISynchronizationCallback.SYNC_REMOTE_FILE_ADDED
            SYNC_REMOTE_FILE_MODIFIED = components.interfaces.koISynchronizationCallback.SYNC_REMOTE_FILE_MODIFIED
            SYNC_REMOTE_FILE_REMOVED = components.interfaces.koISynchronizationCallback.SYNC_REMOTE_FILE_REMOVED
            SYNC_LOCAL_DIR_ADDED = components.interfaces.koISynchronizationCallback.SYNC_LOCAL_DIR_ADDED
            SYNC_LOCAL_DIR_REMOVED = components.interfaces.koISynchronizationCallback.SYNC_LOCAL_DIR_REMOVED
            SYNC_LOCAL_FILE_ADDED = components.interfaces.koISynchronizationCallback.SYNC_LOCAL_FILE_ADDED
            SYNC_LOCAL_FILE_MODIFIED = components.interfaces.koISynchronizationCallback.SYNC_LOCAL_FILE_MODIFIED
            SYNC_LOCAL_FILE_REMOVED = components.interfaces.koISynchronizationCallback.SYNC_LOCAL_FILE_REMOVED
            SYNC_CONFLICT_BOTH_MODIFIED = components.interfaces.koISynchronizationCallback.SYNC_CONFLICT_BOTH_MODIFIED
            SYNC_CONFLICT_REMOVED_REMOTELY_MODIFIED_LOCALLY = components.interfaces.koISynchronizationCallback.SYNC_CONFLICT_REMOVED_REMOTELY_MODIFIED_LOCALLY
            SYNC_CONFLICT_REMOVED_LOCALLY_MODIFIED_REMOTELY = components.interfaces.koISynchronizationCallback.SYNC_CONFLICT_REMOVED_LOCALLY_MODIFIED_REMOTELY

            set_local_dirs = set(local_relpaths.keys())
            # I can't figure out how to get the number of remote files to be checked
            # without looping through all of them first so can't show proper progress.
            # Leaving the code in place just incase someone figures out a way.
            numFilesChecked = 1#float(1)
            # fielsToBeChecked = 0
            # proggressValue = 0
            import random
            for remote_hit in self._gen_remote_relpaths(remote_dir, dir_rfinfo,
                                                        includes, excludes):
                if self._aborted:
                    raise COMException(nsError.NS_ERROR_ABORT, "Aborted")
                # Note: relpath uses "/" for dir separators - unix style.
                relpath, remoteDirRFInfo, remoteRFInfos = remote_hit
                # try:
                #     proggressValue = int((numFilesChecked / filesToCheckLen) * 100)
                # except:
                #     pass
                # self.callback.onProgress("Checking remote "+str(numFilesChecked)+"/"+str(filesToCheckLen)+": '"+relpath+"'", proggressValue)
                # Using random for now makes it look like we're flying through a
                # bunch of files and it's too fast for the status bar to keep up
                self.callback.onProgress("Checked "+str(numFilesChecked)+" remote files: '"+relpath+"'", random.randint(0,100))
                numFilesChecked = numFilesChecked + 1
                local_relpath = relpath
                if is_windows:
                    local_relpath = relpath.replace("/", "\\").lower()
                local_hit = local_relpaths.get(relpath)
                #print 'relpath: %r' % (relpath, )
                #print 'local_relpath: %r' % (local_relpath, )
                #print 'local_relpaths.keys(): %r' % (local_relpaths.keys(), )
                #print
                if local_hit is None:
                    # Remote directory exists, but not locally. Could be one of:
                    #  1) Remote files were added
                    #  2) Local files were deleted
                    change_types = []
                    change_paths = []
                    localpath = join(local_dir, local_relpath)
                    if is_windows:
                        # Must use lower case - to match localSyncInfo.
                        localpath = localpath.lower()
                    if localSyncInfo.get(localpath):
                        # It used to exist, matches 2 - local dir was removed.
                        change_types.append(SYNC_LOCAL_DIR_REMOVED)
                        change_paths.append(relpath)
                        for rf_info in remoteRFInfos:
                            name = rjoin(relpath, basename(rf_info.getFilepath()))
                            change_types.append(SYNC_LOCAL_FILE_REMOVED)
                            change_paths.append(name)
                    else:
                        change_types.append(SYNC_REMOTE_DIR_ADDED)
                        change_paths.append(relpath)
                        for rf_info in remoteRFInfos:
                            name = rjoin(relpath, basename(rf_info.getFilepath()))
                            change_types.append(SYNC_REMOTE_FILE_ADDED)
                            change_paths.append(name)
                    self._batchFoundChanges(change_types, change_paths)
                else:
                    # TODO: Detect directory permission changes.
                    set_local_dirs.remove(relpath)
                    localDirs, localFiles = local_hit
                    #print 'localFiles: %r' % (localFiles, )
                    for rf_info in remoteRFInfos:
                        name = basename(rf_info.getFilepath())
                        localpath = join(local_dir, local_relpath, name)
                        if is_windows:
                            # Must use lower case - to match localSyncInfo.
                            localpath = localpath.lower()
                        if name not in localFiles:
                            # File exists remotely, but not locally. Could be
                            # one of:
                            #  1) Remote file was added
                            #  2) Local file was deleted
                            if localSyncInfo.get(localpath):
                                # Matches 2 - local file was removed.
                                remotepath = rjoin(remote_dir, relpath, name)
                                rsyncInfo = remoteSyncInfo.get(remotepath)
                                if rsyncInfo and rsyncInfo.hasChanged(rf_info):
                                    self._foundChange(SYNC_CONFLICT_REMOVED_LOCALLY_MODIFIED_REMOTELY,
                                                      rjoin(relpath, name))
                                else:
                                    self._foundChange(SYNC_LOCAL_FILE_REMOVED,
                                                      rjoin(relpath, name))
                            else:
                                self._foundChange(SYNC_REMOTE_FILE_ADDED,
                                                  rjoin(relpath, name))
                        else:
                            remotepath = rjoin(remote_dir, relpath, name)
                            lsyncInfo = localSyncInfo.get(localpath)
                            rsyncInfo = remoteSyncInfo.get(remotepath)
                            #print 'localpath: %r' % (localpath, )
                            #print 'remotepath: %r' % (remotepath, )
                            #print 'lsyncInfo: %r' % (lsyncInfo, )
                            #print 'rsyncInfo: %r' % (rsyncInfo, )
                            if lsyncInfo is not None and rsyncInfo is not None:
                                # Compare using the cached sync info.
                                lhasChanged = lsyncInfo.hasChanged(localpath)
                                rhasChanged = rsyncInfo.hasChanged(rf_info)
                                if lhasChanged:
                                    if not rhasChanged:
                                        self._foundChange(SYNC_LOCAL_FILE_MODIFIED,
                                                          rjoin(relpath, name))
                                    else:
                                        # Both have changed - there is a conflict.
                                        self._foundChange(SYNC_CONFLICT_BOTH_MODIFIED,
                                                          rjoin(relpath, name))
                                elif rhasChanged:
                                    self._foundChange(SYNC_REMOTE_FILE_MODIFIED,
                                                      rjoin(relpath, name))
                            else:
                                # Compare using a file diff (more expensive).
                                # See bug 89285 for details on why this is needed.
                                if filecheck_connection is None:
                                    # Must use a separate connection instance, to avoid multi-threaded
                                    # usage (as _gen_remote_relpaths uses a connection as well).
                                    rfSvc = components.classes["@activestate.com/koRemoteConnectionService;1"].\
                                                getService(components.interfaces.koIRemoteConnectionService)
                                    filecheck_connection = rfSvc.getConnectionUsingUriNoCache(self.publish_settings.remote_uri)
                                rdata = filecheck_connection.readFile(remotepath)
                                ldata = file(localpath, "rb").read()
                                if rdata != ldata:
                                    self._foundChange(SYNC_CONFLICT_BOTH_MODIFIED,
                                                      rjoin(relpath, name))
                                else:
                                    # No changes - remember the sync info for next time.
                                    self.publish_settings.addLocalSyncData(localpath, md5(ldata).hexdigest())
                                    self.publish_settings.addRemoteSyncData(remotepath, rf_info)
                            localFiles.remove(name)
                    # Anything left in localFiles does not reside on the remote
                    # server.
                    for name in localFiles:
                        name = rjoin(relpath, name)
                        # File exists locally, but not remotely. Could be
                        # one of:
                        #  1) Local file was added
                        #  2) Remote file was deleted
                        remotepath = rjoin(remote_dir, name)
                        if remoteSyncInfo.get(remotepath):
                            # Matches 2 - remote file was removed.
                            localpath = join(local_dir, name)
                            if is_windows:
                                localpath = localpath.lower()
                            lsyncInfo = localSyncInfo.get(localpath)
                            if lsyncInfo and lsyncInfo.hasChanged(localpath):
                                self._foundChange(SYNC_CONFLICT_REMOVED_REMOTELY_MODIFIED_LOCALLY, name)
                            else:
                                self._foundChange(SYNC_REMOTE_FILE_REMOVED, name)
                        else:
                            self._foundChange(SYNC_LOCAL_FILE_ADDED, name)

            if filecheck_connection is not None:
                # Ensure we save the sync data for any now-in-sync files that
                # were detected (so we don't have to re-do this next time).
                self.publish_settings.saveSyncData()
                try:
                    filecheck_connection.close()
                except Exception, ex:
                    log.warn("Error closing the filecheck connection: %r", ex)
            numFilesChecked = float(1)
            filesToCheckLen = len(set_local_dirs)
            proggressValue = 0
            # Now set_local_dirs only contains the directories that were not
            # found remotely. That means these dirs were either:
            #  1) dir was added locally
            #  2) dir was deleted remotely
            #print 'set_local_dirs: %r' % (set_local_dirs, )
            for relpath in sorted(set_local_dirs):
                try:
                    proggressValue = int((numFilesChecked / filesToCheckLen) * 100)
                except:
                    pass
                self.callback.onProgress("Checking "+str(int(numFilesChecked))+" of "+str(filesToCheckLen)+" local files: '"+relpath, proggressValue)
                numFilesChecked = numFilesChecked + 1
                if self._aborted:
                    raise COMException(nsError.NS_ERROR_ABORT, "Aborted")
                change_types = []
                change_paths = []
                remotepath = rjoin(remote_dir, relpath)
                if remoteSyncInfo.get(remotepath):
                    # Matches 2 - it used to exist - remote dir was removed.
                    change_types.append(SYNC_REMOTE_DIR_REMOVED)
                    change_paths.append(relpath)
                    local_hit = local_relpaths.get(relpath)
                    localDirs, localFiles = local_hit
                    for name in localFiles:
                        change_types.append(SYNC_REMOTE_FILE_REMOVED)
                        change_paths.append(rjoin(relpath, name))
                    # TODO: Detect conflicts - where the matching local files
                    #       were modified as well.
                else:
                    change_types.append(SYNC_LOCAL_DIR_ADDED)
                    change_paths.append(relpath)
                    local_hit = local_relpaths.get(relpath)
                    localDirs, localFiles = local_hit
                    for name in localFiles:
                        change_types.append(SYNC_LOCAL_FILE_ADDED)
                        change_paths.append(rjoin(relpath, name))
                self._batchFoundChanges(change_types, change_paths)
        except Exception, ex:
            if not isinstance(ex, COMException):
                log.exception("koPublishingSyncOperation error")
            raise
        finally:
            if not self._aborted:
                self.callback.onProgress("Status check finished.", 100)

    def _foundChange(self, action, path):
        self._changes.append((action, path))
        if self.callback:
            # The callback is an instance of ProxiedSynchronizationCallback, so
            # we don't need to worry about proxying - the callback instance will
            # handle that for us.
            self.callback.notifySyncItem(action, path)

    def _batchFoundChanges(self, actions, paths):
        self._changes += zip(actions, paths)
        if self.callback:
            # The callback is an instance of ProxiedSynchronizationCallback, so
            # we don't need to worry about proxying - the callback instance will
            # handle that for us.
            self.callback.batchNotifySyncItems(actions, paths)

    def run(self):
        log.info("koPublishingSyncOperation:: starting")
        try:
            log.debug("setting up connection")
            self.setup_connection()
            if not self._connection:
                return
            log.debug("getting synchronize status")
            local_path = uriparse.URIToLocalPath(self.publish_settings.local_uri)
            parsedURI = URIlib.URIParser(self.publish_settings.remote_uri)
            remote_path = parsedURI.path
            local_path = local_path.rstrip(os.sep)
            if len(remote_path) > 1:
                remote_path = remote_path.rstrip("/")
            # Note: Includes and excludes use ";" as the path separator, this
            #       comes from Komodo's directory import preferences.
            includes = None
            if self.publish_settings.includes:
                includes = self.publish_settings.includes.split(";")
            excludes = None
            if self.publish_settings.excludes:
                excludes = self.publish_settings.excludes.split(";")
            self.gen_changes(local_path, remote_path, includes, excludes)
        finally:
            log.info("koPublishingSyncOperation:: finished")
            if self._connection:
                try:
                    self._connection.close()
                except Exception, ex:
                    log.warn("Error closing the sync connection: %r", ex)


class ProxiedSynchronizationCallback(koAsyncCallbackWithProgressWrapper):
    @components.ProxyToMainThread
    def onProgress(self, label, value):
        self.real_callback.onProgress(label, value)

    @components.ProxyToMainThread
    def notifySyncItem(self, syncType, relpath):
        self.real_callback.notifySyncItem(syncType, relpath)

    @components.ProxyToMainThread
    def batchNotifySyncItems(self, syncTypes, relpaths):
        self.real_callback.batchNotifySyncItems(syncTypes, relpaths)

class koFilePushOperation(threading.Thread):
    _com_interfaces_ = [components.interfaces.koIRemoteTransferCallback]
    _reg_desc_ = "Komodo file push handler"
    _reg_contractid_ = "@activestate.com/koFilePushOperation;1"
    _reg_clsid_ = "{443fc04c-5fbf-4fd0-8dcc-9c8c70f9a947}"

    def __init__(self, uri, pubSettings, orig_callback, forcePush = False):
        threading.Thread.__init__(self)
        self.setDaemon(True)
        self.uri = uri
        self.pubSettings = pubSettings
        self.orig_callback = orig_callback
        self.forcePush = forcePush
        self.transfer_op = None
        self.fileSvc = components.classes["@activestate.com/koFileService;1"].\
            getService(components.interfaces.koIFileService);
        self.koFileEx = self.fileSvc.getFileFromURI(self.uri);
        self.observerService = components.classes["@mozilla.org/observer-service;1"].\
            getService(components.interfaces.nsIObserverService)
        self._connection = None
        # Start the thread.
        self.start()

    # koIAsyncCallback
    def callback(self, result, message):
        if result == components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL:
            # Update the sync data stored on the settings object.
            self.pubSettings.updateUploadSyncData(self.transfer_op)
            # Let the file status service know the file has changed.
            fileStatusSvc = components.classes["@activestate.com/koFileStatusService;1"].\
                    getService(components.interfaces.koIFileStatusService)
            fileStatusSvc.updateStatusForUris([self.uri], False)
        self._callback(result, message)

    # This is a thread, callbacks must be proxied back to the main thread.

    @components.ProxyToMainThread
    def _callback(self, result, message):
        if self.orig_callback:
            self.orig_callback.callback(result, message)

    # koIAsyncCallbackWithProgress
    @components.ProxyToMainThread
    def onProgress(self, message, value):
        if self.orig_callback:
            self.orig_callback.onProgress(message, value)

    # koIRemoteTransferCallback
    @components.ProxyToMainThread
    def notifyFileTransferStarting(self, local_uri, remote_uri):
        if self.orig_callback:
            self.orig_callback.notifyFileTransferStarting(local_uri, remote_uri)

    @components.ProxyToMainThread
    def notifyFileTransferCompleted(self, local_uri, remote_uri):
        if self.orig_callback:
            self.orig_callback.notifyFileTransferCompleted(local_uri, remote_uri)

    @components.ProxyToMainThread
    def notifyFileTransferFailed(self, local_uri, remote_uri, message):
        if self.orig_callback:
            self.orig_callback.notifyFileTransferFailed(local_uri, remote_uri, message)

    def setup_connection(self, remote_uri):
        self.onProgress("Initializing the remote connection...", 0)
        try:
            rfSvc = components.classes["@activestate.com/koRemoteConnectionService;1"].\
                    getService(components.interfaces.koIRemoteConnectionService)
            self._connection = rfSvc.getConnectionUsingUri(remote_uri)
        except:
            lastErrorSvc = components.classes["@activestate.com/koLastErrorService;1"].getService(components.interfaces.koILastErrorService);
            errmsg = lastErrorSvc.getLastErrorMessage();
            self.notifyFileTransferFailed(self.uri, remote_uri, errmsg)
            return
        self.onProgress("Remote connection opened", 0)
    
    @components.ProxyToMainThread
    def setFileStatus(self, status):
        # XXX This should be made part of a base class for publishing actions.
        """It appears that setting file status tries to access the main thread
        and breaks things.  Proxy it like anything else that needs the main thread
        from another thread"""
        self.koFileEx.publishingStatus = status
        self.observerService.notifyObservers(None, "file_status", self.koFileEx.URI)

    def run(self):
        # Check if the remote file has changed, if it has there's a conflict.
        pubSettings = self.pubSettings
        remote_uri = pubSettings.matchingRemoteUriFromLocalUri(self.uri)
        self.setup_connection(remote_uri)
        if not self._connection:
            return
        # Don't need to do any checking if we're forcing the push.
        if not self.forcePush:
            remote_path = uriparse.URIToPath(remote_uri)
            remoteSyncInfo = pubSettings.sync_data['remote'].get(remote_path)
            if remoteSyncInfo:
                try:
                    rf_info = self._connection.list(remote_path, 1)  # refresh
                    if rf_info is None:
                        self.setFileStatus(components.interfaces.koISynchronizationCallback.SYNC_CONFLICT_REMOVED_REMOTELY_MODIFIED_LOCALLY)
                        self.callback(components.interfaces.koIAsyncCallback.RESULT_ERROR,
                                      "Conflict: The remote file was deleted")
                        return
                    if remoteSyncInfo.hasChanged(rf_info):
                        # Remote has changed - there's a conflict.
                        self.setFileStatus(components.interfaces.koISynchronizationCallback.SYNC_CONFLICT_BOTH_MODIFIED)
                        self.callback(components.interfaces.koIAsyncCallback.RESULT_ERROR,
                                      "Conflict: The remote file has changed")
                        return
                finally:
                    if self._connection:
                        try:
                            self._connection.close()
                        except Exception, ex:
                            log.warn("Error closing the connection: %r", ex)

        koRemoteTransSvc = components.classes["@activestate.com/koRemoteTransferService;1"]. \
                            getService(components.interfaces.koIRemoteTransferService)
        self.transfer_op = koRemoteTransSvc.upload([self.uri],
                                                   [remote_uri],
                                                   self)
        
class koFilePullOperation(threading.Thread):
    _com_interfaces_ = [components.interfaces.koIRemoteTransferCallback]
    _reg_desc_ = "Komodo file pull handler"
    _reg_contractid_ = "@activestate.com/koFilePullOperation;1"
    _reg_clsid_ = "{57cf865d-0f9f-4aca-aef6-d2825dd2ff39}"

    def __init__(self, uri, pubSettings, orig_callback, force = False):
        threading.Thread.__init__(self)
        self.setDaemon(True)
        self.uri = uri
        self.pubSettings = pubSettings
        self.orig_callback = orig_callback
        self.force = force
        self.transfer_op = None
        self._connection = None
        # Start the thread.
        self.start()

    # koIAsyncCallback
    def callback(self, result, message):
        if result == components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL:
            # Update the sync data stored on the settings object.
            self.pubSettings.updateUploadSyncData(self.transfer_op)
            # Let the file status service know the file has changed.
            fileStatusSvc = components.classes["@activestate.com/koFileStatusService;1"].\
                    getService(components.interfaces.koIFileStatusService)
            fileStatusSvc.updateStatusForUris([self.uri], False)
        self._callback(result, message)

    # This is a thread, callbacks must be proxied back to the main thread.

    @components.ProxyToMainThread
    def _callback(self, result, message):
        if self.orig_callback:
            self.orig_callback.callback(result, message)

    # koIAsyncCallbackWithProgress
    @components.ProxyToMainThread
    def onProgress(self, message, value):
        if self.orig_callback:
            self.orig_callback.onProgress(message, value)

    # koIRemoteTransferCallback
    @components.ProxyToMainThread
    def notifyFileTransferStarting(self, local_uri, remote_uri):
        if self.orig_callback:
            self.orig_callback.notifyFileTransferStarting(local_uri, remote_uri)

    @components.ProxyToMainThread
    def notifyFileTransferCompleted(self, local_uri, remote_uri):
        if self.orig_callback:
            self.orig_callback.notifyFileTransferCompleted(local_uri, remote_uri)

    @components.ProxyToMainThread
    def notifyFileTransferFailed(self, local_uri, remote_uri, message):
        if self.orig_callback:
            self.orig_callback.notifyFileTransferFailed(local_uri, remote_uri, message)

    def setup_connection(self, remote_uri):
        self.onProgress("Initializing the remote connection...", 0)
        try:
            rfSvc = components.classes["@activestate.com/koRemoteConnectionService;1"].\
                    getService(components.interfaces.koIRemoteConnectionService)
            self._connection = rfSvc.getConnectionUsingUri(remote_uri)
        except:
            lastErrorSvc = components.classes["@activestate.com/koLastErrorService;1"].getService(components.interfaces.koILastErrorService);
            errmsg = lastErrorSvc.getLastErrorMessage();
            self.notifyFileTransferFailed(self.uri, remote_uri, errmsg)
            return
        self.onProgress("Remote connection opened", 0)
        
    def run(self):
        # Check if the remote file has changed, if it has there's a conflict.
        # Test connection
        pubSettings = self.pubSettings
        remote_uri = pubSettings.matchingRemoteUriFromLocalUri(self.uri)
        self.setup_connection(remote_uri)
        if not self._connection:
            return
        else:
            # We don't need the connection yet.  Just checking so we can fail fast
            self._connection.close()
        koRemoteTransSvc = components.classes["@activestate.com/koRemoteTransferService;1"]. \
                            getService(components.interfaces.koIRemoteTransferService)
        self.transfer_op = koRemoteTransSvc.download([remote_uri],
                                                     [self.uri],
                                                     self)

class koPublishingService(object):
    _com_interfaces_ = [components.interfaces.koIPublishingService,
                        components.interfaces.nsIObserver]
    _reg_desc_ = "Komodo Publishing Service"
    _reg_contractid_ = "@activestate.com/koPublishingService;1"
    _reg_clsid_ = "{e39fc45b-0481-473a-86e8-087bf6c8258e}"

    _publishing_configs = None

    def __init__(self):
        observerSvc = components.classes["@mozilla.org/observer-service;1"]. \
                        getService(components.interfaces.nsIObserverService)
        # Ensure observer service is used on the main thread.
        components.ProxyToMainThreadAsync(observerSvc.addObserver)(self, "document_saved", False)

    def _sortConfigs(self, configs):
        import operator
        return sorted(configs, key=operator.attrgetter("name"))
        
    def getPublishingSettings(self):
        publishing_configs = self._publishing_configs
        if publishing_configs is None:
            publishing_configs = []
            prefs = components.classes['@activestate.com/koPrefService;1']. \
                            getService(components.interfaces.koIPrefService).prefs
            if prefs.hasPref("publishing_configurations"):
                pref_configs = prefs.getPref("publishing_configurations")
                for i in range(pref_configs.length):
                    settings = components.classes["@activestate.com/koPublishingSettings;1"]. \
                                   createInstance(components.interfaces.koIPublishingSettings)
                    settings.unserializeFromPreference(pref_configs.getPref(i))
                    publishing_configs.append(settings)
            self._publishing_configs = self._sortConfigs(publishing_configs)
        return publishing_configs

    def getPublishingSettingsForUri(self, uri):
        for config in self.getPublishingSettings():
            if config.matchesUri(uri):
                return config

    def savePublishingSettings(self, configs):
        pref_configs = components.classes['@activestate.com/koOrderedPreference;1']. \
                        createInstance(components.interfaces.koIOrderedPreference)
        for i in range(len(configs)):
            pref_configs.appendPref(configs[i].serializeToPreference())
        prefs = components.classes['@activestate.com/koPrefService;1']. \
                        getService(components.interfaces.koIPrefService).prefs
        prefs.setPref("publishing_configurations", pref_configs)
        self._publishing_configs = self._sortConfigs(configs)
        # Send a global notification that the publishing configs have changed.
        observerSvc = components.classes["@mozilla.org/observer-service;1"]. \
                        getService(components.interfaces.nsIObserverService)
        observerSvc.notifyObservers(None, "publishing_configurations_changed", "")

    def push(self, publish_settings, callback):
        async_svc = components.classes["@activestate.com/koAsyncService;1"].\
                        getService(components.interfaces.koIAsyncService)
        cb = ProxiedSynchronizationCallback(callback)
        async_op = koPublishingPushOperation(publish_settings, cb)
        async_svc.run("Publishing:: push", async_op, cb, [], True)

    def pull(self, publish_settings, callback):
        pass

    def synchronize(self, publish_settings, callback):
        async_svc = components.classes["@activestate.com/koAsyncService;1"].\
                        getService(components.interfaces.koIAsyncService)
        cb = ProxiedSynchronizationCallback(callback)
        async_op = koPublishingSyncOperation(publish_settings, cb)
        async_svc.run("Publishing:: synchronize", async_op, cb, [], True, False)
        return async_op

    def pushLocalUri(self, uri, transferCallback=None, forcePush=False, pubSettings=None):
        if pubSettings is None:
            pubSettings = self.getPublishingSettingsForUri(uri)
            if pubSettings is None:
                # No publishing config for this uri.
                raise COMException(nsError.NS_ERROR_INVALID_ARG,
                                   "Uri %r does not belong to any publishing configurations" % (uri))
        pubSettings = UnwrapObject(pubSettings)
        localpath = uriparse.URIToLocalPath(uri)
        if is_windows:
            localpath = localpath.lower()
        localSyncInfo = pubSettings.sync_data['local'].get(localpath)
        if not forcePush and localSyncInfo and not localSyncInfo.hasChanged(localpath):
            # File hasn't changed and we're not forcing it.
            if transferCallback:
                transferCallback.callback(components.interfaces.koIAsyncCallback.RESULT_ERROR,
                                          "Publishing: There are no changes to push.")
            return

        # Asyncronously perform a remote check and then upload the file.
        return koFilePushOperation(uri, pubSettings, transferCallback, forcePush)


    def pullUri(self, uri, transferCallback=None, force=False, pubSettings=None):
        """ Pull single uri down from the server
        'force' allows you to pull the file regardless of conflicts between remote
        and local files."""
        if pubSettings is None:
            pubSettings = self.getPublishingSettingsForUri(uri)
            if pubSettings is None:
                # No publishing config for this uri.
                raise COMException(nsError.NS_ERROR_INVALID_ARG,
                                   "Uri %r does not belong to any publishing configurations" % (uri))
        pubSettings = UnwrapObject(pubSettings)
        localpath = uriparse.URIToLocalPath(uri)
        if is_windows:
            localpath = localpath.lower()
        localSyncInfo = pubSettings.sync_data['local'].get(localpath)
        if not force and localSyncInfo and localSyncInfo.hasChanged(localpath):
            # Local file has changes and we're not forcing it.
            if transferCallback:
                transferCallback.callback(components.interfaces.koIAsyncCallback.RESULT_ERROR,
                                          "Conflict: Local file has changes.")
            return

        # Asyncronously perform a remote check and then upload the file.
        return koFilePullOperation(uri, pubSettings, transferCallback, force)


    def observe(self, subject, topic, data):
        if topic == "document_saved":
            uri = data
            pubSettings = self.getPublishingSettingsForUri(uri)
            if pubSettings is None or not pubSettings.autopush_on_save:
                # No publishing config for this uri or not wanted to autosave.
                return
            self.pushLocalUri(uri, pubSettings=pubSettings)
