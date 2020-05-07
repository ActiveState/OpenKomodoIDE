/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

if (typeof(ko)=='undefined') {
    var ko = {};
}
if (typeof(ko.projects)=='undefined') {
    ko.projects = {};
}

(function() {

var log = ko.logging.getLogger('pePrintdebug');

var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                .getService(Components.interfaces.nsIStringBundleService)
                .createBundle("chrome://komodo/locale/library.properties");



function pePrintdebug() {
    this.name = 'pePrintdebug';
}
pePrintdebug.prototype.constructor = pePrintdebug;
pePrintdebug.prototype.init = function() {
}

pePrintdebug.prototype.registerCommands = function() {}
pePrintdebug.prototype.registerEventHandlers = function() {}
pePrintdebug.prototype.registerMenus = function() {}
// this is hidden away now, no namespce, the registration keeps the reference
// we need
ko.projects.registerExtension(new pePrintdebug());

this.printdebugProperties = function printdebug_editProperties (item)
{
    var obj = {};
    obj.item = item;
    obj.task = 'edit';
    window.openDialog(
        "chrome://komodo/content/project/printdebugProperties.xul",
        "Komodo:PrintdebugProperties"+Date.now(),
        "chrome,close=yes,dependent=no,resizable=yes,centerscreen",
        obj);
}

this.addPrintdebug = function pePrintdebug_addPrintdebug(/*koIPart|koITool*/ parent,
                                                /*koIPart|koITool*/ printdebug )
{
    if (typeof(printdebug) == "undefined") {
        printdebug = ko.toolbox2.createPartFromType('printdebug');
    }
    printdebug.setStringAttribute('name', 'New Printdebug');
    printdebug.setStringAttribute('logic', '');
    printdebug.setStringAttribute('active', true);
    printdebug.setStringAttribute('treat_as_ejs', true);
    printdebug.setStringAttribute('language', "");
    printdebug.setStringAttribute('value', "");
    var obj = new Object();
    obj.item = printdebug;
    if (typeof(parent)=='undefined' || !parent)
        parent = ko.projects.active.getSelectedItem();
    obj.parentitem = parent;
    obj.active = ko.projects.active;
    obj.task = 'new';
    ko.windowManager.openOrFocusDialog(
        "chrome://komodo/content/project/printdebugProperties.xul",
        "komodo_printdebugProperties",
        "chrome,close=yes,dependent=no,resizable=yes,centerscreen",
        obj);
}

this.printdebugInsert = function Printdebug_insert (printdebug) { // a part
    /// ####  Wrap logic lines in <% %> for EJS evaluation if needed
    //var tmpLogicArray = printdebug.getStringAttribute("logic").split("\n");
    //for (let i in tmpLogicArray)
    //{
    //    if(tmpLogicArray[i].indexOf("<%") == -1)
    //    {
    //        tmpLogicArray[i] = "<% "+tmpLogicArray[i]+" %>";
    //    }
    //}
    //printdebug.setStringAttribute("logic", tmpLogicArray.join("\n"));
    // prepend logic to value
    var savedValue = printdebug.value;
    printdebug.value = "<% "+printdebug.getStringAttribute("logic")+" %>"+printdebug.value;
    var view = require("ko/views").current().get();
    if (!view || view.getAttribute('type') != 'editor') return;
    var scimoz = view.scimoz;
    
    ko.tabstops.clearTabstopInfo(view); // could call endUndoAction() if there are active links
    scimoz.beginUndoAction();
    var lastErrorSvc = Components.classes["@activestate.com/koLastErrorService;1"].
                        getService(Components.interfaces.koILastErrorService);
    var enteredUndoableTabstop = false;
    try
    {
        try
        {
            enteredUndoableTabstop = ko.projects.snippetInsertImpl(printdebug, view, true);
        }
        catch (ex if ex instanceof ko.snippets.RejectedSnippet)
        {
            let msg;
            if (ex.message) {
                msg = _bundle.formatStringFromName("printdebug X insertion deliberately suppressed with reason", [printdebug.name, ex.message], 2);
            } else {
                msg = _bundle.formatStringFromName("printdebug X insertion deliberately suppressed", [printdebug.name], 1);
            }
            require("notify/notify").send(msg, "tools", {priority: "warning"});
        } catch (ex) {
            var errno = lastErrorSvc.getLastErrorCode();
            if (errno == Components.results.NS_ERROR_ABORT) {
                // Command was cancelled.
            } else if (errno == Components.results.NS_ERROR_INVALID_ARG) {
                var errmsg = lastErrorSvc.getLastErrorMessage();
                ko.dialogs.alert("Error inserting printdebug: " + errmsg);
            } else {
                log.exception(ex, "Error with printdebug");
                ko.dialogs.internalError(ex, "Error inserting printdebug");
            }
        }
    } finally {
        ko.macros.recordPartInvocation(printdebug);
        if (!enteredUndoableTabstop) {
            scimoz.endUndoAction();
        }
        printdebug.value = savedValue;
    }
};

}).apply(ko.projects);
