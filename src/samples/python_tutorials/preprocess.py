#!/usr/bin/env python

"""
    Preprocess a file.

    Command Line Usage:
        preprocess [<options>...] <infile>

    Options:
        -h, --help      Print this help and exit.
        -v, --verbose   Give verbose output for errors.

        -o <outfile>    Write output to the given file instead of to stdout.
        -D <define>     Define a variable for preprocessing. <define>
                        can simply be a variable name (in which case it
                        will be true) or it can be of the form
                        <var>=<val>. An attempt will be made to convert
                        <val> to an integer so "-D FOO=0" will create a
                        false value.

    Module Usage:
        from preprocess import preprocess
        preprocess(infile, outfile=sys.stdout, defines={})

    The <infile> can be marked up with special preprocessor statement lines
    of the form:
        <comment-prefix> <preprocessor-stmt> <comment-suffix>
    where the <comment-prefix/suffix> are the native comment delimiters for
    that file type. Examples:
        <!-- #if FOO -->
        ...
        <!-- #endif -->
    
        # #if defined('FAV_COLOR') and FAV_COLOR == "blue"
        ...
        # #elif FAV_COLOR == "red"
        ...
        # #else
        ...
        # #endif

    Preprocessor Syntax:
        - Valid statements:
            #define <var>[=<value>]
            #undef <var>
            #if <expr>
            #elif <expr>
            #else
            #endif
            #error <error string>
          where <expr> is any valid Python expression.
        - The expression after #if/elif may be a Python statement. It is an
          error to refer to a variable that has not been defined by a -D
          option.
        - Special built-in methods for expressions:
            defined(varName)    Return true if given variable is defined.  
"""

import os
import sys
import getopt
import types
import re
import pprint
import logging

from contenttype import getContentType


#---- exceptions

class PreprocessError(Exception):
    def __init__(self, errmsg, file=None, lineno=None, line=None):
        self.errmsg = str(errmsg)
        self.file = file
        self.lineno = lineno
        self.line = line
        Exception.__init__(self, errmsg, file, lineno, line)
    def __str__(self):
        s = ""
        if self.file is not None:
            s += self.file + ":"
        if self.lineno is not None:
            s += str(self.lineno) + ":"
        if self.file is not None or self.lineno is not None:
            s += " "
        s += self.errmsg
        return s


#---- global data

log = logging.getLogger("preprocess")

# Comment delimiter info.
#   A mapping of content type to a list of 2-tuples defining the line
#   prefix and suffix for a comment.
_commentGroups = {
    "Python": [ ('#', '') ],
    "Perl": [ ('#', '') ],
    "Tcl": [ ('#', '') ],
    "XML": [ ('<!--', '-->') ],
    "HTML": [ ('<!--', '-->') ],
    "Makefile": [ ('#', '') ],
    "JavaScript": [ ('/*', '*/'), ('//', '') ],
    "CSS": [ ('/*', '*/') ],
    "C": [ ('/*', '*/') ],
    "C++": [ ('/*', '*/'), ('//', '') ],
    "IDL": [ ('/*', '*/'), ('//', '') ],
    "Text": [ ('#', '') ],
}


#---- internal support stuff

def _evaluate(expr, defines):
    """Evaluate the given expression string with the given context."""
    try:
        rv = eval(expr, {'defined':lambda v: v in defines}, defines)
    except Exception, ex:
        raise PreprocessError(str(ex), defines['__FILE__'], defines['__LINE__'])
    log.debug("evaluate %r -> %s (defines=%r)", expr, rv, defines)
    return rv



#---- module API

