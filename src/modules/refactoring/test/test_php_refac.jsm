// Run tests on the PHP Refactoring Back-end component

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;
Cu.import("resource://komodo-jstest/JSTest.jsm");
Cu.import("resource://gre/modules/Services.jsm");

var ko = {};
Cu.import("resource://komodo-jstest/mock/mock.jsm", {})
  .import(ko, "logging", "views", "stringutils");

function TestKoPhpRefac() {
    this.log = ko.logging.getLogger("pyRefac.test");
    this.refacSvc = (Components.classes["@activestate.com/koRefactoringLangSvcFactory;1"].
                               getService(Components.interfaces.koIRefactoringLangSvcFactory).
                               getRefactoringLangSvcForLanguage("PHP"));
    this.lastErrorSvc = (Components.classes["@activestate.com/koLastErrorService;1"]
                       .getService(Components.interfaces.koILastErrorService));
}

TestKoPhpRefac.prototype = new TestCase();

TestKoPhpRefac.prototype.setUp = function TestKoPhpRefac_setUp() {
};

TestKoPhpRefac.prototype.tearDown = function TestKoPhpRefac_tearDown() {
};

TestKoPhpRefac.prototype.msgHandler =
function TestKoPhpRefac_msgHandler(level, context, message) {
    this.fail("Message handler called in quiet mode: " +
              "level=" + level + " context=" + context +
              " message=" + message + "\n");
};
TestKoPhpRefac.prototype.unmark_text = function unmark_text(markedup_text) {
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

TestKoPhpRefac.prototype._get_scimoz_and_koDoc_from_string = function(buf) {
    var view = new ko.views.ViewMock({text:buf});
    var scimoz = view.scimoz;
    if ('@activestate.com/ISciMozHeadless;1' in Cc) {
        // Set up the real Python lexer (for styling information)
        var lexerSvc = Cc["@activestate.com/koLanguageRegistryService;1"]
                         .getService(Ci.koILanguageRegistryService)
                         .getLanguage("PHP")
                         .getLanguageService(Ci.koILexerLanguageService);
        lexerSvc.setCurrent(scimoz);
    }
    return [scimoz, view.koDoc, view];
};

TestKoPhpRefac.prototype.test_checkStructurePHP_Children_1 =
function test_checkStructurePHP_Children_1() {
    var text, data, scimoz, koDoc;
    var code2 = [ '<?php'
                 ,'function foo($a, $b) {'
                 ,'    if ($a) {'
                 ,'        <[>print("Selected partial line on left");'
                 ,'        print("This line selected correctly.");'
                 ,'    }'
                 ,'    return $a + $b;<]>'
                 ,'}'
                 ,''
                 ,'$q = foo(4, 5);'
                 ,'?>'
                ];
    var styles2 = [ 46, 46, 46, 46, 46, 31,
 44, 44, 44, 44, 44, 44, 44, 44, 31, 45, 45, 45, 46, 48, 48, 46, 31, 48, 48, 46,
 31,
 46, 31,
 31, 31, 31, 31, 44, 44, 31, 46, 48, 48, 46, 31, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 46, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 46, 46, 31,
 31, 31, 31, 31, 46, 31,
 31, 31, 31, 31, 44, 44, 44, 44, 44, 44, 31, 48, 48, 31, 46, 31, 48, 48, 46, 31,
 46, 31,
 31,
 48, 48, 31, 46, 31, 45, 45, 45, 46, 42, 46, 31, 42, 46, 46, 31,
 46, 46];
    const foldLevels2 = [0x2400, 0x2401, 0x2402, 0x403, 0x403, 0x403, 0x402, 0x402,
                              0x1401, 0x401, 0x401]
    var code2_lf = code2.join("\n");
    [text, data] = this.unmark_text(code2_lf);
    this.assertTrue(data.start_selection);
    this.assertTrue(data.end_selection);
    [scimoz, koDoc] = this._get_scimoz_and_koDoc_from_string(text);
    if ('@activestate.com/ISciMozHeadless;1' in Cc) {
        scimoz.colourise(0, scimoz.length);
        for (let i in foldLevels2) {
            scimoz.setFoldLevel(i, foldLevels2[i]);
        }
    } else {
        scimoz.startStyling(0, ~0);
        scimoz.setStylingEx(styles2.length,
                            styles2.map(c => String.fromCharCode(c)).join(""));
        scimoz.setFoldLevels(foldLevels2);
    }
    this.assertEquals(scimoz.getStyleRange(0, scimoz.length), styles2);
    this.assertEquals([scimoz.getFoldLevel(i) for (i in foldLevels2)],
                      foldLevels2);
    this.assertRaises(Components.Exception,
                      this.refacSvc.categorizeVariables.bind(this.refacSvc),
                      [scimoz, koDoc, data.start_selection, data.end_selection,
                       {onGetVariables:()=>{}}],
                      "No error in code1",
                      e => this.assertEquals(e.result, Cr.NS_ERROR_ILLEGAL_VALUE,
                                             "Got unexpected exception " + e));
    this.assertEquals(this.lastErrorSvc.getLastErrorMessage(),
                      "Selection not fully contained within a block");
};

TestKoPhpRefac.prototype.test_checkStructurePHP_Children_2 =
function test_checkStructurePHP_Children_2() {
    var code3 = [ '<?php'
                 ,'function foo($a, $b) {'
                 ,'    if ($a) {'
                 ,'        <[>print("First line of child");'
                 ,'        print("Select second line of child.");'
                 ,'        print("This line is orphaned.");'
                 ,'    }'
                 ,'    return $a + $b;<]>'
                 ,'}'
                 ,'$q = foo(4, 5);'
                 ,'?>'
                ];
    var styles3 = [ 46, 46, 46, 46, 46, 31,
 44, 44, 44, 44, 44, 44, 44, 44, 31, 45, 45, 45, 46, 48, 48, 46, 31, 48, 48, 46,
 31,
 46, 31,
 31, 31, 31, 31, 44, 44, 31, 46, 48, 48, 46, 31, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 46, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 46, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 46, 46, 31,

 31, 31, 31, 31, 46, 31,
 31, 31, 31, 31, 44, 44, 44, 44, 44, 44, 31, 48, 48, 31, 46, 31, 48, 48, 46, 31,

 46, 31,
 48, 48, 31, 46, 31, 45, 45, 45, 46, 42, 46, 31, 42, 46, 46, 31,
 46, 46];
    const foldLevels = [0x2400, 0x2401, 0x2402, 0x403, 0x403, 0x403, 0x403,
                        0x402, 0x402, 0x401, 0x401]
    var code3_lf = code3.join("\n");
    [text, data] = this.unmark_text(code3_lf);
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
        scimoz.setStylingEx(styles3.length,
                            styles3.map(c => String.fromCharCode(c)).join(""));
        scimoz.setFoldLevels(foldLevels);
    }
    this.assertEquals(scimoz.getStyleRange(0, scimoz.length), styles3);
    this.assertEquals([scimoz.getFoldLevel(i) for (i in foldLevels)],
                      foldLevels);
    this.assertRaises(Components.Exception,
                      this.refacSvc.categorizeVariables.bind(this.refacSvc),
                      [scimoz, koDoc, data.start_selection, data.end_selection,
                       {onGetVariables:()=>{}}],
                      "No error in code1",
                      e => this.assertEquals(e.result, Cr.NS_ERROR_ILLEGAL_VALUE,
                                             "Got unexpected exception " + e));
    this.assertEquals(this.lastErrorSvc.getLastErrorMessage(),
                      "Selection not fully contained within a block");
    
};
TestKoPhpRefac.prototype.test_checkStructurePHP_Children_3 =
function test_checkStructurePHP_Children_3() {
    // Test alternative keywords
    var code3 = [ '<?php'
                 ,'function foo($a, $b) {'
                 ,'    if ($a):'
                 ,'        <[>print("First line of child");'
                 ,'        print("Select second line of child.");'
                 ,'        print("This line is orphaned.");'
                 ,'    endif'
                 ,'    return $a + $b;<]>'
                 ,'}'
                 ,'$q = foo(4, 5);'
                 ,'?>'
                ];
    var styles3 = [ 46, 46, 46, 46, 46, 31,
 44, 44, 44, 44, 44, 44, 44, 44, 31, 45, 45, 45, 46, 48, 48, 46, 31, 48, 48, 46,
 31,
 46, 31,
 31, 31, 31, 31, 44, 44, 31, 46, 48, 48, 46, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 46, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 46, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 46, 46, 31,

 31, 31, 31, 31, 44, 44, 44, 44, 44, 31,
 31, 31, 31, 31, 44, 44, 44, 44, 44, 44, 31, 48, 48, 31, 46, 31, 48, 48, 46, 31,

 46, 31,
 48, 48, 31, 46, 31, 45, 45, 45, 46, 42, 46, 31, 42, 46, 46, 31,
 46, 46];

    const foldLevels = [0x2400, 0x2401, 0x402, 0x402, 0x402, 0x402, 0x402,
                        0x402, 0x402, 0x401, 0x401];
    var code3_lf = code3.join("\n");
    [text, data] = this.unmark_text(code3_lf);
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
        scimoz.setStylingEx(styles3.length,
                            styles3.map(c => String.fromCharCode(c)).join(""));
        scimoz.setFoldLevels(foldLevels);
    }
    this.assertEquals(scimoz.getStyleRange(0, scimoz.length), styles3);
    this.assertEquals([scimoz.getFoldLevel(i) for (i in foldLevels)],
                      foldLevels);
    this.assertRaises(Components.Exception,
                      this.refacSvc.categorizeVariables.bind(this.refacSvc),
                      [scimoz, koDoc, data.start_selection, data.end_selection,
                       {onGetVariables:()=>{}}],
                      "No error in code1",
                      e => this.assertEquals(e.refacSvc, Cr.NS_ERROR_FAIURE,
                                             "Got unexpected exception " + e));
    this.assertEquals(this.lastErrorSvc.getLastErrorMessage(),
                      "block starts before selection (alt control structure syntax)");
};
    
