---
title: Syntax checker reference
---
Komodo's syntax checking system is extensible. Komodo internally calls syntax checkers "linters", so extensions will necessarily use that term as well.

<a name="linter_writing" id="linter_writing"></a>
## Writing a Linter

Linters must be written in Python, although the rest of the extension that contains them could be written in JavaScript.

The name of the linter's file doesn't matter. Komodo uses the convention `ko_Language_Linter.py`, but you aren't required to follow that scheme.

Each linter defines one Python class, and provides two methods:

```python
koILintResults lint(self, koILintRequest request)

koILintResults lint_with_text(self, koILintRequest request, AString text)
```

(`AString` is a string of Unicode characters that may contain null bytes.)

You will never call `lint` directly; Komodo does that for you, and will supply the request object. Most `lint` methods then simply call `lint_with_text` using the following sequence:

```python
def lint(self, request):
    encoding_name = request.encoding.python_encoding_name
    text = request.content.encode(encoding_name)
    return self.lint_with_text(request, text)
```

Before moving to the `lint_with_text` method, it's important to understand Komodo knows when to fire your linter. The key is in the registration code in the class header. The class header for CSS looks like so:

```python
class KoCSSLinter:
    _com_interfaces_ = [components.interfaces.koILinter]
    _reg_desc_ = "Komodo CSS Linter"
    _reg_clsid_ = "{F770CBE7-2AAF-492C-8900-CC512CAF5033}"
    _reg_contractid_ = "@activestate.com/koLinter?language=CSS;1"
    _reg_categories_ = [
         ("category-komodo-linter", 'CSS'),
         ]
```

At startup time, the class registers itself with the Komodo linter system via the `_reg_categories_` heading. This array always contains at least one two-value Python tuple. The first value is always `"category-komodo-linter"`. The second value in the tuple must be unique. Because this is the only CSS linter in Komodo, a value of "CSS" is acceptable. If you look in `koJavaScriptLinter.py`, you'll see category values like `JavaScript&type=jsShell` and `JavaScript&type=jslint`. To ensure uniqueness, third-party linters should use a category value of the form `languageName&type=com.mycompany:description`.

Komodo will figure out the language the linter supports by looking for all the text up to the "&type=" part. Note that language names **are*- case sensitive. If you're writing an extension for C++0x, the language name will have to match the upper-case "C" and lower-case "x", or the linter won't be invoked.

If you're writing extensions for two similar languages that happen to use the same syntax checker, you would add an additional category field for the second language. Suppose the two languages "Hekla" and "Krafla" have different code completion catalogs, but use the same syntax checker. Your linter class would then look like so:

```python
class KoIVLinter:
    _com_interfaces_ = [components.interfaces.koILinter]
    _reg_desc_ = "Komodo IV Linter"
    _reg_clsid_ = "{generate-with-unix-util-uuidgen}"
    _reg_contractid_ = "@mycompany.com/koLinter?language=IV;1" # not used
    _reg_categories_ = [
         ("category-komodo-linter", 'Hekla&type=mycompany.com:common IV linter'),
         ("category-komodo-linter", 'Krafla&type=mycompany.com:common IV linter'),
         ]
```

<a name="linter_collisions" id="linter_collisions"></a>
### Collisions

Suppose another company also writes a Komodo extension with a linter for "Hekla". Assuming they insert their own company name in the category field:

```python
_reg_categories_ = [
     ("category-komodo-linter", 'Hekla&type=bitterrival.com:Hekla linter'),
     ]
```

You don't need to worry: Komodo will run both linters, and show the combined results. Later you'll see how to use Komodo's preference system to control when a linter should fire or not.

<a name="linter_checking_syntax" id="linter_checking_syntax"></a>
## Checking syntax

The actual syntax checking is done in the `lint_with_text` method. Please consult the Komodo source code for an example. The key factors to follow are:

-   All linters fire in a background thread.
-   Write the passed text into a temporary file, and lint that.
-   Capture possible exceptions, and recover from them. Otherwise, the user will see a red "busy pencil" in the status bar, but will never get results.

