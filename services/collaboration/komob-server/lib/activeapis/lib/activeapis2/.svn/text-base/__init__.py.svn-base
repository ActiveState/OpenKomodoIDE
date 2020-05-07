#!python

"""activeapis2 -- a package of client libs for ActiveState sites."""

def get_version():
    """Return the current version string of this package.
    
    @returns {str} The version string.
    """
    from os.path import join, dirname
    path = join(dirname(__file__), "VERSION.txt")
    f = open(path, 'r')
    version = f.read().strip()
    f.close()
    return version


class APIFactory(object):
    """A factory for getting API class instances. Example:
    
        >>> from activeapis2 import APIFactory
        >>> factory = APIFactory()
        >>> factory.get("accountapi")
        <AccountAPI: https://account.activestate.com/api/>
    
    The main use of this factory is for handling the details of configuring
    for the appropriate API endpoint URLs, e.g., for dev or staging
    environments:
    
        >>> settings = {"accountapi.api_url": "http://account.as-beta.com/api/"}
        >>> factory2 = APIFactory(settings)
        >>> factory2.get("accountapi")
        <AccountAPI: http://account.as-beta.com/api/>
    
    in addition, these settings get propagated to the API classes passed to
    other API classes that. For example, the LimeAPI requires StoreAPI and
    AccountAPI instances for cross-API calls:
    
        >>> limeapi = factory2.get("limeapi")
        >>> limeapi._get_accountapi()
        <AccountAPI: http://account.as-beta.com/api/>
    
    Currently supported settings are (a) the `*APIBase` constructor arguments
    (see `apibase.*APIBase.__init__` docstrings for details):
    
        timeout
        auth_name
        auth_password
        auth_domain
        http_cache_dir
        request_headers
    
    and (b) API module-specific settings by prefixing with
    "exampleapi.$settingname". For example "limeapi.timeout" to specify
    a `timeout` just for `LimeAPI` instances. Module-specific settings
    are the only way to specify the `api_url` for API class instances:
    
        accountapi.api_url
        limeapi.api_url
        notificationsapi.api_url
        storeapi.api_url
        codeapi.api_url
        ...
    """

    def __init__(self, settings=None):
        self._settings = settings or {}
        _ctor_args_base = dict((k,v) for k,v in self._settings.items()
            if '.' not in k)
        self._ctor_args_from_apiname = {}
        for k,v in self._settings.items():
            if '.' not in k:
                continue
            ns, k = k.split('.')
            if ns not in self._ctor_args_from_apiname:
                self._ctor_args_from_apiname[ns] = _ctor_args_base.copy()
            self._ctor_args_from_apiname[ns][k] = v

    def _get(self, apiname, **kwargs):
        """Get the API class instance *without the subapis*."""
        ctor_args = self._ctor_args_from_apiname.get(apiname, {})
        ctor_args.update(kwargs)
        if apiname == "accountapi":
            from activeapis2.accountapi import AccountAPI as API
        elif apiname == "storeapi":
            from activeapis2.storeapi import StoreAPI as API
        elif apiname == "limeapi":
            from activeapis2.limeapi import LimeAPI as API
        elif apiname == "notificationsapi":
            from activeapis2.notificationsapi import NotificationsAPI as API
        elif apiname == "codeapi":
            from activeapis2.codeapi import CodeAPI as API
        elif apiname == "fireflyapi":
            from activeapis2.fireflyapi import FireflyAPI as API
        elif apiname == "marketoapi":
            from activeapis2.marketoapi import MarketoAPI as API
        else:
            raise RuntimeError("unknown API name: %s" % apiname)
        return API(**ctor_args)
    
    def get(self, apiname, **kwargs):
        subapinames_from_apiname = {
            "limeapi": ["accountapi", "storeapi"],
            "storeapi": ["limeapi"],
        }
        
        # Get all the API instances we'll need.
        _apis = {}  # <apiname> -> <api class instance>
        needed_apinames = set([apiname])
        while True:
            start_len = len(needed_apinames)
            for n in needed_apinames.copy():
                needed_apinames.update(
                    subapinames_from_apiname.get(n, []))
            if len(needed_apinames) == start_len:
                break
        _apis[apiname] = self._get(apiname, **kwargs)
        for sn in needed_apinames:
            if sn not in _apis:
                _apis[sn] = self._get(sn)  # Do *not* pass kwargs here.
        
        # Hook up the subapi attributes:
        # *WARNING*: This presumes the API classes use "_<apiname>" for
        # the attribute name of these apis.
        for n, api in _apis.items():
            for subapiname in subapinames_from_apiname.get(n, []):
                attrname = "_" + subapiname
                if getattr(api, attrname) is None:
                    setattr(api, attrname, _apis[subapiname])
        
        return _apis[apiname]


_g_default_api_factory = None
def get_api(apiname, **kwargs):
    """Get an instance of one of the ActiveAPIs.
    
        >>> import activeapis2
        >>> activeapis2.get_api("accountapi")
        <AccountAPI: https://account.activestate.com/api/>
    
    @param apiname {str} Name of the API.
    @param kwargs {dict} Optional. Extra args to pass to the API class
        constructor.
    """
    global _g_default_api_factory
    if _g_default_api_factory is None:
        _g_default_api_factory = APIFactory()
    return _g_default_api_factory.get(apiname, **kwargs)


_g_django_api_factory = None
def django_get_api(apiname, **kwargs):
    """Get an instance of one of the ActiveAPIs using settings from
    `django.conf.settings.ACTIVEAPIS_SETTINGS`.
    
        >>> from activeapis2 import django_get_api
        >>> django_get_api("accountapi")
        <AccountAPI: https://account.activestate.com/api/>
    
    @param apiname {str} Name of the API.
    @param kwargs {dict} Optional. Extra args to pass to the API class
        constructor.
    """
    from django.conf import settings
    global _g_django_api_factory
    if _g_django_api_factory is None:
        activeapis_settings = getattr(settings, "ACTIVEAPIS_SETTINGS")
        _g_django_api_factory = APIFactory(activeapis_settings)
    return _g_django_api_factory.get(apiname, **kwargs)

