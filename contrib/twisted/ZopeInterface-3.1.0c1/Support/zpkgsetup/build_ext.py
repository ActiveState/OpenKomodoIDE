"""Extended build_ext command that adds support for 'built' headers.

If there are any public headers for any of the packages included in
this distribution, the build/include-X.Y/ directory is added to the
include path of the extensions being built.  This also ensures that
the build_headers command runs before the build_ext command.

"""
__docformat__ = "reStructuredText"

import distutils.command.build_ext
import os.path


class build_ext(distutils.command.build_ext.build_ext):

    def run(self):
        cmd = self.get_finalized_command("build_headers")
        if cmd.package_headers:
            self.run_command("build_headers")
            self._extra_includes = cmd.build_dir
        else:
            self._extra_includes = None
        distutils.command.build_ext.build_ext.run(self)

    def build_extension(self, ext):
        if self._extra_includes:
            ext.include_dirs.append(self._extra_includes)
        distutils.command.build_ext.build_ext.build_extension(self, ext)
