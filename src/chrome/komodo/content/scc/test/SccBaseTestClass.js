/* Copyright (c) 2007 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

try {
dump("Loading SccBaseClass.js...\n");
var log = Casper.Logging.getLogger("Casper::SccBaseClass");
//log.setLevel(Casper.Logging.DEBUG);

// setup the test case
function SccBaseClass(name) {
    // The name supplied must be the same as the class name!!
    Casper.UnitTest.TestCaseSerialClassAsync.apply(this, ["test_scc_" + name]);
    this.sccName = name;

    // Get the scc service implementation.
    var cid = "@activestate.com/koSCC?type=" + name + ";1";
    this.sccSvc = Components.classes[cid].getService(Components.interfaces.koISCC);

    // Working variables.
    /**
     * @type Components.interfaces.koIFileEx
     */
    this.koFile = null;
    this.sccTestsPassed = {};

    /**
     * Tricky testing this on multiple platforms as you cannot guarentee that
     * the process executables will exist.
     */
    var prefsSvc = Components.classes["@activestate.com/koPrefService;1"].
                            getService(Components.interfaces.koIPrefService);
    this.prefs = prefsSvc.prefs;
    this.koDirs = Components.classes["@activestate.com/koDirs;1"].
                        getService(Components.interfaces.koIDirs);
    this.fileProtocolSvc = Components.classes["@mozilla.org/network/protocol;1?name=file"].
                        getService(Components.interfaces.nsIFileProtocolHandler);
    this.osSvc = Components.classes["@activestate.com/koOs;1"].
                        getService(Components.interfaces.koIOs);
    this.fileSvc = Components.classes["@activestate.com/koFileService;1"].
                        getService(Components.interfaces.koIFileService);
    this.runSvc = Components.classes["@activestate.com/koRunService;1"].
                        getService(Components.interfaces.koIRunService);
    this.obsSvc = Components.classes["@mozilla.org/observer-service;1"].
                        getService(Components.interfaces.nsIObserverService);

    // Test file contents.
    this.smallFileContents = "This is the first line.\n" +
                             "This is the second line.\n" +
                             "This is the third line.\n";
    this.smallFileContents_rev2 = "This is the first line.\n" +
                                  "This is the second line.\n" +
                                  "This is the third line.\n" +
                                  "This is the fourth line.\n";

}
SccBaseClass.prototype = new Casper.UnitTest.TestCaseSerialClassAsync();
SccBaseClass.prototype.constructor = SccBaseClass;

SccBaseClass.prototype.setup = function() {
}
SccBaseClass.prototype.tearDown = function() {
}

/* Utility functions */

    /**
     * Used to check settings of testcase with result
     */
    SccBaseClass.prototype._passedTest = function(cmd, tags) {
        // Check if it's a knownfailure
        if (tags && tags.some(function(x) { return x == "knownfailure"; })) {
            log.warn(this.currentTest.name + " passed but is marked as a knownfailure!");
        }
    }
    
    /**
     * Log knownfailure
     */
    SccBaseClass.prototype.logKnownFailure = function(cmd, ex) {
        log.info("knownfailure: " + ex.message);
    }

    SccBaseClass.prototype._createFile = function(filePath, contents) {
        var koFile = Components.classes["@activestate.com/koFileEx;1"].
                        createInstance(Components.interfaces.koIFileEx);
        koFile.URI = ko.uriparse.localPathToURI(filePath);
        koFile.open("w")
        koFile.puts(contents);
        koFile.close();
        return koFile;
    }
    
    SccBaseClass.prototype._createTempWorkspaceFile = function(dirPath, contents) {
        var koFile = this.fileSvc.makeTempFileInDir(dirPath,
                                                    ".txt" /* suffix */,
                                                    "w"    /* mode   */);
        koFile.puts(contents);
        koFile.close();
        return koFile;
    }

    SccBaseClass.prototype._updateFileContents = function(koFile, contents) {
        koFile.open("w");
        koFile.puts(contents);
        koFile.close();
    }

    SccBaseClass.prototype._addAndCommitKoIFile = function(koFile) {
        var cmd = "svn add " + koFile.URI;
        var retval = this.runSvc.RunAndCaptureOutput(cmd, this.workspacePath,
                                                     null, null,
                                                     stdoutObj, stderrObj);
        if (retval != 0) {
            throw new Error(stderrObj.value);
        }
        cmd = "svn commit -m 'Adding file' " + koFile.URI;
        var retval = this.runSvc.RunAndCaptureOutput(cmd, this.workspacePath,
                                                     null, null,
                                                     stdoutObj, stderrObj);
        if (retval != 0) {
            throw new Error(stderrObj.value);
        }
    }
    
    SccBaseClass.prototype.callback = function(retval, data) {
        try {
            this.sccTestsPassed[this.sccTestFeatureName] = false;
            if (this.expected_retval == retval) {
                var invalid_data_msg = null;
                if (this.verify_data_callback) {
                    invalid_data_msg = this.verify_data_callback(data);
                }
                if (invalid_data_msg) {
                    var msg = "data validation failed: " + invalid_data_msg;
                    this.currentTest.result.fails(msg);
                    this.result.fails(msg);
                } else {
                    this.sccTestsPassed[this.sccTestFeatureName] = true;
                    this.currentTest.result.passes();
                }
            } else {
                var msg = "expected retval: " + this.expected_retval +
                          ", but got: " + retval;
                if (retval == Components.interfaces.koIAsyncCallback.RESULT_ERROR) {
                    msg += ". Exc: " + data;
                }
                this.currentTest.result.fails(msg);
                this.result.fails(msg);
            }
        } catch(ex if ex instanceof Casper.UnitTest.AssertException) {
            //this.result.fails(ex.message, ex);
            this.currentTest.result.fails(ex.message, ex);
            this.result.fails(ex.message);
        } catch(ex) {
            //this.result.breaks(ex);
            this.currentTest.result.breaks(ex);
            this.result.breaks(ex);
        } finally {
          this.runNext();
        }
    }


