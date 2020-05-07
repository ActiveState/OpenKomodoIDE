// prefs for debugging.  true should mean enabled.
var debuggingPrefs = ["nglayout.debug.disable_xul_cache", "javascript.options.showInConsole", "browser.dom.window.dump.enabled"];

/*
 * Open this tool in a new window (uses a little xul file to work
 * with Thunderbird)
 */
function doOpenTool_newWin(url, width, height)
{
  
  var options = "";
  if (width)
    options += ",width="+width
  if (height)
    options += ",height="+height
  var w = window.openDialog(url, "_blank", "all=no"+options+",scrollbars=yes,resizable=yes,dialog=no");
}

/*
 * Open this tool in a new tab
 */
function doOpenTool_newTab(url)
{
  var br = getBrowser();
  br.selectedTab = br.addTab(url);
}

/*
 * Open one of the tools.  The click modifiers determine whether
 * to use current window, new tab, or new window.
 */
function doOpenTool(ev, title, url, width, height)
{
  // ev.button appears to be undefined in trunk builds...
  // it comes out as 65535
  if(ev.ctrlKey) { // new tab
    doOpenTool_newTab(url);
  }
  else if(ev.shiftKey) { // open in current window
    getBrowser().loadURI(url);
  }
  else { // new window (default)
    doOpenTool_newWin(url, width, height);
  }
}

function doLoadExtensionBuilder(url)
{
  doOpenTool_newWin(url);
}

function doLoadJSInjector(url)
{
  window.openDialog(url, "_blank", "all=no,width=500,height=200,scrollbars=no,resizable=yes,dialog=no");
}

function doToggleExtensionDevPrefs(menuitem)
{
  var chk = menuitem.getAttribute("checked");
  if(chk == "" || chk == "false")
   doSetDebuggingPrefs(false);
  else
   doSetDebuggingPrefs(true);
}

function doSetDebuggingPrefs(v)
{
  try {
    var mPrefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
    for(var i=0; i<debuggingPrefs.length; i++)
      mPrefs.setBoolPref(debuggingPrefs[i], v);    
  }
  catch(e) {}
}

function doReloadAllChrome()
{
  try {
    // assuming bug 256504 makes it in, this should work with jar files
    Components.classes["@mozilla.org/chrome/chrome-registry;1"].getService(Components.interfaces.nsIXULChromeRegistry).reloadChrome();
  } catch(e) { alert(e) }
}

function extensiondev_init()
{
  var rv = false;
  // set the "debugging prefs" menuitem
  var mPrefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
  try {
    for(var i=0; i<debuggingPrefs.length; i++)
      rv = rv || mPrefs.getBoolPref(debuggingPrefs[i]);
  }
  catch(e){}

  doSetDebuggingPrefs(rv);
  document.getElementById("extensiondev_toggleprefs").setAttribute("checked", rv);

  // dump js console errors to stdout
  /*FIXME: This appears to be buggy.
  var consoleObserver = {
    observe : function(msg) {
      try {
      var si = msg.QueryInterface(Components.interfaces.nsIScriptError);
      if(si) {
        var ise = Components.interfaces.nsIScriptError;
	var type = "Error";
	if(si.flags & ise.warningFlag)
	  type = "Warning";
	dump(type + ": " + si.message + "\n");
      }
      else {
        dump(msg.message + "\n");
      }
      }
      catch(e) {
	dump("Error reporting error!\n");
      }
    },
    QueryInterface: function (iid) {
	if (!iid.equals(Components.interfaces.nsIConsoleListener) &&
            !iid.equals(Components.interfaces.nsISupports)) {
		throw Components.results.NS_ERROR_NO_INTERFACE;
	    }
        return this;
    }
  };
  var cs = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
  cs.registerListener(consoleObserver);
  */
}

window.addEventListener("load",extensiondev_init, false);
