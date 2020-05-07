#!/usr/bin/env python

"""
    An OO interface to 'p4' (the Perforce client command line app).

    Usage:
        import p4lib
        p4 = p4lib.P4(<p4options>)
        result = p4.<command>(<options>)

    For more information see the doc string on each command. For example:
        print p4lib.P4.opened.__doc__
    
    Implemented commands:
        add (limited test suite), branch, branches, change, changes (no
        test suite), client, clients, delete, describe (no test suite),
        diff, edit (no test suite), files (no test suite), filelog (no
        test suite), flush, have (no test suite), label, labels, opened,
        print (as print_, no test suite), resolve, revert (no test
        suite), submit, sync, where (no test suite)
    Partially implemented commands:
        diff2
    Unimplemented commands:
        admin, counter, counters, depot, depots, dirs, fix, fixes,
        fstat, group, groups, help (no point), integrate, integrated,
        job, jobs, jobspec, labelsync, lock, obliterate, passwd,
        protect, rename (no point), reopen, resolved, review, reviews,
        set, triggers, typemap, unlock, user, users, verify

    XXX Describe usage of parseForm() and makeForm().
"""
#TODO:
#   - There is much similarity in some commands, e.g. clients, changes,
#     branches in one group; client, change, branch, label in another.
#     Should share implementation between these all.

import os
import sys
import pprint
import cmd
import re
import types
import marshal
import getopt
import tempfile
import koprocessutils
import copy

import logging
log = logging.getLogger('p4lib')

#---- exceptions

class P4LibError(Exception):
    pass


#---- global data

_version_ = (0, 7, 2)

#---- internal support stuff

# P4 escape sequences
# http://www.perforce.com/perforce/doc.042/manuals/p4guide/04_details.html
# Order is important, be sure that "%" is the first escaped character, otherwise
# it will mess up when another replacement is made that contains a '%'.
# XXX - This may need to become more specific if we actually supply a revision
#       number or change number reference using the "#" and "@" characters.

_filename_replacement_strings = [ ( '%', '%25' ),
                                  ( '@', '%40' ),
                                  ( '#', '%23' ), ]
                        # Removed space due to bug:
                        #    http://bugs.activestate.com/show_bug.cgi?id=67417
                        # ' ', '%20'
                        #
                        # '*', '%2a' # We don't want to escape the * character

def _escapeFilename(filename):
    """Escape the given command line argument for the shell."""
    for escape_string, replacement_string in _filename_replacement_strings:
        filename = filename.replace(escape_string, replacement_string)
    return filename

def _escapeFilenames(filenameList):
    if not filenameList:
        return filenameList
    result = []
    for filename in filenameList:
        result.append(_escapeFilename(filename))
    return result

def _escapeArg(arg):
    """Escape the given command line argument for the shell."""
    #XXX There is a *lot* more that we should escape here.
    #XXX This is also not right on Linux, just try putting 'p4' is a dir
    #    with spaces.
    return arg.replace('"', r'\"')

def _joinArgv(argv):
    r"""Join an arglist to a string appropriate for running.
        >>> import os
        >>> _joinArgv(['foo', 'bar "baz'])
        'foo "bar \\"baz"'
    """
    cmdstr = ""
    # Quote args with '*' because don't want shell to expand the
    # argument. (XXX Perhaps that should only be done for Windows.)
    specialChars = [';', ' ', '=', '*']
    for arg in argv:
        for ch in specialChars:
            if ch in arg:
                cmdstr += '"%s"' % _escapeArg(arg)
                break
        else:
            cmdstr += _escapeArg(arg)
        cmdstr += ' '
    if cmdstr.endswith(' '): cmdstr = cmdstr[:-1]  # strip trailing space
    return cmdstr


def _run(argv, cwd=None, env=None, input=None):
    """Prepare and run the given arg vector, 'argv', and return the
    results.  Returns (<stdout lines>, <stderr lines>, <return value>).
    Note: 'argv' may also just be the command string.
    """
    if type(argv) in (types.ListType, types.TupleType):
        cmd = _joinArgv(argv)
    else:
        cmd = argv
    log.debug("Running '%s'...", cmd)
    #print("Running '%s'..." % (cmd, ))

    # Run with process.py if it is available. It is more reliable.
    try:
        import process
    except ImportError:
        if input is not None:
            raise P4LibError("Cannot handle process input with process.py. "\
                             "cmd=%r" % cmd)
        if sys.platform.startswith('win'):
            # XXX The following incantation will hang popen3 on Win9x:
            #    echo "hi there"
            #    echo "hi\ there"
            # but these will not hang popen3:
            #    echo hi there
            #    echo "hithere"
            # Something to do with quoting and spaces, and passing through
            # w9xpopen.exe, and launching via command.com. Weird quoting
            # rules for command.com? Should perhaps work on _joinArg and
            # _escapeArg to ensure safe command strings (if possible).
            i, o, e = os.popen3(cmd)
            output = o.readlines()
            error = e.readlines()
            i.close()
            e.close()
            retval = o.close()
        else:
            import popen2
            p = popen2.Popen3(cmd, 1)
            i, o, e = p.tochild, p.fromchild, p.childerr
            output = o.readlines()
            error = e.readlines()
            i.close()
            o.close()
            e.close()
            rv = p.wait()
            if os.WIFEXITED(rv):
                retval = os.WEXITSTATUS(rv)
            else:
                raise P4LibError("Error running '%s', it did not exit "\
                                 "properly: rv=%d" % (cmd, rv))
    else:
        if not env:
            env = koprocessutils.getUserEnv()
        p = process.ProcessOpen(cmd=argv, cwd=cwd, env=env,
                                universal_newlines=True)
        if input:
            input = input.encode("utf-8")
        output, error = p.communicate(input)
        output = output.splitlines(1)
        error = error.splitlines(1)
        retval = p.returncode
    if retval:
        raise P4LibError("Error %s running '%s': \n%s"\
                         % (retval,cmd, ''.join(error), ))
    return output, error, retval


def _specialsLast(a, b, specials):
    """A cmp-like function, sorting in alphabetical order with
    'special's last.
    """
    if a in specials and b in specials:
        return cmp(a, b)
    elif a in specials:
        return 1
    elif b in specials:
        return -1
    else:
        return cmp(a, b)


#---- public stuff


def makeForm(**kwargs):
    """Return an appropriate P4 form filled out with the given data.
    
    In general this just means tranforming each keyword and (string)
    value to separate blocks in the form. The section name is the
    capitalized keyword. Single line values go on the same line as
    the section name. Multi-line value succeed the section name,
    prefixed with a tab, except some special section names (e.g.
    'differences'). Text for "special" sections are NOT indented, have a
    blank line after the header, and are placed at the end of the form.
    Sections are separated by a blank line.

    The 'files' key is handled specially. It is expected to be a
    list of dicts of the form:
        {'action': 'add', # 'action' may or may not be there
         'depotFile': '//depot/test_edit_pending_change.txt'}
    As well, the 'change' value may be an int.
    """
    # Do special preprocessing on the data.
    for key, value in kwargs.items():   
        if key == 'files':
            strval = ''
            for f in value:
                if f.has_key('action'):
                    strval += '%(depotFile)s\t# %(action)s\n' % f
                else:
                    strval += '%(depotFile)s\n' % f
            kwargs[key] = strval
        if key == 'change':
            kwargs[key] = str(value)
    
    # Create the form
    form = ''
    specials = ['differences']
    keys = kwargs.keys()
    keys.sort(lambda a,b,s=specials: _specialsLast(a,b,s))
    for key in keys:
        value = kwargs[key]
        if value is None:
            pass
        # If there is multiline input or we are setting the "description"
        # field, ensure the key and the data are newline separated.
        #
        # The description field should *always* contain a newline separator,
        # whilst the perforce server handles a commit without the newline sep,
        # most perforce triggers will reject this style of form description.
        # http://bugs.activestate.com/show_bug.cgi?id=73103
        elif len(value.split('\n')) > 1 or \
              key == "description":
            form += '%s:\n' % key.capitalize()
            if key in specials:
                form += '\n'
            for line in value.split('\n'):
                if key in specials:
                    form += line + '\n'
                else:
                    form += '\t' + line + '\n'
        else:
            form += '%s:\t%s\n' % (key.capitalize(), value)
        form += '\n'
    return form

def parseForm(lines):
    """Parse an arbitrary Perforce form and return a dict result.

    The result is a dict with a key for each "section" in the
    form (the key name will be the section name lowercased),
    whose value will, in general, be a string with the following
    exceptions:
        - A "Files" section will translate into a list of dicts
          each with 'depotFile' and 'action' keys.
        - A "Change" value will be converted to an int if
          appropriate.
    """
    # Example form:
    #   # A Perforce Change Specification.
    #   #
    #   #  Change:      The change number. 'new' on a n...
    #   <snip>
    #   #               to this changelist.  You may de...
    #   
    #   Change: 1
    #   
    #   Date:   2002/05/08 23:24:54
    #   <snip>
    #   Description:
    #           create the initial change
    #   
    #   Files:
    #           //depot/test_edit_pending_change.txt    # add
    spec = {}

    # Parse out all sections into strings.
    currkey = None  # If non-None, then we are in a multi-line block.
    for line in lines:
        if line.strip().startswith('#'):
            continue    # skip comment lines
        if currkey:     # i.e. accumulating a multi-line block
            if line.startswith('\t'):
                spec[currkey] += line[1:]
            elif not line.strip():
                spec[currkey] += '\n'
            else:
                # This is the start of a new section. Trim all
                # trailing newlines from block section, as
                # Perforce does.
                while spec[currkey].endswith('\n'):
                    spec[currkey] = spec[currkey][:-1]
                currkey = None
        if not currkey: # i.e. not accumulating a multi-line block
            if not line.strip(): continue   # skip empty lines
            key, remainder = line.split(':', 1)
            if not remainder.strip():   # this is a multi-line block
                currkey = key.lower()
                spec[currkey] = ''
            else:
                spec[key.lower()] = remainder.strip()
    if currkey:
        # Trim all trailing newlines from block section, as
        # Perforce does.
        while spec[currkey].endswith('\n'):
            spec[currkey] = spec[currkey][:-1]

    # Do any special processing on values.
    for key, value in spec.items():
        if key == "change":
            try:
                spec[key] = int(value)
            except ValueError:
                pass
        elif key == "files":
            spec[key] = []
            fileRe = re.compile('^(?P<depotFile>//.+?)\t'\
                                '# (?P<action>\w+)$')
            for line in value.split('\n'):
                if not line.strip(): continue
                match = fileRe.match(line)
                try:
                    spec[key].append(match.groupdict())
                except AttributeError:
                    pprint.pprint(value)
                    pprint.pprint(spec)
                    err = "Internal error: could not parse P4 form "\
                          "'Files:' section line: '%s'" % line
                    raise P4LibError(err)

    return spec


