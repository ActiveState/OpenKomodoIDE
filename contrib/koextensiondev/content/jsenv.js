var browser;

function onLoad()
{
  browser = document.getElementById("content");
  checkSetup();
}

function doSetScope()
{
  var s = document.getElementById("scopelist").selectedItem;
  if(s != null) {    
    if(s.id == "noscope") {
      browser.contentWindow.scope = null;
    }
    else {
      var windowManagerDS = Components.classes['@mozilla.org/rdf/datasource;1?name=window-mediator']
        .getService(Components.interfaces.nsIWindowDataSource);
      var desiredWindow = windowManagerDS.getWindowForResource(s.getAttribute('id'));
      if(desiredWindow)
        browser.contentWindow.scope = desiredWindow;
    }
  }
}

function checkSetup()
{
  // see if html is loaded
  if(browser.webProgress.isLoadingDocument) {
    // wait till later.  i could use a nsIWebProgressListener,
    // but that's a lot of work
    setTimeout(checkSetup, 50);
  }
  else {
    doSetup();
  }
}

function doSetup()
{
  // about:blank doesn't have chrome privileges
  browser.contentWindow.toolbarFrame.execFrame.location = "chrome://extensiondev/content/jsenv/blank.html";
  // read startup JS from a file
  try {
    loadFileFromPrefToTextbox("extensions.extensiondev.jsenv.startup", browser.contentWindow.inputFrame.document.getElementById("input"));
  } catch(e) {
    // the pref may not exist
    dump(e + '\n');
  }
}

function save()
{
  var tb = browser.contentWindow.inputFrame.document.getElementById("input");
  saveFileFromTextbox(window, tb, "javascript");
}

function load()
{
  var tb = browser.contentWindow.inputFrame.document.getElementById("input");
  loadFileToTextbox(window, tb, "javascript");
}
