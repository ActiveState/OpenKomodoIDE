// Run tests on the Python Refactoring Back-end component

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://komodo-jstest/JSTest.jsm");
Cu.import("resource://gre/modules/Services.jsm");

var ko = {};
Cu.import("resource://komodo-jstest/mock/mock.jsm", {})
  .import(ko, "logging", "views", "stringutils");

function TestKoPyRefac() {
    this.log = ko.logging.getLogger("pyRefac.test");
    this.langs = ["Python", "Perl", "Ruby", "PHP", "Tcl", "JavaScript"];
    this.refacSvcByLang = {};
    for each (var lang in this.langs) {
        this.refacSvcByLang[lang] = (Components.classes["@activestate.com/koRefactoringLangSvcFactory;1"].
                               getService(Components.interfaces.koIRefactoringLangSvcFactory).
                                     getRefactoringLangSvcForLanguage(lang));
    }
    this.refacSvc = this.refacSvcByLang["Python"];
    this.lastErrorSvc = (Components.classes["@activestate.com/koLastErrorService;1"]
                       .getService(Components.interfaces.koILastErrorService));
}

TestKoPyRefac.prototype = new TestCase();

TestKoPyRefac.prototype.setUp = function TestKoPyRefac_setUp() {
};

TestKoPyRefac.prototype.tearDown = function TestKoPyRefac_tearDown() {
};

TestKoPyRefac.prototype.msgHandler =
function TestKoPyRefac_msgHandler(level, context, message) {
    this.fail("Message handler called in quiet mode: " +
              "level=" + level + " context=" + context +
              " message=" + message + "\n");
};
TestKoPyRefac.prototype.unmark_text = function unmark_text(markedup_text) {
    // See codeintel/util.py
    // <|> => pos
    // <+> => trg_pos
    // <$> => start_pos
    // <[> => start_selection
    // <]> => end_selection
    // <\d+> => N (the number)
    // <<> => < (the escaping mechanism)
    var text = [];
    var data = {};
    var splitter = /<([\|\+\$\[\]\<]|\d+)>/;
    var tokens = markedup_text.split(splitter);
    var i = 0;
    var lim = tokens.length;
    var textPos = 0;
    var posNameFromSymbol = {
        "|": "pos",
        "+": "trg_pos",
        "$": "start_pos",
        "[": "start_selection",
        "]": "end_selection"
    };
    var s;
    //dump("tokens: " + tokens + ', lim: ' + lim + '\n');
    while (i < lim) {
        //dump("process token "
        //     + i
        //     + ": <"
        //     + tokens[i]
        //     + ">,<"
        //     + tokens[i + 1]
        //     + ">\n"
        //     )
        s = tokens[i++];
        text.push(s);
        textPos += s.length;
        if (i == lim) {
            break;
        }
        s = tokens[i++];
        if (s in posNameFromSymbol) {
            data[posNameFromSymbol[s]] = textPos;
        } else if (s == "<") {
            text.push("<");
            textPos += 1;
        } else if (/\d+/.test(s)) {
            data[s] = textPos
        } else {
            throw new Error("Unexpected directive: <" + s + ">");
        }
    }
    return [text.join(""), data];
};

