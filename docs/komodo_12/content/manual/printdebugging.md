---
title: Print debugging
---

Komodo includes support for working efficiently with print statements in your code. It allows you to quickly add print statements using standardized formatting, and adds an icon next to the line number that allows you to quickly locate the print statements in a file.

1. Select the line of code, or particular section of code, you want to add the print statement to and `Ctrl+click` the margin to the left of the line number. The print statement is added to the line below the selected code.

![Print debugging](/images/print_debugging.png)

## Customizing print debug statements

You can customize the formatting of print debugging statements for individual languages by modifying the code snippet for the language.

1. Select **View** > **Tabs & Sidebars** > **Toolbox**.
1. Expand the **Print Debugging** folder.
1. Right-click the snippet you want to edit and select **Edit Snippet**.
1. Make any necessary changes and save the file. The snippets include one or more `[[%t]]` statements which copy the selected text into the print statement. 

![Toolbox print debugging toolbox](/images/toolbox_print_menu.png)
