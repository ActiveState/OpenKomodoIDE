#!python
# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import sys
import os
import string
import re, urllib
import urlparse, mimetools, mimetypes
import threading
import tempfile

import process
import uriparse
from invocationutils import PrefException, checkFileExists, \
        environmentStringsToDict, environmentDictToStrings

import runutils
import base64
import uuid
import logging

from xpcom import components, ServerException, COMException, nsError

from zope.cachedescriptors.property import Lazy as LazyProperty
from zope.cachedescriptors.property import LazyClassAttribute

#---- globals

log = logging.getLogger("koInvokeInterpreters")
#log.setLevel(logging.DEBUG)

Cc = components.classes
Ci = components.interfaces

INVOKE_RUN = Ci.koIInvocation.INVOKE_RUN
INVOKE_DEBUG = Ci.koIInvocation.INVOKE_DEBUG
INVOKE_BUILD = Ci.koIInvocation.INVOKE_BUILD
INVOKE_INTERACTIVE = Ci.koIInvocation.INVOKE_INTERACTIVE
INVOKE_PROFILE = Ci.koIInvocation.INVOKE_PROFILE

invoke_names = {
    INVOKE_RUN: "Run without Debugging",
    INVOKE_DEBUG: "Debugging",
    INVOKE_BUILD: "Build/Make",
    INVOKE_INTERACTIVE: "Interactive Shell",
    INVOKE_PROFILE: "Profiling",
}

#---- support routines

def _escapeArg(arg):
    """Escape the given command line argument for the shell."""
    return arg.replace('"', r'\"')

def _joinArgv(argv):
    r"""Join an arglist to a string appropriate for running.

        >>> import os
        >>> _joinArgv(['foo', 'bar "baz'])
        'foo "bar \\"baz"'
    """
    cmdstr = ""
    specialChars = [';', ' ', '=']
    for arg in argv:
        if arg == '':
            cmdstr += '""'
        else:
            for ch in specialChars:
                if ch in arg:
                    cmdstr += '"%s"' % _escapeArg(arg)
                    break
            else:
                cmdstr += _escapeArg(arg)
        cmdstr += ' '
    if cmdstr.endswith(' '): cmdstr = cmdstr[:-1]  # strip trailing space
    return cmdstr

def _line2argv(line):
    r"""Parse the given line into an argument vector.

        "line" is the line of input to parse.

    This may get niggly when dealing with quoting and escaping. The
    current state of this parsing may not be completely thorough/correct
    in this respect.

    >>> _line2argv("foo")
    ['foo']
    >>> _line2argv("foo bar")
    ['foo', 'bar']
    >>> _line2argv("foo bar ")
    ['foo', 'bar']
    >>> _line2argv(" foo bar")
    ['foo', 'bar']
    >>> _line2argv("'foo bar'")
    ['foo bar']
    >>> _line2argv('"foo bar"')
    ['foo bar']
    >>> _line2argv(r'"foo\"bar"')
    ['foo"bar']
    >>> _line2argv("'foo bar' spam")
    ['foo bar', 'spam']
    >>> _line2argv("'foo 'bar spam")
    ['foo bar', 'spam']
    >>> _line2argv('some\tsimple\ttests')
    ['some', 'simple', 'tests']
    >>> _line2argv('a "more complex" test')
    ['a', 'more complex', 'test']
    >>> _line2argv('a more="complex test of " quotes')
    ['a', 'more=complex test of ', 'quotes']
    >>> _line2argv('a more" complex test of " quotes')
    ['a', 'more complex test of ', 'quotes']
    >>> _line2argv('an "embedded \\"quote\\""')
    ['an', 'embedded "quote"']

    # Komodo bug 48027
    >>> _line2argv('foo bar C:\\')
    ['foo', 'bar', 'C:\\']

    # Komodo change 127581
    >>> _line2argv(r'"\test\slash" "foo bar" "foo\"bar"')
    ['\\test\\slash', 'foo bar', 'foo"bar']

    # Komodo change 127629
    >>> if sys.platform == "win32":
    ...     _line2argv(r'\foo\bar') == ['\\foo\\bar']
    ...     _line2argv(r'\\foo\\bar') == ['\\\\foo\\\\bar']
    ...     _line2argv('"foo') == ['foo']
    ... else:
    ...     _line2argv(r'\foo\bar') == ['foobar']
    ...     _line2argv(r'\\foo\\bar') == ['\\foo\\bar']
    ...     try:
    ...         _line2argv('"foo')
    ...     except ValueError, ex:
    ...         "not terminated" in str(ex)
    True
    True
    True
    """
    WHITESPACE = '\t\n\x0b\x0c\r '  # don't use string.whitespace (bug 81298)
    line = line.strip()
    argv = []
    state = "default"
    arg = None  # the current argument being parsed
    i = -1
    while 1:
        i += 1
        if i >= len(line): break
        ch = line[i]

        if ch == "\\" and i+1 < len(line):
            # escaped char always added to arg, regardless of state
            if arg is None: arg = ""
            if (sys.platform == "win32"
                or state in ("double-quoted", "single-quoted")
               ) and line[i+1] not in tuple('"\''):
                arg += ch
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
    if not sys.platform == "win32" and state != "default":
        raise ValueError("command line is not terminated: unfinished %s "
                         "segment" % state)
    return argv



#---- Component implementations

