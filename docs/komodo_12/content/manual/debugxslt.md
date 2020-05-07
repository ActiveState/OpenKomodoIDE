---
title: Debugging XSLT
---
(Komodo IDE only)

Komodo does not need to be manually configured for local XSLT debugging. It uses the **libxslt** and **libxml** libraries directly to transform XML documents into HTML, text, or other XML document types. See [www.libxml.org](http://www.libxml.org) for more information on this XML C parser and toolkit.

For general information about debugging with Komodo, see [General Debugger Functions](debugger.html). Debugger commands can be accessed from the **Debug** menu, by shortcut keys, or from the Debug Toolbar. For a summary of debugger commands, see the [Debugger Command List](debugger.html#How_use_Debugger).

<a name="debugxslt_using" id="debugxslt_using"></a>
## Using the XSLT Debugger

To debug an XSLT file:

1.  Open the XSLT file and [set breakpoints](debugger.html#breakpoints_and_spawnpoints).
1.  Start the debugger by clicking **Go/Continue** or **Step In** on the Debug Toolbar.
1.  In the **[Debugging Options](debugger.html#Debugging_Options)** dialog, **Select the input XML file**.
1.  Click **OK** to start the debugger.

The XSLT program, the input XML file, and the results of the transformation appear simultaneously. By default, Komodo splits the Editor pane horizontally.

- The XSLT program continues to appear in the top tab group.
- The XML input file appears in a new tab below the XSLT program.
- The results of the transformation are displayed in the Output tab.

A yellow arrow on the breakpoint margin shows the current line of execution in both the XSLT and XML file. Breakpoints can be set in the both files before starting the debugging session, or while stepping through the code.

<a name="debugxslt_remote_xml" id="debugxslt_remote_xml"></a>
### Using a Remote XML Input File

To debug using an XML file on a remote server, enter the full URL to the file in the **Select the input XML file** field (for example, http://www.example.org/input_file.xml).

<a name="debugxslt_stepping" id="debugxslt_stepping"></a>
### XSLT Stepping Behavior

Stepping behavior in the XSLT file is similar to the standard stepping behavior described in [Debugger Stepping Behavior](debugger.html#Debugger_Stepping_Behavior), but the terminology for describing XSLT is slightly different than that used for scripting languages.

- **Step In**: Executes the current XSL element or template line and pauses at the following line.
- **Step Over**: Not applicable. Behaves the same as **Step In**.
- **Step Out**: When the debugger is within an XSL element, **Step Out** will execute the entire block without stepping through the code line by line. The debugger will stop on the line following the closing tag of the element.

Though the current line is highlighted in both the XSLT and XML files, the stepping behavior is only applicable to the XSLT file.

## Related Information

- [XSLT Tutorial](/tutorial/xslttut.html)
