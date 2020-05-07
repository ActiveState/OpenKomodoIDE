---
title: Getting Started with the Sample Project
---
Komodo's sample project includes a number of programs in different languages. Use these sample programs to familiarize yourself with Komodo's functionality.
<a name="Opening_the_Sample_Project" id="Opening_the_Sample_Project"></a>
## Opening the Sample Project and Files

Select **Project > Sample Project**. The Sample Project and its associated files will display on the [Places](workspace.html#places_sidebar) sidebar.

To open a sample program, double-click the file name on the **Places** sidebar. The contents of the file will display in the [Editor Pane](workspace.html#Editor_Pane).
<a name="Editing_Sample_File" id="Editing_Sample_File"></a>
## Editing a Sample Program

Komodo includes sample programs written in Perl, PHP, Python, Ruby, Tcl, and XSLT. Each program is annotated with comments and exercises that describe Komodo's language-specific features. Open the sample programs for languages that interest you, and read the comments to explore Komodo's editing features.
<a name="Running_the_Debugger" id="Running_the_Debugger"></a>
## Debugging a Sample Program

Komodo provides debugging support for Perl, Python, PHP, Ruby, Tcl, and XSLT. Komodo works with the core language distribution for Perl, Python, PHP and Ruby to provide interpreter support. XSLT, on the other hand, is entirely self-contained. To debug the sample files for Perl, Python, PHP, Ruby and Tcl, you must configure the location of the language interpreter. See [Configuring the Perl Debugger](debugperl.html#Configuring_Perl_Debugger), [Configuring the Python Debugger](debugpython.html#Configuring_Python_Debugger), [Debugging PHP](debugphp.html#debugphp_top) [Configuring the Ruby Debugger](debugruby.html#Configure_Ruby_Debugger), or [Configuring the Tcl Debugger](debugtcl.html#Configuring_Tcl_Debugger), for instructions. Then open the sample file for the desired language, and view the comments in the "Debugging" section. General debugging functionality is discussed below.

1. **Breakpoints**: In the sample program, click on the gray margin to the immediate left of the Editor Pane. A green circle will appear, indicating that a [breakpoint](debugger.html#breakpoints_and_spawnpoints) has been set. When you run the debugger, program processing will stop at lines where breakpoints have been set.
1. **Start / Step Over / Step In**: To start [debugging](debugger.html#debugger_top), click the "Go" button on the Debug Toolbar. When debugging begins, the [Bottom Pane](workspace.html#Output_Pane) will be displayed beneath the Editor Pane in the Komodo workspace. The program will run until a breakpoint is encountered. When program execution pauses at a breakpoint, click "Step In" to move through the program in single line increments, or "Step Over" to execute the entire function (as applicable), or "Step Out" to execute the remainder of a function (as applicable).
1. **Debug Tab**: The tab labeled **Debug: <_filename_>** is displayed when debugging begins. In addition to the debug output, the [Debug tab](debugger.html#debug_session) displays the call stack, variables, and variable values.