class koInterpreterInvocation(object):

    _com_interfaces_ = Ci.koIInvocation
    profile_fileuri = None

    # Lazily generated class properties.
    @LazyClassAttribute
    def _environUtils(self):
        return Cc["@activestate.com/koEnvironUtils;1"].getService(Ci.koIEnvironUtils)
    @LazyClassAttribute
    def infoSvc(self):
        return Cc["@activestate.com/koInfoService;1"].getService(Ci.koIInfoService)
    @LazyClassAttribute
    def prefService(self):
        return Cc["@activestate.com/koPrefService;1"].getService()
    @LazyClassAttribute
    def komodoVersion(self):
        return self.infoSvc.version

    def __init__(self):
        self.error_no_interpreter = "No %s interpreter is available." % self._invocation_name_
        self.error_no_preferences = "Preferences for debugging %s are not initialized." % self._invocation_name_
        self.error_invocation_not_supported = "Komodo does not support %r %%s." % self._invocation_name_

        self.currentCategoryPrefs = None
        self.currentInstancePrefs = None
        self.invokeType = INVOKE_RUN
        self.name = self._invocation_name_
        self.process = None

        self.stdin = self.stdout = self.stderr = None
        self._usecgi = 0
        self._postData = None

        lastErrorSvc = components.classes["@activestate.com/koLastErrorService;1"]\
                .getService(components.interfaces.koILastErrorService)
        prefs = components.classes["@activestate.com/koPrefService;1"].\
                getService(components.interfaces.koIPrefService).prefs
        koSysUtils = components.classes["@activestate.com/koSysUtils;1"].\
                getService(components.interfaces.koISysUtils)
        if prefs.hasPref("runservice.shell"):
            shell = prefs.getString("runservice.shell")
            shellArgs = prefs.getString("runservice.shell.args", "")
            shellArgs = shellArgs.split("||")
        elif sys.platform.startswith("win"):
            if os.environ.has_key("SHELL"):
                shell = os.environ["SHELL"]
            elif os.environ.has_key("ComSpec"):
                shell = os.environ["ComSpec"]
            else:
                shell = "cmd.exe"
            shellArgs = ["/C"]
        elif sys.platform == "darwin":
            shell = "/bin/sh"
            shellArgs = []
        elif koSysUtils.Which("xterm") != "":
            shell = "xterm"
            shellArgs = ["-e", "/bin/sh"]
        elif koSysUtils.Which("konsole") != "":
            shell = "konsole"
            shellArgs = ["-e"]
        elif koSysUtils.Which("gnome-terminal") != "":
            shell = "gnome-terminal"
            shellArgs = ["-e"]
        else:
            msg = "No supported terminal was found, please install xterm"
            lastErrorSvc.setLastError(0, msg)
            raise Exception(msg)
        self.shellArgs = [shell] + shellArgs

    @LazyProperty
    def effectivePrefs(self):
        effectivePrefs = None
        currentView = Cc["@activestate.com/koViewService;1"].\
                      getService(Ci.koIViewService).currentView
        if currentView:
            try:
                view = currentView.QueryInterface(Ci.koIScintillaView)
                if view:
                    effectivePrefs = view.koDoc.getEffectivePrefs()
            except COMException, e:
                if e.errno != nsError.NS_ERROR_NO_INTERFACE:
                    raise
        if effectivePrefs is None:
            effectivePrefs = self.prefService.effectivePrefs
        return effectivePrefs

    def needsBuild( self ):
        # Result: boolean
        # we never need a separate build process.
        return 0

    def invoke(self, invokeType):
        self.invokeType = invokeType
        self._checkValid(invokeType)
        if invokeType == INVOKE_DEBUG:
            return self._launchForDebug()
        elif invokeType == INVOKE_RUN:
            return self._launchForRun()
        elif invokeType == INVOKE_INTERACTIVE:
            return self._launchForInteractive()
        elif invokeType == INVOKE_PROFILE:
            return self._launchForProfiling()
        else:
            raise ServerException(nsError.NS_ERROR_ILLEGAL_VALUE)

    def get_supportedInvokeTypes(self):
        return INVOKE_DEBUG | INVOKE_RUN | INVOKE_INTERACTIVE

    def _determineExecutable(self):
        return None

    def validInterpreter(self, invokeType):
        # Attempt to locate the executable if none specified.
        if not (invokeType & self.get_supportedInvokeTypes()):
            return 0, "", self.error_invocation_not_supported % invoke_names[invokeType]

        exe = self._determineExecutable()
        if not exe:
            return 0, "", self.error_no_interpreter
        self.currentCategoryPrefs.setStringPref("executable", exe)
        return 1, None, None
        
    def validate(self, invokeType):
        if self.currentInstancePrefs is None or self.currentCategoryPrefs is None:
            return 0, "", self.error_no_preferences

        res = self.validInterpreter(invokeType)
        if not res[0]: return res

        return self._do_validate(invokeType)

    def _checkValid(self, invokeType):
        ok, id, message = self.validate(invokeType)
        if not ok:
            lastErrorSvc = components.classes["@activestate.com/koLastErrorService;1"].\
                    getService(components.interfaces.koILastErrorService)
            lastErrorSvc.setLastError(nsError.NS_ERROR_ILLEGAL_VALUE,
                                      message)
            raise ServerException(nsError.NS_ERROR_ILLEGAL_VALUE, message)

    def terminate(self, exit_code, use_force):
        try:
            self.process.kill()
            return 1
        except COMException:
            pass
        return 0

    def _fillExtraDefaultPreferences(self, cat, inst):
        pass

    @LazyProperty
    def cookie(self):
        return base64.encodestring(uuid.uuid4().bytes).strip()

    def getDefaultPreferences( self ):
        cat = Cc["@activestate.com/koPreferenceRoot;1"].createInstance()
        cat.setStringPref("executable", "") # validate fills this correctly if not done before.

        # we have to get the dynamic port from the listener
        manager = Cc["@activestate.com/koDBGPManager;1"].\
           getService(Ci.koIDBGPManager);
        port = manager.port

        cat.setLongPref("debugger.listener-port", port)

        inst = Cc["@activestate.com/koPreferenceRoot;1"].createInstance()
        inst.setStringPref("executable-params", "") # "Interpreter Arguments" in UI
        inst.setBooleanPref("use-console", 0) # "Debug in separate console"
        inst.setStringPref("filename", "")    # "Script"
        inst.setStringPref("params", "")      # "Script Arguments"
        inst.setStringPref("cwd", "")         # "Directory"
        inst.setBooleanPref("show-dialog", 1) 
        inst.setStringPref("language", self._language) 

        inst.inheritFrom = cat
        self._getSystemEnvironment(cat, inst)
        self._getDefaultCGIPrefs(cat, inst)
        self._fillExtraDefaultPreferences(cat, inst)

        return cat, inst

    def get_currentCategoryPreferences( self ):
        # Result: koIPreferenceSet
        return self.currentCategoryPrefs

    def set_currentCategoryPreferences( self, prefs):
        # Result: void - None
        # In: param0: koIPreferenceSet
        self.currentCategoryPrefs = prefs

    def get_currentInstancePreferences( self ):
        # Result: koIPreferenceSet
        return self.currentInstancePrefs

    def set_currentInstancePreferences( self, prefs):
        # Result: void - None
        # In: param0: koIPreferenceSet
        if prefs.hasStringPref("language") and prefs.getStringPref("language") != self._language:
            raise ServerException(nsError.NS_ERROR_UNEXPECTED, "Invocation Preference language missmatch")
        self.currentInstancePrefs = prefs

    def get_persistableInstancePreferences( self ):
        # Result: koIPreferenceSet
        ret = self.currentInstancePrefs.clone()
        for prefName in ["CGIEnvironment", "systemEnvironment"]:
            if ret.hasPref(prefName):
                ret.deletePref(prefName)
        return ret

    def hookIOForTerminal(self, terminalHandler):
        if self.process:
            # Need to unwrap the terminal handler because we are not actually
            # passing in koIFile xpcom objects, we are using the subprocess
            # python file handles instead.
            self.process.linkIOWithTerminal(terminalHandler)

    def _doLaunch(self, argv, cwd, env):
        showConsole = self.currentInstancePrefs.getBooleanPref('use-console')
        scriptFileName = None
        inputFileName = None
        try:
            if showConsole:
                scriptFileName, inputFileName = self._doLaunchInConsole(argv, cwd, env)
                #self.process = process.Process(argv, cwd, env,
                #                               process.Process.CREATE_NEW_CONSOLE)
            else:
                # if we're doing cgi emulation, we ignore the stdin
                # from the terminal view.  POST data goes out over
                # standard process handles, and NOT over our redirected
                # stdin/socket stuff in koRequesterDebugger.py
                if self._postData and self.stdin:
                    self.stdin = None
                
                self.process = runutils.KoTerminalProcess(argv, cwd=cwd, env=env)
                if self._postData:
                    self.process.write_stdin(self._postData, closeAfterWriting=True)

        except process.ProcessError, ex:
            msg = "Executing '%s' failed: %s\n" % (argv, str(ex))
            log.warn(msg)
            raise ServerException(nsError.NS_ERROR_FILE_EXECUTION_FAILED, msg)

        # The "invocation_terminated" notification is sent when the
        # child terminates.  A separate thread is created to handle that
        # so this call can return immediately.
        t = threading.Thread(target=self._WaitCleanUpAndNotify,
                             kwargs={'scriptFileName': scriptFileName,
                                     'inputFileName': inputFileName})
        t.start()

    def _doLaunchInConsole(self, command, cwd, envDict):
        """Launch the given command string in a new console.
        (NOTE: this is mostly copied from koRunService.Run())

        Optionally an "input" string can be provided. If it is then the
        command is run via "command < input", where the input is placed
        in a temporary file.
        """
        #print "_doLaunchInConsole(command=%r, cwd=%r, env=%r)"\
        #      % (command, cwd, envDict)

        # Keep a pure 'command' for reporting status to the user.
        actualCommand = _joinArgv(command)

        if self._postData:
            # Put the input into a temp file.
            inputFileName = tempfile.mktemp()
            inputFile = open(inputFileName, "w")
            inputFile.write(self._postData)
            inputFile.close()
            if ' ' in inputFileName:
                actualCommand += ' < "%s"' % inputFileName
            else:
                actualCommand += ' < %s' % inputFileName
        else:
            inputFileName = None
            
        scriptFileName = runutils.createConsoleLaunchScript(actualCommand, cwd, envDict)
        actualCommand = self.shellArgs + [scriptFileName]

        #print "RUN: actualCommand is '%s'" % actualCommand
        #print "RUN: -------- %s is as follows -------" % scriptFileName
        #fin = open(scriptFileName, 'r')
        #for line in fin.readlines():
        #    print line,
        #fin.close()
        #print "RUN: ---------------------------------"

        try:
            self.process = process.ProcessOpen(actualCommand, cwd=cwd,
                                               env=envDict,
                                               stdin=None, stdout=None,
                                               stderr=None,
                                               flags=process.CREATE_NEW_CONSOLE)
        except process.ProcessError, ex:
            log.exception(ex)
            raise ServerException(nsError.NS_ERROR_FAILURE, str(ex))
        
        return scriptFileName,inputFileName

    def _WaitCleanUpAndNotify(self, scriptFileName=None,
                                    inputFileName=None):
        """Thread used by _doLaunchInConsole."""
        self.process.wait()

        if scriptFileName:
            try:
                os.unlink(scriptFileName)
            except OSError, ex:
                log.warn("Could not remove temporary script file '%s': %s",
                         scriptFileName, ex)
        if inputFileName:
            try:
                os.unlink(inputFileName)
            except OSError, ex:
                log.warn("Could not remove temporary input file '%s': %s",
                         inputFileName, ex)
        
        # Send appropriate notification.
        #XXX Should eventually pass exitCode out with notification
        @components.ProxyToMainThread
        def mainthread_notify_invocation_terminated(obj):
            observerSvc = Cc["@mozilla.org/observer-service;1"].\
                          getService(Ci.nsIObserverService)
            observerSvc.notifyObservers(obj, "invocation_terminated", None)
        mainthread_notify_invocation_terminated(self)

    def _setPrefEnvironment(self, inst, name, newname = None):
        if not newname: newname = name
        penv = self.effectivePrefs.getStringPref(name)
        # if we have a predefined user environment, sort it first
        if len(penv) > 0:
            penv = string.split(penv, os.linesep)
            penv.sort()
            penv = string.join(penv,os.linesep)
        inst.setStringPref(newname,penv)
        
    def _getSystemEnvironment(self, cat, inst, updaterFunc=None):
        environment = Cc["@activestate.com/koUserEnviron;1"].getService().GetEnvironmentStrings()
        # bug 90631: if the project defines an environment, override any
        # items it defines
        eDict = None
        try:
            currentView = Cc["@activestate.com/koViewService;1"].\
                getService(Ci.koIViewService).currentView
            if currentView:
                try:
                    currentView = currentView.QueryInterface(Ci.koIScintillaView)
                except COMException, ex:
                    if ex.errno != nsError.NS_ERROR_NO_INTERFACE:
                        raise
                    currentView = None
            if currentView:
                effectivePrefs = currentView.koDoc.getEffectivePrefs()
                if effectivePrefs and effectivePrefs.hasPrefHere("userEnvironmentStartupOverride"):
                    envPrefs = effectivePrefs.getStringPref("userEnvironmentStartupOverride")
                    if envPrefs:
                        eDict = environmentStringsToDict(environment)
                        newDict = environmentStringsToDict([x for x in envPrefs.split("\n") if x.strip()])
                        eDict.update(newDict)
            if updaterFunc is not None:
                if eDict is None:
                    eDict = environmentStringsToDict(environment)
                updaterFunc(eDict)
        except:
            log.exception("Error updating environment")
        if eDict is not None:
            finalEnvironment = environmentDictToStrings(eDict)
        else:
            finalEnvironment = environment
        env = "\n".join(sorted(finalEnvironment))
        cat.setStringPref("systemEnvironment", env)
        self._setPrefEnvironment(inst, "userEnvironment")
        
    # CGI emulation support functions
    def _getDefaultCGIPrefs(self, cat, inst):
        inst.setBooleanPref("sim-cgi",0)

        # get the webserver/browser env vars
        self._setPrefEnvironment(cat, "debuggerEnvironment", "CGIEnvironment")
        self._setPrefEnvironment(inst, "userCGIEnvironment")
        
        inst.setStringPref("documentRoot","")
        
        inst.setStringPref("getparams","")
        inst.setStringPref("postparams","")
        inst.setStringPref("posttype","application/x-www-form-urlencoded")
        inst.setStringPref("mpostparams","")
        inst.setStringPref("cookieparams","")
        inst.setStringPref("request-method","GET")
        
    def _getenv(self):
        """Return the merged list of environment strings.
        The merge order is:
            1. the system environment
            2. the default CGI environment
            3. the user environment settings
            4. the user CGI environment settings
        This tries to ensure, as best as possible, that the user's
        settings are used as expected.
        """
        # 1. the system environment
        mergedEnvStrs = self.currentInstancePrefs.getString('systemEnvironment', "")
        mergedEnvStrs = mergedEnvStrs.strip().split("\n")

        # 2. the default CGI environment
        if self._usecgi:
            cgiEnvStrs = self.currentInstancePrefs.getString('CGIEnvironment', "")
            cgiEnvStrs = cgiEnvStrs.strip().split("\n")
            mergedEnvStrs = self._environUtils.MergeEnvironmentStrings(
                mergedEnvStrs, cgiEnvStrs)
            
        # 3. the user environment settings
        userEnvStrs = self.currentInstancePrefs.getString('userEnvironment', "")
        if userEnvStrs:
            userEnvStrs = userEnvStrs.strip().split("\n")
            mergedEnvStrs = self._environUtils.MergeEnvironmentStrings(
                mergedEnvStrs, userEnvStrs)
        
        # 4. the user CGI environment settings
        if self._usecgi:
            userCgiEnvStrs = self.currentInstancePrefs.getString('userCGIEnvironment', "")
            if userCgiEnvStrs:
                userCgiEnvStrs = userCgiEnvStrs.strip().split("\n")
                mergedEnvStrs = self._environUtils.MergeEnvironmentStrings(
                    mergedEnvStrs, userCgiEnvStrs)
            
            # add generated cgi env vars (from GET, POST, and Cookie params)
            httpEnvStrs = ["%s=%s" % item
                           for item in self._build_http_env().items()]
            mergedEnvStrs = self._environUtils.MergeEnvironmentStrings(
                mergedEnvStrs, httpEnvStrs)

        # Invariant:
        #   The MergeEnvironmentStrings() functionality ensures that
        #   there are no env. vars with an empty value.
        # Convert items to plain strings (no Unicode)
        mergedEnvStrs = [str(item) for item in mergedEnvStrs]
        # add komodo version
        mergedEnvStrs.append("KOMODO_VERSION=%s" % self.komodoVersion)
        mergedEnvStrs.append("DBGP_COOKIE=%s" % self.cookie)

        return environmentStringsToDict(mergedEnvStrs)
    
    def _filename_from_url(self, url):
        fn = re.match(r'.*[\/\\]([^\/\\]*)$',url);
        if fn:
            return fn.group(1)
        return ""
        
    def _build_http_env(self):
        self._postData, self._postSize, self._postType = self._build_post_data()
        requestMethod = self.currentInstancePrefs.getStringPref('request-method')
        
        # calculate the document root
        pathTranslated = self.currentInstancePrefs.getStringPref('filename')
        cookieData = self.currentInstancePrefs.getStringPref('cookieparams')
        cookies = self._build_args_list(cookieData, "; ")
        
        # XXX have to do something MUCH better for the doc root!
        scriptName = "/" + self._filename_from_url(pathTranslated)

        env = {}
        env["QUERY_STRING"]=self._build_get_line()
        env["CONTENT_LENGTH"]=self._postSize
        if self._postSize:
            #print "Content size is ",self._postSize
            env["CONTENT_TYPE"]=self._postType
        env["PATH_INFO"]=scriptName #XXX verify this!
        env["PATH_TRANSLATED"]=pathTranslated
        env["SCRIPT_NAME"]=scriptName
        env["SCRIPT_FILENAME"]=pathTranslated
        env["REQUEST_METHOD"]=requestMethod
        env["HTTP_COOKIE"]=cookies
        # build any environment variables we need to emulate the web server environment
        return env
    
    def _build_args_list(self, args, sep="&"):
        argsList = string.split(string.strip(args), "\n")
        return string.join(argsList,sep)
    
    def _build_get_line(self):
        getArgs = self.currentInstancePrefs.getStringPref('getparams')
        return self._build_args_list(getArgs)

    def _build_post_data(self):
        # build the post data that must be sent down stdin to the cgi
        # XXX extremely simplistic mime building going on here

        postArgs = self.currentInstancePrefs.getStringPref('postparams')
        postFiles = self.currentInstancePrefs.getStringPref('mpostparams')
        postType = self.currentInstancePrefs.getStringPref('posttype')
        
        if not postType: postType = "application/x-unknown"
        
        if postType == "application/x-www-form-urlencoded":
            postData = self._build_args_list(postArgs)
        elif postType == "multipart/form-data":
            # handle RFC 1867 data
            out = ""
            # we have to do multpart mime encoding
            boundary = mimetools.choose_boundary()
            # generate the mime headers for regular post variables
            if postArgs:
                argsList = string.split(postArgs, "\n")
                for i in range(len(argsList)):
                    try:
                        key, value = argsList[i].split("=", 1)
                        out += "--"+boundary+"\r\n"
                        out += "Content-Disposition: form-data; name=\"%s\"\r\n\r\n" % (key)
                        out += value+"\r\n"
                    except ValueError:
                        pass
                
            if postFiles:
                fileList = string.split(postFiles, "\n")
                # read each file, encode it, then add it to the return data
                for i in range(len(fileList)):
                    # read each file, base64 encode it, and add to the request
                    if len(fileList[i]) < 3: continue
                    fvar = string.split(fileList[i], "=")
                    fn = urllib.unquote(fvar[1])
                    out += "--"+boundary+"\r\n"
                    out += "Content-Disposition: form-data; name=\"%s\"; filename=\"%s\"\r\n" % (fvar[0], fn)
                    type, encoding = mimetypes.guess_type(fn)
                    if not type: type = "text/plain"
                    out += "Content-Type: %s\r\n" % (type)
                    out += "Content-Transfer-Encoding: binary\r\n\r\n"

                    infile = open(fn, "rb")
                    out += infile.read()
                    infile.close()
                    
            # XXX - not rfc compliant, but works right, should have additional -- at end
            out += "--"+boundary+"\r\n"
            postData = out
            postType = "multipart/form-data; boundary=\"%s\"" % (boundary)
        
        else:
            # support raw post data entered into the post args field
            postData = postArgs
        return postData,len(postData),postType

