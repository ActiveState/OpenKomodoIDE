#!/usr/bin/env python
# Copyright (c) 2005-2006 ActiveState Software Inc.
# Author:
#   Trent Mick (TrentM@ActiveState.com)

"""Remotely run Komodo builds (and other tasks).

Note that this script presumes that you have password-less SSL
authentication setup to each machine (i.e. the current box has to have
an SSH agent running). See this document for a good intro to doing that:
    https://sourceforge.net/docman/display_doc.php?docid=761&group_id=1

The exit value is the number of task failures.

examples:
  rrun.py ping              # ping all machines
  rrun.py -m linux koide    # build Komodo IDE on Linux boxes
  rrun.py -m gila kodev     # build Komodo dev tree on the machine 'gila'

komodo build tasks:
  ko                    Full Komodo IDE build
  ok                    Full Komodo Edit build

  kodev                 sync and build in komodo build tree
  kodev-configure       sync and configure (default config) in komodo
  kodev-reconfigure     sync and re-configure in the komodo build tree
  kodev-test            sync and run 'bk test' in komodo build tree
  kodev-clean           sync and run 'bk clean' in komodo build tree

  okdev, okdev-configure, okdev-reconfigure, okdev-test, okdev-clean
                        ditto for openkomodo build tree (Komodo Edit trunk)

  ko50dev, ko50dev-configure, ko50dev-reconfigure, ko50dev-test, ko50dev-clean
  ok50dev, ok50dev-configure, ok50dev-reconfigure, ok50dev-test, ok50dev-clean
                        ditto for 5.0.x maintenance dev trees

mozilla build tasks:
  komoz51[abc], okmoz51[abc]    for Komodo 5.1 release builds
  komoz511[abc], okmoz511[abc]  for Komodo 5.1 dev builds
  komoz50[abc], okmoz50[abc]    for Komodo 5.0 release builds
  komoz510[abc], okmoz510[abc]  for Komodo 5.0 dev builds

secondary tasks:
  mozpy                 build the siloed ActivePython into
                          mozilla/prebuilt/pythonX.Y
  xdebug                update xdebug builds with latest from Xdebug CVS
  koup-nightly          update to the latest Komodo IDE and Edit nightlies
  koup-releasetest      update to the latest Komodo IDE and Edit release
                        and on release channel
  admin                 Run some administrative tasks on the build machines.
                        E.g. monitor disk usages (komodo builds suck *huge*
                        amounts of space).
  svncleanup

diagnostic tasks:
  hupbb                 hup the Komodo buildbot slave on this machine
  ping                  just check to see if machines are awake
  plat                  dump platform info (as per platform.py)
  slow                  echo begin, sleep, echo done
  error                 check error handling by running a command that fails
"""

__version_info__ = (0, 2, 0)
__version__ = '.'.join(map(str, __version_info__))

import os
from os.path import abspath, exists, join, isdir, basename, dirname, expanduser
import sys
import re
from pprint import pprint
from glob import glob
import traceback
import logging
import optparse
import copy
import threading
import Queue
import socket
import time
import urllib



class Error(Exception):
    pass

log = logging.getLogger("rrun")


#---- machines

g_machines = [
    {"hostname": "sphinx",
        "platform": "macosx-powerpc",
        "tmp-dir": "/Users/trentm/tmp",
        "var-dir": "/Users/trentm/var",
        "apy-build-dir": "/Users/trentm/as/ActivePython-devel",
        "ok-build-dir": "/Users/trentm/as/openkomodo",
        "ko-build-dir": "/Users/trentm/as/komodo",
        "xdebug-build-dir": "/Users/trentm/as/komodo/src/xdebug2",
        "ko51-build-dir": "/Users/trentm/as/komodo-5.1.x",
        "ok51-build-dir": "/Users/trentm/as/openkomodo-5.1.x",
        "tags": ["official"]},
    #{"hostname": "vm-ubuntu80-trentm",
    #    "platform": "linux-libcpp6-x86",
    #    "tmp-dir": "/home/trentm/tmp",
    #    "var-dir": "/home/trentm/var",
    #    "apy-build-dir": "/home/trentm/as/ActivePython-devel",
    #    "ok-build-dir": "/home/trentm/as/openkomodo",
    #    "ko-build-dir": "/home/trentm/as/komodo",
    #    "ok50-build-dir": "/home/trentm/as/openkomodo-5.0.x",
    #    "ko50-build-dir": "/home/trentm/as/komodo-5.0.x",
    #    "tags": []},
    {"hostname": "vm-centos50-trentm",
        "login": "trentm@192.168.69.102",
        "platform": "linux-libcpp6-x86",
        "tmp-dir": "/home/trentm/tmp",
        "var-dir": "/builds/trentm/var", # separate partition with 14GB
        "apy-build-dir": "/Users/trentm/as/ActivePython-devel",
        "ok-build-dir": "/home/trentm/as/openkomodo",
        "ko-build-dir": "/home/trentm/as/komodo",
        "xdebug-build-dir": "/home/trentm/as/komodo/src/xdebug2",
        "ok51-build-dir": "/home/trentm/as/openkomodo-5.1.x",
        "ko51-build-dir": "/home/trentm/as/komodo-5.1.x",
        "tags": ["official", "mozpy", "xdebug"]},
    {"hostname": "kobuild-centos5-64",
        "login": "komodo-build@kobuild-centos5-64",
        "platform": "linux-libcpp6-x86_64",
        "tmp-dir": "/home/komodo-build/tmp",
        "var-dir": "/home/komodo-build/var",
        "apy-build-dir": "/home/komodo-build/as/ActivePython-devel",
        "ok-build-dir": "/home/komodo-build/as/openkomodo",
        "ko-build-dir": "/home/komodo-build/as/komodo",
        "ok51-build-dir": "/home/komodo-build/as/openkomodo-5.1.x",
        "ko51-build-dir": "/home/komodo-build/as/komodo-5.1.x",
        "xdebug-build-dir": "/home/komodo-build/as/komodo/src/xdebug2",
        "tags": [
            "official",
            "mozpy",
            "xdebug"
        ]},
    {"hostname": "kungfu",
        "platform": "macosx-x86",
        "tmp-dir": "/Users/trentm/tmp",
        "var-dir": "/Users/trentm/var",
        "apy-build-dir": "/Users/trentm/as/ActivePython-devel",
        "ok-build-dir": "/Users/trentm/as/openkomodo",
        "ko-build-dir": "/Users/trentm/as/komodo",
        "xdebug-build-dir": "/Users/trentm/as/komodo/src/xdebug2",
        "ok51-build-dir": "/Users/trentm/as/openkomodo-5.1.x",
        "ko51-build-dir": "/Users/trentm/as/komodo-5.1.x",
        "tags": ["official", "mozpy", "xdebug"]},

]
if socket.gethostname().split('.')[0] == "belt":
    g_machines.append(
        {"hostname": "belt",
         "platform": "win32-x86",
         "tmp-dir": r"C:\trentm\tmp",
         "var-dir": r"C:\trentm\var",
         "apy-build-dir": r"C:\trentm\as\ActivePython-devel",
         "ok-build-dir": r"C:\trentm\as\openkomodo",
         "ko-build-dir": r"C:\trentm\as\komodo",
         "xdebug-build-dir": r"C:\trentm\as\komodo\src\xdebug2",
         "ko51-build-dir": r"C:\trentm\as\komodo-5.1.x",
         "ok51-build-dir": r"C:\trentm\as\openkomodo-5.1.x",
         "tags": ["official", "mozpy", "xdebug"]},
    )
if socket.gethostname().split('.')[0] == "mower":
    g_machines.append(
        {"hostname": "mower",
         "platform": "macosx-x86",
         "tmp-dir": "/Users/trentm/tmp",
         "var-dir": "/Users/trentm/var",
         "apy-build-dir": "/Users/trentm/as/ActivePython-devel",
         "ok-build-dir": "/Users/trentm/as/openkomodo",
         "ko-build-dir": "/Users/trentm/as/komodo",
         "tags": []}
    )
