(function()
{
    const {Cc, Ci}  = require("chrome");
    const log = require("ko/logging").getLogger("codeintel/feature/calltips/panel");
    const koEditor = require("ko/editor");
    const codeintel = require("codeintel/codeintel");
    const calltips = require("codeintel/feature/calltips");
    const w = require("ko/windows").getMain();

    var Panel = function(view, completions)
    {
        var panel;
        var docblockcolumn;
        var docblock;
        var signature;
        var editor = koEditor.editor(view.scintilla, view.scimoz);
        var destroyed = false;
        var onDestroyCallbacks = [];

        this.view = view;
        this.startPos = editor.getCursorPosition("absolute");

        var init = () =>
        {
            panel = view.ownerDocument.getElementById('calltips-panel');
            if (panel)
            {
                panel = panel._sdk;
                docblock = panel.element.firstChild._sdk;
                signature = docblock.element.nextSibling._sdk;
            }
            else
            {
                panel = require("ko/ui/panel").create({ attributes:
                {
                    id: "calltips-panel",
                    class: "dialog",
                    level: "floating",
                    noautohide: true, // workaround xul drawing bug
                    noautofocus: true
                } });

                docblock = require("ko/ui/textbox").create({ flex: 1, multiline: true, readonly: true });
                panel.addElement(docblock);

                signature = require("ko/ui/description").create({ class: "calltip-signature" });
                panel.addElement(signature);
            }

            renderCalltip(completions);

            var pos = editor.getCursorWindowPosition(true);
            panel.open({ anchor: null, x: pos.x, y: pos.y, align: "bottom" });

            panel.element.addEventListener("popuphiding", onHide);
            panel.element.addEventListener("popupshown", () =>
            {
                renderCalltip(completions);
                this.updatePosition();
            });

            this.updatePosition();

            // Since we're using noautohide to work around XUL being awful we have
            // to manually take care of hiding the panel
            w.addEventListener("deactivate", this.destroy);

            w.addEventListener("after_command", this.onCommand);
        };

        this.updatePosition = () =>
        {
            var pos = editor.getCursorWindowPosition(true);
            var y = pos.y - panel.element.boxObject.height;
            panel.element.moveTo(pos.x, y);
        };
        
        this.isOpen = () =>
        {
            return panel.element.state == "open";
        };

        var onHide = () =>
        {
            this.destroy();
        };
        
        this.destroy = () =>
        {
            if (panel.element.state == "open" || panel.element.state == "showing")
            {
                panel.element.hidePopup();
            }
                
            for (let callback of onDestroyCallbacks)
                callback();
                
            w.removeEventListener("deactivate", this.destroy);
            w.removeEventListener("after_command", this.onCommand);
                
            destroyed = true;
        };

        this.onDestroy = (callback) =>
        {
            onDestroyCallbacks.push(callback);
            
            if (destroyed)
                callback(); // already destroyed
        };

        this.onCommand = (e) =>
        {
            if (e.detail == "cmd_cancel")
                this.destroy();
        };

        var renderCalltip = (completions) =>
        {
            docblock.hide();
            signature.hide();
            
            if (completions.docblock)
            {
                docblock.show();
                docblock.value(completions.docblock);

                if (docblock.element.inputField)
                    docblock.attr("height", docblock.element.inputField.scrollHeight + "px");
            }

            if (completions.signature)
            {
                signature.show();
                signature.empty();
                signature.addElement(calltips.getFormattedSignature(completions.signature, editor));
            }
        };

        init();
    };

    module.exports = Panel;

})();
