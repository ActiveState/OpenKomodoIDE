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
    
    var keyvalueRx = /\s(\w+)='(.*?[a-z0-9._ -])'/ig;

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
            mapping: {}
        };
        
        this.parse = (input) =>
        {
            return this.parsePartial(input);
        };
        
        this.parsePartial = (input) =>
        {
            var results = {};
            var touched = {};
    
            var lines = input.split(/\r\n|\n/);
            for (let line of lines)
            {
                // Skip empty lines
                if ( ! line)
                    continue;
                
                if (line.indexOf("##teamcity") !== 0)
                    continue;

                line = line.substr(10); // strip ##teamcity
                
                let data = {};
                let firstSpace = line.indexOf(" ");
                data.action = line.substr(1, firstSpace-1);
                
                let match = keyvalueRx.exec(line);
                while (match)
                {
                    let [,key,value] = match;
                    data[key] = value;
                    match = keyvalueRx.exec(line);
                }
                
                let entry;
                switch (data.action)
                {
                    case "testSuiteStarted":
                        session.suite = data.name;
                        break;
                    case "testSuiteFinished":
                        session.suite = null;
                        break;
                    case "testStarted":
                        //console.log("Saving: " + session.suite + data.name);
                        let locationUri;
                        if (data.locationHint)
                            locationUri = data.locationHint.split("::").slice(0,1)[0];
                        entry = {
                            uuid: uuid(),
                            summary: data.name.replace(/[._-]/g, ' '),
                            group: session.suite,
                            location: {
                                path: locationUri ? locationUri.substr(locationUri.indexOf("://")+3) : "",
                                symbol: data.name,
                                search: data.name
                            },
                            state: "running",
                            result: ""
                        };
                        session.mapping[session.suite + data.name] = entry;
                        touched[entry.uuid] = true;
                        results[entry.uuid] = entry;
                        break;
                    case "testFinished":
                        entry = session.mapping[session.suite + data.name];
                        if ( ! entry)
                            console.log("Failed: " + session.suite + data.name);
                        if (entry.state != "done")
                        {
                            entry.state = "done";
                            entry.result = "ok";
                            entry.duration = data.duration;
                            
                            if ( ! (entry.uuid in touched))
                                results[entry.uuid] = entry;
                        }
                        break;
                    case "testFailed":
                        entry = session.mapping[session.suite + data.name];
                        if ( ! entry)
                            break;

                        entry.state = "done";
                        entry.result = "not ok";
                        
                        if ( ! data.expected)
                            entry.result = "error";
                        
                        entry.data = {
                            expected: data.expected,
                            actual: data.actual,
                            message: data.message,
                            details: data.details ? data.details.replace(/\|n/g, "\n") : null
                        };
                        
                        if ( ! (entry.uuid in touched))
                            results[entry.uuid] = entry;
                        break;
                }
            }
            
            return results;
        };
        
    };
    
    init();
    
}).apply(self);
