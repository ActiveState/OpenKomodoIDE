---
title: Working with Files
---
Komodo provides a variety of methods for accessing and editing files. While files can be opened and edited individually, they can also be stored in [projects](project.html) or the [Toolbox](toolbox.html) as components.

If Komodo is configured to integrate with a [source code control](scc.html) system (SCC), status icons beside the filenames indicate the file's current SCC status, and SCC options are available from the **File** menu and the right-click context menus. This integration is described in detail in the Source Code Control section of the Komodo documentation.

Files are manipulated in various ways: via the **File** menu, via context menus in the editor, via context menus on the file tab (above the editor), and as components within projects and the Toolbox.

This document describes file functionality, such as opening, printing, and saving files. See the [Editing](editor.html) page for information about editing files.

<a name="Creating_a_New_File" id="Creating_a_New_File"></a>
## Creating Files

To create a new file, click the "New File" button on the standard toolbar. (To display the standard toolbar, click **View** > **Toolbars** > **Standard**.) A new file with the default file extension for the file type is created and opened in the Komodo editor. Use the [New Files](prefs.html#new_files) page in Komodo's Preferences to specify the default file extension for new files.

<a name="files_templates" id="files_templates"></a>
### Creating Files from Templates

New files can be created based on pre-defined templates that contain default content for specific file types. See the [Templates](templates.html) documentation for information about configuring custom templates.

To create a new file from a template, select **File** > **New** > **File**. The New File dialog box contains numerous pre-defined templates organized into categories. Select the desired category, then select the desired template within that category.

Click **Open** to create a file with the contents of the template file. The file is loaded in the editor.

The **File** > **New** > **File** menu displays a list of the most recently accessed templates. To alter the number of template files displayed, refer to the [New Files](prefs.html#new_files) page in Komodo's Preferences.

To add a template to the [Toolbox](toolbox.html) for quick access, select the desired template and click **Add to Toolbox**.

<a name="Opening_a_File" id="Opening_a_File"></a>
## Opening Files

There are numerous methods for opening files in Komodo. These include:

- **File** > **Open** > **File**: Open a file using the system file browser.
- **File** > **Open** > **Go to File**: Open a file using the **[Go to File](#files_go_to_file)** dialog.
- **Projects or Toolbox sidebars**: Double-click, drag and drop, or use the file's right-click context menu to open a file contained in a [project](project.html) or the [Toolbox](toolbox.html).
- **Open/Find Toolbar**: Use the [Open/Find Toolbar](search.html#search_find_toolbar). To display the Open/Find Toolbar, select **View** > **Toolbars** > **Open/Find**.
- **Most Recently Used List**: The most recently visited files are accessible from the **File** > **Recent Files** menu. The number of files in the most recently used list is determined by the [Appearance](prefs.html#UI_Configuration) preference.
- **Drag and Drop**: Drag and drop one or more files from another drag-and-drop application (such as Windows Explorer) onto the Komodo editor.
- **Command-Line Argument**: When Komodo is invoked from the command line, files can be specified as open arguments. See [Starting on Windows](starting.html#Windows_Start), [Starting on OSX](starting.html#OSX_Start), or [Starting on Linux](starting.html#Linux_Start) for more information.

<a name="files_go_to_file" id="files_go_to_file"></a>
### Go to File (Commando)

You can easily open Files via the Commando panel, see the [Commando documentation](commando.html) for more information.

<a name="Opening_Remote_Files" id="Opening_Remote_Files"></a>
### Opening Remote Files

Komodo can open files located on remote machines, providing that the remote machine is configured for FTP, FTPS, SFTP, or SCP access. To quickly access frequently used servers, create an entry in the [Server Preferences](prefs.html#Servers) (**Edit** > **Preferences** > **Servers**).

To open a file located on a remote server, select **File** > **Open** > **Remote File**.

<a name="files_remote_connect" id="files_remote_connect"></a>
#### Connecting to a remote server

- **Pre-Configured Server Connection**: If remote servers have been configured in Komodo's [Preferences](prefs.html#Servers), select the name of the configuration from the **Server** drop-down list. Access the Server Configuration dialog box by clicking the **Accounts** button to the right of the **Server** field.
- **Manual Server Connection**: Enter the server's fully qualified hostname in the **Server** field. Press 'Enter'. You are prompted to enter a name and password for the server. If the server is configured for anonymous access, select **Anonymous login**. To store the login name and password for the server, click **Remember these values**.

<a name="files_public_key_auth" id="files_public_key_auth"></a>
#### Using Public Key Authentication

Komodo supports public key authentication through external key agents like ssh-agent (included with the [OpenSSH](http://www.openssh.org/) distribution) and Pageant (a companion utility for [Putty](http://www.putty.org/)). This allows you to access remote files over SFTP or SCP without entering passwords.

- **ssh-agent configuration**: See IBM's [OpenSSH key management](http://www.ibm.com/developerworks/library/l-keyc2/) guide or the [ssh-agent manual page](http://www.openbsd.org/cgi-bin/man.cgi?query=ssh-agent).
- **Pageant configuration**: See [Using Pageant for authentication](https://the.earth.li/~sgtatham/putty/0.70/htmldoc/Chapter9.html#pageant)".

Information on configuring public key authentication with source code control (CVS and SVN) can be found in [Configuring SSH Support for CVS and Subversion](scc.html#config_ssh).

#### <a name="files_navremote" id="files_navremote">Navigating the Remote File System</a>

After establishing a connection to the remote server, a list of files and directories is displayed. These files and directories exist under the directory specified in the **Look in** field. Double-click a directory (indicated by a file folder icon) to navigate the directory structure. Use the navigation buttons in the top right corner of the dialog box to navigate the remote filesystem.

To open a single file, double-click the filename. To open multiple files, hold down the 'Ctrl' key while clicking multiple files, then click **Open**.

The buttons in the top right corner of the dialog box perform various file and directory manipulation functions. Hover your mouse pointer over the buttons for a description of their functions. To delete or rename a file on the remote server, right-click the filename and, with the left mouse button, select the desired command on the context menu.

<a name="Open_Mapped_URI" id="Open_Mapped_URI"></a>
### Opening Mapped URIs

[Mapped URIs](prefs.html#mapped_uris) can be opened by dragging a mapped link from a browser into Komodo. For example, if you mapped the URL _http://www.example.org/_ to the local directory _/var/www/_, you could drag a link like _http://www.example.org/projects/test_ from a browser into Komodo, which would open the local file _/var/www/projects/test_

This feature also works with URIs mapped to remote filesystems (via FTP, SFTP or SCP), which in turn can be configured for automatic authentication under **[**Edit** > **Preferences** > **Servers](prefs#Servers)**.

<a name="Switching_Between_Files" id="Switching_Between_Files"></a>
## Switching Between Files

To switch between open files in the editor:

- **Key Binding**: Use the associated [key binding](prefs.html#Config_Key_Bindings).
- **Editor Tabs**: Click the tab with the desired filename.
- **Window Menu**: On the **Window** menu, select **Next File** or **Previous File** to move from left to right (or right to left) across the file tabs. Alternatively, select the desired file from the list of files currently open in the editor.
- **Project or Toolbox**: Double-click the filename.

If more files are opened than can be displayed by file tabs, click the right and left arrow buttons located in the top right corner of the editor to view the tabs of all open files.

To re-order the position of the file tabs, drag and drop the tabs into the desired positions.

For more information about working with the editor tabs, see [Editor Tab Display](editor.html#editor_tabs) in the editor documentation.

<a name="Comparing_Files" id="Comparing_Files"></a>
## Comparing Files

Komodo includes a "diff" mechanism used to compare files. To compare two files using Komodo's "diff" window:

1.  Select **Tools** > **Compare Files**.
1.  By default, the path and file name of the file currently displayed in the editor is the first file for comparison. As desired, alter this selection by entering an alternate path and file, or browse for the desired file using **Browse** button. Use the same mechanism to specify the second file.
1.  Click **Compare Files**. The contents of both files are displayed in the "diff" window.

If the file is stored in a [project](project.html) or the [Toolbox](toolbox.html), this function can also be invoked by right-clicking the file and selecting **Compare File With**.

The unique characteristics of each file are displayed in different colors (red and blue by default); common characteristics are displayed in a third color (black by default). To configure custom colors for the "diff" window, alter the **Language-Specific Coloring** setting for the **Other** > **Diff** language in the [Fonts and Colors](prefs.html#lang_specific) preference.

The following buttons (and default keybindings) are available in the "diff" window:

- **Next** ('F8'): Jump to the next change.
- **Previous** ('F7'): Jump to the previous change.
- **Reveal** ('F9'): Jump to corresponding line. Opens and/or shifts focus to the original file in the Editor Pane. If viewing a diff in an editor tab, right-click and select **Jump to Corresponding Line** (or select **Navigation** > **Jump to Corresponding Line**) to shift focus to the editor tab containing the source code. Selecting this option opens the source code tab in the Editor Pane if it is not already open and/or shifts focus to the original file in the Editor Pane. (If viewing a diff in an editor tab, right-click and select **Jump to Corresponding Line**.)

A right-click context menu is also available with the following additional options:

- Copy
- Select All
- View Whitespace
- View Indentation Guides
- View Line Numbers
- View EOL Markers
- Word Wrap

Pressing 'Esc' closes the window.

<a name="files_refstatus" id="files_refstatus"></a>
## Refreshing File Status

The **Refresh Status** option checks the read/write disk status for the component. If the file is of a language for which "code intelligence" is supported and enabled (as configured in the [Code Intelligence Preferences](prefs.html#code_intel)), **Refresh Status** also updates the code intelligence database with the contents of the file.

If the component is stored in a [source code control](scc.html#scc_top) system, **Refresh Status** also checks the repository status of the file. Komodo determines whether a file is contained in an SCC repository by the following methods:

- **Perforce**: analysis of the client configuration
- **CVS**: analysis of the CVS control directories

To refresh the file status of the current file, right-click the file tab or right-click within the editor and select **Refresh Status**. The same option is available on the right-click context menu of files in [projects](project.html) or within the [Toolbox](toolbox.html).

<a name="files_scc" id="files_scc"></a>
## Source Code Control

Komodo provides source code control support for files stored in CVS or Perforce repositories. Source code control support (including SCC configuration, status icons and specific commands) is described in detail in the [Source Code Control](scc.html) section of the documentation. To access source code control commands:

- **Editor Context Menu**: Right-click a file in the editor and select **Source Control**.
- **File Tab Context Menu**: Right-click a file tab above the editor and select **Source Control**.
- **Toolbox or Project Context Menu**: Right-click a file in the [Toolbox](toolbox.html) or [Projects sidebar](project.html) and select **Source Control**.
- **Toolbox or Project Menu**: If a file is currently selected in the [Toolbox](toolbox.html) or [Projects sidebar](project.html), use the menu to access source code control commands for the selected file.

<a name="files_settings" id="files_settings"></a>
## File Properties and Settings

In addition to the Komodo's global [Preferences](prefs.html), some preferences can also be configured on a per-file basis. These settings override the global and project level preferences. To access the Properties and Settings dialog box for a file:

- **Edit Menu**: On the **Edit** menu, click **Current File Settings**.
- **Editor Context Menu**: Right-click in the editor and select **Properties and Settings** from the context menu.
- **File Tab Context Menu**: Right-click the tab above the editor that displays the filename, and select **Properties and Settings**.

<a name="files_settings_props" id="files_settings_props"></a>
### File Properties

The **Properties** category in the Properties and Settings dialog box displays general information about the file, such as the directory where it is stored, the size and creation and modification dates. The following file characteristics can be modified on this tab:

- **Attributes**: Toggle the file's status between writable and read-only.
- **Language**: This field displays the current language association (which affects language-specific options like syntax coloring and AutoComplete) for the current file. To change the language association, select another language from the drop-down list. To set the language association to the Komodo default (as configured in the [File Association Preference](prefs.html#File_Associations), click **Reset**.
- **Encoding**: Use this field to set the [International Encoding](prefs.html#Internationalization) for the current file. Select **Use signature (BOM)** to use the byte order mark (a Unicode character at the top of the file which indicates the encoding) if present.
- **Line Endings**: Use this field to set the desired line endings for the current file. By default, Komodo preserves the line endings contained in a file when the file is opened. (Default line endings for new files are configured in the [New Files](prefs.html#new_files) preference.) If you select **Preserve existing line endings**, new lines are assigned the end-of-line character selected in the drop-down list, but existing lines are not be altered.

For HTML and XML documents, two additional settings are available:

- **Default DOCTYPE**
- **Default Namespace**

Komodo tries to determine these values from the document's XML declaration. If the document does not have one, the DOCTYPE and namespace can be manually set here, enabling appropriate XML autocompletion. XHTML 1.1 is the default if no declaration or settings are present.

<a name="files_settings_scc" id="files_settings_scc"></a>
### File Source Control Settings

If Komodo is configured to work in conjunction with a [Source Code Control](scc.html) system, the **Source Code Control** category displays the current SCC status and settings.

<a name="files_settings_editing" id="files_settings_editing"></a>
### File Editor Settings

The options on this tab are a subset of the [General Editor](prefs.html#prefs_editor) and [Smart Editing](prefs.html#smart_editing) preferences. Refer to those sections of the Preferences documentation for information about individual options.

<a name="files_settings_indent" id="files_settings_indent"></a>
### Indentation Tab

The options on this tab are a subset of the [Indentation Preferences](prefs.html#Indentation_Features). Refer to that section of the Preferences documentation for information about individual options.

<a name="browser_preview" id="browser_preview"></a>
### Browser Preview

This option configures the behavior of the [Preview in Browser](editor.html#browser_preview) function. When the Preview in Browser function is invoked, you are prompted to specify the file or URL used to preview the current file. (For example, when previewing a CSS file, specify an HTML file to use for the preview.) The Preview in Browser dialog box has an option for remembering the specification. If that option is enabled, the file or URL specified is displayed in the **Preview** field. Click **Change** to alter the preview file.

<a name="Printing" id="Printing"></a>
## Printing Files

To print the file that is currently displayed in the editor, use one of the following methods. These methods invoke the standard system dialog box for printer selection and configuration. Advanced print functions are described below.

- **File** > **Print** > **Print**: Invoke the print function from the **File** menu.
- **Standard Toolbar**: On the Standard Toolbar, click the Print button.
- **Editor Context Menu**: Right-click the file and select **Print**.

Printing style is configured on the Printing page in Komodo's [Preferences](prefs.html#printing). Alternatively, select **File** > **Print** > **Print Settings** to display the Printing preferences page.

To display a preview of the printed output, select **File** > **Print** > **Print Preview**.

Select **File** > **Print** > **Print Preview** contains features for setting the scale and orientation of a print job. Use the arrow buttons to move forward or backward in a multi-page print job, or enter a specific page number in the field provided. Click the Page Setup button to access the complete set of print features in the [Page Setup](#page_setup) dialog box.

To print a selection of text rather than the entire file, select the desired text in the editor, then select **File** > **Print** > **Print Selected Text**.


### Page Setup

Manage the format of print jobs using the options available in the Page Setup dialog box. Select **File** > **Page Setup** to access these options.

**Format and Options**

- **Orientation**: Select whether the printed output should have a portrait or landscape orientation.
- **Scale**: If the **Shrink To Fit Page Width** check box is not selected, use this field to manually enter a percentage.
- **Shrink To Fit Page Width**: Select this check box to make the print job fit the paper size selected for the default printer.
- **Print Background (colors & images)**: Select this check box to include background colors and graphics (e.g., on a web page) in a print job.

**Margins and Header/Footer**

- **Margins**: Use the fields provided to enter the size of the margins in inches.
- **Headers and Footers**: Use the drop-down lists to select the type of information that appears in the headers and/or footers, and to determine their position on the page. The top row of lists contains the header options, and the bottom row contains the footer options. Choose from options such as "Title", "URL" and "Page #". Select the "Custom" option from any of the drop-down lists to enter custom header information. To print without headers and footers, select the "blank" option in each of the drop-down lists.

<a name="files_printhtml" id="files_printhtml"></a>
### Print to HTML File

To generate an HTML file from the file currently active in the editor:

1.  On the File menu, click **Print to HTML File**. You are prompted to name the output file.
1.  Enter the file location in the field provided. Click **OK**. The HTML file opens in the editor.

To print a selection of text to an HTML file (rather than the entire file), select the desired text in the editor, then select **File** > **Print** > **Print to HTML File**.

<a name="Saving_a_File" id="Saving_a_File"></a>
## Saving Files

Komodo is "intelligent" about saving files. For example, Komodo prompts to save unsaved files on close. Attempting to save changes to a file that is set to read-only displays a dialog box where you are given the option to change the status or to "force" the save (which makes the file writable, saves the changes, then sets the file back to read-only). In addition, Komodo can be configured to automatically save a backup copy of files open in the editor. To configure Komodo's save functionality, use the [Save Options](prefs.html#Save_Options) preference page.

To save a file with its current name, do one of the following:

- **Key Binding**: Use the associated [key binding](prefs.html#Config_Key_Bindings).
- **File** > **Save**: Use the **File** > **Save** menu option to save the file that is currently displayed in the editor. To save the file to a different name, select **File** > **Save As**. To save all open files, select **File** > **Save All**
- **Standard Toolbar**: Click the Save button on the Standard toolbar. To save all open files, click the Save All button.
- **File Tab Context Menu**: Right-click the file tab and select **Save**. To save the file to a different name, select **File** > **Save As**.

<a name="Saving_Files_Remotely" id="Saving_Files_Remotely"></a>
### Saving Files Remotely

To save a copy of the current file to a remote server, select **File** > **Save Remotely As**. The [Remote File](#Opening_Remote_Files) dialog box is displayed. When editing files located on a remote server (including remote files stored in a [project](project.html) or the [Toolbox](toolbox.html)), saving the file automatically saves it to the remote location.

<a name="files_showunsaved" id="files_showunsaved"></a>
### Show Unsaved Changes

Before saving a file, view the changes in the file since it was last saved by using the **Show Unsaved Changes** option. To invoke this option, right-click within the editor (or on the file tab above the editor) and select **Show Unsaved Changes**. An external window displays the differences between the current version of the file and the disk version (e.g., the version that was last saved).

The unique characteristics of each file are displayed in different colors (red and blue by default); common characteristics are displayed in a third color (black by default). To configure custom colors for the "diff" window, alter the **Language-Specific Coloring** setting for the **Other** > **Diff** language in the [Fonts and Colors](prefs.html#lang_specific) preference.

<a name="Revert_File" id="Revert_File"></a>
## Reverting Files

To abandon changes made to a file since it was last saved, but leave the file open in the editor, select **File** > **Revert**.

<a name="Closing_Files" id="Closing_Files"></a>
## Closing Files

To close one or more files, use one of the following methods:

- **Editor Tabs**: Click the "x" in the top right corner of the tab, or middle-click on the tab.
- **File Menu**: Select **File** > **Close** then one of **Current Tab**, **Other Tabs** or **All Tabs**.
- **Key Binding**: Use the associated [key binding](prefs.html#Config_Key_Bindings) (e.g. "Ctrl"+"F4" on Windows).
- **Editor Tab Context Menu**: Right-click the file tab and select **Close**.
