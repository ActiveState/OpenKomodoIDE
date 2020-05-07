# json_write.tcl --
#
#	Commands for the generation of JSON (Java Script Object Notation).
#
# Copyright (c) 2009-2011 Andreas Kupries <andreas_kupries@sourceforge.net>
#
# See the file "license.terms" for information on usage and redistribution
# of this file, and for a DISCLAIMER OF ALL WARRANTIES.
# 
# RCS: @(#) $Id: json_write.tcl,v 1.2 2011/08/24 20:09:44 andreas_kupries Exp $

# ### ### ### ######### ######### #########
## Requisites

package require Tcl 8.5

namespace eval ::json::write {
    namespace export \
	string array object indented aligned

    namespace ensemble create
}

# ### ### ### ######### ######### #########
## API.

proc ::json::write::indented {{bool {}}} {
    variable indented

    if {[llength [info level 0]] > 2} {
	return -code error {wrong # args: should be "json::write indented ?bool?"}
    } elseif {[llength [info level 0]] == 2} {
	if {![::string is boolean -strict $bool]} {
	    return -code error "Expected boolean, got \"$bool\""
	}
	set indented $bool
	if {!$indented} {
	    variable aligned 0
	}
    }

    return $indented
}

proc ::json::write::aligned {{bool {}}} {
    variable aligned

    if {[llength [info level 0]] > 2} {
	return -code error {wrong # args: should be "json::write aligned ?bool?"}
    } elseif {[llength [info level 0]] == 2} {
	if {![::string is boolean -strict $bool]} {
	    return -code error "Expected boolean, got \"$bool\""
	}
	set aligned $bool
	if {$aligned} {
	    variable indented 1
	}
    }

    return $aligned
}

proc ::json::write::string {s} {
    variable quotes
    return "\"[::string map $quotes $s]\""
}

proc ::json::write::array {args} {
    # always compact form.
    return "\[[join $args ,]\]"
}

proc ::json::write::object {args} {
    # The dict in args maps string keys to json-formatted data. I.e.
    # we have to quote the keys, but not the values, as the latter are
    # already in the proper format.

    variable aligned
    variable indented

    if {[llength $args] %2 == 1} {
	return -code error {wrong # args, expected an even number of arguments}
    }

    set dict {}
    foreach {k v} $args {
	lappend dict [string $k] $v
    }

    if {$aligned} {
	set max [MaxKeyLength $dict]
    }

    if {$indented} {
	set content {}
	foreach {k v} $dict {
	    if {$aligned} {
		set k [AlignLeft $max $k]
	    }
	    if {[::string match *\n* $v]} {
		# multi-line value
		lappend content "    $k : [Indent $v {    } 1]"
	    } else {
		# single line value.
		lappend content "    $k : $v"
	    }
	}
	if {[llength $content]} {
	    return "\{\n[join $content ,\n]\n\}"
	} else {
	    return "\{\}"
	}
    } else {
	# ultra compact form.
	set tmp {}
	foreach {k v} $dict {
	    lappend tmp "$k:$v"
	}
	return "\{[join $tmp ,]\}"
    }
}

# ### ### ### ######### ######### #########
## Internals.

proc ::json::write::Indent {text prefix skip} {
    set pfx ""
    set result {}
    foreach line [split $text \n] {
	if {!$skip} { set pfx $prefix } else { incr skip -1 }
	lappend result ${pfx}$line
    }
    return [join $result \n]
}

proc ::json::write::MaxKeyLength {dict} {
    # Find the max length of the keys in the dictionary.

    set lengths 0 ; # This will be the max if the dict is empty, and
		    # prevents the mathfunc from throwing errors for
		    # that case.

    foreach str [dict keys $dict] {
	lappend lengths [::string length $str]
    }

    return [tcl::mathfunc::max {*}$lengths]
}

proc ::json::write::AlignLeft {fieldlen str} {
    return [format %-${fieldlen}s $str]
    #return $str[::string repeat { } [expr {$fieldlen - [::string length $str]}]]
}

# ### ### ### ######### ######### #########

namespace eval ::json::write {
    # Configuration of the layout to write.

    # indented = boolean. objects are indented.
    # aligned  = boolean. object keys are aligned vertically.

    # aligned  => indented.

    # Combinations of the format specific entries
    # I A |
    # - - + ---------------------
    # 0 0 | Ultracompact (no whitespace, single line)
    # 1 0 | Indented
    # 0 1 | Not possible, per the implications above.
    # 1 1 | Indented + vertically aligned keys
    # - - + ---------------------

    variable indented 1
    variable aligned  1

    variable quotes \
	[list "\"" "\\\"" / \\/ \\ \\\\ \b \\b \f \\f \n \\n \r \\r \t \\t]
}

# ### ### ### ######### ######### #########
## Ready

package provide json::write 1.0.1
return
