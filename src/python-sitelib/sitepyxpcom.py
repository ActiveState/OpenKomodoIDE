# Copyright (c) 2005-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""Komodo's sitepyxpcom: loaded by the PyXPCOM Component Loader
(pyloader) during XPCOM initialization.

Redirect Python's stdout/stderr to log files in Komodo user app data
dir. This is necessary on Windows if running without a console
(subsystem:windows). Otherwise Python output during PyXPCOM registration
can choke, fail, result in borked PyXPCOM and result in faulty Komodo
startup.

As well, these log files might be useful for debugging.

Note: this is only done for non-verbose mode. I.e. if "-v" is used the
output is written to the console.
"""

import os
import sys
import codecs

def redirect_std_handles():
    stdout_log_name = "pystdout.log"
    stderr_log_name = "pystderr.log"

    # Save the old handles.
    sys.stderr_orig = sys.stderr
    sys.stdout_orig = sys.stdout

    log_dir = None
    if sys.platform.startswith("win"):
        # on Windows, os.environ uses the ANSI (MBCS) APIs; that falls on its
        # face if the environment variable we want contains Unicode.  Use ctypes
        # to fetch what we want instead.  See bug 94439.
        # Note that sometimes this will fail; just fall back to os.environ in
        # that case.  See bug 95367.
        import ctypes
        _wgetenv = ctypes.cdll.msvcrt._wgetenv
        _wgetenv.argtypes = [ctypes.c_wchar_p]
        _wgetenv.restype = ctypes.c_wchar_p
        log_dir = _wgetenv("_KOMODO_VERUSERDATADIR")

    if log_dir is None:
        log_dir = os.environ.get("_KOMODO_VERUSERDATADIR", None)

    if log_dir is not None:
        stdout_log_path = os.path.join(log_dir, stdout_log_name)
        stderr_log_path = os.path.join(log_dir, stderr_log_name)
        sys.stdout = codecs.open(stdout_log_path, "w", "UTF-8")
        sys.stderr = codecs.open(stderr_log_path, "w", "UTF-8")
    else:
        # Fallback to "writing" to /dev/null.
        class NullWriter:
            def __init__(self, name):
                self.name = name
            def write(self, s): pass
            def writelines(self, s): pass
            def flush(self): pass
            def close(self):
                self.closed = True
        sys.stdout = NullWriter("<stdout>")
        sys.stderr = NullWriter("<stderr>")


#---- mainline

if not os.environ.has_key("KOMODO_VERBOSE"):
    redirect_std_handles()

if __debug__ or os.environ.has_key("KOMODO_DEVELOPER"):
    import thread_helper
