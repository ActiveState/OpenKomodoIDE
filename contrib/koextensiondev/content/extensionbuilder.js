//constants etc.
// Files that can be in the XPI
var optionalXPIFiles = ["chrome", "install.rdf", "install.js", "chrome.manifest", "components", "defaults"];
// The filename to save extension-specific data to
const EXTENSIONBUILDER_DATA = "extensiondev-data.rdf";
var ED_ID = "{75739dec-72db-4020-aa9a-6afa6744759b}";

// global variables
var currentWorkingDirectory = null;
var gZipUtil = null;

/*
 * Set the statusbar text
 */
function setStatus(s)
{
  var st = document.getElementById("status");
  st.label = s;
}

/*
 * Open a "browse for folder" dialog to locate an extension directory
 * Add the the selected directory to the dropdown list and set it as
 * the current working directory.
 */
function browseForExtension()
{
  var nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  fp.init(window, "Choose Extension Directory", nsIFilePicker.modeGetFolder);
  if(fp.show() == nsIFilePicker.returnOK) {
    var wd = document.getElementById("workingdir");
    var item = wd.insertItemAt(0,fp.file.path);
    wd.selectedItem = item;
    dirSelectionChanged();
  }
}

/*
 * Get the current working directory as an nsILocalFile
 */
function getWorkingDirectory()
{
  try {
    var s = document.getElementById("workingdir").selectedItem;
    if(s) {
      var f = fileFromPath(s.getAttribute("label"));
      if(f)
        return f;
    }
  }
  catch(ex) {
    dump(ex);
  }

  return null;
}

/*
 * Reveal the current working directory in the system file browser.
 */
function showWorkingDir()
{
  var f = getWorkingDirectory();
  if(f)
    f.reveal();
}

/*
 * Get the directory this extension is installed in.
 */
function getInstalledDir()
{
  var mf = getInstallManifestFromDir(getWorkingDirectory());
  if(!mf || !mf['id'])
    return null;

  var id = mf['id'];
  if('@mozilla.org/extensions/manager;1' in Components.classes) {
    // Firefox 1.5+ or similar
    var em = Components.classes['@mozilla.org/extensions/manager;1']
                       .getService(Components.interfaces.nsIExtensionManager);
    var il = em.getInstallLocation(id);
    if(il == null)
      return null;

    return il.getItemLocation(id);
  }
  // FF1.0 or something similar
  var directoryService=Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties);
  var profDir = directoryService.get('ProfD', Components.interfaces.nsILocalFile);
  var extDir = profDir.clone();
  extDir.append("extensions");
  if(extDir.exists()) {
    extDir.append(id);
    return extDir;
  }
  // probably SeaMonkey or something
  extDir = profDir.clone();
  extDir.append("chrome");
  return extDir;
}

/*
 * Reveal the installed directory in the system file browser.
 */
function showInstalledDir()
{
  var extDir = getInstalledDir();
  if(extDir && extDir.exists()) {
    try {
      extDir.reveal();
    } catch(ex) { dump('Reveal not supported on this platform\n'); }
  }
}

/*
 * Edit install.rdf from the current working directory in the
 * install.rdf editor window.
 */
function editInstallManifest()
{
  var f = getWorkingDirectory();
  if(f) {
    f.append("install.rdf");
    var w = window.openDialog("chrome://extensiondev/content/install-edit.xul", "installedit", "all=no,dialog=yes,width=450,height=525", f.path);
  }
}

/*
 * Given a directory, make dirname as a subdirectory if it doesn't exist.
 * Return the subdirectory as an nsILocalFile.
 */
function maybeMkDir(indir, dirname)
{
  var subDir = indir.clone();
  subDir.append(dirname);
  if(!subDir.exists()) {
    subDir.create(subDir.DIRECTORY_TYPE, 0755);
  }
  return subDir;
}

/*
 * Return the filename of the first XPI located in dir.
 * Return null if there is no XPI.
 */
function findExistingXPI(dir)
{
  var en = dir.directoryEntries;
  while(en.hasMoreElements()) {
    var f = en.getNext();
    f.QueryInterface(Components.interfaces.nsILocalFile);
    if(f.isFile() && f.leafName.match(/\.xpi$/i))
      return f.leafName;
  }
  return null;
}

/*
 * Get the XPI filename for this extension, either from
 * the textbox or by using the heuristics.  If the latter,
 * set the textbox value to the determined filename.
 */
