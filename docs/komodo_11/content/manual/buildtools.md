---
title: Build tools
---
(Komodo IDE only)

Komodo supports the following build tools:

 - [PhoneGap](phonegap.html)
 - [Cordova](cordova.html)
 - [Grunt](grunt.html)
 - [Gulp](gulp.html)

## Configuration
These tools use the [Shell Scope](commando.html#commando-go-to-anything_shell-scope) to execute.  The Shell Scope uses Komodo's [Environment Preferences](prefs.html#preferences_environment) to know where things are on your system and how it's configured.  If these tools need specific environment variables then they should be configured here (e.g. `JAVA_HOME` for PhoneGap, Android or adding `node` and `npm` to your system path (if they aren't there already) to launch a Node server or install an NPM package). If you already have these variables configured at a global level, Komodo will pick them up from your system when it starts, and display them in the Environment Preferences page.

## Usage

### Go to Anything (Commando)

Each build tool has been implemented with their own set of commands within the Commando Shell scope.  This interface provides you with auto-completions and suggestions for expected or possible sub-commands, command arguments, and options.

### Dynamic Toolbar Buttons

Komodo provides a point and click interface for these tools through dynamic buttons. These buttons are found in the dynamic toolbar which is at the upper left of the Komodo interface. When you've opened a project that uses one of the build tools in Komodo, a button is displayed in the Dynamic Toolbar with the icon of your build tool. These buttons provide the ability to perform common commands for that tool or quickly jump into Commando to run a more involved command that the button doesn't provide.
