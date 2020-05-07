## Updating icomoon Fonts and Icons

1. Open https://icomoon.io/app in a browser.
1. Click hamburger menu in top left > *Manage Projects*.
1. *Import Project*.
1. Find and upload *[KomodoIDE Repo]/src/chrome/komodo/skin/global/icons/Komodo.json*.
1. *Load* project.
1. Import any new icons with *Import Icons*.
1. Make sure the new icon set is toggled as added and the correct size (Selection count should be higher... ;) ).
1. Click *Generate Font* at bottom right.
    1. *Font Name* is *icomoon*.
    1. *Class Prefix* is *icon-*.
    1. Select *Generate preprocessor variables for: Less*.
1. *Download*.
1. Unzip contents into *[KomodoIDE Repo]/src/chrome/komodo/skin/global/icons/*
1. In icomoon.io, Return to the *Manage Project* screen (steps above)
1. *Download* the Komodo project.
1. Place the *Komodo.json* file in *[KomodoIDE Repo]/src/chrome/komodo/skin/global/icons/*
1. If you don't have it in your toolbox already, drag and drop *[KomodoIDE Repo]/src/chrome/komodo/skin/global/icons/Compile_Fonticon_LESS.komodotool* on to Komodo and import the tool.
1. Open *[KomodoIDE Repo]/src/chrome/komodo/skin/global/icons/style.less* in Komodo.
1. Double click *Compile Fonticon LESS* in the tool box to run it on *style.less*.
1. Build and start Komodo to test things still work and that you can load your new icon.
1. Commit your changes.  Any NEW, untracked files should *NOT* be commited.  Just delete them.