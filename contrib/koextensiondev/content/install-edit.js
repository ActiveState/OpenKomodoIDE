//TODO: see if I can include this stuff from nsExtensionManager.js
// instead of copy/pasting it all.

var gInstallManifestFilename = null;
var gExtensionShortName = null;
var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getDefaultBranch("");

function getCharPref(p)
{
  return prefs.getCharPref(p);
}

function doLoadManifest()
{
  if(window.arguments && window.arguments[0])
    setInstallManifest(window.arguments[0], window.arguments[1]);
  else
    setDefaultValues();
}

function promptForFilename()
{
  var nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  fp.init(window, "Save As", nsIFilePicker.modeSave);
  if(fp.show() == nsIFilePicker.returnOK) {
    return fp.file.path;
  }

  return "install.rdf";
}

function doSaveManifest()
{
  if(!gInstallManifestFilename)
    gInstallManifestFilename = promptForFilename();

  writeInstallManifest(gInstallManifestFilename, getFieldValues());
}

function onUnload()
{
  prefs = null;
}

function pathToFileURI(path)
{
  var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
  var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  file.initWithPath(path);
  return ios.newFileURI(file);
}

function setInstallManifest(manifestPath, extensionShortName)
{
  gInstallManifestFilename = manifestPath;
  if(extensionShortName)
    gExtensionShortName = extensionShortName;

  dump("setInstallManifest 1: " + manifestPath + "\n");
  var manifestFile = pathToFileURI(manifestPath);
  dump("setInstallManifest 2: " + manifestFile.spec + "\n");
  var installmanifest = readInstallManifest(manifestFile.spec);
  dump("setInstallManifest 3: " + installmanifest + "\n");
  if(installmanifest && installmanifest["id"])
    setFieldValues(installmanifest);
  else // could be a filename for a new file
    setDefaultValues();
}

function serializeRDF(ds, file)
{
  var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
  foStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0);
  var serializer=Components.classes["@mozilla.org/rdf/xml-serializer;1"].createInstance(Components.interfaces.nsIRDFXMLSerializer);
  serializer.init(ds);
  serializer.QueryInterface(Components.interfaces.nsIRDFXMLSource);
  var as = Components.classes["@mozilla.org/atom-service;1"].getService(Components.interfaces.nsIAtomService);
  serializer.addNameSpace(as.getAtom("em"), 
	"http://www.mozilla.org/2004/em-rdf#");
  serializer.Serialize(foStream);
  foStream.close();
}

function writeInstallManifest(filename, manifest)
{
  var gRDF;
  try {
    gRDF = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
    var ds = Components.classes["@mozilla.org/rdf/datasource;1?name=in-memory-datasource"].createInstance(Components.interfaces.nsIRDFDataSource);

    var manifestRoot = gRDF.GetResource("urn:mozilla:install-manifest");
    // simple props
    var props = ["id", "name", "version", "creator", "description", "homepageURL", "updateURL", "iconURL", "optionsURL", "aboutURL"];

    for(var i=0; i<props.length; i++) {
      if(manifest[props[i]]) {
	var prop = gRDF.GetResource(EM_NS(props[i]));
	var lit  = gRDF.GetLiteral(manifest[props[i]]);
	ds.Assert(manifestRoot, prop, lit, true);
      }
    }

    // contributors
    if(manifest.contributors) {
      for(i=0; i<manifest.contributors.length; i++) {
	var cprop = gRDF.GetResource(EM_NS("contributor"));
	lit = gRDF.GetLiteral(manifest.contributors[i]);
	ds.Assert(manifestRoot, cprop, lit, true);
      }
    }

    // Version/Dependency
    var versionProps = ["targetApplication", "requires"];
    var id = gRDF.GetResource(EM_NS("id")),
      minVer = gRDF.GetResource(EM_NS("minVersion")),
      maxVer = gRDF.GetResource(EM_NS("maxVersion"));

    for(i=0; i<versionProps.length; i++) {
      if(manifest[versionProps[i]]) {
	prop = gRDF.GetResource(EM_NS(versionProps[i]));
	for(j=0; j<manifest[versionProps[i]].length; j++) {
	// the Description
	var desc = gRDF.GetAnonymousResource();
	ds.Assert(manifestRoot, prop, desc, true);
	lit = gRDF.GetLiteral(manifest[versionProps[i]][j].id);
	ds.Assert(desc, id, lit, true);
	lit = gRDF.GetLiteral(manifest[versionProps[i]][j].minVersion);
	ds.Assert(desc, minVer, lit, true);
	lit = gRDF.GetLiteral(manifest[versionProps[i]][j].maxVersion);
	ds.Assert(desc, maxVer, lit, true);
        }
      }
    }
    
    // Files
    var fileProp = gRDF.GetResource(EM_NS("file"));
    if(manifest.files) {
      for(i=0; i<manifest.files.length; i++) {
	desc = gRDF.GetResource("urn:mozilla:extension:file:" + 
				manifest.files[i].fileName);
	ds.Assert(manifestRoot, fileProp, desc, true);
	var providers = ["package", "skin", "locale"];
	for(j=0; j<providers.length; j++) {
	  if(manifest.files[i][providers[j]]) {
	    var provProp = gRDF.GetResource(EM_NS(providers[j]));
	    for(var k=0; k<manifest.files[i][providers[j]].length; k++) {
	      lit = gRDF.GetLiteral(manifest.files[i][providers[j]][k]);
	      ds.Assert(desc, provProp, lit, true);
	    }
	  }
	}
      }
    }

    var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(filename);
    serializeRDF(ds, file);
  }
  catch(e) { dump(e + "\n"); }
  
  // must release this
  gRDF = null;
}

