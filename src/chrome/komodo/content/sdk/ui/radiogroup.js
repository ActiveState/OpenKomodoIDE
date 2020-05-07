var $      = require("ko/dom");
var parent = require("./container");
var log = require("ko/logging").getLogger("ko/ui/radiogroup");

var Module = Object.assign({}, parent);
module.exports = Module;

/**
 * ko/ui radiogroup element
 * 
 * This module inherits methods and properties from the module it extends.
 *
 * @module ko/ui/radiogroup
 * @extends module:ko/ui/container
 * @copyright (c) 2017 ActiveState Software Inc.
 * @license Mozilla Public License v. 2.0
 * @author NathanR, CareyH
 * @example
 * var radiogroup = require("ko/ui/radiogroup").create();
 * radiogroup.addRadioItems(["red","green","blue","yellow"]);
 */
(function() {

    this.Model = Object.assign({}, this.Model);
    /**
     * The model for the menupopup UI element, this is what {@link model:ko/ui/menupopup.create} returns
     * 
     * @class Model
     * @extends module:ko/ui/element~Model
     * @property {string}       name        The node name of the element
     * @property {Element}      element     A XUL hbox, see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/hbox}
     * @property {Element}      formElement     A XUL radiogroup, see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/radiogroup}
     * @property {Element}      $formElement    A @module:ko/dom~QueryObject
     */
    (function() {

        this.name = "hbox";

        this.formElement = null;
        this.$formElement = null;
        /**
         * Create a new radiogroup UI element
         * 
         * @name create
         * @method
         * @param  {object}         [options]   An object containing attributes and options
         * 
         * @returns {module:ko/ui/radiogroup~Model}
         */
        this.init = function(label, options = {})
        {
            if (Array.isArray(options))
            {
                options = { options: options };
            }

            if (typeof label == "object")
            {
                options = label;
                label = null;
            }
            else if (label)
            {
                options.label = label;
            }

            this.parseOptions(options);
            options.options = this.options;
            options.label = label;

            this.$element = $($.createElement(this.name));
            this.$element.addClass("ui-radiogroup-wrapper");
            this.element = this.$element.element();
            this.element._sdk = this;

            this.$formElement = $($.createElement("radiogroup", this.attributes));
            this.$formElement.addClass("ui-radiogroup");
            this.formElement = this.$formElement.element();
            this.$element.append(this.formElement);

            if (options.label)
            {
                this.$element.prepend(require("./label").create(options.label).element);
            }
            var radioBtns = options.options;
            if (radioBtns && Array.isArray(radioBtns))
            {
                this.addRadioItems(radioBtns);
            }
            else if (radioBtns && ! Array.isArray(radioBtns))
            {
                log.warn("Radio items must be in an array.  Failed to add menu "+
                         "items to menu.");
            }
        };
        
        /**
         * disable the radiogroup
         */
        this.disable = function ()
        {
            this.$formElement.attr("disabled", true);
            this.$formElement.children().each(function(){ this.setAttribute("disabled", true); });
        };
        
        /**
         * returns true if the radiogroup is disabled
         */
        this.disabled = function ()
        {
            return !! this.$formElement.attr("disabled");
        };
        
        /**
         * enable the radiogroup
         */
        this.enable = function ()
        {
            this.$formElement.removeAttr("disabled", false);
            this.$formElement.children().each(function(){ this.removeAttribute("disabled"); });
        };
        
        /**
         * Add onChange even handler
         *
         * @param {function} callback - eventhandler callback
         * @memberof module:ko/ui/radiogroup~Model
         * @deprecated use `.on("command", callback)` instead
         */
        this.onChange = function (callback)
        {
            this.$element.on("command", callback);
        };

        /**
         * Add multiple item to the container
         *
          @param {Array} item - item to be added to the container.  Array of items to add, this calls {@link addRadioItem()} for each item
         *
         * @memberof module:ko/ui/radiogroup~Model
         */
        this.addRadioItems = function (items)
        {
            for (let item of items) {
                this.addRadioItem(item);
            }
        };

        /**
         * Add an item to the container
         *
         * @param {(string|object|array|mixed)} item    item to be added to the container.  Can be String (label), ko/ui/<elem>, ko/dom element, DOM element, option object.
         *                                              option object refers to an Options object used throughout this SDK. The options
         *                                              should contain an attributes property to assign a label at the very
         *                                              least: { label: "itemLabel" }
         *                      
         * @returns {Element} DOM element Object 
         *
         * @example
         * `opts` refers to an Options object used throughout this SDK. The options
         * should contain an attributes property to assign a label at the very
         * least:
         *  {
         *      attributes:
         *      {
         *          label:"itemLable",
         *          value:"itemValue // if not supplied, `label` is used as `value`
         *      }
         *  }
         * @memberof module:ko/ui/radiogroup~Model
         */
        this.addRadioItem = function(item)
        {
            let element;
            if (typeof item == "string") 
                element = require("./radio").create(item).element;
            else if ("isSdkElement" in item)
                element = item.element;
            else if ("koDom" in item)
                element = item.element();
            else if ("nodeName" in item)
                element = item;
            else
                element = require("./radio").create(item).element;
            this.$formElement.append(element);
            return element;
        };

        /**
         * Return or set the current value of the element.
         *
         * @param {String=} [value] - value to be set
         *
         * @returns {String} the value of the element
         * @memberof module:ko/ui/radiogroup~Model
         */
        this.value = function(value)
        {
            if ( ! value)
            {
                return this.$formElement.value();
            }

            var that = this;
            this.$formElement.children().each(function ()
            {
                var localValue = this.getAttribute("value") || this.getAttribute("label") || false;
                this.removeAttribute("selected");
                if (value == localValue)
                {
                    that.$formElement.selectedItem = this;
                    that.$formElement.value(value);
                    this.setAttribute("selected", "true");
                }
            });
            return this.$formElement.value();
        };

    }).apply(this.Model);

}).apply(Module);