def makeOptv(**options):
    """Create a p4 option vector from the given p4 option dictionary.
    
    "options" is an option dictionary. Valid keys and values are defined by
        what class P4's constructor accepts via P4(**optd).
    
    Example:
        >>> makeOptv(client='swatter', dir='D:\\trentm')
        ['-c', 'client', '-d', 'D:\\trentm']
        >>> makeOptv(client='swatter', dir=None)
        ['-c', 'client']
    """
    optv = []
    for key, val in options.items():
        if val is None:
            continue
        if key == 'client':
            optv.append('-c')
        elif key == 'dir':
            optv.append('-d')
        elif key == 'host':
            optv.append('-H')
        elif key == 'port':
            optv.append('-p')
        elif key == 'password':
            optv.append('-P')
        elif key == 'user':
            optv.append('-u')
        optv.append(val)
    if optv == [[]]:
        raise "boo"
    return optv

def parseOptv(optv):
    """Return an option dictionary representing the given p4 option vector.
    
    "optv" is a list of p4 options. See 'p4 help usage' for a list.

    The returned option dictionary is suitable passing to the P4 constructor.

    Example:    
        >>> parseP4Optv(['-c', 'swatter', '-d', 'D:\\trentm'])
        {'client': 'swatter',
         'dir': 'D:\\trentm'}
    """
    # Some of p4's options are not appropriate for later
    # invocations. For example, '-h' and '-V' override output from
    # running, say, 'p4 opened'; and '-G' and '-s' control the
    # output format which this module is parsing (hence this module
    # should control use of those options).
    optlist, dummy = getopt.getopt(optv, 'hVc:d:H:p:P:u:x:Gs')
    optd = {}
    for opt, optarg in optlist:
        if opt in ('-h', '-V', '-x'):
            raise P4LibError("The '%s' p4 option is not appropriate "\
                             "for p4lib.P4." % opt)
        elif opt in ('-G', '-s'):
            log.info("Ignoring '%s' option." % opt)
        elif opt == '-c':
            optd['client'] = optarg
        elif opt == '-d':
            optd['dir'] = optarg
        elif opt == '-H':
            optd['host'] = optarg
        elif opt == '-p':
            optd['port'] = optarg
        elif opt == '-P':
            optd['password'] = optarg
        elif opt == '-u':
            optd['user'] = optarg
    return optd


