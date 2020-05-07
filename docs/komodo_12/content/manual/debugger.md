---
title: Debugging your programs
---
(Komodo IDE only)

The Komodo debugger is a tool for analyzing programs on a line-by-line basis, monitoring and altering variables, and watching output as it is generated. Debugging features include:

- breakpoint and spawnpoint control
- remote debugging
- stepping
- watching variables
- viewing the call stack
- sending input
- adding command-line arguments
- interactive shell

The sections that follow contain general information about the debugger that is applicable to each language. Komodo provides debugging support for Perl, Python, PHP, Ruby, XSLT, Tcl, and JavaScript (via Google Chrome). For information about configuring languages and language-specific debugger functions, see:

- [Debugging Perl](debugperl.html) 5.*
- [Debugging Python](debugpython.html) 2.4 - latest
- [Debugging PHP](debugphp.html) 4.4 - latest
- [Debugging NodeJS](debugnode.html) 0.8 - latest
- [Debugging Ruby](debugruby.html) 1.8 - latest
- [Debugging Tcl](debugtcl.html)
- [Debugging XSLT](debugxslt.html)
- [Debugging JavaScript with Google Chrome](debugchrome.html)

**Note**: Ensure that your system meets the software prerequisites for debugging, as described in the [installation prerequisites](/install.html).

<a name="Starting_the_Debugger"></a>
## Starting the Debugger

To start the debugger, do one of the following:

