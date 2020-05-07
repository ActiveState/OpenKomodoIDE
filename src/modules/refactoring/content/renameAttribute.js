/* Copyright (c) 2000-2013 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* Komodo's Refactoring/Rename-Attribute first dialog
 * Based on the Find and Replace dialog (rev 2).
 */

//---- globals

var { classes: Cc, interfaces: Ci, utils: Cu } = Components;

var log = ko.logging.getLogger("renameClassMember.dialog");
//log.setLevel(ko.logging.LOG_DEBUG);

var widgets = null; // object storing interesting XUL element references
var gFindSvc = null;
var _g_prefs = null;

var _g_searchText = null;
var _g_defn = null;
var _g_view = null;
var _g_refactoringLanguageObj = null;
var _g_languageName = null;
 
var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
      .getService(Components.interfaces.nsIStringBundleService)
      .createBundle("chrome://komodo/locale/find/find2.properties");

const koIFindOptions = Ci.koIFindOptions;

//---- public methods for the dialog

function onLoad() {
    try {
        _g_prefs = Components.classes["@activestate.com/koPrefService;1"]
            .getService(Components.interfaces.koIPrefService).prefs;
        gFindSvc = Components.classes["@activestate.com/koFindService;1"].
                   getService(Components.interfaces.koIFindService);
        _init_widgets();
        // Necessary for re-launching (i.e. Ctrl+F when the dialog is already open).
        window.focus();
        _init();
        update(null);
    } catch (ex) {
        log.exception(ex);
    }
}

/**
 * Update as appropriate for some change in the dialog.
 *
 * @param {string} changed The name of the thing that changed. If
 *      null or not specified *everything* is updated (used for dialog
 *      initialization).
 */
function update(changed /* =null */) {
    if (typeof(changed) == "undefined") changed = null;
    
    var ui_changed = false;
    var opts = gFindSvc.options;
    
    if (changed == "repl" || changed === null) {
        widgets.replace_all_btn.disabled = !widgets.repl.value;
        widgets.replace_all_btn_force.disabled = !widgets.repl.value;
    }

    if (changed == null || changed == "dirs") {
        opts.encodedFolders = widgets.dirs.value;
    }
}

/**
 * Change the "Search in:" menulist to the given value.
 */
function search_in(value)
{
    try {
        widgets.search_in_menu.value = value;
        update('search-in');
    } catch(ex) {
        log.exception(ex);
    }
}


/**
 * Handle the onfocus event on the 'dirs' textbox.
 */
function dirs_on_focus(widget, event)
{
    try {
        widget.setSelectionRange(0, widget.textLength);
        // For textbox-autocomplete (TAC) of directories on this widget we
        // need a cwd with which to interpret relative paths. The chosen
        // cwd is that of the current file in the main editor window.
        if (event.target.nodeName == 'html:input') { 
            var textbox = widget.parentNode.parentNode.parentNode;
            var cwd = ko.windowManager.getMainWindow().ko.window.getCwd();
            textbox.searchParam = ko.stringutils.updateSubAttr(
                textbox.searchParam, 'cwd', cwd);            
        }
    } catch(ex) {
        log.exception(ex);
    }
}


function browse_for_dirs() {
    try {
        var currDir = opener.ko.uriparse.dirName(_g_defn.path);
        var obj = {
            encodedFolders: widgets.dirs.value,
            cwd: currDir};
        window.openDialog("chrome://komodo/content/find/browseForDirs.xul",
                          "_blank",
                          "chrome,modal,titlebar,resizable",
                          obj);
        if (obj.retval != "Cancel") {
            widgets.dirs.value = obj.encodedFolders;
            update("dirs");
        }
    } catch(ex) {
        log.exception(ex);
    }
}

function replace_all(force=false) {
    try {
        var pattern = _g_searchText;
        if (! pattern) {
            return;
        }
        var repl = widgets.curr_repl.value;
        const addFromACTextbox = false;

        if (addFromACTextbox) {
        ko.mru.addFromACTextbox(widgets.repl);
        }

        // Always reset the find session for replace all
        var findSessionSvc = Components.classes["@activestate.com/koFindSession;1"].
            getService(Components.interfaces.koIFindSession);
        findSessionSvc.Reset();

        if (addFromACTextbox)
            ko.mru.addFromACTextbox(widgets.dirs);

        let searchText = _g_searchText;
        let replaceText = widgets.repl.value;
        // PHP Attributes: Ignore the '$' at the start of a name
        if (_g_languageName == "PHP") {
            if (searchText[0] == '$') {
                searchText = searchText.substring(1);
            }
            if (replaceText[0] == '$') {
                replaceText = replaceText.substring(1);
            }
        }
        ko.windowManager.openDialog(
        //XXX: Rename the XUL file
            "chrome://refactoring/content/confirmRenameAttributeChanges.xul",
                    "komodo_refactoring_confirmRenameAttributeChanges",
                    "chrome,close=yes,centerscreen,resizable",
                    {
                            pattern: searchText,
                            repl: replaceText,
                            matchCase: true,
                            dirs: widgets.dirs.value,
                            search_in_subdirs: true,
                            includes: widgets.includes.value,
                            excludes: widgets.excludes.value,
                            defn: _g_defn,
                            view: _g_view,
                            ko: opener.ko,
                            refactoringLanguageObj: _g_refactoringLanguageObj,
                            force: force
                            
                    });
        window.close();
    } catch (ex) {
        log.exception(ex);
    }
}



