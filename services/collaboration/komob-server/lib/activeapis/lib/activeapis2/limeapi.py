
"""A client library for talking to the Lime API,
the ActiveState license manager.

A quick example:
    
    >>> from activeapis2.limeapi import LimeAPI
    >>> api = LimeAPI()
    >>> license_ids = api.license_ids_from_sso_id(23)   # Trent's license ids.
    >>> api.licenses(license_ids)  # Get a `License` object for each id.
    [<License S5054A720B: ActivePerl Pro Studio>,
     ...]
"""

import os
from urllib import urlencode
from pprint import pprint, pformat
import datetime
import warnings

from activeapis2 import utils, dateutils
from activeapis2 import apibase



#--- globals

# The list of available upgrades in the ActiveState store for a given
# product+licver ("licver" is the part of the version relevant for
# license differentiation).
#
# TODO:XXX This should be part of the Store or Lime API!
#
# A "possible upgrade" data structure is:
#   (<product and version name>,            # a name that can be used in a UI
#    <store/lime product/prostudio name>,   # the version-less name the Store and Lime use
#    <store_id for product>)                # the store's product/prostudio ID, to be used in Store APIs
#
# Note that "store_id" currently just indicates a product -- the
# version is implied to be the latest.
#
_g_available_upgrades_from_product_and_licver = {
    "Komodo IDE 6": [
        ("ActivePerl Pro Studio", "ActivePerl Pro Studio", 11, True),
        ("ActiveTcl Pro Studio", "ActiveTcl Pro Studio", 12, True),
    ],
    "Komodo IDE 5": [
        ("Komodo IDE 6", "Komodo IDE", 8, False),
    ],
    "Perl Dev Kit 7": [
        ("Perl Dev Kit 9", "Perl Dev Kit", 9, False),
    ],
    "Perl Dev Kit 8": [
        ("Perl Dev Kit 9", "Perl Dev Kit", 9, False),
        ("ActivePerl Pro Studio", "ActivePerl Pro Studio", 11, True),
    ],
    "Perl Dev Kit 9": [
        ("ActivePerl Pro Studio", "ActivePerl Pro Studio", 11, True),
    ],
    "Tcl Dev Kit 4": [
        ("Tcl Dev Kit 5", "Tcl Dev Kit", 10, False),
    ],
    "Tcl Dev Kit 5": [
        ("ActiveTcl Pro Studio", "ActiveTcl Pro Studio", 12, True),
    ],
}
# as above, but not directly available to users (only to be used by CSRs)
_g_restricted_upgrades_from_product_and_licver = {
}


#---- the main API class