class P4:
    """A proxy to the Perforce client app 'p4'."""
    def __init__(self, p4='p4', **options):
        """Create a 'p4' proxy object.

        "p4" is the Perforce client to execute commands with. Defaults
            to 'p4'.
        Optional keyword arguments:
            "client" specifies the client name, overriding the value of
                $P4CLIENT in the environment and the default (the hostname).
            "dir" specifies the current directory, overriding the value of
                $PWD in the environment and the default (the current
                directory).
            "host" specifies the host name, overriding the value of $P4HOST
                in the environment and the default (the hostname).
            "port" specifies the server's listen address, overriding the
                value of $P4PORT in the environment and the default
                (perforce:1666).
            "password" specifies the password, overriding the value of
                $P4PASSWD in the environment.
            "user" specifies the user name, overriding the value of $P4USER,
                $USER, and $USERNAME in the environment.
            
            "cwd" is a special option to have the underlying process
                spawner use this as the cwd.
        """
        self.p4 = p4
        self.optd = options
        self._optv = makeOptv(**self.optd)
        
    def _p4run(self, argv, env=None, input=None, **p4options):
        """Run the given p4 command.
        
        The current instance's p4 and p4 options (optionally overriden by
        **p4options) are used. The 3-tuple (<output>, <error>, <retval>) is
        returned.
        """
        cwd = None
        if p4options:
            d = self.optd
            d.update(p4options)
            if 'cwd' in d:
                cwd = d['cwd']
                del d['cwd']
            p4optv = makeOptv(**d)
        else:
            p4optv = self._optv
        
        if cwd:
            # Setting the cwd explicitly allows Komodo's perforce status
            # checking to work with UNC paths and avoids problems when
            # running through the python subprocess call. See bugs:
            # http://bugs.activestate.com/show_bug.cgi?id=67182
            # http://bugs.activestate.com/show_bug.cgi?id=74567
            argv = [self.p4, "-d", cwd] + p4optv + argv
        else:
            argv = [self.p4] + p4optv + argv

        return _run(argv, cwd, env, input)
    
    def workingDirectory(self, path):
        """
        workingDirectory: Retrieve the working directory for the given path
        
        returns the path if no working directory could be found
        """
        
        argv = ['info']
        output, error, retval = self._p4run(argv, cwd=os.path.dirname(path))
        if not output:
            return path
        
        # Example output:
        #   User name: john
        #   Client name: john
        #   Client host: localhost
        #   Client root: /home/johndoe/SCC/p4client
        #   Current directory: /home/johndoe/SCC/p4client/gwt
        #   Peer address: 127.0.0.1:38424
        #   Client address: 127.0.0.1
        #   Server address: localhost.localdomain:1666
        #   Server root: .
        #   Server date: 2016/03/10 12:37:52 -0500 EST
        #   Server uptime: 00:21:40
        #   Server version: P4D/LINUX26X86_64/2015.1/1341249 (2016/02/05)
        #   Server license: none
        #   Case Handling: sensitive

        # multiple files are seperated by a blank line, we want to split on that
        out = ''.join(output)
        lines = out.splitlines()
        
        for line in lines:
            hits = {}
            try:
                match = line.split(':', 1)
                if match[0].strip() == "Client root":
                    return match[1].strip()
            except IndexError:
                pass
        
        return path

    def getheadref(self, path):
        """ Get a reference to the current state of the repository HEAD """
        
        argv = ['changes', '-m1']
        output, error, retval = self._p4run(argv, cwd=os.path.dirname(path))
        return output[0].strip()


    def opened(self, files=[], allClients=0, change=None, _raw=0,
               **p4options):
        """Get a list of files opened in a pending changelist.

        "files" is a list of files or file wildcards to check. Defaults
            to the whole client view.
        "allClients" (-a) specifies to list opened files in all clients.
        "change" (-c) is a pending change with which to associate the
            opened file(s).

        Returns a list of dicts, each representing one opened file. The
        dict contains the keys 'depotFile', 'rev', 'action', 'change',
        'type', and, as well, 'user' and 'client' if the -a option
        is used.

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        # Output examples:
        # - normal:
        #   //depot/apps/px/px.py#3 - edit default change (text)
        # - with '-a':
        #   //depot/foo.txt#1 - edit change 12345 (text+w) by trentm@trentm-pliers
        # - none opened:
        #   foo.txt - file(s) not opened on this client. 
        optv = []
        if allClients: optv += ['-a']
        if change: optv += ['-c', str(change)]
        if type(files) in types.StringTypes:
            files = [files]

        argv = ['opened'] + optv
        if files:
            argv += _escapeFilenames(files)
        output, error, retval = self._p4run(argv, **p4options)

        lineRe = re.compile('''^
            (?P<depotFile>.*?)\#(?P<rev>\d+)    # //depot/foo.txt#1
            \s-\s(?P<action>\w+)                # - edit
            \s(default\schange|change\s(?P<change>\d+))  # change 12345
            \s\((?P<type>[\w+]+)\)          # (text+w)
            (\sby\s)?                           # by
            ((?P<user>[^\s@]+)@(?P<client>[^\s@]+))?    # trentm@trentm-pliers
            ''', re.VERBOSE)
        files = []
        for line in output:
            match = lineRe.search(line)
            if not match:
                raise P4LibError("Internal error: 'p4 opened' regex did not "\
                                 "match '%s'. Please report this to the "\
                                 "author." % line)
            file = match.groupdict()
            file['rev'] = int(file['rev'])
            if not file['change']:
                file['change'] = 'default'
            else:
                file['change'] = int(file['change'])
            for key in file.keys():
                if file[key] is None:
                    del file[key]
            files.append(file)

        if _raw:
            return files, {'stdout': ''.join(output),
                           'stderr': ''.join(error),
                           'retval': retval}
        else:
            return files

    def where(self, files=[], _raw=0, **p4options):
        """Show how filenames map through the client view.

        "files" is a list of files or file wildcards to check. Defaults
            to the whole client view.

        Returns a list of dicts, each representing one element of the
        mapping. Each mapping include a 'depotFile', 'clientFile', and
        'localFile' and a 'minus' boolean (indicating if the entry is an
        Exclusion.

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        # Output examples:
        #  -//depot/foo/Py-2_1/... //trentm-ra/foo/Py-2_1/... c:\trentm\foo\Py-2_1\...
        #  //depot/foo/win/... //trentm-ra/foo/win/... c:\trentm\foo\win\...
        #  //depot/foo/Py Exts.dsw //trentm-ra/foo/Py Exts.dsw c:\trentm\foo\Py Exts.dsw
        #  //depot/foo/%1 //trentm-ra/foo/%1 c:\trentm\foo\%1
        # The last one is surprising. It comes from using '*' in the
        # client spec. 
        if type(files) in types.StringTypes:
            files = [files]

        argv = ['where']
        if files:
            argv += _escapeFilenames(files)
        output, error, retval = self._p4run(argv, **p4options)

        results = []
        for line in output:
            file = {}
            if line[-1] == '\n': line = line[:-1]
            if line.startswith('-'):
                file['minus'] = 1
                line = line[1:]
            else:
                file['minus'] = 0
            depotFileStart = line.find('//')
            clientFileStart = line.find('//', depotFileStart+2)
            file['depotFile'] = line[depotFileStart:clientFileStart-1]
            if sys.platform.startswith('win'):
                assert ':' not in file['depotFile'],\
                       "Current parsing cannot handle this line '%s'." % line
                localFileStart = line.find(':', clientFileStart+2) - 1
            else:
                assert file['depotFile'].find(' /') == -1,\
                       "Current parsing cannot handle this line '%s'." % line
                localFileStart = line.find(' /', clientFileStart+2) + 1
            file['clientFile'] = line[clientFileStart:localFileStart-1]
            file['localFile'] = line[localFileStart:]
            results.append(file)

        if _raw:
            return results, {'stdout': ''.join(output),
                             'stderr': ''.join(error),
                             'retval': retval}
        else:
            return results

    def have(self, files=[], _raw=0, **p4options):
        """Get list of file revisions last synced.

        "files" is a list of files or file wildcards to check. Defaults
            to the whole client view.
        "options" can be any of p4 option specifiers allowed by .__init__()
            (they override values given in the constructor for just this
            command).

        Returns a list of dicts, each representing one "hit". Each "hit"
        includes 'depotFile', 'rev', and 'localFile' keys.

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        if type(files) in types.StringTypes:
            files = [files]

        argv = ['have']
        if files:
            argv += files
        output, error, retval = self._p4run(argv, **p4options)

        # Output format is 'depot-file#revision - client-file'
        hits = []
        for line in output:
            if line[-1] == '\n': line = line[:-1]
            hit = {}
            hit['depotFile'], line = line.split('#')
            hit['rev'], hit['localFile'] = line.split(' - ', 1)
            hit['rev'] = int(hit['rev'])
            hits.append(hit)

        if _raw:
            return hits, {'stdout': ''.join(output),
                          'stderr': ''.join(error),
                          'retval': retval}
        else:
            return hits

    def describe(self, change, diffFormat='', shortForm=0, _raw=0,
                 **p4options):
        """Get a description of the given changelist.

        "change" is the changelist number to describe.
        "diffFormat" (-d<flag>) is a flag to pass to the built-in diff
            routine to control the output format. Valid values are ''
            (plain, default), 'n' (RCS), 'c' (context), 's' (summary),
            'u' (unified).
        "shortForm" (-s) specifies to exclude the diff from the
            description.

        Returns a dict representing the change description. Keys are:
        'change', 'date', 'client', 'user', 'description', 'files', 'diff'
        (the latter is not included iff 'shortForm').

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        if diffFormat not in ('', 'n', 'c', 's', 'u'):
            raise P4LibError("Incorrect diff format flag: '%s'" % diffFormat)
        optv = []
        if diffFormat:
            optv.append('-d%s' % diffFormat)
        if shortForm:
            optv.append('-s')
        argv = ['describe'] + optv + [str(change)]
        output, error, retval = self._p4run(argv, **p4options)

        desc = {}
        changeRe = re.compile('^Change (?P<change>\d+) by (?P<user>[^\s@]+)@'\
                              '(?P<client>[^\s@]+) on (?P<date>[\d/ :]+)$')
        desc = changeRe.match(output[0]).groupdict()
        desc['change'] = int(desc['change'])
        filesIdx = output.index("Affected files ...\n")
        desc['description'] = ""
        for line in output[2:filesIdx-1]:
            desc['description'] += line[1:] # drop the leading \t
        if shortForm:
            diffsIdx = len(output)
        else:
            diffsIdx = output.index("Differences ...\n")
        desc['files'] = []
        fileRe = re.compile('^... (?P<depotFile>.+?)#(?P<rev>\d+) '\
                            '(?P<action>\w+)$')
        for line in output[filesIdx+2:diffsIdx-1]:
            file = fileRe.match(line).groupdict()
            file['rev'] = int(file['rev'])
            desc['files'].append(file)
        if not shortForm:
            desc['diff'] = self._parseDiffOutput(output[diffsIdx+2:])

        if _raw:
            return desc, {'stdout': ''.join(output),
                          'stderr': ''.join(error),
                          'retval': retval}
        else:
            return desc

    def change(self, files=None, description=None, change=None, delete=0,
               _raw=0, **p4options):
        """Create, update, delete, or get a changelist description.
        
        Creating a changelist:
            p4.change([<list of opened files>], "change description")
                                    OR
            p4.change(description="change description for all opened files")

        Updating a pending changelist:
            p4.change(description="change description",
                      change=<a pending changelist#>)
                                    OR
            p4.change(files=[<new list of files>],
                      change=<a pending changelist#>)

        Deleting a pending changelist:
            p4.change(change=<a pending changelist#>, delete=1)

        Getting a change description:
            ch = p4.change(change=<a pending or submitted changelist#>)
        
        Returns a dict. When getting a change desc the dict will include
        'change', 'user', 'description', 'status', and possibly 'files'
        keys. For all other actions the dict will include a 'change'
        key, an 'action' key iff the intended action was successful, and
        possibly a 'comment' key.

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}

        Limitations: The -s (jobs) and -f (force) flags are not
        supported.
        """
        #XXX .change() API should look more like .client() and .label(),
        #    i.e. passing around a dictionary. Should strings also be
        #    allowed: presumed to be forms?
        formfile = None
        try:
            if type(files) in types.StringTypes:
                files = [files]

            action = None # note action to know how to parse output below
            if change and files is None and not description:
                if delete:
                    # Delete a pending change list.
                    action = 'delete'
                    argv = ['change', '-d', str(change)]
                else:
                    # Get a change description.
                    action = 'get'
                    argv = ['change', '-o', str(change)]
            else:
                if delete:
                    raise P4LibError("Cannot specify 'delete' with either "\
                                     "'files' or 'description'.")
                if change:
                    # Edit a current pending changelist.
                    action = 'update'
                    ch = self.change(change=change, **p4options)
                    if files is None: # 'files' was not specified.
                        pass
                    elif files == []: # Explicitly specified no files.
                        # Explicitly specified no files.
                        ch['files'] = []
                    else:
                        depotfiles = [{'depotFile': f['depotFile']}\
                                      for f in self.where(files, **p4options)]
                        ch['files'] = depotfiles
                    if description:
                        ch['description'] = description
                    form = makeForm(**ch)
                elif description:
                    # Creating a pending changelist.
                    action = 'create'
                    # Empty 'files' should default to all opened files in the
                    # 'default' changelist.
                    if files is None:
                        files = [{'depotFile': f['depotFile']}\
                                 for f in self.opened(**p4options)]
                    elif files == []: # Explicitly specified no files.
                        pass
                    else:
                        #TODO: Add test to expect P4LibError if try to use
                        #      p4 wildcards in files. Currently *do* get
                        #      correct behaviour.
                        files = [{'depotFile': f['depotFile']}\
                                 for f in self.where(files, **p4options)]
                    form = makeForm(files=files, description=description,
                                    change='new')
                else:
                    raise P4LibError("Incomplete/missing arguments.")
                # Build submission form file.
                formfile = tempfile.mktemp()
                fout = open(formfile, 'w')
                fout.write(form)
                fout.close()
                argv = ['change', '-i', '<', formfile]
            
            output, error, retval = self._p4run(argv, **p4options)

            if action == 'get':
                change = parseForm(output)
            elif action in ('create', 'update', 'delete'):
                resultRes = [
                    re.compile("^Change (?P<change>\d+)"\
                               " (?P<action>created|updated|deleted)\.$"),
                    re.compile("^Change (?P<change>\d+) (?P<action>created)"\
                               " (?P<comment>.+?)\.$"),
                    re.compile("^Change (?P<change>\d+) (?P<action>updated)"\
                               ", (?P<comment>.+?)\.$"),
                    # e.g., Change 1 has 1 open file(s) associated with it and can't be deleted.
                    re.compile("^Change (?P<change>\d+) (?P<comment>.+?)\.$"),
                    ]
                for resultRe in resultRes:
                    match = resultRe.match(output[0])
                    if match:
                        change = match.groupdict()
                        change['change'] = int(change['change'])
                        break
                else:
                    err = "Internal error: could not parse change '%s' "\
                          "output: '%s'" % (action, output[0])
                    raise P4LibError(err)
            else:
                raise P4LibError("Internal error: unexpected action: '%s'"\
                                 % action)

            if _raw:
                return change, {'stdout': ''.join(output),
                                'stderr': ''.join(error),
                                'retval': retval}
            else:
                return change
        finally:
            if formfile:
                os.remove(formfile)

    def changes(self, files=[], followIntegrations=0, longOutput=0,
                max=None, status=None, _raw=0, **p4options):
        """Return a list of pending and submitted changelists.

        "files" is a list of files or file wildcards that will limit the
            results to changes including these files. Defaults to the
            whole client view.
        "followIntegrations" (-i) specifies to include any changelists
            integrated into the given files.
        "longOutput" (-l) includes changelist descriptions.
        "max" (-m) limits the results to the given number of most recent
            relevant changes.
        "status" (-s) limits the output to 'pending' or 'submitted'
            changelists.

        Returns a list of dicts, each representing one change spec. Keys
        are: 'change', 'date', 'client', 'user', 'description'.

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        if max is not None and type(max) != types.IntType:
            raise P4LibError("Incorrect 'max' value. It must be an integer: "\
                             "'%s' (type '%s')" % (max, type(max)))
        if status is not None and status not in ("pending", "submitted"):
            raise P4LibError("Incorrect 'status' value: '%s'" % status)

        if type(files) in types.StringTypes:
            files = [files]

        optv = []
        if followIntegrations:
            optv.append('-i')
        if longOutput:
            optv.append('-l')
        if max is not None:
            optv += ['-m', str(max)]
        if status is not None:
            optv += ['-s', status]
        argv = ['changes'] + optv
        if files:
            argv += _escapeFilenames(files)
        output, error, retval = self._p4run(argv, **p4options)

        changes = []
        if longOutput:
            changeRe = re.compile("^Change (?P<change>\d+) on "\
                                  "(?P<date>[\d/]+) by (?P<user>[^\s@]+)@"\
                                  "(?P<client>[^\s@]+)$")
            for line in output:
                if not line.strip(): continue  # skip blank lines
                if line.startswith('\t'):
                    # Append this line (minus leading tab) to last
                    # change's description.
                    changes[-1]['description'] += line[1:]
                else:
                    change = changeRe.match(line).groupdict()
                    change['change'] = int(change['change'])
                    change['description'] = ''
                    changes.append(change)
        else:
            changeRe = re.compile("^Change (?P<change>\d+) on "\
                                  "(?P<date>[\d/]+) by (?P<user>[^\s@]+)@"\
                                  "(?P<client>[^\s@]+) (\*pending\* )?"\
                                  "'(?P<description>.*?)'$")
            for line in output:
                match = changeRe.match(line)
                if match:
                    change = match.groupdict()
                    change['change'] = int(change['change'])
                    changes.append(change)
                else:
                    raise P4LibError("Internal error: could not parse "\
                                     "'p4 changes' output line: '%s'" % line)

        if _raw:
            return changes, {'stdout': ''.join(output),
                             'stderr': ''.join(error),
                             'retval': retval}
        else:
            return changes

    def sync(self, files=[], force=0, dryrun=0, _raw=0, **p4options):
        """Synchronize the client with its view of the depot.
        
        "files" is a list of files or file wildcards to sync. Defaults
            to the whole client view.
        "force" (-f) forces resynchronization even if the client already
            has the file, and clobbers writable files.
        "dryrun" (-n) causes sync to go through the motions and report
            results but not actually make any changes.

        Returns a list of dicts representing the sync'd files. Keys are:
        'depotFile', 'rev', 'comment', and possibly 'notes'.

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        if type(files) in types.StringTypes:
            files = [files]
        optv = []
        if force:
            optv.append('-f')
        if dryrun:
            optv.append('-n')

        argv = ['sync'] + optv
        if files:
            argv += _escapeFilenames(files)
        output, error, retval = self._p4run(argv, **p4options)

        # Forms of output:
        #    //depot/foo#1 - updating C:\foo
        #    //depot/foo#1 - is opened and not being changed
        #    //depot/foo#1 - is opened at a later revision - not changed
        #    //depot/foo#1 - deleted as C:\foo
        #    ... //depot/foo - must resolve #2 before submitting
        # There are probably others forms.
        hits = []
        lineRe = re.compile('^(?P<depotFile>.+?)#(?P<rev>\d+) - '\
                            '(?P<comment>.+?)$')
        for line in output:
            if line.startswith('... '):
                note = line.split(' - ')[-1].strip()
                hits[-1]['notes'].append(note)
                continue
            match = lineRe.match(line)
            if match:
                hit = match.groupdict()
                hit['rev'] = int(hit['rev'])
                hit['notes'] = []
                hits.append(hit)
                continue
            raise P4LibError("Internal error: could not parse 'p4 sync'"\
                             "output line: '%s'" % line)

        if _raw:
            return hits, {'stdout': ''.join(output),
                          'stderr': ''.join(error),
                          'retval': retval}
        else:
            return hits

    def edit(self, files, change=None, filetype=None, _raw=0, **p4options):
        """Open an existing file for edit.

        "files" is a list of files or file wildcards to open for edit.
        "change" (-c) is a pending changelist number in which to put the
            opened files.
        "filetype" (-t) specifies to explicitly open the files with the
            given filetype.

        Returns a list of dicts representing commentary on each file
        opened for edit.  Keys are: 'depotFile', 'rev', 'comment', 'notes'.

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        if type(files) in types.StringTypes:
            files = [files]
        optv = []
        if change:
            optv += ['-c', str(change)]
        if filetype:
            optv += ['-t', filetype]
        
        argv = ['edit'] + optv + _escapeFilenames(files)
        output, error, retval = self._p4run(argv, **p4options)

        # Example output:
        #   //depot/build.py#142 - opened for edit
        #   ... //depot/build.py - must sync/resolve #143,#148 before submitting
        #   ... //depot/build.py - also opened by davida@davida-bertha
        #   ... //depot/build.py - also opened by davida@davida-loom
        #   ... //depot/build.py - also opened by davida@davida-marteau
        #   ... //depot/build.py - also opened by trentm@trentm-razor
        #   //depot/BuildNum.txt#3 - currently opened for edit
        hits = []
        lineRe = re.compile('^(?P<depotFile>.+?)#(?P<rev>\d+) - '\
                            '(?P<comment>.*)$')
        for line in output:
            if line.startswith("..."): # this is a note for the latest hit
                note = line.split(' - ')[-1].strip()
                hits[-1]['notes'].append(note)
            else:
                hit = lineRe.match(line).groupdict()
                hit['rev'] = int(hit['rev'])
                hit['notes'] = []
                hits.append(hit)

        if _raw:
            return hits, {'stdout': ''.join(output),
                          'stderr': ''.join(error),
                          'retval': retval}
        else:
            return hits

    def add(self, files, change=None, filetype=None, _raw=0, **p4options):
        """Open a new file to add it to the depot.
        
        "files" is a list of files or file wildcards to open for add.
        "change" (-c) is a pending changelist number in which to put the
            opened files.
        "filetype" (-t) specifies to explicitly open the files with the
            given filetype.

        Returns a list of dicts representing commentary on each file
        *attempted* to be opened for add. Keys are: 'depotFile', 'rev',
        'comment', 'notes'. If a given file is NOT added then the 'rev'
        will be None.

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        if type(files) in types.StringTypes:
            files = [files]
        optv = []
        if change:
            optv += ['-c', str(change)]
        if filetype:
            optv += ['-t', filetype]
        
        argv = ['add'] + optv + _escapeFilenames(files)
        output, error, retval = self._p4run(argv, **p4options)

        # Example output:
        #   //depot/apps/px/p4.py#1 - opened for add
        #   c:\trentm\apps\px\p4.py - missing, assuming text.
        #
        #   //depot/apps/px/px.py - can't add (already opened for edit)
        #   ... //depot/apps/px/px.py - warning: add of existing file
        #
        #   //depot/apps/px/px.cpp - can't add existing file
        #
        #   //depot/apps/px/t#1 - opened for add
        #
        hits = []
        hitRe = re.compile('^(?P<depotFile>//.+?)(#(?P<rev>\d+))? - '\
                            '(?P<comment>.*)$')
        for line in output:
            match = hitRe.match(line)
            if match:
                hit = match.groupdict()
                if hit['rev'] is not None:
                    hit['rev'] = int(hit['rev'])
                hit['notes'] = []
                hits.append(hit)
            else:
                if line.startswith("..."):
                    note = line.split(' - ')[-1].strip()
                else:
                    note = line.strip()
                hits[-1]['notes'].append(note)

        if _raw:
            return hits, {'stdout': ''.join(output),
                          'stderr': ''.join(error),
                          'retval': retval}
        else:
            return hits

    def files(self, files, _raw=0, **p4options):
        """List files in the depot.
        
        "files" is a list of files or file wildcards to list. Defaults
            to the whole client view.

        Returns a list of dicts, each representing one matching file. Keys
        are: 'depotFile', 'rev', 'type', 'change', 'action'.

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        if type(files) in types.StringTypes:
            files = [files]
        if not files:
            raise P4LibError("Missing/wrong number of arguments.")

        argv = ['files'] + _escapeFilenames(files)
        output, error, retval = self._p4run(argv, **p4options)

        hits = []
        fileRe = re.compile("^(?P<depotFile>//.*?)#(?P<rev>\d+) - "\
                            "(?P<action>\w+) change (?P<change>\d+) "\
                            "\((?P<type>[\w+]+)\)$")
        for line in output:
            match = fileRe.match(line)
            hit = match.groupdict()
            hit['rev'] = int(hit['rev'])
            hit['change'] = int(hit['change'])
            hits.append(hit)

        if _raw:
            return hits, {'stdout': ''.join(output),
                          'stderr': ''.join(error),
                          'retval': retval}
        else:
            return hits
        
    def dirs(self, filepath):
        """List dirs in the depot.
        """
        argv = ['dirs', '*']
        env = koprocessutils.getUserEnv()
        env['cwd'] = filepath
        
        output, error, retval = self._p4run(argv, cwd=filepath)
        
        hits = []
        fileRe = re.compile("\/(?P<relativePath>/.*?)$")
        for line in output:
            match = fileRe.match(line)
            hit = match.groupdict()
            hits.append(hit['relativePath'])

        return hits


    def filelog(self, files, followIntegrations=0, longOutput=0, maxRevs=None,
                _raw=0, **p4options):
        """List revision histories of files.
        
        "files" is a list of files or file wildcards to describe.
        "followIntegrations" (-i) specifies to follow branches.
        "longOutput" (-l) includes changelist descriptions.
        "maxRevs" (-m) limits the results to the given number of
            most recent revisions.

        Returns a list of hits. Each hit is a dict with the following
        keys: 'depotFile', 'revs'. 'revs' is a list of dicts, each
        representing one submitted revision of 'depotFile' and
        containing the following keys: 'action', 'change', 'client',
        'date', 'type', 'notes', 'rev', 'user'.

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        if maxRevs is not None and type(maxRevs) != types.IntType:
            raise P4LibError("Incorrect 'maxRevs' value. It must be an "\
                             "integer: '%s' (type '%s')"\
                             % (maxRevs, type(maxRevs)))

        if type(files) in types.StringTypes:
            files = [files]
        if not files:
            raise P4LibError("Missing/wrong number of arguments.")

        optv = []
        if followIntegrations:
            optv.append('-i')
        if longOutput:
            optv.append('-l')
        if maxRevs is not None:
            optv += ['-m', str(maxRevs)]
        argv = ['filelog'] + optv + files
        output, error, retval = self._p4run(argv, **p4options)

        hits = []
        revRe = re.compile("^... #(?P<rev>\d+) change (?P<change>\d+) "\
                           "(?P<action>\S+) on (?P<date>[\d/]+) by "\
                           "(?P<user>[^\s@]+)@(?P<client>[^\s@]+) "\
                           "\((?P<type>[\w+]+)\)( '(?P<description>.*?)')?$")
        for line in output:
            if longOutput and not line.strip():
                continue  # skip blank lines
            elif line.startswith('//'):
                hit = {'depotFile': line.strip(), 'revs': []}
                hits.append(hit)
            elif line.startswith('... ... '):
                hits[-1]['revs'][-1]['notes'].append(line[8:].strip())
            elif line.startswith('... '):
                match = revRe.match(line)
                if match:
                    d = match.groupdict('')
                    d['change'] = int(d['change'])
                    d['rev'] = int(d['rev'])
                    hits[-1]['revs'].append(d)
                    hits[-1]['revs'][-1]['notes'] = []
                else:
                    raise P4LibError("Internal parsing error: '%s'" % line)
            elif longOutput and line.startswith('\t'):
                # Append this line (minus leading tab) to last hit's
                # last rev's description.
                hits[-1]['revs'][-1]['description'] += line[1:]
            else:
                raise P4LibError("Unexpected 'p4 filelog' output: '%s'"\
                                 % line)

        if _raw:
            return hits, {'stdout': ''.join(output),
                          'stderr': ''.join(error),
                          'retval': retval}
        else:
            return hits

    def print_(self, files, localFile=None, quiet=0, **p4options):
        """Retrieve depot file contents.
        
        "files" is a list of files or file wildcards to print.
        "localFile" (-o) is the name of a local file in which to put the
            output text.
        "quiet" (-q) suppresses some file meta-information.

        Returns a list of dicts, each representing one matching file.
        Keys are: 'depotFile', 'rev', 'type', 'change', 'action',
        and 'text'. If 'quiet', the first five keys will not be present.
        The 'text' key will not be present if the file is binary. If
        both 'quiet' and 'localFile', there will be no hits at all.
        """
        if type(files) in types.StringTypes:
            files = [files]
        if not files:
            raise P4LibError("Missing/wrong number of arguments.")

        optv = []
        if localFile:
            optv += ['-o', localFile]
        if quiet:
            optv.append('-q')
        # There is *no* way to properly and reliably parse out multiple file
        # output without using -s or -G. Use the latter.
        if p4options:
            d = self.optd
            d.update(p4options)
            p4optv = makeOptv(**d)
        else:
            p4optv = self._optv
        argv = [self.p4, '-G'] + p4optv + ['print'] + optv + files
        cmd = _joinArgv(argv)
        #XXX update with ProcessOpen if available!
        log.debug("popen3 '%s'..." % cmd)
        i, o, e = os.popen3(cmd)
        hits = []
        fileRe = re.compile("^(?P<depotFile>//.*?)#(?P<rev>\d+) - "\
                            "(?P<action>\w+) change (?P<change>\d+) "\
                            "\((?P<type>[\w+]+)\)$")
        try:
            startHitWithNextNode = 1
            while 1:
                node = marshal.load(o)
                if node['code'] == 'info':
                    # Always start a new hit with an 'info' node.
                    match = fileRe.match(node['data'])
                    hit = match.groupdict()
                    hit['change'] = int(hit['change'])
                    hit['rev'] = int(hit['rev'])
                    hits.append(hit)
                    startHitWithNextNode = 0
                elif node['code'] == 'text':
                    if startHitWithNextNode:
                        hit = {'text': node['data']}
                        hits.append(hit)
                    else:
                        if not hits[-1].has_key('text')\
                           or hits[-1]['text'] is None:
                            hits[-1]['text'] = node['data']
                        else:
                            hits[-1]['text'] += node['data']
                    startHitWithNextNode = not node['data']
        except EOFError:
            pass

        if _raw:
            return hits, {'stdout': ''.join(output),
                          'stderr': ''.join(error),
                          'retval': retval}
        else:
            return hits

    def diff(self, files=[], diffFormat='', force=0, satisfying=None,
             text=0, _raw=0, p4diff=None, **p4options): 
        """Display diff of client files with depot files.
        
        "files" is a list of files or file wildcards to diff.
        "diffFormat" (-d<flag>) is a flag to pass to the built-in diff
            routine to control the output format. Valid values are ''
            (plain, default), 'n' (RCS), 'c' (context), 's' (summary),
            'u' (unified).
        "force" (-f) forces a diff of every file.
        "satifying" (-s<flag>) limits the output to the names of files
            satisfying certain criteria:
               'a'     Opened files that are different than the revision
                       in the depot, or missing.
               'd'     Unopened files that are missing on the client.
               'e'     Unopened files that are different than the
                       revision in the depot.
               'r'     Opened files that are the same as the revision in
                       the depot.
        "text" (-t) forces diffs of non-text files.

        "p4diff": specify what tool to use for p4 diff --
              Default (None): use the user's environment -- do nothing special
              Empty string: remove P4DIFF from environment -- always return text diff
              Something else: set P4DIFF to that something else.

        Returns a list of dicts representing each file diff'd. If
        "satifying" is specified each dict will simply include a
        'localFile' key. Otherwise, each dict will include 'localFile',
        'depotFile', 'rev', and 'binary' (boolean) keys and possibly a
        'text' or a 'notes' key iff there are any differences. Generally
        you will get a 'notes' key for differing binary files. 

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        if type(files) in types.StringTypes:
            files = [files]
        if diffFormat not in ('', 'n', 'c', 's', 'u'):
            raise P4LibError("Incorrect diff format flag: '%s'" % diffFormat)
        if satisfying is not None\
           and satisfying not in ('a', 'd', 'e', 'r'):
            raise P4LibError("Incorrect 'satisfying' flag: '%s'" % satisfying)
        optv = []
        if diffFormat:
            optv.append('-d%s' % diffFormat)
        if satisfying:
            optv.append('-s%s' % satisfying)
        if force:
            optv.append('-f')
        if text:
            optv.append('-t')

        # There is *no* to properly and reliably parse out multiple file
        # output without using -s or -G. Use the latter. (XXX Huh?)
        argv = ['diff'] + optv + files

        env = koprocessutils.getUserEnv()
        if p4diff is None:
            pass
        elif p4diff == '':
            if "P4DIFF" in env:
                del env['P4DIFF']
        else:
            env['P4DIFF']= p4diff
        
        output, error, retval = self._p4run(argv, env, **p4options)
        if satisfying is not None:
            hits = [{'localFile': line[:-1]} for line in output]
        else:
            hits = self._parseDiffOutput(output)

        if _raw:
            return hits, {'stdout': ''.join(output),
                          'stderr': ''.join(error),
                          'retval': retval}
        else:
            return hits

    def _parseDiffOutput(self, outputLines):
        hits = []
        # Example header lines:
        #   - from 'p4 describe':
        #       ==== //depot/apps/px/ReadMe.txt#5 (text) ====
        #   - from 'p4 diff':
        #       ==== //depot/apps/px/p4lib.py#12 - c:\trentm\apps\px\p4lib.py ====
        #       ==== //depot/foo.doc#42 - c:\trentm\foo.doc ==== (binary)
        #   - from 'p4 diff2':
        #       ==== //depot/apps/px/p4lib.py#12 - //depot/foo.doc#42 ==== (content)
        header1Re = re.compile("^==== (?P<depotFile>//.*?)#(?P<rev>\d+) "\
                               "\((?P<type>\w+)\) ====$")
        header2Re = re.compile("^==== (?P<depotFile>//.*?)#(?P<rev>\d+) - "\
                               "(?P<localFile>.+?) ===="\
                               "(?P<binary> \(binary\))?$")
        for line in outputLines:
            header1 = header1Re.match(line)
            header2 = header2Re.match(line)
            if header1:
                hit = header1.groupdict()
                hit['rev'] = int(hit['rev'])
                hits.append(hit)
            elif header2:
                hit = header2.groupdict()
                hit['rev'] = int(hit['rev'])
                hit['binary'] = not not hit['binary'] # get boolean value
                hits.append(hit)
            elif hits:
                if not hits[-1].has_key('text')\
                  and line == "(... files differ ...)\n":
                    hits[-1]['notes'] = [line]
                else:
                    # This is a diff line.
                    if not hits[-1].has_key('text'):
                        hits[-1]['text'] = ''
                        # XXX 'p4 describe' diff text includes a single
                        #     blank line after each header line before the
                        #     actual diff. Should this be stripped?
                    hits[-1]['text'] += line

        return hits

    def diff2(self, file1, file2, diffFormat='', quiet=0, text=0,
              **p4options):
        """Compare two depot files.
        
        "file1" and "file2" are the two files to diff.
        "diffFormat" (-d<flag>) is a flag to pass to the built-in diff
            routine to control the output format. Valid values are ''
            (plain, default), 'n' (RCS), 'c' (context), 's' (summary),
            'u' (unified).
        "quiet" (-q) suppresses some meta information and all
            information if the files do not differ.

        Returns a dict representing the diff. Keys are: 'depotFile1',
        'rev1', 'type1', 'depotFile2', 'rev2', 'type2',
        'summary', 'notes', 'text'. There may not be a 'text' key if the
        files are the same or are binary. The first eight keys will not
        be present if 'quiet'.

        Note that the second 'p4 diff2' style is not supported:
            p4 diff2 [ -d<flag> -q -t ] -b branch [ [ file1 ] file2 ]
        """
        if diffFormat not in ('', 'n', 'c', 's', 'u'):
            raise P4LibError("Incorrect diff format flag: '%s'" % diffFormat)
        optv = []
        if diffFormat:
            optv.append('-d%s' % diffFormat)
        if quiet:
            optv.append('-q')
        if text:
            optv.append('-t')

        # There is *no* way to properly and reliably parse out multiple
        # file output without using -s or -G. Use the latter.
        if p4options:
            d = self.optd
            d.update(p4options)
            p4optv = makeOptv(**d)
        else:
            p4optv = self._optv
        argv = [self.p4, '-G'] + p4optv + ['diff2'] + optv + [file1, file2]
        cmd = _joinArgv(argv)
        #XXX update with ProcessOpen if available!
        i, o, e = os.popen3(cmd)
        diff = {}
        infoRe = re.compile("^==== (?P<depotFile1>.+?)#(?P<rev1>\d+) "\
                            "\((?P<type1>[\w+]+)\) - "\
                            "(?P<depotFile2>.+?)#(?P<rev2>\d+) "\
                            "\((?P<type2>[\w+]+)\) "\
                            "==== (?P<summary>\w+)$")
        try:
            while 1:
                node = marshal.load(o)
                if node['code'] == 'info'\
                   and node['data'] == '(... files differ ...)':
                    if diff.has_key('notes'):
                        diff['notes'].append(node['data'])
                    else:
                        diff['notes'] = [ node['data'] ]
                elif node['code'] == 'info':
                    match = infoRe.match(node['data'])
                    d = match.groupdict()
                    d['rev1'] = int(d['rev1'])
                    d['rev2'] = int(d['rev2'])
                    diff.update( match.groupdict() )
                elif node['code'] == 'text':
                    if not diff.has_key('text') or diff['text'] is None:
                        diff['text'] = node['data']
                    else:
                        diff['text'] += node['data']
        except EOFError:
            pass

        if _raw:
            return diff, {'stdout': ''.join(output),
                          'stderr': ''.join(error),
                          'retval': retval}
        else:
            return diff

    # Similar to diff2
    def diffRevisions(self, filename1, revision1='', filename2='', revision2='',
                      diffFormat='', text=0, _raw=0, p4diff=None, **p4options):
        """Compare two revisions of a depot file.
        
        "filename1" is the first file to diff.
        "revision1" is the revision of the first file to check against.
        "filename2" is the second file to diff.
        "revision2" is the second revision number checked against.
        "diffFormat" (-d<flag>) is a flag to pass to the built-in diff
            routine to control the output format. Valid values are ''
            (plain, default), 'n' (RCS), 'c' (context), 's' (summary),
            'u' (unified).
        "text" (-t) forces diffs of non-text files.
        "p4diff": specify what tool to use for p4 diff --
              Default (None): use the user's environment -- do nothing special
              Empty string: remove P4DIFF from environment -- always return text diff
              Something else: set P4DIFF to that something else.

        Returns a dict representing the diff. Keys are: 'depotFile1',
        'rev1', 'type1', 'depotFile2', 'rev2', 'type2',
        'summary', 'notes', 'text'. There may not be a 'text' key if the
        files are the same or are binary.

        Note that the second 'p4 diff2' style is not supported:
            p4 diff2 [ -d<flag> -q -t ] -b branch [ [ file1 ] file2 ]
        """
        if diffFormat not in ('', 'n', 'c', 's', 'u'):
            raise P4LibError("Incorrect diff format flag: '%s'" % diffFormat)
        optv = []
        if diffFormat:
            optv.append('-d%s' % diffFormat)
        if text:
            optv.append('-t')

        # There is *no* way to properly and reliably parse out multiple
        # file output without using -s or -G. Use the latter.
        argv = ['diff2'] + optv

        filename1 = _escapeFilename(filename1)
        filename2 = _escapeFilename(filename2)
        for rev, filename in ((revision1, filename1), (revision2, filename2)):
            if rev:
                argv.append("%s#%s" % (filename, rev))
            else:
                argv.append("%s" % (filename))

        env = koprocessutils.getUserEnv()
        if p4diff is None:
            pass
        elif p4diff == '':
            if "P4DIFF" in env:
                del env['P4DIFF']
        else:
            env['P4DIFF']= p4diff

        output, error, retval = self._p4run(argv, env, **p4options)
        #print ''.join(output)

        hit = {}
        if output and len(output) >= 1:
            headerRe = re.compile("^==== (?P<depotFile1>.+?)#(?P<rev1>\d+) "\
                                  "\((?P<type1>[\w+]+)\) - "\
                                  "(?P<depotFile2>.+?)#(?P<rev2>\d+) "\
                                  "\((?P<type2>[\w+]+)\) "\
                                  "==== (?P<summary>\w+)$")
            match = headerRe.match(output[0])
            if match:
                hit = match.groupdict()
                hit['rev1'] = int(hit['rev1'])
                hit['rev2'] = int(hit['rev2'])
                hit['text'] = ''.join(output[1:])
            else:
                hit['text'] = ''.join(output)

        if _raw:
            return hit, {'stdout': ''.join(output),
                         'stderr': ''.join(error),
                         'retval': retval}
        else:
            return hit

    def revert(self, files=[], change=None, unchangedOnly=0, _raw=0,
               **p4options):
        """Discard changes for the given opened files.
        
        "files" is a list of files or file wildcards to revert. Default
            to the whole client view.
        "change" (-c) will limit to files opened in the given
            changelist.
        "unchangedOnly" (-a) will only revert opened files that are not
            different than the version in the depot.

        Returns a list of dicts representing commentary on each file
        reverted.  Keys are: 'depotFile', 'rev', 'comment'.

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        if type(files) in types.StringTypes:
            files = [files]
        optv = []
        if change:
            optv += ['-c', str(change)]
        if unchangedOnly:
            optv += ['-a']
        if not unchangedOnly and not files:
            raise P4LibError("Missing/wrong number of arguments.")

        argv = ['revert'] + optv + files
        output, error, retval = self._p4run(argv, **p4options)

        # Example output:
        #   //depot/hello.txt#1 - was edit, reverted
        #   //depot/test_g.txt#none - was add, abandoned
        hits = []
        hitRe = re.compile('^(?P<depotFile>//.+?)(#(?P<rev>\w+))? - '\
                            '(?P<comment>.*)$')
        for line in output:
            match = hitRe.match(line)
            if match:
                hit = match.groupdict()
                try:
                    hit['rev'] = int(hit['rev'])
                except ValueError:
                    pass
                hits.append(hit)
            else:
                raise P4LibError("Internal parsing error: '%s'" % line)

        if _raw:
            return hits, {'stdout': ''.join(output),
                          'stderr': ''.join(error),
                          'retval': retval}
        else:
            return hits

    def resolve(self, files=[], autoMode='', force=0, dryrun=0,
                text=0, verbose=0, _raw=0, **p4options):
        """Merge open files with other revisions or files.

        This resolve, for obvious reasons, only supports the options to
        'p4 resolve' that will result is *no* command line interaction.

        'files' is a list of files, of file wildcards, to resolve.
        'autoMode' (-a*) tells how to resolve merges. See below for
            valid values.
        'force' (-f) allows previously resolved files to be resolved again.
        'dryrun' (-n) lists the integrations that *would* be performed
            without performing them.
        'text' (-t) will force a textual merge, even for binary file types.
        'verbose' (-v) will cause markers to be placed in all changed
            files not just those that conflict.

        Valid values of 'autoMode' are:
            ''              '-a' I believe this is equivalent to '-am'.
            'f', 'force'    '-af' Force acceptance of merged files with
                            conflicts.
            'm', 'merge'    '-am' Attempts to merge.
            's', 'safe'     '-as' Does not attempt to merge.
            't', 'theirs'   '-at' Accepts "their" changes, OVERWRITING yours.
            'y', 'yours'    '-ay' Accepts your changes, OVERWRITING "theirs".
        Invalid values of 'autoMode':
            None            As if no -a option had been specified.
                            Invalid because this may result in command
                            line interaction.

        Returns a list of dicts representing commentary on each file for
        which a resolve was attempted. Keys are: 'localFile', 'clientFile' 
        'comment', and 'action'; and possibly 'diff chunks' if there was
        anything to merge.

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        if type(files) in types.StringTypes:
            files = [files]
        optv = []
        if autoMode is None:
            raise P4LibError("'autoMode' must be non-None, otherwise "\
                             "'p4 resolve' may initiate command line "\
                             "interaction, which will hang this method.")
        else:
            optv += ['-a%s' % autoMode]
        if force:
            optv += ['-f']
        if dryrun:
            optv += ['-n']
        if text:
            optv += ['-t']
        if verbose:
            optv += ['-v']
        argv = ['resolve'] + optv + files
        output, error, retval = self._p4run(argv, **p4options)

        hits = []
        # Example output:
        #   C:\rootdir\foo.txt - merging //depot/foo.txt#2
        #   Diff chunks: 0 yours + 0 theirs + 0 both + 1 conflicting
        #   //client-name/foo.txt - resolve skipped.
        # Proposed result:
        #   [{'localFile': 'C:\\rootdir\\foo.txt',
        #     'depotFile': '//depot/foo.txt',
        #     'rev': 2
        #     'clientFile': '//client-name/foo.txt',
        #     'diff chunks': {'yours': 0, 'theirs': 0, 'both': 0,
        #                     'conflicting': 1}
        #     'action': 'resolve skipped'}]
        #
        # Example output:
        #   C:\rootdir\foo.txt - vs //depot/foo.txt#2
        #   //client-name/foo.txt - ignored //depot/foo.txt
        # Proposed result:
        #   [{'localFile': 'C:\\rootdir\\foo.txt',
        #     'depotFile': '//depot/foo.txt',
        #     'rev': 2
        #     'clientFile': '//client-name/foo.txt',
        #     'diff chunks': {'yours': 0, 'theirs': 0, 'both': 0,
        #                     'conflicting': 1}
        #     'action': 'ignored //depot/foo.txt'}]
        #    
        introRe = re.compile('^(?P<localFile>.+?) - (merging|vs) '\
                             '(?P<depotFile>//.+?)#(?P<rev>\d+)$')
        diffRe = re.compile('^Diff chunks: (?P<yours>\d+) yours \+ '\
                            '(?P<theirs>\d+) theirs \+ (?P<both>\d+) both '\
                            '\+ (?P<conflicting>\d+) conflicting$')
        actionRe = re.compile('^(?P<clientFile>//.+?) - (?P<action>.+?)(\.)?$')
        for line in output:
            match = introRe.match(line)
            if match:
                hit = match.groupdict()
                hit['rev'] = int(hit['rev'])
                hits.append(hit)
                log.info("parsed resolve 'intro' line: '%s'" % line.strip())
                continue
            match = diffRe.match(line)
            if match:
                diff = match.groupdict()
                diff['yours'] = int(diff['yours'])
                diff['theirs'] = int(diff['theirs'])
                diff['both'] = int(diff['both'])
                diff['conflicting'] = int(diff['conflicting'])
                hits[-1]['diff chunks'] = diff
                log.info("parsed resolve 'diff' line: '%s'" % line.strip())
                continue
            match = actionRe.match(line)
            if match:
                hits[-1].update(match.groupdict())
                log.info("parsed resolve 'action' line: '%s'" % line.strip())
                continue
            raise P4LibError("Internal error: could not parse 'p4 resolve' "\
                             "output line: line='%s' argv=%s" % (line, argv))

        if _raw:
            return hits, {'stdout': ''.join(output),
                          'stderr': ''.join(error),
                          'retval': retval}
        else:
            return hits

    def submit(self, files=None, description=None, change=None, _raw=0,
               **p4options):
        """Submit open files to the depot.

        There are two ways to call this method:
            - Submit specific files:
                p4.submit([...], "checkin message")
            - Submit a pending changelist:
                p4.submit(change=123)
              Note: 'change' should always be specified with a keyword
              argument. I reserve the right to extend this method by
              adding kwargs *before* the change arg. So p4.submit(None,
              None, 123) is not guaranteed to work.

        Returns a dict with a 'files' key (which is a list of dicts with
        'depotFile', 'rev', and 'action' keys), and 'action'
        (=='submitted') and 'change' keys iff the submit is succesful.

        Note: An equivalent for the '-s' option to 'p4 submit' is not
        supported, because I don't know how to use it and have never.
        Nor is the '-i' option supported, although it *is* used
        internally to drive 'p4 submit'.

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        #TODO:
        #   - test when submission fails because files need to be
        #     resolved
        #   - Structure this code more like change, client, label, & branch.
        if type(files) in types.StringTypes:
            files = [files]
        if change and not files and not description:
            argv = ['submit', '-c', str(change)]
            input = None
        elif not change and files is not None and description:
            # Empty 'files' should default to all opened files in the
            # 'default' changelist.
            if not files:
                files = [{'depotFile': f['depotFile']}\
                            for f in self.opened(**p4options)]
            else:
                #TODO: Add test to expect P4LibError if try to use
                #      p4 wildcards in files.
                files = [{'depotFile': f['depotFile']}
                         for f in self.where(files=files, **p4options)
                         if not f["minus"]]
            # Build submission form.
            argv = ['submit', '-i']
            input = makeForm(files=files, description=description,
                                change='new')
        else:
            raise P4LibError("Incorrect arguments. You must specify "\
                                "'change' OR you must specify 'files' and "\
                                "'description'.")

        output, error, retval = self._p4run(argv, input=input, **p4options)

        # Example output:
        #    Change 1 created with 1 open file(s).
        #    Submitting change 1.
        #    Locking 1 files ...
        #    add //depot/test_simple_submit.txt#1
        #    Change 1 submitted.
        #    //depot/test_simple_submit.txt#1 - refreshing
        #
        # Note: That last line only if there are keywords to expand in the
        # submitted file.
        #
        # This returns (similar to .change() output):
        #    {'change': 1,
        #     'action': 'submitted',
        #     'files': [{'depotFile': '//depot/test_simple_submit.txt',
        #                'rev': 1,
        #                'action': 'add'}]}
        # i.e. only the file actions and the last "submitted" line are
        # looked for.
        skipRes = [
            re.compile('^Change \d+ created with \d+ open file\(s\)\.$'),
            re.compile('^Submitting change \d+\.$'),
            re.compile('^Locking \d+ files \.\.\.$'),
            re.compile('^(//.+?)#\d+ - refreshing$'),
        ]
        fileRe = re.compile('^(?P<action>\w+) (?P<depotFile>//.+?)'\
                            '#(?P<rev>\d+)$')
        resultRe = re.compile('^Change (?P<change>\d+) '\
                                '(?P<action>submitted)\.')
        result = {'files': []}
        for line in output:
            match = fileRe.match(line)
            if match:
                file = match.groupdict()
                file['rev'] = int(file['rev'])
                result['files'].append(file)
                log.info("parsed submit 'file' line: '%s'", line.strip())
                continue
            match = resultRe.match(line)
            if match:
                result.update(match.groupdict())
                result['change'] = int(result['change'])
                log.info("parsed submit 'result' line: '%s'",
                            line.strip())
                continue
            # The following is technically just overhead but it is
            # considered more robust if we explicitly try to recognize
            # all output. Unrecognized output can be warned or raised.
            for skipRe in skipRes:
                match = skipRe.match(line)
                if match:
                    log.info("parsed submit 'skip' line: '%s'",
                                line.strip())
                    break
            else:
                log.warn("Unrecognized output line from running %s: "\
                            "'%s'. Please report this to the maintainer."\
                            % (argv, line))

        if _raw:
            return result, {'stdout': ''.join(output),
                            'stderr': ''.join(error),
                            'retval': retval}
        else:
            return result

    def cat(self, files, _raw=0, **p4options):
        """
        Call p4 print and return the result
        """
        if type(files) in types.StringTypes:
            files = [files]
        if len(files) != 1:
            raise SVNLibError("cat takes exactly one argument")
        argv = ['print']
        if not _raw:
            argv.append("-q")
        argv += files
        output, error, retval = self._p4run(argv, **p4options)
        hits = [] # We don't care about hits in this output
        return hits, {'stdout': ''.join(output),
                      'stderr': ''.join(error),
                      'retval': retval}

    def delete(self, files, change=None, _raw=0, **p4options):
        """Open an existing file to delete it from the depot.

        "files" is a list of files or file wildcards to open for delete.
        "change" (-c) is a pending change with which to associate the
            opened file(s).

        Returns a list of dicts each representing a file *attempted* to
        be open for delete. Keys are 'depotFile', 'rev', and 'comment'.
        If the file could *not* be openned for delete then 'rev' will be
        None.

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        if type(files) in types.StringTypes:
            files = [files]
        optv = []
        if change: optv += ['-c', str(change)]

        argv = ['delete'] + optv + files
        output, error, retval = self._p4run(argv, **p4options)

        # Example output:
        #   //depot/foo.txt#1 - opened for delete
        #   //depot/foo.txt - can't delete (already opened for edit)
        hits = []
        hitRe = re.compile('^(?P<depotFile>.+?)(#(?P<rev>\d+))? - '\
                            '(?P<comment>.*)$')
        for line in output:
            match = hitRe.match(line)
            if match:
                hit = match.groupdict()
                if hit['rev'] is not None:
                    hit['rev'] = int(hit['rev'])
                hits.append(hit)
            else:
                raise P4LibError("Internal error: could not parse "\
                                 "'p4 delete' output line: '%s'. Please "\
                                 "report this to the author." % line)

        if _raw:
            return hits, {'stdout': ''.join(output),
                          'stderr': ''.join(error),
                          'retval': retval}
        else:
            return hits

    def client(self, name=None, client=None, delete=0, _raw=0, **p4options):
        """Create, update, delete, or get a client specification.
        
        Creating a new client spec or updating an existing one:
            p4.client(client=<client dictionary>)
                          OR
            p4.client(name=<an existing client name>,
                      client=<client dictionary>)
        Returns a dictionary of the following form:
            {'client': <clientname>, 'action': <action taken>}

        Deleting a client spec:
            p4.client(name=<an existing client name>, delete=1)
        Returns a dictionary of the following form:
            {'client': <clientname>, 'action': 'deleted'}

        Getting a client spec:
            ch = p4.client(name=<an existing client name>)
        Returns a dictionary describing the client. For example:
            {'access': '2002/07/16 00:05:31',
             'client': 'trentm-ra',
             'description': 'Created by trentm.',
             'host': 'ra',
             'lineend': 'local',
             'options': 'noallwrite noclobber nocompress unlocked nomodtime normdir',
             'owner': 'trentm',
             'root': 'c:\\trentm\\',
             'update': '2002/03/18 22:33:18',
             'view': '//depot/... //trentm-ra/...'}

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}

        Limitations: The -f (force) and -t (template) flags are not
        supported. However, there is no strong need to support -t
        because the use of dictionaries in this API makes this trivial.
        """
        formfile = None
        try:
            action = None # note action to know how to parse output below
            if delete:
                action = "delete"
                if name is None:
                    raise P4LibError("Incomplete/missing arguments: must "\
                                     "specify 'name' of client to delete.")
                argv = ['client', '-d', name]
            elif client is None:
                action = "get"
                if name is None:
                    raise P4LibError("Incomplete/missing arguments: must "\
                                     "specify 'name' of client to get.")
                argv = ['client', '-o', name]
            else:
                action = "create/update"
                if client.has_key("client"):
                    name = client["client"]
                if name is not None:
                    cl = self.client(name=name)
                else:
                    cl = {}
                cl.update(client)
                form = makeForm(**cl)

                # Build submission form file.
                formfile = tempfile.mktemp()
                fout = open(formfile, 'w')
                fout.write(form)
                fout.close()
                argv = ['client', '-i', '<', formfile]

            output, error, retval = self._p4run(argv, **p4options)

            if action == 'get':
                rv = parseForm(output)
            elif action in ('create/update', 'delete'):
                # Example output:
                #   Client trentm-ra not changed. 
                #   Client bertha-test deleted.
                #   Client bertha-test saved.
                resultRe = re.compile("^Client (?P<client>[^\s@]+)"\
                    " (?P<action>not changed|deleted|saved)\.$")
                match = resultRe.match(output[0])
                if match:
                    rv = match.groupdict()
                else:
                    err = "Internal error: could not parse p4 client "\
                          "output: '%s'" % output[0]
                    raise P4LibError(err)
            else:
                raise P4LibError("Internal error: unexpected action: '%s'"\
                                 % action)

            if _raw:
                return rv, {'stdout': ''.join(output),
                            'stderr': ''.join(error),
                            'retval': retval}
            else:
                return rv
        finally:
            if formfile:
                os.remove(formfile)

    def clients(self, _raw=0, **p4options):
        """Return a list of clients.

        Returns a list of dicts, each representing one client spec, e.g.:
            [{'client': 'trentm-ra',        # client name
              'update': '2002/03/18',       # client last modification date
              'root': 'c:\\trentm\\',       # the client root directory
              'description': 'Created by trentm. '},
                                        # *part* of the client description
             ...
            ]

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        argv = ['clients']
        output, error, retval = self._p4run(argv, **p4options)

        # Examples:
        #   Client trentm-ra 2002/03/18 root c:\trentm\ 'Created by trentm. '
        clientRe = re.compile("^Client (?P<client>[^\s@]+) "\
                              "(?P<update>[\d/]+) "\
                              "root (?P<root>.*?) '(?P<description>.*?)'$")
        clients = []
        for line in output:
            match = clientRe.match(line)
            if match:
                client = match.groupdict()
                clients.append(client)
            else:
                raise P4LibError("Internal error: could not parse "\
                                 "'p4 clients' output line: '%s'" % line)

        if _raw:
            return clients, {'stdout': ''.join(output),
                             'stderr': ''.join(error),
                             'retval': retval}
        else:
            return clients

    def label(self, name=None, label=None, delete=0, _raw=0, **p4options):
        r"""Create, update, delete, or get a label specification.
        
        Creating a new label spec or updating an existing one:
            p4.label(label=<label dictionary>)
                          OR
            p4.label(name=<an existing label name>,
                     label=<label dictionary>)
        Returns a dictionary of the following form:
            {'label': <labelname>, 'action': <action taken>}

        Deleting a label spec:
            p4.label(name=<an existing label name>, delete=1)
        Returns a dictionary of the following form:
            {'label': <labelname>, 'action': 'deleted'}

        Getting a label spec:
            ch = p4.label(name=<an existing label name>)
        Returns a dictionary describing the label. For example:
            {'access': '2001/07/13 10:42:32',
             'description': 'ActivePerl 623',
             'label': 'ActivePerl_623',
             'options': 'locked',
             'owner': 'daves',
             'update': '2000/12/15 20:15:48',
             'view': '//depot/main/Apps/ActivePerl/...\n//depot/main/support/...'}

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}

        Limitations: The -f (force) and -t (template) flags are not
        supported. However, there is no strong need to support -t
        because the use of dictionaries in this API makes this trivial.
        """
        formfile = None
        try:
            action = None # note action to know how to parse output below
            if delete:
                action = "delete"
                if name is None:
                    raise P4LibError("Incomplete/missing arguments: must "\
                                     "specify 'name' of label to delete.")
                argv = ['label', '-d', name]
            elif label is None:
                action = "get"
                if name is None:
                    raise P4LibError("Incomplete/missing arguments: must "\
                                     "specify 'name' of label to get.")
                argv = ['label', '-o', name]
            else:
                action = "create/update"
                if label.has_key("label"):
                    name = label["label"]
                if name is not None:
                    lbl = self.label(name=name, **p4options)
                else:
                    lbl = {}
                lbl.update(label)
                form = makeForm(**lbl)

                # Build submission form file.
                formfile = tempfile.mktemp()
                fout = open(formfile, 'w')
                fout.write(form)
                fout.close()
                argv = ['label', '-i', '<', formfile]

            output, error, retval = self._p4run(argv, **p4options)

            if action == 'get':
                rv = parseForm(output)
            elif action in ('create/update', 'delete'):
                # Example output:
                #   Client trentm-ra not changed. 
                #   Client bertha-test deleted.
                #   Client bertha-test saved.
                resultRe = re.compile("^Label (?P<label>[^\s@]+)"\
                    " (?P<action>not changed|deleted|saved)\.$")
                match = resultRe.match(output[0])
                if match:
                    rv = match.groupdict()
                else:
                    err = "Internal error: could not parse p4 label "\
                          "output: '%s'" % output[0]
                    raise P4LibError(err)
            else:
                raise P4LibError("Internal error: unexpected action: '%s'"\
                                 % action)

            if _raw:
                return rv, {'stdout': ''.join(output),
                            'stderr': ''.join(error),
                            'retval': retval}
            else:
                return rv
        finally:
            if formfile:
                os.remove(formfile)

    def labels(self, _raw=0, **p4options):
        """Return a list of labels.

        Returns a list of dicts, each representing one labels spec, e.g.:
            [{'label': 'ActivePerl_623', # label name
              'description': 'ActivePerl 623 ',
                                         # *part* of the label description
              'update': '2000/12/15'},   # label last modification date
             ...
            ]

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        argv = ['labels']
        output, error, retval = self._p4run(argv, **p4options)

        labelRe = re.compile("^Label (?P<label>[^\s@]+) "\
                             "(?P<update>[\d/]+) "\
                             "'(?P<description>.*?)'$")
        labels = []
        for line in output:
            match = labelRe.match(line)
            if match:
                label = match.groupdict()
                labels.append(label)
            else:
                raise P4LibError("Internal error: could not parse "\
                                 "'p4 labels' output line: '%s'" % line)

        if _raw:
            return labels, {'stdout': ''.join(output),
                            'stderr': ''.join(error),
                            'retval': retval}
        else:
            return labels

    def flush(self, files=[], force=0, dryrun=0, _raw=0, **p4options):
        """Fake a 'sync' by not moving files.
        
        "files" is a list of files or file wildcards to flush. Defaults
            to the whole client view.
        "force" (-f) forces resynchronization even if the client already
            has the file, and clobbers writable files.
        "dryrun" (-n) causes sync to go through the motions and report
            results but not actually make any changes.

        Returns a list of dicts representing the flush'd files. For
        example:
            [{'comment': 'added as C:\\...\\foo.txt',
              'depotFile': '//depot/.../foo.txt',
              'notes': [],
              'rev': 1},
             {'comment': 'added as C:\\...\\bar.txt',
              'depotFile': '//depot/.../bar.txt',
              'notes': [],
              'rev': 1},
            ]

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        if type(files) in types.StringTypes:
            files = [files]
        optv = []
        if force:
            optv.append('-f')
        if dryrun:
            optv.append('-n')

        argv = ['flush'] + optv
        if files:
            argv += files
        output, error, retval = self._p4run(argv, **p4options)

        # Forms of output:
        #    //depot/foo#1 - updating C:\foo
        #    //depot/foo#1 - is opened and not being changed
        #    //depot/foo#1 - is opened at a later revision - not changed
        #    //depot/foo#1 - deleted as C:\foo
        #    ... //depot/foo - must resolve #2 before submitting
        # There are probably others forms.
        hits = []
        lineRe = re.compile('^(?P<depotFile>.+?)#(?P<rev>\d+) - '\
                            '(?P<comment>.+?)$')
        for line in output:
            if line.startswith('... '):
                note = line.split(' - ')[-1].strip()
                hits[-1]['notes'].append(note)
                continue
            match = lineRe.match(line)
            if match:
                hit = match.groupdict()
                hit['rev'] = int(hit['rev'])
                hit['notes'] = []
                hits.append(hit)
                continue
            raise P4LibError("Internal error: could not parse 'p4 flush'"\
                             "output line: '%s'" % line)

        if _raw:
            return hits, {'stdout': ''.join(output),
                          'stderr': ''.join(error),
                          'retval': retval}
        else:
            return hits

    def branch(self, name=None, branch=None, delete=0, _raw=0, **p4options):
        r"""Create, update, delete, or get a branch specification.
        
        Creating a new branch spec or updating an existing one:
            p4.branch(branch=<branch dictionary>)
                          OR
            p4.branch(name=<an existing branch name>,
                     branch=<branch dictionary>)
        Returns a dictionary of the following form:
            {'branch': <branchname>, 'action': <action taken>}

        Deleting a branch spec:
            p4.branch(name=<an existing branch name>, delete=1)
        Returns a dictionary of the following form:
            {'branch': <branchname>, 'action': 'deleted'}

        Getting a branch spec:
            ch = p4.branch(name=<an existing branch name>)
        Returns a dictionary describing the branch. For example:
            {'access': '2000/12/01 16:54:57',
             'branch': 'trentm-roundup',
             'description': 'Branch ...',
             'options': 'unlocked',
             'owner': 'trentm',
             'update': '2000/12/01 16:54:57',
             'view': '//depot/foo/... //depot/bar...'}

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}

        Limitations: The -f (force) and -t (template) flags are not
        supported. However, there is no strong need to support -t
        because the use of dictionaries in this API makes this trivial.
        """
        formfile = None
        try:
            action = None # note action to know how to parse output below
            if delete:
                action = "delete"
                if name is None:
                    raise P4LibError("Incomplete/missing arguments: must "\
                                     "specify 'name' of branch to delete.")
                argv = ['branch', '-d', name]
            elif branch is None:
                action = "get"
                if name is None:
                    raise P4LibError("Incomplete/missing arguments: must "\
                                     "specify 'name' of branch to get.")
                argv = ['branch', '-o', name]
            else:
                action = "create/update"
                if branch.has_key("branch"):
                    name = branch["branch"]
                if name is not None:
                    br = self.branch(name=name, **p4options)
                else:
                    br = {}
                br.update(branch)
                form = makeForm(**br)

                # Build submission form file.
                formfile = tempfile.mktemp()
                fout = open(formfile, 'w')
                fout.write(form)
                fout.close()
                argv = ['branch', '-i', '<', formfile]

            output, error, retval = self._p4run(argv, **p4options)

            if action == 'get':
                rv = parseForm(output)
            elif action in ('create/update', 'delete'):
                # Example output:
                #   Client trentm-ra not changed. 
                #   Client bertha-test deleted.
                #   Client bertha-test saved.
                resultRe = re.compile("^Branch (?P<branch>[^\s@]+)"\
                    " (?P<action>not changed|deleted|saved)\.$")
                match = resultRe.match(output[0])
                if match:
                    rv = match.groupdict()
                else:
                    err = "Internal error: could not parse p4 branch "\
                          "output: '%s'" % output[0]
                    raise P4LibError(err)
            else:
                raise P4LibError("Internal error: unexpected action: '%s'"\
                                 % action)

            if _raw:
                return rv, {'stdout': ''.join(output),
                            'stderr': ''.join(error),
                            'retval': retval}
            else:
                return rv
        finally:
            if formfile:
                os.remove(formfile)

    def branches(self, _raw=0, **p4options):
        """Return a list of branches.

        Returns a list of dicts, each representing one branches spec,
        e.g.:
            [{'branch': 'zope-aspn',
              'description': 'Contrib Zope into ASPN ',
              'update': '2001/10/15'},
             ...
            ]

        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        argv = ['branches']
        output, error, retval = self._p4run(argv, **p4options)

        branchRe = re.compile("^Branch (?P<branch>[^\s@]+) "\
                             "(?P<update>[\d/]+) "\
                             "'(?P<description>.*?)'$")
        branches = []
        for line in output:
            match = branchRe.match(line)
            if match:
                branch = match.groupdict()
                branches.append(branch)
            else:
                raise P4LibError("Internal error: could not parse "\
                                 "'p4 branches' output line: '%s'" % line)

        if _raw:
            return branches, {'stdout': ''.join(output),
                              'stderr': ''.join(error),
                              'retval': retval}
        else:
            return branches

    def fstat(self, files, limit_to_files_opened=False, _raw=0, **p4options):
        """List files in the depot.
        
        "files" is a list of files or file wildcards to list. Defaults
            to the whole client view.

        Returns a dict containing the following keys:

                clientFile      -- local path (host or Perforce syntax)
                depotFile       -- name in depot
                path            -- local path (host syntax)
                headAction      -- action at head rev, if in depot
                headChange      -- head rev changelist#, if in depot
                headRev         -- head rev #, if in depot
                headType        -- head rev type, if in depot
                headTime        -- head rev mod time, if in depot
                haveRev         -- rev had on client, if on client
                action          -- open action, if opened
                actionOwner     -- user who opened file, if opened
                change          -- open changelist#, if opened
                unresolved      -- unresolved integration records
                ourLock         -- set if this user/client has it locked

        Level 2 information is not returned at this time
        
                otherOpen       -- set if someone else has it open
                otherOpen#      -- list of user@client with file opened
                otherLock       -- set if someone else has it locked
                otherLock#      -- user@client with file locked
                otherAction#    -- open action, if opened by someone else

        See 'p4 help command fstat' for more information.
        
        If '_raw' is true then the a dictionary with the unprocessed
        results of calling p4 is returned in addition to the processed
        results:
            {'stdout': <stdout>, 'stderr': <stderr>, 'retval': <retval>}
        """
        _baseStat = {'clientFile':'',
                     'depotFile':'',
                     'path':'',
                     'headAction':'',
                     'headChange': 0,
                     'headRev': 0,
                     'headType':'',
                     'headTime': 0,
                     'haveRev': 0,
                     'action':'',
                     'actionOwner':'',
                     'change': '',
                     'unresolved':'',
                     'ourLock': 0,
                     }

        if type(files) in types.StringTypes:
            files = [files]
        if not files:
            raise P4LibError("Missing/wrong number of arguments.")

        argv = ['fstat','-C','-P']
        if limit_to_files_opened:
            argv.append("-Ro")
        argv += files
        output, error, retval = self._p4run(argv, **p4options)

        parsed = ''.join(output)
        parsed = re.split(r'(\r\n|\n){2}', parsed)
        
        hits = []
        fileRe = re.compile("...\s(.*?)\s(.*)")
        
        for stat in parsed:
            matches = fileRe.findall(stat)
            if not matches:
                continue
            hit = copy.copy(_baseStat)
            for m in matches:
                if m[0] == 'ourLock':
                    hit['ourLock'] = 1
                elif m[0] in ['headChange', 'headRev', 'headTime', 'haveRev']:
                    try:
                        hit[m[0]] = int(m[1])
                    except ValueError, e:
                        hit[m[0]] = m[1]
                else:
                    hit[m[0]] = m[1]
            hits.append(hit)

        if _raw:
            return hits, {'stdout': ''.join(output),
                          'stderr': ''.join(error),
                          'retval': retval}
        else:
            return hits

