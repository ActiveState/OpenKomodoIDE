#!/usr/bin/env python

"""A client library for firefly.activestate.com.

Module Usage
------------

  >>> from activeapis2.fireflyapi import FireflyAPI
  >>> api = FireflyAPI()
  XXX


Dev Notes
---------

Some links to get you started:
  http://trac-hacks.org/wiki/XmlRpcPlugin
  https://firefly.activestate.com/login/xmlrpc    # incomplete documentation
    (https://wst.activestate.com/login/xmlrpc while still in dev)
"""

from pprint import pprint, pformat
from urllib import urlencode, quote as urlquote
import xmlrpclib
import time

if __name__ == "__main__":
    # Magic to allow command line usage.
    import sys
    from os.path import dirname, abspath
    sys.path.insert(0, dirname(dirname(abspath(__file__))))
from activeapis2 import utils
from activeapis2 import apibase



#---- the main API class

class FireflyAPI(apibase.XmlrpcAPIBase):
    """An interface to firefly.activestate.com."""
    DEFAULT_API_URL = "https://firefly.activestate.com/login/xmlrpc"

    def subscriptions_from_username(self, username):
        """Get the subscriptions for the given username.
        
        This is light wrapping of `products.getSubscriptions` to
        return `Subscription` instances and change exception semantics.
        
        @param username {str} ActiveState account username.
        @returns {list} of `Subscription` instances.
        @raises {self.APIError} on error
        """
        try:
            raw = self._server.product.getUserSubscriptions(username)
        except xmlrpclib.Error, ex:
            raise self.APIError("XML-RPC error calling "
                "'product.getUserSubscriptions': %s" % ex)
        return [Subscription(d) for d in raw]

    def subscription_from_service_account_id(self, service_account_id):
        """Get the subscription for the given service_account_id.
        
        This is light wrapping of `products.getSubscription` to
        return an `Subscription` instance and change exception semantics.
        
        @param service_account_id {str} ActiveState's ID for the association
            of this service/subscription with a particular account.
        @returns {Subscription}
        @raises {self.APIError} on error
        """
        try:
            raw = self._server.product.getSubscription(service_account_id)
        except xmlrpclib.Error, ex:
            raise self.APIError("XML-RPC error calling "
                "'product.getSubscription': %s" % ex)
        return Subscription(raw)

    def set_subscription(self, service_account_id, sso_id, username,
                        service_group, service_id, status, expiry_date=None):
        """Set subscription information for the subscription with the given
        service_account_id.  If a subscription with that id exists it's updated;
        otherwise it's created.  A slightly nicer and more explicit version of
        `product.setSubscription`.
        
        @param service_account_id {str} ActiveState's ID for the association
            of this service/subscription with a particular account.
        @param sso_id {int} The SSO id of the user to which the subscription
            belongs.
        @param username {str} The username of the user.
        @param service_group {str} The service group as in Lime (i.e.
            "firefly").
        @param service_id {str} The service id as in Lime (e.g. "firefly_professional_1").
        @param status {str} The status of the subscription (one of "ENABLE",
            "CANCEL", "DELETE", "DISABLE", "SUSPEND" - usually we should only
            be setting one of the first three, the last two being set by
            Monexa).
        @param expiry_date {datetime.date} The date on which a cancelled
            subscription runs out (the date up to which it's been paid).
        @returns {dict} The raw response from the `product.setSubscription`
            call.
        @raises {self.APIError} on error
        """
        if expiry_date:
            expiry_timestamp = int(time.mktime(expiry_date.timetuple()))
        else:
            expiry_timestamp = 0
        
        data = {
            'sso_id': sso_id,
            'username': username,
            'service_account_id': service_account_id,
            'service_group': service_group,
            'service_id': service_id,
            'status': status,
            'expires': expiry_timestamp,
            # these fields are required but currently ignored
            'custom_limits': 0,
            'disk_limit': 0,
            'project_limit': 0,
            'bandwidth_limit': 0,
        }
        
        try:
            result = self._server.product.setSubscription(service_account_id, data)
        except xmlrpclib.Error, ex:
            raise self.APIError("XML-RPC error calling "
                "'product.setSubscription': %s" % ex)
        return result


