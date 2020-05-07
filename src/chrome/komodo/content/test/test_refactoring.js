/* Copyright (c) 2004-2013 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
var log = ko.logging.getLogger("test_refactoring");
log.setLevel(ko.logging.LOG_DEBUG);
var ko;
var gko; // pointer to main window
var widgets = null;
var view = null;
var numTests, numPassed, numFailed;
var testSkip = [];
var testOnly = [];//24, 25, 26, 27];
var newListRow = null;

//---- interface routines for XUL

var testObj;
var widgets;

function OnLoad()
{
    //log.debug("OnLoad()");
    try {
    } catch(ex) {
        log.exception(ex);
    }
    widgets = {};
    widgets.testNames = document.getElementById("test-names");
    var menuitems = widgets.testNames.getElementsByTagName('menuitem');
    Array.slice(menuitems).forEach(function(menuitem) {
        if (!menuitem.hasAttribute("value")) {
            menuitem.setAttribute("value", menuitem.getAttribute("label"));
        }
    });
    widgets.resultList = document.getElementById("results");
    widgets.stopButton = document.getElementById("stopTests");
    widgets.stopNextTest = false;
    testObj = new TestSuite();
    gko = ko.windowManager.getMainWindow().ko;
}

function RunTest()
{
    //log.debug("RunTest()");
    try {
        var testName = widgets.testNames.value;
        testObj.tests = [testObj[testName]];
        testObj.nextTest = 0;
        testObj.runNextTest();
    } catch(ex) {
        log.exception(ex);
    }
}

function RunAllTests()
{
    log.debug("RunAllTests()");
    try {
        testObj.tests = testObj.allTests;
        widgets.stopButton.disabled = false;
        testObj.RunAllTests();
    } catch(ex) {
        log.exception(ex);
    }
}

function ClearResults()
{
    var resultList = widgets.resultList;
    var listItems = resultList.getElementsByTagName("listitem");
    Array.slice(listItems).forEach(function(elt) {
            resultList.removeChild(elt);
        });
}

function StopTests() {
    widgets.stopButton.disabled = true;
    widgets.stopNextTest = true;
}

function TestSuite() {
    this.langs = ["Python", "Perl", "Ruby", "PHP", "Tcl", "JavaScript",
                  "Node.js", "Python3"];
    this.refacSvc = {}
    for each (var lang in this.langs) {
        this.refacSvc[lang] = (Cc["@activestate.com/koRefactoringLangSvcFactory;1"].
                               getService(Ci.koIRefactoringLangSvcFactory).
                               getRefactoringLangSvcForLanguage(lang));
    }
    this.lastErrorSvc = (Cc["@activestate.com/koLastErrorService;1"]
                       .getService(Ci.koILastErrorService));
    this.fileSvc = Cc["@activestate.com/koFileService;1"]
                       .getService(Ci.koIFileService);
    this.osPathSvc = Cc["@activestate.com/koOsPath;1"]
                       .getService(Ci.koIOsPath);
    this.suffix_from_lang_name = {
    Python: ".py",
    Python3: ".py",
    Perl: ".pl",
    Ruby: ".rb",
    PHP: ".php",
    Tcl: ".tcl",
    "JavaScript": ".js",
    "Node.js": ".js"
    };
    this.allTests = (Array.slice(widgets.testNames.
                                 getElementsByTagName("menuitem")).
                     map(function(elt) {
                             return this[elt.getAttribute("value")]
                                 }.bind(this)));
}

TestSuite.prototype = {
    unmark_text: function unmark_text(markedup_text) {
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
    },
    
    code_simple_python_01: [  'def foo(a, b):'
             ,'    while a:'
             ,'        print "Start here in while-block"'
             ,'        b -= 1'
             ,'        if b <= 0:'
             ,'            break'
             ,'        print "Select last line of block, but not the while"'
             ,'    return a + b'
             ,'print(foo(3, 4))'
            ],
    
    code_simple_python_02: [  'a = 3'
             ,'b = 4'
             ,'while a:'
             ,'    print "Start here in while-block"'
             ,'    b -= 1'
             ,'    if b <= 0:'
             ,'        break'
             ,'    print "Select last line of block, but not the while"'
             ,'print(foo(3, 4))'
            ],
    
    code_simple_python_03: [
         'a = 4'
        ,'b1 = 45'
        ,'c2, d3, e4 = b1 + a, b1 - a, b1 * b1'
        ,'c2 += 15'
        ,'finalVal = a + d3 + e4'
        ,'print(finalVal)'
        ,''
        ],
    
    code_python_png_parse_01: ['## {{{ http://code.activestate.com/recipes/578534/ (r1)'
    ,'import binascii'
    ,''
    ,'class Chunk:'
    ,'    Length=None'
    ,'    type=None'
    ,'    data=None'
    ,'    CRC=None'
    ,'    def hight_width(self):'
    ,'        if self.type==\'IHDR\':'
    ,'            width=int(self.data[0:8],16)'
    ,'            hight=int(self.data[8:16],16)'
    ,'            return [width,hight]'
    ,'            '
    ,''
    ,'class PNG:'
    ,'    header=\'\''
    ,'    Chunks=[]'
    ,'    FileName=\'\''
    ,'    data=\'\''
    ,'    width=\'\''
    ,'    hight=\'\''
    ,'    '
    ,'    def byts(self,data):'
    ,'      vals=[]'
    ,'      count=0'
    ,'      step=2'
    ,'      for i in range(0, len(data), 2):'
    ,'        vals.append(data[i:step])'
    ,'        step=step+2'
    ,'      return vals '
    ,'  '
    ,'    def Find_Chunks(self):'
    ,'        '
    ,'      x=Chunk()'
    ,'      total=0'
    ,'      while x.type != \'IEND\':'
    ,'        x=Chunk()  '
    ,'        x.Length=int(\'\'.join(self.data[8+total:12+total]),16)'
    ,'        x.type=\'\'.join(self.data[12+total:16+total]).decode(\'hex\')'
    ,'        '
    ,'        x.data=\'\'.join(self.data[16+total:15+x.Length+total])'
    ,'        x.CRC=\'\'.join(self.data[16+x.Length+total:20+x.Length+total])'
    ,'        w=x.hight_width()'
    ,'        if w:'
    ,'          self.width=w[0]'
    ,'          self.hight=w[1]'
    ,'        self.Chunks.append(x)'
    ,'       '
    ,'        total=total+x.Length+12'
    ,'        '
    ,'    '
    ,'    def  __init__(self,file):'
    ,'       self.FileName=file'
    ,'       file=open(self.FileName,\'r\')'
    ,'       data=file.read()'
    ,'       data=binascii.hexlify(data)'
    ,'       vals=self.byts(data)'
    ,'       self.data=vals'
    ,'       self.header=self.data[:8]'
    ,'       self.header=\'\'.join(self.header)'
    ,'       self.Find_Chunks()'
    ,'x=PNG(\'/root/th_grey3.png\')   '
    ,'print x.hight,x.hight'
    ,'## end of http://code.activestate.com/recipes/578534/ }}}'
            ],

    code_simple_php_01: ['<?php'
                 ,'$fqclass = 22;'
                 ,'function getConn($info, $config) {'
                 ,'    $connection = new $fqclass($info);'
                 ,'    $connection->protocol = $info->protocol;'
                 ,'    $connection->logging = $config->get_logging();'
                 ,'    $connection->logger = ($connection->logging'
                 ,'                           ? $config->get_logger()'
                 ,'                           : null);'
                 ,'    if (isset($info->charset))'
                 ,'               $connection->set_encoding($info->charset);'
                 ,'    $stmt = $connection->query("select * from animaux");'
                 ,'    $res = $stmt->execute();'
                 ,'    foreach ($res as $value) {'
                 ,'        print($value);'
                 ,'    }'
                 ,'    return $value(3);'
                 ,'}'
                 ,''
                 ,'$q = getconn(3, 4);'
                 ,'print($q);'
                 ,''
                 ,'?>'
                ],

    code_simple_php_02: [
        '<?php'
        ,'$username = $_POST[username];'
        ,'$password = $_POST[password];'
        ,'echo "<h2>Username: " . $username . "</h2></br>";'
        ,'echo "<h2>Password: " . $password . "</h2></br>";'
        ,''
        ,'// create the linux command'
        ,'$command = \'./FileProcessing.exe \' .  $username . \' \' . $password;'
        ,'// echo $command;'
        ,''
        ,'// call a compiled program that generated more HTML output'
        ,'echo("Run <$command>\\n");'
        ,'?>'
    ],

    code_simple_php_03: [
        '<?php'
        ,'list($username, $password) = array($_POST[username], $_POST[password]);'
        ,'echo "<h2>Username: " . $username . "</h2></br>";'
        ,'echo "<h2>Password: " . $password . "</h2></br>";'
        ,''
        ,'// create the linux command'
        ,'$command = \'./FileProcessing.exe \' .  $username . \' \' . $password;'
        ,'// echo $command;'
        ,''
        ,'// call a compiled program that generated more HTML output'
        ,'echo("Run <$command>\\n");'
        ,'?>'
    ],
    
code_simple_php_07: [
    '<?php'
   ,''
   ,'function f($q1, $q2) {'
   ,'    return array($q2, $q1);'
   ,'}'
   ,''
   ,'$abc1 = 10;'
   ,'$def22 = $abc1 + 22;'
   ,'list($ghi3, $jkl4) = f($abc1, $def22);'
   ,'$def22 += $ghi3;'
   ,'print("\\$def22: $def22, \\$jkl4: $jkl4\\n");'
   ,'?>'
],

code_simple_php_08: [
    '<?php'
   ,'function f($q1, $q2) {'
   ,'    return array($q2, $q1);'
   ,'}'
   ,''
   ,'$abc1 = 10;'
   ,'list($ghi3, $jkl4) = f($abc1, 7);'
   ,'$def22 = $abc1 + 22;'
   ,'$def22 += 14;'
   ,'$def22 += 15;'
   ,'$def22 += $ghi3;'
   ,'print("\\$def22: $def22, \\$jkl4: $jkl4\\n");'
],
    
RunAllTests: function RunAllTests() {
    widgets.stopNextTest = false;
    this.tests = this.allTests;
    this.nextTest = 0;
    this.runNextTest();
},

timeoutID: 0,
    
onTimeout: function() {
    this.logResult("TIMED OUT");
    this.runNextTest();
},

runNextTest: function runNextTest() {
    clearTimeout(this.timeoutID);
    if (this.nextTest >= this.tests.length) {
        return;
    }
    if (widgets.stopNextTest) {
        widgets.stopNextTest = false;
        widgets.stopButton.disabled = true;
        return;
    }
    // Clear attributes from earlier tests.
    delete this.allowNoSection;
    this.expectedDefPositions = {};

    var func = this.tests[this.nextTest++];
    newListRow = document.createElement('listitem');
    
    var cell = document.createElement('listcell');
    cell.setAttribute("label", "New test...");
    newListRow.appendChild(cell);
    
    cell = document.createElement('listcell');
    cell.setAttribute('label', 'Started');
    newListRow.appendChild(cell);
    
    //        var cell = document.createElement('listcell');
    //cell.image = "koicon://ko-svg/chrome/icomoon/skin/busy2.svg";
    //newListRow.appendChild(cell);
    
    cell = document.createElement('listcell');
    newListRow.appendChild(cell);
    
    cell = document.createElement('listcell');
    newListRow.appendChild(cell);
    
    widgets.resultList.appendChild(newListRow);
    widgets.resultList.ensureElementIsVisible(newListRow);
    
    // Allow 15 seconds...
    this.timeoutID = setTimeout(this.onTimeout.bind(this), 15 * 1000);
    // Use a setTimeout to convert the execution-stack into a linear row
    //func.call(this);
    setTimeout(function(this_) { func.call(this_) }, 0, this);
    
},

PythonTests_CategorizeVars_01:  function PythonTests_CategorizeVars_01() {
    this.lang = "Python";
    var code, code_crlf;
    code = this.code_simple_python_01;
    this.text = code.join("\n");
    this.data = {start_pt: [1, 4],
                 end_pt:   [6, 75 - 15]}
    this.expectedDefPositions = { a: [0, 8], b: [0, 11]};
    this.expectedVariables = { a:0x2c, b:0x6c };
    this.testName = "CategorizeVars_01";
    this._createView(this.PTCV_01_Ready.bind(this));
},

PythonTests_ExtractMethod_01:  function PythonTests_ExtractMethod_01() {
    this.lang = "Python";
    var code, code_crlf;
    code = this.code_simple_python_01;
    this.text = code.join("\n");
    var startLine = 1;
    var endLine = 6;
    this.data = {start_pt: [startLine, 4],
                 end_pt:   [endLine, 75 - 15]};
    this.inVars = ["a", "b"];
    this.outVars = ["b"];
    this.variables = { a:0x2c, b:0x6c };
    this.expectedNewSelStartPos = [startLine - 1, 0];
    this.expectedNewEndStartPos = [endLine + 3, 0];
    this.expectedSectionLineStart = 1;
    this.testName = "ExtractMethod_01";
    this.methodName = this.testName;
    // New calling line will be at line
    // startLine + (endLine - startLine + 1) + 3 => endLine + 4
    this.expectedCallLine = { lineNo: endLine + 4,
                              text: "b = " + this.methodName + "(a, b)"};
    this._createView(this.PTEM_01_Ready.bind(this));
},

PythonTests_ExtractMethod_02:  function PythonTests_ExtractMethod_01() {
    this.lang = "Python";
    var code, code_crlf;
    code = this.code_simple_python_02;
    this.text = code.join("\n");
    var startLine = 2;
    var endLine = 7;
    this.data = {start_pt: [startLine, 4],
                 end_pt:   [endLine, 57]};
    this.inVars = ["a", "b"];
    this.outVars = ["b"];
    this.variables = { a:0x0c, b:0x64 };
    this.expectedNewSelStartPos = [2, 0];
    this.expectedNewEndStartPos = [11, 0];
    this.expectedSectionLineStart = 1;
    this.testName = "ExtractMethod_02";
    this.methodName = this.testName;
    // New calling line will be at line
    // startLine + (endLine - startLine + 1) + 3 => endLine + 4
    this.expectedCallLine = { lineNo: 11,
                              text: "b = " + this.methodName + "(b)"};
    this.allowNoSection = true;
    this._createView(this.PTEM_01_Ready.bind(this));
},

PythonTests_ExtractMethod_03:  function PythonTests_ExtractMethod_03() {
    this.lang = "Python";
    var code, code_crlf;
    code = this.code_simple_python_03;
    this.text = code.join("\n");
    var startLine = 1;
    var endLine = 3;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 8]};
    this.inVars = [];
    this.outVars = ["d3", "e4"];
    this.variables = { d3:0x40, e4:0x40 };
    this.expectedNewSelStartPos = [1, 0];
    this.expectedNewEndStartPos = [7, 0];
    this.expectedSectionLineStart = 1;
    this.testName = "PythonTests_ExtractMethod_03";
    this.methodName = this.testName;
    // New calling line will be at line
    // startLine + (endLine - startLine + 1) + 3 => endLine + 4
    this.expectedCallLine = { lineNo: 7,
                              text: "d3, e4 = " + this.methodName + "()"};
    this.allowNoSection = true;
    this._createView(this.PTEM_01_Ready.bind(this));
},

// single-line extractMethod
PythonTests_ExtractMethod_04:  function PythonTests_ExtractMethod_04() {
    this.lang = "Python";
    var code, code_crlf;
    code = this.code_simple_python_03;
    this.text = code.join("\n");
    var startLine = 4;
    var endLine = 4;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 22]};
    this.inVars = ["a", 'd3', 'e4'];
    this.outVars = ['finalVal'];
    this.variables = { "a":0x26, d3:0x24, e4:0x24, finalVal:48 };
    this.expectedNewSelStartPos = [4, 0];
    this.expectedNewEndStartPos = [8, 0];
    this.expectedSectionLineStart = 1;
    this.testName = "PythonTests_ExtractMethod_04";
    this.methodName = this.testName;
    // New calling line will be at line
    // startLine + (endLine - startLine + 1) + 3 => endLine + 4
    this.expectedCallLine = { lineNo: 8,
                              text: "finalVal = " + this.methodName + "(d3, e4)"};
    this.allowNoSection = true;
    this._createView(this.PTEM_01_Ready.bind(this));
},

    code_simple_python_05: [
    '#!/usr/bin/env python',
    ,'import cProfile'
    ,'import time'
    ,''
    ,'class Foo(object):'
    ,'    def bar(self):'
    ,'    # DOCS: http://docs.python.org/2/library/profile.html#profile.Profile'
    ,'    # stole example from this page and modified it'
    ,''
    ,'    # create the profile object'
    ,'        cp = cProfile.Profile()'
    ,'        # Start the profiler'
    ,'        cp.enable()'
    ,'        # run your code'
    ,'        self.baz()'
    ,'        # this stops the profiler and saves the profile data'

    ,'        cp.create_stats()'
    ,'        # dump the saved profile data to a file'
    ,'        cp.dump_stats("profileTestResults")'
    ,''
    ,'    def baz(self):'
    ,'        time.sleep(1)'
    ,'        print \'slept\''
    ,'        time.sleep(2)'
    ,''
    ,'foo = Foo()'
    ,'foo.bar()'
    ,''
    ],

// copy entire comment (bug 100101)
PythonTests_ExtractMethod_05:  function PythonTests_ExtractMethod_05() {
    this.lang = "Python";
    var code, code_crlf;
    code = this.code_simple_python_05;
    this.text = code.join("\n");
    var startLine = 10;
    var endLine = 11;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 31]};
    this.inVars = [];
    this.outVars = []; // should be 'cp'
    this.variables = {  };
    this.expectedNewSelStartPos = [6, 0];
    this.expectedNewEndStartPos = [10, 0];
    this.expectedSectionLineStart = 7;
    this.testName = "PythonTests_ExtractMethod_05";
    this.methodName = this.testName;
    // New calling line will be at line
    // startLine + (endLine - startLine + 1) + 3 => endLine + 4
    this.expectedCallLine = { lineNo: 13,
                              text: "" + this.methodName + "()"};
    this.allowNoSection = true;
    this._createView(this.PTEM_01_Ready.bind(this));
},

// This fails, due to bug 100117
PythonTests_CategorizeVars_04:  function PythonTests_CategorizeVars_04() {
    this.lang = "Python";
    var code, code_crlf;
    code = this.code_simple_python_05;
    this.text = code.join("\n");
    var startLine = 10;
    var endLine = 11;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 31]};
    this.expectedDefPositions = { cp: [11, 8], cProfile:[11, 13] };
    this.expectedVariables = { cp:0x48, cProfile:0x04 };
    this.testName = "PythonTests_CategorizeVars_04";
    this._createView(this.PTCV_01_Ready.bind(this));
},

PythonTests_CategorizeVars_02:  function PythonTests_CategorizeVars_02() {
    this.lang = "Python";
    var code, code_crlf;
    code = this.code_python_png_parse_01;
    this.text = code.join("\n");
    this.data = {start_pt: [184 - 147, 6],
                 end_pt:   [190 - 147, 31 - 6]}
    this.expectedVariables = { x:0x6e, total:0xac, w:0x48, Chunk: 0x06 };
    // Chunk defined at [3, 6], but in the current section it's first used at []
    this.expectedDefPositions = { x:[34, 6], total:[35,6], w:[43,8], Chunk:[181 - 147, 8]};
    this.testName = "CategorizeVars_02";
    this._createView(this.PTCV_01_Ready.bind(this));
},

PythonTests_CategorizeVars_03:  function PythonTests_CategorizeVars_03() {
    // The 'i' in the for loop is getting passed in, should be local
    this.lang = "Python";
    var code, code_crlf;
    code = this.code_python_png_parse_01;
    this.text = code.join("\n");
    this.data = {start_pt: [27, 6],
                 end_pt:   [29, 19]}
    this.expectedVariables = { vals:0x2c, step:0x64, data:0x24, i:0x44 };
    this.expectedDefPositions = { vals:[24, 6], step:[26,6], data:[23,14], i:[27, 10]};
    this.testName = "CategorizeVars_03";
    this._createView(this.PTCV_01_Ready.bind(this));
},

PHPTests_CategorizeVars_01:  function PHPTests_CategorizeVars_01() {
    this.lang = "PHP";
    var code, code_crlf;
    code = this.code_simple_php_01;
    this.text = code.join("\n");
    this.data = {start_pt: [3, 4],
                 end_pt:   [7, 35]}
    this.expectedDefPositions = { $connection: [3,4], $info: [2,17], $config:[2,24], $fqclass:[3,22]};
    this.expectedVariables = { $connection:0x4c, $info:0x2c, $config:0x24, $fqclass:0x04 };
    this.testName = "CategorizeVars_01";
    this._createView(this.PTCV_01_Ready.bind(this));
},

    // Select from [$connection = ... null);
PHPTests_ExtractMethod_01:  function PHPTests_ExtractMethod_01() {
    this.lang = "PHP";
    var code, code_crlf;
    code = this.code_simple_php_01;
    this.text = code.join("\n");
    var startLine = 3;
    var endLine = 8;
    this.data = {start_pt: [startLine, 4],
                 end_pt:   [endLine, 35]}
    this.inVars = ["$info", "$config"];
    this.outVars = ["$connection"];
    this.variables = { $connection:0x4c, $info:0x2c, $config:0x24, $fqclass:0x04 };
    this.expectedNewSelStartPos = [startLine - 1, 0];
    this.expectedNewEndStartPos = [endLine + 4, 0];
    this.expectedSectionLineStart = 3;
    this.testName = "ExtractMethod_01";
    this.methodName = this.testName;
    this.expectedCallLine = { lineNo: endLine + 5,
                              lineText: ("    $connection = "
                                         + this.methodName
                                         + "($config, $info);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

    // Select from [    $connection = ... null);
PHPTests_ExtractMethod_02:  function PHPTests_ExtractMethod_02() {
    this.lang = "PHP";
    var code, code_crlf;
    code = this.code_simple_php_01;
    this.text = code.join("\n");
    var startLine = 3;
    var endLine = 8;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 35]}
    this.inVars = ["$info", "$config"];
    this.outVars = ["$connection"];
    this.variables = { $connection:0x4c, $info:0x2c, $config:0x24, $fqclass:0x04 };
    this.expectedNewSelStartPos = [startLine - 1, 0];
    this.expectedNewEndStartPos = [endLine + 4, 0];
    this.expectedSectionLineStart = 3;
    this.testName = "ExtractMethod_02";
    this.methodName = this.testName;
    this.expectedCallLine = { lineNo: endLine + 5,
                              lineText: ("    $connection = "
                                         + this.methodName
                                         + "($config, $info);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

    // Select from [    $connection = ... null);\n]
PHPTests_ExtractMethod_03:  function PHPTests_ExtractMethod_03() {
    this.lang = "PHP";
    var code, code_crlf;
    code = this.code_simple_php_01;
    this.text = code.join("\n");
    var startLine = 3;
    var endLine = 9;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 0]}
    this.inVars = ["$info", "$config"];
    this.outVars = ["$connection"];
    this.variables = { $connection:0x4c, $info:0x2c, $config:0x24, $fqclass:0x04 };
    this.expectedNewSelStartPos = [startLine - 1, 0];
    this.expectedNewEndStartPos = [endLine + 3, 0];
    this.expectedSectionLineStart = 3;
    this.testName = "ExtractMethod_03";
    this.methodName = this.testName;
    this.expectedCallLine = { lineNo: endLine + 4,
                              lineText: ("    $connection = "
                                         + this.methodName
                                         + "($config, $info);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

    // Select from [    $connection = ... null);\n    ]
PHPTests_ExtractMethod_04:  function PHPTests_ExtractMethod_04() {
    this.lang = "PHP";
    var code, code_crlf;
    code = this.code_simple_php_01;
    this.text = code.join("\n");
    var startLine = 3;
    var endLine = 9;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 4]}
    this.inVars = ["$info", "$config"];
    this.outVars = ["$connection"];
    this.variables = { $connection:0x4c, $info:0x2c, $config:0x24, $fqclass:0x04 };
    this.expectedNewSelStartPos = [startLine - 1, 0];
    this.expectedNewEndStartPos = [endLine + 3, 0];
    this.expectedSectionLineStart = 3;
    this.testName = "ExtractMethod_04";
    this.methodName = this.testName;
    this.expectedCallLine = { lineNo: endLine + 4,
                              lineText: ("    $connection = "
                                         + this.methodName
                                         + "($config, $info);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

// extract method from top-level code:
PHPTests_ExtractMethod_05:  function PHPTests_ExtractMethod_05() {
    this.lang = "PHP";
    var code, code_crlf;
    code = this.code_simple_php_02;
    this.text = code.join("\n");
    var startLine = 1;
    var endLine = 4;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 49]}
    this.inVars = ["$username", "$password"];
    this.outVars = ["$username", "$password"];
    this.variables = { $username:0x4c, $password:0x4c };
    this.expectedNewSelStartPos = [1, 0];
    this.expectedNewEndStartPos = [9, 0];
    this.expectedSectionLineStart = 1;
    this.testName = "ExtractMethod_04";
    this.methodName = this.testName;
    this.allowNoSection = true;
    this.expectedCallLine = { lineNo: endLine + 4,
                              lineText: ("    $connection = "
                                         + this.methodName
                                         + "($config, $info);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

// extract method from top-level code:
PHPTests_ExtractMethod_06:  function PHPTests_ExtractMethod_06() {
    this.lang = "PHP";
    var code, code_crlf;
    code = this.code_simple_php_03;
    this.text = code.join("\n");
    var startLine = 1;
    var endLine = 3;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 49]}
    this.inVars = ["$username", "$password"];
    this.outVars = ["$username", "$password"];
    this.variables = { $username:0x4c, $password:0x4c };
    this.expectedNewSelStartPos = [1, 0];
    this.expectedNewEndStartPos = [8, 0];
    this.expectedSectionLineStart = 1;
    this.testName = "PHPTests_ExtractMethod_06";
    this.methodName = this.testName;
    this.allowNoSection = true;
    this.expectedCallLine = { lineNo: endLine + 4,
                              lineText: ("    $connection = "
                                         + this.methodName
                                         + "($config, $info);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

// Parallel assignment tests
PHPTests_ExtractMethod_07:  function PHPTests_ExtractMethod_07() {
    this.lang = "PHP";
    var code, code_crlf;
    code = this.code_simple_php_07;
    this.text = code.join("\n");
    var startLine = 7;
    var endLine = 9;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 16]}
    this.inVars = ["$abc1"];
    this.outVars = ["$def22", "$jkl4"];
    this.variables = { $abc1:0x24, $def22:0x4c,  $jkl4:0x48};
    this.expectedNewSelStartPos = [2, 0];
    this.expectedNewEndStartPos = [9, 0];
    this.expectedSectionLineStart = 3;
    this.testName = "PHPTests_ExtractMethod_07";
    this.methodName = this.testName;
    //this.allowNoSection = true;
    this.expectedCallLine = { lineNo: 13,
                              lineText: ("list($def22, $jkl4) = "
                                         + this.methodName
                                         + "($abc1);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

PHPTests_ExtractMethod_08:  function PHPTests_ExtractMethod_08() {
    this.lang = "PHP";
    var code, code_crlf;
    code = this.code_simple_php_08;
    this.text = code.join("\n");
    var startLine = 6;
    var endLine = 8;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 13]}
    this.inVars = ["$abc1"];
    this.outVars = ["$def22", "$ghi3", "$jkl4"];
    this.variables = { $abc1:0x24, $def22:0x4c, $ghi3:0x48, $jkl4:0x48};
    this.expectedNewSelStartPos = [1, 0];
    this.expectedNewEndStartPos = [8, 0];
    this.expectedSectionLineStart = 2;
    this.testName = "PHPTests_ExtractMethod_08";
    this.methodName = this.testName;
    this.allowNoSection = true;
    this.expectedCallLine = { lineNo: 13,
                              lineText: ("list($def22, $ghi3, $jkl4) = "
                                         + this.methodName
                                         + "($abc1);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

// single-line in-method
PHPTests_ExtractMethod_09:  function PHPTests_ExtractMethod_09() {
    this.lang = "PHP";
    var code, code_crlf;
    code = this.code_simple_php_01;
    this.text = code.join("\n");
    var startLine = 5;
    var endLine = 5;
    this.data = {start_pt: [startLine, 4],
                 end_pt:   [endLine, 50]}
    this.inVars = ["$connection", "$info"];
    this.outVars = [];
    this.variables = { $connection:0x2e, $info:0x2e};
    this.expectedNewSelStartPos = [2, 0];
    this.expectedNewEndStartPos = [6, 0];
    this.expectedSectionLineStart = 3;
    this.testName = "PHPTests_ExtractMethod_09";
    this.methodName = this.testName;
    //this.allowNoSection = true;
    this.expectedCallLine = { lineNo: 13,
                              lineText: (this.methodName
                                         + "($connection, $info);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

// single-line top-level
PHPTests_ExtractMethod_10:  function PHPTests_ExtractMethod_10() {
    this.lang = "PHP";
    var code, code_crlf;
    code = this.code_simple_php_02;
    this.text = code.join("\n");
    var startLine = 2;
    var endLine = 2;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 29]}
    this.inVars = [];
    this.outVars = ["$password"];
    this.variables = { $password:0x48};
    this.expectedNewSelStartPos = [2, 0];
    this.expectedNewEndStartPos = [7, 0];
    this.expectedSectionLineStart = 1;
    this.testName = "PHPTests_ExtractMethod_10";
    this.methodName = this.testName;
    this.allowNoSection = true;
    this.expectedCallLine = { lineNo: 7,
                              lineText: ("$password = "
                                         + this.methodName
                                         + "();") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

code_simple_js_01: [
    'var ko = {};',
    'ko.main = {};',
    '',
    '(function() { /* ko.main */',
    'this.quitApplication = function() {',
    '    ko.main.windowIsClosing = true;',
    '};',
    '',
    'this._onClose = function(event) {',
    '    if (ko.windowManager.lastWindow()) {',
    '        event.stopPropagation();',
    '        event.preventDefault();',
    '        event.cancelBubble = true;',
    '        ko.main.quitApplication();',
    '        return;',
    '    }',
    '    if (!ko.main.runCanCloseHandlers()) {',
    '        event.stopPropagation();',
    '        event.preventDefault();',
    '        event.cancelBubble = true;',
    '        return;',
    '    }',
    '}',
    '}).apply(ko.main);'
],

