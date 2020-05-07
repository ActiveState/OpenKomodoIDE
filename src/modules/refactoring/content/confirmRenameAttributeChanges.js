// Copyright (c) 2000-2013 ActiveState Software Inc.
// See the file LICENSE.txt for licensing information.
//---- globals

var { classes: Cc, interfaces: Ci, utils: Cu } = Components;

if (typeof(ko)=='undefined') {
    var ko = {};
}
if (typeof(ko.refactoring)=='undefined') {
    ko.refactoring = {};
}
if (typeof(ko.refactoring.renameClassMember)=='undefined') {
    ko.refactoring.renameClassMember = {};
}

var widgets = {};
var log = ko.logging.getLogger("refactoring.confirmRenameClassMemberChange");
//log.setLevel(ko.logging.LOG_DEBUG);
var g_args;
var g_defn;
var g_displayTree = null;
var g_view = null;
var g_refactoringLanguageObj = null;
var g_ko = null;
var g_force = false;

var hitsByURL; /* { url => {
                     path => path,
                     hitListLines => { lineNum => { context: line of text,
                                                    hitList: [startIndex, endIndex,
                                                              columnNo] } } } } */

var scopeStart;
var scopeEnd;

function init_widgets () {
    widgets.repls = document.getElementById("repls");
    widgets.showChangesButton = document.getElementById("show-marked-changes-btn");
};

function init() {
    g_args = window.arguments[0];
    g_defn = g_args.defn;
    g_view = g_args.view;
    g_ko = g_args.ko;
    g_force = g_args.force;
    if (g_defn && !g_defn.path) {
        log.debug("Abandon a codeintel def'n object with no path\n");
        g_defn = null;
    }
    g_refactoringLanguageObj = g_args.refactoringLanguageObj;
    [scopeStart, scopeEnd] = (g_defn ? [g_defn.scopestart, g_defn.scopeend] : [-1, -1]);
}

// hits have the form [startPos, endPos, column]
// startPos and endPos are in terms of the document, so they
// need to be normalized.
// column is one-based, so it needs to be adjusted by -1
function LineManager(textLine, repl, hits) {
    this.textLine = textLine;
    this.repl = repl;
    this.parts = [];
    let lim = hits.length;
    this.origs = new Array(lim);
    this.actives = new Array(lim);
    let pos = 0;
    for (let i = 0; i < lim; i++) {
        let hit = hits[i];
        let hitStart = hit[2] - 1;
        let startPos = hit[0], endPos = hit[1];
        let hitEnd = hitStart + endPos - startPos;
        this.parts.push(textLine.substring(pos, hitStart));
        pos = hitEnd;
        let orig = textLine.substring(hitStart, hitEnd)
        this.origs[i] = orig;
        this.actives[i] = orig;
    }
    this.parts.push(textLine.substr(pos));
    this._cachedText = null;
};

LineManager.prototype = {
    applyChange: function applyChange(i) {
        this.actives[i] = this.repl;
        this._cachedText = null;
    },
    undoChange: function undoChange(i) {
        this.actives[i] = this.origs[i];
        this._cachedText = null;
    },
    undoAll: function undoAll() {
        for (let i = 0; i < this.actives.length; i++) {
            this.actives[i] = this.origs[i];
        }
        this._cachedText = null;
    },
    applyAll: function applyAll() {
        for (let i = 0; i < this.actives.length; i++) {
            this.actives[i] = this.repl;
        }
        this._cachedText = null;
    },
    getText: function getText() {
        if (this._cachedText === null) {
            let lim = this.parts.length;
            let newParts = new Array(lim * 2 + 1);
            lim -= 1;
            let j = 0;
            for (let i = 0; i < lim; i++) {
                newParts[j++] = this.parts[i];
                newParts[j++] = this.actives[i];
            }
            newParts[j] = this.parts[lim];
            this._cachedText = newParts.join("");
        }
        return this._cachedText;
    }
};
            
function onLoad () {
    try {
        init_widgets();
        init();
        startSearch();
    } catch(ex) {
        log.exception(ex, "confirmRenameClassMemberChanges.js: onLoad. Error");
    }
};

function cancel() {
    return true;
}

