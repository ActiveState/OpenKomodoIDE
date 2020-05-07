/* Copyright (c) 2000-2008 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/*
 * Formatter preferences panel.
 *
 * Requires: xtk.dataTreeView
 *
 * Contributers:
 *  - Todd Whiteman (ToddW@ActiveState.com)
 */

//----------------------------
//       Globals            //
//----------------------------

xtk.include("treeview");

var log = ko.logging.getLogger('formatter-prefs');
//log.setLevel(ko.logging.LOG_DEBUG);

var gFormatterPrefset = null;
var gFormattersTreeView = null;
var gLang = null;
var gFormatterConfigurations = null;


//----------------------------
//     Formatter Class      //
//----------------------------

function ConfiguredFormatter(uuid, prefs) {
    this.uuid = uuid;
    this.prefs = prefs;
    this.lang = "";
    this.name = "";
    this._formatter_name = "";
    this._formatter_pretty_name = null;
    this.is_default_for_lang = false;
    // Load from the prefset.
    this.loadFromPrefs();
}
ConfiguredFormatter.prototype = {
    get formatter_name() { return this._formatter_name; },
    set formatter_name(val) {
        this._formatter_name = val;
        this._formatter_pretty_name = null;
    },
    get formatter_pretty_name() {
        if ((this._formatter_pretty_name == null) && (this._formatter_name)) {
            var formatterSvc = Components.classes["@activestate.com/koFormatterService;1"].
                                getService(Components.interfaces.koIFormatterService);
            var formatter = formatterSvc.getFormatterWithName(this._formatter_name);
            if (formatter) {
                this._formatter_pretty_name = formatter.prettyName;
            } else {
                this._formatter_pretty_name = "(Unknown formatter: " + this._formatter_name + ")";
            }
        }
        return this._formatter_pretty_name || "";
    },
    loadFromPrefs: function() {
        this.lang                = this.prefs.getString("lang", "");
        this.name                = this.prefs.getString("name", "");
        this.formatter_name      = this.prefs.getString("formatter_name", "");
    },
    saveToPrefs: function(prefset) {
        this.prefs.setStringPref("lang", this.lang);
        this.prefs.setStringPref("name", this.name);
        this.prefs.setStringPref("formatter_name", this.formatter_name);
        prefset.setPref(this.uuid, this.prefs)
    }
}

//----------------------------
//       TreeView           //
//----------------------------

function _formattersTreeView(initial_rows) {
    if (!initial_rows) {
        // Default value then
        this._rows = [];
    } else {
        this._rows = initial_rows;
    }
    // Disable sorting.
    this.enableSorting = false;
};
// The following two lines ensure proper inheritance (see Flanagan, p. 144).
_formattersTreeView.prototype = new xtk.dataTreeView();
_formattersTreeView.prototype.constructor = _formattersTreeView;

// Override getCellText method for assigning the celltext
_formattersTreeView.prototype.getCellText = function(row, column) {
    /**
     * @type {ConfiguredFormatter}
     */
    var forRow = this._rows[row];
    switch (column.id) {
        case 'formatters_treecol_is_default':
            return "";
        case 'formatters_treecol_language':
            return forRow.lang;
        case 'formatters_treecol_name':
            return forRow.name;
        case 'formatters_treecol_formatter_name':
            return forRow.formatter_pretty_name;
    }
    return "(Unknown column: " + column.id + ")";
};
_formattersTreeView.prototype.getCellValue = function(row, column)
{
    if (column.id == "formatters_treecol_is_default") {
        return this.rows[row].is_default_for_lang;
    }
    return null;
};
_formattersTreeView.prototype.selectFormatter = function(formatter)
{
    var idx = this._rows.indexOf(formatter);
    if (idx >= 0) {
        this.currentIndex = idx;
        this.selection.select(idx);
        this.tree.ensureRowIsVisible(idx);
    }
};


//----------------------------
//    Utility Functions     //
//----------------------------

function getSelectedFormatterIndex() {
    var tree = document.getElementById('formatters_tree');
    return tree.currentIndex;
}

