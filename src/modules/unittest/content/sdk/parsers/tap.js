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
    
    // ./t/00_compile.t ...............................
    var suiteRx = /^([^\s].+?)\s\.\.\.+\s?$/;
    
    // ok 1 - test name
    var testRx = /^([\w\s]+?)\s(\d+)[\s-]+(.*)$/;

    const RESULT_OK = "ok";

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
            suite: "",
            lastEntry: null,
            parsingError: false
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
                if (line.substr(-4).substr(0,3) == "...") // gotta be careful, can have a space at the end
                {
                    match = line.match(suiteRx);
                    if (match)
                    {
                        session.suite = match[1];
                        session.lastEntry = null;
                        session.parsingError = false;
                        continue;
                    }
                }
                
                // Match entry, use substr first to reduce parsing cost
                if (["ok ", "not"].indexOf(line.substr(0,3)) !== -1)
                {
                    match = line.match(testRx);
                    if (match)
                    {
                        let [,result,nr,summary] = match;
                        let entry = {
                            uuid: uuid(),
                            summary: summary.replace(/(\w)[._-](\w)/g, (match, p1, p2)=>{return p1+" "+p2;}),
                            number: nr,
                            group: session.suite,
                            location: {
                                path: session.suite,
                                symbol: summary,
                                search: summary
                            },
                            data: {
                                message: ""
                            },
                            state: "done",
                            result: result == RESULT_OK ? "ok" : "not ok"
                        };
                        session.lastEntry = entry;
                        session.parsingError = false;
                        results[entry.uuid] = entry;
                        continue;
                    }
                }
                
                if (session.lastEntry && line.substr(0,2) == "# ")
                {
                    // Subtests are currently not supported
                    if (line.indexOf("# Subtest") === 0)
                    {
                        session.parsingError = false;
                        continue;
                    }
                    
                    if (line.indexOf("# Looks like") === 0)
                    {
                        session.parsingError =  {
                            uuid: uuid(),
                            summary: line.substr(2),
                            group: session.suite,
                            data: {
                                message: ""
                            },
                            state: "done",
                            result: "error"
                        };
                        results[session.parsingError.uuid] = session.parsingError;
                        continue;
                    }
                    
                    session.lastEntry.data.message += line.substr(2) + "\n";
                    session.parsingError = false;
                    results[session.lastEntry.uuid] = session.lastEntry;
                    continue;
                }
                
                if (session.parsingError && (line.startsWith("Dubious") || line.startsWith("Failed")))
                {
                    session.parsingError.data.message += line + "\n";
                    results[session.parsingError.uuid] = session.parsingError;
                }
            }
            
            return results;
        };
        
    };
    
    init();
    
}).apply(self);
