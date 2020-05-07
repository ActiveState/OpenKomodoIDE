const {Cc, Ci, Cu}  = require("chrome");
const log = require("ko/logging").getLogger("preview");
const $ = require("ko/dom");
const l = require("ko/locale");
const preview = require("./preview");
const styleUtils = require("sdk/stylesheet/utils");
const _ = require("contrib/underscore");
const w = require("ko/windows").getMain();
const legacy = w.ko;

const scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"]
                            .getService(Ci.mozIJSSubScriptLoader);
Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);

module.exports = function(view, handler)
{
    var vbox, browser, splitter, prepared, opts, previewHandler, uid;

    var init = () =>
    {
        uid = "preview-" + view.uid;
        var outer = $(view.get()).findAnonymous("anonid", "outer");
        splitter = $("<splitter>").attr("class", "preview-splitter");
        vbox = $("<vbox>").attr({ class: "preview-outer", width: Math.floor(view.get().boxObject.width / 2)});
        browser = $("<browser>").attr(
        {
            class: "preview-browser",
            id: uid,
            type: "content",
            src: "data:text/html,%3Chtml%3E%3Cbody%3E%3C/body%3E%3C/html%3E",
            flex: 1
        });
        vbox.append(browser);
        outer.append(splitter);
        outer.append(vbox);
        
        previewHandler = new handler.Previewer(view, browser);

        window.addEventListener("editor_text_modified", this.update.debounced);
        browser.once("DOMContentLoaded", this.update.debounced);
    };

    this.update = () =>
    {
        previewHandler.getHtml((html) =>
        {
            $(w).trigger("update-preview", {
                id: uid,
                data: html
            });
        });
    };

    this.update.debounced = (data) =>
    {
        if (!data || !data.view || data.view == view.get()) {
            _.debounce(this.update, 500)();
        }
    };

    this.unload = () =>
    {
        if (previewHandler && "unload" in previewHandler)
            previewHandler.unload();

        vbox.remove();
        splitter.remove();
        
        window.removeEventListener("editor_text_modified", this.update.debounced);
    };

    init();

};