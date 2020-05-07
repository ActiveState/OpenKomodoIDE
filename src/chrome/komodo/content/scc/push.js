/* Copyright (c) 2012 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

/* Source Code Control commit window.
 *
 * Usage:
 *  All dialog interaction is done via an object passed in and out as the first
 *  window argument: window.arguments[0].  See documentation for OnLoad for the
 *  expected parameters.
 */

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

var log = ko.logging.getLogger("scc.push");
log.setLevel(ko.logging.LOG_DEBUG);

var gBundle;
var gSCCSvc;
var gCallback;
var gRepoRoot;

/**
 * Initialize the dialog
 * Arguments are passed via window.arguments; it is expected to be a hash with
 * the following keys:
 *      repo:   A koIFileEx for the repository root
 *              Alternatively, a list of URLs from which to derive the repo root;
 *                  in this case, .sccSvc must be given.
 *      sccSvc: [optional] The SCC service to use.
 *      callbackFn: [optional] A function that is called on completion.  It
 *              receives an argument, true if pushed and false otherwise.
 *              (It is expected in the future to receieve some sort of commit
 *              identifier on push, and some false-y thing on cancel, in the
 *              future.)
 */
function OnLoad() {
    var args = Array.slice(window.arguments || []).concat({})[0];
    if (!("repo" in args)) {
        reportFatalError("SCC Push dialog invoked without repo to push from");
        return;
    }
    if (Array.isArray(args.repo)) {
        // args.repo is actually a list of files; figure out where the repo root
        // is from that and re-init the dialog with it.
        if (!args.sccSvc) {
            reportFatalError("SCC Push dialog: repo is an array but no SCC service specified");
            return;
        }
        args.sccSvc.getRoot(args.repo, function(result, data) {
            if (result != Ci.koIAsyncCallback.RESULT_SUCCESSFUL) {
                reportFatalError("SCC Push dialog failed to determine repo");
                return;
            }
            var file = Components.classes['@activestate.com/koFileService;1']
                                 .getService(Components.interfaces.koIFileService)
                                 .getFileFromURI(data);
            window.arguments[0].repo = file;
            OnLoad();
        });
        return;
    }
    if (!(args.repo instanceof Ci.koIFileEx)) {
        reportFatalError("SCC Push dialog failed to find repo");
        return;
    }
    gCallback = args.callbackFn || function() {};
    gBundle = Cc['@mozilla.org/intl/stringbundle;1']
                .getService(Ci.nsIStringBundleService)
                .createBundle('chrome://komodo/locale/scc-push.properties');
    gRepoRoot = args.repo;
    gSCCSvc = args.sccSvc || ko.scc.getServiceForUrl(gRepoRoot.URI);
    if ("title" in args) {
        document.title = args.title;
    } else {
        document.title = gBundle.formatStringFromName("dialogTitle",
                                                      [gRepoRoot.baseName],
                                                      1);
    }
    let escapedURI = gRepoRoot.URI.replace(/([\\'"])/g, "\\$1");
    document.getElementById("txtRepo")
            .setAttribute("autocompletesearchparam",
                          "scc-push-known: \"" + escapedURI + "\"; " +
                          "filepath: \"\"; " +
                          "mru: \"scc-push-history-" + escapedURI + "\"");
    gSCCSvc.getValueAsync("push_default_repo", gRepoRoot.path,
                          function(result, data) {
                            if (result == Ci.koIAsyncCallback.RESULT_SUCCESSFUL) {
                                document.getElementById("txtRepo").value = data;
                            }
                            setTimeout(_doPreviewCommand, 0);
                          });

    let options = document.getElementById("grpOptions");
    let availOptions = gSCCSvc.getValue("push_options") || [];
    options.collapsed = !(availOptions.length > 0);
    for each (let [value, type, stringName] in availOptions) {
        let label = stringName;
        try {
            label = gBundle.GetStringFromName(stringName);
        } catch (ex) { /* ignore */ }
        try {
            label = gBundle.formatStringFromName("options.label.format",
                                                 [label, value],
                                                 2);
        } catch (ex) { /* ignore */ }
        switch (type) {
            case "bool": {
                let checkbox = document.createElement("checkbox");
                checkbox.setAttribute("label", label);
                checkbox.setAttribute("value", value);
                options.appendChild(checkbox);
                checkbox.addEventListener("command", _doPreviewCommand, false);
                break;
            }
            default:
                log.debug("SCC push option " + value +
                          " has unsupported type " + type);
                continue;
        }
    }

    if (gSCCSvc.getValue("supports_push_feature", "branches") == "Yes") {
        gSCCSvc.getValueAsync("branches", gRepoRoot.path,
            function(result, data) {
              if (result != Ci.koIAsyncCallback.RESULT_SUCCESSFUL) {
                  return;
              }
              let listbox = document.getElementById("lstBranches");
              Array.slice(data).forEach(function(branch) {
                 listbox.appendItem(branch, branch);
              });
              gSCCSvc.getValueAsync("current_branch", gRepoRoot.path,
                    function(result, data) {
                        if (result != Ci.koIAsyncCallback.RESULT_SUCCESSFUL) {
                            return;
                        }
                        for (let i = 0; i < listbox.itemCount; ++i) {
                            let item = listbox.getItemAtIndex(i);
                            // the item (XBL element) may not be bound yet, so
                            // item.value can be undefined; use the attribute instead
                            if (item.getAttribute("value") == data) {
                                log.debug("found item " + data);
                                listbox.ensureIndexIsVisible(i);
                                listbox.selectItem(item);
                                _doPreviewCommand();
                                return;
                            }
                        }
                    });
            });

        if (gSCCSvc.getValue("supports_push_feature", "multiple_branches") == "Yes") {
            document.getElementById("lstBranches").selType = "multiple";
        }
    } else {
        document.getElementById("rowBranches").collapsed = true;
    }

    if (gSCCSvc.getValue("supports_push_feature", "tags") == "Yes") {
        gSCCSvc.getValueAsync("tags", gRepoRoot.path,
            function(result, data) {
              if (result != Ci.koIAsyncCallback.RESULT_SUCCESSFUL) {
                  return;
              }
              let listbox = document.getElementById("lstTags");
              Array.slice(data).forEach(function(tag) {
                 listbox.appendItem(tag, tag);
              });
            });

        if (gSCCSvc.getValue("supports_push_feature", "multiple_tags") == "Yes") {
            document.getElementById("lstTags").selType = "multiple";
        }
    } else {
        document.getElementById("rowTags").collapsed = true;
    }

    xtk.include("domutils");
    scintillaOverlayOnLoad();
    var view = document.getElementById("viewErrors");
    view.init();
    view.initWithBuffer('', 'Text');
    window.sizeToContent();
}

function OnUnLoad() {
    scintillaOverlayOnUnload();
    try {
        gCallback(false);
    } catch (ex) {
        log.warning("Exception on SCC push failure callback: " + ex);
    }
}

/**
 * Do the SCC push
 * @param callback {koIAsyncCallback} callback for push
 * @param dryRun {boolean} If false, don't actually do the push
 */
function _doPush(callback, dryRun) {
    var remote = document.getElementById("txtRepo").value;
    if (!remote) {
        return null;
    }
    let options = [];
    let grpOptions = document.getElementById("grpOptions");
    for each (let elem in Array.slice(grpOptions.childNodes)) {
        if (elem instanceof Ci.nsIDOMXULCheckboxElement) {
            if (elem.checked) {
                options.push(elem.getAttribute("value"));
            }
        }
    }
    let branches = document.getElementById("lstBranches")
                           .selectedItems.map(function(e) e.value);
    let tags = document.getElementById("lstTags")
                           .selectedItems.map(function(e) e.value);
    gSCCSvc.push(remote, gRepoRoot.URI, callback, branches, branches.length,
                 tags, tags.length, options.join(" "), dryRun);
    return true;
}

function _doPreviewCommand() {
    function callback(result, data) {
        if (result != Ci.koIAsyncCallback.RESULT_SUCCESSFUL) {
            log.debug(data);
            return;
        }
        document.getElementById("txtCommandLine").value = data;
    }
    _doPush(callback, true);
}

/**
 * Accept the dialog and execute the SCC Push
 */
function OnAccept(event) {
    let commandLine = null;
    let notification;
    var win = opener;
    function getCommandLine(result, data) {
        if (result == Ci.koIAsyncCallback.RESULT_SUCCESSFUL) {
            commandLine = data;
            let exe = gSCCSvc.executable;
            if (commandLine.substr(0, exe.length) == exe) {
                commandLine = commandLine.substr(exe.length)
                                         .replace(/^\s*(?:push\s+)?/, "\t");
            }
        }
        if (win && win.ko && win.ko.scc && win.ko.scc.logger) {
            notification = win.ko.scc.logger.reportSCCAction(gSCCSvc,
                                  "push",
                                  [gRepoRoot.URI],
                                  commandLine,
                                  result);
            notification.maxProgress = Ci.koINotificationProgress.PROGRESS_INDETERMINATE;
        }
        document.getElementById("progress").collapsed = false;
        _doPush(callback, false);
    }
    function callback(result, data) {
        var changes = {
            maxProgress: notification.progress
        };
        try {
            document.getElementById("progress").collapsed = true;
            if (result == Ci.koIAsyncCallback.RESULT_SUCCESSFUL) {
                let textbox = document.getElementById("txtRepo");
                changes.details = notification.details + "\n" + data;
                if (win && win.ko && win.ko.mru && win.ko.mru.addFromACTextbox) {
                    win.ko.mru.addFromACTextbox(textbox);
                }
                try {
                    gCallback(true);
                } catch (ex) {
                    log.warning("Exception on SCC push success callback: " + ex);
                }
                gCallback = function() {}; // avoid calling it again
                window.close();
                return;
            }
            changes.severity = Ci.koINotificationProgress.SEVERITY_ERROR;
            let viewErrors = document.getElementById("viewErrors");
            // work around git sending ANSI escape codes :/
            data = String(data).split(/\r?\n/).map(function(line)
                line.replace(/\x1B\[0?K/g, "")
            ).join("\n");
            viewErrors.scimoz.text = data;
            viewErrors.collapsed = false;
            window.sizeToContent();
        } finally {
            log.debug("updating notification: " + JSON.stringify(changes));
            win.ko.notifications.update(notification, changes);
        }
    }
    _doPush(getCommandLine, true);
    return false;
}

/**
 * Report an error message to the user, and close the dialog
 * @param msg {String} The message to display
 */
function reportFatalError(msg) {
    log.error(msg);
    var win = opener;
    if (!win || win.closed) {
        win = Cc['@mozilla.org/appshell/window-mediator;1']
                .getService(Ci.nsIWindowMediator)
                .getMostRecentWindow("Komodo").require("ko/windows").getMain();
    }
    win.ko.notifications.add(msg, ["scc", "push"],
                             "scc-push-error-" + Date.now() + "-" + Math.random(),
                             {severity: Ci.koINotification.SEVERITY_ERROR});
    window.close();
}