class koProjectInvocation(koInterpreterInvocation):
    """
    This class is invoked from pref-project-debugging-properties.js,
    just to make an invocation object that we can store prefs on.
    It's never actually debugged.
    """
    # If this object needs to be registered, the following 2 are also needed.
    _language = ""
    _reg_clsid_ = "{25ed901e-4ffe-11db-82f2-000d935d3368}"
    _reg_contractid_ = "@activestate.com/koInvocation;1?type=Project"
    #_reg_registrar_ = RegisterAsInvocation, None

    _invocation_name_ = "Project"
    _invocation_description_ = "Project"

    def validInterpreter(self, invokeType):
        # we dont validate at the project pref level
        return 1, None, None

    def set_currentInstancePreferences( self, prefs):
        # Result: void - None
        # In: param0: koIPreferenceSet
        prefs.setStringPref("language", self._language) 
        self.currentInstancePrefs = prefs

class koPythonCommonInvocation(koInterpreterInvocation):
    _pythonVersion = None
    def __init__(self):
        koInterpreterInvocation.__init__(self)
        try:
            pythonInfo = Cc["@activestate.com/koAppInfoEx?app=%s;1"
                                            % self._language] \
                         .getService(Ci.koIAppInfoEx)
            if pythonInfo.version:
                self._pythonVersion = float(pythonInfo.version)
        except COMException, ex:
            # Usually it's because there is no interpreter found - bug 98499.
            if ex.errno != nsError.NS_ERROR_FILE_NOT_FOUND:
                log.exception("Unable to find a valid Python executable")

    def get_supportedInvokeTypes(self):
        return koInterpreterInvocation.get_supportedInvokeTypes(self) | INVOKE_PROFILE

    def _updatePythonPath(self, env):
        prefset = self.effectivePrefs
        pref_name = "%sExtraPaths" % (self.languageName_lc)
        if prefset.hasPref(pref_name):
            pythonPath = prefset.getStringPref(pref_name)
        else:
            return
        if pythonPath:
            pythonPathEnv = env.get("PYTHONPATH", "")
            if pythonPathEnv:
                pythonPath += os.pathsep + pythonPathEnv
            if sys.platform.startswith("win"):
                pythonPath = string.replace(pythonPath, '\\', '/')
            env['PYTHONPATH'] = pythonPath
        return env

    def _getSystemEnvironment(self, cat, inst):
        koInterpreterInvocation._getSystemEnvironment(self, cat, inst,
                                                      updaterFunc=self._updatePythonPath)

    def _fillExtraDefaultPreferences(self, cat, inst):
        cat.setBooleanPref("unbuffered-handles", 1)

    def _determineExecutable(self):
        pythonExe = self.effectivePrefs.getStringPref("%sDefaultInterpreter" % (self.languageName_lc))
        if not pythonExe:
            registryService = Cc['@activestate.com/koLanguageRegistryService;1'].\
               getService(Ci.koILanguageRegistryService)
            languageService = registryService.getLanguage(self._language);

            pythonExe = languageService.getLanguageService(Ci.koIAppInfoEx).executablePath
        if not pythonExe:
            log.error("No %s interpreter could be found.", self._language)
            return ""
        else:
            return pythonExe

    def _do_validate(self, invokeType):
        try:
            prefset = self.currentInstancePrefs
            checkFileExists(prefset, 'executable', "You must specify the executable used for the debug session")
            if invokeType != INVOKE_INTERACTIVE:
                checkFileExists(prefset, 'filename', "You must specify the main Python script to be used")

            cwd = prefset.getStringPref("cwd")
            if cwd and not os.path.isdir(cwd):
                raise PrefException("cwd", "Directory '%s' does not exist" % cwd)
        except PrefException, exc:
            return 0, exc.prefid, exc.msg
        return 1, None, None

    def _getExecutableArgs(self, executable):
        cmddata = self.currentInstancePrefs.getString('executable-params', "")
        executableArgs = _line2argv(cmddata)
        if '-u' not in executableArgs and \
           os.path.basename(executable).find('jython') == -1 and \
           self.currentInstancePrefs.getBoolean('unbuffered-handles', False):
            executableArgs.append("-u")
        return executableArgs
    
    def _getDBGPClientDriverArgs(self):
        driverArgs = []
        port = self.currentInstancePrefs.getLong("debugger.listener-port", 9000)
        driverArgs.append("-d")
        driverArgs.append("127.0.0.1:%s" % port)
        if self._pythonVersion >= 3.0:
            pyPart = "python3"
        else:
            pyPart = "python"
        logLevel = self.effectivePrefs.getString(pyPart + "_debuggerLogLevel", "")
        driverArgs.append("-l")
        driverArgs.append(logLevel) # one of 'DEBUG', 'WARN', etc.
        if logLevel != "NOTSET":
            logFile = self.effectivePrefs.getString(pyPart + "_debuggerLogPath", "")
            if logFile:
                driverArgs.append("-f")
                driverArgs.append(logFile)
                
        return driverArgs

    def _getDBGPDriverBase(self):
        if self._pythonVersion >= 3.0:
            verPart = "3_"
        else:
            verPart = ""
        if sys.platform == "win32":
            driverBase = "py%sdbgp.py" % (verPart,)
        else:
            driverBase = "py%sdbgp" % (verPart,)
        return driverBase
    
    def _getDBGPClientDriver(self, executable):
        driverBase = self._getDBGPDriverBase()
        driver = os.path.join(os.path.dirname(executable), driverBase)
        if os.path.exists(driver):
            return driver, 1

        # The Python interpreter that is used to launch "dbgp" may be a
        # a different version than is currently run, therefore we must be
        # sure to launch pydbpg.py rather pydbgp.py[oc].
        koDirs = Cc["@activestate.com/koDirs;1"].\
                 getService(Ci.koIDirs)
        return os.path.join(koDirs.binDBGPDir, driverBase), 0
    
    def _getScriptArgs(self):
        self._usecgi = self.currentInstancePrefs.getBoolean('sim-cgi', False)
        # use the get variables as the user_args if emulating CGI        
        scriptArgs = []
        if self._usecgi:
            get_args = self._build_get_line()
            if get_args: scriptArgs.append(get_args)
        if len(scriptArgs) < 1:
            cmddata = self.currentInstancePrefs.getString('params', "")
            scriptArgs = _line2argv(cmddata)
        return scriptArgs
        
    def _getDebuggerEnvironment(self, installed=0):
        # Extend the environment so our dbgp Python package is used.
        env = self._getenv()

        koDirSvc = Cc["@activestate.com/koDirs;1"].\
                   getService(Ci.koIDirs)

        # In a dev build environment there are some dirs on the PYTHONPATH
        # that will get in the way. In particular the siloed Python
        # "site-packages" has a 'dbgp' package withOUT the DBGP client bits
        # (wich would cause 'pydbgp' to fail when importing dbgp.client) and
        # the PyXPCOM import directory has stuff that isn't needed.
        currPyPath = env.get("PYTHONPATH", "").split(os.pathsep)
        cleanedPyPath = []
        baddies = [
            os.path.join(koDirSvc.mozBinDir, "python"),
            # Don't want siloed Python "site-packages" dir. Cheat: assume any
            # path starting with Komodo's install dir.
            koDirSvc.installDir,
        ]
        for path in currPyPath:
            for baddy in baddies:
                if path.startswith(baddy):
                    break
            else:
                # Okay to keep this PYTHONPATH entry.
                cleanedPyPath.append(path)
        cleanedPyPath = os.pathsep.join(cleanedPyPath)
        env["PYTHONPATH"] = cleanedPyPath

        # set the dbgp site-packages into PYDBGP_PATH
        # using this allows python -E to work
        if not installed:
            if self._pythonVersion >= 3.0:
                dbgpLibDir = koDirSvc.python3DBGPDir
            else:
                dbgpLibDir = koDirSvc.pythonDBGPDir
            if not os.path.exists(dbgpLibDir):
                errmsg = "cannot debug: cannot find Python DBGP support "\
                         "libs: '%s'" % dbgpLibDir
                log.error(errmsg)
                #XXX *Could* set last error on koILastErrorSvc but the invocation
                #    system doesn't use that yet.
                raise ServerException(nsError.NS_ERROR_UNEXPECTED, errmsg)
            env["PYDBGP_PATH"] = dbgpLibDir

        if log.isEnabledFor(logging.DEBUG):
            log.debug("%s Python Debugging Environment", "="*40)
            log.debug("PYTHONPATH=%s", env.get("PYTHONPATH", ""))
            log.debug("PYDBGP_PATH=%s", env.get("PYDBGP_PATH", ""))
            log.debug("="*70)
        return env

    def _launchForInteractive(self):
        executable = self._determineExecutable()
        executableArgs = self._getExecutableArgs(executable)
        driver, installed = self._getDBGPClientDriver(executable)
        driverArgs = self._getDBGPClientDriverArgs()
        if '-i' in executableArgs:
            executableArgs.remove('-i')
        argv = [executable] + executableArgs + [driver] + driverArgs + ['-i']

        cwd = self.currentInstancePrefs.getStringPref('cwd')
        if not cwd:
            cwd = os.getcwd()
        env = self._getDebuggerEnvironment(installed)
        return self._doLaunch(argv, cwd, env)

    def _launchForDebug(self):
        executable = self._determineExecutable()
        executableArgs = self._getExecutableArgs(executable)
        driver, installed = self._getDBGPClientDriver(executable)
        driverArgs = self._getDBGPClientDriverArgs()
        if '-i' in executableArgs:
            executableArgs.remove('-i')
            driverArgs.append('-i')
        script = self.currentInstancePrefs.getStringPref('filename')
        scriptArgs = self._getScriptArgs()
        argv = [executable] + executableArgs + [driver] + driverArgs \
               + [script] + scriptArgs

        cwd = self.currentInstancePrefs.getStringPref('cwd')
        if not cwd:
            cwd = os.path.dirname(script)
        env = self._getDebuggerEnvironment(installed)
        return self._doLaunch(argv, cwd, env)

    def _launchForRun(self):
        exe = self.getExecutable()
        return self._doLaunch(exe["argv"] + exe["script"], exe["cwd"], exe["env"])
    
    def getExecutable(self, asJSON = False):
        script = []
        noPrefs = False
        if not self.currentInstancePrefs:
            noPrefs = True
            self.currentInstancePrefs = self.prefService.effectivePrefs
        else:
            script = self.currentInstancePrefs.getStringPref('filename')
            scriptArgs = self._getScriptArgs()
            script = [script] + scriptArgs
            
        executable = self._determineExecutable()
        executableArgs = self._getExecutableArgs(executable)
        driver, installed = self._getDBGPClientDriver(executable)
        driverArgs = self._getDBGPClientDriverArgs()
        if '-i' in executableArgs:
            executableArgs.remove('-i')
            driverArgs.append('-i')
        driverArgs.append('-n') # run without debug
        
        argv = [executable] + executableArgs
        
        if not noPrefs:
             argv = argv + [driver] + driverArgs
 
        cwd = self.currentInstancePrefs.getString('cwd', "")
        if len(script) and not cwd:
            cwd = os.path.dirname(script[0])
        env = self._getDebuggerEnvironment(installed)
        env = self._updatePythonPath(env)
 
        result = {
            "argv": argv,
            "cwd": cwd,
            "env": env,
            "script": script
        }
 
        if asJSON:
            import json
            result = json.dumps(result)
            
        if noPrefs:
            self.currentInstancePrefs = None
 
        return result

    def _launchForProfiling(self):
        executable = self._determineExecutable()
        executableArgs = self._getExecutableArgs(executable)
        driver, installed = self._getDBGPClientDriver(executable)
        driverArgs = self._getDBGPClientDriverArgs()
        driverArgs.append('-p') # run with code profiling
        script = self.currentInstancePrefs.getStringPref('filename')
        scriptArgs = self._getScriptArgs()
        argv = [executable] + executableArgs + [driver] + driverArgs \
               + [script] + scriptArgs

        cwd = self.currentInstancePrefs.getStringPref('cwd')
        if not cwd:
            cwd = os.path.dirname(script)
        env = self._getDebuggerEnvironment(installed)
        return self._doLaunch(argv, cwd, env)

