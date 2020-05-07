/* Copyright (c) 2007 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

try {
dump("Loading test_scc_cvs.js...\n");
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

var log = Casper.Logging.getLogger("Casper::test_scc_cvs");

// setup the test case
function test_scc_cvs() {
    // "test_scc_" + name; must be the same as the class name!!
    SccBaseClass.apply(this, ["cvs"]);
    this.saved_prefs = {};
}
test_scc_cvs.prototype = new SccBaseClass("cvs");
test_scc_cvs.prototype.constructor = test_scc_cvs;

test_scc_cvs.prototype.setup = function() {
    var tmpDirPath = this.fileSvc.makeTempName("test_scc_cvs");
    this.osSvc.mkdir(tmpDirPath);
    this.repositoryPath = tmpDirPath + this.osSvc.sep + "repository";
    this.osSvc.mkdir(this.repositoryPath);
    var basePath = tmpDirPath + this.osSvc.sep + "work";
    this.osSvc.mkdir(basePath);
    this.workspacePath = basePath + this.osSvc.sep + "workspace";
    this.osSvc.mkdir(this.workspacePath);

    // Make the repository.
    // Try and use the cvs executable set in prefs.
    var cvs_command = this.prefs.getStringPref('cvsExecutable');
    if (!cvs_command) {
        cvs_command = "cvs";
    } else {
        // XXX - Escaping should be handled by the run service.
        cvs_command = '"' + cvs_command + '"';
    }
    cvs_command += ' -d "' + this.repositoryPath + '" ';
    var cmd =  cvs_command + "init";
    var stdoutObj = new Object();
    var stderrObj = new Object();
    var retval = this.runSvc.RunAndCaptureOutput(cmd, this.repositoryPath,
                                                 null, null,
                                                 stdoutObj, stderrObj);
    if (retval != 0) {
        throw new Error(stderrObj.value);
    }

    // Initial import
    cmd =  cvs_command + "import -m 'Initial import' workspace devel testing";
    stdoutObj = new Object();
    stderrObj = new Object();
    retval = this.runSvc.RunAndCaptureOutput(cmd, basePath, null,
                                             null, stdoutObj, stderrObj);
    if (retval != 0) {
        throw new Error(stderrObj.value);
    }

    // Checkout.
    cmd =  cvs_command + "co workspace";
    stdoutObj = new Object();
    stderrObj = new Object();
    retval = this.runSvc.RunAndCaptureOutput(cmd, basePath, null,
                                             null, stdoutObj, stderrObj);
    if (retval != 0) {
        throw new Error(stderrrObj.value);
    }
    //dump("Workspace path is " + this.workspacePath + "\n");
}

test_scc_cvs.prototype.tearDown = function() {
}


/* Overriden test cases */

/* TEST SUITE */

// we do not pass an instance of MyTestCase, they are created in MakeSuite
var suite = new Casper.UnitTest.TestSuite("SCC cvs");
suite.add(new test_scc_cvs());
Casper.UnitTest.testRunner.add(suite);

} catch(e) {
    var CasperLog = Casper.Logging.getLogger("Casper::global");
    CasperLog.exception(e);
}
