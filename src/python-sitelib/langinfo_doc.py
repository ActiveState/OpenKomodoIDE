# Copyright (c) 2007 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""LangInfo definitions for some document languages."""

import re
from langinfo import LangInfo
import logging
log = logging.getLogger("laninfo_doc")

class XMLLangInfo(LangInfo):
    name = "XML"
    conforms_to_bases = ["Text"]
    exts = ['.xml']
    default_encoding = "utf-8"
    magic_numbers = [
        (0, "string", "<?xml"),
    ]

    """
    The xml parser is very "dumb" because lets face it, this is only Regex.
    Limitations:

     - Does not consider commented out code
     - Assumes double quotes for attribute values
     - Does not handle escaped quotes
    """

    section_regexes = [
        ("node", re.compile(r'''
                [^\n].*?[ \t]*              # Start of line
                \<([\w\:-]+)                     # Node name
                ((?:\s+[\w-]+="[\w\s\.-]+")+) # Attributes
            ''', re.M | re.X)),
    ]

    def section_hit_title_processor(self, type, rematch, title):
        if type == "node":
            attributes = rematch.group(2)
            attrs = {}

            if not attributes:
                return False

            attributes = attributes.split('"')
            key = None

            for attr in attributes:
                if not attr:
                    break

                if not key:
                    key = attr.lower().strip()[0:-1]
                else:
                    attrs[key] = attr.strip()
                    key = None

            keys = ["id", "name", "anonid"]
            for key in keys:
                if key in attrs:
                    return "%s (%s=%s)" % (title, key, attrs[key])

            return False


        return title

class HTMLLangInfo(XMLLangInfo):
    name = "HTML"
    conforms_to_bases = ["Text"]
    exts = ['.html', '.htm']
    magic_numbers = [
        (0, "string", "<!DOCTYPE html "),
        (0, "string", "<html"),
    ]
    # The default encoding is iso-8859-1 or utf-8 depending on the
    # Content-Type (provided by an HTTP header or defined in a <meta>
    # tag). See here for a good summary:
    #   http://feedparser.org/docs/character-encoding.html#advanced.encoding.intro
    # We'll just use UTF-8. Safer. It is the future.
    default_encoding = "utf-8"
    doctypes = [
        # <flavour>, <common-name>, <public-id>, <system-id>
        ("HTML 4.01 Strict", "HTML",
         "-//W3C//DTD HTML 4.01//EN",
         "http://www.w3.org/TR/html4/strict.dtd"),
        ("HTML 4.01 Transitional", "HTML",
         "-//W3C//DTD HTML 4.01 Transitional//EN",
         "http://www.w3.org/TR/html4/loose.dtd"),
        ("HTML 4.01 Frameset", "HTML",
         "-//W3C//DTD HTML 4.01 Frameset//EN",
         "http://www.w3.org/TR/html4/frameset.dtd"),
        ("HTML 3.2", "HTML",
         "-//W3C//DTD HTML 3.2 Final//EN", None),
        ("HTML 2.0", "HTML",
         "-//IETF//DTD HTML//EN", None),
    ]

class HTML5LangInfo(HTMLLangInfo):
    name = "HTML5"
    magic_numbers = [
        (0, "string", "<!DOCTYPE html>"),
    ]
    _magic_number_precedence = ('HTML', -1)
    doctypes = [
        # <flavour>, <common-name>, <public-id>, <system-id>
        ("HTML 5", "HTML5",
         "-//W3C//DTD HTML 5//EN",
         "http://www.w3.org/TR/html5/html5.dtd"),
    ]

class AngularJSLangInfo(HTMLLangInfo):
    name = "AngularJS"

class XHTMLLLangInfo(LangInfo):
    name = "XHTML"
    conforms_to_bases = ["XML", "HTML"]
    exts = ['.xhtml']
    doctypes = [
        # <flavour>, <common-name>, <public-id>, <system-id>
        ("XHTML 1.0 Strict", "html",
         "-//W3C//DTD XHTML 1.0 Strict//EN",
         "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd"),
        ("XHTML 1.0 Transitional", "html",
         "-//W3C//DTD XHTML 1.0 Transitional//EN",
         "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"),
        ("XHTML 1.0 Frameset", "html",
         "-//W3C//DTD XHTML 1.0 Frameset//EN",
         "http://www.w3.org/TR/xhtml1/DTD/xhtml1-frameset.dtd"),
    ]