class koPythonInvocation(koPythonCommonInvocation):
       # If this object needs to be registered, the following 2 are also needed.
    _language = "Python"
    _reg_clsid_ = "{eef242ad-c57e-4507-80d5-d2fa7885dea5}"
    _reg_contractid_ = "@activestate.com/koInvocation;1?type=Python"
    #_reg_registrar_ = RegisterAsInvocation, None

    _invocation_name_ = "Python"
    _invocation_description_ = "Python"
    def __init__(self):
        self.languageName_lc = self._language.lower()
        koPythonCommonInvocation.__init__(self)

class koPython3Invocation(koPythonCommonInvocation):
       # If this object needs to be registered, the following 2 are also needed.
    _language = "Python3"
    _reg_clsid_ = "{c8f319a1-5022-465d-aa52-6b71a86ad0a7}"
    _reg_contractid_ = "@activestate.com/koInvocation;1?type=Python3"
    #_reg_registrar_ = RegisterAsInvocation, None

    _invocation_name_ = "Python3"
    _invocation_description_ = "Python3"
    def __init__(self):
        self.languageName_lc = self._language.lower()
        koPythonCommonInvocation.__init__(self)


class koPerlInvocation(koInterpreterInvocation):
    _language = "Perl"
    _reg_clsid_ = "{3becc3bd-1e42-47b4-aafd-9974d10823dd}"
    _reg_contractid_ = "@activestate.com/koInvocation;1?type=Perl"
    #_reg_registrar_ = RegisterAsInvocation, None

    _invocation_name_ = "Perl"
    _invocation_description_ = "Perl"

    def __init__(self):
        koInterpreterInvocation.__init__(self)
        registryService = Cc['@activestate.com/koLanguageRegistryService;1'].\
               getService(Ci.koILanguageRegistryService)
        self.languageService = registryService.getLanguage('Perl');
    
    def _fillExtraDefaultPreferences(self, cat, inst):
        inst.setStringPref("warnings", "enabled")
        inst.setLongPref("debugger.io-port", 9011)

    def _do_validate(self, invokeType):
        try:
            prefset = self.currentInstancePrefs
            checkFileExists(prefset, 'executable', "You must specify the Perl executable used for the debug session")
            if invokeType != INVOKE_INTERACTIVE:
                checkFileExists(prefset, 'filename', "You must specify the main Perl script to be used")

            if invokeType != INVOKE_RUN and sys.platform == "win32":
                # Bug 72659: don't allow debugging of msys perl
                perlInfo = self.languageService.\
                           getLanguageService(Ci.koIAppInfoEx)
                if perlInfo.isMsysPerl():
                    # Don't debug msys perl
                    return 0, "", "Komodo does not support debugging of MSYS Perl.  Please install another distribution if needed (Komodo works best with Active Perl), and point the Languages|Perl|Interpreter preference to it."

            cwd = prefset.getStringPref("cwd")
            if cwd and not os.path.isdir(cwd):
                raise PrefException("cwd", "Directory '%s' does not exist" % cwd)
            warnings = prefset.getStringPref("warnings")
            valid_warning_values = ["enabled", "disabled", "all"]
            if warnings not in valid_warning_values:
                raise PrefException("warnings", "Must be one of " + ",".join(valid_warning_values))
        except PrefException, exc:
            return 0, exc.prefid, exc.msg
        return 1, None, None
        
    def _determineExecutable(self):
        # use pref'd default if one has been chosen
        perlExe = self.effectivePrefs.getStringPref("perlDefaultInterpreter")
        if perlExe and os.path.isfile(perlExe):
            return perlExe
        perlInfo  = self.languageService.\
                   getLanguageService(Ci.koIAppInfoEx)
        perlExe = perlInfo.executablePath
        if not perlExe:
            installations = perlInfo.FindInstallationPaths()
            if installations:
                perlExe = installations[0]
        if not perlExe or not os.path.isfile(perlExe):
            log.error("No Perl interpreter could be found.")
            return ""
        return perlExe


    def _getExtraPerlOptions(self):
        cmddata = self.currentInstancePrefs.getString('executable-params', "")
        ret = _line2argv(cmddata)

        if '-w' not in ret and '-W' not in ret and '-X' not in ret:
            warnings = self.currentInstancePrefs.getString('warnings', "")
            if warnings == "enabled":
                ret.append("-w")
            elif warnings == "all":
                ret.append("-W")
            elif warnings == "disabled":
                ret.append("-X")
        return ret
    
    def _getPerlIncArgv(self):
        argv = []
        perlExtraPaths = []
        if self.effectivePrefs.hasPref("perlExtraPaths"):
            perlExtraPaths = self.effectivePrefs.getString("perlExtraPaths", "")
        if perlExtraPaths:
            if sys.platform.startswith("win"):
                perlExtraPaths = string.replace(perlExtraPaths, '\\', '/')
            perlExtraPaths = [x for x in perlExtraPaths.split(os.pathsep) if x.strip()]
            for incpath in perlExtraPaths:
                argv += ['-I', incpath]
        return argv

    def _getPerlDbgLibForCmdLine(self):
        # Bug OTS#: 10101113-FW -- In taint mode Perl doesn't
        # consult the PERL5LIB or PERLLIB env vars, but it
        # will honor -I dirs.
        
        koDirSvc = Cc["@activestate.com/koDirs;1"].\
                        getService(Ci.koIDirs)
        dbgpLibDir = koDirSvc.perlDBGPDir
        if not os.path.exists(dbgpLibDir):
            return []
        return ['-I', dbgpLibDir]

    def _getLogFile(self):
        # The PERLDB_OPTS LogFile setting is given only if
        # logEnabled and len(logPath/logDir) > 0 (duh)
        # add logging if configured
        logEnabled = 0
        logDir = ''
        if self.effectivePrefs.hasPref("perl_debuggerlogenabled"):
            logEnabled = self.effectivePrefs.getBooleanPref("perl_debuggerlogenabled")
        if logEnabled:
            if self.effectivePrefs.hasPref("perl_debuggerlogpath"):
                logDir = self.effectivePrefs.getStringPref("perl_debuggerlogpath")
                logDir = os.path.expanduser(logDir)
            if not logDir:
                logDir = os.getenv("TEMP", os.getenv("TMP", ''))
                if logDir:
                    logDir = os.path.join(logDir, 'perl-dbgp.log')
            if logDir:
                logDir = logDir.replace("\\", "/")
                # encode the path
                logDir = urllib.quote(logDir)
        return logDir
    
    def _getScriptArgs(self):
        self._usecgi = self.currentInstancePrefs.getBooleanPref('sim-cgi')

        # use the get variables as the user_args if emulating CGI        
        scriptArgs = []
        if self._usecgi:
            get_args = self._build_get_line()
            if get_args: scriptArgs.append(get_args)
        if len(scriptArgs) < 1 and \
           self.currentInstancePrefs.hasPref('params'):
            params = self.currentInstancePrefs.getStringPref('params')
            if params:
                scriptArgs = _line2argv(params)
        return scriptArgs
    
    def _getDebuggerEnvironment(self):
        # Setup the environment so that our perl5db.pl (and the extra
        # Perl module it requires) get used.
        env = self._getenv()

        cmdPort = self.currentInstancePrefs.getLongPref("debugger.listener-port")
        #listenerPort = self.currentInstancePrefs.getLongPref("debugger.listener-port")
        envOpts = env.get("PERLDB_OPTS", "").split(os.pathsep)
        # Keep the old env settings

        perldbOpts = {}
        for pair in [opt.split("=", 1) for opt in envOpts if opt]:
            if len(pair) == 1:
                perldbOpts[pair[0]] = None
            else:
                perldbOpts[pair[0]] = pair[1]
        
        # Override new ones
        perldbOpts['RemotePort'] = '127.0.0.1:%d' % (cmdPort) # Required
        logFile = self._getLogFile()
        if logFile:
            perldbOpts['LogFile'] = logFile

        # Recreate the env var
        env["PERLDB_OPTS"] = ' '.join([(val is not None and (key + '=' + val) or key)
                                       for key,val in perldbOpts.items()])

        #XXX Is this block correct for Linux/Solaris?
        koDirSvc = Cc["@activestate.com/koDirs;1"].\
                   getService(Ci.koIDirs)

        perl5db = "BEGIN { require '%s' }"\
                         % os.path.join(koDirSvc.perlDBGPDir, 'perl5db.pl')
        if sys.platform.startswith("win"):
            env["PERL5DB"] = string.replace(perl5db, '\\', '/')
        else:
            env["PERL5DB"] = perl5db
        if log.isEnabledFor(logging.DEBUG):
            log.debug("%s Perl Debugging Environment", "="*40)
            log.debug("PERL5LIB=%s", env.get('PERL5LIB', "<unset>"))
            log.debug("PERL5DB=%s", env.get('PERL5DB', "<unset>"))
            log.debug("PERLDB_OPTS=%s", env.get('PERLDB_OPTS', "<unset>"))
            log.debug("="*70)
        self._padWalkerCheck()
        return env

    def _padWalkerCheck(self):
        perlPrefName = "perlDebugger.RecommendPadWalker"
        gprefs = self.prefService.prefs
        if gprefs.getBooleanPref(perlPrefName):
            appInfoEx = Cc["@activestate.com/koAppInfoEx?app=Perl;1"].\
                getService(Ci.koIPerlInfoEx)
            if not appInfoEx.haveModules(["PadWalker"]):
                nsIPromptService = Ci.nsIPromptService
                dialogTitle = "PadWalker not found for Perl Debugger"
                text = "The Komodo Perl Debugger works better if PadWalker is installed for the current Perl %s" % appInfoEx.executablePath
                aCheckMsg = "Don't show this message again"
                aCheckState = False
                prompter = Cc["@mozilla.org/embedcomp/prompt-service;1"]\
                 .getService(nsIPromptService)
                donotAsk = prompter.alertCheck(None,
                                               dialogTitle, text,
                                               aCheckMsg, aCheckState)
                if donotAsk:
                    gprefs.setBooleanPref(perlPrefName, 0)
            else:
                gprefs.setBooleanPref(perlPrefName, 0)

    def _launchForInteractive(self):
        executable = self._determineExecutable()
        argv = [executable, "-d", "-e", "1"] \
               + self._getExtraPerlOptions() \
               + self._getPerlDbgLibForCmdLine() \
               + self._getPerlIncArgv()
        cwd = self.currentInstancePrefs.getStringPref('cwd')
        if not cwd:
            cwd = os.getcwd()
        env = self._getDebuggerEnvironment()
        self._doLaunch(argv, cwd, env)
    
    def _launchForDebug(self):
        script = self.currentInstancePrefs.getStringPref('filename')
        executable = self._determineExecutable()
        argv = [executable, "-d"] \
               + self._getExtraPerlOptions() \
               + self._getPerlDbgLibForCmdLine() \
               + self._getPerlIncArgv() + [script] \
               + self._getScriptArgs()
        cwd = self.currentInstancePrefs.getStringPref('cwd')
        if not cwd:
            cwd = os.path.dirname(script)
        env = self._getDebuggerEnvironment()
        self._doLaunch(argv, cwd, env)

    def _launchForRun(self):
        exe = self.getExecutable()
        self._doLaunch(exe["argv"] + exe["script"], exe["cwd"], exe["env"])
        
    def getExecutable(self, asJSON = False):
        script = []
        noPrefs = False
        cwd = ""
        if not self.currentInstancePrefs:
            noPrefs = True
            self.currentInstancePrefs = self.prefService.effectivePrefs
        else:
            script = self.currentInstancePrefs.getStringPref('filename')
            script = [script] + self._getScriptArgs()
            cwd = self.currentInstancePrefs.getStringPref('cwd')
            if not cwd:
                cwd = os.path.dirname(script[0])
            
        executable = self._determineExecutable()
        argv = [executable] \
               + self._getExtraPerlOptions() \
               + self._getPerlIncArgv()
        env = self._getenv()
 
        result = {
            "argv": argv,
            "cwd": cwd,
            "env": env,
            "script": script
        }
 
        if asJSON:
            import json
            result = json.dumps(result)
            
        if noPrefs:
            self.currentInstancePrefs = None
 
        return result
 

