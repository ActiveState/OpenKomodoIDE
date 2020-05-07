// Copyright (c) 2003-2009 ActiveState Software Inc.
// See the file LICENSE.txt for licensing information.
//
// See comment at top of rxx_python.py for a description of the Rx protocol
//
// rx matching in JavaScript

function Evaluator(requestString) {
    //JSON is built in to mozilla js 1.9.1
    if (requestString[0] != "(") {
        requestString = "(" + requestString + ")";
    }
    try {
        requestPacket = JSON.parse(requestString);
    } catch(ex) {
        requestPacket = eval(requestString);
    }
    this.op = requestPacket['operation'];
    this.pattern = requestPacket['pattern'];
    this.options = requestPacket['options'];
    this.subjectText = requestPacket['text'];
    this.requestPacket = requestPacket;
}

Evaluator.prototype = {
    initialize: function (requestString) {},
    
    init: function() {
        this.regex = this.compile();
    },
    
    _undefinedBlock: {
                    name: null,
                    value: null,
                    span: [-1, -1]
                },
    
    _groups_from_match_obj: function(matchData, inputPos) {
        if (typeof(inputPos) == "undefined") inputPos = 0;
        var inputText = this.subjectText;
        var matchedPos = 0;
        // heuristic
        var groups = [
            {
                name: null,
                value: matchData[0],
                span: [matchData.index,
                       matchData.index + matchData[0].length]
            }
        ];
        var res;
        var len = matchData.length;
        for (var i = 1; i < len; i++) {
            var s = matchData[i];
            if (s === undefined) {
                res = this._undefinedBlock;
            } else {
                var pos = inputText.indexOf(s, matchedPos);
                if (pos == -1) {
                    // perhaps we need to go backwards (e.g. nested groups)
                    pos = inputText.lastIndexOf(s, matchedPos);
                }
                if (pos == -1) {
                    res = this._undefinedBlock;
                } else {
                    res = {
                        name: null,
                        value: s,
                        span: [
                            pos, pos + s.length
                        ]
                    }
                }
            }
            groups.push(res);
            matchedPos = pos + (s === undefined ? 0 : s.length);
        }
        return groups;
    },
    
    run: function() {
        var res = (this["do_" + this.op])();
        res['operation'] = this.op;
        res['lastGroupNames'] = []; // Not available in JS
        return res;
    },
    
    compile: function() {
        var options = ((["matchAll", "replaceAll"].indexOf(this.op) != -1)
                       ? (this.options + "g" ) : this.options);
        var multiline;
        var idx = options.indexOf('m');
        if (idx >= 0) {
            options = options.substr(0, idx) + options.substr(idx + 1);
            multiline = true;
        } else {
            multiline = false;
        }
        var re = new RegExp(this.pattern, options);
        RegExp.multiline = multiline;
        return re;
    },
    
    _do_match_helper: function(inputPos) {
        var m = this.regex.exec(this.subjectText);
        if (m) {
            return this._groups_from_match_obj(m, inputPos);
        } else {
            return null;
        }
    },
    
    do_match: function() {
        var res = this._do_match_helper(0);
        if (res) {
          var groups = [res]
          return {
            'status':'ok',
            'result': groups,
            'lastNumGroups': res.length - 1
          }
        } else {
          return { 'status':'matchFailure' } 
        }
    },
    
    do_matchAll: function() {
        var groups = [];
        var text = this.subjectText;
        var inputPos = 0;
        var m;
        var myArray;
        // this.regex has a global option on it
        while ((m = this.regex.exec(this.subjectText)) != null) {
            var groupObj = this._groups_from_match_obj(m, RegExp.lastIndex);
            groups.push(groupObj);
        }
        var lastNumGroups = groups.length ? groups[groups.length - 1].length - 1 : 0;
        return {
            'status':'ok',
            'result': groups,
            'lastNumGroups': lastNumGroups
        };
    },

    do_split: function() {
        return {
          'status':'ok',
          'result': this.subjectText.split(this.regex)
        };
    },

    _replace_helper: function(res) {
        var replacement = this.requestPacket.replacement;
        try {
            res.replacedText = this.subjectText.replace(this.regex, replacement);
            return true;
        } catch(ex) {
            res.status = 'matchError';
            res.exception = ex.toString();
            return false;
        }
    },

    do_replace: function() {
        var res = this.do_match();
        if (res['status'] != 'ok') {
            return res;
        }
        if (!this._replace_helper(res)) {
            return res;
        }
        // For now, leave this empty
        res['substitutions'] = [];
        return res;
    },

    do_replaceAll: function() {
        var res = this.do_matchAll();
        if (res['status'] != 'ok') {
            return res;
        }
        if (!this._replace_helper(res)) {
            return res;
        }
        //TODO: Add substitutions
        res.substitutions = [];
        return res
    },
    
  __NULL__: "swallow trailing comma"
} // end Evaluator

function main(requestString) {
    if (typeof(requestString) == "undefined") requestString = null;
    if (!requestString) {
        var s;
        var parts = [];
        while (true) {
            s = readline();
            if (s === null) {
                break;
            }
            parts.push(s);
        }
        requestString = parts.join("\n");
    }
    try {
        var evaluator = new Evaluator(requestString);
        evaluator.init();
    } catch(ex) {
        return {
            status: 'matchError',
            exception: ex.toString()
        }
    }
    return evaluator.run();
}

/*
var packets = [
{
    'text': 'école',
    'pattern': '(\\w)(\\w)',
    'operation': 'match',
    'options': 'm'
}, {
    'text': ';!@Lang@!UTF-8! Lannng Lanng b',
    'pattern': 'La(n+)g',
    'operation': 'matchAll',
    'options': 'm'
}, {
    'text': ';!@Lang@!UTF-8! Lannng Lanng b',
    'pattern': 'La(n+)g',
    'operation': 'split'
}, {
      'text': 'école',
      'pattern': '(\\w)(\\w)',
      'operation': 'replace',
      'replacement': '<<[$2]v[$1]>>'
},{
    'text': ';!@Lang@!UTF-8! Lannng Lanng b',
    'pattern': 'La(n+)g',
    'operation': 'replaceAll',
    'replacement': 'feesh26:$1',
    'options': 'i'
}];
var i, packet, str, responsePacket, jsonResult;
for (i = 0; i < packets.length; i++) {
    packet = packets[i];
    str = JSON.stringify(packet);
    print(str + "\n");
    responsePacket = main(str);
    jsonResult = JSON.stringify(responsePacket);
    print(jsonResult + "\n");
    if (responsePacket.status == "matchError") {
        break;
    }
}
 */


var str = null;
// str = JSON.generate(packets[0])
var responsePacket = main(str);
var jsonResult = this.JSON.stringify(responsePacket)
print(jsonResult + "\n");

