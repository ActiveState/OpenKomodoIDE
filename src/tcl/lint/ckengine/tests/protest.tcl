# protest.tcl --
#
#	This file defines the ::protest namespace.  It is used by the
#       test harness for TclPro and finds and defines the workspace directory,
#       installation directory, tools, executables, source, etc. used by the
#       tests. See the README file for more details.
#
# Copyright (c) 1998-2000 by Ajuba Solutions
# See the file "license.terms" for information on usage and redistribution of this file.
# 
# RCS: @(#) $Id: protest.tcl,v 1.21 2000/10/31 23:30:55 welch Exp $

if {[string compare test [info procs test]] == 1} {
    lappend auto_path [info library]
    package require tcltest
    catch {namespace import ::tcltest::*} m
}

set oDir [pwd]
cd [file dirname [info script]]
set ::tcltest::testsDirectory [pwd]
cd $oDir

package require projectInfo

package provide protest 1.0

# create the "protest" namespace for all testing variables and procedures

namespace eval ::protest {
    # Don't want to trigger an error if this gets imported more than once
    #namespace import ::tcltest::*

    # Export the public protest procs
    set procList [list findExeFile findSoFile setupValidLicense \
	    saveOriginalLicense restoreOriginalLicense testAllFiles \
	    resetTestsDirectory]
    foreach proc $procList {
	namespace export $proc
    }

    # TclPro is limited to a smaller platform set.  Set the
    # ::tcltest::platform variable to the platform you are currently using.
    # This variable is only used by the TclPro tests.

    set platformList [list \
	    win     win32-ix86 \
	    linux   linux-ix86 \
	    sun     solaris-sparc \
	    hp      hpux-parisc \
	    irix    irix-mips ]

    foreach {pmatch plat} $platformList {
	if {[regexp -nocase $pmatch $tcl_platform(os)]} {
	    variable platform $plat
	}   
    }

    array set platformArray $platformList
    if {![info exists ::protest::platform]} {
	::tcltest::PrintError "\"tcl_platform(os)\" doesn't match the \
		supported platforms.  Acceptable responses are: \
		[array names platformArray]"
	exit 1
    }

    # Match defaults to all directories and skip patterns default to the empty
    # list 
    variable matchDirectories {*}
    variable skipDirectories {}

    # by default, put any interpreters this package creates into an interpreter
    # subdirectory of the temporaryDirectory; this is set in the
    # processCmdLineHooks proc since the temporaryDirectory can be redefined 
    variable interpreterDirectory {}
    
    # Default is to not specify an installation directory
    variable installationDirectory {}

    # Preset executableDirectory and sourceDirectory to {}; these variables
    # will be set to their actual values the command line arguments are
    # processed. 
    variable executableDirectory {}
    variable sourceDirectory {}

    # The workspace directory defaults to 2 levels up from the 'tests'
    # directory; since the default tests directory is different for pro than
    # for tcl, it's set in the processCmdLineArgsHook to ensure that it's been
    # reset. 
    variable workspaceDirectory {}

    # buildType defaults to Debug
    variable buildType Debug

    # Default for license is an empty string; save original key and server
    # information 
    variable license ""
    variable savedLicenseKey {}
    variable savedLicenseServer {}

    variable currentVersion
    # Set the current Tcl, extension, and tools versions
    array set ::protest::currentVersion [list \
	    Tcl                 $::projectInfo::baseTclVers \
	    Tcl-short           $::projectInfo::shortTclVers \
	    Tcl-patch           $::projectInfo::patchTclVers \
	    Tk                  $::projectInfo::baseTclVers \
	    Tk-short            $::projectInfo::shortTclVers \
	    Tk-patch            $::projectInfo::patchTclVers \
	    Incr                3.1 \
	    Incr-patch          3.1.0 \
	    Iwidget-patch       3.0.0 \
	    Iwidgets-old-patch  2.2.0 \
	    TclX                8.2 \
	    TclX-patch          8.2.0 \
	    Expect              5.31 \
	    Expect-patch        5.31.0 \
	    Sybtcl              3.0 \
	    Sybtcl-patch        3.0b3 \
	    Oratcl              2.5 \
	    Oratcl-patch        2.5.0 \
	    XmlAct              1.0 \
	    XmlAct-patch        1.0b1 \
	    XmlGen              1.0 \
	    XmlGen-patch        1.0b1 \
	    XmlServer           1.0 \
	    XmlServer-patch     1.0b1 \
	    Blend               1.2 \
	    Blend-patch         1.2.5 \
	    TclCom              1.0 \
	    TclCom-patch        1.0b1 \
	    TclDomPro           1.0 \
	    TclDomPro-patch     1.0b1 \
	    Tools               1.3 \
	    tbcload             1.3 \
	    dde                 1.1 \
	    registry            1.0 ]

