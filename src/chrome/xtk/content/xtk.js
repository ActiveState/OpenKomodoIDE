/**
 * Copyright (c) 2006,2007 ActiveState Software Inc.
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Contributors:
 *   Shane Caraveo <shanec@activestate.com>
 */

/**
 * xtk library contains usefull JavaScript/XPCOM/XUL functionality that
 * is not specific to Komodo
 */
var xtk = {};

/**
 * XPCOM global support to ease typing
 */

var CC = Components.classes;
var CI = Components.interfaces;

/**
 * get a reference to an XPCOM service
 *
 * @param {String} cName Components.classes string
 * @param {String} ifaceName Components.interfaces name as a string
 * @returns reference to service
 */
function CCSV(cName, ifaceName)
{
    return CC[cName].getService(CI[ifaceName]);        
};

/**
 * create an XPCOM instance
 *
 * @param {String} cName Components.classes string
 * @param {String} ifaceName Components.interfaces name as a string
 * @returns reference to instance
 */
function CCIN(cName, ifaceName)
{
    return CC[cName].createInstance(CI[ifaceName]);
};

/**
 * query an XPCOM reference for an interface
 *
 * @param {Object} cName reference to XPCOM object
 * @param {long} iface Components.interfaces element
 * @returns reference to instance with the specified interface
 */
function QI(obj, iface)
{
    return obj.QueryInterface(iface);
};

/**
 * load
 * 
 * load a JavaScript file into the global namespace or a defined namespace
 *
 * @param {String} uri uri to a JavaScript File
 * @param {Object} obj object to load the JavaScript into, if undefined loads into global namespace
 */
xtk.load = function(uri, obj) {
    const loader = CCSV("@mozilla.org/moz/jssubscript-loader;1", "mozIJSSubScriptLoader");
    loader.loadSubScript(uri, obj);
}

/**
 * include
 * 
 * include an xtk namespace
 *
 * @param {String} uri namespace to import
 */
xtk.include = function(ns) {
    if (typeof(xtk[ns]) == "undefined") {
        var filename = "chrome://xtk/content/"+ns+".js";
        this.load(filename);
    }
}
xtk.include("logging");

/**
 * importNS
 * 
 * import one namespace into another
 *
 * @param {Object} ns namespace to import INTO
 * @param {Object} ns namespace to import FROM
 */
xtk.importNS = function(to, from) {
    for (var i in from) {
        to[i] = from[i];
    }
}
