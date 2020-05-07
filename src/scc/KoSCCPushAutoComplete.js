/* Copyright (c) 2012 ActiveState Inc.
   See the file LICENSE.txt for licensing information. */

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

var {stringutils} = Cu.import("chrome://komodo/content/library/stringutils.js", {});
var {logging} = Cu.import("chrome://komodo/content/library/logging.js", {});
var log = logging.getLogger("scc.push.autocomplete.known");

/**
 * nsIAutoComplete search provider for the SCC Push dialog, listing the known
 * remote repositories (i.e. those known by SCC configuration)
 * Note that for silly reasons over in nsAutoCompleteController.cpp, this is a
 * singleton...
 */
function KoSCCPushAutoComplete() {
    this.results = [];
}

KoSCCPushAutoComplete.prototype = {

    startSearch: function KoSCCPushAutoComplete_startSearch(searchString,
                                                            searchParam,
                                                            previousResult,
                                                            listener)
    {
        var result = previousResult ? previousResult.wrappedJSObject : null;
        if (!result || !(result instanceof KoSCCPushAutoCompleteResult)) {
            result = new KoSCCPushAutoCompleteResult(this);
        }
        result.startSearch(searchString, searchParam, listener);
        var oldResults = this.results = this.results.filter(function(r) r.get());
        if (!this.results.some(function(r) XPCNativeWrapper.unwrap(r.get()) == result)) {
            this.results.push(Components.utils.getWeakReference(result));
        }
    },

    stopSearch: function KoSCCPushAutoComplete_stopSearch()
    {
        var oldResults = this.results.splice(0, this.results.length);
        for each (let result in oldResults) {
            result = result.get();
            if (result) {
                result.wrappedJSObject.stopSearch();
            }
        }
    },

    // properties required for XPCOM registration:
    classDescription: "KoSCCPushAutoComplete XPCOM Component",

    classID:          Components.ID("{95012774-5ec9-4fcf-8ed9-31e6ef8263a3}"),
    contractID:       "@mozilla.org/autocomplete/search;1?name=scc-push-known",

    QueryInterface: XPCOMUtils.generateQI([Ci.nsIAutoCompleteSearch]),

};

/**
 * This is a nsIAutoCompleteResult instance which implements the actual search,
 * so that multiple searchs may be conducted in parallel.  It also implements
 * caching of remotes.
 */
function KoSCCPushAutoCompleteResult(aAutoCompleteSearch)
{
    this.wrappedJSObject = this;
    this.search = aAutoCompleteSearch;
    this.asyncOp = null;
    this.sccSvc = null;
    this.searchResult = Ci.nsIAutoCompleteResult.RESULT_IGNORED;
    this.results = [];
    this.repoURI = undefined;
    this.remotes = undefined;
}

KoSCCPushAutoCompleteResult.prototype.defaultIndex = 0;

KoSCCPushAutoCompleteResult.prototype.errorDescription = null;

Object.defineProperty(KoSCCPushAutoCompleteResult.prototype, "matchCount", {
    get: function() this.results.length,
    enumerable: true,
});

KoSCCPushAutoCompleteResult.prototype.typeAheadResult = false;

KoSCCPushAutoCompleteResult.prototype.getValueAt =
    function KoSCCPushAutoCompleteResult_getValueAt(index)
{
    return this.results[index].value;
};

KoSCCPushAutoCompleteResult.prototype.getLabelAt =
    function KoSCCPushAutoCompleteResult_getLabelAt(index)
{
    return this.results[index].label;
};

KoSCCPushAutoCompleteResult.prototype.getCommentAt =
    function KoSCCPushAutoCompleteResult_getCommentAt(index)
{
    return this.results[index].comment;
};

KoSCCPushAutoCompleteResult.prototype.getStyleAt =
    function KoSCCPushAutoCompleteResult_getStyleAt(index)
{
    return this.results[index].style;
};

KoSCCPushAutoCompleteResult.prototype.getImageAt =
    function KoSCCPushAutoCompleteResult_getImageAt(index)
{
    return this.results[index].image;
};

KoSCCPushAutoCompleteResult.prototype.removeValueAt =
    function KoSCCPushAutoCompleteResult_removeValueAt(index, removeFromDb)
{
    this.results.splice(index, 1);
};

/**
 * Fire off the search
 * @param searchString {String} The user-typed string to search for
 * @param searchParam {String} The search param attribute on the textbox
 *      (used here to mean the repo URI)
 * @param listener {nsIAutoCompleteObserver} The search listener to report to
 */