function getSelectedFormatter() {
    var idx = getSelectedFormatterIndex();
    if (idx >= 0) {
        return gFormattersTreeView[idx];
    }
    return null;
}

function select_default_formatter_for_language(lang) {
    gLang = lang;
    for (var i=0; i < gFormatterConfigurations.length; i++) {
        if (gFormatterConfigurations[i].lang == lang) {
            gFormattersTreeView.selectFormatter(gFormatterConfigurations[i]);
            break;
        }
    }
    //this.mainTreeView.ensureRowIsVisible(row);
}

function mark_the_default_formatters(formatterConfigs) {
    var lang;
    var lang_seen = {};
    for (var i=0; i < formatterConfigs.length; i++) {
        lang = formatterConfigs[i].lang;
        if ((lang != "*") && !(lang in lang_seen)) {
            lang_seen[lang] = true;
            formatterConfigs[i].is_default_for_lang = true;
        } else {
            formatterConfigs[i].is_default_for_lang = false;
        }
    }
}

function get_configured_formatters_from_prefset(prefset) {
    var configured_formatters = [];
    if (prefset.hasPref('configuredFormatters')) {
        /**
         * @type {Components.interfaces.koIOrderedPreference}
         */
        var orderedPreference = prefset.getPref('configuredFormatters');
        
        try {
            /**
             * @type {Components.interfaces.koIPreferenceSet}
             */
            var fpref;
            var uuid;
            var formatterConfig;
            for (var i=0; i < orderedPreference.length; i++) {
                uuid = orderedPreference.getString(i);
                fpref = prefset.getPref(uuid);
                if (fpref) {
                    formatterConfig = new ConfiguredFormatter(uuid, fpref);
                    configured_formatters.push(formatterConfig);
                }
            }
        } catch (e)
        {
            log.warn('Exception while getting configured formatters, deleting configuredFormatters so this feature doesnt just stop working outright');
            prefset.deletePref('configuredFormatters');
        }
    }
    return configured_formatters;
}

/**
 * Save the currently configured formatters to preferences.
 * @argument {array} formatters  List of formatters.
 * @argument prefset {Components.interfaces.koIPreferenceSet}
 *           The preference set.
 */
function save_configured_formatters_to_prefset(formatters, prefset) {
    if (!formatters) {
        dump("No configured formatters...\n");
        if (prefset.hasPref('configuredFormatters')) {
            prefset.deletePref('configuredFormatters');
        }
        return;
    }

    /**
     * @type {ConfiguredFormatter}
     */
    var formatter;
    var orderedPreference = Components.classes["@activestate.com/koOrderedPreference;1"].
                    createInstance(Components.interfaces.koIOrderedPreference);
    for (var i=0; i < formatters.length; i++) {
        formatter = formatters[i];
        formatter.saveToPrefs(prefset);
        orderedPreference.appendString(formatter.uuid);
    }
    prefset.setPref('configuredFormatters', orderedPreference);
}


//----------------------------
//     Event Handlers       //
//----------------------------

function createNewFormatter() {
    try {
        var pref = Components.classes["@activestate.com/koPreferenceSet;1"].
                    createInstance(Components.interfaces.koIPreferenceSet);
        var uuidGenerator = Components.classes["@mozilla.org/uuid-generator;1"]
                            .getService(Components.interfaces.nsIUUIDGenerator);
        var uuid = uuidGenerator.generateUUID();
        var configuredFormatter = new ConfiguredFormatter(uuid, pref);
        //var formatters = [formatter];
        //gFormattersTreeView.setTreeRows(formatters);
        //return;
        var obj = {
            editType: "new",
            retval: "",
            configuredFormatter: configuredFormatter
        };
        ko.windowManager.openDialog("chrome://komodo/content/formatters/pref-formatter-editor.xul",
                "Komodo:FormatterEditor",
                "chrome,dialog,modal,resizable,close,centerscreen",
                obj);
        if (obj.retval == "OK") {
            gFormatterConfigurations.push(configuredFormatter);
            mark_the_default_formatters(gFormatterConfigurations);
            gFormattersTreeView.setTreeRows(gFormatterConfigurations);
        }
    } catch (ex) {
        log.exception(ex);
    }
}