//---- internal support stuff

function do_keypress(event) {
    if (event.keyCode == event.DOM_VK_RETURN
        && !widgets.replace_all_btn.disabled) {
        replace_all();
    }
}

// Load the global 'widgets' object, which contains references to
// interesting elements in the dialog.
function _init_widgets()
{
    if (widgets != null) {
        return; // was already called
    }
    widgets = new Object();

    widgets.repl_row = document.getElementById('repl-row');
    widgets.repl = document.getElementById('repl');
    widgets.curr_repl = widgets.repl;

    widgets.dirs_row = document.getElementById('dirs-row');
    widgets.dirs = document.getElementById('dirs');
    widgets.includes = { value: "" };
    widgets.excludes = { value: "" };

    widgets.replace_all_btn = document.getElementById('replace-all-btn');
    widgets.replace_all_btn_force = document.getElementById('replace-all-btn-force');
    window.addEventListener("keypress", do_keypress, false);
}

let komodoInternalExtensions = {
    "Python": ["*.ksf"],
    "Perl": ["Conscript", "Construct"]
}

const _aliasLangs = {
                    "Node.js" : "JavaScript",
                    "Python3" : "Python",
                    "HTML5": "HTML"
                };
function getActualLanguageName(languageName) {
    return languageName in _aliasLangs ? _aliasLangs[languageName] : languageName;
}
            
/**
 * Initialize the dialog from `opener.ko.launch.find2_dialog_args` data.
 */
function _init() {
    var args = window.arguments[0];
    _g_searchText = args.pattern;
    window.document.title = window.document.title + ": " + _g_searchText;
    _g_defn = args.defn;
    _g_view = args.view;
    _g_refactoringLanguageObj = args.refactoringLanguageObj;
    // Close this dialog when the opener goes away
    opener.addEventListener("unload", function unload(event) {
        window.close();
        event.target.removeEventListener(event.type, unload, false);
        window.removeEventListener("keypress", do_keypress, false);
    }, false);

    // Filter function, return false if the extension is known to
    // be an internal extension used by komodo
    let keepNonKomodoInternalExtensions = function(ext) {
        var languageName;
        if (_g_defn) {
            languageName = _g_defn.lang;
        } else {
            try {
               languageName = _g_view.koDoc.language; 
            } catch(e) {
                log.exception(e, "failed to get language name");
            }
        }
        if (!languageName) {
            log.debug("Failed to find a languageName");
            return true;
        }
        var exts = komodoInternalExtensions[languageName];
        if (exts) {
            return exts.indexOf(ext) == -1;
        }
        return true;
    }
    // Set other dialog data (from the given args and from the
    // koIFindService.options).
    var opts = gFindSvc.options;
    widgets.repl.value = "";
    // get the language and directory, allow for a null def'n
    var languageName = null;
    var startingDir = null;
    var currentDir = _g_view.koDoc.file.dirName;
    var defnDir = '';
    if (_g_defn && _g_defn.path) {
        defnDir = opener.ko.uriparse.dirName(_g_defn.path);
        languageName = _g_defn.lang;
    }
    if (!startingDir) {
        try {
            // Allow up to two candidates for the starting dir.
            // Use both the current file and the defn, if it exists.  If the
            // dir of one is a parent of the other, use that.
            // If both have the same parent, use that parent.
            // Finally, favor the current file.
            if (currentDir && defnDir) {
                // Convert all, even linux, because paths out of codeintel can have
                // different paths from the view.  We only are concerned about
                // directory names here, not files. If people are using dir names
                // that collide modulo case they have enough problems already.
                let currentDirToCompare = currentDir.toLowerCase();
                let defnDirToCompare = defnDir.toLowerCase();
                if (defnDirToCompare.indexOf(currentDirToCompare) == 0) {
                    startingDir = currentDir;
                } else if (currentDirToCompare.indexOf(defnDirToCompare) == 0) {
                    startingDir = defnDir;
                } else {
                    let parent1 = opener.ko.uriparse.dirName(currentDir);
                    let parent2 = opener.ko.uriparse.dirName(defnDir);
                    if (parent1.toLowerCase() == parent2.toLowerCase() && parent1 && /[\\\/]/.test(parent1)) {
                        startingDir = parent1;
                    }
                }
            } else if (currentDir) {
                startingDir = currentDir;
            } else if (defnDir) {
                startingDir = defnDir;
            } else {
                startingDir = opts.encodedFolders;
            }
        } catch(e) {
            log.exception(e, "Can't get dirName from current view");
            // Use the old one from the find service (yuk)
            startingDir = opts.encodedFolders;
        }
    }
    widgets.dirs.value = startingDir;
    if (!languageName) {
        try {
            languageName = _g_view.koDoc.language;
        } catch(e) {
            log.exception(e, "Can't get language from current view");
            
        }
    }
    if (languageName) {
        _g_languageName = languageName;
    }
    {
        let extensions;
        try {
            if (!languageName) {
                throw new Error("just fill in the defaults");
            }
            var langRegistrySvc = Components.classes["@activestate.com/koLanguageRegistryService;1"].
                                   getService(Ci.koILanguageRegistryService);
            var o1 = {}, o2 = {};
            langRegistrySvc.patternsFromLanguageName(getActualLanguageName(languageName), o1, o2);
            extensions = o1.value.filter(keepNonKomodoInternalExtensions);
            widgets.includes.value = extensions.join(",");
        } catch(ex) {
            extensions = opts.encodedIncludeFiletypes.split(',');
            widgets.includes.value = opts.encodedIncludeFiletypes;
        }
        widgets.excludes.value = (opts.encodedExcludeFiletypes
                                  .split(',')
                          .filter(function(ext) extensions.indexOf(ext) === -1)
                                  .join(','));
    }

    // The act of opening the find dialog should reset the find session.
    // This is the behaviour of least surprise.
    var findSessionSvc = Components.classes["@activestate.com/koFindSession;1"].
                            getService(Components.interfaces.koIFindSession);
    findSessionSvc.Reset();
    widgets.repl.select();
}

