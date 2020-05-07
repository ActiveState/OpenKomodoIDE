---
title: Regular Expressions Primer
---
<a name="about_primer" id="about_primer"></a>
## About this Primer

The Regular Expressions Primer is a tutorial for those
completely new to regular expressions. To familiarize you with
regular expressions, this primer starts with the simple building
blocks of the syntax and through examples, builds to construct
expressions useful for solving real every-day problems including
searching for and replacing text.

A regular expression is often called a "regex", "rx" or "re".
This primer uses the terms "regular expression" and "regex".

Unless otherwise stated, the examples in this primer are
generic, and will apply to most programming languages and tools.
However, each language and tool has its own implementation of
regular expressions, so quoting conventions, metacharacters,
special sequences, and modifiers may vary (e.g. Perl, Python,
grep, sed, and Vi have slight variations on standard regex
syntax). Consult the regular expression documentation for your
language or application for details.

<a name="about_regex" id="about_regex"></a>
## What are regular expressions?

Regular expressions are a syntactical shorthand for describing
patterns. They are used to find text that matches a pattern, and
to replace matched strings with other strings. They can be used
to parse files and other input, or to provide a powerful way to
search and replace. Here's a short example in Python:

```
import re
n = re.compile(r'\bw[a-z]*', re.IGNORECASE)
print n.findall('will match all words beginning with the letter w.')
```

Here's a more advanced regular expression from the <a href="/tutorial/pythontut.html">Python Tutorial</a>:

```
# Generate statement parsing regexes.
stmts = ['#\s*(?P&lt;op&gt;if|elif|ifdef|ifndef)\s+(?P&lt;expr&gt;.*?)',
       '#\s*(?P&lt;op&gt;else|endif)',
       '#\s*(?P&lt;op&gt;error)\s+(?P&lt;error&gt;.*?)',
       '#\s*(?P&lt;op&gt;define)\s+(?P&lt;var&gt;[^\s]*?)(\s+(?P&lt;val&gt;.+?))?',
       '#\s*(?P&lt;op&gt;undef)\s+(?P&lt;var&gt;[^\s]*?)']
patterns = ['^\s*%s\s*%s\s*%s\s*$'
          % (re.escape(cg[0]), stmt, re.escape(cg[1]))
          for cg in cgs for stmt in stmts]
stmtRes = [re.compile(p) for p in patterns]
```

Komodo can accept Python syntax regular expressions in its
various <a href="/manual/search.html#search_top">Search</a>
features.

Komodo IDE's Rx Toolkit can help you build and test regular expressions. See <a class="doc" href="regex.html#regex_top">Using Rx Toolkit</a> for more information.

## Matching: Searching for a String

Regular expressions can be used to find a particular pattern, or to find a pattern and replace it with something else (<a href="#substitution">substitution</a>). Since the syntax is same for the "find" part of the regex, we'll start with matching.

### Literal Match

The simplest type of regex is a literal match. Letters,
numbers and most symbols in the expression will match themselves
in the the text being searched; an "a" matches an "a", "cat"
matches "cat", "123" matches "123" and so on. For example:

**Example**: Search for the string "at".

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
at
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
at
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
it
a-t
At
</pre>
  </li>
</ul>

<p><strong>Note:</strong> Regular expressions are case sensitive
unless a <a href="#modifiers">modifier</a> is used .</p>

<a name="wildcards" id="wildcards"></a>
### Wildcards

<p>Regex characters that perform a special function instead of
matching themselves literally are called "metacharacters". One
such metacharacter is the dot ".", or wildcard. When used in a
regular expression, "." can match any single character.</p>

<p><strong>Using "." to match any character.</strong></p>

<p><strong>Example</strong>: Using '.' to find certain types of
words.</p>

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
t...s
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
trees
trams
teens
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
trucks
trains
beans
</pre>
  </li>
</ul>

<a name="escaping" id="escaping"></a>
### Escaping Metacharacters

