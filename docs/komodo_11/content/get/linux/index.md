---
title: "Installing Komodo on Linux"
---
<a name="linux" id="linux"></a>
<a name="System_Req_Lin" id="System_Req_Lin"></a>
## Prerequisites

### Hardware Requirements

- 1GHz (or faster) x86 or x86_64 processor
- 1 GB RAM
- 250 MB hard disk space
- 350 MB of temporary hard disk space during installation

### Operating System Requirements

**Supported operating systems**:

The following platforms are officially supported.

- Red Hat Enterprise Linux 6 or later
- CentOS 6.0 or later
- Fedora Core 15 or later
- OpenSUSE 12.1 or later
- SuSE Linux Enterprise Desktop/Server 11.3 or later
- Ubuntu 12.04 or later

**Other operating systems**:

Komodo may also run on other Linux based systems, or older versions of the supported operating systems listed above. You will need to verify compatibility yourself, because Komodo is not tested on these other platforms, and platform-specific bugs may exist.

- Debian GNU/Linux 4.0 ("etch")
- Mandriva
- FreeBSD (with Linux binary compatibility)
- Gentoo

### Software Prerequisites on Linux

Installation Prerequisites:

- **GTK+ 2.24 (or higher)**
- **Glib 2.22** (or higher) - included in most standard Linux distributions.
- **Pango 1.14 (or higher)**
- **X.Org 1.0 (or higher)**
- **Libstdc++6**
- **gdk-pixbuf (required on come platforms like Centos 6)**
- **Gnome libraries (libgnome, libgnomeui)**

Non-ASCII Input Requirements (IME):

- **SuSE**: scim, scim-bridge-gtk and scim-bridge-qt packages.
- **Ubuntu**: scim, scim-gtk2-immodule, scim-qtimm, and scim-tables-additional packages (if not already installed).
- **Fedora Core / RHEL / CentOS**: scim, scim-gtk and scim-qtimm packages.

<a name="Adding_to_PATH" id="Adding_to_PATH"></a>
### Adding Perl or Python to the `PATH` Environment Variable

To add Perl or Python to the `PATH` environment variable, do one of the following:

- Modify your `PATH` environment variable. For example, if you use the Bash shell, add the following line to your ~/.bashrc file, where <_installdir_> points to the directory where you installed ActivePerl or ActivePython:

```text
export PATH=<installdir>/bin:$PATH
```

- Create a symbolic link to the Perl or Python executable, where <_installdir_> points to the directory where you installed ActivePerl or ActivePython.

For ActivePerl, enter:

```text
ln -s <installdir>/bin/perl /usr/local/bin/perl
```

- For ActivePython, enter:

```text
ln -s <installdir>/bin/python /usr/local/bin/python
```

<a name="License_Installation_Linux" id="License_Installation_Linux"></a>
## Installing the Komodo License on Linux

**NOTE** This only applies for Komodo 11.1.0 and lower. Version 11.1.1 and higher are integrated with the ActiveState Platform and do not use the license installer. For more information, see [Komodo and the ActiveState Platform](/komodo-platform-login/). 

Komodo IDE comes with a 21-day trial license. To install a permanent license:

- Download the license installer from the [My Account](https://account.activestate.com/) page.
- Change the permissions on the downloaded file to allow execution (e.g. ``chmod +x Komodo-<version>-<license#>.executable``)
- Run the installer (e.g. ``./Komodo_<version>_<license#>.executable``).

<a name="Upgrading_Lin" id="Upgrading_Lin"></a>
## Upgrading from Previous Komodo Versions

Newer versions of Komodo should not be installed in the same directory as older versions. For major release upgrades (e.g. x.1 to x+1.0) the installer will automatically put Komodo in a new directory.

For minor releases (e.g. x.0 to x.1) and patch-level releases (x.1.1 to x.1.2), use the auto-update system (**Help** > **Check for Updates**). The changes will be applied safely in the current install directory. If you need to update using an installer, completely [uninstall](#Uninstalling_Komodo_Lin) the older version before installing the new one, or manually specify a different install directory during the installation process. Your Komodo preferences will be preserved as they are installed in a different directory.

<a name="Installing_Komodo_on_Linux" id="Installing_Komodo_on_Linux"></a>
## Installing Komodo on Linux

This version of Komodo allows non-root installation on Linux.

To install Komodo on Linux:

1. Download the Komodo installer (`.tar.gz` file) into a convenient directory.
1. Unpack the tarball:

    ```text
    tar -xvzf Komodo-<version>-<platform>.tar.gz
    ```

1. Change to the new directory:

    ```text
    cd Komodo-<version>-<platform>
    ```

1.  Run the install script (`install.sh`):

    ```text
    ./install.sh
    ```

1.  Answer the installer prompts:
1.  Specify where you want Komodo installed, or press 'Enter' to accept the default location (`/home/<username>/Komodo-<IDE|Edit>-x.y`).The `-I` option can be used to specify the install directory. For example:

    ```text
    ./install.sh -I ~/opt/Komodo-IDE-11
    ```

If multiple users are sharing the system and will be using the same installation, install Komodo in a location every user can access (e.g. `/opt/Komodo-x.x/` or `/usr/local/Komodo-x.x/`).

**Note**:

- Each Komodo user requires their own license key.
- Do not install Komodo in a path that contains spaces or non-alphanumeric characters.
- Be sure to install Komodo into its own directory (i.e. not directly in an existing directory containing shared files and directories such as `/usr/local`).  

Once the installer has finished, add Komodo to your PATH with one of the following:

- Add _Komodo/bin_ to your PATH directly:

    ```text
    export PATH=<installdir>/bin:$PATH
    ```

- Add a symlink to _Komodo/bin/komodo_ from another directory in your PATH:

    ```text
    ln -s <installdir>/bin/komodo /usr/local/bin/komodo
    ```

**Note**: Creating symlinks in system directories such as `/usr/bin` requires root access.

After completing the installation, you can delete the temporary directory where the Komodo tarball was unpacked.

<a name="Starting_Komodo_on_Linux" id="Starting_Komodo_on_Linux"></a>
### Starting Komodo on Linux

To start Komodo on Linux enter `komodo` at the command line or create a shortcut on your desktop or in your toolbar using the full path to the `komodo` executable.

<a name="Uninstalling_Komodo_Lin" id="Uninstalling_Komodo_Lin"></a>
### Uninstalling Komodo on Linux

To uninstall Komodo on Linux:

1.  Delete the directory that Komodo created during installation.
1.  If you wish to delete your Komodo preferences, delete the `~/.komodo` directory. If you do not delete this directory, subsequent installations of Komodo will use the same preferences.

**Note**: You cannot relocate an existing Komodo installation to a new directory by simply moving it. You must uninstall Komodo from the existing location and reinstall it in the new location.
