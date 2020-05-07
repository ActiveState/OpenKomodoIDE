(function()
{
    
    const {Cc, Ci}  = require("chrome");
    const mainWindow= require("ko/windows").getMain();
    const unittest  = require("unittest/unittest");
    const panel     = require("unittest/panel");
    const uuid      = require('sdk/util/uuid');
    const prefs     = require("ko/prefs");
    const koPrefset = Cc["@activestate.com/koPreferenceSet;1"];
    const ko        = mainWindow.ko;
    
    var activeEditor;

    this.create = () =>
    {
        return this.edit();
    };
    
    this.edit = (prefset) =>
    {
        if (activeEditor && activeEditor.isActive())
        {
            var confirmed = require("ko/dialogs").confirm(
                "You're already editing a configuration, do you wish to cancel that one and proceed?"
            );
            if (confirmed)
            {
                activeEditor.stop();
            }
        }
        
        activeEditor = new ConfigEditor(prefset);
    };
    
    this.delete = function(prefset)
    {
        var confirmed = require("ko/dialogs").confirm("Are you sure you want to delete " + prefset.getString("name") + "?");
        if (confirmed)
        {
            unittest.deleteConfig(prefset);
            prefset.parent.deletePref(prefset.id);
            
            for (let p of panel.getPanels())
            {
                p.unittestPanel.reloadConfigMenu();
            }
        }
    };
    
    var ConfigEditor = function(prefset)
    {
        
        var dialog, mapping, fields, isNew, interpolationBtn;
        
        this.isActive = () =>
        {
            return !! dialog && ! dialog.closed;
        };
        
        this.stop = () =>
        {
            dialog.close();
        };
        
        var init = () =>
        {
            // Detect parent prefs and create it if it doesnt exist
            isNew = ! prefset;
            
            if (isNew)
            {
                prefset = koPrefset.createInstance();
                prefset.id = uuid.uuid().toString();
            }
            
            // Prepare handler entries
            var viewLanguage = require("ko/views").current().language;
            var relevantHandler = "";
            var handlers = unittest.getHandlers();
            var handlerEntries = [ { attributes: { value: "", label: "Select One .." } } ];
            for (let handler in handlers)
            {
                let label =  handlers[handler].label;
                if (handlers[handler].language)
                    label = handlers[handler].language + " - " + label;
                    
                if (handlers[handler].language == viewLanguage)
                    relevantHandler = handlers[handler].id;
                
                handlerEntries.push({ attributes: {
                    value: handlers[handler].id,
                    label: label
                }});
            }
            
            // Prepare parser entries
            var parsers = unittest.getParsers();
            var parserEntries = [ { attributes: { value: "", label: "Select One .." } } ];
            for (let parser in parsers)
            {
                parserEntries.push({ attributes: {
                    value: parsers[parser].id,
                    label: parsers[parser].label
                }});
            }
            
            var title = isNew ? "Create Unittest Config" : "Edit Unittest Config";
            
            var saveToOptions = [
                { attributes: { label: "Global", value: "global" } },
                { attributes: { label: "Project", value: "project", disabled: ! ko.projects.manager.currentProject } },
                { attributes: { label: "Current File", value: "file", disabled: ! require("ko/views").current().get("koDoc") } },
            ];
            
            var saveToValue = "global";
            if (isNew && ko.projects.manager.currentProject)
                saveToValue = "project";
            
            if ( ! isNew)
                saveToValue = prefset.getString("saveTo", saveToValue);
                
            fields = {
                name: {
                    label: "Name",
                    value: prefset.getString("name", ""),
                    required: true,
                    group: "Basics"
                },
                path: {
                    label: "Path",
                    type: "filepath",
                    options: { filetype: "dir" },
                    value: prefset.getString("path", ""),
                    required: true,
                    group: "Basics"
                },
                handler: {
                    label: "Framework",
                    type: "menulist",
                    options: { menuitems: handlerEntries },
                    value: prefset.getString("handler", relevantHandler),
                    required: true,
                    group: "Basics"
                },
                command: {
                    label: "Command",
                    value: prefset.getString("command", ""),
                    group: "Advanced (optional)"
                },
                parser: {
                    label: "Parser",
                    type: "menulist",
                    options: { menuitems: parserEntries },
                    value: prefset.getString("parser", ""),
                    group: "Advanced (optional)"
                },
                saveTo: {
                    label: "Save To",
                    type: "menulist",
                    options: { menuitems: saveToOptions },
                    value: saveToValue,
                    group: "Advanced (optional)"
                }
            };
            
            dialog = require("ko/modal").open({
                title: title,
                fields: fields,
                onComplete: onSubmit,
                onReady: onReady,
            });
        };

        var onReady = (parent, _mapping) =>
        {
            mapping = _mapping;

            mapping.handler.onChange(onChangeHandler);
            
            interpolationBtn = require("ko/ui/interpolation-button").create();
            mapping.command.$element.after(interpolationBtn.$element);
            
            onChangeHandler();
        };
        
        var onChangeHandler = () =>
        {
            var handler = mapping.handler.value();
            handler = unittest.getHandler(handler);
            
            mapping.command.value(handler.command);
            
            updateState();
        };
        
        var updateState = () =>
        {
            if ( ! isNew)
            {
                mapping.saveTo.disable();
            }
            
            if (mapping.handler.value() == "custom")
            {
                mapping.command.removeAttr("readonly");
                interpolationBtn.removeAttr("disabled");
            }
            else
            {
                mapping.command.attr("readonly", "true");
                interpolationBtn.attr("disabled", "true");
                
                var handler = mapping.handler.value();
                handler = unittest.getHandler(handler);
                
                if (handler)
                    mapping.parser.value(handler.parser);
            }
            
        };
        
        var onSubmit = (values) =>
        {
            if ( ! values)
                return;
            
            for (let key in values)
                prefset.setString(key, values[key]);
                
            if (isNew)
            {
                var parentPrefs = getParentPrefs();
                parentPrefs.setPref(prefset.id, prefset);
                unittest.addConfig(prefset);
            }
            
            var panels = require("unittest/panel").getPanels();
            for (let p of panels)
            {
                p.unittestPanel.reloadConfigMenu(prefset.id);
            }
        };
        
        var getParentPrefs = () =>
        {
            if (isNew)
            {
                var saveTo = mapping.saveTo.value();
                var parentPrefs = prefs;
                
                if (saveTo == "project")
                    parentPrefs = ko.projects.manager.currentProject.prefset;
                    
                if (saveTo == "file")
                    parentPrefs = ko.views.manager.currentView.koDoc.prefs;
                    
                if ( ! parentPrefs.hasPrefHere("unittest-configs"))
                {
                    parentPrefs.createPref("unittest-configs");
                }
                    
                return parentPrefs.getPref("unittest-configs");
            }
            else
                return prefset.parent;
        };
        
        init();
        
    };
    
}).apply(module.exports);
