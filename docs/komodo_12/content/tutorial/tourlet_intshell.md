---
title: Feature Showcase - Using the Interactive Shell
---

(Komodo IDE only)

Press `F12` ('Command'+'Esc' on macOS) to switch between the [Editor Pane](/manual/workspace.html#Editor_Pane) and the [interactive shell](/manual/intshell.html). This showcase uses the sample program `preprocess.py`, described in the [Python tutorial](/tutorial/pythontut.html), located by default in `install dir\Komodo x.x\samples\python_tutorials`.

Before you start: Configure the [interactive shell preferences](/manual/prefs.html#int_shell) to load the Python shell by default.

The key bindings mentioned below are part of the default Windows/Linux [key binding](/manual/prefs.html#Config_Key_Bindings) scheme. If you are using Komodo for macOS, click **Help** > **List Key Bindings** to view the equivalent macOS key bindings.

1. On line 67 of `preprocess.py`, select and copy `contenttype`.                                                                              
    ![](/images/tourlet_intshell_editor.png)    

1. Press `F12` ('Command'+'Esc' on macOS) to open the shell. Enter `import` and press `Ctrl+V` to paste `contenttype`, and then press 'Enter' to load the module.            
    ![](/images/tourlet_intshell_import.png)  

1. On the new line, enter `help (`,  press `Ctrl+V` again to paste `contenttype`. and add a period.                                             

1. Press `F12` (`Command+Esc` on macOS) to switch back to the Editor Pane, and select and copy `getContentType` on the same line as `contenttype`.                                 

1. Press `F12` (`Command+Esc` on macOS) to switch back to the interactive shell. Press `Ctrl+V` to paste `getContentType`, then enter a closing parenthesis and press 'Enter'.                                                        
    ![](/images/tourlet_intshell_help.png)
