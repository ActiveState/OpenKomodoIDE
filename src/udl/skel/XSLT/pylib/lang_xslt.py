#!/usr/bin/env python
# Copyright (c) 2006 ActiveState Software Inc.
# See LICENSE.txt for license details.

"""XML support for CodeIntel"""

import logging
from codeintel2.common import *
from codeintel2.udl import UDLLexer, UDLBuffer, UDLCILEDriver, XMLParsingBufferMixin
from koXMLDatasetInfo import getService

#---- globals

lang = "XSLT"
log = logging.getLogger("codeintel.xslt")

class XSLTLexer(UDLLexer):
    lang = lang

class XSLTBuffer(UDLBuffer, XMLParsingBufferMixin):
    lang = lang
    m_lang = "XML"

    # Characters that should close an autocomplete UI:
    # - wanted for XML completion: ">'\" "
    cpln_stop_chars = ">'\" "

    def xml_default_dataset_info(self, node):
        #print "%s:%s node %r" % (self.lang, trg.lang, node)
        tree = self.xml_tree
        if node is not None and not tree.namespace(node):
            # Do we have an output element, if so, figure out if we're html.
            # Cheap way to get the output element.
            output = tree.tags.get(tree.namespace(tree.root), {}).get('output', None)
            if output is not None:
                lang = output.attrib.get('method').upper()
                publicId = output.attrib.get('doctype-public')
                systemId = output.attrib.get('doctype-system')
                if publicId or systemId:
                    default_dataset_info = (publicId, systemId, None)
                else:
                    datasetSvc = getService()
                    default_dataset_info = (
                        datasetSvc.getDefaultPublicId(lang, self.env),
                        None,
                        datasetSvc.getDefaultNamespace(lang, self.env)
                    )
                #print "get output type %r" % (default_dataset_info,)
                return default_dataset_info
        return XMLParsingBufferMixin.xml_default_dataset_info(self, node)

#---- registration

def register(mgr):
    """Register language support with the Manager."""
    mgr.set_lang_info(lang,
                      silvercity_lexer=XSLTLexer(),
                      buf_class=XSLTBuffer,
                      import_handler_class=None,
                      cile_driver_class=None,
                      is_cpln_lang=True)

