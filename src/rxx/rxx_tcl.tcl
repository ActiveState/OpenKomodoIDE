#!/usr/bin/env tclsh

set thisDir [file dirname [file normalize $argv0]]
set tclLibDir [file join $thisDir tcl lib]
source [file join $tclLibDir json.tcl]
source [file join $tclLibDir json_write.tcl]

proc json_escape_string value {
    # See http://rosettacode.org/wiki/JSON#Tcl for where this comes from
    # I don't fully understand this, but all special tcl-chars have to be
    # url-encoded in order for subst to work.
    set quotes [list "\"" "\\\""]
    # Backslash-handling is so borken: scan {&} is treated like
    # {<bs>} when processing <bs> and triggers a "missing close brace error"
    #
    set value1 [string map [list "@" "<@@>"] $value]
    set value2 [string map [list "\\" "<@>"] $value1]
    set escaped1 [subst  \
                      [regsub -all {[\[\]\$\u0000-\u001f\u0080-\uffff]} \
                   $value2 {[format "\\\\u%04x" [scan {&} %c]]}]]
    set escaped2 [string map [list "<@>" [format "\\u%04x" [scan \\ %c]]] $escaped1]
    set escaped3 [string map [list "<@@>" "@"] $escaped2]
    # Bug 102789: We can't u-escape the braces using that subst/regsub/format/scan
    # incantation -- it u-escapes the first, and removes the rest.
    set escaped4 [string map [list "{" "\\u007b" "}" "\\u007d"] $escaped3]
    return "\"[::string map $quotes $escaped4]\""
}

