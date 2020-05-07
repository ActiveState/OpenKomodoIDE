(function() {

    const log = require("ko/logging").getLogger("clipboardmanager");
    const {Cc, Ci, Cu}  = require("chrome");
    const views = require("ko/views");
    const storage = require("ko/session-storage").get("clipboardmanager").storage;
    const commands = require("ko/commands");
    const windows = require("ko/windows");
    const clipboard = require("sdk/clipboard");
    const prefs = require("ko/prefs");

    const copyCommands = ["cmd_copy", "cmd_cut", "cmd_copyRegion", "cmd_copyLine"];

    //log.setLevel(10);

    var activePanel;

    if ( ! storage.history)
        storage.history = [];

    this.load = () =>
    {
        log.debug("load");

        commands.register("historicPaste", this.open,
        {
            isEnabled: () =>
            {
                return views.current().get();
            },
            label: "Paste from clipboard history"
        });
        commands.register("clearClipboardHistory", this.clearHistory,
        {
            isEnabled: () =>
            {
                return true;
            },
            label: "Clear clipboard history"
        });

        var ws = windows.getWindows();
        for (let w of ws)
        {
            onWindowLoad(w);
        }

        windows.onLoad(onWindowLoad);

        var w = windows.getMain();
        w.addEventListener("after_command", onCommand);
        w.addEventListener("activate", onCopy);
        w.addEventListener("buffer_pos_changed", onEditing);

        // Add current clipboard to session storage
        onCopy();
    };

    this.unload = () =>
    {
        log.debug("unload");
        
        if (activePanel)
            activePanel.close();

        commands.unregister("historicPaste");
        commands.unregister("clearClipboardHistory");

        var ws = windows.getWindows();
        for (let w of ws)
        {
            w.removeEventListener("copy", onCopy);
            w.removeEventListener("cut", onCopy);
        }
        
        windows.removeOnLoad(onWindowLoad);
        
        var w = windows.getMain();
        w.removeEventListener("after_command", onCommand);
        w.removeEventListener("activate", onCopy);
        w.removeEventListener("buffer_pos_changed", onEditing);
    };

    this.clearHistory = () =>
    {
        log.debug("clear");
        storage.history = [];
    };

    this.open = () =>
    {
        log.debug("open");
        
        if (storage.history.length === 0)
            return;

        if (activePanel)
            activePanel.close();

        activePanel = new Panel();
    };

    var onWindowLoad = (w) =>
    {
        w.addEventListener("copy", onCopy);
        w.addEventListener("cut", onCopy);
    };

    var onCommand = (e) =>
    {
        if (copyCommands.indexOf(e.detail) != -1)
            onCopy();
    };

    var onEditing = () =>
    {
        if (activePanel)
            activePanel.close();
    };
    
    var onCopy = () =>
    {
        var data = clipboard.get("text");
        if ( ! data)
            return;

        var idx = storage.history.indexOf(data);
        if (idx != -1)
        {
            storage.history.splice(idx, 1);
        }
        
        storage.history.push(data);
        storage.history = storage.history.slice(0 - prefs.getLong("clipboardmanager.max-entries", 10));
    };
    
    var Panel = function ()
    {
        log.debug("new Panel");

        var panel, listbox;
        var view = require("ko/views").current().get();
        
        var init = () =>
        {
            var w = windows.getMain();

            panel = require("ko/ui/panel").create(
            {
                level: "floating",
                noautofocus: true,
                class: "dialog clipboard"
            });

            listbox = require("ko/ui/richlistbox").create();

            for (let entry of storage.history.slice().reverse())
            {
                let item = require("ko/ui/richlistitem").create();
                item.element.value = entry;
                item.addElement(
                    require("ko/ui/description").create(entry.substr(0,200), { crop: "center" })
                );
                listbox.addElement(item);
            }

            panel.add(listbox);
            listbox.on("command", onSelectItem);
            listbox.on("click", onSelectItem);
            listbox.$element.children().first().attr("selected", "true");

            var cursorLocation = require("ko/editor").getCursorWindowPosition();

            panel.open(
            {
                x: cursorLocation.x,
                y: cursorLocation.y
            });

            panel.element.addEventListener("popuphiding", onHide);
            view.addEventListener("keypress", onKeyPress);
        };

        var onHide = () =>
        {
            view.removeEventListener("keypress", onKeyPress);
            //panel.remove();
            activePanel = null;
        };

        this.close = () =>
        {
            panel.close();
        };

        var onKeyPress = (e) =>
        {
            switch (e.keyCode)
            {
                case 13: /* enter */
                case 9:  /* tab */
                    onSelectItem();
                    break;
                case 38: /* up */
                    listbox.moveSelectionUp();
                    break;
                case 40: /* down */
                    listbox.moveSelectionDown();
                    break;
                default:
                    return;
            }

            e.preventDefault();
            e.stopPropagation();
        };

        var onSelectItem = () =>
        {
            var item = listbox.getSelectedItem();
            if ( ! item)
                return;

            var editor = require("ko/editor");
            var view = require("ko/views").current().get();
            var scimoz = view.scimoz;
            var selText = editor.getSelection();
            let itemValue = item.value;
            
            if (selText)
            {
                scimoz.replaceSel(itemValue);
            }
            else
            {
                var newPos = scimoz.currentPos + itemValue.length;
                scimoz.insertText(scimoz.currentPos, itemValue);
                scimoz.setSel(newPos, newPos);
            }
            panel.close();
        };
        
        init();
    };
   
}).apply(module.exports);