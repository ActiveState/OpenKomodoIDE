---
title: User-Defined Language Support
---
**Luddite Reference**

- [Keywords](luddite.html#keywords)
- [Style Names](luddite.html#style-names)
- [Terms](luddite.html#terms)
- [Concepts](luddite.html#concepts)

Komodo's system for defining multi-language syntax lexing and user-defined syntax highlighting is called UDL (User Defined Languages). UDL files are written in a language called **Luddite**, then compiled into Scintilla lexers and packaged for use in Komodo.

<a id="udl_introduction" name="udl_introduction"></a>
## Introduction

Komodo includes a general-purpose lexer engine that loads a description resource, and walks it while lexing the buffer. It currently allows for up to five sub-languages, each of which is expected to be a member of a pre-defined family ("markup", "style", "client-side scripting language", "server-side scripting language", and "template language"). The format of these resource files is low-level and intended to be fast to parse, so we have provided a programming language that is intended to allow users to build lexers for their own programming languages.

Currently these lexers allow for six-bit colorizing, meaning that both errors and warnings can be highlighted in the buffer. The lexer description language allows for:

- specifying a set of keywords and folding conditions for each family
- disambiguation rules for each family (e.g. in JavaScript, when does '/' indicate division, and when does it start a regex?)
- constant strings and patterns to look for, and what to do with them

<a id="udl_language-overview" name="udl_language-overview"></a>
## Luddite Language Overview

Luddite programs typically consist of a set of files, called modules. A well-designed Luddite program will contain one main file, that provides a name for the target language, and then a list of `include` statements that load the other modules.

Luddite consists of a set of declarations, most of which can appear in any order, except for the initial "family" declaration. This is because some declarations are family-specific, and bind to the prevailing family declaration.

<a id="udl_a-sample" name="udl_a-sample"></a>
### A Sample

The `php-mainlex.udl` file defines the PHP lexer. It is a useful example as it uses one of each of the language families: markup (HTML), css (CSS), client-side (JavaScript), and server-side (PHP). It includes transitions from HTML to JavaScript, CSS, and PHP, followed by transitions back to HTML from each of these languages, and finally the main language modules.

```
    include "html2js.udl"
    include "html2css.udl"
    include "html2php.udl"
    include "css2html.udl"
    include "js2html.udl"
    include "php2html.udl"
    include "html.udl"
    include "csslex.udl"
    include "jslex.udl"
    include "phplex.udl"
```

Working from the bottom of the list towards the top, we have four core files that contain code to describe how to lex each language on its own. Above those are files that explain how to transition from one language to another (e.g. "php2html.udl"). As rules are attempted in the order they're first presented, we normally need to test transition rules before we attempt internal rules, which is why the core modules appear at the bottom.

<a id="udl_luddite-in-a-nutshell" name="udl_luddite-in-a-nutshell"></a>
## Luddite in a Nutshell

Luddite programs consist of declarative statements separated either by newlines or semi-colons. Comments start with "#" and continue to the end of line. Because it's a declarative language, the order of different statements doesn't matter, but the order of rules in the same group does.

The Luddite compiler allows lists to be entered with minimal punctuation (i.e without quotes around strings, or commas between entries). However, the following words should always be quoted when declared as strings as they are reserved words in Luddite:

| Word |
| --- | --- | --- |
| [accept](/sdk/luddite.html#accept) | [keyword_style](/sdk/luddite.html#keyword_style) | [skip](/sdk/luddite.html#skip) |
| [all](/sdk/luddite.html#all) | [language](/sdk/luddite.html#language) | [state](/sdk/luddite.html#state) |
| [at_eol](/sdk/luddite.html#at_eol) | [namespace](/sdk/luddite.html#namespace) | [sublanguage](/sdk/luddite.html#sublanguage) |
| [clear_delimiter](/sdk/luddite.html#clear_delimiter) | [no_keyword](/sdk/luddite.html#no_keyword) | [sub_language](/sdk/luddite.html#sub_language) |
| [delimiter](/sdk/luddite.html#delimiter) | [paint](/sdk/luddite.html#paint) | [system_id](/sdk/luddite.html#system_id) |
| [family](/sdk/luddite.html#family) | [pattern](/sdk/luddite.html#pattern) | [token_check](/sdk/luddite.html#token_check) |
| [fold](/sdk/luddite.html#fold) | [public_id](/sdk/luddite.html#public_id) | [start_style](/sdk/luddite.html#start_style) |
| [include](/sdk/luddite.html#include) | [redo](/sdk/luddite.html#redo) | [end_style](/sdk/luddite.html#end_style) |
| [initial](/sdk/luddite.html#initial) | [reject](/sdk/luddite.html#reject) | [upto](/sdk/luddite.html#upto) |
| [keep_delimiter](/sdk/luddite.html#keep_delimiter) | [set_delimiter](/sdk/luddite.html#set_delimiter) | [spush_check](/sdk/luddite.html#spush_check) |
| [keywords](/sdk/luddite.html#keywords) | [set_opposite_delimiter](/sdk/luddite.html#set_opposite_delimiter) | [spop_check](/sdk/luddite.html#spop_check) |


Luddite is intended to work only with Scintilla. It is helpful to refer to the [Scintilla documentation](http://scintilla.sourceforge.net/ScintillaDoc) when writing lexers in Luddite. To reduce redundancy, you can refer to the names of colors by using either the full name, such as "SCE_UDL_M_ATTRNAME", or you can drop the common prefix, and refer to "M_ATTRNAME". A partial prefix won't work, nor will hard-wired numeric values.

<a id="udl_families" name="udl_families"></a>
## Families

Most lexer components need to declare which language family they belong to: markup, css, csl (client-side language), ssl (server-side language - usually JavaScript ), or tpl (template language). This last language is usually used by the server-side processor that has to determine which code is markup to be output "as is", and which is server-side code to be executed (e.g. PHP's Smarty and Perl's Template Toolkit).

The default family is "markup". You can write a lexer for any language that lives in one family, and it won't look like markup. This is an arbitrary starting point that makes sense for most template languages.

All directives in a file belong to the most recent family directive. When a new file is included, it starts off in the family at the point of inclusion. If a new family is specified, when the include-file is processed, Luddite pops to using the family that was current when the include began.

There are currently three domains that are family-specific: keywords, named patterns, and look-back tests, which are used to disambiguate.

Example:

`family csl`

<a id="udl_styles" name="udl_styles"></a>
## Styles

For each family, we currently need to specify the style from scintilla.iface that the family will use.

Example:

```
start_style CSL_DEFAULT
end_style CSL_REGEX
```

This isn't surprising, as the code in scintilla.iface reads like so:

```
# Template: client-side language  # Start at 30
val SCE_UDL_CSL_DEFAULT=30
val SCE_UDL_CSL_COMMENT=31
val SCE_UDL_CSL_COMMENTBLOCK=32
val SCE_UDL_CSL_NUMBER=33
val SCE_UDL_CSL_STRING=34
val SCE_UDL_CSL_WORD=35
val SCE_UDL_CSL_IDENTIFIER=36
val SCE_UDL_CSL_OPERATOR=37
val SCE_UDL_CSL_REGEX=38
```

A complete list of [Scintilla Styles](/sdk/luddite.html#style-names) can be found in the [Luddite Reference](/sdk/luddite.html).

<a id="udl_keywords" name="udl_keywords"></a>
## Keywords

Most sub-languages have a set of keywords that we want to color differently from identifiers. You specify them using `keywords`, supplying a list of names and strings, which may be comma-separated, as in this code for JavaScript:

```
keywords [as break case catch class const # ...
          get, "include", set
          abstract debugger enum goto implements # ...
]
```

The string "include" is quoted because it is a [Luddite keyword](/sdk/luddite.html#keywords). Commas are optional, and comments can be added at the end of a line inside a list.

You must generally specify a different list of keywords for each family, however it is possible to define some languages without keywords (e.g. HTML).

Tell Luddite when to color a range of text as a keyword with the `keyword_style` directive. For example:

```
keyword_style CSL_IDENTIFIER => CSL_WORD
```

A complete list of [Luddite Keywords](/sdk/luddite.html#keywords) can be found in the [Luddite Reference](/sdk/luddite.html).

To prevent the color for an identifer from being converted into a keyword, use the [no_keyword](#udl_no_keyword) command.

<a id="udl_pattern-variables" name="udl_pattern-variables"></a>
## Pattern Variables

To specify how Luddite should process text, provide a string for it to match verbatim, or provide a pattern. The pattern syntax is nearly identical to Perl's regex language.

Patterns for a particular language tend to be repetitive. To make it easier to use them, Luddite supports family-based pattern variables, which are interpolated into pattern expressions. These are the four pattern variables used in the JavaScript lexer:

```
pattern NMSTART = '\w\x80-\xff'   # inside cset
pattern CS = '\w\d_\x80-\xff'     # inside cset
pattern WS = '\s\t\r\n'           # inside cset
pattern OP = '!\#%&\(\)\*\+,-\.\/:;<=>\?@\[\]\^\{\}~|'
```

These patterns are interpolated into a character set. For example:

```
/[^$WS]+/  # Match one or more non-white-space characters
```

The CSS UDL includes a more complex set of statements:

```
family css

pattern CS = '-\w\d._\x80-\xff'   # inside cset
pattern WS = '\s\t\r\n'           # inside cset
pattern NONASCII = '[^\x00-\x7f]'
pattern UNICODE = '\\[0-9a-f]{1,6}'
pattern ESCAPE = '$UNICODE|\\[ -~\x80-\xff]'
pattern NMCHAR = '[a-zA-Z0-9-]|$NONASCII|$ESCAPE'
pattern NMSTART = '[a-zA-Z]|$NONASCII|$ESCAPE'
```

Pattern variables can nest within one another. You need to keep track of which variables define a character set, and which ones are intended to be used inside a character set.

<a id="udl_states-and-transitions" name="udl_states-and-transitions"></a>
## States and Transitions

The heart of every Luddite program is a set of state-transitions. The key concept is that states in Luddite, unlike most Scintilla lexers that are hand-coded in C, are not directly related to the colors that each character will be given. In Luddite you create your own names for each state, describe for each state which pieces of text or patterns to look for, and specify what to do with them.

<a id="udl_the-initial-state" name="udl_the-initial-state"></a>
### The Initial State

The HTML lexer starts with this code:

```
initial IN_M_DEFAULT
```

The first statement means that we should start lexing at the state we call "IN_M_DEFAULT". Subsequent `initial` statements are ignored, without warning messages.

<a id="udl_specifying-state-transitions" name="udl_specifying-state-transitions"></a>
### Specifying State Transitions

To specify a state transition, provide a state block. For example, with HTML:

```
state IN_M_DEFAULT:
'<?' : paint(upto, M_DEFAULT), => IN_M_PI_1
'<[CDATA[' : paint(upto, M_DEFAULT), => IN_M_CDATA
'<!--' : paint(upto, M_DEFAULT), => IN_M_COMMENT

# These are more complicated, because if they aren't followed
# by a character we want to leave them as text.

'</' : paint(upto, M_DEFAULT), => IN_M_ETAG_1
'&#' : paint(upto, M_DEFAULT), => IN_M_ENT_CREF_1
'&' : paint(upto, M_DEFAULT), => IN_M_ENT_REF_1
'<' : paint(upto, M_DEFAULT), => IN_M_STAG_EXP_TNAME
```

When we're in the state we call "IN_M_DEFAULT" (Luddite turns this into an arbitrary number to be used by Scintilla), if we match any of the above strings, we first will have Scintilla color (or "paint") everything up to the current starting position the SCE_UDL_M_DEFAULT color (remember, the prefix is implicit), and then change to the state named to the right of the "=>". The comma before "=>" is optional, but advisable in more complex rules.

The match strings may use double-quotes instead of single-quoted. Simple C-like backslash-escaping is used, such as ' and ", but not hex or octal escapes.

<a id="udl_include-upto-and-eof-conditions" name="udl_include-upto-and-eof-conditions"></a>
### Include, Upto, and EOF Conditions

```
state IN_M_PI_1:
'?>' : paint(include, M_PI) => IN_M_DEFAULT
/\z/ : paint(upto, M_PI)
```

The "`include`" directive for the paint command paints from the last paint-point, to the position we _end_ at. Recall that `paint(upto,[color])` stops at the position we were at when we attempted to match the string.

One of the advantages of this approach over a standard regular expression based set of rules, specifying the start and end delimiters, is that Luddite is geared to building editor lexers. When people are using lexers they often are typing at the end of the file. For example, if I was typing this code:

```
---- top ----
...
<?somepi<EOF>
---- bottom ----
```

I would like the last line to be colored like a processing instruction, even though I haven't completed it. Luddite lets you do things to confound your users, such as choosing a different color for an incomplete directive at the end of file. However, most of the time, you won't want to do this. If all of the _first_ colors in a state block map to the same color, Luddite will automatically supply that color for an end-of-file condition at that state. In other words, the '/z/'-condition is rarely necessary.

<a id="udl_redo-and-lookahead" name="udl_redo-and-lookahead"></a>
### Redo and Lookahead

There are two main ways to to delay state transitions and colorizing in Luddite:

1.  Perl-like <tt class="docutils literal">(?=...)</tt> lookahead test in a regular expression, which will match but won't advance the cursor into that text.
1.  The <tt class="docutils literal">redo</tt> command. In the following example, we modify our rules for recognizing processing instructions in HTML. If the "<?" is followed immediately by "php", and then by a non-name character, we want to transition to the server-side family, which presumably implements a PHP lexer.

In the HTML lexer, we rewrite the state blocks for PIs as follows:

```
state IN_M_PI_1:
/./ : redo, => IN_M_PI_2

state IN_M_PI_2:
'?>' : paint(include, M_PI) => IN_M_DEFAULT
```

Wait a minute, you say. That does just the same thing, and less efficiently than when there was just the one state. In fact, all state IN_M_PI_1 does is a so-called epsilon transition to state IN_M_PI_2 ("epsilon" transitions don't consume input).

Go back to that sample at the beginning of this document. Notice that the `html2php.udl` file is included before `html.udl`. This file is short, and is reproduced here without comments:

```
family markup

state IN_M_PI_1:
/php\b/ : paint(upto, M_OPERATOR), paint(include, M_TAGNAME), \
  => IN_SSL_DEFAULT
```

Because `html2php.udl` is processed before `html.udl`, its pattern will be attempted earlier. If the lexer finds "php" followed by a word boundary, it will then paint the leading "<?" as a markup operator, paint the "php" as a markup tagname, and then switch to the default state in the server-side language family.

If you write a Luddite program that ends up where two states do epsilon transitions to one another, the lexer engine will detect this. More precisely, if it notices that it has carried out 1000 consecutive epsilon transitions, it will move on to the next character. This shows up in Komodo as the rest of the buffer highlighted in a single color (remember the implicit end-of-buffer coloring).

<a id="udl_no_keyword" name="udl_no_keyword"></a>
### Preventing Keyword Promotion

The `no_keyword` command is used to prevent identifier to keyword promotion when an identifier is recognized. This is useful for programming languages that allow any token, even keywords, to be used in certain contexts, such as after the "`.`" in Python, Ruby, and VBScript, or after "`::`" or "`->`" in Perl. See [sample Luddite code](/sdk/luddite.html#no_keyword).

<a id="udl_pattern-syntax" name="udl_pattern-syntax"></a>
### Pattern Syntax

The Luddite syntax for patterns is very similar to Perl's. Only forward slashes may be used as regex delimiters, all the usual escaping rules apply. For example, JavaScript uses this pattern to handle single-line comments:

```
state IN_CSL_DEFAULT:
# ...
# Swallow to end-of-line
/\/\/.*/ : paint(upto, CSL_DEFAULT), paint(include, CSL_COMMENT)
```

If no target state is specified, the lexer will stay in the current state.

<a id="udl_pushing-states" name="udl_pushing-states"></a>
### Pushing States

In many languages you need to push one state, transition to another, and at some point return to the previous state. There are many examples where this comes up in template-based languages.

In most Smarty files, you transition from HTML to Smarty on "{", and transition back on "}". But if you find an open-brace while processing Smarty code, you should allow for a matching "}".

In RHTML, the delimiters "<%=" and "%>" are used to transition from HTML into a Ruby expression, and back. These delimiters can occur in many different parts of HTML files, including attribute strings and content. The lexer needs to be told which state to return to when it finishes processing the Ruby expression.

In Ruby proper, you can interpolate arbitrary amounts of Ruby code inside double-quoted strings between "#{" and "}". By pushing a state when you find "#{" in a Ruby string, you can allow for multiple nested pairs of braces in the expression, and return to the string when the matching "}" is reached.

The Luddite code for expressing this is simple. Let's look at how it's expressed for double-quoted strings in Ruby:

```
state IN_SSL_DEFAULT:
#...
'"' : paint(upto, SSL_DEFAULT), => IN_SSL_DSTRING
#... Note the redo here for things that could be operators
/[$OP]/ : paint(upto, SSL_DEFAULT), redo, => IN_SSL_OP1
#...

state IN_SSL_DSTRING:
'#{' : paint(include, SSL_STRING), spush_check(IN_SSL_DSTRING), \
  => IN_SSL_DEFAULT
...

state IN_SSL_OP1:
'{' : paint(include, SSL_OPERATOR), spush_check(IN_SSL_DEFAULT) \
  => IN_SSL_DEFAULT
'}' : paint(upto, SSL_DEFAULT), paint(include, SSL_OPERATOR), \
  spop_check, => IN_SSL_DEFAULT
# ...
```

When we find "`#{`" while processing a double-quoted string, we push the state we want to return to (`IN_SSL_DSTRING`), and transition to the default Ruby state (`IN_SSL_DEFAULT`), where we lex an expression.

If we find an open-brace while looking for operators, we again push the default state on the stack.

To handle a close-brace, we carry out a "spop_check" test. If there's something on the stack, we pop it and transition to the state it specified. Otherwise, we transition to the specified state. If users never made mistakes, you would never need to specify a target state in a directive containing an "spop" command. But because people are capable of typing things like:

```
  cmd {
    yield
  }
```

...we need to tell Luddite what to do on the extra close-brace.

<a id="udl_line_oriented_transitions" name="udl_line_oriented_transitions"></a>
### Handling Newlines

Some template languages use line-oriented embedded languages. For example, in Mason you can insert a line of Perl code by putting a '`%`' character at the start of the line.

The simplest way to express this in Luddite is to put an `at_eol` command in the transition into that state. When the lexer reaches the end of that line, it will automatically transition into the specified state. For example, the Luddite code to express this for the above Mason example is here:

```
state IN_M_DEFAULT:
/^%/ : paint(upto, M_DEFAULT), paint(include, TPL_OPERATOR), \
  at_eol(IN_M_DEFAULT), => IN_SSL_DEFAULT
```

<a id="udl_arbitrary_delimiters" name="udl_arbitrary_delimiters"></a>
### Supporting Arbitrary Delimiters

Some languages support arbitrary delimiters for objects like strings and regular expressions. For example, in Perl you can provide a list of words with the 'qw' construct (e.g. `qw/abc def 1234/`), and in Ruby you can use the '`%`' character to delimit a string (e.g. `%Q(abc(nested parens)def)`). You can express these in Luddite using the **delimiter** keyword.

There are actually four parts to supporting delimiters:

1.  Targeting an "opposite" delimiter, so that one of the four characters `[`, `{`, `(` or `<` is matched by its closing character `]`, `}`, `)`, or `>` respectively. These pairs are hard-wired into UDL.
1.  Targeting any character as the closing delimiter. Alphabetic characters can be targeted. The only character that cannot be targeted is the "`\`".
1.  Matching a delimiter.
1.  Continuing use of a delimiter. For example, to support a construct like Perl's "`s,\\,/,g`" idiom, set the target delimiter to ",", match it, and keep it as the target for one more match.

This code shows how the delimiter-oriented keywords are used to work together. We'll walk through support for Perl's matching statement first:

```
state IN_SSL_DEFAULT:
# ...
/m([\{\[\(\<])/ : paint(upto, SSL_DEFAULT), \
  set_opposite_delimiter(1), => IN_SSL_REGEX1_TARGET
/m([^\w\d])/ : paint(upto, SSL_DEFAULT), \
  set_delimiter(1), => IN_SSL_REGEX1_TARGET
# ...
state IN_SSL_REGEX1_TARGET:
delimiter: paint(include, SSL_REGEX), => IN_SSL_REGEX_POST
/\\./ #stay
```

The first transition matches one of the open-bracket characters in a grouped pattern, and sets the target delimiter to the opposite of the contents of the first pattern group. The `opposite_delimiter()` routine requires its input to be one character long, and returns its input if it isn't one of the opening characters. So the two patterns could be expressed with the one transition:

```
m([^\w\d])/ : paint(upto, SSL_DEFAULT), set_opposite_delimiter(1), \
  => IN_SSL_REGEX1_TARGET
```

Handling a construct like Perl's substitution syntax is slightly more complicated because it can use various delimiters (e.g. s/foo/bar/, s'foo'bar', s#foo#bar#, etc.). Furthermore, if the character after the 's' is an opening bracket character, the full pattern can use either two pairs of bracketing delimiters, or non-bracketing delimiters, as in

```
s[find] {replace}
s<first>/second/
```

White space is always ignored after the first pair. To encode this in Luddite we need several states:

```
/s([\{\[\(\<])/ : paint(upto, SSL_DEFAULT), \
  set_opposite_delimiter(1), => IN_SSL_REGEX2_TARGET1_OPPOSITE_1
# ...
state IN_SSL_REGEX2_TARGET1_OPPOSITE_1:
/\\./ : #stay
delimiter: paint(include, SSL_REGEX), \
  => IN_SSL_REGEX2_TARGET1_OPPOSITE_2
/\z/ : paint(upto, SSL_REGEX)

state IN_SSL_REGEX2_TARGET1_OPPOSITE_2:
/\\./ : #stay
/[$WS]/ : #stay -- assume we're in {...} [ ... ]x
/([\{\[\(\<])/ : paint(upto, SSL_DEFAULT), \
  set_opposite_delimiter(1), => IN_SSL_REGEX1_TARGET
/([^\w\d])/ : paint(upto, SSL_DEFAULT), set_delimiter(1), \
  => IN_SSL_REGEX1_TARGET
/\z/ : paint(upto, SSL_DEFAULT)
```

Matching the second half is similar to matching the delimiter after the 'm'.

The final part is handling constructs like the standard '`s/.../.../`' language. To do that we tell UDL to keep the current delimiter for another round of matching:

```
/s([^\w\d])/ : paint(upto, SSL_DEFAULT), set_delimiter(1), \
  => IN_SSL_REGEX2_TARGET1_SAME
# ...
state IN_SSL_REGEX2_TARGET1_SAME
/\\./ : #stay
delimiter: keep_delimiter, => IN_SSL_REGEX1_TARGET
/\z/ : paint(upto, SSL_REGEX)
```

Often when a construct is bracketed with matching delimiters, the target language is smart enough to ignore inner matched pairs. For example, if in Ruby you were to write

```
puts %Q(first(middle)second)
```

Ruby would write out the string "first(middle)second". To encode this in Luddite use UDL's built-in stack:

```
/%[%qQwWx]([\{\[\(\<])/ : paint(upto, SSL_DEFAULT),
set_opposite_delimiter(1), => IN_SSL_QSTRING_NESTED
# ...
state IN_SSL_QSTRING_NESTED:
delimiter: paint(include, SSL_STRING), => IN_SSL_DEFAULT
/\\./ : #stay
/[\[\{\(\<]/ : paint(upto, SSL_STRING), \
  spush_check(IN_SSL_QSTRING_NESTED), => IN_SSL_QSTRING_NESTED2

state IN_SSL_QSTRING_NESTED2:
/\\./ : #stay
/[\[\{\(\<]/ : spush_check(IN_SSL_QSTRING_NESTED2), \
  => IN_SSL_QSTRING_NESTED2
/[\]\}\)\>]/ : spop_check, => IN_SSL_QSTRING_NESTED
/\z/ : paint(include, SSL_STRING)
```

Finally, you've probably noticed that we put an end-of-buffer transition in many of these states. Notice that the final `IN_SSL_QSTRING_NESTED2` state actually does no painting in its other matches. Normally Luddite will look at the colors a state uses to determine how to color the rest of the text if it reaches the end of the buffer. If more than one color is used, or none is used, the Luddite program should specify a color. Otherwise it's possible that Komodo will repeatedly invoke the colorizer until something is chosen.

<a id="defining_here_documents" name="defining_here_documents"></a>
#### Supporting Here Documents

"Here documents" are a convenient way of defining multi-line strings. Typically they start by defining the "terminating identifier", preceded by an operator like `<<` or `<<<`. The string starts on the following line, and ends when we find a line containing only the terminating identifier.

The following Luddite code outlines how to add here-document processing to a language, using PHP as an example, where we assume a here document always begins with the three less-than characters followed by a name, then the end of line:

```
IN_SSL_PRE_HEREDOC_1

state IN_SSL_PRE_HEREDOC_1:
/([$NMSTART][$NMCHAR]*)/ : set_delimiter(1), paint(include, SSL_IDENTIFIER)
/\r?$/ : paint(include, SSL_DEFAULT), => IN_SSL_IN_HEREDOC_1

state IN_SSL_IN_HEREDOC_1:
delimiter : keep_delimiter, paint(upto, SSL_STRING), => IN_SSL_IN_FOUND_HEREDOC_1
/./ : => IN_SSL_IN_HEREDOC_2  # Not this line

state IN_SSL_IN_HEREDOC_2:
/.+/ : #stay
/$/ : => IN_SSL_IN_HEREDOC_1

state IN_SSL_IN_FOUND_HEREDOC_1:
/[\r\n]+/ : clear_delimiter, paint(upto, SSL_IDENTIFIER), => IN_SSL_DEFAULT  # Got it!
/./ : => IN_SSL_IN_HEREDOC_2 # The delimiter continues, so keep looking
]]>

```

In this example the keywords `delimiter`, `keep_delimiter`, and `clear_delimiter` all work together. After matching the delimiter, we retain it with the `keep_delimiter` action, and then test to make sure the delimiter is followed immediately by the end of the line. If it is, we clear it. Otherwise we return to states `IN_SSL_IN_HEREDOC_2` and `IN_SSL_IN_HEREDOC_1`, looking for a line that contains the terminating identifier, and nothing else. By default matching a delimiter clears it, so we need to keep it and then explicitly clear it. The following example shows why this is needed:

<a id="udl_disambiguation" name="udl_disambiguation"></a>
## Disambiguation

In both Ruby and JavaScript, sometimes a '/' is just a '/', and sometimes it's the start of a regular expression. Luddite's token_check directive directs this. For example, in JavaScript, to determine if a '/' is the start of a regex, and not a division operator, you could write a test like this:

```
state IN_CSL_DEFAULT:
#...
'/' token_check : paint(upto, CSL_DEFAULT), => IN_CSL_REGEX
```

Note that the "token_check" directive is part of the test, not the action to perform. This states that if we do match, color everything before the '/' with the default color, and change to the regex state.

What happens during a `token_check` test depends on the contents of the token_check block specified for the current family. In a token_check block, you look at the tokens to the left of the current position. Each token consists of a two-value tuple, containing its colored style, and its text. On each token, we can decide whether to accept the token (meaning the test passes), reject the token (meaning it fails), or skip the token, meaning we get the previous token in the buffer, working towards the beginning.

Here's the JavaScript token_check block:

```
token_check:
CSL_OPERATOR: reject [")", "++", "--", "]", "}", ";"]

CSL_WORD: reject [class false function null private protected public
  super this true get "include" set]

# All other keywords prefer an RE

CSL_DEFAULT: skip all
CSL_COMMENT: skip all

# Default is to reject / as the start of a regex if it follows
# an unhandled style

#### CSL_IDENTIFIER: reject all
#### CSL_NUMBER: reject all
#### CSL_REGEX: reject all
#### CSL_STRING: reject all
```

You can provide either a list of strings and/or names, or the "all" keyword. Here are the rules on defaults:

-   If a color isn't specified: reject all tokens of that color.
-   If a color has only a reject list: accept all others.
-   If a color has only an accept list: reject everything else.
-   If a color has only a skip list: reject everything else.
-   If a style has two of the lists, the missing one is the default.
-   If a style has all three lists, anything else is rejected.

<a id="udl_specifying-folding" name="udl_specifying-folding"></a>
## Specifying Folding

To get Scintilla to calculate fold levels on each line, specify which tokens increase the folding level, and which decrease it:

Here is all the folding the JavaScript lexer currently specifies:

```
fold "{" CSL_OPERATOR +
fold "}" CSL_OPERATOR -
```

<a id="udl_xml-vocabulary-recognition" name="udl_xml-vocabulary-recognition"></a>
## Recognizing XML Vocabularies

By default, Komodo looks at the extension of the file to determine the kind of language in the file, and then it loads the appropriate language-related code. This mechanism can be further extended by opening the "File Associations" section of the Preferences area, and specifying that Komodo should look for XML namespace attributes and doctype declarations to further determine which language to load.

Authors writing UDL-based lexers for XML vocabularies can tap into this mechanism by using any combination of the [`namespace`](luddite.html#namespace), [`public_id`](luddite.html#public_id), and [`system_id`](luddite.html#system_id) declarations to specify which language Komodo should associate with a particular file, regardless of the actual extension of the filename it is saved by.

For example, XBL (XML Binding Language) contains a combination of XML and JavaScript, and is widely used for Firefox extensions and Mozilla applications. These files often are saved with names containing ".xml" extensions, but they usually contain the following prologue:

```
<!DOCTYPE bindings PUBLIC "-//MOZILLA//DTD XBL V1.0//EN" "http://www.mozilla.org/xbl">

<bindings id="koListboxBindingsNew"
    xmlns="http://www.mozilla.org/xbl" ...>
```

Any combination of the following three declarations in a Luddite file for XBL will be sufficient to direct Komodo to load the Luddite-based XBL mode instead of the default XML mode:

```
namespace "http://www.mozilla.org/xbl"

public_id "-//MOZILLA//DTD XBL V1.0//EN"

system_id "http://www.mozilla.org/xbl"
```

<a id="udl_compile-install" name="udl_compile-install"></a>
## Compiling and Installing

The Luddite compiler and sample `.udl` files can be found in the "Komodo SDK" directory within the Komodo installation tree:

-   Windows: _`INSTALLDIR`\lib\sdk\_
-   Mac OS X: _`INSTALLDIR`/Contents/SharedSupport/sdk/_
-   Linux: _`INSTALLDIR`/lib/sdk/_

Simply place the SDK bin directory on your PATH and you should be able to run `luddite`:

```
# On Windows
C:\> set PATH=`INSTALLDIR`\lib\sdk\bin;%PATH%
C:\> set PATHEXT=%PATHEXT%;.py
C:\> luddite help

# On Mac OS X
$ export PATH=`INSTALLDIR`/Contents/SharedSupport/sdk/bin:$PATH
$ luddite help

# On Linux
$ export PATH=`INSTALLDIR`/lib/sdk/bin:$PATH
$ luddite help
```

Typically you would:

1.  author one or more `.udl` files,
1.  generate the Komodo resource files (the main such file is the `.lexres` compiled version of your `.udl` file) with the "`luddite compile ...`" command, and
1.  build a Komodo extension (a `.xpi` file) with the "`luddite package ...`" command.

To install that extension, open the built `.xpi` file in Komodo.

<a id="udl_samples" name="udl_samples"></a>
## Samples

Sample UDL files can be found in the `udl` subdirectory of the _Komodo SDK_ directory.
