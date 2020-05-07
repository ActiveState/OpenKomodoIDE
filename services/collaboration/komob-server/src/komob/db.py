from redis import Redis
import redisco
import activeapis2
from komob import app

config = app.config

# Two database connections two the same Redis server: One is the redisco model
# backend (currently db #0). The other is the Account Site Komodo SSO Session
# Store, (currently db #1).

redisco.connection_setup(host=config['REDIS_HOST'],
                         port=config['REDIS_PORT'],
                         db=config['REDIS_MODEL_DB'],
                         password=config['REDIS_PASSWORD'])

session_store = Redis(host=config['REDIS_HOST'],
                      port=config['REDIS_PORT'],
                      db=config['REDIS_SESSION_DB'],
                      password=config['REDIS_PASSWORD'])

_api_settings = app.config['ACCOUNT_API_SETTINGS']
account_api = activeapis2.get_api("accountapi", **_api_settings)


# xxx monkey patch mutual exclusion into account_api since it's not thread-safe
from threading import Lock
account_api.__request = account_api._request
account_api_mutex = Lock()
def _threadsafe_request(*args, **kwargs):
    try:
        account_api_mutex.acquire()
        val = account_api.__request(*args, **kwargs)
    finally:
        account_api_mutex.release()
    return val
account_api._request = _threadsafe_request
del _threadsafe_request
# xxx monkey patch end

del app, config, _api_settings