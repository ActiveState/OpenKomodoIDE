/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

// The "command" project extension.
//
// This extension manages "run command" project entries.
//

if (typeof(ko)=='undefined') {
    var ko = {};
}
if (typeof(ko.projects)=='undefined') {
    ko.projects = {};
}

(function() {

this.commandProperties = function command_editProperties(item)
{
    var obj = new Object();
    obj.part = item;
    window.openDialog(
        "chrome://komodo/content/run/commandproperties.xul",
        "Komodo:CommandProperties"+Date.now(),
        "chrome,close=yes,dependent=yes,modal=yes,centerscreen",
        obj);
}

this.runCommand = function Run_CommandPart(cmdPart) {
    ko.run.command(cmdPart.value,
                   {
                        "cwd": cmdPart.getStringAttribute("cwd"),
                        "env": ko.stringutils.unescapeWhitespace(cmdPart.getStringAttribute("env"), '\n'),
                        "insertOutput": cmdPart.getBooleanAttribute("insertOutput"),
                        "operateOnSelection": cmdPart.getBooleanAttribute("operateOnSelection"),
                        "openOutputWindow": !(cmdPart.getBooleanAttribute("doNotOpenOutputWindow")),
                        "runIn": cmdPart.getStringAttribute("runIn"),
                        "name": cmdPart.getStringAttribute("name"),
                        "parseRegex": cmdPart.getStringAttribute("parseRegex"),
                        "saveInMacro": false,
                        "viewData": { "prefSet": cmdPart.prefset },
                   });
    ko.macros.recordPartInvocation(cmdPart);
}

}).apply(ko.projects);
