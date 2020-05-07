---
title: About the Tutorial tool
---
## What is the Tutorial Tool?
The tutorial tool is a tool which allows you to write and run your own tutorials. If you've ever used an online "learn how to program" tool you're likely already familiar with the concept. Where Komodo's tutorial tool sets itself apart is that you are in a full blown IDE environment, so the possibilities of what you could do with the tool are endless.

## How do I run a tutorial?

To run a tutorial, open the **Toolbox** (**View** > **Tabs and Sidebars** > **Toolbox**) and navigate to the "Tutorials" folder and double click one of the available tutorials. We recommend starting with the "Getting Started" tutorial.

## How do I create a tutorial?

To create a tutorial, start by hitting the "cog" icon at the top right of the Toolbox widget, then select "New Tutorial". Alternatively if you wish to edit a tutorial you can right click the tutorial in your toolbox and select "Properties".

Normally you edit a tutorial through the dialog that pops up, but you can also open the tutorial in your main editor by right clicking it and selecting either "Edit Tutorial" or "Edit Tutorial Logic". What do those mean you might ask?

**Edit Tutorial**: You're editing the main tutorial information, the text, titles, tips, etc. For most people this will be the only thing that they will use.

**Edit Tutorial Logic**: This allows you to provide *optional* logic for your tutorial, for example you could add validation functionality to ensure that a step is completed before continuing to the next.

Let's have a look at how you actually write the tutorial.

### Anatomy of the Tutorial

Tutorials are written in YAML, this makes it so that almost anyone can edit a tutorial as the markup is fairly self explanatory and isn't overly picky. Although you'd still need some tech savvy skills to ensure it doesn't break, it won't be anywhere near as bad as using something like JSON.

You might be asking why we didn't create a GUI for this, well quite simply we felt the tutorial tool should be fun to work with, and programmers love their code more than anything else. Wrapping this up in a GUI would likely have made it a frustrating experience both for the user as well as the developer (wherein we, the maintainers of Komodo, are the developers).

So, let's have a look at the anatomy of a tutorial .yaml file. Scroll down to see additional information on some of these properties.

<pre class="highlight">
<code class="hljs ini">
Description: A short description of what your tutorial does, currently this isn't used yet but this will eventually show up in the package manager
Author: Your Name
Version: 1.0
Placement: docked or floating
PlacementOptions:
    Orientation: Vertical
Callouts:
    myCallout:
        Element: #toolsToolbarGroup
        Message: Pay attention to this element, it does XYZ!
        Fail: Make sure you enabled this element!
Steps:
    -
      Title: First Step
      Summary: >
          Markdown summary. Special features include:

           * [logic callback link][callback:myCallback] - Calls the myCallback method in your tutorial logic
           * [callout link][callout:myCallout] - See the defined callouts above
           * Click this button: ![element:#newButton] - Shows an image of the given UI element
           * ![element:#openFilesPaneLabel,chrome://openfiles/content/panel.xul] -- Same as above, but the given UI element is in a specific window

      Task: >
          Your Task

      # The following fields are optional
      Tips:
          - tip 1
          - tip 2
          - tip 3
      Validate: checks for this string in the active editor buffer
      Validate: !!js/regexp /^checks for this regex in the active editor buffer$/
      Validate: myValidationFunction # Calls this function in your logic
      Success: >
          Shown when the validation succeeds, before continuing
          to the next step
    -
      Title: Second Step
      Summary: >
          Your Summary
      Task: >
          Your Task
</code></pre>

Let's have a closer look at some of these properties, note we'll skip the ones that are self-explanatory.

#### Placement (optional)

Defined whether the tutorial opens "docked" or "floating". Docked means it will open as part of the main Komodo window, whereas floating means it will open as a floating window.

#### PlacementOptions (optional)

**Orientation:** Defined whether the tutorial will open as a vertical panel or a horizontal panel. Try it out to see the difference.

#### Callouts (optional)

A callout calls out a certain element in Komodo. For example you could use it to "call out" the debug button. It essentially blacks out the entire window except the chosen element, and shows a chosen message.

**Element:** The element that should be called out (as a CSS selector). Use the [DOM Inspector](http://komodoide.com/packages/addons/dom-inspector/) to find the CSS selector for the element you're interested in.
**Message:** The message to show when the callout is active
**Fail:** This is a warning that shows to the user if the element that was chosen was not found or is not visible.

#### Tips (optional)

Fill out a tip per line (starting with the dash). The user will be able to choose to "unlock" one tip at a time. Tips are meant to assist the user when they get stuck, but are otherwise preferred not to be shown as part of the task as you want the user to still have to do some of the work so that they learn the process.

#### Validate

This allows you to specify validation that needs to be met before the user can continue to the next step. Note that the user can choose to force the next step and ignore the validation, but they will be warned that this could break the tutorial (ie. the steps could no longer make sense).

You can enter three types of values:

* regular string, this would make Komodo validate whether the string is present in the current editor buffer
* regex rule, this would make Komodo validate whether the regex matches the current editor buffer
* callback method name, if the value matches a method in your tutorial logic then this method will be used to validate the current step

Note that for the callback method you need to return either "true" (boolean) or you need to return the error message.

#### Success

This is a simple success message that can be shown before you continue to the next step, or if it's used on the last step in the tutorial it would be shown as the final message before finishing the tutorial.

### Anatomy of the Tutorial Logic

The tutorial logic will make many programmers feel at ease, especially if they've ever written a Komodo userscript before. Basically anything you can do in a userscript you can do here, with the main difference being that the tutorial automatically hooks into this logic. At it's most basic, this is what the tutorial logic will look like:

```
(function() {

    /**
     * Called when the tutorial starts, right after the tutorial panel
     * is initialized but before the first step is rendered
     */
    this.start = function() {}

    /**
     * Called before the step is changed, you can get the current step
     * with require("tutorials")._getActive().step.
     *
     * Steps are always incremental. To go back a step the active step
     * counter is decreased and then this function gets called.
     *
     * @returns {Boolean} Returning false stops execution
     */
    this.preStep = function() {}

    /**
     * Called after a step has changed.
     *
     * See this.preStep() for further details
     */
    this.step = function() {}

    /**
     * Called before the tutorial is closed and the tutorial ends.
     *
     * @returns {Boolean} Returning false stops execution
     */
    this.preClose = function() {}

    /**
     * Called after the tutorial is closed.
     *
     * See this.preClose() for further details.
     */
    this.close = function() {}

    /**
     * A custom validation function that can be hooked up in
     * your tutorial meta information.
     *
     * @returns {Boolean|String} Return true to pass, anything else to fail
     *
     * If you return a string it will be used as the error message.
     */
    // this.myValidationFunction = function() {}

    /**
     * Custom callback function, can be used in markdown
     */
    this.myCallback = function() { window.alert("My callback!"); }

}).apply(module.exports);
```
