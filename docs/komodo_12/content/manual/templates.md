---
title: Templates
---
Templates contain the basic structure for new files or [projects](#project_templates). For example, a Perl file template might contain the standard shebang line (`#!`), appropriate copyright statements, and `use` statements calling a standard set of modules.

Komodo includes file templates for a number of languages, and lets you create and use your own. Templates can contain [Interpolation Shortcuts](shortcuts.html) or [Tabstops](tabstops.html). They can be stored in a [project](project.html) or in the [Toolbox](toolbox.html) for quick access, and shared via the [Common Data Directory](prefs.html#Shared_Support).

<a name="templates_newmenu" id="templates_newmenu"></a>
## Creating New Files from Templates

The **New File** menu option, invoked via **File** > **New** > **New File**, or via the associated [key binding](prefs.html#Config_Key_Bindings), provides access to numerous templates for creating new files. These templates consist of standard code that is generally included in programs of the selected type. For example, the Perl template creates a file with a `.pl` extension that contains the line `use strict;`; the XSLT stylesheet template creates a file with an `.xsl` extension and an XML version and XSLT stylesheet declaration.

1. Select **New** > **File from Template** from the main menu. The list of available templates is listed below the **Go to Anything** text box.
2. Select the template to create your new file from. A new file is created in the Komodo editor with the appropriate extension using the code stored in the template.
3. Select **File** > **Save as** to save the file with a meaningful name.

When using the **New File** button on the Standard Toolbar, the template (if any) associated with the language in the [new files preferences](prefs.html#new_files) is used to create the new file.

Alternatively, templates can be stored in a [project](project.html) or the [Toolbox](toolbox.html), and can be associated with a key binding.

<a name="create_custom" id="create_custom"></a>
## Creating Custom Templates

You can create a template by opening a new or existing file in the Komodo editor, configuring all of the necessary settings in the file, and then saving the file as a template that can be reused.

1. Open a new or existing file and edit it to include only the necessary content for the template.
1. Select **Save as other** > **Template** in the main menu.
1. Enter a meaningful name for the template and click **OK**. Ensure that you save the file with an extension that allows Komodo to correctly detect the language (according to the settings configured in Komodo's [File Associations](prefs.html#File_Associations) page in the **Preferences** dialog box).

The template is added to the Toolbox. You can access it by double-clicking it in the Toolbox, or by selecting **New** > **File from Template**.

### Template directory structure

If you create a directory alongside `My Templates` with the same name as a template group that already exists in Komodo (such as `Common` or `Web`), the contents of the two directories are merged. If files of the same name exist in both directories, the file in the directory at the same level as `My Templates` is used.

For example:

```
    templates\
      My Templates\         <--directory
        MyCGI.pl            <--file in the My Templates directory
        TestSystem.tcl      <--file in the My Templates directory
        Corporate           <--shortcut/symlink to corporate templates
      Common\               <--directory
        Python.py           <--file; takes precedence over the Python.py template
        MyCGI.pl            <--file; displays in the Common folder

```

To edit an existing template, right-click the template file and select **Edit Template**.

<a name="template_variables" id="template_variables"></a>
### Using Interpolation Shortcuts in Custom Templates

[Interpolation shortcuts](shortcuts.html) can be used in templates. When a new file is generated from a template file containing interpolation shortcuts, the shortcut is converted to its relevant value.

For example, if a template file contains the interpolation shortcut `[[%date:%d/%m/%Y %H:%M:%S]]`, when a new file is created from that template, the interpolation shortcut is converted to the current date and time in the following format: `27/06/2004 11:10:21`.

Interpolation shortcuts within templates use the [bracketed syntax](shortcuts.html#basic). Refer to the [interpolation shortcut](shortcuts.html) section for a complete description of the code, syntax and usage.

<a name="project_templates" id="project_templates"></a>
## Project Templates

Project templates provide a basic framework for new projects including the folder structure used by the project. For example, if you are creating several similar projects, you could create the common folder structure, define a project template based on that structure, and then use the template to create exactly the same basic structure for each project.

### Creating a folder structure using a project template

Komodo ships with a number of predefined project templates you can use to create the required folder structure in your project. A number of web framework project templates are available for HTML, PHP, JavaScript, and Python based frameworks.

To create a new project based on a project template:

1. Select **Project** > **New Project**.
1. Enter the name and location for the project.
1. Select the language to use for the project.
1. Select the Framework to use for the project.
1. Click **Next**.
1. Select your version control options.
1. In the Template list, select the project template to use and click Next.
1. The new project will be created based on the selected project template. When this process is complete, click **Open Project**.

To use a project template with an existing project:

1. Select **Project** > **Open Project**.
1. Right-click the folder or subfolder where you want to copy the project template directory structure and select **New Folder from Template**.
1. Select the project template to extract to the selected location.
1. Verify that you are unpacking the project template contents in the correct folder and click **OK**.

### Creating a project template from a folder

You can create a project template to replicate the folder structure of an existing project to use in future projects.

1. Open a Komodo project and create, or select, the folder structure you want for your project template.
1. Right-click the folder and select **New Template from this Folder**.
1. Enter the name for the project template and click **OK**.

To create a new project from a project template, click **Project** > **New From Template** and choose from one of the available templates.

To save any project as a template, click **Project** > **New From Template** > **Create Template From Project** and select a location to save the template (e.g. the My Templates directory).

Komodo ships with project templates for, Ruby on Rails, Komodo Extensions, and Firefox Extensions.

<a name="templates_projtool" id="templates_projtool"></a>
## Storing Templates in a Toolbox

To store a template in a [Toolbox](toolbox.html), save the template as described above, select **Add** > **New Template** from the Toolbox drop-down menu or context menu, and choose your new template from the category you saved it in (e.g. My Templates).

<a name="templates_options" id="templates_options"></a>
### Template Options

Right-click a template to access the following options:

- **Use Template**: Use this option to create a new file from the selected template.
- **Cut/Copy/Paste**: Used to duplicate or move a template when dragging is not convenient (e.g. to a project which is currently closed).
- **Show in File Manager**: Shows the JSON file for the template in the system's default file manager.
- **Export as Zip File**: Exports the template in a standard ".zip" archive.
- **Rename**: Changes the template name.
- **Delete**: Permanently removes the selected template from the toolbox.