TestKoPyRefac.prototype.test_pyrefacBasic = function test_pyrefacBasic() {
    var expVals = {"Python": [["foo", "", "\\bfoo\\b"],
                              ["foo", "[", "\\bfoo\\b"],
                              ["foo", "{", "\\bfoo\\b"]],
                   "Perl": [["$foo", "", "\\$foo\\b", '\\$foo'],
                            ["$foo", "[", "(?:(?<=\\$)foo(?=\\[))|(?<=@)foo\\b",
                            'foo'],
                            ["$foo", "{", "(?:(?<=\\$)foo(?=\\{))|(?<=%)foo\\b",
                            'foo'],
                            ["*foo", "", "(?<=[\\$@%\\*])foo\\b", 'foo'],
                            ["&foo", "", "(?:\b|(?<=\\&))foo\\b", 'foo']],
                   "Ruby": [["foo", "", "\\bfoo\\b"],
                            ["foo", "[", "\\bfoo\\b"],
                            ["@foo", "", "(?:^|(?=<[^\\w]))@foo\\b"],
                            ["@foo", "[", "(?:^|(?=<[^\\w]))@foo\\b"],
                            ["@@foo", "", "(?:^|(?=<[^\\w]))@@foo\\b"],
                            ["@@foo", "[", "(?:^|(?=<[^\\w]))@@foo\\b"],
                            ["$foo", "", "(?:^|(?=<[^\\w]))\\$foo\\b"],
                            ["$foo", "[", "(?:^|(?=<[^\\w]))\\$foo\\b"]],
                   "PHP": [["$foo", "", "(?:^|\\$|(?=<\\W))foo\\b", '\\$?foo'],
                            ["$foo", "[", "(?:^|\\$|(?=<\\W))foo\\b", '\\$?foo'],
                            ["$foo", "{", "(?:^|\\$|(?=<\\W))foo\\b", '\\$?foo'],
                            ["foo", "", "(?:^|\\$|(?=<\\W))foo\\b", '\\$?foo'],
                            ["foo", "[", "(?:^|\\$|(?=<\\W))foo\\b", '\\$?foo'],
                            ["foo", "{", "(?:^|\\$|(?=<\\W))foo\\b", '\\$?foo']],
                   "JavaScript": [["foo", "", "(?:^|(?<=[^\\w\\$]))foo(?=$|[^\\w\\$])"],
                                 ["foo", "[", "(?:^|(?<=[^\\w\\$]))foo(?=$|[^\\w\\$])"],
                                 ["foo", "{", "(?:^|(?<=[^\\w\\$]))foo(?=$|[^\\w\\$])"],
                                 ["$foo", "", "(?:^|(?<=[^\\w\\$]))\\$foo(?=$|[^\\w\\$])", '\\$foo'],
                                 ["foo$xyz", "", "(?:^|(?<=[^\\w\\$]))foo\\$xyz(?=$|[^\\w\\$])", 'foo\\$xyz']],
                   "Tcl": [["foo", "",  "(?:\\$|\\b)foo\\b", "foo"],
                           ["$foo", "", "(?:\\$|\\b)foo\\b", "foo"]
                          ]
                  }
    var items, i, lim, varName, nextChar, searchTextExp, compareTextExp;
    var o1 = {}, o2 = {};
    for (var lang in expVals) {
        items = expVals[lang];
        lim = items.length;
        for (i = 0; i < lim; ++i) {
            [varName, nextChar, searchTextExp, compareTextExp] = items[i];
            if (!compareTextExp) {
                compareTextExp = varName;
            }
            this.refacSvcByLang[lang].getSearchTermForVariable(varName, nextChar,
                                                         o1, o2);
            this.assertEquals(o1.value, searchTextExp,
                              ("test_pyrefacSearchTerms: language: "
                               + lang
                               + ", varName: "
                               + varName
                               + ", nextChar: "
                               + nextChar
                               + ".  Expected searchTextExp <<"
                               + searchTextExp
                               + ">>, got <<"
                               + o1.value
                               + ">>\n"));
            this.assertEquals(o2.value, compareTextExp,
                              ("test_pyrefacSearchTerms: language: "
                               + lang
                               + ", varName: "
                               + varName
                               + ", nextChar: "
                               + nextChar
                               + ".  Expected compareTextExp <<"
                               + compareTextExp
                               + ">>, got <<"
                               + o2.value
                               + ">>\n"));
        }
    }
};

TestKoPyRefac.prototype.test_unsupportedLanguage = function test_unsupportedLanguage() {
    var langs = ["Baan", "Schoogle 3"];
    langs.forEach(function(lang) {
        var x = (Components.classes["@activestate.com/koRefactoringLangSvcFactory;1"].
                 getService(Components.interfaces.koIRefactoringLangSvcFactory).
                 getRefactoringLangSvcForLanguage(lang));
        this.assertEquals(x.supportsRefactoring, false,
                          lang + " shouldn't support refactoring");
    }.bind(this));
};

TestKoPyRefac.prototype._get_scimoz_and_koDoc_from_string = function(buf) {
    var view = new ko.views.ViewMock({text:buf})
    var scimoz = view.scimoz;
    if ('@activestate.com/ISciMozHeadless;1' in Cc) {
        // Set up the real Python lexer (for styling information)
        var lexerSvc = Cc["@activestate.com/koLanguageRegistryService;1"]
                         .getService(Ci.koILanguageRegistryService)
                         .getLanguage("Python")
                         .getLanguageService(Ci.koILexerLanguageService);
        lexerSvc.setCurrent(scimoz);
    }
    return [scimoz, view.koDoc, view];
};
TestKoPyRefac.prototype.test_checkStructurePython_TextOnLeft =
function test_checkStructurePython_textOnLeft() {
    var code1 = [ 'if 1:'
                 ,'    print "Sele<[>cted partial line on left"'
                 ,'    print "This line selected correctly."    <]> '
                ];
    var styles1 = [
        // i   f       1   :  \n
           5,  5,  0,  2, 10,  0,
        //                 p   r   i   n   t       "   S   e   l   e   c   t
        // e   d       p   a   r   t   i   a   l       l   i   n   e       o
        // n       l   e   f   t   "  \n
           0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  0,
        //                 p   r   i   n   t       "   T   h   i   s       l
        // i   n   e       s   e   l   e   c   t   e   d       c   o   r   r
        // e   c   t   l   y   .   "                    (EOF)
           0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  0,  0,  0,  0,  0];
    var code1_lf = code1.join("\n");
    var text, data, scimoz, koDoc;
    [text, data] = this.unmark_text(code1_lf);
    this.assertTrue(data.start_selection);
    this.assertTrue(data.end_selection);
    [scimoz, koDoc] = this._get_scimoz_and_koDoc_from_string(text);
    if ('@activestate.com/ISciMozHeadless;1' in Cc) {
        scimoz.colourise(0, scimoz.length);
    } else {
        scimoz.startStyling(0, ~0);
        scimoz.setStylingEx(styles1.length,
                            styles1.map(c => String.fromCharCode(c)).join(""));
    }
    this.assertEquals(scimoz.getStyleRange(0, scimoz.length), styles1);
    var s2 = scimoz.getStyledText(0, scimoz.length, {});
    this.assertEquals(s2[0], code1_lf.charCodeAt(0));
    this.assertEquals(s2[1], styles1[0]);
    this.assertRaises(Components.Exception,
                      function() {
                        this.refacSvc.categorizeVariables(scimoz, koDoc,
                                                                 data.start_selection,
                                                                 data.end_selection,
                                                                 {});
                      }, [],
                      "No error in code1");
    this.assertEquals(this.lastErrorSvc.getLastErrorMessage(), "significant text to left of selection");
    // Verify right selection
    data.start_selection -= 11;
    data.end_selection -= 6;
    this.assertRaises(Components.Exception,
                      function() {
                        this.refacSvc.categorizeVariables(scimoz, koDoc,
                                                                 data.start_selection,
                                                                 data.end_selection,
                                                                 {});
                      }, [],
                      "No error in code1");
    this.assertEquals(this.lastErrorSvc.getLastErrorMessage(), "significant text to right of selection");
};

