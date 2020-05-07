# Copyright (c) 2007 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""LangInfo definitions for languages that don't fit in the other
langinfo_*.py files.
"""

import re
from langinfo import LangInfo



# Replacement for regex's '$' to match the end of line with '\r\n' and
# '\r'-style EOLs.
_eol_pat = r"(?=\r\n|(?<!\r)\n|\r(?!\n)|\Z)"



class MakefileLangInfo(LangInfo):
    name = "Makefile"
    conforms_to_bases = ["Text"]
    exts = [".mak"]
    filename_patterns = [re.compile(r'^[Mm]akefile.*$')]

class CMakeLangInfo(LangInfo):
    name = "CMake"
    conforms_to_bases = ["Text"]
    exts = [".cmake", ".cmake.in"]

class _CSSLangInfoCommon(LangInfo):
    conforms_to_bases = ["Text"]
    exts = [".css"]
    default_encoding = "utf-8"
    # http://www.w3.org/International/questions/qa-css-charset
    # http://www.w3.org/TR/CSS21/syndata.html#charset
    # http://www.w3.org/TR/CSS2/syndata.html#q23            
    # I.e., look for:
    #   @charset "<IANA defined charset name>";
    # at the start of the CSS document.
    encoding_decl_pattern = re.compile(r'\A@charset "(?P<encoding>[\w-]+)";')

class CSSLangInfo(_CSSLangInfoCommon):
    name = "CSS"
    exts = [".css"]

class SCSSLangInfo(_CSSLangInfoCommon):
    name = "SCSS"
    exts = [".scss", ".css.scss"]

class LessLangInfo(_CSSLangInfoCommon):
    name = "Less"
    exts = [".less", ".css.less"]

class SassLangInfo(_CSSLangInfoCommon):
    name = "Sass"
    exts = [".sass", ".css.sass"]
    section_regexes = [
        ("production", re.compile(r"^(\w\S+?),?", re.M)),
    ]


class CIXLangInfo(LangInfo):
    """Komodo Code Intelligence XML dialect.

    This is used to define the code structure of scanned programming
    language content.
    """
    name = "CIX"
    conforms_to_bases = ["XML"]
    exts = [".cix"]


class DiffLangInfo(LangInfo):
    name = "Diff"
    conforms_to_bases = ["Text"]
    exts = [".patch", ".diff"]
    section_regexes = [
        #("namespace", re.compile(r"^Index:\s+(?P<name>.*?)\s*%s" % _eol_pat, re.M)),

        # `p4 diff` header. Examples:
        #   ==== //depot/foo.css#42 - c:\clientview\foo.css ====
        #   ==== //depot/foo.js#22 (xtext) ====
        ("class", re.compile(r"^==== (.*?)#\d+ (- .*?) ====%s" % _eol_pat, re.M)),
        # Unified diff header:
        #   --- foo Thu May 29 15:01:19 2008
        #   +++ bar Thu May 29 15:01:21 2008
        ("class", re.compile(
            r"^---(\s+(.*?)(\t.*?)?)?\s*(\r\n|\n|\r)"
            r"^\+\+\+([ \t]+(?P<name>.*?)(\t.*?)?)?\s*(\r\n|\n|\r)",
            re.M)),
        # Context diff header:
        #   *** foo Thu May 29 15:01:19 2008
        #   --- bar Thu May 29 15:01:21 2008
        ("class", re.compile(
            r"^\*\*\*(\s+(.*?)(\t.*?)?)?\s*(\r\n|\n|\r)"
            r"^---([ \t](?P<name>.*?)(\t.*?)?)?\s*(\r\n|\n|\r)",
            re.M)),

        # Plain hunk header.
        # E.g., '9c9', '185,187c185'
        ("variable", re.compile(r"^(\d+(,\d+)?[acd]\d+(,\d+)?)%s" % _eol_pat, re.M)),
        # Context hunk header
        # E.g., '*** 32,37 ****', '--- 1 ----'
        ("variable", re.compile(r"^(([\*-]){3} \d+(,\d+)? \2{4})", re.M)),
        # Unified hunk header
        # E.g., '@@ -296,7 +296,8 @@'
        ("variable", re.compile(r"^@@ -\d+,\d+ \+\d+,\d+ @@", re.M)),
    ]
    has_significant_trailing_ws = True

    # The section_hit_title_processor is used to add the hunk number to the
    # start of the hunk title. This is handy for those using patch - which makes
    # it easy to find and jump to failed patch hunks.
    _last_hit_count = 0
    def section_hit_title_processor(self, type, rematch, title):
        if type == "class":
            self._last_hit_count = 0
        elif type == "variable":
            self._last_hit_count += 1
            return "%d %s" % (self._last_hit_count, title)
        return title

class IDLLangInfo(LangInfo):
    #TODO: clarify if this is the math thing or the COM-IDL thing
    name = "IDL"
    conforms_to_bases = ["Text"]
    exts = [".idl"]

class ApacheConfigLangInfo(LangInfo):
    name = "Apache Config"
    komodo_name = "Apache"
    conforms_to_bases = ["Text"]
    exts = [".conf"]
    filename_patterns = [".htaccess"]

class APDLLangInfo(LangInfo):
    """ANSYS Parametric Design Language

    http://www.mece.ualberta.ca/tutorials/ansys/AT/APDL/APDL.html
    """
    name = "APDL"
    conforms_to_bases = ["Text"]
    exts = [".mac"]

class IniLangInfo(LangInfo):
    name = "Ini"
    conforms_to_bases = ["Text"]
    exts = [".ini"]
    section_regexes = [
        ("class", re.compile(r"^\[(?P<name>.*?)\]", re.M)),
        ("variable", re.compile(r"^(?P<name>[\w\d\.-]*?)\s*=", re.M)),
    ]

class POVRayLangInfo(LangInfo):
    """The "Persistence of Vision Raytracer"
    http://www.povray.org
    """
    name = "POVRay"
    conforms_to_bases = ["Text"]
    exts = [".pov"]

class POGetTextLangInfo(LangInfo):
    name = "GetText"
    conforms_to_bases = ["Text"]
    exts = [".po"]

class MatlabLangInfo(LangInfo):
    """A high-performance language for technical computing.
    http://www.mathworks.com/
    """
    name = "Matlab"
    conforms_to_bases = ["Text"]
    exts = [".m", ".mat"]
    section_regexes = [
        ("function", re.compile(r"^.*?\bfunction\b\s+(?P<name>\w+)", re.M)),
        ("class", re.compile(r"^.*?classdef\s+(?P<name>\w+)\b", re.M)),
        ]

class ForthLangInfo(LangInfo):
    """Forth is a structured, imperative, stack-based, computer programming
    language.
    http://en.wikipedia.org/wiki/Forth_(programming_language)
    http://www.forth.org/
    """
    name = "Forth"
    conforms_to_bases = ["Text"]
    exts = [".forth"]


class FlagshipLangInfo(LangInfo):
    """ Flagship is a commercial compiler for Clipper (dBASE III compiler)
    http://www.fship.com/
    http://en.wikipedia.org/wiki/Clipper_(programming_language)
    """
    name = "Flagship"
    conforms_to_bases = ["Text"]
    exts = [".prg"]

class SQLLangInfo(LangInfo):
    #TODO: describe: what SQL spec does this conform to?
    #TODO: should we have other SQL langs? E.g. for PostgreSQL, etc.?
    name = "SQL"
    conforms_to_bases = ["Text"]
    exts = [".sql"]

class PLSQLLangInfo(LangInfo):
    #TODO: describe how different from SQLLangInfo
    name = "PL-SQL"
    conforms_to_bases = ["Text"]
    #exts = [".sql"]
    is_minor_variant = SQLLangInfo

class MSSQLLangInfo(LangInfo):
    #TODO: describe how diff from SQLLangInfo
    name = "MSSQL"
    conforms_to_bases = ["Text"]

class MySQLLangInfo(LangInfo):
    name = "MySQL"
    conforms_to_bases = ["Text"]
    exts = [".sql"]
    is_minor_variant = SQLLangInfo


class NSISLangInfo(LangInfo):
    """Nullsoft Scriptable Install System
    http://nsis.sourceforge.net/
    """
    name = "NSIS"
    komodo_name = "Nsis"
    conforms_to_bases = ["Text"]
    exts = [".nsi"]


class VimLangInfo(LangInfo):
    """Vim configuration"""
    name = "Vim"
    conforms_to_bases = ["Text"]
    exts = [".vim"]
    filename_patterns = [".vimrc"]

class INILangInfo(LangInfo):
    name = "INI"
    conforms_to_bases = ["Text"]
    exts = [".ini"]

class LogLangInfo(LangInfo):
    name = "log"
    conforms_to_bases = ["Text"]
    exts = [".log"]

class CobolLangInfo(LangInfo):
    name = "COBOL"
    conforms_to_bases = ["Text"]
    exts = [".cbl"]

class NimrodLangInfo(LangInfo):
    name = "Nimrod"
    conforms_to_bases = ["Text"]
    exts = [".nim"]

class PowerProLangInfo(LangInfo):
    name = "PowerPro"
    conforms_to_bases = ["Text"]

class SMLLangInfo(LangInfo):
    name = "SML"
    conforms_to_bases = ["Text"]
    exts = [".sml"]

class SorcusLangInfo(LangInfo):
    name = "Sorcus"
    conforms_to_bases = ["Text"]

class TACLLangInfo(LangInfo):
    name = "TACL"
    conforms_to_bases = ["Text"]
    exts = [".tacl"]

class TALLangInfo(LangInfo):
    name = "TAL"
    conforms_to_bases = ["Text"]
    exts = [".tal"]

class DockerLangInfo(LangInfo):
    name = "Docker"
    conforms_to_bases = ["Text"]
    filename_patterns = ["Dockerfile"]

class RLangInfo(LangInfo):
    name = "R"
    conforms_to_bases = ["Text"]
    exts = [".R", ".r", ".Rout", ".Rhistory", ".Rt", ".Rout.save", ".Rout.fail", ".S"]
