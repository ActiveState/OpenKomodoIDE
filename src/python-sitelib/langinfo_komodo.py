# Copyright (c) 2007 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""LangInfo definitions specific to Komodo."""

import re
from langinfo import LangInfo


class KomodoProjectLangInfo(LangInfo):
    name = "Komodo Project"
    exts = [".kpf"]
    conforms_to_bases = ["XML"]

class KomodoColorSchemeLangInfo(LangInfo):
    name = "Komodo Color Scheme"
    exts = [".ksf"]
    conforms_to_bases = ["Python"]

class KomodoKeybindingSchemeLangInfo(LangInfo):
    name = "Komodo Keybinding Scheme"
    exts = [".kkf"]
    conforms_to_bases = ["Text"]

class UDLLangInfo(LangInfo):
    name = "UDL"
    komodo_name = "Luddite"
    exts = [".udl"]
    conforms_to_bases = ["Text"]

    section_regexes = [
        # Call language, family and sublanguage statements a 'namespace'.
        ("namespace", re.compile(r"^(?:language|family|sub_?language)\s*\w+", re.M)),
        ("variable", re.compile(r"^pattern\s+\w+", re.M)),
        # Call all other syntax elements a 'production'.
        ("production", re.compile(r"^keywords", re.M)),
        ("production", re.compile(r'''^(?:state|include|initial|fold|extension|start_style|end_style|namespace|system_?id|public_?id)\s+['"]?\w+['"]?''', re.M)),
    ]