class koPHPInvocation(koInterpreterInvocation):
    _language = "PHP"
    _reg_clsid_ = "{aa80dab8-b5fb-45c4-b1c5-0eec9494955b}"
    _reg_contractid_ = "@activestate.com/koInvocation;1?type=PHP"
    #_reg_registrar_ = RegisterAsInvocation, None

    _invocation_name_ = "PHP"
    _invocation_description_ = "PHP"

    def __init__(self):
        koInterpreterInvocation.__init__(self)
        self.checked_can_debug = 0
        self.can_debug = 0
        registryService = Cc['@activestate.com/koLanguageRegistryService;1'].\
               getService(Ci.koILanguageRegistryService)
        self.languageService = registryService.getLanguage('PHP');
        self.error_invocation_not_supported = self._invocation_name_ + " is not configured for '%s'."

    def get_supportedInvokeTypes(self):
        rc = INVOKE_RUN
        self.can_debug = self.languageService.\
               getLanguageService(Ci.koIAppInfoEx).\
               autoConfigureDebugger() == ""

        if self.can_debug:
            rc |= (INVOKE_DEBUG | INVOKE_PROFILE)
        return rc

    def _fillExtraDefaultPreferences(self, cat, inst):
        inst.setBooleanPref("disableOutputBuffering", 1)
        inst.setBooleanPref("enableImplicitFlush", 1)
        phpInfo = self.languageService.\
           getLanguageService(Ci.koIAppInfoEx)
        if phpInfo.sapi == "cli":
            inst.setStringPref("phpInterpreterType", "php-cli")
        else:
            inst.setStringPref("phpInterpreterType", "php-cgi")
    
    def _do_validate(self, invokeType):
        try:
            prefset = self.currentInstancePrefs
            checkFileExists(prefset, 'executable', "You must specify the PHP executable used for the debug session")
            checkFileExists(prefset, 'filename', "You must specify the main PHP script to be used")
            phpInfo = self.languageService.\
               getLanguageService(Ci.koIAppInfoEx)
            if not phpInfo.valid_version:
                return 0, "", "Komodo does not support debugging with PHP Version %s, please upgrade to a later version." % phpInfo.version
            cwd = prefset.getStringPref("cwd")
            if cwd and not os.path.isdir(cwd):
                raise PrefException("cwd", "Directory '%s' does not exist" % cwd)
            
            #verify we can run
            if invokeType & (INVOKE_DEBUG | INVOKE_PROFILE):
                rc = self.get_supportedInvokeTypes()
                if not rc & invokeType:
                    return 0, "", "PHP is not configured properly for %s." % (invoke_names.get(invokeType))
        except PrefException, exc:
            return 0, exc.prefid, exc.msg
        return 1, None, None
        
    def _determineExecutable(self):
        # use pref'd default if one has been chosen
        phpInterpreterType = self.currentInstancePrefs.getString('phpInterpreterType', 'default')
        phpInfo = self.languageService.\
           getLanguageService(Ci.koIAppInfoEx)
        if phpInfo.cgiExecutable and phpInterpreterType == 'php-cgi':
            phpExe = phpInfo.cgiExecutable
        else:
            phpExe = self.effectivePrefs.getStringPref("phpDefaultInterpreter")
            if not phpExe or not os.path.isfile(phpExe):
                phpExe = phpInfo.cliExecutable
        return phpExe

    def _launchForDebug(self, profiling=False):
        self._usecgi = self.currentInstancePrefs.getBooleanPref('sim-cgi')
        script = self.currentInstancePrefs.getStringPref('filename')
        ini = self.effectivePrefs.getStringPref("phpConfigFile")
        if not ini:
            phpInfo = self.languageService.\
               getLanguageService(Ci.koIAppInfoEx)
            ini = phpInfo.cfg_file_path
        buffer = self.currentInstancePrefs.getBooleanPref("disableOutputBuffering")
        flush = self.currentInstancePrefs.getBooleanPref("enableImplicitFlush")
        if ini == "": ini = None
        executable = self._determineExecutable()

        # use the get variables as the user_args if emulating CGI        
        user_args = []
        if self._usecgi:
            get_args = self._build_get_line()
            if get_args: user_args.append(get_args)
        if len(user_args) < 1:
            params = self.currentInstancePrefs.getStringPref('params')
            user_args = _line2argv(params)

        params = self.currentInstancePrefs.getStringPref('executable-params')
        execArgs = _line2argv(params)
        
        exec_arg_string = ' '.join(execArgs)
        options = ['-d', 'cgi.force_redirect=off']
        if flush and exec_arg_string.find('implicit_flush') == -1:
            options += ['-d','implicit_flush=on']
        if buffer and exec_arg_string.find('output_buffering') == -1:
            options += ['-d','output_buffering=off']
            
        port = self.currentInstancePrefs.getLongPref("debugger.listener-port")
        argv = [executable] + options + execArgs

        if self._usecgi:
            argv += [script]
        else:
            argv += ["-f", script]
            self._build_argv_for_cli(argv, user_args)

        cwd = self.currentInstancePrefs.getStringPref('cwd')
        if not cwd:
            cwd = os.path.dirname(script)

        environmentDict = self._getenv()
        environmentDict["XDEBUG_CONFIG"] = "remote_enable=1 remote_port=%d remote_handler=dbgp remote_mode=%s" % (
                                            port, profiling and "profile" or "req")
        if ini is not None and '-c' not in argv:
            environmentDict["PHPRC"] = ini
        #print "**************** About to launch PHP debugger:"
        #print '    environmentDict["XDEBUG_CONFIG"] = ' + environmentDict["XDEBUG_CONFIG"]
        #print '    environmentDict["PHPRC"] = ' + environmentDict.get("PHPRC", "?")
        #print "    cmd=%r, cwd=%r" % (argv, cwd)
        return self._doLaunch(argv, cwd, environmentDict)

    def _build_argv_for_cli(self, argv, user_args):
        if user_args and user_args[0].startswith("-"):
            argv.append("--")
        argv += user_args

    def _launchForRun(self):
        exe = self.getExecutable()
        return self._doLaunch(exe["argv"] + exe["script"], exe["cwd"], exe["env"])

    def getExecutable(self, asJSON = False):
        script = []
        noPrefs = False
        if not self.currentInstancePrefs:
            noPrefs = True
            self.currentInstancePrefs = self.prefService.effectivePrefs
        else:
            self._usecgi = self.currentInstancePrefs.getBooleanPref('sim-cgi')
            script = self.currentInstancePrefs.getStringPref('filename')
            
            if self._usecgi:
                script = [script]
            else:
                script = ["-f", script]
                params = self.effectivePrefs.getString('params', "")
                user_args = _line2argv(params)
                self._build_argv_for_cli(script, user_args)
            
        buffer = self.currentInstancePrefs.getBoolean("disableOutputBuffering", True)
        flush = self.currentInstancePrefs.getBoolean("enableImplicitFlush", True)
            
        ini = self.effectivePrefs.getStringPref("phpConfigFile")
        if ini == "": ini = None
        executable = self._determineExecutable()
 
        params = self.effectivePrefs.getString('executable-params', "")
        execArgs = _line2argv(params)
 
        exec_arg_string = ' '.join(execArgs)
        options = ['-d', 'cgi.force_redirect=off']
        if flush and exec_arg_string.find('implicit_flush') == -1:
            options += ['-d','implicit_flush=on']
        if buffer and exec_arg_string.find('output_buffering') == -1:
            options += ['-d','output_buffering=off']
            
        argv = [executable] + options + execArgs
 
        cwd = self.currentInstancePrefs.getString('cwd', "")
        if len(script) and not cwd:
            # Dirty fix, but this is for a minor release and I don't want to touch
            # more than I have to. We should fix this properly though.
            if script[0] == "-f":
                cwd = os.path.dirname(script[1])
            else:
                cwd = os.path.dirname(script[0])
            
        environmentDict = self._getenv()
        environmentDict["XDEBUG_CONFIG"] = "remote_enable=off"
        if ini is not None and '-c' not in argv:
            environmentDict["PHPRC"] = ini
 
        result = {
            "argv": argv,
            "cwd": cwd,
            "env": environmentDict,
            "script": script
        }
 
        if asJSON:
            import json
            result = json.dumps(result)
            
        log.debug(result)
        
        if noPrefs:
            self.currentInstancePrefs = None
 
        return result

    def _launchForProfiling(self):
        self._launchForDebug(profiling=True)