<p>Many non-alphanumeric characters, like the "." mentioned
above, are treated as special characters with specific functions
in regular expressions. These special characters are called
metacharacters. To search for a <em>literal</em> occurrence of a
metacharacter (i.e. ignoring its special regex attribute),
precede it with a backslash "\". For example:</p>

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
c:\\readme\.txt
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
c:\readme.txt
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
c:\\readme.txt
c:\readme_txt
</pre>
  </li>
</ul>

<p>Precede the following metacharacters with a backslash "\" to
search for them as literal characters:</p>

<p><code>^ $ + * ? . | ( ) { } [ ] \</code></p>

<p>These metacharacters take on a special function (covered
below) unless they are escaped. Conversely, some characters take
on special functions (i.e. become metacharacters) when they
<em>are</em> preceeded by a backslash (e.g. "\d" for "any digit"
or "\n" for "newline"). These special sequences vary from
language to language; consult your language documentation for a
comprehensive list.</p>

<a name="quantifiers" id="quantifiers"></a>
### Quantifiers

<p>Quantifiers specify how many instances of the preceeding
element (which can be a character or a <a href=
"#parentheses">group</a>) must appear in order to match.</p>

<a name="question_mark" id="question_mark"></a>
#### Question mark

<p>The "?" matches 0 or 1 instances of the previous element. In
other words, it makes the element optional; it can be present,
but it doesn't have to be. For example:</p>

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
colou?r
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
colour
color
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
colouur
colur
</pre>
  </li>
</ul>

<a name="asterisk" id="asterisk"></a>
#### Asterisk

<p>The "*" matches 0 or more instances of the previous element.
For example:</p>

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
www\.my.*\.com
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
www.my.com
www.mypage.com
www.mysite.com then text with spaces ftp.example.com
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
www.oursite.com
mypage.com
</pre>
  </li>
</ul>

<p>As the third match illustrates, using ".*" can be dangerous.
It will match <em>any</em> number of <em>any</em> character
(including spaces and non alphanumeric characters). The
quantifier is "greedy" and will match as much text as possible.
To make a quantifier "non-greedy" (matching as few characters as
possible), add a "?" after the "*". Applied to the example above,
the expression "<code>www\.my.*?\.com</code>" would match just
"<code>www.mysite.com</code>", not the longer string.</p>

<a name="plus" id="plus"></a>
#### Plus

<p>The "+" matches 1 or more instances of the previous element.
Like "*", it is greedy and will match as much as possible unless
it is followed by a "?".</p>

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
bob5+@foo\.com
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
bob5@foo.com
bob5555@foo.com
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
bob@foo.com
bob65555@foo.com
</pre>
  </li>
</ul>

<a name="number" id="number"></a>
#### Number: '{N}'

<p>To match a character a specific number of times, add that
number enclosed in curly braces after the element. For
example:</p>

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
w{3}\.mydomain\.com
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
www.mydomain.com
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
web.mydomain.com
w3.mydomain.com
</pre>
  </li>
</ul>

<a name="ranges" id="ranges"></a>
#### Ranges: '{min, max}'

<p>To specify the minimum number of matches to find and the
maximum number of matches to allow, use a number range inside
curly braces. For example:</p>

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
60{3,5} years
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
6000 years
60000 years
600000 years
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
60 years
6000000 years
</pre>
  </li>
</ul>

<a name="quantifiersummary" id="quantifiersummary"></a>
#### Quantifier Summary

<table summary="Quantifiers" border="1" cellpadding="5" width=
"50%" style="margin-left: 3em">
  <tr>
    <td width="20%"><strong>Quantifier</strong></td>

    <td width="80%"><strong>Description</strong></td>
  </tr>

  <tr>
    <td>?</td>

    <td>Matches any preceding element 0 or 1 times.</td>
  </tr>

  <tr>
    <td>*</td>

    <td>Matches the preceding element 0 or more times.</td>
  </tr>

  <tr>
    <td>+</td>

    <td>Matches the preceding element 1 or more times.</td>
  </tr>

  <tr>
    <td>{<em>num</em>}</td>

    <td>Matches the preceding element <em>num</em> times.</td>
  </tr>

  <tr>
    <td>{<em>min</em>, <em>max</em>}</td>

    <td>Matches the preceding element at least <em>min</em>
    times, but not more than <em>max</em> times.</td>
  </tr>
