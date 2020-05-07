function printDoScope(s, scopeObjText)
{
  var newdiv = document.createElement("div");
  var a = document.createElement("a");
  a.href = "javascript:go('scope(" + scopeObjText + ")')";
  a.appendChild(document.createTextNode(s));
  newdiv.appendChild(a);
  newdiv.className = "normalOutput";
  _out.appendChild(newdiv);
  return newdiv;
}

shellCommands.enumerateWindows = function enumerateWindows()
{
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
  var en = wm.getEnumerator("");

  var n = 0;
  Shell.enumWins = [];
  while(en.hasMoreElements()) {
    var w = en.getNext();
    if(w.document.getElementById("content") && w.document.getElementById("content").tagName == "tabbrowser") {
      var b = w.document.getElementById("content");
      var ntabs = b.mPanelContainer.childNodes.length;
      for(var i=0; i<ntabs; i++) {
        var tb = b.getBrowserAtIndex(i);
        try {
	  Shell.enumWins[n] = tb.contentWindow;
          printDoScope(tb.currentURI.spec, "Shell.enumWins[" + n + "]");
          n++;
        } catch(e) {}
      }
    }

    Shell.enumWins[n] = w;
    printDoScope(w.location.href,"Shell.enumWins[" + n + "]");
    n++;
  }
}

function onChromeShellExtrasLoad()
{
  var a = document.createElement("a");
  a.appendChild(document.createTextNode("enumerateWindows()"));
  a.href = "javascript:go('enumerateWindows()')";
  a.setAttribute("accesskey","E");
  var odiv = document.getElementById("output");
  odiv.appendChild(document.createTextNode(" "));
  odiv.appendChild(a);

  loadHistory();
  window.setTimeout(function() {
        window.shellCommands.enumerateWindows();
        window.shellCommands.scope(Shell.enumWins[Shell.enumWins.length - 1].opener);
    }, 50);
}

function loadHistory()
{
  var items = loadHistoryItems("http://ted.mielczarek.org/code/mozilla/extensiondev#jsshell_history", "http://ted.mielczarek.org/code/mozilla/extensiondev#jsshell_historyitem");
  histList = items;
  if(histList[histList.length-1] != "")
    histList.push("");
  histPos = (histList.length > 0) ? histList.length-1 : 0;
}

function saveHistory()
{
  var num = min(histList.length, 20 + 1);
  var start = histList.length - num;
  
  saveHistoryItems(histList.slice(start, histList.length), "http://ted.mielczarek.org/code/mozilla/extensiondev#jsshell_history", "http://ted.mielczarek.org/code/mozilla/extensiondev#jsshell_historyitem");
}

function onChromeShellExtrasUnload()
{
  saveHistory();
  releaseRDFService();
}

shellCommands.propsPlus = function(o) {
  for(var x in o) {
    try { 
      var v = o[x];
      if(v instanceof Function) { 
        println(x + ": Function");
      }
      else {
        println(x + ": " + v);
      }
    }
    catch(ex) {}
  }
}

window.addEventListener("load", onChromeShellExtrasLoad, true);
window.addEventListener("unload", onChromeShellExtrasUnload, true);
