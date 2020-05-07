/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

// Constants and global variables

var log = ko.logging.getLogger("pdk");
var osPathService = Components.classes["@activestate.com/koOsPath;1"]
            .getService(Components.interfaces.koIOsPath);
var osService = Components.classes["@activestate.com/koOs;1"]
            .getService(Components.interfaces.koIOs);
var sysUtils = Components.classes['@activestate.com/koSysUtils;1']
            .getService(Components.interfaces.koISysUtils);

var hPrefWindow = null;
var globalPrefSvc = Components.classes["@activestate.com/koPrefService;1"].getService(Components.interfaces.koIPrefService);
var sysDataSvc = Components.classes["@activestate.com/koSystemDataService;1"]
                 .getService(Components.interfaces.koISystemDataService);
var infoSvc = Components.classes["@activestate.com/koInfoService;1"].getService(Components.interfaces.koIInfoService);
var effectivePrefs = null;
var _gObserverSvc = null;
var commandGenerators = Array(getScriptnameCommand,
                              getTargetCommand, getDebuggingCommand,
                              getDependenciesCommand, forceCommand,
                              generateVerboseCommand,
                              generateHideConsoleCommand, generateCleanCommand,
                              generateExtraModulesCommand,
                              generateTrimModulesCommand,
                              generateFilesCommand, generateVersionInfoCommand,
                              generateLibsCommand, generateBlibsCommand,
                              generateIconsCommand,
                              generateHacksCommand);

var gVersionInfo = new Array(
   { 'userName' : 'Internal name', 'fieldName' : 'internalname', 'description' : 'Specify the internal name of the script, if one exists e.g. MyScript.pl' },
   { 'userName' : 'Original filename', 'fieldName' : 'originalfilename', 'description' : 'Specify the original name of the script, not including a path.' },
   { 'userName' : 'Company name', 'fieldName' : 'companyname', 'description' : 'Specify the company that produced the script e.g. ActiveState Software Inc' },
   { 'userName' : 'Product name', 'fieldName' : 'productname', 'description' : 'Specify the name of the product with which the script is distributed e.g. Komodo' },
   { 'userName' : 'Binary file version', 'fieldName' : 'filenumber', 'description' : 'Specify the binary version number of the script, must in be in form number.number.number.number e.g. 12.3.2.1' },
   { 'userName' : 'Comments', 'fieldName' : 'comments', 'description' : 'Specify additional information that should be displayed for diagnostic purposes' },
   { 'userName' : 'Binary product version', 'fieldName' : 'productnumber', 'description' : 'Specify the binary version number of the product with which the script is distributed, must in be in form number.number.number.number e.g. 1.0.2.1' },
   { 'userName' : 'Legal trademarks', 'fieldName' : 'legaltrademarks', 'description' : 'Specify all trademarks and registered trademarks that apply to the script' },
   { 'userName' : 'File version', 'fieldName' : 'fileversion', 'description' : 'Specify the version number of the script e.g. "1.23"' },
   { 'userName' : 'Product version', 'fieldName' : 'productversion', 'description' : 'Specify the version number of the product with which the script is distributed e.g. "1.23 Beta"'},
   { 'userName' : 'File description', 'fieldName' : 'filedescription', 'description' : 'Specify a description of the script that is presented to the uset e.g. Perl application for analysing sales data' },
   { 'userName' : 'Legal copyright', 'fieldName' : 'legalcopyright', 'description' : 'Specify all copyright notices that apply to the script e.g. Copyright (C) 2006 ActiveState Software Inc' }
);

var gFiles= new Array();
var gIcons= new Array();
var gLibs= new Array();
var gBlibs= new Array();
var gExtraModules = new Array();
var gTrimModules = new Array();
var dialog = {};

var gOptions = new Array();
gOptions['app'] = new Array();

gOptions['app']['3.1'] = {
    "add" : "-add=",
    "bind" : "-bind=",
    "clean" : "-clean",
    "debug" : "-debug=",
    "dependent" : "",
    "exclude" : "-xclude",
    "exe" : "-exe=",
    "freestanding" : "-freestanding",
    "gui" : "-gui",
    "info" : "-info=",
    "report" : "-report",
    "script" : "-script=",
    "verbose" : "-verbose"
};
gOptions['app']['4'] = {
    "add" : "--add",
    "bind" : "--bind",
    "blib" : "--blib",
    "clean" : "--clean",
    "debug" : "--debug",
    "dependent" : "--dependent",
    "exclude" : "--xclude",
    "exe" : "--exe",
    "explain" : "--explain",
    "force" : "--force",
    "freestanding" : "--freestanding",
    "gui" : "--gui",
    "icon" : "--icon",
    "info" : "--info",
    "lib" : "--lib",
    "nocompress" : "--nocompress",
    "nologo" : "--nologo",
    "tmpdir" : "--tmpdir",
    "trim" : "--trim",
    "script" : "",
    "verbose" : "--verbose",
    "version" : "--version"
};
gOptions['app']['4.1'] = gOptions['app']['4'];
gOptions['app']['5'] = gOptions['app']['4.1'];

gOptions['ctrl'] = new Array();
gOptions['ctrl']['3.1'] = {
    "add" : "-add=",
    "bind" : "-bind=",
    "clean" : "-clean",
    "debug" : "-debug=",
    "exclude" : "-xclude",
    "exe" : "-exe=",
    "freestanding" : "-freestanding",
    "info" : "-info=",
    "nodeps" : "-nodeps",
    "report" : "-report",
    "script" : "-script=",
    "template" : "-template",
    "verbose" : "-verbose"
};
gOptions['ctrl']['4'] = {
    "add" : "--add",
    "bind" : "--bind",
    "blib" : "--blib",
    "clean" : "--clean",
    "debug" : "--debug",
    "dependent" : "--dependent",
    "exclude" : "--xclude",
    "exe" : "--exe",
    "explain" : "--explain",
    "force" : "--force",
    "freestanding" : "--freestanding",
    "icon" : "--icon",
    "info" : "--info",
    "lib" : "--lib",
    "nocompress" : "--nocompress",
    "nologo" : "--nologo",
    "template" : "--template",
    "tmpdir" : "--tmpdir",
    "trim" : "--trim",
    "script" : "",
    "verbose" : "--verbose",
    "version" : "--version"
};
gOptions['ctrl']['4.1'] = gOptions['ctrl']['4'];
gOptions['ctrl']['5'] = gOptions['ctrl']['4.1'];

gOptions['svc'] = new Array();
gOptions['svc']['3.1'] = gOptions['app']['3.1'];
gOptions['svc']['3.1']['gui'] = '';
gOptions['svc']['4'] = gOptions['svc']['3.1']; // unchanged
gOptions['svc']['4.1'] = {
    "add" : "--add",
    "bind" : "--bind",
    "blib" : "--blib",
    "clean" : "--clean",
    "debug" : "--debug",
    "dependent" : "--dependent",
    "exclude" : "--xclude",
    "exe" : "--exe",
    "explain" : "--explain",
    "force" : "--force",
    "freestanding" : "--freestanding",
    "help" : "--help",
    "icon" : "--icon",
    "info" : "--info",
    "lib" : "--lib",
    "nocompress" : "--nocompress",
    "nologo" : "--nologo",
    "tmpdir" : "--tmpdir",
    "trim" : "--trim",
    "verbose" : "--verbose"
};
gOptions['svc']['4.1']['gui'] = '';
gOptions['svc']['5'] = gOptions['svc']['4.1'];

