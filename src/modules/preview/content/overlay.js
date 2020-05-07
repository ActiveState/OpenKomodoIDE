window.addEventListener("load", () =>
{
    try {
        require.setRequirePath("preview/", "chrome://preview/content/sdk/");
        require("preview").load();
    } catch (e) {
        Cu.reportError("Exception while loading 'preview'");
        Cu.reportError(e);
    }
});

/*
 * This logic needs to live outside of a jetpack module stack call because otherwise
 * we'll run into security issues. That's right, jetpack modules can run commands
 * and delete important system files, but touch a browser window? nono!
 */
(function() {

    var getElems = (browser) =>
    {
        var w = browser.contentWindow.wrappedJSObject;
        var doc = w.document;
        var body = doc.body;
        return [w, doc, body];
    };

    window.addEventListener("update-preview", (event) =>
    {
        var browser = document.getElementById(event.detail.id);
        var [w, doc, body] = getElems(browser);

        var scrollTop = body.scrollTop || doc.documentElement.scrollTop;
        var scrollLeft = body.scrollLeft || doc.documentElement.scrollLeft;
        browser.style.width = browser.boxObject.width;

        doc.open();
        doc.write(event.detail.data);
        doc.close();

        w.scrollTo(scrollLeft, scrollTop);
        browser.style.width = undefined;

        var onReady = (leaveListener) =>
        {
            [w, doc, body] = getElems(browser);
            w.scrollTo(scrollLeft, scrollTop);
            w.removeEventListener("load", onReady);
        };
        w.addEventListener("load", onReady);
    });
})();