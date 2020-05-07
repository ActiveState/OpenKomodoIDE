---
title: Editor Hyperlinks
---
Komodo can interpret certain strings in the buffer as hyperlinks. 'Ctrl'+'mouse hover' ('Cmd'+'mouse hover' on macOS) underlines the link. 'Ctrl'+'mouse click' performs an action specific to the type of hyperlink selected.

There are three default hyperlink types:

<a name="hyperlinks_definition" id="hyperlinks_definition"></a>
## Go to Definition (Komodo IDE only)
Code objects such as classes, methods, and subroutines link to their definition. This uses the built-in [Go to Definition](editor.html#go_to_def) feature.

![Go to Definition Hyperlinks](/images/hyperlinks_definition.png)

<a name="hyperlinks_url" id="hyperlinks_url"></a>
## URLs

HTTP, HTTPS and FTP URLs are opened in the browser configured in [Web & Browser](prefs.html#web) preferences.

![URL Hyperlinks](/images/hyperlinks_url.png)

<a name="hyperlinks_color" id="hyperlinks_color"></a>
## Colors

'Ctrl/Cmd'+'mouse hover' over a color value in CSS (including CSS embedded in HTML) shows a pop-up swatch for the selected color. 'Ctrl/Cmd'+'mouse click' raises a color picker dialog box for choosing and inserting a new color. Colors are inserted in RGB hexadecimal notation (e.g. "#ff0000" for red).

![CSS Color Hyperlinks](/images/hyperlinks_color.png)

<a name="hyperlinks_custom" id="hyperlinks_custom"></a>
## Custom

You can define your own hyperlinks using the `ko.hyperlinks` functions in the Komodo JavaScript API.

For example, the following userscript will match the given pattern and when clicked, will try to open the URL "http://foo.com/$1", where $1 is the regular expression match group 1. You can use $0 through to $9.

```
var pepUrl = "http://www.python.org/dev/peps/pep-";
var PEPRegexHandler = new ko.hyperlinks.RegexHandler(
      "Python Enhancement Proposals",
      new RegExp("PEP:\\s(\\d{4})"),            /* pattern to match */
      /* action function - called as 'fn(regexmatch)' */
      function(match) { ko.browse.openUrlInDefaultBrowser(pepUrl + match[1]); },
      null,  /* replacement string */
      /* which languages the handler is active in - 'null' for all */
      ['Python', 'Text', 'HTML'],
      Components.interfaces.ISciMoz.INDIC_PLAIN,
      RGB(0x60,0x90,0xff));                     /* indicator color */
ko.hyperlinks.addHandler(PEPRegexHandler);

```

You can set a [userscript trigger](macros.html#triggers_userscript) to set up this handler when Komodo starts.

Hyperlink handlers are checked in the order they were originally added. Since the built-in "Go to Definition" handler matches quite a few patterns, it may be necessary to preempt it by reordering the handlers. To do this, replace the last line of the userscript above with the following:

```
var gotoHandler = ko.hyperlinks.getHandlerWithName("Goto Defintion");
ko.hyperlinks.removeHandler(gotoHandler);
ko.hyperlinks.addHandler(PEPRegexHandler);
ko.hyperlinks.addHandler(gotoHandler);

```
