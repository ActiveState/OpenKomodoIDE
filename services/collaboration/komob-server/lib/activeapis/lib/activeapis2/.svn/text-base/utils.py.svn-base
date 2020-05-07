
"""Utilities for the 'activeapis2' package."""

import os
import datetime
try:
    import httplib2  # `pip install httplib2`, http://code.google.com/p/httplib2/
except ImportError:
    # HACK for Trent's benefit.
    import sys
    from os.path import expanduser
    sys.path.insert(0, expanduser("~/src/httplib2"))
    import httplib2
try:
    import simplejson as jsonlib
except ImportError:
    try:
        import json as jsonlib
    except ImportError:
        from django.utils import simplejson as jsonlib



def json_serialize_default(o):
    """A 'default' function for JSON serialization (`simplejson.dumps`) that
    does the following:
    
    - serialize `datetime.date` objects as 'YYYY-MM-DD'.
    
    Example usage:
    
    >>> from activeapis2.utils import jsonlib, json_serialize_default
    >>> jsonlib.dumps(datetime.date.today(),
    ...     default=json_serialize_default)
    '2009-10-15'
    """
    if isinstance(o, datetime.date):
        return o.strftime("%Y-%m-%d")
    raise TypeError(repr(o) + " is not JSON serializable")


def get_http(http_cache_dir=None, scope="activeapis2", timeout=None):
    """Return an `httplib2.Http` using a cache in the given base dir."""
    if http_cache_dir:
        cache = _get_httplib2_cache(os.path.join(http_cache_dir, scope))
    else:
        cache = None
    return httplib2.Http(cache, timeout=timeout)

# An httplib2.safename replacement that makes for a shorter safename
# to help avoid running into the 270 char path limit on Windows.
def _http_cache_safename(filename):
    LIMIT = 150  # instead of httplib2's 200
    safe = httplib2.safename(filename)
    fname, fmd5 = safe.rsplit(',', 1)
    s = ','.join((fname[:LIMIT], fmd5))
    return s

def _get_httplib2_cache(cache_dir):
    return httplib2.FileCache(cache_dir, _http_cache_safename)


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

