#!python
# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
import sys
import re
import time
import logging

import cvslib
import uriparse
import process
import koprocessutils
from koSCCBase import KoSCCBase, PathHelperMixin, splitFile, groupFilesByDirectory
from koAsyncOperationUtils import koAsyncOperationBase

from xpcom import components
from xpcom.server import UnwrapObject

from koSCCHistoryItem import koSCCHistoryItem
from koSCCFileStatus import koSCCFileStatusItem

log = logging.getLogger('koCVS')
#log.setLevel(logging.DEBUG)

class KoCVS(KoSCCBase):
    # Satisfy koISCC.name
    name = "cvs"
    # XPCOM component registration settings.
    _com_interfaces_ = [components.interfaces.koISCC, components.interfaces.nsIObserver]
    _reg_desc_ = "Komodo CVS Support"
    _reg_contractid_ = "@activestate.com/koSCC?type=" + name + ";1"
    _reg_clsid_ = "{CE39F3D2-7103-493f-8A77-EBD15071CD57}"
    _reg_categories_ = [
         ("category-komodo-scc", name),
         ]

    # Override koSCCBase class settings.
    executableBaseName = "cvs"
    executablePrefName = "cvsExecutable"
    supports_stoppable_commands = True

    def __init__(self):
        KoSCCBase.__init__(self)
        # A generic cvslib instance to do work with.
        self.cvs = cvslib.CVS()

    def upgradePrefs(self):
        if not self._globalPrefs.hasBooleanPref('cvs_uses_externaldiff'):
            self._globalPrefs.setBooleanPref('cvs_uses_externaldiff', False)

    def create_new_scc_handler(self):
        scc_handler = cvslib.CVS()
        # Ensure the instance uses the same executable as the git service.
        scc_handler._cvs = self.get_executable()
        return scc_handler

    def getValue(self, name, data, scc_handler=None):
        if not scc_handler:
            scc_handler = self.create_new_scc_handler()
            
        if name == "supports_command":
            if data in ("add", "checkout", "commit", "diff", "history",
                        "remove", "revert", "status", "update"):
                return "Yes"
            return ""
        elif name == "external_diff":
            if self._globalPrefs.getBooleanPref('cvs_uses_externaldiff'):
                return "1"
            return ""
        elif name == "cmdline_arg_for_diff_revision":
            return "-r %s" % (data, )
        elif name == "supports_checkout_url":
            return data.find(self.name) >= 0 and "Yes" or ""
        elif name == "get_checkout_command_line":
            import json
            try:
                json_dict = json.loads(data)
            except:
                return ""
            else:
                options = json_dict.get("options", "")
                module_names, rev, date, export = self._processCheckoutArgumentsFromOptions(options)
                options_argv = []
                if rev:
                    options_argv += ['-r', rev]
                if date:
                    options_argv += ['-D', date]
                repo_url = json_dict.get("repositoryURL")
                location_url = json_dict.get("locationURL", "")
                location_path = uriparse.URIToLocalPath(location_url)
                basename = os.path.basename(location_path)
                return "%s -d %s %s %s -d %s %s" % (self.get_executable(),
                                              repo_url,
                                              export and "export" or "checkout",
                                              " ".join(options_argv),
                                              basename,
                                              " ".join(module_names))
        elif name == "repository_root":
            env = koprocessutils.getUserEnv()
            repodir = self._do_getRoot(data, scc_handler=scc_handler)
            return repodir
        
        return ""

    # Regex used to update the "Index: xyz..." to have a full path reference
    diffUpdatePathRegex = re.compile("^Index: ", re.MULTILINE)
    
    def _do_getRoot(self, fileuri, scc_handler=None):
        filepath = uriparse.URIToLocalPath(fileuri)
        return scc_handler._getRootDirectory(cwd=filepath)

    def _do_cat(self, baseNameAsArray, cwd, options, scc_handler=None):
        # Need to insert the repository root to each member in baseNameAsArray
        # If the file isn't there, just throw the IOError exception.
        # The caller is handling exceptions anyway.
        fd = open(os.path.join(cwd, "CVS", "Repository"), 'r')
        repositoryRoot = fd.readline().strip()
        fd.close()
        fixedNames = [os.path.join(repositoryRoot, name)
                      for name in baseNameAsArray]
        return scc_handler.checkout(fixedNames,
                                    terminalHandler=None,
                                    print_=True,
                                    cwd=cwd)['stdout']

