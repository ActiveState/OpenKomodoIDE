---
title: Snippets
---
**Feature Showcases**

- [Abbreviations](abbreviations.html): inserting snippets by name
- A snippet that [prompts for input](/tutorial/tourlet_snipinput.html)
- A snippet containing a [code fragment](/tutorial/tourlet_codecomp.html)

Snippets are frequently used strings that can be quickly inserted into the current document. For example, repetitive sections of code or standard comments can be stored within a snippet. Snippets have advanced properties; they support the use of [Tabstops](tabstops.html) and [Interpolation Shortcuts](shortcuts.html), can be assigned to [Key Bindings](prefs.html#Config_Key_Bindings) and associated with abbreviations, and allow for the specification of indentation context and cursor position.

Snippets are stored in the [Toolbox](toolbox.html).

<a name="snippets_creating" id="snippets_creating"></a>
## Creating Snippets

To create a code snippet, select the desired block of text in the Editor Pane. Then drag and drop the selected section onto the [Toolbox](toolbox.html) tab.

Alternatively, select the desired text, then right-click and select **Add as Snippet in the Toolbox**.

Alternatively, right-click a folder in the Toolbox, and select **New Snippet**. If you use this method, you must manually enter the contents of the snippet; text selected in the Editor Pane is not automatically added to the Snippet dialog box.

<a name="snippets_config" id="snippets_config"></a>
## Configuring Snippets

To configure snippet properties, right-click the snippet on either the [Toolbox](toolbox.html) tab, and select **Properties**. The following configuration properties are available:

- **Snippet Name**: Enter the text that should display in the Toolbox for this code snippet. If the snippet was created by dragging a text selection from the Editor Pane, the snippet is named after the text in the snippet.
- **Snippet Contents**: If the snippet was created by dragging a text selection from the Editor Pane, the contents of the selected text are displayed in the Snippet Contents field. Otherwise, enter the contents of the snippet manually. Add or edit snippet content as desired.

    Snippet contents can also be edited in the standard Komodo editor by right-clicking on a snippet and choosing the `Edit Snippet` menu item.

- **Snippet Shortcuts**: Add [Interpolation Shortcuts](shortcuts.html) or [Tabstops](tabstops.html) to a snippet by clicking the arrow button to the right of the Snippets Contents field, and selecting a shortcut from the drop-down menu. Interpolation shortcuts in snippets are not executed when the snippet is inserted in the Editor Pane via dragging and dropping.
- **Maintain selected text or cursor position after insertion**: Within the snippet contents field, either select a portion of the snippet (by dragging the mouse pointer over the desired selection) or position the editing cursor within the string. If this check box is selected, when the snippet is inserted into the Editor Pane, the selected text or the cursor position is displayed in the same manner.
- **Maintain indentation context after insertion**: If the snippet is inserted into the Editor Pane when the editing cursor is in an indented position, select this check box to use the indentation point as an indentation "prefix". The indentation structure of the snippet is preserved at the position of insertion.
- **Auto-Abbreviation**: Check this if the snippet can be inserted immediately after the name of the snippet is typed, followed by a recognized trigger character (see [Auto-Abbreviations](#snippets_auto_abbreviations) for more details).

<a name="conditional_snippets" id="conditional_snippets"></a>
### Conditional Snippets

Komodo supports the use of EJS (Embedded JavaScript) syntax to add a further dynamic dimension to snippets, beyond those offered by the supplied [Interpolation Shortcuts](shortcuts.html). EJS is similar to other template languages like PHP or RHTML, combining controlling code (e.g. "if" tests), dynamic code (results of JavaScript expressions that get inserted into the snippet), as well as the static part of the snippet.

EJS syntax is very simple: Anything between "<%" and "%>" is control code, to be evaluated to determine which code of a snippet is finally inserted. Anything between "<%=" and "%>" is evaluated and inserted into the snippet. If the EJS pass over a snippet throws an exception, either due to a JavaScript syntax-error or having JS code deliberately throw an exception, snippet insertion stops.

As of Komodo 8.1, snippets will have a `Treat as EJS` checkbox, off by default. Until then if you need to emit verbatim "<%" and/or "%>" strings, for languages like RHTML or Mason, you can use the respective escape sequences "<%%" and "%%>". These escape sequences can also be used in any EJS blocks (usually in strings or comments).

This simple example might suffice. Suppose you want a snippet to insert the current month (by 0-based number) if the current second is odd, and the current date if it's even. Here's what the snippet would look like:

```
Current date part: <% var m = new Date();
if (m.getSeconds() % 2) { /* It's odd */ %>
Month: <%= m.getMonth() %>
<% } else { %>
Date: <%= m.getDate() %>
<% } %>  
```

The first block of JavaScript declares the `m` variable, sets it to the current date, and also tests to see if the current second count is even. The second JS block inserts the date object's month into the text flow. The third JS block starts the 'else' part. The fourth inserts the date object's date. And the final JS block just ends the if-else block. You can even have loops inside snippets, not just if-blocks.

This feature makes snippets more "userscript-like". But note that while you could implement this snippet with a userscript, the main difference between snippets with EJS, and userscripts, is that with snippets there's no need to work with the editor object, views, current positions, and selections: snippets handle all that processing automatically.

Conditional snippets are pickier about white-space than other template languages that generate HTML, mainly because most such generated white-space in HTML doesn't get rendered. But because here the snippets are generating text for your editor, you might find extra whitespace in the expansion. Note as well that it's better to use "/* ... */" comments in the JavaScript code, because the evaluator does modify newlines, meaning that a comment might not end where you think it should. This is no different from how slash-star comments are preferred in handler attribute values in HTML.

<a name="snippet_helper_library" id="snippet_helper_library"></a>
### Snippet Helper Functions

While rewriting some of the language service code as dynamic snippets, we found we were using some code repeatedly. This code was refactored into functions added to the `ko.snippets` namespace. These currently include the following functions:

#### `RejectedSnippet(message, ex=null)`

If a snippet throws an instance of `ko.snippets.RejectedSnippet`, this signals to the code that the EJS code deliberately suppressed inserting this snippet (see [New Snippets](#new_snippets) for an example).

#### `ko.snippets.rightOfFirstRubyKeyword()`

In Ruby, keywords like "if" can start a block when they start an expression, but not when used after an expression. This boolean function makes that check.

#### `ko.snippets.inPythonClass()`

This function returns true if we're currently defining a class in Python code.

This list is expected to expand with time, or even get merged with other high-level APIs. You can easily add more code to this namespace with a startup-trigger userscript (or less easily, by writing an extension).

<a name="linting_snippets" id="linting_snippets"></a>
### Syntax-Checking Snippets

Now that snippets can include code, it's natural to ask if Komodo can do syntax-checking on snippets. The answer, of course, is "yes". When a snippet's contents are edited in a regular window, Komodo assigns the snippet to the "Komodo Snippet" language. This language colors the EJS and JavaScript parts appropriately, treating the rest as plain text. And it looks for missing "%>" tag (EJS allows and ignores "%>" sequences that don't occur after a "<%" tag, and similarly ignores any "<%" sequences that occur after a "<%" tag but before a closing "%>" tag.

Any file ending with ".snippet" will also be treated as an instance of the "Komodo Snippet" language by default.

<a name="new_snippets" id="new_snippets"></a>
### New Snippets

Many of the language folders in the `Abbreviations` folder in the toolbox now have a folder called "keywords". Much of the smart processing on those keywords has been moved from the language-service files written in Python into these snippets. For example, all of the structural Ruby keywords now have associated snippets in `Samples/Abbreviations/Ruby/keywords`, and are set to be auto-abbreviation, meaning they will be automatically triggered after their name is typed in appropriate contexts (so no expansion occurs when, for example, "if" is typed in a string or comment). These keywords are also a good resource, to see how to write dynamic snippets by example.

<a name="snippets_using" id="snippets_using"></a>
## Using Snippets

To insert the contents of a snippet at the current cursor position in the Editor Pane, double-click it, or right-click the snippet and select **Insert Snippet**.

Although you can also drag and drop snippets onto the Editor Pane, the cursor position and indentation check box options explained above in [Configuring Snippets](#snippets_config) will only take effect if the snippet is added using the double-click or **Insert Snippet** method.

<a name="snippets_abbreviations"></a>
### Abbreviations

Snippets saved in a toolbox folder called "Abbreviations" (or a language-specific sub-directory) can be inserted by typing the snippet name in the buffer. See [Abbreviations](abbreviations.html).

<a name="snippets_auto_abbreviations"></a>
### Auto-Abbreviations

If a snippet is marked as an "Auto Abbreviation", then typing its name at the end of a line, followed by a valid trigger character (e.g. a space), will replace the name and trigger with the contents of the snippet.

The trigger characters are defined in `Preferences / Editor / Smart Editing/ Auto-Abbreviations`. Use the standard JavaScript "\" escaping to describe tabs, newlines and carriage returns (both work the same), and any non-printable characters using standard "\x" and "\u" notation. Note that auto-abbreviation can be controlled globally or per-snippet. Also, it's usually convenient to include Space as a trigger character, but this isn't always desired. Pressing Shift-Space after an abbreviation suppresses its expansion.

<a name="abbreviation_case"></a>
### Abbreviations and Case

Auto-abbreviations must match the case of the snippet's name. Komodo currently will ignore case when matching snippets during explicit abbreviation expansion (invoked by default by the Ctrl-T|Cmd-T sequence), but will favor matching a snippet where the case does match over one where the match occurs only when case is ignored.

<a name="snippets_options" id="snippets_options"></a>
## Snippet Options

To access options for the selected snippet, right-click a snippet in the Toolbox and select the desired option.

The following options are available:

- **Insert Snippet**: Use this option to insert the snippet at the current cursor position in the editor, as described above in [Using Snippets](#snippets_using).
- **Cut/Copy/Paste**: Used to duplicate or move a snippet when dragging is not convenient (e.g. to a folder which is currently closed).
- **Show in File Manager**: Shows the JSON file for the snippet in the system's default file manager.
- **Export as Zip File...**: Exports the snippet in a standard ".zip" archive.
- **Rename**: Changes the snippet name.
- **Delete**: Permanently removes the selected snippet from the toolbox.

<a name="snippets_properties" id="snippets_properties"></a>
### Snippet Properties

Snippet properties are used to alter or rename snippets (as described in [Configuring Snippets](#snippets_config), above). The Properties dialog box is also used to assign a custom icon to a snippet or to assign a custom key binding. To access the Properties dialog box, right-click the snippet and select **Properties**.

<a name="snippets_Cust_Icons" id="snippets_Cust_Icons"></a>
#### Assigning Custom Icons to Snippets

The default snippet icons can be replaced with custom icons. Komodo includes more than 600 icons; alternatively, select a custom image stored on a local or network drive (use 16x16-pixel images for best results).

To assign a custom icon to a snippet:

1.  In the Toolbox sidebar, right-click the desired snippet and select **Properties**. Alternatively, click the icon in the Toolbox sidebar, then select **Toolbox_snippet_name_** > **Properties**.
1.  In the Properties dialog box, click **Change Icon**.
1.  In the Pick an Icon dialog box, select a new icon and click **OK**. Alternatively, click **Choose Other**, and browse to the desired image file.
1.  In the Properties dialog box for the snippet, click **OK**. The custom icon is displayed next to the snippet.

To revert to the default icon for a selected snippet:

1.  In the Toolbox sidebar, right-click the desired snippet and select **Properties**.
1.  Click **Reset**, then click **OK**. The default icon is displayed next to the snippet.

<a name="snippets_key_bindings" id="snippets_key_bindings"></a>
#### Snippet Key Bindings

To assign a key binding to a snippet, right-click the snippet on either the [Toolbox](toolbox.html), and select **Properties**. Select the **Key Bindings** tab, and configure the desired binding. See [Key Bindings for Custom Components](prefs.html#Config_Key_Bindings) for more information.

See [Abbreviations](abbreviations.html) for details on inserting snippets by name.
