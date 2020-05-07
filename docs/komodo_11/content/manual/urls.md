---
title: URL shortcuts
---
URL shortcuts are components within a [project](project.html) or the [Toolbox](toolbox.html) that are used to store frequently used URL addresses. These URL shortcuts can be opened in an external browser (as specified in the [Web and Browser](prefs.html#web) preference) or displayed in a new tab within Komodo.

Refer to [Adding, Removing and Managing Tools](toolbox.html#tools_add_rem) for instructions on adding components a Toolbox. In addition, URL shortcuts can be created by dragging a URL from a web browser address bar, or from a Komodo tab, onto a project or Toolbox. URLs must be preceded by "http://".

To open a URL, double-click the URL name (which opens the URL in an external browser), use the assigned [key binding](prefs.html#Config_Key_Bindings), or right-click the URL and select **Open URL in browser** or **Open URL in tab**.

<a name="urls_options" id="urls_options"></a>
## URL Shortcut Options

To access options for the URL shortcut, right-click on it's icon in the Toolbox to bring up the context menu. The following options are available:

- **Open URL in browser**: Use this option to launch the default web browser (as specified in the [Web and Browser](prefs.html#web) preference) and display the stored URL.
- **Open URL in tab**: Use this option to display the stored URL in a tab in the Komodo [Editor Pane](workspace.html#Editor_Pane).
- **Cut/Copy/Paste**: Used to duplicate or move a URL shortcut when dragging is not convenient (e.g. to a project which is currently closed).
- **Show in File Manager**: Shows the JSON file for the URL shortcut in the system's default file manager.
- **Export as Zip File...**: Exports the URL shortcut in a standard ".zip" archive.
- **Rename**: Changes the URL shortcut name.
- **Delete**: Permanently removes the selected URL shortcut from the toolbox.

<a name="urls_props" id="urls_props"></a>
### URL Shortcut Properties

URL shortcut properties are used to alter the address of the URL or to change the URL shortcut's name. The Properties dialog box is also used to assign a custom icon to a URL shortcut or to assign a custom key binding. To access the Properties dialog box, right-click the URL shortcut and select **Properties**.

<a name="urls_icons" id="urls_icons"></a>
#### Assigning Custom Icons to URL Shortcuts

The default URL shortcut icon can be replaced with custom icons. Komodo includes more than 600 icons; alternatively, select a custom image stored on a local or network drive (use 16x16-pixel images for best results).

To assign a custom icon to a URL shortcut:

1.  Right-click the URL shortcut in the Toolbox and select **Properties**.
1.  In the Properties dialog box, click **Change Icon**.
1.  In the Pick an Icon dialog box, select a new icon and click **OK**. Alternatively, click **Choose Other**, and browse to the desired image file.
1.  In the Properties dialog box for the URL shortcut, click **OK**. The custom icon is displayed next to the URL shortcut.

To revert to the default icon for a selected URL shortcut:

1.  In the **Projects** or **Toolbox** sidebar, right-click the desired URL shortcut and select **Properties**.
1.  Click **Reset**, then click **OK**. The default icon is displayed next to the URL shortcut.

<a name="urls_keybindings" id="urls_keybindings"></a>
#### URL Shortcut Key Bindings

Custom key bindings can be assigned to URL shortcuts stored in the [Toolbox](toolbox.html). Use the **Key Binding** tab in the URL shortcut's Properties to specify the keystrokes that invoke the URL shortcut. See [Key Bindings for Custom Components](prefs.html#Config_Key_Bindings) for more information.