class LimeAPI(apibase.HttpAPIBase):
    DEFAULT_API_URL = "http://lime.activestate.com/"

    class NoAccountAPIError(apibase.APIBase.APIError):
        """Need to talk to the AccountAPI but no `accountapi` argument
        was given to the constructor.
        """

    class NoStoreAPIError(apibase.APIBase.APIError):
        """Need to talk to the StoreAPI but no `storeapi` argument
        was given to the constructor.
        """

    def __init__(self, *args, **kwargs):
        """Create an API instance.
        
        ... all params from HttpAPIBase ...
        @param _sso_id {int} Optional. The ActiveState SSO id of the
            authenticated user using any data modification API calls. Can be
            overriden in any of those methods.
        @param accountapi {activeapis2.accountapi.AccountAPI} An Account API
            on which this API can call for account info. If not given some
            API methods and objects will not work (typically will raise
            `LimeAPI.NoAccountAPIError`).
        @param storeapi {activeapis2.storeapi.StoreAPI} An Store API
            on which this API can call for store info. If not given some
            API methods and objects will not work (typically will raise
            `LimeAPI.NoStoreAPIError`).
        """
        self._sso_id = kwargs.get("_sso_id")
        if "_sso_id" in kwargs:
            del kwargs["_sso_id"]
        self._accountapi = kwargs.get("accountapi")
        if "accountapi" in kwargs:
            del kwargs["accountapi"]
        self._storeapi = kwargs.get("storeapi")
        if "storeapi" in kwargs:
            del kwargs["storeapi"]
        super(LimeAPI, self).__init__(*args, **kwargs)

    def _get_accountapi(self):
        if self._accountapi is None:
            raise self.NoAccountAPIError()
        return self._accountapi

    def _get_storeapi(self):
        if self._storeapi is None:
            raise self.NoStoreAPIError()
        return self._storeapi

    def licenses(self, ids, include_related=False):
        """Return a list of `License` instances, one for each given
        license id. This builds on `.raw_licenses`.
        
        @param ids {list} List of license ids.
        @param include_related {bool} If True, include not only data for models
            related to the licenses (the default), but also data for models
            related to those related models (i.e. fetch data up to two degrees
            of separation away from the license, rather than just one).
        @returns {list} A list of `License` instances -- light wrappers
            around a raw Lime license dict.
        """
        cache = {}
        return [License(d, self, cache) for d in self.raw_licenses(ids, include_related)]

    def raw_licenses(self, ids, include_related=False):
        """/licenses/$ids
        Return a list of license dicts for the given license ids.

        @param ids {list} List of license ids.
        @param include_related {bool} If True, include not only data for models
            related to the licenses (the default), but also data for models
            related to those related models (i.e. fetch data up to two degrees
            of separation away from the license, rather than just one).
        @returns {list} A list of license dicts -- the raw result from Lime.
        """
        if not ids:
            return []
        url = self._api_url + "licenses/" + ','.join(str(id) for id in ids)
        if include_related:
            url += "?full_tree=1"
        response = self._request_json(url)
        #pprint(response)
        return response

    def subscriptions(self, ids):
        """Get subscription info for each given subscription id.
        
        @param ids {list} List of subscription ids.
        @returns {list} A list of `Subscription` instances.
        """
        if not ids:
            return []
        url = self._api_url + "subscriptions/" + ','.join(str(id) for id in ids)
        response = self._request_json(url)
        #pprint(response)
        
        cache = {}
        return [Subscription(s, self) for s in response]

    def subscription_from_service_account_id(self, service_account_id):
        """Get the subscription for the given `service_account_id`
        
        Dev Notes:
        The Lime API endpoint *should* respond like this:
            400 if `service_account_id` is not an int
            404 if the `service_account_id` isn't known
        but it doesn't because this is difficult with the current Cake setup.
        
        @param service_account_id {int} A service account id, i.e. the
            identifier for a particular service owned by a particular account.
        @returns {Subscription}
        @raises {self.APIError} if the subscription could not be found.
        """
        if not service_account_id:
            raise self.APIError(
                "No subscription found; no service_account_id provided.")
        url = self._api_url + "subscriptions/service_account/%s" % service_account_id
        response = self._request_json(url)
        #pprint(response)
        if response:
            return Subscription(response[0], self)
        else:
            raise self.APIError(
                "No subscription found for service_account_id '%s'."
                % service_account_id)

    def recent_subscriptions(self, num_results=25):
        """Get a list of the n most recently-added subscriptions in Lime.
        
        @param num_results {int} The number of subscriptions to get.  If None
            or 0, all subscriptions will be fetched - beware, this may be
            prohibitively slow.
        @returns {list of Subscription instances} in order of descending
            creation time.
        """
        if not num_results:
            num_results = 0
        url = self._api_url + "subscriptions/?limit=%s" % num_results
        response = self._request_json(url)
        if not isinstance(response, list):
            raise self.APIError("unexpected response from %s: %r "
                % (url, response))
        return [Subscription(sub, self) for sub in response]

    def expired_subscription_ids(self):
        """Get a list of ids of all subscriptions which have been cancelled,
            passed their expiry dates, and not been deleted.
        
        @returns {list} A list of int subscription ids.
        """
        url = self._api_url + "subscriptions/expired"
        response = self._request_json(url)
        #pprint(response)
        if not isinstance(response, list):
            raise self.APIError("unexpected response from %s: %r "
                % (url, response))
        return response

    def subscription_statuses(self, subscription_id):
        """Get a list of the statuses the given subscription has gone through.
        
        @param subscription_id {int} A Lime subscription id.
        @returns {list} A list of SubscriptionStatus instances, in ascending
            order by creation date.
        """
        url = self._api_url + "subscriptionstatuses/subscriptions/%s" % subscription_id
        response = self._request_json(url)
        return [SubscriptionStatus(r) for r in response]

    def subscription_renewals(self, subscription_id):
        """Get a list of the given subscription's renewal records, if any.
        
        @param subscription_id {int} A Lime subscription id.
        @returns {list} A list of SubscriptionRenewal instances, in ascending
            order by creation date.
        """
        url = self._api_url + "subscriptionrenewals/subscriptions/%s" % subscription_id
        try:
            response = self._request_json(url)
            return [SubscriptionRenewal(r) for r in response]
        except self.NotFoundError:
            return []
    
    def set_subscription_status(self, subscription_id, status, _sso_id=None):
        """Update the subscription with the given id to have the given status.
        
        @param subscription_id {int} A Lime subscription id.
        @param status {str} The desired new status.
        @returns {list} A list containing the Lime Subscriptionstatus dict for
            the created status record.
        """
        url = self._api_url + "subscriptionstatuses/"
        if not _sso_id:
            _sso_id = self._sso_id
        if not _sso_id:
            raise self.APIError("No '_sso_id' set for Lime data modification API call set_subscription_status()")
        
        data = {
            '_sso_id': _sso_id,
            'subscription_id': subscription_id,
            'name': status,
        }
        response = self._request_json(url, "POST", data)
        #pprint(response)
        return response

    def delete_subscription(self, subscription_id, _sso_id=None):
        """Mark the given subscription as deleted.
        
        @param subscription_id {int} A Lime subscription id.
        @returns {list} A list containing the Lime Subscription dict for the
            updated Subscription.
        """
        url = self._api_url + "subscriptions/%s/delete" % subscription_id
        if not _sso_id:
            _sso_id = self._sso_id
        if not _sso_id:
            raise self.APIError("no `_sso_id' set for Lime data "
                "modification API call delete_subscription()")
        
        data = {"_sso_id": _sso_id}
        response = self._request_json(url, "POST", data)
        return Subscription(response[0], self)

    def update_license(self, license_id, is_deleted=None, _sso_id=None):
        """/licenses/$license_id/update -- Update fields on a license.
        
        TODO: add the other fields that can be edited.
        
        @param license_id {int} The license to update. 
        @param is_deleted {bool} Mark this license 'deleted'.
        @param _sso_id {int} Authorization SSO id, should be the SSO id of
            the user performing this action. This is used for logging. If
            not given `self._sso_id` (set on the constructor) is used.
        @returns {License} The updated license information.
        @raises {self.APIError}
        """
        url = self._api_url + "licenses/%s/update" % license_id
        if not _sso_id:
            _sso_id = self._sso_id
        if not _sso_id:
            raise self.APIError("no `_sso_id' set for Lime data "
                "modification API call")
        
        data = {
        }
        if is_deleted is not None:
            # Lime API wants 1 or 0, I suspect.
            data["is_deleted"] = {True: 1, False: 0}[is_deleted]
        if not data:
            raise self.APIError("no attributes were given to be changed")
        data["_sso_id"] = _sso_id
        
        response = self._request_json(url, "POST", data)
        return response

    def void_license(self, license_id, _sso_id=None):
        """/licenses/$id/void
        "Voids" the given license: marks it as deleted, and if it was created
        by upgrading another license, makes that license upgradeable again.
        
        @param license_id {int} The license to void.
        @param _sso_id {int} Authorization SSO id, should be the SSO id of
            the user performing this action. This is used for logging. If
            not given `self._sso_id` (set on the constructor) is used.
        @returns {License} The updated license information.
        """
        url = self._api_url + "licenses/%s/void" % license_id
        if not _sso_id:
            _sso_id = self._sso_id
        if not _sso_id:
            raise self.APIError("no `_sso_id' set for Lime data "
                "modification API call")
        
        data = {"_sso_id": _sso_id}
        response = self._request_json(url, "POST", data)
        return response

    def order_ids_from_license_id(self, id):
        """/licenses/$id/orders
        Return a list of order IDs for the given license id.

        @param id {int|str} A license id. This can also be a license
            serial number (what Lime calls a "license_key")
        @returns {list} A list of order IDs (ints).
        """
        url = self._api_url + "licenses/%s/orders" % id
        response = self._request_json(url)
        #pprint(response)
        return response
    
    def transaction_from_id(self, transaction_id):
        """/transactions/$transaction_id
        
        @returns {Transaction} or None if a matching transaction could not
            be found.
        """
        # Some guards because lime.as.com/transactions/$id can have
        # surprises (see bug 84376).
        try:
            transaction_id = int(transaction_id)
        except ValueError:
            return None
        if transaction_id == 0:
            return None
        
        url = self._api_url + "transactions/" + str(transaction_id)
        response = self._request_json(url)
        #pprint(response)
        
        # I'd *expect* the transaction dict back from this, but currently, at
        # least Lime is returning a length-1 list with the transaction dict.
        if isinstance(response, list) and len(response) == 1:
            response = response[0]
        return Transaction(response)
    
    def licenses_from_order_id(self, order_id):
        """Return the licenses purchased in this order.
        
        @param order_id {int}
        @returns {list of License} The licenses provided by this order.
            If the order id is unknown this will return the empty list.
        @raises {NotFoundError} if the order couldn't be found (or if
            there was some other error in Lime finding the associated
            licenses).
        """
        #TODO: when moved to production, use transactions/orders/$order_id/licenses
        #url = "%stransactions/orders/%s/licenses" % (
        #    self._api_url, order_id)
        url = self._api_url + "transactions/orders/" + str(order_id)
        response = self._request_json(url)
        return self.licenses(response)
    
    def subscriptions_from_order_id(self, order_id):
        """Return the subscriptions purchased in this order.
        
        @param order_id {int}
        @returns {list of Subscription} The subscriptions provided by this order.
            If the order id is unknown this will return the empty list.
        @raises {NotFoundError} if the order couldn't be found (or if
            there was some other error in Lime finding the associated
            subscriptions).
        """
        url = "%stransactions/orders/%s/subscriptions" % (
            self._api_url, order_id)
        response = self._request_json(url)
        return self.subscriptions(response)
    
    def raw_products(self):
        """/products
        Return the list of ActiveState products. Note that the returned
        dicts include (a) a 'store_id' for use in calls to the Store API;
        and (b) a "Version" list of current product versions.

        @returns {list} A list of product dicts -- the raw result from Lime.
        """
        url = self._api_url + "products"
        response = self._request_json(url)
        #pprint(response)
        return response

    def transfer(self, license_id, admin_user_id,
            assign_lic_flag=False, _sso_id=None):
        """Transfer admin of this license to a new account.

        @param license_id {int} The license id to transfer
        @param admin_user_id {int} The SSO id of the account to which to
            transfer.
        @param assign_lic_flag {bool} Default false. Indicates if the license
            should also be activated for the same user.
        @param _sso_id {int} Authorization SSO id, should be the SSO id of
            the user performing this action. This is used for logging. If
            not given `self._sso_id` (set on the constructor) is used.
        @returns {License} The updated license info.
        """
        d = self.raw_licenses_transfer(license_id, admin_user_id,
            assign_lic_flag, _sso_id)
        return License(d, self)
    
    def raw_licenses_transfer(self, license_id, admin_user_id,
            assign_lic_flag=False, _sso_id=None):
        """/licenses/$license_id/transfer
        Transfer admin of this license to a new account.

        @param license_id {int} The license id to transfer
        @param admin_user_id {int} The SSO id of the account to which to
            transfer.
        @param assign_lic_flag {bool} Default false. Indicates if the license
            should also be activated for the same user.
        @param _sso_id {int} Authorization SSO id, should be the SSO id of
            the user performing this action. This is used for logging. If
            not given `self._sso_id` (set on the constructor) is used.
        @returns {dict} The updated license dict.
        """
        url = self._api_url + "licenses/%s/transfer" % license_id
        if not _sso_id:
            _sso_id = self._sso_id
        if not _sso_id:
            raise self.APIError("no `_sso_id' set for Lime data "
                "modification API call")
        data = {
            "license_id": license_id,
            "admin_user_id": admin_user_id,
            "assign_lic_flag": {True: 1, False: 0}.get(assign_lic_flag, 0),
            "_sso_id": _sso_id,
        }
        response = self._request_json(url, "POST", data)
        #pprint(response)
        return response
    
    def license_ids_from_sso_id(self, sso_id):
        """Return license ids for the given account. Note that this *excludes*
        deleted licenses (`is_deleted = 1`).
        
        @param sso_id {int} The ActiveState SSO sso_id for the account.
        @returns {list} A list of license ids for this user, or None if not
            found. E.g.: [24808, 88340]
        """
        url = self._api_url + "licenses/users/%s" % sso_id
        response = self._request_json(url)
        #pprint(response)
        if not isinstance(response, list):
            # Lime can script up sometimes (deployment trouble on one
            # occasion) and return some other format here. Trap here.
            raise self.APIError("unexpected response from %s: %r "
                % (url, response))
        return response
    licenses_users = license_ids_from_sso_id  # DEPRECATED: use the new name
    
    def subscription_ids_from_sso_id(self, sso_id, service_group=None):
        """Get subscription ids for the given account, and optionally
        limited to the given service group.
        
        @param sso_id {int} ActiveState Account id.
        @param service_group {str} Optional. Service group name to which to
            limit the lookup. Example: "firefly"
        @returns {list} List of subscription ids.
        """
        url = self._api_url + "subscriptions/users/%s" % sso_id
        if service_group:
            url = "%s/%s" % (url, service_group)
        response = self._request_json(url)
        #pprint(response)
        if not isinstance(response, list):
            # Lime can script up sometimes (deployment trouble on one
            # occasion) and return some other format here. Trap here.
            raise self.APIError("unexpected response from %s: %r "
                % (url, response))
        return response
    
    def subscription_license_ids_from_enduser_sso_id(self, sso_id):
        """Return the ids of licenses which have associated subscriptions and
        are assigned to given account. Note that this *excludes* deleted
        licenses and subscriptions (`is_deleted = 1`).
        
        @param sso_id {int} The ActiveState SSO sso_id for the account.
        @returns {list} A list of license ids for this user, or None if not
            found. E.g.: [24808, 88340]
        """
        url = self._api_url + "licenses_subscriptions/endusers/%s" % sso_id
        response = self._request_json(url)
        #pprint(response)
        if not isinstance(response, list):
            # Lime can script up sometimes (deployment trouble on one
            # occasion) and return some other format here. Trap here.
            raise self.APIError("unexpected response from %s: %r "
                % (url, response))
        return response
    
    def all_license_ids_from_sso_id(self, sso_id):
        """Return all license ids for the given account. Note that this
        *includes* deleted licenses (`is_deleted = 1`).
        
        @param sso_id {int} The ActiveState SSO sso_id for the user.
        @returns {list} A list of license ids for this user, or None if not
            found. E.g.: [24808, 88340]
        """
        url = self._api_url + "licenses/users/%s/all" % sso_id
        response = self._request_json(url)
        #pprint(response)
        if not isinstance(response, list):
            # Lime can script up sometimes (deployment trouble on one
            # occasion) and return some other format here. Trap here.
            raise self.APIError("unexpected response from %s: %r "
                % (url, response))
        return response
    
    def all_subscription_ids_from_sso_id(self, sso_id):
        """Get subscription ids for the given account, *including* deleted
        subscriptions (`is_deleted = 1`).
        
        @param sso_id {int} ActiveState Account id.
        @returns {list} List of subscription ids.
        """
        url = self._api_url + "subscriptions/users/%s/all" % sso_id
        response = self._request_json(url)
        #pprint(response)
        if not isinstance(response, list):
            raise self.APIError("unexpected response from %s: %r "
                % (url, response))
        return response
    
    def raw_licenses_counts(self, sso_ids):
        """/licenses/counts/$sso_ids
        
        Annoyances in this API:
        - A bogus sso_id, e.g. "asdf", is treated as SSO id 0 and gets an
          entry like so: {"sso_id": 0, "num_licenses": 13670}
        
        @deprecated
        @param sso_ids {list} A list of SSO ids for which to gather counts.
        @returns {list} A list of dicts of the form:
            {'sso_id': $sso_id, 'num_licenses': 42}
        """
        warnings.warn(
            "`LimeAPI.raw_licenses_counts` is deprecated, use `counts_from_sso_ids`",
            DeprecationWarning)
        url = (self._api_url + "licenses/counts/"
            + ','.join(str(id) for id in sso_ids))
        response = self._request_json(url)
        #pprint(response)
        return response
    
    def num_licenses_from_sso_ids(self, sso_ids):
        """Return a mapping of sso_id -> num_licenses.
        
        Builds on `raw_licenses_counts`.
        
        @deprecated
        @returns {dict} Mapping of sso_ids to number of licenses. If an
            sso_id was unknown or bogus, then this the count for that
            one will be zero.
        """
        warnings.warn(
            "`LimeAPI.num_licenses_from_sso_ids` is deprecated, use `counts_from_sso_ids`",
            DeprecationWarning)
        mapping = {}
        sso_id_set = set(sso_ids)
        try:
            for item in self.raw_licenses_counts(sso_ids):
                sso_id = item["sso_id"]
                if sso_id == 0:
                    continue
                mapping[sso_id] = int(item["num_licenses"])
                sso_id_set.remove(sso_id)
        except self.NotFoundError:
            pass
        for sso_id in sso_id_set:
            mapping[sso_id] = 0
        return mapping
    
    def counts_from_sso_ids(self, sso_ids):
        """Return a mapping of sso_id -> {dict of counts}.
        
        @param sso_ids {list} A list of SSO ids for which to gather counts.
        @returns {dict} A mapping of SSO ids to dicts of the form:
            {'num_licenses': 42, 'num_subscriptions': 15}.  If an sso_id was
            unknown, its counts will be 0.
        @raises {NotFoundError} if any of the sso_ids are bogus (anything other
            than non-negative integers).
        """
        url = self._api_url + "counts/" + ",".join(str(id) for id in sso_ids)
        response = self._request_json(url)
        
        mapping = {}
        for item in response:
            mapping[item['sso_id']] = {
                'num_licenses': item['num_licenses'],
                'num_subscriptions': item['num_subscriptions'],
            }
        
        return mapping
    
    def total_counts(self):
        """Returns a dict containing the total numbers of licenses and
        subscriptions in LIME.
        
        @returns {dict} The counts of licenses and subscriptions:
            {'num_licenses': 42, 'num_subscriptions': 15}
        """
        url = self._api_url + "counts/"
        response = self._request_json(url)
        return response
    
    def licenses_users_safari(self, sso_id):
        """/licenses/users/safarieligible/$sso_id
        Return, if one exists, a license which is assigned to the given user and
        provides access to Safari.  LIME takes care of picking the "best" such
        license if there are several.
        
        @param sso_id {int} The ActiveState SSO ID for the user.
        @returns {License} A `License` instance, or None.
        """
        url = self._api_url + "licenses/users/safarieligible/" + str(sso_id)
        try:
            response = self._request_json(url)
        except self.NotFoundError:
            license = None
        else:
            #pprint(response)
            license = License(response[0], self)
        
        return license
    
    def license_from_serial_num(self, serial_num):
        """Return a `License` instance for the given serial number.
        
        This builds on `.raw_licenses_lookupbykey()`. Note that Lime's
        "license_key" and "serial_num" are the same thing. Other than Lime
        "serial number" is the common usage.
        
        @returns {License} or None if the serial number is unknown.
        """
        d = self.raw_licenses_lookupbykey(serial_num)
        if d:
            return License(d, self)
        else:
            return None

    def raw_licenses_lookupbykey(self, license_key):
        """/licenses/lookupbykey/$license_key
        Lookup a given license key (aka serial number)
        
        Example return value:
            {
              "Product": [
                {
                  "created": "2006-05-17 11:35:02",
                  "id": 4,
                  "modified": "2006-05-17 11:35:02",
                  "name": "Komodo Professional",
                  "sku": ""
                }
              ],
              "Version": [
                {
                  "created": "2006-05-17 11:35:02",
                  "current_version_id": 0,
                  "id": 14,
                  "is_latest": 0,
                  "modified": "2006-05-17 11:35:02",
                  "product_id": 4,
                  "version": "3.5.3"
                }
              ],
              "admin_user_id": 916681,
              "bundle_id": 0,
              "created": "2006-10-11 14:17:24",
              "id": 72228,
              "is_deleted": 0,
              "is_fgl": 0,
              "is_stolen": 0,
              "is_student": 0,
              "is_upgraded": 0,
              "license_key": "SBCA784774",
              "modified": "2006-10-11 14:17:24",
              "product_id": 4,
              "prostudio_id": 0,
              "prostudiosubscription_id": 0,
              "transaction_id": 55008,
              "upgraded_from_id": 0,
              "upgraded_to_id": 0,
              "upgrades_until": null,
              "version_id": 14
            }
        
        @param license_key {str} An ActiveState license key, a.k.a. serial
            number, e.g. "SBCA784774".
        @returns {dict} a raw Lime license dict, or `None` if not found.
        """
        url = self._api_url + "licenses/lookupbykey/" + license_key
        response = self._request_json(url)
        #pprint(response)
        if not response:
            return None
        else:
            # The Lime API returns a single license dict in a list. Pointless.
            return response[0]
    
    def extend_subscription(self, subscription_id, expiry_date, _sso_id=None):
        """/subscriptions/$subscription_id/extend
        
        Change the expiry date (*usually* to extend it) of a Subscription.
        
        @param subscription_id {int} The id of the subscription to change.
        @param expiry_date {datetime.date} The new expiry date.
        @param _sso_id {int} Authorization SSO id, should be the SSO id of
            the user performing this action. This is used for logging. If
            not given `self._sso_id` (set on the constructor) is used.
        @returns {Subscription} with the updated 'expiry_date' value.
        """
        url = self._api_url + "subscriptions/%s/extend" % subscription_id
        if not _sso_id:
            _sso_id = self._sso_id
        if not _sso_id:
            raise self.APIError("no `_sso_id' set for Lime data "
                "modification API call")
        data = {
            "expiry_date": expiry_date.strftime("%Y-%m-%d"),
            "_sso_id": _sso_id,
        }
        response = self._request_json(url, "POST", data)
        
        # I'd *expect* the subscription dict back from this, but currently, at
        # least Lime is returning a length-1 list with the subscription dict.
        if isinstance(response, list) and len(response) == 1:
            response = response[0]
        if not isinstance(response, dict):
            raise self.APIError("unexpected response from extending "
                "subscription %s: %r"
                % (subscription_id, response))
        
        #pprint(response)
        return Subscription(response, self)
    
    def create_license(self, admin_user_id, upgraded_from_id=None,
                       prostudio_id=None, bundle_id=None, product_id=None,
                       version_id=None, is_student=None, is_fgl=None,
                       transaction_id=None, _sso_id=None):
        """/licenses
        
        Create a license.  Only the admin_user_id is an absolute requirement,
        but most things will also need either a prostudio_id or a product_id and
        version_id (the exception being a Business Edition license, where the
        product information lives in the subscription record instead).
        
        @param admin_user_id {int} The SSO id of the admin user for the license.
        @param upgraded_from_id {int} The id of the license from which this
            license is an upgrade, if any.
        @param prostudio_id {int} The lime id for the type of Pro Studio this
            license is for, if any.
        @param bundle_id {int} The lime id for the bundle this license was
            obtained as part of, if any (currently this means 5-packs).
        @param product_id {int} The lime id for the product this license is for,
            if any.
        @param version_id {int} The lime id for the product version of this
            license, if product_id is given.
        @param is_student {bool} True if this is a student license.
        @param is_fgl {bool} True if this is an FGL.
        @param transaction_id {int} The lime id for the transaction (i.e. order)
            with which this license is associated, if any.
        @param _sso_id {int} Authorization SSO id, should be the SSO id of
            the user performing this action. This is used for logging. If
            not given `self._sso_id` (set on the constructor) is used.
        @returns {License} The created license.
        """
        # get a dict of just the optional parameters
        params = locals()
        for param in ("self", "admin_user_id", "_sso_id"):
            del params[param]
        
        url = self._api_url + "licenses"
        if not _sso_id:
            _sso_id = self._sso_id
        if not _sso_id:
            raise self.APIError("no `_sso_id' set for Lime data "
                "modification API call")
        
        data = {
            "admin_user_id": admin_user_id,
            "_sso_id": _sso_id,
        }
        
        # only include the optional params if they're given
        for field, value in params.items():
            if value is None: continue
            if field in ("is_student", "is_fgl"):
                # send bools as ints
                value = int(value)
            data[field] = value
        
        response = self._request_json(url, "POST", data)
        
        # lime returns the created license dict in a one-element list
        if isinstance(response, list) and len(response) == 1:
            response = response[0]
        if not isinstance(response, dict):
            raise self.APIError("unexpected response from creating "
                "license for user %s: %r"
                % (admin_user_id, response))
        
        #pprint(response)
        return License(response, self)
    
    def create_subscription(self, user_id, service_group, service_id,
                            upgraded_from_id=None, expiry_date=None,
                            is_recurring=None, service_account_id=None,
                            external_group_id=None, transaction_id=None,
                            license_id=None, _sso_id=None):
        """/subscriptions
        
        Create a subscription record in lime.  No more, no less.
        
        @param user_id {int} SSO id of the user to whom the subscription belongs
        @param service_group {str} The name of the subscription service group.
        @param service_id {str} The service id string.
        @param upgraded_from_id {int} The id of the subscription from which this
            subscription is an upgrade, if any.
        @param expiry_date {datetime.date} The subscription's expiry date, if
            any.
        @param is_recurring {bool} True if this is an automatically-recurring
            subscription (which has been set up in Monexa).
        @param service_account_id {int} The Monexa service-account id, if
            is_recurring is True.
        @param external_group_id {str} Another Monexa identifier (not currently
            used), if is_recurring is True.
        @param transaction_id {int} The lime id for the transaction (i.e. order)
            with which this subscription is associated, if any.
        @param license_id {int} The lime id for the license with which this
            subscription is associated, if any (currently only applies to BE
            and OEM products).
        @param _sso_id {int} Authorization SSO id, should be the SSO id of
            the user performing this action. This is used for logging. If
            not given `self._sso_id` (set on the constructor) is used.
        """
        # get a dict of just the optional parameters
        params = locals()
        for param in ("self", "user_id", "service_group", "service_id", "_sso_id"):
            del params[param]
        
        url = self._api_url + "subscriptions"
        if not _sso_id:
            _sso_id = self._sso_id
        if not _sso_id:
            raise self.APIError("no `_sso_id' set for Lime data "
                "modification API call")
        
        data = {
            "user_id": user_id,
            "service_group": service_group,
            "service_id": service_id,
            "_sso_id": _sso_id,
        }
        
        # only include the optional params if they're given
        for field, value in params.items():
            if value is None: continue
            if field in ("is_recurring",):
                # send bools as ints
                value = int(value)
            if field in ("expiry_date",):
                # format dates properly
                value = value.isoformat()
            data[field] = value
        
        response = self._request_json(url, "POST", data)
        
        # lime returns the created subscription dict in a one-element list
        if isinstance(response, list) and len(response) == 1:
            response = response[0]
        if not isinstance(response, dict):
            raise self.APIError("unexpected response from creating "
                "subscription for user %s: %r"
                % (user_id, response))
        
        #pprint(response)
        return Subscription(response, self)
    
    def activations(self, license_id, user_id, _sso_id=None):
        """/activations
        
        Activate a license -- i.e. assign it to a particular SSO user.
        
        @param license_id {int} The license id to activate.
        @param user_id {int} The SSO id of the user to which to assign
            as end user of this license.
        @param _sso_id {int} Authorization SSO id, should be the SSO id of
            the user performing this action. This is used for logging. If
            not given `self._sso_id` (set on the constructor) is used.
        @returns {list} The list of Lime "Activation" dicts.
        """
        url = self._api_url + "activations"
        if not _sso_id:
            _sso_id = self._sso_id
        if not _sso_id:
            raise self.APIError("no `_sso_id' set for Lime data "
                "modification API call")
        data = {
            "license_id": license_id,
            "user_id": user_id,
            "_sso_id": _sso_id,
        }
        response = self._request_json(url, "POST", data)
        if not isinstance(response, list):
            # For a while at least, Lime would return status 200 with this
            # response content: "No form POST?Array\\n(\\n)\\n"
            # and the activation would not have happened. Trap that here.
            raise self.APIError("unexpected response from activating "
                "license %s: %r" % (license_id, response))
        #pprint(response)
        return response
    
    def safariusers(self, license_id, username, password, _sso_id=None):
        """Associate the given safari account with this license.
        
        @param license_id {int}
        @param username {str} Safari username
        @param password {str} Safari password
        @param _sso_id {int} Authorization SSO id, should be the SSO id of
            the user performing this action. This is used for logging. If
            not given `self._sso_id` (set on the constructor) is used.
        @returns {list} A list with exactly one raw license 'Safariuser' dict.
            For example:
                [{u'created': u'2009-09-16 11:30:24',
                 u'id': 1860,
                 u'license_id': 90105,
                 u'modified': u'2009-09-16 11:30:24',
                 u'safari_password': u'skf8w9n74a',
                 u'safari_username': u'SB118D17B71C.licenses.activestate.com'}]
            Dev Note: Don't rely on this return value. It isn't currently
            that useful.
        """
        url = self._api_url + "safariusers"
        if not _sso_id:
            _sso_id = self._sso_id
        if not _sso_id:
            raise self.APIError("no `_sso_id' set for Lime data "
                "modification API call")
        data = {
            "license_id": license_id,
            "safari_username": username,
            "safari_password": password,
            "_sso_id": _sso_id,
        }
        response = self._request_json(url, "POST", data)
        if not isinstance(response, list):
            raise self.APIError("unexpected response from adding "
                "safari info for license %s: %r" % (license_id, response))
        #pprint(response)
        return response


