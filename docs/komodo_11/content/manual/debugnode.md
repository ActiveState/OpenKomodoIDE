---
title: Debugging Node.js
---
(Komodo IDE only)

Komodo can debug Node programs locally or [remotely](debugger.html#remote_debugging). The instructions below describe how to configure Komodo and Node for debugging in both scenarios. For general information about using the Komodo debugger, see [Debugging your programs](debugger.html).

Debugger commands can be accessed from the **Debug** menu, by shortcut keys, or from the Debug Toolbar. For a summary of debugger commands, see the [Debugger Command Description](debugger.html#How_use_Debugger).

<a name="Configure_Node" id="Configure_Node"></a>
## Configuring Node in the Preferences

To specify which Node.js interpreter Komodo uses for local debugging and code intelligence:

1.  Select **Edit** > **Preferences** (macOS: **Komodo** > **Preferences**).
1.  In the Preferences dialog box under **Languages**, click **Node**. Komodo searches for Node interpreters on your system and displays them in the drop-down list.
1.  If the preferred interpreter is in this list, click to select it. If not, click **Browse** to locate it.
1.  Click **OK**.

<a id="Node_Local_Debugger"></a>
## Debugging Node Locally

To start a local Node debugging session:

On the **Debug** menu or Debug Toolbar, click **Go/Continue** or **Step In** to invoke the debugging session. [Toggle breakpoints](debugger.html#toggle_breakpoint) by clicking in the Breakpoint Margin.

See [Debugging your programs](debugger.html#debugger_top) for full instructions on using Komodo's debugging functionality.

<a name="Node_Remote_Debugger" id="Node_Remote_Debugger"></a>
## Debugging Node Remotely

When debugging a Node program remotely, the program is executed by the debugger on the remote system and the debug output is sent to Komodo over the network using the DBGP protocol. Komodo controls the debugging session (e.g. stepping and breakpoints) once the session starts on the remote system.

To set this up on the remote system, install the komodo-debug package with npm:

```
npm install komodo-debug -g
```

This installs the `node-dbgp` program and supporting libraries. To initiate a remote debugging session:

```
node-dbgp -h <komodo-host> -p <port> server.js
```

Specify the hostname or IP address of the system running Komodo with the '-h' option and the debugger listener port with '-p'. You can check the port Komodo is listening on under **Debug** > **Listener Status**. If the [DBGP Proxy](debugger.html#dbgp_proxy) is used, specify those instead.

On systems where you cannot install komodo-debug globally, you may need to run `node-dbgp` with the node interpreter and specify the path to it:

```
node /path/to/node_modules/node-dbgp ...
```

**Note**: For Komodo to open an editable copy of the file, a [Mapped URI](debugger.html#remote_uri_mapping) must be created to link the file on the remote filesystem with the URI Komodo receives from the remote debugger.

<a name="Node_Debugger_Statement" id="Node_Debugger_Statement"></a>
### Node.js Hard Coded Breakpoints

Breakpoints can be hard-coded in a Node application using the `debugger` statement. This will initiate a break at the corresponding line when the application is run with `node-dbgp`.
