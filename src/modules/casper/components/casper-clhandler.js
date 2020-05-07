/* -*- Mode: JavaScript; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* Copyright (c) 2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/*
 * -casper commandline handler; starts unittests.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

/*
 * Classes
 */


function CasperConsoleHandler() {}
CasperConsoleHandler.prototype = {
    params: [],
    onload: null,
    eot: false,
    logfile: null,
    testsfile: null,
    timeoutafter: 1000 * 60 * 30 /* 30 mins */,
    windowHasOpened: false,

    /* nsICommandLineHandler */

    handle : function clh_handle(cmdLine) {
        try {
            //dump("Capser clh_handle:: Arguments:\n");
            //for (var i=0; i < cmdLine.length; i++) {
            //    dump("  Argument[" + i + "]: " + cmdLine.getArgument(i) + "\n");
            //}
            if (cmdLine.findFlag("casper", false) < 0) {
                return;
            }
            if (cmdLine.findFlag("eot", false) >= 0) {
                cmdLine.handleFlag("eot", false);
                this.eot = true;
            }
            if (cmdLine.findFlag("logfile", false) >= 0) {
                this.logfile = cmdLine.handleFlagWithParam("logfile", false);
            }
            if (cmdLine.findFlag("testsfile", false) >= 0) {
                // Tests to run will be read from this file.
                this.testsfile = cmdLine.handleFlagWithParam("testsfile", false);
            }
            if (cmdLine.findFlag("timeoutafter", false) >= 0) {
                this.timeoutafter = cmdLine.handleFlagWithParam("timeoutafter", false);
            }
            // Now we just grab everything in the command line
            cmdLine.handleFlag("casper", false);
            for (var i=0; i < cmdLine.length; i++) {
                this.params.push(cmdLine.getArgument(i));
            }
            cmdLine.removeArguments(0, cmdLine.length - 1);
            // we need to wait for the main window to startup before we
            // run any tests
            Services.ww.registerNotification(this);
        } catch(e) {
            dump(e+"\n");
        }
    },

    helpInfo : "       -casper <tests>      start unittests.\n"+
               "       -eot                 exit app when tests completed.\n"+
               "       -testsfile           filepath contain the tests to be run.\n"+
               "       -logfile             save results to this logfile.\n\n"+
               "  Example: -casper test_something.js#mytestcase.childtest\n",
    
    observe: function(subject, topic, data)
    {
        switch(topic) {
        case "domwindowopened":
            try {
                var domWindow = subject.QueryInterface(Ci.nsIDOMWindow);
                Services.ww.unregisterNotification(this);
                // now we install an event listener and wait for the load event
                var self = this;

                // Add a quit handler in case the tests take too long.
                var loadhandler = function(event) {
                    try {
                        domWindow.removeEventListener("load", loadhandler, false);
                        domWindow.setTimeout(self.forceQuit, self.timeoutafter);
                    } catch(e) {
                        dump(e+"\n");
                    }
                }
                domWindow.addEventListener("load", loadhandler, false);

                // Add a ui-start handler to launch the casper tests.
                Services.obs.addObserver(this, "komodo-ui-started", false);
            } catch(e) {
                dump(e+"\n");
            }
            break;
        case "komodo-ui-started":
            try {
                Services.obs.removeObserver(this, "komodo-ui-started");
                this.handleLoad(Services.ww.activeWindow);
            } catch(e) {
                dump(e+"\n");
            }
            break;
        }
    },
    
    forceQuit: function() {
        Cc["@mozilla.org/toolkit/app-startup;1"]
          .getService(Ci.nsIAppStartup)
          .quit(appStartup.eForceQuit);
    },

    handleLoad: function(domWindow) {
        try {
            if (this.testsfile) {
                // Read in the tests that the user wants to run.
                var file = Cc["@mozilla.org/file/local;1"].
                             createInstance(Ci.nsILocalFile);
                file.initWithPath(this.testsfile);
                var istream = Cc["@mozilla.org/network/file-input-stream;1"].
                                createInstance(Ci.nsIFileInputStream);
                istream.init(file, 0x01, /*0444*/292, 0);
                istream.QueryInterface(Ci.nsILineInputStream);
                // read lines into array
                var line_object = {}, lines = [], hasmore, paramline;
                do {  
                    hasmore = istream.readLine(line_object);
                    paramline = line_object.value;
                    paramline = paramline.replace("^\s+", "");
                    paramline = paramline.replace("\s+$", "");
                    if (paramline) {
                        this.params.push(paramline);
                    }
                } while(hasmore);
                istream.close();
            }

            if (this.params.length > 0) {
                domWindow.setTimeout(function(w, p, l, e) {
                                   w.Casper.UnitTest.runTestsText(p, l, e);
                               }, 2000, domWindow, this.params, this.logfile,
                               this.eot);
                this.params = [];
            } else {
                // open the xul test window
                domWindow.setTimeout(domWindow.Casper.UnitTest.runTestsXUL, 1000);
            }
        } catch(e) {
            dump(e+"\n");
        }
    },

    /* nsISupports */
    QueryInterface: XPCOMUtils.generateQI([Ci.nsICommandLineHandler,
                                           Ci.nsIObserver]),
    classID: Components.ID('{C37134CD-A4B0-11DA-BA30-000D935D3368}'),
    classDescription: 'CasperConsoleHandler',
    contractID: '@activestate.com/casper/casper-clh;1',
    _xpcom_categories: [{category: 'command-line-handler',
                         entry: 'c-casper'}]
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([CasperConsoleHandler]);