TestKoPyRefac.prototype.posFromLineColumn = function posFromLineColumn(scimoz, pt)
    scimoz.positionFromLine(pt[0]) + pt[1];

TestKoPyRefac.prototype.test_adjustPositions = function test_adjustPositions() {
    var text, scimoz, koDoc;
    var code = [ 'def foo(a, b):'
                 ,'    if a:  '
                 ,'        print "Selected partial line on left"'
                 ,'        print "This line selected correctly."     '
                 ,'    return a + b'
                 ,'print(foo(3, 4))'
                ];
    var text = code.join("\n");
    [scimoz, koDoc] = this._get_scimoz_and_koDoc_from_string(text);
    var start_pts = [[[0,  0]],
                     [[0, 14], [1,0]],
                     [[1,  0]],
                     [[1,  3], [1, 0]],
                     [[1,  4], [1, 0]],
                     [[1,  5], [1, 5]],
                     [[1,  8], [1, 8]],
                     [[1,  9], [2, 0]],
                     [[4,  16], [5, 0]],
                     [[5, 16]]
                    ];
    var end_pts = [[[3, 0], [2, 45]],
                   [[3, 7], [2, 45]],
                   [[3, 8], [2, 45]],
                   [[3, 9]],
                   [[3, 45], [3, 50]],
                   [[3, 50]]
                  ];
    // This one shouldn't be language-dependent -- just figure out
    // what the selection should really be.
    this.assertEquals(scimoz.lineCount, code.length, "Unexpected line count");
    start_pts.forEach(function(ptPair) {
        let prevPos = this.posFromLineColumn(scimoz, ptPair[0]);
        let postPos = (ptPair.length == 1 ? prevPos
                       : this.posFromLineColumn(scimoz, ptPair[1]));
        let adjustedPos = this.refacSvc.adjustStartPosition(scimoz, prevPos);
        this.assertEquals(adjustedPos, postPos,
                          ("Expected pt " + ptPair[0]
                           + " => "
                           + (ptPair.length == 1 ? ptPair[0] : ptPair[1])));
    }.bind(this));
    end_pts.forEach(function(ptPair) {
        let prevPos = this.posFromLineColumn(scimoz, ptPair[0]);
        let postPos = (ptPair.length == 1 ? prevPos
                       : this.posFromLineColumn(scimoz, ptPair[1]));
        let adjustedPos = this.refacSvc.adjustEndPosition(scimoz, prevPos);
        this.assertEquals(adjustedPos, postPos,
                          ("Expected pt " + ptPair[0]
                           + " => "
                           + (ptPair.length == 1 ? ptPair[0] : ptPair[1])));
    }.bind(this));
};                     

