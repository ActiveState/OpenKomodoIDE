---
title: Komodo IDE Release Notes
---
These Release Notes cover [what's new](#whatsnew), [detailed changes and bug fixes](#details) and [known issues](#knownissues) for Komodo IDE and Komodo Edit.

<a name="whatsnew"></a>
## What's New in Komodo IDE 12.0.1

The following bugs have been resolved:

* Legacy: Fix ko.run.command 'file not found' error.
* Commando: Fix env overwriting when running command in shell.
* Update restart triggers crash recovery. Fixes [#3838](https://github.com/Komodo/KomodoEdit/issues/3838).
* State tool: Preference selection was saved but not being displayed on subsequent Prefence dialog opens.
* State tool: 'find on path' preference saving empty string.
* State tool: Support Two Factor Auth in state tool SDK
* State tool: Fix Komodo login dialog blocking start up when state tool fails
* Start up Wizard: State tool binary pref and install instructions wrong

## What's New in Komodo IDE 12.0

* Add ActiveState Platform integration - you can now create and manage projects with an ActiveState Platform runtime, allowing for sandboxed environments, secret, script and package management, and much more.
* Various CodeIntel improvements on Komodo Edit contributed by [ssigwart](https://github.com/ssigwart) (not relevant on IDE as it uses a newer CodeIntel version)
* Lots of SDK fixes and improvements that improve the overall stability of Komodo
* Add back in blank MRU warning, but skip when blanks allowed
* Add dataset, contentEditable, isContentEditable, dir, and hidden DOM properties.  [fixes #3115](https://github.com/Komodo/KomodoEdit/issues/3115)
* Add jump to code fold command
* Added 'Close All' action in tab context menus; [fixes #1817](https://github.com/Komodo/KomodoEdit/issues/1817)
* Allow Alt-Left/Right in commando to jump words
* Allow extra include/exclude filters in project searches
* Changed default Python from Python 2 to Python 3
* Enhanced Open Files UI so that the close button no longer overlaps
* Enhanced search ordering when searching for open files
* Re-introduced click margin to select. [fixes #3786](https://github.com/Komodo/KomodoEdit/issues/3786)
* Support JS and CSS block comment reflow
* Update fold jumping to try to keep the same level as the current line, but go to parents if that fails
* Fix login dialog failing to authenticate user.  [Fixes #3817](https://github.com/Komodo/KomodoEdit/issues/3817)
* Fix blank replacement value not being remembered.  [fixes #2437](https://github.com/Komodo/KomodoEdit/issues/2437)
* Fix bookmarks not deleting properly when lines are deleted.  [fixes #3687]((https://github.com/Komodo/KomodoEdit/issues/3687)
* Fix can't change vars in paused ruby >= 2 debug pane.  [fixes #3724](https://github.com/Komodo/KomodoEdit/issues/3724)
* Fix commando tooltip not updating; [fixes #2507](https://github.com/Komodo/KomodoEdit/issues/2507)
* Fix crash recovery not reopening the right files. [fixes #3791](https://github.com/Komodo/KomodoEdit/issues/3791)
* Fix Ctrl/Cmd + up/down jumps to top/btm of completions list. 
* Fix F1 and Help > Help fails to open help Docs.
* Fix OSX Edit installer and update bits.
* Fix environment information not properly cleaning up when closing projects
* Fix error on block select due to selection past end of line.  [fixes #3692](https://github.com/Komodo/KomodoEdit/issues/3692)
* Fix macOs dropdown menu's becoming stuck.  [fixes #3648](https://github.com/Komodo/KomodoEdit/issues/3648)
* Fix minimap sometimes not toggling properly.  [fixes #3406](https://github.com/Komodo/KomodoEdit/issues/3406)
* Fix Packages not being installed when clicking the "Open" link. [fixes #3792](https://github.com/Komodo/KomodoEdit/issues/3792)
* Fix Project Wizard Folder picker opening a file picker
* Fix project wizard not staying on top
* Fix Snippets sometimes failing to insert. [fixes #3723](https://github.com/Komodo/KomodoEdit/issues/3723)
* Fix tabbing through fields sometimes not working on Mac. [fixes #3715](https://github.com/Komodo/KomodoEdit/issues/3715)
* Fix UI twisty icons hard to see; [fixes #2391](https://github.com/Komodo/KomodoEdit/issues/2391)

Please note these changes focus on Komodo IDE, and may not all be relevant for Komodo Edit.

Also note that this only notes notable changes and is not a full changelog of any and all changes.


<a name="knownissues"></a>
## Known Issues

There are no significant known issues at this time.
