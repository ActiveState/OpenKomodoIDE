#!/usr/bin/env python

"""
    cvslib -- a somewhat Pythonic interface to 'cvs'

    'cvslib' attempts to provide a simple OO interface to 'cvs' that takes
    out the pain of parsing cvs's command line output.
"""
#Tech Notes:
#   - cvs failure modes:
#       - bogus date formats?
#
#TODO:
#   - spec out the commands that want to implement
#   - test suite
#   - perhaps have an interactive shell for testing/experimentation purposes
#   - understand failure modes for commands
#   - implement it
#   - perhaps have an option to be strict or lenient on the output parsing
#     like -Wall, default could be to just warn about output lines that are
#     not understood and optionally could 'raise' on those.

import os, sys, getopt, pprint, types, re
import logging
import socket

import process
import koprocessutils

#---- exceptions

class CVSLibError(Exception): pass



#---- global data

_version_ = (0, 1, 0)

log = logging.getLogger('cvslib')
#log.setLevel(logging.DEBUG)

#machinename = socket.gethostname()


# Root File parsing
# test case at end of this file

# the following "specification" for the Root files is taken from cvs 1.11.17
# source code in file root.c, line 392.  The regular expressions have been
# designed to match this, but with the local protocol being a bit more loose
# than the spec due to bugs we've run into in the past.  root.c from cvsnt was
# also examined for differences in root file structure, and is accounted for
# in the regular expressions, and with an additional parse function that
# parses the new root file format that is used in cvsnt.

# Access method specified, as in
# "cvs -d :(gserver|kserver|pserver):[[user][:password]@]host[:[port]]/path",
# "cvs -d [:(ext|server):][[user]@]host[:]/path",
# "cvs -d :local:e:\path",
# "cvs -d :fork:/path".

# from cvsnt 2.0.51c
# "cvs -d :(gserver|kserver|pserver)[;params...]:[[user][:password]@]host[:[port]]/path",
# "cvs -d [:(ext|server)[;params...]:]{access_method}[[user]@]host[:]/path",
# "cvs -d :local[;params...]:e:\path",
# "cvs -d :fork[;params...]:/path".

parser_re_strings = [
    r'^(?:\:(?P<protocol>local)(?:;(?P<params>.*?))?\:)?(?P<port>\d+)?(?P<path>(?:\D:)?[\\/].*)$',
    r'^(?:\:(?P<protocol>fork)(?:;(?P<params>.*?))?\:)?(?P<path>(?:\D:)?[\\/].*)$',
    r'^(?:\:(?P<protocol>ext|server|ntserver)(?:;(?P<params>.*?))?\:)?(?:\{(?P<access>.*?)\})?(?:(?P<user>[\w\-_]*)@)?(?P<server>[\w\.]*)(?:\:)?(?P<path>(?:\D:)?[\\/].*)$',
    r'^:(?P<protocol>\w+)(?:;(?P<params>.*?))?:(?:(?P<user>[^@:]*)(?:\:(?P<password>[^@:]*))?@)?(?:(?P<server>[^:/]*)(?:\:(?P<port>\d+)?)?)?(?P<path>(?:\D:)?[\\/].*)$'
    ]

parser_re = []
for r in parser_re_strings:
    parser_re.append(re.compile(r))

def _cvs_keyword(root_data, key, value):
    # normalize the keywords so accessing any of them works right

    # keywords can be: (found in cvsnt sources in root.c)
    #   method
    #   protocol
    #   username or user
    #   password or pass
    #   hostname or host
    #   port
    #   directory or path
    #   proxy
    #   proxyport or proxy_port
    #   tunnel or proxyprotocol or proxy_protocol
    #   proxyuser or proxy_user
    #   proxypassword or proxy_password

    # first, unquote the value. this is as much as cvsnt does, so we wont go any
    # futher (ie. escape/unescape quotes)
    
    if value[0] in ['"',"'"] and value[-1] == value[0]:
        value = value[1:-1]
    
    if key in ['username','user']:
        root_data['username'] = root_data['user'] = value
    elif key in ['password', 'pass']:
        root_data['password'] = root_data['pass'] = value
    elif key in ['hostname', 'host']:
        root_data['server'] = root_data['hostname'] = root_data['host'] = value
    elif key in ['directory', 'path']:
        root_data['directory'] = root_data['path'] = value
    elif key in ['proxyport', 'proxy_port']:
        root_data['proxyport'] = root_data['proxy_port'] = value
    elif key in ['tunnel', 'proxyprotocol', 'proxy_protocol']:
        root_data['tunnel'] = root_data['proxyprotocol'] = root_data['proxy_protocol'] = value
    elif key in ['proxyuser', 'proxy_user']:
        root_data['proxyuser'] = root_data['proxy_user'] = value
    elif key in ['proxypassword', 'proxy_password']:
        root_data['proxypassword'] = root_data['proxy_password'] = value
    else:
        # cvsnt errors out here, but we dont really care, we'll error out later
        # if no path exists
        root_data[key]=value

def _cvs_re_parse(root_in):
    root_data = {}
    for r in parser_re:
        data = r.match(root_in)
        if data:
            root_data = data.groupdict()
            break

    # parse the optional params
    if root_data and \
       root_data.has_key('params') and \
       root_data['params']:

        params = re.split(',|;',root_data['params'])
        for param in params:
            key,value = param.split('=')
            _cvs_keyword(root_data, key, value)
    
    return root_data

def _cvs_new_style_root_parser(root_in):
    # this is the 'new style' Root file format used in CVSNT
    # format is [key=value,key=value...]
    # data may be quoted, escaped, etc. as in a command line or env var
    root_data = {}
    if root_in[0] == '[' and root_in.find(']') > 0:
        end_params = root_in.find(']')
        params = re.split(',|;',root_in[1:end_params])
        for param in params:
            key,value = param.split('=')
            _cvs_keyword(root_data, key, value)
    return root_data

def _cvs_root_parser(root_in):
    root_data = _cvs_new_style_root_parser(root_in)
    if not root_data:
        root_data = _cvs_re_parse(root_in)
        if not root_data and ":" in root_in:
            # Best guess - bug 93569.
            root_data = {
                'path': root_in.split(":", 2)[-1]
            }
    return root_data
    

#---- public stuff