/* Child test cases */

SccBaseClass.prototype.test_checkout = function() {
    // We don't do checkouts yet...
}

SccBaseClass.prototype.testAsync_add = function() {
    this.sccTestFeatureName = "add";
    this.assertNull(this.koFile, "koFile should not be defined yet.");
    var koFile = this._createTempWorkspaceFile(this.workspacePath,
                                               this.smallFileContents);
    var self = this;
    this.expected_retval = Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL;
    this.verify_data_callback = null;
    this.sccSvc.add(1, [koFile.URI], '', '', self);
    this.koFile = koFile;
}

SccBaseClass.prototype.testAsync_commit = function() {
    this.sccTestFeatureName = "commit";
    this.assertNotNull(this.sccTestsPassed["add"], "Requires add to have worked.");
    var self = this;
    this.expected_retval = Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL;
    this.verify_data_callback = null;
    this.sccSvc.commit(1, [this.koFile.URI], 'Added file', '', self);
}

SccBaseClass.prototype.testAsync_update = function() {
    this.sccTestFeatureName = "update";
    this.assertNotNull(this.sccTestsPassed["add"], "Requires add to have worked.");
    this.assertNotNull(this.sccTestsPassed["commit"], "Requires commit to have worked.");
    var self = this;
    this.expected_retval = Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL;
    this.verify_data_callback = null;
    this.sccSvc.update(1, [this.workspacePath], '', self);
}

SccBaseClass.prototype.testAsync_edit = function() {
    this.sccTestFeatureName = "edit";
    this.assertNotNull(this.sccTestsPassed["add"], "Requires add to have worked.");
    this.assertNotNull(this.sccTestsPassed["commit"], "Requires commit to have worked.");
    var self = this;
    this.expected_retval = Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL;
    this.verify_data_callback = null;
    if (this.sccSvc.getValue("supportsCommand", "") == "Yes") {
        this.sccSvc.edit(1, [this.koFile.URI], self);
    } else {
        this.callback(this.expected_retval, null);
    }
}

SccBaseClass.prototype.testAsync_diff = function() {
    this.sccTestFeatureName = "diff";
    this.assertNotNull(this.sccTestsPassed["add"], "Requires add to have worked.");
    this.assertNotNull(this.sccTestsPassed["commit"], "Requires commit to have worked.");
    this.assertNotNull(this.sccTestsPassed["edit"], "Requires edit to have worked.");
    this._updateFileContents(this.koFile, this.smallFileContents_rev2);
    var self = this;
    this.expected_retval = Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL;
    this.verify_data_callback = function(data) {
        if (typeof(data) != 'string') {
            return "Diff result is not a string '" + typeof(data) + "'";
        }
        if (data.length == 0) {
            return "No diff results were returned!"
        }
        return null;
    }
    this.sccSvc.diff(1, [this.koFile.URI], '', '', self);
}

