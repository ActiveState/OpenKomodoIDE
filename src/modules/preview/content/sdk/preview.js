(function()
{
    const {Cc, Ci}  = require("chrome");
    const log = require("ko/logging").getLogger("preview");
    const $ = require("ko/dom");
    const l = require("ko/locale");
    const stylesheet = require("ko/stylesheet");
    const w = require("ko/windows").getMain();
    const Previewer = require("./previewer");
    const views = require("ko/views");

    var handlers = {};
    var viewers = { length: 0 };

    this.load = () =>
    {
        this.register(l.get("web_browser"), "preview/handlers/browser");
        this.register(l.get("markdown"), "preview/handlers/markdown");

        require("ko/commands").register("preview", this.invoke,
        {
            label: l.get("preview_buffer"),
            isEnabled: this.isEnabled
        });

        require("ko/dynamic-button").register("Preview",
        {
            command: "cmd_preview",
            events: ["current_view_changed", "current_view_language_changed", "workspace_restored"],
            ordinal: 50,
            group: "preview",
            groupOrdinal: 200,
            icon: "eye4",
            isEnabled: this.isEnabled,
            menuitems: getMenuItems
        });

        stylesheet.loadGlobal("less://preview/skin/preview.less");
    };

    this.unload = () =>
    {
        this.unregister(l.get("web_browser"));
        stylesheet.unloadGlobal("less://preview/skin/preview.less");
    };

    this.getFirstEnabledHandler = (view) =>
    {
        if ( ! view)
            view = views.current();
        for (let name in handlers)
        {
            let handler = this.getHandler(name);
            if (handler.isEnabled(view))
            {
                return handler;
            }
        }
    };

    this.isEnabled = () =>
    {
        return !! this.getFirstEnabledHandler();
    };

    this.getHandler = (name) =>
    {
        if ( ! (name in handlers))
            throw Error("Handler does not exist: " + name);

        return require(handlers[name].namespace);
    };

    this.register = (name, namespace) =>
    {
        log.debug("Registering " + name);

        var handler;

        try
        {
            handler = require(namespace);
            if ("load" in handler)
                handler.load();
        }
        catch (e)
        {
            log.exception(e, "Failed loading handler: " + name);
        }

        handlers[name] =
        {
            name: name,
            namespace: namespace,
            module: handler
        };
    };

    this.unregister = (name) =>
    {
        if ( ! (name in handlers))
            return;

        var handler = handlers[name];

        try
        {
            if ("unload" in handler.module)
                handler.module.unload();
            delete handlers[name];
        }
        catch (e)
        {
            log.exception(e, "Failed unloading handler: " + name);
        }
    };
    
    this.invoke = (name) =>
    {
        if ( ! this.isEnabled())
            return;
        
        var handler;
        if (name)
            handler = this.getHandler(name);
        else
            handler = this.getFirstEnabledHandler();
        
        var view = views.current();
        this.loadForView(view, handler);
    };

    this.loadForView = (view, handler) =>
    {
        if ( ! view.get())
            return;

        this.unloadForView(view);

        var uid = view.uid.toString();
        viewers[uid] = new Previewer(view, handler);
        viewers.length++;

        view.get().addEventListener("view_closing", () => this.unloadForView(view));
    };

    this.unloadForView = (view) =>
    {
        var uid = view.uid.toString();
        if ( ! (uid in viewers))
            return;

        viewers[uid].unload();
        delete viewers[uid];
        viewers.length--;
    };

    this.isOpen = (view) =>
    {
        if ( ! view)
            view = views.current();

        if ( ! view.get())
            return false;

        var uid = view.uid.toString();
        if (uid in viewers)
            return true;

        return false;
    };

    this.reload = (view) =>
    {
        if ( ! view)
            view = views.current();

        if ( ! view.get())
            return;

        var uid = view.uid.toString();
        if ( ! (uid in viewers))
            return;

        viewers[uid].update();
    };

    this.close = (view) =>
    {
        if ( ! view)
            view = views.current();

        if ( ! view.get())
            return;

        var uid = view.uid.toString();
        if ( ! (uid in viewers))
            return;

        viewers[uid].unload();
        delete viewers[uid];
    };

    var getMenuItems = () =>
    {
        var view = views.current();
        var items = [];
        for (let name in handlers)
        {
            let handler = this.getHandler(name);
            if ( ! handler.isEnabled(view))
                continue;
            items.push({
                label: name,
                command: this.invoke.bind(null, name)
            });
        }

        if (this.isOpen())
        {
            items.push(null); // separator
            items.push({
                label: l.get("reload"),
                command: this.reload
            });
            items.push({
                label: l.get("close"),
                command: this.close
            });
        }
        
        return items;
    };

}).apply(module.exports);