class XSLTLangInfo(XMLLangInfo):
    name = "XSLT"
    conforms_to_bases = ["XML"]
    exts = ['.xsl', '.xslt']
    #PERF: Only want to include this if necessary (for perf), i.e. if
    #      `exts` isn't sufficient.
    #magic_numbers = [
    #    (0, "regex", re.compile(r'^<xsl:stylesheet ', re.M))
    #]

class XULLangInfo(XMLLangInfo):
    name = "XUL"
    conforms_to_bases = ["XML"]
    exts = ['.xul']
    doctypes = [
        # <flavour>, <common-name>, <public-id>, <system-id>
        (None, "window", "-//MOZILLA//DTD XUL V1.0//EN",
         "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"),
    ]

class XBLLangInfo(XMLLangInfo):
    """eXtensible Binding Language"""
    name = "XBL"
    conforms_to_bases = ["XML"]
    exts = ['.xbl']
    # doctype:
    #   <!DOCTYPE bindings PUBLIC "-//MOZILLA//DTD XBL V1.0//EN" "http://www.mozilla.org/xbl">
    doctypes = [
        # <flavour>, <common-name>, <public-id>, <system-id>
        (None, "bindings", "-//MOZILLA//DTD XBL V1.0//EN",
         "http://www.mozilla.org/xbl"),
    ]


class SGMLLangInfo(XMLLangInfo):
    name = "SGML"
    conforms_to_bases = ["Text"]
    exts = ['.sgml', '.ent']
    magic_numbers = [
        (0, "string", "<!subdoc"), #TODO: should be case-insensitive
        #TODO: How to get these to have lower precedence than HTML
        #      doctype
        #(0, "string", "<!doctype"), #TODO: should be case-insensitive
        #(0, "string", "<!--"),
    ]

class YAMLLangInfo(LangInfo):
    name = "YAML"
    conforms_to_bases = ["Text"]
    exts = ['.yaml', '.yml']
    has_significant_trailing_ws = True
    #TODO: default encoding?

class JSONLangInfo(LangInfo):
    name = "JSON"
    conforms_to_bases = ["JavaScript"]
    exts = [".json"]

    section_regexes = [
        ("namespace", re.compile(r'"(?P<name>[^"]*?)"\s*:\s*{', re.M)),
    ]

class DTDLangInfo(LangInfo):
    name = "DTD"
    conforms_to_bases = ["Text"]
    exts = [".dtd"]

class PODLangInfo(LangInfo):
    """Plain Old Documentation format common in the Perl world."""
    name = "POD"
    conforms_to_bases = ["Text"]
    exts = [".pod"]
    # http://search.cpan.org/~nwclark/perl-5.8.8/pod/perlpod.pod
    encoding_decl_pattern = re.compile(r"^=encoding\s+(?P<encoding>[-\w.]+)", re.M)

class ASN1LangInfo(LangInfo):
    name = "ASN.1"
    komodo_name = "ASN1"
    conforms_to_bases = ["Text"]
    exts = [".asn1"]

class PostScriptLangInfo(LangInfo):
    name = "PostScript"
    conforms_to_bases = ["Text"]
    exts = [".ps"]


class TeXLangInfo(LangInfo):
    name = "TeX"
    conforms_to_bases = ["Text"]
    #TODO: who should win .tex? TeX or LaTeX?
    #exts = [".tex"]

class LaTeXLangInfo(LangInfo):
    name = "LaTeX"
    conforms_to_bases = ["Text"]
    exts = [".tex"]

class ConTeXLangInfo(LangInfo):
    name = "ConTeX"
    conforms_to_bases = ["Text"]

class GettextPOLangInfo(LangInfo):
    """GNU Gettext PO

    http://www.gnu.org/software/gettext/manual/gettext.html#PO-Files
    """
    name = "PO"
    conforms_to_bases = ["Text"]
    exts = [".po"]
    default_encoding = "utf-8"