TestKoPyRefac.prototype.test_checkStructurePython_Children =
function test_checkStructurePython_Children() {
    var text, data, scimoz, koDoc;
    var code2 = [ 'def foo(a, b):'
                 ,'    if a:'
                 ,'        <[>print "Selected partial line on left"'
                 ,'        print "This line selected correctly."     '
                 ,'    return a + b<]>'
                 ,'print(foo(3, 4))'
                ];
    var styles2 = [ 5, 5, 5, 0, 9, 9, 9, 10, 11, 10, 0, 11, 10, 10, 0,
                    0, 0, 0, 0, 5, 5, 0, 11, 10, 0,
                    0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 0, 3, 3, 3, 3, 3, 3, 3,
                    3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
                    3, 3, 3, 0,
                    0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 0, 3, 3, 3, 3, 3, 3, 3,
                    3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
                    3, 3, 3, 0, 0, 0, 0, 0, 0,
                    0, 0, 0, 0, 5, 5, 5, 5, 5, 5, 0, 11, 0, 10, 0, 11, 0,
                    5, 5, 5, 5, 5, 10, 11, 11, 11, 10, 2, 10, 0, 2, 10, 10];
    var code2_lf = code2.join("\n");
    [text, data] = this.unmark_text(code2_lf);
    this.assertTrue(data.start_selection);
    this.assertTrue(data.end_selection);
    [scimoz, koDoc] = this._get_scimoz_and_koDoc_from_string(text);
    const foldLevels = [ 0x2400,  0x2404,  0x408,  0x408,  0x404,  0x400 ];
    if ('@activestate.com/ISciMozHeadless;1' in Cc) {
        scimoz.colourise(0, scimoz.length);
        for (let i in foldLevels) {
            scimoz.setFoldLevel(i, foldLevels[i]);
        }
    } else {
        scimoz.startStyling(0, ~0);
        scimoz.setStylingEx(styles2.length,
                            styles2.map(c => String.fromCharCode(c)).join(""));
        scimoz.setFoldLevels([ 0x2400,  0x2404,  0x408,  0x408,  0x404,  0x400 ]);
    }
    this.assertEquals(scimoz.getStyleRange(0, scimoz.length), styles2);
    this.assertEquals([scimoz.getFoldLevel(i) for (i in foldLevels)],
                      foldLevels);
    var startPos = this.refacSvc.adjustStartPosition(scimoz, data.start_selection);
    this.assertEquals(startPos, data.start_selection - 8);
    var endPos = this.refacSvc.adjustEndPosition(scimoz, data.end_selection);
    this.assertEquals(endPos, data.end_selection);
    this.assertRaises(Components.Exception,
                      function() {
                        this.refacSvc.categorizeVariables(scimoz, koDoc,
                                                          startPos, endPos,
                                                          {});
                      }, [],
                      "No error in code1");
    this.assertEquals(this.lastErrorSvc.getLastErrorMessage(), "Block starts with a child of a later parent line");
    
    
    var code3 = [ 'def foo(a, b):'
                 ,'    <[>if a:'
                 ,'        print "First line of child"'
                 ,'        print "Select second line of child."  <]>   '
                 ,'        print "This line is orphaned."     '
                 ,'    return a + b'
                 ,'print(foo(3, 4))'
                ];
    var styles3 = [
        // d   e   f       f   o   o   (   a   ,       b   )   :  \n
           5,  5,  5,  0,  9,  9,  9, 10, 11, 10,  0, 11, 10, 10,  0,
        //                 i   f       a   :  \n
           0,  0,  0,  0,  5,  5,  0, 11, 10, 0,
        //                                 p   r   i   n   t       "   F   i   r
        // s   t       l   i   n   e       o   f       c   h   i   l   d   "  \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  0,
        //                                 p   r   i   n   t       "   S   e   l
        // e   c   t       s   e   c   o   n   d       l   i   n   e       o
        // f       c   h   i   l   d   .   "                       \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  0,  0,  0,  0,  0,  0,
        //                                 p   r   i   n   t       "   T   h   i
        // s       l   i   n   e       i   s       o   r   p   h   a   n   e   d
        // .   "                      \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  0,  0,  0,  0,  0,  0,
        //                 r   e   t   u   r   n       a       +       b  \n
           0,  0,  0,  0,  5,  5,  5,  5,  5,  5,  0, 11,  0, 10,  0, 11,  0,
        // p   r   i   n   t   (   f   o   o   (   3   ,       4   )   )
           5,  5,  5,  5,  5, 10, 11, 11, 11, 10,  2, 10,  0,  2, 10, 10];
    const foldLevels3 = [ 0x2400,  0x2404,  0x408,  0x408,  0x408,  0x404,  0x400 ];
    var code4_lf = code3.join("\n");
    [text, data] = this.unmark_text(code4_lf);
    this.assertTrue(data.start_selection);
    this.assertTrue(data.end_selection);
    [scimoz, koDoc] = this._get_scimoz_and_koDoc_from_string(text);
    if ('@activestate.com/ISciMozHeadless;1' in Cc) {
        scimoz.colourise(0, scimoz.length);
        for (let i in foldLevels3) {
            scimoz.setFoldLevel(i, foldLevels3[i]);
        }
    } else {
        scimoz.startStyling(0, ~0);
        scimoz.setStylingEx(styles3.length,
                            styles3.map(c => String.fromCharCode(c)).join(""));
        scimoz.setFoldLevels(foldLevels3);
    }
    this.assertEquals(scimoz.getStyleRange(0, scimoz.length), styles3);
    this.assertEquals([scimoz.getFoldLevel(i) for (i in foldLevels3)],
                      foldLevels3);
    this.assertRaises(Components.Exception,
                      function() {
                        this.refacSvc.categorizeVariables(scimoz, koDoc,
                                                                 data.start_selection,
                                                                 data.end_selection,
                                                                 {});
                      }, [],
                      "No error in code1");
    this.assertEquals(this.lastErrorSvc.getLastErrorMessage(), "Block does not contain all children of line 2")
    
    var code4 = [ 'def foo(a, b):'
                 ,'    <[>if a:'
                 ,'        print "First line of child"'
                 ,'        if b:'
                 ,'            print "Select second line of child."  <]>   '
                 ,'            print "This line is orphaned."     '
                 ,'    return a + b'
                 ,'print(foo(3, 4))'
                ];
    var styles4 = [
        // d   e   f       f   o   o   (   a   ,       b   )   :  \n
           5,  5,  5,  0,  9,  9,  9, 10, 11, 10,  0, 11, 10, 10,  0,
        //                 i   f       a   :  \n
           0,  0,  0,  0,  5,  5,  0, 11, 10,  0,
        //                                 p   r   i   n   t       "   F   i
        // r   s   t       l   i   n   e       o   f       c   h   i   l   d   "  \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  0,
        //                                 i   f       b   :  \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  0, 11, 10,  0,
        //                                                 p   r   i   n   t       "
        // S   e   l   e   c   t       s   e   c   o   n   d       l   i   n
        // e       o   f       c   h   i   l   d   .   "                      \n
           0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  0,  0,  0,  0,  0,  0,
        //                                                 p   r   i   n   t       "
        // T   h   i   s       l   i   n   e       i   s       o   r   p   h   a
        // n   e   d   .   "                      \n
           0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  0,  0,  0,  0,  0,  0,
        //                 r   e   t   u   r   n       a       +       b  \n
           0,  0,  0,  0,  5,  5,  5,  5,  5,  5,  0, 11,  0, 10,  0, 11,  0,
        // p   r   i   n   t   (   f   o   o   (   3   ,       4   )   )
           5,  5,  5,  5,  5, 10, 11, 11, 11, 10,  2, 10,  0,  2, 10, 10];
    const foldLevels4 = [ 0x2400,  0x2404,  0x408,  0x408,  0x2408,  0x40c,  0x40c,  0x404,  0x400 ];
    var code4_lf = code4.join("\n");
    [text, data] = this.unmark_text(code4_lf);
    this.assertTrue(data.start_selection);
    this.assertTrue(data.end_selection);
    [scimoz, koDoc] = this._get_scimoz_and_koDoc_from_string(text);
    if ('@activestate.com/ISciMozHeadless;1' in Cc) {
        scimoz.colourise(0, scimoz.length);
        for (let i in foldLevels4) {
            scimoz.setFoldLevel(i, foldLevels4[i]);
        }
    } else {
        scimoz.startStyling(0, ~0);
        scimoz.setStylingEx(styles4.length,
                            styles4.map(c => String.fromCharCode(c)).join(""));
        scimoz.setFoldLevels(foldLevels4);
    }
    this.assertEquals(scimoz.getStyleRange(0, scimoz.length), styles4);
    this.assertEquals([scimoz.getFoldLevel(i) for (i in foldLevels4)],
                      foldLevels4);
    var s2 = scimoz.getStyledText(0, scimoz.length, {});
    this.assertEquals(s2[0], code4_lf.charCodeAt(0));
    this.assertEquals(s2[1], styles4[0]);
    this.assertRaises(Components.Exception,
                      function() {
                        this.refacSvc.categorizeVariables(scimoz, koDoc,
                                                                 data.start_selection,
                                                                 data.end_selection,
                                                                 {});
                      }, [],
                      "No error in code1");
    this.assertEquals(this.lastErrorSvc.getLastErrorMessage(), "Block does not contain all children of line 2")
}

