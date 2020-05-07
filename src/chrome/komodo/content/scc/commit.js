(function() {
    
    var $ = require("ko/dom").window(window);
    var w = require("ko/windows").getMain();
    var prefs = require("ko/prefs");
    var ko = w.ko;
    var initialized = false;
    var isWidget = false;
    
    var { setTimeout, clearTimeout } = require("sdk/timers");
    
    // Localization.
    var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                .getService(Components.interfaces.nsIStringBundleService)
                .createBundle("chrome://komodo/locale/scc.properties");
    
    var local = {};
    
    this.init = () =>
    {
        if ( ! window.arguments)
        {
            document.documentElement.classList.add("embedded");
            isWidget = true;
        }
        
        if (window.arguments)
        {
            local.SCCsvc = window.arguments[0].sccSvc;
            $("#open-dialog").hide();
        }
        else
            local.SCCsvc = ko.scc.getCurrentService();
        
        if ( ! window.arguments && ! local.SCCsvc)
            return;
        
        // .sccSvc
        if ( ! local.SCCsvc)
        {
            require("ko/dialogs").alert("Cannot commit without an active version control system");
            window.close();
            return;
        }
        
        if (window.arguments && window.arguments[0].urls)
            local.urls = window.arguments[0].urls.sort();
        else
            local.urls = [ko.scc.getRepositoryRoot()];
            
        var summaryTextbox = $("#commit-summary");
        if (window.arguments && window.arguments[0].message)
            summaryTextbox.value(window.arguments[0].message);
            
        summaryTextbox.focus();
        summaryTextbox.element().setSelectionRange(0, summaryTextbox.element().textLength);
        
        var selection = $("#selection");
        if ( ! initialized)
        {
            selection.on("click", this.onSelect);
            selection.on("dblclick", this.onDoubleClick);
            
            selection.on("keypress", function(e)
            {
                if (e.which == 13 || e.which == 32) // Enter || space
                    this.onDoubleClick();
                    
                // Don't propagate to parent elements
                e.stopPropagation(); 
            }.bind(this)); 
            
            $("#toggle-selected").on("click", this.onDoubleClick);
            $("#toggle-all").on("click", this.onClickToggleAll);
            $("#open").on("click", this.onClickOpen);
            $("#commit").on("click", this.commit);
            $("#reload").on("click", this.reload);
            $("#recent").on("popupshowing", this.loadRecentMenu);
            $("#selection").on("contextmenu", (e) =>
            {
                $("#context").element().openPopupAtScreen(e.screenX,e.screenY,true);
            });
        }
        
        this.loadList(true);
        
        initialized = true;
    };
    
    this.reload = (retry = true) =>
    {
        // Retry grabbing SCC info after 2 seconds
        // This is to deal with our flaky async SCC
        var root = ko.scc.getRepositoryRoot();
        if ( ! root && retry)
            return setTimeout(this.reload.bind(null, false), 2000);
        
        if ( ! initialized || local.urls[0] != root)
            return this.init();
        
        if ( ! local.SCCsvc)
        {
            if (retry)
            {
                local.SCCsvc = ko.scc.getCurrentService();
                this.reload(false);
            }
            return;
        }
        
        this.loadList();
        
        var selection = $("#selection");
        selection.element().clearSelection();
        selection.find("richlistitem[selected]").removeAttr("selected");
        selection.element().selectedItem = $("#selection > richlistitem:not([disabled])").first().element();
        if (selection.element().selectedItem)
            this.onSelect();
    };
    
    this.commit = () =>
    {
        var urls = [];
        var added = [];
        
        $("#selection richlistitem:not([disabled])").each(function() {
            if (local.maxFilesReached || this._scc.staged)
            {
                urls.push(this._scc.uri);
                
                if (this._scc.status.state == "unknown")
                    added.push(this._scc.uri);
            }
        });
        
        if (!urls.length) {
            require("ko/dialogs").alert("No files have been checked.");
            return false;
        }
    
        var prefs = require("ko/prefs");
    
        // Validate the message, i.e. encourage (but don't enforce) the user actual
        // enter something for a message.
        var message = $("#commit-summary").value();
        var messageTextbox = $("#commit-summary").element();
        
        var stripped = message.replace(/(^\s*|\s*$)/g, ''); // strip whitespace
        if (!stripped) {
            var prompt = _bundle.GetStringFromName("noCommitMessage");
            if (prefs.getBooleanPref("donotask_scc_no_commit_message") &&
                prefs.getStringPref("donotask_action_scc_no_commit_message") == "No") {
                // A do not ask again of "No" does not make sense - as the commit
                // dialog will just flash briefly and the user will not know why they
                // cannot commit their empty message, so we reset it in this case.
                prefs.setBooleanPref("donotask_scc_no_commit_message", false);
                prefs.setStringPref("donotask_action_scc_no_commit_message", "");
            }
            
            var answer = ko.dialogs.yesNo(prompt, "No", null, null,
                                          "scc_no_commit_message");
            if (answer == "No") {
                messageTextbox.setSelectionRange(0, messageTextbox.textLength);
                messageTextbox.focus();
                return false;
            }
        }
        
        // Remember the commit message.
        /**
         * Ordered preference of commit messages (strings).
         * @type {Components.interfaces.koIOrderedPreference}
         */
        var orderedPref = prefs.getPref("commit_message_history");
        // See if the message is already in the history, if so bump it's
        // position.
        for (var i=0; i < orderedPref.length; i++) {
            if (orderedPref.getStringPref(i) == message) {
                orderedPref.deletePref(i);
                break;
            }
        }
        orderedPref.insertStringPref(0, message);
        // Only keep the last 20 commit messages.
        while (orderedPref.length > 20) {
            orderedPref.deletePref(20);
        }
        // Must do this, otherwise the prefs are never saved - bug 83916.
        prefs.setPref("commit_message_history", orderedPref);
    
        var doCommit = () => local.SCCsvc.commit(urls.length, urls, message, '', {callback: this.onCommitCompleted.bind(null, urls)});
        
        if (added.length)
            local.SCCsvc.add(added.length, added, '', '', {callback: doCommit});
        else
            doCommit();
    };
    
    this.onCommitCompleted = (urls, result, data) =>
    {
        // data will be an array of koISCCHistoryItem,
        // throw it into the tree view.
        ko.scc.logger.reportSCCAction(local.SCCsvc, "commit", urls, data, result);
        w.setTimeout(xtk.domutils.fireEvent.bind(null, w, "SCC"), 1);
        if (result == Components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL) {
            //var notifybox = document.getElementById("scc_history_notificationbox");
            //notifybox.removeAllNotifications(false /* false means to slide away */);
            // Revert the urls as a commit message can change the file
            // contents, such as when using svn properties.
            ko.views.manager.revertViewsByURL(urls);
        } else if (result == Components.interfaces.koIAsyncCallback.RESULT_ERROR) {
            // data should contain the error message then.
            var title = sccSvc.name + " commit failure";
            if (!data) {
                data = "Commit could not be completed.";
            }
            
            require("ko/dialogs").alert(data, {title: title});
            return;
        }
        
        // If supplied, trigger the callback function.
        if (window.arguments && window.arguments[0].callback)
        {
            window.arguments[0].callback(result, data);
        }
        
        if (window.arguments)
            window.close();
        else
        {
            $("#commit-summary").value("");
            this.init();
        }
    };
    
    this.loadList = (reset = false) =>
    {
        if (this.loadList.loading)
            return;
        this.loadList.loading = true;
        
        var list = $("#selection");
        var listTmp = list.clone(true, false);
        list.replaceWith(listTmp);

        if (reset)
            list.find("richlistitem:not([disabled])").remove();
        
        local.SCCsvc.status(local.urls.length, local.urls, true /* recursive */, '', (nr, files) =>
        {
            // Account for items that are already in the list
            var fileUris = {};
            for (let file of files) {
                fileUris[file.uriSpec] = true;
            }
            
            var changes = reset;
            
            var found = {};
            if ( ! reset)
            {
                list.find("richlistitem:not([disabled])").each(function ()
                {
                    if (! (this._scc.uri in fileUris))
                    {
                        changes = true;
                        this.remove();
                    }
                    else
                        found[this._scc.uri] = true;
                });
            }
            
            // Load new items
            for (let file of files) {
                if (file.uriSpec in found) // Except ones that exist
                    continue;
                
                changes = true;
                let status = this.getStatusIdentifier(file.status);
                let item = $($.create(
                    "richlistitem", { file_scc_status: "scc_" + status.state }, $.create(
                        "label", { value: file.relativePath})
                ).toString());
                item.element()._scc = {uri: file.uriSpec, status: status, staged: false, group: status.label};
                list.append(item);
            }

            if (changes)
                this.sortList(list);
            listTmp.replaceWith(list);
            
            if ( ! list.element().selectedItem)
            {
                if (files.length)
                {
                    list.element().clearSelection();
                    list.find("richlistitem[selected]").removeAttr("selected");
                    list.element().selectedItem = $("#selection > richlistitem:not([disabled])").first().element();
                    if (list.element().selectedItem)
                        this.onSelect();
                }
                else
                {
                    this.loadDiff("No files to commit");
                }
            }
            
            this.loadList.loading = false;
        });
    };
    this.loadList.loading = false;
    
    this.loadRecentMenu = () =>
    {
        var popup = $("#recent");
        popup.empty();
        
        var prefs = require("ko/prefs");
        var menuitem;
        
        var orderedPref = prefs.getPref("commit_message_history");
        for (var i=0; i < orderedPref.length; i++) {
            let message = orderedPref.getStringPref(i);
            
            menuitem = document.createElement("menuitem");
            if (message.length <= 50) {
                menuitem.setAttribute("label", message);
            } else {
                menuitem.setAttribute("label", message.substr(0, 50) + "...");
                menuitem.setAttribute("tooltiptext", message);
            }
            
            menuitem.addEventListener("command", function (description)
            {
                description = description.split("\n");
                var summary = description.shift();
                $("#commit-summary").value(summary);
            }.bind(null, message));
            
            popup.append(menuitem);
        }
        
        if ( ! orderedPref.length) {
            menuitem = document.createElement("menuitem");
            menuitem.setAttribute("label", _bundle.GetStringFromName("noMessageHistory"));
            popup.append(menuitem);
        }
    };
    
    this.sortList = (list) =>
    {
        list = list || $("#selection");

        local.maxFilesReached = false;
        
        $("#maxFilesWarning").hide();
        if (list.element().childNodes.length > prefs.getLong('scc_commit_max_files', 250))
        {
            local.maxFilesReached = true;
            list.find("richlistitem[disabled]").hide();
            $("#maxFilesWarning").show();
            return;
        }
        
        list.find("richlistitem[disabled]").show();
        
        var stagedItems = false;
        var dirtyItems = false;
        list.children().each(function() {
            if (this.getAttribute("disabled") == "true")
                return;
            
            if (this._scc.staged)
                stagedItems = true;
            else
                dirtyItems = true;
                
            while (this.previousSibling)
            {
                let sibling = this.previousSibling;
                
                if (sibling.getAttribute("disabled") == "true" && ! sibling.getAttribute("name"))
                {
                    this.parentNode.insertBefore(this, sibling);
                    continue;
                }
                
                let groupName = sibling.getAttribute("name");
                if (groupName)
                {
                    if (groupName == "staged")
                        return;
                    if (groupName == "dirty" && ! this._scc.staged)
                        return;
                    
                    this.parentNode.insertBefore(this, sibling);
                    continue;
                }
                
                if (this._scc.staged && ! sibling._scc.staged)
                {
                    this.parentNode.insertBefore(this, sibling);
                    continue;
                }
                
                if (this._scc.uri.localeCompare(sibling._scc.uri) < 0)
                {
                    this.parentNode.insertBefore(this, sibling);
                    continue;
                }
                
                return;
            }
        });
        
        var emptyStaged = list.find("#staged-empty");
        if (stagedItems)
            emptyStaged.hide();
            
        var emptyDirty = list.find("#dirty-empty");
        if (dirtyItems)
            emptyDirty.hide();
        

    };
    
    this.onSelect = (e) =>
    {
        var item = $("#selection").element().selectedItem;
        if ( ! item) return;
        
        if (item.getAttribute("disabled") == "true" || ! item._scc)
        {
            if (e)
            {
                e.preventDefault();
                e.stopPropagation();
            }
            item.removeAttribute("selected");
            return false;
        }
        
        local.SCCsvc.diff(1, [item._scc.uri], '', '', (_, diff) => {
            this.loadDiff(diff);
        });
    };
    
    this.onDoubleClick = (e) =>
    {
        var selection = $("#selection");
        var items = selection.element().selectedItems;
        if ( ! items) return;
    
        for (let item of items)
        {
            if (item.classList.contains("group"))
            {
                e.preventDefault();
                e.stopPropagation();
                item.removeAttribute("selected");
                return false;
            }
            
            item._scc.staged = ! item._scc.staged;
            item.parentNode.appendChild(item); // Force resort
        }
        
        // Not ready for staging yet, too many implications
        //if ( ! local.SCCsvc.getValue("supports_command", "stage")) {
        //    var method = item._scc.staged ? "stage" : "unstage";
        //    local.SCCsvc[method](1, [item._scc.uri], () => {});
        //}
        
        this.sortList();
    };
    
    this.onClickOpen = () =>
    {
        var selection = $("#selection");
        var item = selection.element().selectedItem;
        if ( ! item) return;
        
        ko.open.URI(item._scc.uri);
    };
    
    this.onClickToggleAll = () =>
    {
        var items = $("#selection richlistitem:not([disabled])");
    
        var stage = null;
        items.each(function () 
        {
            if (stage === null)
                stage = ! this._scc.staged;
                
            this._scc.staged = stage;
        });
        
        this.sortList();
    };
    
    this.loadDiff = (diff) =>
    {
        var diffBrowser = $("#diff");
        diffBrowser.element().contentWindow.loadDiffResult(diff);
    };
    
    this.getStatusIdentifier = (status) =>
    {
        switch (status) {
            case Components.interfaces.koISCC.STATUS_UNKNOWN:
                return { state: "unknown", label: "Untracked"};
            case Components.interfaces.koISCC.STATUS_OK:
                return { state: "ok", label: "OK"};
            case Components.interfaces.koISCC.STATUS_MODIFIED:
                return { state: "edit", label: "Modified"};
            case Components.interfaces.koISCC.STATUS_ADDED:
                return { state: "added", label: "Added"};
            case Components.interfaces.koISCC.STATUS_DELETED:
                return { state: "delete", label: "Removed"};
            case Components.interfaces.koISCC.STATUS_REPLACED:
                return { state: "delete", label: "Replaced"};
            case Components.interfaces.koISCC.STATUS_MODIFIED_PROPERTY:
                return { state: "edit", label: "Modified Property"};
            case Components.interfaces.koISCC.STATUS_CONFLICT:
                return { state: "conflict", label: "Conflict"};
        }
    };
    
    window.addEventListener("load", this.init);
    window.reload = this.reload;
    
    // Event listeners for when we should update our dialog
    window.addEventListener("load", function() { setTimeout(function()
    {
        w.addEventListener("file_saved", this.reload);
        w.addEventListener("SCC", this.reload);
        
        var timer;
        var observer = {
            observe: (subject, topic, data) =>
            {
                var url = ko.scc.getRepositoryRoot();
                
                var reload = false;
                var urllist = data.split('\n');
                for (let u of urllist) {
                    if (u.indexOf(url) === 0)
                    {
                        reload = true;
                        break;
                    }
                }
                
                if (reload)
                {
                    clearTimeout(timer);
                    timer = setTimeout(this.reload, 500);
                }
            }
        };
        
        var observerSvc = Components.classes["@mozilla.org/observer-service;1"]
                                        .getService(Components.interfaces.nsIObserverService);
        observerSvc.addObserver(observer, "file_status", false);
        
        // Widget should change content based on current file
        if (isWidget)
        {
            // Force reload when our tab is accessed
            ko.scc.widget.getTab('commit').addEventListener("command", this.reload);
            
            var reloadWidget = function()
            {
                if (isWidget && ! ko.scc.widget.shouldReload('commit'))
                    return;
                
                // Retry grabbing SCC info after 2 seconds
                // This is to deal with our flaky async SCC
                var root = ko.scc.getRepositoryRoot();
                if (local.urls[0] != root)
                    return this.init();
            }.bind(this);
            
            w.addEventListener("current_place_opened", reloadWidget);
            w.addEventListener("current_view_changed", reloadWidget);
        }
        
    }, 10); });
    
})();