gOptions['net'] = new Array();
gOptions['net']['4'] = gOptions['app']['4'];
gOptions['net']['5'] = gOptions['net']['4'];
gOptions['tray'] = new Array();
gOptions['tray']['5'] = gOptions['app']['5'];

var pdkLastVersion = 5.0;
var pdkVersion;
var gCurrentOpts = null;
var _gPDKObserver = null;
var _gLastDebuggerLaunchFromPDKDialog = false;

function getOption(name) {
    if (!gCurrentOpts || typeof(gCurrentOpts) == "undefined") {
        var selecteditem = getPDKType();
        gCurrentOpts = gOptions[selecteditem][pdkVersion];
    }
    if (typeof(gCurrentOpts[name]) != 'undefined') {
        return gCurrentOpts[name];
    }
    return '';
}

var gIconsView;
var gLibsView;
var gBlibsView;
var gDirname = '';
var gMainWindow = null;
var gDBG_Manager = null;

function onPerlAppLoad() {
    try {
        gMainWindow = ko.windowManager.getMainWindow();
        gDBG_Manager = Components.classes["@activestate.com/koDBGPManager;1"].
               getService(Components.interfaces.koIDBGPManager);
        var view = gMainWindow.ko.views.manager.currentView;
        var i, obj;
        pdkVersion = Math.min(window.arguments[0], pdkLastVersion);

        gIconsView = new FileOptionsView();
        gIconsView.datastructure = gIcons;
        gIconsView.deleteBtn = document.getElementById('deleteIcon');
        gIconsView.selectionChanged();
        gLibsView = new FileOptionsView();
        gLibsView.datastructure = gLibs;
        gLibsView.deleteBtn = document.getElementById('deleteLib');
        gLibsView.selectionChanged();
        gBlibsView = new FileOptionsView();
        gBlibsView.datastructure = gBlibs;
        gBlibsView.deleteBtn = document.getElementById('deleteBlib');
        gBlibsView.selectionChanged();

        dialog.scriptname = document.getElementById('scriptname');
        dialog.buildBtn = document.getElementById('buildBtn');
        dialog.applyBtn = document.getElementById('applyBtn');
        dialog.debugBtn = document.getElementById('debugBtn');
        dialog.addToToolboxBtn= document.getElementById('addToToolboxBtn');
        dialog.statuslabel = document.getElementById('status');

    // #if PLATFORM == "win"
        dialog.pdkTypeMenu = document.getElementById('pdkType');
    // #endif
        dialog.targetname = document.getElementById('targetname');
        dialog.dependenciesMenu = document.getElementById('dependencies');
        dialog.debuggingMenu = document.getElementById('debugging');

        dialog.verbose = document.getElementById('verbose');
        dialog.hideConsole = document.getElementById('hideConsole');
        dialog.clean = document.getElementById('clean');
        dialog.force = document.getElementById('forceOverwrite');

        dialog.hostname = document.getElementById('hostname');
        dialog.port = document.getElementById('port');

        dialog.extraModules = document.getElementById('extraModules');
        dialog.moduleName = document.getElementById('moduleName');
        dialog.trimmoduleName = document.getElementById('trimmoduleName');
        dialog.addModule = document.getElementById('addModule');
        dialog.deleteModule = document.getElementById('deleteModule');
        document.getElementById('extraModules').view = gExtraModulesView;

        dialog.addTrimModule = document.getElementById('addTrimModule');
        dialog.deleteTrimModule = document.getElementById('deleteTrimModule');
        document.getElementById('trimModules').view = gTrimModulesView;

        dialog.versionFieldPrompt = document.getElementById('versionFieldPrompt');

        dialog.dataFiles = document.getElementById('dataFiles');
        dialog.addFile = document.getElementById('addFile');
        dialog.editFile = document.getElementById('editFile');
        dialog.deleteFile = document.getElementById('deleteFile');
        document.getElementById('dataFiles').view = gFilesView;

        document.getElementById('versionInfo').view = gVersionInfoView;
        dialog.updateVersionField = document.getElementById('updateVersionField');
        dialog.clearVersionField = document.getElementById('clearVersionField');
        dialog.versionInfoValue = document.getElementById('versionInfoValue');

        document.getElementById('libs').view = gLibsView;
        document.getElementById('blibs').view = gBlibsView;

        dialog.extras = document.getElementById('extras');

        dialog.icons = document.getElementById('icons');
        dialog.addIcon = document.getElementById('addIcon');
        dialog.deleteIcon = document.getElementById('deleteIcon');
        document.getElementById('icons').view = gIconsView;

        dialog.commandstring = document.getElementById('commandstring');
        // Recover the preference
        if (view) {
            effectivePrefs = view.koDoc.getEffectivePrefs();
        } else {
            // setup a temporary prefset to work with
            var effectivePrefs = Components.classes["@activestate.com/koPreferenceSet;1"]
                .createInstance(Components.interfaces.koIPreferenceSet);
            effectivePrefs.parent = globalPrefSvc.prefs;
        }
        var perlAppPrefSet = effectivePrefs.getPref('PDK');
        if (view && ! effectivePrefs.hasPrefHere("PDK")) {  // did they come from the parent?
            // we'll clone them and store those in the view.
            perlAppPrefSet = perlAppPrefSet.clone();
            perlAppPrefSet.id = "PDK";
            perlAppPrefSet.parent = effectivePrefs.getPref('PDK'); // inherit defaults
            effectivePrefs.setPref( perlAppPrefSet.id, perlAppPrefSet);
        }
        hPrefWindow = new koPrefWindow(null, perlAppPrefSet);
        if( !hPrefWindow )
            throw "failed to create prefwindow";
        hPrefWindow.onpageload();

        var extraModulesPref = perlAppPrefSet.getPref('extraModules').QueryInterface(Components.interfaces.koIOrderedPreference);
        for (i=0; i < extraModulesPref.length; ++i) {
            gExtraModules.push(extraModulesPref.getStringPref(i));
        }

        var trimModulesPref = perlAppPrefSet.getPref('trimModules').QueryInterface(Components.interfaces.koIOrderedPreference);
        for (i=0; i < trimModulesPref.length; ++i) {
            gTrimModules.push(trimModulesPref.getStringPref(i));
        }

        var libsPref = perlAppPrefSet.getPref('libs').QueryInterface(Components.interfaces.koIOrderedPreference);
        for (i=0; i < libsPref.length; ++i) {
            obj = new Object ();
            obj.path = libsPref.getStringPref(i);
            gLibs.push(obj);
        }

        var blibsPref = perlAppPrefSet.getPref('blibs').QueryInterface(Components.interfaces.koIOrderedPreference);
        for (i=0; i < blibsPref.length; ++i) {
            obj = new Object ();
            obj.path = blibsPref.getStringPref(i);
            gBlibs.push(obj);
        }

        var iconsPref = perlAppPrefSet.getPref('icons').QueryInterface(Components.interfaces.koIOrderedPreference);
        for (i=0; i < iconsPref.length; ++i) {
            obj = new Object ();
            obj.path = iconsPref.getStringPref(i);
            gIcons.push(obj);
        }

        dialog.extras.value = perlAppPrefSet.getStringPref('extras');

        var dataFilesPref = perlAppPrefSet.getPref('dataFiles').QueryInterface(Components.interfaces.koIOrderedPreference);
        var dataFile, dataPref;
        for (i=0; i < dataFilesPref.length; ++i) {
            dataFile = new Object();
            dataPref = dataFilesPref.getPref(i);
            dataFile.sourceFile = dataPref.getStringPref("sourceFile");
            dataFile.destinationFile = dataPref.getStringPref("destinationFile");
            gFiles.push(dataFile);
        }

        var versionInfoPref = perlAppPrefSet.getPref('versionInfo')
        for (i=0; i < gVersionInfo.length; ++i) {
            if (versionInfoPref.hasStringPref(gVersionInfo[i].fieldName)) {
                gVersionInfo[i].fieldValue = versionInfoPref.getStringPref(gVersionInfo[i].fieldName);
            }
            else {
                gVersionInfo[i].fieldValue = null;
            }
        }

        var url = '';
        if (view && view.koDoc.file.URI) {
            url = view.koDoc.file.URI;
            if (url.indexOf('file:') != 0) {
                log.exception("PDK can only be run on local files.");
                return;
            }
            try {
                var localFile = ko.uriparse.URIToLocalPath(url);
                dialog.scriptname.value = localFile;
            } catch (e) {
                log.exception(e);
                return;
            }
        }

// #if PLATFORM == "win"
        disableMissingItems();
// #endif

        changePDKType(false);
        changeDebuggingType(false);
        changeModuleName(false);

        gExtraModulesView.refresh();
        gExtraModulesView.selectionChanged();
        gTrimModulesView.refresh();
        gTrimModulesView.selectionChanged();
        gFilesView.selectionChanged();
        gFilesView.refresh();
        gLibsView.refresh();
        gLibsView.selectionChanged();
        gBlibsView.refresh();
        gBlibsView.selectionChanged();
        gIconsView.refresh();
        gIconsView.selectionChanged();
        gVersionInfoView.selection.select(0);
        gVersionInfoView.selectionChanged();

        updateCommandString();
    
        /* debugger_session_state_change gone: need another technique
        _gObserverSvc = Components.classes["@mozilla.org/observer-service;1"].
                       getService(Components.interfaces.nsIObserverService);
        _gPDKObserver = new _PDKObserver();
        _gObserverSvc.addObserver(_gPDKObserver, "debugger_session_state_change",false);
        */
    } catch (e) {
        log.exception(e);
    }
}