function getXPIFilename(wd, mf, cm, cb)
{
  var xf = document.getElementById("xpi-filename");
  if(xf.value == "")
    xf.value = determineXPIFilename(wd, mf, cm, cb);

  return xf.value;
}

/*
 * Determine the proper XPI filename for this extension
 * using a few heuristics:
 *
 * 1) If a config_build.sh exists, use APP_NAME from there.
 * 2) If an XPI file exists in the directory, use that filename.
 * 3) If there's a chrome.manifest, use the chrome path from there
 * 4) If there is only one jar file, in the install.rdf,
 *    use that filename with '.jar' replaced by '.xpi'.
 * 5) Otherwise just use the directory name with '.xpi' appended.
 */
function determineXPIFilename(wd, mf, cm, cb)
{
  if(!wd)
    wd = getWorkingDirectory();

  if(!mf)
    mf = getInstallManifestFromDir(wd);

  if(!cm)
    cm = getChromeManifestFromDir(wd);

  if(!cb)
    cb = getConfigBuildFromDir(wd);

  if(cb && ("APP_NAME" in cb))
    return cb["APP_NAME"] + ".xpi";

  // easy, if an xpi file exists then use that name
  xpiFilename = findExistingXPI(wd);
  if(!xpiFilename) {
    // see if we have a chrome.manifest
    if(cm) {
      for(var i=0; i<cm.length; i++) {
        if(cm[i].match(/^(content|locale|skin)\s+/)) {
          var items = cm[i].split(/\s+/);
          xpiFilename = items[1] + '.xpi';
          break;
        }
      }
    }
    // if we only have one jar file, then use that but with .xpi
    else if(mf && mf.files && mf.files.length == 1) {
      xpiFilename = mf.files[0].fileName.replace(/jar$/i, 'xpi');
    }
    else {
      // last resort, just use the name of the working directory .xpi
      xpiFilename = wd.leafName + '.xpi';
    }
  }

  return xpiFilename;  
}

/*
 * Given a directory, read the install.rdf file from that directory
 * into an object and return it.
 */
function getInstallManifestFromDir(wd)
{
  var f = wd.clone();
  f.append("install.rdf");
  var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
  var mffileuri = ios.newFileURI(f);
  return readInstallManifest(mffileuri.spec);
}

/*
 * Given a directory, read the config_build.sh file from that directory
 * into an object and return it.
 */
