(function() {
    
    var $ = require("ko/dom");
    var _ = require("contrib/underscore");
    var ko = require("ko/windows").getMain().ko
    
    const {Cc, Ci, Cu}  = require("chrome");
    Cu.import("resource://gre/modules/Services.jsm");
    
    this.createFloatingPanel = function(options)
    {
        // Parse options and inject default
        var opts = _.extend({
            position: "end",
            orientation: "vertical",
            anchor: "editor",
            window: window,
            size: 300,
            margin: 20
        }, options);
        
        // Find out what we are  "anchoring" to
        var anchor;
        if (opts.anchor == "editor")
        {
            if ( ! ko.views.manager.currentView)
            {
                ko.commands.doCommandAsync('cmd_new');
                $(window).once('current_view_changed',
                               this.createFloatingPanel.bind(this, options));
                return hud;
            }
            
            anchor = ko.views.manager.topView.currentView.tabbox.tabpanels;
        }
        else
            anchor = opts.window.document.getElementById(opts.anchor);
        
        var width, height;
        var margin = opts.margin || 0;
        
        // Set panel orientation
        if (opts.orientation == "vertical")
        {
            height = anchor.boxObject.height -= (margin*2);
            width = opts.width || opts.size;
        }
        else
        {
            height = opts.height || opts.size;
            width = anchor.boxObject.width -= (margin*2);
        }
        
        // Calculate position from anchor
        var x = opts.x, y = opts.y;
        if (opts.position == "end")
        {
            if ( ! x && opts.orientation == "vertical")
            {
                x = (anchor.boxObject.x + anchor.boxObject.width) - width;
            }
            else if ( ! y)
            {
                y = (anchor.boxObject.y + anchor.boxObject.height) - height;
            }
        }
        
        // Apply margin through dimensions and position, as panel margin does not
        // work the way you would expect it to
        if (opts.margin)
        {
            if (x && opts.orientation == "vertical")
            {
                if (opts.position == "end")
                    x -= opts.margin;
                else
                    x += opts.margin;
                
                y = anchor.boxObject.y + opts.margin;
            }
            else if (y && opts.orientation == "horizontal")
            {
                if (opts.position == "end")
                    y -= opts.margin;
                else
                    y += opts.margin;
                
                x = anchor.boxObject.x + opts.margin;
            }
        }
        
        var _body = window.document.documentElement;
        x = _body.boxObject.screenX + x;
        y = _body.boxObject.screenY + y;
        
        var w = window.openDialog("chrome://tutorials/content/views/tutorial.html",
                                     "tutorial", `chrome=yes,titlebar=yes,alwaysRaised=yes,left=${x},top=${y},outerWidth=${width},outerHeight=${height}`);
        w.addEventListener("close",
            (event)=>{
                 event.preventDefault();
                 require("tutorials/tutorials").close();
             });
        require("ko/windows").pin(w);
        return w;
    };
    
    this.createDockedPanel = function(options)
    {
        // Parse options and inject default
        var opts = _.extend({
            orientation: "vertical"
        }, options);
        
        // Create main tutorial panel
        var wrapper =
        $($.create("vbox", {id: "tutorialWrapper", class: "tutorial"},
            $.create("browser", {type: "chrome", src: "chrome://tutorials/content/views/tutorial.html", flex: 1})
        ).toString());
        
        var splitter =
        $($.create("splitter", {id: "tutorialSplitter", orient: opts.orientation == "horizontal" ? "vertical" : "horizontal"},
            $.create("observes", {element: "tutorialWrapper"})
        ).toString());
        
        if (opts.orientation == "horizontal")
        {
            splitter.attr("height", 3);
            $("#bottom_splitter").before(wrapper.attr("height", 300));
        }
        else
        {
            splitter.attr("width", 3);
            $("#workspace_right_splitter").before(wrapper.attr("width", 350));
        }
            
        wrapper.before(splitter);
        
        return wrapper;
    };
    
    this.callout = function(element, message, opts = {})
    {
        requireStylesheet();

        var padding = 5;
        
        // Shortcuts to window specific objects
        var _doc = element.ownerDocument,
            _body = _doc.documentElement,
            bo = element.boxObject,
            w = element.ownerGlobal;
            
        // Create the initial "blackout" panel
        var top = $($.create("panel", {class: "tutorial-blackout",
                                       noautohide: true, 
                                       pack: "center", align: "center"}).toString());
        
        // Then just clone the other blackout panels from that initial one
        var right = top.clone(),
            bottom = top.clone(),
            left = top.clone();
            
        $(_body).append(top.addClass("top-panel"));
        $(_body).append(right.addClass("right-panel"));
        $(_body).append(bottom.addClass("bottom-panel"));
        $(_body).append(left.addClass("left-panel"));
        
        // Prepare variables. -bo stands for boxObject
        var x, y, width, height,
            tbo, rbo, bbo, lbo;
        tbo = rbo = bbo = lbo = {x: 0, y: 0, width: 0, height: 0};
        
        // Position and size the top blackout
        if (bo.y - padding > 0)
        {
            top.attr({width: _doc.width, height: bo.y - padding});
            top.element().openPopup(_body, 'overlap', 0, 0);
            top.element().moveTo(_body.boxObject.screenX, _body.boxObject.screenY);
            tbo = top.element().boxObject;
        }
        
        // Right
        width = _doc.width - (bo.x + bo.width + padding);
        height = _doc.height - tbo.height;
        if (width > 0 && height > 0)
        {
            x = bo.x + bo.width + padding;
            y = tbo.height;
            right.attr({width: width, height: height});
            right.element().openPopup(_body, 'overlap', x, y);
            right.element().moveTo(_body.boxObject.screenX + x, _body.boxObject.screenY + y);
            rbo = right.element().boxObject;
        }
        
        // Bottom
        y = (bo.y + bo.height + padding);
        if ( y < _doc.height)
        {
            width = _doc.width - rbo.width;
            height = _doc.height - y;
            bottom.attr({width: width, height: height, style: "max-height: " + height + "px"});
            bottom.element().openPopup(_body, 'overlap', 0, y);
            bottom.element().moveTo(_body.boxObject.screenX, _body.boxObject.screenY + y);
            bbo = bottom.element().boxObject;
        }
        
        // Left
        width = (bo.x - padding);
        if (width > 0)
        {
            height = _doc.height - tbo.height - bbo.height;
            left.attr({width: width, height: height, style: "max-width: " + width + "px"});
            left.element().openPopup(_body, 'overlap', 0, tbo.height);
            left.element().moveTo(_body.boxObject.screenX, _body.boxObject.screenY + tbo.height);
            lbo = left.element().boxObject;
        }
        
        // Detect the largest panel
        var ref = tbo; // default to top
        var refsize = ref.width * ref.height;
        var checksize;
        
        // Right panel
        checksize = rbo.width * rbo.height;
        if (refsize < checksize)
        {
            ref = rbo;
            refsize = checksize;
        }
        
        // Bottom panel
        checksize = bbo.width * bbo.height;
        if (refsize < checksize)
        {
            ref = bbo;
            refsize = checksize;
        }
        
        // Left panel
        checksize = lbo.width * lbo.height;
        if (refsize < checksize)
        {
            ref = lbo;
            refsize = checksize;
        }
        
        bo = ref;
        
        // Add panel with message, if one was defined
        var _opts = {class: "tutorial-blackout-message",
                    noautohide: true, pack: "center", align: "center"};
        var panel = $($.create("panel", _opts,
                        $.create("description", message || "")
                                ("button", {label: "Close"})
                        ).toString());
        $(_body).append(panel);
        
        panel.attr({width: _doc.width, height: bo.height});
        panel.element().openPopup(_body, 'overlap', 0, bo.y);
        
        panel.find("button").on("command", this.closeHighlight.bind(this));
        
        // Close the callout if the window is moved/resized
        var onAttrModified = function(e)
        {
            var attrs = ["x", "y", "screenX", "screenY", "width", "height"];
            if (attrs.indexOf(e.attrName) != -1)
            {
                this.closeHighlight();
            }
        }.bind(this);
        w.addEventListener("DOMAttrModified", onAttrModified);
        
        // Remove listener on close
        panel.on("popuphidden", function()
        {
            w.removeEventListener("DOMAttrModified", onAttrModified);
        });
    };
    
    this.closeHighlight = function()
    {
        $(".tutorial-blackout, .tutorial-blackout-message").each(function() {
            this.hidePopup();
        });
        $(".tutorial-blackout, .tutorial-blackout-message").remove();
    };
    
    var requireStylesheet = function(_window = window)
    {
        if (("__tutorialStylesheet" in _window)) return;
        
        var uri = "less://tutorials/skin/tutorials.less";
        require("sdk/stylesheet/utils").loadSheet(_window, uri);
        _window.__tutorialStylesheet = true;
    };
    
}).apply(module.exports);