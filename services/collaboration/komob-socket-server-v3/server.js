#!/usr/bin/env node
var cluster = require('cluster'),
    config = require('./config');

cluster('./app')
  .use(cluster.logger(config.log_path))
  .use(cluster.pidfiles(config.pid_path))
  .use(cluster.cli())
  // Enable the next to if you want fancy stats over telnet:
  //.use(cluster.stats())
  //.use(cluster.repl(8888))
  .set('workers', config.workers)
  .set('socket path', config.socket_path)
  .set('user', config.user)
  .listen(config.port);
