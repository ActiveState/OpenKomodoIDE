---
title: Komodo IDE Release Notes
---
These Release Notes cover [what's new](#whatsnew), [detailed changes and bug fixes](#details) and [known issues](#knownissues) for Komodo IDE and Komodo Edit.

<a name="whatsnew"></a>
## What's New in Komodo IDE

### 11.1.1

[See below](#11-1-1-1)

### 11.1.0

[See below](#11-1-0-1)

### 11.0.2

[See below](#11-0-2-1)

### 11.0.1

[See below](#11-0-1-1)

### 11.0

- **Revamped Code Intelligence**:
    Autocomplete is more robust and triggers from any position. The symbol
    browser focuses on simplicity, and you can quickly filter symbols using
    the new symbol list - all with overall faster performance. For more information, see the [Code Intelligence documentation](/manual/codeintel.html).

- **Print Debugging**:
    Is running the full debugger is a bit much, but toggling between print
    statements gets tiresome? Now you can quickly toggle print statements as
    well as easily create them, simply by clicking the editor margin. For more information, see the [Print Debugging documentation](/manual/printdebugging.html).

- **DevDocs.io Integration**:
    Highlight any word or code snippet and trigger the relevant language docs
    in DevDocs.io from inside Komodo, making the process of looking up
    documentation much simpler. It even works when you're offline.

- **Live Previewing**:
    No need to switch back and forth between your browser and editor. Now you
    can edit your HTML and markdown and test it all without leaving your IDE.
    Your preview will automatically reload whenever you edit the file - saving
    not required. For more information, see the [Live Preview documentation](/manual/livepreview.html).

- **Project/Folder/File Templates**:
    Automate your workflow with templates for Python, Go, PHP and HTML, or
    create your own. You can even link to remote zip files on GitHub to hook
    projects into Komodo. Plus, with the new Project Wizard, you can bootstrap
    new projects with your favorite templates. For more information, see the [Templates documentation](/manual/templates.html).

- **Dependency Detector**:
    Komodo automatically scans and detects third-party dependencies, giving
    you immediate insight on what works, and letting you further adjust as
    needed. Maintain control while minimizing configuration time.

- **Universal Package Manager**:
    Access your package manager with one button and run commands directly
    within the editor, with support for Python (pip), PHP (Composer), Ruby
    (Gem) and Node.js (npm and Yarn). For more information, see the [Package Manager Integration documentation](/manual/package-manager-integration.html) documentation.

- **Clipboard Manager**:
    Press shortcut key `Ctrl+Shift+V`(default keybindings) to bring up your
    last 10 clipboard entries. Convenient!

- **Auto-Formatting**:
    Auto-format a file on save, or access formatting options with a new
    sidebar button. Great for Go coding in particular. For more information, see the [Formatting source files documentation](/manual/format.html).

- **Updated Publishing**:
    Publishing with Komodo 11 is a breeze. The updated interface helps you get
    started faster and see what files will be published at a glance. For more information, see the [Publishing documentation](/manual/publish.html).

- **Other Mentionables**

 - More snippets, tutorials and userscripts for PHP (Drupal, Laravel, Wordpress)
 - Asynchronous remote files - work with remote files way faster
 - JSHint 2.9.5 linting for enhanced JavaScript (ES6) support
 - SDK availability
 - Project template for Komodo add-ons
 - User interface enhancements
 - Refreshed, comprehensive documentation
 - And more (see the changelog)

<a name="details"></a>
## Detailed Changes and Bug Fixes in Komodo IDE

Please note these changes focus on Komodo IDE, and may not all be relevant for Komodo Edit.

Also note that this only notes notable changes and is not a full changelog of any and all changes.

### 11.1.1

*   Platform: Komodo 11.1.1 is integrated with ActiveState's new platform, you can now login with your Platform Account rather than having to execute a custom license installer on your machine. For more information, see [Komodo and the ActiveState Platform](/komodo-platform-login/).
*   Debugging: Remove conflicting usuage of `async` (fixes Python 3.7+ debugging).
*   Resolve graphical artifacts with dialogs on macOS.
*   UI: Save as dialog hangs on macOS Mojave. Fixes [#3620](https://github.com/Komodo/KomodoEdit/issues/3620).
*   codeintel: Allow symbol browser to show in multiple windows - fixes [#3567](https://github.com/Komodo/KomodoEdit/issues/3567).
*   codeintel: Make goto-definition asynchronous in order to avoid timing out on large projects - fixes #3568
*   codeintel: Recognize Perl "pm" extension - fixes #3582
*   devdocs: Use HTTPS - fixes [#3572](https://github.com/Komodo/KomodoEdit/issues/3572).
*   snippets: Fixed regression with preservation of snippet indentation - fixes [#3569](https://github.com/Komodo/KomodoEdit/issues/3569).

### 11.1.0

*   Abbreviations: Not triggering in certain contexts.  Fixes [#1737](https://github.com/Komodo/KomodoEdit/issues/1737).
*   Check Config: Breaks if PATH is blank. Fixes  [#3525](https://github.com/Komodo/KomodoEdit/issues/3525).
*   Codeintel:  Prefs missing when second window opened. Fixes [#3319](https://github.com/Komodo/KomodoEdit/issues/3319).
*   Codeintel: Added fuzzy finding of completions - fixes [#928](https://github.com/Komodo/KomodoEdit/issues/928).
*   Codeintel: Added support for XUL - fixes [#3001](https://github.com/Komodo/KomodoEdit/issues/3001).
*   Codeintel: Adding Additional Directories to CodeIntel Does Prompt a Scan. Fixes [#3359](https://github.com/Komodo/KomodoEdit/issues/3359).
*   Codeintel: Consider '$' and '@' as completion characters for JS and CSS languages, respectively - fixes [#3298](hTTps://github.com/Komodo/KomodoEdit/issues/3298), [#3303](https://github.com/Komodo/KomodoEdit/issues/3303), [#3311](hTTps://github.com/Komodo/KomodoEdit/issues/3311).
*   Codeintel: CSS: Fixed '!important' value sometimes not showing in completions - fixes [#3296](https://github.com/Komodo/KomodoEdit/issues/3296).
*   Codeintel: Ensure @property-decorated Python functions are detected as methods - fixes [#3352](https://github.com/Komodo/KomodoEdit/issues/3352).
*   Codeintel: Expose 3rd party API catalogs in prefs. Fixes [#3305](https://github.com/Komodo/KomodoEdit/issues/3305).
*   Codeintel: find references: Handle non-word symbol characters properly - fixes [#3543](https://github.com/Komodo/KomodoEdit/issues/3543).
*   Codeintel: Fix calltip drawing glitch.
*   Codeintel: Fix calltips showing twice when calltips while typing are enabled.
*   CodeIntel: Fix completion queries not detected properly.
*   CodeIntel: Fix completions inserting redundant characters for legacy languages - fixes [#3445](https://github.com/Komodo/KomodoEdit/issues/3445).
*   CodeIntel: Fix completions not inserting properly when in the middle of a word - fixes [#3395](https://github.com/Komodo/KomodoEdit/issues/3395).
*   CodeIntel: Fix completions not iterable under GoLang - fixes [#3375](https://github.com/Komodo/KomodoEdit/issues/3375).
*   Codeintel: Fix completions sometimes not triggering.
*   Codeintel: Fix completions triggering too aggressively on CSS/SCSS/LESS and some other languages - fixes [#3363](hTTps://github.com/Komodo/KomodoEdit/issues/3363).
*   CodeIntel: Fix issue where Komodo was triggering stale completions - fixes [#3422](https://github.com/Komodo/KomodoEdit/issues/3422).
*   CodeIntel: Fix rescan button not working - fixes [#3391](https://github.com/Komodo/KomodoEdit/issues/3391).
*   CodeIntel: Fix stale completions being triggered - fixes [#3341](https://github.com/Komodo/KomodoEdit/issues/3341).
*   Codeintel: Fix symbolbrowser icons not aligned properly.
*   CodeIntel: Fixed "show calltips while typing" pref not being respected.
*   Codeintel: Fixed autocompletions not closing when invoking the "cancel autocompletion" command - fixes [#3466](hTTps://github.com/Komodo/KomodoEdit/issues/3466).
*   Codeintel: Fixed calltip info not showing after first calltip - fixes [#3331](https://github.com/Komodo/KomodoEdit/issues/3331).
*   Codeintel: Fixed jump to next/prev section in file scope - fixes [#3013](https://github.com/Komodo/KomodoEdit/issues/3013).
*   Codeintel: Fixed legacy Python parser to handle unicode encoding errors - fixes [#3384](https://github.com/Komodo/KomodoEdit/issues/3384).
*   Codeintel: Handle different HTML doctype declarations and use their respective stdlibs - fixes [#2774](https://github.com/Komodo/KomodoEdit/issues/2774).
*   Codeintel: Initial support for "Find References".
*   Codeintel: JavaScript: Added JSDoc completions - fixes [#3069](https://github.com/Komodo/KomodoEdit/issues/3069).
*   Codeintel: LESS: Show variable completions - fixes [#3458](https://github.com/Komodo/KomodoEdit/issues/3458).
*   Codeintel: Perl: Ensure variables assigned to functions are reflected as functions - fixes [#3425](https://github.com/Komodo/KomodoEdit/issues/3425).
*   Codeintel: Perl: Fixed failing module imports - fixes [#3117](https://github.com/Komodo/KomodoEdit/issues/3117).
*   Codeintel: Perl: Fixed nested namespace handling - fixes [#3433](https://github.com/Komodo/KomodoEdit/issues/3433).
*   Codeintel: Python: fix parsing errors by ignoring Python 3 type hints for now - fixes [#3232](https://github.com/Komodo/KomodoEdit/issues/3232).
*   Codeintel: Reduce symbolbrowser entry padding (more info on screen).
*   Codeintel: Remove "Section List" references. Fixes [#3320](https://github.com/Komodo/KomodoEdit/issues/3320).
*   Codeintel: remove filter on view change. Load prev. filter on new view. Fixes [#2970](https://github.com/Komodo/KomodoEdit/issues/2970) and [#3500](hTTps://github.com/Komodo/KomodoEdit/issues/3500).
*   Codeintel: Remove memory leak on file close.
*   Codeintel: SCSS: Fixed completion context after SCSS variable definition - fixes [#3302](https://github.com/Komodo/KomodoEdit/issues/3302).
*   Colorschemes: scheme changes still occur after change name dialog cancelled.  Fixes [#2628](https://github.com/Komodo/KomodoEdit/issues/2628).
*   Commando: Clear cache now clears cache for all scopes - fixes [#1018](https://github.com/Komodo/KomodoEdit/issues/1018).
*   Commando: Fix composer integration causing Komodo to hang - fixes [#3328](https://github.com/Komodo/KomodoEdit/issues/3328).
*   Commando: List of open files is outdated. Fixes [#1736](https://github.com/Komodo/KomodoEdit/issues/1736).
*   Completions: CSS completions trigger on ';'.  Fixes [#3506](https://github.com/Komodo/KomodoEdit/issues/3506).
*   Completions: CSS don't show completions on ','. Fixes [#3360](https://github.com/Komodo/KomodoEdit/issues/3360).
*   Completions: Golang, don't do completions on ';'. Fixes [#3517](https://github.com/Komodo/KomodoEdit/issues/3517).
*   Dialogs: Dialogs open empty on OSX. Fixes [#3475](https://github.com/Komodo/KomodoEdit/issues/3475).
*   Dynamic buttons: menupopup spans entire screen. Fixes [#3405](https://github.com/Komodo/KomodoEdit/issues/3405).
*   Dynamic toolbar: add cpanm initialize button.
*   Editor: Do not cancel XML tag editing on backspace - fixes [#2434](https://github.com/Komodo/KomodoEdit/issues/2434).
*   Editor: Fixed hang with multiple selections over variables - fixes [#3394](https://github.com/Komodo/KomodoEdit/issues/3394).
*   File Template: Add interpolation to file templates. Fixes [#2992](https://github.com/Komodo/KomodoEdit/issues/2992).
*   Find: Can't close "Floating" find results tabs. Fixes [#2152](https://github.com/Komodo/KomodoEdit/issues/2152).
*   Find: replace: Allow "replace all" in any non-binary (text) file - fixes [#467](https://github.com/Komodo/KomodoEdit/issues/467).
*   Find: Use original directory when searching again with find in files - fixes [#1154](https://github.com/Komodo/KomodoEdit/issues/1154).
*   FTPS: Unable to connect to FTPS on OSX.  Fixes [#1963](https://github.com/Komodo/KomodoEdit/issues/1963).
*   Git: commit dialog can't show diff for deleted files. Fixes [#2031](https://github.com/Komodo/KomodoEdit/issues/2031).
*   Git: missing branches in status bar. Fixes [#2533](https://github.com/Komodo/KomodoEdit/issues/2533).
*   Help:  Fix help system and tags.  Fixes [#1174](https://github.com/Komodo/KomodoEdit/issues/1174) and probably others.
*   Icons: incorrect handling of local paths. Convert paths to URIs. Fixes [#2486](https://github.com/Komodo/KomodoEdit/issues/2486).
*   Interpolation: incorrect input and name of selection intrpl. Fixes [#3415](https://github.com/Komodo/KomodoEdit/issues/3415).
*   KoDoc: Allow for languages with no file extension. Fixes [#3507](https://github.com/Komodo/KomodoEdit/issues/3507).
*   Komodo: thinks it closed improperly when asked to restart. Fixes [#3066](https://github.com/Komodo/KomodoEdit/issues/3066).
*   Lint: JavaScript: Added support for EsLint by Defman21 - fixes [#2526](https://github.com/Komodo/KomodoEdit/issues/2526).
*   Lint: JSX: Switched JSX linter from legacy jsxhint to new eslint linter - fixes [#3421](https://github.com/Komodo/KomodoEdit/issues/3421).
*   Lint: python: pyflakes: Handle unexpected indentation errors - fixes [#3015](https://github.com/Komodo/KomodoEdit/issues/3015).
*   Macro: Workaround async paste on Linux - fixes [#2372](https://github.com/Komodo/KomodoEdit/issues/2372).
*   Places: Exception thrown when New File exists already. Fixes [#2914](https://github.com/Komodo/KomodoEdit/issues/2914).
*   Prefs: Check config window pref buttons are broken. Fixes [#3522](https://github.com/Komodo/KomodoEdit/issues/3522).
*   Prefs: Don't set invalid interpreter unless user chooses to. Fixes [#2625](https://github.com/Komodo/KomodoEdit/issues/2625).
*   Prefs: Project lvl lang include paths pref blocks global even when deleted.  Fixes [#3056](https://github.com/Komodo/KomodoEdit/issues/3056).
*   Print Preview:  Print preview not working. Fixes [#3346](https://github.com/Komodo/KomodoEdit/issues/3346).
*   Printdebug: fix icon, active state, UX updates.
*   PrintDebug: some property fields not loading properly.
*   Printing: Fix printing not working.
*   Projects: Project won't load while restoring window.
*   Projects: Remove outdated Firefox project template.  Fixes [#3127](https://github.com/Komodo/KomodoEdit/issues/3127).
*   Projects: Rmv old Komodo addon template project. Fixes [#3043](https://github.com/Komodo/KomodoEdit/issues/3043).
*   ProjectWizard: Don't allow file path in project path field. Fixes [#3369](https://github.com/Komodo/KomodoEdit/issues/3369).
*   Publishing: Alert user if push fails due to connection issues. Fixes [#3224](https://github.com/Komodo/KomodoEdit/issues/3224).
*   Publishing: Allow to reload after sync. Don't force reopn of dialog. Fixes [#3515](https://github.com/Komodo/KomodoEdit/issues/3515).
*   Publishing: Dialog appears to hang on large projects. Give more feedback. Fixes [#1848](https://github.com/Komodo/KomodoEdit/issues/1848).
*   Publishing: Force action confirmation dialog cuts off text. Fixes [#3504](https://github.com/Komodo/KomodoEdit/issues/3504).
*   Publishing: Force push and Pull don't work for multiple files. Fixes [#3016](https://github.com/Komodo/KomodoEdit/issues/3016).
*   Publishing: Force Push/Pull warning msg doesn't fit in dialog box.
*   Publishing: Incorrect tooltip text for reload sync status.  Fixes [#3503](https://github.com/Komodo/KomodoEdit/issues/3503).
*   Publishing: Progress bar not working in dialog. Fixes [#3514](https://github.com/Komodo/KomodoEdit/issues/3514).
*   Refactoring: "show changes" button never enables.
*   Refactoring: breaks in JS files on anonymous functions.  Fixes [#3288](https://github.com/Komodo/KomodoEdit/issues/3288).
*   Refactoring: Fixed error raised when attempting to rename variable - fixes [#3342](https://github.com/Komodo/KomodoEdit/issues/3342).
*   Refactoring: Komodo gets stuck after diff'ing proposed changes. Fixes [#2652](https://github.com/Komodo/KomodoEdit/issues/2652).
*   Refactoring: Make renameVar more reliable with CI3. Partly Fixes [#3548](https://github.com/Komodo/KomodoEdit/issues/3548).
*   Refactoring: refactoring changes global "find" settings. Fixes # 3435.
*   Refatoring: Rename Variable not working. Fixes [#3541](https://github.com/Komodo/KomodoEdit/issues/3541).
*   Remote Files: reconnect fails with SSH key configured.  Fixes [#3535](https://github.com/Komodo/KomodoEdit/issues/3535).
*   Run: Preserve Windows '\\' path separators - fixes [#2648](https://github.com/Komodo/KomodoEdit/issues/2648).
*   Runinline: lang included directories pref ignored. Fixes [#3031](https://github.com/Komodo/KomodoEdit/issues/3031).
*   SCC: bad layout of Push dialog.  Fixes [#2296](https://github.com/Komodo/KomodoEdit/issues/2296). Fixes [#2295](hTTps://github.com/Komodo/KomodoEdit/issues/2295).
*   SCC: file context for SCC should override Places. Fixes [#2164](https://github.com/Komodo/KomodoEdit/issues/2164).
*   Scintilla: win32: Disallow handling of some deprecated WM_ and EM_ messages - fixes [#3502](https://github.com/Komodo/KomodoEdit/issues/3502).
*   Scope completions now attempt to show all possible top-level symbols as approximate matches.
*   SDK: Fix Shell docs comments and add more informative details.
*   SDK: Fix textbox value not properly being set if it's already in the DOM - fixes [#3390](https://github.com/Komodo/KomodoEdit/issues/3390).
*   SDK: return menuitem when adding item to a UI menu. Fixes [#3155](https://github.com/Komodo/KomodoEdit/issues/3155).
*   Slack Share: Allow direct msgs and msgs to groups.
*   Snippets: indentation wrong when multiline selection injected.  Fixes [#3437](https://github.com/Komodo/KomodoEdit/issues/3437).
*   Startup Wizard: Doc links open dialog behind wizard. Fixes [#3075](https://github.com/Komodo/KomodoEdit/issues/3075).
*   Symbol Browser: Scroll Code browser to scope.  Includes scroll buffer pref. Fixes [#3411](https://github.com/Komodo/KomodoEdit/issues/3411).
*   Templates:  HTML5 templates open as HTML.  Fixes [#3456](https://github.com/Komodo/KomodoEdit/issues/3456).
*   Templates: file from template from places loses language.  Fixes [#3092](https://github.com/Komodo/KomodoEdit/issues/3092).
*   Toolbar: Sidebar show/hide command has wrong desc.
*   Toolbox:  Update Abbreviations with language field.  Fixes [#3225](https://github.com/Komodo/KomodoEdit/issues/3225).
*   Toolbox: Add "General" lang to support snippet injection into any file type. Fixes [#2676](https://github.com/Komodo/KomodoEdit/issues/2676).
*   Toolbox: Convert snippet to Print Statement get wrong language.
*   Toolbox: HTML file templates empty. Fixes [#3398](https://github.com/Komodo/KomodoEdit/issues/3398).
*   Toolbox: Snippet props, prevent error when language isn't set.
*   Toolbox: update sample tool. Fixes [#3140](https://github.com/Komodo/KomodoEdit/issues/3140).
*   Toolbox: writeCleanData not writing correct wrapper for `komodo meta`.
*   Tutorials: Can't open floating tutorials. Fixes [#3494](https://github.com/Komodo/KomodoEdit/issues/3494).
*   Tutorials: using chrome close button doesn't close tutorial properly. Fixes [#3495](https://github.com/Komodo/KomodoEdit/issues/3495).
*   UI Layout: Save layout to prefs after customizing. Fixes [#1975](https://github.com/Komodo/KomodoEdit/issues/1975).
*   UI: toggle file tabs menu option state not propagating.  Fixes [#1485](https://github.com/Komodo/KomodoEdit/issues/1485).
*   Ui/Textbox: Can't set textbox to "", returns curr val.
*   Uilayout: fix error calling saveState for prefs.
*   Unit testing: Fix pytest tests not parsing properly under pytest 3.3 - fixes [#3392](https://github.com/Komodo/KomodoEdit/issues/3392).
*   Unit tests: Fix unit tests not running due to "ko undefined" error.
*   Unittests: Trouble with dots. Fixes [#3355](https://github.com/Komodo/KomodoEdit/issues/3355).
*   View: Link Views menu item isn't updating. Fixes [#3542](https://github.com/Komodo/KomodoEdit/issues/3542).
*   Views:  Files sometimes open with blank views. Fixes [#3459](https://github.com/Komodo/KomodoEdit/issues/3459).
*   Views: Extend ko/views with splitview funcs.
*   Views: Implement multiview scrolling.
*   Widgets: bootstrapped addon widgets not restoring from shutdown.
*   Widgets: Komodo sometimes hung when opening second window.
*   Widgets: Make sure widget opens in default location if floating pane load fails.
*   Widgets: restore floating pane position on reboot. Fixes [#2604](https://github.com/Komodo/KomodoEdit/issues/2604).
*   Widgets: save tab order and support placing a widget when it's added after ui restore has run. Fixes [#3179](hTTps://github.com/Komodo/KomodoEdit/issues/3179) and [#1341](https://github.com/Komodo/KomodoEdit/issues/1341).
*   Widgets: UI not restored properly after crash.
*   Workspace2: essentially merge with original workspace code.
*   Workspaces: Upgrade prefs, remove stale window prefs.
*   Xdebug: Add PHP 7.2 bits. Fixes [#3479](https://github.com/Komodo/KomodoEdit/issues/3479).


### 11.0.2

*   CodeIntel: Attempt to handle Python encoding (not decoding) errors.
*   CodeIntel: Fix completion queries not detected properly.
*   CodeIntel: Fix completions not inserting properly when in the middle of a word - fixes [#3395](https://github.com/Komodo/KomodoEdit/issues/3395).
*   CodeIntel: Fix completions not iterable under GoLang - fixes [#3375](https://github.com/Komodo/KomodoEdit/issues/3375).
*   CodeIntel: Fix completions outright failing on some PHP files - fixes [#3357](https://github.com/Komodo/KomodoEdit/issues/3357).
*   Codeintel: Fix completions sometimes not triggering.
*   CodeIntel: Fix rescan button not working - fixes [#3391](https://github.com/Komodo/KomodoEdit/issues/3391).
*   CodeIntel: Fix stale completions being triggered - fixes [#3341](https://github.com/Komodo/KomodoEdit/issues/3341).
*   Codeintel: Updated references - see description for release notes.
*   SDK: Fix textbox value not properly being set if it's already in the DOM - fixes [#3390](https://github.com/Komodo/KomodoEdit/issues/3390).
*   Tutorials: Fix badly formatted URLs
*   Unit testing: Fix pytest tests not parsing properly under pytest 3.3 - fixes [#3392](https://github.com/Komodo/KomodoEdit/issues/3392).

### 11.0.1

*   Clipboard manager: Fix caret position not updating when pasting - fixes [#3135](https://github.com/Komodo/KomodoEdit/issues/3135).
*   Clipboard Manager: Mouse click breaks manager. Fixes [#3146](https://github.com/Komodo/KomodoEdit/issues/3146).
*   CodeIntel: Added unit test for some previous commits.
*   CodeIntel: Attempt to handle non-ascii-encoded code better.
*   CodeIntel: Auto-import all applicable PHP symbols into the current scope.
*   CodeIntel: call tips while typing pref not saving.  #fixes 3175.
*   CodeIntel: CodeIntel now runs on 127.0.0.1 instead of localhost.
*   CodeIntel: Completions now properly trigger on backspace.
*   CodeIntel: Correctly handle PHP '$' variable prefixes.
*   CodeIntel: Do not give trailing '/' for NodeJS module completions if there is an 'index.js' present.
*   CodeIntel: Do not include anonymous functions in scope completions.
*   CodeIntel: Do not include HTML, CSS, and JavaScript namespaces in PHP completions.
*   CodeIntel: Do not show completions for Python class or function names.
*   CodeIntel: Do not show completions in CSS value functions like rgb().
*   CodeIntel: Do not show completions right after a ',', as it's often part of a non-call expression.
*   CodeIntel: Don't ask to restart just for looking at the pref screen - fixes [#3045](https://github.com/Komodo/KomodoEdit/issues/3045).
*   CodeIntel: Don't trigger completions on whitespace - fixes [#3040](https://github.com/Komodo/KomodoEdit/issues/3040).
*   CodeIntel: Don't truncate log when codeintel restarts - fixes [#3265](https://github.com/Komodo/KomodoEdit/issues/3265).
*   CodeIntel: Ensure attempted scope merges only happen on scopes for PHP completions.
*   CodeIntel: Ensure symbollist is always visible.
*   CodeIntel: Fix completion selection details disappearing while typing - fixes [#3051](https://github.com/Komodo/KomodoEdit/issues/3051).
*   CodeIntel: Fix completions not triggering on backspace.
*   CodeIntel: Fix completions not working on large PHP projects - fixes [#3333](https://github.com/Komodo/KomodoEdit/issues/3333).
*   CodeIntel: Fix completions showing stale entries when backspacing.
*   CodeIntel: Fix completions sometimes showing stale results - fixes [#3088](https://github.com/Komodo/KomodoEdit/issues/3088).
*   CodeIntel: Fix completions sometimes triggering when they shouldn't - fixes [#3100](https://github.com/Komodo/KomodoEdit/issues/3100).
*   CodeIntel: Fixed gotoDefinition service not handling non-scope definitions properly.
*   CodeIntel: Fix sorting of completion results - fixes [#3163](https://github.com/Komodo/KomodoEdit/issues/3163).
*   CodeIntel: Fix sorting, should be case insensitive and "private" properties should show last.
*   CodeIntel: Greatly improved the accuracy of PHP member completions.
*   CodeIntel: Handle "&amp;:" pseudo-class contexts in Less.
*   CodeIntel: Ignore "&lt;?xml" declaration at the top of any HTML files.
*   CodeIntel: Make completions case insensitive.
*   CodeIntel: PHP completion contexts should not occur when typing "&lt;?php".
*   CodeIntel: Revert "Hacking previous fix purely for Komodo 11 RC constraints.".
*   CodeIntel: Support CSS completions in HTML style="" attributes.
*   CodeIntel: The codeintel socket now runs on 127.0.0.1 instead of localhost (removes host lookup) - fixes [#3190](https://github.com/Komodo/KomodoEdit/issues/3190).
*   CodeIntel: Traits should not be linked to classes.
*   CodeIntel: Updated language router to handle PHP's '$' variable prefixing.
*   Commando: Fix composer integration causing Komodo to hang - fixes [#3328](https://github.com/Komodo/KomodoEdit/issues/3328).
*   Dependencies: binaries set to to "found" when they don't exist. Fixes [#3107](https://github.com/Komodo/KomodoEdit/issues/3107).
*   Dependencies: "Located on PATH" being set as binary. Fixes [#3139](https://github.com/Komodo/KomodoEdit/issues/3139).
*   Dependencies: Safer way of checking for user selected value.
*   Editing: Respect default language-specific indentation preference - fixes [#2828](https://github.com/Komodo/KomodoEdit/issues/2828).
*   Editor: Fixed bug cleaning line endings for lines with form-feed characters - fixes [#2285](https://github.com/Komodo/KomodoEdit/issues/2285).
*   Editor: Fix margin click triggering repeatedly (fixes track changes repositioning on click) - fixes [#3147](https://github.com/Komodo/KomodoEdit/issues/3147).
*   Editor: Fix position being offset improperly on macOS, Windows - fixes [#3123](https://github.com/Komodo/KomodoEdit/issues/3123).
*   Editor: Highlight double-clicked variables - fixes [#3187](https://github.com/Komodo/KomodoEdit/issues/3187).
*   Folder Template: Can't use if space in name or path. Fixes [#3119](https://github.com/Komodo/KomodoEdit/issues/3119).
*   FolderTemplate: Kill progress bar when no local path. Fixes [#3249](https://github.com/Komodo/KomodoEdit/issues/3249).
*   Folder Templates: Fix regression where http urls would no longer work.
*   Keybindings: Fix default binding for "jump to previous section" not working.
*   Languages: Fixed legacy section regexes for JavaScript functions - fixes [#3052](https://github.com/Komodo/KomodoEdit/issues/3052).
*   Linter: Log file operation exceptions so we actually have the requisite info to fix the issue.
*   Logging: Don't log "key event not available on some keyboard" messages - fixes [#3121](https://github.com/Komodo/KomodoEdit/issues/3121).
*   Other: Fix issue where sometimes opening a window twice would break the window - fixes [#3210](https://github.com/Komodo/KomodoEdit/issues/3210).
*   Places: Fix "Refresh Status" sometimes being disabled - fixes [#3186](https://github.com/Komodo/KomodoEdit/issues/3186).
*   Places: Fix refresh status still disabled in some cases - fixes [#3186](https://github.com/Komodo/KomodoEdit/issues/3186).
*   Preferences: Fix certain language fields loading multiple times - fixes [#3065](https://github.com/Komodo/KomodoEdit/issues/3065).
*   Preferences: Fix color scheme preferences sometimes defaulting to the wrong theme.
*   Preferences: Fix Notification categories not showing - fixes [#3246](https://github.com/Komodo/KomodoEdit/issues/3246).
*   Prefs: lang pref checkbox icons too large on retina. Fixes [#3081](https://github.com/Komodo/KomodoEdit/issues/3081).
*   Prefs: remove bad paths for executable prefs. Fixes [#3286](https://github.com/Komodo/KomodoEdit/issues/3286).
*   Prefs: Show selected exe path. Fixes [#3215](https://github.com/Komodo/KomodoEdit/issues/3215).
*   Prefs: Show selected exe path. Fixes [#3215](https://github.com/Komodo/KomodoEdit/issues/3215).
*   Prefs: Upgrade File association prefs between versions. Fixes [#3180](https://github.com/Komodo/KomodoEdit/issues/3180).
*   Preview: Don't allow invoking the preview for unsupported languages - fixes [#3134](https://github.com/Komodo/KomodoEdit/issues/3134).
*   Previewer: Update preview on any buffer edit, including copy/paste - fixes [#3150](https://github.com/Komodo/KomodoEdit/issues/3150).
*   Preview: Fix preview not available on HTML5, Angular and JSX files.
*   Printing: Fix printing not working.
*   Publishing: fix icon sizes on retina. Fixes [#3046](https://github.com/Komodo/KomodoEdit/issues/3046).
*   Scintilla: Applied upstream patch in an attempt to improve scrolling on MacOS 10.12.
*   SDK: DOM: fix once triggering more than once if an exception occurred.
*   SDK: DOM: properly detect integers when setting CSS values.
*   SDK: Fix code intel prefs not saving. Fixes [#3175](https://github.com/Komodo/KomodoEdit/issues/3175).
*   SDK: fix filepath looking at the wrong object - fixes [#3048](https://github.com/Komodo/KomodoEdit/issues/3048).
*   SDK: fix menulist elements not considering an empty string a valid value - fixes [#3264](https://github.com/Komodo/KomodoEdit/issues/3264).
*   SDK: Fix topWindow.location undefined error.
*   SDK: menulist: fix values not always being set properly.
*   SDK: Modal dialogs sitting ontop of alert dialogs. Fixes [#3249](https://github.com/Komodo/KomodoEdit/issues/3249).
*   SDK: remove unused properties of listcols and listhead.
*   Sdk: stylesheet: Fix global stylesheets not properly reloading.
*   SDK UI: Allow radio to handle boolean for selected.  Fixes [#3161](https://github.com/Komodo/KomodoEdit/issues/3161).
*   SDK: ui/menulist: only use element.value if it actually holds a value.
*   SDK: Windows: Added getWindowByName method.
*   Slack: Can't open slack share snippet in browser. Fixes [#3144](https://github.com/Komodo/KomodoEdit/issues/3144).
*   Slack: Interactive bubble not shown on success. Fixes [#3149](https://github.com/Komodo/KomodoEdit/issues/3149).
*   Startup Wizard: Add border around editor sample - fixes [#3071](https://github.com/Komodo/KomodoEdit/issues/3071).
*   Startup Wizard: binary prefs not saving. Fixes [#3165](https://github.com/Komodo/KomodoEdit/issues/3165).
*   Startup Wizard: Fix dropdown lists not getting their value defined.
*   Startup Wizard: Fix sample not updating when toggling classic mode - fixes [#3071](https://github.com/Komodo/KomodoEdit/issues/3071).
*   Toolbox: Fix some tools becoming corrupted when importing to Komodo 11 - fixes [#3220](https://github.com/Komodo/KomodoEdit/issues/3220).
*   Toolbox: Upgrade code wasn't upgrading new format tools. Fixes [#3218](https://github.com/Komodo/KomodoEdit/issues/3218).
*   UI: Don't fail loading base UI components just cause one widget doesn't exist.
*   UI: Fix color picker and pref window sized incorrectly - fixes [#3111](https://github.com/Komodo/KomodoEdit/issues/3111) [#3170](https://github.com/Komodo/KomodoEdit/issues/3170).
*   UI: Fix color scheme not applying to all UI components - fixes [#3088](https://github.com/Komodo/KomodoEdit/issues/3088).
*   UI: Fix dialogs gradually growing larger each time they're opened (Windows only) - fixes [#3049](https://github.com/Komodo/KomodoEdit/issues/3049).
*   UI: Fix maximize sometimes not working on Windows - fixes [#3199](https://github.com/Komodo/KomodoEdit/issues/3199).
*   UI: Fix some dialogs infinitely growing larger - fixes [#3266](https://github.com/Komodo/KomodoEdit/issues/3266).
*   UI: Fix startup wizard resizing at the end of the dependency scan, causing a black border on Windows.
*   UI: Remove old template UI elements that we missed - fixes [#3216](https://github.com/Komodo/KomodoEdit/issues/3216).
*   UI: Reset all window dimensions to their defaults due to a variety of window dimension issues in v11.0.0.
*   Unit tests: Fix unit tests not running due to "ko undefined" error.
*   Update doc links to new docs URL. Fixes [#3154](https://github.com/Komodo/KomodoEdit/issues/3154).
*   Update JSDoc for some of our main modules, or modules that were just outright not showing properly.
*   VCS: Fix pull with Rebase not working - fixes [#3130](https://github.com/Komodo/KomodoEdit/issues/3130).
*   Windows: Fix some windows not opening - fixes [#3330](https://github.com/Komodo/KomodoEdit/issues/3330).
*   Windows: Fix window restore failing - fixes [#3050](https://github.com/Komodo/KomodoEdit/issues/3050).

### 11.0.0

*   Added clipboard manager, allowing you to access the last 10 entries used on your clipboard.
*   Codeintel: Alert user to restart on pref change.  Fixes [#2978](https://github.com/Komodo/KomodoEdit/issues/2978).
*   Colorpicker: The color picker is now draggable on Windows - fixes [#2036](https://github.com/Komodo/KomodoEdit/issues/2036).
*   Color Scheme: Added @editor-font variable to LESS.
*   Console: fixed autocomplete popup being under some elements - fixes [#1315](https://github.com/Komodo/KomodoEdit/issues/1315) ([#2469](https://github.com/Komodo/KomodoEdit/issues/2469)).
*   Console: Show scrollbar and make sure it doesn't overlap text.
*   Dbgp: Python: Fix encoding error on non-UTF8-encoded operating systems when trying to start debugging - fixes [#2480](https://github.com/Komodo/KomodoEdit/issues/2480).
*   Debugging: Implemented print statement debugging.
*   Debugging: Fix file "unavailable for debugging" for Chrome Debugging on Windows - fixes [#2243](https://github.com/Komodo/KomodoEdit/issues/2243).
*   Dialogs (SDK): add generic open dialog. Supports arbitrary button values.
*   Docs: Komodo now integrates with devdocs.io, allowing you to quickly search devdocs.io right from your editor.
*   Docs: Removed the documentation scope, it's being succeeded by devdocs.io integration.
*   DomViewer: Removed the dom viewer, this functionality now exists within the symbol list.
*   Dynamic Toolbar: Fail gracefully when trying to get a local URI From a remote dir.
*   Editor: Auto edit delimiters now cancels sooner - fixes [#2395](https://github.com/Komodo/KomodoEdit/issues/2395).
*   Editor: Can't set breakpoints on Windows.  Fixes [#2724](https://github.com/Komodo/KomodoEdit/issues/2724).
*   Editor: Cancel matching element multi-caret when moving the caret.
*   Editor: Cancel out of automatic multi-caret sessions by pressing ESC.
*   Editor: Collapse multiple selection when selecting beyond matched delimiter - fixes [#2367](https://github.com/Komodo/KomodoEdit/issues/2367).
*   Editor: Do not restrict caret at X columns from right - fixes [#2389](https://github.com/Komodo/KomodoEdit/issues/2389).
*   Editor: fix htmlTagRelocator crash fixes [#1153](https://github.com/Komodo/KomodoEdit/issues/1153).
*   Editor: Fix matching tag editing firing on partial selections.
*   Editor: Fix position being offset improperly on macOS, Windows - fixes [#3123](https://github.com/Komodo/KomodoEdit/issues/3123).
*   Editor: Indentation detection has been simplified - fixes [#2673](https://github.com/Komodo/KomodoEdit/issues/2673).
*   Editor: Place fold margin behind the other margins (closest to code).
*   Find: Removed searching in scope from Find, this functionality will return in Komodo 11.1.
*   Folder Templates: can't download remote templates on Windows.
*   Formatters: Attempt to maintain caret position when invoking a formatter.
*   Formatting: You can now choose to format files when they are saved. A new dynamic sidebar button has been added to give quick access to formatting settings.
*   Go to Anything: Made significant improvements to the UX to make navigation more intuitive.
*   Go to Anything: Consider directory depth when sorting results - fixes [#2718](https://github.com/Komodo/KomodoEdit/issues/2718).
*   Go to Anything: files show and open in places not working. Fixes [#2973](https://github.com/Komodo/KomodoEdit/issues/2973).
*   Go to Anything: Fix files not opening if they have a space in the path - fixes [#2089](https://github.com/Komodo/KomodoEdit/issues/2089).
*   Go to Anything: Fix most relevant results not always showing in combined scope.
*   Go to Anything: Packages: Fix broken packages scope. Fixes [#2534](https://github.com/Komodo/KomodoEdit/issues/2534).
*   Go to Anything: Prioritize file matches over open files (tabs).
*   Go to Anything: Prioritize file matches over symbol matches.
*   Go to Anything: Shell Scope: add Drupal's Drush scope.
*   Go to Anything: Shell: Always sort "Run Command" on bottom if used from combined scope.
*   Commands: Fix commands failing if no file is open - fixes [#2242](https://github.com/Komodo/KomodoEdit/issues/2242).
*   Go: Don't depend on the user to open a Go file to set the Go preferences - fixes [#2418](https://github.com/Komodo/KomodoEdit/issues/2418).
*   Go: Don't validate the GOLANG path, just use what the user set - fixes [#2413](https://github.com/Komodo/KomodoEdit/issues/2413).
*   Go: Fix version parsing not working with ActiveGo - fixes [#2412](https://github.com/Komodo/KomodoEdit/issues/2412).
*   Help: Logs window breaks if while still open. Fixes [#1562](https://github.com/Komodo/KomodoEdit/issues/1562).
*   Httpinspector: New Rule dialog, fix "add", "save", "cancel" btns.
*   Icons: Fileicons have been updated to properly match their 14x14 canvas, some icons have been entirely replaced in the process.
*   Icons: The places widget now shows folder icons again, as requested by the community.
*   Interpolate: Fix Interpolate interface. Fixes [#2368](https://github.com/Komodo/KomodoEdit/issues/2368).
*   Keybindings: rmv unsupported codeintel keybindings.
*   Keybindings: update Code Browser cmd name to symbolBrowser.
*   Komodo: improper notify SDK usage.
*   Komodo: No longer import Edit profiles if found.  Fixes [#2843](https://github.com/Komodo/KomodoEdit/issues/2843).
*   Komodo's siloed Python now includes the setuptools module.
*   Kopy: Can't share on kopy.io. fixes [#2796](https://github.com/Komodo/KomodoEdit/issues/2796).
*   Linting: Don't show in notification panel - fixes [#2783](https://github.com/Komodo/KomodoEdit/issues/2783).
*   Linting: jshint updated to version 2.9.5 - fixes [#2479](https://github.com/Komodo/KomodoEdit/issues/2479) [#1890](https://github.com/Komodo/KomodoEdit/issues/1890).
*   Mozilla: Komodo now users ES6 by default.
*   Notify: debug notification id only when calling hideNotification with arguments - fixes [#2120](https://github.com/Komodo/KomodoEdit/issues/2120) ([#2172](https://github.com/Komodo/KomodoEdit/issues/2172)).
*   Packages: Can't install packages on Windows.  Fixes [#2700](https://github.com/Komodo/KomodoEdit/issues/2700).
*   Packages: You can now enable/disable addons (including system addons).
*   Performance: Significantly improved typing speed (no more slight delays) - fixes [#2423](https://github.com/Komodo/KomodoEdit/issues/2423).
*   Performance/Stability: Komodo's modules now live on the top window, preventing modules from being loaded redundantly.
*   PHP: Add PHP 7.0 &amp; 7.1 debug bits - Profiling not supported.
*   PHP: drop PHP &lt; 5.4 support.
*   Places:  Can't drag and drop folders in Places. Fixes [#2682](https://github.com/Komodo/KomodoEdit/issues/2682).
*   Places: proxy key password to main thread. Fixes [#2082](https://github.com/Komodo/KomodoEdit/issues/2082).
*   Prefs: fix Project and File prefs not loading properly.
*   Prefs: remove default doctype pref. Fixes [#2988](https://github.com/Komodo/KomodoEdit/issues/2988).
*   Prefs: Server prefs not migrated to new profile. Fixes [#2867](https://github.com/Komodo/KomodoEdit/issues/2867).
*   Preview: Added the preview feature, allowing you to preview the html/markdown code you're working on (auto-updates while typing).
*   Profiler: fix spelling mistake in Profiler.  Fixes [#2490](https://github.com/Komodo/KomodoEdit/issues/2490).
*   Project Template: Loading template has `\\` separators. Fixes [#3026](https://github.com/Komodo/KomodoEdit/issues/3026).
*   Project Wizard:  Not all templates were loading.
*   Project Wizard: Can't read progress msg. Fixes [#2961](https://github.com/Komodo/KomodoEdit/issues/2961).
*   Project Wizard: Can't use Templates. Fixes [#2996](https://github.com/Komodo/KomodoEdit/issues/2996).
*   Project Wizard: OSX new project menu not working. Fixes [#2912](https://github.com/Komodo/KomodoEdit/issues/2912).
*   Projects: Add Project Wizard for Komodo project creation.
*   Publishing: config validation way too aggressive: Fixes [#2877](https://github.com/Komodo/KomodoEdit/issues/2877).
*   Publishing: Dialog crashes if diff missing remote.  Fixes [#2608](https://github.com/Komodo/KomodoEdit/issues/2608).
*   Publishing: Label all sync columns.  Fixes [#2910](https://github.com/Komodo/KomodoEdit/issues/2910).
*   Publishing: Publishing dialog overhaul of UX.
*   Publishing: publishing UI state takes too long to update.
*   Remote File: don't hang when return focus to Komodo. Fixes [#70](https://github.com/Komodo/KomodoEdit/issues/70).
*   SCC: Fix commit dialog committing all files after "max files" was reached - fixes [#2293](https://github.com/Komodo/KomodoEdit/issues/2293).
*   SCC: History: Don't limit results when searching.
*   SDK: Add require.resolve method.
*   SDK: can't create folder select dialog. Fixes [#2840](https://github.com/Komodo/KomodoEdit/issues/2840).
*   SDK: Code intel couldn't start when Komodo installed in dir with spaces.
*   SDK: Editor: Fix scintilla positioning not considering HiDPI on Gnome - fixes [#128](https://github.com/Komodo/KomodoEdit/issues/128).
*   SDK: Editor: Position should be based on character, not column - fixes [#2351](https://github.com/Komodo/KomodoEdit/issues/2351).
*   SDK: Improved module loading performance by caching more aggressively.
*   SDK: Removing ko/wizard SDK. ko/ui/wizardpage remains.
*   SDK: Share: Move share options to a menu for diff and log windows.
*   SDK: shell: exec now does a lookup for the binary used - fixes [#2594](https://github.com/Komodo/KomodoEdit/issues/2594).
*   SDK: UI: All DOM elements added through the UI SDK now have a `._sdk` property.
*   SDK:ui: allow list item creation using strings.
*   SDK:ui:radiogroup: Support adding radio buttons dynamically.
*   Slack: 'Share on Slack' failed due to missing `attributes` obj in UI SDK element.
*   Slack: channel cache reset after 5 mins. Fixes [#2359](https://github.com/Komodo/KomodoEdit/issues/2359).
*   Slack: Couldn't open or load slack auth window.
*   Slack: dialog won't size for different font prefs fixes [#2360](https://github.com/Komodo/KomodoEdit/issues/2360).
*   Startup Wiz:  Getting Started tutorial not starting. Fixes [#2842](https://github.com/Komodo/KomodoEdit/issues/2842).
*   Startup Wizard: Add dependency configuration page.
*   Startup Wizard: broken resource links. Fixes [#2541](https://github.com/Komodo/KomodoEdit/issues/2541).
*   Startup Wizard: Dependencies scrollbar overlaps Browse button. Fixes [#2931](https://github.com/Komodo/KomodoEdit/issues/2931).
*   Startup Wizard: Let dependencies load before allow page change. Fixes [#2815](https://github.com/Komodo/KomodoEdit/issues/2815).
*   Startup Wizard: reload dependencies, don't append. Fixes [#2860](https://github.com/Komodo/KomodoEdit/issues/2860).
*   Startup Wizard: Succint, always present messaging in scanner. Fixes [#2812](https://github.com/Komodo/KomodoEdit/issues/2812).
*   Statusbar: fixed a bug when you can't open the encoding menu for files - fixes [#1747](https://github.com/Komodo/KomodoEdit/issues/1747) ([#2468](https://github.com/Komodo/KomodoEdit/issues/2468)).
*   Syntax checking: Fix syntax checking sometimes being disabled on new files for no apparent reason.
*   Templates: Remove "save project as template" legacy mechanic and remove "My Templates" folder mechanic - fixes [#2830](https://github.com/Komodo/KomodoEdit/issues/2830).
*   Toolbox: Add import Wordpress tool suite.
*   Toolbox: Add Laravel tool suite.
*   Toolbox: Can't progress through Toolbox and SCC tutorials.
*   Toolbox: Add Drupal Usercripts.
*   Toolbox: Add markdown template. Fixes [#15](https://github.com/Komodo/KomodoEdit/issues/15).
*   Toolbox: Add Rails setup tutorial.
*   Toolbox: Add templates for major languages. Fixes [#2759](https://github.com/Komodo/KomodoEdit/issues/2759).
*   Toolbox: can't get template attributes sometimes.  Fixes [#3022](https://github.com/Komodo/KomodoEdit/issues/3022).
*   Toolbox: Can't import tools with UTF-8 chars. fixes [#2754](https://github.com/Komodo/KomodoEdit/issues/2754).
*   Toolbox: cmd_expandAbbrev doesn't return all abbrevs fixes [#2384](https://github.com/Komodo/KomodoEdit/issues/2384).
*   Toolbox: Combine icon picker functionality into a single button.
*   Toolbox: Converting old tutorials does not include `logic`. Fixes [#2743](https://github.com/Komodo/KomodoEdit/issues/2743).
*   Toolbox: Don't import README.txt for templates. Fixes [#2870](https://github.com/Komodo/KomodoEdit/issues/2870).
*   Toolbox: Drag N Drop tools copies rather than moves. Fixes [#2912](https://github.com/Komodo/KomodoEdit/issues/2912).
*   Toolbox: File Templates don't support interpolation. Fixes [#2991](https://github.com/Komodo/KomodoEdit/issues/2991).
*   Toolbox: fix komodotool files saving with added content.  Fixes [#2463](https://github.com/Komodo/KomodoEdit/issues/2463).
*   Toolbox: fix sublime snippet import on Linux and OSX fixes [#2471](https://github.com/Komodo/KomodoEdit/issues/2471).
*   Toolbox: Implemented folder templates.
*   Toolbox: import fails if a parent folder already exists. fixes [#2781](https://github.com/Komodo/KomodoEdit/issues/2781).
*   Toolbox: import of file templates failing.
*   Toolbox: import Print Debug tools.  Fixes [#2760](https://github.com/Komodo/KomodoEdit/issues/2760).
*   Toolbox: Most komodo tools are now saved in a new portable clean format.
*   Toolbox: notify about tool import process.
*   Toolbox: Remove dated info for Drupal tools. Fixes [#2934](https://github.com/Komodo/KomodoEdit/issues/2934).
*   Toolbox: Tutorials are missing logic. Fixes [#2742](https://github.com/Komodo/KomodoEdit/issues/2742).
*   Toolbox: Tutorials: Tutorials can't start.  Fixes [#2708](https://github.com/Komodo/KomodoEdit/issues/2708).
*   Toolbox: typo in Laravel tools. Fixes [#2949](https://github.com/Komodo/KomodoEdit/issues/2949).
*   Toolbox: undeclared variable on snippet save: fixes [#2375](https://github.com/Komodo/KomodoEdit/issues/2375).
*   Toolbox: Upgrade: Snippets trigger on language property.
*   Toolbox: use isAutoAbbrev variable. Fixes [#2373](https://github.com/Komodo/KomodoEdit/issues/2373).
*   Trackchanges: Fix panel not hiding if share button was used.
*   Tutorials: Add Drupal setup tutorial.
*   Tutorials: EJS compilation failing. Fixes [#2892](https://github.com/Komodo/KomodoEdit/issues/2892).
*   UI: Fix black borders around dialogs on Windows.
*   UI: Fix checkboxes not showing on some lists - fixes [#2387](https://github.com/Komodo/KomodoEdit/issues/2387).
*   UI: Fix dialog sizing and odd black border around dialogs in windows - fixes [#2436](https://github.com/Komodo/KomodoEdit/issues/2436), fixes [#2445](https://github.com/Komodo/KomodoEdit/issues/2445).
*   UI: Fix language icons not showing in dropdown (regression) - fixes [#2279](https://github.com/Komodo/KomodoEdit/issues/2279).
*   UI: Fix tooltip appearing over other applications windows - fixes [#1810](https://github.com/Komodo/KomodoEdit/issues/1810).
*   UI: Give Komodo windows a colored border so they contrast well on top of other windows - fixes [#2400](https://github.com/Komodo/KomodoEdit/issues/2400).
*   UI: Increased the contrast between dark colors on the default color scheme - fixes [#1802](https://github.com/Komodo/KomodoEdit/issues/1802).
*   UI: Maintain sort order when filtering trees.
*   UI: Reduce top-padding of toolbar when maximized, fixing menu not being accessible at times.
*   UI: Reorder some of the places context menu items to be more sensible.
*   UI: Side bar sections are now colored differently.
*   UI: Update links for move Komodo sites.  Fixes [#2542](https://github.com/Komodo/KomodoEdit/issues/2542).
*   Unittest: Fix issue where pytest would not show details or errors on some items.
*   Unittest: Optimize UI performance when running lots of tests - fixes [#2364](https://github.com/Komodo/KomodoEdit/issues/2364).
*   Universal Package Manager: Package manager integrations are now accessible from the side bar.
*   Userscripts: Improve error reporting on malfunctioning userscripts.
*   UX: Added a version check window, which will notify people if a new major version of Komodo is available.
*   VCS: Fix commit widget not reloading properly - fixes [#2071](https://github.com/Komodo/KomodoEdit/issues/2071).
*   Window: dialogs don't size to content. Fixes [#2493](https://github.com/Komodo/KomodoEdit/issues/2493).
*   Windows: Associate \*.kkf &amp; \*.ksf files with Komodo. Fixes [#2607](https://github.com/Komodo/KomodoEdit/issues/2607).
*   Windows: Associate \*.ktf files with Komodo. Fixes [#2607](https://github.com/Komodo/KomodoEdit/issues/2607).


## Nightly Changelog

The [nightly releases](http://downloads.activestate.com/Komodo/nightly/) do not have a curated changelog. However you can check our [GitHub commit log](https://github.com/Komodo/KomodoEdit/commits/master) to get a sense for what has changed.

<a name="knownissues"></a>
## Known Issues

There are no significant known issues at this time.
