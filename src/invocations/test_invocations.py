import sys, time
import threading
print "Starting with args", sys.argv
if __name__=='__main__' and len(sys.argv)>1 and sys.argv[1]=="subtest":
    print "Executed by test script - sleeping for 4 secs"
    time.sleep(4)
    print "Awake - terminating with exitcode=99"
    sys.exit(99)

from xpcom import components

INVOKE_RUN = components.interfaces.koIInvocation.INVOKE_RUN
INVOKE_DEBUG = components.interfaces.koIInvocation.INVOKE_DEBUG
INVOKE_BUILD = components.interfaces.koIInvocation.INVOKE_BUILD

class OutputFile:
    _com_interfaces_ = components.interfaces.koIFile
    def __init__(self, prefix):
        self.prefix = prefix
    def write(self, output):
        output = output.replace("\n", "\n%s>" % (self.prefix,))
        sys.stdout.write(output)

# XXX This test is somewhat crippled because the "TerminationListener"
#     stuff has been stripped from invocations in favor of using the
#     notification system.

def DoRun(invocation, prefix):
    invocation.stdout = OutputFile(prefix + " stdout")
    invocation.stderr = OutputFile(prefix + " stderr")
    invocation.invoke(INVOKE_RUN)

def TestPerlInvocation():
    invocation = components.classes["@activestate.com/koInvocation;1?type=Perl"].createInstance()
    cat, inst = invocation.getDefaultPreferences()
    invocation.currentCategoryPreferences = cat
    invocation.currentInstancePreferences = inst
    if not inst.getStringPref('executable'):
        print "** Error - invocation did not default the executable, so I can't continue!"
        return 
    inst.setStringPref('params' ,"subtest")
    inst.setBooleanPref("use-console", 0)

    # check we fail validation before setting the filename
    ok, pref_id, message = invocation.validate(INVOKE_RUN)
    if ok:
        raise RuntimeError, "The preference set did not fail validation without a filename"

    inst.setStringPref('filename', "f:\\temp\\delme.pl")

    ok, pref_id, message = invocation.validate(INVOKE_RUN)
    if not ok:
        raise RuntimeError, "Can not execute test program: the preference %s is invalid - %s" % (pref_id, message)
    DoRun(invocation, "Perl Test")


def TestPythonInvocation():
    invocation = components.classes["@activestate.com/koInvocation;1?type=Python"].createInstance()
    cat, inst = invocation.getDefaultPreferences()
    invocation.currentCategoryPreferences = cat
    invocation.currentInstancePreferences = inst
    if inst.getStringPref('executable'):
        print "Invocation defaulted executable to '%s' - using it" % (inst.getStringPref('executable'),)
    else:
        print "Invocation did not have an executable - using '%s'"
        inst.setStringPref('executable', sys.executable)
    inst.setStringPref('params' ," subtest")
    inst.setBooleanPref("use-console", 0)

    # check we fail validation before setting the filename
    ok, pref_id, message = invocation.validate(INVOKE_RUN)
    if ok:
        raise RuntimeError, "The preference set did not fail validation without a filename"

    inst.setStringPref('filename', sys.argv[0])

    ok, pref_id, message = invocation.validate(INVOKE_RUN)
    if not ok:
        raise RuntimeError, "Can not execute test program: the preference %s is invalid - %s" % (pref_id, message)
    DoRun(invocation, "Python Test")

def TestCommandInvocation():
    invocation = components.classes["@activestate.com/koInvocation;1?type=Command"].createInstance()
    cat, inst = invocation.getDefaultPreferences()
    invocation.currentCategoryPreferences = cat
    invocation.currentInstancePreferences = inst

    # check we fail validation before setting the filename
    ok, pref_id, message = invocation.validate(INVOKE_RUN)
    if ok:
        raise RuntimeError, "The preference set did not fail validation without a filename"
    
    invocation.currentInstancePreferences.setStringPref("filename", sys.executable)
    params = " -u " + sys.argv[0] + " " + "subtest"
    invocation.currentInstancePreferences.setStringPref("params", params)

    ok, pref_id, message = invocation.validate(INVOKE_RUN)
    if not ok:
        raise RuntimeError, "Can not execute test program: the preference %s is invalid - %s" % (pref_id, message)

    DoRun(invocation, "Batch Test")

if __name__=='__main__':
    TestCommandInvocation()
    TestPerlInvocation()
    TestPythonInvocation()
