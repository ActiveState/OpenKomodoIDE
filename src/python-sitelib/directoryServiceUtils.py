# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

"""utility functions to make using nsIDirectoryService a little easier.
"""

import os
import sys
from xpcom import components, COMException, _xpcom
import ConfigParser

Cc = components.classes
Ci = components.interfaces

nsIDirectoryServiceContractID = "@mozilla.org/file/directory_service;1";
nsIProperties = Ci.nsIProperties;
directoryService =  Cc[nsIDirectoryServiceContractID].getService(nsIProperties);

def getFiles(key):
    """getFiles
    
    gets a list of nsIFile objects from the directory service.
    """
    enum = directoryService.get(key, Ci.nsISimpleEnumerator);
    files = []
    while enum.hasMoreElements():
        files.append(enum.getNext().QueryInterface(Ci.nsIFile))
    return files

def getFile(key):
    """getFiles
    
    gets a nsIFile object from the directory service.
    """
    return directoryService.get(key, Ci.nsIFile);

_gExtensionDirectoriesCache = None
def getExtensionDirectories():
    """Get extension directories.
    
    @returns A list of full paths to all installed and enabled extension
        directories.
    """
    global _gExtensionDirectoriesCache
    if _gExtensionDirectoriesCache is None:
        dirs = [d.path for d in getFiles("XREExtDL")]
        # Allow a custom directory service to provide additional extension
        # directories using the special "PyxpcomExtDirList" key.
        try:
            dirs += [d.path for d in getFiles("PyxpcomExtDirList")]
        except COMException:
            pass
        if not dirs:
            # Okay, that didn't work; perhaps we're just in early startup.
            # _Hopefully_ this means XREExtDL isn't valid yet; pass an empty
            # list back, but don't update the cache since we might have better
            # luck next time.
            return []
        # Make them unique - ordering does not matter.
        _gExtensionDirectoriesCache = list(set(dirs))
    return _gExtensionDirectoriesCache

_gPylibDirectoriesCache = None
def getPylibDirectories():
    """Get pylib directories.
    
    @returns A list of full paths to all "pylib" directories in all
        installed (and enabled?) extensions.
    """
    global _gPylibDirectoriesCache
    if _gPylibDirectoriesCache is None:
        dirs = set()
        for dir in getExtensionDirectories():
            d = os.path.join(dir, "pylib")
            # Note: pyxpcom will place these pylib paths on the sys.path (when
            #       they exist)
            if d in sys.path:
                dirs.add(d)
            elif os.path.exists(d):
                dirs.add(d)
                # Add to sys.path, saves pyxpcom having to do it later.
                sys.path.append(d)
        _gPylibDirectoriesCache = list(dirs)
    return _gPylibDirectoriesCache

_gExtensionCategoryDirsCache = {}
def getExtensionCategoryDirs(xpcom_category, relpath=None, extension_id=None):
    """Return extension dirpaths, registered via the given xpcom-category.

    Note: It will return paths that have an category entry that matches the
    extension id, e.g.:
        catagory  xpcom_category  myext@ActiveState.com  ignored_field
    will return:
        [ "/path/to/myext@ActiveState.com" ]
    """
    # Check the cache.
    cache_key = (xpcom_category, relpath, extension_id)
    dirs = _gExtensionCategoryDirsCache.get(cache_key)
    if dirs is not None:
        return dirs

    if extension_id:
        extension_id = os.path.normcase(extension_id)

    # Generate the directories.
    extension_dirs = getExtensionDirectories()
    dirs = []
    for entry in _xpcom.GetCategoryEntries(xpcom_category):
        extension_name = os.path.normcase(entry.split(" ")[0])

        # If looking for a specific extension.
        if extension_id and extension_id != extension_name:
            continue

        for ext_dir in extension_dirs:
            if os.path.normcase(os.path.basename(ext_dir)) == extension_name:
                candidate = ext_dir
                if relpath:
                    candidate = os.path.join(ext_dir, relpath)
                    if os.path.exists(candidate):
                        dirs.append(candidate)
                        break
    _gExtensionCategoryDirsCache[cache_key] = dirs
    return dirs

def getExtensionLexerDirs(relpath="lexers"):
    """Return the available (and enabled) extension lexer directories."""
    return getExtensionCategoryDirs("udl-lexers", relpath=relpath)

def getExtensionToolboxDirs(relpath="tools", extension_id=None):
    """Return the available (and enabled) extension tools directories."""
    return getExtensionCategoryDirs("toolbox", relpath=relpath, extension_id=extension_id)
