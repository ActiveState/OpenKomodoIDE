---
title: Preferences
---
Komodo's preferences are used to set the default behavior of Komodo. Preferences can be set for various aspects of Komodo functionality, such as editor behavior, preferred language interpreters, the Komodo workspace layout, etc.

Some preferences can also be configured on a per-file basis. For example, the configuration of line endings, indentation style and word wrap can be configured for individual files. File-specific settings override the default preferences described in this section. To configure file-specific defaults, see [File Properties and Settings](files.html#files_settings) in the File section of the Komodo documentation.

To display the Preferences dialog box:

- Windows and Linux: **Edit** > **Preferences**
- Mac OS X: **Komodo** > **Preferences**

<a name="searching_prefs" id="searching_prefs"></a>
## Filtering the Preferences List

Komodo has a _lot_ of configurable preferences. To quickly find the one you're looking for, filter the Category list by typing in the text box above. This will start limiting the list to matching items as you type.

<a name="UI_Configuration" id="UI_Configuration"></a>
## Appearance Preferences

Use the Appearance preferences to customize the default layout of the Komodo workspace. The functions described below can also be changed using keyboard shortcuts; see [Key Bindings](prefs.html#Config_Key_Bindings) for more information. To customize the Komodo workspace, select **Edit** > **Preferences** > **Appearance**. Configure the following options:

**Interface**

These settings allow you to customize Komodo's user interface in various ways. Note that depending on your system performance it may take a few seconds for these settings to take effect once submitted.

Whilst in theory your user interface should always update properly, in practice it is difficult to ensure that this always happens. So if you notice some visual artifacts upon switching Skin or Icon Set a simple restart of Komodo should fix those for you.

- **Auto detect skin (Linux Only)**: When enabled Komodo will attempt to automatically detect the skin best suited for your current GTK theme.  
     Note that only the following GTK themes are currently supported:
    - Ambiance
- **Skin**: Select the skin that you would like Komodo to use. When you download custom skins they will be listed here.  
     This is disabled when "Auto detect skin" is enabled as it overrides this setting.
- **Icon Set**: Select the icon set that you would like Komodo to use. When you download custom icon sets they will be listed here.  
     If you prefer the older Komodo icons then you can choose to use the "Classic" icon set here.  
     Note that most skins use their own preferred icon set, so switching Skin will force a different selection here. However after changing skin you can still change your icon set selection.  
     Also note that currently only the Cupertino icon sets support Retina.

**Side Pane Layouts**

This will allow you to change the appearance of the Komodo side panes. Each one of the side panes **Left**, **Right** and **Bottom** panes can have their own individual appearance set to one of these values:

- **Single Tab**: In this mode, a single tab will be visible in the pane that represents the currently selected side pane item. You can change the selected item using the drop-down selector in the tab header.
- **Vertical Tabs**: All tabs and their corresponding tab labels will be shown vertically on the outside edge of the pane. You can change the selected tab by clicking on one of the vertical tabs.
- **Horizontal Tabs**: All tabs and their corresponding tab labels will be shown horizontally on the top of the pane. You can change the selected tab by clicking on one of the horizontal tabs.

**Most Recently Used**

- **Number of projects**: The number of [projects](project.html) displayed on on the Recent Projects menu.
- **Number of files**: The number of [files](files.html) displayed on on the Recent Files menu.

**ActiveState Notification Messages**

These notifications appear under your toolbar and will alert you to available updates as well as other notifications from the Komodo team.

## State Tool Preferences

Select **Find on Path** to use the first State Tool executable located in a folder on the system `PATH`. This is the default setting. Alternatively, you can select the exact location of the State Tool executable to use.

<a name="code_intel" id="code_intel"></a>
## Code Intelligence Preferences

**Code Intelligence** refers to the system that provides autocomplete, calltips, and the Code Browser.

- **Enable automatic autocomplete and calltip triggering while you type**: Toggles automatic autocomplete triggering and calltips (enabled by default). Click **OK** to save changes. As an advanced option, you can configure how long it takes before the autocompletion list to pop up. The default value is 250ms. Note that setting this option to a very small value may cause a bit of lag.
- **Enable autocomplete fill-up characters**: Toggles fill-up characters. Typing certain characters, like '(' or '.', during an autocomplete session will trigger insertion of the current completion before the character itself is inserted.
- **Maximum number of lines shown in calltip**: Used to control how much calltip information can be displayed.
- **Automatically insert HTML/XML end tag**: Automatically insert a closing element in HTML and XML documents.

**Code Scanning**

Controls how the Code Intelligence system scans your source code files.

- **Maximum directory depth**: How many directories to recursively scan.
- **Include all files and directories from the project base directory**: Toggles scanning of the current project's directories.

**Sections List**

The [Sections List](sections_list.html) can be sorted by:

- File Order: the order in which code objects occur in the source file.
- Alphabetical Order: an alphabetical listing of the code objects (e.g. classes sorted first, then variables within each class).

**API Catalogs**

Komodo uses API catalogs to provide autocomplete and calltips for 3rd-party libraries. In the **API Catalogs** panel, select the libraries that you use in your code to enable them. Selecting multiple API catalogs for a particular language can yield confusing results if there are overlapping namespaces, classes or function names.

<a name="Database Explorer" id="db_explorer_prefs"></a>
## Database Explorer Preferences

(Komodo IDE only)

**Confirm Row Deletions**: Toggles a confirmation dialog when deleting rows from a table.

<a name="Debugger" id="Debugger"></a>
## Debugger Preferences

(Komodo IDE only)

To customize general [debugging functions](debugger.html#debugger_top), select **Edit** > **Preferences** > **Debugger**. For language-specific settings (such as interpreter selection), see the [Language](#lang_config) preference.

**Debugging Session Startup**

- **When starting a new debug session**: Specify whether Komodo should **Ask me what files to save** (which displays a list of changed files); **Save all modified files** (whereby all modified files are automatically saved); or **Save no files** (whereby the debugging session starts without saving any files).
- **When receiving a remote debugging connection**: Specify whether Komodo should **Ask me to allow connection** (Komodo prompts to allow the connection request); **Allow the connection** (Komodo accepts the connection without prompting); or **Refuse the connection** (Komodo refuses the connection without prompting).
- **Initial break behavior**: Specify whether Komodo should **Break on first executable line** or **Run to first breakpoint**. Breaking on the first line of code is useful for adding breakpoints if none have been set yet (e.g. in a non-local JavaScript file).
- **Skip debugging options dialog**: To block the display of the [debugger dialog](debugger.html#Debugging_Options) box when the debugger is invoked, check this box. Using the 'Ctrl' key in conjunction with a debugger command key toggles the value specified here. However, commands invoked from the **Debugger** drop-down menu always use the convention specified here.

**Debugging Session Shutdown**

- **Confirm when closing debugger session tab**: If the debugger is running when you attempt to close the [Debug](debugger.html#debug_session) tab, this check box determines whether you are prompted to halt the debug session and close the tab, or whether this happens without prompting.
- Restore cursor position at debugger session startup.

**Debugger Editor Options**

- **Show expression values in hover tooltip**: If this is enabled, while you are debugging, you can hover the mouse pointer over a variable or expression in Komodo to see a tooltip with the value of that variable.
- **Try to find files on the local system when remote debugging**: By default, when Komodo performs remote debugging, it retrieves a read-only copy of the file to be debugged from the debug engine. When this check box is selected, however, Komodo first searches for the debugger file on the local system. While it is probably safe to leave this check box selected for all of your remote debugging, there is a slight possibility that Komodo retrieves the wrong file if remote debugging is performed on another machine. If, by chance, there is a file on your local system with the same name and location as the file on the remote system, Komodo uses the local file. This would only happen if the names and locations were identical (e.g., if both machines contained a file called `C:\foo\bar\baz.pl`).

**Code Profiling**

**When receiving a remote profiling request:**

- Prompt for request confirmation
- Allow all profiling requests
- Refuse all profiling requests

<a name="DebuggerConnection" id="DebuggerConnection"></a>
### Debugger Connection Preferences

**Debugger Connection Options**

- **Komodo should listen for debugging connections on**:
    - **a system provided free port**: Komodo assigns a port automatically. This is useful on multi-user systems where multiple instances of Komodo are running.
    - **a specific port**: Set the port manually. The default is 9000.
- **I am running a debugger proxy and Komodo should use it**: Select this to use a [debugger proxy](debugger.html#dbgp_proxy). The proxy must be started separately at the command line.
- **Proxy Listener Address**: The interface IP address and port Komodo uses to listen for connections from the proxy. By default, the debugger proxy uses port 9000 to listen for remote debuggers and port 9001 to listen for connections from Komodo.
- **Proxy Key**: This identifies which instance of Komodo requires the connection. If blank, the USER or USERNAME environment variable is used.

<a name="Debugger_advanced" id="Debugger_advanced"></a>
### Advanced Debugger Preferences

The **Performance Tuning** settings are for fine-tuning data displayed in the **Variables** tabs in the debug output pane. The default values should generally be kept.

- **Children per page**: The number of child nodes displayed for an object in a variable view. Clicking "...Next Page..." at the end of the list will fetch another "page" of nodes.
- **Variable Data retrieved**: The maximum number of bytes stored for a value in a variable view.
- **Recursive depth retrieved**: Recursion depth for nested objects (e.g. arrays of arrays etc.).
- **Maximum length of data in a debugger tooltip**: Limits the size of debugger information relayed to tooltips.

<a name="prefs_editor" id="prefs_editor"></a>
## Editor Preferences

To configure [editing](editor.html#editor_top) preferences, select **Edit** > **Preferences** > **Editor**.

**General Preferences**

- **<a name="show_whitespace" id="show_whitespace">Show whitespace characters</a>**: Display or hide whitespace characters in the editor. Spaces are displayed as dots and tab characters appear as right arrows.
- **Show end-of-line (EOL) characters**: This option sets the default for displaying end of line markers. Display can also be toggled using the **View** > **View EOL Markers** menu option.
- **Show line numbers**: This option sets the default for displaying line numbers. If enabled, line numbers are displayed on the left side of the [Editor pane](workspace.html#Editor_Pane). Line numbers can also be toggled using the **View** > **View Line Numbers** menu option.

Options set through the Preferences dialog box are the default for all files opened in Komodo. Some display characteristics can be assigned to [individual files](files.html#files_settings).

**Cursor Options**

There are three cursor style options:

- Line cursor - adjustable using "Width of line cursor"
- Block cursor
- Invisible

**Drag & Drop**

When dropping a URL in Komodo:

- Ask me what to do
- View source
- Map the URL
- Drop as text

**Confirmation Dialogs**

When files that are opened in the Komodo editor are changed by another application, Komodo can be configured to respond in various ways:

- **Detect when files are changed outside the environment**: When this option is enabled, Komodo pays attention to changes made to files outside the Komodo environment. The following preferences depend on the setting of this checkbox:
    - **Detect when network files are changed outside the environment**: With this option enabled, Komodo pays attention to changes made to mounted network files (via samba, NFS, etc...). This does not apply to Remote Files (SFTP, FTP, etc...)
    - **If files have been changed**: When files are changed outside Komodo, select whether Komodo should **Ask me what files to reload** (prompt for reload confirmation); **Reload all files** (reload without prompting); or **Reload no files** (do nothing).
    - **If files have been deleted**: When files are deleted outside Komodo, select whether Komodo should **Ask me what files to close** (prompt for close confirmation); **Close all files** (close without prompting); or **Close no files** (do nothing).

If **Ask me what files to reload** and **Ask me what files to close** are selected, the prompt is displayed when:

- changing between tabs in the editor
- switching back to Komodo from another application
- saving a file
- deleting a file

**Scrolling**

The <a name="scrolling" id="scrolling">Scrolling</a> setting determines the number of lines that are be displayed above or below the editing cursor. As the editing cursor moves, the number of lines specified here are displayed between the cursor and the top or bottom of the [Editor pane](workspace.html#Editor_Pane). You can also set the horizontal scroll bar width by entering the desired size in pixels.

<a name="Config_Key_Bindings" id="Config_Key_Bindings"></a>
### Configuring Key Bindings

Most Komodo functions can be invoked via key bindings. These key bindings can be customized. To view an HTML list of the key bindings currently in effect, select **Help** > **List Key Bindings**.

On Linux systems, key bindings defined in the window manager (including default key bindings) take precedence over Komodo key bindings. If certain keys or key combinations do not work as expected in Komodo, check the window manager's key binding scheme. In the case of conflicts, change either the Komodo key bindings or the window manager key bindings.

To configure key binding defaults, select **Edit** > **Preferences** > **Editor** > **Key Bindings**. By default, menu key bindings are accessed using 'Alt' key combinations on Windows and Linux. For example, the **File** menu is opened via 'Alt'+'F'. Select **Remove Alt-<letter> shortcuts from menus** to disable menu access via these key bindings. The 'Alt' key still activates the **File** menu.

**Key Binding Schemes**

Key binding "schemes" are sets of pre-configured key bindings.  See [the keybinding](keybind.html) section for more information.

When you attempt to modify a key binding, you are prompted to make a copy of the scheme with a new name before making changes.  Pre-configured schemes cannot be modified.

**Remove Alt-<letter> shortcuts from menus**

Some Emacs key bindings use 'Alt'+'_letter_' combinations that are also used to access Komodo menus. To avoid this conflict, select **Remove Alt-<letter> shortcuts from menus**.

**Vi Emulation**

Vi emulation mimics the modal behavior of the Vi editor. Selecting **Enable Vi emulation** when a scheme other than Vi is selected prompts you to create a new scheme. This scheme is based on the current scheme with the Vi emulation behavior added.

Schemes created with Vi emulation enabled (including the default Vi scheme) will always require Vi emulation. The **Enable Vi emulation** checkbox cannot be toggled.

**Modifying Key Bindings**

To alter or view a specific key binding, scroll the **Commands** list or enter characters in the filter field. If multiple key bindings are assigned to a single command, the **Current Key Sequence** field displays as a drop-down list. Click the **Clear** button to delete the key binding displayed for the selected command; click **Clear All** to delete all key bindings for the selected command.

To add a new key binding for the selected command, enter the desired key binding in the **New Key Sequence** field. If the key sequence is already assigned to another command, the current assignment is displayed in the **Key Sequence Already Used By** field. Click **Change** to update the key binding displayed in the **Current Key Sequence** field; click **Add** to make the new key binding an additional key binding. If the key binding is already assigned, the original assignment is cleared.

**Key Bindings for Tools**

Custom key bindings can be assigned to the following types of tools:

- [URLs](urls.html)
- [Run Commands](run.html)
- [Userscripts](macros.html)
- [Snippets](snippets.html)
- [Templates](templates.html)

When the key binding associated with a tool is invoked, it has the same action as double-clicking the tool in the [Toolbox](toolbox.html) sidebar.

Key bindings assigned to tools in a project toolbox are only available for the [active project](project.html). Key bindings for tools in the global toolbox are always available.

To assign a key binding to a tool, or to alter or delete an existing key binding, right-click the tool and select Properties, then click the **Key Binding** tab. Configure as described above.

**Sharing Keybindings**

Keybindings can be shared between Komodo installations by [copying the keybinding (*.kkf) scheme files](keybind.html#sharing_keybinding_schemes).

<a name="Indentation_Features" id="Indentation_Features"></a>
### Configuring Indentation

From the **Edit** menu, select **Preferences**, then click **Editor** > **Indentation**.

- **Auto-indent style**: Choose from one of three indentation styles:
    - **Use Smart Indent**: Komodo automatically anticipates logical indentation points, based on language cues (such as open braces).
    - **Indent to first non-empty column**: Komodo maintains the current level of indentation.
    - **Don't auto-indent**: Select to prevent all forms of automatic indentation.
- **Auto-adjust closing braces**: Komodo automatically aligns closing braces with corresponding opening braces.
- **<a name="indent_guide" id="indent_guide">Show indentation guides</a>**: Select to display indentation markers (grey vertical lines). An indentation marker is displayed every time the number of spaces on the left margin equals the value specified in the <a name="#spaces_per_indent">Number of spaces per indent</a> field.
- **<a name="file_contents" id="file_contents">Allow file contents to override Tab settings</a>**: If selected when files are open, Komodo uses the indentation settings saved in the file, possibly overriding the other preferences. If de-selected, Komodo uses the preference configuration regardless of the indentation values in the file.
- **<a name="prefer_tabs" id="prefer_tabs">Prefer Tab characters over spaces</a>**: Komodo displays Tab characters wherever possible, according to the values specified in the **Number of spaces per indent** and the **Width of each Tab character** fields. When the 'Tab' key is pressed, Komodo inserts indentation up to the next indent width. If the new indentation is a multiple of the Tab width, Komodo inserts a Tab character. _Example_: With a Tab width of 8 and an indent width of 4, the first indent is 4 spaces, the second indent is a Tab character, and the third indent is a Tab character plus 4 spaces.
- **Enable elastic tabstops**: Komodo can indent and align code based on the principle of <a href="http://nickgravgaard.com/elastic-tabstops/">elastic tabstops</a>. Due to the nature of elastic **tab**stops, the "Prefer Tab characters over spaces" setting should be enabled when editing. However, if you are just viewing a file with this option enabled, that file's elastic tabstops will be utilized.

Tab and indent widths are specified as follows:

- **<a name="spaces_per_indent" id="spaces_per_indent">Number of spaces per indent</a>**: Number of spaces Komodo inserts on the left margin when indenting a line of code.
- **<a name="width_tabs" id="width_tabs">Width of each Tab character</a>**: Number of spaces that are equal to a Tab character.
- **'Backspace' decreases indentation in leading whitespace**: If this option is enabled, pressing 'Backspace' clears an entire indentation, rather than a single space, if there is nothing between the editing cursor and the left margin. For example, if the number of spaces per indent is set to four and there are five spaces between the left margin and the editing cursor, pressing 'Backspace' once clears one space; pressing 'Backspace' a second time clears four spaces.

Options set through the Preferences dialog box are the default for all files opened in Komodo. Some indentation characteristics can be assigned to [individual files](files.html#files_settings).

<a name="smart_editing" id="smart_editing"></a>
### Smart Editing

Options set through the Preferences dialog box are the default for all files opened in Komodo. Some [Smart Editing](#smart_editing) features can be assigned to [individual files](files.html#files_settings).

<a name="Config_Word_Complete" id="Config_Word_Complete"></a>
#### Configuring Word Completion

The Komodo editor maintains an index of words in the current file. Instead of re-entering words that already exist in the current file, you can use the [Complete Word](editor.html#Complete_Word) function to finish words. If you are using the default [key binding](prefs.html#Config_Key_Bindings) scheme, word completion is invoked from the keyboard by pressing 'Ctrl'+'Space' ('F5' or 'Alt'+'Esc' on Mac OS X). If you also want to be able to complete words by pressing the 'Tab' key, select the check box labeled **Use Tab character to complete words like Ctrl+Space**. Note that the 'Tab' key can still be used for other purposes when this check box is selected. Word completion only occurs when the cursor is positioned to the right of characters in a word that has been stored in the editor's index.

<a name="Config_Auto_Wrap" id="Config_Auto_Wrap"></a>
#### Configuring Word or Character Wrap

Select an option from the **Word wrap long lines** drop-down list to have lines automatically "wrapped"; that is, when a line exceeds the width of the [Editor pane](workspace.html#Editor_Pane), it wraps to the next line. This is merely a display characteristic - no end-of-line marker is inserted. You can choose **Word**, **Character**, or leave it as the default value of **None**. The **Character** option wraps the line at the immediate position where the line exceeds the width of the Editor pane; the **Word** option wraps the line from the beginning of the word that extends beyond the width of the Editor pane.

**Note**: For lines that have been wrapped automatically, the behavior of the 'Home' and 'End' keys is slightly different. Pressing 'Home' or 'End' moves the cursor to the beginning or end of the current line. Pressing the same key a second time moves the cursor to the previous or next end-of-line marker.

Select an option from the **Word wrap markers** drop-down list to display markers in the Editor pane. You can choose to view **End of line** markers, **Start of line** markers, **Both** or **None**. The default is **None**.

<a name="Config_Edge_Line" id="Config_Edge_Line"></a>
#### Configuring Edge Lines

The edge line is a vertical line that indicates a column marker.

- **Show edge line / Highlight characters beyond edge line**: Select to show where the line wraps and to highlight characters beyond the wrap column. With fixed-width fonts, a line is drawn at the column specified. With proportional-width fonts, those characters beyond the specified column are drawn on a colored background. The line or background color is configured on the [Fonts and Colors](#Customizing_Fonts) preference page.
- **Edge line column**: Specify the column position of the vertical marker.

<a name="Soft_Chars" id="Soft_Chars"></a>
#### Soft Characters

**Enable soft characters** turns on language-specific autocompletion for brackets, braces and other delimiters. The highlighted closing character is inserted after the cursor and can be "typed over". See [Soft Characters](editor.html#Soft_Char) in the Editor section for more information.

<a name="Selection_Wrapping" id="Selection_Wrapping"></a>
#### Selection Wrapping

By default, **Wrap selection with typed delimiter instead of overwriting it** allows for wrapping selected words within a delimiter by typing that delimiter. (Normally the selected text would be replaced by that delimiter.) Disabling the advanced option **Only wrap plain text selections** allows the wrapping of more complex selections like compound conditionals in a programming language. The wrapping delimiters are also configurable.

<a name="line_cut_copy" id="line_cut_copy"></a>
#### Line Cut/Copy

**Cut/Copy with no selection...** changes the behavior of Cut and Copy operations when there is no selection in the current buffer. By default, the current line is cut or copied if there is no selection.

<a name="hyperlinks" id="hyperlinks"></a>
#### Hyperlinks

Enable or disable 'Ctrl'+'mouse-hover' hyperlinks ('Cmd'+'mouse-hover' on Mac OS X) in the buffer.

<a name="Folding" id="Folding"></a>
#### Configuring Folding

Komodo can fold (i.e. hide and un-hide) logical segments of code in many languages and data file types. The following options define how code folding looks and works:

- **<a name="fold_style" id="fold_style">Fold mark style</a>**: Use the drop-down list to select the style of node used in [code folding](editor.html#Folding):
    - Don't show fold marks (disables code folding)
    - Square Trees (default)
    - Curvy Trees
    - +/- signs
    - Arrows
- **<a name="horiz_line" id="horiz_line">Use horizontal line on folds</a>**: Displays collapsed code with fold marks; a thin line also spans the width of the [Editor pane](workspace.html#Editor_Pane).
- **<a name="fold_separate_block_parts" id="fold_separate_block_parts">Fold separate block parts</a>**: Allows editor-margin fold-blocks to be split at lines where one block ends, and a second block starts. This is most useful for brace-based languages like JavaScript, PHP, and Perl, and would be used to break a single large fold block at each inner "else" statement.
- **<a name="restore_fold_state" id="restore_fold_state">Restore fold state on document load</a>**: If this option is enabled, the current state of [code folding](editor.html#Folding) is remembered when a file is closed and reinstated when the file is next opened. Enabling this option may increase the loading time for larger files with numerous folds.

<a name="Variable_Highlighting_Prefs" id="Variable_Highlighting_Prefs"></a>
#### Variable Highlighting

- **Automatically highlight variables when clicking**: When you click on a variable, this variable and all other instances of that variable will be highlighted using a special indicator/marker.
- **Automatically highlight variables when typing**: Similar to clicking above, but occurs after typing variables in the editor. You can further customize this using the **prefix match** option, which will highlight all other variables that start with the current text you've typed. You can also add a **delay in milliseconds** for when to trigger this highlighting (i.e. how long after you've finished typing).

<a name="Save_Options" id="Save_Options"></a>
### Save Options

To automatically fix whitespace errors when saving files:

- **Clean trailing whitespace and EOL markers**: Eliminates unnecessary empty space between text and EOL markers, and fixes inappropriate EOL markers.
- **Ensure file ends with EOL marker**: Adds an EOL marker to the last line in a file if one does not already exist.

When files without extensions are saved, Komodo can be configured to prompt for an action. Configure the **If filename has no extension** drop-down list:

- **Ask me what to do**: Komodo prompts you with a dialog box to decide what to do when a particular file is saved without an extension.
- **Add appropriate extension**: Komodo automatically adds an extension based on file content.
- **Leave filename alone**: Komodo does nothing when a file is saved without an extension.

Based on the specified **Minutes between auto-recovery**, Komodo makes temporary backup copies of all un-saved files in the editor. When the editor file is saved, then the backup copies are deleted. If Komodo is shut down abnormally (such as through a system crash), Komodo prompts to restore the backup copy when the file is next opened. If you respond "Yes" then Komodo's backup copy of the file is opened in the editor. These temporary backup files are saved into the "autosave" folder in the Komodo profile directory.

<a name="Environment" id="Environment"></a>
## Environment

### Variables

At startup, Komodo loads all environment variables it can access. If it is
launched from a desktop icon rather than a shell, environment variables set in
the default shell will _not_ be loaded automatically.

To ensure that Komodo runs with the correct environment variables, (e.g. SCC settings, library locations, SSH options, etc.) set them in the **User Environment Variables (override defaults)** list box. Three buttons are available for manipulating this list:

- **New**: opens a dialog box prompting for a **Name** and **Value**.
- **Edit**: opens a dialog box with the currently selected user environment variable. **Name** and **Value** can be edited.
- **Delete**: Deletes the currently selected user environment variable.

Additionally, double-clicking a variable in **Startup Environment Variables** copies it into **User Environment Variables (override defaults)** where it can be edited. This new variable will override the one in **Startup Environment Variables**

### Tools

You can point Komodo at the following tools executable files to enable Commando
integration through the [Shell Scope](commando.html#commando-go-to-anything_shell-scope).

<a name="File_Associations" id="File_Associations"></a>
## File Associations

Komodo's file associations determine the functionality of editing features such as [autocomplete](editor.html#AutoComplete) and [code coloring](#Customizing_Fonts). Use the **File Associations** preference to associate file extensions and characteristics with particular languages.

**Editing the Language Associated with a File Pattern**<a name="edit_lang" id="edit_lang"></a>

To edit the language associated with a file pattern:

1.  Select the desired extension from the **Patterns** list.
1.  From the **Language** drop-down list, select the language to associate with the selected file pattern.

To remove an association, select the desired pattern and click **Remove**.

**Adding a New File Association**<a name="add" id="add"></a>

To add a new file pattern/language association:

1.  Enter the desired pattern in the **Pattern** field. The pattern consists of the wildcards and the naming convention. Typically, file associations are made by the filename extension; for example, a Perl script has the extension ".pl". The pattern for a Perl script is therefore "*.pl".
1.  Select the language to associate with the pattern from the **Language** drop-down list.

**Use File Content to Determine Language**<a name="file_content" id="file_content"></a>

Komodo can be configured to identify the language of a file based on its contents rather than its extension. The following characteristics can be used to override the file associations settings for syntax checking and debugging configuration.

- **<a name="xml_declarations" id="xml_declarations">XML Declarations</a>**: The **Use XML Declarations** option checks for XML declarations that specify the language of a file (e.g. <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd"> for XHTML 1.0).
- **Shebang (#!...) Line**: The **Use shebang line** option checks for a "#!/..." line at the top of a file that specifies the interpreter (e.g. `#!/usr/bin/perl`).
- **<a name="emacs_style" id="emacs_style">Emacs-Style Mode Variable</a>**: When this check box is selected, as Komodo opens files, it checks for an embedded Emacs "mode" specification used to set the syntax checking and debugging configuration.

<a name="Find" id="Find"></a>
## Find

**Highlighting**

- **Enable highlighting of find and replace results**: Toggles the highlighting of matching strings in the current buffer. To guard against performance problems caused by slow searches, Komodo will stop highlighting matches after the timeout configured here.

**Incremental Search**

These options set the defaults for the [Incremental Search](search.html#search_incr) feature.

- **Match Case**: Choose the default case sensitivity for searches.
- **Uses**: Specify the search syntax type. **Plain Text** exactly matches the search string; **Regular Expressions** interprets the search text as a regular expression; **Wildcard** interprets asterisk and question mark characters as wildcards.

<a name="Customizing_Fonts" id="Customizing_Fonts"></a>
## Color Scheme

Customizes the display of text in the [Editor pane](workspace.html#Editor_Pane). To modify the font and color preferences Head over to **Preferences**, then click **Color Scheme**.

To install a Color Scheme, drag and drop the .ksf file (or http link) and drop it onto Komodo. Komodo will then prompt you to test and install the color scheme.

To create a new scheme:

1.  Open up the color scheme editor (Tools > Color Scheme Editor)
1.  Select the scheme that you want to base your new scheme upon.
1.  Click the **New** button and enter a name for the new scheme.
1.  Make any necessary changes using the fields provided.
1.  Click **Apply** to save and apply the new scheme.

Schemes are added to the **Scheme** drop-down list. Remove the selected scheme by clicking the **Delete** button. System schemes cannot be deleted.

<a name="code_formatters" id="code_formatters"></a>
## Code Formatters

(Komodo IDE only)

Komodo offers integrations with external code formatters. Selected text, or an entire document can be passed to the formatter, processed, returned via stdin and reinserted in the buffer.

You can configure one or more formatters for any language. Each language will have one formatter marked as **Default**, which is the one used by the **Format Code or Text** ('cmd_format') function. By default, this command does not have a key binding. You can assign one in the [Key Bindings](#Config_Key_Bindings) preferences.

<a name="http_inspector" id="http_inspector"></a>
## HTTP Inspector Preferences

(Komodo IDE only)

The HTTP Inspector runs a local proxy for examining HTTP traffic between browser and server. This proxy has the following configuration options:

**HTTP Inspector Options**:

- **Run HTTP Inspector at startup**: If selected, this starts the proxy when Komodo is launched. If not, the proxy can be started from the HTTP Inspector interface.
- **Listen on port**: Specify the port the proxy runs on. Most proxies use port 8080.
- **Only accept connections from the local machine**: Enabled by default.

**Proxy forwarding**:

- **Enable proxy forwarding**: Enable this option if you use an HTTP proxy to connect to the internet (i.e. at your network gateway).
- **Forward proxy connections on to this host**: If you have enabled proxy forwarding, enter the proxy information in the format `<hostname>:<port>`. If no port is specified, Komodo will attempt to use port 8080.

<a name="int_shell" id="int_shell"></a>
## Interactive Shell Preferences

(Komodo IDE only)

The [Interactive Shell](intshell.html) is an implementation of the language interpreter's shell within the Komodo environment. These preferences set the default behavior for interactive shell functionality.

- **Preferred Language**: Specify which language interpreter's shell is launched when the interactive shell is invoked.
- **Session Control**:
    - **Close tab when interactive shell session ends**: If this option is selected, the **Shell** tab closes when the **Stop** button is clicked. Otherwise, the tab remains visible (although you must invoke another interactive shell session to use the shell).
    - **Confirm when closing interactive shell**: When you attempt to close the **Shell** tab before stopping the session (by clicking the **Stop** button), this option determines whether you are prompted for confirmation. The confirmation dialog box has an option to disable the warning; to re-enable the warning, set this field to **Ask me each time**.
- **Working Directory**: This option sets the "current" directory for the interactive shell session. Specify the desired directory.

<a name="Internationalization" id="Internationalization"></a>
## Internationalization Preferences

Language encodings provide support for files containing characters in non-ASCII character sets.

Encodings are determined in the following order:

1.  **File Preference**: If a specific encoding has been assigned to a file via the file's [Properties and Settings](files.html#files_settings) context menu, the assigned encoding is always used when that file is opened.
1.  **Auto-Detect**: If the **Auto-Detect File Encoding when Opened** box is checked, Komodo analyzes the existing encoding of the file by first looking for a Byte Order Mark (BOM), then by checking for an XML declaration, and then by performing heuristic analysis on the file's contents. If an encoding can be determined, it is applied.
1.  **Language-specific Default Encoding**: Specific encodings can be assigned to programming languages. (Komodo determines the programming language of a file based on the [File Association](#File_Associations) preferences.) If an encoding is associated with a programming language, that encoding is used. Check **Signature (BOM)** to embed a Byte Order Marker (BOM) at the beginning of the file. If the specified encoding is set to the default encoding, the **System Encoding or Custom Encoding** is used.
1.  **System Encoding or Custom Encoding**: If the **Use Encoding Defined in Environment** box is checked, Komodo uses the encoding specified in the operating system. The following system variables are checked:
    - **Windows**: The Control Panel's "Regional and Language Options".
    - **Mac OS X**: The "International" settings accessed via the OS X System Preferences.
    - **Linux**: `LC_CTYPE`, `LANG` and `LANGUAGE`.To use a different encoding, uncheck this box and select the desired encoding from the **Custom Encoding** drop-down list.

When you create a [new file](#new_files), only the third and fourth methods described above are used to set the file's encoding.

The following settings override all other encoding settings except the **File Preference** setting.

- **Allow XML Declaration to Override Auto-Detection**: Komodo always uses the XML encoding declaration contained in the XML file when opening XML files (if applicable).
- **Allow HTML META tag to Override Auto-Detection**: Komodo uses the `charset` setting defined in META tags in HTML documents.
- **Allow 'coding:' tag to Override Auto-Detection**: If the file contains a "`coding: <encoding_name>`" directive within the first two lines, that encoding is used.

The **Date & Time** format determines the display format of the date and time for items listed on the Start Page, and for the [Current File settings](files.html#files_settings) display.

<a name="language_help" id="language_help"></a>
## Language Help Settings

Use the **Language Help** page in Komodo Preferences (**Edit** > **Preferences** > **Language Help**) to configure context-sensitive language look-up.

### Configuring Reference Locations

The **Language Lookup Commands** section of the Language Help page displays the default URL for language-specific help. (The `%(browser)` string is an [interpolation shortcut](shortcuts.html).) If you are using the default [key binding](prefs.html#Config_Key_Bindings) scheme, 'Shift'+'F1' ('Cmd'+'/' on Mac OS X) opens a browser window and looks up the address of the sites specified here. The site is selected according to the type of file currently active in the Editor pane. (To configure file association, see [File Associations](#File_Associations).)

The **General Help** field is used to specify a help location that does not specifically apply to a language (or applies to a language not available in the above list).

To reset any of the help settings to their original value, click **Reset** beside the pertinent field.

### Using Language Help

In the [Editor pane](workspace.html#Editor_Pane), double-click to select the keyword that you want to look up. Then, if you are using the default [key binding](prefs.html#Config_Key_Bindings) scheme, press 'Shift'+'F1' ('Cmd'+'/' on Mac OS X) to invoke a browser window and look up the keyword on the site configured in the Preferences. Press 'Ctrl'+'F1' ('Cmd'+'Ctrl'+'/' on Mac OS X) to perform the lookup using the site configured in the **General Help** field on the Language Help page.

<a name="lang_config" id="lang_config"></a>
## Language Configuration

To configure the languages supported by Komodo, select **Edit** > **Preferences** > **Languages**, then select the desired language.

<a name="JavaScript" id="JavaScript"></a>
### Configuring JavaScript

**Remote Debugging**: Specify the location of the Chrome.exe that Komodo will
use to launch your HTML/Javascript application to debug in the browser.  For
more information on Javascript remote debugging configuration see [Chrome Debugging](debugchrome.html#debugchrome_top).

**Bower Location**:  If you're using the Bower package manager you can explicitly
tell Komodo which Bower executable to use here.  You can then run Bower commands
in Commando through the [Shell Scope](commando.html#commando-go-to-anything_shell-scope).

**Syntax Checking**: Use the checkboxes to enable or disable basic and strict warnings from the JavaScript interpreter.

**JavaScript Directories**: Specify any directories that you want Komodo to use for autocompletion and calltips. Komodo scans these directories recursively (up to 5 directories deep) for information.

Code intelligence for several common JavaScript libraries can be enabled in the **API Catalogs** section of the [Code Intelligence](#code_intel) preferences.

<a name="Node" id="Node"></a>
### Configuring Node.js

- **Default Node.js Interpreter**: Select **Find on Path** to use the first Node
    interpreter in the system `PATH`. To select a specific interpreter, select
    it from the drop list or click **Browse** and navigate the filesystem.

    **NPM Location**: Select **Find on Path** to use the first NPM
    executable in the system `PATH`. To select a specific interpreter, select
    it from the drop list or click **Browse** and navigate the filesystem.

    **Gulp Location**: Select **Find on Path** to use the first Gulp
    executable in the system `PATH`. To select a specific interpreter, select
    it from the drop list or click **Browse** and navigate the filesystem.

    **Grunt Location**: Select **Find on Path** to use the first Grunt
    executable in the system `PATH`. To select a specific interpreter, select
    it from the drop list or click **Browse** and navigate the filesystem.

    **Node.js Directories**: Specify any directories that you want Komodo to use
    for autocompletion and calltips (e.g. _node_modules_ for a given
    application). Komodo scans these directories recursively (up to 5
    directories deep) for code intelligence information.

    **Node.js Namespace Mapping**:
    Specify mappings for code intelligence to use to scan for modules used in
    `require` statements.  These mappings help code intelligence in projects that
    have non-standard module locations.

<a name="Perl" id="Perl"></a>
### Configuring Perl

- **Use this interpreter**: Select **Find on Path** to use the first Perl interpreter that occurs in the system's `PATH` variable. The paths to interpreters found in the `PATH` variable are available from the drop-down list; select a specific interpreter as desired. Alternatively, click **Browse** and navigate the filesystem to select the desired interpreter.
- **Background Syntax Checking**: Perl syntax checking is configurable; the degree of [syntax checking](editor.html#Linting) is determined by switches sent to the interpreter. Specify the desired level of syntax checking by selecting the corresponding interpreter switch combination from the drop-down list. If a setting that uses "taint" mode is selected, the `PERL5LIB` environment variable is ignored; syntax checking is not performed on modules located in directories specified via `PERL5LIB`.
- **Perl Critic options**: Sets the strictness level for [Perl::Critc](http://search.cpan.org/perldoc?Perl%3A%3ACritic) checking. The 'Perl::Critic' and 'criticism' modules must be installed in order to enable this.
- **Debugger Logging**: If this option is enabled, the Komodo [debugger](debugger.html#debugger_top) logs the debugging session to a file in the directory specified in the **Debugger Log Path** field (or the directory specified in the system's `TEMP` variable, if no directory is specified). This is primarily for debugging the debugger, as opposed to gaining additional insight on the debug session itself. The debugger log file is named _perl-dbgp.log_. The contents of the log file are overwritten each time the debugger is invoked.
- **Additional Perl Import Directories**: Directories specified in this field are inserted at the beginning of Perl's `@INC` array (in the same manner as Perl's "I" command-line argument). Modules in the specified directories are used for [debugging](debugperl.html), [syntax checking](editor.html#Linting) and during [interactive shell](intshell.html#intshell_top) sessions.

**PDK Installation Locations**<a name="pdk_install" id="pdk_install"></a>

**NOTE**: The Perl Development Kit (PDK) is a discontinued product that is not available for versions or ActivePerl newer than 5.22.

To access the Perl Dev Kit preference page, select **Edit** > **Preferences** > **Languages** > **Perl** > **PDK**.

- **Use this installation**: Use the drop-down list or the **Browse** button to specify the path to the PDK executable file.

<a name="PHP" id="PHP"></a>
### Configuring PHP

Komodo will try to automatically configure itself for local PHP debugging. If this fails then you'll need to manually configure PHP debugging, refer to [Debugging PHP](debugphp.html#debugphp_top) for instructions.

- **Use this interpreter**: Select **Find on Path** to use the first PHP interpreter that occurs in the system's `PATH` variable. The paths to interpreters found in the `PATH` variable are available from the drop-down list; select a specific interpreter as desired. Alternatively, click **Browse** and navigate the filesystem to select the desired interpreter.
- **Path to alternate PHP configuration file**: The `php.ini` file to be used by Komodo PHP functions, enter the path in this field, or use the **Browse** button.
- **PHP Directories**: Specify any directories that you want Komodo to use for autocompletion and calltips. Komodo scans these directories recursively (up to 5 directories deep) for information.
- **Comment Style**: PHP can use "//" or "#" for comments. Choose one of these styles for use by the [Comment Region and Un-comment Region](editor.html#Commenting) features.

**Note**: Be sure your `php.ini` configuration file is located in your operating system directory. If you used the PHP Windows installer, this file should be in the correct location - e.g. `\windows\php.ini`.

**Sharing PHP Preferences and Files**<a name="sharing_php" id="sharing_php"></a>

Use Komodo's shared support functionality to share PHP preferences, run commands, code snippets, templates, .tip files, or other items that have special usefulness within your PHP programming group. See [Configuring Shared Support](#Shared_Support) for more information.

<a name="Python" id="Python"></a>
### Configuring Python

Python 2.x and 3.x are different enough that they need to be evaluated with different interpreters. The **Python** preference group should be set up with Python 2.x interpreters and libraries, and the **Python3** group should be set up with Python 3.x interpreters and libraries.

Komodo performs basic syntax analysis to determine which version of Python to use when a Python file is opened in the editor. This version information can be seen (and changed) in the **File Type** section at the right side of the status bar.

- **Use this interpreter**: Select **Find on Path** to use the first Python interpreter that occurs in the system's `PATH` variable. The paths to interpreters found in the `PATH` variable are available from the drop-down list; select a specific interpreter as desired. Alternatively, click **Browse** and navigate the filesystem to select the desired interpreter.
- **Additional Python Import Directories**: Directories specified in this field are inserted at the beginning of Python's `PYTHONPATH` environment variable. Modules in the specified directories are used for [debugging](debugperl.html), [syntax checking](editor.html#Linting) and during [interactive shell](intshell.html) sessions.

<a name="Ruby" id="Ruby"></a>
### Configuring Ruby

- **Use this interpreter**: Select **Find on Path** to use the first Ruby interpreter that occurs in the system's `PATH` variable. The paths to interpreters found in the `PATH` variable are available from the drop-down list; select a specific interpreter as desired. Alternatively, click **Browse** and navigate the filesystem to select the desired interpreter.
- **Background Syntax Checking**: Ruby syntax checking is configurable; the degree of [syntax checking](editor.html#Linting) is determined by switches sent to the interpreter. Specify the desired level of syntax checking by selecting the corresponding interpreter switch combination from the drop-down list.
- **Debugger Logging**: If this option is enabled, the Komodo [debugger](debugger.html) logs the debugging session to a file in the directory specified in the **Debugger Log Path** field (or the directory specified in the system's `TEMP` variable, if no directory is specified). This is primarily for debugging the debugger, as opposed to gaining additional insight on the debug session itself. The debugger log file is named _ruby-dbgp.log_. The contents of the log file are overwritten each time the debugger is invoked.
- **Additional Ruby Import Directories**: Directories specified in this field are inserted at the beginning of Ruby's `PATH_LOAD` environment variable. Modules in the specified directories are used for [debugging](debugruby.html) and [syntax checking](editor.html#Linting).

<a name="Tcl" id="Tcl"></a>
### Configuring Tcl

Komodo can use the standard `tclsh` interpreter, the Tk-enabled `wish` interpreter, or any other Tcl core compatible extended shell.

- **Use this Wish interpreter**: Select **Find on Path** to use the first Wish interpreter that occurs in the system's `PATH` variable. The paths to interpreters found in the `PATH` variable are available from the drop-down list; select a specific interpreter as desired. Alternatively, click **Browse** and navigate the filesystem to select the desired interpreter.
- **Use this Tclsh Interpreter**: As described above, specify the desired Tclsh interpreter.
- **Enable Debugger Log**: If this option is enabled, the debugger logs sessions to a file called _tcl-dbgp.log_ in the directory specified in **Debugger Log Path** (or the system's `TEMP` directory if no path is specified). The contents of the log file are overwritten each time the debugger is invoked. This file is primarily useful in troubleshooting debugger sessions.
- **Additional Tcl Include Directories**: Directories specified in this field are inserted at the beginning of Tcl's `TCLLIBPATH` environment variable. Modules in the specified directories are used for [debugging](debugperl.html), [syntax checking](editor.html#Linting) and during [interactive shell](intshell.html) sessions.

**Note**: Tcl Beta releases contain only version-specific executables (e.g. `tclsh85.exe` and `wish85.exe`). Komodo does not automatically find these in the path. To use them, specify them manually in the Interpreters section rather than selecting **Find on Path**.

<a name="Tcl_syntax" id="Tcl_syntax"></a>
#### Tcl Syntax Checking

Syntax checking support in Komodo Edit requires the [TCL Syntax Checker extension](http://community.activestate.com/xpi/tcl-syntax-checker).

To specify Tcl syntax checking:

- **Warning messages to suppress**: The warning messages listed in this dialog box can be disabled. This prevents Komodo's syntax checking functionality from reporting these warnings.
- **Error messages to suppress**: The error messages listed in this dialog box can be disabled. This prevents Komodo's syntax checking functionality from reporting these errors.
- **Additional options**: Configure the level of error and warning checking by using the switches `-W1` (display parsing and syntax errors), `-W2` (display parsing and syntax errors, and usage warnings), `-W3` (display parsing and syntax errors, portability warnings, upgrade warnings, performance warnings, and usage warnings), and `-Wall` (displays all messages and errors (the default)). Additionally, specific warning and error messages can be suppressed using the `-suppress _error_` switch.
- **Force checking for specific Tcl/Tk Version**: To use a version of Tcl other than the default (8.4) for warning and error checking, select the desired version from the drop-down list.

<a name="Tcl_debugging" id="Tcl_debugging"></a>
#### Tcl Debugging

Komodo's Tcl debugger has additional preferences for instrumenting files and logging debug sessions.

- **Tcl Instrumented Files**: By default, all files are instrumented. However, once modules are added to this list box, you can choose to not instrument specific modules by clearing the appropriate check boxes next to the module names. To instrument modules in the list box, select the check box beside the module name. To add a module to the list (e.g. "incrtcl, "TclX"), click the "Add Entry" button, specify the **Module Name**, and click **OK**. To remove a module, select one or more module names in the list box and click "Delete Entries".
- **Debugger Logging**: If this option is enabled, the Komodo [debugger](debugger.html) logs the debugging session to a file in the directory specified in the **Debugger Log Path** field (or the directory specified in the system's `TEMP` variable, if no directory is specified). This is primarily for debugging the debugger, as opposed to gaining additional insight on the debug session itself. The debugger log file is named _tcl.log_. The contents of the log file are overwritten each time the debugger is invoked.

**Sharing Tcl Preferences and Files**<a name="sharing_tcl" id="sharing_tcl"></a>

Use Komodo's shared support functionality to share Tcl preferences, run commands, code snippets, templates, .tip files, or other items that have special usefulness within your Tcl programming group. See [Configuring Shared Support](#Shared_Support) for more information.

<a name="html" id="html"></a>
### Configuring HTML

Komodo works in conjunction with [HTML Tidy](http://tidy.sourceforge.net/) to provide configurable syntax checking for HTML files. The following options can be configured:

- **Error Level**: **Errors Only** displays all HTML errors with a red underline; **Errors and Warnings** displays both errors and warnings with a red underline.
- **WAI Accessibility Conformance level**: The [Web Accessibility Initiative](http://www.w3.org/TR/1999/WAI-WEBCONTENT-19990505/) (WAI) provides HTML developers with [guidelines](http://www.w3.org/TR/1999/WAI-WEBCONTENT-19990505/#themes) for making web content accessible to those with disabilities. These guidelines include methods for making content understandable and navigable (for example, adding "alt" text to an "img" tag for those who cannot view images). WAI accessibility levels are:
    - **Off**: WAI accessibility is off. No WAI-related syntax errors are reported.
    - **Priority 3**: The lowest WAI conformance level. One or more groups will have difficulty accessing the information in this document.
    - **Priority 2**: Satisfying this level removes significant barriers to accessing content in this document.
    - **Priority 1**: The highest WAI conformance level. A web content developer must satisfy this level for the greatest content accessibility.
- **Configuration File**: Tidy functionality can be customized via a custom configuration file. See [teaching Tidy about new tags](http://www.w3.org/People/Raggett/tidy/) on the W3C site for information on building a custom configuration file. To specify a custom Tidy configuration file, click **Browse** beside the **Configuration File** text box to locate the configuration file on your filesystem.

<a name="actionscript" id="actionscript"></a>
### Configuring ActionScript

Komodo supports ActionScript syntax checking using [MATC](http://www.mtasc.org/) (Motion-Twin ActionScript 2 Compiler). With the compiler installed, specify it's path in the **user this interpreter** field.

<a name="mapped_uris" id="mapped_uris"></a>
## Mapped URIs

Mapped URIs are associations that allow Komodo to open files specified at one location using a different path.

For example, opening a file with the URL:

```
http://www.example.org/index
```

... might open the file from:

```
/var/www/index
```

... which would be an editable copy of the file.

These URI mappings are particularly useful for:

- remote debugging
- dragging URLs into the Editor pane
- previewing HTML files

To map a URI (the address of an internet or network resource, such as a web URL) to a local directory:

1.  Click the **Add...** button.
1.  Enter the URI in the **URI** field.
1.  Enter the path in the **Path** field or click the **Local...** or **Remote...** buttons to browse to and select the desired directory.

The **Path** can refer to remote paths that are accessed via FTP, SFTP, or SCP (e.g. scp://user@host.example.org:/home/user/) in addition to paths on the local filesystem. If the remote server is configured under [Servers Preferences](#Servers), Komodo will open the file without prompting for authentication.

Double-click an existing mapping in the list to edit the URI or Local Path. URI mappings are substring matches. For example, _/home/user/public_html/project_ would match any directories starting with that string (i.e. subdirectories _project_1_, _project_2_, etc.).

<a name="new_files" id="new_files"></a>
## New Files Preferences

When the **New** button is used to create a new file, Komodo, by default, opens a text file in the [Editor pane](workspace.html#Editor_Pane). To alter the default, select the desired file type from the drop-down list. To specify the end-of-line marker for new files, select the desired marker from the drop-down list.

The Komodo templates used to create new files **(File** > **New** > **New File)** support the same [Interpolation Shortcut](shortcuts.html) codes as snippets and run commands. Prior to Komodo Version 2.5, only a limited set of variables could be used (for example, to embed the current date and time in files created from custom templates). The new Interpolation Shortcuts are more powerful but are backward-incompatible.

Enter a number in the **Number of recent templates to remember** field to specify how many recent template names appear on the **File** > **New** drop-down menu.

The encoding for new files is determined by the configuration of the [Internationalization](#Internationalization) preference.

<a name="printing" id="printing"></a>
## Printing Preferences

- **Print Line Numbers**: Check this box to print the line numbers.
- **Print in Color**: To print in the colors displayed in the [Editor pane](workspace.html#Editor_Pane), check this box.
- **Wrap long lines at _n_ characters**: Set the column at which lines will wrap. Specify "0" characters for no line wrapping.
- **Scale font sizes from screen to print by _n_**: Specify the number of times larger or smaller the printed font size will be in relation to its size on screen. The default is "1.5". Specify "1" to print the current font size.

<a name="projects" id="projects"></a>
## Projects and Workspace Preferences

**Workspace**

Use the **When starting Komodo** field to specify the display when Komodo is opened.

- **Ask me whether to restore workspace**: Komodo prompts to open recent [files](files.html) and [projects](project.html).
- **Restore last workspace**: Komodo displays the workspace exactly as it was when you last quit Komodo (including expanded tabs and open files).
- **Do not restore last workspace**: Komodo displays the default workspace.

**Opening and Closing Projects**

These options specify the relationship between projects and files that are open in the [Editor pane](workspace.html#Editor_Pane).

When opening a project, set Komodo to:

- **Ask me what to do**: Komodo prompts whether the files that were open when the project was last closed should be re-opened.
- **Open recent files**: Komodo automatically opens the files that were open when the project was last closed.
- **Open no files**: Komodo opens the project without opening any files.

When closing a project, set Komodo to:

- **Ask me what to do**: Komodo prompts whether open files associated with the project should be closed.
- **Close all open files in project**: Komodo automatically closes open files associated with the project.
- **Close no files**: Komodo closes no files.

**File Status Updates in Places sidebar**<a name="file_info" id="file_info"></a>

The **Update file status automatically** option enables a periodic check of the read/write status and the [source code control](scc.html) status of files in the [Places](places.html) sidebar.

Status refresh can also be performed manually with the **Refresh** context menu item for any tool, file or folder.

**Triggering Userscripts**

[Userscripts](macros.html#macros_top) can be configured to execute when specific Komodo events occur (such as before a file is saved or after a file is closed). To disable this feature, uncheck **Enable triggering of userscripts on Komodo events**.

<a name="Servers" id="Servers"></a>
## Servers Preferences

Use the **Servers** page to configure server account settings for remote file access. To access the Servers page, select **Edit** > **Preferences** > **Servers**. You can also manually specify a connection (server name, username and password) when opening or saving remote files.

See [Opening Remote Files](files.html#Opening_Remote_Files) for information about working with remote files.

If no servers have been previously configured, enter access information as described below and click the **Add** button. If there are prior server configurations, click the **New Server** button to clear the fields. To alter an existing configuration, select the configuration from the drop-down list, make the desired changes, then click the **Update** button. To delete a configuration, select the desired configuration and click the **Delete** button.

- **Remote Accounts**: Previous server configurations can be accessed via this field.
- **Server Type**: Select the type of connection to the server (FTP, SFTP or SCP).
- **Name**: Enter a name for the account. The value in this field is displayed in the "Remote Accounts" drop-down list box and is used as the Server name in the [Remote File](files.html#Opening_Remote_Files) dialog box.
- **Hostname**: Enter the name of the remote server. The name may be fully qualified (e.g. "server.example.org", or just the hostname of a machine within a local domain.
- **Port**: Enter the port to use to connect to the server. SFTP and SCP generally use port 22\. FTP generally uses port 21.
- **User Name**: If you require an account to use the remote server, enter the user name in this field. If the server accepts anonymous access, enter "anonymous" or click the **Anonymous Login** check box.
- **Password**: If you require an account to use the remote server, enter the account password in this field. If access to the server is anonymous, the password is usually an email address (such as "user@host.com").
- **Default Path**: To specify the directory that displays when you connect to the server, enter the path in this field.
- **Anonymous Login**: If the server allows anonymous login, check this box.

**Note**: Passwords are stored (encrypted) using Mozilla's password manager.

<a name="Shared_Support" id="Shared_Support"></a>
## Shared Support Preferences

Komodo's shared support functionality is used to configure components on one machine and distribute them for use on other machines. Shared support is implemented via a "Common Data Directory", which stores the shared components. The following components can be shared:

- [templates](templates.html)
- [Shared Toolbox](toolbox.html)
- Tcl .tip files ([syntax definition](editor.html#Linting) files)
- .pcx files (checker extension files that define exact syntax information)
- .pdx files (debugger extension files)
- preferences

To configure shared support, select **Edit** > **Preferences** > **Shared Support**.

To access shared components, Komodo users must have "read" access rights to shared files in both the Common Data Directory and the [Shared Toolbox](toolbox.html) (if the directory is not the same as the Common Data Directory). To alter shared components, users must also have "write" rights.

By default, the <a name="Config_CDD" id="Config_CDD">The Common Data Directory</a> is the same as the [user data](trouble.html#appdata_dir) directory.

To specify a custom location for the Common Data Directory:

1.  On the **Edit** menu, select **Preferences** > **Shared Support**.
1.  Click **Use custom Common Data Directory location**.
1.  Click **Choose** to select a new location.
1.  Click **OK**.

<a name="Share_Files" id="Share_Files"></a>
### Sharing .tip, .pcx and .pdx Files

Through Shared Support, .tip files (which provide syntax checking for PHP and Tcl) can be made available site-wide. All .tip files should be stored along with the default .tip information in the _tcl_ subdirectory of the Common Data Directory.

The other file types that can be shared are .pcx files, which can be used to extend the command information supported by the TDK Checker and Komodo Tcl linter, and .pdx files, which are debugger extension files that define debugging functions, such as spawnpoints. Like .tip files, .pcx and .pdx files are stored in the _tcl_ subdirectory of the Common Data Directory.

<a name="Share_Prefs" id="Share_Prefs"></a>
### Sharing Preferences

Shared preferences are used to set a default preference configuration that is shared between multiple Komodo users. An organization or user group can specify defaults like the language type for new files, default tab widths, and other Komodo settings.

There are three levels of preference recognition in Komodo:

1.  user preferences
1.  shared preferences (common)
1.  default preferences (factory)

In a shared configuration, user preferences always override the shared preferences. Shared preferences always override the default preferences.

To configure shared preferences, set the desired preferences in one instance of Komodo. (This sets user preferences for that Komodo installation.) Then, edit the _prefs.xml_ file that stores the preferences.

The default locations are as follows:

- **Windows**: `C:\Program Files\ActiveState Komodo 6.x`
- **Mac OS X**: `<komodo-install-directory>_/Contents/SharedSupport/`
- **Linux**: `/etc/komodo/`

Make a backup copy of _prefs.xml_ before editing it. In _prefs.xml_, make the following changes:

- Change the value of `commonDataDirMethod` to `custom`.
- Change the value of `customCommonDataDir` to the path to the Common Data Directory.

Copy _prefs.xml_ to the Common Data Directory. When other Komodo sessions (configured to use the same Common Data Directory) are started, the preferences in the Common Data Directory are used.

Because user preferences override both default and shared preferences, ensure that user preferences are not configured for items defined in the shared preferences. For example, if the shared preference contains a tab size definition and a user's personal preference contains a tab size definition, the user's preference is used, not the shared preference.

<a name="scc" id="scc"></a>
## Source Code Control Preferences

(Komodo IDE only)

Komodo IDE features source code control (SCC) integration, which you can use to perform the most common SCC repository tasks from within Komodo, including checking files out, comparing them to the repository version, and checking files back in. See [Source Code Control](scc.html) for information about using SCC functions within Komodo.

- **Show SCC Output on Commands**: Select the desired action from the drop-down list to specify whether the Notifications tab is displayed when SCC commands produce output.
- **Method used to display 'diff' output**: Specify whether the output from the SCC diff command should be displayed in a separate window, or within a new tab in the Komodo Editor pane.

<a name="CVS" id="CVS"></a>
### CVS Integration

Configure these options to use [CVS](http://www.nongnu.org/cvs/) source code control integration.

- **CVS Integration**: Select this check box if you are using a CVS source code repository.
- **CVS executable used**: Choose the path to the desired CVS executable file from the drop-down list, or click **Browse** to navigate to the file location.
- **Check for status changes from outside of Komodo**: If this check box is selected, Komodo checks to see if the status of files that are open in the editor has changed from the status they had at the last check. Specify the interval at which Komodo should check the file status in the field below.
- **Do recursive status checks**: When checking the CVS status of files in a project, select this check box to recurse the directories. If this check box is not selected, only the status of files in the current directory are checked.
- **Diff options**: When you use the option **Diff (Compare Files)**, the comparison is performed according to the style specified here. Any CVS diff options may be specified. For a complete list of options, refer to the [CVS Manual](http://ximbiot.com/cvs/manual/).
- **Do not warn about CVS external protocols (CVS_RSH) at startup**: If you are using an external protocol (such as RSH) to connect to the CVS repository, select this check box if you do not want a warning displayed when you start Komodo.

<a name="Perforce" id="Perforce"></a>
### Perforce Integration

Configure these options to use [Perforce](http://www.perforce.com/) source code control integration.

- **Perforce Integration**: Select this check box if using a Perforce source code repository.
- **Perforce executable used**: Use the drop-down list or the **Browse** button to specify the path to the Perforce executable file.
- **Check for status changes from outside of Komodo**: If this check box is selected, Komodo checks to see if the status of files that are open in the editor has changed from the status it had at the last check. Specify the interval at which Komodo should check the file status in the field below.
- **Do recursive status checks**: When checking the status of files in a project, select this check box to recurse the directories. If this box is not checked, only the status of files in the current directory is checked.
- **Show diff in Komodo**: When you use the option **Diff (Compare Files)**, the comparison is performed according to the style specified here. For a complete description of the options, enter `p4 help diff` on the command line.
- **Use external diff tool**: If you want to use a diff tool other than Perforce, it must be specified in this field. The location of the diff tool must also be included in your system's PATH environment variable.
- **Automatically open files for edit before save**: Select an option from the drop-down list to determine what Komodo does if you attempt to save a file that has not been checked out of Perforce.

<a name="Subversion" id="Subversion"></a>
### Subversion Integration

Configure these options to use [Subversion](http://subversion.tigris.org/) source code control integration.

- **SVN Integration**: Select this check box if you are using a Subversion source code repository.
- **SVN executable used**: Use the drop-down list or the **Browse** button to specify the path to the Subversion executable file. Requires the svn command line client, available from [http://subversion.tigris.org/](http://subversion.tigris.org/). Komodo cannot use the TortoiseSVN client as its SVN executable.
- **Check for status changes from outside of Komodo**: If this box is selected, Komodo checks to see if the status of files that are open in the editor has changed from the status they had at the last check. Specify the interval at which Komodo should check the file status in the field below.
- **Do recursive status checks**: When checking the Subversion status of files in a project, check this box to recurse the directories. If this box is not checked, only the status of files in the current directory are checked.
- **Diff options**: When you use the option **Diff (Compare Files)**, the comparison is performed according to the style specified here. Any Subversion diff options may be specified. For more about diff options, refer to the [Subversion Documentation](http://subversion.tigris.org/servlets/ProjectDocumentList).
- **Do not warn about Subversion external protocols (SVN_SSH) at startup**: If you are using an external protocol (such as SSH) to connect to the Subversion repository, check this box if you do not want a warning displayed when you start Komodo.

<a name="syntax_checking" id="syntax_checking"></a>
## Syntax Checking

Background syntax checking validates code against the language interpreter as you type. (If [Code Intelligence](#code_intel) is enabled for Python, the code intelligence database is used to validate Python code.) Syntax errors and warnings are underlined in the [Editor pane](workspace.html#Editor_Pane). See [Background Syntax Checking](editor.html#Linting) for more information.

By default, Komodo performs a background syntax check one second (1000 msecs) after you stop typing. In very large files, this background process can slow down editing. If you notice slowness in the editor pane, try extending the delay or disabling background syntax checking. Syntax checking can be run manually by clicking the syntax checking icon (![](/images/icon_check_ok.png) or ![](/images/icon_check_error.png) in the status bar.

**Enable checking of mixed end-of-line (EOL) characters"** checks for inconsistent end-of-line characters caused by editing a file on multiple platforms (e.g. CR-LF on Windows vs. LF on Linux).

<a name="Language-Specific Syntax Checking" id="lang_specific_syntax"></a>
### Language-specific syntax checking properties

Syntax checking options for various languages can be set by choosing the language from the drop-down list, setting the desired parameters. Each language will have different options.

<a name="Test Plan Prefs" id="test_plan_prefs"></a>
## Test Plan Preferences

Settings for global test plans (see [Unit Testing](unittest.html)). Project-level test plans should be configured in the [Project Properties](project.html#project_prefs).

<a name="web" id="web"></a>
## Web and Browser Preferences

- **Web Browser**: Specify the browser that Komodo should launch when a [web-based language query](#language_help) or the [web browser preview](editor.html#browser_preview) is invoked. Select the desired browser from the list, or use the **Browse** button to navigate to the desired browser. If you do not specify a browser, Komodo uses the system's default browser.
- **Preview in Browser**: Choose the method Komodo uses to preview code in the selected web browser:
    - **Preview in Komodo tab, other tab group**: This option splits the [Editor pane](workspace.html#Editor_Pane) to display the browser preview in a separate pane.
    - **Preview in Komodo tab, same tab group**: This option displays the browser preview in the Editor pane.
    - **Preview in external browser**: This option opens the default browser (specified in the Web and Browser Preferences drop-down list) in a separate window.

<a name="integration" id="integration"></a>
## Windows Integration Preferences

Windows Integration preferences set system-wide file associations on the Windows platform. By configuring file associations, Komodo becomes the default editor for specific file types. When one of these files is invoked (for example, by double-clicking the filename in Windows Explorer), Komodo is automatically launched (if not already running) and the file is loaded in the [Editor pane](workspace.html#Editor_Pane).

When a file extension is added to the "Edit with Komodo" association, the context menu displayed when the filename is right-clicked in Window Explorer contains an "Edit with Komodo" option.

To configure file associations:

1.  Select **Edit** > **Preferences** > **Windows Integration**.
1.  Click **Configure common associations**. The **Setup Common Komodo File Associations** dialog box opens.
1.  Select the file extensions for which Komodo should be the default editor and the files extensions that should have the "Edit with Komodo" context menu option.

Individual file extensions may be added and deleted via the lists.

If another application overrides the associations configured by Komodo, click **Re-apply settings to system** to reset the Komodo associations.