#    cvs diff [-lNR] [rcsdiff-options]
#    [[-r rev1 | -D date1] [-r rev2 | -D date2]] [files...] 
#	-l	Local directory only, not recursive
#	-R	Process directories recursively.
#	-D d1	Diff revision for date against working file.
#	-D d2	Diff rev1/date1 against date2.
#	-N	include diffs for added and removed files.
#	-r rev1	Diff revision for rev1 against working file.
#	-r rev2	Diff rev1/date1 against rev2.
#	--ifdef=arg	Output diffs in ifdef format.
    def _do_diff(self, files, options, external, scc_handler=None):
        #print "cvs diff ",repr(files)

        basedir, relpaths = self.getCommonBaseAndRelativePathsFromURIs(files)
        #print "files %r basedir %r" %(files, basedir)
        if not relpaths:
            # Diff is on the folder itself.
            relpaths.append(".")

        return self._do_diff_relative(basedir, relpaths, options,
                                      external, scc_handler=scc_handler)

    def _do_diff_relative(self, baseURI, relpaths, options, external, scc_handler=None):
        """Display diff of the client files relative to the base directory."""

        basedir = uriparse.URIToLocalPath(baseURI)

        result = scc_handler.diff(files=relpaths,
                                  cwd=basedir,
                                  diffOpts=options.split())

        raw_stdout = result.get('stdout')
        raw_stderr = result.get('stderr')
        if raw_stderr and not raw_stdout:
            raise cvslib.CVSLibError(raw_stderr)
        # elif raw_stderr:
            # Else, we got diff results and stderr results, we need to log
            # the stderr messages in the SCC output panel.
            # XXX - How? Return an additional warnings argument?
            #       This would break the ko.scc.diff code, so post 4.3.0
            #       for this SCC output panel logging change.

        diff = raw_stdout
        if diff:
            # Convert the diff result (unicode and eol conversion).
            diff = self.convertDiffResult(diff)
            replaceStr = "Index: %s%s" % (os.path.abspath(basedir), os.sep)
            replaceStr = replaceStr.replace("\\", "\\\\")
            diff = self.diffUpdatePathRegex.sub(replaceStr, diff)

        return diff

    # Diff two revisions of the given file
    def diffRevisions(self, fileuri1, rev1, fileuri2, rev2, localfilepath,
                      options, external, async_callback):
        #print "cvs diffRevisions ", repr(fileuri1), rev1, repr(fileuri2), rev2
        revOptions = []
        for revision in (rev1, rev2):
            if revision:
                revOptions.append("-r %s" %(revision))
        revOptions = " ".join(revOptions)
        if options:
            options += " %s" % (revOptions)
        else:
            options = revOptions
        return self.diff([fileuri1], options, external, async_callback)

