if (typeof window.startupWizard == "undefined")
    window.startupWizard = {};

(function() {

    const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

    var log = require("ko/logging").getLogger("startupWizard/dependencies");

    var $ = require("ko/dom");
    var prefs = require("ko/prefs");
    var platform = require("sdk/system").platform;
    var progress = require("ko/progress").get(true);
    var depends = require("ko/dependencies");

    var platformPretty = "Windows";
    if (platform.toLowerCase().indexOf("linux") >= 0)
        platformPretty = "Linux";
    else if (platform.toLowerCase().indexOf("darwin") >= 0)
        platformPretty = "macOS";

    var loadDelay = prefs.getLong("startupwizard.dependency_load_delay");
    var searchUrl = prefs.getString("dependency.documentation_search_url");

    var fields;
    var queue = [];
    var lastGroup;
    this.scanComplete = false; // Don't reload the list if it's already run
    var queueStartLength;

    this.dependencyInit = () =>
    {
        fields = this.fields;
        this.createDependencyFields();
        window.sizeToContent();
    };

    this.createDependencyFields = () =>
    {
        fields.dependenciesStatus = require("ko/ui/row").create(progress.element);
        fields.dependencies = require("ko/ui/column").create({attributes:{id:"dependencies"}});
        
        var message = "Komodo is scanning for available tools on your system." +
            "You can modify these settings later via your " +
            "Preferences (%prefs%), or by accessing your Project or File" +
            "preferences.  You can run this wizard again through" +
            "Help > Run First Start Wizard.";
        if(platform.toLowerCase().indexOf("darwin") >= 0)
        {
            message = message.replace(/\%prefs\%/,"Komodo > Preferences");
        }
        else
        {
            message = message.replace(/\%prefs\%/,"Edit > Preferences");
        }
        
        fields.dependenciesDesc = require("ko/ui/row").create(require("ko/ui/description").create(message));
    };
    
    this.getPageDependencies = () =>
    {
        var page = require("ko/ui/wizardpage").create({ id: "dependencyPage" });

        var statusGroupbox = page.addGroupbox({caption: "Detecting Components"});
        statusGroupbox.addElement(fields.dependenciesDesc);
        statusGroupbox.addElement(fields.dependenciesStatus);

        var componentsGroupbox = page.addGroupbox({caption: "Components"});
        componentsGroupbox.addElement(fields.dependencies);

        page.on("pageshow", loadDependencies);
        return page;
    };

    var addRow = (parent, item1, item2, item3) =>
    {
        let row = require("ko/ui/row").create();
        row.addColumn(item1, {attributes:{"class":"dependency-col1"}});
        row.addColumn(item2, {attributes:{"class":"dependency-col2"}});
        row.addColumn(item3, {attributes:{"class":"dependency-col3"}});
        parent.addElement(row);
        return row;
    };

    var loadDependencies = () =>
    {
        if(this.scanComplete)
            return;
        fields.dependencies.$element.empty();
        this.fields.nextButton.attr("disabled","true");
        this.fields.backButton.attr("disabled","true");
        var groups = getDependencyGroups();
        progress.message("Starting scan for components ..");
        for(let group in groups)
        {
            for(let groupItem of groups[group])
            {
                addToQueue(groupItem);
            }
        }
        queueStartLength = queue.length;
        // Cycle through array of jobs
        runQueue();
    };

    /**
     * Return an array of dependency prefset based on a group
     * See prefs.p.xml dependencies prefset for all groups
     *
     * @argument {String} group  The group to retrieve, eg. language,
     *      SCC, tool, packagemanager.
     *
     * @returns {Object} an object with the key being the group name and the value an array of dependency prefsets
     */
    var getDependencyGroups = () =>
    {
        var dependencies;
        if(prefs.hasPref("dependencies"))
        {
            dependencies = prefs.getPref("dependencies");
        }
        else
        {
            log.warn("Dependencies prefset is missing.");
            return;
        }

        var dependencyGroups = {};
        var prefIds = dependencies.getAllPrefIds();
        for (let id of prefIds)
        {
            var dep = dependencies.getPref(id);
            var group = dep.getString("group");
            if ( ! (group in dependencyGroups))
            {
                dependencyGroups[group] = [];
            }
            dependencyGroups[group].push(dep);
        }

        var _dependencyGroups = {};
        for (let k of Object.keys(dependencyGroups).sort())
            _dependencyGroups[k] = dependencyGroups[k].sort((a,b) => a.getString("label").localeCompare(b.getString("label")));
            
        return _dependencyGroups;
    };

    // This is to save the dynamically generated dependency menus
    // so their selected values can be saved with their relevant
    // preferences.
    // Example:
    // {
    //     id: git,
    //     menu: ko/ui/menulist,
    //     preference: gitDefaultInterpreter,
    //     group: "language"
    //     detected: boolean
    // }
    var dependencyObjs = [];

    /**
     * Create the table row placeholder then create a callback to be processed
     * so the table shows immediately for the user.  The callback is placed in a
     * queue to be processed later
     *
     * @argument {prefset} dependency  the prefset with the info about the dep.
     */
    var addToQueue = (dependency) =>
    {
        var id = dependency.id;
        var prefId = dependency.hasPref("preference") ? dependency.getStringPref("preference") : "";
        var existingPref="";

        // Create table with placeholders
        var menu = require("ko/ui/menulist").create({attributes:{disabled:true,"class":"dependency-menu"}});
        menu.addMenuItem("Scanning ..");

        var browseBtn = require("ko/ui/button").create({attributes:{ label: "...", disabled: true }});
        var installBtn = require("ko/ui/button").create({attributes:{ class: "download-icon" , collapsed: true }});
        var pathsAndButtons = require("ko/ui/row").create();

        pathsAndButtons.addColumn(installBtn);
        pathsAndButtons.addColumn(menu);
        pathsAndButtons.addColumn(browseBtn);
        
        var group = dependency.getStringPref("group");
        if (group != lastGroup)
        {
            lastGroup = group;
            fields.dependencies.addElement(
                require("ko/ui/caption").create(group)
            );
        }

        var spinner = require("ko/ui/spinner").create();
        var row = addRow(
            fields.dependencies,
            spinner,
            require("ko/ui/description").create(dependency.getString("label")),
            pathsAndButtons
        );

        // add to queue
        queue.push(loadDependency.bind(null, dependency, menu, browseBtn, installBtn, spinner, row));
    };

    // Create array of jobs to populate placeholders in table
    // Needs references to place holder containers
    var loadDependency = (dependency, menu, browseBtn, installBtn, spinner, row, callback) =>
    {
        if (row.element.previousSibling && row.element.previousSibling.previousSibling)
            row.element.previousSibling.previousSibling.scrollIntoView();
        
        var id = dependency.id;
        progress.message("Scanning for "+id+" binaries ..");
        
        var percentage = Math.floor(100 - (queue.length / queueStartLength)*100);
        progress.percentage(percentage);

        var pathlist = depends.getDependencyPaths(id);
         // Does this user already have this pref set?
        // if yes then set it as the selected
        var prefId = dependency.hasPref("preference") ? dependency.getStringPref("preference") : "";
        var prefSet = prefs.hasPref(prefId) && prefs.getStringPref(prefId);
        var installed = pathlist.length >= 1 || prefSet;

        var detectedIcon = "icon-warn";
        if (installed)
            detectedIcon = "icon-ok";

        var detected = require("ko/ui/container").create({ class: detectedIcon });
        spinner.$element.replaceWith(detected.element);

        menu.menupopup.empty();

        var label = "Not Detected";
        if (installed)
        {
            label = "Located on PATH";
            pathlist.unshift(label);
            menu.enable();
        }

        menu.addMenuItems(pathlist);
        menu.value(label);
        // Disabled means there is nothing selected to disable
        // We just want to disable the `Located on Path` item
        // So it doesn't get added to the pref.
        if( ! menu.disabled() )
            menu.element.selectedItem.disabled = true;
        
        // Does this user already have this pref set?
        // if yes then set it as the selected
        if (prefSet)
        {
            menu.value(prefs.getStringPref(prefId));
        }

        browseBtn.on("command", (function()
        {
            var path = ko.filepicker.browseForFile();
            if (path)
            {
                menu.addMenuItem(path);
                menu.value(path);
                menu.enable();
            }
        }).bind(this, menu));
        browseBtn.enable();

        if ( ! installed)
        {
            var installUrl = dependency.getString("documentation", searchUrl);
            installUrl = installUrl.replace("%s", prefId + "+installation+instructions+" + platformPretty);
            installBtn.on("command", () =>
            {
                ko.browse.openUrlInDefaultBrowser(installUrl);
            });
            installBtn.show();
        }

        // To save prefs when window closes.
        let dependencyObj = {};
        dependencyObj.id = id;
        dependencyObj.menu = menu;
        dependencyObj.preference = prefId;
        dependencyObj.group = dependency.getStringPref("group");
        dependencyObj.detected = installed;
        dependencyObjs.push(dependencyObj);
        
        setTimeout(callback, loadDelay);
    };

    var runQueue = () =>
    {
        var cb = queue.shift();
        if (cb)
        {
            cb(runQueue);
        }
        if(0 === queue.length)
            showDependecyResults();
    };

    var showDependecyResults = () =>
    {
        progress.message("Finalizing scan ..");
        progress.percentage(100);
        var callback = () =>
        {
            progress.message("Scan Complete");

            fields.dependencies.element.firstChild.scrollIntoView();
            this.fields.nextButton.removeAttr("disabled");
            this.fields.backButton.removeAttr("disabled");
            
            this.scanComplete = true;
        };

        setTimeout(callback, 500);
    };

    this.saveDependencies = () =>
    {
        for (let dependency of dependencyObjs)
        {
            let value = dependency.menu.value();
            if( ! dependency.menu.disabled() && ! dependency.menu.element.selectedItem.disabled )
            {
                prefs.setStringPref(dependency.preference, value);
            }
        }
    };

}).apply(window.startupWizard);