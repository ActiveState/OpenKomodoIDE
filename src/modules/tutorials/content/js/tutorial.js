window.addEventListener('load', function() {
    window.topWindow = require("ko/windows").getMain();
    topWindow.require("tutorials/tutorials").onPanelReady();
});