/* Copyright (c) 2000-2011 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

var elems = {};
const $ = require("ko/dom").window(window);
const w = require("ko/windows").getMain();
const locale = require("ko/locale").use("chrome://state/locale/state.properties");
const legacy = w.ko;
const prefs = require("ko/prefs");
const deps = require("ko/dependencies");
var log = require("ko/logging").getLogger("prefs-state-tool");
// log.setLevel(log.LOG_DEBUG);
const sys = require("sdk/system");
const koFile = require("ko/file");

const isWindows = sys.platform == "winnt";
const stateBinPref = "statetoolDefaultbinary";
const okClass = "state-ok";
const warnClass = "state-warning";
const findOnPath = locale.get("prefs_find_on_path");
var knownPaths = [];
var valid = true;

function OnPreferencePageOK(prefset) {
    log.debug("OnPreferencePageOK");
    if (!valid) return false;
    let value = elems.binaryPathMenu.value();
    if (value == findOnPath)
        prefset.deletePref(stateBinPref);
    else
        prefset.setStringPref(stateBinPref, value);
    return true;
}


function PrefState_OnLoad() {
    log.debug("PrefState_OnLoad");
    loadElements();
}

var browseButton = () => {
    let button = require("ko/ui/button").create("...",{id:"state_browse_button"});
    button.on("command", () => {
        var value = elems.binaryPathMenu.value();
        let newPath = legacy.filepicker.browseForExeFile(value);
        if (!_pathInList(knownPaths, newPath))
            elems.binaryPathMenu.addMenuItem(newPath);
        elems.binaryPathMenu.value(newPath);
        elems.binaryPathMenu.$element.trigger("command");
    });

    return button;
};

var _pathInList = (paths, candidate) => {
    candidate = candidate.toLowerCase();
    for (let path of paths)
    {
        if (isWindows)
        {
            if(candidate === path.toLowerCase())
                return true;
        }
        else
        {
            if(candidate === path)
                return true;
        }
    }
    return false;
};

var binaryPathMenu = () => {
    log.debug("binaryPathMenu");
    knownPaths = deps.getDependencyPaths("state");
    let field = elems.binaryPathMenu = require("ko/ui/menulist").create({flex: 1});
    let value = findOnPath;
    knownPaths.unshift(value);
    if (prefs.hasPref(stateBinPref)) {
        value = prefs.getStringPref(stateBinPref);
        if (!_pathInList(knownPaths, value) && value != "")
        {
            knownPaths.unshift(value);
        }
    }
    field.addMenuItems(knownPaths);
    field.value(value);
    field.on("command", () => {
        validate();
    });
    return field;
};

var validate = () => {
    log.debug("validate");

    let path = elems.binaryPathMenu.value();
    if (path != findOnPath && ! koFile.isExecutable(path)){
        warn(locale.get("prefs_is_not_executable"));
        valid = false;
        return;
    }
    
    okMsg(locale.get("prefs_all_is_well"));
    valid = true;
};

var setInvalidState = () => {
    elems.outputField.removeClass(okClass);
    elems.outputField.addClass(warnClass);
    elems.binaryPathMenu.addClass("error-box");
    valid = false;
};

var setValidState = () => {
    elems.outputField.removeClass(warnClass);
    elems.outputField.addClass(okClass);
    elems.binaryPathMenu.removeClass("error-box");
    valid = true;
};

var okMsg = (msg) => {
    setValidState();

    elems.outputField.value(msg);
};

var warn = (msg) => {
    if (!msg)
        return;
    setInvalidState();

    elems.outputField.value(msg);
};

var loadElements = () => {
    log.debug("loadElements");
    
    let binaryBox = require("ko/ui/groupbox").create({ caption: locale.get("prefs_set_binary") });
    
    let row = require("ko/ui/row").create([binaryPathMenu(), browseButton()]);
    binaryBox.addColumn([require("ko/ui/label").create(locale.get("prefs_use_this_binary")),
                         row]);
    
    elems.outputField = require("ko/ui/textbox").create({ id: "state-output-field", disabled: true, flex: 1 });
    
    binaryBox.addRow(elems.outputField, { flex: 1 });
    
    $("#state-prefs-vbox").append(binaryBox.element);
};