TestKoPyRefac.prototype.test_checkStructurePython_SplitBlocks =
function test_checkStructurePython_SplitBlocks() {
    var text, data, scimoz, koDoc;
    var code1 = [ 'def foo(a, b):'
                 ,'    <[>if a:'
                 ,'        print "Selected partial line on left"'
                 ,'        print "This line selected correctly."<]>     '
                 ,'    else:'
                 ,'        print "This else block is orphaned."    '
                 ,'        return a + b'
                 ,'print(foo(3, 4))'
                ];
    var styles1 = [
        // d   e   f       f   o   o   (   a   ,       b   )   :  \n
           5,  5,  5,  0,  9,  9,  9, 10, 11, 10,  0, 11, 10, 10,  0,
        //                 i   f       a   :  \n
           0,  0,  0,  0,  5,  5,  0, 11, 10,  0,
        //                                 p   r   i   n   t       "   S   e
        // l   e   c   t   e   d       p   a   r   t   i   a   l       l   i
        // n   e       o   n       l   e   f   t   "  \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  0,
        //                                 p   r   i   n   t       "   T   h
        // i   s       l   i   n   e       s   e   l   e   c   t   e   d       c
        // o   r   r   e   c   t   l   y   .   "                      \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  0,  0,  0,  0,  0,  0,
        //                 e   l   s   e   :  \n
           0,  0,  0,  0,  5,  5,  5,  5, 10,  0,
        //                                 p   r   i   n   t       "   T   h
        // i   s       e   l   s   e       b   l   o   c   k       i   s       o
        // r   p   h   a   n   e   d   .   "                  \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  0,  0,  0,  0,  0,
        //                                 r   e   t   u   r   n       a       +       b  \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  5,  0, 11,  0, 10,  0, 11,  0,
        // p   r   i   n   t   (   f   o   o   (   3   ,       4   )   )
           5,  5,  5,  5,  5, 10, 11, 11, 11, 10,  2, 10,  0,  2, 10, 10];

    const foldLevels = [ 0x2400,  0x2404,  0x408,  0x408,  0x2404,  0x408,  0x408,  0x400];
    var code1_lf = code1.join("\n");
    [text, data] = this.unmark_text(code1_lf);
    this.assertTrue(data.start_selection);
    this.assertTrue(data.end_selection);
    [scimoz, koDoc] = this._get_scimoz_and_koDoc_from_string(text);
    if ('@activestate.com/ISciMozHeadless;1' in Cc) {
        scimoz.colourise(0, scimoz.length);
        for (let i in foldLevels) {
            scimoz.setFoldLevel(i, foldLevels[i]);
        }
    } else {
        scimoz.startStyling(0, ~0);
        scimoz.setStylingEx(styles1.length,
                            styles1.map(c => String.fromCharCode(c)).join(""));
        scimoz.setFoldLevels(foldLevels);
    }
    this.assertEquals(scimoz.getStyleRange(0, scimoz.length), styles1);
    this.assertEquals([scimoz.getFoldLevel(i) for (i in foldLevels)],
                      foldLevels);
    this.assertRaises(Components.Exception,
                      function() {
                        this.refacSvc.categorizeVariables(scimoz, koDoc,
                                                                 data.start_selection,
                                                                 data.end_selection,
                                                                 {});
                      }, [],
                      "No error in code1");
    this.assertEquals(this.lastErrorSvc.getLastErrorMessage(), "if-block continued with else after the selection");
}

