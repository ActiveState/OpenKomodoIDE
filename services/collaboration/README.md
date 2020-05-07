### Collaboration Server

These are the three services required for the collabortion feature 
in Komodo.

### IMPORTANT Notes
- conf.d directory is a backup of the apache conf files for reference
- komod-server and komob-socket-server-v3 both use the redis service.
  - They both will require a `REDIS_PASSWORD` env var
- REDIS: make sure you change the `requirepass` config in 
  redis.conf.  Then set `REDIS_PASSWORD` env var as that.
- Any references to `account.activestate.com` will need to be removed and any services built around that rewritten to use some other account api, ie. github or gmail.
- komod-socket-server is written in Node 0.4.12...to be useable it will need to be re-written to support a newer version of node or build you're own V8 interpreter.
- There should be READMEs in each service to explain setup.