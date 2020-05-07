"""Extended 'build' command that adds support for build_headers.

"""
__docformat__ = "reStructuredText"

import distutils.command.build
import os.path
import sys


class build(distutils.command.build.build):

    user_options = distutils.command.build.build.user_options + [
        ('build-headers=', None,
         "build directory for headers"),
        ]

    def has_headers(self):
        return self.distribution.has_headers()

    # add build_headers before build_ext:
    sub_commands = list(distutils.command.build.build.sub_commands)
    for i in range(len(sub_commands)):
        if sub_commands[i][0] == "build_ext":
            sub_commands.insert(i, ("build_headers", has_headers))

    def initialize_options(self):
        distutils.command.build.build.initialize_options(self)
        self.build_headers = None

    def finalize_options(self):
        distutils.command.build.build.finalize_options(self)
        if self.build_headers is None:
            self.build_headers = os.path.join(self.build_base,
                                              "include-" + sys.version[0:3])