TestKoPyRefac.prototype.test_checkStructurePython_SplitBlocks2 =
function test_checkStructurePython_SplitBlocks2() {
    var text, data, scimoz, koDoc;
    code1 = [ 'def foo(a, b):'
             ,'    if a:'
             ,'        print "Selected partial line on left"'
             ,'        print "blah blah boo."'
             ,'    elif b:'
             ,'        print "This line is ok"'
             ,'        print "Start of selection in middle of block"'
             ,'    <[>else:'
             ,'        print "This else block is orphaned."'
             ,'        print "One more line to select."<]> '
             ,'        return a + b'
             ,'print(foo(3, 4))'
            ];
    styles1 = [
        // d   e   f       f   o   o   (   a   ,       b   )   :  \n
           5,  5,  5,  0,  9,  9,  9, 10, 11, 10,  0, 11, 10, 10,  0,
        //                 i   f       a   :  \n
           0,  0,  0,  0,  5,  5,  0, 11, 10,  0,
        //                                 p   r   i   n   t       "   S   e
        // l   e   c   t   e   d       p   a   r   t   i   a   l       l   i
        // n   e       o   n       l   e   f   t   "  \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  0,
        //                                 p   r   i   n   t       "   b   l
        // a   h       b   l   a   h       b   o   o   .   "  \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  0,
        //                 e   l   i   f       b   :  \n
           0,  0,  0,  0,  5,  5,  5,  5,  0, 11, 10,  0,
        //                                 p   r   i   n   t       "   T   h
        // i   s       l   i   n   e       i   s       o   k   "  \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  0,
        //                                 p   r   i   n   t       "   S   t   a
        // r   t       o   f       s   e   l   e   c   t   i   o   n       i
        // n       m   i   d   d   l   e       o   f       b   l   o   c   k   "  \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  0,
        //                 e   l   s   e   :  \n
           0,  0,  0,  0,  5,  5,  5,  5, 10,  0,
        //                                 p   r   i   n   t       "   T   h
        // i   s       e   l   s   e       b   l   o   c   k       i   s       o
        // r   p   h   a   n   e   d   .   "  \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  0,
        //                                 p   r   i   n   t       "   O   n
        // e       m   o   r   e       l   i   n   e       t   o       s   e
        // l   e   c   t   .   "      \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  0,  0,
        //                                 r   e   t   u   r
        // n       a       +       b  \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,
           5,  0, 11,  0, 10,  0, 11,  0,
        // p   r   i   n   t   (   f   o   o   (   3   ,       4   )   )
           5,  5,  5,  5,  5, 10, 11, 11, 11, 10,  2, 10,  0,  2, 10, 10];

    const foldLevels = [0x2400, 0x2404, 0x408, 0x408, 0x2404, 0x408,
                        0x408, 0x2404, 0x408, 0x408, 0x408, 0x400]
    code1_lf = code1.join("\n");
    [text, data] = this.unmark_text(code1_lf);
    this.assertTrue(data.start_selection);
    this.assertTrue(data.end_selection);
    [scimoz, koDoc] = this._get_scimoz_and_koDoc_from_string(text);
    if ('@activestate.com/ISciMozHeadless;1' in Cc) {
        scimoz.colourise(0, scimoz.length);
        for (let i in foldLevels) {
            scimoz.setFoldLevel(i, foldLevels[i]);
        }
    } else {
        scimoz.startStyling(0, ~0);
        scimoz.setStylingEx(styles1.length,
                            styles1.map(c => String.fromCharCode(c)).join(""));
        scimoz.setFoldLevels(foldLevels);
    }
    this.assertEquals(scimoz.getStyleRange(0, scimoz.length), styles1);
    this.assertEquals([scimoz.getFoldLevel(i) for (i in foldLevels)],
                      foldLevels);
    this.assertRaises(Components.Exception,
                      function() {
                        this.refacSvc.categorizeVariables(scimoz, koDoc,
                                                                 data.start_selection,
                                                                 data.end_selection,
                                                                 {});
                      }, [],
                      "No error in code1");
    this.assertEquals(this.lastErrorSvc.getLastErrorMessage(), "Block does not contain all children of line 8");

};