    array set ::protest::supportedVersions [list \
	    Tcl	        {7.3 7.4 7.5 7.6 8.0 8.1 8.2 8.3} \
	    Tk          {3.6 4.0 4.1 4.2 8.0 8.1 8.2 8.3} \
	    Incr	{1.5 2.0 2.1 2.2 3.0 3.1} \
	    TclX	{8.0 8.1 8.2} \
	    Expect	{5.28 5.29 5.30 5.31} \
	    Sybtcl	{3.0} \
	    Oratcl	{2.5} \
	    Blend	{1.2} \
	    TclCom	{1.0} \
	    TclDomPro   {1.0} \
	    XmlAct      {1.0} \
	    XmlGen      {1.0} \
	    XmlServer   {1.0} \
	    BLT		{2.4} \
	    http        {1.0 2.1} \
	    msgCat      {1.0} ]

     array set ::protest::tclVersion [list \
	    Tk3.6		7.3 \
	    Tk4.0		7.4 \
	    Tk4.1		7.5 \
	    Tk4.2		7.6 \
	    Tk8.0		8.0 \
	    Tk8.1		8.1 \
	    Tk8.2		8.2 \
	    Tk8.3		8.3 \
	    Incr1.5		7.3 \
	    Incr2.0		7.4 \
	    Incr2.1		7.5 \
	    Incr2.2		7.6 \
	    Incr3.0		8.0 \
	    Incr3.1		8.3 \
	    TclX8.0		8.0 \
	    TclX8.1		8.1 \
	    TclX8.2		8.3 \
	    Expect5.28		8.0 \
	    Expect5.29		8.0 \
	    Expect5.30		8.1 \
	    Expect5.31		8.3 \
	    Sybtcl3.0		8.3 \
	    Oratcl2.5		8.3 \
	    Blend1.2		8.3 \
	    TclCom1.0		8.3 \
	    BLT2.4              8.0 ]

    array set ::protest::prettyPkgName {
	    coreTcl	Tcl
	    coreTk	Tk
	    tcl		Tcl
	    tk		Tk
	    incrTcl	Incr
	    tclX	TclX
	    expect	Expect
	    sybtcl	Sybtcl
	    oratcl	Oratcl
	    blend	Blend
	    tclCom	TclCom
	    tclDomPro	TclDomPro
	    xmlAct	XmlAct
	    xmlGen	XmlGen
	    xmlServer	XmlServer
	    blt		BLT
	    http	http
	    msgcat	msgCat
    }

    variable tclDirectory ""
    variable tkDirectory ""
    variable toolsDirectory ""
}

# ::tcltest::PrintUsageInfoHook --
#
#	Prints additional flag information specific to package protest
#
# Arguments:
#	none
#
proc ::tcltest::PrintUsageInfoHook {} {
    puts [format " \
	    -relateddir pattern\t Run tests in directories that match \n\
	    \t                 the glob pattern given. \n\
	    -asidefromdir pattern\t Skip tests in directories that match \n\
	    \t                 the glob pattern given."]
    return
}


proc ::tcltest::initConfigHook {} {
    # If the installation came from a CD, the -install flag must have been
    # used and a src directory must exist within the specified installation
    # directory.
    if {![string equal $::protest::installationDirectory ""] && \
	    [file exists \
	    [file join ::protest::installationDirectory set]]} {
	set ::tcltest::testConfig(installFromCD) 1
    } else {
	set ::tcltest::testConfig(installFromCD) 0
    }
    return
}

# ::tcltest::processCmdLineArgsAddFlagsHook --
#
#	Adds tclPro-specific flags to those processed by the main tcltest
#       command line processing routine.

