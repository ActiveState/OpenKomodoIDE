
"""A small library for talking to the ActiveState Account (SSO) site API.

Note: This is a *replacement* for "activesso/activessolib/activessoapi.py".
"""

from pprint import pprint, pformat
from urllib import urlencode
from activeapis2 import utils, apibase, dateutils
jsonlib = utils.jsonlib



#---- the main API class

class AccountAPI(apibase.HttpAPIBase):
    """An interface to the Account API (account.activestate.com),
    ActiveState's account (SSO) site.
    """
    DEFAULT_API_URL = "https://account.activestate.com/api/"
    
    # *Don't* want to cache responses, because data will then be out of date
    # for the "max-age" period after a change. I'm finding, at least for the
    # case of Pinc's `/account/$id/edit/`, that 'Cache-Control: no-cache' is
    # necessary here to get the new updated account values. I don't know why.
    # (TODO: figure out why)
    DEFAULT_REQUEST_HEADERS = {"Cache-Control": "no-cache"}

    def account_from_user_id(self, user_id):
        """Return an `Account` instance (a light object around standard
        SSO data) for the given user_id.
        
        @param user_id {int|str} The SSO id, email address or username of
            the account.
        @returns {Account}
        @raises {NotFoundError} if no such user_id.
        """
        return Account(self.user(user_id))

    def accounts_from_user_ids(self, user_ids):
        """Return a list of `Account` instance, one for each given user_id.
        
        @param user_ids {list} A list of SSO id, email address or username of
            the accounts to retrieve. All must be of the same form.
        @returns {list of Account} An entry is None if no such user id.
        """
        url = self._api_url + "accounts/%s/" % ','.join(str(i) for i in user_ids)
        response = self._request_json(url)
        return [d and Account(d) for d in response]

    def user(self, user_id):
        """/api/user/$user_id/json/ -- return available info on the given user
        
        Note: This is a lower-level API. You probably want
        `account_from_user_id()`.
        
        @param user_id {str|int} The email, username or SSO id of a user.
        """
        if not isinstance(user_id, (int, long)) and '/' in user_id:
            raise self.APIError("invalid account id: %r" % user_id)
        url = self._api_url + "user/%s/json/" % user_id
        response = self._request_json(url)
        return response

    def edit_user(self, user_id, email=None, fullname=None, company=None,
            username=None, is_active=None):
        """/api/internal/edit_user/ -- Update fields on a user.
        
        Note: Yes, this api uses "username" while others use "sso_username".
        Lame. I'm favouring just "username" these days, but there will be a
        migration period.
        
        @param user_id {int} The user to update. 
        @param email {str} A new email address. Must not be taken.
        @param fullname {str} A new full name.
        @param company {str} A new company.
        @param username {str} A username. The user must not have a username
            set already.
        @param is_active {bool} Change the active status of the account.
        @returns {Account} The updated account information.
        """
        url = self._api_url + "internal/edit_user/"
        
        data = {
            "user_id": user_id,
        }
        if email is not None: data["email"] = email
        if fullname is not None: data["fullname"] = fullname
        if company is not None: data["company"] = company
        if username is not None: data["username"] = username
        if is_active is not None: data["is_active"] = jsonlib.dumps(is_active)
        
        response = self._request_json(url, "POST", data)
        return response

    def create_user(self, email, password=None, fullname=None, company=None,
            sso_username=None, create_active=False, send_email=True):
        """/api/create_user/json/ -- Create a new user/account.
        
        @param email {str}
        @param password {str} If not specified then the account will be
            created with an unusable password.
        @param fullname {str} Optional.
        @param company {str} Optional.
        @param sso_username {str} Optional.
        @param create_active {bool} Optional. Whether to make the account
            active immediately -- i.e. forgoeing the usual activation
            email dance. Should only be used if the email is known to
            be valid.
        @param send_email {bool} Optional. Whether to send an email to the
            user about the account creation with an activation link. Default
            True. Only relevant if `create_active == False`.
        @returns {Account} the created account.
        """
        url = self._api_url + "create_user/json/"
        
        data = {
            "email": email,
            "create_active": create_active,
            "send_email": send_email,
        }
        if password: data["password"] = password
        if fullname: data["fullname"] = fullname
        if company: data["company"] = company
        if sso_username: data["sso_username"] = sso_username

        response = self._request_json(url, "POST", data)
        return Account(response)

    def search(self, **fields):
        """/api/search/ -- search for users matching the given criteria
        
        Example raw API return value:
            [
                {"is_active": true,
                 "email:" "trentm@activestate.com",
                 "user_id": 23},
                ...
            ]
        
        One or more criteria must be given, otherwise the search is not
        done and [] is returned. This is currently to guard against a huge
        search on the ActiveState SSO API.

        @param fields {kwargs} Any of "email", "username", "fullname",
            "company", "is_active" (value must be "true" or "false") or "any".
        @returns {list of Account} A list of `Account` instances, one for
            each account matching the search criteria.
        """
        if not fields:
            return []  # no search criteria
        # urlencode(...) uses `str()`, so need to encode unicode values.
        utf8_fields = {}
        for k,v in fields.items():
            utf8_fields[k] = v.encode('utf-8')
        url = self._api_url + "search/?" + urlencode(utf8_fields)
        response = self._request_json(url)
        return [Account(d) for d in response]
    
    def accountchanges(self, user_id=None, since=None, action=None,
            extras=None, page=None, per_page=None, interpret_time=False):
        """Return recent account changes.

        All parameters are optional. This is an authenticated API. A valid
        `username` and `api_password` must be used as credentials. Only
        certain accounts (TODO) are authorized to call this API.
        
        @param user_id {int} An account SSO id on which to filter results.
        @param since {int|str|datetime} A timestamp (e.g. 1250396702) or
            datetime string (e.g. '2009-12-25', '2009-11-11 11:11:00') on
            which to filter: only updates after that time are returned.
        @param action {str} One of 'A', 'D', or 'U' to filter on adds,
            deletes or updates, respectively.
        @param extras {list} A list of strings naming extra information to
            fetch for each returned record. Currently supported extras are:
                user    Includes 'user' field with the user/account dict.
                        Ignored for records where action is 'D'.
        @param page {int} Optional. The page of results to return. Defaults
            to the first page (i.e. the latest changes).
        @param per_page {int} Optional. The number of results to return in
            a page. Defaults to 25, max is 100.
        @param interpret_time {bool} Whether to generate a `time_datetime`
            field (`datetime.datetime` object) for each "time" field.
            Default false.
        @returns {dict} A data structure like the example below that gives
            count and page data and the list of matching account changes.
        @raises {BadRequestError} on a request for an out-of-range page or
            invalid other argument.
        @raises {UnauthorizedError} if insufficient auth credentials were
            given.
    
        {
            "page": 1,
            "per_page": 25,
            "pages": 3,
            "total": 63,
            "data": [
                {
                    "action": "U", 
                    "user_id": 23, 
                    "user": {
                        "user_id": 23, 
                        "is_active": true, 
                        "email": "trentm@activestate.com", 
                        "fullname_ascii": "Trent Mick", 
                        "fullname": "Trent Mick"
                    }, 
                    "time": "2009-12-09 14:02:07"  # This is UTC time
                },
                ...
            ]
        }
        """
        url = self._api_url + "accountchanges/"
        query = {}
        if user_id is not None: query["user_id"] = str(user_id)
        if since is not None: query["since"] = str(since)
        if action is not None: query["action"] = str(action)
        if extras is not None: query["extras"] = ','.join(str(e) for e in extras)
        if page is not None: query["page"] = str(page)
        if per_page is not None: query["per_page"] = str(per_page)
        if query:
            url += "?" + urlencode(query)
        response = self._request_json(url)
        
        if interpret_time:
            for d in response["data"]:
                d["time_datetime"] = dateutils.datetime_strptime(d["time"],
                    "%Y-%m-%d %H:%M:%S")
        #pprint(response)
        return response