class TracWikiLangInfo(LangInfo):
    name = "TracWiki"
    conforms_to_bases = ["Text"]
    exts = [".tracwiki"]
    # Headers consist of the same # of equal signs at the start and end of the line.
    # An optional id is allowed after the closing = (to indicate an id attr)
    # A "!" in the header escapes *all* the immediately following = chars.
    section_regexes = [
        ("header",
         re.compile(r'''
            ^
            \s*
            (={1,5})
            \s*
            (?P<name>(?:!=+|
                        [^=!]+|
                        !)+?
            )
            \s*
            \1
            (?:\s|\#|$)
         ''', re.M|re.X)),
    ]

class ReStructureTextLangInfo(LangInfo):
    name = "reStructuredText"
    conforms_to_bases = ["Text"]
    exts = [".rst"]
    section_regexes = [
        ("header", re.compile(r'''^([^\r\n]+)$(\r\n|\n)^(={5,}|-{5,}|`{5,}|:{5,}|'{5,}|"{5,}|~{5,}|\^{5,}|_{5,}|\*{5,}|\+{5,}|\#{5,}|<{5,}|>{5,})\s*$''', re.M)),
    ]

class MarkdownLangInfo(LangInfo):
    """'A text-to-HTML conversion tool [and format] for web writers'

    http://daringfireball.net/projects/markdown/
    """
    name = "Markdown"
    conforms_to_bases = ["Text"]
    exts = [
        # from other editors and what Github's markup processing supports
        ".md", ".markdown", ".mdown", ".mkdn", ".mkd",
        # from <http://www.file-extensions.org/mdml-file-extension>
        ".mdml",
    ]

    section_regexes = [
        # underline-style header
        #TODO: look for regex for this in markdown2.py
        ("H1", re.compile(r'^(.+)[ \t]*(\r\n|\n)(=+)[ \t]*(\r\n|\n)+', re.M), 0),
        ("H2", re.compile(r'^(.+)[ \t]*(\r\n|\n)(-+)[ \t]*(\r\n|\n)+', re.M), 1),
        # leading-hash-style header
        ("H1", re.compile(r'''
            ^(\#{1}) # \1 = string of #'s
            [ \t]+
            (?P<name>.+?) # \2 = Header text
            [ \t]*
            (?<!\\) # ensure not an escaped trailing '#'
            \#* # optional closing #'s (not counted)
            (\r\n|\n)+
            ''', re.X | re.M), 0),
        ("H2", re.compile(r'^(#{2})[ \t]+(?P<name>.+?)[ \t]*(?<!\\)#*(\r\n|\n)+', re.M), 1),
        ("H3", re.compile(r'^(#{3})[ \t]+(?P<name>.+?)[ \t]*(?<!\\)#*(\r\n|\n)+', re.M), 2),
        ("H4", re.compile(r'^(#{4})[ \t]+(?P<name>.+?)[ \t]*(?<!\\)#*(\r\n|\n)+', re.M), 3),
        ("H5", re.compile(r'^(#{5})[ \t]+(?P<name>.+?)[ \t]*(?<!\\)#*(\r\n|\n)+', re.M), 4),
        ("H6", re.compile(r'^(#{6})[ \t]+(?P<name>.+?)[ \t]*(?<!\\)#*(\r\n|\n)+', re.M), 5),
    ]

class RichTextFormatLangInfo(LangInfo):
    """Rich Text Format"""
    name = "RTF"
    conforms_to_bases = ["Text"]
    exts = [".rtf"]
    magic_numbers = [
        (0, "string", r"{\rtf"),
    ]


class TroffLangInfo(LangInfo):
    """'the Text Processor for Typesetters'

    This is the format of man pages on Un*x.
    http://www.troff.org/
    """
    name = "troff"
    conforms_to_bases = ["Text"]
    magic_numbers = [
        (0, "string", '.\\"'),
        (0, "string", "'\\\""),
        (0, "string", "'.\\\""),
        (0, "string", "\\\""),
        (0, "string", "'''"),
    ]
    has_significant_trailing_ws = True

