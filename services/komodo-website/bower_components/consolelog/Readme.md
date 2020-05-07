# All-in-one console.log wrapper

Just drop consolelog.js in your project and start passing data to `log()`. Whichever browser you're testing in, you'll see your data in the console &mdash; if the browser doesn't have a console, Firebug Lite will load. You can pass any variable type: strings, objects, arrays, functions, etc.

**Demo: [patik.github.io/console.log-wrapper](http://patik.github.io/console.log-wrapper/)**

## Detail Print

This is an optional plugin to provide help information about the data that is being logged, especially in IE and older browsers. Just include [consolelog.detailprint.js](https://github.com/patik/console.log-wrapper/blob/master/consolelog.detailprint.js) along with [consolelog.js](https://github.com/patik/console.log-wrapper/blob/master/consolelog.js).

Firebug, WebKit's Developer Tools, and Opera's Dragonfly print useful, interactive items to the console. For example:

````js
console.log( "Here's a string",
             3.14,
             {"alpha": 5, "bravo": false},
             document.getElementById('charlie'),
             new Date()
           );
````

Results in:

![Firebug running in Firefox](https://raw.github.com/patik/console.log-wrapper/master/demo/firebug.png)

Some browsers that have a primitive console &mdash; ones that does not expand arrays, links DOM elements to the source code, prints objects as `[object Object]` rather than listing their properties, etc.

![IE8 without Detail Print](https://raw.github.com/patik/console.log-wrapper/master/demo/ie8-without-detail-print.png)

Some cannot accept multiple arguments to a single `console.log` call. This includes IE 7/8/9/10, iOS 5 and older, and Opera 11 and older, among others.

Using the `detailPrint` companion plugin, special objects are presented in a more readable manner.

![IE8 with Detail Print](https://raw.github.com/patik/console.log-wrapper/master/demo/ie8-with-detail-print.png)

## Demo

[patik.github.io/console.log-wrapper](http://patik.github.io/console.log-wrapper/)

## Documentation

[patik.com/blog/complete-cross-browser-console-log](http://patik.com/blog/complete-cross-browser-console-log)

[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/patik/console.log-wrapper/trend.png)](https://bitdeli.com/free "Bitdeli Badge")
