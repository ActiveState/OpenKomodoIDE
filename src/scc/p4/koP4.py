#!python
# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
import sys
import time
import re
import logging

import p4lib
import uriparse
from koSCCBase import KoSCCBase, PathHelperMixin, groupFilesByDirectory
from koSCCBase import splitFile as orig_splitFile
from koAsyncOperationUtils import koAsyncOperationBase

from xpcom import components

from koSCCHistoryItem import koSCCHistoryItem
from koSCCFileStatus import koSCCFileStatusItem
from xpcom.server import UnwrapObject

log = logging.getLogger('koP4')
#log.setLevel(logging.DEBUG)

#---- support routines

# Override the default splitFile functionality.
def splitFile(path):
    path, filename = orig_splitFile(path)
    if path and not filename:
        filename = "./..."
    return path, filename


#---- component implementation

class KoP4(KoSCCBase):
    # Satisfy koISCC.name
    name = "p4"
    # XPCOM component registration settings.
    _com_interfaces_ = [components.interfaces.koISCC, components.interfaces.nsIObserver]
    _reg_desc_ = "Komodo P4 Support"
    _reg_contractid_ = "@activestate.com/koSCC?type=" + name + ";1"
    _reg_clsid_ = "{7BD69117-A206-410b-A2C1-FAC34976734A}"
    _reg_categories_ = [
         ("category-komodo-scc", name),
         ]

    # Override koSCCBase class settings.
    executableBaseName = "p4"
    executablePrefName = "p4Executable"

    def __init__(self):
        KoSCCBase.__init__(self)
        # A generic p4lib instance to do work with.
        self.p4 = p4lib.P4()
        # OS helper service.
        self._osPathSvc = components.classes["@activestate.com/koOsPath;1"].\
                getService(components.interfaces.koIOsPath)

    def create_new_scc_handler(self):
        scc_handler = p4lib.P4()
        # Ensure the instance uses the same executable as the git service.
        scc_handler.p4 = self.get_executable()
        return scc_handler

    def getValue(self, name, data, scc_handler=None):
        if not scc_handler:
            scc_handler = self.create_new_scc_handler()
            
        if name == "supports_command":
            if data in ("add", "commit", "diff", "edit", "history",
                        "remove", "revert", "status", "update"):
                return "Yes"
        elif name == "external_diff":
            if self._globalPrefs.getStringPref('p4_diff_type') != 'komododiff':
                return self._globalPrefs.getStringPref('externaldiff')
        elif name == "repository_root":
            repodir = self._do_getRoot(data, scc_handler=scc_handler)
            return repodir
        return ""
    
    def _do_getRoot(self, fileuri, scc_handler=None):
        filepath = uriparse.URIToLocalPath(fileuri)
        return scc_handler.workingDirectory(filepath)

    def _normalizeFiles(self, files):
        _files = []
        for file in files:
            path = uriparse.URIToLocalPath(file)
            path = os.path.normpath(path)
            _files.append(path)
        return _files


#    print --  Retrieve a depot file to the standard output
#
#    p4 print [ -a -o localFile -q ] file[revRange] ...
#
#        Retrieve the contents of a depot file to the client's standard
#        output.  The client's have list is not affected.  If file is
#        specified as a client file name, the client view is used to
#        find the corresponding depot file.
#
#        If the file argument has a revision, then all files as of that
#        revision are printed.  If the file argument has a revision range,
#        then only files selected by that revision range are printed, and
#        the highest revision in the range is used for each file.  Normally,
#        the head revision is printed.  See 'p4 help revisions' for help
#        specifying revisions.
#
#        The -a flag prints all revisions within the specific range, rather
#        than just the highest revision in the range.
#
#        The -o localFile flag redirects the output to the named file on
#        the client filesystem.  In this case, at most one file is written.
#
#        The -q flag suppresses the initial line that displays the file name
#        and revision.

    def _do_cat(self, baseNameAsArray, cwd, options, scc_handler=None):
        result, raw = scc_handler.cat(baseNameAsArray,
                                      terminalHandler=None,
                                      _raw=0,
                                      cwd=cwd,
                                      env=self._env)
        return raw['stdout']