function onPerlAppUnload()  {
    try {
        //SaveWindowLocation();
    } catch (e) {
        log.exception(e);
    }
}

// #if PLATFORM == "win"
function disableMenuItem(id) {
    document.getElementById(id).setAttribute('disabled', 'true');
}

function disableMissingItems() {
    if (! sysDataSvc.getString('pdk.perlapp')) {
        disableMenuItem('app');
    }
    if (! sysDataSvc.getString('pdk.perlsvc')) {
        disableMenuItem('svc');
    }
    if (! sysDataSvc.getString('pdk.perlctrl')) {
        disableMenuItem('ctrl');
    }
    if (! sysDataSvc.getString('pdk.perlnet')) {
        disableMenuItem('net');
    }
    if (! sysDataSvc.getString('pdk.perltray')) {
        disableMenuItem('tray');
    }
}
// #endif


function getExtrasCommand() {
    if (dialog.extras.value) {
        return ' ' + dialog.extras.value
    }
    return '';
}

function getScriptnameCommand(insertAsk) {
    var commands = [];
    try {
        var arg;
        if (osPathService.basename(dialog.scriptname.value)) {
            commands.push('--script');
            var name = dialog.scriptname.value;
            if (name[0] != '\\') {
                name = osPathService.basename(name);
            }
            if (insertAsk) {
                arg = '%(ask:Script Name:'+ name + ')';
            } else {
                arg = name;
            }
            commands.push(arg);
        }
    } catch (e) {
        log.exception(e);
    }
    return commands;
}

function changeScriptname(update) {
    setTargetnameFromSourcename(getPDKType(), update);
}

function getPdkCommand() {
    var selecteditem = getPDKType();
    if (selecteditem == 'app') {
        return sysDataSvc.getString('pdk.perlapp');
    } else if (selecteditem == 'svc') {
        return sysDataSvc.getString('pdk.perlsvc');
    } else if (selecteditem == 'ctrl') {
        return sysDataSvc.getString('pdk.perlctrl');
    } else if (selecteditem == 'net') {
        return sysDataSvc.getString('pdk.perlnet');
    } else if (selecteditem == 'tray') {
        return sysDataSvc.getString('pdk.perltray');
    }
    return '';
}

function changePDKType(update)  {
    // Tweak capabilities corresponding to the pdk version and the current tool choice
    var selecteditem = getPDKType();
    if (selecteditem == 'app') {
        dialog.hideConsole.disabled = false;
    } else {
        dialog.hideConsole.disabled = true;
        dialog.hideConsole.setAttribute('checked', 'false');
    }
    setTargetnameFromSourcename(selecteditem, update)
    gCurrentOpts = gOptions[selecteditem][pdkVersion];
    if (update) {
        updateCommandString();
    }
}

function updateDirname() {
    if (!dialog.scriptname.value) return [];
    var fname = dialog.scriptname.value;
    if (fname[0] != '\\') {
        gDirname = osPathService.dirname(fname);
    } else {
        gDirname = osService.getcwd();
    }
    if (!gDirname) {
        gDirname = osService.getcwd()
    }
    document.getElementById('commandstringlabel').setAttribute('value',
                'Command string (executed in the \'' + gDirname + '\' directory):');
    return ["cd", gDirname];
}

function getTargetCommand(insertAsk)  {
    var opt = [getOption('exe')];
    updateDirname();
    var arg;
    if (!dialog.targetname.disabled && dialog.targetname.value && opt) {
        var targetdirname = osPathService.dirname(dialog.targetname.value);
        var exevalue;
        if (targetdirname == gDirname) {
            exevalue = osPathService.basename(dialog.targetname.value);
        } else {
            exevalue = dialog.targetname.value;
        }
        if (insertAsk) {
            arg = '%(ask:Executable:'+ exevalue + ')';
        } else {
            arg = exevalue;
        }
        opt.push(arg);
    }
    return opt;
}

