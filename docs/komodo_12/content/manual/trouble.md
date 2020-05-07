---
title: Komodo Troubleshooting FAQ
---

- [Where is Komodo installed?](#install_dir)
- [Where does Komodo keep settings data?](#appdata_dir)
- [Where does Komodo save log files?](#host_dir)
- [Komodo doesn't start](#cannot_start)
- [How do I Start Komodo with Default Settings?](#ko_default)
- [Komodo has weird graphical artifacts](#artifacts)
- [I can't see my Left or Right Pane](#Projects_and_Files_panes)
- [I can't see my Bottom Pane](#Output_pane)
- [I want to maximize my Editor Pane](#Editor_pane)
- [How do I know if I'm debugging?](#Debug_mode)
- [How do I know if I'm editing?](#Edit_mode)
- [How can I add command-line arguments to my program for debugging?](#arguments_to_my_program)
- [Komodo crashes. What can I do?](#Komodo_crashes)
- [Why is Komodo so big?](#Komodo_big)
- [I already have Mozilla. Why do I need to have two versions?](#mozilla)
- [How can I skip the debug dialog box?](#debug)
- [I'm having trouble debugging PHP. What do I do?](#php_debug)
- [How do I emulate sessions in PHP debugging?](#trouble_php_sessions)
- [Why don't breakpoints work when I use the Psyco extension in Python?](#psyco_debug)
- [How do I configure Virtual Hosting on an Apache Web server?](#virtual_host_apache)
- [I moved my Komodo installation on Linux, and am now getting Perl debugging errors.](#linux_reloc)
- [How do I prevent the dialog from displaying every time I start the debugger?](#debug_dialog)
- [Why do I get a CGI security alert when debugging PHP?](#cgi_alert)
- [The Check Configuration window reports that a language installed on my system is not available. Why?](#lang_unavail)
- [My screen goes black for a second or two whenever I open files for which Komodo performs background syntax checking. Why?](#black_screen)
- [How can I run additional CVS commands from within Komodo?](#cvs_commands)
- [Why doesn't Ruby debugging work on my Linux x64 system?](#ruby_debug_x64)

<a name="install_dir" id="install_dir"></a>
## Where is Komodo installed?

The Komodo installer will prompt for an installation directory; you can choose any directory you have permissions to install to. The default location varies by platform, and the name of the directory corresponds to the version of Komodo you are running ("IDE" or "Edit" on Windows, "IDE" or "Edit" plus the version number on OS X and Linux):

**Windows**

```
C:\Program Files\ActiveState Komodo [IDE|Edit]\
```

**Note**: Older versions of Komodo on Windows installed in a directory which included the version number (e.g. "ActiveState Komodo IDE 4.2"), which allowed for side-by-side installations of different versions of Komodo. If you wish to do this, manually specify an install directory with a version number.

**Linux**

```bash
/opt/Komodo-[IDE|Edit]-<version>/
```

**OS X**

```bash
/Applications/Komodo-[IDE|Edit]-<version>.app
```
<a name="appdata_dir" id="appdata_dir"></a>
## Where does Komodo keep settings data?

Komodo stores preferences, userscripts, templates, keybinding schemes and other settings in a user-specific directory called the **user data** directory. The name and location of this directory varies depending on the operating system and Komodo version:

**Windows**

```
C:\Users\<user>\AppData\Local\ActiveState\Komodo[IDE|Edit]\<version>

```

**Linux**

```bash
/home/<user>/.komodo[ide|edit]/<version>

```

**macOS**

```bash
/Users/<user>/Library/Application Support/Komodo[IDE|Edit]/<version>

```

The location of this directory can be overridden using the `KOMODO_USERDATADIR` environment variable.

<a name="host_dir" id="host_dir"></a>
## Where does Komodo log output and errors?

The [user data](#appdata_dir) directory contains `pystderr.log` and `pystdout.log`, which can be useful for troubleshooting problems with Komodo.

<a name="cannot_start" id="cannot_start"></a>
## Komodo doesn't start. Why?

If Komodo doesn't start, there could be one of several issues.

- Do you have Norton Anti-Virus (NAV) installed, or more specifically, the File System Realtime Protection feature enabled?

    The problematic relationship between Komodo and Norton Anti-Virus' File System Realtime Protection feature is a known issue, which we are working to remedy. In the meantime, you can disable `NAV Corp 7.5 FSRP` before running Komodo, and then re-enable it after Komodo starts.

If none of these seem to apply to you, please follow the instructions in [this FAQ entry](#Komodo_crashes) to log a bug in Komodo's bug database.

<a name="ko_default" id="ko_default"></a>
## How do I Start Komodo with Default Settings?

Komodo saves all of it's settings in it's [[profile folder|Troubleshooting/Where-does-Komodo-keep-settings-data]], if you want to start Komodo with the default settings there's 2 things you could do:

* Start Komodo From a Temporary Profile
    * This is a good solution if you simply want to check if the default settings are exhibiting the same behavior as the one you are experiencing. Useful for debugging.
* Completely Reset your Settings

When Komodo looks for the profile folder and cannot find it it will create a new profile folder with the default settings.

### Start Komodo From a Temporary Profile

*Before following these steps please ensure that Komodo is not running.*

You can set the location where Komodo looks for its profile folder with the **KOMODO_USERDATADIR** environment variable. It's value should be set to the parent folder that you wish for Komodo to look in.

#### Windows

1. Open a command prompt
2. Execute the following Command:
    `set KOMODO_USERDATADIR=%TEMP%\ko`
3. Start Komodo from the command line, eg.
    `"C:\Program Files (x86)\ActiveState Komodo IDE 9\komodo.exe"`

#### Mac OSX

1. Open a terminal window
2. Execute the following Command:
    `export KOMODO_USERDATADIR=/tmp/ko`
3. Start Komodo from the terminal, eg.
    `open "/Applications/Komodo-IDE-9.app"`

#### Linux

1. Open a terminal window
2. Execute the following Command:
    `export KOMODO_USERDATADIR=/tmp/ko`
3. Start Komodo from the terminal, eg.
    `~/Komodo-IDE-9/bin/komodo`

### Completely Reset your Settings

If you want to completely start over, for whatever reason, you need to delete your Komodo profile folders and restart Komodo.

First, shut down Komodo and locate your [profile folders](#appdata_dir). Make a backup of these folders, just in case. Note that there are folders for each version of Komodo you have used. So if you used Komodo 9 through 9.2 you'll have 3 folders: "9.0", "9.1" and "9.2".

Once backed up you need to delete all of these folders to fully reset your settings as Komodo inherits it's settings from the previous version.

<a name="artifacts" id="artifacts"></a>
## Komodo has weird graphical artifacts

These types of issues are often hard to troubleshoot and can usually be resolved simply by disabling hardware acceleration. To do this, follow these steps:

 1. Open a file (any file)
 2. Use browser preview (View > Browser Preview) to preview the file "in a browser" but set it to open in a Komodo tab
 3. Replace the file address with about:config to get into the settings
 4. Look for layers.acceleration.disabled and set it to true
 5. Restart Komodo

Alternatively if you cannot access Komodo's UI at all you can:

 1. Shut down Komodo
 2. Open the XRE/prefs.js file from your [[profile folder|Where-does-Komodo-keep-settings-data]], create it if it does not already exist.
 3. Append the following at the end of the file:
     `user_pref("layers.acceleration.disabled", true);`
 4. Save and start Komodo

<a name="Projects_and_Files_panes" id="Projects_and_Files_panes"></a>
## Why can't I see my Left or Right Pane

One or more panes may be hidden.

To view the Left Pane, click the **Show/Hide Left Pane** button on the toolbar, use the options on the **View** menu, or use the associated [key binding](prefs.html#Config_Key_Bindings).

<a name="Output_pane" id="Output_pane"></a>
## I can't see my Bottom Pane

The Bottom Pane appears below the Editor Pane during debugging. If you can't see your Bottom Pane, it may be hidden.

To view the Bottom Pane, click the **Show/Hide Bottom Pane** button on the toolbar, use the options on the **View** menu, or use the associated [key binding](prefs.html#Config_Key_Bindings).

For more information, see [Debugging Programs](debugger.html)

<a name="Editor_pane" id="Editor_pane"></a>
## I want to maximize the Editor Pane

I like to see the Left and Right Panes and the Bottom Pane, but right now I want to maximize my Editor Pane to get some coding done. How can I maximize my Editor Pane?

To maximize your Editor Pane, hide the other panes in the Komodo workspace:

1.  Click the close arrow button that appears in the top right corner of each of these panes.

<a name="Debug_mode" id="Debug_mode"></a>
## How do I know if I'm debugging?

When Komodo is debugging, the title of the Komodo workspace includes an indication of the state of the debugger. If the debugger is running, the title looks similar to **[pathname\filename] - ActiveState Komodo - Debugger is running**. If the debugger has hit a breakpoint, the title looks similar to **[pathname\filename] - ActiveState Komodo - Debugger is in Break Mode**.

<a name="Edit_mode" id="Edit_mode"></a>
## How do I know if I'm editing?

You are editing any time you're not formally debugging. When Komodo is editing, the title of the Komodo workspace is **[pathname\filename] - ActiveState Komodo**.

<a name="arguments_to_my_program" id="arguments_to_my_program"></a>
## How can I add command-line arguments to my program for debugging?

If you want to send add command-line arguments to your program for debugging, you can add these using the Debugger Launch Options dialog:

1.  Select **Debug** > **Go Continue**.
2.  In the Debugger Launch Options dialog, select the directory you want to begin debugging your program in. Click **Browse** and navigate to the appropriate directory.
3.  In the same Debugger Launch Options dialog, enter your command-line arguments. These are sent to the script and not to the interpreter. Separate the arguments with spaces.
4.  Click **OK**.

<a name="Komodo_crashes" id="Komodo_crashes"></a>
## Komodo crashes. What can I do?

As Komodo is running it updates a few log files with debugging and error information. If Komodo crashes, you can help us best determine the issue by sending us those log files, along with information on how you came across the crash. On some operating systems the system creates a crash log as well, which you should also send to us. The log files may include:

- **startup.log** (in your Komodo user data dir)
- **pystderr.log** (in your Komodo user data dir)
- **pystdout.log** (in your Komodo user data dir)
- **console.log** (in your Komodo user data dir)
- **komodo-bin.crash.log** (macOS only, in _~/Library/Logs/CrashReporter_)

Please use the following steps to send us your crash information:

**Step 1: Ensure the logs are for the time Komodo crashed**

Komodo's log files are only for the last time Komodo was run. If you have restarted Komodo since the time it crashed on you, you must reproduce the crash so that the log files are relevant.

**Note:** If Komodo does not shut down correctly (i.e. it hangs), you may need to manually stop the `komodo-bin` process:

- **Windows**: Press `Ctrl+Shift+Esc` to open **Windows Task Manager**. Select the **Processes** tab. Right-click on the **komodo.exe** entry and select **End Process**.
- **macOS**: Right-click (or 'Option'+click) on the Komodo head icon in the Dock and select the **Force Quit** option.
- **Linux**: At the terminal run `ps ux | grep komodo-bin` to determine the Komodo process id (or "pid"). Then run `kill -9 PID` where "PID" is the process id from the previous command.

**Step 2: Locating the error log files**

Komodo stores its log files in the [host data](#host_dir) subdirectory of the [user data](#appdata_dir) directory.

On macOS, an additional `komodo-bin.crash.log` is created by the system in `~/Library/Logs/CrashReporter/`.

**Step 3: Verifying and <a name="Sending" id="Sending">sending the files to ActiveState</a>**

To log an issue:

1. Locate the log files and verify that they are not blank by viewing them with a text editor.
3. Create an issue describing what happened just before the crash in the Komodo Edit Github repository [https://github.com/Komodo/KomodoEdit/issues](https://github.com/Komodo/KomodoEdit/issues). You use this location to log issues for both Komodo and Komodo Edit because it is a public repository.
4. Fill out as much of the information requested in the issue template as you can and submit the issue. You can add the log files, screenshots, and any other information that you think will be helpful in diagnosing your issue.

<a name="Komodo_big" id="Komodo_big"></a>
## Why is Komodo so big?

Because Komodo is built on the Mozilla framework, it is necessary for us to include the Mozilla build that exactly matches the development version of Komodo. For that reason, even if you have Mozilla on your system, Komodo installs the Mozilla version that it requires.

Another sizable component of Komodo is language support. Komodo is so tightly integrated with Perl, Python, Ruby and PHP that it is necessary to include components of those languages, at specific version levels, for debugger and editor support.

<a name="mozilla" id="mozilla"></a>
## I already have Mozilla. Why do I need to have two versions?

When ActiveState develops a Komodo release, the work is based upon a specific version of Mozilla. During the development process, we upgrade the level of Mozilla used by Komodo, but this process requires considerable testing to ensure that no functionality is lost. Additionally, we add some custom components to the Mozilla tree that are used by Komodo. For these reasons, we recommend that you do not replace the Mozilla version included with Komodo with a later Mozilla version.

<a name="debug" id="debug"></a>
## How do I skip the dialog when I start the debugger?
To prevent the debugger dialog from appearing each time you start the debugger, hold down the 'Ctrl' key when you start the debugger. For example, on Windows and Linux, press 'Ctrl'+'F5' rather than 'F5' to start debugging. Click **Help** > **List Key Bindings** to find the equivalent key binding for the Emacs and macOS default key binding schemes.

<a name="php_debug" id="php_debug"></a>
## I'm having trouble debugging PHP. What do I do?

If you receive an error message when attempting to debug a PHP program or if the debugging process does not proceed as expected, verify that you have installed PHP and the Xdebug extension as per the instructions in the [Debugging PHP](debugphp.html) documentation, then check the following:

**Confirm PHP Configuration**

1.  **xdebug:** in the command or shell window, enter `php -m`. "xdebug" should be listed under Zend Modules (and not under PHP Modules). If this is not the case, your configuration is incorrect. See "Common PHP Configuration Problems" below.
1.  **Syntax Checking:** in Komodo, select **Edit|Preferences**. Click on **Smart Editing**, and ensure that "Enable background syntax checking" is checked. Open a PHP file and enter something that is syntactically incorrect, such as:

    ```
    <?
    asdf
    echo test;
    ?>
    ```

    Komodo should display a red squiggly line under `echo test;`. If it does not, it indicates that Komodo is not able to communicate with the PHP interpreter.

1.  **Debug:** if steps one and two were successful, ensure that the debugger is functioning by opening a PHP program and debugging it. Ensure that the correct [Preferences](prefs.html#PHP) are configured for PHP.

If any of the steps above were unsuccessful, proceed to the next section.

**Common PHP Configuration Problems**

- **Multiple PHP executables on one machine:** in Komodo's [Preferences](prefs.html#PHP), explicitly specify the PHP interpreter configured in your php.ini file. The location of the php.ini file can also be explicitly set.
- **Verify the PHP version:** PHP 4.4 or higher is required.
- **Verify Xdebug library specification:** The location of _xdebug.dll_ (Windows) or _xdebug.so_ (Linux) must be defined the _php.ini_ file, for example:
    - **Windows:**

        ```bash
        zend_extension=C:\php-5.3.2\extensions\php_xdebug.dll
        zend_extension_ts=C:\php-5.2.17\extensions\php_xdebug.dll
        ```

    - **Linux:**

        ```bash
        zend_extension=/php-5.3.2/extensions/php_xdebug.dll
        ```

- Ensure that the Xdebug extension is configured correctly in the _php.ini_ file as per the [Remote PHP Debugging](debugphp.html#debugphp_edit_php_ini) instructions.

**Windows-Specific Configuration Issues** **Version Error Messages**

If you receive a dialog with the following text, you need to download an updated version of `xdebug.dll (Windows)` or `xdebug.so (Linux)` from the [Xdebug.org](http://www.xdebug.org) site:

```bash
Warning
xdebug: Unable to initialize module
Module compiled with debug=0, thread-safety=1 module API=20001222
PHP compiled with debug=0, thread-safety=1 module API=20001222
These options need to match
```

<a name="trouble_php_sessions" id="trouble_php_sessions"></a>
## How do I emulate sessions in PHP debugging?

Though it is possible to emulate sessions in [local debugging](debugphp.html#local_debug_PHP) mode, this requires pre-knowledge of session keys, and how those session keys are communicated to PHP.

It is easier to debug sessions using [remote debugging](debugphp.html#remote_debug_PHP). Run the script under a web server and start the debugging session from a web browser. Komodo intercepts the session and debugs it. All session data is available and modifiable through the Variable tabs.

<a name="psyco_debug" id="psyco_debug"></a>
## Why don't breakpoints work when I use the Psyco extension in Python?

When debugging Python programs that use [Psyco](http://psyco.sourceforge.net/), the breakpoints will be ignored. This is due to the optimizations/changes made by the psyco compiler.

You can work around this problem with the following code which disables Psyco while debugging:

```python
import logging
if not logging.Logger.manager.loggerDict.has_key('dbgp'):
    import psyco
    psyco.full()

```

<a name="virtual_host_apache" id="virtual_host_apache"></a>
## How do I configure Virtual Hosting on an Apache Web server?

Virtual Hosting is an Apache feature for maintaining multiple servers on the same machine, differentiating them by their apparent hostname. For example, a single machine could contain two servers, "www.yourdomain.com" and "debug.yourdomain.com".

If you have configured your Apache installation to use Virtual Hosting (see [httpd.apache.org/docs/1.3/vhosts/](http://httpd.apache.org/docs/1.3/vhosts/)), you can add directives to your VirtualHost sections to specify how Komodo's PHP debugger extension operates for those hosts. Use the "php_admin_value" to set specific debugger settings for that virtual host. Here is an example:

```bash
NameVirtualHost *
<VirtualHost *>
php_admin_value xdebug.enabled 0
DocumentRoot "/Apache/htdocs/"
ErrorLog logs/www.error.log
Servername www.yourdomain.com
</VirtualHost>

<VirtualHost *>
php_admin_value xdebug.enabled 1
DocumentRoot "/Apache/htdocs/"
ErrorLog logs/debug.error.log
Servername debug.yourdomain.com
</VirtualHost>
```

This will enable debugging under debug.yourdomain.com, but not under www.yourdomain.com. You can additionally configure the Virtual Host to use a specific machine for remote debugging:

```bash
<VirtualHost *>
php_admin_value xdebug.enabled 1
php_admin_value xdebug.remote_host komodo.yourdomain.com
DocumentRoot "/Apache/htdocs/"
ErrorLog logs/debug.error.log
Servername debug.yourdomain.com
</VirtualHost>
```

For more information on configuring Virtual Hosting under Apache, see the Apache documentation at [httpd.apache.org/docs/](http://httpd.apache.org/docs/).

<a name="linux_reloc" id="linux_reloc"></a>
## I moved my Komodo installation on Linux, and am now getting Perl debugging errors.

On Linux, you cannot relocate an existing Komodo installation to a new directory. You must uninstall Komodo from the existing location and reinstall it in the new location. See [Uninstalling Komodo on Linux](/get/linux/#Uninstalling_Komodo_Lin) for instructions.

<a name="debug_dialog" id="debug_dialog"></a>
## How do I prevent the dialog from displaying every time I start the debugger?

To prevent the debugger dialog from appearing each time you start the debugger, hold down the 'Ctrl' key when you start the debugger. For example, on Windows and Linux, press 'Ctrl'+'F5' rather than 'F5' to start debugging. Click **Help** > **List Key Bindings** to find the equivalent key binding for the Emacs and macOS default key binding schemes.

<a name="cgi_alert" id="cgi_alert"></a>
## Why do I get a CGI security alert when debugging PHP?

The CGI security alert only occurs when you compile PHP with --enable-cgi-force-redirect. That compilation directive forces PHP to check if it is being run as a CGI by looking at environment variables commonly available only under a CGI environment. If they exist, it looks for another environment variable that is reliably available ONLY under Apache, REDIRECT_STATUS (or HTTP_REDIRECT_STATUS under Netscape/iPlanet). If that environment variable does not exist, the security alert is generated.

To run your compilation of PHP under Komodo with CGI emulation, you have to add a CGI environment variable called REDIRECT_STATUS with any value.

<a name="lang_unavail" id="lang_unavail"></a>
## When I click Check Configuration in the Help menu, Komodo reports that a language that is installed on my system is not available. Why?

In order for Komodo to detect the presence of a language installed on your system, the location of the language interpreter must be specified in your system's `PATH` environment variable. If the Check Configuration dialog states that a language is "Not Functional", or if the Komodo Preferences say that the language interpreter is not found on your system, check that the interpreter is specified in your `PATH`.

<a name="black_screen" id="black_screen"></a>
## My screen goes black for a second or two whenever I open files for which Komodo performs background syntax checking. Why?

Komodo launches a process as part of the background syntax checking that can cause a full screen command prompt to momentarily appear on some Windows systems. You can make the process invisible by editing the properties for the command prompt window. On the Windows **Start** menu, right-click the **Command Prompt** item, and select **Properties**. Select the **Options** tab, and change the Display options to **Window**.

<a name="cvs_commands" id="cvs_commands"></a>
## How can I run additional CVS commands from within Komodo?

Komodo can be used to check out, add, remove, compare, submit and revert files in a CVS repository. CVS offers additional commands such as import, checkout, history, annotate, rdiff and watch which can be put into [Run Commands](run.html#run_top) and saved to a project or the Toolbox. For example, the following `cvs import` command prompts for the User, Host, Module, Project and Version to import:

`cvs -d :ext:%(ask:User)@%(ask:Host):%(ask:Path) import %(ask:Module:) %(ask:Project:) %(ask:Version:)`

Alternatively, the `%(ask:...)` [interpolation shortcut](shortcuts.html) could be populated with defaults or replaced with static values:

`cvs -d :ext:%(ask:User:jdoe)@myhost:/var/cvsroot import %(ask:Module:) %(ask:Project:MyProject)`

CVS requires a real terminal for adding change descriptions. Be sure to set **Run in: New Console** in the command's properties.

<a name="ruby_debug_x64" id="ruby_debug_x64"></a>
## Why doesn't Ruby debugging work on my Linux x64 system?

Linux users trying to debug a Ruby application on AMD 64bit systems may see one of the following errors:

> The Komodo ruby debugger couldn't load the byebug component.
> This library ships with Komodo, but also can be installed by running `gem install byebug'

> The Komodo ruby debugger couldn't load the ruby-debug-base component.
> This library ships with Komodo, but also can be installed by running `gem install ruby-debug-base'

For Ruby 2.1+, Komodo does not ship byebug on all platforms. Simply run `sudo gem install byebug` to remedy this.

For Ruby 1.8-2.0, Komodo ships with a 32-bit version of ruby-debug-base, which will not work with 64-bit versions of Ruby. To fix this:

1.  Delete the installed `ruby-debug` libraries by removing the `[](#install_dir)/lib/support/dbgp/rubylib/1.8/` directory.
1.  Download the latest ruby-debug-base gem from [http://rubyforge.org/frs/?group_id=1900](http://rubyforge.org/frs/?group_id=1900)
1.  Install the downloaded file using `gem`:

```bash
sudo gem install ruby-debug-base-0.10.x.gem
```

Komodo will automatically find and use the new versions of the debugging libraries.
