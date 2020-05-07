var fp = null;
var nsIFilePicker = Components.interfaces.nsIFilePicker;

function setFilters(fp, filter)
{
  switch(filter) {
  case "javascript":
    fp.appendFilter("JavaScript files", "*.js");
    break;
  case "xul":
    fp.appendFilters(nsIFilePicker.filterXUL);
    break;
  case "xml":
    fp.appendFilters(nsIFilePicker.filterXML);
    break;
  case "html":
    fp.appendFilters(nsIFilePicker.filterHTML);
    break;
  }
  fp.appendFilters(nsIFilePicker.filterAll);
}

function initFP(filter)
{
  fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  setFilters(fp, filter);
}

function readEntireFile(file)
{
  var data = '';
  var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"]
    .createInstance(Components.interfaces.nsIFileInputStream);
  fstream.init(file, -1, 0, 0);
  var charset = "UTF-8"; // sux
  const replacementChar = Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER;
  var is = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
    .createInstance(Components.interfaces.nsIConverterInputStream);
  is.init(fstream, charset, 1024, replacementChar);
  var str = {};
  while (is.readString(4096, str) != 0) {
    data += str.value;
  }
  is.close();

  return data;
}

function writeFile(file, text)
{
  var ostream = Components.classes["@mozilla.org/network/file-output-stream;1"]
      .createInstance(Components.interfaces.nsIFileOutputStream);
  ostream.init(file, 0x02 | 0x08 | 0x20, 0664, 0);
  var charset = "UTF-8"; // sux

  var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
    .createInstance(Components.interfaces.nsIConverterOutputStream);

  os.init(ostream, charset, 4096, 0x0000);

  os.writeString(text);
  os.close();
}

function loadFileToTextbox(win, textbox, filter)
{
  if(!fp)
    initFP(filter);
  fp.init(win, "Select a File", nsIFilePicker.modeOpen);
  var res = fp.show();
  if(res == nsIFilePicker.returnOK) {
    textbox.value = readEntireFile(fp.file);
  }
}

function saveFileFromTextbox(win, textbox, filter)
{
  if(!fp)
    initFP(filter);
  fp.init(win, "Save As", nsIFilePicker.modeSave);
  var res = fp.show();
  if(res == nsIFilePicker.returnOK || res == nsIFilePicker.returnReplace) {
    writeFile(fp.file, textbox.value);
  }
}

function loadFileFromPrefToTextbox(aPrefName, textbox) {
  var mPrefs = Components.classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefBranch);
  var file = mPrefs.getComplexValue(aPrefName, Components.interfaces.nsILocalFile);
  textbox.value = readEntireFile(file);
}

function browseForPrefFile(win, prefbutton, filter)
{
  if(!fp)
    initFP(filter);
  else
    setFilters(fp, filter);
  var pref = win.document.getElementById(prefbutton.getAttribute('preference'));
  if(pref.value)
    fp.displayDirectory = pref.value.parent;
  fp.init(win, "Select File", nsIFilePicker.modeOpen);
  var res = fp.show();
  if(res == nsIFilePicker.returnOK) {
    if(fp.file instanceof Components.interfaces.nsILocalFile) {
      pref.value = fp.file;
    }
  }
}