SccBaseClass.prototype.testAsync_diffRelative = function() {
    this.sccTestFeatureName = "diffRelative";
    this.assertNotNull(this.sccTestsPassed["add"], "Requires add to have worked.");
    this.assertNotNull(this.sccTestsPassed["commit"], "Requires commit to have worked.");
    this.assertNotNull(this.sccTestsPassed["edit"], "Requires edit to have worked.");
    this._updateFileContents(this.koFile, this.smallFileContents_rev2);
    var self = this;
    this.expected_retval = Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL;
    this.verify_data_callback = function(data) {
        if (typeof(data) != 'string') {
            return "Diff result is not a string '" + typeof(data) + "'";
        }
        if (data.length == 0) {
            return "No diff results were returned!"
        }
        return null;
    }
    this.sccSvc.diffRelative(this.koFile.dirName, 1, [this.koFile.leafName], '', '', self);
}

SccBaseClass.prototype.testAsync_diffFolder = function() {
    this.sccTestFeatureName = "diffFolder";
    this.assertNotNull(this.sccTestsPassed["add"], "Requires add to have worked.");
    this.assertNotNull(this.sccTestsPassed["commit"], "Requires commit to have worked.");
    this.assertNotNull(this.sccTestsPassed["edit"], "Requires edit to have worked.");
    this._updateFileContents(this.koFile, this.smallFileContents_rev2);
    var self = this;
    this.expected_retval = Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL;
    this.verify_data_callback = function(data) {
        if (typeof(data) != 'string') {
            return "Diff result is not a string '" + typeof(data) + "'";
        }
        if (data.length == 0) {
            return "No diff results were returned!"
        }
        return null;
    }
    this.sccSvc.diff(1, [ko.uriparse.dirName(this.koFile.URI)], '', '', self);
}

SccBaseClass.prototype.testAsync_status = function() {
    this.sccTestFeatureName = "status";
    this.assertNotNull(this.sccTestsPassed["add"], "Requires add to have worked.");
    this.assertNotNull(this.sccTestsPassed["commit"], "Requires commit to have worked.");
    this.assertNotNull(this.sccTestsPassed["edit"], "Requires edit to have worked.");
    this._updateFileContents(this.koFile, this.smallFileContents_rev2);
    var self = this;
    this.expected_retval = Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL;
    var uriSpec = this.koFile.URI;
    var reMatch = uriSpec.match("^(.*)/(.*?)$");
    var relativePath = reMatch[2];
    var dirUri = reMatch[1];
    this.verify_data_callback = function(data) {
        this.assertNotNull(data);
        this.assertTrue(data.length == 1);
        this.assertTrue(data[0].status == Components.interfaces.koISCC.STATUS_MODIFIED,
                        "Unexptected scc status, '" + data[0].status +
                        "' != '" +
                        Components.interfaces.koISCC.STATUS_MODIFIED + "'");
        this.assertTrue(data[0].relativePath == relativePath,
                        "Unexptected filename, '" + data[0].relativePath +
                        "' != '" + relativePath + "'");
        this.assertTrue(data[0].uriSpec == uriSpec,
                        "Unexptected filename, '" + data[0].uriSpec +
                        "' != '" + uriSpec + "'");
    }
    var recursive = false;
    var options = '';
    this.sccSvc.status(1, [dirUri], recursive, options, self);
}

SccBaseClass.prototype.testAsync_status_with_unknown_file = function() {
    this.sccTestFeatureName = "status_with_unknown_file";
    this.assertNotNull(this.sccTestsPassed["status"], "Requires status to have worked.");
    var koFile = this._createTempWorkspaceFile(this.workspacePath,
                                               this.smallFileContents);
    var self = this;
    this.expected_retval = Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL;
    var uriSpec = this.koFile.URI;
    var reMatch = uriSpec.match("^(.*)/(.*?)$");
    var relativePath = reMatch[2];
    var dirUri = reMatch[1];
    this.verify_data_callback = function(data) {
        this.assertNotNull(data);
        // Bzr returns additional entries for unknowns.
        if (this.sccName == 'bzr') {
            this.assertEqual(data.length, 2,
                             "Incorrect # responses. Expected 2, got " + data.length);
        } else {
            this.assertEqual(data.length, 1,
                             "Incorrect # responses. Expected 1, got " + data.length);
        }
        this.assertTrue(data[0].status == Components.interfaces.koISCC.STATUS_MODIFIED,
                        "Unexptected scc status, '" + data[0].status +
                        "' != '" +
                        Components.interfaces.koISCC.STATUS_MODIFIED + "'");
        this.assertTrue(data[0].relativePath == relativePath,
                        "Unexptected filename, '" + data[0].relativePath +
                        "' != '" + relativePath + "'");
        this.assertTrue(data[0].uriSpec == uriSpec,
                        "Unexptected filename, '" + data[0].uriSpec +
                        "' != '" + uriSpec + "'");
    }
    var recursive = false;
    var options = '';
    this.sccSvc.status(1, [dirUri], recursive, options, self);
}

