#!python
# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
import sys
import re
import time

import svnlib
import uriparse
import koprocessutils
from koSCCBase import KoSCCBase, PathHelperMixin, splitFile, groupFilesByDirectory
from koAsyncOperationUtils import koAsyncOperationBase

from xpcom import components
from xpcom.server import UnwrapObject

from koSCCHistoryItem import koSCCHistoryItem
from koSCCFileStatus import koSCCFileStatusItem

import logging
log = logging.getLogger('koSVN')
#log.setLevel(logging.DEBUG)

#---- globals
WHITESPACE = '\t\n\x0b\x0c\r '  # don't use string.whitespace (bug 81316)
    
    
#---- support routines

##
# This cmdln.line2argv code is a direct copy from the cmdln module. It is
# copied because cmdln is not included by default in the python-sitelib.
#
def cmdln_line2argv(line):
    r"""Parse the given line into an argument vector.
    
        "line" is the line of input to parse.

    This may get niggly when dealing with quoting and escaping. The
    current state of this parsing may not be completely thorough/correct
    in this respect.
    
    >>> from cmdln import line2argv
    >>> line2argv("foo")
    ['foo']
    >>> line2argv("foo bar")
    ['foo', 'bar']
    >>> line2argv("foo bar ")
    ['foo', 'bar']
    >>> line2argv(" foo bar")
    ['foo', 'bar']

    Quote handling:
    
    >>> line2argv("'foo bar'")
    ['foo bar']
    >>> line2argv('"foo bar"')
    ['foo bar']
    >>> line2argv(r'"foo\"bar"')
    ['foo"bar']
    >>> line2argv("'foo bar' spam")
    ['foo bar', 'spam']
    >>> line2argv("'foo 'bar spam")
    ['foo bar', 'spam']
    >>> line2argv("'foo")
    Traceback (most recent call last):
        ...
    ValueError: command line is not terminated: unfinished single-quoted segment
    >>> line2argv('"foo')
    Traceback (most recent call last):
        ...
    ValueError: command line is not terminated: unfinished double-quoted segment
    >>> line2argv('some\tsimple\ttests')
    ['some', 'simple', 'tests']
    >>> line2argv('a "more complex" test')
    ['a', 'more complex', 'test']
    >>> line2argv('a more="complex test of " quotes')
    ['a', 'more=complex test of ', 'quotes']
    >>> line2argv('a more" complex test of " quotes')
    ['a', 'more complex test of ', 'quotes']
    >>> line2argv('an "embedded \\"quote\\""')
    ['an', 'embedded "quote"']
    """
    line = line.strip()
    argv = []
    state = "default"
    arg = None  # the current argument being parsed
    i = -1
    while 1:
        i += 1
        if i >= len(line): break
        ch = line[i]

        if ch == "\\": # escaped char always added to arg, regardless of state
            if arg is None: arg = ""
            i += 1
            arg += line[i]
            continue

        if state == "single-quoted":
            if ch == "'":
                state = "default"
            else:
                arg += ch
        elif state == "double-quoted":
            if ch == '"':
                state = "default"
            else:
                arg += ch
        elif state == "default":
            if ch == '"':
                if arg is None: arg = ""
                state = "double-quoted"
            elif ch == "'":
                if arg is None: arg = ""
                state = "single-quoted"
            elif ch in WHITESPACE:
                if arg is not None:
                    argv.append(arg)
                arg = None
            else:
                if arg is None: arg = ""
                arg += ch
    if arg is not None:
        argv.append(arg)
    if state != "default":
        raise ValueError("command line is not terminated: unfinished %s "
                         "segment" % state)
    return argv