def _add_this_machine():
    hostname = socket.gethostname().split('.')[0]
    for m in g_machines:
        if m["hostname"] == hostname:
            break
    else:
        # Not already in the list. Add it.
        sys.path.insert(0, join(dirname(dirname(abspath(__file__))), "util"))
        import platinfo
        g_machines.append(
            {"hostname": hostname,
             "platform": platinfo.platname(),
             "tmp-dir": expanduser("~/tmp"),
             "var-dir": expanduser("~/var"),
             "apy-build-dir": expanduser("~/as/ActivePython-devel"),
             "ok-build-dir": expanduser("~/as/openkomodo"),
             "ko-build-dir": expanduser("~/as/komodo"),
             "ko51-build-dir": expanduser("~/as/komodo-5.1.x"),
             "ok51-build-dir": expanduser("~/as/openkomodo-5.1.x"),
             "tags": ["localhost"]}
        )
    pass
_add_this_machine()



#---- tasks

class Task(object):
    """A remote task.
    """
    name = None             # A short string name for the task.
    short_output = False

    # Task arguments via -D|--define option. These are set via
    # set_defines() after creation, but before usage of any other
    # parts of the API.
    defines = None
    def set_defines(self, defines):
        self.defines = defines or {}

    _uploads = []
    def get_uploads(self, machine):
        """Return a list of 2-tuples indicating files to be uploaded
        before running remote commands:
            (<local-path>, <remote-path>)
        """
        return self._uploads

    _cmds = []
    def get_cmds(self, machine):
        """Return a list commands to run on the remote machine."""
        return self._cmds

    def __init__(self, name=None, uploads=None, cmds=None, short_output=None,
                 relevant_machine_pats=None):
        """Create a Task. All arguments are optional.

        "name" is a short string name for the task.
        "uploads" is a list of 2-tuples: (<local-path>, <remote-path>)
        "cmds" is a list of commands to run on the remote machine.
        "short_output" is a boolean (by default False) indicating that
            the output from this task is typically short -- and hence
            might usefully be printed to stdout when executed (or after)
            rather than just dumping into a log.
        "relevant_machine_pats" is a list of machine patterns (matched
            against candidate machine platform and hostnames) for which
            this tasks is relevant. The empty list means all machines
            are relevant.
        """
        if name is not None:
             self.name = name
        if uploads is not None:
             self._uploads = uploads
        if cmds is not None:
             self._cmds = cmds
        if short_output is not None:
             self.short_output = short_output
        if relevant_machine_pats is not None:
             self._relevant_machine_pats = relevant_machine_pats

    _relevant_machine_pats = []
    def is_relevant_for_machine(self, machine):
        """Return True iff this task can/should run on the given machine.

        The default implementation filters based on
        `self._relevant_machine_pats` which can be set on Task
        initialization.
        """
        if _filter_machines_by_patterns(
                [machine], self._relevant_machine_pats):
            return True
        else:
            return False

    def get_sep(self, machine):
        if machine["platform"].startswith("win"):
            return '\\'
        else:
            return '/'

    def envrun_paths_from_compiler(self, compiler, machine):
        """For Windows builds we create and upload "environment runner"
        stubs for each separate build so that we can keep environment
        modifications out of the current env.
        """
        envrun_local_path = '\\'.join(["util", "envrun-%s.bat" % compiler])
        sep = self.get_sep(machine)
        envrun_remote_path = sep.join(
            [machine["tmp-dir"], basename(envrun_local_path)]
        )
        return (envrun_local_path, envrun_remote_path)


class SlowTask(Task):
    """Diagnostic tasks that takes a variable and longer amount of time."""
    name = "slow"
    short_output = True
    def get_cmds(self, machine):
        import random
        return ['echo begin',
                'sleep %d' % random.randrange(2,10),
                'echo done']


class PlayTask(Task):
    name = "play"
    short_output = True
    def get_cmds(self, machine):
        platform = machine["platform"]
        if platform.startswith("win"):
            from ntpath import join, dirname
            CAT = "type"
            RMDIR = "(if exist %(dir)s rd /s/q %(dir)s)"
            BK = r"python util\black\bk.py"
        elif platform.startswith("macosx"):
            from posixpath import join, dirname
            CAT = "cat"
            RMDIR = "rm -rf %(dir)s"
            BK = "python util/black/bk.py"
        else:
            from posixpath import join, dirname
            CAT = "cat"
            RMDIR = "rm -rf %(dir)s"
            BK = "python util/black/bk.py"
        build_dir = join(machine["var-dir"], "ko")
        build_dir = machine["ko-build-dir"]
        assert ' ' not in build_dir

        cmds = [
            'cd %s' % build_dir,
            #'echo %s package updates' % BK,
            #'%s package updates' % BK,
            #'bk build',
            _svn_up_str() + ' util',
            #'bk start zip -h',
        ]
        return cmds

class HupBuildBotTask(Task):
    """Diagnostic tasks that takes a variable and longer amount of time."""
    name = "hupbb"
    short_output = True
    def get_cmds(self, machine):
        remote_is_windows = machine["platform"].startswith("win")
        if remote_is_windows:
            return [r'buildbot stop %HOME%\data\buildbot\ko-slave',
                    r'buildbot start %HOME%\data\buildbot\ko-slave']
        else:
            return ['buildbot stop ~/data/buildbot/ko-slave',
                    'buildbot start ~/data/buildbot/ko-slave']


class KomodoFullBuildTask(Task):
    def __init__(self, name, repo, app_names=None, scc="svn",
                 relevant_machine_pats=None,
                 upload_dir=None):
        assert ' ' not in name
        self.name = name
        self.repo = repo
        self.app_names = app_names
        self.scc = scc
        if relevant_machine_pats is not None:
             self._relevant_machine_pats = relevant_machine_pats
        self.upload_dir = upload_dir

        # Determine this when the task is *created* to ensure that all
        # machines use the same revision. get_cmds() is called for each
        # machine and might result in different revisions being used.
        assert self.scc == "svn"
        self.revision = _svn_revision_from_url(self.repo)
    
    @property
    def var_subdir(self):
        return self.name
    
    def get_cmds(self, machine):
        # Allow '-D revision=1234' to override revision.
        revision = self.defines.get("revision", self.revision)
        
        platform = machine["platform"]
        if platform.startswith("win"):
            from ntpath import join, dirname
            CAT = "type"
            RMDIR = "(if exist %(dir)s rd /s/q %(dir)s)"
            BK = r"python util\black\bk.py"
        elif platform.startswith("macosx"):
            from posixpath import join, dirname
            CAT = "cat"
            RMDIR = "rm -rf %(dir)s"
            BK = "python util/black/bk.py"
        else:
            from posixpath import join, dirname
            CAT = "cat"
            RMDIR = "rm -rf %(dir)s"
            BK = "python util/black/bk.py"

        build_dir = join(machine["var-dir"], self.var_subdir)
        assert ' ' not in build_dir

        cmds = []
        for app_name in self.app_names:
            assert ' ' not in app_name
            cmds += [
                'echo --- full Komodo %s build, rev %s ---'
                    % (app_name, revision),

                'cd %s' % dirname(build_dir),
                RMDIR % {"dir": self.var_subdir},
                'svn co -r %s %s %s' % (revision, self.repo, self.var_subdir),

                'cd %s' % build_dir,
                'echo %s configure --release --full --product-type=%s '
                    '--moz-src=blessed --komodo-buildnum=%s'
                    % (BK, app_name, revision),
                '%s configure --release --full --product-type=%s '
                    '--moz-src=blessed --komodo-buildnum=%s'
                    % (BK, app_name, revision),
                '%s bkconfig.py' % CAT,
                'echo %s clean' % BK,
                '%s clean' % BK,
                'echo %s build' % BK,
                '%s build' % BK,
                'echo %s image' % BK,
                '%s image' % BK,
                'echo %s package' % BK,
                '%s package' % BK,
            ]
            if self.upload_dir:
                cmds += [
                    'echo %s upload %s' % (BK, self.upload_dir),
                    '%s upload %s' % (BK, self.upload_dir),
                ]
        return cmds