def preprocess(infile, outfile=sys.stdout, defines={}):
    """Preprocess the given file.

    "infile" is the input filename.
    "outfile" is the output filename or stream (default is sys.stdout).
    "defines" is a dictionary of defined variables that will be
        understood in preprocessor statements. Keys must be strings and,
        currently, only the truth value of any key's value matters.

    Returns the modified dictionary of defines or raises PreprocessError if
    there was some problem.
    """
    log.info("preprocess(infile=%r, outfile=%r, defines=%r)",
             infile, outfile, defines)

    # Determine the content type and comment info for the input file.
    contentType = getContentType(infile)
    if contentType is None:
        contentType = "Text"
        log.warn("defaulting content type for '%s' to '%s'",
                 infile, contentType)
    try:
        cgs = _commentGroups[contentType]
    except KeyError:
        raise PreprocessError("don't know comment delimiters for content "\
                              "type '%s' (file '%s')"\
                              % (contentType, infile))

    # Generate statement parsing regexes.
    stmts = ['#\s*(?P<op>if|elif|ifdef|ifndef)\s+(?P<expr>.*?)',
             '#\s*(?P<op>else|endif)',
             '#\s*(?P<op>error)\s+(?P<error>.*?)',
             '#\s*(?P<op>define)\s+(?P<var>[^\s]*?)(\s+(?P<val>.+?))?',
             '#\s*(?P<op>undef)\s+(?P<var>[^\s]*?)']
    patterns = ['^\s*%s\s*%s\s*%s\s*$'
                % (re.escape(cg[0]), stmt, re.escape(cg[1]))
                for cg in cgs for stmt in stmts]
    stmtRes = [re.compile(p) for p in patterns]

    # Process the input file.
    fin = open(infile, 'r')
    if type(outfile) in types.StringTypes:
        if os.path.exists(outfile):
            os.chmod(outfile, 0777)
            os.remove(outfile)
        fout = open(outfile, 'w')
    else:
        fout = outfile

    defines['__FILE__'] = infile
    SKIP, EMIT = range(2) # states
    states = [(EMIT,   # a state is (<emit-or-skip-lines-in-this-section>,
               0,      #             <have-emitted-in-this-if-block>,
               0)]     #             <have-seen-'else'-in-this-if-block>)
    lineNum = 0
    for line in fin.readlines():
        lineNum += 1
        log.debug("line %d: %r", lineNum, line)
        defines['__LINE__'] = lineNum

        # Is this line a preprocessor stmt line?
        for stmtRe in stmtRes:
            match = stmtRe.match(line)
            if match:
                break
        else:
            match = None

        if match:
            op = match.group("op")
            log.debug("%r stmt (states: %r)", op, states)
            if op == "define":
                if states and states[-1][0] == SKIP: continue
                var, val = match.group("var", "val")
                if val is None:
                    val = None
                else:
                    try:
                        val = eval(val, {}, {})
                    except:
                        pass
                defines[var] = val
            elif op == "undef":
                if states and states[-1][0] == SKIP: continue
                var = match.group("var")
                try:
                    del defines[var]
                except KeyError:
                    pass
            elif op in ("if", "ifdef", "ifndef"):
                if op == "if":
                    expr = match.group("expr")
                elif op == "ifdef":
                    expr = "defined('%s')" % match.group("expr")
                elif op == "ifndef":
                    expr = "not defined('%s')" % match.group("expr")
                try:
                    if states and states[-1][0] == SKIP:
                        # Were are nested in a SKIP-portion of an if-block.
                        states.append((SKIP, 0, 0))
                    elif _evaluate(expr, defines):
                        states.append((EMIT, 1, 0))
                    else:
                        states.append((SKIP, 0, 0))
                except KeyError:
                    raise PreprocessError("use of undefined variable in "\
                                          "#%s stmt" % op, defines['__FILE__'],
                                          defines['__LINE__'], line)
            elif op == "elif":
                expr = match.group("expr")
                try:
                    if states[-1][2]: # already had #else in this if-block
                        raise PreprocessError("illegal #elif after #else in "\
                            "same #if block", defines['__FILE__'],
                            defines['__LINE__'], line)
                    elif states[-1][1]: # if have emitted in this if-block
                        states[-1] = (SKIP, 1, 0)
                    elif states[:-1] and states[-2][0] == SKIP:
                        # Were are nested in a SKIP-portion of an if-block.
                        states[-1] = (SKIP, 0, 0)
                    elif _evaluate(expr, defines):
                        states[-1] = (EMIT, 1, 0)
                    else:
                        states[-1] = (SKIP, 0, 0)
                except IndexError:
                    raise PreprocessError("#elif stmt without leading #if "\
                                          "stmt", defines['__FILE__'],
                                          defines['__LINE__'], line)
            elif op == "else":
                try:
                    if states[-1][2]: # already had #else in this if-block
                        raise PreprocessError("illegal #else after #else in "\
                            "same #if block", defines['__FILE__'],
                            defines['__LINE__'], line)
                    elif states[-1][1]: # if have emitted in this if-block
                        states[-1] = (SKIP, 1, 1)
                    elif states[:-1] and states[-2][0] == SKIP:
                        # Were are nested in a SKIP-portion of an if-block.
                        states[-1] = (SKIP, 0, 1)
                    else:
                        states[-1] = (EMIT, 1, 1)
                except IndexError:
                    raise PreprocessError("#else stmt without leading #if "\
                                          "stmt", defines['__FILE__'],
                                          defines['__LINE__'], line)
            elif op == "endif":
                try:
                    states.pop()
                except IndexError:
                    raise PreprocessError("#endif stmt without leading #if"\
                                          "stmt", defines['__FILE__'],
                                          defines['__LINE__'], line)
            elif op == "error":
                if states and states[-1][0] == SKIP: continue
                error = match.group("error")
                raise PreprocessError("#error: "+error, defines['__FILE__'],
                                      defines['__LINE__'], line)
            log.debug("states: %r", states)
        else:
            try:
                if states[-1][0] == EMIT:
                    log.debug("emit line (%s)" % states[-1][1])
                    fout.write(line)
                else:
                    log.debug("skip line (%s)" % states[-1][1])
            except IndexError:
                raise PreprocessError("superfluous #endif before this line",
                                      defines['__FILE__'],
                                      defines['__LINE__'])
    if len(states) > 1:
        raise PreprocessError("unterminated #if block", defines['__FILE__'],
                              defines['__LINE__'])
    elif len(states) < 1:
        raise PreprocessError("superfluous #endif on or before this line",
                              defines['__FILE__'], defines['__LINE__'])

    if fout != outfile:
        fout.close()


#---- mainline

def main(argv):
    try:
        optlist, args = getopt.getopt(argv[1:], 'hvo:D:', ['help', 'verbose'])
    except getopt.GetoptError, msg:
        sys.stderr.write("preprocess: error: %s" % msg)
        sys.stderr.write("See 'preprocess --help'.\n")
        return 1
    outfile = sys.stdout
    defines = {}
    for opt, optarg in optlist:
        if opt in ('-h', '--help'):
            sys.stdout.write(__doc__)
            return 0
        elif opt in ('-v', '--verbose'):
            log.setLevel(logging.DEBUG)
        elif opt == '-o':
            outfile = optarg
        elif opt == '-D':
            if optarg.find('=') != -1:
                var, val = optarg.split('=', 1)
                try:
                    val = eval(val, {}, {})
                except:
                    pass
            else:
                var, val = optarg, None
            defines[var] = val

    if len(args) != 1:
        sys.stderr.write("preprocess: error: incorrect number of "\
                         "arguments: argv=%r\n" % argv)
        return 1
    else:
        infile = args[0]

    try:
        preprocess(infile, outfile, defines)
    except PreprocessError, ex:
        sys.stderr.write("preprocess: error: %s\n" % str(ex))

if __name__ == "__main__":
    sys.exit( main(sys.argv) )

