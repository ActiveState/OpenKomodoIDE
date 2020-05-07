---
title: Configuring SSH Support for CVS and Subversion
---

Tunneling your CVS or Subversion connections over SSH can provide an added level of security for your repository access. CVS and Subversion use very similar methods for tunneling over an SSH connection. On Windows, download and install Putty or Cygwin to provide SSH support. Linux and OS X distributions typically include SSH support.

This is a basic guideline for configuring CVS and Subversion to use SSH, however, because server configurations can vary, you should consult the documentation for the control system you are using, or request help from you system administrator.

The use of Pageant (on Windows) or ssh-agent (OS X and Linux) with Komodo is strongly recommended.

<a name="config_putty_install" id="config_putty_install"></a>
#### Installing and Configuring Putty on Windows

Putty is a free SSH, Telnet and Rlogin client for Windows.

**1\. Install Putty**

Download Putty (version 0.52 or greater) and associated programs from:

[http://www.chiark.greenend.org.uk/~sgtatham/putty/](http://www.chiark.greenend.org.uk/~sgtatham/putty/)

To connect to a server via SSH, the following programs are required:

- `putty.exe`
- `puttygen.exe`
- `pageant.exe`
- `pscp.exe`
- `plink.exe`

Ensure that the directory where Putty is installed is specified in your system's `PATH` environment variable.

**2. Generate the Putty Key**

Run the `puttygen` utility. Configure as follows:

1.  **Set Parameters**: Select either "SSH2 RSA" or "SSH2 DSA".
1.  **Generate Key Pair**: Click the **Generate** button to generate the key pair. While the key is being generated, move the mouse pointer around the blank space to provide key randomness.
1.  **Enter Key Passphrase**: Enter and confirm a passphrase for the key. Remember the passphrase - it is required later.
1.  **Save Public Key**: Click the **Save public key** button and store the key in a file called _public1.key_.
1.  **Save Private Key**: Click the **Save private key** button and store the key in a file called _private1.key_, in the same directory as the public key.  
     **Note**: The extension _.ppk_ will be appended to the name specified (i.e. _private1.key.ppk_).
1.  **Copy Key Contents**: Copy the contents of the public key field (at the top of the dialog box) to a file named _public1-openssh.key_. This key is required later.
1.  **Close puttygen**

**3\. Load and Configure the Putty Authentication Agent**

Run the `pageant` program. This loads the Putty Authentication Agent into the Windows System Tray.

Right-click the Pageant icon in the Windows System Tray. Select **Add Key**. Navigate to the directory where you saved the public and private keys in the previous step, and select the file `private1.key.ppk`.

**4\. Configure Putty To Use Pageant**

Run the `putty` program. Configure as follows:

1.  **Specify Server**: On the **Session** page of the Configuration form, enter the host name or IP address of the server.
1.  **Specify Protocol**: On the **Session** page, in the **Protocol** field, select the "SSH" protocol.
1.  **Create Saved Session**: In the **Saved Sessions** field, enter the host name again. Click the **Save** button.
1.  **Configure Connection**: on the **Connection** page of the Configuration form, enter your username for the server in the **Auto-login username** field.
1.  **Configure SSH Protocol**: On the **SSH** page of the Configuration form, specify "2" for the **Preferred SSH protocol version**.
1.  **Enable Agent Forwarding**: On the **Auth** page of the Configuration form, check **Allow agent forwarding**. In the **Private key file for authentication** field, specify the path and filename of the private key created above (_private1.key_).
1.  **Save Session Information**: On the **Session** page of the Configuration form, click the **Save** button.

**5\. Store the Public Key on the Server**

You must store the public key file generated in step 2 (_public1-openssh.key_) on the CVS or Subversion server.

1.  **Open Command Prompt Window**: Type `cmd` in the Windows Run dialog box.
1.  **Copy Public Key to Server**: At the command prompt, enter:

    ```
    pscp _c:\path\to\_public1-openssh.key _username@server.com_:public1-openssh.key
    ```

    ...where _c:\path\to\public1-openssh.key_ specifies the location of the key file created in step two, and _username@server.com_ specifies your username and URL on the remote server. You are prompted to confirm the legitimacy of the host, and may be prompted to enter your password for the server.

1.  **Connect Using Putty**: If necessary, run the `putty` program. In the **Saved Sessions** field, double-click the configuration created in Step 4. This establishes a connection to the server.
1.  **Configure the Key on the Server**: After logging on to the server, enter the following commands to configure the SSH key:

    ```
    mkdir ~/.ssh
    chmod 700 .ssh
    cat ~/public1-openssh.key >> ~/.ssh/authorized_keys
    rm ~/public1-openssh.key
    chmod 600 ~/.ssh/*
    ```

1.  **Log Off and Exit Putty**: Enter `exit` to close the session of the server.

**6\. Test the Configuration**

Restart Putty. In the **Saved Sessions** field, double-click the configuration created in Step 4\. You should not be prompted to log in. If you are, the configuration failed. Review the steps above and ensure that they were completed correctly.

<a name="config_cvs_putty" id="config_cvs_putty"></a>
#### Using CVS with Putty on Windows

Use the following additional steps if you are using CVS with Komodo.

**7\. Check Out a CVS Module**

1.  **Create Local CVS Directory**: Create a directory to store a copy of the CVS repository.
1.  **Copy Files to Local Directory**: At a command prompt, enter:

    ```
    set CVS_RSH=plink
    set PLINK_PROTOCOL=ssh
    cvs -d :ext:_username@cvs.server.com_:/_repository_name_ co _cvs_module_
    ```

    ...where _username@cvs.server.com_ specifies your username on the CVS server and the URL of the CVS server, `repository_name` specifies the name of the repository on the server, and _cvs_module_ specifies the name of the module in the chosen working repository.

    Login is handled by SSH. The files are copied to the local system. These environment variables do not interfere with non-SSH repositories.

Ensure that these variables are permanently configured in your system environment (for example, by adding them to the `autoexec.bat` file or configuring them in the system properties).

**8\. Using Komodo and CVS**

Before starting Komodo, perform the following steps:

- **Set PLINK_PROTOCOL=ssh**: In the user environment, set the environment variable `PLINK_PROTOCOL` to "ssh".
- **Set CVS_RSH=plink**: In the user environment, set the environment variable `CVS_RSH` to "plink".
- **Ensure Pageant Is Running**: Run the `pageant` program to enable the authentication agent. Ensure that the `private1.key` is loaded.

    You can also execute Pageant and load the key via a batch file. For example:

```
C:\PuTTY\pageant.exe c:\path\to\private.key c:\path\to\private2.key
```

<a name="config_svn_putty" id="config_svn_putty"></a>
#### Using Subversion with Putty on Windows

Use the following additional steps if you are using Subversion with Komodo.

**7\. Check Out a Subversion Repository**

1.  **Create Local Subversion Directory**: Create a directory to store a copy of the Subversion repository.
1.  **Copy Files to Local Directory**: At a command prompt, enter:

    ```
    svn checkout svn+ssh://_svn.server.com_/_repository_path/module/_ _local_path_
    ```

    ...where _svn.server.com_ specifies the server domain name of the Subversion server, _repository_path/module_ specifies the path of the repository on the server, and _local_path_ specifies the preferred location on your local system for your copy of the repository. The _local_path_ can be ommited, in which case the local path is the last part of the repository_path.

    Login is handled by SSH. The files are copied to the local system.

Ensure that these variables are permanently configured in your system environment (for example, by adding them to the `autoexec.bat` file or configuring them in the system properties).

**8\. Using Komodo and Subversion**

Set the following environment variables in [Environment Preferences](prefs.html#Environment):

- `PLINK_PROTOCOL=ssh`
- `SVN_SSH=c:/path/to/plink.exe -batch`

Specify the full path to `plink.exe` using forward slashes "/" or escaped back slashes "\\". The `-batch` argument is used to prevent plink from prompting for user input. You can specify a specific private key by adding "`-i C:/path/to/private_keyfile`". For example:

```
SVN_SSH="c:/path/to/plink.exe" -i "c:/path/to/private_keyfile"
```

You can use the Subversion configuration file instead of setting the SVN_SSH environment variable:

```
[tunnels]
ssh = $SVN_SSH plink.exe
```

This permits configuration of different connection types. The _config_ file is located in the Subversion directory, typically inside the Application Data area of the user's profile directory (eg. C:\Documents and Settings\USERNAME\Application Data\Subversion). See the Subversion documentation for more information.

If you use "plink = $SVN_SSH plink.exe" in the tunnels section of the config file, use "svn+plink" for your checkout url rather than "svn+ssh".

Run `pageant` to enable the authentication agent. Ensure that the _private1.key_ is loaded. You can start Pageant and load the key using a batch file. For example:

```
C:\PuTTY\pageant.exe c:\path\to\private.key c:\path\to\private2.key
```

<a name="config_cvs_ssh" id="config_cvs_ssh"></a>
#### Configuring CVS with Windows/Cygwin-SSH or Linux/SSH

On all platforms, create an environment variable as follows:

```
CVS_RSH=ssh
```

CVS determines when to use SSH, depending on how you check out the modules. If you use the "cvs login" method with the "pserver" protocol, CVS does not use SSH, even if CVS_RSH=ssh is set in the environment.

On Windows, also configure the cygwin SSH Agent as follows:

1.  Open a cygwin shell.
1.  Enter `exec ssh-agent bash`.
1.  Enter `ssh-add` _/path/to/public/key_ (e.g. '`ssh-add /.ssh/id_rsa.pub`')
1.  To check out a CVS module, enter:

    ```
    cvs -d :ext:_username@cvs.server.com_:/_repository_name_ co _cvs_module_
    ```

    ...where _username@cvs.server.com_ specifies your username on the CVS server and the URL of the CVS server, _repository_name_ specifies the name of the repository on the server, and _cvs_module_ specifies the name of the module in the chosen working repository.

5.  Start Komodo within the cygwin shell as follows:

```
_/path/to/komodo_/bin/komodo
```

After completing the configuration steps above, follow these steps to open Komodo with CVS-SSH enabled:

1.  Open a cygwin shell.
1.  Enter `exec ssh-agent bash`.
1.  Enter `ssh-add` _/path/to/public/key_ (e.g. 'ssh-add ~/.ssh/id_rsa.pub')
1.  Start Komodo within the cygwin shell as follows:

```
_/path/to/_komodo/komodo.exe
```

<a name="config_svn_ssh" id="config_svn_ssh"></a>
#### Configuring Subversion with SSH on Linux or Mac OS X

Subversion determines when to use SSH depending on how you check out the modules. If you use http:// or file:/// URIs, Subversion will not use SSH.

To use subversion with SSH, do the following _before_ starting Komodo:

1.  Open a shell.
1.  Enter `exec ssh-agent bash`.
1.  Enter `ssh-add` _/path/to/public/key_ (e.g. '`ssh-add ~/.ssh/id_rsa.pub`')
1.  To check out a Subversion module, enter:

    ```
    svn checkout svn+ssh://_svn.server.com_/_repository_path/module/_ _local_path_
    ```

    ...where _svn.server.com_ specifies the server domain name of the Subversion server, _repository_path/module_ specifies the path of the repository on the server, and _local_path_ specifies the preferred location on your local system for your copy of the repository. The _local_path_ can be omitted, in which case the local path is the last part of the repository_path.

1.  Start Komodo from within the shell. Komodo inherits the environment set in the shell by ssh-agent