#    diff -- Display diff of client file with depot file
#
#    p4 diff [ -d<flag> -f -sa -sd -se -sr -t ] [ file[rev] ... ]
#
#        Run diff (on the client) of a client file against the corresponding
#        revision in the depot. The file is only compared if the file is
#        opened for edit or the revision provided with the file argument is
#        not the same as the revision had by the client.  See 'p4 help
#        revisions' for help specifying revisions.
#
#        If no file argument is given, diff all open files.
#        This can be used to view pending changelists.
#
#        The -d<flag> passes a flag to the built-in diff routine to modify
#        the output: -dn (RCS), -dc (context), -ds (summary), -du (unified).
#
#        The -f flag forces a diff for every file, regardless of whether
#        they are opened or if the client has the named revision.
#        This can be used to verify the client contents.
#
#        The -s flag reduces the output of diff to the names of files
#        satisfying the following criteria:
#
#                -sa     Opened files that are different than the revision
#                        in the depot, or missing.
#
#                -sd     Unopened files that are missing on the client.
#
#                -se     Unopened files that are different than the revision
#                        in the depot.
#
#                -sr     Opened files that are the same as the revision in the
#                        depot.
#
#        The -t flag forces 'p4 diff' to diff even files with non-text
#        (binary) types.
#
#        If the environment variable $P4DIFF is set then the named program is
#        used rather than the implementation of diff included in the client.
#        The -d<flag>command can be used to pass arguments to the
#        external program.  The -s flag is only implemented internally.
    def _do_diff(self, files, options, external, scc_handler=None):
        #print "p4 diff ",repr(files)
        _files = groupFilesByDirectory(files)
        diff = ''
        for basedir in _files.keys():
            basedir_files = _files[basedir]
            if not basedir_files:
                # Work on everything underneath this directory.
                basedir_files = ['...']
            result, raw = scc_handler.diff(files=basedir_files,
                                           diffFormat=options,
                                           _raw=1,
                                           cwd=basedir,
                                           p4diff=external)
            raw_stdout = raw.get('stdout')
            rawerror = raw.get('stderr', "")
            if rawerror and not raw_stdout:
                # There was some type of error
                raise p4lib.P4LibError(rawerror)

            if raw_stdout:
                # Convert the diff result (unicode and eol conversion).
                raw_stdout = self.convertDiffResult(raw_stdout)
                diff += raw_stdout

        return diff

    def _do_diff_relative(self, baseURI, relpaths, options, external, scc_handler=None):
        """Display diff of the client files relative to the base directory."""

        basedir = uriparse.URIToLocalPath(baseURI)
        if not relpaths:
            # Work on everything underneath this directory.
            relpaths = ['...']
        result, raw = scc_handler.diff(files=relpaths,
                                       diffFormat=options,
                                       _raw=1,
                                       cwd=basedir,
                                       p4diff=external)
        raw_stdout = raw.get('stdout')
        rawerror = raw.get('stderr', "")
        if rawerror and not raw_stdout:
            # There was some type of error
            raise p4lib.P4LibError(rawerror)

        diff = raw_stdout
        if diff:
            # Convert the diff result (unicode and eol conversion).
            diff = self.convertDiffResult(diff)

        return diff

