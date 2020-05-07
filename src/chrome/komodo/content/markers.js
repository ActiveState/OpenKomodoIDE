/* Copyright (c) 2003-2006 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

if (typeof(ko)=='undefined') {
    var ko = {};
}

/**
 * This module defines how Scintilla markers are used in Komodo.
 * http://www.scintilla.org/ScintillaDoc.html#Markers
 *
 * Marker are the images in the editor gutter for things like bookmarks,
 * breakpoints. Also line background color for current line, current line in a
 * debugger session, etc.
 */
ko.markers =  function markers_module() {
    // private vars
    var content_cache = {};
    
    return {
    
    // Marker numbers.
    // Most of the ISciMoz.marker*() methods take a marker number argument.
    // The higher the marker number the higher the marker's z-order.
    // Here are the marker numbers that Komodo uses.

    // 25-31 are dedicated to folding
    // 22-24 are dedicated to tracking (insert, delete, modify)
    // Note: In order to conserve marker numbers, view-specific markers may
    // overlap. For example, bookmarks cannot be set in terminal/shell views,
    // and interactive prompt lines do not occur in editing views. Therefore
    // their marker numbers may overlap due to differing contexts.
    MAX_MARKNUM: 20,
    MARKNUM_BOOKMARK0: 18,
    MARKNUM_BOOKMARK9: 17,
    MARKNUM_BOOKMARK8: 16,
    MARKNUM_BOOKMARK7: 15,
    MARKNUM_BOOKMARK6: 14,
    MARKNUM_HISTORYLOC: 13,
    MARKNUM_STDERR: 12, // only used in terminal view
    MARKNUM_BOOKMARK5: 12,
    MARKNUM_STDOUT: 11, // only used in terminal view
    MARKNUM_BOOKMARK4: 11,
    MARKNUM_CURRENT_LINE_BACKGROUND: 10,
    MARKNUM_STDIN_PROMPT: 9, // only used in terminal view
    MARKNUM_BOOKMARK3: 9,
    MARKNUM_INTERACTIVE_PROMPT_MORE: 8, // only used in interactive shell
    MARKNUM_BOOKMARK2: 8,
    MARKNUM_INTERACTIVE_PROMPT: 7, // only used in interactive shell
    MARKNUM_BOOKMARK1: 20,
    MARKNUM_BOOKMARK: 19,
    MARKNUM_SIMPLEDEBUG_DISABLED: 7, // These take the place of bookmark 1 and 2
    MARKNUM_SIMPLEDEBUG_ENABLED: 6,  // so that bookmarks have priority over simpledebug
    MARKNUM_DEBUG_CURRENT_LINE: 5,
    MARKNUM_SPAWNPOINT_ENABLED: 4,
    MARKNUM_SPAWNPOINT_DISABLED: 3,
    MARKNUM_BREAKPOINT_ENABLED: 2,
    MARKNUM_BREAKPOINT_DISABLED: 1,
    MARKNUM_TRANSIENTMARK: 0, // used in buffer view

    /**
     * Read a file from disk, cache and return the contents.
     *
     * @param {String} uri file uri
     * @param {boolean} force force read from file
     * 
     * Note: The file contents are cached by URI.
     * This is used to load pixmaps for scintilla markers.
     */
    getPixmap: function(uri, force) {
        if (!force && typeof(content_cache[uri]) != 'undefined') {
            return content_cache[uri];
        }
        var file = Components.classes["@activestate.com/koFileEx;1"]
                .createInstance(Components.interfaces.koIFileEx)
        file.URI = uri;
        file.open('rb');
        content_cache[uri] = file.readfile();
        file.close();
        return content_cache[uri];
    },

    /**
     * Asynchronously load an image (e.g. png), cache the result and run the
     * given callback with the image details.
     *
     * @param {String} uri file uri
     * 
     * Note: The file contents are cached by URI.
     */
    getImageDataAsync: function(uri, callback) {
        if (uri in content_cache) {
            var cache_entry = content_cache[uri];
            if (cache_entry[0] == "pending") {
                cache_entry[1].push(callback);
                return;
            }
            // It's already loaded - fire the callback now.
            callback.apply(ko.markers, content_cache[uri]);
        }

        // Make note that this image is pending.
        content_cache[uri] = ["pending", [callback]];

        // Load the image so we can get it's size and data.
        var image = new Image();
        // Make it hidden.
        image.setAttribute("hidden", "true");
        image.onload = function(event) {
            try {
                var width = image.naturalWidth;
                var height = image.naturalHeight;
                var ctx = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas").getContext("2d");
                ctx.width = width;
                ctx.height = height;
                ctx.drawImage(image, 0, 0);
                var data = ctx.getImageData(0, 0, width, height).data;
                // Turn data into a string
                data = [String.fromCharCode(x) for (x of data)].join("");
                // Cache the result and run all callbacks.
                var callbacks = content_cache[uri][1];
                content_cache[uri] = [width, height, data];
                for (var i=0; i < callbacks.length; i++) {
                    callbacks[i](width, height, data);
                }
            } finally {
                document.documentElement.removeChild(image);
            }
        }
        image.src = uri;
        // Have to add the image to the document in order to have it load.
        document.documentElement.appendChild(image);
    },

    /**
     * Setup the standard Komodo markers in the given SciMoz instance and
     * return an appropriate mask for ISciMoz.setMarginMaskN(<n>, <mask>).
     * 
     * @param {Components.interfaces.ISciMoz} scimoz - A plugin instance.
     * @param {Boolean} isDarkBackground - whether scimoz is using a dark bg.
     * @param {Boolean} terminal - whether to initialize markers for terminal
     *   or shell views, rather than for editing views. The default is false.
     *   Terminal/shell views being initialized must set this to true.
     */
    setup: function(scimoz, isDarkBackground, terminal) {
        var color;
        if (typeof(require) == "function") {
            color = require("ko/color");
        } else {
            ko.logging.getLogger("markers.js").warn("Include globals.js for require functionality");
            xtk.include("color");
            color = xtk.color;
        }
        //XXX Was this: scimoz.markerDefine(ko.markers.MARKNUM_CURRENT_LINE_BACKGROUND, 32);
        //scimoz.markerDefine(ko.markers.MARKNUM_CURRENT_LINE_BACKGROUND,
        //                    scimoz.SC_MARK_BACKGROUND);
        //XXX The colors for this marker are changed depending on if we are
        //    debugging or not and what the user's Komodo style is.
        scimoz.markerDefinePixmap(ko.markers.MARKNUM_BOOKMARK,
                                  ko.markers.getPixmap("chrome://komodo/skin/images/bookmark.xpm"));
    
        scimoz.markerDefine(ko.markers.MARKNUM_DEBUG_CURRENT_LINE, scimoz.SC_MARK_SHORTARROW);
        scimoz.markerSetFore(ko.markers.MARKNUM_DEBUG_CURRENT_LINE, color.RGBToBGR(0x8f, 0x00, 0x00));
        scimoz.markerSetBack(ko.markers.MARKNUM_DEBUG_CURRENT_LINE, color.scintilla_yellow);
    
        scimoz.markerDefinePixmap(ko.markers.MARKNUM_SPAWNPOINT_ENABLED,
                                  ko.markers.getPixmap("chrome://komodo/skin/images/spawnpoint.xpm"));
        scimoz.markerDefinePixmap(ko.markers.MARKNUM_SPAWNPOINT_DISABLED,
                                  ko.markers.getPixmap("chrome://komodo/skin/images/spawnpoint_disable.xpm"));
        scimoz.markerDefinePixmap(ko.markers.MARKNUM_BREAKPOINT_ENABLED,
                                  ko.markers.getPixmap("chrome://komodo/skin/images/breakpoint_enabled.xpm"));
        // An example of loading a PNG image instead.
        //ko.markers.getImageDataAsync("chrome://komodo/content/icons/breakpoint.png",
        //                            function(width, height, data) {
        //                                scimoz.rGBAImageSetWidth(width);
        //                                scimoz.rGBAImageSetHeight(height);
        //                                scimoz.markerDefineRGBAImage(ko.markers.MARKNUM_BREAKPOINT_ENABLED,
        //                                                             data);
        //                            });
        scimoz.markerDefinePixmap(ko.markers.MARKNUM_BREAKPOINT_DISABLED,
                                  ko.markers.getPixmap("chrome://komodo/skin/images/breakpoint_disabled.xpm"));

        scimoz.markerDefinePixmap(ko.markers.MARKNUM_SIMPLEDEBUG_ENABLED,
                                  ko.markers.getPixmap("chrome://komodo/skin/images/simpledebug_enabled.xpm"));
        scimoz.markerDefinePixmap(ko.markers.MARKNUM_SIMPLEDEBUG_DISABLED,
                                  ko.markers.getPixmap("chrome://komodo/skin/images/simpledebug_disabled.xpm"));

        // Quick bookmark markers.
        for (let c of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
            scimoz.markerDefinePixmap(ko.markers['MARKNUM_BOOKMARK' + c],
                                      ko.markers.getPixmap("chrome://komodo/skin/images/bookmark_" + c + ".xpm"));
        }
        
        if (terminal) {
            scimoz.markerDefinePixmap(ko.markers.MARKNUM_INTERACTIVE_PROMPT,
                                      ko.markers.getPixmap("chrome://komodo/skin/images/prompt.xpm"));
        
            scimoz.markerDefine(ko.markers.MARKNUM_INTERACTIVE_PROMPT_MORE, scimoz.SC_MARK_DOTDOTDOT);
            scimoz.markerSetFore(ko.markers.MARKNUM_INTERACTIVE_PROMPT_MORE, isDarkBackground ? color.scintilla_black : color.scintilla_white);
        
            scimoz.markerDefine(ko.markers.MARKNUM_STDIN_PROMPT, scimoz.SC_MARK_CHARACTER+'%'.charCodeAt(0));
            scimoz.markerSetFore(ko.markers.MARKNUM_STDIN_PROMPT, color.scintilla_red);
        
            scimoz.markerDefine(ko.markers.MARKNUM_STDOUT, scimoz.SC_MARK_EMPTY);
            //scimoz.markerSetBack(ko.markers.MARKNUM_STDOUT, color.RGBToBGR(0xFA, 0xFA, 0xFF));
            scimoz.markerDefine(ko.markers.MARKNUM_STDERR, scimoz.SC_MARK_EMPTY);
            //scimoz.markerSetBack(ko.markers.MARKNUM_STDERR, color.RGBToBGR(0xFF, 0xFA, 0xFA));
        }
        
        scimoz.markerDefine(ko.markers.MARKNUM_HISTORYLOC, scimoz.SC_MARK_EMPTY);
    
        //XXX Have to see if this is necessary, i.e. if anything helpful is
        //    being done with this.
        //// Failed breakpoints (mo.fb not at a breakable position)
        //scimoz.markerDefine(1, scimoz.SC_MARK_CIRCLE);
        //scimoz.markerSetFore(1, RGB (0x8f, 0x00, 0x00));
        //scimoz.markerSetBack(1, color.scintilla_green);
    
        scimoz.markerDefine(ko.markers.MARKNUM_TRANSIENTMARK, scimoz.SC_MARK_EMPTY);
    
        return ko.markers.MARKERS_MASK_SYMBOLS;
    }
    };

}();

// Include all markers *except* MARKNUM_CURRENT_LINE_BACKGROUND, as the
// background marker is handled independently.
// - Want the Nth bitfield for marker N to be set iff that marker should
//   be visible in the symbol margin.
ko.markers.MARKERS_MASK_SYMBOLS = ((1 << (ko.markers.MAX_MARKNUM+1)) - 1) ^ (1 << ko.markers.MARKNUM_CURRENT_LINE_BACKGROUND);
