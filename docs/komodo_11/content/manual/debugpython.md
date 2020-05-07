---
title: Debugging Python
---
(Komodo IDE only)

Komodo can be used to debug Python programs locally or remotely, including debugging in CGI environments. The instructions below describe how to configure Komodo and Python for debugging. For general information about using the Komodo debugger, see [Komodo Debugger Functions](debugger.html).

Debugger commands can be accessed from the **Debug** menu, by shortcut keys, or from the Debug Toolbar. For a summary of debugger commands, see the [Debugger Command List](debugger.html#How_use_Debugger).

Note: Breakpoints will not work with the [Psyco](http://psyco.sourceforge.net/) Python extension enabled. The Komodo [FAQ](trouble.html#psyco_debug) has a work-around solution.

<a name="Configuring_Python_Debugger" id="Configuring_Python_Debugger"></a>
## Configuring the Python Debugger

To specify which Python interpreter Komodo should use to debug and run Python programs locally:

1.  Select **Edit** > **Preferences**.
1.  In the Preferences dialog box under **Languages**, click **Python**. Komodo searches for Python interpreters on your system and displays them in the drop-down list.
1.  If the preferred interpreter is in this list, click to select the interpreter. If not, click **Browse** to locate it.
1.  Click **OK**.

On the **Debug** menu or Debug Toolbar, click **Go/Continue** or **Step In** to invoke the debugging session. See [Komodo Debugger Functions](debugger.html#debugger_top) for full instructions on using Komodo's debugging functionality.

<a name="Using_the_Python_Remote_Debugger" id="Using_the_Python_Remote_Debugger"></a>
## Using the Python Remote Debugger

When debugging a Python program remotely, the program is executed on the remote machine, and the debug output is sent to Komodo. Komodo controls the debugging session once the session starts on the remote machine.

<a name="Installing_the_Python_Remote_Debugger" id="Installing_the_Python_Remote_Debugger"></a>
### Installing the Python Remote Debugger on the Remote Machine

To debug a Python program remotely, the Python debugger client package must be installed on the remote machine. Packages are available for download from the [Komodo Remote Debugging](http://code.activestate.com/komodo/remotedebugging/) page. Alternatively, if your remote machine uses the same platform as the machine on which you installed Komodo, you can get the Python debugger client files from the _pythonlib_ and _bin_ subdirectories of the Komodo installation directory for your platform. The locations are as follows:

**Windows**

```
<komodo-install-directory>\lib\support\dbgp\pythonlib\
<komodo-install-directory>\lib\support\dbgp\bin
```

**Linux**

```
<komodo-install-directory>/lib/support/dbgp/pythonlib/
<komodo-install-directory>/lib/support/dbgp/bin
```

**Mac OS X**

```
<komodo-install-directory>/Contents/SharedSupport/dbgp/pythonlib/
<komodo-install-directory>/Contents/SharedSupport/dbgp/bin
```

For Python3 remote debugging, use the package named _python3lib_.

To install the Python Remote Debugger:

1.  Download and unzip the `Komodo-PythonRemoteDebugging` package for your platform and Komodo version from the [Komodo Remote Debugging](http://code.activestate.com/komodo/remotedebugging/) page.
1.  Set up your Python installation so the _dbgp_ Python package is on your PythonPath. You can do this by copying the _dbgp_ directory to the _site-packages_ directory of your Python installation. Alternatively, you can copy the _dbgp_ directory to a convenient location, and then add that directory to your _PYTHONPATH_ environment variable. For example, on Windows, if you copied the files to a directory called `C:\debugger`, enter the following at the command line:

    ```
    set PYTHONPATH=%PYTHONPATH%;C:\debugger
    ```

    To verify that the setup is correct, run the following command:

    ```
    python -c "import dbgp.client; print 'ok'"
    ```
    If this command prints the word "ok", you can move to the next step. If this command results in an `ImportError` then you need to resolve the error before continuing.
1.  Put the `bin\pydbgp.py` script (`bin/pydbgp` on Linux and Mac OS X) somewhere convenient. This is the main script that you run to start a remote debugging session.

    **Tip:** Placing the `pydbgp.py` script in a directory that is on your PATH environment variable, makes the script easier to run. On Windows, also make sure that your `PATHEXT` environment variable includes `.py`. On Linux and Mac OS X, ensure that the `pydbgp` script is executable by running this command:

    ```
    chmod u+x **path/to**/pydbgp
    ```

1. Now try running this command:

    ```
    pydbgp --help
    ```

If the setup is correct, the internal help documentation for running `pydbgp` is displayed.

**Note**: The debugging client relies on certain core python library files (e.g. `sys`, `os`, `getopt`, `socket`, `types`). If you have added custom modules to your python site-packages, `PYTHONPATH` or `sys.path` with the same name as those imported by `pydbgp`, the debugger may not work properly.

<a name="Invoking_the_Python_Remote_Debugger" id="Invoking_the_Python_Remote_Debugger"></a>
### Invoking the Python Remote Debugger

Python remote debugging sessions are started in one of three ways:

- [Running the _pydbgp.py_ driver script.](#debugpython_dbgpclient_command_line)
- [Calling `dbgp.client.brk()`](#debugpython_dbgpclient_functions) directly from within your Python program code.
- An exception reaches the top-level in a Python script that is [set up for just-in-time debugging.](#just_in_time)

All methods require that the Python remote debugger client package is installed on the remote machine (see [Installing the Python Remote Debugger](#Installing_the_Python_Remote_Debugger)).

**Note**: For Komodo to open an editable copy of the file, a [Mapped URI](debugger.html#remote_uri_mapping) must be created to link the file on the remote filesystem with the URI Komodo receives from the remote debugger.

<a name="debugpython_dbgpclient_command_line" id="debugpython_dbgpclient_command_line"></a>
#### Running _pydbgp.py_ from the Command Line

To start a Python remote debugging session from the command line:

1.  On the **Debug** menu, ensure that **Listen for Debugger Connections** is checked.
1.  Log in to the remote machine. (**Note:** the "remote" machine can be the same machine on which Komodo is running.)
1.  On the remote machine, run the _pydbgp.py_ driver program with the appropriate options:  

    ```
    python -S **path/to/**pydbgp.py -d **host:port** **your-script.py**
    ```

    where _host:port_ identifies the port on which Komodo is listening. By default, Komodo listens for remote debugger connections on port 9000. For example, if the "remote" machine is the same machine on which Komodo is running, start a debugging session with this command:

    ```
    python -S **path/to/**pydbgp.py -d localhost:9000 **your-script.py**
    ```

Other options for using the _pydbgp.py_ driver are available by running:

```
python -S **path/to/**pydbgp.py --help
```

If you are connecting to a [DBGP Proxy](debugger.html#dbgp_proxy), you must specify an `ide_key` value with the `-k` option to _pydbgp.py_. Listener port and DBGP Proxy settings are configurable via **Edit|Preferences|Debugger**. Select **Debug|Listener Status** to view the current settings.

**Note:** If your application requires that _sitecustomize.py_ is loaded, you must run Python with the -S argument. The debugger will load site.py at the appropriate time. Komodo is unable to debug _sitecustomize.py_ due to how Python handles loading of that file.

**Note:** If you followed the tip described in [Installing the Python Remote Debugger](#Installing_the_Python_Remote_Debugger) the basic command is:

```
pydbgp -d **host:port** **your-script.py**
```

<a name="debugpython_dbgpclient_functions" id="debugpython_dbgpclient_functions"></a>
#### Calling `dbgp.client.brk()` in your Python Programs

To break into a remote debugging session directly from within your Python code:

1.  On the **Debug** menu, ensure that **Listen for Debugger Connections** is checked
1.  Import and use the `brk()` function in the `dbgp.client` module to set a hard breakpoint. For example, the following simple Python script will break into a debugging session when execution reaches the `brk()` call:

    ```
    from dbgp.client import brk
        def foo():
            print "Hello, World!"
            brk(host="**mybox**", port=**9000**)
            print "Goodbye."
    ```

1.  Run your Python program.

The `brk()` function supports the following arguments:

- **host**: machine running Komodo or the DBGP Proxy (uses `localhost` if unspecified)
- **port**: port to connect on (uses 9000 if unspecified)
- **idekey**: key used to identify the debugging session to Komodo or the DBGP Proxy (uses the value of the USER or USERNAME environment variable if unspecified)

<a name="just_in_time" id="just_in_time"></a>
#### Python Just-in-Time Debugging

"Just-in-time debugging" allows the remote debugger to connect to Komodo if an uncaught exception occurs during execution (i.e. if a Python exception reaches the top level of your Python program). By adding the following lines of code to the beginning of your script, you can trap and explore the execution state of your Python program when an exception reaches the top level:

```
from dbgp.client import brkOnExcept
brkOnExcept(host='**mybox**', port=**9000**)
```

If and when an exception reaches the top level of your Python program, a post-mortem debugging session is started in Komodo at the line at which the exception is raised. The debug session is automatically placed in interactive mode so that you can inspect the current program environment, exactly like a Python interactive shell.

The `brkOnExcept()` function takes the same arguments as [`brk()`](#debugpython_dbgpclient_functions). As with `brk()`, `brkOnExcept()` attempts to connect to `localhost` on port 9000 with an `idekey` of USER or USERNAME if no arguments are specified.

<a name="debugpython_dbgpclient_cgi" id="debugpython_dbgpclient_cgi"></a>
### CGI Debugging

To debug CGI applications written in Python:

- Configure Python to be used as the CGI (or embedded extension) for your Web server. For information on configuring Python, refer to the [Python documentation](http://python.org/doc/).
- Follow the steps outlined in [Using `dbgp.client` Functions in Python Programs](#debugpython_dbgpclient_functions) to call the Python remote debugger from within the application. Start the remote application through a web browser instead of running it from the command line.

## Related Information

- [Python Tutorial](/tutorial/pythontut.html)
