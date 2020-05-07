---
title: Debugging JavaScript with Google Chrome
---
(Komodo IDE only)

Komodo can debug JavaScript on web pages locally or [remotely](debugger.html#remote_debugging). The instructions below describe how to configure Komodo for debugging JavaScript with Google Chrome in both scenarios. For general information about using the Komodo debugger, see [Debugging your programs](debugger.html).

Debugger commands can be accessed from the **Debug** menu, by shortcut keys, or from the Debug Toolbar. For a summary of debugger commands, see the [Debugger Command Description](debugger.html#How_use_Debugger).

<a name="Configure_Chrome" id="Configure_Chrome"></a>
## Configuring Google Chrome in the Preferences

To specify which Google Chrome executable Komodo uses for debugging:

1.  Select **Edit** > **Preferences** (macOS: **Komodo** > **Preferences**).
1.  In the Preferences dialog box under **Languages** (click on the arrow to the left of the item), click **JavaScript**. Komodo searches for Google Chrome on your system and displays them in the drop-down list.
1.  If the preferred executable is in this list, click to select it. If not, click **Browse** to locate it.
1.  Click **OK**.

<a id="Chrome_Local_Debugger"></a>
## Debugging JavaScript Locally

To start a local JavaScript debugging session:

On the **Debug** menu or Debug Toolbar, click **Go/Continue** or **Step In** to invoke the debugging session. You can do this from a JavaScript or other HTML-based file (e.g. ".html", ".erb", etc.). If you wish to debug a local file, enter its name in the "Script" field. Komodo will launch Chrome with that local file and begin debugging. If you wish to debug a web page that has a URL, enter that URL in the "Script" field. Komodo will launch Chrome with that URL and begin debugging. [Toggle breakpoints](debugger.html#toggle_breakpoint) by clicking in the Breakpoint Margin.

See [Debugging your programs](debugger.html) for full instructions on using Komodo's debugging functionality.

**Note**: Komodo needs to launch Chrome with debugging flags for debugging to work, because of this Chrome cannot be running when you start debugging. Once Komodo has started Chrome you can then keep it running. Attempting to debug with a Chrome instance that was already launched outside of Komodo will not work. This is a limitation in Chrome, not Komodo.

<a name="Chrome_Remote_Debugger" id="Chrome_Remote_Debugger"></a>
## Debugging JavaScript Remotely

When debugging JavaScript remotely, Google Chrome is running on the remote system with the file or URL to debug. Komodo controls the debugging session (e.g. stepping and breakpoints) once the session starts on the remote system.

To begin debugging on the remote system, run Google Chrome on that remote system with the following command line switch:

```
<chrome_executable> --remote-debugging-port=<port>
```

Google Chrome recommends port 9222 (and this is what Komodo uses for local debugging).

Then to start debugging with Komodo:

On the **Debug** menu or Debug Toolbar, click **Go/Continue** or **Step In** to invoke the debugging session. You can do this from a JavaScript or other HTML-based file (e.g. ".html", ".erb", etc.). Enter the URL of the remote web page to debug in the "Script" field. Then click the **Environment** tab and change the default

```
--host=localhost --port=9222
```

to match your remote system's hostname and Google Chrome remote debugging port.

**Note**: For Komodo to open an editable copy of the file, a [Mapped URI](debugger.html#remote_uri_mapping) must be created to link the file on the remote filesystem with the URI Komodo receives from the remote debugger.

<a name="Chrome_Debugger_Note" id="Chrome_Debugger_Note"></a>
### Limitations

Due to the nature of Google Chrome's remote debug protocol, it is not possible to place a breakpoint in "top-level" JavaScript and debug from there. For example, given the following content of a file:

```
<html>
  <head>
    <script type="text/javascript">
      console.log("Hello World!");
    </script>
  </head>
  <script type="text/javascript">
    console.log("Hello World Again!");
  </script>
</html>
```

Any breakpoints placed on the "console.log" lines will not be hit. Debuggable JavaScript must be executed by event-driven code, such as an "onclick" event handler.
