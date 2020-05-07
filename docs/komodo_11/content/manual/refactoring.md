---
title: Refactoring
---
Komodo's refactoring facility is designed to make it easier to apply well-known operations described in refactoring catalogs such as [http://refactoring.com/](http://refactoring.com/).

Supported changes can be accessed via the **Edit** > **Refactoring** menu item or via the editor context menu **Refactoring**. You can also assign command-keys via **Edit** > **Preferences** > **Editor** > **Key Bindings**, type "Refactoring:" in the Search box to narrow the hits, and then assign key bindings to the selected command.

<a name="refactoring_commands" id="refactoring_commands"></a>
## Refactoring Commands

This section documents the current supported refactoring commands.

<a name="refactoring_rename_variable" id="refactoring_rename_variable"></a>
### Rename Variable

This command is similar to doing a [Search & Replace](search.html#search_actions), but is aware of the current scope. Additionally, the change is done interactively. Each instance of the specified variable is selected, and then Komodo uses multiple cursors to let you change all the instances concurrently. The edit action ends when the mouse is clicked, or a control, alt, or command key is pressed (except backspace), or when another window gets the focus. The standard way to end a concurrent edit action is by pressing the ESC key.

Codeintel is intended to work as well, with continuations applied to each cursor.

Undo commands should undo all concurrent edits at once.

The Notifications window states how many instances of the target variable were found, and gives the range of lines they cover.

<a name="refactoring_extract_method" id="refactoring_extract_method"></a>
### Extract Method

Select a block of text, invoke the **Extract Method**, provide a name of a method to write the text to, and Komodo will do the rest of the work, moving the code to a separate method definition before the current one, and leaving it selected to allow it to be easily moved. The location of the block is replaced with a call to the extracted method.

This operation is obviously language-dependent, and is currently implemented for Python.

This kind of refactoring move is best done in unison with unit tests, to validate that the change has introduced no changes in the working of the code. In particular, the code analysis doesn't look at loops, and can't predict that the value of a variable set in one run through a loop will be used in a subsequent one. So if you extract that kind of code to a method, you need to make sure the changed variable is returned from the new method.

Method extraction is undoable in a single step.

<a name="refactoring_rename_class_member" id="refactoring_rename_class_member"></a>
### Rename Class Member

This function is a variation of the search and replace dialog that is optimized for searching through a subdirectory of files with certain extensions. Its main difference is that it presents its results in a **Confirm Replacements** dialog box that lets you interactively select which occurrences to change, and gives you a preview of the results.

Start by clicking on an identifier in the source, right-click, choose **Refactoring**, and then choose **Rename Class Member**.

In the **Rename Class Member** dialog, specify the name to replace the original variable by. The **Directories**, **Include**, and **Exclude** fields work the same as in the **Find/Replace** dialog.

A second dialog box, **Confirm Replacements**, now lets you prevent any occurrences of the original search text from being changed. As with other Confirmation dialogs, you can press the **Show Changes** button to see what the current state of selected changes would give, **Cancel** to end the replacement, or **OK** to apply them. Also, changing the checkbox status of a header row (one with no line number) sets all children to the same value.
