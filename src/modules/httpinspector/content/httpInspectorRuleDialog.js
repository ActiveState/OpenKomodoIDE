/* Copyright (c) 2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/*
 * httpInspectorRule - HTTP proxy debugging.
 *
 * Contributers:
 *  - ToddW
 */

//----------------------------
//          globals         //
//----------------------------

var _httpInspectorRule_log = ko.logging.getLogger("httpInspectorRule");
//_httpInspectorRule.setLevel(ko.logging.LOG_DEBUG);
var _HIRule = null;

//----------------------------
//     internal routines    //
//----------------------------

function _httpInspectorRule(koHttpInspectorRule)
{
    try {
        this.rule = koHttpInspectorRule;
        this.ruleNameTextbox = document.getElementById('httpInspectorRule_textboxName');
        this.ruleTypeMenulist = document.getElementById('httpInspectorRule_menulistRuleType');
        this.ruleMatchTypeRadioGroup = document.getElementById('httpInspectorRule_radioMatchOn');
        this.richlistboxRequirement = document.getElementById('richlistboxRequirement');
        this.richlistboxAction = document.getElementById('richlistboxAction');
    } catch (e) {
        _httpInspectorRule_log.exception(e);
    }
}

_httpInspectorRule.prototype.loadFromRule = function ()
{
    try {
        // Load name
        this.ruleNameTextbox.value = this.rule.name;

        // Load rule type
        this.ruleTypeMenulist.value = this.rule.type;

        // Save match on value
        if (this.rule.match_any) {
            this.ruleMatchTypeRadioGroup.value = "2";
        } else {
            this.ruleMatchTypeRadioGroup.value = "1";
        }

        var tmpObject = new Object();
        // Load the requirements
        var requirements = this.rule.getRequirements(tmpObject);
        if (requirements.length > 0) {
            // Copy the first requirement
            this.richlistboxRequirement.firstChild.copyRuleRequirement(requirements[0]);
            //var richlistitems = this.richlistboxAction.getElementsByTagName("richlistitem");
            //richlistitems[0].copyRuleRequirement(requirements[0]);
            // Add any additional requirements
            for (var i=1; i < requirements.length; i++) {
                this.richlistboxRequirement.lastChild.addRow(requirements[i]);
            }
        }
        // Load the actions
        var actions = this.rule.getActions(tmpObject);
        if (actions.length > 0) {
            // Copy the first requirement
            this.richlistboxAction.firstChild.copyRuleAction(actions[0]);
            // Add any additional actions
            for (var i=1; i < actions.length; i++) {
                this.richlistboxAction.lastChild.addRow(actions[i]);
            }
        }
    } catch (e) {
        _httpInspectorRule_log.exception(e);
    }
}

_httpInspectorRule.prototype.saveToRule = function ()
{
    try {
        // Save name
        this.rule.name = this.ruleNameTextbox.value;

        // Save rule type
        this.rule.type = parseInt(this.ruleTypeMenulist.value);

        // Save match on value
        if (this.ruleMatchTypeRadioGroup.value == "1") {
            this.rule.match_any = false;
        } else {
            this.rule.match_any = true;
        }

        // Save the requirements
        var requirements = [];
        var richlistitems = this.richlistboxRequirement.getElementsByTagName("richlistitem");
        for (var i=0; i < richlistitems.length; i++) {
            requirements.push(richlistitems[i].getSavedRuleRequirement());
        }
        this.rule.setRequirements(requirements.length, requirements);

        // Save the actions
        var actions = [];
        var richlistitems = this.richlistboxAction.getElementsByTagName("richlistitem");
        for (var i=0; i < richlistitems.length; i++) {
            actions.push(richlistitems[i].getSavedRuleAction());
        }
        this.rule.setActions(actions.length, actions);
    } catch (e) {
        _httpInspectorRule_log.exception(e);
    }
}

_httpInspectorRule.prototype.updateUI = function ()
{
    try {
        // Load the rule into the listbox
        this.loadFromRule();

        // Disable remove row button if we only have one row
        var matches = this.richlistboxRequirement.getElementsByTagName("richlistitem");
        if (matches.length == 1) {
            matches[0].disableRemoveRowButton();
        }
        matches = this.richlistboxAction.getElementsByTagName("richlistitem");
        if (matches.length == 1) {
            matches[0].disableRemoveRowButton();
        }
    } catch (e) {
        _httpInspectorRule_log.exception(e);
    }
}

//----------------------------
//      public routines     //
//----------------------------

function httpInspectorRule_onLoad()
{
    try {
        _HIRule = new _httpInspectorRule(window.arguments[0].rule);
        _HIRule.updateUI();
    } catch (e) {
        _httpInspectorRule_log.exception(e);
    }
}

function httpInspectorRule_onUnload() {
}

function httpInspectorRule_onAccept() {
    try {
        _HIRule.saveToRule();
        window.arguments[0].returnValue = Components.interfaces.nsIFilePicker.returnOK;
        return true;
    } catch (e) {
        _httpInspectorRule_log.exception(e);
    }
    return false;
}
