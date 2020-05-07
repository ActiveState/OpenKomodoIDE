/* Copyright (c) 2000-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* -*- Mode: JavaScript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

xtk.include("controller");

(function() {

var handlers = {
    'cmd_helpAbout': 'ko.launch.about()',
    'cmd_viewBottomPane': function() ko.uilayout.togglePane("workspace_bottom_area"),
    'cmd_viewLeftPane': function() ko.uilayout.togglePane("workspace_left_area"),
    'cmd_viewRightPane': function() ko.uilayout.togglePane("workspace_right_area"),
    'cmd_viewToolbox': function() ko.uilayout.toggleTab("toolbox2viewbox"),
    'cmd_focusProjectPane': function() ko.uilayout.focusPane("workspace_left_area"),
    'cmd_focusToolboxPane': function() ko.uilayout.focusPane("workspace_right_area"),
    'cmd_focusBottomPane': function() ko.uilayout.focusPane("workspace_bottom_area"),
    'cmd_focusEditor': function() { var view = ko.views.manager.currentView;
                                    if (view) view.setFocus(); },
    'cmd_focusSource': function() { var view = ko.views.manager.currentView;
                                    if (view) view.viewSource(); },
    'cmd_toggleMenubar': 'ko.uilayout.toggleMenubar()',
    'cmd_toggleToolbars': 'ko.uilayout.toggleToolbars()',
    'cmd_toggleSideToolbar': 'ko.uilayout.toggleToolbars("toolbox_side")',
    'cmd_viewFullScreen': 'ko.uilayout.fullScreen()',
    'cmd_editPrefs': 'prefs_doGlobalPrefs(null)',
    'cmd_helpHelp': 'ko.help.open()',
    'cmd_helpShowKeybindings': 'ko.browse.showKeybindings()',
    'cmd_helpPerlRef_Web': 'ko.browse.webHelp("Perl")',
    'cmd_helpPerlMailingLists': 'ko.browse.aspnMailingList("Perl")',
    'cmd_helpPythonRef_Web': 'ko.browse.webHelp("Python")',
    'cmd_helpPythonMailingLists': 'ko.browse.aspnMailingList("Python")',
    'cmd_helpPython3Ref_Web': 'ko.browse.webHelp("Python3")',
    // No mailing lists for python3
    'cmd_helpPHPRef_Web': 'ko.browse.webHelp("PHP")',
    'cmd_helpPHPMailingLists': 'ko.browse.aspnMailingList("PHP")',
    'cmd_helpRubyRef_Web': 'ko.browse.webHelp("Ruby")',
    'cmd_helpRubyMailingLists': 'ko.browse.aspnMailingList("Ruby")',
    'cmd_helpTclRef_Web': 'ko.browse.webHelp("Tcl")',
    'cmd_helpTclMailingLists': 'ko.browse.aspnMailingList("Tcl")',
    'cmd_helpXSLTMailingLists': 'ko.browse.openUrlInDefaultBrowser("http://www.biglist.com/lists/xsl-list/archives/")',
    'cmd_helpXSLTRef_Web': 'ko.browse.openUrlInDefaultBrowser("http://developer.mozilla.org/en/docs/XSLT")',
    'cmd_helpKomodoMailLists': 'ko.browse.browseTag("mailLists")',
    'cmd_helpActiveState': 'ko.browse.browseTag("home");',
    'cmd_helpASPN': 'ko.browse.browseTag("aspn")',
    'cmd_helpCommunity': 'ko.browse.browseTag("community")',
    'cmd_helpViewBugs': 'ko.browse.browseTag("bugs")',
    'cmd_helpContactUs': 'ko.browse.browseTag("contactus")',
    'cmd_helpLanguage': 'ko.help.language()',
    'cmd_helpLanguageAlternate': 'ko.help.alternate()',
    'cmd_helpViewErrorLog': 'ko.help.viewErrorLog()',
    'cmd_komodoMemoryUsage': 'ko.help.memoryUsage()',
    'cmd_toolsWatchFile': 'ko.launch.watchLocalFile()',
    'cmd_toolsRunCommand': 'ko.launch.runCommand()',
    'cmd_toolsRx': 'ko.launch.rxToolkit()',
    'cmd_newWindow': 'ko.launch.newWindow()',
    'cmd_nextWindow': 'ko.windowManager.focusNextWindow()',
    'cmd_previousWindow': 'ko.windowManager.focusPreviousWindow()',
    'cmd_open': 'ko.open.filePicker()',
    'cmd_open_remote': 'ko.filepicker.openRemoteFiles()',
    'cmd_new': 'ko.views.manager.doNewViewAsync()',
    'cmd_newTab': 'ko.open.quickStart()',
    'cmd_newTemplate': 'ko.projects.chooseTemplate()',
    'cmd_showQuicklaunch': 'ko.views.manager.showQuicklaunch()',
    'cmd_quit': 'ko.main.quitApplication()',
    'cmd_findInFiles': 'ko.launch.findInFiles()',
    'cmd_replaceInFiles': 'ko.launch.replaceInFiles()',
    'cmd_nextLintResult': 'ko.lint.jumpToNextLintResult()',
    'cmd_lintClearResults': 'ko.lint.clearResults()',
    'cmd_lintNow': 'ko.lint.doRequest(true)',
    '__END__' : null
}

// The following controller is for any <command> or <broadcaster>
// that doesn't fit into any other controller.  It is generally
// used for commands that don't ever get disabled.

function broadcasterController() {
    if (typeof(ko.main) != "undefined") {
        ko.main.addWillCloseHandler(this.destructor, this);
    } else {
        // ko.main will not be defined in dialogs that load controller.js.
        var self = this;
        window.addEventListener("unload", function() { self.destructor(); }, false);
    }
}

// The following two lines ensure proper inheritance (see Flanagan, p. 144).
broadcasterController.prototype = new xtk.Controller();
broadcasterController.prototype.constructor = broadcasterController;

broadcasterController.prototype.destructor = function() {
    window.controllers.removeController(this);
}

broadcasterController.prototype.isCommandEnabled = function(cmdName) {
    if (cmdName in handlers) {
        return true;
    };
    return false;
}

broadcasterController.prototype.supportsCommand = broadcasterController.prototype.isCommandEnabled;

broadcasterController.prototype.doCommand = function(cmdName) {
    if (cmdName in handlers) {
        if (handlers[cmdName] instanceof Function) {
            return handlers[cmdName]();
        } else {
            return eval(handlers[cmdName]);
        }
    };
    return false;
}

window.controllers.appendController(new broadcasterController());


}).apply();