# similar to cmdln.line2argv, but we keep quotes around arguments
def line2argv_keep_quoting(line):
    line = line.strip()
    argv = []
    state = "default"
    arg = None  # the current argument being parsed
    i = -1
    while 1:
        i += 1
        if i >= len(line): break
        ch = line[i]
        
        if ch == "\\": # escaped char always added to arg, regardless of state
            if arg is None: arg = ""
            i += 1
            arg += line[i]
            continue
        
        if state == "single-quoted":
            if ch == "'":
                state = "default"
            arg += ch
        elif state == "double-quoted":
            if ch == '"':
                state = "default"
            arg += ch
        elif state == "default":
            if ch == '"':
                if arg is None: arg = ""
                state = "double-quoted"
                arg += ch
            elif ch == "'":
                if arg is None: arg = ""
                state = "single-quoted"
                arg += ch
            elif ch in WHITESPACE:
                if arg is not None:
                    argv.append(arg)
                arg = None
            else:
                if arg is None: arg = ""
                arg += ch
    if arg is not None:
        argv.append(arg)
    if state != "default":
        raise ValueError("command line is not terminated: unfinished %s "
                         "segment" % state)
    return argv

def _argvFromString(options):
    options = line2argv_keep_quoting(options)
    argv = {}
    last = None
    for o in options:
        if o[0]=='-':
            last = str(o.replace('-','_'))
            if last[0] == '_': last = last[1:]
            if last[0] == '_': last = last[1:]
            argv[last]=1
        elif last:
            argv[last] = o
    return argv

#---- component implementation

class KoSVN(KoSCCBase):
    # Satisfy koISCC.name
    name = "svn"
    # XPCOM component registration settings.
    _com_interfaces_ = [components.interfaces.koISCC, components.interfaces.nsIObserver]
    _reg_desc_ = "Komodo SVN Support"
    _reg_contractid_ = "@activestate.com/koSCC?type=" + name + ";1"
    _reg_clsid_ = "{25651630-86b7-40f5-8cad-594fd668978c}"
    _reg_categories_ = [
         ("category-komodo-scc", name),
         ]

    # Override koSCCBase class settings.
    executableBaseName = "svn"
    executablePrefName = "svnExecutable"
    supports_stoppable_commands = True

    def __init__(self):
        KoSCCBase.__init__(self)
        # A generic svnlib instance to do work with.
        self.svn = svnlib.SVN()

    def upgradePrefs(self):
        if not self._globalPrefs.hasBooleanPref('svn_uses_externaldiff'):
            self._globalPrefs.setBooleanPref('svn_uses_externaldiff', False)

    def create_new_scc_handler(self):
        scc_handler = svnlib.SVN()
        # Ensure the instance uses the same executable as the git service.
        scc_handler.svn = self.get_executable()
        return scc_handler

    _re_checkout_data = re.compile(r"^(%s\s+)?(co\s+|checkout\s+)?(.*?)(\s+.*)?$" % (name, ));

    def getValue(self, name, data, scc_handler=None):
        if not scc_handler:
            scc_handler = self.create_new_scc_handler()
            
        if name == "supports_command":
            if data in ("add", "checkout", "commit", "diff", "history",
                        "remove", "revert", "status", "update"):
                return "Yes"
            return ""
        elif name == "external_diff":
            if self._globalPrefs.getBooleanPref('svn_uses_externaldiff'):
                return "1"
            return ""
        elif name == "cmdline_arg_for_diff_revision":
            return "--revision %s" % (data, )
        elif name == "supports_checkout_url":
            return data.find(self.name) >= 0 and "Yes" or ""
        elif name == "get_checkout_command_line":
            import json
            try:
                json_dict = json.loads(data)
            except:
                return ""
            else:
                repo_url = json_dict.get("repositoryURL")
                repo_split = repo_url.split(":")
                if len(repo_split) >= 2:
                    match = self._re_checkout_data.match(repo_url)
                if match:
                    location_url = json_dict.get("locationURL", "")
                    location_path = uriparse.URIToLocalPath(location_url)
                    return "%s checkout %s %s %s" % (self.get_executable(),
                                                  json_dict.get("options", ""),
                                                  match.groups()[2],
                                                  location_path)

        elif name == "repository_root":
            repodir = self._do_getRoot(data, scc_handler=scc_handler)
            return repodir

        return ""
    
    def _do_getRoot(self, fileuri, scc_handler=None):
        filepath = uriparse.URIToLocalPath(fileuri)
        return scc_handler.workingDirectory(filepath)

    # Regex used to update the "Index: xyz..." to have a full path reference
    diffUpdatePathRegex = re.compile("^Index:\s+(.*)$", re.MULTILINE)

