#!python
# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
import sys
import json
import logging
import tempfile
import re

from xpcom import components

import URIlib
import process
import koprocessutils
from zope.cachedescriptors.property import LazyClassAttribute
from koLintResult import KoLintResult
from koLintResults import koLintResults

log = logging.getLogger("koCSSLinter")


class KoCSSLinter:
    _com_interfaces_ = [components.interfaces.koILinter]
    _reg_desc_ = "Komodo Mozilla CSS Linter"
    _reg_clsid_ = "{F770CBE7-2AAF-492C-8900-CC512CAF5046}"
    _reg_contractid_ = "@activestate.com/koLinter?language=CSS&type=Mozilla;1"
    _reg_categories_ = [
         ("category-komodo-linter", 'CSS&type=Mozilla'),
         ]
    lint_prefname = "lint_css_mozilla_parser_enabled"

    # Lazily generated class properties.
    @LazyClassAttribute
    def koDirs(self):
        return components.classes["@activestate.com/koDirs;1"].\
                getService(components.interfaces.koIDirs)
    @LazyClassAttribute
    def mozBinDir(self):
        return self.koDirs.mozBinDir
    @LazyClassAttribute
    def csslint_filepath(self):
        return os.path.join(self.koDirs.supportDir, "lint", "css",
                            "xpcshell_csslint.js")
    @LazyClassAttribute
    def xpcshell_exe(self):
        if sys.platform.startswith("win"):
            return os.path.join(self.mozBinDir, "xpcshell.exe")
        return os.path.join(self.mozBinDir, "xpcshell")

    def _setEnv(self):
        env = koprocessutils.getUserEnv()
        ldLibPath = env.get("LD_LIBRARY_PATH", None)
        if ldLibPath:
            env["LD_LIBRARY_PATH"] = self.mozBinDir + ":" + ldLibPath
        else:
            env["LD_LIBRARY_PATH"] = self.mozBinDir
        env['PYTHONPATH'] = os.pathsep.join(sys.path)
        return env

    def lint(self, request):
        """Lint the given CSS content.
        
        Raise an exception  if there is a problem.
        """
        text = request.content.encode(request.encoding.python_encoding_name)
        return self.lint_with_text(request, text)

    def lint_with_text(self, request, text):
        if not text:
            return None
        if not request.prefset.getBoolean(self.lint_prefname, True):
            return None

        # Save buffer to a temporary file and parse it.
        cwd = request.cwd or None
        fn = tempfile.mktemp()
        try:
            file(fn, 'wb').write(text)
            return self.parse(fn, cwd=cwd, text=text)
        except Exception, e:
            log.exception(e)
        finally:
            os.unlink(fn)

    def parse(self, filepath, cwd=None, text=None):
        results = koLintResults()

        entries = []
        cmd = [self.xpcshell_exe, self.csslint_filepath, filepath]
        stdout = None

        # We only need the stdout result.
        try:
            p = process.ProcessOpen(cmd, cwd=cwd, env=self._setEnv(),
                                    stdin=None)
            stdout, stderr = p.communicate()
            entries = json.loads(stdout or "[]")
        except:
            log.exception("Problem running xcshell: %r\n,output:%r\n", cmd, stdout)
            return results
            
        lines = text.split('\n')

        for entry in entries:
            # Convert to Komodo lint result object.
            #print 'entry: %r' % (entry, )
            line_start = entry.get('lineStart', 0)
            column_start = entry.get('columnStart', 0)
            column_end = entry.get('columnEnd', 0)
            if column_start + 1 == column_end:
                word = re.search('\\w+$', lines[line_start - 1][0:column_end - 1])
                if word:
                    column_start = word.start() + 1
            results.addResult(KoLintResult(description=entry.get('description', ''),
                                           severity=entry.get('severity', 1),
                                           lineStart=line_start,
                                           lineEnd=entry.get('lineEnd', -1),
                                           columnStart=column_start,
                                           columnEnd=column_end))

        return results