That background thread note deserves elaboration. On the positive side, this means linters typically run during an idle period. On the negative side, if you have to access a front-end object, like the UI, you need to go through a proxy. You should also avoid accessing the scimoz editor object, even through a proxy object (direct access will crash Komodo). For one thing, because the linter runs in a background thread, the state of the scimoz object could change between the time the linter request was first set, and when it finally fires. Trying to do something like run `proxy(scimoz).colourise(0, -1)` has unpredictable results.

Komodo usually invokes an external process to do the actual syntax checking. Let's say your extension includes four versions of the `hekla` executable for running this:

-   `hekla.exe` for Windows,
-   `hekla`, a binary Darwin command-line utility for OSX,
-   separate `hekla`s for 32-bit and 64-bit Linux

These executables should be packaged in the following directory tree under your extension directory like so:

```bash
+- platform
   +- Darwin_x86-gcc3
      +- hekla
   +- Linux_x86-gcc3
      +- hekla
   +- Linux_x86_64-gcc3
      +- hekla
   +- WINNT_x86-msvc
      +- hekla.exe

```

Finding the executable is straightforward now. Getting the path to your extension is straightforward -- assume that it's called "hekla@mycompany.com" in the install.rdf.

```python
import directoryServiceUtils
dirList = [x for x in directoryServiceUtils.getExtensionDirectories()
           if x.endswith(os.path.sep + "hekla@mycompany.com")]
if len(dirList) != 1:
    raise BigProblemo()
xulRuntimeSvc = components.classes["@mozilla.org/xre/app-info;1"].\
    getService(components.interfaces.nsIXULRuntime)
platformName = "%s_%s" % (xulRuntimeSvc.OS, xulRuntimeSvc.XPCOMABI)
pathToExec = os.path.join(dirList[0], "platform", platformName, "hekla")
if sys.platform.startswith("win"):
    pathToExec += ".exe"

```

You would then invoke the linter with this code sequence:

```python
cmd = [pathToExec, _arg1_, _arg2_, tempFileName, _args..._]
p = process.ProcessOpen(cmd, cwd=cwd, stdin=None)
stdout, stderr = p.communicate()
# error messages are either in stdout or stderr, depending on the syntax checker
# try to avoid designing syntax checkers that write to both streams.
lines = (stdout or stderr).splitlines(0)
# process lines for errors...   see source for examples
```

<a name="linter_multi_lang" id="linter_multi_lang"></a>
## Multi-language Linting

If your extension implements an HTML template-like language like Django or Mason, the good news is that you hardly have any work to do at all. This does the job for most multi-language templates:

```python
def __init__(self):
    self._html_linter = koLintService.getLinterForLanguage("HTML")
    #...

def lint(self, request):
    return self._html_linter.lint(request)
```

The HTML Linter will find the "Hekla"-specific code in the template, and will invoke the `lint_with_text` method with a modified text field: The Hekla-specific content will be preserved, but any non-Hekla code will be converted to a space (with newlines being preserved).

If this doesn't work, you can always do your own template processing in the `lint` method, and call the separate sublanguage's `lint_with_text`. However, after having written linters for seven different multi-language languages, we were always able to have the HTML linter do this grunt work.

<a name="linter_control" id="linter_control"></a>
## Controlling Linting

So you've written a linter, successfully used the registration mechanism to get Komodo to invoke it, and while testing it already found a couple of areas that needed fixing in your own Hekla files. You push the extension to [http://komodoide.com/resources/](http://komodoide.com/resources/submit-instructions/#pane-resources), sit back, and wait for the attaboys.

And then you get an email from a user saying she loves the extension, but sometimes she needs to use bitterrival.com's Hekla linter, and it's confusing seeing the two sets of error messages in the editor window. Can she turn them off.

