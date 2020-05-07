---
title: Debugging Ruby
---
(Komodo IDE only)

Komodo can debug Ruby programs locally or remotely. The instructions below describe how to configure Komodo and Ruby for debugging. For general information about using the Komodo debugger, see [Komodo Debugger Functions](debugger.html#debugger_top).

Debugger commands can be accessed from the **Debug** menu, by shortcut keys, or from the Debug Toolbar. For a summary of debugger commands, see the [Debugger Command List](debugger.html#How_use_Debugger).

<a name="Configure_Ruby_Debugger" id="Configure_Ruby_Debugger"></a>
## Configuring the Ruby Debugger

To specify which Ruby interpreter Komodo uses for debugging:

1. Select **Edit** > **Preferences** (macOS: **Komodo** > **Preferences**).
1. In the left hand list, expand the **Languages** entry and then select **Ruby**. Komodo searches for Ruby interpreters on your system and displays them in the drop-down list.
1. If the preferred interpreter is in this list, click to select it. If not, click **Browse** to locate it.
1. Click **OK**.

To start a local Ruby debugging session:

On the **Debug** menu or Debug Toolbar, click **Go/Continue** or **Step In** to invoke the debugging session. See [Komodo Debugger Functions](debugger.html#debugger_top) for full instructions on using Komodo's debugging functionality.

**Note:** macOS users may have to install a more recent version of Ruby (1.8.4 or greater). Linux users on x86_64 systems will need to install a 64 bit version of the `byebug` or `ruby-debug` libraries (see the [Komodo FAQ entry](trouble.html#ruby_debug_x64) for more information).

<a name="Ruby_Remote_Debugger" id="Ruby_Remote_Debugger"></a>
## Debugging Ruby Remotely

When debugging a Ruby program remotely, the program is executed on the remote system and the debug output is sent to Komodo. Komodo controls the debugging session (e.g. stepping and breakpoints) once the session starts on the remote system.

1.  Install the Ruby debugger application and associated files on the remote machine. All of these files are included in `/lib/support/dbgp/rubylib` beneath the Komodo installation directory (`/Contents/SharedSupport/dbgp/rubylib` on macOS). Copy the contents of the `rubylib` directory to a convenient location on the remote machine.

    **Note**: Some of these files are shared library files (.so), which are platform specific. If your Komodo installation is on a different platform, the easiest step is to download Komodo IDE for that platform, and pull the Ruby debugger out of that installation.

1. [Start Komodo](/manual/starting.html) on the local machine.

1.  On the remote machine, set the `dbgdir` variable to specify the path to the remote machine directory where you copied `rdbgp2.rb` (for Ruby 2.x) and `rdbgp.rb` (for Ruby 1.x) and its associated files.

    ```
    rem Windows
    set dbgdir=<remote_directory_path>

    # Linux/macOS
    dbgdir=<remote_directory_path>
    ```
1. On the remote machine, set the `RUBYDB_OPTS` variable. This supplies the Ruby interpreter with the information that is necessary to connect to the Komodo application running on the local machine.

    ```
    rem Windows
    set RUBYDB_OPTS=remoteport=<ServerName>:<Port>
    set RUBYOPT=

    # Linux/macOS**
    export RUBYDB_OPTS=remoteport=<Server_Name>:<Port>
    unset RUBYOPT
    ```
1. Start the debugger and open the program that you want to debug.

    ```
    rem Windows, Ruby 2.1+
    ruby -I%dbgdir% %dbgdir%\rdbgp2.rb <Program_To_Debug.rb>
    rem Windows, Ruby 1.8-2.0
    ruby -I%dbgdir% -r %dbgdir%\rdbgp.rb <Program_To_Debug.rb>

    # Linux/macOS, Ruby 2.1+
    ruby -I"$dbgdir" "$dbgdir"/rdbgp2.rb <Program_To_Debug.rb>
    # Linux/macOS, Ruby 1.8-2.0
    ruby -I"$dbgdir" -r "$dbgdir"/rdbgp2.rb <Program_To_Debug.rb>
    ```

The remote file will open in Komodo with the debugger stopped at or after the first line of executable code. A yellow arrow indicates the current position. You can now set breakpoints in this file, step through, and use other Komodo debugging features as if it were a local file. However, you cannot modify the file.

**Note**: For Komodo to open an editable copy of the file, a [Mapped URI](/manual/debugger.html#remote_uri_mapping) must be created to link the file on the remote filesystem with the URI Komodo receives from the remote debugger.

<a name="rdbgp_stop_next" id="rdbgp_stop_next"></a>
### Setting a Break in your Ruby Code (Ruby 1.x only)

To break into a remote debugging session directly from within your Ruby 1.x code, insert the following:

```
ENV['RUBYDB_OPTS'] = 'remoteport=_<Server_Name>:<Port>_'
$:.push('_<Path_To_rdbgp.rb>_')
require 'rdbgp'
```

The first two lines set up the environment for remote debugging (similar to steps three and four [above](#Ruby_Remote_Debugger)). The third line loads the debugger which breaks immediately by default.

Once the debugger has been loaded, subsequent breaks can be specified in the program with the `Debugger.current_context.stop_next` function. It's a good idea to wrap this function in a `begin ... end` block in case the module wasn't loaded:

```
begin;
        Debugger.current_context.stop_next = 1;
rescue Exception;
end
```

These in-code breakpoints can be easily toggled by changing the boolean value (i.e. 1 = enabled, 0 = disabled).

<a name="Ruby_Debugging_and_Rubygems" id="Ruby_Debugging_and_Rubygems"></a>
### Rubygems and RUBYOPT

[Rubygems](http://rubygems.org/) is the most commonly used framework for managing third-party Ruby modules.

Rubygems is included with the One-Click Installer (available at [http://rubyforge.org/projects/rubyinstaller/](http://rubyforge.org/projects/rubyinstaller/)). This installer adds the environment variable `RUBYOPT=rubygems` to the list of system variables. This is usually correct behavior, as it automatically enables all your Ruby scripts to use rubygems to find modules. However, it will cause the Ruby debugger to always step into a file called `ubygems.rb` (a simple wrapper around `rubygems.rb`) when debugging.

There are three ways to avoid this:

1. Set a breakpoint on the first line of the main file, and start the debugger with **Go** instead of the **Step Into**.
1. In Komodo's [Environment](/manual/prefs.html#Environment) preferences, set the `RUBYOPT` environment variable an empty string.
1. When you start the debugger, choose the **Environment** tab in the Debugging Options dialog box, add a new entry for `RUBYOPT` in the **User Environment Variables** box, and leave its value empty.

<a name="Ruby_Rails_Debugging" id="Ruby_Rails_Debugging"></a>
## Debugging Rails Applications

Ruby on Rails applications can be debugged locally or remotely just like any other ruby application. However, since much of the Rails framework has to run within the debugger, the process is normally slower than with a standalone ruby program.

**Note:** If your app has a Gemfile, make sure that the Gemfile isn't loading the `byebug` or `ruby-debug` or `ruby-debug19` gems (these are both present but commented out by default when a new Rails app is created). If the appropriate line is active (`ruby-debug` for Ruby 1.8, `ruby-debug19` for Ruby 1.9, and `byebug` for Ruby 2.x), there will be an error message referring to an "INTERNAL ERROR" where a null value was encountered.

<a name="Local_Rails_Debugging" id="Local_Rails_Debugging"></a>
### Local Rails Debugging

The complexity of the Rails environment increased by an order of magnitude with version 3\. Tools like `bundler` and `rvm` help deal with the complexity, but Komodo is currently unaware of them. If you find local Rails debugging, as described below, doesn't work, you'll need to start a remote debugging session (even on the same machine), described in the next section. In particular, if you're using `rvm`, or are using `bundle exec` to start the server, you'll need to follow the "Remote Debugging" steps.

1.  Load the pertinent _app_ or _controllers_ files in Komodo.
1.  Set breakpoints in the methods where you want to stop.
1.  Load the _script/server_ file that you would normally run from the command-line.
1.  In the Debugging Configuration dialog, set the _Directory_ field to the top-level directory containing the _apps_ folder.
1.  With the _script/server_ file active, start the debugger.

<a name="Remote_Rails_Debugging" id="Remote_Rails_Debugging"></a>
### Remote Rails Debugging

1.  Follow the steps described above in [Debugging Ruby Remotely](#Ruby_Remote_Debugger) to install the ruby debugger and set the environment variables `dbgdir` and `RUBYDB_OPTS`.
1.  Start the Rails _script/server_ with the ruby debugger from the top-level directory containing the _apps_ folder:

    ```ruby
    rem Windows, Ruby 2.1+, Rails 3+
    ruby -I%dbgdir% %dbgdir%\rdbgp2.rb script/rails server webrick
    rem Windows, Ruby 1.8-2.0, Rails 3+
    ruby -I%dbgdir% -r %dbgdir%\rdbgp.rb script/rails server webrick
    rem Windows, Ruby 2.1+, Rails 1-2
    ruby -I%dbgdir% %dbgdir%\rdbgp2.rb script/server webrick
    rem Windows, Ruby 1.8-2.0, Rails 1-2
    ruby -I%dbgdir% -r %dbgdir%\rdbgp.rb script/server webrick

    # Linux/macOS, Ruby 2.1+, Rails 3+
    ruby -I"$dbgdir" "$dbgdir"/rdbgp2.rb script/rails server webrick
    # Linux/macOS, Ruby 1.8-2.0, Rails 3+
    ruby -I"$dbgdir" -r "$dbgdir"/rdbgp.rb script/rails server webrick
    # Linux/macOS, Ruby 2.1+, Rails 1-2
    ruby -I"$dbgdir" "$dbgdir"/rdbgp2.rb script/server webrick
    # Linux/macOS, Ruby 1.8-2.0, Rails 1-2
    ruby -I"$dbgdir" -r "$dbgdir"/rdbgp.rb script/server webrick
    ```

The remote files will open in Komodo with the debugger stopped at or after the first line of executable code. A yellow arrow indicates the current position. You can now set breakpoints in this file, step through, and use other Komodo debugging features as if it were a local file. Typical use involves setting breakpoints in controller and view files, pressing Continue, and then interacting with the app via a browser. The debugger should kick in and stop at the set breakpoints.

<a name="Troubleshooting_Ruby" id="Troubleshooting_Ruby"></a>
### Troubleshooting

On Linux the 1.x Ruby debugger expects to find libruby.so.1.[89] on its search path. This is installed by **rvm**, but there have been reports from other systems where this file wasn't found. A generic "Failed to load file" error message at the start of debugging usually indicates this.

Ruby 2.0 debugging is supported beginning with Komodo 8.0.2.

Ruby 2.1+ debugging is supported beginning with Komodo 10.

## Related Information

- [Ruby Tutorial](/tutorial/rubytut.html)