class License(object):
    """A light object representing Lime info for a particular License."""
    def __init__(self, raw, api, cache=None):
        """
        @param raw {dict} The raw Lime API license dict.
        @param api {LimeAPI} The Lime API instance. This is used for
            exceptions and for calling out to the Account API.
        @param cache {dict} Optional dict used as a cache of sso_id -> user
            mappings to speed up handling of a set of related licenses.
        """
        self._raw = raw
        self._api = api
        self._cache = cache

    def __repr__(self):
        return "<%s>" % self
    def __str__(self):
        return "License %s: %s" % (self.serial_num, self.product_and_licver)

    @property
    def id(self):
        return int(self._raw["id"])

    @property
    def serial_num(self):
        """While Lime calls it the "license_key", the rest of ActiveState
        calls it the serial number.
        """
        return self._raw["license_key"]
    
    @property
    def product(self):
        return self._product_str(False)
    @property
    def product_and_licver(self):
        """String representing the product/version representing separate
        license groups. This is meant to be usable as a key *and* a string
        that can be displayed to a user (i.e. no internal goopy names).
        """
        return self._product_str(True)
    @property
    def product_str(self):
        warnings.warn(
            "`License.product_str` is deprecated, use `product_and_licver`",
            DeprecationWarning)
        return self.product_and_licver
    
    def _product_str(self, include_licver=True):
        try:
            if "Product" in self._raw:
                s = self._raw["Product"]["name"]
                if include_licver:
                    s += " %s" % self._raw["Version"]["version"]
            elif "Prostudio" in self._raw:
                s = self._raw["Prostudio"]["name"]
            else:
                service_id = self._raw["Subscription"]["service_id"]
                s = _store_service_name_from_service_id(service_id,
                    self._api._get_storeapi)
        except:
            self._api._log.exception("error determining product str "
                "from Lime data: %r" % self._raw)
            s = "(internal error)"
        return s
    
    @property
    def prostudiosubscription_id(self):
        return self._raw["prostudiosubscription_id"]
    @property
    def prostudio_id(self):
        return self._raw["prostudio_id"]
    
    @property
    def is_safari_included(self):
        return "Prostudio" in self._raw
    @property
    def safari_username(self):
        try:
            return self._raw["Safariuser"]["safari_username"]
        except KeyError:
            return None
    @property
    def safari_password(self):
        try:
            return self._raw["Safariuser"]["safari_password"]
        except KeyError:
            return None
    
    @property
    def is_upgraded(self):
        return bool(int(self._raw["is_upgraded"]))
    @property
    def is_fgl(self):
        return bool(int(self._raw["is_fgl"]))
    @property
    def is_student(self):
        return bool(int(self._raw["is_student"]))
    @property
    def is_stolen(self):
        return bool(int(self._raw["is_stolen"]))
    
    @property
    def is_activated(self):
        """Returns true iff there is a current activation for this license."""
        for activation in self._raw.get("Activation", []):
            if activation["is_active"]:
                return True
        else:
            return False
    
    @property
    def is_deleted(self):
        return bool(self._raw["is_deleted"])
    
    @property
    def is_upgradeable_to_self(self):
        """Return whether this license can be upgraded to a more recent
        version of the same product (or product group).
        
        Notes: Lime and the Store's definition of "is upgradeable" is that
        there is *something* in the store you can buy using this current
        license. E.g. The latest version of Komodo IDE *is* upgradeable --
        not to a later version of Komodo IDE, but to one of the Pro Studio
        bundles.
        
        This does not apply to subscription products like
        Pro Studio, for which the result will always be False.
        """
        try:
            version_dict = self._raw["Version"]
        except KeyError:
            return False
        is_latest = bool(int(version_dict["is_latest"]))
        is_upgradeable = bool(int(version_dict["is_upgradeable"]))
        is_upgraded = bool(int(self._raw["is_upgraded"]))
        return (not is_upgraded and not is_latest and is_upgradeable)
    
    @property
    def is_maintainable(self):
        """Return whether maintenance is available for this product; amounts to
        "isn't Business Edition" and "isn't an outdated version".  Determining
        whether "add maintenance to this license" is a valid action is someone
        else's job.
        """
        if "Version" not in self._raw and "Prostudio" not in self._raw:
            # not a product; not maintainable
            return False
        
        if "Version" in self._raw and not bool(int(self._raw["Version"]["is_latest"])):
            # not the latest version; can't add maintenance
            return False
        
        return True
    
    @property
    def has_maintenance_subscription(self):
        """Return whether the license has an associated maintenance subscription.
        Makes no assertion about its validity, just its existence.
        """
        if self.subscription and self.subscription.is_maintenance:
            return True
        else:
            return False
    
    _upgrade_to_product_name_exceptions = {
        "PDK Productivity Tools": "PDK",
        "PDK Deployment Tools": "PDK",
        "Komodo Professional": "Komodo",
        "Komodo Personal": "Komodo",
    }
    @property
    def upgrade_to_self_product_name(self):
        """If this license `is_upgradeable_to_self`, this returns a name for the
        product to which one would upgrade. Naively this should just be
        the same product name. However, that isn't the case for, e.g.,
        "PDK Productivity Tools" -- the upgrade product name is "PDK".
        """
        warnings.warn(
            "`License.upgrade_to_self_product_name` is deprecated, use `available_upgrades`",
            DeprecationWarning)
        product_dict = self._raw.get("Product") or self._raw["Prostudio"]
        name = product_dict["name"]
        return self._upgrade_to_product_name_exceptions.get(name, name)

    _upgraded_to_license_cache = False  # can't use `None`
    @property
    def upgraded_to_license(self):
        """Return a License to which this one was upgraded.
        
        @returns {License} or None if this license has not been upgraded.
        """
        if self._upgraded_to_license_cache is False:
            if not self.is_upgraded:
                self._upgraded_to_license_cache = None
            else:
                license_id = self._raw["upgraded_to_id"]
                self._upgraded_to_license_cache = self._api.licenses(
                    [license_id])[0]
        return self._upgraded_to_license_cache

    @property
    def end_user_id(self):
        """The end user of a license is the user to which the license is
        currently assigned -- aka the "user_id" of the only "Activation"
        entry for which `is_active` is true.
        
        @returns {int} SSO id of the end user.
        """
        try:
            for activation in self._raw.get("Activation", []):
                if not activation["is_active"]:
                    continue
                return activation["user_id"]
            else:
                return None
        except:
            log.exception("error determining end_user_id from Lime "
                "data: %r" % self._raw)
            return None
    
    @property
    def end_user_account(self):
        """The end user of a license is the user to which the license is
        currently assigned -- aka the "user_id" of the only "Activation"
        entry for which `is_active` is true.
        
        @returns {activeapis2.accountapi.Account} or None if no end user.
        """
        sso_id = self.end_user_id
        if sso_id:
            return self._account_from_sso_id(sso_id)
        else:
            return None
    
    @property
    def admin_user_id(self):
        """The SSO id of the administrator."""
        return self._raw["admin_user_id"]
    
    @property
    def admin_account(self):
        return self._account_from_sso_id(self.admin_user_id)
    
    @property
    def product_store_id(self):
        """The store's ID for this product.
        
        I.e. the "store_id" in Lime's Product/Prostudio dict.
        
        @raises {KeyError} If called on a non-
        """
        if "Product" in self._raw:
            store_id = self._raw["Product"]["store_id"]
        else:
            store_id = self._raw["Prostudio"]["store_id"]
        return store_id
    
    @property
    def purchase_datetime(self):
        d = dateutils.datetime_strptime(self._raw["created"], "%Y-%m-%d %H:%M:%S")
        return d
    
    _subscription_cache = False
    @property
    def subscription(self):
        if self._subscription_cache is False:
            if "Subscription" in self._raw:
                subscription = Subscription(self._raw["Subscription"], self._api)
            else:
                subscription = None
            self._subscription_cache = subscription
        return self._subscription_cache
    
    _order_cache = False # 'None' means, couldn't find the order.
    @property
    def order(self):
        """Get the order in which this license was purchased.
        
        How? The "transaction_id" on this license can be looked up
            LIMEAPI/transactions/$transaction_id
        which has a "store_transaction_id" which is the order id.
        
        @removed
        @returns {activeapis2.storeapi.Order} or None if no order could
            be found for this license.
        """
        #TODO: find and turf all uses of `LimeAPI.order`. Then remove this.
        raise self._api.APIError("`License.order` is no longer supported, "
            "use `License.orders` or `License.latest_order`")

    _orders_cache = None
    @property
    def orders(self):
        """Get the orders in which this license was purchased.
        
        This can be plural for Pro Studios, for example, where there is
        an order for the original purchase and for each subsequent renewal.
        
        @returns {list of activeapis2.storeapi.Order} The orders, sorted
            by order id (the original order is first).
        """
        if self._orders_cache is None:
            order_ids = self._api.order_ids_from_license_id(self.id)
            if order_ids:
                storeapi = self._api._get_storeapi()
                orders = storeapi.orders(order_ids)
            else:
                orders = []
            self._orders_cache = orders
        return self._orders_cache

    @property
    def latest_order(self):
        """The most recent order relating to this license.
        
        @returns {activeapis2.storeapi.Order} or None if no order for
            this license.
        """
        orders = self.orders
        return (orders and orders[-1] or None)
    
    @property
    def safe_latest_order(self):
        """A safe version of `latest_order` that never raises: falls back
        to None. This means that (a) no order for this license and (b)
        internal error getting the order info are indistinguisable. The
        main use case is in a Django template.
        
        @returns {activeapis2.storeapi.Order} or None if couldn't get the
            order for this license.
        """
        try:
            return self.latest_order
        except Exception:
            return None
    
    @property
    def latest_purchaser_id(self):
        """The SSO id of the *latest* purchaser of this license. Or None if
        it could not be determined.
        
        On products which can be renewed (e.g. Pro Studio subscriptions),
        the latest purchaser may be different than the purchaser for previous
        transactions buying or renewing.
        
        @returns {int} or None if could not be determined
        """
        latest_order = self.latest_order
        if latest_order:
            return self.latest_order.sso_id
        else:
            return None

    @property
    def latest_purchaser_account(self):
        """The account of the latest purchaser of this license.
        
        @returns {accountapi.Account} or None if could not be determined
        """
        sso_id = self.latest_purchaser_id
        if sso_id:
            return self._account_from_sso_id(sso_id)
        else:
            return None

    @property
    def accounts_and_roles(self):
        """Return a list of the accounts (and their relationships) relevant
        to this license. The "roles" are: "end user", "admin", and
        "purchaser". If a single account is more than one of these roles,
        then those are grouped. For example,
        
            [
                (<Account 23: trentm@activestate.com>, ["end user", "admin"]),
                (<Account 15: damienp@activestate.com>, ["purchaser"])
            ]
    
        *WARNING*: The "purchaser" role in this API in (potentially
        misleadingly) the *original* purchaser and not the latest purchaser --
        which can differ in a subscription product that is renewed.
        
        TODO:XXX: Change this to use a new `.latest_purchaser_*` API.
        
        @returns {list of (<activeapis2.accountapi.Account>, <roles>)}
        """
        roles_from_id = {}
        if self.end_user_id:
            roles_from_id.setdefault(self.end_user_id, []).append("end user")
        roles_from_id.setdefault(self.admin_user_id, []).append("admin")
        if self.latest_purchaser_id:
            roles_from_id.setdefault(self.latest_purchaser_id, []).append("purchaser")
        
        retval = []
        for sso_id, roles in roles_from_id.items():
            account = self._account_from_sso_id(sso_id)
            if account is not None: # `account == None` can happen for db mismatches
                retval.append((account, roles))
        return retval
    
    @property
    def available_upgrades(self):
        """Return the list of available upgrades for this license.
        
        @returns {list} of upgrade info 4-tuples:
            (<product+ver name>, <store product name>, <store product id>, <bool: upgrade includes maintenance>)
        """
        # If this license has been upgraded, then it is no longer
        # upgradeable.
        if self._raw["is_upgraded"]:
            return []
        
        # Else return all the upgrades provided by the store for this
        # product.
        product_and_licver = self.product_and_licver
        return _g_available_upgrades_from_product_and_licver.get(
            product_and_licver, [])
    
    @property
    def all_upgrades(self):
        """Return the list of upgrades for this license, including those
        restricted to use only by admins.
        
        @returns {list} of upgrade info 4-tuples:
            (<product+ver name>, <store product name>, <store product id>, <bool: upgrade includes maintenance>)
        """
        # If this license has been upgraded, then it is no longer
        # upgradeable.
        if self._raw["is_upgraded"]:
            return []
        
        product_and_licver = self.product_and_licver
        upgrades = []
        upgrades += _g_available_upgrades_from_product_and_licver.get(
            product_and_licver, [])
        upgrades += _g_restricted_upgrades_from_product_and_licver.get(
            product_and_licver, [])
        return upgrades
    
    def _account_from_sso_id(self, sso_id):
        return _account_from_sso_id(sso_id, self._api._get_accountapi,
            self._cache)
    
    def pformat(self):
        return pformat(self._raw)



