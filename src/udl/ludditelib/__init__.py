# Intentionally empty. Here just to make this a Python package.
import os, sys
if os.path.exists(os.path.join(os.path.dirname(__file__), "../chromereg.py")):
    # in an installed komodo
    sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
elif os.path.exists(os.path.join(os.path.dirname(__file__), "../../sdk/pylib/chromereg.py")):
    # in a source directory
    sys.path.append(os.path.join(os.path.dirname(__file__), "../../sdk/pylib"))
elif os.path.exists(os.path.join(os.path.dirname(__file__), "../../../../src/sdk/pylib/chromereg.py")):
    # in a build tree, on osx (sys.executable is broken, reach into the source tree)
    sys.path.append(os.path.join(os.path.dirname(__file__), "../../../../src/sdk/pylib"))
