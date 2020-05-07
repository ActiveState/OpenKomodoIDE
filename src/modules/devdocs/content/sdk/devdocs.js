(function() {
    const log       = require("ko/logging").getLogger("devdocs")
    const {Cc, Ci, Cu} = require("chrome");
    const prefs     = require("ko/prefs");
    const w         = require("ko/windows").getMain();
    const $         = require("ko/dom");
    const legacy    = w.ko;
    const commands  = require("ko/commands");
    const timers    = require("sdk/timers");
    const ss        = require("ko/simple-storage").get("devdocs").storage;
    const btn       = require("ko/button");

    var dw;
    var timer;
    //log.setLevel(require("ko/logging").LOG_DEBUG);

    var enable = [
        "go",
        "node",
        "perl~",
        "php",
        "python~",
        "ruby~",
        "tcl_tk"
    ];

    this.load = () =>
    {
        commands.register("doc_open_current", this.open, {
            label: "Documentation: Open devdocs.io"
        });

        btn.register({
            id: "openDocs",
            label: "Open devdocs.io",
            toolbar: true,
            command: "cmd_doc_open_current",
            classList: "docs-icon",
            context: [
                {
                    select: "#toolsToolbarGroup",
                    where: "append"
                }
            ]
        });
    };
    
    this.unload = () =>
    {
        commands.unregister("doc_open_current");
        btn.unregister("openDocs");
    };

    this.open = (query) =>
    {
        var url = "https://devdocs.io/";

        if (isWindowActive())
            dw.location.href = url;
        else
            dw = w.open(url, "devdocs", "noopener=true,resizable=yes");

        onReady(() =>
        {
            if ( ! ss.installed)
                this.enableDefaults();

            query = query || require("ko/editor").getWord();
            if (query)
            {
                var input = dw.document.querySelector("input[name=q]");
                if (input)
                {
                    input.value = query;
                    var event = dw.document.createEvent("HTMLEvents");
                    event.initEvent("input", true, true);
                    input.dispatchEvent(event);
                }
            }
            
            hookOpenHandler();
        });
    };

    var hookOpenHandler = () =>
    {
        if ( ! isWindowActive())
        {
            return;
        }

        var dww = dw.wrappedJSObject;
        if ( ! dww.open.__koReady)
        {
            dww.open = (url) =>
            {
                if ( ! url)
                    return;

                timers.setTimeout(() =>
                {
                    legacy.browse.openUrlInDefaultBrowser(url);
                }, 0);
            };

            dww.open.__koReady = true;
        }
        
        timers.clearTimeout(timer);
        timer = timers.setTimeout(hookOpenHandler, 250);
    };
    
    this.enableDefaults = () =>
    {
        ss.installed = true;

        for (let name of enable)
        {
            let elem = dw.document.querySelector(`[data-enable^="${name}"]`);
            if ( ! elem)
                continue;

            elem.click();
        }
    };

    var onReady = (callback, firstCall = true) =>
    {
        if ( ! isWindowActive())
            return;

        if (firstCall || ! dw.document || dw.document.readyState != "complete")
        {
            timers.setTimeout(onReady.bind(null, callback, false), 100);
            return;
        }

        callback();
    };

    var isWindowActive = () =>
    {
        try
        {
            if (Cu.isDeadWrapper(dw))
                return false;
        }
        catch (e)
        {
            return false;
        }

        return true;
    };

}).apply(module.exports);