proc atUnescape {s} {
    return [string map { @b \\ @c \[ @d \] @e \{ @f \} @g \$ @q \" @@ @ } $s]
}

proc atEscape {s} {
    return [string map { \\ @b \[ @c \] @d \{ @e \} @f \$ @g \" @q @ @@ } $s]
}

proc do_single_match {ptn subject options offset newOffset newGroups retArray} {
    set firstPart [concat [list regexp -indices] $options]
    lappend firstPart $ptn
    lappend firstPart $subject
    lappend firstPart m
    set mNames [list]
    set numParens [string length [regsub  -all {[^\(]} $ptn ""]]
    set i 1
    upvar 1 $retArray ret
    while {$i <= $numParens} {
        lappend mNames m$i
        incr i
    }
    if {[catch {eval $firstPart $mNames} result]} {
        set ret(status) [::json::write string matchError]
        set ret(lastNumGroups) 0
        set ret(exception) [json_escape_string $result]
        #puts stderr "do_single_match matchError: $result"
        return 0
    } elseif {!$result} {
        #puts stderr "do_single_match matchFailure, ptn:$ptn, subject:$subject"
        set ret(status) [::json::write string matchFailure]
        set ret(lastNumGroups) 0
        return 0
    }
    # Where do the groups actually end?
    set i $numParens
    set lastSetGroup 0
    while {$i >= 1} {
        upvar 0 [lindex $mNames [expr {$i - 1}]] mRange
        if {[lindex $mRange 0] >= 0 && [lindex $mRange 1] >= 0} {
            set lastSetGroup $i
            break;
        }
        incr i -1
    }
    # Return arrays and lists, keep it simple
    set group(name) null
    set group(value) [json_escape_string [string range $subject [lindex $m 0] [lindex $m 1]]]
    set group(span) [::json::write array {*}[list [expr {[lindex $m 0] + $offset}] [expr {[lindex $m 1] + $offset + 1}]]]

    set jg [::json::write object {*}[array get group]]
    set groups [list $jg]

    set i 1
    while {$i <= $lastSetGroup} {
        set group(name) null
        upvar 0 m$i mvar
        set group(value) [json_escape_string [string range $subject [lindex $mvar 0] [lindex $mvar 1]]]
        set group(span) [::json::write array {*}[list [expr {[lindex $mvar 0]  + $offset}] [expr {[lindex $mvar 1] + $offset + 1}]]]
        set jg [::json::write object {*}[array get group]]
        lappend groups $jg
        incr i
    }
    upvar 1 $newOffset outNewOffset
    set outNewOffset [expr {[lindex $m 1] + 1}]

    upvar 1 $newGroups outInnerGroups
    set outInnerGroups $groups
    
    set ret(lastNumGroups) $lastSetGroup
    return 1
}

proc do_match {ptn subject replace options retArray} {
    set res [do_single_match $ptn $subject $options 0 newOffsetNOTUSED innerGroups innerStatusInfo]
    upvar 1 $retArray ret
    if {$res == 0} {
        set ret(status) $innerStatusInfo(status) ;#pass on
        if { [info exists innerStatusInfo(exception)] } {
            set ret(exception) $innerStatusInfo(exception)
        }
        return 0
    }
    set ret(status) [::json::write string ok]
    set ret(result) [::json::write array [::json::write array {*}$innerGroups]]
    set ret(lastNumGroups) $innerStatusInfo(lastNumGroups)
    return 1
}

proc do_matchAll {ptn subject replace options retArray} {
    set offset 0
    upvar 1 $retArray ret
    set offset 0
    set outerGroups [list]
    set mostRecentLastNumGroups 0
    while {1} {
        set innerResult [do_single_match $ptn [string range $subject $offset end] $options $offset newOffset innerGroups innerStatusInfo]
        if {$innerResult == 0} {
            break
        }
        incr offset $newOffset
        lappend outerGroups [::json::write array {*}$innerGroups]
        set mostRecentLastNumGroups $innerStatusInfo(lastNumGroups)
    }
    set ret(status) [::json::write string ok]
    set ret(result) [::json::write array {*}$outerGroups]
    set ret(lastNumGroups) $mostRecentLastNumGroups
}

proc do_replace_helper {ptn subject replacement options retArray} {
    upvar 1 $retArray innerStatusInfo
    set cmd [concat regsub $options [regProtect $ptn] [regProtect $subject] [regProtect $replacement]]
    #puts stderr $cmd
    if {[catch {set newStr [eval $cmd]} errorMessage]} {
        set innerStatusInfo(status)    [::json::write string matchError]
        set innerStatusInfo(exception) [json_escape_string $errorMessage]
        return 0
    }
    set innerStatusInfo(replacedText) [json_escape_string $newStr]
    return 1
}

proc do_replace {ptn subject replace options retArray} {
    # Do the same short-cut as in the JS module
    
    upvar 1 $retArray innerStatusInfo
    set res [do_match $ptn $subject $replace $options innerStatusInfo]
    if {$res == 0} {
        return 0
    }
    set res [do_replace_helper $ptn $subject $replace $options innerStatusInfo]
    if {$res == 0} {
        return 0
    }
    set innerStatusInfo(substitutions) [::json::write array []]
    return 1
}

proc do_replaceAll {ptn subject replace options retArray} {
    # Do the same short-cut as in the JS module
    
    upvar 1 $retArray innerStatusInfo
    do_matchAll $ptn $subject $replace $options innerStatusInfo
    set res [do_replace_helper $ptn $subject $replace [concat $options -all] innerStatusInfo]
    if {$res == 0} {
        return 0
    }
    set innerStatusInfo(substitutions) [::json::write array []]
    return 1
}

proc do_split {ptn subject replace options retArray} {
    upvar 1 $retArray innerStatusInfo
    set parts [list]
    foreach {part} [split $subject $ptn] {
        lappend parts [json_escape_string $part]
    }
    set innerStatusInfo(status) [::json::write string ok]
    set innerStatusInfo(result) [::json::write array {*}$parts]
    return 1
}

proc main {aRequestString} {
    if {![string length $aRequestString]} {
        set requestString [read stdin]
    } else {
        set requestString $aRequestString
    }
    set requestPacket [::json::json2dict $requestString]
    set op [dict get $requestPacket operation]
    set pattern [dict get $requestPacket pattern]
    set subjectText [dict get $requestPacket text]
    if {[catch {set replacement [dict get $requestPacket replacement]} unused]} {
        set replacement ""
    }
    if {[dict exists $requestPacket atEscaped]} {
        set pattern [atUnescape $pattern]
        set subjectText [atUnescape $subjectText]
        set replacement [atUnescape $replacement]
    }
    if {[catch {set options [dict get $requestPacket options]} unused]} {
        set options ""
    }
    set aOptions [list]
    if {[string first i $options] != -1} {lappend aOptions -nocase}
    if {[string first s $options] == -1} {lappend aOptions -line}
    if {[string first m $options] != -1} {lappend aOptions -lineanchor}
    if {[string first x $options] != -1} {lappend aOptions -expanded}
    set cmd do_$op
    set result [$cmd $pattern $subjectText $replacement $aOptions resultArray]
    if {0 && [catch {$cmd $pattern $subjectText $replacement $options resultArray} result]} {
        set ret(status) [::json::write string matchError]
        set ret(exception) [json_escape_string $result]
        return [::json::write object {*}[array get ret]]
    } else {
        set resultArray(operation) [::json::write string $op]
        set resultArray(lastGroupNames) [::json::write array ""]
        return [::json::write object {*}[array get resultArray]]
    }
}


proc regProtect {s} {
    if {(([string first \\ $s] >= 0 || [string first "\[" $s] >= 0 ) && [string index $s 0] != "\{" ) } {
        return "{$s}"
    } else {
        return [wsProtect $s]
    }
}

proc wsProtect {s} {
    if {[regexp "\[\\s]" $s] && [string index $s 0] != "\{"} {
        return "{$s}"
    } else {
        return $s
    }
}

# .unpack("C*").pack("U*"), # for JSON
#set packets [list {
#      "text" : "école#0",
#      "pattern" : "(\\w)(\\w)",
#      "operation" : "match",
#      "options" : "u"
#} {
#    "text" : ";!@Lang@!UTF-8! Lannng Lanng b#1",
#    "pattern" : "La(n+)g",
#    "operation" : "match",
#    "options" : "u"
#} {
#    "text" : ";!@Lang@!UTF-8! Lannng Lanng b#2",
#    "pattern" : "La(n+)(g)",
#    "operation" : "matchAll",
#    "options" : "u"
#} {
#      "text" : "école#3",
#      "pattern" : "(\\w)(\\w)",
#      "operation" : "replace",
#      "replacement" : "<<[\\2]v[\\1]>>",
#      "options" : "u"
#} {
#    "text" : ";!@Lang@!UTF-8! Lannng Lanng b#4",
#    "pattern" : "La(n+)g",
#    "operation" : "replaceAll",
#    "replacement" : "feesh26:\\1",
#    "options" : "u"
#}  {
#    "text" : ";!@Lang@!UTF-8! Lannng Lanng b#5",
#    "pattern" : " ",
#    "operation" : "split",
#    "options" : "u"
#} {
# "pattern": "(?:(?<=<)|(?<=</))\\w+(?=>)",
#    "operation": "matchAll",
#    "options": "sx",
#    "text": "<!DOCTYPE HTML PUBLIC \"-//W3C//DTD HTML 4.01Transitional//EN\"\n    \"http://www.w3.org/TR/html4/loose.dtd\">\n<html lang=\"
#en\">\n<head>\n    <title><!-- Insert your title here --></title>\n</head>\n<bod
#y>\n    \n<span class=\"linked\"\nonclick=\"ajax_take_challenge(<?=$show_challen
#ge['LifestyleSkillChallenge']['item_id']?>,<?=$show_challenge['LifestyleSkillCha
#llenge']['id']?>)\">\n?-<?=h($show_challenge['LifestyleSkillChallenge']['title']
#)?>\n</span>\n\n\n</body>\n</html>\n#6"
#} {
#    "pattern": "flip(\\w+)([^ ])",
# "operation": "matchAll",
# "options": "",
# "text": "seal flippéerok?
#have another flipped-flipboard?#7"
#}  {
#    "text" : "stuff before13:moo x55:you 99:moose #8",
#    "pattern" : "\\w+(\\d+):(\\w+)",
#    "operation" : "replace",
#    "replacement" : "<<[\\2]v[\\1]>>",
#    "options" : ""
#} {
#      "text" : "école ÇÉLÈBE#9",
#      "pattern" : "(\\w)",
#      "operation" : "match",
#      "options" : ""
#}
#]
#set s1b [atEscape {w1 on the <blah abc {} def > form}]
#set s2b [atEscape {([\w_]+) on the ([<>\\\{\\\}\w\_\s]+)\sform}]
#set s1 "\"text\" : \"$s1b\","
#set s2 "\"pattern\" : \"$s2b\","
#set s3 {"operation" : "match",}
#set s4 {"options" : "",}
#set s5 {"atEscaped" : "1"}
#lappend packets "$s1 $s2 $s3 $s4 $s5"
#foreach packet $packets {
#    set str "{$packet}"
#    set responsePacket [main $str]  ;# This has to be in json form already
#    puts stdout $responsePacket
#}

set str ""
#set str [concat "{" [lindex $packets 0] "}"]
set responsePacket [main $str]  ;# This has to be in json form already
puts stdout $responsePacket