TestKoPhpRefac.prototype.test_checkStructurePHP_Children_02 =
function test_checkStructurePHP_Children_02() {
    var text, data, scimoz, koDoc;
    // Test alternative keywords
    var code3 = [ '<?php'
                 ,'function foo($a, $b) {'
                 ,'    <[>if ($a):'
                 ,'        print("First line of child");'
                 ,'        print("Select second line of child.");<]>'
                 ,'        print("This line is orphaned.");'
                 ,'    endif'
                 ,'    return $a + $b;'
                 ,'}'
                 ,'$q = foo(4, 5);'
                 ,'?>'
                ];
    var styles3 = [ 46, 46, 46, 46, 46, 31,
 44, 44, 44, 44, 44, 44, 44, 44, 31, 45, 45, 45, 46, 48, 48, 46, 31, 48, 48, 46,
 31,
 46, 31,
 31, 31, 31, 31, 44, 44, 31, 46, 48, 48, 46, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 46, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 46, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 46, 46, 31,

 31, 31, 31, 31, 44, 44, 44, 44, 44, 31,
 31, 31, 31, 31, 44, 44, 44, 44, 44, 44, 31, 48, 48, 31, 46, 31, 48, 48, 46, 31,

 46, 31,
 48, 48, 31, 46, 31, 45, 45, 45, 46, 42, 46, 31, 42, 46, 46, 31,
 46, 46];
    const foldLevels = [0x2400, 0x2401, 0x402, 0x402, 0x402, 0x402, 0x402,
                        0x402, 0x402, 0x401, 0x401];

    var code3_lf = code3.join("\n");
    [text, data] = this.unmark_text(code3_lf);
    //dump("\n" + text + "\n");
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
        scimoz.setStylingEx(styles3.length,
                            styles3.map(c => String.fromCharCode(c)).join(""));
        scimoz.setFoldLevels(foldLevels);
    }
    this.assertEquals(scimoz.getStyleRange(0, scimoz.length), styles3);
    this.assertEquals([scimoz.getFoldLevel(i) for (i in foldLevels)],
                      foldLevels);
    this.assertRaises(Components.Exception,
                      this.refacSvc.categorizeVariables.bind(this.refacSvc),
                      [scimoz, koDoc, data.start_selection, data.end_selection,
                       {onGetVariables:()=>{}}],
                      "No error in code1",
                      e => this.assertEquals(e.result, Cr.NS_ERROR_ILLEGAL_VALUE,
                                             "Got unexpected exception " + e));
    this.assertEquals(this.lastErrorSvc.getLastErrorMessage(),
                      "block ends in middle of alt-syntax block");

    // Move the selection so it straddles the endif block
    var selStart = scimoz.positionFromLine(3) + 8;
    var selEnd = scimoz.positionFromLine(7) + 19;
    this.assertRaises(Components.Exception,
                      this.refacSvc.categorizeVariables.bind(this.refacSvc),
                      [scimoz, koDoc, selStart, selEnd, {onGetVariables:()=>{}}],
                      "No error in code1",
                      e => this.assertEquals(e.result, Cr.NS_ERROR_ILLEGAL_VALUE,
                                             "Got unexpected exception " + e));
    this.assertEquals(this.lastErrorSvc.getLastErrorMessage(),
                      "block starts before selection (alt control structure syntax)");
    
};
    
