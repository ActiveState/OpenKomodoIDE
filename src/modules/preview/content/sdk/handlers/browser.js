(function()
{

    const {Cc, Ci}  = require("chrome");
    const $ = require("ko/dom");
    const timers = require("sdk/timers");
    const styleUtils = require("sdk/stylesheet/utils");
    const preview = require("preview/preview");
    const prefs = require("ko/prefs");

    this.isEnabled = (view) =>
    {
        var languages = prefs.getString("preview.browser.languages").split(",");
        return languages.indexOf(view.language) != -1;
    };

    this.Previewer = function(view, browser)
    {
        var backButton, forwardButton, homeButton, addressbar, lastURI, browserElem;
        var forceLoad = false;

        var init = () =>
        {
            browserElem = browser.element();

            browser.attr("type", "content");
            browser.attr("src", view.url);

            styleUtils.loadSheet(browserElem.contentWindow, "less://preview/skin/normalize.less");

            var statusbar = $("<statusbar>").attr("align", "center");
            browser.before(statusbar);

            addressbar = $("<textbox>").attr({ value: view.url, flex: 1, readonly: true });
            statusbar.append(addressbar);

            homeButton = $("<button>").attr("class", "gohome-icon unstyled");
            homeButton.on("command", () => preview.reload());
            statusbar.append(homeButton);

            closeButton = $("<button>").attr("class", "close-icon unstyled");
            closeButton.on("command", () => preview.close(view));
            statusbar.append(closeButton);

            lastURI = view.url;
            
            // Mozilla progress listeners are insanely unreliable, at least in moz35
            // so work around this with an interval
            timers.setInterval(checkUriChange, 1000);
        };

        var checkUriChange = () =>
        {
            if ( ! browserElem.currentURI || browserElem.currentURI.spec.indexOf(lastURI) != -1)
                return;

            lastURI = browserElem.currentURI.spec;
            addressbar.value(lastURI);
        };
        
        this.getHtml = (callback) =>
        {
            if ( ! forceLoad && browserElem.currentURI && browserElem.currentURI.spec.indexOf(view.url) == -1)
            {
                browserElem.loadURI(view.url);
                browser.once("DOMContentLoaded", () =>
                {
                    forceLoad = true; // account for JS modifying the url
                    this.getHtml(callback);
                });
                return;
            }
            
            forceLoad = false;

            callback(view.scimoz.text);
            styleUtils.loadSheet(browserElem.contentWindow, "less://preview/skin/normalize.less");
        };
        
        this.unload = () =>
        {
            timers.clearInterval(checkUriChange, 1000);
        };

        init();
    };

}).apply(module.exports);