function setTargetnameFromSourcename(buildType, update) {
// #if PLATFORM == "win"
    if (buildType == 'ctrl') {
        dialog.targetname.value = osPathService.withoutExtension(dialog.scriptname.value) + '.dll';
    } else {
        dialog.targetname.value = osPathService.withoutExtension(dialog.scriptname.value) + '.exe';
    }
// #else
    // On linux, just strip the extension
    dialog.targetname.value = osPathService.withoutExtension(dialog.scriptname.value);
// #endif
    if (update) {
        updateCommandString();
    }
}

function getDependenciesCommand()  {
    var selecteditem = dialog.dependenciesMenu.getAttribute('value');
    if (selecteditem == 'freestanding') {
        return getOption('freestanding');
    } else if (selecteditem == 'freestanding_noperl56') {
        return [getOption('freestanding'), getOption('exclude')];
    } else {
        return getOption('dependent');
    }
}

function getDebuggerAddress() {
    var address = gDBG_Manager.address;
    if (globalPrefSvc.prefs.getBooleanPref("dbgpProxyEnabled")) {
        address = gDBG_Manager.proxyClientAddress;
    }
    if (!address) address = 'localhost';
    return address;
}

function getDebuggerPort() {
    var port = gDBG_Manager.port;
    if (globalPrefSvc.prefs.getBooleanPref("dbgpProxyEnabled")) {
        port = gDBG_Manager.proxyClientPort;
    }
    if (!port) port = 9000;
    return port;
}

function getDebuggingCommand() {
    var selecteditem = dialog.debuggingMenu.getAttribute('value');
    var opt = getOption('debug');
    if (selecteditem == 'none' || !opt) {
        return '';
    } else if (selecteditem == 'localPdk') {
        return opt;
    } else if (selecteditem == 'localKomodo') {
        return [opt, getDebuggerAddress() + ':' + String(getDebuggerPort())];
    } else if (selecteditem == 'other') {
        return [opt, dialog.hostname.value + ':' + dialog.port.value];
    }
    return '';
}

function changeDebuggingType(update) {
    var selecteditem = dialog.debuggingMenu.getAttribute('value');

    if (selecteditem == 'localKomodo') {
        dialog.hostname.value = getDebuggerAddress();
        dialog.hostname.disabled = true;
        dialog.port.value = getDebuggerPort();
        dialog.port.disabled = true;
    } else if (selecteditem == 'other') {
        dialog.hostname.disabled = false;
        dialog.port.disabled = false;
    } else {
        dialog.hostname.disabled = true;
        dialog.port.disabled = true;
        dialog.hostname.value = 'localhost';
        dialog.port.value = '2000';
    }
    if (update) {
        updateCommandString();
    }
}

function generateVerboseCommand() {
    var opt = getOption('verbose');
    if (dialog.verbose.getAttribute('checked') == 'true' && opt) {
        return opt;
    }
    return ''
}

function getPDKType() {
// #if PLATFORM=="win"
    return dialog.pdkTypeMenu.getAttribute('value');
// #else
    return 'app';
// #endif
}

function generateHideConsoleCommand() {
    var opt = getOption('gui');
    if (dialog.hideConsole.getAttribute('checked') == 'true' && opt) {
        return opt;
    }
    return '';
}

function forceCommand() {
    var opt = getOption('force');
    if (dialog.force.getAttribute('checked') == 'true' && opt) {
        return opt;
    }
    return '';
}

function generateCleanCommand() {
    var opt = getOption('clean');
    if (dialog.clean.getAttribute('checked') == 'true') {
        return opt;
    }
    return '';
}

function restoreDefaultGeneral() {
    // XXX this should use default prefs
    var defaultPerlAppPrefs = Components.classes["@activestate.com/koPreferenceSet;1"]
            .createInstance(Components.interfaces.koIPreferenceSet);

    // Leave scriptname untouched
// #if PLATFORM=="win"
    dialog.pdkTypeMenu.selectedIndex = 0;
// #endif
    // Leave targetname untouched, it will be fixed, if necessary, by changePDKType
    dialog.dependenciesMenu.selectedIndex = 0;
    dialog.verbose.setAttribute("checked", "true");
    dialog.failedUses.setAttribute("checked", "false");
    dialog.hideConsole.setAttribute("checked", "false");
    dialog.clean.setAttribute("checked", "false");
    dialog.debuggingMenu.selectedIndex = 0;
    dialog.hostname.value = getDebuggerAddress();
    dialog.port.value = new String(getDebuggerPort());

    changePDKType(false);
    changeDebuggingType(false);

    updateCommandString();
}

// Extra modules tab

var gCurrentExtraModule;
var gCurrentTrimModule;

var gExtraModulesView = {
    rowCount : 0,
    tree : null,
    cycleHeader : function() { return false;},
    isSeparator : function(index) {return false;},
    isContainer : function(index) {return false;},
    selectionChanged : function() {},
    setTree : function(out) { this.tree = out; },
    getCellText : function(row,column){
        return gExtraModules[row];
    },
    getRowProperties : function(row,prop){},
    getColumnProperties : function(column,prop){},
    getCellProperties : function(row,prop){},
    getImageSrc : function(row,prop){return null},
    isSorted : function(){return false;},

    rowCountChanged: function(start, newcount) {
        this.tree.beginUpdateBatch();
        this.tree.rowCountChanged(start, newcount);
        this.tree.invalidate();
        this.tree.endUpdateBatch();
    },
    refresh : function() {
        this.rowCount = gExtraModules.length;
        this.rowCountChanged(0, this.rowCount);
    },

    selectionChanged : function() {
        if (this.selection.currentIndex >= gExtraModules.length) {
            log.debug('selection past end of modules list');
        }

        if (this.selection.currentIndex != -1) {
            gCurrentExtraModule = gExtraModules[this.selection.currentIndex];
        } else {
            gCurrentExtraModule;
        }
        changeModuleName();
    }
};

function generateExtraModulesCommand() {
    if (gExtraModules.length == 0) {
        return '';
    }
    var command = gExtraModules[0];
    for(var index = 1; index < gExtraModules.length; ++index) {
        command += ';' + gExtraModules[index];
    }
    return [getOption('add'), command];
}

function generateLibsCommand() {
    if (gLibs.length == 0) {
        return '';
    }
    var command = gLibs[0].path;
    for (var index = 1; index < gLibs.length; ++index) {
        command += ';' + gLibs[index].path;
    }
    return [getOption('lib'), command];
}

function generateBlibsCommand() {
    if (gBlibs.length == 0) {
        return '';
    }
    var command = gBlibs[0].path;
    for(var index = 1; index < gBlibs.length; ++index) {
        command += ';' + gBlibs[index].path;
    }
    return [getOption('blib'), command];
}

