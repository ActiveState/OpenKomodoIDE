---
title: Feature Showcase - Google Run Command
---

You can create command shortcut to launch a Google search for the highlighted word or phrase in your preferred browser.

1. In the Editor Pane, select the word or phrase to search for.

1. Select **Tools** > **Run Command** to open the [Run Command](/manual/run.html) dialog box.

1. Configure the dialog box as shown in the screenshot. The "%(browser)" [interpolation shortcut](/manual/shortcuts.html) loads the browser configured in Komodo's [preferences](/manual/prefs.html#web); the "%W" shortcut interpolates the word under the cursor in the editor pane.

    ![Run Command](/images/tourlet_googrun_runcmd.png)


1. When you click **Run**, the Google search results for the term are displayed in the browser.
    ![](/images/tourlet_googrun_googres.png)  

1. The run command is stored in the [Toolbox](/manual/toolbox.html) for re-use. By default it is name uses the command syntax. You can right-click the name in the toolbox and rename it.        
    ![](/images/tourlet_googrun_toolbox.png)
