---
title: Go to Anything (Commando)
---
**Go to Anything** (Commando) is primarily a keyboard driven panel that can be accessed by pressing `Ctrl+Shift+o` on Windows and Linux or `Cmd+Shift+o` on macOS. You can also access it from your toolbar by clicking the "Go To Anything" search field. It allows you to easily access various parts of Komodo and your development workflow without disrupting your thought process.

![Commando: Go to Anything](/images/commando.png)

## Scopes

A "scope" defines what you are searching for. By default you search for items in all available scopes. Note that some scopes (such as the Shell scope) are excluded from this "Search Everything" behavior due to their results being too disruptive when used out of context.

You can select a scope in various ways:

1. Select the relevant scope from the results when invoking Commando
1. Click on the scope icon to the left of your search field
1. Define a shortcut for your scope in your [key bindings](prefs.html#Config_Key_Bindings), then use this shortcut to open Commando with your scope already selected.

## Searching

To search, simply invoke Commando and start typing your search query. Scopes are designed to handle your query intelligently, in most cases you can simply type partial matches for your search query, which do not even need to be in order. For example I could search for `filename .txt mypath` and it would match `/path/to/**mypath**/folder/**filename**_1**.txt**`.

## Selecting Results

You can select results in various ways:

1.  Select them by using your keyboard arrow keys and pressing enter  
    - You can select multiple results by holding shift
1.  Press the associated ALT+Number shortcut
1.  Double click on them with your mouse

### Expanding Results

You can also "expand" some results. Expanding a result gives you the option to perform contextual actions on them, such as marking them as a Favourite. To do this simply highlight a result and press the right arrow key.

### Entering Subscopes

A subscope is a scope within a scope. For example when searching for files you can select a folder to view its contents. The folder is a subscope. To enter a subscope you simply select the result.

Once in a subscope you can navigate back to the previous scope or subscope by pressing Backspace or Escape.

### Clearing the Cache

Some of the Commando scope keep a cache of results. Although these are designed to update when necessary it is possible that a cache becomes out of sync. You can clear the cache manually by pressing the icon to the left of the search field and selecting "Clear Cache".

### Preferences

You can alter some of Commando's behaviour under [Preferences](prefs.html#prefs_top).

- **Max Results** - this allows you to limit the number of results shown at any given time, lowering this may improve performance on slower systems, at the cost of less results.
- **Search Delay** - defines how long after typing Commando should start searching. Increasing this may improve performance on slower systems, at the cost of slower results.
- **Result Render Delay** - defines how long Commando should wait before rendering results, allowing it to combine DOM writes. Increasing this may improve performance on slower systems, at the cost of slower results.
- **Max Search Depth** - defines how many folders deep Komodo should search for your query. This is primarily intended to stop Komodo from recursing into the vast depths of your filesystem.
- **Peserve Previous Search Query** - When enabled Commando will return to your last search query when you reopen it.
- **Relative paths use the current file's directory** - When searching using relative paths this will use the currently opened file as the path to search relative from. When unchecked your Project / Places path is used.
- **Default Shell Output** - Defines where to output shell commands where relevant.

## Everything Scope

The "Everything" scope allows you to, as the name implies, search for everything. Ironically it does exclude one scope; the Shell scope. This is done because the shell scope results are very disruptive when accessed out of context.

## Bookmarks Scope

The bookmarks scope allows you to easily navigate to [bookmarks](editor.html#bookmarks) within the current file.

## Commands Scope

The commands scope allows you to access all of Komodo's registered commands. Basically anything that you can add a keybinding for you can access from this scope.

## Files Scope

The files scope allows you to search for files within your currently selected project or working directory. Commando uses the directory defined in your Project preferences or otherwise falls back to the directory selected in your [Places pane](places.html#places_top).

### Searching

The file scope allows for some advanced Search functionality;

- You can search relative to the current file by typing a relative path as your search query
- You can search using an absolute path simply by typing an absolute path as your search query
- When searching using a relative or absolute path you can search recursively by adding a space between the path and your search query. If no space is present then the tail end of the path will be used as your search query for a non-recursive search.
- You can use created shortcuts by typing your shortcut name and a trailing slash

## Open Files Scope

As the name implies this scope will allow you to quickly access your opened files. It's a convenient alternative to the Open Files pane and your editor tabs.

## Sections Scope

The sections scope allows you to quickly access your file symbols. It allows you to navigate to classes, functions within files or nodes within XML/HTML files.

## Tools

The tools scope gives easy access to your [toolbox](toolbox.html#toolbox_top).

## Tools & Commands

The Tools & Commands scope combined the the Tools & Commands scopes.

## Shell Scope

The Shell scope allows you to run Shell commands on your system. It comes with built-in support for some popular shell tools, particularly [[Package Managers|Package-Manager-Integration]] and [[Docker & Vagrant|Docker-and-Vagrant-Integration]].

Invoking one of these tools will show you all their possible arguments with useful completions where relevant. For example executing `docker attach` will show you a list of running containers to choose from.

You can use the Shell scope to execute any terminal command you like, but only certain ones are auto-completed by Komodo.

### Flags

When executing commands via the shell scope you can append the following flags in order to control where and how the commands are executed:

- :ok - Open in the Komodo command output widget
- :ot - Open in a new terminal window
- :oi - Insert the result into the current editor buffer
- :on - Don't return the results at all, just run the command
- :os - Return the result in the shell output HUD dialog (this is the default)

## Packages Scope

The Packages scope allows you to manage (install, uninstall, update, ..) your installed Packages. A Package is something that customizes the way you work with Komodo, for example an Addon, Userscript, Skin, Color Scheme are all packages.

## Documentation Scope

The [Documentation browser](documentation-browser.html) allows you to reference information about Komodo's supported languages.
