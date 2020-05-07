/**
 * @module ko/dom
 *
 * options:
 * {
 *   <int> id: identifier for this call, used to merge repeat calls (the id otherwise gets auto generated)
 *   <boolean> cache: whether or not caching is enabled for this call
 *   <int> maxAge: maximum cache age (in ms)
 *   <string> method: the request method, one of: legacy, fallback, combined, <undefined> (regular request)
 * }
 */
(function()
{
    
    const {Cc, Ci}  = require("chrome");
    const log = require("ko/logging").getLogger("codeintel/service");
    const jsonrpc = require("ko/jsonrpc");
    const mediator = require("./service/mediator");
    const codeintel = require("./codeintel");

    // alias jsonrpc error constants, because dependant libraries should not
    // interact with jsonrpc directly
    this.ERROR_PARSING = jsonrpc.ERROR_PARSING;
    this.ERROR_INVALID_REQUEST = jsonrpc.ERROR_INVALID_REQUEST;
    this.ERROR_METHOD_NOT_FOUND = jsonrpc.ERROR_METHOD_NOT_FOUND;
    this.ERROR_INVALID_PARAMS = jsonrpc.ERROR_INVALID_PARAMS;
    this.ERROR_INTERNAL = jsonrpc.ERROR_INTERNAL;

    this.flush = mediator.flush;

    this.supportsLanguage = (language) =>
    {
        return !! mediator.getMediatorByLanguage(language);
    };

    this.supportsFeature = (feature, language) =>
    {
        var _mediator = mediator.getMediatorByLanguage(language);

        if ( ! _mediator)
            return false;

        return _mediator.supports(feature);
    };

    /**
     * Get language info for the given language
     *
     * @param {string} language
     *
     * @returns {object|bool}
     */
    this._getLanguageInfo = (language) =>
    {
        return mediator.getLanguageInfo(language);
    };

    /**
     * Get completions for the given buffer
     *
     * input:
     * {
     *   <string> buf: the buffer (your code)
     *   <int> pos: caret position in the buffer
     *   <string> language: language name
     *   <string> path (optional): path of the current buffer
     *   <string> parentPath (optional): the project/workspace path that this buffer belongs to
     *   <string> importPaths (optional): additional import paths
     *   <object> env (optional): environment variables
     * }
     *
     * @param {object} input
     * @param {object} options (see module section above)
     *
     * @returns {KoPromise}
     */
    this.getCompletions = mediator.mediate(
        "getCompletions",
        ["buf", "pos", "path", "parentPath", "importPaths", "language", "limit"],
        { cache: true, maxAge: 200, method: "fallback", feature: codeintel.FEATURE_COMPLETIONS }
    );

    /**
     * Get symbols in the current buffer
     *
     * input:
     * {
     *   <string> buf: the buffer (your code)
     *   <int> line: caret line in the buffer
     *   <int> pos: caret position in the buffer (only used by legacy api)
     *   <string> indentString: string representing a single indentation for the current buffer (eg. a tab, 4 spaces) (only used by legacy api)
     *   <string> language: language name
     *   <string> sortType: how to sort the results, one of: organic, alpha
     * }
     *
     * @param {object} input
     * @param {object} options (see module section above)
     *
     * @returns {KoPromise}
     */
    this.getSymbolsInBuffer = mediator.mediate(
        "getSymbolsInBuffer",
        ["buf", "line", "pos", "indentString", "language", "sortType"],
        { cache: true, maxAge: 200, feature: codeintel.FEATURE_SYMBOLBROWSER }
    );

    /**
     * Get the scope for the current caret position
     * ie. shows you what symbol the caret is on
     *
     * input:
     * {
     *   <string> buf: the buffer (your code)
     *   <int> line: caret line in the buffer
     *   <int> pos: caret position in the buffer (only used by legacy api)
     *   <string> language: language name
     * }
     *
     * @param {object} input
     * @param {object} options (see module section above)
     *
     * @returns {KoPromise}
     */
    this.getCaretScope = mediator.mediate(
        "getCaretScope",
        ["buf", "line", "pos", "language"],
        { cache: true, maxAge: 200, feature: codeintel.FEATURE_SYMBOLBROWSER }
    );

    /**
     * Get supported languages
     *
     * @param {object} input empty
     * @param {object} options (see module section above)
     *
     * @returns {KoPromise}
     */
    this.getLanguages = mediator.mediate(
        "getLanguages", [],
        { cache: true }
    );

    /**
     * Get keywords for the given language
     *
     * @param {string} language
     *
     * @returns {KoPromise}
     */
    this.getKeywords = mediator.mediate(
        "getKeywords", ["language"],
        { cache: true }
    );
    
    /**
     * Get symbols based on search query
     *
     * input:
     * {
     *   <string> query: the search query
     *   <string> path: prioritize results from this path
     *   <string> parentPath: scope results to symbols contained in this path
     *   <string> type: only return symbols of the given type
     *   <string> language: language name
     *   <int> limit: maximum number of results to return
     * }
     *
     * @param {object} input
     * @param {object} options (see module section above)
     *
     * @returns {KoPromise}
     */
    this.getSymbols = mediator.mediate(
        "getSymbols", ["query", "path", "parentPath", "type", "language", "limit"],
        { cache: true, maxAge: 10000, feature: codeintel.FEATURE_SYMBOLSCOPE }
    );

    /**
     * Retrieve a scan summary for the given path. Used to see what an actual
     * scan would be doing.
     *
     * input:
     * {
     *   <array> paths: path to scan
     *   <int> maxDepth: maximum scanning depth
     *   <array> excludes: array of excludes (as defined in the project prefs)
     *   <int> limit: maximum number of results to return
     * }
     *
     * @param {object} input
     * @param {object} options (see module section above)
     *
     * @returns {KoPromise}
     */
    this.scanSummary = mediator.mediate(
        "scanSummary", ["paths", "maxDepth", "excludes", "limit"], { feature: codeintel.FEATURE_SCANNER }
    );

    /**
     * Scan the given path
     *
     * input:
     * {
     *   <array> paths: paths to scan
     *   <int> maxDepth: maximum scanning depth
     *   <array> excludes: array of excludes (as defined in the project prefs)
     * }
     *
     * @param {object} input
     * @param {object} options (see module section above)
     *
     * @returns {KoPromise}
     */
    this.scan = mediator.mediate(
        "scan", ["paths", "maxDepth", "excludes"], { feature: codeintel.FEATURE_SCANNER }
    );
    
    /**
     * Get the next scope relative to the caret position
     *
     * input:
     * {
     *   <string> buf: the buffer (your code)
     *   <int> line: caret line in the buffer
     *   <int> pos: caret position in the buffer (only used by legacy api)
     *   <string> language: language name
     * }
     *
     * @param {object} input
     * @param {object} options (see module section above)
     *
     * @returns {KoPromise}
     */
    this.getNextScope = mediator.mediate(
        "getNextScope", ["buf", "line", "language"],
        { cache: true, maxAge: 10000, feature: codeintel.FEATURE_JUMPSECTIONS }
    );
    
    /**
     * Get the prev scope relative to the caret position
     *
     * input:
     * {
     *   <string> buf: the buffer (your code)
     *   <int> line: caret line in the buffer
     *   <int> pos: caret position in the buffer (only used by legacy api)
     *   <string> language: language name
     * }
     *
     * @param {object} input
     * @param {object} options (see module section above)
     *
     * @returns {KoPromise}
     */
    this.getPrevScope = mediator.mediate(
        "getPrevScope", ["buf", "line", "language"],
        { cache: true, maxAge: 10000, feature: codeintel.FEATURE_JUMPSECTIONS }
    );
    
    /**
     * Get a codeintel definition of the current symbol
     *
     * input object:
     * {
     *   <string> buf: the buffer (your code)
     *   <int> pos: caret position in the buffer
     *   <string> path (optional): path of the current buffer
     *   <string> parentPath (optional): the project/workspace path that this buffer belongs to
     *   <string> importPaths (optional): additional import paths
     *   <string> language: language name
     * }
     *
     * @param {object} input
     * @param {object} options (see module section above)
     *
     * @returns {KoPromise}
     */
    this.getDefinition = mediator.mediate(
        "getDefinition", ["buf", "pos", "path", "parentPath", "importPaths", "language"],
        { cache: true, maxAge: 10000, method: "fallback", feature: codeintel.FEATURE_GOTODEF }
    );

    /**
      * Get a list of references for the current symbol
      *
      * input object:
      * {
      *   <string> buf: the buffer (your code)
      *   <int> pos: caret position in the buffer
      *   <string> path: path of the current buffer
      *   <string> parentPath: the project/workspace path that this buffer belongs to
      *   <string> language: language name
      * }
      *
      * @param {object} input
      * @param {object} options (see module section above)
      *
      * @returns {KoPromise}
      */
    this.getReferences = mediator.mediate(
        "getReferences", ["buf", "pos", "path", "parentPath", "language"],
        { cache: true, maxAge: 10000, method: "fallback", feature: codeintel.FEATURE_FINDREFERENCES }
    );
    
    /**
     * Get available catalogs for the given language.
     *
     * @param {string} language
     *
     * @returns {koPromise}
     */
    this.getCatalogs = mediator.mediate(
        "getCatalogs", ["language"],
        { cache: true, mediator: "codeintel/service/mediator/codeintel" }
    );
    
    /**
     * Loads the given catalog (obtained via "this.getCatalogs()") into the
     * scanner for the given language.
     *
     * @param {string} language
     * @param {string} catalog
     *
     * @returns {koPromise}
     */
    this.loadCatalog = mediator.mediate(
        "loadCatalog", ["language", "catalog"],
        { mediator: "codeintel/service/mediator/codeintel" }
    );

    this.keepalive = mediator.mediate(
        "keepalive", []
    );

}).apply(module.exports);
