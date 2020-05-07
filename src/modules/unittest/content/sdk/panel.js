(function() {
    
    const mainWindow= require("ko/windows").getMain();
    const $         = require("ko/dom");
    const unittest  = require("unittest/unittest");
    const configEditor = require("unittest/editor");
    const prefs     = require("ko/prefs");
    const ko        = mainWindow.ko;
    const id        = "unittest-widget";
    const ss        = require("ko/simple-storage").get("unittest").storage;
    const log       = require("ko/logging").getLogger("unittest/panel");
    const _         = require("contrib/underscore");
    const timers    = require("sdk/timers");
    
    var panels = [];
    
    this.open = () =>
    {
        ko.windowManager.openOrFocusDialog(
            "chrome://unittest/content/views/panel.xul",
            "unittest",
            "chrome,all,close=yes,resizable,dependent=no",
            {}
        );
    };
    
    this.register = () =>
    {
        var widget = ko.widgets.getWidget(id);
        
        if ( ! widget)
        {
            ko.widgets.registerWidget(id, "Unit Testing", "chrome://unittest/content/views/panel.xul", {
                defaultPane: "workspace_bottom_area",
                persist: true,
                show: true,
                iconURL: "koicon://ko-svg/chrome/icomoon/skin/lab.svg"
            });
        }
    };
    
    this.onLoad = (w) =>
    {
        w.unittestPanel = new Panel(w);
        panels.push(w);
        
        w.addEventListener("unload", function() {
            for (let i=0;i<panels.length;i++)
            {
                if (panels[i] == w)
                    delete panels[i];
            }
        });
    };
    
    this.getPanels = () =>
    {
        panels = panels.filter((v) => !! v);
        return panels;
    };

    var Panel = function(w)
    {

        var elems = {
            resultListbox: $("#test-result", w),
            filterListbox: $("#filters", w),
            summaryWrapper: $("#summary", w),
            filterWrapper: $("#filter-wrapper", w),
            details: $("#details-inner", w)
        };
        
        var runLocals = {};
        var filters = { results: [], groups: [], search: null };
        
        var running = false;
        
        var showDetails = prefs.getBoolean("unittest.panel.show-details", false);
        var runOnSave = prefs.getBoolean("unittest.panel.run-on-save", false);
        
        this.init = () =>
        {
            if ( ! w.arguments)
                w.document.documentElement.classList.add("embedded");
            
            elems.resultListbox.on("select", onSelectTest);
            $("#config-menu > menupopup", w).on("popupshowing", onConfigMenuShowing);
            $("#run", w).on("command", onRun);
            $("#add", w).on("command", configEditor.create);
            $("#edit", w).on("command", onEdit);
            $("#delete", w).on("command", onDelete);
            $("#filters", w).on("select", onFilter);
            $("#search", w).on("input", onFilter);
            $("#show-more-details", w).on("command", onDetails);
            
            elems.resultListbox.on("contextmenu", onTestContext);
            elems.resultListbox.on("dblclick", onGoto);
            elems.resultListbox.on("keypress", (e) => { if (e.keyCode == 13) onGoto(); }); // Enter
            
            $("#show-details", w).on("command", onShowDetails);
            $("#go-to, #go-to-details", w).on("command", onGoto);
            $("#debug, #debug-details", w).on("command", onDebug);
            $("#run-on-save", w).on("command", onRunOnSave);
            
            $("tab", w).on("command", function() { this.removeAttribute("dirty"); });
            
            if (showDetails)
                $("#show-details", w).attr("checked", "true");
                
            if (runOnSave)
                $("#run-on-save", w).attr("checked", "true");
                
            mainWindow.addEventListener("file_saved", onFileSave);
            
            onConfigMenuShowing(); // preload
            onFilter();
        };
            
        var clear = () =>
        {
            elems.resultListbox.empty();
            elems.filterListbox.find(".group").remove();
            elems.filterWrapper.attr("selectedIndex", 0);
            $("tab", w).removeAttr("dirty");
            
            runLocals = {
                resultCounter: { total: 0, success: 0, failed: 0, errors: 0 },
                groupCounter: null,
                groupSummary: null,
                entryElements: {},
                currentGroup: null,
                testErrors: [],
                testOutput: [],
                pendingFragment: null
            };
            
            updateTotals();
        };
        
        var updateTotals = () =>
        {
            elems.summaryWrapper.empty();
            
            $("<box>").addClass("icon-info").appendTo(elems.summaryWrapper);
            $("<label>").value(running ? "Running" : "Done").appendTo(elems.summaryWrapper);
            
            $("<box>").addClass("icon-ok").appendTo(elems.summaryWrapper);
            $("<label>").value(`${runLocals.resultCounter.success} succeeded`).appendTo(elems.summaryWrapper);
            
            $("<box>").addClass("icon-warn").appendTo(elems.summaryWrapper);
            $("<label>").value(`${runLocals.resultCounter.failed} failed`).appendTo(elems.summaryWrapper);

            $("<box>").addClass("icon-error").appendTo(elems.summaryWrapper);
            $("<label>").value(`${runLocals.resultCounter.errors} errors`).appendTo(elems.summaryWrapper);

            var outputValue = runLocals.testOutput.join("");
            if (outputValue.length != $("#test-output", w).value().length)
            {
                if ($("#main-tabs", w).attr("selectedIndex") != "1")
                    $("#test-output-tab", w).attr("dirty", 1);
                $("#test-output", w).value(outputValue);
                $("#test-output", w).element().setSelectionRange(outputValue.length, outputValue.length);
            }
            
            var errorValue = runLocals.testErrors.join("");
            if (errorValue.length != $("#test-errors", w).value().length)
            {
                if ($("#main-tabs", w).attr("selectedIndex") != "2")
                    $("#test-errors-tab", w).attr("dirty", 1);
                $("#test-errors", w).value(errorValue);
                $("#test-errors", w).element().setSelectionRange(errorValue.length, errorValue.length);
            }
            
            if (runLocals.currentGroup)
            {
                runLocals.groupSummary.success.value(runLocals.groupCounter.success);
                runLocals.groupSummary.errors.value(runLocals.groupCounter.errors);
                runLocals.groupSummary.failed.value(runLocals.groupCounter.failed);
            }
        };
        
        var filterResults = (entries) =>
        {
            if ( ! entries)
                entries = elems.resultListbox.find("richlistitem");
                
            entries.each(function()
            {
                var hide = false;
                if (filters.groups.length && filters.groups.indexOf(this.getAttribute("unittest-group")) == -1)
                    hide = true;
                    
                if (this.classList.contains("entry"))
                {
                    if (filters.results.length && filters.results.indexOf(this.getAttribute("result")) == -1)
                        hide = true;
                        
                    if (filters.search && this.getAttribute("value").indexOf(filters.search) == -1)
                        hide = true;
                }
                
                if (hide)
                    this.setAttribute("kohidden", true);
                else
                    this.removeAttribute("kohidden");
            });
        };
        
        var onRun = () =>
        {
            doRun();
        };
        
        var doRun = () =>
        {
            if (running)
                return log.warn("Prevented unittest from running while one is already active");
            
            var config = $("#config-menu", w).attr("value");
            
            if (config == "-1")
                return require("notify/notify").interactiveWarning("Please select a unit test configuration", "unittest");
            
            clear();
            
            running = true;
            $("#config-menu, #edit, #delete, #add", w).attr("disabled", "true");
            
            $("#stop", w).replaceWith($("#stop", w).clone(false, false));
            
            $("#run", w).hide();
            $("#stop", w).show().on("command", () => test.stop());
            
            var test;
            try
            {
                test = unittest.run(config, handleResults, () =>
                {
                    running = false;
                    $("#config-menu, #edit, #delete, #add", w).removeAttr("disabled");
                    $("#stop", w).hide();
                    $("#run", w).show();
                });
            }
            catch (e)
            {
                running = false;
                $("#config-menu, #run, #edit, #delete, #add", w).removeAttr("disabled");
                $("#stop", w).hide();
                $("#run", w).show();
                
                log.exception(e, "Unit test failed");
                require("notify/notify").interactiveError("Unit test failed, reported error message: " + e.message);
            }
        };
        
        var appendResult = (elem) =>
        {
            if ( ! runLocals.pendingFragment)
                runLocals.pendingFragment = w.document.createDocumentFragment();

            runLocals.pendingFragment.appendChild(elem);

            appendResults();
        };

        var appendResults = _.debounce(() =>
        {
            elems.resultListbox.element().appendChild(runLocals.pendingFragment);
        }, 0);

        var handleResults = (data) =>
        {
            // Check if we have results
            if (data.results)
            {
                for (let uuid in data.results)
                {
                    if ( ! data.results.hasOwnProperty(uuid))
                        continue;

                    let entry = data.results[uuid];
                    let isNew = true;

                    if (entry.uuid in runLocals.entryElements)
                    {
                        isNew = false;
                        updateEntry(entry);
                    }
                    else
                    {
                        if (entry.group && runLocals.currentGroup != entry.group)
                            drawGroup(entry);
                        
                        if ( ! entry.group)
                            runLocals.currentGroup = null;
                        
                        drawEntry(entry);
                    }

                    if (entry.state == "done" && isNew)
                    {
                        if (entry.result == "ok")
                        {
                            runLocals.resultCounter.success++;
                            
                            if (runLocals.currentGroup)
                                runLocals.groupCounter.success++;
                        }
                            
                        if (entry.result == "not ok")
                        {
                            runLocals.resultCounter.failed++;
                            
                            if (runLocals.currentGroup)
                                runLocals.groupCounter.failed++;
                        }
                        
                        if (entry.result == "error")
                        {
                            runLocals.resultCounter.errors++;
                            
                            if (runLocals.currentGroup)
                                runLocals.groupCounter.errors++;
                        }
                    }
                }
            }
            
            // Check for stdout (raw output, no errors)
            if (data.stdout)
            {
                runLocals.testOutput.push(data.stdout);
            }
            
            // Check for stderr 
            if (data.errors)
            {
                runLocals.testErrors.push(data.errors);
            }
            
            if (data.state == "done")
                running = false;
            
            updateTotals();
        };
        
        var drawGroup = (entry) =>
        {
            var groupElement = $("<richlistitem>");
            groupElement.addClass("group");
            groupElement.attr("unittest-group", entry.group);
            $("<box>").addClass("icon-unittest-group").appendTo(groupElement);
            $("<label>").addClass("group").value(entry.group).appendTo(groupElement);
            runLocals.currentGroup = entry.group;
            
            runLocals.groupSummary = {};
            runLocals.groupSummary.success = $("<label>").value(0).addClass("state-ok").appendTo(groupElement);
            $("<label>").value("/").appendTo(groupElement);
            runLocals.groupSummary.failed = $("<label>").value(0).addClass("state-warning").appendTo(groupElement);
            $("<label>").value("/").appendTo(groupElement);
            runLocals.groupSummary.errors = $("<label>").value(0).addClass("state-error").appendTo(groupElement);
            runLocals.groupCounter = { success: 0, failed: 0, errors: 0 };
            
            var nameShort = entry.group;
            if (nameShort.length > 30)
                nameShort = ".." + nameShort.substr(-30);
                
            filterResults(groupElement);
            appendResult(groupElement.element());
                
            var filterItem = $("<richlistitem>")
                .addClass("group")
                .attr("value", entry.group)
                .append($("<label>").attr("tooltiptext", entry.group).value(nameShort));
            filterItem.appendTo(elems.filterListbox);
            
            if (filters.groups.indexOf(entry.group) != -1)
                $("#filters", w).element().addItemToSelection(filterItem.element());
        };
        
        var drawEntry = (entry) =>
        {
            var element;
            var counter;
            
            var icon = "icon-pending";
            var status = "status-pending";
            if (entry.result == "ok")
            {
                icon = "icon-ok";
                status = "status-ok";
            }
            else if (entry.result == "not ok")
            {
                icon = "icon-warn";
                status = "status-notok";
            }
            else if (entry.result == "error")
            {
                icon = "icon-error";
                status = "status-error";
            }
            
            var isNew = true;
            if (entry.uuid in runLocals.entryElements)
            {
                element = runLocals.entryElements[entry.uuid];
                counter = element.find(".counter").value();
                element.empty();
                isNew = false;
            }
            else
            {
                counter = ++runLocals.resultCounter.total;
                element = $("<richlistitem>").addClass(status, "entry");
            }
            
            element.element()._entry = entry;
            
            var wrapper = $("<vbox>").appendTo(element);
            var infoElement = $("<hbox>").appendTo(wrapper);
            var detailElement = $("<hbox>").appendTo(wrapper);
            
            element.attr("result", entry.result);
            element.attr("value", entry.summary.toLowerCase());
                
            $("<box>").addClass(icon).appendTo(infoElement);
            $("<label>").addClass("counter").value(counter).appendTo(infoElement);
            if (entry.number)
                $("<label>").addClass("counter", "real").value(`(${entry.number})`).appendTo(infoElement);
            $("<label>").addClass("summary").value(entry.summary).appendTo(infoElement);
            
            if (entry.duration)
            {
                var duration = entry.duration;
                if (duration == parseInt(duration, 10))
                    duration = duration + "ms";
                    
                $("<label>").addClass("duration").value(duration).appendTo(infoElement);
            }
            
            if (entry.result != "ok" && entry.data)
            {
                if (entry.data.expected && entry.data.actual)
                {
                    $("<label>").value("Expected: ").addClass("expected").appendTo(detailElement);
                    $("<label>").value(entry.data.expected).addClass("expected", "value").appendTo(detailElement);
                    $("<label>").value("Actual: ").addClass("actual").appendTo(detailElement);
                    $("<label>").value(entry.data.actual).addClass("actual", "value").appendTo(detailElement);
                }
                else if (entry.data.message)
                {
                    var message = entry.data.message.trim().replace(/\n/g, " ");
                    if (message.length > 50)
                        message = message.substr(0, 50) + "..";
                    $("<label>").value(message).addClass("message", "value").appendTo(detailElement);
                }
            }
            
            if (entry.group)
                element.attr("unittest-group", entry.group);
                
            filterResults(element);
            
            if (isNew)
                appendResult(element.element());
            
            runLocals.entryElements[entry.uuid] = element;
        };
        
        var updateEntry = (entry) =>
        {
            // Todo: Handle updates without redrawing entire list item
            drawEntry(entry);
        };
        
        this.reloadConfigMenu = (newValue) =>
        {
            var value = $("#config-menu", w).value();
            
            onConfigMenuShowing();
            
            if ( ! newValue)
            {
                var elem = $(`#config-menu menuitem[value="${value}"]`, w);
                if (elem.length)
                    newValue = elem.value();
                else
                    newValue = "-1";
            }
            
            // force update label
            if (value != newValue)
            {
                $("#config-menu", w).value(newValue);
                onSelectConfig();
            }
        };
        
        var onConfigMenuShowing = () =>
        {
            var configMenuPopup = $("#config-menu > menupopup", w);
            configMenuPopup.empty();
            
            $("<menuitem>").attr({label: "Select One ..", value: "-1"}).appendTo(configMenuPopup);
            
            var configs = unittest.getConfigs();
            if ( ! configs.length)
                return;
            
            configs.sort(function(current, previous) {
               return (current.getString("saveTo") + current.getString("name")).localeCompare(
                    (previous.getString("saveTo") + previous.getString("name"))
                );
            });
            
            $("<menuseparator>").appendTo(configMenuPopup);
            
            for (let config of configs)
            {
                var saveTo = config.getString("saveTo");
                if (saveTo == "global") saveTo = " - Global";
                if (saveTo == "project") saveTo = " - Project";
                if (saveTo == "file") saveTo = " - File";
                
                var label = config.getString("name") + saveTo;
                
                let menuitem = $("<menuitem>").attr({
                    label: label,
                    tooltipText: label,
                    value: config.id
                });
                menuitem.on("command", onSelectConfig);
                menuitem.appendTo(configMenuPopup);
            }
            
            $("#config-menu", w).value(ss.lastUsedConfig);
        };
        
        var onSelectConfig = () =>
        {
            ss.lastUsedConfig = $("#config-menu", w).value();
            clear();
        };
        
        var onSelectTest = () =>
        {
            elems.details.empty();
            elems.filterWrapper.attr("selectedIndex", 0);
            
            var fields = getDetailFields();
            
            if ( ! fields || ! Object.keys(fields).length)
                return;
            
            var parent = require("ko/ui/column").create({
                attributes: { flex: 1 }
            });
            elems.details.append(parent.$element);
            
            for (let key in fields)
            {
                let field = fields[key];
                
                let row = parent.addRow();
                row.add(require("ko/ui/label").create({ attributes: { value: field.label + ":", tooltiptext: field.label, crop: "center" }}));
                
                let elem = require("ko/ui/" + (field.type || "textbox")).create(field.options || undefined);
                row.add(elem);

                if (field.value && elem.value)
                    elem.value(field.value);
            }
            
            elems.filterWrapper.attr("selectedIndex", 1);
        };
        
        var getDetailFields = () =>
        {
            var entry = elems.resultListbox.element().selectedItem._entry;
            
            if ( ! entry || ! entry.data)
                return;
            
            var fields = {};
            var keysSorted = Object.keys(entry.data).sort((a,b) =>
            {
                if (b == "expected")
                    return +1;
                if (b == "actual" && a != "expected")
                    return +1;
                if (a == "expected" || a == "actual")
                    return 0;
                return a.localeCompare(b);
            });
            
            for (let k of keysSorted)
            {
                if ( ! entry.data[k])
                    continue;
                
                fields[k] = {
                    label: k.charAt(0).toUpperCase() + k.slice(1),
                    type: "textbox",
                    options: { attributes: { flex: 1, readonly: true } },
                    value: entry.data[k].trim()
                };
                
                if (entry.data[k].trim().indexOf("\n") != -1)
                {
                    var lines = entry.data[k].trim().match(/\n/g).length + 1;
                    fields[k].options.attributes.multiline = true;
                    fields[k].options.attributes.rows = Math.min(lines, 5);
                }
                else if (entry.data[k].length > 35)
                {
                    fields[k].options.attributes.multiline = true;
                    fields[k].options.attributes.rows = 2;
                }
            }
            
            return fields;
        };
        
        var onDetails = () =>
        {
            var fields = getDetailFields();
            
            if ( ! fields || ! Object.keys(fields).length)
                return;
            
            var entry = elems.resultListbox.element().selectedItem._entry;
            
            if ( ! entry || ! entry.data)
                return;
            
            require("ko/modal").open(entry.summary, fields);
        };
        
        var onGoto = () =>
        {
            doGoto();
        };
        
        var doGoto = (callback) =>
        {
            var entry = elems.resultListbox.element().selectedItem._entry;
            var config = unittest.getConfig($("#config-menu", w).attr("value"));
            var handler = unittest.getHandler(config.getString("handler"));
            var handlerInstance = require(handler.namespace);
            
            if ( ! entry || ! config)
                return;
            
            var location;
            
            if ("getLocation" in handlerInstance)
            {
                location = handlerInstance.getLocation(entry, config);
            }
            else
            {
                var _location = entry.location || {};
                location = {
                    path: _location.path || undefined,
                    line: _location.line || undefined,
                    symbol: _location.symbol || entry.summary,
                    search: _location.search || undefined
                };
            }
            
            unittest.getLocation(location, config, (path, line, cwd) =>
            {
                if ( ! path)
                {
                    if (location.search)
                    {
                        let msg = "Could not find the definition for this test, would you like to search for it?";
                        if (require("ko/dialogs").confirm(msg))
                        {
                            ko.find.findAllInFolder(location.search, cwd);
                            return;
                        }
                    }
                    
                    let msg = `Could not find the definition for the test "${entry.summary}"`;
                    require("notify/notify").warn(msg, "unittest");
                    return;
                }
                
                ko.open.URIAtLine(path, line, "editor", true, () =>
                {
                    if (callback)
                        callback(path, line);
                });
            });
        };
        
        var onDebug = () =>
        {
            doGoto((path, line) =>
            {
                var view = require("ko/views").current();
                var koDoc = view.koDoc;
                
                if ( ! koDoc)
                    return;
                
                ko.dbg.breakpoints.manager.updateBreakpointsFromMarkers(koDoc, view.get());
                ko.dbg.breakpoints.addOnLine(view.get(), line);
                
                ko.commands.doCommandAsync("cmd_dbgGo");
            });
        };
        
        var onEdit = () =>
        {
            var config = getActiveConfig();
            
            configEditor.edit(config);
        };
        
        var onDelete = () =>
        {
            var uuid = $("#config-menu", w).attr("value");
            if ( ! uuid || uuid == -1)
                return require("ko/dialogs").alert("Please select a configuration first");
            
            var config = unittest.getConfig(uuid);
            if ( ! config)
                return require("ko/dialogs").alert("The selected configuration could not be found, your preferences may be corrupted");
            
            configEditor.delete(config);
        };
        
        var onFilter = () =>
        {
            if (showDetails)
                elems.resultListbox.addClass("show-details");
            else
                elems.resultListbox.removeClass("show-details");
            
            filters = { results: [], groups: [], search: null };
            for (let item of $("#filters", w).element().selectedItems)
            {
                let value = item.getAttribute("value");
                
                if (value == "-1")
                    continue;
                
                if (value.indexOf("state:") === 0)
                    filters.results.push(value.substr(6));
                else
                    filters.groups.push(value);
            }
            
            filters.search = $("#search", w).value().toLowerCase().trim() || null;
            
            filterResults();
        };
        
        var onTestContext = (e) =>
        {
            var item = elems.resultListbox.element().selectedItem;
            var isOk = item.getAttribute("result") == "ok";
            
            if (item.classList.contains("entry"))
            {
                $("#context #show-more-details", w).attr("disabled", isOk);
                $("#context #go-to", w).attr("disabled", false);
                $("#context #debug", w).attr("disabled", false);
                
                $("#context", w).element().openPopupAtScreen(e.screenX, e.screenY, true);
            }
        };
        
        var onShowDetails = () =>
        {
            var checked = $("#show-details", w).attr("checked") == "true";
            prefs.setBoolean("unittest.panel.show-details", checked);
            showDetails = checked;
            onFilter();
        };
        
        var onRunOnSave = () =>
        {
            var checked = $("#run-on-save", w).attr("checked") == "true";
            prefs.setBoolean("unittest.panel.run-on-save", checked);
            runOnSave = checked;
        };
        
        var onFileSave = (e) =>
        {
            if ( ! runOnSave)
                return;
            
            var config = getActiveConfig();
            var cwd = unittest.getWorkingDirectory(config);
            
            if (e.detail.view.koDoc.file.path.indexOf(cwd) == -1)
                return;
            
            doRun();
        };
        
        var getActiveConfig = () =>
        {
            var uuid = $("#config-menu", w).attr("value");
            if ( ! uuid || uuid == -1)
                return require("notify/notify").warn("Please select a configuration first", "unittest");
            
            var config = unittest.getConfig(uuid);
            if ( ! config)
                return require("notify/notify").warn("The selected configuration could not be found, your preferences may be corrupted", "unittest");
            
            return config;
        };
        
        this.init();
    };
    
}).apply(module.exports);