#    Usage: cvs log [-lRhtNb] [-r[revisions]] [-d dates] [-s states]
#        [-w[logins]] [files...]
#            -l      Local directory only, no recursion.
#            -R      Only print name of RCS file.
#            -h      Only print header.
#            -t      Only print header and descriptive text.
#            -N      Do not list tags.
#            -S      Do not print name/header if no revisions selected.
#            -b      Only list revisions on the default branch.
#            -r[revisions]   A comma-separated list of revisions to print:
#               rev1:rev2   Between rev1 and rev2, including rev1 and rev2.
#               rev1::rev2  Between rev1 and rev2, excluding rev1.
#               rev:        rev and following revisions on the same branch.
#               rev::       After rev on the same branch.
#               :rev        rev and previous revisions on the same branch.
#               ::rev       rev and previous revisions on the same branch.
#               rev         Just rev.
#               branch      All revisions on the branch.
#               branch.     The last revision on the branch.
#            -d dates        A semicolon-separated list of dates
#                            (D1<D2 for range, D for latest before).
#            -s states       Only list revisions with specified states.
#            -w[logins]      Only list revisions checked in by specified logins.
    # Example output:
    #
    #C:\src\komodo\tests\scc\CVS\pyDes>cvs log README.txt
    #
    #RCS file: /cvsroot/pydes/pyDes/README.txt,v
    #Working file: README.txt
    #head: 1.2
    #branch:
    #locks: strict
    #access list:
    #symbolic names:
    #keyword substitution: kv
    #total revisions: 2;     selected revisions: 2
    #description:
    #----------------------------
    #revision 1.2
    #date: 2005/09/13 17:25:46;  author: twhiteman;  state: Exp;  lines: +3 -3
    #Version 1.2 - Fix Triple DES CCB mode.
    #----------------------------
    #revision 1.1
    #date: 2005/08/29 17:37:01;  author: twhiteman;  state: Exp;
    #Initial creation.
    #=============================================================================

    #re_log_head = re.compile(
    #        r'''RCS file:\s*(?P<repository_file>.*?)[\r\n]*?'''\
    #         '''Working file:\s*(?P<local_file>.*?)[\r\n]*?'''\
    #         '''head:\s*(?P<head>.*?)[\r\n]*?'''\
    #         '''branch:\s*(?P<branch>.*?)[\r\n]*?'''\
    #         '''locks:\s*(?P<locks>.*?)[\r\n]*?'''\
    #         '''access list:\s*(?P<access_list>.*?)[\r\n]*?'''\
    #         '''symbolic names:\s*(?P<symbolic_names>.*?)[\r\n]*?'''\
    #         '''keyword substitution:\s*(?P<keyword_substitution>.*?)[\r\n]*?'''\
    #         '''total revisions: \s*(?P<total_revisions>.*?);\s*selected revisions:\s*(?P<selected_revisions>.*?)[\r\n]*?'''\
    #         '''description:\s*[\r\n]*?'''
    #)
    re_log_revisions    = re.compile(
        r'''----------------------------\s*[\r\n]*'''\
        '''revision\s+(?P<revision>.*?)[\r\n]*'''\
        '''date: \s*(?P<date>.*?);\s*author:\s*(?P<author>.*?);\s*state:\s*(?P<state>.*?).*[\r\n]*'''
    )

    def _do_history(self, fileuri, options, limit, scc_handler=None):
        #print "cvs log ", options, repr(fileuri)
        try:
            basedir, filename = splitFile(fileuri)
            if not filename:
                filename = "."
            result = scc_handler.log(files=[filename], cwd=basedir)
            rawerror = result.get('stderr', "")
            
            # Disabled stderr detection because CVS likes to push meaningless stderr
            # messages and we're not doing anything with the exception anyway
            #if rawerror and rawerror.find("Empty password used") == -1:
                # There was some type of error
            #    raise cvslib.CVSLibError(rawerror)
    
            output = result['stdout']
    
            #headMatch = self.re_log_head.search(output)
            #if not headMatch:
            #    rawerror = "Could not parse cvs log message"
            #    self.lastErrorSvc.setLastError(0, rawerror)
            #    #print "stderr:", rawerror
            #    return None
    
            # Now, split up the history rows
            #
            koHistoryList = []
            encodingSvc = UnwrapObject(self._encodingSvc)
            #revisionsText = output[headMatch.end():]
            revisionsText = output
            matchIterator = self.re_log_revisions.finditer(revisionsText)
            try:
                match = matchIterator.next()
            except StopIteration:
                match = None
            count = 0
            while match:
                koHistory = koSCCHistoryItem()
                koHistory.version = match.group('revision')
                author, encoding, bom = encodingSvc.getUnicodeEncodedString(match.group('author'))
                koHistory.author  = author
                koHistory.date    = match.group('date')
                koHistory.action  = match.group('state')
                koHistory.uri     = fileuri
                text_start = match.end()
                try:
                    match = matchIterator.next()
                except StopIteration:
                    match = None
                message = ''
                if match:
                    message = revisionsText[text_start:match.start()]
                else:
                    leftOverText = revisionsText[text_start:]
                    message = leftOverText
                    
                message = message.split("=============================================================================")[0]
                # Set the history message
                try:
                    koHistory.message = message
                except UnicodeDecodeError:
                    # Try encoding it with komodo's unicode encoding service
                    try:
                        buffer, encoding, bom = encodingSvc.getUnicodeEncodedString(message)
                        koHistory.message = buffer
                    except Exception, e:
                        # No go, show that there is something wrong then
                        koHistory.message = "Komodo: Encoding error: Could not interpret the history message"
                koHistoryList.append(koHistory)
                
                # Cvs doesnt support limiting the results, so limit them manually
                count = count + 1
                if limit > 0 and count == limit:
                    match = None
        except Exception as e:
            log.exception(e)
        return koHistoryList

