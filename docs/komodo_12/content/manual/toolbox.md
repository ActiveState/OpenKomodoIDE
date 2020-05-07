---
title: The Komodo Toolbox
---
The Komodo toolbox stores all your commonly used tools (userscripts, snippets, links, etc). It can be found in the right panel in Komodo, although you can move it to any panel you wish.

## What is the Toolbox?

The Toolbox sidebar is for storing "tools", which are bits of code that you can quickly add to Komodo to automate tasks, integrate external tools, or store snippets of text or links.

The following types of tools can be added anywhere in the Toolbox sidebar:

- [Userscripts](macros.html)
- [Commands](run.html)
- [Snippets](snippets.html)
- [Templates](templates.html)
- [URLs](urls.html)

To show and hide the Toolbox sidebar click the **Show/Hide Right Pane** button in the Workspace toolbar, click **View** > **Tabs & Sidebars** > **Toolbox**, or use the key binding for your platform (e.g. `Ctrl+Shift+L`).

The top level of the Toolbox sidebar is considered the global toolbox. This is an area for tools that are generally applicable for any file you might be working on. Tools can be grouped into folders to keep them organized.

There are also two optional toolboxes indicated by special toolbox icons in the sidebar:

- **Shared Toolbox**: A toolbox for tools shared with a group of people or otherwise accessed by other installations of Komodo. It is configured and toggled on or off in the [Shared Support](prefs.html#Shared_Support) preferences.
- **Project Toolbox**: Tools specific to a particular project, only visible when that project is active.

<a id="tools_add_rem"></a>
## Adding, Removing and Managing Tools

**To add an item to the toolbox**: Click the Tools menu button and select the type of tool you want (e.g. "**New userscript**"). A relevant dialog box will open with options for the tool. Clicking **OK** adds it the new tool at the top level of the Toolbox.

**To add an item in a specific place**: Right-click on the desired folder or toolbox, and select **Add** > **New** from the context menu.

**To remove an item**: Select it and press Delete, or right-click on it and select "Delete".

**To move tools**: Drag tools or directories between folders and toolboxes or cut/copy paste anywhere in the Toolbox sidebar.

<a id="tools_special_folders"></a>
## Special Folders - Abbreviations and Vi Commands

There are two folder names that have special behavior in Komodo:

- **Abbreviations**: Any folder named "Abbreviations" for snippets it can use with the [Abbreviations](abbreviations.html) function. See the "Samples" toolbox directory for an example.
- **Vi Commands**: Macros stored in a folder named "Vi Commands" can be run in command-line mode if [Vi emulation](vikeybind.html#vi_emulation) is enabled.

<a id="tools_behind_scenes"></a>
## Behind the Scenes - How Tools are Stored

Toolboxes are stored as special directories containing a file for each tool.

- **Global toolbox**: stored in a "tools" sub-directory of the [user data directory](trouble.html#appdata_dir).
- **Shared toolbox**: stored in a "tools" sub-directory of the path set in the [Shared Support preferences](prefs.html#Shared_Support). This will generally be on a mapped network drive or mounted network directory, but synchronizing a local copy of the directory (e.g. using source code control, rsync, or [Publishing](publish.html)) is also an option.
- **Project-specific toolboxes**: stored in a hidden ".komodotools" directory adjacent to the project file. Note: projects stored in the same directory will have a common toolbox, whether or not the base directories set in the project settings are different.

The individual tools are stored in JSON files with a ".komodotool" extension.

<a id="tools_import_export"></a>
## Importing and Exporting Tools

The toolbox menu and context menu have options to help with saving, importing and exporting tools and directories. Files with the ".komodotool" extension or directories containing those files can be imported, as can legacy (5.2 and previous) Komodo toolbox files in ".kpf" format.

Toolboxes can also be exported as standard zip archives using "**Export as Zip File**".

## Related information

- [Feature showcase: Create a custom toolbar](/tutorial/tourlet_custtoolbar.html)
- [Feature showcase: Assign a custom keybinding](/tutorial/tourlet_keybinding.html) to a component
