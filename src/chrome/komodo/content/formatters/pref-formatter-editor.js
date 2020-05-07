/* Copyright (c) 2000-2008 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

var gEditType = null;
var gSelectedLang = null;
var gFormatter = null;
var gFormatterConfig = null;
var gLangFormatters = null;
var gOtherFormatters = null;
/* Chrome URL for the selected formatter's options */
var gOptionsURL = null;

function _buildMenuTree(hdata, hierarchy, toplevel) {

    if (hierarchy.container == true)  {
        // build menu
        var i, j;
        var children = new Object();
        var count = new Object();
        var menu;
        var menupopup;
        var viewAs_menuitems = new Array();
        hierarchy.getChildren(children, count);
        children = children.value;

        for (i=0;i<children.length;i++)  {
            viewAs_menuitems.push(_buildMenuTree(hdata, children[i], false));
        }
        if (!toplevel)  {
            menu = document.createElementNS(XUL_NS, 'menu');
            menupopup = document.createElementNS(XUL_NS, 'menupopup');
            menu.setAttribute('label', hierarchy.name);

            for (j=0;j<viewAs_menuitems.length;j++)  {
                menupopup.appendChild(viewAs_menuitems[j]);
            }
            menu.appendChild(menupopup);
            return menu;
        }
        return viewAs_menuitems;

    } else {
        var languageNameNospaces = hierarchy.name.replace(' ', '', 'g')
        var menuitem = document.createElementNS(XUL_NS, 'menuitem');
        menuitem.setAttribute("id", "formatter_language" + languageNameNospaces);
        menuitem.setAttribute('label', hierarchy.name);
        menuitem.setAttribute("accesskey", hierarchy.key);
        menuitem.setAttribute("oncommand", "select_formatter_language(this.label);");

        return menuitem;
    }
}

function buildLanguageMenus() {
    var hdata = {};
    var menupopup = document.getElementById("formatter_language_menupopup");
    try {
        var langService = Components.classes["@activestate.com/koLanguageRegistryService;1"].
                    getService(Components.interfaces.koILanguageRegistryService);
        var langHierarchy = langService.getLanguageHierarchy();
        var items = _buildMenuTree(hdata, langHierarchy, true);
        var all_menuitem = document.createElementNS(XUL_NS, 'menuitem');
        all_menuitem.setAttribute("id", "formatter_language_all");
        all_menuitem.setAttribute("label", "* - Any Language");
        all_menuitem.setAttribute("oncommand", "select_formatter_language('*');");
        menupopup.appendChild(all_menuitem);
        for (var i=0; i < items.length; i++)  {
            menupopup.appendChild(items[i]);
        }
    } catch (e) {
        log.exception(e);
    }
}

function buildFormatterMenus() {
    var hdata = {};
    var menupopup = document.getElementById("formatter_language_menupopup");
    try {
        var langService = Components.classes["@activestate.com/koLanguageRegistryService;1"].
                    getService(Components.interfaces.koILanguageRegistryService);
        var langHierarchy = langService.getLanguageHierarchy();
        var items = _buildMenuTree(hdata, langHierarchy, true);
        for (var i=0; i < items.length; i++)  {
            menupopup.appendChild(items[i]);
        }
    } catch (e) {
        log.exception(e);
    }
}

function select_formatter(formatter) {
    gFormatter = formatter;
    document.getElementById("formatters_for_language_menulist").setAttribute("label", formatter.prettyName);
    var options_vbox = document.getElementById("formatter_editor_options_vbox");
    var options_element = document.getElementById("formatter_editor_options");
    if (options_element) {
        options_vbox.removeChild(options_element);
    }
    options_element = document.createElement("formatter_options");
    options_element.setAttribute("id", "formatter_editor_options");
    options_element.setAttribute("type", formatter.name);
    options_vbox.appendChild(options_element);
    if (options_element.loadFromPrefs) {
        options_element.loadFromPrefs(gFormatterConfig.prefs);
    }
    // For formatters that provide an options binding, this will cause the
    // dialog to grow, contain additional XUL elements, so we need to resize the
    // dialog to ensure all the elements are visible.
    window.sizeToContent();
}

function select_formatter_in_langFormatters(idx) {
    var formatter = gLangFormatters[idx];
    select_formatter(formatter);
}

function select_formatter_in_otherFormatters(idx) {
    var formatter = gOtherFormatters[idx];
    select_formatter(formatter);
}

