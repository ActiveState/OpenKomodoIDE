#!tclsh
package require Tcl 8

# Use this sample script to explore some of Komodo's Tcl features.

# Incremental search:
#   - Use 'Ctrl'+'I' ('Cmd'+'I' on OS X) to start an incremental search.
#   - Begin typing the characters you want to find. 
#   - As you type, the cursor moves to the first match after the current
#     cursor position. Press 'Esc' to cancel.

# Code Folding:
#  - Click the "+" and "-" symbols in the left margin.
#  - Use View|Fold to collapse or expand all blocks.

# Syntax Coloring:
# - Language elements are colored according to the Fonts and Colors
#   preference.

namespace eval ::zoo {
    # Some docs about moreFeather
    proc moreFeather {} {
	# Some stuff about moreFeather
	global feather
	if {![info exists feather]} {
	    set feather 0
	} else {
	    incr feather; # default to 1
	}
	::set ::var "I'm a string"
    }
}
::zoo::moreFeather

# #if WITH_DEBUGGING
# Interactive Shell:
#   1. Select lines 14 to 23, and then press 'Ctrl'+'C'.
#   2. Select Tools|Interactive Shell|Start New Tcl Shell.
#   3. Press 'Ctrl'+'V'.
#   4. Press 'Enter'. The output is displayed in the Tcl Shell beneath
#      the code snippet.
# #endif

# Background Syntax Checking:
#   - Syntax errors are underlined in red.
#   - Syntax warnings are underlined in green.
#   - Configure Tcl Preferences to customize errors and warnings.
#   - Position the cursor over the underline to view the error or warning
#     message.
set val [expr $feather + 5]; 

# AutoComplete:
#   - On a blank line below, enter "str".
#   - Methods beginning with "str" are displayed.
#   - Press 'Tab' to insert the selected method.

#---- Abbreviations:
#     - Snippets from the Abbreviations folder in projects and toolboxes
#       can be inserted by typing the snippet name followed by
#       'Ctrl'+'T' ('Cmd'+'T' on OS X). The Samples folder in the
#       Toolbox contains some default abbreviation snippets to get you
#       started.
#    
#     Try this below with the 'for' Tcl snippet. An empty for loop
#     is created with "Tabstop" placeholders for the start condition,
#     test, next command and body code.

# CallTips
#   - On a blank line below, enter "if", and then press the space bar.
#   - The space triggers an argument reference for "if".


# #if WITH_DEBUGGING
# Debugging:
#   1. Set a breakpoint by clicking the left margin on line 23 ("moreFeather").
#   2. Press 'F5' to invoke the debugger; click "OK" to accept the default.
#   3. Press 'F11' to step into "moreFeather".
#   4. View variables and output on the Debug tab.
#   5. See the "Debug" menu for additional debug commands.
#   6. Press 'Shift'+'F5' to stop.

proc sum {values} {
    ::zoo::moreFeather
    set sum [expr {$::feather + 2}]
    foreach val $values {
	incr sum $val
	puts "The sum is now $sum"
    }
    puts "The final sum is $sum"
}
set values [list 5 7 10 15]
sum $values
# #endif

# #if WITH_CODE_BROWSER
# Code Browsing:
#   1. If necesssary, enable Komodo's code intelligence (Edit|Preferences|Code Intelligence).
#   2. Select View|Tabs|Code Browser.
#   3. On the Code tab, click the plus sign next to "tcl_sample.tcl".
#   4. If necessary, display the Code Description pane by clicking the
#      "Show/Hide Description" button at the bottom of the Code Browser.
#   5. Select "moreFeather". The Code Description pane indicates that the file
#      contains one procedure, moreFeather {}.
# #endif

# More:
#   - Press 'F1' to view the Komodo User Guide.
#   - Select Help|Tutorial|Tcl Tutorial for more about Komodo and Tcl.

