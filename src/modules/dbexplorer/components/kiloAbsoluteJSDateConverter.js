/* Copyright (c) 2011 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function DBXAbsoluteKiloJSDate() {
}

DBXAbsoluteKiloJSDate.prototype = {
    'label': 'as absolute JS date in milliseconds',
    
    'supportedType':'integer',
    
    'convert': function(rawValue) {
        if (rawValue.length == 0) return "";
        try {
            rawValue = parseInt(rawValue) / 1000;
            return (new Date(rawValue)).toString();
        } catch(ex) {
            dump("Can't convert " + rawValue + " into a date\n");
            return rawValue;
        }
    },


    classID: Components.ID('{47b74547-afdc-41f2-8935-ecd6e6259ebe}'),
    QueryInterface: XPCOMUtils.generateQI([Ci.koIDBXCellDataConverter]),
    classDescription: 'Komodo DBX Explorer JS Absolute KiloDate Converter',
    contractID: '@activestate.com/KoDBX_JS_AbsoluteKiloDateConverter;1',
    _xpcom_categories: [{category: 'komodo-DBX-DataConverters'}]
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([DBXAbsoluteKiloJSDate]);
