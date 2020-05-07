/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

if (typeof(ko)=='undefined') {
    var ko = {};
}
if (typeof(ko.projects)=='undefined') {
    ko.projects = {};
}

(function() {
var _log = ko.logging.getLogger('peURL');

this.URLProperties = function peURL_editProperties(/*koIPart*/ item)
{
    var obj = new Object();
    obj.item = item;
    obj.task = 'edit';
    obj.imgsrc = 'chrome://komodo/skin/images/xlink.png';
    obj.type = 'url';
    obj.prettytype = 'URL';
    window.openDialog(
        "chrome://komodo/content/project/simplePartProperties.xul",
        "Komodo:URLProperties"+Date.now(),
        "chrome,centerscreen,close=yes,dependent=yes,modal=yes,resizable=yes", obj);
}

this.addURLFromText = function peURL_addURL(URLtext, /*koITool*/ parent) {
    if (typeof(parent) == 'undefined' || !parent)
        parent = ko.toolbox2.getStandardToolbox();
    try {
        var uriTool = ko.toolbox2.createPartFromType('URL');
        uriTool.type = 'URL';
        var name = URLtext;
        var value = URLtext;
        if (URLtext.search("\n")) {
            var s = URLtext.split("\n");
            name = typeof(s[1])!='undefined'?s[1]:s[0];
            value = s[0];
        }
        uriTool.setStringAttribute('name', name);
        uriTool.value = value;
        ko.toolbox2.addItem(uriTool, parent);
        //dump("leaving AddURL\n");
    } catch (e) {
        _log.exception(e);
    }
}

this.addURL = function peURL_newURL(/*koIPart|koITool*/ parent,
                                    /*koIPart|koITool = null */ part )
{
    if (typeof(part) == "undefined") {
        part = parent.project.createPartFromType('snippet');
    }
    part.setStringAttribute('name', 'New URL');
    part.value = '';
    var obj = new Object();
    obj.item = part;
    obj.task = 'new';
    obj.imgsrc = 'chrome://komodo/skin/images/xlink.png';
    obj.type = 'url';
    obj.prettytype = 'URL';
    obj.parent = parent;
    window.openDialog(
        "chrome://komodo/content/project/simplePartProperties.xul",
        "Komodo:URLProperties"+Date.now(),
        "chrome,centerscreen,close=yes,modal=yes,resizable=yes", obj);
}

}).apply(ko.projects);
