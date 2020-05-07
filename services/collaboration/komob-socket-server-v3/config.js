module.exports = {
  /**
   * Port that the server will bind to
   */
  port: 8003,

  /**
   * Number of worker processes to be spawned
   * NOTE: socket.io will not support multiple workers before version 0.7.
   */
  workers: 1,

  /**
   * The user that should run the Workers. null or an invalid value will cause 
   * Workers to run as the user that started the server. Note that the Master 
   * will not change its user.
   */
  user: "collab",

  /**
   * If HTTPS should be used (yes, it should), point `https.key and`
   * `https.cert` respective file paths, otherwise set `https` to `false`.
   */
  // https: false,
  https: {
    key: "/etc/pki/tls/private/star_activestate_com.key",
    cert: "/etc/pki/tls/certs/star_activestate_com.crt",
    ca: ["/etc/pki/tls/certs/DigiCertCA.crt", "/etc/pki/tls/certs/TrustedRoot.crt"]
  },

  /**
   * Log level. Can be one of 'DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERROR',
   * 'CRITICAL', 'ALERT', 'EMERGENCY'.
   */
  log_level: 'WARNING',

  /**
   * Log level for socket.io. Values range from 0 (ERROR), to 3 (DEBUG).
   */
  socket_io_settings: {
    'transports': ['websocket'],

    // Log level values can range from 0 for ERROR to 3 for DEBUG
    'log level': 1,

    // Decrease the heartbeat interval. We had frequent connection timeouts with
    // the default value of 15 seconds.
    'heartbeat interval': 7,
    'heartbeat timeout': 10
  },

  /**
   * Paths for log files, sockets and pid files. Make sure these exist and are
   * writable.
   */
  log_path: __dirname + "/run/log",
  socket_path: __dirname + "/run/socket",
  pid_path: __dirname + "/run/pid",


  /**
   * Location of the Account site server that should be used for
   * authentication. For production this should generally be account.as.com.
   */
  account_api_host: "account.activestate.com",
  account_api_port: 80,

  /**
   * Location of the redis server that works as the session backend and pub/sub
   * channel. Make sure the `redis_password` string is properly escaped.
   */
  redis_host: "collab1.activestate.com",
  redis_password: process.env.REDI_PASSWORD,

  /**
   * Redis db configuration. This must match the corresponding settings in the
   * Collaboration WSGI server, the Sync server and the Account site. Just
   * leave it as it is.
   */
  redis_collab_db: 0,
  redis_session_db: 1,

  /**
   * A list of supported protocol versions. All clients have to supply a version 
   * number with their authentication message. If the number is not in the list,
   * they receive an error message and are disconnected. Make sure these are
   * Strings not Integers.
   */
  supported_komob_versions: ['3']
};