function doHits(hitsByURL) {
    g_displayTree = new TreeView();
    //g_hitsByURL = hitsByURL;
    g_displayTree.updateRows(hitsByURL);
    widgets.view_repls = g_displayTree;
    widgets.repls.treeBoxObject.view = widgets.view_repls;
    for (let i = g_displayTree.rowCount - 1; i >= 0; --i) {
        g_displayTree._wrapToggleOpenState(i);
    }
    // And update the text of each row.  Otherwise if the user presses
    // "Show Changes" first any rows below the last visible line
    // won't be updated.
    for (let i = g_displayTree.rowCount - 1; i >= 0; --i) {
        g_displayTree.getCellText(i, {id: "text"});
    }
    
    updateUI('g_displayTree');

    if (g_force)
    {
        make_changes();
        window.close();
    }
}

function onTreeClick(aEvent) {
    if (aEvent.button == 2) {
        return;
    }
    var row = {}, col = {};
    widgets.repls.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY,
                                          row, col, {});
    row = row.value;
    col = col.value;
    if (!col) {
        return;
    }
    if (aEvent.metaKey || aEvent.ctrlKey || aEvent.shiftKey || aEvent.altKey) {
        return;
    }
    if (col.id == "isChecked") {
        try {
            if (g_displayTree._invoked_toggleOpenState) {
                // We processed an open/close container event
                g_displayTree._invoked_toggleOpenState = false;
                return;
            }
            try {
                g_displayTree.toggleRowChecked(row);
            } catch(ex) {
                log.exception(ex, "Prob in toggleRowChecked");
            }
        } catch(ex2) {
            log.exception(ex2, "toggleRowChecked => blew up");
        }
    }
}

function onTreeDblClick(aEvent) {
    if (('button' in aEvent) && aEvent.button == 2) {
        return;
    }
    var row, col;
    if (aEvent.type == "keypress") {
        row = widgets.view_repls.selection.currentIndex;
        col = {id: "path"};
    } else {
        row = {};
        col = {};
        widgets.repls.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY,
                                              row, col, {});
        row = row.value;
        col = col.value;
        if (!col) {
            return;
        }
    }
    if (aEvent.metaKey || aEvent.ctrlKey || aEvent.shiftKey || aEvent.altKey) {
        return;
    }
    if (col.id != "isChecked") {
        // Go to the selected file & line
        var theRows = g_displayTree._rows;
        var theRow = theRows[row];
        let path = null, lineNo = null;
        if (theRow.isContainer) {
            path = theRow.path;
        } else {
            var parentIndex = g_displayTree.getParentIndex(row);
            path = theRows[parentIndex].path;
            lineNo = theRow.lineNo;
        }
        if (path) {
            if (lineNo) {
                g_ko.open.URIAtLine(path, lineNo, "editor", true,
                                    function(view) {
                                        let scimoz = view.scimoz;
                                        let startPos = scimoz.positionFromLine(lineNo - 1);
                                        let endPos = scimoz.positionFromLine(lineNo);
                                        scimoz.selectionStart = startPos;
                                        scimoz.selectionEnd = endPos;
                                    });
            } else {
                g_ko.open.URIAtLine(path, lineNo, "editor");
            }
        }
    }
    if (aEvent) {
        aEvent.stopPropagation();
        aEvent.preventDefault();
        aEvent.cancelBubble = true;
    }
}

function onKeyPress(aEvent) {
    if (aEvent.keyCode == 13) {
        onTreeDblClick(aEvent);
        aEvent.stopPropagation();
        aEvent.preventDefault();
        aEvent.cancelBubble = true;
        return false;
    }
    return true;
}

function TreeView() {
   xtk.hierarchicalTreeView.apply(this, []);
   this._invoked_toggleOpenState = false;
};
TreeView.prototype = new xtk.hierarchicalTreeView();
TreeView.prototype.constructor = TreeView;

TreeView.prototype.updateRows = function updateRows(tableData) {
    var treeRows = [];
    var repl = g_args.repl;
    if (!repl) {
        throw new Error("Refactoring: RenameClassMember: No replacement specified");
    }
    var thisTree = this;
    var anyChildIsChecked = function anyChildIsChecked(hitListLines) {
        for (let lineNo in hitListLines) {
            let hit2 = hitListLines[lineNo];
            if (hit2.hitList.some(function(hit3) hit3[3])) {
                return true;
            }
        }
        return false;
    };
    var populateChildren = function populateChildren(targetA, hitListLines) {
        for (let lineNo in hitListLines) {
            let hit2 = hitListLines[lineNo];
            let context = hit2.context, hitList = hit2.hitList;
            let lineChangeMgr = new LineManager(context, repl, hitList);
            let inLineOccurrence = 0;
            hitList.forEach(function(hit3) {
                let childRow = {
                    isContainer: false,
                    level: 1,
                    lineChangeMgr: lineChangeMgr,
                    inLineOccurrence: inLineOccurrence++,
                    isChecked: hit3[3],
                    lineNo: lineNo
                };
                targetA.push(childRow);
                thisTree._updateText(childRow, childRow.isChecked, -1);
            });
        }
    };
    for (let url in tableData) {
        let hit1 = tableData[url];
        let containerRow = {
            lineNo: "",
            path: hit1.path,
            isChecked: anyChildIsChecked(hit1.hitListLines),
            isContainer: true,
            hasChildren: true,
            state: xtk.hierarchicalTreeView.STATE_CLOSED,
            level: 0,
            children: [],
            getChildren: function() {
                return this.children
            }
        };
        populateChildren(containerRow.children, hit1.hitListLines)
        treeRows.push(containerRow);
    }
    this.rows = treeRows;
};