class Subscription(object):
    """A light object representing Subscription info for a particular
    subscription in Lime.
    """
    def __init__(self, raw, api, cache=None):
        """
        @param raw {dict} The raw Lime API subscription dict.
        @param api {LimeAPI|StoreAPI} The creating Lime or Store API instance.
            This is used for exceptions and for calling out to the Store API.
        @param cache {dict} Optional dict used as a cache of sso_id -> user
            mappings to speed up handling of a set of related subscriptions.
        """
        self._raw = raw
        self._api = api
        self._cache = cache

    def __repr__(self):
        return "<%s>" % self
    def __str__(self):
        extra = ""
        if self.status:
            extra += " " + self.status
        return "Subscription %s/%s (%s%s)" % (self.service_group,
            self.id, self.service_id, extra)
    
    @property
    def id(self):
        return int(self._raw["id"])

    @property
    def is_recurring(self):
        return bool(self._raw["is_recurring"])
    
    @property
    def is_upgraded(self):
        return bool(int(self._raw["is_upgraded"]))

    @property
    def is_cancelled(self):
        return bool(int(self._raw["is_cancelled"]))

    @property
    def is_expired(self):
        expiry_date = self.expiry_date
        if not expiry_date or expiry_date >= datetime.date.today():
            return False
        else:
            return True

    @property
    def expiry_date(self):
        """The expiry date of this subscription. Note that this only
        has a value if `is_cancelled` is true, or if the subscription
        is non-recurring.
        """
        expiry_date = self._raw.get("expiry_date")
        if expiry_date:
            expiry_date = dateutils.date_strptime(
                expiry_date, "%Y-%m-%d")
        return expiry_date
    
    _billed_up_to_date_cache = False
    @property
    def valid_until_date(self):
        """An active recurring subscription has no expiry date, but in some places
        we need to know how long it's certain to be valid for (i.e. until what
        date it's paid up).  Involves a call to Monexa (through the store) if the
        subscription is on recurring billing.
        
        @returns {datetime.date} The date.
        """
        if self.expiry_date:
            # if we're expiring, that's when we're valid until!
            return self.expiry_date
        else:
            if self._billed_up_to_date_cache is False:
                if self.service_account_id:
                    storeapi = self._api._get_storeapi()
                    billed_up_to = storeapi.service_billed_up_to(self.service_account_id)
                else:
                    billed_up_to = None
                self._billed_up_to_date_cache = billed_up_to
            return self._billed_up_to_date_cache

    @property
    def created_date(self):
        created_date = self._raw.get("created")
        if created_date:
            created_date = dateutils.date_strptime(
                created_date.split()[0], "%Y-%m-%d")
        return created_date

    @property
    def modified_date(self):
        modified_date = self._raw.get("modified")
        if modified_date:
            modified_date = dateutils.date_strptime(
                modified_date.split()[0], "%Y-%m-%d")
        return modified_date

    @property
    def is_deleted(self):
        return bool(int(self._raw["is_deleted"]))

    @property
    def user_id(self):
        return int(self._raw["user_id"])
    
    @property
    def user_account(self):
        """Account info on the user/owner of this subscription.
        
        @returns {activeapis2.accountapi.Account} or None if error
            determining.
        """
        return self._account_from_sso_id(self.user_id)

    @property
    def service_account_id(self):
        return self._raw["service_account_id"]

    @property
    def service_group(self):
        return self._raw["service_group"]

    @property
    def service_id(self):
        return self._raw["service_id"]

    @property
    def external_group_id(self):
        return self._raw["external_group_id"]

    @property
    def is_maintenance(self):
        # Don't look at me like that, I just don't want to hard-code the maintenance
        # service group name in more places than I have to.
        return self.service_group == "maintenance"

    @property
    def status(self):
        """
        Dev Note: Currently this is typically "OK" and is really a
        placeholder until we get a feel for the valid values from Monexa.
        """
        if "Subscriptionstatus" in self._raw:
            # the status comes back as a list, but it *should* contain only one
            # element (the current status)
            return self._raw["Subscriptionstatus"][0]["name"]
        else:
            return None

    @property
    def transaction(self):
        """The Lime transaction record in which this subscription was created.
        Not all subscriptions have an associated transaction, so this may return
        None.
        
        @returns {Transaction} or None if no associated transaction.
        """
        if "Transaction" in self._raw:
            transaction = Transaction(self._raw["Transaction"])
        else:
            transaction = None
        return transaction
    
    _order_cache = False
    @property
    def order(self):
        """Get the Store order in which this subscription was purchased.  Not
        all subscriptions are created from a store order, so this may return None.
        
        @returns {activeapis2.storeapi.Order} The order.
        """
        if self._order_cache is False:
            if self.transaction:
                from activeapis2.storeapi import StoreAPI
                storeapi = (isinstance(self._api, StoreAPI)
                    and self._api or self._api._get_storeapi())
                order = storeapi.orders([self.transaction.store_transaction_id])[0]
            else:
                order = None
            self._order_cache = order
        return self._order_cache
    
    _renewals_cache = False
    @property
    def renewals(self):
        if self._renewals_cache is False:
            if "Subscriptionrenewal" in self._raw:
                renewals = [SubscriptionRenewal(r) for r in self._raw["Subscriptionrenewal"]]
            else:
                # check with lime to make sure; if this subscription wasn't loaded
                # directly, it may be missing its associated model records
                renewals = self._api.subscription_renewals(self.id)
            self._renewals_cache = renewals
        return self._renewals_cache
    
    _upgraded_to_subscription_cache = False  # can't use `None`
    @property
    def upgraded_to_subscription(self):
        """Return a Subscription to which this one was upgraded.
        
        @returns {Subscription} or None if this subscription has not been upgraded.
        """
        if self._upgraded_to_subscription_cache is False:
            if not self.is_upgraded:
                self._upgraded_to_subscription_cache = None
            else:
                subscription_id = self._raw["upgraded_to_id"]
                self._upgraded_to_subscription_cache = self._api.subscriptions(
                    [subscription_id])[0]
        return self._upgraded_to_subscription_cache

    @property
    def license_id(self):
        """Note that for historical reasons, not all subscriptions are
        associated with a license.
        """
        return self._raw.get("license_id")

    _license_cache = False  # `None` means there isn't an associated lic
    @property
    def license(self):
        """Get the `License` associated with this subscription, if any.
        
        @returns {activeapis2.limeapi.License} The license or None.
        """
        if self._license_cache is False:
            if "License" in self._raw:
                raw = self._raw["License"]
                raw["Subscription"] = self._raw.copy()
                del raw["Subscription"]["License"]
                if "Transaction" in self._raw:
                    raw["Transaction"] = self._raw["Transaction"].copy()
                self._license_cache = License(self._raw["License"], self._api)
            else:
                self._license_cache = None
        return self._license_cache

    def _account_from_sso_id(self, sso_id):
        return _account_from_sso_id(sso_id, self._api._get_accountapi,
            self._cache)
    
    def pformat(self):
        return pformat(self._raw)