function editSelectedFormatter() {
    try {
        var idx = getSelectedFormatterIndex();
        if (idx >= 0) {
            var configuredFormatter = gFormattersTreeView.rows[idx];
            var obj = {
                editType: "edit",
                retval: "",
                configuredFormatter: configuredFormatter
            };
            ko.windowManager.openDialog("chrome://komodo/content/formatters/pref-formatter-editor.xul",
                    "Komodo:FormatterEditor",
                    "chrome,dialog,modal,resizable,close,centerscreen",
                    obj);
            if (obj.retval == "OK") {
                var idx = gFormatterConfigurations.indexOf(configuredFormatter);
                gFormatterConfigurations.splice(idx, 1);
                gFormatterConfigurations.push(configuredFormatter);
                mark_the_default_formatters(gFormatterConfigurations);
                gFormattersTreeView.setTreeRows(gFormatterConfigurations);
            }
        }
    } catch (ex) {
        log.exception(ex);
    }
}

function deleteSelectedFormatter() {
    try {
        var idx = getSelectedFormatterIndex();
        if (idx >= 0) {
            var idx = gFormatterConfigurations.indexOf(gFormattersTreeView.rows[idx]);
            gFormatterConfigurations.splice(idx, 1);
            mark_the_default_formatters(gFormatterConfigurations);
            gFormattersTreeView.setTreeRows(gFormatterConfigurations);
        }
    } catch (ex) {
        log.exception(ex);
    }
}

function markAsDefaultSelectedFormatter() {
    try {
        var idx = getSelectedFormatterIndex();
        if (idx >= 0) {
            var configuredFormatter = gFormattersTreeView.rows[idx];
            var idx = gFormatterConfigurations.indexOf(configuredFormatter);
            gFormatterConfigurations.splice(idx, 1);
            gFormatterConfigurations = [configuredFormatter].concat(gFormatterConfigurations);
            mark_the_default_formatters(gFormatterConfigurations);
            gFormattersTreeView.setTreeRows(gFormatterConfigurations);
        }
    } catch (ex) {
        log.exception(ex);
    }
}

function formatters_onTreeDblClick(event) {
    try {
        
        editSelectedFormatter();
    } catch (ex) {
        log.exception(ex);
    }
}

function onContextPopupShowing(event) {
    try {
        var tree = document.getElementById('formatters_tree');
        var row = tree.treeBoxObject.getRowAt(event.clientX, event.clientY);
        if (row < 0) {
            return false;
        }
    } catch (ex) {
        log.exception(ex);
    }
    return true;
}

function OnPreferencePageLoading(prefset)
{
    try {
        gFormatterPrefset = prefset;
        // Load the formatter preferences.
        var configured_formatters = get_configured_formatters_from_prefset(prefset);
        // Make a copy of the configurations, separate from the treeview data.
        gFormatterConfigurations = configured_formatters.slice();
        mark_the_default_formatters(gFormatterConfigurations);
    
        // Load the tree view and assign it to the tree.
        var tree = document.getElementById('formatters_tree');
        gFormattersTreeView = new _formattersTreeView(configured_formatters);
        tree.treeBoxObject.view = gFormattersTreeView;

        if (parent.opener) {
            // If the user is editing a file, chances are they want to customize the
            // formatter for that specific language.
            var currentView = getKoObject('views').manager.currentView;
            if (currentView && currentView.koDoc) {
                var lang = currentView.koDoc.language;
                select_default_formatter_for_language(lang);
            }
        }
    
    } catch (ex) {
        log.exception(ex);
    }
}

function OnPreferencePageOK(prefset)
{
    try {
        save_configured_formatters_to_prefset(gFormattersTreeView.rows, prefset);
    } catch (ex) {
        log.exception(ex);
    }
    return true;
}

function PrefFormatters_OnLoad() {
    try {
        parent.hPrefWindow.onpageload();
    } catch (ex) {
        log.exception(ex);
    }
}

