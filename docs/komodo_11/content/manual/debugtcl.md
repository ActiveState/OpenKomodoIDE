---
title: Debugging Tcl
---
(Komodo IDE only)

Komodo can be used to debug Tcl programs locally or remotely. The following instructions describe how to configure Tcl debugging. For general information about using the Komodo debugger, see [Komodo Debugger Functions](debugger.html).

Debugger commands can be accessed from the **Debug** menu, by shortcut keys, or from the Debug Toolbar. For a summary of debugger commands, see the [Debugger Command List](debugger.html#How_use_Debugger).

<a name="Configuring_Tcl_Debugger" id="Configuring_Tcl_Debugger"></a>
## Configuring Local Tcl Debugging

Specify the Tcl interpreter Komodo uses to debug and run Tcl programs:

1.  On the **Edit** menu, select **Preferences**.
1.  In the Preferences dialog box under **Languages**, click **Tcl**. Komodo searches for Tcl interpreters in the system `PATH` and lists all `tclsh` and `wish` interpreters available in separate drop-down lists. If no Tcl interpreters are displayed in the list, check that the location of the interpreters is specified in your `PATH` environment variable.
1.  If the preferred interpreters are in these lists, click to select them. If they are not, click **Browse** to locate them.
1.  Click **OK**.

**Note**: Tcl Beta releases contain only version-specific executables (e.g. `tclsh85.exe` and `wish85.exe`). Komodo does not automatically find these in the path. To use them, specify them manually in the Interpreters section of the [Tcl language preferences](prefs.html#Tcl) rather than selecting **Find on Path**.

To start a local Tcl debugging session, click **Go/Continue** or **Step In** on the Debugger menu or toolbar. See [Komodo Debugger Functions](debugger.html) for full instructions on using Komodo's debugging functionality.

<a name="Using_the_Tcl_Remote_Debugger" id="Using_the_Tcl_Remote_Debugger"></a>
## Remote Tcl Debugging

When debugging a Tcl program remotely, the program is executed on the remote machine and the debug output is sent to Komodo. Komodo controls the debugging session (e.g. stepping, breakpoints, and spawnpoints) once the session has been started on the remote machine.

<a name="Installing_the_Tcl_Remote_Debugger" id="Installing_the_Tcl_Remote_Debugger"></a>
### Installing the Tcl Debugger Application on a Remote Machine

To debug a Tcl program remotely, the Tcl debugger application, _dbgp_tcldebug.exe_ (Windows) or _dbgp_tcldebug_ (Linux and OS X), must be installed on the remote machine. This file is installed in the _tcl_ subdirectory of the Komodo installation directory for your platform.

**Windows**

```
<komodo-install-directory>\lib\support\tcl
```

**Linux**

```
<komodo-install-directory>/lib/support/tcl
```

**Mac OS X**

```
<komodo-install-directory>/Contents/SharedSupport/tcl
```

This application is also available for download from the [Komodo Remote Debugging](http://code.activestate.com/komodo/remotedebugging/) page.

To install the Tcl debugger application on the remote machine:

- If necessary, [install a Komodo license](http://www.activestate.com/support/faqs#faq-1488).
- Copy the _dbgp_tcldebug_ executable to any convenient directory.

<a name="Invoking_the_Tcl_Remote_Debugger" id="Invoking_the_Tcl_Remote_Debugger"></a>
### Invoking the Tcl Debugger Application

To debug a Tcl script on a remote machine:

1.  In Komodo, select **Listen for Debugger Connections** from the **Debug** menu.
1.  Log in to the remote machine.
1.  On the remote machine, run the _dbgp_tcldebug_ executable from the command line. To specify command line arguments for the script that you are debugging, simply add those arguments to the end of the command, after the _dbgp_tcldebug_ arguments.  

    ```
    dbgp_tcldebug -dbgp <komodo_host:port>
          -app-file <tcl_program>
          -app-shell </path/to/tclsh_or_wish>
    ```

    The following options are available:

    - **-dbgp**: Sets the hostname (or IP address) and port where Komodo or the [DBGP Proxy](debugger.html#dbgp_proxy) is running. In Komodo, select **Debug|Listener Status** to check the current port setting.
    - **-app-file**: Specifies the Tcl program to debug. Program arguments should follow a "--" delimiter after the Tcl program name (e.g. `... -app-file test.tcl -- arg_0 arg_1`).
    - **-app-shell**: Sets the path to the Tcl interpreter (`tclsh` or `wish`).
    - **-help**: Displays a complete list of options.
1.  A Tcl **Debug** tab opens in Komodo. Click **Step In**, or **Go/Continue**) to run to the first breakpoint (see [Komodo Debugger Functions](debugger.html#debugger_top) for full instructions).

**Note**: For Komodo to open an editable copy of the file, a [Mapped URI](debugger.html#remote_uri_mapping) must be created to link the file on the remote filesystem with the URI Komodo receives from the remote debugger.

**Example**

Remote Machine (Windows):

- The file _dbgp_tcldebug.exe_ has been copied into the `C:\remote_debug` directory.
- The Tcl file to be debugged is called `test.tcl` and is located in the current working directory.
- The Tcl interpreter is `C:\Tcl\bin\wish.exe`.

Local Machine:

- The hostname is "mybox".
- The Komodo remote debugging [listener port](prefs.html#Debugger) is set to 9000.

In this scenario, the following command is entered on the remote machine:

```
C:\remote_debug\dbgp_tcldebug.exe -dbgp mybox:9000
  -app-file test.tcl -app-shell C:\Tcl\bin\wish.exe
```
