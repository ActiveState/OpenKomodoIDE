/* Copyright (c) 2011 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function DBXRelativeJSDate() {
}

DBXRelativeJSDate.prototype = {
    'label': 'as relative JS date',
    
    'supportedType':'integer',
    
    'convert': function(rawValue) {
        if (rawValue.length == 0) return "";
        var nowTime = (new Date()).valueOf();
        var laterTime = new Date(nowTime + parseInt(rawValue));
        return laterTime.toString();
    },

    classID: Components.ID('{9bd9eb85-f919-48b9-a43e-c9792373ccc8}'),
    QueryInterface: XPCOMUtils.generateQI([Ci.koIDBXCellDataConverter]),
    classDescription: 'Komodo DBX Explorer JS Relative Date Converter',
    contractID: '@activestate.com/KoDBX_JS_RelativeDateConverter;1',
    _xpcom_categories: [{category: 'komodo-DBX-DataConverters'}]
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([DBXRelativeJSDate]);
