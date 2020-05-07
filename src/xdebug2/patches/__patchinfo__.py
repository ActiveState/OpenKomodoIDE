
"""Apply these patches to the Xdebug Git checkout."""

def applicable(config):
    return 1

def patch_args(config):
    # use -p1 to better match git patches
    return ['-p1']
