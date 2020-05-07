var old = '';
var timeout = -1;
var xwin = null;
var newwin = false;
var inwindow = false;

function init()
{
  if(xwin)  // for some reason onload gets called when the browser refreshes???
    return;

  var ta = document.getElementById('ta');

  // read startup XUL from a file
  try {
    loadFileFromPrefToTextbox("extensions.extensiondev.xuledit.startup", document.getElementById("ta"));
  } catch(e) {
    // the pref may not exist
    dump(e + '\n');
  }
  
  update();
  ta.select();
}

function openwin()
{
  toggleBrowser(false);
  xwin = window.openDialog('about:blank', 'xulwin', 'all=no,resizable=yes,width=400,height=400');
  newwin = true;
  inwindow = true;
  update();
}

function toggleBrowser(show)
{
  document.getElementById("split").collapsed = !show;
  document.getElementById("content").collapsed = !show;
  document.getElementById("open").collapsed = !show;
}

function update()
{
  var textarea = document.getElementById("ta");

  // either this is the first time, or
  // they closed the window
  if(xwin == null || xwin.document == null) {
    toggleBrowser(true);
    xwin = document.getElementById("content").contentWindow;
    newwin = true;
    inwindow = false;
  }

  if (old != textarea.value || newwin) {
    old = textarea.value;
    newwin = false;
    xwin.document.location = "data:application/vnd.mozilla.xul+xml," + encodeURIComponent(old);
    if(inwindow)
      xwin.sizeToContent();
  }

  timeout = window.setTimeout(update, 500);
}

function resetTimeout()
{
  if(timeout != -1)
    window.clearTimeout(timeout);

  timeout = window.setTimeout(update, 500);
}

function save()
{
  saveFileFromTextbox(window, document.getElementById("ta"), "xul");
}

function load()
{
  loadFileToTextbox(window, document.getElementById("ta"), "xul");
}
