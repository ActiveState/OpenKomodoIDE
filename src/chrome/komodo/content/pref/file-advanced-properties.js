/* Copyright (c) 2000-2009 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

var log = ko.logging.getLogger("pref.file-advanced-properties");
var dialog = {};
var local_prefset = {};

function OnPreferencePageLoading(prefset) {
    local_prefset = prefset;
    dialog.colorizing_enabled = window.document.getElementById("colorizing_enabled");
    update_state();
}

function update_state() {

}