TreeView.prototype.getCellProperties = function(rowNum, column) {
    var col_id = column.id
    var row = this._rows[rowNum];
    if (col_id == "isChecked") {
        if (row.isChecked) {
            return ["checked"];
        } else {
            return [];
        }
    }
    return xtk.hierarchicalTreeView.prototype.getCellProperties.apply(this, [rowNum, column]);
};

TreeView.prototype.cycleCell = function(rowNum, column) {
};

TreeView.prototype.cycleHeader = function(column) {
    // Don't sort.
};

TreeView.prototype.isEditable = function(rowNum, column) {
    var col_id = column.id
    var row = this._rows[rowNum];
    return col_id == "isChecked";
};

TreeView.prototype.getCellText = function(rowNum, column) {
    //
    // Warning: getCellText(rowNum, {id:"text"}) strips out the
    // leading white-space, as it's intended for display only (and we
    // assume the leading white-space isn't interesting.  For the
    // actual text, call the cell's lineChangeMgr.getText() method.
    var col_id = column.id
    //dump("getCellText: row: " + rowNum + ", col: " + col_id + "\n");
    try {
        var row = this._rows[rowNum];
        switch(col_id) {
            case "isChecked":
            case "lineNo":
                return row[col_id];
            case "text":
                // do this later
                break;
            default:
                return "";
        }
        if (row.isContainer) {
            return row.path;
        } else {
            let { lineChangeMgr: lineChangeMgr, inLineOccurrence: inLineOccurrence,
                    isChecked:checked } = row;
            //lineChangeMgr[checked ? "applyChange" : "undoChange"](inLineOccurrence);
            return lineChangeMgr.getText().replace(/^[ \t]+/, "");
        }
    } catch(ex) {
        log.exception(ex, s);
        return ""
    }
};

TreeView.prototype._updateText = function _updateText(row, isChecked) {
    var { lineChangeMgr: lineChangeMgr, inLineOccurrence: inLineOccurrence } = row;
    lineChangeMgr[isChecked ? "applyChange" : "undoChange"](inLineOccurrence);
}

TreeView.prototype._expand_and_sort_child_rows = function(rowItem, sortPropertyName, sortFunction, sortDir) {
    return rowItem.getChildren();
};

TreeView.prototype.toggleRowChecked = function(rowNum) {
    var row = this._rows[rowNum];
    var currCheck = row.isChecked;
    var newCheck = !currCheck;
    this._rows[rowNum].isChecked = newCheck;
    var parentIndex;
    var container;
    var toggleRow = -1;
    if (row.isContainer) {
        container = row;
        widgets.repls.treeBoxObject.invalidateRow(rowNum);
        row.children.forEach(function(child) {
                child.isChecked = newCheck;
                this._updateText(child, newCheck);
        }.bind(this));
        
        toggleRow = rowNum;
    } else {
        this._updateText(row, newCheck, rowNum);
        // and update the children too, for when we collapse this tree
        parentIndex = this.getParentIndex(rowNum);
        container = this._rows[parentIndex];
        let children = container.children;
        var child = children[rowNum - parentIndex - 1];
        child.isChecked = newCheck;
        if (children.every(function(child) child.isChecked)) {
            container.isChecked = true;
        } else if (children.every(function(child) !child.isChecked)) {
            container.isChecked = false;
        }
        toggleRow = parentIndex;
    }
    if (toggleRow != -1) {
        let boxObject = widgets.repls.treeBoxObject;
        boxObject.invalidateRange(parentIndex, container.children.length);
    }
    updateUI();
};
 
