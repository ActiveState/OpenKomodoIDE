/**
 * Based on Code provided by Gaurang Tandon
 * http://codegolf.stackexchange.com/a/21525
 */

var languages = {};

(function()
{

    var checked = {};

    var calcScore = function(input, patterns)
    {
        var score = 0,
            multiplier,
            pattern;

        for (var i=0;i<patterns.length;i++)
        {
            multiplier = 1;
            pattern = patterns[i];

            if (Array.isArray(pattern))
            {
                multiplier = pattern[1];
                pattern = pattern[0];
            }

            var match = input.match(pattern);

            if ( ! match) continue;

            score += (match.length * multiplier);
        }

        return score;
    }

    var checks = {

        clike: function(input)
        {
            var score = 0;

            var patterns = [

                // Java
                /class[\s\n]+[\w$]+[\s\n]*\{/,
                /public[\s\n]+static[\s\n]+void[\s\n]+main[\s\n]*/,
                /\}[\s\n]*\}[\s\n]*$/,
                /System[\s\n]*[.][\s\n]*out/,

                // C
                /^#include\s+<[\w.]+>\s*\n/,
                /main[\s\n]*\([\s\n]*(void)?[\s\n]*\)[\s\n]*\{/,
                /printf[\s\n]+\(/,
                /#include\s+<[\w.]+>\s*\n/,
                /(%c|%f|%s|%d)/
            ];

            return calcScore(input, patterns);
        },

        php: function(input)
        {
            var patterns = [
                [/\<\?php/, 999],
                /\?>/,
                /echo/,
                /public\s?function/,
                /private\s?function/,
                /protected\s?function/,
                /static\s?function/,
                /$[\w]+\s*=\s*/
            ];

            return calcScore(input, patterns);
        },

        htmlmixed: function(input)
        {
            if (checked.php) return 0;

            var patterns = [
                /<!DOCTYPE ["' \w:\/\/]*>/,
                /<html>/,
                /<body>/,
                /<head>/,
                /<div>/,
                /<section>/,
                /<img>/
            ];

            return calcScore(input, patterns);
        },

        javascript: function(input)
        {
            if (checked.htmlmixed) return 0;

            var patterns = [
                /console[\s\n]*[.][\s\n]*log[\s\n*]\(/,
                /alert[\s\n*]\(/,
                /[\s\n]*var[\s\n]+/,
                /[\s\n]*let[\s\n]+/,
                /[\s\n]*function[\s\n]+[\w]+[\s\n]+\(/,
                /(?:\:|=)\s\?function/,
                /document[\s\n]*[.]/,
                /\/\*\*/
            ];

            return calcScore(input, patterns);
        },

        css: function(input)
        {
            if (checked.htmlmixed) return 0;

            var patterns = [
                /[a-zA-Z]+[\s\n]*\{[\w\n]*[a-zA-Z\-]+[\s\n]*:/,
                /color:/,
                /height:/,
                /width:/,
                /#[a-zA-Z]+[\s\n]*\{[\w\n]*[a-zA-Z\-]+[\s\n]*:/,
                /[.][a-zA-Z]+[\s\n]*\{[\w\n]*[a-zA-Z\-]+[\s\n]*:/,
                /\/\*/
            ];

            return calcScore(input, patterns);
        },

        shell: function(input)
        {
            var patterns = [
                [/#!\/bin\/bash/, 999],
                [/#!\/bin\/sh/, 999]
            ];

            return calcScore(input, patterns);
        }
    }

    this.detect = function(lang_input)
    {
        checked = {};

        var all_zero = true,
            highest = [0];

        for (var language in checks)
        {
            if ( ! checks.hasOwnProperty(language)) continue;

            checked[language] = checks[language](lang_input);
            if (checked[language] !== 0)
                all_zero = false;

            if (checked[language] > highest[0])
                highest = [checked[language],language];
        }

        if (all_zero)
        {
            //console.log("Language not caught!");
            return false;
        }

        return highest[1];
    }

    this.map = {};

    this.map.byTitle = {
        "APL": "apl", "Asterisk": "asterisk", "C": "clike", "C++": "clike",
        "Cobol": "cobol", "Java": "clike", "C#": "clike", "Scala": "clike",
        "Clojure": "clojure", "CoffeeScript": "coffeescript", "Common Lisp": "commonlisp",
        "Cypher": "cypher", "CSS": "css", "D": "d", "diff": "diff", "DTD": "dtd",
        "Dylan": "dylan", "ECL": "ecl", "Eiffel": "eiffel", "Erlang": "erlang",
        "Fortran": "fortran", "F#": "mllike", "Gas": "gas", "Gherkin": "gherkin",
        "GitHub Flavored Markdown": "gfm", "Go": "go", "Groovy": "groovy",
        "HAML": "haml", "Haskell": "haskell", "Haxe": "haxe", "ASP.NET": "htmlembedded",
        "Embedded Javascript": "htmlembedded", "JavaServer Pages": "htmlembedded",
        "HTML": "htmlmixed", "HTTP": "http", "Jade": "jade", "JavaScript": "javascript",
        "JSON": "javascript", "JSON-LD": "javascript", "TypeScript": "javascript",
        "Jinja2": "jinja2", "Julia": "julia", "Kotlin": "kotlin",
        "LESS": {file: "css", name: "text/x-less"}, "LiveScript": "livescript",
        "Lua": "lua", "Markdown": "markdown", "mIRC": "mirc", "Modelica": "modelica",
        "Nginx": "nginx", "NTriples": "ntriples", "OCaml": "mllike", "Octave": "octave",
        "Pascal": "pascal", "PEG.js": "pegjs", "Perl": "perl",
        "PHP": "php", "Pig": "pig", "Plain Text": "null",
        "Properties files": "properties", "Python": "python",
        "Puppet": "puppet", "Cython": "python", "R": "r", "reStructuredText": "rst",
        "Ruby": "ruby", "Rust": "rust", "Sass": "sass", "Scheme": "scheme",
        "SCSS": {file: "css", name: "text/x-scss"}, "Shell": "shell",
        "Sieve": "sieve", "Slim": "slim", "Smalltalk": "smalltalk", "Smarty": "smarty",
        "SmartyMixed": "smartymixed", "Solr": "solr", "SPARQL": "sparql", "SQL": "sql",
        "MariaDB": "sql", "sTeX": "stex", "LaTeX": "stex", "SystemVerilog": "verilog",
        "Tcl": "tcl", "TiddlyWiki ": "tiddlywiki", "Tiki wiki": "tiki", "TOML": "toml",
        "Turtle": "turtle", "VB.NET": "vb", "VBScript": "vbscript",
        "Velocity": "velocity", "Verilog": "verilog", "XML": "xml", "XQuery": "xquery",
        "YAML": "yaml", "Z80": "z80",
    };

    this.map.byExt = {
        rb: 'Ruby', py: 'Python', pl: 'Perl', php: 'PHP', go: 'Go',
        xml: 'XML', html: 'HTML', htm: 'HTML', css: 'css',
        less: 'LESS', scss: 'SCSS', js: 'JavaScript', vbs: 'VBScript',
        lua: 'Lua', java: 'Java', cpp: 'C++', cc: 'C',
        sql: 'SQL', sm: 'Smalltalk', diff: 'diff', bash: 'Shell',
        sh: 'Shell', erl: 'Erlang', hs: 'Haskell', md: 'Markdown',
        txt: 'Plain Text', coffee: 'CoffeeScript', json: 'JSON'
    };

}).apply(languages);