class SubscriptionStatus(object):
    """A light wrapper around a subscriptionstatus dict. For example:
      {
        "id": 186,
        "name": "ENABLE",
        "subscription_id": 117,
        "is_latest": 1,
        "created": "2009-11-18 09:55:36",
        "modified": "2009-11-18 09:55:36",
      }
    """
    def __init__(self, raw):
        self._raw = raw
    def __repr__(self):
        return ("<SubscriptionStatus %(id)s created on %(created)s: "
            "subscription_id=%(subscription_id)s "
            "name=%(name)s>" % self._raw)
    @property
    def id(self):
        return self._raw["id"]
    @property
    def name(self):
        return self._raw["name"]
    @property
    def subscription_id(self):
        return self._raw["subscription_id"]
    @property
    def is_latest(self):
        return bool(int(self._raw["is_latest"]))
    @property
    def created_date(self):
        created_date = self._raw.get("created")
        if created_date:
            created_date = dateutils.date_strptime(
                created_date.split()[0], "%Y-%m-%d")
        return created_date
    @property
    def modified_date(self):
        modified_date = self._raw.get("modified")
        if modified_date:
            modified_date = dateutils.date_strptime(
                modified_date.split()[0], "%Y-%m-%d")
        return modified_date
    

class SubscriptionRenewal(object):
    """A light wrapper around a subscriptionrenewal dict. For example:
      {
        "id": 29,
        "subscription_id": 352,
        "transaction_id": 70454,
        "old_expiry_date": 2010-09-22,
        "new_expiry_date": None,
        "old_service_account_id": 107451,
        "new_service_account_id": None,
        "created": "2010-09-30 14:42:25",
      }
    """
    def __init__(self, raw):
        self._raw = raw
    def __repr__(self):
        return ("<SubscriptionRenewal %(id)s created on %(created)s: "
            "subscription_id=%(subscription_id)s "
            "transaction_id=%(transaction_id)s>" % self._raw)
    @property
    def id(self):
        return self._raw["id"]
    @property
    def subscription_id(self):
        return self._raw["subscription_id"]
    @property
    def transaction_id(self):
        return self._raw["transaction_id"]
    @property
    def old_expiry_date(self):
        old_expiry_date = self._raw.get("old_expiry_date")
        if old_expiry_date:
            old_expiry_date = dateutils.date_strptime(
                old_expiry_date, "%Y-%m-%d")
        return old_expiry_date
    @property
    def new_expiry_date(self):
        new_expiry_date = self._raw.get("new_expiry_date")
        if new_expiry_date:
            new_expiry_date = dateutils.date_strptime(
                new_expiry_date, "%Y-%m-%d")
        return new_expiry_date
    @property
    def old_service_account_id(self):
        return self._raw["old_service_account_id"]
    @property
    def new_service_account_id(self):
        return self._raw["new_service_account_id"]
    @property
    def created_date(self):
        created_date = self._raw.get("created")
        if created_date:
            created_date = dateutils.date_strptime(
                created_date.split()[0], "%Y-%m-%d")
        return created_date

