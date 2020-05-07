---
title: Debugging PHP
---
(Komodo IDE only)

Komodo can be used to debug PHP programs [locally](#local_debug_PHP) or [remotely](#remote_debug_PHP). Remote PHP debugging encompasses all types of PHP debugging not initiated from within Komodo, including debugging PHP scripts running under a local web server.

The instructions below describe how to configure Komodo and PHP for debugging. For general information about using the Komodo debugger, see [Komodo Debugger Functions](debugger.html).

Debugger commands can be accessed from the **Debug** menu, by shortcut keys, or from the Debug Toolbar. For a summary of debugger commands, see the [Debugger Command List](debugger.html#How_use_Debugger).

See [www.xdebug.org/install.php](http://www.xdebug.org/install.php) for instructions on compiling Xdebug from source on other platforms.

<a name="local_debug_PHP" id="local_debug_PHP"></a>
## Local PHP Debugging

In local debugging mode, Komodo executes PHP directly. While this is convenient for quickly debugging a PHP script, if your script depends on the availability of a web server, use [Remote PHP Debugging](#remote_debug_PHP) even if the script is running on the same machine as Komodo. This makes it possible to test the script in its true environment.

When debugging locally, certain environment variables are not available, such as those provided by the CGI environment. However, it is possible to simulate a CGI environment by specifying [CGI environment variables](debugger.html#Debugging_Options_CGI_Environment) and [CGI input](debugger.html#Debugging_Options_CGI_Input) in the Debugging Options dialog box. It is is not necessary to install a web server to use Komodo's local debugging features. Once you have configured PHP to use the debugger extension as described below, you can debug your scripts by opening a PHP file and using [Komodo Debugger Functions](debugger.html#debugger_top).

If you receive an error message when attempting to debug a PHP script, check the [PHP troubleshooting](trouble.html#php_debug) section of the Komodo FAQ.

<a name="config_local_PHP" id="config_local_PHP"></a>
### Configuring the PHP Debugger

Komodo configures itself automatically for local PHP debugging by launching the default PHP interpreter (i.e. the first in your `PATH`) and attempting to load the Xdebug extension (`php_xdebug.dll` or `xdebug.so`). If this is successful, a new copy of `php.ini` is created and stored in Komodo's user profile. See the [file locations](http://forum.komodoide.com/t/important-file-locations/) page for more information on specific Komodo files.

To specify which PHP interpreter Komodo should use to debug and run PHP programs locally:

1.  On the **Edit** menu, click **Preferences**.
1.  In the Preferences dialog box under **Languages**, click **PHP**. Komodo searches for PHP interpreters on your system and displays them in the drop-down list.
1.  If the preferred interpreter is in this list, click to select the interpreter. If not, click **Browse** to locate it.
1.  Click **OK**.

On the **Debug** menu or Debug Toolbar, click **Go/Continue** or **Step In** to invoke the debugging session. See [Komodo Debugger Functions](debugger.html#debugger_top) for full instructions on using Komodo's debugging functionality.

**Note**: If Xdebug is already installed and configured, make sure `xdebug.remote_autostart` is not enabled. This setting will interfere with local debugging in Komodo. If you need this option enabled for remote debugging, set the **Path to alternate PHP configuration file** under **Preferences**  > **Languages**  > **PHP** to point to a copy of `php.ini` without this option.

<a name="remote_debug_PHP" id="remote_debug_PHP"></a>
## Remote PHP Debugging

Remote PHP debugging encompasses all types of PHP debugging not initiated from within Komodo, including debugging PHP scripts running under a local web server.

When a PHP script is run through a web browser, the web server uses the PHP interpreter to execute the script. If PHP is configured for remote debugging, the server contacts Komodo to start a debugging session. Komodo controls the debugging (e.g. stepping and breakpoints) once the session starts. CGI variables are available, as are all other variables that are available when running PHP under a web server.

Though remote PHP debugging allows PHP scripts to be run in their true environment, it may be slower than local PHP debugging.

<a name="config_remote_PHP" id="config_remote_PHP"></a>
### Configuring Remote PHP Debugging

Remote debugging of PHP in Komodo is set up differently depending on how many people will be debugging scripts on the same web server:

**Single User Remote PHP Debugging**: In single user remote debugging, PHP is configured to always look for a specific instance of Komodo on a specific machine. This configuration requires no changes to the PHP script. Your web server and your instance of Komodo can be on one machine or two machines

**Multi-User Remote PHP Debugging**: When multiple users need to debug PHP scripts on a single web server, use the [DBGP Proxy](debugger.html#dbgp_proxy) with the remote PHP debugging instructions below. While it is possible to configure Apache with [Virtual Hosting](trouble.html#virtual_host_apache), it is easier to configure multi-user remote PHP debugging with the proxy.

Remote PHP debugging must be configured manually. The following procedure assumes that you have already installed PHP. Refer to the [PHP website](http://www.php.net/manual/en/) for detailed information on installing PHP.

<a name="debugphp_copy_xdebug" id="debugphp_copy_xdebug"></a>
#### Step 1 - Copy the Debugging Extension to the Web Server

Before debugging PHP scripts in Komodo, PHP must be configured on your server to use the Xdebug extension (to find out more information about the Xdebug project visit [http://xdebug.org/](http://xdebug.org/)). Find the appropriate extension for the version of PHP your server is running at [Komodo Remote Debugging](http://code.activestate.com/komodo/remotedebugging/). Manually copy it into a **directory on the server** that the PHP interpreter and web server can access.

**Note**: You should ideally use ActiveStates distribution of Xdebug. It is built specifically for debugging in Komodo.

Alternatively, if your remote machine uses the same platform as the machine on which you installed Komodo, the Xdebug files can be found in the _php_ sub-directory of the Komodo installation. For example:

**Windows**

- **File**: `php_xdebug.dll`
- **Location**: `_<komodo-install-directory>_\lib\support\php\debugging\_<PHP-version>_`

**Linux**

- **File**: `xdebug.so`
- **Location**: `_<komodo-install-directory>_/lib/support/php/debugging/_<PHP-version>_/`

**macOS**

- **File**: `xdebug.so`
- **Location**: `_<komodo-install-directory>_/Contents/SharedSupport/php/debugging/_<PHP-version>_/`

In the downloadable packages, the extensions are found in version-specific sub directories of the unpacked archive.

The Xdebug extension does not have to be installed in the PHP `extension_dir` because its location is specified explicitly in _php.ini_ (see below).

#### <a name="debugphp_edit_php_ini" id="debugphp_edit_php_ini">Step 2 - Edit php.ini on the Web Server</a>

Open the _php.ini_ configuration file on the server. There may be multiple copies of this file, so check the value of "Loaded Configuration File" in the `phpinfo()` output to see which one is being used by the web server (e.g. create a _phpinfo.php_ file containing the line '`<?php phpinfo(); ?>`' in a web server directory, then open the corresponding URL in a browser).

**Note**: Xdebug is incompatible with the **Zend Optimizer** and **Zend Studio Debugger** extensions. These extensions should be commented out in _php.ini_ when configuring PHP for remote debugging with Komodo.

**Add Xdebug to php**

In the "`Dynamic Extension`" section, add the lines specified below. Edit the values to reflect your particular environment (see **[Xdebug settings explained](#debugphp_xdebug_settings)** below).

*   **Windows**

    The _php.ini_ configuration file is generally in your operating system directory (e.g. C:\WINDOWS or C:\WINNT) or in the same directory as `php.exe` (e.g. C:\PHP). Check `phpinfo()` as described above if you cannot find the file or have multiple copies.

    ```
    ; xdebug config for Windows
        ; - zend_extension_ts is for PHP <= 5.2
        ; - zend_extension is for PHP >= 5.3
        ; or you can specify both if your not sure.
        zend_extension_ts="c:\path\to\php_xdebug.dll"
        zend_extension="c:\path\to\php_xdebug.dll"
        xdebug.remote_enable=1
        xdebug.remote_handler=dbgp
        xdebug.remote_mode=req
        xdebug.remote_host=127.0.0.1
        xdebug.remote_port=9000
        xdebug.idekey=<idekey>
    ```

*   **Linux and macOS**

    ```
    ; xdebug config for Linux and macOS
        zend_extension="/path/to/xdebug.so"
        xdebug.remote_enable=1
        xdebug.remote_handler=dbgp
        xdebug.remote_mode=req
        xdebug.remote_host=127.0.0.1
        xdebug.remote_port=9000
        xdebug.idekey=<idekey>
    ```

<a name="debugphp_xdebug_settings"></a>
**Xdebug settings explained**:

<ul>
    <li><b>zend_extension_ts</b> or <b>zend_extension</b>: Should be set to the full path to the xdebug library on your system. Use `zend_extension_ts` ("thread safe") on Windows PHP <= 5.2, else `zend_extension` for Windows PHP >= 5.3 and for all other platforms (i.e. Mac, Linux).</li>
    <li><b>xdebug.remote_enable</b>: Enables remote debugging.</li>
    <li><b>xdebug.remote_handler</b>: Should be set to `dbgp` for use with Komodo.</li>
    <li><b>xdebug.remote_mode</b>: Set to `req` to have the script connect to Komodo when it starts. Set to `jit` to connect only on an error condition (see [PHP Just-in-Time Debugging / Break on Exception](#php_just_in_time)).</li>
    <li><b>xdebug.remote_host</b>: Set to the hostname or IP address of the computer running Komodo or the [DBGP Proxy](debugger.html#dbgp_proxy). Use 'localhost' or '127.0.0.1' if Komodo and the web server are running on the same system.</li>
    <li><b>xdebug.remote_port</b>: Set to the same value as the debugging listener port configured in the [Debugger Connection preferences](prefs.html#DebuggerConnection) (or the system assigned **Host Port** displayed under **Debug**  > **Listener Status**)</li>
    <li><b>xdebug.idekey</b> (optional): If you are using the [DBGP Proxy](debugger.html#dbgp_proxy), set this to the Proxy Key configured in the [Debugger Connection preferences](prefs.html#DebuggerConnection).</li>
    <li><b>xdebug.remote_autostart</b>: When this setting is set to 1, a Komodo/Xdebug session will be initiated on every request, even if the GET/POST/COOKIE variable was not present. Please do note that this setting can [interfere with](php_remote_autostart_warning) PHP local debugging.</li>
</ul>

<a name="confirm_server_configuration"></a>
**Confirm correct server configuration:**

Restart the web server to load the new configuration. Once the _php.ini_ file is updated and the server has been restarted, verify that Xdebug is configured by checking the output of `phpinfo()` (described in [Step 2](#debugphp_edit_php_ini)). There should be an Xdebug section in the alphabetical list of modules which shows all of the relevant settings. If PHP is on your system PATH you can run `$ php -m` to see all currently installed modules. Xdebug should be displayed if configuration worked as expected.

If you find the Xdebug section in the output of `phpinfo()` or see Xdebug in the output of `php -m` in command line then you have successfully configured your server for remote debugging! One more step now.

**Note**: Recent versions of PHP are set to buffer program output by default. While debugging, it is useful to disable output buffering so that results of `print` and `echo` statements can be seen immediately when stepping through code. To disable output buffering, comment out the `output_buffering` setting in _php.ini_ with a ";" character, or set it to "`off`".

<a name="confirm_komodo_listening" id="confirm_komodo_listening"></a>
#### Step 3 - Check that Komodo's Port and Listener

The last step is to make sure that Komodo is listening on the correct port. Refer to [Komodo Listener section](debugger.html#set_remote_debug) to turning on and checking Komodo's debug listener status.

If Komodo is not listening on the correct port specified in [`xdebug.remote_port`](#debugphp_xdebug_settings), you can adjust the listening port in [Komodo debugger preferences](prefs.html#DebuggerConnection). Once Komodo is listening properly you can move on and try to [Invoking the PHP Remote Debugger](#Invoking_the_PHP_Remote_Debugger).

<a name="Invoking_the_PHP_Remote_Debugger" id="Invoking_the_PHP_Remote_Debugger"></a>
### Invoking the PHP Remote Debugger

Once remote PHP debugging is [configured](#config_remote_PHP), the PHP interpreter can contact Komodo and initiate a remote debugging session when a PHP script is executed on the web server.

**Note**: For Komodo to open an editable copy of the file, Komodo will prompt you to create a [Mapped URI](debugger.html#remote_uri_mapping) to link the file on the remote filesystem with the URI Komodo receives from the remote debugger. This Mapped URI persists in your saved preferences.

#### To initiate remote debugging from a web browser:

1.  Ensure PHP is installed and [configured properly](#confirm_server_configuration) for your web server.
2.  Ensure Komodo and PHP are configured for remote debugging (as described in "[Configuring Remote PHP Debugging](#config_remote_PHP)").
3.  Click **Debug** > **Listen for Debugger Connections**.
4.  In your browser, enter the URL of the script you want to debug. Append `?XDEBUG_SESSION_START=1` to the end of the URL (an HTTP GET with a true Boolean value). For example:  

    ```
    http://example.org/sample.php?XDEBUG_SESSION_START=1
    ```

    If you are using the [DBGP Proxy](debugger.html#dbgp_proxy), the value for the GET method should match the **Proxy Key** value shown in **Debug** > **Listener Status**. For example:  

    ```
    http://example.org/sample.php?XDEBUG_SESSION_START=jdoe
    ```

    It is also possible to call `XDEBUG_SESSION_START` by adding it in an `input` element of an HTML form. For example:  

    ```
    <input type="hidden" name="XDEBUG_SESSION_START" value="jdoe" />
    ```

    **Note**: This is only required for the first request. After that, Xdebug tracks the debugging session with a cookie. For more information on how this works, see [www.xdebug.org/docs-debugger.php#browser_session](http://www.xdebug.org/docs-debugger.php#browser_session)

1.  A PHP debugging session starts in Komodo. On the **Debug** menu, click **Step In** or **Go/Continue** to run to the first breakpoint.

#### To initiate remote debugging from the command line:

1.  On the **Debug** menu, click **Listen for Debugger Connections**.
1.  Set the XDEBUG_CONFIG environment variable. Use the port specified in **Edit**  > **Preferences**  > **Debugger** or listed in **Debug**  > **Listener Status**.  

    - On Windows:
        ```
        set XDEBUG_CONFIG=remote_port=9000 remote_enable=1
        ```

    - On Linux/macOS:
        ```
        export XDEBUG_CONFIG="remote_port=9000 remote_enable=1"
        ```

1.  Run the script using the PHP interpreter:  

    ```
    php -f sample.php
    ```

1.  A PHP debugging session will start in Komodo. Click **Step In** to start stepping through the script or **Go/Continue** to run to the first breakpoint.

#### To initiate remote debugging using the [DBGP Proxy](debugger.html#dbgp_proxy):

1.  From the **Debug** menu, select **Listen for Debugger Connections**.
1.  Set the XDEBUG_CONFIG environment variable as above. Use the port specified in **Edit**  > **Preferences**  > **Debugger** or listed in **Debug**  > **Listener Status**. Add an IDE Key value to the XDEBUG_CONFIG environment variable that matches the **Proxy Key** value shown in **Debug**  > **Listener Status**.  

    On Windows:

        ```
        $set XDEBUG_CONFIG=remote_port=9000 remote_enable=1 idekey=<USERNAME>
        ```

    On Linux/macOS:

        ```
        export XDEBUG_CONFIG="remote_port=9000 remote_enable=1 idekey=<USER>"
        ```

1.  Run the script using the PHP interpreter:  

    ```
    php -f sample.php
    ```

1.  A PHP debugging session will start in Komodo. On the **Debug** menu, Click **Step In** to start stepping through the script or **Go/Continue** to run to the first breakpoint.

Output from the debug session appears in the Bottom Pane of the Komodo Workspace. Komodo does not support a console for remote debugging. The browser will not show the script output until debugging is complete.

#### To stop the debugger:

On the **Debug** menu, select **Stop** or pass the `XDEBUG_SESSION_STOP=1` variable by appending it to the URL or adding it to a form (as with `XDEBUG_SESSION_START=1` above).

See [Komodo Debugger Functions](debugger.html#debugger_top) for full instructions on using Komodo's debugging functionality.

If you receive an error message while debugging a PHP script that is not caused by the errors in the script itself, check the [PHP troubleshooting](trouble.html#php_debug) section of the Komodo FAQ.

<a name="using_xdebug_break" id="using_xdebug_break"></a>
### Using xdebug_break()

The `xdebug_break()` function is used to hard-code a break in a PHP program. It can be used instead of a Komodo breakpoint. For example:

    ```
    <?php
    echo "<p>Breaks after this line.</p>";
    xdebug_break();
    echo "<p>Breaks before this line.<p>";
    ?>
    ```

This function breaks the code during a debugging session but will not initiate a new session. Use `xdebug_break()` in conjunction with the methods described above for starting debugging sessions.

<a name="xdebug_logging" id="xdebug_logging"></a>
### Xdebug Logging

To log xdebug sessions on the server, add the following line to the xdebug config section of the _php.ini_ configuration file:

    ```
    xdebug.remote_log=/tmp/xdebug.log
    ```

...or add `remote_log` to the `XDEBUG_CONFIG` environment variable. For example:

    ```
    export XDEBUG_CONFIG="remote_port=9000 remote_enable=1 remote_log=/tmp/xdebug.org"
    ```

You can replace "`/tmp/xdebug.org`" with any writable directory and the file name of your choice.

<a name="php_just_in_time" id="php_just_in_time"></a>
### PHP Just-in-Time Debugging / Break on Exception

PHP remote debugging can be configured to break when an exception is thrown. Sometimes called just-in-time debugging, this method allows you to test your application and stop to examine code when there is a problem.

To turn this on, change the `xdebug.remote_mode` setting in _php.ini_ from '`req`' to '`jit`' or override the setting in your code:

    ```
    <?php
    ini_set('xdebug.remote_mode', 'jit');
    ...
    ?>
    ```

Whenever an exception is thrown, a debugging session is initiated with a break at the line that caused the problem.

This may generate a lot of breaks if PHP is configured with verbose error handling (e.g. `error_reporting = E_ALL`). In PHP 5, you can define your own Exception class which enables JIT debugging only for specific exceptions:

    ```
    <?php
    class KoException extends Exception
    {
      function __construct($message, $code = 0) {
        ini_set('xdebug.remote_mode', 'jit');
        parent::__construct($message, $code);
      }
    }

    throw new KoException('this is my exception!', 42);
    ?>
    ```
<a name="build_xdebug_from_source" id="build_xdebug_from_source"></a>
### Building Xdebug from source

You can also [compile Xdebug from source](http://xdebug.org/install.php) code, instead of using one of Komodo's pre-compiled xdebug.so modules. The two are compatible in most regards, though Komodo's PHP Code Profiling depends upon the prebuilt Komodo version and Code Profiling will not work with the xdebug.org version.

<a name="config_PHP_problems" id="config_PHP_problems"></a>
## Common PHP Debugging Problems

<a name="config_PHP_os_x" id="config_PHP_os_x"></a>
### Debugging PHP on macOS

The default version of PHP supplied with **macOS** may not be complied with loadable extension support. If this is the case then this PHP will not work with Komodo's debugger (Xdebug). For PHP debugging on macOS, either build PHP from source with loadable extension support or use binaries from [http://www.entropy.ch/software/macosx/php/](http://www.entropy.ch/software/macosx/php/).

<a name="config_PHP_zend" id="config_PHP_zend"></a>
### Zend Optimizer and Zend Studio Debugger

Xdebug is incompatible with the Zend Optimizer and Zend Studio Debugger extensions. If these extensions are enabled in _php.ini_, they will not be imported into the copy created by Komodo for debugging. When configuring [Remote PHP Debugging](#remote_debug_PHP), these extensions should be manually commented out in _php.ini_.

## Related Information

- [PHP Tutorial](/tutorial/phptut.html)
