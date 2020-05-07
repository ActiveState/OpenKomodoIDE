---
title: Code intelligence
---

Komodo's Code Intelligence system is a set of tools that makes browsing, searching, and programming complex code easier and more accessible. The Code Intelligence system is used to drive autocomplete, calltip, and symbol browser functionality for Perl, Python, Ruby, JavaScript, Node.js, Tcl, XSLT, CSS, HTML, and XML. You can use the **Symbol Browser** to view and navigate the hierarchical code structure within a program file. For more information see, [AutoComplete and CallTips](editor.html#AutoComplete).

![Autocomplete](/images/codeintel.png)

## Language Scanners

The code intelligence system uses language scanners to scan source code of a particular language and store the symbols found in the source files in an internal database. This database of code symbols is used:

  - for code completion to show the possible code completions
  - for call tips to show the context of a function call
  - for jumping to symbol definitions when you select "Go to Definition" from the context menu in the Editor pane

![Lanugage scanners](/images/codeintel2.png)

## Symbol Browser

(Komodo IDE only)

A sidebar in the left pane that displays a hierarchical view of all code constructs (for example, import statements, classes, functions, arguments, and variables) in the selected file. In the Symbol Browser, symbols can be sorted by file order or alphabetically, and filtered. The current scope of a symbol can be located. To access the Symbol Browser, click **View** > **Tabs & Sidebars** > **Symbol Browser**. For more information, see [Symbol Browser](#codeintel_codebrowser).

Use the **Symbol Browser** to view the general program structure of all Python, Perl, PHP, Ruby, Tcl, JavaScript and Node.js source files selected in the **Editor** pane. For each source file, the **Symbol Browser** displays a tree of symbol nodes, including modules, classes, functions, interfaces, namespaces, imports and variables. In Python, instance attributes are also displayed. Each node in the tree hierarchy can be expanded to display further detail, acting as an index to your source code. Symbols can be [filtered](#codeintel_filter), and the [current scope](#codeintel_scope) of a symbol can be located automatically.

![Symbol browser](/images/sidebar_symbol.png)

Use the Symbol Browser to:

- View program structure.
- Browse from a listed namespace, command, or variable definition and jump to the actual source code where it is declared.
- Locate all variables used within a file.
- View a symbol definition signature.
- Find all defined symbols matching a pattern.

<a name="codeintel_code_browser_context" id="codeintel_code_browser_context"></a>
## Settings Menu

You can configure the following settings for the **Symbol Browser** by clicking the cog icon next to the **Filter Symbols** text box:

- **Locate current scope**: Identifies the current scope of a symbol automatically if it is in another file.
- **Show all symbols**: Shows all symbols in the file, not just the high-level symbols, such as classes.
- **Sort alphabetically**: Sorts the symbols identified in the file in alphabetical order.
- **Sort by file order**: Sorts the symbols identified in the order they appear in the file.
- **Use legacy parser**: Select this option if you want to use the parser available in previous versions of Komodo.

The cog button opens the Settings menu with the following options:

<a name="codeintel_filter" id="codeintel_filter"></a>
## Filtering Symbols

The **Filter Symbols** text box limits the Symbol Browser display to matching symbols. Enter the desired symbol name, or partial name, in the text box.
The filter supports regular expressions (Python syntax). If there is an error in the pattern, the text is highlighted and a tooltip describes the error.

![Symbol Browser Filter](/images/sidebar_symbol_filter.png)
