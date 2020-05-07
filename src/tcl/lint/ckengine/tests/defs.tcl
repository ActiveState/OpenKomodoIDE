# defs.tcl --
#
#	This file contains support code for the TclPro Checker test suite.
#	It is normally sourced by the individual files in the test suite
#	before they run their tests.
#
# Copyright (c) 1998-2000 by Ajuba Solutions
# See the file "license.terms" for information on usage and redistribution of this file.
#
# RCS: @(#) $Id: defs.tcl,v 1.4 2000/10/31 23:30:55 welch Exp $

if {[string compare test [info procs test]] == 1} {
    lappend auto_path [file join [file dirname [info script]]]
    package require protest
    namespace import ::protest::*
}

catch {parse} parseMsg
if {[regexp "invalid command" $parseMsg]} {
    package require parser
}

foreach file {location.tcl analyzer.tcl context.tcl userproc.tcl \
		  message.tcl filter.tcl configure.tcl coreTcl.tcl \
		  coreTk.tcl incrTcl.tcl tclX.tcl expect.tcl blt.tcl} {
    source [file join $::protest::sourceDirectory $file]
}
foreach file [glob [file join $::tcltest::testsDirectory *Table]] {
    source $file
}

# sourcePcxFile --
#
#	Source the file <name>.pcx in sourceDirectory or in
#	testsDirectory/../custom/*
#
# Arguments:
#	name	root of the pcx filename testsDirectory .. srcs
#
# Results:
#	Returns the result of sourcing the pcx file, if found.  Otherwise
#	throws and error.

proc sourcePcxFile {name} {

    # the pcx files require the checker package, which contains the public
    # API for checker extensions.

    package provide checker 1.0
    package require configure
    package require analyzer
    namespace eval checker {
	namespace import ::configure::register
	namespace import ::analyzer::*
    }

    set globList [list \
	[file join $::protest::sourceDirectory "$name.pcx"] \
	[file join $::tcltest::testsDirectory .. custom * $name.pcx]]
	    
    foreach pat $globList {
	set fileList [glob -nocomplain $pat]
	if {[llength $fileList] > 0} {
	    return [source [lindex $fileList 0]]
	}
    }
    error "can't find pcx file \"$name\""
}

proc messageShow {mid errRange clientData} {
    global result
    if {$result == "ok"} {
	set result {}
    }
    lappend result [analyzer::getLine] [analyzer::getCmdRange] \
	    $mid $errRange $clientData
}

proc testCmd {cmd} {
    global result
    set result ok

    set ::analyzer::script $cmd
    set ::analyzer::file test
    set ::analyzer::currentLine 1
    checkScript
    return $result
}

proc testVersion {tbl ver} {
    set major 1	
    set minor 0
    
    foreach {cmd expected} [set ::${tbl}${ver}] {
	test ${tbl}${ver}-$major.$minor [list $cmd] {
	    testCmd $cmd
	} $expected
        incr minor	
    }
}

proc scanalyze {file} {
    analyzer::scan $file
    analyzer::collate
    analyzer::analyze $file
}


proc addTestUserProc {} {
    set p1 [uproc::newProcInfo]
    set p1 [uproc::setName $p1 ::testScanCmd]
    set p1 [uproc::setMin  $p1 1]
    set p1 [uproc::setMax  $p1 1]
    set p1 [uproc::setDef  $p1 1]
    uproc::add $p1 1
}

proc renameMessageShow {} {
    rename message::show message::show-testOrig
    rename messageShow message::show
}

proc resetMessageShow {} {
    rename message::show messageShow
    rename message::show-testOrig message::show
}

proc resetAllData {} {
    resetAnalyzer
    resetScanData
}

proc resetAnalyzer {} {
    namespace eval analyzer {
	variable errCount 0
	variable file {}
	variable script {}
	variable currentLine 1
	variable cmdRange {}
	variable cmdStack {}
	variable checkers
	variable scanCmds
	catch {unset checkers}
	catch {unset scanCmds}
	array set checkers {}
	array set scanCmds {}
	variable quiet 1
    }
}

proc resetUProcData {} {
    catch {unset analyzer::importCmds}
    catch {unset analyzer::exportCmds}
    catch {unset analyzer::renameCmds}
    catch {unset analyzer::inheritCmds}
    catch {unset context::knownContext}
    catch {unset uproc::userProc}
    catch {unset uproc::userProcCount}

    array set analyzer::importCmds   {}
    array set analyzer::exportCmds   {}
    array set analyzer::renameCmds   {}
    array set analyzer::inheritCmds  {}
    array set context::knownContext  {}
    array set uproc::userProc        {}
    array set uproc::userProcCount   {}
    set analyzer::unknownCmds        {}
}

proc resetScanData {} {
    catch {unset analyzer::exportCmds}
    catch {unset analyzer::renameCmds}
    catch {unset analyzer::inheritCmds}
    catch {unset context::knownContext}
    catch {unset uproc::userProc}
    catch {unset uproc::userProcCount}

    array set analyzer::importCmds   {}
    array set analyzer::exportCmds   {}
    array set analyzer::renameCmds   {}
    array set analyzer::inheritCmds  {}
    array set context::knownContext  {}
    array set uproc::userProc        {}
    array set uproc::userProcCount   {}
    set analyzer::unknownCmds        {}

    analyzer::addScanCmds coreTcl::scanCmds$::protest::currentVersion(Tcl)
    set analyzer::setQuiet 1
    set analyzer::scanning 0
    analyzer::setTwoPass 1
}