#    diff -- Display diff of client file with depot file
#
#    p4 diff [ -d<flag> -f -sa -sd -se -sr -t ] [ file[rev] ... ]
#
#        Run diff (on the client) of a client file against the corresponding
#        revision in the depot. The file is only compared if the file is
#        opened for edit or the revision provided with the file argument is
#        not the same as the revision had by the client.  See 'p4 help
#        revisions' for help specifying revisions.
#
#        If no file argument is given, diff all open files.
#        This can be used to view pending changelists.
#
#        The -d<flag> passes a flag to the built-in diff routine to modify
#        the output: -dn (RCS), -dc (context), -ds (summary), -du (unified).
#
#        The -f flag forces a diff for every file, regardless of whether
#        they are opened or if the client has the named revision.
#        This can be used to verify the client contents.
#
#        The -s flag reduces the output of diff to the names of files
#        satisfying the following criteria:
#
#                -sa     Opened files that are different than the revision
#                        in the depot, or missing.
#
#                -sd     Unopened files that are missing on the client.
#
#                -se     Unopened files that are different than the revision
#                        in the depot.
#
#                -sr     Opened files that are the same as the revision in the
#                        depot.
#
#        The -t flag forces 'p4 diff' to diff even files with non-text
#        (binary) types.
#
#        If the environment variable $P4DIFF is set then the named program is
#        used rather than the implementation of diff included in the client.
#        The -d<flag>command can be used to pass arguments to the
#        external program.  The -s flag is only implemented internally.
    def _do_diff_revisions(self, fileuri1, rev1, fileuri2, rev2, filepath,
                           options, external, scc_handler=None):
        #print "p4 diffRevisions ", repr(fileuri1), rev1, repr(fileuri2), rev2
        basedir, filename = splitFile(filepath)
        result, raw = scc_handler.diffRevisions(fileuri1, rev1,
                                        fileuri2, rev2,
                                        diffFormat=options,
                                        _raw=1,
                                        cwd=basedir,
                                        p4diff=external)

        raw_stdout = raw.get('stdout')
        rawerror = raw.get('stderr', "")
        if rawerror and not raw_stdout:
            # There was some type of error
            #print "stderr:", rawerror
            raise p4lib.P4LibError(rawerror)

        if raw_stdout:
            diff = raw_stdout
        else:
            diff = result['text']
        # Convert the diff result (unicode and eol conversion).
        return self.convertDiffResult(raw_stdout)

#    filelog -- List revision history of files
#
#    p4 filelog [ -i -l -L -t -m maxRevs ] file[rev] ...
#
#        List the revision history of the files named, working backwards
#        from the latest revision to the first.  If the file specification
#        includes a revision, the command limits its output to revisions at
#        or previous to the given revision
#
#        The -i flag follows branches.  If a file was created by branching,
#        'p4 filelog' also lists the revisions of the source file, but
#        only those revisions leading up to the branch point.
#
#        The -t flag displays the time as well as the date.
#
#        The -l flag produces long output with the full text of the
#        changelist descriptions.
#
#        The -L flag produces long output with the full text of the
#        changelist descriptions truncated to 250 characters.
#
#        The -m maxRevs displays at most 'maxRevs' revisions per file.
    def _do_history(self, fileuri, options, limit, scc_handler=None):
        #print "p4 filelog ", options, repr(fileuri)
        # ,cwd=basedir
        basedir, filename = splitFile(fileuri)
        longOutput = ('L' in options)
        followIntegrations = ('i' in options)
        maxRevs = None
        if limit > 0:
            maxRevs = limit
        result, raw = scc_handler.filelog(files=[filename],
                                 longOutput=longOutput,
                                 maxRevs=maxRevs,
                                 followIntegrations=followIntegrations,
                                 _raw=1,
                                 cwd=basedir)

        rawerror = raw.get('stderr', "")
        if rawerror:
            # There was some type of error
            raise p4lib.P4LibError(rawerror)

        #result:
        #Returns a list of hits. Each hit is a dict with the following
        #keys: 'depotFile', 'revs'. 'revs' is a list of dicts, each
        #representing one submitted revision of 'depotFile' and
        #containing the following keys: 'action', 'change', 'client',
        #'date', 'type', 'notes', 'rev', 'user', 'description'.

        # Now, split up the history rows

        koHistoryList = []
        encodingSvc = UnwrapObject(self._encodingSvc)
        #print result
        for filehit in result:
            url  = filehit['depotFile']
            revs = filehit['revs']
            for revision in revs:
                koHistory = koSCCHistoryItem()
                koHistory.version = str(revision['rev'])
                koHistory.change  = str(revision['change'])
                author, encoding, bom = encodingSvc.getUnicodeEncodedStringUsingOSDefault(revision['user'])
                koHistory.author  = author
                koHistory.date    = revision['date']
                koHistory.action  = revision['action']
                message, encoding, bom = encodingSvc.getUnicodeEncodedStringUsingOSDefault(revision['description'])
                koHistory.message = message
                koHistory.uri     = url
                koHistoryList.append(koHistory)
        return koHistoryList

