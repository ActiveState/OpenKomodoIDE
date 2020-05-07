---
title: Interpolation Shortcuts
---
Interpolation shortcuts are codes embedded in [run commands](run.html), [snippets](snippets.html) or [templates](templates.html) that, at "execution" time, get replaced with values. For example, the path and name of the current file can be inserted via an interpolation shortcut when a run command is executed.

Interpolation shortcuts can be inserted in Run Commands using the drop-down list to the right of **Command** field in the **Add Command** and **Properties** dialog boxes, or entered manually. When using interpolation shortcuts in snippets or templates, insert the interpolation code using [bracketed syntax](#shortcuts_brack). Run commands and snippets can be stored in a [project](project.html) or the [Toolbox](toolbox.html) for frequent use.

<a name="shortcuts_all_codes" id="shortcuts_all_codes"></a>
## Interpolation Code List

The following table shows the interpolation shortcuts available in Komodo. Windows users should enclose shortcuts for files and directories in double quotes (e.g. "%F") to ensure that spaces in the file name or file path are interpreted correctly.

<table>
<tbody>
    <tr>
    <td><strong>Code</strong></td>
    <td><strong>Description</strong></td>
    </tr>
    <tr>
    <td><strong>%%</strong></td>
    <td>A literal percent sign (%) (e.g. %%PATH%% instead of %PATH% on Windows)</td>
    </tr>
    <tr>
    <td><strong>%f</strong></td>
    <td>The basename of the current file</td>
    </tr>
    <tr>
    <td><strong>%b</strong></td>
    <td>The basename of the current file without its extension</td>
    </tr>
    <tr>
    <td><strong>%F</strong></td>
    <td>The full path and name of the current file</td>
    </tr>
    <tr>
    <td><strong>%L</strong></td>
    <td>The line where the editing cursor is located within the current file</td>
    </tr>
    <tr>
    <td><strong>%d</strong></td>
    <td>The base directory of the current file</td>
    </tr>
    <tr>
    <td><strong>%D</strong></td>
    <td>The entire directory path of the current file</td>
    </tr>
    <tr>
    <td><strong>%P</strong></td>
    <td>The full path of the active (.komodoproject) project file</td>
    </tr>
    <tr>
    <td><strong>%p</strong></td>
    <td>The directory path for the active (.komodoproject) project file</td>
    </tr>
    <tr>
    <td><strong>%i</strong></td>
    <td>The active project base directory</td>
    </tr>
    <tr>
    <td><strong>%w</strong></td>
    <td>The word under the cursor in the editor</td>
    </tr>
    <tr>
    <td><strong>%W</strong></td>
    <td>URL-escaped word under cursor; replaces characters that are not valid in a query string, such as spaces and ampersands</td>
    </tr>
    <tr>
    <td><strong>%s</strong></td>
    <td>The current selection; interpolates the text that is currently selected in the editor</td>
    </tr>
    <tr>
    <td><strong>%S</strong></td>
    <td>URL-escaped selection; replaces characters that are not valid in a query string, such as spaces and ampersands</td>
    </tr>
    <tr>
    <td><strong>%(node)</strong></td>
    <td>The Node.js interpreter specified in Komodo's Node.js preferences - you can also use _%(node.js)_ or _%(nodejs)_</td>
    </tr>
    <tr>
    <td><strong>%(perl)</strong></td>
    <td>The perl interpreter specified in Komodo's Perl preferences</td>
    </tr>
    tr>
    <td><strong>%(php)</strong></td>
    <td>The php interpreter specified in Komodo's PHP preferences</td>
    </tr>
    <tr>
    <td><strong>%(python)</strong></td>
    <td>The python interpreter specified in Komodo's Python preferences</td>
    </tr>
    <tr>
    <td><strong>%(python3)</strong></td>
    <td>The python3 interpreter specified in Komodo's Python3 preferences</td>
    </tr>
    <tr>
    <td><strong>%(pythonw)</strong></td>
    <td>The pythonw interpreter for python scripts that display a GUI (Windows and OS X only - requires ActivePython)</td>
    </tr>
    <tr>
    <td><strong>%(ruby)</strong></td>
    <td>The ruby interpreter specified in Komodo's Ruby preferences</td>
    </tr>
    <tr>
    <td><strong>%(tclsh)</strong></td>
    <td>The tclsh interpreter specified in Komodo's Tcl preferences</td>
    </tr>
    <tr>
    <td><strong>%(wish)</strong></td>
    <td>The wish interpreter specified in Komodo's Tcl preferences</td>
    </tr>
    <tr>
    <td><strong>%(browser)</strong></td>
    <td>The browser specified in Komodo's Web Browser preferences</td>
    </tr>
    <tr>
    <td><strong>%(guid)</strong></td>
    <td>A new GUID (Global Unique Identifier)</td>
    </tr>
    <tr>
    <td><strong>%(date)</strong></td>
    <td>The current date (see [%(date) Format Options](#shortcuts_datecode_format))</td>
    </tr>
    <tr>
    <td><strong>%(ask)</strong></td>
    <td>Ask the user for a value when invoked (see [%(ask) Syntax](#shortcuts_askcode_syntax))</td>
    </tr>
    <tr>
    <td><strong>%(askpass)</strong></td>
    <td>Ask the user for a password when invoked (see [%(askpass) Syntax](#shortcuts_askcode_syntax))</td>
    </tr>
    <tr>
    <td><strong>%(path)</strong></td>
    <td>Special Komodo directories (see [%(path) Syntax](#shortcuts_pathcode_syntax))</td>
    </tr>
    <tr>
    <td><strong>%(pref)</strong></td>
    <td>Values from Komodo preferences (see [%(pref) Syntax](#shortcuts_prefscode_syntax))</td>
    </tr>
    <tr>
    <td><strong>%(debugger)</strong></td>
    <td>Runtime properties of the debugger system (see [%(debugger](#shortcuts_debugcode_syntax))</td>
    </tr>
</tbody>
</table>

<a name="basic" id="basic"></a>
## Basic Interpolation Shortcut Syntax

Interpolation shortcut blocks come in two forms: bracketed and non-bracketed. [Run commands](run.html) use the non-bracketed format. [snippets](snippets.html) and [templates](templates.html) use the bracketed format.

<a name="shortcuts_nonbrack" id="shortcuts_nonbrack"></a>
### Non-Bracketed Syntax

The syntax for a non-bracketed interpolation code is:

```
%<code>
```

For shortcuts with options:

```
%(<code><backref>:<options>...)
```

For example:

```
%(perl)
%w
%guid2
%(ask:Your Name:Trent Mick)
```

The parentheses are optional if the block does not contain spaces. For example, the following two commands are equivalent:

```
%ask:Name:Trent
%(ask:Name:Trent)
```

<a name="shortcuts_brack" id="shortcuts_brack"></a>
### Bracketed Syntax

The syntax for a bracketed interpolation code is:

```
[[%(<code><backref>:<options>...)]]
```

&lt;code&gt; is one of the codes shown in the table above, &lt;backref&gt; is a number and &lt;options&gt;... depend on the specific code. [Back-references](#back_references) and [options](#options) are discussed in other sections. The following are examples of bracketed syntax:

```
[[%perl]]
[[%w]]
[[%guid2]]
[[%ask:Your Name:Trent Mick]]
```

With bracketed interpolation codes, the parentheses are always optional. The double brackets enclose spaces, making parentheses unnecessary. For example, both of the following commands are valid:

```
[[%ask:Your Name:Trent Mick]]
[[%(ask:Your Name:Trent Mick)]]
```

Bracketed interpolation code blocks permit some excess space immediately adjacent to the double brackets. For example the following are equivalent:

```
[[%ask:Your Name:Trent Mick]]
[[   %ask:Your Name:Trent Mick]]
[[%(ask:Your Name:Trent Mick)       ]]
[[  %(ask:Your Name:Trent Mick)   ]]
```

There are also two shortcuts that are available only in the bracketed form:

<table  >

<tbody>

<tr>

<td><strong>Shortcut</strong></td>

<td><strong>Syntax</strong></td>

<td><strong>Description</strong></td>

</tr>

<tr>

<td>tabstop</td>

<td><code>[[%tabstop<number>:<default>]]</code></td>

<td>Insert linked tabstop placeholders in the document. All tabstops with the same number update simultaneously. Tabstop0 is the last position pressing tab moves to. Both the <number> and <default> are optional.</td>

</tr>

<tr>

<td>soft</td>

<td><code>[[%soft:<characters>]]</code></td>

<td>The specified characters are inserted as "soft" characters, meaning that if the user types a soft character when it's at the cursor position, the effect is the same as pressing the right-arrow key.</td>

</tr>

</tbody>

</table>

There are no escape characters in shortcuts. The shortcut `[[%soft:]]]` will insert a soft "]", you can use. But to insert two square brackets ("]]"), two shortcuts are needed: `[[%soft:]]][[%soft:]]]`.

<a name="options" id="options"></a>
## Basic Interpolation Options

The following table shows the standard options available for _most_ interpolation shortcuts, though the [%(ask)](#shortcuts_askcode), [%(askpass)](#shortcuts_askcode), [%(path)](#shortcuts_pathcode), [%(pref)](#shortcuts_prefscode) and [%(debugger)](#shortcuts_debugcode) shortcuts have their own additional options and syntax.

<table  >

<tbody>

<tr>

<td><strong>Option</strong></td>

<td width="300"><strong>Syntax</strong></td>

<td><strong>Description</strong></td>

</tr>

<tr>

<td>orask</td>

<td><code>%(&lt;code&gt;:**orask**:&lt;question&gt;)</code></td>

<td>If a value for the shortcut cannot be determined automatically, the user is prompted when the command is invoked. The <question> is text that will be displayed when the user is asked to enter a value.</td>

</tr>

<tr>

<td>else</td>

<td><code>%(&lt;code&gt;:**else**:&lt;default&gt;)</code></td>

<td>If a value for the shortcut cannot be determined automatically, then <default> is used.</td>

</tr>

<tr>

<td>lowercase</td>

<td><code>%(&lt;code&gt;:**lowercase**)</code></td>

<td>The interpolation result will all be lower cased.</td>

</tr>

<tr>

<td>uppercase</td>

<td><code>%(&lt;code&gt;:**uppercase**)</code></td>

<td>The interpolation result will all be upper cased.</td>

</tr>

<tr>

<td>capitalize</td>

<td><code>%(&lt;code&gt;:**capitalize**)</code></td>

<td>The first character of the interpolation result will be upper cased.</td>

</tr>

<tr>

<td>dirname</td>

<td><code>%(&lt;code&gt;:**dirname**)</code></td>

<td>The parent directory of the resulting shortcut code.</td>

</tr>

<tr>

<td>basename</td>

<td><code>%(&lt;code&gt;:**basename**)</code></td>

<td>The base name (leaf name) of the resulting shortcut code.</td>

</tr>

</tbody>

</table>

Use the `%(...:orask)` modifier with other interpolation shortcuts to prompt for input if no value can be determined. For example:

```
%(s:orask:Element Name)
```

If there is no selected text, a pop-up dialog box appears with a text field called "Element Name".

See [Using Command Query Shortcuts](/tutorial/runcmdtut.html#query_short) in the Run Command Tutorial for examples of `%(ask)` and `%(...:orask)` shortcuts.

<a name="shortcuts_datecode" id="shortcuts_datecode"></a>
## %(date)

A %(date) shortcut is replaced with the current date, formatted according to a given optional format or the default format.

<a name="shortcuts_datecode_syntax" id="shortcuts_datecode_syntax"></a>
### %(date) Syntax

The syntax of the %(date) shortcut is as follows:

```
%(date<backref>:<optional-format>)
[[%(date:<optional-format>)]]
```

As noted in the [Basic Interpolation Code Syntax](#basic) section, the parentheses are optional. The <backref> optional parameter is discussed in the [Back-references](#back_references) section. The following examples are valid:

```
%date
[[%date]]
%(date)
%date:%H:%M:%S
[[%date:%d/%m/%Y %H:%M:%S]]
```

<a name="shortcuts_datecode_format" id="shortcuts_datecode_format"></a>
### %(date) Format Options

If no <optional-format> is specified in a date shortcut, the default date format is used. Configure the default date format using Komodo's [Internationalization](prefs.html#Internationalization) preferences.

If this format is not appropriate, you can specify a different one using the following date formatting codes (from Python's `time.strftime()` method):

<table>

<tbody>

<tr>

<td><strong>Directive</strong></td>

<td><strong>Meaning</strong></td>

</tr>

<tr>

<td><strong>%a</strong></td>

<td>Locale's abbreviated weekday name.</td>

</tr>

<tr>

<td><strong>%A</strong></td>

<td>Locale's full weekday name.</td>

</tr>

<tr>

<td><strong>%b</strong></td>

<td>Locale's abbreviated month name.</td>

</tr>

<tr>

<td><strong>%B</strong></td>

<td>Locale's full month name.</td>

</tr>

<tr>

<td><strong>%c</strong></td>

<td>Locale's appropriate date and time representation.</td>

</tr>

<tr>

<td><strong>%d</strong></td>

<td>Day of the month as a decimal number [01,31].</td>

</tr>

<tr>

<td><strong>%H</strong></td>

<td>Hour (24-hour clock) as a decimal number [00,23].</td>

</tr>

<tr>

<td><strong>%I</strong></td>

<td>Hour (12-hour clock) as a decimal number [01,12].</td>

</tr>

<tr>

<td><strong>%j</strong></td>

<td>Day of the year as a decimal number [001,366].</td>

</tr>

<tr>

<td><strong>%m</strong></td>

<td>Month as a decimal number [01,12].</td>

</tr>

<tr>

<td><strong>%M</strong></td>

<td>Minute as a decimal number [00,59].</td>

</tr>

<tr>

<td><strong>%p</strong></td>

<td>Locale's equivalent of either AM or PM.</td>

</tr>

<tr>

<td><strong>%S</strong></td>

<td>Second as a decimal number [00,61].</td>

</tr>

<tr>

<td><strong>%U</strong></td>

<td>Week number of the year (Sunday as the first day of the week) as a decimal number [00,53]. All days in a new year preceding the first Sunday are considered to be in week 0.</td>

</tr>

<tr>

<td><strong>%w</strong></td>

<td>Weekday as a decimal number [0(Sunday),6].</td>

</tr>

<tr>

<td><strong>%W</strong></td>

<td>Week number of the year (Monday as the first day of the week) as a decimal number [00,53]. All days in a new year preceding the first Sunday are considered to be in week 0.</td>

</tr>

<tr>

<td><strong>%x</strong></td>

<td>Locale's appropriate date representation.</td>

</tr>

<tr>

<td><strong>%X</strong></td>

<td>Locale's appropriate time representation.</td>

</tr>

<tr>

<td><strong>%y</strong></td>

<td>Year without century as a decimal number [00,99].</td>

</tr>

<tr>

<td><strong>%Y</strong></td>

<td>Year with century as a decimal number.</td>

</tr>

<tr>

<td><strong>%Z</strong></td>

<td>Time zone name (or by no characters if no time zone exists).</td>

</tr>

<tr>

<td><strong>%%</strong></td>

<td>A literal "%" character.</td>

</tr>

</tbody>

</table>

For more information about Python's time access and conversions, see [http://docs.python.org/library/time](http://docs.python.org/library/time)

<a name="shortcuts_askcode" id="shortcuts_askcode"></a>
## %(ask) and %(askpass)

The `%(ask)` and `%(askpass)` shortcuts will prompt the user with a pop-up dialog box for a replacement value. The `%(askpass)` shortcut is appropriate for prompting for passwords as the text is obscured in the dialog box and the password is not stored in a most-recently-used list. If a snippet or run command includes more than one "ask" shortcut, the dialog box shows a field for each one.

<a name="shortcuts_askcode_syntax" id="shortcuts_askcode_syntax"></a>
### %(ask) and %(askpass) Syntax

The `%(ask)` and `%(askpass)` shortcuts can be used without options, or with optional "name" and "default" values. The syntax is:

```
%(ask[:NAME:[DEFAULT]])
%(askpass[:NAME:[DEFAULT]])
```

"NAME" appears next to the corresponding field in pop-up dialog box, and "DEFAULT" is an optional default value. A "DEFAULT" cannot be specified without a "NAME".

Typical usage of the `%(askpass)` shortcut would use "Password" for the "NAME" and not set a "DEFAULT". For example:

```
%(askpass:Password)
```

As noted in [Basic Interpolation Code Syntax](#basic), usage of parentheses depends on the context. The following examples are valid:

```
%ask
[[%ask:Name]]
%ask:Name:Joe
%(ask:What is Your Name:Joe Smith)
```

<a name="shortcuts_askcode_options" id="shortcuts_askcode_options"></a>
### %(ask) and %(askpass) Options

The `%(ask)` and `%(askpass)` shortcuts take two optional parameters. The first, <question>, is the text to display to the user when prompting for the value for that shortcut. The second, <default>, is the string used to preload the text field. For example:

```
%(ask<backref>:<optional-question>:<optional-default>)
[[%(ask<backref>:<optional-question>:<optional-default>)]]
```

The <backref> optional parameter is discussed in the [Back-references](#back_references) section.

<a name="shortcuts_pathcode" id="shortcuts_pathcode"></a>
## %(path)

The "path" codes are used to provide special directory paths based on the installation of Komodo that is currently running. These include such items as the common data directory, which may be necessary if you are building run commands that you intend to work on shared files.

<a name="shortcuts_pathcode_syntax" id="shortcuts_pathcode_syntax"></a>
### %(path) Syntax

The syntax of the path shortcut is as follows:

```
%(path:<pathName>)
[[%(path:<pathName>)]]
```
<a name="shortcuts_pathcode_options" id="shortcuts_pathcode_options"></a>
### %(path) Options

The %(path) shortcut takes one required parameter, "pathName". The pathName may be one of the following:

<table>

<tbody>

<tr>

<td><strong>Path Name</strong></td>

<td><strong>Meaning</strong></td>

</tr>

<tr>

<td><strong>userDataDir</strong></td>

<td>User-specific data directory where Komodo stores various information and files.</td>

</tr>

<tr>

<td><strong>roamingUserDataDir</strong></td>

<td>The roaming user-data-directory only applies to Windows. This is used for shared Komodo profile files.</td>

</tr>

<tr>

<td><strong>commonDataDir</strong></td>

<td>The common data directory contains data and files that are shared between multiple users.</td>

</tr>

<tr>

<td><strong>userCacheDir</strong></td>

<td>The user cache directory is where Komodo stores cached data.</td>

</tr>

<tr>

<td><strong>supportDir</strong></td>

<td>Komodo's data support directory. This is somewhere under the Komodo install dir.</td>

</tr>

<tr>

<td><strong>sdkDir</strong></td>

<td>Komodo's SDK support directory. Contains files relating to add-ons and extension development.</td>

</tr>

<tr>

<td><strong>docDir</strong></td>

<td>Komodo's documentation directory. This is where Komodo's help files are located.</td>

</tr>

<tr>

<td><strong>installDir</strong></td>

<td>Komodo's installation directory.</td>

</tr>

<tr>

<td><strong>binDir</strong></td>

<td>The directory containing the Komodo executable.</td>

</tr>

<tr>

<td><strong>mozBinDir</strong></td>

<td>The directory containing the Mozilla binary library files.</td>

</tr>

<tr>

<td><strong>komodoPythonLibDir</strong></td>

<td>The Komodo-specific python library directory.</td>

</tr>

</tbody>

</table>

<a name="shortcuts_debugcode" id="shortcuts_debugcode"></a>
## %(debugger)

The %(debugger) shortcuts are used to provide runtime values from the debugger subsystem in Komodo. These codes can be used to provide debugging information to applications such as [PerlApp](http://activestate.com/Products/Perl_Dev_Kit/).

<a name="shortcuts_debugcode_syntax" id="shortcuts_debugcode_syntax"></a>
### %(debugger) Syntax

The syntax of the debugger shortcut is as follows:

```
%(debugger:<value>)
[[%(debugger:<value>)]]
```

<a name="shortcuts_debugcode_options" id="shortcuts_debugcode_options"></a>
### %(debugger) Options

The %(debugger) shortcut requires a <value> parameter, which can be one of the following:

<table  >

<tbody>

<tr>

<td><strong>Debugger Value</strong></td>

<td><strong>Meaning</strong></td>

</tr>

<tr>

<td><strong>address</strong></td>

<td>The hostname or address Komodo is running on.</td>

</tr>

<tr>

<td><strong>port</strong></td>

<td>The TCP/IP port number that the debugger system is listening on.</td>

</tr>

<tr>

<td><strong>proxyAddress</strong></td>

<td>The hostname or address of a debugger proxy that Komodo is using.</td>

</tr>

<tr>

<td><strong>proxyPort</strong></td>

<td>The TCP/IP port number of a debugger proxy that Komodo is using.</td>

</tr>

<tr>

<td><strong>proxyKey</strong></td>

<td>A session key, typically retrieved from the USER environment variable, that the proxy uses to match debug sessions with a specific running instance of Komodo.</td>

</tr>

</tbody>

</table>

<a name="shortcuts_prefscode" id="shortcuts_prefscode"></a>
## %(pref)

The %(pref) shortcut is used to provide values from Komodo's [Preferences](prefs.html). The back-end of Komodo's preference system is undocumented, but you can examine the settings in the _prefs.xml_ file in the [user data directory](trouble.html#appdata_dir) to find the preference IDs.

<a name="shortcuts_prefscode_syntax" id="shortcuts_prefscode_syntax"></a>
### %(pref) Syntax

The syntax of the `%(pref)` shortcut is:

```
%(pref:<prefName>)
[[%(pref:<prefName>)]]
```

Preference names may change between Komodo versions.

<a name="back_references" id="back_references"></a>
## Back-References

Back-references are particularly useful for code snippets. You can use back-references to interpolate the same value any number of times in the snippet. Back-references make it possible to prompt the user for an input value only once, and then insert that value multiple times. For example, you could create a snippet that prompts for a value, which would then be entered at various places in the snippet text.

<a name="back_references_syntax" id="back_references_syntax"></a>
### Back-Reference Syntax

You create a back-referenced set of shortcuts by suffixing the interpolation code with a number. The syntax for back-reference is as follows:

```
%(<code><backref>:<options>...)
[[%(<code><backref>:<options>...)]]
```

For example:

```
%(ask1:Name:Trent)
%w1:else:Foo
[[%guid1]]
```

All interpolation blocks with the same shortcut/number pairs are part of the same back-reference set. All members of the same back-reference set will be replaced with the first code block in that set. For example:

```
echo Hi there %(ask1:Name:Trent). That name again is %ask1
```

This opens a pop-up dialog box prompting for _one_ entry, "Name", with a default of "Trent". Whatever value the user entered for "Name" would then be inserted in _two_ places in the command, resulting in the following command:

```
echo Hi there Bill. That name again is Bill
```

Another useful application of back-references is the "guid" code. A guid code is replaced with a new GUID (Globally Unique Identifier). Sometimes it is desirable to have the same GUID inserted in more than one place in a file. In snippets, this can be done by using a code "%guid1" instead of just "%guid" wherever you want the GUID inserted.