function changeModuleName(update) {
    if (dialog.moduleName.value == '') {
        dialog.addModule.disabled = true;
        dialog.deleteModule.disabled = true;
    } else {
        var index = gExtraModules.indexOf(dialog.moduleName.value);
        gExtraModulesView.selection.select(index);
        if (index == -1) {
            dialog.addModule.disabled = false;
            dialog.deleteModule.disabled = true;
        } else
        {
            dialog.addModule.disabled = true;
            dialog.deleteModule.disabled = false;
        }
    }
    if (update) {
        updateCommandString();
    }
}

function addModule() {
    gExtraModules.push(dialog.moduleName.value);
    gExtraModulesView.refresh();
    changeModuleName();
    updateCommandString();
    dialog.moduleName.value = '';
}

function deleteModule() {
    var index = gExtraModules.indexOf(gCurrentExtraModule);
    if (index == -1) {
        log.debug('Module selected for delete doesn\'t exist:' + dialog.moduleName.value);
    } else
    {
        gExtraModules.splice(index, 1);
        dialog.moduleName.value = '';
        gExtraModulesView.selection.select(-1);
        gExtraModulesView.refresh();
        changeModuleName();
        updateCommandString();
    }
}

function deleteAllModules() {
    gExtraModules = Array();
    dialog.moduleName.value = '';
    gExtraModulesView.selection.select(-1);
    gExtraModulesView.refresh();
    changeModuleName();
    updateCommandString();
}


var gTrimModulesView = {
    rowCount : 0,
    tree : null,
    cycleHeader : function() { return false;},
    isSeparator : function(index) {return false;},
    isContainer : function(index) {return false;},
    setTree : function(out) { this.tree = out; },
    getCellText : function(row,column){
        return gTrimModules[row];
    },
    getRowProperties : function(row,prop){},
    getColumnProperties : function(column,prop){},
    getCellProperties : function(row,prop){},
    getImageSrc : function(row,prop){return null},
    isSorted : function(){return false;},

    rowCountChanged: function(start, newcount) {
        this.tree.beginUpdateBatch();
        this.tree.rowCountChanged(start, newcount);
        this.tree.invalidate();
        this.tree.endUpdateBatch();
    },
    refresh : function() {
        this.rowCount = gTrimModules.length;
        this.rowCountChanged(0, this.rowCount);
    },

    selectionChanged : function() {
        if (this.selection.currentIndex >= gTrimModules.length) {
            log.debug('selection past end of modules list');
        }
        if (this.selection.currentIndex != -1) {
            gCurrentTrimModule = gTrimModules[this.selection.currentIndex];
        } else {
            gCurrentTrimModule;
        }
        changeTrimModuleName();
    }
};

function generateTrimModulesCommand() {
    if (gTrimModules.length == 0) {
        return '';
    }
    var command = gTrimModules[0];
    for(var index = 1; index < gTrimModules.length; ++index) {
        command += ';' + gTrimModules[index];
    }
    return [getOption('trim'), command];
}

function changeTrimModuleName(update) {
    if (dialog.trimmoduleName.value == '') {
        dialog.addTrimModule.disabled = true;
        dialog.deleteTrimModule.disabled = true;
    } else {
        var index = gTrimModules.indexOf(dialog.trimmoduleName.value);
        gTrimModulesView.selection.select(index);
        if (index == -1) {
            dialog.addTrimModule.disabled = false;
            dialog.deleteTrimModule.disabled = true;
        } else {
            dialog.addTrimModule.disabled = true;
            dialog.deleteTrimModule.disabled = false;
        }
    }
    if (update) {
        updateCommandString();
    }
}

function addTrimModule() {
    gTrimModules.push(dialog.trimmoduleName.value);
    gTrimModulesView.refresh();
    changeTrimModuleName();
    updateCommandString();
    dialog.trimmoduleName.value = '';
}

function deleteTrimModule() {
    var index = gTrimModules.indexOf(gCurrentTrimModule);
    if (index == -1) {
        log.debug('TrimModule selected for delete doesn\'t exist:' + dialog.trimmoduleName.value);
    } else
    {
        gTrimModules.splice(index, 1);
        dialog.trimmoduleName.value = '';
        gTrimModulesView.selection.select(-1);
        gTrimModulesView.refresh();
        changeTrimModuleName();
        updateCommandString();
    }
}

function deleteAllTrimModules() {
    gTrimModules = Array();
    dialog.trimmoduleName.value = '';
    gTrimModulesView.selection.select(-1);
    gTrimModulesView.refresh();
    changeTrimModuleName();
    updateCommandString();
}

// Files tab

var gFilesView = {
    rowCount : 0,
    tree : null,
    cycleHeader : function() { return false;},
    isSeparator : function(index) {return false;},
    isContainer : function(index) {return false;},
    setTree : function(out) { this.tree = out; },
    getCellText : function(row,column){
      var colID = column.id;
      if (colID=="sourceColumn")  {
        return gFiles[row].sourceFile;
      }
      else if (colID=="destinationColumn"){
        return gFiles[row].destinationFile;
      }
      return null;
    },
    getRowProperties : function(row,prop){},
    getColumnProperties : function(column,prop){},
    getCellProperties : function(row,prop){},
    getImageSrc : function(row,prop){return null},
    isSorted : function(){return false;},

    rowCountChanged: function(start, newcount) {
        this.tree.beginUpdateBatch();
        this.tree.rowCountChanged(start, newcount);
        this.tree.invalidate();
        this.tree.endUpdateBatch();
    },
    refresh : function() {
        this.rowCount = gFiles.length;
        this.rowCountChanged(0, this.rowCount);
    },

    selectionChanged : function() {
        if (this.selection.currentIndex == -1) {
            dialog.deleteFile.setAttribute('disabled', 'true');
            dialog.editFile.setAttribute('disabled', 'true');
        } else {
            dialog.editFile.removeAttribute('disabled');
            dialog.deleteFile.removeAttribute('disabled');
        }
    }
};

function generateFilesCommand() {
    if (gFiles.length == 0) {
        return '';
    }
    // SHould generate a different
    var command =  gFiles[0].destinationFile + "[file=" + gFiles[0].sourceFile + "]";
    var name;
    for( var index = 1; index < gFiles.length; ++index) {
        command += ';' + gFiles[index].destinationFile + "[file=" + gFiles[index].sourceFile;
        name = gFiles[index].sourceFile;
        if (name.slice(-4).toLowerCase() == '.dll' ||
            name.slice(-3).toLowerCase() == '.so') {
            command += ",extract]";
        } else {
            command += "]";
        }
    }
    return [getOption('bind'), command];
}

function addFile() {
    var obj = new Object ();

    obj.sourceFile = '';
    obj.destinationFile = '';
    obj.baseDirectory = gDirname;

    window.openDialog("chrome://perlapp/content/perlapp-fileadd.xul",
                      "kodialog",
                      "chrome,close=yes,modal",
                      obj);

    if (obj.sourceFile && obj.destinationFile) {
        gFiles.push(obj);
        gFilesView.refresh();
        updateCommandString();
    }
}

