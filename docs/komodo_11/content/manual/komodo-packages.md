---
title: Komodo Packages
---
The Komodo Package Manager allows you to install packages that are available from the [Komodo Packages website](http://komodoide.com/packages/). Only Packages that were [properly submitted](http://komodoide.com/packages/submit-instructions/#pane-packages) will be accessible from the Komodo Package Manager. Some Packages are only submitted using their source code and no distributable file, making it impossible for the Komodo Package Manager to facilitate their installation.

You can access the Package Manager via [[Commando]]. Alternatively the **New Tab** view will also allow you to access this functionality via the **Install Packages** button.

## What Are Packages?

A package is anything that is used to customize the default Komodo user experience. Whether it be a skin, or a new language which isn't natively supported. Examples of Packages are:

- Add-ons
- Userscripts
- Toolbox Items
- Color Schemes
- Skins
- Languages
- Keybindings

As of Komodo 9.3 the Package Manager is the only way to manage your add-ons. The ability to disable/enable add-ons has been removed as this was not offering any advantage over installing/uninstalling besides saving a little bit of bandwidth.

## Updating Packages

Komodo checks for package updates on startup and will notify you if any updates are available. The act of installing the update is manual as package updates may bring about significant changes which should not be made implicitly.

To update a package manually simply invoke the Package Manager scope in Commando (open Commando and navigate to the Packages scope), then navigate to "Manage Packages" and finally "Update Packages". There you can select what packages you wish to update.

## Outdated Packages

Komodo marks outdated packages, outdated packages indicate a package that was not made for the current version of Komodo, though it may very well still work. If Komodo is acting strangely then uninstalling outdated packages would be a good troubleshooting step to follow.

## Accessing the old Add-on Manager

If for whatever reason you need to access the old add-on manager (eg. to enable an add-on that you previously had disabled) you can do so by executing the following command in the Console pane:

```javascript
ko.windowManager.openOrFocusDialog("chrome://mozapps/content/extensions/extensions.xul", "Addons:Manager")
```
