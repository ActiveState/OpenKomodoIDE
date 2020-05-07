{

    "host": "0.0.0.0",

    "port": 7777,

    "keyLength": 5,

    "maxLength": 400000,

    "staticMaxAge": 86400,

    "recompressStaticAssets": true,

    "logging": [{
            "level": "verbose",
            "type": "Console",
            "colorize": true
        }
    ],

    "keyGenerator": {
        "type": "random"
    },

    "storage": {
        "type": "redis",
        // "host": "redis", // Uncomment when using docker
        "host": "0.0.0.0", // Comment out when using Docker
        "port": 6379,
        "db": 2,
        "expire": 86400
    },

    "documents": {
        "about": "about.md"
    }

}