function editFile() {
    var obj = new Object ();

    var currentIndex = gFilesView.selection.currentIndex;

    obj.sourceFile = gFiles[currentIndex].sourceFile;
    obj.destinationFile = gFiles[currentIndex].destinationFile;

    window.openDialog("chrome://perlapp/content/perlapp-fileadd.xul",
                       "kodialog",
                       "chrome,close=yes,modal",
                        obj);

    if (obj.sourceFile && obj.destinationFile) {
        gFiles[currentIndex] = obj;
        gFilesView.refresh();
        updateCommandString();
    }
}

function deleteFile() {
    var index = gFilesView.selection.currentIndex;
    if (index == -1) {
        log.debug('File selected for delete doesn\'t exist:' + index);
    } else
    {
        gFiles.splice(index, 1);
        gFilesView.selection.select(-1);
        gFilesView.refresh();
        updateCommandString();
    }
}

function deleteAllFiles() {
    gFiles = Array();
    gFilesView.selection.select(-1);
    gFilesView.refresh();
    updateCommandString();
}

// Version tab

var gVersionInfoView = {
    rowCount : gVersionInfo.length,
    tree : null,
    cycleHeader : function() { return false;},
    isSeparator : function(index) {return false;},
    isContainer : function(index) {return false;},
    setTree : function(out) { this.tree = out; },
    getCellText : function(row,column){
      var colID = column.id;
      if (colID=="fieldColumn")  {
        return gVersionInfo[row].userName;
      }
      else if (colID=="valueColumn"){
        if (gVersionInfo[row].fieldValue == null) {
            return '<Use default>'
        } else {
            return gVersionInfo[row].fieldValue;
        }
      }
      return null;
    },
    getRowProperties : function(row,prop){},
    getColumnProperties : function(column,prop){},
    getCellProperties : function(row,prop){},
    getImageSrc : function() {return null;},
    getImageSrc : function(row,prop){return null},
    isSorted : function(){return false;},

    refresh : function() {
        this.tree.beginUpdateBatch();
        this.tree.invalidate();
        this.tree.endUpdateBatch();
    },

    selectionChanged : function() {
        var selText;
        if (dialog.versionFieldPrompt.hasChildNodes())  {
            dialog.versionFieldPrompt.removeChild(dialog.versionFieldPrompt.firstChild);
        }
        if (this.selection.currentIndex == -1)
        {
            selText = document.createTextNode("Select a version field to see information about it");
            dialog.versionFieldPrompt.appendChild(selText);
            dialog.versionInfoValue.value = "";
            dialog.clearVersionField.disabled = true;
            dialog.versionInfoValue.disabled = true;
        }
        else
        {
            selText = document.createTextNode(gVersionInfo[this.selection.currentIndex].description);
            dialog.versionFieldPrompt.appendChild(selText);
            if (gVersionInfo[this.selection.currentIndex].fieldValue == null) {
                dialog.versionInfoValue.value = '';
            }
            else {
                dialog.versionInfoValue.value = gVersionInfo[this.selection.currentIndex].fieldValue;
            }
            dialog.clearVersionField.disabled = false;
            dialog.versionInfoValue.disabled = false;
        }
    }
};

function generateVersionInfoCommand() {
    var command = "";
    var hitone = false;

    for (var i=0; i < gVersionInfo.length; ++i) {
        if (gVersionInfo[i].fieldValue != null) {
            if (hitone) {
                command += ';'
            }
            else {
                hitone = true;
            }
            command += gVersionInfo[i].fieldName + "=" + gVersionInfo[i].fieldValue;
        }
    }

    if (hitone) {
        return [getOption('info'), command];
    }
    return "";
}

function updateVersionField() {
    gVersionInfo[gVersionInfoView.selection.currentIndex].fieldValue = dialog.versionInfoValue.value;
    gVersionInfoView.refresh();
    updateCommandString();
}

function clearVersionField() {
    gVersionInfo[gVersionInfoView.selection.currentIndex].fieldValue = null;
    gVersionInfoView.refresh();
    updateCommandString();
}

function restoreDefaultVersionInfo() {
    for (var i=0; i < gVersionInfo.length; ++i) {
        gVersionInfo[i].fieldValue = null;
    }

    gVersionInfoView.refresh();
    updateCommandString();
}

// Extra tab

// Icons area

function FileOptionsView() {

}

FileOptionsView.prototype = {
    rowCount : 0,
    tree : null,
    cycleHeader : function() { return false;},
    isSeparator : function(index) {return false;},
    isContainer : function(index) {return false;},
    setTree : function(out) { this.tree = out; },
    selectionChanged : function() {},
    getCellText : function(row,column){
      if (column.id=="path")  {
        return this.datastructure[row].path;
      }
      return null;
    },
    getRowProperties : function(row,prop){},
    getColumnProperties : function(column,prop){},
    getCellProperties : function(row,prop){},

    rowCountChanged: function(start, newcount) {
        this.tree.beginUpdateBatch();
        this.tree.rowCountChanged(start, newcount);
        this.tree.invalidate();
        this.tree.endUpdateBatch();
    },
    refresh : function() {
        this.rowCount = this.datastructure.length;
        this.rowCountChanged(0, this.rowCount);
    },

    selectionChanged : function() {
        //dump("in selectionChanged for FileOptionsView\n"); XXX this breaks for some reason.
        //if (this.selection.currentIndex == -1) {
        //    this.deleteBtn.disabled = true;
        //} else {
        //    this.deleteBtn.disabled = false;
        //}
    }
};

function generateIconsCommand() {
    if (gIcons.length == 0) {
        return '';
    }
    var command = gIcons[0].path;
    for(var index = 1; index < gIcons.length; ++index) {
        command += ';' + gIcons[index].path;
    }
    return [getOption('icon'), command];
}

function generateHacksCommand(insertAsk) {
    // this function tweaks the perlapp invocation in the case of freestanding
    // builds that are to be debugged in Komodo.
    if (dialog.debuggingMenu.getAttribute('value') != 'localKomodo') return [];
    // Because our jacket code injects a 'require overload' we need to make
    // sure that overload is on the module list and that our perl5db.pl is
    // picked up.
    // Find the location of our perl5db.pl
    var koDirs = Components.classes["@activestate.com/koDirs;1"].
                getService(Components.interfaces.koIDirs);
    var perllib = koDirs.perlDBGPDir;
    if (!perllib) return [];
    if (insertAsk) {
        return [getOption('add'), 'overload',
                getOption('lib'), perllib];
    } else {
        return [getOption('add'), 'overload',
                getOption('lib'), perllib];
    }
}


function addFileOption(view, pickDir) {
    try {
    var obj = new Object ();
    obj.path = '';
    if (pickDir) {
        obj.path = ko.filepicker.getFolder(gDirname);
    } else {
        // We're adding a file
        var nsIFilePicker = Components.interfaces.nsIFilePicker;
        var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
        fp.init(window, "Add Icon", Components.interfaces.nsIFilePicker.modeOpen);
        fp.appendFilters(Components.interfaces.nsIFilePicker.filterAll)
        if (fp.show() == Components.interfaces.nsIFilePicker.returnOK) {
            if (osPathService.commonprefix(fp.file.path, gDirname) == gDirname) {
                // We relativize
                obj.path = osPathService.relpath(fp.file.path, gDirname);
            } else {
                obj.path = fp.file.path;
            }
        }
    }
    if (obj.path) {
        view.datastructure.push(obj);
        view.refresh();
        updateCommandString();
    }
    } catch (e) {
        log.exception(e);
    }
}

