---
title: Starting Komodo
---
<a name="Windows_Start" id="Windows_Start"></a>
## Windows

On Windows, use one of the following methods to launch Komodo:

- Double-click the Komodo desktop icon
- Select **Start** > **Programs** > **ActiveState Komodo <version>** > **Komodo** to launch Komodo from the Windows program menu
- Right-click a file name in Windows Explorer (and other dialogs that support the standard Windows right-click context menu) and select **Edit with Komodo**

To start Komodo from a command prompt, enter:

```
    komodo [options] [filenames]
```

Multiple filenames may be specified; all specified filenames will be loaded in the Komodo editor pane.

The following command-line options are available:

- **Help**: `-h` or `--help`
- **Show Komodo version**: `-V` or `--version`
- **Open at a specified line number**: <code>-l <i>line</i></code> or <code>--line=<i>line</i></code>
- **Open with a specified range selected**: <code>-s <i>range</i></code> or <code>--selection=<i>range</i></code>  
     (e.g. `komodo -s 1,5-2,15 example.py` would open `example.py` and select from line 1 and column 5 to line 2 column 15)

<a name="OSX_Start" id="OSX_Start"></a>
## macOS

On macOS, use one of the following methods to launch Komodo:

- In the Dock, click the Komodo icon.
- In the Dock, click the "Finder" icon. In the left pane of the Finder dialog box, select **Applications**. In the right pane of the Finder, double-click the Komodo file.
- On the Finder's **Go** menu, click **Applications**. In the right pane, double-click the Komodo file.

To start Komodo from the Terminal:

- If you want to start to Komodo from the command line, it is best to first create an alias for 'komodo':

    ```
    alias komodo='open -a "Komodo IDE 11"'
    ```

- If you're using Komodo Edit, modify the command accordingly:

    ```
    alias komodo='open -a "Komodo Edit 11"'
    ```

This line can be added to your `~/.bash_profile`.

Once the alias is set, the following syntax applies:

```
komodo [options] [filenames]
```

All command line options described in the [Windows](#Windows_Start) section are available.

<a name="Linux_Start" id="Linux_Start"></a>
## Linux

To start Komodo from a shell prompt, enter:

```
komodo [options] [filenames]
```

All command line options described in the [Windows](#Windows_Start) section are available.

Desktop icons and taskbar applets are not added automatically during installation on Linux. Check your window manager documentation for information on creating these manually. A choice of Komodo icons is available. By default, the icon files (.xpm) are stored in the Komodo installation directory.
