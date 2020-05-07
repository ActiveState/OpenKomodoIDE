#!/usr/bin/env python

"""
Proof of concept to see if Komodo's remote files can be used for a publishing
system.
"""

import os
import stat
import logging
import unittest
import threading
from os.path import join, exists, isdir, isfile, dirname

from xpcom import components, COMException

log = None

# Generic test class, used by ftp, sftp, scp synchronizers.
class ConnectionSync(object):
    RFService = None

    def setUp(self):
        """Called before every test"""
        if self.RFService is None:
            self.RFService = components.classes["@activestate.com/koRemoteConnectionService;1"].\
                        getService(components.interfaces.koIRemoteConnectionService)
        self._connection = self.RFService.getConnection(self._protocol, self._hostname, self._port, self._username, self._password, '')

    def pull_directory(self, remote_dir, local_dir, depth=0):
        has_changed = False
        dir_rfinfo = self._connection.list(remote_dir, 1)# Refresh
        self.assert_(dir_rfinfo is not None, "Remote directory does not exist")
        self.assert_(dir_rfinfo.isDirectory(), "Directory is not representing as a directory.")
        self.assertFalse(dir_rfinfo.isFile(), "Directory is incorrectly representing as a file.")
        self.assert_(dir_rfinfo.isReadable(), "Directory is not readable.")
        self.assert_(dir_rfinfo.isWriteable(), "Directory is not writeable.")
        # check the child elements of dirinfo
        childEntries = dir_rfinfo.getChildren()
        base_remote_path = dir_rfinfo.getFilepath()
        base_len = len(base_remote_path)
        if not exists(local_dir):
            print "  Creating base local directory: %r" % (local_dir)
            os.makedirs(local_dir)
        # XXX: what to do if it exists and is not a directory?
        self.assert_(isdir(local_dir), "Local sync directory is not a directory!")
        for child_rfinfo in childEntries:
            #print child_rfinfo
            remote_path = child_rfinfo.getFilepath()
            local_path = join(local_dir, remote_path[base_len:].lstrip("/"))
            if child_rfinfo.isDirectory():
                if not exists(local_path):
                    print "  Creating synced directory: %r" % (local_path)
                    os.mkdir(local_path)
                    has_changed = True
                # XXX: what to do if it exists and is not a directory?
                self.assert_(isdir(local_path), "Local path already exists, but is not a directory: %r" % (local_path))
                has_changed |= self.pull_directory(remote_path, local_path)
            elif child_rfinfo.isFile():
                remote_file_data = self._connection.readFile(remote_path)
                if not exists(local_path):
                    print "  Creating synced file: %r" % (local_path)
                    file(local_path, "wb").write(remote_file_data)
                    has_changed = True
                else:
                    # XXX: what to do if it exists locally, but is not a file?
                    self.assert_(isfile(local_path), "Local path already exists, but is not a file: %r" % (local_path))
                    # Check if the file has changed.
                    local_file_data = file(local_path, "rb").read()
                    if local_file_data != remote_file_data:
                        print "  Updating synced file: %r" % (local_path)
                        file(local_path, "wb").write(remote_file_data)
                        has_changed = True
        return has_changed

    def test_pull_directory(self):
        """Pull remote directory entries to a local place"""
        try:
            print "\n\nChecking for pull changes..."
            remote_dir = join(self._remote_dir, "pull_folder")
            local_dir = join(self._local_dir, "pull_folder")
            has_changed = self.pull_directory(remote_dir, local_dir)
            if not has_changed:
                print "  no changes."
        except COMException, ex:
            lastErrorSvc = components.classes["@activestate.com/koLastErrorService;1"]\
                           .getService(components.interfaces.koILastErrorService)
            self.fail("COMException raised: %s" % (lastErrorSvc.getLastErrorMessage()))


    def push_directory(self, local_dir, dir_rfinfo):
        has_changed = False
        self.assert_(exists(local_dir), "Local directory does not exist: %r" % (local_dir))
        self.assert_(isdir(local_dir), "Local path is not a directory: %r" % (local_dir))
        self.assert_(dir_rfinfo is not None, "Remote directory does not exist")
        self.assertFalse(dir_rfinfo.isFile(), "Directory is incorrectly representing as a file.")
        self.assert_(dir_rfinfo.isReadable(), "Directory is not readable.")
        self.assert_(dir_rfinfo.isWriteable(), "Directory is not writeable.")

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
            remote_path = "/".join([remote_dir, local_filename])
            child_rfinfo = remote_entries.get(local_filename)
            #print child_rfinfo
            local_stat = os.stat(local_path)
            st_mode = local_stat.st_mode
            if stat.S_ISDIR(st_mode):
                if child_rfinfo is None:
                    # Create the remote directory.
                    print "  Creating remote directory: %r" % (remote_path)
                    self._connection.createDirectory(remote_path, 0700)
                    has_changed = True
                child_rfinfo = self._connection.list(remote_path, 1)# Refresh
                # XXX: what to do if it exists and is not a directory?
                self.assert_(child_rfinfo, "Remote directory does not exist: %r" % (remote_path))
                self.assert_(child_rfinfo.isDirectory(), "Remote path already exists, but is not a directory: %r" % (remote_path))
                has_changed |= self.push_directory(local_path, child_rfinfo)
            elif stat.S_ISREG(st_mode): # Regular file.
                local_file_data = file(local_path, "rb").read()
                if not child_rfinfo:
                    print "  Creating synced file: %r" % (remote_path)
                    self._connection.writeFile(remote_path, local_file_data)
                    file(local_path, "wb").write(local_file_data)
                    has_changed = True
                else:
                    # XXX: what to do if it exists locally, but is not a file?
                    self.assert_(child_rfinfo.isFile(), "Remote path already exists, but is not a file: %r" % (remote_path))
                    remote_file_data = self._connection.readFile(remote_path)
                    # Check if the file has changed.
                    if local_file_data != remote_file_data:
                        print "  Updating synced file: %r" % (remote_path)
                        self._connection.writeFile(remote_path, local_file_data)
                        has_changed = True
        return has_changed

    def test_push_directory(self):
        """Push local directory entries to a remote location"""
        try:
            print "\n\nChecking for push changes..."
            local_dir = join(self._local_dir, "push_folder")
            remote_dir = join(self._remote_dir, "push_folder")
            self.assert_(exists(local_dir), "Local directory does not exist: %r" % (local_dir))
            self.assert_(isdir(local_dir), "Local path is not a directory: %r" % (local_dir))

            dir_rfinfo = self._connection.list(remote_dir, 1)# Refresh
            if not dir_rfinfo:
                # Create remote parent directories.
                # XXX: Move this into the koIFTPConnection.makedirs().
                create_paths = [remote_dir]
                parent_path = dirname(remote_dir)
                while dir_rfinfo is None and parent_path and parent_path != "/":
                    parent_path = dirname(remote_dir)
                    dir_rfinfo = self._connection.list(parent_path, 1)# Refresh
                    if not dir_rfinfo:
                        create_paths.append(parent_path)
                for parent_path in create_paths:
                    self._connection.createDirectory(parent_path, 0700)
                dir_rfinfo = self._connection.list(remote_dir, 1)# Refresh
                self.assert_(dir_rfinfo, "Remote directory still does not exist: %r" % (remote_dir))
            has_changed = self.push_directory(local_dir, dir_rfinfo)
            if not has_changed:
                print "  no changes."
        except COMException, ex:
            lastErrorSvc = components.classes["@activestate.com/koLastErrorService;1"]\
                           .getService(components.interfaces.koILastErrorService)
            self.fail("COMException raised: %s" % (lastErrorSvc.getLastErrorMessage()))


class TestAnoleSFTPSync(ConnectionSync, unittest.TestCase):
    _protocol = 'sftp'
    _hostname = "anole"
    _port = 0
    _username = "toddw"
    _password = None   # will use public key authentication
    _local_dir = '/home/toddw/tmp/publishing/sync_folder/anole'
    _remote_dir = '/Users/toddw/publishing/sync_folder'

