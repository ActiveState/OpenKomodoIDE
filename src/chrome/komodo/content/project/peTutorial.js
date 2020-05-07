/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

if (typeof(ko)=='undefined') {
    var ko = {};
}
if (typeof(ko.projects)=='undefined') {
    ko.projects = {};
}

try {
(
    function() { // ko.projects
        //Components.utils.reportError("adding tutorial");
        var log = require('ko/logging').getLogger("Toolbox: Tutorial");
        
        // Open a new tutorial dialog 
        this.addTutorial = function addTutorial(/*koIPart|koITool*/ parent,
                                                  /*koIPart|koITool*/ part )
        {
            if (typeof(part) == "undefined") {
                part = parent.project.createPartFromType('tutorial');
            }
            part.setStringAttribute('name', 'New Tutorial');
            var obj = new Object();
            obj.item = part;
            obj.parent = parent;
            obj.task = 'new';
            ko.windowManager.openOrFocusDialog(
                "chrome://komodo/content/project/tutorialProperties.xul",
                "Komodo:TutorialProperties",
                "chrome,centerscreen,close=yes,dependent=no,resizable=yes",
                obj);
        }
        
        // Open an existing tutorial dialog
        this.tutorialProperties = function tutorialProperties(item)
        {
            var obj = {item : item,
                    task : 'edit',
                    imgsrc : 'chrome://komodo/skin/images/macro.png'};
            window.openDialog(
                "chrome://komodo/content/project/tutorialProperties.xul",
                "Komodo:TutorialProperties"+Date.now(),
                "chrome,centerscreen,close=yes,dependent=no,resizable=yes",
                obj);
        }
    }
).apply(ko.projects);

} catch(e) {
    Components.utils.reportError(e);
}