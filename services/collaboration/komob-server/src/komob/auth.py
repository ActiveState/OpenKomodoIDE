from functools import wraps

from flask import abort, g, request
import activeapis2

from komob import app
from komob.db import session_store, account_api
from komob.models import User

def _get_api_user(account_id):
    """GET a user record from the account api."""
    try:
        api_user = account_api.account_from_user_id(account_id)
        return api_user
    except account_api.NotFoundError:
        return None
    except:
        app.logger.error("Error while trying to authenticate user %s - "
                         "could not reach Account API" % account_id)
        abort(500)

def _fetch_user(account_id):
    """See if there is a User model with the given account id. If there is none,
    query the account api and create one. Returns a `User` instance or None."""
    user = User.objects.filter(account_id=account_id).first()
    if user is None:
        api_user = _get_api_user(account_id)
        if api_user:
            # The user instance might have been created in the meantime, thus
            # get_or_create().
            user = User.objects.get_or_create(account_id=api_user.user_id)
    return user

def auth_required(f):
    """Wraps view functions with ActiveState Account API authorization."""
    @wraps(f)
    def decorated(*args, **kwargs):
        sso_key = request.authorization
        if not sso_key:
            abort(401, 'Denied.')
        account_id = session_store.get(sso_key)
        if account_id:
            user = _fetch_user(account_id)
            if user:
                g.sso_user = user
                return f(*args, **kwargs)
        abort(403, '')
    return decorated

def current_user():
    """Returns the user that issued the current request. Authentication must
    have been performed successfully. If not, the request is aborted."""
    
    if g.sso_user is None:
        app.logger.error("User is not set")
        abort(500, None)
    return g.sso_user