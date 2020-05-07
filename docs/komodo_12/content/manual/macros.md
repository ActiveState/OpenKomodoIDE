---
title: Macros and Userscripts
---
Macros and Userscripts are scripts which automate Komodo.

Userscripts are stored [toolboxes](toolbox.html) and can be launched by double-clicking the Userscript icon, pressing an associated [custom key binding](#key_bindings), or by binding them to event [triggers](#triggers_userscript).

The **Macros** toolbar provides quick access for recording, running, and saving macros as Userscript in the toolbox. To show or hide the toolbar, select **View** > **Toolbars** > **Macros**. You can also use the **Tools** > **Macros** menu items.

<a name="creating_macros" id="creating_macros"></a>
## Creating Macros

Macros can be created by recording keystroke and command sequences.

<a name="macros_recording" id="macros_recording"></a>
### Recording Macros

Recording is a simple method for creating a macro. Only keystrokes (not mouse movements) are recorded.

To record a macro:

1.  Select **Tools** > **Macros** > **Start Recording** (or use the **Record Macro** button in the Macro toolbar). The Komodo status bar displays "Recording Macro".
1.  In the Editor Pane, enter the keystrokes to store in the macro. While entering keystrokes, pause recording by selecting **Tools** > **Macros** > **Pause Recording**. Select **Start Recording** when ready to resume macro creation.
1.  To end macro recording, select **Tools** > **Macros** > **Stop Recording**. The status bar displays "Macro Recorded".

**Note**: Though keystrokes in the Editor pane can be captured and recorded in this manner, several Komodo commands cannot. If your resulting macro does not replay certain operations, you may be able to add them manually by editing the recorded macro. Consult the [Writing Macros](#userscripts_writing) section for further information.

To save the most recent macro:

1.  Select **Tools** > **Macros** > **Save to Toolbox**, or click **Macro: Save to Toolbox** on the Macro Toolbar.
1.  Give the new macro a unique name in the **Enter name for new macro** field. A reference to the macro is automatically added to the [Toolbox](toolbox.html).

<a name="userscripts_writing" id="userscripts_writing"></a>
### Writing Userscripts

Use the "New Userscript" Properties dialog box to write macros in either Python or JavaScript. This dialog box has tabs for specifying [key bindings](#key_bindings) and Komodo event [triggers](#triggers_userscript) that invoke the macro automatically.

To add a userscript:

1.  Select **Add New Userscript** from the Toolbox drop-down menu or a folder's right-click context menu.
1.  **Language**: Specify the language (Python or JavaScript) in which to program the userscript.
1.  Set any desired [userscript properties](#userscripts_properties).
1.  Write the userscript in the editor field or save what you have so far by clicking **OK**. You can open it in an editor tab by right-clicking on the userscript icon and selecting **Edit Userscript**. This is useful as it provides autocompletion and other Komodo editing features.

<a name="macros_running" id="macros_running"></a>
## Running Macros and Userscripts

To run the most recently recorded macro, select **Tools** > **Macros** > **Execute Last Macro**. If the Macro Toolbar is open (**View** > **Toolbars** > **Macro**), click **Macro: Run Last Macro**.

To run a userscript that has been saved to a [project](project.html) or [toolbox](toolbox.html), double-click the macro or use the key binding you have assigned to it. Alternatively, right-click the userscript and select **Execute Userscript**.

<a name="userscripts_managing" id="userscripts_managing"></a>
## Managing Userscripts

Userscripts can be dragged into any [toolbox](toolbox.html) or toolbox folder. Right-clicking on a userscript brings up a context menu with the following additional options:

- **Execute Userscript**: Runs the selected userscript.
- **Edit Userscript**: Opens the userscript in an editor tab.
- **Cut/Copy/Paste**: Used to duplicate or move a userscript when dragging is not convenient (e.g. to a project which is currently closed).
- **Show in File Manager**: Shows the JSON file for the userscript in the system's default file manager.
- **Export as Zip File**: Exports the userscript in a standard ".zip" archive.
- **Rename**: Changes the userscript name.
- **Delete**: Permanently removes the selected userscript from the toolbox.

<a name="userscript_properties"></a>
## Userscript Properties

Right-click on a userscript and select **Properties** to view or edit the userscript or configure the following properties.

<a name="key_bindings" id="key_bindings"></a>
### Assigning Key Bindings to Userscripts

Use the **Key Binding** tab to specify a key combination or sequence for invoking the userscript. To add a new keybinding:

1.  Select the **New Key Sequence** field
1.  Press the desired key combinations. The **Key Sequence Currently Used By** field will alert you if there are any conflicts.
1.  Click **Add** (multiple keybindings are allowed).
1.  Click **OK** on the Properties dialog box to close it.

If the userscript is in a toolbox, the assigned keybinding will always trigger the userscript. If it's in a project, the keybinding will work only when that project is open.

<a name="Cust_Icons" id="Cust_Icons"></a>
### Assigning Custom Icons to Userscripts

The default userscript icon can be replaced with custom icons. Komodo includes more than 600 icons, but you can use any 16x16-pixel image you wish.

To assign a custom icon to a userscript:

1.  In the userscript's Properties dialog box, click **Change Icon**.
1.  In the Pick an Icon dialog box, select an icon set from the drop list, choose a new icon, and click **OK**. To choose an icon from your filesystem, click **Choose Other**, and browse to the desired image file.
1.  Click **OK** on the Properties dialog box to close it. The custom icon is displayed next to the userscript.

To revert to the default icon for a selected userscript, use the **Reset** button.

<a name="run_background" id="run_background"></a>
### Running Userscripts in the Background

Userscripts that invoke and do not affect the current file should be run in the background to minimize interference with Komodo responsiveness. Userscripts that run in the background are run in threads (Python), or in a timeout (JavaScript). To set this option:

1.  Right-click the userscript in the Toolbox and select **Properties**.
1.  Select the **Run in Background** option.
1.  Click **Apply**.

If a userscript is not associated with a Komodo event, it can run either in the foreground or in the background.

Userscripts that perform "editor" functions or modify open files should always run in the foreground to "block" and prevent user interference. This prevents the user from moving the cursor and disrupting the userscript currently in progress.

<a name="triggers_userscript" id="triggers_userscript"></a>
### Specifying Userscript Triggers

Userscripts can be configured to execute on certain Komodo events. When an event occurs (for example, a file is opened in Komodo), the userscript is triggered.

Check to make sure userscript triggers are enabled in the [Projects and Workspace](prefs.html#projects) preferences. In the **Triggering Userscripts** area, select **Enable triggering of userscripts on Komodo events**, and then click **OK**.

To add a trigger to a userscript:

1. Select the **Triggers** tab on the Userscript Properties dialog
1. Select the **Userscript should trigger on a Komodo event** check box.
1. Choose one of the following triggers:
    - On startup (occurs at the end of the Komodo startup process)
    - After file open
    - Before file save (see [Userscript Return Values](#userscripts_return_values) below)
    - After file save
    - Before file close (see [Userscript Return Values](#userscripts_return_values) below)
    - After file close
    - On shutdown (see [Userscript Return Values](#userscripts_return_values) below)
    - On a system notification
1. Set the **Rank** (optional): Enter a numerical rank for the userscript. For example, if three userscripts all invoke "After a file is opened", a userscript executes first (100), second (101), or third (102). The default is 100 to provide room for userscripts to run before the default (1-99). Note that if two userscripts trigger on the same event with the same rank, both execute in indeterminate order.
1. Click **Apply**.

<a name="userscripts_trigger_subject"></a>
#### Trigger Userscript subject Variable

Trigger userscripts run with an argument called "subject", available as a global variable within the userscript. This variable references the [ko.views.manager.currentView object](/sdk/macroapi.html#macroapi_js) for post-open, pre/post-save, and pre-close trigger userscripts. For post-close userscripts, it references the URI since the view object is empty at that point. For example, in a userscript with an "After file open" trigger you could use:

```
alert("Just opened file " + subject.document.displayPath);
```

<a name="userscripts_return_values"></a>
#### Userscript Return Values

Komodo userscripts that use the event triggers "Before file save", "Before file close", or "On shutdown", can make use of return values. Userscripts that return that return a true value (e.g. `True` in Python, `true` in JavaScript) can interrupt the process under execution. For example, the following JavaScript userscript triggering "Before file save" prevents you from saving files on Sunday:

```
var currentTime = new Date();
if (currentTime.getDay() == 7) {
  alert("Never on a Sunday!")
  return true;
}
else {
  return null;
}
```

<a name="vi_macros" id="vi_macros"></a>
## Vi Command Mode Macros

Komodo's [Vi emulation](vikeybind.html#vi_emulation) offers a command-line mode. Entering '**:**' opens a text box for entering commands. To access a macros from this mode, create a [toolbox](toolbox.html) folder named **Vi Commands** and move or copy the macro into it. Type the macro name in the Vi command text box to run it.