TreeView.prototype.toggleOpenState = function(rowNum) {
    this._invoked_toggleOpenState = true;
    return this._wrapToggleOpenState(rowNum);
};

TreeView.prototype._wrapToggleOpenState = function(rowNum) {
    return xtk.hierarchicalTreeView.prototype.toggleOpenState.apply(this, [rowNum]);
};

TreeView.prototype.getNextSiblingRow = function(idx) {
    let rows = g_displayTree._rows;
    let len = rows.length;
    idx = idx + 1;
    for(;idx < len; idx++)
    {
        if (rows[idx].isContainer)
        {
            return idx;
        }
    }
    return -1;
};

var hitsByURL; /* { url => {
                     path => path,
                     hitListLines => { lineNum => { context: line of text,
                                                    hitList: [startIndex, endIndex,
                                                              columnNo]
                                                    }
                                      }
                         }
                    }
                    */

function ResultsManagerView() {
    this.url_dirty_status = {};
}
ResultsManagerView.prototype = {
    Clear: function() {
    },
    AddFindResult: function() {
    },
    AddReplaceResult: function() {
    },
    AddFindResults: function(type_count, types,
                             url_count, urls,
                             si_count, startIndices,
                             ei_count, endIndices,
                             value_count, values,
                            fn_count, fileNames,
                            ln_count, lineNums,
                            cn_count, columnNums,
                            context_count, contexts) {
        try {
            for (var i = 0; i < startIndices.length; i++) {
                var url = urls[i];
                if (!(url in this.url_dirty_status)) {
                    var views = g_ko.views.manager.topView.
                        getViewsByTypeAndURI(true, "editor", url);
                    if (views && views.length > 0) {
                        this.url_dirty_status[url] = views[0].isDirty;
                    }
                }
                if (this.url_dirty_status[url]) {
                    continue;
                }
                let path = fileNames[i];
                if (!(url in hitsByURL)) {
                    hitsByURL[url] = { path: path, hitListLines: {} };
                }
                let match = (g_defn
                             && g_defn.path.toLowerCase() == path.toLowerCase());
                let hitListLines = hitsByURL[url].hitListLines;
                let lineNum = lineNums[i];
                let context = contexts[i];
                let inDefinitionContext = (match
                                           && lineNum >= scopeStart
                                           && lineNum <= scopeEnd);
                if (!(lineNum in hitListLines)) {
                    hitListLines[lineNum] = { context: context, hitList: [] };
                }
                let accepted =
                    g_refactoringLanguageObj.acceptHit(g_args.pattern,
                                                       context,
                                                       columnNums[i] - 1,
                                                       path,
                                                       lineNum,
                                                       g_defn,
                                                       inDefinitionContext);
                hitListLines[lineNum].hitList.push([startIndices[i] - 1,
                                                    endIndices[i] - 1,
                                                    columnNums[i], accepted]);
            }
        } catch(ex) {
            log.exception(ex, "Error in AddFindResults");
        }
    },
    AddReplaceResults: function() {
    },
    GetType:function() {
        return "type";
    },
    GetUrl:function() {
        return "url";
    },
    GetStartIndex:function() {
        return "StartIndex";
    },
    GetEndIndex:function() {
        return "EndIndex";
    },
    GetValue:function() {
        return "value";
    },
    GetReplacement:function() {
        return "replacement";
    },
    GetLineNum:function() {
        return 0;
    },
    GetColumnNum:function() {
        return 0;
    },
    Sort:function() {
    },
    SetFilterText:function(val) {
    },
    GetNumUrls:function() {
        return 0;
    },
    
    QueryInterface: function(iid) {
        if (!iid.equals(Ci.koIFindResultsView) &&
            !iid.equals(Ci.nsISupports)) {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }
        return this;
    }
};
function ResultsManager() {
    this.view = new ResultsManagerView();
}
ResultsManager.prototype = {
    searchStarted: function() {
    },
    searchFinished: function() {
        try {
            //g_hitsByURL = hitsByURL;
            let url_dirty_status = this.view.url_dirty_status;
            let urls = Object.keys(url_dirty_status);
            let dirty_urls = urls.filter(function(url) url_dirty_status[url]);
            if (dirty_urls.length) {
                alert("Ignoring changes in file"
                      + (dirty_urls.length > 1 ? "s " : " ")
                      + dirty_urls.map(function(url) g_ko.uriparse.URIToLocalPath(url)).join(", "));
            }    
            this.view.url_dirty_status = {};
        } catch(ex) {
            log.exception(ex, "searchFinished #1 failed");
            return;
        }
        // Populate the tree, but not in the calling context from the
        // find-all async thing.
        setTimeout(function() {
                try {
                    doHits(hitsByURL);
                } catch(ex) {
                    log.exception(ex, "searchFinished #2 failed");
                }
            }, 0);
    },
    setDescription: function(desc, important) {
        log.debug(">> ResultsManager.setDescription: important: "
             + important
             + ", desc:["
             + desc
             + "]\n");
    },
    configure: function(pattern, patternAlias, repl, context, options) {
        this._pattern = pattern;
        this._patternAlias = patternAlias;
        this._repl = repl;
        this.context_ = context;
        this._options = options;
    },
    id: 59,
    QueryInterface: function(iid) {
        if (!iid.equals(Ci.koIFindResultsTabManager) &&
            !iid.equals(Ci.nsISupports)) {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }
        return this;
    }
}