</table>

<a name="alternation" id="alternation"></a>
### Alternation

<p>The vertical bar "|" is used to represent an "OR" condition.
Use it to separate alternate patterns or characters for matching.
For example:</p>

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
perl|python
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
perl
python
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
ruby
</pre>
  </li>
</ul>

<a name="parentheses" id="parentheses"></a>
### Grouping with Parentheses

Parentheses "()" are used to group characters and expressions
within larger, more complex regular expressions. Quantifiers that
immediately follow the group apply to the whole group. For
example:

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
(abc){2,3}
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
abcabc
abcabcabc
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
abc
abccc
</pre>
  </li>
</ul>

<p>Groups can be used in conjunction with alternation. For
example:</p>

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
gr(a|e)y
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
gray
grey
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
graey
</pre>
  </li>
</ul>

<p>Strings that match these groups are stored, or "delimited",
for use in <a href="#substitution">substitutions</a> or
subsequent statements. The first group is stored in the
metacharacter "\1", the second in "\2" and so on. For
example:</p>

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
(.{2,5}) (.{2,8}) &lt;\1_\2@example\.com&gt;
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
Joe Smith &lt;Joe_Smith@example.com&gt;
jane doe &lt;jane_doe@example.com&gt;
459 33154 &lt;459_33154@example.com&gt;
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
john doe &lt;doe_john@example.com&gt;
Jane Doe &lt;janie88@example.com&gt;
</pre>
  </li>
</ul>

<a name="charclass" id="charclass"></a>
### Character Classes

<p>Character classes indicate a set of characters to match.
Enclosing a set of characters in square brackets "[...]" means
"match any one of these characters". For example:</p>

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
[cbe]at
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
cat
bat
eat
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
sat
beat
</pre>
  </li>
</ul>

<p>Since a character class on its own only applies to one
character in the match, combine it with a quantifier to search
for multiple instances of the class. For example:</p>

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
[0123456789]{3}
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
123
999
376
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
W3C
2_4
</pre>
  </li>
</ul>

<p>If we were to try the same thing with letters, we would have
to enter all 26 letters in upper and lower case. Fortunately, we
can specify a range instead using a hyphen. For example:</p>

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
[a-zA-Z]{4}
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
Perl
ruby
SETL
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
1234
AT&amp;T
</pre>
  </li>
</ul>

<p>Most languages have special patterns for representing the most
commonly used character classes. For example, Python uses "\d" to
represent any digit (same as "[0-9]") and "\w" to represent any
alphanumeric, or "word" character (same as "[a-zA-Z_]"). See your
language documentation for the special sequences applicable to
the language you use.</p>

<a name="neg_charclass" id="neg_charclass"></a>
### Negated Character Classes

<p>To define a group of characters you do <em>not</em> want to
match, use a negated character class. Adding a caret "^" to the
beginning of the character class (i.e. [^...]) means "match any
character <em>except</em> these". For example:</p>

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
[^a-zA-Z]{4}
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
1234
$.25
#77;
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
Perl
AT&amp;T
</pre>
  </li>
</ul>

<a name="anchors" id="anchors"></a>
### Anchors: Matching at Specific Locations

Anchors are used to specify where in a string or line to look
for a match. The "^" metacharacter (when not used at the
beginning of a negated character class) specifies the beginning
of the string or line:

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
^From: root@server.*
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
From: root@server.example.com
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
I got this From: root@server.example.com yesterday
&gt;&gt; From: root@server.example.com
</pre>
  </li>
</ul>

<p>The "$" metacharacter specifies the end of a string or
line:</p>

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
.*\/index.php$
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
www.example.org/index.php
the file is /tmp/index.php
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
www.example.org/index.php?id=245
www.example.org/index.php4
</pre>
  </li>
</ul>

<p>Sometimes it's useful to anchor both the beginning and end of
a regular expression. This not only makes the expression more
specific, it often improves the performance of the search.</p>

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
^To: .*example.org$
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
To: feedback@example.org
To: hr@example.net, qa@example.org
</pre>
  </li>

  <li>
    <strong>Doesn't Match</strong>:
    <pre class="code">
