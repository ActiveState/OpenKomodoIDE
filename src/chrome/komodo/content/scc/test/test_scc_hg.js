/* Copyright (c) 2007 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

try {
dump("Loading test_scc_hg.js...\n");
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

var log = Casper.Logging.getLogger("Casper::test_scc_hg");

// setup the test case
function test_scc_hg() {
    // "test_scc_" + name; must be the same as the class name!!
    SccBaseClass.apply(this, ["hg"]);
    this.saved_prefs = {};
}
test_scc_hg.prototype = new SccBaseClass("hg");
test_scc_hg.prototype.constructor = test_scc_hg;

test_scc_hg.prototype.setup = function() {
    var tmpDirPath = this.fileSvc.makeTempName("test_scc_hg");
    this.osSvc.mkdir(tmpDirPath);
    this.repositoryPath = tmpDirPath + this.osSvc.sep + "repository";
    this.workspacePath = this.repositoryPath;
    this.osSvc.mkdir(this.repositoryPath);

    // Make the repository.
    var cmd = "hg init";
    var stdoutObj = new Object();
    var stderrObj = new Object();
    var retval = this.runSvc.RunAndCaptureOutput(cmd, this.repositoryPath,
                                                 null, null,
                                                 stdoutObj, stderrObj);
    if (retval != 0) {
        throw new Error(stderrObj.value);
    }

    //dump("Workspace path is " + this.workspacePath + "\n");
}

test_scc_hg.prototype.tearDown = function() {
}


/* TEST SUITE */

// we do not pass an instance of MyTestCase, they are created in MakeSuite
var suite = new Casper.UnitTest.TestSuite("SCC hg");
suite.add(new test_scc_hg());
Casper.UnitTest.testRunner.add(suite);

} catch(e) {
    var CasperLog = Casper.Logging.getLogger("Casper::global");
    CasperLog.exception(e);
}
