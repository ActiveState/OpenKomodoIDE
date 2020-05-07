---
title: Feature Showcase - Debug an XSLT Program
---

(Komodo IDE only)

When [debugging XSLT](/manual/debugxslt.html#debugxslt_top) programs in Komodo, view the execution location of the XSLT file and the XML input file at the same time.

Note: The key bindings used in this showcase are for Windows/Linux users. To find the equivalent key bindings for macOS, select **Help** > **Key Bindings**.

1. Select **Project** > **Sample Project**.

1. Double-click the `xslt_sample.xsl` file in the **Places** pane.

1. Select **Debug** > **Step In**.                                            

1. In the Debugging Options dialog box, enter `birds.xml` (also in the Komodo Sample Project) as the input file. Click **OK**.
  ![](/images/tourlet_debug_xslt_birds.png)  

1. Komodo displays split editor pane with yellow arrows showing point of execution in both the XML and XSLT files. Step through the code using the **Step In** button (`F11`), or [set breakpoints](/manual/debugger.html#toggle_breakpoint) and use the **Go/Continue** button (`F5`).
   ![](/images/tourlet_debug_xslt_split.png)   

1. When debugging is complete the results of the transformation appear in the **Debug** tab in the **Bottom** pane. The raw output is displayed in the **Output** sub-tab, and the rendered output is displayed in the **HTML** sub-tab. [Output](/manual/workspace.html#Output_Pane) tab. Select the **HTML** sub-tab to preview the rendered results.                                                                   
   ![](/images/tourlet_debug_xslt_htmlout.png)