proc ::tcltest::processCmdLineArgsAddFlagsHook {} {
    return [list -install -ws -exedir -build -srcsdir -license -asidefromdir \
	    -relateddir -toolsdir]
}


# ::tcltest::processCmdLineArgsHook --
#
#	Use the command line arguments provided by the
#       processCmdLineArgsAddFlagsHook to set the installationDirectory,
#       workspaceDirectory, executableDirectory, sourceDirectory,
#       buildType, and license variables.
#
# Arguments:
#	flagArray        flags provided to ::tcltest::processCmdLineArgs
#
# Results:
#	Sets the above-named variables in the ::protest namespace.

proc ::tcltest::processCmdLineArgsHook {flagArray} {
    global tcl_platform env

    array set flag $flagArray

    # Handle -relateddir and -asidefromdir flags
    if {[info exists flag(-relateddir)]} {
	set ::protest::matchDirectories $flag(-relateddir)
    }
    if {[info exists flag(-asidefromdir)]} {
	set ::protest::skipDirectories $flag(-asidefromdir)
    }

    # Set the ::protest::installationDirectory the arg of -install, if
    # given; otherwise "". 
    #
    # If the path is relative, make it absolute.  If the file is not an
    # existing dir, then return an error.

    if {[info exists flag(-install)]} {
	set ::protest::installationDirectory $flag(-install)
	if {![file isdir $::protest::installationDirectory]} {
	    ::tcltest::PrintError "bad argument \
		    \"$::protest::installationDirectory\" to -install: \
		    \"$::protest::installationDirectory\" is not an \
		    existing directory" 
	    exit 1
	}
	if {[string equal \
		[file pathtype $::protest::installationDirectory] \
		"absolute"] == 0} {
	    set ::protest::installationDirectory \
		    [file join [pwd] $::protest::installationDirectory]
	}
    } 

    # Set the ::protest::workspaceDirectory the arg of -ws, if given.
    #
    # If the path is relative, make it absolute.  If the file is not an
    # existing dir, then return an error.

    if {[info exists flag(-ws)]} {
	set ::protest::workspaceDirectory $flag(-ws)
	if {![file isdir $::protest::workspaceDirectory]} {
	    ::tcltest::PrintError "bad argument \
		    \"$::protest::workspaceDirectory\" to -ws: \
		    \"$::protest::workspaceDirectory\" is not an existing \
		    directory" 
	    exit 1
	}
	if {[string compare \
		[file pathtype $::protest::workspaceDirectory] \
		"absolute"] != 0} { 
	    set ::protest::workspaceDirectory [file join [pwd] \
		    $::protest::workspaceDirectory] 
	}
    } else {
	set oDir [pwd]
	cd [file join [file dirname [info script]] .. ..]
	set ::protest::workspaceDirectory [pwd]
	cd $oDir
    }

    # Set the ::protest::sourceDirectory to the arg of -srcsdir, if
    # given, or <::protest::workspaceDirectory>/pro/srcs 
    # 
    # If the path is relative, make it absolute.  If the file is not an
    # existing dir, then return an error.

    if {[info exists flag(-srcsdir)]} {
	set ::protest::sourceDirectory $flag(-srcsdir)
	if {[string compare \
		[file pathtype $::protest::sourceDirectory] \
		"absolute"] != 0} { 
	    set ::protest::sourceDirectory [file join [pwd] \
		    $::protest::sourceDirectory] 
	}
	if {![file isdir $::protest::sourceDirectory]} {
	    ::tcltest::PrintError "bad argument \"$flag(-srcsdir)\" to \
		    -srcsdir: \"$::protest::sourceDirectory\" is not \
		    an existing directory" 
	    exit 1
	}
    } else {
	set oDir [pwd]
	cd $::tcltest::testsDirectory
	cd ..
	set ::protest::sourceDirectory [pwd]
	cd $oDir
    }

    # Set the ::protest::executableDirectory the arg of -exedir, if given; 
    # otherwise, if -install is specified, use
    # ::protest::installationDirectory/::protest::platform/bin 
    # else use
    # ::protest::workspaceDirectory/pro/out/<-build>/::protest::platform/bin  
    # -build arg defaults to "Debug"
    #
    # If the path is relative, make it absolute.  If the file is not an
    # existing dir, then return an error.

    if {[info exists flag(-exedir)]} {
	set ::protest::executableDirectory $flag(-exedir)
	if {![file isdir $::protest::executableDirectory]} {
	    ::tcltest::PrintError "bad argument \"$flag(-exedir)\" to \
		    -exedir: \"$::protest::executableDirectory\" is \
		    not an existing directory" 
	    exit 1
	}
    } else {
	set ::protest::executableDirectory [file dirname \
		[info nameofexecutable]]
    }

    if {[string compare \
	    [file pathtype $::protest::executableDirectory] \
	    "absolute"] != 0} { 
	set ::protest::executableDirectory [file join [pwd] \
		$::protest::executableDirectory] 
    }

    # Store the arg of -license, if specified, in ::protest::license.

    if {[info exists flag(-license)]} {
	set ::protest::license $flag(-license)
    } 

    # Set the ::tcltest::tclDirectory to
    # <::protest::workspaceDirectory>/tcl<currentVersion(Tcl)> 
    # Set the ::tcltest::tkDirectory to
    # <::protest::workspaceDirectory>/tk<currentVersion(Tk)> 

    if {[file exists [file join $::protest::workspaceDirectory \
	    "tcl$::protest::currentVersion(Tcl-patch)"]]} {
	set ::protest::tclDirectory [file join \
		$::protest::workspaceDirectory \
		"tcl$::protest::currentVersion(Tcl-patch)"]
    } elseif {[file exists [file join $::protest::workspaceDirectory \
	    "tcl$::protest::currentVersion(Tcl)"]]} {
	set ::protest::tclDirectory [file join \
		$::protest::workspaceDirectory \
		"tcl$::protest::currentVersion(Tcl)"]
    } else {
	set ::protest::tclDirectory [file join \
		$::protest::workspaceDirectory "tcl"]
    }
    
    if {[file exists [file join $::protest::workspaceDirectory \
	    "tk$::protest::currentVersion(Tk-patch)"]]} {
	set ::protest::tkDirectory [file join \
		$::protest::workspaceDirectory \
		"tk$::protest::currentVersion(Tk-patch)"]
    } elseif {[file exists [file join $::protest::workspaceDirectory \
	    "tk$::protest::currentVersion(Tk)"]]} {
	set ::protest::tkDirectory [file join \
		$::protest::workspaceDirectory \
		"tk$::protest::currentVersion(Tk)"]
    } else {
	set ::protest::tkDirectory [file join \
		$::protest::workspaceDirectory "tk"]
    }
    
    # Set the ::protest::toolsDirectory to 
    #   //pop/tools/<currentVersion(Tools)>/<::protest::platform>/<bin>  
    # or
    #   /tools/<::protest::currentVersion(Tools)>/<::protest::platform>/<bin> 
    # depending on whether ::protest::platform is windows of unix

    if {[info exists flag(-toolsdir)]} {
	if {[file isdirectory $flag(-toolsdir)]} {
	    set ::protest::toolsDirectory [file join \
		    $flag(-toolsdir) $::protest::currentVersion(Tools) \
		    ${::protest::platform} bin]
	} else {
	    ::tcltest::PrintError "location specified for -toolsdir is not a \
		    directory: $flag(-toolsdir)"
	    exit 1
	}
    } elseif {[info exists env(TOOLS_DIR)]} {
	if {[file isdirectory $env(TOOLS_DIR)]} {
	    set ::protest::toolsDirectory [file join \
		    $env(TOOLS_DIR) $::protest::currentVersion(Tools) \
		    ${::protest::platform} bin]
	} else {
	    ::tcltest::PrintError "location specified for -toolsdir is not a \
		    directory: $env(TOOLS_DIR)"
	    exit 1
	}
    } else {
	if {$tcl_platform(platform) == "windows"} {
	    set ::protest::toolsDirectory \
		    //pop/tools/$::protest::currentVersion(Tools)/${::protest::platform}/bin 
	} else {
	    set ::protest::toolsDirectory \
		    /tools/$::protest::currentVersion(Tools)/${::protest::platform}/bin 
	}
    }

    if {![info exists flag(-tmpdir)]} {
	# reset the default output directory to
	# ./testOutputDir/platform-date-time-pid
#    set temporarySubDirectory $::protest::platform
#    append temporarySubDirectory \
#	    [clock format [clock seconds] -format {-%d%b%y-%H%M%S-}] [pid]
#    set ::tcltest::temporaryDirectory [file join [pwd] testOutputDir \
#	    $temporarySubDirectory]
	set ::tcltest::temporaryDirectory [file join \
		$::tcltest::workingDirectory testOutputDir]
	if {[file exists $::tcltest::temporaryDirectory]} {
	    if {![file isdir $::tcltest::temporaryDirectory]} { 
		::tcltest::PrintError "$tmpDirError \"$::tcltest::temporaryDirectory\" \
			is not a directory"
		exit 1
	    } elseif {![file writable $::tcltest::temporaryDirectory]} {
		::tcltest::PrintError "$tmpDirError \"$::tcltest::temporaryDirectory\" \
			is not writeable" 
		exit 1
	    } elseif {![file readable $::tcltest::temporaryDirectory]} {
		::tcltest::PrintError "$tmpDirError \"$::tcltest::temporaryDirectory\" \
			is not readable" 
		exit 1
	    }
	} else {
	    file mkdir $::tcltest::temporaryDirectory
	}
    }

    set ::tcltest::preserveCore 2

    # Create an unwrapped executable in ::tcltest::temporaryDirectory for
    # this tool.  The unwrapped executable file will source the
    # appropriate sources in ::protest::sourceDirectory. 

    set interp [info nameofexecutable]
    set tool [file tail $::protest::sourceDirectory]

    set exe $::projectInfo::executable($tool)
    set ::protest::interpreterDirectory [file join \
	    $::tcltest::temporaryDirectory bin]
    if {![file isdir $::protest::interpreterDirectory]} {
	file mkdir $::protest::interpreterDirectory
    }
    set exeFullPath [file join $::protest::interpreterDirectory $exe]
    if {[string equal $tcl_platform(platform) "windows"]} {
	# Windows file needs .bat extension
 	
	set tclScript "$exeFullPath.tcl"
 	append exeFullPath ".bat"
    }
    if {[string equal $tcl_platform(platform) "windows"]} {
	set fd [open $exeFullPath w]
	puts $fd [list $interp $tclScript "%*"]
	set fd2 [open $tclScript w]
	close $fd
	puts $fd2 "cd $::protest::sourceDirectory"
	puts $fd2 "source [file join $::tcltest::testsDirectory startup.tcl]"
	close $fd2
    } else {
	set fd [open $exeFullPath w]
	puts $fd "\#!$interp"
	puts $fd "cd $::protest::sourceDirectory"
	puts $fd "source [file join $::tcltest::testsDirectory startup.tcl]"
	close $fd
    }

    if {[string equal $tcl_platform(platform) "unix"]} {
	# Unix files need executable permissions
	
	file attrib $exeFullPath -permissions 0777
    }

    if {[info exists flag(-srcsdir)]} {
	set ::protest::executableDirectory $::protest::interpreterDirectory
    }

    if {$::tcltest::debug > 1} {
	puts "::protest::installationDirectory = $::protest::installationDirectory"
	puts "::protest::workspaceDirectory = $::protest::workspaceDirectory"
	puts "::protest::executableDirectory = $::protest::executableDirectory"
	puts "::protest::sourceDirectory = $::protest::sourceDirectory"
	puts "::protest::tclDirectory = $::protest::tclDirectory"
	puts "::protest::tkDirectory = $::protest::tkDirectory"
	puts "::protest::toolsDirectory = $::protest::toolsDirectory"
	puts "::tcltest::testsDirectory = $::tcltest::testsDirectory"
	puts "::tcltest::temporaryDirectory = $::tcltest::temporaryDirectory"
    }

    # Set the DISPLAY environment variable if it doesn't already exist.
    if {$tcl_platform(platform) == "unix" && ![info exists ::env(DISPLAY)]} {
	set ::env(DISPLAY) weasel:0.0
    }

    # The following section of code was lifted from license/lic.test.
    
    # Ensure the tables are loaded
    if {0} {
	source [file join $::protest::sourceDirectory \
		util version.tcl]
	lappend auto_path [file join \
		$::protest::sourceDirectory license]
	lappend auto_path [file join \
		$::protest::sourceDirectory util]
	
	if {![catch {package require licdata 2.0} msg]} {

	    # This sets the registry location of the key, if any
	    licdata::init 1.2
	    
	    # Key generation
	    package require licgen 1.1
	    auto_load licgen::genkey
	    
	    # Key verification
	    foreach file [list licio.tcl licparse.tcl] {
		source [file join $::protest::sourceDirectory util $file]
	    }
	    
	    namespace eval lic {
		namespace export GetKey getServerInfo
	    }
	    
	    # License client
	    package require lclient 1.0
	    auto_load lclient::checkout
	    ::protest::saveOriginalLicense
	}
    }
    
    if {$::tcltest::debug > 1} {
	puts "::protest::platform = $::protest::platform"
	if {$tcl_platform(platform) == "unix"} {
	    puts "::env(DISPLAY) = $::env(DISPLAY)"
	}
    }
    return
}

