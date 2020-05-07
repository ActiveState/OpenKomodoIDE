(function()
{

    const styleUtils = require("sdk/stylesheet/utils");
    const $ = require("ko/dom");
    const marked = require("contrib/marked");
    const w = require("ko/windows").getMain();
    const legacy = w.ko;
    const koFile = require("ko/file");
    const preview = require("preview/preview");
    const timers = require("sdk/timers");

    // We need a temp path so we can run our previewer on a `file://` path
    // otherwise we run into security issues (eg. relative images not loading)
    const tempPath = koFile.createTemp("temp.html");

    this.isEnabled = (view) =>
    {
        return view.language == "Markdown";
    };

    this.Previewer = function(view, browser)
    {
        var prepared = false;
        var firstLoad = true;

        if ( ! koFile.isFile(tempPath))
        {
            // recreate temp file if it got deleted
            koFile.create(tempPath);
        }

        this.getHtml = (callback) =>
        {
            if ( ! prepared)
            {
                browser.attr("src", "file://" + tempPath);
                browser.once("DOMContentLoaded", () =>
                {
                    prepared = true;
                    this.getHtml(callback);
                });

                var statusbar = $("<statusbar>").attr("align", "center");
                browser.before(statusbar);

                addressbar = $("<textbox>").attr({ value: "Markdown Preview", flex: 1, readonly: true });
                statusbar.append(addressbar);

                var closeButton = $("<button>").attr("class", "close-icon unstyled");
                closeButton.on("command", () => preview.close(view));
                statusbar.append(closeButton);
                
                return;
            }
            callback(marked(view.scimoz.text));

            styleUtils.loadSheet(browser.element().contentWindow, "less://preview/skin/markdown.less");

            var doc = browser.element().contentDocument;

            var baseURI = view.url ? view.url.replace(/\/[\w.-]+\.[\w-]+$/, '/') : "about:blank";
            var base = doc.createElement("base");
            base.setAttribute("href", baseURI);
            base.setAttribute("target", "_blank");
            doc.head.appendChild(base);

            if (firstLoad)
            {
                firstLoad = false;
                timers.setTimeout(() =>
                {
                    preview.reload(view);
                }, 0);
            }
        };
    };

}).apply(module.exports);