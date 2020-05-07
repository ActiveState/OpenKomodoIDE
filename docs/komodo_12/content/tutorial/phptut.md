---
title: PHP Tutorial
---

(Komodo IDE only)

<a name="phptut_over" id="phptut_over"></a>
## Overview

<a name="phptutassumptions" id="phptutassumptions"></a>
### Before you begin

This tutorial assumes:

- [PHP 4.4](http://www.php.net/downloads.php) or greater is installed on your system. See the [Debugging PHP](/manual/debugphp.html#debugphp_top) documentation for installation and configuration instructions.
- You are interested in PHP. You don't need previous knowledge of PHP. The tutorial will walk you through a simple program and suggest some resources for further information.

<a name="phptut_scenario" id="phptut_scenario"></a>
### PHP Tutorial Scenario

This tutorial examines a PHP program that implements a form on a website - in this case, a guest book where site visitors can log comments. In addition to providing an overview and working example of PHP, the tutorial introduces Komodo's [CGI Debugging](/manual/debugger.html#Debugging_Options_CGI_Input) functionality. In this tutorial you will:

1.  [**Open the PHP Tutorial Project**](#phptut_open) and associated files.
1.  [**Analyzing the PHP Tutorial File**](#phptut_analyze), the PHP program included in the PHP Tutorial Project.
1.  [**Run the program and generate HTML output**](#phptut_run) by running the program.
1.  [**Debug the program**](#phptut_debug) using the Komodo debugger.

See [Debugging Programs](/manual/debugger.html) for more information on this Komodo functionality.

<a name="phptut_open" id="phptut_open"></a>
## Opening the Tutorial Project

1. Select **Help** > **Tutorials** > **PHP Tutorial**.

The tutorial project opens and is displayed in the [Places sidebar](/manual/workspace.html#places_sidebar).

<a name="phptut_analyzefiles" id="phptut_analyzefiles"></a>
### Overview of the Tutorial Files

The following components are included in the PHP Tutorial project file:

- **guestbook.php**: This PHP program writes data from an HTML form to a data file, then extracts the contents of the data file and formats it as HTML.

<a name="phptut_openfile" id="phptut_openfile"></a>
### Open the PHP Tutorial File

In the [Places sidebar](/manual/workspace.html#places_sidebar), double-click the `guestbook.php` file. The file opens in the Editor Pane, and a tab at the top of the pane displays the filename.

<a name="phptut_analyzefiles" id="phptut_analyze"></a>
## Analyzing the PHP Tutorial File

<a name="phptut_intro" id="phptut_intro"></a>
### Introduction

In this step, you will analyze the PHP program on a line-by-line basis. Ensure that line numbers are enabled in Komodo (**View** > **View Line Numbers**) and that the file `guestbook.php` is displayed in the Komodo editor.

<a name="html_header" id="html_header"></a>
### HTML Header

#### Lines 1 to 8 - HTML Header

- A standard HTML header is written to the program output

**Tip**: Syntax elements are displayed in different colors. You can adjust the display options for language elements in the [Preferences](/manual/prefs.html#prefs_top) dialog box.

<a name="php_declaration" id="php_declaration"></a>
### PHP Declaration and Datafile

#### Line 9 - PHP Declaration

- PHP programs are embedded in HTML
- `<?php` indicates the start of the PHP program

#### Lines 10 to 18 - Comments

- The `//` characters indicate a single-line comment in PHP programs; the `#` symbol can also be used. Multi-line comments are nested in `/*` and `*/` characters, as shown on lines 27 to 30.

#### Line 22 - Datafile

- The `guestbook.dat` file is created if it does not exist.
- The `tmp` directory must exist beneath the root of the drive where the program resides (unless a different location is specified in the [Debugging Options](/manual/debugger.html#Debugging_Options_General) Preferences page).
- PHP statements are terminated with semicolons.

**Tip**: On line 23, type `$da`. Komodo displays a list of the variables declared above the cursor position that begin with the letters `da`. This is [AutoComplete](/manual/editor.html#AutoComplete).

<a name="guestbook_class" id="guestbook_class"></a>
### GuestBook Class

#### Lines 25 to 28 - Class Declaration

- A `class` is a collection of variables and functions.
- The `GuestBook` class contains the functions `GuestBook`, `_getData`, `outputData`, etc.
- The `var` statement declares variables as class members, thus making them portable across functions contained in the class.

**Tip**: Click the mouse pointer at the end of line 25. Notice that the brace changes to a bold red font. The closing brace on line 144 is displayed the same way. In this case, the braces mark the beginning and end of a class. See Editing Files for more information about [matching braces](/manual/editor.html#matching_brace).

<a name="guestbook_function" id="guestbook_function"></a>
### GuestBook Function

#### Lines 34 to 37 - GuestBook Function

- A function is a discrete block of code
- The `$datafile` argument is passed to the function `GuestBook`; multiple arguments are separated by commas
- The contents of a function are enclosed in braces
- `$_SERVER` is a pre-defined PHP variable; it is passed to the script from the web server
- In PHP, global variables must be declared to be global inside a function if they are going to be used in that function
- A local variable is defined for the current function by use of the term `$this`; notice that the same syntax is used to call another function
- `gb_dat` variable is declared on line 27
- `gb_dat` variable is assigned the value of `$datafile`
- `$this->data` variable is cleared of any prior value
- `$this->_getData` variable calls the `_getData` function that begins on line 53; when the `_getData` function is complete, processing returns to line 40

**Tip**: On line 38, type `function GuestBook(`. When you type the left parenthesis, Komodo displays a pop-up hint that describes parameters for the function `GuestBook`. This is a [CallTip](/manual/editor.html#AutoComplete).

#### Lines 40 to 44 - Check for Valid Form Entry

- If the `REQUEST_METHOD` contained in `$_SERVER` is equal to `POST`, processing passes to the `addGuestBookEntry` function on line 120.
- If the `REQUEST_METHOD` is not equal to `POST`, a redirect message is displayed to the user.
    - The `echo` command generates output
    - The characters `\"` are not included inside the double quotation marks that follow, so that the message can be displayed as output
    - The PHP variable `PHP_SELF` is the filename of the current script
    - `$_SERVER["PHP_SELF"]` extracts the `PHP_SELF` variable from the `$_SERVER` variable

#### Lines 45 to 46 - Check for Variable Value

- The `if ($this->data)` statement tests if the variable `$this->data` has a value.
- The program executes the `outputData` function and then the `outputForm` function.

<a name="getdata_function" id="getdata_function"></a>
### _getData Function

#### Lines 53 to 58 - _getData Function

- The "file" statement parses the contents of the file stored in the `gb_dat` variable into the `$lines` array.
    - The `@` symbol suppresses warnings; in this case, if the data file is empty, the program generates a non-fatal error.
- The `if ($lines)` statement checks to see if the `$lines` variable has data.
- The "join" statement converts the `$lines` array to a string and places it in the variable `$this->data`.

**Tip**: Use the "@" operator with care, otherwise you could disable error messages for critical errors that terminate the execution of the script.

<a name="outputdata_function" id="outputdata_function"></a>
### outputData Function

#### Lines 64 to 66 - outputData Function

- The contents of the `$this->data` variable are written to the standard output using the `echo` statement.

<a name="createEntryHTML_function" id="createEntryHTML_function"></a>
### _createEntryHTML Function

#### Lines 72 to 77 - Retrieve Form Data

- The PHP variable `$_POST` is used to provide data to the script via HTTP POST
- Lines 74 to 77 extract the form data and place the items in variables

#### Lines 80 to 83 - Validate Form Data

- On line 80, the validity of the name and message variables is tested:
    - In `!$name` and `!$message`, "!" is a "not" operator; it is **_true_** if either variable is **_not true_**
    - The `||` symbol is an "or" operator

**PHP Pointer**: PHP has two "or" operators: the word "or", and the symbol `||`. The `||` operator has precedence over the word "or", providing flexibility in logic tests.

#### Line 86 - Current Date and Time

- The `$today` variable contains the result of the PHP function `date`:
- The `date` function returns a string
- The "switches" are interpreted as follows:
        - `F`: text month
        - `j`: numeric day within month
        - `y`: four digit year
        - `g`: hour (12 hour format)
        - `a`: AM / PM

#### Lines 89 to 94 - Interpolate Form Data with HTML

- Text and HTML tags are parsed with the `$today` variable and the form data.
- The `return` statement supplies the result (true or false) of a function or the value of a variable to the routine from which it was called.

<a name="_writeDataFile_function"></a>
### _writeDataFile Function

#### Lines 100 to 106 - Open the Data File

- The `fopen` function opens the file stored in the `$this->gb_dat` variable.
- The `w` switch opens the file if it exists.
- If the file does not exist, `fopen` will attempt to create it.
- The file is opened for writing only, and the file pointer is positioned at the top of the file.
- The `if !$f` statement checks to see if the `$f` variable contains a value.

#### Lines 108 to 110 - Write to the Data Files

- The `fwrite` function writes the contents of $this->data to the file contained in the `$f` variable.

#### Lines 111 to 113 - Close the Data File

- The `fclose` function closes the file stored in the `$f` variable
- The value of the `return` statement is tested on line 112

**Tip**: Click on the minus symbol to the left of line 100. The entire`_writeDataFile` function collapses. This is [Code Folding](/manual/editor.html#Folding).

<a name="addGuestBookEntry_function" id="addGuestBookEntry_function"></a>
### addGuestBookEntry Function

#### Lines 120 to 125 - Call Functions for Writing Data

- The `$entry` variable is local to the `addGuestBookEntry` function.
- The `$entry` contains the contents of the `$data` variable, returned in the `_createEntryHTML` function.
- On line 123, the contents of `$entry` are concatenated with the contents of `$this->data`, and stored in `$this->data`.

<a name="outputForm_function" id="outputForm_function"></a>
### outputForm Function

#### Lines 127 to 142 - The Function for HTML Form

- These lines generate a standard HTML form.
- Notice the PHP snippet on line 133 that provides the program name to the HTML output.

<a name="Closing_tags" id="Closing_tags"></a>
### Closing Tags

#### Lines 148 to 151 - Closing Tags

- The `$gb` variable creates a new instance of the `GuestBook` class using the file specified in the `$datafile` variable.
- When the functions in the `GuestBook` class are complete, the PHP program is closed using the syntax `?>`.
- Closing HTML tags are written as output.

<a name="phptut_run" id="phptut_run"></a>
## Running the Program

This section reviews how to run the _guestbook.php_ program using the Komodo [debugger](/manual/debugger.html).

1.  **Run the debugger**: Select **Debug** > **Go/Continue**.
1.  **Configure debugging options**: In the [Debugging Options](/manual/debugger.html#Debugging_Options) dialog box, configure the following options:
    - **General tab:**
        - Select the **Use the CGI interpreter (php-cgi or php)** check box.
        - Select the **Simulate CGI Environment** check box.
    - **CGI Input tab:**
        - Set the **Request Method** option button to **Post**.
        - On the **Post Type** drop-down list, select **URL encoded**.
        - On the **Type** drop-down list, select the variable type **Post**.
        - Enter the following names in the **Name** text box, adding a meaningful value for each in the **Value** text box. For example, the value for "name" could be your own name. Click the **Add** button after each entry to add it to the **Browser Arguments**.
            - name
            - email
            - company
            - message
1.  **Run the debugger**: Click **OK** to run the debugger with the selected options.
1.  **View the Command Output tab**: Notice the messages in the bottom left corner of the Komodo screen that inform you of the status of the debugger.
1.  **View the rendered HTML**: Click the **HTML** tab on the right side of the **Debug** tab. The HTML is displayed in the Bottom Pane; previous guestbook entries are displayed at the top of the output, and the HTML form is displayed at the bottom. Click the **Output** tab to return to the HTML code.
1.  **Create New File**: To create a new HTML file that contains the HTML code on the **Output** tab, select **File** > **New** > **New File**. In the New File dialog box, select the **Common** Category, and the **HTML** template. Click **Open**.
1.  **Save the Output**: Delete the contents of the new HTML file tab in the Editor Pane, then select the HTML code on the **Output** tab. Copy the contents to the new HTML file tab in the Editor Pane using the [key binding](/manual/prefs.html#Config_Key_Bindings) associated with your selected scheme. Select **File** > **Save As** to save the file with a unique name.

<a name="phptut_debug" id="phptut_debug"></a>
## Debugging the Program

In this step you will add breakpoints to the program and debug it. Adding breakpoints lets you run the program in chunks, making it possible to watch variables and view output as it is generated. Before beginning, ensure that line numbering is enabled in Komodo (**View** > **View Line Numbers**).

**Tip**: Debugger commands can be accessed from the **Debug** menu, by shortcut keys, or from the Debug Toolbar.

- **Step In**: Executes the current line of code and pauses at the following line.
- **Step Over**: Executes the current line of code. If the line of code calls a function or method, the function or method is executed in the background and the debugger pauses at the line that follows the original line.
- **Step Out**: Executes the code without stepping through the code line by line (when the debugger is within a function or method). The debugger stops on the line of code following the function or method call in the calling program.

For a summary of debugger commands, see [Debugger Command Description](/manual/debugger.html#How_use_Debugger).

1.  **Set breakpoints**: On the **guestbook.php** tab in the editor, click on the gray margin immediately to the left of the code in line 9 of the program. This sets a breakpoint, indicated by a red circle. Set a second breakpoint on line 148.
1.  **Run the debugger**: Select **Go** > **Continue**. In the [Debugging Options](/manual/debugger.html#Debugging_Options) dialog box, click **OK** to accept the defaults (assuming that you created the CGI variables in the previous step, [Running the Program](#phptut_run)). The [Debugger Options](/manual/debugger.html#Debugging_Options) have been saved from the last time a PHP program was run or debugged.
1.  **Watch the debug process**: A yellow arrow on the breakpoint indicates the position at which the debugger has halted.
1.  **Line 9: Step In**: Select **Debug** > **Step In**. "Step In" is a debugger command that causes the debugger to execute the current line and then stop at the next processing line (line 19). The lines between line 9 and line 19 are comments, not processing statements, and are therefore ignored by the debugger.
1.  **View Variables**: Expand the Bottom Pane (if necessary) by clicking and dragging the bottom margin of the Komodo workspace. Variables defined in the program are displayed on the **Locals** tab.
1.  **Line 19**: Select **Go** > **Continue**. The debugger moves to line 148. The `GuestBook` class is called from line 148.
1.  **Line 148: Step In**: The debugger is now processing the `GuestBook` function.
1.  **View Variables**: The **Locals** tab displays all variables.
1.  **Line 35: Step In**: Expand the `$this` variable on the **Locals** tab in the Bottom Pane. Notice that it now has a sub-variable `gb_dat`, which stores the value of the data file.
1.  **Line 36: Step In**: Continue to step in until the debugger stops at the `_getData` function. Continue to select **Step In** to process each statement in the function. After line 57 has been processed and the debugger is stopped at line 58, the `$lines` variable can be expanded on the **Locals** tab.
1.  **Line 58: Step Out**: On line 58, select **Step Out** to process the rest of the `_getData` function. The debugger will proceed to line 40, which follows the line where `_getData` was called.
1.  **Line 40: Step In**: Continue to select **Step In** until the debugger is on line 121, in the `addGuestBookEntry` function. On line 121, the `addGuestBookEntry` function calls the `_createEntryHTML` function.
1.  **Line 121: Step In**: In the `_createEntryHTML` function, the program assigns variables to the CGI input data configured in the [Debugging Options](/manual/debugger.html#Debugging_Options).
1.  **Line 74: Step Out**: The `_createEntryHTML` function completes, and processing returns to line 122.
1.  **Line 122: Step In**: Use **Step In** to process each line of the `addGuestBookEntry` function, until processing moves to the `_writeDataFile` function on line 102.
1.  **Line 102: Step In**: Process line 102.
1.  **Open Watch Window**: On line 102, the program opened the datafile (by default, `\tmp\guestbook.dat`). To watch the activity in the datafile, select **Tools** > **Watch File**, then specify the datafile.
1.  **Line 103: Step In**: Continue to select **Step In** until line 108 has been processed. After line 108 is processed, the contents of the `$this->data` variable are written to the datafile, as displayed in the **Watch** tab.
1.  **Line 111: Step In**: **Step In** until processing returns to line 45 of the `GuestBook` function.
1.  **Line 45: Step Over**: The **Step Over** debugger command executes the current line, including any functions called by the current line. When the debugger returns to line 46, notice that the contents of the `$this->data` variable have been written to the Bottom Pane.
1.  **Line 46: Step Over**: The debugger executes the `outputForm` function, which writes the HTML form to the Bottom Pane.
1.  **Continue**: Select **Debug** > **Continue** to run the debugger to the end of the program.

<a name="phptut_resources" id="phptut_resources"></a>
## More PHP Resources

### Tutorials and Reference Sites

There are many PHP tutorials and beginner PHP sites on the Internet, including [www.PHP.net](http://www.php.net), the home of all that is PHP-related.
