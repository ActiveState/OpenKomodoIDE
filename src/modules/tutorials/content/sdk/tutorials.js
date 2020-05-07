(function() {
    
    var $       = require("ko/dom");
    var _       = require("contrib/underscore");
    var yaml    = require("contrib/yaml");
    var log     = require("ko/logging").getLogger("tutorials");
    var prefs   = require("ko/prefs");
    var ui      = require("./ui");
    const w     = require("ko/windows").getMain();
    const ko    = w.ko;
    //log.setLevel(10);
    
    var active = null;
    
    // for debugging
    this._getActive = function() { return active; }
    
    /**
     * Called by the toolbox when a tutorial tool is invoked
     */
    this.onInvoke = function(tool)
    {
        log.debug("Invoke");
        
        try
        {
            // Load tutorial meta information
            var meta = yaml.load(tool.value.replace(/\n/g, "\n\n"));
            if ((typeof meta) != 'object')
                throw new Error("Missing Meta Information");
            
            meta = this.normalizeMeta(meta);
        }
        catch (e)
        {
            var msg = "Tutorial could not start, check your error log for more info";
            require("notify/notify").interact(msg, "tutorials", {priority: "error"});
            log.exception(e);
            return;
        }
        
        meta.title = tool.getStringAttribute("name");
        meta.logic = tool.getStringAttribute("logic");
        
        this.start(meta);
    }
    
    /**
     * Signals that the tutorial panel is ready.
     *
     * Called by the tutorial view when it is done loading
     */
    this.onPanelReady = function()
    {
        log.debug("Panel Ready");
        
        // Add a "hud" class if this is a floating panel
        if (active.opts.placement == "floating")
        {
            active.window.document.documentElement.classList.add("floating");
            new require("ko/windows/draggable")(active.window.document.documentElement);
        }
        else
        {
            active.window = active.panel.find("browser").element().contentWindow;
            
            let dockBtn = active.window.document.querySelector("a.dock");
            dockBtn.classList.remove("icon-toggle-down");
            dockBtn.classList.add("icon-toggle-up");
            active.window.document.documentElement.classList.add("docked");
        }
        
        var orientationBtn = $("a.orientation", active.window.document);
        if (active.opts.placementOptions.orientation == "horizontal")
        {
            orientationBtn.removeClass("icon-layout-bottom");
            orientationBtn.addClass("icon-layout-right");
        }
        else
        {
            orientationBtn.removeClass("icon-layout-right");
            orientationBtn.addClass("icon-layout-bottom");
        }
        
        // Bind event listeners
        $("a.close", active.window.document).on("click", this.close.bind(this));
        $("a.dock", active.window.document).on("click", this.toggleDocked.bind(this));
        $("a.orientation", active.window.document).on("click", this.toggleOrientation.bind(this));
        
        if (active.logic.start)
        {
            active.logic.start();
        }
        
        // Trigger the first step
        this.nextStep();
        
        if (active.opts.placement != "floating" &&
            window.document.documentElement.getAttribute("sizemode") != "maximized")
        {
            window.sizeToContent();
        }
    }
    
    this.onWindowOpen = function(e)
    {
        var openedWindow = e.detail;
        
        // Don't run on certain window types
        if (openedWindow.location.href.indexOf("tutorial.html") != -1 ||
            openedWindow.location.href.indexOf("komodo/content/dialogs") != -1 ||
            openedWindow.location.href.indexOf("inspector.xul") != -1)
            return;
        
        // Don't run on embedded windows
        if (openedWindow.parent != openedWindow)
            return;
        
        if (active.opts.placement == "docked" && 
             (! ("warnOnWindowOpen" in active.opts) || active.opts.warnOnWindowOpen))
        {
            // Call on timeout, so the window has time to open
            setTimeout(function() {
                require("ko/dialogs").alert(
                    "A tutorial is open in the main Komodo window. You can return " +
                    "to it by pressing Alt+Tab, or by using your window manager." +
                    "Alternatively, you can click the \"Undock\" button at the top" +
                    "right of the tutorial window to launch the tutorial in its own window.",
                    {window: openedWindow});
            }, 500);
            active.opts.warnOnWindowOpen = false;
        }
    }
    
    /**
     * Start a new tutorial, called by onInvoke
     */
    this.start = function(options)
    {
        log.debug("Start");
        
        // Check if we are already running a tutorial
        if (active)
        {
            var msg = "You are trying to start a new tutorial while already running another, " +
                      "would you like to close " + active.title + " and start " + options.title + "?";
            if ( ! require("ko/dialogs").confirm(msg))
                return;
            
            this.close();
        }
        
        var $ = require("ko/dom");
        var _ = require("contrib/underscore");
        
        // Prepare the "active" object
        active = { step: 0, logic: {} };
        active.opts = _.extend({
            title: "Untitled",
            author: "anonymous",
            version: "0.1",
            
            placement: "docked",
            placementOptions: {
                orientation: "vertical"
            }
        }, options);
        active.title = active.opts.title;
        
        // Load logic if it is defined
        if (active.opts.logic.length)
        {
            try
            {
                this.loadLogic();
            }
            catch (e)
            {
                log.exception(e, "failed to load logic");
                var msg = "Could not load the logic for " + active.title +
                          ", this tutorial may not work properly."
                require("notify/notify").send(msg, "tutorials", {priority: "error"})
            }
        }
        
        // Load the tutorial UI
        if (active.opts.placement == "floating")
        {
            log.debug("Floating");
            active.window = ui.createFloatingPanel(active.opts.placementOptions);
        }
        else
        {
            log.debug("Docked");
            active.panel = ui.createDockedPanel(active.opts.placementOptions);
        }
        
        window.removeEventListener("window_opened", this.onWindowOpen);
        window.addEventListener("window_opened", this.onWindowOpen);
        
        // The panel will call onPanelReady() when it is ready
    }
    
    /**
     * Take the textual logic provided by the tutorial and load it as a JS module
     */
    this.loadLogic = function()
    {
        if ( ! this.loadLogic.__nextId)
            this.loadLogic.__nextId = 0;
        this.loadLogic.__nextId++;
            
        var filename = 'ko-tutorial' + this.loadLogic.__nextId + '.js';
        var ioFile = require('sdk/io/file');
        var tmpd = require('sdk/system').pathFor('TmpD');
        var path = ioFile.join(tmpd, filename);
        var file = ioFile.open(path, 'w');
        if ( ! file.closed)
        {
            file.write(active.opts.logic);
            file.close();
        }
        active.logic = require('tmp/' + filename.substr(0,filename.length-3));
        if ((typeof active.logic) != 'object')
            active.logic = {};
        ioFile.remove(path);
    }
    
    /**
     * Progress to next step, this is also called by prevStep, when finishing a
     * tutorial and when finishing a step
     */
    this.nextStep = function(force = false)
    {
        log.debug("Next Step");
        
        if (active.logic.preStep && active.logic.preStep() === false)
        {
            log.debug("Canceled next step due to logic.preStep()");
            return;
        }
        
        if ( force !== true && ! this.validateStep())
        {
            log.debug("Canceled next step due validateStep()");
            return;
        }
        else if (force === true)
        {
            var msg = "Are you sure you want to continue anway? This tutorial may " +
                      "not work properly if you do not properly follow the tasks given.";
            if ( ! require("ko/dialogs").confirm(msg))
            {
                return;
            }
        }
        
        // Mark step as validated
        if (active.step > 0)
        {
            active.opts.steps[active.step-1].valid = true;
        }
        
        var template = "#tpl-step";
        var wrapper = $("#wrapper", active.window.document);
        
        // If this is a "success" step then it's a "virtual" step and we're
        // not actually iterating over another step
        if ( ! active.isSuccessStep && active.step &&
            ("success" in active.opts.steps[active.step-1]) &&
             ! ("completed" in active.opts.steps[active.step-1]))
        {
            if (active.step < active.opts.steps.length)
            {
                active.opts.steps[active.step-1].completed = true;
            }
            template = "#tpl-success";
            active.isSuccessStep = true;
        }
        // This is a new step iteration
        else
        {
            // active.step is human readable, so starts at 1
            if (active.step >= active.opts.steps.length)
            {
                log.debug("Reached last step, closing tutorial");
                this.close();
                return;
            }
            
            active.step++;
            active.isSuccessStep = false;
        }
        
        // Prepare the step param
        var step = _.extend({}, active.opts.steps[active.step-1]);
        
        // Mark step as final if this is the final iteration of the steps array
        step.final = false;
        if (active.step == active.opts.steps.length &&
            (("success" in step && active.isSuccessStep) || ! ("success" in step)))
        {
            step.final = true;
        }
        
        // Parse the markdown content
        if ( ! active.isSuccessStep)
        {
            if (step.summary)
            {
                step.summary = this.parseMarkdown(step.summary);
            }
            if(step.task)
            {
                step.task = this.parseMarkdown(step.task);
            }
            if (step.tips)
            {
                for (let x=0;x<step.tips.length;x++)
                {
                    step.tips[x] = this.parseMarkdown(step.tips[x]);
                }
            }
        }
        else
        {
            step.success = this.parseMarkdown(step.success);
        }
        
        // Parse the template if it has not already been parsed, or if this
        // is a success step
        if (active.isSuccessStep || ! step.html)
        {
            log.debug("Parsing HTML for step " + active.step);
            var doT = require("contrib/dot");
            var params = {
                step: step,
                tutorial: active.opts,
                currentStep: active.step,
                isSuccessStep: active.isSuccessStep
            };
            
            var _template = $(template, active.window.document);
            _template = doT.template(_template.html());
            var html = _template(params);
            
            var templateBtns = $("#tpl-buttons", active.window.document);
            templateBtns = doT.template(templateBtns.html());
            html += templateBtns(params);
            wrapper.html(html);
            
            if ( ! active.isSuccessStep)
                active.opts.steps[active.step-1].html = html;
        }
        else
        {
            log.debug("Using cached HTML for step " + active.step);
            wrapper.html(step.html);
        }
        
        // Bind event handlers
        wrapper.find(".prevStep").on("click", this.prevStep.bind(this));
        wrapper.find(".nextStep").on("click", this.nextStep.bind(this));
        wrapper.find(".tips a.give").on("click", this.nextTip.bind(this));
        wrapper.find(".validation .continue").on("click", this.nextStep.bind(this, true));
        
        if (active.logic.step)
        {
            active.logic.step(active.step);
        }
    }
    
    /**
     * Go back to previous step, this just decreases the step iteration counter
     * and calls nextStep()
     */
    this.prevStep = function()
    {
        log.debug("Previous Step (calls next step)");
        
        if (active.isSuccessStep)
            active.step = active.step-1;
        else
            active.step = active.step-2;
        
        this.nextStep();
    }
    
    /**
     * Validate the current step using the tutorial meta
     */
    this.validateStep = function()
    {
        var result = false;
        
        var validationElem = $(".validation", active.window.document);
        validationElem.removeClass("visible");
        
        if (active.step <= 0 || ! ("validate" in active.opts.steps[active.step-1]))
        {
            return true;
        }
        
        var step = active.opts.steps[active.step-1];
        
        if (step.valid)
        {
            return true;
        }
        
        var editor = require("ko/editor");
        var value = editor.scimoz() ? editor.getValue() : "";
        
        // Validate using regex
        if ((typeof step.validate) != "string")
        {
            if ((typeof step.validate) == 'object' && step.validate.constructor.name == 'RegExp')
            {
                result = !! value.match(step.validate);
            }
            else
            {
                result = false;
            }
        }
        else
        {
            // Validate with custom callback
            if (("logic" in active) && step.validate in active.logic)
            {
                result = active.logic[step.validate](value);
            }
            else
            {
                // Basic string validation
                result = value.indexOf(step.validate) != -1;
            }
        }
        
        if (result === true)
        {
            return result;
        }
        else
        {
            var message = "You did not complete the required task.";
            if (typeof result == "string")
            {
                message = result;
            }
            else if ("validateMessage" in step)
            {
                message = step.validateMessage;
            }
            
            validationElem.find(".message").html(message);
            validationElem.addClass("visible");
            return false;
        }
    }
    
    /**
     * Dock / undock the tutorial panel
     */
    this.toggleDocked = function()
    {
        var placement = "docked";
        if (active.opts.placement == "docked")
            placement = "floating";
            
        active.opts.placement = placement;
        if (active.isSuccessStep)
        {
            // If the current step is a success step we'll have to delete
            // variables that make it skip that step when the panel is reloaded
            // in to the docked/undocked state
            delete active.isSuccessStep;
            delete active.opts.steps[active.step-1].completed;
        }
        else
        {
            active.step = active.step-1;
        }
        
        if (placement == "floating")
        {
            log.debug("Floating");
            active.panel.remove();
            $("#tutorialSplitter").remove();
            active.window = ui.createFloatingPanel(active.opts.placementOptions);
        }
        else
        {
            log.debug("Docked");
            active.window.close();
            active.panel = ui.createDockedPanel(active.opts.placementOptions);
        }
    }
    
    /**
     * Change orientation of the tutorial panel
     */
    this.toggleOrientation = function()
    {
        var orientation = "horizontal";
        if (active.opts.placementOptions.orientation == "horizontal")
            orientation = "vertical";
            
        active.opts.placementOptions.orientation = orientation;
        if (active.isSuccessStep)
        {
            // If the current step is a success step we'll have to delete
            // variables that make it skip that step when the panel is reloaded
            // in to the docked/undocked state
            delete active.isSuccessStep;
            delete active.opts.steps[active.step-1].completed;
        }
        else
        {
            active.step = active.step-1;
        }
        
        if (active.opts.placement == "floating")
        {
            active.window.close();
            active.window = ui.createFloatingPanel(active.opts.placementOptions);
        }
        else
        {
            active.panel.remove();
            $("#tutorialSplitter").remove();
            active.panel = ui.createDockedPanel(active.opts.placementOptions);
        }
    }
    
    /**
     * Close the tutorial panel and end the tutorial
     */
    this.close = function()
    {
        log.debug("Close");
        
        if (active.logic.preClose && active.logic.preClose() === false)
        {
            return;
        }
        
        ui.closeHighlight();
        
        if (active.opts.placement == "floating")
            active.window.close();
        else
        {
            active.panel.remove();
            $("#tutorialSplitter").remove();
        }
        
        if (active.logic.close)
        {
            active.logic.close();
        }
        
        active = null;
        
        window.removeEventListener("window_opened", this.onWindowOpen);
    }
    
    /**
     * Show the next tip (if any)
     */
    this.nextTip = function()
    {
        var wrapper = $("#wrapper", active.window.document);
        $(".notips", active.window.document).hide();
        $(".hastips", active.window.document).show();
        
        var nextTips = wrapper.find(".tips ul li:not(.visible)");
        nextTips.first().addClass("visible");
        
        if (nextTips.length == 1)
        {
            wrapper.find(".tips .hastips").hide();
        }
        
        var inner = $(".inner", active.window.document).element();
        inner.scrollTop = inner.scrollHeight;
    }
    
    /**
     * Call a method on the logic for the active tutorial
     */
    this.logicCallback = function(method)
    {
        var notify = require("notify/notify");
        var msg;
        
        if ( ! active.logic)
        {
            msg = "This tutorial is missing logic, it cannot handle your link.";
            notify.send(msg, "tutorials", {priority: "error"});
            return;
        }
        
        if ( ! (method in active.logic))
        {
            msg = method + " missing from tutorial logic.";
            notify.send(msg, "tutorials", {priority: "error"});
            return;
        }
        
        try
        {
            active.logic[method]();
        }
        catch (e)
        {
            log.exception(e, "Error while calling " + method + " on tutorial logic, tutorial: " + active.title);
            notify.send("Error running " + method + ": " + e.message, "tutorials", {priority: "error"});
        }
    }
    
    /*
     * Callout a UI element
     *
     * @argument {String|Object} callout string name of callout from tutorial 
     *                                   meta date OR callout object with
     *                                   selector string and message attrs
     *      callout Object:
     *      {
     *          element: "#selector-id",
     *          message: "Tell me something I don't already know."
     *      }
     */ 
    this.logicCallout = function(callout/*String or object*/)
    {
        var notify = require("notify/notify");
        var msg;
        if (typeof callout != "object")
        {
            if ( ! active.opts.callouts || ! (callout in active.opts.callouts))
            {
                msg = name + " missing from callouts.";
                notify.send(msg, "tutorials", {priority: "error"});
                return;
            }
            callout = active.opts.callouts[callout];
        }
        
        var element = $(callout.element);
        
        if ( ! element.length || ! element.visible())
        {
            msg = "The required element is not visible, please enable it.";
            if ("fail" in callout)
                msg = callout.fail;
                
            notify.interact(msg, "tutorials", {priority: "error"});
            return;
        }
        
        ui.callout(element.element(), callout.message);
    }
    
    this.getImageFor = function(element)
    {
        var bits = element.split(",");
        var w = window;
        
        if (bits.length > 1)
        {
            w = require("ko/windows").getWindowByUrl(bits[1]);
        }
        
        if ( ! w)
        {
            log.warn("Element could not be found: " + element);
            return "";
        }
        
        element = $(bits[0], w).element();
        
        var padding = prefs.getLong("tutorial-element-ss-padding", 4);
        var paddingTotal = padding * 2;
        
        var bo = element.boxObject;
        var canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'html:canvas');
        var context = canvas.getContext('2d');
        canvas.width = bo.width + paddingTotal;
        canvas.height = bo.height + paddingTotal;
        context.drawWindow(w, bo.x - padding, bo.y - padding, bo.width + paddingTotal, bo.height + paddingTotal, "#FFF");
        
        var dataUrl = canvas.toDataURL("image/png", 1);
        
        return dataUrl;
    };
    
    /**
     * Parse the given markdown text, this imposes our own markdown
     * rules, such as callbacks and callouts
     */
    this.parseMarkdown = function(text)
    {
        try
        {
            var ejs = new ko.snippets.EJS(text);
            text = ejs.render();
        } catch (e)
        {
            log.debug("Parsing of EJS failed");
        }
        
        var rx;
        
        // Images
        rx = /!\[(element)\:([\w\s_'#:\/,.-]+)\]/g;
        text = text.replace(rx, function(match, type, value) {
            var url = value;
            if (type == "element")
                url = this.getImageFor(value);
            return '<img src="'+url+'"/>';
        }.bind(this));
        
        // Links
        rx = /\[([^\n\r\t<>]*?)\]\[(callback|callout)\:([\w\s_-]+)\]/g;
        text = text.replace(rx, function(match, label, type, callback) {
            var method = 'logic' + (type.charAt(0).toUpperCase() + type.slice(1));
            return '<a href="javascript:topWindow.require(\'tutorials\').'+
                    method+'(\'' + callback + '\')">' + label + '</a>';
        });
        
        var marked = require("contrib/marked");
        marked.setOptions({
            gfm: true,
            smartLists: true,
            smartypants: true
        });
        text = marked(text);
        
        // Ensure links open in a browser and not in Komodo
        text = text.replace(/<a href="(http.*?)"/g, '<a href="javascript:topWindow.ko.browse.openUrlInDefaultBrowser(\'$1\')"');
        
        return text;
    }
    
    /**
     * Normalize meta information
     *
     * Converts keys to camelcase
     */
    this.normalizeMeta = function(meta)
    {
        var isArray = Array.isArray(meta);
        
        if ( ! meta || (! isArray && ((typeof meta) != "object" || meta.constructor.name != "Object")))
        {
            return meta;
        }
        
        var _meta = isArray ? [] : {};
        if (isArray)
        {
            for (let x=0;x<meta.length;x++)
            {
                if ((typeof meta[x]) == "object")
                    _meta.push(this.normalizeMeta(meta[x]));
                else
                    _meta.push(meta[x]);
            }
        }
        else
        {
            for (let k in meta)
            {
                if (!meta.hasOwnProperty(k)) continue;
                let _k = k.charAt(0).toLowerCase() + k.slice(1);
                _k = _k.replace(/\s+([a-z])/g,
                              function(x) { return x[1].toUpperCase() });
                
                if (_k == "files")
                    _meta[_k] = meta[k];
                else
                    _meta[_k] = this.normalizeMeta(meta[k]);
            }
        }
        
        return _meta;
    }
    
}).apply(module.exports);