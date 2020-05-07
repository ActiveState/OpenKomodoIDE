---
title: XSLT Tutorial
aliases: [/manual/regular_expressions_primer]
---

</a><a name="xslttut_over" id="xslttut_over"></a>
##  Overview

<a name="xslttutassumptions" id="xslttutassumptions"></a>
### Before You Start

This tutorial assumes:

- You are interested in XSLT. Previous knowledge of XSLT is not required for this tutorial. The XSLT Tutorial walks you through a simple program and later suggests various resources for further information.

<a name="xslttut_scenario" id="xslttut_scenario"></a>
### XSLT Tutorial Scenario

In the [Perl Tutorial](/tutorial/perltut.html#perltut_top), a Perl program converts a text file containing exported email messages to an XML file. In this tutorial, XSLT converts the XML file to HTML. Note that you do not need to complete the Perl Tutorial before doing the XSLT Tutorial. Each tutorial can be completed independently. In this tutorial you will:

1.  [**Open the XSLT Tutorial Project**](#xslttut_openproject) and associated files.
1.  [**Analyze mailexport.xml**](#xslttut_analyze) the XSLT program included in the XSLT Tutorial Project.
1.  [**Run the Program**](#xslttut_run) and generate HTML output through the transformation.
1.  [**Debug the program**](#xslttut_debug) using the Komodo debugger.

<a name="xslttut_openproject" id="xslttut_openproject"></a>
## Opening the Tutorial Project

Select **Help > Tutorials** > **XSLT Tutorial**.

The tutorial project will open in the [Places sidebar](/manual/workspace.html#places_sidebar).

<a name="xslttut_openfile" id="xslttut_openfile"></a>
### Opening the XSLT Tutorial Files

In the [Places sidebar](/manual/workspace.html#places_sidebar), double-click the _mailexport_, _mailexport.xml_, and _mailexport2html.xsl_ files. These files open in the Editor Pane, and a tab at the top of the pane displays each of their names.

<a name="xslttut_overview" id="xslttut_overview"></a>
### Overview of the Tutorial Files

- **mailexport.xml**: An input file that contains email messages converted to XML format. (See how this was done in the [Perl Tutorial](/tutorial/perltut.html).)
- **mailexport2html.xsl**: An XSLT program that generates an HTML file from the _mailexport.xml_ input file.
- **mailexport**: A file that stores the HTML output from the XSLT transformation.

<a name="xslttut_analyze" id="xslttut_analyze"></a>
## Analyzing the Program

In this step, you will analyze the XSLT program on a line-by-line basis. Open the XSLT Tutorial Project and associated files as described in [the previous step](#xslttut_openproject). Be sure Line Numbers are enabled in Komodo (**View** > **View Line Numbers**). Be sure the _mailexport2html.xsl_ file is displayed in the Komodo Editor Pane.

<a name="xslttut_setup" id="xslttut_setup"></a>
### XSLT Header

#### Lines 1 to 3 - XML and XSLT Declarations

- an XSLT program is an XML document - thus, the XML version and character set are declared on the first line
- the namespace declaration on the second line tells the "parser" (the XSLT interpreter) that XSLT elements are prefixed with `xsl:` to prevent confusion with user-defined element names and non-XSLT elements
- `xsl:output` controls the appearance of the generated output; for example, the presence of this line generates a `META` declaration in the head of the HTML output

**Tip**: Different types of language elements are displayed in different colors. Adjust the display options for language elements in the [Preferences](/manual/prefs.html#prefs_top) dialog box.

**XSLT Pointer**: Processing routines in XSLT programs are enclosed in opening and closing tags similar to those in XML.

<a name="xslttut_write_header" id="xslttut_write_header"></a>
### HTML Header

#### Line 6 - XSLT "template"

- `template` is the main processing element in an XSLT program
- the `match="/"` attribute specifies that the template is selected when the document element is processed

**XSLT Pointer**: XSLT commands have (up to) four components: namespace ("xsl"), element ("template"), attribute(s) ("match="), and attribute value(s) ("/").

**XSLT Pointer**: XSLT uses XPath expressions to select data from XML documents. On line 6, `match="/"` selects a "node" in the XML document's hierarchy, rather than a specific item of data.

#### Lines 7 to 11 - HTML Tags

- writes standard HTML tags to the output document

#### Line 12 - XSLT apply-templates

- processes each node of the XML document (that is, each sub-section contained beneath the current position in the XML document)
- for each node, the XSLT "engine" (the internal processor) checks the XSLT program for a matching template
- the first XML tag with a corresponding template is `<EMAIL>`

#### Lines 13 to 15 - HTML Tags

- after processing all the nodes in the XML document, processing returns to line 13, where the closing tags for the HTML page are written to the output
- line 15 closes the XSLT processing routine, completing the program

<a name="email_header" id="email_header"></a>
### Format Email Header

#### Lines 18 to 21 - Select HEADER content

- when line 18 is processed, content in `<HEADER>` tags in the XML document are processed
- lines 19 and 21 write standard HTML formatting around the content generated in line 20
- on line 20, the `value-of` statement selects content contained in the `<SUBJECT>` tag and writes it to the output document

**Tip**: Click the minus symbol to the left of line 19. The entire section of nested code is collapsed. This is called [Code Folding](/manual/editor.html#Folding).

#### Lines 22 to 29 - call-template

- after the `From:` text, the `call-template` routine causes the XSLT program to proceed to the template `formatEmail` on line 51; after completing the `formatEmail` routine, processing returns to line 23
- `with-param` indicates that the parameter `address` should be applied to the contents of the `<ORIGADDRESS>` XML tag
- the same selection and formatting routine is applied to the contents of the `<DESTADDRESS>` XML tag on lines 26 to 28

**XSLT Pointer**: Notice the `<BR/>` HTML tag on line 25\. XML and XSLT treat all tags as container tags that have both opening and closing elements. However, some HTML tags (like `<BR>` and `<IMG>`) stand alone, and do not require a closing tag. They are represented with a closing slash. XSLT tags also use a closing slash if they are not a tag pair (as shown on line 23).

<a name="xslttut_process_loop" id="xslttut_process_loop"></a>
### Process Email

#### Lines 33 to 34 - Process First Message

- when the `apply-templates` tag in line 12 is encountered, processing jumps to line 33
- on line 34, the `HEADER` node is selected and processing jumps to line 18

**XSLT Pointer**: Comments in XSLT programs are enclosed in the tags `<!--` and `-->`, the same as in HTML.

#### Lines 36 to 39 - Process Email Body

- after processing the email header, the XSLT program proceeds to line 36
- the contents of the `BODY` tag are placed in the HTML tags

**Tip**: XSLT programs and XML input documents must be "well-formed" in order to perform transformations. Komodo's [Background Syntax Checking](/manual/editor.html#Linting) makes it easy to identify and fix coding errors.

### Format Email Addresses<a name="format_address" id="format_address"></a>

#### Lines 45 to 52 - Format Email Addresses

- the routine that starts on line 47 is called from lines 22 and 26
- `address` parameter contents are determined on lines 23 and 27
- on line 49, the contents of the `address` parameter are converted to a variable and concatenated with the text that constitutes a valid email address reference in HTML

<a name="xslttut_run" id="xslttut_run"></a>
## Running the Program

To start, generate program output by running the program through the debugger without setting any breakpoints.

1.  **Assign XML input file**: On the **Debug** menu, click **Go/Continue**. In the [Debugging Options](/manual/debugger.html#Debugging_Options) dialog box, specify _mailexport.xml_ as the XML input file. Use the **Browse** button to navigate to the directory containing the XSLT tutorial project files.
1.  **Run the debugger**: Click **OK** to run the debugger.
1.  **Stop the debugger**: From the **Debug** menu, select **Stop** to end the debugging process.
1.  **View Debug Output**: Notice the messages displayed on the status bar in the bottom left corner of the screen; these indicate the debugger status. The results of the transformation are displayed on the **Debug** tab.
1.  **View the Output as HTML**: On the right side of the Bottom Pane, click the **HTML** tab. The rendered HTML is displayed in the Bottom Pane. Click the **Output** tab to return to the HTML code.
1.  **Create New File**: To create a new HTML file that will later contain the HTML code in the Bottom Pane, select **File** > **New** > **New File**. In the New File dialog box, select the HTML Category. Click **Open**.
1.  **Save the Output**: Delete the contents of the new HTML file tab in the Editor Pane, and then select the contents of the **Output** tab on the Bottom Pane. Copy the contents to the new HTML file tab in the Editor Pane. Select **File** > **Save As** to save the file with a unique name.

<a name="xslttut_debug" id="xslttut_debug"></a>
## Debugging the Program

This section reviews how to add breakpoints to the program and "debug" it. Adding breakpoints lets you to run the program in parts, making it possible to watch variables and view output as they are generated. Before beginning, be sure that line numbering is enabled in Komodo (**View** > **View Line Numbers**).

1.  **Step In/Assign the XML input file**: If necessary, click on the _mailexport2html.xsl_ tab in the editor. From the menu, select **Debug** > **Step In**. In the [Debugging Options](/manual/debugger.html#Debugging_Options) dialog box, specify _mailexport.xml_ as the XML input file. This should already be set if the input file was assigned in the [previous step](#xslttut_run). Assigning the XML input file to the XSLT program file selects the XML file as the default input file when running the transformation.
1.  **Start Debugging**: In the [Debugging Options](/manual/debugger.html#Debugging_Options) dialog box, click **OK** to start debugging. Debugger commands can be accessed from the **Debug** menu, by shortcut keys, or from the **Debug Toolbar**. For a summary of debugger commands, see the [Debugger Command List](/manual/debugger.html#How_use_Debugger).
1.  **Watch the debug process**: A yellow arrow on line 7 indicates the position in the XSLT file where the debugger has halted.
1.  **View Debug tab**: In the [Bottom Pane](/manual/workspace.html#Output_Pane), click the **Debug** tab. On the right side of the **Debug** tab, click the **Call Stack** tab. On the **Call Stack** tab, notice that the current call stack is the template in line 6 of the XSLT program.
1.  **Set a breakpoint**: On the **mailexport2html.xsl** tab in the Editor Pane, click the gray margin immediately to the left of the code on line 12. This sets a breakpoint, indicated by a red circle. Breakpoints can be set at any time. An enabled breakpoint is a solid red circle. A disabled breakpoint is a white circle with a red outline. Click once in the gray margin to enable a breakpoint. Click an enabled breakpoint once to disable it.
1.  **Line 7: Continue**: Select **Debug** > **Go/Continue**. The debugger runs until it encounters the breakpoint on line 12. If no breakpoint had been set, the debugger would have run to the end of the program.
1.  **Line 12: Step In**: Click **Debug** > **Step In**. Notice the debugger jumps to line 33 of the XSLT program, and shows a pointer in the XML file on line 3\. When the debugger processed line 12 (`xsl:apply-templates`), it looked for a template that matched the top node in the XML document (`<EMAILCOMMENTS>`). When no matching template was found, it proceeded to the next node in the XML document (`<EMAIL>`) and found a matching template on line 33.
1.  **View the Debug tab**: Notice that the **Call Stack** tab displays the current template match. Previous template matches can be selected from the list; double-clicking them jumps to the corresponding lines in both files.
1.  **Line 33: Step In**: Use the **Step In** command until the current-line pointer in the XSLT file is on line 20.
1.  **Line 20: Step In**: Watch the Bottom Pane as you Step In line 21. The `xsl:value-of` statement selects the contents of the `<SUBJECT>` field on line 7 of the XML file and places it within the HTML tags on lines 19 and 21.
1.  **Line 21: Step In**: Line 22 calls the template `formatEmail` on line 45. Continue to step in until line 49 is processed. The `formatEmail` template is processed with the `address` parameter on line 46. This routine processes the contents of the `<ORIGADDRESS>` node in the XML document. In order to generate the hyperlink in the output HTML document, lines 48 and 49 concatenate the string `mailto:` with the contents of the `<ORIGADDRESS>` node.
1.  **Line 49 to end: Go/Continue**: On **Debug** menu, click **Go/Continue** to run the rest of the XSLT program. The program's output is displayed in the Bottom Pane: raw output in the Output tab and rendered output in the HTML tab.

<a name="xslttut_resources" id="xslttut_resources"></a>
## More XSLT Resources

### Documentation

The W3C (World Wide Web Consortium) specifications are available online:

- [XSLT](http://www.w3c.org/TR/xslt)
- [XPath](http://www.w3c.org/TR/xpath)
- [XML](http://www.w3c.org/XML/)

## Tutorials and Reference Sites

There are many XSLT tutorials and beginner XSLT sites on the Internet, including free tutorials at [W3Schools.com](http://www.w3schools.com/default.asp).
