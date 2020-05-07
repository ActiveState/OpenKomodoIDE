#!/usr/local/bin/tclsh
# -*- tcl -*-

namespace eval ::ktdb_fake {
    variable  opts
    array set opts {gla mour}
}
set a 0
set b 1
set ::c 3
set f bla
set g force

proc b {} {
    set b 0
    d
}
proc c {} {
    set f a
    d
}
proc d {} {
    set g x
}
proc a {args} {
    b
    c
    d
}

a

socket -server 5555 handle
vwait forever
exit 0
