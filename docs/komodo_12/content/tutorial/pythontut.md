---
title: Python Tutorial
---

(Komodo IDE only)

<a name="pythontut_overview" id="pythontut_overview"></a>
## Overview

<a name="pythontut_assumptions" id="pythontut_assumptions"></a>
### Before you begin

This tutorial assumes:

- [Python](http://www.activestate.com/activepython) is installed on your system. ActivePython is a free distribution of the Python language. See the [Debugging Python](/manual/debugpython.html#debugpython_top) documentation for configuration instructions.
- You are interested in learning about Komodo functionality, including the debugger and the interactive shell.
- You are interested in Python and have some programming experience either in Python or another language.

<a name="pythontut_scenario" id="pythontut_scenario"></a>
### Python Tutorial Scenario

The Python Tutorial demonstrates how to use the Komodo debugger and interactive shell to explore a Python program. In particular, this tutorial examines a Python script that preprocesses files (similar to the C preprocessor). In this tutorial you will:

1.  [**Open the Python Tutorial Project**](#pythontut_open).
1.  [**Analyze preprocess.py**](#pythontut_analyze_preprocess) the Python program included in the Tutorial Project.
1.  [**Analyze contenttype.py**](#pythontut_analyze_contenttype) the Python module included in the Tutorial Project.
1.  [**Run the program**](#pythontut_run) and generate program output.
1.  [**Debug the program**](#pythontut_debug) using the Komodo debugger.
1.  [**Explore Python**](#pythontut_interactive_shell) using the Komodo interactive shell.

See [Interactive Shell](/manual/intshell.html#intshell_top) and [Debugging Programs](/manual/debugger.html#debugger_top) for more information on this Komodo functionality.

<a name="pythontut_open" id="pythontut_open"></a>
## Opening the Tutorial Project

Select **Help** > **Tutorials** > **Python Tutorial**.

The tutorial project will open in the [Places sidebar](/manual/workspace.html#places_sidebar).

<a name="pythontut_analyzefiles" id="pythontut_analyzefiles"></a>
### Overview of the Tutorial Files

The following components are included in the Python tutorial project file:

- **preprocess.py**: The main program. This Python program parses input source files and produces output filtered on a set of rules and statements embedded in the original input source.
- **preprocess current file**: A run command for executing `preprocess.py` on the file currently open in Komodo.
- **contenttype.py**: A Python module used by the main program (`preprocess.py`) to identify the language of a given file.
- **content.types**: A support file used by the Python module `contenttype.py`.
- **helloworld** and **helloworld.py**: Sample files to process using `preprocess.py`.

<a name="pythontut_openfile" id="pythontut_openfile"></a>
### Open the Python Tutorial File

In the [Places sidebar](/manual/workspace.html#places_sidebar), double-click the `preprocess.py` file. This file opens in the Editor pane, and a tab at the top of the pane displays the filename.

<a name="pythontut_analyze" id="pythontut_analyze"></a>
## Analyzing the Python Files

This section reviews the code in [preprocess.py](#pythontut_analyze_preprocess) and [contenttype.py](#pythontut_setup_module).

<a name="pythontut_analyze_preprocess" id="pythontut_analyze_preprocess"></a>
### Analyzing preprocess.py

In this step, you will analyze the Python program `preprocess.py` in sections. This program is an advanced Python script that is best addressed by focusing on certain areas within the code. Be sure that line numbers are enabled in Komodo (**View** > **View Line Numbers**) and that `preprocess.py` is displayed in the Komodo Editor.

**About Preprocessors**: A preprocessor is a program that examines a file for specific statements called "directive statements". These directive statements are interpreted, and the resulting program output is conditional based on those statements. In languages like C/C++, preprocessing is a common step applied to source files before compilation. The Python `preprocess.py` program mimics a C/C++ preprocessor using similar directive statements.

**About Directive Statements**: Preprocessor directive statements are dependent on the preprocessor program they are used within. In the `preprocess.py` program, a directive is preceded with a pound sign (#), and is located alone on a line of code. Placing a directive on a unique line ensures the statement is included in a file without breaking file syntax rules. Valid `preprocess.py` directives include:

```
    #define <var>[=<value>]
    #undef <var>
    #if <expr>
    #elif <expr>
    #else
    #endif
    #error <error string>
```

<a name="pythontut_setup_program" id="pythontut_setup_program"></a>
### Setting Up the preprocess.py program

**Tip**: Syntax elements are displayed in different colors. You can adjust the display options for language elements in the [Preferences](/manual/prefs.html) dialog box.

#### Lines 3 to 57 - Defining a Module Docstring

- Help is defined in a module docstring
- Docstrings are contained in triple-quoted strings (""")

**Tip**: See [Explore Python with the Interactive Shell](#pythontut_interactive_shell) to examine these docstrings, and other Python elements, using the Komodo interactive shell.

**Tip**: Click on the minus symbol to the left of line 3. The entire section of nested help code is collapsed. This is called [Code Folding](/manual/editor.html#Folding).

#### Lines 59 to 65 - Importing Standard Python Modules

- Imports the following seven modules:
    - **os**: operating system- dependent helper routines
    - **sys**: functions for interacting with the Python interpreter
    - **getopt**: parses command line options
    - **types**: defines names for all type symbols in the standard Python interpreter
    - **re**: evaluates regular expressions
    - **pprint**: supports pretty-print output
    - **logging**: writes errors to a log file

#### Line 67 - Importing the contenttype Module

The custom `contenttype` module is used by the `preprocess.py` program and is not included in a standard Python installation.

This line loads the `contenttype` module and imports the `getContentType` method.

**Tip**: To interact directly with the `contenttype.py` module, see [Explore Python with the Interactive Shell](#pythontut_interactive_shell) for more information.

<a name="pythontut_define_class" id="pythontut_define_class"></a>
### Defining an Exception Class

#### Lines 72 to 88 - Declaring an Exception

- `PreprocessError` class inherits from the Python `Exception` class.
- An instance of the `PreprocessError` class is thrown by the `preprocess` module when an error occurs.

**Tip**: Click the mouse pointer on the closing parenthesis ")" on line 72. Notice that its color changes to a bold red. The opening brace is displayed the same way. This is called "Brace Matching". Related features in Komodo are **Jump to Matching Brace** and **Select to Matching Brace**, available via the **Code** menu.

<a name="pythontut_init_object" id="pythontut_init_object"></a>
### Initializing Global Objects

#### Line 93 - Initializing log

- `log` is a global object used to log debug messages and error messages

**Tip**: On line 95, enter: `log = logging.` When you type the period, Komodo displays a list of the members in the `log` package. This is called [AutoComplete](/manual/editor.html#AutoComplete). If the default [key binding](/manual/prefs.html#Config_Key_Bindings) scheme is in effect Pressing 'Ctrl'+'J' (Windows/Linux) or 'Cmd'+'J' (macOS) also displays the AutoComplete list. Delete the contents of line 95.

#### Lines 98 to 111 - Mapping Language Comments

- `_commentGroups` is a mapping of file type (as returned by `content.types`) to opening and closing comments delimiters.
- Mapping is private to the `preprocess.py` module (`_commentGroups` is prefixed with an underscore to indicate that it is private to the `preprocess.py` module). This is a common technique used in variable, function, and class naming in Python coding).

Note that preprocessor directives recognized by the `preprocess.py` module are hidden in programming language-specific comments.

**Tip**: Use the **Code** sidebar, available in the Left Pane, to browse the general program structure of all currently open files. For each file, the code browser shows a tree of classes, functions, methods, and imported modules. Python instance attributes are also displayed.

<a name="pythontut_define_private" id="pythontut_define_private"></a>
### Defining a Private Method

#### Lines 116 to 123 - Expression Evaluation

- `_evaluate method` is private to the `preprocess` module.
- Evaluates the given expression string with the given context.

<a name="pythontut_process_sourcecode" id="pythontut_process_sourcecode"></a>
### Preprocessing a File

The `preprocess` method examines the directives in the sample source file and outputs the modified processed text.

#### Lines 129 to 140 - The preprocess Method Interface

The `preprocess` method takes three parameters as input:

- The first parameter is the filename, `infile`
- The second parameter specifies the output file (defaults to `stdout`); `outfile=sys.stdout`
- The third parameter is an optional list of definitions for the preprocessor; `defines={}`

#### Lines 145 to 156 - Identifying the File Type

Examines how programming comments are delimited (started and ended) based on the type of file (for example, HTML, C++, Python).

- `getContentType` is called (imported earlier from the `contenttype.py` module) to determine the language type of the file
- File type is used to look up all comment delimiters (opening and closing language comment characters) in `_commentGroups`

#### Lines 158 to 166 - Defining Patterns for Recognized Directives

This section defines advanced regular expressions for finding preprocessor directives in the input file.

**Tip**: Use the Komodo [Regular Expression (Rx) Toolkit](/manual/regex.html) to build, edit, or test regular expressions. New to regular expressions? The [Regular Expressions Primer](/manual/regex-intro.html) is a tutorial for those wanting to learn more about regex syntax.

#### Lines 178 to 303 - Scanning the File to Generate Output

This block of code implements a basic state machine. The input file is scanned line by line looking for preprocessor directives with the patterns defined above (`stmtRes`). This code determines whether each line should be skipped or written to the output file.

- Source file is processed
- Output is generated by a state machine implemented in Python

#### Lines 311 to 349 - Interpreting Command Line Arguments

The `main` method takes the text entered at the command line and uses the `getopt` module to parse the data into arguments. These arguments are then passed into the "preprocess" method.

- Runs when `preprocess.py` is executed as a program rather than loaded as a module
- Parses the filename and any defines (`-D`) set as command line arguments
- Passes all data to the `preprocess` method

#### Lines 351 to 352 - Running the Main Method

- Runs the `main` method when `preprocess.py` is executed as a program

<a name="pythontut_analyze_contenttype" id="pythontut_analyze_contenttype"></a>
### Analyzing contenttype.py

In this step, you will analyze the Python program `contenttype.py` in sections. This Python script is best addressed by focusing on certain areas within the code. Be sure that line numbers are enabled in Komodo (**View** > **View Line Numbers**) and that `contenttype.py` is displayed in the Komodo Editor Pane.

<a name="pythontut_open_contenttype" id="pythontut_open_contenttype"></a>
### Open contenttype.py

In the [Places sidebar](/manual/workspace.html#places_sidebar), double-click the `contenttype.py` file. This file opens in the Editor Pane; a tab at the top of the pane displays the filename.

<a name="pythontut_setup_module" id="pythontut_setup_module"></a>
### Setting Up the contenttype.py Module

The `contenttype.py` module is used by the main program, `preprocess.py`, to identify what programming language a particular file is written in based on the file extension and several other tests.

#### Lines 16 to 19 - Importing External Modules

- Imports external modules used in this file (`re`, `os`, `sys`, `logging`)

<a name="pythontut_getting_data" id="pythontut_getting_data"></a>
### Getting Data from content.types

#### Lines 29 to 31 - Finding the Helper File (content.types)

This section outlines the usage of the private `_getContentTypesFile` method located in the `contenttype` module.

- Returns the complete path to the `content.types` file
- Assumes the file is in the same directory as `contenttype.py`
- `_getContentTypesFile` is a private method that cannot be accessed from outside of the `contenttype` module

#### Lines 33 to 80 - Loading the Content Types from content.types

This section outlines the usage of the private `_getContentTypesRegistry` method located in the `contenttype` module.

- Locates the `content.types` file and scans it to calculate three mappings to return, as follows:

```
file suffix -> content type (i.e. ".cpp", a C++ implementation file)
regex -> content type (i.e. ".*\?", an HTML file)
filename -> content type (i.e. "Makefile", a Makefile)
```

- `_getContentTypesRegistry` is a private method that cannot be accessed from outside of the `contenttype` module.
- **Lines 44 to 45**: gets the `content.types` file; if none is specified in the parameter for the method, `_getContentTypesFile` is called to find the system default
- **Lines 47 to 49**: lists the three mappings to return (empty mappings are created here)
- **Lines 51 to 79**: opens and processes the `content.types` file on a line-by-line basis
    - scanning of the file stops when the last line is found, line 57
- **Lines 58 to 78**: each line is parsed to determine which of the three mappings it contains
    - an entry is made in the matching one
    - commented lines (starts with #) are ignored
- **Lines 79 to 80**: closes the `content.types` file and returns the mappings

#### Lines 85 to 118 - Determining a File's Content Type

This section outlines the usage of the public `getContentType` method located in the `contenttype` module.

- Takes one parameter (the name of the file to determine the content)
- Returns a string specifying the content type (for example,  
     `getContentType("my_web_page.htm")` returns "HTML" )
- `getContentType` is the only publicly accessible method in the module
- **Line 92**: `_getContentTypesRegistry` is called to load the `content.types` file and to load the mappings
- **Lines 96 to 99**: `filenameMap` is first checked to determine if the whole filename can be used to find a match
- **Lines 101 to 109**: if the filename has a suffix (contains a '.'), the suffix map is then used to find a match
- **Lines 111 to 117**: each regex in the regex map is then used to determine if it matches the filename
- **Line 118**: returns the content type for the file (returns an empty string if no match was found by the above three mappings)

<a name="pythontut_run" id="pythontut_run"></a>
## Running the Program

This section reviews how to run the `preprocess.py` program using both a [run command](#pythontut_run_command) and the Komodo [debugger](#pythontut_run_debugger).

<a name="pythontut_run_command" id="pythontut_run_command"></a>
### Using a Run Command

In this section you'll create a simple run command for running the `preprocess.py` file.

1. **Open the Source File**: In the **Places** sidebar, double-click the `helloworld.html` file. The file opens in the Editor Pane.
1. **Run Command**: In the **Toolbox** sidebar, right-click on the **python_tutorial** toolbox and select **Add** > **Add New Command**.
1. Give the command a meaningful name by replacing the default string (**New Command**) with **Preprocess Current File**.
1. Set the command to `%(python) preprocess.py %(ask:Preprocessor Options:) "%F"`
1. Set the **Start in** field to `%(D:else)`.
1. Leave the default value (`Command Output Tab`) in the **Run in** field.
1. Click **OK**. You should have a new **Run Command** entry in the **python_tutorial** toolbox.
1. Double-click the **preprocess current file** command. A Preprocess Current File dialog box appears.
1. In the **Preprocessor Options** text area, enter `-D SAY_BYE=1` and click **OK** to run the program.
1. **View Output**: The _helloworld_ file output is displayed on the **Command Output** tab as follows:  

     ```
     ['path_to_file\\python_tutorials\\helloworld']  
     <html>  
     <head> <title>Hello World</title> </head>  
     <body>  
     <p>Hello, World!</p>  
     <p>Bye!</p>  
     </body>  
     </html>  
     ```

**Tip**: For more information about the `-D SAY_BYE` command, see [Using the Debugger](#pythontut_run_debugger).

**Tip**: For more information on using run commands in Komodo, see the [Run Command Tutorial](runcmdtut.html).

<a name="pythontut_run_debugger" id="pythontut_run_debugger"></a>
### Using the Debugger

Generate output by running the program through the debugger without setting any breakpoints.

1. **Run the debugger**: Select the `preprocess.py` tab in the editor. From the menu, select **Debug** > **Go/Continue**. In the [Debugging Options](/manual/debugger.html#Debugging_Options) dialog box, click **OK** to accept the defaults.
1. **View the Debug Output Tab**: Notice the messages in the bottom left corner of the Komodo screen; these inform you of the status of the debugger. When the program has finished, program output is displayed in the Bottom Pane, on the right side. If necessary, click the **Debug Output** tab to display it.

**Troubleshooting**: "Why is this error message displayed?"

```
preprocess: error: incorrect number of arguments:
argv=['C:\\path_to_tutorial\\preprocess.py']
```

This error message is the expected output by the `preprocess.py` program when no source file or arguments are specified before it is run. The following instructions explain how to specify a file at the command line.

1. **Specify a File to Process**: In the **Projects** sidebar, double-click the file `helloworld.html`. Note the preprocessor directives inside the comments (#) in this file. Select the `preprocess.py` tab in the editor. From the menu select **Debug** > **Go/Continue**. In the **Script Arguments** text box on the Debugging Options dialog box, enter `helloworld.html`. Click **OK**.

**Troubleshooting**: "Why is this error message displayed?"

```
<html>
<head> <title>Hello World</title> </head>
<body>
preprocess: error: helloworld:5: #error: "SAY_BYE is not
defined, use '-D' option"
```

This error message is the expected output by the `preprocess.py` program when no command-line arguments are specified with the source file `helloworld.html`. The following instructions explain how to specify a command-line argument with the source file to be processed.

1. **Specify an Argument with the Source File**: Select **Debug** > **Go/Continue**. In the **Script Arguments** text box in the Debugging Options dialog box, enter the following source file and argument: `-D SAY_BYE helloworld.py`. Click **OK**.

**Troubleshooting**: Specifying `-D SAY_BYE helloword` outputs the following:

```
<html>
<head> <title>Hello World</title> </head>
<body>
<p>Hello, World!</p>
</body>
</html>
```

In the `helloworld` file, if `SAY_BYE` is not defined, preprocessing generates an error. If `SAY_BYE` is defined, the preprocessor includes the line `<p>Hello, World!</p>` in the body of the output of the HTML. This demonstrates how a Python preprocessor can be used to conditionally include blocks of a source file being processed.

1. **View the Debug Output Tab**: Notice the HTML output and compare the result to the actual file _helloworld_.
1. **View Rendered HTML**: On the right side of the Bottom Pane, click the **HTML** tab. The rendered HTML for the _helloworld_ file is displayed in the Bottom Pane. Click the **Output** tab to return to the HTML code.
1. **Create New File**: To create a new HTML file that will later contain the HTML code in the Bottom Pane, select **File** > **New** > **File from Template**. In the New File dialog box, select the HTML Template. Click **Open**.
1. **Save the Output**: Delete the contents of the new HTML file tab in the Editor Pane, and then select the contents of the **Output** tab on the Bottom Pane. Copy the contents to the new HTML file tab in the Editor Pane. Select **File** > **Save As** to save the file with a unique name.
1. **Specify Another Source File**: Go through steps 3 to 5 using the file `helloworld.py` in place of _helloworld_. Notice how the output displayed is now in Python, (for example, `print "Hello, World!"`). This demonstrates how the `preprocess.py` program can be used to process files written in different language types.

<a name="pythontut_debug" id="pythontut_debug"></a>
## Debugging the Program

In this step you will add breakpoints to the program and "debug" it. Adding breakpoints lets you run the program in sections, making it easier to watch variables and view the output as it is generated.

1. **Set a breakpoint**: On the **preprocess.py** tab, click on the gray margin immediately to the left of the code on line 347 of the program. This sets a breakpoint, indicated by a red circle.
1. **Run the debugger**: Select **Debug** > **Go/Continue**. In the **Script Arguments** text box on the [Debugging Options](/manual/debugger.html#Debugging_Options) dialog box, enter the following source file and argument (if not there from a recent run): `-D "SAY_BYE" helloworld`. Click **OK**.

**Tip**: Debugger commands can be accessed from the **Debug** menu, by shortcut keys, or from the Debug Toolbar. For a summary of debugger commands, see the [Debugger Command List](/manual/debugger.html#How_use_Debugger).

1. **Watch the debug process**: Notice that the line where the breakpoint is set (line 347) turns pink. Also, a yellow arrow appears on the breakpoint. This arrow indicates the position at which the debugger has halted.
1. **View variables**: On the [Debug tab](/manual/workspace.html#Output_Pane), click the **Locals** tab. If necessary, [resize the pane](/manual/workspace.html#Resizing_Panes) by clicking and dragging the upper margin. On the **Locals** tab, notice the declared variables are assigned values. Examine the `infile` variable. This variable contains the name of the file specified above (_helloworld_).

**Tip**: What do the debugger commands do?

- **Step In**: Executes the current line of code and pauses at the following line.
- **Step Over**: Executes the current line of code. If the line of code calls a function or method, the function or method is executed in the background and the debugger pauses at the line that follows the original line.
- **Step Out**: When the debugger is within a function or method, Step Out executes the code without stepping through the code line-by-line. The debugger stops on the line of code following the function or method call in the calling program.

1. **Step In**: Select **Debug** > **Step In** until the debugger stops at line 129, the `preprocess` method. "Step In" is a debugger command that causes the debugger to enter a function called from the current line.
1. **Set another breakpoint**: Click on the gray margin immediately to the left of the code in line 145 to set another breakpoint. Line 145 is where `getContentType` is called.
1. **Run the debugger**: Select **Debug** > **Go/Continue**.
1. **Step Over**: When line 145 is processed, the variable `contentType` is assigned the source file's (_helloworld_) type (HTML). "Step Over" is a debugger command that executes the current line of code. If the line of code calls a function or method, the function or method is executed in the background and the debugger pauses at the line that follows the original line.
1. **View variables**: On the **Debug** tab, click the **Locals** tab. Examine the `contentType` variable. This variable contains the type of the source file; the type is "HTML" for _helloworld_.
1. **Set another breakpoint**: Click on the gray margin immediately to the left of the code in line 197 to set another breakpoint. Line 197 is inside of the loop where the source file _helloworld_ is being processed.
1. **Run the debugger**: Select **Debug** > **Go/Continue**.
1. **Add Watches for Variables**: On the **Debug** tab, click the **Watch** tab. Click the **New** button in the lower-right corner of the **Debug** tab. An **Add Variable** dialog box appears. In the **Add Variable** dialog box, enter `lineNum` in the text box. Click **OK**. Notice that the `lineNum` variable and its value are displayed in the **Watch** tab. The `lineNum` variable is the line number of the line currently being processed in the source file _helloworld_. Follow the above steps again to enter a watch for the variable `line`. The `line` variable contains the actual text of the line currently being processed.
1. **Run the debugger**: Select **Debug** > **Go/Continue**. Notice how the variables in the **Watch** tab change every time the debugger stops at the breakpoint set at line 197\. Also, notice the output in the right side of the **Debug** tab. This output changes as new lines are displayed.
1. **Disable and Delete a breakpoint**: Click on the red breakpoint at line 197\. The red breakpoint is now white with a red outline. This breakpoint is now disabled. Click on the disabled white breakpoint. This removes the breakpoint, but does not stop the debugger.
1. **Stop the Debugger**: On the **Debug** menu, click **Stop**.

<a name="pythontut_interactive_shell" id="pythontut_interactive_shell"></a>
## Explore Python with the Interactive Shell

In this step you will use the interactive shell to explore the `contenttype` module. The Komodo interactive shell helps you test, debug, and examine your program. See [Interactive Shell](/manual/intshell.html) for more information.

If starting this section of the tutorial with currently open Python shells, please follow the steps below to ensure the Python shell's current directory is the Python Tutorial directory.

1. **Close any Current Python Shells**: Click the "X" button, located in the upper-right corner of the **Shell** tab, for each open Python shell.
1. **Make sure _python_tutorial_ is open (bold)**: If you haven't opened it before, click on the **Python Tutorial** link on the **Start Page**. If it's in your list of recent projects in the **Projects pane**, double-click it.

Start using the interactive shell with the Python Tutorial project files:

1. **Start the Interactive Shell**: On the **Tools** > **Interactive Shell** > **Start New Python Shell**. A **Python Shell** tab is displayed in the Bottom Pane.
1. **Import a Module**: At the ">>>" Python prompt in the interactive shell, enter: `import contenttype`  
     Notice that another ">>>" Python prompt appears after the import statement. This indicates that the `contenttype` module imported successfully.
1. **Get Help for a Module**: At the prompt, enter: `help (contenttype)`  
     The help instructions embedded in the `contenttype.py` file are printed to the interactive shell screen. This is useful for easily accessing Python documentation without installing external help files.
1. **Get Help for a Method in a Module**: At the prompt, press the up arrow to redisplay previously entered commands. When `help (contenttype)` is redisplayed, enter `.getContentType` at the end of the command. The entire command is as follows:  
     `help (contenttype.getContentType)`  
     Press **Enter**. The help instructions for the `getContentType` method are printed to the shell screen. The ability to instantly access help on specific Python functions is a powerful use for the interactive shell.
1. **Run a Method**: At the prompt, enter: `contenttype.getContentType("helloworld")`  
     Notice the output identifies the file type as `HTML`.
1. **Run Another Method**: At the prompt, enter: `contenttype.getContentType("helloworld.py")`  
     Notice the output identifies the file type as `Python`.
1. **Run a Final Method**: At the prompt, enter: `contenttype.getContentType("test.txt")`  
     Notice the output identifies the file type as `Text`. The `contenttype` module uses several tests to determine the data type used within a file. The test that determined that _test.txt_ is a text file simply analyzed the file extension.

<a name="pythontut_preprocess_resources" id="pythontut_preprocess_resources"></a>
## More Python Resources

### Tutorials and Reference Sites

There are many Python tutorials and beginner Python sites on the Internet, including:

- [The Python Home Page](http://www.python.org), the home of all that is Python.
- [ActivePython Documentation](http://docs.activestate.com/activepython/)
