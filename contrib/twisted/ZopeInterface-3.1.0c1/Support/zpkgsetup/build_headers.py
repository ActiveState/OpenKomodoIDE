"""
"""
__docformat__ = "reStructuredText"

import distutils.core
import distutils.util
import os.path


class build_headers(distutils.core.Command):
    """Command that builds out the headers into build/headers-X.Y/.

    The structure of the build/headers-X.Y/ directory is analogous to
    that of the $exec_prefix/include/pythonX.Y/ directory: each
    package gets a corresponding directory to which its public headers
    are copied.  When the extension modules are built, this directory
    will be added to the include search path before that containing
    the Python headers.

    """

    description = "build out the public headers"

    user_options = [
        ('build-dir=', 'd', "directory to \"build\" (copy) to"),
        ('force', 'f', "forcibly build everything (ignore file timestamps"),
        ]

    boolean_options = ['force']

    def initialize_options (self):
        self.build_dir = None
        self.force = None
        self.package_headers = None
        self.outfiles = []

    def finalize_options (self):
        self.set_undefined_options('build',
                                   ('build_headers', 'build_dir'),
                                   ('force', 'force'))
        self.package_headers = self.distribution.package_headers

    def run(self):
        if not self.package_headers:
            return
        for header in self.package_headers:
            if header.package:
                dir = os.path.join(self.build_dir, header.package)
            else:
                dir = self.build_dir
            self.mkpath(dir)
            srcfile = distutils.util.convert_path(header.path)
            outfile = os.path.join(
                self.build_dir, header.package, os.path.basename(srcfile))
            self.copy_file(srcfile, outfile)
            self.outfiles.append(outfile)