We'll assume you know how to add a preference to the Komodo system (see the Rails extension at [http://community.activestate.com/xpi/ruby-rails-extension](http://community.activestate.com/xpi/ruby-rails-extension) for an example if this is new). Assume you call the pref `lint-hekla:mycompany.com`. Your code should now check the `request.document.getEffectivePrefs()` to see if that pref is true, and return no results if it's false.

You might notice that when you toggle that pref in the Preference system, Komodo doesn't re-lint the text until you make a change. But you know when you change other prefs, like changing the Ruby interpreter path, Komodo does a rescan. You can get your preference to work the same way with one single line of JavaScript:

```javascript
ko.lint.addLintPreference("lint-hekla:mycompany.com", ["Hekla"]);
```

The second argument is a list of the languages that this preference pertains to. If you're also writing an extension for a new HTML template language called "Askja" which of course runs Hekla code on the server-side. In that case you would set the second arg to ["Hekla", "Askja"], so if the user changed the Hekla pref while editing an Askja document, it would still be relinted.

<a name="linter_aggregators" id="linter_aggregators"></a>
## Aggregators

When Komodo has more than one linter for a given language, by default it collects the results for each linter, and then returns the combined set. This is done through an _aggregator_. Usually you won't need to be concerned about this, but suppose you want more control over how an aggregator works.

For example, suppose that we are supplying three different linters for Hekla, which we'll call "H1", "H2", and "H3". If H1 finds any problems, we only want to show them. Do the same thing for H2, then H3, and if none of them find any problems, return the lint results for any other Hekla linters we might have. To do this, we need to tell Komodo that we're supplying our own aggregator, and then code it.

In this case, the linters like "H1" are called _terminals_, and are invoked directly by the aggregator.

The class would look like this:

```python
class KoHeklaCompileLinter(object):
    _reg_desc_ = "Komodo Hekla Aggregate Linter"
    _reg_clsid_ = "{generate-with-unix-util-uuidgen}"
    _reg_contractid_ = "@activestate.com/koLinter?language=Hekla&type=Aggregator;1"
    _reg_categories_ = [
         ("category-komodo-linter-aggregator", 'Hekla'),
         ]

    def __init__(self):
        self._koLintService = UnwrapObject(self._koLintService)

    # This is the same -- the "terminal" linters' lint method isn't used.
    def lint(self, request):
        encoding_name = request.encoding.python_encoding_name
        text = request.content.encode(encoding_name)
        return self.lint_with_text(request, text)

    def idx_from_linter_name(self, cids, name):
        # This might not be exactly what we want, but it is an example
        for i in range(len(cids)):
            if name in cids[i]:
                return i
        return -1

    def lint_with_text(self, request, text):
        # Your basic aggregator....
        linters = [UnwrapObject(x) for x in
                       self._koLintService.getTerminalLintersForLanguage("Hekla")]
        # Now find our linters
        h1_name = "type=H1"
        h2_name = "type=H2"
        h3_name = "type=Wally"  # there's one in every crowd
        # Here's where we use the contract_id's
        contract_ids = [x._reg_contractid_ for x in linters]
        for name in (h1_name, h2_name, h3_name):
            idx = self.idx_from_linter_name(contract_ids, name)
            if idx >= 0:
                results = linters[idx].lint_with_text(request, text)
                if results.getNumResults():
                    return results
                del linters[idx]

        # Check remaining linters
        finalLintResults = koLintResults()
        for linter in linters:

            newLintResults = linter.lint_with_text(request, text)
            if newLintResults and newLintResults.getNumResults():
                if finalLintResults.getNumResults():
                    finalLintResults = finalLintResults.addResults(newLintResults)
                else:
                    finalLintResults = newLintResults
        return finalLintResults
```

The key is that `category-komodo-linter-aggregator` category. This tells Komodo that we're going to override Komodo's generic aggregator. There currently is no public method to create a generic aggregator for a specific language, but you could do it with an unwrapped `koLintService` object:

```python
aggregator = components.classes[koLintService.GENERIC_LINTER_AGGREGATOR_CID].createInstance(components.interfaces.koILinter)
UnwrapObject(aggregator).initialize(languageName, koLintService)
```
