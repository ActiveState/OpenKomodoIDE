---
title: Komodo user interface overview
---

![Komodo 12 workspace](/images/workspace_overview.png)

1. **Toolbar**: Displays icons for commonly used commands and can be customized. It is divided into sections including the Left toolbar, Right toolbar, and the Go to Anything (Commando) panel, which you can use to quickly access files, tools, and and other resources.
1. **Menu**: On Linux and Windows the Komodo main menu is accessed in the toolbar. On macOS the Komodo application menus are accessed from the standard macOS menu.
1. **Side Toolbar**: Displays icons for accessing a variety of developer tools including package managers, source code control, the RX (Regular Expression Toolkit, and API and language specific documentation available through the devdocs.io documentation browser.
1. **Left pane**: Displays files and projects. This pane is your file manager with the Places tab at the top and the Projects tab at the bottom. It is also used to manage database connections and collaboration with team members.
1. **Editor pane**: Displays the files you are working with in a tabbed view to allow you to quickly switch between files.
1. **Right pane**: Displays the Toolbox and Symbol browser.
1. **Bottom pane**: Displays output in a number of different tabs with specific types of information including Version Control, Command Output and application Notifications.


## Menus
<a name="Menus" id="Menus"></a>
The default drop-down menus are: **File**, **Edit**, **Code**, **Navigation**, **View**, **Debug**, **Project**, **Tools**, and **Help**. The functions accessed from each menu are described in detail in the relevant section of the User Guide. For example, the items accessed from the Debug menu are described in [Debugging Programs](debugger.html).

On **macOS**, there is also a **Komodo** menu on the far left.

## Context Menus
<a name="Context_Menus" id="Context_Menus"></a>
Komodo displays right-click context menus with options relative to the area of Komodo where the option was invoked, depending the location of the mouse pointer. Use the left mouse button to select items from context menus.

- **Menu Bar Areas and Toolbar Areas**: Options to view or hide individual toolbars and toolbar text (unavailable on macOS).
- **Projects Sidebar (Project Name)**: Options to open, save, activate, and close the projects, and to add a file to the selected project.
- **Projects Sidebar (File Name)**: Options to edit, remove or export the selected file ,and access to [source code control](scc.html#scc_commands) commands.
- **Toolbox Sidebar**: Options to work with the specified component.
- **Editor Pane (File Editing Area)**: Options to cut, copy, and paste text, to set a breakpoint, and to edit the [file properties and settings](files.html#files_settings).
- **Editor Pane (Tabs)**: Options to close the selected file and to view the file's properties and settings.
- **Bottom Pane**: The context menus available on tabs in the [Bottom Pane](#Output_Pane) (e.g. the **Debug** tab and the **Breakpoints** tab) contain subsets of Komodo's top-level menus.  

## Toolbars
<a name="Toolbars" id="Toolbars"></a>

### Main toolbar - Left and Right

The main toolbar is were you access key functionality for managing files, debugging, and managing your workspace display. You can customize these toolbars to only include icons for functionality you use often.

![Main toolbar - Left](/images/main_tool_left.png)
![Main toolbar - Right](/images/main_tool_right.png)

### Side toolbar

The side toolbar provides quick access to developer tools. The top toolbar includes things you will want quick access to as your are writing code, such assyntax checking, formatting, package managers, and version control. The bottom toolbar includes tools, such as the RX Toolkit, that you might not use quite as often, but they are located conveniently when you do need them.

![Side toolbar - Top](/images/side_tool_top.png)
![Side toolbar - Bottom](/images/side_tool_bottom.png)

To hide or show toolbars, or to hide or show button text, do one of the following:

- Select **View** > **Toolbars** > **Show Toolbars** | **Show Side Toolbar**.
- Right-click on a menu bar or toolbar, and toggle the check mark beside the pertinent option.

## Panes and Movable Widgets
<a name="moveable_widgets" id="moveable_widgets"></a>
The Editor Pane has three panes surrounding it which can be shown or hidden as required. Listed below are the default locations of sidebars and tabs, but any of these "widgets" can be moved by right clicking on its title and selecting **Move widget to** (Right Pane|Left Pane|Bottom Pane|New Floating Pane).

## Left Pane
<a name="Left_Pane" id="Left_Pane"></a>
The Left Pane of the Komodo workspace contains the **Places**, **Code** and **DOM** sidebars.

### Places
<a name="places_sidebar" id="places_sidebar"></a>
The **Places** sidebar displays a file manager and a list of recently used projects. To display it, select **View** > **Tabs & Sidebars** > **Places**, or use the associated [key binding](prefs.html#Config_Key_Bindings).

![Places sidebar](/images/places_projects.png)  

Related Topics:

- [Places](places.html)
- [Projects](project.html)
- [Managing Sidebars, Tabs and Panes](managing_ui_widgets.html)

### Database Explorer Sidebar (Komodo IDE only)
<a name="DB_Explorer_Tab" id="db_tab"></a>
The **[Database Explorer](db_explorer.html)** shows the structure and content of databases.

## Right Pane
<a name="Right_Pane" id="Right_Pane"></a>
The Right Pane of the Komodo workspace contains the [Toolbox](toolbox.html) and, optionally, a [Shared Toolbox](toolbox.html).

### Toolbox Sidebar
<a name="Toolbox_Tab" id="Toolbox_Tab"></a>
Use the **Toolbox** sidebar to manage and store Komodo components (for example, code snippets, commands, and URLs). Add items to the Toolbox, as well as to folders within the Toolbox. Items can be imported to the Toolbox and exported as Komodo project files and packages. Items added to the Toolbox are displayed with associated icons for easy identification. To display the **Toolbox** sidebar, select **View** > **Tabs & Sidebars** > **Toolbox**, or use the associated [key binding](prefs.html#Config_Key_Bindings).

![Toolbox sidebar](/images/sidebar_toolbox.png)  

Related Topics:

- [Using the Toolbox](toolbox.html)
- [Managing Tabs and Panes](#manage)

### Shared Toolbox Sidebar (Komodo IDE only)
<a name="Shared_Toolbox_Tab" id="Shared_Toolbox_Tab"></a>
A Shared Toolbox has the same functionality as the [Toolbox](#Toolbox_Tab) except that it can be shared among multiple users. For example, use a Shared Toolbox to store code snippets that are frequently used by a number of programmers. The **Toolbox** sidebar is only available if the Shared Toolbox preference has been set (select **Edit** > **Preferences** > **Shared Support**, or, on macOS, select **Komodo** > **Preferences** > **Shared Support**).

Related Topics:

- [Shared Toolboxes](toolbox.html)
- [Managing Tabs and Panes](#manage)

### Symbol Browser (Komodo IDE only)
<a name="Code_Tab" id="Code_Tab"></a>

The symbol browser provides a list of the namespaces, classes, objects, etc. in your code. It is a key part of code intelligence. For more information, see the [Code intelligence](codeintel.html).

## Editor Pane
<a name="Editor_Pane" id="Editor_Pane"></a>
The large pane in the middle of the Komodo workspace is the Editor Pane. The Editor Pane is used for editing and debugging. Each open file has a corresponding tab at the top of the Editor Pane. Change the order of the tabs by clicking and dragging tabs to the desired position. The name of the active file (that is, the file that is currently displayed in the Editor Pane) is displayed in bold text. Use the left and right arrow buttons on the right side of the tabs to scroll though open files. Use the close button "X" on the right side of the tab display to close the active file. An asterisk beside the filename indicates that the file has been changed since it was opened, and needs to be saved. If a file is under source code control, a [file status icon](scc.html#file_status) to the left of the filename indicates its current status.

![Editor pane](/images/editor_pane.png)  

Related Topics:

- [Editing Files](editor.html)
- [Managing Projects and Files](project.html)
- [Managing Tabs and Panes](#manage)

<a name="Output_Pane" id="Output_Pane"></a>
## Bottom Pane

The Bottom Pane spans the width of the Komodo workspace and displays at the bottom of the screen. The Bottom Pane contains the following tabs:

- **Breakpoints Tab**: manage [breakpoints and spawnpoints](debugger.html#breakpoints_and_spawnpoints) in the current debugging session(s)
- **Command Output Tab**: displays the results of commands run in the [Run Command](run.html#run_create) dialog box
- **Find Results Tabs**: displays the results of the **Find All**, **Find in Files** or **Replace in Files** functions
- **Test Results**: displays [Unit Testing](unittest.html) results.
- **Notifications Tab**: displays details of [source code control](scc.html) commands, code intelligence notifications, and other errors, warnings and messages.
- **Syntax Checking Status**: shows errors and warnings for [Syntax Checking](editor.html#Linting).
- **Interactive Shell Tab**: displayed when the [interactive shell](intshell.html) is launched as a stand-alone tool or from within a debugging session
- **Debug Tab**: consolidates views of the [debugger output](debugger.html#output_tab), [call stack](debugger.html#Call_Stack), [program variables](debugger.html#viewing_variables) (local and global), and [watched variables](debugger.html#Watching_Variables).

![Bottom pane](/images/bottom_pane.png)  

The Breakpoints, Test Results, Interactive Shell, and Debug tabs are only available in [Komodo IDE](https://www.activestate.com/komodo-edit).