code_simple_js_03: [
    'var a = 33;'
   ,'var b = 45;'
   ,'var i = a - 20;'
   ,'while (i < a - 10) {'
   ,'    a += 1'
   ,'    if (a % 2) {'
   ,'        a += 1;'
   ,'        break;'
   ,'    }'
   ,'    if (a % 2) {'
   ,'        a += 1;'
   ,'        continue;'
   ,'    }'
   ,'}'
   ,'console.log(a);'
],

code_simple_js_04: [
     'function f(a, b) {'
    ,'    return [b, a]'
    ,'}'
    ,''
    ,'var abc1 = 10;'
    ,'var def22 = abc1 + 22;'
    ,'var ghi3, jkl4;'
    ,'[ghi3, jkl4] = f(abc1, def22);'
    ,'def22 += ghi3;'
    ,'console.log(def22, jkl4);'
    ],

JSTests_CategorizeVars_01:  function JSTests_CategorizeVars_01() {
    this.lang = "JavaScript";
    var code, code_crlf;
    code = this.code_simple_js_01;
    this.text = code.join("\n");
    this.data = {start_pt: [10, 8],
                 end_pt:   [12, 34]}
    this.expectedDefPositions = { event: [8,25]};
    this.expectedVariables = { event:0x2c };
    this.testName = "CategorizeVars_01";
    this._createView(this.PTCV_01_Ready.bind(this));
},

    // Select from [$connection = ... null);
