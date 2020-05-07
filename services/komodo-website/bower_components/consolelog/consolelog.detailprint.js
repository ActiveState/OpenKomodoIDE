/**
 * Cross-Browser console.log() Wrapper
 * Detailed Print Plugin
 *
 * Version 2.0.1, 2013-12-21
 * By Craig Patik
 * https://github.com/patik/console.log-wrapper/
 */

window.log = window.log || function() {};

// Checks whether it's necessary to parse details for this browser
window.log.needsDetailPrint = (function _log_needsDetailPrint() {
    var ua = window.navigator.userAgent,
        uaCheck, uaVersion;

    // Look for iOS <6 (thanks to Jörn Berkefeld)
    if (/iPad|iPhone|iPod/.test(window.navigator.platform)) {
        uaCheck = ua.match(/OS\s([0-9]{1})_([0-9]{1})/);
        uaVersion = uaCheck ? parseInt(uaCheck[1], 10) : 0;

        if (uaVersion >= 6) {
            return true;
        }
    }
    // Check for Opera version 11 or lower
    else if (window.opera) {
        uaCheck = /Version\/(\d+)\.\d+/;

        if (uaCheck.test(ua)) {
            if (parseInt(uaCheck.exec(ua)[1], 10) <= 11) {
                return true;
            }
        }
    }
    // Check for Internet Explorer up through version 10
    else if (/MSIE\s\d/.test(ua)) {
        return true;
    }

    return false;
}());

// List arguments separately for easier deciphering in some browsers
window.log.detailPrint = function _log_detailPrint(args) {
    var getSpecificType, detailedArgs, i, j, thisArg, argType, str, beginStr;

    // Checks for special JavaScript types that inherit from Object
    getSpecificType = function _getSpecificType(obj) {
        var reportedType = Object.prototype.toString.call(obj),
            types = ['Array', 'Date', 'RegExp', 'Null'],
            found = '',
            n;

        // Look for special types that inherit from Object
        n = types.length;
        while (n--) {
            if (reportedType === '[object ' + types[n] + ']') {
                found = types[n].toLowerCase();
                break;
            }
        }

        if (found.length) {
            return found;
        }

        // DOM element (DOM level 2 and level 1, respectively)
        if ((typeof HTMLElement === 'object' && obj instanceof HTMLElement) || (typeof obj.nodeName === 'string' && obj.nodeType === 1)) {
            found = 'element';
        }
        // DOM node (DOM level 2 and level 1, respectively)
        else if ((typeof Node === 'object' && obj instanceof Node) || (typeof obj.nodeType === 'number' && typeof obj.nodeName === 'string')) {
            found = 'node';
        }

        // Node list
        if (/^\[object (HTMLCollection|NodeList|Object)\]$/.test(reportedType) &&
            typeof obj.length === 'number' &&
            typeof obj.item !== 'undefined' &&
            (obj.length === 0 || (typeof obj[0] === 'object' && obj[0].nodeType > 0))) {
            found = 'node';
        }

        return found.length ? found : typeof obj;
    };

    // Loop through each argument and collect details for each one
    detailedArgs = [];
    i = 0;
    while (i < args.length) {
        thisArg = args[i];
        // Get argument type
        argType = typeof thisArg;
        beginStr = 'Item ' + (i + 1) + '/' + args.length + ' ';

        // Be more specific about objects
        if (argType === 'object') {
            argType = getSpecificType(thisArg);

            switch(argType) {
                case 'array':
                    // Include array length and contents' types
                    if (!thisArg.length) {
                        detailedArgs.push(beginStr + '(array, empty) ', thisArg);
                    }
                    else {
                        // Get the types of up to 3 items
                        j = thisArg.length > 3 ? 3 : thisArg.length;
                        str = '';

                        while (j--) {
                            str = getSpecificType(thisArg[j]) + ', ' + str;
                        }

                        if (thisArg.length > 3) {
                            str += '...';
                        }
                        else {
                            str = str.replace(/,+\s+$/, '');
                        }

                        detailedArgs.push(beginStr + '(array, length=' + thisArg.length + ', [' + str + ']) ', thisArg);
                    }

                    break;

                case 'element':
                    str = thisArg.nodeName.toLowerCase();

                    if (thisArg.id) {
                        str += '#' + thisArg.id;
                    }

                    if (thisArg.className) {
                        str += '.' + thisArg.className.replace(/\s+/g, '.');
                    }

                    detailedArgs.push(beginStr + '(element, ' + str + ') ', thisArg);

                    break;

                case 'date':
                    detailedArgs.push(beginStr + '(date) ', thisArg.toUTCString());

                    break;

                default:
                    detailedArgs.push(beginStr + '(' + argType + ')', thisArg);

                    if (argType === 'object') {
                        // Print properties for plain objects (first level only)
                        if (typeof thisArg.hasOwnProperty === 'function') {
                            for (j in thisArg) {
                                if (thisArg.hasOwnProperty(j)) {
                                    detailedArgs.push('  --> "' + j + '" = (' + getSpecificType(thisArg[j]) + ') ', thisArg[j]);
                                }
                            }
                        }
                    }

                    break;
            }
        }
        // Print non-objects as-is
        else {
            detailedArgs.push(beginStr + '(' + typeof thisArg + ') ', thisArg);
        }

        i++;
    }

    return detailedArgs;
};