#    diff -- Display diff of client file with depot file
    def _do_diff(self, files, raw_options, external, scc_handler=None):
        #print "svn diff ",repr(files)
        basedir, relpaths = self.getCommonBaseAndRelativePathsFromURIs(files)
        #print "files %r basedir %r" %(files, basedir)
        if not relpaths:
            # Diff is on the folder itself.
            relpaths.append(".")

        return self._do_diff_relative(basedir, relpaths, raw_options,
                                      external, scc_handler=scc_handler)

#    diffRelative -- Display diff of client files against their original.
    def _do_diff_relative(self, baseURI, relpaths, raw_options, external, scc_handler=None):
        #print "svn diff ",repr(files)
        basedir = uriparse.URIToLocalPath(baseURI)

        # convert options into a dictionary
        options = {'env': self._env}
        options['raw_options'] = cmdln_line2argv(raw_options)
        diff = ''
        result, raw = scc_handler.diff(relpaths,
                               _raw=1,
                               cwd=basedir,
                               **options)
        raw_stdout = raw.get('stdout')
        raw_stderr = raw.get('stderr')
        if raw_stderr and not raw_stdout:
            raise svnlib.SVNLibError(raw_stderr)
        if raw_stdout:
            # Convert the diff result (unicode and eol conversion).
            raw_stdout = self.convertDiffResult(raw_stdout)

            replaceStr = "Index: %s%s" % (os.path.abspath(basedir), os.sep)
            # Need to escape all the backslashes (Notably on Windows). See bug:
            # http://bugs.activestate.com/show_bug.cgi?id=65911
            if sys.platform.startswith("win"):
                # Git on Windows uses "/" as path separator, Komodo wants
                # the path in the Windows format, using the "\" separator.
                # http://bugs.activestate.com/show_bug.cgi?id=80288
                def replaceFn(match):
                    return "%s%s" % (replaceStr, match.group(1).replace("/", "\\"))
                diff = self.diffUpdatePathRegex.sub(replaceFn, raw_stdout)
            else:
                replaceStr = replaceStr.replace("\\", "\\\\") + r"\1"
                diff = self.diffUpdatePathRegex.sub(replaceStr, raw_stdout)

        # XXX - Do something with errors?
        return self.convertDiffResult(diff)

    # Diff two revisions of the given file
    def diffRevisions(self, fileuri1, rev1, fileuri2, rev2, localfilepath,
                      options, external, async_callback):
        #print "svn diffRevisions ", repr(fileuri1), rev1, rev2
        revOptions = []
        if rev1:
            if rev2:
                revOptions.append("--revision %s:%s" % (rev1, rev2))
            else:
                revOptions.append("--revision %s" % (rev1))
        elif rev2:
            revOptions.append("--revision %s" % (rev2))
        revOptions = " ".join(revOptions)
        if options:
            options += " %s" % (revOptions)
        else:
            options = revOptions
        #print "options:", options
        return self.diff([fileuri1], options, external, async_callback)

#    log -- List revision history of file
#
    def _do_history(self, fileuri, options, limit, scc_handler=None):
        #print "svn log ", options, repr(fileuri)
        basedir, filename = splitFile(fileuri)
        # XXX - perhaps use cmdln_line2argv here?
        options = _argvFromString(options)
        if 'env' not in options:
            options['env'] = self._env

        result, raw = scc_handler.log(filename,
                              _raw=1,
                              cwd=basedir,
                              limit=limit,
                              **options)
        if result is None:
            raise svnlib.SVNLibError("No history results were found.")

        rawerror = raw.get('stderr', "")
        if rawerror:
            # There was some type of error
            raise svnlib.SVNLibError(rawerror)

        # result:
        # Returns a list of hits. Each hit is a dict with the following:
        # keys: 'revision', 'date', 'author', 'message'.
        # Now, split up the history rows

        koHistoryList = []
        encodingSvc = UnwrapObject(self._encodingSvc)
        #print result
        for revision in result:
            koHistory = koSCCHistoryItem()
            koHistory.version = str(revision['revision'])
            author, encoding, bom = encodingSvc.getUnicodeEncodedStringUsingOSDefault(revision['author'])
            koHistory.author  = author
            koHistory.date    = revision['date']
            koHistory.action  = ''  # No action given
            message, encoding, bom = encodingSvc.getUnicodeEncodedStringUsingOSDefault(revision['message'])
            koHistory.message = message
            koHistory.uri     = fileuri
            koHistoryList.append(koHistory)
        return koHistoryList