SccBaseClass.prototype.testAsync_history_commit = function() {
    this.sccTestFeatureName = "history_commit";
    this.assertNotNull(this.sccTestsPassed["add"], "Requires add to have worked.");
    this.assertNotNull(this.sccTestsPassed["commit"], "Requires commit to have worked.");
    this.assertNotNull(this.sccTestsPassed["edit"], "Requires edit to have worked.");
    var self = this;
    this.expected_retval = Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL;
    this.verify_data_callback = null;
    this.sccSvc.commit(1, [this.koFile.URI], 'Modified file', '', self);
}

SccBaseClass.prototype.testAsync_history = function() {
    this.sccTestFeatureName = "history";
    this.assertNotNull(this.sccTestsPassed["add"], "Requires add to have worked.");
    this.assertNotNull(this.sccTestsPassed["commit"], "Requires commit to have worked.");
    this.assertNotNull(this.sccTestsPassed["history_commit"], "Requires history commit to have worked.");
    var self = this;
    this.expected_retval = Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL;
    this.verify_data_callback = function(data) {
        this.assertNotNull(data);
        this.assertTrue(data.length == 2);
        this._version1 = data[1].version;
        this._version2 = data[0].version;
    }
    this.sccSvc.history(this.koFile.URI, '', -1, self);
}

SccBaseClass.prototype.testAsync_diffRevisions = function() {
    this.sccTestFeatureName = "diffRevisions";
    this.assertNotNull(this.sccTestsPassed["add"], "Requires add to have worked.");
    this.assertNotNull(this.sccTestsPassed["commit"], "Requires commit to have worked.");
    this.assertNotNull(this.sccTestsPassed["history_commit"], "Requires history commit to have worked.");
    this.assertNotNull(this.sccTestsPassed["history"], "Requires history to have worked.");
    var self = this;
    this.expected_retval = Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL;
    this.verify_data_callback = null;
    var version1 = this._version1;
    var version2 = this._version2;
    this.verify_data_callback = function(data) {
        if (typeof(data) != 'string') {
            return "Diff result is not a string '" + typeof(data) + "'";
        }
        if (data.length == 0) {
            return "No diff results were returned!"
        }
        return null;
    }
    this.sccSvc.diffRevisions(this.koFile.URI, version1,
                              this.koFile.URI, version2,
                              this.koFile.URI, '', '', self);
}

SccBaseClass.prototype.testAsync_revert = function() {
    this.sccTestFeatureName = "revert";
    this.assertNotNull(this.sccTestsPassed["add"], "Requires add to have worked.");
    var self = this;
    this.expected_retval = Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL;
    this.verify_data_callback = null;
    this.sccSvc.revert(1, [this.koFile.URI], '', self);
}

SccBaseClass.prototype.testAsync_remove = function() {
    this.sccTestFeatureName = "remove";
    this.assertNotNull(this.sccTestsPassed["add"], "Requires add to have worked.");
    this.assertNotNull(this.sccTestsPassed["commit"], "Requires commit to have worked.");
    var self = this;
    this.expected_retval = Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL;
    this.verify_data_callback = null;
    this.sccSvc.remove(1, [this.koFile.URI], false, false, self);
}

SccBaseClass.prototype.testAsync_add_file_in_new_dir = function() {
    this.sccTestFeatureName = "add_file_in_new_dir";
    this.assertNotNull(this.sccTestsPassed["add"], "Requires add to have worked.");
    var dirpath = this.workspacePath + this.osSvc.sep + "newdir";
    this.osSvc.mkdir(dirpath);
    var koDir = this.fileSvc.getFileFromURI(ko.uriparse.pathToURI(dirpath));
    var koFile = this._createTempWorkspaceFile(dirpath,
                                               this.smallFileContents);
    var self = this;
    this.expected_retval = Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL;
    this.verify_data_callback = null;
    var cb = {
        'callback': function(retval, data) {
            if (retval != self.expected_retval) {
                self.callback(retval, data);
            } else {
                self.sccSvc.add(1, [koFile.URI], '', '', self);
            }
        }
    }
    this.sccSvc.add(1, [koDir.URI], '', '', cb);
}

} catch(e) {
    var CasperLog = Casper.Logging.getLogger("Casper::global");
    CasperLog.exception(e);
}
