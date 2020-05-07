ko.publishing.dynamicButton = {};

(function()
{
    const log = require("ko/logging").getLogger("publishing-dynBtn");
    //log.setLevel(ko.logging.LOG_DEBUG);
    this.currentURI = null;
    this.settings = null;
    this.initDynamicButton = function () {
        var dynBtn = require("ko/dynamic-button");
        dynBtn.register("Publishing", {
            command: this.openCurrentPublishingDialog.bind(this),
            icon: "cloud",
            tooltip: "Open Publishing Dialog",
            events: ["current_view_changed",
                     "current_place_opened",
                     "file_saved",
                     "observe:publishing_configurations_changed"],
            //classList: "scc-menu",
            menuitems: this.updateDynamicMenu,
            menuitemsInitialize: this.updateDynamicMenuInitialize,
            groupOrdinal: 300,
            isEnabled: () => {
                // Check places root
                if(!ko.places || !ko.places.manager)
                {
                    log.debug("Places isn't ready");   
                }
                else
                {
                    var placesRootURI = ko.places.manager.currentPlace;
                    this.settings = ko.publishing.getSettingsForUri(placesRootURI);
                    if (this.settings) {
                        this.currentURI = this.settings.local_uri;
                        return true;
                    }
                }
                var view = require("ko/views").current().get();
                if (view && view.koDoc) {
                    this.settings = ko.publishing.getSettingsForUri(
                        ko.uriparse.pathToURI(view.koDoc.displayPath));
                    if(this.settings)
                    {
                        this.currentURI = this.settings.local_uri;
                        return true;
                    }
                }
                return false;                
            }
        });
    };
    
    this.updateDynamicMenu = function () {
        // Copy the Tools > Publishing Menu
        // Manually call function to popuplate available configs
        ko.publishing.onMenuPopupShowing();
        return document.getElementById('tools_publishing_menupopup').cloneNode(true);
    };
    
    this.updateDynamicMenuInitialize = function () {
        return [
            {
                label: `New Configuration`,
                command: "cmd_publishingNewConfiguration"
            },
        ];
    };
    
    this.openCurrentPublishingDialog = function()
    {
        ko.commands.doCommandAsync('cmd_publishingOpenDialog');
    };
    
}).apply(ko.publishing.dynamicButton);

(function()
{
    function init_publishing_button() {
        ko.publishing.dynamicButton.initDynamicButton();    
    }
    window.addEventListener("komodo-ui-started", init_publishing_button, false);
})();