To: qa@example.org, hr@example.net
Send a Message To: example.org
</pre>
  </li>
</ul>

<a name="substitution" id="substitution"></a>
## Substitution: Searching and Replacing

<p>Regular expressions can be used as a "search and replace"
tool. This aspect of regex use is known as substitution.</p>

<p>There are many variations in substitution syntax depending on
the language used. This primer uses the
"/search/replacement/modifier" convention used in Perl. In simple
substitutions, the "search" text will be a regex like the ones
we've examined above, and the "replace" value will be a
string:</p>

<p>For example, to earch for an old domain name and replace it
with the new domain name:</p>

<ul>
  <li>
    <strong>Regex Substitution</strong>:
    <pre class="code">
s/http:\/\/www\.old-domain\.com/http://www.new-domain.com/
</pre>
  </li>

  <li>
    <strong>Search for</strong>:
    <pre class="code">
http://www.old-domain.com
</pre>
  </li>

  <li>
    <strong>Replace with</strong>:
    <pre class="code">
http://www.new-domain.com
</pre>
  </li>
</ul>

<p>Notice that the "/" and "." characters are not escaped in the
replacement string. In replacement strings, they do not need to
be. In fact, if you were to preceed them with backslashes, they
would appear in the substitution literally (i.e.
"http:\/\/www\.new-domain\.com").</p>

<p>The one way you can use the backslash "\" is to put saved
matches in the substitution using "\<em>num</em>". For
example:</p>

<ul>
  <li>
    <strong>Substitution Regex</strong>:
    <pre class="code">
s/(ftp|http):\/\/old-domain\.(com|net|org)/\1://new-domain.\2/
</pre>
  </li>

  <li>
    <strong>Target Text</strong>:
    <pre class="code">
http://old-domain.com
</pre>
  </li>

  <li>
    <strong>Result</strong>:
    <pre class="code">
http://new-domain.com
</pre>
  </li>
</ul>

<p>This regex will actually match a number of URLs other than
"http://old-domain.com". If we had a list of URLs with various
permutations, we could replace all of them with related versions
of the new domain name (e.g. "ftp://old-domain.net" would become
"ftp://new-domain.net"). To do this we need to use a
modifier.</p>

<a name="modifiers" id="modifiers"></a>
## Modifiers

<p>Modifiers alter the behavior of the regular expression. The
previous substitution example replaces only the first occurence
of the search string; once it finds a match, it performs the
substitution and stops. To modify this regex in order to replace
all matches in the string, we need to add the "g" modifier.</p>

<ul>
  <li>
    <strong>Substitution Regex</strong>:
    <pre class="code">
/(ftp|http):\/\/old-domain\.(com|net|org)/\1://new-domain.\2/g
</pre>
  </li>

  <li>
    <strong>Target Text</strong>:
    <pre class="code">
http://old-domain.com and ftp://old-domain.net
</pre>
  </li>

  <li>
    <strong>Result</strong>:
    <pre class="code">
http://new-domain.com and ftp://new-domain.net
</pre>
  </li>
</ul>

<p>The "i" modifier causes the match to ignore the case of
alphabetic characters. For example:</p>

<ul>
  <li>
    <strong>Regex</strong>:
    <pre class="code">
/ActiveState\.com/i
</pre>
  </li>

  <li>
    <strong>Matches</strong>:
    <pre class="code">
activestate.com
ActiveState.com
ACTIVESTATE.COM
</pre>
  </li>
</ul>

<a name="modifiersummary" id="modifiersummary"></a>
### Modifier Summary

