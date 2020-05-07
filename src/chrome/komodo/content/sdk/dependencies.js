/**
 * **IDE ONLY**
 *
 *  This SDK provides an interface to retrieve dependency locations based on the
 *  System path and provided known default installation paths.
 * Prefs structure:
 * dependencies (prefset)
 * php (prefset)
 *   executables (ordered-pref - list of known executable names)
 *     - php
 *     - php-cli
 *     - ..
 *   paths (ordered-pref - list of known install paths)
 *     - /opt/php-5/
 *     - C:\PHP\
 *     - ..
 *   docs (string - url to docs)
 * ruby (prefset)
 *   ..
 * go (prefest)
 *
 * @module ko/dependencies
 * 
 */

(function()
{
    const {Cc, Ci, Cu}  = require("chrome");
    const prefs = require("ko/prefs");
    const sh = require("ko/shell");
    const log = require("ko/logging").getLogger("ko-dependencies");
    // log.setLevel(log.LOG_DEBUG);
    const sys = require("sdk/system");
    const kofile = require("ko/file");
    const platform = sys.platform;
    const pathSplitterReg = platform == "winnt" ? /;/g : /:/g;
    const pathSplitterStr = platform == "winnt" ? ';' : ':';
    
    /**
     * Get a list of paths found to house the requested dependencies
     *
     * @argument {String} dependency name of the dependency files to return
     *
     * @returns {Array}  List of paths to files
     */
    this.getDependencyPaths = dependency =>
    {
        log.debug("getDependencyPaths");
        let dependencies; // All of the dependencies
        if(prefs.hasPref("dependencies"))
        {
            dependencies = prefs.getPref("dependencies");
        }
        else
        {
            log.error("There are no dependecies.  You may need to reset your profile.");
            return;
        }
        
        let dependencyPref;
        if ( ! dependencies.hasPref(dependency))
        {
            log.warn("Dependency '"+dependency+"' doesn't exist.");
            return;
        }
        else
        {
            dependencyPref = dependencies.getPref(dependency);
        }
        
        let paths = [];
        if (dependencyPref.hasPref("paths"))
        {
            let knownPathsPref = dependencyPref.getPref("paths");
            for (let i = 0; i < knownPathsPref.length; i++)
            {   
                paths.push(knownPathsPref.getStringPref(i));
            }
        }
        
        let binaries = [];
        if (dependencyPref.hasPref("executables"))
        {
            let knownBinariesPref = dependencyPref.getPref("executables");
            for (let i = 0; i < knownBinariesPref.length; i++)
            {
                let path = parseEnvVars(knownBinariesPref.getStringPref(i));
                log.debug("path: "+path);
                binaries.push(path);
            }
        }
        let searchPaths = sh.getEnv().PATH.split(pathSplitterReg).concat(paths);
        
        return this.getBinaries(searchPaths, binaries, dependency);
    };

    // All this does right now is checks the path for an envvar, per platform
    //  and retreives that variable to pack it back into the path
    var parseEnvVars = (path) =>
    {   
        let reg = /(.*?)(%[\w_]*%)(.*)/;
        if (platform != "winnt")
        {
            reg = /(.*?)(\$)\{?([\w_]+)\}?(.*)/;
        }
        let matches = path.match(reg);
        if (! matches)
        {
            return path;
        }
        // If we're on Unix our match list will be length 5
        if (matches.length == 5){
            let [ignore, prefix, varPrefix, variable, postfix] = matches;
            matches = [ignore, prefix, varPrefix+variable, postfix];
        }
        let [ignore, prefix, variable, postfix] = matches;
        let value = sh.lookupVar(variable);
        return prefix+value+postfix;
    }
    
    var _getExistingConfig = (prefid) =>
    {
        // Does this user already have this pref set?
        // if yes then show the user and set it as the selected
        if (prefs.hasPref(prefId))
        {
             return prefs.getStringPref(prefId);
        }
    };

    /**
     * Looks for binaries per platform and returns a list of found
     * binaries. For Windows it appends `.exe`, for linux and OSX
     * it appends `.so` and then nothing.
     * 
     * @argument {Array} paths  Paths to search for binaries
     * @argument {Array} binaries  Binary file names
     *
     * @returns {Array} List of
     */
    this.getBinaries = (paths, files, dependency="") =>
    {
        var env = sh.getEnv();

        if (platform == "winnt")
        {
            if ("PATHEXT" in env)
                exts = env.PATHEXT.split(pathSplitterStr);
            else
                exts = [".EXE",".BAT",".CMD"];
        }
        else
            exts = ["", ".SH", ".BIN"];
        
        exts.join(",").toLowerCase().split(",").forEach( (ext) => {exts.unshift(ext);} );

        let results = [];
        for (let path of paths)
        {
            for (let file of files)
            {
                let filePath = kofile.join(path, file);
                if (platform == "winnt")
                    filePath = filePath.replace(/\\\\/g,"\\");
                else
                    filePath = filePath.replace(/\/\//g,"\/");

                for (let ext of exts)
                {
                    let candidate = filePath + ext;
                    if (kofile.exists(candidate))
                    {
                        if ( dependency.indexOf("python") >= 0 &&
                            ! _checkValidPythonInterpreter(candidate, dependency))
                        {
                            // This means we have a Python3 binary for Python2 dependency
                            // so don't use it, ya turkey.
                            continue;
                        }
                        else if (platform != "winnt" && ! kofile.isExecutable(candidate))
                        {
                            // For windows file polling is too slow, so we assume
                            // based on the extension that it is executable
                            continue;
                        }
                        else if ( ! _pathInList(results, candidate))
                        {
                            results.push(candidate);
                        }
                    }
                }
            }
        }
        return results;
    };
    
    var _pathInList = (paths, candidate) =>
    {
        for (let path of paths)
        {
            if (platform == "winnt")
            {
                if(candidate.toLowerCase() === path.toLowerCase())
                    return true;
            }
            else
            {
                if(candidate === path)
                    return true;
            }
        }
        return false;
    };
    
    var _checkValidPythonInterpreter = (exe, langName) =>
    {
        langName = langName[0].toUpperCase()+langName.substr(1);
        let pyAppInfoClass = "@activestate.com/koAppInfoEx?app=" + langName + ";1";
        var appInfoEx = Cc[pyAppInfoClass].getService(Ci.koIAppInfoEx);
        try
        {
            return appInfoEx.isSupportedBinary(exe);
        }
        catch(e)
        {
            return false;
        }
    };
    
   
}).apply(module.exports);
