(function()
{
    const $ = require("ko/dom").window(window);
    const $window = $("window");
    const prefs = require("ko/prefs");
    const legacy = require("ko/windows").getMain().ko;
    const log = require('ko/logging').getLogger("platformwizard");
    const locale = require("ko/locale").use("chrome://komodo/locale/dialogs/projectWizard.properties");
    const state = require("state/tool");

    var elems = {};
    var project; // Components.interfaces.koIProject
    var language = "";
    var projectPath = "";
    var projectName = "";
    
    if (window.arguments && window.arguments[0]){
        language = window.arguments[0].language || "Python3";
        projectName = window.arguments[0].name;
        projectPath = window.arguments[0].path;
    }

    if ( ! projectName && legacy.projects.manager.currentProject) 
        projectName = legacy.uriparse.baseName(legacy.projects.manager.currentProject.url).split(".")[0];
    if ( ! projectPath && legacy.projects.manager.currentProject)
        projectPath = legacy.uriparse.dirName(legacy.projects.manager.currentProject.url);
    
    var local = {
        userOrgs: {},
    };
    
    const platformPrefs = prefs.getPref("KomodoPlatformProjects");
    const platformSupportedLanguages = platformPrefs.getAllPrefIds();

    var init = () =>
    {
        createElems();
        elems.$wizard.append(getPageStart().$element);
        elems.$wizard.append(getPageLoading().$element);
        $("window").append(elems.$wizard);
        elems.name.value(projectName);
        elems.dir.value(projectPath);

        var $finishBtn = $(elems.$wizard.element().getButton("finish"));
        $finishBtn.attr("label", "Create");
        $finishBtn.attr("accesskey", "C");
        
        var $nextBtn = $(elems.$wizard.element().getButton("next"));
        $nextBtn.attr("label", "Create");
        $nextBtn.attr("accesskey", "C");

        elems.$wizard.element().addEventListener("wizardfinish", (event) => {onFinish(event);});
        elems.$wizard.element().canAdvance = false;

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
        
        if (legacy.projects.manager.currentProject){
            legacy.projects.manager.closeProject(legacy.projects.manager.currentProject);
        }
    
        // Work around bug where activestate.yaml disappears from places when reopening the project
        legacy.commands.doCommand("cmd_places_goUpOneFolder");

        legacy.projects.open(project.url);

        window.close();
        return true;
    };
    
    var createElems = () =>
    {
        elems.$wizard = $("<wizard>").attr("flex", "1");
        
        // These two fields are not presented to the user, unless `projectName`
        // isn't passed to the dialog, then `name` field is shown. They are here
        // because the project creator code was written to depend on fields that
        // must exist in the dialog and this information is still needed and to
        // use it I would have to refactor the creator code even further which
        // just isn't worth it
        elems.name = require("ko/ui/textbox").create();
        elems.name.on("blur", validate);
        elems.dir = require("ko/ui/textbox").create();
        
        elems.languages = require("ko/ui/menulist").create(platformSupportedLanguages);
        elems.languages.value(language);
        
        elems.organizationList = createOrgMenuElem();
        elems.invalidChooseOrg = require("ko/ui/label").create(
            "Please choose an organization to continue.",
            {
                class:"state-warning"
            });
        elems.invalidChooseOrg.hide();
        
        elems.visibilityHelper = createVisibilityHelpIcon();
        elems.visibilityRadio = createVisibilityElem();
        
        elems.pathHeader = require("ko/ui/description").create({ attributes: { class: "fullwidth" } });

        elems.output = require("ko/ui/textbox").create({ attributes: { multiline: true, rows: 15, readonly: true } });
        elems.error = require("ko/ui/description").create({ attributes: { class: "state-error fullwidth", collapsed: true } });
        elems.help = require("ko/ui/description").create({ attributes: { class: "state-ok fullwidth", collapsed: true } });
        elems.retryBtn = require("ko/ui/button").create("Retry");
        elems.retryBtn.hide();
        elems.retryBtn.on("command", () =>
        {
            window.creator(elems, (createdProject) =>
            {
                project = createdProject;
            }, log.error, true, (!! legacy.projects.manager.currentProject));
        });

        elems.invalidMissingName = require("ko/ui/label").create(
            "Missing project Name",
            {
                class:"state-warning"
            });
        elems.invalidMissingName.hide();
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

    var createOrgMenuElem = () =>
    {
        let menu = require("ko/ui/menulist").create([require("ko/ui/menuitem").create(
            {
                label: locale.get("menuitem_initial_organizations"),
                disabled: true,
            }),]
        );
       
        let onMenuShow = () =>
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
        let processData = (data) =>
        {
            if (Array.isArray(data))
            {
                for (let o of data)
                {
                    local.userOrgs[o.URLName] = {
                        label: o.name,
                        value: o.URLName,
                        privateProjs: o.privateProjects,
                    };
                }
            }
            else
            {
                local.userOrgs[data.urlname] = {
                    label: data.username + " (your account)",
                    value: data.urlname,
                    privateProjs: data.privateProjects,
                };
            }
        };

        let callbacks = {onSuccess: processData};
        state.organizations(callbacks);
        state.getUser(callbacks);
        menu.on("popupshowing", onMenuShow);
        menu.on("command", () =>
        {
            validate();
            updateVisibility();
        });
        return menu;
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
        field.addRadioItems([elems.publicRadio, elems.privateRadio]);
        elems.privateRadio.disable();
        
        field.attr("id", "platform-visibility");
        field.value(locale.get("checkbox_label_public").toLowerCase());
        
        return field;
    };
    
    var updateVisibility = () =>
    {
        let org = elems.organizationList.value();
        if (local.userOrgs[org].privateProjs)
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

    var determineLineLengthByWindowWidth = () =>
    {
        // Based on the users own font setting, determine how many characters
        //  will fit widthwise in the window.
        let buffer = 10; //pixels
        let windowWidthPX = document.getElementById("platform_wizard").width;
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
                ss = ss.substring(0,ss.length - 2);
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
    
    var createPlatformDesc = () =>
    {
        let container = require("ko/ui/column").create({ attributes: { id : "platform-desc"}});
        // Because xul sucks $#*% at keeping text bound in a description
        //  container (or any container) dynamically break it up based on user
        //  font size and the window width
        let maxLineLen = determineLineLengthByWindowWidth();
        let words = locale.get("platform_desc").split(" ");
        let stringDesc = "";
        let lineLen = stringDesc.length;
        for (let w of words) {
            if (lineLen + w.length >= maxLineLen) {
                container.addRow(require("ko/ui/description").create(stringDesc));
                stringDesc = w;
                lineLen = w.length;
            } else {
                stringDesc += " " + w;
                lineLen += w.length + 1; 
            }
        }
        container.addRow(require("ko/ui/description").create(stringDesc));
        container.addRow(require("ko/ui/spacer").create());
        container.addRow([
            require("ko/ui/link").create(locale.get("link_text_platform_desc"),
                { attributes : { href : locale.get("link_platform_desc")}})
        ]);
        container.addRow(require("ko/ui/spacer").create());
        
        return container;
    };
    
    var getPageStart = () =>
    {
        var page = require("ko/ui/wizardpage").create({ attributes:
        {
            title:"Project Properties",
            pageid:"pageStart"
        }});

        let title = locale.get("project_add_platform_title");
        if (Date.now() >= parseInt(prefs.getLong("platform_not_new", 1)))
        {
            title = locale.get("new") + "  " + title;
        }
        var group = page.addGroupbox({ caption: title});
        
        group.addRow(createPlatformDesc());
        
        group.addRow([
            require("ko/ui/label").create(locale.get("label_organization")),
            elems.organizationList
        ]);

        if ( !projectName)
        {
            group.addRow([
                require("ko/ui/label").create("Name:"),
                elems.name
            ]);
            group.addRow(elems.invalidMissingName);
            group.addRow([
                elems.dir
            ]).hide();
        }

        group.addRow([
            require("ko/ui/label").create("Language:"),
            elems.languages
        ]);

        group.addRow([elems.visibilityRadio, elems.visibilityHelper]);
        
        elems.pageStart = page;

        return page;
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
        var headerMsg = `Creating project "${elems.name.value()}" in the ${elems.organizationList.value()} organization`;
        elems.pathHeader.value(headerMsg);

        elems._actions = [
            { action: "fork" },
            { action: "init" }
        ];

        window.creator(elems, (createdProject) =>
        {
            project = createdProject;
        }, log.error, true, (!! legacy.projects.manager.currentProject));
    };
    
    var validate = () =>
    {
        let canAdvance = true;
        if (elems.organizationList.value() == "Choose an Organization")
        {
            elems.invalidChooseOrg.show();
            canAdvance = false;
        }
        else
        {
            elems.invalidChooseOrg.hide();
        }
        
        if (elems.name.value() == "")
        {
            elems.invalidMissingName.show();
            canAdvance = false;
        }
        else
        {
            elems.invalidMissingName.hide();
        }

        elems.$wizard.element().canAdvance = canAdvance;
    };
    
    window.addEventListener("load", init);
})();
