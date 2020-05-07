var self = null;
var type =  null;
if (typeof module != "undefined") // jetpack
{
    self = module.exports;
    type = "module";
}
else // web worker
{
    self = this;
    type = "worker";
}

(function() {
    
    // --- FAIL: TestReplacePlaceholder (0.00s)
    var testRx = /^--- ([A-Z]+): (.*?) \((\d+\.\d+s)\)$/;
    
    // terminal_test.go:25: expected: echo '  foox'\''bar baz', actual: echo '  foo'\''bar baz'
    var resultRx = /^(\w+\.go):(\d+): expected:\s(.*?), actual: (.*)$/;

    var colorRx = /\[\d{0,2}m/g;

    const RESULT_OK = "PASS";

    const RESULT_NOTOK = "FAIL";

    var init = () =>
    {
        if (type != "worker")
            return;

        var parser = new this.parser();

        this.addEventListener('message', (e) =>
        {
            this.postMessage(parser.parsePartial(e.data));
        });
    };

    var uuid = () =>
    {
        // Credit: http://stackoverflow.com/a/2117523
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) =>
        {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    };

    this.parser = function()
    {
        var session = {
            lastEntry: null
        };
        
        this.parse = (input) =>
        {
            return this.parsePartial(input);
        };
        
        this.parsePartial = (input) =>
        {
            var results = {};
    
            var match;
            var lines = input.split(/\r\n|\n/);
            for (let line of lines)
            {
                // Skip empty lines
                if ( ! line)
                    continue;
                
                // Match suite
                if (line.substr(0,3) == "---") 
                {
                    match = line.match(testRx);
                    if (match)
                    {
                        let [,result, summary, duration] = match;
                        let entry = {
                            uuid: uuid(),
                            summary: summary.replace(/[._-]/g, ' '),
                            duration: duration,
                            location: {
                                symbol: summary,
                                search: summary
                            },
                            data: {
                                message: ""
                            },
                            state: "done",
                            result: result == RESULT_OK ? "ok" : "not ok"
                        };
                        results[entry.uuid] = entry;
                        session.lastEntry = entry;
                    }
                }
                
                if (line.substr(0,1) == "\t")
                {
                    line = line.trim().replace(colorRx, '');
                    session.lastEntry.data.message += line + (line.length ? "\n" : "");
                    
                    match = line.match(resultRx);
                    if (match)
                    {
                        let [, file, line, expected, actual] = match;
                        session.lastEntry.location.path = file;
                        session.lastEntry.location.line = line;
                        session.lastEntry.data.expected = expected;
                        session.lastEntry.data.actual = actual;
                    }
                    
                    results[session.lastEntry] = session.lastEntry;
                }
            }
            
            return results;
        };
        
    };
    
    init();

}).apply(self);
