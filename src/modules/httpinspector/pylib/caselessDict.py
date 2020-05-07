#
# Case insensitive dictionary
#
# Author: Jeff Donner
#  - See: http://aspn.activestate.com/ASPN/Cookbook/Python/Recipe/66315
#

"""This relies on the fact that in 2.4 you can derive from 'dict' like any
other class. Also, note that this /changes/ the key, to your canonical (here,
lowercase) form; it doesn't leave it in the dictionary as given while
continuing to match it case-insensitively as the previous examples do.
"""

class CaselessDict(dict):
    def __init__(self, other=None):
        if other:
            # Doesn't do keyword args
            if isinstance(other, dict):
                for k,v in other.items():
                    dict.__setitem__(self, k.lower(), v)
            else:
                for k,v in other:
                    dict.__setitem__(self, k.lower(), v)

    def __getitem__(self, key):
        return dict.__getitem__(self, key.lower())

    def __setitem__(self, key, value):
        dict.__setitem__(self, key.lower(), value)

    def __contains__(self, key):
        return dict.__contains__(self, key.lower())

    def has_key(self, key):
        return dict.has_key(self, key.lower())

    def get(self, key, def_val=None):
        return dict.get(self, key.lower(), def_val)

    def setdefault(self, key, def_val=None):
        return dict.setdefault(self, key.lower(), def_val)

    def update(self, other):
        for k,v in other.items():
            dict.__setitem__(self, k.lower(), v)

    def fromkeys(self, iterable, value=None):
        d = CaselessDict()
        for k in iterable:
            dict.__setitem__(d, k.lower(), value)
        return d

    def pop(self, key, def_val=None):
        return dict.pop(self, key.lower(), def_val)
