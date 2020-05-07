---
title: Komodo and the Perl Dev Kit
---
(Komodo IDE only)

**NOTE**: The Perl Development Kit (PDK) is a discontinued product that is not available for versions or ActivePerl newer than 5.22.

Komodo integrates with ActiveState's [Perl Dev Kit (PDK)](http://www.activestate.com/perl-dev-kit), a suite of tools for creating and deploying applications in Perl.

<a name="pdk_v6" id="pdk_v6"></a>
## Perl Dev Kit 6 and 7

Users of the Perl Dev Kit 6.x and 7.x can access PDK tools via the Tools menu (**Tools** > **Perl Dev Kit**) or the [Perl Dev Kit Toolbar](workspace.html#Toolbars). The VBScript Converter, Filter Builder and Visual Package Manager options are displayed by default. The other options (described below) are only available if a Perl file is open in the Editor Pane. Select the feature from the menu, or click the toolbar, to launch a graphical user interface for the chosen PDK tool.

- **PerlApp** - Build an executable file from Perl scripts.
- **PerlCtrl** - Build Active X controls from Perl scripts.
- **PerlNET** - Create Perl components and applications that are compliant with Microsoft's .NET Framework.
- **PerlSvc** - Convert Perl programs to Windows services.
- **PerlTray** - Write system tray applications in Perl.
- **PerlTray** - Analyze code coverage and hotspot information for your perl programs. (PDK 7)
- **Filter Builder** - Easily construct perl regular expressions and package them as filters.
- **VBScript Converter** - Convert VBScript code to its functional equivalent in Perl.

Instructions for using these tools can be found in the [Perl Dev Kit documentation](http://docs.activestate.com/pdk/).

<a name="pdk_v3-5" id="pdk_v3-5"></a>
## Perl Dev Kit 3.1 to 5.3

Integration with earlier versions of the PDK is available through an optional package installer which adds the **Build Standalone Perl Application** option to the **Tools** menu. To install this extension:

1.  Click **File** > **Open** > **File**
2.  Navigate to the `/lib/support/modules/` subdirectory of your Komodo installation.
3.  Select the `perlapp.xpi` package and click **Open**.
4.  The Software Installation dialog will appear. Click **Install** to add the extension.

To use this extension, select **Tools** > **Build Standalone Perl Application** with a Perl script open in Komodo's Editor Pane.

After configuring options using the tabs in the Build Standalone Perl Application dialog box, use the buttons at the bottom of the dialog box to:

*   **Add to Toolbox** - Once you have created a new script, click this button to add it to the [Toolbox](toolbox.html#toolbox_top) as a run command.
*   **Build** - Create a new build or overwrite an existing build.
*   **Debug** - If the Komodo debugging option is selected on the [General](#General) tab, click this button to start the debugger.

**Note:** When using the **Build Standalone Application** feature with Perl 5.8.0 on a Linux installation where the environment is set to use UTF-8, you must add the module 'utf8' on the **Modules** tab. This is the equivalent of `perlapp --add utf8`. The module is not required for Perl 5.8.1 or higher.

<a name="General" id="General"></a>
### Configuring the General Tab

The build options for the Perl Dev Kit correspond with the tools described in the documentation included with your version of Perl Dev Kit.

- **Enter the name of the script to build using the PDK** - Specify the path and filename of the source Perl script. This option is equivalent to the `-script` command-line argument.
- **Build the script using** - Select the type of output to generate.
- **Enter the name of the target executable or control** - Specify the path and name of the output file. This option is equivalent to the `-exe` command-line argument.
- **Dependencies**
    - **None** - Include all necessary files in the output file, so that it can be run on systems that do not have Perl56.dll or ActivePerl. This option is equivalent to the `-freestanding` command-line argument.
    - **Perl Dll required on target** - Reduce the size of the generated executable by excluding Perl56.dll from the output file. Target systems must have the Perl56.dll installed. This setting corresponds with the `-xclude` command-line argument.
    - **ActivePerl required on target** - Create an output file to run on systems where ActivePerl and any modules included via `use` and `require` statements are installed. This option is equivalent to the `-dependent` command-line argument.
- **Verbose build information** - Generate detailed output messages while the output file is being built. This option corresponds to the `-verbose` command-line argument.
- **Hide console (for GUI applications)** - Similar to running `wperl.exe`, this option is useful for building applications that run in the background. This setting corresponds with the PerlApp `-gui` command-line argument and is only available for the PerlApp tool.
- **Overwrite existing build** - Replace the existing build with a new build. If you attempt to overwrite a build without selecting this option, a pop-up dialog box warns that the .exe file already exists. You can then choose to overwrite the file, overwrite the file and enable the check box, or cancel the command. This option is equivalent to the `-force` command-line argument.
- **Delete temp files after each run** - Freestanding Perl applications, services and controls sometimes contain embedded DLLs that are extracted and cached in the host system's temporary directory. Select this check box to delete these files after each run. This setting corresponds with the `-clean` command-line argument.
- **Debugging** - To debug the Perl executable, control or service as it is being built, select the desired debugger from the drop-down list. If you are not using either the Komodo or PDK debugger, specify a **Hostname** and **Port** for another debugger in the fields provided.

<a name="Modules" id="Modules"></a>
### Configuring the Modules Tab

Use the **Modules** tab to add external modules to the build, and trim unwanted modules.

<a name="pdk_exmodules" id="pdk_exmodules"></a>
#### Specifying Extra Modules For Your Script

To add a module to the output program, enter the name of the module in the **Module name** field, and click **Add**. The module to be added is displayed in the list box above. Remove modules from the list box using the **Delete** and **Delete All** buttons.

This option corresponds with the `-add` command-line argument.

<a name="pdk_trimmod" id="pdk_trimmod"></a>
#### Specifying Modules to Trim from the Package

To remove an unwanted module from the build, enter the name of the module in the **Modules** field, and click **Add**. The module to be trimmed is displayed in the list box above. Remove modules from the list box using the **Delete** and **Delete All** buttons.

This option corresponds with the `-trim` command-line argument.

<a name="Files" id="Files"></a>
### Configuring the Files Tab

Use the **Files** tab to add additional files (typically data files used by the embedded program) to the output file that is extracted when the program runs.

This option corresponds with the `-bind` command-line argument.

<a name="pdk_addfiles" id="pdk_addfiles"></a>
#### Adding Files

To add a file to the output program, click **Add**. In the pop-up dialog box, enter the source location of the file on your system, and the location where the file should be extracted when the output file runs.

<a name="pdk_editingfiles" id="pdk_editingfiles"></a>
#### Editing Files

To edit a file that has been added to the output program, click **Edit**. In the dialog box, as required, alter the source location of the file on your system, and the location where the file should be extracted when the output file runs.

<a name="pdk_delfiles" id="pdk_delfiles"></a>
#### Deleting Files

To remove a file that was to be added to the output program, click the file, then click **Delete**.

<a name="Version" id="Version"></a>
### Configuring the Version Tab

Use the **Version** tab to embed version information in the output program. It corresponds to the `-info` command-line argument.

To alter any of the version options, select the desired option in the **Version field** column, and enter the desired value in the field below. This information is assembled as a version information (VERINFO) resource and displayed to users if they view the properties for the script in Windows Explorer.

<a name="Library" id="Library"></a>
### Configuring the Library Paths Tab

Use the **Library Paths** tab to add directories to your build. The options on this tab correspond with the command-line arguments `-lib` and `-blib`.

<a name="pdk_libblib" id="pdk_libblib"></a>
#### Specifying "lib" and "blib" Directories to Include

To add a lib or blib directory to include in an output file, click **Add**. In the **Browse for Folder** dialog box, select the directory path to include, and click **OK**. The path can contain multiple directories that are separated in the same way as in the PATH environment variable.

Use **Delete** and **Delete All** to remove directories that you do not want to add from the "lib" and "blib" list boxes.

<a name="Extra" id="Extra"></a>
### Configuring the Extra Tab

The **Extra** tab is for adding icon files as well as manually specifying any additional command-line arguments.

<a name="pdk_icons" id="pdk_icons"></a>
#### Specifying Icon files

To include .ico files in a build, click **Add**. From the **Add Icon** dialog box, select the icon(s) you want to add, and click **Open**. The complete path for the icon file is displayed in the **Icon File** list box.

This option is equivalent to the `-icon` command-line argument.

<a name="pdk_cmdparams" id="pdk_cmdparams"></a>
#### Specifying Additional Command Line Parameters

If you want to specify any command-line parameters in addition to those selected using the options in the Build Standalone Perl Application dialog box, enter them in the field provided.