JSTests_ExtractMethod_01:  function JSTests_CategorizeVars_01() {
    this.lang = "JavaScript";
    var code, code_crlf;
    code = this.code_simple_js_01;
    this.text = code.join("\n");
    var startLine = 10;
    var endLine = 12;
    this.data = {start_pt: [startLine, 8],
                 end_pt:   [endLine, 34]}
    this.inVars = ["event"];
    this.outVars = [];
    this.variables = { event:0x2c };
    this.expectedNewSelStartPos = [startLine - 2, 0];
    this.expectedNewEndStartPos = [endLine + 2, 0];
    this.expectedSectionLineStart = 9;
    this.testName = "ExtractMethod_01";
    this.methodName = "jsem01";
    this.expectedCallLine = { lineNo: endLine + 3,
                              lineText: ("        this."
                                         + this.methodName
                                         + "(event);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},


code_js_obj_methods: [ 'ko.codeintel = {};'
    ,'(function(scimoz) {'
    ,'    this.highlightVariable = (function CodeIntel_HighlightVariable(view, reason)'
    ,'    {'
    ,'        var findHitCallback = {'
    ,'            hasHit: false,'
    ,'            // batch up the indicator painting to avoid excessive repaints'
    ,'            ranges: [],'
    ,'            pending: 0,'
    ,'            done: false,'
    ,'            addHighlight: function(start, length)'
    ,'                this.ranges.push([start, length]),'
    ,'            doHighlight: function doHighlight() {'
    ,'                scimoz.indicatorCurrent = INDICATOR;'
    ,'                scimoz.indicatorValue = 1;'
    ,'                if (!this.hasHit) {'
    ,'                    scimoz.indicatorClearRange(0, scimoz.length);'
    ,'                    this.hasHit = true;'
    ,'                }'
    ,'                let ranges = this.ranges.splice(0);'
    ,'                for each (let [start, length] in ranges) {'
    ,'                    scimoz.indicatorFillRange(start, length);'
    ,'                }'
    ,'            },'
    ,'            onDone: function(result) {'
    ,'                this.done = true;'
    ,'                if (this.pending > 0) {'
    ,'                    return; // wait for async defns to come back'
    ,'                }'
    ,'                this.doHighlight();'
    ,'                if (Components.isSuccessCode(result)) {'
    ,'                    do_next_range();'
    ,'                }'
    ,'            }'
    ,'        };'
    ,'    })({});'
    ,'    this.otherThing = 3;'
    ,'}).apply(ko.codeintel);'
   ],

    // Select from [let ranges ... }
JSTests_ExtractMethod_02:  function JSTests_CategorizeVars_02() {
    this.lang = "JavaScript";
    var code, code_crlf;
    code = this.code_js_obj_methods;
    this.text = code.join("\n");
    var startLine = 19;
    var endLine = 22;
    this.data = {start_pt: [startLine, 16],
                 end_pt:   [endLine, 16]}
    this.inVars = [ ];
    this.outVars = [];
    this.variables = { };
    this.expectedSectionLineStart = 13;
    this.expectedNewSelStartPos = [this.expectedSectionLineStart - 1, 0];
    this.expectedNewEndStartPos = [(this.expectedSectionLineStart
                                    + endLine
                                    - startLine
                                    + 3 - 1),  0];
    this.testName = "ExtractMethod_02";
    this.methodName = "jsem02";
    this.expectedCallLine = { lineNo: endLine + 3,
                              lineText: ("                this."
                                         + this.methodName
                                         + "();") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

JSTests_ExtractMethod_03:  function JSTests_ExtractMethod_03() {
    this.lang = "JavaScript";
    var code, code_crlf;
    code = this.code_simple_js_03;
    this.text = code.join("\n");
    var startLine = 3;
    var endLine = 13;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 1]}
    this.inVars = ['a', 'i'];
    this.outVars = ['a'];
    this.variables = { a:0x6e, i:0x24 };
    this.expectedSectionLineStart = 1;
    this.expectedNewSelStartPos = [0, 0];
    this.expectedNewEndStartPos = [15,  0];
    this.testName = "JSTests_ExtractMethod_03";
    this.methodName = "jsem03";
    this.allowNoSection = true;
    this.expectedCallLine = { lineNo: 18,
                              lineText: ("a = "
                                         + this.methodName
                                         + "(a, i);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

JSTests_ExtractMethod_04:  function JSTests_ExtractMethod_04() {
    this.lang = "JavaScript";
    var code, code_crlf;
    code = this.code_simple_js_04;
    this.text = code.join("\n");
    var startLine = 5;
    var endLine = 7;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 30]}
    this.inVars = ['abc1'];
    this.outVars = ['def22', 'ghi3', 'jkl4'];
    this.variables = { abc1:0x24, def22:0x4c, ghi3:0x48, jkl4:0x48 };
    this.expectedSectionLineStart = 1;
    this.expectedNewSelStartPos = [0, 0];
    this.expectedNewEndStartPos = [7,  0];
    this.testName = "JSTests_ExtractMethod_04";
    this.methodName = "jsem04";
    this.allowNoSection = true;
    this.expectedCallLine = { lineNo: 13,
                              lineText: ("[def22, ghi3, jkl4] = "
                                         + this.methodName
                                         + "(abc1);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

// single-line extraction in a method
JSTests_ExtractMethod_05:  function JSTests_ExtractMethod_05() {
    this.lang = "JavaScript";
    var code, code_crlf;
    code = this.code_simple_js_01;
    this.text = code.join("\n");
    var startLine = 12;
    var endLine = 12;
    this.data = {start_pt: [startLine, 8],
                 end_pt:   [endLine, 34]}
    this.inVars = ['event'];
    this.outVars = [];
    this.variables = { event:0x2e };
    this.expectedSectionLineStart = 9;
    this.expectedNewSelStartPos = [8, 0];
    this.expectedNewEndStartPos = [12,  0];
    this.testName = "JSTests_ExtractMethod_05";
    this.methodName = "jsem05";
    this.allowNoSection = true;
    this.expectedCallLine = { lineNo: 16,
                              lineText: ("        "
                                         + this.methodName
                                         + "(event);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

// single-line extraction at top-level
JSTests_ExtractMethod_06:  function JSTests_ExtractMethod_06() {
    this.lang = "JavaScript";
    var code, code_crlf;
    code = this.code_simple_js_03;
    this.text = code.join("\n");
    var startLine = 1;
    var endLine = 2;
    this.data = {start_pt: [startLine, 4],
                 end_pt:   [endLine, 15]}
    this.inVars = ['a', 'b'];
    this.outVars = ['a'];
    this.variables = { a:0x48, b:0x40 };
    this.expectedSectionLineStart = 1;
    this.expectedNewSelStartPos = [0, 0];
    this.expectedNewEndStartPos = [6,  0];
    this.testName = "JSTests_ExtractMethod_06";
    this.methodName = "jsem06";
    this.allowNoSection = true;
    this.expectedCallLine = { lineNo: 13,
                              lineText: ("a = "
                                         + this.methodName
                                         + "();") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

code_structure_js_01: [ 'function f() {'
,'    var a = 33;'
,'    var b = 45;'
,'    var i = a - 20;'
,'    while (i < a - 10) {'
,'        a += 1'
,'        if (a % 2) {'
,'            a += 1;'
,'            break;'
,'        }'
,'        if (a % 2) {'
,'            a += 1;'
,'            continue;'
,'        }'
,'    }'
,'    do {'
,'        a += 1'
,'        if (a % 2) {'
,'            a += 1;'
,'            switch(a) {'
,'                case 3:'
,'                    break;'
,'                case 4:'
,'                    continue;'
,'            }'
,'            break;'
,'        }'
,'        if (a % 2) {'
,'            a += 1;'
,'            continue;'
,'        }'
,'        var x = (function(y1, y2) {'
,'            return y1 + y2'
,'        })(20, 30);'
,'        x + 5;'
,'        return x;'
,'    } while (i < a);'
,'    do {'
,'        a += 1'
,'        if (a % 2) {'
,'            a += 1;'
,'            switch(a) {'
,'                case 3:'
,'                    break;'
,'                case 4:'
,'                    continue;'
,'            }'
,'            break;'
,'        }'
,'        if (a % 2) {'
,'            a += 1;'
,'            continue;'
,'        }'
,'        var x = (function(y1, y2) {'
,'            return y1 + y2'
,'        })(20, 30);'
,'        x + 5;'
,'        return x;'
,'    } while (i < a);'
,'    do {'
,'        a += 1'
,'        if (a % 2) {'
,'            a += 1;'
,'            break;'
,'        }'
,'        if (a % 2) {'
,'            a += 1;'
,'            continue;'
,'        }'
,'    } while (i < a);'
,'}'
],

JSTests_StructureFail_01: function JSTests_StructureFail_01() {
    // Return outside function
    this.lang = "JavaScript";
    this.text = this.code_structure_js_01.join("\n");
    this.data = {start_pt: [34, 4],
                 end_pt:   [35, 17]}
    this.testName = "JS_StructureFail_01";
    this.expectedMessage = "return in selection not contained in a function";
    this._createView(this.StructureFail_Ready.bind(this));
},

JSTests_StructureFail_02: function JSTests_StructureFail_02() {
    // break outside loop/switch
    this.lang = "JavaScript";
    this.text = this.code_structure_js_01.join("\n");
    this.data = {start_pt: [6, 8],
                 end_pt:   [9, 9]}
    this.testName = "JS_StructureFail_02";
    this.expectedMessage = "break in selection not contained in a loop";
    this._createView(this.StructureFail_Ready.bind(this));
},

JSTests_StructureFail_03: function JSTests_StructureFail_03() {
    // continue outside loop
    this.lang = "JavaScript";
    this.text = this.code_structure_js_01.join("\n");
    this.data = {start_pt: [19, 8],
                 end_pt:   [24, 9]}
    this.testName = "JS_StructureFail_03";
    this.expectedMessage = "continue in selection not contained in a loop";
    this._createView(this.StructureFail_Ready.bind(this));
},

JSTests_StructureCheck_04: function JSTests_StructureCheck_04() {
    // Allow continue in full loop
    this.lang = "JavaScript";
    this.text = this.code_structure_js_01.join("\n");
    this.data = {start_pt: [4, 4],
                 end_pt:   [14, 9]}
    this.testName = "JS_StructureCheck_04";
    //this.expectedDefPositions = { a: [1, 5], i: [0, 5]};
    //this.expectedVariables = { a:0xee, i:0x2e  };
    this.expectedDefPositions = this.expectedVariables = null;
    this._createView(this.PTCV_01_Ready.bind(this));
},

JSTests_StructureCheck_05: function JSTests_StructureCheck_05() {
    // Allow return in an inner function
    this.lang = "JavaScript";
    this.text = this.code_structure_js_01.join("\n");
    this.data = {start_pt: [31, 4],
                 end_pt:   [34, 14]}
    this.testName = "JS_StructureCheck_05";
    // This doesn't find any variables, could be a bug.
    this.expectedDefPositions = { };
    this.expectedVariables = { };
    this._createView(this.PTCV_01_Ready.bind(this));
},

JSTests_StructureCheck_06: function JSTests_StructureCheck_06() {
    // Allow break/continue in a do-loop
    this.lang = "JavaScript";
    this.text = this.code_structure_js_01.join("\n");
    this.data = {start_pt: [59, 4],
                 end_pt:   [69, 20]}
    this.testName = "JS_StructureCheck_06";
    this.expectedDefPositions = this.expectedVariables = null;
    // Bug here and in JS_SC_04
    //this.expectedDefPositions = { a: [1, 5], i: [0, 6] };
    //this.expectedVariables = { x:0x6a };
    this._createView(this.PTCV_01_Ready.bind(this));
},

NodeTests_CategorizeVars_01:  function NodeTests_CategorizeVars_01() {
    this.lang = "Node.js";
    var code, code_crlf;
    code = this.code_simple_js_01;
    this.text = code.join("\n");
    this.data = {start_pt: [10, 8],
                 end_pt:   [12, 34]}
    this.expectedDefPositions = { event: [8,25]};
    this.expectedVariables = { event:0x2c };
    this.testName = "Node_CategorizeVars_01";
    this._createView(this.PTCV_01_Ready.bind(this));
},

    // Select from [$connection = ... null);
NodeTests_ExtractMethod_01:  function NodeTests_CategorizeVars_01() {
    this.lang = "Node.js";
    var code, code_crlf;
    code = this.code_simple_js_01;
    this.text = code.join("\n");
    var startLine = 10;
    var endLine = 12;
    this.data = {start_pt: [startLine, 8],
                 end_pt:   [endLine, 34]}
    this.inVars = ["event"];
    this.outVars = [];
    this.variables = { event:0x2c };
    this.expectedNewSelStartPos = [startLine - 2, 0];
    this.expectedNewEndStartPos = [endLine + 2, 0];
    this.expectedSectionLineStart = 9;
    this.testName = "Node_ExtractMethod_01";
    this.methodName = "nodeem01";
    this.expectedCallLine = { lineNo: endLine + 3,
                              lineText: ("        this."
                                         + this.methodName
                                         + "(event);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

    // Select from [let ranges ... }
NodeTests_ExtractMethod_02:  function NodeTests_ExtractMethod_02() {
    this.lang = "Node.js";
    var code, code_crlf;
    code = this.code_js_obj_methods;
    this.text = code.join("\n");
    var startLine = 19;
    var endLine = 22;
    this.data = {start_pt: [startLine, 16],
                 end_pt:   [endLine, 16]}
    this.inVars = [ ];
    this.outVars = [];
    this.variables = { };
    this.expectedSectionLineStart = 13;
    this.expectedNewSelStartPos = [this.expectedSectionLineStart - 1, 0];
    this.expectedNewEndStartPos = [(this.expectedSectionLineStart
                                    + endLine
                                    - startLine
                                    + 3 - 1),  0];
    this.testName = "Node_ExtractMethod_02";
    this.methodName = "nodeem02";
    this.expectedCallLine = { lineNo: endLine + 3,
                              lineText: ("                this."
                                         + this.methodName
                                         + "();") };
    this._createView(this.PTEM_01_Ready.bind(this));
},



NodeTests_StructureFail_01: function NodeTests_StructureFail_01() {
    // Return outside function
    this.lang = "Node.js";
    this.text = this.code_structure_js_01.join("\n");
    this.data = {start_pt: [34, 4],
                 end_pt:   [35, 17]}
    this.testName = "Node_StructureFail_01";
    this.expectedMessage = "return in selection not contained in a function";
    this._createView(this.StructureFail_Ready.bind(this));
},

NodeTests_StructureFail_02: function NodeTests_StructureFail_02() {
    // break outside loop/switch
    this.lang = "Node.js";
    this.text = this.code_structure_js_01.join("\n");
    this.data = {start_pt: [6, 8],
                 end_pt:   [9, 9]}
    this.testName = "Node_StructureFail_02";
    this.expectedMessage = "break in selection not contained in a loop";
    this._createView(this.StructureFail_Ready.bind(this));
},

NodeTests_StructureFail_03: function NodeTests_StructureFail_03() {
    // continue outside loop
    this.lang = "Node.js";
    this.text = this.code_structure_js_01.join("\n");
    this.data = {start_pt: [19, 8],
                 end_pt:   [24, 9]}
    this.testName = "Node_StructureFail_03";
    this.expectedMessage = "continue in selection not contained in a loop";
    this._createView(this.StructureFail_Ready.bind(this));
},

NodeTests_StructureCheck_04: function NodeTests_StructureCheck_04() {
    // Allow continue in full loop
    this.lang = "Node.js";
    this.text = this.code_structure_js_01.join("\n");
    this.data = {start_pt: [4, 4],
                 end_pt:   [14, 9]}
    this.testName = "Node_StructureCheck_04";
    //this.expectedDefPositions = { a: [1, 5], i: [0, 5]};
    //this.expectedVariables = { a:0xee, i:0x2e  };
    this.expectedDefPositions = this.expectedVariables = null;
    this._createView(this.PTCV_01_Ready.bind(this));
},

NodeTests_StructureCheck_05: function NodeTests_StructureCheck_05() {
    // Allow return in an inner function
    this.lang = "Node.js";
    this.text = this.code_structure_js_01.join("\n");
    this.data = {start_pt: [31, 4],
                 end_pt:   [34, 14]}
    this.testName = "Node_StructureCheck_05";
    // This doesn't find any variables, could be a bug.
    this.expectedDefPositions = { };
    this.expectedVariables = { };
    this._createView(this.PTCV_01_Ready.bind(this));
},

NodeTests_StructureCheck_06: function NodeTests_StructureCheck_05() {
    // Allow break/continue in a do-loop
    this.lang = "Node.js";
    this.text = this.code_structure_js_01.join("\n");
    this.data = {start_pt: [59, 4],
                 end_pt:   [69, 20]}
    this.testName = "Node_StructureCheck_06";
    this.expectedDefPositions = this.expectedVariables = null;
    // Bug here and in JS_SC_04
    //this.expectedDefPositions = { a: [1, 5], i: [0, 6] };
    //this.expectedVariables = { x:0x6a };
    this._createView(this.PTCV_01_Ready.bind(this));
},

StructureFail_Ready: function StructureFail_Ready(view) {
    var scimoz = view.scimoz;
    var start_selection = this.posFromLineColumn(scimoz, this.data.start_pt);
    var end_selection =  this.posFromLineColumn(scimoz, this.data.end_pt);
    start_selection = this.refacSvc[this.lang].adjustStartPosition(scimoz, start_selection);
    end_selection = this.refacSvc[this.lang].adjustEndPosition(scimoz, end_selection);
    var callback = function callback(results) {
        log.error(this.testName + ": No error, expected "
                          + this.expectedMessage);
        newListRow.childNodes[1].setAttribute("label", msg);
        this.logResult("FAIL");
        this.runNextTest();
    }.bind(this);
    try {
        this.refacSvc[this.lang].categorizeVariables(scimoz, view.koDoc,
                                         start_selection,
                                         end_selection,
                                         callback);
    } catch(e) {
        var msg = Cc["@activestate.com/koLastErrorService;1"]
            .getService(Ci.koILastErrorService)
            .getLastErrorMessage();
        if (msg != this.expectedMessage) {
            log.error(this.testName + ": Expected error "
                      + this.expectedMessage
                      + ", got "
                      + msg);
            this.logResult("FAIL");
            newListRow.childNodes[1].setAttribute("label", msg);
        } else {
            this.logResult("PASS");
        }
        this.runNextTest();
    }
},

ExtractMethod_Fail_Ready: function ExtractMethod_Fail_Ready(view) {
    var scimoz = view.scimoz;
    var start_selection = this.posFromLineColumn(scimoz, this.data.start_pt);
    var end_selection =  this.posFromLineColumn(scimoz, this.data.end_pt);
    start_selection = this.refacSvc[this.lang].adjustStartPosition(scimoz, start_selection);
    end_selection = this.refacSvc[this.lang].adjustEndPosition(scimoz, end_selection);
    try {
        var firstUseOutVars = ('firstUseOutVars' in this
                               ? this.firstUseOutVars
                               : []);
        this.refacSvc[this.lang].extractMethod(scimoz,
                                               start_selection, end_selection,
                                              this.expectedSectionLineStart - 1,
                                               this.methodName,
                                               this.inVars.length, this.inVars,
                                               this.outVars.length, this.outVars,
                                               firstUseOutVars.length,
                                               firstUseOutVars,
                                               {});
        
        log.error(this.testName + ": No error, expected "
                          + this.expectedMessage);
        newListRow.childNodes[1].setAttribute("label", msg);
        this.logResult("FAIL");
    } catch(e) {
        var msg = Cc["@activestate.com/koLastErrorService;1"]
            .getService(Ci.koILastErrorService)
            .getLastErrorMessage();
        if (msg != this.expectedMessage) {
            log.error(this.testName + ": Expected error "
                      + this.expectedMessage
                      + ", got "
                      + msg);
            this.logResult("FAIL");
            newListRow.childNodes[1].setAttribute("label", msg);
        } else {
            this.logResult("PASS");
        }
    }
    this.runNextTest();
},

code_simple_ruby_01: [ 'class C'
    ,'  def find_paths_to_nodes_aux(root, indexNodes)'
    ,'    if root.class != Array'
    ,'      return nil, nil'
    ,'    end'
    ,'    rootSize = root.size'
    ,'    if rootSize == 1'
    ,'      return find_paths_to_nodes_aux(root[0], indexNodes + [0])'
    ,'    end'
    ,'    # Do we have a location at the end of the current branch?'
    ,'    lastNode = root[-1]'
    ,'    if (lastNode.class == Array && lastNode.size == 2 && lastNode.all?{|x| x.class == Fixnum})'
    ,'      return [lastNode, indexNodes]'
    ,'    end'
    ,'    # Linear search first, then look into optimizing'
    ,'    cStartPath = cStartIndex = cStartLastNode = nil'
    ,'    root.each_with_index do |child, index|'
    ,'      lastNode, newNodePath = find_paths_to_nodes_aux(child,indexNodes + [index])'
    ,'      if lastNode'
    ,'        if lastNode[0] > @lineNo || lastNode[0] == @lineNo &&lastNode[1] > @colNo'
    ,'          if !cStartPath.nil?'
    ,'            @cStart = cStartPath + [cStartIndex]'
    ,'            @cStartLastNode = cStartLastNode'
    ,'            @cEnd = newNodePath + [index]'
    ,'            @cEndLastNode = lastNode'
    ,'            raise PathFinderDone.new'
    ,'          else'
    ,'            return lastNode, newNodePath + [index]'
    ,'          end'
    ,'        end'
    ,'        cStartPath = newNodePath'
    ,'        cStartIndex = index'
    ,'        @cEnd = newNodePath + @cStart'
    ,'        cStartLastNode = lastNode'
    ,'      end'
    ,'    end'
    ,'    if cStartPath.nil?'
    ,'      return nil, nil'
    ,'    else'
    ,'      return cStartLastNode, cStartPath + [cStartIndex]'
    ,'    end'
    ,'  end'
    ,'end'
    ,''
    ,'a = C.new.find_paths_to_nodes_aux([], [])'
    ,'puts a'
   ],

code_simple_ruby_02: [
     'a = 3'
    ,'b = 4'
    ,'c = a + 2'
    ,'c += b + 1'
    ,'name = "abcdefg"[a..b]'
    ,'puts "#{c}: #{name}"'
   ],

code_simple_ruby_04: [
    'def f(q1, q2)'
   ,'  return [q2, q1]'
   ,'end'
   ,''
   ,'abc1 = 10;'
   ,'def22 = abc1 + 22;'
   ,'ghi3, jkl4 = f(abc1, def22);'
   ,'def22 += ghi3;'
   ,'puts("def22: #{def22}, jkl4: #{jkl4}")'
],

code_simple_ruby_05: [
    'def f(q1, q2)'
   ,'  return [q2, q1]'
   ,'end'
   ,''
   ,'abc1 = 10;'
   ,'ghi3, jkl4 = f(abc1, 7);'
   ,'def22 = abc1 + 22;'
   ,'def22 += 14;'
   ,'def22 += 15;'
   ,'def22 += ghi3;'
   ,'puts("def22: #{def22}, jkl4: #{jkl4}");'
],

RubyTests_CategorizeVars_01:  function RubyTests_CategorizeVars_01() {
    this.lang = "Ruby";
    var code, code_crlf;
    code = this.code_simple_ruby_01;
    this.text = code.join("\n");
    this.data = {start_pt: [30, 8],
                 end_pt:   [31, 27]}
    this.expectedDefPositions = { cStartPath: [15, 4], newNodePath:[17,16],
                                  cStartIndex:[15,17], index:[16,36]};
    this.expectedVariables = { cStartPath:0x6a, newNodePath:0x2e,
                                  cStartIndex:0x6a, index:0x26};
    this.testName = "RubyCategorizeVars_01";
    this._createView(this.PTCV_01_Ready.bind(this));
},

RubyTests_CategorizeVars_02:  function RubyTests_CategorizeVars_02() {
    this.lang = "Ruby";
    var code, code_crlf;
    code = this.code_simple_ruby_01;
    this.text = code.join("\n");
    this.data = {start_pt: [30, 8],
                 end_pt:   [33, 33]}
    this.expectedDefPositions = { cStartPath: [15, 4], newNodePath:[17,16],
                                  cStartIndex:[15,17], index:[16,36],
                                  cStartLastNode:[15,31], lastNode:[10,4]};
    this.expectedVariables = { cStartPath:0x6a, newNodePath:0x26,
                                  cStartIndex:0x6a, index:0x26,
                                  cStartLastNode:0x6a, lastNode:0x26
                                  };
    this.testName = "RubyCategorizeVars_02";
    this._createView(this.PTCV_01_Ready.bind(this));
},

    // Select from [$connection = ... null);
RubyTests_ExtractMethod_01:  function RubyTests_ExtractMethod_01() {
    this.lang = "Ruby";
    var code, code_crlf;
    code = this.code_simple_ruby_01;
    this.text = code.join("\n");
    var startLine = 30;
    var endLine = 33;
    this.expectedSectionLineStart = 2;
    this.data = {start_pt: [startLine, 8],
                 end_pt:   [endLine, 33]}
    this.inVars = ["newNodePath", "index", "lastNode"];
    this.outVars = ["cStartPath", "cStartIndex", "cStartLastNode"];
    this.variables = { cStartPath:0x6a, newNodePath:0x26,
                                  cStartIndex:0x6a, index:0x26,
                                  cStartLastNode:0x6a, lastNode:0x26
                                  };
    this.expectedNewSelStartPos = [1, 0];
    this.expectedNewEndStartPos = [9, 0];
    this.testName = "RubyExtractMethod_01";
    this.methodName = "rbem01";
    this.expectedCallLine = { lineNo: endLine + 3,
                              lineText: ("        "
                                         + "cStartIndex, cStartLastNode, cStartPath = "
                                         + this.methodName
                                         + "(index, lastNode, newNodePath);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

    // Select from [@cEndLastNode = ... raise PathFinderDone.new);
RubyTests_ExtractMethod_02_Raise:  function RubyTests_ExtractMethod_02_Raise() {
    this.lang = "Ruby";
    var code, code_crlf;
    code = this.code_simple_ruby_01;
    this.text = code.join("\n");
    var startLine = 24;
    var endLine = 25;
    this.expectedSectionLineStart = 2;
    this.data = {start_pt: [startLine, 12],
                 end_pt:   [endLine, 36]}
    this.inVars = ["lastNode"];
    this.outVars = [];
    this.variables = { lastNode:0x26 };
    this.expectedNewSelStartPos = [1, 0];
    this.expectedNewEndStartPos = [6, 0];
    this.testName = "RubyExtractMethod_02";
    this.methodName = "rbem02";
    this.expectedCallLine = { lineNo: endLine + 3,
                              lineText: ("        "
                                         + this.methodName
                                         + "(lastNode);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

RubyTests_ExtractMethod_03:  function RubyTests_ExtractMethod_03() {
    this.lang = "Ruby";
    var code, code_crlf;
    code = this.code_simple_ruby_02;
    this.text = code.join("\n");
    var startLine = 2;
    var endLine = 3;
    this.expectedSectionLineStart = 1;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 10]}
    this.inVars = ["a", "b"];
    this.outVars = ["c"];
    this.variables = { a:0x2c, b:0x6c, c:0x4c };
    this.expectedNewSelStartPos = [2, 0];
    this.expectedNewEndStartPos = [8, 0];
    this.testName = "RubyTests_ExtractMethod_03";
    this.methodName = "rbem03";
    this.allowNoSection = true;
    this.expectedCallLine = { lineNo: 8,
                              lineText: ("        "
                                         + "c = "
                                         + this.methodName
                                         + "(a, b);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

RubyTests_ExtractMethod_04:  function RubyTests_ExtractMethod_04() {
    this.lang = "Ruby";
    var code, code_crlf;
    code = this.code_simple_ruby_04;
    this.text = code.join("\n");
    var startLine = 5;
    var endLine = 7;
    this.expectedSectionLineStart = 1;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 14]}
    this.inVars = ["abc1"];
    this.outVars = ["def22", "jkl4"];
    this.variables = { abc1:0x24, def22:0x4c, jkl4:0x48 };
    this.expectedNewSelStartPos = [0, 0];
    this.expectedNewEndStartPos = [7, 0];
    this.testName = "RubyTests_ExtractMethod_04";
    this.methodName = "rbem04";
    this.allowNoSection = true;
    this.expectedCallLine = { lineNo: 8,
                              lineText: ("        "
                                         + "def22, jkl4 = "
                                         + this.methodName
                                         + "(abc1);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

RubyTests_ExtractMethod_05:  function RubyTests_ExtractMethod_05() {
    this.lang = "Ruby";
    var code, code_crlf;
    code = this.code_simple_ruby_05;
    this.text = code.join("\n");
    var startLine = 5;
    var endLine = 7;
    this.expectedSectionLineStart = 1;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 12]}
    this.inVars = ["abc1"];
    this.outVars = ["def22", "ghi3", "jkl4"];
    this.variables = { abc1:0x24, def22:0xcc, ghi3:0x48, jkl4:0x48 };
    this.expectedNewSelStartPos = [0, 0];
    this.expectedNewEndStartPos = [7, 0];
    this.testName = "RubyTests_ExtractMethod_05";
    this.methodName = "rbem05";
    this.allowNoSection = true;
    this.expectedCallLine = { lineNo: 8,
                              lineText: ("        "
                                         + "c = "
                                         + this.methodName
                                         + "(a, b);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

// single-line extraction in a method
RubyTests_ExtractMethod_06:  function RubyTests_ExtractMethod_06() {
    this.lang = "Ruby";
    var code, code_crlf;
    code = this.code_simple_ruby_01;
    this.text = code.join("\n");
    var startLine = 30;
    var endLine = 30;
    this.expectedSectionLineStart = 2;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 32]}
    this.inVars = ["newNodePath"];
    this.outVars = ["cStartPath"];
    this.variables = { newNodePath:0x2c, cStartPath:0x48 };
    this.expectedNewSelStartPos = [1, 0];
    this.expectedNewEndStartPos = [6, 0];
    this.testName = "RubyTests_ExtractMethod_06";
    this.methodName = "rbem06";
    this.allowNoSection = true;
    this.expectedCallLine = { lineNo: 35,
                              lineText: ("        "
                                         + "cStartPath = "
                                         + this.methodName
                                         + "(newNodePath);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

// single-line extraction at top-level
RubyTests_ExtractMethod_07:  function RubyTests_ExtractMethod_07() {
    this.lang = "Ruby";
    var code, code_crlf;
    code = this.code_simple_ruby_05;
    this.text = code.join("\n");
    var startLine = 9;
    var endLine = 9;
    this.expectedSectionLineStart = 1;
    this.data = {start_pt: [startLine, 0],
                 end_pt:   [endLine, 14]}
    this.inVars = ["def22", "ghi3"];
    this.outVars = ["def22"];
    this.variables = { def22:0x6e, ghi3:0x24 };
    this.expectedNewSelStartPos = [0, 0];
    this.expectedNewEndStartPos = [5, 0];
    this.testName = "RubyTests_ExtractMethod_07";
    this.methodName = "rbem07";
    this.allowNoSection = true;
    this.expectedCallLine = { lineNo: 8,
                              lineText: ("        "
                                         + "def22 = "
                                         + this.methodName
                                         + "(ghi3);") };
    this._createView(this.PTEM_01_Ready.bind(this));
},

posFromLineColumn : function posFromLineColumn(scimoz, pt) {
    return scimoz.positionFromLine(pt[0]) + pt[1];
},

PTCV_01_Ready: function PTCV_01_Ready(view) {
    //dump("01_Ready this props: "
    //     + Object.keys(this)
    //     + "\n");
    try {
        var scimoz = view.scimoz;
        var start_selection = this.posFromLineColumn(scimoz, this.data.start_pt);
        var end_selection =  this.posFromLineColumn(scimoz, this.data.end_pt);
        start_selection = this.refacSvc[this.lang].adjustStartPosition(scimoz, start_selection);
        end_selection = this.refacSvc[this.lang].adjustEndPosition(scimoz, end_selection);
        if (this.expectedDefPositions) {
            // Convert from pts to absolute posns, if needed
            for (var name in this.expectedDefPositions) {
                var val = this.expectedDefPositions[name];
                if ('length' in val) {
                    this.expectedDefPositions[name] = this.posFromLineColumn(scimoz, val);
                }
            }
        }
        var callback = function(variables) {
            cell.setAttribute("label", "categorizeVariables (done)");
            try {
                if (!variables) {
                    var msg = Cc["@activestate.com/koLastErrorService;1"]
                        .getService(Ci.koILastErrorService)
                        .getLastErrorMessage();
                    newListRow.childNodes[1].setAttribute("label",
                                                          msg);
                    this.logResult("ERROR");
                } else if (!this.expectedVariables) {
                    // No vars to check for this test.
                    this.logResult("PASS");
                } else {
                    var res = this.compareVariables(variables);
                    this.logResult(this.boolToTestStatus(res));
                    if (res) {
                        view.close(true);
                    }
                }
            } finally {
                this.runNextTest();
            }
        }.bind(this);
        var cell = newListRow.childNodes[1];
        cell.setAttribute("label", "categorizeVariables...");
        var variables = 
            this.refacSvc[this.lang].categorizeVariables(scimoz, view.koDoc,
                                             start_selection,
                                             end_selection,
                                             callback);
    } catch(ex) {
        log.exception(ex, "categorizeVariables failed");
        this.logResult("ERROR");
        this.runNextTest();
    }
},

colorizer: function colorizer(view, callback) {
    const EOL_LF = Ci.koIDocument.EOL_LF;
    var koDoc = view.koDoc;
    koDoc.new_line_endings = EOL_LF;
    koDoc.existing_line_endings = EOL_LF;
    //dump("01_withView this props: "
    //     + Object.keys(this)
    //     + "\n");
    // use a setTimeout to allow the new line_endings to be processed.
    setTimeout(function() {
            koDoc.save(true);
            setTimeout(function() {
                view.scimoz.colourise(0, -1);
                setTimeout(function() {
                    callback(view);
                }, 100);
            }, 300);
        }.bind(this), 100);
},

handleError: function() {
    var msg = Cc["@activestate.com/koLastErrorService;1"]
        .getService(Ci.koILastErrorService)
        .getLastErrorMessage();
    newListRow.childNodes[1].setAttribute("label", msg);
    this.logResult("ERROR");
    this.runNextTest();
},

PTEM_01_Ready: function PTEM_01_Ready(view) {
    //dump("01_Ready this props: "
    //     + Object.keys(this)
    //     + "\n");
    let on_have_section = function(ciBufSection) {
        try {
            let sectionLineStart;
            if (!ciBufSection) {
                if (this.allowNoSection) {
                    sectionLineStart = 1;
                } else {
                    log.error(this.testName + ": FAIL: No section for line " +
                              this.data.start_pt[0]);
                    this.logResult("FAIL");
                    return;
                }
            } else {
                sectionLineStart = ciBufSection.line;
            }
            if (sectionLineStart != this.expectedSectionLineStart) {
                log.error(this.testName + ": FAIL: Expecting section " +
                          this.expectedSectionLineStart + ", got " + sectionLineStart);
                this.logResult("FAIL");
                return;
            }
            var cell = newListRow.childNodes[1];
            cell.setAttribute("label", "extractMethod...");
            var firstUseOutVars = ('firstUseOutVars' in this
                                   ? this.firstUseOutVars
                                   : []);
            var selPoints =
                    this.refacSvc[this.lang].extractMethod(scimoz, start_selection, end_selection,
                                                       this.expectedSectionLineStart - 1,
                                                   this.methodName,
                                                   this.inVars.length, this.inVars,
                                                   this.outVars.length, this.outVars,
                                                   firstUseOutVars.length, firstUseOutVars,
                                                   {});
            //dump("New text:\n" + scimoz.text + "\n************************\n");
            //setTimeout(function() { dump(scimoz.text)} , 1000);
            view.koDoc.save(true);
            cell.setAttribute("label", "extractMethod (done)");
            var new_start_selection = this.posFromLineColumn(scimoz, this.expectedNewSelStartPos);
            var new_end_selection =  this.posFromLineColumn(scimoz, this.expectedNewEndStartPos);
            var obj = {};
            if (selPoints[0] != new_start_selection) {
                log.error("Expected new_start_selection of " + new_start_selection
                     + ", got " + selPoints[0]+ "]\n");
                 this.logResult("FAIL");
            } else  if (selPoints[1] != new_end_selection) {
                log.error("Expected new_end_selection of " + new_end_selection
                     + ", got " + selPoints[1]+ "]\n");
                 this.logResult("FAIL");
            } else if (this.expectedCallLine
                       && scimoz.getLine(this.expectedCallLine.lineNo, obj) > -1
                       && obj.value == this.expectedCallLine.text) {
                log.error("Expected new line at "
                     + this.expectedCallLine.lineNo
                     + " = ["
                     + this.expectedCallLine.text
                     + "], got :["
                     + obj.value
                     + "]\n");
                 this.logResult("FAIL");
            } else {
                this.logResult("PASS");
                view.close(true);
            }
        } finally {
            this.runNextTest();
        }
    }.bind(this);
    try {
        var scimoz = view.scimoz;
        var start_selection, end_selection;
        var start_selection = this.posFromLineColumn(scimoz, this.data.start_pt);
        var end_selection =  this.posFromLineColumn(scimoz, this.data.end_pt);
        start_selection = this.refacSvc[this.lang].adjustStartPosition(scimoz, start_selection);
        end_selection = this.refacSvc[this.lang].adjustEndPosition(scimoz, end_selection);
        var ciBuf = view.koDoc.ciBuf;
        ciBuf.section_from_line(this.data.start_pt[0],
                                ciBuf.SECTION_CURRENT,
                                false,
                                on_have_section,
                                this.handleError.bind(this));
    } catch(ex) {
        log.exception(ex, "categorizeVariables failed");
        this.logResult("ERROR");
    }
},

PythonTests_StructureCheck_01:  function PythonTests_StructureCheck_01() {
    this.lang = "Python";
    var code;
    code = this.code_simple_python_01;
    this.text = code.join("\n");
    this.startLine = 6;
    this.expectedSectionLineStart = 1;
    this.testName = "PythonTests_StructureCheck_01";
    this._createView(this.StructureCheck_withView.bind(this));
},

StructureCheck_withView: function StructureCheck_withView(view) {
    var ciBuf = view.koDoc.ciBuf;
    var onSection = function onSection(ciBufSection) {
        var sectionStart = ciBufSection.line;
        if (sectionStart != this.expectedSectionLineStart) {
            log.error(this.testName + ": FAIL: Expecting section start " +
                      this.expectedSectionLineStart + ", got " + sectionStart);
            this.logResult("FAIL");
        } else {
            this.logResult("PASS");
        }
        this.runNextTest();
    };
    var onFailure = function onFailure(msg) {
        log.error(this.testName + ": " + msg);
        newListRow.childNodes[1].setAttribute("label", msg);
        this.logResult("ERROR");
        this.runNextTest();
    };
    try {
        ciBuf.section_from_line(this.startLine,
                                Ci.koICodeIntelBuffer.SECTION_CURRENT,
                                false,
                                onSection.bind(this),
                                onFailure.bind(this));
    } catch(ex) {
        log.exception(this.testName);
        newListRow.childNodes[1].setAttribute("label", ex.message);
        this.logResult("ERROR");
        this.runNextTest();
    }
},

code_perl_vars_01: [
 'sub f1 {'
,'        my $scalar = 3;'
,'        my @array = (3,4, 5);'
,'        my %hash = (abc => 1, def => 2, ghi => 3);'
,'        my $rarray1 = [12, 13, \'this is a string\', \'next is float\', 14.5];'
,'        my $longStream = \'a\' x 100 . "\\n";'
,'        print $array[0];'
,'        print $hash{abc};'
,'        $array[1] += 1;'
,'        $longStream .= (\'b\' x 100 . "\\n");'
,'        $longStream .= (\'c\' x 100 . "\\n");'
,'        my $rhash1 = {abc => 11, def => 12, ghi => 13};'
,'        my @array2 = (\\$gscalar, \\@garray, \\%ghash, \\$grarray1, $grhash1);'
,'        my $rarray2 = [\\$gscalar, \\@garray, \\%ghash, \\$grarray1, $grhash1, \\$grhash1];'
,'        my $rhash2 = {abc => \\$gscalar, def => \\@garray, ghi => \\%ghash, jkl => \\$grarray1, mno => $grhash1, pqr => \\$grhash1, stu => $rarray2, vwx => \\$rarray2};'
,'        $rhash2->{recurse} = \\$rhash2;'
,'        delete $rhash2->{recurse};'
,'        print "Leaving f1\\n";'
,'}'
,''
,'f1();'
],

code_perl_vars_02: [
 'sub f1 {'
,'    my $scalar = 3;'
,'    my @array = (3,4, 5);'
,'    my %hash = (abc => 1, def => 2, ghi => 3);'
,'    print $array[0];'
,'    print $hash{abc};'
,'    @array = (6, 7, 8);'
,'    %hash = (jkl => 4, mnop => 5, qrs => 6);'
,'    print $array[3];'
,'    print $hash{jkl};'
,'    print "Leaving f1\\n";'
,'}'
,''
,'f1();'
],


code_perl_vars_03: [
 'sub f2 {'
,'    my $a = 3;'
,'    my $b = 4;'
,'    print "\\$a: $a\\n";'
,'    print "\\$b: $b\\n";'
,'    $a += 5;'
,'    my $c = 5;'
,'    $a += 6;'
,'    $b += 7;'
,'    $c += 9;'
,'    my $d = 6;'
,'    print "$a, $b, $c, %$d\\n";'
,'}'
,''
,'f2();'
],

code_perl_vars_04: [
,'use strict;'
,'use warnings;'
,'my $a = 3;'
,'my $b = 4;'
,'print "\\$a: $a\\n";'
,'print "\\$b: $b\\n";'
,'$a += 5;'
,'my $c = 5;'
,'$a += 6;'
,'$b += 7;'
,'$c += 9;'
,'my $d = 6;'
,'print "$a, $b, $c, %$d\\n";'
],

code_perl_parallel_08: [
     'use strict;'
    ,'use warnings;'
    ,''
    ,'sub f {'
    ,'    my ($q1, $q2) = @_;'
    ,'    return ($q2, $q1);'
    ,'}'
    ,''
    ,'my $abc1 = 10;'
    ,'my $def22 = $abc1 + 22;'
    ,'my ($ghi3, $jkl4);'
    ,'($ghi3, $jkl4) = f($abc1, $def22);'
    ,'$def22 += $ghi3;'
    ,'print("\\$def22: $def22, \\$jkl4: $jkl4\\n");'
   ],

code_perl_parallel_09: [
    'use strict;'
    ,'use warnings;'
    ,''
    ,'sub f {'
    ,'    my ($q1, $q2) = @_;'
    ,'    return ($q2, $q1);'
    ,'}'
    ,''
    ,'my $abc1 = 10;'
    ,'my ($ghi3, $jkl4);'
    ,'($ghi3, $jkl4) = f($abc1, 7);'
    ,'my $def22 = $abc1 + 22;'
    ,'$def22 += 14;'
    ,'$def22 += 15;'
    ,'$def22 += $ghi3;'
    ,'print("\\$def22: $def22, \\$jkl4: $jkl4\\n");'
   ],

PerlTests_CategorizeVars_01: function PerlTests_CategorizeVars_01() {
    this.lang = "Perl";
    var code, code_crlf;
    this.text = this.code_perl_vars_01.join("\n");
    this.data = {start_pt: [5, 8],
                 end_pt:   [7, 25]}
    this.expectedDefPositions = { '$longStream': [5, 11], '@array': [2, 11],
                                  '%hash': [3, 11]};
    this.expectedVariables = { '$longStream': 0xc8, '@array': 0x2c,
                               '%hash': 0x24};
    this.testName = "Perl_CategorizeVars_01";
    this._createView(this.PTCV_01_Ready.bind(this));
},


PerlTests_CategorizeVars_02: function PerlTests_CategorizeVars_02() {
    // Verify that it won't extract modified @ and % vars
    this.lang = "Perl";
    var code, code_crlf;
    this.text = this.code_perl_vars_02.join("\n");
    this.data = {start_pt: [6, 4],
                 end_pt:   [7, 44]}
    this.inVars = [];
    this.outVars = ['@array', '%hash'];
    this.expectedSectionLineStart = 1;
    this.expectedMessage = "ExtractMethod for Perl doesn't yet support handling reinitialized arrays and scalars (for variables ['@array', '%hash'])";
    this.testName = "Perl_CategorizeVars_02";
    this._createView(this.ExtractMethod_Fail_Ready.bind(this));
},

PerlTests_ExtractMethod_03: function PerlTests_ExtractMethod_03() {
    // 0/3 outvars defined in selection
    this.lang = "Perl";
    var code, code_crlf;
    this.text = this.code_perl_vars_03.join("\n");
    this.data = {start_pt: [7, 4],
                 end_pt:   [9, 12]};
    this.testName = "PerlTests_ExtractMethod_03";
    this.inVars = ["$a", "$b", "$c"];
    this.outVars = ["$a", "$b", "$c"];
    delete this.expectedDefPositions;
    this.firstUseOutVars = [];
    this.expectedVariables = { "$a":0x6e, "$b":0x6e, "$c":0x6c };
    this.expectedNewSelStartPos = [0, 0];
    this.expectedNewEndStartPos = [10, 0];
    this.expectedSectionLineStart = 1;
    this.methodName = this.testName;
    this.expectedCallLine = { lineNo: 10,
                              text: "($a, $b, $c) = " + this.methodName + "($a, $b);"};
    this._createView(this.PTCV_01_Ready.bind(this));
},

PerlTests_ExtractMethod_04: function PerlTests_ExtractMethod_04() {
    // 1/3 outvars defined in selection
    this.lang = "Perl";
    var code, code_crlf;
    this.text = this.code_perl_vars_03.join("\n");
    this.data = {start_pt: [6, 4],
                 end_pt:   [9, 12]};
    this.testName = "PerlTests_ExtractMethod_04";
    this.inVars = ["$a", "$b"];
    this.outVars = ["$a", "$b", "$c"];
    this.firstUseOutVars = ["$c"];
    this.expectedVariables = { "$a":0x6e, "$b":0x6e, "$c":0x4c };
    this.expectedNewSelStartPos = [0, 0];
    this.expectedNewEndStartPos = [10, 0];
    this.expectedSectionLineStart = 1;
    this.methodName = this.testName;
    this.expectedCallLine = { lineNo: 17,
                              text: "($a, $b, $c, $d) = " + this.methodName + "($a, $b);"};
    this._createView(this.PTCV_01_Ready.bind(this));
},

PerlTests_ExtractMethod_05: function PerlTests_ExtractMethod_05() {
    // 2/3 outvars defined in selection
    this.lang = "Perl";
    var code, code_crlf;
    this.text = this.code_perl_vars_03.join("\n");
    this.data = {start_pt: [2, 4],
                 end_pt:   [9, 12]};
    this.testName = "PerlTests_ExtractMethod_05";
    this.inVars = ["$a"];
    this.outVars = ["$a", "$b", "$c"];
    this.firstUseOutVars = ["$b", "$c"];
    this.expectedVariables = { "$a":0x6c, "$b":0x4c, "$c":0x4c  };
    this.expectedNewSelStartPos = [0, 0];
    this.expectedNewEndStartPos = [8, 0];
    this.expectedSectionLineStart = 1;
    this.methodName = this.testName;
    this.expectedCallLine = { lineNo: 18,
                              text: "($a, $b, $c) = " + this.methodName + "($a, $b);"};
    this._createView(this.PTCV_01_Ready.bind(this));
},

PerlTests_ExtractMethod_06: function PerlTests_ExtractMethod_06() {
    // 3/3 outvars defined in selection
    this.lang = "Perl";
    var code, code_crlf;
    this.text = this.code_perl_vars_03.join("\n");
    this.data = {start_pt: [1, 4],
                 end_pt:   [9, 14]};
    this.testName = "PerlTests_ExtractMethod_06";
    this.inVars = [];
    this.outVars = ["$a", "$b", "$c"];
    this.firstUseOutVars = ["$a", "$b", "$c"];
    this.expectedVariables = { "$a":0x4c, "$b":0x4c , "$c":0x4c};
    this.expectedNewSelStartPos = [0, 0];
    this.expectedNewEndStartPos = [13, 0];
    this.expectedSectionLineStart = 1;
    this.methodName = this.testName;
    this.expectedCallLine = { lineNo: 15,
                              text: "my ($a, $b, $c) = " + this.methodName + "($a);"};
    this._createView(this.PTCV_01_Ready.bind(this));
},

PerlTests_ExtractMethod_07: function PerlTests_ExtractMethod_07() {
    // top-level code
    this.lang = "Perl";
    var code, code_crlf;
    this.text = this.code_perl_vars_04.join("\n");
    this.data = {start_pt: [5, 0],
                 end_pt:   [11, 8]};
    this.testName = "PerlTests_ExtractMethod_07";
    this.inVars = ["$a", "$b"];
    this.outVars = ["$a", "$b", "$c"];
    this.firstUseOutVars = ["$a", "$b", "$c"];
    this.expectedVariables = { "$a":0x6c, "$b":0x6c , "$c":0x4c};
    this.expectedNewSelStartPos = [5, 0];
    this.expectedNewEndStartPos = [15, 0];
    this.expectedSectionLineStart = 1;
    this.methodName = this.testName;
    this.allowNoSection = true;
    this.expectedCallLine = { lineNo: 16,
                              text: "my ($a, $c) = " + this.methodName + "($a, $b);"};
    this._createView(this.PTCV_01_Ready.bind(this));
},

PerlTests_ExtractMethod_08: function PerlTests_ExtractMethod_08() {
    // top-level code
    this.lang = "Perl";
    var code, code_crlf;
    this.text = this.code_perl_parallel_08.join("\n");
    this.data = {start_pt: [9, 0],
                 end_pt:   [11, 34]};
    this.testName = "PerlTests_ExtractMethod_08";
    this.inVars = ["$abc1"];
    this.outVars = ["$def22", "$ghi3", "$jkl4"];
    this.firstUseOutVars = ["$ghi3", "$jkl4"];
    this.expectedVariables = { "$abc1":0x24, "$def22":0xcc , "$ghi3":0x4c, "$jkl4":0x4c};
    this.expectedNewSelStartPos = [3, 0];
    this.expectedNewEndStartPos = [11, 0];
    this.expectedSectionLineStart = 1;
    this.methodName = this.testName;
    this.allowNoSection = true;
    this.expectedCallLine = { lineNo: 17,
                              text: "my ($def22, $ghi3, $jkl4) = " + this.methodName + "($abc1);"};
    this._createView(this.PTCV_01_Ready.bind(this));
},

PerlTests_ExtractMethod_09: function PerlTests_ExtractMethod_09() {
    // top-level code
    this.lang = "Perl";
    var code, code_crlf;
    this.text = this.code_perl_parallel_09.join("\n");
    this.data = {start_pt: [11, 0],
                 end_pt:   [13, 13]};
    this.testName = "PerlTests_ExtractMethod_09";
    this.inVars = ["$abc1"];
    this.outVars = ["$def22"];
    this.firstUseOutVars = [];
    this.expectedVariables = { "$abc1":0x26, "$def22":0xcc};
    this.expectedNewSelStartPos = [3, 0];
    this.expectedNewEndStartPos = [11, 0];
    this.expectedSectionLineStart = 1;
    this.methodName = this.testName;
    this.allowNoSection = true;
    this.expectedCallLine = { lineNo: 19,
                              text: "my $def22 = " + this.methodName + "($abc1);"};
    this._createView(this.PTCV_01_Ready.bind(this));
},

PerlTests_ExtractMethod_10: function PerlTests_ExtractMethod_10() {
    // single-line method extraction
    this.lang = "Perl";
    var code, code_crlf;
    this.text = this.code_perl_parallel_09.join("\n");
    this.data = {start_pt: [14, 0],
                 end_pt:   [14, 16]};
    this.testName = "PerlTests_ExtractMethod_10";
    this.inVars = ["$ghi3", "$def22"];
    this.outVars = ["$def22"];
    this.firstUseOutVars = [];
    this.expectedVariables = { "$ghi3":0x26, "$def22":0x6e};
    this.expectedNewSelStartPos = [3, 0];
    this.expectedNewEndStartPos = [10, 0];
    this.expectedSectionLineStart = 1;
    this.methodName = this.testName;
    this.allowNoSection = true;
    this.expectedCallLine = { lineNo: 19,
                              text: "my $def22 = " + this.methodName + "($def22, $ghi3);"};
    this._createView(this.PTCV_01_Ready.bind(this));
},
        
        
boolToTestStatus: function(res) {
    return res ? "PASS" : "FAIL";
},

logResult : function(status) {
    var cell = newListRow.childNodes[1];
    cell.setAttribute('label', "");

    cell = newListRow.childNodes[3];
    cell.setAttribute('label', status);
    
    widgets.resultList.ensureElementIsVisible(newListRow);
},

showVariableUsage: function(x) x & 0xff,

compareVariables: function compareVariables(variables) {
    var receivedVariables = {};
    var expectedVariables = this.expectedVariables;
    variables.forEach(function(v) {
        receivedVariables[v.name] = v.flags;
        //dump("Received var " + v.name + ", flags: " + v.flags + "\n");
        //dump("   posn: " + (v.flags >> 8) + "\n");
        //dump("   flag: 0x" + (v.flags & 0xff).toString(16) + "\n");
    })
    var receivedNames = Object.keys(receivedVariables);
    var expectedNames = Object.keys(expectedVariables);
    //dump("variables keys: " + Object.keys(variables) + "\n");
    //dump("variables raw: " + variables + "\n");
    receivedNames.sort();
    expectedNames.sort();
    var lim = receivedNames.length;
    if (lim != expectedNames.length) {
        log.debug("\nreceivedNames.length:" + receivedNames.length
                  + " (" + receivedNames + ")"
                  + " != \nexpectedNames.length:" + expectedNames.length
                  + " (" + expectedNames + ")\n");
        return false;
    }
    ////////for (var i = 0; i < lim; i++) {
    ////////    var name = receivedNames[i];
    ////////    dump("Expected posn for "
    ////////         + name
    ////////         + ":"
    ////////         + this.expectedDefPositions[name]
    ////////         + ", got: "
    ////////         + (receivedVariables[name] >> 8)
    ////////         + "\n");
    ////////}
    for (var i = 0; i < lim; i++) {
        var name = receivedNames[i];
        if (name != expectedNames[i]) {
            log.debug("var name[" + i + "] mismatch: received: "
                      + name
                      + ", expected: " + expectedNames[i]);
            return false;
        }
        if (this.showVariableUsage(expectedVariables[name])
            != this.showVariableUsage(receivedVariables[name])) {
            log.debug("var name " + name + ":, expected value 0x"
                      + this.showVariableUsage(expectedVariables[name]).toString(16)
                      + ", got 0x"
                      + this.showVariableUsage(receivedVariables[name]).toString(16)
                      );
            return false;
        }
        if (this.expectedDefPositions && name in this.expectedDefPositions) {
            var expectedDefPosn = this.expectedDefPositions[name];
            var receivedPosn = receivedVariables[name] >> 8;
            if (expectedDefPosn != receivedPosn) {
                log.debug("var name " + name + ":, expected posn: "
                          + expectedDefPosn
                          + ", got "
                          + receivedPosn
                          );
                return false;
            }
        }
    }
    return true;
},
    
_createView: function _createView(callback) {
    var cell = newListRow.childNodes[0];
    cell.setAttribute("label",
                      this.lang + ": " + (this.testName || "refac test"));
    cell = newListRow.childNodes[1];
    var view = gko.views.manager.currentView;
    var suffix = this.suffix_from_lang_name[this.lang];
    if (view) {
        var koDoc = view.koDoc;
        if (koDoc.language == this.lang) {
            var tempPath = this.fileSvc.makeTempName(suffix);
            if (koDoc.file && this.osPathSvc.dirname(tempPath) == koDoc.file.dirName) {
                view.scimoz.text = this.text;
                koDoc.save(true);
                cell.setAttribute("label", "Lexing code...");
                cell = newListRow.childNodes[2];
                cell.setAttribute("label", "Reusing " + koDoc.file.baseName);
                setTimeout(function(this_) {
                        this_.colorizer.bind(this_)(view, callback);
                }, 5000, this);
                return;
            }
        }
    }
    //dump("this.lang: " + this.lang+ ", suffix: " + suffix + "\n");
    cell.setAttribute("label", "Creating file...");
    var file = this.fileSvc.makeTempFile(suffix, 'w');
    file.puts(this.text);
    file.close();
    cell = newListRow.childNodes[2];
    cell.setAttribute("label", file.baseName);
    gko.views.manager.newViewFromURIAsync(file.URI,
                                         'editor',
                                         null,
                                         -1,
                                         callback);
},
__EOF__ : null
};
    
