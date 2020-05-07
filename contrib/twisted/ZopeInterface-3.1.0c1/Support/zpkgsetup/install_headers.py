##############################################################################
#
# Copyright (c) 2004 Zope Corporation and Contributors.
# All Rights Reserved.
#
# This software is subject to the provisions of the Zope Public License,
# Version 2.1 (ZPL).  A copy of the ZPL should accompany this distribution.
# THIS SOFTWARE IS PROVIDED "AS IS" AND ANY AND ALL EXPRESS OR IMPLIED
# WARRANTIES ARE DISCLAIMED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
# WARRANTIES OF TITLE, MERCHANTABILITY, AGAINST INFRINGEMENT, AND FITNESS
# FOR A PARTICULAR PURPOSE.
#
##############################################################################
"""\
install_headers command that installs each header into a
Python-package specific location.

This allows zpkg-based distributions to install the headers
consistently based on the package that provides them, rather than
installing them according to the collection package that contains the
individual packages.

"""

import os
import distutils.command.install_headers


class install_headers(distutils.command.install_headers.install_headers):

    def run(self):
        headers = self.distribution.package_headers
        if not headers:
            return

        # Since the top-level collection package name gets added,
        # remove that, and replace it with the right package name for
        # each header:
        install_base = os.path.dirname(self.install_dir)
        self.mkpath(install_base)

        for header in headers:
            if header.package:
                install_dir = os.path.join(install_base, header.package)
            else:
                install_dir = install_base
            self.mkpath(install_dir)
            (out, _) = self.copy_file(header.path, install_dir)
            self.outfiles.append(out)