#    add -- Open a new file to add it to the depot
    def _do_add(self, files, mode, message, scc_handler=None):
        #add(self, files, mode=None, msg=None, cwd=None)
        # first we figure out what repositories files are in
        # and split them up into seperate lists
        _files = groupFilesByDirectory(files, splitDirectories=True)

        output = ''
        for basedir in _files.keys():
            result, raw = scc_handler.add(files=_files[basedir],
                                  _raw=1, cwd=basedir,
                                  env=self._env)
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
    def _do_commit(self, files, message, options, scc_handler=None):
        #print "svn commit ",repr(files)
        # svnlib saves message to a message for file
        msgfile = self._fileSvc.makeTempFile('.svn','w')
        # Ensure the message is encoded to utf-8 and that we also tell the svn
        # command line client that it's encoded as utf-8.
        # http://bugs.activestate.com/show_bug.cgi?id=71464
        # XXX - Can this encode() call ever fail? Possibly, but it will raise
        #       an XPCOM exception in that case which is caught by the handler.
        msgfile.puts(message.encode("utf-8"))
        msgfile.flush()
        msgfile.close()
        msgpath = msgfile.path
        try:
            _files = self.normalizeFiles(files)
            basedir, relpaths = self.getCommonBaseAndRelativePathsFromURIs(_files)
            if not relpaths:
                # Work on the base folder itself.
                relpaths.append(".")
            output = ''
            result, raw = scc_handler.commit(relpaths,
                                     file=msgpath,
                                     _raw=1,
                                     cwd=basedir,
                                     non_interactive=0,
                                     encoding="utf-8",
                                     env=self._env)

            forceRefresh = False
            self._fileStatusSvc.updateStatusForUris(files, forceRefresh)

            raw_stderr = raw.get('stderr')
            if raw_stderr:
                output += raw_stderr
            if 'stdout' in raw:
                stdout = raw['stdout']
                if stdout:
                    output += stdout
                    rev = re.match(r"Committed revision (\d+).",
                                   stdout.splitlines()[-1])
                    if rev:
                        bag = components.classes["@mozilla.org/hash-property-bag;1"].\
                                createInstance(components.interfaces.nsIWritablePropertyBag2)
                        bag.setPropertyAsAString("text", output)
                        bag.setPropertyAsAString("extra",
                                                 " as revision %s" % (rev.group(1),))
                        return bag

            return output
        finally:
            del msgfile

#    delete -- Open an existing file to delete it from the depot
    def _do_remove(self, files, force, recursive, scc_handler=None):
        _files = groupFilesByDirectory(files, splitDirectories=True)

        output = ''
        for basedir in _files.keys():
            result, raw = scc_handler.delete(_files[basedir],
                                     _raw=1,
                                     cwd=basedir,
                                     env=self._env)
            raw_stderr = raw.get('stderr')
            if raw_stderr:
                output += raw_stderr
            if 'stdout' in raw:
                output += raw['stdout']

        forceRefresh = False
        self._fileStatusSvc.updateStatusForUris(files, forceRefresh)
        return output

