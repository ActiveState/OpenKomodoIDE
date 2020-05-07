# Copyright (c) 2000-2008 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import os
import sys
import logging

from xpcom import components, nsError, ServerException, COMException

import process
import which
import koprocessutils
import uriparse

log = logging.getLogger('koGenericFormatter')
#log.setLevel(logging.DEBUG)

class FormatterException(Exception):
    pass

class koGenericFormatter(object):
    name = "generic"
    prettyName = "Generic command-line formatter"
    supported_languages = ["*"]

    _com_interfaces_ = [components.interfaces.koIFormatter]
    _reg_desc_ = "Komodo Generic Formatter"
    _reg_contractid_ = "@activestate.com/koFormatter?name=%s;1" % (name, )
    _reg_clsid_ = "{97942ca8-82f5-49ce-9ee5-591b0af32987}"
    _reg_categories_ = [
         ("category-komodo-formatter",      name),
         ]

    _prefName = "genericFormatterPrefs"

    def __init__(self):
        log.debug("Creating generic formatter instance")
        pass

    def getSupportedLanguages(self):
        return self.supported_languages

    def supportsLanguage(self, lang):
        # This formatter supports everything.
        return True

    def format(self, context):
        executable_path = None
        arguments = None
        env = koprocessutils.getUserEnv()
        if context.formatter_prefset.hasPref(self._prefName):
            prefs = context.formatter_prefset.getPref(self._prefName)
            if prefs.hasStringPref("executable"):
                executable_path = prefs.getStringPref("executable")
            if prefs.hasStringPref("arguments"):
                arguments = prefs.getStringPref("arguments")
        if not executable_path:
            raise ServerException(nsError.NS_ERROR_FAILURE,
                                  "The formatter is not yet configured for '%s'." % (context.lang, ))

        interpolation_items = [executable_path]
        if arguments:
            interpolation_items.append(arguments)

        projectFilepath = ""
        partSvc = components.classes["@activestate.com/koPartService;1"].\
                getService(components.interfaces.koIPartService)
        currentProject = partSvc.currentProject
        if currentProject:
            projectFilepath = currentProject.getFile().path
        iSvc = components.classes["@activestate.com/koInterpolationService;1"].\
                getService(components.interfaces.koIInterpolationService)
        cwd = None
        try:
            path = uriparse.URIToLocalPath(context.uri)
            cwd = os.path.dirname(path)
        except ValueError:
            # URI is probably remote.
            path = context.uri
        queries, istrings = iSvc.Interpolate1(interpolation_items,
                                              [], # bracketed strings
                                              path, 0,  # file + line
                                              "", "", # word, selection,
                                              projectFilepath,
                                              context.prefset, "" #current line
                                             )
        # Interpolate1 will return with doubled arguments, we only want the
        # first item from each double.
        interpolation_items = istrings[::2]
        executable_path = os.path.normpath(os.path.expanduser(interpolation_items[0]))
        if not os.path.exists(executable_path):
            # See if it's available on the path then:
            userPath = env["PATH"].split(os.pathsep)
            try:
                executable_path = which.which(executable_path, path=userPath)
            except which.WhichError:
                log.debug("command executable does not exist: %r", executable_path)
                raise ServerException(nsError.NS_ERROR_FAILURE,
                                      "Could not locate the formatter executable: '%s'" % (executable_path, ))

        # Quote the executable, in case their are spaces or specials chars.
        interpolation_items[0] = '"%s"' % (executable_path.replace('"', '\\"'), )

        # Keep the executable and arguments as the one string, let subprocess
        # deal with the quoting. This allows the formatter arguments to already
        # use quoted strings, see:
        # http://bugs.activestate.com/show_bug.cgi?id=80371
        cmd = " ".join(interpolation_items)
        log.debug("command: %r", cmd)
        p = process.ProcessOpen(cmd, cwd=cwd, env=env)

        # Encode the input using the context's encoding, bug 82615.
        encoding = context.encoding or sys.getfilesystemencoding()
        text = context.text.encode(encoding)
        stdout, stderr = p.communicate(text)
        if p.retval != 0 and not stdout:
            # Best we can do until we have specific preferences for retval
            # handling.
            raise ServerException(nsError.NS_ERROR_FAILURE,
                                  "Format error: '%s'" % (stderr, ))
        # Convert back to Unicode using the original encoding.
        context.text = stdout.decode(encoding)
