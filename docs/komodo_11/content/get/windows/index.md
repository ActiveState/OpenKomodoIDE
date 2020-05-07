---
title: "Installing Komodo on Windows"
---
<a name="Windows" id="Windows"></a>
<a name="System_Req_Win" id="System_Req_Win"></a>
## Prerequisites

### Hardware Requirements

- 1GHz (or faster) x86 or x86_64 processor
- 1 GB RAM
- 250 MB hard disk space
- 350 MB of temporary hard disk space during installation

### Operating System Requirements

The following platforms are officially supported. Current Critical Updates, Windows Updates, and Service Packs must be installed (see [http://windowsupdate.microsoft.com](http://windowsupdate.microsoft.com)).

- Windows 10
- Windows 8 *(but not supported as a Metro application)*
- Windows 7
- Windows Server (2008 R2 or newer)

<a name="License_Installation_Windows" id="License_Installation_Windows"></a>
## Installing the Komodo License on Windows

**NOTE** This only applies for Komodo 11.1.0 and lower. Version 11.1.1 and higher are integrated with the ActiveState Platform and do not use the license installer. For more information, see [Komodo and the ActiveState Platform](/komodo-platform-login/).

Komodo IDE comes with a 21-day trial license. To install a permanent license:

- Download the license installer from the [My Account](https://account.activestate.com/) page.
- Double-click the downloaded installer.

<a name="Upgrading_Win" id="Upgrading_Win"></a>
## Upgrading from Previous Komodo Versions

Newer versions of Komodo should not be installed in the same directory as older versions. For major release upgrades (e.g. x.0 to x+1.0) the installer will automatically put Komodo in a new directory.

For minor releases (e.g. x.0 to x.1) and patch-level releases (x.1.1 to x.1.2), use the auto-update system (**Help** > **Check for Updates**). The changes will be applied safely in the current install directory. If you need to update using an installer, completely [uninstall](#Uninstalling_Komodo_Win) the older version before installing the new one, or manually specify a different install directory during the installation process. Your Komodo preferences will be preserved because they are installed in a different directory.

<a name="Installing_Komodo_on_Windows" id="Installing_Komodo_on_Windows"></a>
## Installing Komodo on Windows

Before you start:

- If you intend to run the installation from a shared network drive, your system must have `SYSTEM` rights (or greater) to the directory from which the installation is run. Alternatively, run the installation from a local drive.

To install Komodo on Windows:

1.  Ensure you have the prerequisite hardware and software.
2.  Download the Komodo installer file.
3.  Double-click the installer file and follow the instructions.

When installation is complete, you will see an ActiveState Komodo icon on your desktop.

<a name="Command_Line_Installation_Win" id="Command_Line_Installation_Win"></a>
## Command Line Installation Options

Komodo can also be installed from the command line. For example:

```text
c:\> msiexec.exe /i Komodo-_<version>_.msi
```

Komodo's installer uses Windows Installer technology, which allows you to partially control the install from the command line. For example:

<a name="install_silent" id="install_silent"></a>
### Installing the MSI in Silent Mode

You can have the Komodo installer run with a reduced user interface. For example, the following will install silently and only open a dialog when the installation is complete.

```text
c:\> msiexec.exe /i Komodo-_<version>_.msi /qn+
```

The following will install with no dialog at all.

```text
c:\> msiexec.exe /i Komodo-_<version>_.msi /q
```

<a name="install_logging" id="install_logging"></a>
### Turning on Logging

You can generate a log of the Komodo installation with the following command:

```text
c:\> msiexec.exe /i Komodo-_<version>_.msi /L*v install.log
```
<a name="install_dir" id="install_dir"></a>
### Controlling the Install Directory

Command line options can be used to configure Komodo installation properties. The following will install Komodo to `E:\myapps\Komodo`, instead of the default location:

```text
c:\> msiexec.exe /i Komodo-_<version>_.msi INSTALLDIR=D:\myapps\Komodo
```
<a name="install_features" id="install_features"></a>
### Controlling Which Features Get Installed

Komodo is divided into a number of distinct features. In the "Customize Setup" dialog you can select which features to install. You can also do this on the command line with the ADDLOCAL property. For example, the following command will install just the core Komodo functionality (i.e. not the PyWin32 extensions or the documentation.

```text
c:\> msiexec.exe /i Komodo-_<version>_.msi ADDLOCAL=core
```

The current set of Komodo features are:

```text
core             Komodo core
env              Windows environment settings
    desktop      Desktop shortcut
    quicklaunch  Quick launch shortcut
    register     Register this as the default Komodo
docs             Documentation
```

The hierarchy denotes dependencies (i.e. to install `quicklaunch` you must install the `env`).

The **register** option puts the Komodo location in the registry so 'start komodo' works, and adds bindings for .kpz and .kpf Komodo project files.

<a name="Starting_Komodo_on_Windows" id="Starting_Komodo_on_Windows"></a>
## Starting Komodo on Windows

To start Komodo on Windows, use one of the following methods:

- Double-click the desktop icon.
- Select **Start** > **Programs** > **ActiveState Komodo** > **Komodo**.
- Add the Komodo install directory to your `PATH` environment variable, then from the command line prompt, enter `komodo`.

<a name="Uninstalling_Komodo_Win" id="Uninstalling_Komodo_Win"></a>
## Uninstalling Komodo on Windows

To uninstall Komodo, select **Start** > **Programs** > **ActiveState Komodo** > **Modify or Uninstall Komodo**.

Alternatively, use the **Add/Remove Programs** menu (accessible from the Windows Control Panel).