function startSearch() {
    hitsByURL = {};
    try {
        var context = Cc["@activestate.com/koFindInFilesContext;1"]
            .createInstance(Ci.koIFindInFilesContext);
        context.type = Ci.koIFindContext.FCT_IN_FILES;
        var startingDir;
        if (g_args.dirs) {
            startingDir = g_args.dirs;
        } else if (g_defn) {
            startingDir = g_ko.uriparse.dirName(g_defn.path);
        } else {
            try {
                startingDir = g_view.koDoc.file.dirName;
            } catch(ex) {
                log.exception(ex, "Failed to get the current dir");
                startingDir = null;
            }
        }
        context.cwd = startingDir;
            
        var find_svc = Components.classes["@activestate.com/koFindService;1"]
                          .getService(Components.interfaces.koIFindService);
        var opts = find_svc.options;
        let savedExcludes = opts.encodedExcludeFiletypes;
        let savedIncludes = opts.encodedIncludeFiletypes;
        opts.encodedIncludeFiletypes = g_args.includes;
        opts.encodedExcludeFiletypes = g_args.excludes;
        opts.multiline = false;
        opts.patternType = Ci.koIFindOptions.FOT_SIMPLE;
        opts.caseSensitivity = g_args.matchCase;
        opts.matchWord = true;
        opts.encodedFolders = startingDir;
        opts.cwd = startingDir;
        opts.searchInSubfolders = g_args.search_in_subdirs;
        opts.encodedIncludeFiletypes = g_args.includes;
        opts.encodedExcludeFiletypes = g_args.excludes;
        opts.showReplaceAllResults = true;
        opts.confirmReplacementsInFiles = true;
        var resultsMgr = new ResultsManager();
        var pattern = g_args.pattern;
        var patternAlias = pattern;
        resultsMgr.configure(pattern, patternAlias, null, context, opts);
        find_svc.findallinfiles(resultsMgr.id, pattern, resultsMgr);
        opts.encodedIncludeFiletypes = savedIncludes;
        opts.encodedExcludeFiletypes = savedExcludes;
    } catch (ex) {
        log.exception(ex, "startSearch/findallinfiles failed; ");
    }
}

function _apply_checked_changes(url, tree, rows, idx) {
    // Make the change to the view in place, if possible
    var koFileEx = null, scimoz = null;
    var xulElementList = g_ko.views.manager.getAllViewsForURI(url);
    if (xulElementList.length) {
        scimoz = xulElementList[0].scimoz;
    }
    var oldTextLines = null;
    if (!scimoz) {
        let koFS = Cc["@activestate.com/koFileService;1"].getService(Ci.koIFileService);
        koFileEx = koFS.getFileFromURI(url);
        koFileEx.open("rb");
        let oldText = koFileEx.readfile();
        koFileEx.close();
        oldTextLines = oldText.split(/(\r?\n|\r)/);
    } else {
        scimoz.beginUndoAction();
    }
    var madeChange = false;
    let children = rows[idx].getChildren();
    let lim = children.length;
    let lastLineNo = 0;
    try {
        // try-finally loop whether we're in a scimoz begin/undo action or not.
        for (idx = 0; idx < lim; ++idx) {
            let child = children[idx];
            if (!child.isChecked) {
                // No need to grab
                continue;
            }
            let thisLineNo = child.lineNo - 1;
            var newText = child.lineChangeMgr.getText();
            madeChange = true;
            if (scimoz) {
                // Make the change in place one line at a time, so border
                // markers aren't lost or moved around.
                scimoz.targetStart = scimoz.positionFromLine(thisLineNo);
                scimoz.targetEnd = scimoz.getLineEndPosition(thisLineNo);
                scimoz.replaceTarget(newText.length, newText);
            } else {
                // Change the text part, leave the newline alone (thisLineNo * 2 + 1)
                oldTextLines[thisLineNo * 2] = newText;
            }
            // Skip further occurrences
            while (idx < lim - 1 && children[idx + 1].inLineOccurrence > 0) {
                idx++;
            }
        }
    } finally {
        if (scimoz) {
            scimoz.endUndoAction();
            return madeChange ? url : null;
        }
    }
    if (madeChange) {
        koFileEx.open("wb");
        koFileEx.puts(oldTextLines.join(""));
        koFileEx.close();
        return url;
    }
    return null;
}

