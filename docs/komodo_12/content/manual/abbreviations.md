---
title: Abbreviations
---
The Abbreviations function lets you quickly insert code [snippets](snippets.html) by entering their name in the editor buffer followed by **Ctrl+T**. Several useful default snippets are included in Komodo. Additional ones can be added easily.

Komodo looks for abbreviations in a special folder in projects and toolboxes called Abbreviations. Within the Abbreviations folder are language specific sub-folders, and a General sub-folder for global snippets.

![Abbreviations Folder](/images/abbreviations.png)

<a name="abbrev_inserting"></a>
## Inserting Snippets

To insert a snippet using Abbreviations, enter the name of the snippet in the
editor buffer, press **Ctrl+Shift+O** (Cmd+Shift+O on macOS) to open Commando, and search
for and select the command `cmd_expandAbbrev`.  Komodo searches for a
snippet matching the word to the left of the cursor in Abbreviations folders,
and replaces the word with the contents of the snippet if it finds one.

For example, to insert the `divblock` snippet in an HTML file, type:

```
divblock|

```

Run `cmd_expandAbbrev` in Commando (**Ctrl+Shift+O** or **Cmd+Shift+O** on macOS):

```
<div id="default">

    </div>
```

Many of the default snippets in Komodo use [Tab Stops](tabstops.html) (highlighted
above) to make populating the snippet with your content even quicker. After
inserting the snippet, the first tab stop is selected, just start typing to
insert text in place of the marker. Use the **Tab** key to cycle through
subsequent markers.

Note that if you use any snippets on a regular basis you should consider enabling
their [Auto-Abbreviation setting](abbreviations.html#abbreviations_auto-abbreviations)
setting.  See the next section for more information on Auto-Abbreviations.

You can also add a custom key binding to the `cmd_expandAbbrev` command if you
prefer. Open the [Key Bindings preferences](prefs.html#Config_Key_Bindings) and
search "Insert Abbreviation".

<a name="auto_abbreviations"></a>
## Auto-Abbreviations

A snippet can be marked as an "auto-abbreviation" in its properties dialog. This means that when the snippet name is typed, followed by a trigger character, both the name and the trigger are replaced by the contents of the snippet.

To specify a trigger character:

1. Select **Edit** > **Preferences** (macOS: **Komodo** > **Preferences**)
1. In the list, expand the **Editor** entry and select **Smart Editing**.
1. In the **Smart Editing** page, update the **Auto-Abbreviations** settings.

See [Auto-Abbreviations](snippets.html#snippets_auto_abbreviations) for more information.

<a name="abbrev_search_order"></a>
## Abbreviation Search Order

When Ctrl+T is entered, Komodo searches for relevant snippets in the [toolbox](toolbox.html). It first checks the language-specific subdirectory of the Abbreviations folder, then the General snippets. The first match gets inserted.

Exact case matches take precedence over mismatched case. For example, "Class" would trigger a snippet named "class" if there isn't one named "Class".

This allows you to have snippets with the same names for multiple languages. For example an abbreviation called 'class' abbreviation would insert a different snippet in a Perl file than in a PHP file.

<a name="abbrev_new"></a>
## Adding New Abbreviations

To add a new abbreviation to the Toolbox, right-click on the appropriate sub-folder under **Samples/Abbreviations** and select **Add** > **New Snippet**.

To add a new abbreviation to a project, use the steps above after adding the necessary folders (i.e. at least Abbreviations/General) to the project.

As with all project and toolbox items, snippets can be copied, cut and pasted between toolboxes and projects.