function populate_formatter_menu_for_lang(lang) {
    var formatterSvc = Components.classes["@activestate.com/koFormatterService;1"].
                        getService(Components.interfaces.koIFormatterService);
    var count_obj = {};
    var langFormatters = formatterSvc.getAllFormattersForLanguage(lang, count_obj);
    var allFormatters = formatterSvc.getAllFormatters(count_obj);
    gLangFormatters = langFormatters;

    var menupopup = document.getElementById("formatters_for_language_menupopup");
    // Remove any existing formatters.
    while (menupopup.lastChild) {
        menupopup.removeChild(menupopup.lastChild);
    }
    // Add formatters for the selected language.
    var menuitem;
    var formatter;
    for (var i=0; i < langFormatters.length; i++) {
        formatter = langFormatters[i];
        menuitem = document.createElementNS(XUL_NS, 'menuitem');
        menuitem.setAttribute("id", "formatter_" + formatter.name);
        menuitem.setAttribute('label', formatter.prettyName);
        menuitem.setAttribute('oncommand', "select_formatter_in_langFormatters(" + i + ")");
        menupopup.appendChild(menuitem);
    }
    // Work out if there are any "Other" formatters.
    gOtherFormatters = [];
    for (i=0; i < allFormatters.length; i++) {
        formatter = allFormatters[i];
        if (langFormatters.indexOf(formatter) == -1) {
            gOtherFormatters.push(formatter);
        }
    }
    if (gOtherFormatters.length > 0) {
        // Add an "Other" formatters menu.
        var other_menu = document.createElementNS(XUL_NS, 'menu');
        var strbundle = document.getElementById("formatter_strings");
        other_menu.setAttribute("label", strbundle.getString("otherFormattersMenulistLabel"));
        var other_menupopup = document.createElementNS(XUL_NS, 'menupopup');
        other_menu.appendChild(other_menupopup);
        // Add menuitems for all other formatters.
        for (i=0; i < gOtherFormatters.length; i++) {
            formatter = gOtherFormatters[i];
            menuitem = document.createElementNS(XUL_NS, 'menuitem');
            menuitem.setAttribute("id", "formatter_" + formatter.name);
            menuitem.setAttribute('label', formatter.prettyName);
            menuitem.setAttribute('oncommand', "select_formatter_in_otherFormatters(" + i + ")");
            other_menupopup.appendChild(menuitem);
        }
        menupopup.appendChild(other_menu);
    }
}

function select_formatter_language(lang) {
    // Show the formatter choices for this language.
    populate_formatter_menu_for_lang(lang);
    // Label as the selected language.
    document.getElementById("formatter_language_menulist").setAttribute("label", lang);
}

function PrefFormatterEditor_OnAccept()
{
    var name = document.getElementById("formatter_name_textbox").value;
    var lang = document.getElementById("formatter_language_menulist").getAttribute("label");
    var formatterName = gFormatter ? gFormatter.name : "";
    if (!name) {
        ko.dialogs.alert("You must specify a name for your configuration.");
        return false;
    }
    if (!formatterName) {
        ko.dialogs.alert("You must specify a formatter for your configuration.");
        return false;
    }
    if (!lang) {
        ko.dialogs.alert("You must specify a language for your configuration.");
        return false;
    }
    var options_element = document.getElementById("formatter_editor_options");
    if (options_element.saveToPrefs) {
        options_element.saveToPrefs(gFormatterConfig.prefs);
    }
    gFormatterConfig.name = name;
    gFormatterConfig.lang = lang;
    gFormatterConfig.formatter_name = formatterName;
    window.arguments[0].retval = "OK";
    return true;
}


function PrefFormatterEditor_OnLoad() {
    gFormatterConfig = window.arguments[0].configuredFormatter;
    gEditType = window.arguments[0].editType;
    var name_textbox = document.getElementById("formatter_name_textbox");
    name_textbox.value = gFormatterConfig.name;
    name_textbox.select();
    buildLanguageMenus();
    select_formatter_language(gFormatterConfig.lang);
    if (gFormatterConfig.formatter_name) {
        var formatterSvc = Components.classes["@activestate.com/koFormatterService;1"].
                            getService(Components.interfaces.koIFormatterService);
        var formatter = formatterSvc.getFormatterWithName(gFormatterConfig.formatter_name);
        select_formatter(formatter);
    }
}