class CVS:
    """Proxy to 'cvs' command line app.

    Usage:
        import cvslib
        cvs = CVS(<optional args...>)   # see CVS.__init__.__doc__
        result = cvs.checkout(...)      # see CVS.checkout.__doc__
        # work with 'result'...

    Methods are provided (or will be) for many of cvs's commands. Every
    command method returns a dict of the following format:
        {'stdout': <stdout output from running cvs>,
         'stderr': <stderr output from running cvs>,
         'retval': <cvs exit value>,
         # ... other possible command-dependent results ...
        }

    """
    #TODO:
    #   - Refine this output format after some experience.
    #   - How are Unicode filenames dealt with?

    def __init__(self, cvs='cvs', cvsroot=None, skipCvsrc=0, skipLogging=0,
                 dryRun=0, quiet=None, fileAttrib=None, sets=[],
                 tmpDir=None, trace=0, zipLevel=None, rsh=None):
        """Create a CVS proxy object.

        "cvs" indicates the cvs client executable that will be driven.
        "cvsroot" (-d) specifies a repository
        "skipCvsrc" (-f) suppresses reading of the .cvsrc file
        "skipLogging" (-l) suppresses logging of the command in
            CVSROOT/history
        "dryRun" (-n) specifies to not change any files in the repository or
            working copy, i.e. fake it
        "quiet" (-q, -Q) can be None [default], 'somewhat', or 'really'
        "fileAttrib" (-w, -r) can be None [default] (like no option),
            'read-write' or 'read-only' to specify that checked out files
            should have this attribute
        "sets" (-s) is a list [by default empty] of cvs user (VAR, VAL) pairs
        "tmpDir" (-T) tells cvs to use the given dir for temp files
        "trace" (-t) returns a trace of cvs execution.
        "zipLevel" (-z) is either None [default] or a valid numeric
            compression level for network traffic
        """
        #XXX Perhaps add a separate .configure(optv)?
        self._cvs = cvs
        self._rsh = rsh
        self._optv = []
        # Abortable process handle.
        self._processHelper = process.AbortableProcessHelper()

        self._cvsroot = cvsroot
        if self._cvsroot:
            self._optv += ['-d', self._cvsroot]
        self._skipCvsrc = skipCvsrc
        if self._skipCvsrc:
            self._optv += ['-f']
        self._skipLogging = skipLogging
        if self._skipLogging:
            self._optv += ['-l']
        self._dryRun = dryRun
        if self._dryRun:
            self._optv += ['-n']
        self._quiet = quiet
        if self._quiet == 'somewhat':
            self._optv += ['-q']
        elif self._quiet == 'really':
            self._optv += ['-Q']
        elif self._quiet is not None:
            raise CVSLibError("Invalid 'quiet' value: '%s'"\
                              % self._quiet)
        self._fileAttrib = fileAttrib
        if self._fileAttrib == 'read-write':
            self._optv += ['-w']
        elif self._fileAttrib == 'read-only':
            self._optv += ['-r']
        elif self._fileAttrib is not None:
            raise CVSLibError("Invalid 'fileAttrib' value: '%s'"\
                              % self._fileAttrib)
        self._sets = sets
        for set in self._sets:
            self._optv += ['-s', '%s=%s' % set]
        self._tmpDir = tmpDir
        if self._tmpDir:
            self._optv += ['-T', self._tmpDir]
        self._trace = trace
        if self._trace:
            self._optv += ['-t', self._trace]
        self._zipLevel = zipLevel
        if self._zipLevel:
            self._optv += ['-z', self._zipLevel]

        self.re_status = None


    def _compile_status_regexes(self):
        # Parse blobs like this:
        #   ===================================================================
        #   File: xmethods.php      Status: Up-to-date
        #   
        #      Working revision:    1.1
        #      Repository revision: 1.1     /repository/pear/SOAP/test/xmethods.php,v
        #      Sticky Tag:          (none)
        #      Sticky Date:         (none)
        #      Sticky Options:      (none)
        #   
        #   cvs server: Examining tools
        #   ===================================================================
        #   File: genproxy.php      Status: Up-to-date
        #   
        #      Working revision:    1.1
        #      Repository revision: 1.1     /repository/pear/SOAP/tools/genproxy.php,v
        #      Sticky Tag:          (none)
        #      Sticky Date:         (none)
        #      Sticky Options:      (none)
        #    ===================================================================
        #    File: no file xslt.py           Status: Locally Removed
        #
        #       Working revision:    -1.1.1.1        Thu Jul 11 19:24:37 2002
        #       Repository revision: 1.1.1.1 e:\repository/test/test/xslt.py,v
        #       Sticky Tag:          (none)
        #       Sticky Date:         (none)
        #       Sticky Options:      (none)
        #
        #    ===================================================================
        #    File: koICVS.idl        Status: Locally Added
        #
        #       Working revision:    New file!
        #       Repository revision: No revision control file
        #       Sticky Tag:          (none)
        #       Sticky Date:         (none)
        #       Sticky Options:      (none)

        self.re_status = re.compile('''
            .*?File:\s(.*?)\s*?                         # filename
            Status:\s*(.*?)[\r\n]                       # status
            \s+.*?:\s+([-|\d|\.]*)(.*?)[\r\n]           # local rev, date
            \s+.*?:\s+([-|\d|\.]*)(.*?)[\r\n]           # cvs rev, repository path
            \s+.*?:\s+(.*?)[\r\n]                       # sticky tag
            \s+.*?:\s+(.*?)[\r\n]                       # sticky date
            \s+.*?:\s+(.*?)[\r\n]                       # sticky options
            ''',re.S|re.M|re.VERBOSE)

    def _parseCVSOptv(self, optv):   # XXX Not currently used.
        """Parse out a safe (and canonicalized) option list from 'optv'.

        "Safe" because some options are not appropriate for further
        invocation, e.g. allowing '-H' into self.optv will result in
        cvs.add(...) calling "cvs -H add ...", which is obviously not
        intended.
        """
        safeOptv = []
        optlist, args = getopt.getopt(optv, 'ab:d:e:fHlnqQrs:T:tvwxz:',
            ['allow-root=', 'help', 'help-options', 'help-synonyms',
            'help-commands', '--version'])
        for opt, optarg in optlist:
            #XXX Unresolved issues w.r.t. option handling:
            # -f : Should we be using this to avoid the surprise of -q/-Q
            #      and other options being in the user's .cvsrc?, but
            #      that might break usage. Jeesh! What to do?
            # -q, -Q: suppress these, but may want to play with -q to see
            #      if useful. *Should* these be suppressed? Especially
            #      if we are returning the output lines.
            # -t :  suppress, but may want to play with it  (t==trace)
            #      *Should* these be suppressed? Especially if we are
            #      returning the output lines.
            # XXX parse .cvsrc file
            # XXX warn about usage of .cvswrappers ?
            if opt == '--allow-root':
                msg = "Dropping '%s=%s' option. This is rare option."\
                      % (opt, optarg)
                raise CVSLibError(msg)
            elif opt in ('-x', '-a'):
                msg = "Cannot use the '%s' option. This is only used "\
                      "for GSSAPI (gserver). This module has not been "\
                      "tested for this." % opt
                raise CVSLibError(msg)
            elif opt == '-b':
                msg = "Do not use the '-b' option. It is an obselete CVS "\
                      "option."
                raise CVSLibError(msg)
            elif opt in ('-H', '-v', '--version', '--help-options',
                         '--help-synonyms', '--help-commands'):
                msg = "The '%s' option is not appropriate here. Its "\
                      "usage would override subsequent CVS commands." % opt
                raise CVSLibError(msg)
            else:
                # -s    Trouble (getopt cannot handle optarg= VAR=VAL).
                #       Is it *really* trouble?
                safeOptv += [opt, optarg]
        return safeOptv

    def _run(self, argv, cwd=None, require_cvs_root=False, terminalHandler=None,
             ignore_retval=False):
        output = ''
        error = ''
        try:
            env = koprocessutils.getUserEnv()
            if self._rsh:
                env['CVS_RSH'] = self._rsh
            if require_cvs_root:
                # Ensure the CVS/Root file exists. This will raise an
                # CVSLibError exception when this file does not exist.
                root_contents = self.getRootFileContents(cwd)
                # it appears that we don't really need CVS_RSH to be set.
                #_root = _cvs_root_parser(root_contents)
                #if _root['protocol'] == 'ext' and 'CVS_RSH' not in env:
                #    raise CVSLibError("Cannot execute CVS, CVS_RSH not set in environment.\n[%s]" % cwd)

            log.debug("cvslib: run argv=%r, cwd=%r", argv, cwd)
            #print("cvslib: run %r..." % (argv, ))
            p = self._processHelper.ProcessOpen(cmd=argv, cwd=cwd, env=env,
                                                universal_newlines=True)
            if terminalHandler:
                terminalHandler.hookIO(p.stdin, p.stdout, p.stderr, " ".join(argv))
                p.wait()
                # Output and errors have gone to the terminal.
            else:
                output, error = p.communicate()

            retval = p.returncode
            if retval != 0 and not ignore_retval:
                # it was terminated by a signal
                error_msg = "Error running '%s', it did not exit "\
                            "properly: rv=%d\n" % (" ".join(argv), retval)
                if error:
                    error_msg += "\nStderr:\n%s" % (''.join(error), )
                raise CVSLibError(error_msg)

        except Exception, ex:
            log.error("Error running %s - %r", argv, ex)
            raise
        finally:
            # The process is as good as done.
            self._processHelper.ProcessDone()

        return output, error, p.returncode

    def abort(self):
        self._processHelper.ProcessAbort()
        
    def getheadref(self, cwd=None):
        # parse curdir/CVS/Repository and Root to get the base directory
        if not cwd:
            cwd = os.getcwd()
        argv = [self._cvs] + self._optv + ['status', '-l']
        output, error, retval = self._run(argv, cwd)
        
        for line in output.split("\n"):
            if "Working rev" in line:
                return line.split("\t")[-1]
        
        return ""
    
    def _getRootDirectory(self, cwd=None):
        # parse curdir/CVS/Repository and Root to get the base directory
        if not cwd:
            cwd = os.getcwd()
            
        rootDir = None
        while cwd:
            if os.path.isfile(os.path.join(cwd,"CVS","Repository")):
                rootDir = cwd
                break
            
            _cwd = os.path.abspath(os.path.join(cwd, os.pardir))
            if _cwd == cwd:
                break # drive root
            cwd = _cwd
            
        return rootDir

    def _getBaseDirectory(self, cwd=None):
        # parse curdir/CVS/Repository and Root to get the base directory
        if not cwd:
            cwd = os.getcwd()
        repository = os.path.join(cwd,"CVS","Repository")
        try:
            f_rep = open(repository,'r')
            basedir = f_rep.readline().strip()
            f_rep.close()
            if basedir[0] != '/':
                root_contents = self.getRootFileContents(cwd)
                f_root = _cvs_root_parser(root_contents)
                try:
                    basedir = os.path.join(f_root['path'],basedir)
                except KeyError:
                    raise CVSLibError("Unable to parse CVS root: %r, path: %r" %
                                      (root_contents, cwd))
            basedir = os.path.normpath(basedir)
            basedir = basedir.replace('\\','/')
        except IOError, e:
            # not a cvs directory!
            raise CVSLibError("Error running status, '%s' not a CVS directory!" % cwd)
        return basedir

    def getRootFileContents(self, file):
        """Return the contents of the repository Root file."""
        if not file:
            file = os.getcwd()
        if os.path.isdir(file):
            basepath = file
        else:
            basepath = os.path.dirname(file)
        root = os.path.join(basepath,"CVS","Root")
        try:
            f_root = open(root,'r')
            cvsroot = f_root.readline().strip()
            f_root.close()
        except IOError, e:
            # not a cvs directory!
            raise CVSLibError("Error running status, '%s' not a CVS directory!" % basepath)
        return cvsroot

    def isEntry(self, path=None):
        """Determine whether a path is in a CVS Repository.
        """
        if path:
            basepath = os.path.dirname(path)
        else:
            path = basepath = os.getcwd()
        entries = self.getEntries(basepath)
        return path in entries.keys()
    
    def getEntries(self, dir=None):
        """Get the CVS entries for a directory from the local Entries file.
        """
        if not dir:
            dir = os.getcwd()
        entries = os.path.join(dir,"CVS","Entries")
        if not os.path.exists(entries):
            raise CVSLibError("Not a cvs repository '%s'" % dir)
        f = open(entries,'r')
        if not f:
            raise CVSLibError("Unable to open CVS Entries for '%s'" % dir)
        lines = f.readlines()
        f.close()
        files = {}
        for line in lines:
            info = line.split('/')
            # Skip lines like this:
            #   D/stress////
            #   D
            if len(info) < 5: continue
            file = {'type':info[0] or 'F',
                    'name':info[1],
                    'rev':info[2],
                    'date':info[3],
                    'options':info[4]}
            filename = os.path.join(dir,file['name'])
            files[filename] = file
        return files
        
    def add(self, files, mode=None, msg=None, cwd=None):
        """Add a new file(s) to an existing project.

        "files" is a single file name or list of file names.
        "mode" (-k) specifies the keyword substitution mode of the new
            file(s).
        "msg" (-m) is recorded as the creation message of the file. This is
            NOT the same as a checkin message.
        """
        #TODO:
        #   - parse the output to provide some useful metadata in 'result'
        if not isinstance(files, types.ListType)\
           and not isinstance(files, types.TupleType):
            files = [files]

        optv = []
        if mode: optv += ['-k%s' % mode]
        if msg: optv += ['-m', msg]

        argv = [self._cvs] + self._optv + ['add'] + optv + files
        output, error, retval = self._run(argv, cwd)

        result = {'argv': argv,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval}
        return result

    def admin(self, files=[], descFile=None, descString=None,
              strictLocking=None, mode=None, msg=[], outdate=None,
              quiet=0, state=None, cwd=None):
        """Add a new file(s) to an existing project.

        "files" is a single file name or list of file names.
        "descFile" (-t) replaces the creation message of the file(s) with the
            contents of the given filename.
        "descString" (-t-) replaces the creation message of the file(s) with
            the given string.
        "strictLocking" (-L, -U) is either None, True or False.
        "mode" (-k) sets keyword substitution mode of the file(s).
        "msg" (-m) is a 2-tuple of (REV, MSG) pairs (or a list of these).
            This will change log message of that revision to the given
            message.
        "outdate" (-o) will delete the specified revision range. The range
            can be specified as REV1::REV2, ::REV, REV::, REV, REV1:REV2,
            :REV or REV:. See the CVS book for details.
        "quiet" (-q) tells CVS to run quietly (analogous to the constructor's
            quiet='somewhat').
        "state" (-s) is a string of the form STATE[:REV]. It sets the state
            attribute of revision REV (by default the last rev on the default
            branch) to STATE.

        Notes:
            o The following 'cvs admin' options are not supported: -A, -a,
              -b, -c, -e, -i, -I, -l, -N, -n, -u, -V, -x. (All of those
              except -b, -l, and -u are obselete.
        """
        #TODO:
        #   - parse the output to provide some useful metadata in 'result'
        if not isinstance(files, types.ListType)\
           and not isinstance(files, types.TupleType):
            files = [files]
        if msg and not (isinstance(msg[0], types.TupleType)\
                        or isinstance(msg[0], types.ListType)):
            msg = [msg]

        optv = []
        if descFile: optv += ['-t%s' % descFile]
        if descString: optv += ['-t-%s' % descString]
        if strictLocking is None:
            pass
        elif strictLocking:
            optv += ['-L']
        else:
            optv += ['-U']
        if mode: optv += ['-k%s' % mode]
        for m in msg:
            optv += ['-m%s:%s' % m]
        if outdate: optv += ['-o%s' % outdate]
        if quiet: optv += ['-q']
        if state: optv += ['-s%s' % state]

        argv = [self._cvs] + self._optv + ['admin'] + optv + files
        output, error, retval = self._run(argv, cwd)

        result = {'argv': argv,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval}
        return result

    def annotate(self, files=[], date=None, force=0, recursive=None,
                 rev=None, cwd=None):
        """Show who last modified each line of each file and when.

        "files" is a single file name or list of file names.
        "date" (-D) is a string describing the date as of which to checkout
            revisions.
        "force" (-f)
        "recursive" can be one of None [default], True (-R) or False (-l).
        "rev" (-r)
        """
        #TODO:
        #   - parse the output to provide some useful metadata in 'result'
        if not isinstance(files, types.ListType)\
           and not isinstance(files, types.TupleType):
            files = [files]
        if date and rev:
            raise CVSLibError("Cannot specify both a 'rev' and a 'date' "\
                              "for annotate.")

        optv = []
        if date: optv += ['-D', date]
        if force: optv += ['-f']
        if recursive is None:
            pass
        elif recursive:
            optv += ['-R']
        else:
            optv += ['-l']
        if rev: optv += ['-r', rev]

        argv = [self._cvs] + self._optv + ['annotate'] + optv + files
        output, error, retval = self._run(argv, cwd)

        result = {'argv': argv,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval}
        return result

    def checkout(self, modules, cat=0, date=None, dir=None, force=0,
                 join=None, mode=None, print_=0, prune=0, recursive=None,
                 resetStickyTags=0, rev=None, status=0, cwd=None,
                 cvsroot=None, export=False, terminalHandler=None):
        """Check out a module from the repository into a working copy.

        "modules" is a single module name or list of module names.
        "cat" (-c) the module database.
        "date" (-D) is a string describing the date as of which to checkout
            revisions.
        "dir" (-d) is a directory in which to checkout (instead of the module
            name).
        "force" (-f)
        "join" (-j) is a single '-j'-style argument, or a list of them.
        "mode" (-k) substitutes RCS keywords in checked-out files with the
            given mode (sticky).
        "print_" (-p) prints file contents to stdout.
        "prune" (-P) prunes empty directories.
        "recursive" can be one of None [default], True (-R) or False (-l).
        "resetStickyTags" (-A)
        "rev" (-r)
        "status" (-s)
        "cvsroot" - the cvs root to checkout from.
        "export" - use the cvs export command instead of checkout.

        Returns a dict with the std keys (see CVS.__doc__) plus a 'files'
        key whose value is a list of dicts of the form:
            {'status': <U|P|A|R|C|M|?>,
             'file': <the filename>}
        """
        #TODO:
        #   - finish docstring
        if not isinstance(modules, types.ListType)\
           and not isinstance(modules, types.TupleType):
            modules = [modules]
        if join is None:
            join = []
        elif not isinstance(join, types.ListType)\
           and not isinstance(join, types.TupleType):
            join = [join]
        if len(join) > 2:
            raise CVSLibError("Too many 'join' elements: join=%s." % join)
        if date and rev:
            raise CVSLibError("Cannot specify both a 'rev' and a 'date' "\
                              "for checkout.")

        optv = []
        if cat: optv += ['-c']
        if date: optv += ['-D', date]
        if dir: optv += ['-d', dir]
        if force: optv += ['-f']
        for j in join: optv += ['-j', j]
        if mode: optv += ['-k%s' % mode]
        if print_: optv += ['-p']
        if prune: optv += ['-P']
        if recursive is None:
            pass
        elif recursive:
            optv += ['-R']
        else:
            optv += ['-l']
        if resetStickyTags: optv += ['-A']
        if rev: optv += ['-r', rev]
        if status: optv += ['-s']

        command_name = 'checkout'
        if export:
            command_name = 'export'
        argv = [self._cvs] + self._optv
        if cvsroot:
            argv += ["-d", cvsroot]
        argv += [command_name] + optv + modules
        output, error, retval = self._run(argv, cwd, require_cvs_root=False,
                                          terminalHandler=terminalHandler)

        result = {'argv': argv,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval,
                  'files': self._getCheckoutUpdateFiles(output, error)}
        return result

    def commit(self, files=[], force=0, msgFile=None, msg=None,
               recursive=None, rev=None, skipPrograms=0, cwd=None):
        """Commit changes from a working copy to the repository.

        "files" is a single file name or list of file names.
        "force" (-f) a commit even if no change have been made.
        "msgFile" (-F) will use the contents of the given file as the commit
            message.
        "msg" (-m) will use the given string as the commit message.
        "recursive" can be one of None [default], True (-R) or False (-l).
        "rev" (-r) commits to the given (new or branch) revision.
        "skipPrograms" (-n) will cause module programs (on the server) to be
            skipped.
        """
        #TODO:
        #   - parse the output to provide some useful metadata in 'result'
        # XXX does a 'cvs ci' die if it looks like there are still conflict
        #     markers?
        if not isinstance(files, types.ListType)\
           and not isinstance(files, types.TupleType):
            files = [files]
        if msg and msgFile:
            raise CVSLibError("Cannot specify both 'msg' and 'msgFie'.")
        if not msg and not msgFile:
            err = "You must specify one of either 'msg' or 'msgFile', "\
                  "otherwise cvs will launch a form in your current editor, "\
                  "which is something this module does not want to get into."
            raise CVSLibError(err)

        optv = []
        if force: optv += ['-f']
        if msgFile: optv += ['-F', msgFile]
        if msg: optv += ['-m', msg]
        if recursive is None:
            pass
        elif recursive:
            optv += ['-R']
        else:
            optv += ['-l']
        if rev: optv += ['-r', rev]
        if skipPrograms: optv += ['-n']

        argv = [self._cvs] + self._optv + ['commit'] + optv + files
        output, error, retval = self._run(argv, cwd)

        result = {'argv': argv,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval}
        return result

    def diff(self, files=[], date=None, mode=None, recursive=None, revs=[], cwd=None,
             diffOpts=[]):
        """Commit changes from a working copy to the repository.

        "files" is a single file name or list of file names.
        "date" (-D) is a string describing the date as of which to checkout
            revisions.
        "recursive" can be one of None [default], True (-R) or False (-l).
        "revs" (-r) is a single REV string or a list of up to two of them.
        "diffOpts" is a list of GNU diff options. (See the GNU diff
            documentation for details.) Common options are:
                -B, -b, -w  Various forms of ignoring whitespace differences.
                -c, -C NUM  Context diff output format.
                -i          Case-insensitive diffing.
                -u          Unified diff output format.
        """
        #TODO:
        #   - parse the output to provide some useful metadata in 'result'
        if not isinstance(files, types.ListType)\
           and not isinstance(files, types.TupleType):
            files = [files]
        if revs is None:
            revs = []
        elif not isinstance(revs, types.ListType)\
           and not isinstance(revs, types.TupleType):
            revs = [revs]
        if len(revs) > 2:
            raise CVSLibError("Too many 'rev' elements: revs=%s." % revs)
        if date and revs:
            raise CVSLibError("Cannot specify both 'revs' and a 'date' "\
                              "for diff.")

        optv = []
        if date: optv += ['-D', date]
        if recursive is None:
            pass
        elif recursive:
            optv += ['-R']
        else:
            optv += ['-l']
        for rev in revs:
            optv += ['-r', rev]
        optv += diffOpts

        argv = [self._cvs] + self._optv + ['diff'] + optv + files
        # Note: cvs diff has a retval of 1 when there are changes and/or errors,
        #       and a retval of 0 if there are no changes. Thus we need to
        #       ensure the run function ignores the return value.
        output, error, retval = self._run(argv, cwd, ignore_retval=True)

        result = {'argv': argv,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval}
        return result

    def history(self, fileSubstrings=[],
                records=[], commitRecords=0, tagRecords=0, allRecords=0,
                    checkoutRecords=0,
                sinceDate=None, sinceRev=None, sinceSubstring=None,
                    sinceTag=None,
                mostRecent=0, modulesMostRecent=[], filesMostRecent=[],
                modules=[],
                allUsers=0, users=[],
                dirs=[], showcwd=0,
                timezone=None,
                _historyFile=None, cwd=None):
        """Show a history of repository activity
        
        From checkout, commit, rtag, update, and release commands.

        "fileSubstrings" is a single file substring or list of such.
        
        Options to select which records types to report on:
            "records" (-x) is a list of record types, valid types are:
                T - Tag 
                O - Checkout 
                E - Export 
                F - Release 
                W - Update (newly obsolete file removed from working copy) 
                U - Update (file was checked out over user file) 
                C - Update (merge, with conflicts) 
                G - Update (merge, no conflicts) 
                M - Commit (file was modified) 
                A - Commit (file was added) 
                R - Commit (file was removed) 
            "commitRecords" (-c) will select just commit records
            "tagRecords" (-T)
            "allRecords" (-e)
            "checkoutRecords" (-o) This is the default.

        Options to limit how far back in history to report on:
            "sinceDate" (-D)
            "sinceRev" (-r)
            "sinceSubstring" (-b) will dhow data back to a record containing
                the given string in the module name, file name, or repository
                path
            "sinceTag" (-t) This differs from "sinceRev" in that it only
                looks in the CVSROOT/history file, not in the RCS files, and
                is therefore much faster.

        Options to limit to recent records:
            "mostRecent" (-l) shows the last event of each project.
            "modulesMostRecent" (-n) shows the last event for each of the
                given modules.
            "filesMostRecent" (-f) show the most recent event for each of the
                given files.

        Other options:
            "modules" (-m) provides a full report about the given modules.
            "allUsers" (-a) shows history for all users (default is self).
            "users" (-u) shows history for all the given users.
            "dirs" (-p) shows data for the given subdirs in the repository.
            "showcwd" (-w) show records for the current working directory.
            "timezone" (-z) displays times in output as for the given
                timezone (e.g. UTC, GMT, BST, CDT, CCT).
            "_historyFile" (-X) tells cvs to use the given history file
                instead of the usual CVSROOT/history. This is for debugging
                and is official NOT SUPPORTED by cvs.
        """
        #TODO:
        #   - parse the output to provide some useful metadata in 'result'.
        #   - test with no CVSROOT/history file in the repository.
        if not isinstance(fileSubstrings, types.ListType)\
           and not isinstance(fileSubstrings, types.TupleType):
            fileSubstrings = [fileSubstrings]
        if not isinstance(records, types.ListType)\
           and not isinstance(records, types.TupleType):
            records = [records]
        if not isinstance(modulesMostRecent, types.ListType)\
           and not isinstance(modulesMostRecent, types.TupleType):
            modulesMostRecent = [modulesMostRecent]
        if not isinstance(filesMostRecent, types.ListType)\
           and not isinstance(filesMostRecent, types.TupleType):
            filesMostRecent = [filesMostRecent]
        if not isinstance(modules, types.ListType)\
           and not isinstance(modules, types.TupleType):
            modules = [modules]
        if not isinstance(users, types.ListType)\
           and not isinstance(users, types.TupleType):
            users = [users]
        if not isinstance(dirs, types.ListType)\
           and not isinstance(dirs, types.TupleType):
            dirs = [dirs]

        optv = []
        if records: optv += ['-x', ''.join(records)]
        if commitRecords: optv += ['-c']
        if tagRecords: optv += ['-T']
        if allRecords: optv += ['-e']
        if checkoutRecords: optv += ['-c']
        if sinceDate: optv += ['-D']
        if sinceRev: optv += ['-r']
        if sinceSubstring: optv += ['-b']
        if sinceTag: optv += ['-t']
        if mostRecent: optv += ['-l']
        for m in modulesMostRecent: optv += ['-n', m]
        for f in filesMostRecent: optv += ['-f', f]
        for m in modules: optv += ['-m', m]
        if allUsers: optv += ['-a']
        for u in users: optv += ['-u', u]
        for d in dirs: optv += ['-p', d]
        if showcwd: optv += ['-w']
        if timezone: optv += ['-z', timezone]
        if _historyFile: optv += ['-X', _historyFile]

        argv = [self._cvs] + self._optv + ['history'] + optv + fileSubstrings
        output, error, retval = self._run(argv, cwd)

        result = {'argv': argv,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval}
        return result

    def log(self, files=[], defaultBranchOnly=0, dates=[], headersOnly=0,
            headersAndDescOnly=0, omitTags=0, printRCSFileName=0,
            recursive=None, revs=[], states=[], users=[], cwd=None):
        """Show log message for a project or project files.

        "files" is a single file name or list of file names.
        "defaultBranchOnly" (-b)
        "dates" (-d) is a date or date range (see the CVS book for details)
            or a list of such, to select revisions in these date ranges.
        "headersOnly" (-h)
        "headersAndDescOnly" (-t)
        "omitTags" (-N)
        "printRCSFileName" (-R)
        "recursive" can be either None (default) or False (-l).
        "revs" (-r) is a rev/branch range (or a list of such) to select
            revisions within these ranges. Use the empty string to generate a
            bare '-r' (latest rev on the default branch).
        "states" (-s) if a state or list of states to select revisions with
            one of the given values.
        "users" (-w) is a username or list of usernames to select revisions
            by one of the given usernames.
        """
        #TODO:
        #   - parse the output to provide some useful metadata in 'result'
        if not isinstance(files, types.ListType)\
           and not isinstance(files, types.TupleType):
            files = [files]
        if not isinstance(dates, types.ListType)\
           and not isinstance(dates, types.TupleType):
            dates = [dates]
        if not isinstance(revs, types.ListType)\
           and not isinstance(revs, types.TupleType):
            revs = [revs]
        if not isinstance(states, types.ListType)\
           and not isinstance(states, types.TupleType):
            states = [states]
        if not isinstance(users, types.ListType)\
           and not isinstance(users, types.TupleType):
            users = [users]

        optv = []
        if defaultBranchOnly: optv += ['-b']
        if dates:
            # Always quote to protect possible '<' and '>' from the shell.
            optv += ['-r"%s"' % ';'.join(revs)]
        if headersOnly: optv += ['-h']
        if headersAndDescOnly: optv += ['-t']
        if omitTags: optv += ['-N']
        if printRCSFileName: optv += ['-R']
        if recursive is None:
            pass
        elif recursive:
            raise CVSLibError("'cvs log' does not support the '-R' option "\
                              "to specify recursive processing.")
        else:
            optv += ['-l']
        if revs:
            optv += ['-r%s' % ','.join(revs)]
        if states:
            optv += ['-s%s' % ','.join(states)]
        if users:
            optv += ['-w%s' % ','.join(users)]

        argv = [self._cvs] + self._optv + ['log'] + optv + files
        output, error, retval = self._run(argv, cwd)

        result = {'argv': argv,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval}
        return result

    #def login(self, passwd):
    #   XXX come back to this

    def logout(self, cwd=None):
        """Remove the password for this repository from .cvspass."""
        #TODO:
        #   - parse the output to provide some useful metadata in 'result'
        argv = [self._cvs] + self._optv + ['logout']
        output, error, retval = self._run(argv, cwd)

        result = {'argv': argv,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval}
        return result

    def rdiff(self, files=[], date=None, force=0, outputFormat=None,
              recursive=None, revs=[], top=0, cwd=None):
        """Diff revisions of files on the repository.

        "files" is a single file name or list of file names.
        "date" (-D) is a string describing the date as of which to checkout
            revisions.
        "force" (-f)
        "outputFormat" (-c, -u) can be one of None (default), 'c' or
            'context', 'u' or 'unified', 's' or 'summary'.
        "recursive" can be one of None [default], True (-R) or False (-l).
        "revs" (-r) is a single REV string or a list of up to two of them.
        "top" (-t) specifies to diff the last two revisions.
        """
        #TODO:
        #   - parse the output to provide some useful metadata in 'result'
        if not isinstance(files, types.ListType)\
           and not isinstance(files, types.TupleType):
            files = [files]
        if revs is None:
            revs = []
        elif not isinstance(revs, types.ListType)\
           and not isinstance(revs, types.TupleType):
            revs = [revs]
        if len(revs) > 2:
            raise CVSLibError("Too many 'rev' elements: revs=%s." % revs)
        if date and revs or date and top or revs and top:
            raise CVSLibError("Cannot specify more than one of 'date', "\
                              "'revs' or 'top' for rdiff")

        optv = []
        if date: optv += ['-D', date]
        if force: optv += ['-f']
        if outputFormat is None:
            pass
        elif outputFormat in ('c', 'context'):
            optv += ['-c']
        elif outputFormat in ('u', 'unified'):
            optv += ['-u']
        elif outputFormat in ('s', 'summary'):
            optv += ['-s']
        if recursive is None:
            pass
        elif recursive:
            optv += ['-R']
        else:
            optv += ['-l']
        for rev in revs:
            optv += ['-r', rev]
        if top:
            optv += ['-t']

        argv = [self._cvs] + self._optv + ['rdiff'] + optv + files
        output, error, retval = self._run(argv, cwd)

        result = {'argv': argv,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval}
        return result

    def remove(self, files=[], force=0, recursive=None, cwd=None):
        """Removes a file from a project.

        "files" is a single file name or list of file names.
        "force" (-f) deletes the file from disk before removing it from CVS.
        "recursive" can be one of None [default], True (-R) or False (-l).
        """
        #TODO:
        #   - parse the output to provide some useful metadata in 'result'
        if not isinstance(files, types.ListType)\
           and not isinstance(files, types.TupleType):
            files = [files]

        optv = []
        if force: optv += ['-f']
        if recursive is None:
            pass
        elif recursive:
            optv += ['-R']
        else:
            optv += ['-l']

        argv = [self._cvs] + self._optv + ['remove'] + optv + files
        output, error, retval = self._run(argv, cwd)

        result = {'argv': argv,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval}
        return result

    def rtag(self, tag, modules, branch=0, date=None, delete=0, force=0,
             forceReassign=0, recursive=None, rev=None, skipPrograms=0, cwd=None):
        """Tags a module directory in the repository.

        "tag" is a tag name.
        "modules" is a single module name or list of module names.
        "branch" (-b) creates a new branch.
        "date" (-D) tags the latest revisions no later than the given date.
        "delete" (-d) deletes the tag.
        "force" (-f) forces to head revision if a given tag or date is not
            found.
        "forceReassign" (-F) forces reassignment of the tag name, if it
            already exists.
        "recursive" can be one of None [default], True (-R) or False (-l).
        "rev" (-r) tags the given revision (which may itself be a tag name).
        "skipPrograms" (-n) will cause tag programs (on the server) to be
            skipped.
        """
        #TODO:
        #   - parse the output to provide some useful metadata in 'result'
        if not isinstance(modules, types.ListType)\
           and not isinstance(modules, types.TupleType):
            modules = [modules]

        optv = []
        if branch: optv += ['-b']
        if date: optv += ['-D', date]
        if delete: optv += ['-d']
        if force: optv += ['-f']
        if forceReassign: optv += ['-F']
        if recursive is None:
            pass
        elif recursive:
            optv += ['-R']
        else:
            optv += ['-l']
        if rev: optv += ['-r', rev]
        if skipPrograms: optv += ['-n']

        argv = [self._cvs] + self._optv + ['rtag'] + optv + [tag] + modules
        output, error, retval = self._run(argv, cwd)

        result = {'argv': argv,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval}
        return result

    def status(self, files=[], recursive=None, showTags=0, cwd=None):
        """Tags a module directory in the repository.

        "files" is a single file name or list of file names.
        "recursive" can be one of None [default], True (-R) or False (-l).
        "showTags" (-v) will show tag information for the file(s).
        """
        #TODO:
        #   - parse the output to provide some useful metadata in 'result'
        if not isinstance(files, types.ListType)\
           and not isinstance(files, types.TupleType):
            files = [files]

        optv = []
        if recursive is None:
            pass
        elif recursive:
            optv += ['-R']
        else:
            optv += ['-l']
        if not cwd:
            cwd = os.getcwd()
        if showTags: optv += ['-v', rev]

        # if we don't get a basedir back, it's not a cvs
        # directory
        basedir = self._getBaseDirectory(cwd)
        # we now have a basedir such as /respository/module
        # the remote path could be the same, or could be something
        # like /cvs/respository/module, so we have to do a little
        # digging
        
        argv = [self._cvs] + self._optv + ['status'] + optv + files
        output, error, retval = self._run(argv, cwd)
        filelist = []
        index = {}
        if output:
            if self.re_status is None:
                self._compile_status_regexes()
            list = self.re_status.findall(output)
            for item in list:
                path = rpath = ''
                filename = item[0];
                if filename[:8] == 'no file ':
                    filename = filename[8:]
                    
                if item[2]: # do we have a revision?
                    # cleanup the remote path
                    rpath = item[5].strip()
                    if rpath[-2] == ',':
                        rpath = rpath[:-2]
                    if rpath[1] == ':' and basedir[1] != ':':
                        # the basedir may not have a drive letter, but
                        # rpath will, depending on cvs version, so remove
                        # drive letter from remote paths
                        rpath = rpath[2:]
                    rpath = rpath.replace('\\','/')
                    # find the basedir in rpath
                    si = rpath.find(basedir)
                    if si < 0:
                        raise CVSLibError("Invalid basedir [%s] rpath [%s]" % (basedir,rpath))
                    
                    tailpath = rpath[si+len(basedir):]
                    # Remove Attic (occurs when this is a branch) from the path
                    if tailpath[:7] == r'/Attic/':
                        tailpath = tailpath[6:]
                    path = os.path.normpath(cwd+tailpath)
                else:
                    # this must be a new file?
                    # XXX this works only for files added in the cwd, if
                    # doing a recursive status, this may not work right
                    path = os.path.normpath(os.path.join(cwd,filename))
                    
                #print "cwd: ",cwd
                #print "basedir: ",basedir
                #print "rpath: ",rpath
                #print "path: ",path

                file = {
                    'filename':filename,
                    'status':item[1],
                    'rev':item[2],
                    'revdate':item[3].strip(),
                    'rrev':item[4],
                    'rpath':rpath,
                    'path':path,
                    'stickytag':item[6],
                    'stickydate':item[7],
                    'stickyoptions':item[8],
                    'edit': 0
                    }
                filelist.append(file)
                index[path] = file
        # we also want to know if the files are being edited by the current
        # user and let them know
        #
        # Is this really needed?? - ToddW
        #
        #global machinename
        #rd = self._getRoot(cwd)
        #if 'user' in rd and rd['user']:
        #    editors = self.editors(files, recursive, None, cwd)
        #    for filename, users in editors['editors'].items():
        #        if rd['user'] in users:
        #            for info in users[rd['user']]:
        #                if info['user'] == rd['user'] and \
        #                   info['server'] == machinename and \
        #                   filename in index:
        #                    index[filename]['edit'] = 1
        #                    break
        
        result = {'argv': argv,
                  'files': filelist,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval}
        return result

    def tag(self, tag, files, branch=0, check=0, date=None, delete=0,
            force=0, forceReassign=0, recursive=None, rev=None, cwd=None):
        """Tags a revision or set of revisions.

        "tag" is a tag name.
        "files" is a single file name or list of file names.
        "branch" (-b) creates a new branch.
        "check" (-b) checks that the working copy has no uncommitted changes.
        "date" (-D) tags the latest revisions no later than the given date.
        "delete" (-d) deletes the tag.
        "force" (-f) forces to head revision if a given tag or date is not
            found.
        "forceReassign" (-F) forces reassignment of the tag name, if it
            already exists.
        "recursive" can be one of None [default], True (-R) or False (-l).
        "rev" (-r) tags the given revision (which may itself be a tag name).
        """
        #TODO:
        #   - parse the output to provide some useful metadata in 'result'
        if not isinstance(files, types.ListType)\
           and not isinstance(files, types.TupleType):
            files = [files]

        optv = []
        if branch: optv += ['-b']
        if check: optv += ['-c']
        if date: optv += ['-D', date]
        if delete: optv += ['-d']
        if force: optv += ['-f']
        if forceReassign: optv += ['-F']
        if recursive is None:
            pass
        elif recursive:
            optv += ['-R']
        else:
            optv += ['-l']
        if rev: optv += ['-r', rev]

        argv = [self._cvs] + self._optv + ['tag'] + optv + [tag] + files
        output, error, retval = self._run(argv, cwd)

        result = {'argv': argv,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval}
        return result

    def update(self, files, clean=0, date=None, force=0, getNewDirs=None,
               ignore=[], join=None, mode=None, print_=0, prune=0,
               recursive=None, resetStickyTags=0, rev=None, wrappers=[], cwd=None):
        """Merge changes from the repository into a working copy.

        "files" is a single file name or list of file names.
        "clean" (-C) will clean out any locally change files and replace them
            with the latest revisions from the repository.
        "date" (-D) will update to the most recent revisions no later than
            the given date (sticky).
        "force" (-f) forces to head recision if no matching revision is found
            for date or rev.
        "getNewDirs" (-d) retrieves new repository directories.
        "ignore" (-I) is a list of filenames (wildcards allowed) that should
            be ignored in the update.
        "join" (-j) is a single '-j'-style argument, or a list of them. (See
            _The CVS Book_ for details.)
        "mode" (-k) substitutes RCS keywords in checked-out files with the
            given mode (sticky).
        "print_" (-p) prints file contents to stdout.
        "prune" (-P) prunes empty directories.
        "recursive" can be one of None [default], True (-R) or False (-l).
        "resetStickyTags" (-A)
        "rev" (-r) update to the given revision.
        "wrappers" (-W) is a list of wrapper-style filters to use during
            update.

        Returns a dict with the std keys (see CVS.__doc__) plus a 'files'
        key whose value is a list of dicts of the form:
            {'status': <U|P|A|R|C|M|?>,
             'file': <the filename>}
        """
        if not isinstance(files, types.ListType)\
           and not isinstance(files, types.TupleType):
            files = [files]
        if join is None:
            join = []
        elif not isinstance(join, types.ListType)\
           and not isinstance(join, types.TupleType):
            join = [join]
        if len(join) > 2:
            raise CVSLibError("Too many 'join' elements: join=%s." % join)
        if date and rev:
            raise CVSLibError("Cannot specify both a 'rev' and a 'date' "\
                              "for checkout.")
        if not isinstance(wrappers, types.ListType)\
           and not isinstance(wrappers, types.TupleType):
            wrappers = [wrappers]

        optv = []
        if clean: optv += ['-C']
        if date: optv += ['-D', date]
        if getNewDirs: optv += ['-d', getNewDirs]
        if force: optv += ['-f']
        for j in join: optv += ['-j', j]
        if mode: optv += ['-k%s' % mode]
        if print_: optv += ['-p']
        if prune: optv += ['-P']
        if recursive is None:
            pass
        elif recursive:
            optv += ['-R']
        else:
            optv += ['-l']
        if resetStickyTags: optv += ['-A']
        if rev: optv += ['-r', rev]
        for wrapper in wrappers: optv += ['-W', wrapper]

        argv = [self._cvs] + self._optv + ['update'] + optv + files
        output, error, retval = self._run(argv, cwd)

        result = {'argv': argv,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval,
                  'files': self._getCheckoutUpdateFiles(output, error)}
        return result

    def unedit(self, files, recursive=None, actions=None, cwd=None):
        """
        Open an existing file for edit.
        
        Usage: cvs edit [-lR] [files...]
        -l: Local directory only, not recursive
        -R: Process directories recursively
        -a: Specify what actions for temporary watch, one of
            edit,unedit,commit,all,none
        """
        if type(files) in types.StringTypes:
            files = [files]
        optv = []
        
        if recursive:
            optv += ['-R']
        else:
            optv += ['-l']
        
        if actions:
            optv += ['-a', actions]
        
        argv = [self._cvs, 'unedit'] + optv + files
        output, error, retval = self._run(argv, cwd)
        # expect no output except with errors.
        result = {'argv': argv,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval}
        return result
    
    def edit(self, files, recursive=None, actions=None, cwd=None):
        """
        Open an existing file for edit.
        
        Usage: cvs edit [-lR] [files...]
        -l: Local directory only, not recursive
        -R: Process directories recursively
        -a: Specify what actions for temporary watch, one of
            edit,unedit,commit,all,none
        """
        if type(files) in types.StringTypes:
            files = [files]
        optv = []
        
        if recursive:
            optv += ['-R']
        else:
            optv += ['-l']
        
        if actions:
            optv += ['-a', actions]
        
        argv = [self._cvs, 'edit'] + optv + files
        output, error, retval = self._run(argv, cwd)
        # expect no output except with errors.
        result = {'argv': argv,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval}
        return result

    _re_editors = None
    def editors(self, files, recursive=None, actions=None, cwd=None):
        """
        Open an existing file for edit.
        
        Usage: cvs edit [-lR] [files...]
        -l: Local directory only, not recursive
        -R: Process directories recursively
        -a: Specify what actions for temporary watch, one of
            edit,unedit,commit,all,none
        """
        if not self._re_editors:
            self._re_editors = re.compile(r'^(?P<file>.*?)\s+(?P<user>.*?)\s+(?P<date>(?:\w+\s\w+\s\d+\s\d+:\d+:\d+\s\d+\s\w+))\s+(?P<server>.*?)\s+(?P<path>.*?)$')
        if type(files) in types.StringTypes:
            files = [files]
        optv = []
        
        if recursive:
            optv += ['-R']
        else:
            optv += ['-l']
        
        if actions:
            optv += ['-a', actions]
        
        argv = [self._cvs, 'editors'] + optv + files
        output, error, retval = self._run(argv, cwd)
        
        # parse output:
        # php_sample.php  shanec  Thu Oct 14 23:06:39 2004 GMT    cuetzpalli      /home/shanec/cvstest/samples
        # with:
        # ^(?P<file>.*?)\s+(?P<user>.*?)\s+(?P<date>(?:\w+\s\w+\s\d+\s\d+:\d+:\d+\s\d+\s\w+))\s+(?P<machine>.*?)\s+(?P<path>.*?)$
        results = {}
        for line in output.splitlines(0):
            if not line: continue # skip empty lines
            match = self._re_editors.match(line)
            if match:
                info = match.groupdict()
                file = os.path.join(info['path'], info['file'])
                if file not in results:
                    results[file] = {info['user']: [info]}
                else:
                    results[file][info['user']].append(info)
            
            
        # expect no output except with errors.
        result = {'argv': argv,
                  'stdout': output,
                  'stderr': error,
                  'retval': retval,
                  'editors': results}
        return result

    def _getCheckoutUpdateFiles(self, output, error):
        """Return a list of results from 'cvs checkout|update' output.

        The results are a list of dicts of the form:
            {'status': <one of the described status letters>,
             'file': <the filename>}

        We need one more status codes which is _not_ in CVS:

        `D FILE'
             The file is no longer in the repository.
        
        From the cvs INFO page on 'update output':
        `U FILE'
             The file was brought up to date with respect to the repository.
             This is done for any file that exists in the repository but not
             in your source, and for files that you haven't changed but are
             not the most recent versions available in the repository.

        `P FILE'
             Like `U', but the CVS server sends a patch instead of an entire
             file.  These two things accomplish the same thing.

        `A FILE'
             The file has been added to your private copy of the sources, and
             will be added to the source repository when you run `commit' on
             the file.  This is a reminder to you that the file needs to be
             committed.

        `R FILE'
             The file has been removed from your private copy of the sources,
             and will be removed from the source repository when you run
             `commit' on the file.  This is a reminder to you that the file
             needs to be committed.

        `M FILE'
             The file is modified in  your  working  directory.

             `M' can indicate one of two states for a file you're working on:
             either there were no modifications to the same file in the
             repository, so that your file remains as you last saw it; or
             there were modifications in the repository as well as in your
             copy, but they were merged successfully, without conflict, in
             your working directory.

             CVS will print some messages if it merges your work, and a
             backup copy of your working file (as it looked before you ran
             `update') will be made.  The exact name of that file is printed
             while `update' runs.

        `C FILE'
             A conflict was detected while trying to merge your changes to
             FILE with changes from the source repository.  FILE (the copy in
             your working directory) is now the result of attempting to merge
             the two revisions; an unmodified copy of your file is also in
             your working directory, with the name `.#FILE.REVISION' where
             REVISION is the revision that your modified file started from.
             Resolve the conflict as described in *Note Conflicts example::.
             (Note that some systems automatically purge files that begin
             with `.#' if they have not been accessed for a few days.  If you
             intend to keep a copy of your original file, it is a very good
             idea to rename it.)  Under VMS, the file name starts with `__'
             rather than `.#'.

        `? FILE'
             FILE is in your working directory, but does not correspond to
             anything in the source repository, and is not in the list of
             files for CVS to ignore (see the description of the `-I' option,
             and *note cvsignore::).
        """
        results = []
        lineRe = re.compile('^(?P<status>[UPARMC\?]) (?P<file>.*)$')
        for line in output.splitlines(0):
            if not line: continue # skip empty lines
            match = lineRe.search(line)
            if match:
                results.append(match.groupdict())
            else:
                # We expect that some lines are things we do not want.                
                log.info("Could not parse 'cvs checkout|update' output "\
                         "line: '%s'. Skipping." % line)
        lineRemovedRe = re.compile('^cvs server: (?P<file>.*) is no longer in the repository$')
        for line in error.splitlines(0):
            if not line: continue # skip empty lines
            match = lineRemovedRe.search(line)
            if match:
                results.append({'status': 'D', 'file': match.group('file')})
        return results


