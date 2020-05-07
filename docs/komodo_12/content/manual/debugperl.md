---
title: Debugging Perl
---
(Komodo IDE only)

Komodo can debug Perl programs locally or remotely, including debugging in CGI and mod_perl environments. The instructions below describe how to configure Komodo and Perl for debugging. For general information about using the Komodo debugger, see [Debugging your programs](debugger.html).

Debugger commands can be accessed from the **Debug** menu, by shortcut keys, or from the Debug Toolbar. For a summary of debugger commands, see the [Debugger Command List](debugger.html#How_use_Debugger).

<a name="Configuring_Perl_Debugger" id="Configuring_Perl_Debugger"></a>
## Configuring the Perl Debugger

To specify which Perl interpreter Komodo uses to debug and run Perl programs:

1.  Select **Edit** > **Preferences**.
1.  In the Preferences dialog box under **Languages**, click **Perl**. Komodo searches for Perl interpreters on your system and displays them in the drop-down list.
1.  If the preferred interpreter is in this list, click to select it. If not, click **Browse** to locate it.
1.  Click **OK**.

To start a local Perl debugging session:

On the **Debug** menu or Debug Toolbar, click **Go/Continue** or **Step In** to invoke the debugging session. See [Debugging your programs](debugger.html) for full instructions on using Komodo's debugging functionality.

<a name="using_perl_-d" id="using_perl_-d"></a>
### Starting a Komodo debugging session with `perl -d`

You may wish to use the Komodo debugger when working at the command line instead of using perl's built-in debugger. To do this, configure the environment variables described in [Debugging Perl Remotely](#Perl_Remote_Debugger) on your local machine using `localhost` as the hostname. Running the comand `perl -d` will start a debugging session in Komodo.

<a name="Enabling_Break_Now" id="Enabling_Break_Now"></a>
### Enabling "Break Now"

By default, the **Break Now** function is disabled for Perl debugging because some programs and modules (e.g. LWP and WWW::Mechanize) are not compatible with asynchronous breaking.

To enable **Break Now**, include the setting `async=1` in the `PERLDB_OPTS` environment variable. This can be done in Komodo's [Environment](prefs.html#Environment) preferences (**Edit** > **Preferences** > **Environment**).

<a name="Perl_Remote_Debugger" id="Perl_Remote_Debugger"></a>
## Debugging Perl Remotely

When debugging a Perl program remotely, the program is executed on the remote system and the debug output is sent to Komodo. Komodo controls the debugging session (e.g. stepping and breakpoints) once the session starts on the remote system.

Perl remote debugging works on any system that can run the version of `perl5db.pl` distributed with Komodo. [ActivePerl](http://www.activestate.com/activeperl) and most other distributions of Perl (version 5.6 or greater) will work.

To debug Perl programs remotely:

**Step One: Configure the Remote Machine**

1.  Copy Komodo's perl debugger and its associated libraries to the remote machine by copying the entire _dbgp/perllib_ sub-directory of the Komodo installation to the new machine, or download a package from the [Komodo Remote Debugging](http://code.activestate.com/komodo/remotedebugging/) page.

    **Note**: Do not copy _perl5db.pl_ to the standard "lib" directory of the Perl installation on the remote machine, as this will overwrite the standard _perl5db.pl_ file.

    **Warning**: Please ensure you copy the entire _dbgp/perllib_ sub-directory and leave it intact. If the Perl debugger filenames do not have "dbgp/perllib" or "dbgp\perllib" in them, the Perl debugger might start debugging itself! Also, if for whatever reason the debug package you downloaded does not have this file structure, please make the necessary changes yourself.

1.  On the remote machine, set the `PERL5LIB` environment variable to the location of the new _perl5db.pl_ and its libraries. For example, if the remote machine is running Windows and _dbgp/perllib_ directory was copied to _C:\misc\dbgp\perllib_, set the variable as follows:

    ```
    set PERL5LIB=C:/misc/dbgp/perllib
    ```

    For CGI debugging with IIS, you would also need to set the PERL5DB environment variable as follows:

    ```
    set PERL5DB=BEGIN { require q(C:/misc/perllib/dbgp/perl5db.pl) }
    ```

    Note the forward slashes "/" in place of the regular Windows backslash path separators. This is optional for PERL5LIB, but necessary for PERL5DB.

    Another example: If the remote machine is running Linux or Mac OS X and _dbgp/perllib_ was copied to the _/home/me/perl/komodo\_perl\_debugging_ directory, set the variable as follows:

    ```
    export PERL5LIB=/home/me/perl/komodo_perl_debugging/dbgp/perllib
    ```

1.  On the remote machine, set the `PERLDB_OPTS` and `DBGP_IDEKEY` variables. This tells the Perl interpreter on the remote machine where to connect to Komodo or the [DBGP Proxy](debugger.html#dbgp_proxy) and how to identify itself.  

    ```
    PERLDB_OPTS=RemotePort=<hostname>:<port>
    DBGP_IDEKEY=<ide_key>
    ```

 - The port number must match the port number specified in **Edit** > **Preferences** > **Debugger**. Click **Debug** > **Listener Status** to check the current port.
 - Replace `<hostname>` with the name or IP address of the machine running Komodo.
 - If DBGP_IDEKEY is unset, the USER or USERNAME environment variable is used as the IDE Key.
 - The variable definitions must be on one line.

For example:  

**Windows**

```
set PERLDB_OPTS=RemotePort=127.0.0.1:9000
set DBGP_IDEKEY=jdoe
```

**Linux and Mac OS X Systems**

```
export PERLDB_OPTS="RemotePort=127.0.0.1:9000"
export DBGP_IDEKEY="jdoe"
```

**Note:** As with local debugging, the **Break Now** function is [disabled](#Enabling_Break_Now) by default. To enable this button and functionality, add the option `async=1` to the `PERLDB_OPTS` environment variable. For example, on Windows:

```
set PERLDB_OPTS=RemotePort=127.0.0.1:9000 async=1
```

**Step Two: Listen for Debugger Connections**

In Komodo, on the **Debug** menu, click **Listen for Debugger Connections**.

**Step Three: Start the Perl Program on the Remote Machine**

Start the debugging process using the "-d" flag:

> `perl -d program_name.pl`

A Perl **Debug** tab is displayed in Komodo.

**Note**: For Komodo to open an editable copy of the file, a [Mapped URI](debugger.html#remote_uri_mapping) must be created to link the file on the remote filesystem with the URI Komodo receives from the remote debugger.

**Step Four: Debug the Perl Program using Komodo**

Click **Step In**, or **Go/Continue** to run to the first breakpoint. See [Komodo Debugger Functions](debugger.html) for full instructions on using Komodo's debugging functionality.

<a name="Configuring_Perl_CGI" id="Configuring_Perl_CGI"></a>
## Configuring Perl for CGI Debugging

Debugging CGI programs on live production servers can seriously impair performance. We recommend using a test server for CGI debugging. Instructions for configuring Microsoft IIS and Apache servers are shown below; for other web servers, use these examples and the web server software documentation as a guide for modifying the server environment.

The settings and paths listed are examples only. Substitute these with the specific paths, hostnames and port numbers of your server as necessary

<a name="CGI_Config_IIS" id="CGI_Config_IIS"></a>
### Configuring a Microsoft IIS Web Server

- **Modify the Server's Environment Variables**: Right-click the **My Computer** icon on the desktop, and select **Properties**. On the **Advanced** tab, click the **Environment Variables** button. Add the following items to the **System Variables** pane:  

```
PERL5LIB=C:\Program Files\ActiveState Komodo _x.x_\lib\support\dbgp\perllib
PERL5DB=BEGIN { require q(C:/Program Files/ActiveState Komodo _x.x_/lib/support/dbgp/perllib/perl5db.pl) }
PERLDB_OPTS=RemotePort=<hostname>:<port>
DBGP_IDEKEY="<ide_key>"
```

**Note:** The path for the PERL5LIB directory shown above is the correct path in a default installation. That path must be changed if you have installed Komodo in a different location. Forward slashes, "/", are used in place of the normal Windows path separator, "\", in the PERL5DB environment variable.
- **Modify the Internet Information Services Configuration**: A "-d" option must be added to the Executable Path for the Perl CGI script mapping.

#### IIS 4 and 5:

1. Open the **Internet Information Services** manager.
1. Select one web site or the entire **Web Sites** node as desired.
1. Select **Action** > **Properties**.
1. On the **Home Directory** tab, click the **Configuration** button.
1. Add (or modify) an entry for Perl with the following characteristics:  

    ```
    Extension = .pl
    Executable Path = c:\perl\bin\perl.exe -d "%s" %s
    ```

#### IIS 6:

1. Open the **Internet Information Services** manager.
1. Select the **Web Service Extensions** node.
1. Add (or modify) the Web Service Extension for Perl CGI as above.

#### IIS 7:

1.  Open the **Internet Information Services** manager.
1.  Select the level at which you want the debugger configuration applied (e.g. at the host level for a specific website).
1.  In the center pane in the IIS section, double-click **Handler Mappings**
1.  Add (or modify) an entry for Perl CGI (ActivePerl adds one called "Perl CGI for .pl"). For example:
  - **Request path**: *.pl
  - **Executable**: C:\Perl\bin\perl.exe -d "%s" %s
1. Reboot: The system must be rebooted for the changes to take effect. Environment variables are not updated by restarting the IIS service.

<a name="CGI_Config_Apache" id="CGI_Config_Apache"></a>
### Configuring an Apache Web Server

Ensure that Perl CGI scripts are operating correctly on the Apache server before proceeding with CGI debugger configuration. If you are running Apache under Windows, disable the `ScriptInterpreterSource` registry in the `httpd.conf` file. Use a stand-alone Perl interpreter for remote debugging.

- **Modify the `httpd.conf` file**: The following values can be configured for a specific virtual host or all hosts. Add the following values in the appropriate sections:  

```
SetEnv PERL5LIB "C:\Program Files\ActiveState Komodo _x.x_\lib\support\dbgp\perllib"
SetEnv PERLDB_OPTS "RemotePort=<hostname>:<port>"
SetEnv DBGP_IDEKEY "<ide_key>"
```

**Note:** You must enable the `mod_env` Apache module (see [the Apache documentation](https://httpd.apache.org/docs/2.4/mod/mod_env.html)) for the SetEnv directive to function.  

- **Modify the Perl Script**: Add the "`-d`" flag to the "shebang" line:

```
#!/perl/bin/perl -d
```
<a name="debugperl_cgi_start" id="debugperl_cgi_start"></a>
### Starting a CGI Debugging Session

After the configuration is complete, debug programs as follows:

- In Komodo, on the **Debug** menu, click **Listen for Debugger Connections**.
- Using a web browser, access your CGI script.
- A Perl **Debug** tab is displayed in Komodo. See [Komodo Debugger Functions](debugger.html) for full instructions on using Komodo's debugging functionality.

<a name="Debugging_Mod_Perl" id="Debugging_Mod_Perl"></a>
## Debugging mod_perl

Debugging mod_perl handlers is similar to debugging any Perl program remotely (see [Debugging Perl Remotely](#Perl_Remote_Debugger) to familiarize yourself with the terminology). Debugging mod_perl is different in that you'll typically invoke the code indirectly with a web browser, and that the Perl code is running inside an Apache web server.

To configure Komodo debugging in mod_perl:

1. Copy the entire `dbgp/perllib` sub-directory of the Komodo installation to a convenient directory on the server, or download and unpack the Perl Remote Debugging package from the [Komodo Remote Debugging](http://code.activestate.com/komodo/remotedebugging/) page. If you are running Apache on your local workstation, you can use Komodo's copy directly (e.g. _<Komodo-install-dir>/lib/support/dbgp/perllib_ ) for the following steps. **Note**: Do not copy _perl5db.pl_ to the standard "lib" directory of the Perl installation on the remote machine, as this will overwrite the standard _perl5db.pl_ file.

1. In the directory containing _perl5db.pl_, create a new directory called _Apache_. For example:

    ```
    $ cd Komodo/lib/support/dbgp/perllib
    $ mkdir Apache
    ```

1. Create a symlink or shortcut to _perl5db.pl_ within the new _Apache_ directory. For example:

    ```
    $ cd Apache
    $ ln -s ../perl5db.pl .
    ```

1. Install the Apache::DB perl module on the server:

    ```
    $ cpan Apache::DB
    ```

1. Add the following snippet to your _httpd.conf_ file (replace "_/path/to/dbgp/perllib_" with the full path to the directory containing _perl5db.pl_):

    ```
    <Perl>
      use ModPerl::Registry;
      use lib qw(/path/to/dbgp/perllib);
      $ENV{PERLDB_OPTS} = "RemotePort=localhost:9000 LogFile=stderr";
      use Apache::DB ();
      Apache::DB->init;
    </Perl>
    ```

    Make sure that `RemotePort` is set to the hostname and port Komodo using to listen for debugger connections (see the PERLDB_OPTS setting in the "Configure the Remote Machine" section of [Debugging Perl Remotely](#Perl_Remote_Debugger)).

1. You will probably already have a `<Location>` section in _httpd.conf_ (or _apache.conf_) for your perl scripts. Add the following line to that section:

    ```
    PerlFixupHandler Apache::DB
    ```

    For example:

    ```
    <Location /perl-bin>
        SetHandler perl-script
        PerlHandler ModPerl::Registry
        Options +ExecCGI
        PerlOptions +ParseHeaders
        PerlFixupHandler Apache::DB
    </Location>
    ```

1. Restart Apache in debug mode (e.g. `apache -X`), and open the page you wish to debug in a browser.

## Related Information

- [Perl Tutorial](/tutorial/perltut.html)
