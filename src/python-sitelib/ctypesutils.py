# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

# Put pywin32 replacement code here that can use pure ctypes,
# no dependencies on wnd or comtypes

from ctypes import *
from ctypes.wintypes import *

# Constants from wnd.wintypes:
LPVOID = c_void_p

# Constants from wnd.api.functions, wnd.wintypes, etc.

FO_DELETE      = 3
FOF_NOCONFIRMATION     =   16  # Don't prompt the user.
FOF_ALLOWUNDO      =        64

# Types needed for move_to_trash
class SHFILEOPSTRUCT(Structure):
    _fields_ = [("hwnd", HWND),
                ("wFunc", UINT),
                ("pFrom", LPCSTR),
                ("pTo", LPCSTR),
                ("fFlags", c_ulong),
                ("fAnyOperationsAborted", BOOL),
                ("hNameMappings", LPVOID),
                ("lpszProgressTitle", LPCSTR)]
        
def move_to_trash(filename):
    # Works only for ascii filenames
    sho=SHFILEOPSTRUCT()
    sho.hwnd = 0
    sho.wFunc = FO_DELETE
    sho.fFlags = FOF_ALLOWUNDO|FOF_NOCONFIRMATION
    sho.pFrom = filename + u"\x00"
    sho.pTo = None
    sho.fAnyOperationsAborted = False
    sho.hNameMappings = None
    sho.lpszProgressTitle = None
    res = windll.shell32.SHFileOperation(byref(sho))
    if res or sho.fAnyOperationsAborted:
        return False
    return True