function deleteFileOption(view) {
    try {
    var index = view.selection.currentIndex;
    if (index == -1) {
        log.debug('File selected for delete doesn\'t exist:' + index);
    } else
    {
        view.datastructure.splice(index, 1);
        view.selection.select(-1);
        view.selectionChanged();
        view.refresh();
        updateCommandString();
    }
    } catch (e) {
        log.exception(e);
    }
}

function deleteAllFileOptions(view) {
    try {
        view.datastructure.splice(0, view.datastructure.length); // delete in place
        view.selection.select(-1);
        view.selectionChanged();
        view.refresh();
        updateCommandString();
    } catch (e) {
        log.exception(e);
    }
}

function savePrefs() {
    hPrefWindow.onOK();

    var perlAppPrefSet = effectivePrefs.getPref('PDK')
    var i;

    var extraModulesPrefs = perlAppPrefSet.getPref('extraModules').QueryInterface(Components.interfaces.koIOrderedPreference);
    extraModulesPrefs.reset();
    for (i =0; i < gExtraModules.length; ++i) {
        extraModulesPrefs.appendStringPref(gExtraModules[i]);
    }

    var trimModulesPrefs = perlAppPrefSet.getPref('trimModules').QueryInterface(Components.interfaces.koIOrderedPreference);
    trimModulesPrefs.reset();
    for (i =0; i < gTrimModules.length; ++i) {
        trimModulesPrefs.appendStringPref(gTrimModules[i]);
    }

    var libsPrefs = perlAppPrefSet.getPref('libs').QueryInterface(Components.interfaces.koIOrderedPreference);
    libsPrefs.reset();
    for (i =0; i < gLibs.length; ++i) {
        libsPrefs.appendStringPref(gLibs[i].path);
    }

    var blibsPrefs = perlAppPrefSet.getPref('blibs').QueryInterface(Components.interfaces.koIOrderedPreference);
    blibsPrefs.reset();
    for (i =0; i < gBlibs.length; ++i) {
        blibsPrefs.appendStringPref(gBlibs[i].path);
    }

    var iconsPrefs = perlAppPrefSet.getPref('icons').QueryInterface(Components.interfaces.koIOrderedPreference);
    iconsPrefs.reset();
    for (i =0; i < gIcons.length; ++i) {
        iconsPrefs.appendStringPref(gIcons[i].path);
    }

    perlAppPrefSet.setStringPref('extras', dialog.extras.value)

    var dataFilesPrefs = perlAppPrefSet.getPref('dataFiles').QueryInterface(Components.interfaces.koIOrderedPreference);
    dataFilesPrefs.reset();
    var dataPref;
    for (i=0; i < gFiles.length; ++i) {
        dataPref = Components.classes["@activestate.com/koPreferenceSet;1"]
                .createInstance(Components.interfaces.koIPreferenceSet);

        dataPref.setStringPref("sourceFile", gFiles[i].sourceFile);
        dataPref.setStringPref("destinationFile", gFiles[i].destinationFile);
        dataFilesPrefs.appendPref(dataPref);
    }

    var versionInfoPref = perlAppPrefSet.getPref('versionInfo');
    versionInfoPref.reset();
    for (i=0; i < gVersionInfo.length; ++i) {
        if (gVersionInfo[i].fieldValue != null) {
            versionInfoPref.setStringPref(gVersionInfo[i].fieldName, gVersionInfo[i].fieldValue);
        }
    }

    effectivePrefs.setPref(perlAppPrefSet.id, perlAppPrefSet);
}

function apply() {
    savePrefs();
}

function generateShortName() {
    return generateRunCommand() + ' ' + dialog.scriptname.value;
}

function getDebugProxyKey() {
    var proxyKey = null;
    if (globalPrefSvc.prefs.getBooleanPref("dbgpProxyEnabled")) {
        if (globalPrefSvc.prefs.getStringPref("dbgpProxyKey")) {
            proxyKey = globalPrefSvc.prefs.getStringPref("dbgpProxyKey");
        }
        if (!proxyKey) {
            // get from environment
            proxyKey = osService.getenv('USER');
            if (!proxyKey)
                osService.getenv('USERNAME');
        }
    }
    return proxyKey;
}

function debug() {
    var cwd = '';

    var cmd = '"'+dialog.targetname.value+'"';
    var type = getPDKType();
    if (type == 'app') {
        dialog.statuslabel.setAttribute('label', 'Status: Getting parameters...');
        dialog.statuslabel.removeAttribute('style');
        var imystringa = null;
        var imystringb = null;
        try {
            var istrings = gMainWindow.ko.interpolate.interpolate(opener,
                                              ["%(ask:Start In:" +
                                               gDirname + ")",
                                               " %(ask:Arguments:)"], // codes are not bracketed
                                              [], // codes are bracketed
                                              "Launch Options");
        } catch (ex) {
            var lastErrorSvc = Components.classes["@activestate.com/koLastErrorService;1"]
                               .getService(Components.interfaces.koILastErrorService);
            var errno = lastErrorSvc.getLastErrorCode();
            if (errno == Components.results.NS_ERROR_ABORT) {
                // Command was cancelled.
            } else if (errno == Components.results.NS_ERROR_INVALID_ARG) {
                var errmsg = lastErrorSvc.getLastErrorMessage();
                alert("Could not understand:" + errmsg);
            } else {
                log.exception(ex);
                alert("There was an unexpected error: " + ex);
            }
            return;
        }
        cwd             = istrings[0];
        //cwdForDisplay = istrings[1];
        cmd += ' ' + istrings[2];
    }
    // get the idekey if the proxy is enabled
    var proxyKey = getDebugProxyKey();
    var env = null;
    if (proxyKey) {
        env = "DBGP_IDEKEY="+proxyKey;
    }
    try {
        dialog.statuslabel.setAttribute('label', 'Status: Starting debugger...');
        dialog.statuslabel.removeAttribute('style');
        if (!gMainWindow.ko.dbg.listener.isListening()) {
            gMainWindow.ko.dbg.listener.startListener();
        }
        _gLastDebuggerLaunchFromPDKDialog = true;
        gMainWindow.ko.run.runCommand(opener,
                              cmd,
                              cwd, // cwd
                              env,
                              false, // insertOutput
                              false, // operateOnSelection
                              true, // doNotOpenOutputWindow
                              'command-output-window', // runIn
                              0, // parseOutput
                              '', // parseRegex
                              0, // showParsedOutputList
                              "Input Parameters For Application");
    } catch (e) {
        log.exception(e);
    }
    window.focus();
}

function disablePostBuildActions() {
    dialog.debugBtn.disabled = true;
}

