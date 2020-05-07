#!/usr/bin/env perl

use strict;
use warnings;

unlink "tcldevkit.jar";

system('zip -r tcldevkit.jar content/controller.js content/info.js content/overlay.xul content/prefs.js content/prefs.xul content/prefsOverlay.xul skin/images/TclApp-16-16-8-disable.png skin/images/TclApp-16-16-8.png skin/images/TclCompiler-16-16-8-disable.png skin/images/TclCompiler-16-16-8.png skin/images/TclDevKit-bugs.png skin/images/TclDevKit-community.png skin/images/TclDevKit-mailing-list.png skin/images/TclInspector-16-16-8-disable.png skin/images/TclInspector-16-16-8.png skin/images/TclPE-16-16-8-disable.png skin/images/TclPE-16-16-8.png skin/images/TclSvc-16-16-8-disable.png skin/images/TclSvc-16-16-8.png skin/images/TclVFSE-16-16-8-disable.png skin/images/TclVFSE-16-16-8.png skin/images/TclXref-16-16-8-disable.png skin/images/TclXref-16-16-8.png skin/tcldevkit.css'); 
my $T = "tcldevkit.xpi";
unlink $T;
system("zip tcldevkit.xpi chrome.manifest install.rdf tcldevkit.jar");
