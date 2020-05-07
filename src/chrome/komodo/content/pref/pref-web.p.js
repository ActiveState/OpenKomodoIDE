/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

var gBrowsers, gBrowserTypes;
var gBrowserMenulist;

function PrefWeb_OnLoad()
{
    var prefbrowser = parent.hPrefWindow.prefset.getString('browser', '');

    // Get the list of available browsers.
    var koWebbrowser = Components.classes['@activestate.com/koWebbrowser;1'].
                   getService(Components.interfaces.koIWebbrowser);
    var browsersObj = {};
    var browserTypesObj = {};
    koWebbrowser.get_possible_browsers_and_types(
            {} /* count */, browsersObj, browserTypesObj);
    var gBrowsers = browsersObj.value;
    var gBrowserTypes = browserTypesObj.value;

    gBrowserMenulist = document.getElementById('selectedbrowser');
// #if PLATFORM == "win"
    gBrowserMenulist.appendItem('System defined default browser','');
// #else
    gBrowserMenulist.appendItem('Ask when browser is launched the next time', '');
// #endif

    var found = false;
    for (var i=0; i < gBrowsers.length; i++) {
        _addBrowser(gBrowsers[i], gBrowserTypes[i]);
        if (gBrowsers[i] == prefbrowser) found = true;
    }
    if (!found && prefbrowser) {
        _addBrowser(prefbrowser, null);
    }
    
    parent.hPrefWindow.onpageload();
}


/* Add the given browser to the browser menulist and return the added item. */
function _addBrowser(browser, browserType /* =null */) {
    if (typeof(browserType) == "undefined") browserType = null;

    var popup = document.getElementById("selectedbrowser-popup");
    var item = document.createElementNS(XUL_NS, "menuitem");
    item.setAttribute("label", browser);
    item.setAttribute("value", browser);
    item.setAttribute("crop", "center");
    if (browserType) {
        //TODO: This styling doesn't work here and I don't know why.
        //      The equivalent works for the "browser preview" toolbar
        //      button in komodo.xul.
        item.setAttribute("class", "menuitem-iconic browser-"+browserType+"-icon");
    }
    popup.appendChild(item);
    return item;
}

function browseForBrowser() {
    var prefName = "prefWeb.browseForBrowser";
    var gBrowserMenulist = document.getElementById("selectedbrowser");
    var default_dir = (getDirectoryFromTextObject(gBrowserMenulist)
                       || ko.filepicker.internDefaultDir(prefName));
    var path = ko.filepicker.browseForExeFile(default_dir);
    if (path == null) {
        return null;
    }
    ko.filepicker.updateDefaultDirFromPath(prefName, path);
    path = path.replace('"', '\\"', 'g');
    if (path.indexOf(' ') != -1) {
        path = '\"' + path + '\"';
    }
    gBrowserMenulist.selectedItem = _addBrowser(path);
    return null;
}


function configureProxies() {
    ko.windowManager.openDialog(
        "chrome://komodo/content/pref/pref-proxies.xul",
        "Komodo:ProxyPrefs",
        "chrome,modal,resizable,close,centerscreen",
        null);
}

function showCertificates() {
    ko.windowManager.openDialog(
        "chrome://pippki/content/certManager.xul",
        "mozilla:certmanager",
        "chrome,modal,resizable,close,centerscreen",
        null);
}
