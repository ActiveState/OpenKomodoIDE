var chosenFile = null;
var windowList = [];

function findFile()
{
  var nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  fp.init(window, "Choose Javascript File", nsIFilePicker.modeOpen);
  if(fp.show() == nsIFilePicker.returnOK) {
    chosenFile = fp.file;
    document.getElementById("filename").value = chosenFile.path;
  }
}

function refreshWindows()
{
  var wl = document.getElementById("window-list");
  wl.selectedIndex = -1;
  wl.removeAllItems();
  windowList = [];
  var i = 0;
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
  en = wm.getEnumerator("");
  while(en.hasMoreElements()) {
    var w = en.getNext();
    wl.insertItemAt(i, w.location.href);
    windowList[i] = w;
    i++;
  }

  wl.selectedIndex = 0;
}

function doExecute()
{
  if(chosenFile) {
    var sl = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].createInstance(Components.interfaces.mozIJSSubScriptLoader);
    var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
    var fileURI = ios.newFileURI(chosenFile);
    var chosenWindow = windowList[document.getElementById("window-list").selectedIndex];
    sl.loadSubScript(fileURI.spec, chosenWindow);
  }
}

function onLoad()
{
  refreshWindows();
}
