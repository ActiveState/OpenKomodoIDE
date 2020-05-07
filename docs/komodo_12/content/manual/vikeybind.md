---
title: Vi Key Bindings
---
Vi emulation mimics the modal behavior of the Vi editor. The Vi scheme (and
custom schemes created with Vi emulation) require this emulation in order to
assign keystrokes to appropriate actions in the various modes.
To view the current list of Vi key bindings for your Komodo installation, including
any custom key bindings, select **Help** > **List Key Bindings** when you have enabled the Vi
scheme under keybindings ([**Edit** > **Preferences** > **Editor** > **Keybindings**](prefs.html#Config_Key_Bindings)).
Keybinding schemes and Vi emulation are modified there as well.

<a name="vi_emulation" id="vi_emulation"></a>
## Vi Emulation

Komodo emulates the following Vi modes:

- **Normal**: navigation and editing.

    When you open a file in Komodo with the Vi scheme enabled, you start off in command mode. Keystrokes in this mode control movement, deletion, cutting, pasting and other standard editing commands that are generally mapped to Ctrl and Alt key combinations in other schemes.

- **Input**: entering text.

    Hitting an "input" command key in Normal mode (i.e. '**i**' to insert, '**a**' to append, or '**o**' to open a new line and insert) puts the editor into Input mode. Keystrokes in this mode enter text. Use the 'Esc' key to exit into Normal mode.

- **Visual**: visual selection of text with navigation keystrokes.

    Similar to Vim's visual modes. Entering '**v**' enables selection by character, '**V**' enables linewise selection, and '**Ctrl**'+'**v**' enables blockwise selection. Navigation keystrokes within these modes expand and contract the selection area. Use the 'Esc' key to exit into Normal mode.

- **Command-line**: running vi/ex commands.

    In Normal mode, entering '**:**' opens a text box in the status bar at the bottom of the Komodo window for entering Vi commands. The following Vi and Vim commands have been implemented in the default Vi scheme:

    - edit
    - exit
    - help
    - next
    - previous
    - quit
    - set
    - splitview
    - undo
    - write
    - wq
    - xit
    - number `<line number>`
    - `<range>s/<search string>/<substitution>/[g|i|I]`

<a name="vi_commands" id="vi_commands"></a>
### Custom Vi Commands

To add your own Vi commands, create a [Toolbox](toolbox.html) folder named **Vi Commands**, then add [Macros](macros.html) or [Run Commands](run.html) to the folder. The macro or command is executed when you type its name in the Vi command-line text box.

Command-line arguments can be passed to Macros using the `koIViCommandDetail` XPCOM service. The IDL for this service is:

```bash
attribute long startLine;         // Start line (current line when unset)
attribute long endLine;           // End line (current line when unset)
attribute boolean forced;         // Command name ended with a "!"
attribute wstring commandName;    // Command name being run
attribute wstring leftover;       // Everything after the command
attribute wstring rawCommandString; // Raw command string as typed in
void getArguments(out unsigned long count,
                  [array, size_is(count), retval] out wstring args);
void setArguments(in unsigned long count,
                  [array, size_is(count)] in wstring args);
void clear();
```

**JavaScript sample macro**:

```javascript
var viCommandDetails = Components.classes['@activestate.com/koViCommandDetail;1'].
                                getService(Components.interfaces.koIViCommandDetail);
var count = new Object();
var args = viCommandDetails.getArguments(count);
var msg = "startLine:" + viCommandDetails.startLine + "\n" +
          "endLine:" + viCommandDetails.endLine + "\n" +
          "commandName:" + viCommandDetails.commandName + "\n" +
          "arguments:" + args + "\n" +
          "rawCommandString:" + viCommandDetails.rawCommandString;
alert(msg);
```

**Python sample macro**:

```python
from xpcom import components
viCommandDetails = components.classes['@activestate.com/koViCommandDetail;1'].getService(components.interfaces.koIViCommandDetail)
msg = [ "startLine: %d" % viCommandDetails.startLine ]
msg.append("endLine: %d" % viCommandDetails.endLine)
msg.append("commandName: %s" % viCommandDetails.commandName)
msg.append("arguments: %r" % viCommandDetails.getArguments())
msg.append("rawCommandString: %s" % viCommandDetails.rawCommandString)
print "\n".join(msg)
```