class Komodo51ReleaseTask(KomodoFullBuildTask):
    """Full build from the latest release branch."""
    def __init__(self, name, var_subdir, branches_repo_url, *args, **kwargs):
        self._var_subdir = var_subdir
        assert branches_repo_url.endswith("/")
        latest_rel_branch = self._latest_51_rel_branch(branches_repo_url)
        if latest_rel_branch is None:
            # There isn't a release branch, use the trunk.
            repo = branches_repo_url.rsplit('/',2)[0] + "/trunk/"
        else:
            repo = branches_repo_url + latest_rel_branch
        KomodoFullBuildTask.__init__(self, name, repo, *args, **kwargs)

    @property
    def var_subdir(self):
        return self._var_subdir

    def _latest_51_rel_branch(self, branches_repo_url):
        branches = _svn_ls(branches_repo_url)
        ver_dir_pat = re.compile(r"^5\.1\.(\d+)(?:([ab])(\d+))?/$")
        vers = []
        for branch in branches:
            m = ver_dir_pat.match(branch)
            if not m:
                continue
            bits = m.groups()
            if bits[1] is None:
                vers.append(((5, 1, int(bits[0]), 'c', 0), branch))
            else:
                vers.append(((5, 1, int(bits[0]), bits[1], int(bits[2])), branch))
        vers.sort()
        if vers:
            return vers[-1][1]
        else:
            return None

class KomodoDevTask(Task):
    def __init__(self, name, build_dir_key, scc="svn",
                 relevant_machine_pats=None):
        self.name = name
        self.build_dir_key = build_dir_key
        self.scc = scc
        if relevant_machine_pats is not None:
             self._relevant_machine_pats = relevant_machine_pats
    def get_cmds(self, machine):
        scc_update = {"svn": _svn_up_str(),
                      "p4": "p4 sync ./..."}[self.scc]
        if machine["platform"].startswith("win"):
            BK = r"python util\black\bk.py"
        else:
            BK = "python util/black/bk.py"
        return [
            'cd %s' % machine[self.build_dir_key],
            scc_update,
            '%s build' % BK,
        ]

class CodeIntelTask(Task):
    def __init__(self, name, build_dir_key):
        self.name = name
        self.build_dir_key = build_dir_key
    def get_cmds(self, machine):
        if machine["platform"].startswith("win"):
            return [
                'cd %s\\src\\codeintel' % machine[self.build_dir_key],
                _svn_up_str(),
                'bin\\setenv.bat',
                'python Makefile.py distclean all',
            ]
        else:
            return [
                'cd %s/src/codeintel' % machine[self.build_dir_key],
                _svn_up_str(),
                '(. bin/setenv.sh; python Makefile.py distclean all)',
            ]

class KomodoDevConfigureTask(Task):
    def __init__(self, name, build_dir_key, conf_opts, scc="svn",
                 relevant_machine_pats=None):
        self.name = name
        self.build_dir_key = build_dir_key
        self.conf_opts = conf_opts
        self.scc = scc
        if relevant_machine_pats is not None:
             self._relevant_machine_pats = relevant_machine_pats
    def get_cmds(self, machine):
        scc_update = {"svn": _svn_up_str(), 
                      "p4": "p4 sync ./..."}[self.scc]
        if machine["platform"].startswith("win"):
            BK = r"python util\black\bk.py"
        else:
            BK = "python util/black/bk.py"
        return [
            'cd %s' % machine[self.build_dir_key],
            scc_update,
            '%s configure %s' % (BK, ' '.join(self.conf_opts)),
        ]

class KomodoDevReconfigureTask(Task):
    def __init__(self, name, build_dir_key, scc="svn",
                 relevant_machine_pats=None):
        self.name = name
        self.build_dir_key = build_dir_key
        self.scc = scc
        if relevant_machine_pats is not None:
             self._relevant_machine_pats = relevant_machine_pats
    def get_cmds(self, machine):
        scc_update = {"svn": _svn_up_str(),
                      "p4": "p4 sync ./..."}[self.scc]
        if machine["platform"].startswith("win"):
            BK = r"python util\black\bk.py"
        else:
            BK = "python util/black/bk.py"
        return [
            'cd %s' % machine[self.build_dir_key],
            scc_update,
            '%s reconfigure' % BK,
        ]

class KomodoDevTestTask(Task):
    def __init__(self, name, build_dir_key, scc="svn",
                 relevant_machine_pats=None):
        self.name = name
        self.build_dir_key = build_dir_key
        self.scc = scc
        if relevant_machine_pats is not None:
             self._relevant_machine_pats = relevant_machine_pats
    def get_cmds(self, machine):
        scc_update = {"svn": _svn_up_str(),
                      "p4": "p4 sync ./..."}[self.scc]
        if machine["platform"].startswith("win"):
            BK = r"python util\black\bk.py"
        else:
            BK = "python util/black/bk.py"
        return [
            'cd %s' % machine[self.build_dir_key],
            scc_update,
            '%s test -- -knownfailure -casper' % BK,
        ]


class KomodoDevCleanTask(Task):
    def __init__(self, name, build_dir_key, scc="svn",
                 relevant_machine_pats=None):
        self.name = name
        self.build_dir_key = build_dir_key
        self.scc = scc
        if relevant_machine_pats is not None:
             self._relevant_machine_pats = relevant_machine_pats
    def get_cmds(self, machine):
        scc_update = {"svn": _svn_up_str(),
                      "p4": "p4 sync ./..."}[self.scc]
        if machine["platform"].startswith("win"):
            BK = r"python util\black\bk.py"
        else:
            BK = "python util/black/bk.py"
        cmds = [
            'cd %s' % machine[self.build_dir_key],
            scc_update,
            '%s clean' % BK,
        ]
        if machine["platform"].startswith("win"):
            cmds.append("rd /s/q src\\scintilla")
        else:
            cmds.append("rm -rf src/scintilla")
        return cmds
    

class AdminTask(Task):
    """Some administrative tasks.
    
    TODO:
    - overall disk usage (error if greater than 80% on the partition we use)
    - if >80% usage then:
        - summarize each user's home dir usage
        - summarize mar-cache usage
        - summarize other candidate dirs of mine
    """
    short_output = True
    def get_cmds(self, machine):
        if machine["platform"].startswith("win"):
            sys.path.insert(0, join(dirname(dirname(__file__)), "util"))
            import applib
            mar_cache = join(
                applib.user_cache_dir("komodo-dev", "ActiveState"),
                "mar", "*")
            return [
                'dir | grep "bytes free"',
                'echo ---',
                r'python C:\trentm\tm\tools\rm_if_older_than_5_days.py "%s"' % mar_cache,
            ]
        else:
            if machine["platform"].startswith("macosx"):
                mar_cache = "~/Library/Caches/komodo-dev/mar/*"
            else:
                mar_cache = "~/.komodo-dev/caches/mar/*"
            return [
                "df -lh | grep 'Filesystem\|^/dev'",
                "echo ---",
                "python ~/tm/tools/rm_if_older_than_5_days.py %s" % mar_cache,
            ]


class KoUpTask(Task):
    """Update to the latest devbuild."""
    def __init__(self, name, build_dir_key, build_type="devbuild"):
        self.name = name
        self.build_dir_key = build_dir_key

        if build_type == "devbuild":
            version_txt = join(dirname(dirname(abspath(__file__))),
                               "src", "version.txt")
            long_ver = open(version_txt, 'r').read().strip()
            ver_bits = re.match(r"(\d+\.\d+\.\d+)(?:-(\w)\w+(\d+))?$", long_ver).groups()
            short_ver = ''.join([b for b in ver_bits if b])
            args = "%s devbuild" % self.short_ver
        elif build_type == "nightly":
            args = "nightly -c nightly"
        elif build_type == "betatest":
            args = "5.1.0b1 -c betatest"
        elif build_type == "releasetest":
            args = "5.0.3 -c releasetest"
        else:
            raise ValueError("unknown build_type: %r" % build_type)
        self.koup_args = args
    
    def get_cmds(self, machine):
        return [
            'cd %s' % machine[self.build_dir_key],
            _svn_up_str() + ' util/koup.py',
            'python util/koup.py ide %s' % self.koup_args,
            'python util/koup.py edit %s' % self.koup_args,
        ]

class SVNCleanupTask(Task):
    def __init__(self, name):
        self.name = name
    def get_cmds(self, machine):
        cmds = []
        for dir_key in ("ko-build-dir", "ok-build-dir"):
            if dir_key in machine:
                cmds += [
                    'cd %s' % machine[dir_key],
                    'svn cleanup',
                ]
        return cmds