#---- mainline

def _test():
    # (cvslib.py must be on sys.path. This requires Python >=2.1 to run.)
    sys.argv.append('-v')
    import doctest, cvslib
    return doctest.testmod(cvslib)

def _test_root_parser():
    lines = {
        r':local:e:\basepath': {'path': r'e:\basepath', 'protocol': 'local', 'port': None, 'params': None},   # BUG 23673
        r':local:D:\SRC\MASTER': {'path': r'D:\SRC\MASTER', 'protocol': 'local', 'port': None, 'params': None},   # BUG 34470
        r':local;bar=foo:e:\basepath': {'path': r'e:\basepath', 'protocol': 'local', 'port': None, 'params': 'bar=foo', 'bar': 'foo'},
        r':local:/basepath': {'path': '/basepath', 'protocol': 'local', 'port': None, 'params': None}, # BUG 33138
        r':local;bar=foo:/basepath': {'path': '/basepath', 'protocol': 'local', 'port': None, 'params': 'bar=foo', 'bar': 'foo'},
        r':local:2401/basepath': {'path': '/basepath', 'protocol': 'local', 'port': '2401', 'params': None}, # BUG 33138
        r':local;bar=foo:2401/basepath': {'path': '/basepath', 'protocol': 'local', 'port': '2401', 'params': 'bar=foo', 'bar': 'foo'},
        r':pserver:user@domain.com/basepath': {'path': '/basepath', 'protocol': 'pserver', 'user': 'user', 'server': 'domain.com', 'port': None, 'password': None, 'params': None},
        r':pserver:user:password@domain.com/basepath': {'path': '/basepath', 'protocol': 'pserver', 'user': 'user', 'server': 'domain.com', 'port': None, 'password': 'password', 'params': None},
        r':pserver;bar=foo:user@domain.com/basepath': {'path': '/basepath', 'protocol': 'pserver', 'user': 'user', 'server': 'domain.com', 'port': None, 'password': None, 'params': 'bar=foo', 'bar': 'foo'},
        r':pserver:user@domain.com:2401/basepath': {'path': '/basepath', 'protocol': 'pserver', 'user': 'user', 'server': 'domain.com', 'port': '2401', 'password': None, 'params': None},
        r':pserver;bar=foo:user@domain.com:2401/basepath': {'path': '/basepath', 'protocol': 'pserver', 'user': 'user', 'server': 'domain.com', 'port': '2401', 'password': None, 'params': 'bar=foo', 'bar': 'foo'},
        r':ext:user@domain.com:/basepath': {'path': '/basepath', 'protocol': 'ext', 'user': 'user', 'server': 'domain.com', 'params': None, 'access': None},
        r':ext;bar=foo:{access_option}user@domain.com:/basepath': {'path': '/basepath', 'protocol': 'ext', 'user': 'user', 'server': 'domain.com', 'params': 'bar=foo', 'bar': 'foo', 'access': 'access_option'},
        r':ext:{access_option}user@domain.com:/basepath': {'path': '/basepath', 'protocol': 'ext', 'user': 'user', 'server': 'domain.com', 'params': None, 'access': 'access_option'},
        r':ext;bar=foo:user@domain.com:/basepath': {'path': '/basepath', 'protocol': 'ext', 'user': 'user', 'server': 'domain.com', 'params': 'bar=foo', 'bar': 'foo', 'access': None},
        r':ext:domain.com:/basepath': {'path': '/basepath', 'protocol': 'ext', 'user': None, 'server': 'domain.com', 'params': None, 'access': None},
        r'user@domain.com:/basepath': {'path': '/basepath', 'protocol': None, 'user': 'user', 'server': 'domain.com', 'params': None, 'access': None},
        r'domain.com:/basepath': {'path': '/basepath', 'protocol': None, 'user': None, 'server': 'domain.com', 'params': None, 'access': None},
        r'/basepath': {'path': '/basepath', 'protocol': None, 'params': None},
        r'e:\basepath': {'path': r'e:\basepath', 'protocol': None, 'port': None, 'params': None},
        r'H:\Develop\TARMA\PERL\CVS_SRC': {'path': r'H:\Develop\TARMA\PERL\CVS_SRC', 'protocol': None, 'port': None, 'params': None},
        r':pserver:cvs@domain.com/home/cvs/dev': 
            {'path': r'/home/cvs/dev', 'protocol': 'pserver', 'user': 'cvs', 'server': 'domain.com', 'port': None, 'password': None, 'params': None},
        # new style root files used with cvsnt
        r'[protocol=pserver,path=e:\basepath]': {'path': r'e:\basepath', 'directory': r'e:\basepath', 'protocol': 'pserver'},
        r'[protocol=ext,directory="e:\basepath"]': {'path': r'e:\basepath', 'directory': r'e:\basepath', 'protocol': 'ext'},
        r"[path='e:\basepath']": {'path': r'e:\basepath', 'directory': r'e:\basepath'},
        r':sspi:cvs:/somepath': {'path': r'/somepath', 'server': 'cvs', 'protocol': 'sspi'},
        r':sspi:CVS.mydomain.de:\TestRepo': {'path': r'\TestRepo', 'server': 'CVS.mydomain.de', 'protocol': 'sspi'},
        r':pserver:anonymous@cvs-mirror.mozilla.org:/cvsroot': {'path':'/cvsroot','server':'cvs-mirror.mozilla.org','protocol':'pserver','user':'anonymous'},
        r':pserver:user@192.168.102.2:/MyPath': {'path':'/MyPath','protocol':'pserver','user':'user','server':'192.168.102.2'},
        r':pserver;username=user;hostname=192.168.102.2:/MyPath':
            {'path':'/MyPath','protocol':'pserver','user':'user','server':'192.168.102.2'},
        r':ntserver:CSOFILE5:G:\data\CCS_CVSRepository': {'path': r'G:\data\CCS_CVSRepository', 'server': 'CSOFILE5', 'protocol': 'ntserver'},
        # Bug 93569.
        r'my-server:/repos/cvs-repo': {'path': r'/repos/cvs-repo'},
    }
    for line in lines.keys():
        root = _cvs_root_parser(line)
        #print "%s = %r" %(line, root)
        for key, value in lines[line].items():
            if key in root:
                assert(root[key] == value)
            else:
                print "Failed: missing field %r in %r" % (key, line)
                print root
                assert(False)
                
        for key, value in root.items():
            if key in lines[line]:
                assert(root[key] == value)
    print "\nAll %d tests passed" % (len(lines))

#if __name__ == '__main__':
#    _test_root_parser()