<table summary="Modifiers" border="1" cellpadding="5" width="50%"
style="margin-left: 3em">
  <tr>
    <td width="20%" valign="top"><strong>Modifier</strong></td>

    <td width="80%" valign="top"><strong>Meaning</strong></td>
  </tr>

  <tr>
    <td>i</td>

    <td>Ignore case when matching exact strings.</td>
  </tr>

  <tr>
    <td>m</td>

    <td>Treat string as multiple lines. Allow "^'' and "$'' to
    match next to newline characters.</td>
  </tr>

  <tr>
    <td>s</td>

    <td>Treat string as single line. Allow ".'' to match a
    newline character.</td>
  </tr>

  <tr>
    <td>x</td>

    <td>Ignore whitespace and newline characters in the regular
    expression. Allow comments.&nbsp;</td>
  </tr>

  <tr>
    <td>o</td>

    <td>Compile regular expression once only.</td>
  </tr>

  <tr>
    <td>g</td>

    <td>Match all instances of the pattern in the target
    string.</td>
  </tr>
</table>

<a name="python_regex_syntax" id="python_regex_syntax"></a>
## Python Regex Syntax

<p>Komodo's <a href=
"search.html#search_top">Search</a> features
(including "Find...", "Replace..." and "Find in Files...") can
accept plain text, glob style matching (called "wildcards" in the
drop list, but using "." and "?" differently than regex
wildcards), and Python regular expressions. A complete guide to
regexes in Python can be found in the <a target="_blank" href=
"http://docs.activestate.com/activepython/2.7/python/library/re.html">
Python documentation</a>. The <a target="_blank" href=
"http://docs.activestate.com/activepython/2.7/python/howto/regex.html">Regular Expression
HOWTO</a> by A.M. Kuchling is a good introduction to regular
expresions in Python.</p>

<a name="more" id="more"></a>
## More Regex Resources

<p><strong>Beginner</strong>:</p>

<ul>
  <li><a target="_blank" href=
  "http://docs.activestate.com/activepython/2.7/python/library/re.html">
  Python Standard Library: re - Regular Expression Operations</a></li>

  <li><a target="_blank" href=
  "http://code.activestate.com/search/recipes/#q=regular%20expression">ActiveState
  Code</a> regular expression recipes</li>

  <li><a target="_blank" href=
  "http://www.onlamp.com/pub/a/onlamp/2003/08/21/regexp.html">Five
  Habits for Successful Regular Expressions</a>, The O'Reilly
  ONLamp Resource Center</li>

  <li><a target="_blank" href=
  "http://www.perl.com/pub/a/2000/11/begperl3.html">Beginner's
  Introduction to Perl - Part 3</a>, The O'Reilly Perl Resource
  Center</li>
</ul>

<p><strong>Intermediate</strong>:</p>

<ul>
  <li><a target="_blank" href=
  "http://www.perl.com/pub/a/2003/06/06/regexps.html">Regexp
  Power</a>, The O'Reilly Perl Resource Center</li>
</ul>

<p><strong>Advanced</strong>:</p>

<ul>
  <li><a target="_blank" href=
  "http://www.perl.com/pub/a/2003/07/01/regexps.html">Power
  Regexps, Part II</a>, The O'Reilly Perl Resource Center</li>
</ul>

<p><strong>Language-Specific</strong>:</p>

<ul>
  <li>Perl: <a target="_blank" href=
  "http://perldoc.perl.org/perlre.html">http://perldoc.perl.org/perlre.html</a></li>

  <li>PHP: <a target="_blank" href=
  "http://www.php.net/manual/en/ref.pcre.php">http://www.php.net/manual/en/ref.pcre.php</a></li>

  <li>Python: <a target="_blank" href=
  "https://docs.python.org/3.6/library/re.html">https://docs.python.org/3.6/library/re.html</a></li>

  <li>Ruby: <a target="_blank" href=
  "http://www.ruby-doc.org/core/Regexp.html">http://www.ruby-doc.org/core/Regexp.html</a></li>

  <li>Tcl: <a target="_blank" href=
  "http://www.tcl.tk/man/tcl8.4/TclCmd/re_syntax.htm">http://www.tcl.tk/man/tcl8.4/TclCmd/re_syntax.htm</a></li>

  <li>Javascript: <a target="_blank" href=
  "https://developer.mozilla.org/en/JavaScript/Guide/Regular_Expressions">
  https://developer.mozilla.org/en/JavaScript/Guide/Regular_Expressions</a></li>
</ul><br />
<hr />
