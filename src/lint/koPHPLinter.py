#!python
# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

from xpcom import components, nsError, COMException
from xpcom._xpcom import PROXY_SYNC, PROXY_ALWAYS, PROXY_ASYNC
from xpcom.server import UnwrapObject
from koLintResult import *
from koLintResults import koLintResults
import os, sys, re
import logging
import tempfile
import string
import process
import koprocessutils

log = logging.getLogger("koPHPLinter")
#log.setLevel(logging.DEBUG)

# PHP error line format
# \nPHP ERROR NAME: error text in filename.php on line ##\n
# requires php.ini settings
#      display_errors	      = On
#      display_startup_errors = On
# php.ini must reside in os directory (c:\winnt)

class KoPHPCompileLinter:
    _com_interfaces_ = [components.interfaces.koILinter]
    _reg_desc_ = "Komodo PHP Linter"
    _reg_clsid_ = "{F6F8507C-21B0-4047-9E78-A648949B118F}"
    _reg_contractid_ = "@activestate.com/koLinter?language=PHP;1"
    _reg_categories_ = [
         ("category-komodo-linter", 'PHP'),
         ]

    def __init__(self):
        try:
            self.phpInfoEx = components.classes["@activestate.com/koAppInfoEx?app=PHP;1"].\
                             getService(components.interfaces.koIPHPInfoEx)
            self._koLintService = components.classes["@activestate.com/koLintService;1"].getService(components.interfaces.koILintService)
        except:
            log.exception("Problem getting phpInfoEx")
            raise
    
    # linting versions are different than what is required for xdebug
    # debugging, so we have our own version checking
    _checkValidVersion_complained = {}
    def checkValidVersion(self):
        try:
            version = self.phpInfoEx.version
        except:
            if "version" not in self._checkValidVersion_complained:
                self._checkValidVersion_complained["version"] = True
                log.error("Error getting phpInfoEx.version.  Is a PHP interpreter defined?")
            return False
        if not version:
            # Allow for None or empty string
            reject = True
        else:
            # last point can be something like 10-beta
            version = tuple([int(x) for x in re.match(r"(\d+)\.(\d+)\.(\d+)", version).groups()])
            reject = (version < (4,0,5))
        if reject and "checkValidVersion" not in self._checkValidVersion_complained:
            self._checkValidVersion_complained["checkValidVersion"] = True
            errmsg = "Could not find a suitable PHP interpreter for "\
                     "linting, need 4.0.5 or later."
            log.error("koPHPLinter.py: checkValidVersion: %s", errmsg)
        return not reject
        
    _tplPatterns = ("PHP", re.compile('<\?(?:php\s+echo\b[^_]|=)', re.IGNORECASE|re.DOTALL), re.compile(r'\?>\s*\Z', re.DOTALL))
    def lint(self, request):
        try:
            html_linter = UnwrapObject(self._koLintService.getLinterForLanguage("HTML"))
            return html_linter.lint(request, TPLInfo=self._tplPatterns)
        except:
            if "lint" not in self._checkValidVersion_complained:
                self._checkValidVersion_complained["lint"] = True
                log.exception("Problem in koPHPLinter.lint")
            return koLintResults()
    
    def lint_with_text(self, request, text):
        """Lint the given PHP content.
        
        Raise an exception if there is a problem.
        """
        cwd = request.cwd
        
        #print "----------------------------"
        #print "PHP Lint"
        #print text
        #print "----------------------------"
        php = self.phpInfoEx.getExecutableFromPrefs(request.prefset)
        if php is None:
            errmsg = "Could not find a suitable PHP interpreter for linting."
            log.exception(errmsg)
            raise COMException(nsError.NS_ERROR_NOT_AVAILABLE, errmsg)

        if not self.checkValidVersion():
            return None

        # save php buffer to a temporary file
        phpfilename = tempfile.mktemp()
        fout = open(phpfilename, 'wb')
        fout.write(text)
        fout.close()

        p = None
        try:
            argv = [php, '-n', '-d', 'display_errors=1',
                    '-d', 'display_startup_errors=1',
                    '-d', 'output_buffering=0',
                    '-d', 'xdebug.remote_enable=off',
                    '-d', 'error_reporting=2047',
                    '-q', '-l', phpfilename]
            env = koprocessutils.getUserEnv()
            cwd = cwd or None
            p = process.ProcessOpen(argv, cwd=cwd, env=env)
            stdout, stderr = p.communicate()
            # The relevant output is contained in stdout.
            lines = stdout.splitlines(1)
        finally:
            os.unlink(phpfilename)
        
        results = koLintResults()
        if lines:
            datalines = re.split('\r\n|\r|\n',text)
            numLines = len(datalines)
            lines = [l for l in lines if l.find('error') != -1]
            
            for line in lines:
                #print line
                line = line.strip()
                # remove html from error output
                line = re.sub('<.*?>',"",line)
                lineText = line.rfind(' ')
                try:
                    lineNo = int(line[lineText+1:])
                except ValueError, e:
                    continue
                #print "Line Number: ", lineNo
                result = KoLintResult()
                # XXX error in FILENAME at line XXX
                # Previous fix (change  done for bug 42553 -- (change 254015)
                # This fix allows for either "at" or "on" between the
                # filename and the line #
                # Sample error message:
                # PHP Fatal error:  Can't use function return value in write context in C:\home\ericp\lab\komodo\bugs\bz42553a.php on line 3
                m = re.match(r'(.*?)\bin .*?(\b(?:on|at)\s+line\s+\d+)', line)
                if m:
                    result.description = string.join(m.groups())
                else:
                    result.description = line
                result.lineStart = result.lineEnd = lineNo
                result.columnStart = 1
                result.columnEnd = len(datalines[result.lineEnd-1]) + 1
                result.severity = result.SEV_ERROR
                results.addResult(result)
        #print "----------------------------"
        return results

