/* Copyright (c) 2000-2011 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

var prefElems = {};
const $ = require("ko/dom").window(window);
const w = require("ko/windows").getMain();
const l = require("ko/locale").use("chrome://codeintel/locale/codeintel.properties");
const legacy = require("ko/windows").getMain().ko;
var catalogsPrefSet = parent.hPrefWindow.prefset.getPref('codeintel.catalogs');
var log = require("ko/logging").getLogger("prefs-codeintel3");
//log.setLevel(ko.logging.LOG_DEBUG);

var restartOnChange = [
    "completionsCheck", "calltipsCheck", "symbollistCheck", "symbolBrowserCheck",
    "scannerCheck", "gotodefCheck", "jumpsectionsCheck", "findreferencesCheck"
];
 
var initialValues = [];

function OnPreferencePageOK(prefset)
{
    let selectedCatalogs = prefElems.catalogListbox.getSelectedItems();
    //Reset the loaded catalogs pref and rebuild from selected
    w.ko.prefs.deletePref("codeintel.catalogs.loaded");
    let loadedCatalogsPref = Components.classes['@activestate.com/koPreferenceSet;1'].createInstance();
    parent.hPrefWindow.prefset.setPref("codeintel.catalogs.loaded", loadedCatalogsPref);
    for(let catItem of selectedCatalogs)
    { 
        if (catalogsPrefSet.hasPref(catItem.value))
        {
            let pref = Components.classes['@activestate.com/koPreferenceSet;1'].createInstance();
            loadedCatalogsPref.setPref(catItem.value, pref);
        }
    }
    parent.hPrefWindow.prefset.setBoolean('codeintel.completions.enabled', prefElems.completionsCheck.checked());
    parent.hPrefWindow.prefset.setBoolean('codeintel.calltips.enabled', prefElems.calltipsCheck.checked());
    parent.hPrefWindow.prefset.setBoolean('codeintel.symbollist.enabled', prefElems.symbollistCheck.checked());
    parent.hPrefWindow.prefset.setBoolean('codeintel.symbolbrowser.enabled', prefElems.symbolBrowserCheck.checked());
    parent.hPrefWindow.prefset.setBoolean('codeintel.scanner.enabled', prefElems.scannerCheck.checked());
    parent.hPrefWindow.prefset.setBoolean('codeintel.gotodef.enabled', prefElems.gotodefCheck.checked());
    parent.hPrefWindow.prefset.setBoolean('codeintel.jumpsections.enabled', prefElems.jumpsectionsCheck.checked());
    parent.hPrefWindow.prefset.setBoolean('codeintel.findreferences.enabled', prefElems.findreferencesCheck.checked());
    
    parent.hPrefWindow.prefset.setBoolean('codeintel.completions.while_typing', prefElems.completeWhileTyping.checked());
    parent.hPrefWindow.prefset.setBoolean('codeintel.completions.show_matches', prefElems.completionsShowMatches.checked());
    parent.hPrefWindow.prefset.setBoolean('codeintel.calltips.while_typing', prefElems.calltipWhileTyping.checked());
    parent.hPrefWindow.prefset.setLong('codeintel.scanner.max_depth', prefElems.maxDepth.value());
    parent.hPrefWindow.prefset.setLong('codeintel.scanner.max_implicit', prefElems.maxImplicit.value());
    parent.hPrefWindow.prefset.setBoolean('codeintel.scanner.prompt', prefElems.scannerPrompt.checked());
    parent.hPrefWindow.prefset.setBoolean('refactoring.renameVariable_in_strings', prefElems.renameInStringsCheck.checked());
    parent.hPrefWindow.prefset.setBoolean('refactoring.renameVariable_in_comments', prefElems.renameInCommentsCheck.checked());


    var effectiveValues = [];
    for (let el of restartOnChange)
    {
        effectiveValues.push(prefElems[el].checked());
    }

    if (initialValues.join() != effectiveValues.join())
    {
        var msg = l.get("pref.restart");
        var opts = {
            yes: "Yes",
            no: "No",
        };
        if (require("ko/dialogs").confirm(msg, opts))
        {
            require("sdk/timers").setTimeout(()=>
            {
                legacy.utils.restart(true);
            }, 200);
        }
    }
    return true;
}


function PrefCodeintel_OnLoad()
{
    loadCodeintelElems();
    
        for (let el of restartOnChange)
        {
            initialValues.push(prefElems[el].checked());
        }
 
    parent.hPrefWindow.onpageload();
}

function loadCodeintelElems()
{
   
    prefElems.codeintelBox = require("ko/ui/groupbox").create({caption: l.get("prefs.group.features")});
    
    prefElems.completionsCheck = require("ko/ui/checkbox").create(l.get("prefs.enable_completions"));
    prefElems.completionsCheck.checked(parent.hPrefWindow.prefset.getBoolean('codeintel.completions.enabled'));
    prefElems.codeintelBox.addRow(prefElems.completionsCheck);
 
    var updateCompletionStatus = () =>
    {
        if (prefElems.completionsCheck.checked())
            prefElems.completeWhileTyping.enable();
        else
            prefElems.completeWhileTyping.disable();
    };
    prefElems.completionsCheck.on("command", updateCompletionStatus);
 
    prefElems.calltipsCheck = require("ko/ui/checkbox").create(l.get("prefs.enable_calltips"));
    prefElems.calltipsCheck.checked(parent.hPrefWindow.prefset.getBoolean('codeintel.calltips.enabled'));
    prefElems.codeintelBox.addRow([prefElems.calltipsText, prefElems.calltipsCheck]);
 
    var updateCalltipStatus = () =>
    {
        if (prefElems.calltipsCheck.checked())
            prefElems.calltipWhileTyping.enable();
        else
            prefElems.calltipWhileTyping.disable();
    };
    prefElems.calltipsCheck.on("command", updateCalltipStatus);
    
    prefElems.symbollistCheck = require("ko/ui/checkbox").create(l.get("prefs.enable_symbollist"));
    prefElems.symbollistCheck.checked(parent.hPrefWindow.prefset.getBoolean('codeintel.symbollist.enabled'));
    prefElems.codeintelBox.addRow(prefElems.symbollistCheck);
    
    prefElems.symbolBrowserCheck = require("ko/ui/checkbox").create(l.get("prefs.enable_symbolbrowser"));
    prefElems.symbolBrowserCheck.checked(parent.hPrefWindow.prefset.getBoolean('codeintel.symbolbrowser.enabled'));
    prefElems.codeintelBox.addRow(prefElems.symbolBrowserCheck);
 
    prefElems.scannerCheck = require("ko/ui/checkbox").create(l.get("prefs.enable_scanner"));
    prefElems.scannerCheck.checked(parent.hPrefWindow.prefset.getBoolean('codeintel.scanner.enabled'));
    prefElems.codeintelBox.addRow(prefElems.scannerCheck);
 
    prefElems.gotodefCheck = require("ko/ui/checkbox").create(l.get("prefs.enable_gotodef"));
    prefElems.gotodefCheck.checked(parent.hPrefWindow.prefset.getBoolean('codeintel.gotodef.enabled'));
    prefElems.codeintelBox.addRow(prefElems.gotodefCheck);
 
    prefElems.jumpsectionsCheck = require("ko/ui/checkbox").create(l.get("prefs.enable_jumpsections"));
    prefElems.jumpsectionsCheck.checked(parent.hPrefWindow.prefset.getBoolean('codeintel.jumpsections.enabled'));
    prefElems.codeintelBox.addRow(prefElems.jumpsectionsCheck);
 
    prefElems.findreferencesCheck = require("ko/ui/checkbox").create(l.get("prefs.enable_findreferences"));
    prefElems.findreferencesCheck.checked(parent.hPrefWindow.prefset.getBoolean('codeintel.findreferences.enabled'));
    prefElems.codeintelBox.addRow(prefElems.findreferencesCheck);
    
    // Scanning
    prefElems.scanningBox = require("ko/ui/groupbox").create({caption: l.get("prefs.group.scanning")});
 
    prefElems.maxDepthLabel = require("ko/ui/label").create(l.get("prefs.max_depth"));
    prefElems.maxDepth = require("ko/ui/textbox").create({ type: "number", size: 2 });
    prefElems.maxDepth.value(parent.hPrefWindow.prefset.getLong('codeintel.scanner.max_depth'));
    prefElems.scanningBox.addRow([prefElems.maxDepthLabel, prefElems.maxDepth], { align: "center" });
 
    prefElems.maxImplicitLabel = require("ko/ui/label").create(l.get("prefs.max_implicit"));
    prefElems.maxImplicit = require("ko/ui/textbox").create({ type: "number", size: 4 });
    prefElems.maxImplicit.value(parent.hPrefWindow.prefset.getLong('codeintel.scanner.max_implicit'));
    prefElems.scanningBox.addRow([prefElems.maxImplicitLabel, prefElems.maxImplicit], { align: "center" });
 
    prefElems.scannerPrompt = require("ko/ui/checkbox").create(l.get("prefs.prompt"));
    prefElems.scannerPrompt.checked(parent.hPrefWindow.prefset.getBoolean('codeintel.scanner.prompt'));
    prefElems.scanningBox.addRow(prefElems.scannerPrompt);
 
    // Editing
    prefElems.editingBox = require("ko/ui/groupbox").create({caption: l.get("prefs.group.editing")});
 
    prefElems.completeWhileTyping = require("ko/ui/checkbox").create(l.get("prefs.complete_while_typing"));
    prefElems.completeWhileTyping.checked(parent.hPrefWindow.prefset.getBoolean('codeintel.completions.while_typing'));
    prefElems.editingBox.addRow(prefElems.completeWhileTyping);
    updateCompletionStatus();
 
    prefElems.completionsShowMatches = require("ko/ui/checkbox").create(l.get("prefs.complete_show_matches"));
    prefElems.completionsShowMatches.checked(parent.hPrefWindow.prefset.getBoolean('codeintel.completions.show_matches'));
    prefElems.editingBox.addRow(prefElems.completionsShowMatches);
 
    prefElems.calltipWhileTyping = require("ko/ui/checkbox").create(l.get("prefs.calltip_while_typing"));
    prefElems.calltipWhileTyping.checked(parent.hPrefWindow.prefset.getBoolean('codeintel.calltips.while_typing'));
    prefElems.editingBox.addRow(prefElems.calltipWhileTyping);
    updateCalltipStatus();
 
    // Refactoring
    
    prefElems.refactoringBox = require("ko/ui/groupbox").create({caption: l.get("prefs.group.refactoring")});
 
    prefElems.renameInStringsCheck = require("ko/ui/checkbox").create(l.get("prefs.regex.rename_in_string"));
    prefElems.renameInStringsCheck.checked(parent.hPrefWindow.prefset.getBoolean('refactoring.renameVariable_in_strings'));
    prefElems.refactoringBox.addRow(prefElems.renameInStringsCheck);
 
    prefElems.renameInCommentsCheck = require("ko/ui/checkbox").create(l.get("prefs.regex.rename_in_comments"));
    prefElems.renameInCommentsCheck.checked(parent.hPrefWindow.prefset.getBoolean('refactoring.renameVariable_in_comments'));
    prefElems.refactoringBox.addRow(prefElems.renameInCommentsCheck);
    
    // Catalogs
    prefElems.catalogBox = require("ko/ui/groupbox").create({
        caption: l.get("prefs.group.refactoring")
    });
    prefElems.catalogBox.addRow(
        require("ko/ui/description").create({attributes: {value:l.get("pref.catalog.help")}})
    );
    prefElems.catalogListbox = require("ko/ui/listbox").create({attributes: { seltype: "multiple", flex: 1 }});
    prefElems.catalogBox.addRow(prefElems.catalogListbox);
    prefElems.catalogListbox.addListHeaders(['Catalog', 'Language', 'Description']);
    prefElems.catalogListbox.addListCols(['', '', '']);

 
    $("#codeintel-prefs-vbox").append(prefElems.codeintelBox.element);
    $("#codeintel-prefs-vbox").append(prefElems.scanningBox.element);
    $("#codeintel-prefs-vbox").append(prefElems.editingBox.element);
    $("#codeintel-prefs-vbox").append(prefElems.refactoringBox.element);
    $("#codeintel-prefs-vbox").append(prefElems.catalogBox.element);
    loadCatalogs();
}

function loadCatalogs()
{
    let ids = catalogsPrefSet.getPrefIds();
    let loadedCatalogs;
    if(parent.hPrefWindow.prefset.hasPref("codeintel.catalogs.loaded"))
    {
        loadedCatalogs = parent.hPrefWindow.prefset.getPref("codeintel.catalogs.loaded").getPrefIds();
    }
    
    // Some prefs shadowing issue maybe.  Can't seem to get the codeintel.catalog
    // prefs from the installdir prefs file so check and load directly from there
    // is we have nothing.
    if (ids.length == 0)
    {
        catalogsPrefSet = parent.hPrefWindow.prefset.parent.getPref('codeintel.catalogs');
    }
    ids = catalogsPrefSet.getPrefIds();
    for(let id of ids)
    {   
        let catalog = catalogsPrefSet.getPref(id);
        let listitem = require("ko/ui/listitem").create({ attributes: { value: catalog.getStringPref("name") } });
        listitem.addListCell(catalog.getStringPref("name"));
        listitem.addListCell(catalog.getStringPref("lang"));
        listitem.addListCell({ attributes:{ label: catalog.getStringPref("desc"), crop:"end"}});
        prefElems.catalogListbox.addListItem(listitem);
        if(loadedCatalogs && loadedCatalogs.indexOf(id) >= 0)
            setTimeout(()=>{prefElems.catalogListbox.element.addItemToSelection(listitem.element);},0);
    }
}