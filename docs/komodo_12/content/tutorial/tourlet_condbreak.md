---
title: Feature Showcase - Using Conditional Breakpoints
---

Conditional breakpoints are used to pause the debugger when specific events occur, such as when a variable equals a certain value, an exception occurs, or a function completes execution. This showcase uses an example from the Perl sample program.

1. Select **Project** > **Sample Project**.

1. Double-click `perl_sample.pl` in the Places pane.

1. Select **Debug** > **Add\Edit Breakpoint** to open the Breakpoint Properties dialog box.    
    ![](/images/tourlet_condbreak_dial.png)

1. On the **Conditional** tab, configure a breakpoint as shown. The break will occur on line 52 when the `$sum` variable is equal to $11.75.
    ![](/images/tourlet_condbreak_config.png)  

1. The breakpoint is displayed on the margin of the program file, and on the **Breakpoints** tab.
    ![](/images/tourlet_condbreak_tab.png)
    ![](/images/tourlet_condbreak_debugtab.png)

1. Run the debugger. Execution pauses on line 50, when the `$sum` variable is equal to $11.75.
    ![](/images/tourlet_condbreak_debug.png)
    ![](/images/tourlet_condbreak_breakpointstab.png)
