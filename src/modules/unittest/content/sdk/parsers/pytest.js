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
    
    // tests/test_requests.py::test_sync PASSED
    var entryRx = /^(.*?)::(\w+?)\s([A-Z]+)$/;
    
    // FAIL tests/test_routes.py::test_static_routes
    var entryFailRx = /^([A-Z])+\s(.*?)::(\w+)$/; // cause why be consistent, pytest?

    // tests/test_requests.py:20: in test_sync
    var entryDetailsRx = /^(.*?):\d+: in (\w+)$/;

    // ==== short test summary info ====
    var stateRx = /^===+.*\s(\w+)\s=+$/;

    // ---- Captured stderr call ----
    var substateRx = /^---+\s([\w\s]+)\s-+$/;

    // 2016-11-07 15:47:32,840: INFO: Goin' Fast @ http://127.0.0.1:42101
    var stderrRx = /^.*?:\s/;

    // E     - OK1
    var expectedRx = /^E\s+\-(.*)$/;

    // E     + OK1foo
    var actualRx = /^E\s+\+(.*)$/;

    // E   AssertionError: False is not true
    var typedErrorRx = /^E\s+(\w+): (.*)$/;

    const RESULT_OK = "PASSED";
    const RESULT_NOTOK = "FAIL";
    const STATE_INFO = "info";
    const STATE_START = "starts";
    const STATE_FAILURES = "FAILURES";
    const SUBSTATE_DETAILS = "details";
    const SUBSTATE_STDERR = "Captured stderr call";

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
            mapping: {},
            state: null,
            subState: null,
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
                
                // Match the current state
                if (line.substr(0,3) == "===")
                {
                    session.subState = null;
                    match = line.match(stateRx);
                    if (match)
                    {
                        session.state = match[1];
                        continue;
                    }
                }

                // Match success entries
                if (session.state == STATE_START)
                {
                    match = line.match(entryRx);
                    if (match)
                    {
                        let [,suite,test,result] = match;
                        let entry = {
                            uuid: uuid(),
                            summary: test.replace(/[._-]/g, ' '),
                            group: suite,
                            location: {
                                path: suite,
                                symbol: test,
                                search: test
                            },
                            data: {
                                details: "",
                                stderr: ""
                            },
                            state: "done",
                            result: result == RESULT_OK ? "ok" : "not ok"
                        };
                        session.mapping[suite+test] = entry;
                        session.mapping[suite.replace(/::.*/, '')+test] = entry;
                        session.lastEntry = entry;
                        results[entry.uuid] = entry;
                    }
                }
                
                // Match failure entries
                if (session.state == STATE_INFO)
                {
                    match = line.match(entryFailRx);
                    if (match)
                    {
                        let [,result,suite,test] = match;
                        let matched = session.mapping[suite+test] || null;
                        
                        let entry = {
                            uuid: matched ? matched.uuid : uuid(),
                            summary: test.replace(/[._-]/g, ' '),
                            group: suite,
                            location: {
                                path: suite,
                                symbol: test,
                                search: test
                            },
                            data: {
                                details: "",
                                stderr: ""
                            },
                            state: "done",
                            result: "not ok" // Tests in this section are always a fail
                        };
                        session.mapping[suite+test] = entry;
                        session.mapping[suite.replace(/::.*/, '')+test] = entry;
                        session.lastEntry = entry;
                        results[entry.uuid] = entry;
                    }
                }
                
                // Match failure details
                if (session.state == STATE_FAILURES)
                {
                    // Match subsection start for failure details
                    if (line.substr(0,3) == "___")
                    {
                        session.subState = SUBSTATE_DETAILS;
                        session.lastEntry = null;
                        continue;
                    }
                    
                    // Match subsection start for stderr
                    if (line.substr(0,3) == "---")
                    {
                        match = line.match(substateRx);
                        if (match)
                        {
                            session.subState = match[1];
                            continue;
                        }
                    }
                    
                    // Parse details
                    if (session.subState == SUBSTATE_DETAILS)
                    {
                        if ( ! session.lastEntry)
                        {
                            match = line.match(entryDetailsRx);
                            if (match)
                            {
                                let [,suite,test] = match;
                                if ((suite + test) in session.mapping)
                                {
                                    session.lastEntry = session.mapping[suite + test];
                                }
                            }
                        }
                        else
                        {
                            let match1 = line.match(expectedRx);
                            let match2 = line.match(actualRx);
                            let match3 = line.match(typedErrorRx);
                            if (match1)
                                session.lastEntry.data.expected = match1[1];
                            else if (match2)
                                session.lastEntry.data.actual = match2[1];
                            else if (match3)
                                session.lastEntry.data[match3[1]] = match3[2];
                            else
                                session.lastEntry.data.details += line.trim() + "\n";
                                
                            results[session.lastEntry.uuid] = session.lastEntry;
                        }
                    }
                    
                    // Parse stderr
                    if (session.subState == SUBSTATE_STDERR && session.lastEntry)
                    {
                        session.lastEntry.data.stderr += line.replace(stderrRx, '') + "\n";
                    }
                }
            }
            
            return results;
        };
        
    };
    
    init();
    
}).apply(self);
