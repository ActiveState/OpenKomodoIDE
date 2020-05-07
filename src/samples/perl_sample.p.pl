#!/usr/bin/perl

# Use this sample script to explore some of Komodo's Perl features.

# Turn on strict mode to make Perl check for common mistakes.
use strict;

#---- Incremental search:
#    - Use 'Ctrl'+'I' ('Cmd'+'I' on OS X) to start an incremental search.
#    - Begin typing the characters you want to find. 
#    - As you type, the cursor moves to the first match after the current
#      cursor position. Press 'Esc' to cancel.

#---- Code Folding:
#    - Click the "+" and "-" symbols in the left margin.
#    - Use View|Fold to collapse or expand all blocks.

#---- Syntax Coloring:
#    - Language elements are colored according to the Fonts and Colors
#      preference.

sub fruits_i_like {
        foreach my $fruit (@_) {
                if ($fruit ne "apples") {
                        print "I like $fruit\n";
                }
        }
}

my @fruits = qw(apples pears oranges);
fruits_i_like(@fruits);

#---- Background Syntax Checking:
#     - Syntax errors are underlined in red.
#     - Syntax warnings are underlined in green.
#     - Configure Perl preferences to customize errors and warnings.
#     - Position the cursor over the underline to view the error or warning message.

"hello there";

# #if WITH_DEBUGGING
#---- Debugging:
#     1. Set a breakpoint by clicking the left margin on line 52 ("my $sum = 0;").
#     2. Press 'F5' to invoke the debugger; click "OK" to accept the default.
#     3. Press 'F11' to step into "my $sum = 0;".
#     4. View variables and output on the Debug tab.
#     5. See the "Debug" menu for additional debug commands.
#     6. Press 'Shift'+'F5' to stop.
# #endif

sub print_total {
        my $sum = 0;
        foreach my $price (@_) {
            $sum += $price;
        }
        print "The sum of the prices is $sum\n";
}
my @prices = (5.50, 6.25, 7.00, 3.15);
print_total(@prices);

#---- Autocomplete and calltips
#     - Add a 'use'-statement.
#     - Re-enter a call to "print_total()".

# #if WITH_DEBUGGING
#---- Interactive Shell:
#     1. Select lines 47 to 55, and then press 'Ctrl'+'C'.
#     2. Select Tools|Interactive Shell|Start New Perl Shell.
#     3. Press 'Ctrl'+'V'.
#     4. Press 'Enter'. The output is displayed in the Perl Shell beneath
#        the code snippet.
# #endif

# #if WITH_CODE_BROWSER
#---- Code Browsing:
#     1. If necesssary, enable Komodo's code intelligence (Edit|Preferences|Code Intelligence).
#     2. Select View|Tabs|Code Browser.
#     3. On the Code tab, click the plus sign next to "perl_sample".
#     4. If necessary, display the Code Description pane by clicking the
#        "Show/Hide Description" button at the bottom of the Code Browser.
#     5. Select "Global Variables". The global variables are displayed in the
#        Code Description pane.
# #endif

#---- Abbreviations:
#     - Snippets from the Abbreviations folder in projects and toolboxes
#       can be inserted by typing the snippet name followed by
#       'Ctrl'+'T' ('Cmd'+'T' on OS X). The Samples folder in the
#       Toolbox contains some default abbreviation snippets to get you
#       started.
#    
#     Try this below with the 'fore' Perl snippet. An empty foreach
#     block is created with "Tabstop" placeholders for the variable and
#     expression.

#    More:
#    - Press 'F1' to view the Komodo User Guide.
#    - Select Help|Tutorial|Perl Tutorial for more about Komodo and Perl.

