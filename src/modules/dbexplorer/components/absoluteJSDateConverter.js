/* Copyright (c) 2011 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function DBXAbsoluteJSDate() {
}

DBXAbsoluteJSDate.prototype = {
    'label': 'as absolute JS date',
    
    'supportedType':'integer',
    
    'convert': function(rawValue) {
        if (rawValue.length == 0) return "";
        try {
            return (new Date(parseInt(rawValue))).toString();
        } catch(ex) {
            dump("Can't convert " + rawValue + " into a date\n");
            return rawValue;
        }
    },

    classID: Components.ID('{a4904f97-4a23-4d49-ac44-b3a48f0c3361}'),
    QueryInterface: XPCOMUtils.generateQI([Ci.koIDBXCellDataConverter]),
    classDescription: 'Komodo DBX Explorer JS Absolute Date Converter',
    contractID: '@activestate.com/KoDBX_JS_AbsoluteDateConverter;1',
    _xpcom_categories: [{category: 'komodo-DBX-DataConverters'}]
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([DBXAbsoluteJSDate]);
