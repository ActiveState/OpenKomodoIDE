---
title: Places
---
Komodo has a file manager called Places, which can be opened in the left sidebar. It provides a customized view of your file system (local or remote) and file management operations such as:

- Opening a file for editing
- Adding, removing, and copying files or folders
- Drag/drop movement
- Recursive search

![Places and Projects](/images/places_projects.png)

In Komodo IDE, this sidebar also shows the SCC status of the files, if they are under source code control.

<a id="places_projects_pane"></a>
## Projects & Places

Below the Places pane is the collapsible [Projects](project.html) pane. Switching projects in this pane will change the base directory of the Places view.

<a id="places_views"></a>
## Views

![Places View](/images/places_view.png)

Places can be configured to show or hide certain files. The drop-down menu in the Places toolbar provides options to switch between:

- **Default View**: Filters commonly hidden file types.
- **Current Project View**: The view configured under Directory Import in the current project's settings.
- **View All**: All files.
- **Custom Views**: Your own configurations, by name.

The **Manage Views** option in the Places menu opens a dialog that lets you choose which files should be shown or hidden, and to save these preferences in a named View.

To specify which file types to include or exclude, use glob syntax patterns separated by semi-colons (e.g. "*;*.xml").
