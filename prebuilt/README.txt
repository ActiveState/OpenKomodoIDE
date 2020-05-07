~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
README for Komodo's prebuilt area
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Table of Contents
=================

    Introduction
    Building XDebug for PHP on Linux
    Updating XSLT DBPG bits


Introduction
============

This tree includes binary bits (generally) that are shipped with Komodo but
whose build process is not a normal part of the Komodo build process.

* also see internal-docs/howto-prebuilt.txt



Building XDebug for PHP on Linux
================================

See "src/xdebug/..." and "bk build xdebug".


Updating XSLT DBPG bits
=======================

We have a binary DBGP client for XSLT debugging based on libxml2/libxslt.
Here is how you update it.

1. You need installs of libxml2 and libxslt. On Windows::

        XXX see internal-docs\howto-prebuilt.txt

   On Un*x::

        cd Komodo-devel
        mkdir -p build2
        cd build2
        mkdir -p local
        export PREFIX=`pwd`/local
        export SUPPORTDIR=/mnt/crimper/home/apps/Komodo/support

        tar xzf $SUPPORTDIR/php/libxml2-2.6.22.tar.gz
        cd libxml2-2.6.22
        ./configure --prefix=$PREFIX --enable-shared=no
        make && make install
        cd ..

        tar xzf $SUPPORTDIR/php/libxslt-1.1.15.tar.gz
        cd libxslt-1.1.15
        ./configure --prefix=$PREFIX --enable-shared=no \
            --with-libxml-prefix=$PREFIX
        make && make install

2. Update and patch our local copy of ``xsltproc.c``::

        # Presuming we are still in the libxslt dir (as if you just finished
        # step 1).
        p4 edit ../../src/dbgp/xslt/xsltproc.c
        cp xsltproc/xsltproc.c ../../src/dbgp/xslt/xsltproc.c
        cd ../../src/dbgp/xslt
        patch -p0 < xsltproc.patch
        # Possibly checkin changes to xsltproc (if you've changed the version
        # of libxslt against which you are building):
        #   p4 submit xsltproc.c

3. Build the new xsltdbgp bit::

        # Presuming you are still in the src/dbgp/xslt dir
        # and still have the PREFIX setting from step 1.

        # Set PLATFORM to the appropriate of:
        #   linux-libcpp5
        #   solaris
        #   darwin
        #   macosx-x86
        export PLATFORM=linux-libcpp5
        make
        p4 edit ../../../prebuilt/$PLATFORM/release/xslt/xsltdbgp
        make install
        p4 submit ../../../prebuilt/$PLATFORM/release/xslt/...