/**
 * Determine an appropriate koIFindContext instance for
 * searching/replacing, and set it to the `_g_find_context` global.
 *
 * @param {string} reason gives the reason for resetting the find context.
 *      This is only used for debugging.
 * 
 * Can return null if an appropriate context could not be determined.
 */
function reset_find_context() {
    var context = Cc["@activestate.com/koFindInFilesContext;1"]
        .createInstance(Ci.koIFindInFilesContext);
    context.type = Ci.koIFindContext.FCT_IN_FILES;

    // Use the current view's cwd for interpreting relative paths.
    if (_g_view != null &&
        _g_view.getAttribute("type") == "editor" &&
        _g_view.koDoc.file &&
        _g_view.koDoc.file.isLocal) {
        context.cwd = _g_view.koDoc.file.dirName;
    } else {
        context.cwd = gFindSvc.options.cwd;
    }
    
    _g_find_context = context;
}

function _toggle_collapse(widget) {
    if (widget.hasAttribute("collapsed")) {
        widget.removeAttribute("collapsed");
    } else {
        widget.setAttribute("collapsed", "true");
    }
}

function _collapse_widget(widget, collapse) {
    if (collapse) {
        widget.setAttribute("collapsed", "true");
    } else {
        if (widget.hasAttribute("collapsed"))
            widget.removeAttribute("collapsed");
    }
}

function _hide_widget(widget, hide) {
    if (hide) {
        widget.setAttribute("hidden", "true");
    } else {
        if (widget.hasAttribute("hidden"))
            widget.removeAttribute("hidden");
    }
}

function _disable_widget(widget) {
    widget.setAttribute("disabled", "true");
}
function _enable_widget(widget) {
    if (widget.hasAttribute("disabled")) {
        widget.removeAttribute("disabled");
    }
}

/**
 * Toggle whether the window is raised
 */
function toggle_pin() {
    var pinned = widgets.pin_btn.checked;
    _g_prefs.setBooleanPref("find-pinFindReplaceDialog", pinned);
    pinDialog(pinned);
}

function pinDialog(pinned) {
    function getXULWindowForDOMWindow(win)
        win.QueryInterface(Ci.nsIInterfaceRequestor)
           .getInterface(Ci.nsIWebNavigation)
           .QueryInterface(Ci.nsIDocShellTreeItem)
           .treeOwner
           .QueryInterface(Ci.nsIInterfaceRequestor)
           .getInterface(Ci.nsIXULWindow);
    let rootWin = getXULWindowForDOMWindow(window);
    let parentWin = ((opener && !opener.closed)
                     ? getXULWindowForDOMWindow(opener)
                     : null);
    try {
        Cc["@activestate.com/koIWindowManagerUtils;1"]
          .getService(Ci.koIWindowManagerUtils)
          .setOnTop(rootWin, parentWin, pinned);
    } catch(ex) {
        log.exception(ex, "pinDialog: Can't setOnTop");
    }
}

/**
 * Escape the given string for putting in a single-line textbox.
 * Primarily we put in C-escapes for EOL chars. We also try to normalize
 * EOLs to the EOL-style of the current view, if any. We do this because
 * Rx (from which these strings are coming) standardizes on '\n' EOLs -- even
 * on Windows.
 */
function _escape_for_textbox(s, scimoz_eol_mode /* =null */)
{
    if (typeof(scimoz_eol_mode) == "undefined") scimoz_eol_mode = null;
    if (scimoz_eol_mode == Components.interfaces.ISciMoz.SC_EOL_CRLF) {
        s = s.replace('\r\n', '\n').replace('\n', '\r\n');
    }
    return s.replace('\n', '\\n').replace('\r', '\\r');
}
// #endif
