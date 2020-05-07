---
title: Find & Replace
---
There are a number of ways to search for text in Komodo:

- [Fast Find (Incremental Search)](#search_incr) quickly finds text in the current buffer
- The [Find](#search_dialog) pane offers several find and replace options.
- The [Find Toolbar](#search_find_toolbar) can search the current buffer or files in a project or directory

To replace text, use the **[Find box](#search_dialog)** with the **Replace** option enabled.

Additional features are available for:

- **[Replace in Files](#search_repl_in_files)**, with **Confirm** and **Undo** options.
- **[Function Search](#search_functions)** for Perl, Python, PHP, Ruby and Tcl.
- **[Vi Mode command line](vikeybind.html#vi_emulation)** for searches and substitutions.

<a name="search_highlight" id="search_highlight"></a>
## Match Highlighting

When performing a search on the current buffer, all matching text strings will be highlighted. Press 'Esc' to clear the highlighting.

To guard against performance problems caused by slow searches, Komodo will stop highlighting matches after the timeout configured in the Find [preferences](prefs.html#Find).

<a name="search_incr" id="search_incr"></a>
## Fast Find (Incremental Search)

Use the Fast Find bar to quickly find a word or string in the file you are currently editing.

![Fast Find Toolbar](/images/fast_find.png)

- **Start an incremental search**: Use the associated [key binding](prefs.html#Config_Key_Bindings) (by default: 'Ctrl'+'F' on Windows and Linux, 'Cmd'+'F' on macOS). Start typing your search string in the Fast Find bar. As you type, the cursor moves to the first match after the current cursor position and highlights all other matches.
- **Jump to the next/previous occurrence**: Press 'Ctrl'+'I' and 'Ctrl'+'Shift'+'I' or use the arrow buttons on the Fast Find bar to move through all the matches.
- **Use a selection as your search string**: Select the text you want to use with the mouse or keyboard, then press 'Ctrl'+'F' ('Cmd'+'F').
- **Change the search string while searching**: Use 'Shift'+'Right|Left Arrow' to add or remove characters from the current selection.
- **Change case sensitivity**: Use the button to the right of the search field to toggle [case sensitivity](#search_case).
- **Change search type**: The next button toggles between plain text / fixed strings ("F"), wildcard ("*") or [regular expression](#search_regex) ("//")searches.
- **Open the Find Dialog**: If you need to open the Find Dialog (e.g. to search in a project or a set of files), click the green up arrow.
- **Cancel the search**: Press Esc.

<a name="search_dialog" id="search_dialog"></a>
## Find Pane

The Find pane box is a multi-purpose interface for finding and replacing text. It has the following options:

- **[Regex](#search_regex)**: Use [regular expressions](regex-intro.html) instead of plain text.
- **[Smart case / Match case](#search_case)**: Toggles between "Match case" (selected - case sensitive), "Match case" (deselected - case insensitive), and "Smart Case".
- **[Word](#search_word)**: Match whole words only.
- **[Multiline](#search_multiline)**: Changes the "Find what:" field to a multi-line field, allowing you to insert blocks of text.
- **Replace**: Adds the "Replace with:" field for making substitutions.

The interface changes as different options are selected, so that you only see fields and [buttons](#search_actions) that are relevant to your task.

<a name="search_regex" id="search_regex"></a>
### Regex Searches

Selecting **[Regex](regex-intro.html#regex-intro_top)** will interpret the search string as a [Python regular expression](regex-intro.html#python_regex_syntax), and perform the search accordingly.

To the right of the "Find what:" field are two buttons which can help you compose your regular expression:

- **Regular Expression Shortcuts**: A drop list of commonly used regular expression special characters and sequences with a short description of what each one does.
- **Open in Rx Toolkit**: Opens the regular expression from the "Find what:" field in the [Rx Toolkit](regex.html), allowing you to test it before running your search. (Komodo IDE only)
When used in conjunction with **Replace**, regular expression replacement sequences can be used in the "Replace with:" field (e.g. "\1", "\g<_name_>", etc.).

<a name="search_case" id="search_case"></a>
### Case Sensitivity

The **Smart case / Match case** option is a three-way toggle:

- **Match case** (selected): Performs a case sensitive search; only exact matches are found (e.g. "myString" matches "myString" but not "mystring").
- **Match case** (deselected): Performs a case insensitive search; strings will match even if the case is different (e.g. "mystring" will match "myString").
- **Smart case** (selected): Search strings containing capital letters are automatically case sensitive. When doing "Smart case" replacements, the case of the replaced strings will follow the case of the matched text if the following conditions hold:
    - The "Regex" option is unchecked
    - The search-pattern is all lower-case
    - If the found text is all upper-case, the matched text is upper-cased
    - If the found text starts with an upper-case character, the first character of the matched text is upper-cased, but the rest of the text is left as is

    For example, a smart-case replacement of "cat" to "dog" in the text would work like the following:

            cool cat fat CAT Top Cat ==> cool dog fat DOG Top Dog

    For those writing userscripts, you would set `koIFindOptions.patternType` to `koIFindOptions.FOT_SIMPLE` and `koIFindOptions.caseSensitivity` to `koIFindOptions.FOC_SMART`

<a name="search_word" id="search_word"></a>
### Match Whole Words

With **Word** selected, search strings will only match if a whitespace occurs on either side of the string. For example, if the search string is "edit" and "Word" is selected, only occurrences of the word "edit" will be found. If it is not selected, "editing", "editor", "editorial" and "edited" could also be found.

<a name="search_multiline" id="search_multiline"></a>
### Multiline

Selecting **Multiline** changes the "Find what:" field (and the "Replace with:" field if **Replace** is selected) with larger, multiline text boxes.

This makes it easier to paste in multiline blocks of text in these fields. The search text will only match if the line breaks are the same. Line breaks in the "Replace with:" field are likewise respected.

<a name="search_scope" id="search_scope"></a>
### Scope

The "Search in:" drop list defines where the find or replace will happen. It contains the following options:

- Current document
- Selected text
- Open files
- Project (_current project_)
- Files

Selecting **Files** from this list opens additional fields allowing you to set the scope of your search in directories on your filesystem:

- **Directories**: Defines the path to the directory to start your search in. Multiple paths can be added by separating them with a semi-colon (";"). Relative paths can be specified using the path of the file in the current editor tab as the starting point (e.g. "../adjacent-dir/").
- **Search in sub-directories**: If selected, makes the search recursive. The search starts in the directory or directories specified above and descends into all sub-directories.
- **Include**: Defines the file names to include in the search or replace. Can be used to specify a partial filename or file extension with glob syntax (e.g. "*, *.txt").
- **Exclude**: As above, but defining the files and directories to _exclude_.

See also the **[Replace in Files](#search_repl_in_files)** section for a description of the **Confirm** and **Undo** options.

<a name="search_actions" id="search_actions"></a>
### Actions

Once all the options for the Find or Replace are set, choose the action you wish to perform. The action buttons available will depend on which options have been selected:

- **Find Next**: Finds consecutive occurrences of the search string in your file or selection. As matches are found, the text will be highlighted. The Find dialog box remains in focus. To keep the focus in your file, close the Find dialog box, then use the associated [key binding](prefs.html#Config_Key_Bindings).
- **Find All**: Locates all occurrences of the search string in your file or selection. The matches will be displayed in the [Find Results](#search_output) tab in the Bottom Pane.
- **Replace**: Highlights the next occurrence of the search string; if you click **Replace** again, the highlighted text will be replaced with the replacement string and the next occurrence of the search string will be highlighted.
- **Replace All**: Replaces all occurrences of the search string in the document or selection without prompting for confirmation. All replacements will be displayed on the [Find Results](#search_output) tab of the [Bottom Pane](workspace.html#Output_Pane).
- **Mark All**: Inserts a [bookmark](editor.html#bookmarks) on each line that contains the search string. To move the editing cursor to a bookmarked line, press 'F2'.

<a name="search_dialog_keys" id="search_dialog_keys"></a>
### Find Pane Keyboard Shortcuts

On Windows and Linux, keyboard shortcuts for the Find dialog are indicated by an underlined letter in the option, field and button labels. Hold down 'Alt' and press the underlined letter to toggle the option, jump to the field, or start the operation.

On macOS, these keyboard shortcuts are accessed by holding down the 'Ctrl' key, but are not indicated in the interface. They are:

- Find what: 'N'
- Replace with: 'L'
- Regex: 'X'
- Match/Smart case: 'C'
- Word: 'W'
- Multiline: 'T'
- Search in: 'I'
- Directories: 'D'
- Browse button: '.'
- Search in sub-directories: 'B'
- Include: 'U'
- Exclude: 'E'
- Find Next: 'F'
- Replace: 'R'
- Replace All: 'A'
- Show results: 'O'
- Confirm: 'M'

<a name="search_repl_in_files" id="search_repl_in_files"></a>
## Replace in Files

Globally replacing strings in multiple files can be daunting. Using a search string that matches more than what was intended, specifying an incorrect replacement string, or selecting the wrong starting directory for a recursive replacement can cause havoc.

Komodo's **Replace in Files** feature has a **Confirm** option which lets you check the substitutions before you apply them, and an **Undo** feature to revert the replacement if you make a mistake.

<a name="search_repl_confirm" id="search_repl_confirm"></a>
### Confirming Changes

When "Search in: Files" is selected, the only action button available is **Replace All**. Beneath this button is a **Confirm** check box. This option adds an additional step to the replacement process which allows you to view changes before applying them, and "un-mark" specific changes you don't want to apply.

<a name="search_confirm_dialog" id="search_confirm_dialog"></a>
#### Confirm Replacements

The Confirm Replacements dialog box shows a list of all pending replacements from the **Replace in Files** operation. Each line shows:

- A check mark (by default all are marked) indicating that the replacements in that file are marked for inclusion. Click on the check marks to toggle them on or off.
- The path and filename
- The number of replacements to be made in the file

**Show Selected Changes** previews all _selected_ changes in the list. Use 'Shift'+'Click' or 'Ctrl'+'Click' to select multiple items.

**Show Marked Changes** previews all _marked_ changes.

The preview window has the same format and options as **[Compare Files](files.html#Comparing_Files)**. The preview is in unified diff format, so it can be copied and saved as a patch.

<a name="search_repl_make_changes" id="search_repl_make_changes"></a>
#### Make Changes

Once you have confirmed that all pending replacements are correct, or un-marked the changes you do _not_ want to include, click **Make Changes**.

<a name="search_repl_undo" id="search_repl_undo"></a>
### Review and Undo

As Komodo makes the replacements, it outputs a log of the changes in a Find Results tab in the bottom pane. You can click on any of the changes to open the file in an editor tab at the appropriate line.

If you've made a mistake and would like to roll back all of the changes from the last **Replace in Files** operation, click the **Undo Replacements** button in the Find Results tab toolbar.

<a name="search_output" id="search_output"></a>
### Find Results Tabs

**Find Results** tabs are opened in the [Bottom Pane](workspace.html#Output_Pane) to display matches from **Find All**, **Find in Files** or **Replace in Files** operations.

The **Find Results** tabs display columns for:

- File: the path and filename in which the match or replacement occurred
- Line: the line number on which the match or replacement occurred
- Content: the text that was matched or replaced

Double-click on any output line to jump to the relevant file and line in an editor tab.

The **Find Results** toolbar has buttons to:

- Jump to Previous/Next Result
- Stop Search
- Undo Replacements (with Replace in Files output)
- Lock or Unlock the tab
