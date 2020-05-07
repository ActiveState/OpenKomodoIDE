#!/bin/sh
# Copyright (c) 2000-2006 ActiveState Software Inc.
#
# Komodo "AS Package" simple install script
#
# To install Komodo, run:
#   ./install.sh
# To see additional install options, run:
#   ./install.sh -h

dname=`dirname $0`
# use the python2.7 (or whatever) binary here, because `python` can be a shell
# script, and that will give us the wrong result
exe_type=`file "$dname"/INSTALLDIR/lib/python/bin/python*.*`
case `uname -m` in
    x86_64)
        machine_arch=".*64-bit"
        wanted_arch="x86_64";;
    i?86)
        machine_arch=".*32-bit"
        wanted_arch="x86";;
    *)
        # I dunno what you're doing, hopefully you're smart enough
        KOMODO_FORCE_ARCH=1;;
esac
print_arch_warning ( ) { true; }
if [ -z "$KOMODO_FORCE_ARCH" -a "0" -eq `expr "$exe_type" : "$machine_arch"` ] ; then
    print_arch_warning ( ) {
        cat >&1 <<-EOF
	[31;1m
	This Komodo binary may not be correct for your computer's architecture.
	You can download the $wanted_arch Komodo version at:
	http://www.activestate.com/komodo-ide/downloads
	[0m
	EOF
        }
fi
print_arch_warning
LD_LIBRARY_PATH="$dname/INSTALLDIR/lib/mozilla:"$LD_LIBRARY_PATH
export LD_LIBRARY_PATH
$dname/INSTALLDIR/lib/python/bin/python -E $dname/support/_install.py "$@"
print_arch_warning
