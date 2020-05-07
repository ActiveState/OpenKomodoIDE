/* Copyright (c) 2000-2009 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

var _profiler_log = ko.logging.getLogger("profiler");
var g_profileInstance = null;

function cmd_profiler_toggleButtonText() {
    try {
        var i;
        var toolbar = document.getElementById("profiler_toolbar");
        if (toolbar.getAttribute("buttonstyle") == "pictures") {
            toolbar.removeAttribute("buttonstyle");
            var toolbarbuttons = document.getElementsByTagName('toolbarbutton');
            for (i = 0; i < toolbarbuttons.length; i++ ) {
                toolbarbuttons[i].removeAttribute("buttonstyle");
            }
        } else {
            toolbar.setAttribute("buttonstyle", "pictures");
            var toolbarbuttons = document.getElementsByTagName('toolbarbutton');
            for (i = 0; i < toolbarbuttons.length; i++ ) {
                toolbarbuttons[i].setAttribute("buttonstyle", "pictures");
            }
        }
    } catch (e) {
        _profiler_log.exception(e);
    }
}

function loadProfilerInstance(instance) {
    g_profileInstance = instance;
    var cpu_time = instance.total_cpu_time;
    if (cpu_time > 1000) {
        // Round to nearest integer.
        cpu_time = parseInt(cpu_time);
    } else if (cpu_time > 50) {
        // Use 2 decimal places.
        cpu_time = Math.round(cpu_time * 100) / 100;
    } else {
        // Use 5 decimal places.
        cpu_time = Math.round(cpu_time * 100000) / 100000;
    }
    document.title = "Code Profiler, total time: " + cpu_time + " seconds";
    var profilerview = document.getElementById("profilerview");
    var profiler_view_menulist = document.getElementById("profiler_view_menulist");
    var view_type = profiler_view_menulist.getAttribute("value");
    profilerview.setAttribute("type", view_type);
    // Allow some time for XBL to load.
    window.setTimeout(function() { profilerview.load(instance); }, 20);
}

function _show_loader() {
    document.getElementById("profiler_deck").selectedIndex = 1;
    require("ko/dom")("#spinner").addClass("enabled");
}

function _hide_loader() {
    document.getElementById("profiler_deck").selectedIndex = 0;
    require("ko/dom")("#spinner").removeClass("enabled")
}
function async_load_started() {
    // Show the loading element.
    _show_loader();
}

function async_load_finished(result, profInstance) {
    try {
        // Hide the loading element.
        _hide_loader();
        if (result == Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
            loadProfilerInstance(profInstance);
        } else {
            ko.dialogs.alert("Unable to load profile data - unexpected data format.", null, "Load Error");
        }
    } catch (ex) {
        _profiler_log.error(ex);
        ko.dialogs.alert("Unexpected error: " + ex, null, "Load Error");
    }
}

function load_fileuri(fileuri) {
    try {
        var profSvc = Components.classes["@activestate.com/koProfilerService;1"].
                            createInstance(Components.interfaces.koIProfilerService);
        profSvc.loadFromFileAsync(fileuri, async_load_finished);
        async_load_started();
    } catch (ex) {
        _profiler_log.error(ex);
        ko.dialogs.alert("Unexpected error: " + ex, null, "Load Error");
    }
}

function load_data(data, base64format) {
    try {
        var profSvc = Components.classes["@activestate.com/koProfilerService;1"].
                            createInstance(Components.interfaces.koIProfilerService);
        if (base64format) {
            profSvc.loadFromBase64StringAsync("Remote profile", data, async_load_finished);
        } else {
            profSvc.loadFromStringAsync("Remote profile", data, async_load_finished);
        }
        async_load_started();
    } catch (ex) {
        _profiler_log.error(ex);
        ko.dialogs.alert("Unexpected error: " + ex, null, "Load Error");
    }
}

function profiler_change_view(menulist) {
    try {
        var view_type = menulist.getAttribute("value");
        var profilerview = document.getElementById("profilerview");
        profilerview.setAttribute("type", view_type);
        // Allow some time for XBL to load.
        window.setTimeout(function() { profilerview.load(g_profileInstance); }, 20);
    } catch (ex) {
        _profiler_log.error(ex);
    }
}

function cmd_profiler_open() {
    try {
        var prefName = "profiler.openFile";
        var default_dir = ko.filepicker.internDefaultDir(prefName);
        var filepath = ko.filepicker.browseForFile();
        if (filepath) {
            ko.filepicker.updateDefaultDirFromPath(prefName, filepath);
            load_fileuri(ko.uriparse.pathToURI(filepath));
        }
    } catch (e) {
        _profiler_log.exception(e);
        ko.dialogs.alert("Unable to open profile data", e, "Open Error");
    }
}

function cmd_profiler_save() {
    try {
        if (g_profileInstance) {
            var prefName = "profiler.openFile";
            var default_dir = ko.filepicker.internDefaultDir(prefName);
            var filepath = ko.filepicker.saveFile();
            if (filepath) {
                ko.filepicker.updateDefaultDirFromPath(prefName, filepath);
                g_profileInstance.save(filepath);
            }
        } else {
            ko.dialogs.alert("No profile data has been loaded.", null, "Save Error");
        }
    } catch (e) {
        _profiler_log.exception(e);
        ko.dialogs.alert("Unable to save profile data.", e, "Save Error");
    }
}

/**
 * Load the profile item source code into the scintilla widget.
 * 
 * @param {Components.interfaces.koIProfileInstance} profilerInstance
 * @param {Components.interfaces.koIProfileItem} profileItem
 * @param {DOMElement} scintilla
 * 
 * @returns {boolean} True if the source code was loaded, otherwise false.
 */
