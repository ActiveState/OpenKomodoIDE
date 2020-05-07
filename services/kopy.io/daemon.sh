#!/bin/bash
# Deployment daemon
# chkconfig: 345 20 80
# description: Manages the kopy.io server
# processname: kopy

DAEMON_PATH="/home/deployment/kopy.io-master"
DAEMON="node server.js"
NAME="kopy"
USER="nathanr"

case "$1" in
start)
    su $USER -c "source ~/.nvm/nvm.sh && forever start $DAEMON_PATH/server.js -w"
;;
status)
    su $USER -c "source ~/.nvm/nvm.sh && forever list"
;;
stop)
    su $USER -c "source ~/.nvm/nvm.sh && forever stop $DAEMON_PATH/server.js"
;;

restart)
    $0 stop
    $0 start
;;

*)
    echo "Usage: $0 {status|start|stop|restart}"
    exit 1
esac