#    add -- Open a new file to add it to the depot
#
#    p4 add [ -c changelist# ] [ -t filetype ] file ...
#
#        Open a new file for adding to the depot.  If the file exists
#        on the client it is read to determine if it is text or binary.
#        If it does not exist it is assumed to be text.  The file must
#        either not exist in the depot, or it must be deleted at the
#        current head revision.  Files may be deleted and re-added.
#
#        If the -c flag is given the open files are associated with the
#        specified pending changelist number; otherwise the open files are
#        associated with the default changelist.
#
#        If file is already open it is moved into the specified pending
#        changelist.  It is not permissible to reopen a file for add unless
#        it was already open for add.
#
#        If -t filetype is given the file is explicitly opened as that
#        filetype.  Otherwise, the filetype is determined by the file
#        name-to-type mapping table managed by 'p4 typemap'.  If the file
#        name is not mapped in that table, 'p4 add' senses the filetype
#        by examining the file's contents and execution permission bits.
#        See 'p4 help filetypes' for a complete list.
    def _do_add(self, files, mode, message, scc_handler=None):
        #add(self, files, mode=None, msg=None, cwd=None)
        # first we figure out what repositories files are in
        # and split them up into seperate lists
        # we init the cvs object with the root we retreived
        _files = groupFilesByDirectory(files)
        output = ''
        for basedir in _files.keys():
            result, raw = scc_handler.add(files=_files[basedir],
                                  _raw=1, cwd=basedir)
            if 'stderr' in raw:
                output += raw['stderr']
            if 'stdout' in raw:
                output += raw['stdout']
            
        # do notification that status may have changed
        # we have to use the original urls passed in since
        # they are modified to local paths in _splitFiles
        forceRefresh = False
        self._fileStatusSvc.updateStatusForUris(files, forceRefresh)
        return output

#    submit -- Submit open files to the depot
#
#    p4 submit [ -s ]
#    p4 submit [ -s ] files
#    p4 submit -c changelist#
#    p4 submit -i [ -s ]
#
#        'p4 submit' commits a pending changelist and its files to the depot.
#
#        With no argument 'p4 submit' attempts to submit all files in the
#        'default' changelist.  Submit provides the user with a dialog
#        similar to 'p4 change' so the user can compose a changelist
#        description.  In this dialog the user is presented with the list
#        of files open in changelist 'default'.  Files may be deleted from
#        this list but they cannot be added.  (Use an open command (edit,
#        add, delete) to add additional files to a changelist.)
#
#        If a (single) file pattern is given, only those files in
#        the 'default' changelist that match the pattern will be submitted.
#
#        The -c flag submits the numbered pending changelist that has been
#        previously created with 'p4 change' or a failed 'p4 submit'.
#
#        The -i flag causes a changelist specification (including files to be
#        submitted) to be read from the standard input.  The user's editor
#        is not invoked.
#
#        The -s flag extends the list of jobs to include the fix status
#        for each job, which becomes the job's status when the changelist
#        is committed.  See 'p4 help change' for more notes on this option.
#
#        Before committing a changelist submit locks all associated files not
#        already locked.  If any file cannot be locked, or if the submit
#        fails for any other reason the files are left open in a newly
#        created pending changelist.
#
#        Submit is guaranteed to be atomic.  Either all files will be
#        updated in the depot as a unit or none will be.
    def _do_commit(self, files, message, options, scc_handler=None):
        #print "p4 commit ",repr(files)
        # p4lib saves message to a message for file
        _files = self._normalizeFiles(files)
        basedir = self._osPathSvc.commonprefixlist(groupFilesByDirectory(_files).keys())
        output = ''
        result, raw = scc_handler.submit(_files,
                                description=message,
                                _raw=1,
                                cwd=basedir)

        forceRefresh = False
        self._fileStatusSvc.updateStatusForUris(files, forceRefresh)

        output += raw.get('stderr', '')
        stdout = raw.get('stdout', '')
        if stdout:
            output += stdout
            rev = re.match(r"Change (\d+) submitted\.", stdout.splitlines()[-1])
            if rev:
                bag = components.classes["@mozilla.org/hash-property-bag;1"].\
                        createInstance(components.interfaces.nsIWritablePropertyBag2)
                bag.setPropertyAsAString("text", output)
                bag.setPropertyAsAString("extra",
                                         " as revision %s" % (rev.group(1),))
                return bag        

        return output