#    cvs add [-k rcs-kflag] [-m message] files...
#	-k	Use "rcs-kflag" to add the file with the specified kflag.
#	-m	Use "message" for the creation log.
    def _do_add(self, files, mode, message, scc_handler=None):
        #add(self, files, mode=None, msg=None, cwd=None)
        _files = groupFilesByDirectory(files, splitDirectories=True)

        output = ''
        for basedir in _files.keys():
            result = scc_handler.add(files=_files[basedir],
                             mode=mode,
                             msg=message,
                             cwd=basedir)
            if 'stderr' in result:
                output += result['stderr']
            if 'stdout' in result:
                output += result['stdout']
            
        # do notification that status may have changed
        # we have to use the original urls passed in since
        # they are modified to local paths in _splitFiles
        forceRefresh = False
        self._fileStatusSvc.updateStatusForUris(files, forceRefresh)
        return output

#    cvs commit [-nRlf] [-m msg | -F logfile] [-r rev] files...
#	-n	Do not run the module program (if any).
#	-R	Process directories recursively.
#	-l	Local directory only (not recursive).
#	-f	Force the file to be committed; disables recursion.
#	-F file	Read the log message from file.
#	-m msg	Log message.
#	-r rev	Commit to this branch or trunk revision.
    def _do_commit(self, files, message, options, scc_handler=None):
        #print "cvs commit ",repr(files)
        # save the message to a temp file
        msgfile = self._fileSvc.makeTempFile('.cvs','w')
        msgfile.puts(message)
        msgfile.flush()
        msgfile.close()
        msgpath = msgfile.path

        _files = groupFilesByDirectory(files)

        output = ''
        for basedir in _files.keys():
            #print "commit files [%s] :%s" % (basedir,repr(_files[basedir]))
            result = scc_handler.commit(_files[basedir],msgFile=msgpath,cwd=basedir)
            #print repr(result)
            raw_stderr = result.get('stderr')
            if raw_stderr:
                output += raw_stderr
            if 'stdout' in result:
                output += result['stdout']
        
        del msgfile
        
        forceRefresh = False
        self._fileStatusSvc.updateStatusForUris(files, forceRefresh)
        return output

#    cvs remove [-flR] [files...]
#	-f	Delete the file before removing it.
#	-l	Process this directory only (not recursive).
#	-R	Process directories recursively.
    def _do_remove(self, files, force, recursive, scc_handler=None):
        _files = groupFilesByDirectory(files)
        output = ''

        for basedir in _files.keys():
            result = scc_handler.remove(_files[basedir], force, recursive,cwd=basedir)
            raw_stderr = result.get('stderr')
            if raw_stderr:
                output += raw_stderr
            if 'stdout' in result:
                output += result['stdout']

        forceRefresh = False
        self._fileStatusSvc.updateStatusForUris(files, forceRefresh)
        return output

