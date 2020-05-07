---
title: History
---
The History feature lets you navigate backwards and forwards through your editing sessions. Similar to the history feature provided by a web browser, Komodo provides **Back** and **Forward** buttons, and a drop down list of recent editing positions.

<a name="history_locations" id="history_locations"></a>
## Locations

The editing history is saved as a list of locations. Each location is made up of a filename and a cursor position. There is one history session per Komodo window.

Positions are saved to the history when:

- Opening a new file
- Changing to another open file and making an edit
- Jumping to a line from the [Find Results](search.html#search_output) tab
- Using [Go To Definition](editor.html#go_to_def)
- Any other command or interaction in Komodo that jumps to a new editing position

<a name="history_navigation" id="history_navigation"></a>
## History Navigation

You can navigate the history using the **Back** and **Forward** buttons, or by selecting the desired position from the drop-down list.

**Back** and **Forward** are also available in the **Code** menu, and will display the keybindings assigned to these actions ("Editor: Go Forward" and "Editor: Go Back" in the [Key Binding preferences](prefs.html#Config_Key_Bindings)). The default keybindings are the same as those used in most browsers: 'Alt'+'Left/Right arrows' on Windows and Linux, 'Cmd' + '[' or ']' on macOS.