class koXSLTInvocation(koInterpreterInvocation):
    _language = "XSLT"
    _reg_clsid_ = "{20B8B708-D3A6-423b-BB41-9EDEE5604CD5}"
    _reg_contractid_ = "@activestate.com/koInvocation;1?type=XSLT"
    #_reg_registrar_ = RegisterAsInvocation, None

    _invocation_name_ = "XSLT"
    _invocation_description_ = "XSLT"

    def __init__(self):
        koInterpreterInvocation.__init__(self)
        self.checked_can_debug = 0
        self.can_debug = 0

    def get_supportedInvokeTypes(self):
        return INVOKE_DEBUG | INVOKE_RUN

    def _checkValid(self, invokeType):
        return invokeType == INVOKE_DEBUG or invokeType == INVOKE_RUN
        
    def _fillExtraDefaultPreferences(self, cat, inst):
        inst.setStringPref("inputfile", "")

    def _getenv(self):     
        env = koInterpreterInvocation._getenv(self)
 
        if sys.platform.startswith("win"):
            pass
        elif sys.platform == "darwin":
            log.warn("XXX determine appropriate environment for XSLT invocation on Mac OS X")
            #XXX I suspect the right thing for Mac OS X is the
            #    following. Need to check, though.
            #koDirs = Cc["@activestate.com/koDirs;1"]\
            #         .getService(Ci.koIDirs)
            #env["DYLD_LIBRARY_PATH"] = os.path.join(koDirs.supportDir, "xslt")
        elif sys.platform.startswith("linux") \
             or sys.platform.startswith("solaris"):
            koDirs = Cc["@activestate.com/koDirs;1"]\
                     .getService(Ci.koIDirs)
            env["LD_LIBRARY_PATH"] = os.path.join(koDirs.supportDir, "xslt")
        return env
        
    def _do_validate(self, invokeType):
        try:
            prefset = self.currentInstancePrefs
            checkFileExists(prefset, 'executable', "You must specify the XSLT executable used for the debug session")

            checkFileExists(prefset, 'filename', "You must specify the main XSLT script to be used")

            inputFile = prefset.getStringPref('inputfile')
            if not inputFile:
                raise PrefException('inputfile', "You must specify the input XML file to be used")
            else:
                addressingScheme, networkLocation, path, parameters, query, fragmentIdentifier = urlparse.urlparse(inputFile)
                if not addressingScheme:
                   if not os.path.isfile(inputFile):
                        raise PrefException('inputfile', "File '%s' does not exist" % inputFile)
                elif addressingScheme == 'file':
                    addressLocation = inputFile.lower().find('file:///')
                    if addressLocation == -1:
                        raise PrefException('inputfile', 'URIs that use the "file" addressing scheme must begin with "file:///"')
                    else:
                        if not os.path.isfile(inputFile[addressLocation + len('file:///'):]):
                            raise PrefException('inputfile', "File '%s' does not exist" % inputFile)

        except PrefException, exc:
            return 0, exc.prefid, exc.msg
        return 1, None, None
    
    def _determineExecutable(self):
        # use pref'd default if one has been chosen
        if self.effectivePrefs.hasStringPref("xsltDefaultInterpreter") and\
           self.effectivePrefs.getStringPref("xsltDefaultInterpreter"):
            runLocation = self.effectivePrefs.getStringPref("xsltDefaultInterpreter")
        else:        
            koDirs = Cc["@activestate.com/koDirs;1"].\
                getService(Ci.koIDirs)

            if sys.platform.startswith('win'): 
                runLocation = os.path.join(koDirs.supportDir, 'xslt', 'xsltdbgp.exe')
            else:
                runLocation = os.path.join(koDirs.supportDir, 'xslt', 'xsltdbgp')
            
        return runLocation

    def _launchForDebug(self):
        self._usecgi = self.currentInstancePrefs.getBooleanPref('sim-cgi')
        showConsole = 0
        script = self.currentInstancePrefs.getStringPref('filename')
        inputfile = self.currentInstancePrefs.getStringPref('inputfile')
        executable = self._determineExecutable()
        port = self.currentInstancePrefs.getLongPref("debugger.listener-port")

        params = self.currentInstancePrefs.getStringPref('executable-params')
        execArgs = _line2argv(params)

        argv = [executable] + execArgs + ["-dbgp", '127.0.0.1', str( port ), script, inputfile]
        cwd = self.currentInstancePrefs.getStringPref('cwd')
        if not cwd:
            cwd = os.path.dirname(script)
        environment = self._getenv()
        return self._doLaunch(argv, cwd, environment)


    def _launchForRun(self):
        showConsole = 0
        self._usecgi = self.currentInstancePrefs.getBooleanPref('sim-cgi')
        script = self.currentInstancePrefs.getStringPref('filename')
        inputfile = self.currentInstancePrefs.getStringPref('inputfile')
        executable = self._determineExecutable()

        params = self.currentInstancePrefs.getStringPref('executable-params')
        execArgs = _line2argv(params)

        argv = [executable] + execArgs + [script, inputfile]
        cwd = self.currentInstancePrefs.getStringPref('cwd')
        if not cwd:
            cwd = os.path.dirname(script)
        return self._doLaunch(argv, cwd, self._getenv())

    def getExecutable(self, asJSON = False):
        return ""


class koTclInvocation(koInterpreterInvocation):
       # If this object needs to be registered, the following 2 are also needed.
    _language = "Tcl"
    _reg_clsid_ = "{06860119-32f6-432d-a0c0-2398fcd56653}"
    _reg_contractid_ = "@activestate.com/koInvocation;1?type=Tcl"
    #_reg_registrar_ = RegisterAsInvocation, None

    _invocation_name_ = "Tcl"
    _invocation_description_ = "Tcl"

    def _fillExtraDefaultPreferences(self, cat, inst):
        # XXX - It doesn't look like TCL_LIBRARYPATH is being used anywhere!
        cat.setStringPref("TCL_LIBRARYPATH", "")
        inst.setStringPref("tclInterpreterType",
                           self.prefService.prefs.getStringPref("tclInterpreterType"))

    def _determineExecutable(self, type=None):
        """determine the Tcl interpreter to use"""
        # Find a reasonable Tcl installation (possible perf issue computing this
        # even when the user has picked an explicit preference)
        tclInstallation = Cc["@activestate.com/koAppInfoEx?app=Tcl;1"].createInstance();
        
        if not type:
            type = self.currentInstancePrefs.getStringPref("tclInterpreterType")
        if type == "wish":
            tclExe = self.effectivePrefs.getStringPref("wishDefaultInterpreter")
            if not tclExe and tclInstallation:
                tclExe = tclInstallation.wish_path
        else:        
            tclExe = self.effectivePrefs.getStringPref("tclshDefaultInterpreter")
            if not tclExe and tclInstallation:
                tclExe = tclInstallation.tclsh_path
        if not tclExe and tclInstallation:
            self.currentInstancePrefs.setStringPref("tclInterpreterType", "tclsh")
            tclExe = tclInstallation.executablePath
        if not tclExe or not os.path.isfile(tclExe):
            log.error("No Tcl interpreter could be found.")
            return ""
        else:
            return tclExe
        
    def _do_validate(self, invokeType):
        try:
            prefset = self.currentInstancePrefs
            checkFileExists(prefset, 'executable', "You must specify the executable used for the debug session")
            if invokeType != INVOKE_INTERACTIVE:
                checkFileExists(prefset, 'filename',   "You must specify the Tcl script to be debugged")

            cwd = prefset.getStringPref("cwd")
            if cwd and not os.path.isdir(cwd):
                raise PrefException("cwd", "Directory '%s' does not exist" % cwd)

            tclInfo = Cc["@activestate.com/koAppInfoEx?app=Tcl;1"] \
                     .getService(Ci.koIAppInfoEx)
            tclInfo.installationPath = tclInfo.getInstallationPathFromBinary(prefset.getStringPref("executable"))

        except PrefException, exc:
            return 0, exc.prefid, exc.msg
        return 1, None, None

    def _getScriptArgs(self):
        self._usecgi = self.currentInstancePrefs.getBooleanPref('sim-cgi')

        # use the get variables as the user_args if emulating CGI        
        scriptArgs = []
        if self._usecgi:
            get_args = self._build_get_line()
            if get_args: scriptArgs.append(get_args)
        if len(scriptArgs) < 1 and \
           self.currentInstancePrefs.hasPref('params'):
            params = self.currentInstancePrefs.getStringPref('params')
            if params:
                scriptArgs = _line2argv(params)
        return scriptArgs
    
    def _getenv(self):
        environment = koInterpreterInvocation._getenv(self)
        
        # if there is no setting for the dev kit environment, use
        # the shared directory for it.  This enables site wide
        # use of *.pdx and *.pcx files for debugging
        if "TCLDEVKIT_LOCAL" not in environment:
            koDirs = Cc["@activestate.com/koDirs;1"].\
                getService(Ci.koIDirs)
            sharedDir = os.path.join(koDirs.commonDataDir, "tcl")
            environment["TCLDEVKIT_LOCAL"] = sharedDir

        if self.effectivePrefs.hasPref("tclExtraPaths"):
            tclExtraPaths = self.effectivePrefs.getStringPref("tclExtraPaths")
            # If TCLLIBPATH is set, then it must contain a valid Tcl
            # list giving directories to search during auto-load
            # operations. Directories must be specified in Tcl format,
            # using "/" as the path separator, regardless of platform.
            # This variable is only used when initializing the
            # auto_path variable.  Also escape spaces in paths.
            tclExtraPaths = tclExtraPaths.replace('\\', '/')
            tclExtraPaths = tclExtraPaths.replace(' ', '\ ')
            TCLLIBPATH = ' '.join(tclExtraPaths.split(os.pathsep))
            environment["TCLLIBPATH"] = TCLLIBPATH

        return environment
    
    def _getDBGPClientDriver(self):
        koDirs = Cc["@activestate.com/koDirs;1"].\
            getService(Ci.koIDirs)

        if sys.platform.startswith('win'):
            # Bug 101199 -- make sure we use the version of dbgp_tcldebug
            # that matches tclsh/winsh's architecture

            # There's no point caching this value because a new instance
            # of this class is created for each debugger invocation, and
            # the user can switch from an exec using one architecture to
            # an executable using a different one between sessions, so no
            # point storing it in a global.
            #
            # Also, the time calling GetBinaryTypeW is negligible (~ 1 msec)
            executable = 'dbgp_tcldebug.exe'
            import ctypes
            # _determineExecutable will pick tclsh or wish, following pref
            tclsh = unicode(self._determineExecutable())
            if tclsh:
                binaryType = ctypes.wintypes.DWORD(1)
                res = ctypes.windll.kernel32.GetBinaryTypeW(tclsh,
                                                            ctypes.pointer(binaryType))
                if not res:
                    log.warn("Failed to call ctypes.GetBinaryType: error %d",
                             ctypes.get_last_error())
                elif binaryType.value == 6: # SCS_64BIT_BINARY
                    executable = 'dbgp_tcldebug-x86_64.exe'
        else:
            executable = 'dbgp_tcldebug'

        return os.path.join(koDirs.supportDir, 'tcl', executable)

    def _getDBGPClientDriverArgs(self, type=None):
        interpreter = self._determineExecutable(type)
        port = self.currentInstancePrefs.getLongPref("debugger.listener-port")
        driverArgs = ["-app-shell", interpreter,
                      "-host-ide", "127.0.0.1",
                      "-port-ide", str(port)]

        # add logging if configured
        logEnabled = 0
        logDir = ''
        if self.effectivePrefs.hasPref("tcl_debuggerlogenabled"):
            logEnabled = self.effectivePrefs.getBooleanPref("tcl_debuggerlogenabled")
        if logEnabled:
            if self.effectivePrefs.hasPref("tcl_debuggerlogpath"):
                logDir = self.effectivePrefs.getStringPref("tcl_debuggerlogpath")
                logDir = os.path.expanduser(logDir)
            if not logDir:
                logDir = os.getenv("TEMP", os.getenv("TMP", ''))
            if logDir:
                driverArgs += ["-log", "-logfile",
                               os.path.join(logDir, 'tcl.log')]
        return driverArgs

    def _launchForInteractive(self):
        # force tclsh for interactive shell
        driver = self._getDBGPClientDriver()
        driverArgs = self._getDBGPClientDriverArgs('tclsh') + ['-interactive']
        params = self.currentInstancePrefs.getStringPref('executable-params')
        execArgs = _line2argv(params)
        scriptArgs = self._getScriptArgs()
        argv = [driver] + execArgs + driverArgs + ['--'] + scriptArgs

        cwd = self.currentInstancePrefs.getStringPref('cwd')
        if not cwd:
            cwd = os.getcwd()
        return self._doLaunch(argv, cwd, self._getenv())
    
    def _launchForDebug(self):
        script = self.currentInstancePrefs.getStringPref('filename')
        scriptArgs = self._getScriptArgs()
        driver = self._getDBGPClientDriver()
        driverArgs = self._getDBGPClientDriverArgs() + ['-app-file', script]
        params = self.currentInstancePrefs.getStringPref('executable-params')
        execArgs = _line2argv(params)
        argv = [driver] + execArgs + driverArgs + ['--'] + scriptArgs

        cwd = self.currentInstancePrefs.getStringPref('cwd')
        if not cwd:
            cwd = os.path.dirname(script)
        return self._doLaunch(argv, cwd, self._getenv())

    def _launchForRun(self):
        exe = self.getExecutable()
        return self._doLaunch(exe["argv"] + exe["script"], exe["cwd"], exe["env"])
    
    def getExecutable(self, asJSON = False):
        script = []
        noPrefs = False
        if not self.currentInstancePrefs:
            noPrefs = True
            self.currentInstancePrefs = self.prefService.effectivePrefs
        else:
            script = self.currentInstancePrefs.getStringPref('filename')
            script = [script] + self._getScriptArgs()
            
        cwd = self.currentInstancePrefs.getString('cwd', "")
        if len(script) and not cwd:
            cwd = os.path.dirname(script[0])
            
        executable = self._determineExecutable()
        params = self.currentInstancePrefs.getString('executable-params', "")
        execArgs = _line2argv(params)
        argv = [executable] + execArgs

        result = {
            "argv": argv,
            "cwd": cwd,
            "env": self._getenv(),
            "script": script
        }
 
        if asJSON:
            import json
            result = json.dumps(result)
            
        if noPrefs:
            self.currentInstancePrefs = None
 
        return result

