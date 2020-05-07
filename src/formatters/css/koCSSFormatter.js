/* Copyright (c) 2014-2015 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/cssbeautify.js");

function koCSSFormatter() { }

koCSSFormatter.prototype = {
    // XPCOM fields
    classDescription: "Komodo CSS Formatter",
    classID:          Components.ID("{d56ec2a1-b977-4714-b370-d39b61236a8f}"),
    contractID:       "@activestate.com/koFormatter?name=css_beautify;1",
    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.koIFormatter]),
    // [optional] an array of categories to register this component in.
    _xpcom_categories: [{ category: "category-komodo-formatter" }],

    // Internal
    _supported_languages: ["CSS", "Less", "Sass", "SCSS"],

    // koIFormatter fields
    name: "css_beautify",
    prettyName: "CSS Beautify",
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
        var indent = prefs.getLong("indentWidth", 4);
        var indent_string = '';
        for (var i=0; i < indent; i++) {
            indent_string += ' ';
        }
        options.indent = indent_string;
        // User configured preferences.
        if (formatter_prefset.hasPref("jsBeautifyFormatterPrefs")) {
            prefs = formatter_prefset.getPref("jsBeautifyFormatterPrefs");
            options.autosemicolon = prefs.getBoolean("autosemicolon", false);
        }

        context.text = cssformat(context.text, options);
    }
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([koCSSFormatter]);