#    cvs update [-APdflRp] [-k kopt] [-r rev|-D date] [-j rev]
#    [-I ign] [-W spec] [files...]
#	-A	Reset any sticky tags/date/kopts.
#	-P	Prune empty directories.
#	-d	Build directories, like checkout does.
#	-f	Force a head revision match if tag/date not found.
#	-l	Local directory only, no recursion.
#	-R	Process directories recursively.
#	-p	Send updates to standard output (avoids stickiness).
#	-k kopt	Use RCS kopt -k option on checkout.
#	-r rev	Update using specified revision/tag (is sticky).
#	-D date	Set date to update from (is sticky).
#	-j rev	Merge in changes made between current revision and rev.
#	-I ign	More files to ignore (! to reset).
#	-W spec	Wrappers specification line.
    def _do_update(self, files, options, scc_handler=None):
        _files = groupFilesByDirectory(files)
        output = ''

        for basedir in _files.keys():
            result = scc_handler.update(_files[basedir],cwd=basedir)
            raw_stderr = result.get('stderr')
            if raw_stderr:
                output += raw_stderr
            # build a better status output for komodo
            if 'files' in result:
                for file in result['files']:
                    localFileName = os.path.normpath(os.path.join(basedir,file['file']))
                    url = uriparse.localPathToURI(localFileName)
                    #print "%s %s %s" %(file['status'],file['file'],url)
                    output += "%s %s %s\n" % (file['status'],file['file'],url)

        forceRefresh = False
        self._fileStatusSvc.updateStatusForUris(files, forceRefresh)
        return output

    def _do_revert(self, files, options, scc_handler=None):
        # XXX unfortunately this function requires knowledge of
        # item properties
        output = ''
        for file in files:
            kofile = self._fileSvc.getFileFromURI(file)
            basedir,filename = splitFile(file)
            #print "attempting to revert file ",file
            if kofile and kofile.sccAction:
                # we are edit, delete or sync
                if kofile.sccAction == 'edit':
                    result = scc_handler.unedit(files=filename,cwd=basedir)
                    result = scc_handler.update(files=filename,clean=1,cwd=basedir)
                elif kofile.sccAction == 'delete':
                    #print "adding deleted file back into cvs"
                    result = scc_handler.add(files=filename,cwd=basedir)
                else:
                    #print "doing CLEAN update"
                    result = scc_handler.update(files=filename,clean=1,cwd=basedir)
                if 'stderr' in result:
                    output += result['stderr']
                if 'stdout' in result:
                    output += result['stdout']
        forceRefresh = False
        self._fileStatusSvc.updateStatusForUris(files, forceRefresh)
        return output

    def _do_edit(self, files, scc_handler=None):
        # XXX unfortunately this function requires knowledge of
        # item properties
        _files = groupFilesByDirectory(files)
        output = ''
        for basedir in _files.keys():
            result = scc_handler.edit(_files[basedir], cwd=basedir)
            if 'stderr' in result:
                output += result['stderr']
            if 'stdout' in result:
                output += result['stdout']

        forceRefresh = False
        self._fileStatusSvc.updateStatusForUris(files, forceRefresh)
        return output

    def _do_status(self, files, recursive, options, scc_handler=None):
        sccStatusItems = []

        _files = groupFilesByDirectory(files)
        for basedir, files in _files.items():
            if not files:
                files = ["."]  # use the current directory then
            cvsStatus = scc_handler.status(files, recursive=recursive, cwd=basedir)

            # Check for other error cases
            if not cvsStatus:
                log.debug("No %s info returned", self.name)
                continue
            if 'stderr' in cvsStatus and cvsStatus.get('stderr'):
                log.debug("Stderr status on %r: %r:",
                          basedir, cvsStatus.get('stderr'))
                # XXX - What to do with the error...
                # We get errors here about which path we are examing !?!?
                # So, we are just ignoring the stderr messages...
                #print "%s: Error: %s" % (self.name, cvsStatus['stderr'])
                pass

            #print "%s: got %d files" % (self.name, len(cvsStatus['files']))

            if not basedir.endswith(os.sep):
                basedir += os.sep

            #print "Got status for %d files" % (len(cvsStatus['files']))

            for sccinfo in cvsStatus['files']:
                #from pprint import pprint
                #pprint (sccinfo, indent=2)
                #print
                koSccStatus = None
                statusText = sccinfo['status']
                needSync = sccinfo['rev'] != sccinfo['rrev']
                if statusText.find('conflict') >= 0:
                    koSccStatus = components.interfaces.koISCC.STATUS_CONFLICT
                # XXX - Do we need an out-of-date status?
                elif statusText.find('Removed') >= 0 or \
                     (sccinfo['rev'] and \
                      (sccinfo['rev'] == '0' or \
                       sccinfo['rev'].startswith('-'))):
                    koSccStatus = components.interfaces.koISCC.STATUS_DELETED
                elif statusText.find('Added') >= 0 or \
                     (sccinfo['revdate'] and sccinfo['revdate'] == 'New File!'):
                    koSccStatus = components.interfaces.koISCC.STATUS_ADDED
                elif sccinfo['edit'] or \
                     (not needSync and statusText != 'Up-to-date'):
                    koSccStatus = components.interfaces.koISCC.STATUS_MODIFIED

                if koSccStatus:
                    fileStatusItem = koSCCFileStatusItem()
                    # Path is given as the full local file path:
                    #   C:\\myrepo\\path\\file.txt
                    #   /myrepo/path/file.txt
                    fpath = sccinfo['path']
                    fileStatusItem.relativePath = fpath.replace(basedir, "")
                    fileStatusItem.uriSpec = uriparse.localPathToURI(fpath)
                    fileStatusItem.status = koSccStatus
                    if needSync:
                        fileStatusItem.isOutOfSync = True
                    sccStatusItems.append(fileStatusItem)
        return sccStatusItems

    def _processCheckoutArgumentsFromOptions(self, options):
        module_names = []
        rev = None
        date = None
        export = False

        import getopt
        args = getopt.getopt(options.split(), "r:D:", ["module=", "export"])
        if args and len(args) > 1:
            args = args[0]
            for arg, value in args:
                #print "arg: %r" % (arg, )
                #print "value: %r" % (value, )
                if arg == "--module":
                    module_names.append(value)
                elif arg == "--export":
                    export = True
                elif arg == "-r":
                    rev = value
                elif arg == "-D":
                    date = value
        return module_names, rev, date, export