class koRubyInvocation(koInterpreterInvocation):
    _language = "Ruby"
    _reg_clsid_ = "{a580e9d6-8d99-4f65-b032-9062b5b9a3b0}"
    _reg_contractid_ = "@activestate.com/koInvocation;1?type=Ruby"
    #_reg_registrar_ = RegisterAsInvocation, None

    _invocation_name_ = "Ruby"
    _invocation_description_ = "Ruby"
        
    def __init__(self):
        koInterpreterInvocation.__init__(self)
        self.checked_can_debug = 0
        self.can_debug = 0
        registryService = Cc['@activestate.com/koLanguageRegistryService;1'].\
               getService(Ci.koILanguageRegistryService)
        self.languageService = registryService.getLanguage('Ruby');
        koDirSvc = Cc["@activestate.com/koDirs;1"].\
                   getService(Ci.koIDirs)
        dbgpLibDir = os.path.join(koDirSvc.supportDir, 'dbgp', 'rubylib')
        if sys.platform.startswith('win'):
            self.dbgpLibDir = dbgpLibDir.replace('\\', '/')
        else:
            self.dbgpLibDir = dbgpLibDir

    def _do_validate(self, invokeType):
        try:
            prefset = self.currentInstancePrefs
            checkFileExists(prefset, 'executable', "You must specify the Ruby executable used for the debug session")
            if invokeType != INVOKE_INTERACTIVE:
                checkFileExists(prefset, 'filename', "You must specify the main Ruby script to be used")
            rubyInfo = self.languageService.\
               getLanguageService(Ci.koIAppInfoEx)
            ruby_version = rubyInfo.version;
            if not rubyInfo.valid_version:
                return 0, "", "Komodo does not support debugging with version %s of Ruby.  Please upgrade to a later version." % ruby_version


            cwd = prefset.getStringPref("cwd")
            if cwd and not os.path.isdir(cwd):
                raise PrefException("cwd", "Directory '%s' does not exist" % cwd)
        except PrefException, exc:
            return 0, exc.prefid, exc.msg
        return 1, None, None

    def _determineExecutable(self):
        # use pref'd default if one has been chosen
        rubyExe = self.effectivePrefs.getStringPref("rubyDefaultInterpreter")
        if rubyExe and os.path.isfile(rubyExe):
            return rubyExe
        rubyInfo  = self.languageService.\
                   getLanguageService(Ci.koIAppInfoEx)
        rubyExe = rubyInfo.executablePath
        if not rubyExe:
            installations = rubyInfo.FindInstallationPaths()
            if installations:
                if sys.platform.startswith("win"):
                    rubyExe = os.path.join(installations[0], "bin", "ruby.exe")
                else:
                    rubyExe = os.path.join(installations[0], "bin", "ruby")
        if not rubyExe or not os.path.isfile(rubyExe):
            log.error("No Ruby interpreter could be found.")
            return ""
        return rubyExe
    
    def _getRubyIncArgv(self):
        argv = []
        rubyExtraPaths = []
        if self.effectivePrefs.hasPref("rubyExtraPaths"):
            rubyExtraPaths = self.effectivePrefs.getStringPref("rubyExtraPaths")
        if rubyExtraPaths:
            if sys.platform.startswith("win"):
                rubyExtraPaths = string.replace(rubyExtraPaths, '\\', '/')
            rubyExtraPaths = [x for x in rubyExtraPaths.split(os.pathsep) if x.strip()]
            for incpath in rubyExtraPaths:
                argv += ['-I', incpath]
        return argv

    def _getLogFile(self):
        # The RUBYDB_OPTS LogFile setting is given only if
        # logEnabled and len(logPath/logDir) > 0 (duh)
        # add logging if configured
        logEnabled = 0
        logDir = ''
        if self.effectivePrefs.hasPref("ruby_debuggerlogenabled"):
            logEnabled = self.effectivePrefs.getBooleanPref("ruby_debuggerlogenabled")
        if logEnabled:
            if self.effectivePrefs.hasPref("ruby_debuggerlogpath"):
                logDir = self.effectivePrefs.getStringPref("ruby_debuggerlogpath")
                logDir = os.path.expanduser(logDir)
            if not logDir:
                logDir = os.getenv("TEMP", os.getenv("TMP", ''))
                if logDir:
                    logDir = os.path.join(logDir, 'ruby-dbgp.log')
            if logDir:
                logDir = logDir.replace("\\", "/")
                # encode the path
                logDir = urllib.quote(logDir)
        return logDir
    
    def _getScriptArgs(self):
        self._usecgi = self.currentInstancePrefs.getBooleanPref('sim-cgi')
        # use the get variables as the user_args if emulating CGI        
        scriptArgs = []
        if self._usecgi:
            get_args = self._build_get_line()
            if get_args: scriptArgs.append(get_args)
        if len(scriptArgs) < 1 and \
           self.currentInstancePrefs.hasPref('params'):
            params = self.currentInstancePrefs.getStringPref('params')
            if params:
                scriptArgs = _line2argv(params)
        return scriptArgs
        
    def _getDebuggerEnvironment(self, installed=0):
        env = self._getenv()

        cmdPort = self.currentInstancePrefs.getLongPref("debugger.listener-port")
        #listenerPort = self.currentInstancePrefs.getLongPref("debugger.listener-port")
        rubydbOptString = 'RemotePort=127.0.0.1:%d' % (cmdPort) # Required
        
        logFile = self._getLogFile()
        if logFile:
            rubydbOptString = rubydbOptString + ' LogFile=' + logFile + ' verbose=1'
        env["RUBYDB_OPTS"] = rubydbOptString + ' LocalDebugger=1'
        if log.isEnabledFor(logging.DEBUG):
            log.debug("%s Ruby Debugging Environment", "="*40)
            log.debug("RUBYDB_OPTS=%s", env['RUBYDB_OPTS'])
            log.debug("="*70)
        return env

    _rubygems_re = re.compile(r'-?rubygems\b', re.IGNORECASE)
    def _fix_RubyDebuggerEnv(self, env):
        """ Stop the Ruby debugger from first stopping in ubygems.rb [sic]
        """
        rubyopt = env.get('RUBYOPT', '')
        if self._rubygems_re.match(rubyopt):
            del env['RUBYOPT']

    def _launchForInteractive(self):
        executable = self._determineExecutable()
        params = self.currentInstancePrefs.getStringPref('executable-params')
        execArgs = _line2argv(params)
        rubyVersion = self.languageService.\
                      getLanguageService(Ci.koIAppInfoEx).version
        if rubyVersion.startswith('2'):
            # The Ruby 2.x debugger runs the dbgp client on its own without
            # arguments (interactive mode is detected from ENV['RUBYDB_OPTS']).
            argv = ([str(executable)] + execArgs +
                    ["-I", self.dbgpLibDir] +
                    self._getRubyIncArgv() +
                    [self.dbgpLibDir + "/rdbgp2.rb"])
        else:
            # The Ruby 1.x debugger requires the dbgp client as a library and
            # runs a dummy expression to "initiate" the shell.
            argv = ([str(executable)] + execArgs +
                    ["-I", self.dbgpLibDir,
                     "-r", self.dbgpLibDir + "/rdbgp.rb"] +
                    self._getRubyIncArgv() +
                    ["-e", "1"])
        cwd = self.currentInstancePrefs.getStringPref('cwd')
        if not cwd:
            cwd = os.getcwd()
        env = self._getDebuggerEnvironment()
        env['RUBYDB_OPTS'] += " interactive=1"
        self._fix_RubyDebuggerEnv(env)
        log.debug("About to launch the interactive shell: (%s, %s, %s)", argv, cwd, env['RUBYDB_OPTS'])
        self._doLaunch(argv, cwd, env)

    def _launchForDebug(self):
        script = self.currentInstancePrefs.getStringPref('filename')
        executable = self._determineExecutable()
        params = self.currentInstancePrefs.getStringPref('executable-params')
        execArgs = _line2argv(params)
        rubyVersion = self.languageService.\
                      getLanguageService(Ci.koIAppInfoEx).version
        if rubyVersion.startswith('2'):
            # The Ruby 2.x debugger runs the dbgp client on its own with the
            # script to debug as an argument.
            libs = ["-I", self.dbgpLibDir] + \
                   self._getRubyIncArgv()
            script = [self.dbgpLibDir + "/rdbgp2.rb", script]
        else:
            # The Ruby 1.x debugger requires the dbgp client as a library and
            # runs the script to debug on its own.
            libs = ["-I", self.dbgpLibDir,
                    "-r", self.dbgpLibDir + "/rdbgp.rb"] + \
                   self._getRubyIncArgv()
            script = [script]
        argv = ([str(executable)] + execArgs +
                libs +
                script +
                self._getScriptArgs())
        cwd = self.currentInstancePrefs.getStringPref('cwd')
        if not cwd:
            cwd = os.path.dirname(script[-1])
        env = self._getDebuggerEnvironment()
        # Uncomment this next line if you want to "fix" bug 43269
        # by always turning off automatically loading rubygems.
        # Currently (when bug 43269 was logged, 2005-12-07),
        # I was disabling the flag when doing the interactive shell,
        # but not for normal debugging.  I've decided to leave it as is,
        # because there currently is no pref to turn it on, and it will
        # get in the way of users who rely on that behavior.
        #
        # Uncomment this line to turn off the <-r ubygems.rb> flag when
        # debugging.  This will break code that uses third-party modules
        # and doesn't explicitly load rubygems.
        
        # self._fix_RubyDebuggerEnv(env)
        if env.has_key('RUBYOPT') and env['RUBYOPT'].lower() == "rubygems":
            log.debug("env['RUBYOPT'] = %s", env['RUBYOPT'])
        
        res = self._doLaunch(argv, cwd, env)
        return res

    def _launchForRun(self):
        exe = self.getExecutable()
        return self._doLaunch(exe["argv"] + exe["script"], exe["cwd"], exe["env"])
    
    def getExecutable(self, asJSON = False):
        script = []
        noPrefs = False
        if not self.currentInstancePrefs:
            noPrefs = True
            self.currentInstancePrefs = self.prefService.effectivePrefs
        else:
            script = [self.currentInstancePrefs.getStringPref('filename')] + self._getScriptArgs()
            
        executable = self._determineExecutable()
        params = self.currentInstancePrefs.getString('executable-params', "")
        execArgs = _line2argv(params)
        argv = [str(executable)] + execArgs + self._getRubyIncArgv()
        cwd = self.currentInstancePrefs.getString('cwd', "")
        if len(script) and not cwd:
            cwd = os.path.dirname(script[0])
        env = self._getenv()
 
        result = {
            "argv": argv,
            "cwd": cwd,
            "env": env,
            "script": script
        }
 
        if asJSON:
            import json
            result = json.dumps(result)
            
        if noPrefs:
            self.currentInstancePrefs = None
 
        return result