class KomodoDevXdebugTask(Task):
    def get_uploads(self, machine):
        if machine["platform"].startswith("win"):
            uploads = [
                self.envrun_paths_from_compiler("vc6-x86", machine)
            ]
        else:
            uploads = []
        return uploads
    def get_cmds(self, machine):
        if machine["platform"].startswith("win"):
            envrun_paths \
                = self.envrun_paths_from_compiler("vc6-x86", machine)
            cmd_prefix = "cmd /c %s " % envrun_paths[1]
        else:
            cmd_prefix = ""
        cmds = [
            'cd %s' % machine["ko-build-dir"],
            _svn_up_str(),
            'cd %s' % machine["xdebug-build-dir"],
        ]
        if machine["platform"].startswith("win"):
            cmds.append("setenv.bat")
        cmds.append('%smk update_prebuilt' % cmd_prefix)
        return cmds


class MozillaTask(Task):
    def __init__(self, name, ko_ver, moz_build_dir_key,
                 moz_build_dir_suffix=None,
                 pyver=None, moz_src_spec=None, is_dev_build=False,
                 scc="svn", msvc="vc6",
                 moz_objdir=None,
                 extra_config_opts=None,
                 relevant_machine_pats=None):
        self.name = name
        self.ko_ver = ko_ver
        self.moz_build_dir_key = moz_build_dir_key
        self.moz_build_dir_suffix = moz_build_dir_suffix
        self.pyver = pyver
        self.moz_src_spec = moz_src_spec
        self.is_dev_build = is_dev_build
        self.scc = scc
        self.msvc = msvc
        self.moz_objdir = moz_objdir  # Optional value for "python build.py configure --moz-objdir=$moz_objdir ...".
        self.extra_config_opts = extra_config_opts
        if relevant_machine_pats is not None:
             self._relevant_machine_pats = relevant_machine_pats

    def get_cmds(self, machine):
        platform = machine["platform"]
        if platform.startswith("win"):
            from ntpath import join, dirname
        else:
            from posixpath import join, dirname

        scc_update = {"svn": _svn_up_str(),
                      "p4": "p4 sync ./..."}[self.scc]

        # Make sure to 'svn up' at the top of the working copy to avoid
        # a complex 'svnversion' value. See `svnversion --help' for
        # details.
        build_dir = machine[self.moz_build_dir_key]
        assert ' ' not in build_dir
        cmds = [
            'cd %s' % build_dir,
            scc_update,
        ]
        if self.moz_build_dir_suffix:
            build_dir = join(build_dir, self.moz_build_dir_suffix)
            cmds += [
                'cd %s' % build_dir,
            ]

        moz_src_opt = (self.moz_src_spec
                       and '"--moz-src=%s"' % self.moz_src_spec
                       or "")
        release_build_opts = "--blessed"
        dev_build_opts = "--no-strip --tools"
        if sys.platform == "win32":
            # To avoid the path length limitation in Moz build tools
            # problem, specify a shorter objdir than the typical
            # "ko-rel-ns-shared-tools" that results from these options.
            dev_build_opts += " --moz-objdir=ko"
            release_build_opts += " --moz-objdir=ko"
        config_opts = (self.is_dev_build
                       and dev_build_opts
                       or release_build_opts)

        if machine["platform"].startswith("win"):
            cmd_prefix = "cmd /c support\\envrun-moz-%s-x86.bat " % self.msvc
        else:
            cmd_prefix = ""
        build_tag = self.name
        if self.pyver is not None:
            config_opts += " --python-version=%s" % self.pyver
        if self.extra_config_opts:
            config_opts += " " + self.extra_config_opts
        cmds += [
            '%spython build.py -c config-%s.py configure -k %s %s '
                '--release --no-strip --build-tag=%s %s'
                % (cmd_prefix, build_tag, self.ko_ver, moz_src_opt,
                   build_tag, config_opts),
            '%spython build.py -c config-%s.py distclean all packages upload'
                % (cmd_prefix, build_tag),
        ]
        return cmds


class MozillaPythonTask(Task):
    def __init__(self, name, apy_dir_key, msvc="vc8"):
        Task.__init__(self, name, relevant_machine_pats=["mozpy"])
        self.apy_dir_key = apy_dir_key
        self.msvc = msvc

    def get_uploads(self, machine):
        if machine["platform"].startswith("win"):
            uploads = [
                self.envrun_paths_from_compiler("%s-x86" % self.msvc, machine)
            ]
        else:
            uploads = []
        return uploads

    def get_cmds(self, machine):
        if machine["platform"].startswith("win"):
            envrun_paths \
                = self.envrun_paths_from_compiler("%s-x86" % self.msvc, machine)
            cmd_prefix = "cmd /c %s " % envrun_paths[1]
        else:
            cmd_prefix = ""
        build_tag = self.name
        return [
            'cd %s' % machine[self.apy_dir_key],
            'p4 sync ./...',
            #_svn_up_str(),
            'python configure.py -f apyconfig-%s.py -p komodosilo '
                '--build-tag=%s' % (build_tag, build_tag),
            '%spython Makefile.py -f apyconfig-%s.py '
                'distclean all image_embedding update_mozilla_prebuilt'
                % (cmd_prefix, build_tag),
        ]



#---- main functions

def rrun(task_names, machine_pats=None, defines=None,
         log_dir="log", dry_run=False):
    if not task_names:
        raise Error("No tasks were given. See 'rrun.py --help' for "
                    "usage info.")
    for task_name in task_names:
        if task_name not in _g_tasks:
            raise Error("No such task: '%s'" % task_name)
    if not machine_pats:
        machine_pats = []
    if not isdir(log_dir):
        raise Error("The given log directory, '%s', does not exist. You "
                    "must either create it or use the -L|--log-dir option."
                    % log_dir)

    # Find the set of machines on which to run.
    if not g_machines:
        raise Error("No machines are defined for running tasks.")
    machines = _filter_machines_by_patterns(g_machines, machine_pats)
    if not machines:
        raise Error("No machines satisfy your machine patterns: '%s'."
                    % "', '".join(machine_pats))

    # Create a Runner for each machine on which one or more tasks will
    # be run. Some tasks are not relevant for some machines.
    runners = []
    reporter = Queue.Queue()
    tasks_remaining = [] # list of (<task-name>, <hostname>)
    for machine in machines:
        relevant_tasks = [] # list of tasks that this machine can run
        for task_name in task_names:
            task = _g_tasks[task_name]
            task.set_defines(defines)
            if task.is_relevant_for_machine(machine):
                tasks_remaining.append( (task.name, machine["hostname"]) )
                relevant_tasks.append(task)
                # schedule 'kodev' on gila (linux-x86)
                log.info("schedule '%s' on %s (%s)", task.name,
                         machine["hostname"], machine["platform"])
            else:
                log.debug("task '%s' is not relevant for %s (%s)", task.name,
                          machine["hostname"], machine["platform"])
        runners.append(
            Runner(machine, relevant_tasks, reporter, log_dir)
        )

    if dry_run:
        log.debug("dry-run: abort before starting Runner threads")
        return [] # no results

    # Start executing.
    starttime = time.time()
    for r in runners:
        r.start()

    # Report results as they come in.
    results = []
    while tasks_remaining:
        if not sys.stdout.isatty() or log.isEnabledFor(logging.DEBUG):
            runner, task, retval, duration, log_path = reporter.get()

        # This is a tty. Try to be cute with reporting.
        else:
            # Print a running status bar until a result is ready.
            #   Tasks (3): ko on gila, ko on alligator, ...      1m03s
            times_thru = 0
            LINELEN = 70
            while 1:
                times_thru += 1
                try:
                    runner, task, retval, duration, log_path \
                        = reporter.get_nowait()
                except Queue.Empty: # no result is ready yet
                    timestamp = _sec2hms(time.time() - starttime)
                    prefix = "Tasks (%d):" % len(tasks_remaining)
                    len_left = LINELEN - (len(prefix) + 2 + len(timestamp))
                    for n in range(len(tasks_remaining), 0, -1):
                        tr_strs = ["%s on %s" % tr for tr in tasks_remaining]
                        if n == len(tasks_remaining):
                            middle = ', '.join(tr_strs)
                        else:
                            middle = ', '.join(tr_strs[:n]) + ', ...'
                        if len(middle) <= len_left:
                            break
                    else:
                        if len_left < 3:
                            middle = ''
                        else:
                            middle = '...'
                    space = ' ' * (len_left - len(middle))
                    line = "%s %s%s %s" % (prefix, middle, space, timestamp)
                    if times_thru != 1:
                        sys.stdout.write("\b"*LINELEN)
                    sys.stdout.write(line)
                    sys.stdout.flush()
                    time.sleep(1)
                else:
                    if times_thru != 1:
                        sys.stdout.write("\b"*LINELEN)
                        sys.stdout.write(" "*LINELEN)
                        sys.stdout.write("\b"*LINELEN)
                        sys.stdout.flush()
                    break

        # Report the result.
        result = {
            "machine": runner.machine.copy(),
            "task": task,
            "duration": duration,
            "retval": retval,
            "log_path": log_path,
        }
        results.append(result)
        tasks_remaining.remove((task.name, runner.machine["hostname"]))

        status = retval and ("ERROR (%s)" % retval) or "SUCCESS"
        # [1h35m24.0s] ERROR: 'kopro' on gila (linux-x86): log/foo.log
        sys.stdout.write("[%8s] %s: '%s' on %s (%s): %s\n"
            % (_sec2hms(duration), status, task.name,
               runner.machine["hostname"], runner.machine["platform"],
               log_path))
        if task.short_output and exists(log_path):
            output = open(log_path, 'r').read()
            if not output.endswith('\n'):
                output += '\n'
            sys.stdout.write(_indent(output))

    return results