#    sync -- Synchronize the client with its view of the depot
    def _do_update(self, files, options, scc_handler=None):
        _files = groupFilesByDirectory(files)

        output = ''
        for basedir in _files.keys():
            result, raw = scc_handler.update(_files[basedir],
                                     _raw=1,
                                     cwd=basedir,
                                     env=self._env)
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
    def _do_revert(self, files, options, scc_handler=None):
        # XXX unfortunately this function requires knowledge of
        # item properties
        _files = groupFilesByDirectory(files)

        output = ''
        for basedir in _files.keys():
            result, raw = scc_handler.revert(_files[basedir], _raw=1,
                                     cwd=basedir,
                                     env=self._env)
            if 'stderr' in raw:
                output += raw['stderr']
            if 'stdout' in raw:
                output += raw['stdout']
            
        forceRefresh = False
        self._fileStatusSvc.updateStatusForUris(files, forceRefresh)
        return output

    def _do_edit(self, files, scc_handler=None):
        return None

    def _do_status(self, files, recursive, options, scc_handler=None):

        _files = self.normalizeFiles(files)
        basedir, relpaths = self.getCommonBaseAndRelativePathsFromURIs(_files)
        if not relpaths:
            # Work on the base folder itself.
            relpaths.append(".")
        statusOptions = {'cwd': basedir,
                         'non_recursive': not recursive,
                         'verbose': 0,
                         'show_updates': 1,
                         'env': self._env}
        stat, raw = scc_handler.status(relpaths,
                               _raw=1,
                               **statusOptions)
        #print "stat: %r" % (stat, )
        #print "raw: %r" % (raw, )
        raw_stderr = raw.get('stderr')
        if raw_stderr:
            raise svnlib.SVNLibError(raw_stderr)
        result = []

        # Fix up our reference paths to make it easier to manage below.
        basedirUri = uriparse.localPathToURI(basedir)
        if not basedirUri.endswith("/"):
            basedirUri += '/'
        if not basedir.endswith(os.sep):
            basedir += os.sep

        for stat_info in stat:
            # stat_info will be a dict with the following keys:
            #    History, Locked, Modified, Path, Status, Switched
            status_string = stat_info.get('Status')
            modified_string = stat_info.get('Modified')
            #print "stat_info['Path']: %r" % (stat_info['Path'], )
            #print "status_string: %r" % (status_string, )
            #print "modified_string: %r" % (modified_string, )
            #print ""
            if (status_string and status_string in "MADCR") or \
               (modified_string and modified_string in 'MC'):
                status = components.interfaces.koISCC.STATUS_UNKNOWN
                if status_string == 'C' or modified_string == 'C':
                    status = components.interfaces.koISCC.STATUS_CONFLICT
                elif status_string == 'M':
                    status = components.interfaces.koISCC.STATUS_MODIFIED
                elif status_string == 'A':
                    status = components.interfaces.koISCC.STATUS_ADDED
                elif status_string == 'D':
                    status = components.interfaces.koISCC.STATUS_DELETED
                elif status_string == 'R':
                    status = components.interfaces.koISCC.STATUS_REPLACED
                elif modified_string == 'M':
                    status = components.interfaces.koISCC.STATUS_MODIFIED_PROPERTY
                fileStatusItem = koSCCFileStatusItem()
                filepath = stat_info['Path']
                    # Note: The stat_info['Path'] field is usually an absolute
                    #       path when using svn.
                if os.path.isabs(filepath):
                    fileStatusItem.relativePath = filepath.replace(basedir, "")
                    fileStatusItem.uriSpec = uriparse.localPathToURI(filepath);
                else:
                    fileStatusItem.relativePath = filepath
                    fileStatusItem.uriSpec = basedirUri + filepath.replace("\\", "/")
                fileStatusItem.status = status
                if stat_info.get('Sync') == '*':
                    fileStatusItem.isOutOfSync = True
                result.append(fileStatusItem)
        return result


#    checkout -- Perform a svn checkout.
    def _do_checkout(self, repositoryURL, locationURL, options,
                     terminalHandler=None, scc_handler=None):
        output = ''
        location_path = uriparse.URIToLocalPath(locationURL)
        result, raw = scc_handler.checkout(repositoryURL,
                                   location_path,
                                   command_options=options,
                                   terminalHandler=UnwrapObject(terminalHandler),
                                   _raw=1,
                                   env=self._env)
        if 'stderr' in raw:
            output += raw['stderr']
        if 'stdout' in raw:
            output += raw['stdout']
        return output

#    cat -- Perform an svn cat
    def _do_cat(self, baseNameAsArray, cwd, options, scc_handler=None):
        result, raw = scc_handler.cat(baseNameAsArray,
                                      terminalHandler=None,
                                      _raw=1,
                                      cwd=cwd,
                                      env=self._env)
        return raw['stdout']


