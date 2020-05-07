try {
//dump("Loading test_bug44719.js...\n");

// XXX bug doesn't happen when we dont drag/drop

// example of setting up a class based test case
function test_keybindings_bug44719() {
  // The name supplied must be the same as the class name!!
  Casper.UnitTest.TestCaseSerialClassAsync.apply(this, ["test_keybindings_bug44719"]);
}
test_keybindings_bug44719.prototype = new Casper.UnitTest.TestCaseSerialClassAsync();
test_keybindings_bug44719.prototype.constructor = test_keybindings_bug44719;

test_keybindings_bug44719.prototype.setup = function() {
  this.folderName = 'bug 44719 test folder';
  var folders = ko.toolbox2.getToolsByTypeAndName('folder', this.folderName);
  this.assertEqual(0, folders.length, 'keybinding test folder already exists');

  var folder = ko.toolbox2.manager.toolsMgr.createToolFromType('folder');
  folder.setStringAttribute('name', this.folderName);
  ko.toolbox2.addItem(folder);
  
  folders = ko.toolbox2.getToolsByTypeAndName('folder', this.folderName);
  this.assertNotEqual(folders.length, 'could not retrieve folder');
  folder = folders[0];
  var index = ko.toolbox2.manager.view.getIndexByTool(folder);
  //dump("folder index is "+index+"\n");
  
  this.snippetName = 'bug 44719 test snippet';
  var items = ko.toolbox2.getToolsByTypeAndName('snippet', this.snippetName);
  this.assertEqual(0, items.length, 'keybinding test snippet already exists');

  var snippet = ko.projects.addSnippetFromText(this.snippetName, folder);
  this.assertEqual(ko.toolbox2.getToolsByTypeAndName('snippet', this.snippetName)[0],
                   snippet,
                   "Could not create test snippet");

  this.snippetExecuted = false;
}

test_keybindings_bug44719.prototype.tearDown = function() {
    var items = ko.toolbox2.getToolsByTypeAndName('folder', this.folderName);
    items.map(ko.toolbox2.removeItem);
    items = ko.toolbox2.getToolsByTypeAndName('snippet', this.snippetName);
    items.map(ko.toolbox2.removeItem);
}

test_keybindings_bug44719.prototype.test_toggleFolderOpen = function() {
  var folder = ko.toolbox2.getToolsByTypeAndName('folder', this.folderName)[0];
  var index = ko.toolbox2.manager.view.getIndexByTool(folder);
  ko.toolbox2.manager.view.toggleOpenState(index);
  this.assertTrue(ko.toolbox2.manager.view.isContainerOpen(index),
                  "Folder did not open");
}

test_keybindings_bug44719.prototype.test_addKeyBinding = function() {
    var item = ko.toolbox2.getToolsByTypeAndName('snippet', this.snippetName)[0];
    this.assertNotNull(item , 'could not find snippet!');
    var cmd = "cmd_callPart";
    var keylabel = "Ctrl+K, B";
    var commandParam = item.id;
    
    var seqList = ko.keybindings.manager.command2keysequences(cmd, commandParam);
    this.assertTrue(seqList.length == 0,"command already has binding!");

    var keysequence = keylabel2keysequence(keylabel);
    seqList = ko.keybindings.manager.command2keysequences(cmd)
    this.assertFalse(seqList.indexOf(keylabel) >= 0, "test key sequence already exists");
    
    ko.keybindings.manager.assignKey(cmd, keysequence, commandParam);
    seqList = ko.keybindings.manager.command2keysequences(cmd, commandParam)
    this.assertTrue(seqList.indexOf(keylabel) >= 0, "assignKey failed");
    
    ko.keybindings.manager.makeKeyActive(cmd, keysequence);
    ko.keybindings.manager.stashIn(item, keylabel);
    this.assertEqual(item.getStringAttribute('keyboard_shortcut'), keylabel, "keylabel was not stashed in part");
}

test_keybindings_bug44719.prototype.test_movesnippetOutOfFolder = function() {
    // this tests whether a binding is reapplied when an item is out of a folder
    // move the snippet into a folder
    var cmd = "cmd_callPart";
    var keylabel = "Ctrl+K, B";
    var snippet = ko.toolbox2.getToolsByTypeAndName('snippet', this.snippetName)[0];
    this.assertNotNull(snippet , 'could not find snippet!');
    var commandParam = snippet.id;

    // assert the keybinding exists
    var seqList = ko.keybindings.manager.command2keysequences(cmd, commandParam);
    this.assertFalse(seqList.length == 0,"item does not have a binding!");
}

test_keybindings_bug44719.prototype.test_movesnippetIntoFolder = function() {
    // this tests whether a binding is reapplied when an item is moved into a folder
    // move the snippet into a folder
    var cmd = "cmd_callPart";
    var keylabel = "Ctrl+K, B";
    var snippet = ko.toolbox2.getToolsByTypeAndName('snippet', this.snippetName)[0];
    this.assertNotNull(snippet , 'could not find snippet!');
    var commandParam = snippet.id;
    var folder = ko.toolbox2.getToolsByTypeAndName('folder', this.folderName)[0];
    this.assertNotNull(folder , 'could not find folder!');
    var index = ko.toolbox2.manager.view.getIndexByTool(folder);
    //ko.toolbox2.manager.view.toggleOpenState(index);

    // assert the keybinding exists
    var seqList = ko.keybindings.manager.command2keysequences(cmd, commandParam);
    this.assertFalse(seqList.length == 0,"item does not have a binding!");
}

test_keybindings_bug44719.prototype.test_removeChildBindings = function() {
    // this tests whether keybindings of children are recursivly removed when
    // we remove a folder that has children with bindings
    
    var snippet = ko.toolbox2.getToolsByTypeAndName('snippet', this.snippetName)[0];
    this.assertNotNull(snippet , 'could not find snippet!');
    var commandParam = snippet.id;
    // we remove the folder, the child bindings should also be removed
    var folder = ko.toolbox2.getToolsByTypeAndName('folder', this.folderName)[0];
    this.assertNotNull(folder , 'could not find folder!');

    var cmd = "cmd_callPart";
    var keylabel = "Ctrl+K, B";
    ko.toolbox2.removeItem(folder);
    // assert the snippet is removed from the toolbox
    var items = ko.toolbox2.getToolsByTypeAndName('snippet', this.snippetName);
    this.assertEqual(0, items.length, "snippet did not get deleted with folder");
    // assert our binding no longer exists
    seqList = ko.keybindings.manager.command2keysequences(cmd)
    this.assertFalse(seqList.indexOf(keylabel) >= 0, "item bindings did not get removed");

    // assert our binding no longer exists
    var seqList = ko.keybindings.manager.command2keysequences(cmd, commandParam);
    this.assertTrue(seqList.length == 0,"the binding still exists after removing the snippet!");
}

// we do not pass an instance of MyTestCase, they are created in MakeSuite
var kbBug44719 = new test_keybindings_bug44719();
var suite = new Casper.UnitTest.TestSuite("Bug 44719");
suite.add(kbBug44719);
Casper.UnitTest.testRunner.add(suite);

} catch(e) {
    var CasperLog = Casper.Logging.getLogger("Casper::global");
    CasperLog.exception(e);
}