class Transaction(object):
    """A light wrapper around a transaction dict. For example:
      {
        "id":66452,
        "purchaser_id":282325,
        "store_transaction_id":556433,
        "created":"2009-08-19 15:50:04",
        "modified":"2009-08-19 15:32:07"
      }
    """
    def __init__(self, raw):
        self._raw = raw
    def __repr__(self):
        return ("<Transaction %(id)s created on %(created)s: "
            "purchaser_id=%(purchaser_id)s "
            "store_transaction_id=%(store_transaction_id)s>" % self._raw)
    @property
    def id(self):
        return self._raw["id"]
    @property
    def store_transaction_id(self):
        return self._raw["store_transaction_id"]
    @property
    def purchaser_id(self):
        return self._raw["purchaser_id"]
    @property
    def created_datetime(self):
        return dateutils.datetime_strptime(
            self._raw["created"], "%Y-%m-%d %H:%M:%S")
    @property
    def modified_datetime(self):
        return dateutils.datetime_strptime(
            self._raw["modified"], "%Y-%m-%d %H:%M:%S")




#---- internal support stuff
    
def _hack_is_account_site_server():
    try:
        from django.conf import settings
    except ImportError:
        return False
    else:
        if hasattr(settings, "SSO_COOKIE_DOMAIN"):
            return True
        else:
            return False

