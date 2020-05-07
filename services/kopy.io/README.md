# kopy

kopy is a fork of Haste. Credits, a proper readme and licensing will be added at a later date.

## Tested Browsers

* Firefox
* Chrome

## Installation

1.  Download the package, and expand it
2.  Explore the settings inside of config.js, but the defaults should be good
3.  `npm install`
4.  `npm start`

## Settings

* `host` - the host the server runs on (default localhost)
* `port` - the port the server runs on (default 7777)
* `keyLength` - the length of the keys to user (default 10)
* `maxLength` - maximum length of a paste (default none)
* `staticMaxAge` - max age for static assets (86400)
* `recompressStatisAssets` - whether or not to compile static js assets (true)
* `documents` - static documents to serve (ex: http://hastebin.com/about.com)
  in addition to static assets.  These will never expire.
* `storage` - storage options (see below)
* `logging` - logging preferences
* `keyGenerator` - key generator options (see below)

## Key Generation

### Phonetic

Attempts to generate phonetic keys, similar to `pwgen`

``` json
{
  "type": "phonetic"
}
```

### Random

Generates a random key

``` json
{
  "type": "random",
  "keyspace": "abcdef"
}
```

The _optional_ keySpace argument is a string of acceptable characters
for the key.

## Storage

### File

To use file storage (the default) change the storage section in `config.js` to
something like:

``` json
{
  "path": "./data",
  "type": "file"
}
```

Where `path` represents where you want the files stored

### Redis

To use redis storage you must install the redis package in npm

`npm install redis`

Once you've done that, your config section should look like:

``` json
{
  "type": "redis",
  "host": "localhost",
  "port": 6379,
  "db": 2
}
```

You can also set an `expire` option to the number of seconds to expire keys in.
This is off by default, but will constantly kick back expirations on each view
or post.

All of which are optional except `type` with very logical default values.

### Memcached

To use memcached storage you must install the `memcache` package via npm

`npm install memcache`

Once you've done that, your config section should look like:

``` json
{
  "type": "memcached",
  "host": "127.0.0.1",
  "port": 11211
}
```

You can also set an `expire` option to the number of seconds to expire keys in.
This behaves just like the redis expirations, but does not push expirations
forward on GETs.

All of which are optional except `type` with very logical default values.

## Docker

For local development you can run the run the redis server in one container and
hastebin in another and have them communicate.  We'll use `docker-compose` for this.

### Hastebin/Kopy.io
In a terminal and the *kopy.io* directory run:
`$ docker-compose up`

When the command completes you should see the following:
```
kopy_1   | info: configuring redis
kopy_1   | info: loading static document name=about, path=about.md
kopy_1   | info: listening on 0.0.0.0:7777
kopy_1   | info: connected to redis on redis:6379/2
```
You will now be able to see the running service at [localhost:7777](localhost:7777).

## Authors

John Crepezzi <john.crepezzi@gmail.com> - original project - Haste
Nathan Rijksen <nathanr@activestate.com> - kopy.io fork
Carey Hoffman <cgchoffman@gmail.com> - Added Docker :P

### Other components:

* jQuery: http://jquery.com/
* CodeMirror: http://codemirror.net/
* EasyDropdown: https://github.com/patrickkunka/easydropdown
