/**
 * Cross-Browser console.log() Wrapper
 *
 * Version 2.0.0, 2013-10-20
 * By Craig Patik
 * https://github.com/patik/console.log-wrapper/
 */
/*global log:true */

// Tell IE9 to use its built-in console
if (Function.prototype.bind && /^object$|^function$/.test(typeof console) && typeof console.log === 'object' && typeof window.addEventListener === 'function') {
    ['log', 'info', 'warn', 'error', 'assert', 'dir', 'clear', 'profile', 'profileEnd']
        .forEach(function(method) {
            console[method] = this.call(console[method], console);
        }, Function.prototype.bind);
}

// log() -- The complete, cross-browser (we don't judge!) console.log wrapper for his or her logging pleasure
if (!window.log) {
    window.log = function() {
        var args = arguments,
            isIECompatibilityView = false,
            i, sliced,
            // Test if the browser is IE8
            isIE8 = function _isIE8() {
                // Modenizr, es5-shim, and other scripts may polyfill `Function.prototype.bind` so we can't rely solely on whether that is defined
                return (!Function.prototype.bind || (Function.prototype.bind && typeof window.addEventListener === 'undefined')) &&
                    typeof console === 'object' &&
                    typeof console.log === 'object';
            };

        log.history = log.history || []; // store logs to an array for reference
        log.history.push(arguments);

        // If the detailPrint plugin is loaded, check for IE10- pretending to be an older version,
        //   otherwise it won't pass the "Browser with a console" condition below. IE8-10 can use
        //   console.log normally, even though in IE7/8 modes it will claim the console is not defined.
        // TODO: Can someone please test this on Windows Vista and Windows 8?
        if (log.detailPrint && log.needsDetailPrint) {
            (function() {
                var ua = navigator.userAgent,
                    winRegexp = /Windows\sNT\s(\d+\.\d+)/;

                // Check for certain combinations of Windows and IE versions to test for IE running in an older mode
                if (console && console.log && /MSIE\s(\d+)/.test(ua) && winRegexp.test(ua)) {
                    // Windows 7 or higher cannot possibly run IE7 or older
                    if (parseFloat(winRegexp.exec(ua)[1]) >= 6.1) {
                        isIECompatibilityView = true;
                    }
                    // Cannot test for IE8+ running in IE7 mode on XP (Win 5.1) or Vista (Win 6.0)...
                }
            }());
        }

        // Browser with a console
        if (isIECompatibilityView || typeof console.log === 'function') {
            sliced = Array.prototype.slice.call(args);

            // Get argument details for browsers with primitive consoles if this optional plugin is included
            if (log.detailPrint && log.needsDetailPrint) {
                // Display a separator before the list
                console.log('-----------------');
                args = log.detailPrint(args);
                i = 0;

                while (i < args.length) {
                    console.log(args[i]);
                    i++;
                }
            }
            // Single argument, which is a string
            else if (sliced.length === 1 && typeof sliced[0] === 'string') {
                console.log(sliced.toString());
            }
            else {
                console.log(sliced);
            }
        }
        // IE8
        else if (isIE8()) {
            if (log.detailPrint) {
                // Prettify arguments
                args = log.detailPrint(args);

                // Add separator at the beginning of the list
                args.unshift('-----------------');

                // Loop through arguments and log them individually
                i = 0;
                while (i < args.length) {
                    Function.prototype.call.call(console.log, console, Array.prototype.slice.call([args[i]]));
                    i++;
                }
            }
            else {
                Function.prototype.call.call(console.log, console, Array.prototype.slice.call(args));
            }
        }
        // IE7 and lower, and other old browsers
        else {
            // Inject Firebug lite
            if (!document.getElementById('firebug-lite')) {
                // Include the script
                (function () {
                    var script = document.createElement('script');

                    script.type = 'text/javascript';
                    script.id = 'firebug-lite';

                    // If you run the script locally, change this to /path/to/firebug-lite/build/firebug-lite.js
                    script.src = 'https://getfirebug.com/firebug-lite.js';

                    // If you want to expand the console window by default, uncomment this line
                    //document.getElementsByTagName('HTML')[0].setAttribute('debug','true');
                    document.getElementsByTagName('HEAD')[0].appendChild(script);
                }());

                setTimeout(function() {
                    window.log.apply(window, args);
                }, 2000);
            }
            else {
                // FBL was included but it hasn't finished loading yet, so try again momentarily
                setTimeout(function() {
                    window.log.apply(window, args);
                }, 500);
            }
        }
    };
}