TestKoPhpRefac.prototype.test_checkStructurePHP_SplitBlocks =
function skip_test_checkStructurePHP_SplitBlocks() {
    throw SkipTest("Not implemented");

    // this test requires codeintel...
    var ciSvc = Cc["@activestate.com/koCodeIntelService;1"]
                  .getService(Ci.koICodeIntelService);
    var callbackResult = undefined;
    ciSvc.activate((result, data) => callbackResult = result, true);
    while (callbackResult === undefined) {
        Services.tm.currentThread.processNextEvent(true);
    }
    this.assertEquals(callbackResult, Ci.koIAsyncCallback.RESULT_SUCCESSFUL,
                      "Failed to initialize codeintel");

    var text, data, scimoz, koDoc;
    var code1 = [ '<?php'
                 ,'function foo($a, $b) {'
                 ,'    <[>if ($a) {'
                 ,'        print("First line of child");'
                 ,'        print("Second line of child.");'
                 ,'        print("Third line of child.");'
                 ,'    }<]>'
                 ,'    else {'
                 ,'        print("Missed line of else.");'
                 ,'    }'
                 ,'    return $a + $b;'
                 ,'}'
                 ,'$q = foo(4, 5);'
                 ,'?>'
                ];
    var styles1 = [ 46, 46, 46, 46, 46, 31,
 44, 44, 44, 44, 44, 44, 44, 44, 31, 45, 45, 45, 46, 48, 48, 46, 31, 48, 48, 46,
 31,
 46, 31,
 31, 31, 31, 31, 44, 44, 31, 46, 48, 48, 46, 31, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 46, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 46, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 46, 46, 31,
 31, 31, 31, 31, 46, 31,
 31, 31, 31, 31, 44, 44, 44, 44, 31, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 46, 46, 31,
 31, 31, 31, 31, 46, 31,
 31, 31, 31, 31, 44, 44, 44, 44, 44, 44, 31, 48, 48, 31, 46, 31, 48, 48, 46, 31,

 46, 31,
 48, 48, 31, 46, 31, 45, 45, 45, 46, 42, 46, 31, 42, 46, 46, 31,
 46, 46];
    var code1_lf = code1.join("\n");
    [text, data] = this.unmark_text(code1_lf);
    this.assertTrue(data.start_selection);
    this.assertTrue(data.end_selection);
    [scimoz, koDoc] = this._get_scimoz_and_koDoc_from_string(text);
    if (!('@activestate.com/ISciMozHeadless;1' in Cc)) {
        scimoz.setStyles(styles1);
        scimoz.setFoldLevels([0x2400, 0x2401, 0x2402, 0x403, 0x403, 0x403, 0x403, 0x2402, 0x403, 0x403,
                              0x402, 0x402, 0x401, 0x401]);
    }
    
    // Still don't have codeintel here.
    var lineNo = scimoz.lineFromPosition(data.start_selection);
    this.assertEquals(2, lineNo);
    var curr_section_start_line;
    var ciBuf = koDoc.ciBuf;
    this.assertRaises(Components.Exception,
                      ciBuf.section_from_line.bind(ciBuf),
                      [lineNo + 1,
                       Ci.koICodeIntelBuffer.SECTION_CURRENT,
                       false,
                       function(section) {},
                       function(msg) {}],
                      "curr_section_from_line should have thrown an exception",
                      e => this.assertEquals(e.result, Cr.NS_ERROR_FAILURE,
                                             "Got unexpected exception " + e));
    
    ////this.assertRaises(Components.Exception,
    ////                  function() {
    ////                    this.refacSvc.categorizeVariables(scimoz, koDoc,
    ////                                                             data.start_selection,
    ////                                                             data.end_selection,
    ////                                                             {});
    ////                  }, [],
    ////                  "No error in code1");
    ////this.assertEquals(this.lastErrorSvc.getLastErrorMessage(), "if-block continued with else after the selection");
}

