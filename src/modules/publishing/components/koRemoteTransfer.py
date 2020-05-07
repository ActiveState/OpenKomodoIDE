# Copyright (c) 2009-2010 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
import sys
import time
import stat
import shutil
import logging
import threading
from os.path import join, exists, isdir, isfile, basename, dirname
from hashlib import md5

from xpcom import components, nsError, COMException

import uriparse
import URIlib
from koAsyncOperationUtils import koAsyncOperationBase

log = logging.getLogger('koRemoteTransfer')
#log.setLevel(logging.INFO)

is_windows = sys.platform.startswith("win")


class koTransferOperation(threading.Thread, koAsyncOperationBase):

    _com_interfaces_ = [components.interfaces.koIAsyncOperation,
                        components.interfaces.koIRemoteTransferOperation]

    _callback = None
    _proxied_callback = None

    xor_permissions = (components.interfaces.koIFileEx.PERM_IRWXU |
                       components.interfaces.koIFileEx.PERM_IRWXG |
                       components.interfaces.koIFileEx.PERM_IRWXO)

    def __init__(self, local_uris, remote_uris, callback):
        threading.Thread.__init__(self)
        self.setDaemon(True)
        koAsyncOperationBase.__init__(self, None)

        self.local_uris = local_uris
        self.remote_uris = remote_uris
        self.callback = callback
        self._aborted = False
        self._isrunning = False
        # File information for the uploaded/downloaded files. Each
        # item is matched to the same index in the local/remote uris.
        self._rf_infos = []
        self._local_stats = []
        self._local_md5hashes = []
        self._localpaths = []
        self._remotepaths = []
        self._removed_localpaths = []
        self._removed_remotepaths = []

    def stop(self):
        self._aborted = True

    @components.ProxyToMainThread
    def notifyResult(self, result, message):
        if self.callback is not None:
            self.callback.callback(result, message)

    @components.ProxyToMainThread
    def notifyProgress(self, message, value):
        if self.callback is not None:
            self.callback.onProgress(message, value)

    @components.ProxyToMainThread
    def notifyFileTransferStarting(self, local_uri, remote_uri):
        if self.callback is not None:
            self.callback.notifyFileTransferStarting(local_uri, remote_uri)

    @components.ProxyToMainThread
    def notifyFileTransferCompleted(self, local_uri, remote_uri):
        if self.callback is not None:
            self.callback.notifyFileTransferCompleted(local_uri, remote_uri)

    @components.ProxyToMainThread
    def notifyFileTransferFailed(self, local_uri, remote_uri, message):
        if self.callback is not None:
            self.callback.notifyFileTransferFailed(local_uri, remote_uri, message)

    def setup_connection(self, remote_uri):
        self.notifyProgress("Initializing the remote connection", 0)
        connection = None
        rfSvc = components.classes["@activestate.com/koRemoteConnectionService;1"].\
                    getService(components.interfaces.koIRemoteConnectionService)
        try:
            connection = rfSvc.getConnectionUsingUri(remote_uri)
            self.notifyProgress("Remote connection opened", 1)
        except:
            lastErrorSvc = components.classes["@activestate.com/koLastErrorService;1"].getService(components.interfaces.koILastErrorService);
            errmsg = lastErrorSvc.getLastErrorMessage();
            self.notifyProgress("Connection failed Transfer Op: "+errmsg, 0)
        return connection

    def rename_locally(self, from_uri, to_uri):
        """Rename the local 'from' uri to the corresponding 'to' uri."""
        # The os.rename method is not used because that fails to rename a file
        # that is on a different file system, which is often the case for
        # Python temporary files and directories.
        assert from_uri is not None
        assert to_uri is not None
        assert from_uri != to_uri
        from_path = uriparse.URIToLocalPath(from_uri)
        to_path = uriparse.URIToLocalPath(to_uri)
        if isdir(from_path):
            if not isdir(to_path):
                os.makedirs(to_path)
        else:
            shutil.move(from_path, to_path)
        try:
            idx = self._localpaths.index(from_path)
            self._localpaths[idx] = to_path
            self._local_stats[idx] = os.stat(to_path)
        except ValueError:
            log.warn("rename_locally:: Could not find localpath entry for: %r",
                     from_path)

    def remove_locally(self, local_uri, remote_uri):
        """Remove the local uri, the remote uri is used for reference."""
        assert local_uri is not None
        assert remote_uri is not None
        local_path = uriparse.URIToLocalPath(local_uri)
        remote_path = uriparse.URIToPath(remote_uri)
        log.info("koTransferOperation:: remove_locally: %r", local_path)
        if exists(local_path):
            if isdir(local_path):
                shutil.rmtree(local_path, ignore_errors=True)
            else:
                os.remove(local_path)
        # Keep track of what was removed.
        self._removed_localpaths.append(local_path)
        self._removed_remotepaths.append(remote_path)

    def remove_remotely(self, local_uri, remote_uri):
        """Remove the remote uri, local_uri is used for reference."""
        assert local_uri is not None
        assert remote_uri is not None
        log.info("koTransferOperation:: remove_remotely: %r", remote_uri)
        local_path = uriparse.URIToLocalPath(local_uri)
        remote_path = uriparse.URIToPath(remote_uri)
        # TODO: Cache this connection?
        connection = self.setup_connection(remote_uri)
        rf_info = connection.list(remote_path, False)
        if rf_info is not None:
            if rf_info.isDirectory():
                # Remove directory and any child contents.
                connection.removeDirectoryRecursively(remote_path)
            else:
                connection.removeFile(remote_path)
        # Keep track of what was removed.
        self._removed_localpaths.append(local_path)
        self._removed_remotepaths.append(remote_path)