from fileStatusUtils import KoSCCChecker

class KoSVNFileChecker(KoSCCChecker, PathHelperMixin):
    name = 'svn'
    _reg_clsid_ = "{1951db1d-f9b2-4133-8e90-147f8a3d097e}"
    _reg_contractid_ = "@activestate.com/koFileStatusChecker?type=svn;1"
    _reg_desc_ = "Komodo Subversion File Status Checker"
    _reg_categories_ = [
         ("category-komodo-file-status",      "svn"),
         ]

    ranking_weight = 30

    def __init__(self):
        KoSCCChecker.__init__(self)
        PathHelperMixin.__init__(self)
        #self.log.setLevel(logging.DEBUG)
        self.svn = svnlib.SVN()
        self.enabledPrefName = 'svnEnabled'
        self.executablePrefName = 'svnExecutable'
        self.backgroundEnabledPrefName = 'svnBackgroundCheck'
        self.backgroundDurationPrefName = 'svnBackgroundMinutes'
        self.recursivePrefName = None
        # Subversion 1.3 can have "_svn" directories, so we check for this
        # http://subversion.tigris.org/svn_1.3_releasenotes.html#_svn-hack
        if self._is_windows and "SVN_ASP_DOT_NET_HACK" in os.environ:
            self._svnDirName = "_svn"
        else:
            self._svnDirName = ".svn"
        self.setExecutable(self.svc.executable)
        #self.log.setLevel(logging.DEBUG)

    def setExecutable(self, executable):
        KoSCCChecker.setExecutable(self, executable)
        self.svn.svn = self.executable

    def _stripEmptyLines(self, message):
        _result = []
        for line in message.splitlines(0):
            if line:
                _result.append(line)
        return '\n'.join(_result) + "\n"

    def _cacheSCCInfo(self, cache, cache_key, path, sccInfo):
        # It's important that the cached scc info contains exactly the same
        # keys as the 'koIFileEx.scc' object.
        koSccInfo = self.baseFileSCCInfo.copy()

        #{'History': ' ',
        # 'Last_Changed_Rev': '350',
        # 'Locked': ' ',
        # 'Name': 'asdf.txt',
        # 'URL': 'file',
        # 'Last Changed Date': '2004-12-07 14',
        # 'Switched': ' ',
        # 'Modified': ' ',
        # 'Repository UUID': 'a66e1112-37ea-0310-b8af-fdbad1884ccd',
        # 'reserved1': ' ',
        # 'Revision': '350',
        # 'Status': 'M',
        # 'reserved2': ' ',
        # 'Last_Changed_Author': 'shanec',
        # 'Schedule': 'normal',
        # 'Node Kind': 'file',
        # 'Sync': ' ',
        # 'Last Changed Author': 'shanec',
        # 'Checksum': 'a5890ace30a3e84d9118196c161aeec2',
        # 'Path': 'test1/asdf.txt',
        # 'Last Changed Rev': '350',
        # 'Text Last Updated': '2004-12-07 14'}
        
        koSccInfo['sccType'] = self.name
        koSccInfo['sccDirType'] = self.name
        koSccInfo['sccLocalRevision'] = '?'
        if 'Last Changed Rev' in sccInfo:
            koSccInfo['sccLocalRevision'] = sccInfo['Last Changed Rev']
            
        koSccInfo['sccRevdate'] = '?'
        if 'Last Changed Date' in sccInfo:
            koSccInfo['sccRevdate'] = sccInfo['Last Changed Date']
            
        koSccInfo['sccDepotRevision'] = '?'
        if 'Revision' in sccInfo:
            koSccInfo['sccDepotRevision'] = sccInfo['Revision']
        
        needSync = ('Sync' in sccInfo and sccInfo['Sync'] == '*')
        koSccInfo['sccNeedSync'] = '%d' % needSync
        koSccInfo['sccSync'] = koSccInfo['sccNeedSync']
        koSccInfo['sccOk'] = '%d' % (not needSync)
        koSccInfo['sccConflict'] = 0
        koSccInfo['sccAction'] = ''
        koSccInfo['sccStatus'] = 'ok'
        koSccInfo['sccChange'] = ''

        if 'Status' in sccInfo:
            koSccInfo['sccAction'] = koSccInfo['sccStatus'] = svnlib.actionNames[sccInfo['Status']]
            koSccInfo['sccConflict'] = int(koSccInfo['sccAction'] == 'conflict')
        # handle add/delete of a sccInfo so it can be commited
        if 'Schedule' in sccInfo and sccInfo['Schedule'] != 'normal':
            koSccInfo['sccAction'] = sccInfo['Schedule']

        cache[cache_key] = koSccInfo

    def directoryExists(self, path):
        return os.path.isdir(path)

    def getSvnStatus(self, path, reason):
        env = koprocessutils.getUserEnv()
        # execute subversion on the path
        show_updates = (reason == self.REASON_FORCED_CHECK)
        if show_updates:
            self.log.debug("%s: Contacting server for update-to-date info",
                           self.name)
        return self.svn.statusEx("", # On the directory itself
                                 cwd=path,
                                 non_recursive=1, # for "svn status" command
                                 recursive=0,     # for "svn info" command
                                 verbose=1,
                                 show_updates=show_updates,
                                 _raw=1,
                                 env=env)

    def updateSCCInfo(self, cache, dir_nsUri, reason):
        # Check that the necessary ".svn" file exists
        if self._is_nsURI_UNC(dir_nsUri):
            return False
        path = uriparse.URIToLocalPath(dir_nsUri.spec)

        repo_path = self._cached_repodir_from_path.get(path)
        if repo_path is None:
            # Walk up the directory chain until we find a ".svn" directory. We
            # also need the real path, otherwise svn inside symlinked folders
            # will fail to work - bug 96306.
            path = os.path.realpath(path)
            repo_path = self.getParentDirContainingDirname(self._svnDirName,
                                                           path)
            # Cache it so we don't need to do this check again.
            self._cached_repodir_from_path[path] = repo_path
        if not repo_path:
            return False

        # Svn can generate errors as well as results in the one call, we grab
        # all errors and put them in here.
        _errors = []

        # We don't have any cached info and we haven't check this path yet,
        # so we do that now
        self.svn._svn = self.executable
        try:
            result, out = self.getSvnStatus(path, reason)
        except svnlib.SVNLibError, e:
            # we get an exception here if the svn library call errors out
            error_message = e.args[0] or ""
            if "Could not display info for all targets" in error_message:
                # This means we tried to run "svn info" in a directory that is
                # not under svn control (error given in subversion 1.7), so we
                # filter out this particular error.
                return False
            if "not a working copy" in error_message:
                # This means we tried to run "svn info" in a directory that is
                # not under svn control (error given in subversion 1.6), so we
                # filter out this particular error.
                return False
            self.notifyError('Svn status error, click for details', e)
            return False

        # The out parameter of svn statusEx is a tuple containing the output
        # from the info command and also the output from the status command.
        # out == (info_output, status_output)
        for out_type in out:
            if out_type and 'stderr' in out_type and out_type['stderr']:
                _errors.append(self._stripEmptyLines(out_type['stderr']))

        #print repr(result)
        #print "got %d files" % (len(result))

        if result:
            # Cache all the file scc information
            lenPrePath = len(dir_nsUri.prePath)
            for fname, fileinfo in result.items():
                try:
                    # Path is given as the relative local file path from
                    # the directory where the command was executed.
                    #   path\\file.txt
                    #   path/file.txt
                    cache_key = dir_nsUri.resolve(fileinfo['Path'].encode("utf-8")).rstrip("/")
                    cache_key = self._norm_uri_cache_key(cache_key)
                    fpath = cache_key[lenPrePath:]
                    self._cacheSCCInfo(cache, cache_key, fpath, fileinfo)
                except KeyError, e:
                    self.log.info("Can't find fileinfo['Path'] in file %r", fname)
                    pass
        elif _errors:
            self.notifyError('Svn status error, click for details',
                             "".join(_errors))
            return False

        return True