TestKoPhpRefac.prototype.test_checkStructurePHP_SplitBlocks_02 =
function skip_test_checkStructurePHP_SplitBlocks_02() {
    throw SkipTest("Not implemented");

    var text, data, scimoz, koDoc;
    var code1 = [ '<?php'
                 ,'function foo($a, $b) {'
                 ,'    if ($a) {'
                 ,'        print("First line of child");'
                 ,'    } <[>else if ($b) {'
                 ,'        print("Can\'t select an else-block else.");<]>'
                 ,'    } else {'
                 ,'        print("Nothing to see here");'
                 ,'    }'
                 ,'    return $a + $b;'
                 ,'}'
                 ,'$q = foo(4, 5);'
                 ,'?>'
                ];
    var styles1 = [ 46, 46, 46, 46, 46, 31, 31,
 44, 44, 44, 44, 44, 44, 44, 44, 31, 45, 45, 45, 46, 48, 48, 46, 31, 48, 48, 46,
 31,
 46, 31, 31,
 31, 31, 31, 31, 44, 44, 31, 46, 48, 48, 46, 31, 46, 31, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 46, 46, 31, 31,
 31, 31, 31, 31, 46, 31, 44, 44, 44, 44, 31, 44, 44, 31, 46, 48, 48, 46, 31, 46,
 31,
 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 46, 46, 31, 31,
 31, 31, 31, 31, 46, 31, 44, 44, 44, 44, 31, 46, 31, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43,
 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 46, 46, 31, 31,
 31, 31, 31, 31, 46, 31, 31,
 31, 31, 31, 31, 44, 44, 44, 44, 44, 44, 31, 48, 48, 31, 46, 31, 48, 48, 46, 31,
 31,
 46, 31, 31,
 48, 48, 31, 46, 31, 45, 45, 45, 46, 42, 46, 31, 42, 46, 46, 31, 31,
 46, 46];
    var code1_lf = code1.join("\n");
    [text, data] = this.unmark_text(code1_lf);
    this.assertTrue(data.start_selection);
    this.assertTrue(data.end_selection);
    [scimoz, koDoc] = this._get_scimoz_and_koDoc_from_string(text);
    if (!('@activestate.com/ISciMozHeadless;1' in Cc)) {
        scimoz.setStyles(styles1);
        scimoz.setFoldLevels([0x2400, 0x2401, 0x2402, 0x403, 0x403, 0x403, 0x403, 0x403, 0x403, 0x402,
                              0x402, 0x401, 0x401]);
    }
    
    // Still don't have codeintel here.
    var lineNo = scimoz.lineFromPosition(data.start_selection);
    this.assertRaises(Components.Exception,
                      this.refacSvc.categorizeVariables.bind(this.refacSvc),
                      [scimoz, koDoc, data.start_selection, data.end_selection,
                       {onGetVariables:()=>{}}],
                      "No error in code1",
                      e => this.assertEquals(e.result, Cr.NS_ERROR_FAILURE,
                                             "Got unexpected exception " + e));
    this.assertEquals(this.lastErrorSvc.getLastErrorMessage(),
                      "if-block continued with else after the selection");
}

