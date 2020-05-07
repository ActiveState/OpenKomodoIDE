---
title: Run Command Tutorial
---

<a name="runcmdtut_over" id="runcmdtut_over"></a>
## Overview
<a name="runcmdtut_scenario" id="runcmdtut_scenario"></a>
### Run Command Tutorial Scenario

This tutorial introduces you to the Komodo Run Command feature. You will learn how to run simple and complex custom commands (such as `grep`, `make`, and `perl`); use these commands to process and analyze files; save commands to run with a single keystroke; and use commands to make Komodo a more powerful editor. In this tutorial you will:

1.  [**Run simple commands**](#runcmdtut_simple) using the Komodo Run Command feature.
1.  [**Use advanced command options**](#runcmdtut_advanced) to control how and where a command is run.
1.  [**Save commands**](#save) in the Toolbox and assign keyboard shortcuts.
1.  [**Using interpolation shortcuts**](#runcmdtut_shortcuts) to customize commands for reuse.
1.  [**Prompting for input**](#query_short) to have your commands prompt you for information before running.
1.  [**Parse command output**](#parse) into a list of results by specifying a regular expression.

<a name="runcmdtut_openproject" id="runcmdtut_openproject"></a>
### Opening the Tutorial Project

Select **File** > **Open** > **Project**.

<a name="runcmdtut_simple" id="runcmdtut_simple"></a>
## Running Simple Commands

<a name="helloworld" id="helloworld"></a>
### Hello, World!

The Komodo Run Command feature offers another way to run commands that would otherwise be run on the system command line. This section starts with a simple `echo` command.

1.  Select **Tools** > **Run Command** to open the **Run Command** dialog box.   
    ![](/images/runcommand_simple.png)  
1.  In the **Run** field, enter `echo Hello World`.
1.  Click **Run**. The results are displayed on the **Command Output** tab.

<a name="outputwindow" id="outputwindow"></a>
### Command Output Tab

Output from commands is displayed on the **Command Output** tab.
    ![Command Output tab](/images/runcommand_outputwin.png)  

Use the **Command Output** tab to interact with commands; if the command accepts input, enter it directly into the command on the **Command Output** tab. The **Command Output** tab has the following features:

- Output written to `stderr` (standard error output) is displayed in red at the top of the **Command Output** tab.
- To terminate a running command, click the ![](/images/runcommand_terminatebutton.png) button in the upper right-hand corner of the bottom pane.
- Many keyboard shortcuts available in the Komodo editor can also be executed on the **Command Output** tab. For example, 'Ctrl'+'Shift'+'8' ('Cmd'+'Shift'+'8' on Mac OS X) displays white space and 'Ctrl'+'Shift'+'7' ('Cmd'+'Shift'+'7' on Mac OS X) displays line endings (if the default [key binding](/manual/prefs.html#Config_Key_Bindings) scheme is in effect).

The **Toggle Raw/Parsed Output View** button ![](/images/runcommand_parsedviewbutton.png) is discussed in the [Parsing Command Output](#parse) section of this tutorial.

<a name="insertoutput" id="insertoutput"></a>
### Inserting Command Output

Insert command output into a document using the **Insert output** option.

1.  In the [Places sidebar](/manual/workspace.html#places_sidebar), double-click the file _play.txt_. The file opens in the [Editor Pane](/manual/workspace.html#Editor_Pane); a tab at the top of the pane displays its name.
1.  Select **Tools**  > **Run Command**.
1.  In the **Run** field, enter the command `dir` (on Windows) or `ls -al` (on Linux).
1.  Select the **Insert output** check box, and then click **Run**. The contents of Komodo's current directory are inserted into _play.txt_.

<a name="filtering" id="filtering"></a>
### Filtering Parts of a Document

The **Pass selection as input** option passes selected text to the specified command. Use this option together with the **Insert output** option to filter selected regions of a document.

1.  Open `play.txt` from the Run Command tutorial project (if it is not already open).
1.  Select all six lines containing the word `frog`.
1.  Select **Tools** > **Run Command**.
1.  In the **Run** field, enter the command `sort` (on Windows) or `sort -n` (on Linux).
1.  Note that the **Pass selection** as input and **Insert output** options are selected automatically. If one or more lines are selected in a document, the Run Command expects to filter the selected lines.
1.  Click **Run** to sort the list of frogs.

Use the `grep` command line utility to filter lines of text. Use `grep` to filter out all but the red frogs from the list.

This tutorial assumes the `grep` utility is installed on your system and is in your system's PATH. Grep is a Linux utility that searches for text and characters in files. Windows operating system users may not have a `grep` installation. There are a number of free versions available on the Web. Search using the keywords `grep for Windows`.

1.  Open `play.txt` from the Run Command tutorial project (if it is not already open).
1.  Select the "5 red frogs" and "6 green frogs" lines.
1.  Select **Tools** > **Run Command**.
1.  In the **Run** field, enter the command `grep red`.
1.  Click **Run** to remove all but the red frogs.

<a name="runcmdtut_advanced" id="runcmdtut_advanced"></a>
## Using Advanced Options

Clicking the **More** button in the Run Command dialog box reveals a number of advanced options.

![](/images/runcommand_adv.png)  

<a name="cwd" id="cwd"></a>
### Specifying a Command's Working Directory

To set the current working directory for a command:

1.  Select **Tools** > **Run Command**. Click **More** to display Advanced Options.
1.  In the **Run** field, enter the command: `dir` (on Windows), or `ls -al` (on Linux).
1.  In the **Start in** field, enter `C:\` (on Windows), or `/home` (on Linux).
1.  Click **Run** to generate a `C:\` directory listing.

<a name="env" id="env"></a>
### Specifying Environment Variables

Specify which environment variables to set for a command. For example, use this feature for setting `PERL5LIB` or `PYTHONPATH` when running Perl or Python scripts.

1.  Select **Tools** > **Run Command**.
1.  In the **Run** field, enter the command: `set`.
1.  Click **New** to add a new environment variable. For the variable name, enter: `PERL5LIB`
1.  Click **Add Path** to choose a value for `PERL5LIB` (the actual value you choose does not matter for this example). Click **OK**.
1.  Click **Run** to display all environment variables. Scroll through the results on the **Command Output** tab until the `PERL5LIB` setting is located.

<a name="runcmdtut_console" id="runcmdtut_console"></a>
### Running GUI Apps or Running Commands in a Console

Run GUI programs outside of the Command Output tab by changing the **Run in** option to **No Console**.

1.  Select **Tools** > **Run Command**.
1.  In the **Run** field, enter the command: `mozilla`  
     If the Mozilla browser is not installed on your system, choose another GUI application to run. For example, on Windows, try running either the `iexplore` or `notepad` command.
1.  From the **Run in** drop-down list, select **No Console (GUI Application)**.
1.  Click **Run** to open the GUI application rather then the **Command Output** tab.

To run commands in a new console window:

1.  Select **Tools** > **Run Command**.
1.  In the **Run** field, enter the command: `dir`
1.  From the **Run in** drop-down list, select **New Console**.
1.  Click **Run** to execute the command and open a new console window.

<a name="save" id="save"></a>
## Saving and Rerunning Commands

Save frequently used commands for quick access and reuse.

<a name="recent" id="recent"></a>
### Rerunning Recent Commands

Select **Tools** > **Recent Commands** > **[Command]** to rerun recently run commands.

<a name="runcmdtut_toolbox" id="runcmdtut_toolbox"></a>
### Saving Commands in the Toolbox

The Run Command dialog box contains an option for saving commands in the Toolbox for reuse. A command saved in the Toolbox is indicated with the ![](/images/runcommand_icon.png) icon.

![](/images/runcommand_toolbox.png)

1.  Select **Tools** > **Run Command**.
1.  In the **Run** field, enter the command: `echo Hello World`
1.  Select the **Add to Toolbox** check box.
1.  Click **Run**. Notice that a command named `echo Hello World` is added to the Toolbox.
1.  Double-click the ![](/images/runcommand_icon.png) icon next to `echo Hello World` to rerun the command.

<a name="properties" id="properties"></a>
### Editing Saved Command Properties

Edit command properties in the Command Properties dialog box.

![Command Properties dialog box](/images/runcommand_properties.png)

To open this dialog box, right click on any saved command and select **Properties**.

<a name="runcmdtut_shortcuts" id="runcmdtut_shortcuts"></a>
## Using Interpolation Shortcuts

Run Command can use [interpolation shortcuts](/manual/shortcuts.html#shortcuts_all_codes) for putting filenames, directory names, paths and other arguments into commands as variables. This creates commands that are more generic and useful. Enter command shortcuts in the Run and Start in fields, or select them from the drop-down lists to the right of the Run and Start in fields. Windows users should enclose all interpolation shortcuts (with the exception of `%(browser)`) in double quotation marks to ensure that spaces in filenames or file paths are interpreted correctly.

Click the arrow button to the right of the **Run** field to view a list of Run Command shortcuts.

![](/images/runcommand_shortcuts.png)

<a name="file" id="file"></a>
### Shortcuts for the Current File

The string `%F` in a command expands the full path of the current file.

1.  In the **Projects** sidebar, double-click the file `play.txt` to open it for editing.
1.  Select **Tools** > **Run Command**.
1.  In the **Run** field, enter the command:  
     `echo "%F"`
1.  Click **Run**.

Change the current file status from "writable" to "read-only".

1.  Open `play.txt` (if it is not already open).
1.  Select **Tools** > **Run Command**.
1.  In the **Run** field, enter the command:  
     `attrib +R "%F"`  
     on Windows, or:  
     `chmod u+w "%F"`  
     on Linux.
1.  Click **Run**. The result is displayed at the top of the **Command Output** tab.

To open a current HTML file in a Web browser, combine %F with the %(browser) shortcut.

1.  In the **Projects** sidebar, double-click the file `index`.
1.  Select **Tools** > **Run Command**.
1.  Click the arrow to the right the **Run** field to display the shortcuts drop-down list. Select **%browser**, press the space bar, and then select **%F**. Enclose the `%F` in double quotation marks. On Mac OS X, you wil have to add 'open' at the beginning of the command if Safari is your default browser.
1.  From the **Run in** drop-down menu, select **No Console (GUI Application)**.
1.  Click **Run**.

<a name="selection" id="selection"></a>
### Shortcuts for the Current Selection

The %s, %S, %w and %W codes insert current selections, or the current word under the cursor, into commands. This shortcut helps when running utilities like `grep`, or for searching the Web.

1.  In the **Projects** sidebar, double-click the file `index`.
1.  Position the cursor over the word "PHP" in `index`.
1.  Select **Tools** > **Run Command**.
1.  In the **Run** field, enter the command:  
     `%(browser) http://www.google.com/search?q="%W"`.
1.  Select the **Add to Toolbox** check box to save this command.
1.  Click **Run** to search for "PHP" with Google.

Now that you have searched for a word or selection in Google, try the following shortcut to search for PHP methods.

1.  Open `index`.
1.  Select the text `mysql_info methods` in the file.
1.  Select **Tools** > **Run Command**.
1.  In the **Run** field, enter the command "`%(browser) http://www.php.net/manual-lookup.php?pattern=%S`".
1.  Select the **Add to Toolbox** check box to save this command.
1.  Click **Run** to search `mysql_info methods` in PHP's online manual.

These two commands are built into Komodo. If the default [key binding](/manual/prefs.html#Config_Key_Bindings) scheme is in effect, 'Ctrl'+'F1' ('Cmd'+'Ctrl'+'/' on macOS) starts a Google search for the current selection. 'Shift'+'F1' ('Cmd'+'/' on macOS) in a Perl, Python or PHP file starts a help search appropriate for that language. Customize searches in the Preferences dialog box (**Edit** > **Preferences|Language Help**).

<a name="directory" id="directory"></a>
### Using Shortcuts for a Command's Directory

Run commands from the directory where the current file is stored, rather then the current directory. For example, use the command `%(perl) "%F"` to run the current file with a configured Perl interpreter.

1.  In the **Projects** sidebar, double-click the file `hello.pl`.
1.  Select **Tools** > **Run Command**.
1.  In the **Run** field, enter the command:  
     `%(perl) "%F"`
1.  In the **Start in** field, enter: `"%D"`
1.  Click **Run**.

This example assumes a perl interpreter is configured on your system. If a perl interpreter is not configured (the required file is perl.exe), an error message displays at the top of the **Command Output** tab. Alternatively, run the command `dir` (Windows) or `ls` (Linux) to display a list of files and folders beneath the current directory.

<a name="query_short" id="query_short"></a>
## Prompting for Input

<a name="runcmdtut_intro" id="runcmdtut_intro"></a>
### Introduction

Run Commands can prompt for specific input with a dialog box. These queries can be configured with default values and/or prompt the user if no value could be determined automatically (e.g. a command to search Google for the current selection that prompts for a search term if nothing is selected).

The `%(ask)` and `%(askpass)` shortcuts always prompts the user for data. Other shortcuts can use the `orask` modifier to prompt the user if no valid value could be determined.

Windows users should enclose all Komodo shortcuts (with the exception of `%(browser)`) in double quotation marks. This is necessary to ensure that any spaces in filenames or file paths are interpreted correctly.

<a name="ask" id="ask"></a>
### Always Prompting with %(ask) or %(askpass)

The full syntax of `%(ask)` and `%(askpass)` shortcut are:

```
%(ask[:NAME:[DEFAULT))
%(askpass[:NAME:[DEFAULT))
```

where `NAME` is an optional name to use when prompting in the dialog box and `DEFAULT` is an optional default value to place in the dialog box.

For example:

1.  Select **Tools** > **Run Command**.
1.  In the **Run** field, enter the command: `echo Your favorite number is "%(ask)"`
1.  Click the **Run** button to run the command. The Interpolation Query dialog box is displayed.  

    ![](/images/runcommand_ask1.png)

1.  Enter your favorite number and click **OK** to finish running the command.

Refine this shortcut by adding a more meaningful name than "Value 0" and a more appropriate default value.

1.  Select **Tools** > **Run Command**.
1.  In the **Run** field, enter the command: `echo Your favorite number is "%(ask:Fav Number:42)"`
1.  Click the **Run** button to run the command. The Interpolation Query dialog box will now look like this:  

    ![](/images/runcommand_ask2.png)

1.  If your favorite number does not happen to be 42, enter a different number and click **OK** to finish running the command.

<a name="orask" id="orask"></a>
### Prompting When Necessary with %(...:orask)

Any Run Command shortcut can be modified to prompt the user for a value if one cannot be determined automatically. The full syntax of the modified shortcut is:

```
%(SHORTCUT:orask[:NAME])
```

where `NAME` is an optional name to use when prompting in the dialog box.

In the previous step we created a shortcut to search for the selected word on Google with the command:

```
%(browser) http://www.google.com/search?q="%W"
```

However, if nothing has been selected and there is no word under the cursor, the command fails. In this case, it would be better if the command prompted you for a search term.

1.  Be sure your cursor is _not_ positioned over a word.
1.  Select **Tools** > **Run Command**.
1.  In the **Run** field, enter the command:  
     `%(browser) http://www.google.com/search?q="%(W:orask:Search for)"`
1.  Click **Run**. The Interpolation Query dialog box prompts for a search term.

<a name="parse" id="parse"></a>
## Parsing Command Output

<a name="runcmdtut_parsing_intro" id="runcmdtut_parsing_intro"></a>
### Introduction

Use Run Commands to specify a regular expression to parse filename and line number information from lines of output. The parsed results are displayed in a table to quickly identify the desired file. Explore this usage by creating a "Find in Files" command later in this section.

<a name="runcmdtut_regex" id="runcmdtut_regex"></a>
### Parsing Output with a Regular Expression

Output from a run command can be parsed with a [Python regular expression](/manual/regex.html) and displayed in the **Command Output** tab as a list.

**Tip**: Use the Komodo [Regular Expression (Rx) Toolkit](/manual/regex.html) to build, edit, or test regular expressions.

Named groups in Python regular expressions (e.g. `(?P<_name_>_pattern_)` ) can be used to sort match data. The names 'file', 'line', 'column' and 'content' can be used as column titles in Parsed Output mode, with the matching text displayed in the columns under the names.

For example, the output of the "[Find in Files](#fif)" example below contains the following:  

```
hello.pl:5:print "Hello, frogs!\n";
```

Output lines are of the form:

```
<file>:<line>:<content>
```

An regular expression to match the important elements of this line could be:

```
(.+?):(\d+):(.*)
```

However, to view this information as a useful list, we need to define the column headings by naming the groups:

```
(?P<file>.+?):(?P<line>\d+):(?P<content>.*)
```

When parsing the run command output, Komodo determines that `hello.pl` is the _file_, `5` is the _line_ and `print "Hello, frogs!\n";` is the _content_, and displays the output sorted into the appropriate columns:

![](/images/runcommand_parsedoutput.png)

Parts of the output that match _outside_ the named groups in the regular expression (e.g. the ":" delimiters seen above) are visible when viewed as raw output, but are hidden when viewed as a list. You can use this technique to filter out extraneous information when viewing output as a list.

For example, if you were not interested in viewing the line number of the match, you could change the regular expression to the following:

```
(?P<file>.+?):\d+:(?P<content>.*)
```

Komodo can use the information from the 'file' and 'line' groups to open a file in an editor tab at a particular line (see below).

<a name="fif" id="fif"></a>
### Using "Find in Files"

Create a "Find in Files" command using all information presented in this tutorial.

1.  In the **Projects** sidebar, double-click the file `hello.pl`.
1.  Position the cursor over the word _frogs_.
1.  Select **Tools** > **Run Command**.
1.  On Windows, enter the command:  
     `findstr /s /n /c:"%(w:orask:Search Term)" "%(ask:File Pattern:*.*)"`  
     Or on Linux enter the command:  
     `find . -name "%(ask:File Pattern:*)" | xargs -l grep -nH "%(w:orask:Search Term)"`  

    Note that _findstr_ is a Windows command line utility that searches for strings in files.

1.  Select the **Add to Toolbox** check box to save this command.
1.  In the **Start in** field, enter:  
     `%(ask:Start Directory:%D)`  
     (When the command is run, Komodo should prompt for the "Start Directory" using the directory of the current file, or `%D` as the default value).
1.  Select the **Parse output with** check box and enter:  
     `^(?P<file>.+?):(?P<line>\d+):(?P<content>.*)$`  
     as the regular expression with which to parse.
1.  Select the **Show parsed output as a list** check box.
1.  Click **Run**. The Interpolation Query dialog box is displayed.  

    ![](/images/runcommand_findinfiles.png)

1.  Click **OK** to run _findstr_. A list of all occurrences of "frogs" in the files of the Run Command tutorial project is displayed on the Command Output tab.                                                                                 
    ![](/images/runcommand_parsedoutput.png)

1.  Double-click on a result to jump to a specific file and line.
1.  Click the Toggle Raw/Parsed Output ![](/images/runcommand_parsedviewbutton.png) button to see the raw output instead.