function profiler_load_source_in_scintilla(profilerInstance, profileItem, scintilla) {
    try {
        /**
         * @type {Components.interfaces.ISciMoz}
         */
        var scimoz = scintilla.scimoz;
        if (!scintilla.inited) {
            scintilla.init();
            // We want to show the current line background marker.
            scimoz.setMarginMaskN(scimoz.MARGIN_SYMBOLS, (ko.markers.MARKERS_MASK_SYMBOLS |
                                      (1 << ko.markers.MARKNUM_CURRENT_LINE_BACKGROUND)));
            // This will show an arrow in the left margin.
            //scimoz.markerDefine(ko.markers.MARKNUM_CURRENT_LINE_BACKGROUND,
            //                    scimoz.SC_MARK_ARROW);
            //scimoz.setMarginMaskN(scimoz.MARGIN_SYMBOLS, (ko.markers.MARKERS_MASK_SYMBOLS |
            //                          (1 << ko.markers.MARKNUM_CURRENT_LINE_BACKGROUND)));
            // This colours the caret line background a light red.
            scimoz.markerDefine(ko.markers.MARKNUM_CURRENT_LINE_BACKGROUND,
                                scimoz.SC_MARK_BACKGROUND);
            scimoz.markerSetBack(ko.markers.MARKNUM_CURRENT_LINE_BACKGROUND,
                                 0x0000FF);
            scimoz.markerSetAlpha(ko.markers.MARKNUM_CURRENT_LINE_BACKGROUND,
                                  100);
            // We always want the selected function visible at the
            // top  of the view, this caret policy ensures that.
            scimoz.setYCaretPolicy(scimoz.CARET_STRICT | scimoz.CARET_EVEN, 2);
        }
        var lang = profilerInstance.language;
        var sourceLoaded = false;
        if (!profileItem.path) {
            scintilla.language = "Text";
            scimoz.text = "<Source code unavailable>";
        } else if (profileItem.path == "~" && lang == "Python") {
            // Represents a binary module - compiled C code.
            scintilla.language = "Text";
            scimoz.text = "<Source code unavailable - binary Python module>";
        } else if (profileItem.path.substr(0, 4) == "php:" && lang == "PHP") {
            // Represents an internal or compiled PHP method.
            scintilla.language = "Text";
            scimoz.text = "<Source code unavailable - internal PHP method>";
        } else {
            var fileSvc = Components.classes["@activestate.com/koFileService;1"].
                            getService(Components.interfaces.koIFileService);
            var uri = ko.uriparse.pathToURI(profileItem.path);
            var koFile = fileSvc.getFileFromURINoCache(uri);
            if (koFile && koFile.exists) {
                // Use a koIDocument, as it will deal with the file encoding.
                var docSvc = Components.classes["@activestate.com/koDocumentService;1"].
                                getService(Components.interfaces.koIDocumentService);
                try {
                    var koDoc = docSvc.createDocumentFromURI(uri);
                    koDoc.load();
                    scimoz.text = koDoc.buffer;
                    sourceLoaded = true;
                    if (lang != scintilla.language) {
                        scintilla.language = lang || "Text";
                    }
                    var lineno = profileItem.line - 1;
                    scimoz.gotoLine(lineno);
                    scimoz.markerAdd(lineno, ko.markers.MARKNUM_CURRENT_LINE_BACKGROUND);
                } catch(ex) {
                    // Display error for why we couldn't open the file.
                    scintilla.language = "Text"
                    scimoz.text = "<Source code unavailable - " + ex + ">";
                }
            } else {
                scintilla.language = "Text";
                scimoz.text = "<Source code unavailable>";
            }
        }

        // Show line numbers.
        let numLinesToAccountFor = Math.max(1000, scimoz.lineCount*2);
        let textWidth = scimoz.textWidth(0, numLinesToAccountFor.toString());
        let padding = 5;
        scimoz.setMarginWidthN(scimoz.MARGIN_LINENUMBERS, textWidth + padding);
        scimoz.setMarginWidthN(scimoz.MARGIN_SYMBOLS, 4); // Small padding margin.

        return sourceLoaded;
    } catch (e) {
        _profiler_log.exception(e);
    }
    return false;
}

function profiler_onLoad() {
    // Check window arguments for something to load.
    if ("arguments" in window && window.arguments[0]) {
        if ("profile_fileuri" in window.arguments[0]) {
            load_fileuri(window.arguments[0].profile_fileuri);
        } else if ("profile_data" in window.arguments[0]) {
            load_data(window.arguments[0].profile_data,
                      window.arguments[0].base64format);
        } else {
            document.getElementById("profiler_deck").selectedIndex = 2;
        }
    } 
    
    // Hack to define global gEditorTooltipHandler - which gets used by any scintilla views.
    window.gEditorTooltipHandler = null;
}

function profiler_onUnload() {
    
}