TestKoPhpRefac.prototype.test_checkStructurePHP_PartialBlock =
function test_checkStructurePHP_PartialBlock() {
    var text, data, scimoz, koDoc;
    var code1 = [ '<?php'
                 ,'function foo($a, $b) {'
                 ,'    while ($a < $b) {'
                 ,'        <[>print("First line of child");'
                 ,'        print("Second line of child.");'
                 ,'        if (++$a < $b) {'
                 ,'            break;'
                 ,'        }<]>'
                 ,'        print("Third line of child.");'
                 ,'    }'
                 ,'    return $a + $b;'
                 ,'}'
                 ,'$q = foo(4, 5);'
                 ,'?>'
                ];
    styles1 = [ 46, 46, 46, 46, 46, 31,
 44, 44, 44, 44, 44, 44, 44, 44, 31, 45, 45, 45, 46, 48, 48, 46, 31, 48, 48, 46, 31,
 46, 31,
 31, 31, 31, 31, 44, 44, 44, 44, 44, 31, 46, 48, 48, 31, 46, 31, 48, 48, 46, 31, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43, 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 46, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43, 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 46, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 31, 46, 46, 46, 48, 48, 31, 46, 31, 48, 48,
 46, 31, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 46, 31,
 31, 31, 31, 31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 46, 43, 43, 43, 43, 43, 43, 43,
 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 46, 46, 31,
 31, 31, 31, 31, 46, 31,
 31, 31, 31, 31, 44, 44, 44, 44, 44, 44, 31, 48, 48, 31, 46, 31, 48, 48, 46, 31,
 46, 31,
 48, 48, 31, 46, 31, 45, 45, 45, 46, 42, 46, 31, 42, 46, 46, 31,
 46, 46];
    const foldLevels = [0x2400, 0x2401, 0x2402, 0x403, 0x403, 0x2403, 0x404,
                        0x404, 0x403, 0x403, 0x402, 0x402, 0x401, 0x401];
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
    this.assertRaises(Components.Exception,
                      this.refacSvc.categorizeVariables.bind(this.refacSvc),
                      [scimoz, koDoc, data.start_selection, data.end_selection,
                       {onGetVariables:()=>{}}],
                      "No error in code1",
                      e => this.assertEquals(e.result, Cr.NS_ERROR_ILLEGAL_VALUE,
                                             "Got unexpected exception " + e));
    this.assertEquals(this.lastErrorSvc.getLastErrorMessage(),
                      "Can't extract break statements outside a loop");
};


const JS_TESTS = ["TestKoPhpRefac"];
