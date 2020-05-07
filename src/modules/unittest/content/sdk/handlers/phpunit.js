(function() {
    
    const koFile  = require("ko/file");
    const log   = require("ko/logging").getLogger("unittest-frameworks-phpunit");
    const customHandler = require("unittest/handlers/custom");
    
    this.handler = require("unittest/unittest").getHandler("phpunit");
    
    this.run = customHandler.run.bind(this);
    
    this.parseXml = (path) =>
    {
        var realPath = null;
        
        // Path can be the actual phpunit.xml path or the parent directory (cwd)
        if ( ! koFile.isFile(path))
        {
            var variations = ["phpunit.xml", "phpunit.xml.dist"];
            
            for (let variation of variations)
            {
                let _path = koFile.join(path, variation);
                if (koFile.exists(path))
                {
                    realPath = _path;
                    break;
                }
            }
        }
        else
            realPath = path;
        
        if ( ! realPath)
            return false;
        
        var contents;
        try
        {
            contents = koFile.read(realPath);
        } catch (e)
        {
            log.exception(e);
            return false;
        }
        
        // Parse the XML
        var parser = new DOMParser();
        var dom = parser.parseFromString(contents, "text/xml");
        
        // Parse the available suites
        var suites = [];
        for (let suite of dom.querySelectorAll("testsuite"))
        {
            let _suite = {};
            _suite.name = suite.getAttribute("name");
            
            let directory = suite.querySelector("directory");
            if (directory)
                _suite.directory = directory.textContent;
        }
        
        return {
            suites: suites
        };
    };
    
}).apply(module.exports);