#---- API object classes and internal support stuff

class Subscription(object):
    """A light object representing Subscription info for a particular
    subscription in Lime.
    """
    def __init__(self, raw):
        """
        @param raw {dict} The raw Lime API subscription dict.
        """
        self._raw = raw

    def __repr__(self):
        return "<%s>" % self
    def __str__(self):
        return ("Subscription: %(service_account_id)s "
            "(%(service_group)s/%(service_id)s) for %(username)s" % self._raw)
    
    @property
    def status(self):
        return self._raw["status"]
    @property
    def username(self):
        return self._raw["username"]

    @property
    def service_id(self):
        return self._raw["service_id"]   # e.g. "firefly_professional_1"
    @property
    def service_group(self):
        return self._raw["service_group"] # e.g. "firefly"
    @property
    def service_account_id(self):
        return self._raw["service_account_id"]   # e.g. 42
    
    @property
    def disk_usage(self):
        """@returns {int} Disk usage in MB"""
        try:
            # Sometimes see empty string from the API.
            return int(self._raw["disk_usage"])
        except:
            return 0
    @property
    def project_usage(self):
        """@returns {int} Number of projects"""
        try:
            # Sometimes see empty string from the API.
            return int(self._raw["project_usage"])
        except:
            return 0
    @property
    def disk_limit(self):
        """@returns {int} Disk limit in MB"""
        return self._raw["disk_limit"]
    @property
    def project_limit(self):
        """@returns {int} Max number of allowed projects"""
        return self._raw["project_limit"]

    @property
    def created_datetime(self):
        return datetime.datetime.fromtimestamp(self._raw["created"])
    @property
    def updated_datetime(self):
        return datetime.datetime.fromtimestamp(self._raw["updated"])


#---- mainline

def main(argv):
    """Usage: ./fireflyapi.py METHOD ARGS"""
    from os.path import exists, expanduser
    from ConfigParser import SafeConfigParser
    import optparse
    
    parser = optparse.OptionParser(usage="%prog METHOD [ARGS...]")
    parser.add_option("-v", "--verbose", action="store_true",
        help="print XML-RPC debugging info")
    parser.add_option("--as-beta", action="store_true",
        help="use the Firefly running on .as-beta.com")
    parser.set_defaults(verbose=False, as_beta=False)
    opts, args = parser.parse_args()
    
    # Gather configuration info -- in particular "username/password"
    # credentials required for `api.notify(...)`.
    kwargs = {}
    conf_path = expanduser("~/.fireflyapi.ini")
    if exists(conf_path):
        conf = SafeConfigParser()
        conf.read(conf_path)
        section = "auth"
        if conf.has_section(section):
            kwargs["auth_name"] = conf.get(section, "username")
            kwargs["auth_password"] = conf.get(section, "password")
    if opts.as_beta:
        kwargs["api_url"] = "https://firefly.as-beta.com/login/xmlrpc"

    api = FireflyAPI(**kwargs)
    method_name, arg_strs = args[0], args[1:]
    method = getattr(api, method_name)
    method_args = []
    for s in arg_strs:
        try:
            method_args.append(int(s))
        except ValueError:
            method_args.append(s)
    print "--", _display_url_from_url(api._api_url)
    print "  method: %s" % method_name
    print "    args: %s" % ", ".join([repr(a) for a in method_args])
    response = method(*method_args)
    pprint(response)

def _display_url_from_url(url):
    """Hide the password in the URL, if any."""
    import urlparse
    display_url = url
    parsed = urlparse.urlparse(url)
    if parsed.password:
        display_url = url.replace(":"+parsed.password+"@",
            ":%s@" % ("*" * len(parsed.password)), 1)
    return display_url

if __name__ == "__main__":
    import sys
    import logging
    if not logging.root.handlers:
        logging.basicConfig()
    sys.exit(main(sys.argv))