class Runner(threading.Thread):
    r"""Asynchronously run one or more tasks on the given machine.

    Usage:
        machine = {"hostname": "gila", "platform": "linux-x86"}
        reporter = Queue.Queue()
        r = Runner(machine, [<tasks>...], reporter, log_dir)
        r.start()
        # The result of each task will be put on the reporter when done
        # via:
        #   reporter.put( (<runner-instance>,
        #                  <task>,
        #                  <retval>,
        #                  <duration>,          # in seconds
        #                  <log-path>) )

    Machine dictionary ('*' means it is required):
        hostname*       the remote machine's hostname
        platform*       a string describing the remote machine's platform;
                        this should startwith "win" if the machine is a
                        Windows box
        ssh_protocol    specify the SSH protocol version to use: 1 or 2
        tmpdir          specify remote temp directory to use (defaults
                        to 'C:\temp' on Windows, '/tmp' otherwise where
                        the platform is guessed from 'platform')
        login           an ssh 'user@host' string for remotely logging
                        into the machine (defaults to 'hostname')

    """
    def __init__(self, machine, tasks, reporter, log_dir, **kwargs):
        if "name" not in kwargs:
            kwargs["name"] = "%s-runner" % machine["hostname"]
        threading.Thread.__init__(self, **kwargs)

        self.tasks = tasks
        self.machine = machine
        self.reporter = reporter
        self.log_dir = log_dir

        # Calculate some remote variables.
        remote_is_windows = self.machine["platform"].startswith("win")
        self.remote_sep = (remote_is_windows and '\\' or '/')
        if "tmpdir" in self.machine:
            self.remote_tmpdir = self.machine["tmpdir"]
        elif remote_is_windows:
            self.remote_tmpdir = r"C:\temp"
        else:
            # Presume that all other plats will have "/tmp".
            self.remote_tmpdir = "/tmp"
        assert ' ' not in self.remote_tmpdir,\
            "cannot yet handle spaces in remote temp dir: '%s'"\
            % self.remote_tmpdir

    def _get_log_path(self, log_dir, task_name, hostname):
        if not isdir(log_dir):
            raise Error("the given log directory does not exist: '%s'"
                        % log_dir)
        base = "%s-%s.log" % (task_name, hostname)
        return join(log_dir, base)

    def run(self):
        name = self.getName()
        log.debug("[%s] start", name)
        hostname = self.machine["hostname"]

        for task in self.tasks:
            starttime = time.time()
            log_path = self._get_log_path(self.log_dir, task.name, hostname)
            retval = self._execute_task(task, log_path)
            self.reporter.put((
                self,                       # runner
                task,                       # task
                retval,                     # retval
                time.time() - starttime,    # duration
                log_path,                   # log path
            ))

        log.debug("[%s] finish", name)

    def _execute_task(self, task, log_path):
        """Upload the given uploads and run the given commands.

            "task" is a Task instance.
            "log_path" is a path to which output will be redirected.

        Returns the retval of the command.

        XXX Add eol conversion for uploads automatically?
        """
        try:
            task_uploads = task.get_uploads(self.machine)
            task_cmds = task.get_cmds(self.machine)
        except:
            traceback.print_exc()
            return 1
        assert isinstance(task_uploads, list),\
            "'task.get_uploads()' must return a list: %r" % task_uploads
        assert isinstance(task_cmds, list),\
            "'task.get_cmds()' must return a list: %r" % task_cmds

        # Determine base portable commands.
        if "ssh_protocol" in self.machine:
            SSH_PROTOCOL = "-%s" % self.machine["ssh_protocol"]
        else:
            SSH_PROTOCOL = ""
        if sys.platform.startswith("win"):
            SCP = "pscp -q %s" % SSH_PROTOCOL
            SSH = "plink -A %s -batch" % SSH_PROTOCOL
            CP = "copy"
        else:
            SCP = "scp -q %s" % SSH_PROTOCOL
            SSH = "ssh -A %s" % SSH_PROTOCOL
            CP = "cp -f"

        # Build all the commands to run -- one for each of the task_uploads,
        # and one grouped command for all the task_cmds.
        master_hostname = socket.gethostname()
        if '.' in master_hostname:
            master_hostname = master_hostname.split('.', 1)[0]
        if master_hostname == self.machine["hostname"]: # run locally
            cmds = []
            for src, dst in task_uploads:
                #cmds.append("echo %(CP)s %(src)s %(dst)s" % locals())
                cmds.append("%(CP)s %(src)s %(dst)s" % locals())
            cmds += task_cmds

            redirect_first = " > %s 2>&1" % abspath(log_path)
            redirect       = " >> %s 2>&1" % abspath(log_path)
            cmds[0] += redirect_first
            for i in range(1, len(cmds)):
                cmds[i] += redirect
            cmd = " && ".join(cmds)
            pretty_cmd = cmd.replace("&&", "\\\n\t&&", len(cmds)-1)
        else:
            LOGIN = self.machine.get("login", self.machine["hostname"])
            cmds = []
            for src, dst in task_uploads:
                #cmds.append("echo %(SCP)s %(src)s %(LOGIN)s:%(dst)s" % locals())
                cmds.append("%(SCP)s %(src)s %(LOGIN)s:%(dst)s" % locals())
            remote_cmd = " && ".join(task_cmds)
            escaped_remote_cmd = remote_cmd.replace('"', '\\"')
            cmds.append('%s %s "%s"' % (SSH, LOGIN, escaped_remote_cmd))

            redirect_first = " > %s 2>&1" % abspath(log_path)
            redirect       = " >> %s 2>&1" % abspath(log_path)
            cmds[0] += redirect_first
            for i in range(1, len(cmds)):
                cmds[i] += redirect
            cmd = " && ".join(cmds)
            pretty_cmd = cmd.replace("&&", "\\\n\t&&", len(cmds)-1)

        # Run the command and report.
        log.debug("[%s] run %r", self.getName(), cmd)
        retval = os.system(cmd)
##        if retval:
##            try:
##                tail = open(log_path, 'r').readlines()[-1]
##            except (EnvironmentError, IndexError):
##                tail = ""
##            else:
##                tail = "\nLOG TAIL:\n" + _indent(tail)
##            err = "error running '%s' on %s (%s)\n"\
##                  "  CMD:    %s\n"\
##                  "  RETVAL: %s\n"\
##                  "  LOG:    %s%s"\
##                  % (self.action, self.machine["hostname"],
##                     self.machine["platform"],
##                     _indent(pretty_cmd, 11, skip_first_line=True),
##                     retval, log_path, tail)
##            raise Error(err)
        return retval