#    delete -- Open an existing file to delete it from the depot
#
#    p4 delete [ -c changelist# ] file ...
#
#        Opens a file that currently exists in the depot for deletion.
#        If the file is present on the client it is removed.  If a pending
#        changelist number is given with the -c flag the opened file is
#        associated with that changelist, otherwise it is associated with
#        the 'default' pending changelist.
#
#        Files that are deleted generally do not appear on the have list.
    def _do_remove(self, files, force, recursive, scc_handler=None):
        _files = groupFilesByDirectory(files)
        output = ''
        for basedir in _files.keys():
            result, raw = scc_handler.delete(_files[basedir], _raw=1, cwd=basedir)
            raw_stderr = raw.get('stderr')
            if raw_stderr:
                output += raw_stderr
            if 'stdout' in raw:
                output += raw['stdout']

        forceRefresh = False
        self._fileStatusSvc.updateStatusForUris(files, forceRefresh)
        return output

#    sync -- Synchronize the client with its view of the depot
#
#    p4 sync [ -f -n ] [ file[revRange] ... ]
#
#        Sync updates the client workspace to reflect its current view (if
#        it has changed) and the current contents of the depot (if it has
#        changed).  The client view is used to map client file names to
#        depot file names and vice versa.
#
#        Sync adds files that are in the client view but which have not been
#        retrieved before.  Sync deletes previously retrieved files which
#        are no longer in the client view or have been deleted from the
#        depot.  Sync updates files which are still in the client view and
#        which have been updated in the depot.
#
#        Normally, sync affects all files in the client workspace.  If file
#        arguments are given, sync limits its operation to those files.
#        The file arguments may contain wildcards.
#
#        If the file argument includes a revision specifier, then the given
#        revision is retrieved.  Normally, the head revision is retrieved.
#        See 'p4 help revisions' for help specifying revisions.
#
#        If the file argument includes a revision range specification, then
#        only files selected by the revision range are updated, and the
#        highest revision in the range is used.
#
#        Normally, sync will not clobber files in the client workspace that
#        the user has made writable.  Setting the 'clobber' option in the
#        client spec disables this safety check.
#
#        The -f flag forces resynchronization even if the client already
#        has the file, and clobbers writable files.  This flag doesn't affect
#        open files.
    def _do_update(self, files, options, scc_handler=None):
        _files = groupFilesByDirectory(files)
        output = ''
        for basedir in _files.keys():
            result, raw = scc_handler.sync(_files[basedir], _raw=1, cwd=basedir)
            if 'stderr' in raw:
                output += raw['stderr']
            if 'stdout' in raw:
                output += raw['stdout']
            
            #XXX need to deal with this
            ## build a better status output for komodo
            #if 'files' in result:
            #    for file in result['files']:
            #        localFileName = os.path.normpath(os.path.join(basedir,file['file']))
            #        url = uriparse.localPathToURI(localFileName)
            #        #print "%s %s %s" %(file['status'],file['file'],url)
            #        output += "%s %s %s\n" % (file['status'],file['file'],url)
            #output = ""
                    
        forceRefresh = False
        self._fileStatusSvc.updateStatusForUris(files, forceRefresh)
        return output