function getConfigBuildFromDir(wd)
{
  var f = wd.clone();
  f.append("config_build.sh");

  if(f.exists()) {
    var arr = readFileToArray(f);
    var obj = {};
    for(var i=0; i<arr.length; i++) {
      if(arr[i].match(/^\s*#/))
        continue;
      var l = arr[i].split(/=/);
      var val = l[1];
      if(!val)
        continue;
      val = val.replace(/\"/g, '');
      obj[l[0]] = val.split(/\s+/);
    }
    return obj;
  }

  return null;
}

/*
 * Given a directory, read the chrome.manifest file from that directory
 * into an array and return it.
 */
function getChromeManifestFromDir(wd)
{
  var f = wd.clone();
  f.append("chrome.manifest");
  if(f.exists())
    return readFileToArray(f);

  return null;
}

/*
 * Given an install manifest object mf, and/or a chrome.manifest
 * object cm, get a list of jar files and chrome 
 * provider directories.  If copyCMTo is an nsIFile, then
 * copy the chrome.manifest to it with fixup.
 */
function getJarFilesAndChromeDirs(mf, cm, jarfiles, jardirs, copyCMTo)
{
  if(!mf && !cm)
    return [];

  // check chrome.manifest first
  if(cm) {
    dump('checking chrome.manifest for jars/providers\n');
    // collect jar file references from chrome.manifest
    // also copy it to buildDir, with fixup if needed
    var ostream;
    if(copyCMTo) {
      ostream = Components.classes["@mozilla.org/network/file-output-stream;1"]
        .createInstance(Components.interfaces.nsIFileOutputStream);
      // write, create, truncate
      ostream.init(copyCMTo, 0x02 | 0x08 | 0x20, 0664, 0);
    }
    for(var i=0; i<cm.length; i++) {
      if(cm[i].match(/^(content|locale|skin)\s+/)) {
        var items = cm[i].split(/\s+/);
        var dir;
        if(items[0] == 'content')
          dir = items[2];
        else
          dir = items[3];

        //TODO: handle intentional flat chrome with file:?
        if(dir.match(/^jar:/)) {
          // grab jar file name and provider
          // we just want the jar file name
          var sl = dir.indexOf("/", 4);
          var pt = dir.indexOf("!");
          sl = (sl < 0 || sl > pt) ? 4 : sl + 1;
          var jarFile = dir.substring(sl, pt);
          var provider = dir.substring(pt + 1);
          provider = provider.replace(/^\//, '');
          provider = provider.replace(/\/.*/, '');
          if(!inArray(jarFile, jarfiles))
            jarfiles.push(jarFile);
          if(jarFile in jardirs) {
            if(!inArray(provider, jardirs[jarFile]))
              jardirs[jarFile].push(provider);
          }
          else
            jardirs[jarFile] = [provider];

          // write to output file unchanged
          if(ostream) {
            var data = cm[i] + "\n";
            ostream.write(data, data.length);
          }
        }
        else {
          // fixup line, make jar file name
          var jarFile = items[1] + '.jar';
          var provider = dir;
          provider = provider.replace(/^\//, '');
          provider = provider.replace(/\/.*/, '');

          if(dir[0] != '/')
            dir = '/' + dir;
          var fixedprovider = 'jar:chrome/' + jarFile + '!' + dir;
          if(!inArray(jarFile, jarfiles))
            jarfiles.push(jarFile);
          if(jarFile in jardirs) {
            if(!inArray(provider, jardirs[jarFile]))
              jardirs[jarFile].push(provider);
          }
          else
            jardirs[jarFile] = [provider];

          if(ostream) {
            if(items[0] == 'content')
              items[2] = fixedprovider;
            else
              items[3] = fixedprovider;

            // write out changed version
            var data = items.join(' ') + "\n";
            ostream.write(data, data.length);
          }
        }
      }
      else {
        if(ostream) {
          // not a chrome provider, just echo it
          var data = cm[i] + "\n";
          ostream.write(data, data.length);
        }
      }
    }
    if(ostream)
      ostream.close();
  }
  // otherwise use install.rdf
  else if(mf && mf.files) {
    var providers = ["package", "locale", "skin"];
    for(var i=0; i<mf.files.length; i++) {
      // save jar file, make entry in chromeDirs
      jarfiles.push(mf.files[i]);
      jardirs[mf.files[i]] = [];

      for(var j=0; j<providers.length; j++) {
        if(mf.files[i][providers[j]]) {
          for(var k=0; k<mf.files[i][providers[j]].length; k++) {
            // we just want the top level directory
            var provider = mf.files[i][providers[j]][k].split('/')[0];
            if(!inArray(provider, jardirs[mf.files[i]]))
              jardirs[mf.files[i]].push(provider);
          }
        }
      }
    }
  }
}

/*
 * Build the XPI in the current working directory.
 * This will package all required jar files first, then
 * package the XPI.
 */
function buildPackage()
{
  // determine what to package (read install.rdf etc)
  var wd = getWorkingDirectory();
  var buildDir = maybeMkDir(wd, "build");
  var chromeDir;
  var cm = getChromeManifestFromDir(wd);
  var mf = getInstallManifestFromDir(wd);
  var jarfiles = [];
  var jardirs = {};

  if(!mf && !cm)
    return;

  // copy optional xpi files to temp dir
  var xpifiles = [];
  // extra files user has selected
  var ef = document.getElementById("extra-files").childNodes;
  for(i=0; i<ef.length; i++) {
    if(ef[i].checked)
      xpifiles.push(ef[i].value);
  }
  xpifiles = xpifiles.concat(optionalXPIFiles);
  for(var i=0; i<xpifiles.length; i++) {
    var xd = wd.clone();
    xd.append(xpifiles[i]);
    if(xd.exists()) {
      xd.copyTo(buildDir, '');
    }
  }
  // now get or create chrome dir
  chromeDir = maybeMkDir(buildDir, "chrome");

  var newCM;
  if(cm) {
    // destination to copy chrome.manifest to
    newCM = buildDir.clone();
    newCM.append("chrome.manifest");
  }
  getJarFilesAndChromeDirs(mf, cm, jarfiles, jardirs, newCM);

  // create each jarFile with no compression
  for(var i=0; i<jarfiles.length; i++) {
    var jf = chromeDir.clone();
    jf.append(jarfiles[i]);
    if(!createZip(wd.path, jf.path, jardirs[jarfiles[i]], false)) {
      setStatus("Error creating " + jarfiles[i]);
      return;
    }
  }
  
  // zip up the xpi
  var xpiFilename, xpiFile;
  xpiFilename = getXPIFilename(wd, mf, cm);
  xpiFile = wd.clone();
  xpiFile.append(xpiFilename);

  // we grab everything out of the temp build dir and put it in the xpi
  xpifiles = [];
  var it = buildDir.directoryEntries;
  while(it.hasMoreElements()) {
    var f = it.getNext();
    if(f instanceof Components.interfaces.nsILocalFile) {
      xpifiles.push(f.leafName);
    }
  }
  // remove existing xpi
  if(xpiFile.exists())
    xpiFile.remove(false);
  // zip files into xpi with compression
  if(!createZip(buildDir.path, xpiFile.path, xpifiles, true))
    return;
  // now remove build dir
  buildDir.remove(true);
  setStatus("Built " + xpiFilename);
}

/*
 * Install the extension xpi from the current directory.
 */
function installExtension()
{
  dump("installExtension\n");
  var file = getWorkingDirectory();
  var xpifilename = getXPIFilename(file);
  file.append(xpifilename);

  try {
    const nsIExtensionManager = Components.interfaces.nsIExtensionManager;

    var extensionManager = Components.classes["@mozilla.org/extensions/manager;1"].getService(nsIExtensionManager);
    extensionManager.installExtension(file, nsIExtensionManager.FLAG_INSTALL_PROFILE);
    setStatus("Finished installing " + xpifilename + ".  Please restart your browser.");
  }
  catch(ex) {
    setStatus("Error installing " + xpifilename);
  }
}

/*
 * Uninstall the extension from the current directory.
 * Not yet implemented.
 */
function unInstallExtension()
{
}

/*
 * Read the entire contents of file, put each line
 * into an array.
 *
 * Taken from http://kb.mozillazine.org/index.phtml?title=Dev_:_Extensions_:_Example_Code_:_File_IO#Simple
 */
function readFileToArray(file)
{
  // open an input stream from file
  var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
    .createInstance(Components.interfaces.nsIFileInputStream);
  istream.init(file, 0x01, 0444, 0);
  istream.QueryInterface(Components.interfaces.nsILineInputStream);

  // read lines into array
  var line = {}, lines = [], hasmore;
  do {
    hasmore = istream.readLine(line);
    lines.push(line.value); 
  } while(hasmore);

  istream.close();
  return lines;
}

function haveExtensionManager()
{
  return '@mozilla.org/extensions/manager;1' in Components.classes;
}

/*
 * Given a working directory, and an extension id, determine
 * if it has been installed with flat chrome
 * from the working directory.
 */
function isDevInstalled(wd, id)
{
  if(!wd)
    return false;

  if('@mozilla.org/extensions/manager;1' in Components.classes) {
    // Firefox 1.5+
    var em = Components.classes['@mozilla.org/extensions/manager;1']
                       .getService(Components.interfaces.nsIExtensionManager);
    var il = em.getInstallLocation(id);
    if(il == null)
      return null;

    var d = il.getItemLocation(id);
    if(d.equals(wd))
      return true;
  }

  return false;
}

/*
 * Determine if an extension is installed (by id)
 */
function isInstalled(id)
{
  if('@mozilla.org/extensions/manager;1' in Components.classes) {
    // Firefox 1.5+
    var em = Components.classes['@mozilla.org/extensions/manager;1']
                       .getService(Components.interfaces.nsIExtensionManager);
    var it = em.getItemForID(id);
    if(it.type != 0)
      return true;
  }

  return false;
}

function palert(title, message)
{
  var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Components.interfaces.nsIPromptService);
  ps.alert(window, title, message, ps.BUTTON_TITLE_OK);
}

/*
 * Install the extension in the working directory
 * for development.
 */
function installDevChrome()
{
  var wd = getWorkingDirectory();
  var mf = getInstallManifestFromDir(wd);
  var directoryService=Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties);
  var file = directoryService.get('ProfD', Components.interfaces.nsILocalFile);
  file.append('extensions');
  file.append(mf["id"]);
  if(!file.exists()) {
    var ostream = Components.classes["@mozilla.org/network/file-output-stream;1"]
      .createInstance(Components.interfaces.nsIFileOutputStream);
    // write, create, truncate
    ostream.init(file, 0x02 | 0x08 | 0x20, 0664, 0);
    var data = wd.path + "\n";
    ostream.write(data, data.length);
    ostream.close();
    enableDisableButtons(["install-dev"], true);
    palert("Installed", "Extension installed for development.  Restart your browser.");
  }
}

/*
 * Uninstall the extension in the working directory
 * from development.
 */
function unInstallDevChrome()
{
  var wd = getWorkingDirectory();
  var mf = getInstallManifestFromDir(wd);
  var directoryService=Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties);
  var file = directoryService.get('ProfD', Components.interfaces.nsILocalFile);
  file.append('extensions');
  file.append(mf["id"]);
  if(file.exists() && !file.isDirectory()) {
    file.remove(false);
    enableDisableButtons(["uninstall-dev"], true);
    palert("Uninstalled", "Extension uninstalled.  Restart your browser.");
  }
}

/*
 * Given a full platform-specific path, return an nsILocalFile
 * representing that path.
 */
function fileFromPath(path)
{
  try {
    var f = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    f.initWithPath(path);
    return f;
  }
  catch(ex) { return null; }
}

/*
 * Handle changing the current working directory.
 */
function dirSelectionChanged()
{
  // save extension data
  saveExtensionData();
  var f = getWorkingDirectory();
  if(f)
    setWorkingDirectory(f);
}

/*
 * Return true if item is a member of array arr.
 */
function inArray(item, arr)
{
  for(var i=0; i<arr.length; i++)
    if(arr[i] == item)
      return true;

  return false;
}

/*
 * Find all files in folder that are not required or optional
 * parts of the extension, and add them to a list so they can
 * be optionally packaged into the XPI.
 */
function initExtraFiles(folder, mf, cb)
{
  var ef = document.getElementById("extra-files");
  var it = folder.directoryEntries;
  var mf = mf || getInstallManifestFromDir(folder);
  var jarDirs = {};
  var jarFiles = [];
  var ignoreFiles = ["build.sh", "config_build.sh"].concat(optionalXPIFiles);
  var rootFiles = [];
  if(cb) {
    if(cb["ROOT_FILES"])
      rootFiles = rootFiles.concat(cb["ROOT_FILES"]);
    if(cb["ROOT_DIRS"])
      rootFiles = rootFiles.concat(cb["ROOT_DIRS"]);
  }
  // grab chrome dirs out of install.rdf or chrome.manifest
  getJarFilesAndChromeDirs(mf,
                           getChromeManifestFromDir(folder),
                           jarFiles,
                           jarDirs);
  for(var i=0; i<jarFiles.length; i++) {
    ignoreFiles = ignoreFiles.concat(jarDirs[jarFiles[i]]);
  }
  if(mf && mf['id'])
    ignoreFiles.push(mf['id']);
  ignoreFiles.push(getXPIFilename(folder));
  ignoreFiles.push(EXTENSIONBUILDER_DATA);
  while(it.hasMoreElements()) {
    var f = it.getNext();
    if(f instanceof Components.interfaces.nsILocalFile) {
      // ignore hidden files, emacs backup saves, and the specific ignore files
      if(!f.isHidden() && !f.leafName.match(/~$/) && 
         !inArray(f.leafName, ignoreFiles)) {
        var chk = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "checkbox");
        var name = f.leafName;
        if(f.isDirectory())
          name += "/";
        chk.setAttribute("label", name);
        chk.value = f.leafName;
        if(inArray(f.leafName, rootFiles))
          chk.setAttribute("checked", "true");
        ef.appendChild(chk);
      }
    }
  }
}

/*
 * Get the extension data datasource from dir.
 * If create is true, create it if it doesn't exist.
 * Otherwise, return null if it doesn't exist.
 */
function getExtensionDataDS(dir, create)
{
  var f = dir.clone();
  f.append(EXTENSIONBUILDER_DATA);
  if(create || f.exists()) {
    var rdfContainerUtils = Components.classes["@mozilla.org/rdf/container-utils;1"].getService(Components.interfaces.nsIRDFContainerUtils);
    var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
    var fileURI = ios.newFileURI(f);
    return gRDF.GetDataSourceBlocking(fileURI.spec);
  }
  return null;
}

/*
 * Save extension data.
 */
function saveExtensionData()
{
  /*
  if(currentWorkingDirectory) {
    var ds = getExtensionDataDS(currentWorkingDirectory,true);
  }
  */
}

/*
 * Load extension data
 */
function loadExtensionData(wd)
{
  /*
  var ds = getExtensionDataDS(wd);
  if(ds) {
    dump("loading extension data...\n");
  }
  */
}

function enableDisableButtons(buttons, disabled)
{
  for(var i=0; i<buttons.length; i++) {
    var btn = document.getElementById(buttons[i]);
    btn.disabled = disabled;
  }
}

/*
 * Working directory has changed, set all data accordingly.
 */
function setWorkingDirectory(folder)
{
  currentWorkingDirectory = folder;

  // clear extra files list
  var ef = document.getElementById("extra-files");
  while(ef.firstChild)
    ef.removeChild(ef.firstChild);

  // load extension data if it exists
  loadExtensionData(folder);

  // enable/disable buttons
  var mf = getInstallManifestFromDir(folder);
  var cb = getConfigBuildFromDir(folder);

  // we need a working dir to use these buttons
  enableDisableButtons(["edit-install"], !folder);
  // we need a working dir and an install manifest to use these buttons  
  enableDisableButtons(["build"], !folder || !mf || !mf["id"]);
  // we need a working dir, an install manifest to use these buttons
  enableDisableButtons(["install-dev"], !folder || !mf || !mf["id"] || !haveExtensionManager() || isDevInstalled(folder, mf["id"]) || isInstalled(mf["id"]));
  enableDisableButtons(["uninstall-dev"], !folder || !mf || !mf["id"] || !haveExtensionManager() || !isDevInstalled(folder, mf["id"]));
  // determine XPI filename
  document.getElementById("xpi-filename").value = determineXPIFilename(folder, mf, null, cb);
  // add extra files to list
  initExtraFiles(folder, mf, cb);
  setStatus("Loaded " + folder.leafName);
}

/*
 * Read a registry value using the FF1.5+ API.
 */
function readRegistryValue(wrk, value)
{
  switch (wrk.getValueType(value)) {
    case wrk.TYPE_STRING:
      return wrk.readStringValue(value);
    case wrk.TYPE_BINARY:
      return wrk.readBinaryValue(value);
    case wrk.TYPE_INT:
      return wrk.readIntValue(value);
    case wrk.TYPE_INT64:
      return wrk.readInt64Value(value);
  }
  // unknown type?
  return null;
}

/*
 * Get a windows registry key.  root is one of 'HKCR', 'HKLM'.
 * Key is the key name.  name is the name of the value
 * to get.  Use "" to get the default value.
 *
 * Returns the value or null.
 */
function getRegKey(root, key, name)
{
  if ("@mozilla.org/windows-registry-key;1" in Components.classes) {
    // Firefox 1.5+
    try {
      var wrk = Components.classes["@mozilla.org/windows-registry-key;1"]
                    .createInstance(Components.interfaces.nsIWindowsRegKey);
      var introot = wrk.ROOT_KEY_CLASSES_ROOT;
      switch(root) {
      case 'HKCR':
        introot = wrk.ROOT_KEY_CLASSES_ROOT;
        break;
      case 'HKCU':
        introot = wrk.ROOT_KEY_CURRENT_USER;
        break;
      case 'HKLM':
        introot = wrk.ROOT_KEY_LOCAL_MACHINE;
        break;
      }
      wrk.open(introot,
               key,
               wrk.ACCESS_READ);
      var val = readRegistryValue(wrk, name);
      wrk.close();
      return val;
    }
    catch(ex) {
      return null;
    }
  }
  else if ("@mozilla.org/winhooks;1" in Components.classes) {
    // SeaMonkey or other older non-toolkit application
    var wss = Components.classes["@mozilla.org/winhooks;1"].getService(Components.interfaces.nsIWindowsRegistry);
    return wss.getRegistryEntry(wss[root], key, name);
  }
  else if ("@mozilla.org/browser/shell-service;1" in Components.classes) {
    var wss = Components.classes["@mozilla.org/browser/shell-service;1"]
                        .getService(Components.interfaces.nsIWindowsShellService);
    if ("getRegistryEntry" in wss) {
      // Firefox 1.0
      return wss.getRegistryEntry(wss[root], key, name);
    }
  }
  return null;
}

/*
 * zipUtil object to contain info about an installed
 * zip utility.
 */
function zipUtil(type, exePath, scriptPath, noComp, maxComp, extraArgs)
{
  this.zipType = type;
  this.zipExe = exePath;
  this.zipScript = getFileFromExtensionDir(ED_ID, scriptPath);
  this.NO_COMPRESSION = noComp;
  this.MAX_COMPRESSION = maxComp;
  this.EXTRA_ARGS = extraArgs;
}

zipUtil.prototype = {
  /*
   * Create zipFile by adding filesToAdd from workingDir,
   * with boolean indicating compression.
   *
   * Return true for success, false for failure.
   */
  createZip: function(workingDir, zipFile, filesToAdd, compression) {
    var compressarg = compression ? 
      this.MAX_COMPRESSION : this.NO_COMPRESSION;
    var opts = compressarg;
    //var opts = this.EXTRA_ARGS || [];
    //opts = opts.push([compressarg]).join(' ');
    var args = [this.zipExe, workingDir, opts, zipFile].concat(filesToAdd);
    if(this.zipScript.exists() && this.zipScript.isExecutable()) {
      var proc = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
      proc.init(this.zipScript);
      proc.run(true, args, args.length);
      // return whether the zip file exists
      var zf = fileFromPath(zipFile);
      return zf.exists();
    }
    else {
      dump("zip script not found or not executable\n");
      return false;
    }
  },

  toString: function() {
    return "[zipUtil " + this.zipType + "]";
  }
}

/*
 * Return a usable zipUtil.  Save the result
 * if we have to call determineZipUtil
 */
function getZipUtil()
{
  if(gZipUtil)
    return gZipUtil;
  
  gZipUtil = determineZipUtil();
  return gZipUtil;
}

/*
 * Figure out what zip program is available and where it resides.
 * Returns a zipUtil object or null.
 */
function determineZipUtil()
{
  var zfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  var zpath;
  /*
   * For Windows, we look for various zip programs
   * by looking in the Windows registry.
   */
  if(navigator.platform == "Win32") {
    // look for cygwin zip
    zpath = getRegKey("HKCU", "Software\\Cygnus Solutions\\Cygwin\\mounts v2\\/", "native") || getRegKey("HKLM", "Software\\Cygnus Solutions\\Cygwin\\mounts v2\\/", "native");
      
    if(zpath) {
      zfile.initWithPath(zpath);
      zfile.append("bin");
      zfile.append("zip.exe");

      if(zfile.exists()) {
        dump("found cygwin zip: " + zfile.path + "\n");
        return new zipUtil("Cygwin Zip",
                           zfile.path,
                           "cygzip.bat",
                           "-0",
                           "-9");
      }
    }

    // look for winzip command line addon
    zpath = getRegKey("HKCU", "Software\\Nico Mak Computing\\WinZip\\Add-Ons\\WZCLINE");
    if(zpath) {
      zfile = fileFromPath(zpath).parent;
      zfile.append("wzzip.exe");
      if(zfile.exists()) {
        dump("found WinZip: " + zfile.path + "\n");
        return new zipUtil("WinZip Commandline Addon",
                           zfile.path,
                           "wzcline.bat",
                           "-e0",
                           "-ex");
      }
    }

    // look for WinRAR
    zpath = getRegKey("HKCR", "WinRAR\\shell\\open\\command", "");
    if(zpath) {
      zpath = zpath.replace(/ +"%1" *$/, '').replace(/\"/g, '');
      zfile.initWithPath(zpath);
      if(zfile.exists()) {
        dump("found WinRAR: " + zpath + "\n");
        return new zipUtil("WinRAR",
                           zpath,
                           "winrar.bat",
                           "-m0",
                           "-m5");
      }
    }

    // look for winzip
    zpath = getRegKey("HKCR", "Applications\\winzip32.exe\\shell\\open\\command\\", "") || getRegKey("HKCR", "WinZip\\shell\\open\\command\\", "");
    if(zpath) {
      zpath = zpath.replace(/ +"%1" *$/, '');
      zfile.initWithPath(zpath);
      if(zfile.exists()) {
        dump("found WinZip: " + zpath + "\n");
        return new zipUtil("WinZip",
                           zpath,
                           "winzip.bat",
                           "-e0",
                           "-ex");
      }
    }

    // look for 7-Zip
    zpath = getRegKey("HKLM", "SOFTWARE\\7-Zip", "Path");
    if(zpath) {
      zfile.initWithPath(zpath);
      zfile.append("7z.exe");
      if(zfile.exists()) {
        dump("found 7-Zip: " + zpath + "\n");
        return new zipUtil("7-Zip",
                           zfile.path,
                           "7zip.bat",
                           "-mx0",
                           "-mx9");
      }
    }

    // win32, but no supported zip program
    return null;
  }

  // see if we have zip in our path
  var env = Components.classes["@mozilla.org/process/environment;1"].getService(Components.interfaces.nsIEnvironment);
  var paths = env.get("PATH").split(':');
  for(i=0;i<paths.length;i++) {
    try {
      zfile.initWithPath(paths[i]);
      zfile.append("zip");
      if(zfile.exists() && zfile.isExecutable())
	return new zipUtil("Unix Zip",
			   zfile.path,
			   "zip.sh",
			   "-0",
			   "-9");
    }
    catch(ex) {}
  }

  //FIXME: handle other platforms gracefully?
  return null;
}

/*
 * Given an extension id, get a file from its installed directory
 */
function getFileFromExtensionDir(id, filename)
{
  if('@mozilla.org/extensions/manager;1' in Components.classes) {
    // Firefox 1.5+
    var em = Components.classes['@mozilla.org/extensions/manager;1']
                       .getService(Components.interfaces.nsIExtensionManager);
    var il = em.getInstallLocation(id);
    if(il == null)
      return null;

    var d = il.getItemLocation(id);
    d.append(filename);
    return d;
  }
  else {
    // Possibly FF <= 1.0 or SM
    // look in profile dir
    var directoryService=Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties);
    var profD = directoryService.get('ProfD', Components.interfaces.nsILocalFile);
    var file = profD.clone();
    // try profile/extensions/id first
    file.append('extensions');
    file.append(id);
    file.append(filename);
    if(file.exists()) {
      return file;
    }
    else {
      // try the profile chrome dir
      file = profD.clone();
      file.append('chrome');
      file.append(filename);
      if(file.exists())
        return file;

      // ok, last ditch effort, try the app dir
      file = directoryService.get('AChrom', Components.interfaces.nsILocalFile);;
      file.append(filename);
      if(file.exists())
        return file;
    }
  }
  // ouch.
  return null;
}

/*
 * Given a working directory, zip file name, files to add
 * (relative to working directory)
 * and boolean indicating whether to use compression,
 * create the zip file.
 */
function createZip(extDir, zipfile, addDirs, compress)
{
  var zu = getZipUtil();

  if(!zu) {
    setStatus("No suitable zip program found.");
    return false;
  }

  dump('createZip: ' + extDir + ', ' + zipfile + ', [' + addDirs.join(',') + '], ' + compress + '\n');
  if(zu.createZip(extDir, zipfile, addDirs, compress))
    return true;

  setStatus("Zip failed");
  return false;
}

/*
 * Load the recently used paths from the extensiondev RDF store.
 */
function loadPaths()
{
  var items = loadHistoryItems(ED_NS("extensionbuilder_paths"), ED_NS("extensionbuilder_pathitem"));
  var ml = document.getElementById("workingdir");
  for(var i=0; i<items.length; i++) {
    ml.appendItem(items[i]);
  }
  var lastSel = loadSingleItem("lastworkingdir");
  ml.selectedIndex = (lastSel == null) ? -1 : lastSel;
  dirSelectionChanged();
}

/*
 * Save the recently used paths to the extensiondev RDF store.
 */
function savePaths()
{
  var ml = document.getElementById("workingdir");
  var mi = ml.getElementsByTagName("menuitem");
  var num = min(mi.length, 10);
  var list = [];
  for(var i=0; i<num; i++) {
    list.push(mi[i].getAttribute("label"));
  }
  saveHistoryItems(list, ED_NS("extensionbuilder_paths"), ED_NS("extensionbuilder_pathitem"));
  saveSingleItem("lastworkingdir", ml.selectedIndex);
}

/*
 * Make sure zip.sh is executable.
 */
function checkZipSH()
{
  if(navigator.platform != "Win32") {
    var zipScript = getFileFromExtensionDir(ED_ID, "zip.sh");
    if(!zipScript.isExecutable()) {
      // try user executable first
      zipScript.permissions |= 0500;
      if(!zipScript.isExecutable()) {
	// this probably won't work anyway
	// if we don't own the file
	zipScript.permissions |= 0550;
      }
    }
  }
}

/*
 * Perform initialization
 */
function onExtensionBuilderLoad()
{
  checkZipSH();
  getRDFService();
  loadPaths();
  setStatus("Ready");
}

/*
 * Perform cleanup/shutdown.
 */
function onExtensionBuilderUnload()
{
  savePaths();
  releaseRDFService();
}

window.addEventListener("load", onExtensionBuilderLoad, true);
window.addEventListener("unload", onExtensionBuilderUnload, true);