proc ::tcltest::cleanupTestsHook {} {    
    # If running the TclPro tests, replace the current license with a permanent
    # personal-key that is valid for the current release of TclPro
    ::protest::setupValidLicense
    return
}

# ::protest::setupValidLicense --
#
#    If -license was specified, then add a named-user license for the current
#    user. 
#
# results:
#
#    A valid license exists for the current product/version

proc ::protest::setupValidLicense {} {
    global auto_path 

    if {$::protest::license == ""} {
	return
    }

    if {[catch {	
	# get a permanent key for the current version
	set newKey [licgen::genkey 1 $::projectInfo::productID \
		$::projectInfo::baseVersion 0]
	lic::savePersonalKey $newKey
	
	if {$::tcltest::debug > 2} {
	    puts "::projectInfo::productID = $::projectInfo::productID"
	    puts "adding new key = $newKey"
	}
    }]} {
	global errorInfo
	puts $::tcltest::outputChannel \
		"Error in setupValidLicense command:\n$errorInfo"
    }
}

# ::protest::restoreOriginalLicense --
#
#	Puts the licenses specifed in ::protest::savedLicenseKey and
#       ::protest::savedLicenseSever into the user's home.
#
# Results:
#	Modifies the license information for the user running the tests.

proc ::protest::restoreOriginalLicense {} {
    # Only reset the license key if we've previously saved a license key and
    # it's different from the one that is currently being used.
    if {($::protest::savedLicenseKey != {}) && \
	    (![catch {::protest::lic::GetKey} x])} {
	if {$x != $::protest::savedLicenseKey} {
	    lic::savePersonalKey $::protest::savedLicenseKey
	}
    }
    # Only reset the license server if we've previously saved a license server
    # and it's different from the one that's currently being used.
    if {($::protest::savedLicenseServer != {{} {}}) && \
	    ([set x [::protest::lic::getServerInfo]] != {})} {
	if {$x != $::protest::savedServerKey} {
	    lic::saveServerInfo [lindex $::protest::savedServerKey 0] \
		    [lindex $::protest::savedServerKey 1]
	}
    }
    return
}