#    revert -- Discard changes from an opened file
#
#    p4 revert [ -a -c changelist# ] file ...
#
#        Revert an open file back to the revision previously synced from
#        the depot, discarding any pending changelists or integrations that
#        have been made.  This command requires naming files explicitly.
#        After running revert the named files will no longer be locked
#        or open.
#
#        The -a flag tells 'p4 revert' to revert only those files which
#        are opened for edit or integrate and are unchanged or missing.
#        Files with pending integration records are left open.  With the
#        -a flag, the file arguments are optional.
#
#        The -c flag limits 'p4 revert' to files opened under the given,
#        pending changelist.
    def _do_revert(self, files, options, scc_handler=None):
        # XXX unfortunately this function requires knowledge of
        # item properties
        _files = groupFilesByDirectory(files)
        output = ''
        for basedir in _files.keys():
            result, raw = scc_handler.revert(_files[basedir], _raw=1, cwd=basedir)
            if 'stderr' in raw:
                output += raw['stderr']
            if 'stdout' in raw:
                output += raw['stdout']
            
        forceRefresh = False
        self._fileStatusSvc.updateStatusForUris(files, forceRefresh)
        return output

    def _do_edit(self, files, scc_handler=None):
        # XXX unfortunately this function requires knowledge of
        # item properties
        _files = groupFilesByDirectory(files)
        output = ''
        for basedir in _files.keys():
            result, raw = scc_handler.edit(_files[basedir], _raw=1, cwd=basedir)
            if 'stderr' in raw:
                output += raw['stderr']
            if 'stdout' in raw:
                output += raw['stdout']

        forceRefresh = False
        self._fileStatusSvc.updateStatusForUris(files, forceRefresh)
        return output

    def _do_status(self, files, recursive, options, scc_handler=None):
        sccStatusItems = []
        _files = groupFilesByDirectory(files)
        for basedir, files in _files.items():
            if not files or files == ['./...']:
                # use the current directory then
                if recursive:
                    files = ["..."]
                else:
                    files = ["*"]

            # We use 'fstat' instead of 'opened' to retrieve more information,
            # so we can also get the additional out of sync status.
            p4fstat = scc_handler.fstat(files, cwd=basedir, limit_to_files_opened=True)

            # Check for other error cases
            if not p4fstat:
                log.debug("No %s info returned", self.name)
                continue
            if 'stderr' in p4fstat:
                log.debug("Stderr status on %r: %r:",
                          basedir, p4fstat.get('stderr'))
                # XXX - What to do with the error...
                # We get errors here about which path we are examing !?!?
                # So, we are just ignoring the stderr messages...
                #print "%s: Error: %s" % (self.name, p4fstat['stderr'])
                pass

            #print "%s: got %d files" % (self.name, len(p4fstat['files']))

            if not basedir.endswith(os.sep):
                basedir += os.sep

            #print "Got status for %d files" % (len(p4fstat))

            for sccInfo in p4fstat:
                #from pprint import pprint
                #pprint (sccInfo, indent=2)
                #print
                koSccStatus = None

                needSync = sccInfo['haveRev'] != sccInfo['headRev']
                statusText = sccInfo['action']
                if statusText == 'conflict':
                    koSccStatus = components.interfaces.koISCC.STATUS_CONFLICT
                elif statusText == 'delete':
                    koSccStatus = components.interfaces.koISCC.STATUS_DELETED
                elif statusText in ('add', 'branch'):
                    koSccStatus = components.interfaces.koISCC.STATUS_ADDED
                elif statusText in ('edit', 'integrate'):
                    koSccStatus = components.interfaces.koISCC.STATUS_MODIFIED

                if koSccStatus:
                    fileStatusItem = koSCCFileStatusItem()
                    # Path is given as the full local file path:
                    #   C:\\myrepo\\path\\file.txt
                    #   /myrepo/path/file.txt
                    fpath = sccInfo['path']
                    fileStatusItem.relativePath = fpath.replace(basedir, "")
                    fileStatusItem.uriSpec = uriparse.localPathToURI(fpath)
                    fileStatusItem.status = koSccStatus
                    if needSync:
                        fileStatusItem.isOutOfSync = True
                    sccStatusItems.append(fileStatusItem)
        return sccStatusItems



from fileStatusUtils import KoSCCChecker

