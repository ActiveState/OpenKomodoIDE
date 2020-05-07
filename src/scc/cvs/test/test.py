#!python

"""
    cvslib.py Regression Test Suite Harness

    This will find all modules whose name is "test_*" in the test
    directory, and run them.  Various command line options provide
    additional facilities.

    Usage:
        python test.py [<options>...] [<tests>...]

    Options:
        -x <testname>, --exclude=<testname>
                        Exclude the named test from the set of tests to be
                        run.  This can be used multiple times to specify
                        multiple exclusions.
        -v, --verbose   Run tests in verbose mode with output to stdout.
        -q, --quiet     Don't print anything except if a test fails.
        -h, --help      Print this text and exit.

    If non-option arguments are present, they are names for tests to run.
    If no test names are given, all tests are run.

    CVS Test Server setup options:
        -c, --clean     Just clean up the test workspace.
        -n, --no-clean  Do not clean up the test workspace after running the
                        test suite.

    Because this test suite intends to test a module which interfaces to CVS
    it will create a test CVS repository (and clean up afterwards) which the
    individual tests can use.
"""
#TODO:
#   - Add option to pass in a test CVSROOT to use, then can setup a test
#     pserver on some Unix box and test through it.


import os, sys, getopt, glob
import unittest
import testsupport

class TestError(Exception): pass

#---- globals

gVerbosity = 2


#---- utility routines

def _getAllTests(testDir):
    """Return a list of all tests to run."""
    testPyFiles = glob.glob(os.path.join(testDir, "test_*.py"))
    modules = [f[:-3] for f in testPyFiles if f and f.endswith(".py")]

    packages = []
    for f in glob.glob(os.path.join(testDir, "test_*")):
        if os.path.isdir(f) and "." not in f:
            if os.path.isfile(os.path.join(testDir, f, "__init__.py")):
                packages.append(f)

    return modules + packages


def _setUp():
    print "="*40
    print "Setting up cvslib.py test workspace..."

    # Steps to setup repository:
    # We will create a repository with a "supper" project. The admin user is
    # 'testharness' who does the initial import into CVS. Individual tests in
    # the suite should work on the supper project as users "Andrew" and
    # "Bertha", with home directories <tmp>/andrew and <tmp>/bertha. (I am
    # presuming that only two users are necessary to simulate all situations).
    # 
    # Create the dir in which all testing will be done.  (Note: On Windows,
    # <tmp> *has* to be on the same drive because CVSROOT cannot have the colon
    # from a drive spec.)
    #     > mkdir <tmp>
    if os.path.exists(testsupport.rootDir):
        raise TestError("The intended temp directory for CVS testing "\
                        "already exists! You must clean this up before "\
                        "running this test suite: '%s'" % testsupport.rootDir)
    os.makedirs(testsupport.rootDir)

    # Create the repository dir and initialize the repository:
    #     > cvs init
    print "Creating a CVS repository at CVSROOT=%s" % testsupport.cvsroot
    if os.system('cvs -d %s init' % testsupport.cvsroot):
        raise TestError("Problem initializing test CVS repository.")

    # Create a starter project, "supper", to work with:
    #     > mkdir <tmp>/testharness/supper
    #     > cd <tmp>/testharness/supper
    #     > echo eggs,ham,spam > recipe.txt
    #     > cvs import -m "initial import into CVS" supper testharness start
    #     > cd ../../..
    #     > rm -rf <tmp>/testharness
    homedir = os.path.join(testsupport.rootDir, 'testharness')
    projname = 'supper'
    projdir = os.path.join(homedir, projname)
    os.makedirs(projdir)
    open(os.path.join(projdir, 'recipe.txt'), 'w').write('eggs\nham\nspam\n')
    top = os.getcwd()
    try:
        os.chdir(projdir)
        cmd = 'cvs -d %s import -m "initial import into CVS" supper '\
              'testharness start' % testsupport.cvsroot
        if os.system(cmd):
            raise TestError("Problem importing 'supper' project into CVS.")
    finally:
        os.chdir(top)

    # Setup "home" directories for the "users" of the test server:
    # XXX Though I don't know how to spoof the checkin username. Will have to
    #     worry about that when setting up a pserver, which I am sure I will
    #     have to do for this (for testing authentication stuff.
    #     > mkdir <tmp>/andrew
    #     > mkdir <tmp>/bertha
    for username, user in testsupport.users.items():
        os.makedirs(user['home'])

    # Put cvslib.py on sys.path.
    sys.path.insert(0, os.path.abspath(os.pardir))

    print "="*40


def _tearDown():
    print "="*40
    print "Tearing down cvslib.py test workspace..."
    if os.path.exists(testsupport.rootDir):
        print "Removing '%s'." % testsupport.rootDir
        testsupport._rmtree(testsupport.rootDir)
    print "="*40


def test(testModules, testDir=os.curdir, exclude=[]):
    """Run the given regression tests and report the results."""
    # Determine the test modules to run.
    if not testModules:
        testModules = _getAllTests(testDir)
    testModules = [t for t in testModules if t not in exclude]

    # Aggregate the TestSuite's from each module into one big one.
    allSuites = []
    for moduleFile in testModules:
        module = __import__(moduleFile, globals(), locals(), [])
        suite = getattr(module, "suite", None)
        if suite is not None:
            allSuites.append(suite())
        else:
            if gVerbosity >= 2:
                print "warning: module '%s' did not have a suite() method."\
                      % moduleFile
    suite = unittest.TestSuite(allSuites)

    # Run the suite.
    runner = unittest.TextTestRunner(sys.stdout, verbosity=gVerbosity)
    result = runner.run(suite)


#---- mainline

def main(argv):
    testDir = os.path.dirname(sys.argv[0])

    # parse options
    global gVerbosity
    try:
        opts, testModules = getopt.getopt(sys.argv[1:], 'hvqx:cn',
            ['help', 'verbose', 'quiet', 'exclude=', 'clean', 'no-clean'])
    except getopt.error, ex:
        print "%s: error: %s" % (argv[0], ex)
        print __doc__
        sys.exit(2)  
    exclude = []
    justClean = 0
    clean = 1
    for opt, optarg in opts:
        if opt in ("-h", "--help"):
            print __doc__
            sys.exit(0)
        elif opt in ("-v", "--verbose"):
            gVerbosity += 1
        elif opt in ("-q", "--quiet"):
            gVerbosity -= 1
        elif opt in ("-x", "--exclude"):
            exclude.append(optarg)
        elif opt in ("-n", "--no-clean"):
            clean = 0
        elif opt in ("-c", "--clean"):
            justClean = 1

    retval = None
    if not justClean:
        _setUp()
        retval = test(testModules, testDir=testDir, exclude=exclude)
    #XXX should also not tear down if test failed
    if clean:
        _tearDown()


if __name__ == '__main__':
    sys.exit( main(sys.argv) )

