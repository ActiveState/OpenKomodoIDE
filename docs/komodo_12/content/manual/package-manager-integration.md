---
title: Package Manager Integration
---
(Komodo IDE only)

Komodo includes support for a variety of package managers that you can use to access and manage the packages you use in your projects.

## UI integration

When you install a package manager, Komodo dynamically adds the icons and menus to access the package manager commands to the Side Toolbar. You can access the main features of the installed package managers in the toolbar.

![Universal Package Manager](/images/universalpm.png)

## Shell integration
Komodo also provides Package Manager integration through the [Shell Scope](commando.html#commando-go-to-anything_shell-scope). It effectively provides a way of working with package managers without having to execute multiple commands as a reference for the actual command that you wish to execute. For example you could run `npm install` and Komodo would automatically show you a list of possible packages to install. You do not need to run `npm search` or visit the npm archive in your browser to reference package names.

## Supported Package Managers

- bower
- composer
- cpanm
- docker
- gem
- npm
- yarn
- pip
- pip3
- ppm
- pypm
- pypm3

## Configuration

Commando tries to find each package manager on your PATH, however you may wish to configure your package managers manually if they are not on your PATH or if you have multiple versions installed. To do this navigate to the preferences for the language which you want to configure the package manager for. In there should be a field allowing you to explicitly define the package manager location. For example, to configure NPM, open **Preferences**  and select **Languages** : **Node.js** and enter the correct path in the **NPM Location** text box.
