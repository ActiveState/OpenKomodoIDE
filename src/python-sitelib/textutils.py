#!/usr/bin/env python
# Copyright (c) 2008 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

r"""Basic text manipulation utilities."""

import os
import sys
import re
from pprint import pprint
import logging



#---- public stuff

# Recipe: text_escape (0.2)
def escaped_text_from_text(text, escapes="eol"):
    r"""Return escaped version of text.

        "escapes" is either a mapping of chars in the source text to
            replacement text for each such char or one of a set of
            strings identifying a particular escape style:
                eol
                    replace EOL chars with '\r' and '\n', maintain the actual
                    EOLs though too
                whitespace
                    replace EOL chars as above, tabs with '\t' and spaces
                    with periods ('.')
                eol-one-line
                    replace EOL chars with '\r' and '\n'
                whitespace-one-line
                    replace EOL chars as above, tabs with '\t' and spaces
                    with periods ('.')
    """
    #TODO:
    # - Add 'c-string' style.
    # - Add _escaped_html_from_text() with a similar call sig.
    import re
    
    if isinstance(escapes, basestring):
        if escapes == "eol":
            escapes = {'\r\n': "\\r\\n\r\n", '\n': "\\n\n", '\r': "\\r\r"}
        elif escapes == "whitespace":
            escapes = {'\r\n': "\\r\\n\r\n", '\n': "\\n\n", '\r': "\\r\r",
                       '\t': "\\t", ' ': "."}
        elif escapes == "eol-one-line":
            escapes = {'\n': "\\n", '\r': "\\r"}
        elif escapes == "whitespace-one-line":
            escapes = {'\n': "\\n", '\r': "\\r", '\t': "\\t", ' ': '.'}
        else:
            raise ValueError("unknown text escape style: %r" % escapes)

    # Sort longer replacements first to allow, e.g. '\r\n' to beat '\r' and
    # '\n'.
    escapes_keys = escapes.keys()
    try:
        escapes_keys.sort(key=lambda a: len(a), reverse=True)
    except TypeError:
        # Python 2.3 support: sort() takes no keyword arguments
        escapes_keys.sort(lambda a,b: cmp(len(a), len(b)))
        escapes_keys.reverse()
    def repl(match):
        val = escapes[match.group(0)]
        return val
    escaped = re.sub("(%s)" % '|'.join([re.escape(k) for k in escapes_keys]),
                     repl,
                     text)

    return escaped

def one_line_summary_from_text(text, length=78,
        escapes={'\n':"\\n", '\r':"\\r", '\t':"\\t"}):
    r"""Summarize the given text with one line of the given length.
    
        "text" is the text to summarize
        "length" (default 78) is the max length for the summary
        "escapes" is a mapping of chars in the source text to
            replacement text for each such char. By default '\r', '\n'
            and '\t' are escaped with their '\'-escaped repr.
    """
    if len(text) > length:
        head = text[:length-3]
    else:
        head = text
    escaped = escaped_text_from_text(head, escapes)
    if len(text) > length:
        summary = escaped[:length-3] + "..."
    else:
        summary = escaped
    return summary


# Recipe: break_up_words (1.0)
def break_up_words(text, max_word_length=50):
    """Break up words(*) in the given string so no word is longer than
    `max_word_length`.
    
    Here a "word" means any consecutive string of characters not separated
    by whitespace.
    
    @param text {str} The string in which to break up words.
    @param max_length {int} The max word length. Default is 50.
    """
    import re
    bit_is_word = True
    bits = []
    splitter = u"\u200b" # zero-width space
    if isinstance(text, str):
        try:
            text = unicode(text)
        except UnicodeDecodeError:
            splitter = " " # ASCII space
    for bit in re.split(r"(\s+)", text, re.UNICODE):
        if bit_is_word:
            while len(bit) > max_word_length:
                head, bit = bit[:max_word_length], bit[max_word_length:]
                bits.append(head)
                bits.append(splitter)
            bits.append(bit)
        else:
            bits.append(bit)
        bit_is_word = not bit_is_word
    return ''.join(bits)

def break_up_lines(text, max_line_width=80):
    """Break up the text in the given string so no line is longer than
    `max_line_width`. Any existing line endings are left unchanged.
    
    If any containing word is longer than this line width, then it will
    be broken up in order to meet the line width restrictions. A "word"
    means any consecutive string of characters not separated by whitespace.
    
    @param text {str} The string in which to break up words.
    @param max_line_width {int} The maximum line width allowed. Default is 80.
    """
    import textwrap
    lines = []
    for line in text.split("\n"):
        if not line:
            # need to manually append, otherwise textwrap eats it
            lines.append(line)
        else:
            lines += textwrap.wrap(line, max_line_width)
    return '\n'.join(lines)



#---- self-test

def _test():
    import doctest
    doctest.testmod()

if __name__ == "__main__":
    _test()
    