function setFieldValues(manifest)
{
  var props = ["id", "name", "version", "creator", "description", "homepageURL", "updateURL", "iconURL", "optionsURL", "aboutURL"];

  for(var i=0; i<props.length; i++) {
    if(manifest[props[i]]) {
      document.getElementById(props[i]).value = manifest[props[i]];
    }
  }

  if(manifest.contributors) {
    for(i=0; i<manifest.contributors.length; i++)
      document.getElementById("contributors").appendItem(manifest.contributors[i]);
  }
  
  if(manifest["targetApplication"]) {
    for(i=0; i<manifest["targetApplication"].length; i++) {
      var v = manifest["targetApplication"][i];
      setTarget(v.id, v.minVersion, v.maxVersion);
    }
  }

  if(manifest.files) {
    for(i=0; i<manifest.files.length; i++) {
      var fileBox = addFile(manifest.files[i].fileName);
      var providers = ["package", "skin", "locale"];
      for(var j=0; j<providers.length; j++) {
	if(manifest.files[i][providers[j]]) {
	  var pl = manifest.files[i][providers[j]];
	  for(var k=0; k<pl.length; k++) {
	    addChromePath(fileBox, providers[j], pl[k]);
	  }
	}
      }
    }
  }
}

function getFieldValues()
{
  var manifest = { toString: pr_all };

  var props = ["id", "name", "version", "creator", "description", "homepageURL", "updateURL", "iconURL", "optionsURL", "aboutURL"];

  for(var i=0; i<props.length; i++) {
    manifest[props[i]] = document.getElementById(props[i]).value;
  }

  var contributors = document.getElementById("contributors");
  var num = contributors.getRowCount();
  if(num > 0) {
    manifest.contributors = new Array(num);
    for(i=0; i<num; i++)
      manifest.contributors[i] = contributors.getItemAtIndex(i).label;
  }
  
  var targets = document.getElementById("target-applications").getElementsByTagName("checkbox");
  if(targets.length > 0) {
    manifest["targetApplication"] = [];
    for(i=0; i<targets.length; i++) {
      if(targets[i].checked) {
        var minVer, maxVer;
        var textboxes=targets[i].parentNode.getElementsByTagName("textbox");
        for(var j=0; j<textboxes.length; j++) {
	  var t = textboxes[j];
  	  if(t.id.match(/minver$/))
	    minVer = t.value;
	  else if(t.id.match(/maxver$/))
	    maxVer = t.value;
        }
        manifest["targetApplication"].push({ id: targets[i].id, minVersion: minVer, maxVersion: maxVer });
      }
    }
  }
  
  var files = document.getElementById("files-box").childNodes;
  if(files.length > 0) {
    manifest.files = new Array(files.length);
    for(i=0; i<files.length; i++) {
      manifest.files[i] = {};
      manifest.files[i].fileName = files[i].getElementsByTagName("textbox")[0].value;
      var paths = files[i].getElementsByTagName("menulist");
      if(paths.length > 0) {
	for(var j=0; j<paths.length; j++) {
	  var type = paths[j].selectedItem.label;
	  var path = paths[j].nextSibling.value;
	  if(!manifest.files[i][type])
	    manifest.files[i][type] = [];
	  manifest.files[i][type].push(path);
	}
      }
    }
  }

  return manifest;
}

