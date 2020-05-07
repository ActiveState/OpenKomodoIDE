---
title: Ruby Tutorial
---

(Komodo IDE only)

<a name="rubytut_overview" id="rubytut_overview"></a>
## Overview

<a name="rubytut_assumptions" id="rubytut_assumptions"></a>
### Before You Start

This tutorial assumes:

- Ruby 1.8.0 or greater is installed on your system. See the [Debugging Ruby](/manual/debugruby.html) documentation for configuration instructions.
- You are interested in learning about Komodo functionality, including the debugger.
- You are interested in Ruby and have some programming experience either in Ruby or another language.

<a name="rubytut_scenario" id="rubytut_scenario"></a>
### Ruby Tutorial Scenario

The Ruby Tutorial demonstrates how to use Komodo to write and debug a simple Ruby program which saves its data in a YAML file. In this tutorial you will:

1. [**Open the Ruby Tutorial Project**](#rubytut_open).
1. [**Analyze menagerie.rb**](#rubytut_analyze) the Ruby program included in the Tutorial Project.
1. [**Run the program**](#rubytut_run) in Komodo.
1. [**Debug the program**](#rubytut_debug) using the Komodo debugger.

See [Debugging Programs](/manual/debugger.html) for more information on debugging in Komodo.

<a name="rubytut_open" id="rubytut_open"></a>
## Opening the Tutorial Project

From the **Help** > **Tutorials** menu, click **Ruby Tutorial**, or open the `ruby_tutorial.kpf` file from the `samples/ruby_tutorials` subdirectory of Komodo's [user data directory](/manual/trouble.html#appdata_dir)

The tutorial project will open in the [Places sidebar](/manual/workspace.html#places_sidebar).

<a name="rubytut_files" id="rubytut_files"></a>
### Overview of the Tutorial Files

The **ruby_tutorial** project contains:

- `menagerie.rb`: A program which stores and retrieves information on animals.
- `animals.yaml`: A YAML data file containing a base list of animals.
- `check_fname`: A code snippet that can be added to the program.

<a name="rubytut_openfile" id="rubytut_openfile"></a>
### Open the Ruby Tutorial File

In the [Places sidebar](/manual/workspace.html#places_sidebar), double-click the `menagerie.rb` file. This file opens in the Editor Pane, and a tab at the top of the pane displays the filename.

<a name="rubytut_analyze" id="rubytut_analyze"></a>
## Analyzing the Ruby program

The `menagerie.rb` program is a simple interactive program that can add, list, and search for information about animals. It can also store this information in a YAML file (e.g. `animals.yaml`). It is essentially an extremely simple database with predefined fields.

<a name="rubytut_intro" id="rubytut_intro"></a>
### Introduction

In this step, you will analyze the program in sections. Ensure that line numbers are enabled in Komodo (**View** > **View Line Numbers**) and that the file `menagerie.rb` is displayed in the Komodo editor.

#### Line 6 - Importing the YAML class

- This line loads Ruby's core YAML class.

**Tip**: Notice that syntax elements are displayed in different colors. You can adjust the display options for language elements in the [Preferences](/manual/prefs.html#prefs_top) dialog box.

#### Line 8 to 13 - Define and Initialize the Entry class

The **Entry** class contains variables which hold data for individual entries in our simple database, and the behavior of that data. Information about each animal in our menagerie will be contained in an Entry class object.

- `class Entry` declares the class
- the **initialize** method sets the instance variables `@sci_name`, `@desc`, and `@time_mod`.

These variables need to be private (_instance_ variables) rather than global because there will be an instance of the Entry class for each animal in the menagerie.

#### Line 15 - Expose instance variables

- **attr_reader** is a Ruby shortcut for exposing `@sci_name`, `@desc`, and `@time_mod` as read-only attributes of the Entry class.

#### Line 18 to 26 - Data Storage Methods

- the **sci_name=** method ensures that `@time_mod` is updated with the current time whenever `@sci_name` is updated.
- the **desc=** method does the same thing for `@desc`.

**Tip**: Click on the minus symbol to the left of line 18\. The section of code for the **sci_name** method is collapsed. Doing this at line 8 collapses the entire **Entry** class. This is called [Code Folding](/manual/editor.html#Folding).

#### Line 28 to 35 - Data Behavior Methods

- the **contains?** method lets the **cmd_search** method determine if a particular entry contains the string the user entered (see line 82).
- the **to_sci** method returns the scientific name and description of an entry (see lines 77 and 83).

#### Line 39 to 46 - Command Help

- the **$help** global variable contains a string with information on command usage, providing an easy way for methods to display help information when needed.

#### Line 48 to 55 - Define and Initialize the Menagerie class

The **Menagerie** class contains the **@menagerie** hash: the container which holds the multiple instances of the **Entry** class. It also contains all the methods available to the user of the application (via the command interface starting at line 154.

- `class Menagerie` declares the class
- **initialize** sets the instance variables `@menagerie` and `@fname`.

The name of the animal is stored as a key in the `@menagerie` hash. It references the **Entry** object which contains the rest of the information, namely the scientific name (`sci_name`) and description (`descr`). All the information we store on each animal is kept in two separate areas -- the `@menagerie` key and the **Entry** it points to.

#### Line 57 to 69 - Adding Entries

- The **split** method (from Ruby's String class) allows us to enter an entire record in one line, specifying the separator character we intend to use
- Line 60 checks for an existing entry of the same name
- If none is found, a new entry (i.e. Entry.new) is added
- If there is an existing key of the same name, the entry is only updated if there is a change to `sci_name` or `descr` (or both)

**Exercise**: After completing the tutorial, come back to this section and try writing a more "user friendly" version of this **cmd_add** method which asks for the name, scientific name and description separately (i.e. one at a time).

#### Line 74 to 88 - Searching for Entries

- Line 75 checks to make sure an argument has been provided
- Line 76 searches `@menagerie`'s key for a match
- If there is a matching key, line 77 returns the result using the **to_sci** method from the **Entry** class

#### Line 90 to 98 - Deleting Entries

- Line 91 checks to make sure an argument (`name`) has been given
- Line 92 checks if the name given matches a key in `@menagerie`
- If the name matches the `delete` method removes the entry

#### Line 100 to 102 - Listing Entries

- Line 100 specifies that the argument for **cmd_list** is called "not_used" - a placeholder argument name which tells us that the method will not actually use the argument
- Line 101 calls the `dump` method of the **YAML** class (see line 6) to show the entire Menagerie object in YAML format

#### Line 104 to 133 - Saving to a File

- Line 105 to 112: checks if the first character of the `fname` argument is "!"; this sets the `overwrite` variable which determines whether **cmd_save** can overwrite an existing file
- Line 115 to 117: if `overwrite` is false and the specified file exists, warn the user with a helpful message.
- Line 118 to 122: if the `fname` argument exists, set the `@fname` instance variable, if not, prompt the user with a useful error message.
- Line 123 to 126 uses ruby's **File** class to open the file for writing
- A file descriptor (`fd`) is created on line 124 which is written to in the next line (a YAML dump of our menagerie)
- Line 127 to 131 provides error handling for problems during the save

#### Line 135 to 143 - Loading from a File

- Line 136 assigns the method's argument to an instance variable
- Line 138 loads the data using the **YAML** class's **load_data** method
- Line 139 to 141 provides error handling for problems during loading

#### Line 145 to 149 - Showing Help

- Prints the **$help** variable (see line 39)

#### Line 151 - Starting the Program

- Creates a new instance of the **Menagerie** class called `obj`

#### Line 153 to 180 - Handling Commands from the User

The program needs a way to handle input from the user. This section deals with parsing input and splitting it into commands which call methods in the Menagerie class, and arguments for those methods.

- Line 153 compiles a regular expression into the `cmd_re` variable
- Line 154 prints the list of available commands (see line 39)
- Line 156 prompts the user for a command
- Line 159 captures user input and saves it to the `cmdline` variable
- The if block beginning at line 160 matches the user input against `cmd_re`
- This regular expression captures the first word "(\w+)" and the word that follows it "(.*)"
- The input is split into two parts:
    - The first word has the string "cmd_" prepended to it, and is then assigned to the `cmd` variable
    - The second word, or words, are assumed to be arguments and assigned to the `args` variable
- Line 163 checks if `cmd` is a valid method in the Menagerie class:
    - If it is, cmd and args are passed to the current Menagerie object using the **send** method (inherited from Ruby's **Object** class)
    - If the command is "quit" the program is ended with a `break`
    - If neither, an error message is passed to the user
- If the `cmd_re` regular expression cannot parse the command, line 177 prints an error message refering the user to the 'help' command

## <a name="rubytut_run" id="rubytut_run">Running the Program</a>

In this step you will run the program and interact with it.

1.  To run **menagerie.rb** without debugging: Select **Debug** > **Go/Continue**. The program interface displays in the **Command Output** tab. Try various commands to test the program.
1.  In the Command Output tab, enter various commands to test the program.
1.  Enter the following commands:
    - `load animals.yaml`
    - `list`
    - `delete Komodo dragon`

The output of the last command (including "Error: undefined method...") indicates that something is not working correctly. Debugging can help trace this problem. Type `quit` in the **Output** window before starting the debugger.

## <a name="rubytut_debug" id="rubytut_debug">Debugging the Program</a>

In this step you will add breakpoints to the program and "debug" it. Adding breakpoints lets you run the program in sections, making it easier to watch variables and view the output as it is generated.

Breakpoints are used to identify exactly where a program may be having problems. A bug has been intentionally left in the **cmd_delete** method which can illustrate this.

1.  **Set a breakpoint**: On the **menagerie.rb** tab, click on the gray margin immediately to the left of the code on line 93 of the program. This sets a breakpoint, indicated by a red circle.
1.  **Run the debugger**: Select **Debug** > **Go/Continue** (or enter 'F5', or use the Debug Toolbar). The [Debugging Options](/manual/debugger.html#Debugging_Options) dialog box will then pop up; press the **Return** key or **OK** button to dismiss it. You can pass program options to the program with the **Script Arguments** text box, but this particular program doesn't take any.
1.  **Enter commands**: In the **Command Output** tab, re-enter the commands from the [Running the Program](#rubytut_run) section ('load animals.yaml', 'list', and 'delete Komodo dragon').

**Tip**: Debugger commands can be accessed from the **Debug** menu, by shortcut keys, or from the Debug Toolbar. For a summary of debugger commands, see the [Debugger Command List](/manual/debugger.html#How_use_Debugger).

1.  **Watch the debug process**: After the last command, notice that a yellow arrow appears where breakpoint is set (line 93). This arrow indicates the position at which the debugger has halted. This tells us that our command did match a key in `@menagerie`.
1.  **Check the relevant variables**: Click on the **Self** tab to see the current object's instance and class variables. Notice the `@menagerie` hash. Expand the view of the hash by clicking the plus symbol next to it. It should only contain the "Leopard gecko" entry after the "Komodo dragon" entry has been deleted.
1.  **Set a Watch variable**: Select the **Watch** tab of the debugger window, highlight '`@menagerie.has_key?(name))`' on line 92 and drag it into the **Watch** tab. You can place most valid Ruby expressions in this area, including assignments, whether they're in the program or not. For example, placing the expression '`x = 2 + 2`' in the Watch tab will show that a local variable called 'x' is set to 4.

**Tip**: What do the debugger commands do?

- **Step In**: Executes the current line of code and pauses at the following line.
- **Step Over**: Executes the current line of code. If the line of code calls a function or method, the function or method is executed in the background and the debugger pauses at the line that follows the original line.
- **Step Out**: When the debugger is within a function or method, Step Out executes the code without stepping through the code line-by-line. The debugger stops on the line of code following the function or method call in the calling program.

1.  **Step In**: Select **Debug** > **Step In** until the debugger stops at line 166 (print status_message). "Step In" is a debugger command that causes the debugger to enter a function called from the current line.
1.  **View local variable**: On the **Debug** tab, click the **Locals** tab. Examine the `status_message` variable. This variable contains the message that will be returned to the user.
1.  **Run the debugger**: Select **Debug** > **Go/Continue** (or enter 'F5', or use the Debug Toolbar). The command returns `#<Entry:0x83096f8>Error: undefined method '[]' for #<Entry:0x83096f8>` which is not a very user-friendly message. The **cmd_delete** method is missing an explicit `return` value to provide if the deletion was successful.
1.  **Fix the problem**: On the **Debug** menu, click **Stop** (or use the Stop button on the Debug Toolbar). Uncomment line 94 by removing the "#".
1.  **Disable and Delete a breakpoint**: Click on the red breakpoint at line 93\. The red breakpoint is now white with a red outline. This breakpoint is now disabled. Click on the disabled white breakpoint. This removes the breakpoint.
1.  **Run the debugger**: Select **Debug** > **Go/Continue** and re-run the commands used previously ('load animals.yaml', 'list', and 'delete Komodo dragon'). The 'delete' command now returns the message "Deleted".

<a name="rubytut_resources" id="rubytut_resources"></a>
## More Ruby Resources

### Tutorials and Reference Sites

There are many Ruby tutorials and beginner Ruby sites on the Internet, including:

- [ruby-lang.org](http://ruby-lang.org): The main page for the ruby language, including release notes and downloads.
- [ruby-doc.org](http://ruby-doc.org): Extensive online documentation including tutorials and links, with well organized core and standard library API documentation.
- [Programming Ruby](http://www.ruby-doc.org/docs/ProgrammingRuby/): Tutorial and reference.
- [Learn to Program](http://pine.fm/LearnToProgram/): Excellent Ruby tutorials for beginners by Chris Pine.
- [Ruby on Rails - Documentation](http://documentation.rubyonrails.com/): Documentation and tutorials for the **Ruby on Rails** web development framework.
