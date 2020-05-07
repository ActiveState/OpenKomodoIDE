#!python
# Copyright (c) 2000-2011 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

# Komodo epMojo language service.

import logging
import os, sys, re
from os.path import join, dirname, exists
import tempfile
import process
import koprocessutils

from xpcom import components, nsError, ServerException
from xpcom.server import UnwrapObject, WrapObject

from koXMLLanguageBase import koHTMLLanguageBase

from koLintResult import KoLintResult
from koLintResults import koLintResults

import scimozindent

log = logging.getLogger("koEpMojoLanguage")
#log.setLevel(logging.DEBUG)

def registerLanguage(registry):
    log.debug("Registering language epMojo")
    registry.registerLanguage(koEpMojoLanguage())

class koEpMojoLanguage(koHTMLLanguageBase):
    name = "epMojo"
    lexresLangName = "epMojo"
    _reg_desc_ = "%s Language" % name
    _reg_contractid_ = "@activestate.com/koLanguage?language=%s;1" % name
    _reg_clsid_ = "{ec34f812-d8c3-4b55-96b5-0601e659208a}"
    _reg_categories_ = [("komodo-language", name)]
    defaultExtension = '.ep'
    searchURL = "http://mojolicio.us/perldoc"

    lang_from_udl_family = {'CSL': 'JavaScript', 'TPL': 'epMojo', 'M': 'HTML', 'CSS': 'CSS', 'SSL': 'Perl'}

    sample = """
<!doctype html><html>
  <head><title>Simple</title></head>
  <body>Time: <%= localtime(time) %></body>
</html>
% Perl line
Inline perl:   <% Inline Perl %>, and continue...
<a href="<%= $css . "?q=$action" %>">where do you want to go?</a>
%= Perl expression line, replaced with result
%== Perl expression line, replaced with XML escaped result
%# Comment line, useful for debugging
<% my $block = begin %>
<% my $name = shift; =%>
    Hello <%= $name %>.
<% end %>
<%= $block->('Baerbel') %>
<%= $block->('Wolfgang') %>
"""

    def __init__(self):
        koHTMLLanguageBase.__init__(self)
        self.matchingSoftChars["`"] = ("`", self.softchar_accept_matching_backquote)
        self._style_info.update(
            _indent_styles = [components.interfaces.ISciMoz.SCE_UDL_TPL_OPERATOR]
            )
        self._indent_chars = u'{}'
        self._indent_open_chars = u'{'
        self._indent_close_chars = u'}'

class KoEpMojoLinter(object):
    _com_interfaces_ = [components.interfaces.koILinter]
    _reg_desc_ = "epMojo Template Linter"
    _reg_clsid_ = "{3b69f94f-4fb6-47bb-a387-9d3ac372195a}"
    _reg_contractid_ = "@activestate.com/koLinter?language=epMojo;1"
    _reg_categories_ = [
        ("category-komodo-linter", 'epMojo'),
    ]


    def __init__(self):
        self._koLintService = components.classes["@activestate.com/koLintService;1"].getService(components.interfaces.koILintService)
        self._html_linter = UnwrapObject(self._koLintService.getLinterForLanguage("HTML"))

    _tplPatterns = ("epMojo", re.compile('<%='), re.compile(r'%>\s*\Z', re.DOTALL))
    def lint(self, request):
        return self._html_linter.lint(request, TPLInfo=self._tplPatterns)

    def lint_with_text(self, request, text):
        # With revised html_linter template processing, the html linter will
        # pull out Perl parts and dispatch them to the perl linter, so there's
        # nothing to do here.
        return None
