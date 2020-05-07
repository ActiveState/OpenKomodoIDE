/* Copyright (c) 2007 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

try {
dump("Loading test_scc_svn.js...\n");
// Include the scc base class.
var nsIFile = Components.classes["@mozilla.org/file/local;1"].
                      createInstance(Components.interfaces.nsILocalFile);
var script_path = Components.stack.filename;
// Because we are importing through jslib, this will given a script path that
// looks like this:
//    chrome://jslib/content/jslib.js -> file:///home/user/test/test_scc.js
var path_split = script_path.split(" -> ");
if (path_split.length > 1) {
    script_path = path_split[path_split.length - 1];
}
nsIFile.initWithPath(ko.uriparse.URIToLocalPath(script_path));
nsIFile = nsIFile.parent;
nsIFile.append("SccBaseTestClass.js");
xtk.load(ko.uriparse.localPathToURI(nsIFile.path));

var log = Casper.Logging.getLogger("Casper::test_scc_svn");

// setup the test case
function test_scc_svn() {
    // "test_scc_" + name; must be the same as the class name!!
    SccBaseClass.apply(this, ["svn"]);
    this.saved_prefs = {};
}
test_scc_svn.prototype = new SccBaseClass("svn");
test_scc_svn.prototype.constructor = test_scc_svn;

test_scc_svn.prototype.setup = function() {
    var tmpDirPath = this.fileSvc.makeTempName("test_scc_svn");
    this.osSvc.mkdir(tmpDirPath);
    this.repositoryPath = tmpDirPath + this.osSvc.sep + "repository";
    this.osSvc.mkdir(this.repositoryPath);

    // Make the repository.
    var cmd = "svnadmin create .";
    var stdoutObj = new Object();
    var stderrObj = new Object();
    var retval = this.runSvc.RunAndCaptureOutput(cmd, this.repositoryPath,
                                                 null, null,
                                                 stdoutObj, stderrObj);
    if (retval != 0) {
        throw new Error(stderrObj.value);
    }

    // Checkout. Try and use the svn executable set in prefs.
    var cmd = this.prefs.getStringPref('svnExecutable');
    if (!cmd) {
        cmd = "svn";
    } else {
        // XXX - Escaping should be handled by the run service.
        cmd = '"' + cmd + '"';
    }
    cmd += " co " + ko.uriparse.localPathToURI(this.repositoryPath) +
           " workspace";

    stdoutObj = new Object();
    stderrObj = new Object();
    retval = this.runSvc.RunAndCaptureOutput(cmd, tmpDirPath, null, null,
                                             stdoutObj, stderrObj);
    if (retval != 0) {
        throw new Error(stderrObj.value);
    }
    this.workspacePath = tmpDirPath + this.osSvc.sep + "workspace";
    //dump("Workspace path is " + this.workspacePath + "\n");
}

test_scc_svn.prototype.tearDown = function() {
}


/* TEST SUITE */

// we do not pass an instance of MyTestCase, they are created in MakeSuite
var suite = new Casper.UnitTest.TestSuite("SCC svn");
suite.add(new test_scc_svn());
Casper.UnitTest.testRunner.add(suite);

} catch(e) {
    var CasperLog = Casper.Logging.getLogger("Casper::global");
    CasperLog.exception(e);
}
