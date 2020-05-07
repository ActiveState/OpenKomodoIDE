const EM_NS_PREFIX      = "http://www.mozilla.org/2004/em-rdf#";

function EM_NS(aProperty)
{
  return EM_NS_PREFIX + aProperty;
}
function stringData(aLiteralOrResource)
{
  try {
    var obj = aLiteralOrResource.QueryInterface(Components.interfaces.nsIRDFLiteral);
    return obj.Value;
  }
  catch (e) {
    try {
      obj = aLiteralOrResource.QueryInterface(Components.interfaces.nsIRDFResource);
      return obj.Value;
    }
    catch (e) {}
  }
  return "--";
}

function pr_all() {
  var s = "[";
  for(var x in this) {
    if(this[x] instanceof Function)
      continue;

    s += x + ": " + this[x] + "\n";
  }
  return s + "]";
}

function readInstallManifest(manifest)
{
  var gRDF;
  var obj = { toString: pr_all };
  try {
    gRDF = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
    var ds = gRDF.GetDataSourceBlocking(manifest);

    var manifestRoot = gRDF.GetResource("urn:mozilla:install-manifest");
    // simple props
    var props = ["id", "name", "version", "creator", "description", "homepageURL", "updateURL", "iconURL", "optionsURL", "aboutURL"];

    for(var i=0; i<props.length; i++) {
      var prop = gRDF.GetResource(EM_NS(props[i]));
      var res = ds.GetTarget(manifestRoot, prop, true);
      if(res)
	obj[props[i]] = stringData(res);
    }

    // contributors
    var contributors = ds.GetTargets(manifestRoot,
				     gRDF.GetResource(EM_NS("contributor")),
				     true);
    var c = [];
    while(contributors.hasMoreElements()) {
      var literal = contributors.getNext().QueryInterface(Components.interfaces.nsIRDFNode);
      if(literal)
	c.push(stringData(literal));
    }
    if(c.length > 0)
      obj.contributors = c;

    // Version/Dependency
    var versionProps = ["targetApplication", "requires"];
    var id = gRDF.GetResource(EM_NS("id")),
      minVer = gRDF.GetResource(EM_NS("minVersion")),
      maxVer = gRDF.GetResource(EM_NS("maxVersion"));

    for(i=0; i<versionProps.length; i++) {
      prop = gRDF.GetResource(EM_NS(versionProps[i]));
      var infos = ds.GetTargets(manifestRoot, prop, true);
      var list = [];

      while(infos.hasMoreElements()) {
	var verInfo = infos.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
	var verObj = { toString: pr_all };

	res = ds.GetTarget(verInfo, id, true);
	if(res)
	  verObj.id = stringData(res);
	res = ds.GetTarget(verInfo, minVer, true);
	if(res)
	  verObj.minVersion = stringData(res);
	res = 	ds.GetTarget(verInfo, maxVer, true);
	if(res)
	  verObj.maxVersion = stringData(res);
	list.push(verObj);
      }
      if(list.length > 0)
	obj[versionProps[i]] = list;
    }
    
    // Files
    var fileProp = gRDF.GetResource(EM_NS("file"));
    var files = ds.GetTargets(manifestRoot, fileProp, true);
    var fileList = [];
    while(files.hasMoreElements()) {
      var fileObj = { toString: pr_all };
      var file = files.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
      fileObj.fileName = file.Value.substr("urn:mozilla:extension:file:".length, file.Value.length);
      var providers = ["package", "skin", "locale"];
      for(i=0; i<providers.length; i++) {
	list = [];
	var provProp = gRDF.GetResource(EM_NS(providers[i]));
	var items = ds.GetTargets(file, provProp, true);
	while(items.hasMoreElements()) {
	  var item = items.getNext().QueryInterface(Components.interfaces.nsIRDFLiteral);
	  list.push(item.Value);
	}
	if(list.length > 0)
	  fileObj[providers[i]] = list;
      }
      fileList.push(fileObj);
    }
    
    if(fileList.length > 0)
      obj.files = fileList;
  }
  catch(e) { dump(e + "\n"); obj = null; }
  
  // must release this
  gRDF = null;

  return obj;
}