# ::protest::saveOriginalLicense --
#
#	Save the original license information that was stored for the user.
#
# Results:
#	Saves license information in ::protest::savedLicenseKey
#       (personal key) and ::protest::savedLicenseServer.

proc ::protest::saveOriginalLicense {} {
	# Save the currently installed key, and host/port if any exist
	if {[catch {::protest::lic::GetKey} x]} {
	    set ::protest::savedLicenseKey {}
	} else {
	    set ::protest::savedLicenseKey $x
	} 
	if {[set x [::protest::lic::getServerInfo]] == {}} {
	    set ::protest::savedLicenseServer {{} {}}
	} else {
	    set ::protest::savedLicenseServer $x
	}
	return
}

# ::protest::testAllFiles --
#
#    Instead of repeating the same code for each <tool>/all.tcl file,
#    those files now invoke this procedure.  When running tests in a Tk
#    shell, output of subprocesses must be directed to a temporary
#    log file, as wish does not have access to stdout.
#
# args:
#
#    tool      Name of the dir containing the tests to run (e.g. util)
#    interp    Interp in which to run all <tool>/*.test files.
#
# results:
#
#    Files matching <tool>/*.test are run in the <interp>.  The results of the
#    tests are output to ::tcltest::outputChannel. This proc has no return value.

