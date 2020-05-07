/* Copyright (c) 2003-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* A dialog to let the user pick an icon, either from a standard set of
   PNG files which Komodo ships with, or from a file the user has on
   his/her filesystem.

   The object returned has up to two properties:
    - retval: if "OK", then icon was picked.
    - value: if retval is "OK", then the URL of the selected file.
 */
var bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
        .getService(Components.interfaces.nsIStringBundleService)
        .createBundle("chrome://komodo/locale/dialogs/iconpicker.properties");
        
var log = ko.logging.getLogger("dialogs.iconpicker");
//log.setLevel(ko.logging.LOG_DEBUG);

var obj;
var gCurrentURI;
var files;
var os = Components.classes["@activestate.com/koOs;1"].getService();

var gIframe, gImgList, gWordList, gWordIndex, gIconFilter;

function OnLoad()
{
    try {
        obj = window.arguments[0];
        var dialog = document.getElementById("dialog-iconpicker");
        var okButton = dialog.getButton("accept");
        okButton.setAttribute("accesskey", bundle.GetStringFromName("okButton.accessKey"));
        var customButton = dialog.getButton("extra1");
        customButton.setAttribute("label", bundle.GetStringFromName("chooseOther"));
        var resetButton = dialog.getButton("extra2");
        resetButton.setAttribute("label", bundle.GetStringFromName("reset"));
        var menulist = document.getElementById("icon-families");
        var lastSelectedIndex = parseInt(menulist.getAttribute("lastSelectedIndex"));
        menulist.selectedIndex = lastSelectedIndex;
        gIconFilter = document.getElementById("iconFilter");
        document.getElementById('iframe').
            addEventListener('load',
                             function() {
                                 if (gIconFilter.value) {
                                     doUpdateFilter(gIconFilter.value);
                                     gIconFilter.select();
                                 }
                             }, true); // bubbling events aren't fired
        selectIconFamily();
    } catch (e) {
        log.exception(e);
    }
}

function ValidatedPickIcon(uri)
{
    try {
        Pick_Icon(uri);
        OK();
        window.close();
    } catch (e) {
        log.exception(e);
    }
}

function Pick_Icon(uri) {
    try {
        gCurrentURI = uri;
        document.getElementById('icon32').setAttribute('src', uri + "?size=32");
        document.getElementById('icon16').setAttribute('src', uri);
        var os_path = Components.classes["@activestate.com/koOsPath;1"].getService();
        document.getElementById('iconlabel').setAttribute('value', os_path.withoutExtension(ko.uriparse.baseName(uri)));
    } catch (e) {
        log.exception(e);
    }
}

function selectIconFamily(event) {
    var selected = document.getElementById('icon-families').selectedItem;
    document.getElementById('iframe').setAttribute('src', selected.getAttribute('src'));
    gIframe = gImgList = null;
    // The iframe load eventListener will update filtering,
    // so there's nothing else to do here.
}

/**
 * Work around the iframe not showing the HTML img "title" tooltip, manually
 * creates and shows a tooltip for the HTML element when it has the "title"
 * attribute set.
 */
function FillInHTMLTooltip(tipElement) {
    // This FillInHTMLTooltip code comes from Mozilla forum:
    //   http://forums.mozillazine.org/viewtopic.php?f=19&t=561451
    var retVal = false;
    if (tipElement.namespaceURI == "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul") {
        return retVal;
    }
    const XLinkNS = "http://www.w3.org/1999/xlink";
    var titleText = null;
    var XLinkTitleText = null;
    while (!titleText && !XLinkTitleText && tipElement) {
        if (tipElement.nodeType == Node.ELEMENT_NODE) {
            titleText = tipElement.getAttribute("title");
            if (!titleText) {
                // Try the alt attribute then.
                titleText = tipElement.getAttribute("alt");
                if (!titleText) {
                    // Try the basename of the src attribute then.
                    titleText = tipElement.getAttribute("src");
                    if (titleText) {
                        titleText = titleText.split("/");
                        titleText = titleText[titleText.length - 1];
                    }
                }
            }
            XLinkTitleText = tipElement.getAttributeNS(XLinkNS, "title");
        }
        tipElement = tipElement.parentNode;
    }
    var texts = [titleText, XLinkTitleText];
    var tipNode = document.getElementById("aHTMLTooltip");
    for (var i = 0; i < texts.length; ++i) {
        var t = texts[i];
        if (t && t.search(/\S/) >= 0) {
            tipNode.setAttribute("label", t.replace(/\s+/g, " "));
            retVal = true;
        }
    }
    return retVal;
}

function OK()
{
    if ( ! obj.value)
    {
        obj.value = gCurrentURI;
        obj.retval = "OK";
    }
    var menulist = document.getElementById("icon-families");
    menulist.setAttribute("lastSelectedIndex", menulist.selectedIndex);
    return true;
}

function Reset()
{
    obj.value = "reset";
    obj.retval = "OK";
    document.getElementById('dialog-iconpicker').acceptDialog();
}

function PickCustom()
{
    var prefName = "iconPicker.PickCustom";
    var default_dir = ko.filepicker.internDefaultDir(prefName);
    var path = ko.filepicker.browseForFile(default_dir, null, bundle.GetStringFromName("Select an Icon File"),
                                   'Icon', ['Icon', 'All']);
    if (!path) return;
    ko.filepicker.updateDefaultDirFromPath(prefName, path);
    Pick_Icon(ko.uriparse.localPathToURI(path));
}

function Cancel()
{
    obj.retval = "Cancel";
    return true;
}

var getLastPart_RE = /([^/]+?)(?:\.[^\.\/]+)?$/;
function doUpdateFilter(s) {
    if (!gIframe) {
        // Just index the current list of words. We can index each
        // set of words for each iframe if it comes to that, but I
        // assume most people will stick with one set of icons for
        // consistency.
        gIframe = document.getElementById("iframe");
        gImgList = Array.slice(gIframe.contentDocument.getElementsByTagName("img"));
        gWordList = [];
        gWordIndex = {};
        var lim = gImgList.length;
        for (var i = 0; i < lim; i++) {
            var word = gImgList[i].getAttribute('src').match(getLastPart_RE)[1];
            gWordList.push(word);
            gWordIndex[word] = i;
        }
    }
    if (!s) {
        gImgList.forEach(function(elt) elt.classList.remove("hide"));
        return;
    }
    // Mark everything to hide and then reveal only the hits.
    gImgList.forEach(function(elt) elt.classList.add("hide"));
    s = s.toLowerCase();
    var matchedWords = gWordList.filter(function(word) word.indexOf(s) >= 0);
    matchedWords.forEach(function(hitWord) {
            gImgList[gWordIndex[hitWord]].classList.remove("hide");
        });
}