#---- internal support functions

def _filter_machines_by_patterns(candidate_machines, machine_pats):
    """Filter the given set of machine dicts by a list of machine patterns.

    - If no machine-patterns are given then *all* machines are used.
    - A <machine-pattern> is compared to the "hostname", "platform" and
      "tags" of all registered machines. I.e. "linux" will machine any
      machines whose platform is "linux-x86", say. A regular expression
      pattern may be given with '/pattern/flags', e.g.  '/^as/i' for all
      machines starting with "as" (case-insensitive).
    - A <machine-pattern> may be prefixed with a '-' to mean: *skip*
      this machine.
    """
    machine_include_pats = [p for p in machine_pats if not p.startswith('-')]
    machine_exclude_pats = [p[1:] for p in machine_pats if p.startswith('-')]
    included_machines = {} # use dict to avoid dupes
    if not machine_include_pats:
        included_machines = dict(
            [ (m["hostname"], m) for m in candidate_machines ]
        )
    else:
        for pat in machine_include_pats:
            regex = _regex_from_encoded_pattern(pat)
            for m in candidate_machines:
                hostname = m["hostname"]
                for k in ("hostname", "platform", "tags"):
                    if k not in m: continue
                    v = m[k]
                    if not isinstance(v, list):
                        v = [v] # normalize all values to a list
                    for item in v:
                        if regex.search(item):
                            key = k == "tag" and "tag" or k
                            log.debug("include machine '%s': %s '%s' matches /%s/",
                                      hostname, key, item, regex.pattern)
                            included_machines[hostname] = m
                            break
                    if hostname in included_machines: break
                else:
                    log.debug("drop machine '%s': doesn't match /%s/",
                              m["hostname"], regex.pattern)
    excluded_machines = {} # use dict to avoid dupes
    for pat in machine_exclude_pats:
        regex = _regex_from_encoded_pattern(pat)
        for m in candidate_machines:
            for k in ("hostname", "platform", "tags"):
                if k not in m: continue
                v = m[k]
                if not isinstance(v, list):
                    v = [v] # normalize all values to a list
                for item in v:
                    if regex.search(item):
                        hostname = m["hostname"]
                        log.debug("exclude machine '%s': %s '%s' matches /%s/",
                                  hostname, k, item, regex.pattern)
                        excluded_machines[hostname] = m
    machines = [included_machines[h] for h in included_machines
                if h not in excluded_machines]
    return machines


def _svn_revision_from_url(url):
    output = _capture_stdout(["svn", "info", url])
    for line in output.splitlines(0):
        if not line.strip(): continue
        if line.startswith("Revision:"):
            return int(line.split(':', 1)[1].strip())
    raise Error("couldn't determine Subversion revision for `%s' "
                "(svn info output was %r)" % (url, output))

def _svn_ls(url):
    output = _capture_stdout(["svn", "ls", url])
    files = []
    for line in output.splitlines(0):
        if not line.strip(): continue
        files.append(line)
    return files

def _capture_stdout(argv, ignore_retval=False):
    import subprocess
    p = subprocess.Popen(argv, stdout=subprocess.PIPE)
    stdout = p.stdout.read()
    retval = p.wait()
    if retval and not ignore_retval:
        raise OSError("error running '%s'" % ' '.join(argv))
    return stdout

# Recipe: sec2hms (0.1.2) in C:\trentm\tm\recipes\cookbook
def _sec2hms(sec):
    """Return a NNhNNmNN.Ns string form for the given number of seconds."""
    h = sec//3600.0
    remainder = sec - h*3600.0
    m = remainder//60.0
    s = remainder - m*60.0
    pretty = ""
    if h: pretty += "%dh" % int(h)
    if h or m: pretty += "%02dm" % int(m)
    if (h or m) and s < 10.0: pretty += "0"
    pretty += "%.1fs" % s
    return pretty

# Recipe: indent (0.2.0) in /home/trentm/tm/recipes/cookbook
def _indent(s, width=4, skip_first_line=False):
    """_indent(s, [width=4]) -> 's' indented by 'width' spaces

    The optional "skip_first_line" argument is a boolean (default False)
    indicating if the first line should NOT be indented.
    """
    lines = s.splitlines(1)
    indentstr = ' '*width
    if skip_first_line:
        return indentstr.join(lines)
    else:
        return indentstr + indentstr.join(lines)

# Recipe: regex_from_encoded_pattern (1.0) in /home/trentm/tm/recipes/cookbook
def _regex_from_encoded_pattern(s):
    """'foo'    -> re.compile(re.escape('foo'))
       '/foo/'  -> re.compile('foo')
       '/foo/i' -> re.compile('foo', re.I)
    """
    if s.startswith('/') and s.rfind('/') != 0:
        # Parse it: /PATTERN/FLAGS
        idx = s.rfind('/')
        pattern, flags_str = s[1:idx], s[idx+1:]
        flag_from_char = {
            "i": re.IGNORECASE,
            "l": re.LOCALE,
            "s": re.DOTALL,
            "m": re.MULTILINE,
            "u": re.UNICODE,
        }
        flags = 0
        for char in flags_str:
            try:
                flags |= flag_from_char[char]
            except KeyError:
                raise ValueError("unsupported regex flag: '%s' in '%s' "
                                 "(must be one of '%s')"
                                 % (char, s, ''.join(flag_from_char.keys())))
        return re.compile(s[1:idx], flags)
    else: # not an encoded regex
        return re.compile(re.escape(s))

# Recipe: run (0.5.3) in C:\trentm\tm\recipes\cookbook
_RUN_DEFAULT_LOGSTREAM = ("RUN", "DEFAULT", "LOGSTREAM")
def __run_log(logstream, msg, *args, **kwargs):
    if not logstream:
        pass
    elif logstream is _RUN_DEFAULT_LOGSTREAM:
        try:
            log
        except NameError:
            pass
        else:
            if hasattr(log, "debug"):
                log.debug(msg, *args, **kwargs)
    else:
        logstream(msg, *args, **kwargs)

def _run(cmd, logstream=_RUN_DEFAULT_LOGSTREAM):
    """Run the given command.

        "cmd" is the command to run
        "logstream" is an optional logging stream on which to log the
            command. If None, no logging is done. If unspecifed, this
            looks for a Logger instance named 'log' and logs the command
            on log.debug().

    Raises OSError is the command returns a non-zero exit status.
    """
    __run_log(logstream, "running '%s'", cmd)
    retval = os.system(cmd)
    if hasattr(os, "WEXITSTATUS"):
        status = os.WEXITSTATUS(retval)
    else:
        status = retval
    if status:
        #TODO: add std OSError attributes or pick more approp. exception
        raise OSError("error running '%s': %r" % (cmd, status))

def _run_in_dir(cmd, cwd, logstream=_RUN_DEFAULT_LOGSTREAM):
    """Run the given command in the given working directory.

        "cmd" is the command to run
        "cwd" is the directory in which the commmand is run.
        "logstream" is an optional logging stream on which to log the
            command. If None, no logging is done. If unspecifed, this
            looks for a Logger instance named 'log' and logs the command
            on log.debug().

    Raises OSError is the command returns a non-zero exit status.
    """
    old_dir = os.getcwd()
    try:
        os.chdir(cwd)
        __run_log(logstream, "running '%s' in '%s'", cmd, cwd)
        _run(cmd, logstream=None)
    finally:
        os.chdir(old_dir)


def _svn_up_str():
    if sys.platform == "darwin":
        # Avoid '--non-interactive'.
        # http://svn.haxx.se/users/archive-2009-02/0409.shtml
        return "svn up"
    else:
        return "svn --non-interactive up"


#---- the tasks

_g_trunk_msvc = "vc8"  # not on vc8 yet
_g_trunk_cvs_tree = "cvs"  # not on Mozilla 1.9 yet

