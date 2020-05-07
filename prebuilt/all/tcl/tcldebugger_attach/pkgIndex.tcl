# pkgIndex.tcl --
#
#	Package index for remote attachment to prodebug.
#
# Copyright (c) 2003 ActiveState Corporation
# All rights reserved.
# 
# RCS: @(#) $Id: pkgIndex.tcl.in,v 1.6 2000/07/26 04:51:40 welch Exp $

# ### ######### ###########################

package ifneeded tcldebugger_attach 1.4 [list source [file join $dir attach.tcl]]

# ### ######### ###########################