TestKoPyRefac.prototype.test_checkStructurePython_BadBreak =
function test_checkStructurePython_BadBreak() {
    var text, data, scimoz, koDoc;
    code1 = [ 'def foo(a, b):'
             ,'    while a:'
             ,'        <[>print "Start here in while-block"'
             ,'        b -= 1'
             ,'        if b <= 0:'
             ,'            break'
             ,'        print "Select last line of block, but not the while"<]>'
             ,'    return a + b'
             ,'print(foo(3, 4))'
            ];
    styles1 = [
        // d   e   f       f   o   o   (   a   ,       b   )   :  \n
           5,  5,  5,  0,  9,  9,  9, 10, 11, 10,  0, 11, 10, 10,  0,
        //                 w   h   i   l   e       a   :  \n
           0,  0,  0,  0,  5,  5,  5,  5,  5,  0, 11, 10,  0,
        //                                 p   r   i   n   t       "   S   t
        // a   r   t       h   e   r   e       i   n       w   h   i   l   e
        // -   b   l   o   c   k   "  \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  0,
        //                                 b       -   =       1  \n
           0,  0,  0,  0,  0,  0,  0,  0, 11,  0, 10, 10,  0,  2,  0,
        //                                 i   f       b       <   =       0   :  \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  0, 11,  0, 10, 10,  0,  2, 10,  0,
        //                                                 b   r   e   a   k  \n
           0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,
        //                                 p   r   i   n   t       "   S   e
        // l   e   c   t       l   a   s   t       l   i   n   e       o
        // f       b   l   o   c   k   ,       b   u   t       n   o   t       t
        // h   e       w   h   i   l   e   "  \n
           0,  0,  0,  0,  0,  0,  0,  0,  5,  5,  5,  5,  5,  0,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,
           3,  3,  3,  3,  3,  3,  3,  3,  3,  0,
        //                 r   e   t   u   r   n       a       +       b  \n
           0,  0,  0,  0,  5,  5,  5,  5,  5,  5,  0, 11,  0, 10,  0, 11,  0,
        // p   r   i   n   t   (   f   o   o   (   3   ,       4   )   )  \n
           5,  5,  5,  5,  5, 10, 11, 11, 11, 10,  2, 10,  0,  2, 10, 10];
    const foldLevels = [0x2400, 0x2404, 0x408, 0x408, 0x2408, 0x40c, 0x408, 0x404, 0x400];
    code1_lf = code1.join("\n");
    [text, data] = this.unmark_text(code1_lf);
    this.assertTrue(data.start_selection);
    this.assertTrue(data.end_selection);
    [scimoz, koDoc] = this._get_scimoz_and_koDoc_from_string(text);
    if ('@activestate.com/ISciMozHeadless;1' in Cc) {
        scimoz.colourise(0, scimoz.length);
        for (let i in foldLevels) {
            scimoz.setFoldLevel(i, foldLevels[i]);
        }
    } else {
        scimoz.startStyling(0, ~0);
        scimoz.setStylingEx(styles1.length,
                            styles1.map(c => String.fromCharCode(c)).join(""));
        scimoz.setFoldLevels(foldLevels);
    }
    this.assertEquals(scimoz.getStyleRange(0, scimoz.length), styles1);
    this.assertEquals([scimoz.getFoldLevel(i) for (i in foldLevels)],
                      foldLevels);
    this.assertRaises(Components.Exception,
                      function() {
                        this.refacSvc.categorizeVariables(scimoz, koDoc,
                                                                 data.start_selection,
                                                                 data.end_selection,
                                                                 {});
                      }, [],
                      "No error in code1");
    this.assertEquals(this.lastErrorSvc.getLastErrorMessage(),
                      "Found a break not contained in a while");

};

TestKoPyRefac.prototype.runAcceptHits = function runAcceptHits(refacSvc, argLists, fixArgs) {
    var argNum, argList;
    for (argNum = 0; argList = argLists[argNum]; ++argNum) {
        if (argList.length < 4) {
            continue;
        }
        var expectedResult = argList.shift();
        this.assertEquals(expectedResult,
                          refacSvc.acceptHit.apply(refacSvc, fixArgs(argList)),
                          "Failed to hit arglist #" + argNum + " [" + argList + "]");
        argNum += 1;
    };
};

function basicFixArgs(args) {
    return [args[0], args[1] + args[2], args[1].length].concat(["<no path>", -1, null, args[3]]);
};

TestKoPyRefac.prototype.test_acceptPerlHits =
function test_acceptPerlHits() {
    var fixArgs = function fixArgs(args) {
        return [args[0], args[1] + args[2], args[1].length].concat(["<no path>", -1, null, false]);
    }
    var argLists = [
        // result, targetName, beforeText, afterText, 
        // path, lineNo, defn, inDefnContext,
        [ true, 'Foo', 'my $a = Bar::', 'Foo;'],
        [ false, 'Foo', 'my $a = Bar::', 'Food;'],
        [ true, 'Foo', 'my $a = Bar::', 'Foo->a(1);'],
        [ true, 'foo', 'my $a = $obj->{', 'foo};'],
        [ true, 'foo', 'my $a = $obj->{"', 'foo"};'],
        [ true, 'foo', 'my $a = $obj->{\'', 'foo\'};'],
        [ false, 'foo', 'my $a = $obj->{', 'food};'],
        [ false, 'foo', 'my $a = $obj->{"', 'food"};'],
        [ false, 'foo', 'my $a = $obj->{\'', 'food\'};'],
        [ true, 'foo', 'sub ', 'foo};'],
        [ true, 'foo', 'use ', 'foo};'],
        [ true, 'foo', 'package ', 'foo};'],
        [ false, 'foo', 'sub ', 'food};'],
        [ false, 'foo', 'use ', 'food};'],
        [ false, 'foo', 'package ', 'food};'],
        [ true, 'Foo', '@ISA = ', 'Foo;'],
        [ true, 'Foo', '@ISA =', 'Foo;'],
        [ true, 'Foo', '@ISA=', 'Foo;'],
        [ false, 'Foo', '@ISA = ', 'Food;'],
        [ false, 'Food', '@ISA = ', 'Foo;'],
        [ true, 'Féoo', 'my $a = Bar::', 'Féoo;'],
        [ false, 'Féoo', 'my $a = Bar::', 'Féood;'],
        [ true, 'Féooท', 'my $a = Bar::', 'Féooท;'],
        [ false, 'Féooท', 'my $a = Bar::', 'Féooทd;'],
        [ true, 'Féooé', 'my $a = Bar::', 'Féooé;'],
        []
    ];
    this.runAcceptHits(this.refacSvcByLang["Perl"], argLists, fixArgs);
};