function _diff_checked_changes(url, tree, rows, idx) {
    var koOS = Cc["@activestate.com/koOs;1"].getService(Ci.koIOs);
    var oldText = koOS.readfile(url);
    var oldTextLines = oldText.split(/(\r?\n|\r)/);
    // Allow last line to not end with a newline.
    var newTextLines = [];
    var oldLineIdx = 0;
    var children = rows[idx].getChildren();
    var lim = children.length;
    var lastLineNo = 0;
    for (let i = 0; i < lim; ++i) {
        let child = children[i];
        if (!child.isChecked) {
            // No need to grab
            continue;
        }
        let thisLineNo = child.lineNo - 1;
        if (lastLineNo < thisLineNo) {
            newTextLines.push(oldTextLines.slice(lastLineNo * 2,
                                                 thisLineNo * 2).join(""));
        }
        lastLineNo = thisLineNo + 1;
        newTextLines.push(child.lineChangeMgr.getText());
        // Keep the old newline
        newTextLines.push(oldTextLines[thisLineNo * 2 + 1]);
        // Skip further occurrences
        while (i < lim - 1 && children[i + 1].inLineOccurrence > 0) {
            i++;
        }
    }
    newTextLines.push(oldTextLines.slice(lastLineNo * 2).join(""));
    let koFileService = Cc["@activestate.com/koFileService;1"].
        createInstance(Ci.koIFileService);
    let outputTmpFile = koFileService.makeTempFile(g_ko.uriparse.ext(url), "wb");
    try {
        outputTmpFile.puts(newTextLines.join(""));
    } finally {
        outputTmpFile.close();
    }
    // Verify outputTmpFile.path is deleted
    let newPath = outputTmpFile.path;
    let udiff = Cc["@activestate.com/koDiffService;1"].
                     getService(Ci.koIDiffService).diffFilepaths(url, newPath);
    try {
        koFileService.deleteTempFile(newPath, true);
    } catch(ex) {
        log.exception(ex, "Problem deleting temp file");
    }
    return udiff;
}
    
function walk_loaded_paths(callback, context) {
    var results = [];
    try {
        var tree = g_displayTree;
        var rows = tree._rows;
        var idx = 0, lim = rows.length;
        while (idx < lim) {
            let row = rows[idx];
            if( ! row)
                return;
            let url = row.path;
            let res = callback(url, tree, rows, idx);
            if (res) {
                results.push(res);
            }
            idx = tree.getNextSiblingRow(idx);
        }
    } catch(ex) {
        log.exception(ex, "walk_loaded_paths(" + context + ")");
    }
    return results;
}

function make_changes() {
    var files = walk_loaded_paths(_apply_checked_changes, "in make_marked_changes");
    if (files.length) {
        require("notify/notify").send("Updated " + files.length + " files", "editor");
    }
    window.close();
    return true;
}

function show_marked_changes() {
    var diffs = walk_loaded_paths(_diff_checked_changes,
                                  "in show_marked_changes");
    if (!diffs.length) {
        log.debug("No diffs selected\n");
    } else {
        ko.launch.diff(diffs.join("\n"), "Marked Changes");
    }
}

function updateUI(why) {
    if (typeof(why) == "undefined") why = null;
    if (why == 'g_displayTree' || !why) {
        let tree = g_displayTree;
        let rows = tree._rows;
        let idx = 0, lim = rows.length;
        let disableButton = true;
        while (idx < lim) {
            let row = rows[idx];
            if ( ! row )
                return;
            let children = row.getChildren();
            if (row.isChecked ||
                children.some(function(child) child.isChecked))
            {
                disableButton = false;
                break;
            }
            idx = tree.getNextSiblingRow(idx);
        }
        widgets.showChangesButton.disabled = disableButton;
    }
}
