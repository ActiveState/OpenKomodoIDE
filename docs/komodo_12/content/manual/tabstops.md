---
title: Tabstops
---
Tabstops are highlighted placeholders for inserting content in [snippets](snippets.html) and [templates](templates.html). Tabstops with the same number are linked, and will mirror the content inserted in the first one. When tabstops are present in the buffer, the tab key moves the cursor through the tabstops instead of inserting a whitespace tab.

<a name="tabstop_create" id="tabstop_create"></a>
## Creating Tabstops

Tabstops are set in snippets and templates using a similar syntax to [bracketed interpolation shortcuts](shortcuts.html#shortcuts_brack). The simplest type just provides a placeholder for inserting text:

```
[[%tabstop]]
```

Adding a colon followed by any string provides a default value (or just a helpful name):

```
[[%tabstop:myValue]]
```

Numbered tabstops are linked together in the buffer. Text replacements in one numbered tabstop will be replicated in tabstops with the same number. Linked tabstops should use the same default string or omit the default string once it's been defined in the first linked tabstop:

```
print <<"[[%tabstop1:EOT]]";
  [[%tabstop:TextHere]]
[[%tabstop1]]
```

Tabstops can be nested within other tabstops:

```
def [[%tabstop1:method]](self[[%tabstop2:, ARGS]]):[[%tabstop:
    [[%tabstop1]].__init__(self[[%tabstop2]])]]
    [[%tabstop:pass]]
```

<a name="tabstop_usage" id="tabstop_usage"></a>
## Using Tabstops

When the snippet or template is inserted or loaded in the buffer, the tabstops will show the default text (i.e. specified after the colon) highlighted in the buffer. Hitting the **Tab** key cycles the cursor through the tabstops in the order they appear in the snippet or template (not in numbered order).

With the cursor on a tabstop, typing overwrites the default value (if defined). Hitting **Tab** again inserts the default value and moves to the next tabstop.

<a name="tabstop_examples" id="tabstop_examples"></a>
## Examples

This "blank" PHP function snippet uses numbered tabstops. This is what it looks like when defined in the snippet:

```
/*
    * function [[%tabstop1:name]]
    * @param [[%tabstop2:arg]]
*/

function [[tabstop1:name]]($[[%tabstop2:arg]]) {
  [[%tabstop]];
}

```

When inserted in the buffer, it will look like this:

```
/*
    * function name
    * @param $arg;
*/

function name($arg) {

}

```

The "name" tabstop is the first place **Tab** will stop. It gets replaced with the function name which is propagated through the rest of the snippet when **Tab** is hit again. The "arg" tabstop is the next place **Tab** stops, and is treated the same way. The unnamed tabstop is invisible in the buffer, but hitting **Tab** again will move the cursor to its position.

Here's another example of a short snippet for HTML:

```
<[[%tabstop1:div]]>[[%s]]</[[%tabstop1:div]]>
```

The current selection is wrapped in an element (a "div" by default).

```
<div>[[%s]]</div>
```

Pressing **Tab** after insertion will select the first "div" for replacement. If it is replaced, the closing tag will be changed as you type. If it is not replaced, "div" will be used as the element type.