proc ::protest::testAllFiles {tool interp} {
    global argv

    set shell [::protest::findExeFile $interp 1]

    # We need to pass the values that were set in the top-level test file (and
    # the command line) down into the sub-interpreters. We need to reconstruct
    # the argument list because variable values could have been reset without
    # using command line flags.
    
    set flags [list -tmpdir $::tcltest::temporaryDirectory \
	    -ws $::protest::workspaceDirectory]

    # Run each matching file in the selected shell

    set testList [::tcltest::getMatchingFiles $::tcltest::testsDirectory]

    # The results of each test file are printed out separately.  Initialize
    # the sum of all of the individual test results so that we can print out
    # a summary of all the tests at the end.

    foreach index [list "Total" "Passed" "Skipped" "Failed"] {
	set ::tcltest::numTests($index) 0
    }
    set ::tcltest::failFiles {}

    foreach file [lsort $testList] {

	set tail [file tail $file]
	puts $::tcltest::outputChannel $tail

	set logfile [file join $::tcltest::temporaryDirectory \
		"${tool}Log.txt"] 
    
	# Run each *.test file in the selected Tk shell.
	# This is used for parser and debugger tests on Windows...

	# Direct the output individual test files to a temporary log file.
	# Note that shell and file can have spaces in their names, and
	# argv can have spaces in individual elements.

	set cmd [concat [list | $shell $file] $argv [list -outfile \
		$logfile] $flags] 

	if {$::tcltest::debug > 2} {
	    puts "Command to be executed: $cmd"
	}

	if {[catch {
	    set pipeFd [open $cmd "r"]
	    while {[gets $pipeFd line] >= 0} {
		puts $::tcltest::outputChannel $line
	    }
	    close $pipeFd
	} msg]} {
	    # Print results to ::tcltest::outputChannel.
	    puts $::tcltest::outputChannel $msg
	}

	# Now concatenate the temporary log file to
	# ::tcltest::outputChannel 

	if {[catch {
	    set fd [open $logfile "r"]
	    while {![eof $fd]} {
		gets $fd line
		if {![eof $fd]} {
		    if {[regexp {^([^:]+):\tTotal\t([0-9]+)\tPassed\t([0-9]+)\tSkipped\t([0-9]+)\tFailed\t([0-9]+)} $line null testFile Total Passed Skipped Failed]} {
			foreach index [list "Total" "Passed" "Skipped" \
				"Failed"] {
			    incr ::tcltest::numTests($index) [set $index]
			}
			incr ::tcltest::numTestFiles
			if {$Failed > 0} {
			    lappend ::tcltest::failFiles $testFile
			}
		    } else {
			puts $::tcltest::outputChannel $line
		    }
		}
	    }
	    close $fd
	} msg]} {
	    puts $::tcltest::outputChannel $msg
	}
	#file delete -force $logfile
    }
}

