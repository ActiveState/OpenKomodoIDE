Build instructions for Komodo's dbexplorer_oracle adaptor.

About
-----

Komodo uses the Python DB API adaptor "cx_Oracle" to communicate with Oracle
servers. This cx_Oracle adaptor consists of a single binary library, which is
compiled against a specific version of the Oracle Instant Client library.

The dbexplorer_oracle add-on comes with prebuilt cx_Oracle binaries that work
with the Oracle Instant Client 11.2 library (10.2 on the Mac). If these do not
work for you, then you can also built cx_Oracle yourself using the sources
provided in this extension.

In order to build the cx_Oracle binary for yourself, follow the build
instructions below.

Building cx_Oracle
------------------

1. Requirements

   * Installed Komodo IDE 6.0.0b1 (or later)
   * Locally installed Oracle Instant Client (basic + sdk) libraries - these are
     available for free through the Oracle web site.
   * Compiler - GCC (Linux, Mac) or MSVC++ 2008 (Windows)

2. Start a new shell. For Windows and Linux, you'll need to be using Komodo's
   siloed python. On Windows, this will be at a location like
   <komodo-install-dir>/lib/python/, on Linux it will be at
   <komodo-install-dir>/lib/python/bin. On Mac OS X you can just use your own
   locally installed Python 2.6 intepreter.

   On Linux you'll also need to set the LD_LIBRARY_PATH and LDFLAGS environment
   variable to point to Komodo's Python libraries:
     export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:<komodo-install-dir>/lib/python/lib
     export LDFLAGS=-L<komodo-install-dir>/lib/python/lib

3. Set the ORACLE_HOME environment variable to point to the directory where your
   oracle client files are located. This should contain the .dll or .so files of
   the oracle client.

4. cd into this extension's src/ subdirectory

5. python setup.py build

   If you run into build errors, check the troubleshooting notes below.

6. Now you're going to copy the binary result to the platform-specific
   directory of this extension.  The target file is in a directory
   with a name matching build/lib.<platform>-<pyver>-<oracleVer>,
   and is called cx_Oracle.pyd on Windows, cx_Oracle.so on Linux (and OS X),
   should you manage to build it there.  We'll call it $CX_ORA_LIBRARY

7. Komodo follows the Mozilla convention of putting platform-specific binary
   files in the subdirectory
   
   platform/$PLATNAME/pylib/
   
   where PLATNAME corresponds to one of the following platforms:
   
   Windows(all versions): WINNT_x86-msvc
   Linux 32-bit:          Linux_x86-gcc3
   Linux 64-bit:          Linux_x86_64-gcc3
   OSX/intel:             Darwin_x86-gcc3
   OSX/ppc:               Darwin_ppc-gcc3
   
   We'll call the appropriate directory $TARGET
   
8. At this point you can either modify your current dbexplorer_oracle extension,
   by copying $CX_ORA_LIBRARY into
   <komodo-install-dir>/lib/mozilla/extensions/dbexplorer_oracle@Activestate.com/$TARGET,
   or you can copy it into the $TARGET directory in this extension, rebuild the
   extension with these commands:
   
   zip -r dbexplorer_oracle.jar skin
   zip -r dbexplorer_oracle.X.Y.Z.xpi chrome.manifest platform \
      dbexplorer_oracle.jar components install.rdf pylib src
      
   and reinstall the extension.


TROUBLESHOOTING
---------------

* If you receive errors in Komodo about being unable to load the cx_Oracle
  module, then you may need to add the path to the Oracle Client Libraries to
  your environment.

  * On Linux: add the client library directory to your LD_LIBRARY_PATH before
    you start Komodo.

  * On Mac: add the client library directory to your DYLD_LIBRARY_PATH before
    you start Komodo.

Linux:

  * If you recieve errors about Komodo being unable to load "libaio.so", you'll
    need to install this library in your OS (it should be available through your
    OS package manager).

  * If the build fails due to a missing "clntsh" library, go to your
    $ORACLE_HOME directory and make a symlink for "libclntsh.so.11.1", example
    command below:
      $ ln -s  libclntsh.so.11.1  libclntsh.so

Mac:

  * If the build fails due to a missing "clntsh" library, go to your
    $ORACLE_HOME directory and make a symlink for "libclntsh.dylib.11.1",
    example command below:
      $ ln -s  libclntsh.dylib.11.1  libclntsh.dylib