TestKoPyRefac.prototype.test_acceptJavaScriptHits =
function test_acceptJavaScriptHits() {
    var argLists = [
        // result, targetName, beforeText, afterText, 
        // path, lineNo, defn, inDefnContext,
        [ true, 'bar', 'var a = foo.', 'bar', false],
        [ false, 'bar', 'var a = foo + ', 'bar', false],
        [ false, 'bar', 'var a = foo.', 'bard', false],
        [ false, 'bar', 'var a = foo. ', 'bar', false],
        [ true, 'bar', '', 'bar: function ', true],
        [ false, 'bar', '', 'barf: function ', true],
        [ true, '$bar', 'var a = foo.', '$bar', false],
        [ true, 'bar$', 'var a = foo.', 'bar$', false],
        [ true, 'ba$r', 'var a = foo.', 'ba$r', false],
        [ true, '§ЌϋЊЋ', 'var a = foo.', '§ЌϋЊЋ', false],
        []
    ];
    this.runAcceptHits(this.refacSvcByLang["JavaScript"], argLists, basicFixArgs);
};

TestKoPyRefac.prototype.test_acceptPHP_Hits =
function test_acceptPHP_Hits() {
    var argLists = [
        // result, targetName, beforeText, afterText, 
        // path, lineNo, defn, inDefnContext,
        [ true, 'bar', '$a = $this->', 'bar', false],
        [ false, 'bar', '$a = $this->', 'bard', false],
        [ true, 'bar', 'echo("this is bar: $', 'bar, ok?\n");', false],
        [ false, 'bar', 'echo("this is bar: $', 'barf, ok?\n");', false],
        [ true, 'bar', 'function ', 'bar', true],
        [ false, 'bar', 'function ', 'barf', true],
        []
    ];
    this.runAcceptHits(this.refacSvcByLang["PHP"], argLists, basicFixArgs);
};

TestKoPyRefac.prototype.test_acceptRubyHits =
function test_acceptRubyHits() {
    var argLists = [
        // result, targetName, beforeText, afterText, 
        // path, lineNo, defn, inDefnContext,
        [ true, 'bar', 'def ', 'bar', true],
        [ false, 'bar', 'def ', 'bard', true],
        [ true, '@bar', '', '@bar = 33', false],
        [ false, '@bar', '', '@bard = 33', false],
        [ false, '@bard', '', '@bar = 33', false],
        [ true, 'bar', 'f(foo.', 'bar', false],
        [ true, 'bar', 'f(Foo::', 'bar', false],
        [ true, 'bar', 'f(@', 'bar', false],
        [ false, 'bar', 'f(foo.', 'bard', false],
        [ false, 'bar', 'f(Foo::', 'bard', false],
        [ false, 'bar', 'f(@', 'bard', false],
        [ true, 'Bar', 'module ', 'Bar', true],
        [ false, 'Bar', 'module ', 'Bard', true],
        [ true, 'Bar', 'class ', 'Bar', true],
        [ false, 'Bar', 'class ', 'Bard', true],
        []
    ];
    this.runAcceptHits(this.refacSvcByLang["Ruby"], argLists, basicFixArgs);
};

TestKoPyRefac.prototype.test_acceptPythonHits =
function test_acceptPythonHits() {
    // The Python component uses definition info and looks for code, so the
    // test function has to do more than for the other languages.
    var argLists = [
        // result, targetName, beforeText, afterText, 
        // path, lineNo, defn, inDefnContext,
        [ true, 'bar', 'foo.', 'bar', false],
        [ false, 'bar', 'foo. ', 'bard', false],
        [ true, 'bar', '(', 'bar=33', false],
        [ false, 'bar', '(', 'bard=33', false],
        [ true, 'bar', '(a, ', 'bar=33', false],
        [ false, 'bar', '(a, ', 'bard=33', false],
        [ true, 'bar', '        ', 'bar = 33', false],
        [ false, 'bar', '        ', 'bard = 33', false],
        []
    ];
    this.runAcceptHits(this.refacSvcByLang["Python"], argLists, basicFixArgs);
    // We can't easily test the definition handler in the Python's acceptHit method
    // because it wants a real koICodeIntelDefinition object, and those are hard to create
    // without calling koDoc.ciBuf.defn_trg_from_pos(...).
};

TestKoPyRefac.prototype.test_acceptTclHits =
function test_acceptTclHits() {
    var refacSvc = this.refacSvcByLang["Tcl"];
    var argList = [ 'bar', 'foo.', 'bar', false];
    this.assertRaises(Components.Exception,
                      refacSvc.acceptHit.bind(refacSvc),
                      ['bar', 'foo::bar', 5, "<path>", -1, null, false],
                      "tcl didn't throw an exception");
};

const JS_TESTS = ["TestKoPyRefac"];