KoSCCPushAutoCompleteResult.prototype.startSearch =
    function KoSCCPushAutoCompleteResult_startSearch(searchString,
                                                     searchParam,
                                                     listener)
{
    searchString = searchString.toLowerCase(); // case insenitive please
    this.stopSearch();
    this.results = [];

    searchParam = stringutils.getSubAttr(searchParam, "scc-push-known") || searchParam;

    this.searchResult = Ci.nsIAutoCompleteResult.RESULT_NOMATCH_ONGOING;
    this.listener = listener;
    if (searchParam !== this.repoURI) {
        // repo URI changed, invalidate results
        this.remotes = undefined;
    }

    /**
     * Callback for when the repos are available
     * @param remotes {Array of Object} list of remotes; each remote is expected
     *      to have "url" and "name" properties.
     */
    var reportResults = (function reportResults(remotes) {
        this.results = [];
        this.remotes = remotes;
        if (!remotes.length) {
            this.searchResult = Ci.nsIAutoCompleteResult.RESULT_NOMATCH;
            this.listener.onSearchResult(this.search, this);
        } else {
            for each (let {url, name} in remotes) {
                if (url.toLowerCase().indexOf(searchString) == -1 &&
                    name.toLowerCase().indexOf(searchString) == -1)
                {
                    // doesn't match this search result
                    continue;
                }
                this.results.push({
                   value: url,
                   label: url,
                   comment: name,
                   style: null,
                   image: null,
                });
                log.debug("adding result: " + url + " = " + name +
                          ": count=" + this.results.length);
            }
            if (this.results.length > 0) {
                this.searchResult = Ci.nsIAutoCompleteResult.RESULT_SUCCESS;
            } else {
                this.searchResult = Ci.nsIAutoCompleteResult.RESULT_NOMATCH;
            }
            this.listener.onSearchResult(this.search, this);
        }
    }).bind(this);

    if (this.remotes) {
        // we have cached info already, just report things
        reportResults(this.remotes);
    } else {
        // need to ask the SCC about remotes
        this.repoURI = searchParam;
        this._getRemotes(this.repoURI, reportResults);
    }
};

/**
 * Get the list of remotes
 * @param repoURI {String} The URI of the repository to find remotes for
 * @param callback {Function} The function to report results to; it will receive
 *      an array of objects, each of which will have "url" and "name" properties.
 * @note Errors are currently unreported (it goes through _doSccOp).
 */
KoSCCPushAutoCompleteResult.prototype._getRemotes =
    function KoSCCPushAutoCompleteResult__getRemotes(repoURI,
                                                     callback)
{
    this.stopSearch();

    let repoFile = Cc["@activestate.com/koFileService;1"]
                     .getService(Ci.koIFileService)
                     .getFileFromURI(repoURI);
    var sccType = repoFile.sccType || repoFile.sccDirType;
    if (!sccType || repoFile.sccExclude) {
        // no SCC available
        callback([]);
    } else {
        this.sccSvc = Cc["@activestate.com/koSCC?type=" + sccType + ";1"]
                        .getService(Ci.koISCC);
        this._doSccOp("getRoot", function(repoRoot) {
            this._doSccOp("getKnownRemotes", function(data) {
                log.debug("Got results: " + JSON.stringify(data));
                let repos = [];
                for each (let [url, name] in data) {
                    repos.push({url: url, name: name});
                }
                callback(repos);
            }, repoRoot);
        }, repoFile.path);
    }
};

/**
 * Do an SCC operation asynchronously
 * @param method {String} The SCC operation to execute
 * @param callback {Function} A callback function; it will receive the async
 *      result as its argument
 * @param ... The rest of the parameters to pass to the SCC operation
 */
KoSCCPushAutoCompleteResult.prototype._doSccOp =
    function KoSCCPushAutoCompleteResult__doSccOp(method, callback /* ,arguments */)
{
    if (this.asyncOp) {
        // abort the previous operation
        try {
            this.asyncOp.stop();
        } catch (ex) {
            /* ignore any errors on stopping, nothing we can do */
        }
    }
    args = Array.slice(arguments, KoSCCPushAutoCompleteResult__doSccOp.length);
    args.push((function(result, data) {
        if (result != Ci.koIAsyncCallback.RESULT_SUCCESSFUL) {
            log.debug("SCC async operation " + method +
                      "(" + args.slice(0, -1) + ") failed:\n" + data);
            this.searchResult = Ci.nsIAutoCompleteResult.RESULT_FAILURE;
            this.listener.onSearchResult(this.search, this);
            return;
        }
        callback.call(this, data);
    }).bind(this));
    this.asyncOp = this.sccSvc[method].apply(this.sccSvc, args);
};

/**
 * Abort this search
 */
KoSCCPushAutoCompleteResult.prototype.stopSearch =
    function KoSCCPushAutoCompleteResult_stopSearch()
{
    if (this.asyncOp) {
        try {
            this.asyncOp.stop();
        } catch (ex) {
            /* ignore any errors on stopping, nothing we can do */
        }
    }
};

KoSCCPushAutoCompleteResult.prototype.QueryInterface =
    XPCOMUtils.generateQI([Ci.nsIAutoCompleteResult,
                           Ci.nsISupportsWeakReference]);

const NSGetFactory = XPCOMUtils.generateNSGetFactory([KoSCCPushAutoComplete]);
