
import sys
from os.path import *
import os
from glob import glob
from pprint import pprint, pformat


def unused():
    """Print the unused (to the best of this script's knowledge) images
    under here.
    """
    assert basename(os.getcwd()) == "images", \
        "must run `unused.py' from the `src/images' dir"
    conscript = open("Conscript", 'r').read()
    
    skips = set(["Thumbs.db"])
    for path in glob(join("icons", "*.*")):
        if basename(path) in skips:
            continue
        #print path
        cpath = path.replace("\\", "/") # canonicalize
        if cpath not in conscript:
            print "`%s' not in images Conscript: unused?" % cpath
    
    
    
if __name__ == '__main__':
    unused()