class koTransferDownloadOperation(koTransferOperation):
    def run(self):
        self._isrunning = True
        try:
            time_started = time.time()
            if len(self.remote_uris):
                connection = self.setup_connection(self.remote_uris[0])
                if not connection:
                    self._isrunning = False
                    return
            rfinfos = []
            self._local_stats = []
            self._local_md5hashes = []
            local_stats = self._local_stats
            local_md5hashes = self._local_md5hashes
            filesizes = []
            koFileEx = components.classes["@activestate.com/koFileEx;1"]. \
                            createInstance(components.interfaces.koIFileEx)
            # Fetch the file information we are required to download.
            total_filesize = 0
            for remoteuri in self.remote_uris:
                if self._aborted:
                    raise COMException(nsError.NS_ERROR_ABORT, "Aborted")
                koFileEx.URI = remoteuri
                rfinfo = connection.list(koFileEx.path, False)
                if rfinfo is None:
                    raise Exception("No remote file info for: %r" % (remoteuri, ))
                rfinfos.append(rfinfo)
                filesize = 0
                try:
                    filesize += long(rfinfo.getFileSize())
                except ValueError:
                    pass
                filesizes.append(filesize)
                total_filesize += filesize
            log.debug("koTransferDownloadOperation:: total_filesize to download: %d", total_filesize)

            total_filesize_downloaded = float(0)
            self._localpaths = []
            localpaths = self._localpaths
            remotepaths = []
            progress_value = 0
            for rfinfo, remote_uri, local_uri in zip(rfinfos, self.remote_uris, self.local_uris):
                if self._aborted:
                    raise COMException(nsError.NS_ERROR_ABORT, "Aborted")
                remotepath = rfinfo.getFilepath()
                remotepaths.append(remotepath)
                self.notifyProgress("Downloading %s" % (remotepath, ), progress_value)
                self.notifyFileTransferStarting(local_uri, remote_uri)
                #time.sleep(1)
                localpath = uriparse.URIToLocalPath(local_uri)
                localpaths.append(localpath)
                md5hash = None
                if rfinfo.isDirectory():
                    if not exists(localpath):
                        os.makedirs(localpath)
                elif rfinfo.isFile():
                    data = connection.readFile(remotepath)
                    if self._aborted:
                        raise COMException(nsError.NS_ERROR_ABORT, "Aborted")
                    if not exists(dirname(localpath)):
                        os.makedirs(dirname(localpath))
                    file(localpath, "wb").write(data)
                    md5hash = md5(data).hexdigest()
                local_stats.append(os.stat(localpath))
                local_md5hashes.append(md5hash)
                try:
                    total_filesize_downloaded += long(rfinfo.getFileSize())
                except ValueError:
                    pass
                try:
                    progress_value = int((total_filesize_downloaded / total_filesize) * 100)
                except ZeroDivisionError:
                    pass
                self.notifyFileTransferCompleted(local_uri, remote_uri)
                log.info("koTransferDownloadOperation:: downloaded %r to %r",
                         remote_uri, localpath)
    
            # Remember the transfered file information.
            self._remotepaths = remotepaths
            self._rf_infos = rfinfos

            time_taken = int(time.time() - time_started)
            time_taken_string = ""
            if time_taken < 1:
                time_taken_string = "less than a second"
            elif time_taken == 1:
                time_taken_string = "1 second"
            else:
                time_taken_string = "%d seconds" % (time_taken, )
            self.notifyProgress("Download finished, time taken: %s" % (time_taken_string, ), 100)
            log.debug("koTransferDownloadOperation:: finished, time taken: %s", time_taken_string)
        except Exception, ex:
            if not isinstance(ex, COMException):
                log.exception("koTransferDownloadOperation:: unexpected exception")
            self.notifyResult(components.interfaces.koIAsyncCallback.RESULT_ERROR,
                              str(ex));
        else:
            self.notifyResult(components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL,
                              "");
        finally:
            self._isrunning = False


