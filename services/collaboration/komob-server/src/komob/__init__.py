import os
from flask import Flask, Request as BaseRequest, request, Response, g
import werkzeug.utils
from komob.lib import filter_internal_ips


class KomodoSsoRequest(BaseRequest):
    """Request subclass with parser for our HTTP Authorization scheme."""
    
    def authorization(self):
        """The `Authorization` value for a Komodo SSO scheme authorization.
        The value must be a secret session key that was generated and stored
        to redis by account.as.com after the client successfully authenticated
        with email and password."""
        header = self.environ.get('HTTP_AUTHORIZATION')
        try:
            scheme, param = header.split(None, 1)
            if scheme.lower() == 'komodo-sso':
                return param
        except ValueError:
            return
    authorization = werkzeug.utils.cached_property(authorization)


# Setup Flask app
app = Flask(__name__)
app.request_class = KomodoSsoRequest
if 'KOMOB_SETTINGS' in os.environ:
    app.config.from_envvar('KOMOB_SETTINGS')
else:
    raise RuntimeError("KOMOB_SETTINGS environment variable is undefined.")

# Setup database connections
import komob.db

# Setup views
from komob.views import texts, collaboration, stats
app.register_module(texts.module, url_prefix='/api')
app.register_module(collaboration.module, url_prefix='/collaboration')
# Only allow approved as.com IPs for /__stats__, 403 all others
stats.module.before_request(filter_internal_ips)
app.register_module(stats.module, url_prefix='/__stats__')