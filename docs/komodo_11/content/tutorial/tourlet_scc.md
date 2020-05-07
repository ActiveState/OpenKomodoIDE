---
title: Feature Showcase - Using Source Code Control
---

Komodo has integration features for several Source Code Control systems:

  - Git
  - Mercurial
  - Subversion
  - Perforce
  - CVS
  - Bazaar

This feature showcase uses Git as the example.

1. Select **Edit** > **Preferences** (macOS: **Komodo** > **Preferences**) and check the [Git configuration](/manual/prefs.html). If the svn executable is in your PATH, you should not have to change anything.                                                                         
    ![Git preferences](/images/tourlet_git_pref.png)  

1. You can right click on a file in a project for a context menu with common Git commands.
    ![Context menu for Git](/images/tourlet_git_context.png)  

1. You can use the buttons in the SCC toolbar.                                                     
    ![Git Toolbar](/images/tourlet_git_toolbar.png)

1. The History button will show a list of file revisions.                                           
    ![Revision history](/images/tourlet_git_history.png)

1. Clicking "Diff with local copy" in the History dialog box will show the differences between the selected revision and the current local copy. Clicking the **Diff** button will show the differences between the file in the current editor tab and the last revision.
    ![View diff](/images/tourlet_git_diff.png)

1. The output of all Git commands is shown in the Notifications tab in the bottom pane.                  
    ![Show SCC output](/images/tourlet_git_output.png)
