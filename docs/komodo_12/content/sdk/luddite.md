---
title: Luddite reference
---
Luddite is the language Komodo uses for user-defined syntax highlighting and multi-language lexing. An introduction to the Luddite language can be found in the [User-Defined Language Support](/sdk/udl.html) documentation.

<a id="luddite_keywords" name="luddite_keywords"></a>
## Keywords

The following is a list of Luddite keywords - not to be confused with the [keywords](#keywords) described by the UDL file itself for the target language definition. The Luddite keyword is always given followed by its argument list, where applicable; optional arguments are given in square brackets ([ ... ]).

### accept *`name-or-string-list`* | `all`

Used in [token_check](#token_check) definitions to disambiguate characters. If `all` is specified, then a `token_check` test will always succeed. If the previous token falls in the [name-or-string](#name-or-string) list, the `token_check` test succeeds. Otherwise Luddite will look at the results of any [skip](#skip) and [reject](#reject) statements in the current family to decide which action to take.

### all

Used in [accept](#accept), [reject](#reject), and [skip](#skip) statements in [token_check](#token_check) definitions. This means that the `token_check` test will follow whatever directive is associated with this occurrence of `all`.

### at_eol(*`state-name`*)

Used to specify the Luddite state to transition to when the end of the current line is reached. This is useful for processing languages like the Perl-based template language, Mason, in which one can embed Perl code on a single line by putting a '%' character at the start of the line, as in this example:

```
Good
  % if ($time > 12) {
  afternoon
  % } else {
  morning
  % }
```

This is easily handled with this Luddite code:

```
state IN_M_DEFAULT:
  /^%/ : paint(upto, M_DEFAULT), paint(include, TPL_OPERATOR), \
    at_eol(IN_M_DEFAULT), => IN_SSL_DEFAULT
```
If there's a percent character at the start of a line in markup mode, cause it to be lexed as a _template_ operator, and switch to Perl lexing (<tt>IN_SSL_DEFAULT</tt>), and switch back to markup-based lexing when it reaches the end of the line.

### clear_delimiter

Used in conjunction with keep_delimiter, this action explicitly clears the current delimiter (useful in recognizing terminating identifiers in here documents).

### delimiter

Used in place of a pattern or match-string in transitions, this will succeed if there's a current delimiter defined, and it can be matched at the current point in the buffer. When it's matched, the current delimiter will be unset, unless the [`keep_delimiter`](#keep_delimiter) action is given in the transition.

### family `csl|markup|ssl|style|tpl`

The sub-type of this sub-language. The meaning of each family name is:

#### csl

client-side language (e.g. usually JavaScript)

#### markup

markup language (e.g. HTML, XHTML, other XML dialects)

#### ssl

server-side language (e.g. Perl, Python, Ruby)

#### style

stylesheet language (usually CSS)

#### tpl

a "template-oriented" language, usually geared to either adding template-side processing to the server-side language, or making it easier to inject the server-side language into other parts of the full multi-language document, as in CSS or JS. Examples include Smarty for PHP processing.

### fold *`"name-or-string" _style_ +|-`*

Used to describe which tokens start and end a code-folding block. For example:

```
fold "{" CSL_OPERATOR +
  fold "if" SSL_WORD +
  fold "end" SSL_WORD -
```

### keep_delimiter

Used when the `delimiter` directive was used in place of a pattern or string, this tells the UDL lexer to retain that directive for subsequent matching. This is useful for matching a construct like Perl's `s,/,\\,` construct, where we would be using ',' as the regex delimiter, instead of the normal '/'.

### keywords *`name-or-string-list`*

List the words that should be colored as keywords (as opposed to identifiers) in the defined language. Keywords for the target language that are the same as reserved words in Luddite must be quoted.

```
keywords ["__FILE__", "__LINE__", BEGIN, class ensure nil ]
```

### keyword_style *`style-name_ => _style-name`*

This directive works with <tt class="docutils literal">keywords</tt> to tell UDL which identifier-type style needs to be promoted to a keyword style. So all tokens listed in <tt class="docutils literal">keywords</tt> that are colored as the first style normally will be promoted to the second style.

```
keyword_style SSL_IDENTIFIER => SSL_WORD
```

### include `[path/]file`

Include a UDL file. The include path starts with the current directory; if you include a file in a different directory, that file's directory is appended to the include path.

```
include "html2ruby.udl"
```

### include

When used as an argument to the [paint](#paint) keyword, include a style.

### initial *`state-name`*

The state processing for the current family should start at.

```
initial IN_SSL_DEFAULT
```

### language *`name`*

The name of the language being defined. The language directive must be given. It may be given more than once, but only with the same value is given each time. This value shows up in the Komodo UI in places like Language Preferences and the "New File" command.

```
language RHTML
```

### namespace `XML Namespace identifier`

The namespace declaration tells Komodo to load the language service described by the current Luddite program when it sees an XML file that uses the specified namespace as a default attribute value.

```
namespace "http://www.w3.org/2001/XMLSchema"
namespace "http://www.w3.org/1999/XMLSchema"
# Be prepared if a new version is released in a few centuries.
namespace "http://www.w3.org/2525/XMLSchema"
```

### no_keyword

The no_keyword command is used to prevent identifier => keyword promotion when an identifier is recognized. This is useful for programming languages that allow any token, even keywords, to be used in certain contexts, such as after the "." in Python, Ruby, and VBScript, or after "::" or "->" in Perl.

```
state IN_SSL_DEFAULT:
  /\.(?=[a-z])/ : paint(upto, SSL_DEFAULT), \
    paint(include, SSL_OPERATOR), => IN_SSL_NON_KEYWORD_IDENTIFIER_1

  state IN_SSL_NON_KEYWORD_IDENTIFIER_1:
  /[^a-zA-Z0-9_]/ : paint(upto, SSL_IDENTIFIER), redo, no_keyword, \
    => IN_SSL_DEFAULT
```

### paint(`include`|`upto`, *`style-name`*)

These directives are used in state transitions, and are key to the way UDL generates lexers. They appear in a context like this:

```
state IN_SSL_COMMENT_1 :
  /$/ : paint(include, SSL_COMMENT) => IN_SSL_DEFAULT
```

This means that when we're in a state with name "IN_SSL_COMMENT_1" (remember that state names are completely arbitrary in your Luddite programs), and we find the end of the line, we should paint everything from the last "paint point" to the end of the line with the style "SCE_UDL_SSL_COMMENT". This will also move the paint-point to the point after the last character this command styles.

A _transition_ can have a paint(include...) command, a paint(upto...) command, both of them, or neither.

### pattern *`name=string`*

These are used as macro substitution inside patterns used in state tables. The names should contain only letters, and are referenced in patterns and the right-hand side of Luddite patterns by putting a "$" before them.

```
pattern NMSTART = '_\w\x80-\xff' # used inside character sets only
  pattern NMCHAR = '$NMSTART\d'    # used inside character sets only
  ...
  state IN_SSL_SYMBOL_1:
  /[$NMCHAR]+/ : paint(include, SSL_STRING), => IN_SSL_DEFAULT
```

### public_id `DOCTYPE public identifier`

The public_id declaration tells Komodo to load the language service described by the current Luddite program when it sees an XML or SGML file that uses the specified public declaration in its Doctype declaration.

```
public_id "-//MOZILLA//DTD XBL V1.0//EN"
publicid "-//MOZILLA//DTD XBL V1.1//EN" # Be prepared
# "publicid" is a synonym for "public_id"
```

### redo

The redo command indicates that the lexer should not advance past the current characters being matched, but should stay there in the new state.

```
state IN_SSL_NUMBER_3:
  ...
  /[^\d]/ : paint(upto, SSL_NUMBER), redo, => IN_SSL_DEFAULT
```

This specifies that when we're processing numbers (assuming the arbitrary name "IN_SSL_NUMBER_3" reflects the idea that we're trying to recognize numeric terms in the input), and find a non-digit, we should paint everything up to but not including the start of the matched text with the SCE_UDL_SSL_NUMBER style, change to the default state for this family, and retry lexing the same character.

Since having both a `redo` action and a `paint(include...)` action in the same transition would be contradictory, the Luddite compiler gives an error message when it detects this condition and stops processing.

### reject *`name-or-string-list`* | `all`

Used in [token_check](#token_check) definitions to disambiguate characters. If <tt class="docutils literal">all</tt> is specified, then a [token_check](#token_check) test will always fail. If the previous token falls in the [name-or-string](#name-or-string) list, the [token_check](#token_check) test fails. Otherwise Luddite will look at the results of any [reject](#reject) and [skip](#skip) statements in the current family to decide which action to take.

### set_delimiter (*number*)

This transition action takes a single argument, which must be a reference to a grouped sub-pattern in the transition's pattern. It sets the current delimiter to that contents of the subpattern.

```
/m([^\w\d])/ : paint(upto, SSL_DEFAULT), set_delimiter(1), \
    => IN_SSL_REGEX1_TARGET
```

### set_opposite_delimiter (*number*)

This transition action takes a single argument, which must be a reference to a grouped sub-pattern in the transition's pattern. It sets the current delimiter to that contents of the subpattern.

```
/m([\{\[\(\<])/ : paint(upto, SSL_DEFAULT), \
    set_opposite_delimiter(1), => IN_SSL_REGEX1_TARGET
```

### skip *`name-or-string-list`* | `all`

Used in [token_check](#token_check) definitions to disambiguate characters. If <tt class="docutils literal">all</tt> is specified, then a [token_check](#token_check) test will retry with the token preceding this one. If the previous token falls in the [name-or-string](#name-or-string) list, the [token_check](#token_check) test keeps going. Otherwise Luddite will look at the results of any [accept](#accept) and [reject](#reject) statements in the current family to decide which action to take.

### state *`state-name`*: *`transition-list`*

The core of Luddite programs. Each state block is in effect upto the next Luddite keyword.

### sublanguage *`name`*

The common name of the language this family targets.

```
sublanguage ruby
```

### sub_language

Synonym for sublanguage

### system_id *DOCTYPE system identifier*

The system_id declaration tells Komodo to load the language service described by the current Luddite program when it sees an XML or SGML file that uses the specified system declaration in its Doctype declaration.

```  
  system_id "http://www.w3.org/2001/XMLSchema"
  systemid "http://www.w3.org/1999/XMLSchema"
  # "systemid" is a synonym for "system_id"
```

### token_check: *`token-recognition-list`*

A set of directives that define the token checking set for this family.

Used in state _transitions_ immediately after a pattern or string (match target) is given. This is used for token disambiguation. For example in Ruby, Perl, and JavaScript, a '/' can either be a division operator or the start of a regular expression. By looking at how the previous token was styled, we can determine how to interpret this character.

If the token_check test fails, the pattern is deemed to fail, and UDL tries subsequent transitions in the [state](#state) block.

### start_style *`style-name`*

The lowest style in the list of styles Luddite will use for this family (in terms of the values given in Scintilla.iface). This is used for [token_check](#token_check) processing while lexing, so it's not required otherwise.

### end_style

The highest style in the list of styles Luddite will use for this family (in terms of the values given in Scintilla.iface). This is used for [token_check](#token_check) processing while lexing, so it's not required otherwise.

### upto

See [paint](#paint)

### spop_check

See [spush_check](#spush_check)

spush_check(*state-name*)

Used to specify the Luddite state to transition to at a later point.

```
state IN_SSL_DSTRING:
  '#{' : paint(include, SSL_STRING), spush_check(IN_SSL_DSTRING), \
    => IN_SSL_DEFAULT
  ...
  state IN_SSL_OP1:
  '{' : paint(include, SSL_OPERATOR), spush_check(IN_SSL_DEFAULT) \
    => IN_SSL_DEFAULT
  ...
  state IN_SSL_DEFAULT:
  '}' : paint(upto, SSL_DEFAULT), paint(include, SSL_OPERATOR), \
    spop_check, => IN_SSL_DEFAULT
```

This code is used to account for the way the Ruby lexer is intended to color expressions inside #{...} brackets in strings as if they weren't in strings. When the "}" is reached, the lexer needs to know whether it should go back to lexing a string, or to the default state. We use the spush_check and spop_check directives to specify this.

<a id="style-names" name="style-names"></a>
## Style Names

The style names are all listed in <tt class="docutils literal">Scintilla.iface</tt>, in the section for <tt class="docutils literal">UDL</tt>. The ones for client-side, server-side, style, and template languages are generic, and shouldn't need much explanation here. This section will focus on the markup section in specifics.

First, we are limited to about 56 styles, as UDL partitions the style byte associated with each character by 6 bits for styles, 1 bit for error squigging, and 1 bit for warnings. Additionally, scintilla reserves styles 32 through 39 for its own use, leaving us with 56.

This reduces the number of available styles for each family down to the basics. This includes the default style (which should only be used for white-space in most cases), comments, numbers, strings, keywords, identifiers, operators, and regular expressions. We add a style for variable names for the server-side, and leave comment-blocks in as well, although their usefulness is in question.

Some of the styles in the markup block reflect terms used in ISO 8859, the SGML standard. These are:

### SCE_UDL_M_STAGO

Start-tag-open character, as in "<"

### SCE_UDL_M_TAGNAME

The name immediately after a tag-open character.

### SCE_UDL_M_TAGSPACE

White-space in start-tags, end-tags, and empty tags.

### SCE_UDL_M_ATTRNAME

Attribute names in start-tags.

### SCE_UDL_M_OPERATOR

Operator characters, which is essentially just the '=' in attribute assignments in start-tags.

### SCE_UDL_M_STAGC

Start-tag-close character (">")

### SCE_UDL_M_EMP_TAGC

Tag-close sequence for an empty start-tag ("/>")

### SCE_UDL_M_STRING

String attribute values in start-tags

### SCE_UDL_M_ETAGO

End-tag-open character ("</")

### SCE_UDL_M_ETAGC

End-tag-close character (">"). Distinguished from an "STAGC" only by context.

### SCE_UDL_M_ENTITY

A complete entity reference, from the leading "&" through the closing ";".

### SCE_UDL_M_PI

Processing instructions, including the leading XML declaration, from the leading "<?" through the closing "?>".

### SCE_UDL_M_CDATA

CDATA marked sections.

### SCE_UDL_M_COMMENT

SGML comments.

## Terms

### name-or-string

Either a quoted string, delimited by single- or double-quote characters, with -escape sequences, or a sequence of characters starting with a letter, followed by zero or more alphanumeric characters, hyphens, or underscores.

### name-or-string-list

List of strings or non-keyword-names surrounded by square brackets. Commas are optional.

### state-name

A symbolic name for a UDL state. These names are are completely arbitrary, but we recommend the convention that they start with "IN_", then contain a sequence that reflects the family they belong to ("SSL", "CSL", "CSS", "TPL", or "M" for "Markup"), and finally a descriptive part.

### Example:

IN_TPL_BLOCK_COMMENT_1


### style-name

A symbolic name that reflects the style names used in .h files derived from the Scintilla.iface file. You can also see all available styles in the `ScintillaConstants.py` file, which is under your Komodo installation directory. All UDL names start with the prefix "SCE_UDL_", which may always be omitted.

### Example:

SSL_STRING

### token-recognition-list

A line-oriented list of directives containing a _style-name_, a colon, and then an [accept](#accept), [reject](#reject), or [skip](#skip) directive.

### transition-list

Zero or more _transition_, separated by newlines

### transition

Consists of a string or pattern to be matched, an optional _token_check_, ":" (optional), an optional list of actions (comma-separated), and optionally, an "=>" followed by a _style-name_. Actions include [paint](#paint), [redo](#redo), [spush_check](#spush_check), and [spop_check](#spop_check).

<a id="concepts" name="concepts"></a>
## Concepts

- Order of [token_check](#token_check) statements: The statements in a [token_check](#token_check) directive are followed in order, and are family-specific. The default action, if no term is chosen, depend on what kinds of statements are specified:

    -   Only reject list: accept all others
    -   Only accept list: reject everything else
    -   Only skip list: reject everything else, but
    -   having only a set of skip items is redundant, as everything will be
    -   rejected anyway.
    -   If a style has two of the lists, the missing one is the default
    -   If a style has all three lists, the default action is 'reject'.

- Order of state transitions: UDL walks the list of transitions for the current state. As soon as it finds one, it does whatever painting is called for, switches to the specified state, and then restarts at the next state.

The target state is optional. A transition that contains both a "paint(include...)" and a "redo" directive would loop indefinitely, so UDL contains a limit of 1000 before it bypasses the current character and continue with the next one.