# findExeFile --
#
#       If wrapped file exists, use it:
#          ::protest::executableDirectory/filePattern(.exe)
#       Otherwise construct it from the sources, and save it in:
#          use unwrapped ::tcltest::temporaryDirectory/filePattern(.exe)
#
#    Return the full path and name of the file or error if none exists.
#

proc ::protest::findExeFile {tool {wrapped 0}} {
    global tcl_platform flag

    if {[info exists ::projectInfo::executable($tool)]} {
	set filePattern $::projectInfo::executable($tool)
    } else {
	set filePattern $tool
    }
    if {$tcl_platform(platform) == "windows"} {
	# Windows files need .exe extensions
	set fileTail "$filePattern.exe"
	# 'd' is appended to root of Windows debug execuatbles
	set fileDebugTail "$filePattern\d.exe"
    } else {
	set fileTail $filePattern
	# 'g' is appended to root of Unix debug execuatbles
	set fileDebugTail "$filePattern\g"
    }

    # look for fileTail (and then fileDebugTail) in
    # ::protest::executableDirectory 

    foreach tail [list $fileTail $fileDebugTail] {
	set file [file join $::protest::executableDirectory $tail]
	if {[file isfile $file] && [file executable $file]} {
	    if {$::tcltest::debug > 2} {
		puts "wrapped $filePattern --> $file"
	    }
	    return "$file"
	}
    }
    
    # Use the unwrapped stuff built in the interp directory if it exists

    set file [file join $::protest::interpreterDirectory $fileTail]
    if {[file isfile $file] && [file executable $file]} {
	if {$::tcltest::debug > 2} {
	    puts "unwrapped $filePattern --> $file"
	}
	if {$tcl_platform(platform) == "windows"} {
	    regsub {exe$} $file bat file
	}
	return "$file"
    }
	
    ::tcltest::PrintError "Cannot find executable files \"$fileTail\" (or \
	    \"$fileDebugTail\") in $::protest::executableDirectory\
	    \nor in $::protest::interpreterDirectory."
}