function buildCallback(retval) {
    window.setCursor("auto");
    if (retval != 0) {
        dialog.statuslabel.setAttribute('label', 'Status: Build was NOT successful.  See Command Output tab for details.');
        dialog.statuslabel.setAttribute('style', 'color: white; background-color: #0a246a');
        disablePostBuildActions();
    } else {
        if (dialog.debuggingMenu.getAttribute('value') == 'localKomodo') {
            dialog.statuslabel.setAttribute('label', 'Status: Build was Successful.  Ready to debug.');
        } else {
            dialog.statuslabel.setAttribute('label', 'Status: Build was Successful.');
        }
        dialog.statuslabel.removeAttribute('style');
        enablePostBuildActions();
    }
}

function enablePostBuildActions() {
    gLastSuccessfulBuildString = generateRunCommand();
    if (dialog.debuggingMenu.getAttribute('value') == 'localKomodo') {
        dialog.debugBtn.disabled = false;
    }
    dialog.addToToolboxBtn.disabled = false;
}

function build() {
    try {
        dialog.statuslabel.setAttribute('label', 'Status: Building...');
        dialog.statuslabel.removeAttribute('style');
        window.setCursor("wait");
        if (! gMainWindow.ko.views.manager.offerToSave(null,
                                          'Save Modified Files Before Building Perl application',
                                          null,
                                          "save_before_perlapp",
                                          null, // skipProjects: default is false
                                          false // aboutToClose: default is true
                                          )) {
            window.setCursor("auto");
            window.close();
            return;
        }

        var cmd = generateRunCommand();
        if (osPathService.exists(dialog.targetname.value) &&
            ! dialog.force.checked) {
            var prompt = "The file '" + dialog.targetname.value + "' already exists. " +
                        "Do you wish to overwrite it?";
            var buttons = ['Yes', 'Yes, enable checkbox', 'Cancel'];
            var response = ko.dialogs.customButtons(prompt, buttons, 'Yes, enable checkbox');
            if (!response || response == 'Cancel') {
                window.setCursor("auto");
                return;
            }
            if (response == 'Yes, enable checkbox') {
                dialog.force.checked = true;
            }
            cmd += ' --force';
        }
        savePrefs();
        gMainWindow.ko.run.runCommand(opener,
                              cmd,
                              gDirname,
                              null, // env,
                              false, // insertOutput,
                              false, //operateOnSelection,
                              false, // doNotOpenOutputWindow,
                              'command-output-window', // runIn,
                              false, // parseOutput
                              '', // parseRegex
                              false, // showParsedOutputList
                              generateShortName(),
                              true,
                              buildCallback)
        window.focus();
    } catch (e) {
        log.exception(e);
    }
}

function addToToolbox() {
    var cmd, cwd, env, insertOutput, operateOnSelection;
    var doNotOpenOutputWindow, runIn, parseOutput, parseRegex, showParsedOutputList;

    cmd = generateRunCommand(true);
    gMainWindow.ko.toolboxes.addCommand(cmd,
                               '%(ask:Directory:'+gDirname+')',
                               '', // env
                               false, // insertOutput
                               false, // operateOnSelection,
                               false, // doNotOpenOutputWindow,
                               'command-output-window', // runIn,
                               false, // parseOutput,
                               false, // parseRegex,
                               false, // showParsedOutputList
                               getPdkCommand() + ' ' + osPathService.basename(dialog.scriptname.value));
    dialog.addToToolboxBtn.disabled = true;
}

function closecb() {
    top.window.close();
}

function generateRunCommand(insertAsk /* default = false */) {
    var args = [getPdkCommand()];
    var tempCommand;
    if (typeof(insertAsk) == 'undefined') {
        insertAsk = false;
    } else {
        insertAsk = insertAsk ? true : false;
    }
    for (var i = 0; i < commandGenerators.length; ++i) {
        tempCommand = commandGenerators[i](insertAsk);

        if (tempCommand)
            if (typeof(tempCommand) == 'string') {
                args.push(tempCommand);
            } else { // we got a list of strings back
                args = args.concat(tempCommand);
            }
    }
    updateDirname();
    return sysUtils.joinargv(args.length, args) + getExtrasCommand(); // extras is not processed by joinargv to avoid extra quotations
}

var gLastSuccessfulBuildString = '';

function updateCommandString() {
    var commandstring = generateRunCommand();
    var e = window.frames[0].document.documentElement;
    e.setAttribute("style", "background-color: -moz-Dialog;");
    var commandarea = window.frames[0].document;
    commandarea.open();
// #if PLATFORM == "win"
    commandarea.write('<FONT FACE="tahoma, arial" STYLE="font-size: 8pt;">');
// #else
    commandarea.write('<FONT FACE="arial" STYLE="font-size: 12pt;">');
// #endif
    commandarea.write(commandstring);
    commandarea.write('</FONT>');
    commandarea.close();

    if (commandstring != gLastSuccessfulBuildString) {
        disablePostBuildActions();
    } else {
        enablePostBuildActions();
    }
    if (gLastSuccessfulBuildString && commandstring != gLastSuccessfulBuildString) {
        dialog.addToToolboxBtn.disabled = false;
    } else {
        dialog.addToToolboxBtn.disabled = true;
    }
    dialog.statuslabel.removeAttribute('style');

    if (! osPathService.basename(dialog.scriptname.value)) {
        dialog.statuslabel.setAttribute("label", "Status: Need script name");
        return;
    }
    if (! osPathService.dirname(dialog.scriptname.value)) {
        dialog.statuslabel.setAttribute("label", "Status: Need directory for script name");
        return;
    }
    if (osPathService.basename(dialog.targetname.value)) {
        dialog.statuslabel.setAttribute("label", "Status: Ready to build");
        return;
    }
    dialog.statuslabel.setAttribute("label", "Status: Ready to build");
}

// XXX TODO we need to hook the debug session to this observer so we get the
// correct session information.
/* XXX The debugger_session_state_change notification is gone.
   We need another way of passing this info, if we're going to
   resurrect this functionality.

function _PDKObserver() {}
_PDKObserver.prototype.observe = function(subject, topic, data)
{
    switch (topic) {
    case 'debugger_session_state_change':
        if (ko.windowManager.getMainWindow() != window) {
            break;
        }
        if (data == 'stopped') {
            dialog.statuslabel.setAttribute('label', 'Status: Debugging session ended. Ready to Debug.');
            if (_gLastDebuggerLaunchFromPDKDialog) {
                //gMainWindow.setTimeout("RunOutput_Kill(-1)", 2000);
            }
            _gLastDebuggerLaunchFromPDKDialog = false;
        } else {
            // we get a full status in the debugger tab, just let them know it's
            // running here
            dialog.statuslabel.setAttribute('label', 'Status: Debugging session in progress.');
        }
        break;
    }
}
_PDKObserver.prototype.QueryInterface = function (iid) {
    if (!iid.equals(Components.interfaces.nsIObserver) ||
        !iid.equals(Components.interfaces.nsISupports)) {
        throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    return this;
}
*/

