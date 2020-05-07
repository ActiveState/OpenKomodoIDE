/* Copyright (c) 2007 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

try {
dump("Loading test_scc_p4.js...\n");
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

var log = Casper.Logging.getLogger("Casper::test_scc_p4");

// setup the test case
function test_scc_p4() {
    // "test_scc_" + name; must be the same as the class name!!
    SccBaseClass.apply(this, ["p4"]);
    this.saved_prefs = {};
}
test_scc_p4.prototype = new SccBaseClass("p4");
test_scc_p4.prototype.constructor = test_scc_p4;

test_scc_p4.prototype.setup = function() {
    var tmpDirPath = this.fileSvc.makeTempName("test_scc_p4");
    this.osSvc.mkdir(tmpDirPath);
    this.repositoryPath = tmpDirPath + this.osSvc.sep + "repository";
    this.osSvc.mkdir(this.repositoryPath);
    this.workspacePath = tmpDirPath + this.osSvc.sep + "workspace";
    this.osSvc.mkdir(this.workspacePath);

    this.p4_client = "komodo-scc-testing";
    this.p4_client_spec = "Client:\t" + this.p4_client + "\n\n" +
                          "Owner:\tkomodo\n\n" +
                          "Host:\tlocalhost\n\n" +
                          "Description:\n" +
                              "\tCreated by komodo.\n\n" +
                          "Root:\t" + this.workspacePath + "\n\n" +
                          "Options:\tnoallwrite noclobber nocompress unlocked nomodtime normdir\n\n" +
                          "SubmitOptions:  submitunchanged\n\n" +
                          "LineEnd:\tlocal\n\n" +
                          "View:\n" +
                              "\t//depot/... //komodo-scc-testing/...\n\n";
    //dump("this.p4_client_spec: " + this.p4_client_spec + "\n");

    // Make the repository.
    this.p4_port = 17385;
    var cmd = "p4d -r " + this.repositoryPath + " -p " + this.p4_port;
    this.p4d_process = this.runSvc.RunAndNotify(cmd, this.repositoryPath,
                                                null, null);
    // Give the process some time to startup.
    try {
        this.p4d_process.wait(2);
    } catch (ex) {
        // Ignore the timeout exception.
    }

    // Create a p4 config file.
    this._createFile(tmpDirPath + this.osSvc.sep + ".p4config",
                     "P4CLIENT=" + this.p4_client + "\n" +
                     "P4PORT=localhost:" + this.p4_port + "\n" +
                     "P4HOST=localhost\n");

    var prefList = [];
    if (this.prefs.hasStringPref("userEnvironmentStartupOverride")) {
        this.original_env_override = this.prefs.getStringPref("userEnvironmentStartupOverride");
        prefList = this.original_env_override.split("\n");
    } else {
        this.original_env_override = null;
    }
    var found_p4config_env = false;
    var sp;
    for (var i=0; i < prefList.length; i++) {
        sp = prefList[i].split("=");
        if (sp[0].toUpperCase() == "P4CONFIG") {
            found_p4config_env = true;
            prefList[i] = sp[0] + "=.p4config";
        }
    }
    if (!found_p4config_env) {
        prefList.push("P4CONFIG=.p4config");
    }
    this.prefs.setStringPref("userEnvironmentStartupOverride",
                             prefList.join("\n"));

    // Write out the p4 client spec.
    var p4_client_spec_file = tmpDirPath + this.osSvc.sep + "p4client.txt";
    this._createFile(p4_client_spec_file, this.p4_client_spec);

    // Make the p4 client.
    var cmd = "p4 client -i < " + p4_client_spec_file;
    var stdoutObj = new Object();
    var stderrObj = new Object();
    var retval = this.runSvc.RunAndCaptureOutput(cmd, this.workspacePath,
                                                 null, this.p4_client_spec,
                                                 stdoutObj, stderrObj);
    if (retval != 0) {
        throw new Error(stderrObj.value);
    }
}

test_scc_p4.prototype.tearDown = function() {
    //dump("Tearing down\n");
    if (this.original_env_override) {
        this.prefs.setStringPref("userEnvironmentStartupOverride",
                                 this.original_env_override);
    } else {
        this.prefs.deletePref("userEnvironmentStartupOverride");
    }
    if (this.p4d_process) {
        //dump("Halting the p4d process\n");
        // Give the process some time to finish the commands.
        try {
            this.p4d_process.wait(3);
        } catch (ex) {
            this.p4d_process.kill(1);
        }
    }
}


/* TEST SUITE */

// we do not pass an instance of MyTestCase, they are created in MakeSuite
var suite = new Casper.UnitTest.TestSuite("SCC p4");
suite.add(new test_scc_p4());
Casper.UnitTest.testRunner.add(suite);

} catch(e) {
    var CasperLog = Casper.Logging.getLogger("Casper::global");
    CasperLog.exception(e);
}
