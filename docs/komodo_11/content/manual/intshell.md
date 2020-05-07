---
title: Interactive shell
---
(Komodo IDE only)

Komodo's interactive shell implements individual language shells within Komodo. Shells are used to directly communicate with the specified language interpreter.

Statements, expressions, and code fragments can be entered independent of program files. The shell can be used as a stand-alone interactive tool or as a shell that interacts from within a debugging session.

<a name="intshell_standalone" id="intshell_standalone"></a>
## Stand-Alone Interactive Shell

When the interactive shell is [started](#starting_shell) as a stand-alone tool, use the shell to help test modules and experiment with new languages or programs. Other uses for a stand-alone interactive shell include:

- prototyping code
- identifying bugs
- experimenting with a library
- programming interactively
- learning new syntax

The interactive shell supports [history recall](#history), [AutoComplete and CallTips](#code_completion) (Tcl only), and [custom colors and fonts](#custom_colors).

<a name="intshell_debug" id="intshell_debug"></a>
## Debugging with an Interactive Shell

When the interactive shell is [started](#starting_shell) from within a debug session, use the shell to access all functions and code being debugged. When the shell is closed from within a debug session, continue the debug process where you left off. Depending on the language used, changes made in the shell remain in effect for the duration of the debug session. Other uses for an interactive shell within a debug session include:

- exploring and debugging a program
- adding new code to the program being debugged (language-dependent)
- modifying existing variables using complex expressions
- adding new variables with code

The interactive shell supports [history recall](#history), [AutoComplete and CallTips](#code_completion) (Tcl only), and [custom colors and fonts](#custom_colors).

<a name="using_interactive_shell" id="using_interactive_shell"></a>
## Using the Interactive Shell

Each Komodo interactive shell is associated with a corresponding interpreter and is thus language-specific. Each time a command or multi-line string is entered into the Shell tab, that code is sent to the corresponding interpreter for evaluation. The interpreter evaluates the command, and then returns output and error text.

<a name="intshell_prefs" id="intshell_prefs"></a>
### Setting Shell Preferences

Use the Preferences dialog box to specify the default language to use within an interactive shell. Other shells can still be accessed via **Tools** > **Interactive Shell**.

To set the default shell preference:

1.  Select **Tools** > **Interactive Shell** > **Configure**
1.  On the **Preferred Interactive Shell** drop-down list, select the desired language (Python, Perl, Tcl).
1.  Click **OK**.

<a name="starting_shell" id="starting_shell"></a>
### Starting the Interactive Shell

The interactive shell can be opened as a stand-alone tool or as a shell inside of a debugging session.

To start the shell as a stand-alone tool:

- Select **Tools** > **Interactive Shell**, and then select the desired language (Python, Tcl, Perl, or Ruby). Alternatively, click the down arrow for the **Shell** button on the Workspace toolbar and select the desired language.

The interactive shell opens in a Shell tab in the Bottom Pane beside the [Command Output](debugger.html#output_tab) and [Breakpoint](debugger.html#breakpoints_and_spawnpoints) tabs.

To start the shell from within a debug session:

- On the active **Debug** tab, click the **Inspect** (**>>**) button on the Debug toolbar, or select **Debug> Inspect**. The **Debug** tab toggles to a Shell tab. Enter code as desired. To toggle back to the **Debug** tab, click the **Inspect** button on the Debug Toolbar.

View debugging and code inspection functions by clicking the "Collapse/Expand Pane" button at the left side of the Bottom Pane. This splits the shell into a left and right pane. The left pane performs debugging functions while the right pane contains the interactive shell.

<a name="intshell_mult" id="intshell_mult"></a>
### Using Multiple Shells

Open multiple interactive shells to interact with various code snippets from a single language or use many shells to simultaneously explore a different language in each shell.

<a name="code_completion" id="code_completion"></a>
### Using AutoComplete and CallTips

The Tcl interactive shell displays [AutoComplete and CallTips](editor.html#AutoComplete) when recognized code and commands are entered into the shell. Use autocomplete and calltips to limit the amount of typing in each session. To select a suggested item, press **Enter**. Use the up and down arrow keys to scroll through the various options on the screen. To cancel or ignore the suggested autocomplete or calltip, press **Esc**.

Komodo can also detect when further data is required at the command prompt. When insufficient programming data is entered at the prompt, Komodo displays a language-dependent "more" prompt. This prompt indicates that the language interpreter requires more information before the code can run. Once enough data is entered, Komodo executes the code and the standard language-dependent input prompt returns.

<a name="custom_colors" id="custom_colors"></a>
### Customizing Colors and Fonts

The Shell tab displays commands, variables, error messages, and all language syntax in the same scheme as specified in **Edit** > **Preferences** > **Fonts and Colors**. See [Customizing Fonts and Colors](prefs.html#Customizing_Fonts) for more information.

<a name="history" id="history"></a>
### Viewing Shell History

The code history consists of the ordered, numbered sets of commands entered in the lifetime of the shell, including interleaved output and error messages. Use the up and down arrow keys to cycle through the history of all entered commands. When viewing a multi-line command or function, use the 'Enter' key to select the desired function and then use the arrow keys to cycle through the multiple lines within that function.

<a name="intshell_stop" id="intshell_stop"></a>
### Stopping a Shell Session

To stop an interactive shell session and close the Shell tab, click the **X** button located in the upper-right corner of the Shell tab. To stop the interactive shell and keep the Shell tab open, click the square button, or use the associated [key binding](prefs.html#Config_Key_Bindings).

<a name="intshell_clear" id="intshell_clear"></a>
### Clearing the Shell Buffer

To clear the shell buffer, click the **Clear Buffer** button. There is no limit to buffer size; unless it is manually cleared, the buffer will continue to increment until the interactive shell session is closed. Manually clearing the buffer only removes the command history and command results, and has no effect on the buffer state (such as changes to the working directory, etc).

<a name="intshell_python" id="intshell_python"></a>
## Using the Python Interactive Shell

The Python shell prompt is a group of three angle brackets **>>>**. A **...** prompt is displayed if Komodo determines that more information is required before the code can execute. A '%' prompt is displayed when input from `stdin` is required (for example, in a Python shell, enter `help()`). No prompt is displayed when program output is sent to the screen. Code errors are displayed in italics. When a Python interactive shell session begins, a welcome message is printed stating a version number and copyright notice. The first prompt is printed as follows:

```bash
Python 2.7.3 (#37, Jan 01 2012, 13:15:27) [MSC 32 bit (Intel)] on win32
Type "copyright", "credits" or "license" for more information.
>>>
```

The following example shows a series of Python statements with resulting output:

```bash
>>> # Comment: my hello world test
>>> print "Hello World"
Hello World
>>> x=12**2
>>> x/2
72
>>>
```

<a name="intshell_debugpy" id="intshell_debugpy"></a>
### Debugging with the Python Shell

To [start](#starting_shell) a Python shell from within a debug session, click the **Inspect** button, located in the upper-right corner of the **Debug** tab. Starting a shell within a debug session enables Inspect Mode. In Inspect Mode, view debugging and code inspection functions by clicking the "Collapse/Expand Pane" button at the left side of the Bottom Pane. This splits the shell into a left and right pane. The left pane performs debugging functions while the right pane contains the interactive shell. In Inspect Mode, debugging functionality (for example, Run, Step In, Step Out) is not available. To return to the debugger, click the Inspect button again to exit Inspect Mode.

<a name="intshell_tcl" id="intshell_tcl"></a>
## Using the Tcl Interactive Shell

The Tcl interactive shell supports the tclsh interpreter. The Tcl shell prompt is a percent character **%**. A **>** prompt is displayed if Komodo determines that more information is required before the code executes. A <font style="color: red">%</font> prompt is displayed when input from `stdin` is required. No prompt is displayed when program output is sent to the screen. Code errors are displayed in italics. The following examples show how input, output, and errors are displayed in the Tcl shell:

```bash
%puts "Hello World"
Hello World
%
```

With an error:

```bash
%put "hello world"
_invalid command name "put"_
%puts "hello world"
hello world
%
```

<a name="intshell_debugtcl" id="intshell_debugtcl"></a>
### Debugging with the Tcl Shell

To [start](#starting_shell) a Tcl shell from within a debug session, click the **Inspect** (**>>**)button, located in the upper-right corner of the **Debug** tab. Starting a shell within a debug session enables Inspect Mode. In Inspect Mode, view debugging and code inspection functions by clicking the "Collapse/Expand Pane" button at the left side of the Bottom Pane. This splits the shell into a left and right pane. The left pane performs debugging functions while the right pane contains the interactive shell. In Inspect Mode, debugging functionality (for example, Run, Step In, Step Out) is not available. To return to the debugger, click the Inspect button again to exit Inspect Mode.

<a name="intshell_perl" id="intshell_perl"></a>
## Using the Perl Interactive Shell

The Perl interactive shell prompt is a percent character **%**. A **>** prompt is displayed if Komodo determines that more information is required before the code executes. No prompt is displayed when program output is sent to the screen. Code errors are displayed in italics. The following examples show how input, output, and errors are displayed in the Perl shell:

```bash
%print "Hello World! \n";
Hello World!
%
```

With an error:

```bash
%prin "Hello World! \n";
_syntax error_
%print "Hello World!!! \n";
Hello World!!!
%
```

**Using Strings, Function Definitions, and Multiple Line Input**

Use the Perl shell to enter function definitions, long strings, and specify `if` and `while` blocks interactively. The Perl shell also handles multiple line input delimited by braces, curly braces, single quotes, and double quotes. The following examples demonstrate this usage.

**Example**: Using single quotes "''" to enter multiple line input.

```bash
% $b = 'abc
> def
> ghi
> jkl'
abc
def
ghi
jkl
%
```

**Example**: Using curly braces "{}" to define a function and enter multiple line input.

```bash
% sub foo {
>   my $arg = shift;
>   my $arg2 = shift;
>   return $arg + $arg2;
> }
% foo(10, 12)
22
%
```

**Example**: Using braces to enter a multiple line string.

```bash
% $name = 'Bob'
Bob
% print qq(<html><head><title>
> Browser Window Caption Text
> </title></head><body bg="white">
> <p>Welcome to my fine web site, $name
> </body>
> </html>)
<html><head><title>
Browser Window Caption Text
</title></head><body bg="white">
<p>Welcome to my fine web site, Bob
</body>
</html>
%
```

**Example**: Using a backslash to continue a statement.

```bash
% print 'abc ', 'def ', \
> 'ghi'
abc def ghi
%
```

**Example**: Using a backslash to continue a statement.

```bash
% $first_long_variable_name = 3
3
% $second_long_variable_name = 4
4
% $third_long_variable_name_to_store_result = $first_long_variable_name + \
> $second_long_variable_name
7
```

**Example**: Using a braced construct

```bash
% foreach $var (sort keys %ENV) {
>    print "$var = $ENV{$var}\n";
>    }
ALLUSERSPROFILE = C:\Documents and Settings\All Users
COMMONPROGRAMFILES = C:\Program Files\Common Files
COMSPEC = C:\winnt\system32\cmd.exe
LESS = --quit-at-eof --quit-if-one-screen --ignore-case --status-column
--hilite-unread --no-init
MSDEVDIR = C:\PROGRA~1\MICROS~3\Common\msdev98
MSVCDIR = C:\PROGRA~1\MICROS~3\VC98
NETSAMPLEPATH = C:\PROGRA~1\MICROS~1.NET\FRAMEW~1\Samples
OS = Windows_NT
OS2LIBPATH = C:\winnt\system32\os2\dll;
PATH = C:\PROGRA~1\MICROS~3\Common\msdev98\BIN;
PROCESSOR_ARCHITECTURE = x86
PROCESSOR_IDENTIFIER = x86 Family 6 Model 7 Stepping 3, GenuineIntel
PROCESSOR_LEVEL = 6
PROCESSOR_REVISION = 0703
PROGRAMFILES = C:\Program Files
PROMPT = $P$G
SYSTEMDRIVE = C:
SYSTEMROOT = C:\winnt
TEMP = C:\DOCUME~1\toto\LOCALS~1\Temp
TMP = C:\DOCUME~1\toto\LOCALS~1\Temp
USERNAME = toto
USERPROFILE = C:\Documents and Settings\toto
WINDIR = C:\winnt
```

<a name="intshell_debugperl" id="intshell_debugperl"></a>
### Debugging with the Perl Shell

To [start](#starting_shell) a Perl shell from within a debug session, click the **Inspect** button, located in the upper-right corner of the **Debug** tab. Starting a shell within a debug session enables Inspect Mode. In Inspect Mode, view debugging and code inspection functions by clicking the "Collapse/Expand Pane" button at the left side of the Bottom Pane. This splits the shell into a left and right pane. The left pane performs debugging functions while the right pane contains the interactive shell. In Inspect Mode, debugging functionality (for example, Run, Step In, Step Out) is not available. To return to the debugger, click the Inspect button again to exit Inspect Mode.

<a name="intshell_ruby" id="intshell_ruby"></a>
## Using the Ruby Interactive Shell

Starting a Ruby shell session displays the interpreter version and platform information. The standard shell prompt for entering statements is a single ">" symbol:

```bash
Ruby 1.8.6 [powerpc-darwin8.10.0]
>
```

When more information is required for execution (e.g. within any flow control construct) or when requesting user input, a "*" is displayed. No prompt is displayed when program output is sent to the screen.

```bash
> mylist = []
  []
> for x in (0..3)
-   puts "Enter a value:"
-   mylist[x] = gets.chomp!
* end
Enter a value:
*
```

Code errors are displayed in italics.

```bash
> mylist[wrong]
  undefined local variable or method `wrong' for main:Object
```

<a name="intshell_debugrb" id="intshell_debugrb"></a>
### Debugging with the Ruby Shell

To [start](#starting_shell) a Ruby shell from within a debug session, click the **Inspect** button, located in the upper-right corner of the **Debug** tab. Starting a shell within a debug session enables Inspect Mode. In Inspect Mode, view debugging and code inspection functions by clicking the "Collapse/Expand Pane" button at the left side of the Bottom Pane. This splits the shell into a left and right pane. The left pane performs debugging functions while the right pane contains the interactive shell. In Inspect Mode, debugging functionality (for example, Run, Step In, Step Out) is not available. To return to the debugger, click the Inspect button again to exit Inspect Mode.

## Related Information

- [Python Tutorial](/tutorial/pythontut.html)
- [Feature Showcase - Using the Interactive Shell](/tutorial/tourlet_intshell.html)