#    checkout -- Perform a cvs checkout.
    def _do_checkout(self, cvsroot, locationURL, options,
                     terminalHandler=None, scc_handler=None):
        # The options string should include the module name, we need to parse
        # that and any other options for the cvslib.checkout call.
        module_names, rev, date, export = self._processCheckoutArgumentsFromOptions(options)
        #print "module_names: %r" % (module_names, )

        basedir, leafname = splitFile(locationURL)
        result = scc_handler.checkout(module_names,
                                   cwd=basedir,
                                   dir=leafname,
                                   date=date,
                                   rev=rev,
                                   export=export,
                                   cvsroot=cvsroot,
                                   terminalHandler=UnwrapObject(terminalHandler))
        return result.get('stderr', '') + result.get('stdout', '')


from fileStatusUtils import KoSCCChecker

class KoCVSFileChecker(KoSCCChecker):
    name = 'cvs'
    _reg_clsid_ = "{a7524f92-5b18-4697-b2c5-4061372dda21}"
    _reg_contractid_ = "@activestate.com/koFileStatusChecker?type=cvs;1"
    _reg_desc_ = "Komodo CVS File Status Checker"
    _reg_categories_ = [
         ("category-komodo-file-status",      "cvs"),
         ]

    ranking_weight = 80

    def __init__(self):
        KoSCCChecker.__init__(self)
        #import logging
        #self.log.setLevel(logging.DEBUG)
        self.cvs = cvslib.CVS()
        self.enabledPrefName = 'cvsEnabled'
        self.executablePrefName = 'cvsExecutable'
        self.backgroundEnabledPrefName = 'cvsBackgroundCheck'
        self.backgroundDurationPrefName = 'cvsBackgroundMinutes'
        self.recursivePrefName = 'cvsRecursive'
        self.setExecutable(self.svc.executable)

    # Overriding parent setExecutable
    def setExecutable(self, executable):
        if executable:
            self.executable = executable
        else:
            self.executable = 'cvs'

    def _raiseCVSError(self, msg):
        # since we have no way to know if this is
        # informational or not, we have to parse for
        # what we want to know
        if msg.find('authorization failed') > -1:
            raise cvslib.CVSLibError(msg)
    
    def _cacheSCCInfo(self, cache, cache_key, fpath, sccInfo):
        # It's important that the cached scc info contains exactly the same
        # keys as the 'koIFileEx.scc' object.
        koSccInfo = self.baseFileSCCInfo.copy()

        koSccInfo['sccType'] =  self.name
        koSccInfo['sccDirType'] = self.name
        koSccInfo['sccLocalRevision'] = sccInfo['rev']
        koSccInfo['sccRevdate'] = sccInfo['revdate']
        koSccInfo['sccDepotRevision'] = sccInfo['rrev']
        koSccInfo['sccNeedSync'] = int(koSccInfo['sccLocalRevision'] != koSccInfo['sccDepotRevision'])
        koSccInfo['sccConflict'] = 0
        koSccInfo['sccAction'] = ''
        koSccInfo['sccStatus'] = sccInfo['status']
        koSccInfo['sccChange'] = ''

        # this is independent of sync status
        if koSccInfo['sccStatus'].find('conflict') >= 0:
            koSccInfo['sccConflict'] = 1

        # necessary for status icons
        if koSccInfo['sccNeedSync']:
            koSccInfo['sccSync'] = 1
        else:
            koSccInfo['sccOk'] = 1

        if (koSccInfo['sccLocalRevision'] and \
           (koSccInfo['sccLocalRevision'] == '0' or \
            koSccInfo['sccLocalRevision'][0] == '-')) or \
           koSccInfo['sccStatus'].find('Removed') >= 0:
            koSccInfo['sccAction'] = 'delete'
        elif (koSccInfo['sccRevdate'] and koSccInfo['sccRevdate'] == 'New File!') or \
            koSccInfo['sccStatus'].find('Added') >= 0:
            koSccInfo['sccAction'] = 'add'
        elif not koSccInfo['sccNeedSync'] and koSccInfo['sccStatus'] != 'Up-to-date':
            koSccInfo['sccAction'] = 'edit'
        elif sccInfo['edit']:
            koSccInfo['sccAction'] = 'edit'

        cache[cache_key] = koSccInfo

    def updateSCCInfo(self, cache, dir_nsUri, reason):
        # Check that the necessary "CVS/Repository" file exists
        if self._is_nsURI_UNC(dir_nsUri):
            return False
        dir_path = uriparse.URIToLocalPath(dir_nsUri.spec)
        cvsRepositoryFile = os.path.join(dir_path, 'CVS', 'Repository')
        if not os.path.exists(cvsRepositoryFile):
            return False

        # We don't have any cached info and we haven't check this path yet,
        # so we do that now
        self.cvs._cvs = self.executable
        try:
            # execute cvs on the path
            cvsStatus = self.cvs.status(cwd=dir_path,
                                        recursive=self.recursive)
        except cvslib.CVSLibError, e:
            # We get an exception here if the cvs library call errors out.
            self.notifyError('CVS status error, click for details', e)
            return False

        # Check for other error cases
        if not cvsStatus:
            self.log.debug("No %s info returned", self.name)
            return False
        if 'stderr' in cvsStatus:
            # We get errors here about which path we are examing !?!?
            # So, we are just ignoring the stderr messages...
            #print "%s: Error: %s" % (self.name, cvsStatus['stderr'])
            pass

        #print "%s: got %d files" % (self.name, len(cvsStatus['files']))
        #from pprint import pprint
        #pprint (cvsStatus)


        # Cache all the file scc information
        dir_cache_key = self._norm_uri_cache_key(dir_nsUri.spec)
        for sccinfo in cvsStatus['files']:
            # Path is given as the full local file path:
            #   C:\\myrepo\\path\\file.txt
            #   /myrepo/path/file.txt
            fpath = sccinfo['path']
            cache_key = self._norm_uri_cache_key(uriparse.localPathToURI(fpath))
            if self.recursive:
                # Check the paths, we may need to update for a different dir
                parent_cache_key = os.path.dirname(cache_key)
                # Ensure it's compatible with nsURI.
                parent_cache_key += "/"
                if parent_cache_key != dir_cache_key:
                    self._lastChecked[parent_cache_key] = time.time()
            self._cacheSCCInfo(cache, cache_key, fpath, sccinfo)

        return True
