#!/usr/bin/env python
# Copyright (c) 2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""Backend for Tasks feature in Komodo

See KD 240 for details.

Dev Notes:
- Requires Python 2.5+: for `with` statement.
"""

__version_info__ = (0, 1, 0)
__version__ = '.'.join(map(str, __version_info__))


import logging


log = logging.getLogger("taskslib")
#log.setLevel(logging.DEBUG)  # for dev/debugging

