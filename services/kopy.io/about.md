What is kopy.io?
================

kopy.io is an alternative to the plethora of pastebin sites out there. So why
create another one? A few reasons;

 * None of the alternatives were as sleek and easy to use as we'd like
 * We wanted to be able to have advanced compatibility between pastebin and our editor (Komodo IDE)
 * As with Komodo, we want the user to be able to configure their tool the way that works for them.
 * We have a ton of ideas that would make sharing pastes (kopies ;)) that much more useful, which none of the other services implement (well).

In a lot of ways kopy.io is just a tool we really wanted to use ourselves, and
we're able to share it with you.

Using kopy.io
=============

kopy.io was designed to be intuitive, if you can't figure out how something works
then we failed and should revise that particular area of kopy.io. If you do run
into issues please send an email to komodo@activestate.com.

Privacy
-------

You can optionally choose to encrypt your kopies using a client-side encryption
library. This will use a JS library called Crypto-JS by Jeff Mott to encrypt
your data client side using the AES algorithm. A private key will be generated
for you and added as a hash to your kopy, which you can then share with others.
You can remove the hash from the url and just share the base kopy url, users will
then be prompted for the hash, which you can then share separately.

Note that this feature is still very new, and though we are not purposely tracking
your private key it is possible that tools such as analytics end up inadvertedly
tracking it anyway. In theory this should not happen, we'll remove this warning
once we can be sure that this data is not being recorded in any way, shape, or form.

Tools and Integrations
======================

Currently kopy.io is still brand new and we're still working on various integrations
with Komodo as well as potentially other third party tools.

## Command Line Function

Simply add this to your .bashrc or .profile file and you will be able to pipe
text straight to kopy

```
kopy() { a=$(cat); curl -X POST -s -d "raw:$a" http://kopy.io/documents | awk -F '"' '{print "http://kopy.io/"$4}'; }
```

Once you've added this function and you have opened a new shell you will be
able to pipe data to kopy.

eg. `echo "Hello World!" | kopy`

## [kopycat](https://github.com/xmnr/kopycat) - Advanced CLI Access

kopycat is a command-line utility to interact with kopy.io. It is friendly to
pipelining and shell scripting, and supports the same form of encryption as the
web site. As the name implies, its meant to work just like cat.

Created by [xmnr](https://github.com/xmnr)

## [Komodo IDE Addon](http://komodoide.com/resources/addons/komodo--kopyiointegration/)

You can install the kopy.io addon from the [Komodo Resources Page](http://komodoide.com/resources/addons/komodo--kopyiointegration/)

Note that as of Komodo 9 kopy.io functionality is built-in, so you do not need
to install an addon.


## [KopyPasta](https://plugins.jetbrains.com/plugin/7668) - JetBrains IDE Plugin

Works with IntelliJ IDEA, RubyMine, WebStorm, PhpStorm, PyCharm, etc

Created by [Robin Malfait](http://www.robinmalfait.com/)

Contributors
============

In particular the pastebin functionality itself was forked
from Haste (https://github.com/seejohnrun/haste-server) developed by John Crepezzi.

Our contributors (both direct and indirect):

 * John Crepezzi - Haste Server
 * Han Boetes - Shell Tool https://github.com/seejohnrun/haste-client#lightweight-alternative
 * GitHub: @nickthename - Shell Tool https://github.com/seejohnrun/haste-client#lightweight-alternative
 * Nathan Rijksen - kopy.io development
 * Ivan Tay - kopy.io logo design
 * xmnr - kopycat script
 * Robin Malfait - JetBrains Plugin

Open Source Tools Used
======================

Of course we can't take full credit for kopy.io, we are big believers in
Open-Source (have some Komodo Edit) and based kopy.io on various open-source
tools and libraries. These are the tools/libs we use on kopy.io;

Frontend:

 * jQuery - http://jquery.com/
 * CodeMirror - http://codemirror.net/
 * Cookies.js - https://github.com/ScottHamper/Cookies
 * Entypo - http://www.entypo.com/
 * IcoMoon - https://icomoon.io/
 * Crypto-JS - https://code.google.com/p/crypto-js/
 * Marked - https://github.com/chjj/marked

Backend:

 * Node.js - http://nodejs.org/
 * redis - http://redis.io/
 * NPM: busboy, connect, mocha, redis, redis-url, should, uglify-js, winston (and dependencies)