_g_tasks = {
    #---- Komodo tasks.

    # Add the "ko51rel/ok51rel" tasks for building full 5.1.x release Komodo IDE
    # and Edit builds, respectively, out of the latest 5.1.x release branch.
    "ko51rel": Komodo51ReleaseTask("ko51rel",
        var_subdir="ko51",   # saving space on build machines
        branches_repo_url="https://svn.activestate.com/repos/activestate/komodo/branches/",
        app_names=["ide"],
        upload_dir="komodo@mule:/data/komodo/builds",
        relevant_machine_pats=["official"]),
    "ok51rel": Komodo51ReleaseTask("ok51rel",
        var_subdir="ok51",
        branches_repo_url="https://svn.openkomodo.com/repos/openkomodo/branches/",
        app_names=["edit"],
        upload_dir="komodo@mule:/data/komodo/builds",
        relevant_machine_pats=["official"]),

    #"ko":                   KomodoFullBuildTask("ko",
    #                            repo="https://svn.activestate.com/repos/activestate/komodo/trunk",
    #                            app_names=["ide"],
    #                            upload_dir="komodo@mule:/data/komodo/builds",
    #                            relevant_machine_pats=["official"]),
    "kodev":                KomodoDevTask("kodev", "ko-build-dir"),
    "kodev-configure":      KomodoDevConfigureTask("kodev-configure", "ko-build-dir",
                                ["-V", "5.12.0-devel", "--without-jarring",
                                 "--without-komodo-cix",
                                 #"--with-casper"
                                 ]),
    "kodev-reconfigure":    KomodoDevReconfigureTask("kodev-reconfigure", "ko-build-dir"),
    "kodev-test":           KomodoDevTestTask("kodev-test", "ko-build-dir"),
    "kodev-clean":          KomodoDevCleanTask("kodev-clean", "ko-build-dir"),

    #"ok":                   KomodoFullBuildTask("ok",
    #                            repo="https://svn.openkomodo.com/repos/openkomodo/trunk",
    #                            app_names=["edit"],
    #                            upload_dir="komodo@mule:/data/komodo/builds",
    #                            relevant_machine_pats=["official"]),
    "okdev":                KomodoDevTask("okdev", "ok-build-dir"),
    "okdev-configure":      KomodoDevConfigureTask("okdev-configure", "ok-build-dir",
                                ["-V", "5.12.0-devel", "--without-jarring",
                                 "--without-komodo-cix", "--with-casper"]),
    "okdev-reconfigure":    KomodoDevReconfigureTask("okdev-reconfigure", "ok-build-dir"),
    "okdev-test":           KomodoDevTestTask("okdev-test", "ok-build-dir"),
    "okdev-clean":          KomodoDevCleanTask("okdev-clean", "ok-build-dir"),

    "ko51":                 KomodoFullBuildTask("ko51",
                                repo="https://svn.activestate.com/repos/activestate/komodo/branches/5.1.x/",
                                app_names=["ide"],
                                upload_dir="komodo@mule:/data/komodo/builds",
                                relevant_machine_pats=["official"]),
    "ko51dev":              KomodoDevTask("ko51dev", "ko51-build-dir",
                                relevant_machine_pats=["official"]),
    "ko51dev-configure":    KomodoDevConfigureTask("ko51dev-configure", "ko51-build-dir",
                                ["-V", "5.11.0-devel", "--without-jarring",
                                 "--without-komodo-cix", "--with-casper"],
                                relevant_machine_pats=["official"]),
    "ko51dev-reconfigure":  KomodoDevReconfigureTask("ko51dev-reconfigure", "ko-build-dir",
                                relevant_machine_pats=["official"]),
    "ko51dev-test":         KomodoDevTestTask("ko51dev-test", "ko51-build-dir",
                                relevant_machine_pats=["official"]),
    "ko51dev-clean":        KomodoDevCleanTask("ko51dev-clean", "ko51-build-dir",
                                relevant_machine_pats=["official"]),

    "ok51":                 KomodoFullBuildTask("ok51",
                                repo="https://svn.openkomodo.com/repos/openkomodo/branches/5.1.x/",
                                app_names=["edit"],
                                upload_dir="komodo@mule:/data/komodo/builds",
                                relevant_machine_pats=["official"]),
    "ok51dev":              KomodoDevTask("ok51dev", "ok51-build-dir",
                                relevant_machine_pats=["official"]),
    "ok51dev-configure":    KomodoDevConfigureTask("ok51dev-configure", "ok51-build-dir",
                                ["-V", "5.11.0-devel", "--without-jarring",
                                 "--without-komodo-cix", "--with-casper"],
                                relevant_machine_pats=["official"]),
    "ok51dev-reconfigure":  KomodoDevReconfigureTask("ok51dev-reconfigure", "ok51-build-dir",
                                relevant_machine_pats=["official"]),
    "ok51dev-test":         KomodoDevTestTask("ok51dev-test", "ok51-build-dir",
                                relevant_machine_pats=["official"]),
    "ok51dev-clean":        KomodoDevCleanTask("ok51dev-clean", "ok51-build-dir",
                                relevant_machine_pats=["official"]),

    # Special Mozilla builds.
    # - attempt at a universal build
    "komoz512u": MozillaTask("komoz512u", "5.12", "ko-build-dir",
                             moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc,
                             moz_src_spec=_g_trunk_cvs_tree, is_dev_build=True,
                             extra_config_opts="--universal",
                             relevant_machine_pats=["macosx"]),
    # - A dev build mozilla for the Mozilla CVS head as of the FF3 release date.
    "komoz512date": MozillaTask("komoz511date", "5.12", "ko-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec="cvs:HEAD:06/19/2008", is_dev_build=True),

    # Mozilla builds for release builds of Komodo IDE 5.2.x.
    "komoz52":     MozillaTask("komoz52", "5.2", "ko-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, relevant_machine_pats=["official"]),
      "komoz52a":  MozillaTask("komoz52a", "5.2", "ko-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, relevant_machine_pats=["official"]),
      "komoz52b":  MozillaTask("komoz52b", "5.2", "ko-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, relevant_machine_pats=["official"]),
      "komoz52c":  MozillaTask("komoz52c", "5.2", "ko-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, relevant_machine_pats=["official"]),
    # Mozilla builds for dev builds of Komodo IDE 5.2.x.
    "komoz512":    MozillaTask("komoz512", "5.12", "ko-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, is_dev_build=True),
      "komoz512a": MozillaTask("komoz512a", "5.12", "ko-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, is_dev_build=True),
      "komoz512b": MozillaTask("komoz512b", "5.12", "ko-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, is_dev_build=True),
      "komoz512c": MozillaTask("komoz512c", "5.12", "ko-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, is_dev_build=True),
    # Mozilla builds for release builds of Komodo Edit 5.2.x.
    "okmoz52":     MozillaTask("okmoz52", "5.2", "ok-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, relevant_machine_pats=["official"]),
      "okmoz52a":  MozillaTask("okmoz52a", "5.2", "ok-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, relevant_machine_pats=["official"]),
      "okmoz52b":  MozillaTask("okmoz52b", "5.2", "ok-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, relevant_machine_pats=["official"]),
      "okmoz52c":  MozillaTask("okmoz52c", "5.2", "ok-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, relevant_machine_pats=["official"]),
    # Mozilla builds for dev builds of Komodo Edit 5.2.x.
    "okmoz512":    MozillaTask("okmoz512", "5.12", "ok-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, is_dev_build=True),
      "okmoz512a": MozillaTask("okmoz512a", "5.12", "ok-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, is_dev_build=True),
      "okmoz512b": MozillaTask("okmoz512b", "5.12", "ok-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, is_dev_build=True),
      "okmoz512c": MozillaTask("okmoz512c", "5.12", "ok-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, is_dev_build=True),

    # Mozilla builds for release builds of Komodo IDE 5.1.x.
    "komoz51":     MozillaTask("komoz51", "5.1", "ko-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, relevant_machine_pats=["official"]),
      "komoz51a":  MozillaTask("komoz51a", "5.1", "ko-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, relevant_machine_pats=["official"]),
      "komoz51b":  MozillaTask("komoz51b", "5.1", "ko-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, relevant_machine_pats=["official"]),
      "komoz51c":  MozillaTask("komoz51c", "5.1", "ko-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, relevant_machine_pats=["official"]),
      # In between Komodo 5.1.3 and 5.1.4, the harddrive on sphinx died. Hence
      # we need new moz builds. The CVS checkout date for the 5.1.x release
      # builds on kungfu (another one of the build boxes) was:
      #     checkout start: Mon Dec 29 15:05:20 PST 2008
      # Here we try to spec a moz build of (near) the same vintage.
      "komoz51date": MozillaTask("komoz51date", "5.1", "ko-build-dir",
            moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc,
            moz_src_spec="cvs:HEAD:12/30/2008",
            relevant_machine_pats=["official"]),
    # Mozilla builds for dev builds of Komodo IDE 5.1.x.
    "komoz511":    MozillaTask("komoz511", "5.11", "ko-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, is_dev_build=True),
      "komoz511a": MozillaTask("komoz511a", "5.11", "ko-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, is_dev_build=True),
      "komoz511b": MozillaTask("komoz511b", "5.11", "ko-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, is_dev_build=True),
      "komoz511c": MozillaTask("komoz511c", "5.11", "ko-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, is_dev_build=True),
    # Mozilla builds for release builds of Komodo Edit 5.1.x.
    "okmoz51":     MozillaTask("okmoz51", "5.1", "ok-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, relevant_machine_pats=["official"]),
      "okmoz51a":  MozillaTask("okmoz51a", "5.1", "ok-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, relevant_machine_pats=["official"]),
      "okmoz51b":  MozillaTask("okmoz51b", "5.1", "ok-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, relevant_machine_pats=["official"]),
      "okmoz51c":  MozillaTask("okmoz51c", "5.1", "ok-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, relevant_machine_pats=["official"]),
      # In between Komodo 5.1.3 and 5.1.4, the harddrive on sphinx died. Hence
      # we need new moz builds. The CVS checkout date for the 5.1.x release
      # builds on kungfu (another one of the build boxes) was:
      #     checkout start: Mon Dec 29 15:41:38 PST 2008
      # Here we try to spec a moz build of (near) the same vintage.
      "okmoz51date": MozillaTask("okmoz51date", "5.1", "ok-build-dir",
            moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc,
            moz_src_spec="cvs:HEAD:12/29/2008",
            relevant_machine_pats=["official"]),
    # Mozilla builds for dev builds of Komodo Edit 5.1.x.
    "okmoz511":    MozillaTask("okmoz511", "5.11", "ok-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, is_dev_build=True),
      "okmoz511a": MozillaTask("okmoz511a", "5.11", "ok-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, is_dev_build=True),
      "okmoz511b": MozillaTask("okmoz511b", "5.11", "ok-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, is_dev_build=True),
      "okmoz511c": MozillaTask("okmoz511c", "5.11", "ok-build-dir", moz_build_dir_suffix="mozilla", msvc=_g_trunk_msvc, moz_src_spec=_g_trunk_cvs_tree, is_dev_build=True),


    "mozpy":        MozillaPythonTask("mozpy", "apy-build-dir", msvc="vc8"),
    "xdebug":       KomodoDevXdebugTask("xdebug", relevant_machine_pats=["xdebug"]),
    "koup-nightly": KoUpTask("koup-nightly", "ko-build-dir", "nightly"),
    "koup-releasetest":   KoUpTask("koup-releasetest", "ko-build-dir", "releasetest"),
    "koup-betatest":   KoUpTask("koup-betatest", "ko-build-dir", "betatest"),
    "svncleanup":   SVNCleanupTask("svncleanup"),

    #---- Diagnostic/admin tasks.
    "admin":    AdminTask("admin"),
    "hupbb":    HupBuildBotTask(),
    "slow":     SlowTask(),
    "play":     PlayTask(),
    "ci2":      CodeIntelTask("ci2", "ko-build-dir"),
    "ping":     Task("ping", [], ['echo pong'], short_output=True),
    "uname":    Task("uname", [], ['uname -a'], short_output=True,
                     relevant_machine_pats=["-win32"]),
    "plat":     Task("plat", [],
                     ['python -c "import platform; print platform.platform()"'],
                     short_output=True),
    "error":    Task("error", [],
                     ['python -c "import sys; import sys; sys.exit(42)"']),
}



#---- mainline

# Recipe: pretty_logging (0.1) in C:\trentm\tm\recipes\cookbook
class _PerLevelFormatter(logging.Formatter):
    """Allow multiple format string -- depending on the log level.

    A "fmtFromLevel" optional arg is added to the constructor. It can be
    a dictionary mapping a log record level to a format string. The
    usual "fmt" argument acts as the default.
    """
    def __init__(self, fmt=None, datefmt=None, fmtFromLevel=None):
        logging.Formatter.__init__(self, fmt, datefmt)
        if fmtFromLevel is None:
            self.fmtFromLevel = {}
        else:
            self.fmtFromLevel = fmtFromLevel
    def format(self, record):
        record.levelname = record.levelname.lower()
        if record.levelno in self.fmtFromLevel:
            #XXX This is a non-threadsafe HACK. Really the base Formatter
            #    class should provide a hook accessor for the _fmt
            #    attribute. *Could* add a lock guard here (overkill?).
            _saved_fmt = self._fmt
            self._fmt = self.fmtFromLevel[record.levelno]
            try:
                return logging.Formatter.format(self, record)
            finally:
                self._fmt = _saved_fmt
        else:
            return logging.Formatter.format(self, record)

def _setup_logging():
    hdlr = logging.StreamHandler()
    defaultFmt = "%(name)s: %(levelname)s: %(message)s"
    infoFmt = "%(name)s: %(message)s"
    fmtr = _PerLevelFormatter(fmt=defaultFmt,
                              fmtFromLevel={logging.INFO: infoFmt})
    hdlr.setFormatter(fmtr)
    logging.root.addHandler(hdlr)
    log.setLevel(logging.INFO)

class _NoReflowFormatter(optparse.IndentedHelpFormatter):
    """An optparse formatter that does NOT reflow the description."""
    def format_description(self, description):
        return description or ""

def main(argv):
    usage = "usage: %prog ACTIONS..."
    version = "%prog "+__version__
    parser = optparse.OptionParser(
        prog="rrun.py", usage=usage, version=version,
        description=__doc__, formatter=_NoReflowFormatter())
    parser.add_option("-v", "--verbose", dest="log_level",
                      action="store_const", const=logging.DEBUG,
                      help="more verbose output")
    parser.add_option("-q", "--quiet", dest="log_level",
                      action="store_const", const=logging.WARNING,
                      help="quieter output")
    parser.add_option("-m", "--machines", action="append",
                      help="specify machines on which to build")
    parser.add_option("-L", "--log-dir", action="store",
                      help="specify a log directory (default is './log')")
    parser.add_option("-n", "--dry-run", action="store_true",
                      help="don't execute, just print what would be done")
    parser.add_option("-D", "--define", dest="defines", action="append",
        help="Define one or more arguments to pass to tasks. "
             "*What* arguments are accepted depends on the task. "
             "E.g. 'rrun.py ko -D revision=1234'")
    parser.set_defaults(log_dir="log", dry_run=False, defines=[])
    parser.set_defaults(log_level=logging.INFO)
    opts, task_names = parser.parse_args()
    log.setLevel(opts.log_level)

    defines = {}
    for define_str in opts.defines:
        try:
            name, value = define_str.split('=', 1)
        except ValueError:
            log.error("invalid define, %r, must be of the form: "
                      "'name=value'", define_str)
            return 1
        defines[name] = value

    results = rrun(task_names, machine_pats=opts.machines,
                   defines=defines, log_dir=opts.log_dir,
                   dry_run=opts.dry_run)
    return len([r["retval"] for r in results if r["retval"]])


if __name__ == "__main__":
    if sys.version_info[:2] <= (2,2): __file__ = sys.argv[0]
    _setup_logging()
    try:
        retval = main(sys.argv)
    except SystemExit:
        pass
    except KeyboardInterrupt:
        sys.exit(1)
    except:
        exc_info = sys.exc_info()
        if log.isEnabledFor(logging.DEBUG):
            print
            traceback.print_exception(*exc_info)
        else:
            if hasattr(exc_info[0], "__name__"):
                #log.error("%s: %s", exc_info[0].__name__, exc_info[1])
                log.error(exc_info[1])
            else:  # string exception
                log.error(exc_info[0])
        sys.exit(1)
    else:
        sys.exit(retval)