class Account(object):
    """A light wrapper around an Account dict.
    
    >>> trent = Account({"user_id": 23, "email": "trentm@activestate.com",
    ...    "fullname": "Trent Mick"})
    >>> joe = Account({"user_id": 42, "email": "joe@aol.com"})
    
    # Access the raw attributes.
    >>> trent.email
    'trentm@activestate.com'
    >>> joe.user_id
    42
    
    # ...and some computed properties.
    >>> trent.name
    'Trent Mick'
    >>> joe.name
    'joe@aol.com'
    >>> trent.summary
    'Trent Mick <trentm@activestate.com>'
    >>> joe.summary
    'joe@aol.com'
    """
    user_id = None          # Always set. Int.
    email = None            # Always set.
    api_password = None     # Always set.
    username = None         # Optional.
    fullname = None         # Optional.
    company = None          # Optional.
    activation_key = None   # None means already activated.
    is_active = None        # Always set to a boolean in `__init__`

    def __init__(self, d):
        for k,v in d.items():
            setattr(self, k, v)
    
    def __repr__(self):
        return "<Account %d: %s>" % (self.user_id, self.email)

    #TODO:XXX Is this used? Is this the name we want? Perhaps display_name?
    @property
    def name(self):
        """The fullname, if set, otherwise the email address."""
        return self.fullname or self.email
    
    @property
    def summary(self):
        """Return a fullname+email summary string for this user."""
        if self.fullname:
            s = "%s <%s>" % (self.fullname, self.email)
        else:
            s = self.email
        return s

