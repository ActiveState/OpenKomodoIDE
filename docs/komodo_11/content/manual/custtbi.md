---
title: Custom toolbars and menus
---
Any component that can be stored in a [Toolbox](toolbox.html) can be stored in a custom toolbar or menu. They are useful for exposing snippets, commands, userscripts, or links which are used often.

Custom toolbars and menus are created within a toolbox. Those in project-specific toolboxes are only displayed when that project is active; those contained in the global toolbox (i.e. at the top level) are always displayed.

<a name="Cust_Toolbar_Menu" id="Cust_Toolbar_Menu"></a>
## Creating Custom Toolbars and Menus

1.  On the **Toolbox** drop-down menu, select **New Custom Toolbar** or **New Custom Menu**. Enter a name for the new item.
1.  Copy and paste or drag and drop the item(s) to be included onto the icon created in the previous step. Alternatively, right-click the custom menu or toolbar name and select **Add**. New toolbars are displayed alongside the default Komodo toolbars and can be accessed via the **View** > **Toolbars** menu. New menus are displayed to the right of the default Komodo menus.

<a name="custtbi_props" id="custtbi_props"></a>
## Custom Menu and Toolbar Properties

Custom menu or toolbar properties are used to alter the name of the custom menu or toolbar, or change the custom menu or toolbar's display order. To access the Properties dialog box, right-click the custom menu or toolbar and select **Properties**.

Custom menus are displayed between the default **Tools** and **Help** menus. If multiple custom menus are in effect, the display order depends on the menu's **Priority** setting. New menus have a default priority of 100; alter the priority of custom menus to control the left-to-right order of display.

Custom toolbars are displayed to the right of default Komodo toolbars. If necessary, a new row is created for their display. If multiple custom toolbars are in effect, the display order depends on the toolbar's **Priority** setting. New toolbars have a default priority of 100; alter the priority of custom toolbars to control the left-to-right order of display.

To assign a letter to be used in combination with the 'Alt' key for menu access, enter a shortcut letter in the **Menu Access Key** field. If the letter is already assigned to a Komodo core function, you are prompted to enter a different letter.

## Related information

- [Feature Showcase - Custom Toolbar](/tutorial/tourlet_custtoolbar.html)
