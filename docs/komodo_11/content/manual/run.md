---
title: Run commands
---
Run commands are operating system commands run from within Komodo. Use the Run Command dialog box to interact with the system command line or shell while [editing](editor.html) or [debugging](debugger.html) files in Komodo. Besides making it easy to run simple and complex custom commands from within Komodo, the Run Command dialog box can insert the results of shell commands into a document in the [Editor Pane](workspace.html#Editor_Pane), or pass the contents of a document to the system command line or shell.

To view examples of run commands, see the "Samples" folder in the [Toolbox](toolbox.html).

Run commands can be stored for re-use in a [project](project.html) or the [Toolbox](toolbox.html), where they can be assigned key bindings.

Access the last ten commands executed in the Run Command dialog box by selecting **Tools** > **Recent Commands**. The prefixes [i], [l] and [il] indicate that **Insert output**, **Pass selection as input** or both were selected with the original command.

<a name="run_create" id="run_create"></a>
## Creating Run Commands

To create a run command, select **Tools** > **Run Command**. The Run Command dialog box is displayed. Alternatively, invoke the Run Command dialog box from the [Toolbox](toolbox.html) by selecting **Tools** > **New Command** from the **Toolbox** menu.

The Run Command dialog box can be toggled between its "simple" or "advanced" form by clicking the **More/Less** button.

<a name="run_simple" id="run_simple"></a>
### Simple Run Commands

This section describes the components of the Run Command dialog box that are displayed when the advanced commands are hidden (via the **More/Less** button. See [Advanced Run Commands](#run_advanced) for information about the advanced fields.

- **Run**: Enter the command to run.
- **Interpolation Shortcut**: Click the arrow button to the right of the **Run** field to access a drop-down list of [interpolation shortcuts](shortcuts.html). When an interpolation shortcut is selected, it is inserted at the current cursor position in the **Run** field. Windows users should enclose shortcuts for files and directories in double quotes (e.g. "%F") to ensure that spaces in the file name or file path are interpreted correctly.
- **Pass selection as input**: If this check box is selected, the text currently highlighted in the editor is passed to the command in the **Run** field. For example, if the **Run** field contains `grep myvar`, each line containing "myvar" in the text selected in the editor is returned.
- **Insert output**: If this check box is selected, the results of the command are inserted at the cursor position in the current document.
- **Add to Toolbox**: If this check box is selected, the command is saved in the [Toolbox](toolbox.html).

<a name="run_advanced" id="run_advanced"></a>
### Advanced Run Commands

Click the **More** button in the Run Command dialog box to display advanced options. The following options are available:

- **Start in**: Enter the directory where the command should be run, or click the **Browse** button to navigate the filesystem. Click the arrow button to the right of the **Start in** field to select [interpolation shortcuts](shortcuts.html) pertinent to the **Start in** setting. Interpolation shortcuts are inserted at the current cursor position in the **Run** field.
- **Run in**: Specify the environment in which the command should be run. The options are:
    - **Command Output Tab**: The command is run in Komodo's [Bottom Pane](workspace.html#Output_Pane).
    - **New Console**: The command is run in a new shell or command window.
    - **No Console (GUI Application)**: The command launches the specified application without displaying output in a shell or on the **Command Output** tab.
- **Do not open output pane**: If this check box is selected, the [Bottom Pane](workspace.html#Output_Pane) containing the **Command Output** tab does not automatically open when the command is run. To manually view the Bottom Pane, select **View** > **Command Output**. (This option is only accessible if the **Run in** field is set to **Command Output** tab.)
- **Parse output with**: If this check box is selected, the field to the right is used to enter a [regular expression](regex-intro.html) that parses the output. See [Parsing Command Output](/tutorial/runcmdtut.html#parse) in the Run Command Tutorial for an example. (This option is only accessible if the **Run in** field is set to **Command Output** tab.)
- **Show parsed output as list**: If output parsing is configured, select **Show parsed output as list** to display the output in list format on the **Command Output** tab. (This option is only accessible if the **Run in** field is set to **Command Output** tab.)
- **Environment Variables**: Use the **Environment Variables** section of the dialog box to configure new environment variables or change the value of existing environment variables for the duration of the run. To add or alter an environment variable, click **New** and configure the following values:
    - **Variable Name**: Enter a name for the variable.
    - **Variable Value**: Enter a value for the variable.
    - **Interpolation Shortcut**: Click the arrow button to the right of the **Variable Value** field to insert an [interpolation shortcut](shortcuts.html) pertinent to the **Variable Value** setting. The interpolation shortcut is inserted at the current cursor position in the **Variable Value** field.
    - **Add Path**: Click this button to insert a directory as the variable value.
- **Save advanced options as defaults**: If this check box is selected, the current settings are stored as the defaults for the Run Command dialog box.

<a name="run_outputtab" id="run_outputtab"></a>
### Command Output Tab

By default, the commands run in the **Command Output** tab on Komodo's [Bottom Pane](workspace.html#Output_Pane). (Use the **Run in** field to run the command in a new shell window, or to run a graphical application without a console.)

If the command prompts for input, enter it directly on the **Command Output** tab. Output written to "stderr" (standard error output) is displayed in red at the top of the tab. Click the **Close** button at the top right of the **Command Output** tab to terminate a running command. Click the **Toggle Raw/Parsed Output View** button to jump from parsed results to raw output and vice versa. (Parsing is enabled and configured via the **Parse output with** field.)

**Note:** For more information on parsing command output, see the [Parsing Command Output](/tutorial/runcmdtut.html#parse) section of the [Run Command Tutorial](/tutorial/runcmdtut.html).

<a name="run_projtool" id="run_projtool"></a>
## Storing Run Commands in a Toolbox

To add a run command to [Toolbox](toolbox.html), select **Add to Toolbox** in the Run Command dialog box. Run commands can also be added to a toolbox directly via **Add|New Command...** in the drop-down or context menus.

To run a command stored in a Toolbox, double-click the run command's name, use the assigned [key binding](prefs.html#Config_Key_Bindings), or right-click the run command and select **Run**.

To access run command options for the selected run command, right-click the run command's name. The options are as follows:

- **Run Command**: Execute the stored run command.
- **Cut/Copy/Paste**: Used to duplicate or move a command when dragging is not convenient (e.g. to a project which is currently closed).
- **Show in File Manager**: Shows the JSON file for the command in the system's default file manager.
- **Export as Zip File**: Exports the command in a standard ".zip" archive.
- **Rename**: Changes the command name.
- **Delete**: Permanently removes the selected command from the toolbox.

<a name="runcmd_props" id="runcmd_props"></a>
### Run Command Properties

To access the properties of a run command stored in a project or the Toolbox, right-click the run command and select **Properties**. The Properties dialog box contains all the elements of the Run Command dialog box, and is therefore used for editing stored run commands. In addition, the Properties dialog box is used to assign a custom icon to the run command, and to assign a custom key binding.

<a name="run_Cust_Icons" id="run_Cust_Icons"></a>
#### Assigning Custom Icons to Run Commands

The default run command icon can be replaced with custom icons. Komodo includes more than 600 icons; alternatively, select a custom image stored on a local or network drive (use 16x16-pixel images for best results).

To assign a custom icon to a run command:

1.  In the **Projects** sidebar or **Toolbox**, right-click the desired run command and select **Properties**. Alternatively, single click the run command to highlight it in the sidebar then select **Projects** > *runcommand_name* > **Properties** or **Toolbox** > *runcommand_name* > **Properties**.
1.  In the **Properties** dialog box, click **Change Icon**.
1.  In the Pick an Icon dialog box, select a new icon and click **OK**. Alternatively, click **Choose Other**, and browse to the desired image file.
1.  In the properties dialog box for the run command, click **OK**. The custom icon is displayed next to the run command.

To revert to the default icon for a selected run command:

1.  In the **Projects** or **Toolbox** sidebar, right-click the desired run command and select **Properties**.
1.  Click **Reset**, then click **OK**. The default icon is displayed next to the run command.

<a name="run_key_bindings" id="run_key_bindings"></a>
#### Run Command Key Bindings

Custom key bindings can be assigned to run commands stored in the [Toolbox](toolbox.html) or in a [Project](project.html). Use the **Key Binding** tab in the run command's Properties to specify the keystrokes that invoke the run command. See [Key Bindings for Custom Components](prefs.html#Config_Key_Bindings) for more information.

## Related Information

- [Run Command Tutorial](/tutorial/runcmdtut.html)
- [Feature Showcase - Google Run Command](/tutorial/tourlet_googrun.html)