class koNodeJSInvocation(koInterpreterInvocation):
    _language = "NodeJS"
    _reg_clsid_ = "{b4a197e0-3bb8-4297-b272-119302de11be}"
    _reg_contractid_ = "@activestate.com/koInvocation;1?type=Node.js"
    #_reg_registrar_ = RegisterAsInvocation, None

    _invocation_name_ = "Node.js"
    _invocation_description_ = "Node.js"
        
    def __init__(self):
        koInterpreterInvocation.__init__(self)
        self.checked_can_debug = 0
        self.can_debug = 0
        self.nodeJSInfo = Cc["@activestate.com/koAppInfoEx?app=NodeJS;1"].\
                    getService(Ci.koIAppInfoEx)
        koDirSvc = Cc["@activestate.com/koDirs;1"].\
                   getService(Ci.koIDirs)
        dbgpLibDir = os.path.join(koDirSvc.supportDir, 'dbgp', 'nodejslib')
        if sys.platform.startswith('win'):
            self.dbgpLibDir = dbgpLibDir.replace('\\', '/')
        else:
            self.dbgpLibDir = dbgpLibDir

    def _do_validate(self, invokeType):
        try:
            prefset = self.currentInstancePrefs
            checkFileExists(prefset, 'executable', "You must specify the Node.js executable used for the debug session")
            checkFileExists(prefset, 'filename', "You must specify the main Node.js script to be used")
            nodejs_version = self.nodeJSInfo.version;
            if not self.nodeJSInfo.valid_version:
                return 0, "", "Komodo does not support debugging with version %s of NodeJS.  Please upgrade to a later version." % nodejs_version

            cwd = prefset.getStringPref("cwd")
            if cwd and not os.path.isdir(cwd):
                raise PrefException("cwd", "Directory '%s' does not exist" % cwd)
            # Remove any default Chrome host and port arguments that may be
            # present from an initial JavaScript debug invocation that has since
            # been switched to a NodeJS one. Otherwise the node binary will
            # complain about unknown command line switches.
            execParams = prefset.getStringPref('executable-params')
            if execParams.find('--host=localhost --port=9222') >= 0:
                execParams = execParams.replace('--host=localhost --port=9222', '')
                prefset.setStringPref('executable-params', execParams)
        except PrefException, exc:
            return 0, exc.prefid, exc.msg
        return 1, None, None

    def _determineExecutable(self):
        # use pref'd default if one has been chosen
        nodeJSExe = self.effectivePrefs.getStringPref("nodejsDefaultInterpreter")
        if nodeJSExe and os.path.isfile(nodeJSExe):
            return nodeJSExe
        nodeJSExe = self.nodeJSInfo.executablePath
        if not nodeJSExe:
            installations = self.nodeJSInfo.FindInstallationPaths()
            if installations:
                if sys.platform.startswith("win"):
                    nodeJSExe = os.path.join(installations[0], "bin", "node.exe")
                else:
                    nodeJSExe = os.path.join(installations[0], "bin", "node")
        if not nodeJSExe or not os.path.isfile(nodeJSExe):
            log.error("No NodeJS interpreter could be found.")
            return ""
        return nodeJSExe

    def _getDBGPClientDriver(self):
        koDirs = Cc["@activestate.com/koDirs;1"].\
            getService(Ci.koIDirs)
        driver = 'node-dbgp'
        return os.path.join(koDirs.supportDir, 'dbgp', 'nodejslib', 'bin', driver)

    def _getScriptArgs(self):
        scriptArgs = []
        if self.currentInstancePrefs.hasPref('params'):
            params = self.currentInstancePrefs.getStringPref('params')
            if params:
                scriptArgs = _line2argv(params)
        return scriptArgs
    
    def _launchForDebug(self):
        script = self.currentInstancePrefs.getStringPref('filename')
        executable = self._determineExecutable()
        params = self.currentInstancePrefs.getStringPref('executable-params')
        execArgs = _line2argv(params)
        dbgpDriver = self._getDBGPClientDriver()
        cmdPort = str(self.currentInstancePrefs.getLongPref("debugger.listener-port"))
        argv = ([str(executable)]
                + execArgs
                + [dbgpDriver, "-p", cmdPort, script]
                + self._getScriptArgs())
        cwd = self.currentInstancePrefs.getStringPref('cwd')
        if not cwd:
            cwd = os.path.dirname(script)
        env = self._getenv()
        res = self._doLaunch(argv, cwd, env)
        return res

    def _launchForRun(self):
        exe = self.getExecutable()
        return self._doLaunch(exe["argv"] + exe["script"], exe["cwd"], exe["env"])
    
    def getExecutable(self, asJSON = False):
        script = []
        noPrefs = False
        if not self.currentInstancePrefs:
            noPrefs = True
            self.currentInstancePrefs = self.prefService.effectivePrefs
        else:
            script = [self.currentInstancePrefs.getStringPref('filename')] + self._getScriptArgs()
            
        executable = self._determineExecutable()
        params = self.currentInstancePrefs.getString('executable-params', "")
        execArgs = _line2argv(params)
        argv = [str(executable)] + execArgs
        cwd = self.currentInstancePrefs.getString('cwd', "")
        if len(script) and not cwd:
            cwd = os.path.dirname(script[0])
        env = self._getenv()
 
        result = {
            "argv": argv,
            "cwd": cwd,
            "env": env,
            "script": script
        }
 
        if asJSON:
            import json
            result = json.dumps(result)
            
        if noPrefs:
            self.currentInstancePrefs = None
 
        return result

class koChromeInvocation(koInterpreterInvocation):
    def __init__(self):
        koInterpreterInvocation.__init__(self)
        self.chromeInfo = Cc["@activestate.com/koAppInfoEx?app=%s;1" % self._language].\
                    getService(Ci.koIAppInfoEx)
        
    def getDefaultPreferences(self):
        """Adds default Chrome host and port arguments.
        Truly remote debugging sessions will specify a different host.
        In that case, Chrome will not be launched on the current host."""
        cat, inst = koInterpreterInvocation.getDefaultPreferences(self)
        inst.setStringPref('executable-params', '--host=localhost --port=9222')
        return cat, inst
        
    def get_supportedInvokeTypes(self):
        return INVOKE_DEBUG | INVOKE_RUN
        
    def _do_validate(self, invokeType):
        try:
            prefset = self.currentInstancePrefs
            checkFileExists(prefset, 'executable', "You must specify the Chrome executable used for the debug session")
        except PrefException, exc:
            return 0, exc.prefid, exc.msg
        return 1, None, None
        
    def _determineExecutable(self):
        chromeExe = self.effectivePrefs.getStringPref("javaScriptChromeExecutable")
        if chromeExe and os.path.isfile(chromeExe):
            return chromeExe
        chromeExe = self.chromeInfo.executablePath
        if not chromeExe or not os.path.isfile(chromeExe):
            log.error("No Chrome executable could be found.")
            return ""
        return chromeExe
        
    def _launchForDebug(self):
        env = self._getenv()
        file = self.currentInstancePrefs.getStringPref('filename')
        if not file.startswith('http://') and not file.startswith('https://'):
            file = 'file://' + file
        
        # Either launch Chrome with remote debugging enabled or connect to an
        # instance of Chrome on a different host. Which of these to do depends
        # on the executable arguments passed.
        remote_chrome_host, chrome_port = '', '9222'
        chromeArgs = []
        for arg in self.currentInstancePrefs.getStringPref('executable-params').split():
            if arg.startswith('--host='):
                remote_chrome_host = arg.split('=')[1]
                if __import__('socket').gethostbyname(remote_chrome_host) == '127.0.0.1':
                    remote_chrome_host = '' # launch Chrome locally
            elif arg.startswith('--port='):
                chrome_port = arg.split('=')[1]
            else:
                chromeArgs.append(arg)
        if not remote_chrome_host:
            # Launch Chrome.
            chromeExe = self._determineExecutable()
            chromeArgs = [' '.join(chromeArgs),
                          '--remote-debugging-port=' + chrome_port]
            argv = [chromeExe] + chromeArgs + [file]
            log.debug("Chrome argv: %r", argv)
            try:
                runutils.KoTerminalProcess(argv, cwd=os.getcwd(), env=env)
            except process.ProcessError, ex:
                msg = "Executing '%s' failed: %s\n" % (argv, str(ex))
                log.warn(msg)
                raise ServerException(nsError.NS_ERROR_FILE_EXECUTION_FAILED, msg)
        
        # Launch DBGP client.
        koDirSvc = Cc["@activestate.com/koDirs;1"].getService(Ci.koIDirs)
        dbgpDriverDir = os.path.join(koDirSvc.supportDir, 'dbgp', 'chromelib')
        env['PYTHONPATH'] = os.pathsep.join([koDirSvc.komodoPythonLibDir, dbgpDriverDir])
        pythonExe = koDirSvc.pythonExe
        dbgpDriver = os.path.join(dbgpDriverDir, 'dbgp.py')
        debug_port = str(self.currentInstancePrefs.getLongPref('debugger.listener-port'))
        dbgpDriverArgs = ['--port=%s' % debug_port,
                          '--chrome-port=%s' % chrome_port]
        if remote_chrome_host:
            dbgpDriverArgs.append('--chrome-host=%s' % remote_chrome_host)
        argv = [pythonExe] + [dbgpDriver] + dbgpDriverArgs + [file]
        log.debug("Chrome dbgp argv: %r", argv)
        log.debug("Chrome dbgp env: %r", env)
        return self._doLaunch(argv, os.getcwd(), env)
        
    def _launchForRun(self):
        env = self._getenv()
        file = self.currentInstancePrefs.getStringPref('filename')
        # Launch Chrome with remote debugging enabled just in case.
        chromeExe = self._determineExecutable()
        chromeArgs = [self.currentInstancePrefs.getStringPref('executable-params'),
                      '--remote-debugging-port=9222']
        argv = [chromeExe] + chromeArgs + [file]
        log.debug("Chrome argv: %r", argv)
        return self._doLaunch(argv, os.getcwd(), env)
        
class koJavaScriptInvocation(koChromeInvocation):
    _language = "JavaScript"
    _reg_clsid_ = "{03d6b8b6-c32d-4b47-bf9f-f6af939aecc6}"
    _reg_contractid_ = "@activestate.com/koInvocation;1?type=JavaScript"
    #_reg_registrar_ = RegisterAsInvocation, None

    _invocation_name_ = "JavaScript"
    _invocation_description_ = "JavaScript"

class koHTMLInvocation(koChromeInvocation):
    _language = "HTML"
    _reg_clsid_ = "{ae831d6e-b282-49ac-9f77-a345691428a1}"
    _reg_contractid_ = "@activestate.com/koInvocation;1?type=HTML"
    #_reg_registrar_ = RegisterAsInvocation, None

    _invocation_name_ = "HTML"
    _invocation_description_ = "HTML via Chrome"

class koHTML5Invocation(koChromeInvocation):
    _language = "HTML5"
    _reg_clsid_ = "{981c28a3-ef53-44df-854b-269cdb4af0fc}"
    _reg_contractid_ = "@activestate.com/koInvocation;1?type=HTML5"
    #_reg_registrar_ = RegisterAsInvocation, None

    _invocation_name_ = "HTML5"
    _invocation_description_ = "HTML5 via Chrome"

class koAngularJSInvocation(koChromeInvocation):
    _language = "AngularJS"
    _reg_clsid_ = "{ac8567fa-e264-4a20-90bb-2cdb05435119}"
    _reg_contractid_ = "@activestate.com/koInvocation;1?type=AngularJS"
    #_reg_registrar_ = RegisterAsInvocation, None

    _invocation_name_ = "AngularJS"
    _invocation_description_ = "AngularJS via Chrome"

class koJSXInvocation(koChromeInvocation):
    _language = "JSX"
    _reg_clsid_ = "{f2e5a3c1-fc7a-4758-b2bd-515a7ae8b6d2}"
    _reg_contractid_ = "@activestate.com/koInvocation;1?type=JSX"
    #_reg_registrar_ = RegisterAsInvocation, None

    _invocation_name_ = "JSX"
    _invocation_description_ = "JSX via Chrome"

class koRHTMLInvocation(koChromeInvocation):
    _language = "RHTML"
    _reg_clsid_ = "{fc17f129-04cf-45ff-afbc-8cc076b2f834}"
    _reg_contractid_ = "@activestate.com/koInvocation;1?type=RHTML"
    #_reg_registrar_ = RegisterAsInvocation, None

    _invocation_name_ = "RHTML"
    _invocation_description_ = "RHTML via Chrome"