proc ::protest::findSoFile {ext index} {
    global tcl_platform 

    if {$tcl_platform(platform) == "windows"} {
	regsub -all {\.} $::protest::currentVersion($index) "" vers
	return [file join $::protest::executableDirectory $ext$vers.dll]
    } else {
	if {$tcl_platform(os) == "HP-UX"} {
	    set tail "sl"
	} else {
	    set tail "so"
	}
	set vers $::protest::currentVersion($index)
	return [file join \
		[file dirname $::protest::executableDirectory] \
		lib lib$ext$vers.$tail] 
    }
}

# ::protest::getMatchingDirectories --
#
#	Looks at the patterns given to match and skip directories and uses them
#       to put together a list of the test directories that we should attempt
#       to run.  (Only subdirectories containing an "all.tcl" file are put into
#       the list.)
#
# Arguments:
#	none
#
# Results:
#	The constructed list is returned to the user.  This is used in the
#       primary all.tcl file.  Lower-level all.tcl files should use the
#       ::protest::testAllFiles proc instead.

proc ::protest::getMatchingDirectories {} {
    set matchingDirs {}
    set matchDirList {}
    # Find the matching directories in ::tcltest::testsDirectory and then
    # remove the ones that match the skip pattern
    foreach match $::protest::matchDirectories {
	foreach file [glob -nocomplain [file join $::tcltest::testsDirectory \
		$match]] {
	    if {([file isdirectory $file]) && \
		    ([file exists [file join $file all.tcl]])} {
		set matchDirList [concat $matchDirList $file]
	    }
	}
    }
    if {$::protest::skipDirectories != {}} {
	set skipDirs {} 
	foreach skip $::protest::skipDirectories {
	    set skipDirs [concat $skipDirs \
		    [glob -nocomplain [file join $::tcltest::testsDirectory \
		    $skip]]]
	}
	foreach dir $matchDirList {
	    # Only include directories that don't match the skip pattern
	    if {[lsearch -exact $skipDirs $dir] == -1} {
		lappend matchingDirs $dir
	    }
	}
    } else {
	set matchingDirs [concat $matchingDirs $matchDirList]
    }
    if {$matchingDirs == {}} {
	::tcltest::PrintError "No test directories remain after applying your \
		match and skip patterns!"
    }
    return $matchingDirs
}

proc ::protest::resetTestsDirectory {dir} {
    set ::tcltest::testsDirectory $dir
    set oDir [pwd]
    if {[file tail $::tcltest::testsDirectory] == "tests"} {
	cd [file join $::tcltest::testsDirectory .. ..]
    } else {
	cd [file join $::tcltest::testsDirectory .. .. ..]
    }
    set ::protest::workspaceDirectory [pwd]
    cd $oDir
    set ::protest::sourceDirectory [file join \
	    $::protest::workspaceDirectory tclchecker] 
    if {$::protest::installationDirectory == ""} {
	set ::protest::executableDirectory [file join \
		$::protest::workspaceDirectory pro out \
		$::protest::buildType $::protest::platform \
		bin] 
	if {![file isdir $::protest::executableDirectory]} {
	    ::tcltest::PrintError "bad argument \
		    \"$::protest::buildType\" to -build: \ 
	    \"$::protest::executableDirectory\" is not an existing \
		    directory"
	    exit 1
	}
    }
}

# Initialize the constraints and set up command line arguments 
namespace eval protest {
    ::tcltest::initConstraints
    ::tcltest::processCmdLineArgs
}

return
