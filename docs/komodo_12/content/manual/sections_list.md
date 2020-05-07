---
title: Sections List
---
(Komodo IDE only)

The Sections List in the Komodo status bar shows a list of code or markup objects in the current file. For programs it displays functions and classes; for HTML and XML files it displays all elements with IDs.
<a name="sections_view" id="sections_view"></a>
## Viewing the List

While collapsed, the field in the middle of the statusbar shows the object at the current cursor position. Clicking on it, or pressing **Ctrl**+**F8**, opens a menulist containing the full list of objects.

![Sections List: Simple HTML file](/images/sections_list.png)
<a name="sections_select" id="sections_select"></a>
## Selecting and Filtering

Selecting any of the nodes in the list moves the cursor the the corresponding line in the editor. This can be done with the mouse or by scrolling to the item with the arrow keys and pressing **Enter**.

When the menulist is selected, the cell in the status bar becomes a filter field. Typing in this field narrows the outline to items matching what you've typed so far (case insensitive unless capital letters are used). You can select an item from the shorter list, or filter the list down to one item and press **Enter**.