class KoP4FileChecker(KoSCCChecker):
    name = 'p4'
    _reg_clsid_ = "{31900ece-3bb6-4973-ad70-8b0f4ba36902}"
    _reg_contractid_ = "@activestate.com/koFileStatusChecker?type=p4;1"
    _reg_desc_ = "Komodo Perforce File Status Checker"
    _reg_categories_ = [
         ("category-komodo-file-status",      "p4"),
         ]

    ranking_weight = 65

    def __init__(self):
        KoSCCChecker.__init__(self)
        #self.log.setLevel(logging.DEBUG)
        self.p4 = p4lib.P4()
        self.enabledPrefName = 'p4Enabled'
        self.executablePrefName = 'p4Executable'
        self.backgroundEnabledPrefName = 'p4BackgroundCheck'
        self.backgroundDurationPrefName = 'p4BackgroundMinutes'
        self.recursivePrefName = 'p4Recursive'
        self.setExecutable(self.svc.executable)

    # Overriding parent setExecutable
    def setExecutable(self, executable):
        KoSCCChecker.setExecutable(self, executable)
        if not self.executable or not os.path.exists(self.executable):
            if self._is_windows:
                self.executable = "p4.exe"
            else:
                self.executable = "p4"

    def _cacheSCCInfo(self, cache, cache_key, path, sccInfo):
        # It's important that the cached scc info contains exactly the same
        # keys as the 'koIFileEx.scc' object.
        koSccInfo = self.baseFileSCCInfo.copy()

        koSccInfo['sccType'] =  self.name
        koSccInfo['sccDirType'] = self.name
        koSccInfo['sccLocalRevision'] = str(sccInfo['haveRev'])
        koSccInfo['sccDepotRevision'] = str(sccInfo['headRev'])
        koSccInfo['sccNeedSync'] = int(koSccInfo['sccLocalRevision'] != koSccInfo['sccDepotRevision'])
        koSccInfo['sccConflict'] = 0
        # necessary for status icons
        if koSccInfo['sccNeedSync']:
            koSccInfo['sccStatus'] = 'out of date'
            koSccInfo['sccSync'] = 1
        else:
            koSccInfo['sccStatus'] = 'up to date'
            koSccInfo['sccOk'] = 1
        koSccInfo['sccAction'] = sccInfo['action']
        koSccInfo['sccChange'] = sccInfo['change']

        cache[cache_key] = koSccInfo

    def updateSCCInfo(self, cache, dir_nsUri, reason):
        # we use nbasepath for the directory key and basepath for running cmds
        self.p4.p4 = self.executable
        # execute p4 on the path
        if self.recursive:
            subpath = "..."
        else:
            subpath = "*"
        try:
            # We don't have any cached info and we haven't check this path yet,
            # so we do that now
            #print "p4 checking ",basepath + subpath
            path = uriparse.URIToLocalPath(dir_nsUri.spec)
            p4fstat = self.p4.fstat(subpath, cwd=path)
        except p4lib.P4LibError, e:
            # Don't notify errors for paths that are not under SCC
            if str(e).find("is not under client's root") == -1:
                self.notifyError('Perforce status error, click for details', e)
            return False

        if not p4fstat:
            self.log.debug("No p4 info returned")
            return False
        
        # Cache all the file scc information
        dir_cache_key = self._norm_uri_cache_key(dir_nsUri.spec)
        for fileinfo in p4fstat:
            # Path is given as the full local file path:
            #   C:\\myrepo\\path\\file.txt
            #   \\\\myUNCpath\\path\\file.txt
            #   /myrepo/path/file.txt
            fpath = fileinfo['path']
            cache_key = self._norm_uri_cache_key(uriparse.localPathToURI(fpath))

            if self.recursive:
                parent_cache_key = os.path.dirname(cache_key)
                # Ensure it's compatible with nsURI.
                if parent_cache_key != dir_cache_key:
                    self._lastChecked[parent_cache_key] = time.time()
            
            self._cacheSCCInfo(cache, cache_key, fpath, fileinfo)
        
        fpath = uriparse.URIToLocalPath(dir_nsUri.spec)
        # The above only tracks files, we need to account for folders also
        if os.path.isdir(fpath):
            dirs = None
            try:
                dirs = self.p4.dirs(fpath)
            except p4lib.P4LibError, e:
                log.debug("p4 dirs failed")
                log.debug(e)
                pass
            else:
                allDirs = [fpath]
                for relativePath in dirs:
                    name = os.path.basename(relativePath)
                    path = os.path.join(fpath, name)
                    allDirs.append(path)
                
                for dirPath in allDirs:
                    # Perforce fstat doesn't include directories, so we have to manually include them
                    cache_key = self._norm_uri_cache_key(uriparse.localPathToURI(dirPath))
                    self._cacheSCCInfo(cache, cache_key, dirPath, {
                        'haveRev': '?',
                        'headRev': '?',
                        'action': '',
                        'change': ''
                    })
                

        return True
