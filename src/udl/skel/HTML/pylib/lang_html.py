#!/usr/bin/env python
# Copyright (c) 2006 ActiveState Software Inc.
# See LICENSE.txt for license details.

"""HTML support for CodeIntel"""

import os
import sys
import logging
import re
import traceback
from pprint import pprint

from codeintel2.common import *
from codeintel2.langintel import LangIntel
from codeintel2.udl import UDLLexer, UDLBuffer, UDLCILEDriver, XMLParsingBufferMixin
from codeintel2.lang_xml import XMLLangIntel
from HTMLTreeParser import html_optional_close_tags

if _xpcom_:
    from xpcom.server import UnwrapObject



#---- globals

lang = "HTML"
log = logging.getLogger("codeintel.html")
#log.setLevel(logging.DEBUG)



#---- language support

class HTMLLexer(UDLLexer):
    lang = lang


class HTMLLangIntel(XMLLangIntel):
    lang = lang
    
    def trg_from_pos(self, buf, pos, implicit=True, DEBUG=False):
        """
        Retrieves a codeintel completion trigger based on the current position,
        taking into account an HTML-specific context.
        In most cases, this will simply be XML code completion. However, if the
        caret is within an "id" or "class" attribute value, a CSS anchor or
        class completions trigger will be returned.
        """
        trg = XMLLangIntel.trg_from_pos(self, buf, pos, implicit, DEBUG)
        if trg and trg.type == "attr-enum-values":
            accessor = buf.accessor
            attrName = accessor.text_range(*accessor.contiguous_style_range_from_pos(trg.pos-3))
            if attrName.lower() == "id":
                return Trigger("CSS", TRG_FORM_CPLN, "anchors",
                               pos, implicit)
            elif attrName.lower() == "class":
                return Trigger("CSS", TRG_FORM_CPLN, "class-names",
                               pos, implicit)
        return trg

    def get_valid_tagnames(self, buf, pos, withPrefix=False):
        node = buf.xml_node_at_pos(pos)
        #print "get_valid_tagnames NODE %s:%s xmlns[%s] %r"%(buf.xml_tree.prefix(node),node.localName,node.ns,node.tag)
        handlerclass = buf.xml_tree_handler(node)
        tagnames = None
        if node is not None: # or not tree.parent(node):
            tagnames = set(handlerclass.tagnames(buf.xml_tree, node))
            while node is not None and node.localName in html_optional_close_tags:
                node = buf.xml_tree.parent(node)
                if node is not None:
                    tagnames = tagnames.union(handlerclass.tagnames(buf.xml_tree, node))
        if not tagnames and hasattr(handlerclass, "dataset"):
            tagnames = handlerclass.dataset.all_element_types()
        if not tagnames:
            return None
        tagnames = list(tagnames)
        tagnames.sort()
        if withPrefix and node is not None:
            prefix = buf.xml_tree.prefix(node)
            if prefix:
                return ["%s:%s" % (prefix, name) for name in tagnames]
        return tagnames
    
    def cpln_end_tag(self, buf, trg):
        node = buf.xml_node_at_pos(trg.pos)
        if node is None: return None
        tagName = buf.xml_tree.tagname(node)
        if not tagName:
            return []
    
        # here on, we're only working with HTML documents
        line, col = buf.accessor.line_and_col_at_pos(trg.pos)
        names = [tagName]
        # if this is an optional close node, get parents until a node that
        # requires close is found
        while node is not None and node.localName in html_optional_close_tags:
            node = buf.xml_tree.parent(node)
            if node is None:
                break
            if not node.end:
                names.append(buf.xml_tree.tagname(node))
                continue
        return [('element',tagName+">") for tagName in names]

class HTMLBuffer(UDLBuffer, XMLParsingBufferMixin):
    lang = lang
    m_lang = "HTML"
    csl_lang = "JavaScript"
    css_lang = "CSS"

    # Characters that should close an autocomplete UI:
    # - wanted for XML completion: ">'\" "
    # - wanted for CSS completion: " ('\";},.>"
    # - wanted for JS completion:  "~`!@#%^&*()-=+{}[]|\\;:'\",.<>?/ "
    # - dropping ':' because I think that may be a problem for XML tag
    #   completion with namespaces (not sure of that though)
    # - dropping '[' because need for "<!<|>" -> "<![CDATA[" cpln
    # - dropping '-' because causes problem with CSS and XML (bug 78312)
    # - dropping '!' because causes problem with CSS "!important" (bug 78312)
    cpln_stop_chars = "'\" ;,~`@#%^&*()=+{}]|\\,.<>?/"

class HTMLCILEDriver(UDLCILEDriver):
    lang = lang
    csl_lang = "JavaScript"
    css_lang = "CSS"




#---- registration

def register(mgr):
    """Register language support with the Manager."""
    mgr.set_lang_info(lang,
                      silvercity_lexer=HTMLLexer(),
                      buf_class=HTMLBuffer,
                      langintel_class=HTMLLangIntel,
                      cile_driver_class=HTMLCILEDriver,
                      is_cpln_lang=True)