class koTransferUploadOperation(koTransferOperation):

    def _createRemoteDirsFromLocalDirs(self, connection, remote_uri, localpath):
        orig_remote_uri = remote_uri
        koFileEx = components.classes["@activestate.com/koFileEx;1"]. \
                        createInstance(components.interfaces.koIFileEx)
        koFileEx.URI = remote_uri
        remotepath = koFileEx.path
        if is_windows:
            remotepath = remotepath.replace("\\", "/")
        rfinfo = connection.list(remotepath, False)
        make_dir_info = []
        last_remotepath = None
        while rfinfo is None:
            if self._aborted:
                raise COMException(nsError.NS_ERROR_ABORT, "Aborted")
            if not remotepath or remotepath == last_remotepath:
                raise Exception("Could not find any parent directory for %r" % (
                                orig_remote_uri, ))
            make_dir_info.append((remotepath, localpath))
            remotepath = dirname(remotepath)
            rfinfo = connection.list(remotepath, False)
            if rfinfo is None:
                koFileEx.path = remotepath
                last_remotepath = remotepath
                localpath = dirname(localpath)
                if is_windows:
                    remotepath = remotepath.replace("\\", "/")
        for remotepath, localpath in make_dir_info:
            local_stat = os.stat(localpath)
            connection.createDirectory(remotepath,
                                       (local_stat.st_mode & self.xor_permissions))

    def run(self):
        connection = None
        self._isrunning = True
        try:
            time_started = time.time()
            if len(self.remote_uris):
                connection = self.setup_connection(self.remote_uris[0])
                if not connection:
                    self._isrunning = True
                    return
            local_filestats = []
            local_md5hashes = []
            koFileEx = components.classes["@activestate.com/koFileEx;1"]. \
                            createInstance(components.interfaces.koIFileEx)
            # Fetch the file information we are required to upload.
            total_filesize = 0
            localpaths = []
            for localuri in self.local_uris:
                if self._aborted:
                    raise COMException(nsError.NS_ERROR_ABORT, "Aborted")
                koFileEx.URI = localuri
                localpath = koFileEx.path
                localpaths.append(localpath)
                try:
                    filestat = os.stat(localpath)
                except EnvironmentError, ex:
                    # File is gone - we'll raise an error when we try to access
                    # it below.
                    local_filestats.append((None, str(ex)))
                else:
                    local_filestats.append((filestat, None))
                    try:
                        total_filesize += filestat.st_size
                    except ValueError:
                        pass
            log.debug("koTransferUploadOperation:: total_filesize to upload: %d",
                      total_filesize)
    
            total_filesize_uploaded = float(0)
            progress_value = 0
            remotepaths = []
            for stats_tuple, remote_uri, local_uri, localpath in zip(local_filestats,
                                                          self.remote_uris,
                                                          self.local_uris,
                                                          localpaths):
                if self._aborted:
                    raise COMException(nsError.NS_ERROR_ABORT, "Aborted")
                md5hash = None
                filestat, error_message = stats_tuple
                if filestat is None:
                    # Error occured on this file.
                    self.notifyFileTransferFailed(local_uri, remote_uri, error_message)
                    log.info("koTransferUploadOperation:: error uploading: %r - %r",
                             remote_uri, error_message)
                    local_md5hashes.append(md5hash)
                    continue
                koFileEx.URI = remote_uri
                remotepath = koFileEx.path
                remotepaths.append(remotepath)
                self.notifyProgress("Uploading %s" % (remotepath, ), progress_value)
                self.notifyFileTransferStarting(local_uri, remote_uri)
                #time.sleep(1)
                if isdir(localpath):
                    rfinfo = connection.list(remotepath, False)
                    if rfinfo is None: # doesn't exist
                        self._createRemoteDirsFromLocalDirs(connection,
                                                            remote_uri,
                                                            localpath)
                    total_filesize_uploaded += filestat.st_size
                elif isfile(localpath):
                    parent_remote_path = koFileEx.dirName
                    rfinfo = connection.list(parent_remote_path, False)
                    if rfinfo is None: # parent doesn't exist yet
                        koFileEx.path = parent_remote_path
                        parent_remote_uri = koFileEx.URI
                        self._createRemoteDirsFromLocalDirs(connection,
                                                            parent_remote_uri,
                                                            dirname(localpath))
                    data = file(localpath, "rb").read()
                    md5hash = md5(data).hexdigest()
                    if self._aborted:
                        raise COMException(nsError.NS_ERROR_ABORT, "Aborted")
                    connection.writeFile(remotepath, data)
                    try:
                        total_filesize_uploaded += len(data)
                    except ValueError:
                        pass
                local_md5hashes.append(md5hash)
                try:
                    progress_value = int((total_filesize_uploaded / total_filesize) * 100)
                except ZeroDivisionError:
                    pass
                self.notifyFileTransferCompleted(local_uri, remote_uri)
                log.info("koTransferUploadOperation:: uploaded %r to %r",
                          localpath, remote_uri)

            # Remember the transfered file information.
            self._localpaths = localpaths
            self._local_stats = [x[0] for x in local_filestats]
            self._local_md5hashes = local_md5hashes
            self._remotepaths = remotepaths
            # For remote files - we have to update our information from the
            # connection itself. We invalidate all the remote paths and then
            # use connection.list to repopulate the remote file information.
            doInvalidateChildren = True
            for remotepath in remotepaths:
                connection.invalidatePath(remotepath, doInvalidateChildren)
            for remotepath in remotepaths:
                self._rf_infos.append(connection.list(remotepath, False))

            time_taken = int(time.time() - time_started)
            time_taken_string = ""
            if time_taken < 1:
                time_taken_string = "less than a second"
            elif time_taken == 1:
                time_taken_string = "1 second"
            else:
                time_taken_string = "%d seconds" % (time_taken, )
            self.notifyProgress("Upload finished, time taken: %s" % (time_taken_string, ), 100)
            log.debug("koTransferUploadOperation:: finished, time taken: %s", time_taken_string)
        except Exception, ex:
            if not isinstance(ex, COMException):
                log.exception("koTransferUploadOperation:: unexpected exception")
            self.notifyResult(components.interfaces.koIAsyncCallback.RESULT_ERROR,
                              str(ex));
        else:
            self.notifyResult(components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL,
                              "");
        finally:
            self._isrunning = False
            if connection:
                try:
                    connection.close()
                except Exception, ex:
                    log.warn("Error closing the connection: %r", ex)


class koRemoteTransferService(object):
    _com_interfaces_ = [components.interfaces.koIRemoteTransferService]
    _reg_desc_ = "Komodo Remote Transfer Service"
    _reg_contractid_ = "@activestate.com/koRemoteTransferService;1"
    _reg_clsid_ = "{7aa6a3db-08db-43d2-9850-f87e7a2ded53}"

    def download(self, remote_uris, local_uris, callback):
        """Download these remote paths from the given server and save the files
        to their corresponding local paths.

        If the callback is provided, an event will be sent back every time one
        of the files is successfully downloaded.
        """
        assert len(local_uris) == len(remote_uris)
        transferOp = koTransferDownloadOperation(local_uris, remote_uris, callback)
        transferOp.start()
        return transferOp

    def upload(self, local_uris, remote_uris, callback):
        """Upload these local paths to their corresponding remote paths.

        If the callback is provided, an event will be sent back every time one
        of the files is successfully uploaded.
        """
        assert len(local_uris) == len(remote_uris)
        transferOp = koTransferUploadOperation(local_uris, remote_uris, callback)
        transferOp.start()
        return transferOp