- **Debug Menu**: Click **Go/Continue** or **Step In**.
- **Keyboard**: Use the associated [key binding](prefs.html#Config_Key_Bindings).
- **Debug Toolbar**: Select **Go/Continue** or **Step In**.

![Debugging Toolbar](/images/debugging_toolbar.png)

By default, the [Debugging Options](#Debugging_Options) dialog box is displayed (unless the [debugger preference](prefs.html#Debugger) has been configured to start without displaying the dialog box). To override the debugger preference on Windows and Linux systems, hold down the 'Ctrl' key while invoking the key binding for starting the debug session. (Select **Help** > **List Key Bindings** to view the current key bindings; use the [key bindings preference](prefs.html#Config_Key_Bindings) to configure custom key bindings.) Alternatively, the 'Ctrl' key can be used to suppress the display of the **Debugging Options** dialog box.

If multiple files are open in the [Editor Pane](workspace.html#Editor_Pane), the program that is currently displayed is debugged. If no breakpoints are set, **Go/Continue** causes the debugger to run to the end without stopping. **Step In** moves through the program one line at a time.

If the [Bottom Pane](workspace.html#Output_Pane) is hidden, Komodo automatically shows it.

To run a program without debugging, do one of the following:

- **Debug Menu**: Select **Run without debugging**.
- **Keyboard**: Use the associated [key binding](prefs.html#Config_Key_Bindings).

To run a program to the current cursor position, do one of the following:

- **Debug Menu**: Select **Run to Cursor**.
- **Keyboard**: Use the associated [key binding](prefs.html#Config_Key_Bindings).

By default, the debugger will break on the first line of executable code when it starts. This is useful for adding [breakpoints](#breakpoints_and_spawnpoints) if none have been set yet. To change this behavior, set **Initial break behavior** to **Run to first breakpoint** in the [debugger preferences](prefs.html#Debugger) (**Edit** > **Preferences**: **Debugger**).

<a name="multi_session_debug"></a>
### Multi-Session Debugging

Komodo supports the concurrent debugging of multiple applications, or multi-session debugging. With multi-session debugging, Komodo debugs more than one project at a time, regardless of the supported languages used in the programs being debugged.

When debugging multiple sessions, each session has a unique **Debug** tab (located in the Bottom Pane) for controlling the debug actions specific to that process. A **Debug** tab is created each time a new debugger session is started. To close a **Debug** tab, click the X button at the top right corner.

To start multiple debugging sessions, do one of the following:

- **Debug Menu**: Click **Start New Session**.
- **Keyboard**: Use the associated [key binding](prefs.html#Config_Key_Bindings).

<a name="Debugging_Options"></a>
## Debugging Options

When the debugger is invoked, the Debugging Options dialog box is displayed. Use this to configure the system environment, command-line arguments, CGI environment, and other debugging options.

Not all of the debugging options described below apply to all languages. The available tabs and fields depend on the interpreter used to debug the file. The interpreter is determined by the [File Associations](prefs.html#File_Associations) configured for the active file in the [Editor Pane](workspace.html#Editor_Pane).

To suppress the display of the Debugging Options dialog box on Windows and Linux systems, hold down the 'Ctrl' key while clicking the desired debugging button on the Debug Toolbar, or use the desired keyboard shortcut. Change the default display by selecting **Skip debug options dialog** from **Edit** > **Preferences** > **Debugger**.

<a name="Debugging_Options_Global"></a>
### Global Options

These options are displayed regardless of which configuration tabs are available.

- **Language**: The language of the file being debugged.
- **Simulate CGI Environment**: Select this check box to display two additional CGI option tabs - [CGI Environment](#Debugging_Options_CGI_Environment) and [CGI Input](#Debugging_Options_CGI_Input).
- **Debug in separate console**: Select this check box to display the debug process in a separate console window rather than the **Output** tab. As applicable, the console window displays program output and prompts for program input.

<a name="Debugging_Options_General"></a>
### General Tab

- **Interpreter Arguments**: As required, enter command line options and arguments for the interpreter in this field. Use the **Shortcut** button to the right of the input field to select common language-specific options.
- **Script**: Enter the name of the script to be debugged. By default, this field contains the full path and name of the program displayed in the Editor pane. When manually specifying a script, UNC or SMB paths (which identify remote machines on a local area network via the "\\" prefix) are not supported. Instead, map the network share to a drive letter (Windows) or mount the share on the filesystem (OS X and Linux). When set as a [Project setting](project.html#project_prefs), this is the script that Komodo opens for debugging when a session is started from _any_ file in the project. This is useful when working in modules which are called by a 'main' program. When debugging JavaScript with Google Chrome, this field is either the URI to a local file (e.g. `file://path/to/file`) or a URL (e.g. `http://localhost/`). If it is a URL, the URL must be already open in Google Chrome.
- **Script Arguments**: As required, enter arguments for the script in this field as they would appear on the command line. Multiple Arguments must be separated with spaces. If the **Simulate CGI Environment** box is selected, and CGI Input variables of the type **GET** are set, the contents of this field are ignored.
- **Directory**: Specify the directory to start the program in. If unset, the program starts in the directory where it resides.
- **Select the input XML file**: (XSLT only) Specify the name and location of the input XML file.
- **Select the interpreter to use for debugging**: (PHP and Tcl only) For Tcl programs, select **tclsh** or the **wish** interpreter, depending on whether you are debugging a console or a GUI application. For PHP programs, select the CLI (Command Line Interface) or CGI (Common Gateway Interface) interpreter. These selections reference the interpreters configured under **Edit** > **Preferences** in the [Language Configuration](prefs.html#lang_config) section.
- **Select the directory that contains the php.ini file**: (PHP only) If more than one version of PHP exists on the system, specify the directory that contains the php.ini file you wish to use.
- **Disable Output Buffering (PHP only)**: Output from the PHP interpreter is not buffered (it is displayed as it occurs) if this option is enabled. This option has no effect when **Simulate CGI Environment** is selected. To disable output buffering in CGI emulation mode, comment out the `output_buffering` setting in `php.ini` with a ";" character, or set it to "`off`".
- **Enable Implicit Flush (PHP only)**: The PHP output layer flushes itself automatically after every output block. If this option is not enabled, output is buffered by the operating system and is flushed periodically by the operating system, or when the application is finished. This option has no effect when **Simulate CGI Environment** is selected.

<a name="Debugging_Options_Environment"></a>
### Environment Tab

The **Environment** tab displays all environment variables set on the system. Use this tab to add new variables or change the values of existing variables for the duration of the debug session. The **Default Environment Variables** pane displays environment variables that have been declared on your system. The **User Environment Variables** pane displays environment variables set in the saved configuration which override the **Default Environment Variables**.

Change variables by adding a new variable with the same name and a new value. These changes have no effect outside of the Komodo debugger and are stored in each saved configuration.

- **To Add New Variables**: Click **New** and enter the **Variable Name** and **Variable Value** in the Environment Variable dialog box. To add one or more directories to the **Variable Value** field, click **Add Path** and navigate to the desired directory.
- **To Edit Existing Variables**: Select the variable, click **Edit**, then change as desired. This creates a new variable with the same name and the desired value. (User Environment Variables take precedence over Default Environment Variables.)
- **To Delete a Variable**: Select the variable from the **User Environment Variables** pane and click **Delete**. **Default Environment Variables** cannot be deleted, but can be set to an empty value.

<a name="Debugging_Options_CGI_Environment"></a>
### CGI Environment Tab

The **CGI Environment** tab is only displayed if the **Simulate CGI Environment** check box is selected on the [General tab](#Debugging_Options_General). It displays CGI Environment Variables commonly configured on a web server. Use this tab to alter existing variables and add new variables. Variable changes have no effect outside of the Komodo debugger and are stored in each saved configuration.

- **To Add New Variables**: Click **New**, and enter the **Variable Name** and **Variable Value** in the Environment Variable dialog box. To add one or more directories to the **Variable Value** field, click **Add Path** and navigate to the desired directory.
- **To Edit Existing Variables**: Select the variable, click **Edit**, then change as desired. This creates a new variable with the same name and the desired value. (**User CGI Environment Variables** take precedence over **Default CGI Environment Variables**.)
- **To Delete a Variable**: Select the variable from the **User CGI Environment Variables** pane and click **Delete**.

<a name="Debugging_Options_CGI_Input"></a>
### CGI Input Tab

The **CGI Input** tab is only displayed if the **Simulate CGI Environment** check box is selected on the [**Global Options**](#Debugging_Options_Global) tab. It is used to configure the CGI form type and variables for the purpose of simulating CGI input. Note that Komodo's CGI emulation does not generate HTTP Request Headers; rather, it executes the CGI directly by emulating a web server environment.

- **Request Method**: Select the request method that has been assigned to the form in the CGI program.
- **Post Type**: Select the format in which data is sent from the browser to the server.

Use the **Request Variable** section of the dialog box to create variables that are processed by your CGI program. These variables are displayed in the **Browser Arguments** section of the dialog box.

- **Type**: Specify the type of input associated with the variable (GET, POST, cookie or file).
- **Name**: Enter the variable name as specified in the CGI program.
- **Value**: Enter the value for the variable specified in the **Name** field. To provide a directory path and file, click the **Browse Files** button, select the desired file and click **Add**. (To accommodate file uploads, select **Multipart** as the form's **POST** method.)

**To alter variables:** Click on the desired variable in the **Browser Arguments** section of the dialog box, make changes in the **Type**, **Name** and **Value** fields, then click **Update**.

**To delete variables:** click on the desired variable in the **Browser Arguments** section of the dialog box, and click **Delete**.

<a name="debugger_storingconfig"></a>
### Storing Debug Configurations

Debugging options can be saved as "named configurations" in the **Debug Configuration** panel. To save the current configuration:

1.  Click **New**
1.  Enter a unique **Configuration Name**.
1.  Click **OK**.

Existing saved configurations can be selected from the drop-down list. If you wish to delete a saved configuration, select it from the list and click **Delete**.

If the file being debugged is part of a [project](project.html#project_top) that is currently open, these preferences are saved in that project. If not, this configuration is automatically saved as part of the file's [Properties and Settings](files.html#files_settings) (although they cannot be altered via the file's **Properties** dialog box).

<a name="breakpoints_and_spawnpoints"></a>
## Breakpoints and Tcl Spawnpoints

Breakpoints are set at lines in the program where you want program execution to pause. Enabled breakpoints appear as solid red circles in the left margin of the Editor pane and are also listed on the **Breakpoints** tab during debugging. Disabled breakpoints appear as white circles with a red outline. Double-clicking on an enabled or disabled breakpoint from the **Breakpoints** tab opens the associated file in the Editor Pane and shifts focus to the line number for that break location.

Spawnpoints are set at points in a Tcl script where you want an external application to execute (spawn). When a spawnpoint is encountered during the debugging process, Komodo configures the spawned application to start as a new debugger session. Both the initial and spawned debugger sessions run concurrently. Enabled spawnpoints appear as solid green arrows in the left margin of the Editor pane and are also listed on the **Breakpoints** tab during debugging. Disabled spawnpoints appear as white arrows with a green outline. Double-clicking an enabled or disabled spawnpoint from the **Breakpoints** tab opens the associated file in the Editor pane and shifts focus to the line number coinciding with that spawnpoint location.

<a name="breakpoint_management"></a>
### Breakpoint and Spawnpoint Management

Breakpoints and spawnpoints can be monitored and managed on the **Breakpoints** tab in the Bottom pane (displayed during debugging or invoked by selecting **View** > **Tabs & Sidebars** > **Command Output**). This tab lists all breakpoints and spawnpoints set in the program. Use the **Breakpoints** tab to:

- [toggle breakpoints](#toggle_breakpoint)
- [toggle spawnpoints](#toggle_spawnpoint)
- [go to source code](#go_source)
- [set breakpoint properties](#set_breakpoint_prop)

<a name="toggle_breakpoint"></a>
#### Toggling Breakpoints

Breakpoints and Spawnpoints can be toggled between enabled, disabled and deleted. To toggle a breakpoint, do one of the following:

- **Breakpoint Margin**: Click on the line you wish to break at once to enable a breakpoint, a second time to disable it, and a third time to delete it.
- **Debug Menu**: Click **Enable/Disable Breakpoint** once to enable a breakpoint on the current line, a second time to disable it, and a third time to delete it.
- **Keyboard:** Press 'F9' ('Cmd'+'\' on macOS) once to enable a breakpoint on the current line, a second time to disable it, and a third time to delete it.

To create a new breakpoint in the **Breakpoints** tab:

1.  Click the **New** button and then select **New Breakpoint** or right-click in the Breakpoints pane and select **Add** > **New Breakpoint** on the context menu.
1.  The following [Breakpoint Properties](#set_breakpoint_prop) are required:
    - **Language**: By default, the language of the program being debugged.
    - **File**: The location of the file where the breakpoint is being set.
    - **Line**: The line number in the file where the spawnpoint is to be set.
    - **Enable**: Select the check box to enable the breakpoint.
1.  Click **OK**.

To delete a breakpoint in the **Breakpoints** tab, do one of the following:

- Select the breakpoint and click the **Delete Breakpoint** button
- Right-click on the breakpoint and select **Delete**.

To clear or remove multiple breakpoints, do one of the following:

- **Debug Menu**: Click **Clear All Breakpoints**.
- **Breakpoint Tab**: Click the **Delete All Breakpoints** button.
- **Keyboard**: Use the associated [key binding](prefs.html#Config_Key_Bindings).

To disable or enable all breakpoints:

- On the **Breakpoints** tab, click the **Disable/Enable All Breakpoints** button. All breakpoints are disabled if previously enabled, or enabled if previously disabled.

<a name="toggle_spawnpoint"></a>
#### Toggling Spawnpoints

To add a Tcl spawnpoint, use the **Breakpoints** tab:

1.  Click the **New** button and then select **New Tcl Spawnpoint** or right-click in the Breakpoints list and select **Add** > **New Tcl Spawnpoint** on the context menu.
1.  The following properties are configurable in the Spawnpoint Properties dialog box:
    - **Language**: Tcl
    - **File**: The location of the file where the spawnpoint is to be set (for example, `C:\samples\tcl_sample.tcl`).
    - **Line**: The line number in the file where the spawnpoint is to be set.
    - **Enable**: Select the check box to enable the spawnpoint. Deselect the check box to disable the spawnpoint.
1.  Click **OK**.

To delete a spawnpoint in the **Breakpoints** tab, do one of the following:

- Select the spawnpoint and click the **Delete Breakpoint** button
- Right-click on the spawnpoint and select **Delete**.

To clear or remove multiple spawnpoints, do one of the following:

- **Debug Menu**: Click **Clear All Breakpoints**.
- **Breakpoint Tab**: Click the **Delete All Breakpoints** button.
- **Keyboard**: Use the associated [key binding](prefs.html#Config_Key_Bindings).

To disable or enable all spawnpoints:

- On the **Breakpoints** tab, click the **Disable/Enable All Breakpoints** button. All spawnpoints are disabled if previously enabled, or enabled if previously disabled.

**Note:** Breakpoints and spawnpoints added or modified while a program is running are not necessarily updated in the breakpoint manager. To add breakpoints while debugging, interrupt the debugging session using the **Break** button to ensure that the new breakpoint is properly updated.

<a name="go_source"></a>
#### Go to the Source Code

To open the source code in the Editor Pane at the line number where the breakpoint or spawnpoint is set, do one of the following:

- **Breakpoints Tab**: Double-click the breakpoint to view the associated source code.

- **Breakpoints Tab**: Select the desired breakpoint and click the **Go to the Source Code** button.

<a name="set_breakpoint_prop"></a>
#### Breakpoint Properties

When adding or editing a breakpoint in the **Breakpoint** tab, a **Breakpoint Properties** dialog box appears. This dialog box contains a tab for each available breakpoint type. Change the breakpoint type by switching to a different tab.

Each tab is split into two parts, separated by a horizontal line. The top section contains configuration items that are required; the bottom section contains configuration options that are optional. The last item on this tab is the Enable checkbox.

- **Language**: The language of the file where the breakpoint is to be set.
- **File**: The line number on which to break.
- **Condition**: Evaluate some code and break if it evaluates to true. For example, `0==0`, as the condition would always evaluate to true and cause the debugger to break. The condition should be specified in the syntax of the language selected in the **Language** drop-down list.
- **Watch**: Break when the value of the specified variable (or expression) is set or changed.
- **Function Call**: Break after the specified function is called.
- **Function Return**: Break after the specified function has finished executing.
- **Exception**: Break when the specified exception is caught.
- **Line**: Break on the specified line.
- **Hit Counts**: Break when the condition specified in any of the above has been met a certain number of times. Each time the debugger engine reaches a breakpoint, it adds one to the count. It then looks at the hit count setting to see if the evaluation allows for a break at that moment. There are two configuration items related to hit counts, the condition and the count. There are three types of conditions:
    - Break when hit count is greater than or equal to
    - Break when hit count is equal to
    - Break when hit count is a multiple of

For example:

1.  Set a breakpoint on line 2 of a script.

    ```
    for 1 in range(256):
            print 'hello'
    ```

1.  Define a hit condition 'Break when hit count is a multiple of'.
1.  Enter the value 5\. The debugger breaks every 5th time it passes the line with the print statement.

Not all breakpoint types are supported for all languages. The following table shows breakpoint support by language:

<table>
    <tbody>
        <tr>
            <th>Type</th>
            <th>Tcl</th>
            <th>Perl</th>
            <th>PHP</th>
            <th>XSLT</th>
            <th>Python</th>
            <th>Ruby</th>
            <th>Google Chrome</th>
        </tr>
        <tr>
            <td>Line Number</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
        </tr>
        <tr>
            <td>Function Call</td>
            <td>No</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>No</td>
            <td>No</td>
        </tr>
        <tr>
            <td>Function Return</td>
            <td>No</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>No</td>
            <td>No</td>
        </tr>
        <tr>
            <td>Exception</td>
            <td>No</td>
            <td>No</td>
            <td>Yes</td>
            <td>No</td>
            <td>Yes</td>
            <td>No</td>
            <td>No</td>
        </tr>
        <tr>
            <td>Conditional</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
        </tr>
        <tr>
            <td>Watch</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>No</td>
            <td>No</td>
            <td>Yes</td>
            <td>No</td>
            <td>No</td>
        </tr>
    </tbody>
</table>

<a name="debug_break"></a>
#### Forcing a Break

Use the **Break Now** function to stop debugging an application at the current execution point, and then continue debugging from that point. For example, use this control when debugging applications running long processes. To force a break while debugging an application, do one of the following:

- <b>Debug Menu</b>: Select **Break Now**.
- <b>Debug Toolbar</b>: Click the **Break Now** button.

<a name="remote_debugging"></a>
## Remote Debugging

Remote debugging usually involves executing code on a remote machine while observing and controlling the debugging process from within Komodo. Remote debugging sessions are initiated from the command line or from code in the program itself. This approach is useful for debugging applications in the environments where they are ultimately run (e.g. CGI programs on a live web server), and for client/server applications.

Komodo can be set to [Listen for Debugger Connections](#set_remote_debug) continuously. Additionally, you can set remote debugger preferences and [check listener status](#check_listener_status) of the current listener configuration. For instructions on configuring specific languages for remote debugging, see:

- [Debugging Perl](debugperl.html)
- [Debugging Python](debugpython.html)
- [Debugging PHP](debugphp.html)
- [Debugging XSLT](debugxslt.html)
- [Debugging Tcl](debugtcl.html)
- [Debugging JavaScript with Google Chrome](debugchrome.html)

<a name="when_to_remote_debug"></a>
### When to use Remote Debugging

Remote debugging is most commonly used to debug programs on a remote server, but there are other instances where it is useful or necessary:

- Running programs on an unsupported platform/OS: Some interpreters running in an embedded environment or on an operating system that Komodo itself does not run on can use the debugging libraries provided by Komodo:
    - PHP: [Xdebug](http://xdebug.org/) can be compiled or cross-compiled for the target platform.
    - Perl: The "pure-Perl" remote debugging libraries should work on most platforms.
    - Python: The remote debugging libraries have "pure-Python" fallbacks if the binaries cannot be run.
    - Ruby: The remote debugging libraries use [ruby-debug](http://rubyforge.org/projects/ruby-debug/) and [byebug](https://github.com/deivid-rodriguez/byebug), depending on the Ruby version. These platform and version-specific components can be compiled separately or [installed as gems](trouble.html#ruby_debug_x64).
    - JavaScript: As long as the host can run the [Google Chrome](https://www.google.com/chrome) web browser in remote debugging mode, a client machine running Komodo can communicate with it.
- Post-mortem debugging: Error trapping code in a program can be used to initiate a remote debugging session before exiting (also called "just-in-time" debugging).
- Running programs in [Cygwin](http://www.cygwin.com/): The language interpreters in Cygwin are not stand-alone Win32 applications; they need to be run from within the Cygwin shell. Komodo cannot use these interpreters directly for local debugging, but can accept remote debugging connections from them.

Consult the language-specific debugging documentation listed above for configuration instructions.

<a name="set_remote_debug"></a>
### Listen for Debugger Connections

To toggle continuous listening for remote debugging, do one of the following:

- **Debug Menu**: select **Listen for Debugger Connections**.
- **Keyboard**: Use the associated [key binding](prefs.html#Config_Key_Bindings).

**Note:** A check mark appears when **Listen for Debugger Connections** is enabled. Otherwise, this feature is disabled.

<a name="check_listener_status"></a>
### Check Listener Status

To check the status and current configuration of the Komodo debugger:

1.  On the **Debug** menu, select **Listener Status**. The **Debugger Listener** status screen appears.
1.  Click **OK** after reviewing listener status, or use the associated [key binding](prefs.html#Config_Key_Bindings).

<a name="multi_user_debugging"></a>
### Multi-User Debugging

When multiple users are running Komodo session, configure Komodo's **Debugger Connection Options** to listen for debug connections on port "0" (see [Set Debugger Preferences](prefs.html#Debugger)). The system provides Komodo with a unique port each time Komodo is started, allowing multiple users on the system to debug applications simultaneously. In remote debugging, this requires the remote debugger application to be manually set to connect on the system-allocated port unless the **Debugger Proxy** is used.

<a name="remote_uri_mapping"></a>
### Mapped URIs for Remote Debugging

By default, Komodo recieves a read-only copy of the program from the debugger. You can set breakpoints in this copy to control how it executes, but you cannot make changes to it or have the breakpoints persist across debugging sessions. For Komodo to open an editable copy of the file (i.e. the original program file), a [URI mapping](prefs.html#mapped_uris) must be created to link the file on the remote filesystem with the URI Komodo receives from the remote debugger.

The incoming URI for a remote debugging session is in the form:

```
file://_server name or ip address_/path/to/file
```

For example, the file `/www/htdocs/php/info.php` on a server named `myserver`, would send the following URI to Komodo:

```
file://myserver/www/htdocs/php/info.php
```

If `myserver` was accessible via SFTP, you could add the following mapping in Komodo's [Preferences](prefs.html#mapped_uris):

**URI**: file://myserver/www
**Path**: sftp://user@myserver/apache/www

This mapping would apply to all files in `www` and its subdirectories.

The **Path** can include remote files accessed via FTP, SFTP or SCP as well as files on the local filesystem.

Mapped URIs can also be specified by right-clicking on the editor tab and selecting **Create Mapped URI** from the context menu. By default, the **Path** field will show the full path of the file in that editor tab. This path can be shortened to include more files and directories in the mapping (as above).

<a name="dbgp_proxy"></a>
### Debugger Proxy

Remote debugger processes can communicate with Komodo through the **DBGP proxy** (debugger protocol proxy). The proxy allows Komodo to use a system-allocated listener port for debugging without the user having to manually configure the same port number on the remote debugger. This is useful for running multiple remote debugging sessions and on networks where a remote debugging process can not connect to Komodo directly. The proxy can run on the local machine, the remote machine, or a separate machine.

A typical DBGP Proxy connection is established as follows:

1.  Komodo contacts the DBGP proxy and identifies itself with:
1.  - **Hostname or IP**: The hostname or IP address of the machine Komodo is running on. This is set to `localhost` or 127.0.0.1 if the debugger is running locally.
    - **Port Number**: The port configured in **Preferences: Debugger** or the system-assigned port.
    - **Proxy Key**: The **Proxy Key** configured in **Preferences: Debugger**. If unset, Komodo will use the USER or USERNAME environment variable value.
1.  The DBGP Proxy stores this information.
1.  The remote debugging process contacts the DBGP Proxy, providing an IDE Key which corresponds to the Proxy Key specified in Komodo. By default, this connection happens on port 9000 but can be configured to use another port (see language-specific debugging instructions and "-d" option below).
1.  DBGP Proxy uses the IDE Key value to match the connection to the appropriate instance of Komodo.
1.  The remote debugger connects to Komodo on the system-assigned or user-specified port.

To start the proxy on Windows:

```
set PYTHONPATH="<Komodo install directory>\lib\support\dbgp\pythonlib;%PYTHONPATH%"
cd <Komodo install directory>\lib\support\dbgp\bin
pydbgpproxy
```

To start the proxy on Linux:

```
export PYTHONPATH=<Komodo install directory>/lib/support/dbgp/pythonlib;$PYTHONPATH
cd <Komodo install directory>/lib/support/dbgp/bin
python pydbgpproxy
```

To start the proxy on OS X:

```
export PYTHONPATH=<Komodo install directory>/Contents/SharedSupport/dbgp/pythonlib;$PYTHONPATH
cd <Komodo install directory>/Contents/SharedSupport/dbgp/bin
python pydbgpproxy
```

The following options are available:

- **-d &lt;hostname:port&gt;**: Listener port for debugger processes.
- **-i &lt;hostname:port&gt;**: Listener port for Komodo instances.
- **-l &lt;log_level&gt;**: Logging level. Logging is dumped to `stout` and can be set to CRITICAL, ERROR, WARN, INFO or DEBUG.

**Example**

If you are debugging scripts on a remote web server that cannot connect to Komodo directly because of a firewall, you can run dbgpProxy on an intermediary server (e.g. a gateway) which can connect to Komodo and the web server on specified ports. The three servers in this example are:

1.  **workstation**: The machine running Komodo. The following preferences are set:
    - **Listen for Debugger Connections** is enabled.
    - **Enable Debugger Proxy** is selected.
    - **Listen for debug connections on port** is set to '0' (use system-assigned port)
    - **Proxy Listener Address** is set to `gateway:9001`
    - **Proxy Key** is set to "jdoe"
    - **Debug > Listener Status** displays a system-assigned **Host Port** of 37016.

1.  **gateway**: A gateway server with access to the internal and external networks. The proxy is running with the following options:
  ```
  dbgpProxy -i gateway:9001 -d gateway:9000
  ```

1.  **webserver**: The machine running a Python CGI script called `test.py`. The debugging process on 'webserver' is launched with the following command:

  ```
  python dbgpClient.py -d gateway:9000 -k "jdoe" test.py
  ```

The remote debugger running on 'webserver' (dbgpClient.py in this case) connects to the proxy (dbgpProxy.py) running on 'gateway'. The proxy uses the **IDE Key** "jdoe" to connect the debugger process to the Komodo instance listening with a **Proxy Key** of "jdoe". The proxy continues to communicate with the remote debugger on port 9000, but routes the debugging session to Komodo on port 37016.

<a name="Sending_Input"></a>
## Sending Input to the Program

When a program prompts for input, enter the desired input in the console window or **Output** tab (depending on the [Debugging Options](#Debugging_Options_Global) configuration), and press **Enter** to continue.

<a name="Debugging_Commands"></a>
## Using Debugger Commands

<a name="How_use_Debugger"></a>
### Debugger Command Description

This table lists common tasks and their Komodo commands.

<table>
    <tbody>
        <tr>
            <th width="50%">To do this:</td>
            <th width="50%">Complete these steps:</td>
        </tr>
        <tr>
            <td><b>Run</b> a program<br>The debugger runs until the program ends.</td>
            <td>
            <ul>
                <li><b>Debug Menu</b>: Select <b>Run Without Debugging</b></li>
                <li><b>Windows/Linux Keyboard</b>: Press <code>F7</code></li>
                <li><b>macOS Keyboard</b>: Press <code>Cmd+Ctrl+R</code></li>
            </ul>
            </td>
        </tr>
        <tr>
            <td><b>Start</b> the debugger.</br>The debugger runs until it encounters a breakpoint, or until the program ends.</td>
            <td>
            <ul>
                <li><b>Debug Menu</b>: Select <b>Go/Continue</b></li>
                <li><b>Windows/Linux Keyboard</b>: Press <code>F5</code></li>
                <li><b>macOS Keyboard</b>: Press <code>Cmd+></code></li>
                <li><b>Debug Toolbar</b>: Click the <b>Go/Continue</b> button</li>
            </ul>
            </td>
        </tr>
        <tr>
            <td><b>Step In</b><br>The debugger executes the next unit of code, and then stops at the subsequent line.</td>
            <td>
            <ul>
                <li><b>Debug Menu</b>: Select <b>Step In</b></li>
                <li><b>Windows/Linux Keyboard</b>: Press <code>F11</code></li>
                <li><b>macOS Keyboard</b>: Press <code>Cmd+Shift+I</code></li>
                <li><b>Debug Toolbar</b>: Click the <b>Step In</b> button</li>
            </ul>
            </td>
        </tr>
        <tr>
            <td><b>Step Over</b><br>Like <b>Step In</b>, <b>Step Over</b> executes the next unit of code. However, if the next unit contains a function call, <b>Step Over</b> executes the entire function then stops at the first unit outside of the function.</td>
            <td>
            <ul>
                <li><b>Debug Menu</b>: Select <b>Step Over</b></li>
                <li><b>Windows/Linux Keyboard</b>: Press <code>F12</code></li>
                <li><b>macOS Keyboard</b>: Press <code>Cmd+Ctrl+O</code></li>
                <li><b>Debug Toolbar</b>: Click the <b>Step Over</b> button</li>
            </ul>
            </td>
        </tr>
        <tr>
            <td><b>Step Out</b><br>The debugger executes the remainder of the current function and then stops at the first unit outside of the function.</td>
            <td>
            <ul>
                <li><b>Debug Menu</b>: Select <b>Step Out</b></li>
                <li><b>Windows/Linux Keyboard</b>: Press <code>Shift+F11</code></li>
                <li><b>macOS Keyboard</b>: Press <code>Cmd+Ctrl+T</code></li>
                <li><b>Debug Toolbar</b>: Click the <b>Step Out</b> button</li>
            </ul>
            </td>
        </tr>
        <tr>
            <td><b>Run to Cursor</b><br>The debugger runs until it reaches the line where the cursor is currently located.</td>
            <td>
            <ul>
                <li><b>Debug Menu</b>: Select <b>Run to Cursor</b>.</li>
                <li><b>Windows/Linux Keyboard</b>: Press <code>Shift+F10</code></li>
                <li><b>macOS Keyboard</b>: Press <code>Cmd+Shift</code>+<code>Ctrl+I</code></li>
            </ul>
            </td>
        </tr>
        <tr>
            <td><b>Break Now</b><br>Pause debugging an application at the current execution point. <b>Go/Continue</b> continues debugging from that point.</td>
            <td>
            <ul>
                <li><b>Debug Menu</b>: Select <b>Break Now</b></li>
                <li><b>Debug Toolbar</b>: Click the <b>Break Now</b> button</li>
            </ul>
            </td>
       </tr>
       <tr>
            <td><b>Stop</b><br>Stop the debugging session. <b>Go/Continue</b> restarts debugging from the beginning of the program.</td>
            <td>
            <ul>
                <li><b>Debug Menu</b>: Select <b>Stop</b></li>
                <li><b>Windows/Linux Keyboard</b>: Press <code>Shift+F5</code></li>
                <li><b>macOS Keyboard</b>: Press <code>Cmd+Ctrl+P</code></li>
                <li><b>Debug Toolbar</b>: Click the <b>Stop</b> button</li>
            </ul>
            </td>
        </tr>
        <tr>
            <td><b>Toggle breakpoint</b><br>Enables, disables, or deletes a breakpoint on the current line.</td>
            <td>
            <ul>
                <li><b>Debug Menu</b>: Select <b>Disable/Enable Breakpoint</b></li>
                <li><b>Windows/Linux Keyboard</b>: Press <code>F9</code></li>
                <li><b>macOS Keyboard</b>: Press <code>Cmd+\</code></li>
            </ul>
            </td>
        </tr>
        <tr>
            <td><b>Show Current Statement</b><br> Moves the editing cursor from any position in the file to the statement at which the debugger is stopped.</td>
            <td>
            <ul>
                <li><b>Debug Menu</b>: Select <b>Show Current Statement</b></li>
                <li><b>Windows/Linux Keyboard</b>: <code>Alt+*</code></li>
                <li><b>macOS Keyboard</b>: <code>Cmd+Shift+C</code></li>
            </ul>
            </td>
        </tr>
        <tr>
            <td><b>Detach</b><br>Stop the debugging process but continue application process execution.</td>
            <td>
            <ul>
                <li><b>Debug Menu</b>: Select <b>Detach</b></li>
                <li><b>Debug Toolbar</b>: Click the <b>Detach</b> button</li>
            </ul>
            </td>
        </tr>
    </tbody>
</table>

<a name="Debugger_Stepping_Behavior"></a>
### Debugger Stepping Behavior

Instead of running to the end of a program or to the next breakpoint, the debugger can also step through code one statement at a time. The following Debug menu items and toolbar buttons control stepping behavior:

- **Step In**: Executes the current statement and pauses at the following statement.
- **Step Over**: Executes the current statement. If the line of code calls a function or method, the function or method is executed in the background and the debugger pauses at the statement that follows the original one.
- **Step Out**: When the debugger is within a function or method, **Step Out** will execute the code without stepping through the code line by line. The debugger will stop on the line of code following the function or method call in the calling program.

When stepping through a program which calls a function or method from an external program (e.g. a module or package) the debugger steps into the external program at the point where the function or method is called, opening it in a new tab. Stepping continues in the external program until the function call is completed.

**Note**: Perl operators `sort`, `map`, and `grep` behave like other looping constructs with respect to stepping behavior in the debugger. When Komodo has stopped at one of these operators, **Step Over** stops at the first statement or expression used within the first argument of these operators.

For example, if the debugger steps over a statement containing a `foreach`, `while`, `map`, `grep`, or `sort` looping construct that evaluates its body five times, the debugger remains inside that loop for five iterations. When it steps over on the sixth iteration, the debugger exits the loop and stops at the next statement.

To skip execution of such looping constructs, set a breakpoint on the statement following the construct, and continue until Komodo reaches that breakpoint.

<a name="debug_session"></a>
## Viewing the Debugging Session

When the Komodo debugger is started, the **Debug** tab opens in the Bottom Pane. This tab consolidates views of the debugger output, call stack, program variables (local and global), and watch variables. The **Debug** tab also contains a Debug Toolbar for stepping in, out, over, and running functions while debugging.

When debugging more than one session at a time ([multi-session debugging](#multi_session_debug)), a **Debug** tab for each session is accessible in the Bottom Pane. The **Debug** tab selected is the session currently being debugged. To change to another debug session, select the **Debug** tab for that session (identified by the filename of the program). When a new session is started, a new **Debug** tab is created and Komodo automatically switches to that new session.

The **Debug** tab is divided into two sub-panes, which have tabs of their own. The [right sub-pane](#output_tab) contains the **Output**, **Call Stack**, and **HTML Preview** tabs. The [left sub-pane](#viewing_variables) contains variable tabs.

<a name="viewing_variables"></a>
### Viewing Variables

The variables section of the **Debug** tab is divided into tabs that vary according to the language of the program being debugged. (Language variations are described below.) Variables with multiple values (such as arrays) are indicated by plus and minus symbols to the left of the variable name.

**To Expand or Collapse Variables**: Plus symbols indicate variables with multiple values that can be expanded; minus symbols indicate variables that can be collapsed. Click on the plus or minus symbol to expand or collapse the variable list.

**To Change Variable Values**: Double-click in the variable's **Value** field and enter the desired value. (The value of nodes in XML documents cannot be changed.)

<a name="debugger_python_var_obj"></a>
#### Python Variables and Objects

While debugging Python programs, variables and objects are displayed on the **Locals**, **Globals**, and **Code Objects** tabs:

- **Locals**: Displays variables referenced within the current function. If the program is currently outside of a function, all variables are displayed.
- **Globals**: Displays all used program variables.
- **Code Objects**: Displays an expandable tree view of all classes, functions, and their attributes.

During Python debugging sessions, click the **Show Hidden Variables** [[img/intshell_hidden_variables.gif]]button to display special Python variables prefixed with double underscores, such as `__doc__`, `__dict__`, etc.

<a name="debugger_pyphptcl"></a>
#### PHP and Tcl Variables

While debugging PHP and Tcl programs, variables are displayed on the **Locals** and **Globals** tabs:

- **Locals**: Displays variables referenced within the current function. If the program is currently outside of a function, all variables are displayed.
- **Globals**: Displays all used program variables. **Note**: PHP "Super Globals" ($_POST, $_GET, etc.) are hidden by default. The **Show Hidden Variables** button will toggle them on and off.

<a name="debugger_perl_tabs"></a>
#### Perl Variables

While debugging Perl programs, **Argument** and **Special** tabs are displayed in addition to the **Locals** and **Globals** tabs listed above.

- **Argument**: Displays parameters for the current subroutine (i.e. @_).
- **Special**: Displays current Perl special variables (i.e. @ARGV, %ENV, @INC, $0, etc.)

<a name="debugger_varsxslt"></a>
#### XSLT Variables

While debugging XSLT programs, data nodes and variables are displayed on the **Locals** and **Globals** tabs:

- **Locals**: Displays data nodes from the input XML document. Only nodes contained in the context of the template specified in the **Call Stack** are displayed.
- **Globals**: Displays `xsl:param` and `xsl:variable` elements declared at the top level of the program.

<a name="Watching_Variables"></a>
### Setting Watched Variables

The **Watch** variable tab monitors selected variables and expressions. Use the **Watch** variable tab to watch variables, or expressions based on variables, by [typing expressions](#enter_expressions), dragging and dropping expressions from an editor, or selecting variables from one of the other variable tabs. Also, use the **Watch** tab to [change the value of a variable](#change_the_values_of_variables) or [remove a variable](#remove_a_watched_variable) from the **Watch** tab.

Watched variables can be added, manipulated and removed regardless of whether the debugger is currently running.

To watch one or more variables during program execution:

- Click the **Add** button on the **Watch** variables tab and type a variable name in the dialog box
- Select the variable in the editor (or any other drag-and-drop aware application), then drag and drop the variable into the **Watch** tab
- Right-click a variable in one of the other variable tabs and select **Add to Watch** from the context menu.

The **Watch** variable tab supports viewing the results of expressions made with watched variables. For example, in a Perl program with scalar variables `$base` and `$height` the following expression could be entered:

```
($base / 2) * $height
```

<a name="enter_expressions"></a>
To enter arbitrary expressions on the **Watch** variable tab:

1.  Click the **Add** button above the **Watch** variable tab.
1.  Enter an arbitrary expression in the dialog box.
1.  Click **OK**.

<a name="change_the_values_of_variables"></a>
To change the values of variables:

- Double-click the variable on the **Watch** variable tab and specify a value. Currently, only the values of simple variables can be changed. For example, values of variables such as 'a.b[3]' (in Python) or '$a{b}->[3]' (in Perl) cannot be changed.
- **Note**: This function is not available for arbitrary expressions.

- Double-click the variable on the **Locals** or **Globals** pane and specify a value in the dialog box.

<a name="remove_a_watched_variable"></a>
To remove a variable from the **Watch** variable tab, select the variable and click **Delete** on the bottom right toolbar. Alternatively, right-click the desired variable and select **Remove Watch** on the context menu.

<a name="view_as_hex"></a>
To view numeric values in hexadecimal, right-click on any of the variable view panels and select the **View As Hex** menu item.

<a name="output_tab"></a>
### Output Tab

The **Output** tab is used to view program output and to [send input](#Sending_Input) to the program being debugged. The following standard data streams are handled in the **Output** tab:

- `stdout`: program output
- `stderr`: errors
- `stdin`: program input (not supported for Perl or PHP during remote debugging)

When debugging Tcl and Python, if `stdin` is requested by the program, a red percent character is shown in the margin of the **Output** tab.

<a name="html_tab"></a>
### HTML Preview Tab

If the program produces HTML output, select the **HTML** tab to preview the rendered output. Unlike the **Output** tab, the HTML preview is not constantly updated. Use the **Reload HTML View** button in the bottom-pane toolbar to update the preview.

<a name="Call_Stack"></a>
### Viewing the Call Stack

The call stack is a data area or buffer used for storing requests that need to be handled by the program. Komodo's stack stores temporary data such as variables and parameters and operates as a push-down list. New data moves to the top of the stack and pushes the older data down in a "last-in, first-out" arrangement.

To view the call stack in a current debugging session, select the **Call Stack** tab in the right pane of the **Debug** tab.

There is one line in this tab per stack frame at any point in the execution of a program. The calling frame contains the information about a function call, including the filename, the line number, and any parameters or local variables.

<a name="Watching_Files"></a>
## Watching Files

When debugging a program that writes output to another file, or when watching programs execute, you can watch the output or the log file using Komodo's File Watcher.

The **Watch File** tool shows a file as the file is being updated on disk. It has no relationship with [variable viewing](#viewing_variables), except that, while debugging, it is often useful to watch variables change state and files change content.

To use the File Watcher:

1.  On the **Tools** menu, select **Watch File**.
2.  Browse to the desired file and click **OK**.
3.  Run the program.

<a name="Detaching_the_Debugger"></a>
## Detaching the Debugger

Use the Detach control to stop the debugging process but continue running the application. When application execution is detached from the debugging process, output continues to print on the **Debug** tab until the application finishes running.

To detach application execution from the debugging process, do one of the following:

- <b>Debug Menu</b>: Select **Detach**.
- <b>Debug Toolbar</b>: Click the **Detach** button.

<a name="Stopping_the_Debugger"></a>
## Stopping the Debugger

To stop the Komodo debugger, do one of the following:

- <b>Debug Menu</b>: Select **Stop**.
- **Keyboard**: Use the associated [key binding](prefs.html#Config_Key_Bindings).
- <b>Debug Toolbar</b>: Click the **Stop** button.

The debug session ends.

## Related Information

- [Perl Tutorial](/tutorial/perltut.html) tutorial
- [Python Tutorial](/tutorial/pythontut.html) tutorial
- [PHP Tutorial](/tutorial/phptut.html) tutorial
- [Ruby Tutorial](/tutorial/rubytut.html) tutorial
- [XSLT Tutorial](/tutorial/xslttut.html) tutorial
- [Feature Showcase - Using Conditional Breakpoints](/tutorial/tourlet_condbreak.html)
- [Feature Showcase - Debug an XSLT Program](/tutorial/tourlet_debug_xslt.html)