function setDefaultValues()
{
  dump('setDefaultValues\n');
  getGUID();
  addChromePath(addFile());
  setDefaultTarget();
  if(gExtensionShortName)
    document.getElementById("name").value = gExtensionShortName;
}

function getGUID()
{
  try {
    var req = new XMLHttpRequest();
    req.open("GET", "http://ted.mielczarek.org/code/uuid.pl",false);
    req.send(null);
    if(req.status == 200) {
      document.getElementById("id").value = "{" + req.responseText.replace(/\n/g, '') + "}";
    }
  }
  catch(ex) {
    dump('Error: ' + ex + "\n");
  }
}

function setDefaultTarget()
{
  var appId = getCharPref("app.id");
  var appExtVer = getCharPref("app.extensions.version");
  setTarget(appId, appExtVer, appExtVer);
}

function setTarget(id, minVer, maxVer)
{
  var check = document.getElementById(id);
  if(check == null)
    return;

  check.checked = true;
  var textboxes=check.parentNode.getElementsByTagName("textbox");
  for(var j=0; j<textboxes.length; j++) {
    var t = textboxes[j];
    if(t.id.match(/minver$/))
      t.value = minVer;
    else if(t.id.match(/maxver$/))
      t.value = maxVer;
  }
}
function addContributor()
{
  var c = document.getElementById("contributor-add");
  if(c.value != "") {
    document.getElementById("contributors").appendItem(c.value);
    c.value = "";
  }
}

function removeContributor()
{
  var c = document.getElementById("contributors");
  var si = c.selectedItems;
  for(var i=si.length-1; i>=0; i--) {
    c.removeItemAt(c.getIndexOfItem(si[i]));
  }
  c.clearSelection();
  document.getElementById("remove-contributor").disabled = true;
}

function contributorSelect()
{
  document.getElementById("remove-contributor").disabled = 
    (document.getElementById("contributors").selectedCount == 0);
}

function addFile(fileName)
{
  var filesSpare = document.getElementById("files-spare");
  var files = document.getElementById("files-box");
  var filebox = filesSpare.firstChild.cloneNode(true);
  if(fileName != undefined) {
    filebox.getElementsByTagName("textbox")[0].value = fileName;
  }
  else if(gExtensionShortName) {
    filebox.getElementsByTagName("textbox")[0].value = gExtensionShortName + ".jar";
  }
    
  files.appendChild(filebox);
  return filebox;
}

function removeFile(cb)
{
  var files = document.getElementById("files-box");
  var theFile = cb.parentNode.parentNode.parentNode;
  files.removeChild(theFile);
}

function removeChromePath(cb)
{
  var pathsbox = document.getElementById("files-box").getElementsByTagName("rows")[0];
  pathsbox.removeChild(cb.parentNode);
}

function addChromePath(filebox, chrometype, pathname)
{
  var pathsSpare = document.getElementById("paths-spare");
  var pathBox = filebox.getElementsByTagName("rows")[0].appendChild(pathsSpare.getElementsByTagName("row")[0].cloneNode(true));
  if(chrometype != undefined && pathname != undefined) {
    var ml = pathBox.getElementsByTagName("menulist")[0];
    var mi = pathBox.getElementsByTagName("menuitem");
    for(var i=0; i<mi.length; i++) {
      if(mi[i].label == chrometype)
	ml.selectedIndex = i;
    }

    var tx = pathBox.getElementsByTagName("textbox")[0];
    tx.value = pathname;
  }
}

function setDefaultChromePath(menulist)
{
  var txt = menulist.nextSibling;
  switch(menulist.selectedItem.label) {
  case "package":
    txt.value = "content/";
    break;
  case "skin":
    txt.value = "skin/";
    break;
  case "locale":
    txt.value = "locale/" + getCharPref("general.useragent.locale") + "/";
    break;
  }
}

function doClose()
{
  window.close();
}
