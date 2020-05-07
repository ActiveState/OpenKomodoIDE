---
title: Key Binding Schemes
---
To view the current list of key bindings for your Komodo installation, including any custom key bindings, select **Help** > **List Key Bindings**. The default key binding scheme is set according to your platform. To select a different key binding scheme, select the key binding to use in the [Key Bindings](prefs.html#Config_Key_Bindings) page in the **Preferences** dialog box.

## Vi Scheme

The Komodo Vi emulation  can be extended by the user to include custom Vi commands. See the [Vi Keybindings section](vikeybind.html) for more information.

<a name="sharing_keybinding_schemes" id="sharing_keybinding_schemes"></a>
## Sharing and Migrating Key Binding Schemes

Keybinding schemes are stored in files with a `.kkf` extension in the `schemes` subdirectory of the [user data directory](trouble.html#appdata_dir). The filenames correspond to the [scheme names](prefs.html#Config_Key_Bindings) displayed in the **Key Bindings** page in the **Preferences** dialog box.

### Migrate

To duplicate your current keybindings on a new system, copy the desired `.kkf` to the corresponding `schemes` directory on the target system, then start (or restart) Komodo on that system. The copied scheme will be available for selection in the key binding preferences.

### Share

If you've created a keybinding scheme that you think other users would benefit from then you can add it to the [Komodo Packages repository](https://github.com/Komodo/Packages) to allow other users to [download and install it](commando.html#commando-go-to-anything_packages-scope) using **Go to Anything** (Commando). Here are instructions on [adding your scheme to the Komodo Packages](http://komodoide.com/packages/submit-instructions/#pane-packages).