def _account_from_sso_id(sso_id, accountapi_getter, cache=None):
    """Get an account info object for the given sso_id -- with support
    for caching.
    
    @returns {activeapis2.accountapi.Account}
    """
    try:
        if cache is None:
            cache = {}
        if sso_id not in cache:
            # HACK: If we call the account.as.com API *from*
            # account.as.com, and account.as.com is current using
            # the Django test/dev server, then this will hang b/c
            # that dev server is single-threaded. Hack around
            # that. Also may as well do this for the live account
            # site server.
            if _hack_is_account_site_server():
                from activeapis2.accountapi import Account
                from django.contrib.auth.models import User
                from sso.utils import get_user_api_response_data
                try:
                    user = User.objects.get(pk=sso_id)
                except User.DoesNotExist:
                    cache[sso_id] = None
                else:
                    # Note: "id" field name is DEPRECATED. Should be dropped
                    # from here sometime.
                    d = get_user_api_response_data(user, ["id", "user_id",
                        "email", "is_active", "username", "fullname",
                        "company", "activation_key"])
                    cache[sso_id] = Account(d)
            else:
                accountapi = accountapi_getter()
                try:
                    cache[sso_id] = accountapi.account_from_user_id(sso_id)
                except accountapi.NotFoundError:
                    cache[sso_id] = None
        return cache[sso_id]
    except:
        import traceback
        traceback.print_exc()
        raise

_g_store_service_list_cache = None
def _store_service_name_from_service_id(service_id, storeapi_getter):
    global _g_store_service_list_cache
    if _g_store_service_list_cache is None or service_id not in _g_store_service_list_cache:
        storeapi = storeapi_getter()
        _g_store_service_list_cache = storeapi.service_list()
    return _g_store_service_list_cache[service_id]
    

