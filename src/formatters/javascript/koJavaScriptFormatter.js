/* Copyright (c) 2000-2008 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/js_beautify.js");

function koJavaScriptFormatter() { }

koJavaScriptFormatter.prototype = {
    // XPCOM fields
    classDescription: "Komodo JavaScript Formatter",
    classID:          Components.ID("{a151657b-ec6f-4494-9e43-8bbae2bca701}"),
    contractID:       "@activestate.com/koFormatter?name=js_beautifer;1",
    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.koIFormatter]),
    // [optional] an array of categories to register this component in.
    _xpcom_categories: [{ category: "category-komodo-formatter" }],

    // Internal
    _supported_languages: ["JavaScript", "JSON", "Node.js"],

    // koIFormatter fields
    name: "js_beautifier",
    prettyName: "JS Beautifier",
    supportsLanguage: function(lang) {
        return this._supported_languages.indexOf(lang) >= 0;
    },
    getSupportedLanguages: function(count, retv) {
        count.value = this._supported_languages.length;
        return this._supported_languages;
    },
    format: function(context) {
        var options = {};
        var prefs = context.prefset;
        var formatter_prefset = context.formatter_prefset;
        options.indent_size = prefs.getLong("indentWidth", 4);
        options.indent_with_tabs = prefs.getBoolean("useTabs", false);
        // User configured preferences.
        if (formatter_prefset.hasPref("jsBeautifyFormatterPrefs")) {
            prefs = formatter_prefset.getPref("jsBeautifyFormatterPrefs");
            options.brace_style = prefs.getString("brace_style", "collapse");
            options.preserve_newlines = prefs.getBoolean("preserve_newlines", true);
            options.jslint_happy = prefs.getBoolean("jslint_happy", false);
            options.break_chained_methods = prefs.getBoolean("break_chained_methods", false);
            options.keep_array_indentation = prefs.getBoolean("keep_array_indentation", false);
            options.keep_function_indentation = prefs.getBoolean("keep_function_indentation", false);
            options.unescape_strings = prefs.getBoolean("unescape_strings", false);
            options.space_before_conditional = prefs.getBoolean("space_before_conditional", true);
        }

        context.text = js_beautify(context.text, options);
    }
};

if ("generateNSGetFactory" in XPCOMUtils) {
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([koJavaScriptFormatter]);
} else if ("generateNSGetModule" in XPCOMUtils) {
    var NSGetModule = XPCOMUtils.generateNSGetModule([koJavaScriptFormatter]);
}
