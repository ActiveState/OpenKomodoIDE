#!/usr/bin/env python

"""
    An OO interface to 'svn' (the Subversion client command line app).  Based on
    Subversion version 1.0.6.

    Usage:
        import svnlib
        svn = svnlib.SVN(<svnoptions>)
        result = svn.<command>(<svnoptions>)

    For more information see the doc string on each command. For example:
        print svnlib.SVN.opened.__doc__
    
    Arguments to all functions match the arguments of the command as retrieved with:
    
        'svn help command'
        
    but they need to be converted as in the following example:
    
        --force-log becomes force_log
        --auto-props becomes auto_props
    
    If the argument takes no additional information, it is a boolean argument in the function.  Some
    functions (those that take multiple paths such as commit) will have additional parameters:
    
        SVN.commit([file1.txt, ...], username='test', password='test', force_log=1)
        
    Only the long argument names are supported.
    
    Available subcommands:
       add
       checkout (co)
       cleanup
       commit (ci)
       copy (cp)
       delete (del, remove, rm)
       diff (di)
       import (see importToRepository)
       info
       resolved
       revert
       status (stat, st)
       update (up)
       
    Not Implemented:
       blame (praise, annotate, ann)
       cat
       export
       help (?, h)
       list (ls)
       log
       merge
       mkdir
       move (mv, rename, ren)
       propdel (pdel, pd)
       propedit (pedit, pe)
       propget (pget, pg)
       proplist (plist, pl)
       propset (pset, ps)
       switch (sw)
"""

import os
import sys
import re
import types
import copy
import logging

import process
import koprocessutils
from svnlib import (SVN, SVNLibError, actionNames, _escapeArg,
                    makeOptv, _parseHits, _parseKeyList)
import svnlib
#---- global data

_version_ = (0, 1, 0)

log = logging.getLogger('svnremotelib')
#log.setLevel(logging.DEBUG)

#---- overriden functions from svnlib

def _joinArgv(argv):
    r"""Join an arglist to a string appropriate for running.
        >>> import os
        >>> _joinArgv(['foo', 'bar "baz'])
        'foo "bar \\"baz"'
    """
    cmdstr = ""
    specialChars = [';', ' ', '=']
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

def _getValidOpts(valid, **options):
    valid.append("remote")
    #print "getValidOpts: %r" % (valid, )
    #print options
    newopts = {}
    for key, val in options.items():
        if key in valid:
            newopts[key] = val
    return newopts
# Overriding svnlib's getValidOpts, not a good thing, but no alternative
# without having to change svnlib.py
svnlib.getValidOpts = _getValidOpts

def _run(argv, cwd=None, env=None, input=None, remote=0):
    """Prepare and run the given arg vector, 'argv', and return the
    results.  Returns (<stdout lines>, <stderr lines>, <return value>).
    Note: 'argv' may also just be the command string.
    """
    try:
        if type(argv) in (types.ListType, types.TupleType):
            cmd = _joinArgv(argv)
        else:
            cmd = argv
        output = None
        if not env:
            env = koprocessutils.getUserEnv()
    
        # Komodo can only handle svn messages in english.
        # http://bugs.activestate.com/show_bug.cgi?id=45677
        env['LC_MESSAGES'] = 'en_US'
        # Set LANGUAGE too, otherwise it may still come back in another lang
        # http://bugs.activestate.com/show_bug.cgi?id=68615
        env['LANGUAGE'] = 'en_US'
    
        if not remote:
            print "\nNo remote information provided: %r\n" % (cmd, )
            return [''], [''], -1
    
        cmd = "cd %s && %s" % (cwd, cmd, )
        if type(remote) == types.InstanceType:
            # remote should be an instance of koISSHConnection
            log.debug("koISSH.runCommand: %r", cmd)
            retval, output, error = remote.runCommand(cmd, False)
            return output.splitlines(1), error.splitlines(1), retval
    
        # Change directory and then perform the scc command using the
        # remote ssh command provided.
        cmd = '%s "%s"' % (remote, cmd, )
        log.debug("Running command: %r", cmd)
        cwd = None
    
        p = process.ProcessOpen(cmd=cmd, cwd=cwd, env=env)
        output, error = p.communicate(input)
        output = output.splitlines(1)
        error = error.splitlines(1)
        retval = p.returncode
        if not sys.platform.startswith("win"):
            if os.WIFEXITED(retval):
                retval = os.WEXITSTATUS(retval)
            else:
                raise SVNLibError("Error running '%s', it did not exit "\
                                 "properly: retval=%d" % (cmd, retval))
    
        # XXX TODO
        # svn will return valid results, and an error result in the same
        # call.  We need to use lasterrorsvc, or something similar to catch
        # the errors, but allow the valid results to be used.
        #if retval:
        #    raise SVNLibError("Error %s running '%s' in '%s': \n%s"\
        #                     % (retval,cmd, cwd,''.join(error), ))
        return output, error, retval
    except Exception, e:
        log.exception(e)
        raise

class SVNRemote(SVN):
    """A proxy to the Subversion client app 'svn'."""
    def __init__(self, svn='svn', **options):
        """Create a 'svn' proxy object.

        "svn" is the Subversion client to execute commands with. Defaults
            to 'svn'.
            
        You can set any SVN supported argument in the init, and they will
        be used in all SVN calls.  This can be very usefull for some arguments,
        and detrimental in others.
        
        For more information about supported arguments see:
        http://svnbook.red-bean.com/en/1.0/ch09.html#svn-ch-9-sect-1.1
        
        Optional keyword arguments:
            "cwd" is a special option to have the underlying process
                spawner use this as the cwd.
        """
        SVN.__init__(self, svn, **options)

    def _svnrun(self, argv, env=None, input=None, **svnoptions):
        """Run the given svn command.
        
        The current instance's svn and svn options (optionally overriden by
        **svnoptions) are used. The 3-tuple (<output>, <error>, <retval>) is
        returned.
        """
        cwd = None
        isRemote = 0
        if svnoptions:
            import copy
            d = copy.copy(self.optd)
            d.update(svnoptions)
            if "remote" in d:
                isRemote = d["remote"]
                del d["remote"]
            if 'cwd' in d:
                cwd = d['cwd']
                del d['cwd']
            svnoptv = makeOptv(**d)
        else:
            svnoptv = self._optv
        if not env and 'env' in svnoptv:
            env = svnoptv['env']
            del svnoptv['env']
        argv = [self.svn] + svnoptv + argv
        return _run(argv, cwd, env, input, isRemote)
