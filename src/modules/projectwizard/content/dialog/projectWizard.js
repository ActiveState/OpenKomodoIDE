const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

(function()
{
    const $ = require("ko/dom").window(window);
    const $window = $("window");
    const koFile = require("ko/file");
    const prefs = require("ko/prefs");
    const mainWindow = require("ko/windows").getMain();
    const ko = mainWindow.ko;
    const log = require('ko/logging').getLogger("projectwizard");
    const tbSvc     = Cc["@activestate.com/koToolbox2Service;1"]
                        .getService(Ci.koIToolbox2Service);
    const locale = require("ko/locale").use("chrome://komodo/locale/dialogs/projectWizard.properties");
    const state = require("state/tool");
    const _ = require("contrib/underscore");

    var determineLineLengthByWindowWidth = () =>
    {
        // Based on the users own font setting, determine how many characters
        //  will fit widthwise in the window.
        let buffer = 10; //pixels
        let windowWidthPX = document.getElementById("project_wizard").width;
        let ss = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        let row = require("ko/ui/row").create({attributes:{style:"visibility:hidden;display:inline-block;"}});
        let desc = require("ko/ui/description").create(ss);
        row.addColumn(desc);
        $window.append(row.element);
        let stringWidthPX = desc.element.boxObject.width; // ie. not ss.length

        while (windowWidthPX - stringWidthPX < (buffer * -1) || windowWidthPX - stringWidthPX > buffer)
        {
            row.element.innerHTML = "";
            if(windowWidthPX - stringWidthPX < 0)
            {
                ss = ss.substring(0, ss.length - 2);
            } else {
                ss += "aaa";
            }
            let desc = require("ko/ui/description").create(ss);
            row.addColumn(desc);
            stringWidthPX = desc.element.boxObject.width;
        }

        row.$element.delete();
        return ss.length;
    };

    var MAX_LINE_LENGTH = 0;

    var elems = {};
    var checkoutAsyncOp = null; // checkout operation
    var sccComponent = null;
    var dirChangedByUser = false;
    var cmdChangedByUser = false;
    var SCCSetByUser = false;
    var project;
    var isPlatformProject = false;
    var isSupportedLanguage = false;
    
    var local = {
        userOrgs: {},
    };
    
    var sccNameDict =
    {
        bzr: 'Bazaar',
        cvs: 'CVS',
        git: "Git",
        hg: "Mercurial",
        p4: "Perforce",
        svn: "Subversion"
    };

    // Languages that have strong associations with one another
    var languageAssoc =
    {
        CSS: ["HTML", "HTML5", "Less", "SCSS"],
        Less: ["HTML", "HTML5", "CSS", "SCSS"],
        SCSS: ["HTML", "HTML5", "Less", "CSS"],
        HTML: ["HTML5", "JavaScript", "CSS", "SCSS", "Less"],
        HTML5: ["HTML", "JavaScript", "CSS", "SCSS", "Less"],
        JavaScript: ["HTML", "HTML5"],
        AngularJS: ["HTML", "HTML5", "JavaScript"],
        CoffeeScript: ["JavaScript", "Node.js"],
        LaravelBlade: ["PHP"],
        Python: ["Python3", "Django"],
        Python3: ["Python", "Django"],
        Django: ["Python", "Python3"]
    };
    
    const platformPrefs = prefs.getPref("KomodoPlatformProjects");
    const platformSupportedLanguages = platformPrefs.getAllPrefIds();

    var init = () =>
    {
        MAX_LINE_LENGTH = determineLineLengthByWindowWidth();

        createElems();
        elems.$wizard.append(getPageStart().$element);
        elems.$wizard.append(getPageBootstrap().$element);
        elems.$wizard.append(getPageLoading().$element);
        $("window").append(elems.$wizard);

        elems.name.focus();

        var finishBtn = $(elems.$wizard.element().getButton("finish"));
        finishBtn.attr("label", "Create");
        finishBtn.attr("accesskey", "C");

        elems.$wizard.element().addEventListener("wizardfinish", (event) => {onFinish(event);});
        elems.$wizard.element().canAdvance = false;
        
        elems.runCommand.on("input", () => cmdChangedByUser = true);

        // Work around XUL bug (yes, another one) where finish button is shown
        // instead of next button
        elems.$wizard.element()._wizardButtons.onPageChange();

        window.sizeToContent();
        elems.$wizard.on("wizardnext", () => sizeToContent());

        require("ko/windows").pin(window);
    };

    var sizeToContent = () =>
    {
        // Fix black border around window. This is nasty and ugly, but I can't afford to spend any more time on this.
        var borderFix = () =>
        {
          var h = window.innerHeight;
          window.innerHeight = h+100;
          window.innerHeight = h;
        };
        setTimeout(borderFix, 100);

        var maxWidth = document.documentElement.style.maxWidth;
        document.documentElement.style.maxWidth = window.innerWidth + "px";
        window.sizeToContent();
        document.documentElement.style.maxWidth = maxWidth;
    };
    
    var onFinish = (event) =>
    {
        // We want to force our own validation
        event.preventDefault();

        ko.projects.open(project.url);

        window.close();
        return true;
    };
    
    var createElems = () =>
    {
        elems.$wizard = $("<wizard>").attr("flex", "1");
        // where needed, extract in to further functions to generate list, add
        // event handlers, generate default values.
        
        // startPage
        elems.name = require("ko/ui/textbox").create();
        elems.name.on("input", onNameFieldElemInput);
        elems.dir = createDirFieldElem();
        elems.frameworks = require("ko/ui/listbox").create({ attributes: { rows: 6 }});
        elems.languages = $("<langlist>").attr({ "default": "None", "default-value": "" });
        // // Platform
        elems.addRuntimeCheckbox = createAddRuntimeElem();
        elems.organizationList = createOrgMenuElem();
        elems.visibilityRadio = createVisibilityElem();
        elems.visibilityHelper = createVisibilityHelpIcon();
        
        // // Platform
        // startPage
        // Bootstrap
        elems.SCC = createSCCElem();
        elems.pathHeader = require("ko/ui/description").create({ attributes: { class: "fullwidth" } });
        elems.bootstrap = createBootstrapElem();
        elems.bootstrapSummary = require("ko/ui/description").create({ attributes: { class: "fullwidth" } });
        elems.bootstrapLabel = require("ko/ui/label").create("Template:");
        elems.bootstrapShowAll = showAllTemplatesElem();
        elems.runCommand = require("ko/ui/textbox").create();
        elems.newRepo = createNewRepoElem();
        elems.cloneLabel = require("ko/ui/label").create("Clone URL:");
        elems.repoUrl = require("ko/ui/textbox").create();
        elems.repoUrl.on("input", updateSCCStatus);
        // Bootstrap
        
        elems.output = require("ko/ui/textbox").create({ attributes: { multiline: true, rows: 15, readonly: true } });
        elems.error = require("ko/ui/description").create({ attributes: { class: "state-error fullwidth", collapsed: true } });
        elems.help = require("ko/ui/description").create({ attributes: { class: "state-ok fullwidth", collapsed: true, flex: 1 } });
        elems.retryBtn = require("ko/ui/button").create("Retry");
        elems.retryBtn.hide();
        elems.retryBtn.on("command", () =>
        {
            window.creator(elems, (createdProject) =>
            {
                project = createdProject;
            }, log.error, true, (!! ko.projects.manager.currentProject));
        });
        
        elems.invalidPathisFileLabel = require("ko/ui/label").create(
            "You entered the path to a file.  Please enter a path to a directory instead.",
            {
                class:"state-warning"
            });
        elems.invalidPathisFileLabel.hide();
        
        elems.invalidPathLabel = require("ko/ui/label").create(
            "The path specified is invalid.  Please choose a new path.",
            {
                class:"state-warning"
            });
        elems.invalidPathLabel.hide();
        
        elems.invalidChooseOrg = require("ko/ui/label").create(
            "Please choose an organization to continue.",
            {
                class:"state-warning"
            });
        elems.invalidChooseOrg.hide();
        
        elems.invalidMissingNameOrDir = require("ko/ui/label").create(
            "Missing project Name or Location",
            {
                class:"state-warning"
            });
        elems.invalidMissingNameOrDir.hide();
    };
    
    var createOrgMenuElem = () =>
    {
        let menu = require("ko/ui/menulist").create(
            [
                require("ko/ui/menuitem").create({
                    label: locale.get("menuitem_initial_organizations"),
                    disabled: true
                })
            ]
        );
       
        let populateMenu = () =>
        {
            menu.menupopup.empty();
            if (local.userOrgs.length == 0)
            {
                menu.addMenuItem({ attributes: { label: locale.get("list_no_orgs_available"), disabled: true}});
                return;
            }
            for (let org of Object.keys(local.userOrgs))
            {
                menu.addMenuItem({ attributes: {
                    label: local.userOrgs[org].label,
                    value: local.userOrgs[org].value
                }});
            }
        };
        let processOrgs = (data) =>
        {
            for (let o of data)
            {
                local.userOrgs[o.URLName] = {
                    label: o.name + " (Organization)",
                    value: o.URLName,
                    privateProjs: o.privateProjects
                };
            }
        };

        let processUser = (data) =>
        {
            var userOrgs = local.userOrgs;
            local.userOrgs = {};
            local.userOrgs[data.urlname] = {
                label: data.username + " (Your Account)",
                value: data.urlname,
                privateProjs: data.privateProjects
            };

            // Ensure user shows first
            local.userOrgs = _.extend(local.userOrgs, userOrgs);

            populateMenu();
            menu.value(data.urlname);
            updateVisibility();
        };
        
        state.organizations({onSuccess: processOrgs});
        state.getUser({onSuccess: processUser});
        menu.on("popupshowing", populateMenu);
        menu.on("command", () =>
        {
            validate();
            updateVisibility();
        });
        return menu;
    };
    
    var togglePlatformOptions = () =>
    {
        if(elems.addRuntimeCheckbox.checked())
        {
            elems.organizationList.enable();
            elems.visibilityRadio.enable();
            updateVisibility();
            return;
        }
        elems.organizationList.disable();
        elems.visibilityRadio.disable();
    };
    
    var createAddRuntimeElem = () =>
    {
        let field = require("ko/ui/checkbox").create(locale.get("label_add_new_runtime"));
        field.onChange(() => {
            if (field.checked() && elems.organizationList.value() == locale.get("menuitem_initial_organizations"))
                elems.$wizard.element().canAdvance = false;
                
            togglePlatformOptions();
        });
        return field;
    };
    
    var createVisibilityHelpIcon = () =>
    {
        let elem = require("ko/ui/toolbarbutton").create({ class: "help-icon", id: "visibility-help-icon"});
        let msgs = locale.get("project_visibility_help").split("\n");
        let openPanel = (e) => {
            let panel = require("ko/ui/panel").create();
            for (let msg of msgs){
                panel.addRow(require("ko/ui/description").create(msg));
            }
            panel.open({anchor: e.explicitOriginalTarget, position:"end_before"});
        };
        elem.on("click", openPanel);
        return elem;
    };
    
    var createVisibilityElem = () =>
    {
        let field = elems.visibilityRadio = require("ko/ui/radiogroup").create(locale.get("label_visibility"));
        elems.publicRadio = require("ko/ui/radio").create({
            attributes: {
                label: locale.get("checkbox_label_public"),
                value: locale.get("checkbox_label_public").toLowerCase(),
            }
        });
        elems.privateRadio = require("ko/ui/radio").create({
            attributes: {
                label: locale.get("checkbox_label_private"),
                value: locale.get("checkbox_label_private").toLowerCase(),
            }
        });
        elems.visibilityRadio.addRadioItems([elems.publicRadio, elems.privateRadio]);
        elems.privateRadio.disable();
        
        field.attr("id", "platform-visibility");
        field.value(locale.get("checkbox_label_public").toLowerCase());
        
        return field;
    };
    
    var updateVisibility = () =>
    {
        if (privateEnabledForSelectedOrg())
        {
            elems.privateRadio.enable();
        }
        else
        {
            elems.privateRadio.selected(false);
            elems.publicRadio.selected(true);
            elems.privateRadio.disable();
        }   
    };

    var privateEnabledForSelectedOrg = () =>
    {
        let org = elems.organizationList.value();
        return (local.userOrgs[org] && local.userOrgs[org].privateProjs);
    };
    
    var createSCCElem = () =>
    {
        var sccComponents = ko.scc.getAvailableSCCComponents();
        var field = require("ko/ui/menulist").create();
        field.addMenuItem({ attributes: { label: "None", value: "" }});

        for (let scc of ko.scc.getAvailableSCCComponents())
        {
            if(scc.component.getValue("supports_command", "checkout"))
            {
                field.addMenuItem({ attributes: { label: sccNameDict[scc.name], value: scc.name }});
            }
        }

        field.on("command", ()=>
        {
            SCCSetByUser = true;

            if( ! field.value())
            {
                sccComponent = null;
            }
            else
            {
                var sccName = field.value();
                for (let i=0; i < sccComponents.length; i++)
                {
                    if (sccName == sccComponents[i].name)
                    {
                        sccComponent = sccComponents[i].component;
                        break;
                    }
                }
            }

            updateSCCStatus();
        });

        return field;
    };

    var createBootstrapElem = () =>
    {
        var listbox = require("ko/ui/listbox").create({ attributes: { rows: 5 } });
        listbox.addListHeaders(['Name', 'Author', 'License']);
        listbox.addListCols(['', '', '']);

        return listbox;
    };

    var createNewRepoElem = () =>
    {
        var field = require("ko/ui/checkbox").create({ attributes: { label: "Initialize New Repository" }});
        field.on("command", updateSCCStatus);

        return field;
    };

    var onNameFieldElemInput = () =>
    {
        if (elems.dir && ! dirChangedByUser)
        {
            var path = koFile.join(
                    prefs.getStringPref("projects-dir"),
                    elems.name.value()
                );
            elems.dir.value(path);
            updateWizardState();
        }
    };

    // directory field
    // - will update Version Control field if applicable
    // - updates "Next" to "Finish" if directory already exists
    // -
    var createDirFieldElem = () =>
    {
        var field = require("ko/ui/filepath").create(
        {
            attributes:
            {
                value: prefs.getStringPref("projects-dir"),
                filetype: "dir",
                framework: "autocomplete",
                fileframework: "dir",
                autocompletesearch: "dirpath",
                autocompletepopup: "popupTextboxAutoComplete",
                maxrows: "10",
                enablehistory: "true",
                completeselectedindex: "true",
                tabscrolling: "true"
            }
        });

        var onInput = () =>
        {
            dirChangedByUser = true;
            isPlatformProject = !! state.getConfigFile(field.value());
            updateWizardState();
        };

        field.on("input", onInput);
        return field;
    };

    var listTemplates = (all=false) =>
    {
        tbSvc.findToolsAsync("", 0, [], "folder_template", (code, results) =>
        {
            if (code !== 0)
            {
                log.error("findToolsAsync failed with code " + code);
            }

            results = results.sort((a,b) => { return a.name.localeCompare(b.name); });

            elems.bootstrap.removeAllItems();

            var noneItem = require("ko/ui/listitem").create({ attributes:
            {
                disabled: true,
                value: ""
            }});
            noneItem.addListCell("None");
            noneItem.addListCell("--");
            noneItem.addListCell("--");
            elems.bootstrap.addListItem(noneItem);

            var language = elems.languages.value();
            var languages = [language];
            if (language in languageAssoc)
                languages = languages.concat(languageAssoc[language]);

            if ( ! languages.length)
                all = true;

            for (let tool of results)
            {
                if ( ! all && languages.indexOf(tool.koTool.getStringAttribute("language")) === -1)
                    continue;

                let listitem = require("ko/ui/listitem").create({ attributes: { value: tool.path_id } });
                listitem.addListCell(tool.name);
                listitem.addListCell(tool.koTool.getStringAttribute("author"));
                listitem.addListCell(tool.koTool.getStringAttribute("license"));
                elems.bootstrap.addListItem(listitem);
            }
        });
    };

    var showAllTemplatesElem = () =>
    {
        var toggle = () =>
        {
            if(elems.bootstrapShowAll.checked())
                listTemplates(true);
            else
                listTemplates();
        };

        var field = require("ko/ui/checkbox").create({ attributes: { label: "Show all templates" }});
        field.on("command", toggle);

        return field;
    };

    var updateFrameworkSelection = () =>
    {
        elems.frameworks.removeAllItems();

        var language = elems.languages.value();
        var languages = [language];
        if (language in languageAssoc)
            languages = languages.concat(languageAssoc[language]);

        var knownFrameworks = prefs.getPref("knownFrameworks");
        var frameworks = [];

        for (let id of knownFrameworks.getAllPrefIds().sort())
        {
            let framework = knownFrameworks.getPref(id);
            if (languages.indexOf(framework.getString("language")) == -1)
                continue;

            frameworks.push(id);
        }

        elems.frameworks.addListItem(require("ko/ui/listitem").create({ attributes:
        {
            label: "None",
            value: ""
        }}));

        elems.frameworks.addListItems(frameworks);
    };
    
    var splitString = (str) =>
    {
        // Because xul sucks $#*% at keeping text bound in a description
        //  container (or any container) dynamically break it up based on user
        //  font size and the window width
        let lines = [];
        let words = str.split(" ");
        let stringDesc = "";
        for (let w of words) {
            if (stringDesc.length + w.length >= MAX_LINE_LENGTH) {
                lines.push(stringDesc);
                stringDesc = w;
            } else {
                stringDesc += " " + w;
            }
        }
        lines.push(stringDesc);
        return lines;
    };

    var createPlatformDesc = () =>
    {
        let container = require("ko/ui/column").create({ attributes: { id : "platform-desc"}});

        let lines = splitString(locale.get("platform_desc"));
        for (let line of lines) {
            container.addRow(require("ko/ui/description").create(line));
        }
        container.addRow(require("ko/ui/spacer").create());
        
        container.addRow([
            require("ko/ui/link").create(locale.get("link_text_platform_desc"),
            { attributes : { href : locale.get("link_platform_desc")}})
        ]);

        container.addRow(require("ko/ui/spacer").create());

        let enableMsg = elems.platformEnableHelpMsg = require("ko/ui/description").create(
            locale.get("platform_desc_supported_langs", platformSupportedLanguages.join(", ")),
            {attributes: {
                class: "state-ok",
            }}
        );
        container.addRow(enableMsg);

        return container;
    };
    
    var updatePlatformEnableHelpMsg = () => {
        let msg = "";
        if (isPlatformProject) {
            let lines = splitString(locale.get("platform_desc_already_a_project"));
            for (let line of lines) {
                msg += line + "\n";
            }
        } else {
            let lines = splitString(locale.get("platform_desc_supported_langs", platformSupportedLanguages.join(", ")));
            for (let line of lines) {
                msg += line + "\n";
            }
        }
        elems.platformEnableHelpMsg.value(msg);
    };

    var disablePlatformSection = () =>
    {
        elems.platformEnableHelpMsg.show();
        elems.addRuntimeCheckbox.disable();
        elems.addRuntimeCheckbox.checked(false);
        togglePlatformOptions();
    };
    
    var enablePlatformSection = () =>
    {
        elems.platformEnableHelpMsg.hide();
        elems.addRuntimeCheckbox.enable();
        togglePlatformOptions();
    };
    
    var getPageStart = () =>
    {
        var page = require("ko/ui/wizardpage").create({ attributes:
        {
            title:"Project Properties",
            pageid:"pageStart"
        }});

        var groupLocation = page.addGroupbox({ caption: locale.get("grp_information")});
        var groupFramework = page.addGroupbox({ caption: locale.get("grp_technology")});
        let title = locale.get("grp_platform");
        if (Date.now() >= parseInt(prefs.getLong("platform_not_new", 1)))
        {
            title = locale.get("new") + "  " + title;
        }
        var groupPlatform = elems.groupPlatform = page.addGroupbox({ caption: title });
        
        // === Location
        groupLocation.addRow([
            require("ko/ui/label").create("Name:"),
            elems.name
        ]);
        groupLocation.addRow([
            require("ko/ui/label").create("Location:"),
            elems.dir
        ]);
        
        groupLocation.addColumn([elems.invalidMissingNameOrDir, elems.invalidPathisFileLabel, elems.invalidPathLabel], { align: 'start', class: 'warning-box' });
        // === Location

        // === Technology
        groupFramework.addRow([
            require("ko/ui/label").create("Language:"),
            elems.languages
        ]);

        groupFramework.addRow([
            require("ko/ui/label").create("Framework:"),
            elems.frameworks
        ]);

        elems.languages.on("command", () =>
        {
            elems.frameworks.disable();
            disablePlatformSection();
            isSupportedLanguage = false;
            let value = elems.languages.value();
            if (value !== "")
            {
                elems.frameworks.enable();
                isSupportedLanguage = platformSupportedLanguages.indexOf(value) >= 0;
            }
            updateFrameworkSelection();
            updateWizardState();
        });

        elems.frameworks.disable();
        updateFrameworkSelection();
        // === Technology

        // === Platform
        groupPlatform.addRow(createPlatformDesc());
        groupPlatform.addRow(elems.addRuntimeCheckbox);
        groupPlatform.addRow([
            require("ko/ui/label").create(locale.get("label_organization")),
            elems.organizationList
        ]);
        groupPlatform.addRow(elems.invalidChooseOrg);
        groupPlatform.addRow([elems.visibilityRadio, elems.visibilityHelper]);
        togglePlatformOptions();
        disablePlatformSection();
        
        // === Platform

        elems.name.on("input", updateWizardState);
        elems.dir.on("input", updateWizardState);

        elems.pageStart = page;

        //page.on("pageShow", updateWizardState);

        return page;
    };
    
    var getPageBootstrap = () =>
    {
        var page = require("ko/ui/wizardpage").create({ attributes:
        {
            title:"Project Content",
            pageid:"pageBootstrap"
        }});
        page.addRow(elems.pathHeader);

        var groupSummary = page.addGroupbox();
        groupSummary.add(elems.bootstrapSummary);

        var group = page.addGroupbox({ caption: "Bootstrap Project"});

        group.addRow([
            require("ko/ui/label").create("Version Control:"),
            elems.SCC
        ]);

        group.addRow(elems.newRepo);
        group.addRow(
        [
            elems.cloneLabel,
            elems.repoUrl
        ]);

        group.add(require("ko/ui/separator").create());

        group.addRow(
        [
            elems.bootstrapLabel,
            elems.bootstrap
        ]);
        
        group.addRow(
        [
            elems.bootstrapShowAll
        ]);

        group.add(require("ko/ui/separator").create());

        group.addRow(
        [
            require("ko/ui/label").create("Run Command:"),
            elems.runCommand
        ]);

        group.addRow(
        [
            require("ko/ui/description").create(
                "This command will be ran in the project folder after it has been " +
                "created and after the template (if selected) has been imported."
            )
        ]);

        elems.repoUrl.on("input", () => updateSCCStatus());
       
        page.on("pageshow", onPageBootstrapShown);
        elems.pageBootstrap = page;
        
        return page;
    };
    
    var onPageBootstrapShown = () =>
    {
        var summary = `Creating ${elems.frameworks.value()} project "${elems.name.value()}" in ${elems.dir.value()}`;
        elems.bootstrapSummary.value(summary);
        
        var framework = elems.frameworks.value();
        var knownFrameworks = prefs.getPref("knownFrameworks");

        for (let id of knownFrameworks.getAllPrefIds().sort())
        {
            if (id == framework)
            {
                framework = knownFrameworks.getPref(id);
                break;
            }
        }

        if (framework && framework.hasPref('initCommand'))
        {
            elems.runCommand.value(framework.getStringPref('initCommand'));
        }

        listTemplates();
        updateSCCStatus();
    };
    
    var getPageLoading = () =>
    {
        var page = require("ko/ui/wizardpage").create({ attributes:
        {
            title: "Create Project",
            pageid: "pageLoading"
        }});

        var groupSummary = page.addGroupbox();
        groupSummary.add(elems.pathHeader);
        
        var group = page.addGroupbox({ caption: "Creating Project"});
        group.add(elems.output);

        group.add(require("ko/ui/spacer").create());
        group.add(elems.error);
        group.addRow([elems.help, elems.retryBtn]);

        elems.pageLoading = page;

        page.on("pageshow", onPageLoadingShown);

        return page;
    };

    var onPageLoadingShown = () =>
    {
        var headerMsg = `Creating ${elems.frameworks.value()} project "${elems.name.value()}" in ${elems.dir.value()}`;
        elems.pathHeader.value(headerMsg);

        window.creator(elems, (createdProject) =>
        {
            project = createdProject;
        }, log.error, false);
    };
    
    // If elems.dir.value() already exists and is already under SCC
    // control function disable selection of version control and jump to last
    // page when next is selected
    var updateWizardState = () =>
    {
        var path = elems.dir.value();
        var wizard = elems.$wizard.element();
        
        if(koFile.isDir(path) && ! koFile.isEmpty(path))
        {
            elems.invalidPathisFileLabel.hide();
            elems.pageStart.element.next = elems.pageLoading.element.pageid;

            if (wizard.pageIndex === 0)
                wizard._wizardButtons._wizardButtonDeck.setAttribute("selectedIndex", 0); // finish button
        }
        else
        {
            // running on initialization seems to break the buttons
            // so don't do anything if it doesn't need to be done.
            if(elems.pageStart.element.next != elems.pageBootstrap.element.pageid)
            {
                elems.pageStart.element.next = elems.pageBootstrap.element.pageid;
                elems.pageBootstrap.element.next = elems.pageLoading.element.pageid;
            }
            
            if (wizard.pageIndex === 0)
                wizard._wizardButtons._wizardButtonDeck.setAttribute("selectedIndex", 1); // next button
        }
        
        if (wizard.pageIndex === 1)
            wizard._wizardButtons._wizardButtonDeck.setAttribute("selectedIndex", 0); // finish button

        if (! isPlatformProject && isSupportedLanguage){
            enablePlatformSection();
        } else {
            disablePlatformSection();
        }
        

        updatePlatformEnableHelpMsg();
        validate();
        updateSCCStatus();
        sizeToContent();
    };
    
    var validate = () =>
    {
        let canAdvance = true;
        let path = elems.dir.value();

        if(koFile.isFile(path))
        {
            elems.invalidPathisFileLabel.show();
            canAdvance = false;
        }
        else
        {
            elems.invalidPathisFileLabel.hide();
        }
        
        if(koFile.basename(path) == path) // This returns the original string if it's an invalid path
        {
            elems.invalidPathLabel.show();
            canAdvance = false;
        }
        else
        {
            elems.invalidPathLabel.hide();
        }
        if ( ! elems.addRuntimeCheckbox.disabled() && elems.addRuntimeCheckbox.checked() && elems.organizationList.value() == locale.get("menuitem_initial_organizations"))
        {
            elems.invalidChooseOrg.show();
            canAdvance = false;
        }
        else
        {
            elems.invalidChooseOrg.hide();
        }
        
        if (elems.dir.value() == "" || elems.name.value() == "")
        {
            elems.invalidMissingNameOrDir.show();
            canAdvance = false;
        }
        else
        {
            elems.invalidMissingNameOrDir.hide();
        }
        elems.$wizard.element().canAdvance = canAdvance;
    };
    
    // Check if the directory field is under Version Control
    // Set the VersonControl field if it is, and is supported.
    var updateSCCStatus = (noDelay=false) =>
    {
        elems.newRepo.disable();
        elems.repoUrl.disable();
        elems.cloneLabel.disable();

        elems.bootstrapLabel.enable();
        elems.bootstrap.enable();
        elems.bootstrapShowAll.enable();

        if (["hg", "git"].indexOf(elems.SCC.value()) != -1)
        {
            elems.newRepo.enable();
        }
        else
        {
            elems.newRepo.checked(false);
        }

        if (elems.SCC.value() &&  ! elems.newRepo.checked())
        {
            elems.repoUrl.enable();
            elems.cloneLabel.enable();

            if ( ! cmdChangedByUser)
                elems.runCommand.value("");

            if (elems.repoUrl.value())
            {
                elems.bootstrapLabel.disable();
                elems.bootstrap.disable();
                elems.bootstrapShowAll.disable();
            }
        }
    };
    
    window.addEventListener("load", init);
})();
