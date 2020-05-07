---
title: Komodo Installation Guide
---
## <a name="Lang_Debug_Prerequisites" id="Lang_Debug_Prerequisites">Language and Debugging Prerequisites</a>

- **Debugging**: If firewall software is installed on the system, it must be configured to allow Komodo to access the network during remote debugging.
- **Debugger Proxy**: The optional [Debugger Proxy](/manual/debugger.html#dbgp_proxy) (`pydbgpproxy`) requires **Python** to be installed on the target machine.
- **Node.js**: You will need node v0.4 or greater to debug Node.js programs. You can get the latest version of Node for most platforms from [nodejs.org](http://nodejs.org/). The [komodo-debug](https://www.npmjs.com/package/komodo-debug) package can be installed with [npm](http://npmjs.org/) for remote debugging.
- **Perl**: **Perl 5.6** or greater is required to debug Perl programs. Download the latest version of [ActivePerl](http://www.ActiveState.com/activeperl) from the ActiveState website. Ensure that the directory location of the Perl interpreter (by default, `C:\perl`) is included in your system's `PATH` environment variable. On Windows, some features such as background syntax checking and remote debugging may require ActivePerl -- there are known incompatibilities with Cygwin and msys perl.
- **Python**: **Python 2.4** or greater is required to debug Python programs. You can download the latest version of [ActivePython](http://www.ActiveState.com/activepython/) from the ActiveState website. Ensure that the directory location of the Python interpreter (by default `C:\Pythonxx` (where "xx" is the Python version)) is included in your system's `PATH` environment variable.
- **PHP**: **PHP 4.4** or greater is required to debug PHP programs. Download PHP from [http://www.php.net/downloads.php](http://www.php.net/downloads.php). For complete instructions for configuring Komodo and PHP, see [Configuring the PHP Debugger](/manual/debugphp.html).
- **Tcl**: **Tcl 7.6** or greater is required to debug Tcl programs. Download the latest version of [ActiveTcl](http://www.ActiveState.com/activetcl) from the ActiveState website.
- **Ruby**: **Ruby 1.8.4** or greater is required to debug Ruby programs. Download the latest version of Ruby from [http://rubyinstaller.rubyforge.org/wiki/wiki.pl](http://rubyinstaller.rubyforge.org/wiki/wiki.pl). Cygwin-based versions of Ruby are currently unsupported. Ruby 1.9.1 (and later) users will need to also install ruby-debug-base (e.g. `gem install ruby-debug-base19`) as a compatible version is not shipped with Komodo.

The debugging libraries for all languages are bundled with Komodo IDE, but they are also available for download from the [Komodo Bits](http://code.activestate.com/komodo/remotedebugging/) page.

## <a name="SCC_Prerequisites" id="SCC_Prerequisites">Source Code Control Integration Prerequisites</a>

- **CVS Source Control Integration**: Requires CVS, which is available from [http://www.nongnu.org/cvs/](http://www.nongnu.org/cvs/), or the latest stable version of CVSNT, which is available from [http://www.cvsnt.org/wiki/](http://www.cvsnt.org/wiki/).
- **CVS Source Control Integration using Putty** (Windows): Requires Putty version 0.52 or greater.
- **Perforce Source Control Integration**: Requires a connection to a Perforce server with version 99.1 or later.
- **Subversion Source Code Control Integration**: Requires the svn command line client, available from [http://subversion.tigris.org/](http://subversion.tigris.org/). Komodo cannot use the TortoiseSVN client as its SVN executable.
